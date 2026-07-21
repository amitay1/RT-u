import {
  emptyRtPtAcceptancePlan,
  emptyRtPtGeneralInfo,
  type LengthUnit,
  type NumberOrEmpty,
  type RtPtAcceptancePlan,
  type RtPtGeneralInfo,
  type TemperatureUnit,
  type TimeUnit,
} from './rtFilm';

export type { LengthUnit, NumberOrEmpty, TemperatureUnit, TimeUnit };
export type PenetrantType = 'Type I' | 'Type II' | '';
export type PenetrantMethod = 'A' | 'B' | 'C' | 'D' | '';
export type SensitivityLevel = '1/2' | '1' | '2' | '3' | '4' | '';
export type PtGeneralInfo = RtPtGeneralInfo;
export type PtAcceptance = RtPtAcceptancePlan;

export interface PtApprovedProduct {
  manufacturer: string;
  designation: string;
}

export interface PtMaterials {
  penetrantType: PenetrantType;
  method: PenetrantMethod;
  sensitivityLevel: SensitivityLevel;
  systemFamily: string;
  qualificationReference: string;
  developerForm: string;
  penetrant: PtApprovedProduct;
  cleaner: PtApprovedProduct;
  remover: PtApprovedProduct;
  emulsifier: PtApprovedProduct;
  developer: PtApprovedProduct;
}

export interface PtSurfacePreparation {
  cleaningMethod: string;
  cleaningDetails: string;
  cleaningRestrictions: string;
  surfaceCondition: string;
  dryingMethod: string;
  dryingTime: NumberOrEmpty;
  dryingTimeUnit: TimeUnit;
  dryingTemperature: NumberOrEmpty;
  dryingTemperatureUnit: TemperatureUnit;
}

export interface PtApplication {
  applicationMethod: string;
  dwellTime: NumberOrEmpty;
  dwellTimeUnit: TimeUnit;
  partTemperatureMin: NumberOrEmpty;
  partTemperatureMax: NumberOrEmpty;
  partTemperatureUnit: TemperatureUnit;
  penetrantTemperatureMin: NumberOrEmpty;
  penetrantTemperatureMax: NumberOrEmpty;
  penetrantTemperatureUnit: TemperatureUnit;
}

export interface PtMethodARinse {
  instructions: string;
  pressureMin: NumberOrEmpty;
  pressureMax: NumberOrEmpty;
  pressureUnit: string;
  temperatureMin: NumberOrEmpty;
  temperatureMax: NumberOrEmpty;
  temperatureUnit: TemperatureUnit;
}

export interface PtMethodBdEmulsifier {
  type: string;
  concentration: NumberOrEmpty;
  concentrationUnit: string;
  contactTime: NumberOrEmpty;
  contactTimeUnit: TimeUnit;
  applicationMethod: string;
  postEmulsifierRinseInstructions: string;
}

export interface PtMethodCRemoval {
  removerInstructions: string;
}

export interface PtMethodDRinses {
  preRinseInstructions: string;
  finalRinseInstructions: string;
}

export interface PtRemoval {
  methodA: PtMethodARinse;
  methodBD: PtMethodBdEmulsifier;
  methodC: PtMethodCRemoval;
  methodD: PtMethodDRinses;
}

export interface PtDevelopment {
  developerApplication: string;
  developmentTime: NumberOrEmpty;
  developmentTimeUnit: TimeUnit;
  instructions: string;
}

export interface PtInspectionConditions {
  requiredUvAMin: NumberOrEmpty;
  uvAUnit: string;
  ambientVisibleLightMax: NumberOrEmpty;
  whiteLightMin: NumberOrEmpty;
  visibleLightUnit: string;
  darkAdaptationTime: NumberOrEmpty;
  darkAdaptationTimeUnit: TimeUnit;
  equipmentRequirements: string;
}

export interface PtPostCleaning {
  instructions: string;
  corrosionProtection: string;
}

export interface PtSheet {
  general: PtGeneralInfo;
  materials: PtMaterials;
  surfacePrep: PtSurfacePreparation;
  application: PtApplication;
  removal: PtRemoval;
  development: PtDevelopment;
  conditions: PtInspectionConditions;
  acceptance: PtAcceptance;
  postCleaning: PtPostCleaning;
  techniqueNotes: string;
}

export type PtTechnique = PtSheet;

const emptyProduct = (): PtApprovedProduct => ({ manufacturer: '', designation: '' });

export const emptyPtSheet: PtSheet = {
  general: { ...emptyRtPtGeneralInfo },
  materials: {
    penetrantType: '',
    method: '',
    sensitivityLevel: '',
    systemFamily: '',
    qualificationReference: '',
    developerForm: '',
    penetrant: emptyProduct(),
    cleaner: emptyProduct(),
    remover: emptyProduct(),
    emulsifier: emptyProduct(),
    developer: emptyProduct(),
  },
  surfacePrep: {
    cleaningMethod: '',
    cleaningDetails: '',
    cleaningRestrictions: '',
    surfaceCondition: '',
    dryingMethod: '',
    dryingTime: '',
    dryingTimeUnit: '',
    dryingTemperature: '',
    dryingTemperatureUnit: '',
  },
  application: {
    applicationMethod: '',
    dwellTime: '',
    dwellTimeUnit: '',
    partTemperatureMin: '',
    partTemperatureMax: '',
    partTemperatureUnit: '',
    penetrantTemperatureMin: '',
    penetrantTemperatureMax: '',
    penetrantTemperatureUnit: '',
  },
  removal: {
    methodA: {
      instructions: '',
      pressureMin: '',
      pressureMax: '',
      pressureUnit: '',
      temperatureMin: '',
      temperatureMax: '',
      temperatureUnit: '',
    },
    methodBD: {
      type: '',
      concentration: '',
      concentrationUnit: '',
      contactTime: '',
      contactTimeUnit: '',
      applicationMethod: '',
      postEmulsifierRinseInstructions: '',
    },
    methodC: { removerInstructions: '' },
    methodD: { preRinseInstructions: '', finalRinseInstructions: '' },
  },
  development: {
    developerApplication: '',
    developmentTime: '',
    developmentTimeUnit: '',
    instructions: '',
  },
  conditions: {
    requiredUvAMin: '',
    uvAUnit: '',
    ambientVisibleLightMax: '',
    whiteLightMin: '',
    visibleLightUnit: '',
    darkAdaptationTime: '',
    darkAdaptationTimeUnit: '',
    equipmentRequirements: '',
  },
  acceptance: { ...emptyRtPtAcceptancePlan },
  postCleaning: { instructions: '', corrosionProtection: '' },
  techniqueNotes: '',
};
