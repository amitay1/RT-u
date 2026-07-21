import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { PtDevelopment, TimeUnit } from '@/types/penetrant';
import { NumberField, SelectField, TextAreaField, TextField } from '@/components/tabs/shared/FieldRow';

interface Props {
  data: PtDevelopment;
  onChange: (d: PtDevelopment) => void;
}

const TIME_UNIT_OPTIONS = [
  { label: 'seconds', value: 's' },
  { label: 'minutes', value: 'min' },
] as const;

export const PtDevelopmentTab = ({ data, onChange }: Props) => {
  const set = <K extends keyof PtDevelopment>(k: K, v: PtDevelopment[K]) =>
    onChange({ ...data, [k]: v });

  return (
    <Card>
      <CardHeader>
        <CardTitle>5. Development Plan</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <TextField
          label="Planned Developer Application"
          value={data.developerApplication}
          onChange={v => set('developerApplication', v)}
          placeholder="Specify application method"
        />
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_120px]">
          <NumberField
            label="Required Development Time"
            value={data.developmentTime}
            onChange={v => set('developmentTime', v)}
            unit={data.developmentTimeUnit}
            min={0}
          />
          <SelectField
            label="Unit"
            value={data.developmentTimeUnit}
            onChange={(v: TimeUnit) => set('developmentTimeUnit', v)}
            options={TIME_UNIT_OPTIONS}
          />
        </div>
        <div className="md:col-span-2">
          <TextAreaField
            label="Development Instructions"
            value={data.instructions}
            onChange={v => set('instructions', v)}
            placeholder="Specify coverage, coating, drying, and timing requirements"
          />
        </div>
      </CardContent>
    </Card>
  );
};
