'use strict';

const PRODUCT = 'rt-pt-inspector';
const APP_ID = 'com.amitay.rtptinspector';
const TOKEN_PREFIX = 'RTPT1';
const LICENSE_SCHEMA_VERSION = 1;
const LICENSE_NAMESPACE = 'rtpt-inspector-license';
const INSTALLATION_FILE = 'installation.enc';
const LEGACY_INSTALLATION_FILE = 'installation.json';
const LICENSE_FILE = 'license.enc';
const CLOCK_FILE = 'clock.enc';
const MAX_CLOCK_SKEW_MS = 5 * 60 * 1000;
const MAX_TOKEN_LENGTH = 16 * 1024;
const MAX_ENCRYPTED_RECORD_LENGTH = 128 * 1024;
const REQUIRED_FEATURES = Object.freeze(['rt-film', 'rt-digital', 'pt']);
const PROTECTED_LINUX_STORAGE_BACKENDS = new Set([
  'gnome_libsecret',
  'kwallet',
  'kwallet5',
  'kwallet6',
]);
const ALLOWED_STATUSES = Object.freeze([
  'active',
  'missing',
  'configuration-required',
  'storage-unavailable',
  'invalid',
  'expired',
  'installation-mismatch',
  'clock-invalid',
]);

const STATUS_MESSAGES = Object.freeze({
  active: 'License is active.',
  missing: 'No license is activated for this installation.',
  'configuration-required': 'License verification is not configured for this installation.',
  'storage-unavailable': 'Secure license storage is unavailable.',
  invalid: 'The license could not be verified.',
  expired: 'The license has expired.',
  'installation-mismatch': 'The license was issued for a different installation.',
  'clock-invalid': 'The system clock could not be trusted for license verification.',
});

const PAYLOAD_KEYS = Object.freeze([
  'schemaVersion',
  'product',
  'appId',
  'licenseId',
  'customer',
  'installationId',
  'issuedAt',
  'expiresAt',
  'edition',
  'features',
].sort());

const INSTALLATION_KEYS = Object.freeze([
  'schemaVersion',
  'product',
  'appId',
  'installationId',
].sort());

const LICENSE_RECORD_KEYS = Object.freeze([
  'schemaVersion',
  'product',
  'appId',
  'token',
].sort());

const CLOCK_RECORD_KEYS = Object.freeze([
  'schemaVersion',
  'product',
  'appId',
  'installationId',
  'lastSeenAt',
].sort());

const isPlainObject = (value) => (
  value !== null
  && typeof value === 'object'
  && !Array.isArray(value)
  && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null)
);

