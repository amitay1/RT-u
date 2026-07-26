import { describe, expect, it } from 'vitest';
import { createCompleteFilmDocument } from '@/lib/__tests__/rtPtV3Fixtures';
import { fingerprintRtPtApprovedContent } from '@/lib/rtPtDocumentCodec';
import { createRtPtInspectionReport } from '@/lib/rtPtInspectionReport';
import {
  canTransitionRtPtInspectionReportStatus,
  editRtPtInspectionReport,
  fingerprintRtPtInspectionReportContent,
  reconcileRtPtInspectionReportApproval,
  setRtPtInspectionReportStatus,
} from '@/lib/rtPtInspectionReportLifecycle';
import { validateRtPtInspectionReport } from '@/lib/rtPtInspectionReportValidation';
import type { RtPtDocumentV3 } from '@/types/rtPtDocument';
import type {
  RtPtInspectionReportStatus,
  RtPtInspectionReportV1,
} from '@/types/rtPtInspectionReport';

const completeFilmReport = (): {
  technique: RtPtDocumentV3;
  report: Extract<RtPtInspectionReportV1, { method: 'RT-Film' }>;
} => {
  const technique = createCompleteFilmDocument('approved');
  const created = createRtPtInspectionReport(technique);
  if (created.method !== 'RT-Film') throw new Error('Expected a Film report fixture.');

  const report: Extract<RtPtInspectionReportV1, { method: 'RT-Film' }> = {
    ...created,
    reportControl: {
      ...created.reportControl,
      number: 'IR-LIFECYCLE-100',
      revision: 'A',
      reportDate: '2026-07-22',
      inspectionStart: '2026-07-21',
      inspectionEnd: '2026-07-22',
    },
    part: {
      ...created.part,
      serialOrLotNumber: 'SN-LIFECYCLE-100',
      quantity: 1,
    },
    equipment: {
      ...created.equipment,
      equipmentUsed: 'Controlled X-ray set EQ-100',
      calibrationReferences: 'CAL-100 Rev A, due 2027-07-01',
    },
    coverageStatement: 'All planned inspection areas were examined.',
    overallDisposition: 'accepted',
    dispositionReference: 'PRODUCT-SPEC-1 Rev B, clause 7.4',
    approvals: [
      {
        role: 'performed',
        name: 'Inspector One',
        personnelId: 'EMP-1',
        certificationLevel: 'Level II',
        certificationNumber: 'CERT-1',
        certificationBasis: 'Written practice Rev C',
        date: '2026-07-22',
      },
      {
        role: 'reviewed',
        name: 'Reviewer Two',
        personnelId: 'EMP-2',
        certificationLevel: 'Level III',
        certificationNumber: 'CERT-2',
        certificationBasis: 'Written practice Rev C',
        date: '2026-07-22',
      },
    ],
    results: created.results.map((result, index) => ({
      ...result,
      filmId: `FILM-${index + 1}`,
      exposureDate: '2026-07-21',
      actualSfd: result.planned.sfd,
      actualSfdUnit: result.planned.sfdUnit,
      actualSod: result.planned.sod,
      actualSodUnit: result.planned.sodUnit,
      actualOfd: result.planned.ofd,
      actualOfdUnit: result.planned.ofdUnit,
      actualTubeVoltage: result.planned.tubeVoltage,
      actualTubeVoltageUnit: result.planned.tubeVoltageUnit,
      actualTubeCurrent: result.planned.tubeCurrent,
      actualTubeCurrentUnit: result.planned.tubeCurrentUnit,
      actualExposureTime: result.planned.exposureTime,
      actualExposureTimeUnit: result.planned.exposureTimeUnit,
      densityMinimum: result.planned.densityMinimum,
      densityMaximum: result.planned.densityMaximum,
      iqiObserved: 'Required hole visible',
      iqiRequirementMet: true,
      coverageConfirmed: true,
      result: 'accepted',
    })),
  };

  expect(validateRtPtInspectionReport(report, technique).isApprovalReady).toBe(true);
  return { technique, report };
};

