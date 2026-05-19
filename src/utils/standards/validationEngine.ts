/**
 * Real-time Validation Engine for AMS-STD-2154E Compliance
 */

import { StandardType, MaterialType, AcceptanceClass } from '@/types/techniqueSheet';
import { standardRules, materialDatabase } from '@/utils/enhancedAutoFillLogic';

export interface ValidationResult {
  isValid: boolean;
  level: 'error' | 'warning' | 'info' | 'success';
  message: string;
  suggestion?: string;
  reference?: string;
}

export interface FieldValidation {
  field: string;
  value: any;
  result: ValidationResult;
}

export class ValidationEngine {
  private standard: StandardType | null = null;
  private validations: Map<string, ValidationResult> = new Map();

  setStandard(standard: StandardType) {
    this.standard = standard;
    this.validations.clear();
  }

  validateFrequency(frequency: number, thickness: number, material?: MaterialType): ValidationResult {
    if (this.standard !== "AMS-STD-2154E") {
      return { isValid: true, level: 'success', message: 'Valid frequency' };
    }

    // Calculate recommended frequency
    let recommended: number;
    if (thickness < 12.7) recommended = 10.0;
    else if (thickness < 25.4) recommended = 5.0;
    else if (thickness < 50.8) recommended = 2.25;
    else recommended = 1.0;

    // Adjust for material attenuation
    if (material && materialDatabase[material]) {
      const attenuation = materialDatabase[material].attenuation;
      if (attenuation > 5) recommended *= 0.5;
      else if (attenuation > 3) recommended *= 0.75;
    }

    const diff = Math.abs(frequency - recommended);
    
    if (diff < 0.5) {
      return {
        isValid: true,
        level: 'success',
        message: 'Frequency optimal for thickness',
        reference: 'Table II'
      };
    } else if (diff < 2) {
      return {
        isValid: true,
        level: 'warning',
        message: `Consider ${recommended} MHz for better penetration`,
        suggestion: `Standard recommends ${recommended} MHz for ${thickness}mm thickness`,
        reference: 'Table II'
      };
    } else {
      return {
        isValid: false,
        level: 'error',
        message: `Frequency not suitable for thickness`,
        suggestion: `Use ${recommended} MHz for ${thickness}mm per AMS-STD-2154E`,
        reference: 'Table II'
      };
    }
  }

  validateScanSpeed(speed: number, isManual: boolean): ValidationResult {
    if (this.standard !== "AMS-STD-2154E") {
      return { isValid: true, level: 'success', message: 'Valid scan speed' };
    }

    const maxSpeed = isManual ? 150 : 300;

    if (speed <= maxSpeed) {
      return {
        isValid: true,
        level: 'success',
        message: 'Scan speed within limits',
        reference: 'Para 8.2.4'
      };
    } else {
      return {
        isValid: false,
        level: 'error',
        message: `Speed exceeds ${maxSpeed} mm/s limit`,
        suggestion: `Reduce to ≤${maxSpeed} mm/s for ${isManual ? 'manual' : 'automated'} scanning`,
        reference: 'Para 8.2.4'
      };
    }
  }

  validateLinearity(vertical: { min: number; max: number }, horizontal: number): ValidationResult {
    if (this.standard !== "AMS-STD-2154E") {
      return { isValid: true, level: 'success', message: 'Valid linearity' };
    }

    const errors: string[] = [];
    
    if (vertical.min > 5) {
      errors.push(`Vertical min should be ≤5% (currently ${vertical.min}%)`);
    }
    if (vertical.max < 98) {
      errors.push(`Vertical max should be ≥98% (currently ${vertical.max}%)`);
    }
    if (horizontal < 90) {
      errors.push(`Horizontal should be ≥90% (currently ${horizontal}%)`);
    }

    if (errors.length === 0) {
      return {
        isValid: true,
        level: 'success',
        message: 'Equipment linearity meets requirements',
        reference: 'Para 7.3'
      };
    } else {
      return {
        isValid: false,
        level: 'error',
        message: 'Linearity out of specification',
        suggestion: errors.join('; '),
        reference: 'Para 7.3'
      };
    }
  }

