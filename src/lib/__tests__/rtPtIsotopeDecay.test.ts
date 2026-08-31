import { describe, expect, it } from 'vitest';
import {
  calculateDecayedActivity,
  differenceInCalendarDays,
  resolveRtIsotope,
  RT_ISOTOPE_LIBRARY,
} from '@/lib/rtIsotopeDecay';

describe('RT isotope decay planning', () => {
  it('resolves the supported isotopes from common free-text spellings', () => {
    expect(resolveRtIsotope('Ir-192')?.id).toBe('Ir-192');
    expect(resolveRtIsotope('ir 192')?.id).toBe('Ir-192');
    expect(resolveRtIsotope('IRIDIUM-192')?.id).toBe('Ir-192');
    expect(resolveRtIsotope('192Ir')?.id).toBe('Ir-192');
    expect(resolveRtIsotope('Se-75')?.id).toBe('Se-75');
    expect(resolveRtIsotope('cobalt 60')?.id).toBe('Co-60');
  });

  it('does not guess for unknown, ambiguous, or empty isotope text', () => {
    expect(resolveRtIsotope('')).toBeNull();
    expect(resolveRtIsotope('Yb-169')).toBeNull();
    expect(resolveRtIsotope('unknown source')).toBeNull();
  });

  it('measures whole calendar days and rejects malformed or impossible dates', () => {
    expect(differenceInCalendarDays('2026-01-01', '2026-01-31')).toBe(30);
    expect(differenceInCalendarDays('2026-01-31', '2026-01-01')).toBe(-30);
    expect(differenceInCalendarDays('2026-02-30', '2026-03-01')).toBeNull();
    expect(differenceInCalendarDays('01/02/2026', '2026-03-01')).toBeNull();
    expect(differenceInCalendarDays('', '2026-03-01')).toBeNull();
  });

  it('halves the activity after exactly one half-life', () => {
    const irIdium = RT_ISOTOPE_LIBRARY.find((entry) => entry.id === 'Ir-192');
    expect(irIdium).toBeDefined();
    // 73.83 days is not a whole number of days; use a synthetic 100-day half-life
    // to pin the exact halving behaviour, then check Ir-192 against the formula.
    const synthetic = calculateDecayedActivity(80, '2026-01-01', '2026-04-11', 100);
    expect(synthetic).not.toBeNull();
    expect(synthetic?.elapsedDays).toBe(100);
    expect(synthetic?.decayFactor).toBe(0.5);
    expect(synthetic?.decayedActivity).toBe(40);
    expect(synthetic?.exposureTimeMultiplier).toBe(2);

    const ir = calculateDecayedActivity(100, '2026-01-01', '2026-03-16', irIdium!.halfLifeDays);
    expect(ir).not.toBeNull();
    expect(ir?.elapsedDays).toBe(74);
    expect(ir?.decayFactor).toBeCloseTo(2 ** (-74 / 73.83), 4);
    expect(ir?.decayedActivity).toBeCloseTo(100 * 2 ** (-74 / 73.83), 2);
  });

  it('reports growth factors when the target date precedes the reference date', () => {
    const result = calculateDecayedActivity(50, '2026-04-11', '2026-01-01', 100);
    expect(result).not.toBeNull();
    expect(result?.elapsedDays).toBe(-100);
    expect(result?.decayFactor).toBe(2);
    expect(result?.decayedActivity).toBe(100);
  });

  it('returns null instead of guessing on missing or invalid inputs', () => {
    expect(calculateDecayedActivity('', '2026-01-01', '2026-02-01', 73.83)).toBeNull();
    expect(calculateDecayedActivity(0, '2026-01-01', '2026-02-01', 73.83)).toBeNull();
    expect(calculateDecayedActivity(-5, '2026-01-01', '2026-02-01', 73.83)).toBeNull();
    expect(calculateDecayedActivity(100, 'not-a-date', '2026-02-01', 73.83)).toBeNull();
    expect(calculateDecayedActivity(100, '2026-01-01', '', 73.83)).toBeNull();
    expect(calculateDecayedActivity(100, '2026-01-01', '2026-02-01', 0)).toBeNull();
  });

  it('keeps Co-60 decay slow over a typical planning horizon', () => {
    const result = calculateDecayedActivity(100, '2026-01-01', '2026-07-01', 1925.28);
    expect(result).not.toBeNull();
    expect(result!.decayedActivity).toBeGreaterThan(93);
    expect(result!.decayedActivity).toBeLessThan(100);
  });
});
