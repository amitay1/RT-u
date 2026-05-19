/**
 * Standards Differences Data
 *
 * This file contains all the differences between the 4 supported UT standards:
 * - AMS-STD-2154E (Aerospace)
 * - ASTM A388 (Heavy Steel Forgings)
 * - BS EN 10228-3 (Ferritic/Martensitic Steel Forgings)
 * - BS EN 10228-4 (Austenitic Stainless Steel Forgings)
 */

import { StandardType } from "@/types/techniqueSheet";

// ============================================================================
// ACCEPTANCE CLASSES / QUALITY LEVELS
// ============================================================================

export interface AcceptanceClassOption {
  id: string;
  label: string;
  description: string;
  stringency: "highest" | "high" | "medium" | "low" | "basic";
}

const acceptanceClassesByStandardBase = {
  "AMS-STD-2154E": [
    { id: "AAA", label: "Class AAA", description: "Ultra-Critical - Rotating turbine components, Primary flight controls", stringency: "highest" },
    { id: "AA", label: "Class AA", description: "Super-Critical - Engine mounts, Landing gear primary structure", stringency: "high" },
    { id: "A", label: "Class A", description: "Critical - Primary airframe structure, Engine components", stringency: "medium" },
    { id: "B", label: "Class B", description: "Semi-Critical - Secondary structure, Support brackets", stringency: "low" },
    { id: "C", label: "Class C", description: "Non-Critical - Non-structural components, Tooling", stringency: "basic" },
  ],
  // NOTE: ASTM A388 does NOT define Quality Levels (QL1-QL4) in the standard!
  // Per Section 10.1: Acceptance criteria per purchaser/manufacturer agreement.
  // FBH from S1: <1.5" -> 1/16", 1.5-6" -> 1/8", >6" -> 1/4". QL1-QL4 are INDUSTRY CONVENTIONS.
  "ASTM-A388": [
    { id: "QL1", label: "Quality Level 1", description: "Most stringent - Critical applications", stringency: "highest" },
    { id: "QL2", label: "Quality Level 2", description: "Standard quality - General industrial", stringency: "high" },
    { id: "QL3", label: "Quality Level 3", description: "Commercial quality - Non-critical", stringency: "medium" },
    { id: "QL4", label: "Quality Level 4", description: "Minimum quality - As agreed", stringency: "low" },
  ],
  // BS EN 10228-3 Table 5: Class 4 = MOST stringent, Class 1 = least stringent
  // Recording: Class 1 >8mm, Class 2 >5mm, Class 3 >3mm, Class 4 >2mm EFBH
  "BS-EN-10228-3": [
    { id: "1", label: "Quality Class 1", description: "Basic quality - Least stringent (Recording >8mm, Isolated ג‰₪12mm EFBH)", stringency: "basic" },
    { id: "2", label: "Quality Class 2", description: "Standard quality - General applications (Recording >5mm, Isolated ג‰₪8mm EFBH)", stringency: "low" },
    { id: "3", label: "Quality Class 3", description: "High quality - Stringent requirements (Recording >3mm, Isolated ג‰₪5mm EFBH)", stringency: "medium" },
    { id: "4", label: "Quality Class 4", description: "Highest quality - Most stringent (Recording >2mm, Isolated ג‰₪3mm EFBH)", stringency: "highest" },
  ],
  // BS EN 10228-4: Only 3 Quality Classes (NOT 4!) - Table 5
  // Class 3 = MOST stringent, Class 1 = least stringent (for austenitic materials)
  "BS-EN-10228-4": [
    { id: "1", label: "Quality Class 1", description: "Basic quality - Least stringent for austenitic", stringency: "low" },
    { id: "2", label: "Quality Class 2", description: "Standard quality - Intermediate stringency", stringency: "medium" },
    { id: "3", label: "Quality Class 3", description: "Highest quality - Most stringent for austenitic", stringency: "highest" },
  ],
  // PW NDIP Standards - OEM-specific with single acceptance level
  "NDIP-1226": [
    { id: "PW-V2500-1", label: "PW Standard", description: "V2500 1st Stage HPT Disk - Immersion UT per NDIP-1226 Rev F", stringency: "highest" },
  ],
  "NDIP-1227": [
    { id: "PW-V2500-2", label: "PW Standard", description: "V2500 2nd Stage HPT Disk - Immersion UT per NDIP-1227 Rev D", stringency: "highest" },
  ],
  // PW1100G GTF NDIPs (FAA AD-mandated AUSI ג€” powder metal contamination screening)
  "NDIP-1254": [
    { id: "PW-GTF-HPT1", label: "PW GTF Standard", description: "PW1100G HPT 1st Stage Hub ג€” AUSI per FAA AD 2023-16-07", stringency: "highest" },
  ],
  "NDIP-1257": [
    { id: "PW-GTF-HPT2", label: "PW GTF Standard", description: "PW1100G HPT 2nd Stage Hub ג€” AUSI per FAA AD 2023-16-07", stringency: "highest" },
  ],
  "NDIP-1260": [
    { id: "PW-GTF-IBR8", label: "PW GTF Standard", description: "PW1100G HPC 8th Stage Disc IBR-8 ג€” AUSI", stringency: "highest" },
  ],
  // PWA SIM ג€” Sonic Inspection Method for bar/billet/forging
  "PWA-SIM": [
    { id: "PWA-SIM-STD", label: "PWA SIM Standard", description: "Pratt & Whitney Sonic Inspection Method ג€” Bar, Billet, Forging per PWA 127", stringency: "highest" },
  ],

  // ============================================================================
  // NEW STANDARDS ADDED
  // ============================================================================

  // ASTM E2375 - UT of Wrought Products (adopted from MIL-STD-2154)
  // Uses same 5 classes as AMS-STD-2154E
  "ASTM-E2375": [
    { id: "AAA", label: "Class AAA", description: "Ultra-Critical - Same as AMS-STD-2154E AAA", stringency: "highest" },
    { id: "AA", label: "Class AA", description: "Super-Critical - Same as AMS-STD-2154E AA", stringency: "high" },
    { id: "A", label: "Class A", description: "Critical - Same as AMS-STD-2154E A", stringency: "medium" },
    { id: "B", label: "Class B", description: "Semi-Critical - Same as AMS-STD-2154E B", stringency: "low" },
    { id: "C", label: "Class C", description: "Non-Critical - Same as AMS-STD-2154E C", stringency: "basic" },
  ],

  // ASTM E127 - FBH Reference Blocks (Calibration Standard)
  // No acceptance classes - calibration block specification only
  "ASTM-E127": [
    { id: "CALIBRATION", label: "Calibration Standard", description: "FBH reference block fabrication - No rejection criteria defined", stringency: "medium" },
  ],

  // ASTM E164 - UT of Weldments
  // Acceptance per purchaser/manufacturer agreement
  "ASTM-E164": [
    { id: "LEVEL-1", label: "Level 1", description: "Most stringent - Critical welds per agreement", stringency: "highest" },
    { id: "LEVEL-2", label: "Level 2", description: "Standard - General structural welds", stringency: "high" },
    { id: "LEVEL-3", label: "Level 3", description: "Commercial - Non-critical welds", stringency: "medium" },
  ],

  // AMS-2630E - Products >0.5" thick (verified from AMS2630E Tables 3/5)
  "AMS-2630": [
    { id: "AA", label: "Class AA", description: "Most stringent - Products >0.5\" thick", stringency: "highest" },
    { id: "A1", label: "Class A1", description: "High aerospace quality - Products >0.5\" thick", stringency: "high" },
    { id: "A", label: "Class A", description: "Standard aerospace quality - Products >0.5\" thick", stringency: "medium" },
    { id: "B", label: "Class B", description: "Commercial aerospace quality - Products >0.5\" thick", stringency: "low" },
    { id: "C", label: "Class C", description: "Non-Critical - Products >0.5\" thick", stringency: "basic" },
  ],

  // ASTM E1001 - Immersed pulse-echo UT, acceptance by agreement
  "ASTM-E1001": [
    { id: "CONTRACT", label: "Contract Criteria", description: "Acceptance and reporting criteria are defined by contractual agreement", stringency: "medium" },
  ],

  // ASTM E2580 - Composite flat panel / sandwich core UT, acceptance by agreement
  "ASTM-E2580": [
    { id: "CONTRACT", label: "Contract Criteria", description: "Composite acceptance classes and reject limits are defined by contract", stringency: "medium" },
  ],

  // ASTM E588 - Bearing steel cleanliness rating, no acceptability limits
  "ASTM-E588": [
    { id: "RATING", label: "Cleanliness Rating", description: "Reports inclusion severity/counts; acceptability limits are not defined by E588", stringency: "medium" },
  ],

  // AMS-2631 - Titanium Bar, Billet, Plate
  "AMS-2631": [
    { id: "AA", label: "Class AA", description: "Most stringent titanium - Premium rotating parts", stringency: "highest" },
    { id: "A", label: "Class A", description: "High quality titanium - Primary structural", stringency: "high" },
    { id: "A1", label: "Class A1", description: "Standard titanium - General aerospace", stringency: "medium" },
    { id: "B", label: "Class B", description: "Commercial titanium - Non-critical", stringency: "low" },
  ],

  // AMS-2632 - Thin Materials ג‰₪0.5" (12.7mm)
  "AMS-2632": [
    { id: "AA", label: "Class AA", description: "Most stringent - Thin critical materials", stringency: "highest" },
    { id: "A", label: "Class A", description: "High quality - Thin structural materials", stringency: "high" },
    { id: "B", label: "Class B", description: "Standard - Thin general materials", stringency: "medium" },
    { id: "C", label: "Class C", description: "Commercial - Thin non-critical", stringency: "low" },
  ],

  // EN-ISO-16810 - General UT Principles (Reference Standard)
  // No specific acceptance classes - framework standard only
  "EN-ISO-16810": [
    { id: "REFERENCE", label: "Reference Standard", description: "General UT principles - Acceptance per referencing document", stringency: "medium" },
  ],
} satisfies Record<Exclude<StandardType, "MIL-STD-2154">, AcceptanceClassOption[]>;

export const acceptanceClassesByStandard: Record<StandardType, AcceptanceClassOption[]> = {
  ...acceptanceClassesByStandardBase,
  "MIL-STD-2154": acceptanceClassesByStandardBase["AMS-STD-2154E"],
};

// ============================================================================
// ACCEPTANCE CRITERIA PER STANDARD AND CLASS
// ============================================================================

export interface AcceptanceCriteriaValues {
  singleDiscontinuity: string;
  multipleDiscontinuities: string;
  linearDiscontinuity: string;
  backReflectionLoss: string;
  noiseLevel: string;
  specialNotes?: string;
}

