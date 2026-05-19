/**
 * Compliance Checker Types
 *
 * Type definitions for the Technique Sheet compliance validation system.
 * Validates that all required fields are filled and values comply with standards.
 */

import type { StandardType } from "./techniqueSheet";

// Severity levels for compliance issues
export type ComplianceSeverity = "critical" | "warning" | "info";

// Categories of compliance rules
export type ComplianceCategory =
  | "setup"           // Part setup & geometry
  | "equipment"       // Equipment configuration
  | "calibration"     // Calibration block & FBH
  | "scan"            // Scan parameters
  | "acceptance"      // Acceptance criteria
  | "documentation"   // Inspector & documentation
  | "standard";       // Standard-specific rules

// Result of a single compliance check
export interface ComplianceResult {
  passed: boolean;
  ruleId: string;
  ruleName: string;
  category: ComplianceCategory;
  severity: ComplianceSeverity;
  message: string;
  field?: string;           // Field path that failed (e.g., "equipment.frequency")
  currentValue?: string;    // Current value that failed
  expectedValue?: string;   // Expected or allowed value
  suggestion?: string;      // How to fix the issue
  standardRef?: string;     // Reference to standard section
}

// Compliance rule definition
export interface ComplianceRule {
  id: string;
  name: string;
  category: ComplianceCategory;
  severity: ComplianceSeverity;
  description: string;
  standards?: StandardType[];  // Which standards this rule applies to (all if undefined)
  check: (data: ComplianceCheckData) => ComplianceResult;
}

// Data structure passed to compliance checker
export interface ComplianceCheckData {
  standard: StandardType;
  inspectionSetup: {
    partNumber: string;
    partName: string;
    material: string;
    materialSpec: string;
    partType: string;
    partThickness: number;
    partLength: number;
    partWidth: number;
    diameter?: number;
    isHollow?: boolean;
    innerDiameter?: number;
    wallThickness?: number;
    acousticVelocity?: number;
  };
  equipment: {
    manufacturer: string;
    model: string;
    serialNumber: string;
    frequency: string;
    transducerType: string;
    transducerDiameter: number;
    couplant: string;
    verticalLinearity: number;
    horizontalLinearity: number;
  };
  calibration: {
    standardType: string;
    referenceMaterial: string;
    fbhSizes: string;
    metalTravelDistance: number;
    blockSerialNumber: string;
    lastCalibrationDate: string;
  };
  scanParameters: {
    scanMethod: string;
    scanType: string;
    scanSpeed: number;
    scanIndex: number;
    coverage: number;
    waterPath?: number;
    pulseRepetitionRate: number;
    gainSettings: string;
    alarmGateSettings: string;
    technique?: string;
  };
  acceptanceCriteria: {
    acceptanceClass: string;
    singleDiscontinuity: string;
    multipleDiscontinuities: string;
    linearDiscontinuity: string;
    backReflectionLoss: number;
    noiseLevel: string;
  };
  documentation: {
    inspectorName: string;
    inspectorCertification: string;
    inspectorLevel: string;
    certifyingOrganization: string;
    inspectionDate: string;
    procedureNumber: string;
    drawingReference: string;
  };
}

// Overall compliance report
export interface ComplianceReport {
  timestamp: string;
  standard: StandardType;
  overallScore: number;          // 0-100
  status: "pass" | "fail" | "warning";
  totalRules: number;
  passedRules: number;
  failedRules: number;
  warningRules: number;
  criticalIssues: ComplianceResult[];
  warnings: ComplianceResult[];
  info: ComplianceResult[];
  canExport: boolean;            // False if any critical issues
  summary: string;
}

// Frequency ranges per standard
export interface FrequencyRange {
  min: number;  // MHz
  max: number;  // MHz
  recommended: number[];
}

