import { afterEach, describe, expect, it } from 'vitest';
import crypto, { type KeyObject } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  APP_ID,
  CLOCK_FILE,
  INSTALLATION_FILE,
  LICENSE_FILE,
  LICENSE_NAMESPACE,
  MAX_CLOCK_SKEW_MS,
  PRODUCT,
  TOKEN_PREFIX,
  createRtPtLicenseService,
} = require('../../../electron/rtpt-license-service.cjs');

type LicensePayload = {
  schemaVersion: 1;
  product: string;
  appId: string;
  licenseId: string;
  customer: string;
  installationId: string | null;
  issuedAt: string;
  expiresAt: string | null;
  edition: 'professional';
  features: string[];
};

const temporaryDirectories: string[] = [];

const createSecureStorage = (mask = 0xa7) => {
  const marker = Buffer.from('rtpt-test-sealed:', 'ascii');
  return {
    isEncryptionAvailable: () => true,
    encryptString: (plaintext: string) => {
      const encrypted = Buffer.from(plaintext, 'utf8');
      for (let index = 0; index < encrypted.length; index += 1) encrypted[index] ^= mask;
      return Buffer.concat([marker, encrypted]);
    },
    decryptString: (encrypted: Buffer) => {
      if (!Buffer.isBuffer(encrypted) || !encrypted.subarray(0, marker.length).equals(marker)) {
        throw new Error('Encrypted fixture is corrupt');
      }
      const plaintext = Buffer.from(encrypted.subarray(marker.length));
      for (let index = 0; index < plaintext.length; index += 1) plaintext[index] ^= mask;
      return plaintext.toString('utf8');
    },
  };
};

const signToken = (payload: Record<string, unknown>, privateKey: KeyObject): string => {
  const payloadSegment = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const signedBytes = Buffer.from(`${TOKEN_PREFIX}.${payloadSegment}`, 'ascii');
  const signature = crypto.sign(null, signedBytes, privateKey).toString('base64url');
  return `${TOKEN_PREFIX}.${payloadSegment}.${signature}`;
};

const createFixture = (initialTime = '2026-07-20T10:00:00.000Z') => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rtpt-license-service-test-'));
  temporaryDirectories.push(root);
  const userDataDir = path.join(root, 'user-data');
  const publicKeyPath = path.join(root, 'rtpt-license-public-key.pem');
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  fs.writeFileSync(publicKeyPath, publicKey.export({ type: 'spki', format: 'pem' }));

  let currentTime = new Date(initialTime);
  const secureStorage = createSecureStorage();
  const buildService = () => createRtPtLicenseService({
    fs,
    path,
    crypto,
    secureStorage,
    userDataDir,
    publicKeyPath,
    now: () => new Date(currentTime),
  });
  const service = buildService();
  const installationId = service.getInstallationId();

  const payload = (overrides: Partial<LicensePayload> = {}): LicensePayload => ({
    schemaVersion: 1,
    product: PRODUCT,
    appId: APP_ID,
    licenseId: crypto.randomUUID(),
    customer: 'RT-PT Test Facility',
    installationId,
    issuedAt: '2026-07-20T09:00:00.000Z',
    expiresAt: null,
    edition: 'professional',
    features: ['rt-film', 'rt-digital', 'pt'],
    ...overrides,
  });

  return {
    root,
    userDataDir,
    publicKeyPath,
    privateKey,
    service,
    buildService,
    installationId,
    payload,
    setTime: (value: string) => {
      currentTime = new Date(value);
    },
  };
};

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

