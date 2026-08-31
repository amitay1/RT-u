import {
  calculateDigitalGeometricUnsharpness,
  calculateFilmGeometricUnsharpness,
} from '@/lib/rtGeometry';
import type { RtPtWorkflowValidation } from '@/lib/rtPtWorkflow';
import type { LengthUnit, NumberOrEmpty } from '@/types/rtFilm';
import type { RtPtDocument, RtPtDocumentStatus } from '@/types/rtPtDocument';

/**
 * Read model behind the radiographic process overview. It restates the six
 * planning stages of an RT technique with the values the operator has actually
 * entered, so the illustrated pipeline is backed by the live document rather
 * than by sample text. Penetrant techniques have no radiographic pipeline and
 * are reported as `null`.
 */

export type RtProcessStageId =
  | 'part'
  | 'geometry'
  | 'unsharpness'
  | 'exposure'
  | 'detector'
  | 'card';

/** Completeness of the values this stage displays — never a compliance verdict. */
export type RtProcessStageStatus = 'complete' | 'partial' | 'pending';

export interface RtProcessStageMetric {
  label: string;
  /** `null` marks a value the operator has not entered yet. */
  value: string | null;
}

export interface RtProcessStage {
  id: RtProcessStageId;
  /** 1-based position in the illustrated pipeline. */
  step: number;
  title: string;
  caption: string;
  headline: string | null;
  headlineLabel: string;
  metrics: RtProcessStageMetric[];
  status: RtProcessStageStatus;
  filledCount: number;
  totalCount: number;
  /** Workspace tab that owns these values. */
  targetTab: string;
  targetTabLabel: string;
}

export type RtProcessCalloutId = 'source' | 'part' | 'detector' | 'geometry';

export interface RtProcessCallout {
  id: RtProcessCalloutId;
  label: string;
  primary: string | null;
  secondary: string | null;
}

export interface RtProcessOverviewSnapshot {
  methodLabel: string;
  documentStatus: RtPtDocumentStatus;
  stages: RtProcessStage[];
  callouts: RtProcessCallout[];
  completeStages: number;
  totalStages: number;
  /** Stages carrying at least one entered value — drives the hero callout default. */
  populatedStages: number;
  completionPercent: number;
  completedFieldsCount: number;
  totalRequiredFields: number;
}

const measureFormatter = new Intl.NumberFormat('en-US', { maximumFractionDigits: 3 });

const lengthUnitLabel = (unit: LengthUnit): string => (unit === 'inch' ? 'in' : 'mm');

const formatMeasure = (value: NumberOrEmpty, unit: string): string | null => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return `${measureFormatter.format(value)} ${unit}`.trim();
};

const formatLength = (value: NumberOrEmpty, unit: LengthUnit): string | null =>
  formatMeasure(value, lengthUnitLabel(unit));

const formatRatio = (value: NumberOrEmpty): string | null => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return `${measureFormatter.format(value)}×`;
};

const text = (value: string | null | undefined): string | null => {
  const trimmed = (value ?? '').trim();
  return trimmed.length > 0 ? trimmed : null;
};

/** Joins the parts the operator has filled in; `null` when none of them are set. */
const join = (...values: Array<string | null | undefined>): string | null => {
  const parts = values
    .map((value) => (value ?? '').trim())
    .filter((value) => value.length > 0);
  return parts.length > 0 ? parts.join(' · ') : null;
};

const countFilled = (values: Array<string | null>): number =>
  values.filter((value) => value !== null).length;

const stageStatus = (filled: number, total: number): RtProcessStageStatus => {
  if (total > 0 && filled >= total) return 'complete';
  return filled > 0 ? 'partial' : 'pending';
};

const buildStage = (
  base: Omit<RtProcessStage, 'status' | 'filledCount' | 'totalCount'>,
): RtProcessStage => {
  const tracked = [base.headline, ...base.metrics.map((metric) => metric.value)];
  const filledCount = countFilled(tracked);
  return {
    ...base,
    filledCount,
    totalCount: tracked.length,
    status: stageStatus(filledCount, tracked.length),
  };
};

/**
 * Preferred required-Ug limit. The exposure setup and the image-quality section
 * can both carry one, in their own units, so the exposure value wins and the
 * IQI value is the fallback rather than being silently converted.
 */
