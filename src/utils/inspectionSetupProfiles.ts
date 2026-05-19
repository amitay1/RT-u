import type { InspectionSetupData, PartGeometry, StandardType } from "@/types/techniqueSheet";

export interface InspectionSetupStandardProfile {
  allowedPartTypes: PartGeometry[];
  lockedPartType?: PartGeometry;
  showMroReferenceLibrary: boolean;
  showNdipHptInspectionFields: boolean;
  partTypeScopeNote?: string;
}

const SELECTOR_PART_TYPES: PartGeometry[] = [
  "plate",
  "box",
  "cylinder",
  "tube",
  "ring_forging",
  "disk_forging",
  "hexagon",
  "cone",
  "sphere",
  "impeller",
  "blisk",
  "hpt_disk",
];

const FORGING_SCOPE_PART_TYPES: PartGeometry[] = [
  "plate",
  "box",
  "cylinder",
  "ring_forging",
  "disk_forging",
  "impeller",
  "blisk",
  "hpt_disk",
];

const WELDMENT_SCOPE_PART_TYPES: PartGeometry[] = [
  "plate",
  "box",
  "cylinder",
  "tube",
  "cone",
];

const PWA_SIM_SCOPE_PART_TYPES: PartGeometry[] = [
  "box",
  "cylinder",
];

const ADVANCED_PW_ROTOR_PART_TYPES: PartGeometry[] = [
  "disk_forging",
  "impeller",
  "blisk",
  "hpt_disk",
];

const DEFAULT_PROFILE: InspectionSetupStandardProfile = {
  allowedPartTypes: SELECTOR_PART_TYPES,
  showMroReferenceLibrary: false,
  showNdipHptInspectionFields: false,
};

const STANDARD_PROFILES: Record<StandardType, InspectionSetupStandardProfile> = {
  "AMS-STD-2154E": {
    ...DEFAULT_PROFILE,
  },
  "MIL-STD-2154": {
    ...DEFAULT_PROFILE,
  },
  "ASTM-E2375": {
    ...DEFAULT_PROFILE,
  },
  "ASTM-E1001": {
    ...DEFAULT_PROFILE,
  },
  "ASTM-E2580": {
    ...DEFAULT_PROFILE,
    allowedPartTypes: ["plate", "box"],
    partTypeScopeNote: "ASTM E2580 is scoped for flat composite panels and sandwich-core panels.",
  },
  "ASTM-E588": {
    ...DEFAULT_PROFILE,
    allowedPartTypes: ["cylinder", "box"],
    partTypeScopeNote: "ASTM E588 is scoped for bearing-quality steel specimens used for ultrasonic cleanliness rating.",
  },
  "ASTM-E127": {
    ...DEFAULT_PROFILE,
  },
  "AMS-2630": {
    ...DEFAULT_PROFILE,
  },
  "AMS-2631": {
    ...DEFAULT_PROFILE,
  },
  "AMS-2632": {
    ...DEFAULT_PROFILE,
  },
  "EN-ISO-16810": {
    ...DEFAULT_PROFILE,
  },
  "ASTM-A388": {
    ...DEFAULT_PROFILE,
    allowedPartTypes: FORGING_SCOPE_PART_TYPES,
    partTypeScopeNote: "ASTM A388 is scoped for heavy forgings, so the selector is limited to forging-like geometries.",
  },
  "BS-EN-10228-3": {
    ...DEFAULT_PROFILE,
    allowedPartTypes: FORGING_SCOPE_PART_TYPES,
    partTypeScopeNote: "EN 10228-3 is scoped for forgings, so non-forging geometries are hidden here.",
  },
  "BS-EN-10228-4": {
    ...DEFAULT_PROFILE,
    allowedPartTypes: FORGING_SCOPE_PART_TYPES,
    partTypeScopeNote: "EN 10228-4 is scoped for forgings, so non-forging geometries are hidden here.",
  },
  "ASTM-E164": {
    ...DEFAULT_PROFILE,
    allowedPartTypes: WELDMENT_SCOPE_PART_TYPES,
    partTypeScopeNote: "ASTM E164 is focused on weldment-compatible geometries, so the selector is narrowed accordingly.",
  },
  "PWA-SIM": {
    ...DEFAULT_PROFILE,
    allowedPartTypes: PWA_SIM_SCOPE_PART_TYPES,
    partTypeScopeNote: "PWA-SIM is intended for bar, billet, and forging stock, so only stock geometries remain available.",
  },
  "NDIP-1226": {
    ...DEFAULT_PROFILE,
    allowedPartTypes: ["hpt_disk"],
    lockedPartType: "hpt_disk",
    showMroReferenceLibrary: true,
    showNdipHptInspectionFields: true,
    partTypeScopeNote: "NDIP-1226 is locked to the V2500 1st stage HPT disk geometry.",
  },
  "NDIP-1227": {
    ...DEFAULT_PROFILE,
    allowedPartTypes: ["hpt_disk"],
    lockedPartType: "hpt_disk",
    showMroReferenceLibrary: true,
    showNdipHptInspectionFields: true,
    partTypeScopeNote: "NDIP-1227 is locked to the V2500 2nd stage HPT disk geometry.",
  },
  "NDIP-1254": {
    ...DEFAULT_PROFILE,
    allowedPartTypes: ADVANCED_PW_ROTOR_PART_TYPES,
    partTypeScopeNote: "NDIP-1254 is limited to PW rotor / hub-style geometries.",
  },
  "NDIP-1257": {
    ...DEFAULT_PROFILE,
    allowedPartTypes: ADVANCED_PW_ROTOR_PART_TYPES,
    partTypeScopeNote: "NDIP-1257 is limited to PW rotor / hub-style geometries.",
  },
  "NDIP-1260": {
    ...DEFAULT_PROFILE,
    allowedPartTypes: ADVANCED_PW_ROTOR_PART_TYPES,
    partTypeScopeNote: "NDIP-1260 is limited to PW rotor / disc-style geometries.",
  },
};

