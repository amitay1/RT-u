import { GState, jsPDF } from 'jspdf';
import autoTable, { type RowInput } from 'jspdf-autotable';
import {
  calculateDigitalGeometricUnsharpness,
  calculateFilmGeometricUnsharpness,
} from '@/lib/rtGeometry';
import {
  calculateRtDigitalPlanning,
  resolveRtDigitalInspectionArea,
} from '@/lib/rtDigitalPlanning';
import { normalizeRtSetupDiagram, type RtSetupDiagramInput } from '@/lib/rtPtSetupDiagram';
import {
  calculateExposureMas,
  calculateHoneycombRadiographicThickness,
  calculateIqiSensitivityPercent,
  calculateMinimumFocalSpotToImageDistance,
  isThinAdhesiveTenKvpCase,
  lookupPs811000DensityRequirement,
  lookupPs811000EnergySuggestion,
  lookupPs811000ImageQualityRequirement,
  lookupPs811000MaximumReadableDensity,
  lookupPs811000MinimumContrastDifference,
  lookupPs811000UgLimit,
  PS811000_DENSITOMETER_RESOLUTION_HD,
} from '@/lib/ps811000';
import {
  buildPs811000ExposureChart,
  calculatePs811000EquivalentThickness,
} from '@/lib/ps811000ExposureChart';
import { calculateDecayedActivity, resolveRtIsotope } from '@/lib/rtIsotopeDecay';
import { ISO_17636_1_MINIMUM_DENSITY } from '@/lib/rtIso17636';
import { calculateCircumferentialExposureCount } from '@/lib/rtCircumferential';
import type { RtCircumferentialPlan } from '@/types/rtFilm';

const performanceTrendRows = (
  entries: ReadonlyArray<{
    date: string;
    measuredSrb: number | '';
    measuredSrbUnit: string;
    measuredSnr: number | '';
    reference: string;
    notes: string;
  }> | undefined,
): PdfRow[] => (entries ?? []).map((entry, index) => [
  `Measurement ${index + 1} (${formatValue(entry.date)})`,
  formatIdentity(
    entry.measuredSrb === '' ? '' : `SRb ${entry.measuredSrb} ${entry.measuredSrbUnit}`,
    entry.measuredSnr === '' ? '' : `SNR ${entry.measuredSnr}`,
    entry.reference,
    entry.notes,
  ),
]);

const circumferentialPlanRow = (
  plan: RtCircumferentialPlan,
  testClass: 'A' | 'B' | undefined,
  wallThickness: number | '',
  wallThicknessUnit: 'mm' | 'inch',
  sfd: number | '',
  sfdUnit: 'mm' | 'inch',
): PdfRow => {
  const setupLabel = plan.setup === 'internal-panoramic'
    ? 'internal centred panoramic'
    : 'external source, double wall';
  const coverage = testClass
    ? calculateCircumferentialExposureCount({
      setup: plan.setup,
      testClass,
      outerDiameter: plan.pipeOuterDiameter,
      outerDiameterUnit: plan.pipeOuterDiameterUnit,
      wallThickness,
      wallThicknessUnit,
      sfd,
      sfdUnit,
    })
    : null;
  return [
    'Circumferential Coverage Plan',
    `OD ${plan.pipeOuterDiameter} ${plan.pipeOuterDiameterUnit}; ${setupLabel}`
      + (coverage
        ? `; minimum ${coverage.minimumExposureCount} exposures at class ${coverage.testClass}`
          + ` (coverage half-angle ${coverage.coverageHalfAngleDeg} deg)`
        : ''),
  ];
};
import {
  collectRtPtTechniqueImageAttachments,
  type RtPtPdfAttachmentImage,
  type RtPtPdfAttachmentImageMap,
} from '@/utils/export/rtPtPdfAttachments';
import {
  validateRtPtDocument,
  type RtPtValidationSummary,
} from '@/lib/rtPtValidation';
import { hasValidRtPtApprovalFingerprint } from '@/lib/rtPtDocumentCodec';
import {
  RT_PT_METHOD_LABEL,
  type RtPtApprovalRole,
  type RtPtDocumentV3,
} from '@/types/rtPtDocument';
import type { RtDigitalPlanning } from '@/types/rtDigital';

type PdfRow = [string, string];

export interface RtPtPdfSection {
  title: string;
  rows: PdfRow[];
}

export interface RtPtPdfReleaseState {
  controlledRelease: boolean;
  watermark: 'DRAFT - UNCONTROLLED' | 'SUPERSEDED - UNCONTROLLED' | null;
  filenamePrefix: 'DRAFT-UNCONTROLLED-' | 'SUPERSEDED-UNCONTROLLED-' | '';
}

const METHOD_TITLE = {
  'RT-Film': 'Radiographic Testing - Film',
  'RT-Digital': 'Radiographic Testing - Digital Detector Array',
  'RT-CR': 'Radiographic Testing - Computed Radiography',
  PT: 'Liquid Penetrant Testing',
} as const;

const APPROVAL_ROLE_LABEL: Record<RtPtApprovalRole, string> = {
  prepared: 'Prepared by',
  reviewed: 'Reviewed by',
  'cognizant-engineering': 'Cognizant engineering',
  'ndt-level-3': 'NDT Level III',
  quality: 'Quality',
  customer: 'Customer',
};

const hasValue = (value: string | number | boolean | null | undefined): boolean => (
  value !== '' && value !== null && value !== undefined
);

const formatValue = (value: string | number | boolean | null | undefined, unit?: string): string => {
  if (!hasValue(value)) return 'Not specified';
  const formatted = typeof value === 'boolean' ? (value ? 'Yes' : 'No') : String(value);
  return unit ? `${formatted} ${unit}` : formatted;
};

const formatRange = (
  minimum: string | number,
  maximum: string | number,
  unit: string,
): string => {
  if (!hasValue(minimum) && !hasValue(maximum)) return 'Not specified';
  if (!hasValue(minimum)) return `Up to ${formatValue(maximum, unit)}`;
  if (!hasValue(maximum)) return `From ${formatValue(minimum, unit)}`;
  return `${formatValue(minimum, unit)} to ${formatValue(maximum, unit)}`;
};

const commonGeneralRows = (
  general: Extract<RtPtDocumentV3, { method: 'RT-Film' }>['technique']['general'],
): PdfRow[] => [
  ['Part Name', formatValue(general.partName)],
  ['Part Number', formatValue(general.partNumber)],
  ['Vendor Code', formatValue(general.vendorCode)],
  ['Part Revision / Configuration', formatValue(general.partRevisionOrConfiguration)],
  ['Material', formatValue(general.material)],
  ['Surface Finish', formatValue(general.surfaceFinish)],
  ['Inspection Area', formatValue(general.inspectionArea)],
  ['Nominal Thickness', formatValue(general.thickness, general.thicknessUnit)],
  ['Drawing / Specification Reference', formatValue(general.drawingReference)],
  ['Procedure Number', formatValue(general.procedureNumber)],
  ['Inspection Stage', formatValue(general.inspectionStage)],
  ['Required Inspector Level', formatValue(general.inspectorLevel)],
  ['Technique Date', formatValue(general.date)],
];

const acceptanceRows = (
  acceptance: Extract<RtPtDocumentV3, { method: 'RT-Film' }>['technique']['acceptance'],
): PdfRow[] => [
  ['Required Acceptance Source', formatValue(acceptance.acceptanceStandard)],
  ['Required Acceptance Clause', formatValue(acceptance.acceptanceClause)],
  ['Required Acceptance Text', formatValue(acceptance.acceptanceText)],
  ['Acceptance Class (if specified)', formatValue(acceptance.acceptanceClass)],
  ['Acceptance Grade (if specified)', formatValue(acceptance.acceptanceGrade)],
  ['Required Special Requirements', formatValue(acceptance.specialRequirements)],
];

const controlSections = (document: RtPtDocumentV3): RtPtPdfSection[] => {
  const revisionHistory: PdfRow[] = document.revisionHistory.length === 0
    ? [['Revision History', 'None entered']]
    : document.revisionHistory.flatMap((entry, index): PdfRow[] => [
      [`Revision Entry ${index + 1} - Revision / Date`, `${formatValue(entry.revision)} / ${formatValue(entry.date)}`],
      [`Revision Entry ${index + 1} - Description`, formatValue(entry.description)],
      [`Revision Entry ${index + 1} - Author`, formatValue(entry.author)],
    ]);
  const references: PdfRow[] = document.controlledReferences.length === 0
    ? [['Controlled References', 'None entered']]
    : document.controlledReferences.flatMap((reference, index): PdfRow[] => [
      [`Reference ${index + 1} - Type`, formatValue(reference.type)],
      [`Reference ${index + 1} - Title`, formatValue(reference.title)],
      [`Reference ${index + 1} - Number / Revision`, `${formatValue(reference.number)} / ${formatValue(reference.revision)}`],
      [`Reference ${index + 1} - Clause or Note`, formatValue(reference.clauseOrNote)],
    ]);
  const approvals: PdfRow[] = document.approvals.length === 0
    ? [['Approvals', 'None entered']]
    : document.approvals.flatMap((approval, index): PdfRow[] => [
      [`Approval ${index + 1} - Role`, APPROVAL_ROLE_LABEL[approval.role]],
      [`Approval ${index + 1} - Name / Personnel ID`, `${formatValue(approval.name)} / ${formatValue(approval.personnelId)}`],
      [`Approval ${index + 1} - Certification`, `${formatValue(approval.certificationBasis)} / Rev ${formatValue(approval.certificationRevision)}`],
      [`Approval ${index + 1} - Date`, formatValue(approval.date)],
    ]);

  return [
    {
      title: 'Document Control',
      rows: [
        ['Document ID', document.documentId],
        ['Document Type', 'Technique'],
        ['Status', document.status.toUpperCase()],
        ['Document Number', formatValue(document.documentControl.number)],
        ['Title', formatValue(document.documentControl.title)],
        ['Revision', formatValue(document.documentControl.revision)],
        ['Revision Date', formatValue(document.documentControl.revisionDate)],
        ['Effective Date', formatValue(document.documentControl.effectiveDate)],
        ['Change Summary', formatValue(document.documentControl.changeSummary)],
        ['Unit System', document.unitSystem],
      ],
    },
    { title: 'Revision History', rows: revisionHistory },
    {
      title: 'Organization and Job',
      rows: [
        ['Organization', formatValue(document.organization.name)],
        ['Site', formatValue(document.organization.site)],
        ['Customer', formatValue(document.job.customer)],
        ['Contract', formatValue(document.job.contract)],
        ['Purchase Order', formatValue(document.job.purchaseOrder)],
        ['Work Order', formatValue(document.job.workOrder)],
      ],
    },
    { title: 'Controlled References', rows: references },
    { title: 'Approvals', rows: approvals },
  ];
};

const filmDefaultRows = (
  defaults: Extract<RtPtDocumentV3, { method: 'RT-Film' }>['technique']['exposureDefaults'],
  source: Extract<RtPtDocumentV3, { method: 'RT-Film' }>['technique']['source'],
  ps811000Applicable: boolean,
): PdfRow[] => [
  ['Default Planned Wall Technique', formatValue(defaults.wallTechnique)],
  ['Default Planned SFD', formatValue(defaults.sfd, defaults.sfdUnit)],
  ['Default Planned SOD', formatValue(defaults.sod, defaults.sodUnit)],
  ['Default Planned OFD', formatValue(defaults.ofd, defaults.ofdUnit)],
  ['Default Automatic Magnification', formatValue(defaults.geometricMagnificationAuto)],
  ['Default Planned Magnification', formatValue(defaults.geometricMagnification, 'x')],
  ['Default Thickness Description', formatValue(defaults.thicknessDescription)],
  ['Default Planned Thickness Range', formatRange(defaults.thicknessMin, defaults.thicknessMax, defaults.thicknessUnit)],
  ...ps811000ExposureRows(defaults, source, ps811000Applicable, 'Default '),
  ['Default Required Ug', formatValue(defaults.requiredUg, defaults.requiredUgUnit)],
  ['Default Calculated Ug', formatValue(calculateFilmGeometricUnsharpness(defaults, source), defaults.requiredUgUnit)],
  ['Default IQI Requirement / Override', formatValue(defaults.iqiOverride)],
  ['Default Planned Tube Voltage', formatValue(defaults.tubeVoltage, defaults.tubeVoltageUnit)],
  ['Default Planned Tube Current', formatValue(defaults.tubeCurrent, defaults.tubeCurrentUnit)],
  ['Default Planned Exposure Time', formatValue(defaults.exposureTime, defaults.exposureTimeUnit)],
  ['Default Filter', formatValue(defaults.filter)],
  ['Default Collimation', formatValue(defaults.collimation)],
  ['Default Film Designation', formatValue(defaults.filmDesignation)],
  ['Default Film Size', formatValue(defaults.filmSize)],
  ['Default Maximum Parts', formatValue(defaults.maxParts)],
  ['Default Maximum Cassettes', formatValue(defaults.maxCassettes)],
  ['Default Planned Beam Angle', formatValue(defaults.beamAngle, defaults.beamAngleUnit)],
  ['Default Screen Override', formatValue(defaults.screenOverride)],
  ['Default Required Overlap', formatValue(defaults.overlap)],
  ['Default Identification Plan', formatValue(defaults.identification)],
  ['Default Notes', formatValue(defaults.notes)],
];

const ps811000ExposureRows = (
  exposure: Extract<RtPtDocumentV3, { method: 'RT-Film' }>['technique']['exposureDefaults'],
  source: Extract<RtPtDocumentV3, { method: 'RT-Film' }>['technique']['source'],
  applicable: boolean,
  prefix = '',
): PdfRow[] => {
  if (!applicable) return [];
  const honeycombThickness = calculateHoneycombRadiographicThickness({
    skins: exposure.honeycombSkins,
    adhesive: exposure.honeycombAdhesive,
    capsOrFlanges: exposure.honeycombCapsOrFlanges,
    doublersOrTriplers: exposure.honeycombDoublersOrTriplers,
    unit: exposure.thicknessUnit,
  });
  const effectiveThickness = exposure.ps811000ThicknessBasis === 'honeycomb-components'
    ? honeycombThickness
    : exposure.thicknessMax;
  const ugLimit = lookupPs811000UgLimit(effectiveThickness, exposure.thicknessUnit);
  const energySuggestion = exposure.ps811000EnergyCurve
    ? lookupPs811000EnergySuggestion(exposure.ps811000EnergyCurve, effectiveThickness, exposure.thicknessUnit)
    : null;
  const thinAdhesive = exposure.ps811000EnergyCurve
    ? isThinAdhesiveTenKvpCase(exposure.ps811000EnergyCurve, effectiveThickness, exposure.thicknessUnit)
    : false;
  const minimumSfd = calculateMinimumFocalSpotToImageDistance(exposure.coverageDiameter, exposure.coverageDiameterUnit);
  const equivalentThickness = calculatePs811000EquivalentThickness(
    effectiveThickness,
    exposure.ps811000EquivalenceMaterial,
    exposure.tubeVoltage,
  );
  const mas = source.sourceType === 'X-ray'
    ? calculateExposureMas(exposure.tubeCurrent, exposure.exposureTime, exposure.exposureTimeUnit)
    : '';
  return [
    [`${prefix}PS811000E Thickness Basis`, formatValue(exposure.ps811000ThicknessBasis)],
    [`${prefix}Effective Radiographic Thickness`, formatValue(effectiveThickness, exposure.thicknessUnit)],
    [`${prefix}Figure 2 Material Curve`, formatValue(exposure.ps811000EnergyCurve)],
    [`${prefix}Figure 2 Approximate Energy`, thinAdhesive
      ? '10 kVp maximum - thin adhesive case'
      : energySuggestion
        ? `${energySuggestion.approximateKvp} kVp; approximate band ${energySuggestion.lowerKvp}-${energySuggestion.upperKvp} kVp`
        : '-'],
    [`${prefix}Table 1 Equivalence Material`, formatValue(exposure.ps811000EquivalenceMaterial)],
    [`${prefix}Table 1 Equivalent Thickness`, equivalentThickness
      ? `${equivalentThickness.equivalentThickness} ${exposure.thicknessUnit} of ${equivalentThickness.referenceMaterial}`
        + ` (x${equivalentThickness.factor} at ${equivalentThickness.voltageKv} kV)`
      : '-'],
    [`${prefix}Table 8 Maximum Ug`, ugLimit
      ? formatValue(exposure.requiredUgUnit === 'inch' ? ugLimit.maximumInch : ugLimit.maximumMm, exposure.requiredUgUnit)
      : '-'],
    [`${prefix}Machine Technique Table Reference`, formatValue(exposure.machineTechniqueReference)],
    [`${prefix}Maximum Coverage Diameter`, formatValue(exposure.coverageDiameter, exposure.coverageDiameterUnit)],
    [`${prefix}Figure 3 Approximate Minimum SFD`, formatValue(minimumSfd, exposure.coverageDiameterUnit)],
    [`${prefix}Calculated Exposure Product`, formatValue(mas, 'mAs')],
  ];
};

