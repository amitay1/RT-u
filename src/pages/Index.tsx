import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import type { jsPDF } from "jspdf";
import { toast } from "sonner";

import { CollapsibleSidebar } from "@/components/CollapsibleSidebar";
import { DiagnosticsExportDialog } from "@/components/support/DiagnosticsExportDialog";
import { MenuBar } from "@/components/MenuBar";
import { ProfileSelectionDialog } from "@/components/inspector";
import { RtPtSidebar } from "@/components/RtPtSidebar";
import { RtPtWorkspace } from "@/components/RtPtWorkspace";
import { RtPtValidationDialog } from "@/components/rtpt/RtPtValidationDialog";
import { RtPtInspectionWorkspace } from "@/components/rtpt/RtPtInspectionWorkspace";
import { RtPtProcessOverview } from "@/components/rtpt/RtPtProcessOverview";
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
import { useRtPtInspectionReportState } from "@/hooks/useRtPtInspectionReportState";
import { useSheetPersistence } from "@/hooks/useSheetPersistence";
import { decodeRtPtDocument, fingerprintRtPtContent } from "@/lib/rtPtDocumentCodec";
import { validateRtPtDocument, type RtPtValidationIssue } from "@/lib/rtPtValidation";
import { resolveRtPtWorkflowTab } from "@/lib/rtPtWorkflow";
import type {
  PersistedTechniqueSheetData,
  TechniqueSheetRecord,
} from "@/services/techniqueSheetService";
import { RT_PT_METHOD_LABEL, type RtPtMethod, type RtPtWorkspaceMode } from "@/types/rtPtDocument";
import {
  buildRtPtFilmExposureSheetPdf,
  buildRtPtTechniquePdf,
  getRtPtFilmExposureSheetPdfFilename,
  getRtPtPdfReleaseState,
  getRtPtTechniquePdfFilename,
} from "@/utils/export/RtPtTechniquePDF";
import { loadRtPtTechniquePdfAttachmentImages } from "@/utils/export/rtPtPdfAttachments";
import {
  buildRtPtInspectionReportPdf,
  getRtPtInspectionReportPdfFilename,
  getRtPtInspectionReportPdfReleaseState,
} from "@/utils/export/RtPtInspectionReportPDF";
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
  "RT-CR": "RT Computed Radiography",
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
  const { currentProfile, needsProfileSelection, isLoading: profileLoading } = useInspectorProfile();
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
  const [workspaceMode, setWorkspaceMode] = useState<RtPtWorkspaceMode>("technique");
  const [isExportingTechniquePdf, setIsExportingTechniquePdf] = useState(false);
  const [isExportingInspectionReportPdf, setIsExportingInspectionReportPdf] = useState(false);
  const [isClosingAfterSave, setIsClosingAfterSave] = useState(false);
  const [isReplacingCard, setIsReplacingCard] = useState(false);
  const [isSavingBeforeCardLoad, setIsSavingBeforeCardLoad] = useState(false);
  const [lastSavedSnapshot, setLastSavedSnapshot] = useState<string | null>(null);
  const [hasHydratedRtPtDraft, setHasHydratedRtPtDraft] = useState(false);
  const hasInitializedSavedSnapshotRef = useRef(false);
  const recoveredDraftRef = useRef(false);
  const suppressClosePromptRef = useRef(false);
  const pendingNewTechniqueBaselineRef = useRef(false);
  const techniquePdfExportInFlightRef = useRef(false);
  const inspectionReportPdfExportInFlightRef = useRef(false);

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
  const inspectionReportWorkspace = useRtPtInspectionReportState(
    rtPtDocument,
    currentProfile,
    workspaceMode === "inspection",
  );
  const activeRtPtTab = ndtMethod === "RT-Film"
    ? rtPtWorkspace.activeTabs.rtFilm
    : ndtMethod === "RT-Digital"
      ? rtPtWorkspace.activeTabs.rtDigital
      : ndtMethod === "RT-CR"
        ? rtPtWorkspace.activeTabs.rtCr
        : rtPtWorkspace.activeTabs.pt;

  const buildRtPtPayload = useCallback(() => rtPtDocument, [rtPtDocument]);

  const applyPersistedRtPtData = useCallback((data: PersistedTechniqueSheetData) => {
    const decoded = hydrateRtPtDocument(data);
    if (decoded.status !== "success") {
      throw new Error(decoded.message);
    }
    setWorkspaceMode("technique");
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

  const saveGeneratedPdf = useCallback(async (pdf: jsPDF, filename: string): Promise<boolean> => {
    const electron = window.electron;
    if (electron?.isElectron === true) {
      if (typeof electron.savePDF !== "function") {
        throw new Error("The secure desktop PDF save service is unavailable.");
      }
      const dataUri = pdf.output("datauristring");
      const separatorIndex = dataUri.indexOf(",");
      if (separatorIndex < 0) throw new Error("The generated PDF could not be encoded.");
      const result = await electron.savePDF(dataUri.slice(separatorIndex + 1), filename);
      if (result.cancelled) {
        toast.info("PDF export cancelled.");
        return false;
      }
      if (!result.success) throw new Error(result.error || "The PDF could not be saved.");
      return true;
    }
    pdf.save(filename);
    return true;
  }, []);

  const handleExportTechniquePdf = useCallback(async () => {
    if (techniquePdfExportInFlightRef.current || inspectionReportPdfExportInFlightRef.current) return;
    techniquePdfExportInFlightRef.current = true;
    setIsExportingTechniquePdf(true);
    try {
      if (!await confirmActiveLicense()) return;
      const attachmentImages = await loadRtPtTechniquePdfAttachmentImages(rtPtDocument);
      const pdf = buildRtPtTechniquePdf(rtPtDocument, rtPtValidation, { attachmentImages });
      const filename = getRtPtTechniquePdfFilename(rtPtDocument, rtPtValidation);
      const release = getRtPtPdfReleaseState(rtPtDocument, rtPtValidation);
      if (!await saveGeneratedPdf(pdf, filename)) return;
      if (release.controlledRelease) toast.success(`Exported controlled technique ${filename}`);
      else toast.warning(`Exported draft/uncontrolled technique ${filename}.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The technique PDF could not be exported.");
    } finally {
      techniquePdfExportInFlightRef.current = false;
      setIsExportingTechniquePdf(false);
    }
  }, [confirmActiveLicense, rtPtDocument, rtPtValidation, saveGeneratedPdf]);

  const handleExportExposureSheetPdf = useCallback(async () => {
    if (techniquePdfExportInFlightRef.current || inspectionReportPdfExportInFlightRef.current) return;
    if (rtPtDocument.method !== "RT-Film" && rtPtDocument.method !== "RT-CR") {
      toast.info("The exposure sheet export applies to RT-Film and RT-CR techniques only.");
      return;
    }
    techniquePdfExportInFlightRef.current = true;
    setIsExportingTechniquePdf(true);
    try {
      if (!await confirmActiveLicense()) return;
      const pdf = buildRtPtFilmExposureSheetPdf(rtPtDocument);
      const filename = getRtPtFilmExposureSheetPdfFilename(rtPtDocument);
      const release = getRtPtPdfReleaseState(rtPtDocument);
      if (!await saveGeneratedPdf(pdf, filename)) return;
      if (release.controlledRelease) toast.success(`Exported controlled exposure sheet ${filename}`);
      else toast.warning(`Exported draft/uncontrolled exposure sheet ${filename}.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The exposure sheet PDF could not be exported.");
    } finally {
      techniquePdfExportInFlightRef.current = false;
      setIsExportingTechniquePdf(false);
    }
  }, [confirmActiveLicense, rtPtDocument, saveGeneratedPdf]);

  const handleExportInspectionReportPdf = useCallback(async () => {
    if (inspectionReportPdfExportInFlightRef.current || techniquePdfExportInFlightRef.current) return;
    if (workspaceMode !== "inspection") {
      setWorkspaceMode("inspection");
      toast.info("Inspection Record opened. Review the performed data before exporting the report PDF.");
      return;
    }
    inspectionReportPdfExportInFlightRef.current = true;
    setIsExportingInspectionReportPdf(true);
    try {
      if (!await confirmActiveLicense()) return;
      const { report, validation } = inspectionReportWorkspace;
      const pdf = buildRtPtInspectionReportPdf(report, rtPtDocument, validation);
      const filename = getRtPtInspectionReportPdfFilename(report, rtPtDocument, validation);
      const release = getRtPtInspectionReportPdfReleaseState(report, rtPtDocument, validation);
      if (!await saveGeneratedPdf(pdf, filename)) return;
      if (release.controlledRelease) toast.success(`Exported controlled inspection report ${filename}`);
      else toast.warning(`Exported draft/uncontrolled inspection report ${filename}.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The inspection report PDF could not be exported.");
    } finally {
      inspectionReportPdfExportInFlightRef.current = false;
      setIsExportingInspectionReportPdf(false);
    }
  }, [confirmActiveLicense, inspectionReportWorkspace, rtPtDocument, saveGeneratedPdf, workspaceMode]);

  const currentCardSnapshot = useMemo(
    () => fingerprintRtPtContent(rtPtDocument),
    [rtPtDocument],
  );
  const isTechniqueDirty = lastSavedSnapshot !== null && currentCardSnapshot !== lastSavedSnapshot;
  const hasReportPersistenceRisk = Boolean(inspectionReportWorkspace.saveError);
  const isDirty = isTechniqueDirty || hasReportPersistenceRisk;

  useEffect(() => {
    if (!pendingNewTechniqueBaselineRef.current) return;
    pendingNewTechniqueBaselineRef.current = false;
    setLastSavedSnapshot(currentCardSnapshot);
  }, [currentCardSnapshot]);

  const startNdtMethodTechnique = useCallback((method: RtPtMethod) => {
    setWorkspaceMode("technique");
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

  /** Process overview hand-off: open the technique tab that owns the picked stage. */
  const openTechniqueTab = useCallback((tab: string) => {
    setWorkspaceMode("technique");
    rtPtWorkspace.setActiveTab(ndtMethod, tab);
  }, [ndtMethod, rtPtWorkspace]);

  // Penetrant techniques have no radiographic pipeline to overview.
  useEffect(() => {
    if (ndtMethod !== "PT") return;
    setWorkspaceMode((mode) => (mode === "process" ? "technique" : mode));
  }, [ndtMethod]);

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
      if (inspectionReportWorkspace.saveError && !inspectionReportWorkspace.saveReportNow()) {
        toast.error(inspectionReportWorkspace.persistenceError || "The inspection report could not be secured before the update.");
        return;
      }
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
        reportMode: workspaceMode === "inspection" ? "Report" : "Technique",
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
    inspectionReportWorkspace,
    rtPtDocument,
    workspaceMode,
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
      if (inspectionReportWorkspace.saveError && !inspectionReportWorkspace.saveReportNow()) {
        toast.error(inspectionReportWorkspace.persistenceError || "Unable to save the current inspection report. The selected card was not loaded.");
        return;
      }
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
    inspectionReportWorkspace,
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
      if (inspectionReportWorkspace.saveError && !inspectionReportWorkspace.saveReportNow()) {
        toast.error(inspectionReportWorkspace.persistenceError || "Unable to save the inspection report before closing.");
        return;
      }
      if (isTechniqueDirty) {
        const result = await saveCurrentCardSilently();
        if (!result?.saved) {
          toast.error("Unable to save the latest technique changes before closing.");
          return;
        }
        markCurrentAsSaved();
      }
      await continueClosing();
    } finally {
      setIsClosingAfterSave(false);
    }
  }, [continueClosing, inspectionReportWorkspace, isTechniqueDirty, markCurrentAsSaved, saveCurrentCardSilently]);

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
          if (workspaceMode === "inspection") {
            if (inspectionReportWorkspace.saveReportNow()) toast.success("Inspection report saved to local report history.");
            else toast.error(inspectionReportWorkspace.persistenceError || "The inspection report could not be saved locally.");
          } else if (event.shiftKey) {
            persistSaveAs();
          } else {
            void handleSaveCard();
          }
          break;
        case "e":
          event.preventDefault();
          if (workspaceMode === "inspection") void handleExportInspectionReportPdf();
          else void handleExportTechniquePdf();
          break;
        case "n":
          event.preventDefault();
          handleNewProject();
          break;
      }
    };

    window.addEventListener("keydown", handleKeyboard);
    return () => window.removeEventListener("keydown", handleKeyboard);
  }, [
    handleExportInspectionReportPdf,
    handleExportTechniquePdf,
    handleNewProject,
    handleSaveCard,
    inspectionReportWorkspace,
    persistSaveAs,
    workspaceMode,
  ]);

  const handleValidate = useCallback(() => {
    if (workspaceMode === "inspection") {
      const issueCount = inspectionReportWorkspace.validation.issues.length;
      if (issueCount > 0) {
        toast.warning(`${issueCount} inspection report check${issueCount === 1 ? "" : "s"} require attention.`);
      } else if (inspectionReportWorkspace.validation.isApprovalReady) {
        toast.success("Inspection report is complete and ready for approval.");
      } else {
        toast.info("Inspection report data is complete; approval readiness remains separate.");
      }
      return;
    }
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
  }, [inspectionReportWorkspace.validation, rtPtValidation, workspaceMode]);

  const handleSaveActiveWorkspace = useCallback(async () => {
    if (workspaceMode === "technique") {
      await handleSaveCard();
      return;
    }
    if (!await confirmActiveLicense()) return;
    if (!inspectionReportWorkspace.saveReportNow()) {
      toast.error(inspectionReportWorkspace.persistenceError || "The inspection report could not be saved locally.");
      return;
    }
    toast.success("Inspection report saved to local report history.");
  }, [confirmActiveLicense, handleSaveCard, inspectionReportWorkspace, workspaceMode]);

  return (
    <div className="workbench-shell fixed inset-0 flex h-screen w-screen flex-col overflow-hidden bg-background">
      <ProfileSelectionDialog
        open={needsProfileSelection && !profileLoading}
        allowClose={false}
      />

      {!isElectron && (
        <div className="hidden md:block">
          <MenuBar
            onSave={handleSaveActiveWorkspace}
            onSaveAs={workspaceMode === "technique" ? persistSaveAs : undefined}
            onOpenSavedCards={openSavedCards}
            onExportTechnique={handleExportTechniquePdf}
            onExportInspectionReport={handleExportInspectionReportPdf}
            onExportExposureSheet={rtPtDocument.method === "RT-Film" || rtPtDocument.method === "RT-CR" ? handleExportExposureSheetPdf : undefined}
            workspaceMode={workspaceMode}
            onNew={handleNewProject}
            onExportDiagnostics={() => setDiagnosticsDialogOpen(true)}
            onRunDiagnostics={() => setDiagnosticsPanelOpen(true)}
          />
        </div>
      )}

      <Toolbar
        onNew={handleNewProject}
        onSave={handleSaveActiveWorkspace}
        onExportTechnique={handleExportTechniquePdf}
        onExportInspectionReport={handleExportInspectionReportPdf}
        onExportExposureSheet={rtPtDocument.method === "RT-Film" || rtPtDocument.method === "RT-CR" ? handleExportExposureSheetPdf : undefined}
        isExportingTechnique={isExportingTechniquePdf}
        isExportingInspectionReport={isExportingInspectionReportPdf}
        onValidate={handleValidate}
        ndtMethod={ndtMethod}
        workspaceMode={workspaceMode}
        onWorkspaceModeChange={setWorkspaceMode}
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
          {workspaceMode === "inspection" ? (
            <RtPtInspectionWorkspace controller={inspectionReportWorkspace} technique={rtPtDocument} />
          ) : workspaceMode === "process" ? (
            <RtPtProcessOverview
              techniqueDocument={rtPtDocument}
              validation={rtPtValidation}
              onOpenTab={openTechniqueTab}
            />
          ) : (
            <RtPtWorkspace workspace={rtPtWorkspace} validation={rtPtValidation} />
          )}
        </div>
      </div>

      <StatusBar
        completionPercent={workspaceMode === "inspection"
          ? inspectionReportWorkspace.validation.completionPercent
          : rtPtValidation.completionPercent}
        requiredFieldsComplete={workspaceMode === "inspection"
          ? inspectionReportWorkspace.validation.completedFieldsCount
          : rtPtValidation.completedFieldsCount}
        totalRequiredFields={workspaceMode === "inspection"
          ? inspectionReportWorkspace.validation.totalRequiredFields
          : rtPtValidation.totalRequiredFields}
        completionLabel={workspaceMode === "inspection" ? "Inspection report fields" : "Required technique fields"}
        autoSaveStatus={workspaceMode === "inspection"
          ? inspectionReportWorkspace.persistenceError ? "error" : "saved"
          : persistence.autoSaveStatus}
        lastSaved={workspaceMode === "inspection" ? null : persistence.lastSaved}
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
          const workspaceTab = resolveRtPtWorkflowTab(ndtMethod, issue.tab);
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
              The current RT/PT workspace has changes or report data that are not safely persisted. Choose how to continue before loading the selected card.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="rounded-lg border border-warning/30 bg-warning/10 p-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Current workspace</div>
              <div className="mt-1 truncate text-sm font-semibold">
                {persistence.currentSheetName || rtPtDocumentTitle || "Unsaved technique"}
              </div>
              <div className="mt-1 text-xs font-medium text-warning">
                {hasReportPersistenceRisk ? 'Inspection report storage requires attention' : 'Unsaved technique changes'}
              </div>
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
              Changing the inspection method creates a separate controlled document. Unsaved technique work or unpersisted report changes will be discarded.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
            <div className="rounded-lg border border-border bg-muted/30 p-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Current document</div>
              <div className="mt-1 text-sm font-semibold">{RT_PT_METHOD_SHORT_LABEL[ndtMethod]}</div>
              <div className="mt-1 text-xs text-warning">{hasReportPersistenceRisk ? 'Report storage requires attention' : 'Unsaved changes'}</div>
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
              This closes the current workspace and starts a fresh RT/PT project. Stored report history is retained; save any unresolved technique or report changes first.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-lg border border-warning/30 bg-warning/10 px-3 py-3 text-sm text-foreground">
            {hasReportPersistenceRisk
              ? 'The active inspection report is not safely persisted.'
              : isTechniqueDirty ? 'The current technique contains unsaved changes.' : 'The current workspace will be closed.'}
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
              RT Inspector restored the in-progress card that was open before the app restarted to install an update.
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
              The current technique or inspection report has data that is not safely persisted. RT Inspector can retry the required saves before closing.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-sm">
            Current workspace: {persistence.currentSheetName || rtPtDocumentTitle || "Unsaved card"}
            {hasReportPersistenceRisk && <div className="mt-1 text-xs">Report: {inspectionReportWorkspace.persistenceError}</div>}
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
