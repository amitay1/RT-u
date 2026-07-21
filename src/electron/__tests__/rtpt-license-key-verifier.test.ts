import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

type VerificationError = Error & { reason?: string };
type VerificationResult = {
  fingerprint: string;
  spkiDer: Buffer;
  publicKeyContent?: Buffer;
};
type LicenseKeyVerifier = {
  inspectLicensePublicKey: (content: string | Buffer) => VerificationResult;
  normalizeFingerprint: (value: string) => string;
  verifyLicensePublicKeyContent: (content: string | Buffer, fingerprint?: string) => VerificationResult;
  verifyLicensePublicKeyFile: (options: {
    publicKeyPath: string;
    expectedFingerprint?: string;
  }) => VerificationResult;
};

const require = createRequire(import.meta.url);
const verifier = require('../../../scripts/verify-rtpt-license-key.cjs') as LicenseKeyVerifier;

let temporaryDirectory = '';

beforeEach(() => {
  temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'rtpt-license-key-verifier-'));
});

afterEach(() => {
  fs.rmSync(temporaryDirectory, { recursive: true, force: true });
});

function generatePublicKey(type: 'ed25519' | 'rsa'): string {
  const pair = type === 'ed25519'
    ? crypto.generateKeyPairSync('ed25519')
    : crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  return pair.publicKey.export({ format: 'pem', type: 'spki' }).toString();
}

function generateEd25519PrivateKey(): string {
  return crypto.generateKeyPairSync('ed25519').privateKey
    .export({ format: 'pem', type: 'pkcs8' })
    .toString();
}

describe('RT/PT production license public-key verifier', () => {
  it('accepts an Ed25519 SPKI key only when its controlled SHA-256 fingerprint matches', () => {
    const publicKeyPem = generatePublicKey('ed25519');
    const publicKeyPath = path.join(temporaryDirectory, 'rtpt-license-public-key.pem');
    fs.writeFileSync(publicKeyPath, publicKeyPem);
    const inspected = verifier.inspectLicensePublicKey(publicKeyPem);
    const colonFingerprint = inspected.fingerprint.match(/.{2}/g)?.join(':') ?? '';

    const verified = verifier.verifyLicensePublicKeyFile({
      publicKeyPath,
      expectedFingerprint: `SHA256:${colonFingerprint}`,
    });

    expect(verified.fingerprint).toBe(inspected.fingerprint);
    expect(verified.publicKeyContent?.toString('utf8')).toBe(publicKeyPem);
  });

  it('fails closed when the controlled fingerprint is missing or mismatched', () => {
    const publicKeyPem = generatePublicKey('ed25519');

    expect(() => verifier.verifyLicensePublicKeyContent(publicKeyPem)).toThrowError(
      expect.objectContaining<Partial<VerificationError>>({ reason: 'fingerprint-required' }),
    );
    expect(() => verifier.verifyLicensePublicKeyContent(publicKeyPem, '0'.repeat(64))).toThrowError(
      expect.objectContaining<Partial<VerificationError>>({ reason: 'fingerprint-mismatch' }),
    );
  });

  it('rejects a parseable non-Ed25519 public key', () => {
    expect(() => verifier.inspectLicensePublicKey(generatePublicKey('rsa'))).toThrowError(
      expect.objectContaining<Partial<VerificationError>>({ reason: 'public-key-not-ed25519' }),
    );
  });

  it('never accepts private key material in place of the public PEM', () => {
    expect(() => verifier.inspectLicensePublicKey(generateEd25519PrivateKey())).toThrowError(
      expect.objectContaining<Partial<VerificationError>>({ reason: 'private-key-material-forbidden' }),
    );
  });

  it('fails closed when the configured public-key file is absent', () => {
    expect(() => verifier.verifyLicensePublicKeyFile({
      publicKeyPath: path.join(temporaryDirectory, 'missing.pem'),
      expectedFingerprint: '0'.repeat(64),
    })).toThrowError(
      expect.objectContaining<Partial<VerificationError>>({ reason: 'public-key-missing' }),
    );
  });
});
