import type {
  RtDigitalExposureSetup,
  RtDigitalSource,
} from '@/types/rtDigital';
import type {
  LengthUnit,
  RtFilmExposureSetup,
  RtFilmSource,
} from '@/types/rtFilm';

const INCH_TO_MM = 25.4;

export function lengthToMillimeters(value: number, unit: LengthUnit): number {
  return unit === 'inch' ? value * INCH_TO_MM : value;
}

export function millimetersToLength(value: number, unit: LengthUnit): number {
  return unit === 'inch' ? value / INCH_TO_MM : value;
}

const roundedRatio = (numerator: number, denominator: number): number => (
  Number((numerator / denominator).toFixed(4))
);

export function calculateFilmMagnification(exposure: RtFilmExposureSetup): number | '' {
  if (typeof exposure.sfd !== 'number' || typeof exposure.sod !== 'number') return '';
  const sfd = lengthToMillimeters(exposure.sfd, exposure.sfdUnit);
  const sod = lengthToMillimeters(exposure.sod, exposure.sodUnit);
  if (!Number.isFinite(sfd) || !Number.isFinite(sod) || sfd <= 0 || sod <= 0) return '';
  return roundedRatio(sfd, sod);
}

export function calculateDigitalMagnification(exposure: RtDigitalExposureSetup): number | '' {
  if (typeof exposure.sdd !== 'number' || typeof exposure.sod !== 'number') return '';
  const sdd = lengthToMillimeters(exposure.sdd, exposure.sddUnit);
  const sod = lengthToMillimeters(exposure.sod, exposure.sodUnit);
  if (!Number.isFinite(sdd) || !Number.isFinite(sod) || sdd <= 0 || sod <= 0) return '';
  return roundedRatio(sdd, sod);
}

export function applyFilmAutoMagnification(exposure: RtFilmExposureSetup): RtFilmExposureSetup {
  if (!exposure.geometricMagnificationAuto) return exposure;
  return { ...exposure, geometricMagnification: calculateFilmMagnification(exposure) };
}

export function applyDigitalAutoMagnification(exposure: RtDigitalExposureSetup): RtDigitalExposureSetup {
  if (!exposure.magnificationAuto) return exposure;
  return { ...exposure, magnification: calculateDigitalMagnification(exposure) };
}

export function calculateGeometricUnsharpness(
  sourceSize: number | '',
  sourceSizeUnit: LengthUnit,
  objectToImageDistance: number | '',
  objectToImageDistanceUnit: LengthUnit,
  sourceToObjectDistance: number | '',
  sourceToObjectDistanceUnit: LengthUnit,
  outputUnit: LengthUnit,
): number | '' {
  if (
    typeof sourceSize !== 'number'
    || typeof objectToImageDistance !== 'number'
    || typeof sourceToObjectDistance !== 'number'
  ) return '';
  const sourceSizeMm = lengthToMillimeters(sourceSize, sourceSizeUnit);
  const objectToImageMm = lengthToMillimeters(objectToImageDistance, objectToImageDistanceUnit);
  const sourceToObjectMm = lengthToMillimeters(sourceToObjectDistance, sourceToObjectDistanceUnit);
  if (
    !Number.isFinite(sourceSizeMm)
    || !Number.isFinite(objectToImageMm)
    || !Number.isFinite(sourceToObjectMm)
    || sourceSizeMm <= 0
    || objectToImageMm < 0
    || sourceToObjectMm <= 0
  ) return '';
  return millimetersToLength(sourceSizeMm * objectToImageMm / sourceToObjectMm, outputUnit);
}

export function calculateFilmGeometricUnsharpness(
  exposure: RtFilmExposureSetup,
  source: RtFilmSource,
): number | '' {
  if (source.sourceType === 'X-ray') {
    return calculateGeometricUnsharpness(
      source.xRay.focalSpotSize,
      source.xRay.focalSpotSizeUnit,
      exposure.ofd,
      exposure.ofdUnit,
      exposure.sod,
      exposure.sodUnit,
      exposure.requiredUgUnit,
    );
  }
  if (source.sourceType === 'Gamma') {
    return calculateGeometricUnsharpness(
      source.gamma.effectiveSourceSize,
      source.gamma.effectiveSourceSizeUnit,
      exposure.ofd,
      exposure.ofdUnit,
      exposure.sod,
      exposure.sodUnit,
      exposure.requiredUgUnit,
    );
  }
  return '';
}

export function calculateDigitalGeometricUnsharpness(
  acquisition: RtDigitalExposureSetup,
  source: RtDigitalSource,
): number | '' {
  return source.sourceType === 'X-ray'
    ? calculateGeometricUnsharpness(
      source.focalSpotSize,
      source.focalSpotSizeUnit,
      acquisition.odd,
      acquisition.oddUnit,
      acquisition.sod,
      acquisition.sodUnit,
      acquisition.requiredUgUnit,
    )
    : '';
}
