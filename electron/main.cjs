const { app, BrowserWindow, Menu, shell, dialog, ipcMain, screen } = require('electron');
const path = require('path');
const express = require('express');
const fs = require('fs');
const LicenseManager = require('./license-manager.cjs');
const OfflineUpdater = require('./offline-updater.cjs');

// Load environment variables from .env files
// Order: .env.local > .env (for API keys like Claude)
function loadEnvFiles() {
  try {
    const dotenv = require('dotenv');
    const appRoot = path.join(__dirname, '..');

    console.log('📁 Looking for .env files in:', appRoot);

    // Try .env first (base config)
    const envPath = path.join(appRoot, '.env');
    if (fs.existsSync(envPath)) {
      const result = dotenv.config({ path: envPath, override: true });
      console.log('✅ Loaded .env:', result.error ? result.error.message : 'OK');
    } else {
      console.log('⚠️ .env not found at:', envPath);
    }

    // Then .env.local (overrides - user's private keys)
    const localEnvPath = path.join(appRoot, '.env.local');
    if (fs.existsSync(localEnvPath)) {
      const result = dotenv.config({ path: localEnvPath, override: true });
      console.log('✅ Loaded .env.local:', result.error ? result.error.message : 'OK');
    } else {
      console.log('⚠️ .env.local not found at:', localEnvPath);
    }

    // Debug: show if API key is loaded (masked)
    const apiKey = process.env.VITE_ANTHROPIC_API_KEY;
    if (apiKey) {
      console.log('🔑 VITE_ANTHROPIC_API_KEY loaded:', apiKey.substring(0, 15) + '...');
    } else {
      console.log('❌ VITE_ANTHROPIC_API_KEY not found in environment');
    }
  } catch (err) {
    console.log('⚠️ Could not load .env files:', err.message);
  }
}

// Load from project folder immediately
loadEnvFiles();

// Function to load user-specific API keys (called after app.ready)
function loadUserApiKeys() {
  try {
    const dotenv = require('dotenv');
    const userDataEnv = path.join(app.getPath('userData'), 'api-keys.env');
    if (fs.existsSync(userDataEnv)) {
      dotenv.config({ path: userDataEnv });
      console.log('✅ Loaded api-keys.env from user data');
    }
  } catch (err) {
    console.log('⚠️ Could not load user API keys:', err.message);
  }
}

// GPU stability flags - keep GPU enabled for WebGL but with safe settings
app.commandLine.appendSwitch('disable-gpu-sandbox');
app.commandLine.appendSwitch('disable-gpu-watchdog');
app.commandLine.appendSwitch('ignore-gpu-blocklist');
app.commandLine.appendSwitch('enable-webgl');
app.commandLine.appendSwitch('use-angle', 'default');
app.commandLine.appendSwitch('no-sandbox');

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
let licenseManager;
let autoUpdater;
let isDev;
let offlineUpdater;
let silentUpdateTimer = null;
let updateCheckInterval = null;
const pendingUpdatePreparation = new Map();

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

function getMroDirectoryCandidates() {
  const repoRoot = path.join(__dirname, '..');
  const executableDir = path.dirname(process.execPath);

  return [
    process.env.SCANMASTER_MRO_DIR,
    path.join(process.cwd(), 'public', 'standards', 'MRO'),
    path.join(repoRoot, 'public', 'standards', 'MRO'),
    path.join(executableDir, 'MRO'),
    path.join(executableDir, 'public', 'standards', 'MRO'),
    process.resourcesPath ? path.join(process.resourcesPath, 'MRO') : null,
    process.resourcesPath ? path.join(process.resourcesPath, 'public', 'standards', 'MRO') : null,
  ].filter(Boolean);
}

