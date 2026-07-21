import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { CollapsibleSidebar } from "@/components/CollapsibleSidebar";
import { DiagnosticsExportDialog } from "@/components/support/DiagnosticsExportDialog";
import { MenuBar } from "@/components/MenuBar";
import { ProfileSelectionDialog } from "@/components/inspector";
import { RtPtSidebar } from "@/components/RtPtSidebar";
import { RtPtWorkspace } from "@/components/RtPtWorkspace";
import { RtPtValidationDialog } from "@/components/rtpt/RtPtValidationDialog";
import { SelfDiagnosticPanel } from "@/components/diagnostics/SelfDiagnosticPanel";
import { StatusBar } from "@/components/StatusBar";
import { Toolbar } from "@/components/Toolbar";
import { OfflineUpdateDialog } from "@/components/updates/OfflineUpdateDialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { SavedCard } from "@/contexts/SavedCardsContext";
import { useInspectorProfile } from "@/contexts/InspectorProfileContext";
import { useRtPtLicense } from "@/contexts/RtPtLicenseContext";
import { useRtPtWorkspaceState } from "@/hooks/useRtPtWorkspaceState";
import { useSheetPersistence } from "@/hooks/useSheetPersistence";
import { decodeRtPtDocument, fingerprintRtPtContent } from "@/lib/rtPtDocumentCodec";
import { validateRtPtDocument, type RtPtValidationIssue } from "@/lib/rtPtValidation";
import type {
  PersistedTechniqueSheetData,
  TechniqueSheetRecord,
} from "@/services/techniqueSheetService";
import { RT_PT_METHOD_LABEL, type RtPtMethod } from "@/types/rtPtDocument";
import { exportRtPtTechniquePdf, getRtPtPdfReleaseState } from "@/utils/export/RtPtTechniquePDF";
import {
  clearTechniqueSheetDraft,
  clearUpdateRecoveryRecord,
  readTechniqueSheetDraft,
  readUpdateRecoveryRecord,
  writeTechniqueSheetDraft,
  writeUpdateRecoveryRecord,
} from "@/utils/updateRecovery";
import type { UpdateRecoveryRecord } from "@/utils/updateRecovery";

type UpdateInstallElectron = NonNullable<Window["electron"]> & {
  onPrepareForUpdateInstall?: (callback: (payload: {
    requestId: string;
    reason: UpdateRecoveryRecord["reason"];
    version?: string;
  }) => void) => void;
  removePrepareForUpdateInstall?: (callback: (payload: {
    requestId: string;
    reason: UpdateRecoveryRecord["reason"];
    version?: string;
  }) => void) => void;
  confirmUpdateInstallReady?: (requestId: string) => Promise<{ acknowledged: boolean }>;
};

const getUpdateInstallElectron = () => window.electron as UpdateInstallElectron | undefined;

const RT_PT_LOCAL_OWNER = {
  id: "00000000-0000-0000-0000-000000000000",
} as const;

const RT_PT_METHOD_SHORT_LABEL: Record<RtPtMethod, string> = {
  "RT-Film": "RT Film",
  "RT-Digital": "RT Digital / DDA",
  PT: "Penetrant Testing",
};

type PendingCardLoad =
  | { source: "local"; label: string; card: SavedCard }
  | { source: "database"; label: string; sheetId: string };

const normaliseValidationLabel = (value: string) => value
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, " ")
  .trim();

const findValidationField = (
  workspace: HTMLElement,
  issue: RtPtValidationIssue,
): HTMLElement | null => {
  const explicit = workspace.querySelector<HTMLElement>(`[data-validation-path="${CSS.escape(issue.path)}"]`);
  if (explicit) return explicit;

  const targetLabel = normaliseValidationLabel(issue.label);
  const targetTokens = new Set(targetLabel.split(" ").filter(Boolean));
  const candidates = Array.from(workspace.querySelectorAll<HTMLLabelElement>("label"));
  let best: { label: HTMLLabelElement; score: number } | null = null;

  for (const label of candidates) {
    const candidateLabel = normaliseValidationLabel(label.textContent ?? "");
    if (!candidateLabel) continue;
    const candidateTokens = candidateLabel.split(" ").filter(Boolean);
    const matchingTokens = candidateTokens.filter((token) => targetTokens.has(token)).length;
    const score = candidateLabel === targetLabel
      ? 2
      : Math.max(
        matchingTokens / Math.max(candidateTokens.length, 1),
        matchingTokens / Math.max(targetTokens.size, 1),
      );
    if ((!best || score > best.score) && (score >= 0.6 || matchingTokens >= 2)) {
      best = { label, score };
    }
  }

  if (!best) return null;
  const labelledControl = best.label.htmlFor ? document.getElementById(best.label.htmlFor) : null;
  return labelledControl
    || best.label.closest<HTMLElement>(".field-shell")?.querySelector<HTMLElement>("input, textarea, button, [role='combobox'], [tabindex]")
    || best.label;
};

