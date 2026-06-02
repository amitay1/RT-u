import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { RtDigitalSystemConfig } from '@/types/rtDigital';
import { NumberField, SelectField, TextField } from '@/components/tabs/shared/FieldRow';

interface Props {
  data: RtDigitalSystemConfig;
  onChange: (d: RtDigitalSystemConfig) => void;
}

export const RtDigitalSystemTab = ({ data, onChange }: Props) => {
  const set = <K extends keyof RtDigitalSystemConfig>(k: K, v: RtDigitalSystemConfig[K]) =>
    onChange({ ...data, [k]: v });

  return (
    <Card>
      <CardHeader>
        <CardTitle>3. System Configuration</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <SelectField label="DDA Type" value={data.ddaType} onChange={v => set('ddaType', v)} options={['Flat Panel', 'CCD', 'CMOS']} />
        <TextField label="Manufacturer" value={data.manufacturer} onChange={v => set('manufacturer', v)} />
        <TextField label="Model" value={data.model} onChange={v => set('model', v)} />
        <NumberField label="Pixel Size" value={data.pixelSize} onChange={v => set('pixelSize', v)} unit="µm" step="0.1" />
        <SelectField label="Detector Mode" value={data.detectorMode} onChange={v => set('detectorMode', v)} options={['Full', 'Binned']} />
        <NumberField label="Gain Setting" value={data.gainSetting} onChange={v => set('gainSetting', v)} step="0.1" />
        <SelectField label="Calibration Status" value={data.calibrationStatus} onChange={v => set('calibrationStatus', v)} options={['Valid', 'Expired']} />
      </CardContent>
    </Card>
  );
};
