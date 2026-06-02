import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import type { RtFilmExposureSetup } from '@/types/rtFilm';
import { NumberField, SelectField } from '@/components/tabs/shared/FieldRow';

interface Props {
  data: RtFilmExposureSetup;
  onChange: (d: RtFilmExposureSetup) => void;
}

const DISTANCE_PAIR = (
  label: string,
  hint: string,
  value: number | '',
  unit: 'mm' | 'inch',
  onValue: (v: number | '') => void,
  onUnit: (u: 'mm' | 'inch') => void
) => (
  <div className="grid grid-cols-[1fr_120px] gap-2">
    <NumberField label={label} value={value} onChange={onValue} unit={hint} />
    <SelectField
      label="Unit"
      value={unit}
      onChange={u => onUnit(u as 'mm' | 'inch')}
      options={[{ label: 'mm', value: 'mm' }, { label: 'inch', value: 'inch' }]}
    />
  </div>
);

export const RtFilmExposureTab = ({ data, onChange }: Props) => {
  const set = <K extends keyof RtFilmExposureSetup>(k: K, v: RtFilmExposureSetup[K]) =>
    onChange({ ...data, [k]: v });

  return (
    <Card>
      <CardHeader>
        <CardTitle>2. Exposure Setup</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <SelectField
          label="Technique Type"
          value={data.techniqueType}
          onChange={v => set('techniqueType', v)}
          options={['SWSI', 'DWDI', 'DWSI']}
        />
        <SelectField
          label="Radiation Type"
          value={data.radiationType}
          onChange={v => set('radiationType', v)}
          options={['X-ray', 'Gamma']}
        />
        {DISTANCE_PAIR(
          'SFD (Source-Film Distance)',
          data.sfdUnit,
          data.sfd,
          data.sfdUnit,
          v => set('sfd', v),
          u => set('sfdUnit', u)
        )}
        {DISTANCE_PAIR(
          'SOD (Source-Object Distance)',
          data.sodUnit,
          data.sod,
          data.sodUnit,
          v => set('sod', v),
          u => set('sodUnit', u)
        )}
        {DISTANCE_PAIR(
          'OFD (Object-Film Distance)',
          data.ofdUnit,
          data.ofd,
          data.ofdUnit,
          v => set('ofd', v),
          u => set('ofdUnit', u)
        )}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-3">
            <Switch
              id="geomag-auto"
              checked={data.geometricMagnificationAuto}
              onCheckedChange={(c: boolean) => set('geometricMagnificationAuto', c)}
            />
            <Label htmlFor="geomag-auto" className="text-sm font-medium">
              Geometric Magnification — Auto
            </Label>
          </div>
          <NumberField
            label="Geometric Magnification"
            value={data.geometricMagnification}
            onChange={v => set('geometricMagnification', v)}
            unit={data.geometricMagnificationAuto ? 'computed' : 'manual'}
            step="0.01"
          />
        </div>
        <NumberField label="Focal Spot Size" value={data.focalSpotSize} onChange={v => set('focalSpotSize', v)} unit="mm" step="0.01" />
        <NumberField label="Beam Angle" value={data.beamAngle} onChange={v => set('beamAngle', v)} unit="°" />
        <NumberField label="Number of Exposures" value={data.numberOfExposures} onChange={v => set('numberOfExposures', v)} />
        <SelectField
          label="Exposure Pattern"
          value={data.exposurePattern}
          onChange={v => set('exposurePattern', v)}
          options={['Static', 'Multiple', 'Rotational', 'Panoramic']}
        />
        <NumberField label="Coverage" value={data.coverage} onChange={v => set('coverage', v)} unit="%" min={0} max={100} />
      </CardContent>
    </Card>
  );
};
