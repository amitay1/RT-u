import { useCallback, useMemo, useRef, useState } from 'react';
import type {
  RtDigitalCatalogRecord,
  RtDigitalCatalogRevision,
  RtDigitalDetectorCatalogSnapshot,
  RtDigitalIqiRuleCatalogSnapshot,
  RtDigitalSourceCatalogSnapshot,
} from '@/types/rtDigital';

export const RT_DIGITAL_CATALOG_STORAGE_KEY = 'rtpt_inspector_rt_digital_catalog';
export const RT_DIGITAL_CATALOG_VERSION = 1 as const;

export type RtDigitalSourceCatalogRecord = RtDigitalCatalogRecord<RtDigitalSourceCatalogSnapshot>;
export type RtDigitalDetectorCatalogRecord = RtDigitalCatalogRecord<RtDigitalDetectorCatalogSnapshot>;
export type RtDigitalIqiRuleCatalogRecord = RtDigitalCatalogRecord<RtDigitalIqiRuleCatalogSnapshot>;

export interface RtDigitalCatalogPayload {
  readonly version: typeof RT_DIGITAL_CATALOG_VERSION;
  readonly sources: ReadonlyArray<RtDigitalSourceCatalogRecord>;
  readonly detectors: ReadonlyArray<RtDigitalDetectorCatalogRecord>;
  readonly iqiRules: ReadonlyArray<RtDigitalIqiRuleCatalogRecord>;
}

export type RtDigitalCatalogStorageErrorCode =
  | 'storage-unavailable'
  | 'read-failed'
  | 'invalid-json'
  | 'unsupported-version'
  | 'invalid-payload'
  | 'quota-exceeded'
  | 'write-failed';

export class RtDigitalCatalogStorageError extends Error {
  readonly code: RtDigitalCatalogStorageErrorCode;
  readonly cause?: unknown;

  constructor(code: RtDigitalCatalogStorageErrorCode, message: string, options?: { cause?: unknown }) {
    super(message);
    this.name = 'RtDigitalCatalogStorageError';
    this.code = code;
    this.cause = options?.cause;
  }
}

export interface RtDigitalCatalogLoadResult {
  catalog: RtDigitalCatalogPayload;
  error: RtDigitalCatalogStorageError | null;
}

export interface RtDigitalCatalogAddInput<TSnapshot> {
  name: string;
  snapshot: TSnapshot;
}

export interface RtDigitalCatalogUpsertInput<TSnapshot> extends RtDigitalCatalogAddInput<TSnapshot> {
  /** Omit to create a record. A matching ID appends an immutable revision. */
  recordId?: string;
}

export interface RtDigitalCatalogSelectOption<TSnapshot> {
  /** Revision ID, suitable for a select-control value. */
  value: string;
  label: string;
  recordId: string;
  revisionId: string;
  revision: number;
  /** The immutable revision timestamp (`createdAt` in the document-domain type). */
  updatedAt: string;
  isLatest: boolean;
  snapshot: Readonly<TSnapshot>;
}

export interface RtDigitalCatalogSnapshotCopy<TSnapshot> {
  catalogRecordId: string;
  catalogRevisionId: string;
  catalogRevision: number;
  updatedAt: string;
  /** Detached mutable copy intended to be placed in a controlled document selection. */
  snapshot: TSnapshot;
}

type SnapshotValidator<TSnapshot> = (value: unknown) => value is TSnapshot;

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
);

const isString = (value: unknown): value is string => typeof value === 'string';
const hasControlCharacter = (value: string): boolean => Array.from(value).some((character) => {
  const codePoint = character.codePointAt(0) ?? 0;
  return codePoint <= 0x1f || codePoint === 0x7f;
});
const isNumberOrEmpty = (value: unknown): value is number | '' => (
  value === '' || (typeof value === 'number' && Number.isFinite(value))
);
const hasStringFields = (value: Record<string, unknown>, fields: readonly string[]): boolean => (
  fields.every((field) => isString(value[field]))
);
const hasNumberOrEmptyFields = (value: Record<string, unknown>, fields: readonly string[]): boolean => (
  fields.every((field) => isNumberOrEmpty(value[field]))
);

