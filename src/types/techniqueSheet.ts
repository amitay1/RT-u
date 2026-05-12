import type { AngleBeamCalibrationRow } from "@/data/fbhStandardsData";

export type StandardType =
  // Primary Aerospace Standards
  | "AMS-STD-2154E"  // Ultrasonic Inspection of Wrought Metals - Aerospace
  | "MIL-STD-2154"   // Legacy military standard (alias to AMS-STD-2154E)

  // ASTM Standards
  | "ASTM-A388"      // Heavy Steel Forgings
  | "ASTM-E2375"     // UT of Wrought Products (general)
  | "ASTM-E127"      // FBH Reference Blocks (calibration)
  | "ASTM-E164"      // UT of Weldments

  // European Standards (BS EN)
  | "BS-EN-10228-3"  // Ferritic/Martensitic Steel Forgings
  | "BS-EN-10228-4"  // Austenitic Stainless Steel Forgings
  | "EN-ISO-16810"   // General UT Principles

  // AMS Material-Specific Standards
  | "AMS-2630"       // Products >0.5" thick (general)
  | "AMS-2631"       // Titanium Bar, Billet, Plate
  | "AMS-2632"       // Thin Materials ≤0.5"

  // OEM-Specific Standards (Pratt & Whitney — V2500)
  | "NDIP-1226"      // PW V2500 1st Stage HPT Disk
  | "NDIP-1227"      // PW V2500 2nd Stage HPT Disk

  // OEM-Specific Standards (Pratt & Whitney — PW1100G GTF)
  | "NDIP-1254"      // PW1100G HPT 1st Stage Hub (AUSI)
  | "NDIP-1257"      // PW1100G HPT 2nd Stage Hub (AUSI)
  | "NDIP-1260"      // PW1100G HPC 8th Stage Disc IBR-8 (AUSI)

  // OEM-Specific Standards (Pratt & Whitney — General)
  | "PWA-SIM";       // PWA Sonic Inspection Method (bar, billet, forging)

export type MaterialType = "aluminum" | "steel" | "stainless_steel" | "titanium" | "nickel_alloy" | "magnesium" | "custom";

export type PartGeometry =
  // Basic Geometries (ASTM E2375 Wrought Products)
  | "box"           // Plates, sheets, bars, blocks, billets
  | "cylinder"      // Round bars, shafts, disks
  | "tube"          // Tubes, pipes, rings, sleeves, bushings
  | "rectangular_tube"  // Rectangular & square tubes
  | "hexagon"       // Hex bars
  | "sphere"        // Spheres
  | "cone"          // Cones

  // Additional geometries used by the drawing/CAD subsystems
  | "pyramid"
  | "ellipse"
  | "irregular"

  // Structural profiles / extrusions
  | "l_profile"
  | "t_profile"
  | "i_profile"
  | "u_profile"
  | "z_profile"
  | "z_section"
  | "custom_profile"

  // Extrusion variants used in auto-fill and planning
  | "extrusion_l"
  | "extrusion_t"
  | "extrusion_i"
  | "extrusion_u"
  | "extrusion_channel"
  | "extrusion_angle"

  // Legacy support (will be mapped to base shapes)
  | "plate" | "sheet" | "slab" | "flat_bar" | "rectangular_bar" | "square_bar" | "billet" | "block"
  | "round_bar" | "shaft" | "disk" | "disk_forging" | "hub"
  | "pipe" | "ring" | "ring_forging" | "sleeve" | "bushing" | "square_tube"
  | "hex_bar"
  | "forging" | "round_forging_stock" | "rectangular_forging_stock" | "near_net_forging"
  | "impeller" | "blisk" | "hpt_disk"  // Aero engine complex forgings (stepped profiles, R surfaces)
  | "machined_component" | "bar" | "custom";

export type AcceptanceClass = "AAA" | "AA" | "A" | "B" | "C";

export type CalibrationBlockType = "flat_block" | "curved_block" | "cylinder_notched" | "cylinder_fbh" | "solid_cylinder_fbh" | "angle_beam" | "iiw_block" | "step_wedge" | "iow_block" | "custom";

// Coupling method for scan parameters
export type CouplingMethod = "regular" | "bubbler" | "phased_array";

// Phased Array scan types
export interface PhasedArrayScanTypes {
  sScan?: boolean;
  linearScan?: boolean;
  compoundScan?: boolean;
}

