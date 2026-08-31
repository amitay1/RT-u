import type { ReactNode } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ASTM_E747_WIRE_SETS, ASTM_E1025_PLAQUE_TABLE } from '@/lib/rtIqiReference';
import { RT_DUPLEX_ELEMENTS } from '@/lib/rtDuplexIqi';

interface Props {
  /** Optional computed panel (e.g. an EPS readout) rendered above the reference tables. */
  children?: ReactNode;
}

/**
 * Built-in ASTM E747 / E1025 dimensional reference tables, shared by the
 * RT-Film and RT-Digital IQI tabs. Reference display only — nothing here
 * writes into the controlled document.
 */
export const AstmIqiReferenceCard = ({ children }: Props) => (
  <Card>
    <CardHeader>
      <CardTitle className="text-base">ASTM E747 / E1025 dimensional reference</CardTitle>
      <p className="text-sm text-muted-foreground">
        Built-in wire and plaque identity tables. Reference only — no value is inserted into the controlled
        document, and the governing specification decides the required designation and quality level.
        Verify against the controlled revision in force.
      </p>
    </CardHeader>
    <CardContent className="space-y-4">
      {children}

      <details className="rounded-xl border border-border/70 bg-background/60 p-3">
        <summary className="cursor-pointer text-sm font-semibold">E747 wire sets A-D (wires 1-21)</summary>
        <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
          {ASTM_E747_WIRE_SETS.map((wireSet) => (
            <div key={wireSet.set} className="overflow-x-auto">
              <table className="w-full min-w-[320px] text-left text-xs">
                <thead className="text-muted-foreground">
                  <tr>
                    <th className="p-2">{`Set ${wireSet.set} wire`}</th>
                    <th className="p-2">Diameter (inch)</th>
                    <th className="p-2">Diameter (mm)</th>
                  </tr>
                </thead>
                <tbody>
                  {wireSet.wires.map((wire) => (
                    <tr key={wire.wireNumber} className="border-t border-border/60">
                      <td className="p-2">{wire.wireNumber}</td>
                      <td className="p-2">{wire.diameterInch}</td>
                      <td className="p-2">{wire.diameterMm}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      </details>

      <details className="rounded-xl border border-border/70 bg-background/60 p-3">
        <summary className="cursor-pointer text-sm font-semibold">E1025 hole-type plaques (1T / 2T / 4T)</summary>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-xs">
            <thead className="text-muted-foreground">
              <tr>
                <th className="p-2">Designation</th>
                <th className="p-2">Thickness (inch)</th>
                <th className="p-2">Thickness (mm)</th>
                <th className="p-2">1T hole (inch)</th>
                <th className="p-2">2T hole (inch)</th>
                <th className="p-2">4T hole (inch)</th>
              </tr>
            </thead>
            <tbody>
              {ASTM_E1025_PLAQUE_TABLE.map((row) => (
                <tr key={row.designation} className="border-t border-border/60">
                  <td className="p-2">{row.designation}</td>
                  <td className="p-2">{row.thicknessInch}</td>
                  <td className="p-2">{row.thicknessMm}</td>
                  <td className="p-2">{row.hole1TInch}</td>
                  <td className="p-2">{row.hole2TInch}</td>
                  <td className="p-2">{row.hole4TInch}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-xs text-muted-foreground">
            Hole diameters are 1T/2T/4T of the plaque thickness, never below the E1025 minimums of
            0.010 / 0.020 / 0.040 inch.
          </p>
        </div>
      </details>

      <details className="rounded-xl border border-border/70 bg-background/60 p-3">
        <summary className="cursor-pointer text-sm font-semibold">Duplex-wire elements (ISO 19232-5 / ASTM E2002)</summary>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[460px] text-left text-xs">
            <thead className="text-muted-foreground">
              <tr>
                <th className="p-2">Element</th>
                <th className="p-2">Wire diameter / spacing (mm)</th>
                <th className="p-2">Unsharpness at limit (mm)</th>
                <th className="p-2">Equivalent SRb (mm)</th>
              </tr>
            </thead>
            <tbody>
              {RT_DUPLEX_ELEMENTS.map((row) => (
                <tr key={row.element} className="border-t border-border/60">
                  <td className="p-2">{row.element}</td>
                  <td className="p-2">{row.wireDiameterMm}</td>
                  <td className="p-2">{row.unsharpnessMm}</td>
                  <td className="p-2">{row.wireDiameterMm}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-xs text-muted-foreground">
            An element is resolved when its wire pair separates: total unsharpness 2d, basic spatial
            resolution SRb = d. The governing specification decides which element a technique must resolve.
          </p>
        </div>
      </details>
    </CardContent>
  </Card>
);
