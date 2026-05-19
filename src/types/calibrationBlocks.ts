/**
 * Calibration Block Type Definitions
 * Based on AMS-STD-2154, ASTM A388, BS EN 10228-3/4 standards
 * 
 * This file defines all calibration block types and their properties
 * for ultrasonic testing based on part geometry and beam type.
 */

import { PartGeometry, AcceptanceClass } from './techniqueSheet';

// ============================================================================
// BEAM TYPES
// ============================================================================

export type BeamType = 'straight' | 'angle';

export type AngleBeamAngle = 45 | 60 | 70;

// ============================================================================
// CALIBRATION BLOCK CATEGORIES
// ============================================================================

/**
 * Standard calibration block categories based on industry standards
 */
export type CalibrationBlockCategory =
  | 'flat_fbh'           // Flat block with FBH (Figure 4 - AMS-STD-2154)
  | 'curved_fbh'         // Curved block with FBH (for curved surfaces)
  | 'cylinder_fbh'       // Cylindrical block with FBH (Figure 6)
  | 'cylinder_notched'   // Cylindrical block with notches (Figure 5)
  | 'step_wedge'         // Step wedge for thickness calibration
  | 'iow_block'          // IOW (Institute of Welding) block
  | 'iiw_v1'             // IIW Type 1 block (angle beam calibration)
  | 'iiw_v2'             // IIW Type 2 block (miniature)
  | 'dsc_block'          // Distance/Sensitivity Calibration block
  | 'aws_block'          // AWS reference block for welds
  | 'custom';            // Custom block configuration

// ============================================================================
// BLOCK TYPE SELECTION (Curved vs Flat)
// ============================================================================

/**
 * Block type option for tubes - curved vs flat selection
 * Used when user needs to choose between recommended and alternative block types
 */
export type BlockTypeSelection = 'curved' | 'flat';

export interface BlockTypeOption {
  /** Block surface type */
  type: BlockTypeSelection;
  /** Display label */
  label: string;
  /** Whether this is the recommended option */
  isRecommended: boolean;
  /** Whether Level III approval is required for this option */
  requiresLevel3Approval: boolean;
  /** Reasoning for the recommendation */
  reasoning?: string;
}

/**
 * Get block type options for a given part OD
 * @param partOD Part outer diameter in mm
 * @returns Array of block type options with recommendations
 */
export function getBlockTypeOptions(partOD: number): BlockTypeOption[] {
  const curvedRecommended = partOD <= 500;

  return [
    {
      type: 'curved',
      label: 'Curved Block',
      isRecommended: curvedRecommended,
      requiresLevel3Approval: !curvedRecommended,
      reasoning: curvedRecommended
        ? `Recommended for OD ≤ 500mm to match part curvature`
        : `Alternative option (requires Level III approval for OD > 500mm)`,
    },
    {
      type: 'flat',
      label: 'Flat Block',
      isRecommended: !curvedRecommended,
      requiresLevel3Approval: curvedRecommended,
      reasoning: !curvedRecommended
        ? `Recommended for OD > 500mm where curvature is negligible`
        : `Alternative option (requires Level III approval for OD ≤ 500mm)`,
    },
  ];
}

// ============================================================================
// FBH (FLAT BOTTOM HOLE) SPECIFICATIONS
// ============================================================================

/**
 * Standard FBH sizes in inches (as used in AMS-STD-2154)
 */
export type FBHSize = 
  | '1/64' | '2/64' | '3/64' | '4/64' | '5/64' 
  | '6/64' | '7/64' | '8/64' | '10/64' | '12/64' | '16/64';

export interface FBHHole {
  size: FBHSize;
  diameterMm: number;
  depthMm: number;
  positionX: number;  // Position relative to block center
  positionY: number;
  label?: string;     // e.g., "#1", "#2", "#3"
}

// ============================================================================
// NOTCH SPECIFICATIONS (for angle beam blocks)
// ============================================================================

export type NotchType = 'rectangular' | 'v_notch' | 'semicircular';

export interface Notch {
  type: NotchType;
  widthMm: number;
  depthMm: number;
  lengthMm: number;
  position: 'id' | 'od' | 'surface';  // Inner diameter, Outer diameter, or surface
  orientationDeg: number;  // 0 = axial, 90 = circumferential
}

// ============================================================================
// SIDE DRILLED HOLE (SDH) SPECIFICATIONS
// ============================================================================

export interface SDHHole {
  diameterMm: number;
  lengthMm: number;
  depthFromSurface: number;
  positionAlongLength: number;
}

// ============================================================================
// CALIBRATION BLOCK SPECIFICATIONS
// ============================================================================

/**
 * Complete specification for a calibration block
 */
