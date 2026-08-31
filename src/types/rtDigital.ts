import {
  emptyRtPtAcceptancePlan,
  emptyRtPtGeneralInfo,
  type CurrentUnit,
  type DetectorLengthUnit,
  type LengthUnit,
  type NumberOrEmpty,
  type RtPerformanceTrendEntry,
  type RtPtAcceptancePlan,
  type RtPtGeneralInfo,
  type TechniqueType,
  type TimeUnit,
  type VoltageUnit,
} from './rtFilm';

export type {
  CurrentUnit,
  DetectorLengthUnit,
  LengthUnit,
  NumberOrEmpty,
  TimeUnit,
  VoltageUnit,
};

export type RtDigitalGeneralInfo = RtPtGeneralInfo;
export type RtDigitalAcceptance = RtPtAcceptancePlan;
export type RtDigitalWorkflow = 'Static' | '';
export type DigitalTimeUnit = TimeUnit | 'ms';

/** The legacy acquisition fields remain available for V3 compatibility. */
export interface RtDigitalSource {
  sourceType: 'X-ray' | '';
  manufacturer: string;
  model: string;
  serialNumber: string;
  calibrationRequirement: string;
  focalSpotSize: NumberOrEmpty;
  focalSpotSizeUnit: LengthUnit;
}

export interface RtDigitalAcquisitionDefaults {
  /** @deprecated This legacy field stores SWSI/DWSI/DWDI. New work uses planning.part.technique. */
  wallTechnique: TechniqueType;
  sdd: NumberOrEmpty;
  sddUnit: LengthUnit;
  sod: NumberOrEmpty;
  sodUnit: LengthUnit;
  odd: NumberOrEmpty;
  oddUnit: LengthUnit;
  magnificationAuto: boolean;
  magnification: NumberOrEmpty;
  thicknessDescription: string;
  thicknessMin: NumberOrEmpty;
  thicknessMax: NumberOrEmpty;
  thicknessUnit: LengthUnit;
  requiredUg: NumberOrEmpty;
  requiredUgUnit: LengthUnit;
  tubeVoltage: NumberOrEmpty;
  tubeVoltageUnit: VoltageUnit;
  tubeCurrent: NumberOrEmpty;
  tubeCurrentUnit: CurrentUnit;
  exposureTime: NumberOrEmpty;
  exposureTimeUnit: DigitalTimeUnit;
  integrationTime: NumberOrEmpty;
  integrationTimeUnit: DigitalTimeUnit;
  frameCount: NumberOrEmpty;
  framesAveraged: NumberOrEmpty;
  /** Static acquisition does not require a rate; retain it only when a qualified setup uses it. */
  frameRate?: NumberOrEmpty;
  filter: string;
  collimation: string;
  iqiOverride: string;
  coverage: string;
  imageNaming: string;
  markingInstructions: string;
  notes: string;
}

export type RtDigitalAttachmentMimeType = 'image/jpeg' | 'image/png' | 'application/pdf';

/** Blob content is intentionally stored outside the controlled technique document. */
export interface RtDigitalAttachmentMetadata {
  id: string;
  name: string;
  mimeType: RtDigitalAttachmentMimeType;
  size: number;
  sha256: string;
}

export type RtDigitalWallTechnique = 'Single Wall' | 'Double Wall' | '';
export type RtDigitalImageTechnique = 'SWSI' | 'DWSI' | 'DWDI' | 'Elliptical' | 'Other' | '';
export type RtDigitalManufacturingProcess =
  | 'Casting'
  | 'Weldment'
  | 'Forging'
  | 'Additive Manufacturing'
  | 'Assembly'
  | 'Other'
  | '';
export type RtDigitalPartGeometryType =
  | 'Flat / Plate'
  | 'Rectangular'
  | 'Pipe / Tube'
  | 'Cylinder'
  | 'Ring'
  | 'Cone'
  | 'Complex Casting'
  | 'Other'
  | '';
