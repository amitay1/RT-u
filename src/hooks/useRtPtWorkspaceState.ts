import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePenetrantState } from '@/hooks/usePenetrantState';
import { useRtCrState } from '@/hooks/useRtCrState';
import { useRtDigitalState } from '@/hooks/useRtDigitalState';
import { useRtFilmState } from '@/hooks/useRtFilmState';
import {
  createRtPtDocument,
  createRtPtDocumentId,
  decodeRtPtDocument,
  extractPtTechnique,
  extractRtCrTechnique,
  extractRtDigitalTechnique,
  extractRtFilmTechnique,
  hydratePtSheet,
  hydrateRtCrSheet,
  hydrateRtDigitalSheet,
  hydrateRtFilmSheet,
} from '@/lib/rtPtDocumentCodec';
import {
  bindRtPtApprovedContent,
  reconcileRtPtApprovedContent,
} from '@/lib/rtPtApprovalLifecycle';
import { validateRtPtDocument } from '@/lib/rtPtValidation';
import {
  DEFAULT_RT_PT_ACTIVE_TABS,
  EMPTY_RT_PT_DOCUMENT_CONTROL,
  EMPTY_RT_PT_JOB,
  EMPTY_RT_PT_ORGANIZATION,
  EMPTY_RT_PT_REVISION_HISTORY,
  type RtPtActiveTabs,
  type RtPtApproval,
  type RtPtControlledReference,
  type RtPtDecodeResult,
  type RtPtDocumentControl,
  type RtPtDocumentStatus,
  type RtPtJob,
  type RtPtMethod,
  type RtPtMigrationMetadata,
  type RtPtOrganization,
  type RtPtRevisionHistoryEntry,
  type RtPtUnitSystem,
} from '@/types/rtPtDocument';

