import { describe, expect, it } from 'vitest';
import {
  decodeRtPtDocument,
  fingerprintRtPtApprovedContent,
  hasValidRtPtApprovalFingerprint,
} from '@/lib/rtPtDocumentCodec';
import { validateRtPtDocument } from '@/lib/rtPtValidation';
import { resolveRtPtWorkflowTab } from '@/lib/rtPtWorkflow';
import { normalizeRtSetupDiagram } from '@/lib/rtPtSetupDiagram';
import { buildRtProcessOverview } from '@/lib/rtPtProcessOverview';
import {
  createRtPtInspectionReport,
  decodeRtPtInspectionReport,
} from '@/lib/rtPtInspectionReport';
import { validateRtPtInspectionReport } from '@/lib/rtPtInspectionReportValidation';
import {
  buildRtPtFilmExposureSheetPdf,
  buildRtPtTechniquePdf,
  getRtPtExportSections,
  getRtPtFilmExposureSheetPdfFilename,
  getRtPtPdfReleaseState,
} from '@/utils/export/RtPtTechniquePDF';
import { buildRtPtInspectionReportPdf } from '@/utils/export/RtPtInspectionReportPDF';
import { createCompleteCrDocument } from './rtPtV3Fixtures';

const pdfCommands = (pdf: ReturnType<typeof buildRtPtTechniquePdf>): string => (
  JSON.stringify((pdf.internal as unknown as { pages: string[][] }).pages)
);