const isCatalogStatus = (value: unknown): boolean => (
  isRecord(value) && hasStringFields(value, ['reference', 'status', 'date', 'dueDate'])
);

const isSourceSnapshot: SnapshotValidator<RtDigitalSourceCatalogSnapshot> = (value): value is RtDigitalSourceCatalogSnapshot => {
  if (!isRecord(value)) return false;
  if (!hasStringFields(value, ['manufacturer', 'model', 'serialNumber'])) return false;
  if (!hasNumberOrEmptyFields(value, [
    'kvMinimum',
    'kvMaximum',
    'currentMinimum',
    'currentMaximum',
    'maximumPowerKw',
  ])) return false;
  if (!Array.isArray(value.focalSpots) || !value.focalSpots.every((option) => (
    isRecord(option)
    && hasStringFields(option, ['id', 'label', 'unit'])
    && isNumberOrEmpty(option.size)
  ))) return false;
  if (!Array.isArray(value.filters) || !value.filters.every((option) => (
    isRecord(option) && hasStringFields(option, ['id', 'label', 'description'])
  ))) return false;
  return isCatalogStatus(value.calibration) && isCatalogStatus(value.qualification);
};

const isDetectorSnapshot: SnapshotValidator<RtDigitalDetectorCatalogSnapshot> = (value): value is RtDigitalDetectorCatalogSnapshot => {
  if (!isRecord(value)) return false;
  if (!hasStringFields(value, [
    'manufacturer',
    'model',
    'serialNumber',
    'activeAreaUnit',
    'pixelSizeUnit',
    'detectorSrbUnit',
  ])) return false;
  if (!hasNumberOrEmptyFields(value, [
    'activeWidth',
    'activeHeight',
    'matrixColumns',
    'matrixRows',
    'pixelSize',
    'bitDepth',
    'detectorSrb',
  ])) return false;
  if (!Array.isArray(value.modes) || !value.modes.every(isString)) return false;
  return isCatalogStatus(value.calibration)
    && isCatalogStatus(value.badPixelMap)
    && isCatalogStatus(value.qualification);
};

const isIqiRuleSnapshot: SnapshotValidator<RtDigitalIqiRuleCatalogSnapshot> = (value): value is RtDigitalIqiRuleCatalogSnapshot => {
  if (!isRecord(value)) return false;
  if (!hasStringFields(value, [
    'standard',
    'standardRevision',
    'materialGroup',
    'iqiType',
    'wallTechnique',
    'imageTechnique',
    'thicknessUnit',
    'placementRule',
  ])) return false;
  return Array.isArray(value.rules) && value.rules.every((rule) => (
    isRecord(rule)
    && hasStringFields(rule, [
      'id',
      'iqiMaterial',
      'designation',
      'requiredWire',
      'requiredHole',
      'requiredSensitivity',
      'placement',
      'shimRequirement',
    ])
    && hasNumberOrEmptyFields(rule, ['minimumThickness', 'maximumThickness'])
  ));
};

const isIsoTimestamp = (value: unknown): value is string => (
  typeof value === 'string'
  && value.length > 0
  && Number.isFinite(Date.parse(value))
);

const isCatalogRecord = <TSnapshot>(
  value: unknown,
  validateSnapshot: SnapshotValidator<TSnapshot>,
): value is RtDigitalCatalogRecord<TSnapshot> => {
  if (
    !isRecord(value)
    || typeof value.id !== 'string'
    || value.id.length === 0
    || typeof value.name !== 'string'
    || value.name.trim().length === 0
    || !Array.isArray(value.revisions)
    || value.revisions.length === 0
  ) return false;

  const revisionIds = new Set<string>();
  const revisionNumbers = new Set<number>();
  let previousRevision = 0;
  for (const revision of value.revisions) {
    if (
      !isRecord(revision)
      || typeof revision.id !== 'string'
      || revision.id.length === 0
      || !Number.isSafeInteger(revision.revision)
      || (revision.revision as number) <= previousRevision
      || !isIsoTimestamp(revision.createdAt)
      || !validateSnapshot(revision.snapshot)
      || revisionIds.has(revision.id)
      || revisionNumbers.has(revision.revision as number)
    ) return false;
    previousRevision = revision.revision as number;
    revisionIds.add(revision.id);
    revisionNumbers.add(revision.revision as number);
  }
  return true;
};

