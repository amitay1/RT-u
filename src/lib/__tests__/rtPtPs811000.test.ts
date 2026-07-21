import { describe, expect, it } from 'vitest';
import {
  calculateExposureMas,
  calculateHoneycombRadiographicThickness,
  calculateIqiSensitivityPercent,
  calculateMinimumFocalSpotToImageDistance,
  isThinAdhesiveTenKvpCase,
  lookupPs811000DensityRequirement,
  lookupPs811000EnergySuggestion,
  lookupPs811000EquivalenceFactor,
  lookupPs811000ImageQualityRequirement,
  lookupPs811000LeadScreens,
  lookupPs811000MaximumReadableDensity,
  lookupPs811000MinimumContrastDifference,
  lookupPs811000UgLimit,
  PS811000_EXAMINATION_QUALITY_LEVELS,
  PS811000_DENSITOMETER_DAILY_ACCURACY_HD,
  PS811000_DENSITOMETER_RESOLUTION_HD,
  PS811000_PENETRAMETER_MATERIALS,
  PS811000_WIRE_IQI_GROUPS,
  PS811000_WIRE_TABLE,
} from '@/lib/ps811000';

describe('PS811000E C1 calculation and lookup rules', () => {
  it('uses the Table 8 Ug boundary rows at 50 and 100 mm', () => {
    expect(lookupPs811000UgLimit(49.999, 'mm')?.maximumMm).toBe(0.51);
    expect(lookupPs811000UgLimit(50, 'mm')?.maximumMm).toBe(0.76);
    expect(lookupPs811000UgLimit(100, 'mm')?.maximumMm).toBe(0.76);
    expect(lookupPs811000UgLimit(100.001, 'mm')?.maximumMm).toBe(1.02);
    expect(lookupPs811000UgLimit(2, 'inch')?.maximumInch).toBe(0.030);
    expect(lookupPs811000UgLimit(4, 'inch')?.maximumInch).toBe(0.030);
    expect(lookupPs811000UgLimit(4.001, 'inch')?.maximumInch).toBe(0.040);
  });

  it('returns the distinct single and superimposed density requirements', () => {
    expect(lookupPs811000DensityRequirement('single')).toMatchObject({
      combinedMinimum: 1.5,
      maximum: 4,
      individualFilmMinimum: null,
    });
    expect(lookupPs811000DensityRequirement('superimposed')).toMatchObject({
      combinedMinimum: 2,
      maximum: 4,
      individualFilmMinimum: 1,
    });
  });

  it('uses only the digitized Figure 1 and Figure 6 graph ranges', () => {
    expect(PS811000_DENSITOMETER_RESOLUTION_HD).toBe(0.02);
    expect(PS811000_DENSITOMETER_DAILY_ACCURACY_HD).toBe(0.05);
    expect(lookupPs811000MaximumReadableDensity(300)).toEqual({ value: 1, basis: 'Figure 1 digitized graph' });
    expect(lookupPs811000MaximumReadableDensity(10000)).toEqual({ value: 3, basis: 'Figure 1 digitized graph' });
    expect(lookupPs811000MaximumReadableDensity(100000)).toEqual({ value: 4, basis: 'Figure 1 digitized graph' });
    expect(lookupPs811000MaximumReadableDensity(299)).toBeNull();
    expect(lookupPs811000MinimumContrastDifference(1.5)).toEqual({ value: 0.015, basis: 'Figure 6 digitized graph' });
    expect(lookupPs811000MinimumContrastDifference(4)).toEqual({ value: 0.052, basis: 'Figure 6 digitized graph' });
    expect(lookupPs811000MinimumContrastDifference(5.1)).toBeNull();
  });

  it('calculates mAs from entered mA and time but never infers mA', () => {
    expect(calculateExposureMas(5, 2, 's')).toBe(10);
    expect(calculateExposureMas(5, 2, 'min')).toBe(600);
    expect(calculateExposureMas('', 2, 's')).toBe('');
    expect(calculateExposureMas(5, 2, '')).toBe('');
  });

  it('omits honeycomb core and adds only the explicitly applicable thickness components', () => {
    expect(calculateHoneycombRadiographicThickness({
      skins: 1,
      adhesive: 0.5,
      capsOrFlanges: 0.25,
      doublersOrTriplers: 0.25,
      unit: 'mm',
    })).toBe(2);
    expect(calculateHoneycombRadiographicThickness({
      skins: 0.02,
      adhesive: 0.01,
      capsOrFlanges: 0,
      doublersOrTriplers: 0,
      unit: 'inch',
    }, 'mm')).toBeCloseTo(0.762, 6);
  });

  it('keeps Table 1 sparse instead of inventing voltage interpolation', () => {
    expect(lookupPs811000EquivalenceFactor('Copper', 100)).toBe(16.5);
    expect(lookupPs811000EquivalenceFactor('Copper', 50)).toBeNull();
    expect(lookupPs811000EquivalenceFactor('Copper', 125)).toBeNull();
  });

  it('returns every matching Table 2 row at shared voltage boundaries', () => {
    expect(lookupPs811000LeadScreens(149).map((row) => row.range)).toEqual(['0 to 150 kV']);
    expect(lookupPs811000LeadScreens(150).map((row) => row.range)).toEqual(['0 to 150 kV', '150 to 200 kV']);
    expect(lookupPs811000LeadScreens(200).map((row) => row.range)).toEqual(['150 to 200 kV', '200 kV to 2 MV']);
  });

  it('models the remaining exact table lookups without prose from the source', () => {
    expect(PS811000_PENETRAMETER_MATERIALS).toContainEqual({ material: 'Titanium', symbol: 'TI' });
    expect(PS811000_WIRE_TABLE).toHaveLength(19);
    expect(PS811000_WIRE_TABLE[0]).toMatchObject({ wire: 'W1', diameterMm: 3.2, toleranceMm: 0.03 });
    expect(PS811000_WIRE_TABLE[18]).toMatchObject({ wire: 'W19', diameterMm: 0.05, toleranceMm: 0.005 });
    expect(PS811000_WIRE_IQI_GROUPS).toHaveLength(16);
    expect(lookupPs811000ImageQualityRequirement(3.79, 'mm')?.minimumPerceptibleHole).toBe('1T');
    expect(lookupPs811000ImageQualityRequirement(3.8, 'mm')?.minimumPerceptibleHole).toBe('2T');
    expect(lookupPs811000ImageQualityRequirement(6.4, 'mm')?.qualityLevel).toBe('N/A');
    expect(lookupPs811000ImageQualityRequirement(6.401, 'mm')?.qualityLevel).toBe('2-2T');
    expect(lookupPs811000ImageQualityRequirement(0.1499, 'inch')?.minimumPerceptibleHole).toBe('1T');
    expect(lookupPs811000ImageQualityRequirement(0.15, 'inch')?.minimumPerceptibleHole).toBe('2T');
    expect(lookupPs811000ImageQualityRequirement(0.25, 'inch')?.qualityLevel).toBe('N/A');
    expect(lookupPs811000ImageQualityRequirement(0.2501, 'inch')?.qualityLevel).toBe('2-2T');
    expect(PS811000_EXAMINATION_QUALITY_LEVELS.find((row) => row.iqiDesignation === '3')).toMatchObject({
      qualityLevel: '2-4T',
      equivalentSensitivityPercent: 2.8,
    });
  });

  it('calculates Figure 3 distance and IQI sensitivity with unit conversion', () => {
    expect(calculateMinimumFocalSpotToImageDistance(10, 'inch')).toBe(60);
    expect(calculateMinimumFocalSpotToImageDistance(254, 'mm')).toBe(1524);
    expect(calculateMinimumFocalSpotToImageDistance(21, 'inch')).toBe('');
    expect(calculateIqiSensitivityPercent(0.2, 'mm', 10, 'mm')).toBe(2);
    expect(calculateIqiSensitivityPercent(0.01, 'inch', 12.7, 'mm')).toBe(2);
  });

  it('labels Figure 2 values as graph digitization and applies the specified 20 percent band', () => {
    expect(lookupPs811000EnergySuggestion('steel', 1, 'inch')).toMatchObject({
      approximateKvp: 250,
      lowerKvp: 200,
      upperKvp: 300,
      basis: 'Figure 2 digitized graph',
    });
    expect(lookupPs811000EnergySuggestion('steel', 25.4, 'mm')?.approximateKvp).toBe(250);
    expect(lookupPs811000EnergySuggestion('steel', 5, 'inch')).toBeNull();
    expect(isThinAdhesiveTenKvpCase('graphite-adhesive-core', 0.019, 'inch')).toBe(true);
    expect(isThinAdhesiveTenKvpCase('graphite-adhesive-core', 0.020, 'inch')).toBe(false);
  });
});
