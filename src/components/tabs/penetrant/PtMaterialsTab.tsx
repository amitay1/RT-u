import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { PtMaterials } from '@/types/penetrant';
import { SelectField } from '@/components/tabs/shared/FieldRow';

interface Props {
  data: PtMaterials;
  onChange: (d: PtMaterials) => void;
}

export const PtMaterialsTab = ({ data, onChange }: Props) => {
  const set = <K extends keyof PtMaterials>(k: K, v: PtMaterials[K]) =>
    onChange({ ...data, [k]: v });

  return (
    <Card>
      <CardHeader>
        <CardTitle>2. Materials</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <SelectField
          label="Penetrant Type"
          value={data.penetrantType}
          onChange={v => set('penetrantType', v)}
          options={['Type I', 'Type II']}
        />
        <SelectField
          label="Method"
          value={data.method}
          onChange={v => set('method', v)}
          options={['A', 'B', 'C', 'D']}
        />
        <SelectField
          label="Sensitivity Level"
          value={data.sensitivityLevel}
          onChange={v => set('sensitivityLevel', v)}
          options={['1', '2', '3', '4']}
        />
        <SelectField
          label="Developer Type"
          value={data.developerType}
          onChange={v => set('developerType', v)}
          options={['Dry', 'Water', 'Non-aqueous']}
        />
        <SelectField
          label="Cleaner Type"
          value={data.cleanerType}
          onChange={v => set('cleanerType', v)}
          options={['Solvent', 'Water']}
        />
      </CardContent>
    </Card>
  );
};
