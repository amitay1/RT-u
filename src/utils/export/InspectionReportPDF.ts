// @ts-nocheck
/**
 * Professional Inspection Report PDF Exporter
 * Styled after TÜV SÜD / FRISA professional inspection reports
 * Supports aerospace forging UT standards (AMS-STD-2154, ASTM E2375, ASTM A388)
 *
 * SYNCHRONIZED WITH TechniqueSheetPDF.ts - Same professional styling
 */
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { InspectionReportData } from '@/types/inspectionReport';
import { detectImageFormat, fitImageToBox } from './exportHelpers';

// ============================================================================
// COLORS - Professional TÜV/FRISA style (matching TechniqueSheetPDF)
// ============================================================================
const COLORS = {
  // Primary colors - Gold theme
  primary: [180, 150, 45] as [number, number, number],       // Gold - headers & section bars
  primaryDark: [150, 125, 35] as [number, number, number],   // Darker gold - cover page header
  secondary: [130, 170, 210] as [number, number, number],    // Light blue - subheaders
  accent: [100, 155, 210] as [number, number, number],       // Soft blue - highlights
  accentGold: [212, 175, 55] as [number, number, number],    // Bright gold accent

  // Background colors
  headerBg: [240, 245, 250] as [number, number, number],   // Light gray-blue
  sectionBg: [245, 247, 250] as [number, number, number],  // Section backgrounds
  rowAlt: [248, 250, 252] as [number, number, number],     // Alternating row
  labelBg: [230, 235, 240] as [number, number, number],    // Label background
  white: [255, 255, 255] as [number, number, number],

  // Border colors
  tableBorder: [200, 210, 220] as [number, number, number],
  divider: [220, 225, 230] as [number, number, number],

  // Text colors
  text: [30, 30, 30] as [number, number, number],          // Dark text
  lightText: [100, 100, 100] as [number, number, number],  // Secondary text
  mutedText: [130, 130, 130] as [number, number, number],  // Muted/subtle text

  // Status colors
  success: [34, 139, 34] as [number, number, number],      // Green - Accept
  warning: [255, 165, 0] as [number, number, number],      // Orange - warnings
  error: [220, 53, 69] as [number, number, number],        // Red - Reject
};

// ============================================================================
// PAGE SETTINGS
// ============================================================================
const PAGE = {
  width: 210,           // A4 width in mm
  height: 297,          // A4 height in mm
  marginLeft: 15,
  marginRight: 15,
  marginTop: 20,
  marginBottom: 20,
  headerHeight: 15,
  footerHeight: 10,
  contentWidth: 180,    // 210 - 15 - 15
  contentStart: 35,     // After header
};

// ============================================================================
// TYPES
// ============================================================================
interface ExportOptions {
  companyName?: string;
  companyLogo?: string;
  showLogoOnEveryPage?: boolean; // When false, hide logo from all pages (default: true)
  includeAerospaceSection?: boolean;
  language?: 'en' | 'it' | 'fr';
}

