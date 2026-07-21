import { afterEach, describe, expect, it } from 'vitest';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const OfflineUpdater = require('../../../electron/offline-updater.cjs');

const temporaryDirectories: string[] = [];

const createSignedPackage = () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rtpt-offline-update-test-'));
  temporaryDirectories.push(root);
  const packagePath = path.join(root, 'RTPT-Update-2.0.0');
  fs.mkdirSync(packagePath);

  const installerFile = 'RTPT-Inspector-Setup.exe';
  const installer = Buffer.from('signed installer fixture');
  fs.writeFileSync(path.join(packagePath, installerFile), installer);

  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const manifest = {
    version: '2.0.0',
    releaseDate: '2026-07-20',
    changelog: 'Security test package',
    installerFile,
    installerSha256: crypto.createHash('sha256').update(installer).digest('hex'),
    signatureFile: 'update-info.sig',
    platform: process.platform,
  };
  const manifestBytes = Buffer.from(JSON.stringify(manifest, null, 2));
  fs.writeFileSync(path.join(packagePath, 'update-info.json'), manifestBytes);
  fs.writeFileSync(
    path.join(packagePath, manifest.signatureFile),
    crypto.sign('sha256', manifestBytes, privateKey),
  );

  return {
    root,
    packagePath,
    installerFile,
    publicKey: publicKey.export({ type: 'spki', format: 'pem' }),
  };
};

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

describe('OfflineUpdater security validation', () => {
  it('accepts a correctly signed manifest and matching installer', async () => {
    const fixture = createSignedPackage();
    const updater = new OfflineUpdater({ currentVersion: '1.0.0', publicKey: fixture.publicKey });
    const scan = await updater.scanForUpdates(fixture.root);

    expect(scan.packages).toHaveLength(1);
    const validation = await updater.validatePackage(scan.packages[0]);
    expect(validation.valid).toBe(true);
    expect(validation.checks.signature.valid).toBe(true);
    expect(validation.checks.checksum.valid).toBe(true);
  });

  it('fails closed when no pinned public key is configured', async () => {
    const fixture = createSignedPackage();
    const updater = new OfflineUpdater({ currentVersion: '1.0.0' });
    const scan = await updater.scanForUpdates(fixture.root);
    const validation = await updater.validatePackage(scan.packages[0]);

    expect(validation.valid).toBe(false);
    expect(validation.checks.signature.valid).toBe(false);
    expect(validation.checks.signature.skipped).toBe(false);
  });

  it('rejects installer path traversal', () => {
    const fixture = createSignedPackage();
    const updater = new OfflineUpdater({ currentVersion: '1.0.0', publicKey: fixture.publicKey });

    expect(() => updater.resolveContainedFile(
      fixture.packagePath,
      '../outside.exe',
      new Set(['.exe', '.msi']),
    )).toThrow(/unsafe file path|escapes/i);
  });

  it('detects an installer changed after the manifest was signed', async () => {
    const fixture = createSignedPackage();
    const updater = new OfflineUpdater({ currentVersion: '1.0.0', publicKey: fixture.publicKey });
    const scan = await updater.scanForUpdates(fixture.root);
    fs.appendFileSync(path.join(fixture.packagePath, fixture.installerFile), 'tampered');

    const validation = await updater.validatePackage(scan.packages[0]);
    expect(validation.valid).toBe(false);
    expect(validation.checks.checksum.valid).toBe(false);
  });
});
