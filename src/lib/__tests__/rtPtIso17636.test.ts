import { describe, expect, it } from 'vitest';
import {
  calculateIso17636MinimumSod,
  ISO_17636_1_MINIMUM_DENSITY,
} from '@/lib/rtIso17636';
import { decodeRtPtDocument, fingerprintRtPtApprovedContent } from '@/lib/rtPtDocumentCodec';
import { validateRtPtDocument } from '@/lib/rtPtValidation';
import { createCompleteCrDocument, createCompleteFilmDocument } from './rtPtV3Fixtures';

describe('ISO 17636 test-class rules', () => {
  it('computes the class A and class B minimum source-to-object distance', () => {
    // d = 2 mm, b = 100 mm: b^(2/3) = 21.5443...
    // Class A: 7.5 * 2 * 21.5443 = 323.2 mm; Class B doubles it.
    const classA = calculateIso17636MinimumSod('A', 2, 'mm', 100, 'mm', 'mm');
    expect(classA).not.toBeNull();
    expect(classA?.minimumSod).toBeCloseTo(323.2, 1);
    expect(classA?.factor).toBe(7.5);

    const classB = calculateIso17636MinimumSod('B', 2, 'mm', 100, 'mm', 'mm');
    expect(classB?.minimumSod).toBeCloseTo(646.3, 1);
    expect(classB?.factor).toBe(15);
  });

  it('converts mixed units into millimetres before applying the formula', () => {
    // 2 mm source expressed as inches, b = 100 mm, output in inches.
    const result = calculateIso17636MinimumSod('A', 2 / 25.4, 'inch', 100, 'mm', 'inch');
    expect(result).not.toBeNull();
    expect(result!.minimumSod * 25.4).toBeCloseTo(323.2, 0);
    expect(result?.sourceSizeMm).toBeCloseTo(2, 3);
  });

  it('returns null instead of guessing on missing or non-positive inputs', () => {
    expect(calculateIso17636MinimumSod('A', '', 'mm', 100, 'mm', 'mm')).toBeNull();
    expect(calculateIso17636MinimumSod('A', 0, 'mm', 100, 'mm', 'mm')).toBeNull();
    expect(calculateIso17636MinimumSod('B', 2, 'mm', '', 'mm', 'mm')).toBeNull();
    expect(calculateIso17636MinimumSod('B', 2, 'mm', -5, 'mm', 'mm')).toBeNull();
  });

  it('carries the ISO 17636-1 base density minimums per class', () => {
    expect(ISO_17636_1_MINIMUM_DENSITY.A).toBe(2);
    expect(ISO_17636_1_MINIMUM_DENSITY.B).toBe(2.3);
  });

  it('keeps canonical fingerprints stable for documents without a test class', () => {
    const document = createCompleteFilmDocument();
    expect('iso17636TestClass' in document.technique).toBe(false);
    const baseline = fingerprintRtPtApprovedContent(document);

    const decoded = decodeRtPtDocument(JSON.parse(JSON.stringify(document)));
    expect(decoded.status).toBe('success');
    if (decoded.status !== 'success') return;
    expect(JSON.stringify(decoded.document)).not.toContain('iso17636TestClass');
    expect(fingerprintRtPtApprovedContent(decoded.document)).toBe(baseline);

    const withClass = createCompleteFilmDocument();
    withClass.technique.iso17636TestClass = 'B';
    expect(fingerprintRtPtApprovedContent(withClass)).not.toBe(baseline);
    const roundTrip = decodeRtPtDocument(JSON.parse(JSON.stringify(withClass)));
    expect(roundTrip.status).toBe('success');
    if (roundTrip.status !== 'success') return;
    expect(roundTrip.document.method === 'RT-Film' && roundTrip.document.technique.iso17636TestClass).toBe('B');
  });

  it('enforces the class minimum density on ISO 17636-1 film techniques', () => {
    const document = createCompleteFilmDocument();
    document.technique.iso17636TestClass = 'A';
    // The fixture plans a 1.5 H&D minimum, below the class A base requirement of 2.0.
    const summary = validateRtPtDocument(document);
    expect(summary.issues.some((issue) => issue.label === 'ISO 17636-1 Class Density')).toBe(true);

    document.technique.filmSystem.requiredDensityMin = 2.3;
    expect(validateRtPtDocument(document).issues.some((issue) => issue.label === 'ISO 17636-1 Class Density')).toBe(false);
  });

  it('enforces the class minimum source-to-object distance per view on film and CR', () => {
    const film = createCompleteFilmDocument();
    film.technique.iso17636TestClass = 'B';
    // f >= 15 * 4 * 10^(2/3) = 278.5 mm while the planned SOD is 100 mm.
    film.technique.source.xRay.focalSpotSize = 4;
    const filmSummary = validateRtPtDocument(film);
    expect(filmSummary.issues.some((issue) => issue.label.includes('ISO 17636 Minimum Distance'))).toBe(true);

    const cr = createCompleteCrDocument();
    cr.technique.iso17636TestClass = 'B';
    cr.technique.source.xRay.focalSpotSize = 4;
    const crSummary = validateRtPtDocument(cr);
    expect(crSummary.issues.some((issue) => issue.label.includes('ISO 17636 Minimum Distance'))).toBe(true);

    // The unmodified fixtures (1 mm focal spot, SOD 100 mm, b = 10 mm) satisfy both classes.
    const compliant = createCompleteCrDocument();
    compliant.technique.iso17636TestClass = 'B';
    expect(validateRtPtDocument(compliant).issues).toEqual([]);
  });
});