export type RtDigitalThicknessMode = 'Single Thickness' | 'Thickness Range' | 'Multiple Thickness Zones' | '';
export type RtDigitalInspectionAreaMode = 'Entire Part' | 'Defined Area' | 'Multiple Areas' | '';
export type RtDigitalDetectorOrientation = 'Portrait' | 'Landscape' | 'Auto' | '';
export type RtDigitalIqiType = 'Wire' | 'Hole' | 'Duplex' | '';

export interface RtDigitalVisualPoint {
  x: NumberOrEmpty;
  y: NumberOrEmpty;
}

export interface RtDigitalVisualRegion extends RtDigitalVisualPoint {
  width: NumberOrEmpty;
  height: NumberOrEmpty;
  rotationDegrees: NumberOrEmpty;
}

interface RtDigitalPartGeometryBase {
  id: string;
  geometryType: RtDigitalPartGeometryType;
  unit: LengthUnit;
}

export type RtDigitalPartGeometry =
  | (RtDigitalPartGeometryBase & { geometryType: '' })
  | (RtDigitalPartGeometryBase & {
      geometryType: 'Flat / Plate' | 'Rectangular';
      length: NumberOrEmpty;
      width: NumberOrEmpty;
      height: NumberOrEmpty;
    })
  | (RtDigitalPartGeometryBase & {
      geometryType: 'Pipe / Tube' | 'Cylinder' | 'Ring';
      outsideDiameter: NumberOrEmpty;
      insideDiameter: NumberOrEmpty;
      length: NumberOrEmpty;
    })
  | (RtDigitalPartGeometryBase & {
      geometryType: 'Cone';
      majorDiameter: NumberOrEmpty;
      minorDiameter: NumberOrEmpty;
      height: NumberOrEmpty;
      wallThickness: NumberOrEmpty;
    })
  | (RtDigitalPartGeometryBase & {
      geometryType: 'Complex Casting';
      boundingLength: NumberOrEmpty;
      boundingWidth: NumberOrEmpty;
      boundingHeight: NumberOrEmpty;
      inspectionEnvelope: string;
    })
  | (RtDigitalPartGeometryBase & {
      geometryType: 'Other';
      description: string;
    });

export interface RtDigitalThicknessZone {
  id: string;
  zoneId: string;
  description: string;
  minimum: NumberOrEmpty;
  maximum: NumberOrEmpty;
  governing: NumberOrEmpty;
  position: RtDigitalVisualRegion;
}

interface RtDigitalThicknessBase {
  id: string;
  mode: RtDigitalThicknessMode;
  unit: LengthUnit;
}

export type RtDigitalThicknessDefinition =
  | (RtDigitalThicknessBase & { mode: '' })
  | (RtDigitalThicknessBase & { mode: 'Single Thickness'; thickness: NumberOrEmpty })
  | (RtDigitalThicknessBase & {
      mode: 'Thickness Range';
      minimum: NumberOrEmpty;
      maximum: NumberOrEmpty;
    })
  | (RtDigitalThicknessBase & {
      mode: 'Multiple Thickness Zones';
      zones: RtDigitalThicknessZone[];
    });

export interface RtDigitalInspectionArea {
  id: string;
  areaId: string;
  description: string;
  width: NumberOrEmpty;
  height: NumberOrEmpty;
  unit: LengthUnit;
  position: RtDigitalVisualRegion;
}

export interface RtDigitalInspectionAreaDefinition {
  id: string;
  mode: RtDigitalInspectionAreaMode;
  areas: RtDigitalInspectionArea[];
}

export interface RtDigitalTechniqueDefinition {
  wallTechnique: RtDigitalWallTechnique;
  imageTechnique: RtDigitalImageTechnique;
  otherImageTechnique: string;
}

