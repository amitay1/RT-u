import type {
  RtDigitalAttachmentMetadata,
  RtDigitalAttachmentMimeType,
} from '@/types/rtDigital';

export const RT_PT_ASSET_MAX_FILE_BYTES = 10 * 1024 * 1024;
export const RT_PT_ASSET_MAX_TOTAL_BYTES = 50 * 1024 * 1024;
export const RT_PT_ASSET_ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'application/pdf',
] as const satisfies ReadonlyArray<RtDigitalAttachmentMimeType>;

export const RT_PT_ASSET_DATABASE_NAME = 'rtpt_inspector_rt_digital_assets';
export const RT_PT_ASSET_DATABASE_VERSION = 1;
export const RT_PT_ASSET_OBJECT_STORE = 'assets';

export type RtPtAssetStoreErrorCode =
  | 'unavailable'
  | 'invalid-file'
  | 'unsupported-type'
  | 'file-too-large'
  | 'total-too-large'
  | 'quota-exceeded'
  | 'corrupt-record'
  | 'read-failed'
  | 'write-failed';

export class RtPtAssetStoreError extends Error {
  readonly code: RtPtAssetStoreErrorCode;
  readonly cause?: unknown;

  constructor(code: RtPtAssetStoreErrorCode, message: string, options?: { cause?: unknown }) {
    super(message);
    this.name = 'RtPtAssetStoreError';
    this.code = code;
    this.cause = options?.cause;
  }
}

export interface RtPtStoredAsset {
  metadata: RtDigitalAttachmentMetadata;
  blob: Blob;
}

export interface RtPtAssetPutOptions {
  /** Supply an existing attachment ID only when intentionally replacing that asset. */
  id?: string;
  /** Required when the input is a Blob rather than a browser File. */
  fileName?: string;
}

interface RtPtAssetDatabaseRecord extends RtDigitalAttachmentMetadata {
  blob: Blob;
}

const MIME_EXTENSIONS: Readonly<Record<RtDigitalAttachmentMimeType, ReadonlySet<string>>> = {
  'image/jpeg': new Set(['jpg', 'jpeg']),
  'image/png': new Set(['png']),
  'application/pdf': new Set(['pdf']),
};

let openDatabasePromise: Promise<IDBDatabase> | null = null;

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
);

const isAllowedMimeType = (value: string): value is RtDigitalAttachmentMimeType => (
  (RT_PT_ASSET_ALLOWED_MIME_TYPES as readonly string[]).includes(value)
);

const hasControlCharacter = (value: string): boolean => Array.from(value).some((character) => {
  const codePoint = character.codePointAt(0) ?? 0;
  return codePoint <= 0x1f || codePoint === 0x7f;
});

