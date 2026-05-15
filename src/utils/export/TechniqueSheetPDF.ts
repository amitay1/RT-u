// @ts-nocheck
/**
 * TechniqueSheetPDF - Professional PDF Export for Technique Sheets
 *
 * 100% DYNAMIC - Every field comes from user data
 * NO HARDCODED VALUES - Empty fields show "-" or "N/A"
 *
 * Structure:
 * Page 1: Cover Page
 * Page 2: Table of Contents
 * Page 3: Part Information (Setup)
 * Page 4: Equipment
 * Page 5: Calibration Details
 * Page 6: Calibration Block Diagram
 * Page 7: Scan Parameters
 * Page 8: Acceptance Criteria
 * Page 9: Scan Details & Directions
 * Page 10: Technical Drawing (if available)
 * Page 11: Documentation
 * Page 12: Approval Signatures
 */

import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type {
  StandardType,
  InspectionSetupData,
  EquipmentData,
  CalibrationData,
  ScanParametersData,
  AcceptanceCriteriaData,
  DocumentationData,
  ScanPlanData,
} from '@/types/techniqueSheet';
import type { ScanDetailsData } from '@/types/scanDetails';
import { getActiveScanDetails } from '@/utils/scanDetailsSelection';
import {
  isActiveMroStandard,
  isPwaSimStandard as isPwaSimOemStandard,
  isPwOemStandard,
} from '@/utils/mroPolicy';
import { requiresAngleBeam } from '@/utils/beamTypeClassification';
import { resolveWallThickness } from '@/utils/inspectionThickness';
import {
  formatTubeAngleBeamRange,
  getTubeAngleBeamDrawing,
  isTubeAngleBeamPartType,
} from '@/utils/tubeAngleBeamDrawings';
import { DEFAULT_ANGLE_BEAM_CALIBRATION_ROWS } from '@/data/fbhStandardsData';
import {
  COLORS,
  PAGE,
  FONTS,
  VISUAL,
  formatValue,
  formatNumber,
  formatDate,
  formatPartType,
  formatMaterial,
  formatBlockType,
  formatScanMethod,
  formatTransducerType,
  formatTransducerShape,
  formatAcceptanceClass,
  isCylindrical,
  isCone,
  getPartDimensionRows,
  getMaterialWarning,
  buildTableRows,
  detectImageFormat,
  fitImageToBox,
} from './exportHelpers';

// ============================================================================
// TYPES
// ============================================================================
export interface TechniqueSheetExportData {
  standard: StandardType;
  inspectionSetup: InspectionSetupData;
  equipment: EquipmentData;
  calibration: CalibrationData;
  scanParameters: ScanParametersData;
  acceptanceCriteria: AcceptanceCriteriaData;
  documentation: DocumentationData;
  scanDetails?: ScanDetailsData;
  scanPlan?: ScanPlanData; // Scan plan documents (list of linked PDFs/procedures)
  capturedDrawing?: string; // Base64 image of technical drawing
  calibrationBlockDiagram?: string; // Base64 image of FBH/straight beam calibration block
  angleBeamDiagram?: string; // Base64 image of angle beam calibration block (for circular parts)
  e2375Diagram?: string; // Base64 image of ASTM E2375 scan directions diagram
  scanDirectionsDrawing?: string; // Base64 image of scan directions (from InspectionPlanViewer)
}

export interface ExportOptions {
  companyName?: string;
  companyLogo?: string;
  showLogoOnEveryPage?: boolean; // When false, hide logo from all pages (default: true)
  documentNumber?: string;
  previewInNewTab?: boolean; // Open PDF in new browser tab instead of downloading
}

// Type declaration for Electron API
interface ElectronAPI {
  isElectron: boolean;
  savePDF?: (data: string, filename: string) => Promise<{ success: boolean; path?: string; error?: string; cancelled?: boolean }>;
}

// ============================================================================
// MAIN EXPORT FUNCTION
// ============================================================================
export function exportTechniqueSheetPDF(
  data: TechniqueSheetExportData,
  options: ExportOptions = {}
): void {
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const exporter = new TechniqueSheetPDFBuilder(pdf, data, options);
  exporter.build();

  // Generate filename from part number and date
  const partNumber = data.inspectionSetup.partNumber || 'TechniqueSheet';
  const date = new Date().toISOString().split('T')[0];
  const filename = `${partNumber}_TechniqueSheet_${date}.pdf`;

  // If preview mode - open in new tab instead of downloading
  if (options.previewInNewTab) {
    openPdfInNewTab(pdf, filename);
    return;
  }

  // Check if we're in Electron environment
  const electronApi = typeof window !== 'undefined'
    ? (window as unknown as { electron?: ElectronAPI }).electron
    : undefined;
  const isElectron = electronApi?.isElectron === true;

  if (isElectron && electronApi?.savePDF) {
    // For Electron: use IPC to save PDF through main process (most reliable)
    try {
      // Get PDF as base64
      const pdfBase64 = pdf.output('datauristring').split(',')[1];

      // Call Electron's save dialog
      electronApi.savePDF(pdfBase64, filename)
        .then((result) => {
          if (result.success) {
            console.log('PDF saved successfully:', result.path);
          } else if (result.cancelled) {
            console.log('PDF save cancelled by user');
          } else {
            console.error('PDF save failed:', result.error);
            // Fallback to blob download
            fallbackBlobDownload(pdf, filename);
          }
        })
        .catch((error) => {
          console.error('Electron PDF save error:', error);
          fallbackBlobDownload(pdf, filename);
        });
    } catch (error) {
      console.error('Electron PDF export error:', error);
      // Fallback to blob download
      fallbackBlobDownload(pdf, filename);
    }
  } else {
    // For regular browser: use standard jsPDF save
    pdf.save(filename);
  }
}

// Store reference to preview window for reuse
let previewWindow: Window | null = null;
let previousBlobUrl: string | null = null;

// Open PDF in a browser tab for preview (reuses same window for live updates)
function openPdfInNewTab(pdf: jsPDF, filename: string): void {
  try {
    // Clean up previous blob URL
    if (previousBlobUrl) {
      URL.revokeObjectURL(previousBlobUrl);
    }

    const pdfBlob = pdf.output('blob');
    const blobUrl = URL.createObjectURL(pdfBlob);
    previousBlobUrl = blobUrl;

    // Try to reuse existing preview window
    if (previewWindow && !previewWindow.closed) {
      // Update the existing window
      previewWindow.location.href = blobUrl;
      previewWindow.focus();
      console.log('PDF preview updated in existing tab:', filename);
    } else {
      // Open new window with a specific name so it can be reused
      previewWindow = window.open(blobUrl, 'pdf_preview');

      if (previewWindow) {
        previewWindow.focus();
        console.log('PDF preview opened in new tab:', filename);
      } else {
        // Popup blocked - fall back to download
        console.warn('Popup blocked, falling back to download');
        fallbackBlobDownload(pdf, filename);
      }
    }
  } catch (error) {
    console.error('Failed to open PDF in new tab:', error);
    fallbackBlobDownload(pdf, filename);
  }
}

// Fallback method using blob URL download
function fallbackBlobDownload(pdf: jsPDF, filename: string): void {
  try {
    const pdfBlob = pdf.output('blob');
    const blobUrl = URL.createObjectURL(pdfBlob);

    // Create a temporary link and click it to trigger download
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = filename;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();

    // Cleanup after a short delay
    setTimeout(() => {
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
    }, 1000);

    console.log('PDF fallback download initiated:', filename);
  } catch (fallbackError) {
    console.error('Fallback download also failed:', fallbackError);
    // Last resort: use standard jsPDF save
    pdf.save(filename);
  }
}

// ============================================================================
// PDF BUILDER CLASS
// ============================================================================
class TechniqueSheetPDFBuilder {
  private pdf: jsPDF;
  private data: TechniqueSheetExportData;
  private options: ExportOptions;
  private currentPage: number = 1;
  private totalPages: number = 12; // Will be calculated
  private pageMapping: Map<string, number> = new Map();

  constructor(pdf: jsPDF, data: TechniqueSheetExportData, options: ExportOptions) {
    this.pdf = pdf;
    this.data = data;
    this.options = options;
    this.calculatePages();
  }

  /** Check if current standard is a Pratt & Whitney OEM standard */
  private isPWStandard(): boolean {
    return isPwOemStandard(this.data.standard);
  }

  private isV2500MroStandard(): boolean {
    return isActiveMroStandard(this.data.standard);
  }

  private isPwaSimStandard(): boolean {
    return isPwaSimOemStandard(this.data.standard);
  }

  // Safely get the final Y position after autoTable
  private getTableEndY(fallbackY: number, extraSpace = 10): number {
    const pdfWithTable = this.pdf as unknown as { lastAutoTable?: { finalY?: number } };
    const finalY = pdfWithTable.lastAutoTable?.finalY;
    if (typeof finalY === 'number' && !isNaN(finalY)) {
      return finalY + extraSpace;
    }
    return fallbackY + 30 + extraSpace; // Fallback: assume table took ~30mm
  }

  // Calculate total pages based on content
  private calculatePages(): void {
    let pages = 10; // Base pages (cover, toc, setup, equipment, calibration, cal-diagram, scan-params, acceptance, docs, approvals)

    if (this.hasAngleBeamDiagramPage()) pages++; // Angle beam calibration block diagram
    if (this.data.scanDetails) pages++; // Scan details table page
    if (this.data.e2375Diagram) pages++; // E2375 scan directions diagram
    if (this.data.scanDirectionsDrawing) pages++; // Scan directions drawing page
    if (this.hasTechnicalDrawingPage()) pages++; // Technical drawing page
    // Safe check for scan plan documents
    const scanPlanDocs = this.data.scanPlan?.documents || [];
    if (scanPlanDocs.filter(d => d && d.isActive).length > 0) pages++; // Scan plan page

    this.totalPages = pages;

    // Build page mapping - ORDER MATCHES UI TABS
    let page = 1;
    this.pageMapping.set('cover', page++);
    this.pageMapping.set('toc', page++);

    // 1. Setup (Part Information + Technical Drawing)
    this.pageMapping.set('setup', page++);
    if (this.hasTechnicalDrawingPage()) {
      this.pageMapping.set('technical-drawing', page++);
    }

    // 2. Scan Parameters
    this.pageMapping.set('scan-parameters', page++);

    // 3. Equipment
    this.pageMapping.set('equipment', page++);

    // 4. Acceptance
    this.pageMapping.set('acceptance', page++);
    if (this.hasAcceptanceNotesPage()) {
      this.pageMapping.set('acceptance-notes', page++);
    }

    // 5. Scan Details
    if (this.data.scanDetails) {
      this.pageMapping.set('scan-details', page++);
    }
    if (this.data.e2375Diagram) {
      this.pageMapping.set('e2375-diagram', page++);
    }
    if (this.data.scanDirectionsDrawing) {
      this.pageMapping.set('scan-directions-drawing', page++);
    }

    // 6. Documentation
    this.pageMapping.set('documentation', page++);

    // 7. Reference Standard (Calibration)
    this.pageMapping.set('calibration', page++);
    this.pageMapping.set('calibration-diagram', page++);
    if (this.hasAngleBeamDiagramPage()) {
      this.pageMapping.set('angle-beam-diagram', page++);
    }

    // 8. Scan Plan
    if (scanPlanDocs.filter(d => d && d.isActive).length > 0) {
      this.pageMapping.set('scan-plan', page++);
    }

    // Approvals
    this.pageMapping.set('approvals', page++);

    this.totalPages = page - 1;
  }

  private hasActiveScanPlanDocuments(): boolean {
    const scanPlanDocs = this.data.scanPlan?.documents || [];
    return scanPlanDocs.some((doc) => doc && doc.isActive);
  }

  private hasScanDetailSection(): boolean {
    return Boolean(this.data.scanDetails || this.data.e2375Diagram || this.data.scanDirectionsDrawing);
  }

  private hasTechnicalDrawingPage(): boolean {
    return Boolean(this.data.inspectionSetup.partType || this.data.capturedDrawing);
  }

  private hasAngleBeamDiagramPage(): boolean {
    return Boolean(
      this.data.angleBeamDiagram ||
      requiresAngleBeam(this.data.inspectionSetup.partType, this.data.inspectionSetup.isHollow) ||
      this.data.calibration.standardType === 'angle_beam' ||
      (this.data.calibration.angleBeamCalibrationRows && this.data.calibration.angleBeamCalibrationRows.length > 0)
    );
  }

  private getAngleBeamCalibrationRows() {
    const rows = this.data.calibration.angleBeamCalibrationRows || [];
    return rows.length > 0 ? rows : (this.hasAngleBeamDiagramPage() ? DEFAULT_ANGLE_BEAM_CALIBRATION_ROWS : []);
  }

  private getCalibrationFbhHoles() {
    const cal = this.data.calibration;
    const structuredHoles = Array.isArray(cal.fbhHoles) ? cal.fbhHoles.filter(Boolean).slice(0, 3) : [];
    if (structuredHoles.length > 0) return structuredHoles;

    const sizes = String(cal.fbhSizes || '')
      .split(/[,;\n]+/)
      .map((size) => size.trim())
      .filter(Boolean)
      .slice(0, 3);

    return sizes.map((size, index) => {
      const travel = Number(cal.metalTravelDistance) || 25;
      return {
        id: index + 1,
        partNumber: this.data.inspectionSetup.partNumber || '-',
        deltaType: 'ref',
        diameterInch: size,
        diameterMm: this.convertInchFractionToMm(size),
        blockHeightE: travel,
        metalTravelH: travel,
      };
    });
  }

