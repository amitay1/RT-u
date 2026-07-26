import {
  emptyPtSheet,
  type PtSheet,
  type PtTechnique,
} from '@/types/penetrant';
import {
  emptyRtDigitalAcquisitionDefaults,
  emptyRtDigitalSheet,
  type RtDigitalAcquisition,
  type RtDigitalSheet,
  type RtDigitalTechnique,
} from '@/types/rtDigital';
import {
  emptyRtFilmExposureDefaults,
  emptyRtFilmSheet,
  type NumberOrEmpty,
  type RtFilmExposureView,
  type RtFilmSheet,
  type RtFilmTechnique,
} from '@/types/rtFilm';
import {
  createRtPtSha256Fingerprint,
  isRtPtSha256Fingerprint,
} from '@/lib/rtPtFingerprint';
import {
  EMPTY_RT_PT_DOCUMENT_CONTROL,
  EMPTY_RT_PT_JOB,
  EMPTY_RT_PT_ORGANIZATION,
  RT_PT_DOCUMENT_KIND,
  RT_PT_DOCUMENT_TYPE,
  RT_PT_DOCUMENT_VERSION,
  type RtPtApproval,
  type RtPtControlledReference,
  type RtPtDecodeResult,
  type RtPtDocumentControl,
  type RtPtDocumentStatus,
  type RtPtDocumentV3,
  type RtPtJob,
  type RtPtMethod,
  type RtPtMigrationMetadata,
  type RtPtOrganization,
  type RtPtQuarantineEntry,
  type RtPtQuarantineReason,
  type RtPtQuarantinedScalar,
  type RtPtRevisionHistoryEntry,
  type RtPtUnitSystem,
} from '@/types/rtPtDocument';

type UnknownRecord = Record<string, unknown>;

const MISSING = Symbol('missing');

const LENGTH_UNITS = ['mm', 'inch'] as const;
const DETECTOR_LENGTH_UNITS = ['um', 'mm', 'inch'] as const;
const TIME_UNITS = ['s', 'min', ''] as const;
const DIGITAL_TIME_UNITS = ['ms', 's', 'min', ''] as const;
const TEMPERATURE_UNITS = ['degC', 'degF', ''] as const;
const INSPECTION_STAGES = ['In-process', 'Final', 'Maintenance / in-service', ''] as const;
const INSPECTOR_LEVELS = ['I', 'II', 'III', ''] as const;
const TECHNIQUE_TYPES = ['SWSI', 'DWDI', 'DWSI', ''] as const;
const FILM_SOURCE_TYPES = ['X-ray', 'Gamma', ''] as const;
const PS811000_ENERGY_CURVES = [
  'copper-nickel',
  'steel',
  'titanium',
  'aluminum-magnesium',
  'boron-composite',
  'fiberglass',
  'graphite-adhesive-core',
  '',
] as const;
const PS811000_THICKNESS_BASES = ['entered-thickness', 'honeycomb-components', ''] as const;
const PS811000_VIEWING_MODES = ['single', 'superimposed', ''] as const;
const DIGITAL_SOURCE_TYPES = ['X-ray', ''] as const;
const DIGITAL_WORKFLOWS = ['Static', ''] as const;
const PENETRANT_TYPES = ['Type I', 'Type II', ''] as const;
const PENETRANT_METHODS = ['A', 'B', 'C', 'D', ''] as const;
const SENSITIVITY_LEVELS = ['1/2', '1', '2', '3', '4', ''] as const;
const DOCUMENT_STATUSES = ['draft', 'in-review', 'approved', 'superseded'] as const;
const UNIT_SYSTEMS = ['SI', 'US-customary'] as const;
const APPROVAL_ROLES = ['prepared', 'reviewed', 'cognizant-engineering', 'ndt-level-3'] as const;
const METHODS = ['RT-Film', 'RT-Digital', 'PT'] as const;
const QUARANTINE_REASONS = [
  'performed-result',
  'ambiguous-legacy-field',
  'manual-mapping-required',
] as const;

class CodecError extends Error {}

const isRecord = (value: unknown): value is UnknownRecord => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
);

function record(value: unknown, path: string, partial = false): UnknownRecord {
  if (value === undefined && partial) return {};
  if (!isRecord(value)) throw new CodecError(`${path} must be an object.`);
  return value;
}

function valueAt(source: UnknownRecord, key: string, path: string, partial: boolean): unknown | typeof MISSING {
  if (Object.prototype.hasOwnProperty.call(source, key)) return source[key];
  if (partial) return MISSING;
  throw new CodecError(`${path}.${key} is required.`);
}

function stringField(source: UnknownRecord, key: string, path: string, partial = false, fallback = ''): string {
  const value = valueAt(source, key, path, partial);
  if (value === MISSING) return fallback;
  if (typeof value !== 'string') throw new CodecError(`${path}.${key} must be a string.`);
  return value;
}

function optionalStringField(source: UnknownRecord, key: string, path: string): string | undefined {
  if (!Object.prototype.hasOwnProperty.call(source, key)) return undefined;
  const value = source[key];
  if (typeof value !== 'string') throw new CodecError(`${path}.${key} must be a string.`);
  return value;
}

function nonEmptyStringField(source: UnknownRecord, key: string, path: string): string {
  const value = stringField(source, key, path);
  if (!value.trim()) throw new CodecError(`${path}.${key} must not be empty.`);
  return value;
}

function numberOrEmptyField(
  source: UnknownRecord,
  key: string,
  path: string,
  partial = false,
  fallback: NumberOrEmpty = '',
): NumberOrEmpty {
  const value = valueAt(source, key, path, partial);
  if (value === MISSING) return fallback;
  if (value === '') return '';
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new CodecError(`${path}.${key} must be a finite number or an empty string.`);
  }
  return value;
}

function optionalNumberOrEmptyField(
  source: UnknownRecord,
  key: string,
  path: string,
): NumberOrEmpty | undefined {
  if (!Object.prototype.hasOwnProperty.call(source, key) || source[key] === undefined) return undefined;
  return numberOrEmptyField(source, key, path);
}

function booleanField(
  source: UnknownRecord,
  key: string,
  path: string,
  partial = false,
  fallback = false,
): boolean {
  const value = valueAt(source, key, path, partial);
  if (value === MISSING) return fallback;
  if (typeof value !== 'boolean') throw new CodecError(`${path}.${key} must be true or false.`);
  return value;
}

function enumField<const T extends readonly string[]>(
  source: UnknownRecord,
  key: string,
  path: string,
  allowed: T,
  partial = false,
  fallback: T[number] = allowed[allowed.length - 1],
): T[number] {
  const value = valueAt(source, key, path, partial);
  if (value === MISSING) return fallback;
  if (typeof value !== 'string' || !allowed.includes(value as T[number])) {
    throw new CodecError(`${path}.${key} must be one of: ${allowed.map((item) => item || '(empty)').join(', ')}.`);
  }
  return value as T[number];
}

function arrayField<T>(
  value: unknown,
  path: string,
  parser: (item: unknown, itemPath: string) => T,
  partial = false,
): T[] {
  if (value === undefined && partial) return [];
  if (!Array.isArray(value)) throw new CodecError(`${path} must be an array.`);
  return value.map((item, index) => parser(item, `${path}[${index}]`));
}

function parseGeneral(value: unknown, path: string, partial = false) {
  const source = record(value, path, partial);
  return {
    partName: stringField(source, 'partName', path, partial),
    partNumber: stringField(source, 'partNumber', path, partial),
    vendorCode: stringField(source, 'vendorCode', path, partial),
    partRevisionOrConfiguration: stringField(source, 'partRevisionOrConfiguration', path, partial),
    material: stringField(source, 'material', path, partial),
    surfaceFinish: stringField(source, 'surfaceFinish', path, partial),
    inspectionArea: stringField(source, 'inspectionArea', path, partial),
    thickness: numberOrEmptyField(source, 'thickness', path, partial),
    thicknessUnit: enumField(source, 'thicknessUnit', path, LENGTH_UNITS, partial, 'mm'),
    drawingReference: stringField(source, 'drawingReference', path, partial),
    procedureNumber: stringField(source, 'procedureNumber', path, partial),
    inspectionStage: enumField(source, 'inspectionStage', path, INSPECTION_STAGES, partial, ''),
    inspectorLevel: enumField(source, 'inspectorLevel', path, INSPECTOR_LEVELS, partial, ''),
    date: stringField(source, 'date', path, partial),
  };
}

function parseAcceptance(value: unknown, path: string, partial = false) {
  const source = record(value, path, partial);
  return {
    acceptanceStandard: stringField(source, 'acceptanceStandard', path, partial),
    acceptanceClause: stringField(source, 'acceptanceClause', path, partial),
    acceptanceText: stringField(source, 'acceptanceText', path, partial),
    acceptanceClass: stringField(source, 'acceptanceClass', path, partial),
    acceptanceGrade: stringField(source, 'acceptanceGrade', path, partial),
    specialRequirements: stringField(source, 'specialRequirements', path, partial),
  };
}