export interface CalibrationBlockSpec {
  // Identification
  id: string;
  category: CalibrationBlockCategory;
  standardReference: string;  // e.g., "AMS-STD-2154 Figure 4"
  
  // Block geometry
  geometry: CalibrationBlockGeometry;
  
  // Reference reflectors
  fbhHoles?: FBHHole[];
  sdhHoles?: SDHHole[];
  notches?: Notch[];
  
  // Material requirements
  material: {
    specification: string;
    requiredMatch: 'same' | 'similar' | 'reference';
    surfaceFinish: number;  // Ra in μin
  };
  
  // Applicable geometries (which part types can use this block)
  applicablePartTypes: PartGeometry[];
  
  // Beam type compatibility
  beamTypes: BeamType[];
  angleBeamAngles?: AngleBeamAngle[];
  
  // Visualization data
  visualization: CalibrationBlockVisualization;
}

// ============================================================================
// BLOCK GEOMETRY VARIANTS
// ============================================================================

export interface FlatBlockGeometry {
  type: 'flat';
  lengthMm: number;
  widthMm: number;
  heightMm: number;
  steps?: StepDefinition[];  // For step wedge
}

export interface CylindricalBlockGeometry {
  type: 'cylindrical';
  outerDiameterMm: number;
  innerDiameterMm?: number;  // For hollow cylinders
  lengthMm: number;
}

export interface CurvedBlockGeometry {
  type: 'curved';
  lengthMm: number;
  widthMm: number;
  heightMm: number;
  curveRadiusMm: number;
  curveType: 'convex' | 'concave';
}

export interface IIWBlockGeometry {
  type: 'iiw';
  variant: 'v1' | 'v2';
  lengthMm: number;
  heightMm: number;
  thicknessMm: number;
  radiusMm: number;
  perspexInsert: boolean;
}

export interface StepDefinition {
  position: number;
  thickness: number;
}

export type CalibrationBlockGeometry = 
  | FlatBlockGeometry 
  | CylindricalBlockGeometry 
  | CurvedBlockGeometry 
  | IIWBlockGeometry;

// ============================================================================
// VISUALIZATION DATA
// ============================================================================

export interface CalibrationBlockVisualization {
  // 2D drawing views
  drawing2D: {
    frontView: SVGViewData;
    topView: SVGViewData;
    sideView?: SVGViewData;
    sectionView?: SVGViewData;
  };
  
  // 3D model data
  model3D: {
    vertices: number[][];
    faces: number[][];
    holePositions: { x: number; y: number; z: number; radius: number; depth: number }[];
    notchPositions?: { x: number; y: number; z: number; width: number; depth: number; length: number }[];
  };
  
  // Dimension annotations
  dimensions: DimensionAnnotation[];
}

export interface SVGViewData {
  viewBox: string;
  paths: string[];
  dimensionLines: DimensionLine[];
  labels: TextLabel[];
}

export interface DimensionLine {
  start: { x: number; y: number };
  end: { x: number; y: number };
  offset: number;
  value: string;
  unit: 'mm' | 'inch';
}

export interface TextLabel {
  x: number;
  y: number;
  text: string;
  fontSize: number;
  anchor: 'start' | 'middle' | 'end';
}

export interface DimensionAnnotation {
  type: 'linear' | 'diameter' | 'radius' | 'angle';
  value: number;
  unit: 'mm' | 'inch' | 'deg';
  label: string;
  position: { x: number; y: number; z?: number };
}

// ============================================================================
// GEOMETRY TO BLOCK MAPPING
// ============================================================================

/**
 * Defines which calibration block to use for each part geometry
 * This is the core mapping table based on standards
 */
export interface GeometryBlockMapping {
  partGeometry: PartGeometry;
  beamType: BeamType;
  thicknessRange?: { min: number; max: number };
  diameterRange?: { min: number; max: number };
  recommendedBlock: CalibrationBlockCategory;
  alternativeBlocks?: CalibrationBlockCategory[];
  standardReference: string;
  notes?: string;
}

// ============================================================================
// GEOMETRY GROUPS FOR EASIER MAPPING
// ============================================================================

/**
 * Part geometries grouped by their calibration block requirements
 */
