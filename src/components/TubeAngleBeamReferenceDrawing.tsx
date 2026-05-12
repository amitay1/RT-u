import { useMemo } from "react";
import { AlertTriangle, Maximize2, Ruler } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { PartGeometry } from "@/types/techniqueSheet";
import { resolveWallThickness } from "@/utils/inspectionThickness";
import {
  formatTubeAngleBeamRange,
  getTubeAngleBeamDrawing,
  isTubeAngleBeamPartType,
} from "@/utils/tubeAngleBeamDrawings";

interface TubeAngleBeamReferenceDrawingProps {
  partType?: PartGeometry | "" | null;
  outerDiameter?: number;
  innerDiameter?: number;
  wallThickness?: number;
}

function formatValue(value?: number): string {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? `${value.toFixed(1)} mm` : "Not set";
}

export function TubeAngleBeamReferenceDrawing({
  partType,
  outerDiameter,
  innerDiameter,
  wallThickness,
}: TubeAngleBeamReferenceDrawingProps) {
  const resolvedWallThickness = useMemo(
    () =>
      resolveWallThickness({
        partType: partType || "",
        partThickness: 0,
        isHollow: true,
        diameter: outerDiameter,
        innerDiameter,
        wallThickness,
      }),
    [innerDiameter, outerDiameter, partType, wallThickness],
  );

  const selection = useMemo(
    () => getTubeAngleBeamDrawing(outerDiameter, resolvedWallThickness),
    [outerDiameter, resolvedWallThickness],
  );

  if (!isTubeAngleBeamPartType(partType)) {
    return null;
  }

  const isOutsideTableRange =
    selection !== null && (!selection.diameterInRange || !selection.thicknessInRange);

  return (
    <section className="workstation-card mt-5 overflow-visible border-0 p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold">Tube Angle Beam Reference Drawing</h3>
          <p className="text-xs text-muted-foreground">
            Selected from the scanned shear-wave calibration block table using OD and wall thickness.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {selection && (
            <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary">
              {selection.requested.blockId}
            </Badge>
          )}
          <Badge variant="secondary">Live PDF Match</Badge>
        </div>
      </div>

      {!selection ? (
        <div className="rounded-lg border border-dashed border-border/70 bg-background/70 p-5 text-sm text-muted-foreground">
          Enter a valid tube OD and ID or wall thickness to select the angle beam drawing.
        </div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
          <div className="space-y-3 rounded-lg border border-border/70 bg-background/70 p-4">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Ruler className="h-4 w-4 text-primary" />
              Current Setup
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <span className="text-muted-foreground">OD</span>
              <span className="text-right font-medium">{formatValue(outerDiameter)}</span>
              <span className="text-muted-foreground">Wall</span>
              <span className="text-right font-medium">{formatValue(resolvedWallThickness)}</span>
              <span className="text-muted-foreground">Matched row</span>
              <span className="text-right font-medium">{selection.requested.blockId}</span>
              <span className="text-muted-foreground">Dia range</span>
              <span className="text-right font-medium">
                {formatTubeAngleBeamRange(selection.requested.diameterRange)}
              </span>
              <span className="text-muted-foreground">Thick range</span>
              <span className="text-right font-medium">
                {formatTubeAngleBeamRange(selection.requested.thicknessRange)}
              </span>
              <span className="text-muted-foreground">Displayed sheet</span>
              <span className="text-right font-medium">{selection.displayed.blockId}</span>
            </div>

            {isOutsideTableRange && (
              <div className="flex gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-300">
                <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                <span>The entered size is outside the PDF table range, so the closest representative row is selected.</span>
              </div>
            )}

            {!selection.exactImageAvailable && (
              <div className="flex gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-300">
                <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                <span>
                  The scanned PDF does not include sheet {selection.requested.blockId}; showing closest available sheet{" "}
                  {selection.displayed.blockId}.
                </span>
              </div>
            )}

            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => window.open(selection.imageSrc, "_blank", "noopener,noreferrer")}
            >
              <Maximize2 className="mr-2 h-4 w-4" />
              Open Full Size
            </Button>
          </div>

          <div className="min-h-[560px] overflow-hidden rounded-lg border border-border/70 bg-white p-3">
            <img
              key={`${selection.requested.blockId}-${selection.displayed.blockId}`}
              src={selection.imageSrc}
              alt={`Tube angle beam calibration block drawing ${selection.displayed.blockId}`}
              className="h-full max-h-[760px] min-h-[520px] w-full object-contain"
              loading="eager"
            />
          </div>
        </div>
      )}
    </section>
  );
}

export default TubeAngleBeamReferenceDrawing;
