import { useId } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import type { RtFilmGeneralInfo } from '@/types/rtFilm';
import { DateField, NumberField, SelectField, TextField } from '@/components/tabs/shared/FieldRow';
import { MaterialCatalogCard } from '@/components/tabs/shared/MaterialCatalogCard';
import processImage from '@/assets/rtpt/rt-process-overview.png';

interface Props {
  data: RtFilmGeneralInfo;
  onChange: (data: RtFilmGeneralInfo) => void;
  ps811000Applicable: boolean;
  onPs811000ApplicableChange: (applicable: boolean) => void;
  iso17636TestClass?: 'A' | 'B';
  onIso17636TestClassChange: (testClass: 'A' | 'B' | '') => void;
}

const ISO_17636_OPTIONS = [
  { label: 'Not governed by ISO 17636-1', value: 'none' },
  { label: 'Class A (basic techniques)', value: 'A' },
  { label: 'Class B (improved techniques)', value: 'B' },
] as const;

const LENGTH_UNITS = [
  { label: 'mm', value: 'mm' },
  { label: 'inch', value: 'inch' },
] as const;

export const RtFilmGeneralTab = ({
  data,
  onChange,
  ps811000Applicable,
  onPs811000ApplicableChange,
  iso17636TestClass,
  onIso17636TestClassChange,
}: Props) => {
  const ps811000Id = useId();
  const set = <K extends keyof RtFilmGeneralInfo>(key: K, value: RtFilmGeneralInfo[K]) => (
    onChange({ ...data, [key]: value })
  );

  return (
    <div className="space-y-4">
    <Card className="overflow-hidden">
      <CardHeader>
        <CardTitle>1. General &amp; Part Definition</CardTitle>
        <p className="text-sm text-muted-foreground">Identify the controlled part configuration and planned inspection scope.</p>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 gap-x-5 gap-y-4 md:grid-cols-2 2xl:grid-cols-4">
          <TextField label="Part Name" value={data.partName} onChange={(value) => set('partName', value)} placeholder="Designation per drawing title block" />
          <TextField label="Part Number" value={data.partNumber} onChange={(value) => set('partNumber', value)} placeholder="Controlled part / drawing number" />
          <TextField label="Vendor Code" value={data.vendorCode} onChange={(value) => set('vendorCode', value)} placeholder="Customer or vendor identifier" />
          <TextField
            label="Part Revision / Configuration"
            value={data.partRevisionOrConfiguration}
            onChange={(value) => set('partRevisionOrConfiguration', value)}
          />
          <TextField label="Material" value={data.material} onChange={(value) => set('material', value)} placeholder="Alloy and material specification" />
          <TextField label="Surface Finish" value={data.surfaceFinish} onChange={(value) => set('surfaceFinish', value)} placeholder="Surface condition at inspection" />
          <div className="md:col-span-2">
            <TextField label="Inspection Area" value={data.inspectionArea} onChange={(value) => set('inspectionArea', value)} placeholder="Zone, weld, region, or extent" />
          </div>
          <div className="grid grid-cols-[minmax(0,1fr)_7.5rem] gap-2">
            <NumberField label="Nominal Thickness" value={data.thickness} onChange={(value) => set('thickness', value)} unit={data.thicknessUnit} min={0} />
            <SelectField label="Unit" value={data.thicknessUnit} onChange={(value) => set('thicknessUnit', value)} options={LENGTH_UNITS} />
          </div>
          <TextField label="Drawing Reference" value={data.drawingReference} onChange={(value) => set('drawingReference', value)} placeholder="Governing drawing and revision" />
          <TextField label="Procedure Number" value={data.procedureNumber} onChange={(value) => set('procedureNumber', value)} placeholder="Internal NDT procedure" />
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
        </div>

        <div className="rounded-md border border-primary/25 bg-primary/5 p-4">
          <div className="flex items-start gap-3">
            <Switch
              id={ps811000Id}
              checked={ps811000Applicable}
              onCheckedChange={onPs811000ApplicableChange}
            />
            <div>
              <Label htmlFor={ps811000Id} className="font-semibold">Apply PS811000E C1 planning rules</Label>
              <p
                className="mt-1 text-xs text-muted-foreground"
                title="Enables verified numerical lookups and calculations from the controlled reference. This does not replace the applicable drawing, customer requirements, machine technique table, or Level III approval."
              >
                Applies the controlled PS811000E lookup tables to this technique.
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-md border border-border/70 bg-muted/20 p-4">
          <div className="md:max-w-md">
            <SelectField
              label="ISO 17636-1 Test Class"
              value={iso17636TestClass ?? 'none'}
              onChange={(value) => onIso17636TestClassChange(value === 'none' ? '' : value as 'A' | 'B')}
              options={ISO_17636_OPTIONS}
              hint="optional"
            />
          </div>
          <p
            className="mt-2 text-xs text-muted-foreground"
            title="Selecting a class enforces the ISO 17636-1 minimum source-to-object distance (f >= 7.5/15 · d · b^(2/3)) per view and the class minimum optical density. Class IQI and viewing tables remain governed by the controlled standard text."
          >
            Enforces the class minimum source-to-object distance and density per view.
          </p>
        </div>

        <figure className="mx-auto w-fit max-w-full overflow-hidden rounded-md border border-border/80 bg-[#071421] shadow-[0_16px_36px_rgba(2,6,23,0.24)]">
          <img
            src={processImage}
            alt="Radiographic exposure planning workflow with an X-ray source, aerospace ring casting, detector, and six technique-planning stages."
            className="block h-auto max-h-[min(48vh,720px)] w-auto max-w-full"
            draggable={false}
          />
        </figure>
      </CardContent>
    </Card>
    <MaterialCatalogCard />
    </div>
  );
};
