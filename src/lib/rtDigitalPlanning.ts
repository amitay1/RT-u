import type {
  DetectorLengthUnit,
  NumberOrEmpty,
  RtDigitalDetectorOrientation,
  RtDigitalDistanceBasis,
  RtDigitalInspectionArea,
  RtDigitalLengthInput,
  RtDigitalPartDefinition,
} from '@/types/rtDigital';

const MILLIMETRES_PER_UNIT: Record<DetectorLengthUnit, number> = {
  um: 0.001,
  mm: 1,
  inch: 25.4,
};

const CALCULATION_TOLERANCE = 1e-9;
export const RT_DIGITAL_MAX_EXPOSURE_GRID_SIZE = 10_000;

export type RtDigitalCalculationStatus = 'complete' | 'incomplete' | 'invalid';
export type RtDigitalRequirementStatus = 'pass' | 'fail' | null;
export type RtDigitalDerivedDistance = 'sod' | 'sdd' | 'odd' | null;
export type RtDigitalCoverageWarning = 'underlap' | 'excessive-overlap';

/**
 * Resolves the Section 01 inspection footprint used by coverage calculations.
 * "Entire Part" derives a transient footprint from the controlled geometry so
 * a duplicate editable inspection-area record is not persisted.
 */
export function resolveRtDigitalInspectionArea(
  part: RtDigitalPartDefinition,
  preferredId = '',
): RtDigitalInspectionArea | null {
  const explicit = part.inspectionAreas.areas.find((area) => area.id === preferredId)
    ?? part.inspectionAreas.areas[0]
    ?? null;
  if (part.inspectionAreas.mode !== 'Entire Part') return explicit;

  const geometry = part.geometry;
  let width: NumberOrEmpty = '';
  let height: NumberOrEmpty = '';
  if (geometry.geometryType === 'Flat / Plate' || geometry.geometryType === 'Rectangular') {
    width = geometry.length;
    height = geometry.width;
  } else if (
    geometry.geometryType === 'Pipe / Tube'
    || geometry.geometryType === 'Cylinder'
    || geometry.geometryType === 'Ring'
  ) {
    width = geometry.outsideDiameter;
    height = geometry.length;
  } else if (geometry.geometryType === 'Cone') {
    width = geometry.majorDiameter;
    height = geometry.height;
  } else if (geometry.geometryType === 'Complex Casting') {
    width = geometry.boundingLength;
    height = geometry.boundingWidth;
  } else {
    return explicit;
  }

  return {
    id: `${part.inspectionAreas.id}-entire-part`,
    areaId: 'ENTIRE-PART',
    description: 'Entire part footprint derived from controlled part geometry',
    width,
    height,
    unit: geometry.unit,
    position: { x: 0, y: 0, width: 1, height: 1, rotationDegrees: 0 },
  };
}

export interface RtDigitalGeometryCalculationInput {
  distanceBasis?: RtDigitalDistanceBasis;
  sod: RtDigitalLengthInput;
  sdd: RtDigitalLengthInput;
  odd: RtDigitalLengthInput;
  focalSpotSize: RtDigitalLengthInput;
  requiredMaximumUg: RtDigitalLengthInput;
  detectorPixelSize: RtDigitalLengthInput;
  detectorActiveWidth: RtDigitalLengthInput;
  detectorActiveHeight: RtDigitalLengthInput;
  requiredMaximumEffectivePixel?: RtDigitalLengthInput;
}

export interface RtDigitalGeometryCalculationResult {
  status: RtDigitalCalculationStatus;
  issues: string[];
  derivedDistance: RtDigitalDerivedDistance;
  sodMm: number | null;
  sddMm: number | null;
  oddMm: number | null;
  magnification: number | null;
  ugMm: number | null;
  minimumSodMm: number | null;
  maximumOddMm: number | null;
  ugStatus: RtDigitalRequirementStatus;
  effectiveObjectPixelMm: number | null;
  objectFovWidthMm: number | null;
  objectFovHeightMm: number | null;
  resolutionStatus: RtDigitalRequirementStatus;
}

