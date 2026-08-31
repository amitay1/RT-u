import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { PtGeneralInfo } from '@/types/penetrant';
import { DateField, NumberField, SelectField, TextField } from '@/components/tabs/shared/FieldRow';

interface Props {
  data: PtGeneralInfo;
  onChange: (d: PtGeneralInfo) => void;
}

export const PtGeneralTab = ({ data, onChange }: Props) => {
  const set = <K extends keyof PtGeneralInfo>(k: K, v: PtGeneralInfo[K]) =>
    onChange({ ...data, [k]: v });

  return (
    <Card>
      <CardHeader>
        <CardTitle>1. General Information</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <TextField label="Part Name" value={data.partName} onChange={v => set('partName', v)} placeholder="Designation per drawing title block" />
        <TextField label="Part Number" value={data.partNumber} onChange={v => set('partNumber', v)} placeholder="Controlled part / drawing number" />
        <TextField label="Vendor / Supplier Code" value={data.vendorCode} onChange={v => set('vendorCode', v)} placeholder="Customer or vendor identifier" />
        <TextField
          label="Part Revision / Configuration"
          value={data.partRevisionOrConfiguration}
          onChange={v => set('partRevisionOrConfiguration', v)}
        />
        <TextField label="Material" value={data.material} onChange={v => set('material', v)} placeholder="Alloy and material specification" />
        <TextField label="Surface Finish / Condition" value={data.surfaceFinish} onChange={v => set('surfaceFinish', v)} placeholder="Surface condition at inspection" />
        <TextField label="Inspection Area" value={data.inspectionArea} onChange={v => set('inspectionArea', v)} placeholder="Welds, zones, or full-part coverage" />
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_120px]">
          <NumberField label="Thickness" value={data.thickness} onChange={v => set('thickness', v)} unit={data.thicknessUnit} />
          <SelectField label="Unit" value={data.thicknessUnit} onChange={v => set('thicknessUnit', v)} options={[{ label: 'mm', value: 'mm' }, { label: 'inch', value: 'inch' }]} />
        </div>
        <TextField label="Drawing Reference" value={data.drawingReference} onChange={v => set('drawingReference', v)} placeholder="Governing drawing and revision" />
        <TextField label="Procedure Number" value={data.procedureNumber} onChange={v => set('procedureNumber', v)} placeholder="Internal NDT procedure" />
        <SelectField
          label="Planned Inspection Stage"
          value={data.inspectionStage}
          onChange={v => set('inspectionStage', v)}
          options={['In-process', 'Final', 'Maintenance / in-service']}
        />
        <SelectField
          label="Required Personnel Level"
          value={data.inspectorLevel}
          onChange={v => set('inspectorLevel', v)}
          options={[
            { label: 'Level I', value: 'I' },
            { label: 'Level II', value: 'II' },
            { label: 'Level III', value: 'III' },
          ]}
        />
        <DateField label="Planned Inspection Date" value={data.date} onChange={v => set('date', v)} />
      </CardContent>
    </Card>
  );
};
