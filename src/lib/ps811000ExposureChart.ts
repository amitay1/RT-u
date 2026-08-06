/**
 * PS811000E C1 exposure chart.
 *
 * Purpose: let the operator read kV and mA off a table instead of working each
 * exposure out by hand.
 *
 * Provenance of every number produced here:
 *   - kVp band .............. Figure 2 digitized curves, +/-20% per para. 9.2.1
 *   - equivalent thickness .. Table 1 radiographic equivalence factors
 *   - maximum Ug ............ Table 8
 *   - lead screens .......... Table 2
 *   - mA / time / mAs ....... NOT in PS811000. Para. 9.12.8.m(2) only requires
 *                             that milliamperage be recorded; the specification
 *                             supplies no machine values. Every mAs figure below
 *                             is derived from operator-entered anchor points
 *                             measured on their own qualified machine, using the
 *                             inverse-square law and the log-linear exposure-chart
 *                             relation. Nothing is invented.
 */
import {
  lookupPs811000EnergySuggestion,
  lookupPs811000EquivalenceFactor,
  lookupPs811000LeadScreens,
  lookupPs811000UgLimit,
  type Ps811000LeadScreenRecommendation,
  type Ps811000UgLimit,
} from '@/lib/ps811000';
import { lengthToMillimeters, millimetersToLength } from '@/lib/rtGeometry';
import type {
  LengthUnit,
  NumberOrEmpty,
  Ps811000EnergyCurve,
  RtFilmExposureAnchor,
  TimeUnit,
} from '@/types/rtFilm';

const isNumber = (value: NumberOrEmpty): value is number => (
  typeof value === 'number' && Number.isFinite(value)
);

const toSeconds = (time: number, unit: TimeUnit): number | null => {
  if (unit === 's') return time;
  if (unit === 'min') return time * 60;
  return null;
};

const fromSeconds = (seconds: number, unit: TimeUnit): number | null => {
  if (unit === 's') return seconds;
  if (unit === 'min') return seconds / 60;
  return null;
};

/**
 * Table 1 equivalent thickness. The factor converts a thickness of `material`
 * into the thickness of the curve's reference material that absorbs the same
 * amount at that voltage, so Figure 2 can be read for materials it does not plot.
 *
 * Para. 9.2.2: steel carries the 1.0 factor except at 50 kV and 100 kV, where
 * aluminium does. Table 1 lists discrete voltages only, so an unlisted voltage
 * returns null rather than an interpolated guess.
 */
export interface Ps811000EquivalentThickness {
  equivalentThickness: number;
  factor: number;
  voltageKv: number;
  referenceMaterial: 'aluminum' | 'steel';
  basis: 'Table 1';
}

export function calculatePs811000EquivalentThickness(
  thickness: NumberOrEmpty,
  material: string,
  voltageKv: NumberOrEmpty,
): Ps811000EquivalentThickness | null {
  if (!isNumber(thickness) || thickness < 0) return null;
  if (!isNumber(voltageKv)) return null;
  const factor = lookupPs811000EquivalenceFactor(material, voltageKv);
  if (factor === null) return null;
  return {
    equivalentThickness: Number((thickness * factor).toFixed(6)),
    factor,
    voltageKv,
    referenceMaterial: voltageKv === 50 || voltageKv === 100 ? 'aluminum' : 'steel',
    basis: 'Table 1',
  };
}

/**
 * Inverse-square law. Doubling the source-to-film distance quarters the
 * intensity at the film, so the exposure product has to grow by the square of
 * the distance ratio to keep the same density. Standard radiographic practice,
 * not a PS811000 table.
 */
export function scaleMasForDistance(
  mas: NumberOrEmpty,
  fromSfd: NumberOrEmpty,
  fromUnit: LengthUnit,
  toSfd: NumberOrEmpty,
  toUnit: LengthUnit,
): number | '' {
  if (!isNumber(mas) || mas < 0 || !isNumber(fromSfd) || !isNumber(toSfd)) return '';
  const fromMm = lengthToMillimeters(fromSfd, fromUnit);
  const toMm = lengthToMillimeters(toSfd, toUnit);
  if (fromMm <= 0 || toMm <= 0) return '';
  return Number((mas * (toMm / fromMm) ** 2).toFixed(4));
}

