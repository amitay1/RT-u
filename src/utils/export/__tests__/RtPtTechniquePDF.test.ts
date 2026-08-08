import { describe, expect, it } from 'vitest';
import { reconcileRtPtApprovedContent } from '@/lib/rtPtApprovalLifecycle';
import { fingerprintRtPtApprovedContent } from '@/lib/rtPtDocumentCodec';
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

const getSetupMapFontSizes = (
  pdf: ReturnType<typeof buildRtPtTechniquePdf>,
  setupHeading: string,
): { pageCount: number; fontSizes: number[] } => {
  const pages = (pdf.internal as unknown as { pages: Array<string[] | undefined> }).pages;
  const setupPages = pages.filter((page): page is string[] => (
    Boolean(page?.some((command) => command.includes(`(${setupHeading}) Tj`)))
  ));
  const fontSizes = setupPages.flatMap((page) => page.flatMap((command) => (
    [...command.matchAll(/\/F\d+\s+([\d.]+)\s+Tf/g)].map((match) => Number(match[1]))
  )));

  return { pageCount: setupPages.length, fontSizes };
};

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
    const pdfCommands = JSON.stringify((pdf.internal as unknown as { pages: string[][] }).pages);
    expect(pdfCommands).toContain('DRAFT - UNCONTROLLED');
    expect(pdfCommands).toContain('NDT TECHNIQUE SHEET');
    expect(pdfCommands).toContain('TECHNIQUE OVERVIEW');
    expect(pdfCommands).toContain('EXPOSURE PLAN OVERVIEW');
    expect(pdfCommands).toContain('EXPOSURE SETUP MAP - V1');
    expect(pdfCommands).toContain('SCHEMATIC / NOT TO SCALE');
    expect(pdfCommands).toContain('SFD - 110 mm');
    expect(pdfCommands).toContain('NUMERIC CONTROLLED VIEW VALUES GOVERN');
    expect(pdfCommands).toContain('PLANNED / REQUIRED TECHNIQUE VALUES');
    expect(pdfCommands).not.toContain('SIGNATURE');
  });

  it('keeps Film and DDA setup-map typography at a printable 6 pt minimum', () => {
    const filmPdf = buildRtPtTechniquePdf(createCompleteFilmDocument());
    const filmSetup = getSetupMapFontSizes(filmPdf, 'FILM EXPOSURE SETUP');
    expect(filmSetup.pageCount).toBe(4);
    expect(filmSetup.fontSizes.length).toBeGreaterThan(0);
    expect(Math.min(...filmSetup.fontSizes)).toBeGreaterThanOrEqual(6);

    const digitalPdf = buildRtPtTechniquePdf(createCompleteDigitalDocument());
    const digitalSetup = getSetupMapFontSizes(digitalPdf, 'DDA ACQUISITION SETUP');
    expect(digitalSetup.pageCount).toBe(2);
    expect(digitalSetup.fontSizes.length).toBeGreaterThan(0);
    expect(Math.min(...digitalSetup.fontSizes)).toBeGreaterThanOrEqual(6);
  });

  it('exports PS811000E calculations as paraphrased numeric planning aids', () => {
    const document = createCompletePs811000FilmDocument();
    document.technique.filmSystem.viewingMode = 'superimposed';
    document.technique.filmSystem.individualFilmDensityMinimum = 1;
    const serialized = serializeSections(document);
    expect(serialized).toContain('PS811000E C1 Applicability');
    expect(serialized).toContain('Table 8 Maximum Ug');
    expect(serialized).toContain('Figure 2 Approximate Energy');
    expect(serialized).toContain('Calculated Exposure Product');
    expect(serialized).toContain('600 mAs');
    expect(serialized).toContain('Machine Technique Table Reference');
    expect(serialized).toContain('Figure 1 Approximate Readable Density');
    expect(serialized).toContain('Calculated IQI Sensitivity');
    expect(serialized).toContain('Planned Individual Film Density Minimum');
    expect(serialized).toContain('1 H&D');
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
    expect(serialized).toContain('Structured Planned DR Part Definition');
    expect(serialized).toContain('Immutable X-ray Source Catalog Snapshot');
    expect(serialized).toContain('Immutable Detector Catalog Snapshot');
    expect(serialized).toContain('Calculated DR Geometry, FOV, Orientation, and Coverage');
    expect(serialized).toContain('Calculated EXP-001 Grid Placement');
    expect(serialized).toContain('Structured Required IQI Rule Basis and Zone Outputs');
    expect(serialized).toContain('IQI Zone Output 1 Shim / Governing / Override');
    expect(serialized).toContain('Controlled Processing Policy and Viewing Presets');
    expect(serialized).toContain('Controlled Acceptance Profile Library');
    expect(serialized).toContain('Structured IQI Output Link');
    expect(serialized).toContain('Optional Representative-image Metadata');
    expect(serialized).toContain('Representative-image SHA-256');
    expect(serialized).toContain('IA 1 Viewing Preset / Acceptance Profile');
    expect(serialized).toContain('VP-01');
    expect(serialized).toContain('AC-01');
    expect(serialized).not.toContain('achieved');
    const pdf = buildRtPtTechniquePdf(document, validateRtPtDocument(document));
    const pdfCommands = JSON.stringify((pdf.internal as unknown as { pages: string[][] }).pages);
    expect(pdfCommands).toContain('STATIC ACQUISITION PLAN OVERVIEW');
    expect(pdfCommands).toContain('ACQUISITION SETUP MAP - EXP-001');
    expect(pdfCommands).toContain('SDD - 110 mm');
    expect(pdfCommands).toContain('DDA DETECTOR');
  });

  it('marks missing structured Digital planning as legacy draft-only output', () => {
    const document = createCompleteDigitalDocument();
    delete document.technique.planning;

    const serialized = serializeSections(document);
    expect(serialized).toContain('Structured Digital Planning');
    expect(serialized).toContain('controlled approval and release are blocked');
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

    const pdf = buildRtPtTechniquePdf(createCompletePtDocument('D', 'Type I'));
    const pdfCommands = JSON.stringify((pdf.internal as unknown as { pages: string[][] }).pages);
    expect(pdfCommands).toContain('PLANNED PENETRANT PROCESS SEQUENCE');
    expect(pdfCommands).toContain('METHOD D REMOVAL');
    expect(pdfCommands).toContain('10 % concentration');
    expect(pdfCommands).toContain('Immersion application');
  });

  it('keeps stale inactive Film and PT branches out of overview and schedule rendering', () => {
    const film = createCompleteFilmDocument();
    film.technique.source.sourceType = '';
    film.technique.source.gamma.isotope = 'STALE-GAMMA-SUMMARY';
    film.technique.source.gamma.sourceId = 'STALE-GAMMA-ID';
    const filmPdf = buildRtPtTechniquePdf(film);
    const filmCommands = JSON.stringify((filmPdf.internal as unknown as { pages: string[][] }).pages);
    expect(filmCommands).not.toContain('STALE-GAMMA-SUMMARY');
    expect(filmCommands).not.toContain('STALE-GAMMA-ID');

    const pt = createCompletePtDocument('D', 'Type I');
    pt.technique.materials.penetrantType = '';
    pt.technique.conditions.uvAUnit = 'STALE-UV-UNIT';
    pt.technique.conditions.visibleLightUnit = 'STALE-VISIBLE-UNIT';
    const ptPdf = buildRtPtTechniquePdf(pt);
    const ptCommands = JSON.stringify((ptPdf.internal as unknown as { pages: string[][] }).pages);
    expect(ptCommands).not.toContain('STALE-UV-UNIT');
    expect(ptCommands).not.toContain('STALE-VISIBLE-UNIT');
  });

  it('keeps long cover previews on page one and preserves full content in governance', () => {
    const document = createCompleteFilmDocument();
    const longText = 'LONG-CONTROLLED-CONTENT '.repeat(18).trim();
    document.documentControl.title = longText;
    document.documentControl.changeSummary = longText;
    document.organization.name = longText;
    document.job.customer = longText;
    document.controlledReferences = [0, 1, 2].map((index) => ({
      type: `Reference ${index + 1}`,
      title: longText,
      number: `LONG-REF-${index + 1}`,
      revision: 'A',
      clauseOrNote: longText,
    }));
    document.approvals = [
      { ...document.approvals[0], name: longText, certificationBasis: longText },
      { ...document.approvals[0], role: 'reviewed', name: longText, certificationBasis: longText },
      { ...document.approvals[0], role: 'prepared', name: longText, certificationBasis: longText },
    ];

    const pdf = buildRtPtTechniquePdf(document);
    const pages = (pdf.internal as unknown as { pages: string[][] }).pages;
    const cover = JSON.stringify(pages[1]);
    const firstContinuation = JSON.stringify(pages[2]);
    const allPages = JSON.stringify(pages);
    expect(cover).toContain('CONTROLLED REFERENCES PREVIEW');
    expect(cover).toContain('APPROVAL RECORD PREVIEW');
    expect(cover).toContain('+2 additional controlled reference');
    expect(cover).toContain('+2 additional approval record');
    expect(firstContinuation).toContain('TECHNIQUE OVERVIEW');
    expect(firstContinuation).not.toContain('APPROVAL RECORD PREVIEW');
    expect(allPages).toContain('DOCUMENT GOVERNANCE AND APPROVAL RECORDS');
    expect(allPages).toContain('LONG-CONTROLLED-CONTENT');
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

  it('labels superseded copies consistently across watermark and filename', () => {
    const superseded = createCompleteFilmDocument('superseded');

    expect(getRtPtPdfReleaseState(superseded)).toEqual({
      controlledRelease: false,
      watermark: 'SUPERSEDED - UNCONTROLLED',
      filenamePrefix: 'SUPERSEDED-UNCONTROLLED-',
    });
    expect(getRtPtTechniquePdfFilename(superseded)).toMatch(/^SUPERSEDED-UNCONTROLLED-/);

    const pdf = buildRtPtTechniquePdf(superseded);
    const commands = JSON.stringify((pdf.internal as unknown as { pages: string[][] }).pages);
    expect(commands).toContain('SUPERSEDED - UNCONTROLLED');
    expect(commands).toContain('SUPERSEDED / UNCONTROLLED');
    expect(commands).not.toContain('DRAFT - UNCONTROLLED');
  });

  it.each([
    ['Film RT', () => createCompleteFilmDocument('approved')],
    ['DDA RT', () => createCompleteDigitalDocument('approved')],
    ['PT', () => createCompletePtDocument('D', 'Type I', 'approved')],
  ])('fails closed before exporting a still-valid edited %s approval', (_label, createDocument) => {
    const approved = createDocument();
    const baseline = fingerprintRtPtApprovedContent(approved);
    const edited = structuredClone(approved);
    edited.technique.techniqueNotes = 'Revised planned instruction that remains otherwise complete.';

    expect(validateRtPtDocument(edited).approvalReadiness.isReady).toBe(true);
    expect(getRtPtPdfReleaseState(edited).controlledRelease).toBe(false);
    expect(getRtPtTechniquePdfFilename(edited)).toMatch(/^DRAFT-UNCONTROLLED-/);
    const rawEditedPdf = buildRtPtTechniquePdf(edited);
    const rawEditedCommands = JSON.stringify((rawEditedPdf.internal as unknown as { pages: string[][] }).pages);
    expect(rawEditedCommands).toContain('DRAFT - UNCONTROLLED');
    expect(rawEditedCommands).not.toContain('CONTROLLED RELEASE');

    const reconciled = reconcileRtPtApprovedContent(edited, baseline);
    expect(reconciled).toMatchObject({
      invalidated: true,
      document: { status: 'draft', approvals: [] },
    });
    expect(getRtPtPdfReleaseState(reconciled.document).controlledRelease).toBe(false);
    expect(getRtPtTechniquePdfFilename(reconciled.document)).toMatch(/^DRAFT-UNCONTROLLED-/);

    const pdf = buildRtPtTechniquePdf(reconciled.document);
    const commands = JSON.stringify((pdf.internal as unknown as { pages: string[][] }).pages);
    expect(commands).toContain('DRAFT - UNCONTROLLED');
    expect(commands).not.toContain('CONTROLLED RELEASE');
  });

  it('fails closed when an otherwise approval-ready raw document has no persisted binding', () => {
    const approved = createCompleteFilmDocument('approved');
    const { approvalFingerprint: _binding, ...withoutBinding } = approved;
    const rawApproved = withoutBinding as typeof approved;

    expect(validateRtPtDocument(rawApproved).approvalReadiness.isReady).toBe(true);
    expect(getRtPtPdfReleaseState(rawApproved).controlledRelease).toBe(false);
    expect(getRtPtTechniquePdfFilename(rawApproved)).toMatch(/^DRAFT-UNCONTROLLED-/);
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
