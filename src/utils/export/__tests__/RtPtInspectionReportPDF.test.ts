import { describe, expect, it } from 'vitest';
import { createRtPtInspectionReport } from '@/lib/rtPtInspectionReport';
import { setRtPtInspectionReportStatus } from '@/lib/rtPtInspectionReportLifecycle';
import { validateRtPtInspectionReport } from '@/lib/rtPtInspectionReportValidation';
import {
  createCompleteDigitalDocument,
  createCompleteFilmDocument,
  createCompletePtDocument,
} from '@/lib/__tests__/rtPtV3Fixtures';
import type { RtPtDocumentV3 } from '@/types/rtPtDocument';
import type { RtPtInspectionReportV1 } from '@/types/rtPtInspectionReport';
import {
  buildRtPtInspectionReportPdf,
  getRtPtInspectionReportPdfFilename,
  getRtPtInspectionReportPdfReleaseState,
} from '@/utils/export/RtPtInspectionReportPDF';

type FilmReport = Extract<RtPtInspectionReportV1, { method: 'RT-Film' }>;
type DigitalReport = Extract<RtPtInspectionReportV1, { method: 'RT-Digital' }>;
type PtReport = Extract<RtPtInspectionReportV1, { method: 'PT' }>;

const completeCommon = <T extends RtPtInspectionReportV1>(report: T): T => {
  report.reportControl = {
    number: 'RPT-100',
    title: 'Performed NDT Inspection Report',
    revision: 'A',
    reportDate: '2026-07-22',
    inspectionStart: '2026-07-21',
    inspectionEnd: '2026-07-22',
  };
  report.part.serialOrLotNumber = 'LOT-100';
  report.part.quantity = 2;
  report.part.workOrder = 'WO-1';
  report.equipment = {
    equipmentUsed: 'Controlled equipment set EQ-100',
    calibrationReferences: 'CAL-100 / CAL-200',
    environmentalConditions: 'Recorded shop conditions',
    deviations: 'None recorded',
  };
  report.coverageStatement = 'The planned inspection area was examined and recorded.';
  report.overallDisposition = 'accepted';
  report.dispositionReference = 'PRODUCT-SPEC-1 Rev B, clause 7.4';
  report.remarks = 'Disposition was entered by authorized personnel and was not inferred by software.';
  report.approvals = [
    {
      role: 'performed',
      name: 'Inspector One',
      personnelId: 'EMP-100',
      certificationLevel: 'Level II',
      certificationNumber: 'CERT-100',
      certificationBasis: 'Controlled written practice',
      date: '2026-07-22',
    },
    {
      role: 'reviewed',
      name: 'Reviewer Two',
      personnelId: 'EMP-200',
      certificationLevel: 'Level III',
      certificationNumber: 'CERT-200',
      certificationBasis: 'Controlled written practice',
      date: '2026-07-22',
    },
  ];
  return report;
};

const createCompleteFilmReport = (
  technique = createCompleteFilmDocument('approved'),
): { technique: Extract<RtPtDocumentV3, { method: 'RT-Film' }>; report: FilmReport } => {
  const report = completeCommon(createRtPtInspectionReport(technique) as FilmReport);
  report.results.forEach((result, index) => {
    result.filmId = `FILM-${index + 1}`;
    result.exposureDate = '2026-07-21';
    result.actualSfd = 110;
    result.actualSod = 100;
    result.actualOfd = 10;
    result.actualTubeVoltage = 120;
    result.actualTubeCurrent = 5;
    result.actualExposureTime = 2;
    result.densityMinimum = 2;
    result.densityMaximum = 3.5;
    result.iqiObserved = 'Required IQI detail visible';
    result.iqiRequirementMet = true;
    result.coverageConfirmed = true;
    result.result = 'accepted';
    result.remarks = `Film result ${index + 1} reviewed`;
  });
  report.indications = [{
    id: 'indication-1',
    indicationId: 'IND-1',
    linkedResultId: report.results[0]?.id ?? '',
    location: 'Zone 1 / grid A2',
    indicationType: 'Linear indication',
    size: 2,
    sizeUnit: 'mm',
    evaluation: 'Evaluated against the recorded disposition reference',
    disposition: 'accepted',
    remarks: 'Recorded evaluation',
  }];
  return { technique, report };
};