const resolveRequiredUg = (
  exposureUg: NumberOrEmpty,
  exposureUgUnit: LengthUnit,
  iqiUg: NumberOrEmpty,
  iqiUgUnit: LengthUnit,
): string | null => formatLength(exposureUg, exposureUgUnit) ?? formatLength(iqiUg, iqiUgUnit);

function buildFilmOverview(
  techniqueDocument: Extract<RtPtDocument, { method: 'RT-Film' }>,
): { stages: RtProcessStage[]; callouts: RtProcessCallout[] } {
  const { general, exposureDefaults: exposure, source, filmSystem, iqi, exposureViews } =
    techniqueDocument.technique;
  const { documentControl } = techniqueDocument;

  const isGamma = source.sourceType === 'Gamma';
  const sourceLabel = isGamma
    ? join(text(source.gamma.isotope), text(source.gamma.sourceId))
    : join(text(source.manufacturer), text(source.model));
  const sourceSize = isGamma
    ? formatLength(source.gamma.effectiveSourceSize, source.gamma.effectiveSourceSizeUnit)
    : formatLength(source.xRay.focalSpotSize, source.xRay.focalSpotSizeUnit);
  const sourceSizeLabel = isGamma ? 'Effective source size' : 'Focal spot';

  const calculatedUg = formatLength(
    calculateFilmGeometricUnsharpness(exposure, source),
    exposure.requiredUgUnit,
  );
  const requiredUg = resolveRequiredUg(
    exposure.requiredUg,
    exposure.requiredUgUnit,
    iqi.requiredUg,
    iqi.requiredUgUnit,
  );

  const energy = isGamma
    ? join(text(source.gamma.isotope), formatMeasure(source.gamma.activity, source.gamma.activityUnit))
    : formatMeasure(exposure.tubeVoltage, exposure.tubeVoltageUnit);
  const energyLabel = isGamma ? 'Isotope / activity' : 'Tube voltage';
  const exposureTime = formatMeasure(exposure.exposureTime, exposure.exposureTimeUnit);

  const receptorLabel = join(text(filmSystem.filmDesignation), text(filmSystem.filmClass));
  const viewCount = exposureViews.length;

  const stages: RtProcessStage[] = [
    buildStage({
      id: 'part',
      step: 1,
      title: 'Casting selection',
      caption: 'Part, material and wall covered by this technique.',
      headlineLabel: 'Part',
      headline: join(text(general.partName), text(general.partNumber)),
      metrics: [
        { label: 'Material', value: text(general.material) },
        { label: 'Wall thickness', value: formatLength(general.thickness, general.thicknessUnit) },
      ],
      targetTab: 'general',
      targetTabLabel: 'General',
    }),
    buildStage({
      id: 'geometry',
      step: 2,
      title: 'Geometry & distances',
      caption: 'Source, object and film plane positions for the shot.',
      headlineLabel: 'SFD',
      headline: formatLength(exposure.sfd, exposure.sfdUnit),
      metrics: [
        { label: 'SOD', value: formatLength(exposure.sod, exposure.sodUnit) },
        { label: 'OFD', value: formatLength(exposure.ofd, exposure.ofdUnit) },
        { label: 'Magnification', value: formatRatio(exposure.geometricMagnification) },
      ],
      targetTab: 'exposure',
      targetTabLabel: 'Exposure Defaults',
    }),
    buildStage({
      id: 'unsharpness',
      step: 3,
      title: 'Ug calculation',
      caption: 'Geometric unsharpness against the required limit.',
      headlineLabel: 'Calculated Ug',
      headline: calculatedUg,
      metrics: [
        { label: 'Required max Ug', value: requiredUg },
        { label: sourceSizeLabel, value: sourceSize },
      ],
      targetTab: 'iqc',
      targetTabLabel: 'Image Quality',
    }),
    buildStage({
      id: 'exposure',
      step: 4,
      title: 'Exposure selection',
      caption: 'Energy, current and time for the qualified exposure.',
      headlineLabel: energyLabel,
      headline: energy,
      metrics: [
        {
          label: isGamma ? 'Exposure time' : 'Tube current',
          value: isGamma ? exposureTime : formatMeasure(exposure.tubeCurrent, exposure.tubeCurrentUnit),
        },
        {
          label: isGamma ? 'Wall technique' : 'Exposure time',
          value: isGamma ? text(exposure.wallTechnique) : exposureTime,
        },
      ],
      targetTab: 'exposure',
      targetTabLabel: 'Exposure Defaults',
    }),
    buildStage({
      id: 'detector',
      step: 5,
      title: 'Film position & overlap',
      caption: 'Cassette placement and coverage across the exposure views.',
      headlineLabel: 'Exposure views',
      headline: viewCount > 0 ? `${viewCount} view${viewCount === 1 ? '' : 's'}` : null,
      metrics: [
        { label: 'Overlap', value: text(exposure.overlap) },
        { label: 'Film size', value: text(exposure.filmSize) },
      ],
      targetTab: 'views',
      targetTabLabel: 'Exposure Views',
    }),
    buildStage({
      id: 'card',
      step: 6,
      title: 'Technique card',
      caption: 'Controlled document identity and release control.',
      headlineLabel: 'Document',
      headline: join(
        text(documentControl.number),
        documentControl.revision.trim() ? `Rev ${documentControl.revision.trim()}` : null,
      ),
      metrics: [
        { label: 'Title', value: text(documentControl.title) },
        { label: 'Effective date', value: text(documentControl.effectiveDate) },
      ],
      targetTab: 'control',
      targetTabLabel: 'Control & Approval',
    }),
  ];

  const callouts: RtProcessCallout[] = [
    {
      id: 'source',
      label: isGamma ? 'Gamma source' : 'X-ray source',
      primary: sourceLabel,
      secondary: join(sourceSize ? `${sourceSizeLabel} ${sourceSize}` : null, energy),
    },
    {
      id: 'part',
      label: 'Part',
      primary: join(text(general.partName), text(general.partNumber)),
      secondary: join(
        text(general.material),
        formatLength(general.thickness, general.thicknessUnit),
      ),
    },
    {
      id: 'detector',
      label: 'Film system',
      primary: receptorLabel,
      secondary: join(text(exposure.filmSize), text(filmSystem.manufacturer)),
    },
    {
      id: 'geometry',
      label: 'Geometry',
      primary: formatLength(exposure.sfd, exposure.sfdUnit)
        ? `SFD ${formatLength(exposure.sfd, exposure.sfdUnit)}`
        : null,
      secondary: join(
        formatLength(exposure.sod, exposure.sodUnit) ? `SOD ${formatLength(exposure.sod, exposure.sodUnit)}` : null,
        formatLength(exposure.ofd, exposure.ofdUnit) ? `OFD ${formatLength(exposure.ofd, exposure.ofdUnit)}` : null,
      ),
    },
  ];

  return { stages, callouts };
}

