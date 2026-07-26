import {
  fingerprintRtPtApprovedContent,
  hasValidRtPtApprovalFingerprint,
} from '@/lib/rtPtDocumentCodec';
import { createRtPtInspectionReport } from '@/lib/rtPtInspectionReport';
import { validateRtPtDocument } from '@/lib/rtPtValidation';
import type { RtPtDocumentV3 } from '@/types/rtPtDocument';
import type {
  RtPtInspectionReportV1,
  RtPtReportApproval,
} from '@/types/rtPtInspectionReport';

export interface RtPtInspectionReportIssue {
  path: string;
  label: string;
  section: 'control' | 'traceability' | 'equipment' | 'results' | 'indications' | 'disposition' | 'approvals' | 'link';
  message: string;
  severity: 'error' | 'warning';
}

export interface RtPtInspectionReportValidation {
  completedFieldsCount: number;
  totalRequiredFields: number;
  completionPercent: number;
  isComplete: boolean;
  isApprovalReady: boolean;
  linkCurrent: boolean;
  issues: RtPtInspectionReportIssue[];
}

interface Requirement {
  path: string;
  label: string;
  section: RtPtInspectionReportIssue['section'];
  complete: boolean;
  message: string;
}

const present = (value: unknown): boolean => (
  typeof value === 'number'
    ? Number.isFinite(value)
    : typeof value === 'string'
      ? value.trim().length > 0
      : typeof value === 'boolean'
        ? true
        : value !== null && value !== undefined
);

const positive = (value: unknown): boolean => typeof value === 'number' && Number.isFinite(value) && value > 0;
const meaningful = (value: unknown): boolean => typeof value === 'string' && value.trim().length >= 2;
const normalizedText = (value: unknown): string => (
  typeof value === 'string' ? value.trim().toLocaleLowerCase().replace(/\s+/g, ' ') : ''
);
const sameMeaningfulText = (planned: unknown, actual: unknown): boolean => (
  meaningful(planned)
  && meaningful(actual)
  && normalizedText(planned) === normalizedText(actual)
);
const numberValue = (value: unknown): number | null => (
  typeof value === 'number' && Number.isFinite(value) ? value : null
);
const emptyPerformedValue = (value: unknown): boolean => (
  value === null
  || value === undefined
  || (typeof value === 'string' && value.trim().length === 0)
);

type ConvertibleMeasurementDimension = 'length' | 'temperature' | 'time';

const convertMeasurementToBase = (
  value: unknown,
  unit: unknown,
  dimension: ConvertibleMeasurementDimension,
): number | null => {
  const numericValue = numberValue(value);
  if (numericValue === null || typeof unit !== 'string') return null;

  if (dimension === 'length') {
    if (unit === 'mm') return numericValue;
    if (unit === 'inch') return numericValue * 25.4;
    return null;
  }

  if (dimension === 'time') {
    if (unit === 'ms') return numericValue / 1_000;
    if (unit === 's') return numericValue;
    if (unit === 'min') return numericValue * 60;
    return null;
  }

  const temperatureCelsius = unit === 'degC'
    ? numericValue
    : unit === 'degF'
      ? (numericValue - 32) * (5 / 9)
      : null;
  return temperatureCelsius !== null && temperatureCelsius >= -273.15
    ? temperatureCelsius
    : null;
};

const measurementTolerance = (...values: number[]): number => (
  Math.max(1, ...values.map((value) => Math.abs(value))) * 1e-9
);

const sameConvertedMeasuredValue = (
  plannedValue: unknown,
  plannedUnit: unknown,
  actualValue: unknown,
  actualUnit: unknown,
  dimension: ConvertibleMeasurementDimension,
): boolean => {
  const planned = convertMeasurementToBase(plannedValue, plannedUnit, dimension);
  const actual = convertMeasurementToBase(actualValue, actualUnit, dimension);
  return planned !== null
    && actual !== null
    && Math.abs(planned - actual) <= measurementTolerance(planned, actual);
};

const sameMeasuredValue = (
  plannedValue: unknown,
  plannedUnit: unknown,
  actualValue: unknown,
  actualUnit: unknown,
): boolean => {
  const planned = numberValue(plannedValue);
  const actual = numberValue(actualValue);
  return planned !== null
    && actual !== null
    && plannedUnit === actualUnit
    && Math.abs(planned - actual) <= measurementTolerance(planned, actual);
};

const withinMeasuredRange = (
  actualValue: unknown,
  actualUnit: unknown,
  minimumValue: unknown,
  maximumValue: unknown,
  requiredUnit: unknown,
): boolean => {
  const actual = numberValue(actualValue);
  const minimum = numberValue(minimumValue);
  const maximum = numberValue(maximumValue);
  if (actual === null || minimum === null || maximum === null || minimum > maximum) return false;
  const tolerance = measurementTolerance(actual, minimum, maximum);
  return actualUnit === requiredUnit
    && actual >= minimum - tolerance
    && actual <= maximum + tolerance;
};

const withinConvertedMeasuredRange = (
  actualValue: unknown,
  actualUnit: unknown,
  minimumValue: unknown,
  maximumValue: unknown,
  requiredUnit: unknown,
  dimension: ConvertibleMeasurementDimension,
): boolean => {
  const actual = convertMeasurementToBase(actualValue, actualUnit, dimension);
  const minimum = convertMeasurementToBase(minimumValue, requiredUnit, dimension);
  const maximum = convertMeasurementToBase(maximumValue, requiredUnit, dimension);
  if (actual === null || minimum === null || maximum === null || minimum > maximum) return false;
  const tolerance = measurementTolerance(actual, minimum, maximum);
  return actual !== null
    && actual >= minimum - tolerance
    && actual <= maximum + tolerance;
};

const meetsConvertedMeasuredMinimum = (
  actualValue: unknown,
  actualUnit: unknown,
  requiredValue: unknown,
  requiredUnit: unknown,
  dimension: ConvertibleMeasurementDimension,
): boolean => {
  const actual = convertMeasurementToBase(actualValue, actualUnit, dimension);
  const required = convertMeasurementToBase(requiredValue, requiredUnit, dimension);
  return actual !== null
    && required !== null
    && actual >= required - measurementTolerance(actual, required);
};

const meetsMeasuredMinimum = (
  actualValue: unknown,
  actualUnit: unknown,
  requiredValue: unknown,
  requiredUnit: unknown,
): boolean => {
  const actual = numberValue(actualValue);
  const required = numberValue(requiredValue);
  return actual !== null
    && required !== null
    && actualUnit === requiredUnit
    && actual >= required - measurementTolerance(actual, required);
};
const meetsMeasuredMaximum = (
  actualValue: unknown,
  actualUnit: unknown,
  requiredValue: unknown,
  requiredUnit: unknown,
): boolean => {
  const actual = numberValue(actualValue);
  const required = numberValue(requiredValue);
  return actual !== null
    && required !== null
    && actualUnit === requiredUnit
    && actual <= required + measurementTolerance(actual, required);
};
const documentedDeviation = (value: string): boolean => {
  const normalized = value.trim().toLocaleLowerCase().replace(/[.\s]+$/g, '');
  return value.trim().length >= 12 && ![
    'none',
    'none recorded',
    'no deviation',
    'no deviations',
    'n/a',
    'na',
    'not applicable',
  ].includes(normalized);
};

const isoDate = (value: unknown): value is string => {
  if (typeof value !== 'string') return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < 1 || month < 1 || month > 12 || day < 1) return false;
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const monthDays = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return day <= monthDays[month - 1];
};

interface RetakeGraphRecord {
  recordIdentifier: string;
  originalIdentifier: string;
  performedDate: string;
}

const normalizedIdentifier = (value: string): string => value.trim().toLocaleLowerCase();

const hasRetakeCycle = (records: RetakeGraphRecord[]): boolean => {
  const originalByRecord = new Map(records
    .filter((record) => normalizedIdentifier(record.recordIdentifier) !== '')
    .map((record) => [
      normalizedIdentifier(record.recordIdentifier),
      normalizedIdentifier(record.originalIdentifier),
    ]));

  for (const start of originalByRecord.keys()) {
    const visited = new Set<string>();
    let current = start;
    while (current !== '') {
      if (visited.has(current)) return true;
      visited.add(current);
      current = originalByRecord.get(current) ?? '';
    }
  }
  return false;
};

const retakeChronologyIsValid = (
  record: RetakeGraphRecord,
  records: RetakeGraphRecord[],
): boolean => {
  const originalIdentifier = normalizedIdentifier(record.originalIdentifier);
  if (originalIdentifier === '') return true;
  const original = records.find((candidate) => (
    normalizedIdentifier(candidate.recordIdentifier) === originalIdentifier
  ));
  if (!original || !isoDate(record.performedDate) || !isoDate(original.performedDate)) return true;
  return record.performedDate >= original.performedDate;
};

