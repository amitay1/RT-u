import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { PtAcceptance } from '@/types/penetrant';
import { NumberField, TextField } from '@/components/tabs/shared/FieldRow';

interface Props {
  data: PtAcceptance;
  onChange: (d: PtAcceptance) => void;
}

export const PtAcceptanceTab = ({ data, onChange }: Props) => {
  const set = <K extends keyof PtAcceptance>(k: K, v: PtAcceptance[K]) =>
    onChange({ ...data, [k]: v });

  return (
    <Card>
      <CardHeader>
        <CardTitle>7. Acceptance Criteria</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <TextField label="Acceptance Standard" value={data.acceptanceStandard} onChange={v => set('acceptanceStandard', v)} placeholder="e.g. ASTM E1417" />
        <NumberField label="Linear Indications" value={data.linearIndications} onChange={v => set('linearIndications', v)} unit="mm" step="0.1" />
        <NumberField label="Rounded Indications" value={data.roundedIndications} onChange={v => set('roundedIndications', v)} unit="mm" step="0.1" />
      </CardContent>
    </Card>
  );
};
