import { useId } from 'react';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { NumberField, SelectField, TextAreaField, TextField } from '@/components/tabs/shared/FieldRow';
import type { LengthUnit, TimeUnit } from '@/types/rtFilm';
import type { RtCrExposureDefaults, RtCrSource } from '@/types/rtCr';

interface Props {
  data: RtCrExposureDefaults;
  source: RtCrSource;
  onChange: (patch: Partial<RtCrExposureDefaults>) => void;
}

const LENGTH_UNITS: ReadonlyArray<{ label: string; value: LengthUnit }> = [
  { label: 'mm', value: 'mm' },
  { label: 'inch', value: 'inch' },
];

const TIME_UNITS: ReadonlyArray<{ label: string; value: TimeUnit }> = [
  { label: 's', value: 's' },
  { label: 'min', value: 'min' },
];

/**
 * Patch-style editor for the CR exposure plan; used by the Exposure Defaults
 * tab and by every exposure-view row. CR shares film's SFD geometry and has
 * no PS811000E sections by design.
 */
export const RtCrExposureFields = ({ data, source, onChange }: Props) => {
  const magnificationAutoId = useId();
  const isGamma = source.sourceType === 'Gamma';

  return (
    <div className="space-y-5">
      <section className="space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Planned geometry</h3>
          <p className="text-xs text-muted-foreground">SFD must equal SOD + OFD; the calculated Ug is checked against the required limit.</p>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <SelectField
            label="Wall Technique"
            value={data.wallTechnique}
            onChange={(wallTechnique) => onChange({ wallTechnique })}
            options={['SWSI', 'DWDI', 'DWSI']}
          />
          <div className="grid grid-cols-[minmax(0,1fr)_7.5rem] gap-2">
            <NumberField label="Planned SFD" value={data.sfd} onChange={(sfd) => onChange({ sfd })} min={0} />
            <SelectField label="Unit" value={data.sfdUnit} onChange={(sfdUnit) => onChange({ sfdUnit })} options={LENGTH_UNITS} />
          </div>
          <div className="grid grid-cols-[minmax(0,1fr)_7.5rem] gap-2">
            <NumberField label="Planned SOD" value={data.sod} onChange={(sod) => onChange({ sod })} min={0} />
            <SelectField label="Unit" value={data.sodUnit} onChange={(sodUnit) => onChange({ sodUnit })} options={LENGTH_UNITS} />
          </div>
          <div className="grid grid-cols-[minmax(0,1fr)_7.5rem] gap-2">
            <NumberField label="Planned OFD" value={data.ofd} onChange={(ofd) => onChange({ ofd })} min={0} />
            <SelectField label="Unit" value={data.ofdUnit} onChange={(ofdUnit) => onChange({ ofdUnit })} options={LENGTH_UNITS} />
          </div>
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <Switch
                id={magnificationAutoId}
                checked={data.geometricMagnificationAuto}
                onCheckedChange={(geometricMagnificationAuto) => onChange({ geometricMagnificationAuto })}
              />
              <Label htmlFor={magnificationAutoId} className="text-sm">Auto geometric magnification (SFD / SOD)</Label>
            </div>
            <NumberField
              label="Geometric Magnification"
              value={data.geometricMagnification}
              onChange={(geometricMagnification) => onChange({ geometricMagnification })}
              min={0}
              disabled={data.geometricMagnificationAuto}
              unit="x"
            />
          </div>
          <div className="grid grid-cols-[minmax(0,1fr)_7.5rem] gap-2">
            <NumberField label="Required Ug" value={data.requiredUg} onChange={(requiredUg) => onChange({ requiredUg })} min={0} />
            <SelectField label="Unit" value={data.requiredUgUnit} onChange={(requiredUgUnit) => onChange({ requiredUgUnit })} options={LENGTH_UNITS} />
          </div>
        </div>
      </section>

      <section className="space-y-3 border-t border-border/70 pt-5">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Planned thickness</h3>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <TextField
            label="Thickness Description"
            value={data.thicknessDescription}
            onChange={(thicknessDescription) => onChange({ thicknessDescription })}
            placeholder="Or enter a numeric min/max range"
          />
          <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_7.5rem] gap-2">
            <NumberField label="Thickness Min" value={data.thicknessMin} onChange={(thicknessMin) => onChange({ thicknessMin })} min={0} />
            <NumberField label="Thickness Max" value={data.thicknessMax} onChange={(thicknessMax) => onChange({ thicknessMax })} min={0} />
            <SelectField label="Unit" value={data.thicknessUnit} onChange={(thicknessUnit) => onChange({ thicknessUnit })} options={LENGTH_UNITS} />
          </div>
        </div>
      </section>

      <section className="space-y-3 border-t border-border/70 pt-5">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Exposure &amp; beam controls</h3>
          {isGamma ? (
            <p className="text-xs text-muted-foreground">
              Tube voltage and current do not apply to a Gamma exposure; the isotope plan on the Equipment tab governs the source.
            </p>
          ) : null}
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {!isGamma ? (
            <>
              <NumberField label="Planned Tube Voltage" value={data.tubeVoltage} onChange={(tubeVoltage) => onChange({ tubeVoltage })} min={0} unit="kV" />
              <NumberField label="Planned Tube Current" value={data.tubeCurrent} onChange={(tubeCurrent) => onChange({ tubeCurrent })} min={0} unit="mA" />
            </>
          ) : null}
          <div className="grid grid-cols-[minmax(0,1fr)_7.5rem] gap-2">
            <NumberField label="Planned Exposure Time" value={data.exposureTime} onChange={(exposureTime) => onChange({ exposureTime })} min={0} />
            <SelectField label="Unit" value={data.exposureTimeUnit} onChange={(exposureTimeUnit) => onChange({ exposureTimeUnit })} options={TIME_UNITS} />
          </div>
          <TextField label="Filter" value={data.filter} onChange={(filter) => onChange({ filter })} />
          <TextField label="Collimation" value={data.collimation} onChange={(collimation) => onChange({ collimation })} />
          <NumberField label="Planned Beam Angle" value={data.beamAngle} onChange={(beamAngle) => onChange({ beamAngle })} unit="deg" />
        </div>
      </section>

      <section className="space-y-3 border-t border-border/70 pt-5">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Plate loading &amp; identification</h3>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <TextField label="Imaging Plate Size" value={data.plateSize} onChange={(plateSize) => onChange({ plateSize })} placeholder="e.g. 14 x 17 in" />
          <TextField label="Screen Override" value={data.screenOverride} onChange={(screenOverride) => onChange({ screenOverride })} placeholder="Overrides the plate-system screens for this exposure" />
          <TextField label="Required Overlap" value={data.overlap} onChange={(overlap) => onChange({ overlap })} />
          <TextField label="Identification Plan" value={data.identification} onChange={(identification) => onChange({ identification })} placeholder="Location markers and image identification scheme" />
          <TextField label="IQI Requirement / Override" value={data.iqiOverride} onChange={(iqiOverride) => onChange({ iqiOverride })} />
          <TextAreaField label="Planned Notes" value={data.notes} onChange={(notes) => onChange({ notes })} />
        </div>
      </section>
    </div>
  );
};
