import { z } from 'zod';
import { fingerprintRtPtApprovedContent } from '@/lib/rtPtDocumentCodec';
import { hasValidRtPtInspectionReportFingerprint } from '@/lib/rtPtInspectionReportFingerprint';
import type { InspectorProfile } from '@/types/inspectorProfile';
import type { RtPtDocumentV3 } from '@/types/rtPtDocument';
import {
  RT_PT_INSPECTION_REPORT_KIND,
  RT_PT_INSPECTION_REPORT_TYPE,
  RT_PT_INSPECTION_REPORT_VERSION,
  type RtPtInspectionReportV1,
} from '@/types/rtPtInspectionReport';

export const RT_PT_INSPECTION_REPORT_STORAGE_PREFIX = 'rtpt_inspector_inspection_report_v1:';

const string = z.string();
const numberOrEmpty = z.union([z.number().finite(), z.literal('')]);
const booleanOrEmpty = z.union([z.boolean(), z.literal('')]);
const lengthUnit = z.enum(['mm', 'inch']);
const timeUnit = z.enum(['s', 'min', '']);
const digitalTimeUnit = z.enum(['s', 'min', 'ms', '']);
const temperatureUnit = z.enum(['degC', 'degF', '']);
const certificationLevel = z.enum(['Level I', 'Level II', 'Level III', '']);
const reportStatus = z.enum(['draft', 'in-review', 'approved', 'superseded']);
const inspectionResult = z.enum(['', 'accepted', 'rejected', 'retake-required']);
const disposition = z.enum(['', 'accepted', 'rejected', 'repair-required', 'reinspection-required']);

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
);

const controlledReferenceSchema = z.object({
  type: string,
  title: string,
  number: string,
  revision: string,
  clauseOrNote: string,
}).strict();

const sourceTechniqueSchema = z.object({
  documentId: string,
  documentNumber: string,
  title: string,
  revision: string,
  method: z.enum(['RT-Film', 'RT-Digital', 'RT-CR', 'PT']),
  approvedContentFingerprint: string,
  approvalDate: string,
  controlledReferences: z.array(controlledReferenceSchema),
}).strict();

const reportControlSchema = z.object({
  number: string,
  title: string,
  revision: string,
  reportDate: string,
  inspectionStart: string,
  inspectionEnd: string,
}).strict();

const organizationSchema = z.object({ name: string, site: string }).strict();
const jobSchema = z.object({ customer: string, contract: string, purchaseOrder: string, workOrder: string }).strict();
const partSchema = z.object({
  partName: string,
  partNumber: string,
  partRevisionOrConfiguration: string,
  serialOrLotNumber: string,
  quantity: numberOrEmpty,
  material: string,
  inspectionArea: string,
  workOrder: string,
}).strict();
const equipmentSchema = z.object({
  equipmentUsed: string,
  calibrationReferences: string,
  environmentalConditions: string,
  deviations: string,
}).strict();
const approvalSchema = z.object({
  role: z.enum(['performed', 'reviewed', 'quality', 'ndt-level-3']),
  name: string,
  personnelId: string,
  certificationLevel,
  certificationNumber: string,
  certificationBasis: string,
  date: string,
}).strict();
const indicationSchema = z.object({
  id: string,
  indicationId: string,
  linkedResultId: string,
  location: string,
  indicationType: string,
  size: numberOrEmpty,
  sizeUnit: lengthUnit,
  evaluation: string,
  disposition,
  remarks: string,
}).strict();

const baseShape = {
  documentKind: z.literal(RT_PT_INSPECTION_REPORT_KIND),
  schemaVersion: z.literal(RT_PT_INSPECTION_REPORT_VERSION),
  documentType: z.literal(RT_PT_INSPECTION_REPORT_TYPE),
  reportId: string,
  status: reportStatus,
  approvalFingerprint: string,
  sourceTechnique: sourceTechniqueSchema,
  reportControl: reportControlSchema,
  organization: organizationSchema,
  job: jobSchema,
  part: partSchema,
  equipment: equipmentSchema,
  indications: z.array(indicationSchema),
  overallDisposition: disposition,
  dispositionReference: string,
  coverageStatement: string,
  remarks: string,
  approvals: z.array(approvalSchema),
};

const filmPlannedSchema = z.object({
  viewId: string,
  description: string,
  orientation: string,
  inspectionZone: string,
  referenceAttachmentId: string,
  wallTechnique: string,
  sourceType: z.enum(['X-ray', 'Gamma', '']),
  sfd: numberOrEmpty,
  sfdUnit: lengthUnit,
  sod: numberOrEmpty,
  sodUnit: lengthUnit,
  ofd: numberOrEmpty,
  ofdUnit: lengthUnit,
  tubeVoltage: numberOrEmpty,
  tubeVoltageUnit: z.literal('kV'),
  tubeCurrent: numberOrEmpty,
  tubeCurrentUnit: z.literal('mA'),
  exposureTime: numberOrEmpty,
  exposureTimeUnit: timeUnit,
  filmDesignation: string,
  iqiRequirement: string,
  densityMinimum: numberOrEmpty,
  densityMaximum: numberOrEmpty,
}).strict();
const filmResultSchema = z.object({
  id: string,
  plannedItemId: string,
  planned: filmPlannedSchema,
  filmId: string,
  retakeOfFilmId: string,
  exposureDate: string,
  actualSfd: numberOrEmpty,
  actualSfdUnit: lengthUnit,
  actualSod: numberOrEmpty,
  actualSodUnit: lengthUnit,
  actualOfd: numberOrEmpty,
  actualOfdUnit: lengthUnit,
  actualTubeVoltage: numberOrEmpty,
  actualTubeVoltageUnit: z.enum(['kV', '']),
  actualTubeCurrent: numberOrEmpty,
  actualTubeCurrentUnit: z.enum(['mA', '']),
  actualSourceActivity: numberOrEmpty,
  actualSourceActivityUnit: string,
  actualExposureTime: numberOrEmpty,
  actualExposureTimeUnit: timeUnit,
  densityMinimum: numberOrEmpty,
  densityMaximum: numberOrEmpty,
  iqiObserved: string,
  iqiRequirementMet: booleanOrEmpty,
  coverageConfirmed: booleanOrEmpty,
  result: inspectionResult,
  remarks: string,
}).strict();

const crPlannedSchema = z.object({
  viewId: string,
  description: string,
  orientation: string,
  inspectionZone: string,
  referenceAttachmentId: string,
  wallTechnique: string,
  sourceType: z.enum(['X-ray', 'Gamma', '']),
  sfd: numberOrEmpty,
  sfdUnit: lengthUnit,
  sod: numberOrEmpty,
  sodUnit: lengthUnit,
  ofd: numberOrEmpty,
  ofdUnit: lengthUnit,
  tubeVoltage: numberOrEmpty,
  tubeVoltageUnit: z.literal('kV'),
  tubeCurrent: numberOrEmpty,
  tubeCurrentUnit: z.literal('mA'),
  exposureTime: numberOrEmpty,
  exposureTimeUnit: timeUnit,
  plateDesignation: string,
  iqiRequirement: string,
  greyValueMin: numberOrEmpty,
  greyValueMax: numberOrEmpty,
  requiredSnrMin: numberOrEmpty,
}).strict();
const crResultSchema = z.object({
  id: string,
  plannedItemId: string,
  planned: crPlannedSchema,
  plateOrImageId: string,
  retakeOfImageId: string,
  exposureDate: string,
  scanDate: string,
  actualSfd: numberOrEmpty,
  actualSfdUnit: lengthUnit,
  actualSod: numberOrEmpty,
  actualSodUnit: lengthUnit,
  actualOfd: numberOrEmpty,
  actualOfdUnit: lengthUnit,
  actualTubeVoltage: numberOrEmpty,
  actualTubeVoltageUnit: z.enum(['kV', '']),
  actualTubeCurrent: numberOrEmpty,
  actualTubeCurrentUnit: z.enum(['mA', '']),
  actualSourceActivity: numberOrEmpty,
  actualSourceActivityUnit: string,
  actualExposureTime: numberOrEmpty,
  actualExposureTimeUnit: timeUnit,
  greyValueMin: numberOrEmpty,
  greyValueMax: numberOrEmpty,
  achievedSnr: numberOrEmpty,
  achievedSrb: numberOrEmpty,
  snrRequirementMet: booleanOrEmpty,
  iqiObserved: string,
  iqiRequirementMet: booleanOrEmpty,
  coverageConfirmed: booleanOrEmpty,
  result: inspectionResult,
  remarks: string,
}).strict();