  private convertInchFractionToMm(value: string): number {
    const clean = String(value || '').replace(/"/g, '').trim();
    const fractionMatch = clean.match(/^(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)$/);
    if (fractionMatch) {
      const numerator = Number(fractionMatch[1]);
      const denominator = Number(fractionMatch[2]);
      return denominator ? Number(((numerator / denominator) * 25.4).toFixed(3)) : 0;
    }
    const numeric = Number(clean);
    return Number.isFinite(numeric) ? Number((numeric * 25.4).toFixed(3)) : 0;
  }

  private hasAcceptanceNotesPage(): boolean {
    return Boolean(
      this.data.acceptanceCriteria.includeStandardNotesInReport &&
      (this.data.standard === 'AMS-STD-2154E' || this.data.standard === 'MIL-STD-2154')
    );
  }

  private getAcceptanceNotesSectionNumber(): string {
    return `${this.getMainSectionNumber('acceptance')}.1`;
  }

  private getMainSectionOrder(): Array<
    | 'part-information'
    | 'scan-parameters'
    | 'equipment'
    | 'acceptance'
    | 'scan-details'
    | 'documentation'
    | 'reference-standard'
    | 'scan-plan'
    | 'approvals'
  > {
    const order: Array<
      | 'part-information'
      | 'scan-parameters'
      | 'equipment'
      | 'acceptance'
      | 'scan-details'
      | 'documentation'
      | 'reference-standard'
      | 'scan-plan'
      | 'approvals'
    > = [
      'part-information',
      'scan-parameters',
      'equipment',
      'acceptance',
    ];

    if (this.hasScanDetailSection()) {
      order.push('scan-details');
    }

    order.push('documentation', 'reference-standard');

    if (this.hasActiveScanPlanDocuments()) {
      order.push('scan-plan');
    }

    order.push('approvals');
    return order;
  }

  private getMainSectionNumber(
    sectionKey:
      | 'part-information'
      | 'scan-parameters'
      | 'equipment'
      | 'acceptance'
      | 'scan-details'
      | 'documentation'
      | 'reference-standard'
      | 'scan-plan'
      | 'approvals',
  ): number {
    const index = this.getMainSectionOrder().indexOf(sectionKey);
    return index >= 0 ? index + 1 : 0;
  }

  private getTechnicalDrawingSectionNumber(): string {
    return `${this.getMainSectionNumber('part-information')}.1`;
  }

  private getScanSectionNumberFor(kind: 'scan-details' | 'e2375' | 'scan-directions'): string {
    const main = `${this.getMainSectionNumber('scan-details')}`;
    let childIndex = 0;

    if (this.data.scanDetails) {
      if (kind === 'scan-details') {
        return main;
      }
      childIndex += 1;
    }

    if (this.data.e2375Diagram) {
      if (kind === 'e2375') {
        return childIndex === 0 ? main : `${main}.${childIndex}`;
      }
      childIndex += 1;
    }

    if (kind === 'scan-directions') {
      return childIndex === 0 ? main : `${main}.${childIndex}`;
    }

    return main;
  }

  private getReferenceStandardSectionNumber(): number {
    return this.getMainSectionNumber('reference-standard');
  }

  private getCalibrationDiagramSectionNumber(): string {
    return `${this.getReferenceStandardSectionNumber()}.1`;
  }

  private getAngleBeamDiagramSectionNumber(): string {
    return `${this.getReferenceStandardSectionNumber()}.2`;
  }

  private formatSectionLabel(number: number | string, title: string): string {
    const normalized = String(number);
    return normalized.includes('.') ? `${normalized} ${title}` : `${normalized}. ${title}`;
  }

  private formatTocNumber(number: number | string, title: string): string {
    const normalized = String(number);
    const prefix = normalized.includes('.') ? '   ' : '';
    return `${prefix}${this.formatSectionLabel(normalized, title)}`;
  }

  // Build the complete PDF
  // ORDER MATCHES UI TABS: Setup → Equipment → Scan Params → Acceptance → Scan Details → Documentation → Reference Standard → Scan Plan
  public build(): void {
    this.buildCoverPage();
    this.addNewPage();
    this.buildTableOfContents();

    // 1. SETUP (Part Information + Technical Drawing)
    this.addNewPage();
    this.buildPartInformation();

    if (this.hasTechnicalDrawingPage()) {
      this.addNewPage();
      this.buildTechnicalDrawing();
    }

    // 2. SCAN PARAMETERS
    this.addNewPage();
    this.buildScanParameters();

    // 3. EQUIPMENT
    this.addNewPage();
    this.buildEquipment();

    // 4. ACCEPTANCE CRITERIA
    this.addNewPage();
    this.buildAcceptanceCriteria();

    // 5. SCAN DETAILS (table + diagrams)
    if (this.data.scanDetails) {
      this.addNewPage();
      this.buildScanDetails();
    }

    // Add E2375 scan directions diagram if available
    if (this.data.e2375Diagram) {
      this.addNewPage();
      this.buildE2375Diagram();
    }

    if (this.data.scanDirectionsDrawing) {
      this.addNewPage();
      this.buildScanDirectionsDrawing();
    }

    // 6. DOCUMENTATION (moved before calibration)
    this.addNewPage();
    this.buildDocumentation();

    // 7. REFERENCE STANDARD (Calibration)
    this.addNewPage();
    this.buildCalibration();
    this.addNewPage();
    this.buildCalibrationDiagram();

    // Add angle beam calibration diagram for circular/angle-beam parts.
    if (this.hasAngleBeamDiagramPage()) {
      this.addNewPage();
      this.buildAngleBeamDiagram();
    }

    // 8. SCAN PLAN (last tab)
    const scanPlanDocsForBuild = this.data.scanPlan?.documents || [];
    if (scanPlanDocsForBuild.filter(d => d && d.isActive).length > 0) {
      this.addNewPage();
      this.buildScanPlan();
    }

    // APPROVALS (final page)
    this.addNewPage();
    this.buildApprovals();
  }

  // =========================================================================
  // PAGE UTILITIES
  // =========================================================================

  private addNewPage(): void {
    this.pdf.addPage();
    this.currentPage++;
  }

  private addHeader(): void {
    const doc = this.data.documentation;
    const setup = this.data.inspectionSetup;

    // ========== FRISA-STYLE PROFESSIONAL HEADER ==========
    // Main header background
    this.pdf.setFillColor(...COLORS.primary);
    this.pdf.rect(0, 0, PAGE.width, PAGE.headerHeight, 'F');

    // Gold accent line at bottom
    this.pdf.setFillColor(...COLORS.accentGold);
    this.pdf.rect(0, PAGE.headerHeight - 1, PAGE.width, 1, 'F');

    // Company logo (left side)
    let textStartX = PAGE.marginLeft;

    if (this.options.companyLogo && this.options.showLogoOnEveryPage !== false) {
      try {
        const imgProps = this.pdf.getImageProperties(this.options.companyLogo);
        const aspectRatio = imgProps.width / imgProps.height;
        let logoHeight = PAGE.headerHeight - 5;
        let logoWidth = logoHeight * aspectRatio;
        if (logoWidth > 28) {
          logoWidth = 28;
          logoHeight = logoWidth / aspectRatio;
        }
        this.pdf.addImage(this.options.companyLogo, 'AUTO', PAGE.marginLeft, 2, logoWidth, logoHeight, undefined, 'FAST');
        textStartX = PAGE.marginLeft + logoWidth + 3;
      } catch (e) {
        console.warn('Failed to add company logo:', e);
      }
    }

    // Document title and company name (left-center)
    this.pdf.setTextColor(255, 255, 255);
    this.pdf.setFontSize(10);
    this.pdf.setFont('helvetica', 'bold');
    this.pdf.text('UT TECHNIQUE SHEET', textStartX, 7);

    if (this.options.companyName) {
      this.pdf.setFontSize(7);
      this.pdf.setFont('helvetica', 'normal');
      this.pdf.setTextColor(200, 220, 240);
      this.pdf.text(this.options.companyName, textStartX, 12);
    }

    // Document Info Box (right side - FRISA style)
    const boxWidth = 48;
    const boxX = PAGE.width - PAGE.marginRight - boxWidth;
    this.pdf.setFillColor(255, 255, 255);
    this.pdf.roundedRect(boxX, 1.5, boxWidth, PAGE.headerHeight - 4, 1.5, 1.5, 'F');

    // Info in box - compact layout
    this.pdf.setFontSize(6);
    this.pdf.setFont('helvetica', 'bold');
    this.pdf.setTextColor(...COLORS.lightText);

    const docNum = this.options.documentNumber || doc.procedureNumber || `TS-${setup.partNumber || 'XXX'}`;

    // Row 1: Doc No
    this.pdf.text('Doc:', boxX + 2, 5);
    this.pdf.setTextColor(...COLORS.primaryDark);
    this.pdf.setFontSize(7);
    this.pdf.text(docNum, boxX + 12, 5);

    // Row 2: Rev and Page
    this.pdf.setFontSize(6);
    this.pdf.setTextColor(...COLORS.lightText);
    this.pdf.text('Rev:', boxX + 2, 9.5);
    this.pdf.setTextColor(...COLORS.primaryDark);
    this.pdf.text(doc.revision || 'A', boxX + 12, 9.5);

    this.pdf.setTextColor(...COLORS.lightText);
    this.pdf.text('Page:', boxX + 24, 9.5);
    this.pdf.setTextColor(...COLORS.primaryDark);
    this.pdf.text(`${this.currentPage}/${this.totalPages}`, boxX + 35, 9.5);

    // Part number display (between title and box)
    if (setup.partNumber) {
      const pnX = boxX - 5;
      this.pdf.setFontSize(6);
      this.pdf.setTextColor(180, 200, 220);
      this.pdf.text('P/N:', pnX - 25, 5);
      this.pdf.setFontSize(8);
      this.pdf.setFont('helvetica', 'bold');
      this.pdf.setTextColor(255, 255, 255);
      this.pdf.text(setup.partNumber, pnX - 25, 11);
    }

    this.pdf.setTextColor(...COLORS.text);
  }

  private addFooter(): void {
    const doc = this.data.documentation;
    const setup = this.data.inspectionSetup;
    const footerY = PAGE.height - PAGE.footerHeight;

    // ========== FRISA-STYLE PROFESSIONAL FOOTER ==========
    // Top accent lines
    this.pdf.setFillColor(...COLORS.accentGold);
    this.pdf.rect(0, footerY, PAGE.width, 0.5, 'F');
    this.pdf.setFillColor(...COLORS.primary);
    this.pdf.rect(0, footerY + 0.5, PAGE.width, 0.3, 'F');

    // Footer background
    this.pdf.setFillColor(...COLORS.sectionBg);
    this.pdf.rect(0, footerY + 0.8, PAGE.width, PAGE.footerHeight - 0.8, 'F');

    const textY = footerY + 6;

    // Left: Document info
    const docNum = this.options.documentNumber || doc.procedureNumber || `TS-${setup.partNumber || 'XXX'}`;
    this.pdf.setFontSize(7);
    this.pdf.setFont('helvetica', 'bold');
    this.pdf.setTextColor(...COLORS.primary);
    this.pdf.text(docNum, PAGE.marginLeft, textY);

    this.pdf.setFont('helvetica', 'normal');
    this.pdf.setTextColor(...COLORS.lightText);
    this.pdf.text(` | Rev. ${doc.revision || 'A'} | ${formatValue(this.data.standard)}`, PAGE.marginLeft + this.pdf.getTextWidth(docNum), textY);

    // Center: Part number
    this.pdf.setFontSize(7);
    this.pdf.setTextColor(...COLORS.lightText);
    this.pdf.text(`P/N: ${setup.partNumber || '-'}`, PAGE.width / 2, textY, { align: 'center' });

    // Right: Page number with format "Page X of Y | Date"
    this.pdf.setFontSize(7);
    this.pdf.setFont('helvetica', 'bold');
    this.pdf.setTextColor(...COLORS.primary);
    this.pdf.text(`Page ${this.currentPage} of ${this.totalPages}`, PAGE.width - PAGE.marginRight, textY, { align: 'right' });

    this.pdf.setTextColor(...COLORS.text);
  }

  // Helper to calculate proper image dimensions preserving aspect ratio
  private calculateImageDimensions(
    imageData: string,
    maxWidth: number,
    maxHeight: number
  ): { width: number; height: number } {
    // Fallback to 4:3 ratio
    const fallbackRatio = 4 / 3;
    const getFallbackDimensions = () => {
      let imgWidth = maxWidth;
      let imgHeight = maxWidth / fallbackRatio;
      if (imgHeight > maxHeight) {
        imgHeight = maxHeight;
        imgWidth = maxHeight * fallbackRatio;
      }
      return { width: imgWidth, height: imgHeight };
    };

    try {
      // Validate image data
      if (!imageData || typeof imageData !== 'string' || imageData.length < 50) {
        console.warn('[PDF] Invalid image data, using fallback dimensions');
        return getFallbackDimensions();
      }

      const imgProps = this.pdf.getImageProperties(imageData);

      // Validate dimensions - prevent division by zero
      if (!imgProps.width || !imgProps.height || imgProps.height === 0) {
        console.warn('[PDF] Image has invalid dimensions, using fallback');
        return getFallbackDimensions();
      }

      const aspectRatio = imgProps.width / imgProps.height;

      // Validate aspect ratio - prevent Infinity/NaN
      if (!isFinite(aspectRatio) || isNaN(aspectRatio) || aspectRatio <= 0) {
        console.warn('[PDF] Invalid aspect ratio, using fallback');
        return getFallbackDimensions();
      }

      let imgWidth = maxWidth;
      let imgHeight = maxWidth / aspectRatio;

      // If height exceeds max, scale based on height instead
      if (imgHeight > maxHeight) {
        imgHeight = maxHeight;
        imgWidth = maxHeight * aspectRatio;
      }

      return { width: imgWidth, height: imgHeight };
    } catch (error) {
      console.warn('[PDF] Failed to read image properties:', error);
      return getFallbackDimensions();
    }
  }

  private isUsableCapturedDiagram(imageData: string | undefined, minWidth = 180, minHeight = 120): boolean {
    if (!imageData) return false;

    try {
      const imgProps = this.pdf.getImageProperties(imageData);
      const width = Number(imgProps.width) || 0;
      const height = Number(imgProps.height) || 0;

      return width >= minWidth && height >= minHeight && width * height >= minWidth * minHeight;
    } catch {
      return false;
    }
  }

  private addSectionTitle(title: string, y: number): number {
    // ========== ULTIMATE SECTION HEADER ==========
    const sectionHeight = 12;

    // Subtle shadow
    this.pdf.setFillColor(...COLORS.divider);
    this.pdf.roundedRect(PAGE.marginLeft + 0.5, y - 3.5, PAGE.contentWidth, sectionHeight, VISUAL.radiusMedium, VISUAL.radiusMedium, 'F');

    // Background bar with TUV blue
    this.pdf.setFillColor(...COLORS.primary);
    this.pdf.roundedRect(PAGE.marginLeft, y - 4, PAGE.contentWidth, sectionHeight, VISUAL.radiusMedium, VISUAL.radiusMedium, 'F');

    // Gold left accent bar
    this.pdf.setFillColor(...COLORS.accentGold);
    this.pdf.roundedRect(PAGE.marginLeft, y - 4, 4, sectionHeight, VISUAL.radiusMedium, VISUAL.radiusMedium, 'F');
    this.pdf.rect(PAGE.marginLeft + 2, y - 4, 2, sectionHeight, 'F');

    // Section title text
    this.pdf.setTextColor(255, 255, 255);
    this.pdf.setFontSize(FONTS.sectionTitle.size);
    this.pdf.setFont('helvetica', 'bold');
    this.pdf.text(title, PAGE.marginLeft + 10, y + 4);

    this.pdf.setTextColor(...COLORS.text);
    return y + 16;
  }

  private addSubsectionTitle(title: string, y: number): number {
    // ========== PREMIUM SUBSECTION HEADER ==========
    // Dual-color accent bar
    this.pdf.setFillColor(...COLORS.primary);
    this.pdf.rect(PAGE.marginLeft, y - 3, 2, 9, 'F');
    this.pdf.setFillColor(...COLORS.accentGold);
    this.pdf.rect(PAGE.marginLeft + 2, y - 3, 2, 9, 'F');

    // Subtle background
    this.pdf.setFillColor(...COLORS.sectionBg);
    this.pdf.rect(PAGE.marginLeft + 4, y - 3, PAGE.contentWidth - 4, 9, 'F');

    this.pdf.setFontSize(FONTS.subsectionTitle.size);
    this.pdf.setFont('helvetica', 'bold');
    this.pdf.setTextColor(...COLORS.primary);
    this.pdf.text(title, PAGE.marginLeft + 8, y + 3);
    this.pdf.setTextColor(...COLORS.text);
    return y + 12;
  }

  // =========================================================================
  // PAGE 1: COVER PAGE - Professional FRISA/TÜV Style Design
  // =========================================================================

  private buildCoverPage(): void {
    const setup = this.data.inspectionSetup;
    const doc = this.data.documentation;
    const acceptance = this.data.acceptanceCriteria;

    // ========== HEADER BAR (FRISA Style) ==========
    // Main header background
    this.pdf.setFillColor(...COLORS.primary);
    this.pdf.rect(0, 0, PAGE.width, 28, 'F');

    // Gold accent line at bottom of header
    this.pdf.setFillColor(...COLORS.accentGold);
    this.pdf.rect(0, 28, PAGE.width, 1.5, 'F');

    // Company logo (left side of header)
    let titleStartX = PAGE.marginLeft;
    if (this.options.companyLogo && this.options.showLogoOnEveryPage !== false) {
      try {
        const imgProps = this.pdf.getImageProperties(this.options.companyLogo);
        const aspectRatio = imgProps.width / imgProps.height;
        let logoHeight = 20;
        let logoWidth = logoHeight * aspectRatio;
        if (logoWidth > 45) {
          logoWidth = 45;
          logoHeight = logoWidth / aspectRatio;
        }
        this.pdf.addImage(this.options.companyLogo, 'AUTO', PAGE.marginLeft, 4, logoWidth, logoHeight, undefined, 'FAST');
        titleStartX = PAGE.marginLeft + logoWidth + 5;
      } catch (e) {
        console.warn('Failed to add company logo:', e);
      }
    }

    // Document title (center-left) - P&W gets custom header
    const isPWCover = this.isPWStandard();
    const coverTitle = this.isPwaSimStandard()
      ? 'P&W - SONIC INSPECTION METHOD'
      : isPWCover
        ? 'P&W - NDIP INSPECTION REQUIREMENTS'
        : 'UT TECHNIQUE SHEET';
    this.pdf.setTextColor(255, 255, 255);
    this.pdf.setFontSize(14);
    this.pdf.setFont('helvetica', 'bold');
    this.pdf.text(coverTitle, titleStartX, 12);

    // Subtitle for P&W or company name
    if (isPWCover) {
      const ndipLabels: Record<string, string> = {
        'NDIP-1226': 'NDIP-1226 Rev F - V2500 1st Stage HPT Disk',
        'NDIP-1227': 'NDIP-1227 Rev D - V2500 2nd Stage HPT Disk',
        'NDIP-1254': 'NDIP-1254 - PW1100G HPT 1st Stage Hub (AUSI)',
        'NDIP-1257': 'NDIP-1257 - PW1100G HPT 2nd Stage Hub (AUSI)',
        'NDIP-1260': 'NDIP-1260 - PW1100G HPC 8th Stage IBR-8 (AUSI)',
        'PWA-SIM': 'PWA SIM - Sonic Inspection Method (Bar/Billet/Forging)',
      };
      const ndipRef = ndipLabels[this.data.standard] || this.data.standard;
      this.pdf.setFontSize(8);
      this.pdf.setFont('helvetica', 'normal');
      this.pdf.setTextColor(200, 220, 240);
      this.pdf.text(ndipRef, titleStartX, 18);
      if (this.options.companyName) {
        this.pdf.text(this.options.companyName, titleStartX, 24);
      }
    } else if (this.options.companyName) {
      this.pdf.setFontSize(9);
      this.pdf.setFont('helvetica', 'normal');
      this.pdf.setTextColor(200, 220, 240);
      this.pdf.text(this.options.companyName, titleStartX, 20);
    }

    // Document Info Box (right side - FRISA style)
    const boxWidth = 55;
    const boxX = PAGE.width - PAGE.marginRight - boxWidth;
    this.pdf.setFillColor(255, 255, 255);
    this.pdf.roundedRect(boxX, 3, boxWidth, 22, 2, 2, 'F');

    // Document info in box
    this.pdf.setFontSize(7);
    this.pdf.setFont('helvetica', 'bold');
    this.pdf.setTextColor(...COLORS.lightText);
    this.pdf.text('Document No:', boxX + 3, 8);
    this.pdf.text('Revision:', boxX + 3, 14);
    this.pdf.text('Date:', boxX + 3, 20);

    this.pdf.setFontSize(8);
    this.pdf.setFont('helvetica', 'bold');
    this.pdf.setTextColor(...COLORS.primaryDark);
    const docNum = this.options.documentNumber || doc.procedureNumber || `TS-${setup.partNumber || 'XXX'}`;
    this.pdf.text(docNum, boxX + 28, 8);
    this.pdf.text(doc.revision || 'A', boxX + 28, 14);
    this.pdf.text(formatDate(doc.inspectionDate), boxX + 28, 20);

    // Page indicator
    this.pdf.setFontSize(7);
    this.pdf.setTextColor(200, 220, 240);
    this.pdf.text(`Page 1 of ${this.totalPages}`, PAGE.width - PAGE.marginRight, 26, { align: 'right' });

    // ========== MAIN CONTENT AREA ==========
    let y = 38;

    // ===== SUMMARY TABLE (like FRISA first page) =====
    this.pdf.setFillColor(...COLORS.sectionBg);
    this.pdf.rect(PAGE.marginLeft, y, PAGE.contentWidth, 10, 'F');
    this.pdf.setFillColor(...COLORS.primary);
    this.pdf.rect(PAGE.marginLeft, y, 4, 10, 'F');

    this.pdf.setFontSize(11);
    this.pdf.setFont('helvetica', 'bold');
    this.pdf.setTextColor(...COLORS.primary);
    this.pdf.text('DOCUMENT SUMMARY', PAGE.marginLeft + 8, y + 7);

    y += 14;

    // Summary table with key information
    const isV2500Summary = this.isV2500MroStandard();
    const summaryData = [
      ['Customer', formatValue(doc.customerName), 'Purchase Order', formatValue(doc.purchaseOrder)],
      ['Part Number', formatValue(setup.partNumber), 'Part Name', formatValue(setup.partName)],
      ['Material', formatMaterial(setup.material, setup.customMaterialName), 'Material Spec', formatValue(setup.materialSpec)],
      ['Part Type', formatPartType(setup.partType), 'Drawing No', formatValue(setup.drawingNumber)],
      ['Process Spec', formatValue(this.data.standard), isV2500Summary ? 'Rejection Basis' : 'Acceptance Class', isV2500Summary ? 'NDIP Pixel Criteria' : formatAcceptanceClass(acceptance.acceptanceClass).class],
      ['Inspection Type', formatScanMethod(this.data.scanParameters.scanMethod), isV2500Summary ? 'Rejection Mode' : 'Criticality', isV2500Summary ? 'Amplitude + TOF C-Scan' : formatAcceptanceClass(acceptance.acceptanceClass).description.split(' - ')[0] || '-'],
    ];

    // Draw summary table
    const colWidths = [35, 55, 35, 55];
    const rowHeight = 8;
    let tableY = y;

    summaryData.forEach((row, rowIndex) => {
      const isEvenRow = rowIndex % 2 === 0;

      // Row background
      if (isEvenRow) {
        this.pdf.setFillColor(...COLORS.rowAlt);
        this.pdf.rect(PAGE.marginLeft, tableY, PAGE.contentWidth, rowHeight, 'F');
      }

      // Draw cells
      let cellX = PAGE.marginLeft;
      row.forEach((cell, cellIndex) => {
        const isLabel = cellIndex % 2 === 0;

        if (isLabel) {
          // Label cell - darker background
          this.pdf.setFillColor(230, 235, 240);
          this.pdf.rect(cellX, tableY, colWidths[cellIndex], rowHeight, 'F');

          this.pdf.setFontSize(7.5);
          this.pdf.setFont('helvetica', 'bold');
          this.pdf.setTextColor(...COLORS.lightText);
        } else {
          // Value cell
          this.pdf.setFontSize(8);
          this.pdf.setFont('helvetica', 'bold');
          this.pdf.setTextColor(...COLORS.text);
        }

        this.pdf.text(cell, cellX + 2, tableY + 5.5);
        cellX += colWidths[cellIndex];
      });

      tableY += rowHeight;
    });

    // Table border
    this.pdf.setDrawColor(...COLORS.tableBorder);
    this.pdf.setLineWidth(0.3);
    this.pdf.rect(PAGE.marginLeft, y, PAGE.contentWidth, tableY - y);

    y = tableY + 8;

    // ===== PART SKETCH AREA =====
    const sketchAreaHeight = 75;
    this.pdf.setFillColor(...COLORS.sectionBg);
    this.pdf.rect(PAGE.marginLeft, y, PAGE.contentWidth, 10, 'F');
    this.pdf.setFillColor(...COLORS.secondary);
    this.pdf.rect(PAGE.marginLeft, y, 4, 10, 'F');

    this.pdf.setFontSize(11);
    this.pdf.setFont('helvetica', 'bold');
    this.pdf.setTextColor(...COLORS.secondary);
    this.pdf.text('PART SKETCH / DIMENSIONS', PAGE.marginLeft + 8, y + 7);

    y += 12;

    // Sketch box - white background for technical drawing
    this.pdf.setFillColor(255, 255, 255);
    this.pdf.rect(PAGE.marginLeft, y, PAGE.contentWidth, sketchAreaHeight, 'F');
    this.pdf.setDrawColor(...COLORS.tableBorder);
    this.pdf.setLineWidth(0.3);
    this.pdf.rect(PAGE.marginLeft, y, PAGE.contentWidth, sketchAreaHeight);

    // Add technical drawing if available, otherwise show placeholder
    if (this.data.capturedDrawing) {
      try {
        console.log('[PDF] Adding technical drawing to cover page...');
        const dims = this.calculateImageDimensions(this.data.capturedDrawing, PAGE.contentWidth - 10, sketchAreaHeight - 10);
        const imgX = PAGE.marginLeft + (PAGE.contentWidth - dims.width) / 2;
        const imgY = y + (sketchAreaHeight - dims.height) / 2;
        this.pdf.addImage(this.data.capturedDrawing, 'PNG', imgX, imgY, dims.width, dims.height, undefined, 'FAST');
        console.log('[PDF] Technical drawing added successfully');
      } catch (e) {
        console.warn('[PDF] Failed to add technical drawing:', e);
        this.drawSketchPlaceholder(y, sketchAreaHeight);
      }
    } else {
      console.log('[PDF] No captured drawing available, showing placeholder');
      this.drawSketchPlaceholder(y, sketchAreaHeight);
    }

    y += sketchAreaHeight + 8;

    // ===== KEY DIMENSIONS BOX =====
      const dimensionRows = getPartDimensionRows({ ...setup, standard: this.data.standard });
    if (dimensionRows.length > 0) {
      const visibleDimensionRows = dimensionRows.slice(0, 4);
      const lineSpacing = 4.5;
      const lineStartX = PAGE.marginLeft + 45;
      const maxInlineWidth = PAGE.contentWidth - 50;
      const dimensionLines: Array<Array<[string, string]>> = [];
      let currentLine: Array<[string, string]> = [];
      let currentLineWidth = 0;

      this.pdf.setFontSize(8);
      visibleDimensionRows.forEach(([label, value]) => {
        const labelText = `${label}: `;
        const separatorWidth = currentLine.length > 0 ? this.pdf.getTextWidth(' | ') : 0;

        this.pdf.setFont('helvetica', 'normal');
        const labelWidth = this.pdf.getTextWidth(labelText);
        this.pdf.setFont('helvetica', 'bold');
        const valueWidth = this.pdf.getTextWidth(value);
        const tokenWidth = separatorWidth + labelWidth + valueWidth + 3;

        if (currentLine.length > 0 && currentLineWidth + tokenWidth > maxInlineWidth) {
          dimensionLines.push(currentLine);
          currentLine = [[label, value]];
          currentLineWidth = labelWidth + valueWidth + 3;
        } else {
          currentLine.push([label, value]);
          currentLineWidth += tokenWidth;
        }
      });

      if (currentLine.length > 0) {
        dimensionLines.push(currentLine);
      }

      const keyDimensionHeight = Math.max(8, 4 + dimensionLines.length * lineSpacing);
      this.pdf.setFillColor(...COLORS.sectionBg);
      this.pdf.rect(PAGE.marginLeft, y, PAGE.contentWidth, keyDimensionHeight, 'F');

      this.pdf.setFontSize(9);
      this.pdf.setFont('helvetica', 'bold');
      this.pdf.setTextColor(...COLORS.primary);
      this.pdf.text('Key Dimensions:', PAGE.marginLeft + 4, y + 5.5);

      this.pdf.setFontSize(8);
      dimensionLines.forEach((line, lineIndex) => {
        let dimX = lineStartX;
        const lineY = y + 5.5 + lineIndex * lineSpacing;

        line.forEach(([label, value], itemIndex) => {
          if (itemIndex > 0) {
            this.pdf.setTextColor(...COLORS.lightText);
            this.pdf.setFont('helvetica', 'normal');
            this.pdf.text(' | ', dimX, lineY);
            dimX += this.pdf.getTextWidth(' | ');
          }

          const labelText = `${label}: `;
          this.pdf.setTextColor(...COLORS.lightText);
          this.pdf.setFont('helvetica', 'normal');
          this.pdf.text(labelText, dimX, lineY);
          dimX += this.pdf.getTextWidth(labelText);

          this.pdf.setTextColor(...COLORS.text);
          this.pdf.setFont('helvetica', 'bold');
          this.pdf.text(value, dimX, lineY);
          dimX += this.pdf.getTextWidth(value) + 3;
        });
      });

      y += keyDimensionHeight + 4;
    }

    // ===== V2500 NDIP OEM REQUIREMENTS BOX =====
    const showV2500Requirements = this.isV2500MroStandard();
    if (showV2500Requirements) {
      const stage = this.data.standard === 'NDIP-1226' ? '1st' : '2nd';
      const ndipRev = this.data.standard === 'NDIP-1226' ? 'NDIP-1226 Rev F' : 'NDIP-1227 Rev D';

      // Section header
      this.pdf.setFillColor(30, 41, 59); // Dark slate
      this.pdf.rect(PAGE.marginLeft, y, PAGE.contentWidth, 8, 'F');
      this.pdf.setFillColor(234, 179, 8); // Gold accent
      this.pdf.rect(PAGE.marginLeft, y, 4, 8, 'F');
      this.pdf.setFontSize(9);
      this.pdf.setFont('helvetica', 'bold');
      this.pdf.setTextColor(255, 255, 255);
      this.pdf.text(`PRATT & WHITNEY - V2500 ${stage} Stage HPT Disk`, PAGE.marginLeft + 8, y + 5.5);
      this.pdf.setFontSize(7);
      this.pdf.setTextColor(200, 210, 225);
      this.pdf.text(ndipRev, PAGE.marginLeft + PAGE.contentWidth - 5, y + 5.5, { align: 'right' });
      y += 10;

      // Requirements grid
      const pwRows = [
        ['Transducer', 'IAE2P16679 (5 MHz, 0.75" element, 8" focal)'],
        ['Mirror', 'IAE2P16678 (45 deg) - must be fully seated'],
        ['Calibration Block', 'IAE2P16675 (#1 FBH, holes L-S)'],
        ['Water Path', '8.0" per Section 5.1.1.2'],
        ['Scan Angles', '+/-45 deg circumferential shear wave'],
        ['Noise Limit', 'Max 7.5% FSH average, 8.5% band'],
        ['Post-Cal Tolerance', '+/-2.0 dB'],
        ['Data Transfer', 'MFT to PW MPE-NDE'],
      ];

      autoTable(this.pdf, {
        startY: y,
        body: pwRows,
        theme: 'plain',
        tableWidth: PAGE.contentWidth,
        styles: {
          fontSize: 7.5,
          cellPadding: { top: 1.8, bottom: 1.8, left: 3, right: 3 },
          overflow: 'linebreak',
          valign: 'middle',
        },
        columnStyles: {
          0: { fontStyle: 'bold', cellWidth: 42, textColor: COLORS.lightText },
          1: { cellWidth: 'auto', textColor: COLORS.text },
        },
        alternateRowStyles: { fillColor: [245, 247, 250] },
        margin: { left: PAGE.marginLeft, right: PAGE.marginRight, bottom: 18 },
      });

      y = this.getTableEndY(y, 6);
    }

    // ===== COVER REVISION SUMMARY =====
    const coverApprovalStartY = y + 6;
    const coverApprovalBlockHeight = 28;
    const footerStartY = PAGE.height - 16;

    if (coverApprovalStartY + coverApprovalBlockHeight <= footerStartY) {
      y = coverApprovalStartY;

      this.pdf.setFillColor(...COLORS.sectionBg);
      this.pdf.rect(PAGE.marginLeft, y, PAGE.contentWidth, 8, 'F');
      this.pdf.setFillColor(...COLORS.accentGold);
      this.pdf.rect(PAGE.marginLeft, y, 4, 8, 'F');

      this.pdf.setFontSize(9);
      this.pdf.setFont('helvetica', 'bold');
      this.pdf.setTextColor(...COLORS.primaryDark);
      this.pdf.text('APPROVALS', PAGE.marginLeft + 8, y + 5.5);

      y += 10;

      autoTable(this.pdf, {
        startY: y,
        head: [['Rev', 'Date', 'Description', 'Prepared', 'Approved', 'Sign']],
        body: [[
          doc.revision || 'A',
          formatDate(doc.inspectionDate),
          'Initial Release',
          doc.inspectorName || '',
          '',
          '',
        ]],
        theme: 'grid',
        tableWidth: PAGE.contentWidth,
        styles: {
          fontSize: 7.5,
          cellPadding: { top: 2, bottom: 2, left: 2, right: 2 },
          minCellHeight: 8,
          overflow: 'linebreak',
          valign: 'middle',
        },
        headStyles: { fillColor: COLORS.primary, textColor: [255, 255, 255], fontSize: 7.5 },
        columnStyles: {
          0: { cellWidth: 12, halign: 'center', fontStyle: 'bold' },
          1: { cellWidth: 26 },
          2: { cellWidth: 52 },
          3: { cellWidth: 32 },
          4: { cellWidth: 32 },
          5: { cellWidth: 26 },
        },
        margin: { left: PAGE.marginLeft, right: PAGE.marginRight, bottom: 16 },
      });
    }

    // ===== CONFIDENTIALITY FOOTER =====
    y = PAGE.height - 12;
    this.pdf.setFontSize(6);
    this.pdf.setFont('helvetica', 'normal');
    this.pdf.setTextColor(...COLORS.lightText);
    this.pdf.text('CONFIDENTIAL - This document contains proprietary inspection data. Unauthorized reproduction prohibited.', PAGE.width / 2, y, { align: 'center' });

    this.pdf.setTextColor(...COLORS.text);
  }

  // Helper method for sketch placeholder
  private drawSketchPlaceholder(y: number, height: number): void {
    this.drawGeneratedTechnicalDrawing(PAGE.marginLeft + 5, y + 5, PAGE.contentWidth - 10, height - 10, true);
    this.pdf.setTextColor(...COLORS.text);
  }

  private drawGeneratedTechnicalDrawing(x: number, y: number, width: number, height: number, compact = false): void {
    const setup = this.data.inspectionSetup;
    const partType = (setup.partType || '').toLowerCase();
    const od = setup.diameter || 0;
    const id = setup.innerDiameter || 0;
    const length = setup.partLength || setup.partWidth || 0;
    const thickness = setup.partThickness || setup.wallThickness || 0;
    const title = `TECHNICAL DRAWING - ${formatPartType(partType || 'part').toUpperCase()}`;

    this.pdf.setFillColor(255, 255, 255);
    this.pdf.rect(x, y, width, height, 'F');
    this.pdf.setDrawColor(200, 200, 200);
    this.pdf.setLineWidth(0.3);
    this.pdf.rect(x, y, width, height);

    this.pdf.setTextColor(...COLORS.text);
    this.pdf.setFont('helvetica', 'bold');
    this.pdf.setFontSize(compact ? 5.5 : 9);
    this.pdf.text(title, x + width / 2, y + (compact ? 6 : 10), { align: 'center' });

    const drawingTop = y + (compact ? 12 : 20);
    const drawingH = height - (compact ? 22 : 38);
    const leftCx = x + width * 0.32;
    const rightCx = x + width * 0.70;
    const midY = drawingTop + drawingH * 0.48;

    this.pdf.setFontSize(compact ? 5 : 8);
    this.pdf.setFont('helvetica', 'bold');
    this.pdf.text('FRONT VIEW', leftCx, drawingTop, { align: 'center' });
    this.pdf.text('SECTION A-A', rightCx, drawingTop, { align: 'center' });

    this.pdf.setDrawColor(80, 80, 80);
    this.pdf.setLineWidth(compact ? 0.25 : 0.45);

    if (['tube', 'pipe', 'sleeve', 'bushing', 'ring'].includes(partType) || id > 0) {
      const bodyW = Math.min(width * 0.26, Math.max(28, width * 0.18));
      const bodyH = Math.min(drawingH * 0.38, Math.max(14, drawingH * 0.25));
      const bodyX = leftCx - bodyW / 2;
      const bodyY = midY - bodyH / 2;
      this.pdf.rect(bodyX, bodyY, bodyW, bodyH);
      this.pdf.setDrawColor(150, 150, 150);
      this.pdf.setLineDashPattern([2, 2], 0);
      this.pdf.line(bodyX, midY, bodyX + bodyW, midY);
      this.pdf.line(leftCx, bodyY - 4, leftCx, bodyY + bodyH + 4);
      this.pdf.setLineDashPattern([], 0);

      const outerR = Math.min(width * 0.08, drawingH * 0.22);
      const innerR = outerR * (id && od ? Math.max(0.25, Math.min(0.85, id / od)) : 0.62);
      this.pdf.setDrawColor(80, 80, 80);
      this.pdf.circle(rightCx, midY, outerR);
      this.pdf.circle(rightCx, midY, innerR);
      this.pdf.setDrawColor(150, 150, 150);
      this.pdf.setLineDashPattern([2, 2], 0);
      this.pdf.line(rightCx - outerR - 5, midY, rightCx + outerR + 5, midY);
      this.pdf.line(rightCx, midY - outerR - 5, rightCx, midY + outerR + 5);
      this.pdf.setLineDashPattern([], 0);

      this.pdf.setFont('helvetica', 'normal');
      this.pdf.setFontSize(compact ? 4.5 : 7);
      if (od) this.pdf.text(`OD=${formatNumber(od, 1, 'mm')}`, rightCx, midY - outerR - 4, { align: 'center' });
      if (id) this.pdf.text(`ID=${formatNumber(id, 1, 'mm')}`, rightCx, midY + outerR + 6, { align: 'center' });
      if (length) this.pdf.text(`L=${formatNumber(length, 1, 'mm')}`, leftCx, bodyY + bodyH + 8, { align: 'center' });
      if (thickness) this.pdf.text(`t=${formatNumber(thickness, 1, 'mm')}`, rightCx + outerR + 7, midY, { align: 'left' });
    } else if (['cylinder', 'round_bar', 'shaft'].includes(partType) || od > 0) {
      const bodyW = Math.min(width * 0.28, 70);
      const bodyH = Math.min(drawingH * 0.34, 30);
      this.pdf.rect(leftCx - bodyW / 2, midY - bodyH / 2, bodyW, bodyH);
      const r = Math.min(width * 0.075, drawingH * 0.2);
      this.pdf.circle(rightCx, midY, r);
      this.pdf.setFont('helvetica', 'normal');
      this.pdf.setFontSize(compact ? 4.5 : 7);
      if (od) this.pdf.text(`D=${formatNumber(od, 1, 'mm')}`, rightCx, midY + r + 6, { align: 'center' });
      if (length) this.pdf.text(`L=${formatNumber(length, 1, 'mm')}`, leftCx, midY + bodyH / 2 + 8, { align: 'center' });
    } else {
      const bodyW = Math.min(width * 0.34, 80);
      const bodyH = Math.min(drawingH * 0.38, 42);
      this.pdf.rect(x + width / 2 - bodyW / 2, midY - bodyH / 2, bodyW, bodyH);
      this.pdf.setFont('helvetica', 'normal');
      this.pdf.setFontSize(compact ? 4.5 : 7);
      if (length) this.pdf.text(`L=${formatNumber(length, 1, 'mm')}`, x + width / 2, midY + bodyH / 2 + 8, { align: 'center' });
      if (setup.partWidth) this.pdf.text(`W=${formatNumber(setup.partWidth, 1, 'mm')}`, x + width / 2 + bodyW / 2 + 6, midY, { align: 'left' });
      if (thickness) this.pdf.text(`T=${formatNumber(thickness, 1, 'mm')}`, x + width / 2, midY - bodyH / 2 - 5, { align: 'center' });
    }

    this.pdf.setFont('helvetica', 'normal');
    this.pdf.setFontSize(compact ? 4.5 : 7);
    this.pdf.setTextColor(...COLORS.lightText);
    this.pdf.text(`P/N: ${setup.partNumber || '-'}`, x + 4, y + height - 4);
    this.pdf.text(`Scale: NTS`, x + width - 4, y + height - 4, { align: 'right' });
  }

  // =========================================================================
  // PAGE 2: TABLE OF CONTENTS
  // =========================================================================

  private buildTableOfContents(): void {
    this.addHeader();
    let y = PAGE.contentStart;

    y = this.addSectionTitle('TABLE OF CONTENTS', y);
    y += 5;

    // TOC ORDER MATCHES THE ACTUAL PDF BUILD ORDER.
    const tocItems: { title: string; page: number }[] = [];

    const partInfoSectionNum = this.getMainSectionNumber('part-information');
    tocItems.push({
      title: this.formatTocNumber(partInfoSectionNum, 'Part Information'),
      page: this.pageMapping.get('setup') || 3,
    });
    if (this.hasTechnicalDrawingPage()) {
      tocItems.push({
        title: this.formatTocNumber(this.getTechnicalDrawingSectionNumber(), 'Technical Drawing'),
        page: this.pageMapping.get('technical-drawing') || 4,
      });
    }

    const scanParametersSectionNum = this.getMainSectionNumber('scan-parameters');
    tocItems.push({
      title: this.formatTocNumber(scanParametersSectionNum, 'Scan Parameters'),
      page: this.pageMapping.get('scan-parameters') || 4,
    });

    const equipmentSectionNum = this.getMainSectionNumber('equipment');
    tocItems.push({
      title: this.formatTocNumber(equipmentSectionNum, 'Equipment'),
      page: this.pageMapping.get('equipment') || 5,
    });

    const acceptanceSectionNum = this.getMainSectionNumber('acceptance');
    const acceptanceSectionTitle = this.isV2500MroStandard() ? 'Rejection Criteria' : 'Acceptance Criteria';
    tocItems.push({
      title: this.formatTocNumber(acceptanceSectionNum, acceptanceSectionTitle),
      page: this.pageMapping.get('acceptance') || 6,
    });
    if (this.hasAcceptanceNotesPage()) {
      tocItems.push({
        title: this.formatTocNumber(this.getAcceptanceNotesSectionNumber(), 'Table 6 Ultrasonic Classes Notes'),
        page: this.pageMapping.get('acceptance-notes') || 7,
      });
    }

    if (this.hasScanDetailSection()) {
      if (this.data.scanDetails) {
        tocItems.push({
          title: this.formatTocNumber(this.getScanSectionNumberFor('scan-details'), 'Scan Details & Directions'),
          page: this.pageMapping.get('scan-details') || 7,
        });
      }
      if (this.data.e2375Diagram) {
        tocItems.push({
          title: this.formatTocNumber(this.getScanSectionNumberFor('e2375'), 'ASTM E2375 Scan Directions Diagram'),
          page: this.pageMapping.get('e2375-diagram') || 8,
        });
      }
      if (this.data.scanDirectionsDrawing) {
        tocItems.push({
          title: this.formatTocNumber(this.getScanSectionNumberFor('scan-directions'), 'Inspection Plan Drawing'),
          page: this.pageMapping.get('scan-directions-drawing') || 9,
        });
      }
    }

    const documentationSectionNum = this.getMainSectionNumber('documentation');
    tocItems.push({
      title: this.formatTocNumber(documentationSectionNum, 'Documentation'),
      page: this.pageMapping.get('documentation') || 10,
    });

    const referenceStandardSectionNum = this.getReferenceStandardSectionNumber();
    tocItems.push({
      title: this.formatTocNumber(referenceStandardSectionNum, 'Reference Standard'),
      page: this.pageMapping.get('calibration') || 11,
    });
    tocItems.push({
      title: this.formatTocNumber(this.getCalibrationDiagramSectionNumber(), 'Calibration Block Diagram'),
      page: this.pageMapping.get('calibration-diagram') || 12,
    });
    if (this.hasAngleBeamDiagramPage()) {
      tocItems.push({
        title: this.formatTocNumber(this.getAngleBeamDiagramSectionNumber(), 'Angle Beam Calibration Block'),
        page: this.pageMapping.get('angle-beam-diagram') || 13,
      });
    }

    if (this.hasActiveScanPlanDocuments()) {
      tocItems.push({
        title: this.formatTocNumber(this.getMainSectionNumber('scan-plan'), 'Scan Plan & Reference Documents'),
        page: this.pageMapping.get('scan-plan') || 14,
      });
    }

    tocItems.push({
      title: this.formatTocNumber(this.getMainSectionNumber('approvals'), 'Approvals & Document Control'),
      page: this.pageMapping.get('approvals') || 15,
    });

    this.pdf.setFontSize(11);
    tocItems.forEach((item) => {
      // Use blue text color for clickable TOC entries
      this.pdf.setFont('helvetica', 'normal');
      this.pdf.setTextColor(0, 51, 153);
      this.pdf.text(item.title, PAGE.marginLeft + 5, y);

      // Dotted line
      const titleWidth = this.pdf.getTextWidth(item.title);
      const pageNumStr = String(item.page);
      const pageNumWidth = this.pdf.getTextWidth(pageNumStr);
      const dotsStart = PAGE.marginLeft + 10 + titleWidth;
      const dotsEnd = PAGE.width - PAGE.marginRight - pageNumWidth - 5;

      this.pdf.setDrawColor(...COLORS.divider);
      for (let x = dotsStart; x < dotsEnd; x += 3) {
        this.pdf.circle(x, y - 1, 0.3, 'F');
      }

      // Page number
      this.pdf.text(pageNumStr, PAGE.width - PAGE.marginRight, y, { align: 'right' });

      // Make the entire row a clickable internal link to the target page
      this.pdf.link(PAGE.marginLeft, y - 8, PAGE.contentWidth, 10, { pageNumber: item.page });

      // Reset text color back to default
      this.pdf.setTextColor(...COLORS.text);

      y += 10;
    });

    this.addFooter();
  }

  // =========================================================================
  // PAGE 3: PART INFORMATION
  // =========================================================================

  private buildPartInformation(): void {
    this.addHeader();
    let y = PAGE.contentStart;

    y = this.addSectionTitle(this.formatSectionLabel(this.getMainSectionNumber('part-information'), 'PART INFORMATION'), y);

    const setup = this.data.inspectionSetup;

    // Basic Part Info Table
    const basicInfo = buildTableRows([
      ['Technique Card ID', setup.techniqueCardId],
      ['Part Number', setup.partNumber],
      ['Part Name', setup.partName],
      ['Material', formatMaterial(setup.material, setup.customMaterialName)],
      ['Material Specification', setup.materialSpec],
      ['Part Type / Geometry', formatPartType(setup.partType)],
      ['Drawing Number', setup.drawingNumber],
      ['Heat Treatment', setup.heatTreatment],
    ], { showEmpty: true });

    autoTable(this.pdf, {
      startY: y,
      head: [['Parameter', 'Value']],
      body: basicInfo,
      theme: 'grid',
      styles: { fontSize: 9, cellPadding: 3 },
      headStyles: { fillColor: COLORS.primary, textColor: [255, 255, 255] },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 60 },
        1: { cellWidth: 'auto' },
      },
      margin: { left: PAGE.marginLeft, right: PAGE.marginRight, bottom: PAGE.footerHeight + 5 },
    });

