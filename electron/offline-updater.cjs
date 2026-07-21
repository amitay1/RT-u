/**
 * Offline Updater - USB-based update system for air-gapped factories
 *
 * Features:
 * - Validates update packages from USB drive
 * - Verifies a signed manifest and installer SHA256
 * - Requires a pinned public key (fail closed)
 * - Progress tracking during installation
 * - Rollback support
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');

const ALLOWED_INSTALLER_EXTENSIONS = new Set(['.exe', '.msi']);
const SHA256_PATTERN = /^[a-f0-9]{64}$/i;
const VERSION_PATTERN = /^v?\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/;

class OfflineUpdater {
  constructor(options = {}) {
    this.currentVersion = options.currentVersion || '0.0.0';
    this.appPath = options.appPath || '';
    this.tempDir = options.tempDir || '';
    this.publicKey = options.publicKey || null; // For signature verification
    this.onProgress = options.onProgress || (() => {});
    this.onLog = options.onLog || console.log;
  }

  /**
   * Compare semantic versions
   * Returns: 1 if v1 > v2, -1 if v1 < v2, 0 if equal
   */
  compareVersions(v1, v2) {
    const parts1 = v1.replace(/^v/, '').split('.').map(Number);
    const parts2 = v2.replace(/^v/, '').split('.').map(Number);

    for (let i = 0; i < 3; i++) {
      const p1 = parts1[i] || 0;
      const p2 = parts2[i] || 0;
      if (p1 > p2) return 1;
      if (p1 < p2) return -1;
    }
    return 0;
  }

  isValidVersion(version) {
    return typeof version === 'string' && VERSION_PATTERN.test(version);
  }

  /**
   * Resolve a regular file that must live directly inside the package root.
   * Both the lexical path and real path are checked to prevent traversal and
   * symlink/reparse-point escapes.
   */
  resolveContainedFile(packagePath, relativeFile, allowedExtensions) {
    if (typeof packagePath !== 'string' || typeof relativeFile !== 'string' || !relativeFile) {
      throw new Error('Invalid update package path');
    }
    if (path.isAbsolute(relativeFile) || path.basename(relativeFile) !== relativeFile) {
      throw new Error('Update package contains an unsafe file path');
    }

    const packageRoot = fs.realpathSync(packagePath);
    const candidatePath = path.resolve(packageRoot, relativeFile);
    const lexicalRelative = path.relative(packageRoot, candidatePath);
    if (!lexicalRelative || lexicalRelative.startsWith(`..${path.sep}`) || path.isAbsolute(lexicalRelative)) {
      throw new Error('Update package file escapes the package directory');
    }
    if (!fs.existsSync(candidatePath)) {
      throw new Error(`Update package file not found: ${relativeFile}`);
    }

    const candidateStat = fs.lstatSync(candidatePath);
    if (!candidateStat.isFile() || candidateStat.isSymbolicLink()) {
      throw new Error(`Update package file must be a regular file: ${relativeFile}`);
    }

    const realCandidate = fs.realpathSync(candidatePath);
    const realRelative = path.relative(packageRoot, realCandidate);
    if (!realRelative || realRelative.startsWith(`..${path.sep}`) || path.isAbsolute(realRelative)) {
      throw new Error('Update package file resolves outside the package directory');
    }

    if (allowedExtensions) {
      const extension = path.extname(realCandidate).toLowerCase();
      if (!allowedExtensions.has(extension)) {
        throw new Error(`Unsupported update package file type: ${extension || 'none'}`);
      }
    }

    return realCandidate;
  }

  /**
   * Scan a directory for update packages
   * Looks for RT-PT update folders with a valid signed update-info.json
   */
  async scanForUpdates(directoryPath) {
    const results = {
      found: false,
      packages: [],
      errors: []
    };

    try {
      if (!fs.existsSync(directoryPath)) {
        results.errors.push(`Directory not found: ${directoryPath}`);
        return results;
      }

      const scanRoot = fs.realpathSync(directoryPath);
      const files = fs.readdirSync(scanRoot);

      // Look for update folders or zip files
      for (const file of files) {
        const fullPath = path.join(scanRoot, file);
        const stat = fs.lstatSync(fullPath);
        if (stat.isSymbolicLink()) {
          results.errors.push(`Skipped symbolic link: ${file}`);
          continue;
        }

        // Check for update info file
        let infoPath;
        if (stat.isDirectory()) {
          infoPath = path.join(fullPath, 'update-info.json');
        } else if (stat.isFile() && file === 'update-info.json') {
          infoPath = fullPath;
        } else {
          continue;
        }

        if (!fs.existsSync(infoPath)) {
          continue;
        }

        try {
          const infoContent = fs.readFileSync(infoPath, 'utf8');
          const updateInfo = JSON.parse(infoContent);

          // Validate update info structure
          if (
            !this.isValidVersion(updateInfo.version) ||
            typeof updateInfo.installerFile !== 'string' ||
            !SHA256_PATTERN.test(updateInfo.installerSha256 || '') ||
            typeof updateInfo.signatureFile !== 'string'
          ) {
            results.errors.push(`Invalid update-info.json in ${file}`);
            continue;
          }

          // Check if this is a newer version
          const isNewer = this.compareVersions(updateInfo.version, this.currentVersion) > 0;

          const packagePath = fs.realpathSync(stat.isDirectory() ? fullPath : path.dirname(infoPath));
          const packageInfo = {
            path: packagePath,
            version: updateInfo.version,
            isNewer,
            releaseDate: updateInfo.releaseDate || 'Unknown',
            changelog: updateInfo.changelog || '',
            installerFile: updateInfo.installerFile,
            signatureFile: updateInfo.signatureFile,
            manifestFile: path.basename(infoPath),
            installerSha256: updateInfo.installerSha256.toLowerCase(),
            size: updateInfo.size || 0,
            minVersion: updateInfo.minVersion,
            platform: updateInfo.platform || 'win32'
          };

          // Check for installer file
          try {
            const installerPath = this.resolveContainedFile(
              packageInfo.path,
              packageInfo.installerFile,
              ALLOWED_INSTALLER_EXTENSIONS
            );
            const installerStat = fs.statSync(installerPath);
            if (installerStat.size <= 0) {
              throw new Error('Installer file is empty');
            }
            packageInfo.actualSize = installerStat.size;
            this.resolveContainedFile(packageInfo.path, packageInfo.manifestFile, new Set(['.json']));
            this.resolveContainedFile(packageInfo.path, packageInfo.signatureFile, new Set(['.sig']));
          } catch (packageError) {
            results.errors.push(`${file}: ${packageError.message}`);
            packageInfo.installerMissing = true;
          }

          results.packages.push(packageInfo);
          results.found = true;

        } catch (parseError) {
          results.errors.push(`Failed to parse update-info.json in ${file}: ${parseError.message}`);
        }
      }

      // Sort packages by version (newest first)
      results.packages.sort((a, b) => this.compareVersions(b.version, a.version));

    } catch (error) {
      results.errors.push(`Scan error: ${error.message}`);
    }

    return results;
  }

  /**
   * Calculate SHA256 checksum of a file
   */
  calculateChecksum(filePath) {
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash('sha256');
      const stream = fs.createReadStream(filePath);

      let bytesRead = 0;
      const fileSize = fs.statSync(filePath).size;
      if (fileSize <= 0) {
        reject(new Error('Cannot verify an empty installer file'));
        return;
      }

      stream.on('data', (chunk) => {
        hash.update(chunk);
        bytesRead += chunk.length;
        this.onProgress({
          stage: 'checksum',
          percent: (bytesRead / fileSize) * 100,
          message: `Verifying checksum: ${Math.round((bytesRead / fileSize) * 100)}%`
        });
      });

      stream.on('end', () => {
        resolve(hash.digest('hex'));
      });

      stream.on('error', reject);
    });
  }

  /**
   * Verify checksum against checksums file
   */
  async verifyChecksum(packagePath, installerFile, checksumFile) {
    try {
      const checksumPath = this.resolveContainedFile(packagePath, checksumFile, new Set(['.sha256']));
      const installerPath = this.resolveContainedFile(packagePath, installerFile, ALLOWED_INSTALLER_EXTENSIONS);
      const checksumContent = fs.readFileSync(checksumPath, 'utf8');
      const lines = checksumContent.split('\n');

      let expectedChecksum = null;
      for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        if (parts.length >= 2) {
          const [hash, filename] = parts;
          if (filename === installerFile || filename.endsWith(installerFile)) {
            expectedChecksum = hash.toLowerCase();
            break;
          }
        }
      }

      if (!expectedChecksum) {
        return { valid: false, error: 'Checksum not found for installer file' };
      }

      this.onLog(`Expected checksum: ${expectedChecksum}`);

      const actualChecksum = await this.calculateChecksum(installerPath);
      this.onLog(`Actual checksum: ${actualChecksum}`);

      const valid = actualChecksum.toLowerCase() === expectedChecksum;

      return {
        valid,
        expected: expectedChecksum,
        actual: actualChecksum,
        error: valid ? null : 'Checksum mismatch - file may be corrupted'
      };

    } catch (error) {
      return { valid: false, error: `Checksum verification failed: ${error.message}` };
    }
  }

  /**
   * Verify the exact update-info.json bytes using the pinned public key.
   */
  async verifySignature(packageInfo) {
    if (!this.publicKey) {
      return { valid: false, skipped: false, error: 'Offline updates are disabled: no pinned public key is configured' };
    }
    if (!packageInfo.signatureFile || !packageInfo.manifestFile) {
      return { valid: false, skipped: false, error: 'Signed update manifest is incomplete' };
    }

    try {
      const signaturePath = this.resolveContainedFile(
        packageInfo.path,
        packageInfo.signatureFile,
        new Set(['.sig'])
      );
      const manifestPath = this.resolveContainedFile(
        packageInfo.path,
        packageInfo.manifestFile,
        new Set(['.json'])
      );
      const signature = fs.readFileSync(signaturePath);
      const manifest = fs.readFileSync(manifestPath);
      const isValid = crypto.verify('sha256', manifest, this.publicKey, signature);

      return {
        valid: isValid,
        error: isValid ? null : 'Invalid signature - update may not be authentic'
      };

    } catch (error) {
      return { valid: false, error: `Signature verification failed: ${error.message}` };
    }
  }

  /**
   * Validate an update package completely
   */
  async validatePackage(packageInfo) {
    const results = {
      valid: true,
      checks: {
        version: { valid: false, message: '' },
        platform: { valid: false, message: '' },
        installer: { valid: false, message: '' },
        checksum: { valid: false, message: '' },
        signature: { valid: false, message: '', skipped: false }
      },
      errors: []
    };

    if (!packageInfo || typeof packageInfo !== 'object') {
      results.valid = false;
      results.errors.push('Invalid update package');
      return results;
    }

    // Recompute version status; never trust a renderer-provided isNewer flag.
    const isNewer = this.isValidVersion(packageInfo.version)
      && this.compareVersions(packageInfo.version, this.currentVersion) > 0;
    if (isNewer) {
      results.checks.version = { valid: true, message: `v${packageInfo.version} > v${this.currentVersion}` };
    } else {
      results.checks.version = { valid: false, message: `v${packageInfo.version} is not newer than v${this.currentVersion}` };
      results.valid = false;
      results.errors.push('Update version is not newer than current version');
    }

    // Check minimum version requirement
    if (packageInfo.minVersion) {
      const meetsMin = this.compareVersions(this.currentVersion, packageInfo.minVersion) >= 0;
      if (!meetsMin) {
        results.checks.version.valid = false;
        results.checks.version.message += ` (Requires min v${packageInfo.minVersion})`;
        results.valid = false;
        results.errors.push(`This update requires at least version ${packageInfo.minVersion}`);
      }
    }

    // Check platform
    const currentPlatform = process.platform;
    if (packageInfo.platform === currentPlatform || packageInfo.platform === 'all') {
      results.checks.platform = { valid: true, message: `Platform: ${currentPlatform}` };
    } else {
      results.checks.platform = { valid: false, message: `Package is for ${packageInfo.platform}, not ${currentPlatform}` };
      results.valid = false;
      results.errors.push('Update package is for a different platform');
    }

    // Check installer exists
    let installerPath;
    try {
      installerPath = this.resolveContainedFile(
        packageInfo.path,
        packageInfo.installerFile,
        ALLOWED_INSTALLER_EXTENSIONS
      );
      results.checks.installer = { valid: true, message: 'Installer path and file type verified' };
    } catch (error) {
      results.checks.installer = { valid: false, message: error.message };
      results.valid = false;
      results.errors.push(error.message);
    }

    // Verify the installer hash embedded in the signed manifest.
    this.onProgress({ stage: 'validating', percent: 30, message: 'Verifying checksum...' });
    let checksumResult = { valid: false, error: 'Installer path is invalid' };
    if (installerPath && SHA256_PATTERN.test(packageInfo.installerSha256 || '')) {
      const actualChecksum = await this.calculateChecksum(installerPath);
      const expectedChecksum = packageInfo.installerSha256.toLowerCase();
      checksumResult = {
        valid: actualChecksum.toLowerCase() === expectedChecksum,
        error: actualChecksum.toLowerCase() === expectedChecksum
          ? null
          : 'Checksum mismatch - installer differs from the signed manifest'
      };
    } else if (!SHA256_PATTERN.test(packageInfo.installerSha256 || '')) {
      checksumResult.error = 'Signed manifest is missing a valid installerSha256 value';
    }
    results.checks.checksum = {
      valid: checksumResult.valid,
      message: checksumResult.error || 'Checksum verified'
    };
    if (!checksumResult.valid) {
      results.valid = false;
      results.errors.push(checksumResult.error);
    }

    // Verify signature
    this.onProgress({ stage: 'validating', percent: 70, message: 'Verifying signature...' });
    const signatureResult = await this.verifySignature(packageInfo);
    results.checks.signature = {
      valid: signatureResult.valid,
      message: signatureResult.error || signatureResult.message || 'Signature verified',
      skipped: signatureResult.skipped
    };
    if (!signatureResult.valid) {
      results.valid = false;
      results.errors.push(signatureResult.error);
    }

    this.onProgress({ stage: 'validating', percent: 100, message: 'Validation complete' });

    return results;
  }

  /**
   * Install the update
   */
  async installUpdate(packageInfo, options = {}) {
    const { silent = false, autoRestart = true } = options;

    const validation = await this.validatePackage(packageInfo);
    if (!validation.valid) {
      throw new Error(`Update validation failed: ${validation.errors.join('; ')}`);
    }

    const sourceInstallerPath = this.resolveContainedFile(
      packageInfo.path,
      packageInfo.installerFile,
      ALLOWED_INSTALLER_EXTENSIONS
    );
    const stagingParent = this.tempDir || os.tmpdir();
    fs.mkdirSync(stagingParent, { recursive: true });
    const stagingDirectory = fs.mkdtempSync(path.join(stagingParent, 'rtpt-update-'));
    const installerPath = path.join(stagingDirectory, path.basename(sourceInstallerPath));
    fs.copyFileSync(sourceInstallerPath, installerPath, fs.constants.COPYFILE_EXCL);

    const stagedChecksum = await this.calculateChecksum(installerPath);
    if (stagedChecksum.toLowerCase() !== packageInfo.installerSha256.toLowerCase()) {
      throw new Error('Staged installer checksum mismatch');
    }

    this.onProgress({ stage: 'installing', percent: 0, message: 'Starting installation...' });
    this.onLog(`Starting installation: ${installerPath}`);

    return new Promise((resolve, reject) => {
      let installerArgs = [];

      // Determine installer type and arguments
      const installerExtension = path.extname(installerPath).toLowerCase();
      if (installerExtension === '.exe') {
        // NSIS or Squirrel installer
        if (silent) {
          installerArgs = ['/S', '/SILENT', '/VERYSILENT'];
        }
        if (autoRestart) {
          installerArgs.push('/RESTARTAPPLICATION');
        }
      } else if (installerExtension === '.msi') {
        // MSI installer
        installerArgs = ['/i', installerPath];
        if (silent) {
          installerArgs.push('/quiet', '/qn');
        }
      }

      this.onProgress({ stage: 'installing', percent: 10, message: 'Launching installer...' });

      // For Windows, run the installer
      const isWindows = process.platform === 'win32';
      let installer;

      if (isWindows && installerExtension === '.msi') {
        installer = spawn('msiexec', installerArgs, {
          detached: true,
          stdio: 'ignore'
        });
      } else {
        installer = spawn(installerPath, installerArgs, {
          detached: true,
          stdio: 'ignore'
        });
      }

      installer.on('error', (error) => {
        this.onLog(`Installer error: ${error.message}`);
        reject(error);
      });

      // Unref the child process so it can run independently
      installer.unref();

      this.onProgress({ stage: 'installing', percent: 100, message: 'Installation started' });

      // Give the installer a moment to start
      setTimeout(() => {
        resolve({
          success: true,
          message: 'Installation started. The application will restart automatically.'
        });
      }, 1000);
    });
  }

  /**
   * Get update package details for display
   */
  getPackageDisplayInfo(packageInfo) {
    return {
      version: packageInfo.version,
      currentVersion: this.currentVersion,
      isNewer: packageInfo.isNewer,
      releaseDate: packageInfo.releaseDate,
      changelog: packageInfo.changelog,
      size: this.formatBytes(packageInfo.actualSize || packageInfo.size),
      platform: packageInfo.platform
    };
  }

  /**
   * Format bytes to human-readable string
   */
  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}

module.exports = OfflineUpdater;