const completeApproval = (approval: RtPtReportApproval): boolean => (
  meaningful(approval.name)
  && meaningful(approval.personnelId)
  && present(approval.certificationLevel)
  && meaningful(approval.certificationNumber)
  && meaningful(approval.certificationBasis)
  && isoDate(approval.date)
);

const samePersonnelIdentity = (left: RtPtReportApproval, right: RtPtReportApproval): boolean => {
  const leftId = left.personnelId.trim().toLocaleLowerCase();
  const rightId = right.personnelId.trim().toLocaleLowerCase();
  const leftName = left.name.trim().toLocaleLowerCase();
  const rightName = right.name.trim().toLocaleLowerCase();
  return (leftId.length > 0 && leftId === rightId) || (leftName.length > 0 && leftName === rightName);
};

const requirement = (
  path: string,
  label: string,
  section: Requirement['section'],
  complete: boolean,
  message: string,
): Requirement => ({ path, label, section, complete, message });

function commonRequirements(report: RtPtInspectionReportV1): Requirement[] {
  return [
    requirement('reportControl.number', 'Report Number', 'control', meaningful(report.reportControl.number), 'Enter a meaningful report number.'),
    requirement('reportControl.title', 'Report Title', 'control', meaningful(report.reportControl.title), 'Enter a meaningful report title.'),
    requirement('reportControl.revision', 'Report Revision', 'control', present(report.reportControl.revision), 'Enter the report revision.'),
    requirement('reportControl.reportDate', 'Report Date', 'control', isoDate(report.reportControl.reportDate), 'Enter a real report date in YYYY-MM-DD format.'),
    requirement('reportControl.inspectionStart', 'Inspection Start', 'control', isoDate(report.reportControl.inspectionStart), 'Enter the inspection start date.'),
    requirement('reportControl.inspectionEnd', 'Inspection End', 'control', isoDate(report.reportControl.inspectionEnd), 'Enter the inspection end date.'),
    requirement(
      'reportControl.inspectionEnd',
      'Inspection Date Order',
      'control',
      isoDate(report.reportControl.inspectionStart)
        && isoDate(report.reportControl.inspectionEnd)
        && report.reportControl.inspectionStart <= report.reportControl.inspectionEnd,
      'Inspection end must be on or after inspection start.',
    ),
    requirement(
      'reportControl.reportDate',
      'Report Date Order',
      'control',
      isoDate(report.reportControl.inspectionEnd)
        && isoDate(report.reportControl.reportDate)
        && report.reportControl.inspectionEnd <= report.reportControl.reportDate,
      'Report date must be on or after the completed inspection period.',
    ),
    requirement('part.partNumber', 'Part Number', 'traceability', meaningful(report.part.partNumber), 'Part number is required.'),
    requirement('part.serialOrLotNumber', 'Serial / Lot Number', 'traceability', meaningful(report.part.serialOrLotNumber), 'Enter the inspected serial or lot number.'),
    requirement('part.quantity', 'Quantity', 'traceability', positive(report.part.quantity), 'Quantity must be greater than zero.'),
    requirement('part.inspectionArea', 'Inspection Area', 'traceability', meaningful(report.part.inspectionArea), 'Define the inspected area.'),
    requirement('part.workOrder', 'Work Order', 'traceability', meaningful(report.part.workOrder), 'Work-order traceability is required.'),
    requirement('equipment.equipmentUsed', 'Equipment Used', 'equipment', meaningful(report.equipment.equipmentUsed), 'Identify the equipment used.'),
    requirement('equipment.calibrationReferences', 'Calibration References', 'equipment', meaningful(report.equipment.calibrationReferences), 'Record applicable calibration references.'),
    requirement('coverageStatement', 'Coverage Statement', 'disposition', meaningful(report.coverageStatement), 'Enter an explicit performed-coverage statement.'),
    requirement('overallDisposition', 'Overall Disposition', 'disposition', present(report.overallDisposition), 'Enter the final disposition; it is never inferred.'),
    requirement(
      'dispositionReference',
      'Disposition Reference',
      'disposition',
      meaningful(report.dispositionReference),
      'Cite the user-controlled disposition or acceptance reference.',
    ),
  ];
}

function indicationRequirements(report: RtPtInspectionReportV1): Requirement[] {
  if (report.indications.length === 0) return [];
  const resultIds = report.method === 'PT'
    ? new Set<string>()
    : new Set(report.results.map((result) => result.id));
  const normalizedIds = report.indications.map((indication) => indication.indicationId.trim().toLocaleLowerCase());
  const requirements: Requirement[] = [
    requirement(
      'indications',
      'Unique Indication IDs',
      'indications',
      normalizedIds.length === new Set(normalizedIds).size,
      'Each indication record must use a unique indication ID.',
    ),
  ];

  report.indications.forEach((indication, index) => {
    const path = `indications[${index}]`;
    requirements.push(
      requirement(`${path}.indicationId`, `Indication ${index + 1} ID`, 'indications', meaningful(indication.indicationId), 'Enter a traceable indication ID.'),
      requirement(`${path}.location`, `Indication ${index + 1} Location`, 'indications', meaningful(indication.location), 'Record the indication location.'),
      requirement(`${path}.indicationType`, `Indication ${index + 1} Type`, 'indications', meaningful(indication.indicationType), 'Record the indication type.'),
      requirement(
        `${path}.size`,
        `Indication ${index + 1} Size`,
        'indications',
        indication.size === '' || positive(indication.size),
        'If an indication size is entered, it must be greater than zero.',
      ),
      requirement(`${path}.evaluation`, `Indication ${index + 1} Evaluation`, 'indications', meaningful(indication.evaluation), 'Record the evaluation against the controlled acceptance reference.'),
      requirement(`${path}.disposition`, `Indication ${index + 1} Disposition`, 'indications', present(indication.disposition), 'Enter an explicit indication disposition.'),
      requirement(
        `${path}.linkedResultId`,
        `Indication ${index + 1} Result Link`,
        'indications',
        indication.linkedResultId === '' || resultIds.has(indication.linkedResultId),
        'The linked result no longer exists in this report.',
      ),
    );
  });
  const unresolvedDisposition = report.indications.some((indication) => (
    indication.disposition === 'rejected'
    || indication.disposition === 'repair-required'
    || indication.disposition === 'reinspection-required'
  ));
  requirements.push(requirement(
    'overallDisposition',
    'Accepted Indication Resolution',
    'disposition',
    report.overallDisposition !== 'accepted'
      || !unresolvedDisposition
      || documentedDeviation(report.equipment.deviations),
    'An accepted overall disposition must resolve non-accepted indication dispositions or document a controlled deviation.',
  ));
  return requirements;
}

