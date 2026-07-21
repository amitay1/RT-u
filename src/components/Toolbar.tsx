import React, { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Save,
  CheckCircle,
  Settings,
  RefreshCw,
  FileDown,
  FolderOpen,
  Minus,
  Square,
  X,
  Download,
  Rocket,
  Film,
  Camera,
  Droplets,
  ScanLine,
  FilePlus2,
  KeyRound,
} from "lucide-react";
import { SettingsDialog } from "@/components/SettingsDialog";
import { SavedCardsDialog } from "@/components/SavedCardsDialog";
import { ProfileIndicator } from "@/components/inspector";
import { useSavedCards } from "@/hooks/useSavedCards";
import type { SavedCard } from "@/contexts/SavedCardsContext";
import { RT_PT_METHOD_LABEL, type RtPtMethod } from "@/types/rtPtDocument";
import { RtPtLicenseCenterDialog } from "@/components/rtpt/RtPtLicenseCenterDialog";
import { useRtPtLicense } from "@/contexts/RtPtLicenseContext";

type UpdateStatusPayload = {
  status: UpdateState | 'downloaded' | 'not-available';
  version?: string;
  percent?: number;
};

type ElectronBridge = {
  checkForUpdates?: () => Promise<unknown> | void;
  forceCheckUpdates?: () => Promise<unknown> | void;
  getUpdateInfo?: () => Promise<{
    updateDownloaded?: boolean;
    updateAvailable?: boolean;
    updateVersion?: string;
  }>;
  installUpdate?: (silent?: boolean) => Promise<unknown> | void;
  onUpdateStatus?: (callback: (event: unknown, status: UpdateStatusPayload) => void) => void;
  removeUpdateListener?: (callback: (event: unknown, status: UpdateStatusPayload) => void) => void;
  minimize?: () => Promise<unknown> | void;
  maximize?: () => Promise<unknown> | void;
  quit?: () => Promise<unknown> | void;
  offlineUpdate?: object;
};

type ElectronWindow = Window & {
  electron?: ElectronBridge;
  electronAPI?: ElectronBridge;
};

// Safe access to electron API
const getElectron = (): ElectronBridge | undefined => {
  if (typeof window === 'undefined') {
    return undefined;
  }
  const electronWindow = window as ElectronWindow;
  return electronWindow.electron || electronWindow.electronAPI;
};

type UpdateState = 'idle' | 'checking' | 'available' | 'downloading' | 'ready' | 'error';

function useUpdateStatus() {
  const [state, setState] = useState<UpdateState>('idle');
  const [version, setVersion] = useState<string | null>(null);
  const [percent, setPercent] = useState(0);

  useEffect(() => {
    const electron = getElectron();
    if (!electron?.onUpdateStatus) return;

    const handler = (_event: unknown, status: UpdateStatusPayload) => {
      switch (status.status) {
        case 'checking':
          setState('checking');
          break;
        case 'available':
          setState('available');
          if (status.version) setVersion(status.version);
          break;
        case 'downloading':
          setState('downloading');
          setPercent(Math.round(status.percent || 0));
          break;
        case 'downloaded':
          setState('ready');
          if (status.version) setVersion(status.version);
          break;
        case 'not-available':
          setState('idle');
          break;
        case 'error':
          setState('error');
          break;
      }
    };

    electron.onUpdateStatus(handler);

    // Check if update was already downloaded
    electron.getUpdateInfo?.().then((info) => {
      if (info?.updateDownloaded && info.updateVersion) {
        setState('ready');
        setVersion(info.updateVersion);
      } else if (info?.updateAvailable && info.updateVersion) {
        setState('available');
        setVersion(info.updateVersion);
      }
    });

    return () => {
      electron.removeUpdateListener?.(handler);
    };
  }, []);

  const checkForUpdates = useCallback(() => {
    const electron = getElectron();
    if (electron?.forceCheckUpdates) {
      electron.forceCheckUpdates();
    } else if (electron?.checkForUpdates) {
      electron.checkForUpdates();
    }
    setState('checking');
  }, []);

  const installUpdate = useCallback(() => {
    getElectron()?.installUpdate?.(true);
  }, []);

  return { state, version, percent, checkForUpdates, installUpdate };
}

