import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DateField, NumberField, SelectField, TextField } from '@/components/tabs/shared/FieldRow';
import type { DetectorLengthUnit, RtPerformanceTrendEntry } from '@/types/rtFilm';

interface Props {
  title: string;
  description: string;
  entries?: RtPerformanceTrendEntry[];
  /** Passing null removes the trend key from the controlled document entirely. */
  onChange: (entries: RtPerformanceTrendEntry[] | null) => void;
}

const DETECTOR_LENGTH_UNITS: ReadonlyArray<{ label: string; value: DetectorLengthUnit }> = [
  { label: 'um', value: 'um' },
  { label: 'mm', value: 'mm' },
  { label: 'inch', value: 'inch' },
];

const createEntryId = (): string => {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return `trend-${globalThis.crypto.randomUUID()}`;
  }
  return `trend-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
};

/**
 * Append-only E2737-style performance trend log, shared by the DR detector
 * tab and the CR scanner tab. Chronological order is enforced by validation.
 */
export const PerformanceTrendEditor = ({ title, description, entries, onChange }: Props) => {
  const rows = entries ?? [];

  const commit = (next: RtPerformanceTrendEntry[]) => {
    onChange(next.length === 0 ? null : next);
  };

  const updateEntry = (id: string, patch: Partial<Omit<RtPerformanceTrendEntry, 'id'>>) => {
    commit(rows.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry)));
  };

  const addEntry = () => {
    commit([
      ...rows,
      {
        id: createEntryId(),
        date: '',
        measuredSrb: '',
        measuredSrbUnit: 'um',
        measuredSnr: '',
        reference: '',
        notes: '',
      },
    ]);
  };

  const deleteEntry = (id: string) => {
    commit(rows.filter((entry) => entry.id !== id));
  };

  return (
    <section className="md:col-span-2 space-y-3 rounded-xl border border-border/70 bg-muted/20 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
        <Button type="button" size="sm" variant="outline" onClick={addEntry}>
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          Add Measurement
        </Button>
      </div>
      {rows.length === 0 ? (
        <p className="note-clamp text-sm text-muted-foreground">
          No trend measurements recorded. Entries are append-only and must stay in chronological order.
        </p>
      ) : (
        <div className="space-y-3">
          {rows.map((entry, index) => (
            <div key={entry.id} className="rounded-lg border border-border/60 bg-background/60 p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Measurement {index + 1}
                </span>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="text-destructive hover:text-destructive"
                  aria-label={`Delete measurement ${index + 1}`}
                  onClick={() => deleteEntry(entry.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              <div className="mt-2 grid grid-cols-1 gap-3 md:grid-cols-3">
                <DateField label="Measurement Date" value={entry.date} onChange={(date) => updateEntry(entry.id, { date })} />
                <div className="grid grid-cols-[minmax(0,1fr)_6.5rem] gap-2">
                  <NumberField
                    label="Measured SRb"
                    value={entry.measuredSrb}
                    onChange={(measuredSrb) => updateEntry(entry.id, { measuredSrb })}
                    min={0}
                  />
                  <SelectField
                    label="Unit"
                    value={entry.measuredSrbUnit}
                    onChange={(measuredSrbUnit) => updateEntry(entry.id, { measuredSrbUnit })}
                    options={DETECTOR_LENGTH_UNITS}
                  />
                </div>
                <NumberField
                  label="Measured SNR"
                  value={entry.measuredSnr}
                  onChange={(measuredSnr) => updateEntry(entry.id, { measuredSnr })}
                  min={0}
                />
                <TextField
                  label="Evidence Reference"
                  value={entry.reference}
                  onChange={(reference) => updateEntry(entry.id, { reference })}
                  placeholder="Report / phantom record identifier"
                />
                <div className="md:col-span-2">
                  <TextField label="Notes" value={entry.notes} onChange={(notes) => updateEntry(entry.id, { notes })} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
};
