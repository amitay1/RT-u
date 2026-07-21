import type {
  LengthUnit,
  Ps811000EnergyCurve,
  Ps811000FilmViewingMode,
  TimeUnit,
} from '@/types/rtFilm';

export const PS811000_REFERENCE = Object.freeze({
  document: 'PS811000E',
  revision: 'C1',
  date: '2012-10-15',
});

export const PS811000_DENSITOMETER_RESOLUTION_HD = 0.02;
export const PS811000_DENSITOMETER_DAILY_ACCURACY_HD = 0.05;

const INCH_TO_MM = 25.4;

const toMillimeters = (value: number, unit: LengthUnit): number => (
  unit === 'inch' ? value * INCH_TO_MM : value
);

const fromMillimeters = (value: number, unit: LengthUnit): number => (
  unit === 'inch' ? value / INCH_TO_MM : value
);

export interface Ps811000UgLimit {
  maximumMm: number;
  maximumInch: number;
  thicknessBand: '< 50 mm' | '50 to 100 mm' | '> 100 mm';
  basis: 'Table 8';
}

export function lookupPs811000UgLimit(
  thickness: number | '',
  unit: LengthUnit,
): Ps811000UgLimit | null {
  if (typeof thickness !== 'number' || !Number.isFinite(thickness) || thickness < 0) return null;
  const lowerBoundary = unit === 'inch' ? 2 : 50;
  const upperBoundary = unit === 'inch' ? 4 : 100;
  if (thickness < lowerBoundary) {
    return { maximumMm: 0.51, maximumInch: 0.020, thicknessBand: '< 50 mm', basis: 'Table 8' };
  }
  if (thickness <= upperBoundary) {
    return { maximumMm: 0.76, maximumInch: 0.030, thicknessBand: '50 to 100 mm', basis: 'Table 8' };
  }
  return { maximumMm: 1.02, maximumInch: 0.040, thicknessBand: '> 100 mm', basis: 'Table 8' };
}

export interface Ps811000DensityRequirement {
  viewingMode: Exclude<Ps811000FilmViewingMode, ''>;
  combinedMinimum: number;
  maximum: number;
  individualFilmMinimum: number | null;
  specialApprovalOutsideRange: boolean;
  basis: '9.10.5.2' | '9.10.5.3';
}

export function lookupPs811000DensityRequirement(
  viewingMode: Exclude<Ps811000FilmViewingMode, ''>,
): Ps811000DensityRequirement {
  return viewingMode === 'single'
    ? {
      viewingMode,
      combinedMinimum: 1.5,
      maximum: 4.0,
      individualFilmMinimum: null,
      specialApprovalOutsideRange: true,
      basis: '9.10.5.2',
    }
    : {
      viewingMode,
      combinedMinimum: 2.0,
      maximum: 4.0,
      individualFilmMinimum: 1.0,
      specialApprovalOutsideRange: false,
      basis: '9.10.5.3',
    };
}

interface DigitizedPoint {
  input: number;
  output: number;
}

const VIEWER_OUTPUT_POINTS: readonly DigitizedPoint[] = [
  { input: 300, output: 1.0 },
  { input: 3000, output: 2.0 },
  { input: 10000, output: 2.5 },
  { input: 10000, output: 3.0 },
  { input: 100000, output: 4.0 },
];

export interface Ps811000GraphLookup {
  value: number;
  basis: 'Figure 1 digitized graph' | 'Figure 6 digitized graph';
}

