import type { LengthUnit, NumberOrEmpty } from '@/types/rtFilm';
import { lengthToMillimeters, millimetersToLength } from '@/lib/rtGeometry';

/**
 * EN ISO 17636 test-class (A / B) geometric and density rules shared by the
 * RT-Film (part 1) and RT-CR (part 2) techniques.
 *
 * Encoded content is limited to the stable, formula-level requirements:
 * - Minimum source-to-object distance: f >= k * d * b^(2/3), with the source
 *   size d and the object-to-detector distance b in millimetres and
 *   k = 7.5 for test class A, k = 15 for test class B (ISO 17636-1 clause 7.6;
 *   ISO 17636-2 carries the same geometric relationship).
 * - Minimum film optical density (ISO 17636-1): class A >= 2.0, class B >= 2.3.
 *   These are the base requirements; allowances in the controlled standard
 *   text (e.g. reduced density with agreed viewing conditions) govern.
 * Class-dependent IQI and SNR tables are NOT encoded here — the controlled
 * revision of the standard remains the authority for them.
 */

export type Iso17636TestClass = 'A' | 'B';

export const ISO_17636_TEST_CLASSES: ReadonlyArray<Iso17636TestClass> = ['A', 'B'];

const CLASS_DISTANCE_FACTOR: Record<Iso17636TestClass, number> = {
  A: 7.5,
  B: 15,
};

/** Base minimum film optical density per ISO 17636-1 test class. */
export const ISO_17636_1_MINIMUM_DENSITY: Record<Iso17636TestClass, number> = {
  A: 2,
  B: 2.3,
};

const round = (value: number, decimals: number): number => {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
};

export interface Iso17636MinimumSodResult {
  testClass: Iso17636TestClass;
  /** Minimum source-to-object distance in the requested output unit. */
  minimumSod: number;
  outputUnit: LengthUnit;
  /** The f >= k * d * b^(2/3) inputs, converted to millimetres. */
  sourceSizeMm: number;
  objectToDetectorMm: number;
  factor: number;
}

/**
 * Minimum source-to-object distance for the selected test class. Returns null
 * instead of guessing when the source size or object-to-detector distance is
 * missing or non-positive.
 */
export function calculateIso17636MinimumSod(
  testClass: Iso17636TestClass,
  sourceSize: NumberOrEmpty,
  sourceSizeUnit: LengthUnit,
  objectToDetectorDistance: NumberOrEmpty,
  objectToDetectorDistanceUnit: LengthUnit,
  outputUnit: LengthUnit,
): Iso17636MinimumSodResult | null {
  if (
    sourceSize === ''
    || objectToDetectorDistance === ''
    || !Number.isFinite(sourceSize)
    || !Number.isFinite(objectToDetectorDistance)
    || sourceSize <= 0
    || objectToDetectorDistance <= 0
  ) {
    return null;
  }
  const sourceSizeMm = lengthToMillimeters(sourceSize, sourceSizeUnit);
  const objectToDetectorMm = lengthToMillimeters(objectToDetectorDistance, objectToDetectorDistanceUnit);
  const factor = CLASS_DISTANCE_FACTOR[testClass];
  const minimumSodMm = factor * sourceSizeMm * objectToDetectorMm ** (2 / 3);
  return {
    testClass,
    minimumSod: round(millimetersToLength(minimumSodMm, outputUnit), outputUnit === 'inch' ? 3 : 1),
    outputUnit,
    sourceSizeMm: round(sourceSizeMm, 4),
    objectToDetectorMm: round(objectToDetectorMm, 4),
    factor,
  };
}