function buildCrOverview(
  techniqueDocument: Extract<RtPtDocument, { method: 'RT-CR' }>,
): { stages: RtProcessStage[]; callouts: RtProcessCallout[] } {
  const { general, exposureDefaults: exposure, source, plateSystem, scanner, iqi, exposureViews } =
    techniqueDocument.technique;
  const { documentControl } = techniqueDocument;

  const isGamma = source.sourceType === 'Gamma';
  const sourceLabel = isGamma
    ? join(text(source.gamma.isotope), text(source.gamma.sourceId))
    : join(text(source.manufacturer), text(source.model));
  const sourceSize = isGamma
    ? formatLength(source.gamma.effectiveSourceSize, source.gamma.effectiveSourceSizeUnit)
    : formatLength(source.xRay.focalSpotSize, source.xRay.focalSpotSizeUnit);
  const sourceSizeLabel = isGamma ? 'Effective source size' : 'Focal spot';

  const calculatedUg = formatLength(
    calculateFilmGeometricUnsharpness(exposure, source),
    exposure.requiredUgUnit,
  );
  const requiredUg = resolveRequiredUg(
    exposure.requiredUg,
    exposure.requiredUgUnit,
    iqi.requiredUg,
    iqi.requiredUgUnit,
  );

  const energy = isGamma
    ? join(text(source.gamma.isotope), formatMeasure(source.gamma.activity, source.gamma.activityUnit))
    : formatMeasure(exposure.tubeVoltage, exposure.tubeVoltageUnit);
  const energyLabel = isGamma ? 'Isotope / activity' : 'Tube voltage';
  const exposureTime = formatMeasure(exposure.exposureTime, exposure.exposureTimeUnit);

  const receptorLabel = join(text(plateSystem.plateDesignation), text(plateSystem.plateClass));
  const viewCount = exposureViews.length;

  const stages: RtProcessStage[] = [
    buildStage({
      id: 'part',
      step: 1,
      title: 'Casting selection',
      caption: 'Part, material and wall covered by this technique.',
      headlineLabel: 'Part',
      headline: join(text(general.partName), text(general.partNumber)),
      metrics: [
        { label: 'Material', value: text(general.material) },
        { label: 'Wall thickness', value: formatLength(general.thickness, general.thicknessUnit) },
      ],
      targetTab: 'general',
      targetTabLabel: 'General',
    }),
    buildStage({
      id: 'geometry',
      step: 2,
      title: 'Geometry & distances',
      caption: 'Source, object and imaging-plate positions for the shot.',
      headlineLabel: 'SFD',
      headline: formatLength(exposure.sfd, exposure.sfdUnit),
      metrics: [
        { label: 'SOD', value: formatLength(exposure.sod, exposure.sodUnit) },
        { label: 'OFD', value: formatLength(exposure.ofd, exposure.ofdUnit) },
        { label: 'Magnification', value: formatRatio(exposure.geometricMagnification) },
      ],
      targetTab: 'exposure',
      targetTabLabel: 'Exposure Defaults',
    }),
    buildStage({
      id: 'unsharpness',
      step: 3,
      title: 'Ug calculation',
      caption: 'Geometric unsharpness against the required limit.',
      headlineLabel: 'Calculated Ug',
      headline: calculatedUg,
      metrics: [
        { label: 'Required max Ug', value: requiredUg },
        { label: sourceSizeLabel, value: sourceSize },
      ],
      targetTab: 'iqc',
      targetTabLabel: 'Image Quality',
    }),
    buildStage({
      id: 'exposure',
      step: 4,
      title: 'Exposure selection',
      caption: 'Energy, current and time for the qualified exposure.',
      headlineLabel: energyLabel,
      headline: energy,
      metrics: [
        {
          label: isGamma ? 'Exposure time' : 'Tube current',
          value: isGamma ? exposureTime : formatMeasure(exposure.tubeCurrent, exposure.tubeCurrentUnit),
        },
        {
          label: isGamma ? 'Wall technique' : 'Exposure time',
          value: isGamma ? text(exposure.wallTechnique) : exposureTime,
        },
      ],
      targetTab: 'exposure',
      targetTabLabel: 'Exposure Defaults',
    }),
    buildStage({
      id: 'detector',
      step: 5,
      title: 'Plate position & scan',
      caption: 'Imaging-plate placement, coverage and readout across the views.',
      headlineLabel: 'Exposure views',
      headline: viewCount > 0 ? `${viewCount} view${viewCount === 1 ? '' : 's'}` : null,
      metrics: [
        { label: 'Overlap', value: text(exposure.overlap) },
        { label: 'Scan resolution', value: formatMeasure(scanner.scanResolutionPixelsPerMm, 'px/mm') },
      ],
      targetTab: 'views',
      targetTabLabel: 'Exposure Views',
    }),
    buildStage({
      id: 'card',
      step: 6,
      title: 'Technique card',
      caption: 'Controlled document identity and release control.',
      headlineLabel: 'Document',
      headline: join(
        text(documentControl.number),
        documentControl.revision.trim() ? `Rev ${documentControl.revision.trim()}` : null,
      ),
      metrics: [
        { label: 'Title', value: text(documentControl.title) },
        { label: 'Effective date', value: text(documentControl.effectiveDate) },
      ],
      targetTab: 'control',
      targetTabLabel: 'Control & Approval',
    }),
  ];

  const callouts: RtProcessCallout[] = [
    {
      id: 'source',
      label: isGamma ? 'Gamma source' : 'X-ray source',
      primary: sourceLabel,
      secondary: join(sourceSize ? `${sourceSizeLabel} ${sourceSize}` : null, energy),
    },
    {
      id: 'part',
      label: 'Part',
      primary: join(text(general.partName), text(general.partNumber)),
      secondary: join(
        text(general.material),
        formatLength(general.thickness, general.thicknessUnit),
      ),
    },
    {
      id: 'detector',
      label: 'Imaging plate',
      primary: receptorLabel,
      secondary: join(text(exposure.plateSize), text(plateSystem.manufacturer)),
    },
    {
      id: 'geometry',
      label: 'Geometry',
      primary: formatLength(exposure.sfd, exposure.sfdUnit)
        ? `SFD ${formatLength(exposure.sfd, exposure.sfdUnit)}`
        : null,
      secondary: join(
        formatLength(exposure.sod, exposure.sodUnit) ? `SOD ${formatLength(exposure.sod, exposure.sodUnit)}` : null,
        formatLength(exposure.ofd, exposure.ofdUnit) ? `OFD ${formatLength(exposure.ofd, exposure.ofdUnit)}` : null,
      ),
    },
  ];

  return { stages, callouts };
}