const acceptanceCriteriaByStandardBase = {
  // AMS-STD-2154E / MIL-STD-2154 Table VI - Ultrasonic Classes (verified from MIL-STD-2154 PDF in this repo)
  "AMS-STD-2154E": {
    "AAA": {
      // Table VI: AAA uses percent-of-response criteria for multiple/linear/noise.
      singleDiscontinuity: "1/64\" (0.4mm) OR 25% of 3/64\" response",
      multipleDiscontinuities: "10% of 3/64\" response",
      linearDiscontinuity: "1/8\" max length at 10% of 3/64\" response",
      backReflectionLoss: "50%",
      noiseLevel: "Alarm level",
      specialNotes: "Most stringent - for rotating turbine components. Titanium (Table VI Note 6): AAA multiple discontinuity limit = 1/8\" max length at 2/64 response; noise criteria N/A. Titanium AA: multiple discontinuity limit = 1/4\" max length at 2/64 response (or greater); linear criteria N/A."
    },
    "AA": {
      singleDiscontinuity: "3/64\" (1.2mm)",
      multipleDiscontinuities: "2/64\" (0.8mm)",
      linearDiscontinuity: "1/2\" max length at 2/64\" (0.8mm) response",
      backReflectionLoss: "50%",
      noiseLevel: "Alarm level",
      specialNotes: "For engine mounts, landing gear primary structure, rotor hubs"
    },
    "A": {
      singleDiscontinuity: "5/64\" (2.0mm)",
      // MIL-STD-2154 Table VI: Class A multiple discontinuities = 3/64 response
      multipleDiscontinuities: "3/64\" (1.2mm)",
      linearDiscontinuity: "1\" max length at 3/64\" (1.2mm) response",
      backReflectionLoss: "50%",
      noiseLevel: "Alarm level",
      specialNotes: "For primary airframe structure, engine and transmission components"
    },
    "B": {
      singleDiscontinuity: "8/64\" (3.2mm)",
      // MIL-STD-2154 Table VI: Class B multiple discontinuities = 5/64 response
      multipleDiscontinuities: "5/64\" (2.0mm)",
      linearDiscontinuity: "1\" max length at 5/64\" (2.0mm) response",
      backReflectionLoss: "50%",
      noiseLevel: "Alarm level",
      specialNotes: "For secondary structure, non-flight critical components"
    },
    "C": {
      singleDiscontinuity: "8/64\" (3.2mm)",
      // MIL-STD-2154 Table VI Note 2: multiple discontinuities criteria not applicable to Class C
      multipleDiscontinuities: "Not applicable",
      linearDiscontinuity: "Not applicable",
      backReflectionLoss: "50%",
      noiseLevel: "Alarm level",
      specialNotes: "For non-structural components, tooling, ground support. No linear discontinuity limits."
    },
  },
  "ASTM-A388": {
    "QL1": {
      singleDiscontinuity: "Reference FBH size",
      multipleDiscontinuities: "50% reference FBH",
      linearDiscontinuity: "Not acceptable",
      backReflectionLoss: "50% maximum",
      noiseLevel: "Per agreement",
      specialNotes: "INDUSTRY CONVENTION - not defined in standard. S1 FBH by thickness: under 1.5 inch uses 1/16 FBH, 1.5-6 inch uses 1/8 FBH, over 6 inch uses 1/4 FBH. All criteria per purchaser/manufacturer agreement."
    },
    "QL2": {
      singleDiscontinuity: "2ֳ— reference FBH size",
      multipleDiscontinuities: "Reference FBH size",
      linearDiscontinuity: "Length ג‰₪ 1 inch",
      backReflectionLoss: "75% maximum",
      noiseLevel: "Per agreement",
      specialNotes: "INDUSTRY CONVENTION - not in standard. General industrial quality level - all criteria per purchaser agreement."
    },
    "QL3": {
      singleDiscontinuity: "4ֳ— reference FBH size",
      multipleDiscontinuities: "2ֳ— reference FBH size",
      linearDiscontinuity: "Length ג‰₪ 2 inches",
      backReflectionLoss: "90% maximum",
      noiseLevel: "Per agreement",
      specialNotes: "INDUSTRY CONVENTION - not in standard. Commercial quality - criteria per purchaser agreement."
    },
    "QL4": {
      singleDiscontinuity: "No specific limit",
      multipleDiscontinuities: "4ֳ— reference FBH size",
      linearDiscontinuity: "As agreed",
      backReflectionLoss: "Complete loss acceptable",
      noiseLevel: "Per agreement",
      specialNotes: "INDUSTRY CONVENTION - not in standard. All criteria as agreed between purchaser and manufacturer."
    },
  },
  // BS EN 10228-3 Table 5 - Quality Classes for Ferritic/Martensitic Steels
  // Class 4 = MOST stringent, Class 1 = LEAST stringent (uses EFBH in mm)
  "BS-EN-10228-3": {
    "1": {
      singleDiscontinuity: "Isolated: ג‰₪12mm EFBH (Recording level: >8mm EFBH)",
      multipleDiscontinuities: "Extended/Grouped: ג‰₪8mm EFBH",
      linearDiscontinuity: "Extended indications per isolated limits",
      backReflectionLoss: "BWE Ratio R ג‰₪ 0.1 (10% reduction acceptable)",
      noiseLevel: "Per EN 10228-3 requirements",
      specialNotes: "LEAST STRINGENT - Class 1. Recording >8mm, Isolated ג‰₪12mm, Extended ג‰₪8mm EFBH."
    },
    "2": {
      singleDiscontinuity: "Isolated: ג‰₪8mm EFBH (Recording level: >5mm EFBH)",
      multipleDiscontinuities: "Extended/Grouped: ג‰₪5mm EFBH",
      linearDiscontinuity: "Extended indications per isolated limits",
      backReflectionLoss: "BWE Ratio R ג‰₪ 0.3 (30% reduction acceptable)",
      noiseLevel: "Per EN 10228-3 requirements",
      specialNotes: "Standard quality - Class 2. Recording >5mm, Isolated ג‰₪8mm, Extended ג‰₪5mm EFBH."
    },
    "3": {
      singleDiscontinuity: "Isolated: ג‰₪5mm EFBH (Recording level: >3mm EFBH)",
      multipleDiscontinuities: "Extended/Grouped: ג‰₪3mm EFBH",
      linearDiscontinuity: "Extended indications per isolated limits",
      backReflectionLoss: "BWE Ratio R ג‰₪ 0.5 (50% reduction acceptable)",
      noiseLevel: "Per EN 10228-3 requirements",
      specialNotes: "High quality - Class 3. Recording >3mm, Isolated ג‰₪5mm, Extended ג‰₪3mm EFBH."
    },
    "4": {
      singleDiscontinuity: "Isolated: ג‰₪3mm EFBH (Recording level: >2mm EFBH)",
      multipleDiscontinuities: "Extended/Grouped: ג‰₪2mm EFBH",
      linearDiscontinuity: "Extended indications per isolated limits",
      backReflectionLoss: "BWE Ratio R ג‰₪ 0.6 (60% reduction acceptable)",
      noiseLevel: "Per EN 10228-3 requirements",
      specialNotes: "MOST STRINGENT - Class 4. Highest quality. Recording >2mm, Isolated ג‰₪3mm, Extended ג‰₪2mm EFBH."
    },
  },
  // BS EN 10228-4 Table 5 - Quality Classes for Austenitic/Austenitic-Ferritic Steels
  // Only 3 Quality Classes. Class 3 = MOST stringent, Class 1 = least stringent
  "BS-EN-10228-4": {
    "1": {
      singleDiscontinuity: "Isolated: per Table 5 (thickness dependent) - largest allowable sizes",
      multipleDiscontinuities: "Extended/Grouped: per Table 5 (thickness dependent)",
      linearDiscontinuity: "Extended indications per isolated limits",
      backReflectionLoss: "BWE ratio per Table 5 (most permissive)",
      noiseLevel: "Adapted for austenitic grain noise - S/N per agreement",
      specialNotes: "LEAST STRINGENT - Class 1. For austenitic/duplex steels. Limits vary by thickness. Account for grain scatter."
    },
    "2": {
      singleDiscontinuity: "Isolated: per Table 5 (thickness dependent) - intermediate sizes",
      multipleDiscontinuities: "Extended/Grouped: per Table 5 (thickness dependent)",
      linearDiscontinuity: "Extended indications per isolated limits",
      backReflectionLoss: "BWE ratio per Table 5 (intermediate)",
      noiseLevel: "Adapted for austenitic grain noise - S/N min 3:1",
      specialNotes: "Standard quality - Class 2. For austenitic/duplex steels. Intermediate stringency."
    },
    "3": {
      singleDiscontinuity: "Isolated: per Table 5 (thickness dependent) - smallest allowable sizes",
      multipleDiscontinuities: "Extended/Grouped: per Table 5 (thickness dependent)",
      linearDiscontinuity: "Extended indications per isolated limits",
      backReflectionLoss: "BWE ratio per Table 5 (most stringent)",
      noiseLevel: "Adapted for austenitic grain noise - S/N preferred 6:1",
      specialNotes: "MOST STRINGENT - Class 3. Highest quality for austenitic/duplex steels. Most restrictive limits."
    },
  },
  // PW NDIP Standards - OEM-specific acceptance criteria
  "NDIP-1226": {
    "PW-V2500-1": {
      singleDiscontinuity: "Amplitude C-Scan reject: >=20% FSH (FBH#1 set to 80% FSH); evaluation at 15% FSH",
      multipleDiscontinuities: "TOF reject: >=15 connected pixels over >=3 adjacent scan lines, SNR >=1.5:1",
      linearDiscontinuity: "Amplitude cluster minimum: 3 adjacent pixels (depth delta <=0.025\"); TOF depth deltas: scan <=0.025\", index <=0.010\"",
      backReflectionLoss: "Post-calibration verification within +/-1 dB of initial calibration",
      noiseLevel: "Max 7.5% FSH average, 8.5% FSH band noise",
      specialNotes: "PW V2500 1st Stage HPT Disk. Circumferential shear wave +/-45°. #1 FBH (1/64\") at 80% FSH. Rejection criteria per NDIP-1226 Rev F Section 8.0."
    },
  },
  "NDIP-1227": {
    "PW-V2500-2": {
      singleDiscontinuity: "Amplitude C-Scan reject: >=20% FSH (FBH#1 set to 80% FSH); evaluation at 15% FSH",
      multipleDiscontinuities: "TOF reject: >=15 connected pixels over >=3 adjacent scan lines, SNR >=1.5:1",
      linearDiscontinuity: "Amplitude cluster minimum: 3 adjacent pixels (depth delta <=0.025\"); TOF depth deltas along beam axis: scan <=0.025\", index <=0.010\"",
      backReflectionLoss: "Post-calibration verification within +/-1 dB of initial calibration",
      noiseLevel: "Max 7.5% FSH average, 8.5% FSH band noise",
      specialNotes: "PW V2500 2nd Stage HPT Disk. Circumferential shear wave +/-45°. #1 FBH (1/64\") at 80% FSH. Rejection criteria per NDIP-1227 Rev D Section 8.0."
    },
  },
  // PW1100G GTF NDIPs ג€” criteria based on FAA AD 2022-19-15 / AD 2023-16-07 (powder metal screening)
  "NDIP-1254": {
    "PW-GTF-HPT1": {
      singleDiscontinuity: "Per NDIP-1254 specification (proprietary ג€” contact PW MPE-NDE)",
      multipleDiscontinuities: "Per NDIP-1254 specification",
      linearDiscontinuity: "Per NDIP-1254 specification",
      backReflectionLoss: "Per calibration verification",
      noiseLevel: "Per NDIP-1254 specification",
      specialNotes: "PW1100G-JM / PW1400G-JM HPT 1st Stage Hub. AUSI for powder metal contamination per FAA AD 2023-16-07. Inspection required before 3,800 CSN or within 100 FC of AD effective date. Full NDIP details available through PW Supplier Portal (eSRI)."
    },
  },
  "NDIP-1257": {
    "PW-GTF-HPT2": {
      singleDiscontinuity: "Per NDIP-1257 specification (proprietary ג€” contact PW MPE-NDE)",
      multipleDiscontinuities: "Per NDIP-1257 specification",
      linearDiscontinuity: "Per NDIP-1257 specification",
      backReflectionLoss: "Per calibration verification",
      noiseLevel: "Per NDIP-1257 specification",
      specialNotes: "PW1100G-JM / PW1400G-JM HPT 2nd Stage Hub. AUSI for powder metal contamination per FAA AD 2023-16-07. Also covers accelerated replacement requirements. Full NDIP details available through PW Supplier Portal (eSRI)."
    },
  },
  "NDIP-1260": {
    "PW-GTF-IBR8": {
      singleDiscontinuity: "Per NDIP-1260 specification (proprietary ג€” contact PW MPE-NDE)",
      multipleDiscontinuities: "Per NDIP-1260 specification",
      linearDiscontinuity: "Per NDIP-1260 specification",
      backReflectionLoss: "Per calibration verification",
      noiseLevel: "Per NDIP-1260 specification",
      specialNotes: "PW1100G-JM HPC 8th Stage Integrally Bladed Rotor (IBR-8). AUSI for powder metal contamination. Referenced in FAA superseding AD (Dec 2023). Full NDIP details available through PW Supplier Portal (eSRI)."
    },
  },
  // PWA SIM ג€” Sonic Inspection Method
  "PWA-SIM": {
    "PWA-SIM-STD": {
      singleDiscontinuity: "3/64\" (1.2mm) FBH at 50% depth ג€” reject level",
      multipleDiscontinuities: "Per PWA 127 specification",
      linearDiscontinuity: "EDM notch 3% depth ֳ— 1/4\" length ג€” axial",
      backReflectionLoss: "Per calibration verification",
      noiseLevel: "Per PWA 127 specification",
      specialNotes: "PWA Sonic Inspection Method for bar, billet, rod, and forging stock. Reference block per PWA SIM 4E SIS 26B: 3/64\" FBH at 50%, 3/64\" FBH at 10%, 1/32\" FBH at 10%, plus axial EDM notch 3% ֳ— 1/4\". Contact PW Supplier Portal (eSRI) for full PWA 127 specification."
    },
  },

  // ============================================================================
  // NEW STANDARDS - ACCEPTANCE CRITERIA
  // ============================================================================

  // ASTM E2375 - Adopted from MIL-STD-2154 (same criteria as AMS-STD-2154E)
  "ASTM-E2375": {
    "AAA": {
      singleDiscontinuity: "1/64\" (0.4mm) OR 25% of 3/64\" response",
      multipleDiscontinuities: "10% of 3/64\" response (centers <1\" apart)",
      linearDiscontinuity: "10% of 3/64\" response, 1/8\" max length",
      backReflectionLoss: "50% (see Note 4)",
      noiseLevel: "10% of 3/64\" response (see Note 5)",
      specialNotes: "ASTM E2375 adopted MIL-STD-2154 criteria. Most stringent class for rotating parts. Titanium adjustments per Table VI Note 6 may apply."
    },
    "AA": {
      singleDiscontinuity: "3/64\" (1.2mm) FBH response",
      multipleDiscontinuities: "2/64\" (0.8mm) FBH (centers <1\" apart)",
      linearDiscontinuity: "2/64\" (0.8mm) FBH, 1/2\" max length",
      backReflectionLoss: "50% maximum",
      noiseLevel: "Alarm level",
      specialNotes: "Super-critical applications per ASTM E2375"
    },
    "A": {
      singleDiscontinuity: "5/64\" (2.0mm) FBH response",
      multipleDiscontinuities: "3/64\" (1.2mm) FBH (centers <1\" apart)",
      linearDiscontinuity: "3/64\" (1.2mm) FBH, 1\" max length",
      backReflectionLoss: "50% maximum",
      noiseLevel: "Alarm level",
      specialNotes: "Critical applications per ASTM E2375"
    },
    "B": {
      singleDiscontinuity: "8/64\" (3.2mm) FBH response",
      multipleDiscontinuities: "5/64\" (2.0mm) FBH (centers <1\" apart)",
      linearDiscontinuity: "5/64\" (2.0mm) FBH, 1\" max length",
      backReflectionLoss: "50% maximum",
      noiseLevel: "Alarm level",
      specialNotes: "Semi-critical applications per ASTM E2375"
    },
    "C": {
      singleDiscontinuity: "8/64\" (3.2mm) FBH response",
      multipleDiscontinuities: "Not applicable",
      linearDiscontinuity: "Not applicable",
      backReflectionLoss: "50% maximum",
      noiseLevel: "Alarm level",
      specialNotes: "Non-critical applications per ASTM E2375. No linear discontinuity limits."
    },
  },

  // ASTM E127 - Calibration Block Standard (no rejection criteria)
  "ASTM-E127": {
    "CALIBRATION": {
      singleDiscontinuity: "N/A - Calibration block fabrication standard",
      multipleDiscontinuities: "N/A - Calibration block fabrication standard",
      linearDiscontinuity: "N/A - Calibration block fabrication standard",
      backReflectionLoss: "N/A - Calibration block fabrication standard",
      noiseLevel: "N/A - Calibration block fabrication standard",
      specialNotes: "ASTM E127 defines FBH reference block fabrication only. FBH sizes: 1/64\" to 8/64\". Metal travel: 0.0625\" to 6.000\". Use referencing standard for acceptance criteria."
    },
  },

  // ASTM E164 - Weldments
  "ASTM-E164": {
    "LEVEL-1": {
      singleDiscontinuity: "Reference standard level - Most stringent",
      multipleDiscontinuities: "50% of reference - No clustering allowed",
      linearDiscontinuity: "Not acceptable - Zero tolerance",
      backReflectionLoss: "50% maximum",
      noiseLevel: "Per agreement - Critical welds",
      specialNotes: "Most stringent weld inspection. Criteria per purchaser agreement. Zero tolerance for linear indications."
    },
    "LEVEL-2": {
      singleDiscontinuity: "Reference standard level",
      multipleDiscontinuities: "Reference level - Limited clustering",
      linearDiscontinuity: "ג‰₪1\" length at reference level",
      backReflectionLoss: "75% maximum",
      noiseLevel: "Per agreement",
      specialNotes: "Standard structural weld quality. Linear indications limited to 1\" max."
    },
    "LEVEL-3": {
      singleDiscontinuity: "2ֳ— reference standard level",
      multipleDiscontinuities: "Reference level",
      linearDiscontinuity: "ג‰₪2\" length at reference level",
      backReflectionLoss: "Complete loss may be acceptable",
      noiseLevel: "Per agreement",
      specialNotes: "Commercial weld quality. All criteria per purchaser/manufacturer agreement."
    },
  },

  // AMS-2630E - Products >0.5" thick (Tables 3 and 5)
  "AMS-2630": {
    "AA": {
      singleDiscontinuity: "Longitudinal: #3 FBH (1.2mm). Angle beam: #2 FBH (0.8mm).",
      multipleDiscontinuities: "Longitudinal: #1 FBH (0.4mm) or 11% of #3 response. Angle beam: 50% of #2 response.",
      linearDiscontinuity: "Longitudinal: #1 response over 0.12\" (3.0mm). Angle beam: 50% of #2 response over 0.12\" (3.0mm).",
      backReflectionLoss: "50%",
      noiseLevel: "Reference drift limit +/-10%; rejectable indication rules per Table 3/5",
      specialNotes: "Most stringent AMS2630E class. Acceptance values differ from AMS-STD-2154E and do not include Class AAA."
    },
    "A1": {
      singleDiscontinuity: "Longitudinal/angle beam: #3 FBH (1.2mm).",
      multipleDiscontinuities: "Longitudinal: #2 FBH (0.8mm) or 44% of #3 response. Angle beam: #2 FBH (0.8mm).",
      linearDiscontinuity: "Longitudinal: #2 response over 1.00\" (25mm). Angle beam: #2 response over 0.25\" (6.4mm).",
      backReflectionLoss: "50%",
      noiseLevel: "Reference drift limit +/-10%; rejectable indication rules per Table 3/5",
      specialNotes: "AMS2630E high aerospace class between AA and A."
    },
    "A": {
      singleDiscontinuity: "Longitudinal/angle beam: #5 FBH (2.0mm).",
      multipleDiscontinuities: "Longitudinal/angle beam: #3 FBH (1.2mm).",
      linearDiscontinuity: "Longitudinal: #3 response over 1.00\" (25mm). Angle beam: #3 response over 0.50\" (12.7mm).",
      backReflectionLoss: "50%",
      noiseLevel: "Reference drift limit +/-10%; rejectable indication rules per Table 3/5",
      specialNotes: "Standard AMS2630E aerospace class for product over 0.5\" thick."
    },
    "B": {
      singleDiscontinuity: "Longitudinal/angle beam: #8 FBH (3.2mm).",
      multipleDiscontinuities: "Longitudinal/angle beam: #5 FBH (2.0mm).",
      linearDiscontinuity: "Longitudinal/angle beam: #5 response over 1.00\" (25.4mm).",
      backReflectionLoss: "50%",
      noiseLevel: "Reference drift limit +/-10%; rejectable indication rules per Table 3/5",
      specialNotes: "Commercial aerospace AMS2630E class."
    },
    "C": {
      singleDiscontinuity: "By purchaser/vendor agreement",
      multipleDiscontinuities: "By purchaser/vendor agreement",
      linearDiscontinuity: "By purchaser/vendor agreement",
      backReflectionLoss: "By purchaser/vendor agreement",
      noiseLevel: "By purchaser/vendor agreement",
      specialNotes: "AMS2630E Class C criteria are established by purchaser/vendor agreement."
    },
  },

  // ASTM E1001 - Immersed pulse-echo UT; acceptance criteria are contractual
  "ASTM-E1001": {
    "CONTRACT": {
      singleDiscontinuity: "Per contractual rejection level",
      multipleDiscontinuities: "Per contractual rejection level",
      linearDiscontinuity: "Per contractual rejection level",
      backReflectionLoss: "Report/evaluate per contract",
      noiseLevel: "Reference echo >=60% FSH and noise <=20% FSH unless otherwise agreed",
      specialNotes: "ASTM E1001 defines immersed pulse-echo examination practice and reporting; it does not define accept/reject limits."
    },
  },

  // ASTM E2580 - Composite flat panel / sandwich core UT; acceptance criteria are contractual
  "ASTM-E2580": {
    "CONTRACT": {
      singleDiscontinuity: "Per engineering drawing or purchase order",
      multipleDiscontinuities: "Per engineering drawing or purchase order",
      linearDiscontinuity: "Per engineering drawing or purchase order",
      backReflectionLoss: "Evaluate amplitude / through-transmission loss per contract",
      noiseLevel: "Minimum 3:1 signal-to-noise ratio",
      specialNotes: "ASTM E2580 defines pulse-echo and through-transmission UT methods for composites; it does not define acceptance criteria."
    },
  },

  // ASTM E588 - Bearing steel cleanliness rating; no acceptability limits
  "ASTM-E588": {
    "RATING": {
      singleDiscontinuity: "Report inclusions >= 1/64\" FBH equivalent",
      multipleDiscontinuities: "Report inclusion counts by severity band",
      linearDiscontinuity: "Not an acceptance criterion in E588",
      backReflectionLoss: "Not an acceptance criterion in E588",
      noiseLevel: "Maintain validated detection of 1/64\" FBH equivalent inclusions",
      specialNotes: "ASTM E588 reports ultrasonic cleanliness severity S=(Nl+Nm+Nh)/V. Acceptability limits must be defined by product specification or purchaser."
    },
  },

  // AMS-2631 - Titanium Bar, Billet, Plate
  "AMS-2631": {
    "AA": {
      singleDiscontinuity: "2/64\" (0.8mm) FBH response",
      multipleDiscontinuities: "1/64\" FBH - Multiple with 1/4\" minimum separation",
      linearDiscontinuity: "1/4\" max length - 2/64\" response",
      backReflectionLoss: "Per specification",
      noiseLevel: "Alarm level - Critical for titanium grain scatter",
      specialNotes: "Premium titanium. Class AA for rotating engine parts. Surface texture ג‰₪125 ־¼in. Ti-6Al-4V or equivalent reference blocks."
    },
    "A": {
      singleDiscontinuity: "3/64\" (1.2mm) FBH response",
      multipleDiscontinuities: "2/64\" FBH (centers <1\" apart)",
      linearDiscontinuity: "1/2\" max length - 2/64\" response",
      backReflectionLoss: "50% maximum",
      noiseLevel: "Alarm level",
      specialNotes: "High quality titanium. Class A for primary structural components."
    },
    "A1": {
      singleDiscontinuity: "5/64\" (2.0mm) FBH response",
      multipleDiscontinuities: "3/64\" FBH (centers <1\" apart)",
      linearDiscontinuity: "1\" max length - 3/64\" response",
      backReflectionLoss: "50% maximum",
      noiseLevel: "Alarm level",
      specialNotes: "Standard titanium. Class A1 for general aerospace applications."
    },
    "B": {
      singleDiscontinuity: "8/64\" (3.2mm) FBH response",
      multipleDiscontinuities: "5/64\" FBH",
      linearDiscontinuity: "Per agreement",
      backReflectionLoss: "75% maximum",
      noiseLevel: "Per agreement",
      specialNotes: "Commercial titanium quality. Class B for non-critical applications."
    },
  },

  // AMS-2632 - Thin Materials ג‰₪0.5" (12.7mm)
  "AMS-2632": {
    "AA": {
      singleDiscontinuity: "1/64\" (0.4mm) FBH response - Most stringent for thin materials",
      multipleDiscontinuities: "1/64\" FBH - No clustering",
      linearDiscontinuity: "Not acceptable",
      backReflectionLoss: "Per specification",
      noiseLevel: "Alarm level - Surface proximity critical",
      specialNotes: "Thin materials ג‰₪0.5\" (12.7mm). Class AA ultra-critical. Near-surface detection critical."
    },
    "A": {
      singleDiscontinuity: "2/64\" (0.8mm) FBH response",
      multipleDiscontinuities: "1/64\" FBH (limited clustering)",
      linearDiscontinuity: "1/4\" max length",
      backReflectionLoss: "50% maximum",
      noiseLevel: "Alarm level",
      specialNotes: "Thin materials ג‰₪0.5\". Class A for critical applications."
    },
    "B": {
      singleDiscontinuity: "3/64\" (1.2mm) FBH response",
      multipleDiscontinuities: "2/64\" FBH",
      linearDiscontinuity: "1/2\" max length",
      backReflectionLoss: "50% maximum",
      noiseLevel: "Alarm level",
      specialNotes: "Thin materials ג‰₪0.5\". Class B for standard applications."
    },
    "C": {
      singleDiscontinuity: "5/64\" (2.0mm) FBH response",
      multipleDiscontinuities: "3/64\" FBH",
      linearDiscontinuity: "Per agreement",
      backReflectionLoss: "75% maximum",
      noiseLevel: "Per agreement",
      specialNotes: "Thin materials ג‰₪0.5\". Class C commercial quality."
    },
  },

  // EN-ISO-16810 - General UT Principles (Framework Standard)
  "EN-ISO-16810": {
    "REFERENCE": {
      singleDiscontinuity: "Per referencing document/code",
      multipleDiscontinuities: "Per referencing document/code",
      linearDiscontinuity: "Per referencing document/code",
      backReflectionLoss: "Per referencing document/code",
      noiseLevel: "Per referencing document/code",
      specialNotes: "EN ISO 16810 defines general UT principles only. It does NOT specify acceptance criteria or scan plans. Use product-specific standards (EN 10228, etc.) for acceptance criteria. Equipment per EN 12668."
    },
  },
} satisfies Record<Exclude<StandardType, "MIL-STD-2154">, Record<string, AcceptanceCriteriaValues>>;

