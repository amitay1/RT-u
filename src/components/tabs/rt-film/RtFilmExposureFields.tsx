import { useId } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  NumberField,
  SelectField,
  TextAreaField,
  TextField,
} from '@/components/tabs/shared/FieldRow';
import type {
  LengthUnit,
  Ps811000EnergyCurve,
  RtFilmExposureDefaults,
  RtFilmSource,
  TimeUnit,
} from '@/types/rtFilm';
import { calculateFilmGeometricUnsharpness } from '@/lib/rtGeometry';
import {
  calculateExposureMas,
  calculateHoneycombRadiographicThickness,
  calculateMinimumFocalSpotToImageDistance,
  isThinAdhesiveTenKvpCase,
  lookupPs811000EnergySuggestion,
  lookupPs811000LeadScreens,
  lookupPs811000UgLimit,
  PS811000_ENERGY_CURVE_LABELS,
  PS811000_EQUIVALENCE_FACTORS,
  PS811000_EQUIVALENCE_VOLTAGES,
} from '@/lib/ps811000';
import { calculatePs811000EquivalentThickness } from '@/lib/ps811000ExposureChart';
import { RtFilmExposureChart } from '@/components/tabs/rt-film/RtFilmExposureChart';

interface RtFilmExposureFieldsProps {
  data: RtFilmExposureDefaults;
  source: RtFilmSource;
  ps811000Applicable: boolean;
  onChange: (patch: Partial<RtFilmExposureDefaults>) => void;
}

const LENGTH_UNITS: ReadonlyArray<{ label: string; value: LengthUnit }> = [
  { label: 'mm', value: 'mm' },
  { label: 'inch', value: 'inch' },
];

const TIME_UNITS: ReadonlyArray<{ label: string; value: Exclude<TimeUnit, ''> }> = [
  { label: 'seconds', value: 's' },
  { label: 'minutes', value: 'min' },
];

const ENERGY_CURVE_OPTIONS = Object.entries(PS811000_ENERGY_CURVE_LABELS).map(([value, label]) => ({
  value,
  label,
})) as ReadonlyArray<{ value: Ps811000EnergyCurve; label: string }>;

const THICKNESS_BASIS_OPTIONS = [
  { value: 'entered-thickness', label: 'Entered radiographic thickness' },
  { value: 'honeycomb-components', label: 'Honeycomb component sum' },
] as const;