export function lookupPs811000MaximumReadableDensity(
  viewerOutputCandelaPerSquareMeter: number | '',
): Ps811000GraphLookup | null {
  if (
    typeof viewerOutputCandelaPerSquareMeter !== 'number'
    || !Number.isFinite(viewerOutputCandelaPerSquareMeter)
    || viewerOutputCandelaPerSquareMeter < VIEWER_OUTPUT_POINTS[0].input
    || viewerOutputCandelaPerSquareMeter > VIEWER_OUTPUT_POINTS[VIEWER_OUTPUT_POINTS.length - 1].input
  ) return null;

  if (viewerOutputCandelaPerSquareMeter === 10000) {
    return { value: 3.0, basis: 'Figure 1 digitized graph' };
  }
  const uniquePoints = [VIEWER_OUTPUT_POINTS[0], VIEWER_OUTPUT_POINTS[1], VIEWER_OUTPUT_POINTS[2], VIEWER_OUTPUT_POINTS[4]];
  const exact = uniquePoints.find((point) => point.input === viewerOutputCandelaPerSquareMeter);
  if (exact) return { value: exact.output, basis: 'Figure 1 digitized graph' };
  const upperIndex = uniquePoints.findIndex((point) => point.input > viewerOutputCandelaPerSquareMeter);
  const low = uniquePoints[upperIndex - 1];
  const high = uniquePoints[upperIndex];
  const fraction = (
    (Math.log10(viewerOutputCandelaPerSquareMeter) - Math.log10(low.input))
    / (Math.log10(high.input) - Math.log10(low.input))
  );
  return {
    value: Number((low.output + fraction * (high.output - low.output)).toFixed(2)),
    basis: 'Figure 1 digitized graph',
  };
}

const MINIMUM_CONTRAST_POINTS: readonly DigitizedPoint[] = [
  { input: 1.5, output: 0.015 },
  { input: 2.0, output: 0.020 },
  { input: 2.5, output: 0.028 },
  { input: 3.0, output: 0.037 },
  { input: 4.0, output: 0.052 },
  { input: 5.0, output: 0.085 },
];

export function lookupPs811000MinimumContrastDifference(
  filmDensity: number | '',
): Ps811000GraphLookup | null {
  if (
    typeof filmDensity !== 'number'
    || !Number.isFinite(filmDensity)
    || filmDensity < MINIMUM_CONTRAST_POINTS[0].input
    || filmDensity > MINIMUM_CONTRAST_POINTS[MINIMUM_CONTRAST_POINTS.length - 1].input
  ) return null;
  const exact = MINIMUM_CONTRAST_POINTS.find((point) => point.input === filmDensity);
  if (exact) return { value: exact.output, basis: 'Figure 6 digitized graph' };
  const upperIndex = MINIMUM_CONTRAST_POINTS.findIndex((point) => point.input > filmDensity);
  const low = MINIMUM_CONTRAST_POINTS[upperIndex - 1];
  const high = MINIMUM_CONTRAST_POINTS[upperIndex];
  const fraction = (filmDensity - low.input) / (high.input - low.input);
  const logDifference = Math.log10(low.output) + fraction * (Math.log10(high.output) - Math.log10(low.output));
  return {
    value: Number((10 ** logDifference).toFixed(3)),
    basis: 'Figure 6 digitized graph',
  };
}

export function calculateExposureMas(
  currentMa: number | '',
  exposureTime: number | '',
  timeUnit: TimeUnit,
): number | '' {
  if (
    typeof currentMa !== 'number'
    || typeof exposureTime !== 'number'
    || !Number.isFinite(currentMa)
    || !Number.isFinite(exposureTime)
    || currentMa < 0
    || exposureTime < 0
    || !timeUnit
  ) return '';
  const seconds = timeUnit === 'min' ? exposureTime * 60 : exposureTime;
  return Number((currentMa * seconds).toFixed(4));
}

export interface Ps811000HoneycombThicknessInput {
  skins: number | '';
  adhesive: number | '';
  capsOrFlanges: number | '';
  doublersOrTriplers: number | '';
  unit: LengthUnit;
}

export function calculateHoneycombRadiographicThickness(
  input: Ps811000HoneycombThicknessInput,
  outputUnit: LengthUnit = input.unit,
): number | '' {
  const values = [input.skins, input.adhesive, input.capsOrFlanges, input.doublersOrTriplers];
  if (values.some((value) => typeof value !== 'number' || !Number.isFinite(value) || value < 0)) return '';
  const totalMm = values.reduce<number>((sum, value) => sum + toMillimeters(value as number, input.unit), 0);
  return Number(fromMillimeters(totalMm, outputUnit).toFixed(6));
}

