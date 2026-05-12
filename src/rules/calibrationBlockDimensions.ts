/**
 * Calibration Block Dimensions Calculator
 *
 * Calculates exact calibration block dimensions based on:
 * - Part geometry (plate, tube, cylinder, disk, etc.)
 * - Part dimensions (thickness, OD, ID, wall thickness)
 * - Standard requirements (AMS, ASTM, BS-EN, P&W NDIP, etc.)
 * - FBH/Notch specifications
 *
 * DATA SOURCE: All FBH tables and acceptance criteria are read from:
 * - standards/processed/mil-std-2154.json (AMS-STD-2154E / MIL-STD-2154)
 * - standards/processed/astm-a388.json (ASTM A388)
 * - standards/processed/bs-en-10228-3.json (BS EN 10228-3)
 * - standards/processed/bs-en-10228-4.json (BS EN 10228-4)
 * - src/data/standardsDifferences.ts (Acceptance classes)
 */

import type { StandardType } from '@/types/techniqueSheet';

// Import JSON data from standards (Vite handles JSON imports)
import milStd2154Data from '@/../standards/processed/mil-std-2154.json';
import astmA388Data from '@/../standards/processed/astm-a388.json';
import bsEn10228_3Data from '@/../standards/processed/bs-en-10228-3.json';
import bsEn10228_4Data from '@/../standards/processed/bs-en-10228-4.json';

// ============================================================================
// TYPES
// ============================================================================

export interface PartDimensions {
  thickness?: number;      // mm - for plates, forgings
  length?: number;         // mm
  width?: number;          // mm
  outerDiameter?: number;  // mm - for tubes, cylinders
  innerDiameter?: number;  // mm - for tubes
  wallThickness?: number;  // mm - for tubes (calculated or provided)
}

export interface CalibrationBlockDimensions {
  // Block body dimensions
  length: number;          // mm
  width: number;           // mm
  height: number;          // mm (thickness)

  // Tolerances
  lengthTolerance: string;
  widthTolerance: string;
  heightTolerance: string;

  // For curved blocks
  outerDiameter?: number;  // mm
  innerDiameter?: number;  // mm
  arcAngle?: number;       // degrees (for partial cylinder blocks)

  // Surface finish
  surfaceFinishRa: number; // μm (Ra)
  surfaceFinishNote: string;
}

export interface NotchDimensions {
  type: 'rectangular' | 'v-notch' | 'u-notch' | 'edm';
  depth: number;           // mm
  depthPercent: number;    // % of wall thickness
  width: number;           // mm
  length: number;          // mm

  // For V-notch
  angle?: number;          // degrees

  // Location
  location: 'OD_axial' | 'OD_circumferential' | 'ID_axial' | 'ID_circumferential';

  // Tolerances
  depthTolerance: string;
  widthTolerance: string;
  lengthTolerance: string;
}

export interface FBHSpecification {
  diameter: number;        // mm
  diameterInch: string;    // fractional inch (e.g., "3/64")
  fbhNumber: number;       // #1, #2, #3, etc.
  depths: number[];        // mm - array of depths
  depthsInch: string[];    // inch equivalents
  flatBottomDiameter: number; // mm - actual flat bottom
  drillingAngle: number;   // degrees (usually 0 for perpendicular)
}

export interface CalibrationBlockSpecification {
  // Identification
  blockType: string;
  standardReference: string;
  figureReference?: string;

  // Physical dimensions
  dimensions: CalibrationBlockDimensions;

  // FBH specifications
  fbhSpecs: FBHSpecification;

  // Notch specifications (for tube/pipe blocks)
  notches?: NotchDimensions[];

  // Material
  material: {
    name: string;
    specification: string;
    acousticVelocity: number;    // m/s
    acousticImpedance: number;   // MRayl
  };

  // Metadata
  calculationBasis: string;
  warnings: string[];
  notes: string[];
}

export type CalculatedBlockType =
  | 'flat_fbh'
  | 'cylinder_notched'
  | 'cylinder_fbh'
  | 'curved_fbh'
  | 'custom';

export type PartGeometry =
  | 'plate' | 'sheet' | 'bar' | 'block' | 'billet' | 'slab'
  | 'tube' | 'pipe' | 'hollow_cylinder' | 'ring' | 'sleeve'
  | 'cylinder' | 'round_bar' | 'shaft' | 'solid_round'
  | 'disk' | 'hub' | 'impeller' | 'blisk' | 'hpt_disk'
  | 'forging' | 'ring_forging' | 'near_net_forging'
  | 'hex_bar' | 'hexagon'
  | 'sphere' | 'cone' | 'pyramid'
  | 'custom';

// ============================================================================
// DATA LOADERS - Read from project JSON files
// ============================================================================

/**
 * Parse MIL-STD-2154 / AMS-STD-2154E FBH Table I data
 * Source: standards/processed/mil-std-2154.json
 */