const digitalPlannedSchema = z.object({
  viewId: string,
  description: string,
  orientation: string,
  inspectionZone: string,
  referenceAttachmentId: string,
  wallTechnique: string,
  sdd: numberOrEmpty,
  sddUnit: lengthUnit,
  sod: numberOrEmpty,
  sodUnit: lengthUnit,
  odd: numberOrEmpty,
  oddUnit: lengthUnit,
  tubeVoltage: numberOrEmpty,
  tubeVoltageUnit: z.literal('kV'),
  tubeCurrent: numberOrEmpty,
  tubeCurrentUnit: z.literal('mA'),
  exposureTime: numberOrEmpty,
  exposureTimeUnit: digitalTimeUnit,
  integrationTime: numberOrEmpty,
  integrationTimeUnit: digitalTimeUnit,
  framesAveraged: numberOrEmpty,
  imageNaming: string,
  iqiRequirement: string,
  requiredSnrOrNormalizedSnr: string,
  requiredContrastSensitivityOrCnr: string,
}).strict();
const digitalResultSchema = z.object({
  id: string,
  plannedItemId: string,
  planned: digitalPlannedSchema,
  imageId: string,
  retakeOfImageId: string,
  acquisitionDate: string,
  actualSdd: numberOrEmpty,
  actualSddUnit: lengthUnit,
  actualSod: numberOrEmpty,
  actualSodUnit: lengthUnit,
  actualOdd: numberOrEmpty,
  actualOddUnit: lengthUnit,
  actualTubeVoltage: numberOrEmpty,
  actualTubeVoltageUnit: z.literal('kV'),
  actualTubeCurrent: numberOrEmpty,
  actualTubeCurrentUnit: z.literal('mA'),
  actualExposureTime: numberOrEmpty,
  actualExposureTimeUnit: digitalTimeUnit,
  actualIntegrationTime: numberOrEmpty,
  actualIntegrationTimeUnit: digitalTimeUnit,
  actualFramesAveraged: numberOrEmpty,
  achievedSnr: string,
  achievedCnr: string,
  iqiObserved: string,
  iqiRequirementMet: booleanOrEmpty,
  snrRequirementMet: booleanOrEmpty,
  cnrRequirementMet: booleanOrEmpty,
  detectorControlReference: string,
  archiveReference: string,
  coverageConfirmed: booleanOrEmpty,
  result: inspectionResult,
  remarks: string,
}).strict();

const ptResultsSchema = z.object({
  planned: z.object({
    penetrantType: string,
    removalMethod: string,
    sensitivityLevel: string,
    cleaningMethod: string,
    cleaningDetails: string,
    cleaningRestrictions: string,
    surfaceCondition: string,
    dryingMethod: string,
    dryingTime: numberOrEmpty,
    dryingTimeUnit: timeUnit,
    dryingTemperature: numberOrEmpty,
    dryingTemperatureUnit: temperatureUnit,
    penetrantApplicationMethod: string,
    dwellTime: numberOrEmpty,
    dwellTimeUnit: timeUnit,
    developmentTime: numberOrEmpty,
    developmentTimeUnit: timeUnit,
    partTemperatureMin: numberOrEmpty,
    partTemperatureMax: numberOrEmpty,
    partTemperatureUnit: temperatureUnit,
    penetrantTemperatureMin: numberOrEmpty,
    penetrantTemperatureMax: numberOrEmpty,
    penetrantTemperatureUnit: temperatureUnit,
    requiredUvAMin: numberOrEmpty,
    uvAUnit: string,
    ambientVisibleLightMax: numberOrEmpty,
    whiteLightMin: numberOrEmpty,
    visibleLightUnit: string,
    methodARinseInstructions: string,
    methodARinsePressureMin: numberOrEmpty,
    methodARinsePressureMax: numberOrEmpty,
    methodARinsePressureUnit: string,
    methodARinseTemperatureMin: numberOrEmpty,
    methodARinseTemperatureMax: numberOrEmpty,
    methodARinseTemperatureUnit: temperatureUnit,
    emulsifierType: string,
    emulsifierConcentration: numberOrEmpty,
    emulsifierConcentrationUnit: string,
    emulsifierContactTime: numberOrEmpty,
    emulsifierContactTimeUnit: timeUnit,
    emulsifierApplicationMethod: string,
    postEmulsifierRinseInstructions: string,
    methodCRemoverInstructions: string,
    methodDPreRinseInstructions: string,
    methodDFinalRinseInstructions: string,
    developerApplicationMethod: string,
    developerInstructions: string,
    darkAdaptationTime: numberOrEmpty,
    darkAdaptationTimeUnit: timeUnit,
  }).strict(),
  penetrantLot: string,
  penetrantExpiry: string,
  cleanerLot: string,
  removerLot: string,
  emulsifierLot: string,
  developerLot: string,
  actualCleaningMethod: string,
  actualCleaningDetails: string,
  actualSurfaceCondition: string,
  actualDryingMethod: string,
  actualDryingTime: numberOrEmpty,
  actualDryingTimeUnit: timeUnit,
  actualDryingTemperature: numberOrEmpty,
  actualDryingTemperatureUnit: temperatureUnit,
  actualPenetrantApplicationMethod: string,
  partTemperature: numberOrEmpty,
  penetrantTemperature: numberOrEmpty,
  temperatureUnit,
  actualDwellTime: numberOrEmpty,
  actualDwellTimeUnit: timeUnit,
  actualDevelopmentTime: numberOrEmpty,
  actualDevelopmentTimeUnit: timeUnit,
  actualMethodARinseDetails: string,
  actualMethodARinsePressure: numberOrEmpty,
  actualMethodARinsePressureUnit: string,
  actualMethodARinseTemperature: numberOrEmpty,
  actualMethodARinseTemperatureUnit: temperatureUnit,
  actualEmulsifierConcentration: numberOrEmpty,
  actualEmulsifierConcentrationUnit: string,
  actualEmulsifierContactTime: numberOrEmpty,
  actualEmulsifierContactTimeUnit: timeUnit,
  actualEmulsifierApplicationMethod: string,
  actualPostEmulsifierRinseDetails: string,
  actualMethodCRemovalDetails: string,
  actualMethodDPreRinseDetails: string,
  actualMethodDFinalRinseDetails: string,
  actualDeveloperApplicationMethod: string,
  actualDarkAdaptationTime: numberOrEmpty,
  actualDarkAdaptationTimeUnit: timeUnit,
  measuredUvA: numberOrEmpty,
  uvAUnit: string,
  measuredAmbientVisibleLight: numberOrEmpty,
  measuredWhiteLight: numberOrEmpty,
  visibleLightUnit: string,
  lightMeterId: string,
  examinationTime: string,
  postCleaningCompleted: booleanOrEmpty,
  coverageConfirmed: booleanOrEmpty,
}).strict();

export const rtPtInspectionReportSchema = z.discriminatedUnion('method', [
  z.object({ ...baseShape, method: z.literal('RT-Film'), results: z.array(filmResultSchema) }).strict(),
  z.object({ ...baseShape, method: z.literal('RT-Digital'), results: z.array(digitalResultSchema) }).strict(),
  z.object({ ...baseShape, method: z.literal('RT-CR'), results: z.array(crResultSchema) }).strict(),
  z.object({ ...baseShape, method: z.literal('PT'), results: ptResultsSchema }).strict(),
]);

export type RtPtInspectionReportDecodeResult =
  | { status: 'success'; report: RtPtInspectionReportV1 }
  | { status: 'invalid'; message: string };

const editableStatus = (value: unknown): value is 'draft' | 'in-review' => (
  value === 'draft' || value === 'in-review'
);

const defaultMissing = (
  record: Record<string, unknown>,
  key: string,
  fallback: unknown,
): Record<string, unknown> => (
  record[key] === undefined ? { ...record, [key]: fallback } : record
);

const normalizeEditableFilmResult = (value: unknown): unknown => {
  if (!isRecord(value)) return value;
  const planned = isRecord(value.planned) ? value.planned : null;
  let normalized = defaultMissing(value, 'actualSod', '');
  normalized = defaultMissing(normalized, 'actualSodUnit', planned?.sodUnit ?? 'mm');
  normalized = defaultMissing(normalized, 'actualOfd', '');
  normalized = defaultMissing(normalized, 'actualOfdUnit', planned?.ofdUnit ?? 'mm');
  normalized = defaultMissing(normalized, 'iqiRequirementMet', '');

  if (planned?.sourceType === 'X-ray') {
    return { ...normalized, actualSourceActivity: '', actualSourceActivityUnit: '' };
  }
  if (planned?.sourceType === 'Gamma') {
    return {
      ...normalized,
      actualTubeVoltage: '',
      actualTubeVoltageUnit: '',
      actualTubeCurrent: '',
      actualTubeCurrentUnit: '',
    };
  }
  return {
    ...normalized,
    actualTubeVoltage: '',
    actualTubeVoltageUnit: '',
    actualTubeCurrent: '',
    actualTubeCurrentUnit: '',
    actualSourceActivity: '',
    actualSourceActivityUnit: '',
  };
};

const normalizeEditableCrResult = (value: unknown): unknown => {
  if (!isRecord(value)) return value;
  const planned = isRecord(value.planned) ? value.planned : null;
  let normalized = defaultMissing(value, 'actualSod', '');
  normalized = defaultMissing(normalized, 'actualSodUnit', planned?.sodUnit ?? 'mm');
  normalized = defaultMissing(normalized, 'actualOfd', '');
  normalized = defaultMissing(normalized, 'actualOfdUnit', planned?.ofdUnit ?? 'mm');
  normalized = defaultMissing(normalized, 'scanDate', '');
  normalized = defaultMissing(normalized, 'iqiRequirementMet', '');
  normalized = defaultMissing(normalized, 'snrRequirementMet', '');

  if (planned?.sourceType === 'X-ray') {
    return { ...normalized, actualSourceActivity: '', actualSourceActivityUnit: '' };
  }
  if (planned?.sourceType === 'Gamma') {
    return {
      ...normalized,
      actualTubeVoltage: '',
      actualTubeVoltageUnit: '',
      actualTubeCurrent: '',
      actualTubeCurrentUnit: '',
    };
  }
  return {
    ...normalized,
    actualTubeVoltage: '',
    actualTubeVoltageUnit: '',
    actualTubeCurrent: '',
    actualTubeCurrentUnit: '',
    actualSourceActivity: '',
    actualSourceActivityUnit: '',
  };
};

