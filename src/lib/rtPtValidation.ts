import {
  calculateDigitalGeometricUnsharpness,
  calculateFilmGeometricUnsharpness,
  lengthToMillimeters,
} from '@/lib/rtGeometry';
import {
  calculateHoneycombRadiographicThickness,
  lookupPs811000DensityRequirement,
  lookupPs811000EnergySuggestion,
  lookupPs811000MaximumReadableDensity,
  lookupPs811000UgLimit,
  isThinAdhesiveTenKvpCase,
} from '@/lib/ps811000';
import type { LengthUnit, RtFilmExposureDefaults } from '@/types/rtFilm';
import type { RtPtDocumentV3, RtPtMethod } from '@/types/rtPtDocument';

export interface RtPtValidationIssue {
  path: string;
  label: string;
  tab: string;
  message: string;
  severity: 'error' | 'warning';
  scope?: 'draft' | 'approval' | 'migration';
}

export interface RtPtCompletenessResult {
  completedFieldsCount: number;
  totalRequiredFields: number;
  completionPercent: number;
  isComplete: boolean;
  issues: RtPtValidationIssue[];
}

export interface RtPtApprovalReadinessResult {
  completedRequirements: number;
  totalRequirements: number;
  completionPercent: number;
  isReady: boolean;
  issues: RtPtValidationIssue[];
}

export interface RtPtValidationSummary {
  method: RtPtMethod;
  draftCompleteness: RtPtCompletenessResult;
  approvalReadiness: RtPtApprovalReadinessResult;
  issues: RtPtValidationIssue[];
  completedFieldsCount: number;
  totalRequiredFields: number;
  completionPercent: number;
  isComplete: boolean;
  isApprovalReady: boolean;
}

interface RequiredField {
  path: string;
  label: string;
  tab: string;
  value: unknown;
  isValid?: (value: unknown) => boolean;
  invalidMessage?: string;
}

interface ApprovalRequirement {
  path: string;
  label: string;
  tab: string;
  complete: boolean;
  message: string;
}

const isPresent = (value: unknown): boolean => (
  typeof value === 'number'
    ? Number.isFinite(value)
    : typeof value === 'string'
      ? value.trim().length > 0
      : typeof value === 'boolean'
        ? true
        : value !== null && value !== undefined
);

const isMeaningfulControlledText = (value: unknown): boolean => (
  typeof value === 'string' && value.trim().length >= 2
);

const isIsoCalendarDate = (value: unknown): value is string => {
  if (typeof value !== 'string') return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < 1 || month < 1 || month > 12 || day < 1) return false;
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return day <= daysInMonth[month - 1];
};

const isRevisionDateOrderValid = (revisionDate: string, effectiveDate: string): boolean => (
  isIsoCalendarDate(revisionDate)
  && isIsoCalendarDate(effectiveDate)
  && revisionDate.trim() <= effectiveDate.trim()
);

const field = (
  path: string,
  label: string,
  tab: string,
  value: unknown,
  isValid: (value: unknown) => boolean = isPresent,
  invalidMessage = 'Required planned field is missing.',
): RequiredField => ({ path, label, tab, value, isValid, invalidMessage });

function commonGeneralFields(general: Extract<RtPtDocumentV3, { method: 'RT-Film' }>['technique']['general']): RequiredField[] {
  return [
    field('technique.general.partNumber', 'Part Number', 'general', general.partNumber),
    field('technique.general.vendorCode', 'Vendor Code', 'general', general.vendorCode),
    field(
      'technique.general.partRevisionOrConfiguration',
      'Part Revision / Configuration',
      'general',
      general.partRevisionOrConfiguration,
    ),
    field('technique.general.material', 'Material', 'general', general.material),
    field('technique.general.surfaceFinish', 'Surface Finish', 'general', general.surfaceFinish),
    field('technique.general.inspectionArea', 'Inspection Area', 'general', general.inspectionArea),
    field('technique.general.thickness', 'Nominal Thickness', 'general', general.thickness),
    field('technique.general.drawingReference', 'Drawing / Specification Reference', 'general', general.drawingReference),
    field('technique.general.procedureNumber', 'Procedure Number', 'general', general.procedureNumber),
    field('technique.general.inspectionStage', 'Inspection Stage', 'general', general.inspectionStage),
    field('technique.general.inspectorLevel', 'Required Inspector Level', 'general', general.inspectorLevel),
    field('technique.general.date', 'Technique Date', 'general', general.date),
  ];
}

function acceptanceFields(
  acceptance: Extract<RtPtDocumentV3, { method: 'RT-Film' }>['technique']['acceptance'],
): RequiredField[] {
  return [
    field('technique.acceptance.acceptanceStandard', 'Acceptance Source', 'acceptance', acceptance.acceptanceStandard),
    field('technique.acceptance.acceptanceClause', 'Acceptance Clause', 'acceptance', acceptance.acceptanceClause),
    field('technique.acceptance.acceptanceText', 'Acceptance Text', 'acceptance', acceptance.acceptanceText),
  ];
}

const thicknessPlanPresent = (value: unknown): boolean => {
  if (!value || typeof value !== 'object') return false;
  const plan = value as { description?: unknown; min?: unknown; max?: unknown };
  return isPresent(plan.description) || (isPresent(plan.min) && isPresent(plan.max));
};

function filmViewFields(
  document: Extract<RtPtDocumentV3, { method: 'RT-Film' }>,
): RequiredField[] {
  const sourceType = document.technique.source.sourceType;
  return document.technique.exposureViews.flatMap((view, index) => {
    const path = `technique.exposureViews[${index}]`;
    const fields = [
      field(`${path}.id`, `View ${index + 1} Stable ID`, 'views', view.id),
      field(`${path}.viewId`, `View ${index + 1} Controlled ID`, 'views', view.viewId),
      field(`${path}.description`, `View ${index + 1} Description`, 'views', view.description),
      field(`${path}.orientation`, `View ${index + 1} Orientation`, 'views', view.orientation),
      field(`${path}.inspectionZone`, `View ${index + 1} Inspection Zone`, 'views', view.inspectionZone),
      field(`${path}.wallTechnique`, `View ${index + 1} Wall Technique`, 'views', view.wallTechnique),
      field(`${path}.sfd`, `View ${index + 1} Planned SFD`, 'views', view.sfd),
      field(`${path}.sod`, `View ${index + 1} Planned SOD`, 'views', view.sod),
      field(`${path}.ofd`, `View ${index + 1} Planned OFD`, 'views', view.ofd),
      field(
        `${path}.thickness`,
        `View ${index + 1} Thickness Plan`,
        'views',
        { description: view.thicknessDescription, min: view.thicknessMin, max: view.thicknessMax },
        thicknessPlanPresent,
        'Enter a thickness description or both planned minimum and maximum thickness.',
      ),
      field(`${path}.exposureTime`, `View ${index + 1} Planned Exposure Time`, 'views', view.exposureTime),
      field(`${path}.exposureTimeUnit`, `View ${index + 1} Exposure Time Unit`, 'views', view.exposureTimeUnit),
      field(`${path}.filter`, `View ${index + 1} Filter`, 'views', view.filter),
      field(`${path}.collimation`, `View ${index + 1} Collimation`, 'views', view.collimation),
      field(`${path}.filmDesignation`, `View ${index + 1} Film Designation`, 'views', view.filmDesignation),
      field(`${path}.filmSize`, `View ${index + 1} Film Size`, 'views', view.filmSize),
      field(`${path}.maxParts`, `View ${index + 1} Maximum Parts`, 'views', view.maxParts),
      field(`${path}.maxCassettes`, `View ${index + 1} Maximum Cassettes`, 'views', view.maxCassettes),
      field(`${path}.beamAngle`, `View ${index + 1} Planned Beam Angle`, 'views', view.beamAngle),
      field(`${path}.overlap`, `View ${index + 1} Required Overlap`, 'views', view.overlap),
      field(`${path}.identification`, `View ${index + 1} Identification Plan`, 'views', view.identification),
    ];
    if (sourceType === 'X-ray') {
      fields.push(
        field(`${path}.tubeVoltage`, `View ${index + 1} Planned Tube Voltage`, 'views', view.tubeVoltage),
        field(`${path}.tubeCurrent`, `View ${index + 1} Planned Tube Current`, 'views', view.tubeCurrent),
      );
    }
    if (document.technique.ps811000Applicable) {
      fields.push(
        field(`${path}.ps811000ThicknessBasis`, `View ${index + 1} PS811000E Thickness Basis`, 'views', view.ps811000ThicknessBasis),
        field(`${path}.thicknessMax`, `View ${index + 1} Numeric Maximum Thickness`, 'views', view.thicknessMax),
      );
      if (sourceType === 'X-ray') {
        fields.push(
          field(`${path}.ps811000EnergyCurve`, `View ${index + 1} Figure 2 Material Curve`, 'views', view.ps811000EnergyCurve),
          field(`${path}.machineTechniqueReference`, `View ${index + 1} Machine Technique Table`, 'views', view.machineTechniqueReference),
        );
      }
      if (view.ps811000ThicknessBasis === 'honeycomb-components') {
        fields.push(
          field(`${path}.honeycombSkins`, `View ${index + 1} Honeycomb Skins Sum`, 'views', view.honeycombSkins),
          field(`${path}.honeycombAdhesive`, `View ${index + 1} Honeycomb Adhesive Sum`, 'views', view.honeycombAdhesive),
          field(`${path}.honeycombCapsOrFlanges`, `View ${index + 1} Honeycomb Caps / Flanges Sum`, 'views', view.honeycombCapsOrFlanges),
          field(`${path}.honeycombDoublersOrTriplers`, `View ${index + 1} Honeycomb Doublers / Triplers Sum`, 'views', view.honeycombDoublersOrTriplers),
        );
      }
    } else {
      fields.push(field(`${path}.requiredUg`, `View ${index + 1} Required Ug`, 'views', view.requiredUg));
    }
    return fields;
  });
}

