import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type {
  DetectorLengthUnit,
  RtDigitalDetectorPerformance,
  RtDigitalReferenceStatus,
} from '@/types/rtDigital';
import { DateField, NumberField, SelectField, TextField } from '@/components/tabs/shared/FieldRow';

interface Props {
  data: RtDigitalDetectorPerformance;
  onChange: (data: RtDigitalDetectorPerformance) => void;
}

interface ReferenceStatusFieldsProps {
  title: string;
  description: string;
  data: RtDigitalReferenceStatus;
  onChange: (data: RtDigitalReferenceStatus) => void;
}

const DETECTOR_LENGTH_UNITS: ReadonlyArray<{ label: string; value: DetectorLengthUnit }> = [
  { label: 'µm', value: 'um' },
  { label: 'mm', value: 'mm' },
  { label: 'inch', value: 'inch' },
];

const ReferenceStatusFields = ({
  title,
  description,
  data,
  onChange,
}: ReferenceStatusFieldsProps) => (
  <section className="rounded-xl border border-border/70 bg-muted/20 p-4">
    <div className="mb-3">
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      <p className="text-xs text-muted-foreground">{description}</p>
    </div>
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <TextField
        label="Reference"
        value={data.reference}
        onChange={(reference) => onChange({ ...data, reference })}
        placeholder="Controlled record or procedure"
      />
      <TextField label="Required Status / Condition" value={data.status} onChange={(status) => onChange({ ...data, status })} />
      <DateField label="Record Date" value={data.date} onChange={(date) => onChange({ ...data, date })} />
      <DateField label="Due Date" value={data.dueDate} onChange={(dueDate) => onChange({ ...data, dueDate })} />
    </div>
  </section>
);

export const RtDigitalDetectorTab = ({ data, onChange }: Props) => (
  <div className="space-y-4">
    <Card>
      <CardHeader>
        <CardTitle>4. Detector Performance Requirements</CardTitle>
        <p className="text-sm text-muted-foreground">
          State the qualified detector and image basic spatial resolution required for the planned technique.
        </p>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="grid grid-cols-[minmax(0,1fr)_7.5rem] gap-2">
          <NumberField label="Detector SRb" value={data.detectorSrb} onChange={(detectorSrb) => onChange({ ...data, detectorSrb })} min={0} />
          <SelectField
            label="Unit"
            value={data.detectorSrbUnit}
            onChange={(detectorSrbUnit) => onChange({ ...data, detectorSrbUnit })}
            options={DETECTOR_LENGTH_UNITS}
          />
        </div>
        <div className="grid grid-cols-[minmax(0,1fr)_7.5rem] gap-2">
          <NumberField label="Image SRb" value={data.imageSrb} onChange={(imageSrb) => onChange({ ...data, imageSrb })} min={0} />
          <SelectField
            label="Unit"
            value={data.imageSrbUnit}
            onChange={(imageSrbUnit) => onChange({ ...data, imageSrbUnit })}
            options={DETECTOR_LENGTH_UNITS}
          />
        </div>
      </CardContent>
    </Card>

    <Card>
      <CardHeader>
        <CardTitle className="text-base">Qualification &amp; Condition References</CardTitle>
        <p className="text-sm text-muted-foreground">
          Capture the controlled records and validity status required before this technique may be used.
        </p>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <ReferenceStatusFields
          title="Bad-pixel Map"
          description="Reference the applicable bad-pixel map and its validity."
          data={data.badPixelMap}
          onChange={(badPixelMap) => onChange({ ...data, badPixelMap })}
        />
        <ReferenceStatusFields
          title="Detector Calibration"
          description="Reference the detector calibration record required by the plan."
          data={data.calibration}
          onChange={(calibration) => onChange({ ...data, calibration })}
        />
        <ReferenceStatusFields
          title="Stability Check"
          description="Reference the applicable stability or performance verification."
          data={data.stability}
          onChange={(stability) => onChange({ ...data, stability })}
        />
      </CardContent>
    </Card>
  </div>
);