const normalizeEditableDigitalResult = (value: unknown): unknown => {
  if (!isRecord(value)) return value;
  const plannedValue = isRecord(value.planned) ? value.planned : null;
  let planned = plannedValue;
  if (planned) {
    planned = defaultMissing(planned, 'requiredSnrOrNormalizedSnr', '');
    planned = defaultMissing(planned, 'requiredContrastSensitivityOrCnr', '');
  }
  let normalized = planned ? { ...value, planned } : value;
  normalized = defaultMissing(normalized, 'actualSod', '');
  normalized = defaultMissing(normalized, 'actualSodUnit', planned?.sodUnit ?? 'mm');
  normalized = defaultMissing(normalized, 'actualOdd', '');
  normalized = defaultMissing(normalized, 'actualOddUnit', planned?.oddUnit ?? 'mm');
  normalized = defaultMissing(normalized, 'iqiRequirementMet', '');
  normalized = defaultMissing(normalized, 'snrRequirementMet', '');
  return defaultMissing(normalized, 'cnrRequirementMet', '');
};

const normalizeEditablePtResults = (value: unknown): unknown => {
  if (!isRecord(value)) return value;
  const plannedValue = isRecord(value.planned) ? value.planned : null;
  let planned = plannedValue;
  if (planned) {
    const plannedDefaults: Array<[string, unknown]> = [
      ['cleaningMethod', ''],
      ['cleaningDetails', ''],
      ['cleaningRestrictions', ''],
      ['surfaceCondition', ''],
      ['dryingMethod', ''],
      ['dryingTime', ''],
      ['dryingTimeUnit', ''],
      ['dryingTemperature', ''],
      ['dryingTemperatureUnit', ''],
      ['penetrantApplicationMethod', ''],
      ['partTemperatureMin', ''],
      ['partTemperatureMax', ''],
      ['partTemperatureUnit', ''],
      ['penetrantTemperatureMin', ''],
      ['penetrantTemperatureMax', ''],
      ['penetrantTemperatureUnit', ''],
      ['methodARinseInstructions', ''],
      ['methodARinsePressureMin', ''],
      ['methodARinsePressureMax', ''],
      ['methodARinsePressureUnit', ''],
      ['methodARinseTemperatureMin', ''],
      ['methodARinseTemperatureMax', ''],
      ['methodARinseTemperatureUnit', ''],
      ['emulsifierType', ''],
      ['emulsifierConcentration', ''],
      ['emulsifierConcentrationUnit', ''],
      ['emulsifierContactTime', ''],
      ['emulsifierContactTimeUnit', ''],
      ['emulsifierApplicationMethod', ''],
      ['postEmulsifierRinseInstructions', ''],
      ['methodCRemoverInstructions', ''],
      ['methodDPreRinseInstructions', ''],
      ['methodDFinalRinseInstructions', ''],
      ['developerApplicationMethod', ''],
      ['developerInstructions', ''],
      ['darkAdaptationTime', ''],
      ['darkAdaptationTimeUnit', ''],
    ];
    plannedDefaults.forEach(([key, fallback]) => {
      planned = defaultMissing(planned as Record<string, unknown>, key, fallback);
    });
  }
  let normalized = planned ? { ...value, planned } : value;
  const performedDefaults: Array<[string, unknown]> = [
    ['actualCleaningMethod', ''],
    ['actualCleaningDetails', ''],
    ['actualSurfaceCondition', ''],
    ['actualDryingMethod', ''],
    ['actualDryingTime', ''],
    ['actualDryingTimeUnit', planned?.dryingTimeUnit ?? ''],
    ['actualDryingTemperature', ''],
    ['actualDryingTemperatureUnit', planned?.dryingTemperatureUnit ?? ''],
    ['actualPenetrantApplicationMethod', ''],
    ['actualMethodARinseDetails', ''],
    ['actualMethodARinsePressure', ''],
    ['actualMethodARinsePressureUnit', planned?.methodARinsePressureUnit ?? ''],
    ['actualMethodARinseTemperature', ''],
    ['actualMethodARinseTemperatureUnit', planned?.methodARinseTemperatureUnit ?? ''],
    ['actualEmulsifierConcentration', ''],
    ['actualEmulsifierConcentrationUnit', planned?.emulsifierConcentrationUnit ?? ''],
    ['actualEmulsifierContactTime', ''],
    ['actualEmulsifierContactTimeUnit', planned?.emulsifierContactTimeUnit ?? ''],
    ['actualEmulsifierApplicationMethod', ''],
    ['actualPostEmulsifierRinseDetails', ''],
    ['actualMethodCRemovalDetails', ''],
    ['actualMethodDPreRinseDetails', ''],
    ['actualMethodDFinalRinseDetails', ''],
    ['actualDeveloperApplicationMethod', ''],
    ['actualDarkAdaptationTime', ''],
    ['actualDarkAdaptationTimeUnit', planned?.darkAdaptationTimeUnit ?? ''],
  ];
  performedDefaults.forEach(([key, fallback]) => {
    normalized = defaultMissing(normalized, key, fallback);
  });

  const removalMethod = planned?.removalMethod;
  const clearMethodAPlan = (basis: Record<string, unknown>): Record<string, unknown> => ({
    ...basis,
    methodARinseInstructions: '',
    methodARinsePressureMin: '',
    methodARinsePressureMax: '',
    methodARinsePressureUnit: '',
    methodARinseTemperatureMin: '',
    methodARinseTemperatureMax: '',
    methodARinseTemperatureUnit: '',
  });
  const clearEmulsifierPlan = (basis: Record<string, unknown>): Record<string, unknown> => ({
    ...basis,
    emulsifierType: '',
    emulsifierConcentration: '',
    emulsifierConcentrationUnit: '',
    emulsifierContactTime: '',
    emulsifierContactTimeUnit: '',
    emulsifierApplicationMethod: '',
    postEmulsifierRinseInstructions: '',
  });
  const clearMethodDPlan = (basis: Record<string, unknown>): Record<string, unknown> => ({
    ...basis,
    methodDPreRinseInstructions: '',
    methodDFinalRinseInstructions: '',
  });
  const clearMethodAPerformed = (record: Record<string, unknown>): Record<string, unknown> => ({
    ...record,
    actualMethodARinseDetails: '',
    actualMethodARinsePressure: '',
    actualMethodARinsePressureUnit: '',
    actualMethodARinseTemperature: '',
    actualMethodARinseTemperatureUnit: '',
  });
  const clearEmulsifierPerformed = (record: Record<string, unknown>): Record<string, unknown> => ({
    ...record,
    actualEmulsifierConcentration: '',
    actualEmulsifierConcentrationUnit: '',
    actualEmulsifierContactTime: '',
    actualEmulsifierContactTimeUnit: '',
    actualEmulsifierApplicationMethod: '',
    actualPostEmulsifierRinseDetails: '',
  });
  const clearMethodDPerformed = (record: Record<string, unknown>): Record<string, unknown> => ({
    ...record,
    actualMethodDPreRinseDetails: '',
    actualMethodDFinalRinseDetails: '',
  });

  if (planned) {
    if (removalMethod === 'A') {
      planned = clearMethodDPlan(clearEmulsifierPlan({ ...planned, methodCRemoverInstructions: '' }));
      normalized = clearMethodDPerformed(clearEmulsifierPerformed({
        ...normalized,
        removerLot: '',
        emulsifierLot: '',
        actualMethodCRemovalDetails: '',
      }));
    } else if (removalMethod === 'B') {
      planned = clearMethodDPlan(clearMethodAPlan({
        ...planned,
        emulsifierConcentration: '',
        emulsifierConcentrationUnit: '',
        methodCRemoverInstructions: '',
      }));
      normalized = clearMethodDPerformed(clearMethodAPerformed({
        ...normalized,
        removerLot: '',
        actualEmulsifierConcentration: '',
        actualEmulsifierConcentrationUnit: '',
        actualMethodCRemovalDetails: '',
      }));
    } else if (removalMethod === 'C') {
      planned = clearMethodDPlan(clearEmulsifierPlan(clearMethodAPlan(planned)));
      normalized = clearMethodDPerformed(clearEmulsifierPerformed(clearMethodAPerformed({
        ...normalized,
        emulsifierLot: '',
      })));
    } else if (removalMethod === 'D') {
      planned = clearMethodAPlan({ ...planned, methodCRemoverInstructions: '' });
      normalized = clearMethodAPerformed({
        ...normalized,
        removerLot: '',
        actualMethodCRemovalDetails: '',
      });
    } else {
      planned = clearMethodDPlan(clearEmulsifierPlan(clearMethodAPlan({
        ...planned,
        methodCRemoverInstructions: '',
      })));
      normalized = clearMethodDPerformed(clearEmulsifierPerformed(clearMethodAPerformed({
        ...normalized,
        removerLot: '',
        emulsifierLot: '',
        actualMethodCRemovalDetails: '',
      })));
    }
    normalized = { ...normalized, planned };
  }

  if (planned?.penetrantType === 'Type I') {
    return {
      ...normalized,
      planned: { ...planned, whiteLightMin: '' },
      measuredWhiteLight: '',
    };
  }
  if (planned?.penetrantType === 'Type II') {
    return {
      ...normalized,
      planned: {
        ...planned,
        sensitivityLevel: '',
        requiredUvAMin: '',
        uvAUnit: '',
        ambientVisibleLightMax: '',
        darkAdaptationTime: '',
        darkAdaptationTimeUnit: '',
      },
      measuredUvA: '',
      measuredAmbientVisibleLight: '',
      uvAUnit: '',
      actualDarkAdaptationTime: '',
      actualDarkAdaptationTimeUnit: '',
    };
  }
  return {
    ...normalized,
    ...(planned ? {
      planned: {
        ...planned,
        sensitivityLevel: '',
        requiredUvAMin: '',
        uvAUnit: '',
        ambientVisibleLightMax: '',
        whiteLightMin: '',
        darkAdaptationTime: '',
        darkAdaptationTimeUnit: '',
      },
    } : {}),
    measuredUvA: '',
    measuredAmbientVisibleLight: '',
    measuredWhiteLight: '',
    uvAUnit: '',
    actualDarkAdaptationTime: '',
    actualDarkAdaptationTimeUnit: '',
  };
};

