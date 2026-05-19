// @ts-nocheck
/**
 * Review and Generate Step
 */

import React, { useMemo } from "react";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  CheckCircle2,
  AlertCircle,
  FileText,
  Settings,
  Target,
  ClipboardList,
  Users,
  Wrench,
} from "lucide-react";
import type { ProcedureWizardData } from "@/types/procedure";
import { generateProcedure, validateWizardData } from "@/utils/procedureGenerator";

interface ReviewStepProps {
  data: ProcedureWizardData;
  onGenerate: (format: "text" | "html") => void;
  onDownload: (format: "text" | "html") => void;
  isGenerating: boolean;
  previewContent: string | null;
}

interface SectionSummary {
  icon: React.ElementType;
  title: string;
  items: { label: string; value: string | string[] | undefined }[];
  validation: { valid: boolean; errors: string[] };
}

const STANDARD_LABELS: Record<string, string> = {
  "AMS-STD-2154E": "AMS-STD-2154E",
  "ASTM-A388": "ASTM A388",
  "ASTM-E1001": "ASTM E1001",
  "ASTM-E2580": "ASTM E2580",
  "ASTM-E588": "ASTM E588",
  "AMS-2630": "AMS 2630E",
  "BS-EN-10228-3": "BS EN 10228-3",
  "BS-EN-10228-4": "BS EN 10228-4",
  "MIL-STD-2154": "MIL-STD-2154",
  "ams-std-2154e": "AMS-STD-2154E",
  "astm-a388": "ASTM A388",
  "astm-e1001": "ASTM E1001",
  "astm-e2580": "ASTM E2580",
  "astm-e588": "ASTM E588",
  "ams-2630": "AMS 2630E",
  "bs-en-10228": "BS EN 10228-3/4",
};

