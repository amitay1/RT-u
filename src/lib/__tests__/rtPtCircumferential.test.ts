import { describe, expect, it } from 'vitest';
import { calculateCircumferentialExposureCount } from '@/lib/rtCircumferential';
import { decodeRtPtDocument, fingerprintRtPtApprovedContent } from '@/lib/rtPtDocumentCodec';
import { validateRtPtDocument } from '@/lib/rtPtValidation';
import { getRtPtExportSections } from '@/utils/export/RtPtTechniquePDF';
import { createCompleteCrDocument, createCompleteFilmDocument } from './rtPtV3Fixtures';

describe('circumferential exposure-count planning', () => {
  it('covers the full circumference with a single centred panoramic exposure', () => {
    const result = calculateCircumferentialExposureCount({
      setup: 'internal-panoramic',
      testClass: 'A',
      outerDiameter: 200,
      outerDiameterUnit: 'mm',
      wallThickness: 8,
      wallThicknessUnit: 'mm',
      sfd: '',
      sfdUnit: 'mm',
    });
    expect(result?.minimumExposureCount).toBe(1);
    expect(result?.coverageHalfAngleDeg).toBe(180);
  });

  it('approaches the thin-wall parallel-beam limit at a very large SFD', () => {
    // Thin wall, effectively parallel beam: the far-wall path is ~ t / cos(angle),
    // so the class limit k bounds the coverage half-angle at arccos(1/k):
    // class A (k = 1.2): 33.56 deg -> ceil(180 / 33.56) = 6 exposures;
    // class B (k = 1.1): 24.62 deg -> ceil(180 / 24.62) = 8 exposures.
    const base = {
      setup: 'external-double-wall' as const,
      outerDiameter: 200,
      outerDiameterUnit: 'mm' as const,
      wallThickness: 2,
      wallThicknessUnit: 'mm' as const,
      sfd: 1_000_000,
      sfdUnit: 'mm' as const,
    };
    const classA = calculateCircumferentialExposureCount({ ...base, testClass: 'A' });
    expect(classA?.coverageHalfAngleDeg).toBeCloseTo(33.56, 0);
    expect(classA?.minimumExposureCount).toBe(6);

    const classB = calculateCircumferentialExposureCount({ ...base, testClass: 'B' });
    expect(classB?.coverageHalfAngleDeg).toBeCloseTo(24.62, 0);
    expect(classB?.minimumExposureCount).toBe(8);
  });

  it('widens film-side coverage as the source moves closer (beam divergence aligns with the far wall)', () => {
    // For the evaluated FILM-SIDE wall, a diverging beam from a finite SFD
    // meets the far wall closer to the local radius than a parallel beam at
    // the same arc position, so coverage per exposure grows as SFD shrinks.
    const far = calculateCircumferentialExposureCount({
      setup: 'external-double-wall',
      testClass: 'B',
      outerDiameter: 200,
      outerDiameterUnit: 'mm',
      wallThickness: 8,
      wallThicknessUnit: 'mm',
      sfd: 1_000_000,
      sfdUnit: 'mm',
    });
    const near = calculateCircumferentialExposureCount({
      setup: 'external-double-wall',
      testClass: 'B',
      outerDiameter: 200,
      outerDiameterUnit: 'mm',
      wallThickness: 8,
      wallThicknessUnit: 'mm',
      sfd: 700,
      sfdUnit: 'mm',
    });
    expect(far).not.toBeNull();
    expect(near).not.toBeNull();
    expect(near!.coverageHalfAngleDeg).toBeGreaterThanOrEqual(far!.coverageHalfAngleDeg);
    expect(near!.minimumExposureCount).toBeLessThanOrEqual(far!.minimumExposureCount);
    expect(near!.minimumExposureCount).toBeGreaterThanOrEqual(2);
  });

  it('tightens class B coverage relative to class A on identical geometry', () => {
    const shared = {
      setup: 'external-double-wall' as const,
      outerDiameter: 300,
      outerDiameterUnit: 'mm' as const,
      wallThickness: 10,
      wallThicknessUnit: 'mm' as const,
      sfd: 1000,
      sfdUnit: 'mm' as const,
    };
    const classA = calculateCircumferentialExposureCount({ ...shared, testClass: 'A' });
    const classB = calculateCircumferentialExposureCount({ ...shared, testClass: 'B' });
    expect(classA).not.toBeNull();
    expect(classB).not.toBeNull();
    expect(classB!.minimumExposureCount).toBeGreaterThanOrEqual(classA!.minimumExposureCount);
  });

  it('returns null instead of guessing on impossible or incomplete geometry', () => {
    const base = {
      setup: 'external-double-wall' as const,
      testClass: 'A' as const,
      outerDiameterUnit: 'mm' as const,
      wallThicknessUnit: 'mm' as const,
      sfdUnit: 'mm' as const,
    };
    expect(calculateCircumferentialExposureCount({ ...base, outerDiameter: '', wallThickness: 5, sfd: 800 })).toBeNull();
    expect(calculateCircumferentialExposureCount({ ...base, outerDiameter: 100, wallThickness: 60, sfd: 800 })).toBeNull();
    expect(calculateCircumferentialExposureCount({ ...base, outerDiameter: 100, wallThickness: 5, sfd: '' })).toBeNull();
    // Source would sit inside the pipe: SFD smaller than the pipe diameter.
    expect(calculateCircumferentialExposureCount({ ...base, outerDiameter: 200, wallThickness: 5, sfd: 150 })).toBeNull();
  });

  it('round-trips the optional circumferential plan and keeps prior fingerprints stable', () => {
    const baseline = fingerprintRtPtApprovedContent(createCompleteFilmDocument());
    const withPlan = createCompleteFilmDocument();
    withPlan.technique.circumferentialPlan = {
      pipeOuterDiameter: 200,
      pipeOuterDiameterUnit: 'mm',
      setup: 'external-double-wall',
    };
    expect(fingerprintRtPtApprovedContent(withPlan)).not.toBe(baseline);
    expect(fingerprintRtPtApprovedContent(createCompleteFilmDocument())).toBe(baseline);

    const decoded = decodeRtPtDocument(JSON.parse(JSON.stringify(withPlan)));
    expect(decoded.status).toBe('success');
    if (decoded.status !== 'success' || decoded.document.method !== 'RT-Film') return;
    expect(decoded.document.technique.circumferentialPlan?.pipeOuterDiameter).toBe(200);

    const invalid = JSON.parse(JSON.stringify(withPlan));
    invalid.technique.circumferentialPlan.pipeOuterDiameter = -1;
    expect(decodeRtPtDocument(invalid).status).toBe('invalid');
  });

  it('flags techniques planning fewer views than the computed circumferential minimum', () => {
    const document = createCompleteCrDocument();
    document.technique.iso17636TestClass = 'B';
    document.technique.circumferentialPlan = {
      pipeOuterDiameter: 200,
      pipeOuterDiameterUnit: 'mm',
      setup: 'external-double-wall',
    };
    // Nominal wall 10 mm, SFD 110 mm: the source would sit inside the pipe -> no result, no issue.
    // Raise the default SFD so a real minimum emerges beyond the 4 planned views.
    document.technique.exposureDefaults.sfd = 1000;
    document.technique.exposureDefaults.ofd = 10;
    document.technique.exposureDefaults.sod = 990;
    const summary = validateRtPtDocument(document);
    expect(summary.issues.some((issue) => issue.label === 'Circumferential Coverage')).toBe(true);

    const sections = JSON.stringify(getRtPtExportSections(document));
    expect(sections).toContain('Circumferential Coverage Plan');
    expect(sections).toContain('minimum');
  });
});
