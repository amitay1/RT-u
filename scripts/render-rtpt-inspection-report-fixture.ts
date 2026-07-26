import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  createCompleteDigitalDocument,
  createCompleteFilmDocument,
  createCompletePtDocument,
} from '../src/lib/__tests__/rtPtV3Fixtures';
import { createRtPtInspectionReport } from '../src/lib/rtPtInspectionReport';
import { setRtPtInspectionReportStatus } from '../src/lib/rtPtInspectionReportLifecycle';
import { validateRtPtInspectionReport } from '../src/lib/rtPtInspectionReportValidation';
import type { RtPtDocumentV3, RtPtMethod } from '../src/types/rtPtDocument';
import type { RtPtInspectionReportStatus, RtPtInspectionReportV1 } from '../src/types/rtPtInspectionReport';
import { buildRtPtInspectionReportPdf } from '../src/utils/export/RtPtInspectionReportPDF';

const method = (process.argv[3] || 'RT-Film') as RtPtMethod;
const status = (process.argv[4] || 'draft') as RtPtInspectionReportStatus;

const technique: RtPtDocumentV3 = method === 'RT-Digital'
  ? createCompleteDigitalDocument('approved')
  : method === 'PT'
    ? createCompletePtDocument('D', 'Type I', 'approved')
    : createCompleteFilmDocument('approved');

let report = createRtPtInspectionReport(technique);
Object.assign(report.reportControl, {
  number: 'RPT-2026-0147',
  title: `${technique.technique.general.partName} Performed Inspection Report`,
  revision: 'A',
  reportDate: '2026-07-22',
  inspectionStart: '2026-07-21',
  inspectionEnd: '2026-07-22',
});
Object.assign(report.part, { serialOrLotNumber: 'SN-2026-0042', quantity: 1 });
Object.assign(report.equipment, {
  equipmentUsed: method === 'RT-Film'
    ? 'X-ray source XR-200; automatic processor P-1; densitometer DEN-4'
    : method === 'RT-Digital'
      ? 'X-ray source XR-200; DDA detector DDA-1; qualified viewer MON-1'
      : 'Qualified PT process family QF-1; UV-A meter METER-1; visible-light meter METER-2',
  calibrationReferences: method === 'PT'
    ? 'UV-A meter METER-1 / CAL-UV-1 Rev B; visible-light meter METER-2 / CAL-LUX-1 Rev A; current at inspection'
    : 'CAL-XR-1 Rev C; CAL-METER-1 Rev B; current at inspection',
  environmentalConditions: 'Controlled shop conditions recorded at time of inspection',
  deviations: 'None',
});
report.coverageStatement = method === 'PT'
  ? 'The complete specified inspection area was processed through every applicable penetrant step and examined under the required viewing conditions.'
  : 'All planned views and identified inspection zones were examined and recorded.';
report.overallDisposition = 'accepted';
report.dispositionReference = 'PRODUCT-SPEC-1 Rev B, clause 7.4';
report.remarks = 'Final disposition entered by authorized inspection personnel.';
report.approvals = [
  {
    role: 'performed',
    name: 'Inspector One',
    personnelId: 'EMP-100',
    certificationLevel: 'Level II',
    certificationNumber: 'CERT-100',
    certificationBasis: 'Controlled written practice Rev C',
    date: '2026-07-22',
  },
  {
    role: 'reviewed',
    name: 'Reviewer Two',
    personnelId: 'EMP-200',
    certificationLevel: 'Level III',
    certificationNumber: 'CERT-200',
    certificationBasis: 'Controlled written practice Rev C',
    date: '2026-07-22',
  },
];