export const acceptanceCriteriaByStandard: Record<StandardType, Record<string, AcceptanceCriteriaValues>> = {
  ...acceptanceCriteriaByStandardBase,
  "MIL-STD-2154": acceptanceCriteriaByStandardBase["AMS-STD-2154E"],
};

// ============================================================================
// FBH SIZES PER STANDARD
// ============================================================================

export interface FBHSizeOption {
  id: string;
  inch: string;
  mm: number;
  fbhNumber?: string; // For ASTM A388
  thicknessRange?: string;
  applicableClasses?: string[];
}

export interface FBHTableRow {
  thicknessRange: string;
  thicknessRangeMm: string;
  sizes: Record<string, string>; // class -> FBH size
}

// AMS-STD-2154E FBH Table (Table I)
export const amsFBHTable: FBHTableRow[] = [
  {
    thicknessRange: "0.25-0.50 inches",
    thicknessRangeMm: "6.35-12.7 mm",
    sizes: { "AAA": "1/64\" (0.4mm)", "AA": "1/64\" (0.4mm)", "A": "2/64\" (0.8mm)", "B": "3/64\" (1.2mm)", "C": "4/64\" (1.6mm)" }
  },
  {
    thicknessRange: "0.50-1.00 inches",
    thicknessRangeMm: "12.7-25.4 mm",
    sizes: { "AAA": "1/64\" (0.4mm)", "AA": "2/64\" (0.8mm)", "A": "3/64\" (1.2mm)", "B": "4/64\" (1.6mm)", "C": "5/64\" (2.0mm)" }
  },
  {
    thicknessRange: "1.00-2.00 inches",
    thicknessRangeMm: "25.4-50.8 mm",
    sizes: { "AAA": "2/64\" (0.8mm)", "AA": "3/64\" (1.2mm)", "A": "3/64\" (1.2mm)", "B": "5/64\" (2.0mm)", "C": "5/64\" (2.0mm)" }
  },
  {
    thicknessRange: "2.00-4.00 inches",
    thicknessRangeMm: "50.8-101.6 mm",
    sizes: { "AAA": "3/64\" (1.2mm)", "AA": "3/64\" (1.2mm)", "A": "5/64\" (2.0mm)", "B": "5/64\" (2.0mm)", "C": "8/64\" (3.2mm)" }
  },
  {
    thicknessRange: ">4.00 inches",
    thicknessRangeMm: ">101.6 mm",
    sizes: { "AAA": "3/64\" (1.2mm)", "AA": "5/64\" (2.0mm)", "A": "5/64\" (2.0mm)", "B": "8/64\" (3.2mm)", "C": "8/64\" (3.2mm)" }
  },
];