function parseMilStd2154FBHTable(): Record<string, Record<string, number>> {
  const tableData = milStd2154Data.tables?.tableI?.data || [];
  const result: Record<string, Record<string, number>> = {};

  // Parse each row from the JSON
  tableData.forEach((row: {
    thicknessRange: string;
    classAAA: string;
    classAA: string;
    classA: string;
    classB: string;
    classC: string;
  }) => {
    // Convert thickness range to mm key
    // e.g., "0.25-0.50 inches" -> "6.35-12.7" (mm)
    const thicknessKey = convertInchRangeToMmKey(row.thicknessRange);

    // Parse FBH sizes - extract the fraction (e.g., "1/64" from "1/64 inch (0.4 mm)")
    result[thicknessKey] = {
      'AAA': parseFBHFraction(row.classAAA),
      'AA': parseFBHFraction(row.classAA),
      'A': parseFBHFraction(row.classA),
      'B': parseFBHFraction(row.classB),
      'C': parseFBHFraction(row.classC),
    };
  });

  return result;
}

/**
 * ASTM A388 uses its own FBH numbering that differs from ASTM E127 (/64" convention):
 *   A388 #1 = 1/16" = 4/64" (E127 FBH #4)
 *   A388 #2 = 1/8"  = 8/64" (E127 FBH #8)
 *   A388 #3 = 1/4"  = 16/64" (E127 FBH #16)
 */
const ASTM_A388_FBH_TO_E127: Record<number, number> = {
  1: 4,   // 1/16" = 4/64"
  2: 8,   // 1/8"  = 8/64"
  3: 16,  // 1/4"  = 16/64"
};
const ASTM_A388_E127_SIZES = [4, 8, 16]; // ordered standard A388 FBH sizes in E127 notation

/**
 * Parse ASTM A388 FBH data
 * Source: standards/processed/astm-a388.json
 */
function parseAstmA388FBHTable(): Record<string, Record<string, number>> {
  const fbhData = astmA388Data.fbhSizes?.data || [];
  const result: Record<string, Record<string, number>> = {};

  // ASTM A388 has thickness-based FBH (not class-based)
  // We map to QL1-QL4 industry convention
  fbhData.forEach((row: {
    thicknessRange: string;
    fbhSize: string;
    fbhNumber: string;
  }) => {
    const thicknessKey = convertAstmThicknessToMmKey(row.thicknessRange);
    const a388Num = parseInt(row.fbhNumber.replace('#', ''));
    // Convert A388 numbering to ASTM E127 /64" FBH number
    const fbhNum = ASTM_A388_FBH_TO_E127[a388Num] || (a388Num * 4);

    // ASTM A388 S1 is the base FBH - QL1-4 are industry conventions
    // QL1 = base reference FBH, QL2-4 = progressively less stringent (next standard sizes)
    const baseIndex = ASTM_A388_E127_SIZES.indexOf(fbhNum);
    result[thicknessKey] = {
      'QL1': fbhNum,
      'QL2': ASTM_A388_E127_SIZES[Math.min(baseIndex + 1, ASTM_A388_E127_SIZES.length - 1)],
      'QL3': ASTM_A388_E127_SIZES[Math.min(baseIndex + 2, ASTM_A388_E127_SIZES.length - 1)],
      'QL4': ASTM_A388_E127_SIZES[ASTM_A388_E127_SIZES.length - 1], // Per agreement, use largest
    };
  });

  return result;
}

/**
 * Parse BS EN 10228-3 reference reflectors
 * Source: standards/processed/bs-en-10228-3.json
 */
function parseBsEn10228_3Data(): Record<string, Record<string, number>> {
  // BS EN 10228-3 uses reference FBH diameters: 3mm, 5mm, 8mm
  // Quality Class 4 = most stringent, Class 1 = least stringent
  const refReflectors = bsEn10228_3Data.referenceReflectors?.flatBottomHoles;

  // BS EN uses EFBH (Equivalent FBH) concept
  // Convert mm to FBH number (64ths of inch)
  const mmToFBHNum = (mm: number) => Math.round((mm / 25.4) * 64);

  // Default sizes from the standard: 3mm, 5mm, 8mm
  const sizes = refReflectors?.diameters?.map((d: string) => parseInt(d)) || [3, 5, 8];

  return {
    '0-25': { '4': mmToFBHNum(sizes[0] || 3), '3': mmToFBHNum(sizes[0] || 3), '2': mmToFBHNum(sizes[1] || 5), '1': mmToFBHNum(sizes[2] || 8) },
    '25-50': { '4': mmToFBHNum(sizes[0] || 3), '3': mmToFBHNum(sizes[1] || 5), '2': mmToFBHNum(sizes[1] || 5), '1': mmToFBHNum(sizes[2] || 8) },
    '50-100': { '4': mmToFBHNum(sizes[1] || 5), '3': mmToFBHNum(sizes[1] || 5), '2': mmToFBHNum(sizes[2] || 8), '1': mmToFBHNum(sizes[2] || 8) },
    '100-200': { '4': mmToFBHNum(sizes[1] || 5), '3': mmToFBHNum(sizes[2] || 8), '2': mmToFBHNum(sizes[2] || 8), '1': 12 },
    '200+': { '4': mmToFBHNum(sizes[2] || 8), '3': mmToFBHNum(sizes[2] || 8), '2': 12, '1': 12 },
  };
}

