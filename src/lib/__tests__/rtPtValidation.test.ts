import { describe, expect, it } from 'vitest';
import { validateRtPtDocument } from '@/lib/rtPtValidation';
import {
  createCompleteDigitalDocument,
  createCompleteFilmDocument,
  createCompletePs811000FilmDocument,
  createCompletePtDocument,
} from './rtPtV3Fixtures';

describe('RT/PT V3 validation', () => {
  it('treats four complete unique Film views as approval-ready planned content', () => {
    const document = createCompleteFilmDocument('approved');
    const result = validateRtPtDocument(document);
    expect(document.technique.exposureViews).toHaveLength(4);
    expect(result.draftCompleteness.isComplete).toBe(true);
    expect(result.approvalReadiness.isReady).toBe(true);
  });

  it('requires at least one unique controlled Film view only at the approval boundary', () => {
    const document = createCompleteFilmDocument();
    document.technique.exposureViews = [];
    const result = validateRtPtDocument(document);
    expect(result.draftCompleteness.isComplete).toBe(true);
    expect(result.approvalReadiness.isReady).toBe(false);
    expect(result.approvalReadiness.issues.some((issue) => issue.label === 'Film Exposure Views')).toBe(true);
  });

  it('rejects duplicate stable IDs and duplicate controlled view IDs', () => {
    const document = createCompleteFilmDocument();
    document.technique.exposureViews[1].id = document.technique.exposureViews[0].id;
    document.technique.exposureViews[1].viewId = document.technique.exposureViews[0].viewId;
    const result = validateRtPtDocument(document);
    expect(result.draftCompleteness.issues.some((issue) => issue.label === 'Stable IDs')).toBe(true);
    expect(result.approvalReadiness.issues.some((issue) => issue.label === 'Film Exposure Views')).toBe(true);
  });

  it('accepts mixed-unit geometry that is mathematically consistent', () => {
    const document = createCompleteFilmDocument();
    document.technique.exposureDefaults = {
      ...document.technique.exposureDefaults,
      sfd: '',
      sod: '',
      ofd: '',
      requiredUg: '',
    };
    document.technique.exposureViews[0] = {
      ...document.technique.exposureViews[0],
      sfd: 2,
      sfdUnit: 'inch',
      sod: 25.4,
      sodUnit: 'mm',
      ofd: 1,
      ofdUnit: 'inch',
      requiredUg: 1,
      requiredUgUnit: 'mm',
    };
    const result = validateRtPtDocument(document);
    expect(result.issues.some((issue) => issue.label === 'View 1 Geometry')).toBe(false);
  });

  it('compares calculated Film Ug only with the user-supplied required Ug', () => {
    const document = createCompleteFilmDocument();
    document.technique.exposureViews[0].requiredUg = 0.05;
    const result = validateRtPtDocument(document);
    expect(result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        path: 'technique.exposureViews[0].requiredUg',
        message: expect.stringContaining('exceeds the user-specified required Ug'),
      }),
    ]));
  });

  it('uses PS811000E Table 8 without requiring a manually entered Ug', () => {
    const document = createCompletePs811000FilmDocument('approved');
    const result = validateRtPtDocument(document);
    expect(document.technique.iqi.requiredUg).toBe('');
    expect(document.technique.exposureViews.every((view) => view.requiredUg === '')).toBe(true);
    expect(result.draftCompleteness.isComplete).toBe(true);
    expect(result.approvalReadiness.isReady).toBe(true);
  });

  it('blocks a PS811000E view that exceeds Table 8 or the Figure 2 energy band', () => {
    const ugDocument = createCompletePs811000FilmDocument();
    ugDocument.technique.source.xRay.focalSpotSize = 6;
    let result = validateRtPtDocument(ugDocument);
    expect(result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        path: 'technique.exposureViews[0].requiredUg',
        message: expect.stringContaining('Table 8'),
      }),
    ]));

    const energyDocument = createCompletePs811000FilmDocument();
    energyDocument.technique.exposureViews[0].tubeVoltage = 200;
    result = validateRtPtDocument(energyDocument);
    expect(result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        path: 'technique.exposureViews[0].tubeVoltage',
        label: 'View 1 Figure 2 Energy Band',
      }),
    ]));
  });

  it('applies the superimposed-film density row and individual-film minimum', () => {
    const document = createCompletePs811000FilmDocument();
    document.technique.filmSystem.viewingMode = 'superimposed';
    document.technique.filmSystem.requiredDensityMin = 2;
    document.technique.filmSystem.individualFilmDensityMinimum = 0.9;
    let result = validateRtPtDocument(document);
    expect(result.issues.some((issue) => issue.label === 'Individual Film Density Minimum')).toBe(true);

    document.technique.filmSystem.individualFilmDensityMinimum = 1;
    result = validateRtPtDocument(document);
    expect(result.issues.some((issue) => issue.label === 'Individual Film Density Minimum')).toBe(false);
  });

  it('supports multiple static DDA acquisitions with optional frame rate', () => {
    const document = createCompleteDigitalDocument('approved');
    delete document.technique.acquisitions[0].frameRate;
    document.technique.acquisitions[1].frameRate = 2;
    const result = validateRtPtDocument(document);
    expect(document.technique.acquisitions).toHaveLength(2);
    expect(result.draftCompleteness.isComplete).toBe(true);
    expect(result.approvalReadiness.isReady).toBe(true);
  });

  it('requires explicit DDA qualification and performance baseline references for approval', () => {
    const document = createCompleteDigitalDocument();
    document.technique.system.systemQualificationReference = '';
    document.technique.system.performanceBaselineReference = '';
    const result = validateRtPtDocument(document);
    expect(result.approvalReadiness.isReady).toBe(false);
    expect(result.approvalReadiness.issues.map((issue) => issue.label)).toEqual(expect.arrayContaining([
      'System Qualification Reference',
      'Performance Baseline Reference',
    ]));
  });

  it('flags calculated DDA Ug above the controlled requirement without inventing a limit', () => {
    const document = createCompleteDigitalDocument();
    document.technique.acquisitions[0].requiredUg = 0.01;
    const result = validateRtPtDocument(document);
    expect(result.issues.some((issue) => (
      issue.path === 'technique.acquisitions[0].requiredUg'
      && issue.message.includes('user-specified required Ug')
    ))).toBe(true);
  });

  it('requires Method B post-emulsification rinse instructions but not concentration', () => {
    const valid = createCompletePtDocument('B', 'Type I', 'approved');
    expect(valid.technique.removal.methodBD.concentration).toBe('');
    expect(validateRtPtDocument(valid).approvalReadiness.isReady).toBe(true);

    valid.technique.removal.methodBD.postEmulsifierRinseInstructions = '';
    const invalid = validateRtPtDocument(valid);
    expect(invalid.issues.some((issue) => (
      issue.path === 'technique.removal.methodBD.postEmulsifierRinseInstructions'
    ))).toBe(true);
    expect(invalid.issues.some((issue) => issue.path.endsWith('.concentration'))).toBe(false);
  });

  it('requires Method D hydrophilic concentration and both pre/final rinse instructions', () => {
    const document = createCompletePtDocument('D');
    document.technique.removal.methodBD.concentration = '';
    document.technique.removal.methodD.preRinseInstructions = '';
    document.technique.removal.methodD.finalRinseInstructions = '';
    const paths = validateRtPtDocument(document).issues.map((issue) => issue.path);
    expect(paths).toEqual(expect.arrayContaining([
      'technique.removal.methodBD.concentration',
      'technique.removal.methodD.preRinseInstructions',
      'technique.removal.methodD.finalRinseInstructions',
    ]));
  });

  it('requires sensitivity and UV-A viewing only for Type I, and white light only for Type II', () => {
    const typeOne = validateRtPtDocument(createCompletePtDocument('A', 'Type I'));
    expect(typeOne.issues.some((issue) => issue.path.endsWith('whiteLightMin'))).toBe(false);

    const typeTwoDocument = createCompletePtDocument('C', 'Type II');
    const typeTwo = validateRtPtDocument(typeTwoDocument);
    expect(typeTwo.issues.some((issue) => issue.path.endsWith('sensitivityLevel'))).toBe(false);
    expect(typeTwo.issues.some((issue) => issue.path.endsWith('requiredUvAMin'))).toBe(false);

    typeTwoDocument.technique.materials.sensitivityLevel = '1';
    typeTwoDocument.technique.conditions.requiredUvAMin = 1000;
    expect(validateRtPtDocument(typeTwoDocument).issues.map((issue) => issue.label)).toEqual(expect.arrayContaining([
      'Sensitivity Level Applicability',
      'Inactive Type I Viewing Requirements',
    ]));
  });

  it('validates physical positivity and range order without supplying acceptance numbers', () => {
    const document = createCompleteFilmDocument();
    document.technique.exposureViews[0].exposureTime = 0;
    document.technique.exposureViews[0].thicknessMin = 12;
    document.technique.exposureViews[0].thicknessMax = 8;
    const result = validateRtPtDocument(document);
    expect(result.issues.map((issue) => issue.label)).toEqual(expect.arrayContaining([
      'View 1 Exposure Time',
      'View 1 Thickness Range',
    ]));
    expect(document.technique.acceptance).not.toHaveProperty('linearIndications');
    expect(document.technique.acceptance).not.toHaveProperty('roundedIndications');
  });

  it('blocks approval until migration metadata is explicitly acknowledged and cleared', () => {
    const document = createCompleteFilmDocument('approved');
    document.migration = {
      sourceSchemaVersion: 2,
      warnings: ['Review the migrated planning fields.'],
      quarantine: [
        { sourcePath: 'legacy.result', reason: 'performed-result', value: 'Reject' },
        { sourcePath: 'legacy.iqi', reason: 'manual-mapping-required', value: 'Legacy IQI' },
      ],
    };

    const result = validateRtPtDocument(document);
    expect(result.approvalReadiness.isReady).toBe(false);
    expect(result.approvalReadiness.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ label: 'Migration Acknowledgement' }),
    ]));
    expect(result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        label: 'Migration Summary',
        message: expect.stringContaining('performed-result: 1'),
      }),
      expect.objectContaining({ label: 'Migration Review', message: 'Review the migrated planning fields.' }),
    ]));

    delete document.migration;
    expect(validateRtPtDocument(document).approvalReadiness.isReady).toBe(true);
  });

  it('rejects impossible ISO dates and an effective date before the revision date', () => {
    const document = createCompleteFilmDocument('approved');
    document.documentControl.revisionDate = '2026-02-30';
    document.documentControl.effectiveDate = '2026/02/28';
    document.revisionHistory[0].date = '2026-13-01';
    document.approvals[0].date = 'not-a-date';

    let result = validateRtPtDocument(document);
    expect(result.approvalReadiness.isReady).toBe(false);
    expect(result.issues.map((issue) => issue.path)).toEqual(expect.arrayContaining([
      'documentControl.revisionDate',
      'documentControl.effectiveDate',
      'revisionHistory[0].date',
      'approvals[0].date',
    ]));

    document.documentControl.revisionDate = '2026-07-22';
    document.documentControl.effectiveDate = '2026-07-21';
    document.revisionHistory[0].date = '2026-07-22';
    document.approvals[0].date = '2026-07-22';
    result = validateRtPtDocument(document);
    expect(result.approvalReadiness.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ label: 'Revision / Effective Date Order' }),
    ]));
  });

  it('validates technique, Gamma-reference, and DDA qualification date chronology', () => {
    const film = createCompleteFilmDocument();
    film.technique.general.date = '2026-02-30';
    film.technique.source.sourceType = 'Gamma';
    film.technique.source.xRay.focalSpotSize = '';
    film.technique.source.gamma = {
      isotope: 'Ir-192',
      sourceId: 'SOURCE-01',
      activity: 10,
      activityUnit: 'Ci',
      activityReferenceDate: '20-07-2026',
      effectiveSourceSize: 2,
      effectiveSourceSizeUnit: 'mm',
    };

    expect(validateRtPtDocument(film).issues.map((issue) => issue.path)).toEqual(expect.arrayContaining([
      'technique.general.date',
      'technique.source.gamma.activityReferenceDate',
    ]));

    const digital = createCompleteDigitalDocument();
    digital.technique.detectorPerformance.calibration.date = '2026-08-02';
    digital.technique.detectorPerformance.calibration.dueDate = '2026-08-01';
    digital.technique.detectorPerformance.stability.dueDate = '2026-13-01';

    expect(validateRtPtDocument(digital).issues.map((issue) => issue.path)).toEqual(expect.arrayContaining([
      'technique.detectorPerformance.calibration.dueDate',
      'technique.detectorPerformance.stability.dueDate',
    ]));
  });

  it('rejects one-character controlled identities but permits one-character revision codes', () => {
    const document = createCompleteFilmDocument('approved');
    document.documentControl.number = 'X';
    document.controlledReferences[0].number = 'Y';
    document.approvals[0].name = 'Z';
    document.documentControl.revision = 'B';
    document.controlledReferences[0].revision = 'C';
    document.approvals[0].certificationRevision = 'D';

    const result = validateRtPtDocument(document);
    expect(result.approvalReadiness.isReady).toBe(false);
    expect(result.issues.map((issue) => issue.path)).toEqual(expect.arrayContaining([
      'documentControl.number',
      'controlledReferences[0].number',
      'approvals[0].name',
    ]));
    expect(result.issues).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ path: 'documentControl.revision' }),
      expect.objectContaining({ path: 'controlledReferences[0].revision' }),
      expect.objectContaining({ path: 'approvals[0].certificationRevision' }),
    ]));
  });

  it('rejects duplicate revision-history stable IDs and revision labels', () => {
    const document = createCompleteFilmDocument('approved');
    document.revisionHistory.push({
      ...document.revisionHistory[0],
      description: 'Duplicate revision entry',
    });

    const result = validateRtPtDocument(document);
    expect(result.approvalReadiness.isReady).toBe(false);
    expect(result.draftCompleteness.issues.map((issue) => issue.label)).toEqual(expect.arrayContaining([
      'Revision History IDs',
      'Revision History Revisions',
    ]));
  });
});
