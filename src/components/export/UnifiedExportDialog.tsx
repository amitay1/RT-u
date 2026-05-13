// @ts-nocheck
/**
 * Export Dialog - Professional & Complete
 */

import React, { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Download,
  FileText,
  FileIcon,
  Loader2,
  X,
  CheckCircle2,
  FileWarning,
  Sparkles,
  Upload,
  Building2,
  Trash2,
  Eye,
  Shield,
  AlertTriangle,
  Cpu,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { ComplianceCheckerDialog, ComplianceBadge } from "@/components/ComplianceCheckerDialog";
import { runComplianceCheck } from "@/utils/complianceChecker";
import type { ComplianceCheckData } from "@/types/compliance";

import type {
  StandardType,
  InspectionSetupData,
  EquipmentData,
  CalibrationData,
  ScanParametersData,
  AcceptanceCriteriaData,
  DocumentationData as TechniqueDocumentationData,
  ScanPlanData,
} from "@/types/techniqueSheet";
import type { InspectionReportData } from "@/types/inspectionReport";
import type { ScanDetailsData } from "@/types/scanDetails";
import type { ExportTemplate } from "@/types/unifiedInspection";

import { exportTechniqueSheetPDF } from "@/utils/export/TechniqueSheetPDF";
import { exportTechniqueSheetWord } from "@/utils/export/TechniqueSheetWord";
import { exportInspectionReportPDF } from "@/utils/export/InspectionReportPDF";
import { exportToCSI, type CSIExportData } from "@/utils/exporters/csiExporter";

interface UnifiedExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  standard: StandardType;
  inspectionSetup: InspectionSetupData;
  equipment: EquipmentData;
  calibration: CalibrationData;
  scanParameters: ScanParametersData;
  acceptanceCriteria: AcceptanceCriteriaData;
  documentation: TechniqueDocumentationData;
  inspectionReport?: InspectionReportData;
  scanDetails?: ScanDetailsData;
  scanPlan?: ScanPlanData;            // Scan plan documents
  capturedDrawing?: string;
  calibrationBlockDiagram?: string;
  angleBeamDiagram?: string;           // Angle beam calibration block diagram
  e2375Diagram?: string;               // ASTM E2375 scan directions diagram
  scanDirectionsDrawing?: string;
  reportMode?: "Technique" | "Report"; // Which mode we're exporting from
  onExport?: (format: "pdf" | "word", template: ExportTemplate) => void;
}