interface ToolbarProps {
  onNew: () => void;
  onSave: () => void;
  onExport: () => void;
  onValidate: () => void;
  ndtMethod: RtPtMethod;
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
  onExport,
  onValidate,
  ndtMethod,
  onLoadLocalCard,
  onOfflineUpdate,
}: ToolbarProps) => {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [licenseCenterOpen, setLicenseCenterOpen] = useState(false);
  const [localSavedCardsOpen, setLocalSavedCardsOpen] = useState(false);
  const { cards } = useSavedCards();
  const { state: updateState, version: updateVersion, percent: updatePercent, checkForUpdates, installUpdate } = useUpdateStatus();
  const electron = getElectron();
  const { status: licenseStatus } = useRtPtLicense();
  const hasWindowControls = Boolean(electron?.minimize || electron?.maximize || electron?.quit);
  const hasUpdateControls = Boolean(electron?.forceCheckUpdates || electron?.checkForUpdates);
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
        <div className="hidden min-w-fit items-center gap-3 xl:flex">
          <div className="workbench-brand-mark h-10 w-10">
            <ScanLine className="h-5 w-5" />
          </div>
          <div className="leading-tight">
            <div className="text-sm font-semibold tracking-tight">RT-PT Inspector</div>
            <div className="mt-0.5 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Technique workstation</div>
          </div>
        </div>

        <div className="workbench-group hidden min-w-fit items-center gap-2 px-3 py-2 sm:flex" aria-label={`Current method: ${RT_PT_METHOD_LABEL[ndtMethod]}`}>
          <MethodIcon className="h-4 w-4 text-primary" />
          <div className="leading-tight">
            <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Current method</div>
            <div className="mt-0.5 text-sm font-semibold">{RT_PT_METHOD_LABEL[ndtMethod]}</div>
          </div>
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
          <Button size="sm" onClick={onExport} title="Export PDF" className="h-10 px-3.5">
            <FileDown className="h-4 w-4" />
            <span className="hidden sm:inline">Export PDF</span>
          </Button>
        </div>

        <div className="min-w-1 flex-1" />

        <div className="hidden 2xl:block">
          <ProfileIndicator variant="compact" className="border-border/70 bg-muted/30 shadow-none hover:bg-muted/50" />
        </div>

        <div className="workbench-group ml-auto flex min-w-fit items-center gap-1 p-1 md:ml-0">
          {hasUpdateControls && (updateState === 'ready' ? (
            <Button variant="ghost" size="sm" title={`Install Update v${updateVersion}`} className="h-10 border border-success/30 bg-success/10 px-3 text-success hover:bg-success/20" onClick={installUpdate}>
              <Rocket className="h-4 w-4" />
              <span className="hidden xl:inline">Install v{updateVersion}</span>
            </Button>
          ) : updateState === 'downloading' ? (
            <Button variant="ghost" size="sm" title={`Downloading update: ${updatePercent}%`} className="h-10 px-3 text-primary" disabled>
              <Download className="h-4 w-4" />
              <span>{updatePercent}%</span>
            </Button>
          ) : updateState === 'available' ? (
            <Button variant="ghost" size="sm" title={`Update v${updateVersion} is downloading`} className="h-10 px-3 text-warning" disabled>
              <Download className="h-4 w-4" />
              <span className="hidden xl:inline">v{updateVersion}</span>
            </Button>
          ) : (
            <Button variant="ghost" size="icon" title="Check for updates" aria-label="Check for updates" className="h-10 w-10" onClick={checkForUpdates} disabled={updateState === 'checking'}>
              <RefreshCw className={`h-4 w-4 ${updateState === 'checking' ? 'animate-spin' : ''}`} />
            </Button>
          ))}

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
