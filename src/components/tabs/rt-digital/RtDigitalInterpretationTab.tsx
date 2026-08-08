import { useEffect, useState } from 'react';
import { FileImage, FileText, Plus, Trash2 } from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { RtDigitalAttachmentField } from '@/components/tabs/rt-digital/RtDigitalAttachmentField';
import { NumberField, SelectField, TextAreaField, TextField } from '@/components/tabs/shared/FieldRow';
import {
  createRtPtAssetObjectUrl,
  getRtPtAsset,
  revokeRtPtAssetObjectUrl,
} from '@/lib/rtPtAssetStore';
import { resolveRtDigitalInspectionArea } from '@/lib/rtDigitalPlanning';
import type {
  LengthUnit,
  RtDigitalAcceptanceProfile,
  RtDigitalAcquisition,
  RtDigitalAttachmentMetadata,
  RtDigitalInterpretationArea,
  RtDigitalPlanning,
  RtDigitalViewingPreset,
  RtDigitalVisualRegion,
} from '@/types/rtDigital';

interface Props {
  acquisitions: RtDigitalAcquisition[];
  planning: RtDigitalPlanning;
  viewingPresets: RtDigitalViewingPreset[];
  acceptanceProfiles: RtDigitalAcceptanceProfile[];
  onRepresentativeImageChange: (
    acquisitionId: string,
    attachment: RtDigitalAttachmentMetadata | null,
  ) => void;
  onInterpretationAreasChange: (
    acquisitionId: string,
    areas: RtDigitalInterpretationArea[],
  ) => void;
}

const LENGTH_UNITS: ReadonlyArray<{ label: string; value: LengthUnit }> = [
  { label: 'mm', value: 'mm' },
  { label: 'inch', value: 'inch' },
];

const emptyRegion = (): RtDigitalVisualRegion => ({
  x: '',
  y: '',
  width: '',
  height: '',
  rotationDegrees: '',
});