export function calculateMinimumFocalSpotToImageDistance(
  coverageDiameter: number | '',
  unit: LengthUnit,
): number | '' {
  if (
    typeof coverageDiameter !== 'number'
    || !Number.isFinite(coverageDiameter)
    || coverageDiameter < 0
  ) return '';
  const coverageInch = unit === 'inch' ? coverageDiameter : coverageDiameter / INCH_TO_MM;
  if (coverageInch > 20) return '';
  return Number((coverageDiameter * 6).toFixed(4));
}

export function calculateIqiSensitivityPercent(
  iqiThickness: number | '',
  iqiUnit: LengthUnit,
  partThickness: number | '',
  partUnit: LengthUnit,
): number | '' {
  if (
    typeof iqiThickness !== 'number'
    || typeof partThickness !== 'number'
    || !Number.isFinite(iqiThickness)
    || !Number.isFinite(partThickness)
    || iqiThickness < 0
    || partThickness <= 0
  ) return '';
  return Number((toMillimeters(iqiThickness, iqiUnit) / toMillimeters(partThickness, partUnit) * 100).toFixed(4));
}

export const PS811000_EQUIVALENCE_VOLTAGES = [10, 20, 50, 100, 150, 200, 220, 250] as const;
export type Ps811000EquivalenceVoltage = typeof PS811000_EQUIVALENCE_VOLTAGES[number];

export const PS811000_EQUIVALENCE_FACTORS = [
  { material: 'Adhesive film FM-300', factors: { 10: 0.16, 20: 0.28, 50: 0.45 } },
  { material: 'Adhesive film FM400 / FM400NA', factors: { 10: 0.04, 20: 0.04, 50: 0.04 } },
  { material: 'Foaming adhesive', factors: { 10: 0.04, 20: 0.04, 50: 0.07, 100: 0.10, 150: 0.015 } },
  { material: 'Aluminum 1100 / 6061', factors: { 10: 1.0, 20: 1.0, 50: 1.0, 100: 1.0, 150: 0.12, 200: 0.14, 220: 0.18, 250: 0.16 } },
  { material: 'Aluminum 2024 / 7075', factors: { 50: 1.4, 100: 1.2, 150: 0.13, 200: 0.14, 220: 0.14 } },
  { material: 'Boron / epoxy', factors: { 50: 0.75 } },
  { material: 'Borsic aluminum', factors: { 50: 1.0, 100: 1.0 } },
  { material: 'Carbon / bismaleimide', factors: { 10: 0.06, 20: 0.06, 50: 0.07 } },
  { material: 'Carbon / epoxy', factors: { 10: 0.06, 20: 0.06, 50: 0.07 } },
  { material: 'Cellulose triacetate', factors: { 10: 0.06, 20: 0.06, 50: 0.07 } },
  { material: 'Copper', factors: { 100: 16.5, 150: 1.6, 200: 1.4, 220: 1.4, 250: 1.4 } },
  { material: 'Fiberglass', factors: { 50: 0.35 } },
  { material: 'Lead', factors: { 50: 126, 100: 145, 150: 14.0, 200: 12.0, 220: 12.0, 250: 9.0 } },
  { material: 'Lucite', factors: { 10: 0.05, 20: 0.05, 50: 0.05 } },
  { material: 'Magnesium', factors: { 50: 0.6, 100: 0.6, 150: 0.05, 200: 0.05, 220: 0.08 } },
  { material: 'Mylar', factors: { 10: 0.98 } },
  { material: 'Nickel', factors: { 200: 1.3 } },
  { material: 'Nylon', factors: { 10: 0.04, 20: 0.04, 50: 0.04 } },
  { material: 'Rubber', factors: { 50: 0.35 } },
] as const satisfies ReadonlyArray<{
  material: string;
  factors: Partial<Record<Ps811000EquivalenceVoltage, number>>;
}>;

export function lookupPs811000EquivalenceFactor(
  material: string,
  voltage: number,
): number | null {
  if (!PS811000_EQUIVALENCE_VOLTAGES.includes(voltage as Ps811000EquivalenceVoltage)) return null;
  const row = PS811000_EQUIVALENCE_FACTORS.find((item) => item.material === material);
  const factors: Partial<Record<Ps811000EquivalenceVoltage, number>> = row?.factors ?? {};
  return factors[voltage as Ps811000EquivalenceVoltage] ?? null;
}