const filmSections = (document: Extract<RtPtDocumentV3, { method: 'RT-Film' }>): RtPtPdfSection[] => {
  const {
    ps811000Applicable,
    general,
    exposureDefaults,
    source,
    filmSystem,
    iqi,
    acceptance,
    exposureViews,
    techniqueNotes,
  } = document.technique;
  const densityRequirement = ps811000Applicable && filmSystem.viewingMode
    ? lookupPs811000DensityRequirement(filmSystem.viewingMode)
    : null;
  const viewerLimit = lookupPs811000MaximumReadableDensity(filmSystem.viewerOutputCandelaPerSquareMeter);
  const minimumContrast = lookupPs811000MinimumContrastDifference(filmSystem.requiredDensityMax);
  const imageQualityRequirement = ps811000Applicable
    ? lookupPs811000ImageQualityRequirement(general.thickness, general.thicknessUnit)
    : null;
  const calculatedIqiSensitivity = calculateIqiSensitivityPercent(
    iqi.thickness,
    iqi.thicknessUnit,
    general.thickness,
    general.thicknessUnit,
  );
  const sourceRows: PdfRow[] = [
    ['Planned Radiation Source Type', formatValue(source.sourceType)],
    ['Source Manufacturer', formatValue(source.manufacturer)],
    ['Source Model', formatValue(source.model)],
    ['Source Serial Number', formatValue(source.serialNumber)],
    ['Source Calibration Requirement', formatValue(source.calibrationRequirement)],
  ];
  if (source.sourceType === 'X-ray') {
    sourceRows.push(['Planned Focal Spot Size', formatValue(source.xRay.focalSpotSize, source.xRay.focalSpotSizeUnit)]);
  } else if (source.sourceType === 'Gamma') {
    sourceRows.push(
      ['Gamma Isotope', formatValue(source.gamma.isotope)],
      ['Gamma Source ID', formatValue(source.gamma.sourceId)],
      ['Referenced Activity', formatValue(source.gamma.activity, source.gamma.activityUnit)],
      ['Activity Reference Date', formatValue(source.gamma.activityReferenceDate)],
      ['Effective Source Size', formatValue(source.gamma.effectiveSourceSize, source.gamma.effectiveSourceSizeUnit)],
    );
    const isotope = resolveRtIsotope(source.gamma.isotope);
    if (isotope) {
      sourceRows.push(['Isotope Half-Life Basis', `${isotope.halfLifeDays} days (${isotope.displayName}, ${isotope.id})`]);
      const decay = calculateDecayedActivity(
        source.gamma.activity,
        source.gamma.activityReferenceDate,
        general.date,
        isotope.halfLifeDays,
      );
      if (decay && decay.elapsedDays >= 0) {
        const activityUnitSuffix = source.gamma.activityUnit ? ` ${source.gamma.activityUnit}` : '';
        sourceRows.push(
          [
            'Computed Activity at Planned Inspection Date',
            `${decay.decayedActivity}${activityUnitSuffix} on ${general.date}`
              + ` (decay factor ${decay.decayFactor}; A = A0 x 2^(-t/T1/2))`,
          ],
          [
            'Exposure-Time Correction Factor',
            `x${decay.exposureTimeMultiplier} relative to the referenced activity`,
          ],
        );
      }
    }
  }

  const sections: RtPtPdfSection[] = [
    {
      title: 'Part and Technique Basis',
      rows: [
        ...commonGeneralRows(general),
        ['PS811000E C1 Applicability', formatValue(ps811000Applicable)],
        ...(document.technique.iso17636TestClass
          ? [[
              'ISO 17636-1 Test Class',
              `Class ${document.technique.iso17636TestClass} (minimum density ${ISO_17636_1_MINIMUM_DENSITY[document.technique.iso17636TestClass]} H&D; f >= ${document.technique.iso17636TestClass === 'A' ? 7.5 : 15} x d x b^(2/3))`,
            ] as PdfRow]
          : []),
        ...(document.technique.circumferentialPlan
          ? [circumferentialPlanRow(
              document.technique.circumferentialPlan,
              document.technique.iso17636TestClass,
              general.thickness,
              general.thicknessUnit,
              exposureDefaults.sfd,
              exposureDefaults.sfdUnit,
            )]
          : []),
      ],
    },
    { title: 'Radiation Source Plan', rows: sourceRows },
    {
      title: 'Required Film System and Processing',
      rows: [
        ['Film Manufacturer', formatValue(filmSystem.manufacturer)],
        ['Film Designation', formatValue(filmSystem.filmDesignation)],
        ['Film Class', formatValue(filmSystem.filmClass)],
        ['Required Density Range', formatRange(filmSystem.requiredDensityMin, filmSystem.requiredDensityMax, '')],
        ['Processing System', formatValue(filmSystem.processingSystem)],
        ['Processing Method', formatValue(filmSystem.processingMethod)],
        ['Planned Processing Time', formatValue(filmSystem.processingTime, filmSystem.processingTimeUnit)],
        ['Planned Processing Temperature', formatValue(filmSystem.processingTemperature, filmSystem.processingTemperatureUnit)],
        ['Required Temperature Tolerance', formatValue(filmSystem.processingTemperatureTolerance, filmSystem.processingTemperatureUnit)],
        ['Front Screen Material', formatValue(filmSystem.frontScreen.material)],
        ['Front Screen Thickness', formatValue(filmSystem.frontScreen.thickness, filmSystem.frontScreen.thicknessUnit)],
        ['Back Screen Material', formatValue(filmSystem.backScreen.material)],
        ['Back Screen Thickness', formatValue(filmSystem.backScreen.thickness, filmSystem.backScreen.thicknessUnit)],
        ['Cassette Type', formatValue(filmSystem.cassetteType)],
        ['Viewing Equipment', formatValue(filmSystem.viewingEquipment)],
        ...(ps811000Applicable ? [
          ['Film Viewing Mode', formatValue(filmSystem.viewingMode)],
          ['PS811000E Density Lookup', densityRequirement
            ? `${densityRequirement.combinedMinimum}-${densityRequirement.maximum} H&D${densityRequirement.individualFilmMinimum === null ? '' : `; each film minimum ${densityRequirement.individualFilmMinimum} H&D`}`
            : 'Not specified'],
          ...(filmSystem.viewingMode === 'superimposed'
            ? [['Planned Individual Film Density Minimum', formatValue(filmSystem.individualFilmDensityMinimum, 'H&D')] as PdfRow]
            : []),
          ['Viewer Output', formatValue(filmSystem.viewerOutputCandelaPerSquareMeter, 'cd/m2')],
          ['Figure 1 Approximate Readable Density', formatValue(viewerLimit?.value, 'H&D')],
          ['Figure 6 Approximate Minimum Contrast', formatValue(minimumContrast?.value, 'H&D')],
          ['Densitometer Resolution Requirement', formatValue(PS811000_DENSITOMETER_RESOLUTION_HD, 'H&D')],
          ['Special Density Approval Reference', formatValue(filmSystem.specialDensityApprovalReference)],
          ['Boeing Part Viewer Limitation', formatValue(filmSystem.boeingPart)],
          ['Boeing Viewer Limit Reference', formatValue(filmSystem.boeingViewerLimitReference)],
        ] as PdfRow[] : []),
      ],
    },
    {
      title: 'Required Image Quality Indicator',
      rows: [
        ['IQI Type', formatValue(iqi.type)],
        ['IQI Standard', formatValue(iqi.standard)],
        ['IQI Designation', formatValue(iqi.designation)],
        ['IQI Shim', formatValue(iqi.shim)],
        ['IQI Block', formatValue(iqi.block)],
        ['IQI Material', formatValue(iqi.material)],
        ['IQI Thickness', formatValue(iqi.thickness, iqi.thicknessUnit)],
        ['IQI Placement', formatValue(iqi.placement)],
        ['Required Sensitivity', formatValue(iqi.requiredSensitivity)],
        ['Required Image Quality Level', formatValue(iqi.imageQualityLevel)],
        ['Required Ug', formatValue(iqi.requiredUg, iqi.requiredUgUnit)],
        ...(ps811000Applicable ? [
          ['Calculated IQI Sensitivity', formatValue(calculatedIqiSensitivity, '%')],
          ['Table 6 Thickness Band', formatValue(imageQualityRequirement?.thicknessBand)],
          ['Table 6 Quality Level', formatValue(imageQualityRequirement?.qualityLevel)],
          ['Table 6 Minimum Perceptible Hole', formatValue(imageQualityRequirement?.minimumPerceptibleHole)],
        ] as PdfRow[] : []),
      ],
    },
    { title: 'Exposure Defaults - Planning Aid Only', rows: filmDefaultRows(exposureDefaults, source, ps811000Applicable) },
  ];

  exposureViews.forEach((view, index) => {
    const rows: PdfRow[] = [
      ['Controlled View ID', formatValue(view.viewId)],
      ['Description', formatValue(view.description)],
      ['Orientation', formatValue(view.orientation)],
      ['Inspection Zone', formatValue(view.inspectionZone)],
      ['Reference Attachment ID', formatValue(view.referenceAttachmentId)],
      ['Planned Wall Technique', formatValue(view.wallTechnique)],
      ['Planned SFD', formatValue(view.sfd, view.sfdUnit)],
      ['Planned SOD', formatValue(view.sod, view.sodUnit)],
      ['Planned OFD', formatValue(view.ofd, view.ofdUnit)],
      ['Planned Magnification', formatValue(view.geometricMagnification, 'x')],
      ['Thickness Description', formatValue(view.thicknessDescription)],
      ['Planned Thickness Range', formatRange(view.thicknessMin, view.thicknessMax, view.thicknessUnit)],
      ...ps811000ExposureRows(view, source, ps811000Applicable),
      ['Required Ug', formatValue(view.requiredUg, view.requiredUgUnit)],
      ['Calculated Ug', formatValue(calculateFilmGeometricUnsharpness(view, source), view.requiredUgUnit)],
      ['IQI Requirement / Override', formatValue(view.iqiOverride)],
    ];
    if (source.sourceType === 'X-ray') {
      rows.push(
        ['Planned Tube Voltage', formatValue(view.tubeVoltage, view.tubeVoltageUnit)],
        ['Planned Tube Current', formatValue(view.tubeCurrent, view.tubeCurrentUnit)],
      );
    }
    rows.push(
      ['Planned Exposure Time', formatValue(view.exposureTime, view.exposureTimeUnit)],
      ['Filter', formatValue(view.filter)],
      ['Collimation', formatValue(view.collimation)],
      ['Film Designation', formatValue(view.filmDesignation)],
      ['Film Size', formatValue(view.filmSize)],
      ['Maximum Parts', formatValue(view.maxParts)],
      ['Maximum Cassettes', formatValue(view.maxCassettes)],
      ['Planned Beam Angle', formatValue(view.beamAngle, view.beamAngleUnit)],
      ['Screen Override', formatValue(view.screenOverride)],
      ['Required Overlap', formatValue(view.overlap)],
      ['Identification Plan', formatValue(view.identification)],
      ['Planned Notes', formatValue(view.notes)],
    );
    sections.push({ title: `Exposure View ${view.viewId || index + 1}`, rows });
  });
  sections.push(
    { title: 'Required Acceptance Criteria', rows: acceptanceRows(acceptance) },
    { title: 'Technique Notes', rows: [['Planned Technique Notes', formatValue(techniqueNotes)]] },
  );
  return sections;
};

const crDefaultRows = (
  defaults: Extract<RtPtDocumentV3, { method: 'RT-CR' }>['technique']['exposureDefaults'],
  source: Extract<RtPtDocumentV3, { method: 'RT-CR' }>['technique']['source'],
): PdfRow[] => [
  ['Default Planned Wall Technique', formatValue(defaults.wallTechnique)],
  ['Default Planned SFD', formatValue(defaults.sfd, defaults.sfdUnit)],
  ['Default Planned SOD', formatValue(defaults.sod, defaults.sodUnit)],
  ['Default Planned OFD', formatValue(defaults.ofd, defaults.ofdUnit)],
  ['Default Planned Magnification', formatValue(defaults.geometricMagnification, 'x')],
  ['Default Thickness Description', formatValue(defaults.thicknessDescription)],
  ['Default Planned Thickness Range', formatRange(defaults.thicknessMin, defaults.thicknessMax, defaults.thicknessUnit)],
  ['Default Required Ug', formatValue(defaults.requiredUg, defaults.requiredUgUnit)],
  ['Default Calculated Ug', formatValue(calculateFilmGeometricUnsharpness(defaults, source), defaults.requiredUgUnit)],
  ['Default Planned Tube Voltage', formatValue(defaults.tubeVoltage, defaults.tubeVoltageUnit)],
  ['Default Planned Tube Current', formatValue(defaults.tubeCurrent, defaults.tubeCurrentUnit)],
  ['Default Planned Exposure Time', formatValue(defaults.exposureTime, defaults.exposureTimeUnit)],
  ['Default Filter', formatValue(defaults.filter)],
  ['Default Collimation', formatValue(defaults.collimation)],
  ['Default Imaging Plate Size', formatValue(defaults.plateSize)],
  ['Default Planned Beam Angle', formatValue(defaults.beamAngle, defaults.beamAngleUnit)],
  ['Default Screen Override', formatValue(defaults.screenOverride)],
  ['Default Required Overlap', formatValue(defaults.overlap)],
  ['Default Identification Plan', formatValue(defaults.identification)],
  ['Default IQI Requirement / Override', formatValue(defaults.iqiOverride)],
  ['Default Notes', formatValue(defaults.notes)],
];

const crSections = (document: Extract<RtPtDocumentV3, { method: 'RT-CR' }>): RtPtPdfSection[] => {
  const {
    general,
    exposureDefaults,
    source,
    plateSystem,
    scanner,
    imageQuality,
    iqi,
    acceptance,
    exposureViews,
    techniqueNotes,
  } = document.technique;
  const calculatedIqiSensitivity = calculateIqiSensitivityPercent(
    iqi.thickness,
    iqi.thicknessUnit,
    general.thickness,
    general.thicknessUnit,
  );
  const sourceRows: PdfRow[] = [
    ['Planned Radiation Source Type', formatValue(source.sourceType)],
    ['Source Manufacturer', formatValue(source.manufacturer)],
    ['Source Model', formatValue(source.model)],
    ['Source Serial Number', formatValue(source.serialNumber)],
    ['Source Calibration Requirement', formatValue(source.calibrationRequirement)],
  ];
  if (source.sourceType === 'X-ray') {
    sourceRows.push(['Planned Focal Spot Size', formatValue(source.xRay.focalSpotSize, source.xRay.focalSpotSizeUnit)]);
  } else if (source.sourceType === 'Gamma') {
    sourceRows.push(
      ['Gamma Isotope', formatValue(source.gamma.isotope)],
      ['Gamma Source ID', formatValue(source.gamma.sourceId)],
      ['Referenced Activity', formatValue(source.gamma.activity, source.gamma.activityUnit)],
      ['Activity Reference Date', formatValue(source.gamma.activityReferenceDate)],
      ['Effective Source Size', formatValue(source.gamma.effectiveSourceSize, source.gamma.effectiveSourceSizeUnit)],
    );
    const isotope = resolveRtIsotope(source.gamma.isotope);
    if (isotope) {
      sourceRows.push(['Isotope Half-Life Basis', `${isotope.halfLifeDays} days (${isotope.displayName}, ${isotope.id})`]);
      const decay = calculateDecayedActivity(
        source.gamma.activity,
        source.gamma.activityReferenceDate,
        general.date,
        isotope.halfLifeDays,
      );
      if (decay && decay.elapsedDays >= 0) {
        const activityUnitSuffix = source.gamma.activityUnit ? ` ${source.gamma.activityUnit}` : '';
        sourceRows.push(
          [
            'Computed Activity at Planned Inspection Date',
            `${decay.decayedActivity}${activityUnitSuffix} on ${general.date}`
              + ` (decay factor ${decay.decayFactor}; A = A0 x 2^(-t/T1/2))`,
          ],
          [
            'Exposure-Time Correction Factor',
            `x${decay.exposureTimeMultiplier} relative to the referenced activity`,
          ],
        );
      }
    }
  }

  const sections: RtPtPdfSection[] = [
    {
      title: 'Part and Technique Basis',
      rows: [
        ...commonGeneralRows(general),
        ...(document.technique.iso17636TestClass
          ? [[
              'ISO 17636-2 Test Class',
              `Class ${document.technique.iso17636TestClass} (f >= ${document.technique.iso17636TestClass === 'A' ? 7.5 : 15} x d x b^(2/3))`,
            ] as PdfRow]
          : []),
        ...(document.technique.circumferentialPlan
          ? [circumferentialPlanRow(
              document.technique.circumferentialPlan,
              document.technique.iso17636TestClass,
              general.thickness,
              general.thicknessUnit,
              exposureDefaults.sfd,
              exposureDefaults.sfdUnit,
            )]
          : []),
      ],
    },
    { title: 'Radiation Source Plan', rows: sourceRows },
    {
      title: 'Required Imaging Plate System',
      rows: [
        ['Plate Manufacturer', formatValue(plateSystem.manufacturer)],
        ['Plate Designation', formatValue(plateSystem.plateDesignation)],
        ['Plate System Class', formatValue(plateSystem.plateClass)],
        ['Cassette Type', formatValue(plateSystem.cassetteType)],
        ['Front Screen Material', formatValue(plateSystem.frontScreen.material)],
        ['Front Screen Thickness', formatValue(plateSystem.frontScreen.thickness, plateSystem.frontScreen.thicknessUnit)],
        ['Back Screen Material', formatValue(plateSystem.backScreen.material)],
        ['Back Screen Thickness', formatValue(plateSystem.backScreen.thickness, plateSystem.backScreen.thicknessUnit)],
        ['Plate Erasure Requirement', formatValue(plateSystem.erasureRequirement)],
        ['Plate Condition Requirement', formatValue(plateSystem.plateConditionRequirement)],
      ],
    },
    {
      title: 'CR Scanner and Readout Plan',
      rows: [
        ['Scanner Manufacturer', formatValue(scanner.manufacturer)],
        ['Scanner Model', formatValue(scanner.model)],
        ['Scanner Serial Number', formatValue(scanner.serialNumber)],
        ['Pixel Pitch', formatValue(scanner.pixelPitch, scanner.pixelPitchUnit)],
        ['Laser Spot Size', formatValue(scanner.laserSpotSize, scanner.laserSpotSizeUnit)],
        ['Planned Scan Resolution', formatValue(scanner.scanResolutionPixelsPerMm, 'px/mm')],
        ['PMT Gain / Voltage Setting', formatValue(scanner.pmtGainOrVoltage)],
        ['Scanner Calibration Requirement', formatValue(scanner.calibrationRequirement)],
        ['Scanner Qualification', digitalStatus(scanner.qualification)],
      ],
    },
    ...(scanner.performanceTrend?.length
      ? [{
          title: 'Scanner Performance Trend (E2737-style)',
          rows: performanceTrendRows(scanner.performanceTrend),
        }]
      : []),
    {
      title: 'Required Scanned-Image Quality',
      rows: [
        ['Required Basic Spatial Resolution (SRb)', formatValue(imageQuality.requiredSrb, imageQuality.requiredSrbUnit)],
        ['Required Grey-Value Window', formatRange(imageQuality.greyValueMin, imageQuality.greyValueMax, '')],
        ['Required Minimum SNR', formatValue(imageQuality.requiredSnrMin)],
        ['Spatial-Resolution Verification', formatValue(imageQuality.duplexWireRequirement)],
        ['Maximum Exposure-to-Scan Delay', formatValue(imageQuality.maxScanDelay, imageQuality.maxScanDelayUnit)],
      ],
    },
    {
      title: 'Required Image Quality Indicator',
      rows: [
        ['IQI Type', formatValue(iqi.type)],
        ['IQI Standard', formatValue(iqi.standard)],
        ['IQI Designation', formatValue(iqi.designation)],
        ['IQI Shim', formatValue(iqi.shim)],
        ['IQI Block', formatValue(iqi.block)],
        ['IQI Material', formatValue(iqi.material)],
        ['IQI Thickness', formatValue(iqi.thickness, iqi.thicknessUnit)],
        ['IQI Placement', formatValue(iqi.placement)],
        ['Required Sensitivity', formatValue(iqi.requiredSensitivity)],
        ['Required Image Quality Level', formatValue(iqi.imageQualityLevel)],
        ['Required Ug', formatValue(iqi.requiredUg, iqi.requiredUgUnit)],
        ['Calculated IQI Sensitivity', formatValue(calculatedIqiSensitivity, '%')],
      ],
    },
    { title: 'Exposure Defaults - Planning Aid Only', rows: crDefaultRows(exposureDefaults, source) },
  ];

  exposureViews.forEach((view, index) => {
    const rows: PdfRow[] = [
      ['Controlled View ID', formatValue(view.viewId)],
      ['Description', formatValue(view.description)],
      ['Orientation', formatValue(view.orientation)],
      ['Inspection Zone', formatValue(view.inspectionZone)],
      ['Reference Attachment ID', formatValue(view.referenceAttachmentId)],
      ['Planned Wall Technique', formatValue(view.wallTechnique)],
      ['Planned SFD', formatValue(view.sfd, view.sfdUnit)],
      ['Planned SOD', formatValue(view.sod, view.sodUnit)],
      ['Planned OFD', formatValue(view.ofd, view.ofdUnit)],
      ['Planned Magnification', formatValue(view.geometricMagnification, 'x')],
      ['Thickness Description', formatValue(view.thicknessDescription)],
      ['Planned Thickness Range', formatRange(view.thicknessMin, view.thicknessMax, view.thicknessUnit)],
      ['Required Ug', formatValue(view.requiredUg, view.requiredUgUnit)],
      ['Calculated Ug', formatValue(calculateFilmGeometricUnsharpness(view, source), view.requiredUgUnit)],
      ['IQI Requirement / Override', formatValue(view.iqiOverride)],
    ];
    if (source.sourceType === 'X-ray') {
      rows.push(
        ['Planned Tube Voltage', formatValue(view.tubeVoltage, view.tubeVoltageUnit)],
        ['Planned Tube Current', formatValue(view.tubeCurrent, view.tubeCurrentUnit)],
      );
    }
    rows.push(
      ['Planned Exposure Time', formatValue(view.exposureTime, view.exposureTimeUnit)],
      ['Filter', formatValue(view.filter)],
      ['Collimation', formatValue(view.collimation)],
      ['Imaging Plate Size', formatValue(view.plateSize)],
      ['Planned Beam Angle', formatValue(view.beamAngle, view.beamAngleUnit)],
      ['Screen Override', formatValue(view.screenOverride)],
      ['Required Overlap', formatValue(view.overlap)],
      ['Identification Plan', formatValue(view.identification)],
      ['Planned Notes', formatValue(view.notes)],
    );
    sections.push({ title: `Exposure View ${view.viewId || index + 1}`, rows });
  });
  sections.push(
    { title: 'Required Acceptance Criteria', rows: acceptanceRows(acceptance) },
    { title: 'Technique Notes', rows: [['Planned Technique Notes', formatValue(techniqueNotes)]] },
  );
  return sections;
};