export interface RtDigitalCoverageInput {
  inspectionAreaWidth: RtDigitalLengthInput;
  inspectionAreaHeight: RtDigitalLengthInput;
  objectFovWidth: RtDigitalLengthInput;
  objectFovHeight: RtDigitalLengthInput;
  requiredOverlapPercent: NumberOrEmpty;
  excessiveOverlapThresholdPercent?: NumberOrEmpty;
  /** Optional manual grid counts allow the engine to detect underlap in an overridden layout. */
  exposureCountX?: NumberOrEmpty;
  exposureCountY?: NumberOrEmpty;
  orientation?: Exclude<RtDigitalDetectorOrientation, 'Auto' | ''>;
}

export interface RtDigitalCoverageAxisResult {
  areaLengthMm: number;
  fovLengthMm: number;
  requestedPitchMm: number;
  pitchMm: number;
  count: number;
  coverageComplete: boolean;
  actualOverlapMm: number | null;
  actualOverlapPercent: number | null;
  underlap: boolean;
  excessiveOverlap: boolean;
}

export interface RtDigitalExposureGridDescriptor {
  id: string;
  exposureNumber: number;
  row: number;
  column: number;
  centerXmm: number;
  centerYmm: number;
  footprintWidthMm: number;
  footprintHeightMm: number;
  orientation: Exclude<RtDigitalDetectorOrientation, 'Auto' | ''>;
}

export interface RtDigitalCoverageResult {
  status: RtDigitalCalculationStatus;
  issues: string[];
  x: RtDigitalCoverageAxisResult | null;
  y: RtDigitalCoverageAxisResult | null;
  totalExposureCount: number | null;
  warnings: RtDigitalCoverageWarning[];
  grid: RtDigitalExposureGridDescriptor[];
}

export interface RtDigitalOrientationOptimizationInput {
  inspectionAreaWidth: RtDigitalLengthInput;
  inspectionAreaHeight: RtDigitalLengthInput;
  detectorActiveWidth: RtDigitalLengthInput;
  detectorActiveHeight: RtDigitalLengthInput;
  magnification: NumberOrEmpty;
  requiredOverlapPercent: NumberOrEmpty;
  excessiveOverlapThresholdPercent?: NumberOrEmpty;
}

export interface RtDigitalOrientationOption {
  orientation: 'Portrait' | 'Landscape';
  objectFovWidthMm: number | null;
  objectFovHeightMm: number | null;
  coverage: RtDigitalCoverageResult;
}

export interface RtDigitalOrientationOptimizationResult {
  status: RtDigitalCalculationStatus;
  preferredOrientation: 'Portrait' | 'Landscape' | null;
  portrait: RtDigitalOrientationOption;
  landscape: RtDigitalOrientationOption;
}

export interface RtDigitalPlanningCalculationInput {
  geometry: RtDigitalGeometryCalculationInput;
  inspectionAreaWidth: RtDigitalLengthInput;
  inspectionAreaHeight: RtDigitalLengthInput;
  requiredOverlapPercent: NumberOrEmpty;
  excessiveOverlapThresholdPercent?: NumberOrEmpty;
}

export interface RtDigitalPlanningCalculationResult {
  geometry: RtDigitalGeometryCalculationResult;
  orientation: RtDigitalOrientationOptimizationResult;
}

/** Converts a finite controlled length to another supported unit; blanks and invalid values return null. */
export function convertRtDigitalLength(
  value: NumberOrEmpty,
  fromUnit: DetectorLengthUnit,
  toUnit: DetectorLengthUnit = 'mm',
): number | null {
  if (value === '' || typeof value !== 'number' || !Number.isFinite(value)) return null;
  return (value * MILLIMETRES_PER_UNIT[fromUnit]) / MILLIMETRES_PER_UNIT[toUnit];
}

