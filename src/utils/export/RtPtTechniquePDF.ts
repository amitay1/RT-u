import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  calculateDigitalGeometricUnsharpness,
  calculateFilmGeometricUnsharpness,
} from '@/lib/rtGeometry';
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
  validateRtPtDocument,
  type RtPtValidationSummary,
} from '@/lib/rtPtValidation';
import {
  RT_PT_METHOD_LABEL,
  type RtPtApprovalRole,
  type RtPtDocumentV3,
} from '@/types/rtPtDocument';

type PdfRow = [string, string];

export interface RtPtPdfSection {
  title: string;
  rows: PdfRow[];
}

export interface RtPtPdfReleaseState {
  controlledRelease: boolean;
  watermark: 'DRAFT - UNCONTROLLED' | null;
  filenamePrefix: 'DRAFT-UNCONTROLLED-' | '';
}

const METHOD_TITLE = {
  'RT-Film': 'Radiographic Testing - Film',
  'RT-Digital': 'Radiographic Testing - Digital Detector Array',
  PT: 'Liquid Penetrant Testing',
} as const;

const APPROVAL_ROLE_LABEL: Record<RtPtApprovalRole, string> = {
  prepared: 'Prepared by',
  reviewed: 'Reviewed by',
  'cognizant-engineering': 'Cognizant engineering',
  'ndt-level-3': 'NDT Level III',
};

const formatValue = (value: string | number | boolean | null | undefined, unit?: string): string => {
  if (value === '' || value === null || value === undefined) return '-';
  const formatted = typeof value === 'boolean' ? (value ? 'Yes' : 'No') : String(value);
  return unit ? `${formatted} ${unit}` : formatted;
};