// ASTM A388 FBH Sizes (simpler - by thickness only)
export const astmA388FBHTable: FBHSizeOption[] = [
  { id: "a388_1", inch: "1/16\"", mm: 1.6, fbhNumber: "#1", thicknessRange: "Up to 1.5\" (38mm)" },
  { id: "a388_2", inch: "1/8\"", mm: 3.2, fbhNumber: "#2", thicknessRange: "1.5-6.0\" (38-152mm)" },
  { id: "a388_3", inch: "1/4\"", mm: 6.35, fbhNumber: "#3", thicknessRange: "Over 6.0\" (>152mm)" },
];

// BS EN 10228-3/4 FBH Sizes (metric)
export const enFBHSizes: FBHSizeOption[] = [
  { id: "en_3mm", inch: "0.118\"", mm: 3, thicknessRange: "General use" },
  { id: "en_5mm", inch: "0.197\"", mm: 5, thicknessRange: "Medium thickness" },
  { id: "en_8mm", inch: "0.315\"", mm: 8, thicknessRange: "Heavy sections" },
];

// ============================================================================
// EQUIPMENT PARAMETERS PER STANDARD
// ============================================================================

export interface EquipmentParameters {
  frequencyRange: { min: number; max: number; typical: number; unit: string };
  verticalLinearity: { min: number; max: number };
  horizontalLinearity: { min: number } | null; // null if not specified
  frequencyTolerance: string | null;
  prfRange: string | null;
  transducerDiameter: { min: number; max: number; unit: string };
  notes: string;
}

const equipmentParametersByStandardBase = {
  "AMS-STD-2154E": {
    frequencyRange: { min: 2.25, max: 15, typical: 5, unit: "MHz" },
    verticalLinearity: { min: 5, max: 98 },
    horizontalLinearity: { min: 90 },
    frequencyTolerance: "ֲ±10%",
    prfRange: "100-10000 Hz",
    transducerDiameter: { min: 6.35, max: 25.4, unit: "mm" },
    notes: "High frequency capability for aerospace applications. Resolution requirements per Table II."
  },
  "ASTM-A388": {
    frequencyRange: { min: 1, max: 5, typical: 2.25, unit: "MHz" },
    verticalLinearity: { min: 10, max: 95 },
    horizontalLinearity: { min: 85 },
    frequencyTolerance: null,
    prfRange: null,
    transducerDiameter: { min: 9.5, max: 28.6, unit: "mm" },
    notes: "Lower frequencies for heavy steel forgings. Select based on grain structure."
  },
  "BS-EN-10228-3": {
    frequencyRange: { min: 1, max: 6, typical: 2, unit: "MHz" },
    verticalLinearity: { min: 80, max: 100 },
    horizontalLinearity: null,
    frequencyTolerance: null,
    prfRange: null,
    transducerDiameter: { min: 10, max: 25, unit: "mm" },
    notes: "Nominal probe frequency range is 1-6 MHz. Select lower frequencies for coarse grain or heavy sections."
  },
  "BS-EN-10228-4": {
    frequencyRange: { min: 0.5, max: 6, typical: 1, unit: "MHz" },
    verticalLinearity: { min: 80, max: 100 },
    horizontalLinearity: null,
    frequencyTolerance: null,
    prfRange: null,
    transducerDiameter: { min: 20, max: 30, unit: "mm" },
    notes: "Nominal probe frequency range is 0.5-6 MHz. For coarse-grain austenitic materials, use the lowest practical frequency (typically 0.5-2 MHz) for penetration."
  },
  // PW NDIP Standards - OEM-specific equipment
  "NDIP-1226": {
    frequencyRange: { min: 5, max: 5, typical: 5, unit: "MHz" },
    verticalLinearity: { min: 5, max: 98 },
    horizontalLinearity: { min: 90 },
    frequencyTolerance: "ֲ±10%",
    prfRange: "1000-5000 Hz",
    transducerDiameter: { min: 19.05, max: 19.05, unit: "mm" }, // 0.75" per IAE2P16679
    notes: "PW V2500 1st Stage HPT Disk. Transducer: IAE2P16679 (5 MHz, 0.75\" element, 8\" focal). Mirror: IAE2P16678 (45ֲ°). Immersion inspection at 8\" water path."
  },
  "NDIP-1227": {
    frequencyRange: { min: 5, max: 5, typical: 5, unit: "MHz" },
    verticalLinearity: { min: 5, max: 98 },
    horizontalLinearity: { min: 90 },
    frequencyTolerance: "ֲ±10%",
    prfRange: "1000-5000 Hz",
    transducerDiameter: { min: 19.05, max: 19.05, unit: "mm" }, // 0.75" per IAE2P16679
    notes: "PW V2500 2nd Stage HPT Disk. Transducer: IAE2P16679 (5 MHz, 0.75\" element, 8\" focal). Mirror: IAE2P16678 (45ֲ°). Immersion inspection at 8\" water path."
  },
  // PW1100G GTF NDIPs ג€” AUSI equipment (powder metal contamination screening)
  "NDIP-1254": {
    frequencyRange: { min: 5, max: 5, typical: 5, unit: "MHz" },
    verticalLinearity: { min: 5, max: 98 },
    horizontalLinearity: { min: 90 },
    frequencyTolerance: "ֲ±10%",
    prfRange: "1000-5000 Hz",
    transducerDiameter: { min: 19.05, max: 19.05, unit: "mm" }, // 0.75"
    notes: "PW1100G HPT 1st Stage Hub. AUSI per FAA AD 2023-16-07. Transducer: 5 MHz, 0.75\" element. Immersion inspection."
  },
  "NDIP-1257": {
    frequencyRange: { min: 5, max: 5, typical: 5, unit: "MHz" },
    verticalLinearity: { min: 5, max: 98 },
    horizontalLinearity: { min: 90 },
    frequencyTolerance: "ֲ±10%",
    prfRange: "1000-5000 Hz",
    transducerDiameter: { min: 19.05, max: 19.05, unit: "mm" }, // 0.75"
    notes: "PW1100G HPT 2nd Stage Hub. AUSI per FAA AD 2023-16-07. Transducer: 5 MHz, 0.75\" element. Immersion inspection."
  },
  "NDIP-1260": {
    frequencyRange: { min: 5, max: 5, typical: 5, unit: "MHz" },
    verticalLinearity: { min: 5, max: 98 },
    horizontalLinearity: { min: 90 },
    frequencyTolerance: "ֲ±10%",
    prfRange: "1000-5000 Hz",
    transducerDiameter: { min: 19.05, max: 19.05, unit: "mm" }, // 0.75"
    notes: "PW1100G HPC 8th Stage IBR-8. AUSI per FAA AD. Transducer: 5 MHz, 0.75\" element. Immersion inspection."
  },
  // PWA SIM ג€” Sonic Inspection Method equipment
  "PWA-SIM": {
    frequencyRange: { min: 2.25, max: 10, typical: 5, unit: "MHz" },
    verticalLinearity: { min: 5, max: 98 },
    horizontalLinearity: { min: 90 },
    frequencyTolerance: "ֲ±10%",
    prfRange: "100-10000 Hz",
    transducerDiameter: { min: 12.7, max: 25.4, unit: "mm" }, // 0.5-1.0"
    notes: "PWA Sonic Inspection Method for bar, billet, forging. 5 MHz typical. Immersion or contact per PWA 127. Transducer 0.5-1.0\" element."
  },

  // ============================================================================
  // NEW STANDARDS - EQUIPMENT PARAMETERS
  // ============================================================================

  "ASTM-E2375": {
    frequencyRange: { min: 2.25, max: 15, typical: 5, unit: "MHz" },
    verticalLinearity: { min: 5, max: 98 },
    horizontalLinearity: { min: 90 },
    frequencyTolerance: "ֲ±10%",
    prfRange: "100-10000 Hz",
    transducerDiameter: { min: 6.35, max: 25.4, unit: "mm" },
    notes: "Adopted from MIL-STD-2154. Same equipment requirements as AMS-STD-2154E."
  },

  "ASTM-E127": {
    frequencyRange: { min: 5, max: 5, typical: 5, unit: "MHz" },
    verticalLinearity: { min: 5, max: 98 },
    horizontalLinearity: { min: 90 },
    frequencyTolerance: null,
    prfRange: null,
    transducerDiameter: { min: 12.7, max: 19.05, unit: "mm" },
    notes: "Calibration block standard. Standard tests at 5 MHz immersion. Block diameter 2.0\" for MTD ג‰₪6\", 2.5\" for MTD >6\"."
  },

  "ASTM-E164": {
    frequencyRange: { min: 1, max: 5, typical: 2.25, unit: "MHz" },
    verticalLinearity: { min: 10, max: 95 },
    horizontalLinearity: { min: 85 },
    frequencyTolerance: null,
    prfRange: null,
    transducerDiameter: { min: 12.7, max: 25.4, unit: "mm" },
    notes: "Weldment inspection. Straight beam and angle beam (45ֲ°, 60ֲ°, 70ֲ°). Thickness range 0.25\" to 8\" (6.4-203mm)."
  },

  "AMS-2630": {
    frequencyRange: { min: 2.25, max: 15, typical: 5, unit: "MHz" },
    verticalLinearity: { min: 5, max: 98 },
    horizontalLinearity: { min: 90 },
    frequencyTolerance: null,
    prfRange: "Set to support scan speed and 100% coverage",
    transducerDiameter: { min: 9.5, max: 25.4, unit: "mm" },
    notes: "AMS2630E requires the highest practical frequency; do not use below 2.25 MHz longitudinal or 1.0 MHz shear without agreement. Immersion transducers are typically 3/8\" to 1\" diameter."
  },

  "ASTM-E1001": {
    frequencyRange: { min: 2.25, max: 15, typical: 5, unit: "MHz" },
    verticalLinearity: { min: 5, max: 98 },
    horizontalLinearity: null,
    frequencyTolerance: null,
    prfRange: "Adequate for immersed pulse-echo examination",
    transducerDiameter: { min: 6.35, max: 25.4, unit: "mm" },
    notes: "Immersed longitudinal-wave pulse-echo practice. System must produce the specified reference echo and keep noise within the agreed limit."
  },

  "ASTM-E2580": {
    frequencyRange: { min: 0.5, max: 20, typical: 5, unit: "MHz" },
    verticalLinearity: { min: 5, max: 98 },
    horizontalLinearity: null,
    frequencyTolerance: null,
    prfRange: "Limited by spot size, overlap, speed, and averaging",
    transducerDiameter: { min: 6.35, max: 25.4, unit: "mm" },
    notes: "Composite flat panel/sandwich core UT. Procedure A is pulse-echo from one side; Procedure B is through-transmission from two sides. Minimum SNR is 3:1."
  },

  "ASTM-E588": {
    frequencyRange: { min: 9.5, max: 10.5, typical: 10, unit: "MHz" },
    verticalLinearity: { min: 5, max: 98 },
    horizontalLinearity: null,
    frequencyTolerance: "+/-0.5 MHz",
    prfRange: ">=500 pps",
    transducerDiameter: { min: 6.35, max: 25.4, unit: "mm" },
    notes: "Focused immersion inspection for bearing-quality steel cleanliness rating. Transducer focal length 8.2 +/-0.3 in and beam symmetry variation <=15%."
  },

  "AMS-2631": {
    frequencyRange: { min: 2.25, max: 10, typical: 5, unit: "MHz" },
    verticalLinearity: { min: 5, max: 95 },
    horizontalLinearity: { min: 90 },
    frequencyTolerance: "ֲ±10%",
    prfRange: "100-10000 Hz",
    transducerDiameter: { min: 9.5, max: 25.4, unit: "mm" },
    notes: "Titanium bar/billet/plate. Surface texture ג‰₪250 ־¼in (6 ־¼m). Use Ti-6Al-4V or acoustically similar reference blocks."
  },

  "AMS-2632": {
    frequencyRange: { min: 5, max: 15, typical: 10, unit: "MHz" },
    verticalLinearity: { min: 5, max: 98 },
    horizontalLinearity: { min: 90 },
    frequencyTolerance: "ֲ±10%",
    prfRange: "100-10000 Hz",
    transducerDiameter: { min: 6.35, max: 12.7, unit: "mm" },
    notes: "Thin materials ג‰₪0.5\" (12.7mm). Higher frequencies for near-surface resolution. Smaller transducers for thin sections."
  },

  "EN-ISO-16810": {
    frequencyRange: { min: 0.5, max: 15, typical: 2, unit: "MHz" },
    verticalLinearity: { min: 80, max: 100 },
    horizontalLinearity: null,
    frequencyTolerance: null,
    prfRange: null,
    transducerDiameter: { min: 6, max: 30, unit: "mm" },
    notes: "General UT principles. Equipment per EN 12668-1/2/3. Specific requirements per referencing product standard."
  },
} satisfies Record<Exclude<StandardType, "MIL-STD-2154">, EquipmentParameters>;

