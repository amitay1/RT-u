import type { DetectorLengthUnit } from '@/types/rtFilm';

/**
 * Duplex-wire IQI element identity data per ISO 19232-5 / ASTM E2002.
 *
 * Each element pairs two wires of diameter d separated by d; the element is
 * "resolved" when the pair separates, which corresponds to a total image
 * unsharpness of 2d and a basic spatial resolution SRb of d. The element
 * series (13D..1D) and its wire diameters are the stable published identity
 * table; requirements (which element a technique must resolve) remain with
 * the governing specification.
 */

export interface RtDuplexElement {
  /** Canonical element id, e.g. '13D'. */
  element: string;
  wireDiameterMm: number;
  /** Total image unsharpness at the resolution limit: 2 x wire diameter. */
  unsharpnessMm: number;
}

const buildElement = (index: number, wireDiameterMm: number): RtDuplexElement => ({
  element: `${index}D`,
  wireDiameterMm,
  unsharpnessMm: Math.round(wireDiameterMm * 2 * 1000) / 1000,
});

/** 13D (finest) .. 1D (coarsest). */
export const RT_DUPLEX_ELEMENTS: ReadonlyArray<RtDuplexElement> = [
  buildElement(13, 0.05),
  buildElement(12, 0.063),
  buildElement(11, 0.08),
  buildElement(10, 0.1),
  buildElement(9, 0.13),
  buildElement(8, 0.16),
  buildElement(7, 0.2),
  buildElement(6, 0.25),
  buildElement(5, 0.32),
  buildElement(4, 0.4),
  buildElement(3, 0.5),
  buildElement(2, 0.64),
  buildElement(1, 0.8),
];

/** Accepts '13D', 'D13', 'd 13', 'duplex 13' and similar spellings. */
export function resolveRtDuplexElement(raw: string): RtDuplexElement | null {
  const match = /(\d{1,2})\s*d|d\s*(\d{1,2})/i.exec(raw.trim());
  if (!match) return null;
  const index = Number(match[1] ?? match[2]);
  return RT_DUPLEX_ELEMENTS.find((entry) => entry.element === `${index}D`) ?? null;
}

const MM_PER_UNIT: Record<DetectorLengthUnit, number> = {
  um: 0.001,
  mm: 1,
  inch: 25.4,
};

export const detectorLengthToMillimeters = (
  value: number,
  unit: DetectorLengthUnit,
): number => value * MM_PER_UNIT[unit];

/**
 * True when an image with the given basic spatial resolution can resolve the
 * duplex element (SRb <= wire diameter). Null when the SRb is not numeric.
 */
export function duplexElementResolvedBySrb(
  element: RtDuplexElement,
  srb: number | '',
  srbUnit: DetectorLengthUnit,
): boolean | null {
  if (srb === '' || !Number.isFinite(srb) || srb <= 0) return null;
  return detectorLengthToMillimeters(srb, srbUnit) <= element.wireDiameterMm + 1e-9;
}