export interface RtDigitalPartDefinition {
  id: string;
  partName: string;
  partNumber: string;
  vendorCode: string;
  revisionOrConfiguration: string;
  drawingOrSpecificationReference: string;
  procedureNumber: string;
  material: string;
  materialSpecification: string;
  materialGroup: string;
  surfaceFinish: string;
  manufacturingProcess: RtDigitalManufacturingProcess;
  otherManufacturingProcess: string;
  geometry: RtDigitalPartGeometry;
  thickness: RtDigitalThicknessDefinition;
  inspectionAreas: RtDigitalInspectionAreaDefinition;
  technique: RtDigitalTechniqueDefinition;
  inspectionStandard: string;
  inspectionStandardRevision: string;
  attachments: RtDigitalAttachmentMetadata[];
  referenceAttachmentId: string;
  partOrientation: string;
  datumReference: string;
}

export interface RtDigitalCatalogStatus {
  reference: string;
  status: string;
  date: string;
  dueDate: string;
}

export interface RtDigitalSourceFocalSpotOption {
  id: string;
  label: string;
  size: NumberOrEmpty;
  unit: LengthUnit;
}

export interface RtDigitalSourceFilterOption {
  id: string;
  label: string;
  description: string;
}

/** Immutable value copied from the selected local source-catalog revision. */
export interface RtDigitalSourceCatalogSnapshot {
  manufacturer: string;
  model: string;
  serialNumber: string;
  kvMinimum: NumberOrEmpty;
  kvMaximum: NumberOrEmpty;
  currentMinimum: NumberOrEmpty;
  currentMaximum: NumberOrEmpty;
  maximumPowerKw: NumberOrEmpty;
  focalSpots: RtDigitalSourceFocalSpotOption[];
  filters: RtDigitalSourceFilterOption[];
  calibration: RtDigitalCatalogStatus;
  qualification: RtDigitalCatalogStatus;
}

/** Immutable value copied from the selected local detector-catalog revision. */
export interface RtDigitalDetectorCatalogSnapshot {
  manufacturer: string;
  model: string;
  serialNumber: string;
  activeWidth: NumberOrEmpty;
  activeHeight: NumberOrEmpty;
  activeAreaUnit: LengthUnit;
  matrixColumns: NumberOrEmpty;
  matrixRows: NumberOrEmpty;
  pixelSize: NumberOrEmpty;
  pixelSizeUnit: DetectorLengthUnit;
  bitDepth: NumberOrEmpty;
  detectorSrb: NumberOrEmpty;
  detectorSrbUnit: DetectorLengthUnit;
  modes: string[];
  calibration: RtDigitalCatalogStatus;
  badPixelMap: RtDigitalCatalogStatus;
  qualification: RtDigitalCatalogStatus;
}

export interface RtDigitalIqiRuleRow {
  id: string;
  minimumThickness: NumberOrEmpty;
  maximumThickness: NumberOrEmpty;
  iqiMaterial: string;
  designation: string;
  requiredWire: string;
  requiredHole: string;
  requiredSensitivity: string;
  placement: string;
  shimRequirement: string;
}

/** A local guidance snapshot; it is never itself a compliance declaration. */
export interface RtDigitalIqiRuleCatalogSnapshot {
  standard: string;
  standardRevision: string;
  materialGroup: string;
  iqiType: RtDigitalIqiType;
  wallTechnique: RtDigitalWallTechnique;
  imageTechnique: RtDigitalImageTechnique;
  thicknessUnit: LengthUnit;
  placementRule: string;
  rules: RtDigitalIqiRuleRow[];
}

export interface RtDigitalCatalogRevision<TSnapshot> {
  readonly id: string;
  readonly revision: number;
  readonly createdAt: string;
  readonly snapshot: Readonly<TSnapshot>;
}

export interface RtDigitalCatalogRecord<TSnapshot> {
  readonly id: string;
  readonly name: string;
  readonly revisions: ReadonlyArray<RtDigitalCatalogRevision<TSnapshot>>;
}