/**
 * Schema V1 gained frozen references and performed-result controls. Editable
 * records can be upgraded without asserting any new inspection outcome.
 * Finalized records are deliberately left byte-for-byte semantic so missing or
 * inactive data fails strict decoding and the storage layer preserves the raw
 * entry for recovery.
 */
const normalizeEditableInspectionReportInput = (value: unknown): unknown => {
  if (!isRecord(value) || !editableStatus(value.status)) return value;
  const sourceTechniqueValue = isRecord(value.sourceTechnique) ? value.sourceTechnique : null;
  const sourceTechnique = sourceTechniqueValue
    ? defaultMissing(sourceTechniqueValue, 'controlledReferences', [])
    : value.sourceTechnique;

  if (value.method === 'RT-Film' && Array.isArray(value.results)) {
    return {
      ...value,
      sourceTechnique,
      results: value.results.map(normalizeEditableFilmResult),
    };
  }
  if (value.method === 'RT-Digital' && Array.isArray(value.results)) {
    return {
      ...value,
      sourceTechnique,
      results: value.results.map(normalizeEditableDigitalResult),
    };
  }
  if (value.method === 'RT-CR' && Array.isArray(value.results)) {
    return {
      ...value,
      sourceTechnique,
      results: value.results.map(normalizeEditableCrResult),
    };
  }
  if (value.method === 'PT') {
    return {
      ...value,
      sourceTechnique,
      results: normalizeEditablePtResults(value.results),
    };
  }
  return { ...value, sourceTechnique };
};

const hasValue = (value: string | number): boolean => value !== '';

const hasInactivePerformedBranchData = (report: RtPtInspectionReportV1): boolean => {
  if (report.method === 'RT-Film') {
    return report.results.some((result) => {
      if (result.planned.sourceType === 'X-ray') {
        return hasValue(result.actualSourceActivity) || hasValue(result.actualSourceActivityUnit);
      }
      if (result.planned.sourceType === 'Gamma') {
        return hasValue(result.actualTubeVoltage)
          || hasValue(result.actualTubeVoltageUnit)
          || hasValue(result.actualTubeCurrent)
          || hasValue(result.actualTubeCurrentUnit);
      }
      return hasValue(result.actualTubeVoltage)
        || hasValue(result.actualTubeVoltageUnit)
        || hasValue(result.actualTubeCurrent)
        || hasValue(result.actualTubeCurrentUnit)
        || hasValue(result.actualSourceActivity)
        || hasValue(result.actualSourceActivityUnit);
    });
  }
  if (report.method === 'RT-Digital') return false;
  if (report.method === 'RT-CR') {
    return report.results.some((result) => {
      if (result.planned.sourceType === 'X-ray') {
        return hasValue(result.actualSourceActivity) || hasValue(result.actualSourceActivityUnit);
      }
      if (result.planned.sourceType === 'Gamma') {
        return hasValue(result.actualTubeVoltage)
          || hasValue(result.actualTubeVoltageUnit)
          || hasValue(result.actualTubeCurrent)
          || hasValue(result.actualTubeCurrentUnit);
      }
      return hasValue(result.actualTubeVoltage)
        || hasValue(result.actualTubeVoltageUnit)
        || hasValue(result.actualTubeCurrent)
        || hasValue(result.actualTubeCurrentUnit)
        || hasValue(result.actualSourceActivity)
        || hasValue(result.actualSourceActivityUnit);
    });
  }

  const { results } = report;
  const inactiveMethodAPlan = [
    results.planned.methodARinseInstructions,
    results.planned.methodARinsePressureMin,
    results.planned.methodARinsePressureMax,
    results.planned.methodARinsePressureUnit,
    results.planned.methodARinseTemperatureMin,
    results.planned.methodARinseTemperatureMax,
    results.planned.methodARinseTemperatureUnit,
  ].some(hasValue);
  const inactiveMethodAPerformed = [
    results.actualMethodARinseDetails,
    results.actualMethodARinsePressure,
    results.actualMethodARinsePressureUnit,
    results.actualMethodARinseTemperature,
    results.actualMethodARinseTemperatureUnit,
  ].some(hasValue);
  const inactiveEmulsifierPlan = [
    results.planned.emulsifierType,
    results.planned.emulsifierConcentration,
    results.planned.emulsifierConcentrationUnit,
    results.planned.emulsifierContactTime,
    results.planned.emulsifierContactTimeUnit,
    results.planned.emulsifierApplicationMethod,
    results.planned.postEmulsifierRinseInstructions,
  ].some(hasValue);
  const inactiveEmulsifierPerformed = [
    results.actualEmulsifierConcentration,
    results.actualEmulsifierConcentrationUnit,
    results.actualEmulsifierContactTime,
    results.actualEmulsifierContactTimeUnit,
    results.actualEmulsifierApplicationMethod,
    results.actualPostEmulsifierRinseDetails,
  ].some(hasValue);
  const inactiveMethodDPlan = [
    results.planned.methodDPreRinseInstructions,
    results.planned.methodDFinalRinseInstructions,
  ].some(hasValue);
  const inactiveMethodDPerformed = [
    results.actualMethodDPreRinseDetails,
    results.actualMethodDFinalRinseDetails,
  ].some(hasValue);
  let inactiveRemovalData: boolean;
  if (results.planned.removalMethod === 'A') {
    inactiveRemovalData = hasValue(results.removerLot)
      || hasValue(results.emulsifierLot)
      || inactiveEmulsifierPlan
      || inactiveEmulsifierPerformed
      || hasValue(results.planned.methodCRemoverInstructions)
      || hasValue(results.actualMethodCRemovalDetails)
      || inactiveMethodDPlan
      || inactiveMethodDPerformed;
  } else if (results.planned.removalMethod === 'B') {
    inactiveRemovalData = hasValue(results.removerLot)
      || inactiveMethodAPlan
      || inactiveMethodAPerformed
      || hasValue(results.planned.emulsifierConcentration)
      || hasValue(results.planned.emulsifierConcentrationUnit)
      || hasValue(results.actualEmulsifierConcentration)
      || hasValue(results.actualEmulsifierConcentrationUnit)
      || hasValue(results.planned.methodCRemoverInstructions)
      || hasValue(results.actualMethodCRemovalDetails)
      || inactiveMethodDPlan
      || inactiveMethodDPerformed;
  } else if (results.planned.removalMethod === 'C') {
    inactiveRemovalData = hasValue(results.emulsifierLot)
      || inactiveMethodAPlan
      || inactiveMethodAPerformed
      || inactiveEmulsifierPlan
      || inactiveEmulsifierPerformed
      || inactiveMethodDPlan
      || inactiveMethodDPerformed;
  } else if (results.planned.removalMethod === 'D') {
    inactiveRemovalData = hasValue(results.removerLot)
      || inactiveMethodAPlan
      || inactiveMethodAPerformed
      || hasValue(results.planned.methodCRemoverInstructions)
      || hasValue(results.actualMethodCRemovalDetails);
  } else {
    inactiveRemovalData = hasValue(results.removerLot)
      || hasValue(results.emulsifierLot)
      || inactiveMethodAPlan
      || inactiveMethodAPerformed
      || inactiveEmulsifierPlan
      || inactiveEmulsifierPerformed
      || hasValue(results.planned.methodCRemoverInstructions)
      || hasValue(results.actualMethodCRemovalDetails)
      || inactiveMethodDPlan
      || inactiveMethodDPerformed;
  }
  const inactiveLightingData = results.planned.penetrantType === 'Type I'
    ? hasValue(results.planned.whiteLightMin) || hasValue(results.measuredWhiteLight)
    : results.planned.penetrantType === 'Type II'
      ? hasValue(results.planned.sensitivityLevel)
        || hasValue(results.planned.requiredUvAMin)
        || hasValue(results.planned.uvAUnit)
        || hasValue(results.planned.ambientVisibleLightMax)
        || hasValue(results.planned.darkAdaptationTime)
        || hasValue(results.planned.darkAdaptationTimeUnit)
        || hasValue(results.measuredUvA)
        || hasValue(results.measuredAmbientVisibleLight)
        || hasValue(results.uvAUnit)
        || hasValue(results.actualDarkAdaptationTime)
        || hasValue(results.actualDarkAdaptationTimeUnit)
      : hasValue(results.planned.sensitivityLevel)
        || hasValue(results.planned.requiredUvAMin)
        || hasValue(results.planned.uvAUnit)
        || hasValue(results.planned.ambientVisibleLightMax)
        || hasValue(results.planned.whiteLightMin)
        || hasValue(results.planned.darkAdaptationTime)
        || hasValue(results.planned.darkAdaptationTimeUnit)
        || hasValue(results.measuredUvA)
        || hasValue(results.measuredAmbientVisibleLight)
        || hasValue(results.measuredWhiteLight)
        || hasValue(results.uvAUnit)
        || hasValue(results.actualDarkAdaptationTime)
        || hasValue(results.actualDarkAdaptationTimeUnit);
  return inactiveRemovalData || inactiveLightingData;
};