export const UnifiedExportDialog: React.FC<UnifiedExportDialogProps> = ({
  open,
  onOpenChange,
  standard,
  inspectionSetup,
  equipment,
  calibration,
  scanParameters,
  acceptanceCriteria,
  documentation,
  inspectionReport,
  scanDetails,
  scanPlan,
  capturedDrawing,
  calibrationBlockDiagram,
  angleBeamDiagram,
  e2375Diagram,
  scanDirectionsDrawing,
  reportMode = "Technique",
  onExport,
}) => {
  // Determine if we're exporting an inspection report
  const isReportMode = reportMode === "Report" && inspectionReport;
  const [isExporting, setIsExporting] = useState(false);
  const [exportFormat, setExportFormat] = useState<"pdf" | "word" | "csi">("pdf");
  const [companyName, setCompanyName] = useState("");
  const [companyLogo, setCompanyLogo] = useState<string | null>(null);
  const [logoFileName, setLogoFileName] = useState<string | null>(null);
  const [showLogoOnEveryPage, setShowLogoOnEveryPage] = useState(true);
  const [showComplianceDialog, setShowComplianceDialog] = useState(false);

  // Build compliance check data from props
  const complianceData: ComplianceCheckData = useMemo(() => ({
    standard,
    inspectionSetup: {
      partNumber: inspectionSetup.partNumber || "",
      partName: inspectionSetup.partName || "",
      material: inspectionSetup.material || "",
      materialSpec: inspectionSetup.materialSpec || "",
      partType: inspectionSetup.partType || "",
      partThickness: inspectionSetup.partThickness || 0,
      partLength: inspectionSetup.partLength || 0,
      partWidth: inspectionSetup.partWidth || 0,
      diameter: inspectionSetup.diameter,
      isHollow: inspectionSetup.isHollow,
      innerDiameter: inspectionSetup.innerDiameter,
      wallThickness: inspectionSetup.wallThickness,
      acousticVelocity: inspectionSetup.acousticVelocity,
    },
    equipment: {
      manufacturer: equipment.manufacturer || "",
      model: equipment.model || "",
      serialNumber: equipment.serialNumber || "",
      frequency: equipment.frequency || "",
      transducerType: equipment.transducerType || "",
      transducerDiameter: equipment.transducerDiameter || 0,
      couplant: equipment.couplant || "",
      verticalLinearity: equipment.verticalLinearity || 0,
      horizontalLinearity: equipment.horizontalLinearity || 0,
    },
    calibration: {
      standardType: calibration.standardType || "",
      referenceMaterial: calibration.referenceMaterial || "",
      fbhSizes: calibration.fbhSizes || "",
      metalTravelDistance: calibration.metalTravelDistance || 0,
      blockSerialNumber: calibration.blockSerialNumber || "",
      lastCalibrationDate: calibration.lastCalibrationDate || "",
    },
    scanParameters: {
      scanMethod: scanParameters.scanMethod || "",
      scanType: scanParameters.scanType || "",
      scanSpeed: scanParameters.scanSpeed || 0,
      scanIndex: scanParameters.scanIndex || 0,
      coverage: scanParameters.coverage || 0,
      waterPath: scanParameters.waterPath,
      pulseRepetitionRate: scanParameters.pulseRepetitionRate || 0,
      gainSettings: scanParameters.gainSettings || "",
      alarmGateSettings: scanParameters.alarmGateSettings || "",
      technique: scanParameters.technique,
    },
    acceptanceCriteria: {
      acceptanceClass: acceptanceCriteria.acceptanceClass || "",
      singleDiscontinuity: acceptanceCriteria.singleDiscontinuity || "",
      multipleDiscontinuities: acceptanceCriteria.multipleDiscontinuities || "",
      linearDiscontinuity: acceptanceCriteria.linearDiscontinuity || "",
      backReflectionLoss: acceptanceCriteria.backReflectionLoss || 0,
      noiseLevel: acceptanceCriteria.noiseLevel || "",
    },
    documentation: {
      inspectorName: documentation.inspectorName || "",
      inspectorCertification: documentation.inspectorCertification || "",
      inspectorLevel: documentation.inspectorLevel || "",
      certifyingOrganization: documentation.certifyingOrganization || "",
      inspectionDate: documentation.inspectionDate || "",
      procedureNumber: documentation.procedureNumber || "",
      drawingReference: documentation.drawingReference || "",
    },
  }), [standard, inspectionSetup, equipment, calibration, scanParameters, acceptanceCriteria, documentation]);

  // Run compliance check
  const complianceReport = useMemo(() => runComplianceCheck(complianceData), [complianceData]);

  useEffect(() => {
    if (isReportMode && exportFormat === "word") {
      setExportFormat("pdf");
    }
  }, [isReportMode, exportFormat]);

  // Handle logo file upload
  const handleLogoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        alert('Please upload an image file (PNG, JPG, etc.)');
        return;
      }
      // Validate file size (max 2MB)
      if (file.size > 2 * 1024 * 1024) {
        alert('Logo file must be smaller than 2MB');
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        setCompanyLogo(e.target?.result as string);
        setLogoFileName(file.name);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeLogo = () => {
    setCompanyLogo(null);
    setLogoFileName(null);
  };

  // Calculate readiness with detailed breakdown
  const readinessData = useMemo(() => {
    const sections = [
      {
        name: "Part Information",
        fields: [
          { name: "Part Number", value: inspectionSetup.partNumber },
          { name: "Part Name", value: inspectionSetup.partName },
          { name: "Material", value: inspectionSetup.material },
          { name: "Part Type", value: inspectionSetup.partType },
        ]
      },
      {
        name: "Equipment",
        fields: [
          { name: "Manufacturer", value: equipment.manufacturer },
          { name: "Model", value: equipment.model },
          { name: "Frequency", value: equipment.frequency },
        ]
      },
      {
        name: "Calibration",
        fields: [
          { name: "Standard Type", value: calibration.standardType },
          { name: "Reference Material", value: calibration.referenceMaterial },
        ]
      },
      {
        name: "Acceptance",
        fields: [
          { name: "Acceptance Class", value: acceptanceCriteria.acceptanceClass },
        ]
      },
      {
        name: "Documentation",
        fields: [
          { name: "Inspector Name", value: documentation.inspectorName },
          { name: "Inspector Level", value: documentation.inspectorLevel },
        ]
      },
    ];

    let totalFilled = 0;
    let totalFields = 0;

    sections.forEach(section => {
      section.fields.forEach(field => {
        totalFields++;
        if (field.value && field.value !== "") totalFilled++;
      });
    });

    return {
      sections,
      percentage: Math.round((totalFilled / totalFields) * 100),
      filled: totalFilled,
      total: totalFields,
    };
  }, [inspectionSetup, equipment, calibration, acceptanceCriteria, documentation]);

  // Preview PDF in new tab (for faster iteration while designing)
  const handlePreview = () => {
    exportTechniqueSheetPDF({
      standard,
      inspectionSetup,
      equipment,
      calibration,
      scanParameters,
      acceptanceCriteria,
      documentation,
      scanDetails,
      scanPlan,
      capturedDrawing,
      calibrationBlockDiagram,
      angleBeamDiagram,
      e2375Diagram,
      scanDirectionsDrawing,
    }, {
      companyName: companyName || undefined,
      companyLogo: companyLogo || undefined,
      showLogoOnEveryPage,
      previewInNewTab: true,
    });
  };

  const handleExport = async (format: "pdf" | "word" | "csi") => {
    setIsExporting(true);
    setExportFormat(format);

    try {
      await new Promise(r => setTimeout(r, 400));

      // CSI Export for ScanMaster integration
      if (format === "csi") {
        const csiData: CSIExportData = {
          standard,
          inspectionSetup,
          equipment,
          calibration,
          scanParameters,
          acceptanceCriteria,
          documentation,
          oemVendor: inspectionSetup.oemVendor,
        };
        await exportToCSI(csiData, {
          format: 'csi',
          template: 'standard',
          csiVersion: '1.0',
          includeComments: true,
        });
      } else if (format === "pdf") {
        // Use appropriate exporter based on mode
        if (isReportMode && inspectionReport) {
          // Export Inspection Report (TÜV/Metalscan style)
          exportInspectionReportPDF(inspectionReport, {
            companyName: companyName || undefined,
            companyLogo: companyLogo || undefined,
            showLogoOnEveryPage,
            includeAerospaceSection: true,
          });
        } else {
          // Export Technique Sheet
          exportTechniqueSheetPDF({
            standard,
            inspectionSetup,
            equipment,
            calibration,
            scanParameters,
            acceptanceCriteria,
            documentation,
            scanDetails,
            scanPlan,
            capturedDrawing,
            calibrationBlockDiagram,
            angleBeamDiagram,
            e2375Diagram,
            scanDirectionsDrawing,
          }, {
            companyName: companyName || undefined,
            companyLogo: companyLogo || undefined,
            showLogoOnEveryPage,
          });
        }
      } else {
        // Word export (technique sheet only for now)
        await exportTechniqueSheetWord({
          standard,
          inspectionSetup,
          equipment,
          calibration,
          scanParameters,
          acceptanceCriteria,
          documentation,
          scanDetails,
          scanPlan,
          capturedDrawing,
          calibrationBlockDiagram,
          angleBeamDiagram,
          e2375Diagram,
          scanDirectionsDrawing,
        }, {
          companyName: companyName || undefined,
          companyLogo: companyLogo || undefined,
          showLogoOnEveryPage,
        });
      }

      onExport?.(format, "custom");

      setTimeout(() => {
        onOpenChange(false);
      }, 500);

    } catch (error) {
      console.error("Export error:", error);
    } finally {
      setTimeout(() => {
        setIsExporting(false);
      }, 600);
    }
  };

  const getStatusColor = (percentage: number) => {
    if (percentage >= 80) return "text-emerald-600";
    if (percentage >= 50) return "text-amber-500";
    return "text-red-500";
  };

  const getStatusBg = (percentage: number) => {
    if (percentage >= 80) return "bg-emerald-500";
    if (percentage >= 50) return "bg-amber-500";
    return "bg-red-500";
  };

  const selectedSectionCount = readinessData.sections.filter((section) =>
    section.fields.every((field) => field.value && field.value !== "")
  ).length;

  const exportOptions: Array<{
    id: "pdf" | "word" | "csi";
    label: string;
    subtitle: string;
    helper: string;
    icon: typeof FileText;
    iconClassName: string;
    accentClassName: string;
    borderClassName: string;
    disabled?: boolean;
    disabledReason?: string;
  }> = [
    {
      id: "pdf",
      label: "PDF",
      subtitle: isReportMode ? "Inspection report layout" : "Controlled release document",
      helper: isReportMode ? "Best for signed reports and print release" : "Best for formal approval and archive",
      icon: FileText,
      iconClassName: "bg-red-500/15 text-red-300 ring-1 ring-red-400/20",
      accentClassName: "from-red-500/90 to-orange-400/80",
      borderClassName: "border-red-400/30",
    },
    {
      id: "word",
      label: "Word",
      subtitle: "Editable technique sheet",
      helper: isReportMode ? "Word export is available for technique sheets only" : "Best for internal review and markup",
      icon: FileIcon,
      iconClassName: "bg-blue-500/15 text-blue-300 ring-1 ring-blue-400/20",
      accentClassName: "from-blue-500/90 to-cyan-400/80",
      borderClassName: "border-blue-400/30",
      disabled: Boolean(isReportMode),
      disabledReason: isReportMode ? "Technique mode only" : undefined,
    },
    {
      id: "csi",
      label: "CSI",
      subtitle: "ScanMaster structured package",
      helper: "Best for downstream system integration",
      icon: Cpu,
      iconClassName: "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-400/20",
      accentClassName: "from-emerald-500/90 to-teal-400/80",
      borderClassName: "border-emerald-400/30",
    },
  ];

  const activeExportOption = exportOptions.find((option) => option.id === exportFormat) ?? exportOptions[0];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex max-w-4xl max-h-[calc(100dvh-1rem)] flex-col gap-0 overflow-hidden border border-border/70 bg-[linear-gradient(180deg,rgba(10,14,22,0.98),rgba(12,18,28,0.98))] p-0 shadow-[0_32px_80px_rgba(0,0,0,0.45)] sm:max-h-[calc(100dvh-2rem)]"
        hideCloseButton
      >
        <DialogTitle className="sr-only">Export Document</DialogTitle>
        <DialogDescription className="sr-only">
          Configure export format, document branding, and compliance checks.
        </DialogDescription>
        {/* Header */}
        <div className="relative border-b border-white/8 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.24),transparent_42%),linear-gradient(135deg,rgba(12,19,31,0.98),rgba(10,14,22,0.98))] px-4 py-4 sm:px-6 sm:py-5">
          <button
            onClick={() => onOpenChange(false)}
            className="absolute right-4 top-4 rounded-full border border-white/10 bg-white/5 p-1.5 text-slate-400 transition-colors hover:bg-white/10 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center shadow-[0_18px_30px_rgba(37,99,235,0.35)]">
                <FileText className="w-6 h-6 text-white" />
              </div>
              <div>
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-blue-400/20 bg-blue-500/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-blue-200">
                    {isReportMode ? "Inspection Report" : "Technique Sheet"}
                  </span>
                  <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-medium text-slate-300">
                    {standard}
                  </span>
                </div>
                <h2 className="text-xl font-semibold text-white">Export Document</h2>
                <p className="text-sm text-slate-400">
                  Release a branded {isReportMode ? "inspection report" : "technique sheet"} package.
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5">
                <div className="text-[11px] uppercase tracking-[0.24em] text-slate-500">Readiness</div>
                <div className={cn("mt-1 text-2xl font-semibold", getStatusColor(readinessData.percentage))}>{readinessData.percentage}%</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5">
                <div className="text-[11px] uppercase tracking-[0.24em] text-slate-500">Selected</div>
                <div className="mt-1 text-2xl font-semibold text-white">{activeExportOption.label}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="min-h-0 flex-1 overflow-y-auto p-4 space-y-5 sm:p-6">

          {/* Compliance Status */}
          <button
            onClick={() => setShowComplianceDialog(true)}
            className={cn(
              "w-full flex items-center justify-between p-4 rounded-2xl border transition-all",
              complianceReport.status === "pass"
                ? "bg-emerald-500/10 border-emerald-400/20 hover:bg-emerald-500/12"
                : complianceReport.status === "warning"
                ? "bg-amber-500/10 border-amber-400/20 hover:bg-amber-500/12"
                : "bg-red-500/10 border-red-400/20 hover:bg-red-500/12"
            )}
          >
            <div className="flex items-center gap-3">
              {complianceReport.status === "pass" ? (
                <Shield className="w-5 h-5 text-emerald-300" />
              ) : complianceReport.status === "warning" ? (
                <AlertTriangle className="w-5 h-5 text-amber-300" />
              ) : (
                <Shield className="w-5 h-5 text-red-300" />
              )}
              <div className="text-left">
                <div className="font-medium text-sm text-white">
                  {complianceReport.status === "pass"
                    ? "Compliance Check Passed"
                    : complianceReport.status === "warning"
                    ? `${complianceReport.warnings.length} Warning(s)`
                    : `${complianceReport.criticalIssues.length} Critical Issue(s)`}
                </div>
                <div className="text-xs text-slate-400">
                  Click to view detailed compliance report
                </div>
              </div>
            </div>
            <div className={cn(
              "text-2xl font-bold",
              complianceReport.status === "pass" ? "text-emerald-300" :
              complianceReport.status === "warning" ? "text-amber-300" : "text-red-300"
            )}>
              {complianceReport.overallScore}%
            </div>
          </button>

          {/* Document Info */}
          <div className="flex items-center justify-between p-4 rounded-2xl border border-white/8 bg-white/[0.03]">
            <div className="flex items-center gap-3">
              <Sparkles className="w-5 h-5 text-blue-300" />
              <div>
                <div className="font-medium text-sm text-white">Professional Format</div>
                <div className="text-xs text-slate-400">A4 output with all mapped sections included</div>
              </div>
            </div>
            <div className={cn("text-2xl font-bold", getStatusColor(readinessData.percentage))}>
              {readinessData.percentage}%
            </div>
          </div>

          {/* Progress Bar */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-slate-400">Document completeness</span>
              <span className="font-medium text-slate-200">{readinessData.filled} / {readinessData.total} fields</span>
            </div>
            <div className="h-2 bg-white/8 rounded-full overflow-hidden">
              <div
                className={cn("h-full rounded-full transition-all duration-500", getStatusBg(readinessData.percentage))}
                style={{ width: `${readinessData.percentage}%` }}
              />
            </div>
          </div>

          {/* Sections Status */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
            {readinessData.sections.map((section) => {
              const sectionFilled = section.fields.filter(f => f.value && f.value !== "").length;
              const sectionTotal = section.fields.length;
              const isComplete = sectionFilled === sectionTotal;

              return (
                <div
                  key={section.name}
                  className={cn(
                    "text-center p-2 rounded-xl border transition-colors",
                    isComplete
                      ? "bg-emerald-500/10 border-emerald-400/20"
                      : "bg-white/[0.03] border-white/8"
                  )}
                >
                  {isComplete ? (
                    <CheckCircle2 className="w-4 h-4 mx-auto text-emerald-300 mb-1" />
                  ) : (
                    <FileWarning className="w-4 h-4 mx-auto text-slate-400 mb-1" />
                  )}
                  <div className="text-[10px] font-medium text-slate-200 truncate">
                    {section.name}
                  </div>
                  <div className="text-[9px] text-slate-500">
                    {sectionFilled}/{sectionTotal}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Export Format Selection */}
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-medium text-slate-100">Export Format</div>
              <div className="rounded-full border border-emerald-400/10 bg-emerald-500/10 px-3 py-1 text-[11px] font-medium text-emerald-200">
                Primary action exports {activeExportOption.label}
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {/* PDF Option */}
              <button
                onClick={() => !isExporting && setExportFormat("pdf")}
                disabled={isExporting}
                className={cn(
                  "relative flex flex-col items-center gap-2 p-4 rounded-2xl border transition-all",
                  exportFormat === "pdf"
                    ? "border-red-400/30 bg-red-500/10 ring-1 ring-red-400/20"
                    : "border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.05]"
                )}
              >
                {isExporting && exportFormat === "pdf" ? (
                  <Loader2 className="w-8 h-8 text-red-300 animate-spin" />
                ) : (
                  <div className="w-10 h-10 rounded-xl bg-red-500/15 text-red-300 flex items-center justify-center ring-1 ring-red-400/20">
                    <FileText className="w-5 h-5 text-white" />
                  </div>
                )}
                <div>
                  <div className="font-semibold text-sm text-white">PDF</div>
                  <div className="text-[10px] text-slate-400">Controlled release</div>
                </div>
              </button>

              {/* Word Option */}
              <button
                onClick={() => !isExporting && !isReportMode && setExportFormat("word")}
                disabled={isExporting || isReportMode}
                className={cn(
                  "relative flex flex-col items-center gap-2 p-4 rounded-2xl border transition-all",
                  isReportMode && "cursor-not-allowed opacity-50",
                  exportFormat === "word"
                    ? "border-blue-400/30 bg-blue-500/10 ring-1 ring-blue-400/20"
                    : "border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.05]"
                )}
              >
                {isExporting && exportFormat === "word" ? (
                  <Loader2 className="w-8 h-8 text-blue-300 animate-spin" />
                ) : (
                  <div className="w-10 h-10 rounded-xl bg-blue-500/15 text-blue-300 flex items-center justify-center ring-1 ring-blue-400/20">
                    <FileIcon className="w-5 h-5 text-white" />
                  </div>
                )}
                <div>
                  <div className="font-semibold text-sm text-white">Word</div>
                  <div className="text-[10px] text-slate-400">
                    {isReportMode ? "Technique only" : "Editable sheet"}
                  </div>
                </div>
              </button>

              {/* CSI Option - ScanMaster Integration */}
              <button
                onClick={() => !isExporting && setExportFormat("csi")}
                disabled={isExporting}
                className={cn(
                  "relative flex flex-col items-center gap-2 p-4 rounded-2xl border transition-all",
                  exportFormat === "csi"
                    ? "border-emerald-400/30 bg-emerald-500/10 ring-1 ring-emerald-400/20"
                    : "border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.05]"
                )}
              >
                {isExporting && exportFormat === "csi" ? (
                  <Loader2 className="w-8 h-8 text-emerald-300 animate-spin" />
                ) : (
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/15 text-emerald-300 flex items-center justify-center ring-1 ring-emerald-400/20">
                    <Cpu className="w-5 h-5 text-white" />
                  </div>
                )}
                <div>
                  <div className="font-semibold text-sm text-white">CSI</div>
                  <div className="text-[10px] text-slate-400">System package</div>
                </div>
              </button>
            </div>

            {/* Preview Button */}
            {!isReportMode ? (
              <button
                onClick={handlePreview}
                disabled={isExporting}
                className="w-full flex items-center justify-center gap-2 p-3 mt-2 rounded-2xl border border-white/10 bg-white/[0.03] text-slate-300 hover:bg-white/[0.05] hover:text-white transition-colors"
              >
                <Eye className="w-4 h-4" />
                <span className="text-sm">Preview PDF in New Tab</span>
              </button>
            ) : (
              <div className="rounded-2xl border border-white/8 bg-black/10 px-4 py-3 text-sm text-slate-400">
                Live preview is currently available for technique sheet PDF only.
              </div>
            )}
          </div>

          {/* Company Logo Upload */}
          <div className="space-y-3">
            <div className="space-y-3 rounded-[24px] border border-white/8 bg-white/[0.03] p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-500/12 text-blue-200">
                  <Building2 className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-sm font-medium text-slate-100">Branding</div>
                  <div className="text-xs text-slate-400">Company name and logo for exported pages</div>
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="company-name" className="text-xs font-medium uppercase tracking-[0.2em] text-slate-500">
                  Company Name
                </label>
                <Input
                  id="company-name"
                  value={companyName}
                  onChange={(event) => setCompanyName(event.target.value)}
                  placeholder="ScanMaster NDT Lab"
                  className="h-11 rounded-2xl border-white/10 bg-black/15 text-slate-100 placeholder:text-slate-500"
                />
              </div>

              <div className="text-sm font-medium text-slate-100">Company Logo</div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              {companyLogo ? (
                <div className="flex flex-1 flex-col gap-3 rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-3 sm:flex-row sm:items-center">
                  <img src={companyLogo} alt="Logo" className="h-10 w-10 object-contain rounded" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-emerald-100 truncate">
                      {logoFileName || "Logo uploaded"}
                    </div>
                    <div className="text-xs text-emerald-200/80">
                      {showLogoOnEveryPage ? "Applied to all pages" : "Stored but hidden from output"}
                    </div>
                  </div>
                  <button
                    onClick={removeLogo}
                    className="rounded-xl border border-red-400/20 bg-red-500/10 p-2 text-red-200 transition-colors hover:bg-red-500/15"
                    title="Remove logo"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <label className="flex-1 flex items-center justify-center gap-2 p-4 rounded-2xl border border-dashed border-white/12 bg-black/10 cursor-pointer hover:border-blue-400/30 hover:bg-blue-500/6 transition-colors">
                  <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
                  <Upload className="w-5 h-5 text-slate-400" />
                  <span className="text-sm text-slate-300">Click to upload company logo</span>
                </label>
              )}
            </div>
            {companyLogo && (
              <div className="flex items-center justify-between rounded-2xl border border-white/8 bg-black/10 px-4 py-3">
                <label htmlFor="logo-toggle" className="text-xs text-slate-400 cursor-pointer">
                  Show logo on every page
                </label>
                <Switch
                  id="logo-toggle"
                  checked={showLogoOnEveryPage}
                  onCheckedChange={setShowLogoOnEveryPage}
                />
              </div>
            )}
            </div>
          </div>

          {/* Info for low completion - but export still works */}
          {readinessData.percentage < 50 && (
            <div className="flex items-start gap-3 p-4 rounded-2xl border border-blue-400/15 bg-blue-500/10">
              <Sparkles className="w-5 h-5 text-blue-200 flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <div className="font-medium text-blue-100">Partial data, export still allowed</div>
                <div className="text-xs text-blue-200/80 mt-0.5">
                  Empty fields will show "-" in the exported document. You can fill in more details later.
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-white/8 bg-black/15 px-4 py-4 sm:px-6">
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
            <button
              onClick={() => onOpenChange(false)}
              disabled={isExporting}
              className="w-full rounded-2xl border border-white/10 px-4 py-3 text-sm font-medium text-slate-300 transition-colors hover:bg-white/[0.05] hover:text-white sm:w-auto"
            >
              Cancel
            </button>

            <Button
              size="lg"
              onClick={() => handleExport(exportFormat)}
              disabled={isExporting || activeExportOption.disabled}
              className={cn(
                "w-full justify-center rounded-2xl px-6 font-semibold sm:w-auto",
                "bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600",
                "shadow-[0_18px_30px_rgba(37,99,235,0.25)]"
              )}
            >
              {isExporting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Exporting {activeExportOption.label}...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4 mr-2" />
                  Export {activeExportOption.label}
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>

      {/* Compliance Checker Dialog */}
      <ComplianceCheckerDialog
        open={showComplianceDialog}
        onOpenChange={setShowComplianceDialog}
        data={complianceData}
        onExport={() => {
          setShowComplianceDialog(false);
          handleExport("pdf");
        }}
      />
    </Dialog>
  );
};

export default UnifiedExportDialog;