const digitalDefaultRows = (
  defaults: Extract<RtPtDocumentV3, { method: 'RT-Digital' }>['technique']['acquisitionDefaults'],
  source: Extract<RtPtDocumentV3, { method: 'RT-Digital' }>['technique']['source'],
): PdfRow[] => [
  ['Default Planned Wall Technique', formatValue(defaults.wallTechnique)],
  ['Default Planned SDD', formatValue(defaults.sdd, defaults.sddUnit)],
  ['Default Planned SOD', formatValue(defaults.sod, defaults.sodUnit)],
  ['Default Planned ODD', formatValue(defaults.odd, defaults.oddUnit)],
  ['Default Planned Magnification', formatValue(defaults.magnification, 'x')],
  ['Default Thickness Description', formatValue(defaults.thicknessDescription)],
  ['Default Planned Thickness Range', formatRange(defaults.thicknessMin, defaults.thicknessMax, defaults.thicknessUnit)],
  ['Default Required Ug', formatValue(defaults.requiredUg, defaults.requiredUgUnit)],
  ['Default Calculated Ug', formatValue(calculateDigitalGeometricUnsharpness(defaults, source), defaults.requiredUgUnit)],
  ['Default Planned Tube Voltage', formatValue(defaults.tubeVoltage, defaults.tubeVoltageUnit)],
  ['Default Planned Tube Current', formatValue(defaults.tubeCurrent, defaults.tubeCurrentUnit)],
  ['Default Planned Exposure Time', formatValue(defaults.exposureTime, defaults.exposureTimeUnit)],
  ['Default Planned Integration Time', formatValue(defaults.integrationTime, defaults.integrationTimeUnit)],
  ['Default Frame Count', formatValue(defaults.frameCount)],
  ['Default Frames Averaged', formatValue(defaults.framesAveraged)],
  ['Default Optional Frame Rate', formatValue(defaults.frameRate, 'fps')],
  ['Default Filter', formatValue(defaults.filter)],
  ['Default Collimation', formatValue(defaults.collimation)],
  ['Default IQI Requirement / Override', formatValue(defaults.iqiOverride)],
  ['Default Coverage Plan', formatValue(defaults.coverage)],
  ['Default Image Naming', formatValue(defaults.imageNaming)],
  ['Default Marking Instructions', formatValue(defaults.markingInstructions)],
  ['Default Notes', formatValue(defaults.notes)],
];

const digitalStatus = (status: { reference: string; status: string; date: string; dueDate: string }): string => (
  `${formatValue(status.reference)} / ${formatValue(status.status)} / ${formatValue(status.date)} to ${formatValue(status.dueDate)}`
);

const digitalPoint = (point: { x: string | number; y: string | number }): string => (
  `x ${formatValue(point.x)}, y ${formatValue(point.y)}`
);

const digitalRegion = (region: {
  x: string | number;
  y: string | number;
  width: string | number;
  height: string | number;
  rotationDegrees: string | number;
}): string => (
  `${digitalPoint(region)}, width ${formatValue(region.width)}, height ${formatValue(region.height)}, rotation ${formatValue(region.rotationDegrees, 'deg')}`
);

function digitalPlanningCalculation(planning: RtDigitalPlanning) {
  const source = planning.sourceSelection.snapshot;
  const detector = planning.detectorSelection.snapshot;
  const focalSpot = source?.focalSpots.find((option) => option.id === planning.sourceSelection.focalSpotOptionId);
  const area = resolveRtDigitalInspectionArea(planning.part, planning.geometry.inspectionAreaId);
  if (!source || !detector || !focalSpot || !area) return null;
  return calculateRtDigitalPlanning({
    geometry: {
      distanceBasis: planning.geometry.distanceBasis,
      sod: planning.geometry.sod,
      sdd: planning.geometry.sdd,
      odd: planning.geometry.odd,
      focalSpotSize: { value: focalSpot.size, unit: focalSpot.unit },
      requiredMaximumUg: planning.geometry.requiredMaximumUg,
      detectorPixelSize: { value: detector.pixelSize, unit: detector.pixelSizeUnit },
      detectorActiveWidth: { value: detector.activeWidth, unit: detector.activeAreaUnit },
      detectorActiveHeight: { value: detector.activeHeight, unit: detector.activeAreaUnit },
      requiredMaximumEffectivePixel: planning.geometry.requiredMaximumEffectivePixel,
    },
    inspectionAreaWidth: { value: area.width, unit: area.unit },
    inspectionAreaHeight: { value: area.height, unit: area.unit },
    requiredOverlapPercent: planning.geometry.requiredOverlapPercent,
    excessiveOverlapThresholdPercent: planning.geometry.excessiveOverlapThresholdPercent,
  });
}

const structuredDigitalSections = (planning: RtDigitalPlanning | undefined): RtPtPdfSection[] => {
  if (!planning) {
    return [{
      title: 'Structured Digital Planning',
      rows: [[
        'Controlled Planning Status',
        'Unavailable in this legacy V3 draft; controlled approval and release are blocked.',
      ]],
    }];
  }

  const { part, sourceSelection, detectorSelection, geometry, visual, iqiRules } = planning;
  const partGeometryRows: PdfRow[] = [
    ['Planned Geometry Type', formatValue(part.geometry.geometryType)],
    ['Planned Geometry Unit', formatValue(part.geometry.unit)],
  ];
  switch (part.geometry.geometryType) {
    case 'Flat / Plate':
    case 'Rectangular':
      partGeometryRows.push(
        ['Planned Length', formatValue(part.geometry.length, part.geometry.unit)],
        ['Planned Width', formatValue(part.geometry.width, part.geometry.unit)],
        ['Planned Height', formatValue(part.geometry.height, part.geometry.unit)],
      );
      break;
    case 'Pipe / Tube':
    case 'Cylinder':
    case 'Ring':
      partGeometryRows.push(
        ['Planned Outside Diameter', formatValue(part.geometry.outsideDiameter, part.geometry.unit)],
        ['Planned Inside Diameter', formatValue(part.geometry.insideDiameter, part.geometry.unit)],
        ['Planned Length', formatValue(part.geometry.length, part.geometry.unit)],
      );
      break;
    case 'Cone':
      partGeometryRows.push(
        ['Planned Major Diameter', formatValue(part.geometry.majorDiameter, part.geometry.unit)],
        ['Planned Minor Diameter', formatValue(part.geometry.minorDiameter, part.geometry.unit)],
        ['Planned Height', formatValue(part.geometry.height, part.geometry.unit)],
        ['Planned Wall Thickness', formatValue(part.geometry.wallThickness, part.geometry.unit)],
      );
      break;
    case 'Complex Casting':
      partGeometryRows.push(
        ['Planned Bounding Length', formatValue(part.geometry.boundingLength, part.geometry.unit)],
        ['Planned Bounding Width', formatValue(part.geometry.boundingWidth, part.geometry.unit)],
        ['Planned Bounding Height', formatValue(part.geometry.boundingHeight, part.geometry.unit)],
        ['Required Inspection Envelope', formatValue(part.geometry.inspectionEnvelope)],
      );
      break;
    case 'Other':
      partGeometryRows.push(['Planned Geometry Description', formatValue(part.geometry.description)]);
      break;
    default:
      break;
  }

  const thicknessRows: PdfRow[] = [
    ['Planned Thickness Mode', formatValue(part.thickness.mode)],
    ['Planned Thickness Unit', formatValue(part.thickness.unit)],
  ];
  if (part.thickness.mode === 'Single Thickness') {
    thicknessRows.push(['Planned Thickness', formatValue(part.thickness.thickness, part.thickness.unit)]);
  } else if (part.thickness.mode === 'Thickness Range') {
    thicknessRows.push(['Planned Thickness Range', formatRange(part.thickness.minimum, part.thickness.maximum, part.thickness.unit)]);
  } else if (part.thickness.mode === 'Multiple Thickness Zones') {
    part.thickness.zones.forEach((zone, index) => thicknessRows.push(
      [`Zone ${index + 1} ID / Description`, `${formatValue(zone.zoneId)} / ${formatValue(zone.description)}`],
      [`Zone ${index + 1} Planned Range / Governing`, `${formatRange(zone.minimum, zone.maximum, part.thickness.unit)} / ${formatValue(zone.governing, part.thickness.unit)}`],
      [`Zone ${index + 1} Normalized Position`, digitalRegion(zone.position)],
    ));
  }

  const inspectionRows: PdfRow[] = [
    ['Planned Inspection-area Mode', formatValue(part.inspectionAreas.mode)],
    ['Part Orientation', formatValue(part.partOrientation)],
    ['Datum / Reference', formatValue(part.datumReference)],
  ];
  part.inspectionAreas.areas.forEach((area, index) => inspectionRows.push(
    [`Area ${index + 1} Controlled ID / Description`, `${formatValue(area.areaId)} / ${formatValue(area.description)}`],
    [`Area ${index + 1} Planned Size`, `${formatValue(area.width, area.unit)} x ${formatValue(area.height, area.unit)}`],
    [`Area ${index + 1} Normalized Position`, digitalRegion(area.position)],
  ));
  part.attachments.forEach((attachment, index) => inspectionRows.push(
    [`Attachment ${index + 1} Metadata`, `${formatValue(attachment.id)} / ${formatValue(attachment.name)} / ${formatValue(attachment.mimeType)} / ${formatValue(attachment.size, 'bytes')}`],
    [`Attachment ${index + 1} SHA-256`, formatValue(attachment.sha256)],
  ));

  const sourceSnapshot = sourceSelection.snapshot;
  const sourceRows: PdfRow[] = [
    ['Catalog Record / Revision', `${formatValue(sourceSelection.catalogRecordId)} / ${formatValue(sourceSelection.catalogRevisionId)} / ${formatValue(sourceSelection.catalogRevision)}`],
    ['Selected Focal-spot Mode', formatValue(sourceSelection.focalSpotOptionId)],
    ['Selected Filter IDs', formatValue(sourceSelection.filterOptionIds.join(', '))],
    ['Additional Filter Instruction', formatValue(sourceSelection.extraFilter)],
  ];
  if (sourceSnapshot) sourceRows.push(
    ['Immutable Source Identity', `${formatValue(sourceSnapshot.manufacturer)} / ${formatValue(sourceSnapshot.model)} / ${formatValue(sourceSnapshot.serialNumber)}`],
    ['Qualified kV Range', formatRange(sourceSnapshot.kvMinimum, sourceSnapshot.kvMaximum, 'kV')],
    ['Qualified Current Range', formatRange(sourceSnapshot.currentMinimum, sourceSnapshot.currentMaximum, 'mA')],
    ['Maximum Source Power', formatValue(sourceSnapshot.maximumPowerKw, 'kW')],
    ['Available Focal Spots', sourceSnapshot.focalSpots.map((option) => `${option.id}: ${option.label} (${formatValue(option.size, option.unit)})`).join('; ') || 'Not specified'],
    ['Available Filters', sourceSnapshot.filters.map((option) => `${option.id}: ${option.label} - ${option.description}`).join('; ') || 'Not specified'],
    ['Source Calibration', digitalStatus(sourceSnapshot.calibration)],
    ['Source Qualification', digitalStatus(sourceSnapshot.qualification)],
  );

  const detectorSnapshot = detectorSelection.snapshot;
  const detectorRows: PdfRow[] = [
    ['Catalog Record / Revision', `${formatValue(detectorSelection.catalogRecordId)} / ${formatValue(detectorSelection.catalogRevisionId)} / ${formatValue(detectorSelection.catalogRevision)}`],
    ['Selected Detector Mode', formatValue(detectorSelection.detectorMode)],
    ['Selected Detector Orientation', formatValue(detectorSelection.orientation)],
  ];
  if (detectorSnapshot) detectorRows.push(
    ['Immutable Detector Identity', `${formatValue(detectorSnapshot.manufacturer)} / ${formatValue(detectorSnapshot.model)} / ${formatValue(detectorSnapshot.serialNumber)}`],
    ['Active Area', `${formatValue(detectorSnapshot.activeWidth, detectorSnapshot.activeAreaUnit)} x ${formatValue(detectorSnapshot.activeHeight, detectorSnapshot.activeAreaUnit)}`],
    ['Matrix / Pixel / Bit Depth', `${formatValue(detectorSnapshot.matrixColumns)} x ${formatValue(detectorSnapshot.matrixRows)} / ${formatValue(detectorSnapshot.pixelSize, detectorSnapshot.pixelSizeUnit)} / ${formatValue(detectorSnapshot.bitDepth, 'bit')}`],
    ['Detector SRb', formatValue(detectorSnapshot.detectorSrb, detectorSnapshot.detectorSrbUnit)],
    ['Qualified Modes', detectorSnapshot.modes.join(', ') || 'Not specified'],
    ['Detector Calibration', digitalStatus(detectorSnapshot.calibration)],
    ['Detector Bad-pixel Map', digitalStatus(detectorSnapshot.badPixelMap)],
    ['Detector Qualification', digitalStatus(detectorSnapshot.qualification)],
  );

  const calculation = digitalPlanningCalculation(planning);
  const calculatedRows: PdfRow[] = [
    ['Controlled Distance Basis', formatValue(geometry.distanceBasis)],
    ['Controlled SOD / SDD / ODD', `${formatValue(geometry.sod.value, geometry.sod.unit)} / ${formatValue(geometry.sdd.value, geometry.sdd.unit)} / ${formatValue(geometry.odd.value, geometry.odd.unit)}`],
    ['Available Source Distance', formatValue(geometry.availableSourceDistance.value, geometry.availableSourceDistance.unit)],
    ['Required Maximum Ug', formatValue(geometry.requiredMaximumUg.value, geometry.requiredMaximumUg.unit)],
    ['Required Maximum Effective Pixel', formatValue(geometry.requiredMaximumEffectivePixel.value, geometry.requiredMaximumEffectivePixel.unit)],
    ['Required / Excessive Overlap', `${formatValue(geometry.requiredOverlapPercent, '%')} / ${formatValue(geometry.excessiveOverlapThresholdPercent, '%')}`],
    ['Level III Planning Approval Reference', formatValue(geometry.levelThreeApprovalReference)],
  ];
  if (calculation) {
    const selectedOrientation = detectorSelection.orientation === 'Portrait' || detectorSelection.orientation === 'Landscape'
      ? detectorSelection.orientation
      : calculation.orientation.preferredOrientation;
    const selected = selectedOrientation === 'Portrait'
      ? calculation.orientation.portrait
      : calculation.orientation.landscape;
    calculatedRows.push(
      ['Calculated Geometry Status', calculation.geometry.status],
      ['Calculated SOD / SDD / ODD', `${formatValue(calculation.geometry.sodMm, 'mm')} / ${formatValue(calculation.geometry.sddMm, 'mm')} / ${formatValue(calculation.geometry.oddMm, 'mm')}`],
      ['Calculated Magnification', formatValue(calculation.geometry.magnification, 'x')],
      ['Calculated Ug / Requirement Status', `${formatValue(calculation.geometry.ugMm, 'mm')} / ${formatValue(calculation.geometry.ugStatus)}`],
      ['Calculated Effective Object Pixel / Status', `${formatValue(calculation.geometry.effectiveObjectPixelMm, 'mm')} / ${formatValue(calculation.geometry.resolutionStatus)}`],
      ['Calculated Preferred / Applied Orientation', `${formatValue(calculation.orientation.preferredOrientation)} / ${formatValue(selectedOrientation)}`],
      ['Calculated Object FOV', `${formatValue(selected.objectFovWidthMm, 'mm')} x ${formatValue(selected.objectFovHeightMm, 'mm')}`],
      ['Calculated Exposure Count', formatValue(selected.coverage.totalExposureCount)],
      ['Calculated Coverage Warnings', selected.coverage.warnings.join(', ') || 'None'],
    );
    selected.coverage.grid.forEach((descriptor) => calculatedRows.push([
      `Calculated ${descriptor.id} Grid Placement`,
      `row ${descriptor.row}, column ${descriptor.column}, center ${descriptor.centerXmm} x ${descriptor.centerYmm} mm, ${descriptor.orientation}`,
    ]));
  } else {
    calculatedRows.push(['Calculated Geometry Status', 'Incomplete - controlled catalog and inspection inputs are required.']);
  }

  const iqiRows: PdfRow[] = [
    ['Rule Catalog / Revision', `${formatValue(iqiRules.basis.catalogRecordId)} / ${formatValue(iqiRules.basis.catalogRevisionId)} / ${formatValue(iqiRules.basis.catalogRevision)}`],
    ['Required Standard / Revision', `${formatValue(iqiRules.basis.standard)} / ${formatValue(iqiRules.basis.standardRevision)}`],
    ['Required IQI Type / Material Group', `${formatValue(iqiRules.basis.iqiType)} / ${formatValue(iqiRules.basis.materialGroup)}`],
    ['Required Placement Rule', formatValue(iqiRules.basis.placementRule)],
  ];
  const iqiSnapshot = iqiRules.basis.snapshot;
  if (iqiSnapshot) {
    iqiRows.push(
      ['Immutable IQI Rule Snapshot', `${formatValue(iqiSnapshot.standard)} / ${formatValue(iqiSnapshot.standardRevision)} / ${formatValue(iqiSnapshot.materialGroup)} / ${formatValue(iqiSnapshot.iqiType)}`],
      ['Snapshot Technique / Placement', `${formatValue(iqiSnapshot.wallTechnique)} / ${formatValue(iqiSnapshot.imageTechnique)} / ${formatValue(iqiSnapshot.placementRule)}`],
    );
    iqiSnapshot.rules.forEach((rule, index) => iqiRows.push(
      [`Snapshot IQI Rule ${index + 1} Range`, `${formatRange(rule.minimumThickness, rule.maximumThickness, iqiSnapshot.thicknessUnit)} / ${formatValue(rule.iqiMaterial)} / ${formatValue(rule.designation)}`],
      [`Snapshot IQI Rule ${index + 1} Requirement`, `${formatValue(rule.requiredWire || rule.requiredHole)} / ${formatValue(rule.requiredSensitivity)} / ${formatValue(rule.placement)} / ${formatValue(rule.shimRequirement)}`],
    ));
  }
  iqiRules.zoneOutputs.forEach((output, index) => iqiRows.push(
    [`IQI Zone Output ${index + 1}`, `${formatValue(output.thicknessZoneId)} / ${formatValue(output.designation)} / ${formatValue(output.governingThickness, output.thicknessUnit)}`],
    [`IQI Zone Output ${index + 1} Requirement`, `${formatValue(output.iqiMaterial)} / ${formatValue(output.requiredWire || output.requiredHole)} / ${formatValue(output.requiredSensitivity)} / ${formatValue(output.placement)}`],
    [`IQI Zone Output ${index + 1} Shim / Governing / Override`, `${formatValue(output.shimRequirement)} / ${output.governing ? 'Yes' : 'No'} / ${formatValue(output.overrideId)}`],
  ));

  const processingRows: PdfRow[] = [
    ['Permitted Processing Policy', formatValue(planning.processingPolicy.permittedProcessing)],
    ['Prohibited Processing Policy', formatValue(planning.processingPolicy.prohibitedProcessing)],
  ];
  planning.viewingPresets.forEach((preset, index) => processingRows.push(
    [`Viewing Preset ${index + 1} ID / Name`, `${formatValue(preset.id)} / ${formatValue(preset.name)}`],
    [`Viewing Preset ${index + 1} Controls`, `WL ${formatValue(preset.windowLevel)}, WW ${formatValue(preset.windowWidth)}, zoom ${formatValue(preset.zoom)}, ${formatValue(preset.sharpness)}, LUT ${formatValue(preset.lut)}, invert ${preset.invert ? 'Yes' : 'No'}`],
    [`Viewing Preset ${index + 1} Permitted Processing`, formatValue(preset.permittedProcessing)],
  ));

  const profileRows: PdfRow[] = [];
  planning.acceptanceProfiles.forEach((profile, index) => profileRows.push(
    [`Acceptance Profile ${index + 1} ID / Name`, `${formatValue(profile.id)} / ${formatValue(profile.name)}`],
    [`Acceptance Profile ${index + 1} Basis`, `${formatValue(profile.standard)} / Rev ${formatValue(profile.revision)} / Clause ${formatValue(profile.applicableClause)}`],
    [`Acceptance Profile ${index + 1} Class / Grade / Level`, `${formatValue(profile.acceptanceClass)} / ${formatValue(profile.grade)} / ${formatValue(profile.level)}`],
    [`Acceptance Profile ${index + 1} Required Text`, formatValue(profile.requirementText)],
  ));

  const overrideRows: PdfRow[] = planning.overrides.length === 0
    ? [['Planning Overrides', 'None']]
    : planning.overrides.flatMap((override, index): PdfRow[] => [
      [`Override ${index + 1} ID / Field`, `${formatValue(override.id)} / ${formatValue(override.fieldPath)}`],
      [`Override ${index + 1} Calculated / Approved`, `${formatValue(override.calculatedValue)} / ${formatValue(override.approvedValue)}`],
      [`Override ${index + 1} Reason`, formatValue(override.reason)],
      [`Override ${index + 1} Level III Trace`, `${formatValue(override.approvedBy)} / ${formatValue(override.approvedAt)}`],
    ]);

  return [
    {
      title: 'Structured Planned DR Part Definition',
      rows: [
        ['Structured Part Identity', `${formatValue(part.partName)} / ${formatValue(part.partNumber)} / ${formatValue(part.vendorCode)} / Rev ${formatValue(part.revisionOrConfiguration)}`],
        ['Material / Specification / Group', `${formatValue(part.material)} / ${formatValue(part.materialSpecification)} / ${formatValue(part.materialGroup)}`],
        ['Manufacturing Process', formatValue(part.manufacturingProcess === 'Other' ? part.otherManufacturingProcess : part.manufacturingProcess)],
        ['Required Technique', `${formatValue(part.technique.wallTechnique)} / ${formatValue(part.technique.imageTechnique === 'Other' ? part.technique.otherImageTechnique : part.technique.imageTechnique)}`],
        ['Required Inspection Standard / Revision', `${formatValue(part.inspectionStandard)} / ${formatValue(part.inspectionStandardRevision)}`],
        ...partGeometryRows,
      ],
    },
    { title: 'Structured Planned Thickness Zones', rows: thicknessRows },
    { title: 'Structured Inspection Areas and Attachment Metadata', rows: inspectionRows },
    { title: 'Immutable X-ray Source Catalog Snapshot', rows: sourceRows },
    { title: 'Immutable Detector Catalog Snapshot', rows: detectorRows },
    { title: 'Calculated DR Geometry, FOV, Orientation, and Coverage', rows: calculatedRows },
    {
      title: 'Structured Visual Planning Template',
      rows: [
        ['Planned Source Position', digitalPoint(visual.sourcePosition)],
        ['Planned Detector Position / Rotation', `${digitalPoint(visual.detectorPosition)} / ${formatValue(visual.detectorRotationDegrees, 'deg')}`],
        ['Planned Beam Center / Angle', `${digitalPoint(visual.beamCenter)} / ${formatValue(visual.beamAngleDegrees, 'deg')}`],
        ['Controlled Inspection-area Link', formatValue(visual.inspectionAreaId)],
        ['Required Lead Markers', formatValue(visual.leadMarkers)],
      ],
    },
    { title: 'Structured Required IQI Rule Basis and Zone Outputs', rows: iqiRows },
    { title: 'Controlled Processing Policy and Viewing Presets', rows: processingRows },
    { title: 'Controlled Acceptance Profile Library', rows: profileRows },
    { title: 'Level III Planning Override Log', rows: overrideRows },
  ];
};

