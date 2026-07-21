import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { PtApprovedProduct, PtMaterials } from '@/types/penetrant';
import { SelectField, TextField } from '@/components/tabs/shared/FieldRow';

interface Props {
  data: PtMaterials;
  onChange: (d: PtMaterials) => void;
}

interface ApprovedProductFieldsProps {
  title: string;
  data: PtApprovedProduct;
  onChange: (data: PtApprovedProduct) => void;
}

const ApprovedProductFields = ({ title, data, onChange }: ApprovedProductFieldsProps) => (
  <Card className="shadow-none">
    <CardHeader className="pb-3">
      <CardTitle className="text-base">{title}</CardTitle>
    </CardHeader>
    <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <TextField
        label="Manufacturer"
        value={data.manufacturer}
        onChange={manufacturer => onChange({ ...data, manufacturer })}
      />
      <TextField
        label="Product Designation"
        value={data.designation}
        onChange={designation => onChange({ ...data, designation })}
      />
    </CardContent>
  </Card>
);

export const PtMaterialsTab = ({ data, onChange }: Props) => {
  const set = <K extends keyof PtMaterials>(k: K, v: PtMaterials[K]) =>
    onChange({ ...data, [k]: v });

  return (
    <Card>
      <CardHeader>
        <CardTitle>2. Materials</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <SelectField
            label="Penetrant Type"
            value={data.penetrantType}
            onChange={penetrantType => onChange({
              ...data,
              penetrantType,
              ...(penetrantType === 'Type II' ? { sensitivityLevel: '' as const } : {}),
            })}
            options={[
              { label: 'Type I — Fluorescent', value: 'Type I' },
              { label: 'Type II — Visible', value: 'Type II' },
            ]}
          />
          <SelectField
            label="Removal Method"
            value={data.method}
            onChange={v => set('method', v)}
            options={[
              { label: 'Method A — Water-washable', value: 'A' },
              { label: 'Method B — Post-emulsifiable, lipophilic', value: 'B' },
              { label: 'Method C — Solvent-removable', value: 'C' },
              { label: 'Method D — Post-emulsifiable, hydrophilic', value: 'D' },
            ]}
          />
          {data.penetrantType === 'Type I' ? (
            <SelectField
              label="Fluorescent Sensitivity Level"
              value={data.sensitivityLevel}
              onChange={v => set('sensitivityLevel', v)}
              options={['1/2', '1', '2', '3', '4']}
            />
          ) : null}
          <TextField
            label="Approved System Family"
            value={data.systemFamily}
            onChange={v => set('systemFamily', v)}
            placeholder="Qualified product family or system"
          />
          <TextField
            label="Qualification Reference"
            value={data.qualificationReference}
            onChange={v => set('qualificationReference', v)}
            placeholder="Applicable QPL / approval reference"
          />
          <TextField
            label="Developer Form"
            value={data.developerForm}
            onChange={v => set('developerForm', v)}
            placeholder="Specified developer form"
          />
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <ApprovedProductFields title="Penetrant" data={data.penetrant} onChange={v => set('penetrant', v)} />
          <ApprovedProductFields title="Cleaner" data={data.cleaner} onChange={v => set('cleaner', v)} />
          <ApprovedProductFields title="Remover" data={data.remover} onChange={v => set('remover', v)} />
          <ApprovedProductFields title="Emulsifier" data={data.emulsifier} onChange={v => set('emulsifier', v)} />
          <ApprovedProductFields title="Developer" data={data.developer} onChange={v => set('developer', v)} />
        </div>
      </CardContent>
    </Card>
  );
};
