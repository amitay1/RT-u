import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { RtFilmFilmSystem } from '@/types/rtFilm';
import { NumberField, SelectField, TextField } from '@/components/tabs/shared/FieldRow';

interface Props {
  data: RtFilmFilmSystem;
  onChange: (d: RtFilmFilmSystem) => void;
}

export const RtFilmFilmSystemTab = ({ data, onChange }: Props) => {
  const set = <K extends keyof RtFilmFilmSystem>(k: K, v: RtFilmFilmSystem[K]) =>
    onChange({ ...data, [k]: v });

  return (
    <Card>
      <CardHeader>
        <CardTitle>4. Film System</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <TextField label="Film Type" value={data.filmType} onChange={v => set('filmType', v)} placeholder="Per manufacturer" />
        <SelectField
          label="Film Class"
          value={data.filmClass}
          onChange={v => set('filmClass', v)}
          options={[
            { label: 'Class I', value: 'I' },
            { label: 'Class II', value: 'II' },
            { label: 'Class III', value: 'III' },
          ]}
        />
        <SelectField
          label="Screen Type"
          value={data.screenType}
          onChange={v => set('screenType', v)}
          options={['Lead', 'None']}
        />
        <NumberField label="Screen Thickness" value={data.screenThickness} onChange={v => set('screenThickness', v)} unit="mm" step="0.01" />
        <SelectField
          label="Cassette Type"
          value={data.cassetteType}
          onChange={v => set('cassetteType', v)}
          options={['Flexible', 'Rigid']}
        />
        <SelectField
          label="Processing Method"
          value={data.processingMethod}
          onChange={v => set('processingMethod', v)}
          options={['Manual', 'Automatic']}
        />
      </CardContent>
    </Card>
  );
};
