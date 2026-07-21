import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RtDigitalAcquisitionFields } from '@/components/tabs/rt-digital/RtDigitalAcquisitionFields';
import { NumberField, SelectField, TextField } from '@/components/tabs/shared/FieldRow';
import type {
  LengthUnit,
  RtDigitalAcquisitionDefaults,
  RtDigitalSource,
  RtDigitalWorkflow,
} from '@/types/rtDigital';

interface Props {
  workflow: RtDigitalWorkflow;
  onWorkflowChange: (workflow: RtDigitalWorkflow) => void;
  source: RtDigitalSource;
  onSourceChange: (source: RtDigitalSource) => void;
  data: RtDigitalAcquisitionDefaults;
  onChange: (data: RtDigitalAcquisitionDefaults) => void;
}

const LENGTH_UNITS: ReadonlyArray<{ label: string; value: LengthUnit }> = [
  { label: 'mm', value: 'mm' },
  { label: 'inch', value: 'inch' },
];

export const RtDigitalExposureTab = ({
  workflow,
  onWorkflowChange,
  source,
  onSourceChange,
  data,
  onChange,
}: Props) => {
  const setSource = <K extends keyof RtDigitalSource>(key: K, value: RtDigitalSource[K]) => (
    onSourceChange({ ...source, [key]: value })
  );

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>2. Workflow &amp; X-ray Source</CardTitle>
          <p className="text-sm text-muted-foreground">
            Define the static digital acquisition workflow and the controlled X-ray source required by the plan.
          </p>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <SelectField label="Acquisition Workflow" value={workflow} onChange={onWorkflowChange} options={['Static']} />
          <SelectField label="Source Type" value={source.sourceType} onChange={(value) => setSource('sourceType', value)} options={['X-ray']} />
          <TextField label="Manufacturer" value={source.manufacturer} onChange={(value) => setSource('manufacturer', value)} />
          <TextField label="Model" value={source.model} onChange={(value) => setSource('model', value)} />
          <TextField label="Serial Number" value={source.serialNumber} onChange={(value) => setSource('serialNumber', value)} />
          <TextField
            label="Calibration Requirement"
            value={source.calibrationRequirement}
            onChange={(value) => setSource('calibrationRequirement', value)}
            placeholder="Controlled requirement, interval, or qualification reference"
          />
          <div className="grid grid-cols-[minmax(0,1fr)_7.5rem] gap-2">
            <NumberField
              label="Focal Spot Size"
              value={source.focalSpotSize}
              onChange={(value) => setSource('focalSpotSize', value)}
              min={0}
            />
            <SelectField
              label="Unit"
              value={source.focalSpotSizeUnit}
              onChange={(value) => setSource('focalSpotSizeUnit', value)}
              options={LENGTH_UNITS}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Acquisition Defaults</CardTitle>
          <p className="text-sm text-muted-foreground">
            Starting values for new acquisition views. Each view remains independently controlled and editable.
          </p>
        </CardHeader>
        <CardContent>
          <RtDigitalAcquisitionFields
            data={data}
            onChange={(patch) => onChange({ ...data, ...patch })}
          />
        </CardContent>
      </Card>
    </div>
  );
};
