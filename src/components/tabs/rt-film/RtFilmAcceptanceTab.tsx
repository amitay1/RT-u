import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { RtFilmAcceptance, LengthUnit } from '@/types/rtFilm';
import { NumberField, SelectField, TextAreaField, TextField } from '@/components/tabs/shared/FieldRow';

interface Props {
  data: RtFilmAcceptance;
  onChange: (d: RtFilmAcceptance) => void;
}

const UNIT_OPTIONS = [
  { label: 'mm', value: 'mm' },
  { label: 'inch', value: 'inch' },
];

export const RtFilmAcceptanceTab = ({ data, onChange }: Props) => {
  const set = <K extends keyof RtFilmAcceptance>(k: K, v: RtFilmAcceptance[K]) =>
    onChange({ ...data, [k]: v });

  return (
    <Card>
      <CardHeader>
        <CardTitle>6. Acceptance Criteria</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <TextField label="Acceptance Standard" value={data.acceptanceStandard} onChange={v => set('acceptanceStandard', v)} placeholder="e.g. ASTM E1742-19" />
        <TextField label="Quality Level" value={data.qualityLevel} onChange={v => set('qualityLevel', v)} placeholder="Per requirement" />

        <div className="grid grid-cols-[1fr_120px] gap-2">
          <NumberField label="Single Discontinuity" value={data.singleDiscontinuity} onChange={v => set('singleDiscontinuity', v)} unit={data.singleDiscontinuityUnit} step="0.1" />
          <SelectField label="Unit" value={data.singleDiscontinuityUnit} onChange={(v: LengthUnit) => set('singleDiscontinuityUnit', v)} options={UNIT_OPTIONS} />
        </div>

        <div className="grid grid-cols-[1fr_120px] gap-2">
          <NumberField label="Multiple Discontinuities" value={data.multipleDiscontinuities} onChange={v => set('multipleDiscontinuities', v)} unit={data.multipleDiscontinuitiesUnit} step="0.1" />
          <SelectField label="Unit" value={data.multipleDiscontinuitiesUnit} onChange={(v: LengthUnit) => set('multipleDiscontinuitiesUnit', v)} options={UNIT_OPTIONS} />
        </div>

        <div className="grid grid-cols-[1fr_120px] gap-2">
          <NumberField label="Linear Indications" value={data.linearIndications} onChange={v => set('linearIndications', v)} unit={data.linearIndicationsUnit} step="0.1" />
          <SelectField label="Unit" value={data.linearIndicationsUnit} onChange={(v: LengthUnit) => set('linearIndicationsUnit', v)} options={UNIT_OPTIONS} />
        </div>

        <TextAreaField label="Special Requirements" value={data.specialRequirements} onChange={v => set('specialRequirements', v)} />
      </CardContent>
    </Card>
  );
};
