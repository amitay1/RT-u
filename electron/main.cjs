const { app, BrowserWindow, Menu, shell, dialog, ipcMain, screen, safeStorage } = require('electron');
const path = require('path');
const express = require('express');
const fs = require('fs');
const crypto = require('crypto');
const OfflineUpdater = require('./offline-updater.cjs');
const {
  createRtPtLicenseService,
  PRODUCT: RT_PT_LICENSE_PRODUCT,
  APP_ID: RT_PT_LICENSE_APP_ID,
} = require('./rtpt-license-service.cjs');
const { decodeRtPtPdfSavePayload } = require('./rtpt-pdf-save.cjs');

const EMBEDDED_SERVER_HOST = '127.0.0.1';
// Dev-only: the external `npm run dev` server. In a packaged build the embedded
// server binds an OS-assigned free port (see startEmbeddedServer) so this app can
// never collide with — or load — a different co-installed application that also
// happens to listen on 127.0.0.1:5000.
const EMBEDDED_SERVER_PORT = 5199;
const EMBEDDED_SERVER_ORIGIN = `http://${EMBEDDED_SERVER_HOST}:${EMBEDDED_SERVER_PORT}`;
// The origin actually loaded and trusted at runtime. Stays the dev origin above
// until the packaged embedded server binds its own free port.
let activeServerOrigin = EMBEDDED_SERVER_ORIGIN;
const ALLOWED_EXTERNAL_PROTOCOLS = new Set(['https:', 'mailto:']);

// GPU stability flags - keep GPU enabled for WebGL without disabling Chromium's sandbox
app.commandLine.appendSwitch('disable-gpu-watchdog');
app.commandLine.appendSwitch('ignore-gpu-blocklist');
app.commandLine.appendSwitch('enable-webgl');
app.commandLine.appendSwitch('use-angle', 'default');

// High DPI and scaling support for Windows
app.commandLine.appendSwitch('high-dpi-support', '1');
app.commandLine.appendSwitch('force-device-scale-factor', '1');

let mainWindow;
let embeddedServer;
let closeApproved = false;
let updateAvailable = false;
let updateVersion = null;
let updateDownloaded = false;
let updateInfo = null;
let autoUpdater;
let isDev;
let offlineUpdater;
let rtPtLicenseService;
let silentUpdateTimer = null;
let updateCheckInterval = null;
const pendingUpdatePreparation = new Map();
const approvedOfflineUpdateDirectories = new Set();
const offlineUpdatePackages = new Map();
const RT_PT_METHODS = new Set(['RT-Film', 'RT-Digital', 'PT']);
const RT_PT_DOCUMENT_STATUSES = new Set(['draft', 'in-review', 'approved', 'superseded']);
const RT_PT_UNIT_SYSTEMS = new Set(['SI', 'US-customary']);

function isPlainObject(value) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function isLegacyRtPtDocumentV1(value) {
  return Boolean(
    isPlainObject(value)
    && value.documentKind === 'rtpt-document'
    && value.schemaVersion === 1
    && RT_PT_METHODS.has(value.method)
    && value.sheets
    && typeof value.sheets === 'object'
    && value.sheets.rtFilm
    && value.sheets.rtDigital
    && value.sheets.penetrant
  );
}

function hasLegacyV2TechniqueSections(method, technique) {
  if (!isPlainObject(technique)) return false;

  const requiredSections = method === 'RT-Film'
    ? ['general', 'exposure', 'equipment', 'filmSystem', 'iqc', 'acceptance']
    : method === 'RT-Digital'
      ? ['general', 'exposure', 'system', 'detector', 'imageProcessing', 'iqc', 'acceptance']
      : ['general', 'materials', 'surfacePrep', 'application', 'development', 'conditions', 'acceptance', 'postCleaning'];

  return requiredSections.every((section) => isPlainObject(technique[section]));
}

function hasV3TechniqueSections(method, technique) {
  if (!isPlainObject(technique) || typeof technique.techniqueNotes !== 'string') return false;

  if (method === 'RT-Film') {
    return [
      'general',
      'exposureDefaults',
      'source',
      'filmSystem',
      'iqi',
      'acceptance',
    ].every((section) => isPlainObject(technique[section]))
      && Array.isArray(technique.exposureViews);
  }

  if (method === 'RT-Digital') {
    return [
      'general',
      'source',
      'acquisitionDefaults',
      'system',
      'detectorPerformance',
      'imageProcessing',
      'displayAndStorage',
      'iqi',
      'acceptance',
    ].every((section) => isPlainObject(technique[section]))
      && typeof technique.workflow === 'string'
      && Array.isArray(technique.acquisitions);
  }

  return [
    'general',
    'materials',
    'surfacePrep',
    'application',
    'removal',
    'development',
    'conditions',
    'acceptance',
    'postCleaning',
  ].every((section) => isPlainObject(technique[section]));
}

function isRtPtDocumentV2(value) {
  return Boolean(
    isPlainObject(value)
    && value.documentKind === 'rtpt-document'
    && value.schemaVersion === 2
    && value.documentType === 'technique'
    && typeof value.documentId === 'string'
    && value.documentId.trim()
    && RT_PT_METHODS.has(value.method)
    && RT_PT_DOCUMENT_STATUSES.has(value.status)
    && RT_PT_UNIT_SYSTEMS.has(value.unitSystem)
    && isPlainObject(value.documentControl)
    && isPlainObject(value.organization)
    && isPlainObject(value.job)
    && Array.isArray(value.controlledReferences)
    && Array.isArray(value.approvals)
    && hasLegacyV2TechniqueSections(value.method, value.technique)
  );
}

function isRtPtDocumentV3(value) {
  return Boolean(
    isPlainObject(value)
    && value.documentKind === 'rtpt-document'
    && value.schemaVersion === 3
    && value.documentType === 'technique'
    && typeof value.documentId === 'string'
    && value.documentId.trim()
    && RT_PT_METHODS.has(value.method)
    && RT_PT_DOCUMENT_STATUSES.has(value.status)
    && RT_PT_UNIT_SYSTEMS.has(value.unitSystem)
    && isPlainObject(value.documentControl)
    && Array.isArray(value.revisionHistory)
    && isPlainObject(value.organization)
    && isPlainObject(value.job)
    && Array.isArray(value.controlledReferences)
    && Array.isArray(value.approvals)
    && hasV3TechniqueSections(value.method, value.technique)
  );
}

function isReadableRtPtDocument(value) {
  return isLegacyRtPtDocumentV1(value) || isRtPtDocumentV2(value) || isRtPtDocumentV3(value);
}

function isWritableRtPtDocument(value) {
  return isRtPtDocumentV3(value);
}

