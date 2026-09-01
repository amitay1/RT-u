import { useMemo } from 'react';
import {
  AlertTriangle,
  Calculator,
  CheckCircle2,
  Gauge,
  Ruler,
  Wand2,
  XCircle,
} from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  NumberField,
  SelectField,
  TextAreaField,
  TextField,
} from '@/components/tabs/shared/FieldRow';
import {
  calculateRtDigitalPlanning,
  convertRtDigitalLength,
  resolveRtDigitalInspectionArea,
  type RtDigitalCoverageResult,
  type RtDigitalGeometryCalculationResult,
  type RtDigitalOrientationOption,
} from '@/lib/rtDigitalPlanning';
import type {
  DetectorLengthUnit,
  RtDigitalAcquisitionDefaults,
  RtDigitalDistanceBasis,
  RtDigitalGeometryInputs,
  RtDigitalLengthInput,
  RtDigitalPlanning,
  RtDigitalSource,
  RtDigitalSystem,
} from '@/types/rtDigital';

export interface RtDigitalEngineeringTabProps {
  planning: RtDigitalPlanning;
  source: RtDigitalSource;
  system: RtDigitalSystem;
  defaults: RtDigitalAcquisitionDefaults;
  onPlanningChange: (planning: RtDigitalPlanning) => void;
  onSourceChange: (source: RtDigitalSource) => void;
  onSystemChange: (system: RtDigitalSystem) => void;
  onDefaultsChange: (defaults: RtDigitalAcquisitionDefaults) => void;
}

type DistanceKey = 'sod' | 'sdd' | 'odd';

const DISTANCE_BASES: ReadonlyArray<{ value: Exclude<RtDigitalDistanceBasis, ''>; label: string }> = [
  { value: 'SOD + ODD', label: 'Enter SOD + ODD → derive SDD' },
  { value: 'SDD - ODD', label: 'Enter SDD + ODD → derive SOD' },
  { value: 'SDD - SOD', label: 'Enter SDD + SOD → derive ODD' },
];

const LENGTH_UNITS: ReadonlyArray<{ value: DetectorLengthUnit; label: string }> = [
  { value: 'mm', label: 'mm' },
  { value: 'inch', label: 'inch' },
];

const DETECTOR_LENGTH_UNITS: ReadonlyArray<{ value: DetectorLengthUnit; label: string }> = [
  { value: 'um', label: 'µm' },
  { value: 'mm', label: 'mm' },
  { value: 'inch', label: 'inch' },
];

const derivedKeyForBasis = (basis: RtDigitalDistanceBasis): DistanceKey | null => {
  if (basis === 'SOD + ODD') return 'sdd';
  if (basis === 'SDD - ODD') return 'sod';
  if (basis === 'SDD - SOD') return 'odd';
  return null;
};

const valueInUnit = (millimetres: number | null, unit: DetectorLengthUnit): number | null => (
  millimetres === null ? null : convertRtDigitalLength(millimetres, 'mm', unit)
);

const formatMetric = (value: number | null, unit = ''): string => (
  value === null
    ? '—'
    : `${Number(value.toFixed(4)).toLocaleString()}${unit ? ` ${unit}` : ''}`
);

const statusBadge = (status: 'pass' | 'fail' | null) => {
  if (status === 'pass') {
    return <Badge className="bg-emerald-600 hover:bg-emerald-600"><CheckCircle2 className="mr-1 h-3.5 w-3.5" />PASS</Badge>;
  }
  if (status === 'fail') {
    return <Badge variant="destructive"><XCircle className="mr-1 h-3.5 w-3.5" />FAIL</Badge>;
  }
  return <Badge variant="outline">Not evaluated</Badge>;
};

interface MetricProps {
  label: string;
  value: string;
  status?: 'pass' | 'fail' | null;
  hint?: string;
}