export function getInspectionSetupStandardProfile(
  standard?: StandardType | string | null,
): InspectionSetupStandardProfile {
  if (!standard) {
    return DEFAULT_PROFILE;
  }

  return STANDARD_PROFILES[standard as StandardType] || DEFAULT_PROFILE;
}

export function normalizePartTypeForProfile(partType?: string | null): PartGeometry | null {
  switch (partType) {
    case "plate":
    case "sheet":
    case "slab":
    case "flat_bar":
      return "plate";
    case "box":
    case "rectangular_bar":
    case "square_bar":
    case "billet":
    case "block":
    case "bar":
    case "forging":
    case "rectangular_forging_stock":
    case "near_net_forging":
      return "box";
    case "cylinder":
    case "round_bar":
    case "shaft":
    case "round_forging_stock":
      return "cylinder";
    case "tube":
    case "pipe":
    case "rectangular_tube":
    case "square_tube":
      return "tube";
    case "ring":
    case "ring_forging":
    case "sleeve":
    case "bushing":
      return "ring_forging";
    case "disk":
    case "disk_forging":
    case "hub":
      return "disk_forging";
    case "hex_bar":
    case "hexagon":
      return "hexagon";
    case "cone":
      return "cone";
    case "sphere":
      return "sphere";
    case "impeller":
      return "impeller";
    case "blisk":
      return "blisk";
    case "hpt_disk":
      return "hpt_disk";
    default:
      return null;
  }
}

export function isPartTypeAllowedForStandard(
  partType: string | undefined,
  standard?: StandardType | string | null,
): boolean {
  if (!partType) {
    return true;
  }

  const profile = getInspectionSetupStandardProfile(standard);
  const normalizedPartType = normalizePartTypeForProfile(partType);

  if (!normalizedPartType) {
    return true;
  }

  return profile.allowedPartTypes.includes(normalizedPartType);
}

export function normalizeInspectionSetupForStandard(
  setup: InspectionSetupData,
  standard?: StandardType | string | null,
): InspectionSetupData {
  const profile = getInspectionSetupStandardProfile(standard);

  if (profile.lockedPartType && setup.partType !== profile.lockedPartType) {
    return {
      ...setup,
      partType: profile.lockedPartType,
    };
  }

  if (!setup.partType || isPartTypeAllowedForStandard(setup.partType, standard)) {
    return setup;
  }

  return {
    ...setup,
    partType: "",
  };
}