const formatRange = (
  minimum: string | number,
  maximum: string | number,
  unit: string,
): string => `${formatValue(minimum, unit)} to ${formatValue(maximum, unit)}`;

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
  }

  const sections: RtPtPdfSection[] = [
    {
      title: 'Part and Technique Basis',
      rows: [
        ...commonGeneralRows(general),
        ['PS811000E C1 Applicability', formatValue(ps811000Applicable)],
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
            : '-'],
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
      : ptSections(document);
  return [...controlSections(document), ...techniqueSections];
}

export function getRtPtPdfReleaseState(
  document: RtPtDocumentV3,
  callerValidation?: RtPtValidationSummary,
): RtPtPdfReleaseState {
  void callerValidation;
  const validation = validateRtPtDocument(document);
  const controlledRelease = document.status === 'approved' && validation.approvalReadiness.isReady;
  return {
    controlledRelease,
    watermark: controlledRelease ? null : 'DRAFT - UNCONTROLLED',
    filenamePrefix: controlledRelease ? '' : 'DRAFT-UNCONTROLLED-',
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

const estimateSectionHeight = (pdf: jsPDF, section: RtPtPdfSection): number => {
  const rowsHeight = section.rows.reduce((total, [label, value]) => {
    const lineCount = Math.max(
      pdf.splitTextToSize(label, 66).length,
      pdf.splitTextToSize(value, 104).length,
    );
    return total + Math.max(7, lineCount * 3.4 + 4);
  }, 0);
  return 16 + rowsHeight;
};

export function buildRtPtTechniquePdf(
  document: RtPtDocumentV3,
  callerValidation?: RtPtValidationSummary,
): jsPDF {
  void callerValidation;
  const validation = validateRtPtDocument(document);
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;
  const release = getRtPtPdfReleaseState(document);
  const general = document.technique.general;

  pdf.setProperties({
    title: document.documentControl.title || `${METHOD_TITLE[document.method]} Technique`,
    subject: `${METHOD_TITLE[document.method]} - ${release.controlledRelease ? 'Controlled' : 'Draft / Uncontrolled'}`,
    author: document.organization.name || 'RT-PT Inspector',
    creator: 'RT-PT Inspector',
    keywords: release.watermark || 'CONTROLLED TECHNIQUE',
  });

  pdf.setFillColor(12, 33, 53);
  pdf.rect(0, 0, pageWidth, 36, 'F');
  pdf.setTextColor(255, 255, 255);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(17);
  pdf.text('RT-PT INSPECTOR', margin, 13);
  pdf.setFontSize(12);
  pdf.text('CONTROLLED TECHNIQUE DOCUMENT', margin, 22);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8.5);
  pdf.text(METHOD_TITLE[document.method], margin, 29);
  pdf.text(release.controlledRelease ? 'CONTROLLED RELEASE' : 'DRAFT / UNCONTROLLED', pageWidth - margin, 13, { align: 'right' });

  pdf.setFillColor(225, 239, 247);
  pdf.roundedRect(margin, 42, contentWidth, 32, 2, 2, 'F');
  pdf.setTextColor(25, 50, 68);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(9);
  pdf.text(`${RT_PT_METHOD_LABEL[document.method]} | Doc ${document.documentControl.number || '-'} | Rev ${document.documentControl.revision || '-'}`, margin + 4, 49);
  pdf.setFont('helvetica', 'normal');
  pdf.text(`Part: ${general.partNumber || '-'} | Name: ${general.partName || '-'} | Material: ${general.material || '-'}`, margin + 4, 56);
  pdf.text(`Draft completeness: ${validation.draftCompleteness.completionPercent}% (${validation.draftCompleteness.completedFieldsCount}/${validation.draftCompleteness.totalRequiredFields})`, margin + 4, 63);
  pdf.text(`Approval readiness: ${validation.approvalReadiness.isReady ? 'READY' : 'NOT READY'} | Status: ${document.status.toUpperCase()}`, margin + 4, 70);

  let y = 80;
  const controlledFindings = validation.issues;
  if (controlledFindings.length) {
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(10);
    pdf.setTextColor(145, 65, 20);
    pdf.text('Validation and review findings', margin, y);
    y += 2;
    autoTable(pdf, {
      startY: y,
      head: [['Level', 'Field', 'Finding']],
      body: controlledFindings.map((issue) => [issue.severity.toUpperCase(), issue.label, issue.message]),
      margin: { left: margin, right: margin, top: 30, bottom: 20 },
      theme: 'grid',
      showHead: 'everyPage',
      styles: { font: 'helvetica', fontSize: 7.5, cellPadding: 1.8, overflow: 'linebreak', valign: 'top' },
      headStyles: { fillColor: [172, 83, 35], textColor: [255, 255, 255], fontStyle: 'bold' },
      columnStyles: { 0: { cellWidth: 18 }, 1: { cellWidth: 43 }, 2: { cellWidth: 'auto' } },
    });
    y = Math.max((pdf as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 7, 30);
  }

  for (const section of getRtPtExportSections(document)) {
    if (y + Math.min(estimateSectionHeight(pdf, section), pageHeight - 50) > pageHeight - 20) {
      pdf.addPage();
      y = 30;
    }
    pdf.setFillColor(30, 93, 126);
    pdf.roundedRect(margin, y, contentWidth, 7, 1, 1, 'F');
    pdf.setTextColor(255, 255, 255);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(9);
    pdf.text(section.title, margin + 3, y + 4.7);
    y += 8.5;
    autoTable(pdf, {
      startY: y,
      head: [['Controlled Field', 'Planned / Required Value']],
      body: section.rows,
      margin: { left: margin, right: margin, top: 30, bottom: 20 },
      theme: 'grid',
      showHead: 'everyPage',
      rowPageBreak: 'avoid',
      styles: { font: 'helvetica', fontSize: 8, cellPadding: 2, overflow: 'linebreak', valign: 'middle' },
      headStyles: { fillColor: [215, 231, 240], textColor: [20, 45, 60], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [247, 250, 252] },
      columnStyles: { 0: { cellWidth: 70, fontStyle: 'bold' }, 1: { cellWidth: 'auto' } },
    });
    y = Math.max((pdf as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 7, 30);
  }

  const pages = pdf.getNumberOfPages();
  for (let page = 1; page <= pages; page += 1) {
    pdf.setPage(page);
    if (page > 1) {
      pdf.setFillColor(12, 33, 53);
      pdf.rect(0, 0, pageWidth, 22, 'F');
      pdf.setTextColor(255, 255, 255);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(9);
      pdf.text(`RT-PT INSPECTOR - ${METHOD_TITLE[document.method]}`, margin, 13);
      pdf.text(document.status.toUpperCase(), pageWidth - margin, 13, { align: 'right' });
    }
    if (release.watermark) {
      pdf.setTextColor(220, 224, 228);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(30);
      pdf.text(release.watermark, pageWidth / 2, pageHeight / 2, { align: 'center', angle: 45 });
    }
    pdf.setDrawColor(190, 205, 214);
    pdf.line(margin, pageHeight - 14, pageWidth - margin, pageHeight - 14);
    pdf.setTextColor(85, 95, 102);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(7);
    pdf.text(
      `Doc ${document.documentControl.number || '-'} | Rev ${document.documentControl.revision || '-'} | Status ${document.status.toUpperCase()}`,
      margin,
      pageHeight - 9,
    );
    pdf.text(`Page ${page} of ${pages}`, pageWidth - margin, pageHeight - 9, { align: 'right' });
  }
  return pdf;
}

export function exportRtPtTechniquePdf(
  document: RtPtDocumentV3,
  callerValidation?: RtPtValidationSummary,
): string {
  void callerValidation;
  const validation = validateRtPtDocument(document);
  const filename = getRtPtTechniquePdfFilename(document, validation);
  buildRtPtTechniquePdf(document, validation).save(filename);
  return filename;
}
