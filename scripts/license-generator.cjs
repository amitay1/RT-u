/**
 * License Key Generator for Scan Master
 *
 * Generates unique license keys for factories with:
 * - Factory identification
 * - Purchased standards
 * - Expiry date (or lifetime)
 * - Cryptographic signature
 *
 * Usage:
 *   node scripts/license-generator.cjs --factory "Acme Corp" --standards AMS,ASTM --lifetime
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// Secret key for signing (in production, store this securely!)
const LICENSE_SECRET = process.env.LICENSE_SECRET || 'your-super-secret-key-change-this-in-production';

// Available standards catalog
const AVAILABLE_STANDARDS = {
  'AMS': { code: 'AMS-STD-2154E', name: 'Aerospace Material Specification', price: 500 },
  'ASTM': { code: 'ASTM-A388', name: 'Steel Forgings', price: 500 },
  'BS3': { code: 'BS-EN-10228-3', name: 'European Steel Standards Part 3', price: 500 },
  'BS4': { code: 'BS-EN-10228-4', name: 'European Steel Standards Part 4', price: 500 },
  'MIL': { code: 'MIL-STD-2154', name: 'Military Standard', price: 800 },
};

class LicenseGenerator {
  constructor(secret = LICENSE_SECRET) {
    this.secret = secret;
    this.outputDir = path.join(__dirname, '../licenses');

    // Create output directory if it doesn't exist
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
  }

  /**
   * Generate a unique factory ID
   */
  generateFactoryId(factoryName) {
    const normalized = factoryName.toUpperCase().replace(/[^A-Z0-9]/g, '');
    const timestamp = Date.now().toString(36).toUpperCase();
    return `FAC-${normalized.substring(0, 6)}-${timestamp}`;
  }

  /**
   * Encode standards codes into compact format
   */
  encodeStandards(standardCodes) {
    // Convert array like ['AMS', 'ASTM'] to 'AMSASTM'
    return standardCodes.join('').toUpperCase();
  }

  /**
   * Decode standards from compact format
   */
  decodeStandards(encoded) {
    const standards = [];
    for (const key of Object.keys(AVAILABLE_STANDARDS)) {
      if (encoded.includes(key)) {
        standards.push(AVAILABLE_STANDARDS[key].code);
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
   * Verify license signature
   */
  verifySignature(licenseKey) {
    try {
      const parts = licenseKey.split('-');
      if (parts.length < 4) return false;

      const [prefix, factoryId, standardsCodes, expiry, ...signatureParts] = parts;
      const signature = signatureParts.join('-');

      const data = `${factoryId}:${standardsCodes}:${expiry}`;
      const expectedSig = this.generateSignature(data);

      return signature === expectedSig;
    } catch (error) {
      return false;
    }
  }

  /**
   * Generate a complete license key
   */
  generateLicense(options) {
    const {
      factoryName,
      factoryId = this.generateFactoryId(factoryName),
      standards = ['AMS', 'ASTM'],
      expiryDate = null, // null = lifetime
      maxUsers = null,   // null = unlimited
    } = options;

    // Validate standards
    const validStandards = standards.filter(std => AVAILABLE_STANDARDS[std]);
    if (validStandards.length === 0) {
      throw new Error('No valid standards provided');
    }

    // Encode standards
    const standardsCodes = this.encodeStandards(validStandards);

    // Format expiry
    const expiryStr = expiryDate
      ? new Date(expiryDate).toISOString().split('T')[0].replace(/-/g, '')
      : 'LIFETIME';

    // Generate signature
    const data = `${factoryId}:${standardsCodes}:${expiryStr}`;
    const signature = this.generateSignature(data);

    // Construct license key
    const licenseKey = `SM-${factoryId}-${standardsCodes}-${expiryStr}-${signature}`;

    // Full license object
    const license = {
      licenseKey,
      factoryId,
      factoryName,
      purchasedStandards: validStandards.map(key => AVAILABLE_STANDARDS[key].code),
      standardsShortCodes: validStandards,
      expiryDate: expiryDate ? new Date(expiryDate).toISOString() : null,
      isLifetime: !expiryDate,
      maxUsers: maxUsers || null,
      generatedAt: new Date().toISOString(),
      totalPrice: validStandards.reduce((sum, key) => sum + AVAILABLE_STANDARDS[key].price, 0)
    };

    return license;
  }

  /**
   * Parse a license key back into its components
   */
  parseLicenseKey(licenseKey) {
    try {
      const parts = licenseKey.split('-');

      if (parts.length < 5) {
        throw new Error('Invalid license key format');
      }

      const [prefix, factoryId, standardsCodes, expiry, ...signatureParts] = parts;
      const signature = signatureParts.join('-');

      if (prefix !== 'SM') {
        throw new Error('Invalid license key prefix');
      }

      // Verify signature
      const data = `${factoryId}:${standardsCodes}:${expiry}`;
      const expectedSig = this.generateSignature(data);

      if (signature !== expectedSig) {
        throw new Error('Invalid license signature');
      }

      // Decode standards
      const purchasedStandards = this.decodeStandards(standardsCodes);

      // Parse expiry
      let expiryDate = null;
      if (expiry !== 'LIFETIME') {
        const year = expiry.substring(0, 4);
        const month = expiry.substring(4, 6);
        const day = expiry.substring(6, 8);
        expiryDate = new Date(`${year}-${month}-${day}`);
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
   * Save license to file
   */
  saveLicense(license) {
    const filename = `license-${license.factoryId}-${Date.now()}.json`;
    const filepath = path.join(this.outputDir, filename);

    fs.writeFileSync(filepath, JSON.stringify(license, null, 2));

    console.log(`\n✅ License saved to: ${filepath}`);
    return filepath;
  }

  /**
   * Generate license and display it
   */
  generateAndDisplay(options) {
    const license = this.generateLicense(options);

    console.log('\n' + '='.repeat(70));
    console.log('🔑  SCAN MASTER LICENSE GENERATED');
    console.log('='.repeat(70));
    console.log(`\nFactory: ${license.factoryName}`);
    console.log(`Factory ID: ${license.factoryId}`);
    console.log(`\nStandards Purchased:`);
    license.purchasedStandards.forEach(std => {
      console.log(`  ✓ ${std}`);
    });
    console.log(`\nTotal Price: $${license.totalPrice}`);
    console.log(`Expiry: ${license.isLifetime ? 'LIFETIME' : license.expiryDate}`);
    console.log(`\n${'─'.repeat(70)}`);
    console.log(`\nLICENSE KEY (give this to customer):`);
    console.log(`\n  ${license.licenseKey}`);
    console.log(`\n${'─'.repeat(70)}`);
    console.log(`\nGenerated: ${license.generatedAt}`);
    console.log('='.repeat(70) + '\n');

    this.saveLicense(license);

    return license;
  }
}

// CLI Interface
if (require.main === module) {
  const args = process.argv.slice(2);

  // Parse arguments
  const options = {
    factoryName: null,
    standards: [],
    expiryDate: null,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--factory' || arg === '-f') {
      options.factoryName = args[++i];
    } else if (arg === '--standards' || arg === '-s') {
      options.standards = args[++i].split(',').map(s => s.trim().toUpperCase());
    } else if (arg === '--expiry' || arg === '-e') {
      options.expiryDate = args[++i];
    } else if (arg === '--lifetime' || arg === '-l') {
      options.expiryDate = null;
    } else if (arg === '--verify' || arg === '-v') {
      // Verify mode
      const keyToVerify = args[++i];
      const generator = new LicenseGenerator();
      const result = generator.parseLicenseKey(keyToVerify);

      console.log('\n' + '='.repeat(70));
      console.log('🔍  LICENSE VERIFICATION');
      console.log('='.repeat(70));

      if (result.valid) {
        console.log('\n✅ License is VALID\n');
        console.log(`Factory ID: ${result.factoryId}`);
        console.log(`Standards: ${result.purchasedStandards.join(', ')}`);
        console.log(`Expiry: ${result.isLifetime ? 'LIFETIME' : result.expiryDate}`);
      } else {
        console.log('\n❌ License is INVALID\n');
        console.log(`Error: ${result.error}`);
      }

      console.log('\n' + '='.repeat(70) + '\n');
      process.exit(result.valid ? 0 : 1);
    } else if (arg === '--help' || arg === '-h') {
      console.log(`
Scan Master License Generator

Usage:
  node license-generator.cjs --factory "Company Name" --standards AMS,ASTM [options]

Options:
  --factory, -f      Factory/Company name (required)
  --standards, -s    Comma-separated standard codes (default: AMS,ASTM)
                     Available: AMS, ASTM, BS3, BS4, MIL
  --lifetime, -l     Generate lifetime license (default)
  --expiry, -e       Set expiry date (format: YYYY-MM-DD)
  --verify, -v       Verify a license key
  --help, -h         Show this help

Examples:
  # Generate lifetime license with AMS and ASTM standards
  node license-generator.cjs --factory "Acme Corp" --standards AMS,ASTM --lifetime

  # Generate license expiring in 1 year with all standards
  node license-generator.cjs --factory "Boeing" --standards AMS,ASTM,MIL --expiry 2025-12-31

  # Verify a license key
  node license-generator.cjs --verify "SM-FAC-ACMECO-123ABC-AMSASTM-LIFETIME-a8f3d9e2c1b4"

Available Standards:
  AMS   - Aerospace Material Specification ($500)
  ASTM  - Steel Forgings ($500)
  BS3   - European Steel Standards Part 3 ($500)
  BS4   - European Steel Standards Part 4 ($500)
  MIL   - Military Standard ($800)
      `);
      process.exit(0);
    }
  }

  // Generate license
  if (options.factoryName) {
    if (options.standards.length === 0) {
      options.standards = ['AMS', 'ASTM']; // Default
    }

    const generator = new LicenseGenerator();
    generator.generateAndDisplay(options);
  } else {
    console.error('\n❌ Error: Factory name is required\n');
    console.log('Run with --help for usage information\n');
    process.exit(1);
  }
}

module.exports = LicenseGenerator;
