import { ArrowDown, ArrowUp, Copy, Plus, Trash2 } from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RtDigitalAcquisitionFields } from '@/components/tabs/rt-digital/RtDigitalAcquisitionFields';
import { RtRadiographySetupDiagram } from '@/components/rtpt/RtRadiographySetupDiagram';
import { NumberField, SelectField, TextAreaField, TextField } from '@/components/tabs/shared/FieldRow';
import {
  calculateRtDigitalCoverage,
  calculateRtDigitalGeometry,
  resolveRtDigitalInspectionArea,
} from '@/lib/rtDigitalPlanning';
import type {
  RtDigitalAcquisition,
  RtDigitalAcquisitionPlan,
  RtDigitalPlanning,
  RtDigitalSource,
  RtDigitalSystem,
} from '@/types/rtDigital';

type AcquisitionPatch = Partial<Omit<RtDigitalAcquisition, 'id'>>;

interface Props {
  data: RtDigitalAcquisition[];
  source: RtDigitalSource;
  system: RtDigitalSystem;
  planning: RtDigitalPlanning;
  onAdd: () => void;
  onChange: (id: string, patch: AcquisitionPatch) => void;
  onDuplicate: (id: string) => void;
  onMove: (id: string, direction: 'up' | 'down') => void;
  onDelete: (id: string) => void;
}