export interface Ps811000LeadScreenRecommendation {
  range: string;
  minimumKv: number;
  maximumKv: number;
  frontMinimumInch: number;
  frontMaximumInch: number;
  frontMinimumMm: number;
  frontMaximumMm: number;
  backMinimumInch: number;
  backMinimumMm: number;
}

export const PS811000_LEAD_SCREEN_TABLE: readonly Ps811000LeadScreenRecommendation[] = [
  { range: '0 to 150 kV', minimumKv: 0, maximumKv: 150, frontMinimumInch: 0, frontMaximumInch: 0, frontMinimumMm: 0, frontMaximumMm: 0, backMinimumInch: 0.005, backMinimumMm: 0.127 },
  { range: '150 to 200 kV', minimumKv: 150, maximumKv: 200, frontMinimumInch: 0.005, frontMaximumInch: 0.005, frontMinimumMm: 0.127, frontMaximumMm: 0.127, backMinimumInch: 0.005, backMinimumMm: 0.127 },
  { range: '200 kV to 2 MV', minimumKv: 200, maximumKv: 2000, frontMinimumInch: 0.005, frontMaximumInch: 0.010, frontMinimumMm: 0.126, frontMaximumMm: 0.254, backMinimumInch: 0.010, backMinimumMm: 0.254 },
  { range: '2 to 4 MV', minimumKv: 2000, maximumKv: 4000, frontMinimumInch: 0.010, frontMaximumInch: 0.010, frontMinimumMm: 0.254, frontMaximumMm: 0.254, backMinimumInch: 0.010, backMinimumMm: 0.254 },
  { range: '4 to 10 MV', minimumKv: 4000, maximumKv: 10000, frontMinimumInch: 0.010, frontMaximumInch: 0.030, frontMinimumMm: 0.254, frontMaximumMm: 0.762, backMinimumInch: 0.010, backMinimumMm: 0.254 },
  { range: '10 to 25 MV', minimumKv: 10000, maximumKv: 25000, frontMinimumInch: 0.010, frontMaximumInch: 0.050, frontMinimumMm: 0.254, frontMaximumMm: 1.27, backMinimumInch: 0.010, backMinimumMm: 0.254 },
];

export function lookupPs811000LeadScreens(voltageKv: number | ''): readonly Ps811000LeadScreenRecommendation[] {
  if (typeof voltageKv !== 'number' || !Number.isFinite(voltageKv) || voltageKv < 0) return [];
  return PS811000_LEAD_SCREEN_TABLE.filter((row) => voltageKv >= row.minimumKv && voltageKv <= row.maximumKv);
}

export const PS811000_PENETRAMETER_MATERIALS = [
  { material: 'Stainless steel', symbol: 'SS' },
  { material: 'Steel', symbol: 'FE' },
  { material: 'Aluminum', symbol: 'AL' },
  { material: 'Magnesium', symbol: 'MG' },
  { material: 'Copper', symbol: 'CU' },
  { material: 'Titanium', symbol: 'TI' },
  { material: 'Columbium', symbol: 'CB' },
  { material: 'Molybdenum', symbol: 'MO' },
] as const;