export const equipmentParametersByStandard: Record<StandardType, EquipmentParameters> = {
  ...equipmentParametersByStandardBase,
  "MIL-STD-2154": equipmentParametersByStandardBase["AMS-STD-2154E"],
};

// ============================================================================
// SCAN PARAMETERS PER STANDARD
// ============================================================================

export interface ScanParameters {
  maxSpeedManual: { value: number; unit: string };
  maxSpeedAutomated: { value: number; unit: string };
  minOverlap: number; // percentage
  coverageRequired: number; // percentage
  calibrationFrequency: string;
  sensitivityGain: string;
  notes: string;
}

const scanParametersByStandardBase = {
  "AMS-STD-2154E": {
    maxSpeedManual: { value: 150, unit: "mm/s" },
    maxSpeedAutomated: { value: 150, unit: "mm/s" },
    minOverlap: 30,
    coverageRequired: 100,
    calibrationFrequency: "Before inspection, every 4 hours, and at completion",
    sensitivityGain: "80% FSH on reference, +6 to +12 dB for scanning",
    notes: "Strict 30% overlap requirement. Coverage map required for complex geometries."
  },
  "ASTM-A388": {
    maxSpeedManual: { value: 152, unit: "mm/s" }, // 6 in/s
    maxSpeedAutomated: { value: 305, unit: "mm/s" }, // 12 in/s
    minOverlap: 10,
    coverageRequired: 100,
    calibrationFrequency: "Before and after inspection",
    sensitivityGain: "80% FSH on reference, +14 dB for scanning, +6 dB for evaluation",
    notes: "Higher scanning gain (+14 dB) compared to other standards. Grid size depends on thickness."
  },
  "BS-EN-10228-3": {
    maxSpeedManual: { value: 150, unit: "mm/s" },
    maxSpeedAutomated: { value: 500, unit: "mm/s" },
    minOverlap: 10,
    coverageRequired: 100,
    calibrationFrequency: "Before and after inspection",
    sensitivityGain: "80% FSH on reference DAC",
    notes: "Highest automated speed allowed. Max indexing 75% of beam diameter."
  },
  "BS-EN-10228-4": {
    maxSpeedManual: { value: 100, unit: "mm/s" },
    maxSpeedAutomated: { value: 250, unit: "mm/s" },
    minOverlap: 20,
    coverageRequired: 100,
    calibrationFrequency: "Before inspection, every 2 hours, and at completion",
    sensitivityGain: "Adjusted for grain noise level",
    notes: "Lower speeds and higher overlap due to austenitic material characteristics. More frequent calibration required."
  },
  // PW NDIP Standards - OEM-specific scan parameters
  "NDIP-1226": {
    maxSpeedManual: { value: 0, unit: "mm/s" }, // Not applicable - automated only
    maxSpeedAutomated: { value: 0, unit: "mm/s" }, // Not explicitly specified in NDIP
    minOverlap: 0, // NDIP controls scan/index by absolute increments, not overlap percent
    coverageRequired: 100,
    calibrationFrequency: "Initial calibration per Section 5.1; post-calibration required prior to shift/PN/transducer changes and after interruptions",
    sensitivityGain: "80% FSH on #1 FBH reference, DAC curve required",
    notes: "PW V2500 1st Stage HPT. Max scan increment: 0.020\". Max index: 0.020\"/rev. Circumferential shear wave ֲ±45ֲ°. 8\" water path immersion."
  },
  "NDIP-1227": {
    maxSpeedManual: { value: 0, unit: "mm/s" }, // Not applicable - automated only
    maxSpeedAutomated: { value: 0, unit: "mm/s" }, // Not explicitly specified in NDIP
    minOverlap: 0, // NDIP controls scan/index by absolute increments, not overlap percent
    coverageRequired: 100,
    calibrationFrequency: "Initial calibration per Section 5.1; post-calibration required prior to shift/PN/transducer changes and after interruptions",
    sensitivityGain: "80% FSH on #1 FBH reference, DAC curve required",
    notes: "PW V2500 2nd Stage HPT. Max scan increment: 0.020\". Max index: 0.020\"/rev. Circumferential shear wave ֲ±45ֲ°. 8\" water path immersion."
  },
  // PW1100G GTF NDIPs ג€” AUSI scan parameters
  "NDIP-1254": {
    maxSpeedManual: { value: 0, unit: "mm/s" }, // Automated only ג€” AUSI
    maxSpeedAutomated: { value: 127, unit: "mm/s" }, // ~5 in/s
    minOverlap: 25,
    coverageRequired: 100,
    calibrationFrequency: "Before each part, after setup changes, every 8 hours",
    sensitivityGain: "80% FSH on reference, DAC curve required",
    notes: "PW1100G HPT 1st Stage Hub. AUSI automated only. Per FAA AD 2023-16-07. Full circumferential + axial coverage."
  },
  "NDIP-1257": {
    maxSpeedManual: { value: 0, unit: "mm/s" }, // Automated only ג€” AUSI
    maxSpeedAutomated: { value: 127, unit: "mm/s" }, // ~5 in/s
    minOverlap: 25,
    coverageRequired: 100,
    calibrationFrequency: "Before each part, after setup changes, every 8 hours",
    sensitivityGain: "80% FSH on reference, DAC curve required",
    notes: "PW1100G HPT 2nd Stage Hub. AUSI automated only. Per FAA AD 2023-16-07. Full circumferential + axial coverage."
  },
  "NDIP-1260": {
    maxSpeedManual: { value: 0, unit: "mm/s" }, // Automated only ג€” AUSI
    maxSpeedAutomated: { value: 127, unit: "mm/s" }, // ~5 in/s
    minOverlap: 25,
    coverageRequired: 100,
    calibrationFrequency: "Before each part, after setup changes, every 8 hours",
    sensitivityGain: "80% FSH on reference, DAC curve required",
    notes: "PW1100G HPC 8th Stage IBR-8. AUSI automated only. Full circumferential + axial coverage."
  },
  // PWA SIM ג€” Sonic Inspection Method scan parameters
  "PWA-SIM": {
    maxSpeedManual: { value: 150, unit: "mm/s" },
    maxSpeedAutomated: { value: 305, unit: "mm/s" }, // 12 in/s
    minOverlap: 15,
    coverageRequired: 100,
    calibrationFrequency: "Before and after inspection",
    sensitivityGain: "80% FSH on 3/64\" FBH at 50% depth",
    notes: "PWA Sonic Inspection Method for bar, billet, forging per PWA 127. Manual or automated scanning."
  },

  // ============================================================================
  // NEW STANDARDS - SCAN PARAMETERS
  // ============================================================================

  "ASTM-E2375": {
    maxSpeedManual: { value: 150, unit: "mm/s" },
    maxSpeedAutomated: { value: 150, unit: "mm/s" },
    minOverlap: 30,
    coverageRequired: 100,
    calibrationFrequency: "Before inspection, every 4 hours, and at completion",
    sensitivityGain: "80% FSH on reference, +6 to +12 dB for scanning",
    notes: "Adopted from MIL-STD-2154. Same scan parameters as AMS-STD-2154E. 30% overlap required."
  },

  "ASTM-E127": {
    maxSpeedManual: { value: 0, unit: "mm/s" }, // N/A - calibration block standard
    maxSpeedAutomated: { value: 0, unit: "mm/s" },
    minOverlap: 0,
    coverageRequired: 0,
    calibrationFrequency: "Per referencing standard",
    sensitivityGain: "80% FSH on reference reflector",
    notes: "Calibration block fabrication standard only. No scanning parameters defined. Use referencing standard for scan requirements."
  },

  "ASTM-E164": {
    maxSpeedManual: { value: 152, unit: "mm/s" }, // 6 in/s
    maxSpeedAutomated: { value: 254, unit: "mm/s" }, // 10 in/s
    minOverlap: 15,
    coverageRequired: 100,
    calibrationFrequency: "Before and after inspection, and after any parameter change",
    sensitivityGain: "Reference level as agreed, +6 dB minimum for scanning",
    notes: "Weldment inspection. Full weld volume plus HAZ. Angle beam scans from both sides of weld when accessible."
  },

  "AMS-2630": {
    maxSpeedManual: { value: 152.4, unit: "mm/s" },
    maxSpeedAutomated: { value: 508, unit: "mm/s" },
    minOverlap: 30,
    coverageRequired: 100,
    calibrationFrequency: "Before each part/configuration or shift, and at completion",
    sensitivityGain: "Set reference sensitivity per applicable class and verify within +/-10%",
    notes: "AMS2630E manual max speed is 6 in/s. Automated default max is 20 in/s unless PRR/coverage or dynamic verification supports higher. Scan index is normally <=70% effective beam width; up to 80% is allowed with documented coverage."
  },

  "ASTM-E1001": {
    maxSpeedManual: { value: 152, unit: "mm/s" },
    maxSpeedAutomated: { value: 305, unit: "mm/s" },
    minOverlap: 25,
    coverageRequired: 100,
    calibrationFrequency: "Before inspection and whenever setup changes",
    sensitivityGain: "DAC at 80-90% of upper linear limit; manual +6 dB recommended",
    notes: "Immersion pulse-echo scan index is based on effective beam diameter. Alarm level is typically 50% of the contractual rejection threshold."
  },

  "ASTM-E2580": {
    maxSpeedManual: { value: 100, unit: "mm/s" },
    maxSpeedAutomated: { value: 508, unit: "mm/s" },
    minOverlap: 25,
    coverageRequired: 100,
    calibrationFrequency: "Before inspection, after changes, and per procedure",
    sensitivityGain: "Reference discontinuity at 80% FSH when applicable",
    notes: "Composite panel scan speed must satisfy speed <= (1-overlap) * spot size * PRR / averages. Minimum overlap is one-quarter spot/transducer diameter."
  },

  "ASTM-E588": {
    maxSpeedManual: { value: 101.6, unit: "mm/s" },
    maxSpeedAutomated: { value: 101.6, unit: "mm/s" },
    minOverlap: 0,
    coverageRequired: 100,
    calibrationFrequency: "Before inspection and after completion; validate speed within 5%",
    sensitivityGain: "Set for reliable detection of 1/64\" FBH equivalent inclusions",
    notes: "Focused immersion scan uses 0.050\" (1.27mm) index. Typical scan speed is 4 in/s with water pH 7.5-8.5 and temperature 19.5-25.5 C."
  },

  "AMS-2631": {
    maxSpeedManual: { value: 150, unit: "mm/s" },
    maxSpeedAutomated: { value: 150, unit: "mm/s" },
    minOverlap: 30,
    coverageRequired: 100,
    calibrationFrequency: "Before inspection, every 4 hours, and at completion",
    sensitivityGain: "80% FSH on reference, scanning gain per Table requirements",
    notes: "Titanium inspection. Longitudinal mode primary, shear mode when agreed. Surface texture ג‰₪250 ־¼in. Grain flow direction consideration."
  },

  "AMS-2632": {
    maxSpeedManual: { value: 100, unit: "mm/s" },
    maxSpeedAutomated: { value: 150, unit: "mm/s" },
    minOverlap: 30,
    coverageRequired: 100,
    calibrationFrequency: "Before inspection, every 2 hours (thin material sensitivity)",
    sensitivityGain: "80% FSH on reference, near-surface sensitivity critical",
    notes: "Thin materials ג‰₪0.5\". Slower speeds for thin section sensitivity. More frequent calibration checks. Near-surface zone critical."
  },

  "EN-ISO-16810": {
    maxSpeedManual: { value: 150, unit: "mm/s" },
    maxSpeedAutomated: { value: 500, unit: "mm/s" },
    minOverlap: 15,
    coverageRequired: 100,
    calibrationFrequency: "Per referencing document requirements",
    sensitivityGain: "Per referencing document requirements",
    notes: "General UT principles only. Specific scan parameters per product standard (EN 10228-3/4, etc.). Framework reference only."
  },
} satisfies Record<Exclude<StandardType, "MIL-STD-2154">, ScanParameters>;

