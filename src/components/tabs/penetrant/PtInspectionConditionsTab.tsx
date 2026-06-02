import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { PtInspectionConditions } from '@/types/penetrant';
import { NumberField, SelectField } from '@/components/tabs/shared/FieldRow';

interface Props {
  data: PtInspectionConditions;
  onChange: (d: PtInspectionConditions) => void;
}

export const PtInspectionConditionsTab = ({ data, onChange }: Props) => {
  const set = <K extends keyof PtInspectionConditions>(k: K, v: PtInspectionConditions[K]) =>
    onChange({ ...data, [k]: v });

  return (
    <Card>
      <CardHeader>
        <CardTitle>6. Inspection Conditions</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <SelectField label="Light Type" value={data.lightType} onChange={v => set('lightType', v)} options={['UV', 'White']} />
        <NumberField label="UV Intensity" value={data.uvIntensity} onChange={v => set('uvIntensity', v)} unit="µW/cm²" />
        <NumberField label="White Light" value={data.whiteLight} onChange={v => set('whiteLight', v)} unit="lux" />
      </CardContent>
    </Card>
  );
};
