import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { PtPostCleaning } from '@/types/penetrant';
import { TextAreaField } from '@/components/tabs/shared/FieldRow';

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
        <CardTitle>8. Post-Cleaning Plan</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="md:col-span-2">
          <TextAreaField
            label="Post-Cleaning Instructions"
            value={data.instructions}
            onChange={v => set('instructions', v)}
            placeholder="Specify required cleaning method, sequence, and completion criteria"
            rows={5}
          />
        </div>
        <div className="md:col-span-2">
          <TextAreaField
            label="Corrosion Protection"
            value={data.corrosionProtection}
            onChange={v => set('corrosionProtection', v)}
            placeholder="Specify required protection or state that none is required"
            rows={4}
          />
        </div>
      </CardContent>
    </Card>
  );
};