describe('RT-CR controlled technique end to end', () => {
  it('round-trips a native V3 CR document through the codec', () => {
    const document = createCompleteCrDocument();
    const decoded = decodeRtPtDocument(JSON.parse(JSON.stringify(document)));
    expect(decoded.status).toBe('success');
    if (decoded.status !== 'success') return;
    expect(decoded.document.method).toBe('RT-CR');
    if (decoded.document.method !== 'RT-CR') return;
    expect(decoded.document.technique.plateSystem.plateDesignation).toBe('IPX-1');
    expect(decoded.document.technique.scanner.scanResolutionPixelsPerMm).toBe(20);
    expect(decoded.document.technique.exposureViews).toHaveLength(4);
  });

  it('strips unknown CR technique fields instead of persisting them', () => {
    const document = createCompleteCrDocument();
    const withNoise = JSON.parse(JSON.stringify(document));
    withNoise.technique.plateSystem.unexpected = 'noise';
    withNoise.technique.scanner.hackField = 42;
    const decoded = decodeRtPtDocument(withNoise);
    expect(decoded.status).toBe('success');
    if (decoded.status !== 'success') return;
    const serialized = JSON.stringify(decoded.document);
    expect(serialized).not.toContain('unexpected');
    expect(serialized).not.toContain('hackField');
  });

  it('rejects legacy V1 payloads that claim a CR method', () => {
    const decoded = decodeRtPtDocument({
      documentKind: 'rtpt-document',
      schemaVersion: 1,
      method: 'RT-CR',
      sheets: { rtFilm: {}, rtDigital: {}, penetrant: {} },
    });
    expect(decoded.status).toBe('invalid');
  });

  it('validates the complete CR fixture as complete and approval-ready', () => {
    const summary = validateRtPtDocument(createCompleteCrDocument());
    expect(summary.method).toBe('RT-CR');
    expect(summary.issues).toEqual([]);
    expect(summary.isComplete).toBe(true);
    expect(summary.approvalReadiness.isReady).toBe(true);
  });

  it('reports an incomplete census when required CR plate/scanner fields are blanked', () => {
    const document = createCompleteCrDocument();
    document.technique.plateSystem.plateDesignation = '';
    document.technique.scanner.qualification.reference = '';
    const summary = validateRtPtDocument(document);
    expect(summary.isComplete).toBe(false);
    expect(summary.completedFieldsCount).toBeLessThan(summary.totalRequiredFields);
    expect(summary.approvalReadiness.isReady).toBe(false);
    expect(summary.approvalReadiness.issues.some((issue) => issue.label === 'Scanner Qualification Evidence')).toBe(true);
  });

  it('flags CR-specific cross-field violations', () => {
    const geometryBroken = createCompleteCrDocument();
    geometryBroken.technique.exposureViews[0].sfd = 150;
    const geometrySummary = validateRtPtDocument(geometryBroken);
    expect(geometrySummary.issues.some((issue) => issue.message.includes('SOD + OFD'))).toBe(true);

    const greyBroken = createCompleteCrDocument();
    greyBroken.technique.imageQuality.greyValueMin = 60000;
    const greySummary = validateRtPtDocument(greyBroken);
    expect(greySummary.issues.some((issue) => issue.label === 'Required Grey-Value Window')).toBe(true);

    const expiredScanner = createCompleteCrDocument();
    expiredScanner.technique.scanner.qualification.dueDate = '2026-07-10';
    const scannerSummary = validateRtPtDocument(expiredScanner);
    expect(scannerSummary.issues.some((issue) => issue.label === 'Scanner Qualification Currency')).toBe(true);

    const ugBroken = createCompleteCrDocument();
    ugBroken.technique.exposureViews[0].requiredUg = 0.05;
    const ugSummary = validateRtPtDocument(ugBroken);
    expect(ugSummary.issues.some((issue) => issue.message.includes('exceeds the user-specified required Ug'))).toBe(true);

    const gammaContamination = createCompleteCrDocument();
    gammaContamination.technique.source.sourceType = 'Gamma';
    gammaContamination.technique.source.gamma = {
      isotope: 'Ir-192',
      sourceId: 'SRC-1',
      activity: 80,
      activityUnit: 'Ci',
      activityReferenceDate: '2026-07-01',
      effectiveSourceSize: 2,
      effectiveSourceSizeUnit: 'mm',
    };
    const gammaSummary = validateRtPtDocument(gammaContamination);
    expect(gammaSummary.issues.some((issue) => issue.label === 'Inactive X-ray Source Data')).toBe(true);
  });

  it('binds and verifies the approval fingerprint for an approved CR technique', () => {
    const approved = createCompleteCrDocument('approved');
    expect(hasValidRtPtApprovalFingerprint(approved)).toBe(true);
    const edited = JSON.parse(JSON.stringify(approved)) as typeof approved;
    edited.technique.scanner.model = 'CRS-99';
    expect(fingerprintRtPtApprovedContent(edited)).not.toBe(fingerprintRtPtApprovedContent(approved));
  });

  it('maps CR validation issue tabs onto the CR workspace tabs', () => {
    expect(resolveRtPtWorkflowTab('RT-CR', 'source')).toBe('equipment');
    expect(resolveRtPtWorkflowTab('RT-CR', 'iqi')).toBe('iqc');
    expect(resolveRtPtWorkflowTab('RT-CR', 'plate')).toBe('plate');
    expect(resolveRtPtWorkflowTab('RT-CR', 'image')).toBe('image');
    expect(resolveRtPtWorkflowTab('RT-CR', 'views')).toBe('views');
  });

  it('labels the CR setup diagram with plate terminology on film geometry codes', () => {
    const diagram = normalizeRtSetupDiagram({ mode: 'cr' });
    expect(diagram.methodLabel).toBe('RT Computed Radiography');
    expect(diagram.receptorHeading).toBe('Imaging plate / cassette');
    expect(diagram.sourceHeading).toBe('Radiation source');
    expect(diagram.dimensions.sourceToReceptor.code).toBe('SFD');
    expect(diagram.dimensions.sourceToReceptor.name).toBe('Source-to-plate distance');
    expect(diagram.dimensions.objectToReceptor.code).toBe('OFD');
  });

  it('builds a CR process overview mirroring the radiographic pipeline', () => {
    const document = createCompleteCrDocument();
    const validation = validateRtPtDocument(document);
    const overview = buildRtProcessOverview(document, validation);
    expect(overview).not.toBeNull();
    expect(overview?.methodLabel).toBe('RT Computed Radiography');
    expect(overview?.stages).toHaveLength(6);
    const stagesById = new Map(overview!.stages.map((stage) => [stage.id, stage]));
    expect(stagesById.get('part')?.status).toBe('complete');
    expect(stagesById.get('geometry')?.status).toBe('complete');
    expect(stagesById.get('unsharpness')?.status).toBe('complete');
    expect(stagesById.get('card')?.status).toBe('complete');
  });

  it('scaffolds a CR inspection report from the approved technique', () => {
    const technique = createCompleteCrDocument('approved');
    const report = createRtPtInspectionReport(technique);
    expect(report.method).toBe('RT-CR');
    if (report.method !== 'RT-CR') return;
    expect(report.sourceTechnique.method).toBe('RT-CR');
    expect(report.results).toHaveLength(4);
    expect(report.results[0].planned.plateDesignation).toBe('IPX-1');
    expect(report.results[0].planned.greyValueMin).toBe(20000);
    expect(report.results[0].planned.requiredSnrMin).toBe(70);
    expect(report.results[0].plateOrImageId).toBe('');
    expect(report.results[0].scanDate).toBe('');

    const decoded = decodeRtPtInspectionReport(JSON.parse(JSON.stringify(report)));
    expect(decoded.status).toBe('success');

    const validation = validateRtPtInspectionReport(report, technique);
    expect(validation.linkCurrent).toBe(true);
    // The frozen planned basis matches the technique it was scaffolded from...
    expect(validation.issues.some((issue) => issue.label === 'Frozen Planned Basis')).toBe(false);
    // ...while the fresh report still owes its performed CR entries, including the plate scan date.
    expect(validation.issues.some((issue) => issue.label.includes('Scan Date'))).toBe(true);
  });

  it('renders the CR technique PDF with plate sections and controlled release for the approved fixture', () => {
    const draft = createCompleteCrDocument();
    const sections = JSON.stringify(getRtPtExportSections(draft));
    expect(sections).toContain('Required Imaging Plate System');
    expect(sections).toContain('CR Scanner and Readout Plan');
    expect(sections).toContain('Required Scanned-Image Quality');
    expect(sections).toContain('Plate Erasure Requirement');

    const draftPdf = buildRtPtTechniquePdf(draft);
    const draftCommands = pdfCommands(draftPdf);
    expect(draftCommands).toContain('CR EXPOSURE PLAN OVERVIEW');
    expect(draftCommands).toContain('CR EXPOSURE SETUP');
    expect(draftCommands).toContain('DRAFT - UNCONTROLLED');

    const approved = createCompleteCrDocument('approved');
    expect(getRtPtPdfReleaseState(approved).controlledRelease).toBe(true);
    const approvedCommands = pdfCommands(buildRtPtTechniquePdf(approved));
    expect(approvedCommands).not.toContain('DRAFT - UNCONTROLLED');
  });

  it('exports a standalone CR exposure sheet under the technique release rules', () => {
    const document = createCompleteCrDocument();
    const commands = pdfCommands(buildRtPtFilmExposureSheetPdf(document));
    expect(commands).toContain('CR EXPOSURE SHEET - PLANNED EXPOSURES ONLY');
    expect(commands).toContain('CR EXPOSURE PLAN OVERVIEW');
    expect(commands).toContain('DRAFT - UNCONTROLLED');
    expect(getRtPtFilmExposureSheetPdfFilename(document)).toMatch(/^DRAFT-UNCONTROLLED-RTPT-CR-EXPOSURE-SHEET-/);
  });

  it('renders the CR inspection report PDF with the performed CR summary', () => {
    const technique = createCompleteCrDocument('approved');
    const report = createRtPtInspectionReport(technique);
    const pdf = buildRtPtInspectionReportPdf(report, technique);
    const commands = pdfCommands(pdf);
    expect(commands).toContain('PERFORMED CR RESULT SUMMARY');
    expect(commands).toContain('CR RT');
  });
});