function rtFilmFields(document: Extract<RtPtDocumentV3, { method: 'RT-Film' }>): RequiredField[] {
  const { general, source, filmSystem, iqi, acceptance } = document.technique;
  const fields = [
    ...commonGeneralFields(general),
    field('technique.source.sourceType', 'Radiation Source Type', 'source', source.sourceType),
    field('technique.source.manufacturer', 'Source Manufacturer', 'source', source.manufacturer),
    field('technique.source.model', 'Source Model', 'source', source.model),
    field('technique.source.serialNumber', 'Source Serial Number', 'source', source.serialNumber),
    field(
      'technique.source.calibrationRequirement',
      'Source Calibration Requirement',
      'source',
      source.calibrationRequirement,
    ),
    field('technique.filmSystem.manufacturer', 'Film Manufacturer', 'film', filmSystem.manufacturer),
    field('technique.filmSystem.filmDesignation', 'Film Designation', 'film', filmSystem.filmDesignation),
    field('technique.filmSystem.filmClass', 'Film Class', 'film', filmSystem.filmClass),
    field('technique.filmSystem.requiredDensityMin', 'Required Density Minimum', 'film', filmSystem.requiredDensityMin),
    field('technique.filmSystem.requiredDensityMax', 'Required Density Maximum', 'film', filmSystem.requiredDensityMax),
    field('technique.filmSystem.processingSystem', 'Processing System', 'film', filmSystem.processingSystem),
    field('technique.filmSystem.processingMethod', 'Processing Method', 'film', filmSystem.processingMethod),
    field('technique.filmSystem.processingTime', 'Planned Processing Time', 'film', filmSystem.processingTime),
    field('technique.filmSystem.processingTimeUnit', 'Processing Time Unit', 'film', filmSystem.processingTimeUnit),
    field('technique.filmSystem.processingTemperature', 'Planned Processing Temperature', 'film', filmSystem.processingTemperature),
    field(
      'technique.filmSystem.processingTemperatureTolerance',
      'Processing Temperature Tolerance',
      'film',
      filmSystem.processingTemperatureTolerance,
    ),
    field(
      'technique.filmSystem.processingTemperatureUnit',
      'Processing Temperature Unit',
      'film',
      filmSystem.processingTemperatureUnit,
    ),
    field('technique.filmSystem.frontScreen.material', 'Front Screen Material', 'film', filmSystem.frontScreen.material),
    field('technique.filmSystem.frontScreen.thickness', 'Front Screen Thickness', 'film', filmSystem.frontScreen.thickness),
    field('technique.filmSystem.backScreen.material', 'Back Screen Material', 'film', filmSystem.backScreen.material),
    field('technique.filmSystem.backScreen.thickness', 'Back Screen Thickness', 'film', filmSystem.backScreen.thickness),
    field('technique.iqi.type', 'IQI Type', 'iqi', iqi.type),
    field('technique.iqi.standard', 'IQI Standard', 'iqi', iqi.standard),
    field('technique.iqi.designation', 'IQI Designation', 'iqi', iqi.designation),
    field('technique.iqi.shim', 'IQI Shim', 'iqi', iqi.shim),
    field('technique.iqi.block', 'IQI Block', 'iqi', iqi.block),
    field('technique.iqi.material', 'IQI Material', 'iqi', iqi.material),
    field('technique.iqi.thickness', 'IQI Thickness', 'iqi', iqi.thickness),
    field('technique.iqi.placement', 'IQI Placement', 'iqi', iqi.placement),
    ...acceptanceFields(acceptance),
    ...filmViewFields(document),
  ];
  if (document.technique.ps811000Applicable) {
    fields.push(field('technique.filmSystem.viewingMode', 'Film Viewing Mode', 'film', filmSystem.viewingMode));
  } else {
    fields.push(field('technique.iqi.requiredUg', 'Required Geometric Unsharpness', 'iqi', iqi.requiredUg));
  }
  if (source.sourceType === 'X-ray') {
    fields.push(field('technique.source.xRay.focalSpotSize', 'Planned Focal Spot Size', 'source', source.xRay.focalSpotSize));
  } else if (source.sourceType === 'Gamma') {
    fields.push(
      field('technique.source.gamma.isotope', 'Gamma Isotope', 'source', source.gamma.isotope),
      field('technique.source.gamma.sourceId', 'Gamma Source ID', 'source', source.gamma.sourceId),
      field('technique.source.gamma.activity', 'Gamma Source Activity', 'source', source.gamma.activity),
      field('technique.source.gamma.activityUnit', 'Activity Unit', 'source', source.gamma.activityUnit),
      field(
        'technique.source.gamma.activityReferenceDate',
        'Activity Reference Date',
        'source',
        source.gamma.activityReferenceDate,
      ),
      field(
        'technique.source.gamma.effectiveSourceSize',
        'Effective Source Size',
        'source',
        source.gamma.effectiveSourceSize,
      ),
    );
  }
  return fields;
}

function digitalAcquisitionFields(
  document: Extract<RtPtDocumentV3, { method: 'RT-Digital' }>,
): RequiredField[] {
  return document.technique.acquisitions.flatMap((acquisition, index) => {
    const path = `technique.acquisitions[${index}]`;
    return [
      field(`${path}.id`, `Acquisition ${index + 1} Stable ID`, 'acquisitions', acquisition.id),
      field(`${path}.viewId`, `Acquisition ${index + 1} Controlled ID`, 'acquisitions', acquisition.viewId),
      field(`${path}.description`, `Acquisition ${index + 1} Description`, 'acquisitions', acquisition.description),
      field(`${path}.orientation`, `Acquisition ${index + 1} Orientation`, 'acquisitions', acquisition.orientation),
      field(`${path}.inspectionZone`, `Acquisition ${index + 1} Inspection Zone`, 'acquisitions', acquisition.inspectionZone),
      field(`${path}.wallTechnique`, `Acquisition ${index + 1} Wall Technique`, 'acquisitions', acquisition.wallTechnique),
      field(`${path}.sdd`, `Acquisition ${index + 1} Planned SDD`, 'acquisitions', acquisition.sdd),
      field(`${path}.sod`, `Acquisition ${index + 1} Planned SOD`, 'acquisitions', acquisition.sod),
      field(`${path}.odd`, `Acquisition ${index + 1} Planned ODD`, 'acquisitions', acquisition.odd),
      field(
        `${path}.thickness`,
        `Acquisition ${index + 1} Thickness Plan`,
        'acquisitions',
        { description: acquisition.thicknessDescription, min: acquisition.thicknessMin, max: acquisition.thicknessMax },
        thicknessPlanPresent,
        'Enter a thickness description or both planned minimum and maximum thickness.',
      ),
      field(`${path}.requiredUg`, `Acquisition ${index + 1} Required Ug`, 'acquisitions', acquisition.requiredUg),
      field(`${path}.tubeVoltage`, `Acquisition ${index + 1} Planned Tube Voltage`, 'acquisitions', acquisition.tubeVoltage),
      field(`${path}.tubeCurrent`, `Acquisition ${index + 1} Planned Tube Current`, 'acquisitions', acquisition.tubeCurrent),
      field(`${path}.exposureTime`, `Acquisition ${index + 1} Planned Exposure Time`, 'acquisitions', acquisition.exposureTime),
      field(`${path}.exposureTimeUnit`, `Acquisition ${index + 1} Exposure Time Unit`, 'acquisitions', acquisition.exposureTimeUnit),
      field(`${path}.integrationTime`, `Acquisition ${index + 1} Planned Integration Time`, 'acquisitions', acquisition.integrationTime),
      field(`${path}.integrationTimeUnit`, `Acquisition ${index + 1} Integration Time Unit`, 'acquisitions', acquisition.integrationTimeUnit),
      field(`${path}.frameCount`, `Acquisition ${index + 1} Frame Count`, 'acquisitions', acquisition.frameCount),
      field(`${path}.framesAveraged`, `Acquisition ${index + 1} Frames Averaged`, 'acquisitions', acquisition.framesAveraged),
      field(`${path}.filter`, `Acquisition ${index + 1} Filter`, 'acquisitions', acquisition.filter),
      field(`${path}.collimation`, `Acquisition ${index + 1} Collimation`, 'acquisitions', acquisition.collimation),
      field(`${path}.iqiOverride`, `Acquisition ${index + 1} IQI Requirement / Override`, 'acquisitions', acquisition.iqiOverride),
      field(`${path}.coverage`, `Acquisition ${index + 1} Coverage Plan`, 'acquisitions', acquisition.coverage),
      field(`${path}.imageNaming`, `Acquisition ${index + 1} Image Naming`, 'acquisitions', acquisition.imageNaming),
      field(`${path}.markingInstructions`, `Acquisition ${index + 1} Marking Instructions`, 'acquisitions', acquisition.markingInstructions),
    ];
  });
}

