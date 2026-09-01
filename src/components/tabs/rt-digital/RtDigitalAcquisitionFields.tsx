import { useId } from 'react';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  NumberField,
  SelectField,
  TextAreaField,
  TextField,
} from '@/components/tabs/shared/FieldRow';
import type {
  DigitalTimeUnit,
  LengthUnit,
  RtDigitalAcquisitionDefaults,
} from '@/types/rtDigital';

interface RtDigitalAcquisitionFieldsProps {
  data: RtDigitalAcquisitionDefaults;
  onChange: (patch: Partial<RtDigitalAcquisitionDefaults>) => void;
}

const LENGTH_UNITS: ReadonlyArray<{ label: string; value: LengthUnit }> = [
  { label: 'mm', value: 'mm' },
  { label: 'inch', value: 'inch' },
];

const TIME_UNITS: ReadonlyArray<{ label: string; value: Exclude<DigitalTimeUnit, ''> }> = [
  { label: 'milliseconds', value: 'ms' },
  { label: 'seconds', value: 's' },
  { label: 'minutes', value: 'min' },
];

export function RtDigitalAcquisitionFields({ data, onChange }: RtDigitalAcquisitionFieldsProps) {
  const magnificationId = useId();
  const set = <K extends keyof RtDigitalAcquisitionDefaults>(
    key: K,
    value: RtDigitalAcquisitionDefaults[K],
  ) => onChange({ [key]: value } as Pick<RtDigitalAcquisitionDefaults, K>);

  const lengthPair = (
    label: string,
    valueKey: 'sdd' | 'sod' | 'odd' | 'requiredUg',
    unitKey: 'sddUnit' | 'sodUnit' | 'oddUnit' | 'requiredUgUnit',
  ) => (
    <div className="grid grid-cols-[minmax(0,1fr)_7.5rem] gap-2">
      <NumberField
        label={label}
        value={data[valueKey]}
        onChange={(value) => set(valueKey, value)}
        unit={data[unitKey]}
        min={0}
      />
      <SelectField
        label="Unit"
        value={data[unitKey]}
        onChange={(value) => set(unitKey, value)}
        options={LENGTH_UNITS}
      />
    </div>
  );

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Geometry &amp; image quality limits</h3>
          <p className="note-clamp text-xs text-muted-foreground">
            Define the planned source, part, and detector geometry. Each acquisition remains independently controlled.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <SelectField
            label="Image Technique (Exposure)"
            value={data.wallTechnique}
            onChange={(value) => set('wallTechnique', value)}
            options={['SWSI', 'DWSI', 'DWDI']}
            hint="legacy exposure image technique; Elliptical/Other are controlled once in Section 01"
          />
          {lengthPair('SDD (Source-to-Detector Distance)', 'sdd', 'sddUnit')}
          {lengthPair('SOD (Source-to-Object Distance)', 'sod', 'sodUnit')}
          {lengthPair('ODD (Object-to-Detector Distance)', 'odd', 'oddUnit')}
          <div className="rounded-xl border border-border/70 bg-muted/20 p-3">
            <div className="mb-3 flex items-center gap-3">
              <Switch
                id={magnificationId}
                checked={data.magnificationAuto}
                onCheckedChange={(checked) => set('magnificationAuto', checked)}
              />
              <Label htmlFor={magnificationId} className="text-sm font-medium">
                Calculate magnification from distances
              </Label>
            </div>
            <NumberField
              label="Geometric Magnification"
              value={data.magnification}
              onChange={(value) => set('magnification', value)}
              unit={data.magnificationAuto ? 'computed' : 'manual'}
              step="0.001"
              min={0}
              disabled={data.magnificationAuto}
            />
          </div>
          <TextField
            label="Thickness Description"
            value={data.thicknessDescription}
            onChange={(value) => set('thicknessDescription', value)}
            placeholder="Describe the radiographic thickness path"
          />
          <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_7.5rem] gap-2 md:col-span-2">
            <NumberField label="Thickness Min" value={data.thicknessMin} onChange={(value) => set('thicknessMin', value)} min={0} />
            <NumberField label="Thickness Max" value={data.thicknessMax} onChange={(value) => set('thicknessMax', value)} min={0} />
            <SelectField label="Unit" value={data.thicknessUnit} onChange={(value) => set('thicknessUnit', value)} options={LENGTH_UNITS} />
          </div>
          {lengthPair('Required Geometric Unsharpness (Ug)', 'requiredUg', 'requiredUgUnit')}
          <TextField
            label="IQI Override"
            value={data.iqiOverride}
            onChange={(value) => set('iqiOverride', value)}
            placeholder="Leave blank to use the technique IQI plan"
          />
        </div>
      </section>

      <section className="space-y-3 border-t border-border/70 pt-5">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Exposure &amp; frame acquisition</h3>
          <p className="note-clamp text-xs text-muted-foreground">
            Planned generator and frame settings only; record performed values in the inspection record.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <NumberField
            label="Tube Voltage"
            value={data.tubeVoltage}
            onChange={(value) => set('tubeVoltage', value)}
            unit={data.tubeVoltageUnit}
            min={0}
          />
          <NumberField
            label="Tube Current"
            value={data.tubeCurrent}
            onChange={(value) => set('tubeCurrent', value)}
            unit={data.tubeCurrentUnit}
            min={0}
          />
          <div className="grid grid-cols-[minmax(0,1fr)_7.5rem] gap-2">
            <NumberField label="Exposure Time" value={data.exposureTime} onChange={(value) => set('exposureTime', value)} min={0} />
            <SelectField
              label="Unit"
              value={data.exposureTimeUnit}
              onChange={(value) => set('exposureTimeUnit', value)}
              options={TIME_UNITS}
            />
          </div>
          <div className="grid grid-cols-[minmax(0,1fr)_7.5rem] gap-2">
            <NumberField label="Integration Time" value={data.integrationTime} onChange={(value) => set('integrationTime', value)} min={0} />
            <SelectField
              label="Unit"
              value={data.integrationTimeUnit}
              onChange={(value) => set('integrationTimeUnit', value)}
              options={TIME_UNITS}
            />
          </div>
          <NumberField label="Frame Count" value={data.frameCount} onChange={(value) => set('frameCount', value)} min={1} step={1} />
          <NumberField label="Frames Averaged" value={data.framesAveraged} onChange={(value) => set('framesAveraged', value)} min={1} step={1} />
          <NumberField
            label="Frame Rate"
            value={data.frameRate ?? ''}
            onChange={(value) => set('frameRate', value)}
            unit="fps"
            min={0}
            step="0.1"
          />
          <TextField label="Filter" value={data.filter} onChange={(value) => set('filter', value)} placeholder="Material and thickness" />
          <TextField
            label="Collimation"
            value={data.collimation}
            onChange={(value) => set('collimation', value)}
            placeholder="Planned field, masking, and beam restriction"
          />
        </div>
      </section>

      <section className="space-y-3 border-t border-border/70 pt-5">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Coverage, traceability &amp; records</h3>
          <p className="note-clamp text-xs text-muted-foreground">
            State the planned coverage and the instructions needed to identify and retain each acquisition.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <TextField
            label="Required Coverage"
            value={data.coverage}
            onChange={(value) => set('coverage', value)}
            placeholder="Extent, overlap, or controlled instruction"
          />
          <TextField
            label="Image Naming Scheme"
            value={data.imageNaming}
            onChange={(value) => set('imageNaming', value)}
            placeholder="Planned file and image identifiers"
          />
          <TextAreaField
            label="Marking Instructions"
            value={data.markingInstructions}
            onChange={(value) => set('markingInstructions', value)}
            rows={3}
          />
          <TextAreaField label="Acquisition Notes" value={data.notes} onChange={(value) => set('notes', value)} rows={3} />
        </div>
      </section>
    </div>
  );
}
