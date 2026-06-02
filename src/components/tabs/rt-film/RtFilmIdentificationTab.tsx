import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { RtFilmIdentification } from '@/types/rtFilm';
import { DateField, NumberField, SelectField, TextAreaField, TextField } from '@/components/tabs/shared/FieldRow';

interface Props {
  data: RtFilmIdentification;
  onChange: (d: RtFilmIdentification) => void;
}

export const RtFilmIdentificationTab = ({ data, onChange }: Props) => {
  const set = <K extends keyof RtFilmIdentification>(k: K, v: RtFilmIdentification[K]) =>
    onChange({ ...data, [k]: v });

  return (
    <Card>
      <CardHeader>
        <CardTitle>7. Identification &amp; Reporting</CardTitle>
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