function rejectNonRtPtTechniqueSheet(res) {
  return res.status(400).json({
    error: 'Only RT/PT Inspector documents are supported by this application.',
  });
}

// Update settings - can be configured per-factory
const UPDATE_SETTINGS = {
  // Check for updates every 30 minutes
  checkInterval: 30 * 60 * 1000,
  // Auto-restart after this many seconds (0 = disabled, let user decide)
  autoRestartDelay: 0,
  // Silent mode - minimal notifications to user
  silentMode: true,
  // Install on quit - always true for seamless updates
  installOnQuit: true,
  // Retry failed updates
  maxRetries: 3,
  retryDelay: 60 * 1000 // 1 minute
};

let updateRetryCount = 0;
let updateCheckInProgress = false;
let updateDownloadInProgress = false;
let lastDownloadPercent = 0;

function isTrustedAppUrl(value) {
  try {
    return new URL(String(value || '')).origin === activeServerOrigin;
  } catch {
    return false;
  }
}

async function openExternalSafely(value) {
  try {
    const targetUrl = new URL(String(value || ''));
    if (!ALLOWED_EXTERNAL_PROTOCOLS.has(targetUrl.protocol)) {
      return { success: false, error: 'Blocked unsupported URL protocol' };
    }

    await shell.openExternal(targetUrl.toString());
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

function assertTrustedIpcSender(event) {
  const senderUrl = event?.senderFrame?.url || event?.sender?.getURL?.() || '';
  if (!isTrustedAppUrl(senderUrl)) {
    throw new Error('Blocked IPC request from an untrusted renderer');
  }
}

function resolveRtPtLicensePublicKeyPath() {
  const pinnedPublicKeyPath = path.join(__dirname, 'rtpt-license-public-key.pem');
  const unpackagedOverride = !app.isPackaged
    ? String(process.env.RTPT_LICENSE_PUBLIC_KEY_PATH || '').trim()
    : '';

  return unpackagedOverride ? path.resolve(unpackagedOverride) : pinnedPublicKeyPath;
}

function unavailableRtPtLicenseStatus(reason = 'license-service-unavailable') {
  return {
    status: 'configuration-required',
    active: false,
    product: RT_PT_LICENSE_PRODUCT,
    appId: RT_PT_LICENSE_APP_ID,
    installationId: null,
    reason,
    message: 'License verification is not configured for this installation.',
  };
}

function getRtPtLicenseStatus() {
  if (!rtPtLicenseService) return unavailableRtPtLicenseStatus();

  try {
    const result = rtPtLicenseService.getStatus();
    return result && typeof result === 'object'
      ? result
      : unavailableRtPtLicenseStatus('license-service-response-invalid');
  } catch (error) {
    console.error('[RT/PT License] Status check failed:', error.message);
    return unavailableRtPtLicenseStatus('license-service-error');
  }
}

function assertActiveRtPtLicense() {
  const status = getRtPtLicenseStatus();
  if (status.active !== true) {
    const error = new Error('An active RT/PT Inspector license is required.');
    error.code = 'RTPT_LICENSE_REQUIRED';
    error.licenseStatus = status.status;
    throw error;
  }
  return status;
}

function initializeRtPtLicenseService() {
  rtPtLicenseService = createRtPtLicenseService({
    secureStorage: safeStorage,
    userDataDir: app.getPath('userData'),
    publicKeyPath: resolveRtPtLicensePublicKeyPath(),
  });
}

function loadOfflineUpdatePublicKey() {
  const publicKeyPath = path.join(__dirname, 'update-public-key.pem');
  try {
    return fs.readFileSync(publicKeyPath, 'utf8');
  } catch {
    console.warn('[OfflineUpdater] No pinned public key found; USB installation is disabled.');
    return null;
  }
}

function getOfflineUpdatePackage(packageId) {
  if (typeof packageId !== 'string' || !offlineUpdatePackages.has(packageId)) {
    throw new Error('Unknown or expired offline update package');
  }
  return offlineUpdatePackages.get(packageId);
}

function toOfflineUpdateSummary(packageId, packageInfo) {
  return {
    id: packageId,
    version: packageInfo.version,
    isNewer: packageInfo.isNewer,
    releaseDate: packageInfo.releaseDate,
    changelog: packageInfo.changelog,
    size: packageInfo.size,
    actualSize: packageInfo.actualSize,
    minVersion: packageInfo.minVersion,
    platform: packageInfo.platform,
    installerMissing: Boolean(packageInfo.installerMissing),
  };
}

function buildUpdateState(extra = {}) {
  return {
    updateAvailable,
    updateDownloaded,
    updateVersion,
    currentVersion: app.getVersion(),
    ...extra,
  };
}

function requestRendererUpdatePreparation(reason = 'manual-install') {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return Promise.resolve(false);
  }

  const requestId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      pendingUpdatePreparation.delete(requestId);
      resolve(false);
    }, 5000);

    pendingUpdatePreparation.set(requestId, () => {
      clearTimeout(timeout);
      pendingUpdatePreparation.delete(requestId);
      resolve(true);
    });

    mainWindow.webContents.send('prepare-update-install', {
      requestId,
      reason,
      version: updateVersion,
    });
  });
}

async function performUpdateInstall(silent = true, reason = 'manual-install') {
  if (!autoUpdater) {
    return { started: false };
  }

  cancelScheduledRestart();
  await requestRendererUpdatePreparation(reason);
  closeApproved = true;
  autoUpdater.quitAndInstall(silent, true);
  return { started: true };
}

async function safeCheckForUpdates(force = false) {
  if (isDev || !autoUpdater) {
    return { updateAvailable: false, isDev: true };
  }

  if (updateCheckInProgress) {
    return buildUpdateState({ checking: true, alreadyInProgress: true });
  }

  if (updateDownloadInProgress) {
    return buildUpdateState({ downloading: true, alreadyInProgress: true });
  }

  try {
    if (force) {
      updateRetryCount = 0;
    }

    updateCheckInProgress = true;
    await autoUpdater.checkForUpdates();
    return buildUpdateState({ checking: true });
  } catch (error) {
    updateCheckInProgress = false;
    console.error(`${force ? 'Force check' : 'Check'} for updates error:`, error.message);
    return { error: error.message, updateAvailable: false };
  }
}

async function safeStartUpdateDownload(reason = 'manual') {
  if (!autoUpdater) {
    return { error: 'No auto updater available' };
  }

  if (updateDownloaded) {
    return buildUpdateState({ alreadyDownloaded: true });
  }

  if (updateDownloadInProgress) {
    console.log(`Update download already in progress (${reason})`);
    return buildUpdateState({ downloading: true, alreadyInProgress: true });
  }

  try {
    updateDownloadInProgress = true;
    lastDownloadPercent = 0;
    console.log(`Starting update download (${reason})...`);
    await autoUpdater.downloadUpdate();
    return buildUpdateState({ downloading: true, started: true });
  } catch (error) {
    updateDownloadInProgress = false;
    console.error(`Download update error (${reason}):`, error.message);
    return { error: error.message };
  }
}

