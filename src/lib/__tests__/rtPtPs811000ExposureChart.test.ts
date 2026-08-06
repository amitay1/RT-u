import { describe, expect, it } from 'vitest';
import {
  buildPs811000ExposureChart,
  calculatePs811000EquivalentThickness,
  fitMachineExposureChart,
  predictMasFromFit,
  scaleMasForDistance,
  solveExposureTriad,
  ugLimitInUnit,
} from '@/lib/ps811000ExposureChart';
import { lookupPs811000UgLimit } from '@/lib/ps811000';
import type { RtFilmExposureAnchor } from '@/types/rtFilm';

const anchor = (overrides: Partial<RtFilmExposureAnchor>): RtFilmExposureAnchor => ({
  id: 'a',
  description: '',
  thickness: 10,
  thicknessUnit: 'mm',
  tubeVoltage: 120,
  tubeCurrent: 5,
  exposureTime: 60,
  exposureTimeUnit: 's',
  sfd: 1000,
  sfdUnit: 'mm',
  measuredDensity: 2.5,
  ...overrides,
});

describe('PS811000E Table 1 equivalent thickness', () => {
  it('multiplies the thickness by the listed factor instead of only showing it', () => {
    // Copper at 100 kV carries a factor of 16.5, so 2 mm of copper absorbs like
    // 33 mm of the 100 kV reference material (aluminium, per para. 9.2.2).
    expect(calculatePs811000EquivalentThickness(2, 'Copper', 100)).toEqual({
      equivalentThickness: 33,
      factor: 16.5,
      voltageKv: 100,
      referenceMaterial: 'aluminum',
      basis: 'Table 1',
    });
  });

  it('names steel as the reference outside the 50 and 100 kV columns', () => {
    expect(calculatePs811000EquivalentThickness(10, 'Copper', 200)?.referenceMaterial).toBe('steel');
    expect(calculatePs811000EquivalentThickness(10, 'Aluminum 1100 / 6061', 50)?.referenceMaterial).toBe('aluminum');
  });

  it('refuses voltages and materials Table 1 does not list rather than interpolating', () => {
    expect(calculatePs811000EquivalentThickness(10, 'Copper', 125)).toBeNull();
    expect(calculatePs811000EquivalentThickness(10, 'Copper', 50)).toBeNull();
    expect(calculatePs811000EquivalentThickness(10, 'Unobtainium', 100)).toBeNull();
    expect(calculatePs811000EquivalentThickness('', 'Copper', 100)).toBeNull();
  });
});

describe('inverse-square distance correction', () => {
  it('quadruples the exposure product when the distance doubles', () => {
    expect(scaleMasForDistance(100, 500, 'mm', 1000, 'mm')).toBe(400);
    expect(scaleMasForDistance(400, 1000, 'mm', 500, 'mm')).toBe(100);
  });

  it('converts units before taking the ratio', () => {
    // 1000 mm and 39.3701 inch are the same distance, so nothing should change.
    expect(scaleMasForDistance(100, 1000, 'mm', 39.3701, 'inch')).toBeCloseTo(100, 3);
  });

  it('returns empty for missing or non-positive distances', () => {
    expect(scaleMasForDistance('', 500, 'mm', 1000, 'mm')).toBe('');
    expect(scaleMasForDistance(100, 0, 'mm', 1000, 'mm')).toBe('');
    expect(scaleMasForDistance(100, 500, 'mm', '', 'mm')).toBe('');
  });
});

