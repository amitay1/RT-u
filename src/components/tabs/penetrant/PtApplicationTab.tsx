import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { PtApplication } from '@/types/penetrant';
import { NumberField, SelectField } from '@/components/tabs/shared/FieldRow';

interface Props {
  data: PtApplication;
  onChange: (d: PtApplication) => void;
}

export const PtApplicationTab = ({ data, onChange }: Props) => {
  const set = <K extends keyof PtApplication>(k: K, v: PtApplication[K]) =>
    onChange({ ...data, [k]: v });

  return (
    <Card>
      <CardHeader>
        <CardTitle>4. Application Process</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <SelectField label="Application Method" value={data.applicationMethod} onChange={v => set('applicationMethod', v)} options={['Spray', 'Dip', 'Brush']} />
        <NumberField label="Dwell Time" value={data.dwellTime} onChange={v => set('dwellTime', v)} unit="min" step="0.5" />
        <SelectField label="Removal Method" value={data.removalMethod} onChange={v => set('removalMethod', v)} options={['Water wash', 'Solvent']} />
        <NumberField label="Rinse Pressure" value={data.rinsePressure} onChange={v => set('rinsePressure', v)} unit="bar" step="0.1" />
        <NumberField label="Rinse Temperature" value={data.rinseTemperature} onChange={v => set('rinseTemperature', v)} unit="°C" step="0.5" />
      </CardContent>
    </Card>
  );
};
