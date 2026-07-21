import { useId } from 'react';
import { BookOpenCheck, Camera, Droplets, FilePlus2, Film, Layers3 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ProfileIndicator } from '@/components/inspector';
import {
  RT_PT_REFERENCE_SUGGESTIONS,
  type RtPtMethod,
} from '@/types/rtPtDocument';

interface RtPtSidebarProps {
  method: RtPtMethod;
  /** Starts a fresh technique for the selected method. The caller owns dirty-state confirmation. */
  onMethodChange?: (method: RtPtMethod) => void;
  /** Condensed context strip used when the workspace is stacked below the desktop breakpoint. */
  compact?: boolean;
}

interface MethodMeta {
  id: RtPtMethod;
  label: string;
  summary: string;
  Icon: typeof Film;
  tabCount: number;
}

const METHOD_META: MethodMeta[] = [
  {
    id: 'RT-Film',
    label: 'RT Film',
    summary: 'Controlled film-radiography technique planning for exposure geometry, source setup, film system and image-quality requirements.',
    Icon: Film,
    tabCount: 8,
  },
  {
    id: 'RT-Digital',
    label: 'RT Digital / DDA',
    summary: 'Controlled DDA technique planning for source and detector configuration, acquisition, image quality, processing and storage.',
    Icon: Camera,
    tabCount: 9,
  },
  {
    id: 'PT',
    label: 'Penetrant Testing',
    summary: 'Controlled liquid-penetrant technique planning for approved materials, surface preparation, application, removal, development and viewing conditions.',
    Icon: Droplets,
    tabCount: 9,
  },
];

export const RtPtSidebar = ({ method, onMethodChange, compact = false }: RtPtSidebarProps) => {
  const active = METHOD_META.find(m => m.id === method) ?? METHOD_META[0];
  const ActiveIcon = active.Icon;
  const sidebarId = useId();
  const activeTitleId = `${sidebarId}-active-method-title`;
  const newTechniqueTitleId = `${sidebarId}-new-technique-title`;

  if (compact) {
    return (
      <div className="grid gap-2">
        <section className="workbench-group flex flex-wrap items-center gap-3 p-3" aria-labelledby={activeTitleId}>
          <div className="workbench-brand-mark h-9 w-9 flex-none">
            <ActiveIcon className="h-4 w-4" />
          </div>
          <div className="min-w-[150px] flex-1">
            <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Current technique</span>
            <div className="mt-0.5 flex items-center gap-2">
              <h4 id={activeTitleId} className="truncate text-sm font-semibold tracking-tight">{active.label}</h4>
              <Badge variant="secondary" className="flex-none font-mono text-[10px]">{active.tabCount} steps</Badge>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-1.5" aria-label="Start another technique">
            {METHOD_META.filter(m => m.id !== method).map(m => {
              const Icon = m.Icon;
              const shortLabel = m.id === 'RT-Digital' ? 'Digital / DDA' : m.id === 'PT' ? 'PT' : 'Film';
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => onMethodChange?.(m.id)}
                  aria-label={`Start a new ${m.label} technique`}
                  className="inline-flex h-9 items-center gap-2 rounded-md border border-border/75 bg-background/45 px-2.5 text-xs font-semibold text-foreground transition-colors hover:border-primary/40 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Icon className="h-3.5 w-3.5 text-primary" />
                  <span>{shortLabel}</span>
                </button>
              );
            })}
          </div>
        </section>

        <section className="workbench-group flex min-w-0 items-center gap-3 px-3 py-2" aria-label="Method reference and active inspector">
          <BookOpenCheck className="h-4 w-4 flex-none text-primary" />
          <div className="min-w-0 flex-1">
            <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Reference guidance</span>
            <p className="truncate text-xs text-muted-foreground" title={RT_PT_REFERENCE_SUGGESTIONS[active.id]}>
              {RT_PT_REFERENCE_SUGGESTIONS[active.id]}
            </p>
          </div>
          <ProfileIndicator variant="compact" className="hidden flex-none border-0 bg-transparent p-0 shadow-none hover:bg-transparent sm:inline-flex" />
        </section>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <section className="workbench-group overflow-hidden p-4" aria-labelledby={activeTitleId}>
        <div className="flex items-center gap-3">
          <div className="workbench-brand-mark h-10 w-10 flex-none">
            <ActiveIcon className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Current technique</span>
            <h4 id={activeTitleId} className="mt-0.5 truncate text-base font-semibold tracking-tight">{active.label}</h4>
          </div>
          <Badge variant="secondary" className="flex-none font-mono text-[11px]">{active.tabCount} steps</Badge>
        </div>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{active.summary}</p>
        <div className="mt-3 rounded-lg border border-border/70 bg-background/40 p-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-foreground/80">
            <BookOpenCheck className="h-4 w-4 text-primary" />
            Reference guidance
          </div>
          <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{RT_PT_REFERENCE_SUGGESTIONS[active.id]}</p>
          <p className="mt-2 text-[11px] font-medium text-warning">Confirm the applicable revision and customer requirements.</p>
        </div>
      </section>

      <section aria-labelledby={newTechniqueTitleId}>
        <div className="mb-2 flex items-center justify-between gap-3 px-1">
          <div>
            <h4 id={newTechniqueTitleId} className="text-sm font-semibold">New technique</h4>
            <p className="text-xs text-muted-foreground">Creates a separate controlled document</p>
          </div>
          <FilePlus2 className="h-4 w-4 flex-none text-muted-foreground" />
        </div>
        <div className="flex flex-col gap-2">
          {METHOD_META.filter(m => m.id !== method).map(m => {
            const Icon = m.Icon;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => onMethodChange?.(m.id)}
                aria-label={m.id === 'RT-Digital' ? 'RT Digital' : m.id === 'PT' ? 'PT' : 'RT Film'}
                aria-describedby={`${sidebarId}-${m.id}-new-document-note`}
                className="group flex items-center gap-3 rounded-lg border border-border/75 bg-background/40 px-3 py-2.5 text-left transition-colors hover:border-primary/40 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                <span className="grid h-8 w-8 flex-none place-items-center rounded-md border border-border/70 bg-muted/60 text-muted-foreground group-hover:text-primary">
                  <Icon className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold leading-tight">Start {m.label}</span>
                  <span id={`${sidebarId}-${m.id}-new-document-note`} className="mt-0.5 block text-xs text-muted-foreground">New document · {m.tabCount} workflow steps</span>
                </div>
                <Layers3 className="h-4 w-4 flex-none text-muted-foreground/70" />
              </button>
            );
          })}
        </div>
      </section>

      <section className="rounded-lg border border-border/70 bg-background/30 p-3" aria-label="Active inspector">
        <span className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Inspector</span>
        <ProfileIndicator variant="compact" className="border-0 bg-transparent p-0 shadow-none hover:bg-transparent" />
      </section>
    </div>
  );
};
