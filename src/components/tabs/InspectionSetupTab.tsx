// @ts-nocheck
import React, { useRef, useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { InspectionSetupData, MaterialType, PartGeometry, AcceptanceClass, StandardType } from "@/types/techniqueSheet";
import { Upload, X, Plus, HardDrive, ExternalLink, Download, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { materialDatabase } from "@/utils/enhancedAutoFillLogic";
import { PartTypeVisualSelector } from "@/components/PartTypeVisualSelector";
import { Card } from "@/components/ui/card";
import { FieldWithHelp } from "@/components/FieldWithHelp";
import { RealTimeTechnicalDrawing } from "@/components/RealTimeTechnicalDrawing";
import {
  generateCalibrationRecommendationV2,
  CalibrationRecommendationInput
} from "@/utils/calibrationRecommenderV2";
import { logInfo, logWarn } from "@/lib/logger";
import type { ScanDetailsData } from "@/types/scanDetails";
import { getInspectionThickness } from "@/utils/inspectionThickness";
import {
  getInspectionSetupStandardProfile,
  normalizeInspectionSetupForStandard,
} from "@/utils/inspectionSetupProfiles";
import {
  ACTIVE_MRO_STANDARD_CODES,
  deriveCalibrationScanDirectionInfo,
  isSupportedMroAssetName,
} from "@/utils/mroPolicy";
import {
  getV2500HptReferenceDefaults,
  getV2500InspectionSetupDefaults,
  getV2500PartTypeLabel,
  isV2500NdipStandard,
} from "@/utils/pwNdipDefaults";
import {
  enrichMroAsset,
  fetchMroAssetCatalog,
  formatMroAssetSize,
  getRelevantMroAssets,
  groupMroAssetsByCategory,
  sortMroAssets,
  type RawMroAssetCatalogResponse,
} from "@/utils/mroAssets";
import { includeCurrentOption } from "@/utils/selectOptions";

// LocalStorage keys for custom items persistence
const STORAGE_KEYS = {
  customMaterials: 'scanmaster_custom_materials',
  customMaterialSpecs: 'scanmaster_custom_material_specs',
  customHeatTreatments: 'scanmaster_custom_heat_treatments',
};

interface InspectionSetupTabProps {
  data: InspectionSetupData;
  onChange: (data: InspectionSetupData) => void;
  acceptanceClass?: AcceptanceClass | "";
  standardType?: StandardType;  // Added: for calibration recommendation
  onCalibrationRecommendation?: (blockType: string, reasoning: string) => void;  // Added: callback to update calibration
  scanDetails?: ScanDetailsData;  // NEW: Scan directions to influence calibration block selection
}

const materials: { value: MaterialType; label: string }[] = [
  { value: "aluminum", label: "Aluminum" },
  { value: "steel", label: "Steel" },
  { value: "stainless_steel", label: "Stainless Steel" },
  { value: "titanium", label: "Titanium" },
  { value: "nickel_alloy", label: "Nickel Alloy" },
  { value: "magnesium", label: "Magnesium" },
  { value: "custom", label: "Custom Material" },
];


interface PartTypeOption {
  value: PartGeometry;
  label: string;
  description?: string;
}

const partTypes: PartTypeOption[] = [
  { value: "plate", label: "Plate", description: "Two-axis raster" },
  { value: "rectangular_bar", label: "Rectangular Bar", description: "Scan from multiple faces" },
  { value: "round_bar", label: "Round Bar", description: "Radial + axial scans" },
  { value: "square_bar", label: "Square Bar", description: "Scan from adjacent faces" },
  { value: "round_forging_stock", label: "Round Forging Stock", description: "Consider grain structure" },
  { value: "ring_forging", label: "Ring Forging ⭐", description: "Radial + axial + shear wave" },
  { value: "disk_forging", label: "Disk Forging", description: "Flat face + radial" },
  { value: "hex_bar", label: "Hex Bar", description: "3 adjacent faces" },
  { value: "tube", label: "Tube / Pipe", description: "ID + OD coverage" },
  { value: "shaft", label: "Shaft", description: "Axial + circumferential" },
  { value: "billet", label: "Billet / Block", description: "Two-axis raster" },
  { value: "sleeve", label: "Sleeve / Bushing", description: "Short hollow cylinder" },
  { value: "bar", label: "Bar (Generic)", description: "Use specific type if known" },
  { value: "forging", label: "Forging (Generic)", description: "Use specific type if known" },
  { value: "ring", label: "Ring (Generic)", description: "Use ring_forging if applicable" },
  { value: "disk", label: "Disk (Generic)", description: "Use disk_forging if applicable" },
  { value: "impeller", label: "Impeller", description: "Complex stepped disk (aero engine)" },
  { value: "blisk", label: "Blisk (Bladed Disk)", description: "Integrated blade-disk (aero engine)" },
  { value: "hpt_disk", label: "HPT Disk", description: "Turbine disk with stepped bore profile" },
];


const materialSpecs: Record<MaterialType, string[]> = {
  aluminum: ["7075-T6 (QQ-A200/11)", "2024 (QQ-A-200/3)", "6061-T6", "2219-T87"],
  steel: ["4340 annealed (MIL-S-5000)", "4130", "17-4 PH", "15-5 PH"],
  stainless_steel: ["304 (AMS 5513)", "316 (AMS 5524)", "17-4 PH (AMS 5604)", "15-5 PH (AMS 5659)", "410", "420"],
  titanium: ["Ti-6Al-4V annealed (AMS 4928)", "Ti-6Al-4V STA", "Ti-6Al-2Sn-4Zr-2Mo (Ti-6242)", "Ti-5Al-2.5Sn", "CP Ti Grade 2"],
  nickel_alloy: ["Inconel 718 (AMS 5662)", "Waspaloy (AMS 5544)", "Inconel 625 (AMS 5666)", "Rene 41", "Hastelloy X"],
  magnesium: ["ZK60A (QQ-M-31)", "AZ31B", "AZ80A", "ZE41A"],
  custom: ["Custom Specification"],
};

// Default heat treatment options
const defaultHeatTreatments = [
  "Annealed",
  "Solution Treated",
  "Age Hardened",
  "T6",
  "T651",
  "T7",
  "T73",
  "T76",
  "Normalized",
  "Quenched & Tempered",
  "Stress Relieved",
];

// ═══════════════════════════════════════════════════════════════════════════
// Per-shape dimension field configuration
// Each part type defines exactly which fields are relevant to its geometry
// ═══════════════════════════════════════════════════════════════════════════
interface PartFieldConfig {
  showThickness: boolean;
  thicknessLabel: string;
  showLength: boolean;
  lengthLabel: string;
  showWidth: boolean;
  showOD: boolean;
  odLabel: string;
  canBeHollow: boolean;
  alwaysHollow: boolean;
  hollowType: 'circular' | 'rectangular' | 'none';
  isCone: boolean;
}

function getPartFieldConfig(partType: string): PartFieldConfig {
  switch (partType) {
    // ── FLAT / RECTANGULAR (no hollow toggle) ──
    case 'plate':
    case 'sheet':
    case 'slab':
    case 'flat_bar':
    case 'bar':
    case 'forging':
    case 'rectangular_forging_stock':
    case 'near_net_forging':
      return {
        showThickness: true, thicknessLabel: 'Thickness (mm)',
        showLength: true, lengthLabel: 'Length (mm)',
        showWidth: true,
        showOD: false, odLabel: '',
        canBeHollow: false, alwaysHollow: false,
        hollowType: 'none', isCone: false,
      };

    // ── RECTANGULAR (can be hollow with inner L/W/Wall) ──
    case 'rectangular_bar':
    case 'square_bar':
    case 'box':
    case 'billet':
    case 'block':
      return {
        showThickness: true, thicknessLabel: 'Thickness (mm)',
        showLength: true, lengthLabel: 'Length (mm)',
        showWidth: true,
        showOD: false, odLabel: '',
        canBeHollow: true, alwaysHollow: false,
        hollowType: 'rectangular', isCone: false,
      };

    // ── SOLID ROUND (OD + Length, can become hollow) ──
    case 'cylinder':
    case 'round_bar':
    case 'shaft':
    case 'round_forging_stock':
      return {
        showThickness: false, thicknessLabel: '',
        showLength: true, lengthLabel: 'Length (mm)',
        showWidth: false,
        showOD: true, odLabel: 'OD (mm)',
        canBeHollow: true, alwaysHollow: false,
        hollowType: 'circular', isCone: false,
      };

    // ── DISK (OD + Height, can be hollow) ──
    case 'disk':
    case 'disk_forging':
    case 'hub':
      return {
        showThickness: true, thicknessLabel: 'Height (mm)',
        showLength: false, lengthLabel: '',
        showWidth: false,
        showOD: true, odLabel: 'OD (mm)',
        canBeHollow: true, alwaysHollow: false,
        hollowType: 'circular', isCone: false,
      };

    // ── AERO ENGINE DISKS (OD + Height, can/always hollow) ──
    case 'impeller':
    case 'blisk':
      return {
        showThickness: true, thicknessLabel: 'Height (mm)',
        showLength: false, lengthLabel: '',
        showWidth: false,
        showOD: true, odLabel: 'OD (mm)',
        canBeHollow: true, alwaysHollow: false,
        hollowType: 'circular', isCone: false,
      };

    case 'hpt_disk':
      return {
        showThickness: true, thicknessLabel: 'Overall Height (mm)',
        showLength: false, lengthLabel: '',
        showWidth: false,
        showOD: true, odLabel: 'Max OD / Tip OD (mm)',
        canBeHollow: false, alwaysHollow: true,
        hollowType: 'circular', isCone: false,
      };

    // ── TUBULAR (always hollow, OD + Length) ──
    case 'tube':
    case 'pipe':
      return {
        showThickness: false, thicknessLabel: '',
        showLength: true, lengthLabel: 'Length (mm)',
        showWidth: false,
        showOD: true, odLabel: 'OD (mm)',
        canBeHollow: false, alwaysHollow: true,
        hollowType: 'circular', isCone: false,
      };

    // ── RING / SHORT HOLLOW (always hollow, OD + Axial Length) ──
    case 'ring':
    case 'ring_forging':
    case 'sleeve':
    case 'bushing':
      return {
        showThickness: false, thicknessLabel: '',
        showLength: true, lengthLabel: 'Axial Width (mm)',
        showWidth: false,
        showOD: true, odLabel: 'OD (mm)',
        canBeHollow: false, alwaysHollow: true,
        hollowType: 'circular', isCone: false,
      };

    // ── HEX BAR (Across-Flats + Length) ──
    case 'hex_bar':
    case 'hexagon':
      return {
        showThickness: false, thicknessLabel: '',
        showLength: true, lengthLabel: 'Length (mm)',
        showWidth: false,
        showOD: true, odLabel: 'Across Flats (mm)',
        canBeHollow: true, alwaysHollow: false,
        hollowType: 'circular', isCone: false,
      };

    // ── SPHERE (Diameter only) ──
    case 'sphere':
      return {
        showThickness: false, thicknessLabel: '',
        showLength: false, lengthLabel: '',
        showWidth: false,
        showOD: true, odLabel: 'Diameter (mm)',
        canBeHollow: true, alwaysHollow: false,
        hollowType: 'circular', isCone: false,
      };

    // ── CONE (special fields, always hollow) ──
    case 'cone':
      return {
        showThickness: false, thicknessLabel: '',
        showLength: false, lengthLabel: '',
        showWidth: false,
        showOD: false, odLabel: '',
        canBeHollow: false, alwaysHollow: true,
        hollowType: 'none', isCone: true,
      };

    // ── RECTANGULAR TUBE (always hollow, Height + Length + Width) ──
    case 'rectangular_tube':
      return {
        showThickness: true, thicknessLabel: 'Height (mm)',
        showLength: true, lengthLabel: 'Length (mm)',
        showWidth: true,
        showOD: false, odLabel: '',
        canBeHollow: false, alwaysHollow: true,
        hollowType: 'rectangular', isCone: false,
      };

    // ── CUSTOM / DEFAULT (show everything) ──
    case 'custom':
    default:
      return {
        showThickness: true, thicknessLabel: 'Thickness (mm)',
        showLength: true, lengthLabel: 'Length (mm)',
        showWidth: true,
        showOD: true, odLabel: 'OD (mm)',
        canBeHollow: true, alwaysHollow: false,
        hollowType: 'circular', isCone: false,
      };
  }
}

/**
 * AUTOMATIC SHAPE CLASSIFICATION - ASTM E2375-16 Standard
 *
 * Shape classification thresholds per ASTM E2375-16:
 *
 * ┌─────────────────────────────────────────────────────────────────────────────┐
 * │ HOLLOW CYLINDRICAL SHAPES (Ring Forgings - has inner diameter):            │
 * │   • RING: L/T < 5 (Length/Wall-Thickness ratio less than 5)                │
 * │   • TUBE: L/T >= 5 (longer hollow cylinder)                                │
 * │   Additional: If T (wall) not > 20% of OD → scan radially                  │
 * │   Additional: Axial scan required only if L/T < 5                          │
 * │   Additional: Always add circumferential shear wave per Appendix A         │
 * │   Source: ASTM E2375-16 Figure 7 - Ring Forgings ✓                         │
 * ├─────────────────────────────────────────────────────────────────────────────┤
 * │ SOLID CYLINDRICAL SHAPES (Round Bars and Round Forging Stock):             │
 * │   • DISK: H/D < 0.5 (Height/Diameter ratio less than 0.5)                  │
 * │   • ROUND BAR: H/D >= 0.5 (taller solid cylinder)                          │
 * │   Note: Scan radially while rotating to locate discontinuities at center   │
 * │   Note: May require angle beam per Appendix A when specified               │
 * │   Source: ASTM E2375-16 Figure 7 - Round Bars and Round Forging Stock ✓    │
 * ├─────────────────────────────────────────────────────────────────────────────┤
 * │ RECTANGULAR (Plate and Flat Bar vs Rectangular Bar/Billet):                │
 * │   • PLATE: W/T > 5 (width-to-thickness ratio)                              │
 * │   • BAR/BILLET: W/T <= 5 (compact cross-section)                           │
 * │   Additional: If W or T > 228.6mm (9") → may require opposite side scan    │
 * │   Source: ASTM E2375-16 Figure 6 ✓                                         │
 * └─────────────────────────────────────────────────────────────────────────────┘
 *
 * This ensures proper inspection planning and scan direction visualization.
 */
function classifyCircularShape(
  currentType: PartGeometry,
  diameter: number | undefined,
  innerDiameter: number | undefined,
  height: number | undefined,
  wallThickness: number | undefined
): PartGeometry {
  // Never auto-reclassify complex aero engine forgings to simpler types
  if (currentType === 'hpt_disk' || currentType === 'impeller' || currentType === 'blisk') {
    return currentType;
  }

  // Only auto-classify circular/cylindrical shapes
  const circularTypes: PartGeometry[] = [
    'tube', 'pipe', 'ring', 'ring_forging', 'sleeve', 'bushing',
    'cylinder', 'round_bar', 'shaft', 'disk', 'disk_forging', 'round_forging_stock'
  ];

  if (!circularTypes.includes(currentType)) {
    return currentType; // Don't change non-circular shapes
  }

  // Need diameter and height for classification
  if (!diameter || !height) {
    return currentType;
  }

  // Types that are ALWAYS hollow - don't reclassify these as solid
  const alwaysHollowTypes: PartGeometry[] = ['tube', 'pipe', 'ring', 'ring_forging', 'sleeve', 'bushing'];
  const isAlwaysHollowType = alwaysHollowTypes.includes(currentType);

  // Determine if hollow or solid
  const isHollow = innerDiameter && innerDiameter > 0;

  // FIX: If current type is always hollow but innerDiameter not set yet,
  // keep the hollow type - don't reclassify as solid!
  if (isAlwaysHollowType && !isHollow) {
    return currentType;
  }

  if (isHollow) {
    // HOLLOW shape classification (Ring vs Tube)
    // Source: ASTM E2375-16 Figure 7 - L/T < 5 indicates RING geometry ✓
    const calculatedWallThickness = wallThickness || ((diameter - (innerDiameter || 0)) / 2);

    if (calculatedWallThickness > 0) {
      // ASTM E2375: Ring when L/T < 5 (length-to-wall-thickness ratio)
      const lengthToWallRatio = height / calculatedWallThickness;
      const isRing = lengthToWallRatio < 5;

      if (isRing) {
        // Keep forging designation if it was a forging
        if (currentType === 'ring_forging' || currentType === 'round_forging_stock') {
          return 'ring_forging';
        }
        return 'ring';
      } else {
        // It's a Tube (L/T >= 5, longer hollow cylinder)
        if (currentType === 'pipe') return 'pipe';
        if (currentType === 'sleeve') return 'sleeve';
        if (currentType === 'bushing') return 'bushing';
        return 'tube';
      }
    }
  } else {
    // SOLID shape classification (Disk vs Cylinder)
    // Source: Industry convention - H/D < 0.5 = "pancake/disk" shape
    // (Not defined in formal standards, but widely used in forging industry)
    const heightToDiameterRatio = height / diameter;
    const isDisk = heightToDiameterRatio < 0.5;

    if (isDisk) {
      // Keep forging designation if it was a forging
      if (currentType === 'disk_forging' || currentType === 'round_forging_stock') {
        return 'disk_forging';
      }
      return 'disk';
    } else {
      // It's a Cylinder (H/D >= 0.5, taller solid cylinder)
      if (currentType === 'shaft') return 'shaft';
      if (currentType === 'round_bar') return 'round_bar';
      if (currentType === 'round_forging_stock') return 'round_forging_stock';
      return 'cylinder';
    }
  }

  return currentType;
}
/**
 * AUTOMATIC RECTANGULAR SHAPE CLASSIFICATION - ASTM E2375-16
 *
 * Shape classification per ASTM E2375-16 Figure 6:
 *
 * ┌─────────────────────────────────────────────────────────────────────────────┐
 * │ PLATE AND FLAT BAR (W/T > 5):                                              │
 * │   • PLATE: W/T > 5 (width-to-thickness ratio greater than 5)               │
 * │   • Scan with straight beam directed as shown                              │
 * │   • If W or T > 9" (228.6mm) → may require scanning from opposite sides    │
 * │   Source: ASTM E2375-16 Figure 6 - Plate and Flat Bar ✓                    │
 * ├─────────────────────────────────────────────────────────────────────────────┤
 * │ RECTANGULAR BAR, BLOOM, AND BILLETS (W/T < 5):                             │
 * │   • BAR/BILLET: W/T < 5 (compact cross-section)                            │
 * │   • Scan from two adjacent sides with sound beam directed as shown         │
 * │   • If T or W > 9" (228.6mm) → may require scanning from opposite sides    │
 * │   Source: ASTM E2375-16 Figure 6 - Rectangular Bar, Bloom, Billets ✓       │
 * └─────────────────────────────────────────────────────────────────────────────┘
 *
 * NOTE: 228.6mm = 9 inches - threshold for surface resolution requirements
 * This ensures proper inspection planning and scan direction visualization.
 */
function classifyRectangularShape(
  currentType: PartGeometry,
  length: number | undefined,
  width: number | undefined,
  thickness: number | undefined
): PartGeometry {
  // Only auto-classify box family shapes
  const boxFamilyTypes: PartGeometry[] = [
    'box', 'plate', 'sheet', 'slab', 'bar', 'flat_bar',
    'rectangular_bar', 'square_bar', 'billet', 'block'
  ];

  if (!boxFamilyTypes.includes(currentType)) {
    return currentType; // Don't change non-box shapes
  }

  // Need all three dimensions for classification
  if (!length || !width || !thickness) {
    return currentType;
  }

  // ASTM E2375 Figure 6: W/T > 5 indicates PLATE geometry
  // We use the two larger dimensions as the "face" and smallest as thickness
  const dims = [length, width, thickness].sort((a, b) => b - a);
  const largest = dims[0];
  const middle = dims[1];
  const smallest = dims[2];

  // Calculate ratios per ASTM E2375
  const widthToThicknessRatio = middle / smallest; // W/T ratio from standard
  const lengthToWidthRatio = largest / middle;

  // PLATE: Source: ASTM E2375-16 Figure 6 - W/T > 5 (flat sheet-like geometry) ✓
  const isPlate = widthToThicknessRatio > 5;

  // BAR: Source: Industry convention - L/W > 4 for elongated shapes
  // (Not defined in formal standards by ratio, but commonly used threshold)
  const isBar = !isPlate && lengthToWidthRatio > 4;

  if (isPlate) {
    // Keep specific plate types if already set
    if (currentType === 'sheet') return 'sheet';
    if (currentType === 'slab') return 'slab';
    return 'plate';
  }

  if (isBar) {
    // Keep specific bar types if already set
    if (currentType === 'flat_bar') return 'flat_bar';
    if (currentType === 'rectangular_bar') return 'rectangular_bar';
    if (currentType === 'square_bar') return 'square_bar';
    return 'bar';
  }

  // Default to box for compact rectangular shapes (W/T < 5)
  if (currentType === 'billet') return 'billet';
  if (currentType === 'block') return 'block';
  return 'box';
}

/**
 * UNIFIED SHAPE CLASSIFICATION
 * Combines circular and rectangular classification logic
 */
function classifyShape(
  currentType: PartGeometry,
  dimensions: {
    diameter?: number;
    innerDiameter?: number;
    length?: number;
    width?: number;
    thickness?: number;
    wallThickness?: number;
  }
): PartGeometry {
  const { diameter, innerDiameter, length, width, thickness, wallThickness } = dimensions;

  // Try circular classification first
  const height = length || thickness;
  const circularResult = classifyCircularShape(currentType, diameter, innerDiameter, height, wallThickness);
  if (circularResult !== currentType) {
    return circularResult;
  }

  // Try rectangular classification
  const rectangularResult = classifyRectangularShape(currentType, length, width, thickness);
  if (rectangularResult !== currentType) {
    return rectangularResult;
  }

  return currentType;
}

// Using imported FieldWithHelp component

export const InspectionSetupTab = ({
  data,
  onChange,
  acceptanceClass,
  standardType,
  onCalibrationRecommendation,
  scanDetails
}: InspectionSetupTabProps) => {
  // Refs to avoid stale closures in useEffect with setTimeout
  const dataRef = useRef(data);
  const onChangeRef = useRef(onChange);
  dataRef.current = data;
  onChangeRef.current = onChange;

  // State for custom items (persisted in localStorage)
  const [customMaterials, setCustomMaterials] = useState<{ value: string; label: string }[]>([]);
  const [customMaterialSpecs, setCustomMaterialSpecs] = useState<Record<string, string[]>>({});
  const [customHeatTreatments, setCustomHeatTreatments] = useState<string[]>([]);

  // State for "Add to list" input mode
  const [addingMaterial, setAddingMaterial] = useState(false);
  const [addingSpec, setAddingSpec] = useState(false);
  const [addingHeatTreat, setAddingHeatTreat] = useState(false);
  const [newItemValue, setNewItemValue] = useState("");
  const [mroCatalog, setMroCatalog] = useState<RawMroAssetCatalogResponse | null>(null);
  const [isLoadingMroCatalog, setIsLoadingMroCatalog] = useState(false);

  // Load custom items from localStorage on mount
  useEffect(() => {
    try {
      const storedMaterials = localStorage.getItem(STORAGE_KEYS.customMaterials);
      const storedSpecs = localStorage.getItem(STORAGE_KEYS.customMaterialSpecs);
      const storedHeatTreatments = localStorage.getItem(STORAGE_KEYS.customHeatTreatments);

      if (storedMaterials) setCustomMaterials(JSON.parse(storedMaterials));
      if (storedSpecs) setCustomMaterialSpecs(JSON.parse(storedSpecs));
      if (storedHeatTreatments) setCustomHeatTreatments(JSON.parse(storedHeatTreatments));
    } catch (error) {
      logWarn("Failed to load custom items from localStorage:", error);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadMroCatalog = async () => {
      setIsLoadingMroCatalog(true);

      try {
        const response = await fetchMroAssetCatalog();

        if (!cancelled) {
          setMroCatalog(response);
        }
      } catch (error) {
        if (!cancelled) {
          logWarn("Failed to load local MRO assets:", error);
          setMroCatalog({
            available: false,
            baseDir: null,
            assets: [],
            message: "Failed to load local MRO assets.",
          });
        }
      } finally {
        if (!cancelled) {
          setIsLoadingMroCatalog(false);
        }
      }
    };

    void loadMroCatalog();

    return () => {
      cancelled = true;
    };
  }, []);

  // Helper to add custom material
  const addCustomMaterial = (name: string) => {
    if (!name.trim()) return;
    const value = `custom_${name.toLowerCase().replace(/\s+/g, '_')}`;
    const newMaterial = { value, label: name.trim() };
    const updated = [...customMaterials, newMaterial];
    setCustomMaterials(updated);
    localStorage.setItem(STORAGE_KEYS.customMaterials, JSON.stringify(updated));
    onChange({ ...data, material: value as MaterialType, materialSpec: "", customMaterialName: "" });
    setAddingMaterial(false);
    setNewItemValue("");
  };

  // Helper to add custom material spec
  const addCustomMaterialSpec = (spec: string, material: string) => {
    if (!spec.trim() || !material) return;
    const updated = { ...customMaterialSpecs };
    if (!updated[material]) updated[material] = [];
    updated[material] = [...updated[material], spec.trim()];
    setCustomMaterialSpecs(updated);
    localStorage.setItem(STORAGE_KEYS.customMaterialSpecs, JSON.stringify(updated));
    onChange({ ...data, materialSpec: spec.trim() });
    setAddingSpec(false);
    setNewItemValue("");
  };

  // Helper to add custom heat treatment
  const addCustomHeatTreatment = (treatment: string) => {
    if (!treatment.trim()) return;
    const updated = [...customHeatTreatments, treatment.trim()];
    setCustomHeatTreatments(updated);
    localStorage.setItem(STORAGE_KEYS.customHeatTreatments, JSON.stringify(updated));
    onChange({ ...data, heatTreatment: treatment.trim() });
    setAddingHeatTreat(false);
    setNewItemValue("");
  };

  // Get all materials (default + custom)
  const allMaterials = [...materials, ...customMaterials];

  // Get all specs for current material (default + custom)
  const getAllSpecsForMaterial = (material: string): string[] => {
    const defaultSpecs = materialSpecs[material as MaterialType] || [];
    const customSpecs = customMaterialSpecs[material] || [];
    return [...defaultSpecs, ...customSpecs];
  };

  // Get all heat treatments (default + custom)
  const allHeatTreatments = [...defaultHeatTreatments, ...customHeatTreatments];
  const availableMaterialSpecs = React.useMemo(
    () => includeCurrentOption(getAllSpecsForMaterial(data.material), data.materialSpec),
    [data.material, data.materialSpec, customMaterialSpecs],
  );
  const availableHeatTreatments = React.useMemo(
    () => includeCurrentOption(allHeatTreatments, data.heatTreatment),
    [allHeatTreatments, data.heatTreatment],
  );
  const lastAutoDensityMaterialRef = useRef<string | null>(null);

  const updateField = (field: keyof InspectionSetupData, value: any) => {
    onChange({ ...data, [field]: value });
  };

  const isV2500Standard = isV2500NdipStandard(standardType);
  const v2500PartTypeLabel = getV2500PartTypeLabel(standardType);
  const inspectionSetupProfile = React.useMemo(
    () => getInspectionSetupStandardProfile(standardType),
    [standardType],
  );
  const v2500HptReferenceDefaults = React.useMemo(
    () => getV2500HptReferenceDefaults(standardType),
    [standardType],
  );
  const activeMroLabel = ACTIVE_MRO_STANDARD_CODES.join(" / ");
  const mroAssets = React.useMemo(
    () =>
      sortMroAssets(
        (mroCatalog?.assets || [])
          .filter((asset) => isSupportedMroAssetName(asset.name))
          .map(enrichMroAsset),
      ),
    [mroCatalog],
  );
  const relevantMroAssets = React.useMemo(
    () => getRelevantMroAssets(mroAssets, { partNumber: data.partNumber, standard: standardType, partType: data.partType }),
    [mroAssets, data.partNumber, standardType, data.partType],
  );
  const groupedMroAssets = React.useMemo(
    () => groupMroAssetsByCategory(mroAssets),
    [mroAssets],
  );
  const visibleMroGroups = React.useMemo(
    () => Object.entries(groupedMroAssets).filter(([, assets]) => assets.length > 0),
    [groupedMroAssets],
  );
  const threeDModelAssets = React.useMemo(
    () => groupedMroAssets["3d-model"] || [],
    [groupedMroAssets],
  );
  const relevantThreeDModelAssets = React.useMemo(
    () => relevantMroAssets.filter((asset) => asset.category === "3d-model"),
    [relevantMroAssets],
  );
  const activeLocalModel = React.useMemo(
    () => threeDModelAssets.find((asset) => asset.name === data.localModelAssetName) || null,
    [threeDModelAssets, data.localModelAssetName],
  );
  const selectedLocalModelExists = React.useMemo(
    () => threeDModelAssets.some((asset) => asset.name === data.localModelAssetName),
    [threeDModelAssets, data.localModelAssetName],
  );
  const setLocalModelAsset = React.useCallback(
    (assetName?: string) => {
      onChange({
        ...data,
        localModelAssetName: assetName,
      });
    },
    [data, onChange],
  );

  useEffect(() => {
    if (data.localModelAssetName && !selectedLocalModelExists) {
      onChange({
        ...data,
        localModelAssetName: undefined,
      });
    }
  }, [data, onChange, selectedLocalModelExists]);

  useEffect(() => {
    const normalizedSetup = normalizeInspectionSetupForStandard(data, standardType);

    if (normalizedSetup.partType !== data.partType) {
      onChange(normalizedSetup);
    }
  }, [data, onChange, standardType]);

  useEffect(() => {
    const defaults = getV2500InspectionSetupDefaults(standardType);
    if (!defaults) {
      return;
    }

    const hasChanges = Object.entries(defaults).some(([key, value]) => data[key as keyof InspectionSetupData] !== value);
    if (!hasChanges) {
      return;
    }

    onChange({
      ...data,
      ...defaults,
    });
  }, [
    data,
    onChange,
    standardType,
  ]);

  useEffect(() => {
    if (data.partType !== "hpt_disk") {
      return;
    }

    const referenceDefaults = v2500HptReferenceDefaults;
    const shouldSeedInnerDiameter =
      (data.innerDiameter == null || data.innerDiameter <= 0) &&
      typeof referenceDefaults?.innerDiameter === "number" &&
      referenceDefaults.innerDiameter > 0;

    const shouldClearGenericWall =
      typeof data.wallThickness === "number" &&
      data.wallThickness > 0;

    const shouldClearLegacyGeometry =
      !!data.hptDiskGeometry &&
      Object.keys(data.hptDiskGeometry).length > 0;

    if (!shouldSeedInnerDiameter && !shouldClearGenericWall && !shouldClearLegacyGeometry) {
      return;
    }

    onChange({
      ...data,
      innerDiameter: shouldSeedInnerDiameter ? referenceDefaults?.innerDiameter : data.innerDiameter,
      wallThickness: shouldClearGenericWall ? undefined : data.wallThickness,
      hptDiskGeometry: undefined,
    });
  }, [
    data,
    onChange,
    v2500HptReferenceDefaults,
  ]);

  // ═══════════════════════════════════════════════════════════════════════════
  // AUTO-RECOMMENDATION: Get calibration block recommendation based on part
  // NOW WITH SCAN DIRECTIONS INTEGRATION! 🔗
  // PERFORMANCE: Debounced to prevent lag on rapid shape changes
  // ═══════════════════════════════════════════════════════════════════════════
  useEffect(() => {
    const effectiveThickness = getInspectionThickness(data, 0);

    // Only run if we have all required parameters
    if (
      !data.material ||
      !data.partType ||
      effectiveThickness <= 0 ||
      !acceptanceClass ||
      !standardType ||
      data.partType === "custom" ||  // Skip custom shapes
      !onCalibrationRecommendation    // Skip if no callback provided
    ) {
      return;
    }

    // Debounce: Wait 300ms before running heavy computation
    const timeoutId = setTimeout(() => {
    try {
      const scanDirectionInfo = scanDetails
        ? deriveCalibrationScanDirectionInfo(scanDetails.scanDetails, standardType)
        : undefined;

      const recommendationInput: CalibrationRecommendationInput = {
        material: data.material as MaterialType,
        materialSpec: data.materialSpec || "",
        partType: data.partType as PartGeometry,
        standard: standardType,
        thickness: effectiveThickness,
        length: data.partLength,
        width: data.partWidth,
        outerDiameter: data.diameter,
        innerDiameter: data.innerDiameter,
        acceptanceClass: acceptanceClass as AcceptanceClass,
        beamType: scanDirectionInfo?.hasAngleBeam ? 'angle' : 'straight',
        scanDirections: scanDirectionInfo, // 🔗 Pass scan directions
        // OEM vendor is auto-derived from standard in calibrationRecommenderV2
      };

      const recommendation = generateCalibrationRecommendationV2(recommendationInput);

      logInfo("📋 Auto-recommendation (with scan directions):", {
        partType: data.partType,
        standard: standardType,
        scanDirections: scanDirectionInfo,
        recommendedBlock: recommendation.primaryBlock.category,
        reasoning: recommendation.reasoning.blockSelection
      });

      // Pass back the recommendation to parent (e.g., to update CalibrationTab)
      onCalibrationRecommendation(
        recommendation.primaryBlock.category,
        recommendation.reasoning.blockSelection
      );

    } catch (error) {
      logWarn("Failed to generate calibration recommendation:", error);
    }
    }, 300); // End of debounce setTimeout

    // Cleanup: Cancel pending computation if dependencies change
    return () => clearTimeout(timeoutId);
  }, [
    data.material,
    data.partType,
    data.partThickness,
    data.wallThickness,
    data.isHollow,
    data.diameter,
    data.innerDiameter,
    acceptanceClass,
    standardType,
    onCalibrationRecommendation,
    scanDetails // 🔗 Re-run when scan details change!
  ]);

  const handleCustomShapeImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      updateField("customShapeImage", reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  // ── Per-shape field configuration ──
  const fieldConfig = getPartFieldConfig(data.partType || '');
  const showDiameter = fieldConfig.showOD;
  const canBeHollow = fieldConfig.canBeHollow;
  const isCone = fieldConfig.isCone;
  const isAlwaysHollow = fieldConfig.alwaysHollow;
  const hasPartTypeSelection = Boolean(data.partType);
  const isHptDisk = data.partType === "hpt_disk";
  const hideNdipScalarFields = isV2500Standard;
  const circularIdLabel = isHptDisk ? "Nominal Bore ID (mm)" : "ID (mm)";
  const showGenericCircularWall = !isHptDisk;

  // Auto-enable isHollow when selecting an always-hollow shape
  React.useEffect(() => {
    if (isAlwaysHollow && !data.isHollow) {
      onChange({ ...data, isHollow: true });
    }
  }, [data.partType]); // Only run when partType changes

  // Auto-sync partThickness for shapes where the thickness field is hidden
  // (e.g., cylinder → thickness = diameter, tube → thickness = wall)
  React.useEffect(() => {
    if (!fieldConfig.showThickness && data.partType) {
      let autoThickness: number | undefined;
      if (data.isHollow && data.wallThickness && data.wallThickness > 0) {
        autoThickness = data.wallThickness;
      } else if (data.diameter && data.diameter > 0) {
        autoThickness = data.diameter;
      }
      if (autoThickness && Math.abs((data.partThickness || 0) - autoThickness) > 0.01) {
        updateField("partThickness", autoThickness);
      }
    }
  }, [fieldConfig.showThickness, data.diameter, data.wallThickness, data.isHollow, data.partType, data.partThickness, updateField]);

  // Auto-calculate wall thickness if inner and outer dimensions are set
  React.useEffect(() => {
    if (data.partType === "hpt_disk") {
      return;
    }

    // Only auto-calculate for hollow parts with valid diameter values
    if (data.isHollow && data.diameter && data.innerDiameter && data.innerDiameter > 0) {
      const calculatedWallThickness = (data.diameter - data.innerDiameter) / 2;
      // Only update if the calculated value differs significantly
      if (calculatedWallThickness > 0 && Math.abs((data.wallThickness || 0) - calculatedWallThickness) > 0.01) {
        updateField("wallThickness", calculatedWallThickness);
      }
    }
  }, [data.diameter, data.innerDiameter, data.isHollow, data.wallThickness, updateField]);

  // ═══════════════════════════════════════════════════════════════════════════
  // AUTOMATIC SHAPE CLASSIFICATION - DISABLED
  // This feature was causing issues where user-selected shapes would be 
  // immediately reclassified based on existing dimensions.
  // The classification logic is preserved in comments for future reference.
  // ═══════════════════════════════════════════════════════════════════════════
  // React.useEffect(() => {
  //   if (!data.partType) return;
  //   
  //   // Don't auto-classify if dimensions are not yet filled in
  //   const hasRectangularDimensions = data.partLength && data.partWidth && data.partThickness;
  //   const hasCircularDimensions = data.diameter && (data.partLength || data.partThickness);
  //   
  //   if (!hasRectangularDimensions && !hasCircularDimensions) {
  //     return;
  //   }
  //   
  //   const newPartType = classifyShape(data.partType, {
  //     diameter: data.diameter,
  //     innerDiameter: data.innerDiameter,
  //     length: data.partLength,
  //     width: data.partWidth,
  //     thickness: data.partThickness,
  //     wallThickness: data.wallThickness
  //   });
  //   
  //   if (newPartType !== data.partType) {
  //     console.log(`🔄 Auto-classifying shape: ${data.partType} → ${newPartType}`);
  //     setTimeout(() => {
  //       const currentData = dataRef.current;
  //       onChangeRef.current({ ...currentData, partType: newPartType });
  //     }, 0);
  //   }
  // }, [data.partType, data.diameter, data.innerDiameter, data.partLength, data.partWidth, data.partThickness, data.wallThickness]);
  
  // Get material properties for info
  const materialProps = data.material ? materialDatabase[data.material as MaterialType] : null;
  const materialInfo = materialProps ? 
    `Density: ${materialProps.density} g/cm³ | ${materialProps.surfaceCondition}` : 
    undefined;

  useEffect(() => {
    if (!data.material || data.material === "custom" || !materialProps) {
      lastAutoDensityMaterialRef.current = null;
      return;
    }

    const densityKgM3 = Math.round(materialProps.density * 1000);
    const materialChanged = lastAutoDensityMaterialRef.current !== data.material;

    if (materialChanged || !data.materialDensity) {
      lastAutoDensityMaterialRef.current = data.material;
      updateField("materialDensity", densityKgM3);
    }
  }, [data.material, data.materialDensity, materialProps]);

  return (
    <div className="space-y-4 p-3 md:p-4">
      <div className="grid grid-cols-2 items-start gap-x-4 gap-y-5 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        <FieldWithHelp
          label="Technique Card ID"
          fieldKey="techniqueCardId"
        >
          <Input
            value={data.techniqueCardId ?? ''}
            onChange={(e) => updateField("techniqueCardId", e.target.value)}
            className="bg-background"
          />
        </FieldWithHelp>

        <FieldWithHelp
          label="Part Number"
          fieldKey="partNumber"
          required
        >
          <Input
            value={data.partNumber}
            onChange={(e) => updateField("partNumber", e.target.value)}
            className="bg-background"
          />
        </FieldWithHelp>

        <FieldWithHelp
          label="Part Name"
          fieldKey="partName"
          required
        >
          <Input
            value={data.partName}
            onChange={(e) => updateField("partName", e.target.value)}
            className="bg-background"
          />
        </FieldWithHelp>

        <FieldWithHelp
          label="Material"
          fieldKey="material"
          required
        >
          {addingMaterial ? (
            <div className="flex gap-1">
              <Input
                value={newItemValue}
                onChange={(e) => setNewItemValue(e.target.value)}
                className="bg-background flex-1"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') addCustomMaterial(newItemValue);
                  if (e.key === 'Escape') { setAddingMaterial(false); setNewItemValue(""); }
                }}
              />
              <Button size="sm" onClick={() => addCustomMaterial(newItemValue)} className="h-9">
                <Plus className="h-3 w-3" />
              </Button>
              <Button size="sm" variant="ghost" onClick={() => { setAddingMaterial(false); setNewItemValue(""); }} className="h-9">
                <X className="h-3 w-3" />
              </Button>
            </div>
          ) : (
            <Select
              value={data.material}
              onValueChange={(value: string) => {
                if (value === "__add_new__") {
                  setAddingMaterial(true);
                  setNewItemValue("");
                } else {
                  onChange({ ...data, material: value as MaterialType, materialSpec: "", customMaterialName: "" });
                }
              }}
            >
              <SelectTrigger className="bg-background">
                <SelectValue placeholder="" />
              </SelectTrigger>
              <SelectContent className="max-h-[300px]">
                {allMaterials.map((mat) => (
                  <SelectItem key={mat.value} value={mat.value}>
                    {mat.label}
                  </SelectItem>
                ))}
                <SelectItem value="__add_new__" className="text-primary font-medium border-t mt-1 pt-1">
                  <span className="flex items-center gap-1">
                    <Plus className="h-3 w-3" /> Add to the list
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>
          )}
          {data.material === "custom" && (
            <Input
              value={data.customMaterialName || ""}
              onChange={(e) => updateField("customMaterialName", e.target.value)}
              className="bg-background mt-2"
            />
          )}
          {materialProps && (
            <div className="hidden">
              <div><strong>Density:</strong> {materialProps.density} g/cm³ ({Math.round(materialProps.density * 1000)} kg/m³)</div>
              <div><strong>Impedance:</strong> {materialProps.acousticImpedance} MRayls</div>
            </div>
          )}
        </FieldWithHelp>

        <FieldWithHelp
          label="Material Specification"
          fieldKey="material"
          required
        >
          {addingSpec ? (
            <div className="flex gap-1">
              <Input
                value={newItemValue}
                onChange={(e) => setNewItemValue(e.target.value)}
                className="bg-background flex-1"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') addCustomMaterialSpec(newItemValue, data.material);
                  if (e.key === 'Escape') { setAddingSpec(false); setNewItemValue(""); }
                }}
              />
              <Button size="sm" onClick={() => addCustomMaterialSpec(newItemValue, data.material)} className="h-9">
                <Plus className="h-3 w-3" />
              </Button>
              <Button size="sm" variant="ghost" onClick={() => { setAddingSpec(false); setNewItemValue(""); }} className="h-9">
                <X className="h-3 w-3" />
              </Button>
            </div>
          ) : (
            <Select
              value={data.materialSpec}
              onValueChange={(value) => {
                if (value === "__add_new__") {
                  setAddingSpec(true);
                  setNewItemValue("");
                } else {
                  updateField("materialSpec", value);
                }
              }}
              disabled={!data.material}
            >
              <SelectTrigger className="bg-background">
                <SelectValue placeholder="" />
              </SelectTrigger>
              <SelectContent className="max-h-[300px]">
                {data.material && availableMaterialSpecs.map((spec) => (
                  <SelectItem key={spec} value={spec}>
                    {spec}
                  </SelectItem>
                ))}
                {data.material && (
                  <SelectItem value="__add_new__" className="text-primary font-medium border-t mt-1 pt-1">
                    <span className="flex items-center gap-1">
                      <Plus className="h-3 w-3" /> Add to the list
                    </span>
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
          )}
        </FieldWithHelp>

        {/* Heat Treat - moved here next to Material Specification */}
        <FieldWithHelp
          label="Heat Treat"
          fieldKey="material"
        >
          {addingHeatTreat ? (
            <div className="flex gap-1">
              <Input
                value={newItemValue}
                onChange={(e) => setNewItemValue(e.target.value)}
                className="bg-background flex-1"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') addCustomHeatTreatment(newItemValue);
                  if (e.key === 'Escape') { setAddingHeatTreat(false); setNewItemValue(""); }
                }}
              />
              <Button size="sm" onClick={() => addCustomHeatTreatment(newItemValue)} className="h-9">
                <Plus className="h-3 w-3" />
              </Button>
              <Button size="sm" variant="ghost" onClick={() => { setAddingHeatTreat(false); setNewItemValue(""); }} className="h-9">
                <X className="h-3 w-3" />
              </Button>
            </div>
          ) : (
            <Select
              value={data.heatTreatment || ""}
              onValueChange={(value) => {
                if (value === "__add_new__") {
                  setAddingHeatTreat(true);
                  setNewItemValue("");
                } else {
                  updateField("heatTreatment", value);
                }
              }}
            >
              <SelectTrigger className="bg-background">
                <SelectValue placeholder="" />
              </SelectTrigger>
              <SelectContent className="max-h-[300px]">
                {availableHeatTreatments.map((ht) => (
                  <SelectItem key={ht} value={ht}>
                    {ht}
                  </SelectItem>
                ))}
                <SelectItem value="__add_new__" className="text-primary font-medium border-t mt-1 pt-1">
                  <span className="flex items-center gap-1">
                    <Plus className="h-3 w-3" /> Add to the list
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>
          )}
        </FieldWithHelp>


        <div className="md:col-span-2">
          <FieldWithHelp
            label="Part Type"
            fieldKey="partType"
            required
          >
            {isV2500Standard ? (
              <div className="space-y-2">
                <Input
                  value={v2500PartTypeLabel}
                  readOnly
                  className="bg-muted/40 font-medium"
                />
                <p className="text-xs text-muted-foreground">
                  NDIP V2500 setup is locked to the stage-specific HPT disk geometry.
                </p>
              </div>
            ) : (
              <>
                <PartTypeVisualSelector
                  value={data.partType}
                  material={data.material}
                  allowedPartTypes={inspectionSetupProfile.allowedPartTypes}
                  onChange={(value) => {
                    onChange({ 
                      ...data, 
                      partType: value,
                      customShapeDescription: value === "custom" ? data.customShapeDescription : undefined,
                      customShapeParameters: value === "custom" ? data.customShapeParameters : undefined
                    });
                  }}
                />
                {inspectionSetupProfile.partTypeScopeNote && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    {inspectionSetupProfile.partTypeScopeNote}
                  </p>
                )}
              </>
            )}
          </FieldWithHelp>
        </div>

        {data.partType === "custom" && (
          <>
            <FieldWithHelp
              label="Custom Description"
              fieldKey="partType"
              required
            >
              <Input
                value={data.customShapeDescription || ""}
                onChange={(e) => updateField("customShapeDescription", e.target.value)}
                className="bg-background"
              />
            </FieldWithHelp>

            <FieldWithHelp
              label="Shape Image"
              fieldKey="partType"
            >
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7"
                  onClick={() => document.getElementById('custom-shape-image-upload')?.click()}
                >
                  <Upload className="h-3 w-3 mr-1" />
                  {data.customShapeImage ? "Change" : "Upload"}
                </Button>
                <input
                  id="custom-shape-image-upload"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleCustomShapeImageUpload}
                />
                {data.customShapeImage && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 text-destructive"
                    onClick={() => updateField("customShapeImage", undefined)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                )}
              </div>
            </FieldWithHelp>
          </>
        )}

        {hasPartTypeSelection && fieldConfig.showThickness && !hideNdipScalarFields && (
          <FieldWithHelp
            label={fieldConfig.thicknessLabel}
            fieldKey="thickness"
            required
          >
            <Input
              type="number"
              value={data.partThickness || ""}
              onChange={(e) => updateField("partThickness", parseFloat(e.target.value) || 0)}
              min={6.35}
              step={0.1}
              className="bg-background"
            />
            {data.partThickness < 6.35 && data.partThickness > 0 && (
              <p className="text-xs text-destructive mt-1">
                Must be ≥ 6.35mm per standard scope
              </p>
            )}
          </FieldWithHelp>
        )}

        {hasPartTypeSelection && fieldConfig.showLength && (
          <FieldWithHelp
            label={fieldConfig.lengthLabel}
            fieldKey="thickness"
          >
            <Input
              type="number"
              value={data.partLength || ""}
              onChange={(e) => updateField("partLength", parseFloat(e.target.value) || 0)}
              min={0}
              step={0.1}
              className="bg-background"
            />
          </FieldWithHelp>
        )}

        {hasPartTypeSelection && fieldConfig.showWidth && (
          <FieldWithHelp
            label="Width (mm)"
            fieldKey="thickness"
          >
            <Input
              type="number"
              value={data.partWidth || ""}
              onChange={(e) => updateField("partWidth", parseFloat(e.target.value) || 0)}
              min={0}
              step={0.1}
              className="bg-background"
            />
          </FieldWithHelp>
        )}

        <FieldWithHelp
          label="Drawing No."
          fieldKey="partNumber"
        >
          <Input
            value={data.drawingNumber || ""}
            onChange={(e) => updateField("drawingNumber", e.target.value)}
            className="bg-background"
          />
        </FieldWithHelp>

        {!hideNdipScalarFields && (
          <FieldWithHelp
            label="Density (kg/m³)"
            fieldKey="material"
          >
            <Input
              type="number"
              value={data.materialDensity || ""}
              onChange={(e) => updateField("materialDensity", parseFloat(e.target.value) || undefined)}
              className="bg-background"
            />
          </FieldWithHelp>
        )}

        {hasPartTypeSelection && showDiameter && !hideNdipScalarFields && (
          <FieldWithHelp
            label={fieldConfig.odLabel}
            fieldKey="thickness"
            required={showDiameter}
          >
            <Input
              type="number"
              value={data.diameter ?? ''}
              onChange={(e) => {
                const value = e.target.value;
                if (value === '' || value === null) {
                  updateField("diameter", undefined);
                  return;
                }
                const numValue = parseFloat(value);
                if (!isNaN(numValue)) {
                  updateField("diameter", numValue);
                }
              }}
              min={0}
              step={0.1}
              className="bg-background"
            />
          </FieldWithHelp>
        )}

        {/* Cone dimensions - Cone is always hollow (like a tapered tube) */}
        {hasPartTypeSelection && isCone && !hideNdipScalarFields && (
          <>
            <FieldWithHelp
              label="Base OD (mm)"
              fieldKey="thickness"
              required
            >
              <Input
                type="number"
                value={data.coneBottomDiameter ?? ''}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value === '' || value === null) {
                    updateField("coneBottomDiameter", undefined);
                    return;
                  }
                  const numValue = parseFloat(value);
                  if (!isNaN(numValue)) {
                    updateField("coneBottomDiameter", numValue);
                  }
                }}
                min={0}
                step={0.1}
                className="bg-background"
              />
            </FieldWithHelp>

            <FieldWithHelp
              label="Top OD (mm)"
              fieldKey="thickness"
              required
            >
              <Input
                type="number"
                value={data.coneTopDiameter ?? ''}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value === '' || value === null) {
                    updateField("coneTopDiameter", undefined);
                    return;
                  }
                  const numValue = parseFloat(value);
                  if (!isNaN(numValue)) {
                    updateField("coneTopDiameter", numValue);
                  }
                }}
                min={1}
                max={data.coneBottomDiameter ? data.coneBottomDiameter - 0.1 : undefined}
                step={0.1}
                className="bg-background"
              />
            </FieldWithHelp>

            <FieldWithHelp
              label="Height (mm)"
              fieldKey="thickness"
              required
            >
              <Input
                type="number"
                value={data.coneHeight ?? ''}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value === '' || value === null) {
                    updateField("coneHeight", undefined);
                    return;
                  }
                  const numValue = parseFloat(value);
                  if (!isNaN(numValue)) {
                    updateField("coneHeight", numValue);
                  }
                }}
                min={0}
                step={0.1}
                className="bg-background"
              />
            </FieldWithHelp>

            <FieldWithHelp
              label="Wall (mm)"
              fieldKey="thickness"
              required
            >
              <Input
                type="number"
                value={data.wallThickness ?? ''}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value === '' || value === null) {
                    updateField("wallThickness", undefined);
                    return;
                  }
                  const numValue = parseFloat(value);
                  if (!isNaN(numValue)) {
                    updateField("wallThickness", numValue);
                  }
                }}
                min={0}
                step={0.1}
                className="bg-background"
              />
            </FieldWithHelp>
          </>
        )}

        {/* Hollow/Solid Toggle - only for shapes that CAN be hollow (not always-hollow or cone) */}
        {hasPartTypeSelection && canBeHollow && !isAlwaysHollow && !isCone && (
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isHollow"
              checked={data.isHollow ?? false}
              onChange={(e) => onChange({ ...data, isHollow: e.target.checked })}
              className="w-3 h-3 cursor-pointer"
            />
            <Label htmlFor="isHollow" className="text-xs cursor-pointer">
              Hollow Part
            </Label>
          </div>
        )}

        {/* Hollow Dimensions - Circular (ID + Wall) */}
        {hasPartTypeSelection && data.isHollow && fieldConfig.hollowType === 'circular' && !hideNdipScalarFields && (
          <>
            <FieldWithHelp
              label={circularIdLabel}
              fieldKey="thickness"
              required
            >
              <Input
                type="number"
                value={data.innerDiameter ?? ''}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value === '' || value === null) {
                    updateField("innerDiameter", undefined);
                    return;
                  }
                  const innerDiam = parseFloat(value);
                  if (!isNaN(innerDiam)) {
                    // Update innerDiameter + wallThickness in a single call
                    // to avoid stale-closure overwrite when both are set separately
                    if (data.diameter && innerDiam > 0) {
                      onChange({ ...data, innerDiameter: innerDiam, wallThickness: (data.diameter - innerDiam) / 2 });
                    } else {
                      updateField("innerDiameter", innerDiam);
                    }
                  }
                }}
                min={0}
                max={data.diameter ? data.diameter - 0.1 : undefined}
                step={0.1}
                className="bg-background"
              />
              {data.innerDiameter && data.diameter && data.innerDiameter >= data.diameter && (
                <p className="text-xs text-destructive mt-1">
                  Inner diameter must be less than outer diameter
                </p>
              )}
            </FieldWithHelp>

            {showGenericCircularWall && (
              <FieldWithHelp
                label="Wall (mm)"
                fieldKey="thickness"
              >
                <Input
                  type="number"
                  value={data.wallThickness ? data.wallThickness.toFixed(2) : ""}
                  onChange={(e) => updateField("wallThickness", parseFloat(e.target.value) || 0)}
                  min={0}
                  step={0.1}
                  className="bg-background"
                />
              </FieldWithHelp>
            )}
          </>
        )}

        {/* Hollow Dimensions - Rectangular (Inner L + Inner W + Wall) */}
        {hasPartTypeSelection && data.isHollow && fieldConfig.hollowType === 'rectangular' && !hideNdipScalarFields && (
              <>
                <FieldWithHelp
                  label="Inner L (mm)"
                  fieldKey="thickness"
                  required
                >
                  <Input
                    type="number"
                    value={data.innerLength ?? ''}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (value === '' || value === null) {
                        updateField("innerLength", undefined);
                        return;
                      }
                      const numValue = parseFloat(value);
                      if (!isNaN(numValue)) {
                        updateField("innerLength", numValue);
                      }
                    }}
                    min={0}
                    max={data.partLength ? data.partLength - 0.1 : undefined}
                    step={0.1}
                    className="bg-background"
                  />
                </FieldWithHelp>

                <FieldWithHelp
                  label="Inner W (mm)"
                  fieldKey="thickness"
                  required
                >
                  <Input
                    type="number"
                    value={data.innerWidth ?? ''}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (value === '' || value === null) {
                        updateField("innerWidth", undefined);
                        return;
                      }
                      const numValue = parseFloat(value);
                      if (!isNaN(numValue)) {
                        updateField("innerWidth", numValue);
                      }
                    }}
                    min={0}
                    max={data.partWidth ? data.partWidth - 0.1 : undefined}
                    step={0.1}
                    className="bg-background"
                  />
                </FieldWithHelp>

                <FieldWithHelp
                  label="Wall Thickness (mm)"
                  fieldKey="thickness"
                  required
                >
                  <Input
                    type="number"
                    value={data.wallThickness ?? ''}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (value === '' || value === null) {
                        updateField("wallThickness", undefined);
                        return;
                      }
                      const numValue = parseFloat(value);
                      if (!isNaN(numValue)) {
                        updateField("wallThickness", numValue);
                      }
                    }}
                    min={0}
                    step={0.1}
                    className="bg-background"
                  />
                </FieldWithHelp>
              </>
            )}

      </div>

      {/* Technical Drawing with Dimensions */}
      {data.partType && (
        <Card className="workstation-card mt-5 overflow-visible border-0 p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold">Part Drawing with Dimensions</h3>
              <p className="text-xs text-muted-foreground">Live engineering sheet generated directly from the setup values.</p>
            </div>
            <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary">
              Live Drawing
            </Badge>
          </div>
          <div className="technical-stage h-[520px] w-full overflow-visible">
            <RealTimeTechnicalDrawing
              partType={data.partType}
              material={data.material as MaterialType}
              standardType={standardType}
              partNumber={data.partNumber}
              enabledScanDirections={scanDetails?.scanDetails?.filter(s => s.enabled).map(s => s.scanningDirection) || []}
              directionColors={Object.fromEntries((scanDetails?.scanDetails || []).map(s => [s.scanningDirection, s.color || '#111827']))}
              dimensions={{
                length: data.partLength || 100,
                width: data.partWidth || 50,
                thickness: data.partThickness || 10,
                diameter: data.diameter,
                isHollow: data.isHollow,
                innerDiameter: data.innerDiameter,
                innerLength: data.innerLength,
                innerWidth: data.innerWidth,
                wallThickness: data.wallThickness,
              }}
              showGrid={false}
              showDimensions={true}
            />
          </div>
        </Card>
      )}

      {inspectionSetupProfile.showMroReferenceLibrary && (isLoadingMroCatalog || mroCatalog || mroAssets.length > 0) && (
        <Card className="workstation-card mt-5 overflow-visible border-0 p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold">Local MRO Reference Library</h3>
              <p className="text-xs text-muted-foreground">
                Files detected in <span className="font-mono">public/standards/MRO</span> are exposed here only when they match the
                approved {activeMroLabel} V2500 package. Duplicate or legacy files stay hidden from the software.
              </p>
            </div>
            <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary">
              <HardDrive className="mr-1 h-3 w-3" />
              Local Only
            </Badge>
          </div>

          {isLoadingMroCatalog ? (
            <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-background/60 px-3 py-4 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Scanning local MRO files...
            </div>
          ) : !mroCatalog?.available ? (
            <div className="rounded-lg border border-dashed border-border/70 bg-background/60 px-4 py-4 text-sm text-muted-foreground">
              {mroCatalog?.message || "No local MRO directory was detected."}
            </div>
          ) : (
            <div className="space-y-5">
              {threeDModelAssets.length > 0 && (
                <div className="space-y-2 rounded-lg border border-border/70 bg-background/70 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <Label className="text-sm font-medium">3D Viewer Source</Label>
                      <p className="text-xs text-muted-foreground">
                        Choose which local STL model should drive the live 3D preview in setup.
                      </p>
                    </div>
                    <Badge variant="outline">{threeDModelAssets.length} STL</Badge>
                  </div>

                  <Select
                    value={data.localModelAssetName || undefined}
                    onValueChange={(value) => {
                      setLocalModelAsset(value === "__parametric__" ? undefined : value);
                    }}
                  >
                    <SelectTrigger className="bg-background">
                      <SelectValue placeholder="" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__parametric__">Parametric Preview Only</SelectItem>
                      {threeDModelAssets.map((asset) => {
                        const isRelevant = relevantThreeDModelAssets.some((relevant) => relevant.name === asset.name);
                        return (
                          <SelectItem key={asset.name} value={asset.name}>
                            {asset.name}{isRelevant ? " (Relevant)" : ""}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>

                  {activeLocalModel ? (
                    <p className="text-xs text-muted-foreground">
                      Active local model: <span className="font-medium text-foreground">{activeLocalModel.name}</span>
                    </p>
                  ) : relevantThreeDModelAssets.length > 1 ? (
                    <p className="text-xs text-amber-600 dark:text-amber-400">
                      More than one relevant STL was found for this setup. The files are available below, but one must be selected explicitly before the 3D viewer will load it.
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      No STL is locked right now. The 3D viewer falls back to the internal parametric shape preview.
                    </p>
                  )}
                </div>
              )}

              {relevantMroAssets.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium">Relevant To Current Setup</Label>
                    <Badge variant="secondary">{relevantMroAssets.length}</Badge>
                  </div>
                  <div className="grid gap-2">
                    {relevantMroAssets.map((asset) => (
                      <div
                        key={`relevant-${asset.name}`}
                        className="flex flex-col gap-3 rounded-lg border border-primary/20 bg-primary/5 p-3 lg:flex-row lg:items-center lg:justify-between"
                      >
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="truncate text-sm font-medium">{asset.name}</p>
                            <Badge variant="outline">{asset.categoryLabel}</Badge>
                            <Badge variant="secondary">{asset.extension.replace(".", "").toUpperCase()}</Badge>
                            {asset.category === "3d-model" && data.localModelAssetName === asset.name && (
                              <Badge>Active In Viewer</Badge>
                            )}
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {asset.description} | {formatMroAssetSize(asset.size)}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          {asset.category === "3d-model" && (
                            <Button
                              size="sm"
                              variant={data.localModelAssetName === asset.name ? "default" : "secondary"}
                              onClick={() => setLocalModelAsset(asset.name)}
                            >
                              <HardDrive className="mr-1 h-3.5 w-3.5" />
                              {data.localModelAssetName === asset.name ? "Selected For Viewer" : "Use In 3D Viewer"}
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => window.open(asset.assetUrl, "_blank", "noopener,noreferrer")}
                          >
                            <ExternalLink className="mr-1 h-3.5 w-3.5" />
                            Open
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => window.open(asset.downloadUrl, "_blank", "noopener,noreferrer")}
                          >
                            <Download className="mr-1 h-3.5 w-3.5" />
                            Download
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">Approved Local MRO Assets</Label>
                  <Badge variant="secondary">{mroAssets.length}</Badge>
                </div>

                {visibleMroGroups.map(([groupName, assets]) => (
                  <div key={groupName} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-medium">{assets[0]?.categoryLabel || groupName}</Label>
                      <Badge variant="outline">{assets.length}</Badge>
                    </div>
                    <div className="grid gap-2">
                      {assets.map((asset) => (
                        <div
                          key={asset.name}
                          className="flex flex-col gap-3 rounded-lg border border-border/70 bg-background/70 p-3 lg:flex-row lg:items-center lg:justify-between"
                        >
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="truncate text-sm font-medium">{asset.name}</p>
                              <Badge variant="secondary">{asset.extension.replace(".", "").toUpperCase()}</Badge>
                              {asset.category === "3d-model" && data.localModelAssetName === asset.name && (
                                <Badge>Active In Viewer</Badge>
                              )}
                              {asset.partNumbers.map((partNumber) => (
                                <Badge key={`${asset.name}-${partNumber}`} variant="outline">
                                  {partNumber}
                                </Badge>
                              ))}
                              {asset.standards.map((assetStandard) => (
                                <Badge key={`${asset.name}-${assetStandard}`} variant="outline">
                                  {assetStandard}
                                </Badge>
                              ))}
                            </div>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {asset.description} | {formatMroAssetSize(asset.size)}
                            </p>
                          </div>
                          <div className="flex gap-2">
                            {asset.category === "3d-model" && (
                              <Button
                                size="sm"
                                variant={data.localModelAssetName === asset.name ? "default" : "secondary"}
                                onClick={() => setLocalModelAsset(asset.name)}
                              >
                                <HardDrive className="mr-1 h-3.5 w-3.5" />
                                {data.localModelAssetName === asset.name ? "Selected For Viewer" : "Use In 3D Viewer"}
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => window.open(asset.assetUrl, "_blank", "noopener,noreferrer")}
                            >
                              <ExternalLink className="mr-1 h-3.5 w-3.5" />
                              Open
                            </Button>
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => window.open(asset.downloadUrl, "_blank", "noopener,noreferrer")}
                            >
                              <Download className="mr-1 h-3.5 w-3.5" />
                              Download
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>
      )}
    </div>
  );
};