function lengthInMm(input: RtDigitalLengthInput): number | null {
  return convertRtDigitalLength(input.value, input.unit, 'mm');
}

function finitePositive(value: number | null): value is number {
  return value !== null && value > 0;
}

function finiteNonNegative(value: number | null): value is number {
  return value !== null && value >= 0;
}

function almostEqual(left: number, right: number): boolean {
  const scale = Math.max(1, Math.abs(left), Math.abs(right));
  return Math.abs(left - right) <= CALCULATION_TOLERANCE * scale;
}

function roundOutput(value: number): number {
  return Math.round(value * 1e9) / 1e9;
}

interface DistanceSolution {
  status: RtDigitalCalculationStatus;
  issues: string[];
  sodMm: number | null;
  sddMm: number | null;
  oddMm: number | null;
  derivedDistance: RtDigitalDerivedDistance;
}

function solveDistances(input: RtDigitalGeometryCalculationInput): DistanceSolution {
  const entered = {
    sod: lengthInMm(input.sod),
    sdd: lengthInMm(input.sdd),
    odd: lengthInMm(input.odd),
  };
  const issues: string[] = [];

  if (entered.sod !== null && !finitePositive(entered.sod)) issues.push('SOD must be greater than zero.');
  if (entered.sdd !== null && !finitePositive(entered.sdd)) issues.push('SDD must be greater than zero.');
  if (entered.odd !== null && !finiteNonNegative(entered.odd)) issues.push('ODD must not be negative.');
  if (issues.length) {
    return { status: 'invalid', issues, sodMm: null, sddMm: null, oddMm: null, derivedDistance: null };
  }

  const basis = input.distanceBasis ?? '';
  let sod = entered.sod;
  let sdd = entered.sdd;
  let odd = entered.odd;
  let derivedDistance: RtDigitalDerivedDistance = null;

  if (basis === 'SOD + ODD') {
    sdd = null;
    if (!finitePositive(sod) || !finiteNonNegative(odd)) {
      return { status: 'incomplete', issues: ['SOD and ODD are required.'], sodMm: sod, sddMm: null, oddMm: odd, derivedDistance: null };
    }
  } else if (basis === 'SDD - ODD') {
    sod = null;
    if (!finitePositive(sdd) || !finiteNonNegative(odd)) {
      return { status: 'incomplete', issues: ['SDD and ODD are required.'], sodMm: null, sddMm: sdd, oddMm: odd, derivedDistance: null };
    }
  } else if (basis === 'SDD - SOD') {
    odd = null;
    if (!finitePositive(sdd) || !finitePositive(sod)) {
      return { status: 'incomplete', issues: ['SDD and SOD are required.'], sodMm: sod, sddMm: sdd, oddMm: null, derivedDistance: null };
    }
  }

  if (finitePositive(sod) && finiteNonNegative(odd) && sdd === null) {
    sdd = sod + odd;
    derivedDistance = 'sdd';
  } else if (finitePositive(sdd) && finiteNonNegative(odd) && sod === null) {
    sod = sdd - odd;
    derivedDistance = 'sod';
  } else if (finitePositive(sdd) && finitePositive(sod) && odd === null) {
    odd = sdd - sod;
    derivedDistance = 'odd';
  } else if (finitePositive(sod) && finitePositive(sdd) && finiteNonNegative(odd)) {
    if (!almostEqual(sod + odd, sdd)) {
      return {
        status: 'invalid',
        issues: ['SOD, SDD and ODD are inconsistent (SDD must equal SOD + ODD).'],
        sodMm: null,
        sddMm: null,
        oddMm: null,
        derivedDistance: null,
      };
    }
  } else {
    return {
      status: 'incomplete',
      issues: ['Enter any controlled pair of SOD, SDD and ODD.'],
      sodMm: sod,
      sddMm: sdd,
      oddMm: odd,
      derivedDistance: null,
    };
  }

  if (!finitePositive(sod) || !finitePositive(sdd) || !finiteNonNegative(odd) || sdd < sod) {
    return {
      status: 'invalid',
      issues: ['The selected distances do not produce a valid radiographic geometry.'],
      sodMm: null,
      sddMm: null,
      oddMm: null,
      derivedDistance: null,
    };
  }

  return {
    status: 'complete',
    issues,
    sodMm: roundOutput(sod),
    sddMm: roundOutput(sdd),
    oddMm: roundOutput(odd),
    derivedDistance,
  };
}