function parseFilmExposureDefaults(value: unknown, path: string, partial = false) {
  const source = record(value, path, partial);
  return {
    wallTechnique: enumField(source, 'wallTechnique', path, TECHNIQUE_TYPES, partial, ''),
    sfd: numberOrEmptyField(source, 'sfd', path, partial),
    sfdUnit: enumField(source, 'sfdUnit', path, LENGTH_UNITS, partial, 'mm'),
    sod: numberOrEmptyField(source, 'sod', path, partial),
    sodUnit: enumField(source, 'sodUnit', path, LENGTH_UNITS, partial, 'mm'),
    ofd: numberOrEmptyField(source, 'ofd', path, partial),
    ofdUnit: enumField(source, 'ofdUnit', path, LENGTH_UNITS, partial, 'mm'),
    geometricMagnificationAuto: booleanField(source, 'geometricMagnificationAuto', path, partial, true),
    geometricMagnification: numberOrEmptyField(source, 'geometricMagnification', path, partial),
    thicknessDescription: stringField(source, 'thicknessDescription', path, partial),
    thicknessMin: numberOrEmptyField(source, 'thicknessMin', path, partial),
    thicknessMax: numberOrEmptyField(source, 'thicknessMax', path, partial),
    thicknessUnit: enumField(source, 'thicknessUnit', path, LENGTH_UNITS, partial, 'mm'),
    ps811000EnergyCurve: enumField(source, 'ps811000EnergyCurve', path, PS811000_ENERGY_CURVES, true, ''),
    ps811000EquivalenceMaterial: stringField(source, 'ps811000EquivalenceMaterial', path, true),
    ps811000ThicknessBasis: enumField(source, 'ps811000ThicknessBasis', path, PS811000_THICKNESS_BASES, true, ''),
    honeycombSkins: numberOrEmptyField(source, 'honeycombSkins', path, true),
    honeycombAdhesive: numberOrEmptyField(source, 'honeycombAdhesive', path, true),
    honeycombCapsOrFlanges: numberOrEmptyField(source, 'honeycombCapsOrFlanges', path, true),
    honeycombDoublersOrTriplers: numberOrEmptyField(source, 'honeycombDoublersOrTriplers', path, true),
    coverageDiameter: numberOrEmptyField(source, 'coverageDiameter', path, true),
    coverageDiameterUnit: enumField(source, 'coverageDiameterUnit', path, LENGTH_UNITS, true, 'mm'),
    machineTechniqueReference: stringField(source, 'machineTechniqueReference', path, true),
    requiredUg: numberOrEmptyField(source, 'requiredUg', path, partial),
    requiredUgUnit: enumField(source, 'requiredUgUnit', path, LENGTH_UNITS, partial, 'mm'),
    iqiOverride: stringField(source, 'iqiOverride', path, partial),
    tubeVoltage: numberOrEmptyField(source, 'tubeVoltage', path, partial),
    tubeVoltageUnit: enumField(source, 'tubeVoltageUnit', path, ['kV'] as const, partial, 'kV'),
    tubeCurrent: numberOrEmptyField(source, 'tubeCurrent', path, partial),
    tubeCurrentUnit: enumField(source, 'tubeCurrentUnit', path, ['mA'] as const, partial, 'mA'),
    exposureTime: numberOrEmptyField(source, 'exposureTime', path, partial),
    exposureTimeUnit: enumField(source, 'exposureTimeUnit', path, TIME_UNITS, partial, ''),
    filter: stringField(source, 'filter', path, partial),
    collimation: stringField(source, 'collimation', path, partial),
    filmDesignation: stringField(source, 'filmDesignation', path, partial),
    filmSize: stringField(source, 'filmSize', path, partial),
    maxParts: numberOrEmptyField(source, 'maxParts', path, partial),
    maxCassettes: numberOrEmptyField(source, 'maxCassettes', path, partial),
    beamAngle: numberOrEmptyField(source, 'beamAngle', path, partial),
    beamAngleUnit: enumField(source, 'beamAngleUnit', path, ['deg'] as const, partial, 'deg'),
    screenOverride: stringField(source, 'screenOverride', path, partial),
    overlap: stringField(source, 'overlap', path, partial),
    identification: stringField(source, 'identification', path, partial),
    notes: stringField(source, 'notes', path, partial),
  };
}

function parseFilmView(value: unknown, path: string) : RtFilmExposureView {
  const source = record(value, path);
  return {
    id: nonEmptyStringField(source, 'id', path),
    viewId: stringField(source, 'viewId', path),
    description: stringField(source, 'description', path),
    orientation: stringField(source, 'orientation', path),
    inspectionZone: stringField(source, 'inspectionZone', path),
    referenceAttachmentId: stringField(source, 'referenceAttachmentId', path),
    ...parseFilmExposureDefaults(source, path),
  };
}

function parseFilmSource(value: unknown, path: string, partial = false) {
  const source = record(value, path, partial);
  const xRayPath = `${path}.xRay`;
  const gammaPath = `${path}.gamma`;
  const xRay = record(source.xRay, xRayPath, partial);
  const gamma = record(source.gamma, gammaPath, partial);
  return {
    sourceType: enumField(source, 'sourceType', path, FILM_SOURCE_TYPES, partial, ''),
    manufacturer: stringField(source, 'manufacturer', path, partial),
    model: stringField(source, 'model', path, partial),
    serialNumber: stringField(source, 'serialNumber', path, partial),
    calibrationRequirement: stringField(source, 'calibrationRequirement', path, partial),
    xRay: {
      focalSpotSize: numberOrEmptyField(xRay, 'focalSpotSize', xRayPath, partial),
      focalSpotSizeUnit: enumField(xRay, 'focalSpotSizeUnit', xRayPath, LENGTH_UNITS, partial, 'mm'),
    },
    gamma: {
      isotope: stringField(gamma, 'isotope', gammaPath, partial),
      sourceId: stringField(gamma, 'sourceId', gammaPath, partial),
      activity: numberOrEmptyField(gamma, 'activity', gammaPath, partial),
      activityUnit: stringField(gamma, 'activityUnit', gammaPath, partial),
      activityReferenceDate: stringField(gamma, 'activityReferenceDate', gammaPath, partial),
      effectiveSourceSize: numberOrEmptyField(gamma, 'effectiveSourceSize', gammaPath, partial),
      effectiveSourceSizeUnit: enumField(gamma, 'effectiveSourceSizeUnit', gammaPath, LENGTH_UNITS, partial, 'mm'),
    },
  };
}

function parseScreen(value: unknown, path: string, partial = false) {
  const source = record(value, path, partial);
  return {
    material: stringField(source, 'material', path, partial),
    thickness: numberOrEmptyField(source, 'thickness', path, partial),
    thicknessUnit: enumField(source, 'thicknessUnit', path, LENGTH_UNITS, partial, 'mm'),
  };
}

function parseFilmSystem(value: unknown, path: string, partial = false) {
  const source = record(value, path, partial);
  return {
    manufacturer: stringField(source, 'manufacturer', path, partial),
    filmDesignation: stringField(source, 'filmDesignation', path, partial),
    filmClass: stringField(source, 'filmClass', path, partial),
    requiredDensityMin: numberOrEmptyField(source, 'requiredDensityMin', path, partial),
    requiredDensityMax: numberOrEmptyField(source, 'requiredDensityMax', path, partial),
    processingSystem: stringField(source, 'processingSystem', path, partial),
    processingMethod: stringField(source, 'processingMethod', path, partial),
    processingTime: numberOrEmptyField(source, 'processingTime', path, partial),
    processingTimeUnit: enumField(source, 'processingTimeUnit', path, TIME_UNITS, partial, ''),
    processingTemperature: numberOrEmptyField(source, 'processingTemperature', path, partial),
    processingTemperatureTolerance: numberOrEmptyField(source, 'processingTemperatureTolerance', path, partial),
    processingTemperatureUnit: enumField(source, 'processingTemperatureUnit', path, TEMPERATURE_UNITS, partial, ''),
    frontScreen: parseScreen(source.frontScreen, `${path}.frontScreen`, partial),
    backScreen: parseScreen(source.backScreen, `${path}.backScreen`, partial),
    cassetteType: stringField(source, 'cassetteType', path, partial),
    viewingEquipment: stringField(source, 'viewingEquipment', path, partial),
    viewingMode: enumField(source, 'viewingMode', path, PS811000_VIEWING_MODES, true, ''),
    viewerOutputCandelaPerSquareMeter: numberOrEmptyField(source, 'viewerOutputCandelaPerSquareMeter', path, true),
    individualFilmDensityMinimum: numberOrEmptyField(source, 'individualFilmDensityMinimum', path, true),
    specialDensityApprovalReference: stringField(source, 'specialDensityApprovalReference', path, true),
    boeingPart: booleanField(source, 'boeingPart', path, true, false),
    boeingViewerLimitReference: stringField(source, 'boeingViewerLimitReference', path, true),
  };
}

function parseFilmIqi(value: unknown, path: string, partial = false) {
  const source = record(value, path, partial);
  return {
    type: stringField(source, 'type', path, partial),
    standard: stringField(source, 'standard', path, partial),
    designation: stringField(source, 'designation', path, partial),
    shim: stringField(source, 'shim', path, partial),
    block: stringField(source, 'block', path, partial),
    material: stringField(source, 'material', path, partial),
    thickness: numberOrEmptyField(source, 'thickness', path, partial),
    thicknessUnit: enumField(source, 'thicknessUnit', path, LENGTH_UNITS, partial, 'mm'),
    placement: stringField(source, 'placement', path, partial),
    requiredSensitivity: stringField(source, 'requiredSensitivity', path, partial),
    imageQualityLevel: stringField(source, 'imageQualityLevel', path, partial),
    requiredUg: numberOrEmptyField(source, 'requiredUg', path, partial),
    requiredUgUnit: enumField(source, 'requiredUgUnit', path, LENGTH_UNITS, partial, 'mm'),
  };
}

function parseFilmTechnique(value: unknown, path: string, partial = false): RtFilmTechnique {
  const source = record(value, path, partial);
  return {
    ps811000Applicable: booleanField(source, 'ps811000Applicable', path, true, false),
    general: parseGeneral(source.general, `${path}.general`, partial),
    exposureDefaults: parseFilmExposureDefaults(source.exposureDefaults, `${path}.exposureDefaults`, partial),
    source: parseFilmSource(source.source, `${path}.source`, partial),
    filmSystem: parseFilmSystem(source.filmSystem, `${path}.filmSystem`, partial),
    iqi: parseFilmIqi(source.iqi, `${path}.iqi`, partial),
    acceptance: parseAcceptance(source.acceptance, `${path}.acceptance`, partial),
    exposureViews: arrayField(source.exposureViews, `${path}.exposureViews`, parseFilmView, partial),
    techniqueNotes: stringField(source, 'techniqueNotes', path, partial),
  };
}

