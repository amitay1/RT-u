import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import type { RtDigitalExposureSetup } from '@/types/rtDigital';
import { NumberField, SelectField, TextField } from '@/components/tabs/shared/FieldRow';

interface Props {
  data: RtDigitalExposureSetup;
  onChange: (d: RtDigitalExposureSetup) => void;
}

export const RtDigitalExposureTab = ({ data, onChange }: Props) => {
  const set = <K extends keyof RtDigitalExposureSetup>(k: K, v: RtDigitalExposureSetup[K]) =>
    onChange({ ...data, [k]: v });

  return (
    <Card>
      <CardHeader>
        <CardTitle>2. Exposure Setup</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <SelectField label="Radiation Type" value={data.radiationType} onChange={v => set('radiationType', v)} options={['X-ray', 'Gamma']} />
        <NumberField label="Tube Voltage" value={data.tubeVoltage} onChange={v => set('tubeVoltage', v)} unit="kV" />
        <NumberField label="Tube Current" value={data.tubeCurrent} onChange={v => set('tubeCurrent', v)} unit="mA" />
        <NumberField label="Exposure Time" value={data.exposureTime} onChange={v => set('exposureTime', v)} unit="sec" step="0.1" />
        <NumberField label="Frame Rate" value={data.frameRate} onChange={v => set('frameRate', v)} unit="fps" step="0.1" />
        <NumberField label="Frames Averaged" value={data.framesAveraged} onChange={v => set('framesAveraged', v)} />
        <NumberField label="SDD" value={data.sdd} onChange={v => set('sdd', v)} unit="mm" />
        <NumberField label="SOD" value={data.sod} onChange={v => set('sod', v)} unit="mm" />
        <NumberField label="ODD" value={data.odd} onChange={v => set('odd', v)} unit="mm" />
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-3">
            <Switch
              id="mag-auto"
              checked={data.magnificationAuto}
              onCheckedChange={(c: boolean) => set('magnificationAuto', c)}
            />
            <Label htmlFor="mag-auto" className="text-sm font-medium">Magnification — Auto</Label>
          </div>
          <NumberField label="Magnification" value={data.magnification} onChange={v => set('magnification', v)} unit={data.magnificationAuto ? 'computed' : 'manual'} step="0.01" />
        </div>
        <NumberField label="Focal Spot Size" value={data.focalSpotSize} onChange={v => set('focalSpotSize', v)} unit="mm" step="0.01" />
        <TextField label="Filters" value={data.filters} onChange={v => set('filters', v)} placeholder="e.g. 0.5mm Cu" />
        <NumberField label="Coverage" value={data.coverage} onChange={v => set('coverage', v)} unit="%" min={0} max={100} />
      </CardContent>
    </Card>
  );
};