/** Calculates geometry without mutating or returning fields intended for persistence. */
export function calculateRtDigitalGeometry(
  input: RtDigitalGeometryCalculationInput,
): RtDigitalGeometryCalculationResult {
  const distances = solveDistances(input);
  const emptyResult: RtDigitalGeometryCalculationResult = {
    status: distances.status,
    issues: distances.issues,
    derivedDistance: distances.derivedDistance,
    sodMm: distances.sodMm,
    sddMm: distances.sddMm,
    oddMm: distances.oddMm,
    magnification: null,
    ugMm: null,
    minimumSodMm: null,
    maximumOddMm: null,
    ugStatus: null,
    effectiveObjectPixelMm: null,
    objectFovWidthMm: null,
    objectFovHeightMm: null,
    resolutionStatus: null,
  };
  if (distances.status !== 'complete'
    || distances.sodMm === null
    || distances.sddMm === null
    || distances.oddMm === null) return emptyResult;

  const magnification = distances.sddMm / distances.sodMm;
  const focalSpotMm = lengthInMm(input.focalSpotSize);
  const requiredUgMm = lengthInMm(input.requiredMaximumUg);
  const pixelMm = lengthInMm(input.detectorPixelSize);
  const detectorWidthMm = lengthInMm(input.detectorActiveWidth);
  const detectorHeightMm = lengthInMm(input.detectorActiveHeight);
  const requiredEffectivePixelMm = input.requiredMaximumEffectivePixel
    ? lengthInMm(input.requiredMaximumEffectivePixel)
    : null;

  const ugMm = finitePositive(focalSpotMm)
    ? focalSpotMm * distances.oddMm / distances.sodMm
    : null;
  const minimumSodMm = finitePositive(focalSpotMm) && finitePositive(requiredUgMm)
    ? focalSpotMm * distances.oddMm / requiredUgMm
    : null;
  const maximumOddMm = finitePositive(focalSpotMm) && finitePositive(requiredUgMm)
    ? requiredUgMm * distances.sodMm / focalSpotMm
    : null;
  const effectiveObjectPixelMm = finitePositive(pixelMm) ? pixelMm / magnification : null;
  const objectFovWidthMm = finitePositive(detectorWidthMm) ? detectorWidthMm / magnification : null;
  const objectFovHeightMm = finitePositive(detectorHeightMm) ? detectorHeightMm / magnification : null;

  return {
    ...emptyResult,
    magnification: roundOutput(magnification),
    ugMm: ugMm === null ? null : roundOutput(ugMm),
    minimumSodMm: minimumSodMm === null ? null : roundOutput(minimumSodMm),
    maximumOddMm: maximumOddMm === null ? null : roundOutput(maximumOddMm),
    ugStatus: ugMm !== null && finitePositive(requiredUgMm)
      ? (ugMm <= requiredUgMm + CALCULATION_TOLERANCE ? 'pass' : 'fail')
      : null,
    effectiveObjectPixelMm: effectiveObjectPixelMm === null ? null : roundOutput(effectiveObjectPixelMm),
    objectFovWidthMm: objectFovWidthMm === null ? null : roundOutput(objectFovWidthMm),
    objectFovHeightMm: objectFovHeightMm === null ? null : roundOutput(objectFovHeightMm),
    resolutionStatus: effectiveObjectPixelMm !== null && finitePositive(requiredEffectivePixelMm)
      ? (effectiveObjectPixelMm <= requiredEffectivePixelMm + CALCULATION_TOLERANCE ? 'pass' : 'fail')
      : null,
  };
}

