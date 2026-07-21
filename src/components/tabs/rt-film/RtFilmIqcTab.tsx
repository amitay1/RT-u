import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { LengthUnit, RtFilmGeneralInfo, RtFilmIqi } from '@/types/rtFilm';
import { NumberField, SelectField, TextField } from '@/components/tabs/shared/FieldRow';
import {
  calculateIqiSensitivityPercent,
  lookupPs811000ImageQualityRequirement,
  PS811000_EXAMINATION_QUALITY_LEVELS,
  PS811000_PENETRAMETER_MATERIALS,
  PS811000_WIRE_IQI_GROUPS,
  PS811000_WIRE_TABLE,
} from '@/lib/ps811000';

interface Props {
  data: RtFilmIqi;
  general: RtFilmGeneralInfo;
  ps811000Applicable: boolean;
  onChange: (data: RtFilmIqi) => void;
}

const LENGTH_UNITS: ReadonlyArray<{ label: string; value: LengthUnit }> = [
  { label: 'mm', value: 'mm' },
  { label: 'inch', value: 'inch' },
];

export const RtFilmIqcTab = ({ data, general, ps811000Applicable, onChange }: Props) => {
  const set = <K extends keyof RtFilmIqi>(key: K, value: RtFilmIqi[K]) => (
    onChange({ ...data, [key]: value })
  );
  const calculatedSensitivity = calculateIqiSensitivityPercent(
    data.thickness,
    data.thicknessUnit,
    general.thickness,
    general.thicknessUnit,
  );
  const imageQualityRequirement = ps811000Applicable
    ? lookupPs811000ImageQualityRequirement(general.thickness, general.thicknessUnit)
    : null;

  return (
    <div className="space-y-4">
      <Card>
      <CardHeader>
        <CardTitle>5. IQI &amp; Image Quality Requirements</CardTitle>
        <p className="text-sm text-muted-foreground">
          Define planned IQI selection and required image quality. Achieved readings belong to the inspection record.
        </p>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <TextField label="IQI Type" value={data.type} onChange={(value) => set('type', value)} placeholder="Wire, hole, or controlled type" />
        <TextField label="IQI Standard" value={data.standard} onChange={(value) => set('standard', value)} />
        <TextField label="IQI Designation" value={data.designation} onChange={(value) => set('designation', value)} />
        <TextField label="IQI Material" value={data.material} onChange={(value) => set('material', value)} />
        <TextField label="Shim Requirement" value={data.shim} onChange={(value) => set('shim', value)} />
        <TextField label="Block Requirement" value={data.block} onChange={(value) => set('block', value)} />
        <div className="grid grid-cols-[minmax(0,1fr)_7.5rem] gap-2">
          <NumberField label="IQI Thickness" value={data.thickness} onChange={(value) => set('thickness', value)} min={0} />
          <SelectField label="Unit" value={data.thicknessUnit} onChange={(value) => set('thicknessUnit', value)} options={LENGTH_UNITS} />
        </div>
        <TextField label="Placement" value={data.placement} onChange={(value) => set('placement', value)} placeholder="Source side, film side, and marking instruction" />
        <TextField label="Required Sensitivity" value={data.requiredSensitivity} onChange={(value) => set('requiredSensitivity', value)} />
        <TextField label="Image Quality Level" value={data.imageQualityLevel} onChange={(value) => set('imageQualityLevel', value)} />
        <div className="grid grid-cols-[minmax(0,1fr)_7.5rem] gap-2">
          <NumberField label="Required Ug" value={data.requiredUg} onChange={(value) => set('requiredUg', value)} min={0} />
          <SelectField label="Unit" value={data.requiredUgUnit} onChange={(value) => set('requiredUgUnit', value)} options={LENGTH_UNITS} />
        </div>
      </CardContent>
      </Card>

      {ps811000Applicable ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">PS811000E C1 IQI lookup assistance</CardTitle>
            <p className="text-sm text-muted-foreground">Calculated and tabulated planning aids; the controlled drawing or specification may impose a different level.</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="rounded-xl border border-border/70 bg-muted/20 p-3 text-sm">
                <div className="font-semibold">Calculated IQI sensitivity</div>
                <div className="mt-1 text-muted-foreground">
                  {calculatedSensitivity === '' ? 'Enter numeric IQI and part thicknesses.' : `${calculatedSensitivity}%`}
                </div>
              </div>
              <div className="rounded-xl border border-border/70 bg-muted/20 p-3 text-sm">
                <div className="font-semibold">Table 6 row</div>
                <div className="mt-1 text-muted-foreground">
                  {imageQualityRequirement
                    ? `${imageQualityRequirement.thicknessBand}: ${imageQualityRequirement.qualityLevel}, ${imageQualityRequirement.minimumPerceptibleHole}, ${imageQualityRequirement.equivalentSensitivity}`
                    : 'Enter nominal part thickness.'}
                </div>
              </div>
            </div>

            <details className="rounded-xl border border-border/70 bg-background/60 p-3">
              <summary className="cursor-pointer text-sm font-semibold">Table 7 examination quality levels</summary>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[640px] text-left text-xs">
                  <thead className="text-muted-foreground">
                    <tr><th className="p-2">IQI</th><th className="p-2">Level</th><th className="p-2">Max IQI thickness</th><th className="p-2">Minimum hole</th><th className="p-2">Equivalent sensitivity</th></tr>
                  </thead>
                  <tbody>
                    {PS811000_EXAMINATION_QUALITY_LEVELS.map((row) => (
                      <tr key={row.iqiDesignation} className="border-t border-border/60">
                        <td className="p-2">{row.iqiDesignation}</td><td className="p-2">{row.qualityLevel}</td><td className="p-2">{row.maximumIqiThicknessPercent}%</td><td className="p-2">{row.minimumHole}</td><td className="p-2">{row.equivalentSensitivityPercent}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>

            <details className="rounded-xl border border-border/70 bg-background/60 p-3">
              <summary className="cursor-pointer text-sm font-semibold">Tables 3 and 5 material lookup</summary>
              <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="text-muted-foreground"><tr><th className="p-2">Penetrameter material</th><th className="p-2">Symbol</th></tr></thead>
                    <tbody>{PS811000_PENETRAMETER_MATERIALS.map((row) => <tr key={row.symbol} className="border-t border-border/60"><td className="p-2">{row.material}</td><td className="p-2">{row.symbol}</td></tr>)}</tbody>
                  </table>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[520px] text-left text-xs">
                    <thead className="text-muted-foreground"><tr><th className="p-2">Designation</th><th className="p-2">Wire</th><th className="p-2">Suitable material group</th></tr></thead>
                    <tbody>{PS811000_WIRE_IQI_GROUPS.map((row) => <tr key={row.designation} className="border-t border-border/60"><td className="p-2">{row.designation}</td><td className="p-2">{row.wireRange}</td><td className="p-2">{row.suitableMaterialGroup}</td></tr>)}</tbody>
                  </table>
                </div>
              </div>
            </details>

            <details className="rounded-xl border border-border/70 bg-background/60 p-3">
              <summary className="cursor-pointer text-sm font-semibold">Table 4 wire diameters and tolerances</summary>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[420px] text-left text-xs">
                  <thead className="text-muted-foreground"><tr><th className="p-2">Wire</th><th className="p-2">Diameter (mm)</th><th className="p-2">Tolerance (mm)</th></tr></thead>
                  <tbody>{PS811000_WIRE_TABLE.map((row) => <tr key={row.wire} className="border-t border-border/60"><td className="p-2">{row.wire}</td><td className="p-2">{row.diameterMm}</td><td className="p-2">±{row.toleranceMm}</td></tr>)}</tbody>
                </table>
              </div>
            </details>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
};
