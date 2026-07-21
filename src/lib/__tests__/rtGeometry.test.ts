import { describe, expect, it } from 'vitest';
import {
  applyDigitalAutoMagnification,
  applyFilmAutoMagnification,
  calculateDigitalGeometricUnsharpness,
  calculateDigitalMagnification,
  calculateFilmGeometricUnsharpness,
  calculateFilmMagnification,
  calculateGeometricUnsharpness,
} from '@/lib/rtGeometry';
import { createCompleteDigitalDocument, createCompleteFilmDocument } from './rtPtV3Fixtures';

describe('RT V3 geometry', () => {
  it('normalizes mixed units before calculating film and DDA magnification', () => {
    const film = createCompleteFilmDocument().technique.exposureViews[0];
    const digital = createCompleteDigitalDocument().technique.acquisitions[0];

    expect(calculateFilmMagnification({
      ...film,
      sfd: 2,
      sfdUnit: 'inch',
      sod: 25.4,
      sodUnit: 'mm',
    })).toBe(2);
    expect(calculateDigitalMagnification({
      ...digital,
      sdd: 2,
      sddUnit: 'inch',
      sod: 25.4,
      sodUnit: 'mm',
    })).toBe(2);
  });

  it('does not infer magnification from missing or zero source-to-object distance', () => {
    const film = createCompleteFilmDocument().technique.exposureViews[0];
    const digital = createCompleteDigitalDocument().technique.acquisitions[0];
    expect(calculateFilmMagnification({ ...film, sod: '' })).toBe('');
    expect(calculateDigitalMagnification({ ...digital, sod: 0 })).toBe('');
  });

  it('retains manual magnification and updates only auto-enabled plans', () => {
    const film = createCompleteFilmDocument().technique.exposureViews[0];
    const digital = createCompleteDigitalDocument().technique.acquisitions[0];
    expect(applyFilmAutoMagnification({
      ...film,
      geometricMagnificationAuto: false,
      geometricMagnification: 9,
    }).geometricMagnification).toBe(9);
    expect(applyDigitalAutoMagnification({
      ...digital,
      magnificationAuto: true,
      sdd: 2,
      sddUnit: 'inch',
      sod: 25.4,
      sodUnit: 'mm',
    }).magnification).toBe(2);
  });

  it('calculates Ug with mixed units and returns it in the requested unit', () => {
    expect(calculateGeometricUnsharpness(
      1,
      'mm',
      1,
      'inch',
      254,
      'mm',
      'inch',
    )).toBeCloseTo(0.003937007874, 10);
  });

  it('selects Film X-ray/Gamma and Digital focal source size without persisting a result', () => {
    const filmDocument = createCompleteFilmDocument();
    const filmView = filmDocument.technique.exposureViews[0];
    expect(calculateFilmGeometricUnsharpness(filmView, filmDocument.technique.source)).toBe(0.1);

    const gammaSource = {
      ...filmDocument.technique.source,
      sourceType: 'Gamma' as const,
      xRay: { focalSpotSize: '' as const, focalSpotSizeUnit: 'mm' as const },
      gamma: {
        isotope: 'Controlled isotope',
        sourceId: 'SRC-1',
        activity: 1,
        activityUnit: 'unit',
        activityReferenceDate: '2026-07-20',
        effectiveSourceSize: 2,
        effectiveSourceSizeUnit: 'mm' as const,
      },
    };
    expect(calculateFilmGeometricUnsharpness(filmView, gammaSource)).toBe(0.2);

    const digitalDocument = createCompleteDigitalDocument();
    expect(calculateDigitalGeometricUnsharpness(
      digitalDocument.technique.acquisitions[0],
      digitalDocument.technique.source,
    )).toBe(0.1);
    expect(digitalDocument.technique.acquisitions[0]).not.toHaveProperty('calculatedUg');
  });

  it('does not infer Ug when any source or geometry input is missing', () => {
    expect(calculateGeometricUnsharpness('', 'mm', 10, 'mm', 100, 'mm', 'mm')).toBe('');
    expect(calculateGeometricUnsharpness(1, 'mm', '', 'mm', 100, 'mm', 'mm')).toBe('');
    expect(calculateGeometricUnsharpness(1, 'mm', 10, 'mm', '', 'mm', 'mm')).toBe('');
  });
});