// Phased Array settings (for Scan Parameters tab)
export interface PhasedArraySettings {
  refractedAngleStart?: number;    // Start angle in degrees (e.g., 40°)
  refractedAngleEnd?: number;      // End angle in degrees (e.g., 70°)
  scanTypes?: PhasedArrayScanTypes;
  focusLaws?: string;
  aperture?: number;               // Number of active elements
}

export interface HptDiskGeometryData {
  // Envelope / section control diameters
  rimRootDiameterMm?: number;
  hubOuterDiameterMm?: number;
  webDiameterMm?: number;
  boreEntryDiameterMm?: number;
  boreExitDiameterMm?: number;
  minBoreDiameterMm?: number;

  // Axial section thicknesses / heights
  hubHeightMm?: number;
  rimHeightMm?: number;
  webMinThicknessMm?: number;

  // Angles
  frontFaceAngleDeg?: number;
  rearFaceAngleDeg?: number;
  boreTaperAngleDeg?: number;
  webTransitionAngleDeg?: number;
  serrationFlankAngleDeg?: number;

  // Blend radii / critical corners
  frontFilletRadiusMm?: number;
  rearFilletRadiusMm?: number;
  boreEntryRadiusMm?: number;
  boreBlendRadiusMm?: number;
  rimBlendRadiusMm?: number;
  toothRootRadiusMm?: number;

  // Serration / outer edge features
  serrationCount?: number;
  serrationPitchMm?: number;
  serrationHeightMm?: number;
  serrationTopWidthMm?: number;

  // Inspection-specific reference dimensions
  inspectionBoreRadiusMm?: number;
  inspectionOffsetMm?: number;
  radialCoverageMm?: number;

  // Free-form notes for profile details not covered by fixed fields
  geometryNotes?: string;
  criticalZoneNotes?: string;
}

export interface InspectionSetupData {
  techniqueCardId?: string;  // Technique Card ID for printed reports
  partNumber: string;
  partName: string;
  material: MaterialType | "";
  customMaterialName?: string;
  materialSpec: string;
  partType: PartGeometry | "";
  customShapeDescription?: string;
  customShapeImage?: string; // Image upload for custom shapes
  localModelAssetName?: string; // Optional local STL/3D reference selected from MRO library
  customShapeParameters?: {
    dimension1?: { label: string; value: number };
    dimension2?: { label: string; value: number };
    dimension3?: { label: string; value: number };
    dimension4?: { label: string; value: number };
  };
  partThickness: number;
  partLength: number;
  partWidth: number;
  diameter?: number;
  hptDiskGeometry?: HptDiskGeometryData;
  
  // Hollow/Hole parameters (for tubes, hollow cylinders, etc.)
  isHollow?: boolean;
  innerDiameter?: number;
  innerLength?: number;
  innerWidth?: number;
  wallThickness?: number;

  // Cone-specific parameters
  coneTopDiameter?: number;      // Top diameter (smaller end, 0 = pointed)
  coneBottomDiameter?: number;   // Bottom diameter (base, larger end)
  coneHeight?: number;           // Height of the cone

  // Additional fields for PDF export
  drawingNumber?: string;        // Drawing reference number
  heatTreatment?: string;        // Heat treatment condition
  acousticVelocity?: number;     // Material acoustic velocity (m/s)
  materialDensity?: number;      // Material density (kg/m³)

  // OEM Vendor Selection (for automatic setup generation)
  // Affects calibration requirements, coverage rules, and documentation
  oemVendor?: "GENERIC" | "GE" | "RR" | "PW";
}

export interface EquipmentData {
  manufacturer: string;
  model: string;
  serialNumber: string;
  softwareVersion?: string;        // Software version (for PA equipment)
  probeModel?: string;             // Probe model identifier
  frequency: string;
  transducerType: string;
  transducerTypes?: string[];      // Multi-select transducer types (immersion/contact/dual_element)
  transducerShapeAndSize?: string; // Shape/size category per standard notes
  transducerDiameter: number;
  couplant: string;
  customCouplant?: string;         // Used when couplant option is "custom"
  includeSelectionNotesInReport?: boolean;
  selectionNotes?: string;
  verticalLinearity: number;
  horizontalLinearity: number;
  entrySurfaceResolution: number;
  backSurfaceResolution: number;
  // Phased Array specific fields
  numberOfElements?: number;       // Number of elements in PA probe (e.g., 32, 64)
  elementPitch?: number;           // Distance between elements in mm
  wedgeModel?: string;             // Wedge model identifier

