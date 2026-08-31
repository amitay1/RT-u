import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { NumberField, SelectField, TextField } from '@/components/tabs/shared/FieldRow';
import type { DetectorLengthUnit, TimeUnit } from '@/types/rtFilm';
import type { RtCrImageQuality } from '@/types/rtCr';

interface Props {
  data: RtCrImageQuality;
  onChange: (data: RtCrImageQuality) => void;
}

const DETECTOR_LENGTH_UNITS: ReadonlyArray<{ label: string; value: DetectorLengthUnit }> = [
  { label: 'um', value: 'um' },
  { label: 'mm', value: 'mm' },
  { label: 'inch', value: 'inch' },
];

const TIME_UNITS: ReadonlyArray<{ label: string; value: TimeUnit }> = [
  { label: 's', value: 's' },
  { label: 'min', value: 'min' },
];

export const RtCrImageQualityTab = ({ data, onChange }: Props) => {
  const set = <K extends keyof RtCrImageQuality>(key: K, value: RtCrImageQuality[K]) => (
    onChange({ ...data, [key]: value })
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>5. Required Scanned-Image Quality</CardTitle>
        <p className="text-sm text-muted-foreground">
          Numeric requirements the scanned image must meet. The inspection record verifies achieved values
          against this plan — an accepted view requires the achieved SNR to meet the planned minimum.
        </p>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="grid grid-cols-[minmax(0,1fr)_7.5rem] gap-2">
          <NumberField
            label="Required Basic Spatial Resolution (SRb)"
            value={data.requiredSrb}
            onChange={(requiredSrb) => set('requiredSrb', requiredSrb)}
            min={0}
          />
          <SelectField
            label="Unit"
            value={data.requiredSrbUnit}
            onChange={(requiredSrbUnit) => set('requiredSrbUnit', requiredSrbUnit)}
            options={DETECTOR_LENGTH_UNITS}
          />
        </div>
        <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-2">
          <NumberField label="Grey-Value Minimum" value={data.greyValueMin} onChange={(greyValueMin) => set('greyValueMin', greyValueMin)} min={0} />
          <NumberField label="Grey-Value Maximum" value={data.greyValueMax} onChange={(greyValueMax) => set('greyValueMax', greyValueMax)} min={0} />
        </div>
        <NumberField
          label="Required Minimum SNR"
          value={data.requiredSnrMin}
          onChange={(requiredSnrMin) => set('requiredSnrMin', requiredSnrMin)}
          min={0}
          unit="normalized where the practice requires it"
        />
        <TextField
          label="Spatial-Resolution Verification Requirement"
          value={data.duplexWireRequirement}
          onChange={(value) => set('duplexWireRequirement', value)}
          placeholder="Duplex-wire or converging-line-pair verification per the governing practice"
        />
        <div className="grid grid-cols-[minmax(0,1fr)_7.5rem] gap-2">
          <NumberField
            label="Maximum Exposure-to-Scan Delay"
            value={data.maxScanDelay}
            onChange={(maxScanDelay) => set('maxScanDelay', maxScanDelay)}
            min={0}
          />
          <SelectField
            label="Unit"
            value={data.maxScanDelayUnit}
            onChange={(maxScanDelayUnit) => set('maxScanDelayUnit', maxScanDelayUnit)}
            options={TIME_UNITS}
          />
        </div>
        <div className="rounded-xl border border-border/70 bg-muted/20 p-3 text-sm text-muted-foreground">
          Plate fading control: the delay between exposure and scanning reduces the stored signal, so the
          technique fixes an upper limit and the inspection record captures the actual scan date.
        </div>
      </CardContent>
    </Card>
  );
};