const hasUniqueRecordIds = <T extends { id: string }>(values: readonly T[]): boolean => (
  new Set(values.map((value) => value.id)).size === values.length
);

const isCatalogPayload = (value: unknown): value is RtDigitalCatalogPayload => {
  if (
    !isRecord(value)
    || value.version !== RT_DIGITAL_CATALOG_VERSION
    || !Array.isArray(value.sources)
    || !Array.isArray(value.detectors)
    || !Array.isArray(value.iqiRules)
  ) return false;
  if (!value.sources.every((record) => isCatalogRecord(record, isSourceSnapshot))) return false;
  if (!value.detectors.every((record) => isCatalogRecord(record, isDetectorSnapshot))) return false;
  if (!value.iqiRules.every((record) => isCatalogRecord(record, isIqiRuleSnapshot))) return false;
  return hasUniqueRecordIds(value.sources)
    && hasUniqueRecordIds(value.detectors)
    && hasUniqueRecordIds(value.iqiRules);
};

const deepFreeze = <T>(value: T): T => {
  if (typeof value !== 'object' || value === null || Object.isFrozen(value)) return value;
  Object.freeze(value);
  Object.values(value as Record<string, unknown>).forEach((entry) => deepFreeze(entry));
  return value;
};

const cloneJsonValue = <T>(value: T): T => {
  try {
    const serialized = JSON.stringify(value);
    if (serialized === undefined) throw new Error('Value is not JSON serializable.');
    return JSON.parse(serialized) as T;
  } catch (error) {
    throw new RtDigitalCatalogStorageError(
      'invalid-payload',
      'Catalog snapshots must contain JSON-safe values only.',
      { cause: error },
    );
  }
};

const freezeCatalog = (catalog: RtDigitalCatalogPayload): RtDigitalCatalogPayload => (
  deepFreeze(cloneJsonValue(catalog))
);

export const createEmptyRtDigitalCatalog = (): RtDigitalCatalogPayload => deepFreeze({
  version: RT_DIGITAL_CATALOG_VERSION,
  sources: [],
  detectors: [],
  iqiRules: [],
});

const resolveStorage = (provided?: Storage | null): Storage | null => {
  if (provided !== undefined) return provided;
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
};

const toStorageError = (
  error: unknown,
  fallbackCode: 'read-failed' | 'write-failed',
  fallbackMessage: string,
): RtDigitalCatalogStorageError => {
  if (error instanceof RtDigitalCatalogStorageError) return error;
  const errorName = isRecord(error) && typeof error.name === 'string' ? error.name : '';
  if (errorName === 'QuotaExceededError' || errorName === 'NS_ERROR_DOM_QUOTA_REACHED') {
    return new RtDigitalCatalogStorageError(
      'quota-exceeded',
      'The RT Digital catalog could not be saved because local storage quota was exceeded.',
      { cause: error },
    );
  }
  return new RtDigitalCatalogStorageError(fallbackCode, fallbackMessage, { cause: error });
};

/**
 * Loads only the RT/PT-specific, versioned catalog. Corrupt or newer payloads are left untouched
 * and returned as a recoverable error rather than being silently overwritten.
 */
