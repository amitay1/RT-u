import React, { useEffect, useState, useCallback, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Info, ChevronDown, ChevronRight, Upload, ImageIcon, X } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import type { PartGeometry, StandardType } from "@/types/techniqueSheet";
import type { ScanDetail, ScanDetailsData, GateSettings } from "@/types/scanDetails";
import { TubeScanDiagram } from "@/components/TubeScanDiagram";
import { ConeScanDiagram } from "@/components/ConeScanDiagram";
import { BoxScanDiagram } from "@/components/BoxScanDiagram";
import { CylinderScanDiagram } from "@/components/CylinderScanDiagram";
import { RingScanDiagram } from "@/components/RingScanDiagram";
import { HexBarScanDiagram } from "@/components/HexBarScanDiagram";
import { ImpellerScanDiagram } from "@/components/ImpellerScanDiagram";
import { BliskScanDiagram } from "@/components/BliskScanDiagram";
import { getFrequencyOptionsForStandard } from "@/utils/frequencyUtils";
import { calculateNearField } from "@/utils/coverageCalculator";
import { equipmentParametersByStandard } from "@/data/standardsDifferences";
import { CustomDrawingUpload, ArrowOverlay, GeometrySelector } from "@/components/scan-overlay";
import { useOllamaVision } from "@/components/scan-overlay/hooks/useOllamaVision";
import { generateArrowsForGeometry, syncArrowsWithScanDetails } from "@/utils/scanArrowPlacement";
import { getV2500ScanDetailDefaults } from "@/utils/pwScanDetailDefaults";
import { getV2500GateSettingsForDirection, isV2500NdipStandard } from "@/utils/pwNdipDefaults";
import { getActiveMroStage, hasKnownActiveMroContext, isActiveMroStandard } from "@/utils/mroPolicy";
import { getActiveScanDetails, getActiveScanDirections } from "@/utils/scanDetailsSelection";
import { includeCurrentOption } from "@/utils/selectOptions";
import type { ScanArrow } from "@/types/scanOverlay";

interface ExtendedScanDetail extends ScanDetail {
  scanningFile?: string;
  pulsarParams?: string;
  utParameter?: string;
  utRange?: number;
  utDelay?: number;
  prf?: number;
  indexMode?: string;
  db?: number;
  filter?: string;
  reject?: string;
  tcgMode?: boolean;
  activeElementDiameter?: number;
  bandwidth?: string;
  focusSize?: string;
  velocity?: number;
  nearField?: number;
}

const isTubeType = (partType?: PartGeometry | ""): boolean => {
  return !!partType && ["tube", "pipe", "sleeve", "bushing", "rectangular_tube", "square_tube"].includes(partType);
};

const isConeType = (partType?: PartGeometry | ""): boolean => {
  return !!partType && ["cone", "truncated_cone", "conical", "pyramid"].includes(partType);
};

const isBoxType = (partType?: PartGeometry | ""): boolean => {
  return !!partType && ["box", "plate", "sheet", "slab", "flat_bar", "rectangular_bar", "square_bar", "billet", "block", "bar"].includes(partType);
};

const isCylinderType = (partType?: PartGeometry | ""): boolean => {
  return !!partType && ["cylinder", "round_bar", "shaft", "forging", "round_forging_stock", "rectangular_forging_stock", "near_net_forging", "machined_component"].includes(partType);
};

const isDiskType = (partType?: PartGeometry | ""): boolean => {
  return !!partType && ["disk", "disk_forging", "hub", "hpt_disk"].includes(partType);
};

const isImpellerType = (partType?: PartGeometry | ""): boolean => {
  return !!partType && partType === "impeller";
};

const isBliskType = (partType?: PartGeometry | ""): boolean => {
  return !!partType && partType === "blisk";
};

const isRingType = (partType?: PartGeometry | ""): boolean => {
  return !!partType && ["ring", "ring_forging"].includes(partType);
};

const isHexType = (partType?: PartGeometry | ""): boolean => {
  return !!partType && ["hexagon", "hex_bar"].includes(partType);
};

const isProfileType = (partType?: PartGeometry | ""): boolean => {
  return !!partType && [
    "l_profile", "t_profile", "i_profile", "u_profile", "z_profile", "z_section", "custom_profile",
    "extrusion_l", "extrusion_t", "extrusion_i", "extrusion_u", "extrusion_channel", "extrusion_angle"
  ].includes(partType);
};

interface ScanDetailsTabProps {
  data: ScanDetailsData;
  onChange: (data: ScanDetailsData) => void;
  partType?: PartGeometry | "";
  standard?: StandardType;
  partNumber?: string;
  equipmentFrequency?: string;
  dimensions?: {
    diameter?: number;
    length?: number;
    width?: number;
    height?: number;
    thickness?: number;
    outerDiameter?: number;
    innerDiameter?: number;
    coneTopDiameter?: number;
    coneBottomDiameter?: number;
    coneHeight?: number;
    wallThickness?: number;
    isHollow?: boolean;
  };
}

const FIXED_SCAN_DETAILS: ExtendedScanDetail[] = [
  { scanningDirection: "A", waveMode: "Longitudinal", frequency: "", make: "", probe: "", remarkDetails: "", enabled: false, entrySurface: "top", angle: 0, color: "#22c55e" },
  { scanningDirection: "A₁", waveMode: "Dual element", frequency: "", make: "", probe: "", remarkDetails: "", enabled: false, entrySurface: "top", angle: 0, color: "#16a34a" },
  { scanningDirection: "B", waveMode: "Longitudinal", frequency: "", make: "", probe: "", remarkDetails: "", enabled: false, entrySurface: "side", angle: 0, color: "#3b82f6" },
  { scanningDirection: "B₁", waveMode: "Dual element", frequency: "", make: "", probe: "", remarkDetails: "", enabled: false, entrySurface: "side", angle: 0, color: "#2563eb" },
  { scanningDirection: "C", waveMode: "Longitudinal", frequency: "", make: "", probe: "", remarkDetails: "", enabled: false, entrySurface: "od", angle: 0, color: "#f59e0b" },
  { scanningDirection: "C₁", waveMode: "Dual element", frequency: "", make: "", probe: "", remarkDetails: "", enabled: false, entrySurface: "od", angle: 0, color: "#d97706" },
  { scanningDirection: "D", waveMode: "Longitudinal", frequency: "", make: "", probe: "", remarkDetails: "", enabled: false, entrySurface: "od", angle: 45, color: "#ef4444" },
  { scanningDirection: "E", waveMode: "Axial shear wave 45 OD", frequency: "", make: "", probe: "", remarkDetails: "", enabled: false, entrySurface: "od", angle: 45, color: "#ec4899" },
  { scanningDirection: "F", waveMode: "Axial shear wave 45 OD", frequency: "", make: "", probe: "", remarkDetails: "", enabled: false, entrySurface: "od", angle: 45, color: "#8b5cf6" },
  { scanningDirection: "G", waveMode: "Shear wave 45 clockwise", frequency: "", make: "", probe: "", remarkDetails: "", enabled: false, entrySurface: "od", angle: 45, color: "#14b8a6" },
  { scanningDirection: "H", waveMode: "Shear wave 45 CCW", frequency: "", make: "", probe: "", remarkDetails: "", enabled: false, entrySurface: "id", angle: 0, color: "#06b6d4" },
  { scanningDirection: "I", waveMode: "Shear wave 45 CCW", frequency: "", make: "", probe: "", remarkDetails: "", enabled: false, entrySurface: "top", angle: 0, color: "#84cc16" },
  { scanningDirection: "L", waveMode: "Shear wave 45 CCW", frequency: "", make: "", probe: "", remarkDetails: "", enabled: false, entrySurface: "radial", angle: 0, color: "#a855f7" },
];

