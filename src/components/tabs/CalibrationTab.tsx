import { useState, useEffect, useMemo, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CalibrationData, InspectionSetupData, CalibrationBlockType, StandardType, CalibrationSensitivityRow, StraightBeamConversionRow } from "@/types/techniqueSheet";
import { Target, Info, Sparkles, AlertTriangle, Plus, X, Upload, ChevronDown, ChevronUp } from "lucide-react";
import { CalibrationCatalog } from "../CalibrationCatalog";
import { toast } from "sonner";
import { FieldWithHelp } from "@/components/FieldWithHelp";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
// New components for FBH table with dropdowns and previews
import { FBHHoleTableWithPreviews } from "../FBHHoleTableWithPreviews";
import { PWASIMCalibrationBlockDrawing } from "../drawings/PWASIMCalibrationBlockDrawing";
import { DynamicCalibrationBlockDrawing } from "../drawings/DynamicCalibrationBlockDrawing";
import { RingSegmentBlockDrawing } from "../drawings/RingSegmentBlockDrawing";
import { TubeAngleBeamReferenceDrawing } from "@/components/TubeAngleBeamReferenceDrawing";
// StraightBeamConversionTable columns are now merged inline into FBHHoleTable
// via the showSensitivityColumns prop (see FBHHoleTableWithPreviews).
import { AngleBeamCalibrationTable } from "../AngleBeamCalibrationTable";
import {
  calculateCalibrationBlockSpec,
  type PartGeometry as CalcPartGeometry,
  type CalculatedBlockType,
} from "@/rules/calibrationBlockDimensions";
import {
  DEFAULT_FBH_HOLES,
  DEFAULT_ANGLE_BEAM_CALIBRATION_ROWS,
  type FBHHoleRowData,
  type AngleBeamCalibrationRow,
  FBH_DIAMETER_OPTIONS,
  BLOCK_HEIGHT_E_OPTIONS,
  METAL_TRAVEL_OPTIONS
} from "@/data/fbhStandardsData";
import {
  calibrationByStandard,
  getFBHSizeForStandard,
} from "@/data/standardsDifferences";
import {
  getBeamRequirement,
  BEAM_TYPE_LABELS,
} from "@/utils/beamTypeClassification";
import { getInspectionThickness } from "@/utils/inspectionThickness";
import { getActiveMroStage, hasKnownActiveMroContext, isActiveMroStandard } from "@/utils/mroPolicy";
import { isTubeAngleBeamPartType } from "@/utils/tubeAngleBeamDrawings";

// ============================================================================
// HELPER FUNCTIONS FOR FBH AUTO-FILL
// ============================================================================

/**
 * Parse FBH diameter from the string returned by getFBHSizeForStandard()
 * Examples:
 */
