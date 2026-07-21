import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { PtAcceptance } from '@/types/penetrant';
import { TextAreaField, TextField } from '@/components/tabs/shared/FieldRow';

interface Props {
  data: PtAcceptance;
  onChange: (d: PtAcceptance) => void;
  techniqueNotes: string;
  onTechniqueNotesChange: (notes: string) => void;
}

export const PtAcceptanceTab = ({ data, onChange, techniqueNotes, onTechniqueNotesChange }: Props) => {
  const set = <K extends keyof PtAcceptance>(k: K, v: PtAcceptance[K]) =>
    onChange({ ...data, [k]: v });

  return (
    <Card>
      <CardHeader>
        <CardTitle>7. Acceptance Criteria</CardTitle>
        <p className="text-sm text-muted-foreground">
          Enter the requirements exactly as issued by the controlled drawing, product specification, or engineering disposition.
        </p>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <TextField
          label="Acceptance Source / Document"
          value={data.acceptanceStandard}
          onChange={v => set('acceptanceStandard', v)}
          placeholder="Drawing, product specification, or engineering disposition"
          hint="not a process standard alone"
        />
        <TextField
          label="Clause / Paragraph"
          value={data.acceptanceClause}
          onChange={v => set('acceptanceClause', v)}
          placeholder="Controlled source clause"
        />
        <TextField
          label="Acceptance Class (as specified)"
          value={data.acceptanceClass}
          onChange={v => set('acceptanceClass', v)}
        />
        <TextField
          label="Acceptance Grade (as specified)"
          value={data.acceptanceGrade}
          onChange={v => set('acceptanceGrade', v)}
        />
        <div className="md:col-span-2">
          <TextAreaField
            label="Controlled Acceptance Criteria Text"
            value={data.acceptanceText}
            onChange={v => set('acceptanceText', v)}
            placeholder="Transcribe or reference the applicable acceptance requirements"
            rows={5}
          />
        </div>
        <div className="md:col-span-2">
          <TextAreaField
            label="Special Acceptance Requirements"
            value={data.specialRequirements}
            onChange={v => set('specialRequirements', v)}
            rows={4}
          />
        </div>
        <div className="md:col-span-2">
          <TextAreaField
            label="Technique Notes"
            value={techniqueNotes}
            onChange={onTechniqueNotesChange}
            placeholder="Planning notes only; do not record inspection results or indications here"
            rows={4}
          />
        </div>
      </CardContent>
    </Card>
  );
};
