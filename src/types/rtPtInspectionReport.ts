import type { CertificationLevel } from '@/types/inspectorProfile';
import type {
  CurrentUnit,
  LengthUnit,
  NumberOrEmpty,
  TemperatureUnit,
  TimeUnit,
  VoltageUnit,
} from '@/types/rtFilm';
import type { DigitalTimeUnit } from '@/types/rtDigital';
import type { RtPtControlledReference, RtPtMethod } from '@/types/rtPtDocument';

export const RT_PT_INSPECTION_REPORT_KIND = 'rtpt-inspection-report' as const;
export const RT_PT_INSPECTION_REPORT_VERSION = 1 as const;
export const RT_PT_INSPECTION_REPORT_TYPE = 'inspection-report' as const;

export type RtPtInspectionReportStatus = 'draft' | 'in-review' | 'approved' | 'superseded';
export type RtPtInspectionResult = '' | 'accepted' | 'rejected' | 'retake-required';
export type RtPtDisposition = '' | 'accepted' | 'rejected' | 'repair-required' | 'reinspection-required';
export type RtPtBooleanOrEmpty = boolean | '';
export type RtPtReportApprovalRole = 'performed' | 'reviewed' | 'quality' | 'ndt-level-3';

export interface RtPtSourceTechniqueLink {
  documentId: string;
  documentNumber: string;
  title: string;
  revision: string;
  method: RtPtMethod;
  approvedContentFingerprint: string;
  approvalDate: string;
  /** Frozen controlled-reference snapshot from the approved technique basis. */
  controlledReferences: RtPtControlledReference[];
}

export interface RtPtInspectionReportControl {
  number: string;
  title: string;
  revision: string;
  reportDate: string;
  inspectionStart: string;
  inspectionEnd: string;
}

export interface RtPtInspectionPartTraceability {
  partName: string;
  partNumber: string;
  partRevisionOrConfiguration: string;
  serialOrLotNumber: string;
  quantity: NumberOrEmpty;
  material: string;
  inspectionArea: string;
  workOrder: string;
}

export interface RtPtInspectionEquipmentRecord {
  equipmentUsed: string;
  calibrationReferences: string;
  environmentalConditions: string;
  deviations: string;
}

export interface RtPtReportApproval {
  role: RtPtReportApprovalRole;
  name: string;
  personnelId: string;
  certificationLevel: CertificationLevel | '';
  certificationNumber: string;
  certificationBasis: string;
  date: string;
}

export interface RtPtIndicationRecord {
  id: string;
  indicationId: string;
  linkedResultId: string;
  location: string;
  indicationType: string;
  size: NumberOrEmpty;
  sizeUnit: LengthUnit;
  evaluation: string;
  disposition: RtPtDisposition;
  remarks: string;
}

export interface RtPtInspectionReportBase {
  documentKind: typeof RT_PT_INSPECTION_REPORT_KIND;
  schemaVersion: typeof RT_PT_INSPECTION_REPORT_VERSION;
  documentType: typeof RT_PT_INSPECTION_REPORT_TYPE;
  reportId: string;
  status: RtPtInspectionReportStatus;
  /** Content digest recorded when this report enters Approved status. */
  approvalFingerprint: string;
  sourceTechnique: RtPtSourceTechniqueLink;
  reportControl: RtPtInspectionReportControl;
  organization: { name: string; site: string };
  job: { customer: string; contract: string; purchaseOrder: string; workOrder: string };
  part: RtPtInspectionPartTraceability;
  equipment: RtPtInspectionEquipmentRecord;
  indications: RtPtIndicationRecord[];
  overallDisposition: RtPtDisposition;
  dispositionReference: string;
  coverageStatement: string;
  remarks: string;
  approvals: RtPtReportApproval[];
}