/**
 * Parse BS EN 10228-4 reference reflectors (for austenitic steels)
 * Source: standards/processed/bs-en-10228-4.json
 * Note: Only 3 quality classes (Class 3 = most stringent)
 */
function parseBsEn10228_4Data(): Record<string, Record<string, number>> {
  // BS EN 10228-4 - adapted for austenitic materials with coarse grain
  // Uses larger reflector sizes due to grain scatter
  const mmToFBHNum = (mm: number) => Math.round((mm / 25.4) * 64);

  return {
    '0-25': { '3': mmToFBHNum(3), '2': mmToFBHNum(5), '1': mmToFBHNum(5) },
    '25-50': { '3': mmToFBHNum(5), '2': mmToFBHNum(5), '1': mmToFBHNum(8) },
    '50-100': { '3': mmToFBHNum(5), '2': mmToFBHNum(8), '1': mmToFBHNum(8) },
    '100-200': { '3': mmToFBHNum(8), '2': mmToFBHNum(8), '1': 12 },
    '200+': { '3': mmToFBHNum(8), '2': 12, '1': 12 },
  };
}

// ============================================================================
// HELPER FUNCTIONS FOR PARSING JSON DATA
// ============================================================================

/**
 * Convert inch range string to mm key
 * e.g., "0.25-0.50 inches" -> "6.35-12.7"
 */
function convertInchRangeToMmKey(inchRange: string): string {
  // Handle ">4.00 inches" case
  if (inchRange.startsWith('>')) {
    return '101.6+';
  }

  // Extract numbers from string like "0.25-0.50 inches"
  const match = inchRange.match(/(\d+\.?\d*)-(\d+\.?\d*)/);
  if (!match) return '0-25';

  const minInch = parseFloat(match[1]);
  const maxInch = parseFloat(match[2]);
  const minMm = Math.round(minInch * 25.4 * 10) / 10;
  const maxMm = Math.round(maxInch * 25.4 * 10) / 10;

  return `${minMm}-${maxMm}`;
}

/**
 * Convert ASTM A388 thickness description to mm key
 */
function convertAstmThicknessToMmKey(desc: string): string {
  // "Up to 1.5 inches (38 mm)" -> "0-38"
  // "1.5 to 6.0 inches (38 to 152 mm)" -> "38-152"
  // "Over 6.0 inches (152 mm)" -> "152+"

  if (desc.toLowerCase().includes('up to')) {
    const match = desc.match(/\((\d+)\s*mm\)/);
    return match ? `0-${match[1]}` : '0-38';
  }
  if (desc.toLowerCase().includes('over')) {
    const match = desc.match(/\((\d+)\s*mm\)/);
    return match ? `${match[1]}+` : '152+';
  }
  // Range: "38 to 152 mm"
  const match = desc.match(/\((\d+)\s*to\s*(\d+)\s*mm\)/);
  if (match) {
    return `${match[1]}-${match[2]}`;
  }
  return '0-38';
}

/**
 * Parse FBH fraction from string like "1/64 inch (0.4 mm)"
 * Returns the FBH number (numerator when denominator is 64)
 */
function parseFBHFraction(fbhString: string): number {
  // Extract fraction like "1/64" or "3/64"
  const match = fbhString.match(/(\d+)\/64/);
  if (match) {
    return parseInt(match[1]);
  }

  // Try to extract mm value and convert
  const mmMatch = fbhString.match(/\((\d+\.?\d*)\s*mm\)/);
  if (mmMatch) {
    const mm = parseFloat(mmMatch[1]);
    return Math.round((mm / 25.4) * 64);
  }

  return 3; // Default #3 FBH
}

// ============================================================================
// BUILD FBH TABLES FROM JSON DATA
// ============================================================================

/**
 * Build complete FBH lookup table from all standards JSON files
 */
function buildFBHTablesFromJSON(): Record<string, Record<string, Record<string, number>>> {
  return {
    'AMS-STD-2154E': parseMilStd2154FBHTable(),
    'MIL-STD-2154': parseMilStd2154FBHTable(),
    'ASTM-E2375': parseMilStd2154FBHTable(), // Uses same table as AMS
    'ASTM-A388': parseAstmA388FBHTable(),
    'BS-EN-10228-3': parseBsEn10228_3Data(),
    'BS-EN-10228-4': parseBsEn10228_4Data(),
  };
}

// Build the tables once at module load
const FBH_SIZES_BY_STANDARD = buildFBHTablesFromJSON();

// ============================================================================
// CONSTANTS FROM JSON DATA
// ============================================================================

/**
 * Minimum block dimensions by standard
 * Derived from standards requirements
 */
