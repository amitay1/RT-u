// @ts-nocheck
/**
 * Compliance Checker Dialog
 *
 * UI component for running and displaying compliance check results.
 * Integrates with the export flow to prevent export of non-compliant sheets.
 */

import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Info,
  Shield,
  FileCheck,
  RefreshCw,
  ChevronRight,
} from "lucide-react";

import { runComplianceCheck, type ComplianceCheckData } from "@/utils/complianceChecker";
import type { ComplianceReport, ComplianceResult, ComplianceCategory } from "@/types/compliance";
import type { StandardType } from "@/types/techniqueSheet";

// ============================================================================
// TYPES
// ============================================================================

interface ComplianceCheckerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: ComplianceCheckData;
  onExport?: () => void;
}

// ============================================================================
// HELPER COMPONENTS
// ============================================================================

const CategoryIcon = ({ category }: { category: ComplianceCategory }) => {
  const icons: Record<ComplianceCategory, React.ReactNode> = {
    setup: <FileCheck className="h-4 w-4" />,
    equipment: <Shield className="h-4 w-4" />,
    calibration: <RefreshCw className="h-4 w-4" />,
    scan: <ChevronRight className="h-4 w-4" />,
    acceptance: <CheckCircle2 className="h-4 w-4" />,
    documentation: <Info className="h-4 w-4" />,
    standard: <Shield className="h-4 w-4" />,
  };
  return icons[category] || <Info className="h-4 w-4" />;
};

