import { GState, jsPDF } from 'jspdf';
import autoTable, { type RowInput } from 'jspdf-autotable';
import { fingerprintRtPtInspectionReportContent } from '@/lib/rtPtInspectionReportLifecycle';
import {
  validateRtPtInspectionReport,
  type RtPtInspectionReportValidation,
} from '@/lib/rtPtInspectionReportValidation';
import type { RtPtDocumentV3 } from '@/types/rtPtDocument';
import type {
  RtPtInspectionReportV1,
  RtPtReportApprovalRole,
} from '@/types/rtPtInspectionReport';

type PdfColor = [number, number, number];
type PdfRow = [string, string];
type AutoTableOptions = Parameters<typeof autoTable>[1];

export interface RtPtInspectionReportPdfReleaseState {
  controlledRelease: boolean;
  watermark: 'DRAFT - UNCONTROLLED' | 'SUPERSEDED - UNCONTROLLED' | null;
  filenamePrefix: 'DRAFT-UNCONTROLLED-' | 'SUPERSEDED-UNCONTROLLED-' | '';
}

const METHOD_TITLE = {
  'RT-Film': 'Radiographic Testing - Film',
  'RT-Digital': 'Radiographic Testing - Digital Detector Array',
  PT: 'Liquid Penetrant Testing',
} as const;

const METHOD_CODE = {
  'RT-Film': 'FILM RT',
  'RT-Digital': 'DDA RT',
  PT: 'PT',
} as const;

const APPROVAL_ROLE_LABEL: Record<RtPtReportApprovalRole, string> = {
  performed: 'Performed by',
  reviewed: 'Independent review',
  quality: 'Quality review',
  'ndt-level-3': 'NDT Level III',
};

const PDF_THEME = {
  navy: [17, 39, 58] as PdfColor,
  navySoft: [31, 58, 78] as PdfColor,
  steel: [43, 91, 118] as PdfColor,
  steelSoft: [92, 126, 145] as PdfColor,
  ink: [27, 43, 54] as PdfColor,
  muted: [91, 105, 114] as PdfColor,
  line: [199, 210, 217] as PdfColor,
  panel: [238, 243, 246] as PdfColor,
  panelAlt: [248, 250, 251] as PdfColor,
  white: [255, 255, 255] as PdfColor,
  amber: [161, 99, 34] as PdfColor,
  amberSoft: [249, 240, 226] as PdfColor,
  green: [48, 105, 88] as PdfColor,
  greenSoft: [229, 241, 236] as PdfColor,
  red: [148, 66, 57] as PdfColor,
  redSoft: [248, 235, 232] as PdfColor,
};

const PDF_MARGIN = 14;
const PDF_CONTENT_TOP = 31;
const PDF_SECTION_GAP = 4;

const hasValue = (value: string | number | boolean | null | undefined): boolean => (
  value !== '' && value !== null && value !== undefined
);

const formatValue = (
  value: string | number | boolean | null | undefined,
  unit?: string,
): string => {
  if (!hasValue(value)) return 'Not specified';
  const formatted = typeof value === 'boolean' ? (value ? 'Yes' : 'No') : String(value);
  return unit && unit.trim() ? `${formatted} ${unit}` : formatted;
};

const formatIdentity = (
  ...values: Array<string | number | boolean | null | undefined>
): string => {
  const present = values.filter(hasValue).map(String);
  return present.length > 0 ? present.join(' / ') : 'Not specified';
};

const formatRange = (
  minimum: string | number,
  maximum: string | number,
  unit: string,
): string => {
  if (!hasValue(minimum) && !hasValue(maximum)) return 'Not specified';
  if (!hasValue(minimum)) return `Up to ${formatValue(maximum, unit)}`;
  if (!hasValue(maximum)) return `From ${formatValue(minimum, unit)}`;
  return `${formatValue(minimum, unit)} to ${formatValue(maximum, unit)}`;
};

const formatBooleanRecord = (value: boolean | ''): string => {
  if (value === '') return 'Not recorded';
  return value ? 'Confirmed' : 'Not confirmed';
};

const formatRequirementAssessment = (value: boolean | ''): string => {
  if (value === '') return 'NOT RECORDED';
  return value ? 'MET' : 'NOT MET';
};

const formatCode = (value: string): string => (
  value ? value.replace(/-/g, ' ').toUpperCase() : 'NOT SPECIFIED'
);

const formatDocumentId = (value: string): string => {
  const uuid = /^([^-]+-[^-]+-[^-]+)-([^-]+-[^-]+)$/.exec(value);
  return uuid ? `${uuid[1]}\n${uuid[2]}` : formatValue(value);
};

const formatFingerprintReference = (value: string): string => {
  if (!value) return 'Not specified';
  const sha256 = /^sha256:([a-f0-9]{64})$/i.exec(value);
  if (sha256) {
    return `SHA-256\n${sha256[1].match(/.{1,16}/g)?.join(' ') ?? sha256[1]}`;
  }
  if (value.length <= 96) return value;
  return `Legacy approval-basis snapshot (${value.length} characters)`;
};

const safeFileToken = (value: string): string => (
  value.trim().replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'untitled'
);

const reportApprovalSnapshotCurrent = (report: RtPtInspectionReportV1): boolean => {
  if (!report.approvalFingerprint) return false;
  try {
    return report.approvalFingerprint === fingerprintRtPtInspectionReportContent(report);
  } catch {
    return false;
  }
};

export function getRtPtInspectionReportPdfReleaseState(
  report: RtPtInspectionReportV1,
  technique: RtPtDocumentV3,
  callerValidation?: RtPtInspectionReportValidation,
): RtPtInspectionReportPdfReleaseState {
  void callerValidation;
  const validation = validateRtPtInspectionReport(report, technique);
  const controlledRelease = report.status === 'approved'
    && validation.isApprovalReady
    && reportApprovalSnapshotCurrent(report);
  const superseded = report.status === 'superseded';
  return {
    controlledRelease,
    watermark: controlledRelease
      ? null
      : superseded ? 'SUPERSEDED - UNCONTROLLED' : 'DRAFT - UNCONTROLLED',
    filenamePrefix: controlledRelease
      ? ''
      : superseded ? 'SUPERSEDED-UNCONTROLLED-' : 'DRAFT-UNCONTROLLED-',
  };
}

export function getRtPtInspectionReportPdfFilename(
  report: RtPtInspectionReportV1,
  technique: RtPtDocumentV3,
  callerValidation?: RtPtInspectionReportValidation,
): string {
  void callerValidation;
  const release = getRtPtInspectionReportPdfReleaseState(report, technique);
  const identity = report.reportControl.number || report.part.partNumber || report.reportId;
  const revision = report.reportControl.revision
    ? `-REV-${safeFileToken(report.reportControl.revision)}`
    : '';
  return `RTPT-REPORT-${release.filenamePrefix}${safeFileToken(report.method)}-${safeFileToken(identity)}${revision}.pdf`;
}