function rtDigitalFields(document: Extract<RtPtDocumentV3, { method: 'RT-Digital' }>): RequiredField[] {
  const {
    general,
    workflow,
    source,
    system,
    detectorPerformance,
    imageProcessing,
    displayAndStorage,
    iqi,
    acceptance,
  } = document.technique;
  return [
    ...commonGeneralFields(general),
    field('technique.workflow', 'DDA Workflow', 'source', workflow),
    field('technique.source.sourceType', 'X-ray Source Type', 'source', source.sourceType),
    field('technique.source.manufacturer', 'X-ray Source Manufacturer', 'source', source.manufacturer),
    field('technique.source.model', 'X-ray Source Model', 'source', source.model),
    field('technique.source.serialNumber', 'X-ray Source Serial Number', 'source', source.serialNumber),
    field(
      'technique.source.calibrationRequirement',
      'X-ray Source Calibration Requirement',
      'source',
      source.calibrationRequirement,
    ),
    field('technique.source.focalSpotSize', 'Planned Focal Spot Size', 'source', source.focalSpotSize),
    field('technique.system.ddaType', 'Detector Type', 'system', system.ddaType),
    field('technique.system.manufacturer', 'Detector Manufacturer', 'system', system.manufacturer),
    field('technique.system.model', 'Detector Model', 'system', system.model),
    field('technique.system.serialNumber', 'Detector Serial Number', 'system', system.serialNumber),
    field('technique.system.activeAreaWidth', 'Detector Active Area Width', 'system', system.activeAreaWidth),
    field('technique.system.activeAreaHeight', 'Detector Active Area Height', 'system', system.activeAreaHeight),
    field('technique.system.matrixColumns', 'Detector Matrix Columns', 'system', system.matrixColumns),
    field('technique.system.matrixRows', 'Detector Matrix Rows', 'system', system.matrixRows),
    field('technique.system.pixelSize', 'Detector Pixel Size', 'system', system.pixelSize),
    field('technique.system.bitDepth', 'Detector Bit Depth', 'system', system.bitDepth),
    field('technique.system.detectorMode', 'Detector Mode', 'system', system.detectorMode),
    field('technique.system.softwareName', 'Acquisition Software', 'system', system.softwareName),
    field('technique.system.softwareVersion', 'Acquisition Software Version', 'system', system.softwareVersion),
    field('technique.detectorPerformance.detectorSrb', 'Detector SRb', 'detector', detectorPerformance.detectorSrb),
    field('technique.detectorPerformance.imageSrb', 'Image SRb', 'detector', detectorPerformance.imageSrb),
    ...(['badPixelMap', 'calibration', 'stability'] as const).flatMap((key) => {
      const status = detectorPerformance[key];
      const label = key === 'badPixelMap' ? 'Bad-pixel Map' : key[0].toUpperCase() + key.slice(1);
      return [
        field(`technique.detectorPerformance.${key}.reference`, `${label} Reference`, 'detector', status.reference),
        field(`technique.detectorPerformance.${key}.date`, `${label} Date`, 'detector', status.date),
        field(`technique.detectorPerformance.${key}.dueDate`, `${label} Due Date`, 'detector', status.dueDate),
        field(`technique.detectorPerformance.${key}.status`, `${label} Status`, 'detector', status.status),
      ];
    }),
    field('technique.imageProcessing.processingProcedure', 'Image Processing Procedure', 'processing', imageProcessing.processingProcedure),
    field('technique.displayAndStorage.displayManufacturer', 'Display Manufacturer', 'storage', displayAndStorage.displayManufacturer),
    field('technique.displayAndStorage.displayModel', 'Display Model', 'storage', displayAndStorage.displayModel),
    field('technique.displayAndStorage.displaySerialNumber', 'Display Serial Number', 'storage', displayAndStorage.displaySerialNumber),
    field('technique.displayAndStorage.viewerSoftware', 'Viewer Software', 'storage', displayAndStorage.viewerSoftware),
    field('technique.displayAndStorage.viewerSoftwareVersion', 'Viewer Software Version', 'storage', displayAndStorage.viewerSoftwareVersion),
    field(
      'technique.displayAndStorage.displayQualificationReference',
      'Display Qualification Reference',
      'storage',
      displayAndStorage.displayQualificationReference,
    ),
    field('technique.displayAndStorage.storageFormat', 'Storage Format', 'storage', displayAndStorage.storageFormat),
    field('technique.displayAndStorage.archiveLocation', 'Archive Location', 'storage', displayAndStorage.archiveLocation),
    field('technique.displayAndStorage.retentionPeriod', 'Archive Retention', 'storage', displayAndStorage.retentionPeriod),
    field('technique.displayAndStorage.rawDataPreservation', 'Raw-data Preservation Plan', 'storage', displayAndStorage.rawDataPreservation),
    field('technique.iqi.type', 'IQI Type', 'iqi', iqi.type),
    field('technique.iqi.standard', 'IQI Standard', 'iqi', iqi.standard),
    field('technique.iqi.designation', 'IQI Designation', 'iqi', iqi.designation),
    field('technique.iqi.material', 'IQI Material', 'iqi', iqi.material),
    field('technique.iqi.thickness', 'IQI Thickness', 'iqi', iqi.thickness),
    field('technique.iqi.placement', 'IQI Placement', 'iqi', iqi.placement),
    field('technique.iqi.requiredUg', 'Required Geometric Unsharpness', 'iqi', iqi.requiredUg),
    field(
      'technique.iqi.requiredSnrOrNormalizedSnr',
      'Required SNR / Normalized SNR',
      'iqi',
      iqi.requiredSnrOrNormalizedSnr,
    ),
    field(
      'technique.iqi.requiredContrastSensitivityOrCnr',
      'Required Contrast Sensitivity / CNR',
      'iqi',
      iqi.requiredContrastSensitivityOrCnr,
    ),
    ...acceptanceFields(acceptance),
    ...digitalAcquisitionFields(document),
  ];
}

function productFields(
  basePath: string,
  label: string,
  tab: string,
  product: { manufacturer: string; designation: string },
): RequiredField[] {
  return [
    field(`${basePath}.manufacturer`, `${label} Manufacturer`, tab, product.manufacturer),
    field(`${basePath}.designation`, `${label} Designation`, tab, product.designation),
  ];
}

function ptFields(document: Extract<RtPtDocumentV3, { method: 'PT' }>): RequiredField[] {
  const {
    general,
    materials,
    surfacePrep,
    application,
    removal,
    development,
    conditions,
    acceptance,
    postCleaning,
  } = document.technique;
  const fields = [
    ...commonGeneralFields(general),
    field('technique.materials.penetrantType', 'Penetrant Type', 'materials', materials.penetrantType),
    field('technique.materials.method', 'Penetrant Method', 'materials', materials.method),
    field('technique.materials.systemFamily', 'Approved System Family', 'materials', materials.systemFamily),
    field('technique.materials.qualificationReference', 'Material Qualification Reference', 'materials', materials.qualificationReference),
    field('technique.materials.developerForm', 'Developer Form', 'materials', materials.developerForm),
    ...productFields('technique.materials.penetrant', 'Penetrant', 'materials', materials.penetrant),
    ...productFields('technique.materials.cleaner', 'Cleaner', 'materials', materials.cleaner),
    ...productFields('technique.materials.developer', 'Developer', 'materials', materials.developer),
    field('technique.surfacePrep.cleaningMethod', 'Pre-cleaning Method', 'surface', surfacePrep.cleaningMethod),
    field('technique.surfacePrep.cleaningDetails', 'Pre-cleaning Details', 'surface', surfacePrep.cleaningDetails),
    field('technique.surfacePrep.cleaningRestrictions', 'Cleaning Restrictions', 'surface', surfacePrep.cleaningRestrictions),
    field('technique.surfacePrep.surfaceCondition', 'Surface Condition', 'surface', surfacePrep.surfaceCondition),
    field('technique.surfacePrep.dryingMethod', 'Drying Method', 'surface', surfacePrep.dryingMethod),
    field('technique.surfacePrep.dryingTime', 'Planned Drying Time', 'surface', surfacePrep.dryingTime),
    field('technique.surfacePrep.dryingTimeUnit', 'Drying Time Unit', 'surface', surfacePrep.dryingTimeUnit),
    field('technique.surfacePrep.dryingTemperature', 'Planned Drying Temperature', 'surface', surfacePrep.dryingTemperature),
    field(
      'technique.surfacePrep.dryingTemperatureUnit',
      'Drying Temperature Unit',
      'surface',
      surfacePrep.dryingTemperatureUnit,
    ),
    field('technique.application.applicationMethod', 'Penetrant Application', 'application', application.applicationMethod),
    field('technique.application.dwellTime', 'Planned Penetrant Dwell Time', 'application', application.dwellTime),
    field('technique.application.dwellTimeUnit', 'Dwell Time Unit', 'application', application.dwellTimeUnit),
    field('technique.application.partTemperatureMin', 'Part Temperature Minimum', 'application', application.partTemperatureMin),
    field('technique.application.partTemperatureMax', 'Part Temperature Maximum', 'application', application.partTemperatureMax),
    field('technique.application.partTemperatureUnit', 'Part Temperature Unit', 'application', application.partTemperatureUnit),
    field(
      'technique.application.penetrantTemperatureMin',
      'Penetrant Temperature Minimum',
      'application',
      application.penetrantTemperatureMin,
    ),
    field(
      'technique.application.penetrantTemperatureMax',
      'Penetrant Temperature Maximum',
      'application',
      application.penetrantTemperatureMax,
    ),
    field(
      'technique.application.penetrantTemperatureUnit',
      'Penetrant Temperature Unit',
      'application',
      application.penetrantTemperatureUnit,
    ),
    field('technique.development.developerApplication', 'Developer Application', 'development', development.developerApplication),
    field('technique.development.developmentTime', 'Planned Development Time', 'development', development.developmentTime),
    field('technique.development.developmentTimeUnit', 'Development Time Unit', 'development', development.developmentTimeUnit),
    field('technique.development.instructions', 'Developer Instructions', 'development', development.instructions),
    field('technique.conditions.equipmentRequirements', 'Lighting Equipment Requirements', 'conditions', conditions.equipmentRequirements),
    ...acceptanceFields(acceptance),
    field('technique.postCleaning.instructions', 'Post-cleaning Instructions', 'postcleaning', postCleaning.instructions),
    field('technique.postCleaning.corrosionProtection', 'Corrosion Protection', 'postcleaning', postCleaning.corrosionProtection),
  ];

  if (materials.penetrantType === 'Type I') {
    fields.push(
      field('technique.materials.sensitivityLevel', 'Sensitivity Level', 'materials', materials.sensitivityLevel),
      field('technique.conditions.requiredUvAMin', 'Required UV-A Minimum', 'conditions', conditions.requiredUvAMin),
      field('technique.conditions.uvAUnit', 'UV-A Unit', 'conditions', conditions.uvAUnit),
      field(
        'technique.conditions.ambientVisibleLightMax',
        'Ambient Visible Light Maximum',
        'conditions',
        conditions.ambientVisibleLightMax,
      ),
      field('technique.conditions.visibleLightUnit', 'Visible Light Unit', 'conditions', conditions.visibleLightUnit),
      field('technique.conditions.darkAdaptationTime', 'Dark Adaptation Time', 'conditions', conditions.darkAdaptationTime),
      field(
        'technique.conditions.darkAdaptationTimeUnit',
        'Dark Adaptation Time Unit',
        'conditions',
        conditions.darkAdaptationTimeUnit,
      ),
    );
  } else if (materials.penetrantType === 'Type II') {
    fields.push(
      field('technique.conditions.whiteLightMin', 'Required White Light Minimum', 'conditions', conditions.whiteLightMin),
      field('technique.conditions.visibleLightUnit', 'Visible Light Unit', 'conditions', conditions.visibleLightUnit),
    );
  }

  if (materials.method === 'A') {
    fields.push(
      field('technique.removal.methodA.instructions', 'Method A Rinse Instructions', 'removal', removal.methodA.instructions),
      field('technique.removal.methodA.pressureMin', 'Method A Rinse Pressure Minimum', 'removal', removal.methodA.pressureMin),
      field('technique.removal.methodA.pressureMax', 'Method A Rinse Pressure Maximum', 'removal', removal.methodA.pressureMax),
      field('technique.removal.methodA.pressureUnit', 'Method A Rinse Pressure Unit', 'removal', removal.methodA.pressureUnit),
      field(
        'technique.removal.methodA.temperatureMin',
        'Method A Rinse Temperature Minimum',
        'removal',
        removal.methodA.temperatureMin,
      ),
      field(
        'technique.removal.methodA.temperatureMax',
        'Method A Rinse Temperature Maximum',
        'removal',
        removal.methodA.temperatureMax,
      ),
      field(
        'technique.removal.methodA.temperatureUnit',
        'Method A Rinse Temperature Unit',
        'removal',
        removal.methodA.temperatureUnit,
      ),
    );
  }
  if (materials.method === 'B' || materials.method === 'D') {
    fields.push(
      ...productFields('technique.materials.emulsifier', 'Emulsifier', 'materials', materials.emulsifier),
      field('technique.removal.methodBD.type', 'Emulsifier Type', 'removal', removal.methodBD.type),
      field('technique.removal.methodBD.contactTime', 'Emulsifier Contact Time', 'removal', removal.methodBD.contactTime),
      field('technique.removal.methodBD.contactTimeUnit', 'Emulsifier Contact Time Unit', 'removal', removal.methodBD.contactTimeUnit),
      field('technique.removal.methodBD.applicationMethod', 'Emulsifier Application', 'removal', removal.methodBD.applicationMethod),
      field(
        'technique.removal.methodBD.postEmulsifierRinseInstructions',
        'Post-emulsification Water-rinse Instructions',
        'removal',
        removal.methodBD.postEmulsifierRinseInstructions,
      ),
    );
  }
  if (materials.method === 'C') {
    fields.push(
      ...productFields('technique.materials.remover', 'Remover', 'materials', materials.remover),
      field(
        'technique.removal.methodC.removerInstructions',
        'Method C Remover Instructions',
        'removal',
        removal.methodC.removerInstructions,
      ),
    );
  }
  if (materials.method === 'D') {
    fields.push(
      field('technique.removal.methodBD.concentration', 'Hydrophilic Emulsifier Concentration', 'removal', removal.methodBD.concentration),
      field(
        'technique.removal.methodBD.concentrationUnit',
        'Hydrophilic Emulsifier Concentration Unit',
        'removal',
        removal.methodBD.concentrationUnit,
      ),
      field(
        'technique.removal.methodD.preRinseInstructions',
        'Method D Pre-rinse Instructions',
        'removal',
        removal.methodD.preRinseInstructions,
      ),
      field(
        'technique.removal.methodD.finalRinseInstructions',
        'Method D Final-rinse Instructions',
        'removal',
        removal.methodD.finalRinseInstructions,
      ),
    );
  }
  return fields;
}

