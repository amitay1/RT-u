import { describe, expect, it } from 'vitest';
import { validateRtPtDocument } from '@/lib/rtPtValidation';
import {
  buildRtPtTechniquePdf,
  getRtPtExportSections,
  getRtPtPdfReleaseState,
  getRtPtTechniquePdfFilename,
} from '@/utils/export/RtPtTechniquePDF';
import {
  createCompleteDigitalDocument,
  createCompleteFilmDocument,
  createCompletePs811000FilmDocument,
  createCompletePtDocument,
} from '@/lib/__tests__/rtPtV3Fixtures';

const serializeSections = (document: Parameters<typeof getRtPtExportSections>[0]): string => (
  JSON.stringify(getRtPtExportSections(document))
);

describe('RT/PT V3 controlled PDF export', () => {
  it('labels controlled values as Planned/Required and emits all four Film views', () => {
    const document = createCompleteFilmDocument();
    const sections = getRtPtExportSections(document);
    const serialized = JSON.stringify(sections);
    expect(serialized).toContain('Planned Tube Voltage');
    expect(serialized).toContain('Required Acceptance Text');
    expect(serialized).toContain('Required Density Range');
    expect(serialized).toContain('Calculated Ug');
    expect(sections.filter((section) => section.title.startsWith('Exposure View '))).toHaveLength(4);
    expect(serialized).not.toContain('Achieved');
    expect(serialized).not.toContain('Accept / Reject');
  });

  it('paginates four detailed Film view tables with repeated controlled headers', () => {
    const document = createCompleteFilmDocument();
    const pdf = buildRtPtTechniquePdf(document, validateRtPtDocument(document));
    expect(pdf.getNumberOfPages()).toBeGreaterThan(4);
    expect(String(pdf.output())).toContain('DRAFT - UNCONTROLLED');
  });

  it('exports PS811000E calculations as paraphrased numeric planning aids', () => {
    const document = createCompletePs811000FilmDocument();
    const serialized = serializeSections(document);
    expect(serialized).toContain('PS811000E C1 Applicability');
    expect(serialized).toContain('Table 8 Maximum Ug');
    expect(serialized).toContain('Figure 2 Approximate Energy');
    expect(serialized).toContain('Calculated Exposure Product');
    expect(serialized).toContain('600 mAs');
    expect(serialized).toContain('Machine Technique Table Reference');
    expect(serialized).toContain('Figure 1 Approximate Readable Density');
    expect(serialized).toContain('Calculated IQI Sensitivity');
  });

  it('exports multiple static DDA acquisitions, millisecond integration, and planned IQ requirements', () => {
    const document = createCompleteDigitalDocument();
    const sections = getRtPtExportSections(document);
    const serialized = JSON.stringify(sections);
    expect(sections.filter((section) => section.title.startsWith('DDA Acquisition '))).toHaveLength(2);
    expect(serialized).toContain('Planned Integration Time');
    expect(serialized).toContain('1 ms');
    expect(serialized).toContain('Required SNR / Normalized SNR');
    expect(serialized).toContain('Required Contrast Sensitivity / CNR');
    expect(serialized).toContain('Calculated Ug');
    expect(serialized).not.toContain('achieved');
  });

  it('includes migration warnings/count/categories but never quarantine paths or values', () => {
    const document = {
      ...createCompleteFilmDocument(),
      migration: {
        sourceSchemaVersion: 2 as const,
        warnings: ['MIGRATION-WARNING-SECRET'],
        quarantine: [
          {
            sourcePath: 'legacy.identification.result',
            reason: 'performed-result' as const,
            value: 'PERFORMED-RESULT-SECRET',
          },
          {
            sourcePath: 'legacy.iqc.opticalDensityMin',
            reason: 'performed-result' as const,
            value: 2.75,
          },
          {
            sourcePath: 'legacy.iqc.cnr',
            reason: 'performed-result' as const,
            value: 9.9,
          },
        ],
      },
    };
    const validation = validateRtPtDocument(document);
    expect(validation.issues.some((issue) => issue.scope === 'migration')).toBe(true);
    expect(validation.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ label: 'Migration Review', message: 'MIGRATION-WARNING-SECRET' }),
      expect.objectContaining({
        label: 'Migration Summary',
        message: expect.stringContaining('performed-result: 3'),
      }),
    ]));
    const sections = serializeSections(document);
    expect(sections).not.toContain('MIGRATION-WARNING-SECRET');
    expect(sections).not.toContain('PERFORMED-RESULT-SECRET');
    expect(sections).not.toContain('opticalDensityMin');
    expect(sections).not.toContain('legacy.iqc.cnr');
    const pdf = buildRtPtTechniquePdf(document, validation);
    const pdfCommands = JSON.stringify((pdf.internal as unknown as { pages: string[][] }).pages);
    expect(pdfCommands).toContain('MIGRATION-WARNING-SECRET');
    expect(pdfCommands).toContain('3 quarantined field');
    expect(pdfCommands).toContain('performed-result: 3');
    expect(pdfCommands).not.toContain('PERFORMED-RESULT-SECRET');
    expect(pdfCommands).not.toContain('legacy.identification.result');
    expect(pdfCommands).not.toContain('opticalDensityMin');
    expect(pdfCommands).not.toContain('legacy.iqc.cnr');
  });

  it('exports only the active PT method and penetrant-type branches', () => {
    const methodB = serializeSections(createCompletePtDocument('B', 'Type I'));
    expect(methodB).toContain('Post-emulsification Water-rinse Instructions');
    expect(methodB).not.toContain('Hydrophilic Emulsifier Concentration');
    expect(methodB).toContain('Required UV-A Minimum');
    expect(methodB).not.toContain('Required White Light Minimum');

    const methodD = serializeSections(createCompletePtDocument('D', 'Type I'));
    expect(methodD).toContain('Hydrophilic Emulsifier Concentration');
    expect(methodD).toContain('Method D Pre-rinse Instructions');
    expect(methodD).toContain('Method D Final-rinse Instructions');

    const typeTwo = serializeSections(createCompletePtDocument('C', 'Type II'));
    expect(typeTwo).toContain('Required White Light Minimum');
    expect(typeTwo).not.toContain('Required UV-A Minimum');
    expect(typeTwo).not.toContain('Required Sensitivity Level');
  });

  it('retains draft watermark behavior and releases only approval-ready approved documents', () => {
    const draft = createCompleteFilmDocument('draft');
    const draftValidation = validateRtPtDocument(draft);
    expect(getRtPtPdfReleaseState(draft, draftValidation)).toEqual({
      controlledRelease: false,
      watermark: 'DRAFT - UNCONTROLLED',
      filenamePrefix: 'DRAFT-UNCONTROLLED-',
    });
    expect(getRtPtTechniquePdfFilename(draft, draftValidation)).toMatch(/^DRAFT-UNCONTROLLED-/);

    const approved = createCompleteFilmDocument('approved');
    const approvedValidation = validateRtPtDocument(approved);
    expect(approvedValidation.approvalReadiness.isReady).toBe(true);
    expect(getRtPtPdfReleaseState(approved, approvedValidation)).toMatchObject({
      controlledRelease: true,
      watermark: null,
    });
    expect(getRtPtTechniquePdfFilename(approved, approvedValidation)).not.toMatch(/^DRAFT/);
  });

  it('recomputes validation and rejects a caller-spoofed controlled release', () => {
    const approved = createCompleteFilmDocument('approved');
    const spoofedReadySummary = validateRtPtDocument(approved);
    spoofedReadySummary.issues = [{
      path: 'spoofed',
      label: 'SPOOFED FINDING',
      tab: 'control',
      message: 'CALLER-CONTROLLED-FINDING',
      severity: 'warning',
      scope: 'approval',
    }];
    const tampered = createCompleteFilmDocument('approved');
    tampered.approvals = [];
    tampered.documentControl.number = 'X';

    expect(spoofedReadySummary.approvalReadiness.isReady).toBe(true);
    expect(getRtPtPdfReleaseState(tampered, spoofedReadySummary)).toEqual({
      controlledRelease: false,
      watermark: 'DRAFT - UNCONTROLLED',
      filenamePrefix: 'DRAFT-UNCONTROLLED-',
    });
    expect(getRtPtTechniquePdfFilename(tampered, spoofedReadySummary)).toMatch(/^DRAFT-UNCONTROLLED-/);
    const pdf = buildRtPtTechniquePdf(tampered, spoofedReadySummary);
    const pdfCommands = JSON.stringify((pdf.internal as unknown as { pages: string[][] }).pages);
    expect(pdfCommands).toContain('DRAFT - UNCONTROLLED');
    expect(pdfCommands).toContain('NOT READY');
    expect(pdfCommands).toContain('NDT Level III Approval');
    expect(pdfCommands).not.toContain('CALLER-CONTROLLED-FINDING');
  });

  it('never releases an approved document while migration metadata remains', () => {
    const approved = createCompleteFilmDocument('approved');
    const spoofedReadySummary = validateRtPtDocument(approved);
    approved.migration = {
      sourceSchemaVersion: 1,
      warnings: ['Migration acknowledgement required.'],
      quarantine: [],
    };

    expect(getRtPtPdfReleaseState(approved, spoofedReadySummary).controlledRelease).toBe(false);
    expect(getRtPtTechniquePdfFilename(approved, spoofedReadySummary)).toMatch(/^DRAFT-UNCONTROLLED-/);
  });
});
