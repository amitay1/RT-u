import React, { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  FileText,
  Save,
  CheckCircle,
  FileSearch,
  Settings,
  RefreshCw,
  FileDown,
  FolderOpen,
  FlaskConical,
  Minus,
  Square,
  X,
  Download,
  Rocket
} from "lucide-react";
import { SettingsDialog } from "@/components/SettingsDialog";
import { SavedCardsDialog } from "@/components/SavedCardsDialog";
import { ProfileIndicator } from "@/components/inspector";
import { useSavedCards } from "@/hooks/useSavedCards";
import type { SavedCard } from "@/contexts/SavedCardsContext";
import { CurrentShapeHeader } from "@/components/CurrentShapeHeader";
import type { PartGeometry } from "@/types/techniqueSheet";

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
      if (info?.updateDownloaded) {
        setState('ready');
        setVersion(info.updateVersion);
      } else if (info?.updateAvailable) {
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
  onSave: () => void;
  onExport: () => void;
  onValidate: () => void;
  reportMode: "Technique" | "Report";
  onReportModeChange: (mode: "Technique" | "Report") => void;
  isSplitMode?: boolean;
  onSplitModeChange?: (value: boolean) => void;
  activePart?: "A" | "B";
  onActivePartChange?: (value: "A" | "B") => void;
  onCopyAToB?: () => void;
  onOpenSavedCards?: () => void;
  onLoadLocalCard?: (card: SavedCard) => void;
  onOpenQuickFill?: () => void;
  partType?: PartGeometry | "";
}

// Re-export SavedCard type for consumers
export type { SavedCard } from '@/contexts/SavedCardsContext';