  validateCoverage(coverage: number, acceptanceClass: AcceptanceClass): ValidationResult {
    if (this.standard !== "AMS-STD-2154E") {
      return { isValid: true, level: 'success', message: 'Valid coverage' };
    }

    if (coverage === 100) {
      return {
        isValid: true,
        level: 'success',
        message: 'Full coverage achieved',
        reference: 'Para 8.1.2'
      };
    } else if (coverage >= 90 && acceptanceClass === 'C') {
      return {
        isValid: true,
        level: 'warning',
        message: 'Coverage acceptable for Class C',
        suggestion: 'Consider 100% for critical areas',
        reference: 'Para 8.1.2'
      };
    } else {
      return {
        isValid: false,
        level: 'error',
        message: `Coverage must be 100% for Class ${acceptanceClass}`,
        suggestion: 'Increase scan overlap to achieve 100% coverage',
        reference: 'Para 8.1.2'
      };
    }
  }

  validateMetalTravel(mtd: number, thickness: number): ValidationResult {
    if (this.standard !== "AMS-STD-2154E") {
      return { isValid: true, level: 'success', message: 'Valid metal travel' };
    }

    const required = thickness * 3;
    const rounded = Math.round(required / 5) * 5;

    if (Math.abs(mtd - rounded) < 5) {
      return {
        isValid: true,
        level: 'success',
        message: 'Metal travel distance correct (3T)',
        reference: 'Para 8.3.1'
      };
    } else if (mtd >= required) {
      return {
        isValid: true,
        level: 'warning',
        message: `Consider standard value: ${rounded}mm`,
        suggestion: `Standard specifies 3T = ${rounded}mm`,
        reference: 'Para 8.3.1'
      };
    } else {
      return {
        isValid: false,
        level: 'error',
        message: `MTD must be ≥3T (${required}mm)`,
        suggestion: `Increase to ${rounded}mm per standard`,
        reference: 'Para 8.3.1'
      };
    }
  }

  validateAcceptanceCriteria(
    singleDisc: string,
    multiDisc: string,
    acceptanceClass: AcceptanceClass
  ): ValidationResult {
    if (this.standard !== "AMS-STD-2154E") {
      return { isValid: true, level: 'success', message: 'Valid criteria' };
    }

    // AMS-STD-2154E / MIL-STD-2154 Table VI is FBH/response-based (not DAC percentages).
    // Validate by checking the entered text contains the expected fraction/keyword.
    const expectedFbh: Record<AcceptanceClass, { single: string; multi: string }> = {
      // Table VI: AAA multiple discontinuities uses percent-of-response (10% of 3/64 response).
      AAA: { single: '1/64', multi: '10%' },
      AA: { single: '3/64', multi: '2/64' },
      A1: { single: '3/64', multi: '2/64' },
      A: { single: '5/64', multi: '3/64' },
      B: { single: '8/64', multi: '5/64' },
      // Table VI Note 2: multiple discontinuity criteria not applicable to Class C
      C: { single: '8/64', multi: 'Not applicable' },
    };

    const expected = expectedFbh[acceptanceClass];
    if (!expected) {
      return { isValid: true, level: 'info', message: 'Custom acceptance class' };
    }

    const singleMatch = singleDisc.includes(expected.single);
    const multiMatch =
      expected.multi === 'Not applicable'
        ? (multiDisc.toLowerCase().includes('not applicable') || multiDisc.toLowerCase().includes('n/a'))
        : multiDisc.includes(expected.multi);

    if (singleMatch && multiMatch) {
      return {
        isValid: true,
        level: 'success',
        message: `Criteria match Class ${acceptanceClass}`,
        reference: 'Table VI'
      };
    }

    return {
      isValid: false,
      level: 'warning',
      message: 'Criteria may not match acceptance class',
      suggestion: `Expected (Table VI): Single ${expected.single}, Multiple ${expected.multi}`,
      reference: 'Table VI'
    };
  }

  getComplianceScore(): number {
    if (this.validations.size === 0) return 100;

    let score = 0;
    let total = 0;

    this.validations.forEach((result) => {
      total += 1;
      if (result.isValid) {
        score += result.level === 'success' ? 1 : 0.7;
      }
    });

    return Math.round((score / total) * 100);
  }

  getAllValidations(): FieldValidation[] {
    const results: FieldValidation[] = [];
    this.validations.forEach((result, field) => {
      results.push({ field, value: null, result });
    });
    return results;
  }

  getFieldValidation(field: string): ValidationResult | undefined {
    return this.validations.get(field);
  }

  setFieldValidation(field: string, result: ValidationResult) {
    this.validations.set(field, result);
  }

  clearValidations() {
    this.validations.clear();
  }

  getSuggestions(): string[] {
    const suggestions: string[] = [];
    this.validations.forEach((result) => {
      if (result.suggestion && !result.isValid) {
        suggestions.push(result.suggestion);
      }
    });
    return suggestions;
  }
}

// Singleton instance
export const validationEngine = new ValidationEngine();
