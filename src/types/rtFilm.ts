export type LengthUnit = 'mm' | 'inch';
export type InspectionStage = 'In-process' | 'Final' | '';
export type InspectorLevel = 'I' | 'II' | 'III' | '';
export type TechniqueType = 'SWSI' | 'DWDI' | 'DWSI' | '';
export type RadiationType = 'X-ray' | 'Gamma' | '';
export type ExposurePattern = 'Static' | 'Multiple' | 'Rotational' | 'Panoramic' | '';
export type RadiationSourceType = 'X-ray' | 'Isotope' | '';
export type CalibrationStatus = 'Valid' | 'Expired' | '';
export type FilmClass = 'I' | 'II' | 'III' | '';
export type ScreenType = 'Lead' | 'None' | '';
export type CassetteType = 'Flexible' | 'Rigid' | '';
export type ProcessingMethod = 'Manual' | 'Automatic' | '';
export type IqiType = 'Wire' | 'Hole' | '';
export type IqiStandard = 'ASTM E747' | 'ASTM E1025' | '';
export type IqiMaterial = 'Steel' | 'Aluminum' | 'Same as part' | '';
export type IqiPlacement = 'Source side' | 'Film side' | '';
export type RequiredSensitivity = '1-1T' | '2-1T' | '2-2T' | '2-4T' | '';
export type ImageQualityLevel = '00' | '0' | '1' | '2' | '3' | '';
export type AcceptReject = 'Accept' | 'Reject' | '';

export interface RtFilmGeneralInfo {
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

export interface RtFilmExposureSetup {
  techniqueType: TechniqueType;
  radiationType: RadiationType;
  sfd: number | '';
  sfdUnit: LengthUnit;
  sod: number | '';
  sodUnit: LengthUnit;
  ofd: number | '';
  ofdUnit: LengthUnit;
  geometricMagnificationAuto: boolean;
  geometricMagnification: number | '';
  focalSpotSize: number | '';
  beamAngle: number | '';
  numberOfExposures: number | '';
  exposurePattern: ExposurePattern;
  coverage: number | '';
}

export interface RtFilmEquipment {
  radiationSourceType: RadiationSourceType;
  manufacturer: string;
  model: string;
  serialNumber: string;
  calibrationStatus: CalibrationStatus;
  viewingEquipment: string;
}

export interface RtFilmFilmSystem {
  filmType: string;
  filmClass: FilmClass;
  screenType: ScreenType;
  screenThickness: number | '';
  cassetteType: CassetteType;
  processingMethod: ProcessingMethod;
}

export interface RtFilmIqc {
  iqiType: IqiType;
  iqiStandard: IqiStandard;
  iqiMaterial: IqiMaterial;
  iqiSize: number | '';
  iqiPlacement: IqiPlacement;
  requiredSensitivity: RequiredSensitivity;
  achievedSensitivity: string;
  opticalDensityMin: number | '';
  opticalDensityMax: number | '';
  imageQualityLevel: ImageQualityLevel;
}

export interface RtFilmAcceptance {
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

export interface RtFilmIdentification {
  filmNumber: string;
  exposureNumber: number | '';
  partIdentification: string;
  inspectionDate: string;
  inspector: string;
  result: AcceptReject;
  remarks: string;
}

export interface RtFilmSheet {
  general: RtFilmGeneralInfo;
  exposure: RtFilmExposureSetup;
  equipment: RtFilmEquipment;
  filmSystem: RtFilmFilmSystem;
  iqc: RtFilmIqc;
  acceptance: RtFilmAcceptance;
  identification: RtFilmIdentification;
}

export const emptyRtFilmSheet: RtFilmSheet = {
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
    techniqueType: '',
    radiationType: '',
    sfd: '',
    sfdUnit: 'mm',
    sod: '',
    sodUnit: 'mm',
    ofd: '',
    ofdUnit: 'mm',
    geometricMagnificationAuto: true,
    geometricMagnification: '',
    focalSpotSize: '',
    beamAngle: '',
    numberOfExposures: '',
    exposurePattern: '',
    coverage: '',
  },
  equipment: {
    radiationSourceType: '',
    manufacturer: '',
    model: '',
    serialNumber: '',
    calibrationStatus: '',
    viewingEquipment: '',
  },
  filmSystem: {
    filmType: '',
    filmClass: '',
    screenType: '',
    screenThickness: '',
    cassetteType: '',
    processingMethod: '',
  },
  iqc: {
    iqiType: '',
    iqiStandard: '',
    iqiMaterial: '',
    iqiSize: '',
    iqiPlacement: '',
    requiredSensitivity: '',
    achievedSensitivity: '',
    opticalDensityMin: '',
    opticalDensityMax: '',
    imageQualityLevel: '',
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