export interface RtDigitalSourceSelection {
  id: string;
  catalogRecordId: string;
  catalogRevisionId: string;
  catalogRevision: NumberOrEmpty;
  snapshot: RtDigitalSourceCatalogSnapshot | null;
  focalSpotOptionId: string;
  filterOptionIds: string[];
  extraFilter: string;
  notes: string;
}

export interface RtDigitalDetectorSelection {
  id: string;
  catalogRecordId: string;
  catalogRevisionId: string;
  catalogRevision: NumberOrEmpty;
  snapshot: RtDigitalDetectorCatalogSnapshot | null;
  detectorMode: string;
  orientation: RtDigitalDetectorOrientation;
  extraMode: string;
  notes: string;
}

export type RtDigitalDistanceBasis = 'SOD + ODD' | 'SDD - ODD' | 'SDD - SOD' | '';

export interface RtDigitalLengthInput {
  value: NumberOrEmpty;
  unit: DetectorLengthUnit;
}

export interface RtDigitalGeometryInputs {
  id: string;
  distanceBasis: RtDigitalDistanceBasis;
  sod: RtDigitalLengthInput;
  sdd: RtDigitalLengthInput;
  odd: RtDigitalLengthInput;
  availableSourceDistance: RtDigitalLengthInput;
  geometryRestrictions: string;
  requiredMaximumUg: RtDigitalLengthInput;
  requiredMaximumEffectivePixel: RtDigitalLengthInput;
  inspectionAreaId: string;
  requiredOverlapPercent: NumberOrEmpty;
  excessiveOverlapThresholdPercent: NumberOrEmpty;
  optimizeExposureCount: boolean;
  optimizeSodForUg: boolean;
  optimizeOdd: boolean;
  levelThreeApprovalReference: string;
}

export interface RtDigitalIqiRuleBasis {
  id: string;
  catalogRecordId: string;
  catalogRevisionId: string;
  catalogRevision: NumberOrEmpty;
  snapshot: RtDigitalIqiRuleCatalogSnapshot | null;
  standard: string;
  standardRevision: string;
  iqiType: RtDigitalIqiType;
  material: string;
  materialGroup: string;
  placementRule: string;
}

export interface RtDigitalIqiZoneOutput {
  id: string;
  thicknessZoneId: string;
  governingThickness: NumberOrEmpty;
  thicknessUnit: LengthUnit;
  iqiMaterial: string;
  designation: string;
  requiredWire: string;
  requiredHole: string;
  requiredSensitivity: string;
  placement: string;
  shimRequirement: string;
  governing: boolean;
  overrideId: string;
}

export interface RtDigitalIqiPlanning {
  id: string;
  basis: RtDigitalIqiRuleBasis;
  zoneOutputs: RtDigitalIqiZoneOutput[];
}

export interface RtDigitalViewingPreset {
  id: string;
  name: string;
  windowLevel: NumberOrEmpty;
  windowWidth: NumberOrEmpty;
  zoom: NumberOrEmpty;
  sharpness: string;
  permittedProcessing: string;
  lut: string;
  invert: boolean;
}

export interface RtDigitalAcceptanceProfile {
  id: string;
  name: string;
  standard: string;
  revision: string;
  acceptanceClass: string;
  grade: string;
  level: string;
  applicableClause: string;
  drawingRequirement: string;
  customerRequirement: string;
  requirementText: string;
}

export interface RtDigitalProcessingPolicy {
  permittedProcessing: string;
  prohibitedProcessing: string;
}

export interface RtDigitalPlanningOverride {
  id: string;
  fieldPath: string;
  calculatedValue: string;
  approvedValue: string;
  reason: string;
  approvedBy: string;
  approvedAt: string;
}

