/**
 * Procedure Writer Types
 * Types for generating UT inspection procedures
 */

// Wizard step
export type ProcedureWizardStep =
  | "standard"
  | "scope"
  | "equipment"
  | "calibration"
  | "scan"
  | "acceptance"
  | "documentation"
  | "review";

// Standard types
export type ProcedureStandardType =
  | "AMS-STD-2154E"
  | "ASTM-A388"
  | "ASTM-E2375"
  | "ASTM-E1001"
  | "ASTM-E2580"
  | "ASTM-E588"
  | "AMS-2630"
  | "BS-EN-10228-3"
  | "BS-EN-10228-4"
  | "MIL-STD-2154"
  | "CUSTOM";

// Inspection method
export type InspectionMethod =
  | "contact"
  | "immersion"
  | "squirter"
  | "phased_array"
  | "tofd";

// Scan type
export type ScanType =
  | "straight_beam"
  | "angle_beam"
  | "combination";

// Material category
export type MaterialCategory =
  | "aluminum"
  | "titanium"
  | "steel"
  | "nickel_alloy"
  | "stainless_steel"
  | "composite";

// Part category
export type PartCategory =
  | "forging"
  | "casting"
  | "plate"
  | "bar"
  | "tube"
  | "extrusion"
  | "weld";

// Personnel qualification
export type QualificationLevel = "Level_I" | "Level_II" | "Level_III";

// Procedure section
export interface ProcedureSection {
  id: string;
  title: string;
  content: string;
  subsections?: ProcedureSection[];
}

// Scope definition
export interface ProcedureScope {
  title: string;
  description: string;
  partCategories: PartCategory[];
  materialCategories: MaterialCategory[];
  thicknessRange: {
    min: number;
    max: number;
    unit: "mm" | "inch";
  };
  applicableStandards: string[];
  exclusions?: string[];
}

// Equipment requirements
export interface EquipmentRequirements {
  flawDetector: {
    type: string;
    frequencyRange: { min: number; max: number };
    pulserTypes: string[];
    requirements: string[];
  };
  transducers: {
    types: string[];
    frequencies: number[];
    diameters: number[];
    requirements: string[];
  };
  cables: {
    maxLength: number;
    requirements: string[];
  };
  couplant: {
    types: string[];
    requirements: string[];
  };
}

// Calibration requirements
export interface CalibrationRequirements {
  referenceBlocks: {
    types: string[];
    materials: string[];
    requirements: string[];
  };
  fbhSizes: string[];
  sensitivitySettings: {
    primary: string;
    scanning: string;
    evaluation: string;
  };
  linearity: {
    horizontalTolerance: string;
    verticalTolerance: string;
    checkFrequency: string;
  };
  dac: {
    required: boolean;
    points: number[];
    transferLoss: string;
  };
}

// Scan procedure
export interface ScanProcedure {
  method: InspectionMethod;
  scanType: ScanType;
  coverage: {
    required: number;
    overlap: number;
  };
  scanSpeed: {
    max: number;
    unit: "mm/s" | "inch/s";
  };
  indexIncrement: {
    value: number;
    unit: "mm" | "inch";
  };
  waterPath?: {
    min: number;
    max: number;
    unit: "mm" | "inch";
  };
  gates: {
    frontSurface: { start: string; width: string };
    backWall: { start: string; width: string };
    interface?: { start: string; width: string };
  };
  scanPattern: string;
  surfaceCondition: string[];
}

// Acceptance criteria
export interface AcceptanceCriteria {
  acceptanceClass: string;
  maxIndications: {
    single: { size: string; amplitude: string };
    cluster: { count: number; area: string };
    linear: { length: string };
  };
  rejectionCriteria: string[];
  specialRequirements?: string[];
  notchEquivalents?: {
    depth: string;
    length: string;
  };
}

// Documentation requirements
export interface DocumentationRequirements {
  recordsToMaintain: string[];
  reportContents: string[];
  retentionPeriod: string;
  personnelQualifications: {
    inspection: QualificationLevel[];
    evaluation: QualificationLevel[];
    approval: QualificationLevel[];
  };
  calibrationRecords: string[];
}

// Complete procedure data
export interface ProcedureData {
  // Metadata
  procedureNumber: string;
  revision: string;
  title: string;
  effectiveDate: string;
  preparedBy: string;
  approvedBy: string;

  // Standard
  primaryStandard: ProcedureStandardType;
  additionalStandards: string[];

  // Sections
  scope: ProcedureScope;
  equipment: EquipmentRequirements;
  calibration: CalibrationRequirements;
  scanProcedure: ScanProcedure;
  acceptance: AcceptanceCriteria;
  documentation: DocumentationRequirements;

  // Custom sections
  additionalSections?: ProcedureSection[];
}

// Acceptance class type
export type AcceptanceClass = "AAA" | "AA" | "A1" | "A" | "B" | "C";

// Wizard form data (partial during wizard flow)
export interface ProcedureWizardData {
  // Step 1: Standard
  primaryStandard?: string; // Using string for flexibility
  additionalStandards?: string[];

  // Step 2: Scope
  procedureTitle?: string;
  scopeDescription?: string;
  partCategories?: string[];
  materialTypes?: string[];
  materialCategories?: MaterialCategory[];
  thicknessMin?: number;
  thicknessMax?: number;
  thicknessUnit?: "mm" | "inch";
  exclusions?: string;