function filmRequirements(report: Extract<RtPtInspectionReportV1, { method: 'RT-Film' }>): Requirement[] {
  const hasDeviation = documentedDeviation(report.equipment.deviations);
  const internalResultIds = report.results.map((result) => normalizedIdentifier(result.id));
  const filmIds = report.results.map((result) => result.filmId.trim().toLocaleLowerCase());
  const retakeRecords = report.results.map((result) => ({
    recordIdentifier: result.filmId,
    originalIdentifier: result.retakeOfFilmId,
    performedDate: result.exposureDate,
  }));
  const requirements: Requirement[] = [
    requirement('results', 'Film Result Rows', 'results', report.results.length > 0, 'At least one linked film result is required.'),
    requirement('results', 'Unique Film Internal Result IDs', 'results', internalResultIds.every((id) => meaningful(id)) && internalResultIds.length === new Set(internalResultIds).size, 'Every Film result record must retain one unique internal ID.'),
    requirement('results', 'Unique Film IDs', 'results', filmIds.length === new Set(filmIds).size, 'Every performed film record must use a unique film ID.'),
    requirement('results', 'Film Retake Chain', 'results', !hasRetakeCycle(retakeRecords), 'Film retake links must not reference the same record or form a cycle.'),
  ];
  report.results.forEach((result, index) => {
    const path = `results[${index}]`;
    const accepted = result.result === 'accepted';
    const geometryMatches = sameConvertedMeasuredValue(result.planned.sfd, result.planned.sfdUnit, result.actualSfd, result.actualSfdUnit, 'length')
      && sameConvertedMeasuredValue(result.planned.sod, result.planned.sodUnit, result.actualSod, result.actualSodUnit, 'length')
      && sameConvertedMeasuredValue(result.planned.ofd, result.planned.ofdUnit, result.actualOfd, result.actualOfdUnit, 'length');
    const exposureMatches = sameConvertedMeasuredValue(
      result.planned.exposureTime,
      result.planned.exposureTimeUnit,
      result.actualExposureTime,
      result.actualExposureTimeUnit,
      'time',
    );
    const densityWithinPlan = numberValue(result.densityMinimum) !== null
      && numberValue(result.densityMaximum) !== null
      && numberValue(result.planned.densityMinimum) !== null
      && numberValue(result.planned.densityMaximum) !== null
      && Number(result.densityMinimum) >= Number(result.planned.densityMinimum)
      && Number(result.densityMaximum) <= Number(result.planned.densityMaximum);
    requirements.push(
      requirement(`${path}.plannedItemId`, `View ${index + 1} Link`, 'results', meaningful(result.plannedItemId), 'The result must retain its stable planned-view link.'),
      requirement(`${path}.filmId`, `View ${index + 1} Film ID`, 'results', meaningful(result.filmId), 'Record the actual film identifier.'),
      requirement(`${path}.exposureDate`, `View ${index + 1} Exposure Date`, 'results', isoDate(result.exposureDate), 'Record a real exposure date.'),
      requirement(
        `${path}.exposureDate`,
        `View ${index + 1} Exposure Period`,
        'results',
        isoDate(result.exposureDate)
          && isoDate(report.reportControl.inspectionStart)
          && isoDate(report.reportControl.inspectionEnd)
          && result.exposureDate >= report.reportControl.inspectionStart
          && result.exposureDate <= report.reportControl.inspectionEnd,
        'Exposure date must fall within the recorded inspection period.',
      ),
      requirement(`${path}.actualSfd`, `View ${index + 1} Actual SFD`, 'results', positive(result.actualSfd), 'Record the achieved source-to-film distance.'),
      requirement(`${path}.actualSod`, `View ${index + 1} Actual SOD`, 'results', positive(result.actualSod), 'Record the achieved source-to-object distance.'),
      requirement(`${path}.actualOfd`, `View ${index + 1} Actual OFD`, 'results', typeof result.actualOfd === 'number' && result.actualOfd >= 0, 'Record the achieved object-to-film distance.'),
      requirement(`${path}.actualExposureTime`, `View ${index + 1} Actual Exposure Time`, 'results', positive(result.actualExposureTime), 'Record the actual exposure time.'),
      requirement(`${path}.actualExposureTimeUnit`, `View ${index + 1} Exposure Time Unit`, 'results', present(result.actualExposureTimeUnit), 'Select the actual exposure-time unit.'),
      requirement(`${path}.densityMinimum`, `View ${index + 1} Density Minimum`, 'results', positive(result.densityMinimum), 'Record the minimum optical density.'),
      requirement(`${path}.densityMaximum`, `View ${index + 1} Density Maximum`, 'results', positive(result.densityMaximum), 'Record the maximum optical density.'),
      requirement(
        `${path}.densityMaximum`,
        `View ${index + 1} Density Order`,
        'results',
        positive(result.densityMinimum) && positive(result.densityMaximum) && result.densityMinimum <= result.densityMaximum,
        'Maximum density must be greater than or equal to minimum density.',
      ),
      requirement(`${path}.iqiObserved`, `View ${index + 1} IQI Observation`, 'results', meaningful(result.iqiObserved), 'Record the achieved IQI observation.'),
      requirement(`${path}.iqiRequirementMet`, `View ${index + 1} IQI Requirement Confirmation`, 'results', typeof result.iqiRequirementMet === 'boolean', 'Explicitly confirm whether the planned IQI requirement was met.'),
      requirement(`${path}.coverageConfirmed`, `View ${index + 1} Coverage`, 'results', typeof result.coverageConfirmed === 'boolean', 'Confirm whether the planned coverage was achieved.'),
      requirement(`${path}.result`, `View ${index + 1} Result`, 'results', present(result.result), 'Enter an explicit result.'),
      requirement(
        `${path}.retakeOfFilmId`,
        `View ${index + 1} Retake Link`,
        'results',
        result.retakeOfFilmId.trim() === ''
          || filmIds.some((filmId, filmIndex) => filmIndex !== index && filmId === result.retakeOfFilmId.trim().toLocaleLowerCase()),
        'A retake link must reference another film ID in this report.',
      ),
      requirement(
        `${path}.exposureDate`,
        `View ${index + 1} Retake Chronology`,
        'results',
        retakeChronologyIsValid(retakeRecords[index], retakeRecords),
        'A retake exposure date must be on or after the referenced original film exposure date.',
      ),
      requirement(`${path}.coverageConfirmed`, `View ${index + 1} Accepted Coverage`, 'results', !accepted || result.coverageConfirmed === true || hasDeviation, 'An accepted view requires confirmed planned coverage or a documented controlled deviation.'),
      requirement(`${path}.actualSfd`, `View ${index + 1} Accepted Geometry`, 'results', !accepted || geometryMatches || hasDeviation, 'Accepted geometry must match the approved plan or be supported by a documented controlled deviation.'),
      requirement(`${path}.actualExposureTime`, `View ${index + 1} Accepted Exposure`, 'results', !accepted || exposureMatches || hasDeviation, 'Accepted exposure time must match the approved plan or be supported by a documented controlled deviation.'),
      requirement(`${path}.densityMinimum`, `View ${index + 1} Accepted Density`, 'results', !accepted || densityWithinPlan || hasDeviation, 'Accepted optical density must remain within the approved range or be supported by a documented controlled deviation.'),
      requirement(`${path}.iqiRequirementMet`, `View ${index + 1} Accepted IQI Conformance`, 'results', !accepted || result.iqiRequirementMet === true || hasDeviation, 'An accepted view requires explicit confirmation that the planned IQI requirement was met or a documented controlled deviation.'),
    );
    if (result.planned.sourceType === 'X-ray') {
      const sourceMatches = sameMeasuredValue(result.planned.tubeVoltage, result.planned.tubeVoltageUnit, result.actualTubeVoltage, result.actualTubeVoltageUnit)
        && sameMeasuredValue(result.planned.tubeCurrent, result.planned.tubeCurrentUnit, result.actualTubeCurrent, result.actualTubeCurrentUnit);
      requirements.push(
        requirement(`${path}.actualTubeVoltage`, `View ${index + 1} Actual Tube Voltage`, 'results', positive(result.actualTubeVoltage), 'Record actual tube voltage.'),
        requirement(`${path}.actualTubeCurrent`, `View ${index + 1} Actual Tube Current`, 'results', positive(result.actualTubeCurrent), 'Record actual tube current.'),
        requirement(`${path}.actualTubeVoltage`, `View ${index + 1} Accepted X-ray Settings`, 'results', !accepted || sourceMatches || hasDeviation, 'Accepted X-ray settings must match the approved plan or be supported by a documented controlled deviation.'),
        requirement(
          `${path}.actualSourceActivity`,
          `View ${index + 1} Inactive Gamma Fields`,
          'results',
          emptyPerformedValue(result.actualSourceActivity) && emptyPerformedValue(result.actualSourceActivityUnit),
          'X-ray result records must not retain inactive Gamma activity values or units.',
        ),
      );
    } else if (result.planned.sourceType === 'Gamma') {
      requirements.push(
        requirement(`${path}.actualSourceActivity`, `View ${index + 1} Actual Source Activity`, 'results', positive(result.actualSourceActivity), 'Record referenced source activity.'),
        requirement(`${path}.actualSourceActivityUnit`, `View ${index + 1} Activity Unit`, 'results', present(result.actualSourceActivityUnit), 'Record the source-activity unit.'),
        requirement(
          `${path}.actualTubeVoltage`,
          `View ${index + 1} Inactive X-ray Fields`,
          'results',
          emptyPerformedValue(result.actualTubeVoltage)
            && emptyPerformedValue(result.actualTubeVoltageUnit)
            && emptyPerformedValue(result.actualTubeCurrent)
            && emptyPerformedValue(result.actualTubeCurrentUnit),
          'Gamma result records must not retain inactive X-ray tube voltage/current values or units.',
        ),
      );
    }
  });
  const unresolved = report.results.some((result) => (
    (result.result === 'rejected' || result.result === 'retake-required')
    && !report.results.some((candidate) => (
      candidate.result === 'accepted'
      && candidate.retakeOfFilmId.trim().toLocaleLowerCase() === result.filmId.trim().toLocaleLowerCase()
    ))
  ));
  requirements.push(requirement(
    'overallDisposition',
    'Accepted Film Disposition Resolution',
    'disposition',
    report.overallDisposition !== 'accepted' || !unresolved || hasDeviation,
    'An accepted overall disposition must resolve rejected/retake-required films or document a controlled deviation.',
  ));
  return requirements;
}