function addIssue(
  issues: RtPtValidationIssue[],
  path: string,
  label: string,
  tab: string,
  message: string,
): void {
  issues.push({ path, label, tab, message, severity: 'error', scope: 'draft' });
}

function equalLengthSum(
  total: number,
  totalUnit: LengthUnit,
  first: number,
  firstUnit: LengthUnit,
  second: number,
  secondUnit: LengthUnit,
): boolean {
  const convertedTotal = lengthToMillimeters(total, totalUnit);
  const convertedParts = lengthToMillimeters(first, firstUnit) + lengthToMillimeters(second, secondUnit);
  const floatingPointAllowance = Number.EPSILON * 64 * Math.max(1, Math.abs(convertedTotal), Math.abs(convertedParts));
  return Math.abs(convertedTotal - convertedParts) <= floatingPointAllowance;
}

function ps811000EffectiveThickness(exposure: RtFilmExposureDefaults): number | '' {
  return exposure.ps811000ThicknessBasis === 'honeycomb-components'
    ? calculateHoneycombRadiographicThickness({
      skins: exposure.honeycombSkins,
      adhesive: exposure.honeycombAdhesive,
      capsOrFlanges: exposure.honeycombCapsOrFlanges,
      doublersOrTriplers: exposure.honeycombDoublersOrTriplers,
      unit: exposure.thicknessUnit,
    })
    : exposure.thicknessMax;
}

function ps811000UgLimitInOutputUnit(exposure: RtFilmExposureDefaults): number | null {
  const limit = lookupPs811000UgLimit(ps811000EffectiveThickness(exposure), exposure.thicknessUnit);
  if (!limit) return null;
  return exposure.requiredUgUnit === 'inch' ? limit.maximumInch : limit.maximumMm;
}

function checkPositive(
  issues: RtPtValidationIssue[],
  path: string,
  label: string,
  tab: string,
  value: number | '',
  allowZero = false,
): void {
  if (typeof value === 'number' && (allowZero ? value < 0 : value <= 0)) {
    addIssue(
      issues,
      path,
      label,
      tab,
      allowZero ? 'The planned value cannot be negative.' : 'The planned value must be greater than zero.',
    );
  }
}

function checkPositiveInteger(
  issues: RtPtValidationIssue[],
  path: string,
  label: string,
  tab: string,
  value: number | '',
): void {
  if (typeof value === 'number' && (!Number.isInteger(value) || value <= 0)) {
    addIssue(issues, path, label, tab, 'The planned count must be a positive whole number.');
  }
}

function checkRange(
  issues: RtPtValidationIssue[],
  path: string,
  label: string,
  tab: string,
  min: number | '',
  max: number | '',
): void {
  if (typeof min === 'number' && typeof max === 'number' && min > max) {
    addIssue(issues, path, label, tab, 'The planned minimum cannot exceed the planned maximum.');
  }
}