    y = this.getTableEndY(y);

    // Dimensions Table
    y = this.addSubsectionTitle('Dimensions', y);

    const dimensionRows = getPartDimensionRows({ ...setup, standard: this.data.standard });
    if (dimensionRows.length > 0) {
      autoTable(this.pdf, {
        startY: y,
        head: [['Dimension', 'Value']],
        body: dimensionRows,
        theme: 'grid',
        styles: { fontSize: 9, cellPadding: 3 },
        headStyles: { fillColor: COLORS.secondary, textColor: [255, 255, 255] },
        columnStyles: {
          0: { fontStyle: 'bold', cellWidth: 60 },
          1: { cellWidth: 'auto' },
        },
        margin: { left: PAGE.marginLeft, right: PAGE.marginRight, bottom: PAGE.footerHeight + 5 },
      });

      y = this.getTableEndY(y);
    }

    // Material Properties (Acoustic Velocity removed per requirements)
    if (setup.materialDensity) {
      y = this.addSubsectionTitle('Material Properties', y);

      const matProps = buildTableRows([
        ['Material Density', setup.materialDensity ? formatNumber(setup.materialDensity, 0, 'kg/m3') : undefined],
      ]);

      if (matProps.length > 0) {
        autoTable(this.pdf, {
          startY: y,
          body: matProps,
          theme: 'grid',
          styles: { fontSize: 9, cellPadding: 3 },
          columnStyles: {
            0: { fontStyle: 'bold', cellWidth: 60 },
            1: { cellWidth: 'auto' },
          },
          margin: { left: PAGE.marginLeft, right: PAGE.marginRight, bottom: PAGE.footerHeight + 5 },
        });

        y = this.getTableEndY(y);
      }
    }

