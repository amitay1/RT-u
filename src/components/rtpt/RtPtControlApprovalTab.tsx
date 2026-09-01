import {
  AlertTriangle,
  Archive,
  CheckCircle2,
  History,
  Info,
  Plus,
  ShieldAlert,
  Trash2,
} from 'lucide-react';
import type { RtPtWorkspaceController } from '@/hooks/useRtPtWorkspaceState';
import type { RtPtValidationSummary } from '@/lib/rtPtValidation';
import { resolveRtPtWorkflowTab } from '@/lib/rtPtWorkflow';
import type { RtDigitalPlanningOverride } from '@/types/rtDigital';
import {
  RT_PT_REFERENCE_SUGGESTIONS,
  type RtPtApproval,
  type RtPtApprovalRole,
  type RtPtControlledReference,
  type RtPtRevisionHistoryEntry,
} from '@/types/rtPtDocument';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useInspectorProfile } from '@/contexts/InspectorProfileContext';
import {
  DateField,
  SelectField,
  TextAreaField,
  TextField,
} from '@/components/tabs/shared/FieldRow';

interface RtPtControlApprovalTabProps {
  workspace: RtPtWorkspaceController;
  validation?: RtPtValidationSummary;
}

const APPROVAL_ROLE_OPTIONS: ReadonlyArray<{ value: RtPtApprovalRole; label: string }> = [
  { value: 'prepared', label: 'Prepared by' },
  { value: 'reviewed', label: 'Reviewed by' },
  { value: 'cognizant-engineering', label: 'Cognizant engineering' },
  { value: 'ndt-level-3', label: 'NDT Level III' },
  { value: 'quality', label: 'Quality' },
  { value: 'customer', label: 'Customer' },
];

const emptyReference = (): RtPtControlledReference => ({
  type: '',
  title: '',
  number: '',
  revision: '',
  clauseOrNote: '',
});

const emptyApproval = (role: RtPtApprovalRole): RtPtApproval => ({
  role,
  name: '',
  personnelId: '',
  certificationBasis: '',
  certificationRevision: '',
  date: '',
});

const createLocalId = (prefix: string): string => {
  if (typeof globalThis.crypto?.randomUUID === 'function') return globalThis.crypto.randomUUID();
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
};

const emptyRevisionHistoryEntry = (): RtPtRevisionHistoryEntry => ({
  id: createLocalId('revision'),
  revision: '',
  date: '',
  description: '',
  author: '',
});

const emptyPlanningOverride = (): RtDigitalPlanningOverride => ({
  id: createLocalId('dr-override'),
  fieldPath: '',
  calculatedValue: '',
  approvedValue: '',
  reason: '',
  approvedBy: '',
  approvedAt: '',
});

const quarantineCategory = (sourcePath: string): string => {
  const path = sourcePath.toLowerCase();
  if (path.includes('iqc') || path.includes('iqi') || path.includes('cnr') || path.includes('density') || path.includes('sensitivity')) {
    return 'Image quality / density results';
  }
  if (path.includes('indication')) return 'Observed indications';
  if (path.includes('postclean') || path.includes('disposition') || path.includes('result')) {
    return 'Disposition / post-cleaning results';
  }
  if (path.includes('identification') || path.includes('inspector') || path.includes('inspectiondate')) {
    return 'Performed inspection identification';
  }
  return 'Other legacy performed data';
};