const scanDetailIndexModeOptions = ["AUTO", "1MM", "2MM", "5MM"];
const scanDetailFilterOptions = ["1MHZ", "2MHZ", "3MHZ", "4MHZ", "5MHZ", "7.5MHZ", "10MHZ", "15MHZ", "WIDEBAND", "OFF", "NONE"];
const scanDetailRejectOptions = ["0%", "5%", "10%", "20%"];
const GATE_FIELD_KEYS = ["gate1", "gate2", "gate3", "gate4"] as const;
type GateFieldKey = (typeof GATE_FIELD_KEYS)[number];

const getDefaultScanDetailsForStandard = (standard: StandardType): ExtendedScanDetail[] => {
  return (getV2500ScanDetailDefaults(standard) as ExtendedScanDetail[] | null) ?? FIXED_SCAN_DETAILS;
};

export const ScanDetailsTab = ({
  data,
  onChange,
  partType,
  standard = "AMS-STD-2154E",
  partNumber,
  equipmentFrequency,
  dimensions,
}: ScanDetailsTabProps) => {
  const frequencyOptions = getFrequencyOptionsForStandard(standard);
  const standardEquipmentParams = equipmentParametersByStandard[standard] || equipmentParametersByStandard["AMS-STD-2154E"];
  const [highlightedDirection, setHighlightedDirection] = useState<string | null>(null);
  const [expandedRows, setExpandedRows] = useState<string[]>([]);

  // Custom drawing state
  const [useCustomDrawing, setUseCustomDrawing] = useState<boolean>(!!data.customDrawingData?.image);
  const [customDrawingGeometry, setCustomDrawingGeometry] = useState<PartGeometry | null>(
    (data.customDrawingData?.confirmedGeometry as PartGeometry) || null
  );
  const [scanArrows, setScanArrows] = useState<ScanArrow[]>([]);
  const hasKnownV2500Context = hasKnownActiveMroContext(standard, partNumber);
  const isV2500Standard = isActiveMroStandard(standard);
  const isPwNdip = standard === "NDIP-1226" || standard === "NDIP-1227";
  const isHptDiskPart = partType === "hpt_disk";
  const v2500Stage: 1 | 2 | null = getActiveMroStage(standard, partNumber);

  // AI vision hook (supports Claude + Ollama)
  const {
    isAnalyzing,
    result: aiAnalysisResult,
    error: aiError,
    activeProvider,
    analyze: analyzeWithOllama,
    reset: resetAnalysis,
    setApiKey,
  } = useOllamaVision();

  const defaultScanDetails = useMemo(
    () => getDefaultScanDetailsForStandard(standard),
    [standard]
  );
  const defaultDirectionKey = useMemo(
    () => defaultScanDetails.map((detail) => detail.scanningDirection).join("|"),
    [defaultScanDetails]
  );
  const currentDirectionKey = useMemo(
    () => (data.scanDetails ?? []).map((detail) => detail.scanningDirection).join("|"),
    [data.scanDetails]
  );

  useEffect(() => {
    const existingScanDetails = data.scanDetails ?? [];
    const shouldInitialize = existingScanDetails.length === 0;
    const shouldNormalizeToStandard = existingScanDetails.length > 0 && currentDirectionKey !== defaultDirectionKey;

    if (!shouldInitialize && !shouldNormalizeToStandard) {
      return;
    }

    const normalizedScanDetails = defaultScanDetails.map((fixed) => {
      const existing = existingScanDetails.find((detail) => detail.scanningDirection === fixed.scanningDirection);
      return (existing ? { ...fixed, ...existing } : fixed) as ExtendedScanDetail;
    });

    onChange({ ...data, scanDetails: normalizedScanDetails });
  }, [currentDirectionKey, data, defaultDirectionKey, defaultScanDetails, onChange]);

  useEffect(() => {
    const parseFrequencyMHz = (value?: string | number | null): number | null => {
      if (typeof value === "number") {
        return Number.isFinite(value) && value > 0 ? value : null;
      }
      if (typeof value !== "string") return null;
      const match = value.match(/(\d+(?:\.\d+)?)/);
      if (!match) return null;
      const parsed = Number.parseFloat(match[1]);
      return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
    };

    const equipmentFrequencyMHz = parseFrequencyMHz(equipmentFrequency);
    const standardFrequencyMHz =
      Number.isFinite(standardEquipmentParams?.frequencyRange?.typical)
        ? standardEquipmentParams.frequencyRange.typical
        : parseFrequencyMHz(frequencyOptions[0]);

    const resolvedFrequencyMHz = equipmentFrequencyMHz ?? standardFrequencyMHz;
    const fallbackFrequency = resolvedFrequencyMHz !== null ? String(resolvedFrequencyMHz) : "";
    if (!fallbackFrequency) return;

    const existingScanDetails = data.scanDetails ?? [];
    if (existingScanDetails.length === 0) return;

    let hasChanges = false;
    const normalizedScanDetails = existingScanDetails.map((detail) => {
      if (detail.frequency?.trim()) return detail;
      hasChanges = true;
      return { ...detail, frequency: fallbackFrequency };
    });

    if (!hasChanges) return;
    onChange({ ...data, scanDetails: normalizedScanDetails });
  }, [data, equipmentFrequency, frequencyOptions, onChange, standardEquipmentParams]);

  useEffect(() => {
    const existingScanDetails = data.scanDetails ?? [];
    if (existingScanDetails.length === 0) {
      return;
    }

    let hasChanges = false;
    const normalizedScanDetails = existingScanDetails.map((detail) => {
      const isShearWave = /shear wave/i.test(detail.waveMode || "");
      const nextVelocity = isShearWave ? 5920 / 2 : detail.velocity;
      const nextIncidentAngle = isPwNdip
        ? ([18, 19, 20, 21].includes(Number(detail.incidentAngle)) ? detail.incidentAngle : 18)
        : detail.incidentAngle;

      if (detail.velocity === nextVelocity && detail.incidentAngle === nextIncidentAngle) {
        return detail;
      }

      hasChanges = true;
      return {
        ...detail,
        velocity: nextVelocity,
        incidentAngle: nextIncidentAngle,
      };
    });

    if (!hasChanges) {
      return;
    }

    onChange({ ...data, scanDetails: normalizedScanDetails });
  }, [data, isPwNdip, onChange]);

  const scanDetails = defaultScanDetails.map((fixed) => {
    const existing = data.scanDetails?.find((d) => d.scanningDirection === fixed.scanningDirection);
    return ({ ...fixed, ...existing } as ExtendedScanDetail);
  });

  const toggleScanDetail = (index: number) => {
    const newScanDetails = [...scanDetails];
    const wasEnabled = newScanDetails[index].enabled;
    newScanDetails[index] = { ...newScanDetails[index], enabled: !wasEnabled };
    onChange({ ...data, scanDetails: newScanDetails });
  };

  const updateScanDetail = (index: number, field: string, value: string | number | boolean | GateSettings | undefined) => {
    const newScanDetails = [...scanDetails];
    const updatedDetail: ExtendedScanDetail = { ...newScanDetails[index], [field]: value };

    // Keep backward compatibility with previously saved pulsar parameter field.
    if (field === "utParameter") {
      updatedDetail.pulsarParams = String(value || "");
    }
    if (field === "pulsarParams") {
      updatedDetail.utParameter = String(value || "");
    }

    newScanDetails[index] = updatedDetail;
    onChange({ ...data, scanDetails: newScanDetails });
  };

  const updateGate = (
    index: number,
    gateField: 'gate1' | 'gate2' | 'gate3' | 'gate4',
    subField: keyof GateSettings,
    value: number | string | undefined
  ) => {
    const newScanDetails = [...scanDetails];
    const currentGate = ((newScanDetails[index][gateField] as GateSettings | undefined) || {}) as GateSettings;
    const nextGate: GateSettings = { ...currentGate, [subField]: value };
    const hasValues = Object.values(nextGate).some((gateValue) => gateValue !== undefined && gateValue !== "");

    newScanDetails[index] = {
      ...newScanDetails[index],
      [gateField]: hasValues ? nextGate : undefined,
    };
    onChange({ ...data, scanDetails: newScanDetails });
  };

  const parseOptionalNumber = (value: string): number | undefined => {
    if (!value.trim()) {
      return undefined;
    }

    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  };

  const gateValueToInput = (value?: number | string): string => {
    if (value === undefined || value === null) {
      return "";
    }

    return String(value);
  };

  const toggleExpand = (direction: string) => {
    setExpandedRows((prev) =>
      prev.includes(direction)
        ? prev.filter((item) => item !== direction)
        : [...prev, direction]
    );
  };

  const activeScanDetails = getActiveScanDetails(scanDetails);
  const enabledScanDirections = getActiveScanDirections(scanDetails);
  const directionColors = Object.fromEntries(
    scanDetails.map(d => [d.scanningDirection, d.color || "#111827"])
  ) as Record<string, string>;

  // Custom drawing handlers
  const handleImageUpload = useCallback((imageBase64: string, width: number, height: number) => {
    // Save the image to data
    onChange({
      ...data,
      customDrawingData: {
        image: imageBase64,
        imageWidth: width,
        imageHeight: height,
        confirmedGeometry: '',
        lastModified: new Date().toISOString(),
      }
    });

    // Trigger AI analysis
    analyzeWithOllama(imageBase64);
  }, [onChange, data, analyzeWithOllama]);

  const handleGeometrySelect = useCallback((geometry: PartGeometry) => {
    setCustomDrawingGeometry(geometry);

    // Use AI-suggested arrows if available, otherwise use templates
    let arrows: ScanArrow[];
    if (aiAnalysisResult?.suggestedArrows && aiAnalysisResult.suggestedArrows.length > 0) {
      // Define colors for each direction
      const directionColors: Record<string, string> = {
        A: '#22c55e', B: '#3b82f6', C: '#f59e0b', D: '#ef4444',
        E: '#8b5cf6', F: '#ec4899', G: '#06b6d4', H: '#84cc16',
        I: '#f97316', J: '#6366f1', K: '#14b8a6', L: '#a855f7',
        M: '#10b981', N: '#0ea5e9', O: '#f97316', P: '#dc2626',
      };
      // Convert AI suggested arrows to ScanArrow format
      arrows = aiAnalysisResult.suggestedArrows.map(sa => ({
        direction: sa.direction,
        x: sa.x,
        y: sa.y,
        angle: sa.angle,
        length: 0.12,
        visible: true,
        color: directionColors[sa.direction] || '#6b7280',
        label: sa.label,
      }));
      console.log('🎯 Using AI-suggested arrow positions');
    } else {
      // Fall back to template arrows
      arrows = generateArrowsForGeometry(geometry);
      console.log('📐 Using template arrow positions');
    }

    // Sync with current scan details enabled state
    const syncedArrows = syncArrowsWithScanDetails(arrows, scanDetails);
    setScanArrows(syncedArrows);

    // Update data with confirmed geometry
    if (data.customDrawingData) {
      onChange({
        ...data,
        customDrawingData: {
          ...data.customDrawingData,
          confirmedGeometry: geometry,
          lastModified: new Date().toISOString(),
        }
      });
    }
  }, [data, onChange, scanDetails, aiAnalysisResult]);

  const handleRemoveCustomDrawing = useCallback(() => {
    setUseCustomDrawing(false);
    setCustomDrawingGeometry(null);
    setScanArrows([]);
    resetAnalysis();

    // Remove custom drawing data
    const { customDrawingData, ...restData } = data;
    onChange(restData as ScanDetailsData);
  }, [data, onChange, resetAnalysis]);

  // Handle arrow drag/move
  const handleArrowMove = useCallback((direction: string, x: number, y: number) => {
    setScanArrows(prev => prev.map(arrow =>
      arrow.direction === direction
        ? { ...arrow, x, y }
        : arrow
    ));
  }, []);

  // Sync arrows when scan details enabled state changes
  useEffect(() => {
    if (scanArrows.length > 0) {
      const syncedArrows = syncArrowsWithScanDetails(scanArrows, scanDetails);
      setScanArrows(syncedArrows);
    }
  }, [scanDetails.map(d => d.enabled).join(',')]); // eslint-disable-line react-hooks/exhaustive-deps

  // Initialize arrows if custom drawing exists with confirmed geometry
  useEffect(() => {
    if (data.customDrawingData?.confirmedGeometry && scanArrows.length === 0) {
      const geometry = data.customDrawingData.confirmedGeometry as PartGeometry;
      setCustomDrawingGeometry(geometry);
      const arrows = generateArrowsForGeometry(geometry);
      const syncedArrows = syncArrowsWithScanDetails(arrows, scanDetails);
      setScanArrows(syncedArrows);
    }
  }, [data.customDrawingData]); // eslint-disable-line react-hooks/exhaustive-deps

  const parseFrequencyMHz = (value?: string | number | null): number | null => {
    if (typeof value === "number") {
      return Number.isFinite(value) && value > 0 ? value : null;
    }
    if (typeof value !== "string") return null;
    const match = value.match(/(\d+(?:\.\d+)?)/);
    if (!match) return null;
    const parsed = Number.parseFloat(match[1]);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  };

  const fallbackFrequencyMHz = useMemo(() => {
    const fromEquipment = parseFrequencyMHz(equipmentFrequency);
    if (fromEquipment !== null) return fromEquipment;

    const standardTypical = standardEquipmentParams?.frequencyRange?.typical;
    if (Number.isFinite(standardTypical) && standardTypical > 0) {
      return standardTypical;
    }

    return parseFrequencyMHz(frequencyOptions[0]);
  }, [equipmentFrequency, frequencyOptions, standardEquipmentParams]);

  const getEffectiveFrequencyMHz = (detail: ExtendedScanDetail): number | null => {
    const fromDetail = parseFrequencyMHz(detail.frequency);
    return fromDetail ?? fallbackFrequencyMHz ?? null;
  };

  const getComputedNearField = (detail: ExtendedScanDetail): number | null => {
    const diameterMm = Number(detail.activeElementDiameter);
    const frequencyMHz = getEffectiveFrequencyMHz(detail);
    const velocityMs = Number(detail.velocity || 5920);

    if (!Number.isFinite(diameterMm) || diameterMm <= 0) return null;
    if (frequencyMHz === null) return null;
    if (!Number.isFinite(velocityMs) || velocityMs <= 0) return null;

    return calculateNearField(diameterMm, frequencyMHz, velocityMs);
  };

  const renderGateEditor = (
    detail: ExtendedScanDetail,
    index: number,
    gateField: GateFieldKey,
    label: string,
    labelClassName: string,
    inputClassName: string,
  ) => {
    const gate = detail[gateField] as GateSettings | undefined;
    const usePositionStartStop = isV2500Standard;

    return (
      <div>
        <Label className={labelClassName}>
          {label} {usePositionStartStop ? "(Position - Start - Stop)" : "(Start - Length - Level)"}
        </Label>
        <div className="grid grid-cols-3 gap-2 mt-1">
          <Input
            type={usePositionStartStop ? "text" : "number"}
            value={gateValueToInput(usePositionStartStop ? gate?.position : gate?.start)}
            onChange={(e) =>
              updateGate(
                index,
                gateField,
                usePositionStartStop ? "position" : "start",
                usePositionStartStop ? (e.target.value || undefined) : parseOptionalNumber(e.target.value)
              )
            }
            className={inputClassName}
          />
          <Input
            type="number"
            value={gateValueToInput(usePositionStartStop ? gate?.start : gate?.length)}
            onChange={(e) =>
              updateGate(
                index,
                gateField,
                usePositionStartStop ? "start" : "length",
                parseOptionalNumber(e.target.value)
              )
            }
            className={inputClassName}
          />
          <Input
            type="number"
            value={gateValueToInput(usePositionStartStop ? gate?.stop : gate?.level)}
            onChange={(e) =>
              updateGate(
                index,
                gateField,
                usePositionStartStop ? "stop" : "level",
                parseOptionalNumber(e.target.value)
              )
            }
            className={inputClassName}
          />
        </div>
      </div>
    );
  };

  const getVisibleGateFields = (detail: ExtendedScanDetail): GateFieldKey[] => {
    if (!isV2500Standard || !isV2500NdipStandard(standard)) {
      return [...GATE_FIELD_KEYS];
    }

    const expectedGateSettings = getV2500GateSettingsForDirection(standard, detail.scanningDirection);
    const expectedGateFields = GATE_FIELD_KEYS.filter((gateField) => Boolean(expectedGateSettings[gateField]));
    if (expectedGateFields.length > 0) {
      return expectedGateFields;
    }

    const existingGateFields = GATE_FIELD_KEYS.filter((gateField) => Boolean(detail[gateField]));
    return existingGateFields.length > 0 ? existingGateFields : ["gate1"];
  };

  const renderDiskReferenceDiagram = () => {
    const activeDetails = scanDetails.filter((detail) => detail.enabled);

    return (
      <div className="rounded-lg border-2 border-gray-200 bg-white p-3">
        <div className="mb-3">
          <h4 className="text-sm font-semibold text-slate-800">Disk Forging</h4>
          <p className="text-xs text-slate-500">ASTM E2375 Figure 7 reference</p>
        </div>
        <div className="overflow-hidden rounded-md border border-gray-200 bg-gray-50">
          <img
            src="/standards/e2375-diagrams/disk-forging.png"
            alt="ASTM E2375 Figure 7 disk forging"
            className="h-auto w-full object-contain"
          />
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {activeDetails.length > 0 ? activeDetails.map((detail) => (
            <Badge
              key={detail.scanningDirection}
              variant="outline"
              className={highlightedDirection === detail.scanningDirection ? "border-red-500 text-red-500" : ""}
              style={highlightedDirection === detail.scanningDirection ? undefined : { borderColor: detail.color, color: detail.color }}
            >
              {detail.scanningDirection}: {detail.waveMode}
            </Badge>
          )) : (
            <span className="text-xs text-slate-500">Enable directions to review the active scan set.</span>
          )}
        </div>
      </div>
    );
  };

  const renderHptDiskReferenceDiagram = () => {
    const standardImagePath =
      v2500Stage === 1
        ? "/standards/ndip-1226-gating-scheme.png"
        : v2500Stage === 2
          ? "/standards/ndip-1227-gating-scheme.png"
          : null;
    const referenceLabel =
      v2500Stage === 1
        ? "NDIP-1226 Excel gating scheme reference"
        : v2500Stage === 2
          ? "NDIP-1227 Excel gating scheme reference"
        : standard === "NDIP-1227"
          ? "No bundled standard reference image for NDIP-1227"
          : standard === "NDIP-1226"
            ? "No bundled standard reference image for NDIP-1226"
          : hasKnownV2500Context
            ? "No bundled standard reference image for recognized V2500 context"
            : "No bundled standard reference image";

    return (
      <div className="rounded-lg border-2 border-gray-200 bg-white p-3">
        <div className="mb-3">
          <h4 className="text-sm font-semibold text-slate-800">
            {standardImagePath ? "HPT Disk Standard Reference" : "HPT Disk Reference"}
          </h4>
          <p className="text-xs text-slate-500">{referenceLabel}</p>
        </div>
        {standardImagePath ? (
          <div className="overflow-hidden rounded-md border border-gray-200 bg-gray-50">
            <img
              src={standardImagePath}
              alt="HPT disk standard reference"
              className="block h-auto w-full"
            />
          </div>
        ) : (
          <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            Bore reconstruction drawings were removed. This screen now shows only bundled standard images, and none are currently available for this context.
          </div>
        )}
        <div className="mt-3 flex flex-wrap gap-2">
          {activeScanDetails.length > 0 ? activeScanDetails.map((detail) => (
            <Badge
              key={detail.scanningDirection}
              variant="outline"
              className={highlightedDirection === detail.scanningDirection ? "border-red-500 text-red-500" : ""}
              style={highlightedDirection === detail.scanningDirection ? undefined : { borderColor: detail.color, color: detail.color }}
            >
              {detail.scanningDirection}: {detail.waveMode}
            </Badge>
          )) : (
            <span className="text-xs text-slate-500">Enable directions to review the active scan set.</span>
          )}
        </div>
      </div>
    );
  };

  // Render expanded details panel - Dark theme design
  const renderExpandedDetails = (detail: ExtendedScanDetail, index: number) => {
    const availableIndexModes = includeCurrentOption(scanDetailIndexModeOptions, detail.indexMode);
    const availableFilters = includeCurrentOption(scanDetailFilterOptions, detail.filter);
    const availableRejectValues = includeCurrentOption(scanDetailRejectOptions, detail.reject);
    const visibleGateFields = getVisibleGateFields(detail);
    const availableIncidentAngles = includeCurrentOption(
      ["18", "19", "20", "21"],
      detail.incidentAngle !== undefined ? String(detail.incidentAngle) : ""
    );

    return (
    <tr className="bg-slate-900/50 border-b border-slate-700">
      <td colSpan={7} className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Probe Details Section */}
          {!isPwNdip && (
          <div className="bg-slate-800/80 rounded-lg p-4 border border-blue-500/30">
            <h4 className="text-sm font-semibold text-blue-400 mb-3 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-400"></span>
              Probe Details
            </h4>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-[10px] text-slate-400 uppercase tracking-wide">Part Number</Label>
                <Input
                  value={detail.partNumber || ""}
                  onChange={(e) => updateScanDetail(index, "partNumber", e.target.value)}
                  className="h-8 text-xs bg-slate-900/60 border-slate-600 text-slate-100 placeholder:text-slate-500"
                />
              </div>
              <div>
                <Label className="text-[10px] text-slate-400 uppercase tracking-wide">Serial Number</Label>
                <Input
                  value={detail.serialNumber || ""}
                  onChange={(e) => updateScanDetail(index, "serialNumber", e.target.value)}
                  className="h-8 text-xs bg-slate-900/60 border-slate-600 text-slate-100 placeholder:text-slate-500"
                />
              </div>
              <div>
                <Label className="text-[10px] text-slate-400 uppercase tracking-wide">Active Element Diameter (mm)</Label>
                <Input
                  type="number"
                  value={detail.activeElementDiameter?.toString() || ""}
                  onChange={(e) => updateScanDetail(index, "activeElementDiameter", parseFloat(e.target.value) || 0)}
                  className="h-8 text-xs bg-slate-900/60 border-slate-600 text-slate-100 placeholder:text-slate-500"
                />
              </div>
              <div>
                <Label className="text-[10px] text-slate-400 uppercase tracking-wide">Bandwidth</Label>
                <Input
                  value={detail.bandwidth || ""}
                  onChange={(e) => updateScanDetail(index, "bandwidth", e.target.value)}
                  className="h-8 text-xs bg-slate-900/60 border-slate-600 text-slate-100 placeholder:text-slate-500"
                />
              </div>
              <div>
                <Label className="text-[10px] text-slate-400 uppercase tracking-wide">Focus Size (inch)</Label>
                <Input
                  value={detail.focusSize || ""}
                  onChange={(e) => updateScanDetail(index, "focusSize", e.target.value)}
                  className="h-8 text-xs bg-slate-900/60 border-slate-600 text-slate-100 placeholder:text-slate-500"
                />
              </div>
              {/* Frequency hidden from UI per requirements — kept in data model for transducer selection */}
              <div>
                <Label className="text-[10px] text-slate-400 uppercase tracking-wide">Velocity (m/s)</Label>
                <Input
                  type="number"
                  value={detail.velocity?.toString() || ""}
                  onChange={(e) => updateScanDetail(index, "velocity", parseFloat(e.target.value) || 0)}
                  className="h-8 text-xs bg-slate-900/60 border-slate-600 text-slate-100 placeholder:text-slate-500"
                />
              </div>
              <div>
                <Label className="text-[10px] text-slate-400 uppercase tracking-wide">Near Field (mm)</Label>
                {(() => {
                  const nf = getComputedNearField(detail);
                  return (
                    <div className="relative group">
                      <Input
                        value={nf !== null ? nf.toFixed(2) : ""}
                        readOnly
                        className={`h-8 text-xs border-slate-600 text-slate-100 ${
                          nf !== null
                            ? "bg-emerald-900/40 border-emerald-500/50 ring-1 ring-emerald-500/30"
                            : "bg-slate-800"
                        }`}
                      />
                      {nf !== null && (
                        <span className="absolute -top-1.5 right-1 px-1 text-[8px] font-bold bg-emerald-500 text-white rounded">
                          AUTO
                        </span>
                      )}
                      <div className="absolute bottom-full left-0 mb-1 hidden group-hover:block z-50 w-48 p-2 text-[10px] bg-slate-950 border border-slate-600 rounded shadow-lg text-slate-300">
                        <p className="font-semibold text-emerald-400 mb-1">N = D² / (4{"\u03BB"})</p>
                        <p>{"\u03BB"} = V / f</p>
                        {nf !== null && (
                          <p className="mt-1 text-emerald-300">= {nf.toFixed(2)} mm</p>
                        )}
                        {nf === null && (
                          <p className="mt-1 text-amber-400">Enter Diameter and Velocity. Frequency falls back to Equipment, then to the standard default.</p>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
          )}

          {/* Gates Section */}
          <div className="bg-slate-800/80 rounded-lg p-4 border border-emerald-500/30">
            <h4 className="text-sm font-semibold text-emerald-400 mb-3 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
              {isV2500Standard ? "Gating Scheme" : "Gate Settings"}
            </h4>
            <div className="space-y-4">
              {isV2500Standard ? (
                <div className="space-y-3">
                  <div className="text-[10px] text-emerald-400/80 uppercase tracking-wide">Vdepth (inches)</div>
                  <div className="grid grid-cols-3 gap-2 px-1">
                    <Label className="text-[10px] text-slate-400 uppercase tracking-wide text-center">Position</Label>
                    <Label className="text-[10px] text-slate-400 uppercase tracking-wide text-center">Start</Label>
                    <Label className="text-[10px] text-slate-400 uppercase tracking-wide text-center">Stop</Label>
                  </div>
                  {visibleGateFields.map((gateField) => {
                    const gate = detail[gateField] as GateSettings | undefined;
                    return (
                      <div key={gateField} className="grid grid-cols-3 gap-2">
                        <Input
                          type="text"
                          value={gateValueToInput(gate?.position)}
                          onChange={(e) => updateGate(index, gateField, "position", e.target.value || undefined)}
                          className="h-8 text-xs text-center bg-slate-900/60 border-slate-600 text-slate-100 placeholder:text-slate-500"
                        />
                        <Input
                          type="number"
                          value={gateValueToInput(gate?.start)}
                          onChange={(e) => updateGate(index, gateField, "start", parseOptionalNumber(e.target.value))}
                          className="h-8 text-xs text-center bg-slate-900/60 border-slate-600 text-slate-100 placeholder:text-slate-500"
                        />
                        <Input
                          type="number"
                          value={gateValueToInput(gate?.stop)}
                          onChange={(e) => updateGate(index, gateField, "stop", parseOptionalNumber(e.target.value))}
                          className="h-8 text-xs text-center bg-slate-900/60 border-slate-600 text-slate-100 placeholder:text-slate-500"
                        />
                      </div>
                    );
                  })}
                </div>
              ) : (
                <>
                  {renderGateEditor(detail, index, "gate1", "Gate 1", "text-[10px] text-emerald-400/80 uppercase tracking-wide", "h-8 text-xs text-center bg-slate-900/60 border-slate-600 text-slate-100 placeholder:text-slate-500")}
                  {renderGateEditor(detail, index, "gate2", "Gate 2", "text-[10px] text-amber-400/80 uppercase tracking-wide", "h-8 text-xs text-center bg-amber-950/40 border-amber-700/50 text-slate-100 placeholder:text-slate-500")}
                  {renderGateEditor(detail, index, "gate3", "Gate 3", "text-[10px] text-violet-400/80 uppercase tracking-wide", "h-8 text-xs text-center bg-violet-950/40 border-violet-700/50 text-slate-100 placeholder:text-slate-500")}
                  {renderGateEditor(detail, index, "gate4", "Gate 4", "text-[10px] text-rose-400/80 uppercase tracking-wide", "h-8 text-xs text-center bg-rose-950/40 border-rose-700/50 text-slate-100 placeholder:text-slate-500")}
                </>
              )}
            </div>
          </div>

          {/* U.T Parameters Section */}
          <div className="bg-slate-800/80 rounded-lg p-4 border border-violet-500/30">
            <h4 className="text-sm font-semibold text-violet-400 mb-3 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-violet-400"></span>
              U.T Parameters
            </h4>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-[10px] text-slate-400 uppercase tracking-wide">Scanning File</Label>
                <Input
                  value={detail.scanningFile || ""}
                  onChange={(e) => updateScanDetail(index, "scanningFile", e.target.value)}
                  className="h-8 text-xs bg-slate-900/60 border-slate-600 text-slate-100 placeholder:text-slate-500"
                />
              </div>
              <div>
                <Label className="text-[10px] text-slate-400 uppercase tracking-wide">U.T Parameter</Label>
                <Input
                  value={detail.utParameter || detail.pulsarParams || ""}
                  onChange={(e) => updateScanDetail(index, "utParameter", e.target.value)}
                  className="h-8 text-xs bg-slate-900/60 border-slate-600 text-slate-100 placeholder:text-slate-500"
                />
              </div>
              <div>
                <Label className="text-[10px] text-slate-400 uppercase tracking-wide">Range</Label>
                <Input
                  type="number"
                  value={detail.utRange?.toString() || ""}
                  onChange={(e) => updateScanDetail(index, "utRange", parseFloat(e.target.value) || 0)}
                  className="h-8 text-xs bg-slate-900/60 border-slate-600 text-slate-100 placeholder:text-slate-500"
                />
              </div>
              <div>
                <Label className="text-[10px] text-slate-400 uppercase tracking-wide">Delay</Label>
                <Input
                  type="number"
                  value={detail.utDelay?.toString() || ""}
                  onChange={(e) => updateScanDetail(index, "utDelay", parseFloat(e.target.value) || 0)}
                  className="h-8 text-xs bg-slate-900/60 border-slate-600 text-slate-100 placeholder:text-slate-500"
                />
              </div>
              {isPwNdip && (
                <div>
                  <Label className="text-[10px] text-slate-400 uppercase tracking-wide">Incident Angle (deg)</Label>
                  <Select
                    value={detail.incidentAngle !== undefined ? String(detail.incidentAngle) : ""}
                    onValueChange={(value) => updateScanDetail(index, "incidentAngle", Number(value))}
                  >
                    <SelectTrigger className="h-8 text-xs bg-slate-900/60 border-slate-600 text-slate-100">
                      <SelectValue placeholder="" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-600">
                      {availableIncidentAngles.map((value) => (
                        <SelectItem key={value} value={value} className="text-xs text-slate-100">
                          {value}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div>
                <Label className="text-[10px] text-slate-400 uppercase tracking-wide">PRF (Hz)</Label>
                <Input
                  type="number"
                  value={detail.prf?.toString() || ""}
                  onChange={(e) => updateScanDetail(index, "prf", parseInt(e.target.value) || 0)}
                  className="h-8 text-xs bg-slate-900/60 border-slate-600 text-slate-100 placeholder:text-slate-500"
                />
              </div>
              <div>
                <Label className="text-[10px] text-slate-400 uppercase tracking-wide">Index</Label>
                <Select value={detail.indexMode || ""} onValueChange={(v) => updateScanDetail(index, "indexMode", v)}>
                  <SelectTrigger className="h-8 text-xs bg-slate-900/60 border-slate-600 text-slate-100"><SelectValue placeholder="" /></SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-600">
                    {availableIndexModes.map((value) => (
                      <SelectItem key={value} value={value} className="text-xs text-slate-100">
                        {value}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-[10px] text-slate-400 uppercase tracking-wide">DB</Label>
                <Input
                  type="number"
                  value={detail.db?.toString() || ""}
                  onChange={(e) => updateScanDetail(index, "db", parseFloat(e.target.value) || 0)}
                  className="h-8 text-xs bg-slate-900/60 border-slate-600 text-slate-100 placeholder:text-slate-500"
                />
              </div>
              <div>
                <Label className="text-[10px] text-slate-400 uppercase tracking-wide">Filter</Label>
                <Select value={detail.filter || ""} onValueChange={(v) => updateScanDetail(index, "filter", v)}>
                  <SelectTrigger className="h-8 text-xs bg-slate-900/60 border-slate-600 text-slate-100"><SelectValue placeholder="" /></SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-600">
                    {availableFilters.map((value) => (
                      <SelectItem key={value} value={value} className="text-xs text-slate-100">
                        {value}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-[10px] text-slate-400 uppercase tracking-wide">Reject</Label>
                <Select value={detail.reject || ""} onValueChange={(v) => updateScanDetail(index, "reject", v)}>
                  <SelectTrigger className="h-8 text-xs bg-slate-900/60 border-slate-600 text-slate-100"><SelectValue placeholder="" /></SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-600">
                    {availableRejectValues.map((value) => (
                      <SelectItem key={value} value={value} className="text-xs text-slate-100">
                        {value}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-[10px] text-slate-400 uppercase tracking-wide">TCG Mode</Label>
                <div className="flex items-center gap-2 h-8">
                  <Switch
                    checked={detail.tcgMode ?? false}
                    onCheckedChange={(checked) => updateScanDetail(index, "tcgMode", checked)}
                    className="scale-90 data-[state=checked]:bg-violet-500"
                  />
                  <span className="text-xs text-slate-300">{detail.tcgMode ? "ON" : "OFF"}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </td>
    </tr>
    );
  };

  // Render predefined diagram based on part type
  const renderPredefinedDiagram = () => {
    if (isTubeType(partType)) {
      return <TubeScanDiagram scanDetails={scanDetails} highlightedDirection={highlightedDirection} />;
    } else if (isConeType(partType)) {
      return <ConeScanDiagram scanDetails={scanDetails} highlightedDirection={highlightedDirection} />;
    } else if (isBoxType(partType)) {
      return <BoxScanDiagram scanDetails={scanDetails} highlightedDirection={highlightedDirection} partType={partType} dimensions={dimensions} />;
    } else if (isCylinderType(partType)) {
      return <CylinderScanDiagram scanDetails={scanDetails} highlightedDirection={highlightedDirection} />;
    } else if (isDiskType(partType)) {
      if (isHptDiskPart) {
        return renderHptDiskReferenceDiagram();
      }
      return renderDiskReferenceDiagram();
    } else if (isImpellerType(partType)) {
      return <ImpellerScanDiagram scanDetails={scanDetails} highlightedDirection={highlightedDirection} />;
    } else if (isBliskType(partType)) {
      return <BliskScanDiagram scanDetails={scanDetails} highlightedDirection={highlightedDirection} />;
    } else if (isRingType(partType)) {
      return <RingScanDiagram scanDetails={scanDetails} highlightedDirection={highlightedDirection} />;
    } else if (isHexType(partType)) {
      return <HexBarScanDiagram scanDetails={scanDetails} highlightedDirection={highlightedDirection} />;
    } else if (isProfileType(partType)) {
      return <BoxScanDiagram scanDetails={scanDetails} highlightedDirection={highlightedDirection} partType={partType} dimensions={dimensions} />;
    } else {
      return (
        <Card className="h-full flex items-center justify-center bg-muted/30">
          <div className="text-center p-4">
            <Info className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-xs text-muted-foreground">
              {partType ? `Diagram for "${partType}" coming soon` : "Select Part Type in Setup"}
            </p>
          </div>
        </Card>
      );
    }
  };

  // Render custom drawing with arrow overlay
  const renderCustomDrawing = () => {
    const customData = data.customDrawingData;

    // No image uploaded yet - show upload component
    if (!customData?.image) {
      return (
        <div className="h-full flex flex-col">
          <CustomDrawingUpload
            onImageUpload={handleImageUpload}
            currentImage={null}
          />
        </div>
      );
    }

    // Image uploaded but geometry not confirmed - show selector
    if (!customDrawingGeometry) {
      return (
        <div className="h-full flex flex-col gap-3 overflow-auto">
          <div className="flex-shrink-0">
            <div className="relative">
              <img
                src={customData.image}
                alt="Uploaded drawing"
                className="w-full h-auto max-h-[260px] object-contain rounded-lg bg-gray-100"
              />
              <Button
                size="sm"
                variant="destructive"
                className="absolute top-2 right-2"
                onClick={handleRemoveCustomDrawing}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <GeometrySelector
            selectedGeometry={customDrawingGeometry}
            onGeometrySelect={handleGeometrySelect}
            aiAnalysis={aiAnalysisResult}
            isAnalyzing={isAnalyzing}
            aiError={aiError}
            activeProvider={activeProvider}
            onSetApiKey={setApiKey}
          />
        </div>
      );
    }

    // Full view with arrows
    return (
      <div className="h-full flex flex-col">
        <div className="flex-1 relative overflow-hidden rounded-lg bg-gray-100">
          <ArrowOverlay
            image={customData.image}
            width={560}
            height={420}
            arrows={scanArrows}
            highlightedDirection={highlightedDirection}
            onArrowHover={setHighlightedDirection}
            onArrowMove={handleArrowMove}
            showLabels={true}
            enableDrag={true}
          />
          <Button
            size="sm"
            variant="secondary"
            className="absolute top-2 right-2 shadow-md"
            onClick={handleRemoveCustomDrawing}
          >
            <X className="h-4 w-4 mr-1" />
            Remove
          </Button>
        </div>
        <div className="flex-shrink-0 pt-2">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Geometry: <strong className="text-slate-200">{customDrawingGeometry}</strong></span>
            <Button
              size="sm"
              variant="ghost"
              className="h-6 text-xs"
              onClick={() => setCustomDrawingGeometry(null)}
            >
              Change
            </Button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col overflow-hidden p-3 md:p-4">
      <div className="flex-1 flex gap-3 min-h-0">
        {/* LEFT: Diagram / Custom Drawing */}
        <div className="workstation-card w-2/5 min-h-0 flex-shrink-0 flex flex-col border-0 p-3" data-testid="e2375-diagram">
          {/* Toggle between predefined and custom drawing */}
          <div className="flex items-center justify-between mb-2 px-1">
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant={!useCustomDrawing ? "default" : "outline"}
                className="h-7 text-xs"
                onClick={() => setUseCustomDrawing(false)}
              >
                <ImageIcon className="h-3 w-3 mr-1" />
                Auto
              </Button>
              <Button
                size="sm"
                variant={useCustomDrawing ? "default" : "outline"}
                className="h-7 text-xs"
                onClick={() => setUseCustomDrawing(true)}
              >
                <Upload className="h-3 w-3 mr-1" />
                Custom
              </Button>
            </div>
          </div>

          {/* Diagram content */}
          <div className="flex-1 min-h-0">
            {useCustomDrawing ? renderCustomDrawing() : renderPredefinedDiagram()}
          </div>
        </div>

        {/* RIGHT: Compact Table with Expandable Rows */}
        <div className="workstation-card flex-1 flex flex-col min-h-0 border-0 p-3">
          <div className="flex items-center justify-between mb-1 px-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-slate-300">Scan Details</span>
              <span className="text-[10px] text-blue-400">(Click direction or wave mode to expand)</span>
            </div>
            <Badge variant="outline" className="text-[10px] border-slate-600 text-slate-300">
              {activeScanDetails.length} / {scanDetails.length} active
            </Badge>
          </div>

          <div className="flex-1 overflow-auto rounded-2xl border border-slate-700/70 bg-slate-950/30">
            <table className="w-full border-collapse text-xs">
              <thead className="sticky top-0 bg-slate-800 z-10">
                <tr className="border-b border-slate-600">
                  <th className="px-2 py-2 w-8 text-slate-400"></th>
                  <th className="px-2 py-2 w-6 text-slate-400"></th>
                  <th className="px-2 py-2 text-center w-14 text-slate-300 font-medium">Direction</th>
                  <th className="px-2 py-2 text-left text-slate-300 font-medium">Wave Mode</th>
                  <th className="px-2 py-2 text-center w-20 text-slate-300 font-medium">Make</th>
                  <th className="px-2 py-2 text-center w-24 text-slate-300 font-medium">Water Path (mm)</th>
                  <th className="px-2 py-2 text-left text-slate-300 font-medium">Remarks</th>
                </tr>
              </thead>
              <tbody>
                {scanDetails.map((detail, index) => (
                  <React.Fragment key={detail.scanningDirection}>
                    <tr
                      className={`border-b border-slate-700/50 transition-colors ${
                        detail.enabled
                          ? 'bg-blue-900/20 hover:bg-blue-800/30'
                          : 'hover:bg-slate-700/40'
                      } ${expandedRows.includes(detail.scanningDirection) ? 'bg-slate-700/50' : ''}`}
                      onMouseEnter={() => setHighlightedDirection(detail.scanningDirection)}
                      onMouseLeave={() => setHighlightedDirection(null)}
                    >
                      {/* Expand Button */}
                      <td className="px-2 py-1.5 text-center">
                        {expandedRows.includes(detail.scanningDirection) ? (
                          <ChevronDown className="h-4 w-4 text-slate-400" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-slate-500" />
                        )}
                      </td>

                      {/* Checkbox */}
                      <td className="px-1 py-1.5 text-center" onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={detail.enabled}
                          onCheckedChange={() => toggleScanDetail(index)}
                          className="h-4 w-4 border-slate-500 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                        />
                      </td>

                      {/* Direction */}
                      <td className="px-2 py-1.5 text-center cursor-pointer" onClick={() => toggleExpand(detail.scanningDirection)}>
                        <Badge
                          variant={detail.enabled ? "default" : "outline"}
                          className="text-xs font-bold"
                          style={detail.enabled ? { backgroundColor: detail.color } : {}}
                        >
                          {detail.scanningDirection}
                        </Badge>
                      </td>

                      {/* Wave Mode */}
                      <td className="px-2 py-1.5 cursor-pointer" onClick={() => toggleExpand(detail.scanningDirection)}>
                        <span className="text-slate-300">{detail.waveMode}</span>
                      </td>

                      {/* Make */}
                      <td className="px-1 py-1.5" onClick={(e) => e.stopPropagation()}>
                        <Input
                          value={detail.make || ""}
                          onChange={(e) => updateScanDetail(index, "make", e.target.value)}
                          className="h-7 text-xs px-1 bg-slate-800/60 border-slate-600 text-slate-100 placeholder:text-slate-500"
                        />
                      </td>

                      {/* Water Path */}
                      <td className="px-1 py-1.5" onClick={(e) => e.stopPropagation()}>
                        <Input
                          type="number"
                          value={detail.waterPath?.toString() || ""}
                          onChange={(e) => updateScanDetail(index, "waterPath", e.target.value ? parseFloat(e.target.value) : undefined)}
                          className="h-7 text-xs px-1 bg-slate-800/60 border-slate-600 text-slate-100 placeholder:text-slate-500"
                        />
                      </td>

                      {/* Remarks */}
                      <td className="px-1 py-1.5" onClick={(e) => e.stopPropagation()}>
                        <Input
                          value={detail.remarkDetails || ""}
                          onChange={(e) => updateScanDetail(index, "remarkDetails", e.target.value)}
                          className="h-7 text-xs px-1 bg-slate-800/60 border-slate-600 text-slate-100 placeholder:text-slate-500"
                        />
                      </td>
                    </tr>

                    {/* Expanded Details Row */}
                    {expandedRows.includes(detail.scanningDirection) && renderExpandedDetails(detail, index)}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