const createAssetId = (): string => {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return `rtpt-asset-${globalThis.crypto.randomUUID()}`;
  }
  return `rtpt-asset-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
};

const normalizeAssetId = (value: string | undefined): string => {
  const id = value?.trim() || createAssetId();
  if (id.length > 160 || hasControlCharacter(id)) {
    throw new RtPtAssetStoreError('invalid-file', 'The attachment ID is invalid.');
  }
  return id;
};

const readFileName = (blob: Blob, suppliedName?: string): string => {
  const browserFileName = typeof File !== 'undefined' && blob instanceof File ? blob.name : '';
  const name = (suppliedName ?? browserFileName).trim();
  if (
    name.length === 0
    || name.length > 255
    || /[\\/]/.test(name)
    || hasControlCharacter(name)
    || name === '.'
    || name === '..'
  ) {
    throw new RtPtAssetStoreError(
      'invalid-file',
      'The attachment must have a safe JPG, JPEG, PNG, or PDF file name.',
    );
  }
  return name;
};

const readMimeType = (blob: Blob, fileName: string): RtDigitalAttachmentMimeType => {
  const mimeType = blob.type.trim().toLowerCase().split(';', 1)[0];
  if (!isAllowedMimeType(mimeType)) {
    throw new RtPtAssetStoreError(
      'unsupported-type',
      'Only JPG, PNG, and PDF attachments are allowed.',
    );
  }

  const extension = fileName.includes('.') ? fileName.split('.').pop()?.toLowerCase() ?? '' : '';
  if (!MIME_EXTENSIONS[mimeType].has(extension)) {
    throw new RtPtAssetStoreError(
      'unsupported-type',
      `The .${extension || '(none)'} extension does not match ${mimeType}.`,
    );
  }
  return mimeType;
};

const hasExpectedSignature = (
  mimeType: RtDigitalAttachmentMimeType,
  bytes: Uint8Array,
): boolean => {
  if (mimeType === 'image/jpeg') {
    return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }
  if (mimeType === 'image/png') {
    const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
    return signature.every((value, index) => bytes[index] === value);
  }
  return bytes.length >= 5
    && bytes[0] === 0x25
    && bytes[1] === 0x50
    && bytes[2] === 0x44
    && bytes[3] === 0x46
    && bytes[4] === 0x2d;
};

const mapStorageFailure = (
  error: unknown,
  fallbackCode: 'read-failed' | 'write-failed',
  message: string,
): RtPtAssetStoreError => {
  if (error instanceof RtPtAssetStoreError) return error;
  if (
    typeof globalThis.DOMException !== 'undefined'
    && error instanceof globalThis.DOMException
    && error.name === 'QuotaExceededError'
  ) {
    return new RtPtAssetStoreError(
      'quota-exceeded',
      'The RT/PT attachment store has no remaining browser storage quota.',
      { cause: error },
    );
  }
  return new RtPtAssetStoreError(fallbackCode, message, { cause: error });
};

const requestResult = <T>(request: IDBRequest<T>): Promise<T> => new Promise((resolve, reject) => {
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed.'));
});

const transactionResult = (transaction: IDBTransaction): Promise<void> => new Promise((resolve, reject) => {
  transaction.oncomplete = () => resolve();
  transaction.onerror = () => reject(transaction.error ?? new Error('IndexedDB transaction failed.'));
  transaction.onabort = () => reject(transaction.error ?? new Error('IndexedDB transaction was aborted.'));
});

const abortTransaction = async (transaction: IDBTransaction, completion: Promise<void>): Promise<void> => {
  try {
    transaction.abort();
  } catch {
    // The transaction may already have become inactive after an IndexedDB failure.
  }
  await completion.catch(() => undefined);
};

const openAssetDatabase = async (): Promise<IDBDatabase> => {
  if (typeof globalThis.indexedDB === 'undefined') {
    throw new RtPtAssetStoreError(
      'unavailable',
      'IndexedDB is unavailable; RT/PT attachment bytes cannot be stored safely.',
    );
  }
  if (openDatabasePromise) return openDatabasePromise;

  openDatabasePromise = new Promise<IDBDatabase>((resolve, reject) => {
    let request: IDBOpenDBRequest;
    try {
      request = globalThis.indexedDB.open(RT_PT_ASSET_DATABASE_NAME, RT_PT_ASSET_DATABASE_VERSION);
    } catch (error) {
      reject(new RtPtAssetStoreError(
        'unavailable',
        'IndexedDB could not be opened for RT/PT attachments.',
        { cause: error },
      ));
      return;
    }

    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(RT_PT_ASSET_OBJECT_STORE)) {
        database.createObjectStore(RT_PT_ASSET_OBJECT_STORE, { keyPath: 'id' });
      }
    };
    request.onerror = () => reject(new RtPtAssetStoreError(
      'unavailable',
      'IndexedDB could not be opened for RT/PT attachments.',
      { cause: request.error },
    ));
    request.onblocked = () => reject(new RtPtAssetStoreError(
      'unavailable',
      'The RT/PT attachment database upgrade is blocked by another open window.',
    ));
    request.onsuccess = () => {
      const database = request.result;
      database.onversionchange = () => {
        database.close();
        openDatabasePromise = null;
      };
      resolve(database);
    };
  }).catch((error) => {
    openDatabasePromise = null;
    throw error;
  });

  return openDatabasePromise;
};

const metadataFromRecord = (value: unknown): RtDigitalAttachmentMetadata => {
  if (!isRecord(value)) {
    throw new RtPtAssetStoreError('corrupt-record', 'An RT/PT attachment record is not an object.');
  }
  const { id, name, mimeType, size, sha256 } = value;
  if (
    typeof id !== 'string'
    || id.length === 0
    || typeof name !== 'string'
    || name.length === 0
    || typeof mimeType !== 'string'
    || !isAllowedMimeType(mimeType)
    || typeof size !== 'number'
    || !Number.isSafeInteger(size)
    || size <= 0
    || size > RT_PT_ASSET_MAX_FILE_BYTES
    || typeof sha256 !== 'string'
    || !/^[a-f0-9]{64}$/.test(sha256)
  ) {
    throw new RtPtAssetStoreError('corrupt-record', 'An RT/PT attachment record has invalid metadata.');
  }
  return { id, name, mimeType, size, sha256 };
};

const assetFromRecord = (value: unknown): RtPtStoredAsset => {
  const metadata = metadataFromRecord(value);
  const blob = isRecord(value) ? value.blob : undefined;
  if (!(blob instanceof Blob) || blob.size !== metadata.size || blob.type !== metadata.mimeType) {
    throw new RtPtAssetStoreError('corrupt-record', 'An RT/PT attachment has missing or mismatched Blob data.');
  }
  return { metadata, blob };
};

/** True only when this runtime exposes IndexedDB. Opening it may still fail due to browser policy. */
export const isRtPtAssetStoreAvailable = (): boolean => typeof globalThis.indexedDB !== 'undefined';

/**
 * Validates the declared MIME type, matching extension, size, and file signature.
 * This is deliberately stricter than the browser file picker accept filter.
 */
export async function validateRtPtAssetFile(
  blob: Blob,
  suppliedFileName?: string,
): Promise<{ name: string; mimeType: RtDigitalAttachmentMimeType; size: number }> {
  const name = readFileName(blob, suppliedFileName);
  const mimeType = readMimeType(blob, name);
  if (blob.size <= 0) {
    throw new RtPtAssetStoreError('invalid-file', 'Empty attachments are not allowed.');
  }
  if (blob.size > RT_PT_ASSET_MAX_FILE_BYTES) {
    throw new RtPtAssetStoreError(
      'file-too-large',
      `The attachment exceeds the ${RT_PT_ASSET_MAX_FILE_BYTES} byte per-file limit.`,
    );
  }
  const signature = new Uint8Array(await blob.slice(0, 8).arrayBuffer());
  if (!hasExpectedSignature(mimeType, signature)) {
    throw new RtPtAssetStoreError(
      'unsupported-type',
      `The contents of ${name} do not match its declared ${mimeType} type.`,
    );
  }
  return { name, mimeType, size: blob.size };
}

export async function sha256RtPtAssetBlob(blob: Blob): Promise<string> {
  if (typeof globalThis.crypto?.subtle?.digest !== 'function') {
    throw new RtPtAssetStoreError(
      'unavailable',
      'Web Crypto SHA-256 is unavailable; the attachment cannot be integrity-bound.',
    );
  }
  const digest = await globalThis.crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function putRtPtAsset(
  source: Blob,
  options: RtPtAssetPutOptions = {},
): Promise<RtDigitalAttachmentMetadata> {
  const validated = await validateRtPtAssetFile(source, options.fileName);
  const metadata: RtDigitalAttachmentMetadata = {
    id: normalizeAssetId(options.id),
    name: validated.name,
    mimeType: validated.mimeType,
    size: validated.size,
    sha256: await sha256RtPtAssetBlob(source),
  };
  const database = await openAssetDatabase();
  const transaction = database.transaction(RT_PT_ASSET_OBJECT_STORE, 'readwrite');
  const completion = transactionResult(transaction);
  const store = transaction.objectStore(RT_PT_ASSET_OBJECT_STORE);

  try {
    const values = await requestResult(store.getAll());
    let existingSize = 0;
    let totalSize = 0;
    for (const value of values) {
      const existing = assetFromRecord(value).metadata;
      totalSize += existing.size;
      if (existing.id === metadata.id) existingSize = existing.size;
    }
    const nextTotal = totalSize - existingSize + metadata.size;
    if (nextTotal > RT_PT_ASSET_MAX_TOTAL_BYTES) {
      throw new RtPtAssetStoreError(
        'total-too-large',
        `RT/PT attachments would exceed the ${RT_PT_ASSET_MAX_TOTAL_BYTES} byte total limit.`,
      );
    }

    const blob = source.slice(0, source.size, metadata.mimeType);
    await requestResult(store.put({ ...metadata, blob } satisfies RtPtAssetDatabaseRecord));
    await completion;
    return { ...metadata };
  } catch (error) {
    await abortTransaction(transaction, completion);
    throw mapStorageFailure(error, 'write-failed', 'The RT/PT attachment could not be stored.');
  }
}

export async function getRtPtAsset(id: string): Promise<RtPtStoredAsset | null> {
  const database = await openAssetDatabase();
  const transaction = database.transaction(RT_PT_ASSET_OBJECT_STORE, 'readonly');
  const completion = transactionResult(transaction);
  try {
    const value = await requestResult(transaction.objectStore(RT_PT_ASSET_OBJECT_STORE).get(id));
    await completion;
    if (value === undefined) return null;
    const asset = assetFromRecord(value);
    const actualSha256 = await sha256RtPtAssetBlob(asset.blob);
    if (actualSha256 !== asset.metadata.sha256) {
      throw new RtPtAssetStoreError(
        'corrupt-record',
        'The RT/PT attachment content no longer matches its stored SHA-256 integrity binding.',
      );
    }
    return { metadata: { ...asset.metadata }, blob: asset.blob };
  } catch (error) {
    throw mapStorageFailure(error, 'read-failed', 'The RT/PT attachment could not be read.');
  }
}

export async function listRtPtAssets(): Promise<RtDigitalAttachmentMetadata[]> {
  const database = await openAssetDatabase();
  const transaction = database.transaction(RT_PT_ASSET_OBJECT_STORE, 'readonly');
  const completion = transactionResult(transaction);
  try {
    const values = await requestResult(transaction.objectStore(RT_PT_ASSET_OBJECT_STORE).getAll());
    await completion;
    return values
      .map((value) => assetFromRecord(value).metadata)
      .sort((left, right) => left.name.localeCompare(right.name))
      .map((metadata) => ({ ...metadata }));
  } catch (error) {
    throw mapStorageFailure(error, 'read-failed', 'RT/PT attachments could not be listed.');
  }
}

export async function removeRtPtAsset(id: string): Promise<boolean> {
  const database = await openAssetDatabase();
  const transaction = database.transaction(RT_PT_ASSET_OBJECT_STORE, 'readwrite');
  const completion = transactionResult(transaction);
  const store = transaction.objectStore(RT_PT_ASSET_OBJECT_STORE);
  try {
    const existing = await requestResult(store.getKey(id));
    if (existing === undefined) {
      await completion;
      return false;
    }
    await requestResult(store.delete(id));
    await completion;
    return true;
  } catch (error) {
    throw mapStorageFailure(error, 'write-failed', 'The RT/PT attachment could not be removed.');
  }
}

export function createRtPtAssetObjectUrl(blob: Blob): string {
  if (typeof globalThis.URL?.createObjectURL !== 'function') {
    throw new RtPtAssetStoreError('unavailable', 'Object URLs are unavailable in this runtime.');
  }
  return globalThis.URL.createObjectURL(blob);
}

export function revokeRtPtAssetObjectUrl(url: string): void {
  if (typeof globalThis.URL?.revokeObjectURL === 'function') globalThis.URL.revokeObjectURL(url);
}

export async function getRtPtAssetObjectUrl(id: string): Promise<string | null> {
  const asset = await getRtPtAsset(id);
  return asset ? createRtPtAssetObjectUrl(asset.blob) : null;
}

/**
 * Creates a transient preview value only. Never put this base64 value into a controlled document;
 * controlled documents retain RtDigitalAttachmentMetadata while bytes remain in IndexedDB.
 */
export function createRtPtAssetDataUrl(blob: Blob): Promise<string> {
  if (typeof FileReader === 'undefined') {
    return Promise.reject(new RtPtAssetStoreError('unavailable', 'FileReader is unavailable in this runtime.'));
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') resolve(reader.result);
      else reject(new RtPtAssetStoreError('read-failed', 'The attachment data URL could not be created.'));
    };
    reader.onerror = () => reject(new RtPtAssetStoreError(
      'read-failed',
      'The attachment data URL could not be created.',
      { cause: reader.error },
    ));
    reader.onabort = () => reject(new RtPtAssetStoreError('read-failed', 'Data URL creation was aborted.'));
    reader.readAsDataURL(blob);
  });
}

export async function getRtPtAssetDataUrl(id: string): Promise<string | null> {
  const asset = await getRtPtAsset(id);
  return asset ? createRtPtAssetDataUrl(asset.blob) : null;
}

/** Close the cached connection, for application teardown or deterministic tests. */
export function closeRtPtAssetStore(): void {
  void openDatabasePromise?.then((database) => database.close()).catch(() => undefined);
  openDatabasePromise = null;
}
