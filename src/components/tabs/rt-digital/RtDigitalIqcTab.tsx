import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { RtDigitalIqc } from '@/types/rtDigital';
import { NumberField, SelectField } from '@/components/tabs/shared/FieldRow';

interface Props {
  data: RtDigitalIqc;
  onChange: (d: RtDigitalIqc) => void;
}

export const RtDigitalIqcTab = ({ data, onChange }: Props) => {
  const set = <K extends keyof RtDigitalIqc>(k: K, v: RtDigitalIqc[K]) =>
    onChange({ ...data, [k]: v });

  return (
    <Card>
      <CardHeader>
        <CardTitle>6. Image Quality Control</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <SelectField label="IQI Type" value={data.iqiType} onChange={v => set('iqiType', v)} options={['Wire', 'Hole']} />
        <SelectField label="IQI Standard" value={data.iqiStandard} onChange={v => set('iqiStandard', v)} options={['ASTM E747', 'ASTM E1025']} />
        <SelectField label="Required Sensitivity" value={data.requiredSensitivity} onChange={v => set('requiredSensitivity', v)} options={['1-1T', '2-2T']} />
        <NumberField label="CNR" value={data.cnr} onChange={v => set('cnr', v)} step="0.1" />
      </CardContent>
    </Card>
  );
};
