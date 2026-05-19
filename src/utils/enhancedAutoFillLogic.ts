// @ts-nocheck
import { MaterialType, PartGeometry, StandardType, AcceptanceClass } from "@/types/techniqueSheet";

// ============= MATERIAL PROPERTIES DATABASE =============
interface MaterialProperties {
  velocity: number; // mm/µs (longitudinal wave)
  velocityShear: number; // mm/µs (shear wave)
  acousticImpedance: number; // MRayls
  attenuation: number; // dB/m at 5MHz
  density: number; // g/cm³
  surfaceCondition: string;
  typicalSpecs: string[];
}

export const materialDatabase: Record<MaterialType, MaterialProperties> = {
  aluminum: {
    velocity: 6.32, velocityShear: 3.08, acousticImpedance: 17.0, attenuation: 1.5, density: 2.7,
    surfaceCondition: "As-machined or better, Ra ≤ 6.3 μm",
    typicalSpecs: ["7075-T6 (QQ-A200/11)", "2024 (QQ-A-200/3)", "6061-T6", "2219-T87"]
  },
  steel: {
    velocity: 5.92, velocityShear: 3.25, acousticImpedance: 46.5, attenuation: 3.0, density: 7.85,
    surfaceCondition: "Ground or machined, Ra ≤ 3.2 μm",
    typicalSpecs: ["4340 annealed (MIL-S-5000)", "4130", "17-4 PH", "15-5 PH"]
  },
  stainless_steel: {
    velocity: 5.79, velocityShear: 3.10, acousticImpedance: 45.4, attenuation: 2.5, density: 7.9,
    surfaceCondition: "Ground or machined, Ra ≤ 3.2 μm, passivated acceptable",
    typicalSpecs: ["304 (AMS 5513)", "316 (AMS 5524)", "17-4 PH (AMS 5604)", "15-5 PH (AMS 5659)", "410", "420"]
  },
  titanium: {
    velocity: 6.10, velocityShear: 3.12, acousticImpedance: 27.3, attenuation: 4.5, density: 4.5,
    surfaceCondition: "Machined, Ra ≤ 6.3 μm, chemical milled acceptable",
    typicalSpecs: ["Ti-6Al-4V annealed (AMS 4928)", "Ti-6Al-4V STA", "Ti-5Al-2.5Sn", "CP Ti Grade 2"]
  },
  magnesium: {
    velocity: 5.77, velocityShear: 3.05, acousticImpedance: 10.0, attenuation: 8.0, density: 1.74,
    surfaceCondition: "Machined, protective coating acceptable if <0.05mm",
    typicalSpecs: ["ZK60A (QQ-M-31)", "AZ31B", "AZ80A", "ZE41A"]
  },
  nickel_alloy: {
    velocity: 5.82, velocityShear: 3.02, acousticImpedance: 47.8, attenuation: 3.5, density: 8.19,
    surfaceCondition: "Ground or machined, Ra ≤ 3.2 μm",
    typicalSpecs: ["Inconel 718 (AMS 5662)", "Waspaloy (AMS 5544)", "Inconel 625 (AMS 5666)", "Rene 41", "Hastelloy X"]
  },
  custom: {
    velocity: 5.90, velocityShear: 3.20, acousticImpedance: 30.0, attenuation: 3.0, density: 5.0,
    surfaceCondition: "Custom material - verify surface condition",
    typicalSpecs: ["Custom Specification"]
  }
};

// ============= STANDARD-BASED AUTO-FILL RULES =============
interface StandardRules {
  defaultAcceptanceClass: AcceptanceClass;
  minThickness: number; // mm
  typicalFrequencies: string[];
  couplantRecommendations: string[];
  scanCoverageDefault: number; // percentage
  linearityRequirements: {
    vertical: { min: number; max: number };
    horizontal: { min: number };
  };
}

