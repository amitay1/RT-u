export type NumberOrEmpty = number | '';
export type LengthUnit = 'mm' | 'inch';
export type DetectorLengthUnit = 'um' | 'mm' | 'inch';
export type TimeUnit = 's' | 'min' | '';
export type TemperatureUnit = 'degC' | 'degF' | '';
export type VoltageUnit = 'kV';
export type CurrentUnit = 'mA';
export type AngleUnit = 'deg';
export type InspectionStage = 'In-process' | 'Final' | 'Maintenance / in-service' | '';
export type InspectorLevel = 'I' | 'II' | 'III' | '';
export type TechniqueType = 'SWSI' | 'DWDI' | 'DWSI' | '';
export type RadiationType = 'X-ray' | 'Gamma' | '';
export type Ps811000EnergyCurve =
  | 'copper-nickel'
  | 'steel'
  | 'titanium'
  | 'aluminum-magnesium'
  | 'boron-composite'
  | 'fiberglass'
  | 'graphite-adhesive-core';
export type Ps811000ThicknessBasis = 'entered-thickness' | 'honeycomb-components' | '';
export type Ps811000FilmViewingMode = 'single' | 'superimposed' | '';

export interface RtPtGeneralInfo {
  partName: string;
  partNumber: string;
  vendorCode: string;
  partRevisionOrConfiguration: string;
  material: string;
  surfaceFinish: string;
  inspectionArea: string;
  thickness: NumberOrEmpty;
  thicknessUnit: LengthUnit;
  drawingReference: string;
  procedureNumber: string;
  inspectionStage: InspectionStage;
  inspectorLevel: InspectorLevel;
  date: string;
}

export type RtFilmGeneralInfo = RtPtGeneralInfo;

/** Acceptance content is always supplied by a controlled source, never inferred. */
export interface RtPtAcceptancePlan {
  acceptanceStandard: string;
  acceptanceClause: string;
  acceptanceText: string;
  acceptanceClass: string;
  acceptanceGrade: string;
  specialRequirements: string;
}

export type RtFilmAcceptance = RtPtAcceptancePlan;

export interface RtFilmXRaySourcePlan {
  focalSpotSize: NumberOrEmpty;
  focalSpotSizeUnit: LengthUnit;
}

export interface RtFilmGammaSourcePlan {
  isotope: string;
  sourceId: string;
  activity: NumberOrEmpty;
  activityUnit: string;
  activityReferenceDate: string;
  effectiveSourceSize: NumberOrEmpty;
  effectiveSourceSizeUnit: LengthUnit;
}

/** Both branches remain visible in draft state; validation selects the active branch. */
export interface RtFilmSource {
  sourceType: RadiationType;
  manufacturer: string;
  model: string;
  serialNumber: string;
  calibrationRequirement: string;
  xRay: RtFilmXRaySourcePlan;
  gamma: RtFilmGammaSourcePlan;
}

export interface RtFilmScreenPlan {
  material: string;
  thickness: NumberOrEmpty;
  thicknessUnit: LengthUnit;
}

export interface RtFilmSystem {
  manufacturer: string;
  filmDesignation: string;
  filmClass: string;
  requiredDensityMin: NumberOrEmpty;
  requiredDensityMax: NumberOrEmpty;
  processingSystem: string;
  processingMethod: string;
  processingTime: NumberOrEmpty;
  processingTimeUnit: TimeUnit;
  processingTemperature: NumberOrEmpty;
  processingTemperatureTolerance: NumberOrEmpty;
  processingTemperatureUnit: TemperatureUnit;
  frontScreen: RtFilmScreenPlan;
  backScreen: RtFilmScreenPlan;
  cassetteType: string;
  viewingEquipment: string;
  viewingMode: Ps811000FilmViewingMode;
  viewerOutputCandelaPerSquareMeter: NumberOrEmpty;
  individualFilmDensityMinimum: NumberOrEmpty;
  specialDensityApprovalReference: string;
  boeingPart: boolean;
  boeingViewerLimitReference: string;
}

export interface RtFilmIqi {
  type: string;
  standard: string;
  designation: string;
  shim: string;
  block: string;
  material: string;
  thickness: NumberOrEmpty;
  thicknessUnit: LengthUnit;
  placement: string;
  requiredSensitivity: string;
  imageQualityLevel: string;
  requiredUg: NumberOrEmpty;
  requiredUgUnit: LengthUnit;
}

export interface RtFilmExposureDefaults {
  wallTechnique: TechniqueType;
  sfd: NumberOrEmpty;
  sfdUnit: LengthUnit;
  sod: NumberOrEmpty;
  sodUnit: LengthUnit;
  ofd: NumberOrEmpty;
  ofdUnit: LengthUnit;
  geometricMagnificationAuto: boolean;
  geometricMagnification: NumberOrEmpty;
  thicknessDescription: string;
  thicknessMin: NumberOrEmpty;
  thicknessMax: NumberOrEmpty;
  thicknessUnit: LengthUnit;
  ps811000EnergyCurve: Ps811000EnergyCurve | '';
  ps811000EquivalenceMaterial: string;
  ps811000ThicknessBasis: Ps811000ThicknessBasis;
  honeycombSkins: NumberOrEmpty;
  honeycombAdhesive: NumberOrEmpty;
  honeycombCapsOrFlanges: NumberOrEmpty;
  honeycombDoublersOrTriplers: NumberOrEmpty;
  coverageDiameter: NumberOrEmpty;
  coverageDiameterUnit: LengthUnit;
  machineTechniqueReference: string;
  requiredUg: NumberOrEmpty;
  requiredUgUnit: LengthUnit;
  iqiOverride: string;
  tubeVoltage: NumberOrEmpty;
  tubeVoltageUnit: VoltageUnit;
  tubeCurrent: NumberOrEmpty;
  tubeCurrentUnit: CurrentUnit;
  exposureTime: NumberOrEmpty;
  exposureTimeUnit: TimeUnit;
  filter: string;
  collimation: string;
  filmDesignation: string;
  filmSize: string;
  maxParts: NumberOrEmpty;
  maxCassettes: NumberOrEmpty;
  beamAngle: NumberOrEmpty;
  beamAngleUnit: AngleUnit;
  screenOverride: string;
  overlap: string;
  identification: string;
  notes: string;
}