const finalizedReports = () => {
  const { technique, report: draft } = completeFilmReport();
  const inReview = setRtPtInspectionReportStatus(draft, 'in-review', technique);
  const approved = setRtPtInspectionReportStatus(inReview, 'approved', technique);
  const superseded = setRtPtInspectionReportStatus(approved, 'superseded', technique);
  return { technique, draft, inReview, approved, superseded };
};

describe('RT/PT inspection report lifecycle integrity', () => {
  const statuses: RtPtInspectionReportStatus[] = [
    'draft',
    'in-review',
    'approved',
    'superseded',
  ];
  const allowed = new Set([
    'draft:in-review',
    'in-review:draft',
    'in-review:approved',
    'approved:superseded',
  ]);

  it('exposes a closed transition graph with idempotent same-status requests', () => {
    for (const current of statuses) {
      for (const next of statuses) {
        expect(
          canTransitionRtPtInspectionReportStatus(current, next),
          `${current} -> ${next}`,
        ).toBe(current === next || allowed.has(`${current}:${next}`));
      }
    }
  });

  it('enforces every allowed and forbidden status transition', () => {
    const { technique, draft, inReview, approved, superseded } = finalizedReports();
    const byStatus: Record<RtPtInspectionReportStatus, RtPtInspectionReportV1> = {
      draft,
      'in-review': inReview,
      approved,
      superseded,
    };

    for (const current of statuses) {
      for (const next of statuses) {
        const source = byStatus[current];
        const transitioned = setRtPtInspectionReportStatus(source, next, technique);
        const expectedStatus = current === next || allowed.has(`${current}:${next}`)
          ? next
          : current;
        expect(transitioned.status, `${current} -> ${next}`).toBe(expectedStatus);
        if (current !== next && !allowed.has(`${current}:${next}`)) {
          expect(transitioned, `${current} -> ${next}`).toBe(source);
        }
      }
    }
  });

  it('requires a fresh report-and-technique validation before approval', () => {
    const { technique, report } = completeFilmReport();
    const inReview = setRtPtInspectionReportStatus(report, 'in-review', technique);
    const staleReadySummary = validateRtPtInspectionReport(inReview, technique);
    expect(staleReadySummary.isApprovalReady).toBe(true);

    const incomplete = { ...inReview, coverageStatement: '' };
    expect(validateRtPtInspectionReport(incomplete, technique).isApprovalReady).toBe(false);

    const detachedSummaryAttempt = setRtPtInspectionReportStatus(
      inReview,
      'approved',
      staleReadySummary,
    );
    expect(detachedSummaryAttempt.status).toBe('in-review');

    const staleSummaryAttempt = setRtPtInspectionReportStatus(
      incomplete,
      'approved',
      staleReadySummary,
      technique,
    );
    expect(staleSummaryAttempt.status).toBe('in-review');
    expect(staleSummaryAttempt.approvalFingerprint).toBe('');
  });

  it('rejects approval when the supplied technique changed after validation', () => {
    const { technique, report } = completeFilmReport();
    const inReview = setRtPtInspectionReportStatus(report, 'in-review', technique);
    const staleReadySummary = validateRtPtInspectionReport(inReview, technique);
    const changedTechnique = structuredClone(technique);
    changedTechnique.technique.techniqueNotes = 'Changed after the readiness summary was produced.';
    const retargetedReport = {
      ...inReview,
      sourceTechnique: {
        ...inReview.sourceTechnique,
        approvedContentFingerprint: fingerprintRtPtApprovedContent(changedTechnique),
      },
    };

    const attempted = setRtPtInspectionReportStatus(
      retargetedReport,
      'approved',
      staleReadySummary,
      changedTechnique,
    );

    expect(attempted.status).toBe('in-review');
    expect(attempted.approvalFingerprint).toBe('');
  });

  it('binds Approved content and preserves the exact binding when superseded', () => {
    const { approved, superseded } = finalizedReports();

    expect(approved.status).toBe('approved');
    expect(approved.approvalFingerprint).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(approved.approvalFingerprint).toBe(fingerprintRtPtInspectionReportContent(approved));
    expect(reconcileRtPtInspectionReportApproval(approved)).toEqual({
      report: approved,
      invalidated: false,
    });

    expect(superseded.status).toBe('superseded');
    expect(superseded.approvalFingerprint).toBe(approved.approvalFingerprint);
    expect(superseded.approvals).toEqual(approved.approvals);
    expect(reconcileRtPtInspectionReportApproval(superseded)).toEqual({
      report: superseded,
      invalidated: false,
    });
  });

  it.each([
    ['missing', ''],
    ['malformed', 'not-a-sha256-binding'],
    ['mismatched', `sha256:${'0'.repeat(64)}`],
  ])('demotes Approved content with a %s binding and clears stale approvals', (_label, binding) => {
    const { approved } = finalizedReports();
    const invalid = { ...approved, approvalFingerprint: binding };

    const reconciled = reconcileRtPtInspectionReportApproval(invalid);

    expect(reconciled).toMatchObject({
      invalidated: true,
      report: { status: 'draft', approvalFingerprint: '', approvals: [] },
    });
  });

  it('demotes semantically valid Approved content tampering', () => {
    const { technique, approved } = finalizedReports();
    const tampered = { ...approved, remarks: 'Changed after controlled approval.' };

    const reconciled = reconcileRtPtInspectionReportApproval(tampered);

    expect(reconciled).toMatchObject({
      invalidated: true,
      report: { status: 'draft', approvalFingerprint: '', approvals: [] },
    });
    expect(setRtPtInspectionReportStatus(tampered, 'superseded', technique)).toMatchObject({
      status: 'draft',
      approvalFingerprint: '',
      approvals: [],
    });
  });

  it.each([
    ['content', (report: RtPtInspectionReportV1) => ({ ...report, remarks: 'Tampered history.' })],
    ['missing binding', (report: RtPtInspectionReportV1) => ({ ...report, approvalFingerprint: '' })],
    ['malformed binding', (report: RtPtInspectionReportV1) => ({ ...report, approvalFingerprint: 'invalid' })],
  ])('flags superseded %s without making historical evidence editable', (_label, tamper) => {
    const { technique, superseded } = finalizedReports();
    const invalid = tamper(superseded);
    const before = structuredClone(invalid);

    const reconciled = reconcileRtPtInspectionReportApproval(invalid);

    expect(reconciled.invalidated).toBe(true);
    expect(reconciled.report).toBe(invalid);
    expect(reconciled.report).toEqual(before);
    expect(reconciled.report.status).toBe('superseded');
    expect(editRtPtInspectionReport(invalid, (current) => ({
      ...current,
      remarks: 'Attempted edit',
    }))).toBe(invalid);
    expect(setRtPtInspectionReportStatus(invalid, 'draft', technique)).toBe(invalid);
  });

  it('prevents edit callbacks from bypassing lifecycle control', () => {
    const { draft, inReview, approved, superseded } = finalizedReports();

    const forgedDraft = editRtPtInspectionReport(draft, (current) => ({
      ...current,
      status: 'approved',
      approvalFingerprint: `sha256:${'f'.repeat(64)}`,
    }));
    expect(forgedDraft).toMatchObject({ status: 'draft', approvalFingerprint: '' });

    const editedReview = editRtPtInspectionReport(inReview, (current) => ({
      ...current,
      remarks: 'Changed during review',
    }));
    expect(editedReview).toMatchObject({ status: 'draft', approvalFingerprint: '', approvals: [] });

    const editedApproved = editRtPtInspectionReport(approved, (current) => ({
      ...current,
      remarks: 'Changed after approval',
    }));
    expect(editedApproved).toMatchObject({ status: 'draft', approvalFingerprint: '', approvals: [] });

    const approvedBeforeMutatingCallback = structuredClone(approved);
    const safelyForked = editRtPtInspectionReport(approved, (current) => {
      current.remarks = 'Mutating callback content';
      return current;
    });
    expect(approved).toEqual(approvedBeforeMutatingCallback);
    expect(safelyForked).toMatchObject({
      status: 'draft',
      remarks: 'Mutating callback content',
      approvalFingerprint: '',
      approvals: [],
    });

    expect(editRtPtInspectionReport(superseded, (current) => ({
      ...current,
      status: 'draft',
    }))).toBe(superseded);
  });
});