function buildDigitalOverview(
  techniqueDocument: Extract<RtPtDocument, { method: 'RT-Digital' }>,
): { stages: RtProcessStage[]; callouts: RtProcessCallout[] } {
  const {
    general,
    acquisitionDefaults: acquisition,
    source,
    system,
    iqi,
    acquisitions,
  } = techniqueDocument.technique;
  const { documentControl } = techniqueDocument;

  const focalSpot = formatLength(source.focalSpotSize, source.focalSpotSizeUnit);
  const calculatedUg = formatLength(
    calculateDigitalGeometricUnsharpness(acquisition, source),
    acquisition.requiredUgUnit,
  );
  const requiredUg = resolveRequiredUg(
    acquisition.requiredUg,
    acquisition.requiredUgUnit,
    iqi.requiredUg,
    iqi.requiredUgUnit,
  );
  const tubeVoltage = formatMeasure(acquisition.tubeVoltage, acquisition.tubeVoltageUnit);
  const acquisitionCount = acquisitions.length;
  const detectorLabel = join(text(system.manufacturer), text(system.model));
  const pixelSize = formatMeasure(system.pixelSize, system.pixelSizeUnit === 'um' ? 'µm' : system.pixelSizeUnit);

  const stages: RtProcessStage[] = [
    buildStage({
      id: 'part',
      step: 1,
      title: 'Casting selection',
      caption: 'Part, material and wall covered by this technique.',
      headlineLabel: 'Part',
      headline: join(text(general.partName), text(general.partNumber)),
      metrics: [
        { label: 'Material', value: text(general.material) },
        { label: 'Wall thickness', value: formatLength(general.thickness, general.thicknessUnit) },
      ],
      targetTab: 'general',
      targetTabLabel: 'General',
    }),
    buildStage({
      id: 'geometry',
      step: 2,
      title: 'Geometry & distances',
      caption: 'Source, object and detector positions for the shot.',
      headlineLabel: 'SDD',
      headline: formatLength(acquisition.sdd, acquisition.sddUnit),
      metrics: [
        { label: 'SOD', value: formatLength(acquisition.sod, acquisition.sodUnit) },
        { label: 'ODD', value: formatLength(acquisition.odd, acquisition.oddUnit) },
        { label: 'Magnification', value: formatRatio(acquisition.magnification) },
      ],
      targetTab: 'exposure',
      targetTabLabel: 'Exposure Defaults',
    }),
    buildStage({
      id: 'unsharpness',
      step: 3,
      title: 'Ug calculation',
      caption: 'Geometric unsharpness against the required limit.',
      headlineLabel: 'Calculated Ug',
      headline: calculatedUg,
      metrics: [
        { label: 'Required max Ug', value: requiredUg },
        { label: 'Focal spot', value: focalSpot },
      ],
      targetTab: 'iqc',
      targetTabLabel: 'Image Quality',
    }),
    buildStage({
      id: 'exposure',
      step: 4,
      title: 'Exposure selection',
      caption: 'Energy, current and integration for the acquisition.',
      headlineLabel: 'Tube voltage',
      headline: tubeVoltage,
      metrics: [
        { label: 'Tube current', value: formatMeasure(acquisition.tubeCurrent, acquisition.tubeCurrentUnit) },
        { label: 'Exposure time', value: formatMeasure(acquisition.exposureTime, acquisition.exposureTimeUnit) },
      ],
      targetTab: 'exposure',
      targetTabLabel: 'Exposure Defaults',
    }),
    buildStage({
      id: 'detector',
      step: 5,
      title: 'Detector position & overlap',
      caption: 'Detector placement and coverage across the acquisitions.',
      headlineLabel: 'Acquisitions',
      headline: acquisitionCount > 0
        ? `${acquisitionCount} acquisition${acquisitionCount === 1 ? '' : 's'}`
        : null,
      metrics: [
        { label: 'Coverage', value: text(acquisition.coverage) },
        { label: 'Detector', value: detectorLabel },
      ],
      targetTab: 'acquisitions',
      targetTabLabel: 'Acquisition Plan',
    }),
    buildStage({
      id: 'card',
      step: 6,
      title: 'Technique card',
      caption: 'Controlled document identity and release control.',
      headlineLabel: 'Document',
      headline: join(
        text(documentControl.number),
        documentControl.revision.trim() ? `Rev ${documentControl.revision.trim()}` : null,
      ),
      metrics: [
        { label: 'Title', value: text(documentControl.title) },
        { label: 'Effective date', value: text(documentControl.effectiveDate) },
      ],
      targetTab: 'control',
      targetTabLabel: 'Control & Approval',
    }),
  ];

  const callouts: RtProcessCallout[] = [
    {
      id: 'source',
      label: 'X-ray source',
      primary: join(text(source.manufacturer), text(source.model)),
      secondary: join(focalSpot ? `Focal spot ${focalSpot}` : null, tubeVoltage),
    },
    {
      id: 'part',
      label: 'Part',
      primary: join(text(general.partName), text(general.partNumber)),
      secondary: join(
        text(general.material),
        formatLength(general.thickness, general.thicknessUnit),
      ),
    },
    {
      id: 'detector',
      label: 'Detector',
      primary: detectorLabel,
      secondary: join(pixelSize ? `Pixel ${pixelSize}` : null, text(system.ddaType)),
    },
    {
      id: 'geometry',
      label: 'Geometry',
      primary: formatLength(acquisition.sdd, acquisition.sddUnit)
        ? `SDD ${formatLength(acquisition.sdd, acquisition.sddUnit)}`
        : null,
      secondary: join(
        formatLength(acquisition.sod, acquisition.sodUnit) ? `SOD ${formatLength(acquisition.sod, acquisition.sodUnit)}` : null,
        formatLength(acquisition.odd, acquisition.oddUnit) ? `ODD ${formatLength(acquisition.odd, acquisition.oddUnit)}` : null,
      ),
    },
  ];

  return { stages, callouts };
}