function parseDigitalAcquisitionDefaults(value: unknown, path: string, partial = false) {
  const source = record(value, path, partial);
  const frameRate = optionalNumberOrEmptyField(source, 'frameRate', path);
  return {
    wallTechnique: enumField(source, 'wallTechnique', path, TECHNIQUE_TYPES, partial, ''),
    sdd: numberOrEmptyField(source, 'sdd', path, partial),
    sddUnit: enumField(source, 'sddUnit', path, LENGTH_UNITS, partial, 'mm'),
    sod: numberOrEmptyField(source, 'sod', path, partial),
    sodUnit: enumField(source, 'sodUnit', path, LENGTH_UNITS, partial, 'mm'),
    odd: numberOrEmptyField(source, 'odd', path, partial),
    oddUnit: enumField(source, 'oddUnit', path, LENGTH_UNITS, partial, 'mm'),
    magnificationAuto: booleanField(source, 'magnificationAuto', path, partial, true),
    magnification: numberOrEmptyField(source, 'magnification', path, partial),
    thicknessDescription: stringField(source, 'thicknessDescription', path, partial),
    thicknessMin: numberOrEmptyField(source, 'thicknessMin', path, partial),
    thicknessMax: numberOrEmptyField(source, 'thicknessMax', path, partial),
    thicknessUnit: enumField(source, 'thicknessUnit', path, LENGTH_UNITS, partial, 'mm'),
    requiredUg: numberOrEmptyField(source, 'requiredUg', path, partial),
    requiredUgUnit: enumField(source, 'requiredUgUnit', path, LENGTH_UNITS, partial, 'mm'),
    tubeVoltage: numberOrEmptyField(source, 'tubeVoltage', path, partial),
    tubeVoltageUnit: enumField(source, 'tubeVoltageUnit', path, ['kV'] as const, partial, 'kV'),
    tubeCurrent: numberOrEmptyField(source, 'tubeCurrent', path, partial),
    tubeCurrentUnit: enumField(source, 'tubeCurrentUnit', path, ['mA'] as const, partial, 'mA'),
    exposureTime: numberOrEmptyField(source, 'exposureTime', path, partial),
    exposureTimeUnit: enumField(source, 'exposureTimeUnit', path, DIGITAL_TIME_UNITS, partial, ''),
    integrationTime: numberOrEmptyField(source, 'integrationTime', path, partial),
    integrationTimeUnit: enumField(source, 'integrationTimeUnit', path, DIGITAL_TIME_UNITS, partial, ''),
    frameCount: numberOrEmptyField(source, 'frameCount', path, partial),
    framesAveraged: numberOrEmptyField(source, 'framesAveraged', path, partial),
    ...(frameRate === undefined ? {} : { frameRate }),
    filter: stringField(source, 'filter', path, partial),
    collimation: stringField(source, 'collimation', path, partial),
    iqiOverride: stringField(source, 'iqiOverride', path, partial),
    coverage: stringField(source, 'coverage', path, partial),
    imageNaming: stringField(source, 'imageNaming', path, partial),
    markingInstructions: stringField(source, 'markingInstructions', path, partial),
    notes: stringField(source, 'notes', path, partial),
  };
}

function parseDigitalAcquisition(value: unknown, path: string): RtDigitalAcquisition {
  const source = record(value, path);
  return {
    id: nonEmptyStringField(source, 'id', path),
    viewId: stringField(source, 'viewId', path),
    description: stringField(source, 'description', path),
    orientation: stringField(source, 'orientation', path),
    inspectionZone: stringField(source, 'inspectionZone', path),
    referenceAttachmentId: stringField(source, 'referenceAttachmentId', path),
    ...parseDigitalAcquisitionDefaults(source, path),
  };
}

function parseDigitalSource(value: unknown, path: string, partial = false) {
  const source = record(value, path, partial);
  return {
    sourceType: enumField(source, 'sourceType', path, DIGITAL_SOURCE_TYPES, partial, ''),
    manufacturer: stringField(source, 'manufacturer', path, partial),
    model: stringField(source, 'model', path, partial),
    serialNumber: stringField(source, 'serialNumber', path, partial),
    calibrationRequirement: stringField(source, 'calibrationRequirement', path, partial),
    focalSpotSize: numberOrEmptyField(source, 'focalSpotSize', path, partial),
    focalSpotSizeUnit: enumField(source, 'focalSpotSizeUnit', path, LENGTH_UNITS, partial, 'mm'),
  };
}

function parseDigitalSystem(value: unknown, path: string, partial = false) {
  const source = record(value, path, partial);
  return {
    ddaType: stringField(source, 'ddaType', path, partial),
    manufacturer: stringField(source, 'manufacturer', path, partial),
    model: stringField(source, 'model', path, partial),
    serialNumber: stringField(source, 'serialNumber', path, partial),
    activeAreaWidth: numberOrEmptyField(source, 'activeAreaWidth', path, partial),
    activeAreaHeight: numberOrEmptyField(source, 'activeAreaHeight', path, partial),
    activeAreaUnit: enumField(source, 'activeAreaUnit', path, LENGTH_UNITS, partial, 'mm'),
    matrixColumns: numberOrEmptyField(source, 'matrixColumns', path, partial),
    matrixRows: numberOrEmptyField(source, 'matrixRows', path, partial),
    pixelSize: numberOrEmptyField(source, 'pixelSize', path, partial),
    pixelSizeUnit: enumField(source, 'pixelSizeUnit', path, DETECTOR_LENGTH_UNITS, partial, 'um'),
    bitDepth: numberOrEmptyField(source, 'bitDepth', path, partial),
    detectorMode: stringField(source, 'detectorMode', path, partial),
    softwareName: stringField(source, 'softwareName', path, partial),
    softwareVersion: stringField(source, 'softwareVersion', path, partial),
    systemQualificationReference: stringField(source, 'systemQualificationReference', path, partial),
    performanceBaselineReference: stringField(source, 'performanceBaselineReference', path, partial),
  };
}

function parseReferenceStatus(value: unknown, path: string, partial = false) {
  const source = record(value, path, partial);
  return {
    reference: stringField(source, 'reference', path, partial),
    date: stringField(source, 'date', path, partial),
    dueDate: stringField(source, 'dueDate', path, partial),
    status: stringField(source, 'status', path, partial),
  };
}

function parseDetectorPerformance(value: unknown, path: string, partial = false) {
  const source = record(value, path, partial);
  return {
    detectorSrb: numberOrEmptyField(source, 'detectorSrb', path, partial),
    detectorSrbUnit: enumField(source, 'detectorSrbUnit', path, DETECTOR_LENGTH_UNITS, partial, 'um'),
    imageSrb: numberOrEmptyField(source, 'imageSrb', path, partial),
    imageSrbUnit: enumField(source, 'imageSrbUnit', path, DETECTOR_LENGTH_UNITS, partial, 'um'),
    badPixelMap: parseReferenceStatus(source.badPixelMap, `${path}.badPixelMap`, partial),
    calibration: parseReferenceStatus(source.calibration, `${path}.calibration`, partial),
    stability: parseReferenceStatus(source.stability, `${path}.stability`, partial),
  };
}

function parseDigitalImageProcessing(value: unknown, path: string, partial = false) {
  const source = record(value, path, partial);
  return {
    windowLevel: numberOrEmptyField(source, 'windowLevel', path, partial),
    windowWidth: numberOrEmptyField(source, 'windowWidth', path, partial),
    zoom: numberOrEmptyField(source, 'zoom', path, partial),
    noiseReduction: stringField(source, 'noiseReduction', path, partial),
    contrastEnhancement: stringField(source, 'contrastEnhancement', path, partial),
    processingProcedure: stringField(source, 'processingProcedure', path, partial),
  };
}

function parseDisplayAndStorage(value: unknown, path: string, partial = false) {
  const source = record(value, path, partial);
  return {
    displayManufacturer: stringField(source, 'displayManufacturer', path, partial),
    displayModel: stringField(source, 'displayModel', path, partial),
    displaySerialNumber: stringField(source, 'displaySerialNumber', path, partial),
    viewerSoftware: stringField(source, 'viewerSoftware', path, partial),
    viewerSoftwareVersion: stringField(source, 'viewerSoftwareVersion', path, partial),
    displayQualificationReference: stringField(source, 'displayQualificationReference', path, partial),
    storageFormat: stringField(source, 'storageFormat', path, partial),
    archiveLocation: stringField(source, 'archiveLocation', path, partial),
    retentionPeriod: stringField(source, 'retentionPeriod', path, partial),
    rawDataPreservation: stringField(source, 'rawDataPreservation', path, partial),
    dicondeProfileReference: stringField(source, 'dicondeProfileReference', path, partial),
  };
}

function parseDigitalIqi(value: unknown, path: string, partial = false) {
  const source = record(value, path, partial);
  return {
    type: stringField(source, 'type', path, partial),
    standard: stringField(source, 'standard', path, partial),
    designation: stringField(source, 'designation', path, partial),
    material: stringField(source, 'material', path, partial),
    thickness: numberOrEmptyField(source, 'thickness', path, partial),
    thicknessUnit: enumField(source, 'thicknessUnit', path, LENGTH_UNITS, partial, 'mm'),
    placement: stringField(source, 'placement', path, partial),
    requiredSensitivity: stringField(source, 'requiredSensitivity', path, partial),
    requiredUg: numberOrEmptyField(source, 'requiredUg', path, partial),
    requiredUgUnit: enumField(source, 'requiredUgUnit', path, LENGTH_UNITS, partial, 'mm'),
    requiredSnrOrNormalizedSnr: stringField(source, 'requiredSnrOrNormalizedSnr', path, partial),
    requiredContrastSensitivityOrCnr: stringField(
      source,
      'requiredContrastSensitivityOrCnr',
      path,
      partial,
    ),
  };
}

function parseDigitalTechnique(value: unknown, path: string, partial = false): RtDigitalTechnique {
  const source = record(value, path, partial);
  return {
    general: parseGeneral(source.general, `${path}.general`, partial),
    workflow: enumField(source, 'workflow', path, DIGITAL_WORKFLOWS, partial, ''),
    source: parseDigitalSource(source.source, `${path}.source`, partial),
    acquisitionDefaults: parseDigitalAcquisitionDefaults(
      source.acquisitionDefaults,
      `${path}.acquisitionDefaults`,
      partial,
    ),
    system: parseDigitalSystem(source.system, `${path}.system`, partial),
    detectorPerformance: parseDetectorPerformance(
      source.detectorPerformance,
      `${path}.detectorPerformance`,
      partial,
    ),
    imageProcessing: parseDigitalImageProcessing(source.imageProcessing, `${path}.imageProcessing`, partial),
    displayAndStorage: parseDisplayAndStorage(source.displayAndStorage, `${path}.displayAndStorage`, partial),
    iqi: parseDigitalIqi(source.iqi, `${path}.iqi`, partial),
    acceptance: parseAcceptance(source.acceptance, `${path}.acceptance`, partial),
    acquisitions: arrayField(source.acquisitions, `${path}.acquisitions`, parseDigitalAcquisition, partial),
    techniqueNotes: stringField(source, 'techniqueNotes', path, partial),
  };
}

