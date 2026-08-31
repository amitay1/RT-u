import {
  calculateDigitalGeometricUnsharpness,
  calculateFilmGeometricUnsharpness,
  lengthToMillimeters,
} from '@/lib/rtGeometry';
import {
  calculateRtDigitalPlanning,
  convertRtDigitalLength,
  resolveRtDigitalInspectionArea,
  type RtDigitalExposureGridDescriptor,
} from '@/lib/rtDigitalPlanning';
import {
  calculateHoneycombRadiographicThickness,
  lookupPs811000DensityRequirement,
  lookupPs811000EnergySuggestion,
  lookupPs811000MaximumReadableDensity,
  lookupPs811000UgLimit,
  isThinAdhesiveTenKvpCase,
} from '@/lib/ps811000';
import {
  calculateIso17636MinimumSod,
  ISO_17636_1_MINIMUM_DENSITY,
} from '@/lib/rtIso17636';
import { calculateCircumferentialExposureCount } from '@/lib/rtCircumferential';
import { duplexElementResolvedBySrb, resolveRtDuplexElement } from '@/lib/rtDuplexIqi';
import type { LengthUnit, RtFilmExposureDefaults } from '@/types/rtFilm';
import type {
  RtDigitalAcquisition,
  RtDigitalAcquisitionIqiAssignment,
  RtDigitalAttachmentMetadata,
  RtDigitalCatalogStatus,
  RtDigitalInspectionArea,
  RtDigitalIqiRuleCatalogSnapshot,
  RtDigitalIqiRuleRow,
  RtDigitalIqiZoneOutput,
  RtDigitalPlanning,
  RtDigitalPlanningOverride,
  RtDigitalThicknessDefinition,
  RtDigitalVisualPoint,
  RtDigitalVisualRegion,
} from '@/types/rtDigital';
import type { RtPtDocumentV3, RtPtMethod } from '@/types/rtPtDocument';

type RtDigitalDocument = Extract<RtPtDocumentV3, { method: 'RT-Digital' }>;

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

const positiveNumber = (value: unknown): boolean => (
  typeof value === 'number' && Number.isFinite(value) && value > 0
);

const nonNegativeNumber = (value: unknown): boolean => (
  typeof value === 'number' && Number.isFinite(value) && value >= 0
);

const positiveInteger = (value: unknown): boolean => positiveNumber(value) && Number.isInteger(value);

const nonEmptyArray = (value: unknown): boolean => Array.isArray(value) && value.length > 0;

const validAttachmentMetadata = (value: unknown): boolean => {
  if (!value || typeof value !== 'object') return false;
  const metadata = value as Partial<RtDigitalAttachmentMetadata>;
  return isMeaningfulControlledText(metadata.id)
    && isMeaningfulControlledText(metadata.name)
    && ['image/jpeg', 'image/png', 'application/pdf'].includes(metadata.mimeType ?? '')
    && positiveInteger(metadata.size)
    && typeof metadata.sha256 === 'string'
    && /^[a-f0-9]{64}$/.test(metadata.sha256);
};

const completeGlobalDigitalIqi = (document: RtDigitalDocument): boolean => {
  const { iqi } = document.technique;
  return [
    iqi.type,
    iqi.standard,
    iqi.designation,
    iqi.material,
    iqi.placement,
    iqi.requiredSensitivity,
    iqi.requiredSnrOrNormalizedSnr,
    iqi.requiredContrastSensitivityOrCnr,
  ].every(isPresent)
    && positiveNumber(iqi.thickness)
    && nonNegativeNumber(iqi.requiredUg);
};

type DigitalIqiOverrideField = 'designation' | 'requiredWire' | 'requiredHole' | 'shimRequirement';

interface DigitalIqiOverrideControl {
  override: RtDigitalPlanningOverride;
  field: DigitalIqiOverrideField;
}

function resolveDigitalIqiOverrideControl(
  planning: RtDigitalPlanning,
  output: RtDigitalIqiZoneOutput,
): DigitalIqiOverrideControl | null {
  if (!output.overrideId) return null;
  const override = planning.overrides.find((candidate) => candidate.id === output.overrideId);
  if (!override) return null;
  const prefix = `iqiRules.zoneOutputs.${output.id}.`;
  if (!override.fieldPath.startsWith(prefix)) return null;
  const field = override.fieldPath.slice(prefix.length) as DigitalIqiOverrideField;
  if (!(['designation', 'requiredWire', 'requiredHole', 'shimRequirement'] as const).includes(field)) return null;
  if (
    !isMeaningfulControlledText(override.calculatedValue)
    || !isMeaningfulControlledText(override.approvedValue)
    || !isMeaningfulControlledText(override.reason)
    || !isMeaningfulControlledText(override.approvedBy)
    || !isIsoCalendarDate(override.approvedAt)
    || override.calculatedValue.trim() !== output[field].trim()
  ) return null;
  return { override, field };
}

const completeDigitalIqiAssignment = (
  assignment: RtDigitalAcquisitionIqiAssignment | undefined,
  planning: RtDigitalPlanning | undefined,
): boolean => {
  if (!assignment || !planning) return false;
  const output = planning.iqiRules.zoneOutputs.find((candidate) => candidate.id === assignment.zoneOutputId);
  if (!output) return false;
  const basisType = planning.iqiRules.basis.iqiType;
  const overrideControl = resolveDigitalIqiOverrideControl(planning, output);
  const expected = (field: DigitalIqiOverrideField): string => (
    overrideControl?.field === field ? overrideControl.override.approvedValue : output[field]
  );
  return isMeaningfulControlledText(assignment.id)
    && isMeaningfulControlledText(assignment.zoneOutputId)
    && isMeaningfulControlledText(assignment.designation)
    && isMeaningfulControlledText(assignment.positionDescription)
    && (basisType !== 'Wire' || isMeaningfulControlledText(assignment.requiredWire))
    && (basisType !== 'Hole' || isMeaningfulControlledText(assignment.requiredHole))
    && assignment.designation.trim() === expected('designation').trim()
    && assignment.shimRequirement.trim() === expected('shimRequirement').trim()
    && (basisType !== 'Wire' || assignment.requiredWire.trim() === expected('requiredWire').trim())
    && (basisType !== 'Hole' || assignment.requiredHole.trim() === expected('requiredHole').trim());
};

interface DigitalIqiThicknessZoneBasis {
  stableId: string;
  aliases: string[];
  governingThickness: number | '';
  unit: LengthUnit;
}

interface ExpectedDigitalIqiZoneOutput {
  zone: DigitalIqiThicknessZoneBasis;
  matchedRule: RtDigitalIqiRuleRow | null;
  governingThickness: number | '';
  thicknessUnit: LengthUnit;
  iqiMaterial: string;
  designation: string;
  requiredWire: string;
  requiredHole: string;
  requiredSensitivity: string;
  placement: string;
  shimRequirement: string;
  governing: boolean;
}

const digitalIqiThicknessZones = (
  thickness: RtDigitalThicknessDefinition,
): DigitalIqiThicknessZoneBasis[] => {
  if (thickness.mode === 'Single Thickness') {
    return [{
      stableId: thickness.id,
      aliases: [thickness.id],
      governingThickness: thickness.thickness,
      unit: thickness.unit,
    }];
  }
  if (thickness.mode === 'Thickness Range') {
    return [{
      stableId: thickness.id,
      aliases: [thickness.id],
      governingThickness: thickness.maximum === '' ? thickness.minimum : thickness.maximum,
      unit: thickness.unit,
    }];
  }
  if (thickness.mode === 'Multiple Thickness Zones') {
    return thickness.zones.map((zone) => ({
      stableId: zone.id,
      aliases: [zone.id, zone.zoneId],
      governingThickness: zone.governing === ''
        ? zone.maximum === '' ? zone.minimum : zone.maximum
        : zone.governing,
      unit: thickness.unit,
    }));
  }
  return [];
};

const matchDigitalIqiRule = (
  rules: ReadonlyArray<RtDigitalIqiRuleRow>,
  thickness: number,
): RtDigitalIqiRuleRow | null => {
  const candidates = rules
    .map((rule, index) => ({ rule, index }))
    .filter(({ rule }) => {
      const minimum = rule.minimumThickness === '' ? Number.NEGATIVE_INFINITY : rule.minimumThickness;
      const maximum = rule.maximumThickness === '' ? Number.POSITIVE_INFINITY : rule.maximumThickness;
      return minimum <= thickness && thickness <= maximum;
    })
    .sort((left, right) => {
      const leftMinimum = left.rule.minimumThickness === '' ? Number.NEGATIVE_INFINITY : left.rule.minimumThickness;
      const rightMinimum = right.rule.minimumThickness === '' ? Number.NEGATIVE_INFINITY : right.rule.minimumThickness;
      const leftMaximum = left.rule.maximumThickness === '' ? Number.POSITIVE_INFINITY : left.rule.maximumThickness;
      const rightMaximum = right.rule.maximumThickness === '' ? Number.POSITIVE_INFINITY : right.rule.maximumThickness;
      const spanOrder = (leftMaximum - leftMinimum) - (rightMaximum - rightMinimum);
      if (spanOrder !== 0) return spanOrder;
      if (leftMinimum !== rightMinimum) return rightMinimum - leftMinimum;
      return left.rule.id.localeCompare(right.rule.id) || left.index - right.index;
    });
  return candidates[0]?.rule ?? null;
};

const expectedDigitalIqiZoneOutputs = (
  thickness: RtDigitalThicknessDefinition,
  snapshot: RtDigitalIqiRuleCatalogSnapshot,
): ExpectedDigitalIqiZoneOutput[] => {
  const normalized = digitalIqiThicknessZones(thickness).map((zone) => ({
    zone,
    convertedThickness: zone.governingThickness === ''
      ? null
      : convertRtDigitalLength(zone.governingThickness, zone.unit, snapshot.thicknessUnit),
  }));
  const governingZoneId = [...normalized]
    .filter((entry): entry is typeof entry & { convertedThickness: number } => entry.convertedThickness !== null)
    .sort((left, right) => (
      right.convertedThickness - left.convertedThickness
      || left.zone.stableId.localeCompare(right.zone.stableId)
    ))[0]?.zone.stableId ?? '';

  return normalized.map(({ zone, convertedThickness }) => {
    const matchedRule = convertedThickness === null
      ? null
      : matchDigitalIqiRule(snapshot.rules, convertedThickness);
    return {
      zone,
      matchedRule,
      governingThickness: convertedThickness ?? '',
      thicknessUnit: snapshot.thicknessUnit,
      iqiMaterial: matchedRule?.iqiMaterial ?? '',
      designation: matchedRule?.designation ?? '',
      requiredWire: matchedRule?.requiredWire ?? '',
      requiredHole: matchedRule?.requiredHole ?? '',
      requiredSensitivity: matchedRule?.requiredSensitivity ?? '',
      placement: matchedRule?.placement || snapshot.placementRule,
      shimRequirement: matchedRule?.shimRequirement ?? '',
      governing: zone.stableId === governingZoneId,
    };
  });
};

const digitalIqiOutputMatchesRule = (
  output: RtDigitalIqiZoneOutput,
  expected: ExpectedDigitalIqiZoneOutput,
): boolean => {
  const sameNumberOrEmpty = (left: number | '', right: number | ''): boolean => (
    left === right
    || (typeof left === 'number' && typeof right === 'number' && Math.abs(left - right) <= 1e-9)
  );
  const sameText = (left: string, right: string): boolean => left.trim() === right.trim();
  return expected.zone.aliases.includes(output.thicknessZoneId)
    && sameNumberOrEmpty(output.governingThickness, expected.governingThickness)
    && output.thicknessUnit === expected.thicknessUnit
    && sameText(output.iqiMaterial, expected.iqiMaterial)
    && sameText(output.designation, expected.designation)
    && sameText(output.requiredWire, expected.requiredWire)
    && sameText(output.requiredHole, expected.requiredHole)
    && sameText(output.requiredSensitivity, expected.requiredSensitivity)
    && sameText(output.placement, expected.placement)
    && sameText(output.shimRequirement, expected.shimRequirement)
    && output.governing === expected.governing;
};

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

function crViewFields(
  document: Extract<RtPtDocumentV3, { method: 'RT-CR' }>,
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
      field(`${path}.plateSize`, `View ${index + 1} Imaging Plate Size`, 'views', view.plateSize),
      field(`${path}.beamAngle`, `View ${index + 1} Planned Beam Angle`, 'views', view.beamAngle),
      field(`${path}.overlap`, `View ${index + 1} Required Overlap`, 'views', view.overlap),
      field(`${path}.identification`, `View ${index + 1} Identification Plan`, 'views', view.identification),
      field(`${path}.requiredUg`, `View ${index + 1} Required Ug`, 'views', view.requiredUg),
    ];
    if (sourceType === 'X-ray') {
      fields.push(
        field(`${path}.tubeVoltage`, `View ${index + 1} Planned Tube Voltage`, 'views', view.tubeVoltage),
        field(`${path}.tubeCurrent`, `View ${index + 1} Planned Tube Current`, 'views', view.tubeCurrent),
      );
    }
    return fields;
  });
}

