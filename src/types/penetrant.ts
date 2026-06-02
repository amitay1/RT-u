import type {
  LengthUnit,
  InspectionStage,
  InspectorLevel,
  AcceptReject,
} from './rtFilm';

export type { LengthUnit, InspectionStage, InspectorLevel, AcceptReject };

export type PenetrantType = 'Type I' | 'Type II' | '';
export type PenetrantMethod = 'A' | 'B' | 'C' | 'D' | '';
export type SensitivityLevel = '1' | '2' | '3' | '4' | '';
export type DeveloperType = 'Dry' | 'Water' | 'Non-aqueous' | '';
export type CleanerType = 'Solvent' | 'Water' | '';
export type CleaningMethod = 'Solvent' | 'Alkaline' | '';
export type SurfaceCondition = 'As-welded' | 'Machined' | '';
export type DryingMethod = 'Air' | 'Oven' | '';
export type ApplicationMethod = 'Spray' | 'Dip' | 'Brush' | '';
export type RemovalMethod = 'Water wash' | 'Solvent' | '';
export type DeveloperApplication = 'Spray' | 'Dust' | '';
export type IndicationType = 'Linear' | 'Rounded' | '';
export type LightType = 'UV' | 'White' | '';
export type PostCleaningMethod = 'Water' | 'Solvent' | '';

export interface PtGeneralInfo {
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

export interface PtMaterials {
  penetrantType: PenetrantType;
  method: PenetrantMethod;
  sensitivityLevel: SensitivityLevel;
  developerType: DeveloperType;
  cleanerType: CleanerType;
}

export interface PtSurfacePreparation {
  cleaningMethod: CleaningMethod;
  surfaceCondition: SurfaceCondition;
  dryingMethod: DryingMethod;
}

export interface PtApplication {
  applicationMethod: ApplicationMethod;
  dwellTime: number | '';
  removalMethod: RemovalMethod;
  rinsePressure: number | '';
  rinseTemperature: number | '';
}

export interface PtDevelopment {
  developerApplication: DeveloperApplication;
  developmentTime: number | '';
  indicationType: IndicationType;
  indicationSize: number | '';
}

export interface PtInspectionConditions {
  lightType: LightType;
  uvIntensity: number | '';
  whiteLight: number | '';
}

export interface PtAcceptance {
  acceptanceStandard: string;
  linearIndications: number | '';
  roundedIndications: number | '';
}

export interface PtPostCleaning {
  postCleaningMethod: PostCleaningMethod;
  result: AcceptReject;
  inspector: string;
  date: string;
}

export interface PtSheet {
  general: PtGeneralInfo;
  materials: PtMaterials;
  surfacePrep: PtSurfacePreparation;
  application: PtApplication;
  development: PtDevelopment;
  conditions: PtInspectionConditions;
  acceptance: PtAcceptance;
  postCleaning: PtPostCleaning;
}

export const emptyPtSheet: PtSheet = {
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
  materials: {
    penetrantType: '',
    method: '',
    sensitivityLevel: '',
    developerType: '',
    cleanerType: '',
  },
  surfacePrep: {
    cleaningMethod: '',
    surfaceCondition: '',
    dryingMethod: '',
  },
  application: {
    applicationMethod: '',
    dwellTime: '',
    removalMethod: '',
    rinsePressure: '',
    rinseTemperature: '',
  },
  development: {
    developerApplication: '',
    developmentTime: '',
    indicationType: '',
    indicationSize: '',
  },
  conditions: {
    lightType: '',
    uvIntensity: '',
    whiteLight: '',
  },
  acceptance: {
    acceptanceStandard: '',
    linearIndications: '',
    roundedIndications: '',
  },
  postCleaning: {
    postCleaningMethod: '',
    result: '',
    inspector: '',
    date: '',
  },
};