function parseProduct(value: unknown, path: string, partial = false) {
  const source = record(value, path, partial);
  return {
    manufacturer: stringField(source, 'manufacturer', path, partial),
    designation: stringField(source, 'designation', path, partial),
  };
}

function parsePtMaterials(value: unknown, path: string, partial = false) {
  const source = record(value, path, partial);
  return {
    penetrantType: enumField(source, 'penetrantType', path, PENETRANT_TYPES, partial, ''),
    method: enumField(source, 'method', path, PENETRANT_METHODS, partial, ''),
    sensitivityLevel: enumField(source, 'sensitivityLevel', path, SENSITIVITY_LEVELS, partial, ''),
    systemFamily: stringField(source, 'systemFamily', path, partial),
    qualificationReference: stringField(source, 'qualificationReference', path, partial),
    developerForm: stringField(source, 'developerForm', path, partial),
    penetrant: parseProduct(source.penetrant, `${path}.penetrant`, partial),
    cleaner: parseProduct(source.cleaner, `${path}.cleaner`, partial),
    remover: parseProduct(source.remover, `${path}.remover`, partial),
    emulsifier: parseProduct(source.emulsifier, `${path}.emulsifier`, partial),
    developer: parseProduct(source.developer, `${path}.developer`, partial),
  };
}

function parsePtSurfacePrep(value: unknown, path: string, partial = false) {
  const source = record(value, path, partial);
  return {
    cleaningMethod: stringField(source, 'cleaningMethod', path, partial),
    cleaningDetails: stringField(source, 'cleaningDetails', path, partial),
    cleaningRestrictions: stringField(source, 'cleaningRestrictions', path, partial),
    surfaceCondition: stringField(source, 'surfaceCondition', path, partial),
    dryingMethod: stringField(source, 'dryingMethod', path, partial),
    dryingTime: numberOrEmptyField(source, 'dryingTime', path, partial),
    dryingTimeUnit: enumField(source, 'dryingTimeUnit', path, TIME_UNITS, partial, ''),
    dryingTemperature: numberOrEmptyField(source, 'dryingTemperature', path, partial),
    dryingTemperatureUnit: enumField(source, 'dryingTemperatureUnit', path, TEMPERATURE_UNITS, partial, ''),
  };
}

function parsePtApplication(value: unknown, path: string, partial = false) {
  const source = record(value, path, partial);
  return {
    applicationMethod: stringField(source, 'applicationMethod', path, partial),
    dwellTime: numberOrEmptyField(source, 'dwellTime', path, partial),
    dwellTimeUnit: enumField(source, 'dwellTimeUnit', path, TIME_UNITS, partial, ''),
    partTemperatureMin: numberOrEmptyField(source, 'partTemperatureMin', path, partial),
    partTemperatureMax: numberOrEmptyField(source, 'partTemperatureMax', path, partial),
    partTemperatureUnit: enumField(source, 'partTemperatureUnit', path, TEMPERATURE_UNITS, partial, ''),
    penetrantTemperatureMin: numberOrEmptyField(source, 'penetrantTemperatureMin', path, partial),
    penetrantTemperatureMax: numberOrEmptyField(source, 'penetrantTemperatureMax', path, partial),
    penetrantTemperatureUnit: enumField(
      source,
      'penetrantTemperatureUnit',
      path,
      TEMPERATURE_UNITS,
      partial,
      '',
    ),
  };
}

function parsePtRemoval(value: unknown, path: string, partial = false) {
  const source = record(value, path, partial);
  const methodAPath = `${path}.methodA`;
  const methodBdPath = `${path}.methodBD`;
  const methodCPath = `${path}.methodC`;
  const methodDPath = `${path}.methodD`;
  const methodA = record(source.methodA, methodAPath, partial);
  const methodBD = record(source.methodBD, methodBdPath, partial);
  const methodC = record(source.methodC, methodCPath, partial);
  const methodD = record(source.methodD, methodDPath, partial);
  return {
    methodA: {
      instructions: stringField(methodA, 'instructions', methodAPath, partial),
      pressureMin: numberOrEmptyField(methodA, 'pressureMin', methodAPath, partial),
      pressureMax: numberOrEmptyField(methodA, 'pressureMax', methodAPath, partial),
      pressureUnit: stringField(methodA, 'pressureUnit', methodAPath, partial),
      temperatureMin: numberOrEmptyField(methodA, 'temperatureMin', methodAPath, partial),
      temperatureMax: numberOrEmptyField(methodA, 'temperatureMax', methodAPath, partial),
      temperatureUnit: enumField(methodA, 'temperatureUnit', methodAPath, TEMPERATURE_UNITS, partial, ''),
    },
    methodBD: {
      type: stringField(methodBD, 'type', methodBdPath, partial),
      concentration: numberOrEmptyField(methodBD, 'concentration', methodBdPath, partial),
      concentrationUnit: stringField(methodBD, 'concentrationUnit', methodBdPath, partial),
      contactTime: numberOrEmptyField(methodBD, 'contactTime', methodBdPath, partial),
      contactTimeUnit: enumField(methodBD, 'contactTimeUnit', methodBdPath, TIME_UNITS, partial, ''),
      applicationMethod: stringField(methodBD, 'applicationMethod', methodBdPath, partial),
      postEmulsifierRinseInstructions: stringField(
        methodBD,
        'postEmulsifierRinseInstructions',
        methodBdPath,
        partial,
      ),
    },
    methodC: {
      removerInstructions: stringField(methodC, 'removerInstructions', methodCPath, partial),
    },
    methodD: {
      preRinseInstructions: stringField(methodD, 'preRinseInstructions', methodDPath, partial),
      finalRinseInstructions: stringField(methodD, 'finalRinseInstructions', methodDPath, partial),
    },
  };
}

function parsePtDevelopment(value: unknown, path: string, partial = false) {
  const source = record(value, path, partial);
  return {
    developerApplication: stringField(source, 'developerApplication', path, partial),
    developmentTime: numberOrEmptyField(source, 'developmentTime', path, partial),
    developmentTimeUnit: enumField(source, 'developmentTimeUnit', path, TIME_UNITS, partial, ''),
    instructions: stringField(source, 'instructions', path, partial),
  };
}

function parsePtConditions(value: unknown, path: string, partial = false) {
  const source = record(value, path, partial);
  return {
    requiredUvAMin: numberOrEmptyField(source, 'requiredUvAMin', path, partial),
    uvAUnit: stringField(source, 'uvAUnit', path, partial),
    ambientVisibleLightMax: numberOrEmptyField(source, 'ambientVisibleLightMax', path, partial),
    whiteLightMin: numberOrEmptyField(source, 'whiteLightMin', path, partial),
    visibleLightUnit: stringField(source, 'visibleLightUnit', path, partial),
    darkAdaptationTime: numberOrEmptyField(source, 'darkAdaptationTime', path, partial),
    darkAdaptationTimeUnit: enumField(source, 'darkAdaptationTimeUnit', path, TIME_UNITS, partial, ''),
    equipmentRequirements: stringField(source, 'equipmentRequirements', path, partial),
  };
}

function parsePtPostCleaning(value: unknown, path: string, partial = false) {
  const source = record(value, path, partial);
  return {
    instructions: stringField(source, 'instructions', path, partial),
    corrosionProtection: stringField(source, 'corrosionProtection', path, partial),
  };
}

function parsePtTechnique(value: unknown, path: string, partial = false): PtTechnique {
  const source = record(value, path, partial);
  return {
    general: parseGeneral(source.general, `${path}.general`, partial),
    materials: parsePtMaterials(source.materials, `${path}.materials`, partial),
    surfacePrep: parsePtSurfacePrep(source.surfacePrep, `${path}.surfacePrep`, partial),
    application: parsePtApplication(source.application, `${path}.application`, partial),
    removal: parsePtRemoval(source.removal, `${path}.removal`, partial),
    development: parsePtDevelopment(source.development, `${path}.development`, partial),
    conditions: parsePtConditions(source.conditions, `${path}.conditions`, partial),
    acceptance: parseAcceptance(source.acceptance, `${path}.acceptance`, partial),
    postCleaning: parsePtPostCleaning(source.postCleaning, `${path}.postCleaning`, partial),
    techniqueNotes: stringField(source, 'techniqueNotes', path, partial),
  };
}

function parseDocumentControl(value: unknown, path: string, partial = false): RtPtDocumentControl {
  const source = record(value, path, partial);
  return {
    number: stringField(source, 'number', path, partial),
    title: stringField(source, 'title', path, partial),
    revision: stringField(source, 'revision', path, partial),
    revisionDate: stringField(source, 'revisionDate', path, partial),
    effectiveDate: stringField(source, 'effectiveDate', path, partial),
    changeSummary: stringField(source, 'changeSummary', path, partial),
  };
}

function parseRevisionHistory(value: unknown, path: string, partial = false): RtPtRevisionHistoryEntry[] {
  return arrayField(value, path, (item, itemPath) => {
    const source = record(item, itemPath);
    return {
      id: nonEmptyStringField(source, 'id', itemPath),
      revision: stringField(source, 'revision', itemPath),
      date: stringField(source, 'date', itemPath),
      description: stringField(source, 'description', itemPath),
      author: stringField(source, 'author', itemPath),
    };
  }, partial);
}

function parseOrganization(value: unknown, path: string, partial = false): RtPtOrganization {
  const source = record(value, path, partial);
  return {
    name: stringField(source, 'name', path, partial),
    site: stringField(source, 'site', path, partial),
  };
}