// Initialize autoUpdater after app is ready
function initAutoUpdater() {
  const { autoUpdater: updater } = require('electron-updater');
  autoUpdater = updater;

  // Auto-updater configuration for seamless updates
  autoUpdater.autoDownload = false;             // Start downloads explicitly to avoid duplicate loops
  autoUpdater.autoInstallOnAppQuit = true;      // Install when user quits
  autoUpdater.disableWebInstaller = true;       // We ship full NSIS installers, not web installers
  autoUpdater.disableDifferentialDownload = true; // Differential path is unstable for current release flow
  autoUpdater.allowDowngrade = false;           // Never downgrade
  autoUpdater.allowPrerelease = false;          // Only stable releases
  
  // Set logger for debugging
  const log = require('electron-log');
  autoUpdater.logger = log;
  autoUpdater.logger.transports.file.level = 'info';
  console.log('📋 Update log file:', log.transports.file.getFile().path);

  // RT Inspector has its own GitHub release channel. The generated
  // app-update.yml points exclusively at amitay1/RT-u.
  console.log('📦 Current app version:', app.getVersion());
  console.log('🔗 Update provider: GitHub amitay1/RT-u (RT Inspector only)');

  setupAutoUpdaterHandlers();
  
  // Setup periodic update checks
  setupPeriodicUpdateChecks();
}

// Setup periodic update checks
function setupPeriodicUpdateChecks() {
  // Clear existing interval if any
  if (updateCheckInterval) {
    clearInterval(updateCheckInterval);
  }
  
  // Check for updates periodically
  updateCheckInterval = setInterval(() => {
    if (autoUpdater && !updateDownloaded && !updateCheckInProgress && !updateDownloadInProgress) {
      console.log('🔄 Periodic update check...');
      safeCheckForUpdates().catch(err => {
        console.log('Periodic update check failed:', err.message);
      });
    }
  }, UPDATE_SETTINGS.checkInterval);
}

// Auto-updater event handlers
function setupAutoUpdaterHandlers() {
  autoUpdater.on('checking-for-update', () => {
    updateCheckInProgress = true;
    console.log('Checking for updates...');
    if (mainWindow) {
      mainWindow.webContents.send('update-status', { status: 'checking', silent: UPDATE_SETTINGS.silentMode });
    }
  });

  autoUpdater.on('update-available', (info) => {
    updateCheckInProgress = false;
    console.log('Update available:', info.version);
    updateAvailable = true;
    updateDownloaded = false;
    updateVersion = info.version;
    updateInfo = info;
    updateRetryCount = 0;
    updateMenu();

    if (mainWindow) {
      mainWindow.webContents.send('update-status', {
        status: 'available',
        version: info.version,
        releaseNotes: info.releaseNotes,
        releaseDate: info.releaseDate,
        silent: UPDATE_SETTINGS.silentMode
      });
    }

    safeStartUpdateDownload('auto').catch(err => {
      console.error('Failed to start automatic update download:', err.message);
    });
  });

  autoUpdater.on('update-not-available', (info) => {
    updateCheckInProgress = false;
    updateAvailable = false;
    console.log('App is up to date:', info.version);
    if (mainWindow) {
      mainWindow.webContents.send('update-status', { status: 'not-available', silent: UPDATE_SETTINGS.silentMode });
    }
  });

  autoUpdater.on('download-progress', (progress) => {
    updateDownloadInProgress = true;
    lastDownloadPercent = progress.percent;
    const percent = progress.percent.toFixed(1);
    const speed = (progress.bytesPerSecond / 1024 / 1024).toFixed(2);
    const transferred = (progress.transferred / 1024 / 1024).toFixed(2);
    const total = (progress.total / 1024 / 1024).toFixed(2);

    console.log('Download: ' + percent + '% (' + transferred + '/' + total + ' MB @ ' + speed + ' MB/s)');

    if (mainWindow) {
      mainWindow.webContents.send('update-status', {
        status: 'downloading',
        percent: progress.percent,
        bytesPerSecond: progress.bytesPerSecond,
        transferred: progress.transferred,
        total: progress.total
      });
    }
  });

  autoUpdater.on('update-downloaded', (info) => {
    updateCheckInProgress = false;
    updateDownloadInProgress = false;
    lastDownloadPercent = 100;
    console.log('Update downloaded:', info.version);
    updateDownloaded = true;
    updateVersion = info.version;
    updateInfo = info;
    updateMenu();

    if (mainWindow) {
      mainWindow.webContents.send('update-status', {
        status: 'downloaded',
        version: info.version,
        releaseNotes: info.releaseNotes,
        autoInstallOnQuit: UPDATE_SETTINGS.installOnQuit
      });
    }

    if (UPDATE_SETTINGS.autoRestartDelay > 0) {
      scheduleAutoRestart(UPDATE_SETTINGS.autoRestartDelay);
    }
  });

  autoUpdater.on('error', (error) => {
    const failedDuringDownload = updateDownloadInProgress || lastDownloadPercent > 0;
    updateCheckInProgress = false;
    updateDownloadInProgress = false;

    console.error('Auto-updater error:', error.message);
    console.error('Full error details:', JSON.stringify({
      message: error.message,
      stack: error.stack,
      code: error.code,
      name: error.name
    }, null, 2));

    const errorInfo = {
      message: error.message,
      code: error.code || 'UNKNOWN',
      isNetworkError: error.message?.includes('net::') || error.message?.includes('ENOTFOUND') || error.message?.includes('ETIMEDOUT'),
      isSha512Error: error.message?.includes('sha512') || error.message?.includes('checksum'),
      isFileError: error.message?.includes('ENOENT') || error.message?.includes('file'),
      failedDuringDownload,
      lastDownloadPercent,
      timestamp: new Date().toISOString()
    };
    console.error('Error analysis:', JSON.stringify(errorInfo, null, 2));

    const shouldAutoRetry =
      errorInfo.isNetworkError &&
      !errorInfo.isSha512Error &&
      !failedDuringDownload &&
      updateRetryCount < UPDATE_SETTINGS.maxRetries;

    if (shouldAutoRetry) {
      updateRetryCount++;
      console.log('Retrying update check (' + updateRetryCount + '/' + UPDATE_SETTINGS.maxRetries + ')...');
      setTimeout(() => {
        safeCheckForUpdates().catch(err => {
          console.error('Retry failed:', err.message);
        });
      }, UPDATE_SETTINGS.retryDelay);
      return;
    }

    const userMessage = errorInfo.isSha512Error
      ? 'Update package validation failed. Re-publish this release before trying again.'
      : error.message;

    if (mainWindow) {
      mainWindow.webContents.send('update-status', {
        status: 'error',
        error: userMessage,
        errorCode: error.code,
        errorDetails: errorInfo,
        canRetry: true
      });
    }
  });
}
// Schedule automatic restart for update installation
function scheduleAutoRestart(delaySeconds) {
  if (silentUpdateTimer) {
    clearTimeout(silentUpdateTimer);
  }
  
  console.log(`⏰ Auto-restart scheduled in ${delaySeconds} seconds`);
  
  if (mainWindow) {
    mainWindow.webContents.send('update-status', {
      status: 'restart-scheduled',
      restartIn: delaySeconds,
      version: updateVersion
    });
  }
  
  silentUpdateTimer = setTimeout(async () => {
    console.log('🔄 Auto-restarting for update...');
    await performUpdateInstall(true, 'scheduled-restart');
  }, delaySeconds * 1000);
}