export const standardRules: Record<StandardType, StandardRules> = {
  "MIL-STD-2154": {
    defaultAcceptanceClass: "A", minThickness: 6.35,
    typicalFrequencies: ["2.25", "5.0", "10.0"],
    couplantRecommendations: ["Water (Immersion)", "Glycerin", "Commercial Gel (Sono 600)"],
    scanCoverageDefault: 100,
    linearityRequirements: { vertical: { min: 5, max: 98 }, horizontal: { min: 90 } }
  },
  "AMS-STD-2154E": {
    defaultAcceptanceClass: "A", minThickness: 6.35,
    typicalFrequencies: ["2.25", "5.0", "10.0"],
    couplantRecommendations: ["Water (Immersion)", "Glycerin", "Commercial Gel (Sono 600)"],
    scanCoverageDefault: 100,
    linearityRequirements: { vertical: { min: 5, max: 98 }, horizontal: { min: 90 } }
  },
  "ASTM-A388": {
    defaultAcceptanceClass: "B", minThickness: 25.4,
    typicalFrequencies: ["1.0", "2.25", "5.0"],
    couplantRecommendations: ["SAE No. 20 Motor Oil", "SAE No. 30 Motor Oil", "Glycerin", "Pine Oil", "Water"],
    scanCoverageDefault: 100,
    linearityRequirements: { vertical: { min: 10, max: 95 }, horizontal: { min: 85 } }
  },
  "BS-EN-10228-3": {
    defaultAcceptanceClass: "A", minThickness: 10,
    typicalFrequencies: ["1.0", "2.0", "4.0", "5.0", "6.0"],
    couplantRecommendations: ["Oil (mineral)", "Water with wetting agent", "Glycerin", "Cellulose paste", "Commercial couplants"],
    scanCoverageDefault: 100,
    linearityRequirements: { vertical: { min: 80, max: 100 }, horizontal: { min: 0 } }
  },
  "BS-EN-10228-4": {
    defaultAcceptanceClass: "A", minThickness: 20,
    typicalFrequencies: ["0.5", "1.0", "2.0", "4.0", "5.0", "6.0"],
    couplantRecommendations: ["Oil (mineral)", "Water with wetting agent", "Glycerin", "Commercial couplants"],
    scanCoverageDefault: 100,
    linearityRequirements: { vertical: { min: 80, max: 100 }, horizontal: { min: 0 } }
  },
  "NDIP-1226": {
    defaultAcceptanceClass: "A", minThickness: 6.35,
    typicalFrequencies: ["5.0"],
    couplantRecommendations: ["Water (Immersion) — 8\" water path per NDIP-1226 Section 5.1.1.2"],
    scanCoverageDefault: 100,
    linearityRequirements: { vertical: { min: 5, max: 98 }, horizontal: { min: 90 } }
  },
  "NDIP-1227": {
    defaultAcceptanceClass: "A", minThickness: 6.35,
    typicalFrequencies: ["5.0"],
    couplantRecommendations: ["Water (Immersion) — 8\" water path per NDIP-1227"],
    scanCoverageDefault: 100,
    linearityRequirements: { vertical: { min: 5, max: 98 }, horizontal: { min: 90 } }
  },
  "NDIP-1254": {
    defaultAcceptanceClass: "A", minThickness: 6.35,
    typicalFrequencies: ["5.0"],
    couplantRecommendations: ["Water (Immersion) — AUSI per PW1100G NDIP-1254"],
    scanCoverageDefault: 100,
    linearityRequirements: { vertical: { min: 5, max: 98 }, horizontal: { min: 90 } }
  },
  "NDIP-1257": {
    defaultAcceptanceClass: "A", minThickness: 6.35,
    typicalFrequencies: ["5.0"],
    couplantRecommendations: ["Water (Immersion) — AUSI per PW1100G NDIP-1257"],
    scanCoverageDefault: 100,
    linearityRequirements: { vertical: { min: 5, max: 98 }, horizontal: { min: 90 } }
  },
  "NDIP-1260": {
    defaultAcceptanceClass: "A", minThickness: 6.35,
    typicalFrequencies: ["5.0"],
    couplantRecommendations: ["Water (Immersion) — AUSI per PW1100G NDIP-1260"],
    scanCoverageDefault: 100,
    linearityRequirements: { vertical: { min: 5, max: 98 }, horizontal: { min: 90 } }
  },
  "PWA-SIM": {
    defaultAcceptanceClass: "A", minThickness: 6.35,
    typicalFrequencies: ["5.0"],
    couplantRecommendations: ["Water (Immersion)", "Glycerin"],
    scanCoverageDefault: 100,
    linearityRequirements: { vertical: { min: 5, max: 98 }, horizontal: { min: 90 } }
  },
  "ASTM-E2375": {
    defaultAcceptanceClass: "A", minThickness: 6.35,
    typicalFrequencies: ["2.25", "5.0", "10.0"],
    couplantRecommendations: ["Water (Immersion)", "Glycerin", "Commercial Gel (Sono 600)"],
    scanCoverageDefault: 100,
    linearityRequirements: { vertical: { min: 5, max: 98 }, horizontal: { min: 90 } }
  },
  "ASTM-E1001": {
    defaultAcceptanceClass: "CONTRACT", minThickness: 0,
    typicalFrequencies: ["2.25", "5.0", "10.0", "15.0"],
    couplantRecommendations: ["Water (Immersion)"],
    scanCoverageDefault: 100,
    linearityRequirements: { vertical: { min: 5, max: 98 }, horizontal: { min: 90 } }
  },
  "ASTM-E2580": {
    defaultAcceptanceClass: "CONTRACT", minThickness: 0,
    typicalFrequencies: ["0.5", "2.25", "5.0", "10.0", "15.0", "20.0"],
    couplantRecommendations: ["Water (Immersion)", "Water with approved wetting agent"],
    scanCoverageDefault: 100,
    linearityRequirements: { vertical: { min: 5, max: 98 }, horizontal: { min: 90 } }
  },
  "ASTM-E588": {
    defaultAcceptanceClass: "RATING", minThickness: 0,
    typicalFrequencies: ["10.0"],
    couplantRecommendations: ["Water (Immersion)"],
    scanCoverageDefault: 100,
    linearityRequirements: { vertical: { min: 5, max: 98 }, horizontal: { min: 90 } }
  },
  "ASTM-E127": {
    defaultAcceptanceClass: "A", minThickness: 0,
    typicalFrequencies: ["5.0"],
    couplantRecommendations: ["Water (Immersion)"],
    scanCoverageDefault: 100,
    linearityRequirements: { vertical: { min: 5, max: 98 }, horizontal: { min: 90 } }
  },
  "ASTM-E164": {
    defaultAcceptanceClass: "A", minThickness: 6.4,
    typicalFrequencies: ["1.0", "2.25", "5.0"],
    couplantRecommendations: ["Glycerin", "Commercial Gel", "Oil"],
    scanCoverageDefault: 100,
    linearityRequirements: { vertical: { min: 10, max: 95 }, horizontal: { min: 85 } }
  },
  "AMS-2630": {
    defaultAcceptanceClass: "A", minThickness: 12.7,
    typicalFrequencies: ["2.25", "5.0", "10.0", "15.0"],
    couplantRecommendations: ["Water (Immersion)", "Glycerin", "Commercial Gel"],
    scanCoverageDefault: 100,
    linearityRequirements: { vertical: { min: 5, max: 98 }, horizontal: { min: 90 } }
  },
  "AMS-2631": {
    defaultAcceptanceClass: "A", minThickness: 6.35,
    typicalFrequencies: ["2.25", "5.0", "10.0"],
    couplantRecommendations: ["Water (Immersion)", "Glycerin"],
    scanCoverageDefault: 100,
    linearityRequirements: { vertical: { min: 5, max: 95 }, horizontal: { min: 90 } }
  },
  "AMS-2632": {
    defaultAcceptanceClass: "A", minThickness: 0.5,
    typicalFrequencies: ["5.0", "10.0", "15.0"],
    couplantRecommendations: ["Water (Immersion)", "Glycerin"],
    scanCoverageDefault: 100,
    linearityRequirements: { vertical: { min: 5, max: 98 }, horizontal: { min: 90 } }
  },
  "EN-ISO-16810": {
    defaultAcceptanceClass: "A", minThickness: 0,
    typicalFrequencies: ["0.5", "1.0", "2.0", "5.0"],
    couplantRecommendations: ["Per referencing product standard"],
    scanCoverageDefault: 100,
    linearityRequirements: { vertical: { min: 80, max: 100 }, horizontal: { min: 0 } }
  }
};

// ============= GEOMETRY-BASED RECOMMENDATIONS =============
interface GeometryRecommendations {
  calibrationBlockType: string[];
  scanPattern: string;
  transducerType: "immersion" | "contact" | "dual_element";
  specialConsiderations: string;
}

