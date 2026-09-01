import { Plus, Trash2 } from 'lucide-react';
import { RtDigitalAttachmentField } from '@/components/tabs/rt-digital/RtDigitalAttachmentField';
import { RtDigitalPartReferenceMap } from '@/components/tabs/rt-digital/RtDigitalPartReferenceMap';
import { resolveRtDigitalInspectionArea } from '@/lib/rtDigitalPlanning';
import {
  DateField,
  NumberField,
  SelectField,
  TextAreaField,
  TextField,
} from '@/components/tabs/shared/FieldRow';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type {
  LengthUnit,
  RtDigitalGeneralInfo,
  RtDigitalInspectionArea,
  RtDigitalInspectionAreaMode,
  RtDigitalManufacturingProcess,
  RtDigitalPartDefinition,
  RtDigitalPartGeometry,
  RtDigitalPartGeometryType,
  RtDigitalPlanning,
  RtDigitalThicknessDefinition,
  RtDigitalThicknessMode,
  RtDigitalThicknessZone,
  RtDigitalVisualRegion,
} from '@/types/rtDigital';

interface Props {
  data: RtDigitalGeneralInfo;
  planning: RtDigitalPlanning;
  onChange: (data: RtDigitalGeneralInfo) => void;
  onPlanningChange: (planning: RtDigitalPlanning) => void;
}

const LENGTH_UNITS: ReadonlyArray<{ label: string; value: LengthUnit }> = [
  { label: 'mm', value: 'mm' },
  { label: 'inch', value: 'inch' },
];

const MANUFACTURING_PROCESSES: ReadonlyArray<Exclude<RtDigitalManufacturingProcess, ''>> = [
  'Casting',
  'Weldment',
  'Forging',
  'Additive Manufacturing',
  'Assembly',
  'Other',
];

const GEOMETRY_TYPES: ReadonlyArray<Exclude<RtDigitalPartGeometryType, ''>> = [
  'Flat / Plate',
  'Rectangular',
  'Pipe / Tube',
  'Cylinder',
  'Ring',
  'Cone',
  'Complex Casting',
  'Other',
];

const THICKNESS_MODES: ReadonlyArray<Exclude<RtDigitalThicknessMode, ''>> = [
  'Single Thickness',
  'Thickness Range',
  'Multiple Thickness Zones',
];

const INSPECTION_AREA_MODES: ReadonlyArray<Exclude<RtDigitalInspectionAreaMode, ''>> = [
  'Entire Part',
  'Defined Area',
  'Multiple Areas',
];

const emptyRegion = (): RtDigitalVisualRegion => ({
  x: '',
  y: '',
  width: '',
  height: '',
  rotationDegrees: '',
});