  // Step 3: Equipment
  frequencyMin?: number;
  frequencyMax?: number;
  transducerTypes?: string[];
  transducerFrequencies?: number[];
  transducerDiameters?: number[];
  couplantTypes?: string[];

  // Step 4: Calibration
  calibrationBlockTypes?: string[];
  blockTypes?: string[];
  blockMaterial?: string;
  fbhSizes?: string[];
  sensitivityMethod?: string;
  referenceLevel?: number;
  scanningLevel?: number;
  calibrationInterval?: string;
  temperatureCompensation?: boolean;
  linearityCheckRequired?: boolean;
  sameHeatBlock?: boolean;
  primarySensitivity?: string;
  scanningSensitivity?: string;
  dacRequired?: boolean;
  dacPoints?: number[];

  // Step 5: Scan
  inspectionMethod?: string;
  scanType?: string;
  beamTypes?: string[];
  minimumCoverage?: number;
  scanOverlap?: number;
  waterPathMin?: number;
  waterPathMax?: number;
  waterTemperatureRange?: string;
  maxScanSpeed?: number;
  maxScanIndex?: number;
  surfacePreparation?: string;
  multiDirectionalScan?: boolean;
  gateRecordingRequired?: boolean;
  aScanCaptureRequired?: boolean;
  method?: InspectionMethod;
  coverageRequired?: number;
  overlap?: number;
  scanSpeedMax?: number;
  indexIncrement?: number;
  surfaceConditions?: string[];

  // Step 6: Acceptance
  acceptanceClasses?: AcceptanceClass[];
  evaluationMethod?: string;
  rejectionLevel?: string;
  recordingLevel?: string;
  singleDefectLimit?: string;
  groupedDefectsLimit?: string;
  zoneSpecificRules?: string;
  materialConsiderations?: string[];
  backReflectionRequired?: boolean;
  noiseEvaluationRequired?: boolean;
  levelIIIReviewRequired?: boolean;
  acceptanceClass?: string;
  maxSingleSize?: string;
  maxSingleAmplitude?: string;
  maxClusterCount?: number;
  maxClusterArea?: string;
  maxLinearLength?: string;
  specialRequirements?: string[];

  // Step 7: Documentation
  personnelLevels?: string[];
  certificationScheme?: string;
  requiredRecords?: string[];
  retentionPeriod?: string;
  reportFormats?: string[];
  approvalChain?: string;
  customerSpecification?: string;
  poReference?: string;
  witnessRequired?: boolean;
  nadcapRequired?: boolean;
  traceabilityRequired?: boolean;
  electronicSignatureRequired?: boolean;
  documentationNotes?: string;
  inspectionLevel?: QualificationLevel[];
  evaluationLevel?: QualificationLevel[];
  approvalLevel?: QualificationLevel[];
  recordsToMaintain?: string[];
}

// Template definition
export interface ProcedureTemplate {
  id: string;
  name: string;
  description: string;
  standard: ProcedureStandardType;
  defaultData: Partial<ProcedureWizardData>;
  sections: ProcedureSection[];
}

// Export format
export type ProcedureExportFormat = "docx" | "pdf" | "html";

// Labels
export const STANDARD_LABELS: Record<ProcedureStandardType, string> = {
  "AMS-STD-2154E": "AMS-STD-2154E (Aerospace Metals)",
  "ASTM-A388": "ASTM A388 (Steel Forgings)",
  "ASTM-E2375": "ASTM E2375 (Wrought Products)",
  "ASTM-E1001": "ASTM E1001 (Immersion Pulse-Echo)",
  "ASTM-E2580": "ASTM E2580 (Composite Panels)",
  "ASTM-E588": "ASTM E588 (Bearing Steel Cleanliness)",
  "AMS-2630": "AMS 2630E (Product Over 0.5 Inch Thick)",
  "BS-EN-10228-3": "BS EN 10228-3 (Ferritic/Martensitic)",
  "BS-EN-10228-4": "BS EN 10228-4 (Stainless Steel)",
  "MIL-STD-2154": "MIL-STD-2154 (Military)",
  "CUSTOM": "Custom Procedure",
};

export const METHOD_LABELS: Record<InspectionMethod, string> = {
  contact: "Contact",
  immersion: "Immersion",
  squirter: "Squirter/Bubbler",
  phased_array: "Phased Array",
  tofd: "TOFD",
};

export const SCAN_TYPE_LABELS: Record<ScanType, string> = {
  straight_beam: "Straight Beam",
  angle_beam: "Angle Beam",
  combination: "Combination",
};

export const MATERIAL_LABELS: Record<MaterialCategory, string> = {
  aluminum: "Aluminum Alloys",
  titanium: "Titanium Alloys",
  steel: "Carbon/Low Alloy Steel",
  nickel_alloy: "Nickel-Based Alloys",
  stainless_steel: "Stainless Steel",
  composite: "Composite Materials",
};

export const PART_LABELS: Record<PartCategory, string> = {
  forging: "Forgings",
  casting: "Castings",
  plate: "Plate/Sheet",
  bar: "Bar/Billet",
  tube: "Tube/Pipe",
  extrusion: "Extrusions",
  weld: "Welds",
};

export const QUALIFICATION_LABELS: Record<QualificationLevel, string> = {
  Level_I: "Level I",
  Level_II: "Level II",
  Level_III: "Level III",
};
