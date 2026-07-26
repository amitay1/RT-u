import {
  fingerprintRtPtApprovedContent,
  hasValidRtPtApprovalFingerprint,
} from '@/lib/rtPtDocumentCodec';
import type { RtPtDocumentV3 } from '@/types/rtPtDocument';

export interface RtPtApprovalReconciliation {
  document: RtPtDocumentV3;
  invalidated: boolean;
}

export type RtPtBoundApprovedDocument = RtPtDocumentV3 & {
  status: 'approved';
  approvalFingerprint: string;
};

/** Binds a new Approved state to the current canonical controlled content. */
export function bindRtPtApprovedContent(document: RtPtDocumentV3): RtPtBoundApprovedDocument {
  return {
    ...document,
    status: 'approved',
    approvalFingerprint: fingerprintRtPtApprovedContent(document),
  };
}

/**
 * Fails closed before persistence or export can observe stale approval state.
 * The input document is never mutated.
 */
export function reconcileRtPtApprovedContent(
  document: RtPtDocumentV3,
  /** @deprecated Transient bindings are ignored; only the persisted field is authoritative. */
  _legacyTransientFingerprint?: string,
): RtPtApprovalReconciliation {
  if (document.status !== 'approved') {
    return { document, invalidated: false };
  }

  if (hasValidRtPtApprovalFingerprint(document)) {
    return { document, invalidated: false };
  }

  const { approvalFingerprint: _staleFingerprint, ...unbound } = document;

  return {
    document: {
      ...unbound,
      status: 'draft',
      approvals: [],
    } as RtPtDocumentV3,
    invalidated: true,
  };
}
