import {
  emptyRtPtAcceptancePlan,
  emptyRtPtGeneralInfo,
  type CurrentUnit,
  type DetectorLengthUnit,
  type LengthUnit,
  type NumberOrEmpty,
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

export interface RtDigitalAcquisition extends RtDigitalAcquisitionDefaults {
  id: string;
  viewId: string;
  description: string;
  orientation: string;
  inspectionZone: string;
  referenceAttachmentId: string;
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
}

export type RtDigitalTechnique = RtDigitalSheet;
/** @deprecated Use RtDigitalAcquisitionDefaults or RtDigitalAcquisition. */
export type RtDigitalExposureSetup = RtDigitalAcquisitionDefaults;

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

export const emptyRtDigitalSheet: RtDigitalSheet = {
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
};
