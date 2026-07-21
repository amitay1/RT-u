import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw, RotateCcw, Download, Trash2, ExternalLink } from 'lucide-react';
import type { CrashSnapshot } from '@/hooks/useCrashRecovery';

const LATEST_RELEASE_URL = 'https://github.com/amitay1/RT-u/releases/latest';

type CrashUpdateState = 'idle' | 'checking' | 'available' | 'downloading' | 'downloaded' | 'not-available' | 'error';

interface CrashUpdateStatus {
  status: CrashUpdateState;
  version?: string;
  percent?: number;
  error?: string;
}

interface RecoveryElectronApi {
  checkForUpdates?: () => Promise<unknown>;
  forceCheckUpdates?: () => Promise<unknown>;
  downloadUpdate?: () => Promise<unknown>;
  installUpdate?: (silent?: boolean) => Promise<unknown>;
  getUpdateInfo?: () => Promise<{
    updateAvailable?: boolean;
    updateDownloaded?: boolean;
    updateVersion?: string;
    currentVersion?: string;
  }>;
  onUpdateStatus?: (callback: (event: unknown, status: CrashUpdateStatus) => void) => void;
  removeUpdateListener?: (callback: (event: unknown, status: CrashUpdateStatus) => void) => void;
  openExternal?: (url: string) => Promise<unknown> | void;
}

function getRecoveryElectronApi(): RecoveryElectronApi | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const win = window as Window & {
    electron?: RecoveryElectronApi;
    electronAPI?: RecoveryElectronApi;
  };

  return win.electron || win.electronAPI || null;
}

function openLatestReleasePage() {
  const api = getRecoveryElectronApi();
  const result = api?.openExternal?.(LATEST_RELEASE_URL);

  if (result && typeof (result as Promise<unknown>).catch === 'function') {
    (result as Promise<unknown>).catch(() => {
      window.open(LATEST_RELEASE_URL, '_blank', 'noopener,noreferrer');
    });
    return;
  }

  if (!result) {
    window.open(LATEST_RELEASE_URL, '_blank', 'noopener,noreferrer');
  }
}

interface ErrorRecoveryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recoveryData: CrashSnapshot | null;
  crashCount: number;
  lastCrashTime: string | null;
  onRecover: () => void;
  onDismiss: () => void;
  onExportDiagnostics: () => void;
}

export function ErrorRecoveryDialog({
  open,
  onOpenChange,
  recoveryData,
  crashCount,
  lastCrashTime,
  onRecover,
  onDismiss,
  onExportDiagnostics,
}: ErrorRecoveryDialogProps) {
  const formattedTime = lastCrashTime
    ? new Date(lastCrashTime).toLocaleString()
    : 'Unknown';

  const snapshotTime = recoveryData?.timestamp
    ? new Date(recoveryData.timestamp).toLocaleString()
    : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-full bg-amber-100 dark:bg-amber-900/30">
              <AlertTriangle className="h-6 w-6 text-amber-600 dark:text-amber-500" />
            </div>
            <div>
              <DialogTitle>Recovery Available</DialogTitle>
              <DialogDescription>
                The application was not closed properly
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="bg-muted/50 rounded-lg p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Last crash:</span>
              <span className="font-medium">{formattedTime}</span>
            </div>
            {snapshotTime && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Data saved at:</span>
                <span className="font-medium">{snapshotTime}</span>
              </div>
            )}
            {recoveryData?.activeTab && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Active tab:</span>
                <span className="font-medium">{recoveryData.activeTab}</span>
              </div>
            )}
            {crashCount > 1 && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Total crashes:</span>
                <span className="font-medium text-amber-600">{crashCount}</span>
              </div>
            )}
          </div>

          <p className="text-sm text-muted-foreground">
            We found unsaved data from your previous session. Would you like to restore it?
          </p>

          {crashCount >= 3 && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
              <p className="text-sm text-red-700 dark:text-red-400">
                Multiple crashes detected. Consider exporting diagnostics and contacting support.
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onExportDiagnostics}
            className="w-full sm:w-auto"
          >
            <Download className="h-4 w-4 mr-1" />
            Export Diagnostics
          </Button>

          <div className="flex gap-2 w-full sm:w-auto">
            <Button
              variant="ghost"
              size="sm"
              onClick={onDismiss}
              className="flex-1 sm:flex-none"
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Discard
            </Button>

            <Button
              variant="default"
              size="sm"
              onClick={onRecover}
              className="flex-1 sm:flex-none"
            >
              <RotateCcw className="h-4 w-4 mr-1" />
              Restore Data
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface CrashErrorDialogProps {
  open: boolean;
  error: Error | null;
  componentStack?: string | null;
  onReload: () => void;
  onExportDiagnostics: () => void;
}