function parseJob(value: unknown, path: string, partial = false): RtPtJob {
  const source = record(value, path, partial);
  return {
    customer: stringField(source, 'customer', path, partial),
    contract: stringField(source, 'contract', path, partial),
    purchaseOrder: stringField(source, 'purchaseOrder', path, partial),
    workOrder: stringField(source, 'workOrder', path, partial),
  };
}

function parseControlledReferences(value: unknown, path: string, partial = false): RtPtControlledReference[] {
  return arrayField(value, path, (item, itemPath) => {
    const source = record(item, itemPath);
    return {
      type: stringField(source, 'type', itemPath),
      title: stringField(source, 'title', itemPath),
      number: stringField(source, 'number', itemPath),
      revision: stringField(source, 'revision', itemPath),
      clauseOrNote: stringField(source, 'clauseOrNote', itemPath),
    };
  }, partial);
}

function parseApprovals(value: unknown, path: string, partial = false): RtPtApproval[] {
  return arrayField(value, path, (item, itemPath) => {
    const source = record(item, itemPath);
    return {
      role: enumField(source, 'role', itemPath, APPROVAL_ROLES),
      name: stringField(source, 'name', itemPath),
      personnelId: stringField(source, 'personnelId', itemPath),
      certificationBasis: stringField(source, 'certificationBasis', itemPath),
      certificationRevision: stringField(source, 'certificationRevision', itemPath),
      date: stringField(source, 'date', itemPath),
    };
  }, partial);
}

function parseQuarantine(value: unknown, path: string): RtPtQuarantineEntry[] {
  return arrayField(value, path, (item, itemPath) => {
    const source = record(item, itemPath);
    const rawValue = valueAt(source, 'value', itemPath, false);
    if (
      rawValue !== null
      && typeof rawValue !== 'string'
      && typeof rawValue !== 'number'
      && typeof rawValue !== 'boolean'
    ) {
      throw new CodecError(`${itemPath}.value must be a scalar.`);
    }
    if (typeof rawValue === 'number' && !Number.isFinite(rawValue)) {
      throw new CodecError(`${itemPath}.value must be finite.`);
    }
    return {
      sourcePath: stringField(source, 'sourcePath', itemPath),
      reason: enumField(source, 'reason', itemPath, QUARANTINE_REASONS),
      value: rawValue,
    };
  });
}

function parseMigration(value: unknown, path: string): RtPtMigrationMetadata {
  const source = record(value, path);
  if (source.sourceSchemaVersion !== 1 && source.sourceSchemaVersion !== 2) {
    throw new CodecError(`${path}.sourceSchemaVersion must be 1 or 2.`);
  }
  if (!Array.isArray(source.warnings) || source.warnings.some((warning) => typeof warning !== 'string')) {
    throw new CodecError(`${path}.warnings must be an array of strings.`);
  }
  return {
    sourceSchemaVersion: source.sourceSchemaVersion,
    warnings: [...source.warnings] as string[],
    quarantine: parseQuarantine(source.quarantine, `${path}.quarantine`),
  };
}

function parseMethod(value: unknown, path: string): RtPtMethod {
  if (typeof value !== 'string' || !METHODS.includes(value as RtPtMethod)) {
    throw new CodecError(`${path} must be RT-Film, RT-Digital, or PT.`);
  }
  return value as RtPtMethod;
}

function parseTechnique(value: unknown, method: RtPtMethod, path: string, partial = false) {
  if (method === 'RT-Film') return parseFilmTechnique(value, path, partial);
  if (method === 'RT-Digital') return parseDigitalTechnique(value, path, partial);
  return parsePtTechnique(value, path, partial);
}

function createStableId(prefix: string): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') return `${prefix}-${globalThis.crypto.randomUUID()}`;
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

export function createRtPtDocumentId(): string {
  return createStableId('rtpt');
}

export function createRtFilmExposureView(
  overrides: Partial<RtFilmExposureView> = {},
): RtFilmExposureView {
  return parseFilmView({
    ...emptyRtFilmExposureDefaults,
    id: createStableId('film-view'),
    viewId: '',
    description: '',
    orientation: '',
    inspectionZone: '',
    referenceAttachmentId: '',
    ...overrides,
  }, 'filmView');
}

export function duplicateRtFilmExposureView(view: RtFilmExposureView): RtFilmExposureView {
  return createRtFilmExposureView({ ...view, id: createStableId('film-view'), viewId: '' });
}

export function createRtDigitalAcquisition(
  overrides: Partial<RtDigitalAcquisition> = {},
): RtDigitalAcquisition {
  return parseDigitalAcquisition({
    ...emptyRtDigitalAcquisitionDefaults,
    id: createStableId('dda-acquisition'),
    viewId: '',
    description: '',
    orientation: '',
    inspectionZone: '',
    referenceAttachmentId: '',
    ...overrides,
  }, 'digitalAcquisition');
}

export function duplicateRtDigitalAcquisition(
  acquisition: RtDigitalAcquisition,
): RtDigitalAcquisition {
  return createRtDigitalAcquisition({
    ...acquisition,
    id: createStableId('dda-acquisition'),
    viewId: '',
  });
}

export interface CreateRtPtDocumentInput {
  method: RtPtMethod;
  documentId?: string;
  status?: RtPtDocumentStatus;
  approvalFingerprint?: string;
  documentControl?: Partial<RtPtDocumentControl>;
  revisionHistory?: RtPtRevisionHistoryEntry[];
  organization?: Partial<RtPtOrganization>;
  job?: Partial<RtPtJob>;
  unitSystem?: RtPtUnitSystem;
  controlledReferences?: RtPtControlledReference[];
  approvals?: RtPtApproval[];
  technique?: unknown;
  /** Compatibility input only; V3 persists only the sheet matching `method`. */
  sheets?: {
    rtFilm?: unknown;
    rtDigital?: unknown;
    penetrant?: unknown;
  };
  migration?: RtPtMigrationMetadata;
  /** Accepted and discarded so navigation remains workspace-only state. */
  activeTabs?: unknown;
}

export function createRtPtDocument(input: CreateRtPtDocumentInput): RtPtDocumentV3 {
  const method = parseMethod(input.method, 'method');
  const documentId = input.documentId ?? createRtPtDocumentId();
  if (typeof documentId !== 'string' || !documentId.trim()) {
    throw new CodecError('documentId must be a non-empty string.');
  }
  const status = input.status ?? 'draft';
  if (!DOCUMENT_STATUSES.includes(status)) throw new CodecError('status is invalid.');
  if (input.approvalFingerprint !== undefined && typeof input.approvalFingerprint !== 'string') {
    throw new CodecError('approvalFingerprint must be a string.');
  }
  const unitSystem = input.unitSystem ?? 'SI';
  if (!UNIT_SYSTEMS.includes(unitSystem)) throw new CodecError('unitSystem is invalid.');

  const techniqueCandidate = input.technique ?? (
    method === 'RT-Film'
      ? input.sheets?.rtFilm
      : method === 'RT-Digital'
        ? input.sheets?.rtDigital
        : input.sheets?.penetrant
  );
  const technique = parseTechnique(techniqueCandidate ?? {}, method, 'technique', true);
  const base = {
    documentKind: RT_PT_DOCUMENT_KIND,
    schemaVersion: RT_PT_DOCUMENT_VERSION,
    documentType: RT_PT_DOCUMENT_TYPE,
    documentId,
    status,
    ...(input.approvalFingerprint === undefined
      ? {}
      : { approvalFingerprint: input.approvalFingerprint }),
    documentControl: parseDocumentControl(
      input.documentControl ?? EMPTY_RT_PT_DOCUMENT_CONTROL,
      'documentControl',
      true,
    ),
    revisionHistory: parseRevisionHistory(input.revisionHistory, 'revisionHistory', true),
    organization: parseOrganization(input.organization ?? EMPTY_RT_PT_ORGANIZATION, 'organization', true),
    job: parseJob(input.job ?? EMPTY_RT_PT_JOB, 'job', true),
    unitSystem,
    controlledReferences: parseControlledReferences(input.controlledReferences, 'controlledReferences', true),
    approvals: parseApprovals(input.approvals, 'approvals', true),
    ...(input.migration ? { migration: parseMigration(input.migration, 'migration') } : {}),
  };

  if (method === 'RT-Film') return { ...base, method, technique: technique as RtFilmTechnique };
  if (method === 'RT-Digital') return { ...base, method, technique: technique as RtDigitalTechnique };
  return { ...base, method, technique: technique as PtTechnique };
}

function decodeV3(source: UnknownRecord): RtPtDocumentV3 {
  if (source.documentType !== RT_PT_DOCUMENT_TYPE) throw new CodecError('documentType must be technique.');
  const method = parseMethod(source.method, 'method');
  const documentId = nonEmptyStringField(source, 'documentId', 'document');
  const status = enumField(source, 'status', 'document', DOCUMENT_STATUSES) as RtPtDocumentStatus;
  const approvalFingerprint = optionalStringField(source, 'approvalFingerprint', 'document');
  const unitSystem = enumField(source, 'unitSystem', 'document', UNIT_SYSTEMS) as RtPtUnitSystem;
  const technique = parseTechnique(source.technique, method, 'technique');
  const base = {
    documentKind: RT_PT_DOCUMENT_KIND,
    schemaVersion: RT_PT_DOCUMENT_VERSION,
    documentType: RT_PT_DOCUMENT_TYPE,
    documentId,
    status,
    ...(approvalFingerprint === undefined ? {} : { approvalFingerprint }),
    documentControl: parseDocumentControl(source.documentControl, 'documentControl'),
    revisionHistory: parseRevisionHistory(source.revisionHistory, 'revisionHistory'),
    organization: parseOrganization(source.organization, 'organization'),
    job: parseJob(source.job, 'job'),
    unitSystem,
    controlledReferences: parseControlledReferences(source.controlledReferences, 'controlledReferences'),
    approvals: parseApprovals(source.approvals, 'approvals'),
    ...(source.migration === undefined ? {} : { migration: parseMigration(source.migration, 'migration') }),
  };

  const document: RtPtDocumentV3 = method === 'RT-Film'
    ? { ...base, method, technique: technique as RtFilmTechnique }
    : method === 'RT-Digital'
      ? { ...base, method, technique: technique as RtDigitalTechnique }
      : { ...base, method, technique: technique as PtTechnique };
  return reconcileDecodedRtPtApproval(document);
}

