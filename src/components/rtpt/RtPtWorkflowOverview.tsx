import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  ShieldAlert,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { RtPtWorkflowSnapshot } from '@/lib/rtPtWorkflow';

interface RtPtWorkflowOverviewProps {
  snapshot: RtPtWorkflowSnapshot;
  onSelectTab: (tab: string) => void;
}

export function RtPtWorkflowOverview({
  snapshot,
  onSelectTab,
}: RtPtWorkflowOverviewProps) {
  const nextIssueCount = snapshot.nextTab
    ? snapshot.nextTab.errors || snapshot.nextTab.warnings
    : 0;
  const nextActionLabel = snapshot.nextTab?.errors
    ? `${nextIssueCount} correction${nextIssueCount === 1 ? '' : 's'}`
    : `${nextIssueCount} review item${nextIssueCount === 1 ? '' : 's'}`;

  return (
    <section
      className="grid gap-2.5 border-t border-border/70 px-3 py-2.5 lg:grid-cols-[minmax(15rem,1fr)_auto] lg:items-center md:px-4"
      aria-label="Technique workflow readiness"
    >
      <div className="min-w-0">
        <div className="flex items-center justify-between gap-3 text-xs">
          <span className="flex items-center gap-1.5 font-semibold text-foreground">
            <ClipboardCheck className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
            Draft readiness
          </span>
          <span className="font-mono font-semibold text-foreground">
            {snapshot.completionPercent}%
          </span>
        </div>
        <div className="mt-1.5 flex items-center gap-2.5">
          <div
            className="readiness-track min-w-20 flex-1"
            role="progressbar"
            aria-label="Required technique fields completed"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={snapshot.completionPercent}
            aria-valuetext={`${snapshot.completedFieldsCount} of ${snapshot.totalRequiredFields} required fields`}
          >
            <div
              className={`readiness-fill${snapshot.completionPercent >= 100 ? ' readiness-fill--complete' : ''}`}
              style={{ width: `${Math.max(0, Math.min(100, snapshot.completionPercent))}%` }}
            />
          </div>
          <span className="shrink-0 text-[11px] text-muted-foreground">
            {snapshot.completedFieldsCount}/{snapshot.totalRequiredFields} fields
          </span>
        </div>
      </div>

      <div className="flex min-w-0 flex-wrap items-center gap-1.5 lg:justify-end">
        <span
          className={`inline-flex h-7 items-center gap-1.5 rounded-md border px-2 text-[11px] ${
            snapshot.errors > 0 ? 'border-destructive/30' : 'border-success/30'
          }`}
        >
          {snapshot.errors > 0
            ? <ShieldAlert className="h-3.5 w-3.5 text-destructive/80" aria-hidden="true" />
            : <CheckCircle2 className="h-3.5 w-3.5 text-success/80" aria-hidden="true" />}
          <span className={`font-mono font-semibold tabular-nums ${snapshot.errors > 0 ? 'text-destructive/90' : 'text-success'}`}>
            {snapshot.errors}
          </span>
          <span className="text-muted-foreground">corrections</span>
        </span>
        <span
          className={`inline-flex h-7 items-center gap-1.5 rounded-md border px-2 text-[11px] ${
            snapshot.warnings > 0 ? 'border-warning/35' : 'border-border/60'
          }`}
        >
          <AlertTriangle className={`h-3.5 w-3.5 ${snapshot.warnings > 0 ? 'text-warning/80' : 'text-muted-foreground/60'}`} aria-hidden="true" />
          <span className={`font-mono font-semibold tabular-nums ${snapshot.warnings > 0 ? 'text-warning' : 'text-muted-foreground'}`}>
            {snapshot.warnings}
          </span>
          <span className="text-muted-foreground">review</span>
        </span>
        <span className="inline-flex h-7 items-center gap-1.5 rounded-md border border-border/60 px-2 text-[11px]">
          <span className="font-mono font-semibold tabular-nums text-foreground/85">
            {snapshot.readySections}/{snapshot.totalSections}
          </span>
          <span className="text-muted-foreground">sections clear</span>
        </span>

        {snapshot.nextTab ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 min-w-0 max-w-full border-[hsl(var(--accent-border)/0.7)] bg-[hsl(var(--accent-soft)/0.4)] px-2.5 text-xs font-semibold text-accent-foreground hover:bg-[hsl(var(--accent-soft))] hover:text-accent-foreground"
            onClick={() => onSelectTab(snapshot.nextTab!.value)}
            title={`${snapshot.nextTab.label}: ${nextActionLabel}`}
          >
            <span className="truncate">Next: {snapshot.nextTab.shortLabel}</span>
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Button>
        ) : (
          <span className="inline-flex h-7 items-center gap-1.5 rounded-md border border-success/30 px-2 text-[11px] font-semibold text-success">
            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
            Workflow clear
          </span>
        )}
      </div>
    </section>
  );
}
