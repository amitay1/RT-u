import { AlertTriangle, CheckCircle2, CircleAlert, ListChecks } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { RtPtValidationIssue, RtPtValidationSummary } from "@/lib/rtPtValidation";
import type { RtPtDocumentStatus } from "@/types/rtPtDocument";

interface RtPtValidationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documentStatus: RtPtDocumentStatus;
  validation: RtPtValidationSummary;
  onSelectIssue: (issue: RtPtValidationIssue) => void;
}

interface RtPtControlledReleaseReadiness {
  isReady: boolean;
  heading: string;
  description: string;
}

const DOCUMENT_STATUS_LABELS: Record<RtPtDocumentStatus, string> = {
  draft: "Draft",
  "in-review": "In review",
  approved: "Approved",
  superseded: "Superseded",
};

// Kept pure and exported so release-gate semantics can be tested without rendering the dialog.
// eslint-disable-next-line react-refresh/only-export-components
export function getRtPtControlledReleaseReadiness(
  documentStatus: RtPtDocumentStatus,
  blockingIssueCount: number,
  approvalReady: boolean,
): RtPtControlledReleaseReadiness {
  const hasBlockingIssues = blockingIssueCount > 0;
  const checkSummary = hasBlockingIssues
    ? approvalReady
      ? "Resolve all blocking validation issues."
      : "Resolve all blocking validation issues and complete the approval-readiness checks."
    : approvalReady
      ? "Validation and approval-readiness checks are complete."
      : "Complete all approval-readiness checks.";

  if (documentStatus === "approved" && !hasBlockingIssues && approvalReady) {
    return {
      isReady: true,
      heading: "Ready for controlled release",
      description: "The document status is Approved, there are no blocking validation issues, and all approval-readiness checks are complete.",
    };
  }

  if (documentStatus === "draft") {
    return {
      isReady: false,
      heading: "Draft — controlled release unavailable",
      description: `${checkSummary} Controlled release also requires the document status to be Approved.`,
    };
  }

  if (documentStatus === "in-review") {
    return {
      isReady: false,
      heading: "In review — awaiting approval",
      description: `${checkSummary} Controlled release remains unavailable until the document status is Approved.`,
    };
  }

  if (documentStatus === "superseded") {
    return {
      isReady: false,
      heading: "Superseded — controlled release unavailable",
      description: "A superseded document cannot be treated as the current controlled release. Controlled release requires a current document with Approved status and complete release checks.",
    };
  }

  return {
    isReady: false,
    heading: "Approved — release checks incomplete",
    description: `Approved status alone is not sufficient. ${checkSummary}`,
  };
}

const TAB_LABELS: Record<string, string> = {
  general: "General",
  exposure: "Exposure defaults",
  equipment: "Source",
  source: "Source",
  film: "Film system",
  system: "Detector system",
  detector: "Detector performance",
  processing: "Image processing & storage",
  iqc: "Image quality",
  acceptance: "Acceptance",
  views: "Exposure views",
  acquisitions: "Acquisition plan",
  materials: "Materials",
  surface: "Surface preparation",
  application: "Application",
  development: "Development",
  conditions: "Inspection conditions",
  postcleaning: "Post-cleaning",
  control: "Control & approval",
};