export const geometryRecommendations: Record<PartGeometry, GeometryRecommendations> = {
  box: { calibrationBlockType: ["flat_block"], scanPattern: "Raster scan or straight beam perpendicular to surface", transducerType: "immersion", specialConsiderations: "Versatile geometry - adjust scan pattern based on W/T ratio" },
  cylinder: { calibrationBlockType: ["flat_block", "cylinder_fbh"], scanPattern: "Radial scan from circumference and/or axial scan", transducerType: "immersion", specialConsiderations: "Full circumferential coverage - use curved block if diameter permits" },
  tube: { calibrationBlockType: ["cylinder_fbh", "cylinder_notched", "curved_block"], scanPattern: "Helical or circumferential scan", transducerType: "immersion", specialConsiderations: "Check both ID and OD surfaces, wall thickness variation" },
  rectangular_tube: { calibrationBlockType: ["flat_block"], scanPattern: "Full perimeter scan with indexed coverage", transducerType: "contact", specialConsiderations: "Check all four faces and corners" },
  hexagon: { calibrationBlockType: ["flat_block"], scanPattern: "Scan from three adjacent faces minimum", transducerType: "contact", specialConsiderations: "When T exceeds attenuation limit, scan from opposite sides" },
  sphere: { calibrationBlockType: ["curved_block"], scanPattern: "Multi-angle spherical coverage", transducerType: "immersion", specialConsiderations: "Requires immersion tank with positioning system" },
  cone: { calibrationBlockType: ["flat_block", "curved_block"], scanPattern: "Axial and circumferential", transducerType: "immersion", specialConsiderations: "Conical shape requires angle-compensated scanning" },
  plate: { calibrationBlockType: ["flat_block"], scanPattern: "Raster scan, 0° and 90° directions", transducerType: "immersion", specialConsiderations: "If W/T > 5, check laminar discontinuities. If W or T > 228.6mm, scan from opposite side." },
  flat_bar: { calibrationBlockType: ["flat_block"], scanPattern: "Straight beam perpendicular to surface", transducerType: "immersion", specialConsiderations: "Same as plate - If W/T > 5. Surface resolution requirements for thick sections." },
  rectangular_bar: { calibrationBlockType: ["flat_block"], scanPattern: "Scan from two adjacent sides", transducerType: "contact", specialConsiderations: "If W/T < 5, scan from two adjacent sides. If T or W > 228.6mm, scan from opposite sides." },
  round_bar: { calibrationBlockType: ["flat_block"], scanPattern: "Radial scan from circumference", transducerType: "immersion", specialConsiderations: "Full circumferential coverage required. Axial scan from end face." },
  round_forging_stock: { calibrationBlockType: ["flat_block", "curved_block"], scanPattern: "Radial and axial scans", transducerType: "immersion", specialConsiderations: "Consider grain structure orientation. Full coverage required." },
  ring_forging: { calibrationBlockType: ["curved_block", "cylinder_fbh"], scanPattern: "Radial, axial, and circumferential shear wave", transducerType: "immersion", specialConsiderations: "CRITICAL: If thickness > 20% OD or L/T < 5, special scans required. Circumferential shear wave per Appendix A." },
  disk_forging: { calibrationBlockType: ["flat_block"], scanPattern: "From flat face and radially from circumference", transducerType: "immersion", specialConsiderations: "Scan from at least one flat face. Radial scan from circumference when practical." },
  hex_bar: { calibrationBlockType: ["flat_block"], scanPattern: "Scan from three adjacent faces", transducerType: "contact", specialConsiderations: "When T exceeds attenuation limit, scan from opposite sides. Three-face coverage minimum." },
  bar: { calibrationBlockType: ["flat_block"], scanPattern: "Longitudinal scan along bar axis", transducerType: "contact", specialConsiderations: "Generic bar - use specific type (round_bar, rectangular_bar, etc.) if known" },
  forging: { calibrationBlockType: ["curved_block", "flat_block"], scanPattern: "Contour following, multiple orientations", transducerType: "contact", specialConsiderations: "Generic forging - use specific type if known. Match calibration block to part curvature." },
  ring: { calibrationBlockType: ["curved_block", "cylinder_fbh"], scanPattern: "Circumferential scan, axial and radial", transducerType: "immersion", specialConsiderations: "Generic ring - use ring_forging if applicable. Curvature compensation required." },
  disk: { calibrationBlockType: ["flat_block"], scanPattern: "Radial and circumferential patterns", transducerType: "immersion", specialConsiderations: "Generic disk - use disk_forging if applicable. Center bore and rim inspection critical." },
  sheet: { calibrationBlockType: ["flat_block"], scanPattern: "Two-axis raster scan", transducerType: "immersion", specialConsiderations: "Similar to plate. Check laminar discontinuities." },
  slab: { calibrationBlockType: ["flat_block"], scanPattern: "Two-axis raster with diagonal passes", transducerType: "immersion", specialConsiderations: "Heavy section, may require multi-side scanning." },
  square_bar: { calibrationBlockType: ["flat_block"], scanPattern: "Scan from adjacent faces", transducerType: "contact", specialConsiderations: "Similar to rectangular bar, ensure corner coverage." },
  pipe: { calibrationBlockType: ["cylinder_fbh", "cylinder_notched"], scanPattern: "Helical or circumferential scan", transducerType: "immersion", specialConsiderations: "Same as tube. Check both ID and OD surfaces." },
  shaft: { calibrationBlockType: ["flat_block"], scanPattern: "Axial and circumferential scans", transducerType: "immersion", specialConsiderations: "Localized radial scans at critical sections (shoulders, keyways)." },
  billet: { calibrationBlockType: ["flat_block"], scanPattern: "Two-axis raster in orthogonal directions", transducerType: "immersion", specialConsiderations: "Add diagonal passes if needed. Large cross-section." },
  block: { calibrationBlockType: ["flat_block"], scanPattern: "Two-axis raster through-thickness", transducerType: "immersion", specialConsiderations: "Similar to billet. Check for internal voids." },
  sleeve: { calibrationBlockType: ["cylinder_fbh"], scanPattern: "Circumferential and radial through wall", transducerType: "immersion", specialConsiderations: "Short hollow cylinder. Similar to tube but shorter axial length." },
  bushing: { calibrationBlockType: ["cylinder_fbh"], scanPattern: "Circumferential and radial scans", transducerType: "contact", specialConsiderations: "Short hollow cylinder. Check wall thickness uniformity." },
  pyramid: { calibrationBlockType: ["flat_block"], scanPattern: "Raster scan on accessible faces with indexed coverage", transducerType: "immersion", specialConsiderations: "Treat as prismatic block; ensure apex region coverage." },
  ellipse: { calibrationBlockType: ["flat_block"], scanPattern: "Radial coverage with indexed circumferential positions", transducerType: "immersion", specialConsiderations: "Elliptical section behaves like cylinder with varying curvature." },
  irregular: { calibrationBlockType: ["flat_block"], scanPattern: "Drawing-specific with contour following", transducerType: "contact", specialConsiderations: "Irregular geometry requires adaptive scan planning." },
  l_profile: { calibrationBlockType: ["flat_block"], scanPattern: "Axial along legs with indexed transverse scans", transducerType: "contact", specialConsiderations: "Scan both legs separately; pay attention to corner/fillet regions." },
  t_profile: { calibrationBlockType: ["flat_block"], scanPattern: "Axial along stem and flange with indexed scans", transducerType: "contact", specialConsiderations: "T-section requires multiple orientations to cover stem/flange intersection." },
  i_profile: { calibrationBlockType: ["flat_block"], scanPattern: "Axial with indexed scans on flanges and web", transducerType: "contact", specialConsiderations: "I-section requires scanning from multiple surfaces." },
  u_profile: { calibrationBlockType: ["flat_block"], scanPattern: "Axial and transverse indexed scans", transducerType: "contact", specialConsiderations: "U-channel requires coverage of all faces." },
  z_profile: { calibrationBlockType: ["flat_block"], scanPattern: "Axial with indexed transverse scans", transducerType: "contact", specialConsiderations: "Z-section requires multi-surface coverage." },
  z_section: { calibrationBlockType: ["flat_block"], scanPattern: "Axial with indexed transverse scans", transducerType: "contact", specialConsiderations: "Z-section requires multi-surface coverage." },
  custom_profile: { calibrationBlockType: ["flat_block"], scanPattern: "Drawing-specific", transducerType: "contact", specialConsiderations: "Custom profile - follow engineering drawing." },
  extrusion_l: { calibrationBlockType: ["flat_block"], scanPattern: "Axial along extrusion, indexed transverse scans", transducerType: "contact", specialConsiderations: "Scan flanges and web separately." },
  extrusion_t: { calibrationBlockType: ["flat_block"], scanPattern: "Axial and indexed transverse scans per feature", transducerType: "contact", specialConsiderations: "T-section requires multi-orientation scans." },
  extrusion_i: { calibrationBlockType: ["flat_block"], scanPattern: "Axial with indexed scans on flanges and web", transducerType: "contact", specialConsiderations: "I-beam geometry, scan from multiple surfaces." },
  extrusion_u: { calibrationBlockType: ["flat_block"], scanPattern: "Axial and transverse indexed scans", transducerType: "contact", specialConsiderations: "U-channel requires coverage of all faces." },
  extrusion_channel: { calibrationBlockType: ["flat_block"], scanPattern: "Axial with indexed transverse scans", transducerType: "contact", specialConsiderations: "Similar to U-extrusion." },
  extrusion_angle: { calibrationBlockType: ["flat_block"], scanPattern: "Axial along legs, radial from edges", transducerType: "contact", specialConsiderations: "Angle section requires scans along both legs." },
  square_tube: { calibrationBlockType: ["flat_block", "curved_block"], scanPattern: "Full perimeter scan", transducerType: "contact", specialConsiderations: "Check all four faces uniformly." },
  rectangular_forging_stock: { calibrationBlockType: ["flat_block"], scanPattern: "Axial and transverse", transducerType: "immersion", specialConsiderations: "Check for forging defects and grain structure." },
  hub: { calibrationBlockType: ["cylinder_fbh", "flat_block"], scanPattern: "Radial and circumferential", transducerType: "immersion", specialConsiderations: "Complex geometry requires multi-angle approach." },
  near_net_forging: { calibrationBlockType: ["flat_block", "curved_block"], scanPattern: "Contour following with indexed coverage", transducerType: "immersion", specialConsiderations: "Near-net shape requires adaptive scanning." },
  machined_component: { calibrationBlockType: ["flat_block"], scanPattern: "Drawing-specific", transducerType: "contact", specialConsiderations: "Follow parent form inspection method." },
  impeller: { calibrationBlockType: ["flat_block", "curved_block", "cylinder_notched"], scanPattern: "Multi-zone: Hub, Web, Rim. Bore: circumferential shear wave 45°", transducerType: "immersion", specialConsiderations: "CRITICAL: Stepped geometry requires zone-by-zone inspection. Class AAA per AMS-STD-2154." },
  blisk: { calibrationBlockType: ["flat_block", "curved_block", "cylinder_notched"], scanPattern: "Disk body: radial/axial. Blade roots: focused beam. Bore: circumferential shear wave 45°", transducerType: "immersion", specialConsiderations: "CRITICAL: Dual inspection zones - Disk body + Blade roots. Class AAA mandatory." },
  hpt_disk: { calibrationBlockType: ["flat_block", "cylinder_notched", "angle_beam"], scanPattern: "Face: straight beam. Bore: circumferential shear wave ±45°", transducerType: "immersion", specialConsiderations: "Engine HPT disk geometry. Use straight-beam face coverage and validate whether bore shear-wave inspection is required by the active OEM/customer procedure. Apply NDIP-specific TOF and acceptance criteria only when NDIP-1226/1227 is the active standard." },
  custom: { calibrationBlockType: ["flat_block"], scanPattern: "Drawing-specific", transducerType: "contact", specialConsiderations: "Refer to engineering drawing and customer specifications." }
};

