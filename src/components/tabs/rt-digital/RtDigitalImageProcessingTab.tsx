import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { RtDigitalDisplayAndStorage, RtDigitalImageProcessing } from '@/types/rtDigital';
import { NumberField, TextAreaField, TextField } from '@/components/tabs/shared/FieldRow';

interface Props {
  data: RtDigitalImageProcessing;
  onChange: (data: RtDigitalImageProcessing) => void;
  displayAndStorage: RtDigitalDisplayAndStorage;
  onDisplayAndStorageChange: (data: RtDigitalDisplayAndStorage) => void;
}

export const RtDigitalImageProcessingTab = ({
  data,
  onChange,
  displayAndStorage,
  onDisplayAndStorageChange,
}: Props) => {
  const setProcessing = <K extends keyof RtDigitalImageProcessing>(
    key: K,
    value: RtDigitalImageProcessing[K],
  ) => onChange({ ...data, [key]: value });

  const setDisplayAndStorage = <K extends keyof RtDigitalDisplayAndStorage>(
    key: K,
    value: RtDigitalDisplayAndStorage[K],
  ) => onDisplayAndStorageChange({ ...displayAndStorage, [key]: value });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>5. Image Processing Plan</CardTitle>
          <p className="text-sm text-muted-foreground">
            Define the permitted review settings and controlled processing procedure without recording achieved results.
          </p>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <NumberField label="Window Level" value={data.windowLevel} onChange={(value) => setProcessing('windowLevel', value)} />
          <NumberField label="Window Width" value={data.windowWidth} onChange={(value) => setProcessing('windowWidth', value)} min={0} />
          <NumberField label="Zoom" value={data.zoom} onChange={(value) => setProcessing('zoom', value)} unit="%" min={0} />
          <TextField
            label="Noise Reduction"
            value={data.noiseReduction}
            onChange={(value) => setProcessing('noiseReduction', value)}
            placeholder="Permitted method or setting"
          />
          <TextField
            label="Contrast Enhancement"
            value={data.contrastEnhancement}
            onChange={(value) => setProcessing('contrastEnhancement', value)}
            placeholder="Permitted method or setting"
          />
          <TextField
            label="Processing Procedure"
            value={data.processingProcedure}
            onChange={(value) => setProcessing('processingProcedure', value)}
            placeholder="Controlled procedure and revision"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Display &amp; Review System</CardTitle>
          <p className="text-sm text-muted-foreground">
            Identify the qualified display and viewer configuration required to review the images.
          </p>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <TextField
            label="Display Manufacturer"
            value={displayAndStorage.displayManufacturer}
            onChange={(value) => setDisplayAndStorage('displayManufacturer', value)}
          />
          <TextField
            label="Display Model"
            value={displayAndStorage.displayModel}
            onChange={(value) => setDisplayAndStorage('displayModel', value)}
          />
          <TextField
            label="Display Serial Number"
            value={displayAndStorage.displaySerialNumber}
            onChange={(value) => setDisplayAndStorage('displaySerialNumber', value)}
          />
          <TextField
            label="Viewer Software"
            value={displayAndStorage.viewerSoftware}
            onChange={(value) => setDisplayAndStorage('viewerSoftware', value)}
          />
          <TextField
            label="Viewer Software Version"
            value={displayAndStorage.viewerSoftwareVersion}
            onChange={(value) => setDisplayAndStorage('viewerSoftwareVersion', value)}
          />
          <TextField
            label="Display Qualification Reference"
            value={displayAndStorage.displayQualificationReference}
            onChange={(value) => setDisplayAndStorage('displayQualificationReference', value)}
            placeholder="Controlled qualification record"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Storage, Archive &amp; Raw Data</CardTitle>
          <p className="text-sm text-muted-foreground">
            Define the planned record format, archive controls, retention, and preservation of original detector data.
          </p>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <TextField
            label="Storage Format"
            value={displayAndStorage.storageFormat}
            onChange={(value) => setDisplayAndStorage('storageFormat', value)}
            placeholder="Controlled format or format set"
          />
          <TextField
            label="Archive Location"
            value={displayAndStorage.archiveLocation}
            onChange={(value) => setDisplayAndStorage('archiveLocation', value)}
          />
          <TextField
            label="Retention Period"
            value={displayAndStorage.retentionPeriod}
            onChange={(value) => setDisplayAndStorage('retentionPeriod', value)}
          />
          <TextField
            label="DICONDE Profile Reference"
            value={displayAndStorage.dicondeProfileReference}
            onChange={(value) => setDisplayAndStorage('dicondeProfileReference', value)}
            placeholder="Applicable profile, procedure, or project reference"
            hint="free-text reference, not a compliance selection"
          />
          <TextAreaField
            label="Raw Data Preservation"
            value={displayAndStorage.rawDataPreservation}
            onChange={(value) => setDisplayAndStorage('rawDataPreservation', value)}
            placeholder="Required preservation, access, and change-control instructions"
            rows={4}
          />
        </CardContent>
      </Card>
    </div>
  );
};