const Metric = ({ label, value, status, hint }: MetricProps) => (
  <div className="rounded-xl border border-border/70 bg-background/70 p-3">
    <div className="flex items-start justify-between gap-2">
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
      {status !== undefined ? statusBadge(status) : null}
    </div>
    <div className="mt-2 text-lg font-semibold tabular-nums text-foreground">{value}</div>
    {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
  </div>
);

interface OrientationSummaryProps {
  option: RtDigitalOrientationOption;
  preferred: boolean;
}

const coverageWarnings = (coverage: RtDigitalCoverageResult): string => {
  if (coverage.status !== 'complete') return coverage.issues.join(' ') || 'Inputs incomplete.';
  if (coverage.warnings.length === 0) return 'Coverage complete without overlap warnings.';
  return coverage.warnings.map((warning) => (
    warning === 'underlap' ? 'Underlap / incomplete coverage' : 'Excessive overlap'
  )).join(' · ');
};

const OrientationSummary = ({ option, preferred }: OrientationSummaryProps) => (
  <div className="rounded-xl border border-border/70 bg-background/70 p-4">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h4 className="text-sm font-semibold">{option.orientation}</h4>
      {preferred ? <Badge><Wand2 className="mr-1 h-3.5 w-3.5" />Preferred</Badge> : null}
    </div>
    <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
      <div><span className="text-muted-foreground">Exposures</span><div className="font-semibold tabular-nums">{option.coverage.totalExposureCount ?? '—'}</div></div>
      <div><span className="text-muted-foreground">Grid</span><div className="font-semibold tabular-nums">{option.coverage.x && option.coverage.y ? `${option.coverage.x.count} × ${option.coverage.y.count}` : '—'}</div></div>
      <div><span className="text-muted-foreground">Object FOV W</span><div className="font-semibold tabular-nums">{formatMetric(option.objectFovWidthMm, 'mm')}</div></div>
      <div><span className="text-muted-foreground">Object FOV H</span><div className="font-semibold tabular-nums">{formatMetric(option.objectFovHeightMm, 'mm')}</div></div>
    </div>
    <p className={`mt-3 text-xs ${option.coverage.warnings.length ? 'text-amber-700 dark:text-amber-300' : 'text-muted-foreground'}`}>
      {coverageWarnings(option.coverage)}
    </p>
  </div>
);

export function RtDigitalEngineeringTab({
  planning,
  source,
  system,
  defaults,
  onPlanningChange,
  onSourceChange,
  onSystemChange,
  onDefaultsChange,
}: RtDigitalEngineeringTabProps) {
  const geometry = planning.geometry;
  const selectedArea = resolveRtDigitalInspectionArea(planning.part, geometry.inspectionAreaId);
  const inspectionAreaOptions = planning.part.inspectionAreas.mode === 'Entire Part' && selectedArea
    ? [selectedArea]
    : planning.part.inspectionAreas.areas;

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

  const setGeometry = (patch: Partial<RtDigitalGeometryInputs>) => {
    onPlanningChange({ ...planning, geometry: { ...geometry, ...patch } });
  };

  const syncDefaultDistance = (key: DistanceKey, input: RtDigitalLengthInput) => {
    const unit = input.unit === 'inch' ? 'inch' : 'mm';
    const value = input.value === '' || input.unit !== 'um'
      ? input.value
      : convertRtDigitalLength(input.value, 'um', 'mm') ?? '';
    if (key === 'sod') onDefaultsChange({ ...defaults, sod: value, sodUnit: unit });
    if (key === 'sdd') onDefaultsChange({ ...defaults, sdd: value, sddUnit: unit });
    if (key === 'odd') onDefaultsChange({ ...defaults, odd: value, oddUnit: unit });
  };

  const setDistance = (key: DistanceKey, input: RtDigitalLengthInput) => {
    setGeometry({ [key]: input });
    syncDefaultDistance(key, input);
  };

  const changeDistanceUnit = (key: DistanceKey, unit: DetectorLengthUnit) => {
    const current = geometry[key];
    const converted = current.value === ''
      ? ''
      : convertRtDigitalLength(current.value, current.unit, unit) ?? '';
    setDistance(key, { value: converted, unit });
  };

  const applyCalculatedDistance = () => {
    const key = calculation.geometry.derivedDistance;
    if (!key) return;
    const millimetres = calculation.geometry[`${key}Mm`];
    if (millimetres === null) return;
    const current = geometry[key];
    const value = valueInUnit(millimetres, current.unit);
    if (value === null) return;
    const next = { ...current, value };
    onPlanningChange({
      ...planning,
      geometry: { ...geometry, distanceBasis: '', [key]: next },
    });
    syncDefaultDistance(key, next);
  };

  const applyMinimumSod = () => {
    const value = valueInUnit(calculation.geometry.minimumSodMm, geometry.sod.unit);
    if (value === null || calculation.geometry.oddMm === null) return;
    const oddValue = valueInUnit(calculation.geometry.oddMm, geometry.odd.unit);
    if (oddValue === null) return;
    const sod = { ...geometry.sod, value };
    const odd = { ...geometry.odd, value: oddValue };
    onPlanningChange({ ...planning, geometry: { ...geometry, distanceBasis: 'SOD + ODD', sod, odd } });
    syncDefaultDistance('sod', sod);
    syncDefaultDistance('odd', odd);
  };

  const applyMaximumOdd = () => {
    const value = valueInUnit(calculation.geometry.maximumOddMm, geometry.odd.unit);
    if (value === null || calculation.geometry.sodMm === null) return;
    const sodValue = valueInUnit(calculation.geometry.sodMm, geometry.sod.unit);
    if (sodValue === null) return;
    const odd = { ...geometry.odd, value };
    const sod = { ...geometry.sod, value: sodValue };
    onPlanningChange({ ...planning, geometry: { ...geometry, distanceBasis: 'SOD + ODD', sod, odd } });
    syncDefaultDistance('sod', sod);
    syncDefaultDistance('odd', odd);
  };

  const applyAvailableDistance = () => {
    const availableMm = convertRtDigitalLength(
      geometry.availableSourceDistance.value,
      geometry.availableSourceDistance.unit,
      'mm',
    );
    if (availableMm === null || availableMm <= 0 || calculation.geometry.oddMm === null) return;
    const sddValue = valueInUnit(availableMm, geometry.sdd.unit);
    const oddValue = valueInUnit(calculation.geometry.oddMm, geometry.odd.unit);
    if (sddValue === null || oddValue === null) return;
    const sdd = { ...geometry.sdd, value: sddValue };
    const odd = { ...geometry.odd, value: oddValue };
    onPlanningChange({ ...planning, geometry: { ...geometry, distanceBasis: 'SDD - ODD', sdd, odd } });
    syncDefaultDistance('sdd', sdd);
    syncDefaultDistance('odd', odd);
  };

  const availableDistanceMm = convertRtDigitalLength(
    geometry.availableSourceDistance.value,
    geometry.availableSourceDistance.unit,
    'mm',
  );
  const availableDistanceStatus = availableDistanceMm !== null && calculation.geometry.sddMm !== null
    ? calculation.geometry.sddMm <= availableDistanceMm
    : null;
  const preferred = calculation.orientation.preferredOrientation;
  const selectedOrientation = planning.detectorSelection.orientation === 'Portrait'
    || planning.detectorSelection.orientation === 'Landscape'
    ? planning.detectorSelection.orientation
    : preferred;
  const selectedOption = selectedOrientation === 'Portrait'
    ? calculation.orientation.portrait
    : calculation.orientation.landscape;
  const derivedKey = derivedKeyForBasis(geometry.distanceBasis);
  const issues = [...calculation.geometry.issues, ...selectedOption.coverage.issues];

  const renderDistance = (key: DistanceKey, label: string) => {
    const input = geometry[key];
    const isDerived = derivedKey === key;
    return (
      <div className="grid grid-cols-[minmax(0,1fr)_7rem] gap-2">
        <NumberField
          label={`${label}${isDerived ? ' (derived)' : ''}`}
          value={isDerived
            ? valueInUnit(calculation.geometry[`${key}Mm`], input.unit) ?? ''
            : input.value}
          onChange={(value) => setDistance(key, { ...input, value })}
          min={key === 'odd' ? 0 : 0.000001}
          disabled={isDerived}
        />
        <SelectField
          label="Unit"
          value={input.unit}
          onChange={(unit) => changeDistanceUnit(key, unit)}
          options={LENGTH_UNITS}
          disabled={isDerived}
        />
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle>4. Geometry &amp; Engineering Calculations</CardTitle>
              <p className="note-clamp mt-1 text-sm text-muted-foreground">
                Live values are calculated from controlled inputs only. Calculations are not persisted unless you explicitly apply one.
              </p>
            </div>
            <Badge variant="outline"><Calculator className="mr-1 h-3.5 w-3.5" />Live, non-persistent results</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <SelectField
              label="Distance Basis"
              value={geometry.distanceBasis}
              onChange={(distanceBasis) => setGeometry({ distanceBasis })}
              options={DISTANCE_BASES}
              placeholder="Select the controlled distance pair…"
              hint="the third distance is derived live"
            />
            <SelectField
              label="Inspection Area"
              value={geometry.inspectionAreaId || selectedArea?.id || ''}
              onChange={(inspectionAreaId) => setGeometry({ inspectionAreaId })}
              options={inspectionAreaOptions.map((area) => ({
                value: area.id,
                label: `${area.areaId || 'Unnamed area'}${area.description ? ` — ${area.description}` : ''}`,
              }))}
              placeholder="Select an area defined in Part Definition…"
            />
            {renderDistance('sod', 'SOD')}
            {renderDistance('sdd', 'SDD')}
            {renderDistance('odd', 'ODD')}
            <div className="grid grid-cols-[minmax(0,1fr)_7rem] gap-2">
              <NumberField
                label="Available Source Distance"
                value={geometry.availableSourceDistance.value}
                onChange={(value) => setGeometry({
                  availableSourceDistance: { ...geometry.availableSourceDistance, value },
                })}
                min={0}
              />
              <SelectField
                label="Unit"
                value={geometry.availableSourceDistance.unit}
                onChange={(unit) => {
                  const converted = geometry.availableSourceDistance.value === ''
                    ? ''
                    : convertRtDigitalLength(
                        geometry.availableSourceDistance.value,
                        geometry.availableSourceDistance.unit,
                        unit,
                      ) ?? '';
                  setGeometry({ availableSourceDistance: { value: converted, unit } });
                }}
                options={LENGTH_UNITS}
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-2 border-t border-border/70 pt-4">
            <Button
              type="button"
              variant="outline"
              disabled={!calculation.geometry.derivedDistance || calculation.geometry.status !== 'complete'}
              onClick={applyCalculatedDistance}
            >
              <Ruler className="mr-1.5 h-4 w-4" />
              Apply derived {calculation.geometry.derivedDistance?.toUpperCase() ?? 'distance'} as controlled
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={availableDistanceMm === null || availableDistanceMm <= 0 || calculation.geometry.oddMm === null}
              onClick={applyAvailableDistance}
            >
              Use available distance as SDD
            </Button>
          </div>

          <div className="grid grid-cols-1 gap-4 border-t border-border/70 pt-5 md:grid-cols-2">
            <div className="grid grid-cols-[minmax(0,1fr)_7rem] gap-2">
              <NumberField
                label="Required Maximum Ug"
                value={geometry.requiredMaximumUg.value}
                onChange={(value) => {
                  setGeometry({ requiredMaximumUg: { ...geometry.requiredMaximumUg, value } });
                  onDefaultsChange({
                    ...defaults,
                    requiredUg: value === '' || geometry.requiredMaximumUg.unit !== 'um'
                      ? value
                      : convertRtDigitalLength(value, 'um', 'mm') ?? '',
                    requiredUgUnit: geometry.requiredMaximumUg.unit === 'inch' ? 'inch' : 'mm',
                  });
                }}
                min={0}
              />
              <SelectField
                label="Unit"
                value={geometry.requiredMaximumUg.unit}
                onChange={(unit) => {
                  const value = geometry.requiredMaximumUg.value === ''
                    ? ''
                    : convertRtDigitalLength(geometry.requiredMaximumUg.value, geometry.requiredMaximumUg.unit, unit) ?? '';
                  setGeometry({ requiredMaximumUg: { value, unit } });
                  onDefaultsChange({ ...defaults, requiredUg: value, requiredUgUnit: unit === 'inch' ? 'inch' : 'mm' });
                }}
                options={LENGTH_UNITS}
              />
            </div>
            <div className="grid grid-cols-[minmax(0,1fr)_7rem] gap-2">
              <NumberField
                label="Required Maximum Effective Pixel"
                value={geometry.requiredMaximumEffectivePixel.value}
                onChange={(value) => setGeometry({
                  requiredMaximumEffectivePixel: { ...geometry.requiredMaximumEffectivePixel, value },
                })}
                min={0}
              />
              <SelectField
                label="Unit"
                value={geometry.requiredMaximumEffectivePixel.unit}
                onChange={(unit) => {
                  const value = geometry.requiredMaximumEffectivePixel.value === ''
                    ? ''
                    : convertRtDigitalLength(
                        geometry.requiredMaximumEffectivePixel.value,
                        geometry.requiredMaximumEffectivePixel.unit,
                        unit,
                      ) ?? '';
                  setGeometry({ requiredMaximumEffectivePixel: { value, unit } });
                }}
                options={DETECTOR_LENGTH_UNITS}
              />
            </div>
            <NumberField
              label="Required Overlap"
              value={geometry.requiredOverlapPercent}
              onChange={(requiredOverlapPercent) => setGeometry({ requiredOverlapPercent })}
              unit="%"
              min={0}
              max={99.999}
            />
            <NumberField
              label="Excessive-overlap Warning"
              value={geometry.excessiveOverlapThresholdPercent}
              onChange={(excessiveOverlapThresholdPercent) => setGeometry({ excessiveOverlapThresholdPercent })}
              unit="%"
              min={0}
              max={99.999}
            />
            <TextAreaField
              label="Geometry Restrictions"
              value={geometry.geometryRestrictions}
              onChange={(geometryRestrictions) => setGeometry({ geometryRestrictions })}
              placeholder="Access, stand-off, fixture, collision, motion, or envelope restrictions"
              rows={3}
            />
            <TextField
              label="Level III Approval Reference"
              value={geometry.levelThreeApprovalReference}
              onChange={(levelThreeApprovalReference) => setGeometry({ levelThreeApprovalReference })}
              placeholder="Required when an optimized/overridden setup is formally accepted"
            />
          </div>

          <div className="grid grid-cols-1 gap-3 border-t border-border/70 pt-5 sm:grid-cols-3">
            {([
              ['optimizeExposureCount', 'Optimize exposure count'],
              ['optimizeSodForUg', 'Optimize SOD for Ug'],
              ['optimizeOdd', 'Optimize ODD'],
            ] as const).map(([key, label]) => (
              <label key={key} className="flex items-center gap-2 rounded-lg border border-border/70 p-3 text-sm">
                <Checkbox
                  checked={geometry[key]}
                  onCheckedChange={(checked) => setGeometry({ [key]: checked === true })}
                />
                <span>{label}</span>
              </label>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Calculation Inputs from Source &amp; Detector</CardTitle>
          <p className="note-clamp text-sm text-muted-foreground">These remain controlled equipment inputs and are updated through their owning data records.</p>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="grid grid-cols-[minmax(0,1fr)_7rem] gap-2">
            <NumberField label="Focal Spot" value={source.focalSpotSize} onChange={(focalSpotSize) => onSourceChange({ ...source, focalSpotSize })} min={0} />
            <SelectField
              label="Unit"
              value={source.focalSpotSizeUnit}
              onChange={(focalSpotSizeUnit) => onSourceChange({
                ...source,
                focalSpotSize: source.focalSpotSize === ''
                  ? ''
                  : convertRtDigitalLength(source.focalSpotSize, source.focalSpotSizeUnit, focalSpotSizeUnit) ?? '',
                focalSpotSizeUnit,
              })}
              options={LENGTH_UNITS}
            />
          </div>
          <div className="grid grid-cols-[minmax(0,1fr)_7rem] gap-2">
            <NumberField label="Detector Pixel" value={system.pixelSize} onChange={(pixelSize) => onSystemChange({ ...system, pixelSize })} min={0} />
            <SelectField
              label="Unit"
              value={system.pixelSizeUnit}
              onChange={(pixelSizeUnit) => onSystemChange({
                ...system,
                pixelSize: system.pixelSize === ''
                  ? ''
                  : convertRtDigitalLength(system.pixelSize, system.pixelSizeUnit, pixelSizeUnit) ?? '',
                pixelSizeUnit,
              })}
              options={DETECTOR_LENGTH_UNITS}
            />
          </div>
          <div className="grid grid-cols-[minmax(0,1fr)_7rem] gap-2">
            <NumberField label="Detector Active Width" value={system.activeAreaWidth} onChange={(activeAreaWidth) => onSystemChange({ ...system, activeAreaWidth })} min={0} />
            <SelectField
              label="Unit"
              value={system.activeAreaUnit}
              onChange={(activeAreaUnit) => onSystemChange({
                ...system,
                activeAreaWidth: system.activeAreaWidth === ''
                  ? ''
                  : convertRtDigitalLength(system.activeAreaWidth, system.activeAreaUnit, activeAreaUnit) ?? '',
                activeAreaHeight: system.activeAreaHeight === ''
                  ? ''
                  : convertRtDigitalLength(system.activeAreaHeight, system.activeAreaUnit, activeAreaUnit) ?? '',
                activeAreaUnit,
              })}
              options={LENGTH_UNITS}
            />
          </div>
          <NumberField label="Detector Active Height" value={system.activeAreaHeight} onChange={(activeAreaHeight) => onSystemChange({ ...system, activeAreaHeight })} unit={system.activeAreaUnit} min={0} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-base">Live Engineering Results</CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant={calculation.geometry.status === 'complete' ? 'default' : calculation.geometry.status === 'invalid' ? 'destructive' : 'secondary'}>
                {calculation.geometry.status}
              </Badge>
              {availableDistanceStatus === null ? null : availableDistanceStatus
                ? <Badge className="bg-emerald-600 hover:bg-emerald-600">Available distance PASS</Badge>
                : <Badge variant="destructive">Available distance FAIL</Badge>}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          {issues.length ? (
            <Alert variant={calculation.geometry.status === 'invalid' ? 'destructive' : 'default'}>
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Calculation guidance</AlertTitle>
              <AlertDescription>{[...new Set(issues)].join(' ')}</AlertDescription>
            </Alert>
          ) : null}

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Metric label="SOD" value={formatMetric(calculation.geometry.sodMm, 'mm')} />
            <Metric label="ODD" value={formatMetric(calculation.geometry.oddMm, 'mm')} />
            <Metric label="SDD" value={formatMetric(calculation.geometry.sddMm, 'mm')} />
            <Metric label="Magnification" value={formatMetric(calculation.geometry.magnification, '×')} />
            <Metric label="Geometric unsharpness Ug" value={formatMetric(calculation.geometry.ugMm, 'mm')} status={calculation.geometry.ugStatus} />
            <Metric label="Minimum SOD" value={formatMetric(calculation.geometry.minimumSodMm, 'mm')} hint="For the entered ODD and required Ug" />
            <Metric label="Maximum ODD" value={formatMetric(calculation.geometry.maximumOddMm, 'mm')} hint="For the entered SOD and required Ug" />
            <Metric label="Effective object pixel" value={formatMetric(calculation.geometry.effectiveObjectPixelMm, 'mm')} status={calculation.geometry.resolutionStatus} />
            <Metric label="Object FOV width" value={formatMetric(selectedOption.objectFovWidthMm, 'mm')} />
            <Metric label="Object FOV height" value={formatMetric(selectedOption.objectFovHeightMm, 'mm')} />
            <Metric label="Exposure grid" value={selectedOption.coverage.x && selectedOption.coverage.y ? `${selectedOption.coverage.x.count} × ${selectedOption.coverage.y.count}` : '—'} />
            <Metric label="Exposure count" value={selectedOption.coverage.totalExposureCount?.toLocaleString() ?? '—'} />
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" disabled={calculation.geometry.minimumSodMm === null} onClick={applyMinimumSod}>
              <Gauge className="mr-1.5 h-4 w-4" />Apply minimum SOD
            </Button>
            <Button type="button" variant="outline" disabled={calculation.geometry.maximumOddMm === null} onClick={applyMaximumOdd}>
              <Gauge className="mr-1.5 h-4 w-4" />Apply maximum ODD
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle className="text-base">Detector Orientation &amp; Coverage Comparison</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">Landscape wins ties deterministically; warnings remain visible for Level III review.</p>
            </div>
            {preferred ? (
              <Button
                type="button"
                onClick={() => onPlanningChange({
                  ...planning,
                  detectorSelection: { ...planning.detectorSelection, orientation: preferred },
                })}
              >
                <Wand2 className="mr-1.5 h-4 w-4" />Apply {preferred}
              </Button>
            ) : null}
          </div>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <OrientationSummary option={calculation.orientation.portrait} preferred={preferred === 'Portrait'} />
          <OrientationSummary option={calculation.orientation.landscape} preferred={preferred === 'Landscape'} />
          <div className="md:col-span-2">
            <Label className="text-xs text-muted-foreground">
              Selected calculation orientation: <span className="font-semibold text-foreground">{selectedOrientation ?? 'not available'}</span>
            </Label>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
