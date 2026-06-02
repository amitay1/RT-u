import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { PtPostCleaning } from '@/types/penetrant';
import { DateField, SelectField, TextField } from '@/components/tabs/shared/FieldRow';

interface Props {
  data: PtPostCleaning;
  onChange: (d: PtPostCleaning) => void;
}

export const PtPostCleaningTab = ({ data, onChange }: Props) => {
  const set = <K extends keyof PtPostCleaning>(k: K, v: PtPostCleaning[K]) =>
    onChange({ ...data, [k]: v });

  return (
    <Card>
      <CardHeader>
        <CardTitle>8. Post Cleaning &amp; Reporting</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <SelectField label="Post Cleaning Method" value={data.postCleaningMethod} onChange={v => set('postCleaningMethod', v)} options={['Water', 'Solvent']} />
        <SelectField label="Result" value={data.result} onChange={v => set('result', v)} options={['Accept', 'Reject']} />
        <TextField label="Inspector" value={data.inspector} onChange={v => set('inspector', v)} />
        <DateField label="Date" value={data.date} onChange={v => set('date', v)} />
      </CardContent>
    </Card>
  );
};