// ============================================================================
// MAIN EXPORT FUNCTION
// ============================================================================
export const exportInspectionReportPDF = (
  data: InspectionReportData,
  options: ExportOptions = {}
): void => {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const {
    companyName = 'SCAN-MASTER',
    includeAerospaceSection = true,
  } = options;

  let currentPage = 1;
  let yPos = PAGE.marginTop;

  // ============================================================================
  // HELPER FUNCTIONS
  // ============================================================================

  const formatValue = (value: string | number | undefined | null): string => {
    if (value === undefined || value === null || value === '') return '-';
    return String(value);
  };

  const formatDate = (date: string | undefined): string => {
    if (!date) return '-';
    try {
      const d = new Date(date);
      return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    } catch {
      return date;
    }
  };

  const drawCheckMark = (
    boxX: number,
    boxY: number,
    boxSize: number,
    color: [number, number, number] = COLORS.white
  ): void => {
    doc.setDrawColor(...color);
    doc.setLineWidth(0.6);
    doc.line(boxX + boxSize * 0.8, boxY + boxSize * 0.55, boxX + boxSize * 1.55, boxY + boxSize * 1.25);
    doc.line(boxX + boxSize * 1.55, boxY + boxSize * 1.25, boxX + boxSize * 3.1, boxY + boxSize * 0.1);
    doc.setLineWidth(0.3);
    doc.setDrawColor(...COLORS.tableBorder);
  };

  // ============================================================================
  // COVER PAGE HEADER (FRISA style with logo support)
  // ============================================================================
  const addCoverHeader = (): number => {
    const headerHeight = 28;
    const headerY = 10;

    // Logo box (white background on left) - if logo provided and toggle allows it
    let titleStartX = PAGE.marginLeft;
    const companyLogo = options.showLogoOnEveryPage !== false ? options.companyLogo : undefined;

    if (companyLogo) {
      const logoBoxWidth = 30;
      const logoBoxHeight = headerHeight - 4;
      const logoBoxX = PAGE.marginLeft;
      const logoBoxY = headerY + 2;

      // White background for logo
      doc.setFillColor(...COLORS.white);
      doc.roundedRect(logoBoxX, logoBoxY, logoBoxWidth, logoBoxHeight, 2, 2, 'F');

      // Gold right border accent
      doc.setFillColor(...COLORS.accentGold);
      doc.rect(logoBoxX + logoBoxWidth, logoBoxY, 1.5, logoBoxHeight, 'F');

      // Add logo image
      try {
        {
          const boxW = logoBoxWidth - 6;
          const boxH = logoBoxHeight - 6;
          const fit = fitImageToBox(doc, companyLogo, boxW, boxH);
          doc.addImage(
            companyLogo,
            detectImageFormat(companyLogo),
            logoBoxX + 3 + (boxW - fit.width) / 2,
            logoBoxY + 3 + (boxH - fit.height) / 2,
            fit.width,
            fit.height
          );
        }
      } catch {
        // If logo fails, show placeholder text
        doc.setFontSize(7);
        doc.setTextColor(...COLORS.lightText);
        doc.text('LOGO', logoBoxX + logoBoxWidth / 2, logoBoxY + logoBoxHeight / 2, { align: 'center' });
      }

      titleStartX = logoBoxX + logoBoxWidth + 6;
    }

    // Main blue header bar
    doc.setFillColor(...COLORS.primaryDark);
    if (companyLogo) {
      // Header starts after logo
      doc.rect(titleStartX - 2, headerY, PAGE.width - titleStartX + 2, headerHeight, 'F');
    } else {
      // Full width header
      doc.rect(0, headerY, PAGE.width, headerHeight, 'F');
    }

    // Gold accent line below
    doc.setFillColor(...COLORS.accentGold);
    doc.rect(0, headerY + headerHeight, PAGE.width, 1.5, 'F');

    // Main title only (no subtitle)
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text('UT INSPECTION REPORT', titleStartX + 2, headerY + 18);

    // Document info box (white box on right)
    const boxWidth = 60;
    const boxHeight = 24;
    const boxX = PAGE.width - PAGE.marginRight - boxWidth;
    const boxY = headerY + 2;

    // White box with border
    doc.setFillColor(...COLORS.white);
    doc.roundedRect(boxX, boxY, boxWidth, boxHeight, 2, 2, 'F');
    doc.setDrawColor(...COLORS.tableBorder);
    doc.setLineWidth(0.3);
    doc.roundedRect(boxX, boxY, boxWidth, boxHeight, 2, 2, 'S');

    // Document info text
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...COLORS.lightText);
    doc.text('Report No:', boxX + 3, boxY + 5);
    doc.text('Indicator No:', boxX + 3, boxY + 10);
    doc.text('Revision:', boxX + 3, boxY + 15);
    doc.text('Date:', boxX + 3, boxY + 20);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...COLORS.primaryDark);
    doc.text(formatValue(data.documentNo), boxX + 28, boxY + 5);
    doc.text(formatValue(data.indicatorNo), boxX + 28, boxY + 10);
    doc.text(formatValue(data.currentRevision), boxX + 28, boxY + 15);
    doc.text(formatDate(data.issueDate), boxX + 28, boxY + 20);

    return headerY + headerHeight + 8;
  };

  // ============================================================================
  // PAGE HEADER (for non-cover pages)
  // ============================================================================
  const addHeader = (): number => {
    const companyLogo = options.showLogoOnEveryPage !== false ? options.companyLogo : undefined;

    // Blue header bar
    doc.setFillColor(...COLORS.primary);
    doc.rect(0, 0, PAGE.width, PAGE.headerHeight, 'F');

    // Gold accent line
    doc.setFillColor(...COLORS.accentGold);
    doc.rect(0, PAGE.headerHeight, PAGE.width, 0.8, 'F');

    // Optional logo on left
    let titleX = PAGE.marginLeft;
    if (companyLogo) {
      const logoBoxWidth = 18;
      const logoBoxHeight = PAGE.headerHeight - 4;
      const logoBoxX = PAGE.marginLeft;
      const logoBoxY = 2;

      doc.setFillColor(...COLORS.white);
      doc.roundedRect(logoBoxX, logoBoxY, logoBoxWidth, logoBoxHeight, 1.5, 1.5, 'F');

      try {
        {
          const boxW = logoBoxWidth - 4;
          const boxH = logoBoxHeight - 3;
          const fit = fitImageToBox(doc, companyLogo, boxW, boxH);
          doc.addImage(
            companyLogo,
            detectImageFormat(companyLogo),
            logoBoxX + 2 + (boxW - fit.width) / 2,
            logoBoxY + 1.5 + (boxH - fit.height) / 2,
            fit.width,
            fit.height
          );
        }
      } catch {
        doc.setFontSize(6);
        doc.setTextColor(...COLORS.lightText);
        doc.text('LOGO', logoBoxX + logoBoxWidth / 2, logoBoxY + logoBoxHeight / 2 + 1, { align: 'center' });
      }

      titleX = logoBoxX + logoBoxWidth + 4;
    }

    // Title (left)
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...COLORS.white);
    doc.text('UT INSPECTION REPORT', titleX, 10);

    // Document info (right)
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    const infoText = `Doc: ${formatValue(data.documentNo)} | Rev: ${formatValue(data.currentRevision)}`;
    doc.text(infoText, PAGE.width - PAGE.marginRight, 10, { align: 'right' });

    return PAGE.headerHeight + 8;
  };

  // ============================================================================
  // PAGE FOOTER
  // ============================================================================
  const addFooter = (pageNum: number, totalPages: number): void => {
    const footerY = PAGE.height - PAGE.footerHeight;

    // Gold accent line
    doc.setFillColor(...COLORS.accentGold);
    doc.rect(PAGE.marginLeft, footerY - 2, PAGE.contentWidth, 0.5, 'F');

    // Blue line below gold
    doc.setFillColor(...COLORS.primary);
    doc.rect(PAGE.marginLeft, footerY - 1.5, PAGE.contentWidth, 0.3, 'F');

    // Footer content
    doc.setFillColor(...COLORS.sectionBg);
    doc.rect(PAGE.marginLeft, footerY, PAGE.contentWidth, 8, 'F');

    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');

    // Part number (left)
    doc.setTextColor(...COLORS.lightText);
    doc.text(`P/N: ${formatValue(data.partNumber)}`, PAGE.marginLeft + 3, footerY + 5);

    // Confidential (center)
    doc.setTextColor(...COLORS.mutedText);
    doc.text('CONFIDENTIAL', PAGE.width / 2, footerY + 5, { align: 'center' });

    // Page number (right)
    doc.setTextColor(...COLORS.lightText);
    doc.text('Page ', PAGE.width - PAGE.marginRight - 20, footerY + 5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...COLORS.primary);
    doc.text(`${pageNum}`, PAGE.width - PAGE.marginRight - 13, footerY + 5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...COLORS.lightText);
    doc.text(` of ${totalPages}`, PAGE.width - PAGE.marginRight - 10, footerY + 5);
  };

  // ============================================================================
  // SECTION TITLE (FRISA style with gold accent)
  // ============================================================================
  const addSectionTitle = (title: string, y: number): number => {
    // Gold left accent
    doc.setFillColor(...COLORS.accentGold);
    doc.rect(PAGE.marginLeft, y, 4, 10, 'F');

    // Blue main bar
    doc.setFillColor(...COLORS.primary);
    doc.rect(PAGE.marginLeft + 4, y, PAGE.contentWidth - 4, 10, 'F');

    // Shadow effect
    doc.setFillColor(0, 0, 0);
    doc.setGState(new (doc as any).GState({ opacity: 0.1 }));
    doc.rect(PAGE.marginLeft + 1, y + 10, PAGE.contentWidth - 1, 1, 'F');
    doc.setGState(new (doc as any).GState({ opacity: 1 }));

    // Title text
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...COLORS.white);
    doc.text(title, PAGE.marginLeft + 8, y + 7);

    return y + 14;
  };

  // ============================================================================
  // SUBSECTION TITLE (with blue/gold accent bars)
  // ============================================================================
  const addSubSectionTitle = (title: string, y: number): number => {
    // Blue accent bar
    doc.setFillColor(...COLORS.primary);
    doc.rect(PAGE.marginLeft, y, 2, 7, 'F');

    // Gold accent bar
    doc.setFillColor(...COLORS.accentGold);
    doc.rect(PAGE.marginLeft + 2, y, 2, 7, 'F');

    // Light gray background
    doc.setFillColor(...COLORS.sectionBg);
    doc.rect(PAGE.marginLeft + 4, y, PAGE.contentWidth - 4, 7, 'F');

    // Title text
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...COLORS.primary);
    doc.text(title, PAGE.marginLeft + 8, y + 5);

    return y + 10;
  };

  // ============================================================================
  // FIELD ROW (label: value format)
  // ============================================================================
  const addField = (label: string, value: string, x: number, y: number, labelWidth: number = 40): number => {
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...COLORS.lightText);
    doc.text(label + ':', x, y);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...COLORS.text);
    doc.text(formatValue(value), x + labelWidth, y);

    return y + 5;
  };

  const addFieldRow = (fields: Array<{ label: string; value: string; width?: number }>, y: number): number => {
    const fieldWidth = PAGE.contentWidth / fields.length;
    let maxY = y;

    fields.forEach((field, index) => {
      const x = PAGE.marginLeft + (index * fieldWidth);
      const newY = addField(field.label, field.value, x, y, field.width || 35);
      maxY = Math.max(maxY, newY);
    });

    return maxY;
  };

  // ============================================================================
  // PAGE BREAK CHECK
  // ============================================================================
  const calculateTotalPages = (): number => {
    let pages = 1; // Cover page
    pages += 1; // Observations & Results Detail page
    pages += 1; // Equipment
    if (includeAerospaceSection) pages += 1; // Aerospace
    if (data.indications && data.indications.length > 0) pages += 1; // Indications
    pages += Math.ceil((data.scans?.length || 0) / 2); // Scans
    pages += 1; // Remarks & Signatures
    return Math.max(pages, 4);
  };

  const totalPages = calculateTotalPages();

  const checkPageBreak = (requiredSpace: number): number => {
    if (yPos + requiredSpace > PAGE.height - PAGE.marginBottom - 10) {
      doc.addPage();
      currentPage++;
      yPos = addHeader();
      addFooter(currentPage, totalPages);
      return yPos;
    }
    return yPos;
  };

  // ============================================================================
  // PAGE 1: COVER PAGE
  // ============================================================================

  yPos = addCoverHeader();

  // DOCUMENT SUMMARY section header
  doc.setFillColor(...COLORS.primary);
  doc.rect(PAGE.marginLeft, yPos, 3, 8, 'F');
  doc.setFillColor(...COLORS.sectionBg);
  doc.rect(PAGE.marginLeft + 3, yPos, PAGE.contentWidth - 3, 8, 'F');

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COLORS.primary);
  doc.text('DOCUMENT SUMMARY', PAGE.marginLeft + 8, yPos + 5.5);
  yPos += 12;

  // Document Summary Table (4-column layout like TechniqueSheet)
  const summaryRows = [
    ['Customer', formatValue(data.customerName), 'PO Number', formatValue(data.poNumber)],
    ['Part Number', formatValue(data.partNumber), 'Part Name', formatValue(data.itemDescription)],
    ['Material', formatValue(data.materialGrade), 'Cast/Heat No.', formatValue(data.castNumber)],
    ['Document No.', formatValue(data.documentNo), 'Revision', formatValue(data.currentRevision)],
    ['Test Standard', formatValue(data.testStandard), 'Test Method', 'UT'],
    ['Issue Date', formatDate(data.issueDate), 'Results', formatValue(data.results) || 'CONFORM'],
  ];

  autoTable(doc, {
    startY: yPos,
    body: summaryRows,
    theme: 'grid',
    styles: { fontSize: 8, cellPadding: 2.5 },
    columnStyles: {
      0: { fontStyle: 'bold', fillColor: COLORS.labelBg, textColor: COLORS.lightText, cellWidth: 35 },
      1: { cellWidth: 55 },
      2: { fontStyle: 'bold', fillColor: COLORS.labelBg, textColor: COLORS.lightText, cellWidth: 35 },
      3: { cellWidth: 55 },
    },
    alternateRowStyles: { fillColor: COLORS.rowAlt },
    tableLineColor: COLORS.tableBorder,
    tableLineWidth: 0.3,
    margin: { left: PAGE.marginLeft, right: PAGE.marginRight },
    didParseCell: (cellData) => {
      // Highlight Results cell
      if (cellData.row.index === 5 && cellData.column.index === 3) {
        const value = cellData.cell.raw?.toString().toLowerCase() || '';
        if (value.includes('conform') || value.includes('accept')) {
          cellData.cell.styles.textColor = COLORS.success;
          cellData.cell.styles.fontStyle = 'bold';
        } else if (value.includes('reject') || value.includes('non')) {
          cellData.cell.styles.textColor = COLORS.error;
          cellData.cell.styles.fontStyle = 'bold';
        }
      }
    },
  });

  yPos = (doc as any).lastAutoTable.finalY + 8;

  // Part Information Section
  yPos = addSectionTitle('PART INFORMATION', yPos);

  yPos = addFieldRow([
    { label: 'Description', value: data.itemDescription },
    { label: 'Drawing No.', value: data.drawingNumber },
  ], yPos);

  yPos = addFieldRow([
    { label: 'Lot No.', value: data.lotNumber },
    { label: 'Batch No.', value: data.batchNumber || '-' },
  ], yPos);

  yPos = addFieldRow([
    { label: 'Heat Treatment', value: data.heatTreatmentCondition },
    { label: 'Thickness', value: data.thickness ? `${data.thickness} mm` : '-' },
  ], yPos);

  yPos = addFieldRow([
    { label: 'Surface Roughness', value: data.surfaceRoughness || '-' },
    { label: 'Surface Condition', value: data.surfaceConditions?.join(', ') || '-' },
  ], yPos);

  yPos += 5;

  // Quantity Section
  yPos = addSectionTitle('QUANTITY & SERIAL NUMBERS', yPos);

  yPos = addFieldRow([
    { label: 'Work Order', value: data.workOrderNumber },
    { label: 'Quantity', value: data.quantity },
  ], yPos);

  yPos = addField('Serial Numbers', data.individualNumbers || '-', PAGE.marginLeft, yPos, 30);

  yPos += 5;

  // Testing Details Section
  yPos = addSectionTitle('TESTING DETAILS', yPos);

  // Test methods checkboxes (styled)
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COLORS.text);
  doc.text('Test Methods:', PAGE.marginLeft, yPos);

  const testTypes = ['RT', 'MT', 'UT', 'PT', 'OT'];
  let xOffset = PAGE.marginLeft + 30;
  testTypes.forEach(type => {
    const isSelected = data.testTypes?.includes(type as any);

    if (isSelected) {
      doc.setFillColor(...COLORS.primary);
      doc.rect(xOffset, yPos - 3, 4, 4, 'F');
      drawCheckMark(xOffset, yPos - 3, 4);
    } else {
      doc.setDrawColor(...COLORS.tableBorder);
      doc.rect(xOffset, yPos - 3, 4, 4, 'S');
    }

    doc.setTextColor(...COLORS.text);
    doc.setFont('helvetica', 'normal');
    doc.text(type, xOffset + 6, yPos);
    xOffset += 20;
  });
  yPos += 7;

  yPos = addFieldRow([
    { label: 'Scan Type', value: data.typeOfScan },
    { label: 'Equipment', value: data.testingEquipment },
  ], yPos);

  yPos = addFieldRow([
    { label: 'TCG Applied', value: data.tcgApplied },
    { label: 'Technique Sheet', value: data.technicalSheetRef || '-' },
  ], yPos);

  yPos += 5;

  // Results Section
  yPos = addSectionTitle('OBSERVATIONS & RESULTS', yPos);

  // Observations text
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...COLORS.text);
  const obsText = data.observations || 'No recordable indications detected during ultrasonic examination.';
  const obsLines = doc.splitTextToSize(obsText, PAGE.contentWidth - 10);
  doc.text(obsLines, PAGE.marginLeft + 3, yPos);
  yPos += obsLines.length * 4 + 5;

  // Results box (colored)
  const results = data.results || 'CONFORM';
  const isAccept = results.toLowerCase().includes('conform') || results.toLowerCase().includes('accept');

  doc.setFillColor(...(isAccept ? COLORS.success : COLORS.error));
  doc.roundedRect(PAGE.marginLeft, yPos, 60, 12, 2, 2, 'F');

  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COLORS.white);
  doc.text(results.toUpperCase(), PAGE.marginLeft + 30, yPos + 8, { align: 'center' });

  yPos += 18;

  // ---- Signature boxes on cover page ----
  const coverSigWidth = 55;
  const coverSigHeight = 28;
  const coverSigGap = 7;
  const sigs = data.signatures || {};

  const drawCoverSignatureBox = (x: number, title: string, name?: string, date?: string) => {
    doc.setFillColor(...COLORS.sectionBg);
    doc.roundedRect(x, yPos, coverSigWidth, coverSigHeight, 2, 2, 'F');
    doc.setDrawColor(...COLORS.tableBorder);
    doc.setLineWidth(0.3);
    doc.roundedRect(x, yPos, coverSigWidth, coverSigHeight, 2, 2, 'S');
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...COLORS.primary);
    doc.text(title, x + 3, yPos + 5);
    doc.setDrawColor(...COLORS.divider);
    doc.line(x + 3, yPos + 8, x + coverSigWidth - 3, yPos + 8);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...COLORS.text);
    doc.text(name || '________________________', x + 3, yPos + 15);
    doc.setFontSize(7);
    doc.setTextColor(...COLORS.lightText);
    doc.text('Date:', x + 3, yPos + 22);
    doc.setTextColor(...COLORS.text);
    doc.text(date || '______________', x + 15, yPos + 22);
  };

  drawCoverSignatureBox(PAGE.marginLeft, 'REPORT ISSUED BY', sigs.preparedBy?.name, sigs.preparedBy?.date);
  drawCoverSignatureBox(PAGE.marginLeft + coverSigWidth + coverSigGap, 'APPROVED BY', sigs.approvedBy?.name, sigs.approvedBy?.date);
  drawCoverSignatureBox(PAGE.marginLeft + (coverSigWidth + coverSigGap) * 2, 'AUTHORIZED BY', sigs.witness?.name, sigs.witness?.date);

  yPos += coverSigHeight + 5;

  addFooter(1, totalPages);

  // ============================================================================
  // PAGE 1B: OBSERVATIONS & RESULTS DETAIL (Summary + Test Results tables)
  // ============================================================================

  doc.addPage();
  currentPage++;
  yPos = addHeader();

  yPos = addSectionTitle('OBSERVATIONS & RESULTS', yPos);

  // Part summary table (Part Inspected | Conforming Parts | Non-Conforming Parts)
  const rs = data.resultsSummary;
  autoTable(doc, {
    startY: yPos,
    head: [['Part Inspected', 'Conforming Parts', 'Non-Conforming Parts']],
    body: [[
      rs?.partsInspected?.toString() || '-',
      rs?.conformingParts?.toString() || '-',
      rs?.nonConformingParts?.toString() || '-',
    ]],
    theme: 'grid',
    styles: { fontSize: 9, cellPadding: 4, halign: 'center' },
    headStyles: {
      fillColor: COLORS.primary,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'center',
    },
    tableLineColor: COLORS.tableBorder,
    tableLineWidth: 0.3,
    margin: { left: PAGE.marginLeft, right: PAGE.marginRight },
  });

  yPos = (doc as any).lastAutoTable.finalY + 10;

  // Test Results detailed table
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COLORS.primary);
  doc.text('Test Results', PAGE.marginLeft, yPos);
  yPos += 5;

  // Build test results rows from indications data
  const testResultRows = (data.indications && data.indications.length > 0)
    ? data.indications.map(ind => [
        ind.scanId || '-',
        ind.xDistance || '-',
        ind.amplitude || '-',
        `${ind.soundPath || '-'} / ${ind.fbhEquivalentSize || '-'} / ${ind.xExtension || '-'}`,
        ind.yDistance || '-',
        ind.assessment?.toUpperCase() || '-',
      ])
    : [['', '', '', '', '', '']];

  autoTable(doc, {
    startY: yPos,
    head: [['S/N', 'Scan Direction', 'Indication\nAmplitude', 'Indication Size\n(Depth / Type / Length)', 'Location', 'Assessment']],
    body: testResultRows,
    theme: 'grid',
    styles: { fontSize: 8, cellPadding: 3 },
    headStyles: {
      fillColor: COLORS.primary,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'center',
    },
    columnStyles: {
      0: { cellWidth: 20 },
      1: { cellWidth: 30 },
      2: { cellWidth: 25 },
      3: { cellWidth: 45 },
      4: { cellWidth: 30 },
      5: { cellWidth: 30 },
    },
    alternateRowStyles: { fillColor: COLORS.rowAlt },
    tableLineColor: COLORS.tableBorder,
    tableLineWidth: 0.3,
    margin: { left: PAGE.marginLeft, right: PAGE.marginRight },
    didParseCell: (cellData) => {
      if (cellData.column.index === 5 && cellData.section === 'body') {
        const value = cellData.cell.raw?.toString().toLowerCase() || '';
        if (value.includes('accept')) {
          cellData.cell.styles.textColor = COLORS.success;
          cellData.cell.styles.fontStyle = 'bold';
        } else if (value.includes('reject')) {
          cellData.cell.styles.textColor = COLORS.error;
          cellData.cell.styles.fontStyle = 'bold';
        }
      }
    },
  });

  yPos = (doc as any).lastAutoTable.finalY + 8;

  // Note about C-Scan images
  doc.setFontSize(8);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(...COLORS.lightText);
  doc.text('If needed - Add C-Scan image result (see Scan Data pages).', PAGE.marginLeft + 3, yPos);
  yPos += 8;

  addFooter(currentPage, totalPages);

  // ============================================================================
  // PAGE 2: EQUIPMENT DETAILS
  // ============================================================================

  doc.addPage();
  currentPage++;
  yPos = addHeader();

  yPos = addSectionTitle('EQUIPMENT DETAILS', yPos);

  const eq = data.equipmentDetails;

  // Ultrasonic Generator
  yPos = addSubSectionTitle('Ultrasonic Generator', yPos);

  yPos = addFieldRow([
    { label: 'Make', value: eq?.generatorMake || '-' },
    { label: 'Model', value: eq?.generatorModel || '-' },
    { label: 'Serial No.', value: eq?.generatorSerial || '-' },
  ], yPos);

  yPos = addField('Calibration Date', eq?.generatorCalibrationDate || '-', PAGE.marginLeft, yPos, 35);

  yPos += 3;

  // Scan Details
  yPos = addSubSectionTitle('Scan Details', yPos);

  yPos = addFieldRow([
    { label: 'Frequency', value: eq?.frequency || '-' },
    { label: 'Probe Diameter', value: eq?.probeDiameter || '-' },
    { label: 'Water Path', value: eq?.waterPath || '-' },
  ], yPos);

  // Technique parameters (from technique sheet)
  if (eq?.techniqueParameters) {
    const tp = eq.techniqueParameters;
    if (tp.scanType || tp.scanDirection || tp.scanSpeed) {
      yPos += 2;
      yPos = addFieldRow([
        { label: 'Scan Type', value: tp.scanType || '-' },
        { label: 'Direction', value: tp.scanDirection || '-' },
        { label: 'Speed', value: tp.scanSpeed || '-' },
      ], yPos);
    }
    if (tp.indexStep || tp.coverage || tp.gain) {
      yPos = addFieldRow([
        { label: 'Index Step', value: tp.indexStep || '-' },
        { label: 'Coverage', value: tp.coverage || '-' },
        { label: 'Gain', value: tp.gain || '-' },
      ], yPos);
    }
  }

  // Scan image (C-scan / scan result image from technique)
  if (eq?.includeScanImage && eq?.scanImage) {
    yPos = checkPageBreak(65);
    yPos += 3;
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...COLORS.secondary);
    doc.text('Scan Image:', PAGE.marginLeft, yPos);
    yPos += 3;
    try {
      const boxW = 85;
      const boxH = 55;
      const fit = fitImageToBox(doc, eq.scanImage, boxW, boxH);
      doc.addImage(
        eq.scanImage,
        detectImageFormat(eq.scanImage),
        PAGE.marginLeft + (boxW - fit.width) / 2,
        yPos,
        fit.width,
        fit.height
      );
      yPos += boxH + 3;
    } catch {
      doc.setFontSize(7);
      doc.setTextColor(...COLORS.lightText);
      doc.text('[Scan image not available]', PAGE.marginLeft, yPos);
      yPos += 5;
    }
  }

  yPos += 3;

  // Software
  yPos = addSubSectionTitle('Software', yPos);

  yPos = addFieldRow([
    { label: 'Name', value: eq?.softwareName || '-' },
    { label: 'Version', value: eq?.softwareVersion || '-' },
    { label: 'Config', value: eq?.utConfigName || '-' },
  ], yPos);

  yPos += 3;

  // Calibration Block
  yPos = addSubSectionTitle('Calibration Block', yPos);

  yPos = addFieldRow([
    { label: 'Serial No.', value: eq?.calibrationBlockSerial || '-' },
    { label: 'Material', value: eq?.calibrationBlockMaterial || '-' },
  ], yPos);

  yPos = addFieldRow([
    { label: 'Thickness', value: eq?.calibrationBlockThickness || '-' },
    { label: 'Valid Until', value: eq?.calibrationValidUntil || '-' },
  ], yPos);

  // NIST checkbox
  const nistChecked = eq?.nistTraceability;
  if (nistChecked) {
    doc.setFillColor(...COLORS.success);
    doc.rect(PAGE.marginLeft, yPos - 3, 4, 4, 'F');
    drawCheckMark(PAGE.marginLeft, yPos - 3, 4);
  } else {
    doc.setDrawColor(...COLORS.tableBorder);
    doc.rect(PAGE.marginLeft, yPos - 3, 4, 4, 'S');
  }
  doc.setFontSize(8);
  doc.setTextColor(...COLORS.text);
  doc.text('NIST Traceable', PAGE.marginLeft + 6, yPos);
  yPos += 5;

  // Calibration block type
  if (eq?.calibrationBlockType) {
    yPos = addField('Block Type', eq.calibrationBlockType, PAGE.marginLeft, yPos, 25);
  }

  // Calibration model images (dynamic per part)
  if (eq?.includeCalibrationImages && eq?.calibrationBlockImages && eq.calibrationBlockImages.length > 0) {
    yPos = checkPageBreak(65);
    yPos += 3;
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...COLORS.secondary);
    doc.text('Calibration Model Images:', PAGE.marginLeft, yPos);
    yPos += 3;

    const imgWidth = 80;
    const imgHeight = 55;
    let imgX = PAGE.marginLeft;

    eq.calibrationBlockImages.forEach((img, idx) => {
      if (idx > 0 && idx % 2 === 0) {
        // Move to next row
        yPos += imgHeight + 5;
        imgX = PAGE.marginLeft;
        yPos = checkPageBreak(imgHeight + 10);
      }
      try {
        const fit = fitImageToBox(doc, img, imgWidth, imgHeight);
        doc.addImage(
          img,
          detectImageFormat(img),
          imgX + (imgWidth - fit.width) / 2,
          yPos + (imgHeight - fit.height) / 2,
          fit.width,
          fit.height
        );
      } catch {
        doc.setFontSize(7);
        doc.setTextColor(...COLORS.lightText);
        doc.text(`[Image ${idx + 1} not available]`, imgX, yPos + imgHeight / 2);
      }
      imgX += imgWidth + 10;
    });

    yPos += imgHeight + 5;
  }

  yPos += 3;

  // Probe Details Table
  if (data.probeDetails && data.probeDetails.length > 0) {
    yPos = checkPageBreak(50);
    yPos = addSectionTitle('PROBE DETAILS', yPos);

    // Filter out null/undefined probes and safely map their properties
    const probeRows = data.probeDetails
      .filter((probe): probe is NonNullable<typeof probe> => probe != null)
      .map(probe => [
        probe.probeDescription || '-',
        probe.frequency || '-',
        probe.make || '-',
        probe.waveMode || '-',
        probe.scanningDirections || '-',
      ]);

    autoTable(doc, {
      startY: yPos,
      head: [['Probe Description', 'Frequency', 'Make', 'Wave Mode', 'Scan Direction']],
      body: probeRows,
      theme: 'grid',
      styles: { fontSize: 7, cellPadding: 2 },
      headStyles: {
        fillColor: COLORS.primary,
        textColor: [255, 255, 255],
        fontStyle: 'bold',
      },
      alternateRowStyles: { fillColor: COLORS.rowAlt },
      tableLineColor: COLORS.tableBorder,
      margin: { left: PAGE.marginLeft, right: PAGE.marginRight },
    });

    yPos = (doc as any).lastAutoTable.finalY + 5;
  }

  addFooter(currentPage, totalPages);

  // ============================================================================
  // PAGE 3: AEROSPACE FORGING PARAMETERS (Optional)
  // ============================================================================

  if (includeAerospaceSection) {
    doc.addPage();
    currentPage++;
    yPos = addHeader();

    yPos = addSectionTitle('AEROSPACE FORGING UT PARAMETERS', yPos);

    // Subtitle
    doc.setFontSize(8);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(...COLORS.lightText);
    doc.text('Per AMS-STD-2154 / ASTM E2375 / ASTM A388', PAGE.marginLeft, yPos);
    yPos += 6;

    // Test Location & Timing
    const loc = data.testLocationTiming;
    yPos = addSubSectionTitle('Test Location & Timing', yPos);

    yPos = addFieldRow([
      { label: 'Location', value: loc?.inspectionLocation || '-' },
      { label: 'Facility', value: loc?.facilityName || '-' },
      { label: 'Test Date', value: loc?.testDate || '-' },
    ], yPos);

    yPos = addFieldRow([
      { label: 'Start Time', value: loc?.testStartTime || '-' },
      { label: 'End Time', value: loc?.testEndTime || '-' },
      { label: 'Duration', value: loc?.inspectionDuration || '-' },
    ], yPos);

    yPos += 3;

    // Environmental Conditions
    const env = data.environmentalConditions;
    yPos = addSubSectionTitle('Environmental Conditions', yPos);

    yPos = addFieldRow([
      { label: 'Ambient Temp', value: env?.ambientTemperature || '-' },
      { label: 'Part Temp', value: env?.partTemperature || '-' },
    ], yPos);

    yPos += 3;

    // Couplant Details
    const coup = data.couplantDetails;
    yPos = addSubSectionTitle('Couplant Details (AMS-STD-2154)', yPos);

    yPos = addFieldRow([
      { label: 'Type', value: coup?.couplantType || '-' },
      { label: 'Manufacturer', value: coup?.couplantManufacturer || '-' },
      { label: 'Batch', value: coup?.couplantBatchNumber || '-' },
    ], yPos);

    yPos += 3;

    // Sensitivity Settings
    const sens = data.sensitivitySettings;
    yPos = addSubSectionTitle('Sensitivity & Reference (AMS-STD-2154)', yPos);

    yPos = addFieldRow([
      { label: 'Ref FBH Size', value: sens?.referenceFbhSize || '-' },
      { label: 'FBH Depth', value: sens?.referenceFbhDepth || '-' },
      { label: 'Ref Level', value: sens?.referenceLevel || '-' },
    ], yPos);

    yPos = addFieldRow([
      { label: 'Scanning Sens', value: sens?.scanningSensitivity || '-' },
      { label: 'Recording Level', value: sens?.recordingLevel || '-' },
      { label: 'Rejection Level', value: sens?.rejectionLevel || '-' },
    ], yPos);

    yPos += 3;

    // ---- Acceptance Criteria (if available) ----
    const acc = data.acceptanceCriteria;
    if (acc && acc.acceptanceClass) {
      yPos = checkPageBreak(60);
      yPos = addSubSectionTitle('Acceptance Criteria (AMS-STD-2154)', yPos);

      // Acceptance Class badge
      const classDescriptions: Record<string, string> = {
        'AAA': 'Most Stringent - Critical Flight Components',
        'AA': 'Very Stringent - Primary Structure',
        'A': 'Stringent - Secondary Structure',
        'B': 'Standard - General Aerospace',
        'C': 'Least Stringent - Non-Critical Parts',
      };

      const classDesc = classDescriptions[acc.acceptanceClass] || 'Custom acceptance criteria';

      // Badge background
      doc.setFillColor(...COLORS.primary);
      doc.roundedRect(PAGE.marginLeft, yPos, 55, 14, 2, 2, 'F');

      // Badge text
      doc.setTextColor(...COLORS.white);
      doc.setFontSize(7);
      doc.setFont('helvetica', 'bold');
      doc.text('ACCEPTANCE CLASS', PAGE.marginLeft + 3, yPos + 5);
      doc.setFontSize(11);
      doc.text(acc.acceptanceClass, PAGE.marginLeft + 3, yPos + 12);

      // Description next to badge
      doc.setTextColor(...COLORS.text);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.text(classDesc, PAGE.marginLeft + 60, yPos + 9, { maxWidth: PAGE.contentWidth - 65 });

      yPos += 18;

      // Criteria table
      const criteriaRows: string[][] = [];
      criteriaRows.push(['Single Discontinuity', formatValue(acc.singleDiscontinuity)]);
      criteriaRows.push(['Multiple Discontinuities', formatValue(acc.multipleDiscontinuities)]);
      criteriaRows.push(['Linear Discontinuity', formatValue(acc.linearDiscontinuity)]);
      criteriaRows.push(['Back Reflection Loss', acc.backReflectionLoss ? `${acc.backReflectionLoss}%` : '-']);
      criteriaRows.push(['Noise Level', formatValue(acc.noiseLevel)]);

      autoTable(doc, {
        startY: yPos,
        head: [['Criterion', 'Limit']],
        body: criteriaRows,
        theme: 'grid',
        styles: { fontSize: 8, cellPadding: 2.5 },
        headStyles: {
          fillColor: COLORS.primary,
          textColor: [255, 255, 255],
          fontStyle: 'bold',
        },
        columnStyles: {
          0: { fontStyle: 'bold', cellWidth: 60 },
          1: { cellWidth: 'auto' },
        },
        alternateRowStyles: { fillColor: COLORS.rowAlt },
        tableLineColor: COLORS.tableBorder,
        tableLineWidth: 0.3,
        margin: { left: PAGE.marginLeft, right: PAGE.marginRight },
      });

      yPos = (doc as any).lastAutoTable.finalY + 5;

      // Special requirements (if any)
      if (acc.specialRequirements) {
        doc.setFontSize(7);
        doc.setFont('helvetica', 'italic');
        doc.setTextColor(...COLORS.lightText);
        const reqLines = doc.splitTextToSize(`Special Requirements: ${acc.specialRequirements}`, PAGE.contentWidth - 6);
        doc.text(reqLines, PAGE.marginLeft + 3, yPos);
        yPos += reqLines.length * 3.5 + 3;
      }

      if (acc.includeStandardNotesInReport && acc.standardNotes) {
        yPos = checkPageBreak(20);
        doc.setFontSize(7);
        doc.setFont('helvetica', 'italic');
        doc.setTextColor(...COLORS.lightText);
        const standardNoteLines = doc.splitTextToSize(`Standard Notes: ${acc.standardNotes}`, PAGE.contentWidth - 6);
        doc.text(standardNoteLines, PAGE.marginLeft + 3, yPos);
        yPos += standardNoteLines.length * 3.5 + 3;
      }

      yPos += 3;
    }

    // Scan Coverage
    const cov = data.scanCoverage;
    yPos = addSubSectionTitle('Scan Index & Coverage', yPos);

    yPos = addFieldRow([
      { label: 'Index', value: cov?.scanIndex || '-' },
      { label: 'Overlap', value: cov?.overlapPercentage || '-' },
      { label: 'Coverage', value: cov?.coveragePercentage || '-' },
    ], yPos);

    addFooter(currentPage, totalPages);
  }

  // ============================================================================
  // INDICATIONS PAGE (if any)
  // ============================================================================

  if (data.indications && data.indications.length > 0) {
    doc.addPage();
    currentPage++;
    yPos = addHeader();

    yPos = addSectionTitle('INDICATIONS DETECTED', yPos);

    const indicationRows = data.indications.map(ind => [
      ind.indicationNumber?.toString() || '-',
      ind.scanId || '-',
      ind.xDistance || '-',
      ind.yDistance || '-',
      ind.xExtension || '-',
      ind.yExtension || '-',
      ind.amplitude || '-',
      ind.soundPath || '-',
      ind.fbhEquivalentSize || '-',
      ind.amplitudeVsReference || '-',
      ind.depthZone || '-',
      ind.assessment?.toUpperCase() || '-',
    ]);

    autoTable(doc, {
      startY: yPos,
      head: [['#', 'Scan', 'X Dist', 'Y Dist', 'X Ext', 'Y Ext', 'Amp%', 'Depth', 'FBH', 'vs Ref', 'Zone', 'Result']],
      body: indicationRows,
      theme: 'grid',
      styles: { fontSize: 6, cellPadding: 1.5 },
      headStyles: {
        fillColor: COLORS.primary,
        textColor: [255, 255, 255],
        fontStyle: 'bold',
      },
      alternateRowStyles: { fillColor: COLORS.rowAlt },
      tableLineColor: COLORS.tableBorder,
      columnStyles: {
        0: { cellWidth: 8 },
        1: { cellWidth: 12 },
        11: { cellWidth: 18 },
      },
      margin: { left: PAGE.marginLeft, right: PAGE.marginRight },
      didParseCell: (cellData) => {
        if (cellData.column.index === 11 && cellData.section === 'body') {
          const value = cellData.cell.raw?.toString().toLowerCase() || '';
          if (value.includes('accept')) {
            cellData.cell.styles.textColor = COLORS.success;
            cellData.cell.styles.fontStyle = 'bold';
          } else if (value.includes('reject')) {
            cellData.cell.styles.textColor = COLORS.error;
            cellData.cell.styles.fontStyle = 'bold';
          }
        }
      },
    });

    yPos = (doc as any).lastAutoTable.finalY + 8;

    // Legend
    doc.setFontSize(7);
    doc.setTextColor(...COLORS.lightText);
    doc.text('Legend: X/Y Dist = Distance from reference | X/Y Ext = Indication size | Amp = Signal strength (% FSH)', PAGE.marginLeft, yPos);
    yPos += 4;
    doc.text('FBH = Flat Bottom Hole equivalent | vs Ref = dB relative to reference | Zone = Depth zone (Near/Mid/Far)', PAGE.marginLeft, yPos);

    addFooter(currentPage, totalPages);
  }

  // ============================================================================
  // SCANS PAGES
  // ============================================================================

  if (data.scans && data.scans.length > 0) {
    data.scans.forEach((scan, index) => {
      if (index % 2 === 0) {
        doc.addPage();
        currentPage++;
        yPos = addHeader();
        yPos = addSectionTitle('SCAN DATA', yPos);
      }

      // Scan card header
      yPos = checkPageBreak(80);

      doc.setFillColor(...COLORS.secondary);
      doc.rect(PAGE.marginLeft, yPos, 3, 6, 'F');
      doc.setFillColor(...COLORS.sectionBg);
      doc.rect(PAGE.marginLeft + 3, yPos, PAGE.contentWidth - 3, 6, 'F');

      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...COLORS.primary);
      doc.text(`Scan ${scan.scanNumber}`, PAGE.marginLeft + 6, yPos + 4.5);
      yPos += 9;

      yPos = addFieldRow([
        { label: 'Type', value: scan.scanType || '-' },
        { label: 'Length', value: scan.scanLength || '-' },
        { label: 'Index', value: scan.indexLength || '-' },
      ], yPos);

      yPos = addFieldRow([
        { label: 'Probe', value: scan.probeType || '-' },
        { label: 'Elements', value: scan.numberOfElements || '-' },
      ], yPos);

      // C-Scan & A-Scan images
      if (scan.cScanImage) {
        try {
          yPos += 3;
          doc.setFontSize(8);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(...COLORS.secondary);
          doc.text('C-Scan:', PAGE.marginLeft, yPos);
          yPos += 3;
          const boxW = 85;
          const boxH = 50;
          const cFit = fitImageToBox(doc, scan.cScanImage, boxW, boxH);
          doc.addImage(
            scan.cScanImage,
            detectImageFormat(scan.cScanImage),
            PAGE.marginLeft + (boxW - cFit.width) / 2,
            yPos + (boxH - cFit.height) / 2,
            cFit.width,
            cFit.height
          );

          if (scan.aScanImage) {
            doc.text('A-Scan:', PAGE.marginLeft + 95, yPos - 3);
            const aFit = fitImageToBox(doc, scan.aScanImage, boxW, boxH);
            doc.addImage(
              scan.aScanImage,
              detectImageFormat(scan.aScanImage),
              PAGE.marginLeft + 95 + (boxW - aFit.width) / 2,
              yPos + (boxH - aFit.height) / 2,
              aFit.width,
              aFit.height
            );
          }
          yPos += boxH + 5;
        } catch {
          doc.setTextColor(...COLORS.lightText);
          doc.text('[Image not available]', PAGE.marginLeft, yPos);
          yPos += 10;
        }
      }

      // Scan parameters
      if (scan.gain || scan.range || scan.velocity) {
        doc.setFontSize(7);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...COLORS.lightText);
        const params = [];
        if (scan.gain) params.push(`Gain: ${scan.gain}`);
        if (scan.range) params.push(`Range: ${scan.range}`);
        if (scan.velocity) params.push(`Velocity: ${scan.velocity}`);
        doc.text(params.join(' | '), PAGE.marginLeft, yPos);
        yPos += 10;
      }

      addFooter(currentPage, totalPages);
    });
  }

  // ============================================================================
  // FINAL PAGE: REMARKS & SIGNATURES
  // ============================================================================

  doc.addPage();
  currentPage++;
  yPos = addHeader();

  // Remarks
  yPos = addSectionTitle('REMARKS', yPos);

  if (data.remarks && data.remarks.length > 0) {
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...COLORS.text);

    data.remarks.forEach((remark, index) => {
      if (remark.trim()) {
        const text = `${index + 1}. ${remark}`;
        const lines = doc.splitTextToSize(text, PAGE.contentWidth - 10);
        doc.text(lines, PAGE.marginLeft + 3, yPos);
        yPos += lines.length * 4 + 2;
      }
    });
  } else {
    doc.setFontSize(8);
    doc.setTextColor(...COLORS.lightText);
    doc.text('No additional remarks.', PAGE.marginLeft + 3, yPos);
    yPos += 6;
  }

  yPos += 8;

  // Results Summary
  if (data.resultsSummary) {
    yPos = addSectionTitle('RESULTS SUMMARY', yPos);

    const rs = data.resultsSummary;
    yPos = addFieldRow([
      { label: 'Parts Inspected', value: rs.partsInspected?.toString() || '-' },
      { label: 'Conforming', value: rs.partsConforming?.toString() || '-' },
      { label: 'Non-Conforming', value: rs.partsNonConforming?.toString() || '-' },
    ], yPos);

    if (rs.conformingSerialNumbers) {
      yPos = addField('Conforming S/N', rs.conformingSerialNumbers, PAGE.marginLeft, yPos, 35);
    }
    if (rs.nonConformingSerialNumbers) {
      yPos = addField('Non-Conforming S/N', rs.nonConformingSerialNumbers, PAGE.marginLeft, yPos, 35);
    }

    yPos += 8;
  }

  // Inspector Certification
  if (data.inspectorCertification) {
    yPos = addSectionTitle('INSPECTOR CERTIFICATION', yPos);

    const cert = data.inspectorCertification;
    yPos = addFieldRow([
      { label: 'Level', value: cert.certificationLevel || '-' },
      { label: 'Standard', value: cert.certificationStandard || '-' },
    ], yPos);

    yPos = addFieldRow([
      { label: 'Certificate No.', value: cert.certificateNumber || '-' },
      { label: 'Expiry Date', value: cert.expiryDate || '-' },
    ], yPos);

    yPos += 8;
  }

  // Signatures
  yPos = addSectionTitle('APPROVAL SIGNATURES', yPos);

  // Create signature boxes
  const sigWidth = 55;
  const sigHeight = 28;
  const sigGap = 7;
  const signatures = data.signatures || {};

  // Draw signature boxes with professional styling
  const drawSignatureBox = (x: number, title: string, name?: string, date?: string) => {
    // Box background
    doc.setFillColor(...COLORS.sectionBg);
    doc.roundedRect(x, yPos, sigWidth, sigHeight, 2, 2, 'F');

    // Box border
    doc.setDrawColor(...COLORS.tableBorder);
    doc.setLineWidth(0.3);
    doc.roundedRect(x, yPos, sigWidth, sigHeight, 2, 2, 'S');

    // Title
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...COLORS.primary);
    const titleLines = doc.splitTextToSize(title, sigWidth - 6);
    doc.text(titleLines, x + 3, yPos + 5);

    // Divider line
    doc.setDrawColor(...COLORS.divider);
    const dividerY = yPos + 5 + (titleLines.length * 2.8);
    doc.line(x + 3, dividerY, x + sigWidth - 3, dividerY);

    // Name
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...COLORS.text);
    doc.text(name || '________________________', x + 3, dividerY + 7);

    // Date label and value
    doc.setFontSize(7);
    doc.setTextColor(...COLORS.lightText);
    doc.text('Date:', x + 3, yPos + 22);
    doc.setTextColor(...COLORS.text);
    doc.text(date || '______________', x + 15, yPos + 22);
  };

  drawSignatureBox(PAGE.marginLeft, 'REPORT ISSUED BY', signatures.preparedBy?.name, signatures.preparedBy?.date);
  drawSignatureBox(PAGE.marginLeft + sigWidth + sigGap, 'APPROVED BY', signatures.approvedBy?.name, signatures.approvedBy?.date);
  drawSignatureBox(
    PAGE.marginLeft + (sigWidth + sigGap) * 2,
    'AUTHORIZED BY / CUSTOMER OR MANUFACTURER',
    signatures.witness?.name,
    signatures.witness?.date,
  );

  addFooter(currentPage, totalPages);

  // ============================================================================
  // SAVE THE PDF
  // ============================================================================

  const fileName = `UT_INSPECTION_REPORT_${data.partNumber?.replace(/\//g, '-') || 'REPORT'}_${new Date().toISOString().split('T')[0]}.pdf`;
  doc.save(fileName);
};

export default exportInspectionReportPDF;
