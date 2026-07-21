import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { PtSurfacePreparation, TemperatureUnit, TimeUnit } from '@/types/penetrant';
import { NumberField, SelectField, TextAreaField, TextField } from '@/components/tabs/shared/FieldRow';

interface Props {
  data: PtSurfacePreparation;
  onChange: (d: PtSurfacePreparation) => void;
}

const TIME_UNIT_OPTIONS = [
  { label: 'seconds', value: 's' },
  { label: 'minutes', value: 'min' },
] as const;

const TEMPERATURE_UNIT_OPTIONS = [
  { label: '°C', value: 'degC' },
  { label: '°F', value: 'degF' },
] as const;

export const PtSurfacePreparationTab = ({ data, onChange }: Props) => {
  const set = <K extends keyof PtSurfacePreparation>(k: K, v: PtSurfacePreparation[K]) =>
    onChange({ ...data, [k]: v });

  return (
    <Card>
      <CardHeader>
        <CardTitle>3. Surface Preparation</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <TextField
          label="Cleaning Method"
          value={data.cleaningMethod}
          onChange={v => set('cleaningMethod', v)}
          placeholder="Specified pre-cleaning method"
        />
        <TextField
          label="Required Surface Condition"
          value={data.surfaceCondition}
          onChange={v => set('surfaceCondition', v)}
          placeholder="Condition required before penetrant application"
        />
        <div className="md:col-span-2">
          <TextAreaField
            label="Cleaning Instructions"
            value={data.cleaningDetails}
            onChange={v => set('cleaningDetails', v)}
            placeholder="Describe cleaning sequence and verification requirements"
          />
        </div>
        <div className="md:col-span-2">
          <TextAreaField
            label="Cleaning Restrictions"
            value={data.cleaningRestrictions}
            onChange={v => set('cleaningRestrictions', v)}
            placeholder="Prohibited products, methods, or residue limits"
          />
        </div>
        <div className="md:col-span-2">
          <TextAreaField
            label="Drying Method / Instructions"
            value={data.dryingMethod}
            onChange={v => set('dryingMethod', v)}
            placeholder="Specify planned drying method and completion criteria"
          />
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_120px]">
          <NumberField
            label="Planned Drying Time"
            value={data.dryingTime}
            onChange={v => set('dryingTime', v)}
            unit={data.dryingTimeUnit}
            min={0}
          />
          <SelectField
            label="Unit"
            value={data.dryingTimeUnit}
            onChange={(v: TimeUnit) => set('dryingTimeUnit', v)}
            options={TIME_UNIT_OPTIONS}
          />
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_120px]">
          <NumberField
            label="Planned Drying Temperature"
            value={data.dryingTemperature}
            onChange={v => set('dryingTemperature', v)}
            unit={data.dryingTemperatureUnit === 'degC' ? '°C' : data.dryingTemperatureUnit === 'degF' ? '°F' : ''}
          />
          <SelectField
            label="Unit"
            value={data.dryingTemperatureUnit}
            onChange={(v: TemperatureUnit) => set('dryingTemperatureUnit', v)}
            options={TEMPERATURE_UNIT_OPTIONS}
          />
        </div>
      </CardContent>
    </Card>
  );
};
