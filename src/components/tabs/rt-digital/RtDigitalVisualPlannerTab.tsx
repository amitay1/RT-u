import {
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Crosshair,
  Grid3X3,
  Move,
  RotateCw,
  Sparkles,
} from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { NumberField, SelectField } from '@/components/tabs/shared/FieldRow';
import {
  calculateRtDigitalPlanning,
  convertRtDigitalLength,
  resolveRtDigitalInspectionArea,
  type RtDigitalCoverageResult,
  type RtDigitalExposureGridDescriptor,
} from '@/lib/rtDigitalPlanning';
import type {
  RtDigitalAcquisitionDefaults,
  RtDigitalAcquisitionVisualControls,
  RtDigitalIqiZoneOutput,
  RtDigitalPlanning,
  RtDigitalSource,
  RtDigitalSystem,
  RtDigitalVisualPoint,
} from '@/types/rtDigital';

type VisualTarget = 'source' | 'detector' | 'beam';

export interface RtDigitalVisualPlannerTabProps {
  planning: RtDigitalPlanning;
  source: RtDigitalSource;
  system: RtDigitalSystem;
  defaults: RtDigitalAcquisitionDefaults;
  visual: RtDigitalAcquisitionVisualControls;
  onPlanningChange: (planning: RtDigitalPlanning) => void;
  onDefaultsChange: (defaults: RtDigitalAcquisitionDefaults) => void;
  onVisualChange: (visual: RtDigitalAcquisitionVisualControls) => void;
  onCommitGrid: (
    grid: RtDigitalExposureGridDescriptor[],
    inspectionAreaId: string,
    governingIqi?: RtDigitalIqiZoneOutput,
  ) => void;
}

const clamp = (value: number, minimum: number, maximum: number): number => (
  Math.min(maximum, Math.max(minimum, value))
);

const pointValue = (point: RtDigitalVisualPoint, fallbackX: number, fallbackY: number) => ({
  x: typeof point.x === 'number' && Number.isFinite(point.x) ? clamp(point.x, 0, 1) : fallbackX,
  y: typeof point.y === 'number' && Number.isFinite(point.y) ? clamp(point.y, 0, 1) : fallbackY,
});

const millimetres = (value: number | '', unit: 'um' | 'mm' | 'inch'): number | null => (
  convertRtDigitalLength(value, unit, 'mm')
);

const valueFromMillimetres = (value: number, unit: 'um' | 'mm' | 'inch'): number => (
  convertRtDigitalLength(value, 'mm', unit) ?? value
);

const coverageLabel = (coverage: RtDigitalCoverageResult): string => {
  if (coverage.status !== 'complete') return coverage.issues.join(' ') || 'Coverage inputs are incomplete.';
  if (coverage.warnings.includes('underlap')) return 'Underlap detected: the committed grid would leave uncovered area.';
  if (coverage.warnings.includes('excessive-overlap')) return 'Coverage is complete, but the overlap warning threshold is exceeded.';
  return 'Coverage is complete and within the configured overlap warning threshold.';
};

const keyboardDelta = (event: KeyboardEvent<SVGGElement>): { dx: number; dy: number } | null => {
  const step = event.shiftKey ? 0.05 : 0.01;
  if (event.key === 'ArrowLeft') return { dx: -step, dy: 0 };
  if (event.key === 'ArrowRight') return { dx: step, dy: 0 };
  if (event.key === 'ArrowUp') return { dx: 0, dy: -step };
  if (event.key === 'ArrowDown') return { dx: 0, dy: step };
  return null;
};