function calculateCoverageAxis(
  areaLengthMm: number,
  fovLengthMm: number,
  requiredOverlapPercent: number,
  excessiveOverlapThresholdPercent: number,
  requestedCount?: number,
): RtDigitalCoverageAxisResult {
  const requestedPitchMm = fovLengthMm * (1 - requiredOverlapPercent / 100);
  const count = requestedCount ?? (areaLengthMm <= fovLengthMm
    ? 1
    : Math.ceil((areaLengthMm - fovLengthMm) / requestedPitchMm) + 1);
  const pitchMm = count === 1 ? 0 : Math.max(0, (areaLengthMm - fovLengthMm) / (count - 1));
  const actualOverlapMm = count === 1 ? null : fovLengthMm - pitchMm;
  const actualOverlapPercent = actualOverlapMm === null ? null : (actualOverlapMm / fovLengthMm) * 100;
  const coverageComplete = count > 1 || areaLengthMm <= fovLengthMm + CALCULATION_TOLERANCE;
  const underlap = !coverageComplete || (actualOverlapPercent !== null
    && actualOverlapPercent + CALCULATION_TOLERANCE < requiredOverlapPercent);
  const excessiveOverlap = actualOverlapPercent !== null
    && actualOverlapPercent > excessiveOverlapThresholdPercent + CALCULATION_TOLERANCE;

  return {
    areaLengthMm: roundOutput(areaLengthMm),
    fovLengthMm: roundOutput(fovLengthMm),
    requestedPitchMm: roundOutput(requestedPitchMm),
    pitchMm: roundOutput(pitchMm),
    count,
    coverageComplete,
    actualOverlapMm: actualOverlapMm === null ? null : roundOutput(actualOverlapMm),
    actualOverlapPercent: actualOverlapPercent === null ? null : roundOutput(actualOverlapPercent),
    underlap,
    excessiveOverlap,
  };
}

export function createRtDigitalExposureGrid(
  x: RtDigitalCoverageAxisResult,
  y: RtDigitalCoverageAxisResult,
  orientation: Exclude<RtDigitalDetectorOrientation, 'Auto' | ''> = 'Landscape',
): RtDigitalExposureGridDescriptor[] {
  const descriptors: RtDigitalExposureGridDescriptor[] = [];
  const total = x.count * y.count;
  const digits = Math.max(3, String(total).length);
  let exposureNumber = 1;
  for (let row = 0; row < y.count; row += 1) {
    for (let column = 0; column < x.count; column += 1) {
      const centerXmm = x.count === 1
        ? x.areaLengthMm / 2
        : x.fovLengthMm / 2 + column * x.pitchMm;
      const centerYmm = y.count === 1
        ? y.areaLengthMm / 2
        : y.fovLengthMm / 2 + row * y.pitchMm;
      descriptors.push({
        id: `EXP-${String(exposureNumber).padStart(digits, '0')}`,
        exposureNumber,
        row: row + 1,
        column: column + 1,
        centerXmm: roundOutput(centerXmm),
        centerYmm: roundOutput(centerYmm),
        footprintWidthMm: x.fovLengthMm,
        footprintHeightMm: y.fovLengthMm,
        orientation,
      });
      exposureNumber += 1;
    }
  }
  return descriptors;
}

