import { createRtPtSha256Fingerprint } from '@/lib/rtPtFingerprint';
import type { RtPtInspectionReportV1 } from '@/types/rtPtInspectionReport';

/**
 * Binds every controlled report value while deliberately excluding lifecycle
 * status and the binding field itself. Approved -> Superseded therefore keeps
 * the exact same immutable content fingerprint.
 */
export function fingerprintRtPtInspectionReportContent(
  report: RtPtInspectionReportV1,
): string {
  const { status: _status, approvalFingerprint: _approvalFingerprint, ...content } = report;
  return createRtPtSha256Fingerprint(JSON.stringify(content));
}

export function hasValidRtPtInspectionReportFingerprint(
  report: RtPtInspectionReportV1,
): boolean {
  try {
    return /^sha256:[0-9a-f]{64}$/.test(report.approvalFingerprint)
      && report.approvalFingerprint === fingerprintRtPtInspectionReportContent(report);
  } catch {
    return false;
  }
}
