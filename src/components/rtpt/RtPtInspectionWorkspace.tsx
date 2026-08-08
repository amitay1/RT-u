import { useState, type ReactNode } from 'react';
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  ClipboardCheck,
  Droplets,
  Film,
  Link2,
  Plus,
  ShieldCheck,
  Trash2,
  UserCheck,
  Wrench,
} from 'lucide-react';

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  DateField,
  FieldShell,
  NumberField,
  SelectField,
  TextAreaField,
  TextField,
} from '@/components/tabs/shared/FieldRow';
import type { RtPtInspectionReportController } from '@/hooks/useRtPtInspectionReportState';
import { createRtPtIndicationId } from '@/lib/rtPtInspectionReport';
import type { RtPtInspectionReportIssue } from '@/lib/rtPtInspectionReportValidation';
import type { CertificationLevel } from '@/types/inspectorProfile';
import {
  RT_PT_METHOD_LABEL,
  type RtPtDocumentV3,
  type RtPtMethod,
} from '@/types/rtPtDocument';
import type {
  PtPerformedResults,
  RtDigitalPerformedResult,
  RtFilmPerformedResult,
  RtPtBooleanOrEmpty,
  RtPtDisposition,
  RtPtIndicationRecord,
  RtPtInspectionReportControl,
  RtPtInspectionReportStatus,
  RtPtInspectionResult,
  RtPtReportApproval,
  RtPtReportApprovalRole,
} from '@/types/rtPtInspectionReport';
import type {
  LengthUnit,
  NumberOrEmpty,
  TemperatureUnit,
  TimeUnit,
} from '@/types/rtFilm';
import type { DigitalTimeUnit } from '@/types/rtDigital';

export interface RtPtInspectionWorkspaceProps {
  controller: RtPtInspectionReportController;
  technique: RtPtDocumentV3;
}

type WorkspaceSection = 'details' | 'results' | 'indications' | 'review';

const STATUS_LABELS: Record<RtPtInspectionReportStatus, string> = {
  draft: 'Draft',
  'in-review': 'In review',
  approved: 'Approved',
  superseded: 'Superseded',
};

const METHOD_ICONS: Record<RtPtMethod, typeof Film> = {
  'RT-Film': Film,
  'RT-Digital': Camera,
  PT: Droplets,
};

const LENGTH_UNITS: ReadonlyArray<{ label: string; value: LengthUnit }> = [
  { label: 'mm', value: 'mm' },
  { label: 'inch', value: 'inch' },
];

const TIME_UNITS: ReadonlyArray<{ label: string; value: Exclude<TimeUnit, ''> }> = [
  { label: 'seconds', value: 's' },
  { label: 'minutes', value: 'min' },
];

const DIGITAL_TIME_UNITS: ReadonlyArray<{ label: string; value: Exclude<DigitalTimeUnit, ''> }> = [
  { label: 'milliseconds', value: 'ms' },
  { label: 'seconds', value: 's' },
  { label: 'minutes', value: 'min' },
];

const TEMPERATURE_UNITS: ReadonlyArray<{ label: string; value: Exclude<TemperatureUnit, ''> }> = [
  { label: '°C', value: 'degC' },
  { label: '°F', value: 'degF' },
];

const RESULT_OPTIONS: ReadonlyArray<{ label: string; value: Exclude<RtPtInspectionResult, ''> }> = [
  { label: 'Accepted', value: 'accepted' },
  { label: 'Rejected', value: 'rejected' },
  { label: 'Retake required', value: 'retake-required' },
];

const DISPOSITION_OPTIONS: ReadonlyArray<{ label: string; value: Exclude<RtPtDisposition, ''> }> = [
  { label: 'Accepted', value: 'accepted' },
  { label: 'Rejected', value: 'rejected' },
  { label: 'Repair required', value: 'repair-required' },
  { label: 'Reinspection required', value: 'reinspection-required' },
];

const APPROVAL_ROLE_OPTIONS: ReadonlyArray<{ label: string; value: RtPtReportApprovalRole }> = [
  { label: 'Performed by', value: 'performed' },
  { label: 'Reviewed by', value: 'reviewed' },
  { label: 'Quality', value: 'quality' },
  { label: 'NDT Level III', value: 'ndt-level-3' },
];

const CERTIFICATION_LEVEL_OPTIONS: ReadonlyArray<{ label: string; value: CertificationLevel }> = [
  { label: 'Level I', value: 'Level I' },
  { label: 'Level II', value: 'Level II' },
  { label: 'Level III', value: 'Level III' },
];

const SECTION_FOR_ISSUE: Record<RtPtInspectionReportIssue['section'], WorkspaceSection> = {
  control: 'details',
  traceability: 'details',
  equipment: 'details',
  results: 'results',
  indications: 'indications',
  disposition: 'review',
  approvals: 'review',
  link: 'review',
};

const displayValue = (value: string | number | boolean | null | undefined): string => {
  if (value === '' || value === null || value === undefined) return 'Not specified';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return String(value);
};

const displayMeasure = (value: NumberOrEmpty, unit: string): string => (
  value === '' ? 'Not specified' : `${value} ${unit}`
);

const resultLabel = (result: RtPtInspectionResult): string => (
  RESULT_OPTIONS.find((option) => option.value === result)?.label ?? 'Result required'
);

const resultBadgeVariant = (result: RtPtInspectionResult): 'default' | 'destructive' | 'outline' | 'secondary' => {
  if (result === 'accepted') return 'default';
  if (result === 'rejected') return 'destructive';
  if (result === 'retake-required') return 'secondary';
  return 'outline';
};

interface ReadOnlyDatumProps {
  label: string;
  value: string | number | boolean | null | undefined;
}

const ReadOnlyDatum = ({ label, value }: ReadOnlyDatumProps) => (
  <div className="min-w-0 rounded-lg border border-border/70 bg-muted/25 px-3 py-2.5">
    <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{label}</div>
    <div className="mt-1 break-words text-sm font-medium text-foreground">{displayValue(value)}</div>
  </div>
);

interface PlannedPanelProps {
  children: ReactNode;
  description?: string;
}

const PlannedPanel = ({ children, description }: PlannedPanelProps) => (
  <section className="rounded-xl border border-primary/20 bg-primary/5 p-3.5" aria-label="Locked planned technique values">
    <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
      <div>
        <div className="flex items-center gap-2 text-sm font-semibold">
          <ShieldCheck className="h-4 w-4 text-primary" aria-hidden="true" />
          Planned / required
        </div>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          {description ?? 'Locked from the approved source technique. These values cannot be edited in the inspection record.'}
        </p>
      </div>
      <Badge variant="outline">Read only</Badge>
    </div>
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">{children}</div>
  </section>
);

interface PerformedPanelProps {
  children: ReactNode;
  description?: string;
}

const PerformedPanel = ({ children, description }: PerformedPanelProps) => (
  <section className="rounded-xl border border-border/80 bg-background/55 p-3.5" aria-label="Performed inspection values">
    <div className="mb-4">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <ClipboardCheck className="h-4 w-4 text-success" aria-hidden="true" />
        Performed / achieved
      </div>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">
        {description ?? 'Record measured and observed values from this inspection. No value is inferred from the plan.'}
      </p>
    </div>
    {children}
  </section>
);

interface NumberWithUnitProps<T extends string> {
  label: string;
  value: NumberOrEmpty;
  unit: T;
  options: ReadonlyArray<{ label: string; value: T }>;
  onValueChange: (value: NumberOrEmpty) => void;
  onUnitChange: (unit: T) => void;
  min?: number;
  step?: number | string;
}

function NumberWithUnit<T extends string>({
  label,
  value,
  unit,
  options,
  onValueChange,
  onUnitChange,
  min = 0,
  step,
}: NumberWithUnitProps<T>) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_7rem] gap-2">
      <NumberField label={label} value={value} onChange={onValueChange} min={min} step={step} />
      <SelectField label="Unit" value={unit} onChange={onUnitChange} options={options} />
    </div>
  );
}

interface BooleanChoiceFieldProps {
  label: string;
  value: RtPtBooleanOrEmpty;
  onChange: (value: RtPtBooleanOrEmpty) => void;
  hint?: string;
}

const BooleanChoiceField = ({ label, value, onChange, hint }: BooleanChoiceFieldProps) => (
  <FieldShell label={label} hint={hint}>
    <Select
      value={value === '' ? undefined : value ? 'yes' : 'no'}
      onValueChange={(next) => onChange(next === 'yes')}
    >
      <SelectTrigger>
        <SelectValue placeholder="Select…" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="yes">Yes</SelectItem>
        <SelectItem value="no">No</SelectItem>
      </SelectContent>
    </Select>
  </FieldShell>
);

