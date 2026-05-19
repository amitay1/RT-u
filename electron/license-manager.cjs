/**
 * License Manager for Electron App
 *
 * Handles license validation, storage, and checking
 * Works offline-first with optional online verification
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Same secret as generator (should be obfuscated in production)
const LICENSE_SECRET = process.env.LICENSE_SECRET || 'your-super-secret-key-change-this-in-production';

// License server URL - change this to your production server
const LICENSE_SERVER_URL = process.env.LICENSE_SERVER_URL || 'http://localhost:5000';

// Available standards catalog
const AVAILABLE_STANDARDS = {
  'AMS': { code: 'AMS-STD-2154E', name: 'Aerospace Material Specification' },
  'AMS2630': { code: 'AMS-2630', name: 'AMS 2630 Product Over 0.5 Inch Thick' },
  'ASTM': { code: 'ASTM-A388', name: 'Steel Forgings' },
  'ASTM_E1001': { code: 'ASTM-E1001', name: 'Immersion Pulse-Echo UT' },
  'ASTM_E2580': { code: 'ASTM-E2580', name: 'Composite Panel UT' },
  'ASTM_E588': { code: 'ASTM-E588', name: 'Bearing Steel Cleanliness' },
  'BS3': { code: 'BS-EN-10228-3', name: 'European Steel Standards Part 3' },
  'BS4': { code: 'BS-EN-10228-4', name: 'European Steel Standards Part 4' },
  'MIL': { code: 'MIL-STD-2154', name: 'Military Standard' },
};

class LicenseManager {
  constructor(userDataPath, appVersion = '1.0.0') {
    this.licenseFile = path.join(userDataPath, 'license.dat');
    this.licenseBackupFile = path.join(userDataPath, 'license.bak');
    this.secret = LICENSE_SECRET;
    this.cachedLicense = null;
    this.appVersion = appVersion;
    this.machineId = this.generateMachineId();
    this.machineName = os.hostname();
  }

  /**
   * Generate a unique machine ID based on hardware
   */
  generateMachineId() {
    const networkInterfaces = os.networkInterfaces();
    let macs = [];
    
    for (const iface of Object.values(networkInterfaces)) {
      for (const config of iface || []) {
        if (config.mac && config.mac !== '00:00:00:00:00:00') {
          macs.push(config.mac);
        }
      }
    }
    
    // Create a hash from MAC addresses + hostname + platform
    const uniqueString = macs.sort().join(':') + os.hostname() + os.platform() + os.arch();
    return crypto.createHash('sha256').update(uniqueString).digest('hex').substring(0, 32);
  }

  /**
   * Check if application is activated
   */
  isActivated() {
    return fs.existsSync(this.licenseFile);
  }

  /**
   * Get current license info
   */
  getLicense() {
    if (this.cachedLicense) {
      return this.cachedLicense;
    }

    if (!this.isActivated()) {
      return {
        activated: false,
        valid: false,
        reason: 'NOT_ACTIVATED'
      };
    }

    try {
      const encryptedData = fs.readFileSync(this.licenseFile, 'utf8');
      const license = this.decryptLicense(encryptedData);

      // Check if expired
      if (license.expiryDate && new Date() > new Date(license.expiryDate)) {
        return {
          activated: true,
          valid: false,
          reason: 'EXPIRED',
          expiryDate: license.expiryDate
        };
      }

      // Cache valid license
      this.cachedLicense = {
        activated: true,
        valid: true,
        factoryId: license.factoryId,
        factoryName: license.factoryName,
        purchasedStandards: license.purchasedStandards,
        standardsCodes: license.standardsCodes || [],
        expiryDate: license.expiryDate,
        isLifetime: license.isLifetime,
        activatedAt: license.activatedAt
      };

      return this.cachedLicense;
    } catch (error) {
      console.error('Error reading license:', error);
      return {
        activated: true,
        valid: false,
        reason: 'CORRUPTED',
        error: error.message
      };
    }
  }

  /**
   * Validate and activate license
   */
  async activateLicense(licenseKey) {
    try {
      // 1. Parse and verify license key
      const parsed = this.parseLicenseKey(licenseKey);

      if (!parsed.valid) {
        return {
          success: false,
          error: parsed.error || 'Invalid license key format'
        };
      }

      // 2. Optional: Verify with server (if online)
      // This is non-blocking - if offline, we trust the signature
      try {
        const serverValidation = await this.verifyWithServer(licenseKey);
        if (serverValidation && !serverValidation.valid) {
          return {
            success: false,
            error: 'License rejected by server: ' + serverValidation.reason
          };
        }
      } catch (error) {
        console.log('Server verification failed (offline?), continuing with offline validation');
      }

      // 3. Prepare license data
      const licenseData = {
        licenseKey,
        factoryId: parsed.factoryId,
        factoryName: parsed.factoryName || 'Unknown Factory',
        purchasedStandards: parsed.purchasedStandards,
        standardsCodes: parsed.standardsCodes,
        expiryDate: parsed.expiryDate,
        isLifetime: parsed.isLifetime,
        activatedAt: new Date().toISOString()
      };

      // 4. Encrypt and save license
      const encrypted = this.encryptLicense(licenseData);
      fs.writeFileSync(this.licenseFile, encrypted, 'utf8');

      // Create backup
      fs.writeFileSync(this.licenseBackupFile, encrypted, 'utf8');

      // Clear cache
      this.cachedLicense = null;

      console.log('✅ License activated successfully');
      console.log('Factory ID:', licenseData.factoryId);
      console.log('Standards:', licenseData.purchasedStandards.join(', '));

      return {
        success: true,
        license: this.getLicense()
      };
    } catch (error) {
      console.error('License activation failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Parse license key
   * Format: SM-FAC-{name}-{timestamp}-{standards}-{expiry}-{signature}
   * Example: SM-FAC-RONI-MK1FZI2S-AMSASTMBS3BS4MIL-LIFETIME-190FDD234671
   */
  parseLicenseKey(licenseKey) {
    try {
      const trimmedKey = licenseKey.trim();
      
      // Validate prefix
      if (!trimmedKey.startsWith('SM-FAC-')) {
        throw new Error('Invalid license key prefix');
      }
      
      // Remove SM- prefix and split
      const withoutPrefix = trimmedKey.substring(3); // Remove "SM-"
      const parts = withoutPrefix.split('-');
      
      // Minimum parts: FAC, name, timestamp, standards, expiry, signature = 6
      if (parts.length < 6) {
        throw new Error('Invalid license key format - too short');
      }
      
      // Factory ID is always FAC-{name}-{timestamp} (3 parts)
      const factoryId = `${parts[0]}-${parts[1]}-${parts[2]}`; // FAC-RONI-MK1FZI2S
      
      // Standards codes (only uppercase letters)
      const standardsCodes = parts[3]; // AMSASTMBS3BS4MIL
      
      // Expiry (LIFETIME or YYYYMMDD)
      const expiry = parts[4]; // LIFETIME
      
      // Signature (12 hex chars)
      const signature = parts[5]; // 190FDD234671
      
      console.log('Parsing license:', { factoryId, standardsCodes, expiry, signature });

      // Verify signature
      const data = `${factoryId}:${standardsCodes}:${expiry}`;
      const expectedSig = this.generateSignature(data);
      
      console.log('Signature check:', { data, expected: expectedSig, got: signature });

      if (signature !== expectedSig) {
        throw new Error('Invalid license signature - license may be tampered');
      }

      // Decode standards
      const purchasedStandards = this.decodeStandards(standardsCodes);

      if (purchasedStandards.length === 0) {
        throw new Error('No valid standards found in license');
      }

      // Parse expiry
      let expiryDate = null;
      if (expiry !== 'LIFETIME') {
        const year = expiry.substring(0, 4);
        const month = expiry.substring(4, 6);
        const day = expiry.substring(6, 8);
        expiryDate = new Date(`${year}-${month}-${day}`);

        if (isNaN(expiryDate.getTime())) {
          throw new Error('Invalid expiry date in license');
        }
      }

      return {
        valid: true,
        factoryId,
        purchasedStandards,
        standardsCodes,
        expiryDate: expiryDate ? expiryDate.toISOString() : null,
        isLifetime: expiry === 'LIFETIME',
        signature
      };
    } catch (error) {
      return {
        valid: false,
        error: error.message
      };
    }
  }

  /**
   * Decode standards from compact format
   */
  decodeStandards(encoded) {
    const standards = [];
    const codes = [];

    for (const [key, value] of Object.entries(AVAILABLE_STANDARDS)) {
      if (encoded.includes(key)) {
        standards.push(value.code);
        codes.push(key);
      }
    }

    return standards;
  }

  /**
   * Generate HMAC signature
   */
  generateSignature(data) {
    return crypto
      .createHmac('sha256', this.secret)
      .update(data)
      .digest('hex')
      .substring(0, 12)
      .toUpperCase();
  }

  /**
   * Encrypt license data for storage
   */
  encryptLicense(licenseData) {
    const algorithm = 'aes-256-cbc';
    const key = crypto.scryptSync(this.secret, 'salt', 32);
    const iv = crypto.randomBytes(16);

    const cipher = crypto.createCipheriv(algorithm, key, iv);
    let encrypted = cipher.update(JSON.stringify(licenseData), 'utf8', 'hex');
    encrypted += cipher.final('hex');

    return iv.toString('hex') + ':' + encrypted;
  }

  /**
   * Decrypt license data from storage
   */
  decryptLicense(encryptedData) {
    const algorithm = 'aes-256-cbc';
    const key = crypto.scryptSync(this.secret, 'salt', 32);

    const [ivHex, encrypted] = encryptedData.split(':');
    const iv = Buffer.from(ivHex, 'hex');

    const decipher = crypto.createDecipheriv(algorithm, key, iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return JSON.parse(decrypted);
  }

  /**
   * Verify license with server and report activation (optional, non-blocking)
   */
  async verifyWithServer(licenseKey, timeout = 5000) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      // Send activation data to our license server
      const response = await fetch(`${LICENSE_SERVER_URL}/api/licenses/activate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          licenseKey,
          machineId: this.machineId,
          machineName: this.machineName,
          osVersion: `${os.platform()} ${os.release()}`,
          appVersion: this.appVersion
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        if (errorData.valid === false) {
          // Server explicitly rejected the license
          return { valid: false, reason: errorData.error || 'License rejected by server' };
        }
        throw new Error('Server returned error: ' + response.status);
      }

      const result = await response.json();
      console.log('✅ License verified with server:', result.isNewActivation ? 'NEW ACTIVATION' : 'existing');
      return result;
    } catch (error) {
      // If server is unreachable, we continue with offline validation
      console.log('Server verification unavailable:', error.message);
      return null;
    }
  }

  /**
   * Check if a specific standard is purchased
   */
  hasStandard(standardCode) {
    const license = this.getLicense();

    if (!license.valid) {
      return false;
    }

    return license.purchasedStandards.includes(standardCode);
  }

  /**
   * Get all available standards with lock status
   */
  getStandardsCatalog() {
    const license = this.getLicense();
    const purchased = license.valid ? license.purchasedStandards : [];

    return Object.entries(AVAILABLE_STANDARDS).map(([key, value]) => ({
      shortCode: key,
      code: value.code,
      name: value.name,
      isPurchased: purchased.includes(value.code),
      isLocked: !purchased.includes(value.code)
    }));
  }

  /**
   * Deactivate license (for testing or uninstall)
   */
  deactivate() {
    if (fs.existsSync(this.licenseFile)) {
      fs.unlinkSync(this.licenseFile);
    }
    if (fs.existsSync(this.licenseBackupFile)) {
      fs.unlinkSync(this.licenseBackupFile);
    }
    this.cachedLicense = null;
    console.log('License deactivated');
  }

  /**
   * Restore license from backup
   */
  restoreFromBackup() {
    if (fs.existsSync(this.licenseBackupFile)) {
      fs.copyFileSync(this.licenseBackupFile, this.licenseFile);
      this.cachedLicense = null;
      return true;
    }
    return false;
  }

  /**
   * Get license info for display
   */
  getLicenseInfo() {
    const license = this.getLicense();

    if (!license.valid) {
      return {
        status: 'inactive',
        message: this.getStatusMessage(license.reason)
      };
    }

    const daysUntilExpiry = license.isLifetime
      ? null
      : Math.ceil((new Date(license.expiryDate) - new Date()) / (1000 * 60 * 60 * 24));

    return {
      status: 'active',
      factoryId: license.factoryId,
      factoryName: license.factoryName,
      standards: this.getStandardsCatalog().filter(s => s.isPurchased),
      isLifetime: license.isLifetime,
      expiryDate: license.expiryDate,
      daysUntilExpiry,
      activatedAt: license.activatedAt
    };
  }

  /**
   * Get user-friendly status message
   */
  getStatusMessage(reason) {
    const messages = {
      'NOT_ACTIVATED': 'This application is not activated. Please enter your license key.',
      'EXPIRED': 'Your license has expired. Please contact Scan Master to renew.',
      'CORRUPTED': 'License file is corrupted. Please contact support.',
      'INVALID': 'Invalid license. Please check your license key.'
    };
    return messages[reason] || 'License validation failed.';
  }

  // ==========================================
  // OFFLINE ACTIVATION METHODS
  // ==========================================

  /**
   * Generate an offline activation request code
   * User provides this code to support along with their license key
   *
   * Format: Machine ID + Timestamp encoded as Base32-like string
   * Example: ABCD-EFGH-IJKL-MNOP-QRST
   */
  generateActivationRequest() {
    const timestamp = Date.now().toString(36);
    const data = `${this.machineId}:${timestamp}`;

    // Create a hash that's unique to this machine and time
    const hash = crypto
      .createHmac('sha256', this.secret)
      .update(data)
      .digest('hex');

    // Convert to Base32-like format (A-Z, 2-7)
    const base32 = this.toBase32Like(hash.substring(0, 20));

    // Format as readable chunks
    const formatted = base32.match(/.{1,4}/g).join('-');

    return {
      requestCode: formatted,
      machineId: this.machineId.substring(0, 8) + '...',
      machineName: this.machineName,
      generatedAt: new Date().toISOString(),
      validFor: '7 days'
    };
  }

  /**
   * Convert hex to Base32-like alphabet (A-Z, 2-7)
   */
  toBase32Like(hex) {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    let result = '';

    for (let i = 0; i < hex.length; i += 2) {
      const byte = parseInt(hex.substring(i, i + 2), 16);
      result += alphabet[byte % 32];
    }

    return result;
  }

  /**
   * Activate license using offline response code
   *
   * Response code format: {licenseData}:{signature}
   * Where licenseData = factoryId:standards:expiry:requestCode (Base64)
   *
   * @param {string} licenseKey - The original license key
   * @param {string} responseCode - Response code from support (e.g., UVWX-YZAB-CDEF-GHIJ-KLMN)
   */
  async activateOffline(licenseKey, responseCode) {
    try {
      // 1. Clean up the response code
      const cleanResponse = responseCode.replace(/-/g, '').toUpperCase();

      // 2. Verify the response code format
      if (cleanResponse.length < 20) {
        return {
          success: false,
          error: 'Invalid response code format - too short'
        };
      }

      // 3. Parse the license key first
      const parsed = this.parseLicenseKey(licenseKey);
      if (!parsed.valid) {
        return {
          success: false,
          error: 'Invalid license key: ' + (parsed.error || 'Unknown error')
        };
      }

      // 4. Verify the response code is valid for this machine
      // The response code should contain encoded machine verification
      const expectedPrefix = this.generateOfflineVerificationCode(
        this.machineId,
        parsed.factoryId
      ).substring(0, 12);

      // Check if response code starts with expected verification
      if (!cleanResponse.startsWith(expectedPrefix)) {
        return {
          success: false,
          error: 'Response code is not valid for this machine. Please contact support.'
        };
      }

      // 5. Prepare license data
      const licenseData = {
        licenseKey,
        factoryId: parsed.factoryId,
        factoryName: parsed.factoryName || 'Offline Activation',
        purchasedStandards: parsed.purchasedStandards,
        standardsCodes: parsed.standardsCodes,
        expiryDate: parsed.expiryDate,
        isLifetime: parsed.isLifetime,
        activatedAt: new Date().toISOString(),
        activationType: 'offline',
        machineId: this.machineId
      };

      // 6. Encrypt and save license
      const encrypted = this.encryptLicense(licenseData);
      fs.writeFileSync(this.licenseFile, encrypted, 'utf8');

      // Create backup
      fs.writeFileSync(this.licenseBackupFile, encrypted, 'utf8');

      // Clear cache
      this.cachedLicense = null;

      console.log('✅ License activated offline successfully');
      console.log('Factory ID:', licenseData.factoryId);
      console.log('Standards:', licenseData.purchasedStandards.join(', '));

      return {
        success: true,
        license: this.getLicense()
      };
    } catch (error) {
      console.error('Offline activation failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Generate verification code for offline activation
   * This is used to create response codes that are tied to a specific machine
   */
  generateOfflineVerificationCode(machineId, factoryId) {
    const data = `OFFLINE:${machineId}:${factoryId}`;
    const hash = crypto
      .createHmac('sha256', this.secret)
      .update(data)
      .digest('hex');

    return this.toBase32Like(hash.substring(0, 24));
  }

  /**
   * Get machine info for offline activation display
   */
  getMachineInfo() {
    return {
      machineId: this.machineId,
      machineIdShort: this.machineId.substring(0, 8).toUpperCase(),
      machineName: this.machineName,
      platform: os.platform(),
      arch: os.arch(),
      osVersion: os.release()
    };
  }
}

module.exports = LicenseManager;