const createRecordId = (): string => {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return `dr-interpretation-area-${globalThis.crypto.randomUUID()}`;
  }
  return `dr-interpretation-area-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
};

const nextInterpretationAreaId = (areas: RtDigitalInterpretationArea[]): string => {
  const used = new Set(areas.map((area) => area.areaId.trim().toUpperCase()));
  let sequence = 1;
  while (used.has(`IA-${sequence.toString().padStart(2, '0')}`)) sequence += 1;
  return `IA-${sequence.toString().padStart(2, '0')}`;
};

const createInterpretationArea = (
  areas: RtDigitalInterpretationArea[],
  inspectionAreaId: string,
  thicknessZoneId: string,
): RtDigitalInterpretationArea => ({
  id: createRecordId(),
  areaId: nextInterpretationAreaId(areas),
  description: '',
  inspectionAreaId,
  thicknessZoneId,
  position: emptyRegion(),
  thicknessMinimum: '',
  thicknessMaximum: '',
  thicknessUnit: 'mm',
  viewingPresetId: '',
  windowLevel: '',
  windowWidth: '',
  zoom: '',
  sharpness: '',
  permittedProcessing: '',
  lut: '',
  invert: false,
  acceptanceProfileId: '',
});

const ROI_COLORS = ['#ef4444', '#2563eb', '#16a34a', '#9333ea', '#ea580c', '#0891b2'];

const numericRegionValue = (value: number | ''): number | null => (
  typeof value === 'number' && Number.isFinite(value) ? value : null
);

const clamp = (value: number, minimum: number, maximum: number): number => (
  Math.min(maximum, Math.max(minimum, value))
);

interface RepresentativeImageRoiCanvasProps {
  metadata: RtDigitalAttachmentMetadata | null;
  areas: RtDigitalInterpretationArea[];
  exposureLabel: string;
}

function RepresentativeImageRoiCanvas({
  metadata,
  areas,
  exposureLabel,
}: RepresentativeImageRoiCanvasProps) {
  const [objectUrl, setObjectUrl] = useState('');
  const [assetUnavailable, setAssetUnavailable] = useState(false);

  useEffect(() => {
    let active = true;
    let nextUrl = '';
    setObjectUrl('');
    setAssetUnavailable(false);
    if (!metadata || metadata.mimeType === 'application/pdf') return () => undefined;

    void getRtPtAsset(metadata.id).then((asset) => {
      if (
        !asset
        || asset.metadata.sha256 !== metadata.sha256
        || asset.metadata.size !== metadata.size
        || asset.metadata.mimeType !== metadata.mimeType
      ) {
        if (active) setAssetUnavailable(true);
        return;
      }
      nextUrl = createRtPtAssetObjectUrl(asset.blob);
      if (active) setObjectUrl(nextUrl);
      else revokeRtPtAssetObjectUrl(nextUrl);
    }).catch(() => {
      if (active) setAssetUnavailable(true);
    });

    return () => {
      active = false;
      if (nextUrl) revokeRtPtAssetObjectUrl(nextUrl);
    };
  }, [metadata]);

  if (!metadata) return null;
  const isPdf = metadata.mimeType === 'application/pdf';

  return (
    <div className="space-y-3 rounded-xl border border-border/80 bg-background p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h4 className="text-sm font-semibold">ROI reference canvas</h4>
          <p className="text-xs text-muted-foreground">All interpretation areas are overlaid together; coordinates are normalized to this canvas.</p>
        </div>
        <Badge variant="outline">{areas.length} ROI {areas.length === 1 ? 'overlay' : 'overlays'}</Badge>
      </div>
      <div className="relative aspect-[20/13] overflow-hidden rounded-lg border border-border bg-slate-950">
        {objectUrl && !isPdf ? (
          <img
            src={objectUrl}
            alt={`Representative radiograph for ${exposureLabel}`}
            className="absolute inset-0 h-full w-full object-fill"
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-[linear-gradient(135deg,hsl(var(--muted))_25%,transparent_25%,transparent_50%,hsl(var(--muted))_50%,hsl(var(--muted))_75%,transparent_75%,transparent)] bg-[length:24px_24px] text-muted-foreground">
            {isPdf ? <FileText className="h-10 w-10" aria-hidden="true" /> : <FileImage className="h-10 w-10" aria-hidden="true" />}
            <span className="rounded bg-background/90 px-3 py-1 text-xs font-medium">
              {isPdf ? 'PDF reference — neutral ROI canvas' : assetUnavailable ? 'Stored image bytes unavailable' : 'Loading representative image…'}
            </span>
          </div>
        )}
        <svg
          viewBox="0 0 1000 650"
          preserveAspectRatio="none"
          className="absolute inset-0 h-full w-full"
          role="img"
          aria-label={`${areas.length} interpretation area overlays for ${exposureLabel}`}
        >
          {areas.map((area, index) => {
            const x = numericRegionValue(area.position.x);
            const y = numericRegionValue(area.position.y);
            const width = numericRegionValue(area.position.width);
            const height = numericRegionValue(area.position.height);
            if (x === null || y === null || width === null || height === null || width <= 0 || height <= 0) return null;
            const rectX = clamp(x, 0, 1) * 1000;
            const rectY = clamp(y, 0, 1) * 650;
            const rectWidth = clamp(width, 0, 1 - clamp(x, 0, 1)) * 1000;
            const rectHeight = clamp(height, 0, 1 - clamp(y, 0, 1)) * 650;
            const rotation = numericRegionValue(area.position.rotationDegrees) ?? 0;
            const color = ROI_COLORS[index % ROI_COLORS.length];
            return (
              <g
                key={area.id}
                transform={`rotate(${rotation} ${rectX + rectWidth / 2} ${rectY + rectHeight / 2})`}
              >
                <title>{`${area.areaId || `IA ${index + 1}`}: ${area.description || 'Interpretation area'}`}</title>
                <rect
                  x={rectX}
                  y={rectY}
                  width={rectWidth}
                  height={rectHeight}
                  fill={color}
                  fillOpacity="0.16"
                  stroke="white"
                  strokeWidth="7"
                  vectorEffect="non-scaling-stroke"
                />
                <rect
                  x={rectX}
                  y={rectY}
                  width={rectWidth}
                  height={rectHeight}
                  fill="none"
                  stroke={color}
                  strokeWidth="4"
                  vectorEffect="non-scaling-stroke"
                />
                <text
                  x={rectX + 8}
                  y={Math.max(20, rectY + 24)}
                  fill="white"
                  stroke="black"
                  strokeWidth="5"
                  paintOrder="stroke"
                  fontSize="22"
                  fontWeight="700"
                >
                  {area.areaId || `IA-${index + 1}`}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      {areas.length ? (
        <div className="flex flex-wrap gap-3" aria-label="ROI overlay legend">
          {areas.map((area, index) => (
            <span key={area.id} className="inline-flex items-center gap-1.5 text-xs">
              <span className="h-3 w-3 rounded-sm" style={{ backgroundColor: ROI_COLORS[index % ROI_COLORS.length] }} aria-hidden="true" />
              {area.areaId || `IA-${index + 1}`}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

interface RoiFieldsProps {
  value: RtDigitalVisualRegion;
  onChange: (value: RtDigitalVisualRegion) => void;
}

function RoiFields({ value, onChange }: RoiFieldsProps) {
  const update = (key: keyof RtDigitalVisualRegion, nextValue: number | '') => {
    if (key === 'rotationDegrees') {
      onChange({ ...value, rotationDegrees: nextValue });
      return;
    }
    if (nextValue === '') {
      onChange({ ...value, [key]: '' });
      return;
    }
    const x = numericRegionValue(value.x) ?? 0;
    const y = numericRegionValue(value.y) ?? 0;
    const next = { ...value };
    if (key === 'x') {
      const boundedX = clamp(nextValue, 0, 1);
      next.x = boundedX;
      if (typeof next.width === 'number') next.width = clamp(next.width, 0, 1 - boundedX);
    } else if (key === 'y') {
      const boundedY = clamp(nextValue, 0, 1);
      next.y = boundedY;
      if (typeof next.height === 'number') next.height = clamp(next.height, 0, 1 - boundedY);
    } else if (key === 'width') {
      next.width = clamp(nextValue, 0, 1 - clamp(x, 0, 1));
    } else if (key === 'height') {
      next.height = clamp(nextValue, 0, 1 - clamp(y, 0, 1));
    }
    onChange(next);
  };

  return (
    <div className="grid grid-cols-2 gap-3 rounded-lg border border-border/70 bg-muted/15 p-3 sm:grid-cols-5">
      <NumberField label="ROI X" value={value.x} onChange={(next) => update('x', next)} unit="0–1" min={0} max={1} step="0.001" />
      <NumberField label="ROI Y" value={value.y} onChange={(next) => update('y', next)} unit="0–1" min={0} max={1} step="0.001" />
      <NumberField label="ROI Width" value={value.width} onChange={(next) => update('width', next)} unit="0–1" min={0} max={1} step="0.001" />
      <NumberField label="ROI Height" value={value.height} onChange={(next) => update('height', next)} unit="0–1" min={0} max={1} step="0.001" />
      <NumberField label="ROI Rotation" value={value.rotationDegrees} onChange={(next) => update('rotationDegrees', next)} unit="deg" step="0.1" />
    </div>
  );
}

export function RtDigitalInterpretationTab({
  acquisitions,
  planning,
  viewingPresets,
  acceptanceProfiles,
  onRepresentativeImageChange,
  onInterpretationAreasChange,
}: Props) {
  const collectionKey = acquisitions.map((acquisition) => acquisition.id).sort().join('|');
  const entirePartArea = planning.part.inspectionAreas.mode === 'Entire Part'
    ? resolveRtDigitalInspectionArea(planning.part)
    : null;
  const inspectionAreaOptions = entirePartArea
    ? [{ label: entirePartArea.areaId, value: entirePartArea.id }]
    : planning.part.inspectionAreas.areas.map((area) => ({
        label: `${area.areaId || 'Unnamed area'}${area.description ? ` — ${area.description}` : ''}`,
        value: area.id,
      }));
  const thicknessZoneOptions = planning.part.thickness.mode === 'Multiple Thickness Zones'
    ? planning.part.thickness.zones.map((zone) => ({
        label: `${zone.zoneId || 'Unnamed zone'}${zone.description ? ` — ${zone.description}` : ''}`,
        value: zone.id,
      }))
    : planning.part.thickness.mode
      ? [{ label: planning.part.thickness.mode, value: planning.part.thickness.id }]
      : [];

  const updateArea = (
    acquisition: RtDigitalAcquisition,
    areaId: string,
    patch: Partial<RtDigitalInterpretationArea>,
  ) => {
    const areas = acquisition.plan?.interpretationAreas ?? [];
    onInterpretationAreasChange(
      acquisition.id,
      areas.map((area) => area.id === areaId ? { ...area, ...patch } : area),
    );
  };

  const applyPreset = (
    acquisition: RtDigitalAcquisition,
    area: RtDigitalInterpretationArea,
  ) => {
    const preset = viewingPresets.find((candidate) => candidate.id === area.viewingPresetId);
    if (!preset) return;
    updateArea(acquisition, area.id, {
      windowLevel: preset.windowLevel,
      windowWidth: preset.windowWidth,
      zoom: preset.zoom,
      sharpness: preset.sharpness,
      permittedProcessing: preset.permittedProcessing,
      lut: preset.lut,
      invert: preset.invert,
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>08. Interpretation Plan</CardTitle>
        <p className="text-sm text-muted-foreground">
          Exposure is not an interpretation area. Each acquisition may contain several independently positioned thickness regions.
        </p>
      </CardHeader>
      <CardContent>
        {acquisitions.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border px-6 py-12 text-center">
            <p className="text-sm font-medium">No acquisitions available</p>
            <p className="mt-1 text-sm text-muted-foreground">Create the acquisition plan before defining interpretation areas.</p>
          </div>
        ) : (
          <Accordion
            key={collectionKey}
            type="multiple"
            defaultValue={acquisitions.map((acquisition) => acquisition.id)}
            className="space-y-3"
          >
            {acquisitions.map((acquisition, acquisitionIndex) => {
              const areas = acquisition.plan?.interpretationAreas ?? [];
              const representativeImage = acquisition.plan?.representativeImage ?? null;
              const exposureLabel = acquisition.viewId || `EXP-${(acquisitionIndex + 1).toString().padStart(3, '0')}`;

              return (
                <AccordionItem
                  key={acquisition.id}
                  value={acquisition.id}
                  className="rounded-2xl border border-border/80 bg-background/50 px-4 shadow-sm"
                >
                  <AccordionTrigger className="gap-3 text-left hover:no-underline">
                    <span className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                      <span className="font-semibold">{exposureLabel}</span>
                      <Badge variant="outline">Acquisition</Badge>
                      <Badge variant="secondary">{areas.length} interpretation {areas.length === 1 ? 'area' : 'areas'}</Badge>
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="space-y-5">
                    <section className="space-y-3">
                      <div>
                        <h3 className="text-sm font-semibold">Digital / Representative Image</h3>
                        <p className="text-xs text-muted-foreground">The image is grouped with this acquisition; marked ROIs below remain separate records.</p>
                      </div>
                      <RtDigitalAttachmentField
                        label={`Representative Image — ${exposureLabel}`}
                        value={representativeImage ? [representativeImage] : []}
                        onChange={(attachments) => onRepresentativeImageChange(acquisition.id, attachments[0] ?? null)}
                        multiple={false}
                        description="Attach one JPG, PNG, or PDF representative image for this acquisition."
                      />
                      <RepresentativeImageRoiCanvas
                        metadata={representativeImage}
                        areas={areas}
                        exposureLabel={exposureLabel}
                      />
                    </section>

                    <section className="space-y-3 border-t border-border/70 pt-5">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <h3 className="text-sm font-semibold">Interpretation Areas</h3>
                          <p className="text-xs text-muted-foreground">Each stable IA record has its own ROI, viewing settings, and acceptance link.</p>
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => onInterpretationAreasChange(acquisition.id, [
                            ...areas,
                            createInterpretationArea(
                              areas,
                              inspectionAreaOptions.length === 1 ? inspectionAreaOptions[0].value : '',
                              thicknessZoneOptions.length === 1 ? thicknessZoneOptions[0].value : '',
                            ),
                          ])}
                        >
                          <Plus className="h-4 w-4" /> Add IA
                        </Button>
                      </div>

                      {areas.length === 0 ? (
                        <div className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
                          No interpretation areas defined for {exposureLabel}.
                        </div>
                      ) : areas.map((area) => {
                        const selectedPreset = viewingPresets.find((preset) => preset.id === area.viewingPresetId);
                        return (
                          <article key={area.id} className="space-y-4 rounded-xl border border-border/80 bg-card p-4">
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex flex-wrap items-center gap-2">
                                <Badge variant="secondary">{area.areaId}</Badge>
                                {area.acceptanceProfileId ? <Badge variant="outline">AC: {area.acceptanceProfileId}</Badge> : null}
                              </div>
                              <Button
                                type="button"
                                size="icon"
                                variant="ghost"
                                className="text-destructive hover:text-destructive"
                                aria-label={`Delete interpretation area ${area.areaId}`}
                                onClick={() => onInterpretationAreasChange(acquisition.id, areas.filter((candidate) => candidate.id !== area.id))}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>

                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                              <TextField label="Description" value={area.description} onChange={(description) => updateArea(acquisition, area.id, { description })} />
                              <SelectField
                                label="Inspection Area"
                                value={area.inspectionAreaId}
                                onChange={(inspectionAreaId) => updateArea(acquisition, area.id, { inspectionAreaId })}
                                options={inspectionAreaOptions}
                                placeholder="Select a controlled Section 01 area…"
                              />
                              <SelectField
                                label="Thickness Zone"
                                value={area.thicknessZoneId}
                                onChange={(thicknessZoneId) => updateArea(acquisition, area.id, { thicknessZoneId })}
                                options={thicknessZoneOptions}
                                placeholder="Select a controlled Section 01 thickness…"
                              />
                            </div>

                            <div>
                              <p className="mb-2 text-xs font-medium text-muted-foreground">Marked ROI on image (normalized coordinates)</p>
                              <RoiFields value={area.position} onChange={(position) => updateArea(acquisition, area.id, { position })} />
                            </div>

                            <div className="grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_8rem]">
                              <NumberField label="Thickness Minimum" value={area.thicknessMinimum} onChange={(thicknessMinimum) => updateArea(acquisition, area.id, { thicknessMinimum })} unit={area.thicknessUnit} min={0} />
                              <NumberField label="Thickness Maximum" value={area.thicknessMaximum} onChange={(thicknessMaximum) => updateArea(acquisition, area.id, { thicknessMaximum })} unit={area.thicknessUnit} min={0} />
                              <SelectField label="Unit" value={area.thicknessUnit} onChange={(thicknessUnit) => updateArea(acquisition, area.id, { thicknessUnit })} options={LENGTH_UNITS} />
                            </div>

                            <div className="grid grid-cols-1 gap-4 rounded-xl border border-border/70 bg-muted/10 p-4 md:grid-cols-2">
                              <SelectField
                                label="Viewing Preset"
                                value={area.viewingPresetId || '__none__'}
                                onChange={(value) => updateArea(acquisition, area.id, { viewingPresetId: value === '__none__' ? '' : value })}
                                options={[
                                  { label: 'No preset selected', value: '__none__' },
                                  ...viewingPresets.map((preset) => ({ label: `${preset.id} — ${preset.name || 'Unnamed'}`, value: preset.id })),
                                ]}
                              />
                              <div className="flex items-end">
                                <Button type="button" variant="outline" disabled={!selectedPreset} onClick={() => applyPreset(acquisition, area)}>
                                  Apply selected preset
                                </Button>
                              </div>
                              <NumberField label="Window Level" value={area.windowLevel} onChange={(windowLevel) => updateArea(acquisition, area.id, { windowLevel })} />
                              <NumberField label="Window Width" value={area.windowWidth} onChange={(windowWidth) => updateArea(acquisition, area.id, { windowWidth })} min={0} />
                              <NumberField label="Zoom" value={area.zoom} onChange={(zoom) => updateArea(acquisition, area.id, { zoom })} unit="%" min={0} />
                              <TextField label="Sharpness Setting" value={area.sharpness} onChange={(sharpness) => updateArea(acquisition, area.id, { sharpness })} />
                              <TextAreaField label="Filter / Permitted Processing" value={area.permittedProcessing} onChange={(permittedProcessing) => updateArea(acquisition, area.id, { permittedProcessing })} rows={3} />
                              <TextField label="LUT" value={area.lut} onChange={(lut) => updateArea(acquisition, area.id, { lut })} />
                              <div className="flex min-h-16 items-center gap-3 rounded-lg border border-border/70 bg-background px-3">
                                <Switch id={`interpretation-invert-${area.id}`} checked={area.invert} onCheckedChange={(invert) => updateArea(acquisition, area.id, { invert })} />
                                <Label htmlFor={`interpretation-invert-${area.id}`}>Invert permitted</Label>
                              </div>
                              <SelectField
                                label="Acceptance Profile"
                                value={area.acceptanceProfileId || '__none__'}
                                onChange={(value) => updateArea(acquisition, area.id, { acceptanceProfileId: value === '__none__' ? '' : value })}
                                options={[
                                  { label: 'No acceptance profile selected', value: '__none__' },
                                  ...acceptanceProfiles.map((profile) => ({ label: `${profile.id} — ${profile.name || 'Unnamed'}`, value: profile.id })),
                                ]}
                              />
                            </div>
                          </article>
                        );
                      })}
                    </section>
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        )}
      </CardContent>
    </Card>
  );
}