// ============= FBH SIZE RECOMMENDATION =============
export function getFBHSizeRecommendation(material: MaterialType, frequency: string, thickness: number): string[] {
  const freq = parseFloat(frequency);
  const wavelength = materialDatabase[material].velocity / freq;
  const minFBH = Math.round(wavelength * 0.25 * 10) / 10;
  const maxFBH = Math.round(wavelength * 10) / 10;
  const standardSizes = [1.6, 2.0, 2.4, 3.2, 4.0, 4.8, 6.4, 8.0, 9.5];
  const recommended = standardSizes.filter(size => size >= minFBH && size <= maxFBH);
  if (thickness < 25) {
    return recommended.filter(s => s <= 4.8).map(s => `${s}mm (${(s/25.4).toFixed(3)}")`);
  }
  return recommended.slice(0, 3).map(s => `${s}mm (${(s/25.4).toFixed(3)}")`);
}

// ============= TABLE VI - ULTRASONIC CLASSES (AMS-STD-2154E / MIL-STD-2154) =============
// Corrected January 2026 - Values now match standardsDifferences.ts (FBH-based, not DAC%)
export interface AcceptanceLimitsEnhanced {
  singleDiscontinuity: string;
  multipleDiscontinuities: string;
  linearDiscontinuity: string;
  backReflectionLoss: number;
  noiseLevel: string;
  specialNotes?: string;
}

export const TABLE_VI_ACCEPTANCE_LIMITS: Record<AcceptanceClass, AcceptanceLimitsEnhanced> = {
  "AAA": {
    // Table VI: AAA uses percent-of-response criteria for multiple/linear/noise.
    singleDiscontinuity: "1/64\" (0.4mm) OR 25% of 3/64\" response",
    multipleDiscontinuities: "10% of 3/64\" response (centers <1\" apart)",
    linearDiscontinuity: "10% of 3/64\" response, 1/8\" max length",
    backReflectionLoss: 50,
    noiseLevel: "10% of 3/64\" response (see Note 5)",
    specialNotes: "Most stringent - for rotating turbine components. Titanium (Table VI Note 6): AAA multiple discontinuity = 1/8\" max length at 2/64 response; noise N/A. Titanium AA: multiple discontinuity = 1/4\" max length at 2/64 response (or greater); linear criteria N/A."
  },
  "AA": {
    singleDiscontinuity: "3/64\" (1.2mm) FBH response",
    multipleDiscontinuities: "2/64\" (0.8mm) FBH (centers <1\" apart)",
    linearDiscontinuity: "2/64\" (0.8mm) FBH, 1/2\" max length",
    backReflectionLoss: 50,
    noiseLevel: "Alarm level (see 5.2.3)",
    specialNotes: "For engine mounts, landing gear primary structure, rotor hubs"
  },
  "A": {
    singleDiscontinuity: "5/64\" (2.0mm) FBH response",
    // MIL-STD-2154 Table VI: Class A multiple discontinuities = 3/64 response
    multipleDiscontinuities: "3/64\" (1.2mm) FBH (centers <1\" apart)",
    linearDiscontinuity: "3/64\" (1.2mm) FBH, 1\" max length",
    backReflectionLoss: 50,
    noiseLevel: "Alarm level (see 5.2.3)",
    specialNotes: "For primary airframe structure, engine and transmission components"
  },
  "B": {
    singleDiscontinuity: "8/64\" (3.2mm) FBH response",
    // MIL-STD-2154 Table VI: Class B multiple discontinuities = 5/64 response
    multipleDiscontinuities: "5/64\" (2.0mm) FBH (centers <1\" apart)",
    linearDiscontinuity: "5/64\" (2.0mm) FBH, 1\" max length",
    backReflectionLoss: 50,
    noiseLevel: "Alarm level (see 5.2.3)",
    specialNotes: "For secondary structure, non-flight critical components"
  },
  "C": {
    singleDiscontinuity: "8/64\" (3.2mm) FBH response",
    // MIL-STD-2154 Table VI Note 2: multiple discontinuities criteria not applicable to Class C
    multipleDiscontinuities: "Not applicable",
    linearDiscontinuity: "Not applicable",
    backReflectionLoss: 50,
    noiseLevel: "Alarm level (see 5.2.3)",
    specialNotes: "For non-structural components, tooling, ground support. No linear discontinuity limits."
  }
};

