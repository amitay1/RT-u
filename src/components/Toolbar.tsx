import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Save,
  CheckCircle,
  Settings,
  FileDown,
  FileText,
  ClipboardCheck,
  ClipboardList,
  FolderOpen,
  Minus,
  Square,
  X,
  Film,
  Camera,
  Droplets,
  FilePlus2,
  KeyRound,
  Loader2,
} from "lucide-react";
import { SettingsDialog } from "@/components/SettingsDialog";
import { UpdateCenter } from "@/components/updates/UpdateCenter";
import { SavedCardsDialog } from "@/components/SavedCardsDialog";
import { ProfileIndicator } from "@/components/inspector";
import { useSavedCards } from "@/hooks/useSavedCards";
import type { SavedCard } from "@/contexts/SavedCardsContext";
import { RT_PT_METHOD_LABEL, type RtPtMethod } from "@/types/rtPtDocument";
import { RtPtLicenseCenterDialog } from "@/components/rtpt/RtPtLicenseCenterDialog";
import { RonexBrandMark } from "@/components/rtpt/RonexBrandMark";
import { useRtPtLicense } from "@/contexts/RtPtLicenseContext";

type ElectronBridge = {
  minimize?: () => Promise<unknown> | void;
  maximize?: () => Promise<unknown> | void;
  quit?: () => Promise<unknown> | void;
  offlineUpdate?: object;
};

type ElectronWindow = Window & {
  electron?: ElectronBridge;
  electronAPI?: ElectronBridge;
};

// Safe access to electron API (window controls + offline-update availability).
// All auto-update state lives in <UpdateCenter /> via the useAppUpdates hook.
const getElectron = (): ElectronBridge | undefined => {
  if (typeof window === 'undefined') {
    return undefined;
  }
  const electronWindow = window as ElectronWindow;
  return electronWindow.electron || electronWindow.electronAPI;
};

interface ToolbarProps {
  onNew: () => void;
  onSave: () => void;
  onExportTechnique: () => void;
  onExportInspectionReport: () => void;
  isExportingTechnique?: boolean;
  isExportingInspectionReport?: boolean;
  onValidate: () => void;
  ndtMethod: RtPtMethod;
  workspaceMode: "technique" | "inspection";
  onWorkspaceModeChange: (mode: "technique" | "inspection") => void;
  onLoadLocalCard?: (card: SavedCard) => void;
  onOfflineUpdate?: () => void;
}

const METHOD_ICONS: Record<RtPtMethod, typeof Film> = {
  "RT-Film": Film,
  "RT-Digital": Camera,
  PT: Droplets,
};

// Re-export SavedCard type for consumers
export type { SavedCard } from '@/contexts/SavedCardsContext';