describe('mA / time / mAs triad', () => {
  it('derives mAs from mA and time', () => {
    expect(solveExposureTriad(5, 60, 's', '')).toEqual({ currentMa: 5, time: 60, mas: 300 });
    expect(solveExposureTriad(5, 1, 'min', '')).toEqual({ currentMa: 5, time: 1, mas: 300 });
  });

  it('derives time from mA and mAs in the requested unit', () => {
    expect(solveExposureTriad(5, '', 's', 300)).toEqual({ currentMa: 5, time: 60, mas: 300 });
    expect(solveExposureTriad(5, '', 'min', 300)).toEqual({ currentMa: 5, time: 1, mas: 300 });
  });

  it('derives mA from time and mAs', () => {
    expect(solveExposureTriad('', 60, 's', 300)).toEqual({ currentMa: 5, time: 60, mas: 300 });
  });

  it('leaves everything it cannot determine empty', () => {
    expect(solveExposureTriad('', '', 's', 300)).toEqual({ currentMa: '', time: '', mas: 300 });
    expect(solveExposureTriad(5, '', '', 300)).toEqual({ currentMa: 5, time: '', mas: 300 });
  });
});

describe('machine exposure chart fit', () => {
  it('needs at least two anchors at the voltage before deriving anything', () => {
    expect(fitMachineExposureChart([], 120)).toBeNull();
    expect(fitMachineExposureChart([anchor({ id: '1' })], 120)).toBeNull();
    // Two anchors, but only one is at 120 kV.
    expect(fitMachineExposureChart(
      [anchor({ id: '1' }), anchor({ id: '2', tubeVoltage: 150, thickness: 20 })],
      120,
    )).toBeNull();
  });

  it('refuses to fit a slope when every anchor sits at the same thickness', () => {
    expect(fitMachineExposureChart(
      [anchor({ id: '1' }), anchor({ id: '2', tubeCurrent: 10 })],
      120,
    )).toBeNull();
  });

  it('fits log10(mAs) against thickness from the operator anchors', () => {
    // 10 mm -> 300 mAs, 20 mm -> 3000 mAs: exactly one decade per 10 mm.
    const fit = fitMachineExposureChart([
      anchor({ id: '1', thickness: 10, tubeCurrent: 5, exposureTime: 60 }),
      anchor({ id: '2', thickness: 20, tubeCurrent: 50, exposureTime: 60 }),
    ], 120);
    expect(fit).not.toBeNull();
    expect(fit?.slopePerMm).toBeCloseTo(0.1, 10);
    expect(fit?.anchorCount).toBe(2);
    expect(fit?.thicknessMinMm).toBe(10);
    expect(fit?.thicknessMaxMm).toBe(20);
  });

  it('normalizes anchors shot at different distances before fitting', () => {
    // The second anchor is at double the SFD, so its 1200 mAs is worth 300 mAs
    // at the 1000 mm reference and the two anchors describe a flat line.
    const fit = fitMachineExposureChart([
      anchor({ id: '1', thickness: 10, tubeCurrent: 5, exposureTime: 60, sfd: 1000 }),
      anchor({ id: '2', thickness: 20, tubeCurrent: 20, exposureTime: 60, sfd: 2000 }),
    ], 120);
    expect(fit?.slopePerMm).toBeCloseTo(0, 10);
    expect(fit?.referenceSfdMm).toBe(1000);
  });

  it('predicts mAs on the fitted line and corrects it to the planned SFD', () => {
    const fit = fitMachineExposureChart([
      anchor({ id: '1', thickness: 10, tubeCurrent: 5, exposureTime: 60 }),
      anchor({ id: '2', thickness: 20, tubeCurrent: 50, exposureTime: 60 }),
    ], 120);
    expect(fit).not.toBeNull();
    if (!fit) return;

    expect(predictMasFromFit(fit, 15, 'mm', 1000, 'mm')?.mas).toBeCloseTo(948.6833, 3);
    // Same thickness at double the distance costs four times the exposure.
    expect(predictMasFromFit(fit, 10, 'mm', 2000, 'mm')?.mas).toBeCloseTo(1200, 3);
    expect(predictMasFromFit(fit, 15, 'mm', 1000, 'mm')?.extrapolated).toBe(false);
    expect(predictMasFromFit(fit, 30, 'mm', 1000, 'mm')?.extrapolated).toBe(true);
  });
});