function addCrossFieldIssues(document: RtPtDocumentV3, issues: RtPtValidationIssue[]): void {
  const { documentControl } = document;
  const controlledTextChecks: Array<[string, string, string, string]> = [
    ['documentId', 'Document ID', 'control', document.documentId],
    ['documentControl.number', 'Document Number', 'control', documentControl.number],
    ['documentControl.title', 'Document Title', 'control', documentControl.title],
    ['documentControl.changeSummary', 'Change Summary', 'control', documentControl.changeSummary],
  ];
  controlledTextChecks.forEach(([path, label, tab, value]) => {
    if (isPresent(value) && !isMeaningfulControlledText(value)) {
      addIssue(issues, path, label, tab, 'Enter a meaningful controlled value of at least two characters.');
    }
  });

  ([
    ['documentControl.revisionDate', 'Revision Date', documentControl.revisionDate],
    ['documentControl.effectiveDate', 'Effective Date', documentControl.effectiveDate],
  ] as const).forEach(([path, label, value]) => {
    if (isPresent(value) && !isIsoCalendarDate(value)) {
      addIssue(issues, path, label, 'control', 'Enter a real calendar date in YYYY-MM-DD format.');
    }
  });
  if (
    isIsoCalendarDate(documentControl.revisionDate)
    && isIsoCalendarDate(documentControl.effectiveDate)
    && !isRevisionDateOrderValid(documentControl.revisionDate, documentControl.effectiveDate)
  ) {
    addIssue(
      issues,
      'documentControl.effectiveDate',
      'Effective Date',
      'control',
      'The effective date cannot be earlier than the revision date.',
    );
  }

  if (isPresent(document.technique.general.date) && !isIsoCalendarDate(document.technique.general.date)) {
    addIssue(
      issues,
      'technique.general.date',
      'Technique Date',
      'general',
      'Enter a real calendar date in YYYY-MM-DD format.',
    );
  }

  const normalizedRevisionIds = document.revisionHistory.map((entry) => entry.id.trim().toLocaleLowerCase());
  const normalizedRevisions = document.revisionHistory.map((entry) => entry.revision.trim().toLocaleLowerCase());
  if (
    normalizedRevisionIds.some((id) => id.length < 2)
    || new Set(normalizedRevisionIds).size !== normalizedRevisionIds.length
  ) {
    addIssue(
      issues,
      'revisionHistory',
      'Revision History IDs',
      'control',
      'Every revision-history entry must have a meaningful, unique stable ID.',
    );
  }
  if (
    normalizedRevisions.some((revision) => revision.length === 0)
    || new Set(normalizedRevisions).size !== normalizedRevisions.length
  ) {
    addIssue(
      issues,
      'revisionHistory',
      'Revision History Revisions',
      'control',
      'Every revision-history entry must identify one unique revision.',
    );
  }
  document.revisionHistory.forEach((entry, index) => {
    const path = `revisionHistory[${index}]`;
    if (!isIsoCalendarDate(entry.date)) {
      addIssue(issues, `${path}.date`, `Revision ${index + 1} Date`, 'control', 'Enter a real calendar date in YYYY-MM-DD format.');
    }
    if (!isMeaningfulControlledText(entry.description)) {
      addIssue(issues, `${path}.description`, `Revision ${index + 1} Description`, 'control', 'Enter a meaningful revision description.');
    }
    if (!isMeaningfulControlledText(entry.author)) {
      addIssue(issues, `${path}.author`, `Revision ${index + 1} Author`, 'control', 'Enter a meaningful author identity.');
    }
  });

  document.controlledReferences.forEach((reference, index) => {
    const path = `controlledReferences[${index}]`;
    ([
      ['type', 'Type', reference.type],
      ['title', 'Title', reference.title],
      ['number', 'Number', reference.number],
    ] as const).forEach(([key, label, value]) => {
      if (!isMeaningfulControlledText(value)) {
        addIssue(issues, `${path}.${key}`, `Reference ${index + 1} ${label}`, 'control', 'Enter a meaningful controlled reference value.');
      }
    });
    if (!isPresent(reference.revision)) {
      addIssue(issues, `${path}.revision`, `Reference ${index + 1} Revision`, 'control', 'Enter the explicit controlled revision.');
    }
    if (isPresent(reference.clauseOrNote) && !isMeaningfulControlledText(reference.clauseOrNote)) {
      addIssue(issues, `${path}.clauseOrNote`, `Reference ${index + 1} Clause / Note`, 'control', 'Enter a meaningful clause or note, or leave it blank.');
    }
  });

  document.approvals.forEach((approval, index) => {
    const path = `approvals[${index}]`;
    ([
      ['name', 'Name', approval.name],
      ['personnelId', 'Personnel ID', approval.personnelId],
      ['certificationBasis', 'Certification Basis', approval.certificationBasis],
    ] as const).forEach(([key, label, value]) => {
      if (!isMeaningfulControlledText(value)) {
        addIssue(issues, `${path}.${key}`, `Approval ${index + 1} ${label}`, 'control', 'Enter a meaningful approval value.');
      }
    });
    if (!isPresent(approval.certificationRevision)) {
      addIssue(issues, `${path}.certificationRevision`, `Approval ${index + 1} Certification Revision`, 'control', 'Enter the certification-basis revision.');
    }
    if (!isIsoCalendarDate(approval.date)) {
      addIssue(issues, `${path}.date`, `Approval ${index + 1} Date`, 'control', 'Enter a real calendar date in YYYY-MM-DD format.');
    }
  });

  if (document.method === 'RT-Film') {
    const {
      ps811000Applicable,
      source,
      filmSystem,
      exposureDefaults,
      exposureViews,
    } = document.technique;
    checkRange(
      issues,
      'technique.filmSystem.requiredDensityMin',
      'Required Density Range',
      'film',
      filmSystem.requiredDensityMin,
      filmSystem.requiredDensityMax,
    );
    checkPositive(issues, 'technique.general.thickness', 'Nominal Thickness', 'general', document.technique.general.thickness);
    checkPositive(issues, 'technique.filmSystem.requiredDensityMin', 'Required Density Minimum', 'film', filmSystem.requiredDensityMin);
    checkPositive(issues, 'technique.filmSystem.requiredDensityMax', 'Required Density Maximum', 'film', filmSystem.requiredDensityMax);
    checkPositive(issues, 'technique.filmSystem.processingTime', 'Planned Processing Time', 'film', filmSystem.processingTime);
    checkPositive(
      issues,
      'technique.filmSystem.processingTemperatureTolerance',
      'Processing Temperature Tolerance',
      'film',
      filmSystem.processingTemperatureTolerance,
      true,
    );
    checkPositive(issues, 'technique.filmSystem.frontScreen.thickness', 'Front Screen Thickness', 'film', filmSystem.frontScreen.thickness, true);
    checkPositive(issues, 'technique.filmSystem.backScreen.thickness', 'Back Screen Thickness', 'film', filmSystem.backScreen.thickness, true);
    checkPositive(issues, 'technique.iqi.thickness', 'IQI Thickness', 'iqi', document.technique.iqi.thickness);
    if (!ps811000Applicable || isPresent(document.technique.iqi.requiredUg)) {
      checkPositive(issues, 'technique.iqi.requiredUg', 'Required Ug', 'iqi', document.technique.iqi.requiredUg, true);
    }
    if (ps811000Applicable && filmSystem.viewingMode) {
      const densityRequirement = lookupPs811000DensityRequirement(filmSystem.viewingMode);
      const specialApproval = isMeaningfulControlledText(filmSystem.specialDensityApprovalReference);
      if (
        typeof filmSystem.requiredDensityMin === 'number'
        && filmSystem.requiredDensityMin < densityRequirement.combinedMinimum
        && !(filmSystem.viewingMode === 'single' && specialApproval)
      ) {
        addIssue(
          issues,
          'technique.filmSystem.requiredDensityMin',
          'PS811000E Density Minimum',
          'film',
          `The planned ${filmSystem.viewingMode} viewing density minimum is below the applicable ${densityRequirement.combinedMinimum} H&D lookup.`,
        );
      }
      if (
        typeof filmSystem.requiredDensityMax === 'number'
        && filmSystem.requiredDensityMax > densityRequirement.maximum
        && !(filmSystem.viewingMode === 'single' && specialApproval)
      ) {
        addIssue(
          issues,
          'technique.filmSystem.requiredDensityMax',
          'PS811000E Density Maximum',
          'film',
          `The planned density maximum exceeds ${densityRequirement.maximum} H&D without an applicable controlled special-approval reference.`,
        );
      }
      if (
        densityRequirement.individualFilmMinimum !== null
        && (
          typeof filmSystem.individualFilmDensityMinimum !== 'number'
          || filmSystem.individualFilmDensityMinimum < densityRequirement.individualFilmMinimum
        )
      ) {
        addIssue(
          issues,
          'technique.filmSystem.individualFilmDensityMinimum',
          'Individual Film Density Minimum',
          'film',
          `Superimposed viewing requires each individual film to be at least ${densityRequirement.individualFilmMinimum} H&D.`,
        );
      }
      const viewerLimit = lookupPs811000MaximumReadableDensity(filmSystem.viewerOutputCandelaPerSquareMeter);
      if (
        viewerLimit
        && typeof filmSystem.requiredDensityMax === 'number'
        && filmSystem.requiredDensityMax > viewerLimit.value
      ) {
        addIssue(
          issues,
          'technique.filmSystem.viewerOutputCandelaPerSquareMeter',
          'Film Viewer Density Capability',
          'film',
          `The digitized Figure 1 lookup supports approximately ${viewerLimit.value} H&D, below the planned maximum density.`,
        );
      }
      if (filmSystem.boeingPart && !isMeaningfulControlledText(filmSystem.boeingViewerLimitReference)) {
        addIssue(
          issues,
          'technique.filmSystem.boeingViewerLimitReference',
          'Boeing Viewer Limit Reference',
          'film',
          'Enter the applicable controlled customer viewer-limit reference for a Boeing part.',
        );
      }
    }
    if (source.sourceType === 'X-ray') {
      checkPositive(issues, 'technique.source.xRay.focalSpotSize', 'Focal Spot Size', 'source', source.xRay.focalSpotSize);
    } else if (source.sourceType === 'Gamma') {
      checkPositive(issues, 'technique.source.gamma.activity', 'Gamma Source Activity', 'source', source.gamma.activity);
      checkPositive(
        issues,
        'technique.source.gamma.effectiveSourceSize',
        'Effective Source Size',
        'source',
        source.gamma.effectiveSourceSize,
      );
      if (isPresent(source.gamma.activityReferenceDate) && !isIsoCalendarDate(source.gamma.activityReferenceDate)) {
        addIssue(
          issues,
          'technique.source.gamma.activityReferenceDate',
          'Gamma Activity Reference Date',
          'source',
          'Enter a real calendar date in YYYY-MM-DD format.',
        );
      }
    }
    const gammaBranchHasData = [
      source.gamma.isotope,
      source.gamma.sourceId,
      source.gamma.activity,
      source.gamma.activityUnit,
      source.gamma.activityReferenceDate,
      source.gamma.effectiveSourceSize,
    ].some(isPresent);
    if (source.sourceType === 'X-ray' && gammaBranchHasData) {
      addIssue(
        issues,
        'technique.source.gamma',
        'Inactive Gamma Source Data',
        'source',
        'Gamma-source fields must be cleared when the planned source is X-ray.',
      );
    }
    if (source.sourceType === 'Gamma' && isPresent(source.xRay.focalSpotSize)) {
      addIssue(
        issues,
        'technique.source.xRay',
        'Inactive X-ray Source Data',
        'source',
        'X-ray focal-spot data must be cleared when the planned source is Gamma.',
      );
    }
    if (
      typeof exposureDefaults.sfd === 'number'
      && typeof exposureDefaults.sod === 'number'
      && typeof exposureDefaults.ofd === 'number'
      && !equalLengthSum(
        exposureDefaults.sfd,
        exposureDefaults.sfdUnit,
        exposureDefaults.sod,
        exposureDefaults.sodUnit,
        exposureDefaults.ofd,
        exposureDefaults.ofdUnit,
      )
    ) {
      addIssue(
        issues,
        'technique.exposureDefaults.sfd',
        'Default Exposure Geometry',
        'views',
        'Planned default SFD must equal planned SOD + OFD after unit conversion.',
      );
    }
    const defaultFilmUg = calculateFilmGeometricUnsharpness(exposureDefaults, source);
    const defaultPsUgLimit = ps811000Applicable ? ps811000UgLimitInOutputUnit(exposureDefaults) : null;
    const defaultAppliedUgLimit = typeof exposureDefaults.requiredUg === 'number' && defaultPsUgLimit !== null
      ? Math.min(exposureDefaults.requiredUg, defaultPsUgLimit)
      : typeof exposureDefaults.requiredUg === 'number'
        ? exposureDefaults.requiredUg
        : defaultPsUgLimit;
    if (
      typeof defaultFilmUg === 'number'
      && defaultAppliedUgLimit !== null
      && defaultFilmUg > defaultAppliedUgLimit
    ) {
      addIssue(
        issues,
        'technique.exposureDefaults.requiredUg',
        'Default Required Ug',
        'views',
        ps811000Applicable
          ? `Calculated default Ug (${defaultFilmUg} ${exposureDefaults.requiredUgUnit}) exceeds the Table 8 limit or a stricter controlled override (${defaultAppliedUgLimit} ${exposureDefaults.requiredUgUnit}).`
          : `Calculated default Ug (${defaultFilmUg} ${exposureDefaults.requiredUgUnit}) exceeds the user-specified required Ug (${defaultAppliedUgLimit} ${exposureDefaults.requiredUgUnit}).`,
      );
    }
    exposureViews.forEach((view, index) => {
      const path = `technique.exposureViews[${index}]`;
      checkPositive(issues, `${path}.sfd`, `View ${index + 1} SFD`, 'views', view.sfd);
      checkPositive(issues, `${path}.sod`, `View ${index + 1} SOD`, 'views', view.sod);
      checkPositive(issues, `${path}.ofd`, `View ${index + 1} OFD`, 'views', view.ofd, true);
      if (!ps811000Applicable || isPresent(view.requiredUg)) {
        checkPositive(issues, `${path}.requiredUg`, `View ${index + 1} Required Ug`, 'views', view.requiredUg, true);
      }
      checkPositive(issues, `${path}.exposureTime`, `View ${index + 1} Exposure Time`, 'views', view.exposureTime);
      checkPositiveInteger(issues, `${path}.maxParts`, `View ${index + 1} Maximum Parts`, 'views', view.maxParts);
      checkPositiveInteger(issues, `${path}.maxCassettes`, `View ${index + 1} Maximum Cassettes`, 'views', view.maxCassettes);
      if (source.sourceType === 'X-ray') {
        checkPositive(issues, `${path}.tubeVoltage`, `View ${index + 1} Tube Voltage`, 'views', view.tubeVoltage);
        checkPositive(issues, `${path}.tubeCurrent`, `View ${index + 1} Tube Current`, 'views', view.tubeCurrent);
      }
      if (
        typeof view.sfd === 'number'
        && typeof view.sod === 'number'
        && typeof view.ofd === 'number'
        && !equalLengthSum(view.sfd, view.sfdUnit, view.sod, view.sodUnit, view.ofd, view.ofdUnit)
      ) {
        addIssue(issues, `${path}.sfd`, `View ${index + 1} Geometry`, 'views', 'Planned SFD must equal planned SOD + OFD after unit conversion.');
      }
      checkRange(issues, `${path}.thicknessMin`, `View ${index + 1} Thickness Range`, 'views', view.thicknessMin, view.thicknessMax);
      checkPositive(issues, `${path}.thicknessMin`, `View ${index + 1} Thickness Minimum`, 'views', view.thicknessMin);
      checkPositive(issues, `${path}.thicknessMax`, `View ${index + 1} Thickness Maximum`, 'views', view.thicknessMax);
      const calculatedUg = calculateFilmGeometricUnsharpness(view, source);
      const tableUgLimit = ps811000Applicable ? ps811000UgLimitInOutputUnit(view) : null;
      const appliedUgLimit = typeof view.requiredUg === 'number' && tableUgLimit !== null
        ? Math.min(view.requiredUg, tableUgLimit)
        : typeof view.requiredUg === 'number'
          ? view.requiredUg
          : tableUgLimit;
      if (typeof calculatedUg === 'number' && appliedUgLimit !== null && calculatedUg > appliedUgLimit) {
        addIssue(
          issues,
          `${path}.requiredUg`,
          `View ${index + 1} Required Ug`,
          'views',
          ps811000Applicable
            ? `Calculated Ug (${calculatedUg} ${view.requiredUgUnit}) exceeds the Table 8 limit or a stricter controlled override (${appliedUgLimit} ${view.requiredUgUnit}).`
            : `Calculated Ug (${calculatedUg} ${view.requiredUgUnit}) exceeds the user-specified required Ug (${appliedUgLimit} ${view.requiredUgUnit}).`,
        );
      }
      if (ps811000Applicable && source.sourceType === 'X-ray' && view.ps811000EnergyCurve) {
        const effectiveThickness = ps811000EffectiveThickness(view);
        const thinAdhesiveCase = isThinAdhesiveTenKvpCase(
          view.ps811000EnergyCurve,
          effectiveThickness,
          view.thicknessUnit,
        );
        if (thinAdhesiveCase) {
          if (typeof view.tubeVoltage === 'number' && view.tubeVoltage > 10) {
            addIssue(
              issues,
              `${path}.tubeVoltage`,
              `View ${index + 1} Thin Adhesive Energy`,
              'views',
              'The thin-adhesive Figure 2 note limits the planned energy to 10 kVp maximum.',
            );
          }
        } else {
          const suggestion = lookupPs811000EnergySuggestion(
            view.ps811000EnergyCurve,
            effectiveThickness,
            view.thicknessUnit,
          );
          if (!suggestion) {
            addIssue(
              issues,
              `${path}.thicknessMax`,
              `View ${index + 1} Figure 2 Range`,
              'views',
              'The selected material/thickness is outside the digitized Figure 2 range and requires manual controlled review.',
            );
          } else if (
            typeof view.tubeVoltage === 'number'
            && (view.tubeVoltage < suggestion.lowerKvp || view.tubeVoltage > suggestion.upperKvp)
          ) {
            addIssue(
              issues,
              `${path}.tubeVoltage`,
              `View ${index + 1} Figure 2 Energy Band`,
              'views',
              `The planned voltage is outside the approximate ${suggestion.lowerKvp}-${suggestion.upperKvp} kVp digitized graph band.`,
            );
          }
        }
      }
      if (source.sourceType === 'Gamma' && (isPresent(view.tubeVoltage) || isPresent(view.tubeCurrent))) {
        addIssue(
          issues,
          `${path}.tubeVoltage`,
          `View ${index + 1} Source-specific Exposure`,
          'views',
          'Tube voltage and current do not apply to a Gamma exposure view.',
        );
      }
    });
  } else if (document.method === 'RT-Digital') {
    const { workflow, source, acquisitionDefaults, acquisitions } = document.technique;
    const { detectorPerformance } = document.technique;

    (['badPixelMap', 'calibration', 'stability'] as const).forEach((key) => {
      const status = detectorPerformance[key];
      const label = key === 'badPixelMap' ? 'Bad-pixel Map' : key[0].toUpperCase() + key.slice(1);
      if (isPresent(status.date) && !isIsoCalendarDate(status.date)) {
        addIssue(
          issues,
          `technique.detectorPerformance.${key}.date`,
          `${label} Date`,
          'detector',
          'Enter a real calendar date in YYYY-MM-DD format.',
        );
      }
      if (isPresent(status.dueDate) && !isIsoCalendarDate(status.dueDate)) {
        addIssue(
          issues,
          `technique.detectorPerformance.${key}.dueDate`,
          `${label} Due Date`,
          'detector',
          'Enter a real calendar date in YYYY-MM-DD format.',
        );
      }
      if (isIsoCalendarDate(status.date) && isIsoCalendarDate(status.dueDate) && status.date > status.dueDate) {
        addIssue(
          issues,
          `technique.detectorPerformance.${key}.dueDate`,
          `${label} Due Date`,
          'detector',
          'The due date cannot be earlier than the qualification or calibration date.',
        );
      }
    });
    if (workflow && workflow !== 'Static') {
      addIssue(issues, 'technique.workflow', 'DDA Workflow', 'source', 'The V3 E2698 workflow is static acquisition only.');
    }
    if (source.sourceType && source.sourceType !== 'X-ray') {
      addIssue(issues, 'technique.source.sourceType', 'DDA Source', 'source', 'The V3 E2698 workflow requires an X-ray generating source.');
    }
    checkPositive(issues, 'technique.general.thickness', 'Nominal Thickness', 'general', document.technique.general.thickness);
    checkPositive(issues, 'technique.source.focalSpotSize', 'Focal Spot Size', 'source', source.focalSpotSize);
    checkPositive(issues, 'technique.system.activeAreaWidth', 'Detector Active Area Width', 'system', document.technique.system.activeAreaWidth);
    checkPositive(issues, 'technique.system.activeAreaHeight', 'Detector Active Area Height', 'system', document.technique.system.activeAreaHeight);
    checkPositiveInteger(issues, 'technique.system.matrixColumns', 'Detector Matrix Columns', 'system', document.technique.system.matrixColumns);
    checkPositiveInteger(issues, 'technique.system.matrixRows', 'Detector Matrix Rows', 'system', document.technique.system.matrixRows);
    checkPositive(issues, 'technique.system.pixelSize', 'Detector Pixel Size', 'system', document.technique.system.pixelSize);
    checkPositiveInteger(issues, 'technique.system.bitDepth', 'Detector Bit Depth', 'system', document.technique.system.bitDepth);
    checkPositive(issues, 'technique.detectorPerformance.detectorSrb', 'Detector SRb', 'detector', document.technique.detectorPerformance.detectorSrb);
    checkPositive(issues, 'technique.detectorPerformance.imageSrb', 'Image SRb', 'detector', document.technique.detectorPerformance.imageSrb);
    if (
      typeof acquisitionDefaults.sdd === 'number'
      && typeof acquisitionDefaults.sod === 'number'
      && typeof acquisitionDefaults.odd === 'number'
      && !equalLengthSum(
        acquisitionDefaults.sdd,
        acquisitionDefaults.sddUnit,
        acquisitionDefaults.sod,
        acquisitionDefaults.sodUnit,
        acquisitionDefaults.odd,
        acquisitionDefaults.oddUnit,
      )
    ) {
      addIssue(
        issues,
        'technique.acquisitionDefaults.sdd',
        'Default Acquisition Geometry',
        'acquisitions',
        'Planned default SDD must equal planned SOD + ODD after unit conversion.',
      );
    }
    const defaultDigitalUg = calculateDigitalGeometricUnsharpness(acquisitionDefaults, source);
    if (
      typeof defaultDigitalUg === 'number'
      && typeof acquisitionDefaults.requiredUg === 'number'
      && defaultDigitalUg > acquisitionDefaults.requiredUg
    ) {
      addIssue(
        issues,
        'technique.acquisitionDefaults.requiredUg',
        'Default Required Ug',
        'acquisitions',
        `Calculated default Ug (${defaultDigitalUg} ${acquisitionDefaults.requiredUgUnit}) exceeds the user-specified required Ug (${acquisitionDefaults.requiredUg} ${acquisitionDefaults.requiredUgUnit}).`,
      );
    }
    acquisitions.forEach((acquisition, index) => {
      const path = `technique.acquisitions[${index}]`;
      checkPositive(issues, `${path}.sdd`, `Acquisition ${index + 1} SDD`, 'acquisitions', acquisition.sdd);
      checkPositive(issues, `${path}.sod`, `Acquisition ${index + 1} SOD`, 'acquisitions', acquisition.sod);
      checkPositive(issues, `${path}.odd`, `Acquisition ${index + 1} ODD`, 'acquisitions', acquisition.odd, true);
      checkPositive(issues, `${path}.requiredUg`, `Acquisition ${index + 1} Required Ug`, 'acquisitions', acquisition.requiredUg, true);
      checkPositive(issues, `${path}.tubeVoltage`, `Acquisition ${index + 1} Tube Voltage`, 'acquisitions', acquisition.tubeVoltage);
      checkPositive(issues, `${path}.tubeCurrent`, `Acquisition ${index + 1} Tube Current`, 'acquisitions', acquisition.tubeCurrent);
      checkPositive(issues, `${path}.exposureTime`, `Acquisition ${index + 1} Exposure Time`, 'acquisitions', acquisition.exposureTime);
      checkPositive(issues, `${path}.integrationTime`, `Acquisition ${index + 1} Integration Time`, 'acquisitions', acquisition.integrationTime);
      checkPositiveInteger(issues, `${path}.frameCount`, `Acquisition ${index + 1} Frame Count`, 'acquisitions', acquisition.frameCount);
      checkPositiveInteger(issues, `${path}.framesAveraged`, `Acquisition ${index + 1} Frames Averaged`, 'acquisitions', acquisition.framesAveraged);
      if (typeof acquisition.frameRate === 'number') {
        checkPositive(issues, `${path}.frameRate`, `Acquisition ${index + 1} Frame Rate`, 'acquisitions', acquisition.frameRate);
      }
      if (
        typeof acquisition.sdd === 'number'
        && typeof acquisition.sod === 'number'
        && typeof acquisition.odd === 'number'
        && !equalLengthSum(
          acquisition.sdd,
          acquisition.sddUnit,
          acquisition.sod,
          acquisition.sodUnit,
          acquisition.odd,
          acquisition.oddUnit,
        )
      ) {
        addIssue(issues, `${path}.sdd`, `Acquisition ${index + 1} Geometry`, 'acquisitions', 'Planned SDD must equal planned SOD + ODD after unit conversion.');
      }
      checkRange(
        issues,
        `${path}.thicknessMin`,
        `Acquisition ${index + 1} Thickness Range`,
        'acquisitions',
        acquisition.thicknessMin,
        acquisition.thicknessMax,
      );
      checkPositive(issues, `${path}.thicknessMin`, `Acquisition ${index + 1} Thickness Minimum`, 'acquisitions', acquisition.thicknessMin);
      checkPositive(issues, `${path}.thicknessMax`, `Acquisition ${index + 1} Thickness Maximum`, 'acquisitions', acquisition.thicknessMax);
      const calculatedUg = calculateDigitalGeometricUnsharpness(acquisition, source);
      if (
        typeof calculatedUg === 'number'
        && typeof acquisition.requiredUg === 'number'
        && calculatedUg > acquisition.requiredUg
      ) {
        addIssue(
          issues,
          `${path}.requiredUg`,
          `Acquisition ${index + 1} Required Ug`,
          'acquisitions',
          `Calculated Ug (${calculatedUg} ${acquisition.requiredUgUnit}) exceeds the user-specified required Ug (${acquisition.requiredUg} ${acquisition.requiredUgUnit}).`,
        );
      }
    });
  } else {
    const { materials, application, removal } = document.technique;
    checkPositive(issues, 'technique.general.thickness', 'Nominal Thickness', 'general', document.technique.general.thickness);
    checkPositive(issues, 'technique.surfacePrep.dryingTime', 'Drying Time', 'surface', document.technique.surfacePrep.dryingTime);
    checkPositive(issues, 'technique.application.dwellTime', 'Dwell Time', 'application', application.dwellTime);
    checkPositive(issues, 'technique.development.developmentTime', 'Development Time', 'development', document.technique.development.developmentTime);
    checkRange(
      issues,
      'technique.application.partTemperatureMin',
      'Part Temperature Range',
      'application',
      application.partTemperatureMin,
      application.partTemperatureMax,
    );
    checkRange(
      issues,
      'technique.application.penetrantTemperatureMin',
      'Penetrant Temperature Range',
      'application',
      application.penetrantTemperatureMin,
      application.penetrantTemperatureMax,
    );
    if (materials.method === 'A') {
      checkPositive(issues, 'technique.removal.methodA.pressureMin', 'Rinse Pressure Minimum', 'removal', removal.methodA.pressureMin, true);
      checkPositive(issues, 'technique.removal.methodA.pressureMax', 'Rinse Pressure Maximum', 'removal', removal.methodA.pressureMax, true);
      checkRange(
        issues,
        'technique.removal.methodA.pressureMin',
        'Method A Rinse Pressure Range',
        'removal',
        removal.methodA.pressureMin,
        removal.methodA.pressureMax,
      );
      checkRange(
        issues,
        'technique.removal.methodA.temperatureMin',
        'Method A Rinse Temperature Range',
        'removal',
        removal.methodA.temperatureMin,
        removal.methodA.temperatureMax,
      );
    }
    if (materials.method === 'B' || materials.method === 'D') {
      checkPositive(issues, 'technique.removal.methodBD.contactTime', 'Emulsifier Contact Time', 'removal', removal.methodBD.contactTime);
    }
    if (
      materials.method === 'B'
      && (isPresent(removal.methodBD.concentration) || isPresent(removal.methodBD.concentrationUnit))
    ) {
      addIssue(
        issues,
        'technique.removal.methodBD.concentration',
        'Method B Emulsifier Concentration',
        'removal',
        'Concentration applies to the Method D hydrophilic process and must be cleared for Method B.',
      );
    }
    if (materials.method === 'D') {
      checkPositive(issues, 'technique.removal.methodBD.concentration', 'Hydrophilic Emulsifier Concentration', 'removal', removal.methodBD.concentration, true);
    }
    if (materials.penetrantType === 'Type I') {
      checkPositive(issues, 'technique.conditions.requiredUvAMin', 'Required UV-A Minimum', 'conditions', document.technique.conditions.requiredUvAMin);
      checkPositive(
        issues,
        'technique.conditions.ambientVisibleLightMax',
        'Ambient Visible Light Maximum',
        'conditions',
        document.technique.conditions.ambientVisibleLightMax,
        true,
      );
      checkPositive(issues, 'technique.conditions.darkAdaptationTime', 'Dark Adaptation Time', 'conditions', document.technique.conditions.darkAdaptationTime);
      if (isPresent(document.technique.conditions.whiteLightMin)) {
        addIssue(
          issues,
          'technique.conditions.whiteLightMin',
          'Inactive Type II Viewing Requirement',
          'conditions',
          'The white-light minimum is a Type II requirement and must be cleared for Type I.',
        );
      }
    } else if (materials.penetrantType === 'Type II') {
      checkPositive(issues, 'technique.conditions.whiteLightMin', 'Required White Light Minimum', 'conditions', document.technique.conditions.whiteLightMin);
      if ([
        document.technique.conditions.requiredUvAMin,
        document.technique.conditions.ambientVisibleLightMax,
        document.technique.conditions.darkAdaptationTime,
      ].some(isPresent)) {
        addIssue(
          issues,
          'technique.conditions',
          'Inactive Type I Viewing Requirements',
          'conditions',
          'UV-A, ambient-visible-light maximum, and dark-adaptation fields must be cleared for Type II.',
        );
      }
    }
    if (materials.penetrantType === 'Type II' && isPresent(materials.sensitivityLevel)) {
      addIssue(
        issues,
        'technique.materials.sensitivityLevel',
        'Sensitivity Level Applicability',
        'materials',
        'Sensitivity level applies to Type I; clear it for a Type II technique.',
      );
    }
  }

  const ids = document.method === 'RT-Film'
    ? document.technique.exposureViews.map((view) => view.id)
    : document.method === 'RT-Digital'
      ? document.technique.acquisitions.map((acquisition) => acquisition.id)
      : [];
  if (new Set(ids).size !== ids.length) {
    addIssue(
      issues,
      document.method === 'RT-Film' ? 'technique.exposureViews' : 'technique.acquisitions',
      'Stable IDs',
      document.method === 'RT-Film' ? 'views' : 'acquisitions',
      'Every planned view/acquisition must have a unique stable ID.',
    );
  }
}