interface ReportDetailsProps {
  controller: RtPtInspectionReportController;
  disabled: boolean;
}

function ReportDetails({ controller, disabled }: ReportDetailsProps) {
  const { report, updateReport } = controller;

  const updateControl = <K extends keyof RtPtInspectionReportControl>(
    key: K,
    value: RtPtInspectionReportControl[K],
  ) => updateReport((current) => ({
    ...current,
    reportControl: { ...current.reportControl, [key]: value },
  }));

  return (
    <fieldset disabled={disabled} className="space-y-4 disabled:opacity-70">
      <Card>
        <CardHeader>
          <CardTitle>Report Control</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          <TextField label="Report Number" value={report.reportControl.number} onChange={(value) => updateControl('number', value)} />
          <TextField label="Report Title" value={report.reportControl.title} onChange={(value) => updateControl('title', value)} />
          <TextField label="Revision" value={report.reportControl.revision} onChange={(value) => updateControl('revision', value)} />
          <DateField label="Report Date" value={report.reportControl.reportDate} onChange={(value) => updateControl('reportDate', value)} />
          <DateField label="Inspection Start" value={report.reportControl.inspectionStart} onChange={(value) => updateControl('inspectionStart', value)} />
          <DateField label="Inspection End" value={report.reportControl.inspectionEnd} onChange={(value) => updateControl('inspectionEnd', value)} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Part &amp; Job Traceability</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <TextField label="Part Name" value={report.part.partName} onChange={(partName) => updateReport((current) => ({ ...current, part: { ...current.part, partName } }))} />
            <TextField label="Part Number" value={report.part.partNumber} onChange={(partNumber) => updateReport((current) => ({ ...current, part: { ...current.part, partNumber } }))} />
            <TextField label="Part Revision / Configuration" value={report.part.partRevisionOrConfiguration} onChange={(partRevisionOrConfiguration) => updateReport((current) => ({ ...current, part: { ...current.part, partRevisionOrConfiguration } }))} />
            <TextField label="Serial / Lot Number" value={report.part.serialOrLotNumber} onChange={(serialOrLotNumber) => updateReport((current) => ({ ...current, part: { ...current.part, serialOrLotNumber } }))} />
            <NumberField label="Quantity Inspected" value={report.part.quantity} onChange={(quantity) => updateReport((current) => ({ ...current, part: { ...current.part, quantity } }))} min={1} step={1} />
            <TextField label="Material" value={report.part.material} onChange={(material) => updateReport((current) => ({ ...current, part: { ...current.part, material } }))} />
            <TextField label="Inspection Area" value={report.part.inspectionArea} onChange={(inspectionArea) => updateReport((current) => ({ ...current, part: { ...current.part, inspectionArea } }))} />
            <TextField label="Work Order" value={report.part.workOrder} onChange={(workOrder) => updateReport((current) => ({ ...current, part: { ...current.part, workOrder } }))} />
          </div>
          <div className="border-t border-border/70 pt-5">
            <div className="mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Organization and customer record</div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
              <TextField label="Organization" value={report.organization.name} onChange={(name) => updateReport((current) => ({ ...current, organization: { ...current.organization, name } }))} />
              <TextField label="Site" value={report.organization.site} onChange={(site) => updateReport((current) => ({ ...current, organization: { ...current.organization, site } }))} />
              <TextField label="Customer" value={report.job.customer} onChange={(customer) => updateReport((current) => ({ ...current, job: { ...current.job, customer } }))} />
              <TextField label="Contract" value={report.job.contract} onChange={(contract) => updateReport((current) => ({ ...current, job: { ...current.job, contract } }))} />
              <TextField label="Purchase Order" value={report.job.purchaseOrder} onChange={(purchaseOrder) => updateReport((current) => ({ ...current, job: { ...current.job, purchaseOrder } }))} />
              <TextField label="Job Work Order" value={report.job.workOrder} onChange={(workOrder) => updateReport((current) => ({ ...current, job: { ...current.job, workOrder } }))} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Wrench className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            <CardTitle>Equipment &amp; Conditions</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <TextAreaField label="Equipment Used" value={report.equipment.equipmentUsed} onChange={(equipmentUsed) => updateReport((current) => ({ ...current, equipment: { ...current.equipment, equipmentUsed } }))} rows={3} />
          <TextAreaField label="Calibration References" value={report.equipment.calibrationReferences} onChange={(calibrationReferences) => updateReport((current) => ({ ...current, equipment: { ...current.equipment, calibrationReferences } }))} rows={3} />
          <TextAreaField label="Environmental Conditions" value={report.equipment.environmentalConditions} onChange={(environmentalConditions) => updateReport((current) => ({ ...current, equipment: { ...current.equipment, environmentalConditions } }))} rows={3} />
          <TextAreaField label="Deviations from Approved Technique" value={report.equipment.deviations} onChange={(deviations) => updateReport((current) => ({ ...current, equipment: { ...current.equipment, deviations } }))} rows={3} placeholder="Enter none, or describe the variance, authority, and controlled reference" />
        </CardContent>
      </Card>
    </fieldset>
  );
}

interface ResultSectionProps {
  controller: RtPtInspectionReportController;
  disabled: boolean;
}

