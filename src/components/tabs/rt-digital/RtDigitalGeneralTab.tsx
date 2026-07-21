import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { RtDigitalGeneralInfo } from '@/types/rtDigital';
import { DateField, NumberField, SelectField, TextField } from '@/components/tabs/shared/FieldRow';

interface Props {
  data: RtDigitalGeneralInfo;
  onChange: (data: RtDigitalGeneralInfo) => void;
}

const LENGTH_UNITS = [
  { label: 'mm', value: 'mm' },
  { label: 'inch', value: 'inch' },
] as const;

export const RtDigitalGeneralTab = ({ data, onChange }: Props) => {
  const set = <K extends keyof RtDigitalGeneralInfo>(key: K, value: RtDigitalGeneralInfo[K]) => (
    onChange({ ...data, [key]: value })
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>1. General &amp; Part Definition</CardTitle>
        <p className="text-sm text-muted-foreground">
          Identify the controlled part configuration and define the planned digital radiography scope.
        </p>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
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
        <TextField
          label="Inspection Area"
          value={data.inspectionArea}
          onChange={(value) => set('inspectionArea', value)}
          placeholder="Zone, weld, region, or extent"
        />
        <div className="grid grid-cols-[minmax(0,1fr)_7.5rem] gap-2">
          <NumberField
            label="Nominal Thickness"
            value={data.thickness}
            onChange={(value) => set('thickness', value)}
            unit={data.thicknessUnit}
            min={0}
          />
          <SelectField
            label="Unit"
            value={data.thicknessUnit}
            onChange={(value) => set('thicknessUnit', value)}
            options={LENGTH_UNITS}
          />
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
