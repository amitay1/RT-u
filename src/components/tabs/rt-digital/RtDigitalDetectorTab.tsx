import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { RtDigitalDetector } from '@/types/rtDigital';
import { NumberField, SelectField } from '@/components/tabs/shared/FieldRow';

interface Props {
  data: RtDigitalDetector;
  onChange: (d: RtDigitalDetector) => void;
}

export const RtDigitalDetectorTab = ({ data, onChange }: Props) => {
  const set = <K extends keyof RtDigitalDetector>(k: K, v: RtDigitalDetector[K]) =>
    onChange({ ...data, [k]: v });

  return (
    <Card>
      <CardHeader>
        <CardTitle>4. Detector &amp; Imaging</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <NumberField label="Spatial Resolution (SRb)" value={data.spatialResolutionSRb} onChange={v => set('spatialResolutionSRb', v)} unit="µm" step="0.1" />
        <NumberField label="Pixel Density" value={data.pixelDensity} onChange={v => set('pixelDensity', v)} unit="pixels/mm" step="0.1" />
        <NumberField label="Image Unsharpness" value={data.imageUnsharpness} onChange={v => set('imageUnsharpness', v)} unit="mm" step="0.001" />
        <SelectField label="Bad Pixel Correction" value={data.badPixelCorrection} onChange={v => set('badPixelCorrection', v)} options={['Yes', 'No']} />
        <SelectField label="Detector Corrections" value={data.detectorCorrections} onChange={v => set('detectorCorrections', v)} options={['Gain', 'Offset', 'Gain + Offset']} />
      </CardContent>
    </Card>
  );
};