export function RtFilmExposureFields({
  data,
  source,
  ps811000Applicable,
  onChange,
}: RtFilmExposureFieldsProps) {
  const magnificationId = useId();
  const set = <K extends keyof RtFilmExposureDefaults>(
    key: K,
    value: RtFilmExposureDefaults[K],
  ) => onChange({ [key]: value } as Pick<RtFilmExposureDefaults, K>);

  const honeycombThickness = calculateHoneycombRadiographicThickness({
    skins: data.honeycombSkins,
    adhesive: data.honeycombAdhesive,
    capsOrFlanges: data.honeycombCapsOrFlanges,
    doublersOrTriplers: data.honeycombDoublersOrTriplers,
    unit: data.thicknessUnit,
  });
  const effectiveThickness = data.ps811000ThicknessBasis === 'honeycomb-components'
    ? honeycombThickness
    : data.thicknessMax;
  const energySuggestion = data.ps811000EnergyCurve && ps811000Applicable
    ? lookupPs811000EnergySuggestion(data.ps811000EnergyCurve, effectiveThickness, data.thicknessUnit)
    : null;
  const thinAdhesiveCase = data.ps811000EnergyCurve
    ? isThinAdhesiveTenKvpCase(data.ps811000EnergyCurve, effectiveThickness, data.thicknessUnit)
    : false;
  const ugLimit = ps811000Applicable
    ? lookupPs811000UgLimit(effectiveThickness, data.thicknessUnit)
    : null;
  const calculatedUg = calculateFilmGeometricUnsharpness(data, source);
  const exposureMas = source.sourceType === 'X-ray'
    ? calculateExposureMas(data.tubeCurrent, data.exposureTime, data.exposureTimeUnit)
    : '';
  const minimumSfd = calculateMinimumFocalSpotToImageDistance(data.coverageDiameter, data.coverageDiameterUnit);
  const screenRecommendations = source.sourceType === 'X-ray'
    ? lookupPs811000LeadScreens(data.tubeVoltage)
    : [];
  const equivalenceRow = PS811000_EQUIVALENCE_FACTORS.find((row) => (
    row.material === data.ps811000EquivalenceMaterial
  ));
  const appliedUgLimit = ugLimit
    ? (data.requiredUgUnit === 'inch' ? ugLimit.maximumInch : ugLimit.maximumMm)
    : null;
  // Table 1 gives a factor; the sheet has to do the multiplication, not the operator.
  const equivalentThickness = calculatePs811000EquivalentThickness(
    effectiveThickness,
    data.ps811000EquivalenceMaterial,
    data.tubeVoltage,
  );

  const lengthPair = (
    label: string,
    valueKey: 'sfd' | 'sod' | 'ofd' | 'requiredUg',
    unitKey: 'sfdUnit' | 'sodUnit' | 'ofdUnit' | 'requiredUgUnit',
  ) => (
    <div className="grid grid-cols-[minmax(0,1fr)_7.5rem] gap-2">
      <NumberField
        label={label}
        value={data[valueKey]}
        onChange={(value) => set(valueKey, value)}
        unit={data[unitKey]}
        min={0}
      />
      <SelectField
        label="Unit"
        value={data[unitKey]}
        onChange={(value) => set(unitKey, value)}
        options={LENGTH_UNITS}
      />
    </div>
  );

  return (
    <div className="space-y-6">
      {ps811000Applicable ? (
        <section className="space-y-4 rounded-2xl border border-primary/25 bg-primary/5 p-4">
          <div>
            <h3 className="text-sm font-semibold text-foreground">PS811000E C1 calculation assistance</h3>
            <p className="note-clamp text-xs text-muted-foreground">
              Table values are exact lookups. Figure values are approximate digitized graph readings and remain subject to controlled review.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <SelectField
              label="Figure 2 Material Curve"
              value={data.ps811000EnergyCurve}
              onChange={(value) => set('ps811000EnergyCurve', value)}
              options={ENERGY_CURVE_OPTIONS}
              hint="X-ray only"
            />
            <SelectField
              label="Radiographic Thickness Basis"
              value={data.ps811000ThicknessBasis}
              onChange={(value) => set('ps811000ThicknessBasis', value)}
              options={THICKNESS_BASIS_OPTIONS}
            />
            <SelectField
              label="Table 1 Equivalence Material"
              value={data.ps811000EquivalenceMaterial}
              onChange={(value) => set('ps811000EquivalenceMaterial', value)}
              options={PS811000_EQUIVALENCE_FACTORS.map((row) => row.material)}
              hint="exact listed voltages only"
            />
            <TextField
              label="Machine Technique Table Reference"
              value={data.machineTechniqueReference}
              onChange={(value) => set('machineTechniqueReference', value)}
              placeholder="Required source for mA / exposure settings"
            />
            <div className="grid grid-cols-[minmax(0,1fr)_7.5rem] gap-2">
              <NumberField
                label="Maximum Coverage Diameter"
                value={data.coverageDiameter}
                onChange={(value) => set('coverageDiameter', value)}
                min={0}
              />
              <SelectField
                label="Unit"
                value={data.coverageDiameterUnit}
                onChange={(value) => set('coverageDiameterUnit', value)}
                options={LENGTH_UNITS}
              />
            </div>
          </div>

          {data.ps811000ThicknessBasis === 'honeycomb-components' ? (
            <div className="space-y-3 rounded-xl border border-border/70 bg-background/60 p-3">
              <div>
                <div className="text-sm font-semibold">Honeycomb radiographic thickness</div>
                <p className="note-clamp text-xs text-muted-foreground">
                  Enter summed skins, adhesive, applicable caps/flanges, and doublers/triplers. Core thickness is intentionally excluded.
                </p>
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                <NumberField label="Skins Sum" value={data.honeycombSkins} onChange={(value) => set('honeycombSkins', value)} unit={data.thicknessUnit} min={0} />
                <NumberField label="Adhesive Sum" value={data.honeycombAdhesive} onChange={(value) => set('honeycombAdhesive', value)} unit={data.thicknessUnit} min={0} />
                <NumberField label="Caps / Flanges Sum" value={data.honeycombCapsOrFlanges} onChange={(value) => set('honeycombCapsOrFlanges', value)} unit={data.thicknessUnit} min={0} />
                <NumberField label="Doublers / Triplers Sum" value={data.honeycombDoublersOrTriplers} onChange={(value) => set('honeycombDoublersOrTriplers', value)} unit={data.thicknessUnit} min={0} />
              </div>
            </div>
          ) : null}

          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-xl border border-border/70 bg-background/70 p-3 text-sm">
              <div className="font-semibold">Effective thickness</div>
              <div className="mt-1 text-muted-foreground">
                {effectiveThickness === '' ? 'Complete the thickness inputs.' : `${effectiveThickness} ${data.thicknessUnit}`}
              </div>
            </div>
            <div className="rounded-xl border border-border/70 bg-background/70 p-3 text-sm">
              <div className="font-semibold">Table 8 Ug limit</div>
              <div className="mt-1 text-muted-foreground">
                {ugLimit && appliedUgLimit !== null
                  ? `${appliedUgLimit} ${data.requiredUgUnit} (${ugLimit.thicknessBand})`
                  : 'A numeric thickness is required.'}
              </div>
            </div>
            <div className="rounded-xl border border-border/70 bg-background/70 p-3 text-sm">
              <div className="font-semibold">Calculated Ug</div>
              <div className="mt-1 text-muted-foreground">
                {calculatedUg === '' ? 'Complete source size, OFD, and SOD.' : `${calculatedUg} ${data.requiredUgUnit}`}
              </div>
            </div>
            <div className="rounded-xl border border-border/70 bg-background/70 p-3 text-sm">
              <div className="font-semibold">Figure 3 minimum SFD</div>
              <div className="mt-1 text-muted-foreground">
                {minimumSfd === '' ? 'Enter coverage diameter up to the plotted limit.' : `Approximately ${minimumSfd} ${data.coverageDiameterUnit}`}
              </div>
            </div>
          </div>

          {source.sourceType === 'X-ray' ? (
            <div className="rounded-xl border border-border/70 bg-background/70 p-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold">Figure 2 X-ray energy</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {thinAdhesiveCase
                      ? 'Thin adhesive case: maximum 10 kVp.'
                      : energySuggestion
                        ? `Approximate ${energySuggestion.approximateKvp} kVp; displayed band ${energySuggestion.lowerKvp}-${energySuggestion.upperKvp} kVp.`
                        : 'Select a curve and enter a thickness within its plotted range.'}
                  </div>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={!thinAdhesiveCase && !energySuggestion}
                  onClick={() => set('tubeVoltage', thinAdhesiveCase ? 10 : energySuggestion?.approximateKvp ?? '')}
                >
                  Apply approximate kVp
                </Button>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-warning/30 bg-warning/10 p-3 text-sm text-warning">
              Figure 2, Table 1, and the kVp suggestion do not define Gamma exposure settings.
            </div>
          )}

          {equivalenceRow ? (
            <div className="rounded-xl border border-border/70 bg-background/70 p-3">
              <div className="text-sm font-semibold">Table 1 factors - {equivalenceRow.material}</div>
              <div className="mt-2 grid grid-cols-4 gap-2 lg:grid-cols-8">
                {PS811000_EQUIVALENCE_VOLTAGES.map((voltage) => {
                  const factors = equivalenceRow.factors as Partial<Record<number, number>>;
                  return (
                    <div key={voltage} className="rounded-lg border border-border/60 px-2 py-1.5 text-center text-xs">
                      <div className="font-medium">{voltage} kV</div>
                      <div className="text-muted-foreground">{factors[voltage] ?? 'not listed'}</div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-3 border-t border-border/60 pt-2 text-sm">
                <span className="font-semibold">Equivalent thickness: </span>
                <span className="text-muted-foreground">
                  {equivalentThickness
                    ? `${equivalentThickness.equivalentThickness} ${data.thicknessUnit} of ${equivalentThickness.referenceMaterial} `
                      + `(x${equivalentThickness.factor} at ${equivalentThickness.voltageKv} kV)`
                    : 'Enter a thickness and one of the Table 1 voltages as the tube voltage.'}
                </span>
              </div>
            </div>
          ) : null}

          <RtFilmExposureChart
            data={data}
            source={source}
            effectiveThickness={effectiveThickness}
          />
        </section>
      ) : null}

      <section className="space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Geometry &amp; wall technique</h3>
          <p className="text-xs text-muted-foreground">Planned source, part, and film geometry. Values remain explicit per view.</p>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <SelectField
            label="Wall Technique"
            value={data.wallTechnique}
            onChange={(value) => set('wallTechnique', value)}
            options={['SWSI', 'DWDI', 'DWSI']}
            hint="planned"
          />
          {lengthPair('SFD (Source-to-Film Distance)', 'sfd', 'sfdUnit')}
          {lengthPair('SOD (Source-to-Object Distance)', 'sod', 'sodUnit')}
          {lengthPair('OFD (Object-to-Film Distance)', 'ofd', 'ofdUnit')}
          <div className="rounded-xl border border-border/70 bg-muted/20 p-3">
            <div className="mb-3 flex items-center gap-3">
              <Switch
                id={magnificationId}
                checked={data.geometricMagnificationAuto}
                onCheckedChange={(checked) => set('geometricMagnificationAuto', checked)}
              />
              <Label
                htmlFor={magnificationId}
                className="text-sm font-medium"
              >
                Calculate magnification from distances
              </Label>
            </div>
            <NumberField
              label="Geometric Magnification"
              value={data.geometricMagnification}
              onChange={(value) => set('geometricMagnification', value)}
              unit={data.geometricMagnificationAuto ? 'computed' : 'manual'}
              step="0.001"
              disabled={data.geometricMagnificationAuto}
            />
          </div>
          <TextField
            label="Thickness Description"
            value={data.thicknessDescription}
            onChange={(value) => set('thicknessDescription', value)}
            placeholder="Describe the radiographic thickness path"
          />
          <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_7.5rem] gap-2 md:col-span-2">
            <NumberField label="Thickness Min" value={data.thicknessMin} onChange={(value) => set('thicknessMin', value)} min={0} />
            <NumberField label="Thickness Max" value={data.thicknessMax} onChange={(value) => set('thicknessMax', value)} min={0} />
            <SelectField label="Unit" value={data.thicknessUnit} onChange={(value) => set('thicknessUnit', value)} options={LENGTH_UNITS} />
          </div>
          {lengthPair(
            ps811000Applicable ? 'Stricter Controlled Ug Override (optional)' : 'Required Geometric Unsharpness (Ug)',
            'requiredUg',
            'requiredUgUnit',
          )}
          <TextField
            label="IQI Override"
            value={data.iqiOverride}
            onChange={(value) => set('iqiOverride', value)}
            placeholder="Leave blank to use the technique IQI plan"
          />
        </div>
      </section>

      <section className="space-y-3 border-t border-border/70 pt-5">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Exposure &amp; beam controls</h3>
          <p className="text-xs text-muted-foreground">Planned settings only; record performed values in the inspection record.</p>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {source.sourceType === 'X-ray' ? (
            <>
              <NumberField label="Tube Voltage" value={data.tubeVoltage} onChange={(value) => set('tubeVoltage', value)} unit={data.tubeVoltageUnit} min={0} />
              <NumberField label="Tube Current" value={data.tubeCurrent} onChange={(value) => set('tubeCurrent', value)} unit={data.tubeCurrentUnit} min={0} />
            </>
          ) : null}
          <div className="grid grid-cols-[minmax(0,1fr)_7.5rem] gap-2">
            <NumberField label="Exposure Time" value={data.exposureTime} onChange={(value) => set('exposureTime', value)} min={0} />
            <SelectField label="Unit" value={data.exposureTimeUnit} onChange={(value) => set('exposureTimeUnit', value)} options={TIME_UNITS} />
          </div>
          <NumberField label="Beam Angle" value={data.beamAngle} onChange={(value) => set('beamAngle', value)} unit="degrees" min={0} max={360} />
          <TextField label="Filter" value={data.filter} onChange={(value) => set('filter', value)} placeholder="Material and thickness" />
          <TextField label="Collimation" value={data.collimation} onChange={(value) => set('collimation', value)} placeholder="Planned field and masking" />
        </div>
        {source.sourceType === 'X-ray' ? (
          <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
            <div className="rounded-xl border border-border/70 bg-muted/20 p-3 text-sm">
              <div className="font-semibold">Calculated exposure product</div>
              <div className="mt-1 text-muted-foreground">
                {exposureMas === '' ? 'Enter machine-specific mA and exposure time.' : `${exposureMas} mAs`}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">The specification requires recording mA x time; it does not supply machine mA values.</p>
            </div>
            <div className="rounded-xl border border-border/70 bg-muted/20 p-3 text-sm">
              <div className="font-semibold">Table 2 lead-screen lookup</div>
              {screenRecommendations.length ? (
                <ul className="mt-1 space-y-1 text-xs text-muted-foreground">
                  {screenRecommendations.map((row) => (
                    <li key={row.range}>
                      {row.range}: front {row.frontMinimumInch === row.frontMaximumInch ? row.frontMaximumInch : `${row.frontMinimumInch}-${row.frontMaximumInch}`} in; back minimum {row.backMinimumInch} in.
                    </li>
                  ))}
                </ul>
              ) : <div className="mt-1 text-muted-foreground">Enter a listed X-ray voltage.</div>}
            </div>
          </div>
        ) : null}
      </section>

      <section className="space-y-3 border-t border-border/70 pt-5">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Film loading, coverage &amp; identification</h3>
          <p className="text-xs text-muted-foreground">Define the planned media arrangement and traceable image marking.</p>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <TextField label="Film Designation" value={data.filmDesignation} onChange={(value) => set('filmDesignation', value)} />
          <TextField label="Film Size" value={data.filmSize} onChange={(value) => set('filmSize', value)} placeholder="Dimensions and unit" />
          <NumberField label="Maximum Parts per Exposure" value={data.maxParts} onChange={(value) => set('maxParts', value)} min={1} step={1} />
          <NumberField label="Maximum Cassettes per Exposure" value={data.maxCassettes} onChange={(value) => set('maxCassettes', value)} min={1} step={1} />
          <TextField label="Screen Override" value={data.screenOverride} onChange={(value) => set('screenOverride', value)} placeholder="Leave blank to use the film-system screens" />
          <TextField label="Required Overlap" value={data.overlap} onChange={(value) => set('overlap', value)} placeholder="Amount, unit, or controlled instruction" />
          <TextField label="Identification Scheme" value={data.identification} onChange={(value) => set('identification', value)} placeholder="Planned image markers and traceability" />
          <TextAreaField label="Exposure Notes" value={data.notes} onChange={(value) => set('notes', value)} rows={3} />
        </div>
      </section>
    </div>
  );
}