// ============= DEPRECATED ACCEPTANCE LIMITS =============
// @deprecated Use acceptanceCriteriaByStandard from '@/data/standardsDifferences' instead
export const acceptanceLimits = TABLE_VI_ACCEPTANCE_LIMITS;

// ============= SOUND BEAM DIRECTION RULES =============
export interface GeometryInspectionRules {
  displayName: string;
  scanDirection: string[];
  waveMode: string[];
  conditions: string[];
  specialNotes: string[];
  diagramReference?: string;
}

export const GEOMETRY_INSPECTION_RULES: Record<PartGeometry, GeometryInspectionRules> = {
  // ============= BASE GEOMETRIES =============
  box: {
    displayName: "Box (Plates, Bars, Blocks)",
    scanDirection: ["Straight beam perpendicular to surface", "Multi-axis raster"],
    waveMode: ["Longitudinal"],
    conditions: ["Adjust scan pattern based on W/T ratio", "Consider surface resolution requirements"],
    specialNotes: ["Versatile geometry - use dimensional parameters to adapt inspection"],
    diagramReference: "Base Geometry - Box"
  },
  cylinder: {
    displayName: "Cylinder (Bars, Shafts, Disks)",
    scanDirection: ["Radial scan from circumference", "Axial scan", "Circumferential scan"],
    waveMode: ["Longitudinal"],
    conditions: ["Full coverage required", "Use appropriate calibration block"],
    specialNotes: ["Adapt to length/diameter ratio"],
    diagramReference: "Base Geometry - Cylinder"
  },
  tube: {
    displayName: "Tube (Hollow Cylinders, Rings)",
    scanDirection: ["Helical scan", "Circumferential scan", "Radial through wall"],
    waveMode: ["Longitudinal"],
    conditions: ["Check both ID and OD surfaces", "Monitor wall thickness variation"],
    specialNotes: ["Immersion technique preferred"],
    diagramReference: "Base Geometry - Tube"
  },
  rectangular_tube: {
    displayName: "Rectangular Tube",
    scanDirection: ["Perimeter scan", "Indexed coverage"],
    waveMode: ["Longitudinal"],
    conditions: ["Check all four faces"],
    specialNotes: ["Inspect corners and welds if applicable"],
    diagramReference: "Base Geometry - Rectangular Tube"
  },
  hexagon: {
    displayName: "Hexagon Bar",
    scanDirection: ["From three adjacent faces minimum"],
    waveMode: ["Longitudinal"],
    conditions: ["Scan with straight beam from three adjacent faces"],
    specialNotes: ["May require scanning from opposite sides for thick sections"],
    diagramReference: "Base Geometry - Hexagon"
  },
  sphere: {
    displayName: "Sphere",
    scanDirection: ["Multi-angle spherical"],
    waveMode: ["Longitudinal"],
    conditions: ["Immersion required"],
    specialNotes: ["Positioning system needed"],
    diagramReference: "Base Geometry - Sphere"
  },
  cone: {
    displayName: "Cone",
    scanDirection: ["Axial", "Circumferential"],
    waveMode: ["Longitudinal"],
    conditions: ["Angle-compensated scanning"],
    specialNotes: ["Account for taper angle"],
    diagramReference: "Base Geometry - Cone"
  },

  // ============= ADDITIONAL GEOMETRIES / PROFILES =============
  pyramid: {
    displayName: "Pyramid",
    scanDirection: ["Raster scan on accessible faces", "Indexed coverage / multiple orientations"],
    waveMode: ["Longitudinal"],
    conditions: ["Treat as prismatic block; ensure coverage near apex"],
    specialNotes: ["May require multiple setups to maintain normal incidence"],
    diagramReference: "Special Geometry - Pyramid"
  },
  ellipse: {
    displayName: "Ellipse",
    scanDirection: ["Radial scan from perimeter", "Indexed circumferential positions"],
    waveMode: ["Longitudinal"],
    conditions: ["Varying curvature - adjust coupling and beam entry"],
    specialNotes: ["Similar to cylinder, but curvature changes with angle"],
    diagramReference: "Special Geometry - Ellipse"
  },
  irregular: {
    displayName: "Irregular",
    scanDirection: ["Drawing-specific contour following", "Feature-by-feature inspection"],
    waveMode: ["Longitudinal"],
    conditions: ["Define scan zones from drawing/CAD"],
    specialNotes: ["Validate coverage map against part geometry"],
    diagramReference: "Special Geometry - Irregular"
  },
  l_profile: {
    displayName: "L-Profile (Angle)",
    scanDirection: ["Axial along legs", "Indexed transverse scans"],
    waveMode: ["Longitudinal"],
    conditions: ["Scan both legs separately"],
    specialNotes: ["Pay attention to corner/fillet regions"],
    diagramReference: "Profile - L"
  },
  t_profile: {
    displayName: "T-Profile",
    scanDirection: ["Axial along stem and flange", "Indexed transverse scans"],
    waveMode: ["Longitudinal"],
    conditions: ["Multiple orientations to cover stem/flange intersection"],
    specialNotes: ["Ensure coverage of junction region"],
    diagramReference: "Profile - T"
  },
  i_profile: {
    displayName: "I-Profile",
    scanDirection: ["Axial along web and flanges", "Indexed scans per surface"],
    waveMode: ["Longitudinal"],
    conditions: ["Scan from multiple surfaces"],
    specialNotes: ["Web/flange junctions are critical"],
    diagramReference: "Profile - I"
  },
  u_profile: {
    displayName: "U-Profile (Channel)",
    scanDirection: ["Axial along channel", "Indexed transverse scans"],
    waveMode: ["Longitudinal"],
    conditions: ["Cover web and both flanges"],
    specialNotes: ["Verify coupling on inside corner radii"],
    diagramReference: "Profile - U"
  },
  z_profile: {
    displayName: "Z-Profile",
    scanDirection: ["Axial along profile", "Indexed transverse scans"],
    waveMode: ["Longitudinal"],
    conditions: ["Cover offsets and all faces"],
    specialNotes: ["Check coupling across step changes"],
    diagramReference: "Profile - Z"
  },
  z_section: {
    displayName: "Z-Section",
    scanDirection: ["Axial along section", "Indexed transverse scans"],
    waveMode: ["Longitudinal"],
    conditions: ["Cover offsets and all faces"],
    specialNotes: ["Check coupling across step changes"],
    diagramReference: "Profile - Z Section"
  },
  custom_profile: {
    displayName: "Custom Profile",
    scanDirection: ["Drawing-specific", "Feature-by-feature inspection"],
    waveMode: ["Longitudinal"],
    conditions: ["Define scan zones from drawing"],
    specialNotes: ["Use conservative overlap and validate coverage"],
    diagramReference: "Profile - Custom"
  },

  // ============= LEGACY MAPPINGS =============
  plate: {
    displayName: "Plate and Flat Bar",
    scanDirection: ["Straight beam perpendicular to surface"],
    waveMode: ["Longitudinal"],
    conditions: [
      "If W/T > 5, scan with straight beam as shown",
      "If W or T > 9 inches (228.6 mm), surface resolution may require scanning from opposite side"
    ],
    specialNotes: ["Check for laminar discontinuities", "Monitor back reflection loss"],
    diagramReference: "Figure 1 - Plate Cross Section"
  },
  flat_bar: {
    displayName: "Flat Bar",
    scanDirection: ["Straight beam perpendicular to surface"],
    waveMode: ["Longitudinal"],
    conditions: [
      "If W/T > 5, scan with straight beam as shown",
      "If W or T > 9 inches (228.6 mm), surface resolution may require scanning from opposite side"
    ],
    specialNotes: ["Same requirements as plate"],
    diagramReference: "Figure 1 - Flat Bar Cross Section"
  },
  rectangular_bar: {
    displayName: "Rectangular Bar, Bloom, and Billets",
    scanDirection: ["Straight beam from two adjacent sides"],
    waveMode: ["Longitudinal"],
    conditions: [
      "If W/T < 5, scan from two adjacent sides with sound beam directed as shown",
      "If T or W > 9 inches (228.6 mm), surface resolution may require scanning from opposite sides"
    ],
    specialNotes: ["Requires scanning from multiple surfaces"],
    diagramReference: "Figure 2 - Rectangular Bar Cross Section"
  },
  round_bar: {
    displayName: "Round Bars and Round Forging Stock",
    scanDirection: ["Radial scan from circumference", "Axial scan from end face"],
    waveMode: ["Longitudinal"],
    conditions: [
      "Scan radially from circumference",
      "Axial scanning may be required based on L/D ratio"
    ],
    specialNotes: ["Full circumferential coverage required"],
    diagramReference: "Figure 3 - Round Bar Cross Section"
  },
  round_forging_stock: {
    displayName: "Round Forging Stock",
    scanDirection: ["Radial scan from circumference", "Axial scan from end face"],
    waveMode: ["Longitudinal"],
    conditions: [
      "Scan radially from circumference",
      "Axial scanning required if grain structure oriented"
    ],
    specialNotes: ["Consider grain structure orientation"],
    diagramReference: "Figure 3 - Round Forging Stock"
  },
  ring_forging: {
    displayName: "Ring Forgings",
    scanDirection: ["Radial from circumference", "Axial", "Circumferential shear wave"],
    waveMode: ["Longitudinal", "Shear wave"],
    conditions: [
      "Scan with straight beam from circumference (radially) if ring thickness NOT > 20% of OD",
      "Scanning with straight beam in axial direction required ONLY if L/T < 5",
      "Scan with circumferential shear wave technique per Appendix A in addition to straight beam"
    ],
    specialNotes: [
      "OD = Outside Diameter, ID = Inside Diameter, L = Length, T = Wall Thickness",
      "Three scan directions required for complete inspection"
    ],
    diagramReference: "Figure 4 - Ring Forging"
  },
  disk_forging: {
    displayName: "Disk Forging",
    scanDirection: ["From flat face", "Radially from circumference"],
    waveMode: ["Longitudinal"],
    conditions: [
      "Scan with straight beams from at least one flat face",
      "Radially from circumference whenever practical"
    ],
    specialNotes: ["D = Diameter, T = Thickness"],
    diagramReference: "Figure 5 - Disk Forging"
  },
  hex_bar: {
    displayName: "Hex Bar",
    scanDirection: ["From three adjacent faces"],
    waveMode: ["Longitudinal"],
    conditions: [
      "Scan with straight beam from three adjacent faces",
      "When T exceeds value where attenuation reduces signal to unacceptable level, scan from opposite sides"
    ],
    specialNotes: ["T = Thickness", "May require scanning from opposite sides for thick sections"],
    diagramReference: "Figure 6 - Hex Bar"
  },
  bar: {
    displayName: "Bar (Generic)",
    scanDirection: ["Longitudinal along bar axis"],
    waveMode: ["Longitudinal"],
    conditions: ["Scan from multiple surfaces if diameter permits"],
    specialNotes: ["Generic bar - use specific type if known"],
    diagramReference: "Generic Bar"
  },
  forging: {
    displayName: "Forging (Generic)",
    scanDirection: ["Contour following", "Multiple orientations"],
    waveMode: ["Longitudinal", "Shear wave"],
    conditions: ["Match calibration block to part curvature"],
    specialNotes: ["Check grain structure effects", "Use specific forging type if known"],
    diagramReference: "Generic Forging"
  },
  ring: {
    displayName: "Ring (Generic)",
    scanDirection: ["Circumferential", "Axial", "Radial"],
    waveMode: ["Longitudinal"],
    conditions: ["Curvature compensation required"],
    specialNotes: ["Consider grain structure orientation", "Use ring_forging type if applicable"],
    diagramReference: "Generic Ring"
  },
  disk: {
    displayName: "Disk (Generic)",
    scanDirection: ["Radial patterns", "Circumferential patterns"],
    waveMode: ["Longitudinal"],
    conditions: ["Center bore requires special attention"],
    specialNotes: ["Rim inspection critical", "Use disk_forging type if applicable"],
    diagramReference: "Generic Disk"
  },
  sheet: {
    displayName: "Sheet",
    scanDirection: ["Two-axis raster"],
    waveMode: ["Longitudinal"],
    conditions: ["Similar to plate"],
    specialNotes: ["Check laminar discontinuities"],
    diagramReference: "Sheet"
  },
  slab: {
    displayName: "Slab",
    scanDirection: ["Two-axis raster", "Diagonal passes"],
    waveMode: ["Longitudinal"],
    conditions: ["Heavy section"],
    specialNotes: ["May require multi-side scanning"],
    diagramReference: "Slab"
  },
  square_bar: {
    displayName: "Square Bar",
    scanDirection: ["From adjacent faces"],
    waveMode: ["Longitudinal"],
    conditions: ["Similar to rectangular bar"],
    specialNotes: ["Ensure corner coverage"],
    diagramReference: "Square Bar"
  },
  pipe: {
    displayName: "Pipe",
    scanDirection: ["Helical scan", "Circumferential scan"],
    waveMode: ["Longitudinal"],
    conditions: ["Same as tube"],
    specialNotes: ["Check both ID and OD surfaces"],
    diagramReference: "Pipe"
  },
  shaft: {
    displayName: "Shaft",
    scanDirection: ["Axial", "Circumferential"],
    waveMode: ["Longitudinal"],
    conditions: ["Localized radial scans at critical sections"],
    specialNotes: ["Check shoulders, keyways"],
    diagramReference: "Shaft"
  },
  billet: {
    displayName: "Billet / Block",
    scanDirection: ["Two-axis raster in orthogonal directions"],
    waveMode: ["Longitudinal"],
    conditions: ["Add diagonal passes if needed"],
    specialNotes: ["Large cross-section"],
    diagramReference: "Billet"
  },
  block: {
    displayName: "Block",
    scanDirection: ["Two-axis raster through-thickness"],
    waveMode: ["Longitudinal"],
    conditions: ["Similar to billet"],
    specialNotes: ["Check for internal voids"],
    diagramReference: "Block"
  },
  sleeve: {
    displayName: "Sleeve / Bushing",
    scanDirection: ["Circumferential", "Radial through wall"],
    waveMode: ["Longitudinal"],
    conditions: ["Short hollow cylinder"],
    specialNotes: ["Similar to tube but shorter"],
    diagramReference: "Sleeve"
  },
  bushing: {
    displayName: "Bushing",
    scanDirection: ["Circumferential", "Radial"],
    waveMode: ["Longitudinal"],
    conditions: ["Short hollow cylinder"],
    specialNotes: ["Check wall thickness uniformity"],
    diagramReference: "Bushing"
  },
  extrusion_l: {
    displayName: "L-Extrusion",
    scanDirection: ["Axial along extrusion", "Indexed transverse scans"],
    waveMode: ["Longitudinal"],
    conditions: ["Scan flanges and web separately"],
    specialNotes: ["Check corners/fillets"],
    diagramReference: "L-Extrusion"
  },
  extrusion_t: {
    displayName: "T-Extrusion",
    scanDirection: ["Axial", "Indexed transverse per feature"],
    waveMode: ["Longitudinal"],
    conditions: ["T-section requires multi-orientation scans"],
    specialNotes: ["Scan from multiple surfaces"],
    diagramReference: "T-Extrusion"
  },
  extrusion_i: {
    displayName: "I-Extrusion (I-Beam)",
    scanDirection: ["Axial", "Indexed scans on flanges and web"],
    waveMode: ["Longitudinal"],
    conditions: ["I-beam geometry"],
    specialNotes: ["Scan from multiple surfaces"],
    diagramReference: "I-Extrusion"
  },
  extrusion_u: {
    displayName: "U-Extrusion",
    scanDirection: ["Axial", "Transverse indexed scans"],
    waveMode: ["Longitudinal"],
    conditions: ["U-channel requires coverage of all faces"],
    specialNotes: ["Check web and flanges"],
    diagramReference: "U-Extrusion"
  },
  extrusion_channel: {
    displayName: "Channel Extrusion",
    scanDirection: ["Axial", "Indexed transverse scans"],
    waveMode: ["Longitudinal"],
    conditions: ["Similar to U-extrusion"],
    specialNotes: ["Check web and flanges"],
    diagramReference: "Channel"
  },
  extrusion_angle: {
    displayName: "Angle Extrusion",
    scanDirection: ["Axial along legs", "Radial from edges"],
    waveMode: ["Longitudinal"],
    conditions: ["Angle section requires scans along both legs"],
    specialNotes: ["Check corner fillet"],
    diagramReference: "Angle"
  },
  square_tube: {
    displayName: "Square Tube",
    scanDirection: ["Perimeter scan"],
    waveMode: ["Longitudinal"],
    conditions: ["Uniform coverage of all faces"],
    specialNotes: ["Check wall thickness uniformity"],
    diagramReference: "Square Tube"
  },
  rectangular_forging_stock: {
    displayName: "Rectangular Forging Stock",
    scanDirection: ["Axial", "Transverse"],
    waveMode: ["Longitudinal"],
    conditions: ["Check forging defects"],
    specialNotes: ["Verify grain structure"],
    diagramReference: "Forging Stock"
  },
  hub: {
    displayName: "Hub Forging",
    scanDirection: ["Radial", "Circumferential"],
    waveMode: ["Longitudinal", "Shear"],
    conditions: ["Complex geometry"],
    specialNotes: ["Multi-angle approach required"],
    diagramReference: "Hub"
  },
  near_net_forging: {
    displayName: "Near-Net Forging",
    scanDirection: ["Contour following", "Indexed"],
    waveMode: ["Longitudinal"],
    conditions: ["Adaptive scanning required"],
    specialNotes: ["Follow part contour"],
    diagramReference: "Near-Net"
  },
  machined_component: {
    displayName: "Machined Component",
    scanDirection: ["Per parent form"],
    waveMode: ["Per parent form"],
    conditions: ["Follow parent material inspection"],
    specialNotes: ["Refer to source material specs"],
    diagramReference: "Machined"
  },
  hpt_disk: {
    displayName: "HPT Disk (High Pressure Turbine)",
    scanDirection: ["Straight beam from flat face", "Circumferential shear wave +45°", "Circumferential shear wave -45°", "Radial from bore"],
    waveMode: ["Longitudinal", "Shear wave"],
    conditions: ["Full face coverage with straight beam", "Bore inspection with circumferential shear wave ±45°", "SNR ≥1.5:1 required"],
    specialNotes: ["Engine HPT disk geometry", "Confirm whether OEM bore shear-wave inspection is mandatory", "Apply NDIP-1226/1227 TOF and #1 FBH criteria only when that standard is active", "Otherwise follow the active customer or material specification"],
    diagramReference: "Disk"
  },
  custom: {
    displayName: "Custom Geometry",
    scanDirection: ["Per drawing"],
    waveMode: ["Per specification"],
    conditions: ["Customer-specific"],
    specialNotes: ["Refer to all applicable specifications"],
    diagramReference: "Custom"
  }
};