const legacyRecord = (value: unknown): UnknownRecord => (isRecord(value) ? value : {});
const legacyString = (source: UnknownRecord, key: string): string => (
  typeof source[key] === 'string' ? source[key] as string : ''
);
const legacyNumber = (source: UnknownRecord, key: string): NumberOrEmpty => (
  typeof source[key] === 'number' && Number.isFinite(source[key]) ? source[key] as number : ''
);
const legacyBoolean = (source: UnknownRecord, key: string, fallback: boolean): boolean => (
  typeof source[key] === 'boolean' ? source[key] as boolean : fallback
);

const hasLegacyValue = (value: unknown): boolean => (
  typeof value === 'number'
    ? Number.isFinite(value)
    : typeof value === 'string'
      ? value.trim().length > 0
      : typeof value === 'boolean'
        ? true
        : value !== null && value !== undefined
);

function quarantineScalar(
  quarantine: RtPtQuarantineEntry[],
  sourcePath: string,
  value: unknown,
  reason: RtPtQuarantineReason,
): void {
  if (!hasLegacyValue(value)) return;
  if (
    value === null
    || typeof value === 'string'
    || typeof value === 'boolean'
    || (typeof value === 'number' && Number.isFinite(value))
  ) {
    quarantine.push({ sourcePath, reason, value });
  }
}

function flattenQuarantine(
  quarantine: RtPtQuarantineEntry[],
  value: unknown,
  sourcePath: string,
  reason: RtPtQuarantineReason,
): void {
  if (Array.isArray(value)) {
    value.forEach((item, index) => flattenQuarantine(quarantine, item, `${sourcePath}[${index}]`, reason));
    return;
  }
  if (isRecord(value)) {
    Object.entries(value).forEach(([key, item]) => {
      flattenQuarantine(quarantine, item, sourcePath ? `${sourcePath}.${key}` : key, reason);
    });
    return;
  }
  quarantineScalar(quarantine, sourcePath, value, reason);
}

function legacyGeneral(value: unknown) {
  const source = legacyRecord(value);
  const stage = legacyString(source, 'inspectionStage');
  return {
    ...emptyRtFilmSheet.general,
    partName: legacyString(source, 'partName'),
    partNumber: legacyString(source, 'partNumber'),
    material: legacyString(source, 'material'),
    thickness: legacyNumber(source, 'thickness'),
    thicknessUnit: source.thicknessUnit === 'inch' ? 'inch' as const : 'mm' as const,
    drawingReference: legacyString(source, 'drawingReference'),
    procedureNumber: legacyString(source, 'procedureNumber'),
    inspectionStage: INSPECTION_STAGES.includes(stage as never) ? stage as typeof INSPECTION_STAGES[number] : '',
    inspectorLevel: INSPECTOR_LEVELS.includes(legacyString(source, 'inspectorLevel') as never)
      ? legacyString(source, 'inspectorLevel') as typeof INSPECTOR_LEVELS[number]
      : '',
    date: legacyString(source, 'date'),
  };
}

function migrateLegacyAcceptance(
  value: unknown,
  path: string,
  quarantine: RtPtQuarantineEntry[],
) {
  const source = legacyRecord(value);
  quarantineScalar(quarantine, `${path}.qualityLevel`, source.qualityLevel, 'ambiguous-legacy-field');
  quarantineScalar(quarantine, `${path}.singleDiscontinuity`, source.singleDiscontinuity, 'ambiguous-legacy-field');
  quarantineScalar(quarantine, `${path}.multipleDiscontinuities`, source.multipleDiscontinuities, 'ambiguous-legacy-field');
  quarantineScalar(quarantine, `${path}.linearIndications`, source.linearIndications, 'ambiguous-legacy-field');
  quarantineScalar(quarantine, `${path}.roundedIndications`, source.roundedIndications, 'ambiguous-legacy-field');
  return {
    ...emptyRtFilmSheet.acceptance,
    acceptanceStandard: legacyString(source, 'acceptanceStandard'),
    specialRequirements: legacyString(source, 'specialRequirements'),
  };
}

function migrateLegacyFilm(
  value: unknown,
  sourceVersion: 1 | 2,
  quarantine: RtPtQuarantineEntry[],
  warnings: string[],
): RtFilmTechnique {
  const source = legacyRecord(value);
  const exposure = legacyRecord(source.exposure);
  const equipment = legacyRecord(source.equipment);
  const filmSystem = legacyRecord(source.filmSystem);
  const iqc = legacyRecord(source.iqc);
  const identification = legacyRecord(source.identification);
  const radiationType = legacyString(exposure, 'radiationType');
  const equipmentType = legacyString(equipment, 'radiationSourceType');
  const mappedEquipmentType = equipmentType === 'Isotope' ? 'Gamma' : equipmentType;
  const sourceType = (
    (radiationType === 'X-ray' || radiationType === 'Gamma')
    && (!mappedEquipmentType || mappedEquipmentType === radiationType)
  ) ? radiationType : '';

  if (radiationType && mappedEquipmentType && radiationType !== mappedEquipmentType) {
    warnings.push('Legacy film radiation-type fields contradicted each other and require manual source selection.');
    quarantineScalar(quarantine, 'technique.exposure.radiationType', radiationType, 'ambiguous-legacy-field');
    quarantineScalar(quarantine, 'technique.equipment.radiationSourceType', equipmentType, 'ambiguous-legacy-field');
  }

  quarantineScalar(quarantine, 'technique.exposure.focalSpotSize', exposure.focalSpotSize, 'ambiguous-legacy-field');
  quarantineScalar(
    quarantine,
    'technique.equipment.calibrationStatus',
    equipment.calibrationStatus,
    'ambiguous-legacy-field',
  );
  quarantineScalar(quarantine, 'technique.exposure.numberOfExposures', exposure.numberOfExposures, 'manual-mapping-required');
  quarantineScalar(quarantine, 'technique.exposure.exposurePattern', exposure.exposurePattern, 'manual-mapping-required');
  quarantineScalar(quarantine, 'technique.exposure.coverage', exposure.coverage, 'manual-mapping-required');
  quarantineScalar(quarantine, 'technique.filmSystem.screenType', filmSystem.screenType, 'manual-mapping-required');
  quarantineScalar(quarantine, 'technique.filmSystem.screenThickness', filmSystem.screenThickness, 'manual-mapping-required');
  quarantineScalar(quarantine, 'technique.iqc.iqiSize', iqc.iqiSize, 'ambiguous-legacy-field');
  ['filmNumber', 'exposureNumber', 'partIdentification'].forEach((key) => {
    quarantineScalar(quarantine, `technique.identification.${key}`, identification[key], 'manual-mapping-required');
  });
  ['achievedSensitivity', 'opticalDensityMin', 'opticalDensityMax'].forEach((key) => {
    quarantineScalar(quarantine, `technique.iqc.${key}`, iqc[key], 'performed-result');
  });
  ['inspectionDate', 'inspector', 'result', 'remarks'].forEach((key) => {
    quarantineScalar(quarantine, `technique.identification.${key}`, identification[key], 'performed-result');
  });

  warnings.push(
    `Schema V${sourceVersion} stored a global film exposure and singular identification; no exposure views were generated. Add and verify every required view manually.`,
  );
  warnings.push('Legacy combined screen data was quarantined; front and back screen materials and thicknesses must be entered separately.');

  return normalizeRtFilmSheet({
    general: legacyGeneral(source.general),
    exposureDefaults: {
      ...emptyRtFilmExposureDefaults,
      wallTechnique: TECHNIQUE_TYPES.includes(legacyString(exposure, 'techniqueType') as never)
        ? legacyString(exposure, 'techniqueType')
        : '',
      sfd: legacyNumber(exposure, 'sfd'),
      sfdUnit: exposure.sfdUnit === 'inch' ? 'inch' : 'mm',
      sod: legacyNumber(exposure, 'sod'),
      sodUnit: exposure.sodUnit === 'inch' ? 'inch' : 'mm',
      ofd: legacyNumber(exposure, 'ofd'),
      ofdUnit: exposure.ofdUnit === 'inch' ? 'inch' : 'mm',
      geometricMagnificationAuto: legacyBoolean(exposure, 'geometricMagnificationAuto', true),
      geometricMagnification: legacyNumber(exposure, 'geometricMagnification'),
      beamAngle: legacyNumber(exposure, 'beamAngle'),
    },
    source: {
      ...emptyRtFilmSheet.source,
      sourceType,
      manufacturer: legacyString(equipment, 'manufacturer'),
      model: legacyString(equipment, 'model'),
      serialNumber: legacyString(equipment, 'serialNumber'),
      calibrationRequirement: '',
    },
    filmSystem: {
      ...emptyRtFilmSheet.filmSystem,
      filmDesignation: legacyString(filmSystem, 'filmType'),
      filmClass: legacyString(filmSystem, 'filmClass'),
      processingMethod: legacyString(filmSystem, 'processingMethod'),
      cassetteType: legacyString(filmSystem, 'cassetteType'),
      viewingEquipment: legacyString(equipment, 'viewingEquipment'),
    },
    iqi: {
      ...emptyRtFilmSheet.iqi,
      type: legacyString(iqc, 'iqiType'),
      standard: legacyString(iqc, 'iqiStandard'),
      material: legacyString(iqc, 'iqiMaterial'),
      placement: legacyString(iqc, 'iqiPlacement'),
      requiredSensitivity: legacyString(iqc, 'requiredSensitivity'),
      imageQualityLevel: legacyString(iqc, 'imageQualityLevel'),
    },
    acceptance: migrateLegacyAcceptance(source.acceptance, 'technique.acceptance', quarantine),
    exposureViews: [],
    techniqueNotes: '',
  });
}

