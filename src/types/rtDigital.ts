import type {
  LengthUnit,
  InspectionStage,
  InspectorLevel,
  RadiationType,
  CalibrationStatus,
  IqiType,
  IqiStandard,
  AcceptReject,
} from './rtFilm';

export type { LengthUnit, InspectionStage, InspectorLevel, RadiationType, CalibrationStatus, IqiType, IqiStandard, AcceptReject };

export type DdaType = 'Flat Panel' | 'CCD' | 'CMOS' | '';
export type DetectorMode = 'Full' | 'Binned' | '';
export type NoiseReduction = 'None' | 'Low' | 'Medium' | 'High' | '';
export type OnOff = 'On' | 'Off' | '';
export type ImageFormat = 'DICONDE' | 'TIFF' | '';
export type DigitalRequiredSensitivity = '1-1T' | '2-2T' | '';
export type YesNo = 'Yes' | 'No' | '';
export type DetectorCorrection = 'Gain' | 'Offset' | 'Gain + Offset' | '';

export interface RtDigitalGeneralInfo {
  partName: string;
  partNumber: string;
  material: string;
  thickness: number | '';
  thicknessUnit: LengthUnit;
  drawingReference: string;
  procedureNumber: string;
  inspectionStage: InspectionStage;
  inspectorLevel: InspectorLevel;
  date: string;
}

export interface RtDigitalExposureSetup {
  radiationType: RadiationType;
  tubeVoltage: number | '';
  tubeCurrent: number | '';
  exposureTime: number | '';
  frameRate: number | '';
  framesAveraged: number | '';
  sdd: number | '';
  sod: number | '';
  odd: number | '';
  magnificationAuto: boolean;
  magnification: number | '';
  focalSpotSize: number | '';
  filters: string;
  coverage: number | '';
}

export interface RtDigitalSystemConfig {
  ddaType: DdaType;
  manufacturer: string;
  model: string;
  pixelSize: number | '';
  detectorMode: DetectorMode;
  gainSetting: number | '';
  calibrationStatus: CalibrationStatus;
}

export interface RtDigitalDetector {
  spatialResolutionSRb: number | '';
  pixelDensity: number | '';
  imageUnsharpness: number | '';
  badPixelCorrection: YesNo;
  detectorCorrections: DetectorCorrection;
}

export interface RtDigitalImageProcessing {
  windowLevel: number | '';
  windowWidth: number | '';
  zoom: number | '';
  noiseReduction: NoiseReduction;
  contrastEnhancement: OnOff;
  imageFormat: ImageFormat;
}

export interface RtDigitalIqc {
  iqiType: IqiType;
  iqiStandard: IqiStandard;
  requiredSensitivity: DigitalRequiredSensitivity;
  cnr: number | '';
}

export interface RtDigitalAcceptance {
  acceptanceStandard: string;
  qualityLevel: string;
  singleDiscontinuity: number | '';
  singleDiscontinuityUnit: LengthUnit;
  multipleDiscontinuities: number | '';
  multipleDiscontinuitiesUnit: LengthUnit;
  linearIndications: number | '';
  linearIndicationsUnit: LengthUnit;
  specialRequirements: string;
}

export interface RtDigitalIdentification {
  filmNumber: string;
  exposureNumber: number | '';
  partIdentification: string;
  inspectionDate: string;
  inspector: string;
  result: AcceptReject;
  remarks: string;
}

export interface RtDigitalSheet {
  general: RtDigitalGeneralInfo;
  exposure: RtDigitalExposureSetup;
  system: RtDigitalSystemConfig;
  detector: RtDigitalDetector;
  imageProcessing: RtDigitalImageProcessing;
  iqc: RtDigitalIqc;
  acceptance: RtDigitalAcceptance;
  identification: RtDigitalIdentification;
}

export const emptyRtDigitalSheet: RtDigitalSheet = {
  general: {
    partName: '',
    partNumber: '',
    material: '',
    thickness: '',
    thicknessUnit: 'mm',
    drawingReference: '',
    procedureNumber: '',
    inspectionStage: '',
    inspectorLevel: '',
    date: '',
  },
  exposure: {
    radiationType: '',
    tubeVoltage: '',
    tubeCurrent: '',
    exposureTime: '',
    frameRate: '',
    framesAveraged: '',
    sdd: '',
    sod: '',
    odd: '',
    magnificationAuto: true,
    magnification: '',
    focalSpotSize: '',
    filters: '',
    coverage: '',
  },
  system: {
    ddaType: '',
    manufacturer: '',
    model: '',
    pixelSize: '',
    detectorMode: '',
    gainSetting: '',
    calibrationStatus: '',
  },
  detector: {
    spatialResolutionSRb: '',
    pixelDensity: '',
    imageUnsharpness: '',
    badPixelCorrection: '',
    detectorCorrections: '',
  },
  imageProcessing: {
    windowLevel: '',
    windowWidth: '',
    zoom: '',
    noiseReduction: '',
    contrastEnhancement: '',
    imageFormat: '',
  },
  iqc: {
    iqiType: '',
    iqiStandard: '',
    requiredSensitivity: '',
    cnr: '',
  },
  acceptance: {
    acceptanceStandard: '',
    qualityLevel: '',
    singleDiscontinuity: '',
    singleDiscontinuityUnit: 'mm',
    multipleDiscontinuities: '',
    multipleDiscontinuitiesUnit: 'mm',
    linearIndications: '',
    linearIndicationsUnit: 'mm',
    specialRequirements: '',
  },
  identification: {
    filmNumber: '',
    exposureNumber: '',
    partIdentification: '',
    inspectionDate: '',
    inspector: '',
    result: '',
    remarks: '',
  },
};