function resolveMroDirectory() {
  const seen = new Set();

  for (const candidate of getMroDirectoryCandidates()) {
    const normalized = path.resolve(candidate);
    if (seen.has(normalized)) {
      continue;
    }

    seen.add(normalized);

    try {
      if (fs.existsSync(normalized) && fs.statSync(normalized).isDirectory()) {
        return normalized;
      }
    } catch (error) {
      console.warn('Failed to inspect MRO directory candidate:', normalized, error.message);
    }
  }

  return null;
}

const MRO_SUPPORTED_NAME_PATTERNS = [
  /\bNDIP[-\s]?1226\b/i,
  /\bNDIP[-\s]?1227\b/i,
  /\b2A5001\b/i,
  /\b2A4802\b/i,
  /\bV2500\b/i,
];
const MRO_DUPLICATE_SUFFIX_PATTERN = /_(\d+)(?=\.[^.]+$)/;

function isSupportedMroAssetName(name) {
  return MRO_SUPPORTED_NAME_PATTERNS.some((pattern) => pattern.test(name));
}

function normalizeMroAssetVariantName(name) {
  return name.replace(MRO_DUPLICATE_SUFFIX_PATTERN, '');
}

function compareMroEntryPriority(left, right) {
  const leftIsDuplicate = MRO_DUPLICATE_SUFFIX_PATTERN.test(left.name);
  const rightIsDuplicate = MRO_DUPLICATE_SUFFIX_PATTERN.test(right.name);

  if (leftIsDuplicate !== rightIsDuplicate) {
    return leftIsDuplicate ? 1 : -1;
  }

  return left.name.localeCompare(right.name);
}

function getVisibleMroEntries(mroDir) {
  const entries = fs.readdirSync(mroDir, { withFileTypes: true });
  const visibleByCanonicalName = new Map();

  entries
    .filter((entry) => entry.isFile() && isSupportedMroAssetName(entry.name))
    .sort(compareMroEntryPriority)
    .forEach((entry) => {
      const canonicalName = normalizeMroAssetVariantName(entry.name);
      if (!visibleByCanonicalName.has(canonicalName)) {
        visibleByCanonicalName.set(canonicalName, entry);
      }
    });

  return Array.from(visibleByCanonicalName.values()).sort((left, right) => left.name.localeCompare(right.name));
}

