import { Film, Camera, Droplets } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ProfileIndicator } from '@/components/inspector';
import type { NdtMethod } from '@/components/Toolbar';

interface RtPtSidebarProps {
  method: Exclude<NdtMethod, 'UT'>;
  /** When set, switches the active method from the sidebar. */
  onMethodChange?: (m: Exclude<NdtMethod, 'UT'>) => void;
}

interface MethodMeta {
  id: Exclude<NdtMethod, 'UT'>;
  label: string;
  standard: string;
  summary: string;
  Icon: typeof Film;
  tabCount: number;
}

const METHOD_META: MethodMeta[] = [
  {
    id: 'RT-Film',
    label: 'RT Film',
    standard: 'ASTM E1742',
    summary: 'Radiographic Testing using film with conventional X-ray or Gamma source. Covers SFD/SOD/OFD geometry, IQI sensitivity, optical density and quality levels.',
    Icon: Film,
    tabCount: 7,
  },
  {
    id: 'RT-Digital',
    label: 'RT Digital / DDA',
    standard: 'ASTM E2698',
    summary: 'Digital Radiographic Testing with Detector Arrays (Flat Panel / CCD / CMOS). Captures detector configuration, image processing, CNR and DICONDE/TIFF output.',
    Icon: Camera,
    tabCount: 8,
  },
  {
    id: 'PT',
    label: 'Penetrant Testing',
    standard: 'ASTM E1417',
    summary: 'Liquid Penetrant Inspection — Type I / II penetrants with Method A/B/C/D. Tracks dwell times, removal, development and UV / white-light inspection conditions.',
    Icon: Droplets,
    tabCount: 8,
  },
];

export const RtPtSidebar = ({ method, onMethodChange }: RtPtSidebarProps) => {
  const active = METHOD_META.find(m => m.id === method) ?? METHOD_META[0];
  const ActiveIcon = active.Icon;

  return (
    <div className="flex flex-col gap-5">
      {/* Active method badge */}
      <div className="rounded-2xl border border-primary/25 bg-primary/8 p-4">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-primary/15 p-2 text-primary">
            <ActiveIcon className="h-5 w-5" />
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Active Method
            </span>
            <span className="text-sm font-semibold leading-tight">{active.label}</span>
            <Badge variant="secondary" className="mt-1 w-fit text-[10px] uppercase tracking-wider">
              {active.standard}
            </Badge>
          </div>
        </div>
        <p className="mt-3 text-xs leading-relaxed text-muted-foreground">{active.summary}</p>
        <div className="mt-3 flex items-center gap-1 text-[11px] text-muted-foreground">
          <span className="font-mono rounded bg-background/60 px-1.5 py-0.5 text-foreground">{active.tabCount}</span>
          <span>tabs in this technique sheet</span>
        </div>
      </div>

      {/* Quick switch — other methods */}
      <div className="flex flex-col gap-1.5">
        <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground px-1">
          Switch Method
        </span>
        <div className="flex flex-col gap-1">
          {METHOD_META.filter(m => m.id !== method).map(m => {
            const Icon = m.Icon;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => onMethodChange?.(m.id)}
                className="group flex items-center gap-3 rounded-xl border border-border/60 bg-background/50 px-3 py-2 text-left transition-colors hover:border-primary/40 hover:bg-primary/8"
              >
                <Icon className="h-4 w-4 text-muted-foreground group-hover:text-primary" />
                <div className="flex flex-col min-w-0">
                  <span className="text-sm font-semibold leading-tight">{m.label}</span>
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{m.standard}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Inspector profile (shared across methods) */}
      <div className="rounded-2xl border border-border/60 bg-background/40 p-3">
        <span className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Inspector
        </span>
        <ProfileIndicator variant="compact" className="border-0 bg-transparent p-0 shadow-none hover:bg-transparent" />
      </div>
    </div>
  );
};
