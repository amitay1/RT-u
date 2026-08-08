import { useMemo } from 'react';
import {
  ArrowRight,
  Boxes,
  CheckCircle2,
  FileCheck2,
  Radiation,
  Ruler,
  ScanLine,
  Target,
  Workflow,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  buildRtProcessOverview,
  type RtProcessStage,
  type RtProcessStageId,
} from '@/lib/rtPtProcessOverview';
import type { RtPtWorkflowValidation } from '@/lib/rtPtWorkflow';
import type { RtPtDocument, RtPtDocumentStatus } from '@/types/rtPtDocument';
import processImage from '@/assets/rtpt/rt-process-overview.png';

interface RtPtProcessOverviewProps {
  techniqueDocument: RtPtDocument;
  validation: RtPtWorkflowValidation;
  /** Opens the technique workspace on the tab that owns the selected stage. */
  onOpenTab: (tab: string) => void;
}

/** Intrinsic size of the process render — the frame keeps this ratio so the overlay stays anchored. */
const IMAGE_WIDTH = 1672;
const IMAGE_HEIGHT = 941;

const STAGE_ICONS: Record<RtProcessStageId, typeof Boxes> = {
  part: Boxes,
  geometry: Ruler,
  unsharpness: Target,
  exposure: Radiation,
  detector: ScanLine,
  card: FileCheck2,
};

const DOCUMENT_STATUS_LABEL: Record<RtPtDocumentStatus, string> = {
  draft: 'Draft',
  'in-review': 'In review',
  approved: 'Approved',
  superseded: 'Superseded',
};

const STATUS_CHIP: Record<RtProcessStage['status'], string> = {
  complete: 'border-success/30 bg-success/10 text-success',
  partial: 'border-warning/30 bg-warning/10 text-warning',
  pending: 'border-border/70 bg-muted/50 text-muted-foreground',
};

const NOT_SET = '—';

const stageStatusLabel = (stage: RtProcessStage): string => {
  if (stage.status === 'complete') return 'Set';
  if (stage.status === 'partial') return `${stage.filledCount}/${stage.totalCount}`;
  return 'Not set';
};