// Cancel scheduled restart
function cancelScheduledRestart() {
  if (silentUpdateTimer) {
    clearTimeout(silentUpdateTimer);
    silentUpdateTimer = null;
    console.log('⏹️ Auto-restart cancelled');
  }
}

// Setup IPC handlers
function setupIPCHandlers() {
  ipcMain.handle('rtpt-license-get-status', (event) => {
    assertTrustedIpcSender(event);
    return getRtPtLicenseStatus();
  });

  ipcMain.handle('rtpt-license-activate', (event, token) => {
    assertTrustedIpcSender(event);
    if (!rtPtLicenseService) return unavailableRtPtLicenseStatus();

    try {
      return rtPtLicenseService.activate(token);
    } catch (error) {
      console.error('[RT/PT License] Activation failed:', error.message);
      return unavailableRtPtLicenseStatus('license-service-error');
    }
  });

  ipcMain.handle('rtpt-license-deactivate', (event) => {
    assertTrustedIpcSender(event);
    if (!rtPtLicenseService) return unavailableRtPtLicenseStatus();

    try {
      return rtPtLicenseService.deactivate();
    } catch (error) {
      console.error('[RT/PT License] Deactivation failed:', error.message);
      return unavailableRtPtLicenseStatus('license-service-error');
    }
  });

  // Window control handlers
  ipcMain.handle('window-minimize', (event) => {
    assertTrustedIpcSender(event);
    if (mainWindow) mainWindow.minimize();
  });

  ipcMain.handle('window-maximize', (event) => {
    assertTrustedIpcSender(event);
    if (mainWindow) {
      if (mainWindow.isMaximized()) {
        mainWindow.restore();
      } else {
        mainWindow.maximize();
      }
    }
  });

  ipcMain.handle('app-quit', (event) => {
    assertTrustedIpcSender(event);
    const licenseIsActive = getRtPtLicenseStatus().active === true;

    // The activation gate does not mount the workspace's unsaved-change
    // listener. Bypass that guard only while the license is inactive; an
    // active workspace must still complete the normal confirmation flow.
    if (!licenseIsActive) closeApproved = true;

    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.close();
      return { success: true, pendingWorkspaceConfirmation: licenseIsActive };
    }

    app.quit();
    return { success: true, pendingWorkspaceConfirmation: false };
  });

  ipcMain.handle('confirm-app-close', (event) => {
    assertTrustedIpcSender(event);
    closeApproved = true;

    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.close();
      return { success: true };
    }

    app.quit();
    return { success: true };
  });

  ipcMain.handle('open-external-url', async (event, url) => {
    assertTrustedIpcSender(event);
    return openExternalSafely(url);
  });

  // IPC handlers for manual update control
  ipcMain.handle('check-for-updates', async () => {
    return safeCheckForUpdates(false);
  });

  ipcMain.handle('download-update', async () => {
    return safeStartUpdateDownload('manual');
  });

  ipcMain.handle('install-update', async (event, silent = true) => {
    return performUpdateInstall(silent, 'manual-install');
  });

  ipcMain.handle('update-install-ready', (event, payload) => {
    const finalize = pendingUpdatePreparation.get(payload?.requestId);
    if (finalize) {
      finalize();
      return { acknowledged: true };
    }

    return { acknowledged: false };
  });

  ipcMain.handle('get-app-version', () => {
    return app.getVersion();
  });
  
  // New: Get update info
  ipcMain.handle('get-update-info', () => {
    return {
      updateAvailable,
      updateDownloaded,
      updateVersion,
      releaseNotes: updateInfo?.releaseNotes,
      releaseDate: updateInfo?.releaseDate,
      currentVersion: app.getVersion()
    };
  });
  
  // New: Schedule restart
  ipcMain.handle('schedule-restart', (event, delaySeconds) => {
    scheduleAutoRestart(delaySeconds);
    return { scheduled: true, restartIn: delaySeconds };
  });
  
  // New: Cancel scheduled restart
  ipcMain.handle('cancel-scheduled-restart', () => {
    cancelScheduledRestart();
    return { cancelled: true };
  });
  
  // New: Force check for updates (bypass cache)
  ipcMain.handle('force-check-updates', async () => {
    return safeCheckForUpdates(true);
  });

  // PDF/File Save IPC Handler - more reliable than blob downloads
  ipcMain.handle('save-pdf', async (event, payload) => {
    try {
      assertTrustedIpcSender(event);
      assertActiveRtPtLicense();
      const { buffer, filename } = decodeRtPtPdfSavePayload(payload);

      // Show save dialog
      const { filePath } = await dialog.showSaveDialog(mainWindow, {
        defaultPath: path.join(app.getPath('downloads'), filename),
        filters: [
          { name: 'PDF Files', extensions: ['pdf'] }
        ]
      });

      if (filePath) {
        // The save dialog can remain open long enough for a license to expire
        // or be deactivated. Revalidate immediately before the disk write.
        assertActiveRtPtLicense();
        fs.writeFileSync(filePath, buffer);
        console.log('PDF saved to:', filePath);

        // Open the file location
        shell.showItemInFolder(filePath);

        return { success: true, path: filePath };
      }
      return { success: false, cancelled: true };
    } catch (error) {
      console.error('Error saving PDF:', error);
      return { success: false, error: error.message };
    }
  });

  // ==========================================
  // Offline Update IPC Handlers (USB Updates)
  // ==========================================

  // Initialize offline updater
  offlineUpdater = new OfflineUpdater({
    currentVersion: app.getVersion(),
    appPath: app.getPath('exe'),
    tempDir: app.getPath('temp'),
    publicKey: loadOfflineUpdatePublicKey(),
    onProgress: (progress) => {
      if (mainWindow) {
        mainWindow.webContents.send('offline-update-progress', progress);
      }
    },
    onLog: (message) => {
      console.log('[OfflineUpdater]', message);
    }
  });

  // Browse for update folder
  ipcMain.handle('offline-update:browse', async (event) => {
    assertTrustedIpcSender(event);
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Select Update Folder (USB Drive)',
      properties: ['openDirectory'],
      buttonLabel: 'Select Folder'
    });

    if (result.canceled || !result.filePaths[0]) {
      return { cancelled: true };
    }

    const approvedPath = fs.realpathSync(result.filePaths[0]);
    approvedOfflineUpdateDirectories.clear();
    offlineUpdatePackages.clear();
    approvedOfflineUpdateDirectories.add(approvedPath);
    return { path: approvedPath };
  });

  // Scan for updates in a directory
  ipcMain.handle('offline-update:scan', async (event, directoryPath) => {
    assertTrustedIpcSender(event);
    const resolvedDirectory = fs.realpathSync(String(directoryPath || ''));
    if (!approvedOfflineUpdateDirectories.has(resolvedDirectory)) {
      throw new Error('Select the update directory through the trusted folder dialog first');
    }

    offlineUpdatePackages.clear();
    const scanResult = await offlineUpdater.scanForUpdates(resolvedDirectory);
    const packages = scanResult.packages.map((packageInfo) => {
      const packageId = crypto.randomUUID();
      offlineUpdatePackages.set(packageId, Object.freeze({ ...packageInfo }));
      return toOfflineUpdateSummary(packageId, packageInfo);
    });
    return { ...scanResult, packages };
  });

  // Validate an update package
  ipcMain.handle('offline-update:validate', async (event, packageId) => {
    assertTrustedIpcSender(event);
    const packageInfo = getOfflineUpdatePackage(packageId);
    return await offlineUpdater.validatePackage(packageInfo);
  });

  // Install update from USB
  ipcMain.handle('offline-update:install', async (event, packageId, options) => {
    try {
      assertTrustedIpcSender(event);
      const packageInfo = getOfflineUpdatePackage(packageId);
      const installOptions = {
        silent: options?.silent === true,
        autoRestart: options?.autoRestart !== false,
      };
      const result = await offlineUpdater.installUpdate(packageInfo, installOptions);

      // If installation started, quit the app
      if (result.success && installOptions.autoRestart) {
        setTimeout(() => {
          app.quit();
        }, 2000);
      }

      return result;
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // Get display info for a package
  ipcMain.handle('offline-update:getDisplayInfo', (event, packageId) => {
    assertTrustedIpcSender(event);
    const packageInfo = getOfflineUpdatePackage(packageId);
    return offlineUpdater.getPackageDisplayInfo(packageInfo);
  });

  // Get current version
  ipcMain.handle('offline-update:getCurrentVersion', (event) => {
    assertTrustedIpcSender(event);
    return app.getVersion();
  });

}

function showRtPtLicenseInformation() {
  const status = getRtPtLicenseStatus();
  const license = status.license;
  const detail = status.active === true && license
    ? [
      `Status: ${status.status}`,
      `Customer: ${license.customer}`,
      `License ID: ${license.licenseId}`,
      `Installation ID: ${status.installationId || 'Unavailable'}`,
      `Expiry: ${license.expiresAt || 'Perpetual'}`,
    ].join('\n')
    : [
      `Status: ${status.status}`,
      `Installation ID: ${status.installationId || 'Unavailable'}`,
      `Details: ${status.message}`,
      ...(status.reason ? [`Reason: ${status.reason}`] : []),
    ].join('\n');

  return dialog.showMessageBox(mainWindow, {
    type: status.active === true ? 'info' : 'warning',
    title: 'RT Inspector License',
    message: status.active === true ? 'License is active' : 'License is not active',
    detail,
    buttons: ['OK'],
    noLink: true,
  });
}

// Build menu template with dynamic update status
function buildMenuTemplate() {
  // Determine update menu item text and action
  let updateMenuItem;
  if (updateDownloaded) {
    updateMenuItem = {
      label: '🔴 Install Update (v' + updateVersion + ')',
      click: () => {
        void performUpdateInstall(true, 'manual-install');
      }
    };
  } else if (updateAvailable) {
    updateMenuItem = {
      label: '🟡 Download Update (v' + updateVersion + ')',
      click: () => {
        if (autoUpdater) {
          safeStartUpdateDownload('menu').catch(err => {
            console.error('Menu-triggered download failed:', err.message);
          });
        }
      }
    };
  } else {
    updateMenuItem = {
      label: 'Check for Updates',
      click: () => {
        if (!isDev && autoUpdater) {
          safeCheckForUpdates().catch(err => {
            console.error('Menu-triggered update check failed:', err.message);
          });
        } else {
          dialog.showMessageBox(mainWindow, {
            type: 'info',
            title: 'Development Mode',
            message: 'Auto-update is disabled in development mode.',
            buttons: ['OK']
          });
        }
      }
    };
  }

  return [
    {
      label: 'File',
      submenu: [
        {
          label: 'Quit',
          accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Ctrl+Q',
          click: () => {
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.close();
              return;
            }

            app.quit();
          }
        }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { label: 'Undo', accelerator: 'CmdOrCtrl+Z', role: 'undo' },
        { label: 'Redo', accelerator: 'CmdOrCtrl+Y', role: 'redo' },
        { type: 'separator' },
        { label: 'Cut', accelerator: 'CmdOrCtrl+X', role: 'cut' },
        { label: 'Copy', accelerator: 'CmdOrCtrl+C', role: 'copy' },
        { label: 'Paste', accelerator: 'CmdOrCtrl+V', role: 'paste' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { label: 'Reload', accelerator: 'CmdOrCtrl+R', role: 'reload' },
        { label: 'Force Reload', accelerator: 'CmdOrCtrl+Shift+R', role: 'forceReload' },
        ...(isDev ? [
          { label: 'Toggle Developer Tools', accelerator: 'F12', role: 'toggleDevTools' },
        ] : []),
        { type: 'separator' },
        { label: 'Actual Size', accelerator: 'CmdOrCtrl+0', role: 'resetZoom' },
        { label: 'Zoom In', accelerator: 'CmdOrCtrl+Plus', role: 'zoomIn' },
        { label: 'Zoom Out', accelerator: 'CmdOrCtrl+-', role: 'zoomOut' },
        { type: 'separator' },
        { label: 'Toggle Fullscreen', accelerator: 'F11', role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Window',
      submenu: [
        { label: 'Minimize', accelerator: 'CmdOrCtrl+M', role: 'minimize' },
        { label: 'Close', accelerator: 'CmdOrCtrl+W', role: 'close' }
      ]
    },
    {
      label: updateAvailable || updateDownloaded ? '❗ Help' : 'Help',
      submenu: [
        updateMenuItem,
        {
          label: 'License Information',
          click: () => {
            void showRtPtLicenseInformation();
          }
        },
        { type: 'separator' },
        {
          label: 'About RT Inspector',
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'About RT Inspector',
              message: 'RT Inspector',
              detail: `Radiographic Technique Engineering Platform\n\nVersion: ${app.getVersion()}\n\nBuilt with Electron, React, and Node.js`,
              buttons: ['OK']
            });
          }
        },
        {
          label: 'Documentation',
          click: () => {
            shell.openExternal('https://github.com/amitay1/RT-u');
          }
        }
      ]
    }
  ];
}

// Update the application menu
function updateMenu() {
  const menu = Menu.buildFromTemplate(buildMenuTemplate());
  Menu.setApplicationMenu(menu);
}

async function createWindow() {
  closeApproved = false;

  // Get the primary display to calculate proper dimensions
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;
  const scaleFactor = primaryDisplay.scaleFactor;

  console.log(`Screen: ${screenWidth}x${screenHeight}, Scale Factor: ${scaleFactor}`);

  // Set up download handler for PDF exports and other file downloads
  const { session } = require('electron');
  session.defaultSession.on('will-download', (event, item, webContents) => {
    try {
      assertActiveRtPtLicense();
    } catch {
      event.preventDefault();
      console.warn('[RT/PT License] Blocked a renderer download while the license was inactive.');
      return;
    }

    const fileName = item.getFilename();
    console.log('Download started:', fileName);

    // Get the default download path
    const downloadsPath = app.getPath('downloads');
    const savePath = path.join(downloadsPath, fileName);

    // Set the save path
    item.setSavePath(savePath);

    item.on('updated', (event, state) => {
      if (state === 'interrupted') {
        console.log('Download interrupted');
      } else if (state === 'progressing') {
        if (item.isPaused()) {
          console.log('Download paused');
        } else {
          const percent = item.getReceivedBytes() / item.getTotalBytes() * 100;
          console.log(`Download progress: ${percent.toFixed(1)}%`);
        }
      }
    });

    item.once('done', (event, state) => {
      if (state === 'completed') {
        console.log('Download completed:', savePath);
        // Open the file location in explorer/finder
        shell.showItemInFolder(savePath);
      } else {
        console.log('Download failed:', state);
      }
    });
  });
  
  // Keep the workbench at its verified desktop viewport whenever the display
  // can support it. On a smaller work area Electron falls back to the full
  // available size instead of permitting an unusably tiny nested workspace.
  const baseMinWidth = Math.min(1024, screenWidth);
  const baseMinHeight = Math.min(720, screenHeight);
  
  // Create the browser window with proper scaling support
  mainWindow = new BrowserWindow({
    width: Math.min(1400, screenWidth),
    height: Math.min(900, screenHeight),
    minWidth: baseMinWidth,
    minHeight: baseMinHeight,
    show: false, // Don't show until ready
    icon: path.join(__dirname, '../build/icon.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      devTools: Boolean(isDev),
      preload: path.join(__dirname, 'preload.cjs'),
      webSecurity: true,
      // Disable service workers in development
      enablePreferredSizeMode: false,
      // Adjust zoom for better readability - slightly larger UI
      // On high DPI displays (scale > 1.25), use 1.0; otherwise use 1.1 for larger UI
      zoomFactor: scaleFactor > 1.25 ? 1.0 : 1.1
    },
    autoHideMenuBar: true,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    title: 'RT Inspector',
    // Use content size to ensure proper fitting
    useContentSize: true,
    // Start maximized (not kiosk – allows restore/minimize)
    kiosk: false,
    // Ensure window respects DPI settings
    backgroundColor: '#14171c'
  });

  // Set minimum window size after creation for better control
  mainWindow.setMinimumSize(baseMinWidth, baseMinHeight);

  // Show window maximized
  mainWindow.maximize();
  mainWindow.show();

  // Create application menu
  updateMenu();

  // Clear all browser data in development to remove cached service workers
  if (isDev) {
    mainWindow.webContents.session.clearStorageData({
      storages: ['serviceworkers', 'cachestorage', 'websql', 'indexdb']
    });

    // Block service worker requests in development
    mainWindow.webContents.session.webRequest.onBeforeRequest({
      urls: ['*://*/service-worker*.js', '*://*/sw.js']
    }, (details, callback) => {
      console.log('Blocking service worker request:', details.url);
      callback({ cancel: true });
    });
  }

  // Set up Content Security Policy for security
  mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    const cspPolicy = isDev
      ? "default-src 'self' data: blob:; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self' ws://127.0.0.1:* http://127.0.0.1:*; font-src 'self' data:; worker-src 'self' blob:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'"
      : "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; font-src 'self' data:; worker-src 'self' blob:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'";
    
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [cspPolicy]
      }
    });
  });

  // Load the app
  if (isDev) {
    mainWindow.loadURL(EMBEDDED_SERVER_ORIGIN);
    mainWindow.webContents.openDevTools();
  } else {
    // In production, start embedded server first, then load through it
    try {
      await startEmbeddedServer();
      console.log(`Server started, loading from ${activeServerOrigin}`);

      // Wait a moment for server to be ready
      await new Promise(resolve => setTimeout(resolve, 500));

      mainWindow.loadURL(activeServerOrigin);
    } catch (error) {
      console.error('Server failed:', error);
      // If server fails, show error
      mainWindow.loadURL(`data:text/html,<h1>Error starting server: ${error.message}</h1>`);
    }
  }

  mainWindow.on('close', (event) => {
    if (closeApproved) {
      return;
    }

    event.preventDefault();

    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('app-close-requested');
    }
  });

  // Handle window closed
  mainWindow.on('closed', () => {
    closeApproved = false;
    mainWindow = null;
  });

  const guardNavigation = (event, url) => {
    if (isTrustedAppUrl(url)) return;

    event.preventDefault();
    void openExternalSafely(url);
  };

  mainWindow.webContents.on('will-navigate', guardNavigation);
  mainWindow.webContents.on('will-redirect', guardNavigation);

  // Handle external links
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    void openExternalSafely(url);
    return { action: 'deny' };
  });
}

