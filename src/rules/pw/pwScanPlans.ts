/**
 * Pratt & Whitney Scan Plans
 *
 * Source: NDIP-1226 Section 7.0 (Figure 2)
 * Source: NDIP-1227 Section 7.0 (Figure 2)
 *
 * V2500 HPT Disk Off-Wing Immersion UT Scan Plans
 */

import { PW_V2500_PARTS } from './pwRuleSet';
import { PW_HPT_TRANSDUCER_SETUP } from './pwTransducers';

/**
 * Scan direction for circumferential shear wave inspection
 */
export type ScanDirection = 'positive' | 'negative';

/**
 * Surface profile shape type - derived from NDIP Figure 2 cross-section
 */
export type ProfileShapeType = 'arc' | 'line' | 'chamfer';

/**
 * Surface profile shape definition
 */
export interface ProfileShape {
  type: ProfileShapeType;
  notes: string;
}

/**
 * Individual scan zone (physical inspection surface) in the bore area.
 *
 * IMPORTANT: Each zone represents a distinct physical surface on the disk
 * cross-section. Every surface is scanned in BOTH +45° and -45° shear wave
 * modes (two separate circumferential scans per surface).
 */
export interface ScanZone {
  id: string;
  surfaceName: string;           // Physical surface name per NDIP Figure 2
  description: string;           // Detailed description
  profileShape: ProfileShape;    // Surface geometry type from Figure 2
  refractedAngle: number;        // degrees (always 45 for V2500 NDIP)
  scanModes: ScanDirection[];    // Both '+45' and '-45' for each surface
  coverageRequired: number;      // inches - radial volumetric
  /** @deprecated Use scanModes instead. Kept for backward compatibility. */
  direction: ScanDirection;
}

/**
 * Complete scan plan for a part
 */
export interface PWScanPlan {
  partNumber: string;
  ndipReference: string;
  description: string;
  inspectionType: 'bore' | 'web' | 'rim' | 'full';
  waveType: 'shear' | 'longitudinal';
  boreRadius: number; // inches - nominal
  boreOffset: number; // inches - for angle generation
  minRadialCoverage: number; // inches
  maxScanIncrement: number; // inches
  maxIndexIncrement: number; // inches per revolution
  waterPath: number; // inches
  scanZones: ScanZone[];
  specialInstructions: string[];
}

/**
 * V2500 1st Stage HPT Disk Scan Plan
 * Per NDIP-1226 Section 7.1, Figure 2
 */
export const PW_V2500_STAGE1_SCAN_PLAN: PWScanPlan = {
  partNumber: PW_V2500_PARTS.hptStage1.partNumber,
  ndipReference: 'NDIP-1226 Rev F',
  description: 'V2500 1st Stage HPT Disk Bore Inspection',
  inspectionType: 'bore',
  waveType: 'shear',
  boreRadius: PW_V2500_PARTS.hptStage1.boreRadius,
  boreOffset: PW_V2500_PARTS.hptStage1.boreOffset,
  minRadialCoverage: 2.6, // inches (Section 7.1.3)
  maxScanIncrement: 0.02, // inches (Section 7.2)
  maxIndexIncrement: 0.02, // inches per revolution (Section 7.3)
  waterPath: PW_HPT_TRANSDUCER_SETUP.waterPath,

  // From NDIP-1226 Figure 2 — each zone is a physical surface, scanned in both ±45°.
  // Surface order in cross-section (left to right): E → A → B → C → D
  scanZones: [
    {
      id: 'E',
      surfaceName: 'Upper Web Transition',
      description: 'Curved fillet/arc transition from web to hub (upper left in Figure 2)',
      profileShape: { type: 'arc', notes: 'Upper fillet, curved transition from web toward bore' },
      refractedAngle: PW_HPT_TRANSDUCER_SETUP.refractedAngle,
      scanModes: ['positive', 'negative'],
      direction: 'positive', // deprecated
      coverageRequired: 2.6,
    },
    {
      id: 'A',
      surfaceName: 'Upper Chamfer',
      description: 'Short straight chamfer between surface E and land B',
      profileShape: { type: 'chamfer', notes: 'Short angled segment connecting E to B' },
      refractedAngle: PW_HPT_TRANSDUCER_SETUP.refractedAngle,
      scanModes: ['positive', 'negative'],
      direction: 'positive', // deprecated
      coverageRequired: 2.6,
    },
    {
      id: 'B',
      surfaceName: 'Upper Land',
      description: 'Flat horizontal land at top of hub between A and C',
      profileShape: { type: 'line', notes: 'Horizontal flat surface at top of bore hub' },
      refractedAngle: PW_HPT_TRANSDUCER_SETUP.refractedAngle,
      scanModes: ['positive', 'negative'],
      direction: 'positive', // deprecated
      coverageRequired: 2.6,
    },
    {
      id: 'C',
      surfaceName: 'Bore Entry Chamfer',
      description: 'Short straight chamfer from land B down to bore ID surface D',
      profileShape: { type: 'chamfer', notes: 'Short angled segment connecting B to bore ID D' },
      refractedAngle: PW_HPT_TRANSDUCER_SETUP.refractedAngle,
      scanModes: ['positive', 'negative'],
      direction: 'positive', // deprecated
      coverageRequired: 2.6,
    },
    {
      id: 'D',
      surfaceName: 'Bore ID',
      description: 'Bore inner diameter — vertical cylindrical wall (rightmost in Figure 2)',
      profileShape: { type: 'line', notes: 'Vertical wall representing bore ID cylinder in cross-section' },
      refractedAngle: PW_HPT_TRANSDUCER_SETUP.refractedAngle,
      scanModes: ['positive', 'negative'],
      direction: 'positive', // deprecated
      coverageRequired: 2.6,
    },
  ],

  specialInstructions: [
    'Edge signals excluded from evaluation area (Section 7.8.1)',
    'Verify mirror is fully seated on transducer (Section 7.6)',
    'Normalize on inspection surface before scanning (Section 7.7)',
    'Record any indication ≥20%FSH (Section 7.9.3)',
    'Check for air bubbles under web before inspection (Section 4.3.3.2)',
  ],
};