/** Structured controlled inputs. Geometry calculations are deliberately absent. */
export interface RtDigitalPlanning {
  id: string;
  part: RtDigitalPartDefinition;
  sourceSelection: RtDigitalSourceSelection;
  detectorSelection: RtDigitalDetectorSelection;
  geometry: RtDigitalGeometryInputs;
  /** Draft visual template used before the exposure grid creates acquisitions. */
  visual: RtDigitalAcquisitionVisualControls;
  iqiRules: RtDigitalIqiPlanning;
  viewingPresets: RtDigitalViewingPreset[];
  processingPolicy: RtDigitalProcessingPolicy;
  acceptanceProfiles: RtDigitalAcceptanceProfile[];
  overrides: RtDigitalPlanningOverride[];
}

export interface RtDigitalGridPlacement {
  id: string;
  row: NumberOrEmpty;
  column: NumberOrEmpty;
  centerX: NumberOrEmpty;
  centerY: NumberOrEmpty;
  unit: LengthUnit;
  detectorOrientation: RtDigitalDetectorOrientation;
}

export interface RtDigitalAcquisitionVisualControls {
  id: string;
  sourcePosition: RtDigitalVisualPoint;
  detectorPosition: RtDigitalVisualPoint;
  detectorRotationDegrees: NumberOrEmpty;
  beamCenter: RtDigitalVisualPoint;
  beamAngleDegrees: NumberOrEmpty;
  inspectionAreaId: string;
  leadMarkers: string;
}

export interface RtDigitalAcquisitionIqiAssignment {
  id: string;
  zoneOutputId: string;
  designation: string;
  requiredWire: string;
  requiredHole: string;
  shimRequirement: string;
  positionDescription: string;
  position: RtDigitalVisualPoint;
}

export interface RtDigitalInterpretationArea {
  id: string;
  areaId: string;
  description: string;
  inspectionAreaId: string;
  thicknessZoneId: string;
  position: RtDigitalVisualRegion;
  thicknessMinimum: NumberOrEmpty;
  thicknessMaximum: NumberOrEmpty;
  thicknessUnit: LengthUnit;
  viewingPresetId: string;
  windowLevel: NumberOrEmpty;
  windowWidth: NumberOrEmpty;
  zoom: NumberOrEmpty;
  sharpness: string;
  permittedProcessing: string;
  lut: string;
  invert: boolean;
  acceptanceProfileId: string;
}

export interface RtDigitalAcquisitionPlan {
  id: string;
  gridPlacement: RtDigitalGridPlacement;
  visual: RtDigitalAcquisitionVisualControls;
  representativeImage: RtDigitalAttachmentMetadata | null;
  iqiAssignment: RtDigitalAcquisitionIqiAssignment;
  interpretationAreas: RtDigitalInterpretationArea[];
}

export interface RtDigitalAcquisition extends RtDigitalAcquisitionDefaults {
  id: string;
  viewId: string;
  description: string;
  orientation: string;
  inspectionZone: string;
  referenceAttachmentId: string;
  /** Optional on persisted V3 for backward compatibility; normalized state always fills it. */
  plan?: RtDigitalAcquisitionPlan;
}

export interface RtDigitalSystem {
  ddaType: string;
  manufacturer: string;
  model: string;
  serialNumber: string;
  activeAreaWidth: NumberOrEmpty;
  activeAreaHeight: NumberOrEmpty;
  activeAreaUnit: LengthUnit;
  matrixColumns: NumberOrEmpty;
  matrixRows: NumberOrEmpty;
  pixelSize: NumberOrEmpty;
  pixelSizeUnit: DetectorLengthUnit;
  bitDepth: NumberOrEmpty;
  detectorMode: string;
  softwareName: string;
  softwareVersion: string;
  systemQualificationReference: string;
  performanceBaselineReference: string;
}

export interface RtDigitalReferenceStatus {
  reference: string;
  date: string;
  dueDate: string;
  status: string;
}