export function CrashErrorDialog({
  open,
  error,
  componentStack,
  onReload,
  onExportDiagnostics,
}: CrashErrorDialogProps) {
  const [showDetails, setShowDetails] = React.useState(false);
  const [updateState, setUpdateState] = React.useState<CrashUpdateState>('idle');
  const [updateVersion, setUpdateVersion] = React.useState<string | null>(null);
  const [downloadPercent, setDownloadPercent] = React.useState(0);
  const [updateMessage, setUpdateMessage] = React.useState<string | null>(null);

  React.useEffect(() => {
    const electron = getRecoveryElectronApi();
    if (!electron) {
      setUpdateMessage('Automatic update is unavailable here. Use Download Latest Version.');
      return;
    }

    electron.getUpdateInfo?.()
      .then((info) => {
        if (info?.updateDownloaded) {
          setUpdateState('downloaded');
          setUpdateVersion(info.updateVersion || null);
        } else if (info?.updateAvailable) {
          setUpdateState('available');
          setUpdateVersion(info.updateVersion || null);
        }
      })
      .catch(() => {
        setUpdateMessage('Could not read update status. You can still download the latest installer.');
      });

    const handleUpdateStatus = (_event: unknown, status: CrashUpdateStatus) => {
      setUpdateState(status.status);

      if (status.version) {
        setUpdateVersion(status.version);
      }

      if (typeof status.percent === 'number') {
        setDownloadPercent(Math.round(status.percent));
      }

      if (status.status === 'not-available') {
        setUpdateMessage('No automatic update was found. Download the latest installer if support published a fixed version.');
      } else if (status.status === 'error') {
        setUpdateMessage(status.error || 'Automatic update failed. Download the latest installer manually.');
      } else {
        setUpdateMessage(null);
      }
    };

    electron.onUpdateStatus?.(handleUpdateStatus);

    return () => {
      electron.removeUpdateListener?.(handleUpdateStatus);
    };
  }, []);

  const handleRecoveryUpdate = React.useCallback(async () => {
    const electron = getRecoveryElectronApi();
    if (!electron) {
      openLatestReleasePage();
      return;
    }

    try {
      setUpdateMessage(null);

      if (updateState === 'downloaded') {
        await electron.installUpdate?.(true);
        return;
      }

      if (updateState === 'available') {
        setUpdateState('downloading');
        await electron.downloadUpdate?.();
        return;
      }

      setUpdateState('checking');
      const result = await (electron.forceCheckUpdates?.() || electron.checkForUpdates?.());
      if (result && typeof result === 'object' && 'updateAvailable' in result && !result.updateAvailable) {
        setUpdateState('not-available');
        setUpdateMessage('No automatic update was found. Download the latest installer if support published a fixed version.');
      }
    } catch (updateError) {
      setUpdateState('error');
      setUpdateMessage(updateError instanceof Error ? updateError.message : 'Automatic update failed. Download the latest installer manually.');
    }
  }, [updateState]);

  const updateButtonText = React.useMemo(() => {
    if (updateState === 'checking') return 'Checking for Update...';
    if (updateState === 'downloading') return `Downloading Update ${downloadPercent}%`;
    if (updateState === 'downloaded') return `Install Update${updateVersion ? ` v${updateVersion}` : ''}`;
    if (updateState === 'available') return `Download Update${updateVersion ? ` v${updateVersion}` : ''}`;
    return 'Check for Fixed Version';
  }, [downloadPercent, updateState, updateVersion]);

  const updateButtonDisabled = updateState === 'checking' || updateState === 'downloading';

  return (
    <Dialog open={open}>
      <DialogContent className="sm:max-w-[640px]">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-full bg-red-100 dark:bg-red-900/30">
              <AlertTriangle className="h-6 w-6 text-red-600 dark:text-red-500" />
            </div>
            <div>
              <DialogTitle>Something went wrong</DialogTitle>
              <DialogDescription>
                An unexpected error occurred
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <p className="text-sm font-mono text-red-700 dark:text-red-400 break-all">
              {error?.message || 'Unknown error'}
            </p>
          </div>

          <p className="text-sm text-muted-foreground">
            Your work has been automatically saved. You can try reloading the application
            or export diagnostics to send to support.
          </p>

          <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-900 dark:bg-blue-950/30">
            <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
              If reload does not fix it, install the latest version.
            </p>
            <p className="mt-1 text-sm text-blue-700 dark:text-blue-300">
              This opens a recovery path even when the main application cannot load.
            </p>
            {updateMessage && (
              <p className="mt-2 text-xs text-blue-700 dark:text-blue-300">
                {updateMessage}
              </p>
            )}
          </div>

          {componentStack && (
            <div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowDetails(!showDetails)}
                className="text-xs"
              >
                {showDetails ? 'Hide' : 'Show'} technical details
              </Button>
              {showDetails && (
                <div className="mt-2 bg-muted rounded-lg p-3 max-h-48 overflow-auto">
                  <pre className="text-xs font-mono text-muted-foreground whitespace-pre-wrap">
                    {componentStack}
                  </pre>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onExportDiagnostics}
            className="w-full sm:w-auto"
          >
            <Download className="h-4 w-4 mr-1" />
            Export Diagnostics
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={openLatestReleasePage}
            className="w-full sm:w-auto"
          >
            <ExternalLink className="h-4 w-4 mr-1" />
            Download Latest Version
          </Button>

          <Button
            variant="secondary"
            size="sm"
            onClick={handleRecoveryUpdate}
            disabled={updateButtonDisabled}
            className="w-full sm:w-auto"
          >
            <Download className="h-4 w-4 mr-1" />
            {updateButtonText}
          </Button>

          <Button
            variant="default"
            size="sm"
            onClick={onReload}
            className="w-full sm:w-auto"
          >
            <RefreshCw className="h-4 w-4 mr-1" />
            Reload Application
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default ErrorRecoveryDialog;