function approvalReadiness(
  document: RtPtDocumentV3,
  draftCompleteness: RtPtCompletenessResult,
): RtPtApprovalReadinessResult {
  const requirements: ApprovalRequirement[] = [
    {
      path: 'technique',
      label: 'Technique Completeness',
      tab: 'general',
      complete: draftCompleteness.isComplete,
      message: 'All required planned fields and consistency checks must be complete before approval.',
    },
    {
      path: 'migration',
      label: 'Migration Acknowledgement',
      tab: 'control',
      complete: document.migration === undefined,
      message: 'Review and explicitly acknowledge migrated content before approval.',
    },
    {
      path: 'documentControl.number',
      label: 'Document Number',
      tab: 'control',
      complete: isMeaningfulControlledText(document.documentControl.number),
      message: 'A meaningful controlled document number is required before approval.',
    },
    {
      path: 'documentControl.title',
      label: 'Document Title',
      tab: 'control',
      complete: isMeaningfulControlledText(document.documentControl.title),
      message: 'A meaningful controlled document title is required before approval.',
    },
    {
      path: 'documentControl.revision',
      label: 'Revision',
      tab: 'control',
      complete: isPresent(document.documentControl.revision),
      message: 'A document revision is required before approval.',
    },
    {
      path: 'documentControl.revisionDate',
      label: 'Revision Date',
      tab: 'control',
      complete: isIsoCalendarDate(document.documentControl.revisionDate),
      message: 'A real revision date in YYYY-MM-DD format is required before approval.',
    },
    {
      path: 'documentControl.effectiveDate',
      label: 'Effective Date',
      tab: 'control',
      complete: isIsoCalendarDate(document.documentControl.effectiveDate),
      message: 'A real effective date in YYYY-MM-DD format is required before approval.',
    },
    {
      path: 'documentControl.effectiveDate',
      label: 'Revision / Effective Date Order',
      tab: 'control',
      complete: isRevisionDateOrderValid(
        document.documentControl.revisionDate,
        document.documentControl.effectiveDate,
      ),
      message: 'The revision date must be on or before the effective date.',
    },
    {
      path: 'revisionHistory',
      label: 'Current Revision History',
      tab: 'control',
      complete: document.revisionHistory.some((entry) => (
        entry.revision.trim() === document.documentControl.revision.trim()
        && isMeaningfulControlledText(entry.id)
        && isIsoCalendarDate(entry.date)
        && isMeaningfulControlledText(entry.description)
        && isMeaningfulControlledText(entry.author)
      )),
      message: 'Revision history must contain a complete entry for the current controlled revision.',
    },
    {
      path: 'controlledReferences',
      label: 'Controlled References',
      tab: 'control',
      complete: document.controlledReferences.length > 0,
      message: 'At least one controlled reference is required before approval.',
    },
    {
      path: 'controlledReferences',
      label: 'Reference Revisions',
      tab: 'control',
      complete: document.controlledReferences.length > 0 && document.controlledReferences.every((reference) => (
        isMeaningfulControlledText(reference.type)
        && isMeaningfulControlledText(reference.title)
        && isMeaningfulControlledText(reference.number)
        && isPresent(reference.revision)
        && (!isPresent(reference.clauseOrNote) || isMeaningfulControlledText(reference.clauseOrNote))
      )),
      message: 'Every controlled reference needs a type, title, number, and explicit revision.',
    },
    {
      path: 'approvals',
      label: 'NDT Level III Approval',
      tab: 'control',
      complete: document.approvals.some((approval) => (
        approval.role === 'ndt-level-3'
        && isMeaningfulControlledText(approval.name)
        && isMeaningfulControlledText(approval.personnelId)
        && isMeaningfulControlledText(approval.certificationBasis)
        && isPresent(approval.certificationRevision)
        && isIsoCalendarDate(approval.date)
      )),
      message: 'Approval requires a dated NDT Level III entry with identity and certification basis/revision.',
    },
    {
      path: 'approvals',
      label: 'Approval Entry Integrity',
      tab: 'control',
      complete: document.approvals.every((approval) => (
        isMeaningfulControlledText(approval.name)
        && isMeaningfulControlledText(approval.personnelId)
        && isMeaningfulControlledText(approval.certificationBasis)
        && isPresent(approval.certificationRevision)
        && isIsoCalendarDate(approval.date)
      )),
      message: 'Every approval entry must contain meaningful identity/certification values and a real ISO calendar date.',
    },
  ];

  if (document.method === 'RT-Film') {
    const normalizedViewIds = document.technique.exposureViews.map((view) => view.viewId.trim()).filter(Boolean);
    requirements.push({
      path: 'technique.exposureViews',
      label: 'Film Exposure Views',
      tab: 'views',
      complete: normalizedViewIds.length > 0 && new Set(normalizedViewIds).size === normalizedViewIds.length,
      message: 'Approval requires at least one exposure view and every controlled view ID must be unique.',
    });
  } else if (document.method === 'RT-Digital') {
    const normalizedViewIds = document.technique.acquisitions.map((item) => item.viewId.trim()).filter(Boolean);
    requirements.push(
      {
        path: 'technique.acquisitions',
        label: 'DDA Acquisitions',
        tab: 'acquisitions',
        complete: normalizedViewIds.length > 0 && new Set(normalizedViewIds).size === normalizedViewIds.length,
        message: 'Approval requires at least one acquisition and every controlled view ID must be unique.',
      },
      {
        path: 'technique.system.systemQualificationReference',
        label: 'System Qualification Reference',
        tab: 'system',
        complete: isPresent(document.technique.system.systemQualificationReference),
        message: 'A controlled DDA system qualification reference is required before approval.',
      },
      {
        path: 'technique.system.performanceBaselineReference',
        label: 'Performance Baseline Reference',
        tab: 'system',
        complete: isPresent(document.technique.system.performanceBaselineReference),
        message: 'A controlled DDA performance baseline reference is required before approval.',
      },
    );
    if (/diconde/i.test(document.technique.displayAndStorage.storageFormat)) {
      requirements.push({
        path: 'technique.displayAndStorage.dicondeProfileReference',
        label: 'DICONDE Profile Reference',
        tab: 'storage',
        complete: isPresent(document.technique.displayAndStorage.dicondeProfileReference),
        message: 'A specific DICONDE profile reference is required when DICONDE storage is planned.',
      });
    }
  }

  const severity: RtPtValidationIssue['severity'] = document.status === 'approved' ? 'error' : 'warning';
  const issues = requirements.filter((requirement) => !requirement.complete).map<RtPtValidationIssue>((requirement) => ({
    path: requirement.path,
    label: requirement.label,
    tab: requirement.tab,
    message: requirement.message,
    severity,
    scope: 'approval',
  }));
  const completedRequirements = requirements.length - issues.length;
  return {
    completedRequirements,
    totalRequirements: requirements.length,
    completionPercent: Math.round((completedRequirements / requirements.length) * 100),
    isReady: issues.length === 0,
    issues,
  };
}