const createCompleteDigitalReport = (): {
  technique: Extract<RtPtDocumentV3, { method: 'RT-Digital' }>;
  report: DigitalReport;
} => {
  const technique = createCompleteDigitalDocument('approved');
  const report = completeCommon(createRtPtInspectionReport(technique) as DigitalReport);
  report.results.forEach((result, index) => {
    result.imageId = `IMAGE-${index + 1}`;
    result.acquisitionDate = '2026-07-21';
    result.actualSdd = 110;
    result.actualSod = 100;
    result.actualOdd = 10;
    result.actualTubeVoltage = 120;
    result.actualTubeCurrent = 5;
    result.actualExposureTime = 2;
    result.actualIntegrationTime = 1;
    result.actualFramesAveraged = 4;
    result.achievedSnr = 'Normalized SNR 120';
    result.achievedCnr = 'CNR 8.5';
    result.iqiObserved = 'Required duplex-wire detail visible';
    result.iqiRequirementMet = true;
    result.snrRequirementMet = true;
    result.cnrRequirementMet = true;
    result.detectorControlReference = 'BPM-1 / CAL-1 / STAB-1';
    result.archiveReference = `ARCHIVE/WO-1/IMAGE-${index + 1}`;
    result.coverageConfirmed = true;
    result.result = 'accepted';
    result.remarks = `DDA result ${index + 1} reviewed`;
  });
  return { technique, report };
};

const createCompletePtReport = (
  method: 'A' | 'B' | 'C' | 'D' = 'D',
  penetrantType: 'Type I' | 'Type II' = 'Type I',
): {
  technique: Extract<RtPtDocumentV3, { method: 'PT' }>;
  report: PtReport;
} => {
  const technique = createCompletePtDocument(method, penetrantType, 'approved');
  const report = completeCommon(createRtPtInspectionReport(technique) as PtReport);
  Object.assign(report.results, {
    penetrantLot: 'PEN-LOT-1',
    penetrantExpiry: '2027-07-22',
    cleanerLot: 'CLEAN-LOT-1',
    removerLot: method === 'C' ? 'REMOVER-LOT-C' : 'STALE-REMOVER-LOT',
    emulsifierLot: method === 'B' || method === 'D' ? 'EMULSIFIER-LOT-BD' : 'STALE-EMULSIFIER-LOT',
    developerLot: 'DEV-LOT-1',
    actualCleaningMethod: 'Approved cleaning process',
    actualCleaningDetails: 'ACTUAL-CLEANING-DETAILS',
    actualSurfaceCondition: 'Clean and dry',
    actualDryingMethod: 'Air',
    actualDryingTime: 10,
    actualDryingTimeUnit: 'min',
    actualDryingTemperature: 25,
    actualDryingTemperatureUnit: 'degC',
    actualPenetrantApplicationMethod: 'Spray',
    partTemperature: 24,
    penetrantTemperature: 24,
    actualDwellTime: 20,
    actualDwellTimeUnit: 'min',
    actualDevelopmentTime: 10,
    actualDevelopmentTimeUnit: 'min',
    actualMethodARinseDetails: method === 'A' ? 'ACTUAL-A-RINSE' : 'STALE-A-RINSE',
    actualMethodARinsePressure: method === 'A' ? 1.5 : 910001,
    actualMethodARinsePressureUnit: 'bar',
    actualMethodARinseTemperature: method === 'A' ? 25 : 910002,
    actualMethodARinseTemperatureUnit: 'degC',
    actualEmulsifierConcentration: method === 'D' ? 10 : 920001,
    actualEmulsifierConcentrationUnit: '%',
    actualEmulsifierContactTime: method === 'B' || method === 'D' ? 2 : 920002,
    actualEmulsifierContactTimeUnit: 'min',
    actualEmulsifierApplicationMethod: method === 'B' || method === 'D' ? 'Immersion' : 'STALE-EMULSIFIER-APPLICATION',
    actualPostEmulsifierRinseDetails: method === 'B' || method === 'D' ? 'ACTUAL-POST-EMULSIFIER-RINSE' : 'STALE-POST-EMULSIFIER-RINSE',
    actualMethodCRemovalDetails: method === 'C' ? 'ACTUAL-C-REMOVAL' : 'STALE-C-REMOVAL',
    actualMethodDPreRinseDetails: method === 'D' ? 'ACTUAL-D-PRE-RINSE' : 'STALE-D-PRE-RINSE',
    actualMethodDFinalRinseDetails: method === 'D' ? 'ACTUAL-D-FINAL-RINSE' : 'STALE-D-FINAL-RINSE',
    actualDeveloperApplicationMethod: 'Spray',
    actualDarkAdaptationTime: penetrantType === 'Type I' ? 5 : 930001,
    actualDarkAdaptationTimeUnit: 'min',
    measuredUvA: penetrantType === 'Type I' ? 1200 : 876543210,
    measuredAmbientVisibleLight: penetrantType === 'Type I' ? 10 : 765432109,
    measuredWhiteLight: penetrantType === 'Type II' ? 1200 : 987654321,
    lightMeterId: 'METER-1 / CAL-300',
    examinationTime: '14:30 local',
    postCleaningCompleted: true,
    coverageConfirmed: true,
  });
  return { technique, report };
};

