import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { LengthUnit, RtFilmSource } from '@/types/rtFilm';
import { DateField, NumberField, SelectField, TextField } from '@/components/tabs/shared/FieldRow';

interface Props {
  data: RtFilmSource;
  onChange: (data: RtFilmSource) => void;
}

const LENGTH_UNITS: ReadonlyArray<{ label: string; value: LengthUnit }> = [
  { label: 'mm', value: 'mm' },
  { label: 'inch', value: 'inch' },
];

export const RtFilmEquipmentTab = ({ data, onChange }: Props) => {
  const set = <K extends keyof RtFilmSource>(key: K, value: RtFilmSource[K]) => (
    onChange({ ...data, [key]: value })
  );

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>3. Radiation Source</CardTitle>
          <p className="text-sm text-muted-foreground">Select the planned source branch and identify the controlled equipment.</p>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <SelectField label="Source Type" value={data.sourceType} onChange={(value) => set('sourceType', value)} options={['X-ray', 'Gamma']} />
          <TextField
            label="Calibration / Qualification Requirement"
            value={data.calibrationRequirement}
            onChange={(value) => set('calibrationRequirement', value)}
            placeholder="Controlled requirement, interval, or reference"
          />
          <TextField label="Manufacturer" value={data.manufacturer} onChange={(value) => set('manufacturer', value)} />
          <TextField label="Model" value={data.model} onChange={(value) => set('model', value)} />
          <TextField label="Serial Number" value={data.serialNumber} onChange={(value) => set('serialNumber', value)} />
        </CardContent>
      </Card>

      {data.sourceType === 'X-ray' ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">X-ray Source Requirements</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-[minmax(0,1fr)_7.5rem] gap-2 md:max-w-xl">
              <NumberField
                label="Focal Spot Size"
                value={data.xRay.focalSpotSize}
                onChange={(focalSpotSize) => onChange({ ...data, xRay: { ...data.xRay, focalSpotSize } })}
                min={0}
              />
              <SelectField
                label="Unit"
                value={data.xRay.focalSpotSizeUnit}
                onChange={(focalSpotSizeUnit) => onChange({ ...data, xRay: { ...data.xRay, focalSpotSizeUnit } })}
                options={LENGTH_UNITS}
              />
            </div>
          </CardContent>
        </Card>
      ) : null}

      {data.sourceType === 'Gamma' ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Gamma Source Requirements</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <TextField label="Isotope" value={data.gamma.isotope} onChange={(isotope) => onChange({ ...data, gamma: { ...data.gamma, isotope } })} />
            <TextField label="Source ID" value={data.gamma.sourceId} onChange={(sourceId) => onChange({ ...data, gamma: { ...data.gamma, sourceId } })} />
            <div className="grid grid-cols-[minmax(0,1fr)_7.5rem] gap-2">
              <NumberField label="Planned Activity" value={data.gamma.activity} onChange={(activity) => onChange({ ...data, gamma: { ...data.gamma, activity } })} min={0} />
              <TextField label="Unit" value={data.gamma.activityUnit} onChange={(activityUnit) => onChange({ ...data, gamma: { ...data.gamma, activityUnit } })} />
            </div>
            <DateField
              label="Activity Reference Date"
              value={data.gamma.activityReferenceDate}
              onChange={(activityReferenceDate) => onChange({ ...data, gamma: { ...data.gamma, activityReferenceDate } })}
            />
            <div className="grid grid-cols-[minmax(0,1fr)_7.5rem] gap-2">
              <NumberField
                label="Effective Source Size"
                value={data.gamma.effectiveSourceSize}
                onChange={(effectiveSourceSize) => onChange({ ...data, gamma: { ...data.gamma, effectiveSourceSize } })}
                min={0}
              />
              <SelectField
                label="Unit"
                value={data.gamma.effectiveSourceSizeUnit}
                onChange={(effectiveSourceSizeUnit) => onChange({ ...data, gamma: { ...data.gamma, effectiveSourceSizeUnit } })}
                options={LENGTH_UNITS}
              />
            </div>
          </CardContent>
        </Card>
      ) : null}

      {!data.sourceType ? (
        <div className="rounded-xl border border-dashed border-border px-4 py-5 text-sm text-muted-foreground">
          Select X-ray or Gamma to reveal the applicable source-specific planning fields.
        </div>
      ) : null}
    </div>
  );
};
