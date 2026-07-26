import { describe, expect, it } from 'vitest';
import {
  createRtPtInspectionReport,
  decodeRtPtInspectionReport,
} from '@/lib/rtPtInspectionReport';
import { fingerprintRtPtApprovedContent } from '@/lib/rtPtDocumentCodec';
import {
  editRtPtInspectionReport,
  fingerprintRtPtInspectionReportContent,
  reconcileRtPtInspectionReportApproval,
  setRtPtInspectionReportStatus,
} from '@/lib/rtPtInspectionReportLifecycle';
import { validateRtPtInspectionReport } from '@/lib/rtPtInspectionReportValidation';
import {
  createCompleteDigitalDocument,
  createCompleteFilmDocument,
  createCompletePtDocument,
} from '@/lib/__tests__/rtPtV3Fixtures';
import type { RtPtInspectionReportV1 } from '@/types/rtPtInspectionReport';

const completeCommon = <T extends RtPtInspectionReportV1>(report: T): T => ({
  ...report,
  reportControl: {
    ...report.reportControl,
    number: 'IR-100',
    revision: 'A',
    reportDate: '2026-07-22',
    inspectionStart: '2026-07-21',
    inspectionEnd: '2026-07-22',
  },
  part: {
    ...report.part,
    serialOrLotNumber: 'SN-100',
    quantity: 1,
  },
  equipment: {
    ...report.equipment,
    equipmentUsed: 'Controlled equipment set EQ-1',
    calibrationReferences: 'CAL-100 Rev A, due 2027-07-01',
  },
  coverageStatement: 'All planned inspection areas were examined.',
  overallDisposition: 'accepted',
  dispositionReference: 'PRODUCT-SPEC-1 Rev B, clause 7.4',
  approvals: [
    {
      role: 'performed',
      name: 'Inspector One',
      personnelId: 'EMP-1',
      certificationLevel: 'Level II',
      certificationNumber: 'CERT-1',
      certificationBasis: 'Written practice Rev C',
      date: '2026-07-22',
    },
    {
      role: 'reviewed',
      name: 'Reviewer Two',
      personnelId: 'EMP-2',
      certificationLevel: 'Level III',
      certificationNumber: 'CERT-2',
      certificationBasis: 'Written practice Rev C',
      date: '2026-07-22',
    },
  ],
});

const completeFilmReport = () => {
  const technique = createCompleteFilmDocument('approved');
  const report = completeCommon(createRtPtInspectionReport(technique));
  if (report.method !== 'RT-Film') throw new Error('Expected Film report');
  report.results = report.results.map((result, index) => ({
    ...result,
    filmId: `FILM-${index + 1}`,
    exposureDate: '2026-07-21',
    actualSfd: 110,
    actualSod: 100,
    actualOfd: 10,
    actualTubeVoltage: 120,
    actualTubeCurrent: 5,
    actualExposureTime: 2,
    actualExposureTimeUnit: 'min',
    densityMinimum: 2,
    densityMaximum: 3.4,
    iqiObserved: 'Required hole visible',
    iqiRequirementMet: true,
    coverageConfirmed: true,
    result: 'accepted',
  }));
  return { technique, report };
};

const completeGammaFilmReport = () => {
  const technique = createCompleteFilmDocument('draft');
  technique.technique.source = {
    ...technique.technique.source,
    sourceType: 'Gamma',
    xRay: { ...technique.technique.source.xRay, focalSpotSize: '' },
    gamma: {
      isotope: 'Ir-192',
      sourceId: 'SOURCE-01',
      activity: 10,
      activityUnit: 'Ci',
      activityReferenceDate: '2026-07-01',
      effectiveSourceSize: 1,
      effectiveSourceSizeUnit: 'mm',
    },
  };
  technique.status = 'approved';
  technique.approvalFingerprint = fingerprintRtPtApprovedContent(technique);
  const report = completeCommon(createRtPtInspectionReport(technique));
  if (report.method !== 'RT-Film') throw new Error('Expected Film report');
  report.results = report.results.map((result, index) => ({
    ...result,
    filmId: `GAMMA-FILM-${index + 1}`,
    exposureDate: '2026-07-21',
    actualSfd: 110,
    actualSod: 100,
    actualOfd: 10,
    actualTubeVoltage: '',
    actualTubeVoltageUnit: '' as never,
    actualTubeCurrent: '',
    actualTubeCurrentUnit: '' as never,
    actualSourceActivity: 10,
    actualSourceActivityUnit: 'Ci',
    actualExposureTime: 2,
    actualExposureTimeUnit: 'min',
    densityMinimum: 2,
    densityMaximum: 3.4,
    iqiObserved: 'Required hole visible',
    iqiRequirementMet: true,
    coverageConfirmed: true,
    result: 'accepted',
  }));
  return { technique, report };
};

