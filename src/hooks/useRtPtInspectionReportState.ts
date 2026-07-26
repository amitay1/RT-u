import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  createRtPtInspectionReport,
  createRtPtInspectionReportId,
  listRtPtInspectionReports,
  loadRtPtInspectionReportById,
  saveRtPtInspectionReportDraft,
  setActiveRtPtInspectionReport,
  summarizeRtPtInspectionReport,
  type RtPtInspectionReportCollection,
  type RtPtInspectionReportStorageIssue,
  type RtPtInspectionReportSummary,
} from '@/lib/rtPtInspectionReport';
import {
  editRtPtInspectionReport,
  reconcileRtPtInspectionReportApproval,
  setRtPtInspectionReportStatus,
} from '@/lib/rtPtInspectionReportLifecycle';
import { validateRtPtInspectionReport } from '@/lib/rtPtInspectionReportValidation';
import type { InspectorProfile } from '@/types/inspectorProfile';
import type { RtPtDocumentV3 } from '@/types/rtPtDocument';
import type {
  RtPtInspectionReportStatus,
  RtPtInspectionReportV1,
} from '@/types/rtPtInspectionReport';

interface ReportWorkspaceSnapshot {
  report: RtPtInspectionReportV1;
  history: RtPtInspectionReportSummary[];
  issues: RtPtInspectionReportStorageIssue[];
}

const issueIdentity = (issue: RtPtInspectionReportStorageIssue): string => (
  `${issue.code}\u0000${issue.storageKey ?? ''}\u0000${issue.reportId ?? ''}`
);

const uniqueIssues = (issues: RtPtInspectionReportStorageIssue[]): RtPtInspectionReportStorageIssue[] => {
  const seen = new Set<string>();
  return issues.filter((issue) => {
    const identity = issueIdentity(issue);
    if (seen.has(identity)) return false;
    seen.add(identity);
    return true;
  });
};

const inspectCollection = (
  collection: RtPtInspectionReportCollection,
  technique: RtPtDocumentV3,
  activeReportId: string,
): Pick<ReportWorkspaceSnapshot, 'history' | 'issues'> => {
  const issues = [...collection.issues];
  const matchingReports = collection.reports.filter((report) => report.method === technique.method);
  const mismatchedReports = collection.reports.filter((report) => report.method !== technique.method);
  for (const mismatched of mismatchedReports) {
    issues.push({
      code: 'method-mismatch',
      message: 'A stored inspection report uses a different method than the current technique. The report was preserved and excluded from this workspace.',
      reportId: mismatched.reportId,
      recoverable: true,
    });
  }
  for (const candidate of matchingReports) {
    if ((candidate.status === 'approved' || candidate.status === 'superseded')
      && reconcileRtPtInspectionReportApproval(candidate).invalidated) {
      issues.push({
        code: 'approval-binding-invalid',
        message: `A stored ${candidate.status === 'approved' ? 'Approved' : 'Superseded'} inspection report failed its content-binding check. The controlled raw record was preserved and cannot be edited in place.`,
        reportId: candidate.reportId,
        recoverable: true,
      });
    }
  }
  return {
    history: matchingReports.map((candidate) => summarizeRtPtInspectionReport(
      candidate,
      candidate.reportId === activeReportId,
    )),
    issues: uniqueIssues(issues),
  };
};

const addPendingReportToHistory = (
  history: RtPtInspectionReportSummary[],
  report: RtPtInspectionReportV1,
): RtPtInspectionReportSummary[] => [
  summarizeRtPtInspectionReport(report, true),
  ...history
    .filter((entry) => entry.reportId !== report.reportId)
    .map((entry) => ({ ...entry, isActive: false })),
];

