const { contextBridge, ipcRenderer } = require('electron');

// Store update status listeners
const updateListeners = new Set();
const appCloseRequestListeners = new Set();
const updateInstallPreparationListeners = new Set();

// Listen for update status from main process
ipcRenderer.on('update-status', (event, status) => {
  updateListeners.forEach(callback => callback(event, status));
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
  // Send messages to main process
  send: (channel, data) => {
    const validChannels = ['new-sheet', 'export-pdf', 'save-file', 'open-file'];
    if (validChannels.includes(channel)) {
      ipcRenderer.send(channel, data);
    }
  },

  // Receive messages from main process
  on: (channel, callback) => {
    const validChannels = ['new-sheet', 'export-pdf', 'file-saved', 'file-opened', 'update-status', 'display-info', 'window-resized'];
    if (validChannels.includes(channel)) {
      ipcRenderer.on(channel, (event, ...args) => callback(...args));
    }
  },

  // Remove listeners
  removeAllListeners: (channel) => {
    const validChannels = ['new-sheet', 'export-pdf', 'file-saved', 'file-opened', 'update-status'];
    if (validChannels.includes(channel)) {
      ipcRenderer.removeAllListeners(channel);
    }
  },

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

  // Update settings
  getUpdateSettings: () => ipcRenderer.invoke('get-update-settings'),
  setUpdateSettings: (settings) => ipcRenderer.invoke('set-update-settings', settings),

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

  // License Management API
  license: {
    check: () => ipcRenderer.invoke('license:check'),
    activate: (licenseKey) => ipcRenderer.invoke('license:activate', licenseKey),
    getInfo: () => ipcRenderer.invoke('license:getInfo'),
    hasStandard: (standardCode) => ipcRenderer.invoke('license:hasStandard', standardCode),
    getStandards: () => ipcRenderer.invoke('license:getStandards'),
    deactivate: () => ipcRenderer.invoke('license:deactivate'),
    // Offline Activation
    generateActivationRequest: () => ipcRenderer.invoke('license:generateActivationRequest'),
    activateOffline: (licenseKey, responseCode) => ipcRenderer.invoke('license:activateOffline', licenseKey, responseCode),
    getMachineInfo: () => ipcRenderer.invoke('license:getMachineInfo')
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

  // Claude Vision API (Secure - API key stays in main process)
  claude: {
    analyzeDrawing: (imageBase64, mediaType) =>
      ipcRenderer.invoke('claude:analyzeDrawing', { imageBase64, mediaType }),
    checkStatus: () => ipcRenderer.invoke('claude:checkStatus'),
    // API Key Management
    saveApiKey: (apiKey) => ipcRenderer.invoke('claude:saveApiKey', apiKey),
    loadApiKey: () => ipcRenderer.invoke('claude:loadApiKey'),
    deleteApiKey: () => ipcRenderer.invoke('claude:deleteApiKey'),
  },

  // Offline Update API (USB Updates for air-gapped factories)
  offlineUpdate: {
    browse: () => ipcRenderer.invoke('offline-update:browse'),
    scan: (directoryPath) => ipcRenderer.invoke('offline-update:scan', directoryPath),
    validate: (packageInfo) => ipcRenderer.invoke('offline-update:validate', packageInfo),
    install: (packageInfo, options) => ipcRenderer.invoke('offline-update:install', packageInfo, options),
    getDisplayInfo: (packageInfo) => ipcRenderer.invoke('offline-update:getDisplayInfo', packageInfo),
    getCurrentVersion: () => ipcRenderer.invoke('offline-update:getCurrentVersion'),
    onProgress: (callback) => {
      ipcRenderer.on('offline-update-progress', (event, progress) => callback(progress));
    },
    removeProgressListener: () => {
      ipcRenderer.removeAllListeners('offline-update-progress');
    }
  }
});