const SeverityBadge = ({ severity }: { severity: string }) => {
  const variants: Record<string, { className: string; label: string }> = {
    critical: { className: "bg-red-500/20 text-red-400 border-red-500/30", label: "Critical" },
    warning: { className: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30", label: "Warning" },
    info: { className: "bg-blue-500/20 text-blue-400 border-blue-500/30", label: "Info" },
  };
  const config = variants[severity] || variants.info;
  return (
    <Badge variant="outline" className={config.className}>
      {config.label}
    </Badge>
  );
};

const StatusIcon = ({ passed }: { passed: boolean }) => {
  return passed ? (
    <CheckCircle2 className="h-4 w-4 text-green-500" />
  ) : (
    <XCircle className="h-4 w-4 text-red-500" />
  );
};

const ResultItem = ({ result }: { result: ComplianceResult }) => {
  return (
    <div className={`p-3 rounded-lg border ${result.passed ? "bg-green-500/5 border-green-500/20" : "bg-red-500/5 border-red-500/20"}`}>
      <div className="flex items-start gap-3">
        <StatusIcon passed={result.passed} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sm">{result.ruleName}</span>
            <SeverityBadge severity={result.severity} />
          </div>
          <p className="text-sm text-muted-foreground mt-1">{result.message}</p>
          {!result.passed && result.suggestion && (
            <div className="mt-2 p-2 bg-muted/50 rounded text-xs">
              <span className="font-medium">Suggestion: </span>
              {result.suggestion}
            </div>
          )}
          {result.field && (
            <div className="mt-1 text-xs text-muted-foreground">
              Field: <code className="bg-muted px-1 rounded">{result.field}</code>
            </div>
          )}
          {result.standardRef && (
            <div className="mt-1 text-xs text-muted-foreground">
              Reference: {result.standardRef}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function ComplianceCheckerDialog({
  open,
  onOpenChange,
  data,
  onExport,
}: ComplianceCheckerDialogProps) {
  const [isChecking, setIsChecking] = useState(false);
  const [report, setReport] = useState<ComplianceReport | null>(null);

  // Run compliance check when dialog opens.
  useEffect(() => {
    if (!open || report) return;

    setIsChecking(true);
    const timeoutId = window.setTimeout(() => {
      const result = runComplianceCheck(data);
      setReport(result);
      setIsChecking(false);
    }, 500);

    return () => window.clearTimeout(timeoutId);
  }, [data, open, report]);

  // Reset when closing
  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setReport(null);
      setIsChecking(false);
    }
    onOpenChange(newOpen);
  };

  // Group results by category
  const groupedIssues = useMemo(() => {
    if (!report) return {};

    const allIssues = [...report.criticalIssues, ...report.warnings, ...report.info];
    return allIssues.reduce((acc, issue) => {
      const cat = issue.category;
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(issue);
      return acc;
    }, {} as Record<ComplianceCategory, ComplianceResult[]>);
  }, [report]);

  const categoryLabels: Record<ComplianceCategory, string> = {
    setup: "Part Setup",
    equipment: "Equipment",
    calibration: "Calibration",
    scan: "Scan Parameters",
    acceptance: "Acceptance Criteria",
    documentation: "Documentation",
    standard: "Standard-Specific",
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            Compliance Check
          </DialogTitle>
          <DialogDescription>
            Validating technique sheet against {data.standard} requirements
          </DialogDescription>
        </DialogHeader>

        {isChecking ? (
          <div className="flex flex-col items-center justify-center py-12">
            <RefreshCw className="h-8 w-8 animate-spin text-primary mb-4" />
            <p className="text-muted-foreground">Running compliance checks...</p>
          </div>
        ) : report ? (
          <div className="flex-1 overflow-hidden flex flex-col gap-4">
            {/* Score Header */}
            <div className={`p-4 rounded-lg border ${
              report.status === "pass" ? "bg-green-500/10 border-green-500/30" :
              report.status === "warning" ? "bg-yellow-500/10 border-yellow-500/30" :
              "bg-red-500/10 border-red-500/30"
            }`}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  {report.status === "pass" ? (
                    <CheckCircle2 className="h-8 w-8 text-green-500" />
                  ) : report.status === "warning" ? (
                    <AlertTriangle className="h-8 w-8 text-yellow-500" />
                  ) : (
                    <XCircle className="h-8 w-8 text-red-500" />
                  )}
                  <div>
                    <h3 className="font-semibold text-lg">
                      {report.status === "pass" ? "All Checks Passed" :
                       report.status === "warning" ? "Passed with Warnings" :
                       "Critical Issues Found"}
                    </h3>
                    <p className="text-sm text-muted-foreground">{report.summary}</p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-3xl font-bold">{report.overallScore}</div>
                  <div className="text-xs text-muted-foreground">Score</div>
                </div>
              </div>
              <Progress
                value={report.overallScore}
                className={`h-2 ${
                  report.status === "pass" ? "[&>div]:bg-green-500" :
                  report.status === "warning" ? "[&>div]:bg-yellow-500" :
                  "[&>div]:bg-red-500"
                }`}
              />
              <div className="flex gap-4 mt-3 text-sm">
                <span className="text-green-500">
                  {report.passedRules} passed
                </span>
                {report.criticalIssues.length > 0 && (
                  <span className="text-red-500">
                    {report.criticalIssues.length} critical
                  </span>
                )}
                {report.warnings.length > 0 && (
                  <span className="text-yellow-500">
                    {report.warnings.length} warnings
                  </span>
                )}
                {report.info.length > 0 && (
                  <span className="text-blue-500">
                    {report.info.length} info
                  </span>
                )}
              </div>
            </div>

            {/* Issues by Category */}
            {Object.keys(groupedIssues).length > 0 && (
              <ScrollArea className="flex-1">
                <Accordion type="multiple" className="w-full" defaultValue={["critical"]}>
                  {/* Critical Issues First */}
                  {report.criticalIssues.length > 0 && (
                    <AccordionItem value="critical">
                      <AccordionTrigger className="text-red-500 hover:no-underline">
                        <div className="flex items-center gap-2">
                          <XCircle className="h-4 w-4" />
                          Critical Issues ({report.criticalIssues.length})
                        </div>
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="space-y-2">
                          {report.criticalIssues.map((issue, idx) => (
                            <ResultItem key={`critical-${idx}`} result={issue} />
                          ))}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  )}

                  {/* Warnings */}
                  {report.warnings.length > 0 && (
                    <AccordionItem value="warnings">
                      <AccordionTrigger className="text-yellow-500 hover:no-underline">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4" />
                          Warnings ({report.warnings.length})
                        </div>
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="space-y-2">
                          {report.warnings.map((issue, idx) => (
                            <ResultItem key={`warning-${idx}`} result={issue} />
                          ))}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  )}

                  {/* Info */}
                  {report.info.length > 0 && (
                    <AccordionItem value="info">
                      <AccordionTrigger className="text-blue-500 hover:no-underline">
                        <div className="flex items-center gap-2">
                          <Info className="h-4 w-4" />
                          Suggestions ({report.info.length})
                        </div>
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="space-y-2">
                          {report.info.map((issue, idx) => (
                            <ResultItem key={`info-${idx}`} result={issue} />
                          ))}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  )}
                </Accordion>
              </ScrollArea>
            )}

            {/* All Passed Message */}
            {Object.keys(groupedIssues).length === 0 && (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <CheckCircle2 className="h-16 w-16 text-green-500 mb-4" />
                <h3 className="font-semibold text-lg">Excellent!</h3>
                <p className="text-muted-foreground">
                  All compliance checks passed. Your technique sheet is ready for export.
                </p>
              </div>
            )}
          </div>
        ) : null}

        <DialogFooter className="flex gap-2 sm:gap-2">
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Close
          </Button>
          <Button
            variant="outline"
            onClick={handleRunCheck}
            disabled={isChecking}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isChecking ? "animate-spin" : ""}`} />
            Re-check
          </Button>
          {report?.canExport && onExport && (
            <Button onClick={onExport}>
              <FileCheck className="h-4 w-4 mr-2" />
              Proceed to Export
            </Button>
          )}
          {report && !report.canExport && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button disabled className="opacity-50">
                    <XCircle className="h-4 w-4 mr-2" />
                    Cannot Export
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Resolve critical issues before exporting</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// COMPACT BADGE COMPONENT (for header integration)
// ============================================================================

interface ComplianceBadgeProps {
  data: ComplianceCheckData;
  onClick?: () => void;
}

export function ComplianceBadge({ data, onClick }: ComplianceBadgeProps) {
  const report = useMemo(() => runComplianceCheck(data), [data]);

  const statusConfig = {
    pass: { color: "bg-green-500", icon: CheckCircle2, label: "Compliant" },
    warning: { color: "bg-yellow-500", icon: AlertTriangle, label: "Warnings" },
    fail: { color: "bg-red-500", icon: XCircle, label: "Issues" },
  };

  const config = statusConfig[report.status];
  const Icon = config.icon;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 gap-2"
            onClick={onClick}
          >
            <Icon className={`h-4 w-4 ${
              report.status === "pass" ? "text-green-500" :
              report.status === "warning" ? "text-yellow-500" :
              "text-red-500"
            }`} />
            <span className="text-xs font-medium">{report.overallScore}%</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>{config.label}: {report.summary}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export default ComplianceCheckerDialog;
