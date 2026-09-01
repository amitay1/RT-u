import { useMemo, useState } from 'react';
import { Check, Database, Plus, Save, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  DateField,
  NumberField,
  SelectField,
  TextAreaField,
  TextField,
} from '@/components/tabs/shared/FieldRow';
import { useRtDigitalCatalog } from '@/hooks/useRtDigitalCatalog';
import type {
  LengthUnit,
  RtDigitalSource,
  RtDigitalSourceCatalogSnapshot,
  RtDigitalSourceSelection,
  RtDigitalWorkflow,
} from '@/types/rtDigital';

interface Props {
  workflow: RtDigitalWorkflow;
  onWorkflowChange: (workflow: RtDigitalWorkflow) => void;
  source: RtDigitalSource;
  onSourceChange: (source: RtDigitalSource) => void;
  selection: RtDigitalSourceSelection;
  onSelectionChange: (selection: RtDigitalSourceSelection) => void;
}

const LENGTH_UNITS: ReadonlyArray<{ label: string; value: LengthUnit }> = [
  { label: 'mm', value: 'mm' },
  { label: 'inch', value: 'inch' },
];

const CURRENT_STATUS_OPTIONS = ['Current', 'Valid', 'Qualified', 'Active'] as const;

const freshId = (prefix: string): string => (
  typeof globalThis.crypto?.randomUUID === 'function'
    ? `${prefix}-${globalThis.crypto.randomUUID()}`
    : `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
);

const createBlankSnapshot = (source?: RtDigitalSource): RtDigitalSourceCatalogSnapshot => ({
  manufacturer: source?.manufacturer ?? '',
  model: source?.model ?? '',
  serialNumber: source?.serialNumber ?? '',
  kvMinimum: '',
  kvMaximum: '',
  currentMinimum: '',
  currentMaximum: '',
  maximumPowerKw: '',
  focalSpots: [],
  filters: [],
  calibration: { reference: source?.calibrationRequirement ?? '', status: '', date: '', dueDate: '' },
  qualification: { reference: '', status: '', date: '', dueDate: '' },
});

export const RtDigitalExposureTab = ({
  workflow,
  onWorkflowChange,
  source,
  onSourceChange,
  selection,
  onSelectionChange,
}: Props) => {
  const catalog = useRtDigitalCatalog();
  const [catalogName, setCatalogName] = useState('');
  const snapshot = useMemo(
    () => selection.snapshot ?? createBlankSnapshot(source),
    [selection.snapshot, source],
  );

  const setSource = <K extends keyof RtDigitalSource>(key: K, value: RtDigitalSource[K]) => {
    onSourceChange({ ...source, [key]: value });
  };
  const setSnapshot = (next: RtDigitalSourceCatalogSnapshot) => {
    onSelectionChange({
      ...selection,
      catalogRevisionId: '',
      catalogRevision: '',
      snapshot: next,
    });
  };
  const setIdentity = (key: 'manufacturer' | 'model' | 'serialNumber', value: string) => {
    setSource(key, value);
    setSnapshot({ ...snapshot, [key]: value });
  };

  const applyCatalogRevision = (revisionId: string) => {
    const option = catalog.sourceOptions.find((candidate) => candidate.revisionId === revisionId);
    if (!option) return;
    const selected = catalog.copySourceSnapshot(option.recordId, option.revisionId);
    if (!selected) return;
    const firstSpot = selected.snapshot.focalSpots[0];
    onSelectionChange({
      ...selection,
      catalogRecordId: selected.catalogRecordId,
      catalogRevisionId: selected.catalogRevisionId,
      catalogRevision: selected.catalogRevision,
      snapshot: selected.snapshot,
      focalSpotOptionId: firstSpot?.id ?? '',
      filterOptionIds: [],
    });
    onSourceChange({
      ...source,
      sourceType: 'X-ray',
      manufacturer: selected.snapshot.manufacturer,
      model: selected.snapshot.model,
      serialNumber: selected.snapshot.serialNumber,
      focalSpotSize: firstSpot?.size ?? '',
      focalSpotSizeUnit: firstSpot?.unit ?? 'mm',
      calibrationRequirement: [
        selected.snapshot.calibration.reference,
        selected.snapshot.calibration.status,
      ].filter(Boolean).join(' — '),
    });
    setCatalogName(catalog.sources.find((record) => record.id === option.recordId)?.name ?? '');
  };

  const saveCatalogRevision = () => {
    const name = catalogName.trim() || [snapshot.manufacturer, snapshot.model].filter(Boolean).join(' ');
    if (!name) {
      toast.error('Enter a catalog name or source manufacturer/model first.');
      return;
    }
    try {
      const record = catalog.upsertSource({
        name,
        snapshot,
        recordId: selection.catalogRecordId || undefined,
      });
      const revision = record.revisions[record.revisions.length - 1];
      onSelectionChange({
        ...selection,
        catalogRecordId: record.id,
        catalogRevisionId: revision.id,
        catalogRevision: revision.revision,
        snapshot: JSON.parse(JSON.stringify(revision.snapshot)) as RtDigitalSourceCatalogSnapshot,
      });
      setCatalogName(record.name);
      toast.success(`Source catalog revision ${revision.revision} saved locally.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'The source catalog could not be saved.');
    }
  };

  const selectFocalSpot = (focalSpotOptionId: string) => {
    const focalSpot = snapshot.focalSpots.find((option) => option.id === focalSpotOptionId);
    onSelectionChange({ ...selection, focalSpotOptionId });
    if (focalSpot) {
      onSourceChange({
        ...source,
        focalSpotSize: focalSpot.size,
        focalSpotSizeUnit: focalSpot.unit,
      });
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>2. X-ray Source</CardTitle>
          <p className="note-clamp text-sm text-muted-foreground">
            Select a revisioned RT/PT-local source snapshot or define one here. Digital/DDA remains X-ray-only.
          </p>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <SelectField label="Acquisition Workflow" value={workflow} onChange={onWorkflowChange} options={['Static']} />
            <SelectField label="Source Type" value={source.sourceType} onChange={(value) => setSource('sourceType', value)} options={['X-ray']} />
            <SelectField
              label="Local Source Revision"
              value={selection.catalogRevisionId}
              onChange={applyCatalogRevision}
              options={catalog.sourceOptions.map((option) => ({ value: option.value, label: option.label }))}
              placeholder="Select a saved source revision…"
              hint="RT/PT-local catalog"
            />
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-2">
              <TextField label="Catalog Record Name" value={catalogName} onChange={setCatalogName} placeholder="e.g. Cabinet XR-02" />
              <Button type="button" variant="outline" onClick={saveCatalogRevision}>
                <Save className="mr-1.5 h-4 w-4" />
                {selection.catalogRecordId ? 'New Revision' : 'Save'}
              </Button>
            </div>
            {catalog.storageError ? (
              <p className="md:col-span-2 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning">
                {catalog.storageError.message}
              </p>
            ) : null}
          </div>

          <div className="grid grid-cols-1 gap-4 border-t border-border/70 pt-5 md:grid-cols-2">
            <TextField label="Manufacturer" value={source.manufacturer} onChange={(value) => setIdentity('manufacturer', value)} />
            <TextField label="Model" value={source.model} onChange={(value) => setIdentity('model', value)} />
            <TextField label="Serial Number" value={source.serialNumber} onChange={(value) => setIdentity('serialNumber', value)} />
            <TextField
              label="Calibration Requirement"
              value={source.calibrationRequirement}
              onChange={(value) => setSource('calibrationRequirement', value)}
              placeholder="Controlled interval or procedure"
            />
            <NumberField label="Minimum kV" value={snapshot.kvMinimum} onChange={(kvMinimum) => setSnapshot({ ...snapshot, kvMinimum })} unit="kV" min={0} />
            <NumberField label="Maximum kV" value={snapshot.kvMaximum} onChange={(kvMaximum) => setSnapshot({ ...snapshot, kvMaximum })} unit="kV" min={0} />
            <NumberField label="Minimum Tube Current" value={snapshot.currentMinimum} onChange={(currentMinimum) => setSnapshot({ ...snapshot, currentMinimum })} unit="mA" min={0} />
            <NumberField label="Maximum Tube Current" value={snapshot.currentMaximum} onChange={(currentMaximum) => setSnapshot({ ...snapshot, currentMaximum })} unit="mA" min={0} />
            <NumberField label="Maximum Power" value={snapshot.maximumPowerKw} onChange={(maximumPowerKw) => setSnapshot({ ...snapshot, maximumPowerKw })} unit="kW" min={0} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle className="text-base">Focal Spot Modes</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">The selected mode supplies the actual focal-spot size used by live geometry calculations.</p>
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setSnapshot({
                ...snapshot,
                focalSpots: [...snapshot.focalSpots, { id: freshId('focal-spot'), label: '', size: '', unit: 'mm' }],
              })}
            >
              <Plus className="mr-1.5 h-4 w-4" /> Add Mode
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {snapshot.focalSpots.length === 0 ? (
            <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">No focal-spot modes defined.</p>
          ) : snapshot.focalSpots.map((option, index) => (
            <div key={option.id} className="grid grid-cols-1 gap-3 rounded-xl border border-border/70 p-3 md:grid-cols-[auto_minmax(0,1fr)_minmax(0,1fr)_8rem_auto] md:items-end">
              <Button
                type="button"
                size="icon"
                variant={selection.focalSpotOptionId === option.id ? 'default' : 'outline'}
                aria-label={`Use focal spot mode ${index + 1}`}
                onClick={() => selectFocalSpot(option.id)}
              >
                <Check className="h-4 w-4" />
              </Button>
              <TextField label="Mode" value={option.label} onChange={(label) => setSnapshot({ ...snapshot, focalSpots: snapshot.focalSpots.map((item) => item.id === option.id ? { ...item, label } : item) })} />
              <NumberField label="Actual Focal Spot" value={option.size} onChange={(size) => setSnapshot({ ...snapshot, focalSpots: snapshot.focalSpots.map((item) => item.id === option.id ? { ...item, size } : item) })} min={0} />
              <SelectField label="Unit" value={option.unit} onChange={(unit) => setSnapshot({ ...snapshot, focalSpots: snapshot.focalSpots.map((item) => item.id === option.id ? { ...item, unit } : item) })} options={LENGTH_UNITS} />
              <Button type="button" size="icon" variant="ghost" aria-label={`Remove focal spot mode ${index + 1}`} onClick={() => setSnapshot({ ...snapshot, focalSpots: snapshot.focalSpots.filter((item) => item.id !== option.id) })}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle className="text-base">Available Filters</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">Select one or more catalogued filters for this technique.</p>
            </div>
            <Button type="button" size="sm" variant="outline" onClick={() => setSnapshot({ ...snapshot, filters: [...snapshot.filters, { id: freshId('filter'), label: '', description: '' }] })}>
              <Plus className="mr-1.5 h-4 w-4" /> Add Filter
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {snapshot.filters.map((option, index) => {
            const checked = selection.filterOptionIds.includes(option.id);
            return (
              <div key={option.id} className="grid grid-cols-1 gap-3 rounded-xl border border-border/70 p-3 md:grid-cols-[auto_minmax(0,1fr)_minmax(0,2fr)_auto] md:items-end">
                <div className="flex items-center gap-2 pb-2">
                  <Checkbox
                    id={`source-filter-${option.id}`}
                    checked={checked}
                    onCheckedChange={(value) => onSelectionChange({
                      ...selection,
                      filterOptionIds: value
                        ? [...selection.filterOptionIds, option.id]
                        : selection.filterOptionIds.filter((id) => id !== option.id),
                    })}
                  />
                  <Label htmlFor={`source-filter-${option.id}`}>Use</Label>
                </div>
                <TextField label="Filter" value={option.label} onChange={(label) => setSnapshot({ ...snapshot, filters: snapshot.filters.map((item) => item.id === option.id ? { ...item, label } : item) })} />
                <TextField label="Material / Thickness / Notes" value={option.description} onChange={(description) => setSnapshot({ ...snapshot, filters: snapshot.filters.map((item) => item.id === option.id ? { ...item, description } : item) })} />
                <Button type="button" size="icon" variant="ghost" aria-label={`Remove filter ${index + 1}`} onClick={() => setSnapshot({ ...snapshot, filters: snapshot.filters.filter((item) => item.id !== option.id) })}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            );
          })}
          <TextAreaField label="Additional Filter Instruction" value={selection.extraFilter} onChange={(extraFilter) => onSelectionChange({ ...selection, extraFilter })} rows={2} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Calibration &amp; Qualification Status</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {(['calibration', 'qualification'] as const).map((key) => {
            const status = snapshot[key];
            return (
              <section key={key} className="rounded-xl border border-border/70 bg-muted/20 p-4">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold capitalize">{key}</h3>
                  <Badge variant="outline"><Database className="mr-1 h-3 w-3" /> catalog snapshot</Badge>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <TextField label="Reference" value={status.reference} onChange={(reference) => setSnapshot({ ...snapshot, [key]: { ...status, reference } })} />
                  <SelectField label="Status" value={status.status} onChange={(value) => setSnapshot({ ...snapshot, [key]: { ...status, status: value } })} options={CURRENT_STATUS_OPTIONS} placeholder="Select current status…" />
                  <DateField label="Record Date" value={status.date} onChange={(date) => setSnapshot({ ...snapshot, [key]: { ...status, date } })} />
                  <DateField label="Due Date" value={status.dueDate} onChange={(dueDate) => setSnapshot({ ...snapshot, [key]: { ...status, dueDate } })} />
                </div>
              </section>
            );
          })}
          <TextAreaField label="Source Selection Notes" value={selection.notes} onChange={(notes) => onSelectionChange({ ...selection, notes })} rows={3} />
        </CardContent>
      </Card>
    </div>
  );
};
