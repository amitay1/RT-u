import { createHash, webcrypto } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type {
  RtDigitalIqiRuleCatalogSnapshot,
  RtDigitalSourceCatalogSnapshot,
} from '@/types/rtDigital';
import {
  RT_PT_ASSET_MAX_FILE_BYTES,
  RtPtAssetStoreError,
  closeRtPtAssetStore,
  putRtPtAsset,
  sha256RtPtAssetBlob,
  validateRtPtAssetFile,
} from '@/lib/rtPtAssetStore';
import {
  RT_DIGITAL_CATALOG_STORAGE_KEY,
  commitRtDigitalCatalogUpdate,
  copyRtDigitalCatalogSnapshot,
  createEmptyRtDigitalCatalog,
  loadRtDigitalCatalog,
  saveRtDigitalCatalog,
  toRtDigitalCatalogOptions,
  upsertRtDigitalIqiRuleCatalogRecord,
  upsertRtDigitalSourceCatalogRecord,
} from '@/hooks/useRtDigitalCatalog';

class MemoryStorage implements Storage {
  readonly values = new Map<string, string>();

  get length(): number {
    return this.values.size;
  }

  clear(): void {
    this.values.clear();
  }

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  key(index: number): string | null {
    return [...this.values.keys()][index] ?? null;
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

const catalogStatus = {
  reference: 'CAL-001',
  status: 'Current',
  date: '2026-01-01',
  dueDate: '2027-01-01',
};

const sourceSnapshot = (): RtDigitalSourceCatalogSnapshot => ({
  manufacturer: 'Example X-ray',
  model: 'XR-200',
  serialNumber: 'SN-100',
  kvMinimum: 20,
  kvMaximum: 200,
  currentMinimum: 0.1,
  currentMaximum: 10,
  maximumPowerKw: 2,
  focalSpots: [{ id: 'spot-1', label: 'Small', size: 0.4, unit: 'mm' }],
  filters: [{ id: 'filter-1', label: 'Copper', description: '1 mm Cu' }],
  calibration: { ...catalogStatus },
  qualification: { ...catalogStatus, reference: 'QUAL-001' },
});

const iqiSnapshot = (): RtDigitalIqiRuleCatalogSnapshot => ({
  standard: 'ASTM example input',
  standardRevision: '2026',
  materialGroup: 'Steel',
  iqiType: 'Wire',
  wallTechnique: 'Single Wall',
  imageTechnique: 'SWSI',
  thicknessUnit: 'mm',
  placementRule: 'Source side',
  rules: [],
});

describe('RT/PT IndexedDB attachment boundary', () => {
  afterEach(() => {
    closeRtPtAssetStore();
    vi.unstubAllGlobals();
  });

  it('accepts only matching PDF/JPG/PNG signatures and extensions', async () => {
    const pdf = new Blob(['%PDF-1.7\nfixture'], { type: 'application/pdf' });
    await expect(validateRtPtAssetFile(pdf, 'drawing.PDF')).resolves.toEqual({
      name: 'drawing.PDF',
      mimeType: 'application/pdf',
      size: pdf.size,
    });

    await expect(validateRtPtAssetFile(pdf, 'drawing.png')).rejects.toMatchObject({
      code: 'unsupported-type',
    });
    await expect(validateRtPtAssetFile(
      new Blob(['not a pdf'], { type: 'application/pdf' }),
      'drawing.pdf',
    )).rejects.toMatchObject({ code: 'unsupported-type' });
  });

  it('enforces the exported per-file limit before storage', async () => {
    const oversized = new Blob(
      [new Uint8Array(RT_PT_ASSET_MAX_FILE_BYTES + 1)],
      { type: 'image/png' },
    );
    await expect(validateRtPtAssetFile(oversized, 'large.png')).rejects.toMatchObject({
      code: 'file-too-large',
    });
  });

  it('computes a real SHA-256 digest and fails safely when IndexedDB is absent', async () => {
    vi.stubGlobal('crypto', webcrypto);
    vi.stubGlobal('indexedDB', undefined);
    const pdf = new Blob(['%PDF-1.7\nfixture'], { type: 'application/pdf' });
    const expected = createHash('sha256').update(Buffer.from(await pdf.arrayBuffer())).digest('hex');
    await expect(sha256RtPtAssetBlob(pdf)).resolves.toBe(expected);
    await expect(putRtPtAsset(pdf, { fileName: 'drawing.pdf' })).rejects.toMatchObject({
      code: 'unavailable',
    } satisfies Partial<RtPtAssetStoreError>);
  });
});

describe('RT Digital local catalog', () => {
  it('appends immutable revisions and returns detached document snapshots', () => {
    const original = sourceSnapshot();
    const first = upsertRtDigitalSourceCatalogRecord([], {
      name: 'Bay 1 source',
      snapshot: original,
    });
    original.manufacturer = 'Mutation after save';
    expect(first.record.revisions[0].snapshot.manufacturer).toBe('Example X-ray');

    const replacement = sourceSnapshot();
    replacement.model = 'XR-201';
    const second = upsertRtDigitalSourceCatalogRecord(first.records, {
      recordId: first.record.id,
      name: 'Bay 1 source',
      snapshot: replacement,
    });
    expect(second.record.id).toBe(first.record.id);
    expect(second.record.revisions).toHaveLength(2);
    expect(second.record.revisions.map((revision) => revision.revision)).toEqual([1, 2]);
    expect(second.record.revisions[0].snapshot.model).toBe('XR-200');
    expect(second.record.revisions[1].snapshot.model).toBe('XR-201');

    const options = toRtDigitalCatalogOptions(second.records);
    expect(options.map((option) => option.revision)).toEqual([2, 1]);
    expect(options[0]).toMatchObject({
      value: second.record.revisions[1].id,
      recordId: first.record.id,
      isLatest: true,
    });

    const copied = copyRtDigitalCatalogSnapshot(second.records, first.record.id);
    expect(copied?.catalogRevision).toBe(2);
    if (!copied) throw new Error('Expected a copied source snapshot.');
    copied.snapshot.model = 'Document-only selection';
    expect(second.record.revisions[1].snapshot.model).toBe('XR-201');
  });

  it('round-trips only the versioned RT/PT key', () => {
    const storage = new MemoryStorage();
    const source = upsertRtDigitalSourceCatalogRecord([], {
      name: 'Bay 1 source',
      snapshot: sourceSnapshot(),
    });
    saveRtDigitalCatalog({
      ...createEmptyRtDigitalCatalog(),
      sources: source.records,
    }, storage);

    expect(storage.length).toBe(1);
    expect(storage.getItem(RT_DIGITAL_CATALOG_STORAGE_KEY)).not.toBeNull();
    const loaded = loadRtDigitalCatalog(storage);
    expect(loaded.error).toBeNull();
    expect(loaded.catalog.sources[0].revisions[0].snapshot.model).toBe('XR-200');
    expect(Object.isFrozen(loaded.catalog.sources[0].revisions[0].snapshot)).toBe(true);
  });

  it('merges writes from independently mounted catalog instances against the latest payload', () => {
    const storage = new MemoryStorage();
    const staleSourceView = createEmptyRtDigitalCatalog();
    const staleIqiView = createEmptyRtDigitalCatalog();

    commitRtDigitalCatalogUpdate((latest) => {
      const source = upsertRtDigitalSourceCatalogRecord(staleSourceView.sources, {
        name: 'Bay 1 source',
        snapshot: sourceSnapshot(),
      });
      return { catalog: { ...latest, sources: source.records }, result: source.record.id };
    }, storage, staleSourceView);

    commitRtDigitalCatalogUpdate((latest) => {
      const iqi = upsertRtDigitalIqiRuleCatalogRecord(staleIqiView.iqiRules, {
        name: 'Steel wire rules',
        snapshot: iqiSnapshot(),
      });
      return { catalog: { ...latest, iqiRules: iqi.records }, result: iqi.record.id };
    }, storage, staleIqiView);

    const loaded = loadRtDigitalCatalog(storage);
    expect(loaded.error).toBeNull();
    expect(loaded.catalog.sources).toHaveLength(1);
    expect(loaded.catalog.iqiRules).toHaveLength(1);
  });

  it('preserves malformed and newer payloads instead of overwriting them', () => {
    const storage = new MemoryStorage();
    storage.setItem(RT_DIGITAL_CATALOG_STORAGE_KEY, '{not-json');
    expect(loadRtDigitalCatalog(storage).error).toMatchObject({ code: 'invalid-json' });
    expect(storage.getItem(RT_DIGITAL_CATALOG_STORAGE_KEY)).toBe('{not-json');

    const future = JSON.stringify({ version: 99, sources: [], detectors: [], iqiRules: [] });
    storage.setItem(RT_DIGITAL_CATALOG_STORAGE_KEY, future);
    expect(loadRtDigitalCatalog(storage).error).toMatchObject({ code: 'unsupported-version' });
    expect(storage.getItem(RT_DIGITAL_CATALOG_STORAGE_KEY)).toBe(future);
  });

  it('surfaces quota failures without replacing prior data', () => {
    const storage = new MemoryStorage();
    storage.setItem(RT_DIGITAL_CATALOG_STORAGE_KEY, 'existing');
    storage.setItem = () => {
      const error = new Error('full');
      error.name = 'QuotaExceededError';
      throw error;
    };

    expect(() => saveRtDigitalCatalog(createEmptyRtDigitalCatalog(), storage)).toThrow(
      expect.objectContaining({ code: 'quota-exceeded' }),
    );
    expect(storage.getItem(RT_DIGITAL_CATALOG_STORAGE_KEY)).toBe('existing');
  });
});