export interface RtDigitalDetectorPerformance {
  detectorSrb: NumberOrEmpty;
  detectorSrbUnit: DetectorLengthUnit;
  imageSrb: NumberOrEmpty;
  imageSrbUnit: DetectorLengthUnit;
  badPixelMap: RtDigitalReferenceStatus;
  calibration: RtDigitalReferenceStatus;
  stability: RtDigitalReferenceStatus;
  /** Omitted when empty so earlier canonical fingerprints stay stable. */
  performanceTrend?: RtPerformanceTrendEntry[];
}

export interface RtDigitalImageProcessing {
  windowLevel: NumberOrEmpty;
  windowWidth: NumberOrEmpty;
  zoom: NumberOrEmpty;
  noiseReduction: string;
  contrastEnhancement: string;
  processingProcedure: string;
}

export interface RtDigitalDisplayAndStorage {
  displayManufacturer: string;
  displayModel: string;
  displaySerialNumber: string;
  viewerSoftware: string;
  viewerSoftwareVersion: string;
  displayQualificationReference: string;
  storageFormat: string;
  archiveLocation: string;
  retentionPeriod: string;
  rawDataPreservation: string;
  dicondeProfileReference: string;
}

export interface RtDigitalIqi {
  type: string;
  standard: string;
  designation: string;
  material: string;
  thickness: NumberOrEmpty;
  thicknessUnit: LengthUnit;
  placement: string;
  requiredSensitivity: string;
  requiredUg: NumberOrEmpty;
  requiredUgUnit: LengthUnit;
  requiredSnrOrNormalizedSnr: string;
  requiredContrastSensitivityOrCnr: string;
}

export interface RtDigitalSheet {
  general: RtDigitalGeneralInfo;
  workflow: RtDigitalWorkflow;
  source: RtDigitalSource;
  acquisitionDefaults: RtDigitalAcquisitionDefaults;
  system: RtDigitalSystem;
  detectorPerformance: RtDigitalDetectorPerformance;
  imageProcessing: RtDigitalImageProcessing;
  displayAndStorage: RtDigitalDisplayAndStorage;
  iqi: RtDigitalIqi;
  acceptance: RtDigitalAcceptance;
  acquisitions: RtDigitalAcquisition[];
  techniqueNotes: string;
  /** Optional on persisted V3 for backward compatibility; normalized state always fills it. */
  planning?: RtDigitalPlanning;
}

export type RtDigitalTechnique = RtDigitalSheet;
export type RtDigitalNormalizedAcquisition = Omit<RtDigitalAcquisition, 'plan'> & {
  plan: RtDigitalAcquisitionPlan;
};
export type RtDigitalNormalizedSheet = Omit<RtDigitalSheet, 'planning' | 'acquisitions'> & {
  planning: RtDigitalPlanning;
  acquisitions: RtDigitalNormalizedAcquisition[];
};
/** @deprecated Use RtDigitalAcquisitionDefaults or RtDigitalAcquisition. */
export type RtDigitalExposureSetup = RtDigitalAcquisitionDefaults;

const createRtDigitalId = (prefix: string): string => {
  if (typeof globalThis.crypto?.randomUUID === 'function') return `${prefix}-${globalThis.crypto.randomUUID()}`;
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
};

const emptyPoint = (): RtDigitalVisualPoint => ({ x: '', y: '' });
const emptyRegion = (): RtDigitalVisualRegion => ({ ...emptyPoint(), width: '', height: '', rotationDegrees: '' });
const emptyCatalogStatus = (): RtDigitalCatalogStatus => ({ reference: '', status: '', date: '', dueDate: '' });

export function createEmptyRtDigitalAcquisitionVisualControls(
  id = createRtDigitalId('dr-visual'),
): RtDigitalAcquisitionVisualControls {
  return {
    id,
    sourcePosition: emptyPoint(),
    detectorPosition: emptyPoint(),
    detectorRotationDegrees: '',
    beamCenter: emptyPoint(),
    beamAngleDegrees: '',
    inspectionAreaId: '',
    leadMarkers: '',
  };
}

