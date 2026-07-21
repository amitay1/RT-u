import type { Express, NextFunction, Request, Response } from "express";
import crypto, { type KeyObject } from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const {
  APP_ID,
  PRODUCT,
  createRtPtLicenseService,
} = require("../electron/rtpt-license-service.cjs") as {
  APP_ID: string;
  PRODUCT: string;
  createRtPtLicenseService: (options: {
    fs: typeof fs;
    path: typeof path;
    crypto: typeof crypto;
    secureStorage: RtPtSecureStorage;
    userDataDir: string;
    publicKeyPath: string;
    now?: () => Date;
  }) => RtPtLicenseService;
};

const STORAGE_MAGIC = Buffer.from("RTPTSS1", "ascii");
const STORAGE_SEED_FILE = "rtpt-license-storage.seed";
const LICENSE_PUBLIC_KEY_FINGERPRINT_ENV = "RTPT_LICENSE_PUBLIC_KEY_SHA256";
const LICENSED_API_PATHS = [
  "/api/technique-sheets",
  "/api/organizations",
  "/api/inspector-profiles",
] as const;

class LicenseAuthorityPinningError extends Error {
  constructor(
    message: string,
    readonly reason: string,
  ) {
    super(message);
    this.name = "LicenseAuthorityPinningError";
  }
}

export interface RtPtLicenseStatusRecord {
  status: string;
  active: boolean;
  product: string;
  appId: string;
  installationId: string | null;
  reason: string | null;
  message: string;
  license?: Record<string, unknown>;
}

interface RtPtLicenseService {
  getStatus(): RtPtLicenseStatusRecord;
  activate(token: string): RtPtLicenseStatusRecord;
  deactivate(): RtPtLicenseStatusRecord;
}

interface RtPtSecureStorage {
  isEncryptionAvailable(): boolean;
  encryptString(value: string): Buffer;
  decryptString(value: Buffer): string;
}

interface MachineBoundSecureStorageOptions {
  userDataDir: string;
  machineIdentity?: string | null;
  fsApi?: typeof fs;
  pathApi?: typeof path;
  cryptoApi?: typeof crypto;
}

interface StandaloneLicenseRuntimeOptions extends MachineBoundSecureStorageOptions {
  publicKeyPath?: string;
  now?: () => Date;
}

export interface StandaloneRtPtLicenseRuntime {
  service: RtPtLicenseService;
  register(app: Express): void;
}

const normalizePublicKeyFingerprint = (value: unknown): string => {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/^sha256\s*:/, "")
    .replace(/:/g, "");

  if (!/^[a-f0-9]{64}$/.test(normalized)) {
    throw new LicenseAuthorityPinningError(
      "The expected RT/PT license public-key SHA-256 fingerprint must contain exactly 64 hexadecimal characters.",
      "fingerprint-format-invalid",
    );
  }
  return normalized;
};

const verifyProductionLicenseAuthority = ({
  publicKeyPath,
  expectedFingerprint,
  fsApi,
  cryptoApi,
}: {
  publicKeyPath: string;
  expectedFingerprint: unknown;
  fsApi: typeof fs;
  cryptoApi: typeof crypto;
}): void => {
  let publicKeyContent: Buffer;
  try {
    publicKeyContent = fsApi.readFileSync(publicKeyPath);
  } catch (error) {
    if (error && (error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new LicenseAuthorityPinningError(
        `The RT/PT license public key is missing: ${publicKeyPath}`,
        "public-key-missing",
      );
    }
    throw new LicenseAuthorityPinningError(
      `The RT/PT license public key cannot be read: ${publicKeyPath}`,
      "public-key-unreadable",
    );
  }

  if (
    expectedFingerprint === undefined
    || expectedFingerprint === null
    || String(expectedFingerprint).trim() === ""
  ) {
    throw new LicenseAuthorityPinningError(
      `${LICENSE_PUBLIC_KEY_FINGERPRINT_ENV} is required for the production license runtime.`,
      "fingerprint-required",
    );
  }

  const expected = normalizePublicKeyFingerprint(expectedFingerprint);
  const pem = publicKeyContent.toString("utf8").trim();
  if (/-----BEGIN [^-]*PRIVATE KEY-----/.test(pem)) {
    throw new LicenseAuthorityPinningError(
      "Private key material cannot be used as the RT/PT license public key.",
      "private-key-material-forbidden",
    );
  }
  if (!/^-----BEGIN PUBLIC KEY-----\r?\n(?:[A-Za-z0-9+/=]+\r?\n)+-----END PUBLIC KEY-----$/.test(pem)) {
    throw new LicenseAuthorityPinningError(
      "The RT/PT license public key must be a SubjectPublicKeyInfo PUBLIC KEY PEM.",
      "public-key-not-spki-pem",
    );
  }

  let publicKey: KeyObject;
  try {
    publicKey = cryptoApi.createPublicKey(pem);
  } catch {
    throw new LicenseAuthorityPinningError(
      "The RT/PT license public key is not a parseable public key.",
      "public-key-not-parseable",
    );
  }
  if (publicKey.type !== "public" || publicKey.asymmetricKeyType !== "ed25519") {
    throw new LicenseAuthorityPinningError(
      "The RT/PT license public key must be an Ed25519 public key.",
      "public-key-not-ed25519",
    );
  }

  const actual = exportPublicKeyFingerprint(publicKey, cryptoApi);
  if (actual !== expected) {
    throw new LicenseAuthorityPinningError(
      `The RT/PT license public-key fingerprint does not match the controlled expected fingerprint (actual: ${actual}).`,
      "fingerprint-mismatch",
    );
  }
};

const cleanMachineIdentity = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const cleaned = value.trim();
  return cleaned.length >= 8 && cleaned.length <= 512 ? cleaned : null;
};