/**
 * V2500 2nd Stage HPT Disk Scan Plan
 * Per NDIP-1227 Section 7.1, Figure 2
 */
export const PW_V2500_STAGE2_SCAN_PLAN: PWScanPlan = {
  partNumber: PW_V2500_PARTS.hptStage2.partNumber,
  ndipReference: 'NDIP-1227 Rev D',
  description: 'V2500 2nd Stage HPT Disk Bore Inspection',
  inspectionType: 'bore',
  waveType: 'shear',
  boreRadius: PW_V2500_PARTS.hptStage2.boreRadius,
  boreOffset: PW_V2500_PARTS.hptStage2.boreOffset,
  minRadialCoverage: 2.6, // inches (Section 7.1.3)
  maxScanIncrement: 0.02, // inches (Section 7.2)
  maxIndexIncrement: 0.02, // inches per revolution (Section 7.3)
  waterPath: PW_HPT_TRANSDUCER_SETUP.waterPath,

  // From NDIP-1227 Figure 2 — each zone is a physical surface, scanned in both ±45°.
  // Upper profile (left to right): M → N → O → P (bore ID)
  // Lower profile (left to right): K → L
  scanZones: [
    {
      id: 'M',
      surfaceName: 'Upper Web Transition (Large Arc)',
      description: 'Large curved transition from web to hub — upper left in Figure 2',
      profileShape: { type: 'arc', notes: 'Long arc/spline, major upper transition toward bore' },
      refractedAngle: PW_HPT_TRANSDUCER_SETUP.refractedAngle,
      scanModes: ['positive', 'negative'],
      direction: 'positive', // deprecated
      coverageRequired: 2.6,
    },
    {
      id: 'N',
      surfaceName: 'Upper Shoulder Fillet',
      description: 'Small arc/fillet between M and land O — shoulder area',
      profileShape: { type: 'arc', notes: 'Short rounded fillet at shoulder before upper land' },
      refractedAngle: PW_HPT_TRANSDUCER_SETUP.refractedAngle,
      scanModes: ['positive', 'negative'],
      direction: 'positive', // deprecated
      coverageRequired: 2.6,
    },
    {
      id: 'O',
      surfaceName: 'Upper Land',
      description: 'Flat horizontal land at top of hub between N and bore ID P',
      profileShape: { type: 'line', notes: 'Horizontal flat surface at top of bore hub' },
      refractedAngle: PW_HPT_TRANSDUCER_SETUP.refractedAngle,
      scanModes: ['positive', 'negative'],
      direction: 'positive', // deprecated
      coverageRequired: 2.6,
    },
    {
      id: 'P',
      surfaceName: 'Bore ID',
      description: 'Bore inner diameter — vertical cylindrical wall (rightmost in Figure 2)',
      profileShape: { type: 'line', notes: 'Vertical wall representing bore ID cylinder in cross-section' },
      refractedAngle: PW_HPT_TRANSDUCER_SETUP.refractedAngle,
      scanModes: ['positive', 'negative'],
      direction: 'positive', // deprecated
      coverageRequired: 2.6,
    },
    {
      id: 'K',
      surfaceName: 'Lower Fillet Transition',
      description: 'Curved fillet/arc in lower bore area — transition from web to lower hub',
      profileShape: { type: 'arc', notes: 'Lower curved fillet transition' },
      refractedAngle: PW_HPT_TRANSDUCER_SETUP.refractedAngle,
      scanModes: ['positive', 'negative'],
      direction: 'positive', // deprecated
      coverageRequired: 2.6,
    },
    {
      id: 'L',
      surfaceName: 'Lower Diagonal Slope',
      description: 'Straight diagonal surface below K — angled toward bore step/shoulder',
      profileShape: { type: 'line', notes: 'Diagonal straight segment after lower fillet K' },
      refractedAngle: PW_HPT_TRANSDUCER_SETUP.refractedAngle,
      scanModes: ['positive', 'negative'],
      direction: 'positive', // deprecated
      coverageRequired: 2.6,
    },
  ],

  specialInstructions: [
    'Edge signals excluded from evaluation area (Section 7.8.1)',
    'Verify mirror is fully seated on transducer (Section 7.6)',
    'Normalize on inspection surface before scanning (Section 7.7)',
    'Record any indication ≥20%FSH (Section 7.9.3)',
    'Check for air bubbles under web before inspection (Section 4.3.3.2)',
  ],
};