const focusValidationIssue = (issue: RtPtValidationIssue) => {
  const workspace = document.querySelector<HTMLElement>("[data-rtpt-workspace-scroll]");
  if (!workspace) return;

  const field = findValidationField(workspace, issue);
  if (!field) {
    workspace.scrollTo({ top: 0, behavior: "smooth" });
    workspace.focus();
    return;
  }

  const highlightTarget = field.closest<HTMLElement>(".field-shell") ?? field;
  highlightTarget.classList.add("validation-target-highlight");
  field.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
  if (typeof field.focus === "function") field.focus({ preventScroll: true });
  window.setTimeout(() => highlightTarget.classList.remove("validation-target-highlight"), 2600);
};

const Index = () => {
  const { needsProfileSelection, isLoading: profileLoading } = useInspectorProfile();
  const { refresh: refreshLicense } = useRtPtLicense();
  const isElectron = typeof window !== "undefined" && Boolean(window.electron);

  const rtPtWorkspace = useRtPtWorkspaceState("RT-Film");
  const {
    document: rtPtDocument,
    hydrateDocument: hydrateRtPtDocument,
    resetWorkspace: resetRtPtWorkspace,
  } = rtPtWorkspace;
  const ndtMethod = rtPtWorkspace.method;

  const [diagnosticsDialogOpen, setDiagnosticsDialogOpen] = useState(false);
  const [diagnosticsPanelOpen, setDiagnosticsPanelOpen] = useState(false);
  const [offlineUpdateDialogOpen, setOfflineUpdateDialogOpen] = useState(false);
  const [validationDialogOpen, setValidationDialogOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [pendingMethodChange, setPendingMethodChange] = useState<RtPtMethod | null>(null);
  const [pendingCardLoad, setPendingCardLoad] = useState<PendingCardLoad | null>(null);
  const [newProjectDialogOpen, setNewProjectDialogOpen] = useState(false);
  const [unsavedCloseDialogOpen, setUnsavedCloseDialogOpen] = useState(false);
  const [updateRecoveryNotice, setUpdateRecoveryNotice] = useState<UpdateRecoveryRecord | null>(null);
  const [isClosingAfterSave, setIsClosingAfterSave] = useState(false);
  const [isReplacingCard, setIsReplacingCard] = useState(false);
  const [isSavingBeforeCardLoad, setIsSavingBeforeCardLoad] = useState(false);
  const [lastSavedSnapshot, setLastSavedSnapshot] = useState<string | null>(null);
  const [hasHydratedRtPtDraft, setHasHydratedRtPtDraft] = useState(false);
  const hasInitializedSavedSnapshotRef = useRef(false);
  const recoveredDraftRef = useRef(false);
  const suppressClosePromptRef = useRef(false);
  const pendingNewTechniqueBaselineRef = useRef(false);

  const activeRtPtGeneral = rtPtDocument.technique.general;
  const rtPtDocumentTitle = rtPtDocument.documentControl.title
    || activeRtPtGeneral.partName
    || activeRtPtGeneral.partNumber
    || "";
  const primaryControlledReference = rtPtDocument.controlledReferences[0];
  const rtPtReferenceLabel = primaryControlledReference
    ? `${primaryControlledReference.number || primaryControlledReference.title}${primaryControlledReference.revision ? ` Rev ${primaryControlledReference.revision}` : ""}`
    : `${RT_PT_METHOD_LABEL[ndtMethod]} — controlled reference not selected`;
  const rtPtValidation = useMemo(
    () => validateRtPtDocument(rtPtDocument),
    [rtPtDocument],
  );
  const activeRtPtTab = ndtMethod === "RT-Film"
    ? rtPtWorkspace.activeTabs.rtFilm
    : ndtMethod === "RT-Digital"
      ? rtPtWorkspace.activeTabs.rtDigital
      : rtPtWorkspace.activeTabs.pt;

  const buildRtPtPayload = useCallback(() => rtPtDocument, [rtPtDocument]);

  const applyPersistedRtPtData = useCallback((data: PersistedTechniqueSheetData) => {
    const decoded = hydrateRtPtDocument(data);
    if (decoded.status !== "success") {
      throw new Error(decoded.message);
    }
  }, [hydrateRtPtDocument]);

  const applyLoadedRtPtSheet = useCallback((record: TechniqueSheetRecord) => {
    applyPersistedRtPtData(record.data);
  }, [applyPersistedRtPtData]);

  const persistence = useSheetPersistence({
    user: RT_PT_LOCAL_OWNER,
    standard: rtPtReferenceLabel,
    documentTitle: rtPtDocumentTitle,
    documentDescription: `${rtPtDocumentTitle || "Untitled technique"} - ${rtPtReferenceLabel}`,
    completionPercent: rtPtValidation.completionPercent,
    buildTechniqueSheetPayload: buildRtPtPayload,
    buildCardData: buildRtPtPayload,
    applyLoadedSheet: applyLoadedRtPtSheet,
    applyLocalCard: applyPersistedRtPtData,
  });
  const {
    currentSheetName,
    handleSave: persistSave,
    handleSaveAs: persistSaveAs,
    handleOpenSavedCards: openSavedCards,
    handleLoadLocalCard: loadLocalCard,
    handleLoadSheet: loadSavedSheet,
    handleSaveDialogConfirm: confirmSaveDialog,
    saveCurrentCardSilently,
    setCurrentSheetId,
    setCurrentLocalCardId,
    setCurrentSheetName,
  } = persistence;

  const confirmActiveLicense = useCallback(async () => {
    const currentLicense = await refreshLicense();
    if (currentLicense.active) return true;
    toast.error("License verification is required before saving or exporting controlled work.");
    return false;
  }, [refreshLicense]);

  const handleExportPDF = useCallback(async () => {
    if (!await confirmActiveLicense()) return;
    const filename = exportRtPtTechniquePdf(rtPtDocument, rtPtValidation);
    const release = getRtPtPdfReleaseState(rtPtDocument, rtPtValidation);
    if (release.controlledRelease) toast.success(`Exported controlled document ${filename}`);
    else toast.warning(`Exported draft/uncontrolled document ${filename}.`);
  }, [confirmActiveLicense, rtPtDocument, rtPtValidation]);

  const currentCardSnapshot = useMemo(
    () => fingerprintRtPtContent(rtPtDocument),
    [rtPtDocument],
  );
  const isDirty = lastSavedSnapshot !== null && currentCardSnapshot !== lastSavedSnapshot;

  useEffect(() => {
    if (!pendingNewTechniqueBaselineRef.current) return;
    pendingNewTechniqueBaselineRef.current = false;
    setLastSavedSnapshot(currentCardSnapshot);
  }, [currentCardSnapshot]);

  const startNdtMethodTechnique = useCallback((method: RtPtMethod) => {
    setCurrentSheetId(null);
    setCurrentLocalCardId(null);
    setCurrentSheetName("");
    clearTechniqueSheetDraft();
    clearUpdateRecoveryRecord();
    recoveredDraftRef.current = false;
    pendingNewTechniqueBaselineRef.current = true;
    setLastSavedSnapshot(null);
    resetRtPtWorkspace(method);
  }, [
    resetRtPtWorkspace,
    setCurrentLocalCardId,
    setCurrentSheetId,
    setCurrentSheetName,
  ]);

  const handleNdtMethodChange = useCallback((method: RtPtMethod) => {
    if (method === ndtMethod) return;
    if (isDirty) {
      setPendingMethodChange(method);
      return;
    }
    startNdtMethodTechnique(method);
  }, [isDirty, ndtMethod, startNdtMethodTechnique]);

  const markCurrentAsSaved = useCallback((snapshot = currentCardSnapshot) => {
    setLastSavedSnapshot(snapshot);
  }, [currentCardSnapshot]);

  useEffect(() => {
    if (hasHydratedRtPtDraft) {
      writeTechniqueSheetDraft(rtPtDocument);
    }
  }, [hasHydratedRtPtDraft, rtPtDocument]);

  useEffect(() => {
    const draft = readTechniqueSheetDraft<unknown>();
    if (draft) {
      const decoded = hydrateRtPtDocument(draft);
      recoveredDraftRef.current = decoded.status === "success";
    }
    setHasHydratedRtPtDraft(true);
  }, [hydrateRtPtDocument]);

  useEffect(() => {
    if (!hasHydratedRtPtDraft || hasInitializedSavedSnapshotRef.current) {
      return;
    }

    hasInitializedSavedSnapshotRef.current = true;
    setLastSavedSnapshot(recoveredDraftRef.current ? "__recovered_unsaved_draft__" : currentCardSnapshot);
  }, [hasHydratedRtPtDraft, currentCardSnapshot]);

  useEffect(() => {
    if (!hasHydratedRtPtDraft) {
      return;
    }

    const recoveryRecord = readUpdateRecoveryRecord();
    if (recoveryRecord) {
      setUpdateRecoveryNotice(recoveryRecord);
    }
  }, [hasHydratedRtPtDraft]);

  useEffect(() => {
    const updateInstallElectron = getUpdateInstallElectron();
    if (!updateInstallElectron?.onPrepareForUpdateInstall) {
      return;
    }

    const handlePrepareForUpdateInstall = async (payload: {
      requestId: string;
      reason: UpdateRecoveryRecord["reason"];
      version?: string;
    }) => {
      const cardName = currentSheetName
        || activeRtPtGeneral.partName
        || activeRtPtGeneral.partNumber
        || "Unsaved card";

      writeTechniqueSheetDraft(rtPtDocument);
      writeUpdateRecoveryRecord({
        cardName,
        savedAt: new Date().toISOString(),
        reason: payload.reason,
        version: payload.version,
        activeTab: activeRtPtTab,
        reportMode: "Technique",
      });

      await updateInstallElectron.confirmUpdateInstallReady?.(payload.requestId);
    };

    updateInstallElectron.onPrepareForUpdateInstall(handlePrepareForUpdateInstall);
    return () => {
      updateInstallElectron.removePrepareForUpdateInstall?.(handlePrepareForUpdateInstall);
    };
  }, [
    activeRtPtGeneral.partName,
    activeRtPtGeneral.partNumber,
    activeRtPtTab,
    currentSheetName,
    rtPtDocument,
  ]);

  const confirmAppClose = useCallback(async () => {
    try {
      if (window.electron?.confirmAppClose) {
        await window.electron.confirmAppClose();
        return;
      }

      window.close();
    } catch {
      suppressClosePromptRef.current = false;
      toast.error("Unable to close the window right now.");
    }
  }, []);

  const continueClosing = useCallback(async () => {
    suppressClosePromptRef.current = true;
    setUnsavedCloseDialogOpen(false);
    await confirmAppClose();
  }, [confirmAppClose]);

  const handleSaveCard = useCallback(async () => {
    if (!await confirmActiveLicense()) return;
    const result = await persistSave();
    if (result?.saved) {
      markCurrentAsSaved();
    }
  }, [confirmActiveLicense, markCurrentAsSaved, persistSave]);

  const handleSaveDialogConfirm = useCallback(async () => {
    if (!await confirmActiveLicense()) return;
    const result = await confirmSaveDialog();
    if (result?.saved) {
      markCurrentAsSaved();
    }
  }, [confirmActiveLicense, confirmSaveDialog, markCurrentAsSaved]);

  const performLoadLocalSavedCard = useCallback((card: SavedCard) => {
    const loadedCard = loadLocalCard(card);
    if (loadedCard?.data) {
      const decoded = decodeRtPtDocument(loadedCard.data);
      if (decoded.status === "success") {
        setLastSavedSnapshot(fingerprintRtPtContent(decoded.document));
      }
    }
    return loadedCard;
  }, [loadLocalCard]);

  const performLoadSavedSheet = useCallback(async (sheetId: string) => {
    const loadedSheet = await loadSavedSheet(sheetId);
    if (loadedSheet?.data) {
      const decoded = decodeRtPtDocument(loadedSheet.data);
      if (decoded.status === "success") {
        setLastSavedSnapshot(fingerprintRtPtContent(decoded.document));
      }
    }
    return loadedSheet;
  }, [loadSavedSheet]);

  const requestLoadLocalSavedCard = useCallback((card: SavedCard) => {
    if (isDirty) {
      setPendingCardLoad({ source: "local", label: card.name, card });
      return;
    }
    performLoadLocalSavedCard(card);
  }, [isDirty, performLoadLocalSavedCard]);

  const requestLoadSavedSheet = useCallback((sheetId: string, label: string) => {
    if (isDirty) {
      persistence.setIsSavedCardsDialogOpen(false);
      setPendingCardLoad({ source: "database", label, sheetId });
      return;
    }
    void performLoadSavedSheet(sheetId);
  }, [isDirty, performLoadSavedSheet, persistence]);

  const executePendingCardLoad = useCallback(async () => {
    if (!pendingCardLoad || isReplacingCard) return false;

    setIsReplacingCard(true);
    try {
      const loaded = pendingCardLoad.source === "local"
        ? performLoadLocalSavedCard(pendingCardLoad.card)
        : await performLoadSavedSheet(pendingCardLoad.sheetId);

      if (loaded) {
        setPendingCardLoad(null);
        return true;
      }
      return false;
    } finally {
      setIsReplacingCard(false);
    }
  }, [isReplacingCard, pendingCardLoad, performLoadLocalSavedCard, performLoadSavedSheet]);

  const handleSaveAndLoadPendingCard = useCallback(async () => {
    if (isReplacingCard || isSavingBeforeCardLoad) return;
    setIsSavingBeforeCardLoad(true);
    try {
      if (!await confirmActiveLicense()) return;
      const saved = await saveCurrentCardSilently();
      if (!saved?.saved) {
        toast.error("Unable to save the current technique. The selected card was not loaded.");
        return;
      }

      markCurrentAsSaved();
      await executePendingCardLoad();
    } finally {
      setIsSavingBeforeCardLoad(false);
    }
  }, [
    confirmActiveLicense,
    executePendingCardLoad,
    isReplacingCard,
    isSavingBeforeCardLoad,
    markCurrentAsSaved,
    saveCurrentCardSilently,
  ]);

  const handleCloseRequest = useCallback(async () => {
    if (suppressClosePromptRef.current) {
      return;
    }

    if (!isDirty) {
      await continueClosing();
      return;
    }

    setUnsavedCloseDialogOpen(true);
  }, [continueClosing, isDirty]);

  const handleKeepRecoveredProgress = useCallback(() => {
    clearUpdateRecoveryRecord();
    setUpdateRecoveryNotice(null);
    toast.success("Recovered your in-progress card after the update.");
  }, []);

  const handleDiscardRecoveredProgress = useCallback(() => {
    clearUpdateRecoveryRecord();
    clearTechniqueSheetDraft();
    setUpdateRecoveryNotice(null);
    window.location.reload();
  }, []);

  const handleSaveAndClose = useCallback(async () => {
    setIsClosingAfterSave(true);

    try {
      const result = await saveCurrentCardSilently();
      if (!result?.saved) {
        toast.error("Unable to save the latest changes before closing.");
        return;
      }

      markCurrentAsSaved();
      await continueClosing();
    } finally {
      setIsClosingAfterSave(false);
    }
  }, [continueClosing, markCurrentAsSaved, saveCurrentCardSilently]);

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (suppressClosePromptRef.current || !isDirty) {
        return;
      }

      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty]);

  useEffect(() => {
    if (!window.electron?.onAppCloseRequested) {
      return;
    }

    const onAppCloseRequested = () => {
      void handleCloseRequest();
    };

    window.electron.onAppCloseRequested(onAppCloseRequested);
    return () => {
      window.electron?.removeAppCloseRequested?.(onAppCloseRequested);
    };
  }, [handleCloseRequest]);

  const startNewProject = useCallback(() => {
    setCurrentLocalCardId(null);
    setCurrentSheetName("");
    clearTechniqueSheetDraft();
    clearUpdateRecoveryRecord();
    window.location.reload();
  }, [setCurrentLocalCardId, setCurrentSheetName]);

  const handleNewProject = useCallback(() => {
    setNewProjectDialogOpen(true);
  }, []);

  useEffect(() => {
    const handleKeyboard = (event: KeyboardEvent) => {
      if (!event.ctrlKey && !event.metaKey) {
        return;
      }

      switch (event.key.toLowerCase()) {
        case "s":
          event.preventDefault();
          if (event.shiftKey) {
            persistSaveAs();
          } else {
            void handleSaveCard();
          }
          break;
        case "e":
          event.preventDefault();
          void handleExportPDF();
          break;
        case "n":
          event.preventDefault();
          handleNewProject();
          break;
      }
    };

    window.addEventListener("keydown", handleKeyboard);
    return () => window.removeEventListener("keydown", handleKeyboard);
  }, [handleExportPDF, handleNewProject, handleSaveCard, persistSaveAs]);

  const handleValidate = useCallback(() => {
    const errors = rtPtValidation.issues.filter((issue) => issue.severity === "error");
    const warnings = rtPtValidation.issues.filter((issue) => issue.severity === "warning");
    if (errors.length > 0) {
      setValidationDialogOpen(true);
      return;
    }
    if (warnings.length > 0) {
      setValidationDialogOpen(true);
      return;
    }
    if (!rtPtValidation.approvalReadiness.isReady) {
      setValidationDialogOpen(true);
      return;
    }
    setValidationDialogOpen(true);
  }, [rtPtValidation]);

  return (
    <div className="workbench-shell fixed inset-0 flex h-screen w-screen flex-col overflow-hidden bg-background">
      <ProfileSelectionDialog
        open={needsProfileSelection && !profileLoading}
        allowClose={false}
      />

      {!isElectron && (
        <div className="hidden md:block">
          <MenuBar
            onSave={handleSaveCard}
            onSaveAs={persistSaveAs}
            onOpenSavedCards={openSavedCards}
            onExport={handleExportPDF}
            onNew={handleNewProject}
            onExportDiagnostics={() => setDiagnosticsDialogOpen(true)}
            onRunDiagnostics={() => setDiagnosticsPanelOpen(true)}
          />
        </div>
      )}

      <Toolbar
        onNew={handleNewProject}
        onSave={handleSaveCard}
        onExport={handleExportPDF}
        onValidate={handleValidate}
        ndtMethod={ndtMethod}
        onLoadLocalCard={requestLoadLocalSavedCard}
        onOfflineUpdate={() => setOfflineUpdateDialogOpen(true)}
      />

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-2 pb-2 md:px-3 md:pb-3 lg:flex-row">
        <div className="mb-2 flex-none lg:hidden">
          <RtPtSidebar compact method={ndtMethod} onMethodChange={handleNdtMethodChange} />
        </div>

        <CollapsibleSidebar
          isOpen={sidebarOpen}
          onToggle={() => setSidebarOpen((open) => !open)}
          title="Method & Process Reference"
        >
          <RtPtSidebar method={ndtMethod} onMethodChange={handleNdtMethodChange} />
        </CollapsibleSidebar>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <RtPtWorkspace workspace={rtPtWorkspace} validation={rtPtValidation} />
        </div>
      </div>

      <StatusBar
        completionPercent={rtPtValidation.completionPercent}
        requiredFieldsComplete={rtPtValidation.completedFieldsCount}
        totalRequiredFields={rtPtValidation.totalRequiredFields}
        autoSaveStatus={persistence.autoSaveStatus}
        lastSaved={persistence.lastSaved}
      />

      <DiagnosticsExportDialog
        open={diagnosticsDialogOpen}
        onOpenChange={setDiagnosticsDialogOpen}
      />
      <SelfDiagnosticPanel
        open={diagnosticsPanelOpen}
        onOpenChange={setDiagnosticsPanelOpen}
      />
      <OfflineUpdateDialog
        open={offlineUpdateDialogOpen}
        onOpenChange={setOfflineUpdateDialogOpen}
      />
      <RtPtValidationDialog
        open={validationDialogOpen}
        onOpenChange={setValidationDialogOpen}
        validation={rtPtValidation}
        documentStatus={rtPtDocument.status}
        onSelectIssue={(issue) => {
          const workspaceTab = issue.tab === "source"
            ? ndtMethod === "RT-Film" ? "equipment" : "exposure"
            : issue.tab === "storage"
              ? "processing"
              : issue.tab;
          rtPtWorkspace.setActiveTab(ndtMethod, workspaceTab);
          setValidationDialogOpen(false);
          window.setTimeout(() => {
            focusValidationIssue(issue);
          }, 120);
        }}
      />

      <Dialog
        open={Boolean(pendingCardLoad)}
        onOpenChange={(open) => {
          if (!open && !isReplacingCard && !isSavingBeforeCardLoad) setPendingCardLoad(null);
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Save changes before loading another card?</DialogTitle>
            <DialogDescription>
              The current technique contains changes that have not been saved. Choose how to continue before loading the selected card.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="rounded-lg border border-warning/30 bg-warning/10 p-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Current technique</div>
              <div className="mt-1 truncate text-sm font-semibold">
                {persistence.currentSheetName || rtPtDocumentTitle || "Unsaved technique"}
              </div>
              <div className="mt-1 text-xs font-medium text-warning">Unsaved changes</div>
            </div>
            <div className="rounded-lg border border-border bg-muted/30 p-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Selected card</div>
              <div className="mt-1 truncate text-sm font-semibold">{pendingCardLoad?.label}</div>
              <div className="mt-1 text-xs text-muted-foreground">Will replace the current workspace</div>
            </div>
          </div>
          <DialogFooter className="grid gap-2 sm:grid-cols-[auto_1fr_1fr] sm:items-center">
            <Button
              variant="outline"
              onClick={() => setPendingCardLoad(null)}
              disabled={isReplacingCard || isSavingBeforeCardLoad}
              className="w-full sm:w-auto"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => void executePendingCardLoad()}
              disabled={isReplacingCard || isSavingBeforeCardLoad}
              className="w-full whitespace-normal"
            >
              Load Without Saving
            </Button>
            <Button
              onClick={() => void handleSaveAndLoadPendingCard()}
              disabled={isReplacingCard || isSavingBeforeCardLoad}
              className="w-full whitespace-normal"
            >
              {(isReplacingCard || isSavingBeforeCardLoad) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save and Load
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(pendingMethodChange)}
        onOpenChange={(open) => {
          if (!open) setPendingMethodChange(null);
        }}
      >
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Start a new {pendingMethodChange ? RT_PT_METHOD_LABEL[pendingMethodChange] : ''} technique?</DialogTitle>
            <DialogDescription>
              Changing the inspection method creates a separate controlled document. Unsaved changes in the current technique will be discarded.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
            <div className="rounded-lg border border-border bg-muted/30 p-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Current document</div>
              <div className="mt-1 text-sm font-semibold">{RT_PT_METHOD_SHORT_LABEL[ndtMethod]}</div>
              <div className="mt-1 text-xs text-warning">Unsaved changes</div>
            </div>
            <span className="hidden text-muted-foreground sm:block" aria-hidden="true">→</span>
            <div className="rounded-lg border border-primary/30 bg-primary/10 p-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">New document</div>
              <div className="mt-1 text-sm font-semibold">{pendingMethodChange ? RT_PT_METHOD_SHORT_LABEL[pendingMethodChange] : ''}</div>
              <div className="mt-1 text-xs text-muted-foreground">Fresh technique workspace</div>
            </div>
          </div>
          <DialogFooter className="grid gap-2 sm:grid-cols-2 sm:space-x-0">
            <Button className="h-auto min-h-10 w-full whitespace-normal leading-snug" variant="outline" onClick={() => setPendingMethodChange(null)}>Keep Current Technique</Button>
            <Button
              className="h-auto min-h-10 w-full whitespace-normal leading-snug"
              variant="destructive"
              onClick={() => {
                if (!pendingMethodChange) return;
                const nextMethod = pendingMethodChange;
                setPendingMethodChange(null);
                startNdtMethodTechnique(nextMethod);
              }}
            >
              Discard changes &amp; start {pendingMethodChange ? RT_PT_METHOD_SHORT_LABEL[pendingMethodChange] : ''}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={newProjectDialogOpen} onOpenChange={setNewProjectDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Start a new project?</DialogTitle>
            <DialogDescription>
              This clears the current workspace and starts a fresh RT/PT project. Save the current card first if you need to keep it.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-lg border border-warning/30 bg-warning/10 px-3 py-3 text-sm text-foreground">
            {isDirty ? 'The current technique contains unsaved changes.' : 'The current technique will be closed.'}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewProjectDialogOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={startNewProject}>Start New Project</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={persistence.isSaveDialogOpen} onOpenChange={persistence.setIsSaveDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Save Card</DialogTitle>
            <DialogDescription>Give your card a clear name so you can find it easily.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="card-name">Card Name</Label>
            <Input
              id="card-name"
              value={persistence.sheetNameInput}
              onChange={(event) => persistence.setSheetNameInput(event.target.value)}
              placeholder={`e.g., ${RT_PT_METHOD_LABEL[ndtMethod]} - Part 123`}
              autoFocus
            />
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => persistence.setIsSaveDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSaveDialogConfirm}
              disabled={!persistence.sheetNameInput.trim() || persistence.isSavingSheet}
            >
              {persistence.isSavingSheet && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Card
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(updateRecoveryNotice)}
        onOpenChange={(open) => {
          if (!open) {
            handleKeepRecoveredProgress();
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Progress Restored After Update</DialogTitle>
            <DialogDescription>
              RT-PT Inspector restored the in-progress card that was open before the app restarted to install an update.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 rounded-lg border border-success/30 bg-success/10 px-3 py-3 text-sm">
            <div>
              <span className="font-medium">Card:</span>{" "}
              {updateRecoveryNotice?.cardName || "Unsaved card"}
            </div>
            <div>
              <span className="font-medium">Recovered:</span>{" "}
              {updateRecoveryNotice?.savedAt
                ? new Date(updateRecoveryNotice.savedAt).toLocaleString()
                : "Just now"}
            </div>
            {updateRecoveryNotice?.version && (
              <div>
                <span className="font-medium">Version:</span> {updateRecoveryNotice.version}
              </div>
            )}
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={handleDiscardRecoveredProgress}>
              Discard Restored Progress
            </Button>
            <Button onClick={handleKeepRecoveredProgress}>Continue</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={unsavedCloseDialogOpen} onOpenChange={setUnsavedCloseDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Save your latest changes before closing?</DialogTitle>
            <DialogDescription>
              You made updates to this card that have not been saved yet. We can save them into the current card before RT-PT Inspector closes.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-sm">
            Current card: {persistence.currentSheetName || rtPtDocumentTitle || "Unsaved card"}
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setUnsavedCloseDialogOpen(false)}
              disabled={isClosingAfterSave}
            >
              Cancel
            </Button>
            <Button
              variant="secondary"
              onClick={() => void continueClosing()}
              disabled={isClosingAfterSave}
            >
              Close Without Saving
            </Button>
            <Button onClick={() => void handleSaveAndClose()} disabled={isClosingAfterSave}>
              {isClosingAfterSave && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save and Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={persistence.isSavedCardsDialogOpen} onOpenChange={persistence.setIsSavedCardsDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Saved Cards</DialogTitle>
            <DialogDescription>Select a card to continue or manage previously saved work.</DialogDescription>
          </DialogHeader>
          <div className="max-h-[420px] space-y-3 overflow-y-auto pr-1">
            {persistence.isLoadingSheets ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading saved cards...
              </div>
            ) : persistence.savedSheets.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No cards saved yet. Use Save after naming your project to store your progress.
              </p>
            ) : (
              persistence.savedSheets.map((sheet) => (
                <div
                  key={sheet.id}
                  className="flex flex-col gap-3 rounded-lg border border-border/80 bg-muted/25 p-3 md:flex-row md:items-center md:justify-between"
                >
                  <div>
                    <p className="text-sm font-semibold">{sheet.sheetName}</p>
                    <p className="text-xs text-muted-foreground">
                      {(sheet.standard && `Process reference: ${sheet.standard}`) || "Process reference not set"}
                      {" · "}
                      Updated {new Date(sheet.updatedAt).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {sheet.id === persistence.currentSheetId && (
                      <span className="text-xs font-medium text-primary">Current</span>
                    )}
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => requestLoadSavedSheet(sheet.id, sheet.sheetName)}
                      disabled={persistence.loadingSheetId === sheet.id}
                    >
                      {persistence.loadingSheetId === sheet.id && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Load
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => void persistence.handleDeleteSheet(sheet.id)}
                      disabled={persistence.deletingSheetId === sheet.id}
                    >
                      {persistence.deletingSheetId === sheet.id && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Delete
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => persistence.setIsSavedCardsDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Index;