export function calculateRtDigitalCoverage(input: RtDigitalCoverageInput): RtDigitalCoverageResult {
  const areaWidthMm = lengthInMm(input.inspectionAreaWidth);
  const areaHeightMm = lengthInMm(input.inspectionAreaHeight);
  const fovWidthMm = lengthInMm(input.objectFovWidth);
  const fovHeightMm = lengthInMm(input.objectFovHeight);
  const requiredOverlapPercent = input.requiredOverlapPercent;
  const thresholdInput = input.excessiveOverlapThresholdPercent;
  const issues: string[] = [];
  const requestedCountX = input.exposureCountX === '' || input.exposureCountX === undefined
    ? undefined
    : input.exposureCountX;
  const requestedCountY = input.exposureCountY === '' || input.exposureCountY === undefined
    ? undefined
    : input.exposureCountY;

  if ([areaWidthMm, areaHeightMm, fovWidthMm, fovHeightMm].some((value) => value === null)) {
    return { status: 'incomplete', issues: ['Inspection dimensions and object FOV are required.'], x: null, y: null, totalExposureCount: null, warnings: [], grid: [] };
  }
  if (!finitePositive(areaWidthMm) || !finitePositive(areaHeightMm)
    || !finitePositive(fovWidthMm) || !finitePositive(fovHeightMm)) {
    issues.push('Inspection dimensions and object FOV must be greater than zero.');
  }
  if (requiredOverlapPercent === '') {
    return { status: 'incomplete', issues: ['Required overlap is required.'], x: null, y: null, totalExposureCount: null, warnings: [], grid: [] };
  }
  if (!Number.isFinite(requiredOverlapPercent) || requiredOverlapPercent < 0 || requiredOverlapPercent >= 100) {
    issues.push('Required overlap must be from 0 up to, but not including, 100 percent.');
  }
  const defaultExcessiveThreshold = Math.min(99.999999, Math.max(50, requiredOverlapPercent + 15));
  const excessiveThreshold = thresholdInput === '' || thresholdInput === undefined
    ? defaultExcessiveThreshold
    : thresholdInput;
  if (!Number.isFinite(excessiveThreshold)
    || excessiveThreshold < requiredOverlapPercent
    || excessiveThreshold >= 100) {
    issues.push('The excessive-overlap threshold must be at least the required overlap and less than 100 percent.');
  }
  if ((requestedCountX !== undefined && (!Number.isInteger(requestedCountX) || requestedCountX < 1))
    || (requestedCountY !== undefined && (!Number.isInteger(requestedCountY) || requestedCountY < 1))) {
    issues.push('Manual exposure counts must be positive integers.');
  }
  if (issues.length || areaWidthMm === null || areaHeightMm === null || fovWidthMm === null || fovHeightMm === null) {
    return { status: 'invalid', issues, x: null, y: null, totalExposureCount: null, warnings: [], grid: [] };
  }

  const x = calculateCoverageAxis(
    areaWidthMm,
    fovWidthMm,
    requiredOverlapPercent,
    excessiveThreshold,
    requestedCountX,
  );
  const y = calculateCoverageAxis(
    areaHeightMm,
    fovHeightMm,
    requiredOverlapPercent,
    excessiveThreshold,
    requestedCountY,
  );
  const warnings: RtDigitalCoverageWarning[] = [];
  if (x.underlap || y.underlap) warnings.push('underlap');
  if (x.excessiveOverlap || y.excessiveOverlap) warnings.push('excessive-overlap');
  const orientation = input.orientation ?? 'Landscape';
  const totalExposureCount = x.count * y.count;
  if (!Number.isSafeInteger(totalExposureCount) || totalExposureCount > RT_DIGITAL_MAX_EXPOSURE_GRID_SIZE) {
    return {
      status: 'invalid',
      issues: [`The calculated grid exceeds ${RT_DIGITAL_MAX_EXPOSURE_GRID_SIZE} exposures.`],
      x: null,
      y: null,
      totalExposureCount: null,
      warnings,
      grid: [],
    };
  }

  return {
    status: 'complete',
    issues,
    x,
    y,
    totalExposureCount,
    warnings,
    grid: createRtDigitalExposureGrid(x, y, orientation),
  };
}