    // Material Warning
    const warning = getMaterialWarning(setup.material, this.data.standard);
    if (warning) {
      this.pdf.setFillColor(255, 243, 205); // Light yellow
      this.pdf.roundedRect(PAGE.marginLeft, y, PAGE.contentWidth, 15, 2, 2, 'F');
      this.pdf.setFontSize(8);
      this.pdf.setTextColor(133, 100, 4); // Dark yellow/brown
      this.pdf.text(warning, PAGE.marginLeft + 5, y + 5, { maxWidth: PAGE.contentWidth - 10 });
      this.pdf.setTextColor(...COLORS.text);
    }

    // Custom shape image if available
    if (setup.partType === 'custom' && setup.customShapeImage) {
      y += 20;
      y = this.addSubsectionTitle('Custom Shape Reference', y);
      try {
        const boxW = 80;
        const boxH = 60;
        const fit = fitImageToBox(this.pdf, setup.customShapeImage, boxW, boxH);
        this.pdf.addImage(
          setup.customShapeImage,
          detectImageFormat(setup.customShapeImage),
          PAGE.marginLeft + (boxW - fit.width) / 2,
          y + (boxH - fit.height) / 2,
          fit.width,
          fit.height
        );
        if (setup.customShapeDescription) {
          this.pdf.setFontSize(9);
          this.pdf.text(setup.customShapeDescription, PAGE.marginLeft + 85, y + 10, { maxWidth: 90 });
        }
      } catch {
        this.pdf.setFontSize(9);
        this.pdf.text('Custom shape image could not be loaded', PAGE.marginLeft, y + 5);
      }
    }

