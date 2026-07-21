import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { DetectorLengthUnit, LengthUnit, RtDigitalSystem } from '@/types/rtDigital';
import { NumberField, SelectField, TextField } from '@/components/tabs/shared/FieldRow';

interface Props {
  data: RtDigitalSystem;
  onChange: (data: RtDigitalSystem) => void;
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

export const RtDigitalSystemTab = ({ data, onChange }: Props) => {
  const set = <K extends keyof RtDigitalSystem>(key: K, value: RtDigitalSystem[K]) => (
    onChange({ ...data, [key]: value })
  );

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>3. Digital Detector System</CardTitle>
          <p className="text-sm text-muted-foreground">
            Identify the qualified DDA configuration and the detector characteristics required by the technique.
          </p>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <TextField label="DDA Type" value={data.ddaType} onChange={(value) => set('ddaType', value)} placeholder="Qualified detector technology or configuration" />
          <TextField label="Manufacturer" value={data.manufacturer} onChange={(value) => set('manufacturer', value)} />
          <TextField label="Model" value={data.model} onChange={(value) => set('model', value)} />
          <TextField label="Serial Number" value={data.serialNumber} onChange={(value) => set('serialNumber', value)} />
          <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_7.5rem] gap-2 md:col-span-2">
            <NumberField label="Active Area Width" value={data.activeAreaWidth} onChange={(value) => set('activeAreaWidth', value)} min={0} />
            <NumberField label="Active Area Height" value={data.activeAreaHeight} onChange={(value) => set('activeAreaHeight', value)} min={0} />
            <SelectField label="Unit" value={data.activeAreaUnit} onChange={(value) => set('activeAreaUnit', value)} options={LENGTH_UNITS} />
          </div>
          <NumberField label="Matrix Columns" value={data.matrixColumns} onChange={(value) => set('matrixColumns', value)} min={1} step={1} />
          <NumberField label="Matrix Rows" value={data.matrixRows} onChange={(value) => set('matrixRows', value)} min={1} step={1} />
          <div className="grid grid-cols-[minmax(0,1fr)_7.5rem] gap-2">
            <NumberField label="Pixel Size" value={data.pixelSize} onChange={(value) => set('pixelSize', value)} min={0} step="0.1" />
            <SelectField label="Unit" value={data.pixelSizeUnit} onChange={(value) => set('pixelSizeUnit', value)} options={DETECTOR_LENGTH_UNITS} />
          </div>
          <NumberField label="Bit Depth" value={data.bitDepth} onChange={(value) => set('bitDepth', value)} unit="bits" min={1} step={1} />
          <TextField label="Detector Mode" value={data.detectorMode} onChange={(value) => set('detectorMode', value)} placeholder="Full, binned, or qualified mode" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Software &amp; Qualification Basis</CardTitle>
          <p className="text-sm text-muted-foreground">
            Reference the software configuration and controlled evidence used to qualify the planned system.
          </p>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <TextField label="Acquisition Software" value={data.softwareName} onChange={(value) => set('softwareName', value)} />
          <TextField label="Software Version" value={data.softwareVersion} onChange={(value) => set('softwareVersion', value)} />
          <TextField
            label="System Qualification Reference"
            value={data.systemQualificationReference}
            onChange={(value) => set('systemQualificationReference', value)}
            placeholder="Controlled report, procedure, or record"
          />
          <TextField
            label="Performance Baseline Reference"
            value={data.performanceBaselineReference}
            onChange={(value) => set('performanceBaselineReference', value)}
            placeholder="Applicable baseline or qualification record"
          />
        </CardContent>
      </Card>
    </div>
  );
};
