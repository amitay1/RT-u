/**
 * Field Dependency Engine for AMS-STD-2154E
 * Implements intelligent field auto-fill based on standard requirements
 */

import { StandardType, MaterialType, AcceptanceClass } from '@/types/techniqueSheet';
import { 
  getRecommendedFrequency, 
  calculateMetalTravel,
  calculateScanIndex,
  getCouplantRecommendation,
  TABLE_VI_ACCEPTANCE_LIMITS,
  GEOMETRY_INSPECTION_RULES
} from '@/utils/enhancedAutoFillLogic';
import { materialDatabase } from '@/utils/enhancedAutoFillLogic';

export interface FieldUpdate {
  field: string;
  value: any;
  reason: string;
  reference: string;
}

export class FieldDependencyEngine {
  private updates: FieldUpdate[] = [];
  private standard: StandardType | null = null;

  setStandard(standard: StandardType) {
    this.standard = standard;
    this.updates = [];

    if (standard === "AMS-STD-2154E") {
      // Set default values per standard
      this.addUpdate('acceptanceClass', 'A', 'Default per AMS-STD-2154E', 'Table VI');
      this.addUpdate('scanCoverage', 100, 'Required 100% coverage', 'Para 8.1.2');
      this.addUpdate('verticalLinearity', { min: 5, max: 98 }, 'Linearity requirements', 'Para 7.3.1');
      this.addUpdate('horizontalLinearity', 90, 'Minimum horizontal linearity', 'Para 7.3.2');
      this.addUpdate('scanSpeed', 150, 'Maximum manual scan speed', 'Para 8.2.4');
      this.addUpdate('pulseRepetitionRate', 1000, 'Standard PRF', 'Para 7.4.1');
    }

    return this.getUpdates();
  }

  onMaterialChange(material: MaterialType, thickness: number) {
    this.updates = [];

    if (this.standard === "AMS-STD-2154E") {
      // Calculate recommended frequency
      const frequency = getRecommendedFrequency(thickness, material);
      this.addUpdate('frequency', frequency, 'Based on material and thickness', 'Table II');

      // Calculate metal travel distance
      const mtd = calculateMetalTravel(thickness);
      this.addUpdate('metalTravelDistance', mtd, '3T rounded to nearest 5mm', 'Para 8.3.1');

      // Calculate near field distance
      const materialProps = materialDatabase[material];
      if (materialProps) {
        const wavelength = materialProps.velocity / parseFloat(frequency);
        const transducerDiameter = 12.7; // Default 0.5"
        const nearField = Math.pow(transducerDiameter, 2) / (4 * wavelength);
        this.addUpdate('nearFieldDistance', nearField.toFixed(1), 'D²/(4λ) calculation', 'Appendix C');
      }

      // Set surface condition requirements
      if (materialProps) {
        this.addUpdate('surfaceCondition', materialProps.surfaceCondition, 
          'Material-specific requirement', 'Table III');
      }
    }

    return this.getUpdates();
  }

  onPartTypeChange(partType: string) {
    this.updates = [];

    if (this.standard === "AMS-STD-2154E" && partType) {
      const rules = GEOMETRY_INSPECTION_RULES[partType as keyof typeof GEOMETRY_INSPECTION_RULES];
      if (rules) {
        // Set scan directions
        this.addUpdate('scanDirections', rules.scanDirection, 
          'Geometry-specific scan pattern', 'Table V');
        
        // Set wave mode
        this.addUpdate('waveMode', rules.waveMode[0], 
          'Recommended wave mode', 'Para 8.1.1');

        // Set special requirements
        if (rules.specialNotes.length > 0) {
          this.addUpdate('specialRequirements', rules.specialNotes.join('; '), 
            'Part-specific considerations', 'Appendix B');
        }

        // Set transducer type
        const transducerType = partType.includes('tube') || partType.includes('cylinder') 
          ? 'immersion' : 'contact';
        this.addUpdate('transducerType', transducerType, 
          'Optimal for geometry', 'Para 7.2.3');
      }
    }

    return this.getUpdates();
  }

  onAcceptanceClassChange(acceptanceClass: AcceptanceClass) {
    this.updates = [];

    if (this.standard === "AMS-STD-2154E" && acceptanceClass) {
      const limits = TABLE_VI_ACCEPTANCE_LIMITS[acceptanceClass];
      if (limits) {
        this.addUpdate('singleDiscontinuity', limits.singleDiscontinuity, 
          'Acceptance limit', 'Table VI');
        this.addUpdate('multipleDiscontinuities', limits.multipleDiscontinuities, 
          'Acceptance limit', 'Table VI');
        this.addUpdate('linearDiscontinuity', limits.linearDiscontinuity, 
          'Linear indication limit', 'Table VI');
        this.addUpdate('backReflectionLoss', limits.backReflectionLoss, 
          'Maximum dB loss', 'Table VI');
        this.addUpdate('noiseLevel', limits.noiseLevel, 
          'Grass height limit', 'Table VI');
        
        if (limits.specialNotes) {
          this.addUpdate('specialNotes', limits.specialNotes, 
            'Material-specific adjustment', 'Table VI Note');
        }
      }

      // Set FBH size based on acceptance class
      const fbhSize = this.getFBHSize(acceptanceClass);
      this.addUpdate('fbhSize', fbhSize, 'Standard reference size', 'Table VI');
    }

    return this.getUpdates();
  }

  onTransducerChange(diameter: number, type: string) {
    this.updates = [];

    if (this.standard === "AMS-STD-2154E") {
      // Calculate scan index (70% overlap default)
      const scanIndex = calculateScanIndex(diameter, 70);
      this.addUpdate('scanIndex', scanIndex, '30% overlap minimum', 'Para 8.2.2');

      // Recommend couplant
      const couplant = getCouplantRecommendation(type);
      this.addUpdate('couplant', couplant, 'Recommended for transducer type', 'Para 7.5');
    }

    return this.getUpdates();
  }

  onThicknessChange(thickness: number, material?: MaterialType) {
    this.updates = [];

    if (this.standard === "AMS-STD-2154E") {
      // Update frequency recommendation
      if (material) {
        const frequency = getRecommendedFrequency(thickness, material);
        this.addUpdate('frequency', frequency, 'Thickness-based selection', 'Table II');
      }

      // Update metal travel distance
      const mtd = calculateMetalTravel(thickness);
      this.addUpdate('metalTravelDistance', mtd, '3T calculation', 'Para 8.3.1');

      // Determine calibration block type
      const blockType = thickness < 50 ? 'flat_block' : 'step_wedge';
      this.addUpdate('calibrationBlockType', blockType, 'Based on thickness', 'Para 9.2');
    }

    return this.getUpdates();
  }

  private getFBHSize(acceptanceClass: AcceptanceClass): string {
    // MIL-STD-2154 / AMS-STD-2154 Table VI (Single discontinuity response reference)
    const fbhMap = {
      'AAA': '#1 (1/64")',
      'AA': '#3 (3/64")',
      'A1': '#3 (3/64")',
      'A': '#5 (5/64")',
      'B': '#8 (8/64")',
      'C': '#8 (8/64")'
    };
    return fbhMap[acceptanceClass] || '#5 (5/64")';
  }

  private addUpdate(field: string, value: any, reason: string, reference: string) {
    this.updates.push({ field, value, reason, reference });
  }

  getUpdates(): FieldUpdate[] {
    return this.updates;
  }

  clearUpdates() {
    this.updates = [];
  }
}

// Singleton instance
export const fieldDependencyEngine = new FieldDependencyEngine();