function FilmResults({ controller, disabled }: ResultSectionProps) {
  const report = controller.report.method === 'RT-Film' ? controller.report : null;
  if (!report) return null;

  const updateResult = (id: string, patch: Partial<Omit<RtFilmPerformedResult, 'id' | 'planned' | 'plannedItemId'>>) => {
    controller.updateReport((current) => {
      if (current.method !== 'RT-Film') return current;
      return {
        ...current,
        results: current.results.map((result) => result.id === id ? { ...result, ...patch } : result),
      };
    });
  };

  if (report.results.length === 0) {
    return (
      <Card className="border-warning/30 bg-warning/5">
        <CardContent className="flex min-h-48 flex-col items-center justify-center px-6 py-10 text-center">
          <AlertTriangle className="h-8 w-8 text-warning" aria-hidden="true" />
          <div className="mt-3 text-sm font-semibold">No linked exposure views</div>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">Restart this report from a current approved technique that contains at least one planned exposure view.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <fieldset disabled={disabled} className="disabled:opacity-70">
      <Accordion type="single" collapsible defaultValue={report.results[0]?.id} className="space-y-3">
        {report.results.map((result, index) => {
          const issueCount = controller.validation.issues.filter((issue) => issue.path.startsWith(`results[${index}]`)).length;
          return (
            <AccordionItem key={result.id} value={result.id} className="rounded-2xl border border-border/80 bg-card px-4 shadow-sm">
              <AccordionTrigger className="gap-3 text-left hover:no-underline">
                <span className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                  <span className="font-semibold">View {index + 1}</span>
                  <span className="max-w-56 truncate text-muted-foreground">{result.planned.viewId || 'Unidentified planned view'}</span>
                  <Badge variant={resultBadgeVariant(result.result)}>{resultLabel(result.result)}</Badge>
                  {issueCount > 0 && <Badge variant="outline">{issueCount} item{issueCount === 1 ? '' : 's'} to complete</Badge>}
                </span>
              </AccordionTrigger>
              <AccordionContent className="pt-2">
                <div className="grid gap-4 xl:grid-cols-[minmax(18rem,0.8fr)_minmax(30rem,1.35fr)]">
                  <PlannedPanel>
                    <ReadOnlyDatum label="View ID" value={result.planned.viewId} />
                    <ReadOnlyDatum label="Description" value={result.planned.description} />
                    <ReadOnlyDatum label="Orientation" value={result.planned.orientation} />
                    <ReadOnlyDatum label="Inspection zone" value={result.planned.inspectionZone} />
                    <ReadOnlyDatum label="Wall technique" value={result.planned.wallTechnique} />
                    <ReadOnlyDatum label="Source" value={result.planned.sourceType} />
                    <ReadOnlyDatum label="Planned SFD" value={displayMeasure(result.planned.sfd, result.planned.sfdUnit)} />
                    <ReadOnlyDatum label="Planned SOD / OFD" value={`${displayMeasure(result.planned.sod, result.planned.sodUnit)} / ${displayMeasure(result.planned.ofd, result.planned.ofdUnit)}`} />
                    {result.planned.sourceType === 'X-ray' && (
                      <>
                        <ReadOnlyDatum label="Planned tube voltage" value={displayMeasure(result.planned.tubeVoltage, result.planned.tubeVoltageUnit)} />
                        <ReadOnlyDatum label="Planned tube current" value={displayMeasure(result.planned.tubeCurrent, result.planned.tubeCurrentUnit)} />
                      </>
                    )}
                    <ReadOnlyDatum label="Planned exposure" value={displayMeasure(result.planned.exposureTime, result.planned.exposureTimeUnit)} />
                    <ReadOnlyDatum label="Film / IQI" value={`${displayValue(result.planned.filmDesignation)} / ${displayValue(result.planned.iqiRequirement)}`} />
                    <ReadOnlyDatum label="Required density" value={`${displayValue(result.planned.densityMinimum)} – ${displayValue(result.planned.densityMaximum)}`} />
                    <ReadOnlyDatum label="Attachment reference" value={result.planned.referenceAttachmentId} />
                  </PlannedPanel>
                  <PerformedPanel>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <TextField label="Actual Film ID" value={result.filmId} onChange={(filmId) => updateResult(result.id, { filmId })} />
                       <TextField label="Retake of Film ID" value={result.retakeOfFilmId} onChange={(retakeOfFilmId) => updateResult(result.id, { retakeOfFilmId })} hint="leave blank when not a retake" />
                       <DateField label="Exposure Date" value={result.exposureDate} onChange={(exposureDate) => updateResult(result.id, { exposureDate })} />
                       <NumberWithUnit label="Actual SFD" value={result.actualSfd} unit={result.actualSfdUnit} options={LENGTH_UNITS} onValueChange={(actualSfd) => updateResult(result.id, { actualSfd })} onUnitChange={(actualSfdUnit) => updateResult(result.id, { actualSfdUnit })} />
                       <NumberWithUnit label="Actual SOD" value={result.actualSod} unit={result.actualSodUnit} options={LENGTH_UNITS} onValueChange={(actualSod) => updateResult(result.id, { actualSod })} onUnitChange={(actualSodUnit) => updateResult(result.id, { actualSodUnit })} />
                       <NumberWithUnit label="Actual OFD" value={result.actualOfd} unit={result.actualOfdUnit} options={LENGTH_UNITS} onValueChange={(actualOfd) => updateResult(result.id, { actualOfd })} onUnitChange={(actualOfdUnit) => updateResult(result.id, { actualOfdUnit })} />
                      {result.planned.sourceType === 'X-ray' ? (
                        <>
                          <NumberField label="Actual Tube Voltage" value={result.actualTubeVoltage} onChange={(actualTubeVoltage) => updateResult(result.id, { actualTubeVoltage })} unit={result.actualTubeVoltageUnit} min={0} />
                          <NumberField label="Actual Tube Current" value={result.actualTubeCurrent} onChange={(actualTubeCurrent) => updateResult(result.id, { actualTubeCurrent })} unit={result.actualTubeCurrentUnit} min={0} />
                        </>
                      ) : (
                        <>
                          <NumberField label="Actual Source Activity" value={result.actualSourceActivity} onChange={(actualSourceActivity) => updateResult(result.id, { actualSourceActivity })} min={0} />
                          <TextField label="Activity Unit" value={result.actualSourceActivityUnit} onChange={(actualSourceActivityUnit) => updateResult(result.id, { actualSourceActivityUnit })} />
                        </>
                      )}
                      <NumberWithUnit label="Actual Exposure Time" value={result.actualExposureTime} unit={result.actualExposureTimeUnit} options={TIME_UNITS} onValueChange={(actualExposureTime) => updateResult(result.id, { actualExposureTime })} onUnitChange={(actualExposureTimeUnit) => updateResult(result.id, { actualExposureTimeUnit })} />
                      <NumberField label="Achieved Density Minimum" value={result.densityMinimum} onChange={(densityMinimum) => updateResult(result.id, { densityMinimum })} unit="H&D" min={0} step="0.1" />
                      <NumberField label="Achieved Density Maximum" value={result.densityMaximum} onChange={(densityMaximum) => updateResult(result.id, { densityMaximum })} unit="H&D" min={0} step="0.1" />
                      <TextField label="IQI Observed" value={result.iqiObserved} onChange={(iqiObserved) => updateResult(result.id, { iqiObserved })} placeholder="Observed wire, hole, or sensitivity" />
                      <BooleanChoiceField label="IQI Requirement Met" value={result.iqiRequirementMet} onChange={(iqiRequirementMet) => updateResult(result.id, { iqiRequirementMet })} hint="Explicit performed confirmation; not inferred from the observation text" />
                      <BooleanChoiceField label="Planned Coverage Confirmed" value={result.coverageConfirmed} onChange={(coverageConfirmed) => updateResult(result.id, { coverageConfirmed })} />
                      <SelectField label="Result" value={result.result} onChange={(value) => updateResult(result.id, { result: value })} options={RESULT_OPTIONS} />
                      <TextAreaField label="Result Remarks" value={result.remarks} onChange={(remarks) => updateResult(result.id, { remarks })} rows={3} />
                    </div>
                  </PerformedPanel>
                </div>
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
    </fieldset>
  );
}

function DigitalResults({ controller, disabled }: ResultSectionProps) {
  const report = controller.report.method === 'RT-Digital' ? controller.report : null;
  if (!report) return null;

  const updateResult = (id: string, patch: Partial<Omit<RtDigitalPerformedResult, 'id' | 'planned' | 'plannedItemId'>>) => {
    controller.updateReport((current) => {
      if (current.method !== 'RT-Digital') return current;
      return {
        ...current,
        results: current.results.map((result) => result.id === id ? { ...result, ...patch } : result),
      };
    });
  };

  if (report.results.length === 0) {
    return (
      <Card className="border-warning/30 bg-warning/5">
        <CardContent className="flex min-h-48 flex-col items-center justify-center px-6 py-10 text-center">
          <AlertTriangle className="h-8 w-8 text-warning" aria-hidden="true" />
          <div className="mt-3 text-sm font-semibold">No linked DDA acquisitions</div>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">Restart this report from a current approved technique that contains at least one planned acquisition.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <fieldset disabled={disabled} className="disabled:opacity-70">
      <Accordion type="single" collapsible defaultValue={report.results[0]?.id} className="space-y-3">
        {report.results.map((result, index) => {
          const issueCount = controller.validation.issues.filter((issue) => issue.path.startsWith(`results[${index}]`)).length;
          return (
            <AccordionItem key={result.id} value={result.id} className="rounded-2xl border border-border/80 bg-card px-4 shadow-sm">
              <AccordionTrigger className="gap-3 text-left hover:no-underline">
                <span className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                  <span className="font-semibold">Acquisition {index + 1}</span>
                  <span className="max-w-56 truncate text-muted-foreground">{result.planned.viewId || 'Unidentified planned acquisition'}</span>
                  <Badge variant={resultBadgeVariant(result.result)}>{resultLabel(result.result)}</Badge>
                  {issueCount > 0 && <Badge variant="outline">{issueCount} item{issueCount === 1 ? '' : 's'} to complete</Badge>}
                </span>
              </AccordionTrigger>
              <AccordionContent className="pt-2">
                <div className="grid gap-4 xl:grid-cols-[minmax(18rem,0.8fr)_minmax(30rem,1.35fr)]">
                  <PlannedPanel>
                    <ReadOnlyDatum label="View ID" value={result.planned.viewId} />
                    <ReadOnlyDatum label="Description" value={result.planned.description} />
                    <ReadOnlyDatum label="Orientation" value={result.planned.orientation} />
                    <ReadOnlyDatum label="Inspection zone" value={result.planned.inspectionZone} />
                    <ReadOnlyDatum label="Wall technique" value={result.planned.wallTechnique} />
                    <ReadOnlyDatum label="Planned SDD" value={displayMeasure(result.planned.sdd, result.planned.sddUnit)} />
                    <ReadOnlyDatum label="Planned SOD / ODD" value={`${displayMeasure(result.planned.sod, result.planned.sodUnit)} / ${displayMeasure(result.planned.odd, result.planned.oddUnit)}`} />
                    <ReadOnlyDatum label="Planned tube voltage" value={displayMeasure(result.planned.tubeVoltage, result.planned.tubeVoltageUnit)} />
                    <ReadOnlyDatum label="Planned tube current" value={displayMeasure(result.planned.tubeCurrent, result.planned.tubeCurrentUnit)} />
                    <ReadOnlyDatum label="Planned exposure" value={displayMeasure(result.planned.exposureTime, result.planned.exposureTimeUnit)} />
                    <ReadOnlyDatum label="Planned integration" value={displayMeasure(result.planned.integrationTime, result.planned.integrationTimeUnit)} />
                     <ReadOnlyDatum label="Frames averaged" value={result.planned.framesAveraged} />
                     <ReadOnlyDatum label="Image naming" value={result.planned.imageNaming} />
                     <ReadOnlyDatum label="IQI requirement" value={result.planned.iqiRequirement} />
                     <ReadOnlyDatum label="Required SNR / normalized SNR" value={result.planned.requiredSnrOrNormalizedSnr} />
                     <ReadOnlyDatum label="Required contrast sensitivity / CNR" value={result.planned.requiredContrastSensitivityOrCnr} />
                     <ReadOnlyDatum label="Attachment reference" value={result.planned.referenceAttachmentId} />
                  </PlannedPanel>
                  <PerformedPanel>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <TextField label="Actual Image ID" value={result.imageId} onChange={(imageId) => updateResult(result.id, { imageId })} />
                       <TextField label="Retake of Image ID" value={result.retakeOfImageId} onChange={(retakeOfImageId) => updateResult(result.id, { retakeOfImageId })} hint="leave blank when not a retake" />
                       <DateField label="Acquisition Date" value={result.acquisitionDate} onChange={(acquisitionDate) => updateResult(result.id, { acquisitionDate })} />
                       <NumberWithUnit label="Actual SDD" value={result.actualSdd} unit={result.actualSddUnit} options={LENGTH_UNITS} onValueChange={(actualSdd) => updateResult(result.id, { actualSdd })} onUnitChange={(actualSddUnit) => updateResult(result.id, { actualSddUnit })} />
                       <NumberWithUnit label="Actual SOD" value={result.actualSod} unit={result.actualSodUnit} options={LENGTH_UNITS} onValueChange={(actualSod) => updateResult(result.id, { actualSod })} onUnitChange={(actualSodUnit) => updateResult(result.id, { actualSodUnit })} />
                       <NumberWithUnit label="Actual ODD" value={result.actualOdd} unit={result.actualOddUnit} options={LENGTH_UNITS} onValueChange={(actualOdd) => updateResult(result.id, { actualOdd })} onUnitChange={(actualOddUnit) => updateResult(result.id, { actualOddUnit })} />
                      <NumberField label="Actual Tube Voltage" value={result.actualTubeVoltage} onChange={(actualTubeVoltage) => updateResult(result.id, { actualTubeVoltage })} unit={result.actualTubeVoltageUnit} min={0} />
                      <NumberField label="Actual Tube Current" value={result.actualTubeCurrent} onChange={(actualTubeCurrent) => updateResult(result.id, { actualTubeCurrent })} unit={result.actualTubeCurrentUnit} min={0} />
                      <NumberWithUnit label="Actual Exposure Time" value={result.actualExposureTime} unit={result.actualExposureTimeUnit} options={DIGITAL_TIME_UNITS} onValueChange={(actualExposureTime) => updateResult(result.id, { actualExposureTime })} onUnitChange={(actualExposureTimeUnit) => updateResult(result.id, { actualExposureTimeUnit })} />
                      <NumberWithUnit label="Actual Integration Time" value={result.actualIntegrationTime} unit={result.actualIntegrationTimeUnit} options={DIGITAL_TIME_UNITS} onValueChange={(actualIntegrationTime) => updateResult(result.id, { actualIntegrationTime })} onUnitChange={(actualIntegrationTimeUnit) => updateResult(result.id, { actualIntegrationTimeUnit })} />
                      <NumberField label="Actual Frames Averaged" value={result.actualFramesAveraged} onChange={(actualFramesAveraged) => updateResult(result.id, { actualFramesAveraged })} min={1} step={1} />
                      <TextField label="Achieved SNR / Normalized SNR" value={result.achievedSnr} onChange={(achievedSnr) => updateResult(result.id, { achievedSnr })} />
                      <TextField label="Achieved CNR / Contrast Sensitivity" value={result.achievedCnr} onChange={(achievedCnr) => updateResult(result.id, { achievedCnr })} />
                      <TextField label="IQI Observed" value={result.iqiObserved} onChange={(iqiObserved) => updateResult(result.id, { iqiObserved })} />
                      <BooleanChoiceField label="IQI Requirement Met" value={result.iqiRequirementMet} onChange={(iqiRequirementMet) => updateResult(result.id, { iqiRequirementMet })} hint="Explicit performed confirmation; not inferred from the observation text" />
                      {result.planned.requiredSnrOrNormalizedSnr.trim() !== '' ? (
                        <BooleanChoiceField label="SNR Requirement Met" value={result.snrRequirementMet} onChange={(snrRequirementMet) => updateResult(result.id, { snrRequirementMet })} />
                      ) : null}
                      {result.planned.requiredContrastSensitivityOrCnr.trim() !== '' ? (
                        <BooleanChoiceField label="CNR Requirement Met" value={result.cnrRequirementMet} onChange={(cnrRequirementMet) => updateResult(result.id, { cnrRequirementMet })} />
                      ) : null}
                      <TextField label="Detector Control Reference" value={result.detectorControlReference} onChange={(detectorControlReference) => updateResult(result.id, { detectorControlReference })} />
                      <TextField label="Archive Reference" value={result.archiveReference} onChange={(archiveReference) => updateResult(result.id, { archiveReference })} />
                      <BooleanChoiceField label="Planned Coverage Confirmed" value={result.coverageConfirmed} onChange={(coverageConfirmed) => updateResult(result.id, { coverageConfirmed })} />
                      <SelectField label="Result" value={result.result} onChange={(value) => updateResult(result.id, { result: value })} options={RESULT_OPTIONS} />
                      <TextAreaField label="Result Remarks" value={result.remarks} onChange={(remarks) => updateResult(result.id, { remarks })} rows={3} />
                    </div>
                  </PerformedPanel>
                </div>
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
    </fieldset>
  );
}

function PtResults({ controller, disabled }: ResultSectionProps) {
  const report = controller.report.method === 'PT' ? controller.report : null;
  if (!report) return null;
  const result = report.results;
  const removalMethod = result.planned.removalMethod;
  const usesEmulsifier = removalMethod === 'B' || removalMethod === 'D';

  const updateResult = <K extends keyof Omit<PtPerformedResults, 'planned'>>(
    key: K,
    value: PtPerformedResults[K],
  ) => controller.updateReport((current) => {
    if (current.method !== 'PT') return current;
    return { ...current, results: { ...current.results, [key]: value } };
  });

  return (
    <fieldset disabled={disabled} className="disabled:opacity-70">
      <div className="grid gap-4 xl:grid-cols-[minmax(18rem,0.75fr)_minmax(32rem,1.4fr)]">
        <PlannedPanel description="The approved PT process requirements are frozen as the basis for this performed inspection.">
          <div className="col-span-full border-b border-primary/15 pb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Process classification</div>
          <ReadOnlyDatum label="Penetrant type" value={result.planned.penetrantType} />
          <ReadOnlyDatum label="Removal method" value={result.planned.removalMethod} />
          <ReadOnlyDatum label="Sensitivity level" value={result.planned.sensitivityLevel} />

          <div className="col-span-full mt-2 border-b border-primary/15 pb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Surface preparation &amp; drying</div>
          <ReadOnlyDatum label="Cleaning method" value={result.planned.cleaningMethod} />
          <ReadOnlyDatum label="Required surface condition" value={result.planned.surfaceCondition} />
          <ReadOnlyDatum label="Cleaning details" value={result.planned.cleaningDetails} />
          <ReadOnlyDatum label="Cleaning restrictions" value={result.planned.cleaningRestrictions} />
          <ReadOnlyDatum label="Drying method" value={result.planned.dryingMethod} />
          <ReadOnlyDatum label="Required drying time" value={displayMeasure(result.planned.dryingTime, result.planned.dryingTimeUnit)} />
          <ReadOnlyDatum label="Required drying temperature" value={displayMeasure(result.planned.dryingTemperature, result.planned.dryingTemperatureUnit)} />

          <div className="col-span-full mt-2 border-b border-primary/15 pb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Penetrant application</div>
          <ReadOnlyDatum label="Application method" value={result.planned.penetrantApplicationMethod} />
          <ReadOnlyDatum label="Required dwell" value={displayMeasure(result.planned.dwellTime, result.planned.dwellTimeUnit)} />
          <ReadOnlyDatum label="Required part temperature" value={`${displayMeasure(result.planned.partTemperatureMin, result.planned.partTemperatureUnit)} – ${displayMeasure(result.planned.partTemperatureMax, result.planned.partTemperatureUnit)}`} />
          <ReadOnlyDatum label="Required penetrant temperature" value={`${displayMeasure(result.planned.penetrantTemperatureMin, result.planned.penetrantTemperatureUnit)} – ${displayMeasure(result.planned.penetrantTemperatureMax, result.planned.penetrantTemperatureUnit)}`} />

          <div className="col-span-full mt-2 border-b border-primary/15 pb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Removal process</div>
          {removalMethod === 'A' && (
            <>
              <ReadOnlyDatum label="Rinse instructions" value={result.planned.methodARinseInstructions} />
              <ReadOnlyDatum label="Rinse pressure" value={`${displayMeasure(result.planned.methodARinsePressureMin, result.planned.methodARinsePressureUnit)} – ${displayMeasure(result.planned.methodARinsePressureMax, result.planned.methodARinsePressureUnit)}`} />
              <ReadOnlyDatum label="Rinse temperature" value={`${displayMeasure(result.planned.methodARinseTemperatureMin, result.planned.methodARinseTemperatureUnit)} – ${displayMeasure(result.planned.methodARinseTemperatureMax, result.planned.methodARinseTemperatureUnit)}`} />
            </>
          )}
          {usesEmulsifier && (
            <>
              <ReadOnlyDatum label="Emulsifier type" value={result.planned.emulsifierType} />
              {removalMethod === 'D' && <ReadOnlyDatum label="Required concentration" value={displayMeasure(result.planned.emulsifierConcentration, result.planned.emulsifierConcentrationUnit)} />}
              <ReadOnlyDatum label="Required contact time" value={displayMeasure(result.planned.emulsifierContactTime, result.planned.emulsifierContactTimeUnit)} />
              <ReadOnlyDatum label="Emulsifier application" value={result.planned.emulsifierApplicationMethod} />
              <ReadOnlyDatum label="Post-emulsifier rinse" value={result.planned.postEmulsifierRinseInstructions} />
              {removalMethod === 'D' && (
                <>
                  <ReadOnlyDatum label="Pre-rinse" value={result.planned.methodDPreRinseInstructions} />
                  <ReadOnlyDatum label="Final rinse" value={result.planned.methodDFinalRinseInstructions} />
                </>
              )}
            </>
          )}
          {removalMethod === 'C' && <ReadOnlyDatum label="Solvent removal instructions" value={result.planned.methodCRemoverInstructions} />}

          <div className="col-span-full mt-2 border-b border-primary/15 pb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Development &amp; viewing</div>
          <ReadOnlyDatum label="Developer application" value={result.planned.developerApplicationMethod} />
          <ReadOnlyDatum label="Developer instructions" value={result.planned.developerInstructions} />
          <ReadOnlyDatum label="Required development" value={displayMeasure(result.planned.developmentTime, result.planned.developmentTimeUnit)} />
          {result.planned.penetrantType === 'Type I' ? (
            <>
              <ReadOnlyDatum label="Required dark adaptation" value={displayMeasure(result.planned.darkAdaptationTime, result.planned.darkAdaptationTimeUnit)} />
              <ReadOnlyDatum label="Required UV-A minimum" value={displayMeasure(result.planned.requiredUvAMin, result.planned.uvAUnit)} />
              <ReadOnlyDatum label="Ambient visible light maximum" value={displayMeasure(result.planned.ambientVisibleLightMax, result.planned.visibleLightUnit)} />
            </>
          ) : (
            <ReadOnlyDatum label="Required white light minimum" value={displayMeasure(result.planned.whiteLightMin, result.planned.visibleLightUnit)} />
          )}
        </PlannedPanel>
        <PerformedPanel description="Record every actual process step. Planned values remain visible for comparison but are never copied into the performed record.">
          <div className="space-y-5">
            <section>
              <div className="mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Material lots</div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                <TextField label="Penetrant Lot" value={result.penetrantLot} onChange={(value) => updateResult('penetrantLot', value)} />
                <DateField label="Penetrant Expiry" value={result.penetrantExpiry} onChange={(value) => updateResult('penetrantExpiry', value)} />
                <TextField label="Cleaner Lot" value={result.cleanerLot} onChange={(value) => updateResult('cleanerLot', value)} />
                {result.planned.removalMethod === 'C' && <TextField label="Remover Lot" value={result.removerLot} onChange={(value) => updateResult('removerLot', value)} />}
                {(result.planned.removalMethod === 'B' || result.planned.removalMethod === 'D') && <TextField label="Emulsifier Lot" value={result.emulsifierLot} onChange={(value) => updateResult('emulsifierLot', value)} />}
                <TextField label="Developer Lot" value={result.developerLot} onChange={(value) => updateResult('developerLot', value)} />
              </div>
            </section>
            <section className="border-t border-border/70 pt-5">
              <div className="mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Surface preparation &amp; drying</div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <TextField label="Actual Cleaning Method" value={result.actualCleaningMethod} onChange={(value) => updateResult('actualCleaningMethod', value)} />
                <TextField label="Achieved Surface Condition" value={result.actualSurfaceCondition} onChange={(value) => updateResult('actualSurfaceCondition', value)} />
                <div className="md:col-span-2">
                  <TextAreaField label="Actual Cleaning Details" value={result.actualCleaningDetails} onChange={(value) => updateResult('actualCleaningDetails', value)} rows={2} />
                </div>
                <TextField label="Actual Drying Method" value={result.actualDryingMethod} onChange={(value) => updateResult('actualDryingMethod', value)} />
                <NumberWithUnit label="Actual Drying Time" value={result.actualDryingTime} unit={result.actualDryingTimeUnit} options={TIME_UNITS} onValueChange={(value) => updateResult('actualDryingTime', value)} onUnitChange={(value) => updateResult('actualDryingTimeUnit', value)} />
                <NumberWithUnit label="Actual Drying Temperature" value={result.actualDryingTemperature} unit={result.actualDryingTemperatureUnit} options={TEMPERATURE_UNITS} onValueChange={(value) => updateResult('actualDryingTemperature', value)} onUnitChange={(value) => updateResult('actualDryingTemperatureUnit', value)} min={-459.67} />
              </div>
            </section>
            <section className="border-t border-border/70 pt-5">
              <div className="mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Penetrant application</div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <TextField label="Actual Application Method" value={result.actualPenetrantApplicationMethod} onChange={(value) => updateResult('actualPenetrantApplicationMethod', value)} />
                <NumberField label="Actual Part Temperature" value={result.partTemperature} onChange={(value) => updateResult('partTemperature', value)} unit={result.temperatureUnit} />
                <NumberField label="Actual Penetrant Temperature" value={result.penetrantTemperature} onChange={(value) => updateResult('penetrantTemperature', value)} unit={result.temperatureUnit} />
                <SelectField label="Temperature Unit" value={result.temperatureUnit} onChange={(value) => updateResult('temperatureUnit', value)} options={TEMPERATURE_UNITS} />
                <NumberWithUnit label="Actual Dwell Time" value={result.actualDwellTime} unit={result.actualDwellTimeUnit} options={TIME_UNITS} onValueChange={(value) => updateResult('actualDwellTime', value)} onUnitChange={(value) => updateResult('actualDwellTimeUnit', value)} />
              </div>
            </section>
            <section className="border-t border-border/70 pt-5">
              <div className="mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Removal process — method {removalMethod || 'not specified'}</div>
              {removalMethod === 'A' && (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="md:col-span-2">
                    <TextAreaField label="Actual Rinse Details" value={result.actualMethodARinseDetails} onChange={(value) => updateResult('actualMethodARinseDetails', value)} rows={2} />
                  </div>
                  <NumberField label="Actual Rinse Pressure" value={result.actualMethodARinsePressure} onChange={(value) => updateResult('actualMethodARinsePressure', value)} unit={result.actualMethodARinsePressureUnit} min={0} />
                  <TextField label="Pressure Unit" value={result.actualMethodARinsePressureUnit} onChange={(value) => updateResult('actualMethodARinsePressureUnit', value)} />
                  <NumberWithUnit label="Actual Rinse Temperature" value={result.actualMethodARinseTemperature} unit={result.actualMethodARinseTemperatureUnit} options={TEMPERATURE_UNITS} onValueChange={(value) => updateResult('actualMethodARinseTemperature', value)} onUnitChange={(value) => updateResult('actualMethodARinseTemperatureUnit', value)} min={-459.67} />
                </div>
              )}
              {usesEmulsifier && (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {removalMethod === 'D' && (
                    <>
                      <NumberField label="Actual Emulsifier Concentration" value={result.actualEmulsifierConcentration} onChange={(value) => updateResult('actualEmulsifierConcentration', value)} unit={result.actualEmulsifierConcentrationUnit} min={0} />
                      <TextField label="Concentration Unit" value={result.actualEmulsifierConcentrationUnit} onChange={(value) => updateResult('actualEmulsifierConcentrationUnit', value)} />
                      <div className="md:col-span-2">
                        <TextAreaField label="Actual Pre-rinse Details" value={result.actualMethodDPreRinseDetails} onChange={(value) => updateResult('actualMethodDPreRinseDetails', value)} rows={2} />
                      </div>
                    </>
                  )}
                  <NumberWithUnit label="Actual Emulsifier Contact Time" value={result.actualEmulsifierContactTime} unit={result.actualEmulsifierContactTimeUnit} options={TIME_UNITS} onValueChange={(value) => updateResult('actualEmulsifierContactTime', value)} onUnitChange={(value) => updateResult('actualEmulsifierContactTimeUnit', value)} />
                  <TextField label="Actual Emulsifier Application" value={result.actualEmulsifierApplicationMethod} onChange={(value) => updateResult('actualEmulsifierApplicationMethod', value)} />
                  <div className="md:col-span-2">
                    <TextAreaField label="Actual Post-emulsifier Rinse" value={result.actualPostEmulsifierRinseDetails} onChange={(value) => updateResult('actualPostEmulsifierRinseDetails', value)} rows={2} />
                  </div>
                  {removalMethod === 'D' && (
                    <div className="md:col-span-2">
                      <TextAreaField label="Actual Final Rinse Details" value={result.actualMethodDFinalRinseDetails} onChange={(value) => updateResult('actualMethodDFinalRinseDetails', value)} rows={2} />
                    </div>
                  )}
                </div>
              )}
              {removalMethod === 'C' && (
                <TextAreaField label="Actual Solvent-removal Details" value={result.actualMethodCRemovalDetails} onChange={(value) => updateResult('actualMethodCRemovalDetails', value)} rows={2} />
              )}
            </section>
            <section className="border-t border-border/70 pt-5">
              <div className="mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Development</div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <TextField label="Actual Developer Application" value={result.actualDeveloperApplicationMethod} onChange={(value) => updateResult('actualDeveloperApplicationMethod', value)} />
                <NumberWithUnit label="Actual Development Time" value={result.actualDevelopmentTime} unit={result.actualDevelopmentTimeUnit} options={TIME_UNITS} onValueChange={(value) => updateResult('actualDevelopmentTime', value)} onUnitChange={(value) => updateResult('actualDevelopmentTimeUnit', value)} />
              </div>
            </section>
            <section className="border-t border-border/70 pt-5">
              <div className="mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Viewing conditions &amp; completion</div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <TextField label="Light Meter ID" value={result.lightMeterId} onChange={(value) => updateResult('lightMeterId', value)} />
                <TextField label="Examination Time" value={result.examinationTime} onChange={(value) => updateResult('examinationTime', value)} placeholder="Recorded time or controlled timestamp" />
                {result.planned.penetrantType === 'Type I' ? (
                  <>
                    <NumberWithUnit label="Actual Dark-adaptation Time" value={result.actualDarkAdaptationTime} unit={result.actualDarkAdaptationTimeUnit} options={TIME_UNITS} onValueChange={(value) => updateResult('actualDarkAdaptationTime', value)} onUnitChange={(value) => updateResult('actualDarkAdaptationTimeUnit', value)} />
                    <NumberField label="Measured UV-A" value={result.measuredUvA} onChange={(value) => updateResult('measuredUvA', value)} unit={result.uvAUnit} min={0} />
                    <NumberField label="Measured Ambient Visible Light" value={result.measuredAmbientVisibleLight} onChange={(value) => updateResult('measuredAmbientVisibleLight', value)} unit={result.visibleLightUnit} min={0} />
                    <TextField label="UV-A Unit" value={result.uvAUnit} onChange={(value) => updateResult('uvAUnit', value)} />
                  </>
                ) : (
                  <NumberField label="Measured White Light" value={result.measuredWhiteLight} onChange={(value) => updateResult('measuredWhiteLight', value)} unit={result.visibleLightUnit} min={0} />
                )}
                <TextField label="Visible Light Unit" value={result.visibleLightUnit} onChange={(value) => updateResult('visibleLightUnit', value)} />
                <BooleanChoiceField label="Post-cleaning Completed" value={result.postCleaningCompleted} onChange={(value) => updateResult('postCleaningCompleted', value)} />
                <BooleanChoiceField label="Planned Coverage Confirmed" value={result.coverageConfirmed} onChange={(value) => updateResult('coverageConfirmed', value)} />
              </div>
            </section>
          </div>
        </PerformedPanel>
      </div>
    </fieldset>
  );
}

interface IndicationsSectionProps {
  controller: RtPtInspectionReportController;
  disabled: boolean;
}

function IndicationsSection({ controller, disabled }: IndicationsSectionProps) {
  const { report, updateReport } = controller;
  const linkedResults = report.method === 'PT'
    ? []
    : report.results.map((result, index) => ({
        id: result.id,
        label: `${report.method === 'RT-Film' ? 'View' : 'Acquisition'} ${index + 1} — ${result.planned.viewId || result.id}`,
      }));

  const addIndication = () => updateReport((current) => ({
    ...current,
    indications: [
      ...current.indications,
      {
        id: createRtPtIndicationId(),
        indicationId: '',
        linkedResultId: '',
        location: '',
        indicationType: '',
        size: '',
        sizeUnit: 'mm',
        evaluation: '',
        disposition: '',
        remarks: '',
      },
    ],
  }));

  const updateIndication = <K extends keyof Omit<RtPtIndicationRecord, 'id'>>(
    id: string,
    key: K,
    value: RtPtIndicationRecord[K],
  ) => updateReport((current) => ({
    ...current,
    indications: current.indications.map((indication) => (
      indication.id === id ? { ...indication, [key]: value } : indication
    )),
  }));

  const removeIndication = (id: string) => updateReport((current) => ({
    ...current,
    indications: current.indications.filter((indication) => indication.id !== id),
  }));

  return (
    <fieldset disabled={disabled} className="disabled:opacity-70">
      <Card>
        <CardHeader className="gap-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle>Observed Indications</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">Record each observed indication explicitly. Evaluation and disposition remain inspector-controlled entries.</p>
            </div>
            <Button type="button" size="sm" onClick={addIndication}>
              <Plus className="mr-1.5 h-4 w-4" />
              Add Indication
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {report.indications.length === 0 ? (
            <div className="flex min-h-48 flex-col items-center justify-center rounded-xl border border-dashed border-border px-6 py-10 text-center">
              <CheckCircle2 className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
              <div className="mt-3 text-sm font-semibold">No indications recorded</div>
              <p className="mt-1 max-w-lg text-sm text-muted-foreground">This empty state does not infer an acceptable result. Enter the overall disposition separately in Review &amp; Approval.</p>
              <Button type="button" variant="outline" className="mt-4" onClick={addIndication}>
                <Plus className="mr-1.5 h-4 w-4" />
                Add First Indication
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {report.indications.map((indication, index) => (
                <div key={indication.id} className="rounded-xl border border-border/80 bg-background/45 p-3.5">
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-border/70 pb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold">Indication {index + 1}</span>
                      {indication.indicationId && <Badge variant="outline">{indication.indicationId}</Badge>}
                    </div>
                    <Button type="button" size="icon" variant="ghost" className="text-destructive hover:text-destructive" aria-label={`Remove indication ${index + 1}`} onClick={() => removeIndication(indication.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                    <TextField label="Indication ID" value={indication.indicationId} onChange={(value) => updateIndication(indication.id, 'indicationId', value)} />
                    {linkedResults.length > 0 ? (
                      <FieldShell label="Linked Result" hint="optional traceability link">
                        <Select value={indication.linkedResultId || '__overall'} onValueChange={(value) => updateIndication(indication.id, 'linkedResultId', value === '__overall' ? '' : value)}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__overall">Overall inspection</SelectItem>
                            {linkedResults.map((item) => <SelectItem key={item.id} value={item.id}>{item.label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </FieldShell>
                    ) : (
                      <ReadOnlyDatum label="Linked result" value="Overall PT examination" />
                    )}
                    <TextField label="Location" value={indication.location} onChange={(value) => updateIndication(indication.id, 'location', value)} />
                    <TextField label="Indication Type" value={indication.indicationType} onChange={(value) => updateIndication(indication.id, 'indicationType', value)} />
                    <NumberWithUnit label="Indication Size" value={indication.size} unit={indication.sizeUnit} options={LENGTH_UNITS} onValueChange={(value) => updateIndication(indication.id, 'size', value)} onUnitChange={(value) => updateIndication(indication.id, 'sizeUnit', value)} min={0} />
                    <TextField label="Evaluation" value={indication.evaluation} onChange={(value) => updateIndication(indication.id, 'evaluation', value)} placeholder="Evaluation against the controlled acceptance reference" />
                    <SelectField label="Disposition" value={indication.disposition} onChange={(value) => updateIndication(indication.id, 'disposition', value)} options={DISPOSITION_OPTIONS} />
                    <TextAreaField label="Remarks" value={indication.remarks} onChange={(value) => updateIndication(indication.id, 'remarks', value)} rows={3} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </fieldset>
  );
}

interface ReviewSectionProps {
  controller: RtPtInspectionReportController;
  disabled: boolean;
  onSelectIssue: (issue: RtPtInspectionReportIssue) => void;
}

function ReviewSection({ controller, disabled, onSelectIssue }: ReviewSectionProps) {
  const { report, validation, updateReport } = controller;

  const addApproval = () => {
    const role = APPROVAL_ROLE_OPTIONS.find((option) => !report.approvals.some((approval) => approval.role === option.value))?.value ?? 'reviewed';
    const approval: RtPtReportApproval = {
      role,
      name: '',
      personnelId: '',
      certificationLevel: '',
      certificationNumber: '',
      certificationBasis: '',
      date: '',
    };
    updateReport((current) => ({ ...current, approvals: [...current.approvals, approval] }));
  };

  const updateApproval = <K extends keyof RtPtReportApproval>(
    index: number,
    key: K,
    value: RtPtReportApproval[K],
  ) => updateReport((current) => ({
    ...current,
    approvals: current.approvals.map((approval, approvalIndex) => (
      approvalIndex === index ? { ...approval, [key]: value } : approval
    )),
  }));

  const removeApproval = (index: number) => updateReport((current) => ({
    ...current,
    approvals: current.approvals.filter((_, approvalIndex) => approvalIndex !== index),
  }));

  return (
    <div className="space-y-4">
      <fieldset disabled={disabled} className="space-y-4 disabled:opacity-70">
        <Card>
          <CardHeader>
            <CardTitle>Coverage &amp; Disposition</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <SelectField label="Overall Disposition" value={report.overallDisposition} onChange={(overallDisposition) => updateReport((current) => ({ ...current, overallDisposition }))} options={DISPOSITION_OPTIONS} hint="entered explicitly; never inferred" />
            <TextField label="Disposition / Acceptance Reference" value={report.dispositionReference} onChange={(dispositionReference) => updateReport((current) => ({ ...current, dispositionReference }))} placeholder="Controlled source and clause" />
            <TextAreaField label="Performed Coverage Statement" value={report.coverageStatement} onChange={(coverageStatement) => updateReport((current) => ({ ...current, coverageStatement }))} rows={3} />
            <TextAreaField label="Report Remarks" value={report.remarks} onChange={(remarks) => updateReport((current) => ({ ...current, remarks }))} rows={3} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="gap-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <CardTitle>Personnel &amp; Approval Records</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">Typed personnel records support traceability only. This workspace does not create or claim a digital signature.</p>
              </div>
              <Button type="button" size="sm" variant="outline" onClick={addApproval}>
                <Plus className="mr-1.5 h-4 w-4" />
                Add Personnel Record
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {report.approvals.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border px-4 py-5 text-sm text-muted-foreground">No personnel records entered. Approval readiness requires a complete performed-by record and an independent review record.</div>
            ) : report.approvals.map((approval, index) => (
              <div key={`${approval.role}-${index}`} className="rounded-xl border border-border/80 bg-background/45 p-3.5">
                <div className="mb-4 flex items-center justify-between gap-2 border-b border-border/70 pb-3">
                  <div className="flex items-center gap-2">
                    <UserCheck className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                    <span className="text-sm font-semibold">Personnel Record {index + 1}</span>
                  </div>
                  <Button type="button" size="icon" variant="ghost" className="text-destructive hover:text-destructive" aria-label={`Remove personnel record ${index + 1}`} onClick={() => removeApproval(index)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <SelectField label="Role" value={approval.role} onChange={(value) => updateApproval(index, 'role', value)} options={APPROVAL_ROLE_OPTIONS} />
                  <TextField label="Name" value={approval.name} onChange={(value) => updateApproval(index, 'name', value)} />
                  <TextField label="Personnel ID" value={approval.personnelId} onChange={(value) => updateApproval(index, 'personnelId', value)} />
                  <SelectField label="Certification Level" value={approval.certificationLevel} onChange={(value) => updateApproval(index, 'certificationLevel', value)} options={CERTIFICATION_LEVEL_OPTIONS} />
                  <TextField label="Certification Number" value={approval.certificationNumber} onChange={(value) => updateApproval(index, 'certificationNumber', value)} />
                  <TextField label="Certification Basis" value={approval.certificationBasis} onChange={(value) => updateApproval(index, 'certificationBasis', value)} />
                  <DateField label="Record Date" value={approval.date} onChange={(value) => updateApproval(index, 'date', value)} />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </fieldset>

      <Card className={validation.isApprovalReady ? 'border-success/30 bg-success/5' : 'border-warning/30 bg-warning/5'}>
        <CardHeader>
          <div className="flex items-center gap-2">
            {validation.isApprovalReady
              ? <CheckCircle2 className="h-5 w-5 text-success" aria-hidden="true" />
              : <AlertTriangle className="h-5 w-5 text-warning" aria-hidden="true" />}
            <CardTitle>{validation.isApprovalReady ? 'Ready to set Approved status' : 'Approval checks incomplete'}</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {validation.issues.length === 0 ? (
            <p className="text-sm text-muted-foreground">Performed fields, source-technique linkage, and personnel review requirements are complete.</p>
          ) : (
            <div className="space-y-2">
              {validation.issues.map((issue, index) => (
                <button
                  key={`${issue.path}-${index}`}
                  type="button"
                  onClick={() => onSelectIssue(issue)}
                  className="flex w-full items-start gap-3 rounded-lg border border-border/75 bg-background/60 px-3 py-2.5 text-left transition-colors hover:border-warning/40 hover:bg-warning/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <AlertTriangle className="mt-0.5 h-4 w-4 flex-none text-warning" aria-hidden="true" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold">{issue.label}</span>
                    <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">{issue.message}</span>
                  </span>
                  <Badge variant="outline" className="hidden flex-none sm:inline-flex">{issue.section}</Badge>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export function RtPtInspectionWorkspace({ controller, technique }: RtPtInspectionWorkspaceProps) {
  const { report, validation } = controller;
  const [activeSection, setActiveSection] = useState<WorkspaceSection>('details');
  const MethodIcon = METHOD_ICONS[report.method];
  const isSuperseded = report.status === 'superseded';
  const isApproved = report.status === 'approved';
  const sourceIssueCount = validation.issues.filter((issue) => issue.section === 'link').length;
  const dataIssueCount = validation.issues.length - sourceIssueCount;

  const selectIssue = (issue: RtPtInspectionReportIssue) => {
    setActiveSection(SECTION_FOR_ISSUE[issue.section]);
  };

  const renderStatusActions = () => {
    if (isSuperseded) {
      return <Badge variant="secondary">Read-only historical record</Badge>;
    }
    if (report.status === 'draft') {
      return (
        <Button type="button" variant="outline" onClick={() => controller.setStatus('in-review')}>
          Send to Review
        </Button>
      );
    }
    if (report.status === 'in-review') {
      return (
        <>
          <Button type="button" variant="outline" onClick={() => controller.setStatus('draft')}>Return to Draft</Button>
          <Button type="button" disabled={!validation.isApprovalReady} title={validation.isApprovalReady ? 'Set report status to Approved' : 'Complete all report, linkage, and personnel checks first'} onClick={() => controller.setStatus('approved')}>
            Set Approved Status
          </Button>
        </>
      );
    }
    return (
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button type="button" variant="outline">Mark Superseded</Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mark this inspection report superseded?</AlertDialogTitle>
            <AlertDialogDescription>This makes the record read-only. It remains available as historical inspection evidence and cannot be restored through this workspace.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => controller.setStatus('superseded')}>Mark Superseded</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );
  };

  return (
    <Tabs value={activeSection} onValueChange={(value) => setActiveSection(value as WorkspaceSection)} className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex-shrink-0 px-1 pb-1.5 pt-1 md:px-3 md:pb-2 md:pt-1.5">
        <div className="workbench-header overflow-hidden">
          <div className="flex flex-col gap-4 border-b border-border/70 px-3 py-3 md:px-4 xl:flex-row xl:items-center">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <div className="workbench-brand-mark h-10 w-10 flex-none">
                <MethodIcon className="h-5 w-5" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <div className="text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">Performed inspection workspace</div>
                <div className="mt-0.5 flex flex-wrap items-center gap-2">
                  <h2 className="truncate text-base font-semibold tracking-tight md:text-lg">{RT_PT_METHOD_LABEL[report.method]} Report</h2>
                  <Badge variant={isApproved ? 'default' : isSuperseded ? 'secondary' : 'outline'}>{STATUS_LABELS[report.status]}</Badge>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:justify-end">
              <Select value={controller.activeReportId} onValueChange={(reportId) => controller.switchReport(reportId)}>
                <SelectTrigger className="h-9 min-w-64 bg-background/70" aria-label="Inspection report history">
                  <SelectValue placeholder="Select inspection report" />
                </SelectTrigger>
                <SelectContent>
                  {controller.reportHistory.map((entry) => (
                    <SelectItem key={entry.reportId} value={entry.reportId}>
                      {entry.reportNumber || 'Draft without number'} · {STATUS_LABELS[entry.status]} · {entry.reportDate || 'No date'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {renderStatusActions()}
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button type="button" variant="ghost">
                    <Plus className="mr-1.5 h-4 w-4" />
                    New Report
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Create a new report from the source technique?</AlertDialogTitle>
                    <AlertDialogDescription>The current report remains preserved in local report history. A separate Draft with a new report ID will be created from the current technique basis.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Keep Current Report</AlertDialogCancel>
                    <AlertDialogAction onClick={controller.createNewReportFromTechnique}>Create New Report</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>

          <div className={`grid gap-3 border-b border-border/70 px-3 py-3 md:grid-cols-[minmax(0,1.5fr)_minmax(17rem,0.8fr)] md:px-4 ${validation.linkCurrent ? 'bg-success/5' : 'bg-destructive/5'}`}>
            <div className="flex min-w-0 items-start gap-3">
              <div className={`mt-0.5 grid h-9 w-9 flex-none place-items-center rounded-lg border ${validation.linkCurrent ? 'border-success/30 bg-success/10 text-success' : 'border-destructive/30 bg-destructive/10 text-destructive'}`}>
                <Link2 className="h-4 w-4" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Locked source technique</span>
                  <Badge variant={validation.linkCurrent ? 'outline' : 'destructive'}>{validation.linkCurrent ? 'Current approved basis' : 'Link requires attention'}</Badge>
                </div>
                <div className="mt-1 truncate text-sm font-semibold">{report.sourceTechnique.documentNumber || 'Technique number not set'} · Rev {report.sourceTechnique.revision || '—'}</div>
                <p className="mt-1 truncate text-xs text-muted-foreground" title={report.sourceTechnique.title}>{report.sourceTechnique.title || technique.documentControl.title || report.sourceTechnique.documentId}</p>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
                  <span>Document ID: {report.sourceTechnique.documentId}</span>
                  <span>Technique approval date: {report.sourceTechnique.approvalDate || 'Not recorded'}</span>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-2 xl:grid-cols-3">
              <ReadOnlyDatum label="Completed fields" value={`${validation.completedFieldsCount}/${validation.totalRequiredFields}`} />
              <ReadOnlyDatum label="Report completion" value={`${validation.completionPercent}%`} />
              <ReadOnlyDatum label="Approval readiness" value={validation.isApprovalReady ? 'Ready' : 'Not ready'} />
            </div>
          </div>

          {controller.persistenceError && (
            <div className="flex items-start gap-2 border-b border-destructive/25 bg-destructive/10 px-4 py-2.5 text-sm text-destructive" role="alert">
              <AlertTriangle className="mt-0.5 h-4 w-4 flex-none" />
              <span>
                {controller.persistenceError}
                {controller.persistenceIssues.length > 1 && ` ${controller.persistenceIssues.length - 1} additional preserved storage notice${controller.persistenceIssues.length === 2 ? '' : 's'} require review.`}
              </span>
            </div>
          )}

          {isApproved && (
            <div className="flex items-start gap-2 border-b border-warning/25 bg-warning/10 px-4 py-2.5 text-xs text-muted-foreground">
              <AlertTriangle className="mt-0.5 h-4 w-4 flex-none text-warning" />
              Editing any report field returns the record to Draft and clears its prior personnel approval records.
            </div>
          )}

          <div className="grid gap-3 px-3 py-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-center md:px-4">
            <div className="min-w-0">
              <div className="mb-1.5 flex items-center justify-between gap-3 text-xs">
                <span className="font-semibold">Performed record completion</span>
                <span className="font-mono font-semibold">{validation.completionPercent}%</span>
              </div>
              <div
                className="readiness-track"
                role="progressbar"
                aria-label={`${validation.completionPercent}% of performed report fields complete`}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={validation.completionPercent}
              >
                <div
                  className={`readiness-fill${validation.completionPercent >= 100 ? ' readiness-fill--complete' : ''}`}
                  style={{ width: `${Math.max(0, Math.min(100, validation.completionPercent))}%` }}
                />
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <Badge variant={dataIssueCount === 0 ? 'outline' : 'secondary'}>{dataIssueCount} report item{dataIssueCount === 1 ? '' : 's'} open</Badge>
              <Badge variant={sourceIssueCount === 0 ? 'outline' : 'destructive'}>{sourceIssueCount === 0 ? 'Technique link current' : `${sourceIssueCount} link issue${sourceIssueCount === 1 ? '' : 's'}`}</Badge>
            </div>
          </div>

          <div className="workbench-tabstrip workbench-tabstrip-compact w-full max-w-full overflow-x-auto overscroll-x-contain" aria-label="Inspection report workflow sections">
            <TabsList className="inline-flex h-auto w-max min-w-full flex-nowrap items-center justify-start gap-1" aria-label="Inspection report sections">
              <TabsTrigger value="details" className="rounded-md px-3 py-2 text-sm font-semibold whitespace-nowrap">1. Report Details</TabsTrigger>
              <TabsTrigger value="results" className="rounded-md px-3 py-2 text-sm font-semibold whitespace-nowrap">2. Performed Results</TabsTrigger>
              <TabsTrigger value="indications" className="rounded-md px-3 py-2 text-sm font-semibold whitespace-nowrap">3. Indications <Badge variant="secondary" className="ml-1.5">{report.indications.length}</Badge></TabsTrigger>
              <TabsTrigger value="review" className="rounded-md px-3 py-2 text-sm font-semibold whitespace-nowrap">4. Review &amp; Approval</TabsTrigger>
            </TabsList>
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-1 pb-3 outline-none md:px-3" data-rtpt-inspection-workspace-scroll tabIndex={-1}>
        <div className="app-panel workbench-surface max-w-full p-2 md:p-4">
          {isSuperseded && (
            <div className="mb-4 flex items-start gap-3 rounded-xl border border-border bg-muted/35 p-3 text-sm text-muted-foreground">
              <ShieldCheck className="mt-0.5 h-4 w-4 flex-none" />
              This superseded inspection record is read only. Restart from the current technique to create a separate Draft report.
            </div>
          )}
          <TabsContent value="details" className="m-0"><ReportDetails controller={controller} disabled={isSuperseded} /></TabsContent>
          <TabsContent value="results" className="m-0">
            {report.method === 'RT-Film'
              ? <FilmResults controller={controller} disabled={isSuperseded} />
              : report.method === 'RT-Digital'
                ? <DigitalResults controller={controller} disabled={isSuperseded} />
                : <PtResults controller={controller} disabled={isSuperseded} />}
          </TabsContent>
          <TabsContent value="indications" className="m-0"><IndicationsSection controller={controller} disabled={isSuperseded} /></TabsContent>
          <TabsContent value="review" className="m-0"><ReviewSection controller={controller} disabled={isSuperseded} onSelectIssue={selectIssue} /></TabsContent>
        </div>
      </div>
    </Tabs>
  );
}