const MIN_BLOCK_DIMENSIONS: Record<string, { length: number; width: number; height: number }> = {
  'AMS-STD-2154E': { length: 76.2, width: 50.8, height: 25.4 },      // 3" x 2" x 1"
  'MIL-STD-2154': { length: 76.2, width: 50.8, height: 25.4 },
  'ASTM-A388': { length: 101.6, width: 76.2, height: 38.1 },         // 4" x 3" x 1.5"
  'ASTM-E2375': { length: 76.2, width: 50.8, height: 25.4 },
  // NOTE: ASTM E127 uses cylindrical blocks (2" / 50.8mm diameter solid aluminum).
  // These rectangular dims are an approximation for layout purposes only.
  'ASTM-E127': { length: 50.8, width: 50.8, height: 50.8 },  // 2" dia cylinder
  'BS-EN-10228-3': { length: 100, width: 75, height: 40 },           // Metric
  'BS-EN-10228-4': { length: 100, width: 75, height: 40 },
  'ASME-V': { length: 152.4, width: 50.8, height: 25.4 },            // 6" x 2" x 1"
  'NDIP-1226': { length: 203.2, width: 62.97, height: 27.56 },       // P&W specific
  'NDIP-1227': { length: 203.2, width: 62.97, height: 27.56 },
  'DEFAULT': { length: 76.2, width: 50.8, height: 25.4 },
};

/**
 * Block thickness multipliers based on part thickness
 */
const THICKNESS_MULTIPLIERS = {
  min: 1.0,
  preferred: 1.25,
  max: 2.0,
};

/**
 * Surface finish requirements - extracted from JSON standards
 */
function getSurfaceFinishFromStandard(standard: string): { ra: number; note: string } {
  // MIL-STD-2154 calibration requirements
  if (standard === 'AMS-STD-2154E' || standard === 'MIL-STD-2154') {
    const calReq = milStd2154Data.requirements?.calibration as { surfaceFinish?: string } | undefined;
    return {
      ra: 3.2, // 125 μin standard
      note: calReq?.surfaceFinish || '125 μin (3.2 μm) Ra max',
    };
  }

  // ASTM A388
  if (standard === 'ASTM-A388') {
    const surfacePrep = astmA388Data.scanningProcedure?.surfacePreparation;
    return {
      ra: 6.3,
      note: surfacePrep?.roughness || '250 μin (6.3 μm) Ra max',
    };
  }

  // BS EN 10228-3
  if (standard === 'BS-EN-10228-3') {
    const surfacePrep = bsEn10228_3Data.testLimitations?.surfaceCondition;
    return {
      ra: 6.3,
      note: surfacePrep?.roughness || 'Ra ≤ 6.3 μm (12.5 μm max)',
    };
  }

  // BS EN 10228-4
  if (standard === 'BS-EN-10228-4') {
    const surfacePrep = bsEn10228_4Data.scanningProcedure?.surfacePreparation;
    return {
      ra: 6.3,
      note: surfacePrep?.roughness || 'Ra ≤ 6.3 μm preferred',
    };
  }

  // P&W NDIP - most stringent
  if (standard.startsWith('NDIP')) {
    return {
      ra: 1.6,
      note: '63 μin (1.6 μm) Ra max - aerospace grade',
    };
  }

  return {
    ra: 3.2,
    note: '125 μin (3.2 μm) Ra typical',
  };
}

/**
 * Notch requirements by standard (for tubes/pipes)
 */
const NOTCH_REQUIREMENTS: Record<string, {
  depthPercent: number;
  depthMin: number;
  depthMax: number;
  width: number;
  length: number;
  type: 'rectangular' | 'v-notch' | 'edm';
}> = {
  'AMS-STD-2154E': {
    depthPercent: 10,
    depthMin: 0.25,
    depthMax: 2.54,
    width: 1.0,
    length: 12.7,
    type: 'edm',
  },
  'ASME-V': {
    depthPercent: 10,
    depthMin: 1.0,
    depthMax: 2.54,
    width: 1.0,
    length: 25.4,
    type: 'edm',
  },
  'BS-EN-10228-3': {
    depthPercent: 3,
    depthMin: 0.5,
    depthMax: 3.0,
    width: 1.0,
    length: 10.0,
    type: 'rectangular',
  },
  'BS-EN-10228-4': {
    depthPercent: 3,
    depthMin: 0.5,
    depthMax: 3.0,
    width: 1.0,
    length: 10.0,
    type: 'rectangular',
  },
  'ASTM-A388': {
    depthPercent: 5,
    depthMin: 0.5,
    depthMax: 3.0,
    width: 1.5,
    length: 15.0,
    type: 'rectangular',
  },
  'DEFAULT': {
    depthPercent: 10,
    depthMin: 0.5,
    depthMax: 2.54,
    width: 1.0,
    length: 12.7,
    type: 'edm',
  },
};

/**
 * Reference materials by part material
 */
