import { useMemo, useState } from 'react';
import { Database, Save } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  DateField,
  NumberField,
  SelectField,
  TextAreaField,
  TextField,
} from '@/components/tabs/shared/FieldRow';
import { useRtDigitalCatalog } from '@/hooks/useRtDigitalCatalog';
import type {
  DetectorLengthUnit,
  LengthUnit,
  RtDigitalCatalogStatus,
  RtDigitalDetectorCatalogSnapshot,
  RtDigitalDetectorPerformance,
  RtDigitalDetectorSelection,
  RtDigitalReferenceStatus,
  RtDigitalSystem,
} from '@/types/rtDigital';

interface Props {
  system: RtDigitalSystem;
  onSystemChange: (system: RtDigitalSystem) => void;
  performance: RtDigitalDetectorPerformance;
  onPerformanceChange: (performance: RtDigitalDetectorPerformance) => void;
  selection: RtDigitalDetectorSelection;
  onSelectionChange: (selection: RtDigitalDetectorSelection) => void;
}

const LENGTH_UNITS: ReadonlyArray<{ label: string; value: LengthUnit }> = [
  { label: 'mm', value: 'mm' },
  { label: 'inch', value: 'inch' },
];

const DETECTOR_LENGTH_UNITS: ReadonlyArray<{ label: string; value: DetectorLengthUnit }> = [
  { label: 'µm', value: 'um' },
  { label: 'mm', value: 'mm' },
  { label: 'inch', value: 'inch' },
];

const CURRENT_STATUS_OPTIONS = ['Current', 'Valid', 'Qualified', 'Active'] as const;

const catalogStatusFromReference = (value: RtDigitalReferenceStatus): RtDigitalCatalogStatus => ({
  reference: value.reference,
  status: value.status,
  date: value.date,
  dueDate: value.dueDate,
});

const snapshotFromCurrent = (
  system: RtDigitalSystem,
  performance: RtDigitalDetectorPerformance,
): RtDigitalDetectorCatalogSnapshot => ({
  manufacturer: system.manufacturer,
  model: system.model,
  serialNumber: system.serialNumber,
  activeWidth: system.activeAreaWidth,
  activeHeight: system.activeAreaHeight,
  activeAreaUnit: system.activeAreaUnit,
  matrixColumns: system.matrixColumns,
  matrixRows: system.matrixRows,
  pixelSize: system.pixelSize,
  pixelSizeUnit: system.pixelSizeUnit,
  bitDepth: system.bitDepth,
  detectorSrb: performance.detectorSrb,
  detectorSrbUnit: performance.detectorSrbUnit,
  modes: system.detectorMode ? [system.detectorMode] : [],
  calibration: catalogStatusFromReference(performance.calibration),
  badPixelMap: catalogStatusFromReference(performance.badPixelMap),
  qualification: { reference: system.systemQualificationReference, status: '', date: '', dueDate: '' },
});

interface StatusFieldsProps {
  title: string;
  value: RtDigitalCatalogStatus;
  onChange: (value: RtDigitalCatalogStatus) => void;
}

const StatusFields = ({ title, value, onChange }: StatusFieldsProps) => (
  <section className="rounded-xl border border-border/70 bg-muted/20 p-4">
    <div className="mb-3 flex items-center justify-between gap-2">
      <h3 className="text-sm font-semibold">{title}</h3>
      <Badge variant="outline"><Database className="mr-1 h-3 w-3" /> catalog snapshot</Badge>
    </div>
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <TextField label="Reference" value={value.reference} onChange={(reference) => onChange({ ...value, reference })} />
      <SelectField label="Status" value={value.status} onChange={(status) => onChange({ ...value, status })} options={CURRENT_STATUS_OPTIONS} placeholder="Select current status…" />
      <DateField label="Record Date" value={value.date} onChange={(date) => onChange({ ...value, date })} />
      <DateField label="Due Date" value={value.dueDate} onChange={(dueDate) => onChange({ ...value, dueDate })} />
    </div>
  </section>
);

