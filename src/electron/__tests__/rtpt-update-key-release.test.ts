import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

type VerificationError = Error & { reason?: string };
type VerificationResult = {
  asymmetricKeyType: string;
  fingerprint: string;
  spkiDer: Buffer;
  publicKeyContent?: Buffer;
};
type UpdateKeyVerifier = {
  inspectUpdatePublicKey: (content: string | Buffer) => VerificationResult;
  normalizeFingerprint: (value: string) => string;
  verifyUpdatePublicKeyContent: (content: string | Buffer, fingerprint?: string) => VerificationResult;
  verifyUpdatePublicKeyFile: (options: {
    publicKeyPath: string;
    expectedFingerprint?: string;
  }) => VerificationResult;
};

const require = createRequire(import.meta.url);
const verifier = require('../../../scripts/verify-rtpt-update-key.cjs') as UpdateKeyVerifier;
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

let temporaryDirectory = '';

beforeEach(() => {
  temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'rtpt-update-key-verifier-'));
});

afterEach(() => {
  fs.rmSync(temporaryDirectory, { recursive: true, force: true });
});

function generateRsaKeyPair() {
  return crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
}

describe('RT/PT offline-update public-key release controls', () => {
  it('accepts a signature-capable SPKI key only when its independently supplied fingerprint matches', () => {
    const { publicKey } = generateRsaKeyPair();
    const publicKeyPem = publicKey.export({ format: 'pem', type: 'spki' }).toString();
    const publicKeyPath = path.join(temporaryDirectory, 'update-public-key.pem');
    fs.writeFileSync(publicKeyPath, publicKeyPem);

    const inspected = verifier.inspectUpdatePublicKey(publicKeyPem);
    const expectedFingerprint = crypto.createHash('sha256').update(inspected.spkiDer).digest('hex');
    const colonFingerprint = expectedFingerprint.match(/.{2}/g)?.join(':') ?? '';
    const verified = verifier.verifyUpdatePublicKeyFile({
      publicKeyPath,
      expectedFingerprint: `SHA256:${colonFingerprint}`,
    });

    expect(verified.asymmetricKeyType).toBe('rsa');
    expect(verified.fingerprint).toBe(expectedFingerprint);
    expect(verified.publicKeyContent?.toString('utf8')).toBe(publicKeyPem);
  });

  it('fails closed when the approved fingerprint is absent, malformed, or mismatched', () => {
    const publicKeyPem = generateRsaKeyPair().publicKey.export({ format: 'pem', type: 'spki' });

    expect(() => verifier.verifyUpdatePublicKeyContent(publicKeyPem)).toThrowError(
      expect.objectContaining<Partial<VerificationError>>({ reason: 'fingerprint-required' }),
    );
    expect(() => verifier.verifyUpdatePublicKeyContent(publicKeyPem, 'not-a-fingerprint')).toThrowError(
      expect.objectContaining<Partial<VerificationError>>({ reason: 'fingerprint-format-invalid' }),
    );
    expect(() => verifier.verifyUpdatePublicKeyContent(publicKeyPem, '0'.repeat(64))).toThrowError(
      expect.objectContaining<Partial<VerificationError>>({ reason: 'fingerprint-mismatch' }),
    );
  });

  it('rejects private material and public keys incompatible with SHA-256 manifest verification', () => {
    const privateKeyPem = generateRsaKeyPair().privateKey.export({ format: 'pem', type: 'pkcs8' });
    const unsupportedPublicKey = crypto.generateKeyPairSync('ed25519').publicKey
      .export({ format: 'pem', type: 'spki' });

    expect(() => verifier.inspectUpdatePublicKey(privateKeyPem)).toThrowError(
      expect.objectContaining<Partial<VerificationError>>({ reason: 'private-key-material-forbidden' }),
    );
    expect(() => verifier.inspectUpdatePublicKey(unsupportedPublicKey)).toThrowError(
      expect.objectContaining<Partial<VerificationError>>({ reason: 'public-key-signature-algorithm-unsupported' }),
    );
  });

  it('fails closed when the mandatory source public-key file is absent', () => {
    expect(() => verifier.verifyUpdatePublicKeyFile({
      publicKeyPath: path.join(temporaryDirectory, 'missing.pem'),
      expectedFingerprint: '0'.repeat(64),
    })).toThrowError(
      expect.objectContaining<Partial<VerificationError>>({ reason: 'public-key-missing' }),
    );
  });

  it('uses RT/PT-only package identities and explicitly packages the update key', () => {
    const builder = JSON.parse(fs.readFileSync(path.join(repoRoot, 'electron-builder.json'), 'utf8'));
    const electronPackage = JSON.parse(fs.readFileSync(path.join(repoRoot, 'electron', 'package.json'), 'utf8'));

    expect(electronPackage.name).toBe('rt-pt-inspector-electron');
    expect(JSON.stringify(electronPackage)).not.toMatch(/scan[-_ ]?master/i);
    expect(builder.files).toContain('electron/update-public-key.pem');
    expect(builder).not.toHaveProperty('mac');
    expect(builder).not.toHaveProperty('linux');
  });

  it('keeps config smoke key-independent while wiring fail-closed packaged-byte auditing', () => {
    const releaseSmokePath = path.join(repoRoot, 'scripts', 'release-smoke.cjs');
    const releaseSmoke = fs.readFileSync(releaseSmokePath, 'utf8');
    const result = spawnSync(process.execPath, [releaseSmokePath], {
      cwd: repoRoot,
      encoding: 'utf8',
      env: {
        ...process.env,
        SMOKE_CONFIG_ONLY: '1',
        SMOKE_PACKAGED_APP_DIR: '',
      },
    });

    expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
    expect(releaseSmoke).toContain('RTPT_UPDATE_PUBLIC_KEY_SHA256');
    expect(releaseSmoke).toContain('sourceUpdatePublicKey.publicKeyContent.equals(packagedUpdatePublicKeyContent)');
    expect(releaseSmoke).toContain('not byte-for-byte identical to the controlled source public key');
    expect(releaseSmoke).toContain('legacyFirstPartyProductIdentityPattern');
    expect(releaseSmoke).toContain('scan-master-electron');
    expect(releaseSmoke).toContain('scanmaster_inspector_');
  });
});
