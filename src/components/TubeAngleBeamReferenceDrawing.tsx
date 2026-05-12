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
    <section className="space-y-4" data-testid="tube-angle-beam-reference-drawing">
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
          {selection && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => window.open(selection.imageSrc, "_blank", "noopener,noreferrer")}
            >
              <Maximize2 className="mr-2 h-4 w-4" />
              Open Full Size
            </Button>
          )}
        </div>
      </div>

      {!selection ? (
        <div className="rounded-lg border border-dashed border-border/70 bg-background/70 p-5 text-sm text-muted-foreground">
          Enter a valid tube OD and ID or wall thickness to select the angle beam drawing.
        </div>
      ) : (
        <div className="space-y-3">
          <div className="rounded-lg border border-border/70 bg-background/70 p-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-medium">
              <Ruler className="h-4 w-4 text-primary" />
              Current Setup
            </div>

            <div className="grid gap-3 text-xs sm:grid-cols-2 lg:grid-cols-6">
              <div>
                <div className="text-muted-foreground">OD</div>
                <div className="font-medium">{formatValue(outerDiameter)}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Wall</div>
                <div className="font-medium">{formatValue(resolvedWallThickness)}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Matched row</div>
                <div className="font-medium">{selection.requested.blockId}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Dia range</div>
                <div className="font-medium">{formatTubeAngleBeamRange(selection.requested.diameterRange)}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Thick range</div>
                <div className="font-medium">{formatTubeAngleBeamRange(selection.requested.thicknessRange)}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Displayed sheet</div>
                <div className="font-medium">{selection.displayed.blockId}</div>
              </div>
            </div>
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

          <div className="overflow-auto rounded-lg border border-border/70 bg-white p-3">
            <img
              key={`${selection.requested.blockId}-${selection.displayed.blockId}`}
              src={selection.imageSrc}
              alt={`Tube angle beam calibration block drawing ${selection.displayed.blockId}`}
              className="h-auto w-full min-w-[900px]"
              loading="eager"
            />
          </div>
        </div>
      )}
    </section>
  );
}

export default TubeAngleBeamReferenceDrawing;
