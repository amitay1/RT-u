import type { LengthUnit, NumberOrEmpty } from '@/types/rtFilm';
import { lengthToMillimeters } from '@/lib/rtGeometry';
import type { Iso17636TestClass } from '@/lib/rtIso17636';

/**
 * Minimum number of exposures for full circumferential weld coverage of a
 * pipe, computed from EXACT ray geometry through the pipe annulus.
 *
 * Basis: ISO 17636-1 Annex A limits the penetrated-thickness increase at the
 * edge of the evaluated length to 20% for test class A and 10% for class B.
 * Instead of transcribing the standard's nomograms, this module traces the
 * ray from the source through the annulus and measures the film-side wall
 * path length directly (line-circle intersections — deterministic geometry,
 * nothing interpolated), then finds by bisection the largest weld arc whose
 * edge ray still satisfies the class limit. The controlled standard text and
 * its nomograms remain the release authority; this calculator is the
 * planning aid the numbers are checked against.
 *
 * Supported setups:
 * - 'external-double-wall': source outside the pipe (DWSI / DWDI practice),
 *   film wrapped at the far (film-side) outer surface; the far wall is the
 *   evaluated weld. The source-to-film distance is measured through the pipe
 *   axis to the film plane, so the source sits at SFD - De from the near
 *   surface and SFD - De/2 from the pipe axis.
 * - 'internal-panoramic': source centred on the pipe axis exposing the full
 *   circumference at once — a single exposure by construction.
 */

export type RtCircumferentialSetup = 'external-double-wall' | 'internal-panoramic';

const CLASS_THICKNESS_INCREASE_LIMIT: Record<Iso17636TestClass, number> = {
  A: 1.2,
  B: 1.1,
};

interface RaySegments {
  /** Path length through the film-side (far) wall, or null when the ray misses the bore. */
  farWallLength: number | null;
}

/**
 * Sorted ray parameters where the line S + s*(P-S)/|P-S| crosses a circle of
 * radius r centred on the origin. Returns [] when the line misses the circle.
 */
const circleCrossings = (
  sx: number,
  sy: number,
  ux: number,
  uy: number,
  radius: number,
): number[] => {
  // |S + s*u|^2 = r^2  with |u| = 1  ->  s^2 + 2 s (S.u) + |S|^2 - r^2 = 0
  const b = sx * ux + sy * uy;
  const c = sx * sx + sy * sy - radius * radius;
  const discriminant = b * b - c;
  if (discriminant <= 0) return [];
  const root = Math.sqrt(discriminant);
  return [-b - root, -b + root];
};

const traceFarWall = (
  outerRadius: number,
  innerRadius: number,
  sourceCenterDistance: number,
  targetAngle: number,
): RaySegments => {
  const sx = sourceCenterDistance;
  const sy = 0;
  const midRadius = (outerRadius + innerRadius) / 2;
  // Target point on the far half of the mid-wall circle; targetAngle is
  // measured from the far pole (the point diametrically opposite the source).
  const px = -midRadius * Math.cos(targetAngle);
  const py = midRadius * Math.sin(targetAngle);
  const dx = px - sx;
  const dy = py - sy;
  const length = Math.hypot(dx, dy);
  if (length === 0) return { farWallLength: null };
  const ux = dx / length;
  const uy = dy / length;

  const outer = circleCrossings(sx, sy, ux, uy, outerRadius);
  const inner = circleCrossings(sx, sy, ux, uy, innerRadius);
  if (outer.length !== 2 || inner.length !== 2) {
    // The ray grazes past the bore: the whole chord is wall material and the
    // class limit is far exceeded — treat as outside the evaluated arc.
    return { farWallLength: null };
  }
  // Crossing order along the ray: outer(near), inner(near), inner(far), outer(far).
  return { farWallLength: outer[1] - inner[1] };
};