/**
 * Solve the mA / time / mAs triad: supply any two and the third follows.
 * Returns '' for whichever value cannot be determined.
 */
export interface ExposureTriad {
  currentMa: number | '';
  time: number | '';
  mas: number | '';
}

export function solveExposureTriad(
  currentMa: NumberOrEmpty,
  time: NumberOrEmpty,
  timeUnit: TimeUnit,
  mas: NumberOrEmpty,
): ExposureTriad {
  const haveMa = isNumber(currentMa) && currentMa > 0;
  const haveTime = isNumber(time) && time >= 0;
  const haveMas = isNumber(mas) && mas >= 0;

  if (haveMa && haveTime) {
    const seconds = toSeconds(time, timeUnit);
    if (seconds === null) return { currentMa, time, mas: '' };
    return { currentMa, time, mas: Number((currentMa * seconds).toFixed(4)) };
  }
  if (haveMa && haveMas) {
    const seconds = mas / currentMa;
    const converted = fromSeconds(seconds, timeUnit);
    return { currentMa, time: converted === null ? '' : Number(converted.toFixed(4)), mas };
  }
  if (haveTime && haveMas) {
    const seconds = toSeconds(time, timeUnit);
    if (seconds === null || seconds <= 0) return { currentMa: '', time, mas };
    return { currentMa: Number((mas / seconds).toFixed(4)), time, mas };
  }
  return {
    currentMa: haveMa ? currentMa : '',
    time: haveTime ? time : '',
    mas: haveMas ? mas : '',
  };
}

/**
 * A machine exposure chart is, at constant kV, a straight line of log(mAs)
 * against thickness — the classic plot every RT department keeps for its own
 * tube. Two qualified anchor points at the same kV therefore determine the
 * whole line for that machine:
 *
 *   log10(mAs) = intercept + slope * thickness_mm
 *
 * The fit belongs to the operator's machine, not to PS811000. With fewer than
 * two anchors at a voltage nothing is fitted and no mAs is produced.
 */
export interface MachineExposureFit {
  voltageKv: number;
  slopePerMm: number;
  interceptLog10: number;
  referenceSfdMm: number;
  anchorCount: number;
  thicknessMinMm: number;
  thicknessMaxMm: number;
}

interface NormalizedAnchor {
  thicknessMm: number;
  voltageKv: number;
  mas: number;
  sfdMm: number;
}

function normalizeAnchor(anchor: RtFilmExposureAnchor): NormalizedAnchor | null {
  if (!isNumber(anchor.thickness) || anchor.thickness < 0) return null;
  if (!isNumber(anchor.tubeVoltage) || anchor.tubeVoltage <= 0) return null;
  if (!isNumber(anchor.sfd) || anchor.sfd <= 0) return null;
  const { mas } = solveExposureTriad(anchor.tubeCurrent, anchor.exposureTime, anchor.exposureTimeUnit, '');
  if (!isNumber(mas) || mas <= 0) return null;
  return {
    thicknessMm: lengthToMillimeters(anchor.thickness, anchor.thicknessUnit),
    voltageKv: anchor.tubeVoltage,
    mas,
    sfdMm: lengthToMillimeters(anchor.sfd, anchor.sfdUnit),
  };
}

/**
 * Fit the machine line for the anchors recorded at `voltageKv`. All anchors are
 * first normalized to a single reference SFD by the inverse-square law so that
 * anchors shot at different distances stay comparable.
 */