function digitalRequirements(report: Extract<RtPtInspectionReportV1, { method: 'RT-Digital' }>): Requirement[] {
  const hasDeviation = documentedDeviation(report.equipment.deviations);
  const internalResultIds = report.results.map((result) => normalizedIdentifier(result.id));
  const imageIds = report.results.map((result) => result.imageId.trim().toLocaleLowerCase());
  const retakeRecords = report.results.map((result) => ({
    recordIdentifier: result.imageId,
    originalIdentifier: result.retakeOfImageId,
    performedDate: result.acquisitionDate,
  }));
  const requirements: Requirement[] = [
    requirement('results', 'Digital Result Rows', 'results', report.results.length > 0, 'At least one linked acquisition result is required.'),
    requirement('results', 'Unique DDA Internal Result IDs', 'results', internalResultIds.every((id) => meaningful(id)) && internalResultIds.length === new Set(internalResultIds).size, 'Every DDA result record must retain one unique internal ID.'),
    requirement('results', 'Unique Image IDs', 'results', imageIds.length === new Set(imageIds).size, 'Every performed acquisition must use a unique image ID.'),
    requirement('results', 'DDA Retake Chain', 'results', !hasRetakeCycle(retakeRecords), 'DDA retake links must not reference the same record or form a cycle.'),
  ];
  report.results.forEach((result, index) => {
    const path = `results[${index}]`;
    const accepted = result.result === 'accepted';
    const snrRequired = meaningful(result.planned.requiredSnrOrNormalizedSnr);
    const cnrRequired = meaningful(result.planned.requiredContrastSensitivityOrCnr);
    const geometryMatches = sameConvertedMeasuredValue(result.planned.sdd, result.planned.sddUnit, result.actualSdd, result.actualSddUnit, 'length')
      && sameConvertedMeasuredValue(result.planned.sod, result.planned.sodUnit, result.actualSod, result.actualSodUnit, 'length')
      && sameConvertedMeasuredValue(result.planned.odd, result.planned.oddUnit, result.actualOdd, result.actualOddUnit, 'length');
    const sourceMatches = sameMeasuredValue(result.planned.tubeVoltage, result.planned.tubeVoltageUnit, result.actualTubeVoltage, result.actualTubeVoltageUnit)
      && sameMeasuredValue(result.planned.tubeCurrent, result.planned.tubeCurrentUnit, result.actualTubeCurrent, result.actualTubeCurrentUnit);
    const exposureMatches = sameConvertedMeasuredValue(result.planned.exposureTime, result.planned.exposureTimeUnit, result.actualExposureTime, result.actualExposureTimeUnit, 'time');
    const integrationMatches = sameConvertedMeasuredValue(result.planned.integrationTime, result.planned.integrationTimeUnit, result.actualIntegrationTime, result.actualIntegrationTimeUnit, 'time')
      && numberValue(result.planned.framesAveraged) !== null
      && numberValue(result.actualFramesAveraged) !== null
      && Number(result.planned.framesAveraged) === Number(result.actualFramesAveraged);
    requirements.push(
      requirement(`${path}.plannedItemId`, `Acquisition ${index + 1} Link`, 'results', meaningful(result.plannedItemId), 'The result must retain its stable planned-acquisition link.'),
      requirement(`${path}.imageId`, `Acquisition ${index + 1} Image ID`, 'results', meaningful(result.imageId), 'Record the actual image identifier.'),
      requirement(`${path}.acquisitionDate`, `Acquisition ${index + 1} Date`, 'results', isoDate(result.acquisitionDate), 'Record a real acquisition date.'),
      requirement(
        `${path}.acquisitionDate`,
        `Acquisition ${index + 1} Inspection Period`,
        'results',
        isoDate(result.acquisitionDate)
          && isoDate(report.reportControl.inspectionStart)
          && isoDate(report.reportControl.inspectionEnd)
          && result.acquisitionDate >= report.reportControl.inspectionStart
          && result.acquisitionDate <= report.reportControl.inspectionEnd,
        'Acquisition date must fall within the recorded inspection period.',
      ),
      requirement(`${path}.actualSdd`, `Acquisition ${index + 1} Actual SDD`, 'results', positive(result.actualSdd), 'Record actual source-to-detector distance.'),
      requirement(`${path}.actualSod`, `Acquisition ${index + 1} Actual SOD`, 'results', positive(result.actualSod), 'Record actual source-to-object distance.'),
      requirement(`${path}.actualOdd`, `Acquisition ${index + 1} Actual ODD`, 'results', typeof result.actualOdd === 'number' && result.actualOdd >= 0, 'Record actual object-to-detector distance.'),
      requirement(`${path}.actualTubeVoltage`, `Acquisition ${index + 1} Actual Tube Voltage`, 'results', positive(result.actualTubeVoltage), 'Record actual tube voltage.'),
      requirement(`${path}.actualTubeCurrent`, `Acquisition ${index + 1} Actual Tube Current`, 'results', positive(result.actualTubeCurrent), 'Record actual tube current.'),
      requirement(`${path}.actualExposureTime`, `Acquisition ${index + 1} Exposure Time`, 'results', positive(result.actualExposureTime), 'Record actual exposure time.'),
      requirement(`${path}.actualIntegrationTime`, `Acquisition ${index + 1} Integration Time`, 'results', positive(result.actualIntegrationTime), 'Record actual integration time.'),
      requirement(`${path}.actualFramesAveraged`, `Acquisition ${index + 1} Frames Averaged`, 'results', positive(result.actualFramesAveraged), 'Record frames averaged.'),
      requirement(`${path}.iqiObserved`, `Acquisition ${index + 1} IQI Observation`, 'results', meaningful(result.iqiObserved), 'Record the achieved IQI observation.'),
      requirement(`${path}.detectorControlReference`, `Acquisition ${index + 1} Detector Control`, 'results', meaningful(result.detectorControlReference), 'Record the detector-control reference current at acquisition.'),
      requirement(`${path}.archiveReference`, `Acquisition ${index + 1} Archive Reference`, 'results', meaningful(result.archiveReference), 'Record archive / image traceability.'),
      requirement(`${path}.coverageConfirmed`, `Acquisition ${index + 1} Coverage`, 'results', typeof result.coverageConfirmed === 'boolean', 'Confirm whether planned coverage was achieved.'),
      requirement(`${path}.result`, `Acquisition ${index + 1} Result`, 'results', present(result.result), 'Enter an explicit result.'),
      requirement(
        `${path}.retakeOfImageId`,
        `Acquisition ${index + 1} Retake Link`,
        'results',
        result.retakeOfImageId.trim() === ''
          || imageIds.some((imageId, imageIndex) => imageIndex !== index && imageId === result.retakeOfImageId.trim().toLocaleLowerCase()),
        'A retake link must reference another image ID in this report.',
      ),
      requirement(
        `${path}.acquisitionDate`,
        `Acquisition ${index + 1} Retake Chronology`,
        'results',
        retakeChronologyIsValid(retakeRecords[index], retakeRecords),
        'A retake acquisition date must be on or after the referenced original image acquisition date.',
      ),
      requirement(`${path}.achievedSnr`, `Acquisition ${index + 1} Achieved SNR`, 'results', !meaningful(result.planned.requiredSnrOrNormalizedSnr) || meaningful(result.achievedSnr), 'Record achieved SNR / normalized SNR against the approved requirement.'),
      requirement(`${path}.achievedCnr`, `Acquisition ${index + 1} Achieved CNR`, 'results', !meaningful(result.planned.requiredContrastSensitivityOrCnr) || meaningful(result.achievedCnr), 'Record achieved contrast sensitivity / CNR against the approved requirement.'),
      requirement(`${path}.iqiRequirementMet`, `Acquisition ${index + 1} IQI Requirement Confirmation`, 'results', typeof result.iqiRequirementMet === 'boolean', 'Explicitly confirm whether the planned IQI requirement was met.'),
      requirement(`${path}.snrRequirementMet`, `Acquisition ${index + 1} SNR Requirement Confirmation`, 'results', snrRequired ? typeof result.snrRequirementMet === 'boolean' : emptyPerformedValue(result.snrRequirementMet), snrRequired ? 'Explicitly confirm whether the planned SNR requirement was met.' : 'Do not record SNR conformance when the approved plan has no SNR requirement.'),
      requirement(`${path}.cnrRequirementMet`, `Acquisition ${index + 1} CNR Requirement Confirmation`, 'results', cnrRequired ? typeof result.cnrRequirementMet === 'boolean' : emptyPerformedValue(result.cnrRequirementMet), cnrRequired ? 'Explicitly confirm whether the planned CNR requirement was met.' : 'Do not record CNR conformance when the approved plan has no CNR requirement.'),
      requirement(`${path}.coverageConfirmed`, `Acquisition ${index + 1} Accepted Coverage`, 'results', !accepted || result.coverageConfirmed === true || hasDeviation, 'An accepted acquisition requires confirmed planned coverage or a documented controlled deviation.'),
      requirement(`${path}.actualSdd`, `Acquisition ${index + 1} Accepted Geometry`, 'results', !accepted || geometryMatches || hasDeviation, 'Accepted geometry must match the approved plan or be supported by a documented controlled deviation.'),
      requirement(`${path}.actualTubeVoltage`, `Acquisition ${index + 1} Accepted X-ray Settings`, 'results', !accepted || sourceMatches || hasDeviation, 'Accepted X-ray settings must match the approved plan or be supported by a documented controlled deviation.'),
      requirement(`${path}.actualExposureTime`, `Acquisition ${index + 1} Accepted Exposure`, 'results', !accepted || exposureMatches || hasDeviation, 'Accepted exposure time must match the approved plan or be supported by a documented controlled deviation.'),
      requirement(`${path}.actualIntegrationTime`, `Acquisition ${index + 1} Accepted Integration`, 'results', !accepted || integrationMatches || hasDeviation, 'Accepted integration and averaging must match the approved plan or be supported by a documented controlled deviation.'),
      requirement(`${path}.iqiRequirementMet`, `Acquisition ${index + 1} Accepted IQI Conformance`, 'results', !accepted || result.iqiRequirementMet === true || hasDeviation, 'An accepted acquisition requires explicit confirmation that the planned IQI requirement was met or a documented controlled deviation.'),
      requirement(`${path}.snrRequirementMet`, `Acquisition ${index + 1} Accepted SNR Conformance`, 'results', !accepted || !snrRequired || result.snrRequirementMet === true || hasDeviation, 'An accepted acquisition requires explicit confirmation that the planned SNR requirement was met or a documented controlled deviation.'),
      requirement(`${path}.cnrRequirementMet`, `Acquisition ${index + 1} Accepted CNR Conformance`, 'results', !accepted || !cnrRequired || result.cnrRequirementMet === true || hasDeviation, 'An accepted acquisition requires explicit confirmation that the planned CNR requirement was met or a documented controlled deviation.'),
    );
    if (meaningful(result.planned.iqiRequirement)) {
      requirements.push(requirement(`${path}.iqiObserved`, `Acquisition ${index + 1} Required IQI`, 'results', meaningful(result.iqiObserved), 'Record the achieved image-quality observation.'));
    }
  });
  const unresolved = report.results.some((result) => (
    (result.result === 'rejected' || result.result === 'retake-required')
    && !report.results.some((candidate) => (
      candidate.result === 'accepted'
      && candidate.retakeOfImageId.trim().toLocaleLowerCase() === result.imageId.trim().toLocaleLowerCase()
    ))
  ));
  requirements.push(requirement(
    'overallDisposition',
    'Accepted DDA Disposition Resolution',
    'disposition',
    report.overallDisposition !== 'accepted' || !unresolved || hasDeviation,
    'An accepted overall disposition must resolve rejected/retake-required acquisitions or document a controlled deviation.',
  ));
  return requirements;
}

