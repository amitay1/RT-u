import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { PenetrantType, PtInspectionConditions, TimeUnit } from '@/types/penetrant';
import { NumberField, SelectField, TextAreaField, TextField } from '@/components/tabs/shared/FieldRow';

interface Props {
  data: PtInspectionConditions;
  onChange: (d: PtInspectionConditions) => void;
  penetrantType: PenetrantType;
}

const TIME_UNIT_OPTIONS = [
  { label: 'seconds', value: 's' },
  { label: 'minutes', value: 'min' },
] as const;

export const PtInspectionConditionsTab = ({ data, onChange, penetrantType }: Props) => {
  const set = <K extends keyof PtInspectionConditions>(k: K, v: PtInspectionConditions[K]) =>
    onChange({ ...data, [k]: v });

  return (
    <Card>
      <CardHeader>
        <CardTitle>6. Inspection Conditions</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {penetrantType === 'Type I' ? (
          <>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_140px]">
              <NumberField
                label="Required Minimum UV-A Irradiance"
                value={data.requiredUvAMin}
                onChange={v => set('requiredUvAMin', v)}
                unit={data.uvAUnit}
                min={0}
              />
              <TextField label="UV-A Unit" value={data.uvAUnit} onChange={v => set('uvAUnit', v)} />
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_140px]">
              <NumberField
                label="Maximum Ambient Visible Light"
                value={data.ambientVisibleLightMax}
                onChange={v => set('ambientVisibleLightMax', v)}
                unit={data.visibleLightUnit}
                min={0}
              />
              <TextField label="Visible Light Unit" value={data.visibleLightUnit} onChange={v => set('visibleLightUnit', v)} />
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_120px]">
              <NumberField
                label="Required Dark Adaptation Time"
                value={data.darkAdaptationTime}
                onChange={v => set('darkAdaptationTime', v)}
                unit={data.darkAdaptationTimeUnit}
                min={0}
              />
              <SelectField
                label="Unit"
                value={data.darkAdaptationTimeUnit}
                onChange={(v: TimeUnit) => set('darkAdaptationTimeUnit', v)}
                options={TIME_UNIT_OPTIONS}
              />
            </div>
          </>
        ) : null}
        {penetrantType === 'Type II' ? (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_140px] md:col-span-2">
            <NumberField
              label="Required Minimum White Light"
              value={data.whiteLightMin}
              onChange={v => set('whiteLightMin', v)}
              unit={data.visibleLightUnit}
              min={0}
            />
            <TextField label="Visible Light Unit" value={data.visibleLightUnit} onChange={v => set('visibleLightUnit', v)} />
          </div>
        ) : null}
        {!penetrantType ? (
          <p className="note-clamp rounded-lg border border-dashed border-border px-3 py-4 text-sm text-muted-foreground md:col-span-2">
            Select Type I or Type II in Materials to configure the applicable planned viewing requirements.
          </p>
        ) : null}
        <div className="md:col-span-2">
          <TextAreaField
            label="Lighting and Inspection Equipment Requirements"
            value={data.equipmentRequirements}
            onChange={v => set('equipmentRequirements', v)}
            placeholder="Specify lamp, meter, calibration, warm-up, and verification requirements"
          />
        </div>
      </CardContent>
    </Card>
  );
};