export const RtDigitalDetectorTab = ({
  system,
  onSystemChange,
  performance,
  onPerformanceChange,
  selection,
  onSelectionChange,
}: Props) => {
  const catalog = useRtDigitalCatalog();
  const [catalogName, setCatalogName] = useState('');
  const snapshot = useMemo(
    () => selection.snapshot ?? snapshotFromCurrent(system, performance),
    [performance, selection.snapshot, system],
  );

  const setSnapshot = (next: RtDigitalDetectorCatalogSnapshot) => {
    onSelectionChange({
      ...selection,
      catalogRevisionId: '',
      catalogRevision: '',
      snapshot: next,
    });
  };
  const setSystem = <K extends keyof RtDigitalSystem>(key: K, value: RtDigitalSystem[K]) => {
    onSystemChange({ ...system, [key]: value });
  };
  const syncSystem = <K extends keyof Pick<RtDigitalSystem, 'manufacturer' | 'model' | 'serialNumber'>>(
    key: K,
    value: RtDigitalSystem[K],
  ) => {
    setSystem(key, value);
    setSnapshot({ ...snapshot, [key]: value });
  };

  const applyCatalogRevision = (revisionId: string) => {
    const option = catalog.detectorOptions.find((candidate) => candidate.revisionId === revisionId);
    if (!option) return;
    const selected = catalog.copyDetectorSnapshot(option.recordId, option.revisionId);
    if (!selected) return;
    const next = selected.snapshot;
    const detectorMode = next.modes[0] ?? '';
    onSelectionChange({
      ...selection,
      catalogRecordId: selected.catalogRecordId,
      catalogRevisionId: selected.catalogRevisionId,
      catalogRevision: selected.catalogRevision,
      snapshot: next,
      detectorMode,
    });
    onSystemChange({
      ...system,
      manufacturer: next.manufacturer,
      model: next.model,
      serialNumber: next.serialNumber,
      activeAreaWidth: next.activeWidth,
      activeAreaHeight: next.activeHeight,
      activeAreaUnit: next.activeAreaUnit,
      matrixColumns: next.matrixColumns,
      matrixRows: next.matrixRows,
      pixelSize: next.pixelSize,
      pixelSizeUnit: next.pixelSizeUnit,
      bitDepth: next.bitDepth,
      detectorMode,
      systemQualificationReference: next.qualification.reference,
    });
    onPerformanceChange({
      ...performance,
      detectorSrb: next.detectorSrb,
      detectorSrbUnit: next.detectorSrbUnit,
      calibration: { ...next.calibration },
      badPixelMap: { ...next.badPixelMap },
    });
    setCatalogName(catalog.detectors.find((record) => record.id === option.recordId)?.name ?? '');
  };

  const saveCatalogRevision = () => {
    const name = catalogName.trim() || [snapshot.manufacturer, snapshot.model].filter(Boolean).join(' ');
    if (!name) {
      toast.error('Enter a catalog name or detector manufacturer/model first.');
      return;
    }
    try {
      const record = catalog.upsertDetector({
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
        snapshot: JSON.parse(JSON.stringify(revision.snapshot)) as RtDigitalDetectorCatalogSnapshot,
      });
      setCatalogName(record.name);
      toast.success(`Detector catalog revision ${revision.revision} saved locally.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'The detector catalog could not be saved.');
    }
  };

  const updateStatus = (
    key: 'calibration' | 'badPixelMap' | 'qualification',
    next: RtDigitalCatalogStatus,
  ) => {
    setSnapshot({ ...snapshot, [key]: next });
    if (key === 'calibration' || key === 'badPixelMap') {
      onPerformanceChange({ ...performance, [key]: { ...next } });
    } else {
      onSystemChange({ ...system, systemQualificationReference: next.reference });
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>3. Digital Detector</CardTitle>
          <p className="text-sm text-muted-foreground">
            Select a revisioned RT/PT detector snapshot; controlled values are copied into this technique and remain unchanged by later catalog edits.
          </p>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <SelectField
              label="Local Detector Revision"
              value={selection.catalogRevisionId}
              onChange={applyCatalogRevision}
              options={catalog.detectorOptions.map((option) => ({ value: option.value, label: option.label }))}
              placeholder="Select a saved detector revision…"
              hint="RT/PT-local catalog"
            />
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-2">
              <TextField label="Catalog Record Name" value={catalogName} onChange={setCatalogName} placeholder="e.g. DDA Panel 04" />
              <Button type="button" variant="outline" onClick={saveCatalogRevision}>
                <Save className="mr-1.5 h-4 w-4" />
                {selection.catalogRecordId ? 'New Revision' : 'Save'}
              </Button>
            </div>
            <TextField label="DDA Type" value={system.ddaType} onChange={(value) => setSystem('ddaType', value)} placeholder="Flat panel / qualified technology" />
            <TextField label="Manufacturer" value={system.manufacturer} onChange={(value) => syncSystem('manufacturer', value)} />
            <TextField label="Model" value={system.model} onChange={(value) => syncSystem('model', value)} />
            <TextField label="Serial Number" value={system.serialNumber} onChange={(value) => syncSystem('serialNumber', value)} />
          </div>

          <div className="grid grid-cols-1 gap-4 border-t border-border/70 pt-5 md:grid-cols-2">
            <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_7.5rem] gap-2 md:col-span-2">
              <NumberField label="Active Width" value={system.activeAreaWidth} onChange={(activeAreaWidth) => { setSystem('activeAreaWidth', activeAreaWidth); setSnapshot({ ...snapshot, activeWidth: activeAreaWidth }); }} min={0} />
              <NumberField label="Active Height" value={system.activeAreaHeight} onChange={(activeAreaHeight) => { setSystem('activeAreaHeight', activeAreaHeight); setSnapshot({ ...snapshot, activeHeight: activeAreaHeight }); }} min={0} />
              <SelectField label="Unit" value={system.activeAreaUnit} onChange={(activeAreaUnit) => { setSystem('activeAreaUnit', activeAreaUnit); setSnapshot({ ...snapshot, activeAreaUnit }); }} options={LENGTH_UNITS} />
            </div>
            <NumberField label="Matrix X / Columns" value={system.matrixColumns} onChange={(matrixColumns) => { setSystem('matrixColumns', matrixColumns); setSnapshot({ ...snapshot, matrixColumns }); }} min={1} step={1} />
            <NumberField label="Matrix Y / Rows" value={system.matrixRows} onChange={(matrixRows) => { setSystem('matrixRows', matrixRows); setSnapshot({ ...snapshot, matrixRows }); }} min={1} step={1} />
            <div className="grid grid-cols-[minmax(0,1fr)_7.5rem] gap-2">
              <NumberField label="Pixel Size" value={system.pixelSize} onChange={(pixelSize) => { setSystem('pixelSize', pixelSize); setSnapshot({ ...snapshot, pixelSize }); }} min={0} />
              <SelectField label="Unit" value={system.pixelSizeUnit} onChange={(pixelSizeUnit) => { setSystem('pixelSizeUnit', pixelSizeUnit); setSnapshot({ ...snapshot, pixelSizeUnit }); }} options={DETECTOR_LENGTH_UNITS} />
            </div>
            <NumberField label="Bit Depth" value={system.bitDepth} onChange={(bitDepth) => { setSystem('bitDepth', bitDepth); setSnapshot({ ...snapshot, bitDepth }); }} unit="bits" min={1} step={1} />
            <div className="grid grid-cols-[minmax(0,1fr)_7.5rem] gap-2">
              <NumberField label="Detector SRb" value={performance.detectorSrb} onChange={(detectorSrb) => { onPerformanceChange({ ...performance, detectorSrb }); setSnapshot({ ...snapshot, detectorSrb }); }} min={0} />
              <SelectField label="Unit" value={performance.detectorSrbUnit} onChange={(detectorSrbUnit) => { onPerformanceChange({ ...performance, detectorSrbUnit }); setSnapshot({ ...snapshot, detectorSrbUnit }); }} options={DETECTOR_LENGTH_UNITS} />
            </div>
            <div className="grid grid-cols-[minmax(0,1fr)_7.5rem] gap-2">
              <NumberField label="Image SRb" value={performance.imageSrb} onChange={(imageSrb) => onPerformanceChange({ ...performance, imageSrb })} min={0} />
              <SelectField label="Unit" value={performance.imageSrbUnit} onChange={(imageSrbUnit) => onPerformanceChange({ ...performance, imageSrbUnit })} options={DETECTOR_LENGTH_UNITS} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Mode, Orientation &amp; Software</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <TextField
            label="Available Detector Modes"
            value={snapshot.modes.join(', ')}
            onChange={(value) => setSnapshot({ ...snapshot, modes: value.split(',').map((item) => item.trim()).filter(Boolean) })}
            placeholder="Full, Binned 2x2"
          />
          <SelectField
            label="Selected Detector Mode"
            value={selection.detectorMode}
            onChange={(detectorMode) => { onSelectionChange({ ...selection, detectorMode }); setSystem('detectorMode', detectorMode); }}
            options={snapshot.modes}
          />
          <SelectField
            label="Detector Orientation"
            value={selection.orientation}
            onChange={(orientation) => onSelectionChange({ ...selection, orientation })}
            options={[
              { value: 'Portrait', label: 'Portrait' },
              { value: 'Landscape', label: 'Landscape' },
              { value: 'Auto', label: 'Auto optimize (Level III review)' },
            ]}
          />
          <TextField label="Acquisition Software" value={system.softwareName} onChange={(softwareName) => setSystem('softwareName', softwareName)} />
          <TextField label="Software Version" value={system.softwareVersion} onChange={(softwareVersion) => setSystem('softwareVersion', softwareVersion)} />
          <TextField label="Performance Baseline Reference" value={system.performanceBaselineReference} onChange={(performanceBaselineReference) => setSystem('performanceBaselineReference', performanceBaselineReference)} />
          <TextAreaField label="Detector Selection Notes" value={selection.notes} onChange={(notes) => onSelectionChange({ ...selection, notes })} rows={3} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Calibration, Bad-pixel Map &amp; Qualification</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <StatusFields title="Detector Calibration" value={snapshot.calibration} onChange={(value) => updateStatus('calibration', value)} />
          <StatusFields title="Bad-pixel Map" value={snapshot.badPixelMap} onChange={(value) => updateStatus('badPixelMap', value)} />
          <StatusFields title="Qualification" value={snapshot.qualification} onChange={(value) => updateStatus('qualification', value)} />
          <StatusFields
            title="Stability Check"
            value={catalogStatusFromReference(performance.stability)}
            onChange={(value) => onPerformanceChange({ ...performance, stability: { ...value } })}
          />
        </CardContent>
      </Card>
    </div>
  );
};