function ptRequirements(report: Extract<RtPtInspectionReportV1, { method: 'PT' }>): Requirement[] {
  const { results } = report;
  const accepted = report.overallDisposition === 'accepted';
  const hasDeviation = documentedDeviation(report.equipment.deviations);
  const allEmpty = (...values: unknown[]): boolean => values.every(emptyPerformedValue);
  const temperaturesConform = withinConvertedMeasuredRange(
    results.partTemperature,
    results.temperatureUnit,
    results.planned.partTemperatureMin,
    results.planned.partTemperatureMax,
    results.planned.partTemperatureUnit,
    'temperature',
  ) && withinConvertedMeasuredRange(
    results.penetrantTemperature,
    results.temperatureUnit,
    results.planned.penetrantTemperatureMin,
    results.planned.penetrantTemperatureMax,
    results.planned.penetrantTemperatureUnit,
    'temperature',
  );
  const timesConform = meetsConvertedMeasuredMinimum(
    results.actualDwellTime,
    results.actualDwellTimeUnit,
    results.planned.dwellTime,
    results.planned.dwellTimeUnit,
    'time',
  ) && meetsConvertedMeasuredMinimum(
    results.actualDevelopmentTime,
    results.actualDevelopmentTimeUnit,
    results.planned.developmentTime,
    results.planned.developmentTimeUnit,
    'time',
  );
  const surfaceAndApplicationConform = sameMeaningfulText(
    results.planned.cleaningMethod,
    results.actualCleaningMethod,
  ) && sameMeaningfulText(
    results.planned.surfaceCondition,
    results.actualSurfaceCondition,
  ) && sameMeaningfulText(
    results.planned.dryingMethod,
    results.actualDryingMethod,
  ) && meetsConvertedMeasuredMinimum(
    results.actualDryingTime,
    results.actualDryingTimeUnit,
    results.planned.dryingTime,
    results.planned.dryingTimeUnit,
    'time',
  ) && sameConvertedMeasuredValue(
    results.planned.dryingTemperature,
    results.planned.dryingTemperatureUnit,
    results.actualDryingTemperature,
    results.actualDryingTemperatureUnit,
    'temperature',
  ) && sameMeaningfulText(
    results.planned.penetrantApplicationMethod,
    results.actualPenetrantApplicationMethod,
  ) && sameMeaningfulText(
    results.planned.developerApplicationMethod,
    results.actualDeveloperApplicationMethod,
  );
  const requirements = [
    requirement('results.planned.penetrantType', 'Supported Penetrant Type', 'results', results.planned.penetrantType === 'Type I' || results.planned.penetrantType === 'Type II', 'The frozen basis must identify Type I or Type II penetrant.'),
    requirement('results.planned.removalMethod', 'Supported Penetrant Removal Method', 'results', ['A', 'B', 'C', 'D'].includes(results.planned.removalMethod), 'The frozen basis must identify Method A, B, C, or D.'),
    requirement('results.penetrantLot', 'Penetrant Lot', 'results', meaningful(results.penetrantLot), 'Record penetrant lot traceability.'),
    requirement('results.penetrantExpiry', 'Penetrant Expiry', 'results', isoDate(results.penetrantExpiry), 'Record a real penetrant expiry date.'),
    requirement('results.penetrantExpiry', 'Penetrant In-date Status', 'results', isoDate(results.penetrantExpiry) && isoDate(report.reportControl.inspectionEnd) && results.penetrantExpiry >= report.reportControl.inspectionEnd, 'Penetrant expiry must be on or after the inspection date.'),
    requirement('results.cleanerLot', 'Cleaner Lot', 'results', meaningful(results.cleanerLot), 'Record cleaner lot traceability.'),
    requirement('results.developerLot', 'Developer Lot', 'results', meaningful(results.developerLot), 'Record developer lot traceability.'),
    requirement('results.actualCleaningMethod', 'Actual Surface-cleaning Method', 'results', meaningful(results.actualCleaningMethod), 'Record the surface-cleaning method actually used.'),
    requirement('results.actualCleaningDetails', 'Actual Surface-preparation Details', 'results', meaningful(results.actualCleaningDetails), 'Record the surface preparation actually performed; do not infer it from the planned instruction.'),
    requirement('results.actualSurfaceCondition', 'Achieved Surface Condition', 'results', meaningful(results.actualSurfaceCondition), 'Record the surface condition achieved before penetrant application.'),
    requirement('results.actualDryingMethod', 'Actual Drying Method', 'results', meaningful(results.actualDryingMethod), 'Record the drying method actually used.'),
    requirement('results.actualDryingTime', 'Actual Drying Time', 'results', positive(results.actualDryingTime), 'Record the achieved drying time.'),
    requirement('results.actualDryingTimeUnit', 'Actual Drying Time Unit', 'results', present(results.actualDryingTimeUnit), 'Select the unit used for actual drying time.'),
    requirement('results.actualDryingTemperature', 'Actual Drying Temperature', 'results', convertMeasurementToBase(results.actualDryingTemperature, results.actualDryingTemperatureUnit, 'temperature') !== null, 'Record a physically valid achieved drying temperature.'),
    requirement('results.actualDryingTemperatureUnit', 'Actual Drying Temperature Unit', 'results', present(results.actualDryingTemperatureUnit), 'Select the unit used for actual drying temperature.'),
    requirement('results.actualPenetrantApplicationMethod', 'Actual Penetrant Application', 'results', meaningful(results.actualPenetrantApplicationMethod), 'Record how penetrant was actually applied.'),
    requirement('results.partTemperature', 'Part Temperature', 'results', convertMeasurementToBase(results.partTemperature, results.temperatureUnit, 'temperature') !== null, 'Record a physically valid actual part temperature.'),
    requirement('results.penetrantTemperature', 'Penetrant Temperature', 'results', convertMeasurementToBase(results.penetrantTemperature, results.temperatureUnit, 'temperature') !== null, 'Record a physically valid actual penetrant temperature.'),
    requirement('results.temperatureUnit', 'Temperature Unit', 'results', present(results.temperatureUnit), 'Select a temperature unit.'),
    requirement('results.actualDwellTime', 'Actual Dwell Time', 'results', positive(results.actualDwellTime), 'Record actual penetrant dwell time.'),
    requirement('results.actualDevelopmentTime', 'Actual Development Time', 'results', positive(results.actualDevelopmentTime), 'Record actual development time.'),
    requirement('results.actualDeveloperApplicationMethod', 'Actual Developer Application', 'results', meaningful(results.actualDeveloperApplicationMethod), 'Record how developer was actually applied.'),
    requirement('results.lightMeterId', 'Light Meter ID', 'results', meaningful(results.lightMeterId), 'Identify the calibrated light meter.'),
    requirement('results.examinationTime', 'Examination Time', 'results', meaningful(results.examinationTime), 'Record the performed examination time.'),
    requirement('results.postCleaningCompleted', 'Post-cleaning', 'results', typeof results.postCleaningCompleted === 'boolean', 'Record whether post-cleaning was completed.'),
    requirement('results.coverageConfirmed', 'Coverage', 'results', typeof results.coverageConfirmed === 'boolean', 'Confirm whether the planned area was examined.'),
    requirement('results.partTemperature', 'Accepted PT Temperature Controls', 'results', !accepted || temperaturesConform || hasDeviation, 'Accepted PT results require temperatures within the approved ranges or a documented controlled deviation.'),
    requirement('results.actualDwellTime', 'Accepted PT Process Times', 'results', !accepted || timesConform || hasDeviation, 'Accepted PT results require achieved dwell/development times to meet the approved plan or a documented controlled deviation.'),
    requirement('results.actualCleaningMethod', 'Accepted PT Preparation and Application Controls', 'results', !accepted || surfaceAndApplicationConform || hasDeviation, 'Accepted PT results require achieved surface preparation, drying, penetrant application, and developer application to match the approved plan or have a documented controlled deviation.'),
    requirement('results.coverageConfirmed', 'Accepted PT Coverage', 'results', !accepted || results.coverageConfirmed === true || hasDeviation, 'An accepted PT disposition requires confirmed planned coverage or a documented controlled deviation.'),
    requirement('results.postCleaningCompleted', 'Accepted PT Post-cleaning', 'results', !accepted || results.postCleaningCompleted === true || hasDeviation, 'An accepted PT disposition requires completed post-cleaning or a documented controlled deviation.'),
  ];
  if (results.planned.penetrantType === 'Type I') {
    const lightingConforms = meetsMeasuredMinimum(
      results.measuredUvA,
      results.uvAUnit,
      results.planned.requiredUvAMin,
      results.planned.uvAUnit,
    ) && meetsMeasuredMaximum(
      results.measuredAmbientVisibleLight,
      results.visibleLightUnit,
      results.planned.ambientVisibleLightMax,
      results.planned.visibleLightUnit,
    );
    requirements.push(
      requirement('results.actualDarkAdaptationTime', 'Actual Dark-adaptation Time', 'results', positive(results.actualDarkAdaptationTime), 'Record the dark-adaptation time actually achieved.'),
      requirement('results.actualDarkAdaptationTimeUnit', 'Actual Dark-adaptation Time Unit', 'results', present(results.actualDarkAdaptationTimeUnit), 'Select the actual dark-adaptation time unit.'),
      requirement('results.measuredUvA', 'Measured UV-A', 'results', positive(results.measuredUvA), 'Record the measured UV-A irradiance.'),
      requirement('results.measuredAmbientVisibleLight', 'Ambient Visible Light', 'results', typeof results.measuredAmbientVisibleLight === 'number' && results.measuredAmbientVisibleLight >= 0, 'Record measured ambient visible light.'),
      requirement('results.actualDarkAdaptationTime', 'Accepted Type I Dark Adaptation', 'results', !accepted || meetsConvertedMeasuredMinimum(results.actualDarkAdaptationTime, results.actualDarkAdaptationTimeUnit, results.planned.darkAdaptationTime, results.planned.darkAdaptationTimeUnit, 'time') || hasDeviation, 'Accepted Type I results require the approved dark-adaptation time or a documented controlled deviation.'),
      requirement('results.measuredUvA', 'Accepted Type I Lighting', 'results', !accepted || lightingConforms || hasDeviation, 'Accepted Type I results require compliant UV-A and ambient-light readings or a documented controlled deviation.'),
      requirement('results.measuredWhiteLight', 'Inactive Type II Lighting Fields', 'results', allEmpty(results.planned.whiteLightMin, results.measuredWhiteLight), 'Type I result records must not retain inactive Type II planned or performed white-light values.'),
    );
  } else if (results.planned.penetrantType === 'Type II') {
    const lightingConforms = meetsMeasuredMinimum(
      results.measuredWhiteLight,
      results.visibleLightUnit,
      results.planned.whiteLightMin,
      results.planned.visibleLightUnit,
    );
    requirements.push(
      requirement('results.measuredWhiteLight', 'Measured White Light', 'results', positive(results.measuredWhiteLight), 'Record measured white-light illuminance.'),
      requirement('results.measuredWhiteLight', 'Accepted Type II Lighting', 'results', !accepted || lightingConforms || hasDeviation, 'Accepted Type II results require compliant white-light readings or a documented controlled deviation.'),
      requirement(
        'results.measuredUvA',
        'Inactive Type I Lighting Fields',
        'results',
        allEmpty(
          results.planned.sensitivityLevel,
          results.planned.requiredUvAMin,
          results.planned.uvAUnit,
          results.planned.ambientVisibleLightMax,
          results.planned.darkAdaptationTime,
          results.planned.darkAdaptationTimeUnit,
          results.measuredUvA,
          results.measuredAmbientVisibleLight,
          results.uvAUnit,
          results.actualDarkAdaptationTime,
          results.actualDarkAdaptationTimeUnit,
        ),
        'Type II result records must not retain inactive Type I planned or performed lighting and dark-adaptation values.',
      ),
    );
  } else {
    requirements.push(requirement(
      'results.planned.penetrantType',
      'Inactive Unknown-type Lighting Fields',
      'results',
      allEmpty(
        results.planned.sensitivityLevel,
        results.planned.requiredUvAMin,
        results.planned.uvAUnit,
        results.planned.ambientVisibleLightMax,
        results.planned.whiteLightMin,
        results.planned.darkAdaptationTime,
        results.planned.darkAdaptationTimeUnit,
        results.measuredUvA,
        results.measuredAmbientVisibleLight,
        results.measuredWhiteLight,
        results.uvAUnit,
        results.actualDarkAdaptationTime,
        results.actualDarkAdaptationTimeUnit,
      ),
      'An unknown penetrant type must not retain any type-specific planned or performed values.',
    ));
  }
  if (results.planned.removalMethod === 'A') {
    requirements.push(
      requirement('results.actualMethodARinseDetails', 'Actual Method A Rinse', 'results', meaningful(results.actualMethodARinseDetails), 'Record the Method A water rinse actually performed.'),
      requirement('results.actualMethodARinsePressure', 'Actual Method A Rinse Pressure', 'results', numberValue(results.actualMethodARinsePressure) !== null && (numberValue(results.actualMethodARinsePressure) ?? -1) >= 0, 'Record the achieved Method A rinse pressure.'),
      requirement('results.actualMethodARinsePressureUnit', 'Actual Method A Rinse Pressure Unit', 'results', present(results.actualMethodARinsePressureUnit), 'Record the actual rinse-pressure unit.'),
      requirement('results.actualMethodARinseTemperature', 'Actual Method A Rinse Temperature', 'results', convertMeasurementToBase(results.actualMethodARinseTemperature, results.actualMethodARinseTemperatureUnit, 'temperature') !== null, 'Record a physically valid actual rinse temperature.'),
      requirement('results.actualMethodARinseTemperatureUnit', 'Actual Method A Rinse Temperature Unit', 'results', present(results.actualMethodARinseTemperatureUnit), 'Record the actual rinse-temperature unit.'),
      requirement('results.actualMethodARinsePressure', 'Accepted Method A Rinse Controls', 'results', !accepted || (withinMeasuredRange(results.actualMethodARinsePressure, results.actualMethodARinsePressureUnit, results.planned.methodARinsePressureMin, results.planned.methodARinsePressureMax, results.planned.methodARinsePressureUnit) && withinConvertedMeasuredRange(results.actualMethodARinseTemperature, results.actualMethodARinseTemperatureUnit, results.planned.methodARinseTemperatureMin, results.planned.methodARinseTemperatureMax, results.planned.methodARinseTemperatureUnit, 'temperature')) || hasDeviation, 'Accepted Method A results require achieved rinse pressure and temperature within the approved ranges or a documented controlled deviation.'),
      requirement('results.removerLot', 'Inactive Removal Material Lots', 'results', allEmpty(
        results.removerLot,
        results.emulsifierLot,
        results.planned.emulsifierType,
        results.planned.emulsifierConcentration,
        results.planned.emulsifierConcentrationUnit,
        results.planned.emulsifierContactTime,
        results.planned.emulsifierContactTimeUnit,
        results.planned.emulsifierApplicationMethod,
        results.planned.postEmulsifierRinseInstructions,
        results.planned.methodCRemoverInstructions,
        results.planned.methodDPreRinseInstructions,
        results.planned.methodDFinalRinseInstructions,
        results.actualEmulsifierConcentration,
        results.actualEmulsifierConcentrationUnit,
        results.actualEmulsifierContactTime,
        results.actualEmulsifierContactTimeUnit,
        results.actualEmulsifierApplicationMethod,
        results.actualPostEmulsifierRinseDetails,
        results.actualMethodCRemovalDetails,
        results.actualMethodDPreRinseDetails,
        results.actualMethodDFinalRinseDetails,
      ), 'Method A records must not retain inactive B/C/D planned or performed removal values.'),
    );
  } else if (results.planned.removalMethod === 'B' || results.planned.removalMethod === 'D') {
    const isMethodD = results.planned.removalMethod === 'D';
    const emulsifierConforms = meetsConvertedMeasuredMinimum(
      results.actualEmulsifierContactTime,
      results.actualEmulsifierContactTimeUnit,
      results.planned.emulsifierContactTime,
      results.planned.emulsifierContactTimeUnit,
      'time',
    ) && sameMeaningfulText(
      results.planned.emulsifierApplicationMethod,
      results.actualEmulsifierApplicationMethod,
    ) && (!isMethodD || sameMeasuredValue(
      results.planned.emulsifierConcentration,
      results.planned.emulsifierConcentrationUnit,
      results.actualEmulsifierConcentration,
      results.actualEmulsifierConcentrationUnit,
    ));
    requirements.push(
      requirement('results.emulsifierLot', 'Emulsifier Lot', 'results', meaningful(results.emulsifierLot), 'Record emulsifier lot traceability.'),
      requirement('results.actualEmulsifierContactTime', 'Actual Emulsifier Contact Time', 'results', positive(results.actualEmulsifierContactTime), 'Record the emulsifier contact time actually achieved.'),
      requirement('results.actualEmulsifierContactTimeUnit', 'Actual Emulsifier Contact Time Unit', 'results', present(results.actualEmulsifierContactTimeUnit), 'Record the actual emulsifier contact-time unit.'),
      requirement('results.actualEmulsifierApplicationMethod', 'Actual Emulsifier Application', 'results', meaningful(results.actualEmulsifierApplicationMethod), 'Record how emulsifier was actually applied.'),
      requirement('results.actualPostEmulsifierRinseDetails', 'Actual Post-emulsifier Rinse', 'results', meaningful(results.actualPostEmulsifierRinseDetails), 'Record the post-emulsifier rinse actually performed.'),
      requirement('results.actualEmulsifierContactTime', `Accepted Method ${results.planned.removalMethod} Emulsifier Controls`, 'results', !accepted || emulsifierConforms || hasDeviation, `Accepted Method ${results.planned.removalMethod} results require achieved emulsifier controls to match the approved plan or a documented controlled deviation.`),
      requirement('results.removerLot', 'Inactive Remover Lot', 'results', allEmpty(
        results.removerLot,
        results.planned.methodARinseInstructions,
        results.planned.methodARinsePressureMin,
        results.planned.methodARinsePressureMax,
        results.planned.methodARinsePressureUnit,
        results.planned.methodARinseTemperatureMin,
        results.planned.methodARinseTemperatureMax,
        results.planned.methodARinseTemperatureUnit,
        results.planned.methodCRemoverInstructions,
        results.actualMethodARinseDetails,
        results.actualMethodARinsePressure,
        results.actualMethodARinsePressureUnit,
        results.actualMethodARinseTemperature,
        results.actualMethodARinseTemperatureUnit,
        results.actualMethodCRemovalDetails,
      ), `Method ${results.planned.removalMethod} records must not retain inactive A/C planned or performed removal values.`),
    );
    if (isMethodD) {
      requirements.push(
        requirement('results.actualEmulsifierConcentration', 'Actual Method D Emulsifier Concentration', 'results', numberValue(results.actualEmulsifierConcentration) !== null && (numberValue(results.actualEmulsifierConcentration) ?? -1) >= 0, 'Record the achieved hydrophilic emulsifier concentration.'),
        requirement('results.actualEmulsifierConcentrationUnit', 'Actual Method D Emulsifier Concentration Unit', 'results', present(results.actualEmulsifierConcentrationUnit), 'Record the actual emulsifier-concentration unit.'),
        requirement('results.actualMethodDPreRinseDetails', 'Actual Method D Pre-rinse', 'results', meaningful(results.actualMethodDPreRinseDetails), 'Record the Method D pre-rinse actually performed.'),
        requirement('results.actualMethodDFinalRinseDetails', 'Actual Method D Final Rinse', 'results', meaningful(results.actualMethodDFinalRinseDetails), 'Record the Method D final rinse actually performed.'),
      );
    } else {
      requirements.push(requirement(
        'results.actualEmulsifierConcentration',
        'Inactive Method B Concentration and Method D Rinses',
        'results',
        allEmpty(
          results.planned.emulsifierConcentration,
          results.planned.emulsifierConcentrationUnit,
          results.actualEmulsifierConcentration,
          results.actualEmulsifierConcentrationUnit,
          results.planned.methodDPreRinseInstructions,
          results.planned.methodDFinalRinseInstructions,
          results.actualMethodDPreRinseDetails,
          results.actualMethodDFinalRinseDetails,
        ),
        'Method B records must not retain Method D hydrophilic concentration or D-only rinse values.',
      ));
    }
  } else if (results.planned.removalMethod === 'C') {
    requirements.push(
      requirement('results.removerLot', 'Remover Lot', 'results', meaningful(results.removerLot), 'Record remover lot traceability.'),
      requirement('results.actualMethodCRemovalDetails', 'Actual Method C Removal', 'results', meaningful(results.actualMethodCRemovalDetails), 'Record the solvent-removal step actually performed.'),
      requirement('results.emulsifierLot', 'Inactive Emulsifier Lot', 'results', allEmpty(
        results.emulsifierLot,
        results.planned.methodARinseInstructions,
        results.planned.methodARinsePressureMin,
        results.planned.methodARinsePressureMax,
        results.planned.methodARinsePressureUnit,
        results.planned.methodARinseTemperatureMin,
        results.planned.methodARinseTemperatureMax,
        results.planned.methodARinseTemperatureUnit,
        results.planned.emulsifierType,
        results.planned.emulsifierConcentration,
        results.planned.emulsifierConcentrationUnit,
        results.planned.emulsifierContactTime,
        results.planned.emulsifierContactTimeUnit,
        results.planned.emulsifierApplicationMethod,
        results.planned.postEmulsifierRinseInstructions,
        results.planned.methodDPreRinseInstructions,
        results.planned.methodDFinalRinseInstructions,
        results.actualMethodARinseDetails,
        results.actualMethodARinsePressure,
        results.actualMethodARinsePressureUnit,
        results.actualMethodARinseTemperature,
        results.actualMethodARinseTemperatureUnit,
        results.actualEmulsifierConcentration,
        results.actualEmulsifierConcentrationUnit,
        results.actualEmulsifierContactTime,
        results.actualEmulsifierContactTimeUnit,
        results.actualEmulsifierApplicationMethod,
        results.actualPostEmulsifierRinseDetails,
        results.actualMethodDPreRinseDetails,
        results.actualMethodDFinalRinseDetails,
      ), 'Method C records must not retain inactive A/B/D planned or performed removal values.'),
    );
  } else {
    requirements.push(
      requirement(
        'results.removerLot',
        'Inactive Unknown-method Removal Fields',
        'results',
        allEmpty(
          results.removerLot,
          results.emulsifierLot,
          results.planned.methodARinseInstructions,
          results.planned.methodARinsePressureMin,
          results.planned.methodARinsePressureMax,
          results.planned.methodARinsePressureUnit,
          results.planned.methodARinseTemperatureMin,
          results.planned.methodARinseTemperatureMax,
          results.planned.methodARinseTemperatureUnit,
          results.planned.emulsifierType,
          results.planned.emulsifierConcentration,
          results.planned.emulsifierConcentrationUnit,
          results.planned.emulsifierContactTime,
          results.planned.emulsifierContactTimeUnit,
          results.planned.emulsifierApplicationMethod,
          results.planned.postEmulsifierRinseInstructions,
          results.planned.methodCRemoverInstructions,
          results.planned.methodDPreRinseInstructions,
          results.planned.methodDFinalRinseInstructions,
          results.actualMethodARinseDetails,
          results.actualMethodARinsePressure,
          results.actualMethodARinsePressureUnit,
          results.actualMethodARinseTemperature,
          results.actualMethodARinseTemperatureUnit,
          results.actualEmulsifierConcentration,
          results.actualEmulsifierConcentrationUnit,
          results.actualEmulsifierContactTime,
          results.actualEmulsifierContactTimeUnit,
          results.actualEmulsifierApplicationMethod,
          results.actualPostEmulsifierRinseDetails,
          results.actualMethodCRemovalDetails,
          results.actualMethodDPreRinseDetails,
          results.actualMethodDFinalRinseDetails,
        ),
        'An unknown removal method must not retain any method-specific planned or performed values.',
      ),
    );
  }
  return requirements;
}