function rtCrFields(document: Extract<RtPtDocumentV3, { method: 'RT-CR' }>): RequiredField[] {
  const { general, source, plateSystem, scanner, imageQuality, iqi, acceptance } = document.technique;
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
    field('technique.plateSystem.manufacturer', 'Imaging Plate Manufacturer', 'plate', plateSystem.manufacturer),
    field('technique.plateSystem.plateDesignation', 'Imaging Plate Designation', 'plate', plateSystem.plateDesignation),
    field('technique.plateSystem.plateClass', 'Imaging Plate System Class', 'plate', plateSystem.plateClass),
    field('technique.plateSystem.cassetteType', 'Cassette Type', 'plate', plateSystem.cassetteType),
    field('technique.plateSystem.frontScreen.material', 'Front Screen Material', 'plate', plateSystem.frontScreen.material),
    field('technique.plateSystem.frontScreen.thickness', 'Front Screen Thickness', 'plate', plateSystem.frontScreen.thickness),
    field('technique.plateSystem.backScreen.material', 'Back Screen Material', 'plate', plateSystem.backScreen.material),
    field('technique.plateSystem.backScreen.thickness', 'Back Screen Thickness', 'plate', plateSystem.backScreen.thickness),
    field('technique.plateSystem.erasureRequirement', 'Plate Erasure Requirement', 'plate', plateSystem.erasureRequirement),
    field(
      'technique.plateSystem.plateConditionRequirement',
      'Plate Condition Requirement',
      'plate',
      plateSystem.plateConditionRequirement,
    ),
    field('technique.scanner.manufacturer', 'Scanner Manufacturer', 'plate', scanner.manufacturer),
    field('technique.scanner.model', 'Scanner Model', 'plate', scanner.model),
    field('technique.scanner.serialNumber', 'Scanner Serial Number', 'plate', scanner.serialNumber),
    field('technique.scanner.pixelPitch', 'Scanner Pixel Pitch', 'plate', scanner.pixelPitch),
    field(
      'technique.scanner.scanResolutionPixelsPerMm',
      'Planned Scan Resolution',
      'plate',
      scanner.scanResolutionPixelsPerMm,
    ),
    field(
      'technique.scanner.calibrationRequirement',
      'Scanner Calibration Requirement',
      'plate',
      scanner.calibrationRequirement,
    ),
    field('technique.scanner.qualification.reference', 'Scanner Qualification Reference', 'plate', scanner.qualification.reference),
    field('technique.scanner.qualification.date', 'Scanner Qualification Date', 'plate', scanner.qualification.date),
    field('technique.scanner.qualification.dueDate', 'Scanner Qualification Due Date', 'plate', scanner.qualification.dueDate),
    field('technique.scanner.qualification.status', 'Scanner Qualification Status', 'plate', scanner.qualification.status),
    field('technique.imageQuality.requiredSrb', 'Required Basic Spatial Resolution', 'image', imageQuality.requiredSrb),
    field('technique.imageQuality.greyValueMin', 'Required Grey-Value Minimum', 'image', imageQuality.greyValueMin),
    field('technique.imageQuality.greyValueMax', 'Required Grey-Value Maximum', 'image', imageQuality.greyValueMax),
    field('technique.imageQuality.requiredSnrMin', 'Required Minimum SNR', 'image', imageQuality.requiredSnrMin),
    field(
      'technique.imageQuality.duplexWireRequirement',
      'Spatial-Resolution Verification Requirement',
      'image',
      imageQuality.duplexWireRequirement,
    ),
    field('technique.imageQuality.maxScanDelay', 'Maximum Exposure-to-Scan Delay', 'image', imageQuality.maxScanDelay),
    field('technique.imageQuality.maxScanDelayUnit', 'Scan Delay Unit', 'image', imageQuality.maxScanDelayUnit),
    field('technique.iqi.type', 'IQI Type', 'iqi', iqi.type),
    field('technique.iqi.standard', 'IQI Standard', 'iqi', iqi.standard),
    field('technique.iqi.designation', 'IQI Designation', 'iqi', iqi.designation),
    field('technique.iqi.shim', 'IQI Shim', 'iqi', iqi.shim),
    field('technique.iqi.block', 'IQI Block', 'iqi', iqi.block),
    field('technique.iqi.material', 'IQI Material', 'iqi', iqi.material),
    field('technique.iqi.thickness', 'IQI Thickness', 'iqi', iqi.thickness),
    field('technique.iqi.placement', 'IQI Placement', 'iqi', iqi.placement),
    field('technique.iqi.requiredUg', 'Required Geometric Unsharpness', 'iqi', iqi.requiredUg),
    ...acceptanceFields(acceptance),
    ...crViewFields(document),
  ];
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
    const iqRequirementAvailable = completeDigitalIqiAssignment(
      acquisition.plan?.iqiAssignment,
      document.technique.planning,
    ) || completeGlobalDigitalIqi(document);
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
      field(
        `${path}.iqiOverride`,
        `Acquisition ${index + 1} IQI Requirement / Override`,
        'acquisitions',
        acquisition.iqiOverride,
        (value) => isPresent(value) || iqRequirementAvailable,
        'Enter an IQI override or complete the structured/global IQI assignment.',
      ),
      field(`${path}.coverage`, `Acquisition ${index + 1} Coverage Plan`, 'acquisitions', acquisition.coverage),
      field(`${path}.imageNaming`, `Acquisition ${index + 1} Image Naming`, 'acquisitions', acquisition.imageNaming),
      field(`${path}.markingInstructions`, `Acquisition ${index + 1} Marking Instructions`, 'acquisitions', acquisition.markingInstructions),
    ];
  });
}

const normalizedCoordinate = (value: unknown): boolean => (
  typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1
);

function digitalPointFields(
  path: string,
  label: string,
  tab: string,
  point: RtDigitalVisualPoint,
): RequiredField[] {
  return [
    field(`${path}.x`, `${label} X`, tab, point.x, normalizedCoordinate, 'Enter a normalized X coordinate from 0 to 1.'),
    field(`${path}.y`, `${label} Y`, tab, point.y, normalizedCoordinate, 'Enter a normalized Y coordinate from 0 to 1.'),
  ];
}

function digitalRegionFields(
  path: string,
  label: string,
  tab: string,
  region: RtDigitalVisualRegion,
): RequiredField[] {
  return [
    ...digitalPointFields(path, label, tab, region),
    field(`${path}.width`, `${label} Width`, tab, region.width, positiveNumber, 'Enter a positive normalized width.'),
    field(`${path}.height`, `${label} Height`, tab, region.height, positiveNumber, 'Enter a positive normalized height.'),
    field(`${path}.rotationDegrees`, `${label} Rotation`, tab, region.rotationDegrees),
  ];
}