  // Additional fields for PDF export
  wedgeType?: string;              // Type of wedge (e.g., "Normal", "Angled", "Immersion")
  delayLine?: string;              // Delay line specification

  // A/N (Applicable/Not Applicable) flags for Phased Array fields
  numberOfElementsApplicable?: boolean;
  elementPitchApplicable?: boolean;
  wedgeModelApplicable?: boolean;
  wedgeTypeApplicable?: boolean;
  delayLineApplicable?: boolean;
  bandwidth?: 'low' | 'medium' | 'high' | 'narrow' | 'wide';
  focusSize?: string;
  velocity?: number;             // Acoustic velocity (m/s)
  ndipTransducerSerialNumber?: string;
  ndipMirrorSerialNumber?: string;
  ndipChuckRiser?: string;
  ndipMarkingPencil?: string;
}

// FBH Hole data structure for calibration blocks
export interface FBHHoleData {
  id: number;
  partNumber: string;
  deltaType: string;         // Δ type: 'area', 'distance', 'dac', 'tcg', 'ref'
  diameterInch: string;      // ØFBH inch (e.g., "3/64")
  diameterMm: number;        // ØFBH mm (e.g., 1.19)
  blockHeightE: number;      // E - calibration block height (mm)
  metalTravelH: number;      // H - hole depth (mm), equals E for standard FBH blocks
}

export interface CalibrationSensitivityRow {
  id: number;
  reflectorType: 'FBH' | 'SDH';
  reflectorSizeInch: string;
  curvatureCorrection: number;
  gainOffset: number;
  deltaDbTotal: number;
}

export interface StraightBeamConversionRow {
  id: number;
  partNumber: string;
  fbhCalibrationSize: string; // e.g., "3/64"
  fbhRequired: string;        // e.g., "3/64"
  deltaDbNeeded: number;       // auto-calculated: 20*log10(A1/A2)
  transferCorrectionDb: number;
  curvatureCorrectionDb: number;
}

export interface CalibrationData {
  standardType: CalibrationBlockType | "";
  referenceMaterial: string;
  fbhSizes: string;           // Legacy: comma-separated FBH sizes string
  fbhHoles?: FBHHoleData[];   // New: structured FBH hole data array
  metalTravelDistance: number;
  blockDimensions: string;
  blockDimensionsMode?: "flat" | "curve" | "custom";
  curveInnerDiameterMm?: number;
  curveOuterDiameterMm?: number;
  curveWallThicknessMm?: number;
  blockSerialNumber: string;
  blockHolder?: string;
  lastCalibrationDate: string;
  autoRecommendedReason?: string; // NEW: Reason why this block was auto-selected (for tooltip)
  selectedBlockType?: 'curved' | 'flat'; // Block surface type selection for tubes (curved vs flat)
  sensitivityTable?: CalibrationSensitivityRow[];
  customStraightBeamImage?: string; // Base64 data URL for user-uploaded custom calibration block image
  straightBeamConversionTable?: StraightBeamConversionRow[];
  angleBeamCalibrationRows?: AngleBeamCalibrationRow[]; // Angle beam calibration table rows (dB corrections, reflector data)
}

// Technique type for scan parameters
export type TechniqueType = "conventional" | "bubbler" | "squirt" | "phased_array";

export interface ScanParametersData {
  scanMethod: string;
  scanMethods?: string[];          // Multi-select scan methods (IMMERSION, CONTACT)
  technique?: TechniqueType;       // Technique selection (CONVENTIONAL, BUBBLER, SQUIRT, PHASED ARRAY)
  scanType: string;
  scanSpeed: number;
  scanIndex: number;
  coverage: number;
  scanPattern: string;
  waterPath?: number;
  pulseRepetitionRate: number;
  gainSettings: string;
  alarmGateSettings: string;
  // Coupling method (Regular/Bubbler/Phased Array) - Legacy, replaced by technique
  couplingMethod?: CouplingMethod;
  // Phased Array settings (when technique = 'phased_array')
  phasedArray?: PhasedArraySettings;
}

export interface AcceptanceCriteriaData {
  acceptanceClass: string;
  singleDiscontinuity: string;
  multipleDiscontinuities: string;
  linearDiscontinuity: string;
  backReflectionLoss: number;
  noiseLevel: string;
  specialRequirements: string;
  standardNotes?: string;
  includeStandardNotesInReport?: boolean;
}