export const GEOMETRY_GROUPS = {
  // Group 1: Flat/Plate geometries - Use Flat FBH Block
  FLAT_PLATE: [
    'plate', 'sheet', 'slab', 'flat_bar', 'rectangular_bar',
    'square_bar', 'bar', 'billet', 'block', 'box'
  ] as PartGeometry[],

  // Group 2: Solid rounds - Use Flat FBH Block (radial inspection)
  SOLID_ROUNDS: [
    'round_bar', 'shaft', 'round_forging_stock', 'cylinder', 'solid_round'
  ] as PartGeometry[],
  
  // Group 4: Disks - Use Flat FBH Block (face inspection)
  DISKS: [
    'disk', 'disk_forging', 'hub', 'impeller', 'blisk', 'hpt_disk'
  ] as PartGeometry[],
  
  // Group 5: Thin-wall tubes/rings - Use Cylinder Notched Block
  THIN_WALL_TUBULAR: [
    'tube', 'pipe', 'hollow_cylinder', 'ring', 'sleeve', 'bushing', 'square_tube', 'rectangular_tube'
  ] as PartGeometry[],
  
  // Group 6: Thick-wall tubes/rings - Use Cylinder FBH Block
  THICK_WALL_TUBULAR: [
    'ring_forging'
  ] as PartGeometry[],
  
  // Group 7: Forgings - Use Flat FBH Block with special considerations
  FORGINGS: [
    'forging', 'rectangular_forging_stock', 'near_net_forging'
  ] as PartGeometry[],
  
  // Group 8: Hex shapes - Use Flat FBH Block (multi-face)
  HEX_SHAPES: [
    'hex_bar', 'hexagon'
  ] as PartGeometry[],
  
  // Group 9: Complex/Custom - Requires special evaluation
  COMPLEX: [
    'sphere', 'cone', 'pyramid', 'ellipse', 'irregular',
    'machined_component', 'custom'
  ] as PartGeometry[]
} as const;

// ============================================================================
// STANDARD BLOCK TEMPLATES
// ============================================================================

/**
 * Pre-defined calibration block templates based on standards
 */
export const STANDARD_BLOCK_TEMPLATES: Record<CalibrationBlockCategory, Partial<CalibrationBlockSpec>> = {
  flat_fbh: {
    category: 'flat_fbh',
    standardReference: 'AMS-STD-2154 Figure 4',
    geometry: {
      type: 'flat',
      lengthMm: 150,
      widthMm: 75,
      heightMm: 50
    },
    beamTypes: ['straight'],
    material: {
      specification: 'Per Table I',
      requiredMatch: 'same',
      surfaceFinish: 125
    }
  },
  
  curved_fbh: {
    category: 'curved_fbh',
    standardReference: 'ASTM A388 - Curved Reference',
    beamTypes: ['straight'],
    material: {
      specification: 'Same as part',
      requiredMatch: 'same',
      surfaceFinish: 125
    }
  },
  
  cylinder_fbh: {
    category: 'cylinder_fbh',
    standardReference: 'AMS-STD-2154 Figure 6',
    beamTypes: ['straight'],
    material: {
      specification: 'Per Table I',
      requiredMatch: 'same',
      surfaceFinish: 125
    }
  },
  
  cylinder_notched: {
    category: 'cylinder_notched',
    standardReference: 'AMS-STD-2154 Figure 5',
    beamTypes: ['straight', 'angle'],
    angleBeamAngles: [45, 60, 70],
    material: {
      specification: 'Per Table I',
      requiredMatch: 'same',
      surfaceFinish: 125
    }
  },
  
  step_wedge: {
    category: 'step_wedge',
    standardReference: 'General Purpose',
    beamTypes: ['straight'],
    material: {
      specification: 'Reference material',
      requiredMatch: 'reference',
      surfaceFinish: 125
    }
  },
  
  iow_block: {
    category: 'iow_block',
    standardReference: 'Institute of Welding',
    beamTypes: ['angle'],
    angleBeamAngles: [45, 60, 70],
    material: {
      specification: 'Carbon steel',
      requiredMatch: 'reference',
      surfaceFinish: 125
    }
  },
  
  iiw_v1: {
    category: 'iiw_v1',
    standardReference: 'IIW Type 1 (ISO 2400)',
    geometry: {
      type: 'iiw',
      variant: 'v1',
      lengthMm: 300,
      heightMm: 100,
      thicknessMm: 25,
      radiusMm: 100,
      perspexInsert: true
    },
    beamTypes: ['angle'],
    angleBeamAngles: [45, 60, 70],
    material: {
      specification: 'Carbon steel',
      requiredMatch: 'reference',
      surfaceFinish: 125
    }
  },
  
  iiw_v2: {
    category: 'iiw_v2',
    standardReference: 'IIW Type 2 (ISO 7963)',
    geometry: {
      type: 'iiw',
      variant: 'v2',
      lengthMm: 75,
      heightMm: 35,
      thicknessMm: 12.5,
      radiusMm: 25,
      perspexInsert: false
    },
    beamTypes: ['angle'],
    angleBeamAngles: [45, 60, 70],
    material: {
      specification: 'Carbon steel',
      requiredMatch: 'reference',
      surfaceFinish: 125
    }
  },
  
  dsc_block: {
    category: 'dsc_block',
    standardReference: 'Distance/Sensitivity Calibration',
    beamTypes: ['straight', 'angle'],
    material: {
      specification: 'Reference material',
      requiredMatch: 'reference',
      surfaceFinish: 125
    }
  },
  
  aws_block: {
    category: 'aws_block',
    standardReference: 'AWS D1.1',
    beamTypes: ['angle'],
    angleBeamAngles: [45, 60, 70],
    material: {
      specification: 'Carbon steel',
      requiredMatch: 'reference',
      surfaceFinish: 125
    }
  },
  
  custom: {
    category: 'custom',
    standardReference: 'Custom per specification',
    beamTypes: ['straight', 'angle'],
    material: {
      specification: 'As specified',
      requiredMatch: 'same',
      surfaceFinish: 125
    }
  }
};

