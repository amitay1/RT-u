import { useId } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import type {
  LengthUnit,
  RtFilmScreenPlan,
  RtFilmSystem,
  TemperatureUnit,
  TimeUnit,
} from '@/types/rtFilm';
import { NumberField, SelectField, TextField } from '@/components/tabs/shared/FieldRow';
import {
  lookupPs811000DensityRequirement,
  lookupPs811000MaximumReadableDensity,
  lookupPs811000MinimumContrastDifference,
  PS811000_DENSITOMETER_DAILY_ACCURACY_HD,
  PS811000_DENSITOMETER_RESOLUTION_HD,
} from '@/lib/ps811000';

interface Props {
  data: RtFilmSystem;
  ps811000Applicable: boolean;
  onChange: (data: RtFilmSystem) => void;
}

const LENGTH_UNITS: ReadonlyArray<{ label: string; value: LengthUnit }> = [
  { label: 'mm', value: 'mm' },
  { label: 'inch', value: 'inch' },
];

const TIME_UNITS: ReadonlyArray<{ label: string; value: Exclude<TimeUnit, ''> }> = [
  { label: 'seconds', value: 's' },
  { label: 'minutes', value: 'min' },
];

const TEMPERATURE_UNITS: ReadonlyArray<{ label: string; value: Exclude<TemperatureUnit, ''> }> = [
  { label: '°C', value: 'degC' },
  { label: '°F', value: 'degF' },
];

interface ScreenFieldsProps {
  title: string;
  data: RtFilmScreenPlan;
  onChange: (data: RtFilmScreenPlan) => void;
}

const ScreenFields = ({ title, data, onChange }: ScreenFieldsProps) => (
  <div className="rounded-xl border border-border/70 bg-muted/20 p-4">
    <div className="mb-3 text-sm font-semibold">{title}</div>
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_7.5rem]">
      <TextField label="Material" value={data.material} onChange={(material) => onChange({ ...data, material })} />
      <NumberField label="Thickness" value={data.thickness} onChange={(thickness) => onChange({ ...data, thickness })} min={0} />
      <SelectField label="Unit" value={data.thicknessUnit} onChange={(thicknessUnit) => onChange({ ...data, thicknessUnit })} options={LENGTH_UNITS} />
    </div>
  </div>
);