const digitalSections = (document: Extract<RtPtDocumentV3, { method: 'RT-Digital' }>): RtPtPdfSection[] => {
  const {
    general,
    workflow,
    source,
    acquisitionDefaults,
    system,
    detectorPerformance,
    imageProcessing,
    displayAndStorage,
    iqi,
    acceptance,
    acquisitions,
    techniqueNotes,
    planning,
  } = document.technique;
  const sections: RtPtPdfSection[] = [
    { title: 'Part and Technique Basis', rows: commonGeneralRows(general) },
    {
      title: 'Static X-ray Acquisition Source',
      rows: [
        ['Required Workflow', formatValue(workflow)],
        ['Source Type', formatValue(source.sourceType)],
        ['Source Manufacturer', formatValue(source.manufacturer)],
        ['Source Model', formatValue(source.model)],
        ['Source Serial Number', formatValue(source.serialNumber)],
        ['Source Calibration Requirement', formatValue(source.calibrationRequirement)],
        ['Planned Focal Spot Size', formatValue(source.focalSpotSize, source.focalSpotSizeUnit)],
      ],
    },
    {
      title: 'DDA System Identity and Qualification',
      rows: [
        ['Detector Type', formatValue(system.ddaType)],
        ['Detector Manufacturer', formatValue(system.manufacturer)],
        ['Detector Model', formatValue(system.model)],
        ['Detector Serial Number', formatValue(system.serialNumber)],
        ['Active Area Width', formatValue(system.activeAreaWidth, system.activeAreaUnit)],
        ['Active Area Height', formatValue(system.activeAreaHeight, system.activeAreaUnit)],
        ['Matrix Columns', formatValue(system.matrixColumns)],
        ['Matrix Rows', formatValue(system.matrixRows)],
        ['Pixel Size', formatValue(system.pixelSize, system.pixelSizeUnit)],
        ['Bit Depth', formatValue(system.bitDepth, 'bit')],
        ['Detector Mode', formatValue(system.detectorMode)],
        ['Acquisition Software', formatValue(system.softwareName)],
        ['Acquisition Software Version', formatValue(system.softwareVersion)],
        ['Required System Qualification Reference', formatValue(system.systemQualificationReference)],
        ['Required Performance Baseline Reference', formatValue(system.performanceBaselineReference)],
      ],
    },
    {
      title: 'Required Detector Performance Controls',
      rows: [
        ['Detector SRb', formatValue(detectorPerformance.detectorSrb, detectorPerformance.detectorSrbUnit)],
        ['Image SRb', formatValue(detectorPerformance.imageSrb, detectorPerformance.imageSrbUnit)],
        ['Bad-pixel Map Reference', formatValue(detectorPerformance.badPixelMap.reference)],
        ['Bad-pixel Map Date / Due', `${formatValue(detectorPerformance.badPixelMap.date)} / ${formatValue(detectorPerformance.badPixelMap.dueDate)}`],
        ['Bad-pixel Map Status', formatValue(detectorPerformance.badPixelMap.status)],
        ['Calibration Reference', formatValue(detectorPerformance.calibration.reference)],
        ['Calibration Date / Due', `${formatValue(detectorPerformance.calibration.date)} / ${formatValue(detectorPerformance.calibration.dueDate)}`],
        ['Calibration Status', formatValue(detectorPerformance.calibration.status)],
        ['Stability Reference', formatValue(detectorPerformance.stability.reference)],
        ['Stability Date / Due', `${formatValue(detectorPerformance.stability.date)} / ${formatValue(detectorPerformance.stability.dueDate)}`],
        ['Stability Status', formatValue(detectorPerformance.stability.status)],
      ],
    },
    ...(detectorPerformance.performanceTrend?.length
      ? [{
          title: 'Detector Performance Trend (E2737-style)',
          rows: performanceTrendRows(detectorPerformance.performanceTrend),
        }]
      : []),
    {
      title: 'Planned Image Processing',
      rows: [
        ['Planned Window Level', formatValue(imageProcessing.windowLevel)],
        ['Planned Window Width', formatValue(imageProcessing.windowWidth)],
        ['Planned Zoom', formatValue(imageProcessing.zoom, '%')],
        ['Planned Noise Reduction', formatValue(imageProcessing.noiseReduction)],
        ['Planned Contrast Enhancement', formatValue(imageProcessing.contrastEnhancement)],
        ['Required Processing Procedure', formatValue(imageProcessing.processingProcedure)],
      ],
    },
    {
      title: 'Display, Storage, and Archive Plan',
      rows: [
        ['Display Manufacturer', formatValue(displayAndStorage.displayManufacturer)],
        ['Display Model', formatValue(displayAndStorage.displayModel)],
        ['Display Serial Number', formatValue(displayAndStorage.displaySerialNumber)],
        ['Viewer Software', formatValue(displayAndStorage.viewerSoftware)],
        ['Viewer Software Version', formatValue(displayAndStorage.viewerSoftwareVersion)],
        ['Required Display Qualification Reference', formatValue(displayAndStorage.displayQualificationReference)],
        ['Planned Storage Format', formatValue(displayAndStorage.storageFormat)],
        ['Planned Archive Location', formatValue(displayAndStorage.archiveLocation)],
        ['Required Retention Period', formatValue(displayAndStorage.retentionPeriod)],
        ['Required Raw-data Preservation', formatValue(displayAndStorage.rawDataPreservation)],
        ['DICONDE Profile Reference (if applicable)', formatValue(displayAndStorage.dicondeProfileReference)],
      ],
    },
    {
      title: 'Required Image Quality Indicator',
      rows: [
        ['IQI Type', formatValue(iqi.type)],
        ['IQI Standard', formatValue(iqi.standard)],
        ['IQI Designation', formatValue(iqi.designation)],
        ['IQI Material', formatValue(iqi.material)],
        ['IQI Thickness', formatValue(iqi.thickness, iqi.thicknessUnit)],
        ['IQI Placement', formatValue(iqi.placement)],
        ['Required Sensitivity', formatValue(iqi.requiredSensitivity)],
        ['Required Ug', formatValue(iqi.requiredUg, iqi.requiredUgUnit)],
        ['Required SNR / Normalized SNR', formatValue(iqi.requiredSnrOrNormalizedSnr)],
        ['Required Contrast Sensitivity / CNR', formatValue(iqi.requiredContrastSensitivityOrCnr)],
      ],
    },
    { title: 'Acquisition Defaults - Planning Aid Only', rows: digitalDefaultRows(acquisitionDefaults, source) },
    ...structuredDigitalSections(planning),
  ];

  acquisitions.forEach((acquisition, index) => {
    const rows: PdfRow[] = [
      ['Controlled View ID', formatValue(acquisition.viewId)],
      ['Description', formatValue(acquisition.description)],
      ['Orientation', formatValue(acquisition.orientation)],
      ['Inspection Zone', formatValue(acquisition.inspectionZone)],
      ['Reference Attachment ID', formatValue(acquisition.referenceAttachmentId)],
      ['Planned Wall Technique', formatValue(acquisition.wallTechnique)],
      ['Planned SDD', formatValue(acquisition.sdd, acquisition.sddUnit)],
      ['Planned SOD', formatValue(acquisition.sod, acquisition.sodUnit)],
      ['Planned ODD', formatValue(acquisition.odd, acquisition.oddUnit)],
      ['Planned Magnification', formatValue(acquisition.magnification, 'x')],
      ['Thickness Description', formatValue(acquisition.thicknessDescription)],
      ['Planned Thickness Range', formatRange(acquisition.thicknessMin, acquisition.thicknessMax, acquisition.thicknessUnit)],
      ['Required Ug', formatValue(acquisition.requiredUg, acquisition.requiredUgUnit)],
      ['Calculated Ug', formatValue(calculateDigitalGeometricUnsharpness(acquisition, source), acquisition.requiredUgUnit)],
      ['Planned Tube Voltage', formatValue(acquisition.tubeVoltage, acquisition.tubeVoltageUnit)],
      ['Planned Tube Current', formatValue(acquisition.tubeCurrent, acquisition.tubeCurrentUnit)],
      ['Planned Exposure Time', formatValue(acquisition.exposureTime, acquisition.exposureTimeUnit)],
      ['Planned Integration Time', formatValue(acquisition.integrationTime, acquisition.integrationTimeUnit)],
      ['Frame Count', formatValue(acquisition.frameCount)],
      ['Frames Averaged', formatValue(acquisition.framesAveraged)],
    ];
    if (acquisition.frameRate !== undefined && acquisition.frameRate !== '') {
      rows.push(['Optional Frame Rate', formatValue(acquisition.frameRate, 'fps')]);
    }
    rows.push(
      ['Filter', formatValue(acquisition.filter)],
      ['Collimation', formatValue(acquisition.collimation)],
      ['IQI Requirement / Override', formatValue(acquisition.iqiOverride)],
      ['Required Coverage Plan', formatValue(acquisition.coverage)],
      ['Image Naming Plan', formatValue(acquisition.imageNaming)],
      ['Marking Instructions', formatValue(acquisition.markingInstructions)],
      ['Planned Notes', formatValue(acquisition.notes)],
    );
    const plan = acquisition.plan;
    if (plan) {
      rows.push(
        ['Structured Plan ID', formatValue(plan.id)],
        ['Calculated Grid Row / Column', `${formatValue(plan.gridPlacement.row)} / ${formatValue(plan.gridPlacement.column)}`],
        ['Calculated Grid Center', `${formatValue(plan.gridPlacement.centerX, plan.gridPlacement.unit)} x ${formatValue(plan.gridPlacement.centerY, plan.gridPlacement.unit)}`],
        ['Required Detector Orientation', formatValue(plan.gridPlacement.detectorOrientation)],
        ['Planned Source Position', digitalPoint(plan.visual.sourcePosition)],
        ['Planned Detector Position / Rotation', `${digitalPoint(plan.visual.detectorPosition)} / ${formatValue(plan.visual.detectorRotationDegrees, 'deg')}`],
        ['Planned Beam Center / Angle', `${digitalPoint(plan.visual.beamCenter)} / ${formatValue(plan.visual.beamAngleDegrees, 'deg')}`],
        ['Controlled Inspection-area Link', formatValue(plan.visual.inspectionAreaId)],
        ['Required Lead Markers', formatValue(plan.visual.leadMarkers)],
        ['Structured IQI Output Link', formatValue(plan.iqiAssignment.zoneOutputId)],
        ['Required IQI Designation / Element', `${formatValue(plan.iqiAssignment.designation)} / ${formatValue(plan.iqiAssignment.requiredWire || plan.iqiAssignment.requiredHole)}`],
        ['Required IQI Shim / Position', `${formatValue(plan.iqiAssignment.shimRequirement)} / ${formatValue(plan.iqiAssignment.positionDescription)} / ${digitalPoint(plan.iqiAssignment.position)}`],
      );
      if (plan.representativeImage) {
        rows.push(
          ['Optional Representative-image Metadata', `${formatValue(plan.representativeImage.id)} / ${formatValue(plan.representativeImage.name)} / ${formatValue(plan.representativeImage.mimeType)} / ${formatValue(plan.representativeImage.size, 'bytes')}`],
          ['Representative-image SHA-256', formatValue(plan.representativeImage.sha256)],
        );
      } else {
        rows.push(['Optional Representative-image Metadata', 'Not attached']);
      }
      plan.interpretationAreas.forEach((area, areaIndex) => rows.push(
        [`IA ${areaIndex + 1} Controlled ID / Description`, `${formatValue(area.areaId)} / ${formatValue(area.description)}`],
        [`IA ${areaIndex + 1} Inspection / Thickness Links`, `${formatValue(area.inspectionAreaId)} / ${formatValue(area.thicknessZoneId)}`],
        [`IA ${areaIndex + 1} ROI / Thickness`, `${digitalRegion(area.position)} / ${formatRange(area.thicknessMinimum, area.thicknessMaximum, area.thicknessUnit)}`],
        [`IA ${areaIndex + 1} Viewing Preset / Acceptance Profile`, `${formatValue(area.viewingPresetId)} / ${formatValue(area.acceptanceProfileId)}`],
        [`IA ${areaIndex + 1} Viewing Controls`, `WL ${formatValue(area.windowLevel)}, WW ${formatValue(area.windowWidth)}, zoom ${formatValue(area.zoom)}, sharpness ${formatValue(area.sharpness)}, LUT ${formatValue(area.lut)}, invert ${area.invert ? 'Yes' : 'No'}`],
        [`IA ${areaIndex + 1} Permitted Processing`, formatValue(area.permittedProcessing)],
      ));
    } else {
      rows.push(['Structured Acquisition Plan', 'Unavailable in this legacy V3 draft; controlled approval and release are blocked.']);
    }
    sections.push({ title: `DDA Acquisition ${acquisition.viewId || index + 1}`, rows });
  });
  sections.push(
    { title: 'Required Acceptance Criteria', rows: acceptanceRows(acceptance) },
    { title: 'Technique Notes', rows: [['Planned Technique Notes', formatValue(techniqueNotes)]] },
  );
  return sections;
};

const productRows = (
  label: string,
  product: { manufacturer: string; designation: string },
): PdfRow[] => [
  [`${label} Manufacturer`, formatValue(product.manufacturer)],
  [`${label} Designation`, formatValue(product.designation)],
];

const ptSections = (document: Extract<RtPtDocumentV3, { method: 'PT' }>): RtPtPdfSection[] => {
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
    techniqueNotes,
  } = document.technique;
  const materialRows: PdfRow[] = [
    ['Penetrant Type', formatValue(materials.penetrantType)],
    ['Penetrant Method', formatValue(materials.method)],
    ...(materials.penetrantType === 'Type I'
      ? [['Required Sensitivity Level', formatValue(materials.sensitivityLevel)] as PdfRow]
      : []),
    ['Approved System Family', formatValue(materials.systemFamily)],
    ['Required Material Qualification Reference', formatValue(materials.qualificationReference)],
    ['Developer Form', formatValue(materials.developerForm)],
    ...productRows('Penetrant', materials.penetrant),
    ...productRows('Cleaner', materials.cleaner),
    ...productRows('Developer', materials.developer),
  ];
  if (materials.method === 'B' || materials.method === 'D') {
    materialRows.push(...productRows('Emulsifier', materials.emulsifier));
  }
  if (materials.method === 'C') materialRows.push(...productRows('Remover', materials.remover));

  const removalRows: PdfRow[] = [];
  if (materials.method === 'A') {
    removalRows.push(
      ['Required Method A Rinse Instructions', formatValue(removal.methodA.instructions)],
      ['Required Rinse Pressure Range', formatRange(removal.methodA.pressureMin, removal.methodA.pressureMax, removal.methodA.pressureUnit)],
      ['Required Rinse Temperature Range', formatRange(removal.methodA.temperatureMin, removal.methodA.temperatureMax, removal.methodA.temperatureUnit)],
    );
  } else if (materials.method === 'B' || materials.method === 'D') {
    removalRows.push(
      ['Emulsifier Type', formatValue(removal.methodBD.type)],
      ['Planned Emulsifier Contact Time', formatValue(removal.methodBD.contactTime, removal.methodBD.contactTimeUnit)],
      ['Planned Emulsifier Application', formatValue(removal.methodBD.applicationMethod)],
      ['Required Post-emulsification Water-rinse Instructions', formatValue(removal.methodBD.postEmulsifierRinseInstructions)],
    );
    if (materials.method === 'D') {
      removalRows.push(
        ['Required Hydrophilic Emulsifier Concentration', formatValue(removal.methodBD.concentration, removal.methodBD.concentrationUnit)],
        ['Required Method D Pre-rinse Instructions', formatValue(removal.methodD.preRinseInstructions)],
        ['Required Method D Final-rinse Instructions', formatValue(removal.methodD.finalRinseInstructions)],
      );
    }
  } else if (materials.method === 'C') {
    removalRows.push(['Required Method C Remover Instructions', formatValue(removal.methodC.removerInstructions)]);
  }
  if (removalRows.length === 0) removalRows.push(['Removal Plan', '-']);

  const viewingRows: PdfRow[] = [['Required Equipment', formatValue(conditions.equipmentRequirements)]];
  if (materials.penetrantType === 'Type I') {
    viewingRows.push(
      ['Required UV-A Minimum', formatValue(conditions.requiredUvAMin, conditions.uvAUnit)],
      ['Required Ambient Visible Light Maximum', formatValue(conditions.ambientVisibleLightMax, conditions.visibleLightUnit)],
      ['Required Dark Adaptation Time', formatValue(conditions.darkAdaptationTime, conditions.darkAdaptationTimeUnit)],
    );
  } else if (materials.penetrantType === 'Type II') {
    viewingRows.push(['Required White Light Minimum', formatValue(conditions.whiteLightMin, conditions.visibleLightUnit)]);
  }

  return [
    { title: 'Part and Technique Basis', rows: commonGeneralRows(general) },
    { title: 'Approved Penetrant Material System', rows: materialRows },
    {
      title: 'Planned Surface Preparation',
      rows: [
        ['Cleaning Method', formatValue(surfacePrep.cleaningMethod)],
        ['Required Cleaning Details', formatValue(surfacePrep.cleaningDetails)],
        ['Cleaning Restrictions', formatValue(surfacePrep.cleaningRestrictions)],
        ['Required Surface Condition', formatValue(surfacePrep.surfaceCondition)],
        ['Drying Method', formatValue(surfacePrep.dryingMethod)],
        ['Planned Drying Time', formatValue(surfacePrep.dryingTime, surfacePrep.dryingTimeUnit)],
        ['Planned Drying Temperature', formatValue(surfacePrep.dryingTemperature, surfacePrep.dryingTemperatureUnit)],
      ],
    },
    {
      title: 'Planned Penetrant Application',
      rows: [
        ['Application Method', formatValue(application.applicationMethod)],
        ['Planned Dwell Time', formatValue(application.dwellTime, application.dwellTimeUnit)],
        ['Required Part Temperature Range', formatRange(application.partTemperatureMin, application.partTemperatureMax, application.partTemperatureUnit)],
        ['Required Penetrant Temperature Range', formatRange(application.penetrantTemperatureMin, application.penetrantTemperatureMax, application.penetrantTemperatureUnit)],
      ],
    },
    { title: `Required Method ${materials.method || '-'} Removal Controls`, rows: removalRows },
    {
      title: 'Planned Development',
      rows: [
        ['Developer Application', formatValue(development.developerApplication)],
        ['Planned Development Time', formatValue(development.developmentTime, development.developmentTimeUnit)],
        ['Required Developer Instructions', formatValue(development.instructions)],
      ],
    },
    { title: 'Required Viewing Conditions', rows: viewingRows },
    { title: 'Required Acceptance Criteria', rows: acceptanceRows(acceptance) },
    {
      title: 'Required Post-cleaning',
      rows: [
        ['Post-cleaning Instructions', formatValue(postCleaning.instructions)],
        ['Corrosion Protection', formatValue(postCleaning.corrosionProtection)],
      ],
    },
    { title: 'Technique Notes', rows: [['Planned Technique Notes', formatValue(techniqueNotes)]] },
  ];
};