const createRecordId = (prefix: string): string => {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return `${prefix}-${globalThis.crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
};

const nextSequentialId = (prefix: string, values: string[]): string => {
  const used = new Set(values.map((value) => value.trim().toUpperCase()));
  let sequence = 1;
  while (used.has(`${prefix}-${sequence.toString().padStart(2, '0')}`)) sequence += 1;
  return `${prefix}-${sequence.toString().padStart(2, '0')}`;
};

const createGeometry = (
  geometryType: RtDigitalPartGeometryType,
  current: RtDigitalPartGeometry,
): RtDigitalPartGeometry => {
  const base = { id: current.id, geometryType, unit: current.unit };
  switch (geometryType) {
    case 'Flat / Plate':
    case 'Rectangular':
      return { ...base, geometryType, length: '', width: '', height: '' };
    case 'Pipe / Tube':
    case 'Cylinder':
    case 'Ring':
      return { ...base, geometryType, outsideDiameter: '', insideDiameter: '', length: '' };
    case 'Cone':
      return { ...base, geometryType, majorDiameter: '', minorDiameter: '', height: '', wallThickness: '' };
    case 'Complex Casting':
      return {
        ...base,
        geometryType,
        boundingLength: '',
        boundingWidth: '',
        boundingHeight: '',
        inspectionEnvelope: '',
      };
    case 'Other':
      return { ...base, geometryType, description: '' };
    default:
      return { ...base, geometryType: '' };
  }
};

const createThickness = (
  mode: RtDigitalThicknessMode,
  current: RtDigitalThicknessDefinition,
): RtDigitalThicknessDefinition => {
  const base = { id: current.id, mode, unit: current.unit };
  switch (mode) {
    case 'Single Thickness':
      return { ...base, mode, thickness: '' };
    case 'Thickness Range':
      return { ...base, mode, minimum: '', maximum: '' };
    case 'Multiple Thickness Zones':
      return { ...base, mode, zones: [] };
    default:
      return { ...base, mode: '' };
  }
};

const createThicknessZone = (zones: RtDigitalThicknessZone[]): RtDigitalThicknessZone => ({
  id: createRecordId('dr-thickness-zone'),
  zoneId: nextSequentialId('TZ', zones.map((zone) => zone.zoneId)),
  description: '',
  minimum: '',
  maximum: '',
  governing: '',
  position: emptyRegion(),
});

const createInspectionArea = (areas: RtDigitalInspectionArea[]): RtDigitalInspectionArea => ({
  id: createRecordId('dr-inspection-area'),
  areaId: nextSequentialId('AREA', areas.map((area) => area.areaId)),
  description: '',
  width: '',
  height: '',
  unit: 'mm',
  position: emptyRegion(),
});

interface RegionFieldsProps {
  value: RtDigitalVisualRegion;
  onChange: (value: RtDigitalVisualRegion) => void;
}

function RegionFields({ value, onChange }: RegionFieldsProps) {
  return (
    <div className="grid grid-cols-2 gap-3 rounded-lg border border-border/70 bg-muted/15 p-3 sm:grid-cols-5">
      <NumberField label="X" value={value.x} onChange={(x) => onChange({ ...value, x })} unit="0–1" min={0} max={1} step="0.001" />
      <NumberField label="Y" value={value.y} onChange={(y) => onChange({ ...value, y })} unit="0–1" min={0} max={1} step="0.001" />
      <NumberField label="Width" value={value.width} onChange={(width) => onChange({ ...value, width })} unit="0–1" min={0} max={1} step="0.001" />
      <NumberField label="Height" value={value.height} onChange={(height) => onChange({ ...value, height })} unit="0–1" min={0} max={1} step="0.001" />
      <NumberField
        label="Rotation"
        value={value.rotationDegrees}
        onChange={(rotationDegrees) => onChange({ ...value, rotationDegrees })}
        unit="deg"
        step="0.1"
      />
    </div>
  );
}

export const RtDigitalGeneralTab = ({ data, planning, onChange, onPlanningChange }: Props) => {
  const part = planning.part;
  const geometry = part.geometry;
  const thicknessDefinition = part.thickness;
  const thicknessZones = thicknessDefinition.mode === 'Multiple Thickness Zones'
    ? thicknessDefinition.zones
    : [];
  const referenceAttachment = part.attachments.find((attachment) => (
    attachment.id === part.referenceAttachmentId
  )) ?? null;

  const setGeneral = <K extends keyof RtDigitalGeneralInfo>(key: K, value: RtDigitalGeneralInfo[K]) => (
    onChange({ ...data, [key]: value })
  );

  const setPart = (patch: Partial<RtDigitalPartDefinition>) => {
    onPlanningChange({ ...planning, part: { ...part, ...patch } });
  };

  const setSyncedText = (
    generalKey: 'partName' | 'partNumber' | 'vendorCode' | 'partRevisionOrConfiguration' | 'material' | 'surfaceFinish' | 'drawingReference' | 'procedureNumber',
    partKey: 'partName' | 'partNumber' | 'vendorCode' | 'revisionOrConfiguration' | 'material' | 'surfaceFinish' | 'drawingOrSpecificationReference' | 'procedureNumber',
    value: string,
  ) => {
    onChange({ ...data, [generalKey]: value });
    setPart({ [partKey]: value });
  };

  const updateThicknessZone = (id: string, patch: Partial<RtDigitalThicknessZone>) => {
    if (thicknessDefinition.mode !== 'Multiple Thickness Zones') return;
    setPart({
      thickness: {
        ...thicknessDefinition,
        zones: thicknessDefinition.zones.map((zone) => zone.id === id ? { ...zone, ...patch } : zone),
      },
    });
  };

  const updateInspectionArea = (id: string, patch: Partial<RtDigitalInspectionArea>) => {
    setPart({
      inspectionAreas: {
        ...part.inspectionAreas,
        areas: part.inspectionAreas.areas.map((area) => area.id === id ? { ...area, ...patch } : area),
      },
    });
  };

  const setInspectionAreaMode = (mode: RtDigitalInspectionAreaMode) => {
    const currentAreas = part.inspectionAreas.areas;
    const areas = mode === 'Entire Part' || mode === ''
      ? []
      : mode === 'Defined Area'
        ? [currentAreas[0] ?? createInspectionArea([])]
        : currentAreas.length ? currentAreas : [createInspectionArea([])];
    const nextPart: RtDigitalPartDefinition = {
      ...part,
      inspectionAreas: { ...part.inspectionAreas, mode, areas },
    };
    const resolvedArea = resolveRtDigitalInspectionArea(nextPart, planning.geometry.inspectionAreaId);
    onPlanningChange({
      ...planning,
      part: nextPart,
      geometry: {
        ...planning.geometry,
        inspectionAreaId: resolvedArea?.id ?? '',
      },
    });
  };

  const synced = (structuredValue: string, existingValue: string): string => structuredValue || existingValue;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>01. Part &amp; Inspection Definition</CardTitle>
          <p className="note-clamp text-sm text-muted-foreground">
            Define the controlled part and planned DR inspection scope. This section contains inputs only—no calculated results.
          </p>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <TextField label="Part Name" value={synced(part.partName, data.partName)} onChange={(value) => setSyncedText('partName', 'partName', value)} placeholder="Designation per drawing title block" />
          <TextField label="Part Number" value={synced(part.partNumber, data.partNumber)} onChange={(value) => setSyncedText('partNumber', 'partNumber', value)} placeholder="Controlled part / drawing number" />
          <TextField label="Vendor Code" value={synced(part.vendorCode, data.vendorCode)} onChange={(value) => setSyncedText('vendorCode', 'vendorCode', value)} placeholder="Customer or vendor identifier" />
          <TextField
            label="Revision / Configuration"
            value={synced(part.revisionOrConfiguration, data.partRevisionOrConfiguration)}
            onChange={(value) => setSyncedText('partRevisionOrConfiguration', 'revisionOrConfiguration', value)}
          />
          <TextField
            label="Drawing / Specification Reference"
            value={synced(part.drawingOrSpecificationReference, data.drawingReference)}
            onChange={(value) => setSyncedText('drawingReference', 'drawingOrSpecificationReference', value)}
          />
          <TextField
            label="Procedure Number"
            value={synced(part.procedureNumber, data.procedureNumber)}
            onChange={(value) => setSyncedText('procedureNumber', 'procedureNumber', value)}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Material &amp; Manufacturing</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <TextField label="Material" value={synced(part.material, data.material)} onChange={(value) => setSyncedText('material', 'material', value)} placeholder="Alloy and material specification" />
          <TextField label="Material Specification" value={part.materialSpecification} onChange={(materialSpecification) => setPart({ materialSpecification })} />
          <TextField
            label="Material Group"
            value={part.materialGroup}
            onChange={(materialGroup) => setPart({ materialGroup })}
            hint="controlled automatic / database value"
            disabled
          />
          <TextField label="Surface Finish" value={synced(part.surfaceFinish, data.surfaceFinish)} onChange={(value) => setSyncedText('surfaceFinish', 'surfaceFinish', value)} placeholder="Surface condition at inspection" />
          <SelectField
            label="Manufacturing Process"
            value={part.manufacturingProcess}
            onChange={(manufacturingProcess) => setPart({
              manufacturingProcess,
              otherManufacturingProcess: manufacturingProcess === 'Other' ? part.otherManufacturingProcess : '',
            })}
            options={MANUFACTURING_PROCESSES}
          />
          {part.manufacturingProcess === 'Other' ? (
            <TextField label="Other Manufacturing Process" value={part.otherManufacturingProcess} onChange={(otherManufacturingProcess) => setPart({ otherManufacturingProcess })} />
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Part Geometry &amp; Conditional Dimensions</CardTitle>
          <p className="text-sm text-muted-foreground">Only dimensions applicable to the selected geometry are retained.</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <SelectField
              label="Geometry Type"
              value={geometry.geometryType}
              onChange={(geometryType) => setPart({ geometry: createGeometry(geometryType, geometry) })}
              options={GEOMETRY_TYPES}
            />
            <SelectField
              label="Dimension Unit"
              value={geometry.unit}
              onChange={(unit) => setPart({ geometry: { ...geometry, unit } as RtDigitalPartGeometry })}
              options={LENGTH_UNITS}
            />
          </div>

          {geometry.geometryType === 'Flat / Plate' || geometry.geometryType === 'Rectangular' ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <NumberField label="Length" value={geometry.length} onChange={(length) => setPart({ geometry: { ...geometry, length } })} unit={geometry.unit} min={0} />
              <NumberField label="Width" value={geometry.width} onChange={(width) => setPart({ geometry: { ...geometry, width } })} unit={geometry.unit} min={0} />
              <NumberField label="Height" value={geometry.height} onChange={(height) => setPart({ geometry: { ...geometry, height } })} unit={geometry.unit} min={0} />
            </div>
          ) : null}

          {geometry.geometryType === 'Pipe / Tube' || geometry.geometryType === 'Cylinder' || geometry.geometryType === 'Ring' ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <NumberField label="Outside Diameter" value={geometry.outsideDiameter} onChange={(outsideDiameter) => setPart({ geometry: { ...geometry, outsideDiameter } })} unit={geometry.unit} min={0} />
              <NumberField label="Inside Diameter" value={geometry.insideDiameter} onChange={(insideDiameter) => setPart({ geometry: { ...geometry, insideDiameter } })} unit={geometry.unit} min={0} />
              <NumberField label="Length" value={geometry.length} onChange={(length) => setPart({ geometry: { ...geometry, length } })} unit={geometry.unit} min={0} />
            </div>
          ) : null}

          {geometry.geometryType === 'Cone' ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
              <NumberField label="Major Diameter" value={geometry.majorDiameter} onChange={(majorDiameter) => setPart({ geometry: { ...geometry, majorDiameter } })} unit={geometry.unit} min={0} />
              <NumberField label="Minor Diameter" value={geometry.minorDiameter} onChange={(minorDiameter) => setPart({ geometry: { ...geometry, minorDiameter } })} unit={geometry.unit} min={0} />
              <NumberField label="Height" value={geometry.height} onChange={(height) => setPart({ geometry: { ...geometry, height } })} unit={geometry.unit} min={0} />
              <NumberField label="Wall Thickness" value={geometry.wallThickness} onChange={(wallThickness) => setPart({ geometry: { ...geometry, wallThickness } })} unit={geometry.unit} min={0} />
            </div>
          ) : null}

          {geometry.geometryType === 'Complex Casting' ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <NumberField label="Bounding Length" value={geometry.boundingLength} onChange={(boundingLength) => setPart({ geometry: { ...geometry, boundingLength } })} unit={geometry.unit} min={0} />
              <NumberField label="Bounding Width" value={geometry.boundingWidth} onChange={(boundingWidth) => setPart({ geometry: { ...geometry, boundingWidth } })} unit={geometry.unit} min={0} />
              <NumberField label="Bounding Height" value={geometry.boundingHeight} onChange={(boundingHeight) => setPart({ geometry: { ...geometry, boundingHeight } })} unit={geometry.unit} min={0} />
              <TextAreaField label="Inspection Envelope" value={geometry.inspectionEnvelope} onChange={(inspectionEnvelope) => setPart({ geometry: { ...geometry, inspectionEnvelope } })} rows={3} />
            </div>
          ) : null}

          {geometry.geometryType === 'Other' ? (
            <TextAreaField label="Other Geometry Description" value={geometry.description} onChange={(description) => setPart({ geometry: { ...geometry, description } })} rows={3} />
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="gap-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="text-base">Thickness Definition</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">Zone identifiers remain stable after creation.</p>
            </div>
            {thicknessDefinition.mode === 'Multiple Thickness Zones' ? (
              <Button type="button" size="sm" onClick={() => setPart({ thickness: { ...thicknessDefinition, zones: [...thicknessDefinition.zones, createThicknessZone(thicknessDefinition.zones)] } })}>
                <Plus className="h-4 w-4" /> Add Zone
              </Button>
            ) : null}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <SelectField label="Thickness Mode" value={thicknessDefinition.mode} onChange={(mode) => setPart({ thickness: createThickness(mode, thicknessDefinition) })} options={THICKNESS_MODES} />
            <SelectField
              label="Thickness Unit"
              value={thicknessDefinition.unit}
              onChange={(unit) => {
                setPart({ thickness: { ...thicknessDefinition, unit } as RtDigitalThicknessDefinition });
                setGeneral('thicknessUnit', unit);
              }}
              options={LENGTH_UNITS}
            />
          </div>
          {thicknessDefinition.mode === 'Single Thickness' ? (
            <NumberField
              label="Thickness"
              value={thicknessDefinition.thickness}
              onChange={(thickness) => {
                setPart({ thickness: { ...thicknessDefinition, thickness } });
                setGeneral('thickness', thickness);
              }}
              unit={thicknessDefinition.unit}
              min={0}
            />
          ) : null}
          {thicknessDefinition.mode === 'Thickness Range' ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <NumberField label="Minimum Thickness" value={thicknessDefinition.minimum} onChange={(minimum) => setPart({ thickness: { ...thicknessDefinition, minimum } })} unit={thicknessDefinition.unit} min={0} />
              <NumberField label="Maximum Thickness" value={thicknessDefinition.maximum} onChange={(maximum) => setPart({ thickness: { ...thicknessDefinition, maximum } })} unit={thicknessDefinition.unit} min={0} />
            </div>
          ) : null}
          {thicknessDefinition.mode === 'Multiple Thickness Zones' ? (
            <div className="space-y-3">
              {thicknessDefinition.zones.length === 0 ? (
                <p className="rounded-lg border border-dashed border-border p-5 text-center text-sm text-muted-foreground">No thickness zones defined.</p>
              ) : thicknessDefinition.zones.map((zone) => (
                <div key={zone.id} className="space-y-4 rounded-xl border border-border/80 bg-background p-4">
                  <div className="flex items-center justify-between gap-3">
                    <Badge variant="secondary">{zone.zoneId}</Badge>
                    <Button type="button" size="icon" variant="ghost" className="text-destructive hover:text-destructive" aria-label={`Delete ${zone.zoneId}`} onClick={() => setPart({ thickness: { ...thicknessDefinition, zones: thicknessDefinition.zones.filter((candidate) => candidate.id !== zone.id) } })}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
                    <TextField label="Zone Description" value={zone.description} onChange={(description) => updateThicknessZone(zone.id, { description })} />
                    <NumberField label="Minimum" value={zone.minimum} onChange={(minimum) => updateThicknessZone(zone.id, { minimum })} unit={thicknessDefinition.unit} min={0} />
                    <NumberField label="Maximum" value={zone.maximum} onChange={(maximum) => updateThicknessZone(zone.id, { maximum })} unit={thicknessDefinition.unit} min={0} />
                    <NumberField label="Governing" value={zone.governing} onChange={(governing) => updateThicknessZone(zone.id, { governing })} unit={thicknessDefinition.unit} min={0} />
                  </div>
                  <div>
                    <p className="mb-2 text-xs font-medium text-muted-foreground">Position on part (normalized coordinates)</p>
                    <RegionFields value={zone.position} onChange={(position) => updateThicknessZone(zone.id, { position })} />
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="gap-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="text-base">Inspection Area Definition</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">Area dimensions and visual positions are explicit planning inputs.</p>
            </div>
            {part.inspectionAreas.mode === 'Multiple Areas' || (part.inspectionAreas.mode === 'Defined Area' && part.inspectionAreas.areas.length === 0) ? (
              <Button
                type="button"
                size="sm"
                onClick={() => setPart({
                  inspectionAreas: {
                    ...part.inspectionAreas,
                    areas: part.inspectionAreas.mode === 'Defined Area'
                      ? [createInspectionArea([])]
                      : [...part.inspectionAreas.areas, createInspectionArea(part.inspectionAreas.areas)],
                  },
                })}
              >
                <Plus className="h-4 w-4" /> Add Area
              </Button>
            ) : null}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <SelectField label="Inspection Area Mode" value={part.inspectionAreas.mode} onChange={setInspectionAreaMode} options={INSPECTION_AREA_MODES} />
          {part.inspectionAreas.mode === 'Entire Part' ? (
            <p className="rounded-lg border border-primary/20 bg-primary/5 p-4 text-sm">The complete part is the planned inspection area.</p>
          ) : null}
          {part.inspectionAreas.areas.map((area) => (
            <div key={area.id} className="space-y-4 rounded-xl border border-border/80 bg-background p-4">
              <div className="flex items-center justify-between gap-3">
                <Badge variant="secondary">{area.areaId}</Badge>
                {part.inspectionAreas.mode === 'Multiple Areas' ? (
                  <Button type="button" size="icon" variant="ghost" className="text-destructive hover:text-destructive" aria-label={`Delete ${area.areaId}`} onClick={() => setPart({ inspectionAreas: { ...part.inspectionAreas, areas: part.inspectionAreas.areas.filter((candidate) => candidate.id !== area.id) } })}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                ) : null}
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
                <TextField label="Area Description" value={area.description} onChange={(description) => updateInspectionArea(area.id, { description })} />
                <NumberField label="Width" value={area.width} onChange={(width) => updateInspectionArea(area.id, { width })} unit={area.unit} min={0} />
                <NumberField label="Height" value={area.height} onChange={(height) => updateInspectionArea(area.id, { height })} unit={area.unit} min={0} />
                <SelectField label="Unit" value={area.unit} onChange={(unit) => updateInspectionArea(area.id, { unit })} options={LENGTH_UNITS} />
              </div>
              <div>
                <p className="mb-2 text-xs font-medium text-muted-foreground">Position on part (normalized coordinates)</p>
                <RegionFields value={area.position} onChange={(position) => updateInspectionArea(area.id, { position })} />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Technique &amp; Inspection Standard</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <SelectField label="Wall Technique" value={part.technique.wallTechnique} onChange={(wallTechnique) => setPart({ technique: { ...part.technique, wallTechnique } })} options={['Single Wall', 'Double Wall']} />
          <SelectField
            label="Image Technique"
            value={part.technique.imageTechnique}
            onChange={(imageTechnique) => setPart({ technique: { ...part.technique, imageTechnique, otherImageTechnique: imageTechnique === 'Other' ? part.technique.otherImageTechnique : '' } })}
            options={['SWSI', 'DWSI', 'DWDI', 'Elliptical', 'Other']}
          />
          {part.technique.imageTechnique === 'Other' ? (
            <TextField label="Other Image Technique" value={part.technique.otherImageTechnique} onChange={(otherImageTechnique) => setPart({ technique: { ...part.technique, otherImageTechnique } })} />
          ) : null}
          <TextField label="Inspection Standard" value={part.inspectionStandard} onChange={(inspectionStandard) => setPart({ inspectionStandard })} />
          <TextField label="Standard Revision" value={part.inspectionStandardRevision} onChange={(inspectionStandardRevision) => setPart({ inspectionStandardRevision })} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Part Image / Drawing</CardTitle>
          <p className="note-clamp text-sm text-muted-foreground">Attach the visual reference used to mark orientation, inspection areas, thickness zones, and datum.</p>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <RtDigitalAttachmentField
            label="Part Attachments"
            value={part.attachments}
            onChange={(attachments) => setPart({
              attachments,
              referenceAttachmentId: attachments.some((attachment) => attachment.id === part.referenceAttachmentId)
                ? part.referenceAttachmentId
                : '',
            })}
          />
          <SelectField
            label="Reference Attachment"
            value={part.referenceAttachmentId || '__none__'}
            onChange={(value) => setPart({ referenceAttachmentId: value === '__none__' ? '' : value })}
            options={[
              { label: 'No reference selected', value: '__none__' },
              ...part.attachments.map((attachment) => ({ label: attachment.name, value: attachment.id })),
            ]}
            disabled={part.attachments.length === 0}
          />
          <TextField label="Part Orientation" value={part.partOrientation} onChange={(partOrientation) => setPart({ partOrientation })} placeholder="Describe the orientation shown in the reference" />
          <TextField label="Datum / Reference" value={part.datumReference} onChange={(datumReference) => setPart({ datumReference })} placeholder="Datum, zero point, or controlled reference" />
          <RtDigitalPartReferenceMap
            attachment={referenceAttachment}
            inspectionAreas={part.inspectionAreas.areas}
            thicknessZones={thicknessZones}
            orientation={part.partOrientation}
            datumReference={part.datumReference}
            onInspectionAreaPositionChange={(id, position) => updateInspectionArea(id, { position })}
            onThicknessZonePositionChange={(id, position) => updateThicknessZone(id, { position })}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Inspection Administration &amp; Existing Summary</CardTitle>
          <p className="text-sm text-muted-foreground">Existing general fields remain synchronized and available for controlled V3 documents.</p>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <TextField label="Inspection Scope Summary" value={data.inspectionArea} onChange={(value) => setGeneral('inspectionArea', value)} placeholder="Overall zone, weld, region, or extent" />
          <div className="grid grid-cols-[minmax(0,1fr)_7.5rem] gap-2">
            <NumberField label="Nominal Thickness Summary" value={data.thickness} onChange={(value) => setGeneral('thickness', value)} unit={data.thicknessUnit} min={0} />
            <SelectField label="Unit" value={data.thicknessUnit} onChange={(value) => setGeneral('thicknessUnit', value)} options={LENGTH_UNITS} />
          </div>
          <SelectField label="Planned Inspection Stage" value={data.inspectionStage} onChange={(value) => setGeneral('inspectionStage', value)} options={['In-process', 'Final', 'Maintenance / in-service']} />
          <SelectField
            label="Required Personnel Level"
            value={data.inspectorLevel}
            onChange={(value) => setGeneral('inspectorLevel', value)}
            options={[{ label: 'Level I', value: 'I' }, { label: 'Level II', value: 'II' }, { label: 'Level III', value: 'III' }]}
            hint="qualification requirement"
          />
          <DateField label="Planned Inspection Date" value={data.date} onChange={(value) => setGeneral('date', value)} />
        </CardContent>
      </Card>
    </div>
  );
};