export const PS811000_WIRE_IQI_GROUPS = [
  { designation: 'W1 CU', wireMaterial: 'Copper', wireRange: 'W1 to W7', suitableMaterialGroup: 'Copper, zinc, tin, and their alloys' },
  { designation: 'W6 CU', wireMaterial: 'Copper', wireRange: 'W6 to W12', suitableMaterialGroup: 'Copper, zinc, tin, and their alloys' },
  { designation: 'W10 CU', wireMaterial: 'Copper', wireRange: 'W10 to W16', suitableMaterialGroup: 'Copper, zinc, tin, and their alloys' },
  { designation: 'W13 CU', wireMaterial: 'Copper', wireRange: 'W13 to W19', suitableMaterialGroup: 'Copper, zinc, tin, and their alloys' },
  { designation: 'W1 FE', wireMaterial: 'Low-alloy steel', wireRange: 'W1 to W7', suitableMaterialGroup: 'Ferrous materials' },
  { designation: 'W6 FE', wireMaterial: 'Low-alloy steel', wireRange: 'W6 to W12', suitableMaterialGroup: 'Ferrous materials' },
  { designation: 'W10 FE', wireMaterial: 'Low-alloy steel', wireRange: 'W10 to W16', suitableMaterialGroup: 'Ferrous materials' },
  { designation: 'W13 FE', wireMaterial: 'Low-alloy steel', wireRange: 'W13 to W19', suitableMaterialGroup: 'Ferrous materials' },
  { designation: 'W1 TI', wireMaterial: 'Titanium', wireRange: 'W1 to W7', suitableMaterialGroup: 'Titanium and its alloys' },
  { designation: 'W6 TI', wireMaterial: 'Titanium', wireRange: 'W6 to W12', suitableMaterialGroup: 'Titanium and its alloys' },
  { designation: 'W10 TI', wireMaterial: 'Titanium', wireRange: 'W10 to W16', suitableMaterialGroup: 'Titanium and its alloys' },
  { designation: 'W13 TI', wireMaterial: 'Titanium', wireRange: 'W13 to W19', suitableMaterialGroup: 'Titanium and its alloys' },
  { designation: 'W1 AL', wireMaterial: 'Aluminum', wireRange: 'W1 to W7', suitableMaterialGroup: 'Aluminum and its alloys' },
  { designation: 'W6 AL', wireMaterial: 'Aluminum', wireRange: 'W6 to W12', suitableMaterialGroup: 'Aluminum and its alloys' },
  { designation: 'W10 AL', wireMaterial: 'Aluminum', wireRange: 'W10 to W16', suitableMaterialGroup: 'Aluminum and its alloys' },
  { designation: 'W13 AL', wireMaterial: 'Aluminum', wireRange: 'W13 to W19', suitableMaterialGroup: 'Aluminum and its alloys' },
] as const;

const WIRE_DIAMETERS_MM = [3.20, 2.50, 2.00, 1.60, 1.25, 1.00, 0.80, 0.63, 0.50, 0.40, 0.32, 0.25, 0.20, 0.16, 0.125, 0.100, 0.080, 0.063, 0.050] as const;

export const PS811000_WIRE_TABLE = WIRE_DIAMETERS_MM.map((diameterMm, index) => {
  const number = index + 1;
  const toleranceMm = number <= 3 ? 0.03 : number <= 8 ? 0.02 : number <= 14 ? 0.01 : 0.005;
  return { wire: `W${number}`, number, diameterMm, toleranceMm };
});

export interface Ps811000ImageQualityRequirement {
  thicknessBand: '< 3.8 mm' | '3.8 to 6.4 mm' | '> 6.4 mm';
  qualityLevel: 'N/A' | '2-2T';
  maximumIqiThicknessMm: number | '2% of part thickness';
  minimumPerceptibleHole: '1T' | '2T';
  equivalentSensitivity: '>= 3.3%' | '4.7% to 2.8%' | '2.0%';
}

export function lookupPs811000ImageQualityRequirement(
  thickness: number | '',
  unit: LengthUnit,
): Ps811000ImageQualityRequirement | null {
  if (typeof thickness !== 'number' || !Number.isFinite(thickness) || thickness < 0) return null;
  const lowerBoundary = unit === 'inch' ? 0.15 : 3.8;
  const upperBoundary = unit === 'inch' ? 0.25 : 6.4;
  if (thickness < lowerBoundary) {
    return { thicknessBand: '< 3.8 mm', qualityLevel: 'N/A', maximumIqiThicknessMm: 0.127, minimumPerceptibleHole: '1T', equivalentSensitivity: '>= 3.3%' };
  }
  if (thickness <= upperBoundary) {
    return { thicknessBand: '3.8 to 6.4 mm', qualityLevel: 'N/A', maximumIqiThicknessMm: 0.127, minimumPerceptibleHole: '2T', equivalentSensitivity: '4.7% to 2.8%' };
  }
  return { thicknessBand: '> 6.4 mm', qualityLevel: '2-2T', maximumIqiThicknessMm: '2% of part thickness', minimumPerceptibleHole: '2T', equivalentSensitivity: '2.0%' };
}

