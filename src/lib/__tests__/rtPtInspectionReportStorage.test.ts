import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createRtPtInspectionReport,
  decodeRtPtInspectionReport,
  inspectionReportActiveStorageKey,
  inspectionReportRecordStorageKey,
  inspectionReportStorageKey,
  listRtPtInspectionReports,
  loadRtPtInspectionReportById,
  removeRtPtInspectionReportDraft,
  saveRtPtInspectionReportDraft,
} from '@/lib/rtPtInspectionReport';
import {
  createCompleteFilmDocument,
  createCompletePtDocument,
} from '@/lib/__tests__/rtPtV3Fixtures';
import { fingerprintRtPtInspectionReportContent } from '@/lib/rtPtInspectionReportFingerprint';

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();

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

describe('RT/PT inspection-report history storage', () => {
  let storage: MemoryStorage;

  beforeEach(() => {
    storage = new MemoryStorage();
    vi.stubGlobal('window', { localStorage: storage });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('stores multiple report IDs per technique and maintains an explicit active pointer', () => {
    const technique = createCompleteFilmDocument('approved');
    const first = createRtPtInspectionReport(technique);
    first.reportControl.number = 'IR-001';
    saveRtPtInspectionReportDraft(first);

    const second = createRtPtInspectionReport(technique);
    second.reportControl.number = 'IR-002';
    saveRtPtInspectionReportDraft(second);

    const collection = listRtPtInspectionReports(technique.documentId);
    expect(collection.reports.map((report) => report.reportId)).toEqual(expect.arrayContaining([
      first.reportId,
      second.reportId,
    ]));
    expect(collection.reports).toHaveLength(2);
    expect(collection.activeReportId).toBe(second.reportId);
    expect(storage.getItem(inspectionReportActiveStorageKey(technique.documentId))).toBe(second.reportId);
    expect(loadRtPtInspectionReportById(technique.documentId, first.reportId).report?.reportControl.number).toBe('IR-001');
  });

  it('preserves finalized reports and permits only the controlled Approved-to-Superseded transition in place', () => {
    const technique = createCompleteFilmDocument('approved');
    const pendingApproved = {
      ...createRtPtInspectionReport(technique),
      status: 'approved' as const,
      approvalFingerprint: '',
    };
    const approved = {
      ...pendingApproved,
      approvalFingerprint: fingerprintRtPtInspectionReportContent(pendingApproved),
    };
    saveRtPtInspectionReportDraft(approved);
    const key = inspectionReportRecordStorageKey(technique.documentId, approved.reportId);
    const approvedRaw = storage.getItem(key);

    expect(() => saveRtPtInspectionReportDraft({
      ...approved,
      status: 'draft',
      approvalFingerprint: '',
      remarks: 'Attempted overwrite',
    })).toThrow(/cannot be overwritten/i);
    expect(storage.getItem(key)).toBe(approvedRaw);

    saveRtPtInspectionReportDraft({ ...approved, status: 'superseded' });
    expect(loadRtPtInspectionReportById(technique.documentId, approved.reportId).report?.status).toBe('superseded');
    expect(() => removeRtPtInspectionReportDraft(technique.documentId, approved.reportId)).toThrow(/cannot be deleted/i);
    expect(storage.getItem(key)).not.toBeNull();
  });

  it('does not overwrite corrupt report JSON and surfaces a recoverable load issue', () => {
    const technique = createCompleteFilmDocument('approved');
    const replacement = createRtPtInspectionReport(technique);
    replacement.reportId = 'corrupt-report';
    const key = inspectionReportRecordStorageKey(technique.documentId, replacement.reportId);
    storage.setItem(key, '{not-json');
    storage.setItem(inspectionReportActiveStorageKey(technique.documentId), replacement.reportId);

    const collection = listRtPtInspectionReports(technique.documentId);
    expect(collection.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'invalid-json', storageKey: key, recoverable: true }),
      expect.objectContaining({ code: 'active-report-unavailable', reportId: replacement.reportId }),
    ]));
    expect(storage.getItem(key)).toBe('{not-json');

    expect(() => saveRtPtInspectionReportDraft(replacement)).toThrow(/invalid JSON/i);
    expect(storage.getItem(key)).toBe('{not-json');
  });

  it('preserves and reports a newer-schema entry instead of downgrading it', () => {
    const technique = createCompleteFilmDocument('approved');
    const report = createRtPtInspectionReport(technique);
    const key = inspectionReportRecordStorageKey(technique.documentId, report.reportId);
    const futureRaw = JSON.stringify({ ...report, schemaVersion: 99 });
    storage.setItem(key, futureRaw);

    const collection = listRtPtInspectionReports(technique.documentId);
    expect(collection.reports).toHaveLength(0);
    expect(collection.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'unsupported-schema', storageKey: key, recoverable: true }),
    ]));
    expect(storage.getItem(key)).toBe(futureRaw);
    expect(() => saveRtPtInspectionReportDraft(report)).toThrow(/unsupported schema version 99/i);
    expect(storage.getItem(key)).toBe(futureRaw);
  });

  it('migrates the former single-report key only after a safe decode', () => {
    const technique = createCompleteFilmDocument('approved');
    const report = createRtPtInspectionReport(technique);
    const legacyKey = inspectionReportStorageKey(technique.documentId);
    const raw = JSON.stringify(report);
    storage.setItem(legacyKey, raw);

    const collection = listRtPtInspectionReports(technique.documentId);
    expect(collection.activeReportId).toBe(report.reportId);
    expect(collection.reports).toHaveLength(1);
    expect(storage.getItem(inspectionReportRecordStorageKey(technique.documentId, report.reportId))).toBe(raw);
    expect(storage.getItem(legacyKey)).toBeNull();
  });

  it('leaves an unsafe legacy entry untouched and reports why it was not migrated', () => {
    const technique = createCompleteFilmDocument('approved');
    const legacyKey = inspectionReportStorageKey(technique.documentId);
    const futureRaw = JSON.stringify({
      documentKind: 'rtpt-inspection-report',
      schemaVersion: 2,
      documentType: 'inspection-report',
    });
    storage.setItem(legacyKey, futureRaw);

    const collection = listRtPtInspectionReports(technique.documentId);
    expect(collection.reports).toHaveLength(0);
    expect(collection.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'unsupported-schema', storageKey: legacyKey, recoverable: true }),
    ]));
    expect(storage.getItem(legacyKey)).toBe(futureRaw);
  });

  it('upgrades only editable legacy reports with a safe empty reference snapshot and normalized active branches', () => {
    const technique = createCompleteFilmDocument('approved');
    const report = createRtPtInspectionReport(technique);
    if (report.method !== 'RT-Film') throw new Error('Expected Film report');
    const legacy = structuredClone(report) as unknown as Record<string, unknown>;
    const source = legacy.sourceTechnique as Record<string, unknown>;
    delete source.controlledReferences;
    const results = legacy.results as Array<Record<string, unknown>>;
    results.forEach((result) => {
      delete result.iqiRequirementMet;
      result.actualSourceActivity = 99;
      result.actualSourceActivityUnit = 'Ci';
    });
    const legacyKey = inspectionReportStorageKey(technique.documentId);
    storage.setItem(legacyKey, JSON.stringify(legacy));

    const collection = listRtPtInspectionReports(technique.documentId);
    const migrated = collection.activeReport;
    expect(migrated?.sourceTechnique.controlledReferences).toEqual([]);
    expect(migrated?.method).toBe('RT-Film');
    if (!migrated || migrated.method !== 'RT-Film') throw new Error('Expected migrated Film report');
    expect(migrated.results.every((result) => (
      result.iqiRequirementMet === ''
      && result.actualSourceActivity === ''
      && result.actualSourceActivityUnit === ''
    ))).toBe(true);
    expect(storage.getItem(legacyKey)).toBeNull();
    const normalizedRaw = storage.getItem(inspectionReportRecordStorageKey(technique.documentId, report.reportId));
    expect(normalizedRaw).not.toBeNull();
    expect(JSON.parse(normalizedRaw || '{}')).toMatchObject({
      sourceTechnique: { controlledReferences: [] },
    });
  });

  it('normalizes inactive PT branches only while the report remains editable', () => {
    const typeOneTechnique = createCompletePtDocument('A', 'Type I', 'approved');
    const typeOne = createRtPtInspectionReport(typeOneTechnique);
    if (typeOne.method !== 'PT') throw new Error('Expected PT report');
    Object.assign(typeOne.results, {
      removerLot: 'INACTIVE-REMOVER',
      emulsifierLot: 'INACTIVE-EMULSIFIER',
      actualEmulsifierContactTime: 5,
      actualEmulsifierContactTimeUnit: 'min',
      actualMethodDPreRinseDetails: 'INACTIVE-PRE-RINSE',
      measuredWhiteLight: 1_000,
    });
    Object.assign(typeOne.results.planned, {
      emulsifierContactTime: 5,
      emulsifierContactTimeUnit: 'min',
      methodDPreRinseInstructions: 'INACTIVE-PRE-RINSE',
      whiteLightMin: 1_000,
    });
    const normalizedTypeOne = decodeRtPtInspectionReport(typeOne);
    expect(normalizedTypeOne.status).toBe('success');
    if (normalizedTypeOne.status !== 'success' || normalizedTypeOne.report.method !== 'PT') return;
    expect(normalizedTypeOne.report.results).toMatchObject({
      removerLot: '',
      emulsifierLot: '',
      actualEmulsifierContactTime: '',
      actualEmulsifierContactTimeUnit: '',
      actualMethodDPreRinseDetails: '',
      measuredWhiteLight: '',
      planned: {
        emulsifierContactTime: '',
        emulsifierContactTimeUnit: '',
        methodDPreRinseInstructions: '',
        whiteLightMin: '',
      },
    });

    const typeTwoTechnique = createCompletePtDocument('C', 'Type II', 'approved');
    const typeTwo = createRtPtInspectionReport(typeTwoTechnique);
    if (typeTwo.method !== 'PT') throw new Error('Expected PT report');
    Object.assign(typeTwo.results, {
      emulsifierLot: 'INACTIVE-EMULSIFIER',
      measuredUvA: 1_200,
      measuredAmbientVisibleLight: 10,
      uvAUnit: 'uW/cm2',
      actualDarkAdaptationTime: 5,
      actualDarkAdaptationTimeUnit: 'min',
    });
    Object.assign(typeTwo.results.planned, {
      darkAdaptationTime: 5,
      darkAdaptationTimeUnit: 'min',
    });
    const normalizedTypeTwo = decodeRtPtInspectionReport(typeTwo);
    expect(normalizedTypeTwo.status).toBe('success');
    if (normalizedTypeTwo.status !== 'success' || normalizedTypeTwo.report.method !== 'PT') return;
    expect(normalizedTypeTwo.report.results).toMatchObject({
      emulsifierLot: '',
      measuredUvA: '',
      measuredAmbientVisibleLight: '',
      uvAUnit: '',
      actualDarkAdaptationTime: '',
      actualDarkAdaptationTimeUnit: '',
      planned: {
        darkAdaptationTime: '',
        darkAdaptationTimeUnit: '',
      },
    });
  });

  it('upgrades missing PT V1 process fields only on editable reports and leaves achieved values empty', () => {
    const technique = createCompletePtDocument('D', 'Type I', 'approved');
    const report = createRtPtInspectionReport(technique);
    if (report.method !== 'PT') throw new Error('Expected PT report');
    const legacy = structuredClone(report) as unknown as Record<string, unknown>;
    const results = legacy.results as Record<string, unknown>;
    const planned = results.planned as Record<string, unknown>;
    [
      'cleaningMethod',
      'dryingMethod',
      'penetrantApplicationMethod',
      'emulsifierContactTime',
      'developerApplicationMethod',
      'darkAdaptationTime',
    ].forEach((field) => delete planned[field]);
    [
      'actualCleaningMethod',
      'actualDryingTime',
      'actualPenetrantApplicationMethod',
      'actualEmulsifierContactTime',
      'actualDeveloperApplicationMethod',
      'actualDarkAdaptationTime',
    ].forEach((field) => delete results[field]);

    const decoded = decodeRtPtInspectionReport(legacy);
    expect(decoded.status).toBe('success');
    if (decoded.status !== 'success' || decoded.report.method !== 'PT') return;
    expect(decoded.report.results).toMatchObject({
      actualCleaningMethod: '',
      actualDryingTime: '',
      actualPenetrantApplicationMethod: '',
      actualEmulsifierContactTime: '',
      actualDeveloperApplicationMethod: '',
      actualDarkAdaptationTime: '',
      planned: {
        cleaningMethod: '',
        dryingMethod: '',
        penetrantApplicationMethod: '',
        emulsifierContactTime: '',
        developerApplicationMethod: '',
        darkAdaptationTime: '',
      },
    });
  });

  it.each(['approved', 'superseded'] as const)(
    'preserves a finalized %s PT report that is missing a new achieved process field',
    (status) => {
      const technique = createCompletePtDocument('D', 'Type I', 'approved');
      const report = createRtPtInspectionReport(technique);
      if (report.method !== 'PT') throw new Error('Expected PT report');
      const stored = structuredClone(report) as unknown as Record<string, unknown>;
      stored.status = status;
      delete (stored.results as Record<string, unknown>).actualCleaningMethod;
      const key = inspectionReportRecordStorageKey(technique.documentId, report.reportId);
      const raw = JSON.stringify(stored);
      storage.setItem(key, raw);

      const collection = listRtPtInspectionReports(technique.documentId);
      expect(collection.reports).toHaveLength(0);
      expect(collection.issues).toEqual(expect.arrayContaining([
        expect.objectContaining({ code: 'invalid-report', storageKey: key, recoverable: true }),
      ]));
      expect(storage.getItem(key)).toBe(raw);
    },
  );

  it.each(['approved', 'superseded'] as const)(
    'preserves a finalized %s raw entry when its frozen reference snapshot is missing',
    (status) => {
      const technique = createCompleteFilmDocument('approved');
      const report = createRtPtInspectionReport(technique);
      const stored = structuredClone(report) as unknown as Record<string, unknown>;
      stored.status = status;
      delete (stored.sourceTechnique as Record<string, unknown>).controlledReferences;
      const key = inspectionReportRecordStorageKey(technique.documentId, report.reportId);
      const raw = JSON.stringify(stored);
      storage.setItem(key, raw);

      const collection = listRtPtInspectionReports(technique.documentId);
      expect(collection.reports).toHaveLength(0);
      expect(collection.issues).toEqual(expect.arrayContaining([
        expect.objectContaining({ code: 'invalid-report', storageKey: key, recoverable: true }),
      ]));
      expect(storage.getItem(key)).toBe(raw);
    },
  );

  it('rejects and preserves finalized reports containing inactive performed branches', () => {
    const technique = createCompleteFilmDocument('approved');
    const report = createRtPtInspectionReport(technique);
    if (report.method !== 'RT-Film') throw new Error('Expected Film report');
    report.status = 'approved';
    report.results[0].actualSourceActivity = 99;
    report.results[0].actualSourceActivityUnit = 'Ci';
    const key = inspectionReportRecordStorageKey(technique.documentId, report.reportId);
    const raw = JSON.stringify(report);
    storage.setItem(key, raw);

    const collection = listRtPtInspectionReports(technique.documentId);
    expect(collection.reports).toHaveLength(0);
    expect(collection.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'invalid-report', storageKey: key, recoverable: true }),
    ]));
    expect(storage.getItem(key)).toBe(raw);
  });

  it.each([
    ['approved', 'missing', ''],
    ['approved', 'malformed', 'not-a-binding'],
    ['approved', 'mismatched', `sha256:${'0'.repeat(64)}`],
    ['superseded', 'missing', ''],
    ['superseded', 'malformed', 'not-a-binding'],
    ['superseded', 'mismatched', `sha256:${'0'.repeat(64)}`],
  ] as const)(
    'rejects and preserves a finalized %s report with a %s approval binding',
    (status, _bindingCase, approvalFingerprint) => {
      const technique = createCompleteFilmDocument('approved');
      const report = {
        ...createRtPtInspectionReport(technique),
        status,
        approvalFingerprint,
      };
      expect(decodeRtPtInspectionReport(report)).toMatchObject({
        status: 'invalid',
        message: expect.stringMatching(/approval fingerprint/i),
      });

      const key = inspectionReportRecordStorageKey(technique.documentId, report.reportId);
      const raw = JSON.stringify(report);
      storage.setItem(key, raw);
      const collection = listRtPtInspectionReports(technique.documentId);

      expect(collection.reports).toHaveLength(0);
      expect(collection.issues).toEqual(expect.arrayContaining([
        expect.objectContaining({ code: 'invalid-report', storageKey: key, recoverable: true }),
      ]));
      expect(storage.getItem(key)).toBe(raw);
    },
  );
});