export function validateRtPtDocument(document: RtPtDocumentV3): RtPtValidationSummary {
  const requiredFields = document.method === 'RT-Film'
    ? rtFilmFields(document)
    : document.method === 'RT-Digital'
      ? rtDigitalFields(document)
      : ptFields(document);

  const draftIssues: RtPtValidationIssue[] = [];
  let completedFieldsCount = 0;
  requiredFields.forEach((rule) => {
    const valid = (rule.isValid || isPresent)(rule.value);
    if (valid) completedFieldsCount += 1;
    else {
      draftIssues.push({
        path: rule.path,
        label: rule.label,
        tab: rule.tab,
        message: rule.invalidMessage || 'Required planned field is missing.',
        severity: 'error',
        scope: 'draft',
      });
    }
  });

  addCrossFieldIssues(document, draftIssues);
  const totalRequiredFields = requiredFields.length;
  const rawPercent = totalRequiredFields === 0
    ? 0
    : Math.round((completedFieldsCount / totalRequiredFields) * 100);
  const draftHasErrors = draftIssues.some((issue) => issue.severity === 'error');
  const draftCompleteness: RtPtCompletenessResult = {
    completedFieldsCount,
    totalRequiredFields,
    completionPercent: draftHasErrors && rawPercent === 100 ? 99 : rawPercent,
    isComplete: completedFieldsCount === totalRequiredFields && !draftHasErrors,
    issues: draftIssues,
  };

  const approval = approvalReadiness(document, draftCompleteness);
  const migrationWarningIssues = (document.migration?.warnings ?? []).map<RtPtValidationIssue>((warning, index) => ({
    path: `migration.warnings[${index}]`,
    label: 'Migration Review',
    tab: 'control',
    message: warning,
    severity: 'warning',
    scope: 'migration',
  }));
  const migrationSummaryIssues: RtPtValidationIssue[] = document.migration
    ? (() => {
      const categoryCounts = document.migration.quarantine.reduce<Record<string, number>>((counts, entry) => {
        counts[entry.reason] = (counts[entry.reason] ?? 0) + 1;
        return counts;
      }, {});
      const categorySummary = Object.entries(categoryCounts)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([category, count]) => `${category}: ${count}`)
        .join(', ') || 'none';
      return [{
        path: 'migration',
        label: 'Migration Summary',
        tab: 'control',
        message: `Schema V${document.migration.sourceSchemaVersion} migration; ${document.migration.quarantine.length} quarantined field(s). Categories: ${categorySummary}.`,
        severity: 'warning' as const,
        scope: 'migration' as const,
      }];
    })()
    : [];
  const issues = [...draftIssues, ...approval.issues, ...migrationSummaryIssues, ...migrationWarningIssues];

  return {
    method: document.method,
    draftCompleteness,
    approvalReadiness: approval,
    issues,
    completedFieldsCount: draftCompleteness.completedFieldsCount,
    totalRequiredFields: draftCompleteness.totalRequiredFields,
    completionPercent: draftCompleteness.completionPercent,
    isComplete: draftCompleteness.isComplete,
    isApprovalReady: approval.isReady,
  };
}