// ============= SCAN DETAILS - SCAN DIRECTIONS =============
export interface ScanDirectionDetails {
  direction: string;
  waveMode: string;
  angleOrDescription: string;
  applicableGeometry: PartGeometry[];
}

export const SCAN_DIRECTION_CATALOG: ScanDirectionDetails[] = [
  {
    direction: "A",
    waveMode: "Longitudinal",
    angleOrDescription: "Straight beam (0°)",
    applicableGeometry: ["plate", "flat_bar", "rectangular_bar", "round_bar", "disk_forging"]
  },
  {
    direction: "B",
    waveMode: "Longitudinal",
    angleOrDescription: "Straight beam (0°)",
    applicableGeometry: ["plate", "flat_bar", "rectangular_bar"]
  },
  {
    direction: "C",
    waveMode: "Longitudinal",
    angleOrDescription: "Straight beam (0°)",
    applicableGeometry: ["plate", "rectangular_bar"]
  },
  {
    direction: "D",
    waveMode: "Longitudinal",
    angleOrDescription: "Straight beam (0°)",
    applicableGeometry: ["plate", "rectangular_bar"]
  },
  {
    direction: "E",
    waveMode: "Axial shear wave",
    angleOrDescription: "45° OD",
    applicableGeometry: ["tube", "ring_forging"]
  },
  {
    direction: "F",
    waveMode: "Axial shear wave",
    angleOrDescription: "45° OD",
    applicableGeometry: ["tube", "ring_forging"]
  },
  {
    direction: "G",
    waveMode: "Shear wave",
    angleOrDescription: "45° clockwise",
    applicableGeometry: ["ring_forging", "tube"]
  },
  {
    direction: "H",
    waveMode: "Shear wave",
    angleOrDescription: "45° counter clockwise",
    applicableGeometry: ["ring_forging", "tube"]
  },
  {
    direction: "I",
    waveMode: "Shear wave",
    angleOrDescription: "45° counter clockwise",
    applicableGeometry: ["ring_forging"]
  },
  {
    direction: "L",
    waveMode: "Shear wave",
    angleOrDescription: "45° counter clockwise",
    applicableGeometry: ["ring_forging"]
  }
];