const loadOrCreate = (
  technique: RtPtDocumentV3,
  profile?: InspectorProfile | null,
): ReportWorkspaceSnapshot => {
  const collection = listRtPtInspectionReports(technique.documentId);
  const selected = collection.activeReport?.method === technique.method
    ? collection.activeReport
    : collection.reports.find((candidate) => candidate.method === technique.method) ?? null;

  if (selected) {
    const reconciled = reconcileRtPtInspectionReportApproval(selected);
    if (!reconciled.invalidated) {
      const inspected = inspectCollection(collection, technique, selected.reportId);
      return { report: reconciled.report, ...inspected };
    }

    const recoveryDraft = selected.status === 'superseded'
      ? createRtPtInspectionReport(technique, profile)
      : { ...reconciled.report, reportId: createRtPtInspectionReportId() };
    const inspected = inspectCollection(collection, technique, recoveryDraft.reportId);
    return {
      report: recoveryDraft,
      history: addPendingReportToHistory(inspected.history, recoveryDraft),
      issues: uniqueIssues([
        ...inspected.issues,
        {
          code: 'approval-binding-invalid',
          message: `The active ${selected.status === 'approved' ? 'Approved' : 'Superseded'} report failed its content-binding check. Its raw record was preserved and a new recovery Draft was opened.`,
          reportId: selected.reportId,
          recoverable: true,
        },
      ]),
    };
  }

  const fresh = createRtPtInspectionReport(technique, profile);
  const inspected = inspectCollection(collection, technique, fresh.reportId);
  return {
    report: fresh,
    history: addPendingReportToHistory(inspected.history, fresh),
    issues: inspected.issues,
  };
};

const persistenceMessage = (error: unknown, fallback: string): string => (
  error instanceof Error && error.message ? error.message : fallback
);