export function resolveMachineIdentity(): string | null {
  try {
    if (process.platform === "win32") {
      const result = execFileSync(
        "reg.exe",
        ["query", "HKLM\\SOFTWARE\\Microsoft\\Cryptography", "/v", "MachineGuid"],
        { encoding: "utf8", windowsHide: true, timeout: 4_000 },
      );
      return cleanMachineIdentity(/MachineGuid\s+REG_SZ\s+([^\r\n]+)/iu.exec(result)?.[1]);
    }

    if (process.platform === "darwin") {
      const result = execFileSync(
        "ioreg",
        ["-rd1", "-c", "IOPlatformExpertDevice"],
        { encoding: "utf8", timeout: 4_000 },
      );
      return cleanMachineIdentity(/"IOPlatformUUID"\s*=\s*"([^"]+)"/u.exec(result)?.[1]);
    }

    for (const candidate of ["/etc/machine-id", "/var/lib/dbus/machine-id"]) {
      try {
        return cleanMachineIdentity(fs.readFileSync(candidate, "utf8"));
      } catch {
        // Try the next standard machine identity location.
      }
    }
  } catch {
    return null;
  }
  return null;
}

export function createMachineBoundSecureStorage({
  userDataDir,
  machineIdentity = resolveMachineIdentity(),
  fsApi = fs,
  pathApi = path,
  cryptoApi = crypto,
}: MachineBoundSecureStorageOptions): RtPtSecureStorage {
  const normalizedIdentity = cleanMachineIdentity(machineIdentity);
  const seedPath = pathApi.join(userDataDir, STORAGE_SEED_FILE);
  let cachedKey: Buffer | null = null;

  const loadKey = (): Buffer => {
    if (cachedKey) return cachedKey;
    if (!normalizedIdentity) throw new Error("A stable OS machine identity is unavailable.");

    fsApi.mkdirSync(userDataDir, { recursive: true, mode: 0o700 });
    let seed: Buffer;
    try {
      seed = fsApi.readFileSync(seedPath);
    } catch (error) {
      if (!error || (error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      seed = cryptoApi.randomBytes(32);
      try {
        fsApi.writeFileSync(seedPath, seed, { flag: "wx", mode: 0o600 });
      } catch (writeError) {
        if (!writeError || (writeError as NodeJS.ErrnoException).code !== "EEXIST") throw writeError;
        seed = fsApi.readFileSync(seedPath);
      }
    }
    if (seed.length !== 32) throw new Error("The local license storage seed is invalid.");

    cachedKey = cryptoApi
      .createHash("sha256")
      .update("rtpt-inspector|machine-bound-storage|v1\0", "utf8")
      .update(seed)
      .update("\0", "utf8")
      .update(normalizedIdentity, "utf8")
      .digest();
    return cachedKey;
  };

  return {
    isEncryptionAvailable: () => {
      try {
        return loadKey().length === 32;
      } catch {
        return false;
      }
    },
    encryptString: (plaintext: string) => {
      const nonce = cryptoApi.randomBytes(12);
      const cipher = cryptoApi.createCipheriv("aes-256-gcm", loadKey(), nonce);
      cipher.setAAD(STORAGE_MAGIC);
      const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
      return Buffer.concat([STORAGE_MAGIC, nonce, cipher.getAuthTag(), ciphertext]);
    },
    decryptString: (encrypted: Buffer) => {
      if (!Buffer.isBuffer(encrypted) || encrypted.length <= STORAGE_MAGIC.length + 28) {
        throw new Error("The encrypted license record is invalid.");
      }
      if (!encrypted.subarray(0, STORAGE_MAGIC.length).equals(STORAGE_MAGIC)) {
        throw new Error("The encrypted license record has an unknown format.");
      }
      const nonceStart = STORAGE_MAGIC.length;
      const tagStart = nonceStart + 12;
      const ciphertextStart = tagStart + 16;
      const decipher = cryptoApi.createDecipheriv(
        "aes-256-gcm",
        loadKey(),
        encrypted.subarray(nonceStart, tagStart),
      );
      decipher.setAAD(STORAGE_MAGIC);
      decipher.setAuthTag(encrypted.subarray(tagStart, ciphertextStart));
      return Buffer.concat([
        decipher.update(encrypted.subarray(ciphertextStart)),
        decipher.final(),
      ]).toString("utf8");
    },
  };
}

export function resolveStandaloneLicenseDataDirectory(): string {
  const configured = String(process.env.RTPT_LICENSE_DATA_DIR || "").trim();
  if (configured) return path.resolve(configured);
  if (process.platform === "win32") {
    const localAppData = String(process.env.LOCALAPPDATA || "").trim();
    if (localAppData) return path.join(localAppData, "RT-PT Inspector");
  }
  if (process.platform === "darwin") {
    return path.join(os.homedir(), "Library", "Application Support", "RT-PT Inspector");
  }
  const xdgDataHome = String(process.env.XDG_DATA_HOME || "").trim();
  return xdgDataHome
    ? path.join(xdgDataHome, "rt-pt-inspector")
    : path.join(os.homedir(), ".local", "share", "rt-pt-inspector");
}

export function createStandaloneRtPtLicenseRuntime({
  userDataDir = resolveStandaloneLicenseDataDirectory(),
  publicKeyPath = path.resolve(
    String(process.env.RTPT_LICENSE_PUBLIC_KEY_PATH || "").trim()
      || path.join(process.cwd(), "electron", "rtpt-license-public-key.pem"),
  ),
  machineIdentity,
  fsApi = fs,
  pathApi = path,
  cryptoApi = crypto,
  now,
}: Partial<StandaloneLicenseRuntimeOptions> = {}): StandaloneRtPtLicenseRuntime {
  if (process.env.NODE_ENV === "production") {
    verifyProductionLicenseAuthority({
      publicKeyPath,
      expectedFingerprint: process.env[LICENSE_PUBLIC_KEY_FINGERPRINT_ENV],
      fsApi,
      cryptoApi,
    });
  }

  const secureStorage = createMachineBoundSecureStorage({
    userDataDir,
    machineIdentity,
    fsApi,
    pathApi,
    cryptoApi,
  });
  const service = createRtPtLicenseService({
    fs: fsApi,
    path: pathApi,
    crypto: cryptoApi,
    secureStorage,
    userDataDir,
    publicKeyPath,
    now,
  });

  const requireActiveLicense = (_req: Request, res: Response, next: NextFunction) => {
    const status = service.getStatus();
    if (status.active === true) return next();
    return res.status(403).json({
      error: "An active RT-PT Inspector license is required.",
      status: status.status,
      reason: status.reason,
      installationId: status.installationId,
    });
  };

  return {
    service,
    register(app: Express) {
      app.get("/api/rtpt-license/status", (_req, res) => {
        res.json(service.getStatus());
      });
      app.post("/api/rtpt-license/activate", (req, res) => {
        const token = typeof req.body?.token === "string" ? req.body.token : "";
        if (!token || token.length > 200_000) {
          return res.status(400).json({
            status: "invalid",
            active: false,
            product: PRODUCT,
            appId: APP_ID,
            installationId: service.getStatus().installationId,
            reason: "license-format-invalid",
            message: "A valid activation code is required.",
          });
        }
        return res.json(service.activate(token));
      });
      app.post("/api/rtpt-license/deactivate", (_req, res) => {
        res.json(service.deactivate());
      });
      app.use([...LICENSED_API_PATHS], requireActiveLicense);
    },
  };
}

export function exportPublicKeyFingerprint(
  publicKey: KeyObject,
  cryptoApi: typeof crypto = crypto,
): string {
  return cryptoApi
    .createHash("sha256")
    .update(publicKey.export({ type: "spki", format: "der" }))
    .digest("hex");
}
