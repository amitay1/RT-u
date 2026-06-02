import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { RtDigitalIdentification } from '@/types/rtDigital';
import { DateField, NumberField, SelectField, TextAreaField, TextField } from '@/components/tabs/shared/FieldRow';

interface Props {
  data: RtDigitalIdentification;
  onChange: (d: RtDigitalIdentification) => void;
}

export const RtDigitalIdentificationTab = ({ data, onChange }: Props) => {
  const set = <K extends keyof RtDigitalIdentification>(k: K, v: RtDigitalIdentification[K]) =>
    onChange({ ...data, [k]: v });

  return (
    <Card>
      <CardHeader>
        <CardTitle>8. Identification &amp; Reporting</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <TextField label="Film Number" value={data.filmNumber} onChange={v => set('filmNumber', v)} />
        <NumberField label="Exposure Number" value={data.exposureNumber} onChange={v => set('exposureNumber', v)} />
        <TextField label="Part Identification" value={data.partIdentification} onChange={v => set('partIdentification', v)} />
        <DateField label="Inspection Date" value={data.inspectionDate} onChange={v => set('inspectionDate', v)} />
        <TextField label="Inspector" value={data.inspector} onChange={v => set('inspector', v)} />
        <SelectField label="Result" value={data.result} onChange={v => set('result', v)} options={['Accept', 'Reject']} />
        <TextAreaField label="Remarks" value={data.remarks} onChange={v => set('remarks', v)} />
      </CardContent>
    </Card>
  );
};
