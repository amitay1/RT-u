import { Plus, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { RtDigitalAcceptance, RtDigitalAcceptanceProfile } from '@/types/rtDigital';
import { TextAreaField, TextField } from '@/components/tabs/shared/FieldRow';

interface Props {
  data: RtDigitalAcceptance;
  onChange: (data: RtDigitalAcceptance) => void;
  techniqueNotes: string;
  onTechniqueNotesChange: (value: string) => void;
  acceptanceProfiles: RtDigitalAcceptanceProfile[];
  onAcceptanceProfilesChange: (profiles: RtDigitalAcceptanceProfile[]) => void;
}

const nextAcceptanceProfileId = (profiles: RtDigitalAcceptanceProfile[]): string => {
  const used = new Set(profiles.map((profile) => profile.id.trim().toUpperCase()));
  let sequence = 1;
  while (used.has(`AC-${sequence.toString().padStart(2, '0')}`)) sequence += 1;
  return `AC-${sequence.toString().padStart(2, '0')}`;
};

const createAcceptanceProfile = (profiles: RtDigitalAcceptanceProfile[]): RtDigitalAcceptanceProfile => {
  const id = nextAcceptanceProfileId(profiles);
  return {
    id,
    name: id,
    standard: '',
    revision: '',
    acceptanceClass: '',
    grade: '',
    level: '',
    applicableClause: '',
    drawingRequirement: '',
    customerRequirement: '',
    requirementText: '',
  };
};

export const RtDigitalAcceptanceTab = ({
  data,
  onChange,
  techniqueNotes,
  onTechniqueNotesChange,
  acceptanceProfiles,
  onAcceptanceProfilesChange,
}: Props) => {
  const set = <K extends keyof RtDigitalAcceptance>(key: K, value: RtDigitalAcceptance[K]) => (
    onChange({ ...data, [key]: value })
  );

  const updateProfile = (id: string, patch: Partial<RtDigitalAcceptanceProfile>) => {
    onAcceptanceProfilesChange(acceptanceProfiles.map((profile) => profile.id === id ? { ...profile, ...patch } : profile));
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>10. Controlled Acceptance Criteria</CardTitle>
          <p className="note-clamp text-sm text-muted-foreground">
            Enter the exact contractually controlled source and requirement. No class, grade, or limit is inferred.
          </p>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <TextField
            label="Acceptance Standard / Source"
            value={data.acceptanceStandard}
            onChange={(value) => set('acceptanceStandard', value)}
          />
          <TextField label="Acceptance Clause" value={data.acceptanceClause} onChange={(value) => set('acceptanceClause', value)} />
          <TextField
            label="Acceptance Class"
            value={data.acceptanceClass}
            onChange={(value) => set('acceptanceClass', value)}
            hint="only when explicitly specified"
          />
          <TextField
            label="Acceptance Grade"
            value={data.acceptanceGrade}
            onChange={(value) => set('acceptanceGrade', value)}
            hint="only when explicitly specified"
          />
          <TextAreaField
            label="Acceptance Requirement Text"
            value={data.acceptanceText}
            onChange={(value) => set('acceptanceText', value)}
            rows={5}
          />
          <TextAreaField
            label="Special Requirements"
            value={data.specialRequirements}
            onChange={(value) => set('specialRequirements', value)}
            rows={4}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="gap-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="text-base">Acceptance Profiles</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                Create stable AC profiles for explicit assignment to individual interpretation areas.
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              onClick={() => onAcceptanceProfilesChange([...acceptanceProfiles, createAcceptanceProfile(acceptanceProfiles)])}
            >
              <Plus className="h-4 w-4" /> Add Profile
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {acceptanceProfiles.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
              No acceptance profiles defined.
            </div>
          ) : acceptanceProfiles.map((profile) => (
            <article key={profile.id} className="space-y-4 rounded-xl border border-border/80 bg-background p-4">
              <div className="flex items-center justify-between gap-3">
                <Badge variant="secondary">{profile.id}</Badge>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="text-destructive hover:text-destructive"
                  aria-label={`Delete acceptance profile ${profile.id}`}
                  onClick={() => onAcceptanceProfilesChange(acceptanceProfiles.filter((candidate) => candidate.id !== profile.id))}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
                <TextField label="Profile Name" value={profile.name} onChange={(name) => updateProfile(profile.id, { name })} />
                <TextField label="Standard" value={profile.standard} onChange={(standard) => updateProfile(profile.id, { standard })} />
                <TextField label="Revision" value={profile.revision} onChange={(revision) => updateProfile(profile.id, { revision })} />
                <TextField label="Applicable Clause" value={profile.applicableClause} onChange={(applicableClause) => updateProfile(profile.id, { applicableClause })} />
                <TextField label="Class" value={profile.acceptanceClass} onChange={(acceptanceClass) => updateProfile(profile.id, { acceptanceClass })} />
                <TextField label="Grade" value={profile.grade} onChange={(grade) => updateProfile(profile.id, { grade })} />
                <TextField label="Level" value={profile.level} onChange={(level) => updateProfile(profile.id, { level })} />
                <TextAreaField label="Requirement Text" value={profile.requirementText} onChange={(requirementText) => updateProfile(profile.id, { requirementText })} rows={4} />
                <TextAreaField label="Drawing Requirement" value={profile.drawingRequirement} onChange={(drawingRequirement) => updateProfile(profile.id, { drawingRequirement })} rows={3} />
                <TextAreaField label="Customer Requirement" value={profile.customerRequirement} onChange={(customerRequirement) => updateProfile(profile.id, { customerRequirement })} rows={3} />
              </div>
            </article>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Technique Notes</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2">
          <TextAreaField
            label="Planned Technique Notes"
            value={techniqueNotes}
            onChange={onTechniqueNotesChange}
            placeholder="Controlled planning notes only; do not enter performed results."
            rows={5}
          />
        </CardContent>
      </Card>
    </div>
  );
};