const freshDocumentControl = (): RtPtDocumentControl => ({ ...EMPTY_RT_PT_DOCUMENT_CONTROL });
const freshRevisionHistory = (): RtPtRevisionHistoryEntry[] => (
  EMPTY_RT_PT_REVISION_HISTORY.map((entry) => ({ ...entry }))
);
const freshOrganization = (): RtPtOrganization => ({ ...EMPTY_RT_PT_ORGANIZATION });
const freshJob = (): RtPtJob => ({ ...EMPTY_RT_PT_JOB });
const createRevisionAuditId = (): string => {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return `revision-${globalThis.crypto.randomUUID()}`;
  }
  return `revision-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
};

const cloneMigration = (migration?: RtPtMigrationMetadata): RtPtMigrationMetadata | undefined => (
  migration
    ? {
        sourceSchemaVersion: migration.sourceSchemaVersion,
        warnings: [...migration.warnings],
        quarantine: migration.quarantine.map((entry) => ({ ...entry })),
      }
    : undefined
);

export function useRtPtWorkspaceState(initialMethod: RtPtMethod = 'RT-Film') {
  const [method, setMethod] = useState<RtPtMethod>(initialMethod);
  const [activeTabs, setActiveTabs] = useState<RtPtActiveTabs>({ ...DEFAULT_RT_PT_ACTIVE_TABS });
  const [documentId, setDocumentId] = useState(createRtPtDocumentId);
  const [status, setStatusState] = useState<RtPtDocumentStatus>('draft');
  const [approvalFingerprint, setApprovalFingerprint] = useState<string>();
  const [documentControl, setDocumentControl] = useState<RtPtDocumentControl>(freshDocumentControl);
  const [revisionHistory, setRevisionHistory] = useState<RtPtRevisionHistoryEntry[]>(freshRevisionHistory);
  const [organization, setOrganization] = useState<RtPtOrganization>(freshOrganization);
  const [job, setJob] = useState<RtPtJob>(freshJob);
  const [unitSystem, setUnitSystem] = useState<RtPtUnitSystem>('SI');
  const [controlledReferences, setControlledReferences] = useState<RtPtControlledReference[]>([]);
  const [approvals, setApprovals] = useState<RtPtApproval[]>([]);
  const [migration, setMigration] = useState<RtPtMigrationMetadata | undefined>();

  const rtFilm = useRtFilmState();
  const rtDigital = useRtDigitalState();
  const rtCr = useRtCrState();
  const penetrant = usePenetrantState();
  const { sheet: rtFilmSheet, replaceSheet: replaceRtFilmSheet, resetSheet: resetRtFilmSheet } = rtFilm;
  const { sheet: rtDigitalSheet, replaceSheet: replaceRtDigitalSheet, resetSheet: resetRtDigitalSheet } = rtDigital;
  const { sheet: rtCrSheet, replaceSheet: replaceRtCrSheet, resetSheet: resetRtCrSheet } = rtCr;
  const { sheet: penetrantSheet, replaceSheet: replacePenetrantSheet, resetSheet: resetPenetrantSheet } = penetrant;

  const setActiveTab = useCallback((targetMethod: RtPtMethod, tab: string) => {
    setActiveTabs((current) => {
      if (targetMethod === 'RT-Film') return { ...current, rtFilm: tab };
      if (targetMethod === 'RT-Digital') return { ...current, rtDigital: tab };
      if (targetMethod === 'RT-CR') return { ...current, rtCr: tab };
      return { ...current, pt: tab };
    });
  }, []);

  const rawDocument = useMemo(() => createRtPtDocument({
    documentId,
    status,
    approvalFingerprint,
    documentControl,
    revisionHistory,
    organization,
    job,
    unitSystem,
    controlledReferences,
    approvals,
    method,
    technique: method === 'RT-Film'
      ? extractRtFilmTechnique(rtFilmSheet)
      : method === 'RT-Digital'
        ? extractRtDigitalTechnique(rtDigitalSheet)
        : method === 'RT-CR'
          ? extractRtCrTechnique(rtCrSheet)
          : extractPtTechnique(penetrantSheet),
    migration,
  }), [
    approvalFingerprint,
    approvals,
    controlledReferences,
    documentControl,
    documentId,
    job,
    method,
    migration,
    organization,
    penetrantSheet,
    revisionHistory,
    rtCrSheet,
    rtDigitalSheet,
    rtFilmSheet,
    status,
    unitSystem,
  ]);

  const approvalReconciliation = useMemo(
    () => reconcileRtPtApprovedContent(rawDocument),
    [rawDocument],
  );
  const document = approvalReconciliation.document;

  useEffect(() => {
    if (!approvalReconciliation.invalidated) return;
    setApprovalFingerprint(undefined);
    setApprovals([]);
    setStatusState('draft');
  }, [approvalReconciliation.invalidated]);

  const setStatus = useCallback((nextStatus: RtPtDocumentStatus) => {
    if (nextStatus === 'approved') {
      if (rawDocument.status === 'superseded' || approvalReconciliation.invalidated) {
        setApprovalFingerprint(undefined);
        setApprovals([]);
        setStatusState('draft');
        return;
      }
      if (!validateRtPtDocument(rawDocument).approvalReadiness.isReady) return;
      const approvedDocument = bindRtPtApprovedContent(rawDocument);
      setApprovalFingerprint(approvedDocument.approvalFingerprint);
      setStatusState(approvedDocument.status);
      return;
    }

    if (rawDocument.status === 'approved' && nextStatus === 'superseded') {
      setStatusState('superseded');
      return;
    }

    setApprovalFingerprint(undefined);
    if (
      (nextStatus === 'draft' && rawDocument.status !== 'draft')
      || (rawDocument.status === 'approved' && nextStatus === 'in-review')
      || rawDocument.status === 'superseded'
    ) {
      setApprovals([]);
    }
    setStatusState(nextStatus);
  }, [approvalReconciliation.invalidated, rawDocument]);

  const hydrateDocument = useCallback((value: unknown): RtPtDecodeResult => {
    const decoded = decodeRtPtDocument(value);
    if (decoded.status !== 'success') return decoded;

    const next = decoded.document;
    setApprovalFingerprint(next.approvalFingerprint);
    resetRtFilmSheet();
    resetRtDigitalSheet();
    resetRtCrSheet();
    resetPenetrantSheet();
    if (next.method === 'RT-Film') replaceRtFilmSheet(hydrateRtFilmSheet(next));
    else if (next.method === 'RT-Digital') replaceRtDigitalSheet(hydrateRtDigitalSheet(next));
    else if (next.method === 'RT-CR') replaceRtCrSheet(hydrateRtCrSheet(next));
    else replacePenetrantSheet(hydratePtSheet(next));

    setActiveTabs({ ...DEFAULT_RT_PT_ACTIVE_TABS });
    setDocumentId(next.documentId);
    setStatusState(next.status);
    setDocumentControl({ ...next.documentControl });
    setRevisionHistory(next.revisionHistory.map((entry) => ({ ...entry })));
    setOrganization({ ...next.organization });
    setJob({ ...next.job });
    setUnitSystem(next.unitSystem);
    setControlledReferences(next.controlledReferences.map((reference) => ({ ...reference })));
    setApprovals(next.approvals.map((approval) => ({ ...approval })));
    setMigration(cloneMigration(next.migration));
    setMethod(next.method);
    return decoded;
  }, [
    replacePenetrantSheet,
    replaceRtCrSheet,
    replaceRtDigitalSheet,
    replaceRtFilmSheet,
    resetPenetrantSheet,
    resetRtCrSheet,
    resetRtDigitalSheet,
    resetRtFilmSheet,
  ]);

  const resetWorkspace = useCallback((nextMethod: RtPtMethod = initialMethod) => {
    setApprovalFingerprint(undefined);
    resetRtFilmSheet();
    resetRtDigitalSheet();
    resetRtCrSheet();
    resetPenetrantSheet();
    setActiveTabs({ ...DEFAULT_RT_PT_ACTIVE_TABS });
    setDocumentId(createRtPtDocumentId());
    setStatusState('draft');
    setDocumentControl(freshDocumentControl());
    setRevisionHistory(freshRevisionHistory());
    setOrganization(freshOrganization());
    setJob(freshJob());
    setUnitSystem('SI');
    setControlledReferences([]);
    setApprovals([]);
    setMigration(undefined);
    setMethod(nextMethod);
  }, [initialMethod, resetPenetrantSheet, resetRtCrSheet, resetRtDigitalSheet, resetRtFilmSheet]);

  const acknowledgeMigration = useCallback((reviewer: { name: string; personnelId: string }): boolean => {
    const reviewerName = reviewer.name.trim();
    const personnelId = reviewer.personnelId.trim();
    if (!migration || !reviewerName || !personnelId) return false;

    const reviewDate = new Date().toISOString().slice(0, 10);
    setApprovalFingerprint(undefined);
    setRevisionHistory((current) => [
      ...current,
      {
        id: createRevisionAuditId(),
        revision: 'MIGRATION',
        date: reviewDate,
        description: `Schema V${migration.sourceSchemaVersion} migration review completed; quarantined legacy values were not adopted into controlled V3 fields.`,
        author: `${reviewerName} (${personnelId})`,
      },
    ]);
    setApprovals([]);
    setStatusState('draft');
    setMigration(undefined);
    return true;
  }, [migration]);

  return {
    method,
    activeTabs,
    setActiveTab,
    rtFilm,
    rtDigital,
    rtCr,
    penetrant,
    document,
    documentId,
    status: document.status,
    setStatus,
    documentControl,
    setDocumentControl,
    revisionHistory,
    setRevisionHistory,
    organization,
    setOrganization,
    job,
    setJob,
    unitSystem,
    setUnitSystem,
    controlledReferences,
    setControlledReferences,
    approvals: document.approvals,
    setApprovals,
    migration,
    acknowledgeMigration,
    hydrateDocument,
    resetWorkspace,
  };
}

export type RtPtWorkspaceController = ReturnType<typeof useRtPtWorkspaceState>;