const createId = (prefix: string): string => {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return `${prefix}-${globalThis.crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
};

const today = (): string => new Date().toISOString().slice(0, 10);

export const createRtPtInspectionReportId = (): string => createId('rtpt-report');
export const createRtPtIndicationId = (): string => createId('indication');

const sourceApprovalDate = (document: RtPtDocumentV3): string => (
  document.approvals.find((approval) => approval.role === 'ndt-level-3')?.date ?? ''
);

const commonBase = (
  document: RtPtDocumentV3,
  profile?: InspectorProfile | null,
): Omit<RtPtInspectionReportV1, 'method' | 'results'> => ({
  documentKind: RT_PT_INSPECTION_REPORT_KIND,
  schemaVersion: RT_PT_INSPECTION_REPORT_VERSION,
  documentType: RT_PT_INSPECTION_REPORT_TYPE,
  reportId: createRtPtInspectionReportId(),
  status: 'draft',
  approvalFingerprint: '',
  sourceTechnique: {
    documentId: document.documentId,
    documentNumber: document.documentControl.number,
    title: document.documentControl.title,
    revision: document.documentControl.revision,
    method: document.method,
    approvedContentFingerprint: fingerprintRtPtApprovedContent(document),
    approvalDate: sourceApprovalDate(document),
    controlledReferences: document.controlledReferences.map((reference) => ({ ...reference })),
  },
  reportControl: {
    number: '',
    title: `${document.technique.general.partName || document.technique.general.partNumber || 'NDT'} Inspection Report`,
    revision: '',
    reportDate: today(),
    inspectionStart: '',
    inspectionEnd: '',
  },
  organization: { ...document.organization },
  job: { ...document.job },
  part: {
    partName: document.technique.general.partName,
    partNumber: document.technique.general.partNumber,
    partRevisionOrConfiguration: document.technique.general.partRevisionOrConfiguration,
    serialOrLotNumber: '',
    quantity: '',
    material: document.technique.general.material,
    inspectionArea: document.technique.general.inspectionArea,
    workOrder: document.job.workOrder,
  },
  equipment: {
    equipmentUsed: '',
    calibrationReferences: '',
    environmentalConditions: '',
    deviations: '',
  },
  indications: [],
  overallDisposition: '',
  dispositionReference: '',
  coverageStatement: '',
  remarks: '',
  approvals: profile
    ? [{
        role: 'performed',
        name: profile.name,
        personnelId: profile.employeeId || profile.certificationNumber,
        certificationLevel: profile.certificationLevel,
        certificationNumber: profile.certificationNumber,
        certificationBasis: profile.certifyingOrganization,
        date: today(),
      }]
    : [],
});

export function createRtPtInspectionReport(
  document: RtPtDocumentV3,
  profile?: InspectorProfile | null,
): RtPtInspectionReportV1 {
  const base = commonBase(document, profile);
  if (document.method === 'RT-Film') {
    return {
      ...base,
      method: 'RT-Film',
      sourceTechnique: { ...base.sourceTechnique, method: 'RT-Film' },
      results: document.technique.exposureViews.map((view) => ({
        id: createId('film-result'),
        plannedItemId: view.id,
        planned: {
          viewId: view.viewId,
          description: view.description,
          orientation: view.orientation,
          inspectionZone: view.inspectionZone,
          referenceAttachmentId: view.referenceAttachmentId,
          wallTechnique: view.wallTechnique,
          sourceType: document.technique.source.sourceType,
          sfd: view.sfd,
          sfdUnit: view.sfdUnit,
          sod: view.sod,
          sodUnit: view.sodUnit,
          ofd: view.ofd,
          ofdUnit: view.ofdUnit,
          tubeVoltage: document.technique.source.sourceType === 'X-ray' ? view.tubeVoltage : '',
          tubeVoltageUnit: view.tubeVoltageUnit,
          tubeCurrent: document.technique.source.sourceType === 'X-ray' ? view.tubeCurrent : '',
          tubeCurrentUnit: view.tubeCurrentUnit,
          exposureTime: view.exposureTime,
          exposureTimeUnit: view.exposureTimeUnit,
          filmDesignation: view.filmDesignation || document.technique.filmSystem.filmDesignation,
          iqiRequirement: view.iqiOverride || document.technique.iqi.designation,
          densityMinimum: document.technique.filmSystem.requiredDensityMin,
          densityMaximum: document.technique.filmSystem.requiredDensityMax,
        },
        filmId: '',
        retakeOfFilmId: '',
        exposureDate: '',
        actualSfd: '',
        actualSfdUnit: view.sfdUnit,
        actualSod: '',
        actualSodUnit: view.sodUnit,
        actualOfd: '',
        actualOfdUnit: view.ofdUnit,
        actualTubeVoltage: '',
        actualTubeVoltageUnit: document.technique.source.sourceType === 'X-ray' ? view.tubeVoltageUnit : '',
        actualTubeCurrent: '',
        actualTubeCurrentUnit: document.technique.source.sourceType === 'X-ray' ? view.tubeCurrentUnit : '',
        actualSourceActivity: '',
        actualSourceActivityUnit: document.technique.source.sourceType === 'Gamma'
          ? document.technique.source.gamma.activityUnit
          : '',
        actualExposureTime: '',
        actualExposureTimeUnit: view.exposureTimeUnit,
        densityMinimum: '',
        densityMaximum: '',
        iqiObserved: '',
        iqiRequirementMet: '',
        coverageConfirmed: '',
        result: '',
        remarks: '',
      })),
    };
  }
  if (document.method === 'RT-Digital') {
    return {
      ...base,
      method: 'RT-Digital',
      sourceTechnique: { ...base.sourceTechnique, method: 'RT-Digital' },
      results: document.technique.acquisitions.map((item) => ({
        id: createId('digital-result'),
        plannedItemId: item.id,
        planned: {
          viewId: item.viewId,
          description: item.description,
          orientation: item.orientation,
          inspectionZone: item.inspectionZone,
          referenceAttachmentId: item.referenceAttachmentId,
          wallTechnique: item.wallTechnique,
          sdd: item.sdd,
          sddUnit: item.sddUnit,
          sod: item.sod,
          sodUnit: item.sodUnit,
          odd: item.odd,
          oddUnit: item.oddUnit,
          tubeVoltage: item.tubeVoltage,
          tubeVoltageUnit: item.tubeVoltageUnit,
          tubeCurrent: item.tubeCurrent,
          tubeCurrentUnit: item.tubeCurrentUnit,
          exposureTime: item.exposureTime,
          exposureTimeUnit: item.exposureTimeUnit,
          integrationTime: item.integrationTime,
          integrationTimeUnit: item.integrationTimeUnit,
          framesAveraged: item.framesAveraged,
          imageNaming: item.imageNaming,
          iqiRequirement: item.iqiOverride || document.technique.iqi.designation,
          requiredSnrOrNormalizedSnr: document.technique.iqi.requiredSnrOrNormalizedSnr,
          requiredContrastSensitivityOrCnr: document.technique.iqi.requiredContrastSensitivityOrCnr,
        },
        imageId: '',
        retakeOfImageId: '',
        acquisitionDate: '',
        actualSdd: '',
        actualSddUnit: item.sddUnit,
        actualSod: '',
        actualSodUnit: item.sodUnit,
        actualOdd: '',
        actualOddUnit: item.oddUnit,
        actualTubeVoltage: '',
        actualTubeVoltageUnit: item.tubeVoltageUnit,
        actualTubeCurrent: '',
        actualTubeCurrentUnit: item.tubeCurrentUnit,
        actualExposureTime: '',
        actualExposureTimeUnit: item.exposureTimeUnit,
        actualIntegrationTime: '',
        actualIntegrationTimeUnit: item.integrationTimeUnit,
        actualFramesAveraged: '',
        achievedSnr: '',
        achievedCnr: '',
        iqiObserved: '',
        iqiRequirementMet: '',
        snrRequirementMet: '',
        cnrRequirementMet: '',
        detectorControlReference: '',
        archiveReference: '',
        coverageConfirmed: '',
        result: '',
        remarks: '',
      })),
    };
  }
  if (document.method === 'RT-CR') {
    return {
      ...base,
      method: 'RT-CR',
      sourceTechnique: { ...base.sourceTechnique, method: 'RT-CR' },
      results: document.technique.exposureViews.map((view) => ({
        id: createId('cr-result'),
        plannedItemId: view.id,
        planned: {
          viewId: view.viewId,
          description: view.description,
          orientation: view.orientation,
          inspectionZone: view.inspectionZone,
          referenceAttachmentId: view.referenceAttachmentId,
          wallTechnique: view.wallTechnique,
          sourceType: document.technique.source.sourceType,
          sfd: view.sfd,
          sfdUnit: view.sfdUnit,
          sod: view.sod,
          sodUnit: view.sodUnit,
          ofd: view.ofd,
          ofdUnit: view.ofdUnit,
          tubeVoltage: document.technique.source.sourceType === 'X-ray' ? view.tubeVoltage : '',
          tubeVoltageUnit: view.tubeVoltageUnit,
          tubeCurrent: document.technique.source.sourceType === 'X-ray' ? view.tubeCurrent : '',
          tubeCurrentUnit: view.tubeCurrentUnit,
          exposureTime: view.exposureTime,
          exposureTimeUnit: view.exposureTimeUnit,
          plateDesignation: document.technique.plateSystem.plateDesignation,
          iqiRequirement: view.iqiOverride || document.technique.iqi.designation,
          greyValueMin: document.technique.imageQuality.greyValueMin,
          greyValueMax: document.technique.imageQuality.greyValueMax,
          requiredSnrMin: document.technique.imageQuality.requiredSnrMin,
        },
        plateOrImageId: '',
        retakeOfImageId: '',
        exposureDate: '',
        scanDate: '',
        actualSfd: '',
        actualSfdUnit: view.sfdUnit,
        actualSod: '',
        actualSodUnit: view.sodUnit,
        actualOfd: '',
        actualOfdUnit: view.ofdUnit,
        actualTubeVoltage: '',
        actualTubeVoltageUnit: document.technique.source.sourceType === 'X-ray' ? view.tubeVoltageUnit : '',
        actualTubeCurrent: '',
        actualTubeCurrentUnit: document.technique.source.sourceType === 'X-ray' ? view.tubeCurrentUnit : '',
        actualSourceActivity: '',
        actualSourceActivityUnit: document.technique.source.sourceType === 'Gamma'
          ? document.technique.source.gamma.activityUnit
          : '',
        actualExposureTime: '',
        actualExposureTimeUnit: view.exposureTimeUnit,
        greyValueMin: '',
        greyValueMax: '',
        achievedSnr: '',
        achievedSrb: '',
        snrRequirementMet: '',
        iqiObserved: '',
        iqiRequirementMet: '',
        coverageConfirmed: '',
        result: '',
        remarks: '',
      })),
    };
  }
  return {
    ...base,
    method: 'PT',
    sourceTechnique: { ...base.sourceTechnique, method: 'PT' },
    results: {
      planned: {
        penetrantType: document.technique.materials.penetrantType,
        removalMethod: document.technique.materials.method,
        sensitivityLevel: document.technique.materials.sensitivityLevel,
        cleaningMethod: document.technique.surfacePrep.cleaningMethod,
        cleaningDetails: document.technique.surfacePrep.cleaningDetails,
        cleaningRestrictions: document.technique.surfacePrep.cleaningRestrictions,
        surfaceCondition: document.technique.surfacePrep.surfaceCondition,
        dryingMethod: document.technique.surfacePrep.dryingMethod,
        dryingTime: document.technique.surfacePrep.dryingTime,
        dryingTimeUnit: document.technique.surfacePrep.dryingTimeUnit,
        dryingTemperature: document.technique.surfacePrep.dryingTemperature,
        dryingTemperatureUnit: document.technique.surfacePrep.dryingTemperatureUnit,
        penetrantApplicationMethod: document.technique.application.applicationMethod,
        dwellTime: document.technique.application.dwellTime,
        dwellTimeUnit: document.technique.application.dwellTimeUnit,
        developmentTime: document.technique.development.developmentTime,
        developmentTimeUnit: document.technique.development.developmentTimeUnit,
        partTemperatureMin: document.technique.application.partTemperatureMin,
        partTemperatureMax: document.technique.application.partTemperatureMax,
        partTemperatureUnit: document.technique.application.partTemperatureUnit,
        penetrantTemperatureMin: document.technique.application.penetrantTemperatureMin,
        penetrantTemperatureMax: document.technique.application.penetrantTemperatureMax,
        penetrantTemperatureUnit: document.technique.application.penetrantTemperatureUnit,
        requiredUvAMin: document.technique.conditions.requiredUvAMin,
        uvAUnit: document.technique.conditions.uvAUnit,
        ambientVisibleLightMax: document.technique.conditions.ambientVisibleLightMax,
        whiteLightMin: document.technique.conditions.whiteLightMin,
        visibleLightUnit: document.technique.conditions.visibleLightUnit,
        methodARinseInstructions: document.technique.materials.method === 'A'
          ? document.technique.removal.methodA.instructions
          : '',
        methodARinsePressureMin: document.technique.materials.method === 'A'
          ? document.technique.removal.methodA.pressureMin
          : '',
        methodARinsePressureMax: document.technique.materials.method === 'A'
          ? document.technique.removal.methodA.pressureMax
          : '',
        methodARinsePressureUnit: document.technique.materials.method === 'A'
          ? document.technique.removal.methodA.pressureUnit
          : '',
        methodARinseTemperatureMin: document.technique.materials.method === 'A'
          ? document.technique.removal.methodA.temperatureMin
          : '',
        methodARinseTemperatureMax: document.technique.materials.method === 'A'
          ? document.technique.removal.methodA.temperatureMax
          : '',
        methodARinseTemperatureUnit: document.technique.materials.method === 'A'
          ? document.technique.removal.methodA.temperatureUnit
          : '',
        emulsifierType: document.technique.materials.method === 'B' || document.technique.materials.method === 'D'
          ? document.technique.removal.methodBD.type
          : '',
        emulsifierConcentration: document.technique.materials.method === 'D'
          ? document.technique.removal.methodBD.concentration
          : '',
        emulsifierConcentrationUnit: document.technique.materials.method === 'D'
          ? document.technique.removal.methodBD.concentrationUnit
          : '',
        emulsifierContactTime: document.technique.materials.method === 'B' || document.technique.materials.method === 'D'
          ? document.technique.removal.methodBD.contactTime
          : '',
        emulsifierContactTimeUnit: document.technique.materials.method === 'B' || document.technique.materials.method === 'D'
          ? document.technique.removal.methodBD.contactTimeUnit
          : '',
        emulsifierApplicationMethod: document.technique.materials.method === 'B' || document.technique.materials.method === 'D'
          ? document.technique.removal.methodBD.applicationMethod
          : '',
        postEmulsifierRinseInstructions: document.technique.materials.method === 'B' || document.technique.materials.method === 'D'
          ? document.technique.removal.methodBD.postEmulsifierRinseInstructions
          : '',
        methodCRemoverInstructions: document.technique.materials.method === 'C'
          ? document.technique.removal.methodC.removerInstructions
          : '',
        methodDPreRinseInstructions: document.technique.materials.method === 'D'
          ? document.technique.removal.methodD.preRinseInstructions
          : '',
        methodDFinalRinseInstructions: document.technique.materials.method === 'D'
          ? document.technique.removal.methodD.finalRinseInstructions
          : '',
        developerApplicationMethod: document.technique.development.developerApplication,
        developerInstructions: document.technique.development.instructions,
        darkAdaptationTime: document.technique.materials.penetrantType === 'Type I'
          ? document.technique.conditions.darkAdaptationTime
          : '',
        darkAdaptationTimeUnit: document.technique.materials.penetrantType === 'Type I'
          ? document.technique.conditions.darkAdaptationTimeUnit
          : '',
      },
      penetrantLot: '',
      penetrantExpiry: '',
      cleanerLot: '',
      removerLot: '',
      emulsifierLot: '',
      developerLot: '',
      actualCleaningMethod: '',
      actualCleaningDetails: '',
      actualSurfaceCondition: '',
      actualDryingMethod: '',
      actualDryingTime: '',
      actualDryingTimeUnit: document.technique.surfacePrep.dryingTimeUnit,
      actualDryingTemperature: '',
      actualDryingTemperatureUnit: document.technique.surfacePrep.dryingTemperatureUnit,
      actualPenetrantApplicationMethod: '',
      partTemperature: '',
      penetrantTemperature: '',
      temperatureUnit: document.technique.application.partTemperatureUnit,
      actualDwellTime: '',
      actualDwellTimeUnit: document.technique.application.dwellTimeUnit,
      actualDevelopmentTime: '',
      actualDevelopmentTimeUnit: document.technique.development.developmentTimeUnit,
      actualMethodARinseDetails: '',
      actualMethodARinsePressure: '',
      actualMethodARinsePressureUnit: document.technique.materials.method === 'A'
        ? document.technique.removal.methodA.pressureUnit
        : '',
      actualMethodARinseTemperature: '',
      actualMethodARinseTemperatureUnit: document.technique.materials.method === 'A'
        ? document.technique.removal.methodA.temperatureUnit
        : '',
      actualEmulsifierConcentration: '',
      actualEmulsifierConcentrationUnit: document.technique.materials.method === 'D'
        ? document.technique.removal.methodBD.concentrationUnit
        : '',
      actualEmulsifierContactTime: '',
      actualEmulsifierContactTimeUnit: document.technique.materials.method === 'B' || document.technique.materials.method === 'D'
        ? document.technique.removal.methodBD.contactTimeUnit
        : '',
      actualEmulsifierApplicationMethod: '',
      actualPostEmulsifierRinseDetails: '',
      actualMethodCRemovalDetails: '',
      actualMethodDPreRinseDetails: '',
      actualMethodDFinalRinseDetails: '',
      actualDeveloperApplicationMethod: '',
      actualDarkAdaptationTime: '',
      actualDarkAdaptationTimeUnit: document.technique.materials.penetrantType === 'Type I'
        ? document.technique.conditions.darkAdaptationTimeUnit
        : '',
      measuredUvA: '',
      uvAUnit: document.technique.materials.penetrantType === 'Type I'
        ? document.technique.conditions.uvAUnit
        : '',
      measuredAmbientVisibleLight: '',
      measuredWhiteLight: '',
      visibleLightUnit: document.technique.conditions.visibleLightUnit,
      lightMeterId: '',
      examinationTime: '',
      postCleaningCompleted: '',
      coverageConfirmed: '',
    },
  };
}

export function decodeRtPtInspectionReport(value: unknown): RtPtInspectionReportDecodeResult {
  const normalized = normalizeEditableInspectionReportInput(value);
  const parsed = rtPtInspectionReportSchema.safeParse(normalized);
  if (!parsed.success) {
    return { status: 'invalid', message: 'The inspection report draft is invalid or uses an unsupported schema.' };
  }
  const report = parsed.data as RtPtInspectionReportV1;
  if ((report.status === 'approved' || report.status === 'superseded')
    && hasInactivePerformedBranchData(report)) {
    return {
      status: 'invalid',
      message: 'The finalized inspection report contains inactive planned or performed branch data and cannot be released.',
    };
  }
  if ((report.status === 'approved' || report.status === 'superseded')
    && !hasValidRtPtInspectionReportFingerprint(report)) {
    return {
      status: 'invalid',
      message: 'The finalized inspection report has a missing, malformed, or mismatched approval fingerprint.',
    };
  }
  return { status: 'success', report };
}

export const inspectionReportStorageKey = (techniqueDocumentId: string): string => (
  `${RT_PT_INSPECTION_REPORT_STORAGE_PREFIX}${techniqueDocumentId}`
);

const inspectionReportCollectionPrefix = (techniqueDocumentId: string): string => (
  `${RT_PT_INSPECTION_REPORT_STORAGE_PREFIX}${encodeURIComponent(techniqueDocumentId)}:`
);

const inspectionReportRecordPrefix = (techniqueDocumentId: string): string => (
  `${inspectionReportCollectionPrefix(techniqueDocumentId)}report:`
);

export const inspectionReportRecordStorageKey = (
  techniqueDocumentId: string,
  reportId: string,
): string => `${inspectionReportRecordPrefix(techniqueDocumentId)}${encodeURIComponent(reportId)}`;

export const inspectionReportActiveStorageKey = (techniqueDocumentId: string): string => (
  `${inspectionReportCollectionPrefix(techniqueDocumentId)}active`
);

export type RtPtInspectionReportStorageIssueCode =
  | 'storage-unavailable'
  | 'storage-read-failed'
  | 'storage-write-failed'
  | 'invalid-json'
  | 'invalid-report'
  | 'unsupported-schema'
  | 'technique-mismatch'
  | 'report-id-mismatch'
  | 'legacy-migration-conflict'
  | 'active-report-unavailable'
  | 'method-mismatch'
  | 'approval-binding-invalid';

export interface RtPtInspectionReportStorageIssue {
  code: RtPtInspectionReportStorageIssueCode;
  message: string;
  storageKey?: string;
  reportId?: string;
  recoverable: true;
}

export interface RtPtInspectionReportSummary {
  reportId: string;
  method: RtPtInspectionReportV1['method'];
  status: RtPtInspectionReportV1['status'];
  reportNumber: string;
  title: string;
  revision: string;
  reportDate: string;
  inspectionStart: string;
  inspectionEnd: string;
  sourceTechniqueNumber: string;
  sourceTechniqueRevision: string;
  isActive: boolean;
}

export interface RtPtInspectionReportCollection {
  reports: RtPtInspectionReportV1[];
  history: RtPtInspectionReportSummary[];
  activeReportId: string | null;
  activeReport: RtPtInspectionReportV1 | null;
  storedActiveReportId: string | null;
  issues: RtPtInspectionReportStorageIssue[];
}

export interface RtPtInspectionReportLoadResult {
  report: RtPtInspectionReportV1 | null;
  collection: RtPtInspectionReportCollection;
}

export class RtPtInspectionReportPersistenceError extends Error {
  readonly issue: RtPtInspectionReportStorageIssue;

  constructor(issue: RtPtInspectionReportStorageIssue) {
    super(issue.message);
    this.name = 'RtPtInspectionReportPersistenceError';
    this.issue = issue;
  }
}

const storageIssue = (
  code: RtPtInspectionReportStorageIssueCode,
  message: string,
  details: Pick<RtPtInspectionReportStorageIssue, 'storageKey' | 'reportId'> = {},
): RtPtInspectionReportStorageIssue => ({ code, message, recoverable: true, ...details });

const getLocalStorage = (): Storage | null => {
  if (typeof window === 'undefined') return null;
  return window.localStorage;
};

type StoredReportDecodeResult =
  | { status: 'success'; report: RtPtInspectionReportV1; migrated: boolean }
  | { status: 'error'; issue: RtPtInspectionReportStorageIssue };

const decodeStoredReport = (
  raw: string,
  storageKey: string,
  techniqueDocumentId: string,
  expectedReportId?: string,
): StoredReportDecodeResult => {
  let value: unknown;
  try {
    value = JSON.parse(raw) as unknown;
  } catch {
    return {
      status: 'error',
      issue: storageIssue(
        'invalid-json',
        'A stored inspection report contains invalid JSON. Its raw local entry was preserved for recovery.',
        { storageKey, reportId: expectedReportId },
      ),
    };
  }

  const decoded = decodeRtPtInspectionReport(value);
  if (decoded.status !== 'success') {
    const storedVersion = isRecord(value) ? value.schemaVersion : undefined;
    const newerSchema = typeof storedVersion === 'number' && storedVersion > RT_PT_INSPECTION_REPORT_VERSION;
    return {
      status: 'error',
      issue: storageIssue(
        newerSchema ? 'unsupported-schema' : 'invalid-report',
        newerSchema
          ? `A stored inspection report uses unsupported schema version ${storedVersion}. Its raw local entry was preserved for recovery.`
          : 'A stored inspection report is invalid or incomplete. Its raw local entry was preserved for recovery.',
        { storageKey, reportId: expectedReportId },
      ),
    };
  }

  const report = decoded.report;
  if (!report.reportId || (expectedReportId !== undefined && report.reportId !== expectedReportId)) {
    return {
      status: 'error',
      issue: storageIssue(
        'report-id-mismatch',
        'A stored inspection report does not match its report identifier. Its raw local entry was preserved for recovery.',
        { storageKey, reportId: expectedReportId || report.reportId },
      ),
    };
  }
  if (report.sourceTechnique.documentId !== techniqueDocumentId) {
    return {
      status: 'error',
      issue: storageIssue(
        'technique-mismatch',
        'A stored inspection report belongs to a different technique document. Its raw local entry was preserved for recovery.',
        { storageKey, reportId: report.reportId },
      ),
    };
  }
  if (report.sourceTechnique.method !== report.method) {
    return {
      status: 'error',
      issue: storageIssue(
        'method-mismatch',
        'A stored inspection report has inconsistent method linkage. Its raw local entry was preserved for recovery.',
        { storageKey, reportId: report.reportId },
      ),
    };
  }
  return {
    status: 'success',
    report,
    migrated: editableStatus(report.status) && JSON.stringify(report) !== JSON.stringify(value),
  };
};

const canonicalReport = (report: RtPtInspectionReportV1): string => JSON.stringify(report);

const canonicalReportWithoutStatus = (report: RtPtInspectionReportV1): string => {
  const { status: _status, ...content } = report;
  return JSON.stringify(content);
};

const migrateLegacyInspectionReport = (
  storage: Storage,
  techniqueDocumentId: string,
): RtPtInspectionReportStorageIssue[] => {
  const legacyKey = inspectionReportStorageKey(techniqueDocumentId);
  let raw: string | null;
  try {
    raw = storage.getItem(legacyKey);
  } catch {
    return [storageIssue(
      'storage-read-failed',
      'The legacy inspection-report entry could not be read. It was not modified.',
      { storageKey: legacyKey },
    )];
  }
  if (raw === null) return [];

  const decodedLegacy = decodeStoredReport(raw, legacyKey, techniqueDocumentId);
  if (decodedLegacy.status !== 'success') return [decodedLegacy.issue];

  const report = decodedLegacy.report;
  const recordKey = inspectionReportRecordStorageKey(techniqueDocumentId, report.reportId);
  try {
    const existingRaw = storage.getItem(recordKey);
    if (existingRaw !== null) {
      const decodedExisting = decodeStoredReport(existingRaw, recordKey, techniqueDocumentId, report.reportId);
      if (decodedExisting.status !== 'success') {
        return [
          decodedExisting.issue,
          storageIssue(
            'legacy-migration-conflict',
            'The valid legacy report conflicts with an unreadable history entry. Both raw entries were preserved.',
            { storageKey: legacyKey, reportId: report.reportId },
          ),
        ];
      }
      if (canonicalReport(decodedExisting.report) !== canonicalReport(report)) {
        return [storageIssue(
          'legacy-migration-conflict',
          'The legacy report conflicts with a different report using the same identifier. Both raw entries were preserved.',
          { storageKey: legacyKey, reportId: report.reportId },
        )];
      }
    } else {
      storage.setItem(
        recordKey,
        decodedLegacy.migrated ? JSON.stringify(report) : raw,
      );
    }

    const activeKey = inspectionReportActiveStorageKey(techniqueDocumentId);
    if (storage.getItem(activeKey) === null) storage.setItem(activeKey, report.reportId);
    storage.removeItem(legacyKey);
    return [];
  } catch {
    return [storageIssue(
      'storage-write-failed',
      'The legacy inspection report could not be migrated safely. Its original raw entry was preserved.',
      { storageKey: legacyKey, reportId: report.reportId },
    )];
  }
};

export const summarizeRtPtInspectionReport = (
  report: RtPtInspectionReportV1,
  isActive = false,
): RtPtInspectionReportSummary => ({
  reportId: report.reportId,
  method: report.method,
  status: report.status,
  reportNumber: report.reportControl.number,
  title: report.reportControl.title,
  revision: report.reportControl.revision,
  reportDate: report.reportControl.reportDate,
  inspectionStart: report.reportControl.inspectionStart,
  inspectionEnd: report.reportControl.inspectionEnd,
  sourceTechniqueNumber: report.sourceTechnique.documentNumber,
  sourceTechniqueRevision: report.sourceTechnique.revision,
  isActive,
});

const compareReportsNewestFirst = (left: RtPtInspectionReportV1, right: RtPtInspectionReportV1): number => {
  const leftDate = left.reportControl.inspectionEnd || left.reportControl.reportDate || left.reportControl.inspectionStart;
  const rightDate = right.reportControl.inspectionEnd || right.reportControl.reportDate || right.reportControl.inspectionStart;
  return rightDate.localeCompare(leftDate)
    || right.reportControl.number.localeCompare(left.reportControl.number)
    || right.reportId.localeCompare(left.reportId);
};

const emptyCollection = (issues: RtPtInspectionReportStorageIssue[] = []): RtPtInspectionReportCollection => ({
  reports: [],
  history: [],
  activeReportId: null,
  activeReport: null,
  storedActiveReportId: null,
  issues,
});

export function listRtPtInspectionReports(techniqueDocumentId: string): RtPtInspectionReportCollection {
  let storage: Storage | null;
  try {
    storage = getLocalStorage();
  } catch {
    return emptyCollection([storageIssue(
      'storage-unavailable',
      'Local inspection-report storage is unavailable. No stored data was modified.',
    )]);
  }
  if (!storage) return emptyCollection();

  const issues = migrateLegacyInspectionReport(storage, techniqueDocumentId);
  const recordPrefix = inspectionReportRecordPrefix(techniqueDocumentId);
  const reportById = new Map<string, RtPtInspectionReportV1>();
  let storedActiveReportId: string | null = null;

  try {
    storedActiveReportId = storage.getItem(inspectionReportActiveStorageKey(techniqueDocumentId));
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);
      if (!key?.startsWith(recordPrefix)) continue;
      const encodedReportId = key.slice(recordPrefix.length);
      let expectedReportId: string;
      try {
        expectedReportId = decodeURIComponent(encodedReportId);
      } catch {
        issues.push(storageIssue(
          'report-id-mismatch',
          'A stored inspection-report key has an invalid identifier. Its raw local entry was preserved for recovery.',
          { storageKey: key },
        ));
        continue;
      }
      if (!expectedReportId || inspectionReportRecordStorageKey(techniqueDocumentId, expectedReportId) !== key) {
        issues.push(storageIssue(
          'report-id-mismatch',
          'A stored inspection-report key is not canonical. Its raw local entry was preserved for recovery.',
          { storageKey: key, reportId: expectedReportId },
        ));
        continue;
      }
      const raw = storage.getItem(key);
      if (raw === null) continue;
      const decoded = decodeStoredReport(raw, key, techniqueDocumentId, expectedReportId);
      if (decoded.status !== 'success') {
        issues.push(decoded.issue);
        continue;
      }
      if (decoded.migrated) {
        try {
          storage.setItem(key, JSON.stringify(decoded.report));
        } catch {
          issues.push(storageIssue(
            'storage-write-failed',
            'An editable inspection report was upgraded in memory but its normalized draft could not be written. The original raw entry was preserved.',
            { storageKey: key, reportId: decoded.report.reportId },
          ));
        }
      }
      reportById.set(decoded.report.reportId, decoded.report);
    }
  } catch {
    issues.push(storageIssue(
      'storage-read-failed',
      'Inspection-report history could not be read completely. Existing local entries were not modified.',
    ));
  }

  const reports = [...reportById.values()].sort(compareReportsNewestFirst);
  let activeReport = storedActiveReportId ? reportById.get(storedActiveReportId) ?? null : null;
  if (storedActiveReportId && !activeReport) {
    issues.push(storageIssue(
      'active-report-unavailable',
      'The active report pointer refers to an unavailable or unreadable report. A valid report can be selected without deleting the stored entry.',
      { storageKey: inspectionReportActiveStorageKey(techniqueDocumentId), reportId: storedActiveReportId },
    ));
  }
  activeReport ??= reports.find((report) => report.status === 'draft' || report.status === 'in-review') ?? reports[0] ?? null;
  const activeReportId = activeReport?.reportId ?? null;
  return {
    reports,
    history: reports.map((report) => summarizeRtPtInspectionReport(report, report.reportId === activeReportId)),
    activeReportId,
    activeReport,
    storedActiveReportId,
    issues,
  };
}

export function loadRtPtInspectionReportById(
  techniqueDocumentId: string,
  reportId: string,
): RtPtInspectionReportLoadResult {
  const collection = listRtPtInspectionReports(techniqueDocumentId);
  const report = collection.reports.find((candidate) => candidate.reportId === reportId) ?? null;
  if (!report && !collection.issues.some((issue) => issue.reportId === reportId)) {
    collection.issues.push(storageIssue(
      'active-report-unavailable',
      'The requested inspection report is not available in local history.',
      { storageKey: inspectionReportRecordStorageKey(techniqueDocumentId, reportId), reportId },
    ));
  }
  return { report, collection };
}

export function loadActiveRtPtInspectionReport(
  techniqueDocumentId: string,
): RtPtInspectionReportLoadResult {
  const collection = listRtPtInspectionReports(techniqueDocumentId);
  return { report: collection.activeReport, collection };
}

/** Backward-compatible active-report reader. Prefer loadActiveRtPtInspectionReport for recoverable errors. */
export function loadRtPtInspectionReportDraft(techniqueDocumentId: string): RtPtInspectionReportV1 | null {
  return loadActiveRtPtInspectionReport(techniqueDocumentId).report;
}

export function saveRtPtInspectionReportDraft(
  report: RtPtInspectionReportV1,
  options: { makeActive?: boolean } = {},
): void {
  const decoded = decodeRtPtInspectionReport(report);
  if (decoded.status !== 'success') throw new Error(decoded.message);
  if (!decoded.report.reportId || !decoded.report.sourceTechnique.documentId) {
    throw new Error('The inspection report requires a report ID and source-technique document ID.');
  }

  let storage: Storage | null;
  try {
    storage = getLocalStorage();
  } catch {
    throw new RtPtInspectionReportPersistenceError(storageIssue(
      'storage-unavailable',
      'Local inspection-report storage is unavailable. No stored data was modified.',
    ));
  }
  if (!storage) return;

  const normalized = decoded.report;
  const techniqueDocumentId = normalized.sourceTechnique.documentId;
  const recordKey = inspectionReportRecordStorageKey(techniqueDocumentId, normalized.reportId);
  try {
    const existingRaw = storage.getItem(recordKey);
    if (existingRaw !== null) {
      const existing = decodeStoredReport(existingRaw, recordKey, techniqueDocumentId, normalized.reportId);
      if (existing.status !== 'success') throw new RtPtInspectionReportPersistenceError(existing.issue);

      const sameReport = canonicalReport(existing.report) === canonicalReport(normalized);
      const allowedSupersession = existing.report.status === 'approved'
        && normalized.status === 'superseded'
        && canonicalReportWithoutStatus(existing.report) === canonicalReportWithoutStatus(normalized);
      if ((existing.report.status === 'approved' || existing.report.status === 'superseded')
        && !sameReport
        && !allowedSupersession) {
        throw new RtPtInspectionReportPersistenceError(storageIssue(
          'storage-write-failed',
          'A finalized inspection report cannot be overwritten. Create a new report record to preserve the controlled history.',
          { storageKey: recordKey, reportId: normalized.reportId },
        ));
      }
      if (!sameReport) storage.setItem(recordKey, JSON.stringify(normalized));
    } else {
      storage.setItem(recordKey, JSON.stringify(normalized));
    }
    if (options.makeActive !== false) {
      storage.setItem(inspectionReportActiveStorageKey(techniqueDocumentId), normalized.reportId);
    }
  } catch (error) {
    if (error instanceof RtPtInspectionReportPersistenceError) throw error;
    throw new RtPtInspectionReportPersistenceError(storageIssue(
      'storage-write-failed',
      'The inspection report could not be saved locally. Existing stored entries were not deliberately removed.',
      { storageKey: recordKey, reportId: normalized.reportId },
    ));
  }
}

export function setActiveRtPtInspectionReport(techniqueDocumentId: string, reportId: string): void {
  const loaded = loadRtPtInspectionReportById(techniqueDocumentId, reportId);
  if (!loaded.report) {
    const issue = loaded.collection.issues.find((candidate) => candidate.reportId === reportId)
      ?? storageIssue('active-report-unavailable', 'The requested inspection report is not available.', { reportId });
    throw new RtPtInspectionReportPersistenceError(issue);
  }
  let storage: Storage | null;
  try {
    storage = getLocalStorage();
    if (!storage) return;
    storage.setItem(inspectionReportActiveStorageKey(techniqueDocumentId), reportId);
  } catch {
    throw new RtPtInspectionReportPersistenceError(storageIssue(
      'storage-write-failed',
      'The active inspection-report selection could not be saved locally.',
      { storageKey: inspectionReportActiveStorageKey(techniqueDocumentId), reportId },
    ));
  }
}

/** Removes only an editable report. Finalized Approved/Superseded history is never deleted here. */
export function removeRtPtInspectionReportDraft(
  techniqueDocumentId: string,
  reportId?: string,
): void {
  const collection = listRtPtInspectionReports(techniqueDocumentId);
  const targetId = reportId ?? collection.activeReportId;
  if (!targetId) return;
  const target = collection.reports.find((report) => report.reportId === targetId);
  if (!target) return;
  if (target.status === 'approved' || target.status === 'superseded') {
    throw new RtPtInspectionReportPersistenceError(storageIssue(
      'storage-write-failed',
      'Finalized inspection-report history cannot be deleted from the draft workspace.',
      { reportId: targetId },
    ));
  }
  let storage: Storage | null;
  try {
    storage = getLocalStorage();
    if (!storage) return;
    storage.removeItem(inspectionReportRecordStorageKey(techniqueDocumentId, targetId));
    if (storage.getItem(inspectionReportActiveStorageKey(techniqueDocumentId)) === targetId) {
      storage.removeItem(inspectionReportActiveStorageKey(techniqueDocumentId));
    }
  } catch {
    throw new RtPtInspectionReportPersistenceError(storageIssue(
      'storage-write-failed',
      'The inspection-report draft could not be removed locally.',
      { reportId: targetId },
    ));
  }
}