function parseFBHSizeString(sizeStr: string): { inch: string; mm: number } | null {
  if (!sizeStr) return null;

  // Try to match patterns like "1/64" or "3/64"
  const inchMatch = sizeStr.match(/(\d+\/\d+)"/);
  if (inchMatch) {
    const inchVal = inchMatch[1];
    // Find in options
    const option = FBH_DIAMETER_OPTIONS.find(opt => opt.inch === inchVal);
    if (option) {
      return { inch: option.inch, mm: option.mm };
    }
    // Calculate mm from fraction
    const [num, denom] = inchVal.split('/').map(Number);
    if (num && denom) {
      const mm = Number(((num / denom) * 25.4).toFixed(2));
      return { inch: inchVal, mm };
    }
  }

  // Try to match metric patterns like "3mm" or "5mm"
  const mmMatch = sizeStr.match(/(\d+(?:\.\d+)?)\s*mm/i);
  if (mmMatch) {
    const mmVal = parseFloat(mmMatch[1]);
    // Find metric option in FBH_DIAMETER_OPTIONS
    const metricOption = FBH_DIAMETER_OPTIONS.find(
      opt => opt.standard.includes('EN') && Math.abs(opt.mm - mmVal) < 0.5
    );
    if (metricOption) {
      return { inch: metricOption.inch, mm: metricOption.mm };
    }
    return { inch: '-', mm: mmVal };
  }

  return null;
}

/**
 * Calculate DAC depths for 3 holes based on part thickness.
 * Standard practice: holes at approximately 25%, 50%, 75% of thickness.
 * Then find the closest standard METAL_TRAVEL_OPTIONS values.
 */
function calculateDACDepths(thicknessMm: number): number[] {
  if (!thicknessMm || thicknessMm <= 0) {
    // Return default depths if no thickness
    return [19.05, 38.10, 57.15];
  }

  // Calculate target depths at 25%, 50%, 75% of thickness
  const targetDepths = [
    thicknessMm * 0.25,
    thicknessMm * 0.50,
    thicknessMm * 0.75
  ];

  // Find closest standard values from METAL_TRAVEL_OPTIONS
  const standardDepths = targetDepths.map(target => {
    // Find the closest standard depth
    let closest = METAL_TRAVEL_OPTIONS[0].depthMm;
    let minDiff = Math.abs(target - closest);

    for (const opt of METAL_TRAVEL_OPTIONS) {
      const diff = Math.abs(target - opt.depthMm);
      if (diff < minDiff) {
        minDiff = diff;
        closest = opt.depthMm;
      }
    }

    return closest;
  });

  // Ensure depths are unique and in ascending order
  const uniqueDepths = [...new Set(standardDepths)].sort((a, b) => a - b);

  // If we have less than 3 unique depths, pad with nearby values
  while (uniqueDepths.length < 3) {
    const lastDepth = uniqueDepths[uniqueDepths.length - 1];
    const nextOption = METAL_TRAVEL_OPTIONS.find(opt => opt.depthMm > lastDepth);
    if (nextOption) {
      uniqueDepths.push(nextOption.depthMm);
    } else {
      break;
    }
  }

  return uniqueDepths.slice(0, 3);
}

interface CalibrationTabProps {
  data: CalibrationData;
  onChange: (data: CalibrationData) => void;
  inspectionSetup: InspectionSetupData;
  acceptanceClass: string;
  standard?: StandardType;
}

// Get standard label
const getStandardLabel = (standard: StandardType): string => {
  const labels: Partial<Record<StandardType, string>> = {
    "MIL-STD-2154": "MIL-STD-2154",
    "AMS-STD-2154E": "AMS-STD-2154E",
    "ASTM-A388": "ASTM A388/A388M",
    "BS-EN-10228-3": "BS EN 10228-3:2016",
    "BS-EN-10228-4": "BS EN 10228-4:2016",
    "ASTM-E2375": "ASTM E2375",
    "ASTM-E127": "ASTM E127",
    "ASTM-E164": "ASTM E164",
    "AMS-2630": "AMS 2630",
    "AMS-2631": "AMS 2631 (Titanium)",
    "AMS-2632": "AMS 2632 (Thin Materials)",
    "NDIP-1226": "PW NDIP-1226 (V2500 HPT S1)",
    "NDIP-1227": "PW NDIP-1227 (V2500 HPT S2)",
    "NDIP-1254": "PW NDIP-1254 (GTF HPT S1)",
    "NDIP-1257": "PW NDIP-1257 (GTF HPT S2)",
    "NDIP-1260": "PW NDIP-1260 (GTF IBR-8)",
    "PWA-SIM": "PWA SIM (Bar/Billet)",
    "EN-ISO-16810": "EN ISO 16810",
  };
  return labels[standard] || standard;
};

const getFBHDropdownStandard = (standard: StandardType): string => {
  if (standard === "ASTM-A388") return "ASTM A388";
  if (standard === "BS-EN-10228-3" || standard === "BS-EN-10228-4" || standard === "EN-ISO-16810") {
    return "EN 10228-3";
  }
  if (
    standard === "AMS-STD-2154E" ||
    standard === "MIL-STD-2154" ||
    standard === "ASTM-E2375" ||
    standard === "ASTM-E127" ||
    standard === "ASTM-E164" ||
    standard === "AMS-2630" ||
    standard === "AMS-2631" ||
    standard === "AMS-2632" ||
    standard === "NDIP-1226" ||
    standard === "NDIP-1227" ||
    standard === "NDIP-1254" ||
    standard === "NDIP-1257" ||
    standard === "NDIP-1260" ||
    standard === "PWA-SIM"
  ) {
    return "ASTM E127";
  }
  return "All";
};

const REFERENCE_MATERIAL_OPTIONS = [
  "Steel",
  "Stainless Steel",
  "Aluminum",
  "Titanium",
  "Nickel Alloy",
  "Magnesium",
] as const;

type BlockDimensionsMode = NonNullable<CalibrationData["blockDimensionsMode"]>;

const BLOCK_DIMENSIONS_MODE_OPTIONS: { value: BlockDimensionsMode; label: string }[] = [
  { value: "flat", label: "Flat" },
  { value: "curve", label: "Curve" },
  { value: "custom", label: "Custom" },
];

const buildCurveBlockDimensionsSummary = (
  idMm?: number,
  odMm?: number,
  thicknessMm?: number,
) => {
  const segments: string[] = [];
  if (Number.isFinite(idMm) && (idMm as number) > 0) {
    segments.push(`ID ${idMm} mm`);
  }
  if (Number.isFinite(odMm) && (odMm as number) > 0) {
    segments.push(`OD ${odMm} mm`);
  }
  if (Number.isFinite(thicknessMm) && (thicknessMm as number) > 0) {
    segments.push(`Thickness ${thicknessMm} mm`);
  }
  return segments.length > 0 ? `Curve (${segments.join(", ")})` : "Curve";
};

const hasPositiveNumber = (value?: number): value is number =>
  typeof value === "number" && Number.isFinite(value) && value > 0;

const formatMissingInputsSentence = (missingInputs: string[]): string => {
  if (missingInputs.length === 0) return "";
  if (missingInputs.length === 1) return missingInputs[0];
  if (missingInputs.length === 2) return `${missingInputs[0]} or ${missingInputs[1]}`;
  return `${missingInputs.slice(0, -1).join(", ")}, or ${missingInputs[missingInputs.length - 1]}`;
};

const normalizeSelectedBlockType = (selected?: string): CalculatedBlockType | undefined => {
  switch ((selected || "").trim()) {
    case "flat_fbh":
    case "cylinder_notched":
    case "cylinder_fbh":
    case "curved_fbh":
    case "custom":
      return selected as CalculatedBlockType;
    case "flat_block":
      return "flat_fbh";
    case "curved_block":
      return "curved_fbh";
    default:
      return undefined;
  }
};

export const CalibrationTab = ({
  data,
  onChange,
  inspectionSetup,
  acceptanceClass,
  standard = "AMS-STD-2154E"
}: CalibrationTabProps) => {
  // FBH Holes state - 3 rows by default with dropdown selections
  const [fbhHoles, setFbhHoles] = useState<FBHHoleRowData[]>(DEFAULT_FBH_HOLES);
  const [selectedModelId, setSelectedModelId] = useState<CalibrationBlockType | null>(null);
  const [activeBeamTab, setActiveBeamTab] = useState<"straight" | "angle">("straight");
  const [showReferenceBlockPreview, setShowReferenceBlockPreview] = useState(false);
  // Track if FBH table was auto-filled from standards
  const [fbhAutoFilled, setFbhAutoFilled] = useState(false);
  const [fbhAutoFillReason, setFbhAutoFillReason] = useState<string>("");
  // Sensitivity table state
  const [sensitivityRows, setSensitivityRows] = useState<CalibrationSensitivityRow[]>(
    data.sensitivityTable || [{ id: 1, reflectorType: 'FBH', reflectorSizeInch: '1/64', curvatureCorrection: 0, gainOffset: 0, deltaDbTotal: 0 }]
  );

  // Angle Beam Calibration Table state (dB corrections, reflector types)
  const [angleBeamCalibrationRows, setAngleBeamCalibrationRows] = useState<AngleBeamCalibrationRow[]>(
    data.angleBeamCalibrationRows || DEFAULT_ANGLE_BEAM_CALIBRATION_ROWS
  );

  const handleAngleBeamCalibrationRowsChange = (rows: AngleBeamCalibrationRow[]) => {
    setAngleBeamCalibrationRows(rows);
    onChange({ ...data, angleBeamCalibrationRows: rows });
  };

  const addSensitivityRow = () => {
    if (sensitivityRows.length >= 8) return;
    const newRow: CalibrationSensitivityRow = {
      id: Math.max(...sensitivityRows.map(r => r.id), 0) + 1,
      reflectorType: 'FBH',
      reflectorSizeInch: '1/64',
      curvatureCorrection: 0,
      gainOffset: 0,
      deltaDbTotal: 0,
    };
    const updated = [...sensitivityRows, newRow];
    setSensitivityRows(updated);
    onChange({ ...data, sensitivityTable: updated });
  };

  const removeSensitivityRow = (index: number) => {
    if (sensitivityRows.length <= 1) return;
    const updated = sensitivityRows.filter((_, i) => i !== index);
    setSensitivityRows(updated);
    onChange({ ...data, sensitivityTable: updated });
  };

  const updateSensitivityRow = (index: number, field: keyof CalibrationSensitivityRow, value: string | number) => {
    const updated = sensitivityRows.map((row, i) => {
      if (i !== index) return row;
      const newRow = { ...row, [field]: value };
      newRow.deltaDbTotal = Number((newRow.curvatureCorrection + newRow.gainOffset).toFixed(1));
      return newRow;
    });
    setSensitivityRows(updated);
    onChange({ ...data, sensitivityTable: updated });
  };

  // Ref to prevent auto-fill from triggering on initial mount
  const isInitialMount = useRef(true);

  // Determine beam requirements based on part type and hollow status
  const beamRequirement = useMemo(
    () => getBeamRequirement(inspectionSetup.partType, inspectionSetup.isHollow),
    [inspectionSetup.partType, inspectionSetup.isHollow]
  );
  const requiresBothBeams = beamRequirement === "both";

  // Memoize partDimensions to prevent infinite re-renders in RingSegmentBlockDrawing
  // and ensure it follows the actual part envelope dimensions from Setup.
  const partDimensions = useMemo(() => {
    const axialWidth =
      (typeof inspectionSetup.partLength === "number" && inspectionSetup.partLength > 0 ? inspectionSetup.partLength : undefined) ??
      (typeof inspectionSetup.partWidth === "number" && inspectionSetup.partWidth > 0 ? inspectionSetup.partWidth : undefined) ??
      (typeof inspectionSetup.partThickness === "number" && inspectionSetup.partThickness > 0 ? inspectionSetup.partThickness : undefined) ??
      (typeof inspectionSetup.wallThickness === "number" && inspectionSetup.wallThickness > 0 ? inspectionSetup.wallThickness : undefined);

    return {
      outerDiameterMm: inspectionSetup.diameter || undefined,
      innerDiameterMm: inspectionSetup.innerDiameter || undefined,
      axialWidthMm: axialWidth,
    };
  }, [
    inspectionSetup.diameter,
    inspectionSetup.innerDiameter,
    inspectionSetup.partLength,
    inspectionSetup.partWidth,
    inspectionSetup.partThickness,
    inspectionSetup.wallThickness,
  ]);

  const derivedInnerDiameterForAngleBeam = useMemo(() => {
    if (hasPositiveNumber(inspectionSetup.innerDiameter)) {
      return inspectionSetup.innerDiameter;
    }

    if (hasPositiveNumber(inspectionSetup.diameter) && hasPositiveNumber(inspectionSetup.wallThickness)) {
      const derivedInnerDiameter = inspectionSetup.diameter - inspectionSetup.wallThickness * 2;
      return derivedInnerDiameter > 0 ? derivedInnerDiameter : undefined;
    }

    return undefined;
  }, [
    inspectionSetup.diameter,
    inspectionSetup.innerDiameter,
    inspectionSetup.wallThickness,
  ]);

  const preferredRingSegmentStandardFamily = useMemo<"EN" | "ASTM" | "TUV">(() => {
    if (standard === "BS-EN-10228-3" || standard === "BS-EN-10228-4" || standard === "EN-ISO-16810") {
      return "EN";
    }

    if (standard === "ASTM-A388" || standard === "ASTM-E164") {
      return "ASTM";
    }

    return "TUV";
  }, [standard]);

  const preferredRingSegmentTemplateId = useMemo(() => {
    if (preferredRingSegmentStandardFamily === "EN") {
      return "EN_10228_DAC_REF_BLOCK";
    }

    if (preferredRingSegmentStandardFamily === "ASTM") {
      return "ASTM_E428_FBH_BLOCK";
    }

    return "TUV_STYLE_REF_BLOCK";
  }, [preferredRingSegmentStandardFamily]);

  const shouldUseRingSegmentAngleBeam = useMemo(() => {
    const partType = inspectionSetup.partType || "";
    if (!hasPositiveNumber(inspectionSetup.diameter) || !hasPositiveNumber(derivedInnerDiameterForAngleBeam)) {
      return false;
    }

    return [
      "tube",
      "pipe",
      "ring",
      "sleeve",
      "bushing",
      "hollow_cylinder",
      "ring_forging",
      "disk",
      "disk_forging",
      "hub",
      "impeller",
      "blisk",
      "hpt_disk",
    ].includes(partType);
  }, [
    inspectionSetup.diameter,
    inspectionSetup.partType,
    derivedInnerDiameterForAngleBeam,
  ]);

  const angleBeamPartDimensions = useMemo(() => ({
    outerDiameterMm: inspectionSetup.diameter || undefined,
    innerDiameterMm: derivedInnerDiameterForAngleBeam,
    axialWidthMm: partDimensions.axialWidthMm,
  }), [
    inspectionSetup.diameter,
    derivedInnerDiameterForAngleBeam,
    partDimensions.axialWidthMm,
  ]);

  const effectiveInspectionThickness = useMemo(
    () => getInspectionThickness(inspectionSetup, 0),
    [inspectionSetup]
  );

  // Memoize partDimensions for DynamicCalibrationBlockDrawing to prevent
  // re-creating the object on every render (which would defeat the useMemo
  // inside DynamicCalibrationBlockDrawing that depends on partDimensions).
  const partDimensionsForDrawing = useMemo(() => ({
    thickness: effectiveInspectionThickness || undefined,
    length: inspectionSetup.partLength,
    width: inspectionSetup.partWidth,
    outerDiameter: inspectionSetup.diameter,
    innerDiameter: inspectionSetup.innerDiameter,
    wallThickness: inspectionSetup.wallThickness,
  }), [
    effectiveInspectionThickness,
    inspectionSetup.partLength,
    inspectionSetup.partWidth,
    inspectionSetup.diameter,
    inspectionSetup.innerDiameter,
    inspectionSetup.wallThickness,
  ]);

  const mappedPartGeometry = useMemo(
    () => mapPartGeometry(inspectionSetup.partType || "plate"),
    [inspectionSetup.partType]
  );

  const selectedBlockOverride = useMemo(
    () => normalizeSelectedBlockType(data.standardType),
    [data.standardType]
  );

  const autoCalculatedBlockType = useMemo<CalculatedBlockType>(() => {
    const outerDiameter = Number(inspectionSetup.diameter);
    const innerDiameter = Number(inspectionSetup.innerDiameter);
    const hasOD = hasPositiveNumber(inspectionSetup.diameter);
    const hasID = hasPositiveNumber(inspectionSetup.innerDiameter);
    const hasExplicitWall = hasPositiveNumber(inspectionSetup.wallThickness);
    const hasDerivedWall = hasOD && hasID && outerDiameter > innerDiameter;

    if (["tube", "pipe", "hollow_cylinder", "ring", "sleeve", "ring_forging"].includes(mappedPartGeometry)) {
      const wall = hasExplicitWall
        ? Number(inspectionSetup.wallThickness)
        : hasDerivedWall
          ? (outerDiameter - innerDiameter) / 2
          : Number.NaN;
      return Number.isFinite(wall) && wall < 25 ? "cylinder_notched" : "cylinder_fbh";
    }

    if (["cylinder", "round_bar", "shaft", "solid_round"].includes(mappedPartGeometry)) {
      return hasOD && outerDiameter < 50 ? "curved_fbh" : "flat_fbh";
    }

    if (["sphere", "cone", "pyramid", "custom"].includes(mappedPartGeometry)) {
      return "custom";
    }

    return "flat_fbh";
  }, [
    inspectionSetup.diameter,
    inspectionSetup.innerDiameter,
    inspectionSetup.wallThickness,
    mappedPartGeometry,
  ]);

  // Keep previous behavior for tube/round families.
  // Use scan-aware override only for HPT disk workflows.
  const scanAwareBlockTypeOverride = useMemo<CalculatedBlockType | undefined>(() => {
    if (mappedPartGeometry !== "hpt_disk") {
      return undefined;
    }
    return selectedBlockOverride;
  }, [mappedPartGeometry, selectedBlockOverride]);

  // Straight-beam drawing override:
  // 1) explicit user selection if exists
  // 2) HPT scan-aware override
  // 3) automatic geometry-based block selection
  const straightBeamBlockOverride = useMemo<CalculatedBlockType>(
    () => selectedBlockOverride || scanAwareBlockTypeOverride || autoCalculatedBlockType,
    [selectedBlockOverride, scanAwareBlockTypeOverride, autoCalculatedBlockType]
  );

  const referenceBlockPreviewSpec = useMemo(() => {
    try {
      return calculateCalibrationBlockSpec(
        mappedPartGeometry,
        partDimensionsForDrawing,
        standard,
        acceptanceClass || "A",
        inspectionSetup.material || "steel",
        straightBeamBlockOverride,
      );
    } catch {
      return null;
    }
  }, [
    mappedPartGeometry,
    partDimensionsForDrawing,
    standard,
    acceptanceClass,
    inspectionSetup.material,
    straightBeamBlockOverride,
  ]);

  const referenceBlockTypeLabel = useMemo(() => {
    const labels: Record<CalculatedBlockType, string> = {
      flat_fbh: "Flat FBH",
      cylinder_notched: "Notched Cylinder",
      cylinder_fbh: "Cylinder FBH",
      curved_fbh: "Curved FBH",
      custom: "Custom Block",
    };
    return labels[straightBeamBlockOverride] || "Reference Block";
  }, [straightBeamBlockOverride]);

  const missingCalibrationModelInputs = useMemo(() => {
    const missing: string[] = [];

    const outerDiameter = Number(inspectionSetup.diameter);
    const innerDiameter = Number(inspectionSetup.innerDiameter);
    const hasOD = hasPositiveNumber(inspectionSetup.diameter);
    const hasID = hasPositiveNumber(inspectionSetup.innerDiameter);
    const hasExplicitWall = hasPositiveNumber(inspectionSetup.wallThickness);
    const hasDerivedWall = hasOD && hasID && outerDiameter > innerDiameter;
    const hasThickness = effectiveInspectionThickness > 0;

    if (!inspectionSetup.partType) missing.push("Part Type");
    if (!inspectionSetup.material) missing.push("Part Material");
    if (!acceptanceClass) missing.push("Acceptance Class");
    if (!hasThickness) missing.push("Inspection Thickness (or Wall Thickness)");

    const resolvedBlockType: CalculatedBlockType =
      scanAwareBlockTypeOverride || autoCalculatedBlockType;

    if (resolvedBlockType === "cylinder_notched") {
      if (!hasOD) missing.push("Outer Diameter (OD)");
      if (!(hasExplicitWall || hasDerivedWall)) missing.push("Wall Thickness (or OD + ID)");
    }

    if (resolvedBlockType === "cylinder_fbh" || resolvedBlockType === "curved_fbh") {
      if (!hasOD) missing.push("Outer Diameter (OD)");
    }

    if (mappedPartGeometry === "cone") {
      if (!hasPositiveNumber(inspectionSetup.coneTopDiameter)) missing.push("Cone Top Diameter");
      if (!hasPositiveNumber(inspectionSetup.coneBottomDiameter)) missing.push("Cone Bottom Diameter");
      if (!hasPositiveNumber(inspectionSetup.coneHeight)) missing.push("Cone Height");
    }

    if (
      mappedPartGeometry === "custom" &&
      !inspectionSetup.customShapeDescription?.trim() &&
      !inspectionSetup.customShapeImage
    ) {
      missing.push("Custom Shape Dimensions/Description");
    }

    if (
      (standard === "NDIP-1254" || standard === "NDIP-1257" || standard === "NDIP-1260") &&
      !inspectionSetup.partNumber?.trim()
    ) {
      missing.push("Part Number (OEM Traceability)");
    }

    return [...new Set(missing)];
  }, [
    acceptanceClass,
    effectiveInspectionThickness,
    inspectionSetup.coneBottomDiameter,
    inspectionSetup.coneHeight,
    inspectionSetup.coneTopDiameter,
    inspectionSetup.customShapeDescription,
    inspectionSetup.customShapeImage,
    inspectionSetup.diameter,
    inspectionSetup.innerDiameter,
    inspectionSetup.material,
    inspectionSetup.partNumber,
    inspectionSetup.partType,
    inspectionSetup.wallThickness,
    autoCalculatedBlockType,
    mappedPartGeometry,
    scanAwareBlockTypeOverride,
    standard,
  ]);

  const missingCalibrationModelSentence = useMemo(
    () => formatMissingInputsSentence(missingCalibrationModelInputs),
    [missingCalibrationModelInputs]
  );

  const updateField = (field: keyof CalibrationData, value: unknown) => {
    onChange({ ...data, [field]: value } as CalibrationData);
  };

  const selectedReferenceMaterial = useMemo(() => {
    if (!data.referenceMaterial) return "";
    return REFERENCE_MATERIAL_OPTIONS.includes(data.referenceMaterial as (typeof REFERENCE_MATERIAL_OPTIONS)[number])
      ? data.referenceMaterial
      : "__custom__";
  }, [data.referenceMaterial]);

  const blockDimensionsMode = useMemo<BlockDimensionsMode>(() => {
    if (data.blockDimensionsMode) return data.blockDimensionsMode;
    if ((data.blockDimensions || "").trim().toLowerCase().startsWith("curve")) {
      return "curve";
    }
    return "flat";
  }, [data.blockDimensionsMode, data.blockDimensions]);

  const handleReferenceMaterialChange = (value: string) => {
    if (value === "__custom__") {
      if (
        REFERENCE_MATERIAL_OPTIONS.includes(
          data.referenceMaterial as (typeof REFERENCE_MATERIAL_OPTIONS)[number]
        )
      ) {
        updateField("referenceMaterial", "");
      }
      return;
    }
    updateField("referenceMaterial", value);
  };

  const handleBlockDimensionsModeChange = (mode: BlockDimensionsMode) => {
    if (mode === "curve") {
      const inner = data.curveInnerDiameterMm ?? inspectionSetup.innerDiameter;
      const outer = data.curveOuterDiameterMm ?? inspectionSetup.diameter;
      const wall = data.curveWallThicknessMm ?? inspectionSetup.wallThickness;
      onChange({
        ...data,
        blockDimensionsMode: "curve",
        curveInnerDiameterMm: inner,
        curveOuterDiameterMm: outer,
        curveWallThicknessMm: wall,
        blockDimensions: buildCurveBlockDimensionsSummary(inner, outer, wall),
      });
      return;
    }

    const nextBlockDimensions =
      mode === "flat" && (data.blockDimensions || "").trim().toLowerCase().startsWith("curve")
        ? ""
        : data.blockDimensions;

    onChange({
      ...data,
      blockDimensionsMode: mode,
      blockDimensions: nextBlockDimensions,
    });
  };

  const handleCurveDimensionChange = (
    field: "curveInnerDiameterMm" | "curveOuterDiameterMm" | "curveWallThicknessMm",
    rawValue: string
  ) => {
    const parsed = rawValue === "" ? undefined : Number(rawValue);
    const nextValue = Number.isFinite(parsed) ? parsed : undefined;

    const nextData = {
      ...data,
      blockDimensionsMode: "curve" as BlockDimensionsMode,
      [field]: nextValue,
    } as CalibrationData;

    nextData.blockDimensions = buildCurveBlockDimensionsSummary(
      nextData.curveInnerDiameterMm,
      nextData.curveOuterDiameterMm,
      nextData.curveWallThicknessMm,
    );
    onChange(nextData);
  };

  const fbhOptionStandard = useMemo(() => getFBHDropdownStandard(standard), [standard]);

  // Handle FBH holes changes from table (manual user changes)
  const handleFbhHolesChange = (newHoles: FBHHoleRowData[]) => {
    setFbhHoles(newHoles);
    // Clear auto-fill state when user manually changes - indicates manual override
    if (fbhAutoFilled) {
      setFbhAutoFilled(false);
      setFbhAutoFillReason("");
    }
    // Update calibration data with FBH info - both legacy string AND structured array
    const fbhSizesStr = newHoles.map(h => h.diameterInch).join(', ');
    const avgMetalTravel = newHoles.length > 0
      ? newHoles.reduce((sum, h) => sum + h.metalTravelH, 0) / newHoles.length
      : 19.05;
    // Convert FBHHoleRowData[] to FBHHoleData[] for export
    const fbhHolesData = newHoles.map(h => ({
      id: h.id,
      partNumber: h.partNumber,
      deltaType: h.deltaType,
      diameterInch: h.diameterInch,
      diameterMm: h.diameterMm,
      blockHeightE: h.blockHeightE,
      metalTravelH: h.metalTravelH,
    }));
    onChange({
      ...data,
      fbhSizes: fbhSizesStr,
      fbhHoles: fbhHolesData,
      metalTravelDistance: avgMetalTravel,
    });
  };

  // Simple serial number generator
  const generateSerialNumber = () => {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const time = String(date.getHours()).padStart(2, '0') + String(date.getMinutes()).padStart(2, '0');
    return `CAL-${year}${month}${day}-${time}`;
  };

  // Initialize data on mount
  useEffect(() => {
    // Generate serial number if empty
    if (!data.blockSerialNumber) {
      updateField("blockSerialNumber", generateSerialNumber());
    }
    // Initialize fbhHoles if not present - ensures export has structured data
    if (!data.fbhHoles || data.fbhHoles.length === 0) {
      const initialFbhHoles = fbhHoles.map(h => ({
        id: h.id,
        partNumber: h.partNumber,
        deltaType: h.deltaType,
        diameterInch: h.diameterInch,
        diameterMm: h.diameterMm,
        blockHeightE: h.blockHeightE,
        metalTravelH: h.metalTravelH,
      }));
      const fbhSizesStr = fbhHoles.map(h => h.diameterInch).join(', ');
      const avgMetalTravel = fbhHoles.reduce((sum, h) => sum + h.metalTravelH, 0) / fbhHoles.length;
      onChange({
        ...data,
        fbhSizes: fbhSizesStr,
        fbhHoles: initialFbhHoles,
        metalTravelDistance: avgMetalTravel,
      });
    }
    // Mark initial mount as complete
    isInitialMount.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ==========================================================================
  // AUTO-FILL FBH TABLE FROM STANDARDS
  // Triggers when acceptanceClass, standard, or partThickness changes
  // ==========================================================================
  useEffect(() => {
    // Need acceptance class and thickness to auto-fill
    if (!acceptanceClass) return;

    const thickness = effectiveInspectionThickness;
    if (thickness <= 0) return;

    // Get recommended FBH size from standards
    const recommendedFBH = getFBHSizeForStandard(standard, thickness, acceptanceClass);
    if (!recommendedFBH) return;

    // Parse the FBH size string to get diameter
    const parsed = parseFBHSizeString(recommendedFBH);
    if (!parsed) return;

    // PW NDIP standards use fixed hole depths per IAE2P16675 calibration block
    const isV2500NDIP = standard === "NDIP-1226" || standard === "NDIP-1227";
    const isOtherPWNDIP = standard === "NDIP-1254" || standard === "NDIP-1257" || standard === "NDIP-1260";
    const pwHoleDepthsMm = [
      6.350,   // Hole L: 0.250"
      9.525,   // Hole M: 0.375"
      12.700,  // Hole N: 0.500"
      15.875,  // Hole P: 0.625"
      19.050,  // Hole Q: 0.750"
      22.225,  // Hole R: 0.875"
      25.400,  // Hole S: 1.000"
    ];
    const pwHoleLabels = ['L', 'M', 'N', 'P', 'Q', 'R', 'S'];

    // Calculate DAC depths based on standard
    const dacDepths = isV2500NDIP ? pwHoleDepthsMm : calculateDACDepths(thickness);

    // Resolve block height E from standard options + required cover over deepest reflector.
    // This makes the preview/table react to part size changes, not only hole depths.
    const optionStandard = getFBHDropdownStandard(standard);
    const blockHeightOptions = (
      optionStandard === "All"
        ? BLOCK_HEIGHT_E_OPTIONS
        : BLOCK_HEIGHT_E_OPTIONS.filter((opt) => opt.standard.includes(optionStandard))
    )
      .map((opt) => opt.heightMm)
      .sort((a, b) => a - b);

    const deepestDepth = Math.max(...dacDepths, 0);
    const minCover = Math.max(5, thickness * 0.1);
    const targetBlockHeight = Math.max(thickness, deepestDepth + minCover);
    const resolvedBlockHeight =
      blockHeightOptions.find((h) => h >= targetBlockHeight) ||
      blockHeightOptions[blockHeightOptions.length - 1] ||
      Number(targetBlockHeight.toFixed(2));

    // Check if values are already set to the same - avoid unnecessary updates
    const currentDiameter = fbhHoles[0]?.diameterInch;
    const currentDepths = fbhHoles.map(h => h.metalTravelH);
    const currentBlockHeights = fbhHoles.map(h => h.blockHeightE);
    const isSameDiameter = currentDiameter === parsed.inch;
    const isSameDepths = dacDepths.length === currentDepths.length && dacDepths.every((d, i) => currentDepths[i] === d);
    const isSameBlockHeight = currentBlockHeights.length === dacDepths.length &&
      currentBlockHeights.every((e) => Math.abs(e - resolvedBlockHeight) < 0.01);

    if (isSameDiameter && isSameDepths && isSameBlockHeight && fbhAutoFilled) {
      // Already auto-filled with same values, skip
      return;
    }

    // Build the auto-filled holes array
    const autoFilledHoles: FBHHoleRowData[] = dacDepths.map((depth, index) => ({
      id: index + 1,
      partNumber: isV2500NDIP ? "IAE2P16675" : "",
      deltaType: 'dac', // DAC for distance-amplitude correction
      diameterInch: parsed.inch,
      diameterMm: parsed.mm,
      blockHeightE: resolvedBlockHeight,
      metalTravelH: depth,
      isCustom: false,
    }));

    // Update state
    setFbhHoles(autoFilledHoles);
    setFbhAutoFilled(true);
    if (isV2500NDIP) {
      setFbhAutoFillReason(
        `PW IAE2P16675 calibration block - #1 FBH (1/64") at 80% FSH. ` +
        `7 holes (${pwHoleLabels.join(', ')}): ${pwHoleDepthsMm.map((d, i) => `${pwHoleLabels[i]}=${d}mm`).join(', ')}. ` +
        `Block height E=${resolvedBlockHeight}mm. ` +
        `Per ${standard === 'NDIP-1226' ? 'NDIP-1226 Rev F' : 'NDIP-1227 Rev D'} Section 5.1.1.7.1. ` +
        `+/-45 deg circumferential shear wave, 8" water path immersion.`
      );
    } else if (isOtherPWNDIP) {
      setFbhAutoFillReason(
        `#1 FBH (${parsed.inch}" / ${parsed.mm}mm) selected for ${standard}. ` +
        `Using thickness-based 3-point DAC depths: ${dacDepths.map((d) => `${d}mm`).join(', ')}. ` +
        `Block height E=${resolvedBlockHeight}mm. ` +
        `Exact OEM block geometry is proprietary and should be verified against the active NDIP release.`
      );
    } else {
      setFbhAutoFillReason(
        `FBH ${parsed.inch}" (${parsed.mm}mm) selected per ${standard} Class ${acceptanceClass} for ${thickness}mm thickness. ` +
        `DAC depths: ${dacDepths.map(d => `${d}mm`).join(', ')} (25%, 50%, 75% of thickness). ` +
        `Block height E=${resolvedBlockHeight}mm.`
      );
    }

    // Update parent data
    const fbhSizesStr = autoFilledHoles.map(h => h.diameterInch).join(', ');
    const avgMetalTravel = autoFilledHoles.reduce((sum, h) => sum + h.metalTravelH, 0) / autoFilledHoles.length;
    onChange({
      ...data,
      fbhSizes: fbhSizesStr,
      fbhHoles: autoFilledHoles.map(h => ({
        id: h.id,
        partNumber: h.partNumber,
        deltaType: h.deltaType,
        diameterInch: h.diameterInch,
        diameterMm: h.diameterMm,
        blockHeightE: h.blockHeightE,
        metalTravelH: h.metalTravelH,
      })),
      metalTravelDistance: avgMetalTravel,
    });

    // Show toast notification only if not initial mount
    if (!isInitialMount.current) {
      toast.success("FBH Table Auto-Filled", {
        description: `${parsed.inch}" FBH selected per ${standard} Class ${acceptanceClass}`,
      });
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    acceptanceClass,
    standard,
    effectiveInspectionThickness,
    mappedPartGeometry,
    inspectionSetup.diameter,
    inspectionSetup.innerDiameter,
    inspectionSetup.wallThickness,
    inspectionSetup.partLength,
    inspectionSetup.partWidth,
    inspectionSetup.partThickness,
  ]);

  const handleSelectModel = (modelId: string) => {
    setSelectedModelId(modelId as CalibrationBlockType);
    updateField("standardType", modelId);
  };

  // Render the Straight Beam content (FBH table with large previews)
  const renderStraightBeamContent = () => (
    <>
      {/* FBH Holes Table with Large Previews - 3 rows with dropdowns */}
      <div className="border rounded-lg p-4 bg-card">
        <div className="flex items-center justify-between mb-4">
          <h4 className="font-semibold">FBH Hole Specifications</h4>
        </div>
        <FBHHoleTableWithPreviews
          holes={fbhHoles}
          onChange={handleFbhHolesChange}
          maxHoles={5}
          minHoles={1}
          showPartNumber={true}
          showDeltaType={true}
          standard={fbhOptionStandard}
          previewWidth={420}
          previewHeight={520}
          partGeometry={mappedPartGeometry}
          outerDiameterMm={inspectionSetup.diameter}
          innerDiameterMm={inspectionSetup.innerDiameter}
          referenceThicknessMm={effectiveInspectionThickness}
          showSensitivityColumns={true}
          sensitivityRows={data.straightBeamConversionTable || []}
          onSensitivityChange={(rows) => updateField("straightBeamConversionTable", rows)}
        />
      </div>

      {/* Load Custom Image Option */}
      <div className="flex items-center gap-2 mt-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => document.getElementById('straight-beam-custom-image')?.click()}
          className="text-xs"
        >
          <Upload className="h-3 w-3 mr-1" />
          Load Image
        </Button>
        <input
          id="straight-beam-custom-image"
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) {
              const reader = new FileReader();
              reader.onload = (event) => {
                updateField("customStraightBeamImage", event.target?.result as string);
              };
              reader.readAsDataURL(file);
            }
          }}
        />
        {data.customStraightBeamImage && (
          <>
            <span className="text-xs text-muted-foreground">Custom image loaded</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => updateField("customStraightBeamImage", "")}
              className="text-xs text-destructive"
            >
              Reset
            </Button>
          </>
        )}
      </div>

      {/* Custom uploaded image (shown when available) */}
      {data.customStraightBeamImage && (
        <div className="border rounded-lg overflow-hidden">
          <img src={data.customStraightBeamImage} alt="Custom calibration block" className="w-full h-auto max-h-[600px] object-contain bg-white" />
        </div>
      )}

      {/* Compact reference block preview driven by Setup dimensions. */}
      <div className="rounded-xl border border-border bg-muted/25">
        <div className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
          <div className="space-y-2">
            <div>
              <h4 className="text-sm font-semibold text-foreground">Reference Block Preview</h4>
              <p className="text-xs text-muted-foreground">
                Calculated from the current Setup dimensions and selected standard.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">{referenceBlockTypeLabel}</Badge>
              {referenceBlockPreviewSpec?.figureReference && (
                <Badge variant="outline">{referenceBlockPreviewSpec.figureReference}</Badge>
              )}
              <Badge variant="outline">{getStandardLabel(standard)}</Badge>
            </div>
            <div className="text-xs text-muted-foreground">
              Syncs from Setup: OD, ID, length, width, thickness
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            onClick={() => setShowReferenceBlockPreview((prev) => !prev)}
            className="self-start md:self-center"
          >
            {showReferenceBlockPreview ? (
              <>
                <ChevronUp className="mr-2 h-4 w-4" />
                Hide Preview
              </>
            ) : (
              <>
                <ChevronDown className="mr-2 h-4 w-4" />
                Show Preview
              </>
            )}
          </Button>
        </div>

        {showReferenceBlockPreview && (
          <div className="border-t border-border p-4 pt-3">
            <DynamicCalibrationBlockDrawing
              partGeometry={mappedPartGeometry}
              partDimensions={partDimensionsForDrawing}
              standard={standard}
              acceptanceClass={acceptanceClass || 'A'}
              partMaterial={inspectionSetup.material || 'steel'}
              forcedBlockType={straightBeamBlockOverride}
              width={950}
              height={640}
              showDimensions={true}
              showSpecsTable={false}
              title={`Reference Block Preview - ${getStandardLabel(standard)}`}
            />
          </div>
        )}
      </div>
    </>
  );

  // Check if P&W (Pratt & Whitney) standard is selected or hpt_disk geometry is used
  const isPWStandard = useMemo(() => {
    const pwStandards = ['NDIP-1226', 'NDIP-1227', 'NDIP-1254', 'NDIP-1257', 'NDIP-1260', 'PWA-SIM'];
    return pwStandards.includes(standard);
  }, [standard]);
  const isHptDiskGeometry = mappedPartGeometry === 'hpt_disk' || inspectionSetup.partType === 'hpt_disk';
  const hasKnownV2500Context = hasKnownActiveMroContext(standard, inspectionSetup.partNumber);
  const shouldUsePwCalibrationReference = isPWStandard;

  const showStraightBeam = beamRequirement === "both" || beamRequirement === "straight_only";
  const showAngleBeam = beamRequirement === "both" || beamRequirement === "angle_only" || shouldUsePwCalibrationReference;
  const showBeamTabs = showStraightBeam && showAngleBeam;
  const showTubeAngleBeamReference = isTubeAngleBeamPartType(inspectionSetup.partType);

  // For PW procedures, the angle-beam block is the most relevant "reference standard".
  // Auto-switch to the Angle tab the first time we enter a PW standard.
  const prevIsPWStandardRef = useRef<boolean | null>(null);
  useEffect(() => {
    if (shouldUsePwCalibrationReference && prevIsPWStandardRef.current !== true) {
      setActiveBeamTab("angle");
    }
    prevIsPWStandardRef.current = shouldUsePwCalibrationReference;
  }, [shouldUsePwCalibrationReference]);

  useEffect(() => {
    if (showTubeAngleBeamReference && activeBeamTab !== "angle") {
      setActiveBeamTab("angle");
    }
  }, [activeBeamTab, showTubeAngleBeamReference]);

  // Check specific P&W standard types
  const isPWASIM = standard === 'PWA-SIM';
  const isV2500Standard = isActiveMroStandard(standard);
  const isGTFStandard = standard === 'NDIP-1254' || standard === 'NDIP-1257' || standard === 'NDIP-1260';

  const v2500Stage: 1 | 2 | null = useMemo(
    () => getActiveMroStage(standard, inspectionSetup.partNumber),
    [standard, inspectionSetup.partNumber],
  );

  const pwCalibrationBlockImage = useMemo(() => {
    if (v2500Stage === 1) return "/standards/ndip-1226-calibration-block.png";
    if (v2500Stage === 2) return "/standards/ndip-1227-calibration-block.png";
    return null;
  }, [v2500Stage]);

  // Local PDF copies (public/standards) for quick access to the OEM procedures.
  // Note: Only NDIP-1226/1227 PDFs are currently bundled.
  const pwProcedurePdf = useMemo(() => {
    if (standard === 'NDIP-1226') return '/standards/NDIP_1226_RevF.pdf';
    if (standard === 'NDIP-1227') return '/standards/NDIP_1227_RevD.pdf';
    return null;
  }, [standard]);

  const openPwPdf = (hash: string = '') => {
    if (!pwProcedurePdf) return;
    window.open(`${pwProcedurePdf}${hash}`, '_blank', 'noreferrer');
  };

  const pwFigurePages = useMemo(() => {
    if (standard === "NDIP-1226" || standard === "NDIP-1227") {
      // Verified from bundled NDIP Rev F / Rev D documents:
      // Figure 1 = page 8, Figure 2 = page 11
      return {
        figure1: "#page=8",
        figure2: "#page=11",
      };
    }
    return {
      figure1: "#page=11",
      figure2: "#page=14",
    };
  }, [standard]);

  // Render the Angle Beam content (calibration block drawing)
  // Note: partDimensions is memoized at component level to prevent infinite re-renders
  const renderAngleBeamContent = () => {
    if (showTubeAngleBeamReference) {
      return (
        <div className="space-y-4">
          <TubeAngleBeamReferenceDrawing
            partType={inspectionSetup.partType}
            outerDiameter={inspectionSetup.diameter}
            innerDiameter={inspectionSetup.innerDiameter}
            wallThickness={inspectionSetup.wallThickness}
          />

          <div className="border-2 border-orange-200 rounded-xl p-4 bg-orange-50/30 mt-4">
            <h4 className="font-bold text-orange-800 text-base mb-3 flex items-center gap-2">
              <Target className="h-4 w-4" />
              Angle Beam Calibration Table
            </h4>
            <p className="text-sm text-muted-foreground mb-3">
              Define reflector types, sizes and dB corrections for angle beam calibration.
              Size dB and Sound Path are auto-calculated; Transfer dB is entered manually.
            </p>
            <AngleBeamCalibrationTable
              rows={angleBeamCalibrationRows}
              onChange={handleAngleBeamCalibrationRowsChange}
              beamAngleDegrees={45}
            />
          </div>
        </div>
      );
    }

    // PWA-SIM - Show dedicated multi-reflector calibration block drawing
    if (isPWASIM) {
      return (
        <div className="space-y-4">
          {/* PWA-SIM specific notice */}
          <div className="bg-gradient-to-r from-amber-600 to-orange-600 text-white rounded-xl p-4">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-2xl font-bold">PWA-SIM</span>
              <div>
                <h4 className="font-bold text-lg">Sonic Inspection Method</h4>
                <p className="text-sm opacity-90">Bar, Billet, Rod, and Forging Stock Inspection - Per PWA 127 / SIS 26B</p>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-3 text-xs">
              <div className="bg-white/20 rounded px-2 py-1">
                <span className="opacity-70">Block:</span> Per PWA 127
              </div>
              <div className="bg-white/20 rounded px-2 py-1">
                <span className="opacity-70">FBH:</span> Multi (3/64&quot; + 1/32&quot;)
              </div>
              <div className="bg-white/20 rounded px-2 py-1">
                <span className="opacity-70">Notch:</span> EDM 3% x 1/4&quot;
              </div>
              <div className="bg-white/20 rounded px-2 py-1 bg-red-500/30">
                <span className="font-bold">SAME MATERIAL!</span>
              </div>
            </div>
          </div>

          {/* PWA-SIM Calibration Block Drawing */}
          <PWASIMCalibrationBlockDrawing
            width={950}
            height={700}
            showDimensions={true}
            showTitleBlock={true}
            partThickness={effectiveInspectionThickness || 50}
            partMaterial={inspectionSetup.material || 'Same as Test Part'}
            title="PWA-SIM Multi-Reflector Calibration Block"
          />

          {/* PWA-SIM specific requirements */}
          <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4">
            <h4 className="font-bold text-red-800 mb-2 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              PWA-SIM CRITICAL Requirements
            </h4>
            <ul className="text-sm text-red-700 space-y-1 list-disc list-inside">
              <li><strong>MATERIAL:</strong> Block MUST be made from SAME MATERIAL as test part (acoustic equivalent NOT acceptable)</li>
              <li>Multi-reflector configuration: 3/64&quot; FBH at 50% &amp; 10% depth, 1/32&quot; FBH at 10% depth</li>
              <li>EDM Notch: 3% depth x 1/4&quot; length (axial defect simulation)</li>
              <li>Calibrate before AND after each inspection batch</li>
              <li>3-point DAC curve required</li>
              <li>Contact PW Supplier Portal (eSRI) for detailed specifications</li>
            </ul>
          </div>
        </div>
      );
    }

    // P&W procedures only: show OEM calibration reference flow.
    if (shouldUsePwCalibrationReference) {
      return (
        <div className="space-y-4">
          {/* P&W specific notice */}
          <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl p-4">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-2xl font-bold">P&W</span>
              <div>
                <h4 className="font-bold text-lg">Pratt & Whitney Calibration Standard</h4>
                <p className="text-sm opacity-90">
                  {standard === 'NDIP-1226' && 'V2500 1st Stage HPT Disk - NDIP-1226 Rev F'}
                  {standard === 'NDIP-1227' && 'V2500 2nd Stage HPT Disk - NDIP-1227 Rev D'}
                  {standard === 'NDIP-1254' && 'PW1100G GTF HPT 1st Stage Hub - NDIP-1254 (AUSI)'}
                  {standard === 'NDIP-1257' && 'PW1100G GTF HPT 2nd Stage Hub - NDIP-1257 (AUSI)'}
                  {standard === 'NDIP-1260' && 'PW1100G GTF HPC 8th Stage IBR-8 - NDIP-1260 (AUSI)'}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-3 text-xs">
              <div className="bg-white/20 rounded px-2 py-1">
                <span className="opacity-70">Block:</span> {isGTFStandard ? 'PW Proprietary' : 'IAE2P16675'}
              </div>
              <div className="bg-white/20 rounded px-2 py-1">
                <span className="opacity-70">FBH:</span> #1 (1/64&quot;)
              </div>
              <div className="bg-white/20 rounded px-2 py-1">
                <span className="opacity-70">Transducer:</span> IAE2P16679
              </div>
              <div className="bg-white/20 rounded px-2 py-1">
                <span className="opacity-70">Mirror:</span> IAE2P16678 (45 deg)
              </div>
            </div>

            {/* Quick links to the OEM PDF procedure (includes figures and Appendix A forms) */}
            {pwProcedurePdf && (
              <div className="flex flex-wrap gap-2 mt-3">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="bg-white/15 text-white border border-white/20 hover:bg-white/25"
                  onClick={() => openPwPdf()}
                >
                  Open NDIP Procedure (PDF)
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="bg-white/15 text-white border border-white/20 hover:bg-white/25"
                  onClick={() => openPwPdf(pwFigurePages.figure1)}
                  title="Figure 1 - Calibration Standard"
                >
                  Figure 1
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="bg-white/15 text-white border border-white/20 hover:bg-white/25"
                  onClick={() => openPwPdf('#page=17')}
                  title="Figure 3 - Pixel Grouping Examples"
                >
                  Figure 3
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="bg-white/15 text-white border border-white/20 hover:bg-white/25"
                  onClick={() => openPwPdf('#page=22')}
                  title="Appendix A - Rejectable Indication Report"
                >
                  Appendix A
                </Button>
              </div>
            )}
            {isGTFStandard && (
              <div className="mt-3 p-2 bg-yellow-400/30 rounded-lg">
                <p className="text-sm font-semibold flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  AUSI (Automated Ultrasonic Shear Inspection) - FAA AD Required
                </p>
                <p className="text-xs opacity-90">Powder metal contamination screening - Automated inspection only</p>
              </div>
            )}
          </div>

          {/* V2500 standards use the original bundled Figure 1 image from the NDIP procedure. */}
          {isV2500Standard && pwCalibrationBlockImage && !isGTFStandard && (
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <img
                src={pwCalibrationBlockImage}
                alt={standard === "NDIP-1226" ? "NDIP-1226 Figure 1 calibration block" : "NDIP-1227 Figure 1 calibration block"}
                className="w-full h-auto max-h-[900px] object-contain bg-white"
              />
            </div>
          )}

          {/* GTF NDIPs are proprietary; avoid showing V2500 geometry as exact. */}
          {isGTFStandard && (
            <div className="space-y-3">
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-yellow-800">
                Proprietary NDIP geometry: no public Figure-1-equivalent drawing is bundled for this standard.
                A calculated placeholder block is shown below and must be verified against active OEM data.
              </div>
              <DynamicCalibrationBlockDrawing
                partGeometry={mappedPartGeometry}
                partDimensions={partDimensionsForDrawing}
                standard={standard}
                acceptanceClass={acceptanceClass || "A"}
                partMaterial={inspectionSetup.material || "steel"}
                forcedBlockType={scanAwareBlockTypeOverride}
                width={950}
                height={700}
                showDimensions={true}
                showSpecsTable={true}
                title={`${standard} - Calculated Calibration Block (Placeholder)`}
              />
            </div>
          )}

          {/* P&W specific requirements */}
          <div className="bg-amber-50 border-2 border-amber-200 rounded-xl p-4">
            <h4 className="font-bold text-amber-800 mb-2 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              P&W Mandatory Requirements
            </h4>
            <ul className="text-sm text-amber-700 space-y-1 list-disc list-inside">
              <li>Calibration amplitude: 80% FSH on #1 FBH reference</li>
              <li>Water path: 8.0&quot; per NDIP specification</li>
              <li>Circumferential shear wave: +/-45 deg inspection angles</li>
              <li>Block recertification: Yearly at PW NDE</li>
              {isV2500Standard && <li>Active holes: L through S (J &amp; K omitted per Section 5.1.1.7.1)</li>}
              {isGTFStandard && <li>AUSI: Automated inspection ONLY (manual not permitted)</li>}
              {isGTFStandard && <li>FAA Airworthiness Directive compliance required</li>}
              <li>Post-calibration tolerance: +/-1 dB of initial</li>
            </ul>
          </div>
        </div>
      );
    }

    if (isHptDiskGeometry && !hasKnownV2500Context) {
      return (
        <div className="space-y-4">
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            Exact V2500 / NDIP calibration references are hidden because the current setup does not confirm
            `NDIP-1226`, `NDIP-1227`, or a recognized V2500 part number (`2A5001` / `2A4802`).
          </div>
          <DynamicCalibrationBlockDrawing
            partGeometry={mappedPartGeometry}
            partDimensions={partDimensionsForDrawing}
            standard={standard}
            acceptanceClass={acceptanceClass || "A"}
            partMaterial={inspectionSetup.material || "steel"}
            forcedBlockType={scanAwareBlockTypeOverride}
            width={950}
            height={700}
            showDimensions={true}
            showSpecsTable={true}
            title={`${standard} - Calculated Calibration Block`}
          />
        </div>
      );
    }

    // Non-P&W Standard - Show geometry-aware angle beam content
    return (
      <div className="space-y-4">
        <div
          data-testid="angle-beam-export-capture"
          className="angle-beam-image-capture"
        >
          {shouldUseRingSegmentAngleBeam ? (
            <RingSegmentBlockDrawing
              initialTemplateId={preferredRingSegmentTemplateId}
              preferredStandardFamily={preferredRingSegmentStandardFamily}
              partDimensions={angleBeamPartDimensions}
              width={950}
              height={820}
              showControls={false}
              showTable={false}
              showWarnings={true}
              showExport={false}
              title={`Angle Beam Calibration Block - ${standard} (Calculated for your part)`}
            />
          ) : (
            <DynamicCalibrationBlockDrawing
              partGeometry={mappedPartGeometry}
              partDimensions={partDimensionsForDrawing}
              standard={standard}
              acceptanceClass={acceptanceClass || 'A'}
              partMaterial={inspectionSetup.material || 'steel'}
              forcedBlockType={straightBeamBlockOverride}
              width={950}
              height={750}
              showDimensions={true}
              showSpecsTable={true}
              title={`Calibration Block - ${standard} (Calculated for your part)`}
            />
          )}
        </div>

        {/* Angle Beam Calibration Table - dB corrections per reflector */}
        <div className="border-2 border-orange-200 rounded-xl p-4 bg-orange-50/30 mt-4">
          <h4 className="font-bold text-orange-800 text-base mb-3 flex items-center gap-2">
            <Target className="h-4 w-4" />
            Angle Beam Calibration Table
          </h4>
          <p className="text-sm text-muted-foreground mb-3">
            Define reflector types, sizes and dB corrections for angle beam calibration.
            Size dB and Sound Path are auto-calculated; Transfer dB is entered manually.
          </p>
          <AngleBeamCalibrationTable
            rows={angleBeamCalibrationRows}
            onChange={handleAngleBeamCalibrationRowsChange}
            beamAngleDegrees={45}
          />
        </div>
      </div>
    );
  };

  // Helper function to map PartGeometry to CalcPartGeometry
  function mapPartGeometry(partType: string): CalcPartGeometry {
    const mapping: Record<string, CalcPartGeometry> = {
      // Flat / plate geometries
      'box': 'plate',
      'plate': 'plate',
      'sheet': 'sheet',
      'slab': 'plate',
      'flat_bar': 'bar',
      'rectangular_bar': 'bar',
      'square_bar': 'bar',
      'bar': 'bar',
      'block': 'block',
      'billet': 'billet',

      // Solid rounds
      'cylinder': 'cylinder',
      'round_bar': 'round_bar',
      'shaft': 'shaft',
      'hub': 'hub',

      // Disks (solid rounds, face inspection)
      'disk': 'disk',
      'disk_forging': 'disk',
      'hpt_disk': 'hpt_disk',
      'impeller': 'impeller',
      'blisk': 'blisk',

      // Tubular geometries
      'tube': 'tube',
      'pipe': 'pipe',
      'ring': 'ring',
      'sleeve': 'sleeve',
      'bushing': 'sleeve',
      'rectangular_tube': 'bar',
      'square_tube': 'bar',

      // Hex shapes
      'hexagon': 'hex_bar',
      'hex_bar': 'hex_bar',

      // Forgings
      'forging': 'forging',
      'ring_forging': 'ring_forging',
      'round_forging_stock': 'cylinder',
      'rectangular_forging_stock': 'forging',
      'near_net_forging': 'near_net_forging',

      // Complex / special shapes
      'sphere': 'sphere',
      'cone': 'cone',
      'pyramid': 'pyramid',
      'machined_component': 'custom',

      // Structural profiles
      'l_profile': 'forging',
      't_profile': 'forging',
      'i_profile': 'forging',
      'u_profile': 'forging',
      'z_profile': 'forging',
      'z_section': 'forging',
      'custom_profile': 'custom',
      'irregular': 'custom',

      // Extrusions (inspected as flat surfaces)
      'extrusion_l': 'plate',
      'extrusion_t': 'plate',
      'extrusion_i': 'plate',
      'extrusion_u': 'plate',
      'extrusion_channel': 'plate',
      'extrusion_angle': 'plate',

      // Additional types
      'solid_round': 'cylinder',
      'hollow_cylinder': 'tube',
      'ellipse': 'custom',
    };
    return mapping[partType] || 'plate';
  }

  return (
    <div className="space-y-4 p-3 md:p-4">
      {/* Calibration Model Section - Dynamic based on geometry */}
      <div className="workstation-card space-y-4 border-0 p-5">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Target className="h-5 w-5" />
          Calibration Block
          {requiresBothBeams && (
            <Badge variant="secondary" className="ml-2">
              Requires Both Beam Types
            </Badge>
          )}
          {data.autoRecommendedReason && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge variant="outline" className="ml-2 bg-green-50 text-green-700 border-green-300 cursor-help">
                    <Sparkles className="h-3 w-3 mr-1" />
                    Auto-Selected (Scan-Aware)
                  </Badge>
                </TooltipTrigger>
                <TooltipContent className="max-w-md">
                  <div className="space-y-2">
                    <p className="text-sm font-semibold">Auto-Selected Based On:</p>
                    <ul className="text-xs space-y-1 list-disc list-inside">
                      <li>Part Geometry & Dimensions</li>
                      <li>Critical Scan Types (Circumferential/Angle Beam)</li>
                      <li>Standard Requirements</li>
                    </ul>
                    <p className="text-sm border-t pt-2">{data.autoRecommendedReason}</p>
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </h3>

        {missingCalibrationModelInputs.length > 0 && (
          <div className="bg-amber-50 border border-amber-300 rounded-lg p-3">
            <p className="text-sm font-semibold text-amber-900 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Missing data for exact calibration model selection
            </p>
            <p className="text-sm text-amber-800 mt-1">
              Please provide: {missingCalibrationModelSentence}.
            </p>
            <ul className="text-xs text-amber-700 list-disc list-inside mt-2 space-y-0.5">
              {missingCalibrationModelInputs.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Show tabs when both beam types are required */}
        {showBeamTabs ? (
          <Tabs
            value={activeBeamTab}
            onValueChange={(v) => setActiveBeamTab(v as "straight" | "angle")}
            className="w-full"
          >
            <TabsList className="grid w-full grid-cols-2 mb-4 rounded-2xl border border-border/70 bg-black/10 p-1.5">
              <TabsTrigger value="straight" className="rounded-xl data-[state=active]:bg-primary/15 data-[state=active]:text-foreground">
                {BEAM_TYPE_LABELS.straight.short}
              </TabsTrigger>
              <TabsTrigger value="angle" className="rounded-xl data-[state=active]:bg-accent/20 data-[state=active]:text-foreground">
                {BEAM_TYPE_LABELS.angle.short}
              </TabsTrigger>
            </TabsList>
            <TabsContent value="straight" className="space-y-4">
              <div className="text-sm text-muted-foreground mb-2">
                {BEAM_TYPE_LABELS.straight.description}
              </div>
              {renderStraightBeamContent()}
            </TabsContent>
            <TabsContent value="angle" className="space-y-4">
              <div className="text-sm text-muted-foreground mb-2">
                {BEAM_TYPE_LABELS.angle.description}
              </div>
              {renderAngleBeamContent()}
            </TabsContent>
          </Tabs>
        ) : (
          // Single-beam requirement - show without tabs
          <div className="space-y-4">
            {showAngleBeam ? renderAngleBeamContent() : renderStraightBeamContent()}
          </div>
        )}
      </div>

      {/* Block Settings */}
      <div className="workstation-card grid grid-cols-1 gap-6 border-0 p-5 md:grid-cols-2">
        <FieldWithHelp
          label="Reference Standard Material"
          fieldKey="referenceBlockMaterial"
          required
        >
          <div className="space-y-2">
            <Select
              value={selectedReferenceMaterial}
              onValueChange={handleReferenceMaterialChange}
            >
              <SelectTrigger className="bg-background">
                <SelectValue placeholder="" />
              </SelectTrigger>
              <SelectContent>
                {REFERENCE_MATERIAL_OPTIONS.map((material) => (
                  <SelectItem key={material} value={material}>
                    {material}
                  </SelectItem>
                ))}
                <SelectItem value="__custom__">Custom</SelectItem>
              </SelectContent>
            </Select>

            {selectedReferenceMaterial === "__custom__" && (
              <Input
                value={data.referenceMaterial}
                onChange={(e) => updateField("referenceMaterial", e.target.value)}
                className="bg-background"
              />
            )}
          </div>
        </FieldWithHelp>

        <FieldWithHelp
          label="Block Dimensions Type"
          fieldKey="calibrationBlock"
        >
          <Select
            value={blockDimensionsMode}
            onValueChange={(value) => handleBlockDimensionsModeChange(value as BlockDimensionsMode)}
          >
            <SelectTrigger className="bg-background">
              <SelectValue placeholder="" />
            </SelectTrigger>
            <SelectContent>
              {BLOCK_DIMENSIONS_MODE_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="text-xs text-muted-foreground mt-1">
            Use curve mode for ID/OD/thickness based blocks.
          </div>
        </FieldWithHelp>

        {blockDimensionsMode === "curve" ? (
          <>
            <FieldWithHelp
              label="Curve Block ID (mm)"
              fieldKey="calibrationBlock"
            >
              <Input
                type="number"
                value={data.curveInnerDiameterMm ?? ""}
                onChange={(e) => handleCurveDimensionChange("curveInnerDiameterMm", e.target.value)}
                min={0}
                step={0.1}
                className="bg-background"
              />
            </FieldWithHelp>

            <FieldWithHelp
              label="Curve Block OD (mm)"
              fieldKey="calibrationBlock"
            >
              <Input
                type="number"
                value={data.curveOuterDiameterMm ?? ""}
                onChange={(e) => handleCurveDimensionChange("curveOuterDiameterMm", e.target.value)}
                min={0}
                step={0.1}
                className="bg-background"
              />
            </FieldWithHelp>

            <FieldWithHelp
              label="Curve Wall Thickness (mm)"
              fieldKey="calibrationBlock"
            >
              <Input
                type="number"
                value={data.curveWallThicknessMm ?? ""}
                onChange={(e) => handleCurveDimensionChange("curveWallThicknessMm", e.target.value)}
                min={0}
                step={0.1}
                className="bg-background"
              />
            </FieldWithHelp>

            <FieldWithHelp
              label="Block Dimensions Summary"
              fieldKey="calibrationBlock"
            >
              <Input
                value={data.blockDimensions}
                readOnly
                className="bg-muted"
              />
            </FieldWithHelp>
          </>
        ) : (
          <FieldWithHelp
            label={blockDimensionsMode === "custom" ? "Block Dimensions (Custom)" : "Block Dimensions (L x W x H mm)"}
            fieldKey="calibrationBlock"
          >
            <Input
              value={data.blockDimensions}
              onChange={(e) => updateField("blockDimensions", e.target.value)}
              className="bg-background"
            />
            <div className="text-xs text-muted-foreground mt-1">
              Updates 3D model view
            </div>
          </FieldWithHelp>
        )}

        <FieldWithHelp
          label="Block Serial Number"
          fieldKey="calibrationBlock"
        >
          <div className="flex gap-2">
            <Input
              value={data.blockSerialNumber}
              onChange={(e) => updateField("blockSerialNumber", e.target.value)}
              className="bg-background flex-1"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => updateField("blockSerialNumber", generateSerialNumber())}
              title="Generate new serial number"
            >
              Generate
            </Button>
          </div>
        </FieldWithHelp>

        <FieldWithHelp
          label="Block Last Calibrated"
          fieldKey="calibrationBlock"
        >
          <Input
            type="date"
            value={data.lastCalibrationDate}
            onChange={(e) => updateField("lastCalibrationDate", e.target.value)}
            className="bg-background"
          />
        </FieldWithHelp>
      </div>

      {/* Calibration Sensitivity Table */}
      <div className="border rounded-lg p-4 bg-card">
        <div className="flex items-center justify-between mb-4">
          <h4 className="font-semibold">Calibration Sensitivity Table</h4>
          <Button
            variant="outline"
            size="sm"
            onClick={addSensitivityRow}
            disabled={sensitivityRows.length >= 8}
          >
            <Plus className="h-3 w-3 mr-1" /> Add Row
          </Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left p-2 font-medium">Reflector Type</th>
                <th className="text-left p-2 font-medium">Size (inch)</th>
                <th className="text-left p-2 font-medium">Curvature Corr. (dB)</th>
                <th className="text-left p-2 font-medium">Gain Offset (dB)</th>
                <th className="text-left p-2 font-medium">{"\u0394"}dB Total</th>
                <th className="p-2 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {sensitivityRows.map((row, index) => (
                <tr key={row.id} className="border-b last:border-0">
                  <td className="p-2">
                    <Select value={row.reflectorType} onValueChange={(v) => updateSensitivityRow(index, 'reflectorType', v)}>
                      <SelectTrigger className="bg-background w-24"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="FBH">FBH</SelectItem>
                        <SelectItem value="SDH">SDH</SelectItem>
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="p-2">
                    <Select value={row.reflectorSizeInch} onValueChange={(v) => updateSensitivityRow(index, 'reflectorSizeInch', v)}>
                      <SelectTrigger className="bg-background w-24"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {["1/64", "2/64", "3/64", "4/64", "5/64", "6/64", "8/64"].map(s => (
                          <SelectItem key={s} value={s}>{s}&quot;</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="p-2">
                    <Input
                      type="number"
                      step="0.1"
                      value={row.curvatureCorrection}
                      onChange={(e) => updateSensitivityRow(index, 'curvatureCorrection', parseFloat(e.target.value) || 0)}
                      className="bg-background w-24"
                    />
                  </td>
                  <td className="p-2">
                    <Input
                      type="number"
                      step="0.1"
                      value={row.gainOffset}
                      onChange={(e) => updateSensitivityRow(index, 'gainOffset', parseFloat(e.target.value) || 0)}
                      className="bg-background w-24"
                    />
                  </td>
                  <td className="p-2">
                    <div className="font-mono font-semibold text-center bg-muted/50 rounded px-2 py-1.5">
                      {row.deltaDbTotal >= 0 ? '+' : ''}{row.deltaDbTotal.toFixed(1)}
                    </div>
                  </td>
                  <td className="p-2">
                    {sensitivityRows.length > 1 && (
                      <Button variant="ghost" size="sm" onClick={() => removeSensitivityRow(index)}>
                        <X className="h-3 w-3 text-destructive" />
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

