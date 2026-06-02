import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { RtDigitalImageProcessing } from '@/types/rtDigital';
import { NumberField, SelectField } from '@/components/tabs/shared/FieldRow';

interface Props {
  data: RtDigitalImageProcessing;
  onChange: (d: RtDigitalImageProcessing) => void;
}

export const RtDigitalImageProcessingTab = ({ data, onChange }: Props) => {
  const set = <K extends keyof RtDigitalImageProcessing>(k: K, v: RtDigitalImageProcessing[K]) =>
    onChange({ ...data, [k]: v });

  return (
    <Card>
      <CardHeader>
        <CardTitle>5. Image Processing</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <NumberField label="Window Level" value={data.windowLevel} onChange={v => set('windowLevel', v)} />
        <NumberField label="Window Width" value={data.windowWidth} onChange={v => set('windowWidth', v)} />
        <NumberField label="Zoom" value={data.zoom} onChange={v => set('zoom', v)} unit="%" />
        <SelectField label="Noise Reduction" value={data.noiseReduction} onChange={v => set('noiseReduction', v)} options={['None', 'Low', 'Medium', 'High']} />
        <SelectField label="Contrast Enhancement" value={data.contrastEnhancement} onChange={v => set('contrastEnhancement', v)} options={['On', 'Off']} />
        <SelectField label="Image Format" value={data.imageFormat} onChange={v => set('imageFormat', v)} options={['DICONDE', 'TIFF']} />
      </CardContent>
    </Card>
  );
};