function digitalPlanningFields(document: RtDigitalDocument): RequiredField[] {
  const planning = document.technique.planning;
  const fields: RequiredField[] = [field(
    'technique.planning',
    'Structured Digital Planning',
    'general',
    planning,
    (value) => Boolean(value),
    'Complete the structured Digital RT planning model before controlled approval.',
  )];
  if (!planning) return fields;

  const { part, sourceSelection, detectorSelection, geometry, visual, iqiRules } = planning;
  fields.push(
    field('technique.planning.id', 'Digital Planning Stable ID', 'general', planning.id),
    field('technique.planning.part.id', 'Part Definition Stable ID', 'general', part.id),
    field('technique.planning.part.partName', 'Structured Part Name', 'general', part.partName),
    field('technique.planning.part.partNumber', 'Structured Part Number', 'general', part.partNumber),
    field('technique.planning.part.vendorCode', 'Structured Vendor Code', 'general', part.vendorCode),
    field('technique.planning.part.revisionOrConfiguration', 'Structured Revision / Configuration', 'general', part.revisionOrConfiguration),
    field('technique.planning.part.drawingOrSpecificationReference', 'Structured Drawing / Specification', 'general', part.drawingOrSpecificationReference),
    field('technique.planning.part.procedureNumber', 'Structured Procedure Number', 'general', part.procedureNumber),
    field('technique.planning.part.material', 'Structured Material', 'general', part.material),
    field('technique.planning.part.materialSpecification', 'Material Specification', 'general', part.materialSpecification),
    field('technique.planning.part.materialGroup', 'Material Group', 'general', part.materialGroup),
    field('technique.planning.part.surfaceFinish', 'Structured Surface Finish', 'general', part.surfaceFinish),
    field('technique.planning.part.manufacturingProcess', 'Manufacturing Process', 'general', part.manufacturingProcess),
    field('technique.planning.part.geometry.id', 'Part Geometry Stable ID', 'general', part.geometry.id),
    field('technique.planning.part.geometry.geometryType', 'Part Geometry Type', 'general', part.geometry.geometryType),
    field('technique.planning.part.thickness.id', 'Thickness Definition Stable ID', 'general', part.thickness.id),
    field('technique.planning.part.thickness.mode', 'Thickness Definition Mode', 'general', part.thickness.mode),
    field('technique.planning.part.inspectionAreas.id', 'Inspection Area Definition Stable ID', 'general', part.inspectionAreas.id),
    field('technique.planning.part.inspectionAreas.mode', 'Inspection Area Mode', 'general', part.inspectionAreas.mode),
    field('technique.planning.part.technique.wallTechnique', 'Structured Wall Technique', 'general', part.technique.wallTechnique),
    field('technique.planning.part.technique.imageTechnique', 'Structured Image Technique', 'general', part.technique.imageTechnique),
    field('technique.planning.part.inspectionStandard', 'Inspection Standard', 'general', part.inspectionStandard),
    field('technique.planning.part.inspectionStandardRevision', 'Inspection Standard Revision', 'general', part.inspectionStandardRevision),
    field('technique.planning.part.attachments', 'Part Image / Drawing Attachment', 'general', part.attachments, nonEmptyArray, 'Attach at least one controlled JPG, PNG, or PDF reference.'),
    field('technique.planning.part.referenceAttachmentId', 'Reference Attachment', 'general', part.referenceAttachmentId),
    field('technique.planning.part.partOrientation', 'Part Orientation', 'general', part.partOrientation),
    field('technique.planning.part.datumReference', 'Datum / Reference', 'general', part.datumReference),
  );
  if (part.manufacturingProcess === 'Other') {
    fields.push(field('technique.planning.part.otherManufacturingProcess', 'Other Manufacturing Process', 'general', part.otherManufacturingProcess));
  }
  if (part.technique.imageTechnique === 'Other') {
    fields.push(field('technique.planning.part.technique.otherImageTechnique', 'Other Image Technique', 'general', part.technique.otherImageTechnique));
  }

  const geometryPath = 'technique.planning.part.geometry';
  if (part.geometry.geometryType === 'Flat / Plate' || part.geometry.geometryType === 'Rectangular') {
    fields.push(
      field(`${geometryPath}.length`, 'Part Length', 'general', part.geometry.length, positiveNumber),
      field(`${geometryPath}.width`, 'Part Width', 'general', part.geometry.width, positiveNumber),
      field(`${geometryPath}.height`, 'Part Height', 'general', part.geometry.height, positiveNumber),
    );
  } else if (part.geometry.geometryType === 'Pipe / Tube' || part.geometry.geometryType === 'Cylinder' || part.geometry.geometryType === 'Ring') {
    fields.push(
      field(`${geometryPath}.outsideDiameter`, 'Part Outside Diameter', 'general', part.geometry.outsideDiameter, positiveNumber),
      field(`${geometryPath}.insideDiameter`, 'Part Inside Diameter', 'general', part.geometry.insideDiameter, nonNegativeNumber),
      field(`${geometryPath}.length`, 'Part Length', 'general', part.geometry.length, positiveNumber),
    );
  } else if (part.geometry.geometryType === 'Cone') {
    fields.push(
      field(`${geometryPath}.majorDiameter`, 'Cone Major Diameter', 'general', part.geometry.majorDiameter, positiveNumber),
      field(`${geometryPath}.minorDiameter`, 'Cone Minor Diameter', 'general', part.geometry.minorDiameter, positiveNumber),
      field(`${geometryPath}.height`, 'Cone Height', 'general', part.geometry.height, positiveNumber),
      field(`${geometryPath}.wallThickness`, 'Cone Wall Thickness', 'general', part.geometry.wallThickness, positiveNumber),
    );
  } else if (part.geometry.geometryType === 'Complex Casting') {
    fields.push(
      field(`${geometryPath}.boundingLength`, 'Casting Bounding Length', 'general', part.geometry.boundingLength, positiveNumber),
      field(`${geometryPath}.boundingWidth`, 'Casting Bounding Width', 'general', part.geometry.boundingWidth, positiveNumber),
      field(`${geometryPath}.boundingHeight`, 'Casting Bounding Height', 'general', part.geometry.boundingHeight, positiveNumber),
      field(`${geometryPath}.inspectionEnvelope`, 'Casting Inspection Envelope', 'general', part.geometry.inspectionEnvelope),
    );
  } else if (part.geometry.geometryType === 'Other') {
    fields.push(field(`${geometryPath}.description`, 'Other Geometry Description', 'general', part.geometry.description));
  }

  const thicknessPath = 'technique.planning.part.thickness';
  if (part.thickness.mode === 'Single Thickness') {
    fields.push(field(`${thicknessPath}.thickness`, 'Single Planned Thickness', 'general', part.thickness.thickness, positiveNumber));
  } else if (part.thickness.mode === 'Thickness Range') {
    fields.push(
      field(`${thicknessPath}.minimum`, 'Planned Thickness Minimum', 'general', part.thickness.minimum, positiveNumber),
      field(`${thicknessPath}.maximum`, 'Planned Thickness Maximum', 'general', part.thickness.maximum, positiveNumber),
    );
  } else if (part.thickness.mode === 'Multiple Thickness Zones') {
    fields.push(field(`${thicknessPath}.zones`, 'Thickness Zones', 'general', part.thickness.zones, nonEmptyArray, 'Define at least one controlled thickness zone.'));
    part.thickness.zones.forEach((zone, index) => {
      const path = `${thicknessPath}.zones[${index}]`;
      fields.push(
        field(`${path}.id`, `Thickness Zone ${index + 1} Stable ID`, 'general', zone.id),
        field(`${path}.zoneId`, `Thickness Zone ${index + 1} Controlled ID`, 'general', zone.zoneId),
        field(`${path}.description`, `Thickness Zone ${index + 1} Description`, 'general', zone.description),
        field(`${path}.minimum`, `Thickness Zone ${index + 1} Minimum`, 'general', zone.minimum, positiveNumber),
        field(`${path}.maximum`, `Thickness Zone ${index + 1} Maximum`, 'general', zone.maximum, positiveNumber),
        field(`${path}.governing`, `Thickness Zone ${index + 1} Governing Thickness`, 'general', zone.governing, positiveNumber),
        ...digitalRegionFields(`${path}.position`, `Thickness Zone ${index + 1} Position`, 'general', zone.position),
      );
    });
  }

  if (part.inspectionAreas.mode === 'Defined Area' || part.inspectionAreas.mode === 'Multiple Areas') {
    fields.push(field(
      'technique.planning.part.inspectionAreas.areas',
      'Inspection Areas',
      'general',
      part.inspectionAreas.areas,
      nonEmptyArray,
      'Define the controlled inspection area dimensions and visual position.',
    ));
  }
  part.inspectionAreas.areas.forEach((area, index) => {
    const path = `technique.planning.part.inspectionAreas.areas[${index}]`;
    fields.push(
      field(`${path}.id`, `Inspection Area ${index + 1} Stable ID`, 'general', area.id),
      field(`${path}.areaId`, `Inspection Area ${index + 1} Controlled ID`, 'general', area.areaId),
      field(`${path}.description`, `Inspection Area ${index + 1} Description`, 'general', area.description),
      field(`${path}.width`, `Inspection Area ${index + 1} Width`, 'general', area.width, positiveNumber),
      field(`${path}.height`, `Inspection Area ${index + 1} Height`, 'general', area.height, positiveNumber),
      ...digitalRegionFields(`${path}.position`, `Inspection Area ${index + 1} Position`, 'general', area.position),
    );
  });

  fields.push(
    field('technique.planning.sourceSelection.id', 'Source Selection Stable ID', 'source', sourceSelection.id),
    field('technique.planning.sourceSelection.catalogRecordId', 'Source Catalog Record', 'source', sourceSelection.catalogRecordId),
    field('technique.planning.sourceSelection.catalogRevisionId', 'Source Catalog Revision ID', 'source', sourceSelection.catalogRevisionId),
    field('technique.planning.sourceSelection.catalogRevision', 'Source Catalog Revision', 'source', sourceSelection.catalogRevision, positiveInteger),
    field('technique.planning.sourceSelection.snapshot', 'Source Catalog Snapshot', 'source', sourceSelection.snapshot),
    field('technique.planning.sourceSelection.focalSpotOptionId', 'Selected Focal Spot Mode', 'source', sourceSelection.focalSpotOptionId),
    field(
      'technique.planning.sourceSelection.filterOptionIds',
      'Selected Source Filter',
      'source',
      sourceSelection.filterOptionIds,
      (value) => nonEmptyArray(value) || isMeaningfulControlledText(sourceSelection.extraFilter),
      'Select a catalog filter or enter an explicit additional filter instruction.',
    ),
    field('technique.planning.detectorSelection.id', 'Detector Selection Stable ID', 'detector', detectorSelection.id),
    field('technique.planning.detectorSelection.catalogRecordId', 'Detector Catalog Record', 'detector', detectorSelection.catalogRecordId),
    field('technique.planning.detectorSelection.catalogRevisionId', 'Detector Catalog Revision ID', 'detector', detectorSelection.catalogRevisionId),
    field('technique.planning.detectorSelection.catalogRevision', 'Detector Catalog Revision', 'detector', detectorSelection.catalogRevision, positiveInteger),
    field('technique.planning.detectorSelection.snapshot', 'Detector Catalog Snapshot', 'detector', detectorSelection.snapshot),
    field('technique.planning.detectorSelection.detectorMode', 'Selected Detector Mode', 'detector', detectorSelection.detectorMode),
    field('technique.planning.detectorSelection.orientation', 'Detector Orientation', 'detector', detectorSelection.orientation),
  );

  if (sourceSelection.snapshot) {
    const snapshot = sourceSelection.snapshot;
    fields.push(
      field('technique.planning.sourceSelection.snapshot.manufacturer', 'Snapshot Source Manufacturer', 'source', snapshot.manufacturer),
      field('technique.planning.sourceSelection.snapshot.model', 'Snapshot Source Model', 'source', snapshot.model),
      field('technique.planning.sourceSelection.snapshot.serialNumber', 'Snapshot Source Serial Number', 'source', snapshot.serialNumber),
      field('technique.planning.sourceSelection.snapshot.kvMinimum', 'Snapshot Minimum kV', 'source', snapshot.kvMinimum, positiveNumber),
      field('technique.planning.sourceSelection.snapshot.kvMaximum', 'Snapshot Maximum kV', 'source', snapshot.kvMaximum, positiveNumber),
      field('technique.planning.sourceSelection.snapshot.currentMinimum', 'Snapshot Minimum Current', 'source', snapshot.currentMinimum, positiveNumber),
      field('technique.planning.sourceSelection.snapshot.currentMaximum', 'Snapshot Maximum Current', 'source', snapshot.currentMaximum, positiveNumber),
      field('technique.planning.sourceSelection.snapshot.maximumPowerKw', 'Snapshot Maximum Power', 'source', snapshot.maximumPowerKw, positiveNumber),
      field('technique.planning.sourceSelection.snapshot.focalSpots', 'Snapshot Focal Spot Modes', 'source', snapshot.focalSpots, nonEmptyArray),
      field('technique.planning.sourceSelection.snapshot.filters', 'Snapshot Filters', 'source', snapshot.filters, nonEmptyArray),
    );
    (['calibration', 'qualification'] as const).forEach((key) => {
      const status = snapshot[key];
      const label = key === 'calibration' ? 'Source Calibration' : 'Source Qualification';
      fields.push(
        field(`technique.planning.sourceSelection.snapshot.${key}.reference`, `${label} Reference`, 'source', status.reference),
        field(`technique.planning.sourceSelection.snapshot.${key}.status`, `${label} Status`, 'source', status.status),
        field(`technique.planning.sourceSelection.snapshot.${key}.date`, `${label} Date`, 'source', status.date),
        field(`technique.planning.sourceSelection.snapshot.${key}.dueDate`, `${label} Due Date`, 'source', status.dueDate),
      );
    });
  }
  if (detectorSelection.snapshot) {
    const snapshot = detectorSelection.snapshot;
    fields.push(
      field('technique.planning.detectorSelection.snapshot.manufacturer', 'Snapshot Detector Manufacturer', 'detector', snapshot.manufacturer),
      field('technique.planning.detectorSelection.snapshot.model', 'Snapshot Detector Model', 'detector', snapshot.model),
      field('technique.planning.detectorSelection.snapshot.serialNumber', 'Snapshot Detector Serial Number', 'detector', snapshot.serialNumber),
      field('technique.planning.detectorSelection.snapshot.activeWidth', 'Snapshot Detector Active Width', 'detector', snapshot.activeWidth, positiveNumber),
      field('technique.planning.detectorSelection.snapshot.activeHeight', 'Snapshot Detector Active Height', 'detector', snapshot.activeHeight, positiveNumber),
      field('technique.planning.detectorSelection.snapshot.matrixColumns', 'Snapshot Detector Matrix Columns', 'detector', snapshot.matrixColumns, positiveInteger),
      field('technique.planning.detectorSelection.snapshot.matrixRows', 'Snapshot Detector Matrix Rows', 'detector', snapshot.matrixRows, positiveInteger),
      field('technique.planning.detectorSelection.snapshot.pixelSize', 'Snapshot Detector Pixel Size', 'detector', snapshot.pixelSize, positiveNumber),
      field('technique.planning.detectorSelection.snapshot.bitDepth', 'Snapshot Detector Bit Depth', 'detector', snapshot.bitDepth, positiveInteger),
      field('technique.planning.detectorSelection.snapshot.detectorSrb', 'Snapshot Detector SRb', 'detector', snapshot.detectorSrb, positiveNumber),
      field('technique.planning.detectorSelection.snapshot.modes', 'Snapshot Detector Modes', 'detector', snapshot.modes, nonEmptyArray),
    );
    (['calibration', 'badPixelMap', 'qualification'] as const).forEach((key) => {
      const status = snapshot[key];
      const label = key === 'badPixelMap'
        ? 'Snapshot Bad-pixel Map'
        : key === 'calibration'
          ? 'Snapshot Detector Calibration'
          : 'Snapshot Detector Qualification';
      fields.push(
        field(`technique.planning.detectorSelection.snapshot.${key}.reference`, `${label} Reference`, 'detector', status.reference),
        field(`technique.planning.detectorSelection.snapshot.${key}.status`, `${label} Status`, 'detector', status.status),
        field(`technique.planning.detectorSelection.snapshot.${key}.date`, `${label} Date`, 'detector', status.date),
        field(`technique.planning.detectorSelection.snapshot.${key}.dueDate`, `${label} Due Date`, 'detector', status.dueDate),
      );
    });
  }

  fields.push(
    field('technique.planning.geometry.id', 'Engineering Geometry Stable ID', 'engineering', geometry.id),
    field('technique.planning.geometry.distanceBasis', 'Distance Basis', 'engineering', geometry.distanceBasis),
    field('technique.planning.geometry.availableSourceDistance.value', 'Available Source Distance', 'engineering', geometry.availableSourceDistance.value, positiveNumber),
    field('technique.planning.geometry.geometryRestrictions', 'Geometry Restrictions', 'engineering', geometry.geometryRestrictions),
    field('technique.planning.geometry.requiredMaximumUg.value', 'Required Maximum Ug', 'engineering', geometry.requiredMaximumUg.value, positiveNumber),
    field('technique.planning.geometry.requiredMaximumEffectivePixel.value', 'Required Maximum Effective Pixel', 'engineering', geometry.requiredMaximumEffectivePixel.value, positiveNumber),
    field(
      'technique.planning.geometry.inspectionAreaId',
      'Engineering Inspection Area',
      'engineering',
      geometry.inspectionAreaId,
      (value) => part.inspectionAreas.mode === 'Entire Part' || isPresent(value),
      'Select the controlled inspection area used for FOV and coverage planning.',
    ),
    field('technique.planning.geometry.requiredOverlapPercent', 'Required Coverage Overlap', 'engineering', geometry.requiredOverlapPercent, nonNegativeNumber),
    field('technique.planning.geometry.excessiveOverlapThresholdPercent', 'Excessive-overlap Threshold', 'engineering', geometry.excessiveOverlapThresholdPercent, nonNegativeNumber),
  );
  const distanceFields = geometry.distanceBasis === 'SOD + ODD'
    ? [['sod', 'SOD'], ['odd', 'ODD']] as const
    : geometry.distanceBasis === 'SDD - ODD'
      ? [['sdd', 'SDD'], ['odd', 'ODD']] as const
      : geometry.distanceBasis === 'SDD - SOD'
        ? [['sdd', 'SDD'], ['sod', 'SOD']] as const
        : [];
  distanceFields.forEach(([key, label]) => fields.push(field(
    `technique.planning.geometry.${key}.value`,
    `Controlled ${label}`,
    'engineering',
    geometry[key].value,
    key === 'odd' ? nonNegativeNumber : positiveNumber,
  )));
  if (
    planning.overrides.length > 0
    || detectorSelection.orientation === 'Auto'
    || geometry.optimizeExposureCount
    || geometry.optimizeSodForUg
    || geometry.optimizeOdd
  ) {
    fields.push(field('technique.planning.geometry.levelThreeApprovalReference', 'Level III Planning Approval Reference', 'engineering', geometry.levelThreeApprovalReference));
  }

  fields.push(
    field('technique.planning.visual.id', 'Visual Planning Stable ID', 'visual', visual.id),
    ...digitalPointFields('technique.planning.visual.sourcePosition', 'Planned Source Position', 'visual', visual.sourcePosition),
    ...digitalPointFields('technique.planning.visual.detectorPosition', 'Planned Detector Position', 'visual', visual.detectorPosition),
    field('technique.planning.visual.detectorRotationDegrees', 'Planned Detector Rotation', 'visual', visual.detectorRotationDegrees),
    ...digitalPointFields('technique.planning.visual.beamCenter', 'Planned Beam Center', 'visual', visual.beamCenter),
    field('technique.planning.visual.beamAngleDegrees', 'Planned Beam Angle', 'visual', visual.beamAngleDegrees),
    field('technique.planning.visual.inspectionAreaId', 'Visual Inspection Area', 'visual', visual.inspectionAreaId),
    field('technique.planning.visual.leadMarkers', 'Planned Lead Markers', 'visual', visual.leadMarkers),
  );

  fields.push(
    field('technique.planning.iqiRules.id', 'IQI Planning Stable ID', 'iqi', iqiRules.id),
    field('technique.planning.iqiRules.basis.id', 'IQI Basis Stable ID', 'iqi', iqiRules.basis.id),
    field('technique.planning.iqiRules.basis.catalogRecordId', 'IQI Rule Catalog Record', 'iqi', iqiRules.basis.catalogRecordId),
    field('technique.planning.iqiRules.basis.catalogRevisionId', 'IQI Rule Catalog Revision ID', 'iqi', iqiRules.basis.catalogRevisionId),
    field('technique.planning.iqiRules.basis.catalogRevision', 'IQI Rule Catalog Revision', 'iqi', iqiRules.basis.catalogRevision, positiveInteger),
    field('technique.planning.iqiRules.basis.snapshot', 'IQI Rule Catalog Snapshot', 'iqi', iqiRules.basis.snapshot),
    field('technique.planning.iqiRules.basis.standard', 'IQI Rule Standard', 'iqi', iqiRules.basis.standard),
    field('technique.planning.iqiRules.basis.standardRevision', 'IQI Rule Standard Revision', 'iqi', iqiRules.basis.standardRevision),
    field('technique.planning.iqiRules.basis.iqiType', 'Structured IQI Type', 'iqi', iqiRules.basis.iqiType),
    field('technique.planning.iqiRules.basis.material', 'Structured IQI Material', 'iqi', iqiRules.basis.material),
    field('technique.planning.iqiRules.basis.materialGroup', 'Structured IQI Material Group', 'iqi', iqiRules.basis.materialGroup),
    field('technique.planning.iqiRules.basis.placementRule', 'Structured IQI Placement Rule', 'iqi', iqiRules.basis.placementRule),
    field('technique.planning.iqiRules.zoneOutputs', 'Per-zone IQI Outputs', 'iqi', iqiRules.zoneOutputs, nonEmptyArray, 'Define at least one required per-zone IQI output.'),
  );
  if (iqiRules.basis.snapshot) {
    const snapshot = iqiRules.basis.snapshot;
    fields.push(
      field('technique.planning.iqiRules.basis.snapshot.standard', 'Snapshot IQI Standard', 'iqi', snapshot.standard),
      field('technique.planning.iqiRules.basis.snapshot.standardRevision', 'Snapshot IQI Standard Revision', 'iqi', snapshot.standardRevision),
      field('technique.planning.iqiRules.basis.snapshot.materialGroup', 'Snapshot IQI Material Group', 'iqi', snapshot.materialGroup),
      field('technique.planning.iqiRules.basis.snapshot.iqiType', 'Snapshot IQI Type', 'iqi', snapshot.iqiType),
      field('technique.planning.iqiRules.basis.snapshot.wallTechnique', 'Snapshot IQI Wall Technique', 'iqi', snapshot.wallTechnique),
      field('technique.planning.iqiRules.basis.snapshot.imageTechnique', 'Snapshot IQI Image Technique', 'iqi', snapshot.imageTechnique),
      field('technique.planning.iqiRules.basis.snapshot.placementRule', 'Snapshot IQI Placement Rule', 'iqi', snapshot.placementRule),
      field('technique.planning.iqiRules.basis.snapshot.rules', 'Snapshot IQI Rules', 'iqi', snapshot.rules, nonEmptyArray),
    );
    snapshot.rules.forEach((rule, index) => {
      const path = `technique.planning.iqiRules.basis.snapshot.rules[${index}]`;
      fields.push(
        field(`${path}.id`, `Snapshot IQI Rule ${index + 1} Stable ID`, 'iqi', rule.id),
        field(`${path}.minimumThickness`, `Snapshot IQI Rule ${index + 1} Minimum Thickness`, 'iqi', rule.minimumThickness, nonNegativeNumber),
        field(`${path}.maximumThickness`, `Snapshot IQI Rule ${index + 1} Maximum Thickness`, 'iqi', rule.maximumThickness, positiveNumber),
        field(`${path}.iqiMaterial`, `Snapshot IQI Rule ${index + 1} Material`, 'iqi', rule.iqiMaterial),
        field(`${path}.designation`, `Snapshot IQI Rule ${index + 1} Designation`, 'iqi', rule.designation),
        field(`${path}.requiredSensitivity`, `Snapshot IQI Rule ${index + 1} Required Sensitivity`, 'iqi', rule.requiredSensitivity),
        field(`${path}.placement`, `Snapshot IQI Rule ${index + 1} Placement`, 'iqi', rule.placement),
        field(`${path}.shimRequirement`, `Snapshot IQI Rule ${index + 1} Shim Requirement`, 'iqi', rule.shimRequirement),
      );
      if (snapshot.iqiType === 'Wire') {
        fields.push(field(`${path}.requiredWire`, `Snapshot IQI Rule ${index + 1} Required Wire`, 'iqi', rule.requiredWire));
      } else if (snapshot.iqiType === 'Hole') {
        fields.push(field(`${path}.requiredHole`, `Snapshot IQI Rule ${index + 1} Required Hole`, 'iqi', rule.requiredHole));
      }
    });
  }
  iqiRules.zoneOutputs.forEach((output, index) => {
    const path = `technique.planning.iqiRules.zoneOutputs[${index}]`;
    fields.push(
      field(`${path}.id`, `IQI Output ${index + 1} Stable ID`, 'iqi', output.id),
      field(`${path}.thicknessZoneId`, `IQI Output ${index + 1} Thickness Zone`, 'iqi', output.thicknessZoneId),
      field(`${path}.governingThickness`, `IQI Output ${index + 1} Governing Thickness`, 'iqi', output.governingThickness, positiveNumber),
      field(`${path}.iqiMaterial`, `IQI Output ${index + 1} Material`, 'iqi', output.iqiMaterial),
      field(`${path}.designation`, `IQI Output ${index + 1} Designation`, 'iqi', output.designation),
      field(`${path}.requiredSensitivity`, `IQI Output ${index + 1} Required Sensitivity`, 'iqi', output.requiredSensitivity),
      field(`${path}.placement`, `IQI Output ${index + 1} Placement`, 'iqi', output.placement),
      field(`${path}.shimRequirement`, `IQI Output ${index + 1} Shim Requirement`, 'iqi', output.shimRequirement),
    );
    if (iqiRules.basis.iqiType === 'Wire') {
      fields.push(field(`${path}.requiredWire`, `IQI Output ${index + 1} Required Wire`, 'iqi', output.requiredWire));
    } else if (iqiRules.basis.iqiType === 'Hole') {
      fields.push(field(`${path}.requiredHole`, `IQI Output ${index + 1} Required Hole`, 'iqi', output.requiredHole));
    }
  });

  fields.push(
    field('technique.planning.processingPolicy.permittedProcessing', 'Permitted Processing Policy', 'processing', planning.processingPolicy.permittedProcessing),
    field('technique.planning.processingPolicy.prohibitedProcessing', 'Prohibited Processing Policy', 'processing', planning.processingPolicy.prohibitedProcessing),
    field('technique.planning.viewingPresets', 'Viewing Preset Library', 'processing', planning.viewingPresets, nonEmptyArray, 'Define at least one controlled viewing preset.'),
  );
  planning.viewingPresets.forEach((preset, index) => {
    const path = `technique.planning.viewingPresets[${index}]`;
    fields.push(
      field(`${path}.id`, `Viewing Preset ${index + 1} Stable ID`, 'processing', preset.id),
      field(`${path}.name`, `Viewing Preset ${index + 1} Name`, 'processing', preset.name),
      field(`${path}.windowLevel`, `Viewing Preset ${index + 1} Window Level`, 'processing', preset.windowLevel),
      field(`${path}.windowWidth`, `Viewing Preset ${index + 1} Window Width`, 'processing', preset.windowWidth, positiveNumber),
      field(`${path}.zoom`, `Viewing Preset ${index + 1} Zoom`, 'processing', preset.zoom, positiveNumber),
      field(`${path}.sharpness`, `Viewing Preset ${index + 1} Sharpness`, 'processing', preset.sharpness),
    );
  });

  fields.push(field('technique.planning.acceptanceProfiles', 'Acceptance Profile Library', 'acceptance', planning.acceptanceProfiles, nonEmptyArray, 'Define at least one controlled acceptance profile.'));
  planning.acceptanceProfiles.forEach((profile, index) => {
    const path = `technique.planning.acceptanceProfiles[${index}]`;
    fields.push(
      field(`${path}.id`, `Acceptance Profile ${index + 1} Stable ID`, 'acceptance', profile.id),
      field(`${path}.name`, `Acceptance Profile ${index + 1} Name`, 'acceptance', profile.name),
      field(`${path}.standard`, `Acceptance Profile ${index + 1} Standard`, 'acceptance', profile.standard),
      field(`${path}.revision`, `Acceptance Profile ${index + 1} Revision`, 'acceptance', profile.revision),
      field(
        `${path}.acceptanceClass`,
        `Acceptance Profile ${index + 1} Class / Grade / Level`,
        'acceptance',
        profile.acceptanceClass,
        () => [profile.acceptanceClass, profile.grade, profile.level].some(isPresent),
        'Enter the applicable class, grade, or level requirement.',
      ),
      field(`${path}.applicableClause`, `Acceptance Profile ${index + 1} Clause`, 'acceptance', profile.applicableClause),
      field(`${path}.requirementText`, `Acceptance Profile ${index + 1} Requirement Text`, 'acceptance', profile.requirementText),
    );
  });

  planning.overrides.forEach((override, index) => {
    const path = `technique.planning.overrides[${index}]`;
    fields.push(
      field(`${path}.id`, `Override ${index + 1} Stable ID`, 'engineering', override.id),
      field(`${path}.fieldPath`, `Override ${index + 1} Field Path`, 'engineering', override.fieldPath),
      field(`${path}.calculatedValue`, `Override ${index + 1} Calculated Value`, 'engineering', override.calculatedValue),
      field(`${path}.approvedValue`, `Override ${index + 1} Approved Value`, 'engineering', override.approvedValue),
      field(`${path}.reason`, `Override ${index + 1} Reason`, 'engineering', override.reason),
      field(`${path}.approvedBy`, `Override ${index + 1} Level III Identity`, 'engineering', override.approvedBy),
      field(`${path}.approvedAt`, `Override ${index + 1} Approval Date`, 'engineering', override.approvedAt, isIsoCalendarDate, 'Enter a real override approval date in YYYY-MM-DD format.'),
    );
  });

  document.technique.acquisitions.forEach((acquisition, acquisitionIndex) => {
    const path = `technique.acquisitions[${acquisitionIndex}].plan`;
    const plan = acquisition.plan;
    fields.push(field(path, `Acquisition ${acquisitionIndex + 1} Structured Plan`, 'interpretation', plan, (value) => Boolean(value), 'Complete the structured exposure plan.'));
    if (!plan) return;
    fields.push(
      field(`${path}.id`, `Acquisition ${acquisitionIndex + 1} Plan Stable ID`, 'interpretation', plan.id),
      field(`${path}.gridPlacement.id`, `Acquisition ${acquisitionIndex + 1} Grid Stable ID`, 'visual', plan.gridPlacement.id),
      field(`${path}.gridPlacement.row`, `Acquisition ${acquisitionIndex + 1} Grid Row`, 'visual', plan.gridPlacement.row, positiveInteger),
      field(`${path}.gridPlacement.column`, `Acquisition ${acquisitionIndex + 1} Grid Column`, 'visual', plan.gridPlacement.column, positiveInteger),
      field(`${path}.gridPlacement.centerX`, `Acquisition ${acquisitionIndex + 1} Grid Center X`, 'visual', plan.gridPlacement.centerX, nonNegativeNumber),
      field(`${path}.gridPlacement.centerY`, `Acquisition ${acquisitionIndex + 1} Grid Center Y`, 'visual', plan.gridPlacement.centerY, nonNegativeNumber),
      field(`${path}.gridPlacement.detectorOrientation`, `Acquisition ${acquisitionIndex + 1} Grid Orientation`, 'visual', plan.gridPlacement.detectorOrientation),
      field(`${path}.visual.id`, `Acquisition ${acquisitionIndex + 1} Visual Stable ID`, 'visual', plan.visual.id),
      ...digitalPointFields(`${path}.visual.sourcePosition`, `Acquisition ${acquisitionIndex + 1} Source Position`, 'visual', plan.visual.sourcePosition),
      ...digitalPointFields(`${path}.visual.detectorPosition`, `Acquisition ${acquisitionIndex + 1} Detector Position`, 'visual', plan.visual.detectorPosition),
      field(`${path}.visual.detectorRotationDegrees`, `Acquisition ${acquisitionIndex + 1} Detector Rotation`, 'visual', plan.visual.detectorRotationDegrees),
      ...digitalPointFields(`${path}.visual.beamCenter`, `Acquisition ${acquisitionIndex + 1} Beam Center`, 'visual', plan.visual.beamCenter),
      field(`${path}.visual.beamAngleDegrees`, `Acquisition ${acquisitionIndex + 1} Beam Angle`, 'visual', plan.visual.beamAngleDegrees),
      field(`${path}.visual.inspectionAreaId`, `Acquisition ${acquisitionIndex + 1} Visual Inspection Area`, 'visual', plan.visual.inspectionAreaId),
      field(`${path}.visual.leadMarkers`, `Acquisition ${acquisitionIndex + 1} Lead Markers`, 'visual', plan.visual.leadMarkers),
      field(`${path}.iqiAssignment.id`, `Acquisition ${acquisitionIndex + 1} IQI Assignment Stable ID`, 'iqi', plan.iqiAssignment.id),
      field(`${path}.iqiAssignment.zoneOutputId`, `Acquisition ${acquisitionIndex + 1} IQI Output Link`, 'iqi', plan.iqiAssignment.zoneOutputId),
      field(`${path}.iqiAssignment.designation`, `Acquisition ${acquisitionIndex + 1} IQI Designation`, 'iqi', plan.iqiAssignment.designation),
      field(`${path}.iqiAssignment.shimRequirement`, `Acquisition ${acquisitionIndex + 1} IQI Shim Requirement`, 'iqi', plan.iqiAssignment.shimRequirement),
      field(`${path}.iqiAssignment.positionDescription`, `Acquisition ${acquisitionIndex + 1} IQI Position Description`, 'iqi', plan.iqiAssignment.positionDescription),
      ...digitalPointFields(`${path}.iqiAssignment.position`, `Acquisition ${acquisitionIndex + 1} IQI Position`, 'iqi', plan.iqiAssignment.position),
      field(`${path}.interpretationAreas`, `Acquisition ${acquisitionIndex + 1} Interpretation Areas`, 'interpretation', plan.interpretationAreas, nonEmptyArray, 'Define at least one interpretation area for the exposure.'),
    );
    if (iqiRules.basis.iqiType === 'Wire') {
      fields.push(field(`${path}.iqiAssignment.requiredWire`, `Acquisition ${acquisitionIndex + 1} Required Wire`, 'iqi', plan.iqiAssignment.requiredWire));
    } else if (iqiRules.basis.iqiType === 'Hole') {
      fields.push(field(`${path}.iqiAssignment.requiredHole`, `Acquisition ${acquisitionIndex + 1} Required Hole`, 'iqi', plan.iqiAssignment.requiredHole));
    }
    plan.interpretationAreas.forEach((area, areaIndex) => {
      const areaPath = `${path}.interpretationAreas[${areaIndex}]`;
      fields.push(
        field(`${areaPath}.id`, `Interpretation Area ${areaIndex + 1} Stable ID`, 'interpretation', area.id),
        field(`${areaPath}.areaId`, `Interpretation Area ${areaIndex + 1} Controlled ID`, 'interpretation', area.areaId),
        field(`${areaPath}.description`, `Interpretation Area ${areaIndex + 1} Description`, 'interpretation', area.description),
        field(`${areaPath}.inspectionAreaId`, `Interpretation Area ${areaIndex + 1} Inspection Area Link`, 'interpretation', area.inspectionAreaId),
        field(`${areaPath}.thicknessZoneId`, `Interpretation Area ${areaIndex + 1} Thickness Zone Link`, 'interpretation', area.thicknessZoneId),
        ...digitalRegionFields(`${areaPath}.position`, `Interpretation Area ${areaIndex + 1} ROI`, 'interpretation', area.position),
        field(`${areaPath}.thicknessMinimum`, `Interpretation Area ${areaIndex + 1} Thickness Minimum`, 'interpretation', area.thicknessMinimum, positiveNumber),
        field(`${areaPath}.thicknessMaximum`, `Interpretation Area ${areaIndex + 1} Thickness Maximum`, 'interpretation', area.thicknessMaximum, positiveNumber),
        field(`${areaPath}.viewingPresetId`, `Interpretation Area ${areaIndex + 1} Viewing Preset`, 'interpretation', area.viewingPresetId),
        field(`${areaPath}.windowLevel`, `Interpretation Area ${areaIndex + 1} Window Level`, 'interpretation', area.windowLevel),
        field(`${areaPath}.windowWidth`, `Interpretation Area ${areaIndex + 1} Window Width`, 'interpretation', area.windowWidth, positiveNumber),
        field(`${areaPath}.zoom`, `Interpretation Area ${areaIndex + 1} Zoom`, 'interpretation', area.zoom, positiveNumber),
        field(`${areaPath}.acceptanceProfileId`, `Interpretation Area ${areaIndex + 1} Acceptance Profile`, 'interpretation', area.acceptanceProfileId),
      );
    });
  });
  return fields;
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
    field('technique.iqi.requiredSensitivity', 'Required IQI Sensitivity', 'iqi', iqi.requiredSensitivity),
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
    ...digitalPlanningFields(document),
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

const normalizedKey = (value: string): string => value.trim().toLocaleLowerCase();

function addPerformanceTrendIssues(
  issues: RtPtValidationIssue[],
  entries: ReadonlyArray<{ id: string; date: string; measuredSrb: number | ''; measuredSnr: number | '' }> | undefined,
  basePath: string,
  label: string,
  tab: string,
): void {
  if (!entries || entries.length === 0) return;
  const ids = entries.map((entry) => normalizedKey(entry.id));
  if (ids.some((id) => id.length === 0) || new Set(ids).size !== ids.length) {
    addIssue(issues, basePath, `${label} Entry IDs`, tab, 'Every trend entry must have a unique stable ID.');
  }
  entries.forEach((entry, index) => {
    const path = `${basePath}[${index}]`;
    if (!isIsoCalendarDate(entry.date)) {
      addIssue(issues, `${path}.date`, `${label} Entry ${index + 1} Date`, tab, 'Enter a real calendar date in YYYY-MM-DD format.');
    }
    checkPositive(issues, `${path}.measuredSrb`, `${label} Entry ${index + 1} Measured SRb`, tab, entry.measuredSrb);
    checkPositive(issues, `${path}.measuredSnr`, `${label} Entry ${index + 1} Measured SNR`, tab, entry.measuredSnr);
    if (index > 0) {
      const previous = entries[index - 1];
      if (isIsoCalendarDate(previous.date) && isIsoCalendarDate(entry.date) && entry.date < previous.date) {
        addIssue(
          issues,
          `${path}.date`,
          `${label} Chronology`,
          tab,
          'Trend entries are append-only and must stay in chronological order.',
        );
      }
    }
  });
}

function checkUniqueControlledValues(
  issues: RtPtValidationIssue[],
  path: string,
  label: string,
  tab: string,
  values: string[],
): void {
  const normalized = values.map(normalizedKey);
  if (normalized.some((value) => value.length < 2) || new Set(normalized).size !== normalized.length) {
    addIssue(issues, path, label, tab, 'Every entry must have a meaningful, unique controlled identifier.');
  }
}

function checkDigitalRegion(
  issues: RtPtValidationIssue[],
  path: string,
  label: string,
  tab: string,
  region: RtDigitalVisualRegion,
): void {
  if (
    !normalizedCoordinate(region.x)
    || !normalizedCoordinate(region.y)
    || !positiveNumber(region.width)
    || !positiveNumber(region.height)
    || (typeof region.width === 'number' && region.width > 1)
    || (typeof region.height === 'number' && region.height > 1)
    || (
      typeof region.x === 'number'
      && typeof region.width === 'number'
      && region.x + region.width > 1 + Number.EPSILON * 16
    )
    || (
      typeof region.y === 'number'
      && typeof region.height === 'number'
      && region.y + region.height > 1 + Number.EPSILON * 16
    )
  ) {
    addIssue(issues, path, label, tab, 'The normalized visual region must remain entirely inside the 0-to-1 image boundary.');
  }
}

const currentStatusText = (value: string): boolean => {
  const canonicalStatuses = new Set(['current', 'valid', 'qualified', 'active']);
  return canonicalStatuses.has(value.trim().toLowerCase());
};

function checkDigitalCatalogStatus(
  issues: RtPtValidationIssue[],
  path: string,
  label: string,
  tab: string,
  status: RtDigitalCatalogStatus,
  requiredOnDate: string,
): void {
  if (!isMeaningfulControlledText(status.reference)) {
    addIssue(issues, `${path}.reference`, `${label} Reference`, tab, 'Enter the controlled status-record reference.');
  }
  if (!currentStatusText(status.status)) {
    addIssue(issues, `${path}.status`, `${label} Status`, tab, 'The selected catalog status must explicitly be current, valid, active, or qualified.');
  }
  if (!isIsoCalendarDate(status.date)) {
    addIssue(issues, `${path}.date`, `${label} Date`, tab, 'Enter a real status-record date in YYYY-MM-DD format.');
  }
  if (!isIsoCalendarDate(status.dueDate)) {
    addIssue(issues, `${path}.dueDate`, `${label} Due Date`, tab, 'Enter a real status due date in YYYY-MM-DD format.');
  }
  if (isIsoCalendarDate(status.date) && isIsoCalendarDate(status.dueDate) && status.date > status.dueDate) {
    addIssue(issues, `${path}.dueDate`, `${label} Date Order`, tab, 'The status due date cannot be earlier than its record date.');
  }
  if (isIsoCalendarDate(requiredOnDate) && isIsoCalendarDate(status.dueDate) && status.dueDate < requiredOnDate) {
    addIssue(issues, `${path}.dueDate`, `${label} Currency`, tab, `The status expires before the planned inspection date ${requiredOnDate}.`);
  }
  if (isIsoCalendarDate(requiredOnDate) && isIsoCalendarDate(status.date) && status.date > requiredOnDate) {
    addIssue(issues, `${path}.date`, `${label} Availability`, tab, `The status record is dated after the planned inspection date ${requiredOnDate}.`);
  }
}

const sameDigitalStatus = (
  left: RtDigitalCatalogStatus,
  right: RtDigitalCatalogStatus,
): boolean => (
  left.reference.trim() === right.reference.trim()
  && left.status.trim() === right.status.trim()
  && left.date.trim() === right.date.trim()
  && left.dueDate.trim() === right.dueDate.trim()
);

function digitalStructuredCalculation(
  planning: RtDigitalPlanning,
  requestedArea?: RtDigitalInspectionArea,
) {
  const sourceSnapshot = planning.sourceSelection.snapshot;
  const detectorSnapshot = planning.detectorSelection.snapshot;
  const focalSpot = sourceSnapshot?.focalSpots.find((option) => (
    option.id === planning.sourceSelection.focalSpotOptionId
  ));
  const inspectionArea = requestedArea
    ?? resolveRtDigitalInspectionArea(planning.part, planning.geometry.inspectionAreaId);
  if (!sourceSnapshot || !detectorSnapshot || !focalSpot || !inspectionArea) return null;

  const calculation = calculateRtDigitalPlanning({
    geometry: {
      distanceBasis: planning.geometry.distanceBasis,
      sod: planning.geometry.sod,
      sdd: planning.geometry.sdd,
      odd: planning.geometry.odd,
      focalSpotSize: { value: focalSpot.size, unit: focalSpot.unit },
      requiredMaximumUg: planning.geometry.requiredMaximumUg,
      detectorPixelSize: { value: detectorSnapshot.pixelSize, unit: detectorSnapshot.pixelSizeUnit },
      detectorActiveWidth: { value: detectorSnapshot.activeWidth, unit: detectorSnapshot.activeAreaUnit },
      detectorActiveHeight: { value: detectorSnapshot.activeHeight, unit: detectorSnapshot.activeAreaUnit },
      requiredMaximumEffectivePixel: planning.geometry.requiredMaximumEffectivePixel,
    },
    inspectionAreaWidth: { value: inspectionArea.width, unit: inspectionArea.unit },
    inspectionAreaHeight: { value: inspectionArea.height, unit: inspectionArea.unit },
    requiredOverlapPercent: planning.geometry.requiredOverlapPercent,
    excessiveOverlapThresholdPercent: planning.geometry.excessiveOverlapThresholdPercent,
  });
  const effectiveOrientation = planning.detectorSelection.orientation === 'Portrait'
    || planning.detectorSelection.orientation === 'Landscape'
    ? planning.detectorSelection.orientation
    : calculation.orientation.preferredOrientation;
  const orientationOption = effectiveOrientation === 'Portrait'
    ? calculation.orientation.portrait
    : effectiveOrientation === 'Landscape'
      ? calculation.orientation.landscape
      : null;
  return { calculation, effectiveOrientation, orientationOption, focalSpot, inspectionArea };
}

function digitalCoverageAreas(planning: RtDigitalPlanning): RtDigitalInspectionArea[] {
  if (planning.part.inspectionAreas.mode === 'Multiple Areas') {
    return planning.part.inspectionAreas.areas;
  }
  const area = resolveRtDigitalInspectionArea(planning.part, planning.geometry.inspectionAreaId);
  return area ? [area] : [];
}

const digitalAreaMatches = (area: RtDigitalInspectionArea, candidateId: string): boolean => (
  candidateId === area.id || candidateId === area.areaId
);

function digitalAcquisitionCalculation(
  planning: RtDigitalPlanning,
  acquisition: RtDigitalAcquisition,
  area: RtDigitalInspectionArea,
) {
  const sourceSnapshot = planning.sourceSelection.snapshot;
  const detectorSnapshot = planning.detectorSelection.snapshot;
  const focalSpot = sourceSnapshot?.focalSpots.find((option) => (
    option.id === planning.sourceSelection.focalSpotOptionId
  ));
  if (!sourceSnapshot || !detectorSnapshot || !focalSpot) return null;
  const calculation = calculateRtDigitalPlanning({
    geometry: {
      sod: { value: acquisition.sod, unit: acquisition.sodUnit },
      sdd: { value: acquisition.sdd, unit: acquisition.sddUnit },
      odd: { value: acquisition.odd, unit: acquisition.oddUnit },
      focalSpotSize: { value: focalSpot.size, unit: focalSpot.unit },
      requiredMaximumUg: { value: acquisition.requiredUg, unit: acquisition.requiredUgUnit },
      detectorPixelSize: { value: detectorSnapshot.pixelSize, unit: detectorSnapshot.pixelSizeUnit },
      detectorActiveWidth: { value: detectorSnapshot.activeWidth, unit: detectorSnapshot.activeAreaUnit },
      detectorActiveHeight: { value: detectorSnapshot.activeHeight, unit: detectorSnapshot.activeAreaUnit },
      requiredMaximumEffectivePixel: planning.geometry.requiredMaximumEffectivePixel,
    },
    inspectionAreaWidth: { value: area.width, unit: area.unit },
    inspectionAreaHeight: { value: area.height, unit: area.unit },
    requiredOverlapPercent: planning.geometry.requiredOverlapPercent,
    excessiveOverlapThresholdPercent: planning.geometry.excessiveOverlapThresholdPercent,
  });
  const effectiveOrientation = acquisition.orientation === 'Portrait' || acquisition.orientation === 'Landscape'
    ? acquisition.orientation
    : acquisition.plan?.gridPlacement.detectorOrientation === 'Portrait'
      || acquisition.plan?.gridPlacement.detectorOrientation === 'Landscape'
      ? acquisition.plan.gridPlacement.detectorOrientation
      : null;
  const orientationOption = effectiveOrientation === 'Portrait'
    ? calculation.orientation.portrait
    : effectiveOrientation === 'Landscape'
      ? calculation.orientation.landscape
      : null;
  return { calculation, effectiveOrientation, orientationOption };
}

function sameDigitalLength(
  leftValue: number | '',
  leftUnit: 'um' | 'mm' | 'inch',
  rightValue: number | '',
  rightUnit: 'um' | 'mm' | 'inch',
): boolean {
  const left = convertRtDigitalLength(leftValue, leftUnit, 'mm');
  const right = convertRtDigitalLength(rightValue, rightUnit, 'mm');
  if (left === null || right === null) return false;
  const allowance = 1e-9 * Math.max(1, Math.abs(left), Math.abs(right));
  return Math.abs(left - right) <= allowance;
}

function addDigitalStructuredIssues(document: RtDigitalDocument, issues: RtPtValidationIssue[]): void {
  const planning = document.technique.planning;
  if (!planning) return;
  const { part, sourceSelection, detectorSelection, geometry, iqiRules } = planning;
  const inspectionDate = document.technique.general.date;

  const synchronizedIdentity: Array<[string, string, string]> = [
    ['partName', part.partName, document.technique.general.partName],
    ['partNumber', part.partNumber, document.technique.general.partNumber],
    ['vendorCode', part.vendorCode, document.technique.general.vendorCode],
    ['revisionOrConfiguration', part.revisionOrConfiguration, document.technique.general.partRevisionOrConfiguration],
    ['drawingOrSpecificationReference', part.drawingOrSpecificationReference, document.technique.general.drawingReference],
    ['procedureNumber', part.procedureNumber, document.technique.general.procedureNumber],
    ['material', part.material, document.technique.general.material],
    ['surfaceFinish', part.surfaceFinish, document.technique.general.surfaceFinish],
  ];
  if (synchronizedIdentity.some(([, structured, legacy]) => structured.trim() !== legacy.trim())) {
    addIssue(
      issues,
      'technique.planning.part',
      'Structured Part Identity Synchronization',
      'general',
      'Structured part identity fields must match the corresponding controlled general fields.',
    );
  }

  if (part.manufacturingProcess !== 'Other' && isPresent(part.otherManufacturingProcess)) {
    addIssue(issues, 'technique.planning.part.otherManufacturingProcess', 'Inactive Manufacturing Process', 'general', 'Clear the Other manufacturing-process value when Other is not selected.');
  }
  if (part.technique.imageTechnique !== 'Other' && isPresent(part.technique.otherImageTechnique)) {
    addIssue(issues, 'technique.planning.part.technique.otherImageTechnique', 'Inactive Image Technique', 'general', 'Clear the Other image-technique value when Other is not selected.');
  }
  if (
    (part.geometry.geometryType === 'Pipe / Tube' || part.geometry.geometryType === 'Cylinder' || part.geometry.geometryType === 'Ring')
    && typeof part.geometry.insideDiameter === 'number'
    && typeof part.geometry.outsideDiameter === 'number'
    && part.geometry.insideDiameter >= part.geometry.outsideDiameter
  ) {
    addIssue(issues, 'technique.planning.part.geometry.insideDiameter', 'Part Diameter Relationship', 'general', 'The planned inside diameter must be smaller than the outside diameter.');
  }
  if (
    part.geometry.geometryType === 'Cone'
    && typeof part.geometry.minorDiameter === 'number'
    && typeof part.geometry.majorDiameter === 'number'
    && part.geometry.minorDiameter > part.geometry.majorDiameter
  ) {
    addIssue(issues, 'technique.planning.part.geometry.minorDiameter', 'Cone Diameter Relationship', 'general', 'The planned minor diameter cannot exceed the major diameter.');
  }

  if (part.thickness.mode === 'Thickness Range') {
    checkRange(issues, 'technique.planning.part.thickness.minimum', 'Structured Thickness Range', 'general', part.thickness.minimum, part.thickness.maximum);
  } else if (part.thickness.mode === 'Multiple Thickness Zones') {
    if (part.thickness.zones.length < 2) {
      addIssue(issues, 'technique.planning.part.thickness.zones', 'Multiple Thickness Zones', 'general', 'Multiple Thickness Zones requires at least two controlled zones.');
    }
    checkUniqueControlledValues(issues, 'technique.planning.part.thickness.zones', 'Thickness Zone Stable IDs', 'general', part.thickness.zones.map((zone) => zone.id));
    checkUniqueControlledValues(issues, 'technique.planning.part.thickness.zones', 'Thickness Zone Controlled IDs', 'general', part.thickness.zones.map((zone) => zone.zoneId));
    part.thickness.zones.forEach((zone, index) => {
      const path = `technique.planning.part.thickness.zones[${index}]`;
      checkRange(issues, `${path}.minimum`, `Thickness Zone ${index + 1} Range`, 'general', zone.minimum, zone.maximum);
      if (
        typeof zone.minimum === 'number'
        && typeof zone.maximum === 'number'
        && typeof zone.governing === 'number'
        && (zone.governing < zone.minimum || zone.governing > zone.maximum)
      ) {
        addIssue(issues, `${path}.governing`, `Thickness Zone ${index + 1} Governing Thickness`, 'general', 'The governing thickness must be inside the planned zone range.');
      }
      checkDigitalRegion(issues, `${path}.position`, `Thickness Zone ${index + 1} Position`, 'general', zone.position);
    });
  }

  if (part.inspectionAreas.mode === 'Entire Part' && part.inspectionAreas.areas.length !== 0) {
    addIssue(issues, 'technique.planning.part.inspectionAreas.areas', 'Inactive Inspection Areas', 'general', 'Entire Part mode must not retain inactive defined-area records.');
  }
  if (part.inspectionAreas.mode === 'Defined Area' && part.inspectionAreas.areas.length !== 1) {
    addIssue(issues, 'technique.planning.part.inspectionAreas.areas', 'Defined Inspection Area', 'general', 'Defined Area mode requires exactly one controlled inspection area.');
  }
  if (part.inspectionAreas.mode === 'Multiple Areas' && part.inspectionAreas.areas.length < 2) {
    addIssue(issues, 'technique.planning.part.inspectionAreas.areas', 'Multiple Inspection Areas', 'general', 'Multiple Areas mode requires at least two controlled inspection areas.');
  }
  checkUniqueControlledValues(issues, 'technique.planning.part.inspectionAreas.areas', 'Inspection Area Stable IDs', 'general', part.inspectionAreas.areas.map((area) => area.id));
  checkUniqueControlledValues(issues, 'technique.planning.part.inspectionAreas.areas', 'Inspection Area Controlled IDs', 'general', part.inspectionAreas.areas.map((area) => area.areaId));
  part.inspectionAreas.areas.forEach((area, index) => checkDigitalRegion(
    issues,
    `technique.planning.part.inspectionAreas.areas[${index}].position`,
    `Inspection Area ${index + 1} Position`,
    'general',
    area.position,
  ));

  checkUniqueControlledValues(issues, 'technique.planning.part.attachments', 'Part Attachment IDs', 'general', part.attachments.map((attachment) => attachment.id));
  part.attachments.forEach((attachment, index) => {
    if (!validAttachmentMetadata(attachment)) {
      addIssue(issues, `technique.planning.part.attachments[${index}]`, `Part Attachment ${index + 1}`, 'general', 'Attachment metadata must contain a stable ID, safe type, positive size, and lowercase SHA-256 hash.');
    }
  });
  if (!part.attachments.some((attachment) => attachment.id === part.referenceAttachmentId)) {
    addIssue(issues, 'technique.planning.part.referenceAttachmentId', 'Reference Attachment Link', 'general', 'The selected reference attachment must link to part attachment metadata.');
  }

  const sourceSnapshot = sourceSelection.snapshot;
  if (sourceSnapshot) {
    checkRange(issues, 'technique.planning.sourceSelection.snapshot.kvMinimum', 'Source kV Range', 'source', sourceSnapshot.kvMinimum, sourceSnapshot.kvMaximum);
    checkRange(issues, 'technique.planning.sourceSelection.snapshot.currentMinimum', 'Source Current Range', 'source', sourceSnapshot.currentMinimum, sourceSnapshot.currentMaximum);
    checkUniqueControlledValues(issues, 'technique.planning.sourceSelection.snapshot.focalSpots', 'Focal Spot Mode IDs', 'source', sourceSnapshot.focalSpots.map((option) => option.id));
    checkUniqueControlledValues(issues, 'technique.planning.sourceSelection.snapshot.filters', 'Filter IDs', 'source', sourceSnapshot.filters.map((option) => option.id));
    sourceSnapshot.focalSpots.forEach((option, index) => {
      if (!isMeaningfulControlledText(option.label) || !positiveNumber(option.size)) {
        addIssue(issues, `technique.planning.sourceSelection.snapshot.focalSpots[${index}]`, `Focal Spot Mode ${index + 1}`, 'source', 'Every focal-spot mode needs a meaningful label and positive actual size.');
      }
    });
    sourceSnapshot.filters.forEach((option, index) => {
      if (!isMeaningfulControlledText(option.label) || !isMeaningfulControlledText(option.description)) {
        addIssue(issues, `technique.planning.sourceSelection.snapshot.filters[${index}]`, `Source Filter ${index + 1}`, 'source', 'Every catalog filter needs a meaningful label and controlled description.');
      }
    });
    const selectedFocal = sourceSnapshot.focalSpots.find((option) => option.id === sourceSelection.focalSpotOptionId);
    if (!selectedFocal) {
      addIssue(issues, 'technique.planning.sourceSelection.focalSpotOptionId', 'Selected Focal Spot Mode', 'source', 'The selected focal-spot ID is absent from the immutable source snapshot.');
    } else if (!sameDigitalLength(selectedFocal.size, selectedFocal.unit, document.technique.source.focalSpotSize, document.technique.source.focalSpotSizeUnit)) {
      addIssue(issues, 'technique.source.focalSpotSize', 'Selected Focal Spot Synchronization', 'source', 'The source focal-spot value must match the selected catalog mode.');
    }
    if (new Set(sourceSelection.filterOptionIds).size !== sourceSelection.filterOptionIds.length
      || sourceSelection.filterOptionIds.some((id) => !sourceSnapshot.filters.some((option) => option.id === id))) {
      addIssue(issues, 'technique.planning.sourceSelection.filterOptionIds', 'Selected Source Filters', 'source', 'Every selected filter ID must be unique and present in the immutable source snapshot.');
    }
    if ([sourceSnapshot.manufacturer, sourceSnapshot.model, sourceSnapshot.serialNumber].some((value, index) => (
      value.trim() !== [document.technique.source.manufacturer, document.technique.source.model, document.technique.source.serialNumber][index].trim()
    ))) {
      addIssue(issues, 'technique.planning.sourceSelection.snapshot', 'Source Snapshot Identity', 'source', 'The controlled source identity must match its selected catalog snapshot.');
    }
    if (!document.technique.source.calibrationRequirement.toLocaleLowerCase().includes(
      sourceSnapshot.calibration.reference.trim().toLocaleLowerCase(),
    )) {
      addIssue(issues, 'technique.source.calibrationRequirement', 'Source Calibration Snapshot Trace', 'source', 'The active source calibration requirement must identify the immutable snapshot calibration reference.');
    }
    checkDigitalCatalogStatus(issues, 'technique.planning.sourceSelection.snapshot.calibration', 'Source Calibration', 'source', sourceSnapshot.calibration, inspectionDate);
    checkDigitalCatalogStatus(issues, 'technique.planning.sourceSelection.snapshot.qualification', 'Source Qualification', 'source', sourceSnapshot.qualification, inspectionDate);
  }

  const detectorSnapshot = detectorSelection.snapshot;
  if (detectorSnapshot) {
    checkUniqueControlledValues(issues, 'technique.planning.detectorSelection.snapshot.modes', 'Detector Modes', 'detector', detectorSnapshot.modes);
    if (!detectorSnapshot.modes.includes(detectorSelection.detectorMode)) {
      addIssue(issues, 'technique.planning.detectorSelection.detectorMode', 'Selected Detector Mode', 'detector', 'The selected detector mode is absent from the immutable detector snapshot.');
    }
    const system = document.technique.system;
    if (
      detectorSnapshot.manufacturer.trim() !== system.manufacturer.trim()
      || detectorSnapshot.model.trim() !== system.model.trim()
      || detectorSnapshot.serialNumber.trim() !== system.serialNumber.trim()
      || detectorSelection.detectorMode.trim() !== system.detectorMode.trim()
      || !sameDigitalLength(detectorSnapshot.activeWidth, detectorSnapshot.activeAreaUnit, system.activeAreaWidth, system.activeAreaUnit)
      || !sameDigitalLength(detectorSnapshot.activeHeight, detectorSnapshot.activeAreaUnit, system.activeAreaHeight, system.activeAreaUnit)
      || !sameDigitalLength(detectorSnapshot.pixelSize, detectorSnapshot.pixelSizeUnit, system.pixelSize, system.pixelSizeUnit)
      || detectorSnapshot.matrixColumns !== system.matrixColumns
      || detectorSnapshot.matrixRows !== system.matrixRows
      || detectorSnapshot.bitDepth !== system.bitDepth
      || !sameDigitalLength(
        detectorSnapshot.detectorSrb,
        detectorSnapshot.detectorSrbUnit,
        document.technique.detectorPerformance.detectorSrb,
        document.technique.detectorPerformance.detectorSrbUnit,
      )
    ) {
      addIssue(issues, 'technique.planning.detectorSelection.snapshot', 'Detector Snapshot Synchronization', 'detector', 'The controlled detector identity and characteristics must match the selected catalog snapshot.');
    }
    if (
      !sameDigitalStatus(detectorSnapshot.calibration, document.technique.detectorPerformance.calibration)
      || !sameDigitalStatus(detectorSnapshot.badPixelMap, document.technique.detectorPerformance.badPixelMap)
    ) {
      addIssue(issues, 'technique.detectorPerformance', 'Detector Status Snapshot Synchronization', 'detector', 'Active detector calibration and bad-pixel controls must exactly match the immutable detector snapshot.');
    }
    checkDigitalCatalogStatus(issues, 'technique.planning.detectorSelection.snapshot.calibration', 'Detector Calibration', 'detector', detectorSnapshot.calibration, inspectionDate);
    checkDigitalCatalogStatus(issues, 'technique.planning.detectorSelection.snapshot.badPixelMap', 'Bad-pixel Map', 'detector', detectorSnapshot.badPixelMap, inspectionDate);
    checkDigitalCatalogStatus(issues, 'technique.planning.detectorSelection.snapshot.qualification', 'Detector Qualification', 'detector', detectorSnapshot.qualification, inspectionDate);
  }
  (['badPixelMap', 'calibration', 'stability'] as const).forEach((key) => checkDigitalCatalogStatus(
    issues,
    `technique.detectorPerformance.${key}`,
    key === 'badPixelMap' ? 'Bad-pixel Map' : key[0].toUpperCase() + key.slice(1),
    'detector',
    document.technique.detectorPerformance[key],
    inspectionDate,
  ));

  const coverageAreas = digitalCoverageAreas(planning);
  const calculationContexts = coverageAreas.map((area) => digitalStructuredCalculation(planning, area));
  if (coverageAreas.length === 0 || calculationContexts.some((context) => context === null)) {
    addIssue(issues, 'technique.planning.geometry', 'Structured Geometry Calculation Inputs', 'engineering', 'Every controlled inspection area requires a focal-spot mode, source/detector snapshots, and dimensions for geometry and coverage calculations.');
  } else {
    const contexts = calculationContexts.filter((context) => context !== null);
    const primaryCalculation = contexts[0].calculation;
    if (primaryCalculation.geometry.status !== 'complete') {
      addIssue(issues, 'technique.planning.geometry', 'Structured Geometry Consistency', 'engineering', primaryCalculation.geometry.issues.join(' ') || 'The controlled distance pair is incomplete.');
    }
    if (primaryCalculation.geometry.ugStatus !== 'pass') {
      addIssue(issues, 'technique.planning.geometry.requiredMaximumUg', 'Required Maximum Ug', 'engineering', 'Calculated geometric unsharpness must satisfy the controlled maximum Ug.');
    }
    if (primaryCalculation.geometry.resolutionStatus !== 'pass') {
      addIssue(issues, 'technique.planning.geometry.requiredMaximumEffectivePixel', 'Required Effective Pixel Resolution', 'engineering', 'Calculated effective object pixel size must satisfy the controlled maximum.');
    }
    const availableMm = convertRtDigitalLength(geometry.availableSourceDistance.value, geometry.availableSourceDistance.unit, 'mm');
    if (availableMm !== null && primaryCalculation.geometry.sddMm !== null && primaryCalculation.geometry.sddMm > availableMm + 1e-9) {
      addIssue(issues, 'technique.planning.geometry.availableSourceDistance', 'Available Source Distance', 'engineering', 'The calculated SDD exceeds the controlled available source distance.');
    }

    const expectedPlacements: Array<{
      area: RtDigitalInspectionArea;
      descriptor: RtDigitalExposureGridDescriptor;
      orientation: 'Portrait' | 'Landscape';
    }> = [];
    contexts.forEach(({ calculation, effectiveOrientation, orientationOption, inspectionArea }) => {
      const areaLabel = inspectionArea.areaId || inspectionArea.id;
      if (!effectiveOrientation || !orientationOption || calculation.orientation.status !== 'complete') {
        addIssue(issues, 'technique.planning.detectorSelection.orientation', `Detector Orientation Calculation - ${areaLabel}`, 'engineering', 'A complete Portrait/Landscape coverage orientation must be selected or automatically resolved.');
        return;
      }
      if (
        geometry.optimizeExposureCount
        && calculation.orientation.preferredOrientation
        && effectiveOrientation !== calculation.orientation.preferredOrientation
      ) {
        addIssue(issues, 'technique.planning.detectorSelection.orientation', `Optimized Detector Orientation - ${areaLabel}`, 'engineering', 'Exposure-count optimization requires the calculated preferred detector orientation for every inspection area.');
      }
      if (orientationOption.coverage.status !== 'complete') {
        addIssue(issues, 'technique.planning.geometry.requiredOverlapPercent', `FOV Coverage Plan - ${areaLabel}`, 'engineering', orientationOption.coverage.issues.join(' ') || 'The selected orientation has incomplete coverage.');
      }
      if (orientationOption.coverage.warnings.includes('underlap')) {
        addIssue(issues, 'technique.planning.geometry.requiredOverlapPercent', `Coverage Underlap - ${areaLabel}`, 'engineering', 'The planned exposure grid does not meet the required overlap.');
      }
      if (orientationOption.coverage.warnings.includes('excessive-overlap')) {
        addIssue(issues, 'technique.planning.geometry.excessiveOverlapThresholdPercent', `Excessive Coverage Overlap - ${areaLabel}`, 'engineering', 'The calculated grid exceeds the controlled excessive-overlap threshold.');
      }
      orientationOption.coverage.grid.forEach((descriptor) => expectedPlacements.push({
        area: inspectionArea,
        descriptor,
        orientation: effectiveOrientation,
      }));
    });

    const acquisitions = document.technique.acquisitions;
    let completeAggregateGrid = expectedPlacements.length === acquisitions.length;
    expectedPlacements.forEach(({ area, descriptor }) => {
      const matchingCount = acquisitions.filter((acquisition) => (
        acquisition.plan
        && digitalAreaMatches(area, acquisition.plan.visual.inspectionAreaId)
        && acquisition.plan.gridPlacement.row === descriptor.row
        && acquisition.plan.gridPlacement.column === descriptor.column
      )).length;
      if (matchingCount !== 1) completeAggregateGrid = false;
    });
    if (!completeAggregateGrid) {
      addIssue(issues, 'technique.acquisitions', 'Calculated Exposure Grid', 'visual', `The aggregate FOV plan requires ${expectedPlacements.length} unique area/row/column exposures with no missing or duplicate footprints.`);
    }

    acquisitions.forEach((acquisition, index) => {
      const plan = acquisition.plan;
      if (!plan) return;
      const area = coverageAreas.find((candidate) => digitalAreaMatches(candidate, plan.visual.inspectionAreaId));
      const baseline = area ? expectedPlacements.find((candidate) => (
        digitalAreaMatches(candidate.area, plan.visual.inspectionAreaId)
        && candidate.descriptor.row === plan.gridPlacement.row
        && candidate.descriptor.column === plan.gridPlacement.column
      )) : undefined;
      const centerX = convertRtDigitalLength(plan.gridPlacement.centerX, plan.gridPlacement.unit, 'mm');
      const centerY = convertRtDigitalLength(plan.gridPlacement.centerY, plan.gridPlacement.unit, 'mm');
      if (
        !baseline
        || centerX === null
        || centerY === null
        || Math.abs(centerX - baseline.descriptor.centerXmm) > 1e-6
        || Math.abs(centerY - baseline.descriptor.centerYmm) > 1e-6
        || plan.gridPlacement.detectorOrientation !== baseline.orientation
        || acquisition.orientation !== baseline.orientation
      ) {
        addIssue(issues, `technique.acquisitions[${index}].plan.gridPlacement`, `Acquisition ${index + 1} Grid Placement`, 'visual', 'The structured exposure area, placement, and orientation must match its aggregate calculated grid descriptor.');
      }

      const acquisitionCalculation = area ? digitalAcquisitionCalculation(planning, acquisition, area) : null;
      if (!acquisitionCalculation
        || acquisitionCalculation.calculation.geometry.status !== 'complete'
        || acquisitionCalculation.calculation.geometry.ugStatus !== 'pass'
        || acquisitionCalculation.calculation.geometry.resolutionStatus !== 'pass'
        || !acquisitionCalculation.orientationOption
        || acquisitionCalculation.orientationOption.coverage.status !== 'complete'
        || acquisitionCalculation.orientationOption.coverage.warnings.length > 0) {
        addIssue(issues, `technique.acquisitions[${index}]`, `Acquisition ${index + 1} Effective Pixel / FOV`, 'acquisitions', 'The acquisition-specific geometry must pass Ug and effective-pixel requirements and produce complete overlap-controlled FOV coverage.');
        return;
      }
      const acquisitionDescriptor = acquisitionCalculation.orientationOption.coverage.grid.find((descriptor) => (
        descriptor.row === plan.gridPlacement.row && descriptor.column === plan.gridPlacement.column
      ));
      if (
        !acquisitionDescriptor
        || centerX === null
        || centerY === null
        || Math.abs(centerX - acquisitionDescriptor.centerXmm) > 1e-6
        || Math.abs(centerY - acquisitionDescriptor.centerYmm) > 1e-6
        || acquisitionCalculation.effectiveOrientation !== plan.gridPlacement.detectorOrientation
      ) {
        addIssue(issues, `technique.acquisitions[${index}].plan.gridPlacement`, `Acquisition ${index + 1} Acquisition-specific Footprint`, 'visual', 'The committed footprint must remain consistent with the acquisition-specific effective pixel, FOV, and overlap calculation.');
      }
    });
  }

  const normalizedViewIds = document.technique.acquisitions.map((acquisition) => acquisition.viewId.trim().toUpperCase());
  if (
    normalizedViewIds.some((id) => !/^EXP-\d{3,}$/.test(id))
    || new Set(normalizedViewIds).size !== normalizedViewIds.length
  ) {
    addIssue(issues, 'technique.acquisitions', 'Unique EXP IDs', 'acquisitions', 'Every controlled exposure requires a unique EXP-nnn identifier.');
  }
  const expDigits = Math.max(3, String(normalizedViewIds.length).length);
  if (normalizedViewIds.some((id, index) => id !== `EXP-${String(index + 1).padStart(expDigits, '0')}`)) {
    addIssue(issues, 'technique.acquisitions', 'Calculated EXP Identifiers', 'visual', 'Controlled EXP identifiers must form one ordered global sequence across every inspection area.');
  }

  const sourceKvMin = sourceSelection.snapshot?.kvMinimum;
  const sourceKvMax = sourceSelection.snapshot?.kvMaximum;
  const sourceCurrentMin = sourceSelection.snapshot?.currentMinimum;
  const sourceCurrentMax = sourceSelection.snapshot?.currentMaximum;
  const sourcePower = sourceSelection.snapshot?.maximumPowerKw;
  const zoneOutputIds = new Set(iqiRules.zoneOutputs.map((output) => output.id));
  const resolvedInspectionArea = resolveRtDigitalInspectionArea(part, geometry.inspectionAreaId);
  const inspectionAreaIds = new Set([
    part.inspectionAreas.id,
    ...(resolvedInspectionArea ? [resolvedInspectionArea.id, resolvedInspectionArea.areaId] : []),
    ...part.inspectionAreas.areas.flatMap((area) => [area.id, area.areaId]),
  ]);
  const thicknessZoneIds = new Set(part.thickness.mode === 'Multiple Thickness Zones'
    ? part.thickness.zones.flatMap((zone) => [zone.id, zone.zoneId])
    : [part.thickness.id]);
  const viewingPresetIds = new Set(planning.viewingPresets.map((preset) => preset.id));
  const acceptanceProfileIds = new Set(planning.acceptanceProfiles.map((profile) => profile.id));
  const overrideIds = new Set(planning.overrides.map((override) => override.id));

  if (!resolvedInspectionArea || (
    part.inspectionAreas.mode !== 'Entire Part'
    && !inspectionAreaIds.has(geometry.inspectionAreaId)
  )) {
    addIssue(issues, 'technique.planning.geometry.inspectionAreaId', 'Engineering Inspection-area Link', 'engineering', 'The FOV calculation must link to a controlled or derived inspection area.');
  }
  if (!inspectionAreaIds.has(planning.visual.inspectionAreaId)) {
    addIssue(issues, 'technique.planning.visual.inspectionAreaId', 'Visual Planning Inspection-area Link', 'visual', 'The visual template must link to a controlled or derived inspection area.');
  }

  checkUniqueControlledValues(issues, 'technique.planning.iqiRules.zoneOutputs', 'IQI Output Stable IDs', 'iqi', iqiRules.zoneOutputs.map((output) => output.id));
  if (iqiRules.zoneOutputs.filter((output) => output.governing).length !== 1) {
    addIssue(issues, 'technique.planning.iqiRules.zoneOutputs', 'Governing IQI Output', 'iqi', 'Exactly one per-zone IQI output must be identified as governing.');
  }
  if (part.thickness.mode === 'Multiple Thickness Zones') {
    const representedZones = new Set(iqiRules.zoneOutputs.map((output) => output.thicknessZoneId));
    if (part.thickness.zones.some((zone) => !representedZones.has(zone.id) && !representedZones.has(zone.zoneId))) {
      addIssue(issues, 'technique.planning.iqiRules.zoneOutputs', 'IQI Zone Coverage', 'iqi', 'Every controlled thickness zone requires a structured IQI output.');
    }
  }
  iqiRules.zoneOutputs.forEach((output, index) => {
    if (!thicknessZoneIds.has(output.thicknessZoneId)) {
      addIssue(issues, `technique.planning.iqiRules.zoneOutputs[${index}].thicknessZoneId`, `IQI Output ${index + 1} Thickness Zone`, 'iqi', 'The IQI output must link to a controlled thickness zone.');
    }
    if (output.overrideId && (!overrideIds.has(output.overrideId) || !resolveDigitalIqiOverrideControl(planning, output))) {
      addIssue(
        issues,
        `technique.planning.iqiRules.zoneOutputs[${index}].overrideId`,
        `IQI Output ${index + 1} Override`,
        'iqi',
        `The linked override must be complete and use iqiRules.zoneOutputs.${output.id}.<designation|requiredWire|requiredHole|shimRequirement>; its calculated value must equal the unchanged rule output and its approved value controls only that assigned field.`,
      );
    }
  });
  const basisSnapshot = iqiRules.basis.snapshot;
  if (basisSnapshot) {
    checkUniqueControlledValues(issues, 'technique.planning.iqiRules.basis.snapshot.rules', 'IQI Rule Stable IDs', 'iqi', basisSnapshot.rules.map((rule) => rule.id));
    basisSnapshot.rules.forEach((rule, index) => checkRange(
      issues,
      `technique.planning.iqiRules.basis.snapshot.rules[${index}].minimumThickness`,
      `IQI Rule ${index + 1} Thickness Range`,
      'iqi',
      rule.minimumThickness,
      rule.maximumThickness,
    ));
    if (
      basisSnapshot.standard.trim() !== iqiRules.basis.standard.trim()
      || basisSnapshot.standardRevision.trim() !== iqiRules.basis.standardRevision.trim()
      || basisSnapshot.materialGroup.trim() !== iqiRules.basis.materialGroup.trim()
      || basisSnapshot.iqiType !== iqiRules.basis.iqiType
      || basisSnapshot.wallTechnique !== part.technique.wallTechnique
      || basisSnapshot.imageTechnique !== part.technique.imageTechnique
      || basisSnapshot.placementRule.trim() !== iqiRules.basis.placementRule.trim()
    ) {
      addIssue(issues, 'technique.planning.iqiRules.basis.snapshot', 'IQI Rule Snapshot Synchronization', 'iqi', 'The structured IQI basis and part technique must match the immutable rule snapshot.');
    }
    const expectedOutputs = expectedDigitalIqiZoneOutputs(part.thickness, basisSnapshot);
    const matchedOutputIndexes = expectedOutputs.map((expected) => iqiRules.zoneOutputs
      .map((output, outputIndex) => ({ output, outputIndex }))
      .filter(({ output }) => expected.zone.aliases.includes(output.thicknessZoneId)));
    if (
      expectedOutputs.length !== iqiRules.zoneOutputs.length
      || matchedOutputIndexes.some((matches) => matches.length !== 1)
    ) {
      addIssue(
        issues,
        'technique.planning.iqiRules.zoneOutputs',
        'IQI Rule Output Cardinality',
        'iqi',
        'The immutable IQI rule snapshot must produce exactly one output for every controlled thickness zone and no additional outputs.',
      );
    }
    expectedOutputs.forEach((expected, expectedIndex) => {
      const match = matchedOutputIndexes[expectedIndex];
      if (match.length !== 1) return;
      const { output, outputIndex } = match[0];
      if (!expected.matchedRule) {
        addIssue(
          issues,
          `technique.planning.iqiRules.zoneOutputs[${outputIndex}]`,
          `IQI Output ${outputIndex + 1} Rule Match`,
          'iqi',
          'No immutable IQI rule covers the recalculated governing thickness for this zone.',
        );
      } else if (!digitalIqiOutputMatchesRule(output, expected)) {
        addIssue(
          issues,
          `technique.planning.iqiRules.zoneOutputs[${outputIndex}]`,
          `IQI Output ${outputIndex + 1} Rule Synchronization`,
          'iqi',
          `The persisted IQI material, designation, wire/hole, sensitivity, placement, shim, thickness, unit, and governing flag must match immutable rule ${expected.matchedRule.id}.`,
        );
      }
    });
  }

  checkUniqueControlledValues(issues, 'technique.planning.viewingPresets', 'Viewing Preset IDs', 'processing', planning.viewingPresets.map((preset) => preset.id));
  checkUniqueControlledValues(issues, 'technique.planning.acceptanceProfiles', 'Acceptance Profile IDs', 'acceptance', planning.acceptanceProfiles.map((profile) => profile.id));
  checkUniqueControlledValues(issues, 'technique.planning.overrides', 'Override IDs', 'engineering', planning.overrides.map((override) => override.id));
  const levelThreeApprovals = document.approvals.filter((approval) => approval.role === 'ndt-level-3');
  planning.overrides.forEach((override, index) => {
    if (override.calculatedValue.trim() === override.approvedValue.trim()) {
      addIssue(issues, `technique.planning.overrides[${index}].approvedValue`, `Override ${index + 1} Approved Value`, 'engineering', 'An override must record a deliberate approved value that differs from the calculated value.');
    }
    if (!levelThreeApprovals.some((approval) => {
      const identity = override.approvedBy.trim().toLocaleLowerCase();
      const approvalName = approval.name.trim().toLocaleLowerCase();
      const personnelId = approval.personnelId.trim().toLocaleLowerCase();
      return isMeaningfulControlledText(identity)
        && ((isMeaningfulControlledText(approvalName) && identity.includes(approvalName))
          || (isMeaningfulControlledText(personnelId) && identity.includes(personnelId)));
    })) {
      addIssue(issues, `technique.planning.overrides[${index}].approvedBy`, `Override ${index + 1} Level III Traceability`, 'engineering', 'The override approver must trace to a controlled NDT Level III approval identity.');
    }
  });
  if (geometry.levelThreeApprovalReference && !levelThreeApprovals.some((approval) => (
    (isMeaningfulControlledText(approval.personnelId)
      && geometry.levelThreeApprovalReference.toLocaleLowerCase().includes(approval.personnelId.trim().toLocaleLowerCase()))
    || (isMeaningfulControlledText(approval.name)
      && geometry.levelThreeApprovalReference.toLocaleLowerCase().includes(approval.name.trim().toLocaleLowerCase()))
  ))) {
    addIssue(issues, 'technique.planning.geometry.levelThreeApprovalReference', 'Level III Planning Approval Traceability', 'engineering', 'The optimization/override approval reference must identify a controlled NDT Level III approval entry.');
  }

  const allInterpretationIds: string[] = [];
  document.technique.acquisitions.forEach((acquisition: RtDigitalAcquisition, acquisitionIndex) => {
    const path = `technique.acquisitions[${acquisitionIndex}]`;
    if (typeof acquisition.tubeVoltage === 'number' && typeof sourceKvMin === 'number' && typeof sourceKvMax === 'number'
      && (acquisition.tubeVoltage < sourceKvMin || acquisition.tubeVoltage > sourceKvMax)) {
      addIssue(issues, `${path}.tubeVoltage`, `Acquisition ${acquisitionIndex + 1} Source kV Range`, 'acquisitions', `Planned tube voltage must remain within ${sourceKvMin}-${sourceKvMax} kV.`);
    }
    if (typeof acquisition.tubeCurrent === 'number' && typeof sourceCurrentMin === 'number' && typeof sourceCurrentMax === 'number'
      && (acquisition.tubeCurrent < sourceCurrentMin || acquisition.tubeCurrent > sourceCurrentMax)) {
      addIssue(issues, `${path}.tubeCurrent`, `Acquisition ${acquisitionIndex + 1} Source Current Range`, 'acquisitions', `Planned tube current must remain within ${sourceCurrentMin}-${sourceCurrentMax} mA.`);
    }
    if (
      typeof acquisition.tubeVoltage === 'number'
      && typeof acquisition.tubeCurrent === 'number'
      && typeof sourcePower === 'number'
      && acquisition.tubeVoltage * acquisition.tubeCurrent / 1000 > sourcePower + 1e-9
    ) {
      addIssue(issues, `${path}.tubeCurrent`, `Acquisition ${acquisitionIndex + 1} Source Power`, 'acquisitions', `Planned kV/mA exceeds the ${sourcePower} kW catalog limit.`);
    }
    if (acquisition.referenceAttachmentId && !part.attachments.some((attachment) => attachment.id === acquisition.referenceAttachmentId)) {
      addIssue(issues, `${path}.referenceAttachmentId`, `Acquisition ${acquisitionIndex + 1} Reference Attachment`, 'acquisitions', 'The exposure reference attachment must link to controlled part attachment metadata.');
    }
    const plan = acquisition.plan;
    if (!plan) return;
    if (plan.representativeImage !== null && !validAttachmentMetadata(plan.representativeImage)) {
      addIssue(issues, `${path}.plan.representativeImage`, `Acquisition ${acquisitionIndex + 1} Representative Image`, 'interpretation', 'Representative-image metadata is incomplete or invalid.');
    }
    if (!zoneOutputIds.has(plan.iqiAssignment.zoneOutputId) || !completeDigitalIqiAssignment(plan.iqiAssignment, planning)) {
      addIssue(issues, `${path}.plan.iqiAssignment`, `Acquisition ${acquisitionIndex + 1} Structured IQI`, 'iqi', 'The exposure requires a complete IQI assignment linked to a per-zone output.');
    }
    if (!inspectionAreaIds.has(plan.visual.inspectionAreaId)) {
      addIssue(issues, `${path}.plan.visual.inspectionAreaId`, `Acquisition ${acquisitionIndex + 1} Visual Area Link`, 'visual', 'The visual plan must link to a controlled inspection area.');
    }
    checkUniqueControlledValues(issues, `${path}.plan.interpretationAreas`, `Acquisition ${acquisitionIndex + 1} Interpretation Area IDs`, 'interpretation', plan.interpretationAreas.map((area) => area.areaId));
    plan.interpretationAreas.forEach((area, areaIndex) => {
      const areaPath = `${path}.plan.interpretationAreas[${areaIndex}]`;
      allInterpretationIds.push(area.id);
      checkDigitalRegion(issues, `${areaPath}.position`, `Interpretation Area ${area.areaId || areaIndex + 1} ROI`, 'interpretation', area.position);
      checkRange(issues, `${areaPath}.thicknessMinimum`, `Interpretation Area ${area.areaId || areaIndex + 1} Thickness Range`, 'interpretation', area.thicknessMinimum, area.thicknessMaximum);
      if (!inspectionAreaIds.has(area.inspectionAreaId)) {
        addIssue(issues, `${areaPath}.inspectionAreaId`, `Interpretation Area ${area.areaId || areaIndex + 1} Inspection Link`, 'interpretation', 'The interpretation area must link to a controlled inspection area.');
      }
      if (!thicknessZoneIds.has(area.thicknessZoneId)) {
        addIssue(issues, `${areaPath}.thicknessZoneId`, `Interpretation Area ${area.areaId || areaIndex + 1} Thickness Link`, 'interpretation', 'The interpretation area must link to a controlled thickness zone.');
      }
      if (!viewingPresetIds.has(area.viewingPresetId)) {
        addIssue(issues, `${areaPath}.viewingPresetId`, `Interpretation Area ${area.areaId || areaIndex + 1} Viewing Preset`, 'interpretation', 'The interpretation area viewing-preset link is invalid.');
      }
      if (!acceptanceProfileIds.has(area.acceptanceProfileId)) {
        addIssue(issues, `${areaPath}.acceptanceProfileId`, `Interpretation Area ${area.areaId || areaIndex + 1} Acceptance Profile`, 'interpretation', 'The interpretation area acceptance-profile link is invalid.');
      }
    });
  });
  checkUniqueControlledValues(issues, 'technique.acquisitions', 'Interpretation Area Stable IDs', 'interpretation', allInterpretationIds);
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
    const iso17636TestClass = document.technique.iso17636TestClass;
    const circumferentialPlan = document.technique.circumferentialPlan;
    if (iso17636TestClass && circumferentialPlan) {
      const coverage = calculateCircumferentialExposureCount({
        setup: circumferentialPlan.setup,
        testClass: iso17636TestClass,
        outerDiameter: circumferentialPlan.pipeOuterDiameter,
        outerDiameterUnit: circumferentialPlan.pipeOuterDiameterUnit,
        wallThickness: document.technique.general.thickness,
        wallThicknessUnit: document.technique.general.thicknessUnit,
        sfd: exposureDefaults.sfd,
        sfdUnit: exposureDefaults.sfdUnit,
      });
      if (coverage && exposureViews.length > 0 && exposureViews.length < coverage.minimumExposureCount) {
        addIssue(
          issues,
          'technique.exposureViews',
          'Circumferential Coverage',
          'views',
          `Full circumferential coverage at test class ${iso17636TestClass} requires at least`
            + ` ${coverage.minimumExposureCount} exposures (coverage half-angle ${coverage.coverageHalfAngleDeg} deg);`
            + ` ${exposureViews.length} are planned.`,
        );
      }
    }
    if (iso17636TestClass) {
      const classMinimumDensity = ISO_17636_1_MINIMUM_DENSITY[iso17636TestClass];
      if (
        typeof filmSystem.requiredDensityMin === 'number'
        && filmSystem.requiredDensityMin < classMinimumDensity
      ) {
        addIssue(
          issues,
          'technique.filmSystem.requiredDensityMin',
          'ISO 17636-1 Class Density',
          'film',
          `Test class ${iso17636TestClass} requires a minimum optical density of ${classMinimumDensity} H&D.`,
        );
      }
      const iso17636SourceSize = source.sourceType === 'Gamma'
        ? source.gamma.effectiveSourceSize
        : source.xRay.focalSpotSize;
      const iso17636SourceSizeUnit = source.sourceType === 'Gamma'
        ? source.gamma.effectiveSourceSizeUnit
        : source.xRay.focalSpotSizeUnit;
      exposureViews.forEach((view, index) => {
        const minimum = calculateIso17636MinimumSod(
          iso17636TestClass,
          iso17636SourceSize,
          iso17636SourceSizeUnit,
          view.ofd,
          view.ofdUnit,
          view.sodUnit,
        );
        if (minimum && typeof view.sod === 'number' && view.sod < minimum.minimumSod) {
          addIssue(
            issues,
            `technique.exposureViews[${index}].sod`,
            `View ${index + 1} ISO 17636 Minimum Distance`,
            'views',
            `Test class ${iso17636TestClass} requires SOD >= ${minimum.minimumSod} ${minimum.outputUnit}`
              + ` (f >= ${minimum.factor} x d x b^(2/3)).`,
          );
        }
      });
    }
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

    addPerformanceTrendIssues(
      issues,
      detectorPerformance.performanceTrend,
      'technique.detectorPerformance.performanceTrend',
      'Detector Performance Trend',
      'detector',
    );

    if (document.technique.iqi.type === 'Duplex') {
      const duplexElement = resolveRtDuplexElement(document.technique.iqi.designation);
      if (!duplexElement) {
        addIssue(
          issues,
          'technique.iqi.designation',
          'Duplex Element Designation',
          'iqi',
          'Enter a duplex element designation from ISO 19232-5 / ASTM E2002 (13D..1D).',
        );
      } else if (
        duplexElementResolvedBySrb(
          duplexElement,
          detectorPerformance.imageSrb,
          detectorPerformance.imageSrbUnit,
        ) === false
      ) {
        addIssue(
          issues,
          'technique.detectorPerformance.imageSrb',
          'Duplex Element vs Image SRb',
          'detector',
          `Resolving duplex element ${duplexElement.element} requires an image SRb of at most`
            + ` ${duplexElement.wireDiameterMm} mm; the planned image SRb exceeds it.`,
        );
      }
    }

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
    addDigitalStructuredIssues(document, issues);
  } else if (document.method === 'RT-CR') {
    const { general, source, exposureDefaults, scanner, imageQuality, exposureViews } = document.technique;
    checkPositive(issues, 'technique.general.thickness', 'Nominal Thickness', 'general', general.thickness);

    const iso17636TestClass = document.technique.iso17636TestClass;
    const circumferentialPlan = document.technique.circumferentialPlan;
    if (iso17636TestClass && circumferentialPlan) {
      const coverage = calculateCircumferentialExposureCount({
        setup: circumferentialPlan.setup,
        testClass: iso17636TestClass,
        outerDiameter: circumferentialPlan.pipeOuterDiameter,
        outerDiameterUnit: circumferentialPlan.pipeOuterDiameterUnit,
        wallThickness: general.thickness,
        wallThicknessUnit: general.thicknessUnit,
        sfd: exposureDefaults.sfd,
        sfdUnit: exposureDefaults.sfdUnit,
      });
      if (coverage && exposureViews.length > 0 && exposureViews.length < coverage.minimumExposureCount) {
        addIssue(
          issues,
          'technique.exposureViews',
          'Circumferential Coverage',
          'views',
          `Full circumferential coverage at test class ${iso17636TestClass} requires at least`
            + ` ${coverage.minimumExposureCount} exposures (coverage half-angle ${coverage.coverageHalfAngleDeg} deg);`
            + ` ${exposureViews.length} are planned.`,
        );
      }
    }
    if (iso17636TestClass) {
      const iso17636SourceSize = source.sourceType === 'Gamma'
        ? source.gamma.effectiveSourceSize
        : source.xRay.focalSpotSize;
      const iso17636SourceSizeUnit = source.sourceType === 'Gamma'
        ? source.gamma.effectiveSourceSizeUnit
        : source.xRay.focalSpotSizeUnit;
      exposureViews.forEach((view, index) => {
        const minimum = calculateIso17636MinimumSod(
          iso17636TestClass,
          iso17636SourceSize,
          iso17636SourceSizeUnit,
          view.ofd,
          view.ofdUnit,
          view.sodUnit,
        );
        if (minimum && typeof view.sod === 'number' && view.sod < minimum.minimumSod) {
          addIssue(
            issues,
            `technique.exposureViews[${index}].sod`,
            `View ${index + 1} ISO 17636 Minimum Distance`,
            'views',
            `Test class ${iso17636TestClass} requires SOD >= ${minimum.minimumSod} ${minimum.outputUnit}`
              + ` (f >= ${minimum.factor} x d x b^(2/3)).`,
          );
        }
      });
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

    checkPositive(issues, 'technique.scanner.pixelPitch', 'Scanner Pixel Pitch', 'plate', scanner.pixelPitch);
    checkPositive(issues, 'technique.scanner.laserSpotSize', 'Scanner Laser Spot Size', 'plate', scanner.laserSpotSize);
    checkPositive(
      issues,
      'technique.scanner.scanResolutionPixelsPerMm',
      'Planned Scan Resolution',
      'plate',
      scanner.scanResolutionPixelsPerMm,
    );
    const qualification = scanner.qualification;
    (['date', 'dueDate'] as const).forEach((key) => {
      if (isPresent(qualification[key]) && !isIsoCalendarDate(qualification[key])) {
        addIssue(
          issues,
          `technique.scanner.qualification.${key}`,
          key === 'date' ? 'Scanner Qualification Date' : 'Scanner Qualification Due Date',
          'plate',
          'Enter a real calendar date in YYYY-MM-DD format.',
        );
      }
    });
    if (
      isIsoCalendarDate(qualification.date)
      && isIsoCalendarDate(qualification.dueDate)
      && qualification.date > qualification.dueDate
    ) {
      addIssue(
        issues,
        'technique.scanner.qualification.dueDate',
        'Scanner Qualification Order',
        'plate',
        'The scanner qualification date cannot be after its due date.',
      );
    }
    if (
      isIsoCalendarDate(qualification.dueDate)
      && isIsoCalendarDate(general.date)
      && qualification.dueDate < general.date
    ) {
      addIssue(
        issues,
        'technique.scanner.qualification.dueDate',
        'Scanner Qualification Currency',
        'plate',
        'The scanner qualification expires before the planned inspection date.',
      );
    }

    checkPositive(issues, 'technique.imageQuality.requiredSrb', 'Required Basic Spatial Resolution', 'image', imageQuality.requiredSrb);
    checkPositive(issues, 'technique.imageQuality.greyValueMin', 'Required Grey-Value Minimum', 'image', imageQuality.greyValueMin);
    checkPositive(issues, 'technique.imageQuality.greyValueMax', 'Required Grey-Value Maximum', 'image', imageQuality.greyValueMax);
    checkRange(
      issues,
      'technique.imageQuality.greyValueMin',
      'Required Grey-Value Window',
      'image',
      imageQuality.greyValueMin,
      imageQuality.greyValueMax,
    );
    checkPositive(issues, 'technique.imageQuality.requiredSnrMin', 'Required Minimum SNR', 'image', imageQuality.requiredSnrMin);
    checkPositive(issues, 'technique.imageQuality.maxScanDelay', 'Maximum Exposure-to-Scan Delay', 'image', imageQuality.maxScanDelay);
    addPerformanceTrendIssues(
      issues,
      scanner.performanceTrend,
      'technique.scanner.performanceTrend',
      'Scanner Performance Trend',
      'plate',
    );

    const crDuplexElement = resolveRtDuplexElement(imageQuality.duplexWireRequirement);
    if (
      crDuplexElement
      && duplexElementResolvedBySrb(crDuplexElement, imageQuality.requiredSrb, imageQuality.requiredSrbUnit) === false
    ) {
      addIssue(
        issues,
        'technique.imageQuality.requiredSrb',
        'Duplex Element vs Required SRb',
        'image',
        `Resolving duplex element ${crDuplexElement.element} requires an SRb of at most`
          + ` ${crDuplexElement.wireDiameterMm} mm; the planned required SRb exceeds it.`,
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
    const defaultCrUg = calculateFilmGeometricUnsharpness(exposureDefaults, source);
    if (
      typeof defaultCrUg === 'number'
      && typeof exposureDefaults.requiredUg === 'number'
      && defaultCrUg > exposureDefaults.requiredUg
    ) {
      addIssue(
        issues,
        'technique.exposureDefaults.requiredUg',
        'Default Required Ug',
        'views',
        `Calculated default Ug (${defaultCrUg} ${exposureDefaults.requiredUgUnit}) exceeds the user-specified required Ug (${exposureDefaults.requiredUg} ${exposureDefaults.requiredUgUnit}).`,
      );
    }
    exposureViews.forEach((view, index) => {
      const path = `technique.exposureViews[${index}]`;
      checkPositive(issues, `${path}.sfd`, `View ${index + 1} SFD`, 'views', view.sfd);
      checkPositive(issues, `${path}.sod`, `View ${index + 1} SOD`, 'views', view.sod);
      checkPositive(issues, `${path}.ofd`, `View ${index + 1} OFD`, 'views', view.ofd, true);
      checkPositive(issues, `${path}.requiredUg`, `View ${index + 1} Required Ug`, 'views', view.requiredUg, true);
      checkPositive(issues, `${path}.exposureTime`, `View ${index + 1} Exposure Time`, 'views', view.exposureTime);
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
      if (typeof calculatedUg === 'number' && typeof view.requiredUg === 'number' && calculatedUg > view.requiredUg) {
        addIssue(
          issues,
          `${path}.requiredUg`,
          `View ${index + 1} Required Ug`,
          'views',
          `Calculated Ug (${calculatedUg} ${view.requiredUgUnit}) exceeds the user-specified required Ug (${view.requiredUg} ${view.requiredUgUnit}).`,
        );
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

  const ids = document.method === 'RT-Film' || document.method === 'RT-CR'
    ? document.technique.exposureViews.map((view) => view.id)
    : document.method === 'RT-Digital'
      ? document.technique.acquisitions.map((acquisition) => acquisition.id)
      : [];
  if (new Set(ids).size !== ids.length) {
    addIssue(
      issues,
      document.method === 'RT-Digital' ? 'technique.acquisitions' : 'technique.exposureViews',
      'Stable IDs',
      document.method === 'RT-Digital' ? 'acquisitions' : 'views',
      'Every planned view/acquisition must have a unique stable ID.',
    );
  }
}

function hasCompleteApprovalRole(
  document: RtPtDocumentV3,
  role: RtPtDocumentV3['approvals'][number]['role'],
): boolean {
  return document.approvals.some((approval) => (
    approval.role === role
    && isMeaningfulControlledText(approval.name)
    && isMeaningfulControlledText(approval.personnelId)
    && isMeaningfulControlledText(approval.certificationBasis)
    && isPresent(approval.certificationRevision)
    && isIsoCalendarDate(approval.date)
  ));
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
      complete: hasCompleteApprovalRole(document, 'ndt-level-3'),
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
  } else if (document.method === 'RT-CR') {
    const normalizedViewIds = document.technique.exposureViews.map((view) => view.viewId.trim()).filter(Boolean);
    requirements.push(
      {
        path: 'technique.exposureViews',
        label: 'CR Exposure Views',
        tab: 'views',
        complete: normalizedViewIds.length > 0 && new Set(normalizedViewIds).size === normalizedViewIds.length,
        message: 'Approval requires at least one exposure view and every controlled view ID must be unique.',
      },
      {
        path: 'technique.scanner.qualification',
        label: 'Scanner Qualification Evidence',
        tab: 'plate',
        complete: isMeaningfulControlledText(document.technique.scanner.qualification.reference)
          && isIsoCalendarDate(document.technique.scanner.qualification.date)
          && isIsoCalendarDate(document.technique.scanner.qualification.dueDate),
        message: 'Approval requires a scanner qualification reference with real qualification and due dates.',
      },
    );
  } else if (document.method === 'RT-Digital') {
    const normalizedViewIds = document.technique.acquisitions.map((item) => item.viewId.trim()).filter(Boolean);
    requirements.push(
      {
        path: 'technique.planning',
        label: 'Structured Digital Planning',
        tab: 'general',
        complete: Boolean(document.technique.planning),
        message: 'Controlled Digital RT approval requires a complete structured planning model.',
      },
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
      {
        path: 'approvals',
        label: 'Prepared Approval',
        tab: 'control',
        complete: hasCompleteApprovalRole(document, 'prepared'),
        message: 'Digital RT approval requires a complete dated Prepared entry.',
      },
      {
        path: 'approvals',
        label: 'Quality Approval',
        tab: 'control',
        complete: hasCompleteApprovalRole(document, 'quality'),
        message: 'Digital RT approval requires a complete dated Quality entry.',
      },
      {
        path: 'approvals',
        label: 'Customer Approval',
        tab: 'control',
        complete: hasCompleteApprovalRole(document, 'customer'),
        message: 'Digital RT approval requires a complete dated Customer entry.',
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
      : document.method === 'RT-CR'
        ? rtCrFields(document)
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