export function fitMachineExposureChart(
  anchors: readonly RtFilmExposureAnchor[],
  voltageKv: NumberOrEmpty,
): MachineExposureFit | null {
  if (!isNumber(voltageKv)) return null;
  const points = anchors
    .map(normalizeAnchor)
    .filter((point): point is NormalizedAnchor => point !== null && point.voltageKv === voltageKv);
  if (points.length < 2) return null;

  const referenceSfdMm = points[0].sfdMm;
  const samples = points.map((point) => ({
    thicknessMm: point.thicknessMm,
    logMas: Math.log10(point.mas * (referenceSfdMm / point.sfdMm) ** 2),
  }));

  const n = samples.length;
  const meanThickness = samples.reduce((sum, s) => sum + s.thicknessMm, 0) / n;
  const meanLogMas = samples.reduce((sum, s) => sum + s.logMas, 0) / n;
  const variance = samples.reduce((sum, s) => sum + (s.thicknessMm - meanThickness) ** 2, 0);
  // Every anchor at the same thickness leaves the slope undetermined.
  if (variance <= 0) return null;
  const covariance = samples.reduce(
    (sum, s) => sum + (s.thicknessMm - meanThickness) * (s.logMas - meanLogMas),
    0,
  );
  const slopePerMm = covariance / variance;

  const thicknesses = samples.map((s) => s.thicknessMm);
  return {
    voltageKv,
    slopePerMm,
    interceptLog10: meanLogMas - slopePerMm * meanThickness,
    referenceSfdMm,
    anchorCount: n,
    thicknessMinMm: Math.min(...thicknesses),
    thicknessMaxMm: Math.max(...thicknesses),
  };
}

export interface MachineExposurePrediction {
  mas: number;
  extrapolated: boolean;
}

export function predictMasFromFit(
  fit: MachineExposureFit,
  thickness: NumberOrEmpty,
  thicknessUnit: LengthUnit,
  targetSfd: NumberOrEmpty,
  targetSfdUnit: LengthUnit,
): MachineExposurePrediction | null {
  if (!isNumber(thickness) || thickness < 0) return null;
  const thicknessMm = lengthToMillimeters(thickness, thicknessUnit);
  const atReference = 10 ** (fit.interceptLog10 + fit.slopePerMm * thicknessMm);
  if (!Number.isFinite(atReference) || atReference <= 0) return null;

  let mas = atReference;
  if (isNumber(targetSfd) && targetSfd > 0) {
    const targetMm = lengthToMillimeters(targetSfd, targetSfdUnit);
    if (targetMm > 0) mas = atReference * (targetMm / fit.referenceSfdMm) ** 2;
  }
  return {
    mas: Number(mas.toFixed(4)),
    extrapolated: thicknessMm < fit.thicknessMinMm || thicknessMm > fit.thicknessMaxMm,
  };
}

export interface Ps811000ExposureChartRow {
  thickness: number;
  equivalentThickness: number | null;
  equivalenceFactor: number | null;
  approximateKvp: number | null;
  lowerKvp: number | null;
  upperKvp: number | null;
  ugLimit: Ps811000UgLimit | null;
  leadScreens: readonly Ps811000LeadScreenRecommendation[];
  mas: number | null;
  currentMa: number | null;
  exposureTime: number | null;
  masExtrapolated: boolean;
}

export interface Ps811000ExposureChartOptions {
  curve: Ps811000EnergyCurve | '';
  thicknessFrom: NumberOrEmpty;
  thicknessTo: NumberOrEmpty;
  thicknessUnit: LengthUnit;
  rowCount?: number;
  equivalenceMaterial?: string;
  /** Voltage used for the Table 1 factor lookup; falls back to each row's own kVp. */
  equivalenceVoltageKv?: NumberOrEmpty;
  anchors?: readonly RtFilmExposureAnchor[];
  /** Voltage the machine chart was shot at; anchors are filtered to it. */
  machineVoltageKv?: NumberOrEmpty;
  /** Planned SFD the derived mAs is corrected to. */
  targetSfd?: NumberOrEmpty;
  targetSfdUnit?: LengthUnit;
  /** Planned tube current; when set, the derived mAs is turned into a time. */
  plannedCurrentMa?: NumberOrEmpty;
  exposureTimeUnit?: TimeUnit;
}

export interface Ps811000ExposureChart {
  rows: readonly Ps811000ExposureChartRow[];
  thicknessUnit: LengthUnit;
  fit: MachineExposureFit | null;
  /** Why no mA column is populated, when that is the case. */
  machineChartNotice: string | null;
}

const DEFAULT_ROW_COUNT = 10;
const MAX_ROW_COUNT = 40;

