import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StandardSelector } from "@/components/StandardSelector";
import { AcceptanceClassSelector } from "@/components/AcceptanceClassSelector";
import { ThreeDViewer } from "@/components/ThreeDViewer";
import { MenuBar } from "@/components/MenuBar";
import { Toolbar } from "@/components/Toolbar";
import { StatusBar } from "@/components/StatusBar";
import { UnifiedExportDialog } from "@/components/export/UnifiedExportDialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InspectionSetupTab } from "@/components/tabs/InspectionSetupTab";
import { EquipmentTab } from "@/components/tabs/EquipmentTab";
import { CalibrationTab } from "@/components/tabs/CalibrationTab";
import { ScanParametersTab } from "@/components/tabs/ScanParametersTab";
import { AcceptanceCriteriaTab } from "@/components/tabs/AcceptanceCriteriaTab";
import { DocumentationTab } from "@/components/tabs/DocumentationTab";
import { CoverPageTab } from "@/components/tabs/CoverPageTab";
import { PartDiagramTab } from "@/components/tabs/PartDiagramTab";
import { ProbeDetailsTab } from "@/components/tabs/ProbeDetailsTab";
import { ScansTab } from "@/components/tabs/ScansTab";
import { RemarksTab } from "@/components/tabs/RemarksTab";
import { EquipmentDetailsTab } from "@/components/tabs/EquipmentDetailsTab";
import { IndicationsTab } from "@/components/tabs/IndicationsTab";
import { ResultsSummaryTab } from "@/components/tabs/ResultsSummaryTab";
import { InspectorCertificationTab } from "@/components/tabs/InspectorCertificationTab";
import { AerospaceForgingTab } from "@/components/tabs/AerospaceForgingTab";
import { ScanDetailsTab } from "@/components/tabs/ScanDetailsTab";
import { ScanPlanTab } from "@/components/tabs/ScanPlanTab";
import { NdipReferenceTab } from "@/components/tabs/NdipReferenceTab";
import { Collapsible3DPanel } from "@/components/ui/ResizablePanel";
import { CollapsibleSidebar } from "@/components/CollapsibleSidebar";
import type { StandardType, MaterialType, AcceptanceClass } from "@/types/techniqueSheet";
import { getResolutionValues } from "@/utils/frequencyUtils";
import { deriveCalibrationScanDirectionInfo } from "@/utils/mroPolicy";
import { useAuth } from "@/hooks/useAuth";
import { logInfo } from "@/lib/logger";
import { Button } from "@/components/ui/button";
import { Loader2, FileText, FlaskConical } from "lucide-react";
import { useInspectorProfile } from "@/contexts/InspectorProfileContext";
import { ProfileSelectionDialog } from "@/components/inspector";
import { quickFillPresets } from "@/data/quickFillPresets";
import { useLicense } from "@/contexts/LicenseContext";
import { DiagnosticsExportDialog } from "@/components/support/DiagnosticsExportDialog";
import { SelfDiagnosticPanel } from "@/components/diagnostics/SelfDiagnosticPanel";
import { OfflineUpdateDialog } from "@/components/updates/OfflineUpdateDialog";
import { LicenseWarningBanner } from "@/components/LicenseWarningBanner";
import { requiresAngleBeam } from "@/utils/beamTypeClassification";
import { exportInspectionReportPDF } from "@/utils/export/InspectionReportPDF";
import {
  clearTechniqueSheetDraft,
  clearUpdateRecoveryRecord,
  readUpdateRecoveryRecord,
  writeTechniqueSheetDraft,
  writeUpdateRecoveryRecord,
} from "@/utils/updateRecovery";
import type { UpdateRecoveryRecord } from "@/utils/updateRecovery";
import type { SavedCard } from "@/contexts/SavedCardsContext";

import { StandardProvider } from "@/contexts/StandardContext";

// Custom hooks
import { useTechniqueSheetState } from "@/hooks/useTechniqueSheetState";
import { useSheetPersistence } from "@/hooks/useSheetPersistence";
import { useExportWorkflow } from "@/hooks/useExportWorkflow";
import { useStandardAutoFill } from "@/hooks/useStandardAutoFill";
import { useCompletionScore } from "@/hooks/useCompletionScore";

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