export interface RtFilmPlannedResultBasis {
  viewId: string;
  description: string;
  orientation: string;
  inspectionZone: string;
  referenceAttachmentId: string;
  wallTechnique: string;
  sourceType: 'X-ray' | 'Gamma' | '';
  sfd: NumberOrEmpty;
  sfdUnit: LengthUnit;
  sod: NumberOrEmpty;
  sodUnit: LengthUnit;
  ofd: NumberOrEmpty;
  ofdUnit: LengthUnit;
  tubeVoltage: NumberOrEmpty;
  tubeVoltageUnit: VoltageUnit;
  tubeCurrent: NumberOrEmpty;
  tubeCurrentUnit: CurrentUnit;
  exposureTime: NumberOrEmpty;
  exposureTimeUnit: TimeUnit;
  filmDesignation: string;
  iqiRequirement: string;
  densityMinimum: NumberOrEmpty;
  densityMaximum: NumberOrEmpty;
}

export interface RtFilmPerformedResult {
  id: string;
  plannedItemId: string;
  planned: RtFilmPlannedResultBasis;
  filmId: string;
  retakeOfFilmId: string;
  exposureDate: string;
  actualSfd: NumberOrEmpty;
  actualSfdUnit: LengthUnit;
  actualSod: NumberOrEmpty;
  actualSodUnit: LengthUnit;
  actualOfd: NumberOrEmpty;
  actualOfdUnit: LengthUnit;
  actualTubeVoltage: NumberOrEmpty;
  actualTubeVoltageUnit: VoltageUnit | '';
  actualTubeCurrent: NumberOrEmpty;
  actualTubeCurrentUnit: CurrentUnit | '';
  actualSourceActivity: NumberOrEmpty;
  actualSourceActivityUnit: string;
  actualExposureTime: NumberOrEmpty;
  actualExposureTimeUnit: TimeUnit;
  densityMinimum: NumberOrEmpty;
  densityMaximum: NumberOrEmpty;
  iqiObserved: string;
  iqiRequirementMet: RtPtBooleanOrEmpty;
  coverageConfirmed: RtPtBooleanOrEmpty;
  result: RtPtInspectionResult;
  remarks: string;
}

export interface RtCrPlannedResultBasis {
  viewId: string;
  description: string;
  orientation: string;
  inspectionZone: string;
  referenceAttachmentId: string;
  wallTechnique: string;
  sourceType: 'X-ray' | 'Gamma' | '';
  sfd: NumberOrEmpty;
  sfdUnit: LengthUnit;
  sod: NumberOrEmpty;
  sodUnit: LengthUnit;
  ofd: NumberOrEmpty;
  ofdUnit: LengthUnit;
  tubeVoltage: NumberOrEmpty;
  tubeVoltageUnit: VoltageUnit;
  tubeCurrent: NumberOrEmpty;
  tubeCurrentUnit: CurrentUnit;
  exposureTime: NumberOrEmpty;
  exposureTimeUnit: TimeUnit;
  plateDesignation: string;
  iqiRequirement: string;
  greyValueMin: NumberOrEmpty;
  greyValueMax: NumberOrEmpty;
  requiredSnrMin: NumberOrEmpty;
}

export interface RtCrPerformedResult {
  id: string;
  plannedItemId: string;
  planned: RtCrPlannedResultBasis;
  plateOrImageId: string;
  retakeOfImageId: string;
  exposureDate: string;
  scanDate: string;
  actualSfd: NumberOrEmpty;
  actualSfdUnit: LengthUnit;
  actualSod: NumberOrEmpty;
  actualSodUnit: LengthUnit;
  actualOfd: NumberOrEmpty;
  actualOfdUnit: LengthUnit;
  actualTubeVoltage: NumberOrEmpty;
  actualTubeVoltageUnit: VoltageUnit | '';
  actualTubeCurrent: NumberOrEmpty;
  actualTubeCurrentUnit: CurrentUnit | '';
  actualSourceActivity: NumberOrEmpty;
  actualSourceActivityUnit: string;
  actualExposureTime: NumberOrEmpty;
  actualExposureTimeUnit: TimeUnit;
  greyValueMin: NumberOrEmpty;
  greyValueMax: NumberOrEmpty;
  achievedSnr: NumberOrEmpty;
  achievedSrb: NumberOrEmpty;
  snrRequirementMet: RtPtBooleanOrEmpty;
  iqiObserved: string;
  iqiRequirementMet: RtPtBooleanOrEmpty;
  coverageConfirmed: RtPtBooleanOrEmpty;
  result: RtPtInspectionResult;
  remarks: string;
}

