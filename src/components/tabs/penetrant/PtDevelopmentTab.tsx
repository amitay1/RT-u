import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { PtDevelopment } from '@/types/penetrant';
import { NumberField, SelectField } from '@/components/tabs/shared/FieldRow';

interface Props {
  data: PtDevelopment;
  onChange: (d: PtDevelopment) => void;
}

export const PtDevelopmentTab = ({ data, onChange }: Props) => {
  const set = <K extends keyof PtDevelopment>(k: K, v: PtDevelopment[K]) =>
    onChange({ ...data, [k]: v });

  return (
    <Card>
      <CardHeader>
        <CardTitle>5. Development &amp; Indication</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <SelectField label="Developer Application" value={data.developerApplication} onChange={v => set('developerApplication', v)} options={['Spray', 'Dust']} />
        <NumberField label="Development Time" value={data.developmentTime} onChange={v => set('developmentTime', v)} unit="min" step="0.5" />
        <SelectField label="Indication Type" value={data.indicationType} onChange={v => set('indicationType', v)} options={['Linear', 'Rounded']} />
        <NumberField label="Indication Size" value={data.indicationSize} onChange={v => set('indicationSize', v)} unit="mm" step="0.1" />
      </CardContent>
    </Card>
  );
};