// ============= SMART RECOMMENDATION ENGINE =============
export interface InspectionRecommendation {
  geometry: PartGeometry;
  material: MaterialType;
  thickness: number;
  width?: number;
  diameter?: number;
  length?: number;
  
  recommendations: {
    scanDirections: string[];
    waveTypes: string[];
    conditions: string[];
    warnings: string[];
    acceptanceClass: AcceptanceClass;
    frequency: string;
    specialConsiderations: string[];
  };
}

export function getSmartRecommendation(input: {
  geometry: PartGeometry;
  material: MaterialType;
  thickness: number;
  width?: number;
  length?: number;
  diameter?: number;
  acceptanceClass?: AcceptanceClass;
}): InspectionRecommendation {
  const { geometry, material, thickness, width, length, diameter, acceptanceClass } = input;
  
  const geometryRules = GEOMETRY_INSPECTION_RULES[geometry];
  const warnings: string[] = [];
  const conditions: string[] = [...geometryRules.conditions];
  
  // Calculate W/T ratio for applicable geometries
  if (width && (geometry === "plate" || geometry === "flat_bar" || geometry === "rectangular_bar")) {
    const wtRatio = width / thickness;
    
    if (geometry === "plate" || geometry === "flat_bar") {
      if (wtRatio <= 5) {
        warnings.push(`⚠️ W/T ratio is ${wtRatio.toFixed(2)} (≤5). Consider rectangular bar inspection technique.`);
      }
    }
    
    if (geometry === "rectangular_bar") {
      if (wtRatio >= 5) {
        warnings.push(`⚠️ W/T ratio is ${wtRatio.toFixed(2)} (≥5). Consider plate/flat bar technique.`);
      }
    }
    
    if (width > 228.6 || thickness > 228.6) {
      warnings.push("⚠️ Dimension exceeds 9 inches (228.6mm) - scanning from opposite side may be required.");
    }
  }
  
  // Calculate L/T ratio for ring forgings
  if (geometry === "ring_forging" && length) {
    const ltRatio = length / thickness;
    if (ltRatio < 5) {
      warnings.push(`✓ L/T ratio is ${ltRatio.toFixed(2)} (<5). Axial scanning IS REQUIRED.`);
      conditions.push("REQUIRED: Axial scanning due to L/T < 5");
    } else {
      conditions.push("Axial scanning not required (L/T ≥ 5)");
    }
  }
  
  // Check ring forging thickness vs OD
  if (geometry === "ring_forging" && diameter) {
    const thicknessPercent = (thickness / diameter) * 100;
    if (thicknessPercent > 20) {
      warnings.push(`⚠️ Ring thickness is ${thicknessPercent.toFixed(1)}% of OD (>20%). Standard radial scan may not be sufficient.`);
    }
  }
  
  // Material-specific warnings
  if (material === "titanium" && acceptanceClass && ["AAA", "AA"].includes(acceptanceClass)) {
    warnings.push(`⚠️ TITANIUM ALERT: Class ${acceptanceClass} requires special back reflection loss limits per TABLE VI.`);
  }
  
  if (material === "magnesium") {
    warnings.push("⚠️ Magnesium: Use non-corrosive water-based couplant only. High attenuation material.");
  }
  
  // Frequency recommendation
  const frequency = getRecommendedFrequency(thickness, material);
  
  return {
    geometry,
    material,
    thickness,
    width,
    diameter,
    length,
    recommendations: {
      scanDirections: geometryRules.scanDirection,
      waveTypes: geometryRules.waveMode,
      conditions,
      warnings,
      acceptanceClass: acceptanceClass || "A",
      frequency,
      specialConsiderations: geometryRules.specialNotes
    }
  };
}

