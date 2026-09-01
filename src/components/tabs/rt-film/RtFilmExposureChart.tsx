import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { NumberField, SelectField } from '@/components/tabs/shared/FieldRow';
import {
  buildPs811000ExposureChart,
  ugLimitInUnit,
} from '@/lib/ps811000ExposureChart';
import { PS811000_ENERGY_CURVE_LABELS } from '@/lib/ps811000';
import type {
  RtFilmExposureDefaults,
  RtFilmSource,
  TimeUnit,
} from '@/types/rtFilm';

interface RtFilmExposureChartProps {
  data: RtFilmExposureDefaults;
  source: RtFilmSource;
  /** Effective radiographic thickness resolved by the parent (honeycomb aware). */
  effectiveThickness: number | '';
}

const ROW_COUNT_OPTIONS = ['6', '8', '10', '12', '16', '20'] as const;

const formatNumber = (value: number, digits = 2): string => (
  Number.isInteger(value) ? String(value) : value.toFixed(digits)
);

export function RtFilmExposureChart({
  data,
  source,
  effectiveThickness,
}: RtFilmExposureChartProps) {
  const [rowCount, setRowCount] = useState<string>('10');
  const [fromOverride, setFromOverride] = useState<number | ''>('');
  const [toOverride, setToOverride] = useState<number | ''>('');

  const thicknessFrom = fromOverride !== '' ? fromOverride : data.thicknessMin;
  const thicknessTo = toOverride !== ''
    ? toOverride
    : (data.thicknessMax !== '' ? data.thicknessMax : effectiveThickness);

  const storedAnchors = source.exposureChartAnchors;

  const chart = useMemo(() => buildPs811000ExposureChart({
    curve: data.ps811000EnergyCurve,
    thicknessFrom,
    thicknessTo,
    thicknessUnit: data.thicknessUnit,
    rowCount: Number(rowCount),
    equivalenceMaterial: data.ps811000EquivalenceMaterial,
    // Table 1 lists eight discrete voltages; use the planned one so the column
    // can resolve, and fall back to each row's own Figure 2 reading.
    equivalenceVoltageKv: data.tubeVoltage,
    anchors: storedAnchors ?? [],
    machineVoltageKv: data.tubeVoltage,
    targetSfd: data.sfd,
    targetSfdUnit: data.sfdUnit,
    plannedCurrentMa: data.tubeCurrent,
    exposureTimeUnit: (data.exposureTimeUnit || 's') as TimeUnit,
  }), [
    data.ps811000EnergyCurve,
    data.ps811000EquivalenceMaterial,
    data.thicknessUnit,
    data.tubeVoltage,
    data.tubeCurrent,
    data.sfd,
    data.sfdUnit,
    data.exposureTimeUnit,
    thicknessFrom,
    thicknessTo,
    rowCount,
    storedAnchors,
  ]);

  const timeUnitLabel = (data.exposureTimeUnit || 's') === 'min' ? 'min' : 's';
  const showMachineColumns = chart.fit !== null;

  return (
    <div className="space-y-3 rounded-xl border border-border/70 bg-background/70 p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold">PS811000E exposure chart</div>
          <p className="note-clamp text-xs text-muted-foreground">
            Read kV straight off the row. Figure 2 gives the energy for
            {' '}
            {data.ps811000EnergyCurve
              ? PS811000_ENERGY_CURVE_LABELS[data.ps811000EnergyCurve].toLowerCase()
              : 'the selected material curve'}
            ; para. 9.2.1 permits the band shown. Table 8 and Table 2 columns are exact lookups.
          </p>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <NumberField
            label="Chart From"
            value={fromOverride}
            onChange={setFromOverride}
            unit={data.thicknessUnit}
            min={0}
          />
          <NumberField
            label="Chart To"
            value={toOverride}
            onChange={setToOverride}
            unit={data.thicknessUnit}
            min={0}
          />
          <SelectField
            label="Rows"
            value={rowCount}
            onChange={setRowCount}
            options={ROW_COUNT_OPTIONS as unknown as readonly string[]}
          />
        </div>
      </div>

      {chart.rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border px-3 py-4 text-sm text-muted-foreground">
          Enter a thickness range (Thickness Min and Thickness Max, or the chart overrides above) to build the table.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[46rem] border-collapse text-xs">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="px-2 py-1.5 font-medium">
                  Thickness (
                  {data.thicknessUnit}
                  )
                </th>
                {data.ps811000EquivalenceMaterial ? (
                  <th className="px-2 py-1.5 font-medium">Equivalent (Table 1)</th>
                ) : null}
                <th className="px-2 py-1.5 font-medium">kVp (Fig. 2)</th>
                <th className="px-2 py-1.5 font-medium">kVp band &plusmn;20%</th>
                <th className="px-2 py-1.5 font-medium">
                  Max Ug (
                  {data.requiredUgUnit}
                  )
                </th>
                <th className="px-2 py-1.5 font-medium">Lead screens (Table 2)</th>
                {showMachineColumns ? (
                  <>
                    <th className="px-2 py-1.5 font-medium">mAs</th>
                    <th className="px-2 py-1.5 font-medium">mA</th>
                    <th className="px-2 py-1.5 font-medium">
                      Time (
                      {timeUnitLabel}
                      )
                    </th>
                  </>
                ) : null}
              </tr>
            </thead>
            <tbody>
              {chart.rows.map((row) => {
                const ugMax = ugLimitInUnit(row.ugLimit, data.requiredUgUnit);
                const screen = row.leadScreens[0];
                return (
                  <tr key={row.thickness} className="border-b border-border/50 last:border-0">
                    <td className="px-2 py-1.5 font-medium text-foreground">{formatNumber(row.thickness)}</td>
                    {data.ps811000EquivalenceMaterial ? (
                      <td className="px-2 py-1.5 text-muted-foreground">
                        {row.equivalentThickness === null
                          ? 'not listed'
                          : `${formatNumber(row.equivalentThickness)} (x${row.equivalenceFactor})`}
                      </td>
                    ) : null}
                    <td className="px-2 py-1.5 text-foreground">
                      {row.approximateKvp === null ? '-' : row.approximateKvp}
                    </td>
                    <td className="px-2 py-1.5 text-muted-foreground">
                      {row.lowerKvp === null || row.upperKvp === null
                        ? '-'
                        : `${row.lowerKvp} - ${row.upperKvp}`}
                    </td>
                    <td className="px-2 py-1.5 text-muted-foreground">
                      {ugMax === null ? '-' : ugMax}
                    </td>
                    <td className="px-2 py-1.5 text-muted-foreground">
                      {screen
                        ? `front ${screen.frontMaximumInch} in / back ${screen.backMinimumInch} in`
                        : '-'}
                    </td>
                    {showMachineColumns ? (
                      <>
                        <td className="px-2 py-1.5 text-foreground">
                          {row.mas === null ? '-' : formatNumber(row.mas)}
                          {row.masExtrapolated ? (
                            <span className="ml-1 text-warning" title="Outside the anchor thickness range">*</span>
                          ) : null}
                        </td>
                        <td className="px-2 py-1.5 text-muted-foreground">
                          {row.currentMa === null ? 'set mA' : formatNumber(row.currentMa)}
                        </td>
                        <td className="px-2 py-1.5 text-muted-foreground">
                          {row.exposureTime === null ? '-' : formatNumber(row.exposureTime, 3)}
                        </td>
                      </>
                    ) : null}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {chart.machineChartNotice ? (
        <p className="text-xs text-muted-foreground">{chart.machineChartNotice}</p>
      ) : null}

      {chart.fit ? (
        <p className="note-clamp text-xs text-muted-foreground">
          mAs derived from
          {' '}
          {chart.fit.anchorCount}
          {' '}
          qualified exposures on this machine at
          {' '}
          {chart.fit.voltageKv}
          {' '}
          kV, corrected to the planned SFD by the inverse-square law. Rows marked * fall outside the
          anchored thickness range and must be verified before use. PS811000E supplies no mA values.
        </p>
      ) : null}
    </div>
  );
}

interface RtFilmExposureAnchorEditorProps {
  source: RtFilmSource;
  onChange: (source: RtFilmSource) => void;
}

export function RtFilmExposureAnchorEditor({ source, onChange }: RtFilmExposureAnchorEditorProps) {
  const anchors = source.exposureChartAnchors ?? [];

  const setAnchor = (id: string, patch: Partial<(typeof anchors)[number]>) => onChange({
    ...source,
    exposureChartAnchors: anchors.map((anchor) => (
      anchor.id === id ? { ...anchor, ...patch } : anchor
    )),
  });

  const addAnchor = () => onChange({
    ...source,
    exposureChartAnchors: [
      ...anchors,
      {
        id: `anchor-${anchors.length + 1}-${Math.random().toString(36).slice(2, 8)}`,
        description: '',
        thickness: '' as const,
        thicknessUnit: 'mm' as const,
        tubeVoltage: '' as const,
        tubeCurrent: '' as const,
        exposureTime: '' as const,
        exposureTimeUnit: 's' as const,
        sfd: '' as const,
        sfdUnit: 'mm' as const,
        measuredDensity: '' as const,
      },
    ],
  });

  const removeAnchor = (id: string) => onChange({
    ...source,
    exposureChartAnchors: anchors.filter((anchor) => anchor.id !== id),
  });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold">Machine exposure chart anchors</div>
          <p className="note-clamp text-xs text-muted-foreground">
            PS811000E requires milliamperage to be recorded (para. 9.12.8.m) but supplies no machine
            values. Record qualified exposures from this tube here: two or more at the same kV and
            different thicknesses let the technique sheet derive mA and time for every thickness.
          </p>
        </div>
        <Button type="button" size="sm" variant="outline" onClick={addAnchor}>
          Add anchor exposure
        </Button>
      </div>

      {anchors.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border px-4 py-5 text-sm text-muted-foreground">
          No anchor exposures recorded. The exposure chart will show kV only.
        </div>
      ) : (
        <div className="space-y-3">
          {anchors.map((anchor) => (
            <div key={anchor.id} className="rounded-xl border border-border/70 bg-background/60 p-3">
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
                <NumberField
                  label="Thickness"
                  value={anchor.thickness}
                  onChange={(thickness) => setAnchor(anchor.id, { thickness })}
                  unit={anchor.thicknessUnit}
                  min={0}
                />
                <SelectField
                  label="Unit"
                  value={anchor.thicknessUnit}
                  onChange={(thicknessUnit) => setAnchor(anchor.id, { thicknessUnit })}
                  options={['mm', 'inch']}
                />
                <NumberField
                  label="kV"
                  value={anchor.tubeVoltage}
                  onChange={(tubeVoltage) => setAnchor(anchor.id, { tubeVoltage })}
                  unit="kV"
                  min={0}
                />
                <NumberField
                  label="mA"
                  value={anchor.tubeCurrent}
                  onChange={(tubeCurrent) => setAnchor(anchor.id, { tubeCurrent })}
                  unit="mA"
                  min={0}
                />
                <NumberField
                  label="Time"
                  value={anchor.exposureTime}
                  onChange={(exposureTime) => setAnchor(anchor.id, { exposureTime })}
                  unit={anchor.exposureTimeUnit === 'min' ? 'min' : 's'}
                  min={0}
                />
                <NumberField
                  label="SFD"
                  value={anchor.sfd}
                  onChange={(sfd) => setAnchor(anchor.id, { sfd })}
                  unit={anchor.sfdUnit}
                  min={0}
                />
                <NumberField
                  label="Measured Density"
                  value={anchor.measuredDensity}
                  onChange={(measuredDensity) => setAnchor(anchor.id, { measuredDensity })}
                  unit="H&D"
                  min={0}
                  step="0.1"
                />
              </div>
              <div className="mt-2 flex justify-end">
                <Button type="button" size="sm" variant="ghost" onClick={() => removeAnchor(anchor.id)}>
                  Remove
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