export function RtPtProcessOverview({
  techniqueDocument,
  validation,
  onOpenTab,
}: RtPtProcessOverviewProps) {
  const overview = useMemo(
    () => buildRtProcessOverview(techniqueDocument, validation),
    [techniqueDocument, validation],
  );

  if (!overview) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center px-4 py-10 text-center">
        <p className="max-w-md text-sm text-muted-foreground">
          The radiographic process overview applies to RT techniques. Start an RT Film or
          RT Digital technique to see the exposure pipeline.
        </p>
      </div>
    );
  }

  const nextStage = overview.stages.find((stage) => stage.status !== 'complete') ?? null;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex-shrink-0 px-1 pb-1.5 pt-1 md:px-3 md:pb-2 md:pt-1.5">
        <div className="workbench-header">
          <div className="flex flex-wrap items-center gap-3 px-3 py-3 md:px-4">
            <div className="workbench-brand-mark h-10 w-10 flex-none">
              <Workflow className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
                Radiographic technique pipeline
              </div>
              <div className="mt-0.5 flex min-w-0 flex-wrap items-center gap-2">
                <h2 className="truncate text-base font-semibold tracking-tight md:text-lg">
                  Casting to released technique card
                </h2>
                <span className="hidden h-1 w-1 rounded-full bg-border sm:block" aria-hidden="true" />
                <span className="text-xs font-semibold text-muted-foreground">
                  {overview.methodLabel} · {DOCUMENT_STATUS_LABEL[overview.documentStatus]}
                </span>
              </div>
            </div>

            <div className="flex flex-none items-center gap-2">
              <div className="hidden text-right sm:block">
                <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  Stages with entered data
                </div>
                <div className="mt-0.5 text-sm font-semibold">
                  {overview.completeStages} of {overview.totalStages} complete
                </div>
              </div>
              {nextStage && (
                <Button
                  type="button"
                  size="sm"
                  onClick={() => onOpenTab(nextStage.targetTab)}
                  title={`Open ${nextStage.targetTabLabel}`}
                >
                  <span className="truncate">Continue: {nextStage.title}</span>
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-1 pb-3 md:px-3">
        <div className="app-panel workbench-surface max-w-full p-2 md:p-4">
          <figure
            className="relative mx-auto w-full overflow-hidden rounded-xl border border-border/80 bg-[#0a1524] shadow-[0_18px_40px_rgba(2,6,23,0.28)]"
            style={{
              aspectRatio: `${IMAGE_WIDTH} / ${IMAGE_HEIGHT}`,
              // Caps the render so the stage row still fits a 1080p workstation window.
              maxWidth: `calc(45vh * ${IMAGE_WIDTH / IMAGE_HEIGHT})`,
            }}
          >
            <img
              src={processImage}
              alt="Radiographic exposure setup: a portable X-ray source, an aerospace ring casting on a transport frame and a flat-panel detector, above the six planning stages from casting selection to the released technique card."
              className="block h-auto w-full"
              draggable={false}
            />
          </figure>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 px-0.5">
            <h3 className="text-sm font-semibold tracking-tight">
              Pipeline stages in this technique
            </h3>
            <span className="text-[11px] text-muted-foreground">
              {overview.completedFieldsCount}/{overview.totalRequiredFields} required fields ·
              {' '}{overview.completionPercent}% complete
            </span>
          </div>

          <ol className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
            {overview.stages.map((stage) => {
              const StageIcon = STAGE_ICONS[stage.id];
              return (
                <li key={stage.id} className="min-w-0">
                  <button
                    type="button"
                    onClick={() => onOpenTab(stage.targetTab)}
                    title={`Open ${stage.targetTabLabel}`}
                    className="group flex h-full w-full flex-col rounded-lg border border-border/75 bg-background/45 p-3 text-left transition-colors hover:border-primary/40 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <div className="flex items-center gap-2">
                      <span className="grid h-7 w-7 flex-none place-items-center rounded-md border border-border/70 bg-muted/60 text-muted-foreground group-hover:text-primary">
                        <StageIcon className="h-3.5 w-3.5" aria-hidden="true" />
                      </span>
                      <span className="font-mono text-[11px] font-semibold text-muted-foreground">
                        {String(stage.step).padStart(2, '0')}
                      </span>
                      <span
                        className={cn(
                          'ml-auto inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-semibold',
                          STATUS_CHIP[stage.status],
                        )}
                      >
                        {stage.status === 'complete' && (
                          <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                        )}
                        {stageStatusLabel(stage)}
                      </span>
                    </div>

                    <div className="mt-2 text-sm font-semibold leading-tight">{stage.title}</div>
                    <p className="mt-1 text-[11px] leading-snug text-muted-foreground">{stage.caption}</p>

                    <div className="mt-2.5 rounded-md border border-border/60 bg-muted/35 px-2 py-1.5">
                      <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                        {stage.headlineLabel}
                      </div>
                      <div
                        className={cn(
                          'truncate font-mono text-sm font-semibold',
                          stage.headline ? 'text-foreground' : 'text-muted-foreground',
                        )}
                        title={stage.headline ?? undefined}
                      >
                        {stage.headline ?? NOT_SET}
                      </div>
                    </div>

                    <dl className="mt-2 space-y-1">
                      {stage.metrics.map((metric) => (
                        <div key={metric.label} className="flex min-w-0 items-baseline justify-between gap-2">
                          <dt className="flex-none text-[11px] text-muted-foreground">{metric.label}</dt>
                          <dd
                            className={cn(
                              'min-w-0 truncate font-mono text-[11px] font-semibold',
                              metric.value ? 'text-foreground' : 'text-muted-foreground',
                            )}
                            title={metric.value ?? undefined}
                          >
                            {metric.value ?? NOT_SET}
                          </dd>
                        </div>
                      ))}
                    </dl>

                    <span className="mt-auto flex items-center gap-1 pt-2.5 text-[11px] font-semibold text-primary opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                      Open {stage.targetTabLabel}
                      <ArrowRight className="h-3 w-3" aria-hidden="true" />
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        </div>
      </div>
    </div>
  );
}
