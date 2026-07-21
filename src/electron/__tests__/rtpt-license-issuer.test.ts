import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { afterEach, describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const { issueLicense } = require("../../../scripts/issue-rtpt-license.cjs");
const { createRtPtLicenseService } = require("../../../electron/rtpt-license-service.cjs");

const temporaryDirectories: string[] = [];

const testSecureStorage = {
  isEncryptionAvailable: () => true,
  encryptString: (value: string) => Buffer.from(value, "utf8"),
  decryptString: (value: Buffer) => value.toString("utf8"),
};

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

describe("RT-PT license issuer", () => {
  it("issues a token accepted by the independent RT-PT verifier", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "rtpt-license-issuer-test-"));
    temporaryDirectories.push(root);

    const { privateKey, publicKey } = crypto.generateKeyPairSync("ed25519");
    const privateKeyPath = path.join(root, "private.pem");
    const publicKeyPath = path.join(root, "public.pem");
    fs.writeFileSync(privateKeyPath, privateKey.export({ type: "pkcs8", format: "pem" }));
    fs.writeFileSync(publicKeyPath, publicKey.export({ type: "spki", format: "pem" }));

    const service = createRtPtLicenseService({
      fs,
      path,
      crypto,
      secureStorage: testSecureStorage,
      userDataDir: path.join(root, "user-data"),
      publicKeyPath,
      now: () => new Date("2026-07-20T12:00:00.000Z"),
    });
    const installationId = service.getInstallationId();

    const issued = issueLicense({
      "private-key": privateKeyPath,
      "installation-id": installationId,
      "license-id": crypto.randomUUID(),
      customer: "RT-PT Verification Facility",
      "issued-at": "2026-07-20T11:00:00.000Z",
      expires: "2027-07-20",
    });

    expect(service.activate(issued.token)).toMatchObject({
      status: "active",
      active: true,
      installationId,
      license: {
        customer: "RT-PT Verification Facility",
        expiresAt: "2027-07-20T23:59:59.999Z",
      },
    });
  });

  it("requires an explicit expiry policy", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "rtpt-license-issuer-policy-test-"));
    temporaryDirectories.push(root);
    const { privateKey } = crypto.generateKeyPairSync("ed25519");
    const privateKeyPath = path.join(root, "private.pem");
    fs.writeFileSync(privateKeyPath, privateKey.export({ type: "pkcs8", format: "pem" }));

    expect(() => issueLicense({
      "private-key": privateKeyPath,
      "installation-id": crypto.randomUUID(),
      customer: "RT-PT Verification Facility",
    })).toThrow("Choose --perpetual or provide --expires");
  });
});
