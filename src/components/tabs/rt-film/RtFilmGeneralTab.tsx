import { useId } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import type { RtFilmGeneralInfo } from '@/types/rtFilm';
import { DateField, NumberField, SelectField, TextField } from '@/components/tabs/shared/FieldRow';

interface Props {
  data: RtFilmGeneralInfo;
  onChange: (data: RtFilmGeneralInfo) => void;
  ps811000Applicable: boolean;
  onPs811000ApplicableChange: (applicable: boolean) => void;
}

const LENGTH_UNITS = [
  { label: 'mm', value: 'mm' },
  { label: 'inch', value: 'inch' },
] as const;

export const RtFilmGeneralTab = ({
  data,
  onChange,
  ps811000Applicable,
  onPs811000ApplicableChange,
}: Props) => {
  const ps811000Id = useId();
  const set = <K extends keyof RtFilmGeneralInfo>(key: K, value: RtFilmGeneralInfo[K]) => (
    onChange({ ...data, [key]: value })
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>1. General &amp; Part Definition</CardTitle>
        <p className="text-sm text-muted-foreground">Identify the controlled part configuration and planned inspection scope.</p>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-primary/25 bg-primary/5 p-4 md:col-span-2">
          <div className="flex items-start gap-3">
            <Switch
              id={ps811000Id}
              checked={ps811000Applicable}
              onCheckedChange={onPs811000ApplicableChange}
            />
            <div>
              <Label htmlFor={ps811000Id} className="font-semibold">Apply PS811000E C1 planning rules</Label>
              <p className="mt-1 text-xs text-muted-foreground">
                Enables verified numerical lookups and calculations from the controlled reference. This does not replace the applicable drawing, customer requirements, machine technique table, or Level III approval.
              </p>
            </div>
          </div>
        </div>
        <TextField label="Part Name" value={data.partName} onChange={(value) => set('partName', value)} />
        <TextField label="Part Number" value={data.partNumber} onChange={(value) => set('partNumber', value)} />
        <TextField label="Vendor Code" value={data.vendorCode} onChange={(value) => set('vendorCode', value)} />
        <TextField
          label="Part Revision / Configuration"
          value={data.partRevisionOrConfiguration}
          onChange={(value) => set('partRevisionOrConfiguration', value)}
        />
        <TextField label="Material" value={data.material} onChange={(value) => set('material', value)} />
        <TextField label="Surface Finish" value={data.surfaceFinish} onChange={(value) => set('surfaceFinish', value)} />
        <TextField label="Inspection Area" value={data.inspectionArea} onChange={(value) => set('inspectionArea', value)} placeholder="Zone, weld, region, or extent" />
        <div className="grid grid-cols-[minmax(0,1fr)_7.5rem] gap-2">
          <NumberField label="Nominal Thickness" value={data.thickness} onChange={(value) => set('thickness', value)} unit={data.thicknessUnit} min={0} />
          <SelectField label="Unit" value={data.thicknessUnit} onChange={(value) => set('thicknessUnit', value)} options={LENGTH_UNITS} />
        </div>
        <TextField label="Drawing Reference" value={data.drawingReference} onChange={(value) => set('drawingReference', value)} />
        <TextField label="Procedure Number" value={data.procedureNumber} onChange={(value) => set('procedureNumber', value)} />
        <SelectField
          label="Planned Inspection Stage"
          value={data.inspectionStage}
          onChange={(value) => set('inspectionStage', value)}
          options={['In-process', 'Final', 'Maintenance / in-service']}
        />
        <SelectField
          label="Required Personnel Level"
          value={data.inspectorLevel}
          onChange={(value) => set('inspectorLevel', value)}
          options={[
            { label: 'Level I', value: 'I' },
            { label: 'Level II', value: 'II' },
            { label: 'Level III', value: 'III' },
          ]}
          hint="qualification requirement"
        />
        <DateField label="Planned Inspection Date" value={data.date} onChange={(value) => set('date', value)} />
      </CardContent>
    </Card>
  );
};
