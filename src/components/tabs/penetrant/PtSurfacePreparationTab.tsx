import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { PtSurfacePreparation } from '@/types/penetrant';
import { SelectField } from '@/components/tabs/shared/FieldRow';

interface Props {
  data: PtSurfacePreparation;
  onChange: (d: PtSurfacePreparation) => void;
}

export const PtSurfacePreparationTab = ({ data, onChange }: Props) => {
  const set = <K extends keyof PtSurfacePreparation>(k: K, v: PtSurfacePreparation[K]) =>
    onChange({ ...data, [k]: v });

  return (
    <Card>
      <CardHeader>
        <CardTitle>3. Surface Preparation</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <SelectField label="Cleaning Method" value={data.cleaningMethod} onChange={v => set('cleaningMethod', v)} options={['Solvent', 'Alkaline']} />
        <SelectField label="Surface Condition" value={data.surfaceCondition} onChange={v => set('surfaceCondition', v)} options={['As-welded', 'Machined']} />
        <SelectField label="Drying Method" value={data.dryingMethod} onChange={v => set('dryingMethod', v)} options={['Air', 'Oven']} />
      </CardContent>
    </Card>
  );
};