const approve = <T extends RtPtInspectionReportV1>(report: T, technique: RtPtDocumentV3): T => {
  const validation = validateRtPtInspectionReport(report, technique);
  expect(validation.isApprovalReady).toBe(true);
  const inReview = setRtPtInspectionReportStatus(report, 'in-review', technique);
  return setRtPtInspectionReportStatus(inReview, 'approved', technique) as T;
};

const pdfCommands = (pdf: ReturnType<typeof buildRtPtInspectionReportPdf>): string => (
  JSON.stringify((pdf.internal as unknown as { pages: string[][] }).pages)
);

describe('RT/PT performed inspection report PDF export', { timeout: 15_000 }, () => {
  it('renders controlled Film planned-versus-performed records without inactive Gamma leakage', () => {
    const { technique, report } = createCompleteFilmReport();
    const approved = approve(report, technique);
    const release = getRtPtInspectionReportPdfReleaseState(approved, technique);
    const commands = pdfCommands(buildRtPtInspectionReportPdf(approved, technique));

    expect(release).toMatchObject({ controlledRelease: true, watermark: null });
    expect(commands).toContain('NDT INSPECTION REPORT - PERFORMED RESULTS');
    expect(commands).toContain('PERFORMED FILM RESULT SUMMARY');
    expect(commands).toContain('PLANNED / REQUIRED');
    expect(commands).toContain('PERFORMED / ACHIEVED');
    expect(commands).toContain('FILM RESULT V1');
    expect(commands).toContain('Measured 2 H&D to 3.5 H&D');
    expect(commands).toContain('IQI Requirement Assessment');
    expect(commands).toContain('RELEASE AND INTEGRITY VERIFICATION');
    expect(commands).toContain('REPORT SHA-256');
    expect(commands).toContain('BINDING');
    expect(commands).not.toContain('Gamma source per approved technique');
  });

  it('renders DDA acquisition, image-quality, detector-control, and archive records', () => {
    const { technique, report } = createCompleteDigitalReport();
    const approved = approve(report, technique);
    const commands = pdfCommands(buildRtPtInspectionReportPdf(approved, technique));

    expect(commands).toContain('PERFORMED DDA ACQUISITION SUMMARY');
    expect(commands).toContain('DDA ACQUISITION RESULT D1');
    expect(commands).toContain('Normalized SNR 120');
    expect(commands).toContain('CNR 8.5');
    expect(commands).toContain('IQI Requirement Assessment');
    expect(commands).toContain('SNR Requirement');
    expect(commands).toContain('CNR Requirement');
    expect(commands).toContain('Assessment');
    expect(commands).toContain('BPM-1 / CAL-1 / STAB-1');
    expect(commands).toContain('ARCHIVE/WO-1/IMAGE-1');
  });

  it('renders complete PT planned-versus-achieved controls while suppressing inactive method and type branches', () => {
    const methodD = createCompletePtReport('D', 'Type I');
    const methodDCommands = pdfCommands(buildRtPtInspectionReportPdf(methodD.report, methodD.technique));
    expect(methodDCommands).toContain('Surface Preparation');
    expect(methodDCommands).toContain('ACTUAL-CLEANING-DETAILS');
    expect(methodDCommands).toContain('Drying');
    expect(methodDCommands).toContain('Penetrant Application');
    expect(methodDCommands).toContain('Method D Pre-rinse');
    expect(methodDCommands).toContain('ACTUAL-D-PRE-RINSE');
    expect(methodDCommands).toContain('Method D Emulsifier Controls');
    expect(methodDCommands).toContain('Concentration 10 %');
    expect(methodDCommands).toContain('ACTUAL-POST-EMULSIFIER-RINSE');
    expect(methodDCommands).toContain('Method D Final Rinse');
    expect(methodDCommands).toContain('ACTUAL-D-FINAL-RINSE');
    expect(methodDCommands).toContain('Developer Application');
    expect(methodDCommands).toContain('Dark Adaptation');
    expect(methodDCommands).toContain('UV-A / Ambient Visible Light');
    expect(methodDCommands).not.toContain('STALE-A-RINSE');
    expect(methodDCommands).not.toContain('STALE-C-REMOVAL');
    expect(methodDCommands).not.toContain('987654321');

    const methodB = createCompletePtReport('B', 'Type I');
    const methodBCommands = pdfCommands(buildRtPtInspectionReportPdf(methodB.report, methodB.technique));
    expect(methodBCommands).toContain('Method B Emulsifier Controls');
    expect(methodBCommands).toContain('ACTUAL-POST-EMULSIFIER-RINSE');
    expect(methodBCommands).not.toContain('920001');
    expect(methodBCommands).not.toContain('STALE-D-PRE-RINSE');
    expect(methodBCommands).not.toContain('STALE-D-FINAL-RINSE');

    const methodA = createCompletePtReport('A', 'Type II');
    const methodACommands = pdfCommands(buildRtPtInspectionReportPdf(methodA.report, methodA.technique));
    expect(methodACommands).toContain('Method A Water Rinse');
    expect(methodACommands).toContain('ACTUAL-A-RINSE');
    expect(methodACommands).toContain('Pressure 1.5 bar');
    expect(methodACommands).toContain('White Light');
    expect(methodACommands).not.toContain('STALE-EMULSIFIER-APPLICATION');
    expect(methodACommands).not.toContain('STALE-C-REMOVAL');
    expect(methodACommands).not.toContain('930001');
    expect(methodACommands).not.toContain('876543210');
    expect(methodACommands).not.toContain('765432109');

    const methodC = createCompletePtReport('C', 'Type II');
    const methodCCommands = pdfCommands(buildRtPtInspectionReportPdf(methodC.report, methodC.technique));
    expect(methodCCommands).toContain('Method C Remover Step');
    expect(methodCCommands).toContain('REMOVER-LOT-C');
    expect(methodCCommands).toContain('ACTUAL-C-REMOVAL');
    expect(methodCCommands).not.toContain('STALE-EMULSIFIER-LOT');
    expect(methodCCommands).not.toContain('STALE-A-RINSE');
    expect(methodCCommands).not.toContain('STALE-D-PRE-RINSE');
    expect(methodCCommands).not.toContain('930001');
  });

  it('fails closed when the approved technique link becomes stale', () => {
    const { technique, report } = createCompleteFilmReport();
    const approved = approve(report, technique);
    const stale = structuredClone(approved);
    stale.sourceTechnique.revision = 'STALE-REVISION';

    expect(getRtPtInspectionReportPdfReleaseState(stale, technique)).toEqual({
      controlledRelease: false,
      watermark: 'DRAFT - UNCONTROLLED',
      filenamePrefix: 'DRAFT-UNCONTROLLED-',
    });
    expect(getRtPtInspectionReportPdfFilename(stale, technique)).toMatch(/^RTPT-REPORT-DRAFT-UNCONTROLLED-/);
    expect(pdfCommands(buildRtPtInspectionReportPdf(stale, technique))).toContain('DRAFT - UNCONTROLLED');
  });

  it('recomputes validation and ignores a caller-spoofed ready summary', () => {
    const { technique, report } = createCompleteDigitalReport();
    const approved = approve(report, technique);
    const spoofedReady = validateRtPtInspectionReport(approved, technique);
    const tampered = structuredClone(approved);
    tampered.reportControl.number = '';

    expect(spoofedReady.isApprovalReady).toBe(true);
    expect(getRtPtInspectionReportPdfReleaseState(tampered, technique, spoofedReady).controlledRelease).toBe(false);
    const commands = pdfCommands(buildRtPtInspectionReportPdf(tampered, technique, spoofedReady));
    expect(commands).toContain('DRAFT - UNCONTROLLED');
    expect(commands).toContain('REPORT NUMBER');
  });

  it('fails controlled release after a semantically valid post-approval edit', () => {
    const { technique, report } = createCompleteFilmReport();
    const approved = approve(report, technique);
    const tampered = structuredClone(approved);
    tampered.remarks = 'A different but otherwise valid controlled-report remark.';

    expect(validateRtPtInspectionReport(tampered, technique).isApprovalReady).toBe(true);
    expect(getRtPtInspectionReportPdfReleaseState(tampered, technique)).toMatchObject({
      controlledRelease: false,
      watermark: 'DRAFT - UNCONTROLLED',
    });
    expect(pdfCommands(buildRtPtInspectionReportPdf(tampered, technique))).toContain('DRAFT - UNCONTROLLED');
  });

  it('renders frozen controlled references and never substitutes a later live-technique revision', () => {
    const { technique, report } = createCompleteFilmReport();
    const approved = approve(report, technique);
    const frozenReference = approved.sourceTechnique.controlledReferences[0];
    expect(frozenReference?.number).toBe('PRODUCT-SPEC-1');
    const beforeChange = pdfCommands(buildRtPtInspectionReportPdf(approved, technique));
    expect(getRtPtInspectionReportPdfReleaseState(approved, technique)).toMatchObject({
      controlledRelease: true,
      watermark: null,
    });

    technique.controlledReferences = [{
      type: 'Customer instruction',
      title: 'Later live technique reference',
      number: 'LIVE-REF-CHANGED',
      revision: 'Z',
      clauseOrNote: 'Not part of the historical report basis',
    }];

    expect(getRtPtInspectionReportPdfReleaseState(approved, technique)).toMatchObject({
      controlledRelease: false,
      watermark: 'DRAFT - UNCONTROLLED',
    });
    const afterChange = pdfCommands(buildRtPtInspectionReportPdf(approved, technique));
    expect(beforeChange).toContain('PRODUCT-SPEC-1');
    expect(afterChange).toContain('PRODUCT-SPEC-1');
    expect(afterChange).not.toContain('LIVE-REF-CHANGED');
    expect(afterChange).not.toContain('Later live technique reference');
  });

  it('uses safe RTPT-REPORT filenames and consistent draft/superseded watermarks', () => {
    const { technique, report } = createCompleteFilmReport();
    report.reportControl.number = 'RPT / 100 unsafe';

    expect(getRtPtInspectionReportPdfFilename(report, technique)).toMatch(
      /^RTPT-REPORT-DRAFT-UNCONTROLLED-RT-Film-RPT-100-unsafe-REV-A\.pdf$/,
    );

    const superseded = { ...report, status: 'superseded' as const };
    expect(getRtPtInspectionReportPdfReleaseState(superseded, technique)).toMatchObject({
      controlledRelease: false,
      watermark: 'SUPERSEDED - UNCONTROLLED',
    });
    expect(getRtPtInspectionReportPdfFilename(superseded, technique)).toMatch(
      /^RTPT-REPORT-SUPERSEDED-UNCONTROLLED-/,
    );
    const commands = pdfCommands(buildRtPtInspectionReportPdf(superseded, technique));
    expect(commands).toContain('SUPERSEDED - UNCONTROLLED');
    expect(commands).not.toContain('DRAFT - UNCONTROLLED');
  });

  it('paginates long records with running furniture and never makes signature claims', () => {
    const { technique, report } = createCompleteFilmReport();
    const longText = 'LONG PERFORMED INSPECTION NARRATIVE '.repeat(18).trim();
    report.remarks = longText;
    report.coverageStatement = longText;
    report.results[0].remarks = longText.repeat(4);
    report.indications = Array.from({ length: 24 }, (_, index) => ({
      id: `indication-${index + 1}`,
      indicationId: `IND-LONG-${index + 1}`,
      linkedResultId: report.results[index % report.results.length].id,
      location: `Zone ${index + 1} / ${longText}`,
      indicationType: 'Recorded indication',
      size: index + 1,
      sizeUnit: 'mm' as const,
      evaluation: longText,
      disposition: 'accepted' as const,
      remarks: longText,
    }));

    const pdf = buildRtPtInspectionReportPdf(report, technique);
    const commands = pdfCommands(pdf);
    expect(pdf.getNumberOfPages()).toBeGreaterThan(6);
    expect(commands).toContain('IND-LON');
    expect(commands).toContain('G-24');
    expect(commands).toContain('PERFORMED / ACHIEVED INSPECTION RESULTS');
    expect(commands).toContain(`PAGE ${pdf.getNumberOfPages()} OF ${pdf.getNumberOfPages()}`);
    expect(commands).toContain('PERSONNEL AND APPROVAL RECORDS');
    expect(commands.match(/FILM RESULT V1/g)?.length ?? 0).toBeGreaterThan(1);
    expect(commands).not.toContain('SIGNATURE');
    expect(commands).not.toContain('DIGITALLY SIGNED');
  });
});
