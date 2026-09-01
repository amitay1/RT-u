import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DateField, NumberField, SelectField, TextField } from '@/components/tabs/shared/FieldRow';
import { MaterialCatalogCard } from '@/components/tabs/shared/MaterialCatalogCard';
import type { LengthUnit } from '@/types/rtFilm';
import type { RtCrGeneralInfo } from '@/types/rtCr';

interface Props {
  data: RtCrGeneralInfo;
  onChange: (data: RtCrGeneralInfo) => void;
  iso17636TestClass?: 'A' | 'B';
  onIso17636TestClassChange: (testClass: 'A' | 'B' | '') => void;
}

const ISO_17636_OPTIONS = [
  { label: 'Not governed by ISO 17636-2', value: 'none' },
  { label: 'Class A (basic techniques)', value: 'A' },
  { label: 'Class B (improved techniques)', value: 'B' },
] as const;

const LENGTH_UNITS: ReadonlyArray<{ label: string; value: LengthUnit }> = [
  { label: 'mm', value: 'mm' },
  { label: 'inch', value: 'inch' },
];

export const RtCrGeneralTab = ({ data, onChange, iso17636TestClass, onIso17636TestClassChange }: Props) => {
  const set = <K extends keyof RtCrGeneralInfo>(key: K, value: RtCrGeneralInfo[K]) => (
    onChange({ ...data, [key]: value })
  );

  return (
    <div className="space-y-4">
    <Card>
      <CardHeader>
        <CardTitle>1. General &amp; Part Definition</CardTitle>
        <p className="note-clamp text-sm text-muted-foreground">
          Identify the controlled part configuration and planned inspection scope for this CR technique.
        </p>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-x-5 gap-y-4 md:grid-cols-2 2xl:grid-cols-4">
        <TextField label="Part Name" value={data.partName} onChange={(value) => set('partName', value)} placeholder="Designation per drawing title block" />
        <TextField label="Part Number" value={data.partNumber} onChange={(value) => set('partNumber', value)} placeholder="Controlled part / drawing number" />
        <TextField label="Vendor Code" value={data.vendorCode} onChange={(value) => set('vendorCode', value)} placeholder="Customer or vendor identifier" />
        <TextField
          label="Part Revision / Configuration"
          value={data.partRevisionOrConfiguration}
          onChange={(value) => set('partRevisionOrConfiguration', value)}
          placeholder="Revision letter or configuration"
        />
        <TextField label="Material" value={data.material} onChange={(value) => set('material', value)} placeholder="Alloy and material specification" />
        <TextField label="Surface Finish" value={data.surfaceFinish} onChange={(value) => set('surfaceFinish', value)} placeholder="Surface condition at inspection" />
        <div className="md:col-span-2">
          <TextField label="Inspection Area" value={data.inspectionArea} onChange={(value) => set('inspectionArea', value)} placeholder="Welds, zones, or full-part coverage" />
        </div>
        <div className="grid grid-cols-[minmax(0,1fr)_7.5rem] gap-2">
          <NumberField label="Nominal Thickness" value={data.thickness} onChange={(value) => set('thickness', value)} min={0} />
          <SelectField label="Unit" value={data.thicknessUnit} onChange={(value) => set('thicknessUnit', value)} options={LENGTH_UNITS} />
        </div>
        <TextField
          label="Drawing / Specification Reference"
          value={data.drawingReference}
          onChange={(value) => set('drawingReference', value)}
          placeholder="Governing drawing and revision"
        />
        <TextField label="Procedure Number" value={data.procedureNumber} onChange={(value) => set('procedureNumber', value)} placeholder="Internal NDT procedure" />
        <SelectField
          label="Inspection Stage"
          value={data.inspectionStage}
          onChange={(value) => set('inspectionStage', value)}
          options={['In-process', 'Final', 'Maintenance / in-service']}
        />
        <SelectField
          label="Required Inspector Level"
          value={data.inspectorLevel}
          onChange={(value) => set('inspectorLevel', value)}
          options={['I', 'II', 'III']}
          hint="qualification requirement"
        />
        <DateField label="Planned Inspection Date" value={data.date} onChange={(value) => set('date', value)} />
        <div className="md:col-span-2 2xl:col-span-4 rounded-md border border-border/70 bg-muted/20 p-4">
          <div className="md:max-w-md">
            <SelectField
              label="ISO 17636-2 Test Class"
              value={iso17636TestClass ?? 'none'}
              onChange={(value) => onIso17636TestClassChange(value === 'none' ? '' : value as 'A' | 'B')}
              options={ISO_17636_OPTIONS}
              hint="optional"
            />
          </div>
          <p
            className="mt-2 text-xs text-muted-foreground"
            title="Selecting a class enforces the ISO 17636 minimum source-to-object distance (f >= 7.5/15 · d · b^(2/3)) per exposure view. Class grey-value and SNR tables remain governed by the controlled standard text."
          >
            Enforces the class minimum source-to-object distance per exposure view.
          </p>
        </div>
      </CardContent>
    </Card>
    <MaterialCatalogCard />
    </div>
  );
};