export const scanParametersByStandard: Record<StandardType, ScanParameters> = {
  ...scanParametersByStandardBase,
  "MIL-STD-2154": scanParametersByStandardBase["AMS-STD-2154E"],
};

// ============================================================================
// DOCUMENTATION REQUIREMENTS PER STANDARD
// ============================================================================

export interface DocumentationRequirements {
  recordRetentionYears: number | string;
  personnelCertification: string;
  techniqueSheetRequired: boolean;
  coverageMapRequired: string;
  additionalRequirements: string[];
}

const documentationByStandardBase = {
  "AMS-STD-2154E": {
    recordRetentionYears: 7,
    personnelCertification: "Per company specification (typically NAS 410)",
    techniqueSheetRequired: true,
    coverageMapRequired: "Required for complex geometries",
    additionalRequirements: [
      "Full material and equipment traceability",
      "All indications above 50% reference must be reported",
      "Calibration records maintained"
    ]
  },
  "ASTM-A388": {
    recordRetentionYears: 5,
    personnelCertification: "ASNT SNT-TC-1A Level 2 minimum",
    techniqueSheetRequired: true,
    coverageMapRequired: "Required",
    additionalRequirements: [
      "Forging identification",
      "Equipment settings documented",
      "Indication location and size recorded"
    ]
  },
  "BS-EN-10228-3": {
    recordRetentionYears: 10,
    personnelCertification: "EN ISO 9712 Level 2 minimum",
    techniqueSheetRequired: true,
    coverageMapRequired: "Required for complex geometries",
    additionalRequirements: [
      "Material specification documented",
      "Thickness range specified",
      "Quality class stated"
    ]
  },
  "BS-EN-10228-4": {
    recordRetentionYears: "Per contract",
    personnelCertification: "EN ISO 9712 Level 2 minimum + austenitic material training",
    techniqueSheetRequired: true,
    coverageMapRequired: "Required - record actual scan paths",
    additionalRequirements: [
      "Material grade and condition documented",
      "Measured attenuation value recorded",
      "Noise level assessment documented",
      "Actual velocity measurements recorded",
      "Special techniques noted"
    ]
  },
  // PW NDIP Standards - OEM-specific documentation
  "NDIP-1226": {
    recordRetentionYears: "Life of component",
    personnelCertification: "Level II UT (certified by approved training provider) + PW Probability of Detection qualification",
    techniqueSheetRequired: true,
    coverageMapRequired: "Required - per inspection zone",
    additionalRequirements: [
      "Disk part number and serial number",
      "Disk heat code",
      "Engine serial number",
      "Time Since New (TSN) and Cycles Since New (CSN)",
      "Amplitude and TOF C-Scan data (electronic transfer to PW MPE-NDE via MFT)",
      "All rejectable indication details per Section 9.1.7",
      "Calibration block serial number (IAE2P16675)",
      "Transducer serial number (IAE2P16679)"
    ]
  },
  "NDIP-1227": {
    recordRetentionYears: "Life of component",
    personnelCertification: "Level II UT (certified by approved training provider) + PW Probability of Detection qualification",
    techniqueSheetRequired: true,
    coverageMapRequired: "Required - per inspection zone",
    additionalRequirements: [
      "Disk part number and serial number",
      "Disk heat code",
      "Engine serial number",
      "Time Since New (TSN) and Cycles Since New (CSN)",
      "Amplitude and TOF C-Scan data (electronic transfer to PW MPE-NDE via MFT)",
      "All rejectable indication details per Section 9.1.7",
      "Calibration block serial number (IAE2P16675)",
      "Transducer serial number (IAE2P16679)"
    ]
  },
  // PW1100G GTF NDIPs ג€” documentation requirements
  "NDIP-1254": {
    recordRetentionYears: "Life of component",
    personnelCertification: "Level II UT (certified by approved training provider) + PW certification",
    techniqueSheetRequired: true,
    coverageMapRequired: "Required - per inspection zone",
    additionalRequirements: [
      "FAA AD 2023-16-07 compliance documentation",
      "Part number and serial number",
      "Engine serial number",
      "Cycles Since New (CSN) and Time Since New (TSN)",
      "Amplitude and TOF C-Scan data (electronic transfer to PW MPE-NDE)",
      "All rejectable indication details",
      "Calibration block serial number"
    ]
  },
  "NDIP-1257": {
    recordRetentionYears: "Life of component",
    personnelCertification: "Level II UT (certified by approved training provider) + PW certification",
    techniqueSheetRequired: true,
    coverageMapRequired: "Required - per inspection zone",
    additionalRequirements: [
      "FAA AD 2023-16-07 compliance documentation",
      "Part number and serial number",
      "Engine serial number",
      "Cycles Since New (CSN) and Time Since New (TSN)",
      "Amplitude and TOF C-Scan data (electronic transfer to PW MPE-NDE)",
      "All rejectable indication details",
      "Calibration block serial number"
    ]
  },
  "NDIP-1260": {
    recordRetentionYears: "Life of component",
    personnelCertification: "Level II UT (certified by approved training provider) + PW certification",
    techniqueSheetRequired: true,
    coverageMapRequired: "Required - per inspection zone",
    additionalRequirements: [
      "FAA AD compliance documentation",
      "Part number and serial number",
      "Engine serial number",
      "Cycles Since New (CSN) and Time Since New (TSN)",
      "Amplitude and TOF C-Scan data (electronic transfer to PW MPE-NDE)",
      "All rejectable indication details",
      "Calibration block serial number"
    ]
  },
  // PWA SIM ג€” documentation requirements
  "PWA-SIM": {
    recordRetentionYears: 7,
    personnelCertification: "NAS 410 Level II minimum",
    techniqueSheetRequired: true,
    coverageMapRequired: "Required for complex geometries",
    additionalRequirements: [
      "Bar/billet/forging material traceability",
      "Material specification and heat lot",
      "Equipment settings and calibration records",
      "All indications above recording level",
      "Reference block serial number per PWA SIM 4E"
    ]
  },

  // ============================================================================
  // NEW STANDARDS - DOCUMENTATION REQUIREMENTS
  // ============================================================================

  "ASTM-E2375": {
    recordRetentionYears: 7,
    personnelCertification: "Per company specification (typically NAS 410 or SNT-TC-1A)",
    techniqueSheetRequired: true,
    coverageMapRequired: "Required for complex geometries",
    additionalRequirements: [
      "Full material and equipment traceability",
      "All indications above 50% reference must be reported",
      "Calibration records maintained",
      "Adopted from MIL-STD-2154 requirements"
    ]
  },

  "ASTM-E127": {
    recordRetentionYears: "Life of reference block",
    personnelCertification: "Level II UT minimum for block verification",
    techniqueSheetRequired: false,
    coverageMapRequired: "Not applicable - calibration block standard",
    additionalRequirements: [
      "Block material certification",
      "FBH depth and diameter measurements",
      "Block serial number and identification",
      "Annual verification records",
      "Acoustic property measurements"
    ]
  },

  "ASTM-E164": {
    recordRetentionYears: 5,
    personnelCertification: "ASNT SNT-TC-1A Level II minimum",
    techniqueSheetRequired: true,
    coverageMapRequired: "Required - weld coverage documentation",
    additionalRequirements: [
      "Weld identification and location",
      "Base metal and filler metal specification",
      "Welding procedure specification (WPS) reference",
      "Indication location, size, and characterization",
      "Acceptance/rejection status per agreed criteria"
    ]
  },

  "AMS-2630": {
    recordRetentionYears: 7,
    personnelCertification: "NAS 410 or company equivalent",
    techniqueSheetRequired: true,
    coverageMapRequired: "Required for complex geometries",
    additionalRequirements: [
      "Material specification and heat lot",
      "Equipment settings and calibration records",
      "All indications above recording level",
      "Traceability to reference standards",
      "Part/configuration, class, method, search unit, frequency, water path, gain, scan index, and speed",
      "Reference standardization checks and drift results"
    ]
  },

  "ASTM-E1001": {
    recordRetentionYears: "Per contract",
    personnelCertification: "Per written practice or contract",
    techniqueSheetRequired: true,
    coverageMapRequired: "Required when scan plan/coverage must be demonstrated",
    additionalRequirements: [
      "Part identification and material",
      "Reference standard and DAC/sensitivity setup",
      "Search unit frequency, size, focal conditions, and water path",
      "Scan plan, index, speed, and coverage",
      "All reportable indications per contractual criteria"
    ]
  },

  "ASTM-E2580": {
    recordRetentionYears: "Per contract",
    personnelCertification: "NAS 410, SNT-TC-1A, CP-189, or contract requirement",
    techniqueSheetRequired: true,
    coverageMapRequired: "Required for C-scan composite panel inspections",
    additionalRequirements: [
      "Procedure A pulse-echo or Procedure B through-transmission",
      "Composite/sandwich panel layup, thickness, and reference standard",
      "SNR verification, reference discontinuity response, and gain settings",
      "Spot size, overlap, PRR, averaging, scan speed, and scan index",
      "Wetting agent/control check records when applicable"
    ]
  },

  "ASTM-E588": {
    recordRetentionYears: "Per quality system or contract",
    personnelCertification: "Qualified UT operator per purchaser/manufacturer practice",
    techniqueSheetRequired: true,
    coverageMapRequired: "Required for inspected volume / cleanliness rating",
    additionalRequirements: [
      "Steel heat, lot, specimen identification, and inspected volume",
      "10 MHz focused immersion transducer and focal length verification",
      "Water pH and temperature records",
      "Scan index and speed validation within 5%",
      "Inclusion counts by severity band and calculated severity rating S"
    ]
  },

  "AMS-2631": {
    recordRetentionYears: 7,
    personnelCertification: "NAS 410 Level II minimum for titanium",
    techniqueSheetRequired: true,
    coverageMapRequired: "Required for all titanium inspections",
    additionalRequirements: [
      "Titanium material specification and heat lot",
      "Heat treatment condition",
      "Grain flow direction documentation",
      "Surface preparation records",
      "All indications above recording level per class",
      "Reference block serial number and material"
    ]
  },

  "AMS-2632": {
    recordRetentionYears: 7,
    personnelCertification: "NAS 410 Level II minimum",
    techniqueSheetRequired: true,
    coverageMapRequired: "Required - critical for thin materials",
    additionalRequirements: [
      "Material specification and thickness measurement",
      "Near-surface zone inspection documentation",
      "All indications above recording level",
      "Surface condition documentation"
    ]
  },

  "EN-ISO-16810": {
    recordRetentionYears: "Per referencing document",
    personnelCertification: "EN ISO 9712 Level 2 minimum",
    techniqueSheetRequired: true,
    coverageMapRequired: "Per referencing product standard",
    additionalRequirements: [
      "Written procedure reference",
      "Equipment identification and calibration status",
      "Personnel qualification records",
      "Test conditions documentation",
      "Specific requirements per referencing standard"
    ]
  },
} satisfies Record<Exclude<StandardType, "MIL-STD-2154">, DocumentationRequirements>;