export const Toolbar = ({
  onNew,
  onSave,
  onExportTechnique,
  onExportInspectionReport,
  isExportingTechnique = false,
  isExportingInspectionReport = false,
  onValidate,
  ndtMethod,
  workspaceMode,
  onWorkspaceModeChange,
  onLoadLocalCard,
  onOfflineUpdate,
}: ToolbarProps) => {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [licenseCenterOpen, setLicenseCenterOpen] = useState(false);
  const [localSavedCardsOpen, setLocalSavedCardsOpen] = useState(false);
  const { cards } = useSavedCards();
  const electron = getElectron();
  const { status: licenseStatus } = useRtPtLicense();
  const hasWindowControls = Boolean(electron?.minimize || electron?.maximize || electron?.quit);
  const MethodIcon = METHOD_ICONS[ndtMethod];
  const licenseExpiryTimestamp = licenseStatus.license?.expiresAt
    ? Date.parse(licenseStatus.license.expiresAt)
    : null;
  const licenseDaysRemaining = licenseExpiryTimestamp === null || !Number.isFinite(licenseExpiryTimestamp)
    ? null
    : Math.max(0, Math.ceil((licenseExpiryTimestamp - Date.now()) / 86_400_000));
  const licenseAvailabilityLabel = licenseDaysRemaining === null
    ? "Perpetual workstation license"
    : licenseDaysRemaining === 0
      ? "Workstation license expires today"
      : `Workstation license expires in ${licenseDaysRemaining} day${licenseDaysRemaining === 1 ? "" : "s"}`;
  const licenseIndicatorClass = licenseDaysRemaining !== null && licenseDaysRemaining <= 7
    ? "bg-destructive"
    : licenseDaysRemaining !== null && licenseDaysRemaining <= 30
      ? "bg-warning"
      : "bg-success";
  
  return (
    <>
      <header className="workbench-toolbar z-30 flex min-h-16 flex-shrink-0 items-center gap-2 overflow-x-auto px-2 py-2 md:gap-3 md:px-3 xl:px-4">
        <RonexBrandMark className="hidden md:flex" />

        <div className="workbench-group hidden min-w-fit items-center gap-2 px-3 py-2 sm:flex" aria-label={`Current method: ${RT_PT_METHOD_LABEL[ndtMethod]}`}>
          <MethodIcon className="h-4 w-4 text-primary" />
          <div className="leading-tight">
            <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Current method</div>
            <div className="mt-0.5 text-sm font-semibold">{RT_PT_METHOD_LABEL[ndtMethod]}</div>
          </div>
        </div>

        <div className="workbench-group flex min-w-fit items-center gap-1 p-1" aria-label="Workspace mode">
          <Button
            variant={workspaceMode === "technique" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => onWorkspaceModeChange("technique")}
            aria-pressed={workspaceMode === "technique"}
            title="Technique planning workspace"
            className="h-10 px-3"
          >
            <FileText className="h-4 w-4" />
            <span className="hidden 2xl:inline">Technique</span>
          </Button>
          <Button
            variant={workspaceMode === "inspection" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => onWorkspaceModeChange("inspection")}
            aria-pressed={workspaceMode === "inspection"}
            title="Performed inspection record workspace"
            className="h-10 px-3"
          >
            <ClipboardList className="h-4 w-4" />
            <span className="hidden 2xl:inline">Inspection Record</span>
          </Button>
        </div>

        <div className="workbench-group flex min-w-fit items-center gap-1 p-1">
          <Button variant="ghost" size="sm" onClick={onNew} title="Start a new technique (Ctrl+N)" aria-label="Start a new technique" className="h-10 px-3">
            <FilePlus2 className="h-4 w-4" />
            <span className="hidden 2xl:inline">New</span>
          </Button>
          <Button variant="ghost" size="sm" onClick={onSave} title="Save card" aria-label="Save card" className="h-10 px-3">
            <Save className="h-4 w-4" />
            <span className="hidden xl:inline">Save</span>
          </Button>
          <Button variant="outline" size="sm" onClick={onValidate} title="Validate required RT/PT fields" className="h-10 border-border/80 bg-transparent px-3">
            <CheckCircle className="h-4 w-4" />
            <span className="hidden md:inline">Validate</span>
          </Button>
          <Button
            variant={workspaceMode === "technique" ? "default" : "outline"}
            size="sm"
            onClick={onExportTechnique}
            disabled={isExportingTechnique || isExportingInspectionReport}
            title={isExportingTechnique ? "Exporting technique PDF" : "Export technique PDF"}
            aria-label={isExportingTechnique ? "Exporting technique PDF" : "Export technique PDF"}
            className="h-10 px-3.5"
          >
            {isExportingTechnique ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
            <span className="hidden xl:inline">{isExportingTechnique ? "Exporting…" : "Technique PDF"}</span>
          </Button>
          <Button
            variant={workspaceMode === "inspection" ? "default" : "outline"}
            size="sm"
            onClick={onExportInspectionReport}
            disabled={isExportingTechnique || isExportingInspectionReport}
            title={isExportingInspectionReport
              ? "Exporting inspection report PDF"
              : workspaceMode === "inspection" ? "Export inspection report PDF" : "Open inspection record before report export"}
            aria-label={isExportingInspectionReport
              ? "Exporting inspection report PDF"
              : workspaceMode === "inspection" ? "Export inspection report PDF" : "Open inspection record before report export"}
            className="h-10 px-3.5"
          >
            {isExportingInspectionReport ? <Loader2 className="h-4 w-4 animate-spin" /> : <ClipboardCheck className="h-4 w-4" />}
            <span className="hidden xl:inline">{isExportingInspectionReport ? "Exporting…" : workspaceMode === "inspection" ? "Report PDF" : "Open Report"}</span>
          </Button>
        </div>

        <div className="min-w-1 flex-1" />

        <div className="hidden 2xl:block">
          <ProfileIndicator variant="compact" className="border-border/70 bg-muted/30 shadow-none hover:bg-muted/50" />
        </div>

        <div className="workbench-group ml-auto flex min-w-fit items-center gap-1 p-1 md:ml-0">
          <UpdateCenter
            onOfflineUpdate={electron?.offlineUpdate && onOfflineUpdate ? onOfflineUpdate : undefined}
          />

          <Button variant="ghost" size="icon" title="Local saved cards" aria-label="Open local saved cards" className="relative h-10 w-10" onClick={() => setLocalSavedCardsOpen(true)}>
            <FolderOpen className="h-4 w-4" />
            {cards.length > 0 && (
              <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 font-mono text-[10px] font-bold leading-none text-primary-foreground">
                {cards.length}
              </span>
            )}
          </Button>

          <Button variant="ghost" size="icon" title="Settings" aria-label="Open settings" className="h-10 w-10" onClick={() => setSettingsOpen(true)}>
            <Settings className="h-4 w-4" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            title={`${licenseAvailabilityLabel}${licenseStatus.license?.customer ? ` — ${licenseStatus.license.customer}` : ""}`}
            aria-label={`Open workstation license center. ${licenseAvailabilityLabel}`}
            className="relative h-10 w-10"
            onClick={() => setLicenseCenterOpen(true)}
          >
            <KeyRound className="h-4 w-4" />
            <span className={`absolute bottom-1 right-1 h-2 w-2 rounded-full border-2 border-card ${licenseIndicatorClass}`} aria-hidden="true" />
          </Button>
        </div>

        {hasWindowControls && (
          <div className="workbench-group hidden min-w-fit items-center gap-0.5 p-1 md:flex" aria-label="Window controls">
            <button title="Minimize" aria-label="Minimize window" className="grid h-9 w-9 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={() => { getElectron()?.minimize?.(); }}>
              <Minus className="h-4 w-4" />
            </button>
            <button title="Maximize / Restore" aria-label="Maximize or restore window" className="grid h-9 w-9 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={() => { getElectron()?.maximize?.(); }}>
              <Square className="h-3.5 w-3.5" />
            </button>
            <button title="Exit Application" aria-label="Close application" className="grid h-9 w-9 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive" onClick={() => {
              const electronApi = getElectron();
              if (electronApi?.quit) void electronApi.quit();
              else window.close();
            }}>
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
      </header>

      <SettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        onOfflineUpdate={electron?.offlineUpdate && onOfflineUpdate
          ? () => {
            setSettingsOpen(false);
            onOfflineUpdate();
          }
          : undefined}
      />
      <RtPtLicenseCenterDialog open={licenseCenterOpen} onOpenChange={setLicenseCenterOpen} />
      <SavedCardsDialog
        open={localSavedCardsOpen}
        onOpenChange={setLocalSavedCardsOpen}
        onLoadCard={(card) => {
          onLoadLocalCard?.(card);
          setLocalSavedCardsOpen(false);
        }}
      />
    </>
  );
};