function buildThicknessLadder(from: number, to: number, rowCount: number): number[] {
  if (to <= from) return [Number(from.toFixed(4))];
  const step = (to - from) / (rowCount - 1);
  return Array.from({ length: rowCount }, (_, index) => Number((from + step * index).toFixed(4)));
}

export function buildPs811000ExposureChart(
  options: Ps811000ExposureChartOptions,
): Ps811000ExposureChart {
  const {
    curve,
    thicknessFrom,
    thicknessTo,
    thicknessUnit,
    rowCount = DEFAULT_ROW_COUNT,
    equivalenceMaterial = '',
    equivalenceVoltageKv = '',
    anchors = [],
    machineVoltageKv = '',
    targetSfd = '',
    targetSfdUnit = thicknessUnit,
    plannedCurrentMa = '',
    exposureTimeUnit = 's',
  } = options;

  if (!isNumber(thicknessFrom) || thicknessFrom < 0 || !isNumber(thicknessTo) || thicknessTo < 0) {
    return { rows: [], thicknessUnit, fit: null, machineChartNotice: null };
  }

  const clampedRowCount = Math.min(Math.max(Math.trunc(rowCount), 2), MAX_ROW_COUNT);
  const ladder = buildThicknessLadder(
    Math.min(thicknessFrom, thicknessTo),
    Math.max(thicknessFrom, thicknessTo),
    clampedRowCount,
  );

  const fit = fitMachineExposureChart(anchors, machineVoltageKv);
  const usableAnchors = anchors.filter((anchor) => normalizeAnchor(anchor) !== null);
  let machineChartNotice: string | null = null;
  if (!fit) {
    machineChartNotice = !isNumber(machineVoltageKv)
      ? 'Enter the tube voltage the machine chart was shot at to derive mA and time.'
      : usableAnchors.length === 0
        ? 'PS811000E supplies no mA values. Add at least two qualified exposures from this machine to derive them.'
        : 'At least two qualified exposures at this voltage, taken at different thicknesses, are required to derive mA and time.';
  }

  const rows = ladder.map<Ps811000ExposureChartRow>((thickness) => {
    const energy = curve ? lookupPs811000EnergySuggestion(curve, thickness, thicknessUnit) : null;
    const factorVoltage = isNumber(equivalenceVoltageKv) ? equivalenceVoltageKv : energy?.approximateKvp ?? '';
    const equivalent = equivalenceMaterial
      ? calculatePs811000EquivalentThickness(thickness, equivalenceMaterial, factorVoltage)
      : null;
    const prediction = fit
      ? predictMasFromFit(fit, thickness, thicknessUnit, targetSfd, targetSfdUnit)
      : null;

    let currentMa: number | null = null;
    let exposureTime: number | null = null;
    if (prediction && isNumber(plannedCurrentMa) && plannedCurrentMa > 0) {
      const solved = solveExposureTriad(plannedCurrentMa, '', exposureTimeUnit, prediction.mas);
      currentMa = plannedCurrentMa;
      exposureTime = isNumber(solved.time) ? solved.time : null;
    }

    return {
      thickness,
      equivalentThickness: equivalent?.equivalentThickness ?? null,
      equivalenceFactor: equivalent?.factor ?? null,
      approximateKvp: energy?.approximateKvp ?? null,
      lowerKvp: energy?.lowerKvp ?? null,
      upperKvp: energy?.upperKvp ?? null,
      ugLimit: lookupPs811000UgLimit(thickness, thicknessUnit),
      leadScreens: energy ? lookupPs811000LeadScreens(energy.approximateKvp) : [],
      mas: prediction?.mas ?? null,
      currentMa,
      exposureTime,
      masExtrapolated: prediction?.extrapolated ?? false,
    };
  });

  return { rows, thicknessUnit, fit, machineChartNotice };
}

/** Convenience for the UI: the Ug limit expressed in the caller's unit. */
export function ugLimitInUnit(limit: Ps811000UgLimit | null, unit: LengthUnit): number | null {
  if (!limit) return null;
  return unit === 'inch' ? limit.maximumInch : limit.maximumMm;
}

export { lengthToMillimeters, millimetersToLength };