export interface DocumentationData {
  inspectorName: string;
  inspectorCertification: string;
  inspectorLevel: string;
  certifyingOrganization: string;
  inspectionDate: string;
  procedureNumber: string;
  drawingReference: string;
  revision: string;
  additionalNotes: string;
  approvalRequired: boolean;

  // Additional fields for PDF export
  customerName?: string;           // Customer/client name
  purchaseOrder?: string;          // Purchase order number
  serialNumber?: string;           // Part serial number
}

export interface CalibrationRecommendation {
  standardType: string;
  referenceFigure: string;
  material: string;
  fbhSizes: string[];
  metalTravel: {
    distances: number[];
    tolerance: string;
  };
  frequency: number;
  transducerDiameter: string;
  reasoning: {
    material: string;
    blockType: string;
    fbh: string;
    frequency: string;
    travel: string;
  };
  confidence: number;
  visualization3D: {
    blockDimensions: [number, number, number];
    fbhPositions: Array<{
      size: string;
      depth: number;
      coordinates: [number, number, number];
    }>;
  };
}

export interface TechniqueSheet {
  id: string;
  standardName: StandardType;
  standardVersion: string;
  createdDate: string;
  modifiedDate: string;
  status: "draft" | "complete" | "approved";

  inspectionSetup: InspectionSetupData;
  equipment: EquipmentData;
  calibration: CalibrationData;
  scanParameters: ScanParametersData;
  acceptanceCriteria: AcceptanceCriteriaData;
  documentation: DocumentationData;

  calibrationRecommendation?: CalibrationRecommendation;

  metadata: {
    completionPercent: number;
    lastModifiedBy: string;
  };
}

// Scan Plan Document Types
export interface ScanPlanDocument {
  id: string;
  title: string;
  description: string;
  filePath: string; // Path to PDF file
  category?: string;
  order: number; // For custom ordering
  isActive: boolean;
}

export interface ScanPlanData {
  documents: ScanPlanDocument[];
}

// ============================================================================
// OEM (Original Equipment Manufacturer) Types
// For automatic setup generation per vendor requirements (GE/RR/PW)
// ============================================================================

export type OEMVendor = "GENERIC" | "GE" | "RR" | "PW";

export interface OEMCoverageRequirements {
  minCoverage: number;              // Minimum coverage % (e.g., 95 for GE, 90 standard)
  overlapRequirement: number;       // Required overlap between passes (%)
  criticalZoneMultiplier: number;   // Multiplier for critical zone coverage (e.g., 1.5x)
  edgeExclusion: number;            // Edge exclusion zone in mm
}

export interface OEMFrequencyConstraints {
  min: number;                      // Minimum frequency (MHz)
  max: number;                      // Maximum frequency (MHz)
  preferred: number[];              // Preferred frequency values
}

export interface OEMTransducerSpec {
  id: string;
  manufacturer: string;
  model: string;
  frequency: number;
  diameter: number;
  type: "immersion" | "contact" | "phased_array";
  approved: boolean;
}

export interface OEMCalibrationBlockSpec {
  id: string;
  type: CalibrationBlockType;
  material: string;
  fbhSizes: string[];
  geometry: "flat" | "curved" | "cylindrical";
  approved: boolean;
}

export interface OEMCalibrationRules {
  interval: number;                 // Calibration interval in hours
  temperatureCheckRequired: boolean;
  dacCurveRequired: boolean;
  tcgRequired: boolean;
  transferCorrectionMax: number;    // Max transfer correction in dB
  periodicVerificationHours: number; // Hours between periodic checks
}

export interface OEMDocumentationRules {
  templateId: string;
  requiredSections: string[];
  approvalLevels: number;           // Number of approval signatures required
  language: "english";
  revisionTracking: boolean;
}

export interface OEMRuleSet {
  vendorId: OEMVendor;
  vendorName: string;
  version: string;
  effectiveDate: string;
  specReference: string;            // e.g., "P&W 127", "GE P23TF22"

  // Coverage requirements
  coverageRequirements: OEMCoverageRequirements;

  // Equipment constraints
  frequencyConstraints: OEMFrequencyConstraints;
  approvedTransducers: OEMTransducerSpec[];
  approvedBlocks: OEMCalibrationBlockSpec[];

  // Calibration rules
  calibrationRules: OEMCalibrationRules;

  // Documentation rules
  documentationRules: OEMDocumentationRules;

  // Part-specific rules (keyed by part category)
  partSpecificRules?: Record<string, Partial<OEMRuleSet>>;

  // Warnings and notes
  warnings: string[];
  notes: string[];
}

