import type { NumberOrEmpty } from '@/types/rtFilm';

/**
 * User-authored, revisioned site materials catalog.
 *
 * The product deliberately ships NO material physics of its own: density and
 * half-value-layer data are entered by the site from its controlled sources
 * (exposure charts, supplier data, qualified measurements). Records follow
 * the same discipline as the RT-Digital equipment catalogs: every change
 * bumps the record revision and preserves the prior state in an append-only
 * history, and lookups return null instead of interpolating between the
 * discrete voltage points the site chose to enter.
 */

export const RT_MATERIAL_CATALOG_STORAGE_KEY = 'rtpt_inspector_material_catalog';
export const RT_MATERIAL_CATALOG_VERSION = 1 as const;

export interface RtMaterialAttenuationPoint {
  /** Tube voltage the half-value layer applies to, in kV. */
  kv: number;
  halfValueLayerMm: number;
}

export interface RtMaterialRecord {
  id: string;
  revision: number;
  savedAt: string;
  name: string;
  specification: string;
  materialGroup: string;
  densityGCm3: NumberOrEmpty;
  notes: string;
  attenuationPoints: RtMaterialAttenuationPoint[];
}

export interface RtMaterialCatalogPayload {
  version: typeof RT_MATERIAL_CATALOG_VERSION;
  materials: RtMaterialRecord[];
  /** Append-only prior revisions of edited or removed records. */
  revisions: RtMaterialRecord[];
}

export interface RtMaterialRecordInput {
  id?: string;
  name: string;
  specification: string;
  materialGroup: string;
  densityGCm3: NumberOrEmpty;
  notes: string;
  attenuationPoints: RtMaterialAttenuationPoint[];
}

const isRecordObject = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
);

const parseAttenuationPoint = (value: unknown, path: string): RtMaterialAttenuationPoint => {
  if (!isRecordObject(value)) throw new Error(`${path} must be an object.`);
  const { kv, halfValueLayerMm } = value;
  if (typeof kv !== 'number' || !Number.isFinite(kv) || kv <= 0) {
    throw new Error(`${path}.kv must be a positive number.`);
  }
  if (typeof halfValueLayerMm !== 'number' || !Number.isFinite(halfValueLayerMm) || halfValueLayerMm <= 0) {
    throw new Error(`${path}.halfValueLayerMm must be a positive number.`);
  }
  return { kv, halfValueLayerMm };
};

const parseMaterialRecord = (value: unknown, path: string): RtMaterialRecord => {
  if (!isRecordObject(value)) throw new Error(`${path} must be an object.`);
  const { id, revision, savedAt, name, specification, materialGroup, densityGCm3, notes, attenuationPoints } = value;
  if (typeof id !== 'string' || !id.trim()) throw new Error(`${path}.id must be a non-empty string.`);
  if (typeof revision !== 'number' || !Number.isSafeInteger(revision) || revision <= 0) {
    throw new Error(`${path}.revision must be a positive integer.`);
  }
  if (typeof savedAt !== 'string') throw new Error(`${path}.savedAt must be a string.`);
  if (typeof name !== 'string') throw new Error(`${path}.name must be a string.`);
  if (typeof specification !== 'string') throw new Error(`${path}.specification must be a string.`);
  if (typeof materialGroup !== 'string') throw new Error(`${path}.materialGroup must be a string.`);
  if (densityGCm3 !== '' && (typeof densityGCm3 !== 'number' || !Number.isFinite(densityGCm3) || densityGCm3 <= 0)) {
    throw new Error(`${path}.densityGCm3 must be a positive number or ''.`);
  }
  if (typeof notes !== 'string') throw new Error(`${path}.notes must be a string.`);
  if (!Array.isArray(attenuationPoints)) throw new Error(`${path}.attenuationPoints must be an array.`);
  return {
    id,
    revision,
    savedAt,
    name,
    specification,
    materialGroup,
    densityGCm3: densityGCm3 as NumberOrEmpty,
    notes,
    attenuationPoints: attenuationPoints.map((point, index) => (
      parseAttenuationPoint(point, `${path}.attenuationPoints[${index}]`)
    )),
  };
};

export function createEmptyRtMaterialCatalog(): RtMaterialCatalogPayload {
  return { version: RT_MATERIAL_CATALOG_VERSION, materials: [], revisions: [] };
}