const completeDigitalReport = () => {
  const technique = createCompleteDigitalDocument('approved');
  const report = completeCommon(createRtPtInspectionReport(technique));
  if (report.method !== 'RT-Digital') throw new Error('Expected Digital report');
  report.results = report.results.map((result, index) => ({
    ...result,
    imageId: `IMAGE-${index + 1}`,
    acquisitionDate: '2026-07-21',
    actualSdd: 110,
    actualSod: 100,
    actualOdd: 10,
    actualTubeVoltage: 120,
    actualTubeCurrent: 5,
    actualExposureTime: 2,
    actualIntegrationTime: 1,
    actualFramesAveraged: 4,
    achievedSnr: 'Normalized SNR 120',
    achievedCnr: 'CNR 8.5',
    iqiObserved: 'Required duplex-wire response observed',
    iqiRequirementMet: true,
    snrRequirementMet: true,
    cnrRequirementMet: true,
    detectorControlReference: 'BPM-1 / CAL-1 / STAB-1',
    archiveReference: `DICONDE-${index + 1}`,
    coverageConfirmed: true,
    result: 'accepted',
  }));
  return { technique, report };
};

const completePtReport = (
  method: 'A' | 'B' | 'C' | 'D' = 'D',
  penetrantType: 'Type I' | 'Type II' = 'Type I',
) => {
  const technique = createCompletePtDocument(method, penetrantType, 'approved');
  const report = completeCommon(createRtPtInspectionReport(technique));
  if (report.method !== 'PT') throw new Error('Expected PT report');
  report.results = {
    ...report.results,
    penetrantLot: 'PEN-LOT-1',
    penetrantExpiry: '2027-06-01',
    cleanerLot: 'CLEAN-LOT-1',
    removerLot: method === 'C' ? 'REM-LOT-1' : '',
    emulsifierLot: method === 'B' || method === 'D' ? 'EMU-LOT-1' : '',
    developerLot: 'DEV-LOT-1',
    actualCleaningMethod: report.results.planned.cleaningMethod,
    actualCleaningDetails: 'Surface preparation performed to the approved instruction.',
    actualSurfaceCondition: report.results.planned.surfaceCondition,
    actualDryingMethod: report.results.planned.dryingMethod,
    actualDryingTime: report.results.planned.dryingTime,
    actualDryingTemperature: report.results.planned.dryingTemperature,
    actualPenetrantApplicationMethod: report.results.planned.penetrantApplicationMethod,
    partTemperature: 24,
    penetrantTemperature: 24,
    actualDwellTime: 20,
    actualDevelopmentTime: 10,
    actualMethodARinseDetails: method === 'A' ? 'Water rinse performed to the approved instruction.' : '',
    actualMethodARinsePressure: method === 'A' ? report.results.planned.methodARinsePressureMin : '',
    actualMethodARinseTemperature: method === 'A' ? report.results.planned.methodARinseTemperatureMin : '',
    actualEmulsifierConcentration: method === 'D' ? report.results.planned.emulsifierConcentration : '',
    actualEmulsifierContactTime: method === 'B' || method === 'D'
      ? report.results.planned.emulsifierContactTime
      : '',
    actualEmulsifierApplicationMethod: method === 'B' || method === 'D'
      ? report.results.planned.emulsifierApplicationMethod
      : '',
    actualPostEmulsifierRinseDetails: method === 'B' || method === 'D'
      ? 'Post-emulsifier rinse performed to the approved instruction.'
      : '',
    actualMethodCRemovalDetails: method === 'C'
      ? 'Solvent removal performed to the approved instruction.'
      : '',
    actualMethodDPreRinseDetails: method === 'D'
      ? 'Hydrophilic pre-rinse performed to the approved instruction.'
      : '',
    actualMethodDFinalRinseDetails: method === 'D'
      ? 'Hydrophilic final rinse performed to the approved instruction.'
      : '',
    actualDeveloperApplicationMethod: report.results.planned.developerApplicationMethod,
    actualDarkAdaptationTime: penetrantType === 'Type I'
      ? report.results.planned.darkAdaptationTime
      : '',
    measuredUvA: penetrantType === 'Type I' ? 1200 : '',
    measuredAmbientVisibleLight: penetrantType === 'Type I' ? 10 : '',
    measuredWhiteLight: penetrantType === 'Type II' ? 1200 : '',
    lightMeterId: 'METER-1',
    examinationTime: '14:20-14:45',
    postCleaningCompleted: true,
    coverageConfirmed: true,
  };
  return { technique, report };
};

