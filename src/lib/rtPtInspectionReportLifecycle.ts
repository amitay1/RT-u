import { hasValidRtPtApprovalFingerprint } from '@/lib/rtPtDocumentCodec';
import {
  validateRtPtInspectionReport,
  type RtPtInspectionReportValidation,
} from '@/lib/rtPtInspectionReportValidation';
import {
  fingerprintRtPtInspectionReportContent,
  hasValidRtPtInspectionReportFingerprint,
} from '@/lib/rtPtInspectionReportFingerprint';
import {
  RT_PT_DOCUMENT_KIND,
  RT_PT_DOCUMENT_TYPE,
  RT_PT_DOCUMENT_VERSION,
  type RtPtDocumentV3,
} from '@/types/rtPtDocument';
import type { RtPtInspectionReportStatus, RtPtInspectionReportV1 } from '@/types/rtPtInspectionReport';

const SAFE_REPORT_STATUS_TRANSITIONS: Readonly<
  Record<RtPtInspectionReportStatus, readonly RtPtInspectionReportStatus[]>
> = {
  draft: ['in-review'],
  'in-review': ['draft', 'approved'],
  approved: ['superseded'],
  superseded: [],
};

export function canTransitionRtPtInspectionReportStatus(
  currentStatus: RtPtInspectionReportStatus,
  nextStatus: RtPtInspectionReportStatus,
): boolean {
  return currentStatus === nextStatus
    || SAFE_REPORT_STATUS_TRANSITIONS[currentStatus].includes(nextStatus);
}

export { fingerprintRtPtInspectionReportContent } from '@/lib/rtPtInspectionReportFingerprint';

export interface RtPtInspectionReportReconciliation {
  report: RtPtInspectionReportV1;
  invalidated: boolean;
}

export function reconcileRtPtInspectionReportApproval(
  report: RtPtInspectionReportV1,
): RtPtInspectionReportReconciliation {
  if (report.status !== 'approved' && report.status !== 'superseded') {
    return { report, invalidated: false };
  }

  if (hasValidRtPtInspectionReportFingerprint(report)) return { report, invalidated: false };

  // Superseded reports are immutable historical evidence. Flag a broken
  // binding without converting the record back into an editable state or
  // destroying the values needed to investigate the integrity failure.
  if (report.status === 'superseded') return { report, invalidated: true };

  return {
    invalidated: true,
    report: { ...report, status: 'draft', approvalFingerprint: '', approvals: [] },
  };
}

export function editRtPtInspectionReport(
  report: RtPtInspectionReportV1,
  update: (current: RtPtInspectionReportV1) => RtPtInspectionReportV1,
): RtPtInspectionReportV1 {
  if (report.status === 'superseded') return report;
  const updated = update(structuredClone(report));
  if (report.status === 'approved' || report.status === 'in-review') {
    return { ...updated, status: 'draft', approvalFingerprint: '', approvals: [] };
  }
  // Status changes are only permitted through the explicit transition graph.
  return { ...updated, status: report.status, approvalFingerprint: '' };
}

const isTechniqueDocument = (
  value: RtPtDocumentV3 | RtPtInspectionReportValidation | undefined,
): value is RtPtDocumentV3 => {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<RtPtDocumentV3>;
  return candidate.documentKind === RT_PT_DOCUMENT_KIND
    && candidate.schemaVersion === RT_PT_DOCUMENT_VERSION
    && candidate.documentType === RT_PT_DOCUMENT_TYPE;
};

/**
 * Applies the closed report-status graph. Approval requires the live linked
 * technique as the third argument. A legacy validation summary may still be
 * passed for source compatibility, but it never authorizes approval unless a
 * live technique is also supplied as the fourth argument and freshly checked.
 */
export function setRtPtInspectionReportStatus(
  report: RtPtInspectionReportV1,
  nextStatus: RtPtInspectionReportStatus,
  approvalContext?: RtPtDocumentV3 | RtPtInspectionReportValidation,
  techniqueDocument?: RtPtDocumentV3,
): RtPtInspectionReportV1 {
  const reconciled = reconcileRtPtInspectionReportApproval(report);
  if (reconciled.invalidated) return reconciled.report;
  const current = reconciled.report;

  if (!canTransitionRtPtInspectionReportStatus(current.status, nextStatus)) return current;
  if (current.status === nextStatus) return current;

  if (nextStatus === 'approved') {
    const technique = isTechniqueDocument(approvalContext) ? approvalContext : techniqueDocument;
    // A detached validation summary may be stale or may describe a different
    // report. Only a fresh validation against the linked technique can
    // authorize the controlled transition.
    if (
      !technique
      || technique.status !== 'approved'
      || !hasValidRtPtApprovalFingerprint(technique)
      || !validateRtPtInspectionReport(current, technique).isApprovalReady
    ) return current;
    const pending = { ...current, status: 'approved' as const, approvalFingerprint: '' };
    return { ...pending, approvalFingerprint: fingerprintRtPtInspectionReportContent(pending) };
  }

  if (current.status === 'approved' && nextStatus === 'superseded') {
    return { ...current, status: 'superseded' };
  }

  return { ...current, status: nextStatus, approvalFingerprint: '' };
}