    this.addFooter();
  }

  // =========================================================================
  // PAGE 4: EQUIPMENT
  // =========================================================================

  private buildEquipment(): void {
    this.addHeader();
    let y = PAGE.contentStart;

    y = this.addSectionTitle(this.formatSectionLabel(this.getMainSectionNumber('equipment'), 'EQUIPMENT'), y);

    const eq = this.data.equipment;

    // Transducer display values (computed before building the combined table)
    const transducerTypeDisplay = eq.transducerTypes?.length
      ? eq.transducerTypes.map((type) => formatTransducerType(type)).join(', ')
      : formatTransducerType(eq.transducerType);
    const transducerShapeDisplay = formatTransducerShape(eq.transducerShapeAndSize);

    // Combined Equipment + Transducer table
    const equipmentInfo = buildTableRows([
      ['Manufacturer', eq.manufacturer],
      ['Model', eq.model],
      ['Serial Number', eq.serialNumber],
      ['Software Version', eq.softwareVersion],
      ['Frequency', eq.frequency ? `${eq.frequency} MHz` : undefined],
      ['Transducer Type', transducerTypeDisplay],
      ['Transducer Shape & Size', transducerShapeDisplay],
      ['Element Diameter', eq.transducerDiameter ? formatNumber(eq.transducerDiameter, 3, 'inches') : undefined],
      ['Couplant', eq.customCouplant || eq.couplant],
      ['Selection Notes', eq.includeSelectionNotesInReport ? eq.selectionNotes : undefined],
    ], { showEmpty: true });

    autoTable(this.pdf, {
      startY: y,
      head: [['Equipment', 'Value']],
      body: equipmentInfo,
      theme: 'grid',
      styles: { fontSize: 9, cellPadding: 3 },
      headStyles: { fillColor: COLORS.primary, textColor: [255, 255, 255] },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 60 },
        1: { cellWidth: 'auto' },
      },
      margin: { left: PAGE.marginLeft, right: PAGE.marginRight, bottom: PAGE.footerHeight + 5 },
    });

    y = this.getTableEndY(y);

    // Performance Parameters
    y = this.addSubsectionTitle('Performance Parameters', y);

    const perfInfo = buildTableRows([
      ['Entry Surface Resolution', eq.entrySurfaceResolution ? formatNumber(eq.entrySurfaceResolution, 3, 'inches') : undefined],
      ['Back Surface Resolution', eq.backSurfaceResolution ? formatNumber(eq.backSurfaceResolution, 3, 'inches') : undefined],
    ], { showEmpty: true });

    autoTable(this.pdf, {
      startY: y,
      body: perfInfo,
      theme: 'grid',
      styles: { fontSize: 9, cellPadding: 3 },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 60 },
        1: { cellWidth: 'auto' },
      },
      margin: { left: PAGE.marginLeft, right: PAGE.marginRight, bottom: PAGE.footerHeight + 5 },
    });

    y = this.getTableEndY(y);

    // Phased Array Settings (if applicable) — respect *Applicable flags
    const eqAny = eq as Record<string, unknown>;
    const paHasData = (eq.numberOfElements && eqAny.numberOfElementsApplicable !== false)
      || (eq.elementPitch && eqAny.elementPitchApplicable !== false)
      || (eq.wedgeModel && eqAny.wedgeModelApplicable !== false)
      || (eq.wedgeType && eqAny.wedgeTypeApplicable !== false);
    if (paHasData) {
      y = this.addSubsectionTitle('Phased Array Configuration', y);

      const paVal = (val: unknown, applicableFlag: unknown): string | undefined => {
        if (applicableFlag === false) return 'N/A';
        return val !== undefined && val !== null && val !== '' ? String(val) : undefined;
      };

      const paInfo = buildTableRows([
        ['Number of Elements', paVal(eq.numberOfElements, eqAny.numberOfElementsApplicable)],
        ['Element Pitch', eqAny.elementPitchApplicable === false ? 'N/A' : (eq.elementPitch ? formatNumber(eq.elementPitch, 2, 'mm') : undefined)],
        ['Wedge Model', paVal(eq.wedgeModel, eqAny.wedgeModelApplicable)],
        ['Wedge Type', paVal(eq.wedgeType, eqAny.wedgeTypeApplicable)],
        ['Delay Line', paVal(eq.delayLine, eqAny.delayLineApplicable)],
      ]);

      if (paInfo.length > 0) {
        autoTable(this.pdf, {
          startY: y,
          head: [['Phased Array', 'Value']],
          body: paInfo,
          theme: 'grid',
          styles: { fontSize: 9, cellPadding: 3 },
          headStyles: { fillColor: [128, 0, 128], textColor: [255, 255, 255] }, // Purple for PA
          columnStyles: {
            0: { fontStyle: 'bold', cellWidth: 60 },
            1: { cellWidth: 'auto' },
          },
          margin: { left: PAGE.marginLeft, right: PAGE.marginRight, bottom: PAGE.footerHeight + 5 },
        });
      }
    }

    this.addFooter();
  }

  // =========================================================================
  // PAGE 5: CALIBRATION
  // =========================================================================

  private buildCalibration(): void {
    this.addHeader();
    let y = PAGE.contentStart;

    y = this.addSectionTitle(this.formatSectionLabel(this.getReferenceStandardSectionNumber(), 'REFERENCE STANDARD'), y);

    const cal = this.data.calibration;

    // Calibration Block Info — fixed label from "Standard/Block Type" to "Calibration Block Type"
    const calInfo = buildTableRows([
      ['Calibration Block Type', formatBlockType(cal.standardType)],
      ['Reference Material', cal.referenceMaterial],
      ['Block Dimensions (mm)', cal.blockDimensions],
      ['Block Serial Number', cal.blockSerialNumber],
      ['Last Calibration Date', formatDate(cal.lastCalibrationDate)],
      ['Avg. Metal Travel Distance', cal.metalTravelDistance ? formatNumber(cal.metalTravelDistance, 1, 'mm') : undefined],
    ], { showEmpty: true });

    autoTable(this.pdf, {
      startY: y,
      head: [['Calibration Parameter', 'Value']],
      body: calInfo,
      theme: 'grid',
      styles: { fontSize: 9, cellPadding: 3 },
      headStyles: { fillColor: COLORS.primary, textColor: [255, 255, 255] },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 70 },
        1: { cellWidth: 'auto' },
      },
      margin: { left: PAGE.marginLeft, right: PAGE.marginRight, bottom: PAGE.footerHeight + 5 },
    });

    y = this.getTableEndY(y);

    // FBH Table
    if (cal.fbhHoles && cal.fbhHoles.length > 0) {
      y = this.addSubsectionTitle('Flat Bottom Holes (FBH)', y);

      const fbhRows = cal.fbhHoles.map((hole) => [
        hole.partNumber || '-',
        hole.deltaType || '-',
        hole.diameterInch || '-',
        formatNumber(hole.diameterMm, 2, 'mm'),
        formatNumber(hole.blockHeightE, 1, 'mm'),
        formatNumber(hole.metalTravelH, 1, 'mm'),
      ]);

      autoTable(this.pdf, {
        startY: y,
        head: [['P/N', 'Delta Type', 'Dia FBH (inch)', 'Dia FBH (mm)', 'E (mm)', 'H (mm)']],
        body: fbhRows,
        theme: 'grid',
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: COLORS.secondary, textColor: [255, 255, 255] },
        margin: { left: PAGE.marginLeft, right: PAGE.marginRight, bottom: PAGE.footerHeight + 5 },
      });

      y = this.getTableEndY(y);
    } else if (cal.fbhSizes) {
      // Legacy FBH sizes string
      y = this.addSubsectionTitle('FBH Sizes', y);
      this.pdf.setFontSize(10);
      this.pdf.text(cal.fbhSizes, PAGE.marginLeft, y + 5);
      y += 15;
    }

    // Calibration Sensitivity Table
    if (cal.sensitivityTable && cal.sensitivityTable.length > 0) {
      // Check if we need a new page
      if (y > PAGE.height - PAGE.footerHeight - 80) {
        this.addFooter();
        this.addNewPage();
        this.addHeader();
        y = PAGE.contentStart;
      }

      y = this.addSubsectionTitle('Calibration Sensitivity', y);

      const sensRows = cal.sensitivityTable.map((row) => [
        row.reflectorType || '-',
        row.reflectorSizeInch || '-',
        formatNumber(row.curvatureCorrection, 1, 'dB'),
        formatNumber(row.gainOffset, 1, 'dB'),
        formatNumber(row.deltaDbTotal, 1, 'dB'),
      ]);

      autoTable(this.pdf, {
        startY: y,
        head: [['Reflector Type', 'Size (inch)', 'Curvature Corr. (dB)', 'Gain Offset (dB)', 'Delta dB Total']],
        body: sensRows,
        theme: 'grid',
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: COLORS.secondary, textColor: [255, 255, 255] },
        margin: { left: PAGE.marginLeft, right: PAGE.marginRight, bottom: PAGE.footerHeight + 5 },
      });

      y = this.getTableEndY(y);
    }

    // Straight Beam Conversion Table
    if (cal.straightBeamConversionTable && cal.straightBeamConversionTable.length > 0) {
      if (y > PAGE.height - PAGE.footerHeight - 80) {
        this.addFooter();
        this.addNewPage();
        this.addHeader();
        y = PAGE.contentStart;
      }

      y = this.addSubsectionTitle('Straight Beam Conversion', y);

      const sbcRows = cal.straightBeamConversionTable.map((row) => [
        row.partNumber || '-',
        row.fbhCalibrationSize || '-',
        row.fbhRequired || '-',
        formatNumber(row.deltaDbNeeded, 1, 'dB'),
        formatNumber(row.transferCorrectionDb, 1, 'dB'),
        formatNumber(row.curvatureCorrectionDb, 1, 'dB'),
      ]);

      autoTable(this.pdf, {
        startY: y,
        head: [['P/N', 'FBH Cal. Size', 'FBH Required', 'Delta dB Needed', 'Transfer Corr. (dB)', 'Curvature Corr. (dB)']],
        body: sbcRows,
        theme: 'grid',
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: COLORS.secondary, textColor: [255, 255, 255] },
        margin: { left: PAGE.marginLeft, right: PAGE.marginRight, bottom: PAGE.footerHeight + 5 },
      });

      y = this.getTableEndY(y);
    }

    // Angle Beam Calibration Table
    const angleBeamRows = this.getAngleBeamCalibrationRows();
    if (angleBeamRows.length > 0) {
      if (y > PAGE.height - PAGE.footerHeight - 80) {
        this.addFooter();
        this.addNewPage();
        this.addHeader();
        y = PAGE.contentStart;
      }

      y = this.addSubsectionTitle('Angle Beam Calibration Data', y);

      const abRows = angleBeamRows.map((row) => [
        row.reflectorType || '-',
        row.reflectorSizeInch !== undefined
          ? (String(row.reflectorSizeInch).includes('/') ? String(row.reflectorSizeInch) : `${row.reflectorSizeInch}"`)
          : '-',
        row.currentReflectorUsed || '-',
        row.currentReflectorSize || '-',
        formatNumber(row.sizeDbCorrection, 1, 'dB'),
        formatNumber(row.transferDbCorrection, 1, 'dB'),
        formatNumber(row.totalDb, 1, 'dB'),
        formatNumber(row.depthMm, 1, 'mm'),
        formatNumber(row.soundPathMm, 1, 'mm'),
      ]);

      autoTable(this.pdf, {
        startY: y,
        head: [['Reflector', 'Size Req. (inch)', 'Current Ref.', 'Ref. Size', 'Size Delta dB', 'Transfer Delta dB', 'Total Delta dB', 'Depth (mm)', 'Sound Path (mm)']],
        body: abRows,
        theme: 'grid',
        tableWidth: PAGE.contentWidth,
        styles: { fontSize: 6.5, cellPadding: 1.4, overflow: 'linebreak', valign: 'middle' },
        headStyles: { fillColor: COLORS.secondary, textColor: [255, 255, 255], fontSize: 6.5 },
        columnStyles: {
          0: { cellWidth: 16 },
          1: { cellWidth: 18 },
          2: { cellWidth: 18 },
          3: { cellWidth: 34 },
          4: { cellWidth: 18 },
          5: { cellWidth: 20 },
          6: { cellWidth: 18 },
          7: { cellWidth: 18 },
          8: { cellWidth: 20 },
        },
        margin: { left: PAGE.marginLeft, right: PAGE.marginRight, bottom: PAGE.footerHeight + 5 },
      });

      y = this.getTableEndY(y);
    }

    this.addFooter();
  }

  // =========================================================================
  // PAGE 6: CALIBRATION BLOCK DIAGRAM
  // =========================================================================

  private buildCalibrationDiagram(): void {
    this.addHeader();
    let y = PAGE.contentStart;
    const cal = this.data.calibration;

    y = this.addSectionTitle(this.formatSectionLabel(this.getCalibrationDiagramSectionNumber(), 'CALIBRATION BLOCK DIAGRAM'), y);

    // Helper to render a single image centered on page
    const renderImage = (imgData: string, maxH: number): number => {
      const maxWidth = PAGE.contentWidth * 0.9;
      const maxHeight = Math.min(maxH, 150);
      const { width: imgWidth, height: imgHeight } = this.calculateImageDimensions(
        imgData, maxWidth, maxHeight
      );
      const xPos = PAGE.marginLeft + (PAGE.contentWidth - imgWidth) / 2;

      this.pdf.setDrawColor(200, 200, 200);
      this.pdf.setLineWidth(0.5);
      this.pdf.rect(xPos - 2, y - 2, imgWidth + 4, imgHeight + 4);

      this.pdf.addImage(imgData, 'PNG', xPos, y, imgWidth, imgHeight, undefined, 'FAST');
      return imgHeight;
    };

    const hasAutoDiagram = !!this.data.calibrationBlockDiagram;
    const hasCustomImage = !!cal.customStraightBeamImage;

    if (hasAutoDiagram || hasCustomImage) {
      try {
        const availableH = PAGE.height - y - PAGE.footerHeight - 30;

        if (hasAutoDiagram && hasCustomImage) {
          // Both images: split available height
          const halfH = (availableH - 20) / 2; // 20mm gap between images

          // Auto-captured diagram first
          this.pdf.setFontSize(FONTS.small.size);
          this.pdf.setFont('helvetica', 'bold');
          this.pdf.setTextColor(...COLORS.secondary);
          this.pdf.text('Auto-Generated Diagram', PAGE.marginLeft, y);
          y += 5;
          const h1 = renderImage(this.data.calibrationBlockDiagram!, halfH);
          y += h1 + 10;

          // Custom uploaded image
          this.pdf.setFontSize(FONTS.small.size);
          this.pdf.setFont('helvetica', 'bold');
          this.pdf.setTextColor(...COLORS.secondary);
          this.pdf.text('Custom Uploaded Image', PAGE.marginLeft, y);
          y += 5;
          renderImage(cal.customStraightBeamImage!, halfH);
        } else if (hasAutoDiagram) {
          renderImage(this.data.calibrationBlockDiagram!, availableH);
        } else {
          renderImage(cal.customStraightBeamImage!, availableH);
        }
      } catch {
        this.pdf.setFontSize(10);
        this.pdf.setTextColor(...COLORS.lightText);
        this.pdf.text('Calibration block diagram could not be loaded.', PAGE.marginLeft, y + 20);
      }
    } else {
      y = this.drawFallbackCalibrationDiagram(y);
    }

    this.pdf.setTextColor(...COLORS.text);
    this.addFooter();
  }

  private drawFallbackCalibrationDiagram(startY: number): number {
    const cal = this.data.calibration;
    const holes = this.getCalibrationFbhHoles();
    let y = startY;

    this.pdf.setFontSize(9);
    this.pdf.setFont('helvetica', 'normal');
    this.pdf.setTextColor(...COLORS.lightText);
    this.pdf.text(
      'Auto-generated fallback view from the FBH calibration table.',
      PAGE.marginLeft,
      y + 2,
      { maxWidth: PAGE.contentWidth }
    );
    y += 10;

    const infoRows = buildTableRows([
      ['Block Type', cal.standardType ? formatBlockType(cal.standardType) : undefined],
      ['Block Dimensions', cal.blockDimensions],
      ['Reference Material', cal.referenceMaterial],
      ['Block Serial Number', cal.blockSerialNumber],
    ]);

    if (infoRows.length > 0) {
      autoTable(this.pdf, {
        startY: y,
        body: infoRows,
        theme: 'grid',
        styles: { fontSize: 8, cellPadding: 2 },
        columnStyles: {
          0: { fontStyle: 'bold', cellWidth: 45 },
          1: { cellWidth: 'auto' },
        },
        margin: { left: PAGE.marginLeft, right: PAGE.marginRight, bottom: PAGE.footerHeight + 5 },
      });
      y = this.getTableEndY(y, 8);
    }

    if (holes.length === 0) {
      this.pdf.setFontSize(10);
      this.pdf.setTextColor(...COLORS.lightText);
      this.pdf.text('No FBH hole rows are configured for a calibration diagram.', PAGE.marginLeft, y + 10);
      return y + 18;
    }

    const gap = 10;
    const cardW = (PAGE.contentWidth - gap * (holes.length - 1)) / holes.length;
    const cardH = 66;

    holes.forEach((hole, index) => {
      const x = PAGE.marginLeft + index * (cardW + gap);
      const cardY = y;
      const blockX = x + 9;
      const blockY = cardY + 15;
      const blockW = Math.min(38, cardW - 18);
      const blockH = 34;
      const e = Number(hole.blockHeightE) || Number(cal.metalTravelDistance) || 1;
      const h = Number(hole.metalTravelH) || e;
      const reflectorRatio = Math.max(0.12, Math.min(0.92, h / e));
      const reflectorY = blockY + blockH * reflectorRatio;
      const holeW = Math.max(4, Math.min(8, blockW * 0.16));
      const centerX = blockX + blockW / 2;

      this.pdf.setDrawColor(...COLORS.tableBorder);
      this.pdf.setFillColor(...COLORS.sectionBg);
      this.pdf.roundedRect(x, cardY, cardW, cardH, 2, 2, 'FD');

      this.pdf.setFontSize(8);
      this.pdf.setFont('helvetica', 'bold');
      this.pdf.setTextColor(...COLORS.primary);
      this.pdf.text(`Hole ${hole.id ?? index + 1}`, x + cardW / 2, cardY + 7, { align: 'center' });

      this.pdf.setDrawColor(60, 60, 60);
      this.pdf.setFillColor(255, 255, 255);
      this.pdf.rect(blockX, blockY, blockW, blockH, 'FD');

      this.pdf.setFillColor(230, 230, 230);
      this.pdf.rect(centerX - holeW / 2, reflectorY, holeW, blockY + blockH - reflectorY, 'F');
      this.pdf.setDrawColor(30, 30, 30);
      this.pdf.setLineWidth(0.5);
      this.pdf.line(centerX - holeW / 2, reflectorY, centerX + holeW / 2, reflectorY);
      this.pdf.line(blockX, reflectorY, blockX + blockW, reflectorY);

      this.pdf.setFontSize(6.5);
      this.pdf.setFont('helvetica', 'normal');
      this.pdf.setTextColor(...COLORS.lightText);
      this.pdf.text(`FBH ${hole.diameterInch || '-'} (${formatNumber(hole.diameterMm, 2, 'mm')})`, x + cardW / 2, cardY + 56, { align: 'center' });
      this.pdf.text(`E ${formatNumber(hole.blockHeightE, 1, 'mm')}  H ${formatNumber(hole.metalTravelH, 1, 'mm')}`, x + cardW / 2, cardY + 62, { align: 'center' });
    });

    y += cardH + 8;

    const holeRows = holes.map((hole) => [
      String(hole.id ?? '-'),
      hole.partNumber || '-',
      hole.deltaType || '-',
      hole.diameterInch || '-',
      formatNumber(hole.diameterMm, 2, 'mm'),
      formatNumber(hole.blockHeightE, 1, 'mm'),
      formatNumber(hole.metalTravelH, 1, 'mm'),
    ]);

    autoTable(this.pdf, {
      startY: y,
      head: [['#', 'P/N', 'Delta Type', 'Dia FBH (inch)', 'Dia FBH (mm)', 'E (mm)', 'H (mm)']],
      body: holeRows,
      theme: 'grid',
      tableWidth: PAGE.contentWidth,
      styles: { fontSize: 7, cellPadding: 1.4, overflow: 'linebreak', valign: 'middle', minCellWidth: 0 },
      headStyles: { fillColor: COLORS.secondary, textColor: [255, 255, 255], fontSize: 7 },
      columnStyles: {
        0: { cellWidth: 8, halign: 'center' },
        1: { cellWidth: 42 },
        2: { cellWidth: 20 },
        3: { cellWidth: 30 },
        4: { cellWidth: 30 },
        5: { cellWidth: 25 },
        6: { cellWidth: 25 },
      },
      margin: { left: PAGE.marginLeft, right: PAGE.marginRight, bottom: PAGE.footerHeight + 5 },
    });

    return this.getTableEndY(y);
  }

  // =========================================================================
  // PAGE: ANGLE BEAM CALIBRATION DIAGRAM (optional - for circular parts)
  // =========================================================================

  private buildAngleBeamDiagram(): void {
    this.addHeader();
    let y = PAGE.contentStart;

    y = this.addSectionTitle(this.formatSectionLabel(this.getAngleBeamDiagramSectionNumber(), 'ANGLE BEAM CALIBRATION BLOCK'), y);

    // Add subtitle
    this.pdf.setFontSize(FONTS.small.size);
    this.pdf.setTextColor(...COLORS.lightText);
    this.pdf.text('Shear Wave / Circumferential Inspection Reference Block', PAGE.marginLeft, y);
    y += 8;

    let imageRendered = false;

    if (this.isUsableCapturedDiagram(this.data.angleBeamDiagram, 220, 160)) {
      try {
        // Calculate proper dimensions from actual image (preserves aspect ratio)
        const maxWidth = PAGE.contentWidth * 0.9;
        const maxHeight = Math.min(PAGE.height - y - PAGE.footerHeight - 30, 140);
        const { width: imgWidth, height: imgHeight } = this.calculateImageDimensions(
          this.data.angleBeamDiagram,
          maxWidth,
          maxHeight
        );

        const xPos = PAGE.marginLeft + (PAGE.contentWidth - imgWidth) / 2;

        this.pdf.setDrawColor(200, 200, 200);
        this.pdf.setLineWidth(0.5);
        this.pdf.rect(xPos - 2, y - 2, imgWidth + 4, imgHeight + 4);

        this.pdf.addImage(
          this.data.angleBeamDiagram,
          'PNG',
          xPos,
          y,
          imgWidth,
          imgHeight,
          undefined,
          'FAST' // High quality - minimal compression
        );
        imageRendered = true;
      } catch {
        imageRendered = false;
      }
    }

    if (!imageRendered) {
      y = this.drawFallbackAngleBeamDiagram(y);
    }

    this.pdf.setTextColor(...COLORS.text);
    this.addFooter();
  }

  private drawFallbackAngleBeamDiagram(startY: number): number {
    const setup = this.data.inspectionSetup;
    const cal = this.data.calibration;
    let y = startY;
    const partType = setup.partType || '';
    const wallThickness = resolveWallThickness({
      partType,
      partThickness: setup.partThickness,
      isHollow: setup.isHollow,
      diameter: setup.diameter,
      innerDiameter: setup.innerDiameter,
      wallThickness: setup.wallThickness,
    });
    const tubeSelection = isTubeAngleBeamPartType(partType)
      ? getTubeAngleBeamDrawing(setup.diameter, wallThickness)
      : null;

    const infoRows = [
      ['Part Geometry', formatPartType(partType || 'part')],
      ['Inspection Requirement', 'Angle beam / circumferential shear wave calibration'],
      ['Outer Diameter', formatNumber(setup.diameter, 1, 'mm')],
      ['Inner Diameter', formatNumber(setup.innerDiameter, 1, 'mm')],
      ['Wall Thickness', formatNumber(wallThickness || setup.partThickness, 1, 'mm')],
      ['Calibration Block Type', formatBlockType(cal.standardType || 'angle_beam')],
      ['Tube Reference Row', tubeSelection
        ? `${tubeSelection.requested.blockId} (${formatTubeAngleBeamRange(tubeSelection.requested.diameterRange)}, ${formatTubeAngleBeamRange(tubeSelection.requested.thicknessRange)})`
        : '-'],
      ['Displayed Tube Drawing', tubeSelection
        ? `${tubeSelection.displayed.blockId}${tubeSelection.exactImageAvailable ? '' : ' - closest available bundled drawing'}`
        : '-'],
    ];

    autoTable(this.pdf, {
      startY: y,
      body: infoRows,
      theme: 'grid',
      tableWidth: PAGE.contentWidth,
      styles: { fontSize: 8, cellPadding: 2.4, overflow: 'linebreak' },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 48, fillColor: COLORS.sectionBg },
        1: { cellWidth: 132 },
      },
      margin: { left: PAGE.marginLeft, right: PAGE.marginRight, bottom: PAGE.footerHeight + 5 },
    });

    y = this.getTableEndY(y, 8);

    const boxX = PAGE.marginLeft;
    const boxW = PAGE.contentWidth;
    const boxH = 86;
    this.pdf.setFillColor(255, 255, 255);
    this.pdf.setDrawColor(...COLORS.tableBorder);
    this.pdf.setLineWidth(0.35);
    this.pdf.rect(boxX, y, boxW, boxH, 'FD');

    this.pdf.setFont('helvetica', 'bold');
    this.pdf.setFontSize(8.5);
    this.pdf.setTextColor(...COLORS.primary);
    this.pdf.text('GENERATED ANGLE BEAM REFERENCE DIAGRAM', boxX + boxW / 2, y + 8, { align: 'center' });

    const cx = boxX + 47;
    const cy = y + 47;
    const outerR = 24;
    const innerR = Math.max(9, outerR * ((setup.innerDiameter && setup.diameter) ? setup.innerDiameter / setup.diameter : 0.6));

    this.pdf.setDrawColor(60, 60, 60);
    this.pdf.setLineWidth(0.45);
    this.pdf.circle(cx, cy, outerR);
    this.pdf.circle(cx, cy, Math.min(innerR, outerR - 4));
    this.pdf.setDrawColor(...COLORS.divider);
    this.pdf.setLineDashPattern([2, 2], 0);
    this.pdf.line(cx - outerR - 5, cy, cx + outerR + 5, cy);
    this.pdf.line(cx, cy - outerR - 5, cx, cy + outerR + 5);
    this.pdf.setLineDashPattern([], 0);

    this.pdf.setDrawColor(...COLORS.warning);
    this.pdf.setLineWidth(0.8);
    this.pdf.line(cx - outerR - 16, cy + outerR + 12, cx - 6, cy + 6);
    this.pdf.line(cx - 6, cy + 6, cx + 17, cy - 17);
    this.pdf.line(cx + outerR + 16, cy + outerR + 12, cx + 6, cy + 6);
    this.pdf.line(cx + 6, cy + 6, cx - 17, cy - 17);

    this.pdf.setFillColor(...COLORS.warning);
    this.pdf.circle(cx - 6, cy + 6, 1.5, 'F');
    this.pdf.circle(cx + 6, cy + 6, 1.5, 'F');

    this.pdf.setFont('helvetica', 'normal');
    this.pdf.setFontSize(7);
    this.pdf.setTextColor(...COLORS.text);
    this.pdf.text('Tube / circular section', cx, y + 78, { align: 'center' });
    this.pdf.text('+/-45 deg shear wave paths', cx, y + 83, { align: 'center' });

    const blockX = boxX + 102;
    const blockY = y + 25;
    const blockW = 58;
    const blockH = 35;
    this.pdf.setDrawColor(70, 70, 70);
    this.pdf.setLineWidth(0.45);
    this.pdf.rect(blockX, blockY, blockW, blockH);
    this.pdf.setDrawColor(...COLORS.accent);
    this.pdf.line(blockX + 6, blockY + blockH - 4, blockX + 28, blockY + 8);
    this.pdf.line(blockX + 20, blockY + blockH - 4, blockX + 42, blockY + 8);
    this.pdf.line(blockX + 34, blockY + blockH - 4, blockX + 52, blockY + 12);
    this.pdf.setFillColor(...COLORS.accent);
    [10, 20, 30].forEach((depth, index) => {
      this.pdf.circle(blockX + 45, blockY + depth, 1.4, 'F');
      this.pdf.text(`R${index + 1}`, blockX + 49, blockY + depth + 1.5);
    });

    this.pdf.setFont('helvetica', 'bold');
    this.pdf.setFontSize(7.5);
    this.pdf.setTextColor(...COLORS.primary);
    this.pdf.text('Reference block / SDH reflectors', blockX + blockW / 2, y + 68, { align: 'center' });

    const noteX = boxX + 103;
    this.pdf.setFont('helvetica', 'normal');
    this.pdf.setFontSize(7);
    this.pdf.setTextColor(...COLORS.lightText);
    this.pdf.text('Fallback generated from entered part geometry and calibration data.', noteX, y + 76, {
      maxWidth: 72,
    });

    y += boxH + 8;

    const rows = this.getAngleBeamCalibrationRows();
    if (rows.length > 0) {
      y = this.addSubsectionTitle('Angle Beam Reflector Calibration Data', y);
      autoTable(this.pdf, {
        startY: y,
        head: [['#', 'Reflector', 'Req Size', 'Used', 'Used Size', 'Size dB', 'Transfer dB', 'Total dB', 'Depth', 'Sound Path']],
        body: rows.map((row) => [
          String(row.id ?? ''),
          row.reflectorType || '-',
          row.reflectorSizeInch || '-',
          row.currentReflectorUsed || '-',
          row.currentReflectorSize || '-',
          formatNumber(row.sizeDbCorrection, 1, 'dB'),
          formatNumber(row.transferDbCorrection, 1, 'dB'),
          formatNumber(row.totalDb, 1, 'dB'),
          formatNumber(row.depthMm, 1, 'mm'),
          formatNumber(row.soundPathMm, 1, 'mm'),
        ]),
        theme: 'grid',
        tableWidth: PAGE.contentWidth,
        styles: { fontSize: 6.4, cellPadding: 1.4, overflow: 'linebreak', valign: 'middle' },
        headStyles: { fillColor: COLORS.secondary, textColor: [255, 255, 255], fontSize: 6.4 },
        columnStyles: {
          0: { cellWidth: 7, halign: 'center' },
          1: { cellWidth: 17 },
          2: { cellWidth: 16 },
          3: { cellWidth: 15 },
          4: { cellWidth: 28 },
          5: { cellWidth: 16 },
          6: { cellWidth: 18 },
          7: { cellWidth: 16 },
          8: { cellWidth: 21 },
          9: { cellWidth: 26 },
        },
        margin: { left: PAGE.marginLeft, right: PAGE.marginRight, bottom: PAGE.footerHeight + 5 },
      });
      y = this.getTableEndY(y);
    } else {
      this.pdf.setFontSize(8);
      this.pdf.setTextColor(...COLORS.lightText);
      this.pdf.text('No angle beam reflector calibration rows were entered.', PAGE.marginLeft, y + 5);
      y += 12;
    }

    this.pdf.setTextColor(...COLORS.text);
    return y;
  }

  // =========================================================================
  // PAGE: E2375 SCAN DIRECTIONS DIAGRAM (optional)
  // =========================================================================

  private buildE2375Diagram(): void {
    this.addHeader();
    let y = PAGE.contentStart;

    // Dynamic section numbering - E2375 is a subsection of Scan Details
    y = this.addSectionTitle(this.formatSectionLabel(this.getScanSectionNumberFor('e2375'), 'ASTM E2375 SCAN DIRECTIONS DIAGRAM'), y);

    // Add subtitle with standard reference
    this.pdf.setFontSize(FONTS.small.size);
    this.pdf.setTextColor(...COLORS.lightText);
    const partType = this.data.inspectionSetup.partType || 'Unknown';
    this.pdf.text(
      `Standard Practice for Ultrasonic Testing of Wrought Products - ${formatPartType(partType)}`,
      PAGE.marginLeft,
      y
    );
    y += 8;

    if (this.data.e2375Diagram) {
      try {
        // Calculate proper dimensions from actual image (preserves aspect ratio)
        const maxWidth = PAGE.contentWidth * 0.9;
        const maxHeight = Math.min(PAGE.height - y - PAGE.footerHeight - 40, 140);
        const { width: imgWidth, height: imgHeight } = this.calculateImageDimensions(
          this.data.e2375Diagram,
          maxWidth,
          maxHeight
        );

        const xPos = PAGE.marginLeft + (PAGE.contentWidth - imgWidth) / 2;

        this.pdf.setDrawColor(200, 200, 200);
        this.pdf.setLineWidth(0.5);
        this.pdf.rect(xPos - 2, y - 2, imgWidth + 4, imgHeight + 4);

        this.pdf.addImage(
          this.data.e2375Diagram,
          'PNG',
          xPos,
          y,
          imgWidth,
          imgHeight,
          undefined,
          'FAST' // High quality - minimal compression
        );

        // Add note below the diagram
        const noteY = y + imgHeight + 10;
        this.pdf.setFontSize(8);
        this.pdf.setTextColor(...COLORS.lightText);
        this.pdf.text(
          'Reference: ASTM E2375-16 "Standard Practice for Ultrasonic Testing of Wrought Products"',
          PAGE.marginLeft,
          noteY
        );
      } catch {
        this.pdf.setFontSize(10);
        this.pdf.setTextColor(...COLORS.lightText);
        this.pdf.text('E2375 scan directions diagram could not be loaded.', PAGE.marginLeft, y + 20);
      }
    } else {
      this.pdf.setFontSize(10);
      this.pdf.setTextColor(...COLORS.lightText);
      this.pdf.text('No E2375 scan directions diagram available.', PAGE.marginLeft, y + 10);
      this.pdf.text('Please visit the Scan Details tab before exporting to capture this diagram.', PAGE.marginLeft, y + 20);
    }

    this.pdf.setTextColor(...COLORS.text);
    this.addFooter();
  }

  // =========================================================================
  // PAGE 7: SCAN PARAMETERS
  // =========================================================================

  private buildScanParameters(): void {
    this.addHeader();
    let y = PAGE.contentStart;

    y = this.addSectionTitle(this.formatSectionLabel(this.getMainSectionNumber('scan-parameters'), 'SCAN PARAMETERS'), y);

    const scan = this.data.scanParameters;

    // Format technique type for display
    const formatTechnique = (technique?: string): string => {
      if (!technique) return '-';
      const techniqueMap: Record<string, string> = {
        'conventional': 'Conventional',
        'bubbler': 'Bubbler',
        'squirt': 'Squirt / Water Jet',
        'phased_array': 'Phased Array',
      };
      return techniqueMap[technique] || technique;
    };

    // Scan method: support multi-select array
    const scanMethodDisplay = scan.scanMethods?.length
      ? scan.scanMethods.map(m => formatScanMethod(m)).join(', ')
      : formatScanMethod(scan.scanMethod);

    // Main Scan Parameters
    const scanInfo = buildTableRows([
      ['Scan Method', scanMethodDisplay],
      ['Technique', formatTechnique(scan.technique)],
      ['Scan Type', formatValue(scan.scanType)],
      ['Scan Pattern', formatValue(scan.scanPattern)],
    ], { showEmpty: true });

    autoTable(this.pdf, {
      startY: y,
      head: [['Parameter', 'Value']],
      body: scanInfo,
      theme: 'grid',
      styles: { fontSize: 9, cellPadding: 3 },
      headStyles: { fillColor: COLORS.primary, textColor: [255, 255, 255] },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 60 },
        1: { cellWidth: 'auto' },
      },
      margin: { left: PAGE.marginLeft, right: PAGE.marginRight, bottom: PAGE.footerHeight + 5 },
    });

    y = this.getTableEndY(y);

    // Speed & Coverage
    y = this.addSubsectionTitle('Speed & Coverage', y);

    const speedInfo = buildTableRows([
      ['Scan Speed', scan.scanSpeed ? formatNumber(scan.scanSpeed, 0, 'mm/s') : undefined],
      ['Scan Index', scan.scanIndex ? formatNumber(scan.scanIndex, 1, '%') : undefined],
      ['Coverage', scan.coverage ? `${scan.coverage}%` : undefined],
      ['Water Path', scan.waterPath ? formatNumber(scan.waterPath, 1, 'mm') : undefined],
    ], { showEmpty: true });

    autoTable(this.pdf, {
      startY: y,
      body: speedInfo,
      theme: 'grid',
      styles: { fontSize: 9, cellPadding: 3 },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 60 },
        1: { cellWidth: 'auto' },
      },
      margin: { left: PAGE.marginLeft, right: PAGE.marginRight, bottom: PAGE.footerHeight + 5 },
    });

    y = this.getTableEndY(y);

    // Gate & Gain Settings
    y = this.addSubsectionTitle('Instrument Settings', y);

    const gateInfo = buildTableRows([
      ['Pulse Repetition Rate (PRF)', scan.pulseRepetitionRate ? `${scan.pulseRepetitionRate} Hz` : undefined],
    ], { showEmpty: true });

    autoTable(this.pdf, {
      startY: y,
      body: gateInfo,
      theme: 'grid',
      styles: { fontSize: 9, cellPadding: 3 },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 70 },
        1: { cellWidth: 'auto' },
      },
      margin: { left: PAGE.marginLeft, right: PAGE.marginRight, bottom: PAGE.footerHeight + 5 },
    });

    y = this.getTableEndY(y);

    // Phased Array Settings — FIXED: use technique instead of legacy couplingMethod
    if (scan.technique === 'phased_array' && scan.phasedArray) {
      y = this.addSubsectionTitle('Phased Array Settings', y);

      const pa = scan.phasedArray;

      // Build scan types display from checkboxes
      const scanTypesArr: string[] = [];
      if (pa.scanTypes?.sScan) scanTypesArr.push('S-Scan');
      if (pa.scanTypes?.linearScan) scanTypesArr.push('Linear');
      if (pa.scanTypes?.compoundScan) scanTypesArr.push('Compound');
      const scanTypesDisplay = scanTypesArr.length > 0 ? scanTypesArr.join(', ') : undefined;

      const paInfo = buildTableRows([
        ['Refracted Angle Start', pa.refractedAngleStart !== undefined ? `${pa.refractedAngleStart} deg` : undefined],
        ['Refracted Angle End', pa.refractedAngleEnd !== undefined ? `${pa.refractedAngleEnd} deg` : undefined],
        ['Aperture', pa.aperture?.toString()],
        ['Focus Laws', pa.focusLaws],
        ['Scan Types', scanTypesDisplay],
      ]);

      if (paInfo.length > 0) {
        autoTable(this.pdf, {
          startY: y,
          head: [['Phased Array', 'Value']],
          body: paInfo,
          theme: 'grid',
          styles: { fontSize: 9, cellPadding: 3 },
          headStyles: { fillColor: [128, 0, 128], textColor: [255, 255, 255] },
          columnStyles: {
            0: { fontStyle: 'bold', cellWidth: 60 },
            1: { cellWidth: 'auto' },
          },
          margin: { left: PAGE.marginLeft, right: PAGE.marginRight, bottom: PAGE.footerHeight + 5 },
        });
      }
    }

    this.addFooter();
  }

  // =========================================================================
  // PAGE 8: ACCEPTANCE CRITERIA
  // =========================================================================

  private buildAcceptanceCriteria(): void {
    this.addHeader();
    let y = PAGE.contentStart;

    const isV2500Acceptance = this.isV2500MroStandard();
    y = this.addSectionTitle(
      this.formatSectionLabel(
        this.getMainSectionNumber('acceptance'),
        isV2500Acceptance ? 'REJECTION CRITERIA' : 'ACCEPTANCE CRITERIA'
      ),
      y
    );

    const acc = this.data.acceptanceCriteria;
    const classInfo = formatAcceptanceClass(acc.acceptanceClass);

    // Acceptance Class Badge
    if (!isV2500Acceptance && classInfo.class !== '-') {
      this.pdf.setFillColor(...COLORS.primary);
      this.pdf.roundedRect(PAGE.marginLeft, y, 80, 20, 3, 3, 'F');
      this.pdf.setTextColor(255, 255, 255);
      this.pdf.setFontSize(10);
      this.pdf.setFont('helvetica', 'bold');
      this.pdf.text('ACCEPTANCE CLASS', PAGE.marginLeft + 5, y + 8);
      this.pdf.setFontSize(16);
      this.pdf.text(classInfo.class, PAGE.marginLeft + 5, y + 17);

      // Description
      this.pdf.setTextColor(...COLORS.text);
      this.pdf.setFontSize(10);
      this.pdf.setFont('helvetica', 'normal');
      this.pdf.text(classInfo.description, PAGE.marginLeft + 85, y + 12, { maxWidth: 90 });

      y += 30;
    }

    // Criteria Table
    if (!isV2500Acceptance) {
      const criteriaInfo = buildTableRows([
        ['Single Discontinuity', acc.singleDiscontinuity],
        ['Multiple Discontinuities', acc.multipleDiscontinuities],
        ['Linear Discontinuity', acc.linearDiscontinuity],
        ['Back Reflection Loss', acc.backReflectionLoss ? `${acc.backReflectionLoss}%` : undefined],
        ['Noise Level', acc.noiseLevel],
      ], { showEmpty: true });

      autoTable(this.pdf, {
        startY: y,
        head: [['Criterion', 'Limit']],
        body: criteriaInfo,
        theme: 'grid',
        styles: { fontSize: 9, cellPadding: 3 },
        headStyles: { fillColor: COLORS.primary, textColor: [255, 255, 255] },
        columnStyles: {
          0: { fontStyle: 'bold', cellWidth: 70 },
          1: { cellWidth: 'auto' },
        },
        margin: { left: PAGE.marginLeft, right: PAGE.marginRight, bottom: PAGE.footerHeight + 5 },
      });

      y = this.getTableEndY(y);
    }

    // V2500 NDIP Pixel-Based Rejection Criteria (additional detail)
    if (isV2500Acceptance) {
      y = this.addSubsectionTitle('NDIP Rejection Criteria', y);

      const pwCriteriaRows = [
        ['Amplitude C-Scan', ''],
        ['  Min pixel grouping', '3 pixels (2x1 or 1x2)'],
        ['  Adjacent pixel depth tolerance', '0.025"'],
        ['  Calibration amplitude', '80% FSH (#1 FBH)'],
        ['  Reject threshold', '20% FSH (25% of calibration)'],
        ['  Evaluation threshold', '15% FSH'],
        ['TOF C-Scan', ''],
        ['  Min pixel grouping', '15 pixels connected'],
        ['  Min adjacent scan lines', '3'],
        ['  SNR threshold', '>=1.5:1'],
        ['  Low noise threshold', '5.0% FSH'],
        ['  Low noise rejection level', '7.5% FSH (when avg noise <5%)'],
        ['Post-Calibration / Reporting', ''],
        ['  Post-calibration tolerance', '+/-1 dB'],
        ['  Re-scan trigger', 'Any channel outside +/-1 dB'],
        ['  Reporting', 'Transfer data to PW MPE-NDE via MFT'],
      ];

      autoTable(this.pdf, {
        startY: y,
        body: pwCriteriaRows,
        theme: 'plain',
        styles: { fontSize: 8, cellPadding: { top: 1.5, bottom: 1.5, left: 3, right: 3 } },
        columnStyles: {
          0: { fontStyle: 'bold', cellWidth: 75, textColor: COLORS.lightText },
          1: { cellWidth: 'auto', textColor: COLORS.text },
        },
        didParseCell: (data) => {
          // Bold section headers
          if (data.row.index === 0 || data.row.index === 6 || data.row.index === 12) {
            data.cell.styles.fillColor = [230, 235, 245];
            data.cell.styles.fontStyle = 'bold';
            data.cell.styles.textColor = COLORS.primary;
          }
        },
        margin: { left: PAGE.marginLeft, right: PAGE.marginRight },
      });

      y = this.getTableEndY(y);
    }

    // Special Requirements
    if (!isV2500Acceptance && acc.specialRequirements) {
      y = this.addSubsectionTitle('Special Requirements', y);
      this.pdf.setFontSize(9);
      this.pdf.text(acc.specialRequirements, PAGE.marginLeft, y + 5, { maxWidth: PAGE.contentWidth });
      y += 20;
    }

    if (!isV2500Acceptance && acc.includeStandardNotesInReport && acc.standardNotes) {
      y = this.addSubsectionTitle('Standard Notes', y);
      this.pdf.setFontSize(8);
      this.pdf.text(acc.standardNotes, PAGE.marginLeft, y + 5, { maxWidth: PAGE.contentWidth });
      y += 18;
    }

    // AMS-STD-2154 / MIL-STD-2154 Table 6 Notes
    if (this.hasAcceptanceNotesPage()) {
      this.addFooter();
      this.addNewPage();
      this.addHeader();
      y = PAGE.contentStart;

      y = this.addSectionTitle(
        this.formatSectionLabel(this.getAcceptanceNotesSectionNumber(), 'TABLE 6 - ULTRASONIC CLASSES NOTES'),
        y
      );

      const table6Notes: [string, string][] = [
        ['1/', 'Any discontinuity with an indication greater than the response from a reference flat-bottom hole or equivalent notch at the estimated discontinuity depth of the size given (inches diameter) is not acceptable.'],
        ['2/', 'Multiple discontinuities with indications greater than the response from a reference flat-bottom hole or equivalent notch at the estimated discontinuity depth of the size given (inches diameter) are not acceptable if the centers of any two of these discontinuities are less than 1 inch apart. Not applicable to class C.'],
        ['3/', 'Any discontinuity longer than the length given with indications greater than the response given (flat-bottom hole or equivalent notch response) is not acceptable. Not applicable to class C.'],
        ['4/', 'Loss of back reflection greater than the percent given, when compared to non-defective material in a similar or like part, is not acceptable when this loss of back reflection is accompanied by an increase or decrease in noise signal (at least double the normal background noise signal) between the front and back surface. Applicable only to straight beam tests.'],
        ['5/', 'When inspecting titanium to class AA, the multiple discontinuity separation shall be 1/4 inch.'],
        ['6/', 'For class AAA single discontinuity, 50% of 2/64 = 25% of 3/64.'],
        ['7/', 'For class AAA linear and multiple discontinuities, 1/64 or 25% of 2/64 = 10% of 3/64.'],
      ];

      autoTable(this.pdf, {
        startY: y,
        body: table6Notes,
        theme: 'plain',
        styles: { fontSize: 7.5, cellPadding: { top: 1.5, bottom: 1.5, left: 3, right: 3 } },
        columnStyles: {
          0: { fontStyle: 'bold', cellWidth: 12, textColor: COLORS.text, halign: 'right' },
          1: { cellWidth: 'auto', textColor: COLORS.lightText },
        },
        margin: { left: PAGE.marginLeft, right: PAGE.marginRight, bottom: PAGE.footerHeight + 5 },
      });

      y = this.getTableEndY(y);
    }

    // Material Warning
    const warning = getMaterialWarning(this.data.inspectionSetup.material, this.data.standard);
    if (warning) {
      y += 5;
      // Use darker box for PW warnings
      const bgColor: [number, number, number] = isV2500Acceptance ? [226, 232, 240] : [255, 243, 205];
      const borderColor: [number, number, number] = isV2500Acceptance ? [30, 41, 59] : [255, 193, 7];
      const titleColor: [number, number, number] = isV2500Acceptance ? [30, 41, 59] : [133, 100, 4];
      const warningBoxHeight = isV2500Acceptance ? 28 : 20;

      this.pdf.setFillColor(...bgColor);
      this.pdf.roundedRect(PAGE.marginLeft, y, PAGE.contentWidth, warningBoxHeight, 2, 2, 'F');
      this.pdf.setDrawColor(...borderColor);
      this.pdf.roundedRect(PAGE.marginLeft, y, PAGE.contentWidth, warningBoxHeight, 2, 2, 'S');

      this.pdf.setFontSize(9);
      this.pdf.setFont('helvetica', 'bold');
      this.pdf.setTextColor(...titleColor);
      this.pdf.text(isV2500Acceptance ? 'P&W OEM REQUIREMENTS' : 'MATERIAL WARNING', PAGE.marginLeft + 5, y + 6);
      this.pdf.setFont('helvetica', 'normal');
      this.pdf.setFontSize(8);
      this.pdf.text(warning, PAGE.marginLeft + 5, y + 12, { maxWidth: PAGE.contentWidth - 10 });
      this.pdf.setTextColor(...COLORS.text);
    }

    this.addFooter();
  }

  // =========================================================================
  // PAGE 9: SCAN DETAILS & DIRECTIONS (if available)
  // =========================================================================

  private buildScanDetails(): void {
    this.addHeader();
    let y = PAGE.contentStart;

    y = this.addSectionTitle(this.formatSectionLabel(this.getScanSectionNumberFor('scan-details'), 'SCAN DETAILS & DIRECTIONS'), y);

    if (!this.data.scanDetails) {
      this.pdf.setFontSize(10);
      this.pdf.setTextColor(...COLORS.lightText);
      this.pdf.text('No scan direction details available.', PAGE.marginLeft, y + 10);
      this.pdf.setTextColor(...COLORS.text);
      this.addFooter();
      return;
    }

    const sd = this.data.scanDetails;
    const enabledDetails = getActiveScanDetails(sd.scanDetails);

    if (enabledDetails.length === 0) {
      this.pdf.setFontSize(10);
      this.pdf.setTextColor(...COLORS.lightText);
      this.pdf.text('No scan directions configured.', PAGE.marginLeft, y + 10);
      this.pdf.setTextColor(...COLORS.text);
      this.addFooter();
      return;
    }

    const formatGateCompact = (gate?: { position?: number | string; start?: number; length?: number; stop?: number; level?: number }): string => {
      if (!gate) return '-';
      if (gate.position !== undefined || gate.stop !== undefined) {
        const position = gate.position ?? '-';
        const start = gate.start ?? '-';
        const stop = gate.stop ?? '-';
        return `${position}-${start}-${stop}`;
      }
      return `${gate.start ?? '-'}-${gate.length ?? '-'}-${gate.level ?? '-'}%`;
    };

    const computeNearFieldCompact = (detail: any): string => {
      const d = Number(detail.activeElementDiameter);
      const f = Number.parseFloat(detail.frequency || '');
      const v = Number(detail.velocity || 5920);
      if (!Number.isFinite(d) || d <= 0 || !Number.isFinite(f) || f <= 0 || !Number.isFinite(v) || v <= 0) {
        return '-';
      }
      const velocityMmUs = v / 1000;
      return `${((d * d * f) / (4 * velocityMmUs)).toFixed(2)} mm`;
    };

    const formatEntrySurface = (entrySurface?: string): string => {
      if (!entrySurface) return '-';
      const surfaceLabels: Record<string, string> = {
        top: 'Top',
        bottom: 'Bottom',
        side: 'Side',
        od: 'OD',
        id: 'ID',
        end: 'End',
        radial: 'Radial',
      };
      return surfaceLabels[entrySurface] || entrySurface.replace(/_/g, ' ');
    };

    const formatWaveType = (waveMode?: string): string => {
      const normalized = (waveMode || '').toLowerCase();
      if (normalized.includes('shear')) return 'S';
      if (normalized.includes('long') || normalized.includes('dual')) return 'L';
      return '-';
    };

    const formatTechniqueLabel = (technique?: string): string => {
      if (!technique) return '-';
      const techniqueMap: Record<string, string> = {
        conventional: 'Conventional',
        bubbler: 'Bubbler',
        squirt: 'Squirt / Water Jet',
        phased_array: 'Phased Array',
      };
      return techniqueMap[technique] || technique;
    };

    const buildCellText = (lines: Array<[string, string]>): string => {
      const visibleLines = lines.filter(([, value]) => value && value !== '-');
      if (visibleLines.length === 0) {
        return '-';
      }

      return visibleLines.map(([label, value]) => `${label}: ${value}`).join('\n');
    };

    const consolidatedRows: string[][] = enabledDetails.map((detail) => {
      const waveType = formatWaveType(detail.waveMode);
      const rangeDelay = detail.utRange !== undefined || detail.utDelay !== undefined
        ? `${detail.utRange ?? '-'} / ${detail.utDelay ?? '-'}`
        : '-';
      const prfDb = detail.prf !== undefined || detail.db !== undefined
        ? `${detail.prf ?? '-'} / ${detail.db ?? '-'}`
        : '-';
      const indexFilter = detail.indexMode || detail.filter
        ? `${detail.indexMode || '-'} / ${detail.filter || '-'}`
        : '-';
      const rejectTcg = detail.reject || detail.tcgMode !== undefined
        ? `${detail.reject || '-'} / ${detail.tcgMode === true ? 'YES' : detail.tcgMode === false ? 'NO' : '-'}`
        : '-';
      const attenBwe = detail.attenuation !== undefined || detail.backWallEcho !== undefined
        ? `${detail.attenuation ?? '-'} / ${detail.backWallEcho ?? '-'}`
        : '-';

      return [
        detail.scanningDirection || '-',
        buildCellText([
          ['Entry', formatEntrySurface(detail.entrySurface)],
          ['Wave', detail.waveMode ? `${waveType} | ${detail.waveMode}` : waveType],
          ['Angle', detail.angle !== undefined ? `${detail.angle} deg` : '-'],
          ['Water Path', detail.waterPath !== undefined ? `${detail.waterPath} mm` : '-'],
          ['Remarks', detail.remarkDetails || '-'],
        ]),
        buildCellText([
          ['Probe', detail.probe || '-'],
          ['Make', detail.make || '-'],
          ['P/N / S/N', detail.partNumber || detail.serialNumber ? `${detail.partNumber || '-'} / ${detail.serialNumber || '-'}` : '-'],
          ['Technique / Freq.', detail.technique || detail.frequency ? `${formatTechniqueLabel(detail.technique || this.data.scanParameters.technique)} / ${detail.frequency ? `${detail.frequency} MHz` : '-'}` : '-'],
          ['Wave Mode', detail.waveMode || '-'],
        ]),
        buildCellText([
          ['Active Elem.', detail.activeElementDiameter !== undefined ? `${detail.activeElementDiameter} mm` : (detail.activeElement || '-')],
          ['Bandwidth', detail.bandwidth || '-'],
          ['Focus', detail.focusSize || '-'],
          ['Velocity / Near Field', detail.velocity !== undefined || computeNearFieldCompact(detail) !== '-'
            ? `${detail.velocity !== undefined ? `${detail.velocity} m/s` : '-'} / ${computeNearFieldCompact(detail)}`
            : '-'],
          ['SSS', detail.sss || '-'],
          ['Atten. / BWE', attenBwe],
        ]),
        buildCellText([
          ['UT', detail.utParameter || detail.pulsarParams || '-'],
          ['Range / Delay', rangeDelay],
          ['PRF / dB', prfDb],
          ['Index / Filter', indexFilter],
          ['Reject / TCG', rejectTcg],
          ['G1', formatGateCompact(detail.gate1)],
          ['G2', formatGateCompact(detail.gate2)],
          ['G3', formatGateCompact(detail.gate3)],
          ['G4', formatGateCompact(detail.gate4)],
          ['File', detail.scanningFile || '-'],
        ]),
      ];
    });

    autoTable(this.pdf, {
      startY: y,
      head: [['Dir', 'Scan Setup', 'Search Unit / Probe', 'Acoustic Data', 'Instrument & Gates']],
      body: consolidatedRows,
      theme: 'grid',
      styles: {
        fontSize: 6.3,
        cellPadding: { top: 1.8, bottom: 1.8, left: 1.8, right: 1.8 },
        lineColor: COLORS.tableBorder,
        lineWidth: 0.2,
        overflow: 'linebreak',
        valign: 'top',
      },
      headStyles: {
        fillColor: COLORS.primary,
        textColor: [255, 255, 255],
        fontSize: 7,
        fontStyle: 'bold',
        halign: 'center',
        valign: 'middle',
      },
      columnStyles: {
        0: { cellWidth: 12, halign: 'center', fontStyle: 'bold', valign: 'middle' },
        1: { cellWidth: 34 },
        2: { cellWidth: 42 },
        3: { cellWidth: 34 },
        4: { cellWidth: 58 },
      },
      didParseCell: (data) => {
        if (data.section === 'body' && data.column.index === 0) {
          const detail = enabledDetails[data.row.index];
          const waveType = formatWaveType(detail?.waveMode);
          data.cell.styles.textColor = [255, 255, 255];
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fontSize = 8;

          if (waveType === 'S') {
            data.cell.styles.fillColor = [220, 53, 69];
          } else if (waveType === 'L') {
            data.cell.styles.fillColor = [0, 122, 194];
          } else {
            data.cell.styles.fillColor = COLORS.secondary;
          }
        }
      },
      alternateRowStyles: { fillColor: COLORS.rowAlt },
      margin: { left: PAGE.marginLeft, right: PAGE.marginRight, bottom: PAGE.footerHeight + 5 },
      rowPageBreak: 'avoid',
    });

    this.addFooter();
    return;

    // ========== FRISA-STYLE INTEGRATED SCAN PLAN TABLE ==========
    // Main scan plan table with all key parameters in one view

    // Wave mode color coding legend
    this.pdf.setFontSize(7);
    this.pdf.setTextColor(...COLORS.lightText);
    this.pdf.text('Legend:', PAGE.marginLeft, y + 3);

    // L-Wave indicator
    this.pdf.setFillColor(0, 122, 194); // Blue
    this.pdf.rect(PAGE.marginLeft + 18, y, 8, 4, 'F');
    this.pdf.setTextColor(255, 255, 255);
    this.pdf.setFontSize(6);
    this.pdf.text('L', PAGE.marginLeft + 20.5, y + 3);

    this.pdf.setTextColor(...COLORS.lightText);
    this.pdf.setFontSize(7);
    this.pdf.text('Longitudinal', PAGE.marginLeft + 28, y + 3);

    // S-Wave indicator
    this.pdf.setFillColor(220, 53, 69); // Red
    this.pdf.rect(PAGE.marginLeft + 55, y, 8, 4, 'F');
    this.pdf.setTextColor(255, 255, 255);
    this.pdf.setFontSize(6);
    this.pdf.text('S', PAGE.marginLeft + 57.5, y + 3);

    this.pdf.setTextColor(...COLORS.lightText);
    this.pdf.setFontSize(7);
    this.pdf.text('Shear', PAGE.marginLeft + 65, y + 3);

    y += 8;

    // Main scan plan table — FIXED: use entrySurface, remove phantom fields, add remarks
    const scanPlanRows: string[][] = enabledDetails.map((detail, index) => {
      const wm = (detail.waveMode || '').toLowerCase();
      const waveType = wm.includes('shear') ? 'S' :
                       (wm.includes('long') || wm.includes('dual')) ? 'L' : '-';
      return [
        String(index + 1),                                           // Seq
        detail.scanningDirection,                                    // Dir (A, B, C, etc.)
        detail.entrySurface || '-',                                  // Entry Surface (was phantom "surface")
        waveType,                                                    // Wave (L/S)
        detail.angle !== undefined ? `${detail.angle} deg` : '0 deg',     // Angle
        detail.waterPath ? `${detail.waterPath}` : '-',              // Water Path
        detail.remarkDetails || '-',                                 // Remarks
      ];
    });

    autoTable(this.pdf, {
      startY: y,
      head: [['Seq', 'Dir', 'Entry Surface', 'Wave', 'Angle', 'Water Path', 'Remarks']],
      body: scanPlanRows,
      theme: 'grid',
      styles: { fontSize: 7, cellPadding: 2, lineColor: COLORS.tableBorder, lineWidth: 0.2 },
      headStyles: {
        fillColor: COLORS.primary,
        textColor: [255, 255, 255],
        fontSize: 7,
        fontStyle: 'bold',
        halign: 'center',
      },
      columnStyles: {
        0: { cellWidth: 10, halign: 'center', fontStyle: 'bold' },   // Seq
        1: { cellWidth: 12, halign: 'center', fontStyle: 'bold' },   // Dir
        2: { cellWidth: 24 },                                         // Entry Surface
        3: { cellWidth: 12, halign: 'center' },                       // Wave
        4: { cellWidth: 16, halign: 'center' },                       // Angle
        5: { cellWidth: 20, halign: 'center' },                       // Water Path
        6: { cellWidth: 'auto' },                                     // Remarks
      },
      didParseCell: (data) => {
        // Color code the Wave column
        if (data.column.index === 3 && data.section === 'body') {
          const wave = data.cell.raw as string;
          if (wave === 'L') {
            data.cell.styles.fillColor = [0, 122, 194]; // Blue for L-wave
            data.cell.styles.textColor = [255, 255, 255];
            data.cell.styles.fontStyle = 'bold';
          } else if (wave === 'S') {
            data.cell.styles.fillColor = [220, 53, 69]; // Red for S-wave
            data.cell.styles.textColor = [255, 255, 255];
            data.cell.styles.fontStyle = 'bold';
          }
        }
        // Highlight Direction column
        if (data.column.index === 1 && data.section === 'body') {
          data.cell.styles.fillColor = COLORS.sectionBg;
        }
      },
      alternateRowStyles: { fillColor: COLORS.rowAlt },
      margin: { left: PAGE.marginLeft, right: PAGE.marginRight, bottom: PAGE.footerHeight + 5 },
    });

    y = this.getTableEndY(y);

    // ========== PROBE & EQUIPMENT DETAILS TABLE ==========
    y = this.addSubsectionTitle('Search Unit Details', y);

    const probeDetailRows: string[][] = enabledDetails.map((detail) => [
      detail.scanningDirection,
      detail.probe || '-',
      detail.waterPath ? `${detail.waterPath}` : '-',
      detail.make || '-',
      detail.partNumber || '-',
      detail.serialNumber || '-',
      detail.waveMode || '-',
    ]);

    autoTable(this.pdf, {
      startY: y,
      head: [['Dir', 'Probe Details (Size, Type, Angle)', 'Water Path', 'Make', 'Part No.', 'Serial No.', 'Wave Mode']],
      body: probeDetailRows,
      theme: 'grid',
      styles: { fontSize: 7, cellPadding: 2 },
      headStyles: { fillColor: COLORS.secondary, textColor: [255, 255, 255], fontSize: 7 },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 12, halign: 'center' },
        1: { cellWidth: 55 },
        2: { cellWidth: 18, halign: 'center' },
        3: { cellWidth: 22 },
        4: { cellWidth: 25 },
        5: { cellWidth: 25 },
        6: { cellWidth: 'auto' },
      },
      alternateRowStyles: { fillColor: COLORS.rowAlt },
      margin: { left: PAGE.marginLeft, right: PAGE.marginRight, bottom: PAGE.footerHeight + 5 },
    });

    y = this.getTableEndY(y);

    // ========== PROBE PARAMETERS TABLE ==========
    y = this.addSubsectionTitle('Probe Parameters', y);

    const formatGate = (gate?: { position?: number | string; start?: number; length?: number; stop?: number; level?: number }): string => {
      if (!gate) return '-';
      if (gate.position !== undefined || gate.stop !== undefined) {
        const position = gate.position ?? '-';
        const start = gate.start ?? '-';
        const stop = gate.stop ?? '-';
        return `${position}-${start}-${stop}`;
      }
      return `${gate.start ?? '-'}-${gate.length ?? '-'}-${gate.level ?? '-'}%`;
    };

    const computeNearField = (detail: any): string => {
      const d = Number(detail.activeElementDiameter);
      const f = Number.parseFloat(detail.frequency || '');
      const v = Number(detail.velocity || 5920);
      if (!Number.isFinite(d) || d <= 0 || !Number.isFinite(f) || f <= 0 || !Number.isFinite(v) || v <= 0) {
        return '-';
      }
      const velocityMmUs = v / 1000;
      const nearField = (d * d * f) / (4 * velocityMmUs);
      return `${nearField.toFixed(2)} mm`;
    };

    const probeParamRows: string[][] = enabledDetails.map((detail) => [
      detail.scanningDirection,
      detail.activeElementDiameter !== undefined ? `${detail.activeElementDiameter}` : '-',
      detail.bandwidth || '-',
      detail.focusSize || '-',
      detail.waterPath ? `${detail.waterPath}` : '-',
      detail.velocity !== undefined ? `${detail.velocity}` : '-',
      computeNearField(detail),
    ]);

    autoTable(this.pdf, {
      startY: y,
      head: [['Dir', 'Active Element (mm)', 'Bandwidth', 'Focus Size', 'Water Path', 'Velocity (m/s)', 'Near Field']],
      body: probeParamRows,
      theme: 'grid',
      styles: { fontSize: 7, cellPadding: 2 },
      headStyles: { fillColor: [16, 185, 129], textColor: [255, 255, 255], fontSize: 7 },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 12, halign: 'center' },
        1: { cellWidth: 28, halign: 'center' },
        2: { cellWidth: 26 },
        3: { cellWidth: 24 },
        4: { cellWidth: 20, halign: 'center' },
        5: { cellWidth: 24, halign: 'center' },
        6: { cellWidth: 'auto', halign: 'center' },
      },
      alternateRowStyles: { fillColor: COLORS.rowAlt },
      margin: { left: PAGE.marginLeft, right: PAGE.marginRight, bottom: PAGE.footerHeight + 5 },
    });

    y = this.getTableEndY(y);

    // ========== U.T PARAMETERS TABLE (expanded with all per-direction fields) ==========
    y = this.addSubsectionTitle('U.T Parameters', y);

    const utRows: string[][] = enabledDetails.map((detail) => {
      return [
        detail.scanningDirection,
        detail.utParameter || detail.pulsarParams || '-',
        detail.utRange !== undefined ? `${detail.utRange}` : '-',
        detail.utDelay !== undefined ? `${detail.utDelay}` : '-',
        detail.prf ? `${detail.prf}` : '-',
        detail.db !== undefined ? `${detail.db}` : '-',
        detail.indexMode || '-',
        detail.filter || '-',
        detail.reject || '-',
        detail.tcgMode !== undefined ? (detail.tcgMode ? 'YES' : 'NO') : '-',
      ];
    });

    autoTable(this.pdf, {
      startY: y,
      head: [['Dir', 'U.T Parameter', 'Range', 'Delay', 'PRF', 'dB', 'Index', 'Filter', 'Reject', 'TCG']],
      body: utRows,
      theme: 'grid',
      tableWidth: PAGE.contentWidth,
      styles: {
        fontSize: 6.8,
        cellPadding: { top: 1.8, bottom: 1.8, left: 1.6, right: 1.6 },
        overflow: 'linebreak',
        valign: 'middle',
      },
      headStyles: { fillColor: [99, 102, 241], textColor: [255, 255, 255], fontSize: 6.5 },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 10, halign: 'center' },
        1: { cellWidth: 34 },
        2: { cellWidth: 15, halign: 'center' },
        3: { cellWidth: 15, halign: 'center' },
        4: { cellWidth: 18, halign: 'center' },
        5: { cellWidth: 12, halign: 'center' },
        6: { cellWidth: 15, halign: 'center' },
        7: { cellWidth: 16, halign: 'center' },
        8: { cellWidth: 16, halign: 'center' },
        9: { cellWidth: 14, halign: 'center' },
      },
      alternateRowStyles: { fillColor: COLORS.rowAlt },
      margin: { left: PAGE.marginLeft, right: PAGE.marginRight, bottom: PAGE.footerHeight + 5 },
    });

    y = this.getTableEndY(y);

    // ========== GATE SETTINGS TABLE (Gates 1-4) ==========
    y = this.addSubsectionTitle('Gate Settings', y);

    const hasNdipGateShape = enabledDetails.some((detail) =>
      [detail.gate1, detail.gate2, detail.gate3, detail.gate4].some(
        (gate) => gate?.position !== undefined || gate?.stop !== undefined
      )
    );

    const gateRows: string[][] = enabledDetails.map((detail) => {
      return [
        detail.scanningDirection,
        formatGate(detail.gate1),
        formatGate(detail.gate2),
        formatGate(detail.gate3),
        formatGate(detail.gate4),
        detail.scanningFile || '-',
      ];
    });

    autoTable(this.pdf, {
      startY: y,
      head: [[
        'Dir',
        hasNdipGateShape ? 'Gate 1 (Pos-Start-Stop)' : 'Gate 1 (S-L-Lvl%)',
        hasNdipGateShape ? 'Gate 2 (Pos-Start-Stop)' : 'Gate 2 (S-L-Lvl%)',
        hasNdipGateShape ? 'Gate 3 (Pos-Start-Stop)' : 'Gate 3 (S-L-Lvl%)',
        hasNdipGateShape ? 'Gate 4 (Pos-Start-Stop)' : 'Gate 4 (S-L-Lvl%)',
        'Scanning File'
      ]],
      body: gateRows,
      theme: 'grid',
      styles: { fontSize: 7, cellPadding: 2 },
      headStyles: { fillColor: [245, 158, 11], textColor: [255, 255, 255], fontSize: 7 },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 12, halign: 'center' },
        1: { cellWidth: 30, halign: 'center' },
        2: { cellWidth: 30, halign: 'center' },
        3: { cellWidth: 30, halign: 'center' },
        4: { cellWidth: 30, halign: 'center' },
        5: { cellWidth: 'auto' },
      },
      alternateRowStyles: { fillColor: COLORS.rowAlt },
      margin: { left: PAGE.marginLeft, right: PAGE.marginRight, bottom: PAGE.footerHeight + 5 },
    });

    this.addFooter();
  }

  // =========================================================================
  // PAGE 9.5: SCAN DIRECTIONS DRAWING (if available)
  // =========================================================================

  private buildScanDirectionsDrawing(): void {
    this.addHeader();
    let y = PAGE.contentStart;

    // Dynamic section numbering — avoid collision with e2375 which uses 6.1
    y = this.addSectionTitle(this.formatSectionLabel(this.getScanSectionNumberFor('scan-directions'), 'SCAN DIRECTIONS - INSPECTION PLAN'), y);

    if (this.data.scanDirectionsDrawing) {
      try {
        // Calculate proper dimensions from actual image (preserves aspect ratio)
        const maxWidth = PAGE.contentWidth * 0.9;
        const maxHeight = Math.min(PAGE.height - y - PAGE.footerHeight - 35, 160);
        const { width: imgWidth, height: imgHeight } = this.calculateImageDimensions(
          this.data.scanDirectionsDrawing,
          maxWidth,
          maxHeight
        );

        const xPos = PAGE.marginLeft + (PAGE.contentWidth - imgWidth) / 2;

        this.pdf.setDrawColor(200, 200, 200);
        this.pdf.setLineWidth(0.5);
        this.pdf.rect(xPos - 2, y - 2, imgWidth + 4, imgHeight + 4);

        this.pdf.addImage(
          this.data.scanDirectionsDrawing,
          'PNG',
          xPos,
          y,
          imgWidth,
          imgHeight,
          undefined,
          'FAST' // High quality - minimal compression
        );

        // Add caption below the image
        const captionY = y + imgHeight + 8;
        this.pdf.setFontSize(9);
        this.pdf.setTextColor(...COLORS.lightText);
        this.pdf.text(
          'Figure: Inspection plan showing selected scanning directions with entry surfaces and beam paths.',
          PAGE.width / 2,
          captionY,
          { align: 'center' }
        );
      } catch {
        this.pdf.setFontSize(10);
        this.pdf.setTextColor(...COLORS.lightText);
        this.pdf.text('Scan directions drawing could not be loaded.', PAGE.marginLeft, y + 20);
      }
    } else {
      this.pdf.setFontSize(10);
      this.pdf.setTextColor(...COLORS.lightText);
      this.pdf.text('No scan directions drawing available.', PAGE.marginLeft, y + 10);
      this.pdf.text('Visit the Scan Details tab to generate the inspection plan drawing.', PAGE.marginLeft, y + 20);
    }

    this.pdf.setTextColor(...COLORS.text);
    this.addFooter();
  }

  // =========================================================================
  // PAGE 10: TECHNICAL DRAWING (if available)
  // =========================================================================

  private buildTechnicalDrawing(): void {
    this.addHeader();
    let y = PAGE.contentStart;

    // Dynamic section numbering based on what's included
    y = this.addSectionTitle(this.formatSectionLabel(this.getTechnicalDrawingSectionNumber(), 'TECHNICAL DRAWING'), y);

    if (this.data.capturedDrawing) {
      try {
        // Calculate proper dimensions from actual image (preserves aspect ratio)
        const maxWidth = PAGE.contentWidth * 0.9;
        const maxHeight = Math.min(PAGE.height - y - PAGE.footerHeight - 25, 160);
        const { width: imgWidth, height: imgHeight } = this.calculateImageDimensions(
          this.data.capturedDrawing,
          maxWidth,
          maxHeight
        );

        // Center horizontally
        const xPos = PAGE.marginLeft + (PAGE.contentWidth - imgWidth) / 2;

        // Add border/frame around image
        this.pdf.setDrawColor(200, 200, 200);
        this.pdf.setLineWidth(0.5);
        this.pdf.rect(xPos - 2, y - 2, imgWidth + 4, imgHeight + 4);

        this.pdf.addImage(
          this.data.capturedDrawing,
          'PNG',
          xPos,
          y,
          imgWidth,
          imgHeight,
          undefined,
          'FAST' // High quality - minimal compression
        );
      } catch {
        this.drawGeneratedTechnicalDrawing(PAGE.marginLeft + 5, y, PAGE.contentWidth - 10, 150);
      }
    } else {
      this.drawGeneratedTechnicalDrawing(PAGE.marginLeft + 5, y, PAGE.contentWidth - 10, 150);
    }

    this.pdf.setTextColor(...COLORS.text);
    this.addFooter();
  }

  // =========================================================================
  // PAGE: SCAN PLAN (Reference Documents)
  // =========================================================================

  private buildScanPlan(): void {
    this.addHeader();
    let y = PAGE.contentStart;

    // Calculate dynamic section number
    y = this.addSectionTitle(this.formatSectionLabel(this.getMainSectionNumber('scan-plan'), 'SCAN PLAN & REFERENCE DOCUMENTS'), y);

    // Safe check for scanPlan and documents
    const documents = this.data.scanPlan?.documents || [];
    
    if (!this.data.scanPlan || documents.length === 0) {
      this.pdf.setFontSize(10);
      this.pdf.setTextColor(...COLORS.lightText);
      this.pdf.text('No scan plan documents available.', PAGE.marginLeft, y + 10);
      this.pdf.setTextColor(...COLORS.text);
      this.addFooter();
      return;
    }

    // Filter active documents and sort by order
    const activeDocuments = documents
      .filter(doc => doc && doc.isActive)
      .sort((a, b) => (a.order || 0) - (b.order || 0));

    if (activeDocuments.length === 0) {
      this.pdf.setFontSize(10);
      this.pdf.setTextColor(...COLORS.lightText);
      this.pdf.text('No active scan plan documents configured.', PAGE.marginLeft, y + 10);
      this.pdf.setTextColor(...COLORS.text);
      this.addFooter();
      return;
    }

    // Subtitle
    this.pdf.setFontSize(FONTS.small.size);
    this.pdf.setTextColor(...COLORS.lightText);
    this.pdf.text('The following reference documents are associated with this technique sheet:', PAGE.marginLeft, y);
    y += 10;

    // Build documents table - ensure all values are strings
    const documentRows = activeDocuments.map((doc, index) => [
      String(index + 1),
      String(doc.title || '-'),
      String(doc.description || '-'),
      String(doc.category || 'General'),
      doc.filePath ? String(doc.filePath.split('/').pop() || '-') : '-',
    ]);

    autoTable(this.pdf, {
      startY: y,
      head: [['#', 'Document Title', 'Description', 'Category', 'File Reference']],
      body: documentRows,
      theme: 'grid',
      styles: { fontSize: 9, cellPadding: 3 },
      headStyles: { fillColor: COLORS.primary, textColor: [255, 255, 255] },
      columnStyles: {
        0: { cellWidth: 10, halign: 'center' },
        1: { fontStyle: 'bold', cellWidth: 50 },
        2: { cellWidth: 'auto' },
        3: { cellWidth: 30 },
        4: { cellWidth: 35, fontSize: 8 },
      },
      margin: { left: PAGE.marginLeft, right: PAGE.marginRight, bottom: PAGE.footerHeight + 5 },
    });

    y = this.getTableEndY(y, 15);

    // Add note about documents
    this.pdf.setFillColor(240, 249, 255); // Light blue background
    this.pdf.roundedRect(PAGE.marginLeft, y, PAGE.contentWidth, 25, 2, 2, 'F');
    this.pdf.setDrawColor(59, 130, 246); // Blue border
    this.pdf.roundedRect(PAGE.marginLeft, y, PAGE.contentWidth, 25, 2, 2, 'S');

    this.pdf.setFontSize(9);
    this.pdf.setFont('helvetica', 'bold');
    this.pdf.setTextColor(30, 64, 175); // Blue text
    this.pdf.text('NOTE', PAGE.marginLeft + 5, y + 7);
    this.pdf.setFont('helvetica', 'normal');
    this.pdf.setTextColor(30, 58, 138);
    this.pdf.text(
      'The documents listed above provide detailed procedures, calibration guides, and reference materials.',
      PAGE.marginLeft + 5,
      y + 14,
      { maxWidth: PAGE.contentWidth - 10 }
    );
    this.pdf.text(
      'Refer to these documents for complete inspection methodology and compliance requirements.',
      PAGE.marginLeft + 5,
      y + 20,
      { maxWidth: PAGE.contentWidth - 10 }
    );

    this.pdf.setTextColor(...COLORS.text);
    this.addFooter();
  }

  // =========================================================================
  // PAGE 11: DOCUMENTATION
  // =========================================================================

  private buildDocumentation(): void {
    this.addHeader();
    let y = PAGE.contentStart;

    y = this.addSectionTitle(this.formatSectionLabel(this.getMainSectionNumber('documentation'), 'DOCUMENTATION'), y);

    const doc = this.data.documentation;

    // Inspector Info
    y = this.addSubsectionTitle('Inspector', y);

    const inspectorInfo = buildTableRows([
      ['Inspector Name', doc.inspectorName],
      ['Certification Number', doc.inspectorCertification],
      ['Level', doc.inspectorLevel],
      ['Certifying Organization', doc.certifyingOrganization],
    ], { showEmpty: true });

    autoTable(this.pdf, {
      startY: y,
      body: inspectorInfo,
      theme: 'grid',
      styles: { fontSize: 9, cellPadding: 3 },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 60 },
        1: { cellWidth: 'auto' },
      },
      margin: { left: PAGE.marginLeft, right: PAGE.marginRight, bottom: PAGE.footerHeight + 5 },
    });

    y = this.getTableEndY(y);

    // Customer & Document Info
    y = this.addSubsectionTitle('Customer & Document', y);

    const customerInfo = buildTableRows([
      ['Customer Name', doc.customerName],
      ['Purchase Order', doc.purchaseOrder],
      ['Part Serial Number', doc.serialNumber],
      ['Inspection Date', formatDate(doc.inspectionDate)],
      ['Procedure Number', doc.procedureNumber],
      ['Drawing Reference', doc.drawingReference],
      ['Revision', doc.revision],
    ], { showEmpty: true });

    autoTable(this.pdf, {
      startY: y,
      body: customerInfo,
      theme: 'grid',
      styles: { fontSize: 9, cellPadding: 3 },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 60 },
        1: { cellWidth: 'auto' },
      },
      margin: { left: PAGE.marginLeft, right: PAGE.marginRight, bottom: PAGE.footerHeight + 5 },
    });

    y = this.getTableEndY(y);

    // Additional Notes
    if (doc.additionalNotes) {
      y = this.addSubsectionTitle('Additional Notes', y);
      this.pdf.setFontSize(9);
      this.pdf.text(doc.additionalNotes, PAGE.marginLeft, y + 5, { maxWidth: PAGE.contentWidth });
    }

    this.addFooter();
  }

  // =========================================================================
  // PAGE 12: APPROVAL SIGNATURES
  // =========================================================================

  private buildApprovals(): void {
    this.addHeader();
    let y = PAGE.contentStart;

    y = this.addSectionTitle(this.formatSectionLabel(this.getMainSectionNumber('approvals'), 'APPROVALS & DOCUMENT CONTROL'), y);

    const doc = this.data.documentation;
    const setup = this.data.inspectionSetup;

    // ========== REVISION HISTORY TABLE (FRISA/TÜV Style) ==========
    y = this.addSubsectionTitle('Revision History', y);

    const revisionRows = [
      [doc.revision || 'A', formatDate(doc.inspectionDate), 'Initial Release', doc.inspectorName || '', '', ''],
      ['', '', '', '', '', ''],  // Empty row for future revisions
      ['', '', '', '', '', ''],  // Empty row for future revisions
    ];

    autoTable(this.pdf, {
      startY: y,
      head: [['Rev', 'Date', 'Description', 'Prepared By', 'Approved By', 'Sign']],
      body: revisionRows,
      theme: 'grid',
      tableWidth: PAGE.contentWidth,
      styles: {
        fontSize: 8,
        cellPadding: { top: 2.5, bottom: 2.5, left: 2, right: 2 },
        minCellHeight: 10,
        overflow: 'linebreak',
        valign: 'middle',
      },
      headStyles: { fillColor: COLORS.primary, textColor: [255, 255, 255], fontSize: 8 },
      columnStyles: {
        0: { cellWidth: 12, halign: 'center', fontStyle: 'bold' },
        1: { cellWidth: 26 },
        2: { cellWidth: 50 },
        3: { cellWidth: 32 },
        4: { cellWidth: 32 },
        5: { cellWidth: 28 },
      },
      margin: { left: PAGE.marginLeft, right: PAGE.marginRight, bottom: PAGE.footerHeight + 5 },
    });

    y = this.getTableEndY(y, 8);

    // ========== APPROVAL SIGNATURES TABLE ==========
    y = this.addSubsectionTitle('Approval Signatures', y);

    const signatureRows = [
      ['UT Inspector (Level II)', doc.inspectorName || '', doc.inspectorCertification || '', formatDate(doc.inspectionDate), ''],
      ['Level III Review', '', '', '', ''],
      ['Quality Assurance', '', '', '', ''],
    ];

    if (doc.approvalRequired) {
      signatureRows.push(['Customer Representative', '', '', '', '']);
    }

    autoTable(this.pdf, {
      startY: y,
      head: [['Role', 'Name (Print)', 'Cert. Number', 'Date', 'Signature']],
      body: signatureRows,
      theme: 'grid',
      tableWidth: PAGE.contentWidth,
      styles: {
        fontSize: 8,
        cellPadding: { top: 3, bottom: 3, left: 2.5, right: 2.5 },
        minCellHeight: 12,
        overflow: 'linebreak',
        valign: 'middle',
      },
      headStyles: { fillColor: COLORS.secondary, textColor: [255, 255, 255], fontSize: 8 },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 42 },
        1: { cellWidth: 38 },
        2: { cellWidth: 30 },
        3: { cellWidth: 28 },
        4: { cellWidth: 42 },
      },
      margin: { left: PAGE.marginLeft, right: PAGE.marginRight, bottom: PAGE.footerHeight + 5 },
    });

    y = this.getTableEndY(y, 10);

    // ========== APPROVAL NOTICE (if required) ==========
    if (doc.approvalRequired) {
      this.pdf.setFillColor(255, 243, 205);
      this.pdf.roundedRect(PAGE.marginLeft, y, PAGE.contentWidth, 12, 2, 2, 'F');
      this.pdf.setFillColor(...COLORS.accentGold);
      this.pdf.rect(PAGE.marginLeft, y, 4, 12, 'F');

      this.pdf.setFontSize(8);
      this.pdf.setFont('helvetica', 'bold');
      this.pdf.setTextColor(133, 100, 4);
      this.pdf.text('NOTICE: This technique sheet requires Level III approval before use in production.', PAGE.marginLeft + 8, y + 7);
      this.pdf.setFont('helvetica', 'normal');
      this.pdf.setTextColor(...COLORS.text);
      y += 18;
    }

    // ========== DOCUMENT INFORMATION BOX ==========
    y = this.addSubsectionTitle('Document Information', y);

    const docNum = this.options.documentNumber || doc.procedureNumber || `TS-${setup.partNumber || 'XXX'}`;
    const docInfoRows = [
      ['Document Number', docNum],
      ['Current Revision', doc.revision || 'A'],
      ['Part Number', setup.partNumber || '-'],
      ['Applicable Standard', formatValue(this.data.standard)],
      ['Reference Procedure', doc.procedureNumber || '-'],
      ['Customer', doc.customerName || '-'],
    ];

    autoTable(this.pdf, {
      startY: y,
      body: docInfoRows,
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 3 },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 45, fillColor: COLORS.sectionBg },
        1: { cellWidth: 'auto' },
      },
      margin: { left: PAGE.marginLeft, right: PAGE.marginRight, bottom: PAGE.footerHeight + 5 },
    });

    y = this.getTableEndY(y, 10);

    // ========== DOCUMENT CONTROL FOOTER ==========
    this.pdf.setFillColor(...COLORS.sectionBg);
    this.pdf.rect(PAGE.marginLeft, y, PAGE.contentWidth, 25, 'F');
    this.pdf.setFillColor(...COLORS.primary);
    this.pdf.rect(PAGE.marginLeft, y, PAGE.contentWidth, 0.5, 'F');

    this.pdf.setFontSize(7);
    this.pdf.setFont('helvetica', 'bold');
    this.pdf.setTextColor(...COLORS.primary);
    this.pdf.text('DOCUMENT CONTROL', PAGE.marginLeft + 5, y + 6);

    this.pdf.setFont('helvetica', 'normal');
    this.pdf.setTextColor(...COLORS.lightText);
    this.pdf.setFontSize(7);
    this.pdf.text('This is a controlled document. Unauthorized reproduction, modification, or distribution is strictly prohibited.', PAGE.marginLeft + 5, y + 12);
    this.pdf.text('Printed copies are uncontrolled unless stamped "CONTROLLED COPY" with a valid date.', PAGE.marginLeft + 5, y + 17);
    this.pdf.text(`Document generated: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })} | Scan-Master v1.0`, PAGE.marginLeft + 5, y + 22);

    this.pdf.setTextColor(...COLORS.text);
    this.addFooter();
  }
}

export default exportTechniqueSheetPDF;
