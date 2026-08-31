import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DateField, NumberField, SelectField, TextField } from '@/components/tabs/shared/FieldRow';
import { PerformanceTrendEditor } from '@/components/tabs/shared/PerformanceTrendEditor';
import type { DetectorLengthUnit, LengthUnit } from '@/types/rtFilm';
import type { RtCrPlateSystem, RtCrScanner } from '@/types/rtCr';

interface Props {
  plateSystem: RtCrPlateSystem;
  scanner: RtCrScanner;
  onPlateSystemChange: (plateSystem: RtCrPlateSystem) => void;
  onScannerChange: (scanner: RtCrScanner) => void;
}

const LENGTH_UNITS: ReadonlyArray<{ label: string; value: LengthUnit }> = [
  { label: 'mm', value: 'mm' },
  { label: 'inch', value: 'inch' },
];

const DETECTOR_LENGTH_UNITS: ReadonlyArray<{ label: string; value: DetectorLengthUnit }> = [
  { label: 'um', value: 'um' },
  { label: 'mm', value: 'mm' },
  { label: 'inch', value: 'inch' },
];

export const RtCrPlateScannerTab = ({ plateSystem, scanner, onPlateSystemChange, onScannerChange }: Props) => {
  const setPlate = <K extends keyof RtCrPlateSystem>(key: K, value: RtCrPlateSystem[K]) => (
    onPlateSystemChange({ ...plateSystem, [key]: value })
  );
  const setScanner = <K extends keyof RtCrScanner>(key: K, value: RtCrScanner[K]) => (
    onScannerChange({ ...scanner, [key]: value })
  );
  const setQualification = <K extends keyof RtCrScanner['qualification']>(
    key: K,
    value: RtCrScanner['qualification'][K],
  ) => (
    onScannerChange({ ...scanner, qualification: { ...scanner.qualification, [key]: value } })
  );

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>4. Imaging Plate System</CardTitle>
          <p className="text-sm text-muted-foreground">
            The storage-phosphor plate, cassette, and screens this technique is qualified with. The governing
            practice decides the required system class.
          </p>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <TextField label="Plate Manufacturer" value={plateSystem.manufacturer} onChange={(value) => setPlate('manufacturer', value)} />
          <TextField label="Plate Designation" value={plateSystem.plateDesignation} onChange={(value) => setPlate('plateDesignation', value)} placeholder="Plate model / commercial type" />
          <TextField
            label="Plate System Class"
            value={plateSystem.plateClass}
            onChange={(value) => setPlate('plateClass', value)}
            placeholder="Per the governing practice (e.g. ISO 16371-1 / ASTM E2446)"
          />
          <TextField label="Cassette Type" value={plateSystem.cassetteType} onChange={(value) => setPlate('cassetteType', value)} />
          <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_7.5rem] gap-2">
            <TextField label="Front Screen Material" value={plateSystem.frontScreen.material} onChange={(material) => setPlate('frontScreen', { ...plateSystem.frontScreen, material })} />
            <NumberField label="Thickness" value={plateSystem.frontScreen.thickness} onChange={(thickness) => setPlate('frontScreen', { ...plateSystem.frontScreen, thickness })} min={0} />
            <SelectField label="Unit" value={plateSystem.frontScreen.thicknessUnit} onChange={(thicknessUnit) => setPlate('frontScreen', { ...plateSystem.frontScreen, thicknessUnit })} options={LENGTH_UNITS} />
          </div>
          <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_7.5rem] gap-2">
            <TextField label="Back Screen Material" value={plateSystem.backScreen.material} onChange={(material) => setPlate('backScreen', { ...plateSystem.backScreen, material })} />
            <NumberField label="Thickness" value={plateSystem.backScreen.thickness} onChange={(thickness) => setPlate('backScreen', { ...plateSystem.backScreen, thickness })} min={0} />
            <SelectField label="Unit" value={plateSystem.backScreen.thicknessUnit} onChange={(thicknessUnit) => setPlate('backScreen', { ...plateSystem.backScreen, thicknessUnit })} options={LENGTH_UNITS} />
          </div>
          <TextField
            label="Plate Erasure Requirement"
            value={plateSystem.erasureRequirement}
            onChange={(value) => setPlate('erasureRequirement', value)}
            placeholder="Required erasure before plate re-use"
          />
          <TextField
            label="Plate Condition Requirement"
            value={plateSystem.plateConditionRequirement}
            onChange={(value) => setPlate('plateConditionRequirement', value)}
            placeholder="Artifact inspection, fade, and retirement criteria"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">CR Scanner &amp; Readout</CardTitle>
          <p className="text-sm text-muted-foreground">
            The laser scanner and readout settings this technique is qualified with. Qualification evidence is
            required before approval.
          </p>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <TextField label="Scanner Manufacturer" value={scanner.manufacturer} onChange={(value) => setScanner('manufacturer', value)} />
          <TextField label="Scanner Model" value={scanner.model} onChange={(value) => setScanner('model', value)} />
          <TextField label="Scanner Serial Number" value={scanner.serialNumber} onChange={(value) => setScanner('serialNumber', value)} />
          <TextField
            label="Scanner Calibration Requirement"
            value={scanner.calibrationRequirement}
            onChange={(value) => setScanner('calibrationRequirement', value)}
            placeholder="Controlled requirement, interval, or reference"
          />
          <div className="grid grid-cols-[minmax(0,1fr)_7.5rem] gap-2">
            <NumberField label="Pixel Pitch" value={scanner.pixelPitch} onChange={(pixelPitch) => setScanner('pixelPitch', pixelPitch)} min={0} />
            <SelectField label="Unit" value={scanner.pixelPitchUnit} onChange={(pixelPitchUnit) => setScanner('pixelPitchUnit', pixelPitchUnit)} options={DETECTOR_LENGTH_UNITS} />
          </div>
          <div className="grid grid-cols-[minmax(0,1fr)_7.5rem] gap-2">
            <NumberField label="Laser Spot Size" value={scanner.laserSpotSize} onChange={(laserSpotSize) => setScanner('laserSpotSize', laserSpotSize)} min={0} />
            <SelectField label="Unit" value={scanner.laserSpotSizeUnit} onChange={(laserSpotSizeUnit) => setScanner('laserSpotSizeUnit', laserSpotSizeUnit)} options={DETECTOR_LENGTH_UNITS} />
          </div>
          <NumberField
            label="Planned Scan Resolution"
            value={scanner.scanResolutionPixelsPerMm}
            onChange={(scanResolutionPixelsPerMm) => setScanner('scanResolutionPixelsPerMm', scanResolutionPixelsPerMm)}
            min={0}
            unit="px/mm"
          />
          <TextField
            label="PMT Gain / Voltage Setting"
            value={scanner.pmtGainOrVoltage}
            onChange={(value) => setScanner('pmtGainOrVoltage', value)}
            placeholder="Recorded verbatim from the qualified setup"
          />
          <PerformanceTrendEditor
            title="Long-term performance trend (E2737-style)"
            description="Dated SRb / SNR measurements against the scanner qualification baseline. Append-only; chronological order is enforced."
            entries={scanner.performanceTrend}
            onChange={(entries) => {
              const { performanceTrend: _previous, ...rest } = scanner;
              onScannerChange(entries === null ? rest : { ...rest, performanceTrend: entries });
            }}
          />
          <div className="md:col-span-2 rounded-xl border border-border/70 bg-muted/20 p-4">
            <div className="text-sm font-semibold">Scanner qualification evidence</div>
            <p className="mt-1 text-xs text-muted-foreground">
              Reference, dates, and status of the scanner qualification this technique relies on. Approval requires
              a reference with real qualification and due dates.
            </p>
            <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2">
              <TextField label="Qualification Reference" value={scanner.qualification.reference} onChange={(value) => setQualification('reference', value)} />
              <TextField label="Qualification Status" value={scanner.qualification.status} onChange={(value) => setQualification('status', value)} />
              <DateField label="Qualification Date" value={scanner.qualification.date} onChange={(value) => setQualification('date', value)} />
              <DateField label="Qualification Due Date" value={scanner.qualification.dueDate} onChange={(value) => setQualification('dueDate', value)} />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