export function loadRtDigitalCatalog(storage?: Storage | null): RtDigitalCatalogLoadResult {
  const resolved = resolveStorage(storage);
  if (!resolved) {
    return {
      catalog: createEmptyRtDigitalCatalog(),
      error: new RtDigitalCatalogStorageError(
        'storage-unavailable',
        'localStorage is unavailable; the RT Digital catalog cannot be persisted.',
      ),
    };
  }

  let raw: string | null;
  try {
    raw = resolved.getItem(RT_DIGITAL_CATALOG_STORAGE_KEY);
  } catch (error) {
    return {
      catalog: createEmptyRtDigitalCatalog(),
      error: toStorageError(error, 'read-failed', 'The RT Digital catalog could not be read.'),
    };
  }
  if (raw === null) return { catalog: createEmptyRtDigitalCatalog(), error: null };

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    return {
      catalog: createEmptyRtDigitalCatalog(),
      error: new RtDigitalCatalogStorageError(
        'invalid-json',
        'The stored RT Digital catalog is not valid JSON and was left unchanged.',
        { cause: error },
      ),
    };
  }

  if (isRecord(parsed) && typeof parsed.version === 'number' && parsed.version !== RT_DIGITAL_CATALOG_VERSION) {
    return {
      catalog: createEmptyRtDigitalCatalog(),
      error: new RtDigitalCatalogStorageError(
        'unsupported-version',
        `RT Digital catalog version ${parsed.version} is not supported and was left unchanged.`,
      ),
    };
  }
  if (!isCatalogPayload(parsed)) {
    return {
      catalog: createEmptyRtDigitalCatalog(),
      error: new RtDigitalCatalogStorageError(
        'invalid-payload',
        'The stored RT Digital catalog failed validation and was left unchanged.',
      ),
    };
  }
  return { catalog: freezeCatalog(parsed), error: null };
}

export function saveRtDigitalCatalog(
  catalog: RtDigitalCatalogPayload,
  storage?: Storage | null,
): void {
  const resolved = resolveStorage(storage);
  if (!resolved) {
    throw new RtDigitalCatalogStorageError(
      'storage-unavailable',
      'localStorage is unavailable; the RT Digital catalog cannot be persisted.',
    );
  }
  const cloned = cloneJsonValue(catalog);
  if (!isCatalogPayload(cloned)) {
    throw new RtDigitalCatalogStorageError('invalid-payload', 'The RT Digital catalog failed validation.');
  }
  try {
    resolved.setItem(RT_DIGITAL_CATALOG_STORAGE_KEY, JSON.stringify(cloned));
  } catch (error) {
    throw toStorageError(error, 'write-failed', 'The RT Digital catalog could not be saved.');
  }
}