const METHOD_LABEL: Record<'RT-Film' | 'RT-Digital' | 'RT-CR', string> = {
  'RT-Film': 'RT Film',
  'RT-Digital': 'RT Digital / DDA',
  'RT-CR': 'RT Computed Radiography',
};

/** Returns `null` for penetrant techniques, which have no radiographic pipeline. */
export function buildRtProcessOverview(
  techniqueDocument: RtPtDocument,
  validation: RtPtWorkflowValidation,
): RtProcessOverviewSnapshot | null {
  if (techniqueDocument.method === 'PT') return null;

  const { stages, callouts } = techniqueDocument.method === 'RT-Film'
    ? buildFilmOverview(techniqueDocument)
    : techniqueDocument.method === 'RT-CR'
      ? buildCrOverview(techniqueDocument)
      : buildDigitalOverview(techniqueDocument);

  return {
    methodLabel: METHOD_LABEL[techniqueDocument.method],
    documentStatus: techniqueDocument.status,
    stages,
    callouts,
    completeStages: stages.filter((stage) => stage.status === 'complete').length,
    totalStages: stages.length,
    populatedStages: stages.filter((stage) => stage.filledCount > 0).length,
    completionPercent: validation.completionPercent,
    completedFieldsCount: validation.completedFieldsCount,
    totalRequiredFields: validation.totalRequiredFields,
  };
}