export function RtDigitalAcquisitionPlanTab({
  data,
  source,
  system,
  planning,
  onAdd,
  onChange,
  onDuplicate,
  onMove,
  onDelete,
}: Props) {
  const collectionKey = data.map((acquisition) => acquisition.id).sort().join('|');
  const gridColumns = Math.max(0, ...data.map(({ plan }) => (
    typeof plan?.gridPlacement.column === 'number' ? plan.gridPlacement.column : 0
  )));
  const gridRows = Math.max(0, ...data.map(({ plan }) => (
    typeof plan?.gridPlacement.row === 'number' ? plan.gridPlacement.row : 0
  )));

  const formatMetric = (value: number | null, unit = '') => (
    value === null ? '—' : `${Number(value.toFixed(4)).toLocaleString()}${unit ? ` ${unit}` : ''}`
  );

  const updatePlan = (
    acquisition: RtDigitalAcquisition,
    patch: Partial<RtDigitalAcquisitionPlan>,
  ) => {
    if (!acquisition.plan) return;
    onChange(acquisition.id, { plan: { ...acquisition.plan, ...patch } });
  };

  return (
    <Card>
      <CardHeader className="gap-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>07. Acquisition Plan</CardTitle>
            <p className="note-clamp mt-1 text-sm text-muted-foreground">
              Review the automatically generated exposure list and complete each controlled setup. At least one uniquely identified exposure is required for approval.
            </p>
          </div>
          <Button type="button" size="sm" onClick={onAdd}>
            <Plus className="mr-1.5 h-4 w-4" />
            Add Acquisition
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <div className="flex min-h-52 flex-col items-center justify-center rounded-2xl border border-dashed border-primary/30 bg-primary/5 px-6 py-10 text-center">
            <div className="text-sm font-semibold">No acquisitions planned</div>
            <p className="mt-1 max-w-lg text-sm text-muted-foreground">
              Add the first required view, then define its identity, orientation, attachment reference, geometry, IQI, exposure, frame, coverage, and marking instructions.
            </p>
            <Button type="button" className="mt-5" onClick={onAdd}>
              <Plus className="mr-1.5 h-4 w-4" />
              Add First Acquisition
            </Button>
          </div>
        ) : (
          <Accordion
            key={collectionKey}
            type="single"
            collapsible
            defaultValue={data[data.length - 1]?.id}
            className="space-y-3"
          >
            {data.map((acquisition, index) => {
              const plan = acquisition.plan;
              const orientation = plan?.gridPlacement.detectorOrientation === 'Portrait'
                ? 'Portrait'
                : 'Landscape';
              const detectorWidth = orientation === 'Portrait'
                ? system.activeAreaHeight
                : system.activeAreaWidth;
              const detectorHeight = orientation === 'Portrait'
                ? system.activeAreaWidth
                : system.activeAreaHeight;
              const geometry = calculateRtDigitalGeometry({
                sod: { value: acquisition.sod, unit: acquisition.sodUnit },
                sdd: { value: acquisition.sdd, unit: acquisition.sddUnit },
                odd: { value: acquisition.odd, unit: acquisition.oddUnit },
                focalSpotSize: { value: source.focalSpotSize, unit: source.focalSpotSizeUnit },
                requiredMaximumUg: { value: acquisition.requiredUg, unit: acquisition.requiredUgUnit },
                detectorPixelSize: { value: system.pixelSize, unit: system.pixelSizeUnit },
                detectorActiveWidth: { value: detectorWidth, unit: system.activeAreaUnit },
                detectorActiveHeight: { value: detectorHeight, unit: system.activeAreaUnit },
                requiredMaximumEffectivePixel: planning.geometry.requiredMaximumEffectivePixel,
              });
              const inspectionAreaId = plan?.visual.inspectionAreaId
                || planning.geometry.inspectionAreaId;
              const inspectionArea = resolveRtDigitalInspectionArea(planning.part, inspectionAreaId);
              const coverage = calculateRtDigitalCoverage({
                inspectionAreaWidth: {
                  value: inspectionArea?.width ?? '',
                  unit: inspectionArea?.unit ?? 'mm',
                },
                inspectionAreaHeight: {
                  value: inspectionArea?.height ?? '',
                  unit: inspectionArea?.unit ?? 'mm',
                },
                objectFovWidth: { value: geometry.objectFovWidthMm ?? '', unit: 'mm' },
                objectFovHeight: { value: geometry.objectFovHeightMm ?? '', unit: 'mm' },
                requiredOverlapPercent: planning.geometry.requiredOverlapPercent,
                excessiveOverlapThresholdPercent: planning.geometry.excessiveOverlapThresholdPercent,
                exposureCountX: gridColumns || undefined,
                exposureCountY: gridRows || undefined,
                orientation,
              });
              const overlap = coverage.x?.actualOverlapPercent === null
                || coverage.y?.actualOverlapPercent === null
                || coverage.x?.actualOverlapPercent === undefined
                || coverage.y?.actualOverlapPercent === undefined
                ? null
                : Math.min(coverage.x.actualOverlapPercent, coverage.y.actualOverlapPercent);
              const selectedZone = planning.iqiRules.zoneOutputs.find(
                ({ id }) => id === plan?.iqiAssignment.zoneOutputId,
              );

              return (
                <AccordionItem
                  key={acquisition.id}
                  value={acquisition.id}
                  className="rounded-2xl border border-border/80 bg-background/50 px-4 shadow-sm"
                >
                <AccordionTrigger className="gap-3 text-left hover:no-underline">
                  <span className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold">Exposure {index + 1}</span>
                    <span className="max-w-64 truncate text-sm text-muted-foreground">
                      {acquisition.viewId || 'View ID required'}
                    </span>
                    <Badge variant="secondary">Planned</Badge>
                    <Badge variant={acquisition.viewId.trim() ? 'outline' : 'destructive'}>
                      {acquisition.viewId.trim() ? 'Required ID set' : 'Required'}
                    </Badge>
                    <Badge
                      variant="outline"
                      className="font-normal"
                      title="Read-only geometry calculation; the limit remains the user-supplied Required Ug."
                    >
                      Calculated Ug (read-only): {formatMetric(geometry.ugMm, 'mm')}
                    </Badge>
                  </span>
                </AccordionTrigger>
                <AccordionContent className="space-y-5">
                  <div className="flex flex-wrap items-center justify-end gap-1.5 border-b border-border/70 pb-3">
                    <Button type="button" size="sm" variant="outline" onClick={() => onDuplicate(acquisition.id)}>
                      <Copy className="mr-1.5 h-3.5 w-3.5" />
                      Duplicate
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      disabled={index === 0}
                      aria-label={`Move acquisition ${index + 1} up`}
                      onClick={() => onMove(acquisition.id, 'up')}
                    >
                      <ArrowUp className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      disabled={index === data.length - 1}
                      aria-label={`Move acquisition ${index + 1} down`}
                      onClick={() => onMove(acquisition.id, 'down')}
                    >
                      <ArrowDown className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="text-destructive hover:text-destructive"
                      aria-label={`Delete acquisition ${index + 1}`}
                      onClick={() => onDelete(acquisition.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  <section className="space-y-3">
                    <div>
                      <h3 className="text-sm font-semibold text-foreground">Required acquisition identity</h3>
                      <p className="note-clamp text-xs text-muted-foreground">
                        Use controlled, project-specific identifiers; no values are inferred from example techniques.
                      </p>
                    </div>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <TextField
                        label="View ID"
                        value={acquisition.viewId}
                        onChange={(value) => onChange(acquisition.id, { viewId: value })}
                        hint="required and unique"
                      />
                      <TextField
                        label="Description"
                        value={acquisition.description}
                        onChange={(value) => onChange(acquisition.id, { description: value })}
                      />
                      <TextField
                        label="Orientation"
                        value={acquisition.orientation}
                        onChange={(value) => onChange(acquisition.id, { orientation: value })}
                      />
                      <TextField
                        label="Inspection Zone"
                        value={acquisition.inspectionZone}
                        onChange={(value) => onChange(acquisition.id, { inspectionZone: value })}
                      />
                      <TextField
                        label="Reference Attachment ID"
                        value={acquisition.referenceAttachmentId}
                        onChange={(value) => onChange(acquisition.id, { referenceAttachmentId: value })}
                        placeholder="Controlled drawing, sketch, or attachment"
                      />
                    </div>
                  </section>

                  <section className="space-y-3 border-t border-border/70 pt-5">
                    <div>
                      <h3 className="text-sm font-semibold text-foreground">Planned setup map</h3>
                      <p className="note-clamp text-xs text-muted-foreground">
                        Vector preview generated from the controlled acquisition geometry. Numeric fields below remain governing.
                      </p>
                    </div>
                    <RtRadiographySetupDiagram
                      mode="dda"
                      title={`${acquisition.viewId || `Acquisition ${index + 1}`} DDA setup`}
                      sourceLabel={[source.manufacturer, source.model].filter(Boolean).join(' / ')}
                      partLabel={acquisition.description}
                      receptorLabel="DDA detector"
                      viewId={acquisition.viewId}
                      callout={acquisition.referenceAttachmentId}
                      orientation={acquisition.orientation}
                      inspectionZone={acquisition.inspectionZone}
                      iqiPlacement={acquisition.iqiOverride}
                      markerPlacement={acquisition.markingInstructions}
                      distances={{
                        sourceToReceptor: { value: acquisition.sdd, unit: acquisition.sddUnit },
                        sourceToObject: { value: acquisition.sod, unit: acquisition.sodUnit },
                        objectToReceptor: { value: acquisition.odd, unit: acquisition.oddUnit },
                      }}
                    />
                  </section>

                  <section className="space-y-4 border-t border-border/70 pt-5">
                    <div>
                      <h3 className="text-sm font-semibold text-foreground">Auto-grid placement &amp; live results</h3>
                      <p className="note-clamp text-xs text-muted-foreground">
                        Placement is the committed planner output. Engineering results below are recalculated live and are not stored in the technique document.
                      </p>
                    </div>
                    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                      <div className="rounded-lg border border-border/70 bg-muted/15 p-3"><div className="text-xs text-muted-foreground">Grid cell</div><div className="mt-1 font-semibold tabular-nums">{plan?.gridPlacement.row || '—'} / {plan?.gridPlacement.column || '—'}</div></div>
                      <div className="rounded-lg border border-border/70 bg-muted/15 p-3"><div className="text-xs text-muted-foreground">Center</div><div className="mt-1 font-semibold tabular-nums">{typeof plan?.gridPlacement.centerX === 'number' && typeof plan.gridPlacement.centerY === 'number' ? `${plan.gridPlacement.centerX}, ${plan.gridPlacement.centerY} ${plan.gridPlacement.unit}` : '—'}</div></div>
                      <div className="rounded-lg border border-border/70 bg-muted/15 p-3"><div className="text-xs text-muted-foreground">Orientation</div><div className="mt-1 font-semibold">{plan?.gridPlacement.detectorOrientation || '—'}</div></div>
                      <div className="rounded-lg border border-border/70 bg-muted/15 p-3"><div className="text-xs text-muted-foreground">Coverage overlap</div><div className="mt-1 font-semibold tabular-nums">{formatMetric(overlap, '%')}</div></div>
                      <div className="rounded-lg border border-border/70 bg-background p-3"><div className="text-xs text-muted-foreground">Magnification</div><div className="mt-1 font-semibold tabular-nums">{formatMetric(geometry.magnification, '×')}</div></div>
                      <div className="rounded-lg border border-border/70 bg-background p-3"><div className="text-xs text-muted-foreground">Ug</div><div className="mt-1 font-semibold tabular-nums">{formatMetric(geometry.ugMm, 'mm')}</div></div>
                      <div className="rounded-lg border border-border/70 bg-background p-3"><div className="text-xs text-muted-foreground">Effective object pixel</div><div className="mt-1 font-semibold tabular-nums">{formatMetric(geometry.effectiveObjectPixelMm, 'mm')}</div></div>
                      <div className="rounded-lg border border-border/70 bg-background p-3"><div className="text-xs text-muted-foreground">Object FOV</div><div className="mt-1 font-semibold tabular-nums">{geometry.objectFovWidthMm === null || geometry.objectFovHeightMm === null ? '—' : `${formatMetric(geometry.objectFovWidthMm)} × ${formatMetric(geometry.objectFovHeightMm)} mm`}</div></div>
                    </div>
                    {coverage.warnings.length ? (
                      <p role="alert" className="text-sm text-amber-700 dark:text-amber-300">
                        Coverage warning: {coverage.warnings.map((warning) => warning === 'underlap' ? 'underlap' : 'excessive overlap').join(' · ')}
                      </p>
                    ) : null}
                  </section>

                  {plan ? (
                    <section className="space-y-5 border-t border-border/70 pt-5">
                      <div>
                        <h3 className="text-sm font-semibold text-foreground">Structured IQI assignment</h3>
                        <p className="note-clamp text-xs text-muted-foreground">The assignment is specific to this exposure and remains linked to its governing zone output.</p>
                      </div>
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                        <SelectField
                          label="IQI Zone Output"
                          value={plan.iqiAssignment.zoneOutputId || '__none__'}
                          onChange={(value) => {
                            const output = planning.iqiRules.zoneOutputs.find(({ id }) => id === value);
                            updatePlan(acquisition, {
                              iqiAssignment: {
                                ...plan.iqiAssignment,
                                zoneOutputId: value === '__none__' ? '' : value,
                                designation: output?.designation ?? '',
                                requiredWire: output?.requiredWire ?? '',
                                requiredHole: output?.requiredHole ?? '',
                                shimRequirement: output?.shimRequirement ?? '',
                                positionDescription: output?.placement ?? plan.iqiAssignment.positionDescription,
                              },
                            });
                          }}
                          options={[
                            { label: 'No structured IQI assignment', value: '__none__' },
                            ...planning.iqiRules.zoneOutputs.map((output) => ({
                              label: `${output.thicknessZoneId || 'Unassigned zone'} — ${output.designation || output.requiredWire || output.requiredHole || 'IQI output'}`,
                              value: output.id,
                            })),
                          ]}
                        />
                        <TextField label="Designation" value={plan.iqiAssignment.designation} onChange={(designation) => updatePlan(acquisition, { iqiAssignment: { ...plan.iqiAssignment, designation } })} disabled={Boolean(plan.iqiAssignment.zoneOutputId)} />
                        <TextField label="Required Wire" value={plan.iqiAssignment.requiredWire} onChange={(requiredWire) => updatePlan(acquisition, { iqiAssignment: { ...plan.iqiAssignment, requiredWire } })} disabled={Boolean(plan.iqiAssignment.zoneOutputId)} />
                        <TextField label="Required Hole" value={plan.iqiAssignment.requiredHole} onChange={(requiredHole) => updatePlan(acquisition, { iqiAssignment: { ...plan.iqiAssignment, requiredHole } })} disabled={Boolean(plan.iqiAssignment.zoneOutputId)} />
                        <TextField label="Shim Requirement" value={plan.iqiAssignment.shimRequirement} onChange={(shimRequirement) => updatePlan(acquisition, { iqiAssignment: { ...plan.iqiAssignment, shimRequirement } })} disabled={Boolean(plan.iqiAssignment.zoneOutputId)} />
                        <TextField label="IQI Position Description" value={plan.iqiAssignment.positionDescription} onChange={(positionDescription) => updatePlan(acquisition, { iqiAssignment: { ...plan.iqiAssignment, positionDescription } })} />
                        <NumberField label="IQI Position X" value={plan.iqiAssignment.position.x} onChange={(x) => updatePlan(acquisition, { iqiAssignment: { ...plan.iqiAssignment, position: { ...plan.iqiAssignment.position, x } } })} unit="0–1" min={0} max={1} step="0.001" />
                        <NumberField label="IQI Position Y" value={plan.iqiAssignment.position.y} onChange={(y) => updatePlan(acquisition, { iqiAssignment: { ...plan.iqiAssignment, position: { ...plan.iqiAssignment.position, y } } })} unit="0–1" min={0} max={1} step="0.001" />
                      </div>
                      {selectedZone?.requiredSensitivity ? <p className="text-xs text-muted-foreground">Required sensitivity from linked rule: {selectedZone.requiredSensitivity}</p> : null}

                      <div className="border-t border-border/70 pt-5">
                        <h3 className="text-sm font-semibold text-foreground">Visual setup controls</h3>
                        <p className="mb-3 text-xs text-muted-foreground">Normalized positions preserve a stable link to the Section 05 planner.</p>
                        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                          <NumberField label="Source X" value={plan.visual.sourcePosition.x} onChange={(x) => updatePlan(acquisition, { visual: { ...plan.visual, sourcePosition: { ...plan.visual.sourcePosition, x } } })} unit="0–1" min={0} max={1} step="0.001" />
                          <NumberField label="Source Y" value={plan.visual.sourcePosition.y} onChange={(y) => updatePlan(acquisition, { visual: { ...plan.visual, sourcePosition: { ...plan.visual.sourcePosition, y } } })} unit="0–1" min={0} max={1} step="0.001" />
                          <NumberField label="Detector X" value={plan.visual.detectorPosition.x} onChange={(x) => updatePlan(acquisition, { visual: { ...plan.visual, detectorPosition: { ...plan.visual.detectorPosition, x } } })} unit="0–1" min={0} max={1} step="0.001" />
                          <NumberField label="Detector Y" value={plan.visual.detectorPosition.y} onChange={(y) => updatePlan(acquisition, { visual: { ...plan.visual, detectorPosition: { ...plan.visual.detectorPosition, y } } })} unit="0–1" min={0} max={1} step="0.001" />
                          <NumberField label="Detector Rotation" value={plan.visual.detectorRotationDegrees} onChange={(detectorRotationDegrees) => updatePlan(acquisition, { visual: { ...plan.visual, detectorRotationDegrees } })} unit="deg" step="0.1" />
                          <NumberField label="Beam Center X" value={plan.visual.beamCenter.x} onChange={(x) => updatePlan(acquisition, { visual: { ...plan.visual, beamCenter: { ...plan.visual.beamCenter, x } } })} unit="0–1" min={0} max={1} step="0.001" />
                          <NumberField label="Beam Center Y" value={plan.visual.beamCenter.y} onChange={(y) => updatePlan(acquisition, { visual: { ...plan.visual, beamCenter: { ...plan.visual.beamCenter, y } } })} unit="0–1" min={0} max={1} step="0.001" />
                          <NumberField label="Beam Angle" value={plan.visual.beamAngleDegrees} onChange={(beamAngleDegrees) => updatePlan(acquisition, { visual: { ...plan.visual, beamAngleDegrees } })} unit="deg" step="0.1" />
                          <SelectField
                            label="Inspection Area"
                            value={plan.visual.inspectionAreaId || '__none__'}
                            onChange={(value) => updatePlan(acquisition, { visual: { ...plan.visual, inspectionAreaId: value === '__none__' ? '' : value } })}
                            options={[
                              { label: 'No linked inspection area', value: '__none__' },
                              ...(planning.part.inspectionAreas.mode === 'Entire Part'
                                ? [resolveRtDigitalInspectionArea(planning.part)].filter((area) => area !== null).map((area) => ({ label: area.areaId, value: area.id }))
                                : []),
                              ...planning.part.inspectionAreas.areas.map((area) => ({ label: area.areaId || area.description || area.id, value: area.id })),
                            ]}
                          />
                          <TextAreaField label="Lead Markers" value={plan.visual.leadMarkers} onChange={(leadMarkers) => updatePlan(acquisition, { visual: { ...plan.visual, leadMarkers } })} rows={2} />
                        </div>
                      </div>
                    </section>
                  ) : null}

                  <div className="border-t border-border/70 pt-5">
                    <RtDigitalAcquisitionFields
                      data={acquisition}
                      onChange={(patch) => onChange(acquisition.id, patch)}
                    />
                  </div>
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