function frozenPlannedBasisMatches(
  report: RtPtInspectionReportV1,
  technique: RtPtDocumentV3,
): boolean {
  if (report.method !== technique.method) return false;
  const expected = createRtPtInspectionReport(technique);
  if (report.method === 'PT' && expected.method === 'PT') {
    return JSON.stringify(report.results.planned) === JSON.stringify(expected.results.planned);
  }
  if (report.method === 'RT-Film' && expected.method === 'RT-Film') {
    if (report.results.length !== expected.results.length) return false;
    const expectedById = new Map(expected.results.map((result) => [result.plannedItemId, result.planned]));
    return new Set(report.results.map((result) => result.plannedItemId)).size === report.results.length
      && report.results.every((result) => (
        expectedById.has(result.plannedItemId)
        && JSON.stringify(result.planned) === JSON.stringify(expectedById.get(result.plannedItemId))
      ));
  }
  if (report.method === 'RT-Digital' && expected.method === 'RT-Digital') {
    if (report.results.length !== expected.results.length) return false;
    const expectedById = new Map(expected.results.map((result) => [result.plannedItemId, result.planned]));
    return new Set(report.results.map((result) => result.plannedItemId)).size === report.results.length
      && report.results.every((result) => (
        expectedById.has(result.plannedItemId)
        && JSON.stringify(result.planned) === JSON.stringify(expectedById.get(result.plannedItemId))
      ));
  }
  return false;
}

