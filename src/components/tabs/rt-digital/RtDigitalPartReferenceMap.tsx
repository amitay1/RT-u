import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { Crosshair, FileWarning, Move, ScanSearch } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  createRtPtAssetObjectUrl,
  getRtPtAsset,
  revokeRtPtAssetObjectUrl,
} from '@/lib/rtPtAssetStore';
import type {
  RtDigitalAttachmentMetadata,
  RtDigitalInspectionArea,
  RtDigitalThicknessZone,
  RtDigitalVisualRegion,
} from '@/types/rtDigital';

interface RtDigitalPartReferenceMapProps {
  attachment: RtDigitalAttachmentMetadata | null;
  inspectionAreas: RtDigitalInspectionArea[];
  thicknessZones: RtDigitalThicknessZone[];
  orientation: string;
  datumReference: string;
  onInspectionAreaPositionChange: (id: string, position: RtDigitalVisualRegion) => void;
  onThicknessZonePositionChange: (id: string, position: RtDigitalVisualRegion) => void;
}

type ReferenceMark = {
  key: string;
  id: string;
  kind: 'area' | 'zone';
  label: string;
  position: RtDigitalVisualRegion;
};

type NumericRegion = {
  x: number;
  y: number;
  width: number;
  height: number;
  rotationDegrees: number;
};

type DragState = {
  pointerId: number;
  mark: ReferenceMark;
  mode: 'move' | 'resize';
  startPoint: { x: number; y: number };
  startRegion: NumericRegion;
};

const clamp = (value: number, minimum: number, maximum: number): number => (
  Math.min(maximum, Math.max(minimum, value))
);

const numericValue = (value: number | '', fallback: number): number => (
  typeof value === 'number' && Number.isFinite(value) ? value : fallback
);

const numericRegion = (position: RtDigitalVisualRegion): NumericRegion => {
  const width = clamp(numericValue(position.width, 0.24), 0.02, 1);
  const height = clamp(numericValue(position.height, 0.2), 0.02, 1);
  return {
    x: clamp(numericValue(position.x, 0.1), 0, 1 - width),
    y: clamp(numericValue(position.y, 0.1), 0, 1 - height),
    width,
    height,
    rotationDegrees: numericValue(position.rotationDegrees, 0),
  };
};

const storedRegion = (region: NumericRegion): RtDigitalVisualRegion => ({
  x: Number(region.x.toFixed(4)),
  y: Number(region.y.toFixed(4)),
  width: Number(region.width.toFixed(4)),
  height: Number(region.height.toFixed(4)),
  rotationDegrees: Number(region.rotationDegrees.toFixed(2)),
});

const isPositioned = (position: RtDigitalVisualRegion): boolean => (
  typeof position.x === 'number'
  && typeof position.y === 'number'
  && typeof position.width === 'number'
  && typeof position.height === 'number'
);