function buildMroAssetResponse(fileName, stats) {
  const safeName = path.basename(fileName);
  const extension = path.extname(safeName).toLowerCase();
  const encodedName = encodeURIComponent(safeName);

  return {
    name: safeName,
    extension,
    size: stats.size,
    modifiedAt: stats.mtime.toISOString(),
    assetUrl: `/api/mro-assets/file/${encodedName}`,
    downloadUrl: `/api/mro-assets/file/${encodedName}?download=1`,
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

  // GitHub releases are configured in electron-builder.json
  // No custom feed URL configuration needed
  console.log('📦 Current app version:', app.getVersion());
  console.log('🔗 Update provider: disabled (RT-PT Inspector is distributed standalone)');

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
  // Window control handlers
  ipcMain.handle('window-minimize', () => {
    if (mainWindow) mainWindow.minimize();
  });

  ipcMain.handle('window-maximize', () => {
    if (mainWindow) {
      if (mainWindow.isMaximized()) {
        mainWindow.restore();
      } else {
        mainWindow.maximize();
      }
    }
  });

  ipcMain.handle('app-quit', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.close();
      return;
    }

    app.quit();
  });

  ipcMain.handle('confirm-app-close', () => {
    closeApproved = true;

    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.close();
      return { success: true };
    }

    app.quit();
    return { success: true };
  });

  ipcMain.handle('open-external-url', async (event, url) => {
    try {
      const targetUrl = new URL(String(url || ''));
      if (!['https:', 'http:', 'mailto:'].includes(targetUrl.protocol)) {
        return { success: false, error: 'Blocked unsupported URL protocol' };
      }

      await shell.openExternal(targetUrl.toString());
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
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
  
  // New: Get/Set update settings
  ipcMain.handle('get-update-settings', () => {
    return UPDATE_SETTINGS;
  });
  
  ipcMain.handle('set-update-settings', (event, settings) => {
    Object.assign(UPDATE_SETTINGS, settings);
    // Re-setup periodic checks if interval changed
    if (settings.checkInterval) {
      setupPeriodicUpdateChecks();
    }
    return UPDATE_SETTINGS;
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
  ipcMain.handle('save-pdf', async (event, { data, filename }) => {
    try {
      // Show save dialog
      const { filePath } = await dialog.showSaveDialog(mainWindow, {
        defaultPath: path.join(app.getPath('downloads'), filename),
        filters: [
          { name: 'PDF Files', extensions: ['pdf'] }
        ]
      });

      if (filePath) {
        // Convert base64 to buffer and save
        const buffer = Buffer.from(data, 'base64');
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

  // License Management IPC Handlers
  ipcMain.handle('license:check', () => {
    return licenseManager.getLicense();
  });

  ipcMain.handle('license:activate', async (event, licenseKey) => {
    return await licenseManager.activateLicense(licenseKey);
  });

  ipcMain.handle('license:getInfo', () => {
    return licenseManager.getLicenseInfo();
  });

  ipcMain.handle('license:hasStandard', (event, standardCode) => {
    return licenseManager.hasStandard(standardCode);
  });

  ipcMain.handle('license:getStandards', () => {
    return licenseManager.getStandardsCatalog();
  });

  ipcMain.handle('license:deactivate', () => {
    licenseManager.deactivate();
    return { success: true };
  });

  // Offline Activation IPC Handlers
  ipcMain.handle('license:generateActivationRequest', () => {
    return licenseManager.generateActivationRequest();
  });

  ipcMain.handle('license:activateOffline', async (event, licenseKey, responseCode) => {
    return await licenseManager.activateOffline(licenseKey, responseCode);
  });

  ipcMain.handle('license:getMachineInfo', () => {
    return licenseManager.getMachineInfo();
  });

  // ==========================================
  // Offline Update IPC Handlers (USB Updates)
  // ==========================================

  // Initialize offline updater
  offlineUpdater = new OfflineUpdater({
    currentVersion: app.getVersion(),
    appPath: app.getPath('exe'),
    tempDir: app.getPath('temp'),
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
  ipcMain.handle('offline-update:browse', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Select Update Folder (USB Drive)',
      properties: ['openDirectory'],
      buttonLabel: 'Select Folder'
    });

    if (result.canceled || !result.filePaths[0]) {
      return { cancelled: true };
    }

    return { path: result.filePaths[0] };
  });

  // Scan for updates in a directory
  ipcMain.handle('offline-update:scan', async (event, directoryPath) => {
    return await offlineUpdater.scanForUpdates(directoryPath);
  });

  // Validate an update package
  ipcMain.handle('offline-update:validate', async (event, packageInfo) => {
    return await offlineUpdater.validatePackage(packageInfo);
  });

  // Install update from USB
  ipcMain.handle('offline-update:install', async (event, packageInfo, options) => {
    try {
      const result = await offlineUpdater.installUpdate(packageInfo, options);

      // If installation started, quit the app
      if (result.success && options.autoRestart !== false) {
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
  ipcMain.handle('offline-update:getDisplayInfo', (event, packageInfo) => {
    return offlineUpdater.getPackageDisplayInfo(packageInfo);
  });

  // Get current version
  ipcMain.handle('offline-update:getCurrentVersion', () => {
    return app.getVersion();
  });

  // ==========================================
  // Claude Vision API Handler (Secure)
  // API key stays in main process, never exposed to renderer
  // ==========================================
  ipcMain.handle('claude:analyzeDrawing', async (event, { imageBase64, mediaType }) => {
    try {
      // Get API key from saved location or environment
      const apiKey = getClaudeApiKey();

      if (!apiKey) {
        return {
          success: false,
          error: 'No Claude API key configured',
          geometry: 'unknown',
          confidence: 0,
          reasoning: 'API key not found. Please configure it in Settings → Claude API Key.'
        };
      }

      // NDT Analysis Prompt - optimized for precise arrow placement
      const NDT_PROMPT = `You are an expert NDT (Non-Destructive Testing) engineer analyzing a technical drawing.

YOUR TASKS:
1. Identify the geometry type of the part
2. Visually locate EXACTLY where the part appears in the image
3. Place scan direction arrows PRECISELY on the visible surfaces

=== STEP 1: IDENTIFY GEOMETRY ===
Look for text labels or analyze the visual shape:
• PLATE/BLOCK: Rectangular solid with flat faces
• CYLINDER: Solid circular cross-section (NO center hole)
• TUBE: HOLLOW circular with visible ID (inner diameter) and OD (outer diameter)
• CONE: Tapered shape - wider at one end, narrower at other
• DISK: Flat circular shape, like a coin or pancake
• RING: Thick-walled donut/annular shape with large center hole
• IMPELLER: Complex part with blades/vanes, stepped hub profile
• SPHERE: Round ball shape

=== STEP 2: MEASURE THE ACTUAL PART LOCATION ===
CRITICAL - You MUST visually measure where the part is in the image!

Look at the image and identify:
1. The LEFT-MOST pixel of the part → this is x_left (as 0-1 fraction of image width)
2. The RIGHT-MOST pixel of the part → this is x_right
3. The TOP-MOST pixel of the part → this is y_top
4. The BOTTOM-MOST pixel of the part → this is y_bottom

IGNORE these when measuring: title blocks, dimension lines, text labels, borders, whitespace

Example: If the part occupies the center-right portion of the image:
- x_left might be 0.35, x_right might be 0.90
- y_top might be 0.15, y_bottom might be 0.85

=== STEP 3: PLACE ARROWS ON MEASURED SURFACES ===
Now place arrows AT THE EDGES of the part you measured!

Coordinate system:
- x=0 is LEFT edge of IMAGE, x=1 is RIGHT edge
- y=0 is TOP edge of IMAGE, y=1 is BOTTOM edge
- angle: 0°=pointing right, 90°=pointing down, 180°=pointing left, 270°=pointing up

ARROW RULES:
1. Arrow BASE (origin point) should be OUTSIDE the part, about 5-10% away from the surface
2. Arrow points INTO the part (toward the surface where ultrasound enters)
3. Arrows must be perpendicular to the entry surface
4. Place arrows on ALL accessible surfaces shown in ALL views

MULTI-VIEW DRAWINGS:
Many drawings show multiple views (Front + Side, or Top + Front + Side).
You MUST place arrows on EACH VIEW separately!

Example: A tube drawing with front view (circle) at x=0.2-0.4 and side view (rectangle) at x=0.55-0.95:
- For front view circle centered at x=0.30:
  - Place "C" arrow at x=0.12 (left of circle OD), y=0.50, angle=0
  - Place "D" arrow at x=0.48 (right of circle OD), y=0.50, angle=180
- For side view rectangle from x=0.55 to x=0.95:
  - Place "A" arrow at x=0.75, y=(y_top - 0.05), angle=90 (from top)
  - Place "B" arrow at x=0.75, y=(y_bottom + 0.05), angle=270 (from bottom)

=== ARROW DIRECTIONS BY GEOMETRY ===

PLATE/BLOCK:
- A: Top surface entry (perpendicular, angle=90)
- B: Bottom surface entry (perpendicular, angle=270)
- C: Left side entry (angle=0)
- D: Right side entry (angle=180)
- E,F: 45° shear waves

TUBE/CYLINDER (place on BOTH front circle view AND side profile view):
- A: Axial from top end
- B: Axial from bottom end
- C: Radial from OD (left side of circle)
- D: Radial from OD (right side of circle)
- E: Circumferential CW
- F: Circumferential CCW
- If tube has ID visible: also add arrows from ID surface

CONE:
- A: Axial from large end
- B: Axial from small end
- C,D: Radial from OD at various heights
- E: Along tapered surface (angle matches taper)

IMPELLER:
- A: Axial from hub top
- B: Axial from hub bottom
- C,D: Radial from hub OD
- E,F: At blade/vane surfaces if visible

=== OUTPUT FORMAT ===
Return ONLY a JSON object (no other text):
{
  "geometry": "tube",
  "confidence": 0.92,
  "reasoning": "Describe what you see: the views present, where the part is located in the image, key features identified",
  "partBounds": {
    "x_left": 0.15,
    "x_right": 0.85,
    "y_top": 0.10,
    "y_bottom": 0.90
  },
  "suggestedArrows": [
    {"direction": "A", "x": 0.50, "y": 0.05, "angle": 90, "label": "Axial top"},
    {"direction": "B", "x": 0.50, "y": 0.95, "angle": 270, "label": "Axial bottom"},
    {"direction": "C", "x": 0.10, "y": 0.50, "angle": 0, "label": "Radial OD left"},
    {"direction": "D", "x": 0.90, "y": 0.50, "angle": 180, "label": "Radial OD right"}
  ]
}

CRITICAL REMINDERS:
- The x,y coordinates MUST match where you actually SEE the part in this specific image
- Do NOT use generic template positions - LOOK at the image and MEASURE
- If the part is in the right half of the image, x values should be 0.5-1.0
- If there are multiple views, place arrows on EACH view
- Arrow base should be slightly OUTSIDE the part surface (5-10% gap)`;

      // Make API call to Claude (using node-fetch in main process)
      const https = require('https');

      const requestBody = JSON.stringify({
        model: 'claude-opus-4-5-20251101',
        max_tokens: 1200,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mediaType || 'image/png',
                data: imageBase64,
              },
            },
            {
              type: 'text',
              text: NDT_PROMPT,
            },
          ],
        }],
      });

      return new Promise((resolve) => {
        const req = https.request({
          hostname: 'api.anthropic.com',
          path: '/v1/messages',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'Content-Length': Buffer.byteLength(requestBody),
          },
        }, (res) => {
          let data = '';
          res.on('data', chunk => data += chunk);
          res.on('end', () => {
            try {
              const response = JSON.parse(data);

              if (res.statusCode !== 200) {
                console.error('Claude API Error:', response);
                resolve({
                  success: false,
                  error: response.error?.message || `API returned ${res.statusCode}`,
                  geometry: 'unknown',
                  confidence: 0,
                  reasoning: `API Error: ${response.error?.message || res.statusCode}`
                });
                return;
              }

              const responseText = response.content?.[0]?.text || '';
              console.log('Claude Response:', responseText.substring(0, 200));

              // Parse JSON from response
              const jsonMatch = responseText.match(/\{[\s\S]*\}/);
              if (!jsonMatch) {
                resolve({
                  success: false,
                  error: 'Could not parse Claude response',
                  geometry: 'unknown',
                  confidence: 0,
                  reasoning: 'Failed to parse AI response'
                });
                return;
              }

              const parsed = JSON.parse(jsonMatch[0]);

              resolve({
                success: true,
                geometry: parsed.geometry || 'unknown',
                confidence: parsed.confidence || 0,
                reasoning: parsed.reasoning || 'No reasoning provided',
                suggestedArrows: parsed.suggestedArrows || []
              });
            } catch (parseError) {
              console.error('Parse error:', parseError);
              resolve({
                success: false,
                error: parseError.message,
                geometry: 'unknown',
                confidence: 0,
                reasoning: 'Failed to parse response'
              });
            }
          });
        });

        req.on('error', (error) => {
          console.error('Request error:', error);
          resolve({
            success: false,
            error: error.message,
            geometry: 'unknown',
            confidence: 0,
            reasoning: `Request failed: ${error.message}`
          });
        });

        req.write(requestBody);
        req.end();
      });

    } catch (error) {
      console.error('Claude Vision IPC Error:', error);
      return {
        success: false,
        error: error.message,
        geometry: 'unknown',
        confidence: 0,
        reasoning: `Error: ${error.message}`
      };
    }
  });

  // Check Claude API availability
  ipcMain.handle('claude:checkStatus', async () => {
    const apiKey = getClaudeApiKey();
    return {
      available: !!apiKey,
      error: apiKey ? null : 'No API key configured'
    };
  });

  // Save Claude API key to user data folder
  ipcMain.handle('claude:saveApiKey', async (event, apiKey) => {
    try {
      const keyFile = path.join(app.getPath('userData'), 'claude-api-key.enc');

      // Simple obfuscation (not true encryption, but hides from casual viewing)
      const obfuscated = Buffer.from(apiKey).toString('base64');
      fs.writeFileSync(keyFile, obfuscated, 'utf8');

      // Also set in process.env for immediate use
      process.env.VITE_ANTHROPIC_API_KEY = apiKey;

      console.log('✅ Claude API key saved');
      return { success: true };
    } catch (error) {
      console.error('❌ Failed to save API key:', error);
      return { success: false, error: error.message };
    }
  });

  // Load Claude API key from user data folder
  ipcMain.handle('claude:loadApiKey', async () => {
    try {
      const apiKey = getClaudeApiKey();
      return {
        success: true,
        hasKey: !!apiKey,
        // Return masked key for display (first 10 chars + ...)
        maskedKey: apiKey ? apiKey.substring(0, 15) + '...' : null
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // Delete Claude API key
  ipcMain.handle('claude:deleteApiKey', async () => {
    try {
      const keyFile = path.join(app.getPath('userData'), 'claude-api-key.enc');
      if (fs.existsSync(keyFile)) {
        fs.unlinkSync(keyFile);
      }
      delete process.env.VITE_ANTHROPIC_API_KEY;
      console.log('✅ Claude API key deleted');
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });
}

// Helper function to get Claude API key from various sources
function getClaudeApiKey() {
  // 1. Check process.env (from .env files or previously set)
  if (process.env.VITE_ANTHROPIC_API_KEY) {
    return process.env.VITE_ANTHROPIC_API_KEY;
  }

  // 2. Check saved key in user data folder
  try {
    const keyFile = path.join(app.getPath('userData'), 'claude-api-key.enc');
    if (fs.existsSync(keyFile)) {
      const obfuscated = fs.readFileSync(keyFile, 'utf8');
      const apiKey = Buffer.from(obfuscated, 'base64').toString('utf8');
      // Cache it in process.env
      process.env.VITE_ANTHROPIC_API_KEY = apiKey;
      return apiKey;
    }
  } catch (err) {
    console.error('Error reading saved API key:', err);
  }

  return null;
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
          label: 'New Technique Sheet',
          accelerator: 'CmdOrCtrl+N',
          click: () => {
            mainWindow.webContents.send('new-sheet');
          }
        },
        {
          label: 'Export PDF',
          accelerator: 'CmdOrCtrl+P',
          click: () => {
            mainWindow.webContents.send('export-pdf');
          }
        },
        { type: 'separator' },
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
        { label: 'Toggle Developer Tools', accelerator: 'F12', role: 'toggleDevTools' },
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
        { type: 'separator' },
        {
          label: 'About RT-PT Inspector',
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'About RT-PT Inspector',
              message: 'RT-PT Inspector',
              detail: `Radiographic and penetrant technique-sheet creator\n(ASTM E1742 / E2698 / E1417)\n\nVersion: ${app.getVersion()}\n\nBuilt with Electron, React, and Node.js`,
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
        // Notify renderer that download is complete
        if (mainWindow) {
          mainWindow.webContents.send('download-complete', {
            success: true,
            path: savePath,
            fileName: fileName
          });
        }
        // Open the file location in explorer/finder
        shell.showItemInFolder(savePath);
      } else {
        console.log('Download failed:', state);
        if (mainWindow) {
          mainWindow.webContents.send('download-complete', {
            success: false,
            error: state
          });
        }
      }
    });
  });
  
  // Calculate responsive minimum sizes based on screen and scale
  // For high DPI displays, we need smaller minimums
  const baseMinWidth = Math.min(1024, Math.floor(screenWidth * 0.6));
  const baseMinHeight = Math.min(768, Math.floor(screenHeight * 0.6));
  
  // Create the browser window with proper scaling support
  mainWindow = new BrowserWindow({
    width: Math.min(1400, screenWidth),
    height: Math.min(900, screenHeight),
    minWidth: baseMinWidth,
    minHeight: baseMinHeight,
    show: false, // Don't show until ready
    icon: path.join(__dirname, '../public/favicon.ico'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
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
    title: 'RT-PT Inspector',
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

  // Handle window resize to ensure proper layout
  mainWindow.on('resize', () => {
    // Notify renderer of resize for any needed adjustments
    if (mainWindow && mainWindow.webContents) {
      const [width, height] = mainWindow.getSize();
      mainWindow.webContents.send('window-resized', { width, height, scaleFactor });
    }
  });

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
    // Allow both localhost (for embedded server) and file:// (for fallback)
    const cspPolicy = "default-src 'self' 'unsafe-inline' 'unsafe-eval' data: blob: http://localhost:* file:; script-src 'self' 'unsafe-inline' 'unsafe-eval' http://localhost:* file:; style-src 'self' 'unsafe-inline' http://localhost:* file:; img-src 'self' data: blob: http://localhost:* file: https://storage.googleapis.com https:; connect-src 'self' http://localhost:* https: file:; font-src 'self' data: file:";
    
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [cspPolicy]
      }
    });
  });

  // Send display info to renderer when ready
  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow.webContents.send('display-info', {
      scaleFactor,
      screenWidth,
      screenHeight,
      zoomFactor: scaleFactor > 1.25 ? 1.0 : 1.1
    });
  });

  // Load the app
  if (isDev) {
    mainWindow.loadURL('http://localhost:5000');
    mainWindow.webContents.openDevTools();
  } else {
    // In production, start embedded server first, then load through it
    try {
      await startEmbeddedServer();
      console.log('Server started, loading from http://localhost:5000');
      
      // Wait a moment for server to be ready
      await new Promise(resolve => setTimeout(resolve, 500));
      
      mainWindow.loadURL('http://localhost:5000');
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

  // Handle external links
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

// Embedded Express server for production
function startEmbeddedServer() {
  return new Promise((resolve, reject) => {
    try {
      const expressApp = express();
      const dataDir = path.join(app.getPath('userData'), 'data');
      
      // Get the correct path for static files
      let distPath;
      if (isDev) {
        distPath = path.join(__dirname, '..', 'dist');
      } else {
        // In production, dist is unpacked from asar
        distPath = path.join(process.resourcesPath, 'app.asar.unpacked', 'dist');
      }
      
      console.log('=== SERVER STARTUP DEBUG ===');
      console.log('isDev:', isDev);
      console.log('Resources path:', process.resourcesPath);
      console.log('Dist path:', distPath);
      console.log('Dist exists:', fs.existsSync(distPath));
      
      // Check if dist exists, if not try alternative paths
      if (!fs.existsSync(distPath)) {
        console.log('Dist not found at expected path, trying alternatives...');
        
        // Try direct app.asar path (Electron can read from asar)
        const asarDistPath = path.join(process.resourcesPath, 'app.asar', 'dist');
        console.log('Trying asar path:', asarDistPath);
        console.log('Asar path exists:', fs.existsSync(asarDistPath));
        
        if (fs.existsSync(asarDistPath)) {
          distPath = asarDistPath;
        }
      }
      
      // List dist contents for debugging
      if (fs.existsSync(distPath)) {
        console.log('Dist contents:', fs.readdirSync(distPath));
        const indexExists = fs.existsSync(path.join(distPath, 'index.html'));
        console.log('index.html exists:', indexExists);
      } else {
        console.error('ERROR: dist folder not found anywhere!');
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
      
      // Serve static files from dist
      expressApp.use(express.static(distPath));

      // Simple file-based data storage for technique sheets
      const sheetsFile = path.join(dataDir, 'technique-sheets.json');
      const standardsFile = path.join(dataDir, 'standards.json');
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
      if (!fs.existsSync(standardsFile)) fs.writeFileSync(standardsFile, '[]');
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
          res.json(data);
        } catch (e) {
          res.json([]);
        }
      });

      expressApp.post('/api/technique-sheets', (req, res) => {
        try {
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
            sheets[index] = { ...sheets[index], ...req.body, id: sheets[index].id };
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

      expressApp.get('/api/standards/:code', (req, res) => {
        try {
          const data = JSON.parse(fs.readFileSync(standardsFile, 'utf8'));
          const standard = data.find(s => s.code === req.params.code);
          res.json(standard || {});
        } catch (e) {
          res.json({});
        }
      });

      expressApp.get('/api/mro-assets', (req, res) => {
        try {
          const mroDir = resolveMroDirectory();

          if (!mroDir) {
            return res.json({
              available: false,
              baseDir: null,
              assets: [],
              message: 'No local MRO directory was found. The folder is optional and excluded from packaged updates.',
            });
          }

          const assets = getVisibleMroEntries(mroDir)
            .map((entry) => {
              const absolutePath = path.join(mroDir, entry.name);
              const stats = fs.statSync(absolutePath);
              return buildMroAssetResponse(entry.name, stats);
            })
            .sort((a, b) => a.name.localeCompare(b.name));

          return res.json({
            available: true,
            baseDir: mroDir,
            assets,
            message: 'Local MRO assets detected. Only approved NDIP-1226/NDIP-1227 V2500 files are exposed; duplicate or legacy files remain hidden.',
          });
        } catch (error) {
          return res.status(500).json({
            available: false,
            baseDir: null,
            assets: [],
            message: error.message,
          });
        }
      });

      expressApp.get('/api/mro-assets/file/:fileName', (req, res) => {
        try {
          const mroDir = resolveMroDirectory();
          const requestedName = decodeURIComponent(req.params.fileName || '');
          const safeName = path.basename(requestedName);

          if (!mroDir) {
            return res.status(404).json({ error: 'MRO directory not found' });
          }

          if (!safeName || safeName !== requestedName) {
            return res.status(400).json({ error: 'Invalid MRO file name' });
          }

          const visibleNames = new Set(getVisibleMroEntries(mroDir).map((entry) => entry.name));
          if (!visibleNames.has(safeName)) {
            return res.status(404).json({ error: 'MRO file not found' });
          }

          const absolutePath = path.join(mroDir, safeName);

          if (!fs.existsSync(absolutePath) || !fs.statSync(absolutePath).isFile()) {
            return res.status(404).json({ error: 'MRO file not found' });
          }

          res.setHeader('Cache-Control', 'no-store');

          if (req.query.download === '1') {
            return res.download(absolutePath, safeName);
          }

          return res.sendFile(absolutePath);
        } catch (error) {
          return res.status(500).json({ error: error.message });
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
          const indexPath = path.join(distPath, 'index.html');
          res.sendFile(indexPath);
        } else {
          next();
        }
      });

      embeddedServer = expressApp.listen(5000, () => {
        console.log('Embedded server running on port 5000');
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

  // Load user-specific API keys from userData folder
  loadUserApiKeys();

  // Initialize license manager with app data path and version
  licenseManager = new LicenseManager(app.getPath('userData'), app.getVersion());

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
    shell.openExternal(navigationUrl);
  });
});
