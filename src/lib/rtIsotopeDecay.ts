import type { NumberOrEmpty } from '@/types/rtFilm';

/**
 * Gamma-source decay planning for the RT-Film technique workflow.
 *
 * Half-life constants are stable published nuclear data (DDEP/NNDC evaluated
 * values, quoted to the precision commonly used in industrial radiography
 * planning). They are engineering constants, not spec-controlled lookups; the
 * source certificate remains the controlled basis for the referenced activity
 * itself. Nothing here writes into the controlled document — every output is
 * a computed planning aid derived from operator-entered fields.
 *
 * Decay model: A(t) = A0 * 2^(-t / T1/2). The exposure-time correction factor
 * is the reciprocal, 2^(t / T1/2), applied to an exposure time that was valid
 * at the referenced activity.
 */

export interface RtIsotopeDefinition {
  /** Canonical identifier printed on documents, e.g. 'Ir-192'. */
  id: string;
  displayName: string;
  halfLifeDays: number;
  /** Normalized alias keys (see normalizeIsotopeKey) that resolve to this entry. */
  aliasKeys: ReadonlyArray<string>;
}

export const RT_ISOTOPE_LIBRARY: ReadonlyArray<RtIsotopeDefinition> = [
  {
    id: 'Ir-192',
    displayName: 'Iridium-192',
    halfLifeDays: 73.83,
    aliasKeys: ['ir192', 'iridium192', '192ir'],
  },
  {
    id: 'Se-75',
    displayName: 'Selenium-75',
    halfLifeDays: 119.78,
    aliasKeys: ['se75', 'selenium75', '75se'],
  },
  {
    id: 'Co-60',
    displayName: 'Cobalt-60',
    halfLifeDays: 1925.28,
    aliasKeys: ['co60', 'cobalt60', '60co'],
  },
];

/** Display list of the built-in isotope ids, e.g. for placeholders and hints. */
export const RT_SUPPORTED_ISOTOPE_IDS = RT_ISOTOPE_LIBRARY.map((entry) => entry.id).join(', ');

/** Lowercases and strips everything except letters and digits, so 'Ir - 192' -> 'ir192'. */
const normalizeIsotopeKey = (raw: string): string => raw.toLowerCase().replace(/[^a-z0-9]/g, '');

/** Resolves free-text isotope input to a library entry, or null when unrecognized. */
export const resolveRtIsotope = (raw: string): RtIsotopeDefinition | null => {
  const key = normalizeIsotopeKey(raw);
  if (!key) {
    return null;
  }
  return RT_ISOTOPE_LIBRARY.find((entry) => entry.aliasKeys.includes(key)) ?? null;
};

const ISO_CALENDAR_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Strict YYYY-MM-DD parse to a UTC timestamp; null for malformed or impossible dates. */
const parseIsoCalendarDateUtc = (value: string): number | null => {
  const match = ISO_CALENDAR_DATE_PATTERN.exec(value);
  if (!match) {
    return null;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const timestamp = Date.UTC(year, month - 1, day);
  const roundTrip = new Date(timestamp);
  if (
    roundTrip.getUTCFullYear() !== year
    || roundTrip.getUTCMonth() !== month - 1
    || roundTrip.getUTCDate() !== day
  ) {
    return null;
  }
  return timestamp;
};

const MILLISECONDS_PER_DAY = 86_400_000;

/** Whole calendar days from one ISO date to another (negative when target precedes reference). */
export const differenceInCalendarDays = (fromIso: string, toIso: string): number | null => {
  const from = parseIsoCalendarDateUtc(fromIso);
  const to = parseIsoCalendarDateUtc(toIso);
  if (from === null || to === null) {
    return null;
  }
  return Math.round((to - from) / MILLISECONDS_PER_DAY);
};

const roundToSignificant = (value: number, digits: number): number => {
  if (value === 0) {
    return 0;
  }
  const magnitude = Math.ceil(Math.log10(Math.abs(value)));
  const factor = 10 ** (digits - magnitude);
  return Math.round(value * factor) / factor;
};

export interface RtIsotopeDecayResult {
  /** Whole days from the activity reference date to the target date (negative = target earlier). */
  elapsedDays: number;
  /** elapsedDays expressed in half-lives. */
  halfLives: number;
  /** 2^(-elapsedDays / halfLifeDays), rounded to 4 significant digits. */
  decayFactor: number;
  /** Referenced activity multiplied by the decay factor, rounded to 4 significant digits. */
  decayedActivity: number;
  /** 2^(elapsedDays / halfLifeDays) — multiply an exposure time valid at the referenced activity. */
  exposureTimeMultiplier: number;
}

/**
 * Computes decayed activity between two ISO calendar dates. Returns null when
 * the activity is missing or non-positive, either date is invalid, or the
 * half-life is non-positive — never a guessed value.
 */
export const calculateDecayedActivity = (
  activity: NumberOrEmpty,
  activityReferenceDateIso: string,
  targetDateIso: string,
  halfLifeDays: number,
): RtIsotopeDecayResult | null => {
  if (activity === '' || !Number.isFinite(activity) || activity <= 0 || halfLifeDays <= 0) {
    return null;
  }
  const elapsedDays = differenceInCalendarDays(activityReferenceDateIso, targetDateIso);
  if (elapsedDays === null) {
    return null;
  }
  const halfLives = elapsedDays / halfLifeDays;
  const decayFactor = 2 ** -halfLives;
  return {
    elapsedDays,
    halfLives: roundToSignificant(halfLives, 4),
    decayFactor: roundToSignificant(decayFactor, 4),
    decayedActivity: roundToSignificant(activity * decayFactor, 4),
    exposureTimeMultiplier: roundToSignificant(1 / decayFactor, 4),
  };
};