export function createEmptyRtDigitalAcquisitionPlan(): RtDigitalAcquisitionPlan {
  return {
    id: createRtDigitalId('dr-acquisition-plan'),
    gridPlacement: {
      id: createRtDigitalId('dr-grid-placement'),
      row: '',
      column: '',
      centerX: '',
      centerY: '',
      unit: 'mm',
      detectorOrientation: '',
    },
    visual: createEmptyRtDigitalAcquisitionVisualControls(),
    representativeImage: null,
    iqiAssignment: {
      id: createRtDigitalId('dr-iqi-assignment'),
      zoneOutputId: '',
      designation: '',
      requiredWire: '',
      requiredHole: '',
      shimRequirement: '',
      positionDescription: '',
      position: emptyPoint(),
    },
    interpretationAreas: [],
  };
}

export function createEmptyRtDigitalPlanning(): RtDigitalPlanning {
  return {
    id: createRtDigitalId('dr-planning'),
    part: {
      id: createRtDigitalId('dr-part'),
      partName: '',
      partNumber: '',
      vendorCode: '',
      revisionOrConfiguration: '',
      drawingOrSpecificationReference: '',
      procedureNumber: '',
      material: '',
      materialSpecification: '',
      materialGroup: '',
      surfaceFinish: '',
      manufacturingProcess: '',
      otherManufacturingProcess: '',
      geometry: { id: createRtDigitalId('dr-part-geometry'), geometryType: '', unit: 'mm' },
      thickness: { id: createRtDigitalId('dr-thickness'), mode: '', unit: 'mm' },
      inspectionAreas: { id: createRtDigitalId('dr-inspection-areas'), mode: '', areas: [] },
      technique: { wallTechnique: '', imageTechnique: '', otherImageTechnique: '' },
      inspectionStandard: '',
      inspectionStandardRevision: '',
      attachments: [],
      referenceAttachmentId: '',
      partOrientation: '',
      datumReference: '',
    },
    sourceSelection: {
      id: createRtDigitalId('dr-source-selection'),
      catalogRecordId: '',
      catalogRevisionId: '',
      catalogRevision: '',
      snapshot: null,
      focalSpotOptionId: '',
      filterOptionIds: [],
      extraFilter: '',
      notes: '',
    },
    detectorSelection: {
      id: createRtDigitalId('dr-detector-selection'),
      catalogRecordId: '',
      catalogRevisionId: '',
      catalogRevision: '',
      snapshot: null,
      detectorMode: '',
      orientation: '',
      extraMode: '',
      notes: '',
    },
    geometry: {
      id: createRtDigitalId('dr-geometry'),
      distanceBasis: '',
      sod: { value: '', unit: 'mm' },
      sdd: { value: '', unit: 'mm' },
      odd: { value: '', unit: 'mm' },
      availableSourceDistance: { value: '', unit: 'mm' },
      geometryRestrictions: '',
      requiredMaximumUg: { value: '', unit: 'mm' },
      requiredMaximumEffectivePixel: { value: '', unit: 'mm' },
      inspectionAreaId: '',
      requiredOverlapPercent: '',
      excessiveOverlapThresholdPercent: '',
      optimizeExposureCount: true,
      optimizeSodForUg: false,
      optimizeOdd: false,
      levelThreeApprovalReference: '',
    },
    visual: createEmptyRtDigitalAcquisitionVisualControls(),
    iqiRules: {
      id: createRtDigitalId('dr-iqi-rules'),
      basis: {
        id: createRtDigitalId('dr-iqi-basis'),
        catalogRecordId: '',
        catalogRevisionId: '',
        catalogRevision: '',
        snapshot: null,
        standard: '',
        standardRevision: '',
        iqiType: '',
        material: '',
        materialGroup: '',
        placementRule: '',
      },
      zoneOutputs: [],
    },
    viewingPresets: [],
    processingPolicy: { permittedProcessing: '', prohibitedProcessing: '' },
    acceptanceProfiles: [],
    overrides: [],
  };
}

