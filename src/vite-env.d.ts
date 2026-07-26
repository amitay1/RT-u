/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_RTPT_SUPABASE_URL?: string;
  readonly VITE_RTPT_SUPABASE_PUBLISHABLE_KEY?: string;
  readonly VITE_RTPT_ENABLE_OFFLINE_MODE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// Electron IPC Bridge Types
type RtPtLicenseStatusName =
  | 'active'
  | 'missing'
  | 'configuration-required'
  | 'storage-unavailable'
  | 'invalid'
  | 'expired'
  | 'installation-mismatch'
  | 'clock-invalid';

interface RtPtLicenseDetails {
  schemaVersion: 1;
  product: 'rt-pt-inspector';
  appId: 'com.amitay.rtptinspector';
  licenseId: string;
  customer: string;
  installationId: string;
  issuedAt: string;
  expiresAt: string | null;
  edition: 'professional';
  features: string[];
}

interface RtPtLicenseStatus {
  status: RtPtLicenseStatusName;
  active: boolean;
  product: 'rt-pt-inspector';
  appId: 'com.amitay.rtptinspector';
  installationId: string | null;
  reason: string | null;
  message: string;
  license?: RtPtLicenseDetails;
}

interface RtPtLicenseBridge {
  getStatus: () => Promise<RtPtLicenseStatus>;
  activate: (token: string) => Promise<RtPtLicenseStatus>;
  deactivate: () => Promise<RtPtLicenseStatus>;
}

interface ElectronAPI {
  isElectron?: boolean;
  platform?: string;
  rtptLicense: RtPtLicenseBridge;
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
  savePDF?: (data: string, filename: string) => Promise<{
    success: boolean;
    path?: string;
    error?: string;
    cancelled?: boolean;
  }>;
}

interface UpdateStatusEvent {
  status:
    | 'checking'
    | 'available'
    | 'downloading'
    | 'downloaded'
    | 'not-available'
    | 'error'
    | 'restart-scheduled';
  version?: string;
  percent?: number;
  bytesPerSecond?: number;
  transferred?: number;
  total?: number;
  error?: string;
  canRetry?: boolean;
  releaseNotes?: unknown;
  releaseDate?: string;
  restartIn?: number;
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
