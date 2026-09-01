import { Plus, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import type {
  RtDigitalDisplayAndStorage,
  RtDigitalImageProcessing,
  RtDigitalProcessingPolicy,
  RtDigitalViewingPreset,
} from '@/types/rtDigital';
import { NumberField, TextAreaField, TextField } from '@/components/tabs/shared/FieldRow';

interface Props {
  data: RtDigitalImageProcessing;
  onChange: (data: RtDigitalImageProcessing) => void;
  displayAndStorage: RtDigitalDisplayAndStorage;
  onDisplayAndStorageChange: (data: RtDigitalDisplayAndStorage) => void;
  processingPolicy: RtDigitalProcessingPolicy;
  viewingPresets: RtDigitalViewingPreset[];
  onProcessingPolicyChange: (data: RtDigitalProcessingPolicy) => void;
  onViewingPresetsChange: (data: RtDigitalViewingPreset[]) => void;
}

const nextPresetId = (presets: RtDigitalViewingPreset[]): string => {
  const used = new Set(presets.map((preset) => preset.id.trim().toUpperCase()));
  let sequence = 1;
  while (used.has(`VP-${sequence.toString().padStart(2, '0')}`)) sequence += 1;
  return `VP-${sequence.toString().padStart(2, '0')}`;
};

const createViewingPreset = (presets: RtDigitalViewingPreset[]): RtDigitalViewingPreset => {
  const id = nextPresetId(presets);
  return {
    id,
    name: id,
    windowLevel: '',
    windowWidth: '',
    zoom: '',
    sharpness: '',
    permittedProcessing: '',
    lut: '',
    invert: false,
  };
};

export const RtDigitalImageProcessingTab = ({
  data,
  onChange,
  displayAndStorage,
  onDisplayAndStorageChange,
  processingPolicy,
  viewingPresets,
  onProcessingPolicyChange,
  onViewingPresetsChange,
}: Props) => {
  const setProcessing = <K extends keyof RtDigitalImageProcessing>(
    key: K,
    value: RtDigitalImageProcessing[K],
  ) => onChange({ ...data, [key]: value });

  const setDisplayAndStorage = <K extends keyof RtDigitalDisplayAndStorage>(
    key: K,
    value: RtDigitalDisplayAndStorage[K],
  ) => onDisplayAndStorageChange({ ...displayAndStorage, [key]: value });

  const updatePreset = (id: string, patch: Partial<RtDigitalViewingPreset>) => {
    onViewingPresetsChange(viewingPresets.map((preset) => preset.id === id ? { ...preset, ...patch } : preset));
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>09. Image Processing</CardTitle>
          <p className="note-clamp text-sm text-muted-foreground">
            Define the permitted review settings and controlled processing procedure without recording achieved results.
          </p>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <NumberField label="Window Level" value={data.windowLevel} onChange={(value) => setProcessing('windowLevel', value)} />
          <NumberField label="Window Width" value={data.windowWidth} onChange={(value) => setProcessing('windowWidth', value)} min={0} />
          <NumberField label="Zoom" value={data.zoom} onChange={(value) => setProcessing('zoom', value)} unit="%" min={0} />
          <TextField
            label="Noise Reduction"
            value={data.noiseReduction}
            onChange={(value) => setProcessing('noiseReduction', value)}
            placeholder="Permitted method or setting"
          />
          <TextField
            label="Contrast Enhancement"
            value={data.contrastEnhancement}
            onChange={(value) => setProcessing('contrastEnhancement', value)}
            placeholder="Permitted method or setting"
          />
          <TextField
            label="Processing Procedure"
            value={data.processingProcedure}
            onChange={(value) => setProcessing('processingProcedure', value)}
            placeholder="Controlled procedure and revision"
          />
          <TextAreaField
            label="Permitted Processing"
            value={processingPolicy.permittedProcessing}
            onChange={(permittedProcessing) => onProcessingPolicyChange({ ...processingPolicy, permittedProcessing })}
            placeholder="Explicitly permitted processing, filters, and limits"
            rows={4}
          />
          <TextAreaField
            label="Prohibited Processing"
            value={processingPolicy.prohibitedProcessing}
            onChange={(prohibitedProcessing) => onProcessingPolicyChange({ ...processingPolicy, prohibitedProcessing })}
            placeholder="Processing operations that must not be used"
            rows={4}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="gap-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="text-base">Viewing Preset Library</CardTitle>
              <p className="note-clamp mt-1 text-sm text-muted-foreground">
                Create reusable planned settings. Stable VP identifiers can be assigned to individual interpretation areas.
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              onClick={() => onViewingPresetsChange([...viewingPresets, createViewingPreset(viewingPresets)])}
            >
              <Plus className="h-4 w-4" /> Add Preset
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {viewingPresets.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
              No viewing presets defined.
            </div>
          ) : viewingPresets.map((preset) => (
            <article key={preset.id} className="space-y-4 rounded-xl border border-border/80 bg-background p-4">
              <div className="flex items-center justify-between gap-3">
                <Badge variant="secondary">{preset.id}</Badge>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="text-destructive hover:text-destructive"
                  aria-label={`Delete viewing preset ${preset.id}`}
                  onClick={() => onViewingPresetsChange(viewingPresets.filter((candidate) => candidate.id !== preset.id))}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
                <TextField label="Preset Name" value={preset.name} onChange={(name) => updatePreset(preset.id, { name })} />
                <NumberField label="Window Level" value={preset.windowLevel} onChange={(windowLevel) => updatePreset(preset.id, { windowLevel })} />
                <NumberField label="Window Width" value={preset.windowWidth} onChange={(windowWidth) => updatePreset(preset.id, { windowWidth })} min={0} />
                <NumberField label="Zoom" value={preset.zoom} onChange={(zoom) => updatePreset(preset.id, { zoom })} unit="%" min={0} />
                <TextField label="Sharpness" value={preset.sharpness} onChange={(sharpness) => updatePreset(preset.id, { sharpness })} />
                <TextField label="Processing / Filter" value={preset.permittedProcessing} onChange={(permittedProcessing) => updatePreset(preset.id, { permittedProcessing })} />
                <TextField label="LUT" value={preset.lut} onChange={(lut) => updatePreset(preset.id, { lut })} />
                <div className="flex min-h-16 items-center gap-3 rounded-lg border border-border/70 bg-muted/15 px-3">
                  <Switch
                    id={`preset-invert-${preset.id}`}
                    checked={preset.invert}
                    onCheckedChange={(invert) => updatePreset(preset.id, { invert })}
                  />
                  <Label htmlFor={`preset-invert-${preset.id}`}>Invert permitted</Label>
                </div>
              </div>
            </article>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Display &amp; Review System</CardTitle>
          <p className="text-sm text-muted-foreground">
            Identify the qualified display and viewer configuration required to review the images.
          </p>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <TextField
            label="Display Manufacturer"
            value={displayAndStorage.displayManufacturer}
            onChange={(value) => setDisplayAndStorage('displayManufacturer', value)}
          />
          <TextField
            label="Display Model"
            value={displayAndStorage.displayModel}
            onChange={(value) => setDisplayAndStorage('displayModel', value)}
          />
          <TextField
            label="Display Serial Number"
            value={displayAndStorage.displaySerialNumber}
            onChange={(value) => setDisplayAndStorage('displaySerialNumber', value)}
          />
          <TextField
            label="Viewer Software"
            value={displayAndStorage.viewerSoftware}
            onChange={(value) => setDisplayAndStorage('viewerSoftware', value)}
          />
          <TextField
            label="Viewer Software Version"
            value={displayAndStorage.viewerSoftwareVersion}
            onChange={(value) => setDisplayAndStorage('viewerSoftwareVersion', value)}
          />
          <TextField
            label="Display Qualification Reference"
            value={displayAndStorage.displayQualificationReference}
            onChange={(value) => setDisplayAndStorage('displayQualificationReference', value)}
            placeholder="Controlled qualification record"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Storage, Archive &amp; Raw Data</CardTitle>
          <p className="note-clamp text-sm text-muted-foreground">
            Define the planned record format, archive controls, retention, and preservation of original detector data.
          </p>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <TextField
            label="Storage Format"
            value={displayAndStorage.storageFormat}
            onChange={(value) => setDisplayAndStorage('storageFormat', value)}
            placeholder="Controlled format or format set"
          />
          <TextField
            label="Archive Location"
            value={displayAndStorage.archiveLocation}
            onChange={(value) => setDisplayAndStorage('archiveLocation', value)}
          />
          <TextField
            label="Retention Period"
            value={displayAndStorage.retentionPeriod}
            onChange={(value) => setDisplayAndStorage('retentionPeriod', value)}
          />
          <TextField
            label="DICONDE Profile Reference"
            value={displayAndStorage.dicondeProfileReference}
            onChange={(value) => setDisplayAndStorage('dicondeProfileReference', value)}
            placeholder="Applicable profile, procedure, or project reference"
            hint="free-text reference, not a compliance selection"
          />
          <TextAreaField
            label="Raw Data Preservation"
            value={displayAndStorage.rawDataPreservation}
            onChange={(value) => setDisplayAndStorage('rawDataPreservation', value)}
            placeholder="Required preservation, access, and change-control instructions"
            rows={4}
          />
        </CardContent>
      </Card>
    </div>
  );
};