const hasExactKeys = (value, expectedKeys) => {
  if (!isPlainObject(value)) return false;
  const actualKeys = Object.keys(value).sort();
  return actualKeys.length === expectedKeys.length
    && actualKeys.every((key, index) => key === expectedKeys[index]);
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const isUuid = (value) => typeof value === 'string' && UUID_PATTERN.test(value);

const parseCanonicalIso = (value) => {
  if (typeof value !== 'string') return null;
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return null;
  const date = new Date(timestamp);
  return date.toISOString() === value ? timestamp : null;
};

const validatePayload = (payload) => {
  if (!hasExactKeys(payload, PAYLOAD_KEYS)) return false;
  if (payload.schemaVersion !== LICENSE_SCHEMA_VERSION) return false;
  if (payload.product !== PRODUCT || payload.appId !== APP_ID) return false;
  if (!isUuid(payload.licenseId) || !isUuid(payload.installationId)) return false;
  if (
    typeof payload.customer !== 'string'
    || payload.customer.length < 1
    || payload.customer.length > 120
    || payload.customer !== payload.customer.trim()
    || /[\u0000-\u001f\u007f]/u.test(payload.customer)
  ) return false;
  const issuedAt = parseCanonicalIso(payload.issuedAt);
  if (issuedAt === null) return false;
  if (payload.expiresAt !== null) {
    const expiresAt = parseCanonicalIso(payload.expiresAt);
    if (expiresAt === null || expiresAt <= issuedAt) return false;
  }
  if (payload.edition !== 'professional') return false;
  if (!Array.isArray(payload.features) || payload.features.length !== REQUIRED_FEATURES.length) {
    return false;
  }
  const uniqueFeatures = new Set(payload.features);
  if (uniqueFeatures.size !== payload.features.length) return false;
  if (!payload.features.every((feature) => REQUIRED_FEATURES.includes(feature))) return false;
  return REQUIRED_FEATURES.every((feature) => uniqueFeatures.has(feature));
};

const isCanonicalBase64Url = (value) => {
  if (typeof value !== 'string' || value.length === 0 || !/^[A-Za-z0-9_-]+$/u.test(value)) {
    return false;
  }
  try {
    return Buffer.from(value, 'base64url').toString('base64url') === value;
  } catch {
    return false;
  }
};

const makeResult = (status, installationId, reason, license) => {
  const result = {
    status,
    active: status === 'active',
    product: PRODUCT,
    appId: APP_ID,
    installationId: installationId || null,
    reason: status === 'active' ? null : reason,
    message: STATUS_MESSAGES[status],
  };
  if (license) result.license = { ...license, features: [...license.features] };
  return result;
};

const createRtPtLicenseService = ({
  fs: fsApi = require('node:fs'),
  path: pathApi = require('node:path'),
  crypto: cryptoApi = require('node:crypto'),
  secureStorage,
  userDataDir,
  publicKeyPath,
  now = () => new Date(),
  platform = process.platform,
} = {}) => {
  const namespaceDirectory = (
    typeof userDataDir === 'string' && userDataDir.trim().length > 0
      ? pathApi.join(userDataDir, LICENSE_NAMESPACE)
      : null
  );
  const installationPath = namespaceDirectory
    ? pathApi.join(namespaceDirectory, INSTALLATION_FILE)
    : null;
  const legacyInstallationPath = namespaceDirectory
    ? pathApi.join(namespaceDirectory, LEGACY_INSTALLATION_FILE)
    : null;
  const licensePath = namespaceDirectory ? pathApi.join(namespaceDirectory, LICENSE_FILE) : null;
  const clockPath = namespaceDirectory ? pathApi.join(namespaceDirectory, CLOCK_FILE) : null;

  const ensureNamespace = () => {
    if (!namespaceDirectory) {
      return { ok: false, reason: 'user-data-directory-unavailable' };
    }
    try {
      fsApi.mkdirSync(namespaceDirectory, { recursive: true, mode: 0o700 });
      return { ok: true };
    } catch {
      return { ok: false, reason: 'license-directory-unavailable' };
    }
  };

  const readOptionalFile = (filePath) => {
    try {
      const value = fsApi.readFileSync(filePath);
      return { ok: true, exists: true, value };
    } catch (error) {
      if (error && error.code === 'ENOENT') return { ok: true, exists: false, value: null };
      return { ok: false, reason: 'license-storage-read-failed' };
    }
  };

  const writeAtomic = (filePath, value) => {
    const suffix = cryptoApi.randomBytes(8).toString('hex');
    const temporaryPath = `${filePath}.tmp-${suffix}`;
    try {
      fsApi.writeFileSync(temporaryPath, value, { mode: 0o600 });
      fsApi.renameSync(temporaryPath, filePath);
      return { ok: true };
    } catch {
      try {
        fsApi.unlinkSync(temporaryPath);
      } catch {
        // Best-effort cleanup; the primary error is reported to the caller.
      }
      return { ok: false, reason: 'license-storage-write-failed' };
    }
  };

  const loadInstallationId = () => {
    const directory = ensureNamespace();
    if (!directory.ok) return directory;

    const stored = readOptionalFile(installationPath);
    if (!stored.ok) return stored;
    if (stored.exists) {
      const decrypted = decryptRecord(stored.value, INSTALLATION_KEYS);
      if (!decrypted.ok) return { ok: false, reason: 'installation-record-invalid' };
      const record = decrypted.value;
      if (
        record.schemaVersion !== LICENSE_SCHEMA_VERSION
        || record.product !== PRODUCT
        || record.appId !== APP_ID
        || !isUuid(record.installationId)
      ) {
        return { ok: false, reason: 'installation-record-invalid' };
      }
      return { ok: true, value: record.installationId };
    }

    // Migrate the short-lived plaintext V1 installation record without changing
    // an already-issued installation code. The plaintext record is removed only
    // after its encrypted replacement has been committed successfully.
    const legacy = readOptionalFile(legacyInstallationPath);
    if (!legacy.ok) return legacy;
    if (legacy.exists) {
      try {
        const record = JSON.parse(legacy.value.toString('utf8'));
        if (
          !hasExactKeys(record, INSTALLATION_KEYS)
          || record.schemaVersion !== LICENSE_SCHEMA_VERSION
          || record.product !== PRODUCT
          || record.appId !== APP_ID
          || !isUuid(record.installationId)
        ) {
          return { ok: false, reason: 'installation-record-invalid' };
        }
        const migrated = writeEncryptedRecord(installationPath, record);
        if (!migrated.ok) return migrated;
        try {
          fsApi.unlinkSync(legacyInstallationPath);
        } catch {
          // The encrypted record is authoritative. A stale legacy record is
          // ignored on subsequent starts and can be removed during maintenance.
        }
        return { ok: true, value: record.installationId };
      } catch {
        return { ok: false, reason: 'installation-record-invalid' };
      }
    }

    const installationId = cryptoApi.randomUUID();
    const record = {
      schemaVersion: LICENSE_SCHEMA_VERSION,
      product: PRODUCT,
      appId: APP_ID,
      installationId,
    };
    const written = writeEncryptedRecord(installationPath, record);
    return written.ok
      ? { ok: true, value: installationId }
      : { ok: false, reason: written.reason || 'installation-record-write-failed' };
  };

  const loadPublicKey = () => {
    if (typeof publicKeyPath !== 'string' || publicKeyPath.trim().length === 0) {
      return { ok: false, reason: 'public-key-not-configured' };
    }
    try {
      const pem = fsApi.readFileSync(publicKeyPath, 'utf8');
      const key = cryptoApi.createPublicKey(pem);
      if (key.type !== 'public' || key.asymmetricKeyType !== 'ed25519') {
        return { ok: false, reason: 'public-key-invalid' };
      }
      return { ok: true, value: key };
    } catch {
      return { ok: false, reason: 'public-key-invalid' };
    }
  };

  const ensureSecureStorage = () => {
    if (
      !secureStorage
      || typeof secureStorage.isEncryptionAvailable !== 'function'
      || typeof secureStorage.encryptString !== 'function'
      || typeof secureStorage.decryptString !== 'function'
    ) {
      return { ok: false, reason: 'encryption-unavailable' };
    }
    try {
      if (!secureStorage.isEncryptionAvailable()) {
        return { ok: false, reason: 'encryption-unavailable' };
      }
      if (platform === 'linux' && typeof secureStorage.getSelectedStorageBackend === 'function') {
        const backend = secureStorage.getSelectedStorageBackend();
        if (!PROTECTED_LINUX_STORAGE_BACKENDS.has(backend)) {
          return { ok: false, reason: 'encryption-backend-unprotected' };
        }
      }
      return { ok: true };
    } catch {
      return { ok: false, reason: 'encryption-unavailable' };
    }
  };

  const getCurrentTime = () => {
    try {
      const supplied = now();
      const date = supplied instanceof Date ? supplied : new Date(supplied);
      const timestamp = date.getTime();
      return Number.isFinite(timestamp)
        ? { ok: true, timestamp, iso: date.toISOString() }
        : { ok: false, reason: 'system-clock-invalid' };
    } catch {
      return { ok: false, reason: 'system-clock-invalid' };
    }
  };

  const encryptRecord = (record) => {
    try {
      const encrypted = secureStorage.encryptString(JSON.stringify(record));
      if (!Buffer.isBuffer(encrypted) && !(encrypted instanceof Uint8Array)) {
        return { ok: false, reason: 'encryption-failed' };
      }
      return { ok: true, value: Buffer.from(encrypted) };
    } catch {
      return { ok: false, reason: 'encryption-failed' };
    }
  };

  const decryptRecord = (encrypted, expectedKeys) => {
    if (!Buffer.isBuffer(encrypted) || encrypted.length === 0 || encrypted.length > MAX_ENCRYPTED_RECORD_LENGTH) {
      return { ok: false };
    }
    try {
      const plaintext = secureStorage.decryptString(encrypted);
      if (typeof plaintext !== 'string' || plaintext.length === 0 || plaintext.length > MAX_TOKEN_LENGTH * 2) {
        return { ok: false };
      }
      const record = JSON.parse(plaintext);
      return hasExactKeys(record, expectedKeys) ? { ok: true, value: record } : { ok: false };
    } catch {
      return { ok: false };
    }
  };

  const writeEncryptedRecord = (filePath, record) => {
    const encrypted = encryptRecord(record);
    if (!encrypted.ok) return encrypted;
    return writeAtomic(filePath, encrypted.value);
  };

  const writeClock = (installationId, currentTime) => writeEncryptedRecord(clockPath, {
    schemaVersion: LICENSE_SCHEMA_VERSION,
    product: PRODUCT,
    appId: APP_ID,
    installationId,
    lastSeenAt: currentTime.iso,
  });

  const prepareClock = (installationId) => {
    const currentTime = getCurrentTime();
    if (!currentTime.ok) return currentTime;

    const stored = readOptionalFile(clockPath);
    if (!stored.ok) return stored;
    if (!stored.exists) {
      return { ok: false, reason: 'clock-record-missing' };
    }

    const decrypted = decryptRecord(stored.value, CLOCK_RECORD_KEYS);
    if (!decrypted.ok) return { ok: false, reason: 'clock-record-corrupt' };
    const record = decrypted.value;
    const lastSeenAt = parseCanonicalIso(record.lastSeenAt);
    if (
      record.schemaVersion !== LICENSE_SCHEMA_VERSION
      || record.product !== PRODUCT
      || record.appId !== APP_ID
      || record.installationId !== installationId
      || lastSeenAt === null
    ) {
      return { ok: false, reason: 'clock-record-corrupt' };
    }
    if (currentTime.timestamp + MAX_CLOCK_SKEW_MS < lastSeenAt) {
      return { ok: false, reason: 'system-clock-rollback' };
    }
    if (currentTime.timestamp > lastSeenAt) {
      const write = writeClock(installationId, currentTime);
      if (!write.ok) return write;
    }
    return { ok: true, ...currentTime };
  };

  const parseAndVerifyToken = (candidate, publicKey, installationId, currentTimestamp) => {
    if (typeof candidate !== 'string') {
      return { ok: false, status: 'invalid', reason: 'license-format-invalid' };
    }
    const token = candidate.trim();
    if (token.length === 0 || token.length > MAX_TOKEN_LENGTH) {
      return { ok: false, status: 'invalid', reason: 'license-format-invalid' };
    }
    const parts = token.split('.');
    if (
      parts.length !== 3
      || parts[0] !== TOKEN_PREFIX
      || !isCanonicalBase64Url(parts[1])
      || !isCanonicalBase64Url(parts[2])
    ) {
      return { ok: false, status: 'invalid', reason: 'license-format-invalid' };
    }

    let payload;
    let signature;
    try {
      const payloadBytes = Buffer.from(parts[1], 'base64url');
      if (payloadBytes.length === 0 || payloadBytes.length > MAX_TOKEN_LENGTH / 2) {
        return { ok: false, status: 'invalid', reason: 'license-format-invalid' };
      }
      payload = JSON.parse(payloadBytes.toString('utf8'));
      signature = Buffer.from(parts[2], 'base64url');
    } catch {
      return { ok: false, status: 'invalid', reason: 'license-format-invalid' };
    }
    if (!validatePayload(payload)) {
      return { ok: false, status: 'invalid', reason: 'license-payload-invalid' };
    }
    if (signature.length !== 64) {
      return { ok: false, status: 'invalid', reason: 'license-signature-invalid' };
    }

    const signedBytes = Buffer.from(`${TOKEN_PREFIX}.${parts[1]}`, 'ascii');
    let signatureValid = false;
    try {
      signatureValid = cryptoApi.verify(null, signedBytes, publicKey, signature);
    } catch {
      signatureValid = false;
    }
    if (!signatureValid) {
      return { ok: false, status: 'invalid', reason: 'license-signature-invalid' };
    }

    const issuedAt = Date.parse(payload.issuedAt);
    if (issuedAt > currentTimestamp + MAX_CLOCK_SKEW_MS) {
      return {
        ok: false,
        status: 'clock-invalid',
        reason: 'license-issued-in-future',
        license: payload,
      };
    }
    if (payload.installationId !== installationId) {
      return {
        ok: false,
        status: 'installation-mismatch',
        reason: 'installation-id-mismatch',
        license: payload,
      };
    }
    if (payload.expiresAt !== null && currentTimestamp >= Date.parse(payload.expiresAt)) {
      return {
        ok: false,
        status: 'expired',
        reason: 'license-expired',
        license: payload,
      };
    }
    return { ok: true, token, license: payload };
  };

  const prepare = () => {
    const storage = ensureSecureStorage();
    if (!storage.ok) {
      return {
        ok: false,
        result: makeResult('storage-unavailable', null, storage.reason),
      };
    }
    const installation = loadInstallationId();
    if (!installation.ok) {
      return {
        ok: false,
        result: makeResult('storage-unavailable', null, installation.reason),
      };
    }
    const installationId = installation.value;

    const publicKey = loadPublicKey();
    if (!publicKey.ok) {
      return {
        ok: false,
        result: makeResult('configuration-required', installationId, publicKey.reason),
      };
    }
    return { ok: true, installationId, publicKey: publicKey.value };
  };

  const status = () => {
    const prepared = prepare();
    if (!prepared.ok) return prepared.result;

    const storedLicense = readOptionalFile(licensePath);
    if (!storedLicense.ok) {
      return makeResult('storage-unavailable', prepared.installationId, storedLicense.reason);
    }
    if (!storedLicense.exists) {
      return makeResult('missing', prepared.installationId, 'license-not-activated');
    }
    const clock = prepareClock(prepared.installationId);
    if (!clock.ok) {
      const storageReasons = new Set([
        'license-storage-read-failed',
        'license-storage-write-failed',
        'encryption-failed',
      ]);
      const clockStatus = storageReasons.has(clock.reason) ? 'storage-unavailable' : 'clock-invalid';
      return makeResult(clockStatus, prepared.installationId, clock.reason);
    }
    const decrypted = decryptRecord(storedLicense.value, LICENSE_RECORD_KEYS);
    if (!decrypted.ok) {
      return makeResult('invalid', prepared.installationId, 'license-storage-corrupt');
    }
    const record = decrypted.value;
    if (
      record.schemaVersion !== LICENSE_SCHEMA_VERSION
      || record.product !== PRODUCT
      || record.appId !== APP_ID
      || typeof record.token !== 'string'
    ) {
      return makeResult('invalid', prepared.installationId, 'license-storage-corrupt');
    }

    const verification = parseAndVerifyToken(
      record.token,
      prepared.publicKey,
      prepared.installationId,
      clock.timestamp,
    );
    if (!verification.ok) {
      return makeResult(
        verification.status,
        prepared.installationId,
        verification.reason,
        verification.license,
      );
    }
    return makeResult('active', prepared.installationId, null, verification.license);
  };

  const activate = (token) => {
    const prepared = prepare();
    if (!prepared.ok) return prepared.result;

    const existingLicense = readOptionalFile(licensePath);
    if (!existingLicense.ok) {
      return makeResult('storage-unavailable', prepared.installationId, existingLicense.reason);
    }
    const clock = existingLicense.exists
      ? prepareClock(prepared.installationId)
      : getCurrentTime();
    if (!clock.ok) {
      const storageReasons = new Set([
        'license-storage-read-failed',
        'license-storage-write-failed',
        'encryption-failed',
      ]);
      const clockStatus = storageReasons.has(clock.reason) ? 'storage-unavailable' : 'clock-invalid';
      return makeResult(clockStatus, prepared.installationId, clock.reason);
    }

    const verification = parseAndVerifyToken(
      token,
      prepared.publicKey,
      prepared.installationId,
      clock.timestamp,
    );
    if (!verification.ok) {
      return makeResult(
        verification.status,
        prepared.installationId,
        verification.reason,
        verification.license,
      );
    }

    if (!existingLicense.exists) {
      const clockWrite = writeClock(prepared.installationId, clock);
      if (!clockWrite.ok) {
        return makeResult('storage-unavailable', prepared.installationId, clockWrite.reason);
      }
    }

    const write = writeEncryptedRecord(licensePath, {
      schemaVersion: LICENSE_SCHEMA_VERSION,
      product: PRODUCT,
      appId: APP_ID,
      token: verification.token,
    });
    if (!write.ok) {
      return makeResult('storage-unavailable', prepared.installationId, write.reason);
    }
    return makeResult('active', prepared.installationId, null, verification.license);
  };

  const deactivate = () => {
    const storage = ensureSecureStorage();
    if (!storage.ok) {
      return makeResult('storage-unavailable', null, storage.reason);
    }
    const installation = loadInstallationId();
    if (!installation.ok) {
      return makeResult('storage-unavailable', null, installation.reason);
    }
    try {
      fsApi.unlinkSync(licensePath);
    } catch (error) {
      if (!error || error.code !== 'ENOENT') {
        return makeResult('storage-unavailable', installation.value, 'license-storage-delete-failed');
      }
    }
    return makeResult('missing', installation.value, 'license-deactivated');
  };

  const getInstallationId = () => {
    const storage = ensureSecureStorage();
    if (!storage.ok) return null;
    const installation = loadInstallationId();
    return installation.ok ? installation.value : null;
  };

  return Object.freeze({
    status,
    getStatus: status,
    activate,
    deactivate,
    getInstallationId,
  });
};

module.exports = {
  createRtPtLicenseService,
  PRODUCT,
  APP_ID,
  TOKEN_PREFIX,
  LICENSE_SCHEMA_VERSION,
  LICENSE_NAMESPACE,
  INSTALLATION_FILE,
  LEGACY_INSTALLATION_FILE,
  LICENSE_FILE,
  CLOCK_FILE,
  MAX_CLOCK_SKEW_MS,
  REQUIRED_FEATURES,
  ALLOWED_STATUSES,
};