export function parseRtMaterialCatalogPayload(value: unknown): RtMaterialCatalogPayload {
  if (!isRecordObject(value)) throw new Error('The material catalog payload must be an object.');
  if (value.version !== RT_MATERIAL_CATALOG_VERSION) {
    throw new Error('The material catalog payload has an unsupported version.');
  }
  if (!Array.isArray(value.materials) || !Array.isArray(value.revisions)) {
    throw new Error('The material catalog payload is malformed.');
  }
  const materials = value.materials.map((record, index) => parseMaterialRecord(record, `materials[${index}]`));
  const ids = materials.map((record) => record.id);
  if (new Set(ids).size !== ids.length) {
    throw new Error('The material catalog contains duplicate record ids.');
  }
  return {
    version: RT_MATERIAL_CATALOG_VERSION,
    materials,
    revisions: value.revisions.map((record, index) => parseMaterialRecord(record, `revisions[${index}]`)),
  };
}

const createMaterialId = (): string => {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return `material-${globalThis.crypto.randomUUID()}`;
  }
  return `material-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
};

const normalizedPoints = (points: RtMaterialAttenuationPoint[]): RtMaterialAttenuationPoint[] => {
  const byKv = new Map<number, RtMaterialAttenuationPoint>();
  points.forEach((point) => byKv.set(point.kv, point));
  return [...byKv.values()].sort((left, right) => left.kv - right.kv);
};

export function upsertRtMaterialRecord(
  payload: RtMaterialCatalogPayload,
  input: RtMaterialRecordInput,
  savedAt: string,
): { payload: RtMaterialCatalogPayload; record: RtMaterialRecord } {
  if (!input.name.trim()) throw new Error('A material record requires a name.');
  const existing = input.id ? payload.materials.find((record) => record.id === input.id) : undefined;
  const record: RtMaterialRecord = {
    id: existing?.id ?? createMaterialId(),
    revision: (existing?.revision ?? 0) + 1,
    savedAt,
    name: input.name.trim(),
    specification: input.specification.trim(),
    materialGroup: input.materialGroup.trim(),
    densityGCm3: input.densityGCm3,
    notes: input.notes,
    attenuationPoints: normalizedPoints(input.attenuationPoints),
  };
  return {
    payload: {
      version: RT_MATERIAL_CATALOG_VERSION,
      materials: [...payload.materials.filter((entry) => entry.id !== record.id), record]
        .sort((left, right) => left.name.localeCompare(right.name)),
      revisions: existing ? [...payload.revisions, existing] : payload.revisions,
    },
    record,
  };
}

export function removeRtMaterialRecord(
  payload: RtMaterialCatalogPayload,
  id: string,
): RtMaterialCatalogPayload {
  const existing = payload.materials.find((record) => record.id === id);
  if (!existing) return payload;
  return {
    version: RT_MATERIAL_CATALOG_VERSION,
    materials: payload.materials.filter((record) => record.id !== id),
    revisions: [...payload.revisions, existing],
  };
}

export interface RtMaterialCatalogWorkingState {
  payload: RtMaterialCatalogPayload;
  /** Transient problem surfaced to the UI; dismissible. */
  error: string | null;
  /**
   * True when the persisted payload could not be parsed. Writes stay refused
   * for the whole session — dismissing the error message never lifts this,
   * so the unreadable stored data is never silently overwritten.
   */
  storeUnreadable: boolean;
}

const UNREADABLE_WRITE_REFUSAL = 'Writes are disabled: the stored material catalog is unreadable and will not be overwritten. '
  + 'Back up or remove the stored data before adding materials.';

export function upsertRtMaterialInState(
  state: RtMaterialCatalogWorkingState,
  input: RtMaterialRecordInput,
  savedAt: string,
): { state: RtMaterialCatalogWorkingState; record: RtMaterialRecord | null } {
  if (state.storeUnreadable) {
    return { state: { ...state, error: UNREADABLE_WRITE_REFUSAL }, record: null };
  }
  try {
    const next = upsertRtMaterialRecord(state.payload, input, savedAt);
    return { state: { payload: next.payload, error: null, storeUnreadable: false }, record: next.record };
  } catch (error) {
    return {
      state: { ...state, error: error instanceof Error ? error.message : 'The material could not be saved.' },
      record: null,
    };
  }
}

export function removeRtMaterialInState(
  state: RtMaterialCatalogWorkingState,
  id: string,
): RtMaterialCatalogWorkingState {
  if (state.storeUnreadable) {
    return { ...state, error: UNREADABLE_WRITE_REFUSAL };
  }
  return { payload: removeRtMaterialRecord(state.payload, id), error: null, storeUnreadable: false };
}

/** Exact-point HVL lookup — no interpolation between the site's entered voltages. */
export function lookupRtMaterialHalfValueLayer(
  record: RtMaterialRecord,
  kv: NumberOrEmpty,
): RtMaterialAttenuationPoint | null {
  if (kv === '' || !Number.isFinite(kv)) return null;
  return record.attenuationPoints.find((point) => point.kv === kv) ?? null;
}