export function RtPtValidationDialog({
  open,
  onOpenChange,
  documentStatus,
  validation,
  onSelectIssue,
}: RtPtValidationDialogProps) {
  const errors = validation.issues.filter((issue) => issue.severity === "error");
  const warnings = validation.issues.filter((issue) => issue.severity === "warning");
  const releaseReadiness = getRtPtControlledReleaseReadiness(
    documentStatus,
    errors.length,
    validation.approvalReadiness.isReady,
  );
  const statusLabel = DOCUMENT_STATUS_LABELS[documentStatus];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] flex-col overflow-hidden p-0 sm:max-w-3xl">
        <DialogHeader className="border-b border-border/75 px-5 pb-5 pt-6 sm:px-6">
          <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
            <ListChecks className="h-5 w-5" aria-hidden="true" />
          </div>
          <DialogTitle>Technique readiness</DialogTitle>
          <DialogDescription>
            Required planning fields and controlled-release checks for the current technique.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 border-b border-border/75 bg-muted/20 px-5 py-4 sm:grid-cols-2 sm:px-6 lg:grid-cols-4">
          <div className="rounded-lg border border-border/70 bg-card p-3">
            <div className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Required fields</div>
            <div className="mt-1 text-xl font-semibold tabular-nums">
              {validation.completedFieldsCount}/{validation.totalRequiredFields}
            </div>
            <Progress value={validation.completionPercent} className="mt-2 h-1.5" aria-label={`${validation.completionPercent}% of required fields complete`} />
          </div>
          <div className="rounded-lg border border-border/70 bg-card p-3">
            <div className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Blocking issues</div>
            <div className={`mt-1 text-xl font-semibold tabular-nums ${errors.length ? "text-destructive" : "text-success"}`}>{errors.length}</div>
            <div className="mt-1 text-xs text-muted-foreground">Must be resolved before release</div>
          </div>
          <div className="rounded-lg border border-border/70 bg-card p-3">
            <div className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Process warnings</div>
            <div className={`mt-1 text-xl font-semibold tabular-nums ${warnings.length ? "text-warning" : "text-success"}`}>{warnings.length}</div>
            <div className="mt-1 text-xs text-muted-foreground">Review before approval</div>
          </div>
          <div className="rounded-lg border border-border/70 bg-card p-3">
            <div className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Document status</div>
            <div className={`mt-1 text-xl font-semibold ${documentStatus === "approved" ? "text-success" : "text-warning"}`}>
              {statusLabel}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              {documentStatus === "approved" ? "Required release status" : "Controlled release requires Approved"}
            </div>
          </div>
        </div>

        <ScrollArea className="min-h-0 flex-1 px-5 py-5 sm:px-6">
          <div className="space-y-5">
            <section
              aria-labelledby="controlled-release-readiness-heading"
              aria-live="polite"
              className={`flex flex-col items-center rounded-xl px-6 py-8 text-center ${
                releaseReadiness.isReady
                  ? "border border-success/30 bg-success/10"
                  : errors.length > 0
                    ? "border border-destructive/30 bg-destructive/5"
                    : "border border-warning/35 bg-warning/5"
              }`}
            >
              {releaseReadiness.isReady ? (
                <CheckCircle2 className="h-10 w-10 text-success" aria-hidden="true" />
              ) : (
                <AlertTriangle className={`h-10 w-10 ${errors.length > 0 ? "text-destructive" : "text-warning"}`} aria-hidden="true" />
              )}
              <h3 id="controlled-release-readiness-heading" className="mt-4 text-lg font-semibold">
                {releaseReadiness.heading}
              </h3>
              <p className="mt-1 max-w-lg text-sm leading-6 text-muted-foreground">
                {releaseReadiness.description}
              </p>
            </section>

            {errors.length > 0 && (
              <section aria-labelledby="validation-errors-heading">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <h3 id="validation-errors-heading" className="flex items-center gap-2 text-sm font-semibold">
                    <CircleAlert className="h-4 w-4 text-destructive" aria-hidden="true" />
                    Required corrections
                  </h3>
                  <span className="rounded-full bg-destructive/10 px-2.5 py-1 text-xs font-semibold text-destructive">{errors.length}</span>
                </div>
                <div className="space-y-2">
                  {errors.map((issue, index) => (
                    <button
                      type="button"
                      key={`${issue.path}-${issue.scope ?? "draft"}-${index}`}
                      onClick={() => onSelectIssue(issue)}
                      className="group flex w-full items-start gap-3 rounded-lg border border-border/75 bg-card px-4 py-3 text-left transition-colors hover:border-destructive/35 hover:bg-destructive/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <span className="mt-0.5 grid h-6 w-6 flex-none place-items-center rounded-md bg-destructive/10 text-xs font-bold text-destructive">!</span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold text-foreground">{issue.label}</span>
                        <span className="mt-0.5 block text-sm leading-5 text-muted-foreground">{issue.message}</span>
                      </span>
                      <span className="flex-none rounded-md border border-border/70 bg-muted/40 px-2 py-1 text-xs font-medium text-muted-foreground group-hover:text-foreground">
                        {TAB_LABELS[issue.tab] ?? issue.tab}
                      </span>
                    </button>
                  ))}
                </div>
              </section>
            )}

            {warnings.length > 0 && (
              <section aria-labelledby="validation-warnings-heading">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <h3 id="validation-warnings-heading" className="flex items-center gap-2 text-sm font-semibold">
                    <AlertTriangle className="h-4 w-4 text-warning" aria-hidden="true" />
                    Process warnings
                  </h3>
                  <span className="rounded-full bg-warning/10 px-2.5 py-1 text-xs font-semibold text-warning">{warnings.length}</span>
                </div>
                <div className="space-y-2">
                  {warnings.map((issue, index) => (
                    <button
                      type="button"
                      key={`${issue.path}-${issue.scope ?? "warning"}-${index}`}
                      onClick={() => onSelectIssue(issue)}
                      className="group flex w-full items-start gap-3 rounded-lg border border-border/75 bg-card px-4 py-3 text-left transition-colors hover:border-warning/40 hover:bg-warning/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <AlertTriangle className="mt-0.5 h-5 w-5 flex-none text-warning" aria-hidden="true" />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold text-foreground">{issue.label}</span>
                        <span className="mt-0.5 block text-sm leading-5 text-muted-foreground">{issue.message}</span>
                      </span>
                      <span className="flex-none rounded-md border border-border/70 bg-muted/40 px-2 py-1 text-xs font-medium text-muted-foreground group-hover:text-foreground">
                        {TAB_LABELS[issue.tab] ?? issue.tab}
                      </span>
                    </button>
                  ))}
                </div>
              </section>
            )}
          </div>
        </ScrollArea>

        <DialogFooter className="border-t border-border/75 bg-muted/15 px-5 py-4 sm:px-6">
          {errors[0] && (
            <Button type="button" onClick={() => onSelectIssue(errors[0])}>
              Go to first correction
            </Button>
          )}
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
