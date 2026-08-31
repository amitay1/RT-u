import { describe, expect, it } from 'vitest';
import {
  createEmptyRtMaterialCatalog,
  lookupRtMaterialHalfValueLayer,
  parseRtMaterialCatalogPayload,
  removeRtMaterialInState,
  removeRtMaterialRecord,
  upsertRtMaterialInState,
  upsertRtMaterialRecord,
} from '@/lib/rtMaterialCatalogStore';

const input = {
  name: 'Aluminum 6061',
  specification: 'AMS-QQ-A-250/11',
  materialGroup: '02',
  densityGCm3: 2.7 as const,
  notes: 'From the qualified site exposure chart',
  attenuationPoints: [
    { kv: 160, halfValueLayerMm: 14 },
    { kv: 100, halfValueLayerMm: 12 },
    { kv: 160, halfValueLayerMm: 15 },
  ],
};

describe('site materials catalog store', () => {
  it('creates records with revision 1, sorted deduplicated attenuation points', () => {
    const { payload, record } = upsertRtMaterialRecord(createEmptyRtMaterialCatalog(), input, '2026-08-28T00:00:00.000Z');
    expect(record.revision).toBe(1);
    // Duplicate 160 kV entries collapse to the last one and points sort by voltage.
    expect(record.attenuationPoints).toEqual([
      { kv: 100, halfValueLayerMm: 12 },
      { kv: 160, halfValueLayerMm: 15 },
    ]);
    expect(payload.materials).toHaveLength(1);
    expect(payload.revisions).toHaveLength(0);
  });

  it('bumps the revision on edit and preserves the prior state append-only', () => {
    const first = upsertRtMaterialRecord(createEmptyRtMaterialCatalog(), input, '2026-08-28T00:00:00.000Z');
    const second = upsertRtMaterialRecord(
      first.payload,
      { ...input, id: first.record.id, densityGCm3: 2.71 },
      '2026-08-29T00:00:00.000Z',
    );
    expect(second.record.id).toBe(first.record.id);
    expect(second.record.revision).toBe(2);
    expect(second.payload.materials).toHaveLength(1);
    expect(second.payload.revisions).toHaveLength(1);
    expect(second.payload.revisions[0].revision).toBe(1);
    expect(second.payload.revisions[0].densityGCm3).toBe(2.7);
  });

  it('retains removed records in the append-only history', () => {
    const { payload, record } = upsertRtMaterialRecord(createEmptyRtMaterialCatalog(), input, '2026-08-28T00:00:00.000Z');
    const afterRemove = removeRtMaterialRecord(payload, record.id);
    expect(afterRemove.materials).toHaveLength(0);
    expect(afterRemove.revisions).toHaveLength(1);
    expect(afterRemove.revisions[0].id).toBe(record.id);
  });

  it('round-trips through the strict payload parser and rejects corruption', () => {
    const { payload } = upsertRtMaterialRecord(createEmptyRtMaterialCatalog(), input, '2026-08-28T00:00:00.000Z');
    const parsed = parseRtMaterialCatalogPayload(JSON.parse(JSON.stringify(payload)));
    expect(parsed.materials[0].name).toBe('Aluminum 6061');

    expect(() => parseRtMaterialCatalogPayload({ version: 2, materials: [], revisions: [] })).toThrow(/version/);
    const corrupted = JSON.parse(JSON.stringify(payload));
    corrupted.materials[0].attenuationPoints[0].kv = -5;
    expect(() => parseRtMaterialCatalogPayload(corrupted)).toThrow(/kv/);
    const duplicated = JSON.parse(JSON.stringify(payload));
    duplicated.materials.push(duplicated.materials[0]);
    expect(() => parseRtMaterialCatalogPayload(duplicated)).toThrow(/duplicate/);
  });

  it('looks up half-value layers only at exactly entered voltages', () => {
    const { record } = upsertRtMaterialRecord(createEmptyRtMaterialCatalog(), input, '2026-08-28T00:00:00.000Z');
    expect(lookupRtMaterialHalfValueLayer(record, 100)).toEqual({ kv: 100, halfValueLayerMm: 12 });
    expect(lookupRtMaterialHalfValueLayer(record, 120)).toBeNull();
    expect(lookupRtMaterialHalfValueLayer(record, '')).toBeNull();
  });

  it('refuses records without a name', () => {
    expect(() => upsertRtMaterialRecord(createEmptyRtMaterialCatalog(), { ...input, name: '  ' }, '2026-08-28T00:00:00.000Z')).toThrow(/name/);
  });

  it('keeps refusing writes over an unreadable store even after the error message is dismissed', () => {
    // The transient error is null (user pressed Dismiss) but the unreadable flag persists.
    const unreadable = { payload: createEmptyRtMaterialCatalog(), error: null, storeUnreadable: true };

    const attempt = upsertRtMaterialInState(unreadable, input, '2026-08-28T00:00:00.000Z');
    expect(attempt.record).toBeNull();
    expect(attempt.state.storeUnreadable).toBe(true);
    expect(attempt.state.payload.materials).toHaveLength(0);
    expect(attempt.state.error).toMatch(/unreadable/);

    const removal = removeRtMaterialInState(unreadable, 'material-anything');
    expect(removal.storeUnreadable).toBe(true);
    expect(removal.error).toMatch(/unreadable/);

    // A readable store accepts the same write.
    const readable = { payload: createEmptyRtMaterialCatalog(), error: null, storeUnreadable: false };
    expect(upsertRtMaterialInState(readable, input, '2026-08-28T00:00:00.000Z').record).not.toBeNull();
  });
});