export const PS811000_EXAMINATION_QUALITY_LEVELS = [
  { iqiDesignation: '00', qualityLevel: '1-1T', maximumIqiThicknessPercent: 1, minimumHole: '1T', equivalentSensitivityPercent: 0.7 },
  { iqiDesignation: '0', qualityLevel: '1-2T', maximumIqiThicknessPercent: 1, minimumHole: '2T', equivalentSensitivityPercent: 1.0 },
  { iqiDesignation: '1', qualityLevel: '2-1T', maximumIqiThicknessPercent: 2, minimumHole: '1T', equivalentSensitivityPercent: 1.4 },
  { iqiDesignation: '2', qualityLevel: '2-2T', maximumIqiThicknessPercent: 2, minimumHole: '2T', equivalentSensitivityPercent: 2.0 },
  { iqiDesignation: '3', qualityLevel: '2-4T', maximumIqiThicknessPercent: 2, minimumHole: '4T', equivalentSensitivityPercent: 2.8 },
] as const;

export const PS811000_ENERGY_CURVE_LABELS: Readonly<Record<Ps811000EnergyCurve, string>> = {
  'copper-nickel': 'Copper, nickel, and copper-nickel alloys',
  steel: 'Steel and stainless steel',
  titanium: 'Titanium',
  'aluminum-magnesium': 'Aluminum, boron-aluminum, and magnesium',
  'boron-composite': 'Boron/epoxy and boron/polyimide',
  fiberglass: 'Fiberglass',
  'graphite-adhesive-core': 'Graphite/epoxy, adhesive, and syntactic core',
};

interface EnergyPoint {
  thicknessInch: number;
  kvp: number;
}

const ENERGY_CURVES: Readonly<Record<Ps811000EnergyCurve, readonly EnergyPoint[]>> = {
  'copper-nickel': [
    { thicknessInch: 0.01, kvp: 90 }, { thicknessInch: 0.02, kvp: 94 },
    { thicknessInch: 0.05, kvp: 103 }, { thicknessInch: 0.1, kvp: 112 },
    { thicknessInch: 0.2, kvp: 125 }, { thicknessInch: 0.5, kvp: 170 },
    { thicknessInch: 1, kvp: 300 }, { thicknessInch: 2, kvp: 650 },
    { thicknessInch: 3, kvp: 950 },
  ],
  steel: [
    { thicknessInch: 0.01, kvp: 68 }, { thicknessInch: 0.02, kvp: 71 },
    { thicknessInch: 0.05, kvp: 77 }, { thicknessInch: 0.1, kvp: 85 },
    { thicknessInch: 0.2, kvp: 98 }, { thicknessInch: 0.5, kvp: 140 },
    { thicknessInch: 1, kvp: 250 }, { thicknessInch: 2, kvp: 520 },
    { thicknessInch: 3, kvp: 800 }, { thicknessInch: 4, kvp: 1000 },
  ],
  titanium: [
    { thicknessInch: 0.01, kvp: 45 }, { thicknessInch: 0.02, kvp: 47 },
    { thicknessInch: 0.05, kvp: 49 }, { thicknessInch: 0.1, kvp: 52 },
    { thicknessInch: 0.2, kvp: 62 }, { thicknessInch: 0.5, kvp: 90 },
    { thicknessInch: 1, kvp: 155 }, { thicknessInch: 2, kvp: 340 },
    { thicknessInch: 3, kvp: 520 }, { thicknessInch: 4, kvp: 750 },
    { thicknessInch: 5, kvp: 1000 },
  ],
  'aluminum-magnesium': [
    { thicknessInch: 0.01, kvp: 30 }, { thicknessInch: 0.02, kvp: 31 },
    { thicknessInch: 0.05, kvp: 34 }, { thicknessInch: 0.1, kvp: 40 },
    { thicknessInch: 0.2, kvp: 48 }, { thicknessInch: 0.5, kvp: 70 },
    { thicknessInch: 1, kvp: 108 }, { thicknessInch: 2, kvp: 220 },
    { thicknessInch: 3, kvp: 350 }, { thicknessInch: 4, kvp: 500 },
    { thicknessInch: 5, kvp: 700 },
  ],
  'boron-composite': [
    { thicknessInch: 0.01, kvp: 22 }, { thicknessInch: 0.02, kvp: 23 },
    { thicknessInch: 0.05, kvp: 25 }, { thicknessInch: 0.1, kvp: 28 },
    { thicknessInch: 0.2, kvp: 35 }, { thicknessInch: 0.5, kvp: 48 },
    { thicknessInch: 1, kvp: 72 }, { thicknessInch: 2, kvp: 145 },
    { thicknessInch: 3, kvp: 220 }, { thicknessInch: 4, kvp: 320 },
    { thicknessInch: 5, kvp: 450 },
  ],
  fiberglass: [
    { thicknessInch: 0.01, kvp: 18 }, { thicknessInch: 0.02, kvp: 19 },
    { thicknessInch: 0.05, kvp: 20 }, { thicknessInch: 0.1, kvp: 22 },
    { thicknessInch: 0.2, kvp: 26 }, { thicknessInch: 0.5, kvp: 35 },
    { thicknessInch: 1, kvp: 52 }, { thicknessInch: 2, kvp: 100 },
    { thicknessInch: 3, kvp: 150 }, { thicknessInch: 4, kvp: 220 },
    { thicknessInch: 5, kvp: 300 },
  ],
  'graphite-adhesive-core': [
    { thicknessInch: 0.025, kvp: 10 }, { thicknessInch: 0.05, kvp: 13 },
    { thicknessInch: 0.1, kvp: 16 }, { thicknessInch: 0.2, kvp: 18 },
    { thicknessInch: 0.5, kvp: 20 }, { thicknessInch: 1, kvp: 23 },
    { thicknessInch: 2, kvp: 30 }, { thicknessInch: 3, kvp: 36 },
    { thicknessInch: 4, kvp: 42 }, { thicknessInch: 5, kvp: 50 },
  ],
};

