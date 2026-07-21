const { contextBridge, ipcRenderer } = require('electron');

// Store update status listeners
const updateListeners = new Set();
const appCloseRequestListeners = new Set();
const updateInstallPreparationListeners = new Set();
const rtPtLicenseBridge = Object.freeze({
  getStatus: () => ipcRenderer.invoke('rtpt-license-get-status'),
  activate: (token) => ipcRenderer.invoke('rtpt-license-activate', token),
  deactivate: () => ipcRenderer.invoke('rtpt-license-deactivate'),
});

// Listen for update status from main process
ipcRenderer.on('update-status', (event, status) => {
  updateListeners.forEach(callback => callback(undefined, status));
});

ipcRenderer.on('app-close-requested', () => {
  appCloseRequestListeners.forEach(callback => callback());
});

ipcRenderer.on('prepare-update-install', (event, payload) => {
  updateInstallPreparationListeners.forEach(callback => callback(payload));
});

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  rtptLicense: rtPtLicenseBridge,

  // Auto-updater API
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  downloadUpdate: () => ipcRenderer.invoke('download-update'),
  installUpdate: (silent = true) => ipcRenderer.invoke('install-update', silent),
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  openExternal: (url) => ipcRenderer.invoke('open-external-url', url),

  // Window controls
  minimize: () => ipcRenderer.invoke('window-minimize'),
  maximize: () => ipcRenderer.invoke('window-maximize'),
  quit: () => ipcRenderer.invoke('app-quit'),
  confirmAppClose: () => ipcRenderer.invoke('confirm-app-close'),
  onAppCloseRequested: (callback) => {
    appCloseRequestListeners.add(callback);
  },
  removeAppCloseRequested: (callback) => {
    appCloseRequestListeners.delete(callback);
  },
  onPrepareForUpdateInstall: (callback) => {
    updateInstallPreparationListeners.add(callback);
  },
  removePrepareForUpdateInstall: (callback) => {
    updateInstallPreparationListeners.delete(callback);
  },
  confirmUpdateInstallReady: (requestId) => ipcRenderer.invoke('update-install-ready', { requestId }),

  // Platform information
  platform: process.platform
});

// Also expose as 'electron' for easier access with enhanced update capabilities
contextBridge.exposeInMainWorld('electron', {
  // Flag to identify Electron environment
  isElectron: true,
  platform: process.platform,
  rtptLicense: rtPtLicenseBridge,

  // Version info
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  openExternal: (url) => ipcRenderer.invoke('open-external-url', url),

  // Update checking
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  forceCheckUpdates: () => ipcRenderer.invoke('force-check-updates'),

  // Update installation
  installUpdate: (silent = true) => ipcRenderer.invoke('install-update', silent),
  downloadUpdate: () => ipcRenderer.invoke('download-update'),

  // Update info
  getUpdateInfo: () => ipcRenderer.invoke('get-update-info'),

  // Scheduled restart management
  scheduleRestart: (delaySeconds) => ipcRenderer.invoke('schedule-restart', delaySeconds),
  cancelScheduledRestart: () => ipcRenderer.invoke('cancel-scheduled-restart'),

  // Update status listeners
  onUpdateStatus: (callback) => {
    updateListeners.add(callback);
  },
  removeUpdateListener: (callback) => {
    updateListeners.delete(callback);
  },

  // Window controls
  minimize: () => ipcRenderer.invoke('window-minimize'),
  maximize: () => ipcRenderer.invoke('window-maximize'),
  quit: () => ipcRenderer.invoke('app-quit'),
  confirmAppClose: () => ipcRenderer.invoke('confirm-app-close'),
  onAppCloseRequested: (callback) => {
    appCloseRequestListeners.add(callback);
  },
  removeAppCloseRequested: (callback) => {
    appCloseRequestListeners.delete(callback);
  },
  onPrepareForUpdateInstall: (callback) => {
    updateInstallPreparationListeners.add(callback);
  },
  removePrepareForUpdateInstall: (callback) => {
    updateInstallPreparationListeners.delete(callback);
  },
  confirmUpdateInstallReady: (requestId) => ipcRenderer.invoke('update-install-ready', { requestId }),

  // File operations - for PDF export etc.
  savePDF: (data, filename) => ipcRenderer.invoke('save-pdf', { data, filename }),

  // Offline Update API (USB Updates for air-gapped factories)
  offlineUpdate: {
    browse: () => ipcRenderer.invoke('offline-update:browse'),
    scan: (directoryPath) => ipcRenderer.invoke('offline-update:scan', directoryPath),
    validate: (packageId) => ipcRenderer.invoke('offline-update:validate', packageId),
    install: (packageId, options) => ipcRenderer.invoke('offline-update:install', packageId, options),
    getDisplayInfo: (packageId) => ipcRenderer.invoke('offline-update:getDisplayInfo', packageId),
    getCurrentVersion: () => ipcRenderer.invoke('offline-update:getCurrentVersion'),
    onProgress: (callback) => {
      ipcRenderer.on('offline-update-progress', (event, progress) => callback(progress));
    },
    removeProgressListener: () => {
      ipcRenderer.removeAllListeners('offline-update-progress');
    }
  }
});
