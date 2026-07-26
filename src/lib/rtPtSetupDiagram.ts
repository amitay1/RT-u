export type RtRadiographySetupMode = 'film' | 'dda';

export type RtSetupLengthUnit = 'mm' | 'inch' | 'in';

export interface RtSetupLengthInput {
  value?: number | string | null;
  unit?: RtSetupLengthUnit | null;
}

export interface RtSetupDiagramDistances {
  sourceToReceptor?: RtSetupLengthInput | null;
  sourceToObject?: RtSetupLengthInput | null;
  objectToReceptor?: RtSetupLengthInput | null;
}

/**
 * Presentation-only input for a radiography setup schematic. It deliberately
 * stays independent of the controlled RT/PT document model.
 */
export interface RtSetupDiagramInput {
  mode: RtRadiographySetupMode;
  title?: string | null;
  sourceLabel?: string | null;
  partLabel?: string | null;
  receptorLabel?: string | null;
  viewId?: string | null;
  callout?: string | null;
  orientation?: string | null;
  inspectionZone?: string | null;
  iqiPlacement?: string | null;
  markerPlacement?: string | null;
  distances?: RtSetupDiagramDistances | null;
}

export type RtSetupDistanceCode = 'SFD' | 'SDD' | 'SOD' | 'OFD' | 'ODD';

export interface RtSetupDimensionDisplay {
  code: RtSetupDistanceCode;
  name: string;
  value: string;
  display: string;
  isSpecified: boolean;
}

export interface NormalizedRtSetupDiagram {
  mode: RtRadiographySetupMode;
  methodLabel: string;
  title: string;
  sourceHeading: string;
  sourceLabel: string;
  partLabel: string;
  receptorHeading: string;
  receptorLabel: string;
  viewId: string;
  callout: string;
  viewCallout: string;
  orientation: string;
  inspectionZone: string;
  iqiPlacement: string;
  markerPlacement: string;
  dimensions: {
    sourceToReceptor: RtSetupDimensionDisplay;
    sourceToObject: RtSetupDimensionDisplay;
    objectToReceptor: RtSetupDimensionDisplay;
  };
}

const NOT_SPECIFIED = 'Not specified';
const MAX_DISPLAY_TEXT_LENGTH = 96;
const NUMBER_FORMATTER = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 6,
  useGrouping: true,
});

const DECIMAL_NUMBER = /^(?:\d+(?:\.\d*)?|\.\d+)$/;

function isDisplayControlCharacter(character: string): boolean {
  const codePoint = character.codePointAt(0) ?? 0;
  return codePoint <= 0x1f
    || (codePoint >= 0x7f && codePoint <= 0x9f)
    || (codePoint >= 0x202a && codePoint <= 0x202e)
    || (codePoint >= 0x2066 && codePoint <= 0x2069);
}

function normalizeDisplayText(
  value: string | null | undefined,
  fallback: string,
): string {
  const normalized = Array.from(value ?? '')
    .map((character) => (isDisplayControlCharacter(character) ? ' ' : character))
    .join('')
    .replace(/\s+/g, ' ')
    .trim();

  if (!normalized) return fallback;
  if (normalized.length <= MAX_DISPLAY_TEXT_LENGTH) return normalized;
  return `${normalized.slice(0, MAX_DISPLAY_TEXT_LENGTH - 1).trimEnd()}…`;
}

function parseDisplayLength(value: RtSetupLengthInput['value']): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) && value >= 0 ? value : null;
  }

  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  if (!DECIMAL_NUMBER.test(normalized)) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function normalizeLengthUnit(unit: RtSetupLengthInput['unit']): string {
  if (unit === 'mm') return 'mm';
  if (unit === 'inch' || unit === 'in') return 'in';
  return '';
}

export function formatRtSetupLength(input?: RtSetupLengthInput | null): string {
  const parsed = parseDisplayLength(input?.value);
  if (parsed === null) return NOT_SPECIFIED;

  const value = NUMBER_FORMATTER.format(Object.is(parsed, -0) ? 0 : parsed);
  const unit = normalizeLengthUnit(input?.unit);
  return unit ? `${value} ${unit}` : value;
}

function dimension(
  code: RtSetupDistanceCode,
  name: string,
  input?: RtSetupLengthInput | null,
): RtSetupDimensionDisplay {
  const value = formatRtSetupLength(input);
  return {
    code,
    name,
    value,
    display: `${code} · ${value}`,
    isSpecified: value !== NOT_SPECIFIED,
  };
}

export function normalizeRtSetupDiagram(input: RtSetupDiagramInput): NormalizedRtSetupDiagram {
  const isFilm = input.mode === 'film';
  const methodLabel = isFilm ? 'RT Film' : 'RT Digital / DDA';
  const receptorHeading = isFilm ? 'Film / cassette' : 'DDA detector';
  const viewId = normalizeDisplayText(input.viewId, 'Unassigned view');
  const callout = normalizeDisplayText(input.callout, NOT_SPECIFIED);
  const viewCallout = callout === NOT_SPECIFIED ? viewId : `${viewId} · ${callout}`;

  return {
    mode: input.mode,
    methodLabel,
    title: normalizeDisplayText(input.title, `${methodLabel} setup`),
    sourceHeading: isFilm ? 'Radiation source' : 'X-ray source',
    sourceLabel: normalizeDisplayText(input.sourceLabel, 'Equipment not specified'),
    partLabel: normalizeDisplayText(input.partLabel, 'Test part'),
    receptorHeading,
    receptorLabel: normalizeDisplayText(input.receptorLabel, receptorHeading),
    viewId,
    callout,
    viewCallout,
    orientation: normalizeDisplayText(input.orientation, NOT_SPECIFIED),
    inspectionZone: normalizeDisplayText(input.inspectionZone, NOT_SPECIFIED),
    iqiPlacement: normalizeDisplayText(input.iqiPlacement, NOT_SPECIFIED),
    markerPlacement: normalizeDisplayText(input.markerPlacement, NOT_SPECIFIED),
    dimensions: {
      sourceToReceptor: dimension(
        isFilm ? 'SFD' : 'SDD',
        isFilm ? 'Source-to-film distance' : 'Source-to-detector distance',
        input.distances?.sourceToReceptor,
      ),
      sourceToObject: dimension(
        'SOD',
        'Source-to-object distance',
        input.distances?.sourceToObject,
      ),
      objectToReceptor: dimension(
        isFilm ? 'OFD' : 'ODD',
        isFilm ? 'Object-to-film distance' : 'Object-to-detector distance',
        input.distances?.objectToReceptor,
      ),
    },
  };
}
