import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Calculator,
  Database,
  Plus,
  Save,
  ShieldAlert,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  NumberField,
  SelectField,
  TextAreaField,
  TextField,
} from '@/components/tabs/shared/FieldRow';
import { AstmIqiReferenceCard } from '@/components/tabs/shared/AstmIqiReferenceCard';
import { useRtDigitalCatalog } from '@/hooks/useRtDigitalCatalog';
import { convertRtDigitalLength } from '@/lib/rtDigitalPlanning';
import type {
  LengthUnit,
  NumberOrEmpty,
  RtDigitalImageTechnique,
  RtDigitalIqi,
  RtDigitalIqiRuleCatalogSnapshot,
  RtDigitalIqiRuleRow,
  RtDigitalIqiType,
  RtDigitalIqiZoneOutput,
  RtDigitalPlanning,
  RtDigitalThicknessDefinition,
  RtDigitalWallTechnique,
} from '@/types/rtDigital';

export interface RtDigitalIqcTabProps {
  data: RtDigitalIqi;
  planning: RtDigitalPlanning;
  onChange: (data: RtDigitalIqi) => void;
  onPlanningChange: (planning: RtDigitalPlanning) => void;
}

interface ThicknessZoneInput {
  id: string;
  label: string;
  governingThickness: NumberOrEmpty;
  unit: LengthUnit;
}

const LENGTH_UNITS: ReadonlyArray<{ label: string; value: LengthUnit }> = [
  { label: 'mm', value: 'mm' },
  { label: 'inch', value: 'inch' },
];

const IQI_TYPES: ReadonlyArray<{ label: string; value: Exclude<RtDigitalIqiType, ''> }> = [
  { label: 'Wire IQI', value: 'Wire' },
  { label: 'Hole-type IQI', value: 'Hole' },
  { label: 'Duplex-wire IQI (ISO 19232-5 / ASTM E2002)', value: 'Duplex' },
];

const WALL_TECHNIQUES: ReadonlyArray<{ label: string; value: Exclude<RtDigitalWallTechnique, ''> }> = [
  { label: 'Single Wall', value: 'Single Wall' },
  { label: 'Double Wall', value: 'Double Wall' },
];

const IMAGE_TECHNIQUES: ReadonlyArray<{ label: string; value: Exclude<RtDigitalImageTechnique, ''> }> = [
  { label: 'SWSI', value: 'SWSI' },
  { label: 'DWSI', value: 'DWSI' },
  { label: 'DWDI', value: 'DWDI' },
  { label: 'Elliptical', value: 'Elliptical' },
  { label: 'Other', value: 'Other' },
];