/**
 * All V2500 scan plans
 */
export const PW_V2500_SCAN_PLANS: PWScanPlan[] = [
  PW_V2500_STAGE1_SCAN_PLAN,
  PW_V2500_STAGE2_SCAN_PLAN,
];

export const PW_V2500_SIGNAL_RULES = {
  referenceReflector: '#1 FBH (1/64")',
  calibrationTargetFsh: 80,
  evaluationFloorFsh: 15,
  recordableIndicationFsh: 20,
  averageNoiseLimitFsh: 7.5,
  bandNoiseLimitFsh: 8.5,
  postCalibrationToleranceDb: 1,
} as const;

export function getV2500ScanPlanForStandard(
  standard?: string | null
): PWScanPlan | null {
  if (standard === 'NDIP-1226') return PW_V2500_STAGE1_SCAN_PLAN;
  if (standard === 'NDIP-1227') return PW_V2500_STAGE2_SCAN_PLAN;
  return null;
}

export function getV2500PassCount(scanPlan: PWScanPlan): number {
  return scanPlan.scanZones.reduce(
    (count, zone) => count + zone.scanModes.length,
    0
  );
}

/**
 * Get scan plan by part number
 */
export function getScanPlanByPN(partNumber: string): PWScanPlan | undefined {
  return PW_V2500_SCAN_PLANS.find((sp) => sp.partNumber === partNumber);
}

/**
 * Calculate total scan coverage
 */
export function calculateTotalCoverage(scanPlan: PWScanPlan): {
  circumferential: number; // degrees
  radial: number; // inches
  axial: number; // inches (index travel)
} {
  return {
    circumferential: 360, // Full revolution
    radial: scanPlan.minRadialCoverage,
    axial: scanPlan.minRadialCoverage / Math.sin((45 * Math.PI) / 180), // Projected axial
  };
}

/**
 * Estimate scan time based on parameters
 */
export function estimateScanTime(
  scanPlan: PWScanPlan,
  rotationSpeed: number = 10, // rpm
  numberOfZones: number = scanPlan.scanZones.length
): {
  estimatedMinutes: number;
  revolutionsPerZone: number;
  totalRevolutions: number;
} {
  // Calculate revolutions needed per zone
  const radialSteps = scanPlan.minRadialCoverage / scanPlan.maxIndexIncrement;
  const revolutionsPerZone = Math.ceil(radialSteps);

  const totalRevolutions = revolutionsPerZone * numberOfZones;
  const estimatedMinutes = totalRevolutions / rotationSpeed;

  return {
    estimatedMinutes: Math.ceil(estimatedMinutes),
    revolutionsPerZone,
    totalRevolutions,
  };
}

/**
 * Disk preparation requirements
 * Per NDIP Section 6.0
 */
export const DISK_PREPARATION = {
  cleaning: 'Disk must be clean and free of foreign material or marking',
  startPosition: '12 o\'clock or 0 degrees',
  serialNumberLocation: 'Rear surface of blade attachment tang',
  markingTool: 'PMC-4059 approved marking pencil',
  turntablePosition: 'Set 12 o\'clock at 0.0 degrees',
  airBubbleCheck: 'Check and remove air bubbles from all inspection surfaces',
};