export const documentationByStandard: Record<StandardType, DocumentationRequirements> = {
  ...documentationByStandardBase,
  "MIL-STD-2154": documentationByStandardBase["AMS-STD-2154E"],
};

// ============================================================================
// CALIBRATION REQUIREMENTS PER STANDARD
// ============================================================================

export interface CalibrationRequirements {
  referenceBlockMaterial: string;
  calibrationInterval: string;
  dacCurvePoints: number;
  primarySensitivity: string;
  transferCorrection: string;
  verificationRequirements: string;
}

const calibrationByStandardBase = {
  "AMS-STD-2154E": {
    referenceBlockMaterial: "Same material specification and heat treatment as part",
    calibrationInterval: "Before each inspection, every 4 hours, and at completion",
    dacCurvePoints: 3,
    primarySensitivity: "80% FSH on reference reflector",
    transferCorrection: "Required when surface finish differs",
    verificationRequirements: "Verify at beginning, during (every 4 hrs), and end of inspection"
  },
  "ASTM-A388": {
    referenceBlockMaterial: "Same or acoustically similar material, similar heat treatment",
    calibrationInterval: "Before and after inspection",
    dacCurvePoints: 3,
    primarySensitivity: "80% FSH, +14 dB for scanning",
    transferCorrection: "Account for surface roughness difference",
    verificationRequirements: "Check at mid-range during inspection"
  },
  "BS-EN-10228-3": {
    referenceBlockMaterial: "Same or acoustically equivalent material",
    calibrationInterval: "Before and after inspection",
    dacCurvePoints: 3,
    primarySensitivity: "80% FSH on primary echo",
    transferCorrection: "Required when surface roughness differs > Ra 6.3 ־¼m (max 4 dB)",
    verificationRequirements: "Verify DAC curve at completion"
  },
  "BS-EN-10228-4": {
    referenceBlockMaterial: "Same or similar austenitic material",
    calibrationInterval: "Before inspection, every 2 hours, and at completion",
    dacCurvePoints: 3,
    primarySensitivity: "Adjusted for grain noise level",
    transferCorrection: "Measure on actual component due to attenuation variation",
    verificationRequirements: "Verify every 2 hours, acceptance within ֲ±2 dB of initial"
  },
  // PW NDIP Standards - OEM-specific calibration
  "NDIP-1226": {
    referenceBlockMaterial: "Powdered nickel equivalent - IAE2P16675 angle block",
    calibrationInterval: "Post-calibration required prior to shift change, part number change, transducer change, and immediately after unexpected interruption (Section 5.1.5.3)",
    dacCurvePoints: 7, // Holes L through S (J & K omitted) per NDIP Section 5.1.1.7.1
    primarySensitivity: "80% FSH on #1 FBH (1/64\") reference",
    transferCorrection: "Curvature correction required per bore radius",
    verificationRequirements: "Post-calibration within ֲ±1 dB of initial. Re-inspect if drift detected."
  },
  "NDIP-1227": {
    referenceBlockMaterial: "Powdered nickel equivalent - IAE2P16675 angle block",
    calibrationInterval: "Post-calibration required prior to shift change, part number change, transducer change, and immediately after unexpected interruption (Section 5.1.5.3)",
    dacCurvePoints: 7, // Holes L through S (J & K omitted) per NDIP Section 5.1.1.7.1
    primarySensitivity: "80% FSH on #1 FBH (1/64\") reference",
    transferCorrection: "Curvature correction required per bore radius",
    verificationRequirements: "Post-calibration within ֲ±1 dB of initial. Re-inspect if drift detected."
  },
  // PW1100G GTF NDIPs ג€” calibration requirements
  "NDIP-1254": {
    referenceBlockMaterial: "Titanium (Ti-6-4 or equivalent) - V2500 equivalent block",
    calibrationInterval: "Before each part, after setup changes, every 8 hours during continuous operation",
    dacCurvePoints: 8,
    primarySensitivity: "80% FSH on #1 FBH (1/64\") reference, DAC required",
    transferCorrection: "Curvature correction required per bore radius",
    verificationRequirements: "Post-calibration within ֲ±2 dB of initial. Re-inspect if drift detected."
  },
  "NDIP-1257": {
    referenceBlockMaterial: "Titanium (Ti-6-4 or equivalent) - V2500 equivalent block",
    calibrationInterval: "Before each part, after setup changes, every 8 hours during continuous operation",
    dacCurvePoints: 8,
    primarySensitivity: "80% FSH on #1 FBH (1/64\") reference, DAC required",
    transferCorrection: "Curvature correction required per bore radius",
    verificationRequirements: "Post-calibration within ֲ±2 dB of initial. Re-inspect if drift detected."
  },
  "NDIP-1260": {
    referenceBlockMaterial: "Titanium (Ti-6-4 or equivalent) - V2500 equivalent block",
    calibrationInterval: "Before each part, after setup changes, every 8 hours during continuous operation",
    dacCurvePoints: 8,
    primarySensitivity: "80% FSH on #1 FBH (1/64\") reference, DAC required",
    transferCorrection: "Curvature correction required per bore radius",
    verificationRequirements: "Post-calibration within ֲ±2 dB of initial. Re-inspect if drift detected."
  },
  // PWA SIM ג€” calibration requirements
  "PWA-SIM": {
    referenceBlockMaterial: "Same material as test part ג€” per PWA SIM 4E SIS 26B",
    calibrationInterval: "Before and after inspection",
    dacCurvePoints: 3,
    primarySensitivity: "80% FSH on 3/64\" FBH at 50% depth",
    transferCorrection: "Required when surface finish or geometry differs",
    verificationRequirements: "Verify before and after inspection, recalibrate if >2 dB change"
  },

  // ============================================================================
  // NEW STANDARDS - CALIBRATION REQUIREMENTS
  // ============================================================================

  "ASTM-E2375": {
    referenceBlockMaterial: "Same material specification and heat treatment as part",
    calibrationInterval: "Before each inspection, every 4 hours, and at completion",
    dacCurvePoints: 3,
    primarySensitivity: "80% FSH on reference reflector",
    transferCorrection: "Required when surface finish differs",
    verificationRequirements: "Verify at beginning, during (every 4 hrs), and end of inspection"
  },

  "ASTM-E127": {
    referenceBlockMaterial: "7075-T6 aluminum (Area-Amplitude set) or as specified",
    calibrationInterval: "Annual verification recommended",
    dacCurvePoints: 0, // N/A - this is the calibration block standard itself
    primarySensitivity: "80% FSH at standard immersion test parameters",
    transferCorrection: "N/A - defines calibration block fabrication",
    verificationRequirements: "Per section 9 - Verification tests including area-amplitude and distance-amplitude"
  },

  "ASTM-E164": {
    referenceBlockMaterial: "Same or acoustically similar material to base metal",
    calibrationInterval: "Before and after inspection",
    dacCurvePoints: 3,
    primarySensitivity: "Reference level as agreed between parties",
    transferCorrection: "Required for surface condition differences",
    verificationRequirements: "Verify before and after inspection, recalibrate if >2 dB change"
  },

  "AMS-2630": {
    referenceBlockMaterial: "Same material specification and heat treatment as part",
    calibrationInterval: "Before each part/configuration or shift, and at completion",
    dacCurvePoints: 3,
    primarySensitivity: "Class-specific reference response; maintain standardization within +/-10%",
    transferCorrection: "Required when surface finish, curvature, attenuation, or water path differs",
    verificationRequirements: "Shift is <=8 hours. Verify reference drift before/after; water path variation limited to +/-0.25\" (6.4mm)."
  },

  "ASTM-E1001": {
    referenceBlockMaterial: "Same or acoustically similar material; curved references within 10% radius when part radius <8\"",
    calibrationInterval: "Before inspection and after setup changes",
    dacCurvePoints: 3,
    primarySensitivity: "Reference echo at 80-90% of upper linear limit",
    transferCorrection: "Required for surface, curvature, attenuation, or water path differences",
    verificationRequirements: "Confirm reference echo/noise performance and agreed rejection threshold before production scanning."
  },

  "ASTM-E2580": {
    referenceBlockMaterial: "Representative composite/sandwich reference standard with agreed discontinuities",
    calibrationInterval: "Before inspection, after changes, and per procedure",
    dacCurvePoints: 1,
    primarySensitivity: "Reference discontinuity at 80% FSH where applicable; SNR >=3:1",
    transferCorrection: "Required for layup, thickness, surface, coupling, and attenuation differences",
    verificationRequirements: "System performance per ASTM E1324/E317 at least yearly; search unit checks per ASTM E1065/E1065M."
  },

  "ASTM-E588": {
    referenceBlockMaterial: "Bearing-quality steel reference for 1/64\" FBH equivalent inclusion sensitivity",
    calibrationInterval: "Before inspection and after completion",
    dacCurvePoints: 1,
    primarySensitivity: "Detect/report inclusions >=1/64\" FBH equivalent",
    transferCorrection: "Control water path/focus and specimen surface condition",
    verificationRequirements: "10 +/-0.5 MHz focused transducer, 8.2 +/-0.3\" focal length, beam symmetry variation <=15%, PRR >=500 pps."
  },

  "AMS-2631": {
    referenceBlockMaterial: "Ti-6Al-4V (AMS4928) or acoustically similar titanium alloy",
    calibrationInterval: "Before inspection, every 4 hours, and at completion",
    dacCurvePoints: 3,
    primarySensitivity: "80% FSH on reference FBH per applicable table",
    transferCorrection: "Required - titanium exhibits variable attenuation",
    verificationRequirements: "Verify at class-appropriate intervals. Block per ASTM E428/E1158 procedures."
  },

  "AMS-2632": {
    referenceBlockMaterial: "Same material specification as test part",
    calibrationInterval: "Before inspection, every 2 hours, and at completion",
    dacCurvePoints: 3,
    primarySensitivity: "80% FSH on near-surface reference reflector",
    transferCorrection: "Critical for thin section - measure on each part thickness",
    verificationRequirements: "More frequent verification due to thin material sensitivity"
  },

  "EN-ISO-16810": {
    referenceBlockMaterial: "Per referencing product standard (EN 10228 series, etc.)",
    calibrationInterval: "Per referencing document",
    dacCurvePoints: 3,
    primarySensitivity: "Per referencing document",
    transferCorrection: "Per referencing document",
    verificationRequirements: "Equipment per EN 12668. Calibration per referencing product standard."
  },
} satisfies Record<Exclude<StandardType, "MIL-STD-2154">, CalibrationRequirements>;

export const calibrationByStandard: Record<StandardType, CalibrationRequirements> = {
  ...calibrationByStandardBase,
  "MIL-STD-2154": calibrationByStandardBase["AMS-STD-2154E"],
};

// ============================================================================
// SPECIAL MATERIAL WARNINGS
// ============================================================================

export interface MaterialWarning {
  material: string;
  standard: StandardType;
  warning: string;
  recommendations: string[];
}

export const materialWarnings: MaterialWarning[] = [
  {
    material: "titanium",
    standard: "AMS-STD-2154E",
    warning: "Titanium requires special attention for Class AAA inspections",
    recommendations: [
      "Use lower frequencies (2.25-5 MHz) due to grain scatter",
      "Additional surface preparation may be required",
      "Consider grain flow direction in scan planning",
      "Chemical milling acceptable for surface preparation"
    ]
  },
  {
    material: "stainless_steel",
    standard: "BS-EN-10228-4",
    warning: "Austenitic stainless steel requires BS EN 10228-4 (not 10228-3)",
    recommendations: [
      "Use lowest practical frequencies (typically 0.5-2 MHz) within nominal 0.5-6 MHz range",
      "Larger probe diameter (20-30mm) recommended",
      "Account for high attenuation (0.05-0.20 dB/mm)",
      "Signal-to-noise ratio minimum 3:1, prefer 6:1",
      "More frequent calibration (every 2 hours)"
    ]
  },
  {
    material: "magnesium",
    standard: "AMS-STD-2154E",
    warning: "Magnesium has high attenuation - special considerations required",
    recommendations: [
      "Use lower frequencies (1-2.25 MHz)",
      "Non-corrosive couplant required",
      "Protective coating acceptable if < 0.05mm",
      "Consider higher sensitivity settings"
    ]
  },
  {
    material: "nickel",
    standard: "NDIP-1226",
    warning: "PW V2500 1st Stage HPT Disk ג€” Powdered Nickel alloy requires specific P&W equipment and calibration",
    recommendations: [
      "ONLY use IAE2P16679 transducer (5 MHz, 0.75\" element, 8\" focal length)",
      "ONLY use IAE2P16678 45ֲ° mirror ג€” must be fully seated on transducer",
      "Calibration block: IAE2P16675 (powdered nickel equivalent) ג€” yearly recertification at PW NDE",
      "Water path: 8.0\" per NDIP Section 5.1.1.2",
      "Inspector must hold PW POD qualification ג€” recertify every 6 months if inactive",
      "Electronic data transfer to PW MPE-NDE via MFT required"
    ]
  },
  {
    material: "nickel",
    standard: "NDIP-1227",
    warning: "PW V2500 2nd Stage HPT Disk ג€” Powdered Nickel alloy requires specific P&W equipment and calibration",
    recommendations: [
      "ONLY use IAE2P16679 transducer (5 MHz, 0.75\" element, 8\" focal length)",
      "ONLY use IAE2P16678 45ֲ° mirror ג€” must be fully seated on transducer",
      "Calibration block: IAE2P16675 (powdered nickel equivalent) ג€” yearly recertification at PW NDE",
      "Water path: 8.0\" per NDIP Section 7.5",
      "Inspector must hold PW POD qualification ג€” recertify every 6 months if inactive",
      "Electronic data transfer to PW MPE-NDE via MFT required"
    ]
  },
];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get the default acceptance class for a given standard
 */