export function ReviewStep({
  data,
  onGenerate,
  onDownload,
  isGenerating,
  previewContent
}: ReviewStepProps) {
  const sections: SectionSummary[] = useMemo(() => [
    {
      icon: FileText,
      title: "Standard & Scope",
      items: [
        { label: "Primary Standard", value: data.primaryStandard ? STANDARD_LABELS[data.primaryStandard] : undefined },
        { label: "Procedure Title", value: data.procedureTitle },
        { label: "Part Categories", value: data.partCategories?.join(", ") },
        { label: "Material Types", value: data.materialTypes?.join(", ") },
      ],
      validation: validateWizardData(data, "standard"),
    },
    {
      icon: Wrench,
      title: "Equipment Requirements",
      items: [
        { label: "Frequency Range", value: data.frequencyMin && data.frequencyMax
          ? `${data.frequencyMin} - ${data.frequencyMax} MHz` : undefined },
        { label: "Transducer Types", value: data.transducerTypes },
        { label: "Couplant Types", value: data.couplantTypes },
      ],
      validation: validateWizardData(data, "equipment"),
    },
    {
      icon: Target,
      title: "Calibration Requirements",
      items: [
        { label: "Block Types", value: data.calibrationBlockTypes?.map(t =>
          t.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())).join(", ") },
        { label: "FBH Sizes", value: data.fbhSizes },
        { label: "Sensitivity Method", value: data.sensitivityMethod?.toUpperCase() },
        { label: "Calibration Interval", value: data.calibrationInterval?.replace(/_/g, " ") },
      ],
      validation: validateWizardData(data, "calibration"),
    },
    {
      icon: Settings,
      title: "Scan Parameters",
      items: [
        { label: "Inspection Method", value: data.inspectionMethod?.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase()) },
        { label: "Scan Type", value: data.scanType?.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase()) },
        { label: "Beam Types", value: data.beamTypes?.map(t =>
          t.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())).join(", ") },
        { label: "Coverage", value: data.minimumCoverage ? `${data.minimumCoverage}%` : undefined },
      ],
      validation: validateWizardData(data, "scan"),
    },
    {
      icon: ClipboardList,
      title: "Acceptance Criteria",
      items: [
        { label: "Acceptance Classes", value: data.acceptanceClasses },
        { label: "Evaluation Method", value: data.evaluationMethod?.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase()) },
        { label: "Rejection Level", value: data.rejectionLevel },
        { label: "Recording Level", value: data.recordingLevel },
      ],
      validation: validateWizardData(data, "acceptance"),
    },
    {
      icon: Users,
      title: "Documentation Requirements",
      items: [
        { label: "Personnel Levels", value: data.personnelLevels?.map(l =>
          l.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())).join(", ") },
        { label: "Certification Scheme", value: data.certificationScheme?.toUpperCase() },
        { label: "Retention Period", value: data.retentionPeriod?.replace(/_/g, " ") },
        { label: "Required Records", value: data.requiredRecords },
      ],
      validation: validateWizardData(data, "documentation"),
    },
  ], [data]);

  const allValid = sections.every(s => s.validation.valid);
  const totalErrors = sections.reduce((sum, s) => sum + s.validation.errors.length, 0);

  // Generate preview
  const generatedProcedure = useMemo(() => {
    if (!allValid) return null;
    try {
      return generateProcedure(data, {
        generatedBy: "Scan-Master",
        generatedDate: new Date().toISOString(),
      });
    } catch {
      return null;
    }
  }, [data, allValid]);

  return (
    <div className="space-y-6">
      {/* Validation Summary */}
      <div className={`p-4 rounded-lg border ${allValid
        ? "bg-green-500/10 border-green-500/30"
        : "bg-yellow-500/10 border-yellow-500/30"}`}>
        <div className="flex items-center gap-2">
          {allValid ? (
            <>
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              <span className="font-medium text-green-800 dark:text-green-200">
                Ready to Generate
              </span>
            </>
          ) : (
            <>
              <AlertCircle className="h-5 w-5 text-yellow-600" />
              <span className="font-medium text-yellow-800 dark:text-yellow-200">
                {totalErrors} issue{totalErrors !== 1 ? "s" : ""} to resolve
              </span>
            </>
          )}
        </div>
      </div>

      {/* Section Summaries */}
      <ScrollArea className="h-[400px] pr-4">
        <div className="space-y-4">
          {sections.map((section) => {
            const Icon = section.icon;
            const hasContent = section.items.some(item =>
              item.value && (Array.isArray(item.value) ? item.value.length > 0 : true)
            );

            return (
              <div key={section.title} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    <Label className="font-medium">{section.title}</Label>
                  </div>
                  {section.validation.valid ? (
                    <Badge variant="outline" className="text-green-600 border-green-600">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Complete
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-yellow-600 border-yellow-600">
                      <AlertCircle className="h-3 w-3 mr-1" />
                      {section.validation.errors.length} issue{section.validation.errors.length !== 1 ? "s" : ""}
                    </Badge>
                  )}
                </div>

                {hasContent ? (
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    {section.items.map((item) => {
                      if (!item.value || (Array.isArray(item.value) && item.value.length === 0)) {
                        return null;
                      }
                      return (
                        <div key={item.label}>
                          <span className="text-muted-foreground">{item.label}: </span>
                          <span className="font-medium">
                            {Array.isArray(item.value) ? item.value.join(", ") : item.value}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground italic">
                    No data entered for this section
                  </p>
                )}

                {!section.validation.valid && (
                  <div className="mt-2 pt-2 border-t">
                    <ul className="text-xs text-yellow-700 dark:text-yellow-300 space-y-1">
                      {section.validation.errors.map((error, i) => (
                        <li key={i}>• {error}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </ScrollArea>

      <Separator />

      {/* Generated Procedure Preview */}
      {generatedProcedure && (
        <div className="space-y-3">
          <Label>Generated Procedure Preview</Label>
          <div className="border rounded-lg p-4 bg-muted/50">
            <h3 className="font-semibold text-lg mb-2">{generatedProcedure.title}</h3>
            <p className="text-sm text-muted-foreground mb-4">
              {generatedProcedure.sections.length} sections generated
            </p>
            <div className="space-y-2">
              {generatedProcedure.sections.slice(0, 4).map((section, i) => (
                <div key={i} className="text-sm">
                  <span className="font-medium">{section.number}. {section.title}</span>
                  {section.subsections && (
                    <span className="text-muted-foreground ml-2">
                      ({section.subsections.length} subsections)
                    </span>
                  )}
                </div>
              ))}
              {generatedProcedure.sections.length > 4 && (
                <p className="text-sm text-muted-foreground">
                  ...and {generatedProcedure.sections.length - 4} more sections
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Generate / Download Actions */}
      {allValid && (
        <div className="space-y-3">
          <Label>Export Options</Label>
          <div className="flex items-center gap-3">
            <button
              onClick={() => onGenerate("html")}
              disabled={isGenerating}
              className="flex-1 px-4 py-2 rounded-lg border bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 text-sm font-medium"
            >
              {isGenerating ? "Generating..." : "Generate HTML"}
            </button>
            <button
              onClick={() => onGenerate("text")}
              disabled={isGenerating}
              className="flex-1 px-4 py-2 rounded-lg border hover:bg-muted text-sm font-medium"
            >
              Generate Text
            </button>
          </div>
          {previewContent && (
            <div className="flex items-center gap-3">
              <button
                onClick={() => onDownload("html")}
                className="flex-1 px-4 py-2 rounded-lg border hover:bg-muted text-sm font-medium"
              >
                Download HTML
              </button>
              <button
                onClick={() => onDownload("text")}
                className="flex-1 px-4 py-2 rounded-lg border hover:bg-muted text-sm font-medium"
              >
                Download Text
              </button>
            </div>
          )}
        </div>
      )}

      {/* Preview Content */}
      {previewContent && (
        <div className="space-y-3">
          <Label>Generated Content Preview</Label>
          <div className="border rounded-lg p-4 bg-muted/30 max-h-[200px] overflow-auto">
            <pre className="text-xs whitespace-pre-wrap font-mono">
              {previewContent.substring(0, 1000)}
              {previewContent.length > 1000 && "..."}
            </pre>
          </div>
        </div>
      )}

      {!allValid && (
        <p className="text-sm text-muted-foreground text-center">
          Please complete all required fields before generating the procedure document.
        </p>
      )}
    </div>
  );
}