export function RtDigitalVisualPlannerTab({
  planning,
  source,
  system,
  defaults,
  visual,
  onPlanningChange,
  onDefaultsChange,
  onVisualChange,
  onCommitGrid,
}: RtDigitalVisualPlannerTabProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const clipId = `rt-digital-coverage-${useId().replace(/:/g, '')}`;
  const [dragTarget, setDragTarget] = useState<VisualTarget | null>(null);
  const [activeTarget, setActiveTarget] = useState<VisualTarget>('beam');
  const geometry = planning.geometry;
  const selectedArea = resolveRtDigitalInspectionArea(planning.part, geometry.inspectionAreaId);

  const calculation = useMemo(() => calculateRtDigitalPlanning({
    geometry: {
      distanceBasis: geometry.distanceBasis,
      sod: geometry.sod,
      sdd: geometry.sdd,
      odd: geometry.odd,
      focalSpotSize: { value: source.focalSpotSize, unit: source.focalSpotSizeUnit },
      requiredMaximumUg: geometry.requiredMaximumUg,
      detectorPixelSize: { value: system.pixelSize, unit: system.pixelSizeUnit },
      detectorActiveWidth: { value: system.activeAreaWidth, unit: system.activeAreaUnit },
      detectorActiveHeight: { value: system.activeAreaHeight, unit: system.activeAreaUnit },
      requiredMaximumEffectivePixel: geometry.requiredMaximumEffectivePixel,
    },
    inspectionAreaWidth: { value: selectedArea?.width ?? '', unit: selectedArea?.unit ?? 'mm' },
    inspectionAreaHeight: { value: selectedArea?.height ?? '', unit: selectedArea?.unit ?? 'mm' },
    requiredOverlapPercent: geometry.requiredOverlapPercent,
    excessiveOverlapThresholdPercent: geometry.excessiveOverlapThresholdPercent,
  }), [geometry, selectedArea, source.focalSpotSize, source.focalSpotSizeUnit, system]);

  const preferredOrientation = calculation.orientation.preferredOrientation;
  const orientation = planning.detectorSelection.orientation === 'Portrait'
    || planning.detectorSelection.orientation === 'Landscape'
    ? planning.detectorSelection.orientation
    : preferredOrientation ?? 'Landscape';
  const orientationOption = orientation === 'Portrait'
    ? calculation.orientation.portrait
    : calculation.orientation.landscape;
  const coverage = orientationOption.coverage;
  const grid = coverage.status === 'complete' ? coverage.grid : [];
  const governingIqi = planning.iqiRules.zoneOutputs.find((output) => output.governing);

  const currentSddMm = calculation.geometry.sddMm ?? millimetres(geometry.sdd.value, geometry.sdd.unit);
  const availableDistanceMm = millimetres(
    geometry.availableSourceDistance.value,
    geometry.availableSourceDistance.unit,
  );
  const knownVisualSpanMm = Math.max(
    availableDistanceMm && availableDistanceMm > 0 ? availableDistanceMm : 0,
    currentSddMm && currentSddMm > 0 ? currentSddMm * 1.2 : 0,
  );
  const visualSpanMm = knownVisualSpanMm > 0 ? knownVisualSpanMm : 1_000;
  const millimetresPerNormalizedUnit = visualSpanMm / 0.8;
  const sourceFallbackX = 0.12;
  const detectorFallbackX = 0.88;
  const sourcePoint = pointValue(visual.sourcePosition, sourceFallbackX, 0.5);
  const detectorPoint = pointValue(visual.detectorPosition, detectorFallbackX, 0.5);
  const beamPoint = pointValue(visual.beamCenter, 0.5, 0.5);
  const detectorAngle = typeof visual.detectorRotationDegrees === 'number'
    ? visual.detectorRotationDegrees
    : orientation === 'Portrait' ? 90 : 0;

  const partBox = { x: 355, y: 115, width: 290, height: 290 };
  const region = selectedArea?.position;
  const normalizedAreaWidth = typeof region?.width === 'number' && region.width > 0
    ? clamp(region.width, 0.02, 1)
    : 0.8;
  const normalizedAreaHeight = typeof region?.height === 'number' && region.height > 0
    ? clamp(region.height, 0.02, 1)
    : 0.8;
  const normalizedAreaX = typeof region?.x === 'number'
    ? clamp(region.x, 0, 1 - normalizedAreaWidth)
    : 0.1;
  const normalizedAreaY = typeof region?.y === 'number'
    ? clamp(region.y, 0, 1 - normalizedAreaHeight)
    : 0.1;
  const areaBox = {
    x: partBox.x + normalizedAreaX * partBox.width,
    y: partBox.y + normalizedAreaY * partBox.height,
    width: normalizedAreaWidth * partBox.width,
    height: normalizedAreaHeight * partBox.height,
  };
  const areaWidthMm = selectedArea ? millimetres(selectedArea.width, selectedArea.unit) : null;
  const areaHeightMm = selectedArea ? millimetres(selectedArea.height, selectedArea.unit) : null;

  const syncDistanceDefaults = (sodMm: number, oddMm: number) => {
    const sodUnit = geometry.sod.unit === 'inch' ? 'inch' : 'mm';
    const oddUnit = geometry.odd.unit === 'inch' ? 'inch' : 'mm';
    const sod = valueFromMillimetres(sodMm, sodUnit);
    const odd = valueFromMillimetres(oddMm, oddUnit);
    onDefaultsChange({
      ...defaults,
      sod,
      sodUnit,
      odd,
      oddUnit,
    });
  };

  const updateGeometryFromPoints = (
    nextSource: { x: number; y: number },
    nextDetector: { x: number; y: number },
    nextVisual: RtDigitalAcquisitionVisualControls,
  ) => {
    const currentSodMm = calculation.geometry.sodMm
      ?? millimetres(geometry.sod.value, geometry.sod.unit)
      ?? visualSpanMm * 0.6;
    const currentOddMm = calculation.geometry.oddMm
      ?? millimetres(geometry.odd.value, geometry.odd.unit)
      ?? visualSpanMm * 0.1;
    const sodMm = Math.max(
      0.001,
      currentSodMm - (nextSource.x - sourcePoint.x) * millimetresPerNormalizedUnit,
    );
    const oddMm = Math.max(
      0,
      currentOddMm + (nextDetector.x - detectorPoint.x) * millimetresPerNormalizedUnit,
    );
    onPlanningChange({
      ...planning,
      visual: nextVisual,
      geometry: {
        ...geometry,
        distanceBasis: 'SOD + ODD',
        sod: { ...geometry.sod, value: valueFromMillimetres(sodMm, geometry.sod.unit) },
        odd: { ...geometry.odd, value: valueFromMillimetres(oddMm, geometry.odd.unit) },
      },
    });
    syncDistanceDefaults(sodMm, oddMm);
  };

  const updateTarget = (target: VisualTarget, x: number, y: number) => {
    const bounded = {
      x: target === 'source'
        ? clamp(x, 0.03, 0.44)
        : target === 'detector'
          ? clamp(x, 0.56, 0.97)
          : clamp(x, areaBox.x / 1_000, (areaBox.x + areaBox.width) / 1_000),
      y: target === 'beam'
        ? clamp(y, areaBox.y / 520, (areaBox.y + areaBox.height) / 520)
        : clamp(y, 0.05, 0.95),
    };
    if (target === 'source') {
      const angle = Math.atan2(
        (beamPoint.y - bounded.y) * 520,
        (beamPoint.x - bounded.x) * 1_000,
      ) * 180 / Math.PI;
      const nextVisual = {
        ...visual,
        sourcePosition: bounded,
        beamAngleDegrees: Number(angle.toFixed(3)),
      };
      updateGeometryFromPoints(bounded, detectorPoint, nextVisual);
      return;
    }
    if (target === 'detector') {
      const nextVisual = { ...visual, detectorPosition: bounded };
      updateGeometryFromPoints(sourcePoint, bounded, nextVisual);
      return;
    }
    const angle = Math.atan2(
      (bounded.y - sourcePoint.y) * 520,
      (bounded.x - sourcePoint.x) * 1_000,
    ) * 180 / Math.PI;
    onVisualChange({
      ...visual,
      beamCenter: bounded,
      beamAngleDegrees: Number(angle.toFixed(3)),
      inspectionAreaId: selectedArea?.id ?? '',
    });
  };

  const svgPointFromPointer = (event: ReactPointerEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    if (!svg) return null;
    const matrix = svg.getScreenCTM();
    if (!matrix) return null;
    const point = svg.createSVGPoint();
    point.x = event.clientX;
    point.y = event.clientY;
    const local = point.matrixTransform(matrix.inverse());
    return { x: local.x / 1_000, y: local.y / 520 };
  };

  const beginDrag = (target: VisualTarget, event: ReactPointerEvent<SVGGElement>) => {
    event.preventDefault();
    setActiveTarget(target);
    setDragTarget(target);
    svgRef.current?.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (!dragTarget) return;
    const point = svgPointFromPointer(event);
    if (point) updateTarget(dragTarget, point.x, point.y);
  };

  const nudge = (target: VisualTarget, dx: number, dy: number) => {
    const current = target === 'source' ? sourcePoint : target === 'detector' ? detectorPoint : beamPoint;
    updateTarget(target, current.x + dx, current.y + dy);
  };

  const handleTargetKey = (target: VisualTarget, event: KeyboardEvent<SVGGElement>) => {
    const delta = keyboardDelta(event);
    if (!delta) return;
    event.preventDefault();
    setActiveTarget(target);
    nudge(target, delta.dx, delta.dy);
  };

  const autoPosition = () => {
    const nextSource = { x: sourceFallbackX, y: 0.5 };
    const nextDetector = { x: detectorFallbackX, y: 0.5 };
    const nextBeam = {
      x: clamp((areaBox.x + areaBox.width / 2) / 1_000, 0, 1),
      y: clamp((areaBox.y + areaBox.height / 2) / 520, 0, 1),
    };
    const angle = Math.atan2(
      (nextBeam.y - nextSource.y) * 520,
      (nextBeam.x - nextSource.x) * 1_000,
    ) * 180 / Math.PI;
    onVisualChange({
      ...visual,
      sourcePosition: nextSource,
      detectorPosition: nextDetector,
      beamCenter: nextBeam,
      beamAngleDegrees: Number(angle.toFixed(3)),
      inspectionAreaId: selectedArea?.id ?? '',
    });
  };

  const rotateDetector = () => {
    const nextOrientation = orientation === 'Landscape' ? 'Portrait' : 'Landscape';
    onPlanningChange({
      ...planning,
      visual: { ...visual, detectorRotationDegrees: nextOrientation === 'Portrait' ? 90 : 0 },
      detectorSelection: { ...planning.detectorSelection, orientation: nextOrientation },
    });
  };

  const applyPreferredOrientation = () => {
    if (!preferredOrientation) return;
    onPlanningChange({
      ...planning,
      visual: {
        ...visual,
        detectorRotationDegrees: preferredOrientation === 'Portrait' ? 90 : 0,
      },
      detectorSelection: { ...planning.detectorSelection, orientation: preferredOrientation },
    });
  };

  const detectorScreen = { x: detectorPoint.x * 1_000, y: detectorPoint.y * 520 };
  const sourceScreen = { x: sourcePoint.x * 1_000, y: sourcePoint.y * 520 };
  const beamScreen = { x: beamPoint.x * 1_000, y: beamPoint.y * 520 };
  const gridPreview = grid.slice(0, 400);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle>5. Visual Inspection Planner</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                Drag or focus a control and use arrow keys. Source/detector movement explicitly updates controlled SOD/ODD inputs.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">{orientation}</Badge>
              <Badge variant={coverage.status === 'complete' && !coverage.warnings.includes('underlap') ? 'default' : 'destructive'}>
                {coverage.status === 'complete' ? `${coverage.totalExposureCount ?? 0} exposures` : coverage.status}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="overflow-hidden rounded-2xl border border-border bg-slate-950 shadow-inner">
            <svg
              ref={svgRef}
              viewBox="0 0 1000 520"
              className="block min-h-[320px] w-full touch-none select-none"
              role="application"
              aria-label="Interactive digital radiography source, part, detector, beam, and coverage planner"
              onPointerMove={handlePointerMove}
              onPointerUp={() => setDragTarget(null)}
              onPointerCancel={() => setDragTarget(null)}
            >
              <title>Interactive DR inspection geometry and exposure coverage planner</title>
              <defs>
                <linearGradient id={`${clipId}-beam`} x1="0" x2="1">
                  <stop offset="0" stopColor="#fde047" stopOpacity="0.28" />
                  <stop offset="1" stopColor="#38bdf8" stopOpacity="0.12" />
                </linearGradient>
                <pattern id={`${clipId}-uncovered`} width="12" height="12" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                  <rect width="12" height="12" fill="#7f1d1d" fillOpacity="0.42" />
                  <line x1="0" y1="0" x2="0" y2="12" stroke="#f87171" strokeOpacity="0.45" strokeWidth="3" />
                </pattern>
                <clipPath id={clipId}>
                  <rect x={areaBox.x} y={areaBox.y} width={areaBox.width} height={areaBox.height} rx="5" />
                </clipPath>
              </defs>

              <rect width="1000" height="520" fill="#020617" />
              <g opacity="0.18" stroke="#64748b" strokeWidth="1">
                {Array.from({ length: 21 }, (_, index) => <line key={`vx-${index}`} x1={index * 50} y1="0" x2={index * 50} y2="520" />)}
                {Array.from({ length: 11 }, (_, index) => <line key={`hy-${index}`} x1="0" y1={index * 52} x2="1000" y2={index * 52} />)}
              </g>

              <polygon
                points={`${sourceScreen.x},${sourceScreen.y} ${detectorScreen.x},${detectorScreen.y - 88} ${detectorScreen.x},${detectorScreen.y + 88}`}
                fill={`url(#${clipId}-beam)`}
                stroke="#facc15"
                strokeOpacity="0.45"
                strokeDasharray="7 6"
              />
              <line x1={sourceScreen.x} y1={sourceScreen.y} x2={beamScreen.x} y2={beamScreen.y} stroke="#fde047" strokeWidth="3" />
              <line x1={beamScreen.x} y1={beamScreen.y} x2={detectorScreen.x} y2={detectorScreen.y} stroke="#38bdf8" strokeWidth="2" strokeDasharray="8 6" />

              <g aria-label="Part">
                <rect {...partBox} rx="18" fill="#1e293b" stroke="#94a3b8" strokeWidth="3" />
                <text x={partBox.x + partBox.width / 2} y={partBox.y + 28} textAnchor="middle" fill="#e2e8f0" fontSize="15" fontWeight="600">
                  {planning.part.partName || planning.part.geometry.geometryType || 'PART'}
                </text>
                <rect
                  x={areaBox.x}
                  y={areaBox.y}
                  width={areaBox.width}
                  height={areaBox.height}
                  rx="5"
                  fill={`url(#${clipId}-uncovered)`}
                  stroke="#fca5a5"
                  strokeWidth="2"
                />
                <g clipPath={`url(#${clipId})`}>
                  {areaWidthMm && areaHeightMm ? gridPreview.map((descriptor) => {
                    const x = areaBox.x + ((descriptor.centerXmm - descriptor.footprintWidthMm / 2) / areaWidthMm) * areaBox.width;
                    const y = areaBox.y + ((descriptor.centerYmm - descriptor.footprintHeightMm / 2) / areaHeightMm) * areaBox.height;
                    const width = (descriptor.footprintWidthMm / areaWidthMm) * areaBox.width;
                    const height = (descriptor.footprintHeightMm / areaHeightMm) * areaBox.height;
                    return (
                      <rect
                        key={descriptor.id}
                        x={x}
                        y={y}
                        width={width}
                        height={height}
                        fill="#22c55e"
                        fillOpacity="0.28"
                        stroke="#86efac"
                        strokeOpacity="0.8"
                        strokeWidth="1.2"
                      />
                    );
                  }) : null}
                </g>
                <text x={areaBox.x + 8} y={areaBox.y + 18} fill="#fecaca" fontSize="12">
                  {selectedArea?.areaId || 'Inspection area'}
                </text>
              </g>

              <g
                role="button"
                tabIndex={0}
                aria-label="Source position. Drag or use arrow keys to move."
                className="cursor-move outline-none focus-visible:[filter:drop-shadow(0_0_8px_#fde047)]"
                transform={`translate(${sourceScreen.x} ${sourceScreen.y})`}
                onPointerDown={(event) => beginDrag('source', event)}
                onKeyDown={(event) => handleTargetKey('source', event)}
              >
                <circle r="29" fill="#ca8a04" stroke="#fef08a" strokeWidth="3" />
                <circle r="8" fill="#fef9c3" />
                <text y="49" textAnchor="middle" fill="#fef3c7" fontSize="13">SOURCE</text>
              </g>

              <g
                role="button"
                tabIndex={0}
                aria-label="Detector position. Drag or use arrow keys to move."
                className="cursor-move outline-none focus-visible:[filter:drop-shadow(0_0_8px_#38bdf8)]"
                transform={`translate(${detectorScreen.x} ${detectorScreen.y}) rotate(${detectorAngle})`}
                onPointerDown={(event) => beginDrag('detector', event)}
                onKeyDown={(event) => handleTargetKey('detector', event)}
              >
                <rect x="-12" y="-82" width="24" height="164" rx="6" fill="#0369a1" stroke="#7dd3fc" strokeWidth="3" />
                <line x1="0" y1="-64" x2="0" y2="64" stroke="#bae6fd" strokeWidth="2" strokeDasharray="5 5" />
                <text y="105" textAnchor="middle" fill="#bae6fd" fontSize="13" transform={`rotate(${-detectorAngle})`}>DETECTOR</text>
              </g>

              <g
                role="button"
                tabIndex={0}
                aria-label="Beam center. Drag or use arrow keys to move."
                className="cursor-crosshair outline-none focus-visible:[filter:drop-shadow(0_0_8px_#fb7185)]"
                transform={`translate(${beamScreen.x} ${beamScreen.y})`}
                onPointerDown={(event) => beginDrag('beam', event)}
                onKeyDown={(event) => handleTargetKey('beam', event)}
              >
                <circle r="15" fill="#020617" stroke="#fb7185" strokeWidth="3" />
                <line x1="-23" y1="0" x2="23" y2="0" stroke="#fda4af" strokeWidth="2" />
                <line x1="0" y1="-23" x2="0" y2="23" stroke="#fda4af" strokeWidth="2" />
              </g>

              <g transform="translate(22 482)" fontSize="12" fill="#cbd5e1">
                <rect x="0" y="-12" width="16" height="12" fill="#7f1d1d" stroke="#f87171" />
                <text x="23" y="-2">uncovered</text>
                <rect x="115" y="-12" width="16" height="12" fill="#22c55e" fillOpacity="0.45" stroke="#86efac" />
                <text x="138" y="-2">covered</text>
                <rect x="218" y="-12" width="16" height="12" fill="#15803d" stroke="#bbf7d0" />
                <text x="241" y="-2">overlap (darker)</text>
              </g>
            </svg>
          </div>

          {grid.length > 400 ? (
            <Alert>
              <Grid3X3 className="h-4 w-4" />
              <AlertTitle>Large grid preview</AlertTitle>
              <AlertDescription>Only the first 400 of {grid.length.toLocaleString()} footprints are rendered; the full deterministic grid will be committed.</AlertDescription>
            </Alert>
          ) : null}

          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" onClick={autoPosition}><Sparkles className="mr-1.5 h-4 w-4" />Auto-position</Button>
            <Button type="button" variant="outline" onClick={rotateDetector}><RotateCw className="mr-1.5 h-4 w-4" />Rotate detector 90°</Button>
            <Button type="button" variant="outline" disabled={!preferredOrientation} onClick={applyPreferredOrientation}>Use optimized orientation</Button>
            <Button
              type="button"
              disabled={grid.length === 0 || !selectedArea}
              onClick={() => selectedArea && onCommitGrid(grid, selectedArea.id, governingIqi)}
            >
              <Grid3X3 className="mr-1.5 h-4 w-4" />Commit {grid.length || ''} position{grid.length === 1 ? '' : 's'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle className="text-base">Accessible Position Controls</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">Coordinates are normalized 0–1 values. Shift + arrow moves by 0.05; arrow alone moves by 0.01.</p>
            </div>
            <Badge variant="secondary"><Move className="mr-1 h-3.5 w-3.5" />Editing {activeTarget}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6" aria-live="polite">
            {[
              ['Controlled SOD', calculation.geometry.sodMm === null ? '—' : `${Number(calculation.geometry.sodMm.toFixed(3))} mm`],
              ['Controlled ODD', calculation.geometry.oddMm === null ? '—' : `${Number(calculation.geometry.oddMm.toFixed(3))} mm`],
              ['Derived SDD', calculation.geometry.sddMm === null ? '—' : `${Number(calculation.geometry.sddMm.toFixed(3))} mm`],
              ['Beam angle', `${Number((typeof visual.beamAngleDegrees === 'number' ? visual.beamAngleDegrees : 0).toFixed(2))}°`],
              ['Object FOV', orientationOption.objectFovWidthMm === null || orientationOption.objectFovHeightMm === null ? '—' : `${Number(orientationOption.objectFovWidthMm.toFixed(2))} × ${Number(orientationOption.objectFovHeightMm.toFixed(2))} mm`],
              ['Grid', coverage.x && coverage.y ? `${coverage.x.count} × ${coverage.y.count}` : '—'],
            ].map(([label, value]) => (
              <div key={label} className="rounded-lg border border-border/70 bg-muted/15 p-3">
                <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
                <div className="mt-1 text-sm font-semibold tabular-nums">{value}</div>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <SelectField
              label="Control Target"
              value={activeTarget}
              onChange={setActiveTarget}
              options={[
                { value: 'source', label: 'Source' },
                { value: 'detector', label: 'Detector' },
                { value: 'beam', label: 'Beam center' },
              ]}
            />
            <NumberField
              label="Beam Center X"
              value={beamPoint.x}
              onChange={(x) => updateTarget('beam', x === '' ? beamPoint.x : x, beamPoint.y)}
              min={0}
              max={1}
              step="0.001"
            />
            <NumberField
              label="Beam Center Y"
              value={beamPoint.y}
              onChange={(y) => updateTarget('beam', beamPoint.x, y === '' ? beamPoint.y : y)}
              min={0}
              max={1}
              step="0.001"
            />
            <NumberField
              label="Beam Angle"
              value={visual.beamAngleDegrees}
              onChange={(beamAngleDegrees) => onVisualChange({ ...visual, beamAngleDegrees })}
              unit="deg"
              step="0.1"
            />
            <NumberField
              label="Detector Rotation"
              value={visual.detectorRotationDegrees}
              onChange={(detectorRotationDegrees) => onVisualChange({ ...visual, detectorRotationDegrees })}
              unit="deg"
              step="1"
            />
            <div className="grid grid-cols-3 place-items-center gap-1 rounded-xl border border-border/70 p-2" aria-label={`Nudge ${activeTarget}`}>
              <span />
              <Button type="button" size="icon" variant="outline" aria-label={`Move ${activeTarget} up`} onClick={() => nudge(activeTarget, 0, -0.01)}><ArrowUp className="h-4 w-4" /></Button>
              <span />
              <Button type="button" size="icon" variant="outline" aria-label={`Move ${activeTarget} left`} onClick={() => nudge(activeTarget, -0.01, 0)}><ArrowLeft className="h-4 w-4" /></Button>
              <Button type="button" size="icon" variant="outline" aria-label="Center beam" onClick={() => updateTarget('beam', (areaBox.x + areaBox.width / 2) / 1_000, (areaBox.y + areaBox.height / 2) / 520)}><Crosshair className="h-4 w-4" /></Button>
              <Button type="button" size="icon" variant="outline" aria-label={`Move ${activeTarget} right`} onClick={() => nudge(activeTarget, 0.01, 0)}><ArrowRight className="h-4 w-4" /></Button>
              <span />
              <Button type="button" size="icon" variant="outline" aria-label={`Move ${activeTarget} down`} onClick={() => nudge(activeTarget, 0, 0.01)}><ArrowDown className="h-4 w-4" /></Button>
              <span />
            </div>
          </div>

          <Alert variant={coverage.warnings.includes('underlap') ? 'destructive' : 'default'}>
            <Grid3X3 className="h-4 w-4" />
            <AlertTitle>{coverage.status === 'complete' ? `${orientation} coverage` : 'Coverage unavailable'}</AlertTitle>
            <AlertDescription>{coverageLabel(coverage)}</AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </div>
  );
}