const Index = () => {
  const navigate = useNavigate();
  const { user, loading, signOut } = useAuth();
  const { isElectron } = useLicense();
  const { needsProfileSelection, isLoading: profileLoading } = useInspectorProfile();

  // ── UI-level state (stays in Index) ────────────────────────────────────
  const [standard, setStandard] = useState<StandardType>("AMS-STD-2154E");
  const [activeTab, setActiveTab] = useState("setup");
  const [reportMode, setReportMode] = useState<"Technique" | "Report">("Technique");
  const [isSplitMode, setIsSplitMode] = useState(false);
  const [activePart, setActivePart] = useState<"A" | "B">("A");
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [diagnosticsDialogOpen, setDiagnosticsDialogOpen] = useState(false);
  const [diagnosticsPanelOpen, setDiagnosticsPanelOpen] = useState(false);
  const [offlineUpdateDialogOpen, setOfflineUpdateDialogOpen] = useState(false);
  const [licenseWarningDismissed, setLicenseWarningDismissed] = useState(false);
  const [viewer3DOpen, setViewer3DOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [quickFillDialogOpen, setQuickFillDialogOpen] = useState(false);
  const [unsavedCloseDialogOpen, setUnsavedCloseDialogOpen] = useState(false);
  const [updateRecoveryNotice, setUpdateRecoveryNotice] = useState<UpdateRecoveryRecord | null>(null);
  const [isClosingAfterSave, setIsClosingAfterSave] = useState(false);
  const [lastSavedSnapshot, setLastSavedSnapshot] = useState<string | null>(null);
  const hasInitializedSavedSnapshotRef = useRef(false);
  const suppressClosePromptRef = useRef(false);

  // ── Hook 1: Technique sheet state ──────────────────────────────────────
  const sheetState = useTechniqueSheetState({
    standard, isSplitMode, activePart, reportMode, activeTab,
    setStandard, setActiveTab, setReportMode, setIsSplitMode, setActivePart,
  });

  const {
    inspectionSetup, setInspectionSetup,
    equipment, setEquipment,
    calibration, setCalibration,
    scanParameters, setScanParameters,
    acceptanceCriteria, setAcceptanceCriteria,
    documentation,
    scanDetails,
    inspectionSetupB, setInspectionSetupB,
    equipmentB, setEquipmentB,
    calibrationB, setCalibrationB,
    scanParametersB, setScanParametersB,
    acceptanceCriteriaB, setAcceptanceCriteriaB,
    documentationB,
    scanDetailsB,
    inspectionReport, setInspectionReport,
    currentData,
    copyPartAToB,
    buildTechniqueSheetPayload,
    buildCardData,
    applyLoadedSheet,
    applyLocalCard,
    loadDraftFromLocalStorage,
    applyTestCard,
    applySampleCard,
    applyStandardChange,
  } = sheetState;

  // ── Hook 4: Standard auto-fill ─────────────────────────────────────────
  useStandardAutoFill({
    standard, isSplitMode, activePart,
    inspectionSetup, equipment, calibration, scanParameters, acceptanceCriteria,
    setEquipment, setCalibration: sheetState.setCalibration,
    setScanParameters, setAcceptanceCriteria,
    inspectionSetupB, equipmentB,
    setEquipmentB, setCalibrationB: sheetState.setCalibrationB,
    setScanParametersB, setAcceptanceCriteriaB,
  });

  // ── Hook 5: Completion score ───────────────────────────────────────────
  const { completionPercent, completedFieldsCount } = useCompletionScore({
    currentData, reportMode,
  });

  // ── Hook 2: Sheet persistence ──────────────────────────────────────────
  const persistence = useSheetPersistence({
    user, standard, isSplitMode, activePart, reportMode,
    completionPercent, currentData,
    buildTechniqueSheetPayload, buildCardData,
    applyLoadedSheet, applyLocalCard,
    inspectionSetupB, equipmentB, calibrationB,
    scanParametersB, acceptanceCriteriaB, documentationB,
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
    setCurrentLocalCardId,
    setCurrentSheetName,
  } = persistence;

  // ── Hook 3: Export workflow ────────────────────────────────────────────
  const exportWorkflow = useExportWorkflow({
    activeTab, setActiveTab, reportMode, currentData,
    isSplitMode, activePart, inspectionSetup, inspectionSetupB,
  });
  const { handleExportPDF: prepareExportPDF } = exportWorkflow;

  const handleExportPDF = useCallback(async () => {
    const result = await prepareExportPDF();
    if (result.shouldOpenDialog) {
      setExportDialogOpen(true);
    }
  }, [prepareExportPDF]);

  const currentDraftData = useMemo(() => buildCardData(), [buildCardData]);
  const currentCardSnapshot = useMemo(() => JSON.stringify(currentDraftData), [currentDraftData]);
  const isDirty = lastSavedSnapshot !== null && currentCardSnapshot !== lastSavedSnapshot;
  const isPwNdip = standard === "NDIP-1226" || standard === "NDIP-1227";

  const markCurrentAsSaved = useCallback((snapshot = currentCardSnapshot) => {
    setLastSavedSnapshot(snapshot);
  }, [currentCardSnapshot]);

  // ── localStorage draft save ────────────────────────────────────────────
  useEffect(() => {
    if (!sheetState.hasHydratedInitialDraft) {
      return;
    }

    writeTechniqueSheetDraft(currentDraftData);
  }, [sheetState.hasHydratedInitialDraft, currentDraftData]);

  // Load draft on mount
  useEffect(() => {
    loadDraftFromLocalStorage();
  }, [loadDraftFromLocalStorage]);

  useEffect(() => {
    if (!sheetState.hasHydratedInitialDraft || hasInitializedSavedSnapshotRef.current) {
      return;
    }

    hasInitializedSavedSnapshotRef.current = true;
    setLastSavedSnapshot(currentCardSnapshot);
  }, [sheetState.hasHydratedInitialDraft, currentCardSnapshot]);

  useEffect(() => {
    if (!sheetState.hasHydratedInitialDraft) {
      return;
    }

    const recoveryRecord = readUpdateRecoveryRecord();
    if (recoveryRecord) {
      setUpdateRecoveryNotice(recoveryRecord);
    }
  }, [sheetState.hasHydratedInitialDraft]);

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
      const cardName =
        currentSheetName ||
        currentData.inspectionSetup.partName ||
        currentData.inspectionSetup.partNumber ||
        "Unsaved card";

      writeTechniqueSheetDraft(currentDraftData);
      writeUpdateRecoveryRecord({
        cardName,
        savedAt: new Date().toISOString(),
        reason: payload.reason,
        version: payload.version,
        activeTab,
        reportMode,
      });

      await updateInstallElectron.confirmUpdateInstallReady?.(payload.requestId);
    };

    updateInstallElectron.onPrepareForUpdateInstall(handlePrepareForUpdateInstall);
    return () => {
      updateInstallElectron.removePrepareForUpdateInstall?.(handlePrepareForUpdateInstall);
    };
  }, [
    currentDraftData,
    currentSheetName,
    currentData.inspectionSetup.partName,
    currentData.inspectionSetup.partNumber,
    activeTab,
    reportMode,
  ]);

  // ── Keyboard shortcuts ─────────────────────────────────────────────────
  const confirmAppClose = useCallback(async () => {
    try {
      if (window.electron?.confirmAppClose) {
        await window.electron.confirmAppClose();
        return;
      }

      window.close();
    } catch (error) {
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
    const result = await persistSave();
    if (result?.saved) {
      markCurrentAsSaved();
    }
  }, [persistSave, markCurrentAsSaved]);

  const handleSaveDialogConfirm = useCallback(async () => {
    const result = await confirmSaveDialog();
    if (result?.saved) {
      markCurrentAsSaved();
    }
  }, [confirmSaveDialog, markCurrentAsSaved]);

  const handleLoadLocalSavedCard = useCallback((card: SavedCard) => {
    const loadedCard = loadLocalCard(card);
    if (loadedCard?.data) {
      setLastSavedSnapshot(JSON.stringify(loadedCard.data));
    }
  }, [loadLocalCard]);

  const handleLoadSavedSheet = useCallback(async (sheetId: string) => {
    const loadedSheet = await loadSavedSheet(sheetId);
    if (loadedSheet?.data) {
      setLastSavedSnapshot(JSON.stringify(loadedSheet.data));
    }
  }, [loadSavedSheet]);

  const handleCloseRequest = useCallback(async () => {
    if (suppressClosePromptRef.current) {
      return;
    }

    if (!isDirty) {
      await continueClosing();
      return;
    }

    setUnsavedCloseDialogOpen(true);
  }, [isDirty, continueClosing]);

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
  }, [saveCurrentCardSilently, markCurrentAsSaved, continueClosing]);

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

  const handleNewProject = useCallback(() => {
    if (confirm("Start a new project? Unsaved changes will be lost.")) {
      setCurrentLocalCardId(null);
      setCurrentSheetName("");
      window.location.reload();
    }
  }, [setCurrentLocalCardId, setCurrentSheetName]);

  useEffect(() => {
    const handleKeyboard = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        switch (e.key.toLowerCase()) {
          case "s":
            e.preventDefault();
            if (e.shiftKey) {
              persistSaveAs();
            } else {
              void handleSaveCard();
            }
            break;
          case "e":
            e.preventDefault();
            void handleExportPDF();
            break;
          case "n":
            e.preventDefault();
            handleNewProject();
            break;
        }
      }
    };

    window.addEventListener("keydown", handleKeyboard);
    return () => window.removeEventListener("keydown", handleKeyboard);
  }, [handleExportPDF, handleNewProject, handleSaveCard, persistSaveAs]);

  const handleValidate = useCallback(() => {
    const missing = [];
    if (!inspectionSetup.partNumber) missing.push("Part Number");
    if (!equipment.manufacturer) missing.push("Equipment Manufacturer");
    if (!calibration.standardType) missing.push("Calibration Standard");
    if (!acceptanceCriteria.acceptanceClass) missing.push("Acceptance Class");
    if (!documentation.inspectorName) missing.push("Inspector Name");
    if (missing.length > 0) {
      toast.error(`Missing required fields: ${missing.join(", ")}`);
    } else {
      toast.success("All required fields complete!");
    }
  }, [inspectionSetup.partNumber, equipment.manufacturer, calibration.standardType, acceptanceCriteria.acceptanceClass, documentation.inspectorName]);

  const loadTestCard = useCallback((cardIndex: number) => {
    const card = quickFillPresets[cardIndex - 1];
    if (!card) {
      toast.error(`QA preset ${cardIndex} not found`);
      return;
    }
    applyTestCard(card);
    toast.success(`Loaded preset: ${card.name}`, {
      description: `${card.buttonSubtitle} · ${card.standard}`,
    });
    logInfo("Loaded test card", { cardId: card.id, cardName: card.name });
  }, [applyTestCard]);

  const handleLoadSampleCards = useCallback(async () => {
    try {
      const response = await fetch("/sample-cards.json");
      if (!response.ok) throw new Error("Failed to fetch sample cards");
      const cards = await response.json();
      if (Array.isArray(cards) && cards.length > 0) {
        applySampleCard(cards[0]);
        toast.success(`Loaded sample card: ${cards[0].name}`, {
          description: `${cards.length} sample cards available. Use the QA preset panel for full geometry coverage.`,
        });
        logInfo("Loaded sample card", { cardName: cards[0].name });
      } else {
        toast.error("No sample cards found");
      }
    } catch (error) {
      console.error("Error loading sample cards:", error);
      toast.error("Failed to load sample cards");
    }
  }, [applySampleCard]);

  // Keyboard shortcuts for test cards
  useEffect(() => {
    const quickFillShortcutKeys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0", "-", "="];
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey) {
        const shortcutIndex = quickFillShortcutKeys.indexOf(e.key);
        if (shortcutIndex >= 0) {
          e.preventDefault();
          loadTestCard(shortcutIndex + 1);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [loadTestCard]);

  // Redirect to auth page if not authenticated
  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
  }, [user, loading, navigate]);

  const quickFillAccentClasses = {
    cyan: "border-cyan-200 bg-cyan-50/70 hover:border-cyan-300 hover:bg-cyan-100/70 text-cyan-950",
    amber: "border-amber-200 bg-amber-50/80 hover:border-amber-300 hover:bg-amber-100/80 text-amber-950",
    slate: "border-slate-300 bg-slate-50/85 hover:border-slate-400 hover:bg-slate-100/90 text-slate-900",
  } as const;
  const quickFillShortcutHint = "Ctrl+Shift+1-9,0,-,=";

  const renderQuickFillPanel = (compact = false) => (
    <div className={`rounded-xl border border-dashed border-border/80 bg-muted/30 ${compact ? "p-3" : "mt-6 p-3"}`}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <FlaskConical className="h-4 w-4 text-primary" />
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Quick Fill</p>
          </div>
          <h3 className="text-sm font-semibold">Geometry QA Presets</h3>
          <p className="text-xs text-muted-foreground">
            One click fills a complete realistic card for every supported geometry, including report sections.
          </p>
        </div>
        <div className="rounded-full bg-background px-2 py-1 text-[10px] font-medium text-muted-foreground whitespace-nowrap">
          {quickFillShortcutHint}
        </div>
      </div>

      <div className="grid gap-2">
        {quickFillPresets.map((preset, index) => (
          <Button
            key={preset.id}
            type="button"
            variant="outline"
            onClick={() => loadTestCard(index + 1)}
            className={`h-auto justify-start px-3 py-3 text-left transition-colors ${quickFillAccentClasses[preset.accent]}`}
            title={`${preset.name} (${preset.standard})`}
          >
            <div className="min-w-0">
              <div className="text-sm font-semibold leading-tight">{preset.buttonLabel}</div>
              <div className="text-xs leading-tight opacity-80">{preset.buttonSubtitle}</div>
              <div className="mt-1 text-[11px] leading-tight text-slate-600">
                {preset.standard} · {preset.name}
              </div>
            </div>
          </Button>
        ))}
      </div>
    </div>
  );

  const workbenchTabTriggerClass = "flex-shrink-0 whitespace-nowrap px-2.5 py-2 text-sm";
  const workbenchTabListClass = "inline-flex h-auto w-max min-w-full flex-nowrap items-center justify-start gap-1.5 xl:gap-2";

  useEffect(() => {
    const activeTabElement = document.querySelector<HTMLElement>(
      '.workbench-tabstrip [role="tab"][data-state="active"]',
    );
    activeTabElement?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [activeTab, reportMode]);

  // ── Loading / auth guards ──────────────────────────────────────────────
  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-background fixed inset-0">
        <div className="text-center space-y-4">
          <Loader2 className="h-12 w-12 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-background fixed inset-0">
        <div className="text-center space-y-4">
          <Loader2 className="h-12 w-12 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">Redirecting to login...</p>
        </div>
      </div>
    );
  }

  return (
    <StandardProvider standard={standard}>
      <div className="workbench-shell h-screen w-screen flex flex-col overflow-hidden bg-background fixed inset-0">
      {/* Profile Selection Dialog */}
      <ProfileSelectionDialog
        open={needsProfileSelection && !profileLoading}
        allowClose={false}
      />

      {/* License Expiry Warning Banner */}
      {!licenseWarningDismissed && (
        <LicenseWarningBanner onDismiss={() => setLicenseWarningDismissed(true)} />
      )}

      {/* Menu Bar - Hidden on Mobile and in Electron */}
      {!isElectron && (
        <div className="hidden md:block">
          <MenuBar
            onSave={handleSaveCard}
            onSaveAs={persistSaveAs}
            onOpenSavedCards={openSavedCards}
            onExport={handleExportPDF}
            onNew={handleNewProject}
            onSignOut={signOut}
            onOpenDrawingEngine={() => navigate("/drawing-test")}
            onLoadSampleCards={handleLoadSampleCards}
            onExportDiagnostics={() => setDiagnosticsDialogOpen(true)}
            onRunDiagnostics={() => setDiagnosticsPanelOpen(true)}
            onOfflineUpdate={() => setOfflineUpdateDialogOpen(true)}
          />
        </div>
      )}

      {/* Toolbar */}
      <Toolbar
        onSave={handleSaveCard}
        onExport={handleExportPDF}
        onValidate={handleValidate}
        reportMode={reportMode}
        onReportModeChange={setReportMode}
        isSplitMode={isSplitMode}
        onSplitModeChange={setIsSplitMode}
        activePart={activePart}
        onActivePartChange={setActivePart}
        onCopyAToB={copyPartAToB}
        onOpenSavedCards={openSavedCards}
        onLoadLocalCard={handleLoadLocalSavedCard}
        onOpenQuickFill={() => setQuickFillDialogOpen(true)}
        partType={currentData.inspectionSetup.partType}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden min-h-0 px-2 pb-2 md:px-3 md:pb-3">
        {/* Compact Header with Standard & Class for mobile/tablet layouts */}
        <div className="lg:hidden border border-border/80 bg-card/90 rounded-[1.35rem] p-3 mb-2">
          <div className="flex flex-col gap-4">
            <div className="flex-1">
              <h3 className="font-semibold text-xs mb-2">Standard</h3>
              <StandardSelector value={standard} onChange={applyStandardChange} />
            </div>
            {reportMode === "Technique" && !isPwNdip && (
              <div className="border-t border-border pt-3">
                <AcceptanceClassSelector
                  value={(!isSplitMode || activePart === "A") ? acceptanceCriteria.acceptanceClass : acceptanceCriteriaB.acceptanceClass}
                  onChange={(newClass) => {
                    if (!isSplitMode || activePart === "A") {
                      setAcceptanceCriteria(prev => ({ ...prev, acceptanceClass: newClass }));
                    } else {
                      setAcceptanceCriteriaB(prev => ({ ...prev, acceptanceClass: newClass }));
                    }
                  }}
                  standard={standard}
                />
              </div>
            )}
          </div>
        </div>

        {/* Desktop: Left Panel with Standard Selector */}
        <CollapsibleSidebar
          isOpen={sidebarOpen}
          onToggle={() => setSidebarOpen(!sidebarOpen)}
          title="Standard & Class"
        >
          <StandardSelector value={standard} onChange={applyStandardChange} variant="compact" />
          {reportMode === "Technique" && !isPwNdip && (
            <div className="mt-6 pt-4 border-t border-border">
              <AcceptanceClassSelector
                value={(!isSplitMode || activePart === "A") ? acceptanceCriteria.acceptanceClass : acceptanceCriteriaB.acceptanceClass}
                onChange={(newClass) => {
                  if (!isSplitMode || activePart === "A") {
                    setAcceptanceCriteria(prev => ({ ...prev, acceptanceClass: newClass }));
                  } else {
                    setAcceptanceCriteriaB(prev => ({ ...prev, acceptanceClass: newClass }));
                  }
                }}
                standard={standard}
                variant="compact"
              />
            </div>
          )}
        </CollapsibleSidebar>

        {/* Center Panel: Main Form */}
          <div className="flex-1 flex flex-col min-h-0 min-w-0 overflow-hidden">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0 overflow-hidden">
            <div className="px-1 pb-1.5 pt-1 md:px-3 md:pb-2 md:pt-1.5 flex-shrink-0">
                {reportMode === "Technique" ? (
                  <>
                    <div className="workbench-header">
                      <div className="workbench-tabstrip workbench-tabstrip-compact w-full max-w-full overflow-x-auto overscroll-x-contain scrollbar-hide sticky top-0 z-10">
                        <TabsList className={workbenchTabListClass}>
                          <TabsTrigger value="setup" className={workbenchTabTriggerClass}>Setup</TabsTrigger>
                          <TabsTrigger value="scan" className={`${workbenchTabTriggerClass} whitespace-nowrap`}>Scan Params</TabsTrigger>
                          <TabsTrigger value="equipment" className={workbenchTabTriggerClass}>Equipment</TabsTrigger>
                          <TabsTrigger value="calibration" className={`${workbenchTabTriggerClass} whitespace-nowrap`}>Reference Standard</TabsTrigger>
                          <TabsTrigger value="acceptance" className={workbenchTabTriggerClass}>{isPwNdip ? "Rejection Criteria" : "Acceptance"}</TabsTrigger>
                          <TabsTrigger value="scandetails" className={`${workbenchTabTriggerClass} whitespace-nowrap`}>Scan Details</TabsTrigger>
                          <TabsTrigger value="docs" className={workbenchTabTriggerClass}>Documentation</TabsTrigger>
                          {isPwNdip && (
                            <TabsTrigger value="ndip-reference" className={`${workbenchTabTriggerClass} whitespace-nowrap`}>NDIP Notes</TabsTrigger>
                          )}
                          <TabsTrigger value="scanplan" className={`${workbenchTabTriggerClass} whitespace-nowrap`}>Scan Plan</TabsTrigger>
                        </TabsList>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="workbench-header">
                      <div className="border-b border-border/70 px-3 py-2 md:px-4 md:py-2.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="min-w-0 flex-1 text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                            Report Workspace
                          </div>
                        <Button
                          onClick={() => {
                            toast.loading("Generating Inspection Report PDF...", { id: "report-export" });
                            setTimeout(() => {
                            exportInspectionReportPDF({
                              ...inspectionReport,
                              acceptanceCriteria: {
                                acceptanceClass: currentData.acceptanceCriteria.acceptanceClass || inspectionReport.acceptanceCriteria?.acceptanceClass || "",
                                singleDiscontinuity: currentData.acceptanceCriteria.singleDiscontinuity || inspectionReport.acceptanceCriteria?.singleDiscontinuity || "",
                                multipleDiscontinuities: currentData.acceptanceCriteria.multipleDiscontinuities || inspectionReport.acceptanceCriteria?.multipleDiscontinuities || "",
                                linearDiscontinuity: currentData.acceptanceCriteria.linearDiscontinuity || inspectionReport.acceptanceCriteria?.linearDiscontinuity || "",
                                backReflectionLoss: currentData.acceptanceCriteria.backReflectionLoss ?? inspectionReport.acceptanceCriteria?.backReflectionLoss ?? 0,
                                noiseLevel: currentData.acceptanceCriteria.noiseLevel || inspectionReport.acceptanceCriteria?.noiseLevel || "",
                                specialRequirements: currentData.acceptanceCriteria.specialRequirements || inspectionReport.acceptanceCriteria?.specialRequirements,
                                standardNotes: currentData.acceptanceCriteria.standardNotes || inspectionReport.acceptanceCriteria?.standardNotes,
                                includeStandardNotesInReport:
                                  currentData.acceptanceCriteria.includeStandardNotesInReport ??
                                  inspectionReport.acceptanceCriteria?.includeStandardNotesInReport,
                              },
                            }, {
                              companyName: "SCAN-MASTER",
                              includeAerospaceSection: true,
                            });
                            toast.dismiss("report-export");
                            toast.success("Inspection Report PDF exported successfully!");
                          }, 500);
                        }}
                        size="sm"
                        className="h-10 min-h-0 rounded-[1rem] border border-primary/25 bg-primary/12 px-5 text-primary shadow-none hover:bg-primary/18"
                      >
                        <FileText className="h-4 w-4 mr-2" />
                        Export Report PDF
                      </Button>
                      </div>
                      </div>
                      <div className="workbench-tabstrip workbench-tabstrip-compact w-full max-w-full overflow-x-auto overscroll-x-contain scrollbar-hide sticky top-0 z-10">
                        <TabsList className={workbenchTabListClass}>
                          <TabsTrigger value="cover" className={`${workbenchTabTriggerClass} whitespace-nowrap`}>Cover Page</TabsTrigger>
                          <TabsTrigger value="equipment-report" className={`${workbenchTabTriggerClass} whitespace-nowrap`}>Equipment</TabsTrigger>
                          <TabsTrigger value="diagram" className={`${workbenchTabTriggerClass} whitespace-nowrap`}>Part Diagram</TabsTrigger>
                          <TabsTrigger value="indications" className={`${workbenchTabTriggerClass} whitespace-nowrap`}>Indications</TabsTrigger>
                          <TabsTrigger value="probe" className={`${workbenchTabTriggerClass} whitespace-nowrap`}>Probes</TabsTrigger>
                          <TabsTrigger value="scans" className={workbenchTabTriggerClass}>Scans</TabsTrigger>
                          <TabsTrigger value="results" className={`${workbenchTabTriggerClass} whitespace-nowrap`}>Results</TabsTrigger>
                          <TabsTrigger value="certification" className={`${workbenchTabTriggerClass} whitespace-nowrap`}>Certification</TabsTrigger>
                          <TabsTrigger value="aerospace" className={`${workbenchTabTriggerClass} whitespace-nowrap`}>Aerospace</TabsTrigger>
                          <TabsTrigger value="remarks" className={workbenchTabTriggerClass}>Remarks</TabsTrigger>
                        </TabsList>
                      </div>
                    </div>
                  </>
                )}
            </div>

            <div className="flex-1 overflow-y-auto overflow-x-hidden px-1 md:px-3 pb-3 min-h-0">
                {reportMode === "Technique" ? (
                  <>
                    <div className="app-panel workbench-surface rounded-[1.5rem] max-w-full">
                      <TabsContent value="setup" className="m-0">
                        <InspectionSetupTab
                          data={currentData.inspectionSetup}
                          onChange={currentData.setInspectionSetup}
                          acceptanceClass={currentData.acceptanceCriteria.acceptanceClass as AcceptanceClass | ""}
                          standardType={standard}
                          scanDetails={currentData.scanDetails}
                          onCalibrationRecommendation={(blockType, reasoning) => {
                            const currentCalibration = currentData.calibration;
                            const scanDirectionInfo = deriveCalibrationScanDirectionInfo(
                              currentData.scanDetails.scanDetails,
                              standard,
                            );
                            if (currentCalibration.standardType !== blockType) {
                              const recommendedBlockType = blockType as typeof currentCalibration.standardType;
                              currentData.setCalibration({
                                ...currentCalibration,
                                standardType: recommendedBlockType,
                                autoRecommendedReason: reasoning,
                              });
                              logInfo(`Auto-selected calibration block: ${blockType}`, {
                                reasoning,
                                criticalScans: {
                                  hasCircumferential: scanDirectionInfo.hasCircumferentialScan,
                                  hasAngleBeam: scanDirectionInfo.hasAngleBeam,
                                },
                              });
                            }
                          }}
                        />
                      </TabsContent>

                      <TabsContent value="scandetails" className="m-0">
                        <ScanDetailsTab
                          data={currentData.scanDetails}
                          onChange={currentData.setScanDetails}
                          partType={currentData.inspectionSetup.partType}
                          standard={standard}
                          partNumber={currentData.inspectionSetup.partNumber}
                          equipmentFrequency={currentData.equipment.frequency}
                          dimensions={{
                            diameter: currentData.inspectionSetup.diameter,
                            length: currentData.inspectionSetup.partLength,
                            width: currentData.inspectionSetup.partWidth,
                            height: currentData.inspectionSetup.partThickness,
                            thickness: currentData.inspectionSetup.partThickness,
                            outerDiameter: currentData.inspectionSetup.diameter,
                            innerDiameter: currentData.inspectionSetup.innerDiameter,
                            coneTopDiameter: currentData.inspectionSetup.coneTopDiameter,
                            coneBottomDiameter: currentData.inspectionSetup.coneBottomDiameter,
                            coneHeight: currentData.inspectionSetup.coneHeight,
                            wallThickness: currentData.inspectionSetup.wallThickness,
                            isHollow: currentData.inspectionSetup.isHollow,
                          }}
                        />
                      </TabsContent>

                      <TabsContent value="scan" className="m-0">
                        <ScanParametersTab
                          data={currentData.scanParameters}
                          onChange={currentData.setScanParameters}
                          standard={standard}
                          equipmentFrequency={currentData.equipment.frequency}
                          onEquipmentFrequencyChange={(frequency) => {
                            const resolution = getResolutionValues(frequency);
                            currentData.setEquipment({
                              ...currentData.equipment,
                              frequency,
                              entrySurfaceResolution: resolution.entry,
                              backSurfaceResolution: resolution.back,
                            });
                          }}
                          equipmentData={currentData.equipment}
                          onEquipmentDataChange={currentData.setEquipment}
                          partThickness={currentData.inspectionSetup.partThickness}
                          materialVelocity={currentData.inspectionSetup.acousticVelocity}
                        />
                      </TabsContent>

                      <TabsContent value="equipment" className="m-0">
                        <EquipmentTab
                          data={currentData.equipment}
                          onChange={currentData.setEquipment}
                          partThickness={currentData.inspectionSetup.partThickness}
                          standard={standard}
                          scanTechnique={currentData.scanParameters.technique}
                          calibrationData={currentData.calibration}
                          onCalibrationChange={currentData.setCalibration}
                        />
                      </TabsContent>

                      <TabsContent value="calibration" className="m-0">
                        <CalibrationTab
                          data={currentData.calibration}
                          onChange={currentData.setCalibration}
                          inspectionSetup={currentData.inspectionSetup}
                          acceptanceClass={currentData.acceptanceCriteria.acceptanceClass}
                          standard={standard}
                        />
                      </TabsContent>

                      <TabsContent value="acceptance" className="m-0">
                        <AcceptanceCriteriaTab
                          data={currentData.acceptanceCriteria}
                          onChange={currentData.setAcceptanceCriteria}
                          material={currentData.inspectionSetup.materialSpec || currentData.inspectionSetup.material}
                          standard={standard}
                        />
                      </TabsContent>

                      <TabsContent value="docs" className="m-0">
                        <DocumentationTab
                          data={currentData.documentation}
                          onChange={currentData.setDocumentation}
                        />
                      </TabsContent>

                      {isPwNdip && (
                        <TabsContent value="ndip-reference" className="m-0">
                          <NdipReferenceTab standard={standard} />
                        </TabsContent>
                      )}

                      <TabsContent value="scanplan" className="m-0">
                        <ScanPlanTab
                          data={currentData.scanPlan}
                          onChange={currentData.setScanPlan}
                        />
                      </TabsContent>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="app-panel workbench-surface rounded-[1.5rem]">
                      <TabsContent value="cover" className="m-0">
                        <CoverPageTab
                          data={inspectionReport}
                          onChange={(data) => setInspectionReport({ ...inspectionReport, ...data })}
                        />
                      </TabsContent>

                      <TabsContent value="equipment-report" className="m-0">
                        <EquipmentDetailsTab
                          data={inspectionReport.equipmentDetails}
                          onChange={(equipmentDetails) => setInspectionReport({ ...inspectionReport, equipmentDetails })}
                        />
                      </TabsContent>

                      <TabsContent value="diagram" className="m-0">
                        <PartDiagramTab
                          partDiagramImage={inspectionReport.partDiagramImage}
                          onChange={(image) => setInspectionReport({ ...inspectionReport, partDiagramImage: image })}
                          standardType={standard}
                          partNumber={inspectionSetup.partNumber}
                          partType={inspectionSetup.partType}
                          thickness={inspectionSetup.partThickness.toString()}
                          diameter={inspectionSetup.diameter?.toString()}
                          length={inspectionSetup.partLength.toString()}
                        />
                      </TabsContent>

                      <TabsContent value="indications" className="m-0">
                        <IndicationsTab
                          indications={inspectionReport.indications}
                          onChange={(indications) => setInspectionReport({ ...inspectionReport, indications })}
                        />
                      </TabsContent>

                      <TabsContent value="probe" className="m-0">
                        <ProbeDetailsTab
                          probeDetails={inspectionReport.probeDetails}
                          onChange={(probes) => setInspectionReport({ ...inspectionReport, probeDetails: probes })}
                        />
                      </TabsContent>

                      <TabsContent value="scans" className="m-0">
                        <ScansTab
                          scans={inspectionReport.scans}
                          onChange={(scans) => setInspectionReport({ ...inspectionReport, scans })}
                        />
                      </TabsContent>

                      <TabsContent value="results" className="m-0">
                        <ResultsSummaryTab
                          resultsSummary={inspectionReport.resultsSummary}
                          applicableDocuments={inspectionReport.applicableDocuments}
                          onResultsChange={(resultsSummary) => setInspectionReport({ ...inspectionReport, resultsSummary })}
                          onDocumentsChange={(applicableDocuments) => setInspectionReport({ ...inspectionReport, applicableDocuments })}
                        />
                      </TabsContent>

                      <TabsContent value="certification" className="m-0">
                        <InspectorCertificationTab
                          inspectorCertification={inspectionReport.inspectorCertification}
                          signatures={inspectionReport.signatures}
                          onCertificationChange={(inspectorCertification) => setInspectionReport({ ...inspectionReport, inspectorCertification })}
                          onSignaturesChange={(signatures) => setInspectionReport({ ...inspectionReport, signatures })}
                        />
                      </TabsContent>

                      <TabsContent value="aerospace" className="m-0">
                        <AerospaceForgingTab
                          testLocationTiming={inspectionReport.testLocationTiming}
                          environmentalConditions={inspectionReport.environmentalConditions}
                          couplantDetails={inspectionReport.couplantDetails}
                          forgingDetails={inspectionReport.forgingDetails}
                          sensitivitySettings={inspectionReport.sensitivitySettings}
                          transferCorrection={inspectionReport.transferCorrection}
                          bweMonitoring={inspectionReport.bweMonitoring}
                          scanCoverage={inspectionReport.scanCoverage}
                          zoningRequirements={inspectionReport.zoningRequirements}
                          onTestLocationChange={(testLocationTiming) => setInspectionReport({ ...inspectionReport, testLocationTiming })}
                          onEnvironmentalChange={(environmentalConditions) => setInspectionReport({ ...inspectionReport, environmentalConditions })}
                          onCouplantChange={(couplantDetails) => setInspectionReport({ ...inspectionReport, couplantDetails })}
                          onForgingChange={(forgingDetails) => setInspectionReport({ ...inspectionReport, forgingDetails })}
                          onSensitivityChange={(sensitivitySettings) => setInspectionReport({ ...inspectionReport, sensitivitySettings })}
                          onTransferChange={(transferCorrection) => setInspectionReport({ ...inspectionReport, transferCorrection })}
                          onBweChange={(bweMonitoring) => setInspectionReport({ ...inspectionReport, bweMonitoring })}
                          onScanCoverageChange={(scanCoverage) => setInspectionReport({ ...inspectionReport, scanCoverage })}
                          onZoningChange={(zoningRequirements) => setInspectionReport({ ...inspectionReport, zoningRequirements })}
                        />
                      </TabsContent>

                      <TabsContent value="remarks" className="m-0">
                        <RemarksTab
                          remarks={inspectionReport.remarks}
                          onChange={(remarks) => setInspectionReport({ ...inspectionReport, remarks })}
                        />
                      </TabsContent>
                    </div>
                  </>
                )}
            </div>
          </Tabs>

          {/* 3D Viewer Panel */}
          {(activeTab === "setup" || (typeof localStorage !== "undefined" && localStorage.getItem("viewer3DFloating") === "true")) && (
            <div className={localStorage.getItem("viewer3DFloating") === "true" ? "" : "hidden lg:block px-3 pb-3"}>
              <Collapsible3DPanel
                title="3D Part Viewer"
                isOpen={viewer3DOpen}
                onToggle={() => setViewer3DOpen(!viewer3DOpen)}
              >
                <ThreeDViewer
                  partType={currentData.inspectionSetup.partType || ""}
                  material={currentData.inspectionSetup.material as MaterialType || ""}
                  standardType={standard}
                  partNumber={currentData.inspectionSetup.partNumber}
                  externalModelAssetName={currentData.inspectionSetup.localModelAssetName}
                  dimensions={{
                    length: currentData.inspectionSetup.partLength || 100,
                    width: currentData.inspectionSetup.partWidth || 50,
                    thickness: currentData.inspectionSetup.partThickness || 10,
                    diameter: currentData.inspectionSetup.diameter || 50,
                    isHollow: currentData.inspectionSetup.isHollow,
                    innerDiameter: currentData.inspectionSetup.innerDiameter,
                    innerLength: currentData.inspectionSetup.innerLength,
                    innerWidth: currentData.inspectionSetup.innerWidth,
                    wallThickness: currentData.inspectionSetup.wallThickness,
                    coneTopDiameter: currentData.inspectionSetup.coneTopDiameter,
                    coneBottomDiameter: currentData.inspectionSetup.coneBottomDiameter,
                    coneHeight: currentData.inspectionSetup.coneHeight,
                  }}
                />
              </Collapsible3DPanel>
            </div>
          )}
        </div>
      </div>

      {/* Status Bar */}
      <StatusBar
        completionPercent={completionPercent}
        requiredFieldsComplete={completedFieldsCount}
        totalRequiredFields={reportMode === "Technique" ? 50 : 40}
        autoSaveStatus={persistence.autoSaveStatus}
        lastSaved={persistence.lastSaved}
      />

      {/* Export Dialog */}
      <UnifiedExportDialog
        open={exportDialogOpen}
        onOpenChange={setExportDialogOpen}
        standard={standard}
        inspectionSetup={isSplitMode && activePart === "B" ? inspectionSetupB : inspectionSetup}
        equipment={isSplitMode && activePart === "B" ? equipmentB : equipment}
        calibration={isSplitMode && activePart === "B" ? calibrationB : calibration}
        scanParameters={isSplitMode && activePart === "B" ? scanParametersB : scanParameters}
        acceptanceCriteria={isSplitMode && activePart === "B" ? acceptanceCriteriaB : acceptanceCriteria}
        documentation={isSplitMode && activePart === "B" ? documentationB : documentation}
        inspectionReport={inspectionReport}
        scanDetails={isSplitMode && activePart === "B" ? scanDetailsB : scanDetails}
        scanPlan={isSplitMode && activePart === "B" ? sheetState.scanPlanB : sheetState.scanPlan}
        capturedDrawing={exportWorkflow.capturedDrawing}
        calibrationBlockDiagram={exportWorkflow.calibrationBlockDiagram}
        angleBeamDiagram={
          requiresAngleBeam(
            isSplitMode && activePart === "B" ? inspectionSetupB.partType : inspectionSetup.partType,
            isSplitMode && activePart === "B" ? inspectionSetupB.isHollow : inspectionSetup.isHollow,
          ) ? exportWorkflow.angleBeamDiagram : undefined
        }
        e2375Diagram={exportWorkflow.e2375Diagram}
        scanDirectionsDrawing={exportWorkflow.capturedScanDirections}
        reportMode={reportMode}
        onExport={(format, template) => {
          toast.success(`Exported ${template.toUpperCase()} as ${format.toUpperCase()} successfully!`);
        }}
      />

      {/* Diagnostics Export Dialog */}
      <DiagnosticsExportDialog
        open={diagnosticsDialogOpen}
        onOpenChange={setDiagnosticsDialogOpen}
      />

      {/* Self-Diagnostic Panel */}
      <SelfDiagnosticPanel
        open={diagnosticsPanelOpen}
        onOpenChange={setDiagnosticsPanelOpen}
      />

      {/* Offline Update Dialog (USB) */}
      <OfflineUpdateDialog
        open={offlineUpdateDialogOpen}
        onOpenChange={setOfflineUpdateDialogOpen}
      />

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
              placeholder="e.g., AMS-STD-2154E - Part 123"
              autoFocus
            />
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => persistence.setIsSaveDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveDialogConfirm} disabled={!persistence.sheetNameInput.trim() || persistence.isSavingSheet}>
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
              Scan Master restored the in-progress card that was open before the app restarted to install an update.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-3 text-sm">
            <div>
              <span className="font-medium">Card:</span>{" "}
              {updateRecoveryNotice?.cardName || "Unsaved card"}
            </div>
            <div>
              <span className="font-medium">Recovered:</span>{" "}
              {updateRecoveryNotice?.savedAt ? new Date(updateRecoveryNotice.savedAt).toLocaleString() : "Just now"}
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
            <Button onClick={handleKeepRecoveredProgress}>
              Continue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={unsavedCloseDialogOpen} onOpenChange={setUnsavedCloseDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Save your latest changes before closing?</DialogTitle>
            <DialogDescription>
              You made updates to this card that have not been saved yet. We can save them into the current card before Scan Master closes.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
            Current card: {persistence.currentSheetName || currentData.inspectionSetup.partName || currentData.inspectionSetup.partNumber || "Unsaved card"}
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setUnsavedCloseDialogOpen(false)} disabled={isClosingAfterSave}>
              Cancel
            </Button>
            <Button variant="secondary" onClick={() => void continueClosing()} disabled={isClosingAfterSave}>
              Close Without Saving
            </Button>
            <Button onClick={() => void handleSaveAndClose()} disabled={isClosingAfterSave}>
              {isClosingAfterSave && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save and Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={quickFillDialogOpen} onOpenChange={setQuickFillDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>QA Presets</DialogTitle>
            <DialogDescription>
              One-click QA cards for every supported geometry, with complete scan, plan, and report data.
            </DialogDescription>
          </DialogHeader>
          {renderQuickFillPanel(true)}
        </DialogContent>
      </Dialog>

      <Dialog open={persistence.isSavedCardsDialogOpen} onOpenChange={persistence.setIsSavedCardsDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Saved cards</DialogTitle>
            <DialogDescription>Select a card to continue or manage previously saved work.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
            {persistence.isLoadingSheets ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading saved cards...
              </div>
            ) : persistence.savedSheets.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No cards saved yet. Use the Save action after naming your project to store your progress.
              </p>
            ) : (
              persistence.savedSheets.map((sheet) => (
                <div key={sheet.id} className="flex flex-col gap-3 rounded-lg border border-border bg-card/60 p-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="text-sm font-semibold">{sheet.sheetName}</p>
                    <p className="text-xs text-muted-foreground">
                      {(sheet.standard && `Standard: ${sheet.standard}`) || "Standard not set"} · Updated {new Date(sheet.updatedAt).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {sheet.id === persistence.currentSheetId && (
                      <span className="text-xs font-medium text-primary">Current</span>
                    )}
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => handleLoadSavedSheet(sheet.id)}
                      disabled={persistence.loadingSheetId === sheet.id}
                    >
                      {persistence.loadingSheetId === sheet.id && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Load
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => persistence.handleDeleteSheet(sheet.id)}
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
    </StandardProvider>
  );
};

export default Index;