export function RtPtControlApprovalTab({ workspace, validation }: RtPtControlApprovalTabProps) {
  const { currentProfile } = useInspectorProfile();
  const {
    method,
    setActiveTab,
    documentId,
    status,
    setStatus,
    documentControl,
    setDocumentControl,
    revisionHistory,
    setRevisionHistory,
    organization,
    setOrganization,
    job,
    setJob,
    unitSystem,
    setUnitSystem,
    controlledReferences,
    setControlledReferences,
    approvals,
    setApprovals,
    migration,
    acknowledgeMigration,
  } = workspace;

  const digitalPlanning = method === 'RT-Digital' ? workspace.rtDigital.sheet.planning : null;
  const approvalIssues = validation?.approvalReadiness.issues ?? [];
  const approvalErrorCount = approvalIssues.filter((issue) => issue.severity === 'error').length;
  const approvalWarningCount = approvalIssues.filter((issue) => issue.severity === 'warning').length;

  const updatePlanningOverride = (id: string, patch: Partial<RtDigitalPlanningOverride>) => {
    if (!digitalPlanning) return;
    workspace.rtDigital.updatePlanning({
      ...digitalPlanning,
      overrides: digitalPlanning.overrides.map((override) => (
        override.id === id ? { ...override, ...patch, id: override.id } : override
      )),
    });
  };

  const setDocumentStatus = (nextStatus: typeof status) => {
    if (nextStatus === 'approved' && validation && !validation.approvalReadiness.isReady) {
      const firstIssue = validation.approvalReadiness.issues[0];
      if (firstIssue) setActiveTab(method, resolveRtPtWorkflowTab(method, firstIssue.tab));
      return;
    }
    setStatus(nextStatus);
  };

  const updateReference = (index: number, patch: Partial<RtPtControlledReference>) => {
    setControlledReferences((current) => current.map((reference, referenceIndex) => (
      referenceIndex === index ? { ...reference, ...patch } : reference
    )));
  };

  const updateRevisionHistoryEntry = (id: string, patch: Partial<RtPtRevisionHistoryEntry>) => {
    setRevisionHistory((current) => current.map((entry) => (
      entry.id === id ? { ...entry, ...patch, id: entry.id } : entry
    )));
  };

  const updateApproval = (index: number, patch: Partial<RtPtApproval>) => {
    setApprovals((current) => current.map((approval, approvalIndex) => (
      approvalIndex === index ? { ...approval, ...patch } : approval
    )));
  };

  const nextApprovalRole = APPROVAL_ROLE_OPTIONS.find((option) => (
    !approvals.some((approval) => approval.role === option.value)
  ))?.value ?? 'reviewed';

  const quarantineCategories = migration?.quarantine.reduce<Record<string, number>>((categories, entry) => {
    const category = quarantineCategory(entry.sourcePath);
    categories[category] = (categories[category] ?? 0) + 1;
    return categories;
  }, {}) ?? {};

  const handleMigrationAcknowledgement = () => {
    if (!migration || !currentProfile) return;
    const accepted = confirm(
      `Complete the V${migration.sourceSchemaVersion} migration review as ${currentProfile.name}? `
      + 'Legacy quarantined values will not be adopted into the controlled V3 technique, prior approvals will remain invalid, and an audit entry will be added.',
    );
    if (!accepted) return;
    acknowledgeMigration({
      name: currentProfile.name,
      personnelId: currentProfile.certificationNumber,
    });
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Document Control</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <TextField label="Document ID" value={documentId} onChange={() => undefined} disabled hint="stable system identity" />
          <SelectField
            label="Document Status"
            value={status}
            onChange={setDocumentStatus}
            options={[
              { value: 'draft', label: 'Draft' },
              { value: 'in-review', label: 'In review' },
              {
                value: 'approved',
                label: validation && !validation.approvalReadiness.isReady
                  ? 'Approved (blocked by technique check)'
                  : 'Approved',
              },
              { value: 'superseded', label: 'Superseded' },
            ]}
            hint={validation && !validation.approvalReadiness.isReady
              ? 'Approval remains blocked until the current document independently passes every approval-readiness check.'
              : 'Approved status is available only after current validation passes.'}
          />
          <TextField
            label="Document Number"
            value={documentControl.number}
            onChange={(number) => setDocumentControl((current) => ({ ...current, number }))}
          />
          <TextField
            label="Title"
            value={documentControl.title}
            onChange={(title) => setDocumentControl((current) => ({ ...current, title }))}
          />
          <TextField
            label="Revision"
            value={documentControl.revision}
            onChange={(revision) => setDocumentControl((current) => ({ ...current, revision }))}
          />
          <DateField
            label="Revision Date"
            value={documentControl.revisionDate}
            onChange={(revisionDate) => setDocumentControl((current) => ({ ...current, revisionDate }))}
          />
          <DateField
            label="Effective Date"
            value={documentControl.effectiveDate}
            onChange={(effectiveDate) => setDocumentControl((current) => ({ ...current, effectiveDate }))}
          />
          <SelectField
            label="Unit System"
            value={unitSystem}
            onChange={setUnitSystem}
            options={[
              { value: 'SI', label: 'SI' },
              { value: 'US-customary', label: 'US customary' },
            ]}
            hint="does not silently convert entered values"
          />
          <TextAreaField
            label="Change Summary"
            value={documentControl.changeSummary}
            onChange={(changeSummary) => setDocumentControl((current) => ({ ...current, changeSummary }))}
          />
        </CardContent>
      </Card>

      {method === 'RT-Digital' && validation ? (
        <Card className={validation.approvalReadiness.isReady ? 'border-emerald-500/30' : 'border-destructive/30'}>
          <CardHeader className="gap-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                {validation.approvalReadiness.isReady
                  ? <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                  : <ShieldAlert className="h-5 w-5 text-destructive" />}
                <CardTitle>11. Automatic Technique Check</CardTitle>
              </div>
              <Badge variant={validation.approvalReadiness.isReady ? 'outline' : 'destructive'}>
                {validation.approvalReadiness.isReady ? 'READY FOR APPROVAL' : 'APPROVAL BLOCKED'}
              </Badge>
            </div>
            <p className="note-clamp text-sm text-muted-foreground">
              This check is recalculated from the current controlled inputs. Stored overrides are reviewed explicitly and never replace calculated values.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-border/70 bg-muted/20 p-3">
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Approval readiness</div>
                <div className="mt-1 text-2xl font-semibold tabular-nums">{validation.approvalReadiness.completionPercent}%</div>
                <div className="text-xs text-muted-foreground">
                  {validation.approvalReadiness.completedRequirements} / {validation.approvalReadiness.totalRequirements} checks
                </div>
              </div>
              <div className="rounded-xl border border-destructive/25 bg-destructive/5 p-3">
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Blocking corrections</div>
                <div className="mt-1 text-2xl font-semibold tabular-nums text-destructive">{approvalErrorCount}</div>
                <div className="text-xs text-muted-foreground">must be resolved before release</div>
              </div>
              <div className="rounded-xl border border-amber-500/25 bg-amber-500/5 p-3">
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Warnings</div>
                <div className="mt-1 text-2xl font-semibold tabular-nums text-amber-700 dark:text-amber-300">{approvalWarningCount}</div>
                <div className="text-xs text-muted-foreground">require engineering review</div>
              </div>
            </div>

            {approvalIssues.length === 0 ? (
              <div className="flex items-start gap-2 rounded-lg border border-emerald-500/25 bg-emerald-500/5 p-3 text-sm">
                <CheckCircle2 className="mt-0.5 h-4 w-4 flex-none text-emerald-600" />
                <span>The current Digital / DDA technique passes the approval-readiness rules.</span>
              </div>
            ) : (
              <div className="space-y-2" aria-live="polite">
                {approvalIssues.map((issue, index) => (
                  <button
                    key={`${issue.path}-${index}`}
                    type="button"
                    className="flex w-full items-start gap-3 rounded-lg border border-border/80 bg-background/60 p-3 text-left transition-colors hover:border-primary/40 hover:bg-muted/30"
                    onClick={() => setActiveTab(method, resolveRtPtWorkflowTab(method, issue.tab))}
                  >
                    {issue.severity === 'error'
                      ? <ShieldAlert className="mt-0.5 h-4 w-4 flex-none text-destructive" />
                      : <AlertTriangle className="mt-0.5 h-4 w-4 flex-none text-amber-600" />}
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold">{issue.label}</span>
                      <span className="block text-xs text-muted-foreground">{issue.message}</span>
                    </span>
                    <Badge variant="outline" className="flex-none">
                      Open {resolveRtPtWorkflowTab(method, issue.tab)}
                    </Badge>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      ) : null}

      {digitalPlanning ? (
        <Card>
          <CardHeader className="gap-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <CardTitle>Engineering Override Log</CardTitle>
                <p className="note-clamp mt-1 text-sm text-muted-foreground">
                  Record a controlled Level III disposition when an approved value intentionally differs from a calculated requirement.
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => workspace.rtDigital.updatePlanning({
                  ...digitalPlanning,
                  overrides: [...digitalPlanning.overrides, emptyPlanningOverride()],
                })}
              >
                <Plus className="mr-1.5 h-4 w-4" />
                Add Override
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {digitalPlanning.overrides.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
                No engineering overrides are recorded.
              </div>
            ) : digitalPlanning.overrides.map((override, index) => (
              <div key={override.id} className="rounded-xl border border-border/80 bg-background/40 p-3">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold">Override {index + 1}</span>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="text-destructive hover:text-destructive"
                    aria-label={`Remove engineering override ${index + 1}`}
                    onClick={() => workspace.rtDigital.updatePlanning({
                      ...digitalPlanning,
                      overrides: digitalPlanning.overrides.filter((candidate) => candidate.id !== override.id),
                    })}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                  <TextField
                    label="Controlled Field / Check"
                    value={override.fieldPath}
                    onChange={(fieldPath) => updatePlanningOverride(override.id, { fieldPath })}
                    placeholder="e.g. geometry.requiredMaximumUg"
                  />
                  <TextField
                    label="Calculated Value"
                    value={override.calculatedValue}
                    onChange={(calculatedValue) => updatePlanningOverride(override.id, { calculatedValue })}
                  />
                  <TextField
                    label="Approved Value"
                    value={override.approvedValue}
                    onChange={(approvedValue) => updatePlanningOverride(override.id, { approvedValue })}
                  />
                  <TextField
                    label="Approved By (Level III)"
                    value={override.approvedBy}
                    onChange={(approvedBy) => updatePlanningOverride(override.id, { approvedBy })}
                  />
                  <DateField
                    label="Approval Date"
                    value={override.approvedAt}
                    onChange={(approvedAt) => updatePlanningOverride(override.id, { approvedAt })}
                  />
                  <div className="md:col-span-2 lg:col-span-3">
                    <TextAreaField
                      label="Technical Justification"
                      value={override.reason}
                      onChange={(reason) => updatePlanningOverride(override.id, { reason })}
                      rows={3}
                    />
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader className="gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <History className="h-4 w-4 text-muted-foreground" />
              <CardTitle>Revision History</CardTitle>
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setRevisionHistory((current) => [...current, emptyRevisionHistoryEntry()])}
            >
              <Plus className="mr-1.5 h-4 w-4" />
              Add Revision Entry
            </Button>
          </div>
          <p className="note-clamp text-sm text-muted-foreground">
            Record controlled document revisions here; performed inspection history belongs in inspection records.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          {revisionHistory.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border px-3 py-4 text-sm text-muted-foreground">
              No revision-history entries have been added.
            </div>
          ) : revisionHistory.map((entry, index) => (
            <div key={entry.id} className="rounded-xl border border-border/80 bg-background/40 p-3">
              <div className="mb-3 flex items-center justify-between gap-2">
                <span className="text-sm font-semibold">Revision Entry {index + 1}</span>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  aria-label={`Remove revision entry ${index + 1}`}
                  onClick={() => setRevisionHistory((current) => current.filter((candidate) => candidate.id !== entry.id))}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
                <TextField label="Revision" value={entry.revision} onChange={(revision) => updateRevisionHistoryEntry(entry.id, { revision })} />
                <DateField label="Revision Date" value={entry.date} onChange={(date) => updateRevisionHistoryEntry(entry.id, { date })} />
                <TextField label="Author" value={entry.author} onChange={(author) => updateRevisionHistoryEntry(entry.id, { author })} />
                <TextField label="Description" value={entry.description} onChange={(description) => updateRevisionHistoryEntry(entry.id, { description })} />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Organization & Job</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <TextField label="Organization" value={organization.name} onChange={(name) => setOrganization((current) => ({ ...current, name }))} />
          <TextField label="Site" value={organization.site} onChange={(site) => setOrganization((current) => ({ ...current, site }))} />
          <TextField label="Customer" value={job.customer} onChange={(customer) => setJob((current) => ({ ...current, customer }))} />
          <TextField label="Contract" value={job.contract} onChange={(contract) => setJob((current) => ({ ...current, contract }))} />
          <TextField label="Purchase Order" value={job.purchaseOrder} onChange={(purchaseOrder) => setJob((current) => ({ ...current, purchaseOrder }))} />
          <TextField label="Work Order" value={job.workOrder} onChange={(workOrder) => setJob((current) => ({ ...current, workOrder }))} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle>Controlled References</CardTitle>
            <Button type="button" size="sm" variant="outline" onClick={() => setControlledReferences((current) => [...current, emptyReference()])}>
              <Plus className="mr-1.5 h-4 w-4" />
              Add Reference
            </Button>
          </div>
          <div className="flex items-start gap-2 rounded-lg border border-primary/25 bg-primary/10 px-3 py-2 text-xs text-muted-foreground">
            <Info className="mt-0.5 h-4 w-4 flex-none text-primary" />
            <span>{RT_PT_REFERENCE_SUGGESTIONS[method]}. This suggestion is not inserted or treated as a selected standard.</span>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {controlledReferences.length === 0 ? (
            <p className="note-clamp rounded-lg border border-dashed border-border px-3 py-4 text-sm text-muted-foreground">
              No controlled reference selected. Add the contractually applicable document and enter its revision explicitly.
            </p>
          ) : controlledReferences.map((reference, index) => (
            <div key={`reference-${index}`} className="rounded-xl border border-border/80 bg-background/40 p-3">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-sm font-semibold">Reference {index + 1}</span>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  aria-label={`Remove reference ${index + 1}`}
                  onClick={() => setControlledReferences((current) => current.filter((_, referenceIndex) => referenceIndex !== index))}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
                <TextField label="Type" value={reference.type} onChange={(type) => updateReference(index, { type })} placeholder="Practice, code, drawing…" />
                <TextField label="Title" value={reference.title} onChange={(title) => updateReference(index, { title })} />
                <TextField label="Number" value={reference.number} onChange={(number) => updateReference(index, { number })} />
                <TextField label="Revision" value={reference.revision} onChange={(revision) => updateReference(index, { revision })} />
                <div className="md:col-span-2 lg:col-span-4">
                  <Label htmlFor={`reference-note-${index}`} className="text-sm font-medium text-foreground/80">Clause or Note</Label>
                  <Input
                    id={`reference-note-${index}`}
                    className="mt-1.5"
                    value={reference.clauseOrNote}
                    onChange={(event) => updateReference(index, { clauseOrNote: event.target.value })}
                  />
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle>Approvals</CardTitle>
            <Button type="button" size="sm" variant="outline" onClick={() => setApprovals((current) => [...current, emptyApproval(nextApprovalRole)])}>
              <Plus className="mr-1.5 h-4 w-4" />
              Add Approval
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {approvals.length === 0 ? (
            <p className="note-clamp rounded-lg border border-dashed border-border px-3 py-4 text-sm text-muted-foreground">
              No approvals recorded. An identified, dated NDT Level III approval is required for controlled release.
            </p>
          ) : approvals.map((approval, index) => (
            <div key={`approval-${index}`} className="rounded-xl border border-border/80 bg-background/40 p-3">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-sm font-semibold">Approval {index + 1}</span>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  aria-label={`Remove approval ${index + 1}`}
                  onClick={() => setApprovals((current) => current.filter((_, approvalIndex) => approvalIndex !== index))}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                <SelectField
                  label="Role"
                  value={approval.role}
                  onChange={(role) => updateApproval(index, { role })}
                  options={APPROVAL_ROLE_OPTIONS}
                />
                <TextField label="Name" value={approval.name} onChange={(name) => updateApproval(index, { name })} />
                <TextField label="Personnel ID" value={approval.personnelId} onChange={(personnelId) => updateApproval(index, { personnelId })} />
                <TextField label="Certification Basis" value={approval.certificationBasis} onChange={(certificationBasis) => updateApproval(index, { certificationBasis })} placeholder="e.g. NAS 410" />
                <TextField label="Certification Revision" value={approval.certificationRevision} onChange={(certificationRevision) => updateApproval(index, { certificationRevision })} />
                <DateField label="Approval Date" value={approval.date} onChange={(date) => updateApproval(index, { date })} />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {migration ? (
        <Card className="border-warning/30 bg-warning/5">
          <CardHeader className="gap-2">
            <div className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-warning" />
              <CardTitle>Migration Review Required</CardTitle>
              <Badge variant="outline">Read only</Badge>
            </div>
            <p className="note-clamp text-sm text-muted-foreground">
              Migrated from schema V{migration.sourceSchemaVersion}. Quarantined values are intentionally hidden and cannot be edited into this technique.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {migration.warnings.length ? (
              <div>
                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Migration warnings</div>
                <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                  {migration.warnings.map((warning, index) => <li key={`migration-warning-${index}`}>{warning}</li>)}
                </ul>
              </div>
            ) : null}

            <div className="rounded-lg border border-warning/25 bg-background/60 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <Archive className="h-4 w-4 text-warning" />
                  Quarantined performed data
                </div>
                <Badge variant="secondary">{migration.quarantine.length} hidden field{migration.quarantine.length === 1 ? '' : 's'}</Badge>
              </div>
              {Object.keys(quarantineCategories).length ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {Object.entries(quarantineCategories).map(([category, count]) => (
                    <Badge key={category} variant="outline">{category}: {count}</Badge>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-xs text-muted-foreground">No performed-data values were quarantined.</p>
              )}
              <p className="note-clamp mt-3 text-xs text-muted-foreground">
                Only category counts are shown. Legacy values remain outside the editable technique and are not included in technique exports.
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-warning/25 bg-background/60 p-3">
              <div className="text-sm text-muted-foreground">
                {currentProfile
                  ? <>Reviewer: <span className="font-semibold text-foreground">{currentProfile.name}</span> ({currentProfile.certificationNumber})</>
                  : 'Select an inspector profile before completing the migration review.'}
              </div>
              <Button
                type="button"
                onClick={handleMigrationAcknowledgement}
                disabled={!currentProfile || !currentProfile.certificationNumber.trim()}
              >
                Complete Migration Review
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