// ============================================================================
// Patch Planning Types
// For automatic scan patch generation
// ============================================================================

export type ScanStrategy = "raster" | "spiral" | "circumferential" | "bidirectional" | "unidirectional";
export type EdgeHandling = "extend" | "stop" | "reduced_speed" | "overlap";
export type PatchShape = "rectangle" | "arc" | "annular" | "custom";

export interface PatchGeometry {
  shape: PatchShape;
  // For rectangular patches
  x?: number;                       // Start X position (mm)
  y?: number;                       // Start Y position (mm)
  width?: number;                   // Width in mm
  height?: number;                  // Height in mm
  // For arc/annular patches (circular parts)
  startAngle?: number;              // Start angle in degrees
  endAngle?: number;                // End angle in degrees
  innerRadius?: number;             // Inner radius (mm)
  outerRadius?: number;             // Outer radius (mm)
  // For custom patches
  vertices?: Array<{ x: number; y: number }>;
}

export interface ExcludedZone {
  id: string;
  reason: string;                   // e.g., "hole", "feature", "edge", "inaccessible"
  geometry: PatchGeometry;
}

export interface Patch {
  id: string;
  name: string;                     // e.g., "P1", "Bore-Zone-1"
  geometry: PatchGeometry;
  scanStrategy: ScanStrategy;
  direction: string;                // Scan direction reference (A-L)
  waveMode: "longitudinal" | "shear" | "surface";

  // Scan parameters for this patch
  scanSpeed: number;                // mm/s
  scanIndex: number;                // mm (step between passes)
  overlap: {
    previous: number;               // Overlap with previous patch (%)
    next: number;                   // Overlap with next patch (%)
  };
  edgeHandling: EdgeHandling;

  // Coverage metrics
  coverage: number;                 // Achieved coverage (%)
  passes: number;                   // Number of scan passes
  estimatedTime: number;            // Estimated scan time (seconds)

  // Sequence
  sequence: number;                 // Order in scan sequence

  // Status
  status: "planned" | "validated" | "warning" | "error";
  warnings?: string[];
}

export interface PatchPlan {
  id: string;
  version: string;
  createdDate: string;

  // Input parameters used
  partGeometry: PartGeometry;
  coverageTarget: number;           // Target coverage (%)
  overlapRequired: number;          // Required overlap (%)
  oemVendor?: OEMVendor;            // OEM rules applied

  // Generated patches
  patches: Patch[];
  excludedZones: ExcludedZone[];

  // Summary metrics
  totalCoverage: number;            // Total achieved coverage (%)
  totalPatches: number;
  totalPasses: number;
  estimatedTotalTime: number;       // Total scan time (seconds)

  // Validation
  meetsRequirements: boolean;
  validationErrors: string[];
  validationWarnings: string[];

  // Optimization info
  optimizationStrategy: "coverage_first" | "time_first" | "balanced";
  optimizationScore: number;        // 0-100
}

export interface PatchGeneratorInput {
  // Part info
  partGeometry: PartGeometry;
  dimensions: {
    length: number;
    width: number;
    thickness: number;
    outerDiameter?: number;
    innerDiameter?: number;
  };
  material: MaterialType;

  // Coverage requirements
  coverageTarget: number;           // % (default 100)
  overlapRequired: number;          // % (from OEM rules or default 15)

  // Probe info
  probeFootprint: {
    width: number;                  // Effective beam width (mm)
    length: number;                 // Effective beam length (mm)
  };
  frequency: number;                // MHz

  // Constraints
  maxPatchSize?: number;            // Maximum patch dimension (mm)
  maxScanSpeed?: number;            // Maximum scan speed (mm/s)
  excludedZones?: ExcludedZone[];

  // OEM rules (optional)
  oemRules?: OEMRuleSet;
}

// ============================================================================
// DAC/TCG Types
// For Distance-Amplitude Correction and Time-Corrected Gain
// ============================================================================

export interface DACPoint {
  depth: number;                    // Metal travel distance (mm)
  amplitude: number;                // Amplitude (% FSH)
  gain: number;                     // Gain setting (dB)
  fbhSize?: string;                 // FBH size at this point
}

export interface DACCurve {
  id: string;
  name: string;
  material: MaterialType;
  frequency: number;                // MHz
  velocity: number;                 // m/s

  // Reference points
  points: DACPoint[];

  // Calculated values
  attenuation: number;              // Material attenuation (dB/mm)
  transferCorrection: number;       // Block-to-part correction (dB)

