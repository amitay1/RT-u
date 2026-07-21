import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { LengthUnit, RtDigitalIqi } from '@/types/rtDigital';
import { NumberField, SelectField, TextField } from '@/components/tabs/shared/FieldRow';

interface Props {
  data: RtDigitalIqi;
  onChange: (data: RtDigitalIqi) => void;
}

const LENGTH_UNITS: ReadonlyArray<{ label: string; value: LengthUnit }> = [
  { label: 'mm', value: 'mm' },
  { label: 'inch', value: 'inch' },
];

export const RtDigitalIqcTab = ({ data, onChange }: Props) => {
  const set = <K extends keyof RtDigitalIqi>(key: K, value: RtDigitalIqi[K]) => (
    onChange({ ...data, [key]: value })
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>6. IQI &amp; Image Quality Requirements</CardTitle>
        <p className="text-sm text-muted-foreground">
          Define the planned IQI selection and required image quality. Achieved readings belong to the inspection record.
        </p>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <TextField label="IQI Type" value={data.type} onChange={(value) => set('type', value)} placeholder="Wire, hole, or controlled type" />
        <TextField label="IQI Standard" value={data.standard} onChange={(value) => set('standard', value)} />
        <TextField label="IQI Designation" value={data.designation} onChange={(value) => set('designation', value)} />
        <TextField label="IQI Material" value={data.material} onChange={(value) => set('material', value)} />
        <div className="grid grid-cols-[minmax(0,1fr)_7.5rem] gap-2">
          <NumberField label="IQI Thickness" value={data.thickness} onChange={(value) => set('thickness', value)} min={0} />
          <SelectField label="Unit" value={data.thicknessUnit} onChange={(value) => set('thicknessUnit', value)} options={LENGTH_UNITS} />
        </div>
        <TextField
          label="Placement"
          value={data.placement}
          onChange={(value) => set('placement', value)}
          placeholder="Source side, detector side, and marking instruction"
        />
        <TextField label="Required Sensitivity" value={data.requiredSensitivity} onChange={(value) => set('requiredSensitivity', value)} />
        <TextField
          label="Required SNR / Normalized SNR"
          value={data.requiredSnrOrNormalizedSnr}
          onChange={(value) => set('requiredSnrOrNormalizedSnr', value)}
          placeholder="Controlled planned requirement"
        />
        <TextField
          label="Required Contrast Sensitivity / CNR"
          value={data.requiredContrastSensitivityOrCnr}
          onChange={(value) => set('requiredContrastSensitivityOrCnr', value)}
          placeholder="Controlled planned requirement, not an achieved reading"
        />
        <div className="grid grid-cols-[minmax(0,1fr)_7.5rem] gap-2">
          <NumberField label="Required Ug" value={data.requiredUg} onChange={(value) => set('requiredUg', value)} min={0} />
          <SelectField label="Unit" value={data.requiredUgUnit} onChange={(value) => set('requiredUgUnit', value)} options={LENGTH_UNITS} />
        </div>
      </CardContent>
    </Card>
  );
};
