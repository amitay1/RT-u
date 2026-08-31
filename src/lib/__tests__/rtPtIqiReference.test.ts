import { describe, expect, it } from 'vitest';
import {
  ASTM_E747_WIRE_SETS,
  ASTM_E747_WIRE_TABLE,
  ASTM_E1025_PLAQUE_TABLE,
  calculateE1025EpsProfile,
  calculateEquivalentPenetrameterSensitivity,
  resolveE1025Designation,
} from '@/lib/rtIqiReference';

describe('ASTM E747 wire reference data', () => {
  it('tabulates the 21-wire inch series with derived metric diameters', () => {
    expect(ASTM_E747_WIRE_TABLE).toHaveLength(21);
    expect(ASTM_E747_WIRE_TABLE[0]).toMatchObject({ wireNumber: 1, diameterInch: 0.0032 });
    expect(ASTM_E747_WIRE_TABLE[20]).toMatchObject({ wireNumber: 21, diameterInch: 0.32, diameterMm: 8.128 });
    expect(ASTM_E747_WIRE_TABLE[5]).toMatchObject({ wireNumber: 6, diameterInch: 0.01, diameterMm: 0.254 });
  });

  it('groups sets A-D as six consecutive wires sharing one wire at each seam', () => {
    const bySet = Object.fromEntries(ASTM_E747_WIRE_SETS.map((entry) => [entry.set, entry]));
    expect(bySet.A.wires.map((w) => w.wireNumber)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(bySet.B.wires.map((w) => w.wireNumber)).toEqual([6, 7, 8, 9, 10, 11]);
    expect(bySet.C.wires.map((w) => w.wireNumber)).toEqual([11, 12, 13, 14, 15, 16]);
    expect(bySet.D.wires.map((w) => w.wireNumber)).toEqual([16, 17, 18, 19, 20, 21]);
    expect(bySet.A.wires.every((w) => w.diameterInch > 0)).toBe(true);
  });
});

describe('ASTM E1025 plaque reference data', () => {
  it('derives plaque thickness from the designation and applies the minimum hole diameters', () => {
    const plaque5 = ASTM_E1025_PLAQUE_TABLE.find((row) => row.designation === 5);
    expect(plaque5).toMatchObject({
      thicknessInch: 0.005,
      hole1TInch: 0.01, // 1T = 0.005 raised to the 0.010 minimum
      hole2TInch: 0.02, // 2T = 0.010 raised to the 0.020 minimum
      hole4TInch: 0.04, // 4T = 0.020 raised to the 0.040 minimum
    });

    const plaque50 = ASTM_E1025_PLAQUE_TABLE.find((row) => row.designation === 50);
    expect(plaque50).toMatchObject({
      thicknessInch: 0.05,
      hole1TInch: 0.05,
      hole2TInch: 0.1,
      hole4TInch: 0.2,
    });
  });

  it('resolves free-text designations and rejects unlisted ones', () => {
    expect(resolveE1025Designation('10')?.designation).toBe(10);
    expect(resolveE1025Designation('No. 25')?.designation).toBe(25);
    expect(resolveE1025Designation('ASTM E1025-40')?.designation).toBe(40);
    expect(resolveE1025Designation('13')).toBeNull();
    expect(resolveE1025Designation('')).toBeNull();
    expect(resolveE1025Designation('wire set B')).toBeNull();
  });
});

describe('Equivalent Penetrameter Sensitivity', () => {
  it('reproduces the textbook 2-2T on a half-inch part as exactly 2.0 percent', () => {
    // Plaque 10 (T = 0.010 in), 2T hole (H = 0.020 in), X = 0.5 in:
    // EPS = (100 / 0.5) * sqrt(0.010 * 0.020 / 2) = 200 * 0.01 = 2.0
    expect(calculateEquivalentPenetrameterSensitivity(0.5, 'inch', 0.01, 0.02)).toBe(2);
    expect(calculateEquivalentPenetrameterSensitivity(12.7, 'mm', 0.01, 0.02)).toBe(2);
  });

  it('returns null instead of guessing on missing or non-positive inputs', () => {
    expect(calculateEquivalentPenetrameterSensitivity('', 'inch', 0.01, 0.02)).toBeNull();
    expect(calculateEquivalentPenetrameterSensitivity(0, 'inch', 0.01, 0.02)).toBeNull();
    expect(calculateEquivalentPenetrameterSensitivity(0.5, 'inch', 0, 0.02)).toBeNull();
    expect(calculateEquivalentPenetrameterSensitivity(0.5, 'inch', 0.01, 0)).toBeNull();
  });

  it('profiles EPS at the 1T/2T/4T holes of a resolved designation', () => {
    const profile = calculateE1025EpsProfile('10', 0.5, 'inch');
    expect(profile).not.toBeNull();
    expect(profile?.plaque.designation).toBe(10);
    expect(profile?.eps1T).toBeCloseTo(1.41, 2);
    expect(profile?.eps2T).toBe(2);
    expect(profile?.eps4T).toBeCloseTo(2.83, 2);
    expect(calculateE1025EpsProfile('13', 0.5, 'inch')).toBeNull();
  });
});