const freshId = (prefix: string): string => (
  typeof globalThis.crypto?.randomUUID === 'function'
    ? `${prefix}-${globalThis.crypto.randomUUID()}`
    : `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
);

const cloneSnapshot = (snapshot: Readonly<RtDigitalIqiRuleCatalogSnapshot>): RtDigitalIqiRuleCatalogSnapshot => (
  JSON.parse(JSON.stringify(snapshot)) as RtDigitalIqiRuleCatalogSnapshot
);

const createDraftSnapshot = (planning: RtDigitalPlanning): RtDigitalIqiRuleCatalogSnapshot => ({
  standard: planning.iqiRules.basis.standard || planning.part.inspectionStandard,
  standardRevision: planning.iqiRules.basis.standardRevision || planning.part.inspectionStandardRevision,
  materialGroup: planning.iqiRules.basis.materialGroup || planning.part.materialGroup,
  iqiType: planning.iqiRules.basis.iqiType,
  wallTechnique: planning.part.technique.wallTechnique,
  imageTechnique: planning.part.technique.imageTechnique,
  thicknessUnit: planning.part.thickness.unit,
  placementRule: planning.iqiRules.basis.placementRule,
  rules: [],
});

const createRule = (): RtDigitalIqiRuleRow => ({
  id: freshId('dr-iqi-rule-row'),
  minimumThickness: '',
  maximumThickness: '',
  iqiMaterial: '',
  designation: '',
  requiredWire: '',
  requiredHole: '',
  requiredSensitivity: '',
  placement: '',
  shimRequirement: '',
});

const thicknessZones = (thickness: RtDigitalThicknessDefinition): ThicknessZoneInput[] => {
  if (thickness.mode === 'Single Thickness') {
    return [{
      id: thickness.id,
      label: 'Part thickness',
      governingThickness: thickness.thickness,
      unit: thickness.unit,
    }];
  }
  if (thickness.mode === 'Thickness Range') {
    return [{
      id: thickness.id,
      label: 'Part thickness range',
      governingThickness: thickness.maximum === '' ? thickness.minimum : thickness.maximum,
      unit: thickness.unit,
    }];
  }
  if (thickness.mode === 'Multiple Thickness Zones') {
    return thickness.zones.map((zone, index) => ({
      id: zone.id,
      label: zone.zoneId || `Thickness zone ${index + 1}`,
      governingThickness: zone.governing === ''
        ? zone.maximum === '' ? zone.minimum : zone.maximum
        : zone.governing,
      unit: thickness.unit,
    }));
  }
  return [];
};

const matchRule = (
  rules: RtDigitalIqiRuleRow[],
  thickness: number,
): RtDigitalIqiRuleRow | null => {
  const candidates = rules
    .map((rule, index) => ({ rule, index }))
    .filter(({ rule }) => {
      const minimum = rule.minimumThickness === '' ? Number.NEGATIVE_INFINITY : rule.minimumThickness;
      const maximum = rule.maximumThickness === '' ? Number.POSITIVE_INFINITY : rule.maximumThickness;
      return minimum <= thickness && thickness <= maximum;
    })
    .sort((left, right) => {
      const leftMinimum = left.rule.minimumThickness === '' ? Number.NEGATIVE_INFINITY : left.rule.minimumThickness;
      const rightMinimum = right.rule.minimumThickness === '' ? Number.NEGATIVE_INFINITY : right.rule.minimumThickness;
      const leftMaximum = left.rule.maximumThickness === '' ? Number.POSITIVE_INFINITY : left.rule.maximumThickness;
      const rightMaximum = right.rule.maximumThickness === '' ? Number.POSITIVE_INFINITY : right.rule.maximumThickness;
      const leftSpan = leftMaximum - leftMinimum;
      const rightSpan = rightMaximum - rightMinimum;
      if (leftSpan !== rightSpan) return leftSpan - rightSpan;
      if (leftMinimum !== rightMinimum) return rightMinimum - leftMinimum;
      const idOrder = left.rule.id.localeCompare(right.rule.id);
      return idOrder || left.index - right.index;
    });
  return candidates[0]?.rule ?? null;
};

/** Most-specific range wins; the highest governing thickness is marked governing deterministically. */
function calculateRtDigitalIqiZoneOutputs(
  planning: RtDigitalPlanning,
  snapshot: RtDigitalIqiRuleCatalogSnapshot,
): RtDigitalIqiZoneOutput[] {
  const zones = thicknessZones(planning.part.thickness);
  const existingByZone = new Map(
    planning.iqiRules.zoneOutputs.map((output) => [output.thicknessZoneId, output]),
  );
  const normalized = zones.map((zone) => {
    const convertedThickness = zone.governingThickness === ''
      ? null
      : convertRtDigitalLength(zone.governingThickness, zone.unit, snapshot.thicknessUnit);
    return { zone, convertedThickness };
  });
  const governingZoneId = [...normalized]
    .filter((entry): entry is typeof entry & { convertedThickness: number } => entry.convertedThickness !== null)
    .sort((left, right) => (
      right.convertedThickness - left.convertedThickness
      || left.zone.id.localeCompare(right.zone.id)
    ))[0]?.zone.id ?? '';

  return normalized.map(({ zone, convertedThickness }) => {
    const matched = convertedThickness === null ? null : matchRule(snapshot.rules, convertedThickness);
    const existing = existingByZone.get(zone.id);
    return {
      id: existing?.id ?? freshId('dr-iqi-zone-output'),
      thicknessZoneId: zone.id,
      governingThickness: convertedThickness ?? '',
      thicknessUnit: snapshot.thicknessUnit,
      iqiMaterial: matched?.iqiMaterial ?? '',
      designation: matched?.designation ?? '',
      requiredWire: matched?.requiredWire ?? '',
      requiredHole: matched?.requiredHole ?? '',
      requiredSensitivity: matched?.requiredSensitivity ?? '',
      placement: matched?.placement || snapshot.placementRule,
      shimRequirement: matched?.shimRequirement ?? '',
      governing: zone.id === governingZoneId,
      overrideId: existing?.overrideId ?? '',
    };
  });
}

export function RtDigitalIqcTab({
  data,
  planning,
  onChange,
  onPlanningChange,
}: RtDigitalIqcTabProps) {
  const catalog = useRtDigitalCatalog();
  const initialSnapshot = planning.iqiRules.basis.snapshot
    ? cloneSnapshot(planning.iqiRules.basis.snapshot)
    : createDraftSnapshot(planning);
  const [draft, setDraft] = useState<RtDigitalIqiRuleCatalogSnapshot>(initialSnapshot);
  const [catalogName, setCatalogName] = useState('');
  const selectedCatalogRevision = planning.iqiRules.basis.catalogRevisionId;
  const zones = useMemo(() => thicknessZones(planning.part.thickness), [planning.part.thickness]);

  useEffect(() => {
    if (!planning.iqiRules.basis.snapshot) return;
    setDraft(cloneSnapshot(planning.iqiRules.basis.snapshot));
  }, [planning.iqiRules.basis.snapshot, selectedCatalogRevision]);

  const setCore = <K extends keyof RtDigitalIqi>(key: K, value: RtDigitalIqi[K]) => (
    onChange({ ...data, [key]: value })
  );

  const applySnapshot = (
    snapshot: RtDigitalIqiRuleCatalogSnapshot,
    catalogIdentity?: { recordId: string; revisionId: string; revision: number },
  ) => {
    const detached = cloneSnapshot(snapshot);
    const zoneOutputs = calculateRtDigitalIqiZoneOutputs(planning, detached);
    const governing = zoneOutputs.find((output) => output.governing) ?? zoneOutputs[0];
    onPlanningChange({
      ...planning,
      part: {
        ...planning.part,
        materialGroup: detached.materialGroup,
      },
      iqiRules: {
        ...planning.iqiRules,
        basis: {
          ...planning.iqiRules.basis,
          catalogRecordId: catalogIdentity?.recordId ?? '',
          catalogRevisionId: catalogIdentity?.revisionId ?? '',
          catalogRevision: catalogIdentity?.revision ?? '',
          snapshot: detached,
          standard: detached.standard,
          standardRevision: detached.standardRevision,
          iqiType: detached.iqiType,
          material: governing?.iqiMaterial ?? data.material,
          materialGroup: detached.materialGroup,
          placementRule: detached.placementRule,
        },
        zoneOutputs,
      },
    });
    onChange({
      ...data,
      type: detached.iqiType,
      standard: detached.standard,
      designation: governing?.designation ?? '',
      material: governing?.iqiMaterial ?? data.material,
      placement: governing?.placement || detached.placementRule,
      requiredSensitivity: governing?.requiredSensitivity ?? '',
    });
    setDraft(detached);
  };

  const applyCatalogRevision = (revisionId: string) => {
    const option = catalog.iqiRuleOptions.find((candidate) => candidate.revisionId === revisionId);
    if (!option) return;
    const selected = catalog.copyIqiRuleSnapshot(option.recordId, option.revisionId);
    if (!selected) return;
    applySnapshot(selected.snapshot, {
      recordId: selected.catalogRecordId,
      revisionId: selected.catalogRevisionId,
      revision: selected.catalogRevision,
    });
    setCatalogName(catalog.iqiRules.find((record) => record.id === option.recordId)?.name ?? '');
  };

  const saveCatalogRevision = () => {
    const name = catalogName.trim() || [draft.standard, draft.materialGroup, draft.iqiType].filter(Boolean).join(' — ');
    if (!name) {
      toast.error('Enter a catalog name or complete the IQI rule basis first.');
      return;
    }
    try {
      // Refresh before writing so a source/detector catalog edit from another mounted tab is retained.
      catalog.reload();
      const record = catalog.upsertIqiRule({
        name,
        snapshot: draft,
        recordId: planning.iqiRules.basis.catalogRecordId || undefined,
      });
      const revision = record.revisions[record.revisions.length - 1];
      applySnapshot(cloneSnapshot(revision.snapshot), {
        recordId: record.id,
        revisionId: revision.id,
        revision: revision.revision,
      });
      setCatalogName(record.name);
      toast.success(`IQI rule catalog revision ${revision.revision} saved locally.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'The IQI rule catalog could not be saved.');
    }
  };

  const deleteCatalogRecord = () => {
    const recordId = planning.iqiRules.basis.catalogRecordId;
    if (!recordId) return;
    if (!window.confirm(
      'Delete this local IQI catalog record and all of its revisions? Snapshots already copied into techniques will remain unchanged.',
    )) return;
    try {
      catalog.reload();
      catalog.deleteIqiRule(recordId);
      onPlanningChange({
        ...planning,
        iqiRules: {
          ...planning.iqiRules,
          basis: {
            ...planning.iqiRules.basis,
            catalogRecordId: '',
            catalogRevisionId: '',
            catalogRevision: '',
          },
        },
      });
      setCatalogName('');
      toast.success('The local IQI catalog record was deleted. Technique snapshots remain unchanged.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'The IQI rule catalog record could not be deleted.');
    }
  };

  const updateRule = (id: string, patch: Partial<RtDigitalIqiRuleRow>) => {
    setDraft({
      ...draft,
      rules: draft.rules.map((rule) => (rule.id === id ? { ...rule, ...patch } : rule)),
    });
  };

  const setIqiType = (iqiType: RtDigitalIqiType) => {
    setDraft({ ...draft, iqiType });
    setCore('type', iqiType);
  };

  const outputByZone = new Map(planning.iqiRules.zoneOutputs.map((output) => [output.thicknessZoneId, output]));
  const draftOutputs = calculateRtDigitalIqiZoneOutputs(planning, draft);

  const linkOverride = (zoneId: string, overrideId: string) => {
    onPlanningChange({
      ...planning,
      iqiRules: {
        ...planning.iqiRules,
        zoneOutputs: planning.iqiRules.zoneOutputs.map((output) => (
          output.thicknessZoneId === zoneId ? { ...output, overrideId } : output
        )),
      },
    });
  };

  return (
    <div className="space-y-4">
      <Alert>
        <ShieldAlert className="h-4 w-4" />
        <AlertTitle>Guidance input — not an automatic compliance claim</AlertTitle>
        <AlertDescription>
          IQI rules assist deterministic planning only. The applicable standard revision, customer requirements, approved procedure,
          material grouping, technique, and Level III approval remain controlled inputs and govern the released document.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle>6. IQI &amp; Image Quality Requirements</CardTitle>
          <p className="text-sm text-muted-foreground">
            Define planned requirements here. Achieved wire/hole visibility, SNR, CNR, and other results belong to the inspection record.
          </p>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <SelectField
            label="IQI Type"
            value={(data.type === 'Wire' || data.type === 'Hole' || data.type === 'Duplex' ? data.type : draft.iqiType)}
            onChange={setIqiType}
            options={IQI_TYPES}
            placeholder="Select Wire, Hole, or Duplex…"
          />
          <TextField label="IQI Standard" value={data.standard} onChange={(value) => setCore('standard', value)} />
          <TextField label="IQI Designation" value={data.designation} onChange={(value) => setCore('designation', value)} />
          <TextField label="IQI Material" value={data.material} onChange={(value) => setCore('material', value)} />
          <div className="grid grid-cols-[minmax(0,1fr)_7.5rem] gap-2">
            <NumberField label="IQI Thickness" value={data.thickness} onChange={(value) => setCore('thickness', value)} min={0} />
            <SelectField label="Unit" value={data.thicknessUnit} onChange={(value) => setCore('thicknessUnit', value)} options={LENGTH_UNITS} />
          </div>
          <TextField label="Placement" value={data.placement} onChange={(value) => setCore('placement', value)} placeholder="Source side / detector side / marking instruction" />
          <TextField label="Required Sensitivity" value={data.requiredSensitivity} onChange={(value) => setCore('requiredSensitivity', value)} />
          <TextField label="Required SNR / Normalized SNR" value={data.requiredSnrOrNormalizedSnr} onChange={(value) => setCore('requiredSnrOrNormalizedSnr', value)} />
          <TextField label="Required Contrast Sensitivity / CNR" value={data.requiredContrastSensitivityOrCnr} onChange={(value) => setCore('requiredContrastSensitivityOrCnr', value)} />
          <div className="grid grid-cols-[minmax(0,1fr)_7.5rem] gap-2">
            <NumberField label="Required Ug" value={data.requiredUg} onChange={(value) => setCore('requiredUg', value)} min={0} />
            <SelectField label="Unit" value={data.requiredUgUnit} onChange={(value) => setCore('requiredUgUnit', value)} options={LENGTH_UNITS} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="text-base">RT/PT-local IQI Rule Catalog</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">Every save appends an immutable revision; selecting it copies a detached snapshot into this technique.</p>
            </div>
            <Badge variant="outline"><Database className="mr-1 h-3.5 w-3.5" />Versioned local catalog</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <SelectField
              label="Saved IQI Rule Revision"
              value={planning.iqiRules.basis.catalogRevisionId}
              onChange={applyCatalogRevision}
              options={catalog.iqiRuleOptions.map((option) => ({ value: option.value, label: option.label }))}
              placeholder="Select a local revision…"
            />
            <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-end gap-2">
              <TextField label="Catalog Record Name" value={catalogName} onChange={setCatalogName} placeholder="e.g. ASTM E1742 — steel — wire" />
              <Button type="button" variant="outline" onClick={saveCatalogRevision}><Save className="mr-1.5 h-4 w-4" />{planning.iqiRules.basis.catalogRecordId ? 'New Revision' : 'Save'}</Button>
              <Button type="button" size="icon" variant="ghost" disabled={!planning.iqiRules.basis.catalogRecordId} aria-label="Delete selected IQI catalog record" onClick={deleteCatalogRecord}><Trash2 className="h-4 w-4" /></Button>
            </div>
          </div>

          {catalog.storageError ? (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Local catalog unavailable</AlertTitle>
              <AlertDescription>{catalog.storageError.message}</AlertDescription>
            </Alert>
          ) : null}

          <div className="grid grid-cols-1 gap-4 border-t border-border/70 pt-5 md:grid-cols-2 xl:grid-cols-4">
            <TextField label="Standard" value={draft.standard} onChange={(standard) => setDraft({ ...draft, standard })} />
            <TextField label="Standard Revision" value={draft.standardRevision} onChange={(standardRevision) => setDraft({ ...draft, standardRevision })} />
            <TextField label="Material Group" value={draft.materialGroup} onChange={(materialGroup) => setDraft({ ...draft, materialGroup })} />
            <SelectField label="IQI Type" value={draft.iqiType} onChange={setIqiType} options={IQI_TYPES} />
            <SelectField label="Wall Technique" value={draft.wallTechnique} onChange={(wallTechnique) => setDraft({ ...draft, wallTechnique })} options={WALL_TECHNIQUES} />
            <SelectField label="Image Technique" value={draft.imageTechnique} onChange={(imageTechnique) => setDraft({ ...draft, imageTechnique })} options={IMAGE_TECHNIQUES} />
            <SelectField label="Thickness Unit" value={draft.thicknessUnit} onChange={(thicknessUnit) => setDraft({ ...draft, thicknessUnit })} options={LENGTH_UNITS} />
            <TextAreaField label="Default Placement Rule" value={draft.placementRule} onChange={(placementRule) => setDraft({ ...draft, placementRule })} rows={2} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base">Thickness-range Rules</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">When ranges overlap, the narrowest range wins; ties use the higher minimum, then stable row ID.</p>
            </div>
            <Button type="button" size="sm" variant="outline" onClick={() => setDraft({ ...draft, rules: [...draft.rules, createRule()] })}><Plus className="mr-1.5 h-4 w-4" />Add range</Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {draft.rules.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">No IQI thickness rules defined.</div>
          ) : draft.rules.map((rule, index) => (
            <section key={rule.id} className="rounded-xl border border-border/70 bg-muted/10 p-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2"><Badge variant="secondary">Rule {index + 1}</Badge><code className="text-[10px] text-muted-foreground">{rule.id}</code></div>
                <Button type="button" size="icon" variant="ghost" aria-label={`Delete IQI rule ${index + 1}`} onClick={() => setDraft({ ...draft, rules: draft.rules.filter((candidate) => candidate.id !== rule.id) })}><Trash2 className="h-4 w-4" /></Button>
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                <NumberField label="Minimum Thickness" value={rule.minimumThickness} onChange={(minimumThickness) => updateRule(rule.id, { minimumThickness })} unit={draft.thicknessUnit} min={0} />
                <NumberField label="Maximum Thickness" value={rule.maximumThickness} onChange={(maximumThickness) => updateRule(rule.id, { maximumThickness })} unit={draft.thicknessUnit} min={0} />
                <TextField label="IQI Material" value={rule.iqiMaterial} onChange={(iqiMaterial) => updateRule(rule.id, { iqiMaterial })} />
                <TextField label="Designation" value={rule.designation} onChange={(designation) => updateRule(rule.id, { designation })} />
                <TextField label="Required Wire" value={rule.requiredWire} onChange={(requiredWire) => updateRule(rule.id, { requiredWire })} hint={draft.iqiType === 'Wire' ? 'active output' : undefined} />
                <TextField label="Required Hole" value={rule.requiredHole} onChange={(requiredHole) => updateRule(rule.id, { requiredHole })} hint={draft.iqiType === 'Hole' ? 'active output' : undefined} />
                <TextField label="Required Sensitivity" value={rule.requiredSensitivity} onChange={(requiredSensitivity) => updateRule(rule.id, { requiredSensitivity })} />
                <TextField label="Placement" value={rule.placement} onChange={(placement) => updateRule(rule.id, { placement })} />
                <TextField label="Shim Requirement" value={rule.shimRequirement} onChange={(shimRequirement) => updateRule(rule.id, { shimRequirement })} />
              </div>
            </section>
          ))}
          <div className="flex flex-wrap justify-end gap-2 border-t border-border/70 pt-4">
            <Button type="button" variant="outline" onClick={() => applySnapshot(draft)}><Calculator className="mr-1.5 h-4 w-4" />Apply draft &amp; recalculate zones</Button>
            <Button type="button" onClick={saveCatalogRevision}><Save className="mr-1.5 h-4 w-4" />Save revision &amp; apply</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle className="text-base">Deterministic Zone Outputs</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">The highest governing thickness is marked governing. Overrides are links to structured approval records, never free-text substitutions here.</p>
            </div>
            <Badge variant="outline">{zones.length} zone{zones.length === 1 ? '' : 's'}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {draftOutputs.length === 0 ? (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>No thickness zones available</AlertTitle>
              <AlertDescription>Define a single thickness, range, or multiple thickness zones in Part Definition before applying IQI rules.</AlertDescription>
            </Alert>
          ) : draftOutputs.map((preview) => {
            const committed = outputByZone.get(preview.thicknessZoneId);
            const zone = zones.find((candidate) => candidate.id === preview.thicknessZoneId);
            const output = committed ?? preview;
            return (
              <section key={preview.thicknessZoneId} className="rounded-xl border border-border/70 bg-background/60 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="text-sm font-semibold">{zone?.label ?? preview.thicknessZoneId}</h4>
                    {preview.governing ? <Badge>Governing</Badge> : <Badge variant="outline">Zone</Badge>}
                    {!preview.designation ? <Badge variant="destructive">No matching rule</Badge> : null}
                  </div>
                  <span className="text-sm tabular-nums text-muted-foreground">{preview.governingThickness === '' ? 'Thickness unavailable' : `${preview.governingThickness} ${preview.thicknessUnit}`}</span>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-3 text-sm md:grid-cols-4 xl:grid-cols-8">
                  {[
                    ['Material', preview.iqiMaterial || '—'],
                    ['Designation', preview.designation || '—'],
                    ['Wire', preview.requiredWire || '—'],
                    ['Hole', preview.requiredHole || '—'],
                    ['Sensitivity', preview.requiredSensitivity || '—'],
                    ['Placement', preview.placement || '—'],
                    ['Shim', preview.shimRequirement || '—'],
                  ].map(([label, value]) => (
                    <div key={label}><span className="text-xs text-muted-foreground">{label}</span><div className="font-medium">{value}</div></div>
                  ))}
                </div>
                <div className="mt-4 max-w-xl">
                  <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-2">
                    <SelectField
                      label="Structured Override Link"
                      value={output.overrideId}
                      onChange={(overrideId) => linkOverride(preview.thicknessZoneId, overrideId)}
                      options={planning.overrides.map((override) => ({
                        value: override.id,
                        label: `${override.fieldPath || 'IQI override'} — ${override.reason || override.approvedValue || override.id}`,
                      }))}
                      placeholder="No approved override linked"
                      disabled={!committed || planning.overrides.length === 0}
                      hint="authored and approved in the controlled override workflow"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      disabled={!committed || !output.overrideId}
                      onClick={() => linkOverride(preview.thicknessZoneId, '')}
                    >
                      Clear link
                    </Button>
                  </div>
                </div>
              </section>
            );
          })}
        </CardContent>
      </Card>

      <AstmIqiReferenceCard />
    </div>
  );
}