function linkRequirements(report: RtPtInspectionReportV1, technique?: RtPtDocumentV3): Requirement[] {
  if (!technique) {
    return [requirement('sourceTechnique', 'Technique Verification', 'link', false, 'Open the linked technique to verify the report basis.')];
  }
  const currentValidation = validateRtPtDocument(technique);
  const expectedSource = createRtPtInspectionReport(technique).sourceTechnique;
  return [
    requirement('sourceTechnique.documentId', 'Technique Document ID', 'link', report.sourceTechnique.documentId === technique.documentId, 'The linked technique document ID does not match.'),
    requirement('sourceTechnique.method', 'Technique Method', 'link', report.method === technique.method && report.sourceTechnique.method === technique.method, 'The linked method does not match the report.'),
    requirement('sourceTechnique.documentNumber', 'Technique Number', 'link', report.sourceTechnique.documentNumber === technique.documentControl.number, 'The linked technique number has changed.'),
    requirement('sourceTechnique.title', 'Technique Title', 'link', report.sourceTechnique.title === technique.documentControl.title, 'The linked technique title has changed.'),
    requirement('sourceTechnique.revision', 'Technique Revision', 'link', report.sourceTechnique.revision === technique.documentControl.revision, 'The linked technique revision has changed.'),
    requirement('sourceTechnique.approvalDate', 'Technique Approval Date', 'link', report.sourceTechnique.approvalDate === expectedSource.approvalDate, 'The linked technique approval date has changed.'),
    requirement(
      'sourceTechnique.controlledReferences',
      'Frozen Controlled References',
      'link',
      JSON.stringify(report.sourceTechnique.controlledReferences) === JSON.stringify(technique.controlledReferences),
      'The frozen controlled-reference snapshot does not exactly match the linked approved technique. Start a new report from the current technique.',
    ),
    requirement(
      'sourceTechnique.approvedContentFingerprint',
      'Approved Technique Fingerprint',
      'link',
      report.sourceTechnique.approvedContentFingerprint === fingerprintRtPtApprovedContent(technique),
      'The technique content no longer matches the frozen report basis. Start a new report or restore the referenced approved revision.',
    ),
    requirement(
      'sourceTechnique.plannedBasis',
      'Frozen Planned Basis',
      'link',
      frozenPlannedBasisMatches(report, technique),
      'The report planned basis no longer matches the linked approved technique. Start a new report from the current technique.',
    ),
    requirement(
      'sourceTechnique',
      'Approved Technique Release',
      'link',
      technique.status === 'approved'
        && currentValidation.approvalReadiness.isReady
        && hasValidRtPtApprovalFingerprint(technique),
      'A controlled report requires an independently valid Approved technique with a current approval binding.',
    ),
  ];
}