export function RtDigitalPartReferenceMap({
  attachment,
  inspectionAreas,
  thicknessZones,
  orientation,
  datumReference,
  onInspectionAreaPositionChange,
  onThicknessZonePositionChange,
}: RtDigitalPartReferenceMapProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const [objectUrl, setObjectUrl] = useState('');
  const [assetUnavailable, setAssetUnavailable] = useState(false);
  const marks = useMemo<ReferenceMark[]>(() => [
    ...inspectionAreas.map((area) => ({
      key: `area:${area.id}`,
      id: area.id,
      kind: 'area' as const,
      label: area.areaId || area.description || 'Inspection area',
      position: area.position,
    })),
    ...thicknessZones.map((zone) => ({
      key: `zone:${zone.id}`,
      id: zone.id,
      kind: 'zone' as const,
      label: zone.zoneId || zone.description || 'Thickness zone',
      position: zone.position,
    })),
  ], [inspectionAreas, thicknessZones]);
  const [selectedKey, setSelectedKey] = useState('');
  const selectedMark = marks.find((mark) => mark.key === selectedKey) ?? marks[0] ?? null;

  useEffect(() => {
    if (!selectedKey && marks[0]) setSelectedKey(marks[0].key);
    if (selectedKey && !marks.some((mark) => mark.key === selectedKey)) {
      setSelectedKey(marks[0]?.key ?? '');
    }
  }, [marks, selectedKey]);

  useEffect(() => {
    let active = true;
    let url = '';
    setObjectUrl('');
    setAssetUnavailable(false);
    if (!attachment) return () => undefined;

    void getRtPtAsset(attachment.id)
      .then((asset) => {
        if (
          !asset
          || asset.metadata.sha256 !== attachment.sha256
          || asset.metadata.size !== attachment.size
          || asset.metadata.mimeType !== attachment.mimeType
        ) {
          if (active) setAssetUnavailable(true);
          return;
        }
        url = createRtPtAssetObjectUrl(asset.blob);
        if (active) setObjectUrl(url);
        else revokeRtPtAssetObjectUrl(url);
      })
      .catch(() => {
        if (active) setAssetUnavailable(true);
      });

    return () => {
      active = false;
      if (url) revokeRtPtAssetObjectUrl(url);
    };
  }, [attachment]);

  const updateMark = (mark: ReferenceMark, position: RtDigitalVisualRegion) => {
    if (mark.kind === 'area') onInspectionAreaPositionChange(mark.id, position);
    else onThicknessZonePositionChange(mark.id, position);
  };

  const pointFromEvent = (event: ReactPointerEvent<SVGElement>): { x: number; y: number } => {
    const bounds = svgRef.current?.getBoundingClientRect();
    if (!bounds || bounds.width <= 0 || bounds.height <= 0) return { x: 0.5, y: 0.5 };
    return {
      x: clamp((event.clientX - bounds.left) / bounds.width, 0, 1),
      y: clamp((event.clientY - bounds.top) / bounds.height, 0, 1),
    };
  };

  const beginDrag = (
    event: ReactPointerEvent<SVGGElement>,
    mark: ReferenceMark,
    mode: DragState['mode'],
  ) => {
    event.preventDefault();
    event.stopPropagation();
    setSelectedKey(mark.key);
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      mark,
      mode,
      startPoint: pointFromEvent(event),
      startRegion: numericRegion(mark.position),
    };
  };

  const moveDrag = (event: ReactPointerEvent<SVGSVGElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const point = pointFromEvent(event);
    const deltaX = point.x - drag.startPoint.x;
    const deltaY = point.y - drag.startPoint.y;
    const next = { ...drag.startRegion };
    if (drag.mode === 'move') {
      next.x = clamp(drag.startRegion.x + deltaX, 0, 1 - drag.startRegion.width);
      next.y = clamp(drag.startRegion.y + deltaY, 0, 1 - drag.startRegion.height);
    } else {
      next.width = clamp(drag.startRegion.width + deltaX, 0.02, 1 - drag.startRegion.x);
      next.height = clamp(drag.startRegion.height + deltaY, 0.02, 1 - drag.startRegion.y);
    }
    updateMark(drag.mark, storedRegion(next));
  };

  const endDrag = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (dragRef.current?.pointerId === event.pointerId) dragRef.current = null;
  };

  const placeSelected = (event: ReactPointerEvent<SVGRectElement>) => {
    if (!selectedMark) return;
    const point = pointFromEvent(event);
    const current = numericRegion(selectedMark.position);
    updateMark(selectedMark, storedRegion({
      ...current,
      x: clamp(point.x - current.width / 2, 0, 1 - current.width),
      y: clamp(point.y - current.height / 2, 0, 1 - current.height),
    }));
  };

  const moveWithKeyboard = (event: KeyboardEvent<SVGGElement>, mark: ReferenceMark) => {
    const step = event.shiftKey ? 0.05 : 0.01;
    const delta = event.key === 'ArrowLeft'
      ? { x: -step, y: 0 }
      : event.key === 'ArrowRight'
        ? { x: step, y: 0 }
        : event.key === 'ArrowUp'
          ? { x: 0, y: -step }
          : event.key === 'ArrowDown'
            ? { x: 0, y: step }
            : null;
    if (!delta) return;
    event.preventDefault();
    const current = numericRegion(mark.position);
    updateMark(mark, storedRegion({
      ...current,
      x: clamp(current.x + delta.x, 0, 1 - current.width),
      y: clamp(current.y + delta.y, 0, 1 - current.height),
    }));
  };

  return (
    <div className="space-y-3 rounded-xl border border-border/80 bg-muted/10 p-4 md:col-span-2">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">Reference Marking Canvas</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Select a mark, click to place it, drag to move, or drag its corner to resize. Arrow keys move the focused mark.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {orientation ? <Badge variant="outline">Orientation: {orientation}</Badge> : null}
          {datumReference ? <Badge variant="outline">Datum: {datumReference}</Badge> : null}
        </div>
      </div>

      <div className="flex flex-wrap gap-2" aria-label="Reference marks">
        {marks.map((mark) => (
          <Button
            key={mark.key}
            type="button"
            size="sm"
            variant={selectedMark?.key === mark.key ? 'default' : 'outline'}
            onClick={() => {
              setSelectedKey(mark.key);
              if (!isPositioned(mark.position)) updateMark(mark, storedRegion(numericRegion(mark.position)));
            }}
          >
            {mark.kind === 'area' ? <ScanSearch className="mr-1.5 h-3.5 w-3.5" /> : <Crosshair className="mr-1.5 h-3.5 w-3.5" />}
            {mark.label}
          </Button>
        ))}
        {marks.length === 0 ? (
          <span className="text-sm text-muted-foreground">Add an inspection area or thickness zone to create a visual mark.</span>
        ) : null}
      </div>

      <div className="relative aspect-[5/3] min-h-72 overflow-hidden rounded-xl border border-border bg-slate-950 shadow-inner">
        {attachment?.mimeType === 'application/pdf' && objectUrl ? (
          <iframe title={`Reference PDF ${attachment.name}`} src={objectUrl} className="absolute inset-0 h-full w-full border-0 bg-white" />
        ) : attachment && objectUrl ? (
          <div
            role="img"
            aria-label={`Reference image ${attachment.name}`}
            className="absolute inset-0 bg-slate-950 bg-[length:100%_100%] bg-center bg-no-repeat"
            style={{ backgroundImage: `url(${objectUrl})` }}
          />
        ) : (
          <div className="absolute inset-0 grid place-items-center p-6 text-center text-slate-300">
            <div>
              {assetUnavailable ? <FileWarning className="mx-auto h-8 w-8 text-amber-400" /> : <ScanSearch className="mx-auto h-8 w-8 text-slate-500" />}
              <p className="mt-2 text-sm font-medium">
                {assetUnavailable ? 'The referenced asset is unavailable or failed its integrity check.' : 'Select a JPG, PNG, or PDF reference above.'}
              </p>
              <p className="mt-1 text-xs text-slate-400">Marks can still be positioned on this normalized reference frame.</p>
            </div>
          </div>
        )}

        <svg
          ref={svgRef}
          viewBox="0 0 1000 600"
          preserveAspectRatio="none"
          className="absolute inset-0 z-10 h-full w-full touch-none"
          onPointerMove={moveDrag}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
        >
          <rect
            width="1000"
            height="600"
            fill="transparent"
            aria-label={selectedMark ? `Place ${selectedMark.label}` : 'Reference frame'}
            onPointerDown={placeSelected}
          />
          {marks.filter((mark) => isPositioned(mark.position)).map((mark) => {
            const region = numericRegion(mark.position);
            const x = region.x * 1000;
            const y = region.y * 600;
            const width = region.width * 1000;
            const height = region.height * 600;
            const selected = selectedMark?.key === mark.key;
            const stroke = mark.kind === 'area' ? '#38bdf8' : '#fbbf24';
            return (
              <g
                key={mark.key}
                role="button"
                tabIndex={0}
                aria-label={`${mark.kind === 'area' ? 'Inspection area' : 'Thickness zone'} ${mark.label}. Drag or use arrow keys to move.`}
                className="cursor-move outline-none focus-visible:[filter:drop-shadow(0_0_8px_#ffffff)]"
                transform={`rotate(${region.rotationDegrees} ${x + width / 2} ${y + height / 2})`}
                onFocus={() => setSelectedKey(mark.key)}
                onKeyDown={(event) => moveWithKeyboard(event, mark)}
                onPointerDown={(event) => beginDrag(event, mark, 'move')}
              >
                <rect
                  x={x}
                  y={y}
                  width={width}
                  height={height}
                  rx="7"
                  fill={mark.kind === 'area' ? 'rgba(14,165,233,0.2)' : 'rgba(245,158,11,0.2)'}
                  stroke={stroke}
                  strokeWidth={selected ? 5 : 3}
                  strokeDasharray={mark.kind === 'zone' ? '12 8' : undefined}
                />
                <rect x={x} y={Math.max(0, y - 28)} width={Math.max(100, Math.min(width, mark.label.length * 11 + 28))} height="28" rx="5" fill="rgba(2,6,23,0.88)" />
                <text x={x + 10} y={Math.max(20, y - 9)} fill="white" fontSize="18" fontWeight="700">{mark.label}</text>
                {selected ? (
                  <g
                    className="cursor-nwse-resize"
                    onPointerDown={(event) => beginDrag(event, mark, 'resize')}
                  >
                    <circle cx={x + width} cy={y + height} r="13" fill={stroke} stroke="white" strokeWidth="3" />
                    <Move x={x + width - 8} y={y + height - 8} width="16" height="16" color="#020617" />
                  </g>
                ) : null}
              </g>
            );
          })}
        </svg>
      </div>

      <p className="text-xs text-muted-foreground">
        Blue = inspection area; amber dashed = thickness zone. Coordinates are controlled normalized inputs and remain valid independently of the local attachment bytes.
      </p>
    </div>
  );
}