export function getRtPtExportSections(document: RtPtDocumentV3): RtPtPdfSection[] {
  const techniqueSections = document.method === 'RT-Film'
    ? filmSections(document)
    : document.method === 'RT-Digital'
      ? digitalSections(document)
      : document.method === 'RT-CR'
        ? crSections(document)
        : ptSections(document);
  return [...controlSections(document), ...techniqueSections];
}

export function getRtPtPdfReleaseState(
  document: RtPtDocumentV3,
  callerValidation?: RtPtValidationSummary,
): RtPtPdfReleaseState {
  void callerValidation;
  const validation = validateRtPtDocument(document);
  const controlledRelease = document.status === 'approved'
    && validation.approvalReadiness.isReady
    && hasValidRtPtApprovalFingerprint(document);
  const superseded = document.status === 'superseded';
  return {
    controlledRelease,
    watermark: controlledRelease
      ? null
      : superseded ? 'SUPERSEDED - UNCONTROLLED' : 'DRAFT - UNCONTROLLED',
    filenamePrefix: controlledRelease
      ? ''
      : superseded ? 'SUPERSEDED-UNCONTROLLED-' : 'DRAFT-UNCONTROLLED-',
  };
}

const safeFileToken = (value: string): string => (
  value.trim().replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'untitled'
);

const activePartToken = (document: RtPtDocumentV3): string => {
  const general = document.technique.general;
  return general.partNumber || general.partName || document.documentId;
};

export function getRtPtTechniquePdfFilename(
  document: RtPtDocumentV3,
  callerValidation?: RtPtValidationSummary,
): string {
  void callerValidation;
  const release = getRtPtPdfReleaseState(document);
  const identity = document.documentControl.number || activePartToken(document);
  const revision = document.documentControl.revision
    ? `-REV-${safeFileToken(document.documentControl.revision)}`
    : '';
  return `${release.filenamePrefix}RTPT-${safeFileToken(document.method)}-${safeFileToken(identity)}${revision}.pdf`;
}

type PdfColor = [number, number, number];
type AutoTableOptions = Parameters<typeof autoTable>[1];

const PDF_THEME = {
  navy: [17, 39, 58] as PdfColor,
  navySoft: [31, 58, 78] as PdfColor,
  steel: [43, 91, 118] as PdfColor,
  steelSoft: [92, 126, 145] as PdfColor,
  ink: [27, 43, 54] as PdfColor,
  muted: [91, 105, 114] as PdfColor,
  line: [199, 210, 217] as PdfColor,
  panel: [238, 243, 246] as PdfColor,
  panelAlt: [248, 250, 251] as PdfColor,
  white: [255, 255, 255] as PdfColor,
  amber: [161, 99, 34] as PdfColor,
  amberSoft: [249, 240, 226] as PdfColor,
  green: [48, 105, 88] as PdfColor,
  greenSoft: [229, 241, 236] as PdfColor,
  red: [148, 66, 57] as PdfColor,
  redSoft: [248, 235, 232] as PdfColor,
  watermark: [229, 233, 236] as PdfColor,
};

const PDF_MARGIN = 14;
const PDF_CONTENT_TOP = 31;
const PDF_CONTENT_BOTTOM = 278;
const SETUP_DIAGRAM_MICRO_FONT_SIZE = 6.2;