describe('exposure chart assembly', () => {
  const baseOptions = {
    curve: 'steel' as const,
    thicknessFrom: 5,
    thicknessTo: 25,
    thicknessUnit: 'mm' as const,
    rowCount: 5,
  };

  it('lays a thickness ladder across the entered range', () => {
    const chart = buildPs811000ExposureChart(baseOptions);
    expect(chart.rows.map((row) => row.thickness)).toEqual([5, 10, 15, 20, 25]);
  });

  it('carries the Figure 2 energy and its +/-20% band per para. 9.2.1', () => {
    const chart = buildPs811000ExposureChart(baseOptions);
    const row = chart.rows[0];
    expect(row.approximateKvp).not.toBeNull();
    expect(row.lowerKvp).toBe(Math.round((row.approximateKvp as number) * 0.8));
    expect(row.upperKvp).toBe(Math.round((row.approximateKvp as number) * 1.2));
  });

  it('carries the exact Table 8 Ug limit for each row thickness', () => {
    const chart = buildPs811000ExposureChart({ ...baseOptions, thicknessFrom: 40, thicknessTo: 120, rowCount: 3 });
    expect(chart.rows.map((row) => ugLimitInUnit(row.ugLimit, 'mm'))).toEqual([0.51, 0.76, 1.02]);
    expect(ugLimitInUnit(lookupPs811000UgLimit(40, 'mm'), 'inch')).toBe(0.02);
  });

  it('produces no mA column and says why when the machine has no anchors', () => {
    const chart = buildPs811000ExposureChart({ ...baseOptions, machineVoltageKv: 120 });
    expect(chart.fit).toBeNull();
    expect(chart.rows.every((row) => row.mas === null && row.currentMa === null)).toBe(true);
    expect(chart.machineChartNotice).toContain('PS811000E supplies no mA values');
  });

  it('asks for the machine voltage before anything can be derived', () => {
    const chart = buildPs811000ExposureChart(baseOptions);
    expect(chart.machineChartNotice).toContain('tube voltage');
  });

  it('fills mAs, mA and time once two qualified anchors exist', () => {
    const chart = buildPs811000ExposureChart({
      ...baseOptions,
      thicknessFrom: 10,
      thicknessTo: 20,
      rowCount: 2,
      machineVoltageKv: 120,
      targetSfd: 1000,
      targetSfdUnit: 'mm',
      plannedCurrentMa: 5,
      exposureTimeUnit: 's',
      anchors: [
        anchor({ id: '1', thickness: 10, tubeCurrent: 5, exposureTime: 60 }),
        anchor({ id: '2', thickness: 20, tubeCurrent: 50, exposureTime: 60 }),
      ],
    });
    expect(chart.machineChartNotice).toBeNull();
    expect(chart.rows[0].mas).toBeCloseTo(300, 3);
    expect(chart.rows[1].mas).toBeCloseTo(3000, 3);
    // 3000 mAs at the planned 5 mA is 600 s.
    expect(chart.rows[1].currentMa).toBe(5);
    expect(chart.rows[1].exposureTime).toBeCloseTo(600, 3);
    expect(chart.rows.every((row) => row.masExtrapolated === false)).toBe(true);
  });

  it('returns no rows until a thickness range is entered', () => {
    expect(buildPs811000ExposureChart({ ...baseOptions, thicknessFrom: '' }).rows).toEqual([]);
    expect(buildPs811000ExposureChart({ ...baseOptions, thicknessTo: '' }).rows).toEqual([]);
  });

  it('applies the Table 1 factor per row when a material is chosen', () => {
    const chart = buildPs811000ExposureChart({
      ...baseOptions,
      thicknessFrom: 2,
      thicknessTo: 4,
      rowCount: 2,
      equivalenceMaterial: 'Copper',
      equivalenceVoltageKv: 100,
    });
    expect(chart.rows.map((row) => row.equivalentThickness)).toEqual([33, 66]);
    expect(chart.rows.every((row) => row.equivalenceFactor === 16.5)).toBe(true);
  });
});