export const RtFilmFilmSystemTab = ({ data, ps811000Applicable, onChange }: Props) => {
  const boeingId = useId();
  const set = <K extends keyof RtFilmSystem>(key: K, value: RtFilmSystem[K]) => (
    onChange({ ...data, [key]: value })
  );
  const densityRequirement = ps811000Applicable && data.viewingMode
    ? lookupPs811000DensityRequirement(data.viewingMode)
    : null;
  const maximumReadableDensity = lookupPs811000MaximumReadableDensity(data.viewerOutputCandelaPerSquareMeter);
  const minimumContrast = lookupPs811000MinimumContrastDifference(data.requiredDensityMax);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>4. Film System &amp; Processing</CardTitle>
          <p className="text-sm text-muted-foreground">Specify the qualified film system, density range, and planned processing controls.</p>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {ps811000Applicable ? (
            <div className="space-y-4 rounded-xl border border-primary/25 bg-primary/5 p-4 md:col-span-2">
              <div>
                <div className="text-sm font-semibold">PS811000E C1 density controls</div>
                <p className="note-clamp mt-1 text-xs text-muted-foreground">
                  Selecting the viewing mode calculates the required density range. Values above the ordinary range require a controlled approval basis.
                </p>
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <SelectField
                  label="Film Viewing Mode"
                  value={data.viewingMode}
                  onChange={(value) => set('viewingMode', value)}
                  options={[
                    { value: 'single', label: 'Single film' },
                    { value: 'superimposed', label: 'Superimposed films' },
                  ]}
                />
                <NumberField
                  label="Viewer Output"
                  value={data.viewerOutputCandelaPerSquareMeter}
                  onChange={(value) => set('viewerOutputCandelaPerSquareMeter', value)}
                  unit="cd/m²"
                  min={0}
                />
                <NumberField
                  label="Individual Film Density Minimum"
                  value={data.individualFilmDensityMinimum}
                  onChange={(value) => set('individualFilmDensityMinimum', value)}
                  unit="H&D"
                  min={0}
                  disabled={Boolean(densityRequirement)}
                />
                <TextField
                  label="Special Density Approval Reference"
                  value={data.specialDensityApprovalReference}
                  onChange={(value) => set('specialDensityApprovalReference', value)}
                  placeholder="Required only for an approved exception"
                />
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <div className="rounded-xl border border-border/70 bg-background/70 p-3 text-sm">
                  <div className="font-semibold">Density lookup</div>
                  <div className="mt-1 text-muted-foreground">
                    {densityRequirement
                      ? `${densityRequirement.combinedMinimum} to ${densityRequirement.maximum} H&D${densityRequirement.individualFilmMinimum === null ? '' : `; each film at least ${densityRequirement.individualFilmMinimum}`}`
                      : 'Select a viewing mode.'}
                  </div>
                </div>
                <div className="rounded-xl border border-border/70 bg-background/70 p-3 text-sm">
                  <div className="font-semibold">Figure 1 viewer limit</div>
                  <div className="mt-1 text-muted-foreground">
                    {maximumReadableDensity
                      ? `Approximately ${maximumReadableDensity.value} H&D maximum readable density.`
                      : 'Enter viewer output within the plotted range.'}
                  </div>
                </div>
                <div className="rounded-xl border border-border/70 bg-background/70 p-3 text-sm">
                  <div className="font-semibold">Figure 6 minimum contrast</div>
                  <div className="mt-1 text-muted-foreground">
                    {minimumContrast
                      ? `Approximately ${minimumContrast.value} H&D at the planned maximum density.`
                      : 'Enter a density within the plotted range.'}
                  </div>
                </div>
              </div>
              <div className="rounded-xl border border-border/70 bg-background/70 p-3 text-xs text-muted-foreground">
                Densitometer resolution: {PS811000_DENSITOMETER_RESOLUTION_HD} H&amp;D. Daily verification tolerance: ±{PS811000_DENSITOMETER_DAILY_ACCURACY_HD} H&amp;D.
              </div>
              <div className="rounded-lg border border-warning/30 bg-warning/10 p-3">
                <div className="flex items-start gap-3">
                  <Switch id={boeingId} checked={data.boeingPart} onCheckedChange={(value) => set('boeingPart', value)} />
                  <div className="flex-1">
                    <Label htmlFor={boeingId} className="font-semibold">Boeing part viewer limitation applies</Label>
                    <p className="note-clamp mt-1 text-xs text-muted-foreground">The built-in viewer-output lookup is not a substitute for the customer-specific viewer limitation.</p>
                  </div>
                </div>
                {data.boeingPart ? (
                  <div className="mt-3">
                    <TextField
                      label="Boeing Viewer Limit Reference"
                      value={data.boeingViewerLimitReference}
                      onChange={(value) => set('boeingViewerLimitReference', value)}
                      placeholder="Enter the controlled customer reference"
                    />
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}
          <TextField label="Film Manufacturer" value={data.manufacturer} onChange={(value) => set('manufacturer', value)} />
          <TextField label="Film Designation" value={data.filmDesignation} onChange={(value) => set('filmDesignation', value)} />
          <TextField label="Film Class" value={data.filmClass} onChange={(value) => set('filmClass', value)} placeholder="Qualified classification" />
          <TextField label="Cassette Type" value={data.cassetteType} onChange={(value) => set('cassetteType', value)} />
          <NumberField label="Required Density Minimum" value={data.requiredDensityMin} onChange={(value) => set('requiredDensityMin', value)} unit="H&D" min={0} step="0.1" disabled={Boolean(densityRequirement)} />
          <NumberField label="Required Density Maximum" value={data.requiredDensityMax} onChange={(value) => set('requiredDensityMax', value)} unit="H&D" min={0} step="0.1" disabled={Boolean(densityRequirement)} />
          <TextField label="Processing System" value={data.processingSystem} onChange={(value) => set('processingSystem', value)} placeholder="Processor or controlled system" />
          <TextField label="Processing Method" value={data.processingMethod} onChange={(value) => set('processingMethod', value)} />
          <div className="grid grid-cols-[minmax(0,1fr)_7.5rem] gap-2">
            <NumberField label="Processing Time" value={data.processingTime} onChange={(value) => set('processingTime', value)} min={0} />
            <SelectField label="Unit" value={data.processingTimeUnit} onChange={(value) => set('processingTimeUnit', value)} options={TIME_UNITS} />
          </div>
          <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_7.5rem] gap-2">
            <NumberField label="Temperature" value={data.processingTemperature} onChange={(value) => set('processingTemperature', value)} />
            <NumberField label="Tolerance (±)" value={data.processingTemperatureTolerance} onChange={(value) => set('processingTemperatureTolerance', value)} min={0} />
            <SelectField label="Unit" value={data.processingTemperatureUnit} onChange={(value) => set('processingTemperatureUnit', value)} options={TEMPERATURE_UNITS} />
          </div>
          <TextField label="Viewing Equipment" value={data.viewingEquipment} onChange={(value) => set('viewingEquipment', value)} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Intensifying Screens</CardTitle>
          <p className="text-sm text-muted-foreground">Front and back screens are controlled separately.</p>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <ScreenFields title="Front Screen" data={data.frontScreen} onChange={(frontScreen) => set('frontScreen', frontScreen)} />
          <ScreenFields title="Back Screen" data={data.backScreen} onChange={(backScreen) => set('backScreen', backScreen)} />
        </CardContent>
      </Card>
    </div>
  );
};
