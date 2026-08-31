import type {
  AngleUnit,
  CurrentUnit,
  DetectorLengthUnit,
  LengthUnit,
  NumberOrEmpty,
  RadiationType,
  RtCircumferentialPlan,
  RtFilmGammaSourcePlan,
  RtPerformanceTrendEntry,
  RtFilmIqi,
  RtFilmScreenPlan,
  RtFilmXRaySourcePlan,
  RtPtAcceptancePlan,
  RtPtGeneralInfo,
  TechniqueType,
  TimeUnit,
  VoltageUnit,
} from '@/types/rtFilm';
import {
  emptyRtPtAcceptancePlan,
  emptyRtPtGeneralInfo,
} from '@/types/rtFilm';

/**
 * Computed Radiography (CR) controlled technique model.
 *
 * CR pairs a film-like exposure side (source, geometry, kV/mA/time, screens)
 * with a digital-like image side (scanner resolution, SRb, grey values), so
 * the exposure-side field names deliberately match the RT-Film model — the
 * geometry calculators and setup diagrams operate on them structurally.
 * There are intentionally no PS811000E fields: PS-811000 is a film process
 * specification and does not govern CR techniques.
 */

export type RtCrGeneralInfo = RtPtGeneralInfo;
export type RtCrAcceptance = RtPtAcceptancePlan;
export type RtCrIqi = RtFilmIqi;
export type RtCrScreenPlan = RtFilmScreenPlan;

/** Same source planning branches as film: X-ray focal spot or gamma isotope plan. */
export interface RtCrSource {
  sourceType: RadiationType;
  manufacturer: string;
  model: string;
  serialNumber: string;
  calibrationRequirement: string;
  xRay: RtFilmXRaySourcePlan;
  gamma: RtFilmGammaSourcePlan;
}

export interface RtCrPlateSystem {
  manufacturer: string;
  /** Plate model / commercial designation. */
  plateDesignation: string;
  /** System class per the governing practice (e.g. ISO 16371-1 / ASTM E2446 class); recorded, never inferred. */
  plateClass: string;
  cassetteType: string;
  frontScreen: RtCrScreenPlan;
  backScreen: RtCrScreenPlan;
  /** Required erasure of the imaging plate before re-use. */
  erasureRequirement: string;
  /** Plate condition / artifact inspection requirement (scratches, fade, retirement criteria). */
  plateConditionRequirement: string;
}

export interface RtCrScannerQualification {
  reference: string;
  date: string;
  dueDate: string;
  status: string;
}

export interface RtCrScanner {
  manufacturer: string;
  model: string;
  serialNumber: string;
  pixelPitch: NumberOrEmpty;
  pixelPitchUnit: DetectorLengthUnit;
  laserSpotSize: NumberOrEmpty;
  laserSpotSizeUnit: DetectorLengthUnit;
  /** Planned readout sampling, in pixels per millimetre. */
  scanResolutionPixelsPerMm: NumberOrEmpty;
  /** PMT gain / voltage or equivalent readout sensitivity setting, recorded verbatim. */
  pmtGainOrVoltage: string;
  calibrationRequirement: string;
  qualification: RtCrScannerQualification;
  /** Omitted when empty so earlier canonical fingerprints stay stable. */
  performanceTrend?: RtPerformanceTrendEntry[];
}

export interface RtCrImageQuality {
  /** Required basic spatial resolution of the scanned image. */
  requiredSrb: NumberOrEmpty;
  requiredSrbUnit: DetectorLengthUnit;
  /** Required grey-value window for the area of interest in the scanned image. */
  greyValueMin: NumberOrEmpty;
  greyValueMax: NumberOrEmpty;
  /** Required minimum signal-to-noise ratio (normalized where the practice requires it). */
  requiredSnrMin: NumberOrEmpty;
  /** Duplex-wire / spatial-resolution verification requirement, recorded verbatim. */
  duplexWireRequirement: string;
  /** Maximum allowed delay between exposure and scanning (plate fading control). */
  maxScanDelay: NumberOrEmpty;
  maxScanDelayUnit: TimeUnit;
}

export interface RtCrExposureDefaults {
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
  plateSize: string;
  beamAngle: NumberOrEmpty;
  beamAngleUnit: AngleUnit;
  screenOverride: string;
  overlap: string;
  identification: string;
  notes: string;
}

export interface RtCrExposureView extends RtCrExposureDefaults {
  id: string;
  viewId: string;
  description: string;
  orientation: string;
  inspectionZone: string;
  referenceAttachmentId: string;
}

export interface RtCrSheet {
  /**
   * EN ISO 17636-2 test class governing this technique. Omitted (never '')
   * when not planned to an ISO 17636-2 class, keeping earlier canonical
   * fingerprints stable.
   */
  iso17636TestClass?: 'A' | 'B';
  /** Omitted (never partial) when circumferential coverage is not planned here. */
  circumferentialPlan?: RtCircumferentialPlan;
  general: RtCrGeneralInfo;
  exposureDefaults: RtCrExposureDefaults;
  source: RtCrSource;
  plateSystem: RtCrPlateSystem;
  scanner: RtCrScanner;
  imageQuality: RtCrImageQuality;
  iqi: RtCrIqi;
  acceptance: RtCrAcceptance;
  exposureViews: RtCrExposureView[];
  techniqueNotes: string;
}

export type RtCrTechnique = RtCrSheet;

export const emptyRtCrExposureDefaults: RtCrExposureDefaults = {
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
  plateSize: '',
  beamAngle: '',
  beamAngleUnit: 'deg',
  screenOverride: '',
  overlap: '',
  identification: '',
  notes: '',
};

export const createEmptyRtCrExposureView = (id: string): RtCrExposureView => ({
  ...emptyRtCrExposureDefaults,
  id,
  viewId: '',
  description: '',
  orientation: '',
  inspectionZone: '',
  referenceAttachmentId: '',
});

export const emptyRtCrSheet: RtCrSheet = {
  general: { ...emptyRtPtGeneralInfo },
  exposureDefaults: { ...emptyRtCrExposureDefaults },
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
  plateSystem: {
    manufacturer: '',
    plateDesignation: '',
    plateClass: '',
    cassetteType: '',
    frontScreen: { material: '', thickness: '', thicknessUnit: 'mm' },
    backScreen: { material: '', thickness: '', thicknessUnit: 'mm' },
    erasureRequirement: '',
    plateConditionRequirement: '',
  },
  scanner: {
    manufacturer: '',
    model: '',
    serialNumber: '',
    pixelPitch: '',
    pixelPitchUnit: 'um',
    laserSpotSize: '',
    laserSpotSizeUnit: 'um',
    scanResolutionPixelsPerMm: '',
    pmtGainOrVoltage: '',
    calibrationRequirement: '',
    qualification: { reference: '', date: '', dueDate: '', status: '' },
  },
  imageQuality: {
    requiredSrb: '',
    requiredSrbUnit: 'um',
    greyValueMin: '',
    greyValueMax: '',
    requiredSnrMin: '',
    duplexWireRequirement: '',
    maxScanDelay: '',
    maxScanDelayUnit: '',
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