export function validateRtPtInspectionReport(
  report: RtPtInspectionReportV1,
  technique?: RtPtDocumentV3,
): RtPtInspectionReportValidation {
  const dataRequirements = [
    ...commonRequirements(report),
    ...(report.method === 'RT-Film'
      ? filmRequirements(report)
      : report.method === 'RT-Digital'
        ? digitalRequirements(report)
        : ptRequirements(report)),
    ...indicationRequirements(report),
  ];
  const link = linkRequirements(report, technique);
  const performedApprovals = report.approvals.filter((approval) => approval.role === 'performed' && completeApproval(approval));
  const independentReviews = report.approvals.filter((approval) => (
    approval.role === 'reviewed' || approval.role === 'quality' || approval.role === 'ndt-level-3'
  ) && completeApproval(approval));
  const independentIdentity = independentReviews.some((reviewer) => (
    performedApprovals.every((performer) => !samePersonnelIdentity(performer, reviewer))
  ));
  const approvalRequirements = [
    requirement('approvals', 'Performed By Record', 'approvals', performedApprovals.length > 0, 'A complete performed-by personnel record is required.'),
    requirement('approvals', 'Independent Review Record', 'approvals', independentReviews.length > 0, 'A complete reviewer, quality, or NDT Level III record is required.'),
    requirement('approvals', 'Independent Review Identity', 'approvals', independentIdentity, 'Independent review must be recorded by personnel other than the performer.'),
    requirement('approvals', 'Approval Entry Integrity', 'approvals', report.approvals.every(completeApproval), 'Every personnel record must contain complete identity, certification, and date fields.'),
    requirement(
      'approvals',
      'Performed By Date Order',
      'approvals',
      performedApprovals.every((approval) => (
        approval.date >= report.reportControl.inspectionStart
        && approval.date <= report.reportControl.reportDate
      )),
      'Performed-by record dates must fall between inspection start and report issue date.',
    ),
    requirement(
      'approvals',
      'Independent Review Date Order',
      'approvals',
      independentReviews.every((approval) => (
        approval.date >= report.reportControl.inspectionEnd
        && approval.date <= report.reportControl.reportDate
      )),
      'Independent review record dates must be on or after inspection completion and no later than report issue.',
    ),
  ];
  const completedFieldsCount = dataRequirements.filter((item) => item.complete).length;
  const totalRequiredFields = dataRequirements.length;
  const isComplete = totalRequiredFields > 0 && completedFieldsCount === totalRequiredFields;
  const linkCurrent = link.every((item) => item.complete);
  const isApprovalReady = isComplete && linkCurrent && approvalRequirements.every((item) => item.complete);
  const issueSeverity: RtPtInspectionReportIssue['severity'] = report.status === 'approved' ? 'error' : 'warning';
  const issues = [...dataRequirements, ...link, ...approvalRequirements]
    .filter((item) => !item.complete)
    .map<RtPtInspectionReportIssue>((item) => ({
      path: item.path,
      label: item.label,
      section: item.section,
      message: item.message,
      severity: issueSeverity,
    }));
  return {
    completedFieldsCount,
    totalRequiredFields,
    completionPercent: totalRequiredFields === 0 ? 0 : Math.round((completedFieldsCount / totalRequiredFields) * 100),
    isComplete,
    isApprovalReady,
    linkCurrent,
    issues,
  };
}