describe('RT/PT inspection report boundary', () => {
  it.each([
    ['Film', completeFilmReport],
    ['DDA', completeDigitalReport],
    ['PT', completePtReport],
  ])('creates a separately linked and independently ready %s report', (_label, create) => {
    const { technique, report } = create();
    const validation = validateRtPtInspectionReport(report, technique);
    expect(report.documentKind).toBe('rtpt-inspection-report');
    expect(report.documentType).toBe('inspection-report');
    expect(report.sourceTechnique.documentId).toBe(technique.documentId);
    expect(validation.isComplete).toBe(true);
    expect(validation.linkCurrent).toBe(true);
    expect(validation.isApprovalReady).toBe(true);
  });

  it('copies planned Film values into a frozen basis and keeps actual values out of the technique', () => {
    const technique = createCompleteFilmDocument('approved');
    const techniqueBefore = JSON.stringify(technique);
    const report = createRtPtInspectionReport(technique);
    if (report.method !== 'RT-Film') throw new Error('Expected Film report');
    expect(report.results).toHaveLength(4);
    expect(report.results[0].planned.viewId).toBe('V1');
    expect(report.results[0].planned.sfd).toBe(110);
    expect(report.results[0].filmId).toBe('');
    report.results[0].filmId = 'ACTUAL-FILM-1';
    expect(JSON.stringify(technique)).toBe(techniqueBefore);
    expect(JSON.stringify(technique)).not.toContain('ACTUAL-FILM-1');
  });

  it('freezes the complete active PT process basis without claiming any performed step', () => {
    const technique = createCompletePtDocument('D', 'Type I', 'approved');
    const report = createRtPtInspectionReport(technique);
    if (report.method !== 'PT') throw new Error('Expected PT report');

    expect(report.results.planned).toMatchObject({
      cleaningMethod: technique.technique.surfacePrep.cleaningMethod,
      cleaningDetails: technique.technique.surfacePrep.cleaningDetails,
      cleaningRestrictions: technique.technique.surfacePrep.cleaningRestrictions,
      surfaceCondition: technique.technique.surfacePrep.surfaceCondition,
      dryingMethod: technique.technique.surfacePrep.dryingMethod,
      dryingTime: technique.technique.surfacePrep.dryingTime,
      dryingTemperature: technique.technique.surfacePrep.dryingTemperature,
      penetrantApplicationMethod: technique.technique.application.applicationMethod,
      emulsifierConcentration: technique.technique.removal.methodBD.concentration,
      emulsifierContactTime: technique.technique.removal.methodBD.contactTime,
      emulsifierApplicationMethod: technique.technique.removal.methodBD.applicationMethod,
      postEmulsifierRinseInstructions: technique.technique.removal.methodBD.postEmulsifierRinseInstructions,
      methodDPreRinseInstructions: technique.technique.removal.methodD.preRinseInstructions,
      methodDFinalRinseInstructions: technique.technique.removal.methodD.finalRinseInstructions,
      developerApplicationMethod: technique.technique.development.developerApplication,
      developerInstructions: technique.technique.development.instructions,
      darkAdaptationTime: technique.technique.conditions.darkAdaptationTime,
      methodARinseInstructions: '',
      methodCRemoverInstructions: '',
    });
    expect(report.results).toMatchObject({
      actualCleaningMethod: '',
      actualCleaningDetails: '',
      actualSurfaceCondition: '',
      actualDryingMethod: '',
      actualDryingTime: '',
      actualDryingTemperature: '',
      actualPenetrantApplicationMethod: '',
      actualEmulsifierConcentration: '',
      actualEmulsifierContactTime: '',
      actualEmulsifierApplicationMethod: '',
      actualPostEmulsifierRinseDetails: '',
      actualMethodDPreRinseDetails: '',
      actualMethodDFinalRinseDetails: '',
      actualDeveloperApplicationMethod: '',
      actualDarkAdaptationTime: '',
    });
  });

  it.each([
    ['A', 'Type I'],
    ['B', 'Type I'],
    ['C', 'Type II'],
    ['D', 'Type I'],
  ] as const)('requires and accepts a complete achieved PT Method %s / %s record', (method, penetrantType) => {
    const { technique, report } = completePtReport(method, penetrantType);
    expect(validateRtPtInspectionReport(report, technique).isApprovalReady).toBe(true);
  });

  it.each([
    ['actualCleaningMethod', 'Actual Surface-cleaning Method'],
    ['actualCleaningDetails', 'Actual Surface-preparation Details'],
    ['actualSurfaceCondition', 'Achieved Surface Condition'],
    ['actualDryingMethod', 'Actual Drying Method'],
    ['actualDryingTime', 'Actual Drying Time'],
    ['actualDryingTemperature', 'Actual Drying Temperature'],
    ['actualPenetrantApplicationMethod', 'Actual Penetrant Application'],
    ['actualDeveloperApplicationMethod', 'Actual Developer Application'],
    ['actualDarkAdaptationTime', 'Actual Dark-adaptation Time'],
  ] as const)('fails closed when PT performed field %s is not explicitly recorded', (field, expectedLabel) => {
    const { technique, report } = completePtReport('D', 'Type I');
    Object.assign(report.results, { [field]: '' });
    const validation = validateRtPtInspectionReport(report, technique);
    expect(validation.isApprovalReady).toBe(false);
    expect(validation.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ label: expectedLabel, section: 'results' }),
    ]));
  });

  it('requires accepted PT process controls to conform or carry a controlled deviation', () => {
    const { technique, report } = completePtReport('D', 'Type I');
    report.results.actualDryingTime = 1;
    report.results.actualEmulsifierConcentration = 99;
    report.results.actualDarkAdaptationTime = 1;
    const validation = validateRtPtInspectionReport(report, technique);
    expect(validation.isApprovalReady).toBe(false);
    expect(validation.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ label: 'Accepted PT Preparation and Application Controls' }),
      expect.objectContaining({ label: 'Accepted Method D Emulsifier Controls' }),
      expect.objectContaining({ label: 'Accepted Type I Dark Adaptation' }),
    ]));

    report.equipment.deviations = 'Level III approved deviation DEV-PT-42 controls the process variance.';
    expect(validateRtPtInspectionReport(report, technique).isApprovalReady).toBe(true);
  });

  it('strictly rejects unsupported or over-posted report drafts', () => {
    const { report } = completeFilmReport();
    expect(decodeRtPtInspectionReport(report).status).toBe('success');
    expect(decodeRtPtInspectionReport({ ...report, documentKind: 'other-product' }).status).toBe('invalid');
    expect(decodeRtPtInspectionReport({ ...report, unexpected: 'field' }).status).toBe('invalid');
    expect(decodeRtPtInspectionReport({ ...report, schemaVersion: 99 }).status).toBe('invalid');
  });

  it('fails the frozen technique link closed after approved technique content changes', () => {
    const { technique, report } = completeDigitalReport();
    const edited = structuredClone(technique);
    edited.technique.techniqueNotes = 'Changed controlled instruction';
    const validation = validateRtPtInspectionReport(report, edited);
    expect(validation.linkCurrent).toBe(false);
    expect(validation.isApprovalReady).toBe(false);
    expect(validation.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ label: 'Approved Technique Fingerprint', section: 'link' }),
    ]));
  });

  it('fails closed when the report frozen planned basis is altered independently', () => {
    const { technique, report } = completeFilmReport();
    report.results[0].planned.sfd = 999;
    const validation = validateRtPtInspectionReport(report, technique);
    expect(validation.linkCurrent).toBe(false);
    expect(validation.isApprovalReady).toBe(false);
    expect(validation.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ label: 'Frozen Planned Basis', section: 'link' }),
    ]));
  });

  it('binds printed source-technique title and approval date traceability', () => {
    const { technique, report } = completeFilmReport();
    report.sourceTechnique.title = 'False technique title';
    report.sourceTechnique.approvalDate = '1900-01-01';
    const validation = validateRtPtInspectionReport(report, technique);
    expect(validation.linkCurrent).toBe(false);
    expect(validation.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ label: 'Technique Title', section: 'link' }),
      expect.objectContaining({ label: 'Technique Approval Date', section: 'link' }),
    ]));
  });

  it('requires the frozen controlled-reference snapshot to exactly match the approved technique', () => {
    const { technique, report } = completeFilmReport();
    report.sourceTechnique.controlledReferences = [];
    const validation = validateRtPtInspectionReport(report, technique);
    expect(validation.linkCurrent).toBe(false);
    expect(validation.isApprovalReady).toBe(false);
    expect(validation.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ label: 'Frozen Controlled References', section: 'link' }),
    ]));
  });

  it('requires an approved and currently release-ready source technique', () => {
    const { technique, report } = completeFilmReport();
    const draft = { ...technique, status: 'draft' as const };
    const validation = validateRtPtInspectionReport(report, draft);
    expect(validation.linkCurrent).toBe(false);
    expect(validation.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ label: 'Approved Technique Release' }),
    ]));
  });

  it('rejects a raw Approved technique whose persisted approval binding is stale', () => {
    const { technique, report } = completeFilmReport();
    const staleBinding = {
      ...technique,
      approvalFingerprint: `sha256:${'0'.repeat(64)}`,
    };
    const validation = validateRtPtInspectionReport(report, staleBinding);
    expect(validation.linkCurrent).toBe(false);
    expect(validation.isApprovalReady).toBe(false);
    expect(validation.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ label: 'Approved Technique Release', section: 'link' }),
    ]));
  });

  it('binds Approved report content and invalidates edits fail-closed', () => {
    const { technique, report } = completeFilmReport();
    const validation = validateRtPtInspectionReport(report, technique);
    const inReview = setRtPtInspectionReportStatus(report, 'in-review');
    const approved = setRtPtInspectionReportStatus(inReview, 'approved', technique);
    expect(approved.status).toBe('approved');
    expect(approved.approvalFingerprint).toBe(fingerprintRtPtInspectionReportContent(approved));
    expect(reconcileRtPtInspectionReportApproval(approved).invalidated).toBe(false);

    const tampered = structuredClone(approved);
    tampered.remarks = 'Changed after approval';
    const reconciled = reconcileRtPtInspectionReportApproval(tampered);
    expect(reconciled).toMatchObject({
      invalidated: true,
      report: { status: 'draft', approvalFingerprint: '', approvals: [] },
    });

    const edited = editRtPtInspectionReport(approved, (current) => ({ ...current, remarks: 'Edited through UI' }));
    expect(edited).toMatchObject({ status: 'draft', approvalFingerprint: '', approvals: [] });

    const superseded = setRtPtInspectionReportStatus(approved, 'superseded', validation);
    expect(superseded.status).toBe('superseded');
    expect(superseded.approvalFingerprint).toBe(approved.approvalFingerprint);
    expect(superseded.approvals).toEqual(approved.approvals);
  });

  it('requires every entered indication to be complete, unique, and linked only to an existing result', () => {
    const { technique, report } = completeFilmReport();
    report.indications = [{
      id: 'indication-1',
      indicationId: '',
      linkedResultId: 'missing-result',
      location: '',
      indicationType: '',
      size: '',
      sizeUnit: 'mm',
      evaluation: '',
      disposition: '',
      remarks: '',
    }];
    const incomplete = validateRtPtInspectionReport(report, technique);
    expect(incomplete.isApprovalReady).toBe(false);
    expect(incomplete.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ label: 'Indication 1 ID', section: 'indications' }),
      expect.objectContaining({ label: 'Indication 1 Result Link', section: 'indications' }),
      expect.objectContaining({ label: 'Indication 1 Disposition', section: 'indications' }),
    ]));

    report.indications[0] = {
      ...report.indications[0],
      indicationId: 'IND-01',
      linkedResultId: report.results[0].id,
      location: 'Zone A / grid 2',
      indicationType: 'Linear indication',
      size: 1.5,
      evaluation: 'Evaluated against PRODUCT-SPEC-1 Rev B, clause 7.4',
      disposition: 'accepted',
    };
    expect(validateRtPtInspectionReport(report, technique).isApprovalReady).toBe(true);

    report.indications.push({ ...report.indications[0], id: 'indication-2' });
    const duplicate = validateRtPtInspectionReport(report, technique);
    expect(duplicate.isApprovalReady).toBe(false);
    expect(duplicate.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ label: 'Unique Indication IDs', section: 'indications' }),
    ]));
  });

  it.each([
    ['Film', () => {
      const subject = completeFilmReport();
      subject.report.results[1].id = subject.report.results[0].id;
      return { ...subject, expectedLabel: 'Unique Film Internal Result IDs' };
    }],
    ['DDA', () => {
      const subject = completeDigitalReport();
      subject.report.results[1].id = subject.report.results[0].id;
      return { ...subject, expectedLabel: 'Unique DDA Internal Result IDs' };
    }],
  ] as const)('rejects duplicate internal %s result IDs', (_label, create) => {
    const { technique, report, expectedLabel } = create();
    const validation = validateRtPtInspectionReport(report, technique);
    expect(validation.isApprovalReady).toBe(false);
    expect(validation.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ label: expectedLabel, section: 'results' }),
    ]));
  });

  it.each([
    ['Film self-link', () => {
      const subject = completeFilmReport();
      subject.report.results[0].retakeOfFilmId = subject.report.results[0].filmId;
      return { ...subject, expectedLabel: 'Film Retake Chain' };
    }],
    ['Film cycle', () => {
      const subject = completeFilmReport();
      subject.report.results[0].retakeOfFilmId = subject.report.results[1].filmId;
      subject.report.results[1].retakeOfFilmId = subject.report.results[0].filmId;
      return { ...subject, expectedLabel: 'Film Retake Chain' };
    }],
    ['DDA self-link', () => {
      const subject = completeDigitalReport();
      subject.report.results[0].retakeOfImageId = subject.report.results[0].imageId;
      return { ...subject, expectedLabel: 'DDA Retake Chain' };
    }],
    ['DDA cycle', () => {
      const subject = completeDigitalReport();
      subject.report.results[0].retakeOfImageId = subject.report.results[1].imageId;
      subject.report.results[1].retakeOfImageId = subject.report.results[0].imageId;
      return { ...subject, expectedLabel: 'DDA Retake Chain' };
    }],
  ] as const)('rejects a %s', (_label, create) => {
    const { technique, report, expectedLabel } = create();
    report.overallDisposition = 'rejected';
    const validation = validateRtPtInspectionReport(report, technique);
    expect(validation.isApprovalReady).toBe(false);
    expect(validation.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ label: expectedLabel, section: 'results' }),
    ]));
  });

  it.each([
    ['Film', () => {
      const subject = completeFilmReport();
      subject.report.results[0].exposureDate = '2026-07-22';
      subject.report.results[1].exposureDate = '2026-07-21';
      subject.report.results[1].retakeOfFilmId = subject.report.results[0].filmId;
      return { ...subject, expectedLabel: 'View 2 Retake Chronology' };
    }],
    ['DDA', () => {
      const subject = completeDigitalReport();
      subject.report.results[0].acquisitionDate = '2026-07-22';
      subject.report.results[1].acquisitionDate = '2026-07-21';
      subject.report.results[1].retakeOfImageId = subject.report.results[0].imageId;
      return { ...subject, expectedLabel: 'Acquisition 2 Retake Chronology' };
    }],
  ] as const)('rejects a %s retake performed before its referenced original', (_label, create) => {
    const { technique, report, expectedLabel } = create();
    const validation = validateRtPtInspectionReport(report, technique);
    expect(validation.isApprovalReady).toBe(false);
    expect(validation.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ label: expectedLabel, section: 'results' }),
    ]));
  });

  it('requires the independent reviewer to be a different person from the performer', () => {
    const { technique, report } = completeFilmReport();
    report.approvals[1] = {
      ...report.approvals[0],
      role: 'reviewed',
    };
    const validation = validateRtPtInspectionReport(report, technique);
    expect(validation.isApprovalReady).toBe(false);
    expect(validation.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ label: 'Independent Review Identity', section: 'approvals' }),
    ]));
  });

  it('requires accepted Film results to conform or carry a documented controlled deviation', () => {
    const { technique, report } = completeFilmReport();
    report.results[0].densityMinimum = 1.2;
    report.results[0].coverageConfirmed = false;
    const nonconforming = validateRtPtInspectionReport(report, technique);
    expect(nonconforming.isApprovalReady).toBe(false);
    expect(nonconforming.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ label: 'View 1 Accepted Density' }),
      expect.objectContaining({ label: 'View 1 Accepted Coverage' }),
    ]));

    report.equipment.deviations = 'Customer-approved deviation DEV-17 authorizes the documented density and coverage variance.';
    expect(validateRtPtInspectionReport(report, technique).isApprovalReady).toBe(true);

    report.equipment.deviations = '';
    report.overallDisposition = 'rejected';
    report.results[0].result = 'rejected';
    expect(validateRtPtInspectionReport(report, technique).isApprovalReady).toBe(true);
  });

  it.each([
    ['Film geometry in inches', () => {
      const subject = completeFilmReport();
      subject.report.results = subject.report.results.map((result) => ({
        ...result,
        actualSfd: 110 / 25.4,
        actualSfdUnit: 'inch',
        actualSod: 100 / 25.4,
        actualSodUnit: 'inch',
        actualOfd: 10 / 25.4,
        actualOfdUnit: 'inch',
      }));
      return subject;
    }],
    ['DDA geometry in inches', () => {
      const subject = completeDigitalReport();
      subject.report.results = subject.report.results.map((result) => ({
        ...result,
        actualSdd: 110 / 25.4,
        actualSddUnit: 'inch',
        actualSod: 100 / 25.4,
        actualSodUnit: 'inch',
        actualOdd: 10 / 25.4,
        actualOddUnit: 'inch',
      }));
      return subject;
    }],
  ] as const)('accepts equivalent cross-unit length values for %s', (_label, create) => {
    const { technique, report } = create();
    expect(validateRtPtInspectionReport(report, technique).isApprovalReady).toBe(true);
  });

  it.each([
    ['Film exposure in seconds', () => {
      const subject = completeFilmReport();
      subject.report.results = subject.report.results.map((result) => ({
        ...result,
        actualExposureTime: 120,
        actualExposureTimeUnit: 's',
      }));
      return subject;
    }],
    ['DDA exposure and integration in alternate units', () => {
      const subject = completeDigitalReport();
      subject.report.results = subject.report.results.map((result) => ({
        ...result,
        actualExposureTime: 2_000,
        actualExposureTimeUnit: 'ms',
        actualIntegrationTime: 0.001,
        actualIntegrationTimeUnit: 's',
      }));
      return subject;
    }],
    ['PT dwell and development in seconds', () => {
      const subject = completePtReport();
      subject.report.results.actualDwellTime = 1_200;
      subject.report.results.actualDwellTimeUnit = 's';
      subject.report.results.actualDevelopmentTime = 600;
      subject.report.results.actualDevelopmentTimeUnit = 's';
      return subject;
    }],
  ] as const)('accepts equivalent cross-unit time values for %s', (_label, create) => {
    const { technique, report } = create();
    expect(validateRtPtInspectionReport(report, technique).isApprovalReady).toBe(true);
  });

  it('accepts PT temperatures expressed in the equivalent alternate unit', () => {
    const { technique, report } = completePtReport();
    report.results.partTemperature = 68;
    report.results.penetrantTemperature = 68;
    report.results.temperatureUnit = 'degF';
    expect(validateRtPtInspectionReport(report, technique).isApprovalReady).toBe(true);
  });

  it.each([
    ['non-equivalent length', () => {
      const subject = completeFilmReport();
      subject.report.results[0].actualSfd = 1;
      subject.report.results[0].actualSfdUnit = 'inch';
      return { ...subject, expectedLabel: 'View 1 Accepted Geometry' };
    }],
    ['non-equivalent time', () => {
      const subject = completeDigitalReport();
      subject.report.results[0].actualExposureTime = 1_999;
      subject.report.results[0].actualExposureTimeUnit = 'ms';
      return { ...subject, expectedLabel: 'Acquisition 1 Accepted Exposure' };
    }],
    ['non-equivalent temperature', () => {
      const subject = completePtReport();
      subject.report.results.partTemperature = 106;
      subject.report.results.penetrantTemperature = 106;
      subject.report.results.temperatureUnit = 'degF';
      return { ...subject, expectedLabel: 'Accepted PT Temperature Controls' };
    }],
  ] as const)('rejects %s without a controlled deviation', (_label, create) => {
    const { technique, report, expectedLabel } = create();
    const validation = validateRtPtInspectionReport(report, technique);
    expect(validation.isApprovalReady).toBe(false);
    expect(validation.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ label: expectedLabel }),
    ]));
  });

  it.each([
    ['unknown length unit', () => {
      const subject = completeFilmReport();
      subject.report.results[0].actualSfdUnit = 'furlong' as never;
      return { ...subject, expectedLabel: 'View 1 Accepted Geometry' };
    }],
    ['length unit supplied for time', () => {
      const subject = completeDigitalReport();
      subject.report.results[0].actualExposureTimeUnit = 'mm' as never;
      return { ...subject, expectedLabel: 'Acquisition 1 Accepted Exposure' };
    }],
    ['unknown temperature unit', () => {
      const subject = completePtReport();
      subject.report.results.temperatureUnit = 'kelvin' as never;
      return { ...subject, expectedLabel: 'Part Temperature' };
    }],
  ] as const)('fails closed for %s', (_label, create) => {
    const { technique, report, expectedLabel } = create();
    const validation = validateRtPtInspectionReport(report, technique);
    expect(validation.isApprovalReady).toBe(false);
    expect(validation.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ label: expectedLabel }),
    ]));
  });

  it.each([
    [0, 'degC'],
    [-20, 'degC'],
    [0, 'degF'],
    [-40, 'degF'],
  ] as const)('accepts a physically valid PT temperature of %s %s as a completed performed value', (temperature, unit) => {
    const { technique, report } = completePtReport();
    report.results.partTemperature = temperature;
    report.results.penetrantTemperature = temperature;
    report.results.temperatureUnit = unit;
    report.overallDisposition = 'rejected';
    const validation = validateRtPtInspectionReport(report, technique);
    expect(validation.isApprovalReady).toBe(true);
    expect(validation.issues).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ label: 'Part Temperature' }),
      expect.objectContaining({ label: 'Penetrant Temperature' }),
    ]));
  });

  it.each([
    [-273.16, 'degC'],
    [-459.68, 'degF'],
  ] as const)('rejects a physically impossible PT temperature of %s %s', (temperature, unit) => {
    const { technique, report } = completePtReport();
    report.results.partTemperature = temperature;
    report.results.penetrantTemperature = temperature;
    report.results.temperatureUnit = unit;
    report.overallDisposition = 'rejected';
    const validation = validateRtPtInspectionReport(report, technique);
    expect(validation.isApprovalReady).toBe(false);
    expect(validation.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ label: 'Part Temperature' }),
      expect.objectContaining({ label: 'Penetrant Temperature' }),
    ]));
  });

  it.each([
    ['Film IQI', () => {
      const subject = completeFilmReport();
      subject.report.results[0].iqiRequirementMet = false;
      return { ...subject, expectedLabel: 'View 1 Accepted IQI Conformance' };
    }],
    ['DDA IQI', () => {
      const subject = completeDigitalReport();
      subject.report.results[0].iqiRequirementMet = false;
      return { ...subject, expectedLabel: 'Acquisition 1 Accepted IQI Conformance' };
    }],
    ['DDA SNR', () => {
      const subject = completeDigitalReport();
      subject.report.results[0].snrRequirementMet = false;
      return { ...subject, expectedLabel: 'Acquisition 1 Accepted SNR Conformance' };
    }],
    ['DDA CNR', () => {
      const subject = completeDigitalReport();
      subject.report.results[0].cnrRequirementMet = false;
      return { ...subject, expectedLabel: 'Acquisition 1 Accepted CNR Conformance' };
    }],
  ] as const)('does not infer accepted %s conformance from observation text', (_label, create) => {
    const { technique, report, expectedLabel } = create();
    const validation = validateRtPtInspectionReport(report, technique);
    expect(validation.isApprovalReady).toBe(false);
    expect(validation.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ label: expectedLabel, section: 'results' }),
    ]));
  });

  it.each([
    ['Film IQI', () => {
      const subject = completeFilmReport();
      subject.report.results[0].iqiRequirementMet = false;
      subject.report.results[0].result = 'rejected';
      subject.report.overallDisposition = 'rejected';
      return subject;
    }],
    ['DDA IQI/SNR/CNR', () => {
      const subject = completeDigitalReport();
      subject.report.results[0].iqiRequirementMet = false;
      subject.report.results[0].snrRequirementMet = false;
      subject.report.results[0].cnrRequirementMet = false;
      subject.report.results[0].result = 'retake-required';
      subject.report.overallDisposition = 'rejected';
      return subject;
    }],
  ] as const)('allows an explicit false %s confirmation on a non-accepted result', (_label, create) => {
    const { technique, report } = create();
    expect(validateRtPtInspectionReport(report, technique).isApprovalReady).toBe(true);
  });

  it.each([
    ['Film IQI', () => {
      const subject = completeFilmReport();
      subject.report.results[0].iqiRequirementMet = false;
      return subject;
    }],
    ['DDA IQI/SNR/CNR', () => {
      const subject = completeDigitalReport();
      subject.report.results[0].iqiRequirementMet = false;
      subject.report.results[0].snrRequirementMet = false;
      subject.report.results[0].cnrRequirementMet = false;
      return subject;
    }],
  ] as const)('allows accepted %s nonconformance only with a controlled deviation', (_label, create) => {
    const { technique, report } = create();
    report.equipment.deviations = 'Level III approved deviation DEV-42 documents the measured conformance variance.';
    expect(validateRtPtInspectionReport(report, technique).isApprovalReady).toBe(true);
  });

  it('requires planned DDA image-quality outcomes and accepted PT lighting conformance', () => {
    const digital = completeDigitalReport();
    digital.report.results[0].achievedSnr = '';
    const missingSnr = validateRtPtInspectionReport(digital.report, digital.technique);
    expect(missingSnr.isApprovalReady).toBe(false);
    expect(missingSnr.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ label: 'Acquisition 1 Achieved SNR' }),
    ]));

    const pt = completePtReport();
    pt.report.results.measuredUvA = 1;
    const lowUv = validateRtPtInspectionReport(pt.report, pt.technique);
    expect(lowUv.isApprovalReady).toBe(false);
    expect(lowUv.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ label: 'Accepted Type I Lighting' }),
    ]));
    pt.report.overallDisposition = 'rejected';
    expect(validateRtPtInspectionReport(pt.report, pt.technique).isApprovalReady).toBe(true);
  });

  it.each([
    ['X-ray result carrying Gamma activity', () => {
      const subject = completeFilmReport();
      subject.report.results[0].actualSourceActivity = 10;
      subject.report.results[0].actualSourceActivityUnit = 'Ci';
      subject.report.results[0].result = 'rejected';
      subject.report.overallDisposition = 'rejected';
      return { ...subject, expectedLabel: 'View 1 Inactive Gamma Fields' };
    }],
    ['Gamma result carrying X-ray settings', () => {
      const subject = completeGammaFilmReport();
      subject.report.results[0].actualTubeVoltage = 120;
      subject.report.results[0].actualTubeVoltageUnit = 'kV';
      subject.report.results[0].actualTubeCurrent = 5;
      subject.report.results[0].actualTubeCurrentUnit = 'mA';
      subject.report.results[0].result = 'rejected';
      subject.report.overallDisposition = 'rejected';
      return { ...subject, expectedLabel: 'View 1 Inactive X-ray Fields' };
    }],
  ] as const)('rejects %s even when the report disposition is rejected', (_label, create) => {
    const { technique, report, expectedLabel } = create();
    const validation = validateRtPtInspectionReport(report, technique);
    expect(validation.isApprovalReady).toBe(false);
    expect(validation.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ label: expectedLabel, section: 'results' }),
    ]));
  });

  it.each([
    ['Method A remover lot', 'A', 'removerLot', 'STALE-REMOVER', 'Inactive Removal Material Lots'],
    ['Method A emulsifier lot', 'A', 'emulsifierLot', 'STALE-EMULSIFIER', 'Inactive Removal Material Lots'],
    ['Method A emulsifier contact time', 'A', 'actualEmulsifierContactTime', 5, 'Inactive Removal Material Lots'],
    ['Method B hydrophilic concentration', 'B', 'actualEmulsifierConcentration', 20, 'Inactive Method B Concentration and Method D Rinses'],
    ['Method C emulsifier lot', 'C', 'emulsifierLot', 'STALE-EMULSIFIER', 'Inactive Emulsifier Lot'],
    ['Method C D-only pre-rinse', 'C', 'actualMethodDPreRinseDetails', 'STALE-PRE-RINSE', 'Inactive Emulsifier Lot'],
    ['Method D remover lot', 'D', 'removerLot', 'STALE-REMOVER', 'Inactive Remover Lot'],
    ['Method D A-only rinse pressure', 'D', 'actualMethodARinsePressure', 20, 'Inactive Remover Lot'],
  ] as const)('rejects a stale PT %s in an inactive removal branch', (_label, method, field, value, expectedLabel) => {
    const { technique, report } = completePtReport(method);
    Object.assign(report.results, { [field]: value });
    report.overallDisposition = 'rejected';
    const validation = validateRtPtInspectionReport(report, technique);
    expect(validation.isApprovalReady).toBe(false);
    expect(validation.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ label: expectedLabel, section: 'results' }),
    ]));
  });

  it.each([
    ['Type I white-light measurement', 'Type I', () => ({ measuredWhiteLight: 1200 }), 'Inactive Type II Lighting Fields'],
    ['Type II UV-A/ambient measurements', 'Type II', () => ({
      measuredUvA: 1200,
      measuredAmbientVisibleLight: 10,
      uvAUnit: 'uW/cm2',
    }), 'Inactive Type I Lighting Fields'],
    ['Type II dark-adaptation result', 'Type II', () => ({
      actualDarkAdaptationTime: 5,
      actualDarkAdaptationTimeUnit: 'min' as const,
    }), 'Inactive Type I Lighting Fields'],
  ] as const)('rejects stale %s even for a rejected PT disposition', (_label, penetrantType, inactiveValues, expectedLabel) => {
    const { technique, report } = completePtReport('A', penetrantType);
    report.results = { ...report.results, ...inactiveValues() };
    report.overallDisposition = 'rejected';
    const validation = validateRtPtInspectionReport(report, technique);
    expect(validation.isApprovalReady).toBe(false);
    expect(validation.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ label: expectedLabel, section: 'results' }),
    ]));
  });

  it('validates only the active PT lighting and removal branches', () => {
    const { technique, report } = completePtReport();
    const serializedIssues = JSON.stringify(validateRtPtInspectionReport(report, technique).issues);
    expect(serializedIssues).not.toContain('Measured White Light');
    expect(serializedIssues).not.toContain('Remover Lot');
    expect(validateRtPtInspectionReport(report, technique).isApprovalReady).toBe(true);

    const { technique: typeTwoTechnique, report: typeTwo } = completePtReport('C', 'Type II');
    const typeTwoValidation = validateRtPtInspectionReport(typeTwo, typeTwoTechnique);
    expect(typeTwoValidation.isApprovalReady).toBe(true);
    expect(JSON.stringify(typeTwoValidation.issues)).not.toContain('Measured UV-A');
    expect(JSON.stringify(typeTwoValidation.issues)).not.toContain('Emulsifier Lot');
  });
});
