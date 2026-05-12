/// <reference types="vite/client" />

// Electron IPC Bridge Types
interface ElectronAPI {
  getAppVersion: () => Promise<string>;
  checkForUpdates: () => Promise<void>;
  forceCheckUpdates?: () => Promise<void>;
  downloadUpdate?: () => Promise<void>;
  installUpdate: (silent?: boolean) => Promise<{ started: boolean }>;
  getUpdateInfo?: () => Promise<{
    updateAvailable?: boolean;
    updateDownloaded?: boolean;
    updateVersion?: string;
    releaseNotes?: unknown;
    releaseDate?: string;
    currentVersion?: string;
  }>;
  openExternal?: (url: string) => Promise<{ success: boolean; error?: string }>;
  onUpdateStatus: (callback: (event: unknown, status: UpdateStatusEvent) => void) => void;
  removeUpdateListener: (callback: (event: unknown, status: UpdateStatusEvent) => void) => void;
  confirmAppClose?: () => Promise<{ success: boolean }>;
  onAppCloseRequested?: (callback: () => void) => void;
  removeAppCloseRequested?: (callback: () => void) => void;
  onPrepareForUpdateInstall?: (callback: (payload: PrepareForUpdateInstallPayload) => void) => void;
  removePrepareForUpdateInstall?: (callback: (payload: PrepareForUpdateInstallPayload) => void) => void;
  confirmUpdateInstallReady?: (requestId: string) => Promise<{ acknowledged: boolean }>;
}

interface UpdateStatusEvent {
  status: 'checking' | 'available' | 'downloading' | 'downloaded' | 'not-available' | 'error';
  version?: string;
  percent?: number;
  error?: string;
}

interface PrepareForUpdateInstallPayload {
  requestId: string;
  reason: 'manual-install' | 'scheduled-restart' | 'update-on-quit';
  version?: string;
}

declare global {
  const __APP_VERSION__: string;

  interface Window {
    electron?: ElectronAPI;
    electronAPI?: ElectronAPI;
  }
}

export {};