const REFERENCE_MATERIALS: Record<string, {
  name: string;
  specification: string;
  velocity: number;
  impedance: number;
}> = {
  'aluminum': {
    name: 'Aluminum 7075-T6',
    specification: 'QQ-A-200/11 or AMS 4045',
    velocity: 6320,
    impedance: 17.1,
  },
  'steel': {
    name: 'Steel 4340 (Annealed)',
    specification: 'MIL-S-5000 or AMS 6415',
    velocity: 5920,
    impedance: 46.5,
  },
  'stainless': {
    name: 'Stainless 17-4 PH (H1025)',
    specification: 'AMS 5643',
    velocity: 5740,
    impedance: 44.5,
  },
  'stainless_steel': {
    name: 'Stainless 17-4 PH (H1025)',
    specification: 'AMS 5643',
    velocity: 5740,
    impedance: 44.5,
  },
  'titanium': {
    name: 'Titanium Ti-6Al-4V (Annealed)',
    specification: 'AMS 4928',
    velocity: 6100,
    impedance: 27.3,
  },
  'nickel_alloy': {
    name: 'Inconel 718',
    specification: 'AMS 5662',
    velocity: 5820,
    impedance: 47.8,
  },
  'magnesium': {
    name: 'Magnesium ZK60A',
    specification: 'QQ-M-31 or AMS 4352',
    velocity: 5770,
    impedance: 10.4,
  },
  'copper': {
    name: 'Copper C11000',
    specification: 'ASTM B152',
    velocity: 4660,
    impedance: 41.6,
  },
  'inconel': {
    name: 'Inconel 625',
    specification: 'AMS 5666',
    velocity: 5820,
    impedance: 49.1,
  },
  'waspaloy': {
    name: 'Waspaloy',
    specification: 'AMS 5704',
    velocity: 5700,
    impedance: 47.0,
  },
  'DEFAULT': {
    name: 'Reference Block Material',
    specification: 'Per applicable standard',
    velocity: 5900,
    impedance: 45.0,
  },
};

// ============================================================================
// MAIN CALCULATION FUNCTIONS
// ============================================================================

/**
 * Calculate complete calibration block specification
 */
export function calculateCalibrationBlockSpec(
  partGeometry: PartGeometry,
  partDimensions: PartDimensions,
  standard: StandardType | string,
  acceptanceClass: string,
  partMaterial: string = 'steel',
  blockTypeOverride?: string
): CalibrationBlockSpecification {
  const warnings: string[] = [];
  const notes: string[] = [];

  // Determine block type based on geometry
  const normalizedBlockTypeOverride = normalizeBlockTypeOverride(blockTypeOverride);
  const blockType = normalizedBlockTypeOverride || determineBlockType(partGeometry, partDimensions);

  // Calculate dimensions
  const dimensions = calculateBlockDimensions(
    partGeometry,
    partDimensions,
    standard,
    blockType
  );

  // Calculate FBH specifications
  const fbhSpecs = calculateFBHSpec(
    partGeometry,
    partDimensions,
    standard,
    acceptanceClass
  );

  // Calculate notches for notched-cylinder blocks and tubular geometries.
  // Use derived wall thickness when explicit wall thickness is not provided.
  let notches: NotchDimensions[] | undefined;
  const derivedWallThickness =
    partDimensions.wallThickness ||
    (partDimensions.outerDiameter && partDimensions.innerDiameter
      ? (partDimensions.outerDiameter - partDimensions.innerDiameter) / 2
      : undefined);
  const notchOuterDiameter = partDimensions.outerDiameter || dimensions.outerDiameter;
  const requiresNotches = blockType === 'cylinder_notched' || isTubularGeometry(partGeometry);

  if (requiresNotches && derivedWallThickness && notchOuterDiameter) {
    notches = calculateNotchDimensions(derivedWallThickness, notchOuterDiameter, standard);
  } else if (blockType === 'cylinder_notched') {
    warnings.push('Notch dimensions could not be fully calculated: missing wall thickness or outer diameter.');
  }

  // Get material specification
  const material = getReferenceMaterial(partMaterial);

  // Add warnings based on conditions
  if (partDimensions.thickness && partDimensions.thickness > 150) {
    warnings.push('Thick section (>150mm): Consider multiple calibration points');
  }
  if (partMaterial === 'stainless' || partMaterial === 'austenitic') {
    warnings.push('Austenitic material: Verify grain structure does not affect calibration');
    if (standard !== 'BS-EN-10228-4') {
      warnings.push('Consider using BS EN 10228-4 for austenitic materials');
    }
  }
  if (isTubularGeometry(partGeometry) && partDimensions.wallThickness && partDimensions.wallThickness < 3) {
    warnings.push('Thin wall (<3mm): Consider through-transmission or specialized technique');
  }

  // Add notes about data source
  notes.push(`Block material should match or acoustically simulate ${material.name}`);
  notes.push('All dimensions in millimeters unless otherwise noted');
  notes.push(`FBH data sourced from ${standard} standard specification`);
  if (fbhSpecs.depths.length > 1) {
    notes.push(`DAC curve required with ${fbhSpecs.depths.length} calibration points`);
  }

  return {
    blockType,
    standardReference: standard,
    figureReference: getFigureReference(blockType, standard),
    dimensions,
    fbhSpecs,
    notches,
    material,
    calculationBasis: `Calculated per ${standard} requirements using project standard data`,
    warnings,
    notes,
  };
}