// ============= FREQUENCY SELECTION =============
export function getRecommendedFrequency(thickness: number, material?: MaterialType): string {
  let attenuationFactor = 1.0;
  
  if (material) {
    const attenuationMap: Record<MaterialType, number> = {
      aluminum: 1.5,
      steel: 3.0,
      stainless_steel: 2.5,
      titanium: 4.5,
      nickel_alloy: 3.5,
      magnesium: 8.0,
      custom: 3.0
    };
    
    const attenuation = attenuationMap[material];
    if (attenuation > 5) attenuationFactor = 0.5;
    else if (attenuation > 3) attenuationFactor = 0.75;
  }

  const adjustedThickness = thickness / attenuationFactor;

  if (adjustedThickness < 12.7) return "10.0";
  if (adjustedThickness < 25.4) return "5.0";
  if (adjustedThickness < 50.8) return "2.25";
  return "1.0";
}

// ============= RESOLUTION VALUES =============
export function getResolutionValues(frequency: string): { entry: number; back: number } {
  const resolutions: Record<string, { entry: number; back: number }> = {
    "1.0": { entry: 0.5, back: 0.2 },
    "2.25": { entry: 0.25, back: 0.1 },
    "5.0": { entry: 0.125, back: 0.05 },
    "10.0": { entry: 0.05, back: 0.025 },
    "15.0": { entry: 0.05, back: 0.025 },
  };
  return resolutions[frequency] || { entry: 0.125, back: 0.05 };
}

// ============= METAL TRAVEL CALCULATION =============
export function calculateMetalTravel(thickness: number): number {
  const travel = thickness * 3;
  return Math.round(travel / 5) * 5;
}

// ============= SCAN INDEX CALCULATION =============
export function calculateScanIndex(transducerDiameter: number, coveragePercent: number = 100): number {
  const overlapFactor = coveragePercent / 100;
  const indexInches = transducerDiameter * (2 - overlapFactor);
  return Math.round(indexInches * 25.4 * 10) / 10;
}

// ============= COUPLANT RECOMMENDATION =============
export function getCouplantRecommendation(
  transducerType: string,
  material?: MaterialType,
  temperature?: number
): string {
  const selectedTypes = (transducerType || "")
    .split(/[,+]/)
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);

  if (selectedTypes.includes("immersion")) {
    if (temperature && temperature > 40) {
      return "Water with rust inhibitor (heated)";
    }
    return "Water (distilled or deionized)";
  }

  if (material === "magnesium") {
    return "Water-based gel (non-corrosive) - CRITICAL for Magnesium";
  }

  return "Commercial ultrasonic gel (e.g., Sono 600)";
}

// ============= APPLICABLE SCAN DIRECTIONS =============
export function getApplicableScanDirections(geometry: PartGeometry): ScanDirectionDetails[] {
  return SCAN_DIRECTION_CATALOG.filter(scan => 
    scan.applicableGeometry.includes(geometry)
  );
}