export function getDefaultAcceptanceClass(standard: StandardType): string {
  const defaultsByStandardBase = {
    "AMS-STD-2154E": "A",
    "ASTM-A388": "QL2",
    "BS-EN-10228-3": "2", // Class 2 = Standard quality (not too stringent, not too lax)
    "BS-EN-10228-4": "2", // Class 2 = Standard quality (intermediate stringency)
    "NDIP-1226": "PW-V2500-1", // PW standard - single acceptance level
    "NDIP-1227": "PW-V2500-2", // PW standard - single acceptance level
    "NDIP-1254": "PW-GTF-HPT1", // PW1100G GTF HPT 1st Stage Hub
    "NDIP-1257": "PW-GTF-HPT2", // PW1100G GTF HPT 2nd Stage Hub
    "NDIP-1260": "PW-GTF-IBR8", // PW1100G GTF HPC 8th Stage IBR-8
    "PWA-SIM": "PWA-SIM-STD", // PWA Sonic Inspection Method
    // New standards
    "ASTM-E2375": "A", // Same as AMS-STD-2154E
    "ASTM-E127": "CALIBRATION", // Calibration block standard
    "ASTM-E164": "LEVEL-2", // Standard weld quality
    "AMS-2630": "A", // Standard AMS2630E class
    "ASTM-E1001": "CONTRACT", // Acceptance by contractual agreement
    "ASTM-E2580": "CONTRACT", // Acceptance by contractual agreement
    "ASTM-E588": "RATING", // Cleanliness rating, no acceptability limit
    "AMS-2631": "A", // Standard titanium class
    "AMS-2632": "A", // Standard thin materials class
    "EN-ISO-16810": "REFERENCE", // Framework standard
  } satisfies Record<Exclude<StandardType, "MIL-STD-2154">, string>;

  const defaults: Record<StandardType, string> = {
    ...defaultsByStandardBase,
    "MIL-STD-2154": defaultsByStandardBase["AMS-STD-2154E"],
  };

  return defaults[standard];
}

/**
 * Get FBH size based on standard, thickness and class
 */
export function getFBHSizeForStandard(
  standard: StandardType,
  thicknessMm: number,
  acceptanceClass: string
): string {
  // AMS-STD-2154E / MIL-STD-2154 Table VI single-discontinuity reference sizes are class-based.
  // ASTM-E2375 follows the same class scheme in this application.
  if (standard === "AMS-STD-2154E" || standard === "MIL-STD-2154" ||
      standard === "ASTM-E2375") {
    const classMap: Record<string, string> = {
      AAA: "1/64\" (0.4mm)",
      AA: "3/64\" (1.2mm)",
      A: "5/64\" (2.0mm)",
      B: "8/64\" (3.2mm)",
      C: "8/64\" (3.2mm)",
    };
    return classMap[acceptanceClass] || classMap["A"];
  }

  if (standard === "AMS-2630") {
    const classMap: Record<string, string> = {
      AA: "LW #3 FBH (1.2mm); angle beam #2 FBH (0.8mm)",
      A1: "LW/angle beam #3 FBH (1.2mm)",
      A: "LW/angle beam #5 FBH (2.0mm)",
      B: "LW/angle beam #8 FBH (3.2mm)",
      C: "By purchaser/vendor agreement",
    };
    return classMap[acceptanceClass] || classMap["A"];
  }

  if (standard === "ASTM-E1001") {
    return "Reference reflector and rejection threshold per contract";
  }

  if (standard === "ASTM-E2580") {
    return "Representative composite reference discontinuity per engineering requirement";
  }

  if (standard === "ASTM-E588") {
    return "1/64\" (0.4mm) FBH equivalent inclusion threshold";
  }

  if (standard === "ASTM-A388") {
    // ASTM A388 is by thickness only
    if (thicknessMm <= 38) return "1/16\" (1.6mm) - #1";
    if (thicknessMm <= 152) return "1/8\" (3.2mm) - #2";
    return "1/4\" (6.35mm) - #3";
  }

  // PW NDIP standards - fixed #1 FBH per spec
  if (standard === "NDIP-1226" || standard === "NDIP-1227" ||
      standard === "NDIP-1254" || standard === "NDIP-1257" || standard === "NDIP-1260") {
    return "#1 FBH (1/64\" / 0.4mm) - Per PW NDIP specification";
  }

  // PWA SIM - bar/billet/forging
  if (standard === "PWA-SIM") {
    return "3/64\" (1.2mm) FBH at 50% depth per PWA SIM 4E";
  }

  // ASTM E127 - calibration block standard
  if (standard === "ASTM-E127") {
    return "1/64\" to 8/64\" - Per ASTM E127 reference block specification";
  }

  // ASTM E164 - weldments (reference per agreement)
  if (standard === "ASTM-E164") {
    return "Per purchaser/manufacturer agreement - Typically SDH or FBH reference";
  }

  // AMS-2631 - Titanium (uses similar FBH sizes but specific to titanium)
  if (standard === "AMS-2631") {
    if (acceptanceClass === "AA") {
      if (thicknessMm <= 25.4) return "2/64\" (0.8mm)";
      return "3/64\" (1.2mm)";
    }
    if (acceptanceClass === "A") {
      if (thicknessMm <= 25.4) return "3/64\" (1.2mm)";
      return "5/64\" (2.0mm)";
    }
    if (acceptanceClass === "A1") {
      return "5/64\" (2.0mm)";
    }
    return "8/64\" (3.2mm)"; // Class B
  }

  // AMS-2632 - Thin materials (smaller FBH for thin sections)
  if (standard === "AMS-2632") {
    if (acceptanceClass === "AA") return "1/64\" (0.4mm)";
    if (acceptanceClass === "A") return "2/64\" (0.8mm)";
    if (acceptanceClass === "B") return "3/64\" (1.2mm)";
    return "5/64\" (2.0mm)"; // Class C
  }

  // EN-ISO-16810 - Framework standard (refer to product standard)
  if (standard === "EN-ISO-16810") {
    return "Per referencing product standard (EN 10228 series, etc.)";
  }

  // BS EN standards use metric
  if (thicknessMm < 50) return "3mm (0.118\")";
  if (thicknessMm < 150) return "5mm (0.197\")";
  return "8mm (0.315\")";
}

/**
 * Get recommended frequency for a standard and thickness
 */
export function getRecommendedFrequencyForStandard(
  standard: StandardType,
  thicknessMm: number
): string {
  if (standard === "BS-EN-10228-4") {
    // Austenitic - always use lower frequencies
    if (thicknessMm > 200) return "0.5 MHz";
    if (thicknessMm > 100) return "1 MHz";
    return "1-2 MHz";
  }

  if (standard === "ASTM-A388") {
    // Heavy forgings - lower frequencies
    if (thicknessMm > 150) return "1 MHz";
    if (thicknessMm > 75) return "2.25 MHz";
    return "2.25-5 MHz";
  }

  // PW NDIP standards - fixed 5 MHz per spec
  if (standard === "NDIP-1226" || standard === "NDIP-1227" ||
      standard === "NDIP-1254" || standard === "NDIP-1257" || standard === "NDIP-1260") {
    return "5 MHz (per PW NDIP specification)";
  }

  // PWA SIM - bar/billet/forging
  if (standard === "PWA-SIM") {
    return "5 MHz (per PWA 127)";
  }

  // ASTM E127 - calibration standard at 5 MHz
  if (standard === "ASTM-E127") {
    return "5 MHz (standard immersion test)";
  }

  // ASTM E164 - weldments
  if (standard === "ASTM-E164") {
    if (thicknessMm > 100) return "1-2.25 MHz";
    if (thicknessMm > 50) return "2.25 MHz";
    return "2.25-5 MHz";
  }

  if (standard === "AMS-2630") {
    if (thicknessMm > 50.8) return "2.25 MHz minimum longitudinal (use highest practical)";
    if (thicknessMm > 25.4) return "2.25-5 MHz";
    return "5-10 MHz";
  }

  if (standard === "ASTM-E1001") {
    if (thicknessMm > 50.8) return "2.25 MHz";
    if (thicknessMm > 25.4) return "5 MHz";
    return "5-10 MHz";
  }

  if (standard === "ASTM-E2580") {
    return "0.5-20 MHz selected for composite layup and required resolution";
  }

  if (standard === "ASTM-E588") {
    return "10 MHz (+/-0.5 MHz)";
  }

  // AMS-2631 - Titanium (lower frequencies for grain scatter)
  if (standard === "AMS-2631") {
    if (thicknessMm > 100) return "2.25 MHz";
    if (thicknessMm > 50) return "2.25-5 MHz";
    return "5 MHz";
  }

  // AMS-2632 - Thin materials (higher frequencies for resolution)
  if (standard === "AMS-2632") {
    if (thicknessMm < 6) return "10-15 MHz";
    if (thicknessMm < 10) return "10 MHz";
    return "5-10 MHz";
  }

  // EN-ISO-16810 - Framework standard
  if (standard === "EN-ISO-16810") {
    return "Per referencing product standard";
  }

  // AMS-STD-2154E, MIL-STD-2154, ASTM-E2375, BS EN 10228-3
  if (thicknessMm < 12.7) return "10 MHz";
  if (thicknessMm < 25.4) return "5 MHz";
  if (thicknessMm < 50.8) return "2.25 MHz";
  return "1-2.25 MHz";
}

/**
 * Check if a material is appropriate for a standard
 */
export function isAppropriateMaterialForStandard(
  material: string,
  standard: StandardType
): { appropriate: boolean; warning?: string; recommendedStandard?: StandardType } {
  if (material === "stainless_steel" && standard === "BS-EN-10228-3") {
    return {
      appropriate: false,
      warning: "Austenitic stainless steel should use BS EN 10228-4",
      recommendedStandard: "BS-EN-10228-4"
    };
  }

  if ((material === "aluminum" || material === "titanium" || material === "magnesium") &&
      (standard === "BS-EN-10228-3" || standard === "BS-EN-10228-4")) {
    return {
      appropriate: false,
      warning: "Non-ferrous materials should use AMS-STD-2154E",
      recommendedStandard: "AMS-STD-2154E"
    };
  }

  // AMS-2631 is specifically for titanium
  if (standard === "AMS-2631" && material !== "titanium") {
    return {
      appropriate: false,
      warning: "AMS-2631 is specifically for titanium materials",
      recommendedStandard: material === "aluminum" ? "AMS-STD-2154E" : "AMS-2630"
    };
  }

  // Recommend AMS-2631 for titanium bar/billet/plate
  if (material === "titanium" &&
      (standard === "AMS-STD-2154E" || standard === "AMS-2630" || standard === "ASTM-E2375")) {
    return {
      appropriate: true,
      warning: "Consider using AMS-2631 for titanium-specific requirements",
      recommendedStandard: "AMS-2631"
    };
  }

  // ASTM A388 is for steel forgings
  if (standard === "ASTM-A388" &&
      (material === "aluminum" || material === "titanium" || material === "magnesium")) {
    return {
      appropriate: false,
      warning: "ASTM A388 is for steel forgings only",
      recommendedStandard: "AMS-STD-2154E"
    };
  }

  // ASTM E164 is for ferrous and aluminum weldments
  if (standard === "ASTM-E164" &&
      (material === "titanium" || material === "magnesium")) {
    return {
      appropriate: false,
      warning: "ASTM E164 is designed for ferrous and aluminum alloys",
      recommendedStandard: "AMS-STD-2154E"
    };
  }

  return { appropriate: true };
}

/**
 * Get all parameters that change when switching to a new standard
 */
export function getChangedFieldsForStandard(standard: StandardType): string[] {
  return [
    "acceptanceClass",
    "singleDiscontinuity",
    "multipleDiscontinuities",
    "linearDiscontinuity",
    "backReflectionLoss",
    "noiseLevel",
    "frequency",
    "verticalLinearity",
    "horizontalLinearity",
    "scanSpeed",
    "scanIndex",
    "overlap",
    "fbhSizes",
    "calibrationFrequency",
    "recordRetention",
    "personnelCertification"
  ];
}