const getLastTableY = (pdf: jsPDF): number => (
  (pdf as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY
);

const formatIdentity = (
  ...values: Array<string | number | boolean | null | undefined>
): string => {
  const present = values.filter(hasValue).map(String);
  return present.length > 0 ? present.join(' / ') : 'Not specified';
};

const formatDocumentId = (value: string): string => {
  const uuid = /^([^-]+-[^-]+-[^-]+)-([^-]+-[^-]+)$/.exec(value);
  return uuid ? `${uuid[1]}\n${uuid[2]}` : formatValue(value);
};

const methodCode = (document: RtPtDocumentV3): string => {
  if (document.method === 'RT-Film') return 'FILM RT';
  if (document.method === 'RT-Digital') return 'DDA RT';
  if (document.method === 'RT-CR') return 'CR RT';
  return 'PT';
};

const releaseLabel = (document: RtPtDocumentV3, release: RtPtPdfReleaseState): string => {
  if (release.controlledRelease) return 'CONTROLLED RELEASE';
  if (document.status === 'superseded') return 'SUPERSEDED / UNCONTROLLED';
  return 'DRAFT / UNCONTROLLED';
};

const truncateToWidth = (pdf: jsPDF, value: string, width: number): string => {
  if (pdf.getTextWidth(value) <= width) return value;
  let result = value;
  while (result.length > 1 && pdf.getTextWidth(`${result}...`) > width) {
    result = result.slice(0, -1);
  }
  return `${result}...`;
};

const splitWithEllipsis = (
  pdf: jsPDF,
  value: string,
  width: number,
  maximumLines: number,
): string[] => {
  const lines = pdf.splitTextToSize(value, width) as string[];
  if (lines.length <= maximumLines) return lines;
  const visible = lines.slice(0, maximumLines);
  visible[maximumLines - 1] = truncateToWidth(
    pdf,
    lines.slice(maximumLines - 1).join(' '),
    width,
  );
  return visible;
};

const ensureContentSpace = (pdf: jsPDF, y: number, requiredHeight: number): number => {
  if (y + requiredHeight <= PDF_CONTENT_BOTTOM) return y;
  pdf.addPage();
  return PDF_CONTENT_TOP;
};

const pairedTableRows = (rows: PdfRow[]): RowInput[] => {
  const body: RowInput[] = [];
  for (let index = 0; index < rows.length; index += 2) {
    const left = rows[index];
    const right = rows[index + 1];
    body.push(right
      ? [left[0].toUpperCase(), left[1], right[0].toUpperCase(), right[1]]
      : [left[0].toUpperCase(), left[1], { content: '', colSpan: 2 }]);
  }
  return body;
};

const renderPairedSection = (
  pdf: jsPDF,
  sectionNumber: number,
  title: string,
  rows: PdfRow[],
  startY: number,
): number => {
  const y = ensureContentSpace(pdf, startY, 24);
  autoTable(pdf, {
    startY: y,
    head: [[{ content: `${String(sectionNumber).padStart(2, '0')}  ${title.toUpperCase()}`, colSpan: 4 }]],
    body: pairedTableRows(rows),
    margin: { left: PDF_MARGIN, right: PDF_MARGIN, top: PDF_CONTENT_TOP, bottom: 20 },
    theme: 'grid',
    showHead: 'everyPage',
    rowPageBreak: 'avoid',
    styles: {
      font: 'helvetica',
      fontSize: 8.2,
      textColor: PDF_THEME.ink,
      lineColor: PDF_THEME.line,
      lineWidth: 0.18,
      cellPadding: { top: 2.2, right: 2.2, bottom: 2.2, left: 2.2 },
      overflow: 'linebreak',
      valign: 'middle',
    },
    headStyles: {
      fillColor: PDF_THEME.steel,
      textColor: PDF_THEME.white,
      fontStyle: 'bold',
      fontSize: 9,
      cellPadding: { top: 2.2, right: 2.5, bottom: 2.2, left: 2.5 },
    },
    columnStyles: {
      0: { cellWidth: 33, fillColor: PDF_THEME.panel, textColor: PDF_THEME.muted, fontStyle: 'bold', fontSize: 6.8 },
      1: { cellWidth: 58 },
      2: { cellWidth: 33, fillColor: PDF_THEME.panel, textColor: PDF_THEME.muted, fontStyle: 'bold', fontSize: 6.8 },
      3: { cellWidth: 58 },
    },
  });
  return getLastTableY(pdf) + 6;
};

const renderDataTableSection = (
  pdf: jsPDF,
  sectionNumber: number,
  title: string,
  columns: RowInput,
  rows: RowInput[],
  startY: number,
  columnStyles?: AutoTableOptions['columnStyles'],
): number => {
  let y = ensureContentSpace(pdf, startY, 20);
  pdf.setFillColor(...PDF_THEME.steel);
  pdf.roundedRect(PDF_MARGIN, y, pdf.internal.pageSize.getWidth() - PDF_MARGIN * 2, 8, 1.2, 1.2, 'F');
  pdf.setTextColor(...PDF_THEME.white);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(9);
  pdf.text(`${String(sectionNumber).padStart(2, '0')}  ${title.toUpperCase()}`, PDF_MARGIN + 3, y + 5.3);
  y += 9.5;
  autoTable(pdf, {
    startY: y,
    head: [columns],
    body: rows,
    margin: { left: PDF_MARGIN, right: PDF_MARGIN, top: PDF_CONTENT_TOP, bottom: 20 },
    theme: 'grid',
    showHead: 'everyPage',
    rowPageBreak: 'avoid',
    styles: {
      font: 'helvetica',
      fontSize: 7.7,
      textColor: PDF_THEME.ink,
      lineColor: PDF_THEME.line,
      lineWidth: 0.18,
      cellPadding: { top: 2, right: 1.7, bottom: 2, left: 1.7 },
      overflow: 'linebreak',
      valign: 'top',
    },
    headStyles: {
      fillColor: PDF_THEME.panel,
      textColor: PDF_THEME.ink,
      fontStyle: 'bold',
      fontSize: 7,
      valign: 'middle',
    },
    alternateRowStyles: { fillColor: PDF_THEME.panelAlt },
    columnStyles,
  });
  return getLastTableY(pdf) + 6;
};

const renderCoverGrid = (pdf: jsPDF, rows: PdfRow[], startY: number): number => {
  autoTable(pdf, {
    startY,
    body: pairedTableRows(rows),
    margin: { left: PDF_MARGIN, right: PDF_MARGIN },
    theme: 'grid',
    pageBreak: 'avoid',
    rowPageBreak: 'avoid',
    styles: {
      font: 'helvetica',
      fontSize: 7.8,
      textColor: PDF_THEME.ink,
      lineColor: PDF_THEME.line,
      lineWidth: 0.18,
      cellPadding: { top: 1.7, right: 2, bottom: 1.7, left: 2 },
      overflow: 'ellipsize',
      valign: 'middle',
    },
    columnStyles: {
      0: { cellWidth: 32, fillColor: PDF_THEME.panel, textColor: PDF_THEME.muted, fontStyle: 'bold', fontSize: 6.4 },
      1: { cellWidth: 59 },
      2: { cellWidth: 32, fillColor: PDF_THEME.panel, textColor: PDF_THEME.muted, fontStyle: 'bold', fontSize: 6.4 },
      3: { cellWidth: 59 },
    },
  });
  return getLastTableY(pdf);
};

const renderCoverHeading = (pdf: jsPDF, label: string, y: number): void => {
  pdf.setDrawColor(...PDF_THEME.steelSoft);
  pdf.setLineWidth(0.7);
  pdf.line(PDF_MARGIN, y + 1.8, PDF_MARGIN + 5, y + 1.8);
  pdf.setTextColor(...PDF_THEME.steel);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(7.2);
  pdf.text(label.toUpperCase(), PDF_MARGIN + 8, y + 2.7);
};

const renderReadinessCards = (
  pdf: jsPDF,
  validation: RtPtValidationSummary,
  release: RtPtPdfReleaseState,
  y: number,
): number => {
  const pageWidth = pdf.internal.pageSize.getWidth();
  const gap = 3;
  const width = (pageWidth - PDF_MARGIN * 2 - gap * 2) / 3;
  const cards = [
    {
      label: 'TECHNIQUE COMPLETENESS',
      value: `${validation.draftCompleteness.completionPercent}%`,
      detail: `${validation.draftCompleteness.completedFieldsCount} of ${validation.draftCompleteness.totalRequiredFields} required fields`,
      color: PDF_THEME.steel,
      fill: PDF_THEME.panel,
    },
    {
      label: 'APPROVAL READINESS',
      value: validation.approvalReadiness.isReady ? 'READY' : 'NOT READY',
      detail: `${validation.approvalReadiness.completedRequirements} of ${validation.approvalReadiness.totalRequirements} controls satisfied`,
      color: validation.approvalReadiness.isReady ? PDF_THEME.green : PDF_THEME.amber,
      fill: validation.approvalReadiness.isReady ? PDF_THEME.greenSoft : PDF_THEME.amberSoft,
    },
    {
      label: 'DOCUMENT RELEASE',
      value: release.controlledRelease ? 'CONTROLLED' : 'UNCONTROLLED',
      detail: release.controlledRelease
        ? 'Approved controlled issue'
        : release.watermark === 'SUPERSEDED - UNCONTROLLED'
          ? 'Historical copy - not current'
          : 'Working copy - review required',
      color: release.controlledRelease
        ? PDF_THEME.green
        : release.watermark === 'SUPERSEDED - UNCONTROLLED' ? PDF_THEME.red : PDF_THEME.amber,
      fill: release.controlledRelease
        ? PDF_THEME.greenSoft
        : release.watermark === 'SUPERSEDED - UNCONTROLLED' ? PDF_THEME.redSoft : PDF_THEME.amberSoft,
    },
  ];

  cards.forEach((card, index) => {
    const x = PDF_MARGIN + index * (width + gap);
    pdf.setFillColor(...card.fill);
    pdf.roundedRect(x, y, width, 21, 1.5, 1.5, 'F');
    pdf.setFillColor(...card.color);
    pdf.roundedRect(x, y, 1.8, 21, 1, 1, 'F');
    pdf.setTextColor(...PDF_THEME.muted);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(6.2);
    pdf.text(card.label, x + 5, y + 5.2);
    pdf.setTextColor(...card.color);
    pdf.setFontSize(11.5);
    pdf.text(card.value, x + 5, y + 11.5);
    pdf.setTextColor(...PDF_THEME.muted);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(6.2);
    pdf.text(pdf.splitTextToSize(card.detail, width - 8).slice(0, 2), x + 5, y + 16.2);
  });
  return y + 21;
};

const renderCover = (
  pdf: jsPDF,
  document: RtPtDocumentV3,
  validation: RtPtValidationSummary,
  release: RtPtPdfReleaseState,
): void => {
  const pageWidth = pdf.internal.pageSize.getWidth();
  const general = document.technique.general;
  const title = document.documentControl.title || `${METHOD_TITLE[document.method]} Technique`;
  const status = releaseLabel(document, release);

  pdf.setFillColor(...PDF_THEME.navy);
  pdf.rect(0, 0, pageWidth, 27, 'F');
  pdf.setFillColor(...PDF_THEME.steel);
  pdf.rect(0, 27, pageWidth, 1.6, 'F');
  pdf.setTextColor(...PDF_THEME.white);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(14);
  pdf.text('RT-PT', PDF_MARGIN, 11.5);
  pdf.setFontSize(7);
  pdf.setFont('helvetica', 'normal');
  pdf.text('INSPECTOR / CONTROLLED NDT WORKFLOW', PDF_MARGIN, 18);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(10.5);
  pdf.text(methodCode(document), pageWidth - PDF_MARGIN, 12, { align: 'right' });
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(7);
  pdf.text(METHOD_TITLE[document.method], pageWidth - PDF_MARGIN, 18, { align: 'right' });

  pdf.setTextColor(...PDF_THEME.steel);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(7.2);
  pdf.text('NDT TECHNIQUE SHEET', PDF_MARGIN, 37);
  pdf.setTextColor(...PDF_THEME.ink);
  pdf.setFontSize(16.5);
  const titleLines = splitWithEllipsis(pdf, title, 132, 2);
  pdf.text(titleLines, PDF_MARGIN, 45);

  const badgeColor = release.controlledRelease
    ? PDF_THEME.green
    : release.watermark === 'SUPERSEDED - UNCONTROLLED' ? PDF_THEME.red : PDF_THEME.amber;
  const badgeFill = release.controlledRelease
    ? PDF_THEME.greenSoft
    : release.watermark === 'SUPERSEDED - UNCONTROLLED' ? PDF_THEME.redSoft : PDF_THEME.amberSoft;
  pdf.setFillColor(...badgeFill);
  pdf.roundedRect(pageWidth - PDF_MARGIN - 48, 36.5, 48, 12, 1.8, 1.8, 'F');
  pdf.setTextColor(...badgeColor);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(6.8);
  pdf.text(status, pageWidth - PDF_MARGIN - 24, 43.8, { align: 'center' });

  const titleBottom = 45 + titleLines.length * 6.5;
  pdf.setTextColor(...PDF_THEME.muted);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(7.2);
  pdf.text(
    `${RT_PT_METHOD_LABEL[document.method]} / ${document.status.toUpperCase()}`,
    PDF_MARGIN,
    titleBottom + 3,
  );

  let y = Math.max(titleBottom + 10, 64);
  renderCoverHeading(pdf, 'Document control and effectivity', y);
  y = renderCoverGrid(pdf, [
    ['Document Number', formatValue(document.documentControl.number)],
    ['Revision', formatValue(document.documentControl.revision)],
    ['Revision Date', formatValue(document.documentControl.revisionDate)],
    ['Effective Date', formatValue(document.documentControl.effectiveDate)],
    ['Organization', formatValue(document.organization.name)],
    ['Site', formatValue(document.organization.site)],
    ['Customer', formatValue(document.job.customer)],
    ['Work Order', formatValue(document.job.workOrder)],
    ['Contract', formatValue(document.job.contract)],
    ['Purchase Order', formatValue(document.job.purchaseOrder)],
    ['Change Summary', formatValue(document.documentControl.changeSummary)],
    ['Unit System', formatValue(document.unitSystem)],
  ], y + 6);

  y += 7;
  renderCoverHeading(pdf, 'Part applicability and technique basis', y);
  y = renderCoverGrid(pdf, [
    ['Part Number', formatValue(general.partNumber)],
    ['Part Name', formatValue(general.partName)],
    ['Revision / Configuration', formatValue(general.partRevisionOrConfiguration)],
    ['Material', formatValue(general.material)],
    ['Nominal Thickness', formatValue(general.thickness, general.thicknessUnit)],
    ['Inspection Area', formatValue(general.inspectionArea)],
    ['Drawing Reference', formatValue(general.drawingReference)],
    ['Procedure', formatValue(general.procedureNumber)],
  ], y + 6);

  y += 7;
  renderCoverHeading(pdf, 'Release readiness', y);
  y = renderReadinessCards(pdf, validation, release, y + 6);

  y += 7;
  renderCoverHeading(pdf, 'Controlled references preview', y);
  const referenceRows: RowInput[] = document.controlledReferences.length > 0
    ? document.controlledReferences.slice(0, 1).map((reference) => [
      formatValue(reference.type),
      formatIdentity(reference.number, reference.title),
      formatValue(reference.revision),
      formatValue(reference.clauseOrNote),
    ])
    : [[{ content: 'No controlled references entered.', colSpan: 4 }]];
  if (document.controlledReferences.length > 1) {
    referenceRows.push([{
      content: `+${document.controlledReferences.length - 1} additional controlled reference(s) - see document governance.`,
      colSpan: 4,
    }]);
  }
  autoTable(pdf, {
    startY: y + 6,
    head: [['TYPE', 'DOCUMENT / TITLE', 'REVISION', 'CLAUSE / NOTE']],
    body: referenceRows,
    margin: { left: PDF_MARGIN, right: PDF_MARGIN },
    theme: 'grid',
    pageBreak: 'avoid',
    rowPageBreak: 'avoid',
    styles: {
      font: 'helvetica',
      fontSize: 7.1,
      textColor: PDF_THEME.ink,
      lineColor: PDF_THEME.line,
      lineWidth: 0.18,
      cellPadding: { top: 1.6, right: 1.8, bottom: 1.6, left: 1.8 },
      overflow: 'ellipsize',
      valign: 'middle',
    },
    headStyles: { fillColor: PDF_THEME.navySoft, textColor: PDF_THEME.white, fontStyle: 'bold', fontSize: 6.4 },
    columnStyles: {
      0: { cellWidth: 31 },
      1: { cellWidth: 72 },
      2: { cellWidth: 24 },
      3: { cellWidth: 55 },
    },
  });

  y = getLastTableY(pdf) + 6;
  pdf.setFillColor(...PDF_THEME.panel);
  pdf.roundedRect(PDF_MARGIN, y, pageWidth - PDF_MARGIN * 2, 20, 1.5, 1.5, 'F');
  pdf.setFillColor(...PDF_THEME.steel);
  pdf.roundedRect(PDF_MARGIN, y, 2, 20, 1, 1, 'F');
  pdf.setTextColor(...PDF_THEME.steel);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(6.5);
  pdf.text('CONTROLLED USE', PDF_MARGIN + 6, y + 5.2);
  pdf.setTextColor(...PDF_THEME.ink);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(7.1);
  pdf.text(
    pdf.splitTextToSize(
      'This sheet defines planned and required technique values only. Record performed inspection results, indications, and disposition in the applicable inspection report. Verify the revision and controlled references before use.',
      pageWidth - PDF_MARGIN * 2 - 12,
    ).slice(0, 3),
    PDF_MARGIN + 6,
    y + 10.2,
  );

  y = Math.max(y + 27, 225);
  renderCoverHeading(pdf, 'Approval record preview', y);
  const approvalRows: RowInput[] = document.approvals.length > 0
    ? document.approvals.slice(0, 1).map((approval) => [
      APPROVAL_ROLE_LABEL[approval.role],
      formatIdentity(approval.name, approval.personnelId),
      formatIdentity(approval.certificationBasis, approval.certificationRevision),
      formatValue(approval.date),
    ])
    : [[{ content: 'No approval records entered.', colSpan: 4 }]];
  if (document.approvals.length > 1) {
    approvalRows.push([{
      content: `+${document.approvals.length - 1} additional approval record(s) - see document governance.`,
      colSpan: 4,
    }]);
  }
  autoTable(pdf, {
    startY: y + 6,
    head: [['ROLE', 'NAME / PERSONNEL ID', 'CERTIFICATION BASIS / REVISION', 'DATE']],
    body: approvalRows,
    margin: { left: PDF_MARGIN, right: PDF_MARGIN },
    theme: 'grid',
    pageBreak: 'avoid',
    rowPageBreak: 'avoid',
    styles: {
      font: 'helvetica',
      fontSize: 7.2,
      textColor: PDF_THEME.ink,
      lineColor: PDF_THEME.line,
      lineWidth: 0.18,
      cellPadding: { top: 1.7, right: 1.8, bottom: 1.7, left: 1.8 },
      overflow: 'ellipsize',
      valign: 'middle',
    },
    headStyles: { fillColor: PDF_THEME.navySoft, textColor: PDF_THEME.white, fontStyle: 'bold', fontSize: 6.5 },
    columnStyles: {
      0: { cellWidth: 31 },
      1: { cellWidth: 50 },
      2: { cellWidth: 72 },
      3: { cellWidth: 29 },
    },
  });
};

const techniqueOverviewRows = (document: RtPtDocumentV3): PdfRow[] => {
  if (document.method === 'RT-Film') {
    const { source, filmSystem, iqi, exposureViews } = document.technique;
    let sourceDetail = formatIdentity(source.manufacturer, source.model);
    if (source.sourceType === 'X-ray') {
      sourceDetail = formatIdentity(
        source.manufacturer,
        source.model,
        `${formatValue(source.xRay.focalSpotSize, source.xRay.focalSpotSizeUnit)} focal spot`,
      );
    } else if (source.sourceType === 'Gamma') {
      sourceDetail = formatIdentity(source.manufacturer, source.model, source.gamma.isotope, source.gamma.sourceId);
    }
    return [
      ['Method', RT_PT_METHOD_LABEL[document.method]],
      ['Exposure Views', String(exposureViews.length)],
      ['Radiation Source', formatIdentity(source.sourceType, sourceDetail)],
      ['Film System', formatIdentity(filmSystem.manufacturer, filmSystem.filmDesignation, filmSystem.filmClass)],
      ['Required Density', formatRange(filmSystem.requiredDensityMin, filmSystem.requiredDensityMax, 'H&D')],
      ['IQI Plan', formatIdentity(iqi.type, iqi.designation, iqi.placement)],
      ['Required Image Quality', formatIdentity(iqi.requiredSensitivity, iqi.imageQualityLevel)],
      ['Required Inspector Level', formatValue(document.technique.general.inspectorLevel)],
    ];
  }
  if (document.method === 'RT-Digital') {
    const { source, system, detectorPerformance, iqi, acquisitions } = document.technique;
    return [
      ['Method', RT_PT_METHOD_LABEL[document.method]],
      ['Static Acquisitions', String(acquisitions.length)],
      ['X-ray Source', formatIdentity(source.manufacturer, source.model, source.serialNumber)],
      ['Detector', formatIdentity(system.manufacturer, system.model, system.serialNumber)],
      ['Detector Matrix', formatIdentity(`${formatValue(system.matrixColumns)} x ${formatValue(system.matrixRows)}`, `${formatValue(system.pixelSize, system.pixelSizeUnit)} pixel`)],
      ['Detector / Image SRb', formatIdentity(formatValue(detectorPerformance.detectorSrb, detectorPerformance.detectorSrbUnit), formatValue(detectorPerformance.imageSrb, detectorPerformance.imageSrbUnit))],
      ['IQI Plan', formatIdentity(iqi.type, iqi.designation, iqi.placement)],
      ['Workflow', formatValue(document.technique.workflow)],
    ];
  }
  if (document.method === 'RT-CR') {
    const { source, plateSystem, scanner, imageQuality, iqi, exposureViews } = document.technique;
    let sourceDetail = formatIdentity(source.manufacturer, source.model);
    if (source.sourceType === 'X-ray') {
      sourceDetail = formatIdentity(
        source.manufacturer,
        source.model,
        `${formatValue(source.xRay.focalSpotSize, source.xRay.focalSpotSizeUnit)} focal spot`,
      );
    } else if (source.sourceType === 'Gamma') {
      sourceDetail = formatIdentity(source.manufacturer, source.model, source.gamma.isotope, source.gamma.sourceId);
    }
    return [
      ['Method', RT_PT_METHOD_LABEL[document.method]],
      ['Exposure Views', String(exposureViews.length)],
      ['Radiation Source', formatIdentity(source.sourceType, sourceDetail)],
      ['Imaging Plate', formatIdentity(plateSystem.manufacturer, plateSystem.plateDesignation, plateSystem.plateClass)],
      ['CR Scanner', formatIdentity(scanner.manufacturer, scanner.model, formatValue(scanner.scanResolutionPixelsPerMm, 'px/mm'))],
      ['Required Grey-Value Window', formatRange(imageQuality.greyValueMin, imageQuality.greyValueMax, '')],
      ['Required SRb / SNR', formatIdentity(formatValue(imageQuality.requiredSrb, imageQuality.requiredSrbUnit), formatValue(imageQuality.requiredSnrMin))],
      ['IQI Plan', formatIdentity(iqi.type, iqi.designation, iqi.placement)],
    ];
  }
  const { materials, application, development, conditions } = document.technique;
  let viewing = 'Not specified';
  if (materials.penetrantType === 'Type I') {
    viewing = `${formatValue(conditions.requiredUvAMin, conditions.uvAUnit)} minimum UV-A`;
  } else if (materials.penetrantType === 'Type II') {
    viewing = `${formatValue(conditions.whiteLightMin, conditions.visibleLightUnit)} minimum white light`;
  }
  return [
    ['Method', RT_PT_METHOD_LABEL[document.method]],
    ['Penetrant Classification', formatIdentity(materials.penetrantType, `Method ${formatValue(materials.method)}`)],
    ['Sensitivity / Developer', formatIdentity(materials.sensitivityLevel, materials.developerForm)],
    ['Qualified System', formatIdentity(materials.systemFamily, materials.qualificationReference)],
    ['Penetrant Product', formatIdentity(materials.penetrant.manufacturer, materials.penetrant.designation)],
    ['Planned Dwell', formatValue(application.dwellTime, application.dwellTimeUnit)],
    ['Planned Development', formatValue(development.developmentTime, development.developmentTimeUnit)],
    ['Viewing Requirement', viewing],
  ];
};

const filmExposureSchedule = (
  document: Extract<RtPtDocumentV3, { method: 'RT-Film' }>,
): RowInput[] => document.technique.exposureViews.map((view, index) => {
  const source = document.technique.source;
  let exposure = 'Not specified';
  if (source.sourceType === 'X-ray') {
    exposure = `${formatValue(view.tubeVoltage, view.tubeVoltageUnit)} / ${formatValue(view.tubeCurrent, view.tubeCurrentUnit)}\n${formatValue(view.exposureTime, view.exposureTimeUnit)}`;
  } else if (source.sourceType === 'Gamma') {
    exposure = `${formatValue(source.gamma.isotope)}\n${formatValue(view.exposureTime, view.exposureTimeUnit)}`;
  }
  return [
    formatValue(view.viewId || index + 1),
    formatIdentity(view.inspectionZone, view.orientation),
    formatValue(view.wallTechnique),
    formatRange(view.thicknessMin, view.thicknessMax, view.thicknessUnit),
    `SFD ${formatValue(view.sfd, view.sfdUnit)}\nSOD ${formatValue(view.sod, view.sodUnit)}\nOFD ${formatValue(view.ofd, view.ofdUnit)}`,
    exposure,
    formatIdentity(view.iqiOverride, view.referenceAttachmentId),
  ];
});

const crExposureSchedule = (
  document: Extract<RtPtDocumentV3, { method: 'RT-CR' }>,
): RowInput[] => document.technique.exposureViews.map((view, index) => {
  const source = document.technique.source;
  let exposure = 'Not specified';
  if (source.sourceType === 'X-ray') {
    exposure = `${formatValue(view.tubeVoltage, view.tubeVoltageUnit)} / ${formatValue(view.tubeCurrent, view.tubeCurrentUnit)}\n${formatValue(view.exposureTime, view.exposureTimeUnit)}`;
  } else if (source.sourceType === 'Gamma') {
    exposure = `${formatValue(source.gamma.isotope)}\n${formatValue(view.exposureTime, view.exposureTimeUnit)}`;
  }
  return [
    formatValue(view.viewId || index + 1),
    formatIdentity(view.inspectionZone, view.orientation),
    formatValue(view.wallTechnique),
    formatRange(view.thicknessMin, view.thicknessMax, view.thicknessUnit),
    `SFD ${formatValue(view.sfd, view.sfdUnit)}\nSOD ${formatValue(view.sod, view.sodUnit)}\nOFD ${formatValue(view.ofd, view.ofdUnit)}`,
    exposure,
    `${formatValue(view.plateSize)}\n${formatIdentity(view.iqiOverride, view.referenceAttachmentId)}`,
  ];
});

const digitalAcquisitionSchedule = (
  document: Extract<RtPtDocumentV3, { method: 'RT-Digital' }>,
): RowInput[] => document.technique.acquisitions.map((acquisition, index) => [
  formatValue(acquisition.viewId || index + 1),
  formatIdentity(acquisition.inspectionZone, acquisition.orientation),
  formatValue(acquisition.wallTechnique),
  formatRange(acquisition.thicknessMin, acquisition.thicknessMax, acquisition.thicknessUnit),
  `SDD ${formatValue(acquisition.sdd, acquisition.sddUnit)}\nSOD ${formatValue(acquisition.sod, acquisition.sodUnit)}\nODD ${formatValue(acquisition.odd, acquisition.oddUnit)}`,
  `${formatValue(acquisition.tubeVoltage, acquisition.tubeVoltageUnit)} / ${formatValue(acquisition.tubeCurrent, acquisition.tubeCurrentUnit)}\n${formatValue(acquisition.exposureTime, acquisition.exposureTimeUnit)}`,
  `${formatValue(acquisition.integrationTime, acquisition.integrationTimeUnit)} x ${formatValue(acquisition.framesAveraged)}\n${formatIdentity(acquisition.iqiOverride, acquisition.referenceAttachmentId)}`,
]);

const ptRemovalSummary = (document: Extract<RtPtDocumentV3, { method: 'PT' }>): string => {
  const { materials, removal } = document.technique;
  if (materials.method === 'A') {
    return formatIdentity(
      removal.methodA.instructions,
      `${formatRange(removal.methodA.pressureMin, removal.methodA.pressureMax, removal.methodA.pressureUnit)} rinse pressure`,
      `${formatRange(removal.methodA.temperatureMin, removal.methodA.temperatureMax, removal.methodA.temperatureUnit)} rinse temperature`,
    );
  }
  if (materials.method === 'B' || materials.method === 'D') {
    return formatIdentity(
      `${formatValue(removal.methodBD.type)} emulsifier`,
      materials.method === 'D'
        ? `${formatValue(removal.methodBD.concentration, removal.methodBD.concentrationUnit)} concentration`
        : '',
      `${formatValue(removal.methodBD.contactTime, removal.methodBD.contactTimeUnit)} contact`,
      `${formatValue(removal.methodBD.applicationMethod)} application`,
      materials.method === 'D' ? removal.methodD.preRinseInstructions : '',
      removal.methodBD.postEmulsifierRinseInstructions,
      materials.method === 'D' ? removal.methodD.finalRinseInstructions : '',
    );
  }
  if (materials.method === 'C') return formatValue(removal.methodC.removerInstructions);
  return 'Not specified';
};

const ptProcessSchedule = (
  document: Extract<RtPtDocumentV3, { method: 'PT' }>,
): RowInput[] => {
  const { materials, surfacePrep, application, development, conditions, postCleaning } = document.technique;
  let viewing = 'Not specified';
  if (materials.penetrantType === 'Type I') {
    viewing = formatIdentity(
      `${formatValue(conditions.requiredUvAMin, conditions.uvAUnit)} minimum UV-A`,
      `${formatValue(conditions.ambientVisibleLightMax, conditions.visibleLightUnit)} maximum ambient light`,
      `${formatValue(conditions.darkAdaptationTime, conditions.darkAdaptationTimeUnit)} dark adaptation`,
    );
  } else if (materials.penetrantType === 'Type II') {
    viewing = `${formatValue(conditions.whiteLightMin, conditions.visibleLightUnit)} minimum white light`;
  }
  return [
    ['01', 'SURFACE PREPARATION', formatIdentity(surfacePrep.cleaningMethod, surfacePrep.cleaningDetails, surfacePrep.surfaceCondition)],
    ['02', 'DRYING / CONDITION', formatIdentity(surfacePrep.dryingMethod, formatValue(surfacePrep.dryingTime, surfacePrep.dryingTimeUnit), formatValue(surfacePrep.dryingTemperature, surfacePrep.dryingTemperatureUnit))],
    ['03', 'PENETRANT APPLICATION', formatIdentity(application.applicationMethod, `${formatValue(application.dwellTime, application.dwellTimeUnit)} dwell`, formatRange(application.partTemperatureMin, application.partTemperatureMax, application.partTemperatureUnit))],
    ['04', `METHOD ${formatValue(materials.method)} REMOVAL`, ptRemovalSummary(document)],
    ['05', 'DEVELOPMENT', formatIdentity(materials.developerForm, development.developerApplication, `${formatValue(development.developmentTime, development.developmentTimeUnit)} development`, development.instructions)],
    ['06', 'EXAMINATION', formatIdentity(viewing, conditions.equipmentRequirements)],
    ['07', 'POST-CLEAN / PROTECTION', formatIdentity(postCleaning.instructions, postCleaning.corrosionProtection)],
  ];
};

const filmExposureChart = (
  document: Extract<RtPtDocumentV3, { method: 'RT-Film' }>,
): { rows: RowInput[]; hasMachineColumns: boolean; notice: string | null } => {
  const { exposureDefaults, source, ps811000Applicable } = document.technique;
  if (!ps811000Applicable) return { rows: [], hasMachineColumns: false, notice: null };

  const chart = buildPs811000ExposureChart({
    curve: exposureDefaults.ps811000EnergyCurve,
    thicknessFrom: exposureDefaults.thicknessMin,
    thicknessTo: exposureDefaults.thicknessMax,
    thicknessUnit: exposureDefaults.thicknessUnit,
    equivalenceMaterial: exposureDefaults.ps811000EquivalenceMaterial,
    equivalenceVoltageKv: exposureDefaults.tubeVoltage,
    anchors: source.exposureChartAnchors ?? [],
    machineVoltageKv: exposureDefaults.tubeVoltage,
    targetSfd: exposureDefaults.sfd,
    targetSfdUnit: exposureDefaults.sfdUnit,
    plannedCurrentMa: exposureDefaults.tubeCurrent,
    exposureTimeUnit: exposureDefaults.exposureTimeUnit || 's',
  });
  const hasMachineColumns = chart.fit !== null;
  const timeUnit = exposureDefaults.exposureTimeUnit === 'min' ? 'min' : 's';

  const rows = chart.rows.map((row): RowInput => {
    const screen = row.leadScreens[0];
    const base = [
      formatValue(row.thickness, exposureDefaults.thicknessUnit),
      row.equivalentThickness === null
        ? '-'
        : `${row.equivalentThickness} (x${row.equivalenceFactor})`,
      row.approximateKvp === null
        ? '-'
        : `${row.approximateKvp}\n${row.lowerKvp}-${row.upperKvp}`,
      row.ugLimit === null
        ? '-'
        : formatValue(
          exposureDefaults.requiredUgUnit === 'inch' ? row.ugLimit.maximumInch : row.ugLimit.maximumMm,
          exposureDefaults.requiredUgUnit,
        ),
      screen ? `F ${screen.frontMaximumInch}\nB ${screen.backMinimumInch} in` : '-',
    ];
    if (!hasMachineColumns) return base;
    return [
      ...base,
      row.mas === null ? '-' : `${row.mas}${row.masExtrapolated ? ' *' : ''}`,
      row.currentMa === null ? '-' : String(row.currentMa),
      row.exposureTime === null ? '-' : `${row.exposureTime} ${timeUnit}`,
    ];
  });

  return { rows, hasMachineColumns, notice: chart.machineChartNotice };
};

const renderFilmExposureChart = (
  pdf: jsPDF,
  document: Extract<RtPtDocumentV3, { method: 'RT-Film' }>,
  sectionNumber: number,
  startY: number,
): { y: number; rendered: boolean } => {
  const { rows, hasMachineColumns } = filmExposureChart(document);
  if (rows.length === 0) return { y: startY, rendered: false };

  const columns = ['THICKNESS', 'EQUIV. (TBL 1)', 'kVp / BAND', 'MAX Ug (TBL 8)', 'SCREENS (TBL 2)'];
  const columnStyles: Record<number, { cellWidth: number }> = hasMachineColumns
    ? { 0: { cellWidth: 24 }, 1: { cellWidth: 27 }, 2: { cellWidth: 24 }, 3: { cellWidth: 24 }, 4: { cellWidth: 25 }, 5: { cellWidth: 24 }, 6: { cellWidth: 16 }, 7: { cellWidth: 18 } }
    : { 0: { cellWidth: 36 }, 1: { cellWidth: 40 }, 2: { cellWidth: 36 }, 3: { cellWidth: 36 }, 4: { cellWidth: 34 } };

  return {
    y: renderDataTableSection(
      pdf,
      sectionNumber,
      hasMachineColumns
        ? 'PS811000E exposure chart (mA derived from this machine, not from the specification)'
        : 'PS811000E exposure chart (kV per Figure 2; the specification supplies no mA)',
      hasMachineColumns ? [...columns, 'mAs', 'mA', 'TIME'] : columns,
      rows,
      startY,
      columnStyles,
    ),
    rendered: true,
  };
};

const renderTechniqueSchedule = (
  pdf: jsPDF,
  document: RtPtDocumentV3,
  sectionNumber: number,
  startY: number,
): number => {
  if (document.method === 'RT-Film') {
    return renderDataTableSection(
      pdf,
      sectionNumber,
      'Exposure plan overview',
      ['VIEW', 'ZONE / ORIENTATION', 'WALL', 'THICKNESS', 'GEOMETRY', 'PLANNED EXPOSURE', 'IQI / SETUP REF'],
      filmExposureSchedule(document),
      startY,
      {
        0: { cellWidth: 13, fontStyle: 'bold', halign: 'center' },
        1: { cellWidth: 29 },
        2: { cellWidth: 16 },
        3: { cellWidth: 26 },
        4: { cellWidth: 30 },
        5: { cellWidth: 28 },
        6: { cellWidth: 40 },
      },
    );
  }
  if (document.method === 'RT-CR') {
    return renderDataTableSection(
      pdf,
      sectionNumber,
      'CR exposure plan overview',
      ['VIEW', 'ZONE / ORIENTATION', 'WALL', 'THICKNESS', 'GEOMETRY', 'PLANNED EXPOSURE', 'PLATE / IQI REF'],
      crExposureSchedule(document),
      startY,
      {
        0: { cellWidth: 13, fontStyle: 'bold', halign: 'center' },
        1: { cellWidth: 29 },
        2: { cellWidth: 16 },
        3: { cellWidth: 26 },
        4: { cellWidth: 30 },
        5: { cellWidth: 28 },
        6: { cellWidth: 40 },
      },
    );
  }
  if (document.method === 'RT-Digital') {
    return renderDataTableSection(
      pdf,
      sectionNumber,
      'Static acquisition plan overview',
      ['VIEW', 'ZONE / ORIENTATION', 'WALL', 'THICKNESS', 'GEOMETRY', 'PLANNED EXPOSURE', 'CAPTURE / IQI REF'],
      digitalAcquisitionSchedule(document),
      startY,
      {
        0: { cellWidth: 13, fontStyle: 'bold', halign: 'center' },
        1: { cellWidth: 29 },
        2: { cellWidth: 16 },
        3: { cellWidth: 26 },
        4: { cellWidth: 30 },
        5: { cellWidth: 28 },
        6: { cellWidth: 40 },
      },
    );
  }
  return renderDataTableSection(
    pdf,
    sectionNumber,
    'Planned penetrant process sequence',
    ['STEP', 'CONTROL POINT', 'PLANNED / REQUIRED INSTRUCTION'],
    ptProcessSchedule(document),
    startY,
    {
      0: { cellWidth: 15, fontStyle: 'bold', halign: 'center', textColor: PDF_THEME.steel },
      1: { cellWidth: 45, fontStyle: 'bold' },
      2: { cellWidth: 122 },
    },
  );
};

const drawDimensionLine = (
  pdf: jsPDF,
  x1: number,
  x2: number,
  y: number,
  label: string,
  emphasized = false,
): void => {
  pdf.setDrawColor(...(emphasized ? PDF_THEME.steel : PDF_THEME.muted));
  pdf.setLineWidth(emphasized ? 0.55 : 0.35);
  pdf.line(x1, y, x2, y);
  pdf.line(x1, y - 1.8, x1, y + 1.8);
  pdf.line(x2, y - 1.8, x2, y + 1.8);
  pdf.setFillColor(...PDF_THEME.white);
  const labelWidth = Math.min(52, Math.max(24, pdf.getTextWidth(label) + 6));
  const center = (x1 + x2) / 2;
  pdf.roundedRect(center - labelWidth / 2, y - 3.1, labelWidth, 6.2, 1, 1, 'F');
  pdf.setTextColor(...(emphasized ? PDF_THEME.steel : PDF_THEME.muted));
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(6.3);
  pdf.text(truncateToWidth(pdf, label, labelWidth - 3), center, y + 1.25, { align: 'center' });
};

const drawSetupDiagram = (
  pdf: jsPDF,
  input: RtSetupDiagramInput,
  startY: number,
): number => {
  const setup = normalizeRtSetupDiagram(input);
  const x = PDF_MARGIN;
  const width = pdf.internal.pageSize.getWidth() - PDF_MARGIN * 2;
  const height = 94;
  const centerY = startY + 38;
  const sourceX = x + 16;
  const partX = x + 88;
  const receptorX = x + 164;

  pdf.setFillColor(...PDF_THEME.panelAlt);
  pdf.setDrawColor(...PDF_THEME.line);
  pdf.setLineWidth(0.35);
  pdf.roundedRect(x, startY, width, height, 1.8, 1.8, 'FD');

  pdf.setFillColor(...PDF_THEME.steel);
  pdf.roundedRect(x + 4, startY + 4, 50, 7, 3.2, 3.2, 'F');
  pdf.setTextColor(...PDF_THEME.white);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(6.7);
  pdf.text(
    setup.mode === 'film'
      ? 'FILM EXPOSURE SETUP'
      : setup.mode === 'cr'
        ? 'CR EXPOSURE SETUP'
        : 'DDA ACQUISITION SETUP',
    x + 29,
    startY + 8.7,
    { align: 'center' },
  );
  pdf.setTextColor(...PDF_THEME.muted);
  pdf.setFontSize(6.1);
  pdf.text('SCHEMATIC / NOT TO SCALE', x + width - 4, startY + 8.6, { align: 'right' });

  pdf.setFillColor(...PDF_THEME.panel);
  pdf.setDrawColor(...PDF_THEME.steelSoft);
  pdf.circle(sourceX, centerY, 7, 'FD');
  pdf.setDrawColor(...PDF_THEME.steel);
  pdf.line(sourceX - 4, centerY, sourceX + 4, centerY);
  pdf.line(sourceX, centerY - 4, sourceX, centerY + 4);

  pdf.setFillColor(...PDF_THEME.steelSoft);
  pdf.setGState(new GState({ opacity: 0.12 }));
  pdf.triangle(sourceX + 7, centerY, receptorX - 3, centerY - 25, receptorX - 3, centerY + 25, 'F');
  pdf.setGState(new GState({ opacity: 1 }));
  pdf.setDrawColor(...PDF_THEME.steelSoft);
  pdf.setLineWidth(0.35);
  pdf.line(sourceX + 7, centerY, receptorX - 3, centerY - 25);
  pdf.line(sourceX + 7, centerY, receptorX - 3, centerY + 25);
  pdf.setLineDashPattern([2.2, 1.6], 0);
  pdf.line(sourceX + 7, centerY, receptorX - 3, centerY);
  pdf.setLineDashPattern([], 0);

  pdf.setFillColor(...PDF_THEME.panel);
  pdf.setDrawColor(...PDF_THEME.ink);
  pdf.roundedRect(partX - 10, centerY - 21, 20, 42, 1.2, 1.2, 'FD');
  pdf.setFillColor(...PDF_THEME.amberSoft);
  pdf.setDrawColor(...PDF_THEME.amber);
  pdf.rect(partX - 10, centerY - 6, 20, 12, 'FD');
  pdf.setTextColor(...PDF_THEME.ink);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(SETUP_DIAGRAM_MICRO_FONT_SIZE);
  pdf.text('INSPECTION', partX, centerY - 0.5, { align: 'center' });
  pdf.text('ZONE', partX, centerY + 3.3, { align: 'center' });

  pdf.setFillColor(...(setup.mode === 'dda' ? PDF_THEME.greenSoft : PDF_THEME.panel));
  pdf.setDrawColor(...PDF_THEME.ink);
  pdf.roundedRect(receptorX - 3, centerY - 25, 7, 50, 1, 1, 'FD');
  if (setup.mode === 'dda') {
    pdf.setDrawColor(...PDF_THEME.green);
    for (let offset = -20; offset <= 20; offset += 8) {
      pdf.line(receptorX - 2, centerY + offset, receptorX + 3, centerY + offset);
    }
  } else {
    pdf.setDrawColor(...PDF_THEME.muted);
    pdf.line(receptorX, centerY - 22, receptorX, centerY + 22);
  }

  pdf.setFillColor(...PDF_THEME.amberSoft);
  pdf.setDrawColor(...PDF_THEME.amber);
  pdf.roundedRect(partX - 14, centerY - 18, 3.5, 10, 0.5, 0.5, 'FD');
  pdf.setTextColor(...PDF_THEME.amber);
  pdf.setFontSize(SETUP_DIAGRAM_MICRO_FONT_SIZE);
  pdf.text('IQI', partX - 12.2, centerY - 20.5, { align: 'center' });

  pdf.setFillColor(...PDF_THEME.greenSoft);
  pdf.setDrawColor(...PDF_THEME.green);
  pdf.roundedRect(receptorX - 8, centerY + 12, 3.8, 8, 0.5, 0.5, 'FD');
  pdf.setTextColor(...PDF_THEME.green);
  pdf.setFontSize(SETUP_DIAGRAM_MICRO_FONT_SIZE);
  pdf.text('ID', receptorX - 6.1, centerY + 17.1, { align: 'center' });

  pdf.setTextColor(...PDF_THEME.ink);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(6.2);
  pdf.text(setup.sourceHeading.toUpperCase(), sourceX, centerY + 12, { align: 'center' });
  pdf.text('TEST PART', partX, centerY + 28, { align: 'center' });
  pdf.text(setup.receptorHeading.toUpperCase(), receptorX, centerY + 31, { align: 'center' });
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(...PDF_THEME.muted);
  pdf.setFontSize(SETUP_DIAGRAM_MICRO_FONT_SIZE);
  pdf.text(truncateToWidth(pdf, setup.sourceLabel, 38), sourceX, centerY + 16, { align: 'center' });
  pdf.text(truncateToWidth(pdf, setup.partLabel, 38), partX, centerY + 32, { align: 'center' });
  pdf.text(truncateToWidth(pdf, setup.receptorLabel, 38), receptorX, centerY + 35, { align: 'center' });

  drawDimensionLine(pdf, sourceX, receptorX, startY + 71, `${setup.dimensions.sourceToReceptor.code} - ${setup.dimensions.sourceToReceptor.value}`, true);
  drawDimensionLine(pdf, sourceX, partX, startY + 79, `${setup.dimensions.sourceToObject.code} - ${setup.dimensions.sourceToObject.value}`);
  drawDimensionLine(pdf, partX, receptorX, startY + 87, `${setup.dimensions.objectToReceptor.code} - ${setup.dimensions.objectToReceptor.value}`);
  return startY + height;
};

const renderSetupMapContent = (
  pdf: jsPDF,
  sectionNumber: number,
  heading: string,
  rows: PdfRow[],
  setupInput: RtSetupDiagramInput,
  calloutRows: RowInput[],
): void => {
  pdf.addPage();
  let y = renderPairedSection(pdf, sectionNumber, heading, rows, PDF_CONTENT_TOP);
  y = drawSetupDiagram(pdf, setupInput, y);
  autoTable(pdf, {
    startY: y + 4,
    body: calloutRows,
    margin: { left: PDF_MARGIN, right: PDF_MARGIN, bottom: 20 },
    theme: 'grid',
    pageBreak: 'avoid',
    styles: {
      font: 'helvetica',
      fontSize: 7.2,
      textColor: PDF_THEME.ink,
      lineColor: PDF_THEME.line,
      lineWidth: 0.18,
      cellPadding: 2,
      overflow: 'linebreak',
    },
    columnStyles: {
      0: { cellWidth: 42, fillColor: PDF_THEME.panel, textColor: PDF_THEME.muted, fontStyle: 'bold', fontSize: 6.4 },
      1: { cellWidth: 140 },
    },
  });
  const noteY = getLastTableY(pdf) + 5;
  pdf.setTextColor(...PDF_THEME.muted);
  pdf.setFont('helvetica', 'italic');
  pdf.setFontSize(6.5);
  pdf.text(
    'SETUP IDENTIFICATION GRAPHIC. NUMERIC CONTROLLED VIEW VALUES GOVERN. VERIFY THE REFERENCED ATTACHMENT BEFORE USE.',
    PDF_MARGIN,
    noteY,
  );
};

const renderSetupMapPage = (
  pdf: jsPDF,
  document: Extract<RtPtDocumentV3, { method: 'RT-Film' | 'RT-Digital' | 'RT-CR' }>,
  itemIndex: number,
  sectionNumber: number,
): void => {
  if (document.method === 'RT-CR') {
    const item = document.technique.exposureViews[itemIndex];
    if (!item) return;
    const sourceLabel = document.technique.source.sourceType === 'Gamma'
      ? formatIdentity(document.technique.source.gamma.isotope, document.technique.source.gamma.sourceId)
      : formatIdentity(document.technique.source.manufacturer, document.technique.source.model);
    const receptorLabel = formatIdentity(
      document.technique.plateSystem.plateDesignation,
      item.plateSize,
    );
    const heading = `Exposure setup map - ${item.viewId || itemIndex + 1}`;
    renderSetupMapContent(
      pdf,
      sectionNumber,
      heading,
      [
        ['View / Callout', formatIdentity(item.viewId, item.referenceAttachmentId)],
        ['Zone / Orientation', formatIdentity(item.inspectionZone, item.orientation)],
        ['Source', sourceLabel],
        ['Imaging Plate / Cassette', receptorLabel],
        ['Wall Technique', formatValue(item.wallTechnique)],
        ['Drawing Basis', 'Schematic / NTS - numeric controlled values govern'],
      ],
      {
        mode: 'cr',
        title: heading,
        sourceLabel,
        partLabel: item.description,
        receptorLabel,
        viewId: item.viewId,
        callout: item.referenceAttachmentId,
        orientation: item.orientation,
        inspectionZone: item.inspectionZone,
        iqiPlacement: item.iqiOverride || document.technique.iqi.placement,
        markerPlacement: item.identification,
        distances: {
          sourceToReceptor: { value: item.sfd, unit: item.sfdUnit },
          sourceToObject: { value: item.sod, unit: item.sodUnit },
          objectToReceptor: { value: item.ofd, unit: item.ofdUnit },
        },
      },
      [
        ['BEAM / COLLIMATION', formatIdentity(item.beamAngle ? `${item.beamAngle} ${item.beamAngleUnit}` : '', item.collimation)],
        ['IQI / IDENTIFICATION', formatIdentity(item.iqiOverride || document.technique.iqi.placement, item.identification)],
        ['PLATE / COVERAGE', formatIdentity(item.plateSize, item.overlap)],
        ['SETUP REFERENCE', formatValue(item.referenceAttachmentId)],
      ],
    );
    return;
  }
  if (document.method === 'RT-Film') {
    const item = document.technique.exposureViews[itemIndex];
    if (!item) return;
    const sourceLabel = document.technique.source.sourceType === 'Gamma'
      ? formatIdentity(document.technique.source.gamma.isotope, document.technique.source.gamma.sourceId)
      : formatIdentity(document.technique.source.manufacturer, document.technique.source.model);
    const receptorLabel = item.filmDesignation || document.technique.filmSystem.filmDesignation;
    const heading = `Exposure setup map - ${item.viewId || itemIndex + 1}`;
    renderSetupMapContent(
      pdf,
      sectionNumber,
      heading,
      [
        ['View / Callout', formatIdentity(item.viewId, item.referenceAttachmentId)],
        ['Zone / Orientation', formatIdentity(item.inspectionZone, item.orientation)],
        ['Source', sourceLabel],
        ['Film / Cassette', receptorLabel],
        ['Wall Technique', formatValue(item.wallTechnique)],
        ['Drawing Basis', 'Schematic / NTS - numeric controlled values govern'],
      ],
      {
        mode: 'film',
        title: heading,
        sourceLabel,
        partLabel: item.description,
        receptorLabel,
        viewId: item.viewId,
        callout: item.referenceAttachmentId,
        orientation: item.orientation,
        inspectionZone: item.inspectionZone,
        iqiPlacement: item.iqiOverride || document.technique.iqi.placement,
        markerPlacement: item.identification,
        distances: {
          sourceToReceptor: { value: item.sfd, unit: item.sfdUnit },
          sourceToObject: { value: item.sod, unit: item.sodUnit },
          objectToReceptor: { value: item.ofd, unit: item.ofdUnit },
        },
      },
      [
        ['BEAM / COLLIMATION', formatIdentity(item.beamAngle ? `${item.beamAngle} ${item.beamAngleUnit}` : '', item.collimation)],
        ['IQI / IDENTIFICATION', formatIdentity(item.iqiOverride || document.technique.iqi.placement, item.identification)],
        ['FILM / COVERAGE', formatIdentity(item.filmSize, item.overlap, item.maxCassettes ? `${item.maxCassettes} cassette maximum` : '')],
        ['SETUP REFERENCE', formatValue(item.referenceAttachmentId)],
      ],
    );
    return;
  }

  const item = document.technique.acquisitions[itemIndex];
  if (!item) return;
  const sourceLabel = formatIdentity(document.technique.source.manufacturer, document.technique.source.model);
  const receptorLabel = formatIdentity(document.technique.system.manufacturer, document.technique.system.model);
  const heading = `Acquisition setup map - ${item.viewId || itemIndex + 1}`;
  renderSetupMapContent(
    pdf,
    sectionNumber,
    heading,
    [
      ['View / Callout', formatIdentity(item.viewId, item.referenceAttachmentId)],
      ['Zone / Orientation', formatIdentity(item.inspectionZone, item.orientation)],
      ['Source', sourceLabel],
      ['DDA Detector', receptorLabel],
      ['Wall Technique', formatValue(item.wallTechnique)],
      ['Drawing Basis', 'Schematic / NTS - numeric controlled values govern'],
    ],
    {
      mode: 'dda',
      title: heading,
      sourceLabel,
      partLabel: item.description,
      receptorLabel,
      viewId: item.viewId,
      callout: item.referenceAttachmentId,
      orientation: item.orientation,
      inspectionZone: item.inspectionZone,
      iqiPlacement: item.iqiOverride || document.technique.iqi.placement,
      markerPlacement: item.markingInstructions,
      distances: {
        sourceToReceptor: { value: item.sdd, unit: item.sddUnit },
        sourceToObject: { value: item.sod, unit: item.sodUnit },
        objectToReceptor: { value: item.odd, unit: item.oddUnit },
      },
    },
    [
      ['BEAM / COLLIMATION', formatValue(item.collimation)],
      ['IQI / MARKING', formatIdentity(item.iqiOverride || document.technique.iqi.placement, item.markingInstructions)],
      ['COVERAGE / IMAGE ID', formatIdentity(item.coverage, item.imageNaming)],
      ['SETUP REFERENCE', formatValue(item.referenceAttachmentId)],
    ],
  );
};

const renderSetupMaps = (
  pdf: jsPDF,
  document: RtPtDocumentV3,
  startSectionNumber: number,
): { nextSectionNumber: number; y: number } => {
  if (document.method === 'PT') return { nextSectionNumber: startSectionNumber, y: getLastTableY(pdf) + 6 };
  const itemCount = document.method === 'RT-Digital'
    ? document.technique.acquisitions.length
    : document.technique.exposureViews.length;
  for (let index = 0; index < itemCount; index += 1) {
    renderSetupMapPage(pdf, document, index, startSectionNumber + index);
  }
  if (itemCount > 0) pdf.addPage();
  return {
    nextSectionNumber: startSectionNumber + itemCount,
    y: itemCount > 0 ? PDF_CONTENT_TOP : getLastTableY(pdf) + 6,
  };
};

const renderControlledBasis = (
  pdf: jsPDF,
  document: RtPtDocumentV3,
  startSectionNumber: number,
  startY: number,
): { nextSectionNumber: number; y: number } => {
  const rows: PdfRow[] = [];
  rows.push(
    ['Document Identity', formatIdentity(
      document.documentControl.number,
      document.documentControl.title,
      `Rev ${formatValue(document.documentControl.revision)}`,
    )],
    ['Document Effectivity', formatIdentity(
      `Revision date ${formatValue(document.documentControl.revisionDate)}`,
      `Effective date ${formatValue(document.documentControl.effectiveDate)}`,
      document.documentControl.changeSummary,
    )],
    ['Organization / Site', formatIdentity(document.organization.name, document.organization.site)],
    ['Customer / Job', formatIdentity(
      document.job.customer,
      document.job.contract,
      document.job.purchaseOrder,
      document.job.workOrder,
    )],
    ['Internal Document ID', formatDocumentId(document.documentId)],
    ['Document Status / Unit System', formatIdentity(document.status.toUpperCase(), document.unitSystem)],
  );
  if (document.controlledReferences.length > 0) {
    document.controlledReferences.forEach((reference, index) => {
      rows.push([
        `Controlled Reference ${index + 1}`,
        formatIdentity(
          reference.type,
          reference.number,
          reference.title,
          `Rev ${formatValue(reference.revision)}`,
          reference.clauseOrNote,
        ),
      ]);
    });
  } else {
    rows.push(['Controlled References', 'None entered']);
  }

  if (document.revisionHistory.length > 0) {
    document.revisionHistory.forEach((entry, index) => {
      rows.push([
        `Revision Record ${index + 1}`,
        formatIdentity(
          `Rev ${formatValue(entry.revision)}`,
          entry.date,
          entry.description,
          `Author ${formatValue(entry.author)}`,
        ),
      ]);
    });
  } else {
    rows.push(['Revision History', 'None entered']);
  }

  if (document.approvals.length > 0) {
    document.approvals.forEach((approval, index) => {
      rows.push([
        `Approval ${index + 1} - ${APPROVAL_ROLE_LABEL[approval.role]}`,
        formatIdentity(
          approval.name,
          approval.personnelId,
          approval.certificationBasis,
          `Rev ${formatValue(approval.certificationRevision)}`,
          approval.date,
        ),
      ]);
    });
  } else {
    rows.push(['Approval Records', 'None entered']);
  }

  const y = renderPairedSection(
    pdf,
    startSectionNumber,
    'Document governance and approval records',
    rows,
    startY,
  );
  return { nextSectionNumber: startSectionNumber + 1, y };
};

const renderValidationReview = (
  pdf: jsPDF,
  validation: RtPtValidationSummary,
  sectionNumber: number,
  startY: number,
): number => {
  if (validation.issues.length === 0) {
    return startY;
  }

  const y = ensureContentSpace(pdf, startY, 42);
  return renderDataTableSection(
    pdf,
    sectionNumber,
    'Review exceptions - unresolved',
    ['LEVEL', 'AREA', 'REQUIREMENT', 'FINDING'],
    validation.issues.map((issue) => [
      issue.severity.toUpperCase(),
      formatValue(issue.tab),
      formatValue(issue.label),
      formatValue(issue.message),
    ]),
    y,
    {
      0: { cellWidth: 18, fontStyle: 'bold', textColor: PDF_THEME.red },
      1: { cellWidth: 28 },
      2: { cellWidth: 49 },
      3: { cellWidth: 87 },
    },
  );
};

const drawPageFurniture = (
  pdf: jsPDF,
  document: RtPtDocumentV3,
  release: RtPtPdfReleaseState,
): void => {
  const pages = pdf.getNumberOfPages();
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const docNumber = document.documentControl.number || 'UNNUMBERED';
  const revision = document.documentControl.revision || '-';

  for (let page = 1; page <= pages; page += 1) {
    pdf.setPage(page);
    if (page > 1) {
      pdf.setFillColor(...PDF_THEME.navy);
      pdf.rect(0, 0, pageWidth, 23, 'F');
      pdf.setFillColor(...PDF_THEME.steel);
      pdf.rect(0, 23, pageWidth, 1.2, 'F');
      pdf.setTextColor(...PDF_THEME.white);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(9.2);
      pdf.text(`RT-PT / ${methodCode(document)}`, PDF_MARGIN, 10.2);
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(6.8);
      pdf.text(truncateToWidth(pdf, METHOD_TITLE[document.method], 92), PDF_MARGIN, 16.2);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(7.2);
      pdf.text(`DOC ${docNumber}  /  REV ${revision}`, pageWidth - PDF_MARGIN, 9.8, { align: 'right' });
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(6.5);
      pdf.text(releaseLabel(document, release), pageWidth - PDF_MARGIN, 16.2, { align: 'right' });
    }

    if (release.watermark) {
      pdf.saveGraphicsState();
      pdf.setGState(new GState({ opacity: 0.1 }));
      pdf.setTextColor(...PDF_THEME.steelSoft);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(27);
      pdf.text(release.watermark, pageWidth / 2, pageHeight / 2, { align: 'center', angle: 45 });
      pdf.restoreGraphicsState();
    }

    pdf.setDrawColor(...PDF_THEME.line);
    pdf.setLineWidth(0.25);
    pdf.line(PDF_MARGIN, pageHeight - 15, pageWidth - PDF_MARGIN, pageHeight - 15);
    pdf.setTextColor(...PDF_THEME.muted);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(6.4);
    pdf.text(
      truncateToWidth(pdf, `${document.organization.name || 'RT Inspector'} / ${docNumber} / Rev ${revision}`, 68),
      PDF_MARGIN,
      pageHeight - 9.5,
    );
    pdf.text('PLANNED / REQUIRED TECHNIQUE VALUES', pageWidth / 2, pageHeight - 9.5, { align: 'center' });
    pdf.setFont('helvetica', 'bold');
    pdf.text(`PAGE ${page} OF ${pages}`, pageWidth - PDF_MARGIN, pageHeight - 9.5, { align: 'right' });
  }
};

const renderAttachmentImages = (
  pdf: jsPDF,
  document: RtPtDocumentV3,
  images: RtPtPdfAttachmentImageMap,
  sectionNumber: number,
  startY: number,
): { y: number; nextSectionNumber: number } => {
  const referenced = collectRtPtTechniqueImageAttachments(document)
    .map((metadata) => images.get(metadata.id))
    .filter((image): image is RtPtPdfAttachmentImage => Boolean(image));
  if (referenced.length === 0) {
    return { y: startY, nextSectionNumber: sectionNumber };
  }

  const pageWidth = pdf.internal.pageSize.getWidth();
  const contentWidth = pageWidth - PDF_MARGIN * 2;
  let y = ensureContentSpace(pdf, startY, 34);

  pdf.setFillColor(...PDF_THEME.steel);
  pdf.roundedRect(PDF_MARGIN, y, contentWidth, 8, 1.2, 1.2, 'F');
  pdf.setTextColor(...PDF_THEME.white);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(9);
  pdf.text(`${String(sectionNumber).padStart(2, '0')}  ATTACHED REFERENCE IMAGES`, PDF_MARGIN + 3, y + 5.3);
  y += 11;

  const maximumImageHeight = 110;
  referenced.forEach((image, index) => {
    const aspect = image.heightPx / image.widthPx;
    const width = Math.min(contentWidth, maximumImageHeight / aspect);
    const height = width * aspect;
    const captionHeight = 9;
    y = ensureContentSpace(pdf, y, captionHeight + height + 6);

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(7.4);
    pdf.setTextColor(...PDF_THEME.ink);
    pdf.text(
      truncateToWidth(pdf, `Attachment ${index + 1}: ${image.metadata.name} (${image.metadata.id})`, contentWidth),
      PDF_MARGIN,
      y + 3,
    );
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(6.4);
    pdf.setTextColor(...PDF_THEME.muted);
    pdf.text(
      truncateToWidth(
        pdf,
        `SHA-256 ${image.metadata.sha256} - stored content integrity-verified against the controlled document`,
        contentWidth,
      ),
      PDF_MARGIN,
      y + 6.6,
    );

    const imageY = y + captionHeight;
    pdf.addImage(image.dataUrl, image.metadata.mimeType === 'image/png' ? 'PNG' : 'JPEG', PDF_MARGIN, imageY, width, height);
    pdf.setDrawColor(...PDF_THEME.line);
    pdf.setLineWidth(0.25);
    pdf.rect(PDF_MARGIN, imageY, width, height, 'S');
    y = imageY + height + 6;
  });

  return { y, nextSectionNumber: sectionNumber + 1 };
};

export interface RtPtTechniquePdfBuildOptions {
  /**
   * Pre-loaded, integrity-verified attachment images (see rtPtPdfAttachments).
   * Attachments without an entry keep their metadata rows only.
   */
  attachmentImages?: RtPtPdfAttachmentImageMap;
}

export function buildRtPtTechniquePdf(
  document: RtPtDocumentV3,
  callerValidation?: RtPtValidationSummary,
  options?: RtPtTechniquePdfBuildOptions,
): jsPDF {
  void callerValidation;
  const validation = validateRtPtDocument(document);
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
  const release = getRtPtPdfReleaseState(document);

  pdf.setProperties({
    title: document.documentControl.title || `${METHOD_TITLE[document.method]} Technique`,
    subject: `${METHOD_TITLE[document.method]} - ${release.controlledRelease
      ? 'Controlled'
      : document.status === 'superseded' ? 'Superseded / Uncontrolled' : 'Draft / Uncontrolled'}`,
    author: document.organization.name || 'RT Inspector',
    creator: 'RT Inspector',
    keywords: release.watermark || 'CONTROLLED TECHNIQUE',
  });

  renderCover(pdf, document, validation, release);

  pdf.addPage();
  let sectionNumber = 1;
  let y = renderPairedSection(pdf, sectionNumber, 'Technique overview', techniqueOverviewRows(document), PDF_CONTENT_TOP);
  sectionNumber += 1;
  y = renderTechniqueSchedule(pdf, document, sectionNumber, y);
  sectionNumber += 1;

  if (document.method === 'RT-Film') {
    const chart = renderFilmExposureChart(pdf, document, sectionNumber, y);
    y = chart.y;
    if (chart.rendered) sectionNumber += 1;
  }

  const setupMaps = renderSetupMaps(pdf, document, sectionNumber);
  sectionNumber = setupMaps.nextSectionNumber;
  y = setupMaps.y;

  const techniqueSections = document.method === 'RT-Film'
    ? filmSections(document)
    : document.method === 'RT-Digital'
      ? digitalSections(document)
      : document.method === 'RT-CR'
        ? crSections(document)
        : ptSections(document);
  for (const section of techniqueSections) {
    const rows = section.title.includes('Planning Aid Only')
      ? section.rows.filter(([, value]) => value !== 'Not specified')
      : section.rows;
    if (rows.length === 0) continue;
    y = renderPairedSection(pdf, sectionNumber, section.title, rows, y);
    sectionNumber += 1;
  }

  if (options?.attachmentImages && options.attachmentImages.size > 0) {
    const attachmentBlock = renderAttachmentImages(pdf, document, options.attachmentImages, sectionNumber, y);
    y = attachmentBlock.y;
    sectionNumber = attachmentBlock.nextSectionNumber;
  }

  const controlledBasis = renderControlledBasis(pdf, document, sectionNumber, y);
  sectionNumber = controlledBasis.nextSectionNumber;
  y = controlledBasis.y;
  renderValidationReview(pdf, validation, sectionNumber, y);

  drawPageFurniture(pdf, document, release);
  return pdf;
}

export function exportRtPtTechniquePdf(
  document: RtPtDocumentV3,
  callerValidation?: RtPtValidationSummary,
  options?: RtPtTechniquePdfBuildOptions,
): string {
  void callerValidation;
  const validation = validateRtPtDocument(document);
  const filename = getRtPtTechniquePdfFilename(document, validation);
  buildRtPtTechniquePdf(document, validation, options).save(filename);
  return filename;
}

/**
 * Standalone exposure sheet (RT-Film and RT-CR): the operator-facing shot list
 * — plus the machine exposure chart on film — released under the same
 * watermark and fingerprint rules as the technique card it derives from.
 * Planned values govern per the technique card; this sheet adds no data of
 * its own.
 */
export function buildRtPtFilmExposureSheetPdf(
  document: RtPtDocumentV3,
  callerValidation?: RtPtValidationSummary,
): jsPDF {
  void callerValidation;
  if (document.method !== 'RT-Film' && document.method !== 'RT-CR') {
    throw new Error('The exposure sheet export applies to RT-Film and RT-CR techniques only.');
  }
  const isFilm = document.method === 'RT-Film';
  const sheetLabel = isFilm ? 'FILM EXPOSURE SHEET' : 'CR EXPOSURE SHEET';
  const release = getRtPtPdfReleaseState(document);
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
  const pageWidth = pdf.internal.pageSize.getWidth();

  pdf.setProperties({
    title: `${document.documentControl.title || METHOD_TITLE[document.method]} - Exposure Sheet`,
    subject: `${METHOD_TITLE[document.method]} Exposure Sheet - ${release.controlledRelease
      ? 'Controlled'
      : document.status === 'superseded' ? 'Superseded / Uncontrolled' : 'Draft / Uncontrolled'}`,
    author: document.organization.name || 'RT Inspector',
    creator: 'RT Inspector',
    keywords: release.watermark || 'CONTROLLED TECHNIQUE',
  });

  // Standalone page-one band, mirroring the continuation-page furniture.
  const docNumber = document.documentControl.number || 'UNNUMBERED';
  const revision = document.documentControl.revision || '-';
  pdf.setFillColor(...PDF_THEME.navy);
  pdf.rect(0, 0, pageWidth, 23, 'F');
  pdf.setFillColor(...PDF_THEME.steel);
  pdf.rect(0, 23, pageWidth, 1.2, 'F');
  pdf.setTextColor(...PDF_THEME.white);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(9.2);
  pdf.text(`RT-PT / ${methodCode(document)}`, PDF_MARGIN, 10.2);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(6.8);
  pdf.text(`${sheetLabel} - PLANNED EXPOSURES ONLY`, PDF_MARGIN, 16.2);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(7.2);
  pdf.text(`DOC ${docNumber}  \\  REV ${revision}`, pageWidth - PDF_MARGIN, 9.8, { align: 'right' });
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(6.6);
  pdf.text('VALUES GOVERNED BY THE TECHNIQUE CARD', pageWidth - PDF_MARGIN, 16.2, { align: 'right' });

  const { general, source, exposureDefaults } = document.technique;
  const basisRows: PdfRow[] = [
    ['Governing Technique', `DOC ${docNumber} REV ${revision}`],
    ['Part', formatIdentity(general.partName, general.partNumber)],
    ['Planned Inspection Date', formatValue(general.date)],
    ['Procedure Number', formatValue(general.procedureNumber)],
    ['Planned Radiation Source', formatIdentity(source.sourceType, source.manufacturer, source.model, source.serialNumber)],
  ];
  if (document.method === 'RT-Film') {
    const { filmSystem } = document.technique;
    basisRows.push(
      ['Film System', formatIdentity(filmSystem.filmDesignation, filmSystem.filmClass)],
      ['Required Density Range', formatRange(filmSystem.requiredDensityMin, filmSystem.requiredDensityMax, '')],
    );
  } else {
    const { plateSystem, scanner, imageQuality } = document.technique;
    basisRows.push(
      ['Imaging Plate System', formatIdentity(plateSystem.plateDesignation, plateSystem.plateClass)],
      ['Planned Scan Resolution', formatValue(scanner.scanResolutionPixelsPerMm, 'px/mm')],
      ['Required Grey-Value Window', formatRange(imageQuality.greyValueMin, imageQuality.greyValueMax, '')],
      ['Maximum Exposure-to-Scan Delay', formatValue(imageQuality.maxScanDelay, imageQuality.maxScanDelayUnit)],
    );
  }
  basisRows.push(['Default SFD', formatValue(exposureDefaults.sfd, exposureDefaults.sfdUnit)]);
  if (source.sourceType === 'Gamma') {
    basisRows.push(
      ['Gamma Source', formatIdentity(source.gamma.isotope, source.gamma.sourceId)],
      ['Referenced Activity', `${formatValue(source.gamma.activity, source.gamma.activityUnit)} on ${formatValue(source.gamma.activityReferenceDate)}`],
    );
    const isotope = resolveRtIsotope(source.gamma.isotope);
    if (isotope) {
      const decay = calculateDecayedActivity(
        source.gamma.activity,
        source.gamma.activityReferenceDate,
        general.date,
        isotope.halfLifeDays,
      );
      if (decay && decay.elapsedDays >= 0) {
        const activityUnitSuffix = source.gamma.activityUnit ? ` ${source.gamma.activityUnit}` : '';
        basisRows.push([
          'Computed Activity at Planned Inspection Date',
          `${decay.decayedActivity}${activityUnitSuffix} (decay factor ${decay.decayFactor}; exposure time x${decay.exposureTimeMultiplier})`,
        ]);
      }
    }
  }

  let sectionNumber = 1;
  let y = renderPairedSection(pdf, sectionNumber, 'Exposure sheet basis', basisRows, PDF_CONTENT_TOP);
  sectionNumber += 1;
  y = renderTechniqueSchedule(pdf, document, sectionNumber, y);
  sectionNumber += 1;
  if (document.method === 'RT-Film') {
    renderFilmExposureChart(pdf, document, sectionNumber, y);
  }

  drawPageFurniture(pdf, document, release);
  return pdf;
}

export function getRtPtFilmExposureSheetPdfFilename(
  document: RtPtDocumentV3,
  callerValidation?: RtPtValidationSummary,
): string {
  void callerValidation;
  const release = getRtPtPdfReleaseState(document);
  const identity = document.documentControl.number || activePartToken(document);
  const revision = document.documentControl.revision
    ? `-REV-${safeFileToken(document.documentControl.revision)}`
    : '';
  const methodToken = document.method === 'RT-CR' ? 'CR' : 'FILM';
  return `${release.filenamePrefix}RTPT-${methodToken}-EXPOSURE-SHEET-${safeFileToken(identity)}${revision}.pdf`;
}

export function exportRtPtFilmExposureSheetPdf(
  document: RtPtDocumentV3,
  callerValidation?: RtPtValidationSummary,
): string {
  void callerValidation;
  const filename = getRtPtFilmExposureSheetPdfFilename(document);
  buildRtPtFilmExposureSheetPdf(document).save(filename);
  return filename;
}