function invalidCoverage(message: string): RtDigitalCoverageResult {
  return { status: 'invalid', issues: [message], x: null, y: null, totalExposureCount: null, warnings: [], grid: [] };
}

/** Compares both detector rotations and deterministically chooses the smaller grid (Landscape on a tie). */
export function optimizeRtDigitalDetectorOrientation(
  input: RtDigitalOrientationOptimizationInput,
): RtDigitalOrientationOptimizationResult {
  const detectorWidthMm = lengthInMm(input.detectorActiveWidth);
  const detectorHeightMm = lengthInMm(input.detectorActiveHeight);
  const magnification = input.magnification;
  const valid = finitePositive(detectorWidthMm)
    && finitePositive(detectorHeightMm)
    && magnification !== ''
    && Number.isFinite(magnification)
    && magnification >= 1;

  const option = (
    orientation: 'Portrait' | 'Landscape',
    fovWidthMm: number | null,
    fovHeightMm: number | null,
  ): RtDigitalOrientationOption => ({
    orientation,
    objectFovWidthMm: fovWidthMm === null ? null : roundOutput(fovWidthMm),
    objectFovHeightMm: fovHeightMm === null ? null : roundOutput(fovHeightMm),
    coverage: fovWidthMm === null || fovHeightMm === null
      ? invalidCoverage('Detector dimensions and a magnification of at least 1 are required.')
      : calculateRtDigitalCoverage({
          inspectionAreaWidth: input.inspectionAreaWidth,
          inspectionAreaHeight: input.inspectionAreaHeight,
          objectFovWidth: { value: fovWidthMm, unit: 'mm' },
          objectFovHeight: { value: fovHeightMm, unit: 'mm' },
          requiredOverlapPercent: input.requiredOverlapPercent,
          excessiveOverlapThresholdPercent: input.excessiveOverlapThresholdPercent,
          orientation,
        }),
  });

  const landscape = option(
    'Landscape',
    valid ? detectorWidthMm / magnification : null,
    valid ? detectorHeightMm / magnification : null,
  );
  const portrait = option(
    'Portrait',
    valid ? detectorHeightMm / magnification : null,
    valid ? detectorWidthMm / magnification : null,
  );
  if (!valid) return { status: 'invalid', preferredOrientation: null, portrait, landscape };
  if (portrait.coverage.status !== 'complete' || landscape.coverage.status !== 'complete') {
    const status = portrait.coverage.status === 'incomplete' || landscape.coverage.status === 'incomplete'
      ? 'incomplete'
      : 'invalid';
    return { status, preferredOrientation: null, portrait, landscape };
  }

  const portraitCount = portrait.coverage.totalExposureCount ?? Number.POSITIVE_INFINITY;
  const landscapeCount = landscape.coverage.totalExposureCount ?? Number.POSITIVE_INFINITY;
  return {
    status: 'complete',
    preferredOrientation: portraitCount < landscapeCount ? 'Portrait' : 'Landscape',
    portrait,
    landscape,
  };
}

/** Runs geometry and orientation/coverage as one pure calculation for live planners. */
export function calculateRtDigitalPlanning(
  input: RtDigitalPlanningCalculationInput,
): RtDigitalPlanningCalculationResult {
  const geometry = calculateRtDigitalGeometry(input.geometry);
  const orientation = optimizeRtDigitalDetectorOrientation({
    inspectionAreaWidth: input.inspectionAreaWidth,
    inspectionAreaHeight: input.inspectionAreaHeight,
    detectorActiveWidth: input.geometry.detectorActiveWidth,
    detectorActiveHeight: input.geometry.detectorActiveHeight,
    magnification: geometry.magnification ?? '',
    requiredOverlapPercent: input.requiredOverlapPercent,
    excessiveOverlapThresholdPercent: input.excessiveOverlapThresholdPercent,
  });
  return { geometry, orientation };
}
