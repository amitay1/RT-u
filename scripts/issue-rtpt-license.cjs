#!/usr/bin/env node

/**
 * Issues an offline RT Inspector license using an externally managed
 * Ed25519 private key. The private key is never generated, copied, or stored by
 * this repository.
 */

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const TOKEN_PREFIX = 'RTPT1';
const PRODUCT = 'rt-pt-inspector';
const APP_ID = 'com.amitay.rtptinspector';
const FEATURES = Object.freeze(['rt-film', 'rt-digital', 'pt']);

function printHelp() {
  console.log(`
RT Inspector offline license issuer

Usage:
  node scripts/issue-rtpt-license.cjs \\
    --private-key C:\\secure\\rtpt-license-private-key.pem \\
    (--installation-id 00000000-0000-4000-8000-000000000000 | --any-installation) \\
    --customer "Customer name" \\
    (--expires 2027-12-31 | --perpetual) \\
    [--license-id <uuid>] [--output <file>]

Required:
  --private-key       Path to an externally controlled Ed25519 private key.
  --installation-id  Installation code shown by RT Inspector, or
  --any-installation Issue a site license that activates on any installation.
  --customer         Licensed customer or organization name.
  --expires          Expiry date (YYYY-MM-DD or ISO timestamp), or
  --perpetual        Issue a license without an expiry date.

A site license is not bound to one machine: the same activation code activates
every installation it is given to, and an offline license cannot be revoked
after issuance. Prefer --installation-id whenever the installation is known.

Optional:
  --license-id       Existing license UUID; generated when omitted.
  --issued-at        ISO issue timestamp; current UTC time when omitted.
  --output           Write the activation package as JSON to this path.
  --help             Show this help.

The signing key must remain outside the repository and outside release builds.
`);
}

function parseArguments(argv) {
  const result = {};

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--help' || argument === '-h') {
      result.help = true;
      continue;
    }
    if (argument === '--perpetual') {
      result.perpetual = true;
      continue;
    }
    if (argument === '--any-installation') {
      result['any-installation'] = true;
      continue;
    }
    if (!argument.startsWith('--')) {
      throw new Error(`Unexpected argument: ${argument}`);
    }

    const key = argument.slice(2);
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) {
      throw new Error(`Missing value for --${key}`);
    }
    result[key] = value;
    index += 1;
  }

  return result;
}

function requireUuid(value, label) {
  const normalized = String(value || '').trim().toLowerCase();
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuidPattern.test(normalized)) {
    throw new Error(`${label} must be a valid UUID.`);
  }
  return normalized;
}

function requireCustomer(value) {
  const customer = String(value || '').trim();
  if (!customer || customer.length > 120) {
    throw new Error('Customer must contain between 1 and 120 characters.');
  }
  return customer;
}

function parseTimestamp(value, label) {
  const parsed = new Date(value);
  if (!value || Number.isNaN(parsed.getTime())) {
    throw new Error(`${label} must be a valid ISO date or timestamp.`);
  }
  return parsed.toISOString();
}

function parseExpiry(value) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return parseTimestamp(`${value}T23:59:59.999Z`, 'Expiry');
  }
  return parseTimestamp(value, 'Expiry');
}

function loadPrivateKey(privateKeyPath) {
  const resolved = path.resolve(String(privateKeyPath || ''));
  if (!privateKeyPath || !fs.existsSync(resolved)) {
    throw new Error('The Ed25519 private key file was not found.');
  }

  const key = crypto.createPrivateKey(fs.readFileSync(resolved));
  if (key.asymmetricKeyType !== 'ed25519') {
    throw new Error('The supplied private key must be Ed25519.');
  }
  return { key, resolved };
}

function issueLicense(options) {
  if (options.perpetual && options.expires) {
    throw new Error('Choose either --perpetual or --expires, not both.');
  }
  if (!options.perpetual && !options.expires) {
    throw new Error('Choose --perpetual or provide --expires.');
  }
  if (options['any-installation'] && options['installation-id']) {
    throw new Error('Choose either --any-installation or --installation-id, not both.');
  }
  if (!options['any-installation'] && !options['installation-id']) {
    throw new Error('Choose --any-installation or provide --installation-id.');
  }

  const { key: privateKey, resolved: privateKeyPath } = loadPrivateKey(options['private-key']);
  const issuedAt = options['issued-at']
    ? parseTimestamp(options['issued-at'], 'Issued-at')
    : new Date().toISOString();
  const expiresAt = options.perpetual ? null : parseExpiry(options.expires);

  if (expiresAt && Date.parse(expiresAt) <= Date.parse(issuedAt)) {
    throw new Error('Expiry must be later than the issue timestamp.');
  }

  const payload = {
    schemaVersion: 1,
    product: PRODUCT,
    appId: APP_ID,
    licenseId: options['license-id']
      ? requireUuid(options['license-id'], 'License ID')
      : crypto.randomUUID(),
    customer: requireCustomer(options.customer),
    installationId: options['any-installation']
      ? null
      : requireUuid(options['installation-id'], 'Installation ID'),
    issuedAt,
    expiresAt,
    edition: 'professional',
    features: [...FEATURES],
  };

  const payloadSegment = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const signedContent = `${TOKEN_PREFIX}.${payloadSegment}`;
  const signature = crypto.sign(null, Buffer.from(signedContent, 'ascii'), privateKey);
  const token = `${signedContent}.${signature.toString('base64url')}`;
  const publicKey = crypto.createPublicKey(privateKey).export({ type: 'spki', format: 'der' });
  const publicKeyFingerprint = crypto.createHash('sha256').update(publicKey).digest('hex');

  return { payload, token, publicKeyFingerprint, privateKeyPath };
}

function writeOutput(outputPath, licensePackage) {
  const resolved = path.resolve(outputPath);
  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  fs.writeFileSync(
    resolved,
    `${JSON.stringify({ payload: licensePackage.payload, token: licensePackage.token }, null, 2)}\n`,
    { encoding: 'utf8', mode: 0o600, flag: 'wx' },
  );
  return resolved;
}

function main() {
  try {
    const options = parseArguments(process.argv.slice(2));
    if (options.help) {
      printHelp();
      return;
    }

    const result = issueLicense(options);
    const outputPath = options.output ? writeOutput(options.output, result) : null;

    console.log('RT Inspector license issued.');
    console.log(`License ID: ${result.payload.licenseId}`);
    console.log(`Customer: ${result.payload.customer}`);
    console.log(`Installation ID: ${result.payload.installationId || 'Any installation (site license)'}`);
    console.log(`Expires: ${result.payload.expiresAt || 'Perpetual'}`);
    console.log(`Public key SHA-256: ${result.publicKeyFingerprint}`);
    if (outputPath) {
      console.log(`Activation package: ${outputPath}`);
      console.log('The activation code was not echoed because an output file was requested.');
    } else {
      console.log('\nActivation code:\n');
      console.log(result.token);
    }
  } catch (error) {
    console.error(`License issuance failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  APP_ID,
  FEATURES,
  PRODUCT,
  TOKEN_PREFIX,
  issueLicense,
  parseArguments,
};
