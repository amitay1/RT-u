import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { RtFilmIqc } from '@/types/rtFilm';
import { NumberField, SelectField, TextField } from '@/components/tabs/shared/FieldRow';

interface Props {
  data: RtFilmIqc;
  onChange: (d: RtFilmIqc) => void;
}

export const RtFilmIqcTab = ({ data, onChange }: Props) => {
  const set = <K extends keyof RtFilmIqc>(k: K, v: RtFilmIqc[K]) =>
    onChange({ ...data, [k]: v });

  return (
    <Card>
      <CardHeader>
        <CardTitle>5. Image Quality Control</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <SelectField label="IQI Type" value={data.iqiType} onChange={v => set('iqiType', v)} options={['Wire', 'Hole']} />
        <SelectField
          label="IQI Standard"
          value={data.iqiStandard}
          onChange={v => set('iqiStandard', v)}
          options={['ASTM E747', 'ASTM E1025']}
        />
        <SelectField
          label="IQI Material"
          value={data.iqiMaterial}
          onChange={v => set('iqiMaterial', v)}
          options={['Steel', 'Aluminum', 'Same as part']}
        />
        <NumberField label="IQI Size" value={data.iqiSize} onChange={v => set('iqiSize', v)} unit="mm" step="0.01" />
        <SelectField
          label="IQI Placement"
          value={data.iqiPlacement}
          onChange={v => set('iqiPlacement', v)}
          options={['Source side', 'Film side']}
        />
        <SelectField
          label="Required Sensitivity"
          value={data.requiredSensitivity}
          onChange={v => set('requiredSensitivity', v)}
          options={['1-1T', '2-1T', '2-2T', '2-4T']}
        />
        <TextField label="Achieved Sensitivity" value={data.achievedSensitivity} onChange={v => set('achievedSensitivity', v)} placeholder="Measured value" />
        <NumberField label="Optical Density Min" value={data.opticalDensityMin} onChange={v => set('opticalDensityMin', v)} unit="OD" step="0.1" />
        <NumberField label="Optical Density Max" value={data.opticalDensityMax} onChange={v => set('opticalDensityMax', v)} unit="OD" step="0.1" />
        <SelectField
          label="Image Quality Level"
          value={data.imageQualityLevel}
          onChange={v => set('imageQualityLevel', v)}
          options={['00', '0', '1', '2', '3']}
        />
      </CardContent>
    </Card>
  );
};
