import { describe, expect, it } from 'vitest';
import { reconcileRtPtApprovedContent } from '@/lib/rtPtApprovalLifecycle';
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

  it('keeps legacy V3 Digital drafts readable but blocks controlled approval without structured planning', () => {
    const document = createCompleteDigitalDocument();
    delete document.technique.planning;

    const result = validateRtPtDocument(document);

    expect(result.draftCompleteness.isComplete).toBe(false);
    expect(result.approvalReadiness.isReady).toBe(false);
    expect(result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ label: 'Structured Digital Planning' }),
    ]));
  });

  it('allows a blank acquisition IQI override when structured IQI is complete and still requires sensitivity', () => {
    const document = createCompleteDigitalDocument('approved');
    expect(document.technique.acquisitions.every((acquisition) => acquisition.iqiOverride === '')).toBe(true);
    expect(validateRtPtDocument(document).approvalReadiness.isReady).toBe(true);

    document.technique.iqi.requiredSensitivity = '';
    const result = validateRtPtDocument(document);
    expect(result.draftCompleteness.isComplete).toBe(false);
    expect(result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: 'technique.iqi.requiredSensitivity' }),
    ]));
  });

  it('rejects conditional part, catalog, source-envelope, and calculated-grid inconsistencies', () => {
    const document = createCompleteDigitalDocument();
    const planning = document.technique.planning;
    if (!planning || planning.part.thickness.mode !== 'Multiple Thickness Zones') throw new Error('Expected complete Digital fixture planning.');
    planning.part.thickness.zones.pop();
    planning.part.inspectionAreas.areas[0].position.width = 1;
    planning.sourceSelection.snapshot!.kvMinimum = 220;
    planning.sourceSelection.snapshot!.calibration.dueDate = '2026-07-19';
    document.technique.acquisitions[0].tubeVoltage = 250;
    document.technique.acquisitions[0].plan!.gridPlacement.centerX = 999;

    const labels = validateRtPtDocument(document).issues.map((issue) => issue.label);
    expect(labels).toEqual(expect.arrayContaining([
      'Multiple Thickness Zones',
      'Inspection Area 1 Position',
      'Source kV Range',
      'Source Calibration Currency',
      'Acquisition 1 Source kV Range',
      'Acquisition 1 Grid Placement',
      'IQI Output 2 Thickness Zone',
    ]));
  });

  it('aggregates every Multiple Areas grid while retaining one global EXP sequence', () => {
    const document = createCompleteDigitalDocument('approved');
    const planning = document.technique.planning!;
    planning.part.inspectionAreas.mode = 'Multiple Areas';
    planning.part.inspectionAreas.areas.push({
      ...planning.part.inspectionAreas.areas[0],
      id: 'inspection-area-2',
      areaId: 'AREA-02',
      description: 'Second controlled inspection footprint',
      position: { x: 0.05, y: 0.1, width: 0.9, height: 0.8, rotationDegrees: 0 },
    });
    const secondAreaAcquisitions = document.technique.acquisitions.map((source, index) => {
      const clone = JSON.parse(JSON.stringify(source)) as typeof source;
      const sequence = index + 3;
      clone.id = `dda-acquisition-${sequence}`;
      clone.viewId = `EXP-${String(sequence).padStart(3, '0')}`;
      clone.plan!.id = `acquisition-plan-${sequence}`;
      clone.plan!.gridPlacement.id = `grid-placement-${sequence}`;
      clone.plan!.visual.id = `exposure-visual-${sequence}`;
      clone.plan!.visual.inspectionAreaId = 'inspection-area-2';
      clone.plan!.iqiAssignment.id = `iqi-assignment-${sequence}`;
      clone.plan!.representativeImage = null;
      clone.plan!.interpretationAreas[0].id = `interpretation-area-${sequence}`;
      clone.plan!.interpretationAreas[0].areaId = `IA-${String(sequence).padStart(2, '0')}`;
      clone.plan!.interpretationAreas[0].inspectionAreaId = 'inspection-area-2';
      return clone;
    });
    document.technique.acquisitions.push(...secondAreaAcquisitions);

    expect(validateRtPtDocument(document).approvalReadiness.isReady).toBe(true);

    document.technique.acquisitions.pop();
    expect(validateRtPtDocument(document).draftCompleteness.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ label: 'Calculated Exposure Grid' }),
    ]));
  });

  it('recomputes effective pixel and FOV for every committed acquisition geometry', () => {
    const document = createCompleteDigitalDocument();
    document.technique.acquisitions[0].sod = 110;
    document.technique.acquisitions[0].sdd = 120;

    const result = validateRtPtDocument(document);
    expect(result.draftCompleteness.issues.map((issue) => issue.label)).toEqual(expect.arrayContaining([
      'Acquisition 1 Acquisition-specific Footprint',
    ]));
  });

  it('fails closed on IQI synchronization, interpretation links, and missing Digital approval roles', () => {
    const document = createCompleteDigitalDocument('approved');
    document.technique.acquisitions[0].plan!.iqiAssignment.requiredWire = 'W99';
    document.technique.acquisitions[0].plan!.interpretationAreas[0].viewingPresetId = 'VP-MISSING';
    document.technique.acquisitions[1].plan!.interpretationAreas[0].acceptanceProfileId = 'AC-MISSING';
    document.approvals = document.approvals.filter((approval) => (
      approval.role !== 'prepared' && approval.role !== 'quality' && approval.role !== 'customer'
    ));

    const result = validateRtPtDocument(document);
    expect(result.draftCompleteness.issues.map((issue) => issue.label)).toEqual(expect.arrayContaining([
      'Acquisition 1 Structured IQI',
      'Interpretation Area IA-01 Viewing Preset',
      'Interpretation Area IA-02 Acceptance Profile',
    ]));
    expect(result.approvalReadiness.issues.map((issue) => issue.label)).toEqual(expect.arrayContaining([
      'Prepared Approval',
      'Quality Approval',
      'Customer Approval',
    ]));
  });

  it('recomputes IQI outputs from the immutable thickness rule even when the persisted assignment is changed with it', () => {
    const document = createCompleteDigitalDocument();
    const planning = document.technique.planning!;
    planning.iqiRules.zoneOutputs[0].designation = 'WIRE-99';
    planning.iqiRules.zoneOutputs[0].requiredWire = 'W99';
    document.technique.acquisitions[0].plan!.iqiAssignment.designation = 'WIRE-99';
    document.technique.acquisitions[0].plan!.iqiAssignment.requiredWire = 'W99';

    const result = validateRtPtDocument(document);
    expect(result.draftCompleteness.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ label: 'IQI Output 1 Rule Synchronization' }),
    ]));
  });

  it.each([
    'not qualified',
    'not-qualified',
    'valid: no',
    'qualified=false',
    'valid cancelled',
    'qualified lapsed',
    'active decommissioned',
  ])('rejects explicitly negative catalog status wording: %s', (status) => {
    const document = createCompleteDigitalDocument();
    const planning = document.technique.planning!;
    planning.sourceSelection.snapshot!.qualification.status = status;

    const result = validateRtPtDocument(document);
    expect(result.draftCompleteness.issues.map((issue) => issue.label)).toEqual(expect.arrayContaining([
      'Source Qualification Status',
    ]));
  });

  it('does not force optional representative evidence or inapplicable viewing/profile values', () => {
    const document = createCompleteDigitalDocument('approved');
    const planning = document.technique.planning!;
    document.technique.acquisitions[0].plan!.representativeImage = null;
    planning.viewingPresets[0].permittedProcessing = '';
    planning.viewingPresets[0].lut = '';
    planning.acceptanceProfiles[0].grade = '';
    planning.acceptanceProfiles[0].level = '';
    document.technique.acquisitions[0].plan!.interpretationAreas[0].permittedProcessing = '';
    document.technique.acquisitions[0].plan!.interpretationAreas[0].lut = '';

    expect(validateRtPtDocument(document).approvalReadiness.isReady).toBe(true);
  });

  it('applies a linked Level III IQI override to exactly one assignment field', () => {
    const document = createCompleteDigitalDocument('approved');
    const planning = document.technique.planning!;
    planning.overrides.push({
      id: 'override-iqi-wire-1',
      fieldPath: 'iqiRules.zoneOutputs.iqi-output-1.requiredWire',
      calculatedValue: 'W12',
      approvedValue: 'W11',
      reason: 'Controlled customer-specific IQI substitution',
      approvedBy: 'Level Three / L3-001',
      approvedAt: '2026-07-20',
    });
    planning.iqiRules.zoneOutputs[0].overrideId = 'override-iqi-wire-1';
    document.technique.acquisitions[0].plan!.iqiAssignment.requiredWire = 'W11';

    expect(validateRtPtDocument(document).approvalReadiness.isReady).toBe(true);

    planning.overrides[0].calculatedValue = 'W09';
    const invalid = validateRtPtDocument(document);
    expect(invalid.draftCompleteness.issues.map((issue) => issue.label)).toEqual(expect.arrayContaining([
      'IQI Output 1 Override',
      'Acquisition 1 Structured IQI',
    ]));
  });

  it('invalidates an existing approval after a structured Digital planning edit', () => {
    const document = createCompleteDigitalDocument('approved');
    document.technique.planning!.processingPolicy.prohibitedProcessing = 'Changed after approval';

    const reconciliation = reconcileRtPtApprovedContent(document);
    expect(reconciliation.invalidated).toBe(true);
    expect(reconciliation.document.status).toBe('draft');
    expect(reconciliation.document.approvals).toEqual([]);
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