const createCatalogId = (prefix: string): string => {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return `${prefix}-${globalThis.crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
};

const normalizeRecordId = (recordId: string | undefined, prefix: string): string => {
  const id = recordId?.trim() || createCatalogId(prefix);
  if (id.length > 160 || hasControlCharacter(id)) {
    throw new RtDigitalCatalogStorageError('invalid-payload', 'The catalog record ID is invalid.');
  }
  return id;
};

const normalizeName = (name: string): string => {
  const normalized = name.trim();
  if (normalized.length === 0 || normalized.length > 160 || hasControlCharacter(normalized)) {
    throw new RtDigitalCatalogStorageError('invalid-payload', 'A catalog record requires a valid name.');
  }
  return normalized;
};

const createRevision = <TSnapshot>(
  recordId: string,
  revision: number,
  snapshot: TSnapshot,
  validateSnapshot: SnapshotValidator<TSnapshot>,
): RtDigitalCatalogRevision<TSnapshot> => {
  const detached = cloneJsonValue(snapshot);
  if (!validateSnapshot(detached)) {
    throw new RtDigitalCatalogStorageError('invalid-payload', 'The catalog snapshot failed validation.');
  }
  return deepFreeze({
    id: createCatalogId(`${recordId}-revision`),
    revision,
    createdAt: new Date().toISOString(),
    snapshot: detached,
  });
};

const upsertCatalogRecord = <TSnapshot>(
  records: ReadonlyArray<RtDigitalCatalogRecord<TSnapshot>>,
  input: RtDigitalCatalogUpsertInput<TSnapshot>,
  prefix: string,
  validateSnapshot: SnapshotValidator<TSnapshot>,
): { records: ReadonlyArray<RtDigitalCatalogRecord<TSnapshot>>; record: RtDigitalCatalogRecord<TSnapshot> } => {
  const name = normalizeName(input.name);
  const requestedId = input.recordId?.trim();
  const existingIndex = requestedId ? records.findIndex((record) => record.id === requestedId) : -1;
  const recordId = existingIndex >= 0
    ? records[existingIndex].id
    : normalizeRecordId(requestedId, prefix);
  const previous = existingIndex >= 0 ? records[existingIndex] : null;
  const revisionNumber = previous
    ? Math.max(...previous.revisions.map((revision) => revision.revision)) + 1
    : 1;
  const revision = createRevision(recordId, revisionNumber, input.snapshot, validateSnapshot);
  const record = deepFreeze<RtDigitalCatalogRecord<TSnapshot>>({
    id: recordId,
    name,
    revisions: previous ? [...previous.revisions, revision] : [revision],
  });
  const next = existingIndex >= 0
    ? records.map((existing, index) => (index === existingIndex ? record : existing))
    : [...records, record];
  return { records: deepFreeze(next), record };
};

const removeCatalogRecord = <TSnapshot>(
  records: ReadonlyArray<RtDigitalCatalogRecord<TSnapshot>>,
  recordId: string,
): { records: ReadonlyArray<RtDigitalCatalogRecord<TSnapshot>>; removed: boolean } => {
  const next = records.filter((record) => record.id !== recordId);
  return { records: deepFreeze(next), removed: next.length !== records.length };
};

export function upsertRtDigitalSourceCatalogRecord(
  records: ReadonlyArray<RtDigitalSourceCatalogRecord>,
  input: RtDigitalCatalogUpsertInput<RtDigitalSourceCatalogSnapshot>,
) {
  return upsertCatalogRecord(records, input, 'rtpt-digital-source', isSourceSnapshot);
}

export function upsertRtDigitalDetectorCatalogRecord(
  records: ReadonlyArray<RtDigitalDetectorCatalogRecord>,
  input: RtDigitalCatalogUpsertInput<RtDigitalDetectorCatalogSnapshot>,
) {
  return upsertCatalogRecord(records, input, 'rtpt-digital-detector', isDetectorSnapshot);
}

export function upsertRtDigitalIqiRuleCatalogRecord(
  records: ReadonlyArray<RtDigitalIqiRuleCatalogRecord>,
  input: RtDigitalCatalogUpsertInput<RtDigitalIqiRuleCatalogSnapshot>,
) {
  return upsertCatalogRecord(records, input, 'rtpt-digital-iqi-rule', isIqiRuleSnapshot);
}

export function removeRtDigitalCatalogRecord<TSnapshot>(
  records: ReadonlyArray<RtDigitalCatalogRecord<TSnapshot>>,
  recordId: string,
) {
  return removeCatalogRecord(records, recordId);
}

export function toRtDigitalCatalogOptions<TSnapshot>(
  records: ReadonlyArray<RtDigitalCatalogRecord<TSnapshot>>,
): RtDigitalCatalogSelectOption<TSnapshot>[] {
  return [...records]
    .sort((left, right) => left.name.localeCompare(right.name))
    .flatMap((record) => {
      const latestRevision = Math.max(...record.revisions.map((revision) => revision.revision));
      return [...record.revisions]
        .sort((left, right) => right.revision - left.revision)
        .map((revision) => deepFreeze({
          value: revision.id,
          label: `${record.name} — Rev ${revision.revision}`,
          recordId: record.id,
          revisionId: revision.id,
          revision: revision.revision,
          updatedAt: revision.createdAt,
          isLatest: revision.revision === latestRevision,
          snapshot: revision.snapshot,
        }));
    });
}

/** Returns a detached snapshot; later catalog edits or deletion cannot mutate the returned value. */
export function copyRtDigitalCatalogSnapshot<TSnapshot>(
  records: ReadonlyArray<RtDigitalCatalogRecord<TSnapshot>>,
  recordId: string,
  revisionId?: string,
): RtDigitalCatalogSnapshotCopy<TSnapshot> | null {
  const record = records.find((candidate) => candidate.id === recordId);
  if (!record || record.revisions.length === 0) return null;
  const revision = revisionId
    ? record.revisions.find((candidate) => candidate.id === revisionId)
    : record.revisions.reduce((latest, candidate) => (
      candidate.revision > latest.revision ? candidate : latest
    ));
  if (!revision) return null;
  return {
    catalogRecordId: record.id,
    catalogRevisionId: revision.id,
    catalogRevision: revision.revision,
    updatedAt: revision.createdAt,
    snapshot: cloneJsonValue(revision.snapshot as TSnapshot),
  };
}

export type RtDigitalCatalogMutation<TResult> = (catalog: RtDigitalCatalogPayload) => {
  catalog: RtDigitalCatalogPayload;
  result: TResult;
};

const blocksCatalogWrite = (error: RtDigitalCatalogStorageError | null): boolean => (
  error !== null
  && ['read-failed', 'invalid-json', 'unsupported-version', 'invalid-payload'].includes(error.code)
);

/**
 * Applies a synchronous catalog change to the latest validated stored payload. This prevents
 * independently mounted source, detector, and IQI hook instances from overwriting one another.
 */
export function commitRtDigitalCatalogUpdate<TResult>(
  mutation: RtDigitalCatalogMutation<TResult>,
  storage?: Storage | null,
  unavailableFallback: RtDigitalCatalogPayload = createEmptyRtDigitalCatalog(),
): { catalog: RtDigitalCatalogPayload; result: TResult } {
  const latest = loadRtDigitalCatalog(storage);
  if (blocksCatalogWrite(latest.error)) throw latest.error;
  const base = latest.error?.code === 'storage-unavailable' ? unavailableFallback : latest.catalog;
  const mutationResult = mutation(base);
  const catalog = freezeCatalog(mutationResult.catalog);
  saveRtDigitalCatalog(catalog, storage);
  return { catalog, result: mutationResult.result };
}

/**
 * RT/PT-only user catalog. Each upsert appends a revision; it never edits an existing snapshot.
 * Write failures leave the in-memory state unchanged and are both exposed and thrown to the caller.
 */
export function useRtDigitalCatalog(storage?: Storage | null) {
  const initialRef = useRef<RtDigitalCatalogLoadResult | null>(null);
  if (initialRef.current === null) initialRef.current = loadRtDigitalCatalog(storage);
  const storageRef = useRef<Storage | null | undefined>(storage);
  const catalogRef = useRef<RtDigitalCatalogPayload>(initialRef.current.catalog);
  const storageErrorRef = useRef<RtDigitalCatalogStorageError | null>(initialRef.current.error);
  const [catalog, setCatalog] = useState<RtDigitalCatalogPayload>(initialRef.current.catalog);
  const [storageError, setStorageError] = useState<RtDigitalCatalogStorageError | null>(
    initialRef.current.error,
  );

  const commit = useCallback(<TResult,>(mutation: RtDigitalCatalogMutation<TResult>): TResult => {
    let committed: { catalog: RtDigitalCatalogPayload; result: TResult };
    try {
      committed = commitRtDigitalCatalogUpdate(mutation, storageRef.current, catalogRef.current);
    } catch (error) {
      const storageFailure = toStorageError(error, 'write-failed', 'The RT Digital catalog could not be saved.');
      storageErrorRef.current = storageFailure;
      setStorageError(storageFailure);
      throw storageFailure;
    }
    catalogRef.current = committed.catalog;
    storageErrorRef.current = null;
    setCatalog(committed.catalog);
    setStorageError(null);
    return committed.result;
  }, []);

  const reload = useCallback((): RtDigitalCatalogLoadResult => {
    const loaded = loadRtDigitalCatalog(storageRef.current);
    catalogRef.current = loaded.catalog;
    storageErrorRef.current = loaded.error;
    setCatalog(loaded.catalog);
    setStorageError(loaded.error);
    return loaded;
  }, []);

  const addSource = useCallback((input: RtDigitalCatalogAddInput<RtDigitalSourceCatalogSnapshot>) => (
    commit((current) => {
      const updated = upsertRtDigitalSourceCatalogRecord(current.sources, input);
      return { catalog: { ...current, sources: updated.records }, result: updated.record };
    })
  ), [commit]);

  const upsertSource = useCallback((input: RtDigitalCatalogUpsertInput<RtDigitalSourceCatalogSnapshot>) => (
    commit((current) => {
      const updated = upsertRtDigitalSourceCatalogRecord(current.sources, input);
      return { catalog: { ...current, sources: updated.records }, result: updated.record };
    })
  ), [commit]);

  const deleteSource = useCallback((recordId: string): boolean => commit((current) => {
    const updated = removeRtDigitalCatalogRecord(current.sources, recordId);
    return { catalog: { ...current, sources: updated.records }, result: updated.removed };
  }), [commit]);

  const addDetector = useCallback((input: RtDigitalCatalogAddInput<RtDigitalDetectorCatalogSnapshot>) => (
    commit((current) => {
      const updated = upsertRtDigitalDetectorCatalogRecord(current.detectors, input);
      return { catalog: { ...current, detectors: updated.records }, result: updated.record };
    })
  ), [commit]);

  const upsertDetector = useCallback((input: RtDigitalCatalogUpsertInput<RtDigitalDetectorCatalogSnapshot>) => (
    commit((current) => {
      const updated = upsertRtDigitalDetectorCatalogRecord(current.detectors, input);
      return { catalog: { ...current, detectors: updated.records }, result: updated.record };
    })
  ), [commit]);

  const deleteDetector = useCallback((recordId: string): boolean => commit((current) => {
    const updated = removeRtDigitalCatalogRecord(current.detectors, recordId);
    return { catalog: { ...current, detectors: updated.records }, result: updated.removed };
  }), [commit]);

  const addIqiRule = useCallback((input: RtDigitalCatalogAddInput<RtDigitalIqiRuleCatalogSnapshot>) => (
    commit((current) => {
      const updated = upsertRtDigitalIqiRuleCatalogRecord(current.iqiRules, input);
      return { catalog: { ...current, iqiRules: updated.records }, result: updated.record };
    })
  ), [commit]);

  const upsertIqiRule = useCallback((input: RtDigitalCatalogUpsertInput<RtDigitalIqiRuleCatalogSnapshot>) => (
    commit((current) => {
      const updated = upsertRtDigitalIqiRuleCatalogRecord(current.iqiRules, input);
      return { catalog: { ...current, iqiRules: updated.records }, result: updated.record };
    })
  ), [commit]);

  const deleteIqiRule = useCallback((recordId: string): boolean => commit((current) => {
    const updated = removeRtDigitalCatalogRecord(current.iqiRules, recordId);
    return { catalog: { ...current, iqiRules: updated.records }, result: updated.removed };
  }), [commit]);

  const sourceOptions = useMemo(() => toRtDigitalCatalogOptions(catalog.sources), [catalog.sources]);
  const detectorOptions = useMemo(() => toRtDigitalCatalogOptions(catalog.detectors), [catalog.detectors]);
  const iqiRuleOptions = useMemo(() => toRtDigitalCatalogOptions(catalog.iqiRules), [catalog.iqiRules]);

  const copySourceSnapshot = useCallback((recordId: string, revisionId?: string) => (
    copyRtDigitalCatalogSnapshot(catalogRef.current.sources, recordId, revisionId)
  ), []);
  const copyDetectorSnapshot = useCallback((recordId: string, revisionId?: string) => (
    copyRtDigitalCatalogSnapshot(catalogRef.current.detectors, recordId, revisionId)
  ), []);
  const copyIqiRuleSnapshot = useCallback((recordId: string, revisionId?: string) => (
    copyRtDigitalCatalogSnapshot(catalogRef.current.iqiRules, recordId, revisionId)
  ), []);

  return {
    catalog,
    sources: catalog.sources,
    detectors: catalog.detectors,
    iqiRules: catalog.iqiRules,
    sourceOptions,
    detectorOptions,
    iqiRuleOptions,
    storageError,
    reload,
    addSource,
    upsertSource,
    deleteSource,
    addDetector,
    upsertDetector,
    deleteDetector,
    addIqiRule,
    upsertIqiRule,
    deleteIqiRule,
    copySourceSnapshot,
    copyDetectorSnapshot,
    copyIqiRuleSnapshot,
  };
}

export type RtDigitalCatalogController = ReturnType<typeof useRtDigitalCatalog>;