export interface Ps811000EnergySuggestion {
  approximateKvp: number;
  lowerKvp: number;
  upperKvp: number;
  curve: Ps811000EnergyCurve;
  thicknessInch: number;
  basis: 'Figure 2 digitized graph';
}

const interpolateLogLog = (low: EnergyPoint, high: EnergyPoint, thicknessInch: number): number => {
  const fraction = (
    (Math.log10(thicknessInch) - Math.log10(low.thicknessInch))
    / (Math.log10(high.thicknessInch) - Math.log10(low.thicknessInch))
  );
  const logKvp = Math.log10(low.kvp) + fraction * (Math.log10(high.kvp) - Math.log10(low.kvp));
  return 10 ** logKvp;
};

export function lookupPs811000EnergySuggestion(
  curve: Ps811000EnergyCurve,
  thickness: number | '',
  unit: LengthUnit,
): Ps811000EnergySuggestion | null {
  if (typeof thickness !== 'number' || !Number.isFinite(thickness) || thickness <= 0) return null;
  const thicknessInch = unit === 'inch' ? thickness : thickness / INCH_TO_MM;
  const points = ENERGY_CURVES[curve];
  if (thicknessInch < points[0].thicknessInch || thicknessInch > points[points.length - 1].thicknessInch) return null;

  const exact = points.find((point) => point.thicknessInch === thicknessInch);
  let approximateKvp: number;
  if (exact) {
    approximateKvp = exact.kvp;
  } else {
    const upperIndex = points.findIndex((point) => point.thicknessInch > thicknessInch);
    approximateKvp = interpolateLogLog(points[upperIndex - 1], points[upperIndex], thicknessInch);
  }
  approximateKvp = Math.round(approximateKvp);
  return {
    approximateKvp,
    lowerKvp: Math.round(approximateKvp * 0.8),
    upperKvp: Math.round(approximateKvp * 1.2),
    curve,
    thicknessInch: Number(thicknessInch.toFixed(6)),
    basis: 'Figure 2 digitized graph',
  };
}

export function isThinAdhesiveTenKvpCase(
  curve: Ps811000EnergyCurve,
  thickness: number | '',
  unit: LengthUnit,
): boolean {
  if (curve !== 'graphite-adhesive-core' || typeof thickness !== 'number' || thickness < 0) return false;
  const thicknessInch = unit === 'inch' ? thickness : thickness / INCH_TO_MM;
  return thicknessInch < 0.020;
}
