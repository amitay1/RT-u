import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { RtFilmAcceptance } from '@/types/rtFilm';
import { TextAreaField, TextField } from '@/components/tabs/shared/FieldRow';

interface Props {
  data: RtFilmAcceptance;
  onChange: (data: RtFilmAcceptance) => void;
  techniqueNotes: string;
  onTechniqueNotesChange: (value: string) => void;
}

export const RtFilmAcceptanceTab = ({
  data,
  onChange,
  techniqueNotes,
  onTechniqueNotesChange,
}: Props) => {
  const set = <K extends keyof RtFilmAcceptance>(key: K, value: RtFilmAcceptance[K]) => (
    onChange({ ...data, [key]: value })
  );

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>6. Controlled Acceptance Criteria</CardTitle>
          <p className="note-clamp text-sm text-muted-foreground">
            Enter the exact contractually controlled source and requirement. No class, grade, or limit is inferred.
          </p>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <TextField label="Acceptance Standard / Source" value={data.acceptanceStandard} onChange={(value) => set('acceptanceStandard', value)} />
          <TextField label="Acceptance Clause" value={data.acceptanceClause} onChange={(value) => set('acceptanceClause', value)} />
          <TextField label="Acceptance Class" value={data.acceptanceClass} onChange={(value) => set('acceptanceClass', value)} hint="only when explicitly specified" />
          <TextField label="Acceptance Grade" value={data.acceptanceGrade} onChange={(value) => set('acceptanceGrade', value)} hint="only when explicitly specified" />
          <TextAreaField label="Acceptance Requirement Text" value={data.acceptanceText} onChange={(value) => set('acceptanceText', value)} rows={5} />
          <TextAreaField label="Special Requirements" value={data.specialRequirements} onChange={(value) => set('specialRequirements', value)} rows={4} />
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
