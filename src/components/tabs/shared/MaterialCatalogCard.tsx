import { useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { NumberField, TextAreaField, TextField } from '@/components/tabs/shared/FieldRow';
import { useRtMaterialCatalog } from '@/hooks/useRtMaterialCatalog';
import type { NumberOrEmpty } from '@/types/rtFilm';
import type { RtMaterialRecord } from '@/lib/rtMaterialCatalogStore';

interface DraftPoint {
  kv: NumberOrEmpty;
  halfValueLayerMm: NumberOrEmpty;
}

interface DraftMaterial {
  id?: string;
  name: string;
  specification: string;
  materialGroup: string;
  densityGCm3: NumberOrEmpty;
  notes: string;
  points: DraftPoint[];
}

const emptyDraft = (): DraftMaterial => ({
  name: '',
  specification: '',
  materialGroup: '',
  densityGCm3: '',
  notes: '',
  points: [],
});

/**
 * Site materials catalog manager. All values are user-authored from the
 * site's controlled sources — the product ships no material physics of its
 * own, and lookups never interpolate between the entered voltage points.
 */
export const MaterialCatalogCard = () => {
  const catalog = useRtMaterialCatalog();
  const [draft, setDraft] = useState<DraftMaterial>(emptyDraft);

  const loadRecord = (record: RtMaterialRecord) => {
    setDraft({
      id: record.id,
      name: record.name,
      specification: record.specification,
      materialGroup: record.materialGroup,
      densityGCm3: record.densityGCm3,
      notes: record.notes,
      points: record.attenuationPoints.map((point) => ({ kv: point.kv, halfValueLayerMm: point.halfValueLayerMm })),
    });
  };

  const saveDraft = () => {
    const points = draft.points
      .filter((point) => point.kv !== '' && point.halfValueLayerMm !== '')
      .map((point) => ({ kv: Number(point.kv), halfValueLayerMm: Number(point.halfValueLayerMm) }));
    const saved = catalog.upsertMaterial({
      id: draft.id,
      name: draft.name,
      specification: draft.specification,
      materialGroup: draft.materialGroup,
      densityGCm3: draft.densityGCm3,
      notes: draft.notes,
      attenuationPoints: points,
    });
    if (saved) setDraft(emptyDraft());
  };

  const updatePoint = (index: number, patch: Partial<DraftPoint>) => {
    setDraft((current) => ({
      ...current,
      points: current.points.map((point, pointIndex) => (pointIndex === index ? { ...point, ...patch } : point)),
    }));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Site Materials Catalog</CardTitle>
        <p className="note-clamp text-sm text-muted-foreground">
          Density and half-value-layer data entered from the site&apos;s controlled sources. The product ships no
          material physics of its own; every change bumps the record revision and keeps the prior state.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {catalog.storeUnreadable ? (
          <Alert variant="destructive">
            <AlertTitle>Stored material catalog is unreadable — writes are disabled</AlertTitle>
            <AlertDescription>
              The persisted catalog on this workstation could not be read and was left untouched. To protect it,
              adding, editing, and removing materials stay disabled for this session. Back up or clear the stored
              data (browser storage key <code>rtpt_inspector_material_catalog</code>) before continuing.
            </AlertDescription>
          </Alert>
        ) : null}
        {catalog.error && !catalog.storeUnreadable ? (
          <Alert variant="destructive">
            <AlertTitle>Material catalog storage problem</AlertTitle>
            <AlertDescription className="flex items-center justify-between gap-3">
              <span>{catalog.error}</span>
              <Button type="button" size="sm" variant="outline" onClick={catalog.clearError}>Dismiss</Button>
            </AlertDescription>
          </Alert>
        ) : null}

        {catalog.materials.length === 0 ? (
          <p className="text-sm text-muted-foreground">No materials recorded yet for this workstation.</p>
        ) : (
          <div className="space-y-2">
            {catalog.materials.map((record) => (
              <div key={record.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/60 bg-background/60 px-3 py-2">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold">{record.name}</span>
                    <Badge variant="outline" className="font-mono text-[10px]">rev {record.revision}</Badge>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {[record.specification, record.materialGroup].filter(Boolean).join(' · ') || 'No specification recorded'}
                    {record.densityGCm3 !== '' ? ` · ${record.densityGCm3} g/cm³` : ''}
                    {` · ${record.attenuationPoints.length} HVL point${record.attenuationPoints.length === 1 ? '' : 's'}`}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button type="button" size="icon" variant="ghost" aria-label={`Edit ${record.name}`} onClick={() => loadRecord(record)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="text-destructive hover:text-destructive"
                    aria-label={`Remove ${record.name}`}
                    disabled={catalog.storeUnreadable}
                    onClick={() => catalog.removeMaterial(record.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="space-y-3 rounded-xl border border-border/70 bg-muted/20 p-4">
          <div className="text-sm font-semibold">{draft.id ? 'Edit material (new revision)' : 'Add material'}</div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <TextField label="Material Name" value={draft.name} onChange={(name) => setDraft({ ...draft, name })} />
            <TextField label="Specification" value={draft.specification} onChange={(specification) => setDraft({ ...draft, specification })} placeholder="Controlled material specification" />
            <TextField label="Material Group" value={draft.materialGroup} onChange={(materialGroup) => setDraft({ ...draft, materialGroup })} placeholder="Per the governing IQI practice" />
            <NumberField label="Density" value={draft.densityGCm3} onChange={(densityGCm3) => setDraft({ ...draft, densityGCm3 })} min={0} unit="g/cm³" step="0.01" />
            <TextAreaField label="Notes / Data Source" value={draft.notes} onChange={(notes) => setDraft({ ...draft, notes })} placeholder="Where these values come from (chart, supplier data, qualification)" />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Half-value-layer points (exact voltages, no interpolation)</span>
              <Button type="button" size="sm" variant="outline" onClick={() => setDraft({ ...draft, points: [...draft.points, { kv: '', halfValueLayerMm: '' }] })}>
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                Add Point
              </Button>
            </div>
            {draft.points.map((point, index) => (
              // Draft rows have no stable identity until saved; index keys are acceptable here.
              <div key={`draft-point-${index}`} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_2.5rem] items-end gap-2">
                <NumberField label="Tube Voltage" value={point.kv} onChange={(kv) => updatePoint(index, { kv })} min={0} unit="kV" />
                <NumberField label="Half-Value Layer" value={point.halfValueLayerMm} onChange={(halfValueLayerMm) => updatePoint(index, { halfValueLayerMm })} min={0} unit="mm" />
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="text-destructive hover:text-destructive"
                  aria-label={`Remove point ${index + 1}`}
                  onClick={() => setDraft({ ...draft, points: draft.points.filter((_, pointIndex) => pointIndex !== index) })}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" onClick={saveDraft} disabled={!draft.name.trim() || catalog.storeUnreadable}>
              {draft.id ? 'Save New Revision' : 'Add Material'}
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setDraft(emptyDraft())}>
              Clear Form
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