function migrateLegacyDigital(
  value: unknown,
  sourceVersion: 1 | 2,
  unitSystem: RtPtUnitSystem,
  quarantine: RtPtQuarantineEntry[],
  warnings: string[],
): RtDigitalTechnique {
  const source = legacyRecord(value);
  const exposure = legacyRecord(source.exposure);
  const system = legacyRecord(source.system);
  const detector = legacyRecord(source.detector);
  const imageProcessing = legacyRecord(source.imageProcessing);
  const iqc = legacyRecord(source.iqc);
  const identification = legacyRecord(source.identification);
  const inferredUnit = unitSystem === 'US-customary' ? 'inch' as const : 'mm' as const;

  if (legacyString(exposure, 'radiationType') === 'Gamma') {
    quarantineScalar(quarantine, 'technique.exposure.radiationType', exposure.radiationType, 'ambiguous-legacy-field');
    warnings.push('The legacy Digital RT record selected Gamma; V3 E2698 workflow is X-ray-only and requires manual source review.');
  }
  ['spatialResolutionSRb', 'pixelDensity', 'imageUnsharpness', 'badPixelCorrection', 'detectorCorrections'].forEach((key) => {
    quarantineScalar(quarantine, `technique.detector.${key}`, detector[key], 'ambiguous-legacy-field');
  });
  quarantineScalar(quarantine, 'technique.iqc.cnr', iqc.cnr, 'performed-result');
  quarantineScalar(quarantine, 'technique.exposure.coverage', exposure.coverage, 'manual-mapping-required');
  quarantineScalar(quarantine, 'technique.system.calibrationStatus', system.calibrationStatus, 'ambiguous-legacy-field');
  ['filmNumber', 'exposureNumber', 'partIdentification'].forEach((key) => {
    quarantineScalar(quarantine, `technique.identification.${key}`, identification[key], 'manual-mapping-required');
  });
  ['inspectionDate', 'inspector', 'result', 'remarks'].forEach((key) => {
    quarantineScalar(quarantine, `technique.identification.${key}`, identification[key], 'performed-result');
  });
  warnings.push(
    `Schema V${sourceVersion} stored global DDA acquisition values and singular identification; no acquisitions were generated. Add and verify every view manually.`,
  );
  warnings.push('Legacy SRb and detector status fields were quarantined because V3 separates detector SRb, image SRb, qualification, calibration, and stability evidence.');

  return normalizeRtDigitalSheet({
    general: legacyGeneral(source.general),
    workflow: 'Static',
    source: {
      ...emptyRtDigitalSheet.source,
      sourceType: legacyString(exposure, 'radiationType') === 'X-ray' ? 'X-ray' : '',
      focalSpotSize: legacyNumber(exposure, 'focalSpotSize'),
      focalSpotSizeUnit: inferredUnit,
    },
    acquisitionDefaults: {
      ...emptyRtDigitalAcquisitionDefaults,
      sdd: legacyNumber(exposure, 'sdd'),
      sddUnit: inferredUnit,
      sod: legacyNumber(exposure, 'sod'),
      sodUnit: inferredUnit,
      odd: legacyNumber(exposure, 'odd'),
      oddUnit: inferredUnit,
      magnificationAuto: legacyBoolean(exposure, 'magnificationAuto', true),
      magnification: legacyNumber(exposure, 'magnification'),
      tubeVoltage: legacyNumber(exposure, 'tubeVoltage'),
      tubeCurrent: legacyNumber(exposure, 'tubeCurrent'),
      exposureTime: legacyNumber(exposure, 'exposureTime'),
      exposureTimeUnit: 's',
      frameCount: legacyNumber(exposure, 'framesAveraged'),
      framesAveraged: legacyNumber(exposure, 'framesAveraged'),
      ...(hasLegacyValue(exposure.frameRate) ? { frameRate: legacyNumber(exposure, 'frameRate') } : {}),
      filter: legacyString(exposure, 'filters'),
    },
    system: {
      ...emptyRtDigitalSheet.system,
      ddaType: legacyString(system, 'ddaType'),
      manufacturer: legacyString(system, 'manufacturer'),
      model: legacyString(system, 'model'),
      pixelSize: legacyNumber(system, 'pixelSize'),
      pixelSizeUnit: 'um',
      detectorMode: legacyString(system, 'detectorMode'),
    },
    detectorPerformance: emptyRtDigitalSheet.detectorPerformance,
    imageProcessing: {
      ...emptyRtDigitalSheet.imageProcessing,
      windowLevel: legacyNumber(imageProcessing, 'windowLevel'),
      windowWidth: legacyNumber(imageProcessing, 'windowWidth'),
      zoom: legacyNumber(imageProcessing, 'zoom'),
      noiseReduction: legacyString(imageProcessing, 'noiseReduction'),
      contrastEnhancement: legacyString(imageProcessing, 'contrastEnhancement'),
    },
    displayAndStorage: {
      ...emptyRtDigitalSheet.displayAndStorage,
      storageFormat: legacyString(imageProcessing, 'imageFormat'),
    },
    iqi: {
      ...emptyRtDigitalSheet.iqi,
      type: legacyString(iqc, 'iqiType'),
      standard: legacyString(iqc, 'iqiStandard'),
      requiredSensitivity: legacyString(iqc, 'requiredSensitivity'),
    },
    acceptance: migrateLegacyAcceptance(source.acceptance, 'technique.acceptance', quarantine),
    acquisitions: [],
    techniqueNotes: '',
  });
}

function migrateLegacyPt(
  value: unknown,
  sourceVersion: 1 | 2,
  quarantine: RtPtQuarantineEntry[],
  warnings: string[],
): PtTechnique {
  const source = legacyRecord(value);
  const materials = legacyRecord(source.materials);
  const surfacePrep = legacyRecord(source.surfacePrep);
  const application = legacyRecord(source.application);
  const development = legacyRecord(source.development);
  const conditions = legacyRecord(source.conditions);
  const postCleaning = legacyRecord(source.postCleaning);
  const method = legacyString(materials, 'method');

  quarantineScalar(quarantine, 'technique.materials.cleanerType', materials.cleanerType, 'ambiguous-legacy-field');
  quarantineScalar(quarantine, 'technique.application.removalMethod', application.removalMethod, 'ambiguous-legacy-field');
  ['lightType', 'uvIntensity', 'whiteLight'].forEach((key) => {
    quarantineScalar(quarantine, `technique.conditions.${key}`, conditions[key], 'ambiguous-legacy-field');
  });
  ['indicationType', 'indicationSize'].forEach((key) => {
    quarantineScalar(quarantine, `technique.development.${key}`, development[key], 'performed-result');
  });
  ['result', 'inspector', 'date'].forEach((key) => {
    quarantineScalar(quarantine, `technique.postCleaning.${key}`, postCleaning[key], 'performed-result');
  });
  warnings.push(
    `Schema V${sourceVersion} lighting values were quarantined because their required-versus-performed meaning was ambiguous. Enter V3 required lighting setpoints explicitly.`,
  );
  warnings.push('Legacy PT product categories did not identify approved product manufacturer/designation pairs; complete the qualified material system manually.');

  const penetrantType = legacyString(materials, 'penetrantType');
  const sensitivity = legacyString(materials, 'sensitivityLevel');
  const normalizedSensitivity = sensitivity === '1/2' || SENSITIVITY_LEVELS.includes(sensitivity as never)
    ? sensitivity
    : '';
  const migrated = {
    ...emptyPtSheet,
    general: legacyGeneral(source.general),
    materials: {
      ...emptyPtSheet.materials,
      penetrantType: PENETRANT_TYPES.includes(penetrantType as never) ? penetrantType : '',
      method: PENETRANT_METHODS.includes(method as never) ? method : '',
      sensitivityLevel: penetrantType === 'Type I' ? normalizedSensitivity : '',
      developerForm: legacyString(materials, 'developerType'),
    },
    surfacePrep: {
      ...emptyPtSheet.surfacePrep,
      cleaningMethod: legacyString(surfacePrep, 'cleaningMethod'),
      surfaceCondition: legacyString(surfacePrep, 'surfaceCondition'),
      dryingMethod: legacyString(surfacePrep, 'dryingMethod'),
    },
    application: {
      ...emptyPtSheet.application,
      applicationMethod: legacyString(application, 'applicationMethod'),
      dwellTime: legacyNumber(application, 'dwellTime'),
      dwellTimeUnit: 'min' as const,
    },
    removal: {
      ...emptyPtSheet.removal,
      methodA: {
        ...emptyPtSheet.removal.methodA,
        pressureMin: method === 'A' ? legacyNumber(application, 'rinsePressure') : '',
        pressureMax: method === 'A' ? legacyNumber(application, 'rinsePressure') : '',
        pressureUnit: method === 'A' && hasLegacyValue(application.rinsePressure) ? 'bar' : '',
        temperatureMin: method === 'A' ? legacyNumber(application, 'rinseTemperature') : '',
        temperatureMax: method === 'A' ? legacyNumber(application, 'rinseTemperature') : '',
        temperatureUnit: method === 'A' && hasLegacyValue(application.rinseTemperature) ? 'degC' as const : '' as const,
      },
    },
    development: {
      ...emptyPtSheet.development,
      developerApplication: legacyString(development, 'developerApplication'),
      developmentTime: legacyNumber(development, 'developmentTime'),
      developmentTimeUnit: 'min' as const,
    },
    acceptance: migrateLegacyAcceptance(source.acceptance, 'technique.acceptance', quarantine),
    postCleaning: {
      ...emptyPtSheet.postCleaning,
      instructions: legacyString(postCleaning, 'postCleaningMethod'),
    },
  };
  if (method !== 'A') {
    quarantineScalar(quarantine, 'technique.application.rinsePressure', application.rinsePressure, 'ambiguous-legacy-field');
    quarantineScalar(quarantine, 'technique.application.rinseTemperature', application.rinseTemperature, 'ambiguous-legacy-field');
  }
  return normalizePtSheet(migrated);
}