export const Toolbar = ({
  onSave,
  onExport,
  onValidate,
  reportMode,
  onReportModeChange,
  isSplitMode = false,
  onSplitModeChange,
  activePart = "A",
  onActivePartChange,
  onCopyAToB,
  onOpenSavedCards,
  onLoadLocalCard,
  onOpenQuickFill,
  partType
}: ToolbarProps) => {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [localSavedCardsOpen, setLocalSavedCardsOpen] = useState(false);
  const { cards } = useSavedCards();
  const { state: updateState, version: updateVersion, percent: updatePercent, checkForUpdates, installUpdate } = useUpdateStatus();
  const electron = getElectron();
  const hasWindowControls = Boolean(electron?.minimize || electron?.maximize || electron?.quit);
  
  return (
    <div className="workbench-toolbar flex min-h-14 flex-shrink-0 flex-wrap items-center gap-2 overflow-visible px-2 py-1.5 md:h-16 md:min-h-16 md:flex-nowrap md:gap-3 md:overflow-x-auto md:overflow-y-hidden md:px-4">
      <div className="flex min-w-0 items-center gap-1 rounded-2xl border border-border/80 bg-black/10 px-1.5 py-1.5 backdrop-blur-xl md:gap-2 md:px-2">
        <Button variant="ghost" size="icon" onClick={onSave} title="Save" className="h-10 w-10 rounded-xl border border-transparent hover:border-primary/25 hover:bg-primary/10">
          <Save className="h-5 w-5 md:h-5 md:w-5" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onExport}
          title="Export PDF"
          className="h-10 rounded-xl border border-primary/25 bg-primary/12 px-3 text-sm font-semibold text-primary hover:bg-primary/18 md:px-4 md:text-base"
        >
          <FileDown className="h-5 w-5 md:h-5 md:w-5 md:mr-2" />
          <span className="hidden sm:inline">Export</span>
        </Button>

        {onOpenQuickFill && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onOpenQuickFill}
            title="Open QA Presets"
            className="flex h-10 rounded-xl border border-cyan-400/20 px-3 text-sm font-semibold text-cyan-300 hover:bg-cyan-500/10 hover:text-cyan-200"
          >
            <FlaskConical className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">QA Presets</span>
          </Button>
        )}
      </div>

      <div className="flex min-w-0 gap-1 rounded-2xl border border-border/80 bg-black/10 p-1.5 backdrop-blur-xl">
        <Button
          variant={reportMode === "Technique" ? "secondary" : "ghost"}
          size="sm"
          onClick={() => onReportModeChange("Technique")}
          className="h-9 md:h-10 rounded-xl text-sm md:text-base font-semibold px-3 data-[state=active]:shadow-none"
        >
          <FileText className="h-4 w-4 md:mr-2" />
          <span className="hidden sm:inline">Technique</span>
        </Button>
        <Button
          variant={reportMode === "Report" ? "secondary" : "ghost"}
          size="sm"
          onClick={() => onReportModeChange("Report")}
          className="h-9 md:h-10 rounded-xl text-sm md:text-base font-semibold px-3 data-[state=active]:shadow-none"
        >
          <FileSearch className="h-4 w-4 md:mr-2" />
          <span className="hidden sm:inline">Report</span>
        </Button>

        <Separator orientation="vertical" className="mx-1 hidden h-7 bg-border/70 sm:block" />

        <Button
          variant="ghost"
          size="icon"
          title="Settings"
          className="h-9 w-9 rounded-xl border border-transparent hover:border-primary/25 hover:bg-primary/10 md:h-10 md:w-10"
          onClick={() => setSettingsOpen(true)}
        >
          <Settings className="h-4 w-4 md:h-5 md:w-5" />
        </Button>
      </div>

      <div className="hidden min-w-2 flex-1 md:block" />

      <div className="hidden xl:flex items-center gap-2 rounded-2xl border border-border/80 bg-black/10 px-2 py-1.5 backdrop-blur-xl">
        <CurrentShapeHeader partType={partType || ""} className="max-w-[190px]" />
        <Separator orientation="vertical" className="h-7 bg-border/70" />
        <ProfileIndicator variant="compact" className="border-0 bg-transparent px-1 shadow-none hover:bg-white/5" />
      </div>

      {/* Update Button - always visible, changes based on update state */}
      <div className="ml-auto flex items-center gap-1 rounded-2xl border border-border/80 bg-black/10 px-1.5 py-1.5 backdrop-blur-xl md:ml-0 md:gap-2 md:px-2">
        {updateState === 'ready' ? (
          <Button
            variant="ghost"
            size="sm"
            title={`Install Update v${updateVersion} - Click to update now`}
            className="h-10 rounded-xl border border-green-400/20 px-3 md:px-4 flex items-center bg-green-500/20 hover:bg-green-500/30 text-green-400 font-semibold animate-pulse"
            onClick={installUpdate}
          >
            <Rocket className="h-5 w-5 mr-2" />
            <span>Update v{updateVersion}</span>
          </Button>
        ) : updateState === 'downloading' ? (
          <Button
            variant="ghost"
            size="sm"
            title={`Downloading update... ${updatePercent}%`}
            className="h-10 rounded-xl border border-blue-400/20 px-3 md:px-4 flex items-center bg-blue-500/20 text-blue-400 font-semibold cursor-default"
            disabled
          >
            <Download className="h-5 w-5 mr-2 animate-bounce" />
            <span>{updatePercent}%</span>
          </Button>
        ) : updateState === 'available' ? (
          <Button
            variant="ghost"
            size="sm"
            title={`Update v${updateVersion} available - downloading...`}
            className="h-10 rounded-xl border border-yellow-400/20 px-3 md:px-4 flex items-center bg-yellow-500/20 text-yellow-400 font-semibold"
            disabled
          >
            <Download className="h-5 w-5 mr-2 animate-spin" />
            <span>v{updateVersion}</span>
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="icon"
            title="Check for Updates"
            className={`h-10 w-10 rounded-xl border border-transparent hover:border-primary/25 hover:bg-primary/10 ${updateState === 'checking' ? 'animate-spin' : ''}`}
            onClick={checkForUpdates}
            disabled={updateState === 'checking'}
          >
            <RefreshCw className="h-5 w-5" />
          </Button>
        )}

        <Button
          variant="ghost"
          size="icon"
          title="Local Saved Cards"
          className="relative h-10 w-10 rounded-xl border border-transparent hover:border-primary/25 hover:bg-primary/10"
          onClick={() => setLocalSavedCardsOpen(true)}
        >
          <FolderOpen className="h-5 w-5 md:h-5 md:w-5" />
          {cards.length > 0 && (
            <span className="absolute -top-1 -right-1 h-5 w-5 bg-blue-500 text-white text-xs rounded-full flex items-center justify-center font-bold">
              {cards.length}
            </span>
          )}
        </Button>

      </div>

      <SettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
      />
      
      {/* Local Saved Cards Dialog */}
      <SavedCardsDialog
        open={localSavedCardsOpen}
        onOpenChange={setLocalSavedCardsOpen}
        onLoadCard={(card) => {
          if (onLoadLocalCard) {
            onLoadLocalCard(card);
          }
          setLocalSavedCardsOpen(false);
        }}
      />

      {/* Window Controls Group */}
      {hasWindowControls && (
        <div className="hidden items-center gap-1 rounded-xl border border-slate-700/50 bg-slate-900/60 p-1 shadow-lg shadow-black/20 md:flex">
          {/* Minimize */}
          <button
            title="Minimize"
            className="group relative flex h-9 w-9 items-center justify-center rounded-lg transition-all duration-200 hover:bg-amber-500/90 hover:shadow-md hover:shadow-amber-500/25 active:scale-90"
            onClick={() => {
              getElectron()?.minimize?.();
            }}
          >
            <Minus className="h-4 w-4 text-amber-400 transition-colors group-hover:text-white" strokeWidth={2.5} />
          </button>

          {/* Maximize / Restore */}
          <button
            title="Maximize / Restore"
            className="group relative flex h-9 w-9 items-center justify-center rounded-lg transition-all duration-200 hover:bg-blue-500/90 hover:shadow-md hover:shadow-blue-500/25 active:scale-90"
            onClick={() => {
              getElectron()?.maximize?.();
            }}
          >
            <Square className="h-3.5 w-3.5 text-blue-400 transition-colors group-hover:text-white" strokeWidth={2.5} />
          </button>

          {/* Close */}
          <button
            title="Exit Application"
            className="group relative flex h-9 w-9 items-center justify-center rounded-lg transition-all duration-200 hover:bg-red-500/90 hover:shadow-md hover:shadow-red-500/25 active:scale-90"
            onClick={() => {
              const electronApi = getElectron();
              if (electronApi?.quit) {
                void electronApi.quit();
              } else {
                window.close();
              }
            }}
          >
            <X className="h-4 w-4 text-red-400 transition-colors group-hover:text-white" strokeWidth={2.5} />
          </button>
        </div>
      )}
    </div>
  );
};