describe('RT-PT offline license service', () => {
  it('activates an installation-bound Ed25519 license and restores it from encrypted storage', () => {
    const fixture = createFixture();
    expect(fixture.service.status()).toMatchObject({
      status: 'missing',
      active: false,
      installationId: fixture.installationId,
    });

    const licensePayload = fixture.payload();
    const token = signToken(licensePayload, fixture.privateKey);
    const activated = fixture.service.activate(token);

    expect(activated).toMatchObject({
      status: 'active',
      active: true,
      product: PRODUCT,
      appId: APP_ID,
      installationId: fixture.installationId,
      license: licensePayload,
    });
    expect(fixture.buildService().getStatus()).toMatchObject({
      status: 'active',
      active: true,
      installationId: fixture.installationId,
      license: licensePayload,
    });

    const namespacePath = path.join(fixture.userDataDir, LICENSE_NAMESPACE);
    const encryptedInstallation = fs.readFileSync(path.join(namespacePath, INSTALLATION_FILE), 'utf8');
    const encryptedLicense = fs.readFileSync(path.join(namespacePath, LICENSE_FILE), 'utf8');
    expect(encryptedInstallation).not.toContain(fixture.installationId);
    expect(encryptedLicense).not.toContain(token);
    expect(encryptedLicense).not.toContain(licensePayload.customer);
    expect(fs.existsSync(path.join(namespacePath, CLOCK_FILE))).toBe(true);
  });

  it('does not establish a clock high-water mark before successful activation', () => {
    const fixture = createFixture('2026-07-22T10:00:00.000Z');
    const clockPath = path.join(fixture.userDataDir, LICENSE_NAMESPACE, CLOCK_FILE);

    expect(fixture.service.status()).toMatchObject({
      status: 'missing',
      active: false,
    });
    expect(fs.existsSync(clockPath)).toBe(false);

    expect(fixture.service.activate('not-a-license')).toMatchObject({
      status: 'invalid',
      active: false,
    });
    expect(fs.existsSync(clockPath)).toBe(false);

    fixture.setTime('2026-07-20T10:00:00.000Z');
    expect(
      fixture.service.activate(signToken(fixture.payload(), fixture.privateKey)),
    ).toMatchObject({
      status: 'active',
      active: true,
    });
    expect(fs.existsSync(clockPath)).toBe(true);
  });

  it('fails closed when encrypted installation state is copied to a different secure-storage identity', () => {
    const fixture = createFixture();
    const token = signToken(fixture.payload(), fixture.privateKey);
    expect(fixture.service.activate(token).status).toBe('active');

    const clonedUserData = path.join(fixture.root, 'cloned-user-data');
    fs.cpSync(fixture.userDataDir, clonedUserData, { recursive: true });
    const clonedService = createRtPtLicenseService({
      fs,
      path,
      crypto,
      secureStorage: createSecureStorage(0x3c),
      userDataDir: clonedUserData,
      publicKeyPath: fixture.publicKeyPath,
      now: () => new Date('2026-07-20T10:00:00.000Z'),
    });

    expect(clonedService.getStatus()).toMatchObject({
      status: 'storage-unavailable',
      active: false,
      reason: 'installation-record-invalid',
    });
    expect(clonedService.getInstallationId()).toBeNull();
  });

  it('rejects a payload changed after its exact RTPT1 payload bytes were signed', () => {
    const fixture = createFixture();
    const token = signToken(fixture.payload(), fixture.privateKey);
    const [prefix, payloadSegment, signatureSegment] = token.split('.');
    const tamperedPayload = JSON.parse(Buffer.from(payloadSegment, 'base64url').toString('utf8'));
    tamperedPayload.customer = 'Tampered Facility';
    const tamperedSegment = Buffer.from(JSON.stringify(tamperedPayload), 'utf8').toString('base64url');

    expect(fixture.service.activate(`${prefix}.${tamperedSegment}.${signatureSegment}`)).toMatchObject({
      status: 'invalid',
      active: false,
      reason: 'license-signature-invalid',
    });
  });

  it.each([
    ['product', 'another-product'],
    ['appId', 'com.example.another-app'],
  ] as const)('rejects a signed payload with the wrong %s identity', (field, value) => {
    const fixture = createFixture();
    const token = signToken(fixture.payload({ [field]: value }), fixture.privateKey);

    expect(fixture.service.activate(token)).toMatchObject({
      status: 'invalid',
      active: false,
      reason: 'license-payload-invalid',
    });
  });

  it('rejects a valid signature bound to another installation', () => {
    const fixture = createFixture();
    const token = signToken(
      fixture.payload({ installationId: crypto.randomUUID() }),
      fixture.privateKey,
    );

    expect(fixture.service.activate(token)).toMatchObject({
      status: 'installation-mismatch',
      active: false,
      reason: 'installation-id-mismatch',
    });
  });

  it('activates a site license with no installation binding on any installation', () => {
    const fixture = createFixture();
    const token = signToken(fixture.payload({ installationId: null }), fixture.privateKey);

    expect(fixture.service.activate(token)).toMatchObject({
      status: 'active',
      active: true,
      installationId: fixture.installationId,
    });

    // A second, unrelated installation under the same trust root: different
    // installation id, same public key. The one activation code must work there
    // too - that is the entire point of a site license.
    const secondUserDataDir = path.join(fixture.root, 'second-user-data');
    const secondService = createRtPtLicenseService({
      fs,
      path,
      crypto,
      secureStorage: createSecureStorage(0x5c),
      userDataDir: secondUserDataDir,
      publicKeyPath: fixture.publicKeyPath,
      now: () => new Date('2026-07-20T10:00:00.000Z'),
    });

    expect(secondService.getInstallationId()).not.toBe(fixture.installationId);
    expect(secondService.activate(token)).toMatchObject({
      status: 'active',
      active: true,
      installationId: secondService.getInstallationId(),
    });
  });

  it('still enforces expiry and signature on a site license', () => {
    const fixture = createFixture('2026-07-20T10:00:00.000Z');
    const token = signToken(
      fixture.payload({ installationId: null, expiresAt: '2026-07-21T10:00:00.000Z' }),
      fixture.privateKey,
    );
    expect(fixture.service.activate(token).status).toBe('active');

    fixture.setTime('2026-07-21T10:00:00.000Z');
    expect(fixture.service.status()).toMatchObject({
      status: 'expired',
      active: false,
    });

    const forged = signToken(
      fixture.payload({ installationId: null }),
      crypto.generateKeyPairSync('ed25519').privateKey,
    );
    expect(fixture.service.activate(forged)).toMatchObject({
      status: 'invalid',
      reason: 'license-signature-invalid',
    });
  });

  it('changes an activated time-limited license to expired after its expiry instant', () => {
    const fixture = createFixture('2026-07-20T10:00:00.000Z');
    const licensePayload = fixture.payload({ expiresAt: '2026-07-21T10:00:00.000Z' });
    expect(fixture.service.activate(signToken(licensePayload, fixture.privateKey)).status).toBe('active');

    fixture.setTime('2026-07-21T10:00:00.000Z');
    expect(fixture.service.status()).toMatchObject({
      status: 'expired',
      active: false,
      reason: 'license-expired',
      license: licensePayload,
    });
  });

  it('fails closed when encrypted license storage is corrupt', () => {
    const fixture = createFixture();
    const licensePayload = fixture.payload();
    expect(fixture.service.activate(signToken(licensePayload, fixture.privateKey)).status).toBe('active');

    fs.writeFileSync(
      path.join(fixture.userDataDir, LICENSE_NAMESPACE, LICENSE_FILE),
      Buffer.from('not-an-encrypted-license-record'),
    );

    expect(fixture.service.status()).toMatchObject({
      status: 'invalid',
      active: false,
      reason: 'license-storage-corrupt',
    });
  });

  it('detects clock rollback beyond the bounded skew allowance', () => {
    const fixture = createFixture('2026-07-20T10:00:00.000Z');
    expect(
      fixture.service.activate(signToken(fixture.payload(), fixture.privateKey)).status,
    ).toBe('active');

    fixture.setTime('2026-07-22T10:00:00.000Z');
    expect(fixture.service.status().status).toBe('active');
    fixture.setTime(new Date(Date.parse('2026-07-22T10:00:00.000Z') - MAX_CLOCK_SKEW_MS - 1).toISOString());

    expect(fixture.service.status()).toMatchObject({
      status: 'clock-invalid',
      active: false,
      reason: 'system-clock-rollback',
    });
  });

  it('rejects a license whose issue time is materially in the future', () => {
    const fixture = createFixture('2026-07-20T10:00:00.000Z');
    const token = signToken(
      fixture.payload({ issuedAt: '2026-07-20T10:10:00.001Z' }),
      fixture.privateKey,
    );

    expect(fixture.service.activate(token)).toMatchObject({
      status: 'clock-invalid',
      active: false,
      reason: 'license-issued-in-future',
    });
  });

  it('reports missing production configuration and unavailable OS encryption without bypassing', () => {
    const fixture = createFixture();
    const withoutKey = createRtPtLicenseService({
      fs,
      path,
      crypto,
      secureStorage: createSecureStorage(),
      userDataDir: path.join(fixture.root, 'without-key'),
      now: () => new Date('2026-07-20T10:00:00.000Z'),
    });
    expect(withoutKey.status()).toMatchObject({
      status: 'configuration-required',
      active: false,
      reason: 'public-key-not-configured',
    });

    const withoutEncryption = createRtPtLicenseService({
      fs,
      path,
      crypto,
      secureStorage: {
        isEncryptionAvailable: () => false,
        encryptString: () => Buffer.alloc(0),
        decryptString: () => '',
      },
      userDataDir: path.join(fixture.root, 'without-encryption'),
      publicKeyPath: fixture.publicKeyPath,
      now: () => new Date('2026-07-20T10:00:00.000Z'),
    });
    expect(withoutEncryption.status()).toMatchObject({
      status: 'storage-unavailable',
      active: false,
      reason: 'encryption-unavailable',
    });
  });

  it.each(['basic_text', 'unknown', 'future_unprotected_backend'])(
    'rejects the unprotected Linux safeStorage backend %s',
    (backend) => {
      const fixture = createFixture();
      const service = createRtPtLicenseService({
        fs,
        path,
        crypto,
        secureStorage: {
          ...createSecureStorage(),
          getSelectedStorageBackend: () => backend,
        },
        userDataDir: path.join(fixture.root, `linux-${backend}`),
        publicKeyPath: fixture.publicKeyPath,
        now: () => new Date('2026-07-20T10:00:00.000Z'),
        platform: 'linux',
      });

      expect(service.status()).toMatchObject({
        status: 'storage-unavailable',
        active: false,
        reason: 'encryption-backend-unprotected',
      });
      expect(service.deactivate()).toMatchObject({
        status: 'storage-unavailable',
        active: false,
        reason: 'encryption-backend-unprotected',
      });
      expect(service.getInstallationId()).toBeNull();
    },
  );

  it.each(['gnome_libsecret', 'kwallet', 'kwallet5', 'kwallet6'])(
    'accepts the protected Linux safeStorage backend %s',
    (backend) => {
      const fixture = createFixture();
      const service = createRtPtLicenseService({
        fs,
        path,
        crypto,
        secureStorage: {
          ...createSecureStorage(),
          getSelectedStorageBackend: () => backend,
        },
        userDataDir: path.join(fixture.root, `linux-${backend}`),
        publicKeyPath: fixture.publicKeyPath,
        now: () => new Date('2026-07-20T10:00:00.000Z'),
        platform: 'linux',
      });

      expect(service.status()).toMatchObject({
        status: 'missing',
        active: false,
      });
    },
  );

  it('keeps the Linux fallback for secure storage without Electron backend selection', () => {
    const fixture = createFixture();
    const service = createRtPtLicenseService({
      fs,
      path,
      crypto,
      secureStorage: createSecureStorage(),
      userDataDir: path.join(fixture.root, 'linux-fallback'),
      publicKeyPath: fixture.publicKeyPath,
      now: () => new Date('2026-07-20T10:00:00.000Z'),
      platform: 'linux',
    });

    expect(service.status()).toMatchObject({
      status: 'missing',
      active: false,
    });
  });

  it.each(['win32', 'darwin'])(
    'does not query the Linux-only backend selector on %s',
    (platformName) => {
      const fixture = createFixture();
      let backendQueries = 0;
      const service = createRtPtLicenseService({
        fs,
        path,
        crypto,
        secureStorage: {
          ...createSecureStorage(),
          getSelectedStorageBackend: () => {
            backendQueries += 1;
            return 'basic_text';
          },
        },
        userDataDir: path.join(fixture.root, platformName),
        publicKeyPath: fixture.publicKeyPath,
        now: () => new Date('2026-07-20T10:00:00.000Z'),
        platform: platformName,
      });

      expect(service.status()).toMatchObject({
        status: 'missing',
        active: false,
      });
      expect(backendQueries).toBe(0);
    },
  );
});
