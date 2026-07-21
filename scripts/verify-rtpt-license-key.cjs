#!/usr/bin/env node

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..');
const defaultPublicKeyPath = path.join(repoRoot, 'electron', 'rtpt-license-public-key.pem');
const fingerprintEnvironmentVariable = 'RTPT_LICENSE_PUBLIC_KEY_SHA256';

class LicenseKeyVerificationError extends Error {
  constructor(message, reason) {
    super(message);
    this.name = 'LicenseKeyVerificationError';
    this.reason = reason;
  }
}

function normalizeFingerprint(value) {
  const normalized = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/^sha256\s*:/, '')
    .replace(/:/g, '');

  if (!/^[a-f0-9]{64}$/.test(normalized)) {
    throw new LicenseKeyVerificationError(
      'The expected RT/PT license public-key SHA-256 fingerprint must contain exactly 64 hexadecimal characters.',
      'fingerprint-format-invalid',
    );
  }
  return normalized;
}

function inspectLicensePublicKey(publicKeyContent) {
  const pem = Buffer.isBuffer(publicKeyContent)
    ? publicKeyContent.toString('utf8')
    : String(publicKeyContent || '');
  const trimmedPem = pem.trim();
  if (/-----BEGIN [^-]*PRIVATE KEY-----/.test(trimmedPem)) {
    throw new LicenseKeyVerificationError(
      'Private key material cannot be used as the packaged RT/PT license public key.',
      'private-key-material-forbidden',
    );
  }
  if (!/^-----BEGIN PUBLIC KEY-----\r?\n(?:[A-Za-z0-9+/=]+\r?\n)+-----END PUBLIC KEY-----$/.test(trimmedPem)) {
    throw new LicenseKeyVerificationError(
      'The RT/PT license public key must be a SubjectPublicKeyInfo PUBLIC KEY PEM.',
      'public-key-not-spki-pem',
    );
  }

  let key;
  try {
    key = crypto.createPublicKey(trimmedPem);
  } catch {
    throw new LicenseKeyVerificationError(
      'The RT/PT license public key is not a parseable public key.',
      'public-key-not-parseable',
    );
  }

  if (key.type !== 'public' || key.asymmetricKeyType !== 'ed25519') {
    throw new LicenseKeyVerificationError(
      'The RT/PT license public key must be an Ed25519 public key.',
      'public-key-not-ed25519',
    );
  }

  const spkiDer = key.export({ format: 'der', type: 'spki' });
  const fingerprint = crypto.createHash('sha256').update(spkiDer).digest('hex');
  return { fingerprint, spkiDer };
}

function verifyLicensePublicKeyContent(publicKeyContent, expectedFingerprint) {
  if (expectedFingerprint === undefined || expectedFingerprint === null || String(expectedFingerprint).trim() === '') {
    throw new LicenseKeyVerificationError(
      `${fingerprintEnvironmentVariable} is required for a controlled production release.`,
      'fingerprint-required',
    );
  }

  const expected = normalizeFingerprint(expectedFingerprint);
  const inspected = inspectLicensePublicKey(publicKeyContent);
  if (inspected.fingerprint !== expected) {
    throw new LicenseKeyVerificationError(
      `The RT/PT license public-key fingerprint does not match the controlled expected fingerprint (actual: ${inspected.fingerprint}).`,
      'fingerprint-mismatch',
    );
  }
  return inspected;
}

function verifyLicensePublicKeyFile({
  publicKeyPath = defaultPublicKeyPath,
  expectedFingerprint = process.env[fingerprintEnvironmentVariable],
} = {}) {
  const resolvedPath = path.resolve(publicKeyPath);
  let publicKeyContent;
  try {
    publicKeyContent = fs.readFileSync(resolvedPath);
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      throw new LicenseKeyVerificationError(
        `The RT/PT license public key is missing: ${resolvedPath}`,
        'public-key-missing',
      );
    }
    throw new LicenseKeyVerificationError(
      `The RT/PT license public key cannot be read: ${resolvedPath}`,
      'public-key-unreadable',
    );
  }

  const inspected = verifyLicensePublicKeyContent(publicKeyContent, expectedFingerprint);
  return { ...inspected, publicKeyContent, publicKeyPath: resolvedPath };
}

function parseArguments(argv) {
  const options = {
    publicKeyPath: defaultPublicKeyPath,
    expectedFingerprint: process.env[fingerprintEnvironmentVariable],
    allowUnusableDevelopment: false,
    printFingerprint: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--public-key') {
      const value = argv[index + 1];
      if (!value) throw new Error('--public-key requires a path.');
      options.publicKeyPath = value;
      index += 1;
    } else if (argument === '--expected-sha256') {
      const value = argv[index + 1];
      if (!value) throw new Error('--expected-sha256 requires a fingerprint.');
      options.expectedFingerprint = value;
      index += 1;
    } else if (argument === '--allow-unusable-development') {
      options.allowUnusableDevelopment = true;
    } else if (argument === '--print-fingerprint') {
      options.printFingerprint = true;
    } else {
      throw new Error(`Unknown argument: ${argument}`);
    }
  }

  return options;
}

function runCli(argv = process.argv.slice(2)) {
  let options;
  try {
    options = parseArguments(argv);
    if (options.printFingerprint) {
      const content = fs.readFileSync(path.resolve(options.publicKeyPath));
      const inspected = inspectLicensePublicKey(content);
      process.stdout.write(`${inspected.fingerprint}\n`);
      return 0;
    }

    const result = verifyLicensePublicKeyFile(options);
    console.log(`Controlled RT/PT license public key verified: SHA-256 ${result.fingerprint}`);
    return 0;
  } catch (error) {
    if (options?.allowUnusableDevelopment) {
      console.warn(`RT/PT LICENSING UNUSABLE IN THIS DEVELOPMENT PACKAGE: ${error.message}`);
      console.warn('The package may be created for local UI/development work, but activation will remain blocked.');
      return 0;
    }
    console.error(`RT/PT LICENSE KEY VERIFICATION FAILED: ${error.message}`);
    return 1;
  }
}

if (require.main === module) {
  process.exitCode = runCli();
}

module.exports = {
  LicenseKeyVerificationError,
  defaultPublicKeyPath,
  fingerprintEnvironmentVariable,
  inspectLicensePublicKey,
  normalizeFingerprint,
  runCli,
  verifyLicensePublicKeyContent,
  verifyLicensePublicKeyFile,
};