// Embedded Express server for production
function startEmbeddedServer() {
  return new Promise((resolve, reject) => {
    try {
      const expressApp = express();
      const dataDir = path.join(app.getPath('userData'), 'data');

      // Populated once the OS assigns the free port in the listen callback below.
      // Until then the allowlists are empty, so any early request is rejected.
      const allowedHosts = new Set();
      const allowedOrigins = new Set();

      expressApp.use((req, res, next) => {
        const host = req.get('host');
        const origin = req.get('origin');
        if (!host || !allowedHosts.has(host) || (origin && !allowedOrigins.has(origin))) {
          return res.status(403).json({ error: 'Forbidden request origin' });
        }
        return next();
      });
      
      // Resolve only the dedicated RT/PT renderer output.
      let rendererPath;
      if (isDev) {
        rendererPath = path.join(__dirname, '..', 'rtpt-dist');
      } else {
        // In production, the RT/PT renderer is unpacked from asar.
        rendererPath = path.join(process.resourcesPath, 'app.asar.unpacked', 'rtpt-dist');
      }
      
      console.log('=== SERVER STARTUP DEBUG ===');
      console.log('isDev:', isDev);
      console.log('Resources path:', process.resourcesPath);
      console.log('RT/PT renderer path:', rendererPath);
      console.log('RT/PT renderer exists:', fs.existsSync(rendererPath));
      
      // Check the unpacked renderer first, then the same dedicated path in asar.
      if (!fs.existsSync(rendererPath)) {
        console.log('RT/PT renderer not found at expected path, trying asar...');
        
        // Try direct app.asar path (Electron can read from asar)
        const asarRendererPath = path.join(process.resourcesPath, 'app.asar', 'rtpt-dist');
        console.log('Trying RT/PT asar path:', asarRendererPath);
        console.log('RT/PT asar path exists:', fs.existsSync(asarRendererPath));
        
        if (fs.existsSync(asarRendererPath)) {
          rendererPath = asarRendererPath;
        }
      }
      
      // List the dedicated renderer contents for debugging.
      if (fs.existsSync(rendererPath)) {
        console.log('RT/PT renderer contents:', fs.readdirSync(rendererPath));
        const indexExists = fs.existsSync(path.join(rendererPath, 'index.html'));
        console.log('index.html exists:', indexExists);
      } else {
        console.error('ERROR: rtpt-dist renderer folder not found anywhere!');
        // List resources folder to see what's there
        console.log('Resources contents:', fs.readdirSync(process.resourcesPath));
      }
      
      // Ensure data directory exists
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }

      expressApp.use(express.json({ limit: '10mb' }));
      
      // Log all requests for debugging
      expressApp.use((req, res, next) => {
        console.log('Request:', req.method, req.url);
        next();
      });
      
      // Serve static files only from the dedicated RT/PT renderer output.
      expressApp.use(express.static(rendererPath));

      // Keep the activation shell and operational endpoints available while
      // protecting every RT/PT data surface with a fresh fail-closed check.
      expressApp.use([
        '/api/technique-sheets',
        '/api/organizations',
        '/api/inspector-profiles',
      ], (req, res, next) => {
        const licenseStatus = getRtPtLicenseStatus();
        if (licenseStatus.active !== true) {
          return res.status(403).json({
            error: 'An active RT/PT Inspector license is required.',
            status: licenseStatus.status,
            reason: licenseStatus.reason,
            installationId: licenseStatus.installationId,
          });
        }
        return next();
      });

      // Simple file-based data storage for technique sheets
      const sheetsFile = path.join(dataDir, 'technique-sheets.json');
      const orgsFile = path.join(dataDir, 'organizations.json');
      const profilesFile = path.join(dataDir, 'inspector-profiles.json');

      // Default organization for Electron (offline) mode
      const DEFAULT_ELECTRON_ORG = [{
        id: "11111111-1111-1111-1111-111111111111",
        name: "Local Workspace",
        slug: "local",
        plan: "free",
        isActive: true,
        userRole: "owner"
      }];

      // Initialize files if they don't exist
      if (!fs.existsSync(sheetsFile)) fs.writeFileSync(sheetsFile, '[]');
      if (!fs.existsSync(profilesFile)) fs.writeFileSync(profilesFile, '[]');
      // Initialize orgs with default org (valid UUID) for Electron mode
      if (!fs.existsSync(orgsFile)) {
        fs.writeFileSync(orgsFile, JSON.stringify(DEFAULT_ELECTRON_ORG, null, 2));
      } else {
        // Fix existing empty organizations file
        try {
          const existingOrgs = JSON.parse(fs.readFileSync(orgsFile, 'utf8'));
          if (!Array.isArray(existingOrgs) || existingOrgs.length === 0) {
            fs.writeFileSync(orgsFile, JSON.stringify(DEFAULT_ELECTRON_ORG, null, 2));
          }
        } catch (e) {
          fs.writeFileSync(orgsFile, JSON.stringify(DEFAULT_ELECTRON_ORG, null, 2));
        }
      }

      // API Routes
      expressApp.get('/api/technique-sheets', (req, res) => {
        try {
          const data = JSON.parse(fs.readFileSync(sheetsFile, 'utf8'));
          const rtPtSheets = Array.isArray(data)
            ? data.filter((sheet) => isReadableRtPtDocument(sheet?.data))
            : [];
          res.json(rtPtSheets);
        } catch (e) {
          res.json([]);
        }
      });

      expressApp.post('/api/technique-sheets', (req, res) => {
        try {
          if (!isWritableRtPtDocument(req.body?.data)) {
            return rejectNonRtPtTechniqueSheet(res);
          }
          const sheets = JSON.parse(fs.readFileSync(sheetsFile, 'utf8'));
          const newSheet = { ...req.body, id: Date.now() };
          sheets.push(newSheet);
          fs.writeFileSync(sheetsFile, JSON.stringify(sheets, null, 2));
          res.json(newSheet);
        } catch (e) {
          res.status(500).json({ error: e.message });
        }
      });

      expressApp.get('/api/technique-sheets/:id', (req, res) => {
        try {
          const sheets = JSON.parse(fs.readFileSync(sheetsFile, 'utf8'));
          const sheet = sheets.find(s => String(s.id) === String(req.params.id));
          if (sheet) {
            if (!isReadableRtPtDocument(sheet.data)) {
              return rejectNonRtPtTechniqueSheet(res);
            }
            res.json(sheet);
          } else {
            res.status(404).json({ error: 'Technique sheet not found' });
          }
        } catch (e) {
          res.status(500).json({ error: e.message });
        }
      });

      expressApp.patch('/api/technique-sheets/:id', (req, res) => {
        try {
          const sheets = JSON.parse(fs.readFileSync(sheetsFile, 'utf8'));
          const index = sheets.findIndex(s => String(s.id) === String(req.params.id));
          if (index !== -1) {
            const updatedSheet = { ...sheets[index], ...req.body, id: sheets[index].id };
            if (!isWritableRtPtDocument(updatedSheet.data)) {
              return rejectNonRtPtTechniqueSheet(res);
            }
            sheets[index] = updatedSheet;
            fs.writeFileSync(sheetsFile, JSON.stringify(sheets, null, 2));
            res.json(sheets[index]);
          } else {
            res.status(404).json({ error: 'Technique sheet not found' });
          }
        } catch (e) {
          res.status(500).json({ error: e.message });
        }
      });

      expressApp.delete('/api/technique-sheets/:id', (req, res) => {
        try {
          const sheets = JSON.parse(fs.readFileSync(sheetsFile, 'utf8'));
          const index = sheets.findIndex(s => String(s.id) === String(req.params.id));
          if (index !== -1) {
            sheets.splice(index, 1);
            fs.writeFileSync(sheetsFile, JSON.stringify(sheets, null, 2));
            res.json({ success: true });
          } else {
            res.status(404).json({ error: 'Technique sheet not found' });
          }
        } catch (e) {
          res.status(500).json({ error: e.message });
        }
      });

      expressApp.get('/api/organizations', (req, res) => {
        try {
          const data = JSON.parse(fs.readFileSync(orgsFile, 'utf8'));
          res.json(data);
        } catch (e) {
          res.json([]);
        }
      });

      expressApp.get('/api/organizations/:id', (req, res) => {
        try {
          const orgs = JSON.parse(fs.readFileSync(orgsFile, 'utf8'));
          const org = orgs.find(o => String(o.id) === String(req.params.id));
          if (org) {
            res.json(org);
          } else {
            res.status(404).json({ error: 'Organization not found' });
          }
        } catch (e) {
          res.status(500).json({ error: e.message });
        }
      });

      expressApp.get('/api/organizations/:id/role', (req, res) => {
        // In Electron offline mode, user is always the owner
        res.json({ role: 'owner' });
      });

      expressApp.post('/api/logs', (req, res) => {
        // Just acknowledge logs without saving
        res.json({ success: true });
      });

      // Inspector Profiles API Routes
      expressApp.get('/api/inspector-profiles', (req, res) => {
        try {
          const data = JSON.parse(fs.readFileSync(profilesFile, 'utf8'));
          res.json(data);
        } catch (e) {
          res.json([]);
        }
      });

      expressApp.get('/api/inspector-profiles/:id', (req, res) => {
        try {
          const profiles = JSON.parse(fs.readFileSync(profilesFile, 'utf8'));
          const profile = profiles.find(p => String(p.id) === String(req.params.id));
          if (profile) {
            res.json(profile);
          } else {
            res.status(404).json({ error: 'Profile not found' });
          }
        } catch (e) {
          res.status(500).json({ error: e.message });
        }
      });

      expressApp.post('/api/inspector-profiles', (req, res) => {
        try {
          const profiles = JSON.parse(fs.readFileSync(profilesFile, 'utf8'));
          const newProfile = { ...req.body };
          profiles.push(newProfile);
          fs.writeFileSync(profilesFile, JSON.stringify(profiles, null, 2));
          console.log('Profile saved:', newProfile.name);
          res.json(newProfile);
        } catch (e) {
          res.status(500).json({ error: e.message });
        }
      });

      expressApp.patch('/api/inspector-profiles/:id', (req, res) => {
        try {
          const profiles = JSON.parse(fs.readFileSync(profilesFile, 'utf8'));
          const index = profiles.findIndex(p => String(p.id) === String(req.params.id));
          if (index !== -1) {
            profiles[index] = { ...profiles[index], ...req.body };
            fs.writeFileSync(profilesFile, JSON.stringify(profiles, null, 2));
            res.json(profiles[index]);
          } else {
            res.status(404).json({ error: 'Profile not found' });
          }
        } catch (e) {
          res.status(500).json({ error: e.message });
        }
      });

      expressApp.delete('/api/inspector-profiles/:id', (req, res) => {
        try {
          const profiles = JSON.parse(fs.readFileSync(profilesFile, 'utf8'));
          const index = profiles.findIndex(p => String(p.id) === String(req.params.id));
          if (index !== -1) {
            profiles.splice(index, 1);
            fs.writeFileSync(profilesFile, JSON.stringify(profiles, null, 2));
            res.json({ success: true });
          } else {
            res.status(404).json({ error: 'Profile not found' });
          }
        } catch (e) {
          res.status(500).json({ error: e.message });
        }
      });

      // Fallback to index.html for SPA routing (use regex for Express 5 compatibility)
      expressApp.use((req, res, next) => {
        // Only handle GET requests that aren't API routes
        if (req.method === 'GET' && !req.url.startsWith('/api/')) {
          const indexPath = path.join(rendererPath, 'index.html');
          res.sendFile(indexPath);
        } else {
          next();
        }
      });

      // Bind an OS-assigned free port (0) instead of a fixed 5000. This is the
      // fix for the cross-product collision: the desktop app now serves and loads
      // its own private origin and can never pick up another app's 5000 server.
      embeddedServer = expressApp.listen(0, EMBEDDED_SERVER_HOST, () => {
        const { port } = embeddedServer.address();
        activeServerOrigin = `http://${EMBEDDED_SERVER_HOST}:${port}`;
        allowedHosts.add(`${EMBEDDED_SERVER_HOST}:${port}`);
        allowedHosts.add(`localhost:${port}`);
        allowedOrigins.add(activeServerOrigin);
        allowedOrigins.add(`http://localhost:${port}`);
        console.log(`Embedded server running at ${activeServerOrigin}`);
        resolve();
      });
      
      embeddedServer.on('error', (err) => {
        console.error('Server error:', err);
        reject(err);
      });
    } catch (error) {
      console.error('Failed to create server:', error);
      reject(error);
    }
  });
}

// App event handlers
app.whenReady().then(async () => {
  // In packaged app, app.isPackaged is true
  isDev = !app.isPackaged;

  // License verification depends on Electron's ready-only safeStorage and the
  // independent RT/PT userData directory. Missing configuration stays closed.
  initializeRtPtLicenseService();

  // Setup IPC handlers
  setupIPCHandlers();

  // Initialize autoUpdater
  if (!isDev) {
    initAutoUpdater();
  }

  // Create window (will start embedded server inside)
  await createWindow();

  // Check for updates on startup (production only)
  if (!isDev) {
    setTimeout(() => {
      console.log('🚀 Initial update check on startup...');
      safeCheckForUpdates().catch(err => {
        console.error('Initial update check failed:', err.message);
      });
    }, 3000);
  }

  app.on('activate', async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (embeddedServer) {
    embeddedServer.close();
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  if (embeddedServer) {
    embeddedServer.close();
  }
});

// Security: Prevent new window creation
app.on('web-contents-created', (event, contents) => {
  contents.on('new-window', (event, navigationUrl) => {
    event.preventDefault();
    void openExternalSafely(navigationUrl);
  });
});