/**
 * Determine block type based on geometry
 */
function determineBlockType(geometry: PartGeometry, dimensions: PartDimensions): string {
  // Tubular geometries
  if (isTubularGeometry(geometry)) {
    const wall = dimensions.wallThickness ||
      (dimensions.outerDiameter && dimensions.innerDiameter
        ? (dimensions.outerDiameter - dimensions.innerDiameter) / 2
        : 10);

    if (wall < 25) {
      return 'cylinder_notched';
    }
    return 'cylinder_fbh';
  }

  // Solid rounds
  if (['cylinder', 'round_bar', 'shaft', 'solid_round'].includes(geometry)) {
    if (dimensions.outerDiameter && dimensions.outerDiameter < 50) {
      return 'curved_fbh';
    }
    return 'flat_fbh';
  }

  // Disks and rotors
  if (['disk', 'hub', 'impeller', 'blisk', 'hpt_disk'].includes(geometry)) {
    return 'flat_fbh';
  }

  // Flat geometries
  if (['plate', 'sheet', 'bar', 'block', 'billet', 'slab', 'forging'].includes(geometry)) {
    return 'flat_fbh';
  }

  // Complex geometries
  if (['sphere', 'cone', 'pyramid'].includes(geometry)) {
    return 'custom';
  }

  return 'flat_fbh';
}

function normalizeBlockTypeOverride(blockTypeOverride?: string): CalculatedBlockType | null {
  if (!blockTypeOverride) {
    return null;
  }

  switch (blockTypeOverride) {
    case 'flat_fbh':
    case 'cylinder_notched':
    case 'cylinder_fbh':
    case 'curved_fbh':
    case 'custom':
      return blockTypeOverride;
    default:
      return null;
  }
}

/**
 * Resolve controlling thickness for block sizing/FBH depth calculations.
 * Tubular parts must be based on wall thickness, not full section height.
 */
function resolveInspectionThickness(
  geometry: PartGeometry,
  partDimensions: PartDimensions
): number {
  const derivedWall =
    partDimensions.wallThickness ||
    (partDimensions.outerDiameter && partDimensions.innerDiameter
      ? (partDimensions.outerDiameter - partDimensions.innerDiameter) / 2
      : undefined);

  if (isTubularGeometry(geometry) && derivedWall && derivedWall > 0) {
    return derivedWall;
  }

  if (partDimensions.thickness && partDimensions.thickness > 0) {
    return partDimensions.thickness;
  }

  if (derivedWall && derivedWall > 0) {
    return derivedWall;
  }

  return 25;
}

/**
 * Calculate block physical dimensions
 */
function calculateBlockDimensions(
  geometry: PartGeometry,
  partDimensions: PartDimensions,
  standard: StandardType | string,
  blockType: string
): CalibrationBlockDimensions {
  const minDims = MIN_BLOCK_DIMENSIONS[standard] || MIN_BLOCK_DIMENSIONS['DEFAULT'];
  const surfaceReq = getSurfaceFinishFromStandard(standard);

  const partThickness = resolveInspectionThickness(geometry, partDimensions);

  let blockHeight = Math.max(
    minDims.height,
    partThickness * THICKNESS_MULTIPLIERS.preferred
  );

  blockHeight = roundToStandardSize(blockHeight);

  let blockLength = Math.max(minDims.length, partThickness * 3);
  let blockWidth = Math.max(minDims.width, partThickness * 2);

  let outerDiameter: number | undefined;
  let innerDiameter: number | undefined;
  let arcAngle: number | undefined;

  if (blockType === 'curved_fbh' || blockType === 'cylinder_notched' || blockType === 'cylinder_fbh') {
    if (partDimensions.outerDiameter) {
      outerDiameter = partDimensions.outerDiameter;

      if (partDimensions.wallThickness) {
        innerDiameter = outerDiameter - (partDimensions.wallThickness * 2);
      }

      arcAngle = 90;
      blockLength = Math.max(minDims.length, outerDiameter * 0.5);
    }
  }

  blockLength = roundToStandardSize(blockLength);
  blockWidth = roundToStandardSize(blockWidth);

  return {
    length: blockLength,
    width: blockWidth,
    height: blockHeight,
    lengthTolerance: '±0.5mm',
    widthTolerance: '±0.5mm',
    heightTolerance: '±0.25mm',
    outerDiameter,
    innerDiameter,
    arcAngle,
    surfaceFinishRa: surfaceReq.ra,
    surfaceFinishNote: surfaceReq.note,
  };
}

/**
 * Calculate FBH specification using data from JSON files
 */
