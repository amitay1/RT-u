import { afterEach, describe, expect, it, vi } from 'vitest';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import express from 'express';

import {
  createMachineBoundSecureStorage,
  createStandaloneRtPtLicenseRuntime,
} from '../../../server/rtptLicenseRuntime';

const PRODUCT = 'rt-pt-inspector';
const APP_ID = 'com.amitay.rtptinspector';
const TOKEN_PREFIX = 'RTPT1';
const temporaryDirectories: string[] = [];
type AuthorityPinningError = Error & { reason?: string };

const createEphemeralLicenseAuthority = () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rtpt-browser-license-'));
  temporaryDirectories.push(root);
  const userDataDir = path.join(root, 'user-data');
  const publicKeyPath = path.join(root, 'rtpt-license-public-key.pem');
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  fs.writeFileSync(publicKeyPath, publicKey.export({ type: 'spki', format: 'pem' }));
  const fingerprint = crypto
    .createHash('sha256')
    .update(publicKey.export({ type: 'spki', format: 'der' }))
    .digest('hex');
  return { fingerprint, privateKey, publicKeyPath, userDataDir };
};

const signToken = (
  installationId: string,
  privateKey: crypto.KeyObject,
): string => {
  const payload = {
    schemaVersion: 1,
    product: PRODUCT,
    appId: APP_ID,
    licenseId: crypto.randomUUID(),
    customer: 'Standalone RT-PT Test Facility',
    installationId,
    issuedAt: '2026-07-20T09:00:00.000Z',
    expiresAt: null,
    edition: 'professional',
    features: ['rt-film', 'rt-digital', 'pt'],
  };
  const payloadSegment = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const signature = crypto
    .sign(null, Buffer.from(`${TOKEN_PREFIX}.${payloadSegment}`, 'ascii'), privateKey)
    .toString('base64url');
  return `${TOKEN_PREFIX}.${payloadSegment}.${signature}`;
};

afterEach(() => {
  vi.unstubAllEnvs();
  for (const directory of temporaryDirectories.splice(0)) {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

describe('standalone browser/PWA license runtime', () => {
  it('uses machine-bound authenticated encryption for local license records', () => {
    const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rtpt-browser-storage-'));
    temporaryDirectories.push(userDataDir);
    const firstMachine = createMachineBoundSecureStorage({
      userDataDir,
      machineIdentity: 'machine-identity-alpha',
    });
    const encrypted = firstMachine.encryptString('controlled license state');

    expect(firstMachine.decryptString(encrypted)).toBe('controlled license state');
    const secondMachine = createMachineBoundSecureStorage({
      userDataDir,
      machineIdentity: 'machine-identity-bravo',
    });
    expect(() => secondMachine.decryptString(encrypted)).toThrow();
  });

  it('starts in production when the independently supplied authority fingerprint matches', () => {
    const authority = createEphemeralLicenseAuthority();
    const colonFingerprint = authority.fingerprint.match(/.{2}/g)?.join(':') ?? '';
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('RTPT_LICENSE_PUBLIC_KEY_SHA256', `SHA256:${colonFingerprint}`);

    const runtime = createStandaloneRtPtLicenseRuntime({
      userDataDir: authority.userDataDir,
      publicKeyPath: authority.publicKeyPath,
      machineIdentity: 'production-browser-runtime-machine-id',
    });

    expect(runtime.service.getStatus()).toMatchObject({ status: 'missing', active: false });
  });

  it('fails closed in production when the authority fingerprint is missing', () => {
    const authority = createEphemeralLicenseAuthority();
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('RTPT_LICENSE_PUBLIC_KEY_SHA256', '');

    expect(() => createStandaloneRtPtLicenseRuntime({
      userDataDir: authority.userDataDir,
      publicKeyPath: authority.publicKeyPath,
      machineIdentity: 'production-browser-runtime-machine-id',
    })).toThrowError(
      expect.objectContaining<Partial<AuthorityPinningError>>({ reason: 'fingerprint-required' }),
    );
  });

  it('fails closed in production when the authority fingerprint does not match', () => {
    const authority = createEphemeralLicenseAuthority();
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('RTPT_LICENSE_PUBLIC_KEY_SHA256', '0'.repeat(64));

    expect(() => createStandaloneRtPtLicenseRuntime({
      userDataDir: authority.userDataDir,
      publicKeyPath: authority.publicKeyPath,
      machineIdentity: 'production-browser-runtime-machine-id',
    })).toThrowError(
      expect.objectContaining<Partial<AuthorityPinningError>>({ reason: 'fingerprint-mismatch' }),
    );
  });

  it('activates through same-origin endpoints and gates browser document APIs', async () => {
    const authority = createEphemeralLicenseAuthority();
    vi.stubEnv('NODE_ENV', 'test');
    vi.stubEnv('RTPT_LICENSE_PUBLIC_KEY_SHA256', '');

    const runtime = createStandaloneRtPtLicenseRuntime({
      userDataDir: authority.userDataDir,
      publicKeyPath: authority.publicKeyPath,
      machineIdentity: 'browser-runtime-machine-id',
      now: () => new Date('2026-07-20T10:00:00.000Z'),
    });
    const app = express();
    app.use(express.json());
    runtime.register(app);
    app.get('/api/technique-sheets', (_req, res) => res.json({ allowed: true }));

    const server = app.listen(0, '127.0.0.1');
    await new Promise<void>((resolve, reject) => {
      server.once('listening', resolve);
      server.once('error', reject);
    });

    try {
      const address = server.address() as AddressInfo;
      const origin = `http://127.0.0.1:${address.port}`;
      const initial = await fetch(`${origin}/api/rtpt-license/status`).then((response) => response.json());
      expect(initial).toMatchObject({ status: 'missing', active: false });

      const blocked = await fetch(`${origin}/api/technique-sheets`);
      expect(blocked.status).toBe(403);

      const activated = await fetch(`${origin}/api/rtpt-license/activate`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ token: signToken(initial.installationId, authority.privateKey) }),
      }).then((response) => response.json());
      expect(activated).toMatchObject({ status: 'active', active: true });

      const allowed = await fetch(`${origin}/api/technique-sheets`);
      expect(allowed.status).toBe(200);
      expect(await allowed.json()).toEqual({ allowed: true });

      const restoredRuntime = createStandaloneRtPtLicenseRuntime({
        userDataDir: authority.userDataDir,
        publicKeyPath: authority.publicKeyPath,
        machineIdentity: 'browser-runtime-machine-id',
        now: () => new Date('2026-07-20T10:05:00.000Z'),
      });
      expect(restoredRuntime.service.getStatus()).toMatchObject({ status: 'active', active: true });

      const deactivated = await fetch(`${origin}/api/rtpt-license/deactivate`, {
        method: 'POST',
      }).then((response) => response.json());
      expect(deactivated).toMatchObject({ status: 'missing', active: false });
      expect((await fetch(`${origin}/api/technique-sheets`)).status).toBe(403);
    } finally {
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    }
  });
});