export interface RtFilmExposureView extends RtFilmExposureDefaults {
  id: string;
  viewId: string;
  description: string;
  orientation: string;
  inspectionZone: string;
  referenceAttachmentId: string;
}

export interface RtFilmSheet {
  ps811000Applicable: boolean;
  general: RtFilmGeneralInfo;
  exposureDefaults: RtFilmExposureDefaults;
  source: RtFilmSource;
  filmSystem: RtFilmSystem;
  iqi: RtFilmIqi;
  acceptance: RtFilmAcceptance;
  exposureViews: RtFilmExposureView[];
  techniqueNotes: string;
}

export type RtFilmTechnique = RtFilmSheet;
/** @deprecated Use RtFilmExposureDefaults or RtFilmExposureView. */
export type RtFilmExposureSetup = RtFilmExposureDefaults;

export const emptyRtPtGeneralInfo: RtPtGeneralInfo = {
  partName: '',
  partNumber: '',
  vendorCode: '',
  partRevisionOrConfiguration: '',
  material: '',
  surfaceFinish: '',
  inspectionArea: '',
  thickness: '',
  thicknessUnit: 'mm',
  drawingReference: '',
  procedureNumber: '',
  inspectionStage: '',
  inspectorLevel: '',
  date: '',
};

export const emptyRtPtAcceptancePlan: RtPtAcceptancePlan = {
  acceptanceStandard: '',
  acceptanceClause: '',
  acceptanceText: '',
  acceptanceClass: '',
  acceptanceGrade: '',
  specialRequirements: '',
};

export const emptyRtFilmExposureDefaults: RtFilmExposureDefaults = {
  wallTechnique: '',
  sfd: '',
  sfdUnit: 'mm',
  sod: '',
  sodUnit: 'mm',
  ofd: '',
  ofdUnit: 'mm',
  geometricMagnificationAuto: true,
  geometricMagnification: '',
  thicknessDescription: '',
  thicknessMin: '',
  thicknessMax: '',
  thicknessUnit: 'mm',
  ps811000EnergyCurve: '',
  ps811000EquivalenceMaterial: '',
  ps811000ThicknessBasis: '',
  honeycombSkins: '',
  honeycombAdhesive: '',
  honeycombCapsOrFlanges: '',
  honeycombDoublersOrTriplers: '',
  coverageDiameter: '',
  coverageDiameterUnit: 'mm',
  machineTechniqueReference: '',
  requiredUg: '',
  requiredUgUnit: 'mm',
  iqiOverride: '',
  tubeVoltage: '',
  tubeVoltageUnit: 'kV',
  tubeCurrent: '',
  tubeCurrentUnit: 'mA',
  exposureTime: '',
  exposureTimeUnit: '',
  filter: '',
  collimation: '',
  filmDesignation: '',
  filmSize: '',
  maxParts: '',
  maxCassettes: '',
  beamAngle: '',
  beamAngleUnit: 'deg',
  screenOverride: '',
  overlap: '',
  identification: '',
  notes: '',
};

export const emptyRtFilmSheet: RtFilmSheet = {
  ps811000Applicable: false,
  general: { ...emptyRtPtGeneralInfo },
  exposureDefaults: { ...emptyRtFilmExposureDefaults },
  source: {
    sourceType: '',
    manufacturer: '',
    model: '',
    serialNumber: '',
    calibrationRequirement: '',
    xRay: {
      focalSpotSize: '',
      focalSpotSizeUnit: 'mm',
    },
    gamma: {
      isotope: '',
      sourceId: '',
      activity: '',
      activityUnit: '',
      activityReferenceDate: '',
      effectiveSourceSize: '',
      effectiveSourceSizeUnit: 'mm',
    },
  },
  filmSystem: {
    manufacturer: '',
    filmDesignation: '',
    filmClass: '',
    requiredDensityMin: '',
    requiredDensityMax: '',
    processingSystem: '',
    processingMethod: '',
    processingTime: '',
    processingTimeUnit: '',
    processingTemperature: '',
    processingTemperatureTolerance: '',
    processingTemperatureUnit: '',
    frontScreen: { material: '', thickness: '', thicknessUnit: 'mm' },
    backScreen: { material: '', thickness: '', thicknessUnit: 'mm' },
    cassetteType: '',
    viewingEquipment: '',
    viewingMode: '',
    viewerOutputCandelaPerSquareMeter: '',
    individualFilmDensityMinimum: '',
    specialDensityApprovalReference: '',
    boeingPart: false,
    boeingViewerLimitReference: '',
  },
  iqi: {
    type: '',
    standard: '',
    designation: '',
    shim: '',
    block: '',
    material: '',
    thickness: '',
    thicknessUnit: 'mm',
    placement: '',
    requiredSensitivity: '',
    imageQualityLevel: '',
    requiredUg: '',
    requiredUgUnit: 'mm',
  },
  acceptance: { ...emptyRtPtAcceptancePlan },
  exposureViews: [],
  techniqueNotes: '',
};