if (report.method === 'RT-Film') {
  report.results = report.results.map((result, index) => ({
    ...result,
    filmId: `FILM-${String(index + 1).padStart(2, '0')}`,
    exposureDate: '2026-07-21',
    actualSfd: 110,
    actualSod: 100,
    actualOfd: 10,
    actualTubeVoltage: 120,
    actualTubeCurrent: 5,
    actualExposureTime: 2,
    actualExposureTimeUnit: 'min',
    densityMinimum: 2,
    densityMaximum: 3.4,
    iqiObserved: 'Required IQI detail visible',
    iqiRequirementMet: true,
    coverageConfirmed: true,
    result: 'accepted',
    remarks: 'Image reviewed on qualified viewer; no retake required.',
  }));
} else if (report.method === 'RT-Digital') {
  report.results = report.results.map((result, index) => ({
    ...result,
    imageId: `IMAGE-${String(index + 1).padStart(2, '0')}`,
    acquisitionDate: '2026-07-21',
    actualSdd: 110,
    actualSod: 100,
    actualOdd: 10,
    actualTubeVoltage: 120,
    actualTubeCurrent: 5,
    actualExposureTime: 2,
    actualIntegrationTime: 1,
    actualFramesAveraged: 4,
    achievedSnr: 'Normalized SNR 120',
    achievedCnr: 'CNR 8.5',
    iqiObserved: 'Required duplex-wire detail visible',
    iqiRequirementMet: true,
    snrRequirementMet: true,
    cnrRequirementMet: true,
    detectorControlReference: 'BPM-1 / CAL-1 / STAB-1',
    archiveReference: `DICONDE/WO-1/IMAGE-${String(index + 1).padStart(2, '0')}`,
    coverageConfirmed: true,
    result: 'accepted',
    remarks: 'Raw source data retained without destructive overwrite.',
  }));
} else {
  Object.assign(report.results, {
    penetrantLot: 'PEN-LOT-2407',
    penetrantExpiry: '2027-06-30',
    cleanerLot: 'CLEAN-LOT-2407',
    emulsifierLot: 'EMU-LOT-2407',
    developerLot: 'DEV-LOT-2407',
    actualCleaningMethod: 'Approved cleaning process',
    actualCleaningDetails: 'Contamination removed before penetrant application using the approved cleaning process.',
    actualSurfaceCondition: 'Clean and dry',
    actualDryingMethod: 'Air',
    actualDryingTime: 10,
    actualDryingTimeUnit: 'min',
    actualDryingTemperature: 25,
    actualDryingTemperatureUnit: 'degC',
    actualPenetrantApplicationMethod: 'Spray',
    partTemperature: 24,
    penetrantTemperature: 24,
    actualDwellTime: 20,
    actualDwellTimeUnit: 'min',
    actualDevelopmentTime: 10,
    actualDevelopmentTimeUnit: 'min',
    actualEmulsifierConcentration: 10,
    actualEmulsifierConcentrationUnit: '%',
    actualEmulsifierContactTime: 2,
    actualEmulsifierContactTimeUnit: 'min',
    actualEmulsifierApplicationMethod: 'Immersion',
    actualPostEmulsifierRinseDetails: 'Water rinse completed after emulsification.',
    actualMethodDPreRinseDetails: 'Controlled pre-rinse completed before hydrophilic emulsifier application.',
    actualMethodDFinalRinseDetails: 'Controlled final rinse completed after emulsification.',
    actualDeveloperApplicationMethod: 'Spray',
    actualDarkAdaptationTime: 5,
    actualDarkAdaptationTimeUnit: 'min',
    measuredUvA: 1250,
    measuredAmbientVisibleLight: 8,
    lightMeterId: 'METER-1 / CAL-UV-1 Rev B; METER-2 / CAL-LUX-1 Rev A',
    examinationTime: '14:30-14:55 local',
    postCleaningCompleted: true,
    coverageConfirmed: true,
  });
}

report.indications = [{
  id: 'indication-1',
  indicationId: 'IND-01',
  linkedResultId: report.method === 'PT' ? '' : report.results[0]?.id ?? '',
  location: 'Inspection zone 1 / grid A2',
  indicationType: 'Recorded indication',
  size: 1.5,
  sizeUnit: 'mm',
  evaluation: 'Evaluated against the recorded product acceptance reference',
  disposition: 'accepted',
  remarks: 'Evaluation retained in the performed inspection record.',
}];

if (status === 'approved') {
  const validation = validateRtPtInspectionReport(report, technique);
  if (!validation.isApprovalReady) {
    throw new Error(`Fixture is not approval ready: ${validation.issues.map((issue) => issue.label).join(', ')}`);
  }
  const inReview = setRtPtInspectionReportStatus(report, 'in-review', technique);
  report = setRtPtInspectionReportStatus(inReview, 'approved', technique) as RtPtInspectionReportV1;
} else {
  report = { ...report, status };
}

const outputPath = process.argv[2] || path.join(os.tmpdir(), `rtpt-${method}-${status}-inspection-report.pdf`);
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
const pdf = buildRtPtInspectionReportPdf(report, technique, validateRtPtInspectionReport(report, technique));
fs.writeFileSync(outputPath, Buffer.from(pdf.output('arraybuffer')));
process.stdout.write(outputPath);