export const FREQUENCY_RANGES: Record<StandardType, FrequencyRange> = {
  // Primary Aerospace Standards
  "AMS-STD-2154E": { min: 1, max: 15, recommended: [2.25, 5, 10] },
  "MIL-STD-2154": { min: 1, max: 15, recommended: [2.25, 5, 10] },

  // ASTM Standards
  "ASTM-A388": { min: 1, max: 5, recommended: [1, 2.25, 5] },
  "ASTM-E2375": { min: 1, max: 15, recommended: [2.25, 5, 10] },
  "ASTM-E1001": { min: 2.25, max: 15, recommended: [2.25, 5, 10, 15] },
  "ASTM-E2580": { min: 0.5, max: 20, recommended: [0.5, 2.25, 5, 10, 15] },
  "ASTM-E588": { min: 9.5, max: 10.5, recommended: [10] },
  "ASTM-E127": { min: 1, max: 15, recommended: [5, 10, 15] },
  "ASTM-E164": { min: 1, max: 10, recommended: [2.25, 5] },

  // European Standards (BS EN)
  "BS-EN-10228-3": { min: 1, max: 6, recommended: [2, 4, 5, 6] },
  "BS-EN-10228-4": { min: 0.5, max: 6, recommended: [0.5, 1, 2, 4, 5, 6] },
  "EN-ISO-16810": { min: 0.5, max: 15, recommended: [2, 4, 5] },

  // AMS Material-Specific Standards
  "AMS-2630": { min: 2.25, max: 15, recommended: [2.25, 5, 10] },
  "AMS-2631": { min: 2, max: 10, recommended: [2.25, 5] },  // Titanium specific
  "AMS-2632": { min: 5, max: 25, recommended: [10, 15, 20] },  // Thin materials, higher freq

  // OEM-Specific Standards (Pratt & Whitney)
  "NDIP-1226": { min: 5, max: 5, recommended: [5] },
  "NDIP-1227": { min: 5, max: 5, recommended: [5] },
  "NDIP-1254": { min: 5, max: 5, recommended: [5] },
  "NDIP-1257": { min: 5, max: 5, recommended: [5] },
  "NDIP-1260": { min: 5, max: 5, recommended: [5] },
  "PWA-SIM": { min: 2.25, max: 10, recommended: [5] },
};

// Linearity requirements per standard
export interface LinearityRequirement {
  vertical: number;   // Maximum deviation %
  horizontal: number; // Maximum deviation %
}

export const LINEARITY_REQUIREMENTS: Record<StandardType, LinearityRequirement> = {
  // Primary Aerospace Standards
  "AMS-STD-2154E": { vertical: 5, horizontal: 2 },
  "MIL-STD-2154": { vertical: 5, horizontal: 2 },

  // ASTM Standards
  "ASTM-A388": { vertical: 5, horizontal: 2 },
  "ASTM-E2375": { vertical: 5, horizontal: 2 },
  "ASTM-E1001": { vertical: 5, horizontal: 2 },
  "ASTM-E2580": { vertical: 5, horizontal: 2 },
  "ASTM-E588": { vertical: 5, horizontal: 2 },
  "ASTM-E127": { vertical: 5, horizontal: 2 },
  "ASTM-E164": { vertical: 5, horizontal: 2 },

  // European Standards (BS EN)
  "BS-EN-10228-3": { vertical: 5, horizontal: 2 },
  "BS-EN-10228-4": { vertical: 5, horizontal: 2 },
  "EN-ISO-16810": { vertical: 5, horizontal: 2 },

  // AMS Material-Specific Standards
  "AMS-2630": { vertical: 5, horizontal: 3 },
  "AMS-2631": { vertical: 5, horizontal: 2 },
  "AMS-2632": { vertical: 5, horizontal: 2 },

  // OEM-Specific Standards (Pratt & Whitney)
  "NDIP-1226": { vertical: 2, horizontal: 1 },  // Stricter for critical engine components
  "NDIP-1227": { vertical: 2, horizontal: 1 },  // Stricter for critical engine components
  "NDIP-1254": { vertical: 2, horizontal: 1 },
  "NDIP-1257": { vertical: 2, horizontal: 1 },
  "NDIP-1260": { vertical: 2, horizontal: 1 },
  "PWA-SIM": { vertical: 5, horizontal: 2 },
};

// Calibration date requirements (days)
export const CALIBRATION_MAX_AGE_DAYS = 365;
export const LINEARITY_CHECK_MAX_AGE_DAYS = 90;

// Coverage requirements
export const MINIMUM_COVERAGE_PERCENT = 100;

// PRF calculation constants
export const SOUND_VELOCITY_WATER = 1480; // m/s
export const DEFAULT_PRF_MIN = 100;  // Hz
export const DEFAULT_PRF_MAX = 10000; // Hz