  // Curve equation (for documentation)
  equation: string;

  // Thresholds
  recordingLevel: number;           // % of DAC
  rejectionLevel: number;           // % of DAC
}

export interface TCGPoint {
  time: number;                     // Time (μs)
  gain: number;                     // Gain correction (dB)
}

export interface TCGCurve {
  id: string;
  basedOnDAC: string;               // DAC curve ID
  targetAmplitude: number;          // Target amplitude (% FSH, usually 80)

  // TCG points for equipment programming
  points: TCGPoint[];

  // Gate range where TCG applies
  gateStart: number;                // μs
  gateEnd: number;                  // μs

  // Total correction applied
  totalCorrection: number;          // dB
}

// ============================================================================
// Scanner Kinematics & Machine Constraints
// For automatic setup generation - machine capability limits
// ============================================================================

export interface ScannerKinematics {
  // Speed limits
  maxScanSpeed: number;             // Maximum scan speed (mm/s)
  maxIndexSpeed: number;            // Maximum index speed (mm/s)
  maxRotationSpeed?: number;        // For rotary scanners (rpm)

  // Acceleration limits
  maxAcceleration: number;          // Maximum acceleration (mm/s²)
  maxDeceleration: number;          // Maximum deceleration (mm/s²)

  // Position limits
  maxTravel: {
    x: number;                      // X-axis travel (mm)
    y: number;                      // Y-axis travel (mm)
    z: number;                      // Z-axis travel (mm)
  };

  // Geometric limits
  minRadius?: number;               // Minimum curve radius (mm) - for curved surfaces
  maxIncidenceAngle?: number;       // Maximum beam incidence angle (degrees)

  // Tank/fixture limits (for immersion)
  tankDimensions?: {
    length: number;                 // mm
    width: number;                  // mm
    depth: number;                  // mm
  };
}

export interface DwellTimeConstraints {
  minDwellTime: number;             // Minimum time probe must stay at each point (μs)
  maxDwellTime: number;             // Maximum dwell time (μs)
  prfLimit: number;                 // Pulse Repetition Frequency limit (Hz)
}

export interface IncidenceAngleConstraints {
  maxIncidenceAngle: number;        // Maximum beam incidence angle (degrees)
  criticalAngleWarning: number;     // Angle at which to warn (degrees)
  mode: "longitudinal" | "shear";   // Wave mode affects critical angle
}

// ============================================================================
// Block Fallback Rules
// For automatic block selection with alternatives
// ============================================================================

export interface BlockFallbackRule {
  primaryBlockType: CalibrationBlockType;
  fallbackBlockTypes: CalibrationBlockType[];
  conditions: {
    geometry?: PartGeometry[];
    thicknessRange?: { min: number; max: number };
    materialTypes?: MaterialType[];
    requiresApproval?: boolean;     // Level III approval needed for fallback
  };
  reason: string;
}

export interface BlockAvailability {
  blockType: CalibrationBlockType;
  serialNumber: string;
  isAvailable: boolean;
  calibrationStatus: "valid" | "expired" | "due_soon";
  calibrationDueDate?: string;
  location?: string;
}

// ============================================================================
// Techsheet Template Types
// For OEM-specific and site-specific templates
// ============================================================================

export interface TechsheetTemplate {
  id: string;
  name: string;
  oemVendor: OEMVendor;
  siteId?: string;                  // Site-specific template
  machineId?: string;               // Machine-specific template
  templatePath: string;
  language: "english";
  sections: string[];               // Required sections
  logoPath?: string;
  headerText?: string;
  footerText?: string;
}

// ============================================================================
// Validation & Coverage Types
// For patch plan and coverage verification
// ============================================================================

export interface CoverageGap {
  id: string;
  location: PatchGeometry;
  area: number;                     // mm²
  reason: string;                   // e.g., "edge exclusion", "geometry constraint"
  severity: "warning" | "error";
}

export interface CoverageMap {
  resolution: number;               // Grid resolution (mm)
  data: number[][];                 // 2D array of coverage % at each point
  gaps: CoverageGap[];
  totalCoverage: number;            // Overall coverage %
  minCoverage: number;              // Minimum local coverage %
}

export interface PatchValidationResult {
  patchId: string;
  isValid: boolean;
  errors: string[];
  warnings: string[];
  dwellTimeOk: boolean;
  incidenceAngleOk: boolean;
  coverageOk: boolean;
  speedOk: boolean;
}