export interface RtDigitalPlannedResultBasis {
  viewId: string;
  description: string;
  orientation: string;
  inspectionZone: string;
  referenceAttachmentId: string;
  wallTechnique: string;
  sdd: NumberOrEmpty;
  sddUnit: LengthUnit;
  sod: NumberOrEmpty;
  sodUnit: LengthUnit;
  odd: NumberOrEmpty;
  oddUnit: LengthUnit;
  tubeVoltage: NumberOrEmpty;
  tubeVoltageUnit: VoltageUnit;
  tubeCurrent: NumberOrEmpty;
  tubeCurrentUnit: CurrentUnit;
  exposureTime: NumberOrEmpty;
  exposureTimeUnit: DigitalTimeUnit;
  integrationTime: NumberOrEmpty;
  integrationTimeUnit: DigitalTimeUnit;
  framesAveraged: NumberOrEmpty;
  imageNaming: string;
  iqiRequirement: string;
  requiredSnrOrNormalizedSnr: string;
  requiredContrastSensitivityOrCnr: string;
}

export interface RtDigitalPerformedResult {
  id: string;
  plannedItemId: string;
  planned: RtDigitalPlannedResultBasis;
  imageId: string;
  retakeOfImageId: string;
  acquisitionDate: string;
  actualSdd: NumberOrEmpty;
  actualSddUnit: LengthUnit;
  actualSod: NumberOrEmpty;
  actualSodUnit: LengthUnit;
  actualOdd: NumberOrEmpty;
  actualOddUnit: LengthUnit;
  actualTubeVoltage: NumberOrEmpty;
  actualTubeVoltageUnit: VoltageUnit;
  actualTubeCurrent: NumberOrEmpty;
  actualTubeCurrentUnit: CurrentUnit;
  actualExposureTime: NumberOrEmpty;
  actualExposureTimeUnit: DigitalTimeUnit;
  actualIntegrationTime: NumberOrEmpty;
  actualIntegrationTimeUnit: DigitalTimeUnit;
  actualFramesAveraged: NumberOrEmpty;
  achievedSnr: string;
  achievedCnr: string;
  iqiObserved: string;
  iqiRequirementMet: RtPtBooleanOrEmpty;
  snrRequirementMet: RtPtBooleanOrEmpty;
  cnrRequirementMet: RtPtBooleanOrEmpty;
  detectorControlReference: string;
  archiveReference: string;
  coverageConfirmed: RtPtBooleanOrEmpty;
  result: RtPtInspectionResult;
  remarks: string;
}