const releaseLabel = (
  report: RtPtInspectionReportV1,
  release: RtPtInspectionReportPdfReleaseState,
): string => {
  if (release.controlledRelease) return 'CONTROLLED REPORT';
  if (report.status === 'superseded') return 'SUPERSEDED / UNCONTROLLED';
  return 'DRAFT / UNCONTROLLED';
};

const getLastTableY = (pdf: jsPDF): number => (
  (pdf as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY
);

const contentBottom = (pdf: jsPDF): number => pdf.internal.pageSize.getHeight() - 19;

const ensureContentSpace = (pdf: jsPDF, y: number, requiredHeight: number): number => {
  if (y + requiredHeight <= contentBottom(pdf)) return y;
  pdf.addPage();
  return PDF_CONTENT_TOP;
};

const truncateToWidth = (pdf: jsPDF, value: string, width: number): string => {
  if (pdf.getTextWidth(value) <= width) return value;
  let result = value;
  while (result.length > 1 && pdf.getTextWidth(`${result}...`) > width) {
    result = result.slice(0, -1);
  }
  return `${result}...`;
};

const splitWithEllipsis = (
  pdf: jsPDF,
  value: string,
  width: number,
  maximumLines: number,
): string[] => {
  const lines = pdf.splitTextToSize(value, width) as string[];
  if (lines.length <= maximumLines) return lines;
  const visible = lines.slice(0, maximumLines);
  visible[maximumLines - 1] = truncateToWidth(pdf, lines.slice(maximumLines - 1).join(' '), width);
  return visible;
};

const pairedTableRows = (rows: PdfRow[]): RowInput[] => {
  const body: RowInput[] = [];
  for (let index = 0; index < rows.length; index += 2) {
    const left = rows[index];
    const right = rows[index + 1];
    body.push(right
      ? [left[0].toUpperCase(), left[1], right[0].toUpperCase(), right[1]]
      : [left[0].toUpperCase(), left[1], { content: '', colSpan: 2 }]);
  }
  return body;
};

const renderPairedSection = (
  pdf: jsPDF,
  sectionNumber: number,
  title: string,
  rows: PdfRow[],
  startY: number,
): number => {
  const y = ensureContentSpace(pdf, startY, 24);
  autoTable(pdf, {
    startY: y,
    head: [[{ content: `${String(sectionNumber).padStart(2, '0')}  ${title.toUpperCase()}`, colSpan: 4 }]],
    body: pairedTableRows(rows),
    margin: { left: PDF_MARGIN, right: PDF_MARGIN, top: PDF_CONTENT_TOP, bottom: 20 },
    theme: 'grid',
    pageBreak: 'avoid',
    showHead: 'everyPage',
    rowPageBreak: 'avoid',
    styles: {
      font: 'helvetica',
      fontSize: 8,
      textColor: PDF_THEME.ink,
      lineColor: PDF_THEME.line,
      lineWidth: 0.18,
      cellPadding: { top: 2.1, right: 2.2, bottom: 2.1, left: 2.2 },
      overflow: 'linebreak',
      valign: 'middle',
    },
    headStyles: {
      fillColor: PDF_THEME.steel,
      textColor: PDF_THEME.white,
      fontStyle: 'bold',
      fontSize: 9,
      cellPadding: { top: 2.2, right: 2.5, bottom: 2.2, left: 2.5 },
    },
    columnStyles: {
      0: { cellWidth: 33, fillColor: PDF_THEME.panel, textColor: PDF_THEME.muted, fontStyle: 'bold', fontSize: 6.8 },
      1: { cellWidth: 58 },
      2: { cellWidth: 33, fillColor: PDF_THEME.panel, textColor: PDF_THEME.muted, fontStyle: 'bold', fontSize: 6.8 },
      3: { cellWidth: 58 },
    },
  });
  return getLastTableY(pdf) + PDF_SECTION_GAP;
};

const renderDataTableSection = (
  pdf: jsPDF,
  sectionNumber: number,
  title: string,
  columns: RowInput,
  rows: RowInput[],
  startY: number,
  columnStyles?: AutoTableOptions['columnStyles'],
): number => {
  const y = ensureContentSpace(pdf, startY, 20);
  const sectionLabel = `${String(sectionNumber).padStart(2, '0')}  ${title.toUpperCase()}`;
  const columnCount = Array.isArray(columns) ? columns.length : Object.keys(columns).length;
  autoTable(pdf, {
    startY: y,
    head: [
      [{
        content: sectionLabel,
        colSpan: columnCount,
        styles: {
          fillColor: PDF_THEME.steel,
          textColor: PDF_THEME.white,
          fontStyle: 'bold',
          fontSize: 9,
          cellPadding: { top: 2.2, right: 2.5, bottom: 2.2, left: 2.5 },
        },
      }],
      columns,
    ],
    body: rows,
    margin: { left: PDF_MARGIN, right: PDF_MARGIN, top: PDF_CONTENT_TOP, bottom: 20 },
    theme: 'grid',
    pageBreak: rows.length <= 4 ? 'avoid' : 'auto',
    showHead: 'everyPage',
    rowPageBreak: 'avoid',
    styles: {
      font: 'helvetica',
      fontSize: 7.6,
      textColor: PDF_THEME.ink,
      lineColor: PDF_THEME.line,
      lineWidth: 0.18,
      cellPadding: { top: 2, right: 1.8, bottom: 2, left: 1.8 },
      overflow: 'linebreak',
      valign: 'top',
    },
    headStyles: {
      fillColor: PDF_THEME.panel,
      textColor: PDF_THEME.ink,
      fontStyle: 'bold',
      fontSize: 7,
      valign: 'middle',
    },
    alternateRowStyles: { fillColor: PDF_THEME.panelAlt },
    columnStyles,
  });
  return getLastTableY(pdf) + PDF_SECTION_GAP;
};

const renderCoverHeading = (pdf: jsPDF, label: string, y: number): void => {
  pdf.setDrawColor(...PDF_THEME.steelSoft);
  pdf.setLineWidth(0.7);
  pdf.line(PDF_MARGIN, y + 1.8, PDF_MARGIN + 5, y + 1.8);
  pdf.setTextColor(...PDF_THEME.steel);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(7.2);
  pdf.text(label.toUpperCase(), PDF_MARGIN + 8, y + 2.7);
};

const renderCoverGrid = (pdf: jsPDF, rows: PdfRow[], startY: number): number => {
  autoTable(pdf, {
    startY,
    body: pairedTableRows(rows),
    margin: { left: PDF_MARGIN, right: PDF_MARGIN },
    theme: 'grid',
    pageBreak: 'avoid',
    rowPageBreak: 'avoid',
    styles: {
      font: 'helvetica',
      fontSize: 7.7,
      textColor: PDF_THEME.ink,
      lineColor: PDF_THEME.line,
      lineWidth: 0.18,
      cellPadding: { top: 1.55, right: 2, bottom: 1.55, left: 2 },
      overflow: 'ellipsize',
      valign: 'middle',
    },
    columnStyles: {
      0: { cellWidth: 38, fillColor: PDF_THEME.panel, textColor: PDF_THEME.muted, fontStyle: 'bold', fontSize: 6.1 },
      1: { cellWidth: 53 },
      2: { cellWidth: 38, fillColor: PDF_THEME.panel, textColor: PDF_THEME.muted, fontStyle: 'bold', fontSize: 6.1 },
      3: { cellWidth: 53 },
    },
  });
  return getLastTableY(pdf);
};

const renderReadinessCards = (
  pdf: jsPDF,
  validation: RtPtInspectionReportValidation,
  release: RtPtInspectionReportPdfReleaseState,
  y: number,
): number => {
  const pageWidth = pdf.internal.pageSize.getWidth();
  const gap = 3;
  const width = (pageWidth - PDF_MARGIN * 2 - gap * 2) / 3;
  const cards = [
    {
      label: 'REPORT COMPLETENESS',
      value: `${validation.completionPercent}%`,
      detail: `${validation.completedFieldsCount} of ${validation.totalRequiredFields} performed-data controls`,
      color: PDF_THEME.steel,
      fill: PDF_THEME.panel,
    },
    {
      label: 'TECHNIQUE LINK',
      value: validation.linkCurrent ? 'CURRENT' : 'NOT CURRENT',
      detail: validation.linkCurrent ? 'Approved technique basis verified' : 'Technique basis requires review',
      color: validation.linkCurrent ? PDF_THEME.green : PDF_THEME.amber,
      fill: validation.linkCurrent ? PDF_THEME.greenSoft : PDF_THEME.amberSoft,
    },
    {
      label: 'REPORT RELEASE',
      value: release.controlledRelease ? 'CONTROLLED' : 'UNCONTROLLED',
      detail: release.controlledRelease ? 'Approved controlled inspection record' : 'Working or historical copy',
      color: release.controlledRelease
        ? PDF_THEME.green
        : release.watermark === 'SUPERSEDED - UNCONTROLLED' ? PDF_THEME.red : PDF_THEME.amber,
      fill: release.controlledRelease
        ? PDF_THEME.greenSoft
        : release.watermark === 'SUPERSEDED - UNCONTROLLED' ? PDF_THEME.redSoft : PDF_THEME.amberSoft,
    },
  ];

  cards.forEach((card, index) => {
    const x = PDF_MARGIN + index * (width + gap);
    pdf.setFillColor(...card.fill);
    pdf.roundedRect(x, y, width, 21, 1.5, 1.5, 'F');
    pdf.setFillColor(...card.color);
    pdf.roundedRect(x, y, 1.8, 21, 1, 1, 'F');
    pdf.setTextColor(...PDF_THEME.muted);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(6.1);
    pdf.text(card.label, x + 5, y + 5.2);
    pdf.setTextColor(...card.color);
    pdf.setFontSize(10.8);
    pdf.text(card.value, x + 5, y + 11.5);
    pdf.setTextColor(...PDF_THEME.muted);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(6.1);
    pdf.text(pdf.splitTextToSize(card.detail, width - 8).slice(0, 2), x + 5, y + 16.1);
  });
  return y + 21;
};

const dispositionColor = (report: RtPtInspectionReportV1): { ink: PdfColor; fill: PdfColor } => {
  if (report.overallDisposition === 'accepted') return { ink: PDF_THEME.green, fill: PDF_THEME.greenSoft };
  if (report.overallDisposition === 'rejected') return { ink: PDF_THEME.red, fill: PDF_THEME.redSoft };
  return { ink: PDF_THEME.amber, fill: PDF_THEME.amberSoft };
};

const renderCover = (
  pdf: jsPDF,
  report: RtPtInspectionReportV1,
  validation: RtPtInspectionReportValidation,
  release: RtPtInspectionReportPdfReleaseState,
): void => {
  const pageWidth = pdf.internal.pageSize.getWidth();
  const title = report.reportControl.title || `${METHOD_TITLE[report.method]} Inspection Report`;

  pdf.setFillColor(...PDF_THEME.navy);
  pdf.rect(0, 0, pageWidth, 27, 'F');
  pdf.setFillColor(...PDF_THEME.steel);
  pdf.rect(0, 27, pageWidth, 1.6, 'F');
  pdf.setTextColor(...PDF_THEME.white);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(14);
  pdf.text('RT-PT', PDF_MARGIN, 11.5);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(7);
  pdf.text('INSPECTOR / CONTROLLED NDT WORKFLOW', PDF_MARGIN, 18);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(10.5);
  pdf.text(METHOD_CODE[report.method], pageWidth - PDF_MARGIN, 12, { align: 'right' });
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(7);
  pdf.text(METHOD_TITLE[report.method], pageWidth - PDF_MARGIN, 18, { align: 'right' });

  pdf.setTextColor(...PDF_THEME.steel);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(7.2);
  pdf.text('NDT INSPECTION REPORT - PERFORMED RESULTS', PDF_MARGIN, 37);
  pdf.setTextColor(...PDF_THEME.ink);
  pdf.setFontSize(16.5);
  const titleLines = splitWithEllipsis(pdf, title, 132, 2);
  pdf.text(titleLines, PDF_MARGIN, 45);

  const badgeColor = release.controlledRelease
    ? PDF_THEME.green
    : release.watermark === 'SUPERSEDED - UNCONTROLLED' ? PDF_THEME.red : PDF_THEME.amber;
  const badgeFill = release.controlledRelease
    ? PDF_THEME.greenSoft
    : release.watermark === 'SUPERSEDED - UNCONTROLLED' ? PDF_THEME.redSoft : PDF_THEME.amberSoft;
  pdf.setFillColor(...badgeFill);
  pdf.roundedRect(pageWidth - PDF_MARGIN - 48, 36.5, 48, 12, 1.8, 1.8, 'F');
  pdf.setTextColor(...badgeColor);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(6.7);
  pdf.text(releaseLabel(report, release), pageWidth - PDF_MARGIN - 24, 43.8, { align: 'center' });

  const titleBottom = 45 + titleLines.length * 6.5;
  pdf.setTextColor(...PDF_THEME.muted);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(7.2);
  pdf.text(`${METHOD_TITLE[report.method]} / ${report.status.toUpperCase()}`, PDF_MARGIN, titleBottom + 3);

  let y = Math.max(titleBottom + 8, 62);
  renderCoverHeading(pdf, 'Report control and inspection period', y);
  y = renderCoverGrid(pdf, [
    ['Report Number', formatValue(report.reportControl.number)],
    ['Revision', formatValue(report.reportControl.revision)],
    ['Report Date', formatValue(report.reportControl.reportDate)],
    ['Inspection Start', formatValue(report.reportControl.inspectionStart)],
    ['Inspection End', formatValue(report.reportControl.inspectionEnd)],
    ['Organization', formatValue(report.organization.name)],
    ['Site', formatValue(report.organization.site)],
    ['Customer', formatValue(report.job.customer)],
    ['Work Order', formatValue(report.part.workOrder || report.job.workOrder)],
    ['Purchase Order', formatValue(report.job.purchaseOrder)],
  ], y + 6);

  y += 6;
  renderCoverHeading(pdf, 'Approved technique traceability', y);
  y = renderCoverGrid(pdf, [
    ['Technique Number', formatValue(report.sourceTechnique.documentNumber)],
    ['Technique Revision', formatValue(report.sourceTechnique.revision)],
    ['Technique Title', formatValue(report.sourceTechnique.title)],
    ['Technique Approval Date', formatValue(report.sourceTechnique.approvalDate)],
    ['Technique Document ID', formatValue(report.sourceTechnique.documentId)],
    ['Technique Method', formatValue(report.sourceTechnique.method)],
    ['Basis Fingerprint', formatFingerprintReference(report.sourceTechnique.approvedContentFingerprint)],
    ['Link Status', validation.linkCurrent ? 'Current approved basis' : 'Review required'],
  ], y + 6);

  y += 6;
  renderCoverHeading(pdf, 'Part and lot traceability', y);
  y = renderCoverGrid(pdf, [
    ['Part Number', formatValue(report.part.partNumber)],
    ['Part Name', formatValue(report.part.partName)],
    ['Revision / Configuration', formatValue(report.part.partRevisionOrConfiguration)],
    ['Serial / Lot Number', formatValue(report.part.serialOrLotNumber)],
    ['Quantity', formatValue(report.part.quantity)],
    ['Material', formatValue(report.part.material)],
    ['Inspection Area', formatValue(report.part.inspectionArea)],
    ['Contract', formatValue(report.job.contract)],
  ], y + 6);

  y += 6;
  renderCoverHeading(pdf, 'Release readiness', y);
  y = renderReadinessCards(pdf, validation, release, y + 6);

  y += 6;
  renderCoverHeading(pdf, 'Explicit final disposition', y);
  const disposition = dispositionColor(report);
  pdf.setFillColor(...disposition.fill);
  pdf.roundedRect(PDF_MARGIN, y + 6, pageWidth - PDF_MARGIN * 2, 19, 1.5, 1.5, 'F');
  pdf.setFillColor(...disposition.ink);
  pdf.roundedRect(PDF_MARGIN, y + 6, 2, 19, 1, 1, 'F');
  pdf.setTextColor(...disposition.ink);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(11);
  pdf.text(formatCode(report.overallDisposition), PDF_MARGIN + 6, y + 13);
  pdf.setTextColor(...PDF_THEME.ink);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(6.9);
  pdf.text(
    splitWithEllipsis(pdf, `Reference: ${formatValue(report.dispositionReference)} / Coverage: ${formatValue(report.coverageStatement)}`, pageWidth - PDF_MARGIN * 2 - 12, 2),
    PDF_MARGIN + 6,
    y + 18,
  );
  y += 31;

  renderCoverHeading(pdf, 'Personnel and approval record preview', y);
  const approvalRows: RowInput[] = report.approvals.length > 0
    ? report.approvals.slice(0, 2).map((approval) => [
      APPROVAL_ROLE_LABEL[approval.role],
      formatIdentity(approval.name, approval.personnelId),
      formatIdentity(approval.certificationLevel, approval.certificationNumber, approval.certificationBasis),
      formatValue(approval.date),
    ])
    : [[{ content: 'No personnel or approval records entered.', colSpan: 4 }]];
  autoTable(pdf, {
    startY: y + 6,
    head: [['ROLE', 'NAME / PERSONNEL ID', 'CERTIFICATION RECORD', 'DATE']],
    body: approvalRows,
    margin: { left: PDF_MARGIN, right: PDF_MARGIN },
    theme: 'grid',
    pageBreak: 'avoid',
    rowPageBreak: 'avoid',
    styles: {
      font: 'helvetica',
      fontSize: 7,
      textColor: PDF_THEME.ink,
      lineColor: PDF_THEME.line,
      lineWidth: 0.18,
      cellPadding: { top: 1.5, right: 1.7, bottom: 1.5, left: 1.7 },
      overflow: 'ellipsize',
      valign: 'middle',
    },
    headStyles: { fillColor: PDF_THEME.navySoft, textColor: PDF_THEME.white, fontStyle: 'bold', fontSize: 6.4 },
    columnStyles: {
      0: { cellWidth: 31 },
      1: { cellWidth: 49 },
      2: { cellWidth: 73 },
      3: { cellWidth: 29 },
    },
  });
};

const traceabilityRows = (report: RtPtInspectionReportV1): PdfRow[] => [
  ['Report Identity', formatIdentity(report.reportControl.number, report.reportControl.title, `Rev ${formatValue(report.reportControl.revision)}`)],
  ['Report Date / Inspection Period', formatIdentity(report.reportControl.reportDate, report.reportControl.inspectionStart, report.reportControl.inspectionEnd)],
  ['Internal Report ID', formatDocumentId(report.reportId)],
  ['Report Status / Method', formatIdentity(report.status.toUpperCase(), METHOD_TITLE[report.method])],
  ['Technique Identity', formatIdentity(report.sourceTechnique.documentNumber, report.sourceTechnique.title, `Rev ${formatValue(report.sourceTechnique.revision)}`)],
  ['Technique Document ID', formatDocumentId(report.sourceTechnique.documentId)],
  ['Technique Approval Date', formatValue(report.sourceTechnique.approvalDate)],
  ['Approved Technique Fingerprint', formatFingerprintReference(report.sourceTechnique.approvedContentFingerprint)],
  ['Organization / Site', formatIdentity(report.organization.name, report.organization.site)],
  ['Customer / Job', formatIdentity(report.job.customer, report.job.contract, report.job.purchaseOrder, report.part.workOrder || report.job.workOrder)],
  ['Part Identity', formatIdentity(report.part.partNumber, report.part.partName, report.part.partRevisionOrConfiguration)],
  ['Serial / Lot / Quantity', formatIdentity(report.part.serialOrLotNumber, formatValue(report.part.quantity))],
  ['Material / Area', formatIdentity(report.part.material, report.part.inspectionArea)],
];

const equipmentRows = (report: RtPtInspectionReportV1): PdfRow[] => [
  ['Equipment Used', formatValue(report.equipment.equipmentUsed)],
  ['Calibration References', formatValue(report.equipment.calibrationReferences)],
  ['Environmental Conditions', formatValue(report.equipment.environmentalConditions)],
  ['Recorded Deviations', formatValue(report.equipment.deviations)],
];

const controlledReferenceRows = (
  references: RtPtInspectionReportV1['sourceTechnique']['controlledReferences'],
): RowInput[] => {
  if (references.length === 0) {
    return [[{ content: 'No frozen controlled-reference snapshot recorded. Recreate the editable report from the approved technique before controlled release.', colSpan: 4 }]];
  }
  return references.map((reference) => [
    formatValue(reference.type),
    formatIdentity(reference.number, reference.title),
    formatValue(reference.revision),
    formatValue(reference.clauseOrNote),
  ]);
};

const filmSourceValues = (
  result: Extract<RtPtInspectionReportV1, { method: 'RT-Film' }>['results'][number],
): [string, string] => {
  if (result.planned.sourceType === 'X-ray') {
    return [
      formatIdentity(
        formatValue(result.planned.tubeVoltage, result.planned.tubeVoltageUnit),
        formatValue(result.planned.tubeCurrent, result.planned.tubeCurrentUnit),
      ),
      formatIdentity(
        formatValue(result.actualTubeVoltage, result.actualTubeVoltageUnit),
        formatValue(result.actualTubeCurrent, result.actualTubeCurrentUnit),
      ),
    ];
  }
  if (result.planned.sourceType === 'Gamma') {
    return [
      'Gamma source per approved technique',
      formatValue(result.actualSourceActivity, result.actualSourceActivityUnit),
    ];
  }
  return ['Source type not specified', 'Not specified'];
};

const renderFilmResults = (
  pdf: jsPDF,
  report: Extract<RtPtInspectionReportV1, { method: 'RT-Film' }>,
  startSectionNumber: number,
  startY: number,
): { sectionNumber: number; y: number } => {
  let sectionNumber = startSectionNumber;
  const summaryRows: RowInput[] = report.results.length > 0
    ? report.results.map((result, index) => [
      formatValue(result.planned.viewId || index + 1),
      formatIdentity(result.filmId, result.retakeOfFilmId ? `Retake of ${result.retakeOfFilmId}` : ''),
      formatIdentity(result.planned.inspectionZone, result.planned.orientation),
      formatValue(result.exposureDate),
      formatBooleanRecord(result.coverageConfirmed),
      formatCode(result.result),
    ])
    : [[{ content: 'No performed film result rows entered.', colSpan: 6 }]];
  let y = renderDataTableSection(
    pdf,
    sectionNumber,
    'Performed film result summary',
    ['VIEW', 'FILM / RETAKE', 'ZONE / ORIENTATION', 'DATE', 'COVERAGE', 'RESULT'],
    summaryRows,
    startY,
    {
      0: { cellWidth: 17, fontStyle: 'bold', halign: 'center' },
      1: { cellWidth: 37 },
      2: { cellWidth: 43 },
      3: { cellWidth: 25 },
      4: { cellWidth: 28 },
      5: { cellWidth: 32, fontStyle: 'bold' },
    },
  );
  sectionNumber += 1;

  report.results.forEach((result, index) => {
    const [plannedSource, actualSource] = filmSourceValues(result);
    const rows: RowInput[] = [
      ['View / Inspection Zone', formatIdentity(result.planned.viewId, result.planned.description, result.planned.inspectionZone, result.planned.orientation), formatIdentity(result.filmId, result.exposureDate)],
      ['Setup Reference / Wall Technique', formatIdentity(result.planned.referenceAttachmentId, result.planned.wallTechnique), formatValue(result.retakeOfFilmId ? `Retake of ${result.retakeOfFilmId}` : 'Original exposure')],
      ['Geometry', `SFD ${formatValue(result.planned.sfd, result.planned.sfdUnit)}\nSOD ${formatValue(result.planned.sod, result.planned.sodUnit)}\nOFD ${formatValue(result.planned.ofd, result.planned.ofdUnit)}`, `Actual SFD ${formatValue(result.actualSfd, result.actualSfdUnit)}\nActual SOD ${formatValue(result.actualSod, result.actualSodUnit)}\nActual OFD ${formatValue(result.actualOfd, result.actualOfdUnit)}`],
      ['Active Source Settings', plannedSource, actualSource],
      ['Exposure Time', formatValue(result.planned.exposureTime, result.planned.exposureTimeUnit), formatValue(result.actualExposureTime, result.actualExposureTimeUnit)],
      ['Film / Optical Density', `${formatValue(result.planned.filmDesignation)}\nRequired ${formatRange(result.planned.densityMinimum, result.planned.densityMaximum, 'H&D')}`, `Measured ${formatRange(result.densityMinimum, result.densityMaximum, 'H&D')}`],
      ['Image Quality Indicator', formatValue(result.planned.iqiRequirement), formatValue(result.iqiObserved)],
      ['IQI Requirement Assessment', 'Explicit inspector determination required', formatRequirementAssessment(result.iqiRequirementMet)],
      ['Coverage / Result', 'Required planned coverage', `${formatBooleanRecord(result.coverageConfirmed)}\n${formatCode(result.result)}`],
      ['Remarks', 'Not applicable', formatValue(result.remarks)],
    ];
    y = renderDataTableSection(
      pdf,
      sectionNumber,
      `Film result ${result.planned.viewId || index + 1}`,
      ['CONTROL', 'PLANNED / REQUIRED', 'PERFORMED / ACHIEVED'],
      rows,
      y,
      {
        0: { cellWidth: 42, fontStyle: 'bold' },
        1: { cellWidth: 70 },
        2: { cellWidth: 70 },
      },
    );
    sectionNumber += 1;
  });
  return { sectionNumber, y };
};

const renderDigitalResults = (
  pdf: jsPDF,
  report: Extract<RtPtInspectionReportV1, { method: 'RT-Digital' }>,
  startSectionNumber: number,
  startY: number,
): { sectionNumber: number; y: number } => {
  let sectionNumber = startSectionNumber;
  const summaryRows: RowInput[] = report.results.length > 0
    ? report.results.map((result, index) => [
      formatValue(result.planned.viewId || index + 1),
      formatIdentity(result.imageId, result.retakeOfImageId ? `Retake of ${result.retakeOfImageId}` : ''),
      formatIdentity(result.planned.inspectionZone, result.planned.orientation),
      formatValue(result.acquisitionDate),
      formatBooleanRecord(result.coverageConfirmed),
      formatCode(result.result),
    ])
    : [[{ content: 'No performed DDA acquisition rows entered.', colSpan: 6 }]];
  let y = renderDataTableSection(
    pdf,
    sectionNumber,
    'Performed DDA acquisition summary',
    ['VIEW', 'IMAGE / RETAKE', 'ZONE / ORIENTATION', 'DATE', 'COVERAGE', 'RESULT'],
    summaryRows,
    startY,
    {
      0: { cellWidth: 17, fontStyle: 'bold', halign: 'center' },
      1: { cellWidth: 37 },
      2: { cellWidth: 43 },
      3: { cellWidth: 25 },
      4: { cellWidth: 28 },
      5: { cellWidth: 32, fontStyle: 'bold' },
    },
  );
  sectionNumber += 1;

  report.results.forEach((result, index) => {
    const rows: RowInput[] = [
      ['View / Inspection Zone', formatIdentity(result.planned.viewId, result.planned.description, result.planned.inspectionZone, result.planned.orientation), formatIdentity(result.imageId, result.acquisitionDate)],
      ['Setup Reference / Wall Technique', formatIdentity(result.planned.referenceAttachmentId, result.planned.wallTechnique), formatValue(result.retakeOfImageId ? `Retake of ${result.retakeOfImageId}` : 'Original acquisition')],
      ['Geometry', `SDD ${formatValue(result.planned.sdd, result.planned.sddUnit)}\nSOD ${formatValue(result.planned.sod, result.planned.sodUnit)}\nODD ${formatValue(result.planned.odd, result.planned.oddUnit)}`, `Actual SDD ${formatValue(result.actualSdd, result.actualSddUnit)}\nActual SOD ${formatValue(result.actualSod, result.actualSodUnit)}\nActual ODD ${formatValue(result.actualOdd, result.actualOddUnit)}`],
      ['X-ray Source Settings', formatIdentity(formatValue(result.planned.tubeVoltage, result.planned.tubeVoltageUnit), formatValue(result.planned.tubeCurrent, result.planned.tubeCurrentUnit)), formatIdentity(formatValue(result.actualTubeVoltage, result.actualTubeVoltageUnit), formatValue(result.actualTubeCurrent, result.actualTubeCurrentUnit))],
      ['Exposure Time', formatValue(result.planned.exposureTime, result.planned.exposureTimeUnit), formatValue(result.actualExposureTime, result.actualExposureTimeUnit)],
      ['Integration / Averaging', formatIdentity(formatValue(result.planned.integrationTime, result.planned.integrationTimeUnit), `${formatValue(result.planned.framesAveraged)} frames averaged`), formatIdentity(formatValue(result.actualIntegrationTime, result.actualIntegrationTimeUnit), `${formatValue(result.actualFramesAveraged)} frames averaged`)],
      ['Image Identity / Archive', formatValue(result.planned.imageNaming), formatIdentity(result.imageId, result.archiveReference)],
      ['Image Quality Indicator', formatValue(result.planned.iqiRequirement), formatValue(result.iqiObserved)],
      ['IQI Requirement Assessment', 'Explicit inspector determination required', formatRequirementAssessment(result.iqiRequirementMet)],
      ['SNR', formatValue(result.planned.requiredSnrOrNormalizedSnr), formatValue(result.achievedSnr)],
      ['SNR Requirement Assessment', 'Explicit inspector determination required', formatRequirementAssessment(result.snrRequirementMet)],
      ['CNR / Contrast Sensitivity', formatValue(result.planned.requiredContrastSensitivityOrCnr), formatValue(result.achievedCnr)],
      ['CNR Requirement Assessment', 'Explicit inspector determination required', formatRequirementAssessment(result.cnrRequirementMet)],
      ['Detector Control', 'Current detector controls required', formatValue(result.detectorControlReference)],
      ['Coverage / Result', 'Required planned coverage', `${formatBooleanRecord(result.coverageConfirmed)}\n${formatCode(result.result)}`],
      ['Remarks', 'Not applicable', formatValue(result.remarks)],
    ];
    y = renderDataTableSection(
      pdf,
      sectionNumber,
      `DDA acquisition result ${result.planned.viewId || index + 1}`,
      ['CONTROL', 'PLANNED / REQUIRED', 'PERFORMED / ACHIEVED'],
      rows,
      y,
      {
        0: { cellWidth: 42, fontStyle: 'bold' },
        1: { cellWidth: 70 },
        2: { cellWidth: 70 },
      },
    );
    sectionNumber += 1;
  });
  return { sectionNumber, y };
};

const renderPtResults = (
  pdf: jsPDF,
  report: Extract<RtPtInspectionReportV1, { method: 'PT' }>,
  sectionNumber: number,
  startY: number,
): number => {
  const { results } = report;
  const rows: RowInput[] = [
    ['Classification', formatIdentity(results.planned.penetrantType, `Method ${formatValue(results.planned.removalMethod)}`, results.planned.sensitivityLevel), 'Performed using the linked approved technique'],
    [
      'Surface Preparation',
      formatIdentity(
        results.planned.cleaningMethod,
        results.planned.cleaningDetails,
        hasValue(results.planned.cleaningRestrictions)
          ? `Restriction: ${results.planned.cleaningRestrictions}`
          : '',
      ),
      formatIdentity(results.actualCleaningMethod, results.actualCleaningDetails),
    ],
    ['Surface Condition', formatValue(results.planned.surfaceCondition), formatValue(results.actualSurfaceCondition)],
    [
      'Drying',
      formatIdentity(
        results.planned.dryingMethod,
        formatValue(results.planned.dryingTime, results.planned.dryingTimeUnit),
        formatValue(results.planned.dryingTemperature, results.planned.dryingTemperatureUnit),
      ),
      formatIdentity(
        results.actualDryingMethod,
        formatValue(results.actualDryingTime, results.actualDryingTimeUnit),
        formatValue(results.actualDryingTemperature, results.actualDryingTemperatureUnit),
      ),
    ],
    ['Penetrant Application', formatValue(results.planned.penetrantApplicationMethod), formatValue(results.actualPenetrantApplicationMethod)],
    ['Penetrant Material', 'Controlled material system', formatIdentity(`Lot ${formatValue(results.penetrantLot)}`, `Expiry ${formatValue(results.penetrantExpiry)}`)],
    ['Cleaner Material', 'Controlled material system', formatValue(results.cleanerLot)],
  ];

  rows.push(
    [
      'Part / Penetrant Temperature',
      formatIdentity(
        `Part ${formatRange(results.planned.partTemperatureMin, results.planned.partTemperatureMax, results.planned.partTemperatureUnit)}`,
        `Penetrant ${formatRange(results.planned.penetrantTemperatureMin, results.planned.penetrantTemperatureMax, results.planned.penetrantTemperatureUnit)}`,
      ),
      formatIdentity(formatValue(results.partTemperature, results.temperatureUnit), formatValue(results.penetrantTemperature, results.temperatureUnit)),
    ],
    ['Penetrant Dwell Time', formatValue(results.planned.dwellTime, results.planned.dwellTimeUnit), formatValue(results.actualDwellTime, results.actualDwellTimeUnit)],
  );

  if (results.planned.removalMethod === 'A') {
    rows.push([
      'Method A Water Rinse',
      formatIdentity(
        results.planned.methodARinseInstructions,
        `Pressure ${formatRange(results.planned.methodARinsePressureMin, results.planned.methodARinsePressureMax, results.planned.methodARinsePressureUnit)}`,
        `Temperature ${formatRange(results.planned.methodARinseTemperatureMin, results.planned.methodARinseTemperatureMax, results.planned.methodARinseTemperatureUnit)}`,
      ),
      formatIdentity(
        results.actualMethodARinseDetails,
        `Pressure ${formatValue(results.actualMethodARinsePressure, results.actualMethodARinsePressureUnit)}`,
        `Temperature ${formatValue(results.actualMethodARinseTemperature, results.actualMethodARinseTemperatureUnit)}`,
      ),
    ]);
  } else if (results.planned.removalMethod === 'B' || results.planned.removalMethod === 'D') {
    const method = results.planned.removalMethod;
    rows.push(['Emulsifier Material', `Method ${method} removal`, formatValue(results.emulsifierLot)]);
    if (method === 'D') {
      rows.push(['Method D Pre-rinse', formatValue(results.planned.methodDPreRinseInstructions), formatValue(results.actualMethodDPreRinseDetails)]);
    }
    rows.push([
      `Method ${method} Emulsifier Controls`,
      formatIdentity(
        results.planned.emulsifierType,
        method === 'D'
          ? `Concentration ${formatValue(results.planned.emulsifierConcentration, results.planned.emulsifierConcentrationUnit)}`
          : '',
        `Application ${formatValue(results.planned.emulsifierApplicationMethod)}`,
        `Contact ${formatValue(results.planned.emulsifierContactTime, results.planned.emulsifierContactTimeUnit)}`,
      ),
      formatIdentity(
        method === 'D'
          ? `Concentration ${formatValue(results.actualEmulsifierConcentration, results.actualEmulsifierConcentrationUnit)}`
          : '',
        `Application ${formatValue(results.actualEmulsifierApplicationMethod)}`,
        `Contact ${formatValue(results.actualEmulsifierContactTime, results.actualEmulsifierContactTimeUnit)}`,
      ),
    ]);
    rows.push([
      'Post-emulsifier Rinse',
      formatValue(results.planned.postEmulsifierRinseInstructions),
      formatValue(results.actualPostEmulsifierRinseDetails),
    ]);
    if (method === 'D') {
      rows.push(['Method D Final Rinse', formatValue(results.planned.methodDFinalRinseInstructions), formatValue(results.actualMethodDFinalRinseDetails)]);
    }
  } else if (results.planned.removalMethod === 'C') {
    rows.push(
      ['Remover Material', 'Method C removal', formatValue(results.removerLot)],
      ['Method C Remover Step', formatValue(results.planned.methodCRemoverInstructions), formatValue(results.actualMethodCRemovalDetails)],
    );
  }

  rows.push(
    ['Developer Material', 'Controlled material system', formatValue(results.developerLot)],
    [
      'Developer Application',
      formatIdentity(results.planned.developerApplicationMethod, results.planned.developerInstructions),
      formatValue(results.actualDeveloperApplicationMethod),
    ],
    ['Development Time', formatValue(results.planned.developmentTime, results.planned.developmentTimeUnit), formatValue(results.actualDevelopmentTime, results.actualDevelopmentTimeUnit)],
  );

  if (results.planned.penetrantType === 'Type I') {
    rows.push(
      [
        'Dark Adaptation',
        formatValue(results.planned.darkAdaptationTime, results.planned.darkAdaptationTimeUnit),
        formatValue(results.actualDarkAdaptationTime, results.actualDarkAdaptationTimeUnit),
      ],
      [
        'UV-A / Ambient Visible Light',
        formatIdentity(
          `${formatValue(results.planned.requiredUvAMin, results.planned.uvAUnit)} minimum UV-A`,
          `${formatValue(results.planned.ambientVisibleLightMax, results.planned.visibleLightUnit)} maximum ambient light`,
        ),
        formatIdentity(
          `${formatValue(results.measuredUvA, results.uvAUnit)} measured UV-A`,
          `${formatValue(results.measuredAmbientVisibleLight, results.visibleLightUnit)} measured ambient light`,
        ),
      ],
    );
  } else if (results.planned.penetrantType === 'Type II') {
    rows.push([
      'White Light',
      `${formatValue(results.planned.whiteLightMin, results.planned.visibleLightUnit)} minimum`,
      `${formatValue(results.measuredWhiteLight, results.visibleLightUnit)} measured`,
    ]);
  }

  rows.push(
    ['Light Meter / Examination Time', 'Calibrated equipment required', formatIdentity(results.lightMeterId, results.examinationTime)],
    ['Post-cleaning / Coverage', 'Required planned area and post-cleaning controls', formatIdentity(formatBooleanRecord(results.postCleaningCompleted), formatBooleanRecord(results.coverageConfirmed))],
  );

  return renderDataTableSection(
    pdf,
    sectionNumber,
    'Performed penetrant process record',
    ['CONTROL', 'PLANNED / REQUIRED', 'PERFORMED / ACHIEVED'],
    rows,
    startY,
    {
      0: { cellWidth: 42, fontStyle: 'bold' },
      1: { cellWidth: 70 },
      2: { cellWidth: 70 },
    },
  );
};

const indicationRows = (report: RtPtInspectionReportV1): RowInput[] => {
  if (report.indications.length === 0) {
    return [[{ content: 'No indication records entered.', colSpan: 7 }]];
  }
  return report.indications.map((indication, index) => [
    formatValue(indication.indicationId || index + 1),
    indication.linkedResultId
      ? formatValue(indication.linkedResultId)
      : report.method === 'PT' ? 'Overall PT examination' : 'Overall inspection',
    formatValue(indication.location),
    formatIdentity(indication.indicationType, formatValue(indication.size, indication.sizeUnit)),
    formatValue(indication.evaluation),
    formatCode(indication.disposition),
    formatValue(indication.remarks),
  ]);
};

const approvalRows = (report: RtPtInspectionReportV1): RowInput[] => {
  if (report.approvals.length === 0) {
    return [[{ content: 'No personnel or approval records entered.', colSpan: 4 }]];
  }
  return report.approvals.map((approval) => [
    APPROVAL_ROLE_LABEL[approval.role],
    formatIdentity(approval.name, approval.personnelId),
    formatIdentity(approval.certificationLevel, approval.certificationNumber, approval.certificationBasis),
    formatValue(approval.date),
  ]);
};

const releaseIntegrityRows = (
  report: RtPtInspectionReportV1,
  release: RtPtInspectionReportPdfReleaseState,
): PdfRow[] => [
  ['Report SHA-256 Binding', formatFingerprintReference(report.approvalFingerprint)],
  ['Approved Technique SHA-256', formatFingerprintReference(report.sourceTechnique.approvedContentFingerprint)],
  ['Technique Release Basis', formatIdentity(
    report.sourceTechnique.documentNumber,
    `Rev ${report.sourceTechnique.revision || 'not specified'}`,
    report.sourceTechnique.approvalDate,
  )],
  ['Report Release State', releaseLabel(report, release)],
  ['Verification Rule', 'Controlled only while report validation, the approved technique link, and both content bindings remain current.'],
  ['Personnel Record Scope', 'Names, qualifications, roles, and dates are recorded approval data; no cryptographic personnel-signing claim is made.'],
];

const renderValidationReview = (
  pdf: jsPDF,
  validation: RtPtInspectionReportValidation,
  sectionNumber: number,
  startY: number,
): number => {
  if (validation.issues.length === 0) return startY;
  return renderDataTableSection(
    pdf,
    sectionNumber,
    'Review exceptions - unresolved',
    ['LEVEL', 'AREA', 'REQUIREMENT', 'FINDING'],
    validation.issues.map((issue) => [
      issue.severity.toUpperCase(),
      issue.section.toUpperCase(),
      issue.label,
      issue.message,
    ]),
    startY,
    {
      0: { cellWidth: 18, fontStyle: 'bold', textColor: PDF_THEME.red },
      1: { cellWidth: 28 },
      2: { cellWidth: 49 },
      3: { cellWidth: 87 },
    },
  );
};

const drawPageFurniture = (
  pdf: jsPDF,
  report: RtPtInspectionReportV1,
  release: RtPtInspectionReportPdfReleaseState,
): void => {
  const pages = pdf.getNumberOfPages();
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const reportNumber = report.reportControl.number || 'UNNUMBERED';
  const revision = report.reportControl.revision || '-';

  for (let page = 1; page <= pages; page += 1) {
    pdf.setPage(page);
    if (page > 1) {
      pdf.setFillColor(...PDF_THEME.navy);
      pdf.rect(0, 0, pageWidth, 23, 'F');
      pdf.setFillColor(...PDF_THEME.steel);
      pdf.rect(0, 23, pageWidth, 1.2, 'F');
      pdf.setTextColor(...PDF_THEME.white);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(9.2);
      pdf.text(`RT-PT / ${METHOD_CODE[report.method]} / INSPECTION REPORT`, PDF_MARGIN, 10.2);
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(6.8);
      pdf.text(truncateToWidth(pdf, METHOD_TITLE[report.method], 92), PDF_MARGIN, 16.2);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(7.2);
      pdf.text(`REPORT ${reportNumber}  /  REV ${revision}`, pageWidth - PDF_MARGIN, 9.8, { align: 'right' });
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(6.5);
      pdf.text(releaseLabel(report, release), pageWidth - PDF_MARGIN, 16.2, { align: 'right' });
    }

    if (release.watermark) {
      pdf.saveGraphicsState();
      pdf.setGState(new GState({ opacity: 0.1 }));
      pdf.setTextColor(...PDF_THEME.steelSoft);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(27);
      pdf.text(release.watermark, pageWidth / 2, pageHeight / 2, { align: 'center', angle: 45 });
      pdf.restoreGraphicsState();
    }

    pdf.setDrawColor(...PDF_THEME.line);
    pdf.setLineWidth(0.25);
    pdf.line(PDF_MARGIN, pageHeight - 15, pageWidth - PDF_MARGIN, pageHeight - 15);
    pdf.setTextColor(...PDF_THEME.muted);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(6.4);
    pdf.text(
      truncateToWidth(pdf, `${report.organization.name || 'RT Inspector'} / ${reportNumber} / Rev ${revision}`, 68),
      PDF_MARGIN,
      pageHeight - 9.5,
    );
    pdf.text('PERFORMED / ACHIEVED INSPECTION RESULTS', pageWidth / 2, pageHeight - 9.5, { align: 'center' });
    pdf.setFont('helvetica', 'bold');
    pdf.text(`PAGE ${page} OF ${pages}`, pageWidth - PDF_MARGIN, pageHeight - 9.5, { align: 'right' });
  }
};

export function buildRtPtInspectionReportPdf(
  report: RtPtInspectionReportV1,
  technique: RtPtDocumentV3,
  callerValidation?: RtPtInspectionReportValidation,
): jsPDF {
  void callerValidation;
  const validation = validateRtPtInspectionReport(report, technique);
  const release = getRtPtInspectionReportPdfReleaseState(report, technique);
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });

  pdf.setProperties({
    title: report.reportControl.title || `${METHOD_TITLE[report.method]} Inspection Report`,
    subject: `${METHOD_TITLE[report.method]} - Performed inspection report - ${release.controlledRelease
      ? 'Controlled'
      : report.status === 'superseded' ? 'Superseded / Uncontrolled' : 'Draft / Uncontrolled'}`,
    author: report.organization.name || 'RT Inspector',
    creator: 'RT Inspector',
    keywords: release.watermark || 'CONTROLLED INSPECTION REPORT',
  });

  renderCover(pdf, report, validation, release);
  pdf.addPage();

  let sectionNumber = 1;
  let y = renderPairedSection(pdf, sectionNumber, 'Report and technique traceability', traceabilityRows(report), PDF_CONTENT_TOP);
  sectionNumber += 1;
  y = renderPairedSection(pdf, sectionNumber, 'Equipment and execution conditions', equipmentRows(report), y);
  sectionNumber += 1;
  y = renderDataTableSection(
    pdf,
    sectionNumber,
    'Controlled technique references',
    ['TYPE', 'DOCUMENT / TITLE', 'REVISION', 'CLAUSE / NOTE'],
    controlledReferenceRows(report.sourceTechnique.controlledReferences),
    y,
    {
      0: { cellWidth: 31 },
      1: { cellWidth: 72 },
      2: { cellWidth: 24 },
      3: { cellWidth: 55 },
    },
  );
  sectionNumber += 1;

  if (report.method === 'RT-Film') {
    const rendered = renderFilmResults(pdf, report, sectionNumber, y);
    sectionNumber = rendered.sectionNumber;
    y = rendered.y;
  } else if (report.method === 'RT-Digital') {
    const rendered = renderDigitalResults(pdf, report, sectionNumber, y);
    sectionNumber = rendered.sectionNumber;
    y = rendered.y;
  } else {
    y = renderPtResults(pdf, report, sectionNumber, y);
    sectionNumber += 1;
  }

  y = renderDataTableSection(
    pdf,
    sectionNumber,
    'Indication and disposition register',
    ['ID', 'LINKED RESULT', 'LOCATION', 'TYPE / SIZE', 'EVALUATION', 'DISPOSITION', 'REMARKS'],
    indicationRows(report),
    y,
    {
      0: { cellWidth: 15, fontStyle: 'bold' },
      1: { cellWidth: 24 },
      2: { cellWidth: 28 },
      3: { cellWidth: 27 },
      4: { cellWidth: 35 },
      5: { cellWidth: 25, fontStyle: 'bold' },
      6: { cellWidth: 28 },
    },
  );
  sectionNumber += 1;

  y = renderPairedSection(pdf, sectionNumber, 'Final disposition record', [
    ['Overall Disposition', formatCode(report.overallDisposition)],
    ['Disposition Reference', formatValue(report.dispositionReference)],
    ['Performed Coverage Statement', formatValue(report.coverageStatement)],
    ['Report Remarks', formatValue(report.remarks)],
    ['Recorded Deviations', formatValue(report.equipment.deviations)],
    ['Release State', releaseLabel(report, release)],
  ], y);
  sectionNumber += 1;

  if (report.method === 'PT') {
    y = ensureContentSpace(pdf, y, 80);
  }
  y = renderDataTableSection(
    pdf,
    sectionNumber,
    'Personnel and approval records',
    ['ROLE', 'NAME / PERSONNEL ID', 'CERTIFICATION RECORD', 'DATE'],
    approvalRows(report),
    y,
    {
      0: { cellWidth: 32 },
      1: { cellWidth: 50 },
      2: { cellWidth: 70 },
      3: { cellWidth: 30 },
    },
  );
  sectionNumber += 1;
  y = renderPairedSection(
    pdf,
    sectionNumber,
    'Release and integrity verification',
    releaseIntegrityRows(report, release),
    y,
  );
  sectionNumber += 1;
  renderValidationReview(pdf, validation, sectionNumber, y);

  drawPageFurniture(pdf, report, release);
  return pdf;
}

export function exportRtPtInspectionReportPdf(
  report: RtPtInspectionReportV1,
  technique: RtPtDocumentV3,
  callerValidation?: RtPtInspectionReportValidation,
): string {
  void callerValidation;
  const filename = getRtPtInspectionReportPdfFilename(report, technique);
  buildRtPtInspectionReportPdf(report, technique).save(filename);
  return filename;
}