function carryLegacyMigration(
  value: unknown,
  quarantine: RtPtQuarantineEntry[],
  warnings: string[],
): void {
  const migration = legacyRecord(value);
  if (Array.isArray(migration.warnings)) {
    migration.warnings.forEach((warning) => {
      if (typeof warning === 'string' && warning.trim()) warnings.push(`Prior migration: ${warning}`);
    });
  }
  if (migration.legacyPerformedData !== undefined) {
    flattenQuarantine(
      quarantine,
      migration.legacyPerformedData,
      'migration.legacyPerformedData',
      'performed-result',
    );
  }
  if (migration.quarantine !== undefined) {
    flattenQuarantine(
      quarantine,
      migration.quarantine,
      'migration.quarantine',
      'manual-mapping-required',
    );
  }
}

function inferLegacyUnitSystem(method: RtPtMethod, technique: UnknownRecord): RtPtUnitSystem {
  const general = legacyRecord(technique.general);
  if (general.thicknessUnit === 'inch') return 'US-customary';
  if (method === 'RT-Film') {
    const exposure = legacyRecord(technique.exposure);
    if (exposure.sfdUnit === 'inch' || exposure.sodUnit === 'inch' || exposure.ofdUnit === 'inch') {
      return 'US-customary';
    }
  }
  return 'SI';
}

function migrateTechnique(
  method: RtPtMethod,
  technique: unknown,
  sourceVersion: 1 | 2,
  unitSystem: RtPtUnitSystem,
  quarantine: RtPtQuarantineEntry[],
  warnings: string[],
): RtFilmTechnique | RtDigitalTechnique | PtTechnique {
  if (method === 'RT-Film') return migrateLegacyFilm(technique, sourceVersion, quarantine, warnings);
  if (method === 'RT-Digital') {
    return migrateLegacyDigital(technique, sourceVersion, unitSystem, quarantine, warnings);
  }
  return migrateLegacyPt(technique, sourceVersion, quarantine, warnings);
}

function migrateV1(source: UnknownRecord): RtPtDocumentV3 {
  const method = parseMethod(source.method, 'method');
  const sheets = record(source.sheets, 'sheets');
  const activeTechnique = method === 'RT-Film'
    ? sheets.rtFilm
    : method === 'RT-Digital'
      ? sheets.rtDigital
      : sheets.penetrant;
  const techniqueRecord = legacyRecord(activeTechnique);
  const unitSystem = inferLegacyUnitSystem(method, techniqueRecord);
  const quarantine: RtPtQuarantineEntry[] = [];
  const warnings = [
    'Migrated from schema V1 as a draft; controlled references, approvals, and V3 qualification evidence were not inferred.',
  ];
  const technique = migrateTechnique(method, activeTechnique, 1, unitSystem, quarantine, warnings);
  return createRtPtDocument({
    method,
    status: 'draft',
    unitSystem,
    technique,
    migration: { sourceSchemaVersion: 1, warnings, quarantine },
  });
}

function migrateV2(source: UnknownRecord): RtPtDocumentV3 {
  if (source.documentType !== RT_PT_DOCUMENT_TYPE) throw new CodecError('documentType must be technique.');
  const method = parseMethod(source.method, 'method');
  const unitSystem = enumField(source, 'unitSystem', 'document', UNIT_SYSTEMS) as RtPtUnitSystem;
  const quarantine: RtPtQuarantineEntry[] = [];
  const warnings = [
    'Migrated from schema V2 as a draft; V3 view planning, source details, and qualification evidence require manual review.',
  ];
  carryLegacyMigration(source.migration, quarantine, warnings);
  const technique = migrateTechnique(method, source.technique, 2, unitSystem, quarantine, warnings);
  return createRtPtDocument({
    method,
    documentId: nonEmptyStringField(source, 'documentId', 'document'),
    status: 'draft',
    documentControl: parseDocumentControl(source.documentControl, 'documentControl'),
    revisionHistory: [],
    organization: parseOrganization(source.organization, 'organization'),
    job: parseJob(source.job, 'job'),
    unitSystem,
    controlledReferences: parseControlledReferences(source.controlledReferences, 'controlledReferences'),
    approvals: [],
    technique,
    migration: { sourceSchemaVersion: 2, warnings, quarantine },
  });
}

export interface DecodeRtPtDocumentOptions {
  /** Allows compatibility tests/older shells to reject a newer persisted version before parsing it. */
  maxSupportedVersion?: number;
}

export function decodeRtPtDocument(
  value: unknown,
  options: DecodeRtPtDocumentOptions = {},
): RtPtDecodeResult {
  if (!isRecord(value)) return { status: 'invalid', message: 'The saved document is not an object.' };
  if ('partA' in value || 'inspectionSetup' in value) {
    return { status: 'legacy-ut', message: 'This card uses an unsupported legacy inspection data model.' };
  }
  if (value.documentKind !== RT_PT_DOCUMENT_KIND) {
    return { status: 'invalid', message: 'The saved document is not an RT-PT Inspector document.' };
  }
  const maxSupportedVersion = options.maxSupportedVersion ?? RT_PT_DOCUMENT_VERSION;
  if (typeof value.schemaVersion === 'number' && value.schemaVersion > maxSupportedVersion) {
    return {
      status: 'unsupported-version',
      version: value.schemaVersion,
      message: `Document version ${value.schemaVersion} is newer than this application supports.`,
    };
  }

  try {
    if (value.schemaVersion === 1) return { status: 'success', document: migrateV1(value) };
    if (value.schemaVersion === 2) return { status: 'success', document: migrateV2(value) };
    if (value.schemaVersion !== RT_PT_DOCUMENT_VERSION) {
      return { status: 'invalid', message: 'The RT-PT document version is missing or invalid.' };
    }
    return { status: 'success', document: decodeV3(value) };
  } catch (error) {
    return {
      status: 'invalid',
      message: error instanceof Error ? error.message : 'The RT-PT document is invalid.',
    };
  }
}

export function normalizeRtFilmSheet(value: unknown): RtFilmSheet {
  return parseFilmTechnique(value ?? emptyRtFilmSheet, 'rtFilm', true);
}

export function normalizeRtDigitalSheet(value: unknown): RtDigitalSheet {
  return parseDigitalTechnique(value ?? emptyRtDigitalSheet, 'rtDigital', true);
}

export function normalizePtSheet(value: unknown): PtSheet {
  return parsePtTechnique(value ?? emptyPtSheet, 'penetrant', true);
}

export function extractRtFilmTechnique(value: unknown): RtFilmTechnique {
  return parseFilmTechnique(value, 'technique', true);
}

export function extractRtDigitalTechnique(value: unknown): RtDigitalTechnique {
  return parseDigitalTechnique(value, 'technique', true);
}

export function extractPtTechnique(value: unknown): PtTechnique {
  return parsePtTechnique(value, 'technique', true);
}

/** Quarantine is intentionally unreachable from all hydration helpers. */
export function hydrateRtFilmSheet(document: RtPtDocumentV3): RtFilmSheet {
  return document.method === 'RT-Film'
    ? normalizeRtFilmSheet(document.technique)
    : normalizeRtFilmSheet(emptyRtFilmSheet);
}

/** Quarantine is intentionally unreachable from all hydration helpers. */
export function hydrateRtDigitalSheet(document: RtPtDocumentV3): RtDigitalSheet {
  return document.method === 'RT-Digital'
    ? normalizeRtDigitalSheet(document.technique)
    : normalizeRtDigitalSheet(emptyRtDigitalSheet);
}

/** Quarantine is intentionally unreachable from all hydration helpers. */
export function hydratePtSheet(document: RtPtDocumentV3): PtSheet {
  return document.method === 'PT'
    ? normalizePtSheet(document.technique)
    : normalizePtSheet(emptyPtSheet);
}

/** Fingerprints controlled V3 content; navigation and migration quarantine are excluded. */
export function fingerprintRtPtContent(document: RtPtDocumentV3): string {
  return JSON.stringify({
    documentType: document.documentType,
    status: document.status,
    approvalFingerprint: document.approvalFingerprint ?? '',
    documentControl: parseDocumentControl(document.documentControl, 'documentControl'),
    revisionHistory: parseRevisionHistory(document.revisionHistory, 'revisionHistory'),
    organization: parseOrganization(document.organization, 'organization'),
    job: parseJob(document.job, 'job'),
    unitSystem: document.unitSystem,
    controlledReferences: parseControlledReferences(document.controlledReferences, 'controlledReferences'),
    approvals: parseApprovals(document.approvals, 'approvals'),
    method: document.method,
    technique: parseTechnique(document.technique, document.method, 'technique'),
  });
}

/**
 * Canonical approval basis for the active V3 document. Lifecycle state and
 * quarantined migration data are excluded; every value printed in a
 * controlled technique, including approval records and the stable document
 * identity, is included.
 */
export function fingerprintRtPtApprovedContent(document: RtPtDocumentV3): string {
  const canonicalContent = JSON.stringify({
    documentKind: document.documentKind,
    schemaVersion: document.schemaVersion,
    documentType: document.documentType,
    documentId: document.documentId,
    documentControl: parseDocumentControl(document.documentControl, 'documentControl'),
    revisionHistory: parseRevisionHistory(document.revisionHistory, 'revisionHistory'),
    organization: parseOrganization(document.organization, 'organization'),
    job: parseJob(document.job, 'job'),
    unitSystem: document.unitSystem,
    controlledReferences: parseControlledReferences(document.controlledReferences, 'controlledReferences'),
    approvals: parseApprovals(document.approvals, 'approvals'),
    method: document.method,
    technique: parseTechnique(document.technique, document.method, 'technique'),
  });
  return createRtPtSha256Fingerprint(canonicalContent);
}

/** Returns true only when the persisted binding matches the current canonical content. */
export function hasValidRtPtApprovalFingerprint(document: RtPtDocumentV3): boolean {
  const persisted = document.approvalFingerprint;
  if (!persisted || !isRtPtSha256Fingerprint(persisted)) return false;
  try {
    return persisted === fingerprintRtPtApprovedContent(document);
  } catch {
    return false;
  }
}

function reconcileDecodedRtPtApproval(document: RtPtDocumentV3): RtPtDocumentV3 {
  if (document.status !== 'approved' || hasValidRtPtApprovalFingerprint(document)) return document;
  const { approvalFingerprint: _staleFingerprint, ...unbound } = document;
  return {
    ...unbound,
    status: 'draft',
    approvals: [],
  } as RtPtDocumentV3;
}