// ============================================================================
// FBH SIZE LOOKUP TABLES (per AMS-STD-2154 Table VI)
// ============================================================================

export interface FBHSizeByThickness {
  thicknessRangeInch: { min: number; max: number };
  thicknessRangeMm: { min: number; max: number };
  fbhSizes: Record<AcceptanceClass, FBHSize[]>;
}

export const FBH_SIZE_TABLE: FBHSizeByThickness[] = [
  {
    thicknessRangeInch: { min: 0.25, max: 0.50 },
    thicknessRangeMm: { min: 6.35, max: 12.7 },
    fbhSizes: {
      // Table VI (Single discontinuity response reference)
      'AAA': ['1/64'],
      'AA': ['3/64'],
      'A1': ['3/64'],
      'A': ['5/64'],
      'B': ['8/64'],
      'C': ['8/64']
    }
  },
  {
    thicknessRangeInch: { min: 0.50, max: 1.00 },
    thicknessRangeMm: { min: 12.7, max: 25.4 },
    fbhSizes: {
      // Table VI (Single discontinuity response reference)
      'AAA': ['1/64'],
      'AA': ['3/64'],
      'A1': ['3/64'],
      'A': ['5/64'],
      'B': ['8/64'],
      'C': ['8/64']
    }
  },
  {
    thicknessRangeInch: { min: 1.00, max: 2.00 },
    thicknessRangeMm: { min: 25.4, max: 50.8 },
    fbhSizes: {
      // Table VI (Single discontinuity response reference)
      'AAA': ['1/64'],
      'AA': ['3/64'],
      'A1': ['3/64'],
      'A': ['5/64'],
      'B': ['8/64'],
      'C': ['8/64']
    }
  },
  {
    thicknessRangeInch: { min: 2.00, max: 4.00 },
    thicknessRangeMm: { min: 50.8, max: 101.6 },
    fbhSizes: {
      // Table VI (Single discontinuity response reference)
      'AAA': ['1/64'],
      'AA': ['3/64'],
      'A1': ['3/64'],
      'A': ['5/64'],
      'B': ['8/64'],
      'C': ['8/64']
    }
  },
  {
    thicknessRangeInch: { min: 4.00, max: Infinity },
    thicknessRangeMm: { min: 101.6, max: Infinity },
    fbhSizes: {
      // Table VI (Single discontinuity response reference)
      'AAA': ['1/64'],
      'AA': ['3/64'],
      'A1': ['3/64'],
      'A': ['5/64'],
      'B': ['8/64'],
      'C': ['8/64']
    }
  }
];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Convert FBH size string to millimeters
 */
export function fbhSizeToMm(size: FBHSize): number {
  const [numerator, denominator] = size.split('/').map(Number);
  const inches = numerator / denominator;
  return inches * 25.4;
}

/**
 * Get the geometry group for a given part type
 */
export function getGeometryGroup(partType: PartGeometry): keyof typeof GEOMETRY_GROUPS | null {
  for (const [groupName, geometries] of Object.entries(GEOMETRY_GROUPS)) {
    if ((geometries as readonly PartGeometry[]).includes(partType)) {
      return groupName as keyof typeof GEOMETRY_GROUPS;
    }
  }
  return null;
}

/**
 * Determine if a tubular part is thin-wall based on wall thickness
 */
export function isThinWall(outerDiameter: number, innerDiameter: number): boolean {
  const wallThickness = (outerDiameter - innerDiameter) / 2;
  const ratio = wallThickness / outerDiameter;
  // Typically thin-wall is considered when t/D < 0.1 (10%)
  return ratio < 0.1 && wallThickness < 25; // thin-wall: both ratio <10% AND wall <25mm
}
