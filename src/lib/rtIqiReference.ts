import type { LengthUnit, NumberOrEmpty } from '@/types/rtFilm';

/**
 * Built-in ASTM wire and hole-type IQI dimensional reference data.
 *
 * Scope and honesty rules, matching the PS811000 module conventions:
 * - This is DIMENSIONAL identity data (wire diameters, set membership, plaque
 *   thickness and hole sizes) transcribed from the well-established ASTM
 *   E747 / E1025 series tables. It is display/lookup reference only — nothing
 *   here selects a required IQI for a technique and nothing is inserted into
 *   the controlled document. The governing specification in force decides the
 *   required designation and quality level.
 * - Values outside these tables return null; no interpolation, no guessing.
 * - Verify against the controlled revision of the standard before release use;
 *   these series have been stable across revisions, but the controlled text wins.
 */

const INCHES_PER_MM = 1 / 25.4;
const round = (value: number, decimals: number): number => {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
};
const inchToMm = (inch: number): number => round(inch * 25.4, 4);

/** ASTM E747 wire identity numbers 1-21 with diameters in inches (mm derived). */
export interface E747Wire {
  wireNumber: number;
  diameterInch: number;
  diameterMm: number;
}

const E747_WIRE_DIAMETERS_INCH: ReadonlyArray<number> = [
  0.0032, 0.004, 0.005, 0.0063, 0.008, 0.010,
  0.013, 0.016, 0.020, 0.025, 0.032,
  0.040, 0.050, 0.063, 0.080, 0.100,
  0.126, 0.160, 0.200, 0.250, 0.320,
];

export const ASTM_E747_WIRE_TABLE: ReadonlyArray<E747Wire> = E747_WIRE_DIAMETERS_INCH.map(
  (diameterInch, index) => ({
    wireNumber: index + 1,
    diameterInch,
    diameterMm: inchToMm(diameterInch),
  }),
);

/** ASTM E747 wire sets A-D: six consecutive wires each, sharing one wire at each seam. */
export interface E747WireSet {
  set: 'A' | 'B' | 'C' | 'D';
  firstWire: number;
  lastWire: number;
  wires: ReadonlyArray<E747Wire>;
}

const buildWireSet = (set: E747WireSet['set'], firstWire: number, lastWire: number): E747WireSet => ({
  set,
  firstWire,
  lastWire,
  wires: ASTM_E747_WIRE_TABLE.slice(firstWire - 1, lastWire),
});

export const ASTM_E747_WIRE_SETS: ReadonlyArray<E747WireSet> = [
  buildWireSet('A', 1, 6),
  buildWireSet('B', 6, 11),
  buildWireSet('C', 11, 16),
  buildWireSet('D', 16, 21),
];

/**
 * ASTM E1025 hole-type (plaque) IQIs. The designation number is the plaque
 * thickness in mils (thousandths of an inch); hole diameters are 1T/2T/4T of
 * the plaque thickness, never smaller than the E1025 minimum hole diameters
 * of 0.010 / 0.020 / 0.040 inch respectively.
 */
export interface E1025Plaque {
  designation: number;
  thicknessInch: number;
  thicknessMm: number;
  hole1TInch: number;
  hole2TInch: number;
  hole4TInch: number;
}

const E1025_MINIMUM_HOLE_INCH = { oneT: 0.010, twoT: 0.020, fourT: 0.040 } as const;

/** Typical E1025 designation series; the controlled revision governs the full list. */
const E1025_DESIGNATIONS: ReadonlyArray<number> = [
  5, 7, 10, 12, 15, 17, 20, 25, 30, 35, 40, 45, 50, 60, 70, 80, 100, 120, 140, 160, 180, 200,
];

const buildPlaque = (designation: number): E1025Plaque => {
  const thicknessInch = designation / 1000;
  return {
    designation,
    thicknessInch,
    thicknessMm: inchToMm(thicknessInch),
    hole1TInch: round(Math.max(thicknessInch, E1025_MINIMUM_HOLE_INCH.oneT), 3),
    hole2TInch: round(Math.max(2 * thicknessInch, E1025_MINIMUM_HOLE_INCH.twoT), 3),
    hole4TInch: round(Math.max(4 * thicknessInch, E1025_MINIMUM_HOLE_INCH.fourT), 3),
  };
};

export const ASTM_E1025_PLAQUE_TABLE: ReadonlyArray<E1025Plaque> = E1025_DESIGNATIONS.map(buildPlaque);

/**
 * Resolves free text such as '10', 'No. 10', or 'ASTM E1025-10' to a plaque
 * row when the trailing number matches a tabulated designation; null otherwise.
 */
export const resolveE1025Designation = (raw: string): E1025Plaque | null => {
  const match = /(\d+)\s*$/.exec(raw.trim());
  if (!match) {
    return null;
  }
  const designation = Number(match[1]);
  return ASTM_E1025_PLAQUE_TABLE.find((row) => row.designation === designation) ?? null;
};

const toInches = (value: number, unit: LengthUnit): number => (unit === 'inch' ? value : value * INCHES_PER_MM);

/**
 * Equivalent Penetrameter Sensitivity per the E1025/E1742 relationship
 * EPS(%) = (100 / X) * sqrt(T * H / 2) with the part thickness X, plaque
 * thickness T, and hole diameter H in consistent units. Returns percent
 * rounded to two decimals, or null when any input is missing or non-positive.
 */
export const calculateEquivalentPenetrameterSensitivity = (
  partThickness: NumberOrEmpty,
  partThicknessUnit: LengthUnit,
  plaqueThicknessInch: number,
  holeDiameterInch: number,
): number | null => {
  if (partThickness === '' || !Number.isFinite(partThickness) || partThickness <= 0) {
    return null;
  }
  if (plaqueThicknessInch <= 0 || holeDiameterInch <= 0) {
    return null;
  }
  const partInch = toInches(partThickness, partThicknessUnit);
  if (partInch <= 0) {
    return null;
  }
  return round((100 / partInch) * Math.sqrt((plaqueThicknessInch * holeDiameterInch) / 2), 2);
};

export interface E1025EpsProfile {
  plaque: E1025Plaque;
  eps1T: number | null;
  eps2T: number | null;
  eps4T: number | null;
}

/** EPS at the 1T/2T/4T holes of a tabulated plaque for a given part thickness. */
export const calculateE1025EpsProfile = (
  designationText: string,
  partThickness: NumberOrEmpty,
  partThicknessUnit: LengthUnit,
): E1025EpsProfile | null => {
  const plaque = resolveE1025Designation(designationText);
  if (!plaque) {
    return null;
  }
  return {
    plaque,
    eps1T: calculateEquivalentPenetrameterSensitivity(partThickness, partThicknessUnit, plaque.thicknessInch, plaque.hole1TInch),
    eps2T: calculateEquivalentPenetrameterSensitivity(partThickness, partThicknessUnit, plaque.thicknessInch, plaque.hole2TInch),
    eps4T: calculateEquivalentPenetrameterSensitivity(partThickness, partThicknessUnit, plaque.thicknessInch, plaque.hole4TInch),
  };
};