export function useRtPtInspectionReportState(
  technique: RtPtDocumentV3,
  profile?: InspectorProfile | null,
  enabled = true,
) {
  const initial = useMemo(() => loadOrCreate(technique, profile), []); // eslint-disable-line react-hooks/exhaustive-deps
  const [report, setReportState] = useState<RtPtInspectionReportV1>(initial.report);
  const [reportHistory, setReportHistory] = useState<RtPtInspectionReportSummary[]>(initial.history);
  const [persistenceIssues, setPersistenceIssues] = useState<RtPtInspectionReportStorageIssue[]>(initial.issues);
  const [saveError, setSaveError] = useState<string | null>(null);
  const previousEnabledRef = useRef(enabled);

  useEffect(() => {
    const wasEnabled = previousEnabledRef.current;
    previousEnabledRef.current = enabled;
    if (!enabled || wasEnabled) return;
    const next = loadOrCreate(technique, profile);
    setReportState(next.report);
    setReportHistory(next.history);
    setPersistenceIssues(next.issues);
    setSaveError(null);
  }, [enabled, profile, technique]);

  useEffect(() => {
    if (report.sourceTechnique.documentId === technique.documentId && report.method === technique.method) return;
    const next = loadOrCreate(technique, profile);
    setReportState(next.report);
    setReportHistory(next.history);
    setPersistenceIssues(next.issues);
    setSaveError(null);
  }, [profile, report.method, report.sourceTechnique.documentId, technique]);

  useEffect(() => {
    if (!profile || report.status !== 'draft' || report.approvals.length > 0) return;
    setReportState((current) => ({
      ...current,
      approvals: [{
        role: 'performed',
        name: profile.name,
        personnelId: profile.employeeId || profile.certificationNumber,
        certificationLevel: profile.certificationLevel,
        certificationNumber: profile.certificationNumber,
        certificationBasis: profile.certifyingOrganization,
        date: new Date().toISOString().slice(0, 10),
      }],
    }));
  }, [profile, report.approvals.length, report.status]);

  useEffect(() => {
    if (!enabled) return;
    try {
      saveRtPtInspectionReportDraft(report);
      const collection = listRtPtInspectionReports(technique.documentId);
      const inspected = inspectCollection(collection, technique, report.reportId);
      setReportHistory(inspected.history);
      setPersistenceIssues(inspected.issues);
      setSaveError(null);
    } catch (error) {
      setSaveError(persistenceMessage(error, 'The inspection report could not be saved locally.'));
    }
  }, [enabled, report, technique]);

  const validation = useMemo(
    () => validateRtPtInspectionReport(report, technique),
    [report, technique],
  );

  const updateReport = useCallback((
    update: (current: RtPtInspectionReportV1) => RtPtInspectionReportV1,
  ) => {
    setReportState((current) => {
      const updated = editRtPtInspectionReport(current, update);
      if (current.status === 'approved' && updated.status === 'draft') {
        return { ...updated, reportId: createRtPtInspectionReportId() };
      }
      return updated;
    });
  }, []);

  const setStatus = useCallback((nextStatus: RtPtInspectionReportStatus): boolean => {
    if (nextStatus === 'approved' && !validation.isApprovalReady) return false;
    setReportState((current) => setRtPtInspectionReportStatus(current, nextStatus, technique));
    return true;
  }, [technique, validation.isApprovalReady]);

  const refreshReportHistory = useCallback(() => {
    const collection = listRtPtInspectionReports(technique.documentId);
    const inspected = inspectCollection(collection, technique, report.reportId);
    setReportHistory(inspected.history);
    setPersistenceIssues(inspected.issues);
  }, [report.reportId, technique]);

  const saveReportNow = useCallback((): boolean => {
    try {
      saveRtPtInspectionReportDraft(report);
      const collection = listRtPtInspectionReports(technique.documentId);
      const inspected = inspectCollection(collection, technique, report.reportId);
      setReportHistory(inspected.history);
      setPersistenceIssues(inspected.issues);
      setSaveError(null);
      return true;
    } catch (error) {
      setSaveError(persistenceMessage(error, 'The inspection report could not be saved locally.'));
      return false;
    }
  }, [report, technique]);

  const createReportFromTechnique = useCallback((): boolean => {
    try {
      saveRtPtInspectionReportDraft(report);
      const fresh = createRtPtInspectionReport(technique, profile);
      saveRtPtInspectionReportDraft(fresh);
      const collection = listRtPtInspectionReports(technique.documentId);
      const inspected = inspectCollection(collection, technique, fresh.reportId);
      setReportState(fresh);
      setReportHistory(inspected.history);
      setPersistenceIssues(inspected.issues);
      setSaveError(null);
      return true;
    } catch (error) {
      setSaveError(persistenceMessage(error, 'A new inspection report could not be created safely.'));
      return false;
    }
  }, [profile, report, technique]);

  const switchReport = useCallback((reportId: string): boolean => {
    if (reportId === report.reportId) return true;
    try {
      saveRtPtInspectionReportDraft(report);
      const loaded = loadRtPtInspectionReportById(technique.documentId, reportId);
      if (!loaded.report) {
        setPersistenceIssues(loaded.collection.issues);
        setSaveError('The selected inspection report could not be loaded. Its stored entry was preserved.');
        return false;
      }
      if (loaded.report.method !== technique.method) {
        setPersistenceIssues(uniqueIssues([
          ...loaded.collection.issues,
          {
            code: 'method-mismatch',
            message: 'The selected report belongs to a different inspection method and was not opened.',
            reportId,
            recoverable: true,
          },
        ]));
        setSaveError('The selected report does not match the current technique method.');
        return false;
      }
      const reconciled = reconcileRtPtInspectionReportApproval(loaded.report);
      if (reconciled.invalidated) {
        setPersistenceIssues(uniqueIssues([
          ...loaded.collection.issues,
          {
            code: 'approval-binding-invalid',
            message: 'The selected finalized report failed its content-binding check. Its raw record was preserved and was not opened for editing.',
            reportId,
            recoverable: true,
          },
        ]));
        setSaveError('The selected finalized report failed its content-binding check. Create a new report to recover safely.');
        return false;
      }
      setActiveRtPtInspectionReport(technique.documentId, reportId);
      const refreshed = listRtPtInspectionReports(technique.documentId);
      const inspected = inspectCollection(refreshed, technique, reportId);
      setReportState(reconciled.report);
      setReportHistory(inspected.history);
      setPersistenceIssues(inspected.issues);
      setSaveError(null);
      return true;
    } catch (error) {
      setSaveError(persistenceMessage(error, 'The selected inspection report could not be opened.'));
      return false;
    }
  }, [report, technique]);

  const persistenceError = saveError
    ?? persistenceIssues[0]?.message
    ?? null;

  return {
    report,
    activeReportId: report.reportId,
    reportHistory,
    persistenceIssues,
    validation,
    updateReport,
    setStatus,
    switchReport,
    createReportFromTechnique,
    createNewReportFromTechnique: createReportFromTechnique,
    restartFromTechnique: createReportFromTechnique,
    refreshReportHistory,
    saveReportNow,
    saveError,
    persistenceError,
  };
}

export type RtPtInspectionReportController = ReturnType<typeof useRtPtInspectionReportState>;