function calculateFBHSpec(
  geometry: PartGeometry,
  partDimensions: PartDimensions,
  standard: StandardType | string,
  acceptanceClass: string
): FBHSpecification {
  const thickness = resolveInspectionThickness(geometry, partDimensions);

  // Get FBH number from the loaded JSON tables
  const fbhNumber = getFBHNumber(standard, thickness, acceptanceClass);

  const diameterInch = fbhNumber / 64;
  const diameterMm = diameterInch * 25.4;

  // Get metal travel distances from MIL-STD-2154 formula
  const depthMultipliers = getMetalTravelMultipliers(thickness, standard);
  const depths = depthMultipliers.map(m => Math.round(thickness * m * 10) / 10);
  const depthsInch = depths.map(d => `${(d / 25.4).toFixed(3)}"`);

  return {
    diameter: Math.round(diameterMm * 100) / 100,
    diameterInch: `${fbhNumber}/64"`,
    fbhNumber,
    depths,
    depthsInch,
    flatBottomDiameter: Math.round(diameterMm * 100) / 100,
    drillingAngle: 0,
  };
}

/**
 * Calculate notch dimensions for tubes/pipes
 */
function calculateNotchDimensions(
  wallThickness: number,
  outerDiameter: number,
  standard: StandardType | string
): NotchDimensions[] {
  const req = NOTCH_REQUIREMENTS[standard] || NOTCH_REQUIREMENTS['DEFAULT'];

  let notchDepth = wallThickness * (req.depthPercent / 100);
  notchDepth = Math.max(req.depthMin, Math.min(req.depthMax, notchDepth));
  notchDepth = Math.round(notchDepth * 100) / 100;

  const notchWidth = req.width;
  const notchLength = req.length;

  const notches: NotchDimensions[] = [
    {
      type: req.type,
      depth: notchDepth,
      depthPercent: (notchDepth / wallThickness) * 100,
      width: notchWidth,
      length: notchLength,
      location: 'OD_axial',
      depthTolerance: '±0.05mm',
      widthTolerance: '±0.1mm',
      lengthTolerance: '±0.5mm',
    },
    {
      type: req.type,
      depth: notchDepth,
      depthPercent: (notchDepth / wallThickness) * 100,
      width: notchWidth,
      length: notchLength,
      location: 'OD_circumferential',
      depthTolerance: '±0.05mm',
      widthTolerance: '±0.1mm',
      lengthTolerance: '±0.5mm',
    },
    {
      type: req.type,
      depth: notchDepth,
      depthPercent: (notchDepth / wallThickness) * 100,
      width: notchWidth,
      length: notchLength,
      location: 'ID_axial',
      depthTolerance: '±0.05mm',
      widthTolerance: '±0.1mm',
      lengthTolerance: '±0.5mm',
    },
    {
      type: req.type,
      depth: notchDepth,
      depthPercent: (notchDepth / wallThickness) * 100,
      width: notchWidth,
      length: notchLength,
      location: 'ID_circumferential',
      depthTolerance: '±0.05mm',
      widthTolerance: '±0.1mm',
      lengthTolerance: '±0.5mm',
    },
  ];

  return notches;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function isTubularGeometry(geometry: PartGeometry): boolean {
  return ['tube', 'pipe', 'hollow_cylinder', 'ring', 'sleeve', 'ring_forging'].includes(geometry);
}

/**
 * Get FBH number from loaded JSON tables
 */
function getFBHNumber(
  standard: StandardType | string,
  thickness: number,
  acceptanceClass: string
): number {
  // PW NDIP procedures (1226/1227/1254/1257/1260) use fixed #1 FBH.
  if (typeof standard === "string" && standard.startsWith("NDIP-")) {
    return 1;
  }

  // PWA-SIM uses fixed 3/64 FBH as the primary reference.
  if (standard === "PWA-SIM") {
    return 3;
  }

  // Get FBH table for standard
  const fbhTable = FBH_SIZES_BY_STANDARD[standard] || FBH_SIZES_BY_STANDARD['AMS-STD-2154E'];

  if (!fbhTable) {
    console.warn(`No FBH table found for standard ${standard}, using default`);
    return 3;
  }

  // Find thickness range
  for (const range of Object.keys(fbhTable)) {
    const [min, max] = parseThicknessRange(range);

    if (range.endsWith('+')) {
      if (thickness >= min) {
        return fbhTable[range][acceptanceClass] || 3;
      }
    } else if (thickness >= min && thickness < max) {
      return fbhTable[range][acceptanceClass] || 3;
    }
  }

  // If no match, find the closest range
  const ranges = Object.keys(fbhTable);
  if (ranges.length > 0) {
    // Try last range (largest thickness)
    const lastRange = ranges[ranges.length - 1];
    return fbhTable[lastRange][acceptanceClass] || 3;
  }

  return 3; // Default #3 FBH
}

/**
 * Parse thickness range string to [min, max] values in mm
 */
function parseThicknessRange(range: string): [number, number] {
  if (range.endsWith('+')) {
    const min = parseFloat(range.replace('+', ''));
    return [min, Infinity];
  }

  const parts = range.split('-');
  if (parts.length === 2) {
    return [parseFloat(parts[0]) || 0, parseFloat(parts[1]) || Infinity];
  }

  return [0, Infinity];
}

/**
 * Get metal travel multipliers using MIL-STD-2154 formula
 * Formula: MTD = 3T rounded to nearest 5mm
 */
function getMetalTravelMultipliers(thickness: number, standard: string): number[] {
  // Use formula from MIL-STD-2154 if available
  if (milStd2154Data.formulas?.metalTravelDistance) {
    // MTD = 3T rounded to nearest 5mm
    // Return fractions for depth calculation
    if (thickness <= 6.35) {
      return [1]; // T only
    } else if (thickness <= 12.7) {
      return [0.5, 1]; // T/2, T
    } else if (thickness <= 25.4) {
      return [0.25, 0.5, 0.75]; // T/4, T/2, 3T/4
    } else if (thickness <= 50.8) {
      return [0.25, 0.5, 0.75, 1]; // T/4, T/2, 3T/4, T
    } else {
      return [0.25, 0.5, 0.75, 1]; // Standard pattern
    }
  }

  return [0.25, 0.5, 0.75]; // Default: T/4, T/2, 3T/4
}

function getReferenceMaterial(partMaterial: string): {
  name: string;
  specification: string;
  acousticVelocity: number;
  acousticImpedance: number;
} {
  const material = REFERENCE_MATERIALS[partMaterial.toLowerCase()] || REFERENCE_MATERIALS['DEFAULT'];
  return {
    name: material.name,
    specification: material.specification,
    acousticVelocity: material.velocity,
    acousticImpedance: material.impedance,
  };
}

function getFigureReference(blockType: string, standard: StandardType | string): string {
  const figureMap: Record<string, Record<string, string>> = {
    'flat_fbh': {
      'AMS-STD-2154E': 'Figure 4',
      'ASTM-E2375': 'Figure 4',
      'ASTM-A388': 'Figure 1',
      'BS-EN-10228-3': 'Figure A.1',
      'BS-EN-10228-4': 'Figure A.1',
      'DEFAULT': 'See applicable standard',
    },
    'cylinder_notched': {
      'AMS-STD-2154E': 'Figure 5',
      'ASME-V': 'Figure T-434.2.1',
      'DEFAULT': 'See applicable standard',
    },
    'cylinder_fbh': {
      'AMS-STD-2154E': 'Figure 6',
      'DEFAULT': 'See applicable standard',
    },
    'curved_fbh': {
      'AMS-STD-2154E': 'Figure 7',
      'DEFAULT': 'See applicable standard',
    },
  };

  return figureMap[blockType]?.[standard] || figureMap[blockType]?.['DEFAULT'] || 'See applicable standard';
}

function roundToStandardSize(value: number): number {
  const increment = 5;
  return Math.ceil(value / increment) * increment;
}

// ============================================================================
// EXPORT UTILITY FUNCTIONS
// ============================================================================

/**
 * Get all notch requirements for a standard
 */
export function getNotchRequirements(standard: StandardType | string): typeof NOTCH_REQUIREMENTS['DEFAULT'] {
  return NOTCH_REQUIREMENTS[standard] || NOTCH_REQUIREMENTS['DEFAULT'];
}

/**
 * Get FBH size table for a standard (loaded from JSON)
 */
export function getFBHSizeTable(standard: StandardType | string): Record<string, Record<string, number>> | null {
  return FBH_SIZES_BY_STANDARD[standard] || null;
}

/**
 * Get minimum block dimensions for a standard
 */
export function getMinBlockDimensions(standard: StandardType | string): { length: number; width: number; height: number } {
  return MIN_BLOCK_DIMENSIONS[standard] || MIN_BLOCK_DIMENSIONS['DEFAULT'];
}

/**
 * Get surface finish requirements for a standard
 */
export function getSurfaceFinishRequirements(standard: StandardType | string): { ra: number; note: string } {
  return getSurfaceFinishFromStandard(standard);
}

/**
 * Calculate FBH diameter in mm from FBH number
 */
export function fbhNumberToMm(fbhNumber: number): number {
  return (fbhNumber / 64) * 25.4;
}

/**
 * Calculate FBH number from diameter in mm
 */
export function mmToFbhNumber(diameterMm: number): number {
  return Math.round((diameterMm / 25.4) * 64);
}

/**
 * Get loaded standards data summary (for debugging)
 */
export function getLoadedStandardsInfo(): Record<string, { source: string; thicknessRanges: string[] }> {
  return {
    'AMS-STD-2154E': {
      source: 'standards/processed/mil-std-2154.json',
      thicknessRanges: Object.keys(FBH_SIZES_BY_STANDARD['AMS-STD-2154E'] || {}),
    },
    'ASTM-A388': {
      source: 'standards/processed/astm-a388.json',
      thicknessRanges: Object.keys(FBH_SIZES_BY_STANDARD['ASTM-A388'] || {}),
    },
    'BS-EN-10228-3': {
      source: 'standards/processed/bs-en-10228-3.json',
      thicknessRanges: Object.keys(FBH_SIZES_BY_STANDARD['BS-EN-10228-3'] || {}),
    },
    'BS-EN-10228-4': {
      source: 'standards/processed/bs-en-10228-4.json',
      thicknessRanges: Object.keys(FBH_SIZES_BY_STANDARD['BS-EN-10228-4'] || {}),
    },
  };
}
