import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { RtFilmEquipment } from '@/types/rtFilm';
import { SelectField, TextField } from '@/components/tabs/shared/FieldRow';

interface Props {
  data: RtFilmEquipment;
  onChange: (d: RtFilmEquipment) => void;
}

export const RtFilmEquipmentTab = ({ data, onChange }: Props) => {
  const set = <K extends keyof RtFilmEquipment>(k: K, v: RtFilmEquipment[K]) =>
    onChange({ ...data, [k]: v });

  return (
    <Card>
      <CardHeader>
        <CardTitle>3. Equipment</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <SelectField
          label="Radiation Source Type"
          value={data.radiationSourceType}
          onChange={v => set('radiationSourceType', v)}
          options={['X-ray', 'Isotope']}
        />
        <TextField label="Manufacturer" value={data.manufacturer} onChange={v => set('manufacturer', v)} />
        <TextField label="Model" value={data.model} onChange={v => set('model', v)} />
        <TextField label="Serial Number" value={data.serialNumber} onChange={v => set('serialNumber', v)} />
        <SelectField
          label="Calibration Status"
          value={data.calibrationStatus}
          onChange={v => set('calibrationStatus', v)}
          options={['Valid', 'Expired']}
        />
        <TextField label="Viewing Equipment" value={data.viewingEquipment} onChange={v => set('viewingEquipment', v)} placeholder="Viewer type" />
      </CardContent>
    </Card>
  );
};