export interface PtPlannedResultBasis {
  penetrantType: string;
  removalMethod: string;
  sensitivityLevel: string;
  cleaningMethod: string;
  cleaningDetails: string;
  cleaningRestrictions: string;
  surfaceCondition: string;
  dryingMethod: string;
  dryingTime: NumberOrEmpty;
  dryingTimeUnit: TimeUnit;
  dryingTemperature: NumberOrEmpty;
  dryingTemperatureUnit: TemperatureUnit;
  penetrantApplicationMethod: string;
  dwellTime: NumberOrEmpty;
  dwellTimeUnit: TimeUnit;
  developmentTime: NumberOrEmpty;
  developmentTimeUnit: TimeUnit;
  partTemperatureMin: NumberOrEmpty;
  partTemperatureMax: NumberOrEmpty;
  partTemperatureUnit: TemperatureUnit;
  penetrantTemperatureMin: NumberOrEmpty;
  penetrantTemperatureMax: NumberOrEmpty;
  penetrantTemperatureUnit: TemperatureUnit;
  requiredUvAMin: NumberOrEmpty;
  uvAUnit: string;
  ambientVisibleLightMax: NumberOrEmpty;
  whiteLightMin: NumberOrEmpty;
  visibleLightUnit: string;
  methodARinseInstructions: string;
  methodARinsePressureMin: NumberOrEmpty;
  methodARinsePressureMax: NumberOrEmpty;
  methodARinsePressureUnit: string;
  methodARinseTemperatureMin: NumberOrEmpty;
  methodARinseTemperatureMax: NumberOrEmpty;
  methodARinseTemperatureUnit: TemperatureUnit;
  emulsifierType: string;
  emulsifierConcentration: NumberOrEmpty;
  emulsifierConcentrationUnit: string;
  emulsifierContactTime: NumberOrEmpty;
  emulsifierContactTimeUnit: TimeUnit;
  emulsifierApplicationMethod: string;
  postEmulsifierRinseInstructions: string;
  methodCRemoverInstructions: string;
  methodDPreRinseInstructions: string;
  methodDFinalRinseInstructions: string;
  developerApplicationMethod: string;
  developerInstructions: string;
  darkAdaptationTime: NumberOrEmpty;
  darkAdaptationTimeUnit: TimeUnit;
}

export interface PtPerformedResults {
  planned: PtPlannedResultBasis;
  penetrantLot: string;
  penetrantExpiry: string;
  cleanerLot: string;
  removerLot: string;
  emulsifierLot: string;
  developerLot: string;
  actualCleaningMethod: string;
  actualCleaningDetails: string;
  actualSurfaceCondition: string;
  actualDryingMethod: string;
  actualDryingTime: NumberOrEmpty;
  actualDryingTimeUnit: TimeUnit;
  actualDryingTemperature: NumberOrEmpty;
  actualDryingTemperatureUnit: TemperatureUnit;
  actualPenetrantApplicationMethod: string;
  partTemperature: NumberOrEmpty;
  penetrantTemperature: NumberOrEmpty;
  temperatureUnit: TemperatureUnit;
  actualDwellTime: NumberOrEmpty;
  actualDwellTimeUnit: TimeUnit;
  actualDevelopmentTime: NumberOrEmpty;
  actualDevelopmentTimeUnit: TimeUnit;
  actualMethodARinseDetails: string;
  actualMethodARinsePressure: NumberOrEmpty;
  actualMethodARinsePressureUnit: string;
  actualMethodARinseTemperature: NumberOrEmpty;
  actualMethodARinseTemperatureUnit: TemperatureUnit;
  actualEmulsifierConcentration: NumberOrEmpty;
  actualEmulsifierConcentrationUnit: string;
  actualEmulsifierContactTime: NumberOrEmpty;
  actualEmulsifierContactTimeUnit: TimeUnit;
  actualEmulsifierApplicationMethod: string;
  actualPostEmulsifierRinseDetails: string;
  actualMethodCRemovalDetails: string;
  actualMethodDPreRinseDetails: string;
  actualMethodDFinalRinseDetails: string;
  actualDeveloperApplicationMethod: string;
  actualDarkAdaptationTime: NumberOrEmpty;
  actualDarkAdaptationTimeUnit: TimeUnit;
  measuredUvA: NumberOrEmpty;
  uvAUnit: string;
  measuredAmbientVisibleLight: NumberOrEmpty;
  measuredWhiteLight: NumberOrEmpty;
  visibleLightUnit: string;
  lightMeterId: string;
  examinationTime: string;
  postCleaningCompleted: RtPtBooleanOrEmpty;
  coverageConfirmed: RtPtBooleanOrEmpty;
}

export type RtPtInspectionReportV1 = RtPtInspectionReportBase & (
  | { method: 'RT-Film'; results: RtFilmPerformedResult[] }
  | { method: 'RT-Digital'; results: RtDigitalPerformedResult[] }
  | { method: 'RT-CR'; results: RtCrPerformedResult[] }
  | { method: 'PT'; results: PtPerformedResults }
);

export type RtPtInspectionReport = RtPtInspectionReportV1;