export interface RtCircumferentialExposureCountResult {
  setup: RtCircumferentialSetup;
  testClass: Iso17636TestClass;
  /** Allowed penetrated-thickness ratio at the evaluated-length edge (1.2 / 1.1). */
  thicknessIncreaseLimit: number;
  /** Half-angle of the weld arc one exposure covers, in degrees (mid-wall). */
  coverageHalfAngleDeg: number;
  minimumExposureCount: number;
}

export interface RtCircumferentialInputs {
  setup: RtCircumferentialSetup;
  testClass: Iso17636TestClass;
  outerDiameter: NumberOrEmpty;
  outerDiameterUnit: LengthUnit;
  wallThickness: NumberOrEmpty;
  wallThicknessUnit: LengthUnit;
  /** Source-to-film distance through the pipe axis (external setups). */
  sfd: NumberOrEmpty;
  sfdUnit: LengthUnit;
}

/**
 * Minimum exposure count for full circumferential coverage, or null when the
 * geometry is missing, non-positive, or physically impossible (wall thicker
 * than the radius, source inside the pipe for an external setup).
 */
export function calculateCircumferentialExposureCount(
  inputs: RtCircumferentialInputs,
): RtCircumferentialExposureCountResult | null {
  const { setup, testClass } = inputs;
  const limit = CLASS_THICKNESS_INCREASE_LIMIT[testClass];

  if (
    inputs.outerDiameter === ''
    || inputs.wallThickness === ''
    || !Number.isFinite(inputs.outerDiameter)
    || !Number.isFinite(inputs.wallThickness)
    || inputs.outerDiameter <= 0
    || inputs.wallThickness <= 0
  ) {
    return null;
  }
  const outerRadius = lengthToMillimeters(inputs.outerDiameter, inputs.outerDiameterUnit) / 2;
  const wall = lengthToMillimeters(inputs.wallThickness, inputs.wallThicknessUnit);
  const innerRadius = outerRadius - wall;
  if (innerRadius <= 0) return null;

  if (setup === 'internal-panoramic') {
    return {
      setup,
      testClass,
      thicknessIncreaseLimit: limit,
      coverageHalfAngleDeg: 180,
      minimumExposureCount: 1,
    };
  }

  if (inputs.sfd === '' || !Number.isFinite(inputs.sfd) || inputs.sfd <= 0) return null;
  const sfd = lengthToMillimeters(inputs.sfd, inputs.sfdUnit);
  // Film at the far outer surface; the source must clear the near surface.
  const sourceCenterDistance = sfd - outerRadius;
  if (sourceCenterDistance <= outerRadius) return null;

  const radialReference = traceFarWall(outerRadius, innerRadius, sourceCenterDistance, 0);
  if (radialReference.farWallLength === null || radialReference.farWallLength <= 0) return null;
  const allowed = radialReference.farWallLength * limit;

  const withinLimit = (angle: number): boolean => {
    const traced = traceFarWall(outerRadius, innerRadius, sourceCenterDistance, angle);
    return traced.farWallLength !== null && traced.farWallLength <= allowed;
  };

  // The far-wall path grows monotonically with the target angle until the ray
  // grazes the bore, so a bisection on [0, pi/2) finds the coverage edge.
  let low = 0;
  let high = Math.PI / 2;
  if (withinLimit(high)) {
    low = high;
  } else {
    for (let iteration = 0; iteration < 60; iteration += 1) {
      const middle = (low + high) / 2;
      if (withinLimit(middle)) low = middle;
      else high = middle;
    }
  }
  if (low <= 0) return null;

  const coverageHalfAngleDeg = (low * 180) / Math.PI;
  return {
    setup,
    testClass,
    thicknessIncreaseLimit: limit,
    coverageHalfAngleDeg: Math.round(coverageHalfAngleDeg * 100) / 100,
    minimumExposureCount: Math.max(1, Math.ceil(180 / coverageHalfAngleDeg)),
  };
}