export const emptyRtDigitalAcquisitionDefaults: RtDigitalAcquisitionDefaults = {
  wallTechnique: '',
  sdd: '',
  sddUnit: 'mm',
  sod: '',
  sodUnit: 'mm',
  odd: '',
  oddUnit: 'mm',
  magnificationAuto: true,
  magnification: '',
  thicknessDescription: '',
  thicknessMin: '',
  thicknessMax: '',
  thicknessUnit: 'mm',
  requiredUg: '',
  requiredUgUnit: 'mm',
  tubeVoltage: '',
  tubeVoltageUnit: 'kV',
  tubeCurrent: '',
  tubeCurrentUnit: 'mA',
  exposureTime: '',
  exposureTimeUnit: '',
  integrationTime: '',
  integrationTimeUnit: '',
  frameCount: '',
  framesAveraged: '',
  filter: '',
  collimation: '',
  iqiOverride: '',
  coverage: '',
  imageNaming: '',
  markingInstructions: '',
  notes: '',
};

const emptyReferenceStatus = (): RtDigitalReferenceStatus => ({
  reference: '',
  date: '',
  dueDate: '',
  status: '',
});

export function createEmptyRtDigitalSheet(): RtDigitalNormalizedSheet {
  return {
    general: { ...emptyRtPtGeneralInfo },
    workflow: '',
    source: {
      sourceType: '',
      manufacturer: '',
      model: '',
      serialNumber: '',
      calibrationRequirement: '',
      focalSpotSize: '',
      focalSpotSizeUnit: 'mm',
    },
    acquisitionDefaults: { ...emptyRtDigitalAcquisitionDefaults },
    system: {
      ddaType: '',
      manufacturer: '',
      model: '',
      serialNumber: '',
      activeAreaWidth: '',
      activeAreaHeight: '',
      activeAreaUnit: 'mm',
      matrixColumns: '',
      matrixRows: '',
      pixelSize: '',
      pixelSizeUnit: 'um',
      bitDepth: '',
      detectorMode: '',
      softwareName: '',
      softwareVersion: '',
      systemQualificationReference: '',
      performanceBaselineReference: '',
    },
    detectorPerformance: {
      detectorSrb: '',
      detectorSrbUnit: 'um',
      imageSrb: '',
      imageSrbUnit: 'um',
      badPixelMap: emptyReferenceStatus(),
      calibration: emptyReferenceStatus(),
      stability: emptyReferenceStatus(),
    },
    imageProcessing: {
      windowLevel: '',
      windowWidth: '',
      zoom: '',
      noiseReduction: '',
      contrastEnhancement: '',
      processingProcedure: '',
    },
    displayAndStorage: {
      displayManufacturer: '',
      displayModel: '',
      displaySerialNumber: '',
      viewerSoftware: '',
      viewerSoftwareVersion: '',
      displayQualificationReference: '',
      storageFormat: '',
      archiveLocation: '',
      retentionPeriod: '',
      rawDataPreservation: '',
      dicondeProfileReference: '',
    },
    iqi: {
      type: '',
      standard: '',
      designation: '',
      material: '',
      thickness: '',
      thicknessUnit: 'mm',
      placement: '',
      requiredSensitivity: '',
      requiredUg: '',
      requiredUgUnit: 'mm',
      requiredSnrOrNormalizedSnr: '',
      requiredContrastSensitivityOrCnr: '',
    },
    acceptance: { ...emptyRtPtAcceptancePlan },
    acquisitions: [],
    techniqueNotes: '',
    planning: createEmptyRtDigitalPlanning(),
  };
}

export const emptyRtDigitalSheet: RtDigitalNormalizedSheet = createEmptyRtDigitalSheet();
