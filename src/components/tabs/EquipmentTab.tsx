// @ts-nocheck
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalibrationData, EquipmentData, StandardType, TechniqueType } from "@/types/techniqueSheet";
import { FieldWithHelp } from "@/components/FieldWithHelp";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Info, AlertTriangle, ChevronDown, ChevronRight, Plus, X } from "lucide-react";
import { useMemo, useState, useEffect } from "react";
import {
  equipmentParametersByStandard,
  getRecommendedFrequencyForStandard,
} from "@/data/standardsDifferences";
import { getFrequencyOptionsForStandard } from "@/utils/frequencyUtils";
import { includeCurrentOption } from "@/utils/selectOptions";
import { PW_45_DEGREE_MIRROR, PW_PRIMARY_TRANSDUCER } from "@/rules/pw/pwTransducers";
import {
  V2500_CALIBRATION_BLOCK_HOLDER,
  V2500_CALIBRATION_BLOCK_PART_NUMBER,
  V2500_CHUCK_RISER_OPTIONS,
  V2500_MARKING_PENCIL,
} from "@/utils/pwNdipDefaults";

// LocalStorage keys for custom items
const STORAGE_KEYS = {
  customTransducerTypes: 'scanmaster_custom_transducer_types',
  customWedgeTypes: 'scanmaster_custom_wedge_types',
  customChuckRisers: 'scanmaster_custom_chuck_risers',
};

interface EquipmentTabProps {
  data: EquipmentData;
  onChange: (data: EquipmentData) => void;
  partThickness: number;
  standard?: StandardType;
  scanTechnique?: TechniqueType;
  calibrationData?: CalibrationData;
  onCalibrationChange?: (data: CalibrationData) => void;
}

const transducerTypes = ["immersion", "contact", "dual_element"];

const couplantOptions = [
  "Water (Immersion)",
  "Water (with wetting agent)",
  "Glycerin",
  "Commercial Gel (Sono 600)",
  "SAE No. 20 Motor Oil",
  "SAE No. 30 Motor Oil",
  "Mineral Oil",
  "Cellulose Paste",
  "Custom",
];

const transducerShapeOptions = [
  {
    value: "active_element_diameter_3_8_to_1_inch",
    label: "Active element diameter 3/8 inch to 1 inch",
  },
  {
    value: "rectangular_flat",
    label: "Rectangular flat",
  },
  {
    value: "cylindrically_focused_transducers",
    label: "Cylindrically focused transducers",
  },
];

// Get standard label
const getStandardLabel = (standard: StandardType): string => {
  const labels: Partial<Record<StandardType, string>> = {
    "MIL-STD-2154": "MIL-STD-2154 Table II",
    "AMS-STD-2154E": "AMS-STD-2154E Table II",
    "ASTM-A388": "ASTM A388/A388M",
    "ASTM-E2375": "ASTM E2375",
    "ASTM-E1001": "ASTM E1001",
    "ASTM-E2580": "ASTM E2580",
    "ASTM-E588": "ASTM E588",
    "ASTM-E127": "ASTM E127",
    "ASTM-E164": "ASTM E164",
    "BS-EN-10228-3": "BS EN 10228-3:2016",
    "BS-EN-10228-4": "BS EN 10228-4:2016",
    "EN-ISO-16810": "EN ISO 16810",
    "AMS-2630": "AMS 2630",
    "AMS-2631": "AMS 2631 (Titanium)",
    "AMS-2632": "AMS 2632 (Thin Materials)",
    "NDIP-1226": "PW NDIP-1226 (V2500 HPT S1)",
    "NDIP-1227": "PW NDIP-1227 (V2500 HPT S2)",
  };
  return labels[standard] || standard;
};

// Default wedge types
const defaultWedgeTypes = [
  { value: "Normal", label: "Normal (0°)" },
  { value: "Angled", label: "Angled (Shear Wave)" },
  { value: "Immersion", label: "Immersion" },
  { value: "Custom", label: "Custom" },
];

const NDIP_EQUIPMENT_BY_MANUFACTURER: Record<string, string> = {
  "Inspection Research & Technologies Ltd": "LS-200 Immersion Tank and Ultrasonic Scanner",
  Matec: "IMT3007-SS-TT-L-ARN or equivalent",
};

export const EquipmentTab = ({
  data,
  onChange,
  partThickness,
  standard = "AMS-STD-2154E",
  scanTechnique,
  calibrationData,
  onCalibrationChange,
}: EquipmentTabProps) => {
  // State to control Phased Array section visibility
  const [showPASection, setShowPASection] = useState(false);

  // State for custom items (persisted in localStorage)
  const [customTransducerTypes, setCustomTransducerTypes] = useState<string[]>([]);
  const [customWedgeTypes, setCustomWedgeTypes] = useState<{ value: string; label: string }[]>([]);
  const [customChuckRisers, setCustomChuckRisers] = useState<string[]>([]);

  // State for "Add to list" input mode
  const [addingTransducer, setAddingTransducer] = useState(false);
  const [addingWedge, setAddingWedge] = useState(false);
  const [addingChuckRiser, setAddingChuckRiser] = useState(false);
  const [newItemValue, setNewItemValue] = useState("");
  const isPwNdip = standard === "NDIP-1226" || standard === "NDIP-1227";
  const resolvedNdipModel =
    (data.manufacturer ? NDIP_EQUIPMENT_BY_MANUFACTURER[data.manufacturer] : undefined) ||
    data.model ||
    "";

  // Load custom items from localStorage on mount
  useEffect(() => {
    try {
      const storedTransducers = localStorage.getItem(STORAGE_KEYS.customTransducerTypes);
      const storedWedges = localStorage.getItem(STORAGE_KEYS.customWedgeTypes);
      const storedChuckRisers = localStorage.getItem(STORAGE_KEYS.customChuckRisers);

      if (storedTransducers) setCustomTransducerTypes(JSON.parse(storedTransducers));
      if (storedWedges) setCustomWedgeTypes(JSON.parse(storedWedges));
      if (storedChuckRisers) setCustomChuckRisers(JSON.parse(storedChuckRisers));
    } catch (error) {
      console.warn("Failed to load custom equipment items from localStorage:", error);
    }
  }, []);

  useEffect(() => {
    if (scanTechnique === "phased_array") {
      setShowPASection(true);
    }
  }, [scanTechnique]);

  useEffect(() => {
    if (!isPwNdip) {
      return;
    }

    const manufacturer = data.manufacturer;
    const model = manufacturer ? (NDIP_EQUIPMENT_BY_MANUFACTURER[manufacturer] || data.model || "") : "";
    const normalizedMarkingPencil = data.ndipMarkingPencil || V2500_MARKING_PENCIL;
    const nextTransducerTypes = ["immersion"];
    const needsEquipmentNormalization =
      data.model !== model ||
      data.transducerType !== "immersion" ||
      JSON.stringify(data.transducerTypes || []) !== JSON.stringify(nextTransducerTypes) ||
      data.probeModel !== PW_PRIMARY_TRANSDUCER.partNumber ||
      data.ndipMarkingPencil !== normalizedMarkingPencil;

    if (needsEquipmentNormalization) {
      onChange({
        ...data,
        manufacturer,
        model,
        probeModel: PW_PRIMARY_TRANSDUCER.partNumber,
        transducerType: "immersion",
        transducerTypes: nextTransducerTypes,
        ndipMarkingPencil: normalizedMarkingPencil,
      });
    }

    if (calibrationData && onCalibrationChange && calibrationData.blockHolder !== V2500_CALIBRATION_BLOCK_HOLDER) {
      onCalibrationChange({
        ...calibrationData,
        blockHolder: V2500_CALIBRATION_BLOCK_HOLDER,
      });
    }
  }, [calibrationData, data, isPwNdip, onCalibrationChange, onChange]);

  // Helper to add custom transducer type
  const addCustomTransducerType = (name: string) => {
    if (!name.trim()) return;
    const value = name.trim().toLowerCase().replace(/\s+/g, '_');
    if (transducerTypes.includes(value) || customTransducerTypes.includes(value)) return;
    const updated = [...customTransducerTypes, value];
    setCustomTransducerTypes(updated);
    localStorage.setItem(STORAGE_KEYS.customTransducerTypes, JSON.stringify(updated));
    applyTransducerSelection([...selectedTransducerTypes, value]);
    setAddingTransducer(false);
    setNewItemValue("");
  };

  // Helper to add custom wedge type
  const addCustomWedgeType = (name: string) => {
    if (!name.trim()) return;
    const value = name.trim();
    if (defaultWedgeTypes.some(w => w.value === value) || customWedgeTypes.some(w => w.value === value)) return;
    const newWedge = { value, label: value };
    const updated = [...customWedgeTypes, newWedge];
    setCustomWedgeTypes(updated);
    localStorage.setItem(STORAGE_KEYS.customWedgeTypes, JSON.stringify(updated));
    updateField("wedgeType", value);
    setAddingWedge(false);
    setNewItemValue("");
  };

  const addCustomChuckRiser = (name: string) => {
    if (!name.trim()) return;
    const value = name.trim();
    if (V2500_CHUCK_RISER_OPTIONS.includes(value) || customChuckRisers.includes(value)) return;
    const updated = [...customChuckRisers, value];
    setCustomChuckRisers(updated);
    localStorage.setItem(STORAGE_KEYS.customChuckRisers, JSON.stringify(updated));
    updateField("ndipChuckRiser", value);
    setAddingChuckRiser(false);
    setNewItemValue("");
  };

  // Get all transducer types (default + custom)
  const allTransducerTypes = [...transducerTypes, ...customTransducerTypes];

  // Get all wedge types (default + custom)
  const allWedgeTypes = [...defaultWedgeTypes, ...customWedgeTypes];
  const allChuckRiserOptions = [...V2500_CHUCK_RISER_OPTIONS, ...customChuckRisers];
  const availableWedgeTypes = useMemo(() => {
    const wedgeValues = includeCurrentOption(
      allWedgeTypes.map((wedge) => wedge.value),
      data.wedgeType,
    );

    return wedgeValues.map((value) => allWedgeTypes.find((wedge) => wedge.value === value) || { value, label: value });
  }, [allWedgeTypes, data.wedgeType]);

  // Get equipment parameters for current standard
  const equipmentParams = useMemo(() => {
    return equipmentParametersByStandard[standard];
  }, [standard]);

  // Get available frequencies for current standard
  const frequencies = useMemo(() => {
    return getFrequencyOptionsForStandard(standard);
  }, [standard]);

  // Get recommended frequency based on standard and thickness
  const recommendedFreq = useMemo(() => {
    return getRecommendedFrequencyForStandard(standard, partThickness);
  }, [standard, partThickness]);

  // Check if current frequency is valid for the standard
  const isFrequencyValid = useMemo(() => {
    if (!data.frequency) return true;
    return frequencies.includes(data.frequency);
  }, [data.frequency, frequencies]);

  const updateField = (field: keyof EquipmentData, value: any) => {
    onChange({ ...data, [field]: value });
  };

  const selectedTransducerTypes = useMemo(() => {
    if (Array.isArray(data.transducerTypes) && data.transducerTypes.length > 0) {
      return data.transducerTypes;
    }
    return (data.transducerType || "")
      .split(/[,+]/)
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean);
  }, [data.transducerType, data.transducerTypes]);

  const applyTransducerSelection = (selected: string[]) => {
    const normalized = Array.from(
      new Set(selected.map((value) => value.trim().toLowerCase()).filter(Boolean))
    );
    onChange({
      ...data,
      transducerTypes: normalized,
      transducerType: normalized.join(", "),
    });
  };

  const toggleTransducerType = (value: string) => {
    const current = selectedTransducerTypes;
    const updated = current.includes(value)
      ? current.filter((item) => item !== value)
      : [...current, value];
    applyTransducerSelection(updated);
  };

  const selectedTransducerShapes = useMemo(() => {
    return (data.transducerShapeAndSize || "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);
  }, [data.transducerShapeAndSize]);

  const applyTransducerShapeSelection = (selected: string[]) => {
    const normalized = Array.from(
      new Set(selected.map((value) => value.trim()).filter(Boolean))
    );
    onChange({
      ...data,
      transducerShapeAndSize: normalized.join(", "),
    });
  };

  const toggleTransducerShape = (value: string) => {
    const current = selectedTransducerShapes;
    const updated = current.includes(value)
      ? current.filter((item) => item !== value)
      : [...current, value];
    applyTransducerShapeSelection(updated);

    if (value === "active_element_diameter_3_8_to_1_inch" && !data.transducerDiameter) {
      updateField("transducerDiameter", 0.5);
    }
  };

  const selectedCouplantValue = useMemo(() => {
    if (data.customCouplant) return "Custom";
    if (!data.couplant) return "";
    return couplantOptions.includes(data.couplant) ? data.couplant : "Custom";
  }, [data.couplant, data.customCouplant]);

  // Warn if frequency is invalid for standard
  const showFrequencyWarning = !isFrequencyValid && data.frequency;

  return (
    <div className="space-y-2 p-2">
      {/* Frequency warning */}
      {showFrequencyWarning && (
        <div className="bg-warning/10 border border-warning/30 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-warning mt-0.5 flex-shrink-0" />
            <div>
              <h4 className="text-sm font-semibold text-foreground mb-1">Frequency Not Standard</h4>
              <p className="text-sm text-muted-foreground">
                The selected frequency ({data.frequency} MHz) is outside the typical range for {standard}.
                Recommended range: {equipmentParams.frequencyRange.min}-{equipmentParams.frequencyRange.max} MHz.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* BS EN 10228-4 specific note */}
      {standard === "BS-EN-10228-4" && (
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <Info className="h-5 w-5 text-blue-400 mt-0.5 flex-shrink-0" />
            <div>
              <h4 className="text-sm font-semibold text-foreground mb-2">Austenitic Material Requirements</h4>
              <ul className="text-sm text-muted-foreground space-y-1 list-disc ml-4">
                <li>Use lower frequencies (typically 0.5-2 MHz) due to coarse grain structure</li>
                <li>Standard nominal range is 0.5-6 MHz (select as low as practical for penetration)</li>
                <li>Larger probe diameter (20-30mm) preferred</li>
                <li>Consider dual-element probes for near-surface resolution</li>
                <li>{equipmentParams.notes}</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
        <FieldWithHelp
          label="Equipment Manufacturer"
          fieldKey="manufacturer"
          required
        >
          {isPwNdip ? (
            <Select
              value={data.manufacturer || undefined}
              onValueChange={(value) =>
                onChange({
                  ...data,
                  manufacturer: value,
                  model: NDIP_EQUIPMENT_BY_MANUFACTURER[value],
                })
              }
            >
              <SelectTrigger className="bg-background">
                <SelectValue placeholder="" />
              </SelectTrigger>
              <SelectContent>
                {Object.keys(NDIP_EQUIPMENT_BY_MANUFACTURER).map((manufacturer) => (
                  <SelectItem key={manufacturer} value={manufacturer}>
                    {manufacturer}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Input
              value={data.manufacturer}
              onChange={(e) => updateField("manufacturer", e.target.value)}
              className="bg-background"
            />
          )}
        </FieldWithHelp>

        <FieldWithHelp
          label="Equipment Model"
          fieldKey="manufacturer"
          required
        >
          <Input
            value={isPwNdip ? resolvedNdipModel : data.model}
            onChange={(e) => updateField("model", e.target.value)}
            className={isPwNdip ? "bg-muted/40" : "bg-background"}
            readOnly={isPwNdip}
          />
        </FieldWithHelp>

        <FieldWithHelp
          label="Serial Number"
          fieldKey="manufacturer"
        >
          <Input
            value={data.serialNumber}
            onChange={(e) => updateField("serialNumber", e.target.value)}
            className="bg-background"
          />
        </FieldWithHelp>

        <FieldWithHelp
          label="Software Version"
          fieldKey="manufacturer"
        >
          <Input
            value={data.softwareVersion || ""}
            onChange={(e) => updateField("softwareVersion", e.target.value)}
            className="bg-background"
          />
        </FieldWithHelp>


        <FieldWithHelp
          label={isPwNdip ? "Transducer Type" : "Transducer Type (multi-select)"}
          fieldKey="transducerType"
          required
        >
          {isPwNdip ? (
            <Input value="immersion" readOnly className="bg-muted/40" />
          ) : addingTransducer ? (
            <div className="flex gap-1">
              <Input
                value={newItemValue}
                onChange={(e) => setNewItemValue(e.target.value)}
                className="bg-background flex-1"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") addCustomTransducerType(newItemValue);
                  if (e.key === "Escape") {
                    setAddingTransducer(false);
                    setNewItemValue("");
                  }
                }}
              />
              <Button size="sm" onClick={() => addCustomTransducerType(newItemValue)} className="h-9">
                <Plus className="h-3 w-3" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setAddingTransducer(false);
                  setNewItemValue("");
                }}
                className="h-9"
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex flex-wrap gap-2">
                {allTransducerTypes.map((type) => {
                  const selected = selectedTransducerTypes.includes(type);
                  return (
                    <button
                      key={type}
                      type="button"
                      onClick={() => toggleTransducerType(type)}
                      className={`px-2 py-1 rounded border text-xs transition-colors ${
                        selected
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-background border-border hover:bg-muted/50"
                      }`}
                    >
                      {type.split("_").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")}
                    </button>
                  );
                })}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() => {
                    setAddingTransducer(true);
                    setNewItemValue("");
                  }}
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Add to list
                </Button>
              </div>
              {selectedTransducerTypes.length === 0 && (
                <p className="text-xs text-muted-foreground">Select one or more transducer types.</p>
              )}
            </div>
          )}
        </FieldWithHelp>

        {!isPwNdip && (
          <FieldWithHelp
            label="Transducer Shape and Size (multi-select)"
            fieldKey="transducerDiameter"
            help="Select one or more standard shape/size options"
            required
          >
            <div className="space-y-2">
              <div className="flex flex-wrap gap-2">
                {transducerShapeOptions.map((option) => {
                  const selected = selectedTransducerShapes.includes(option.value);
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => toggleTransducerShape(option.value)}
                      className={`px-2 py-1 rounded border text-xs transition-colors ${
                        selected
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-background border-border hover:bg-muted/50"
                      }`}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
              {selectedTransducerShapes.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  Select one or more transducer shape/size options.
                </p>
              )}
            </div>
          </FieldWithHelp>
        )}

        <FieldWithHelp
          label="Couplant Type"
          fieldKey="couplant"
          required
        >
          <div className="space-y-2">
            <Select
              value={selectedCouplantValue}
              onValueChange={(value) => {
                if (value === "Custom") {
                  updateField("couplant", data.customCouplant || "");
                } else {
                  onChange({
                    ...data,
                    couplant: value,
                    customCouplant: "",
                  });
                }
              }}
            >
              <SelectTrigger className="bg-background">
                <SelectValue placeholder="" />
              </SelectTrigger>
              <SelectContent>
                {couplantOptions.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedCouplantValue === "Custom" && (
              <Input
                value={data.customCouplant || data.couplant || ""}
                onChange={(e) =>
                  onChange({
                    ...data,
                    customCouplant: e.target.value,
                    couplant: e.target.value,
                  })
                }
                className="bg-background"
              />
            )}
          </div>
        </FieldWithHelp>

      </div>

      {isPwNdip && (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <Card className="border-blue-500/30 bg-blue-500/5 p-4">
            <div className="mb-3">
              <h4 className="text-sm font-semibold">Transducer</h4>
              <p className="text-xs text-muted-foreground">NDIP approved transducer configuration.</p>
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <FieldWithHelp label="P/N" fieldKey="transducerType">
                <div>
                  <Input value={PW_PRIMARY_TRANSDUCER.partNumber} readOnly className="bg-muted/40" />
                  <p className="mt-1 text-xs text-muted-foreground">Ref. 2.4.2</p>
                </div>
              </FieldWithHelp>
              <FieldWithHelp label="Frequency" fieldKey="transducerType">
                <Input value={`${PW_PRIMARY_TRANSDUCER.frequency} MHZ`} readOnly className="bg-muted/40" />
              </FieldWithHelp>
              <FieldWithHelp label="Focus" fieldKey="transducerType">
                <Input value={`${PW_PRIMARY_TRANSDUCER.focalLength}''`} readOnly className="bg-muted/40" />
              </FieldWithHelp>
              <FieldWithHelp label="Bandwidth" fieldKey="transducerType">
                <Input value={PW_PRIMARY_TRANSDUCER.bandwidth} readOnly className="bg-muted/40" />
              </FieldWithHelp>
              <FieldWithHelp label="Serial Number" fieldKey="transducerType">
                <Input
                  value={data.ndipTransducerSerialNumber || ""}
                  onChange={(e) => updateField("ndipTransducerSerialNumber", e.target.value)}
                  className="bg-background"
                />
              </FieldWithHelp>
            </div>
          </Card>

          <Card className="border-emerald-500/30 bg-emerald-500/5 p-4">
            <div className="mb-3">
              <h4 className="text-sm font-semibold">Transducer Mirror</h4>
              <p className="text-xs text-muted-foreground">Fixed 45-degree mirror assembly for the NDIP setup.</p>
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <FieldWithHelp label="P/N" fieldKey="transducerType">
                <Input value={PW_45_DEGREE_MIRROR.partNumber} readOnly className="bg-muted/40" />
              </FieldWithHelp>
              <FieldWithHelp label="Serial Number" fieldKey="transducerType">
                <Input
                  value={data.ndipMirrorSerialNumber || ""}
                  onChange={(e) => updateField("ndipMirrorSerialNumber", e.target.value)}
                  className="bg-background"
                />
              </FieldWithHelp>
              <FieldWithHelp label="Mirror Angle" fieldKey="transducerType">
                <Input value={`${PW_45_DEGREE_MIRROR.angle} degrees`} readOnly className="bg-muted/40" />
              </FieldWithHelp>
              <FieldWithHelp label="Length" fieldKey="transducerType">
                <Input value={`${PW_45_DEGREE_MIRROR.length}''`} readOnly className="bg-muted/40" />
              </FieldWithHelp>
            </div>
          </Card>

          <Card className="border-amber-500/30 bg-amber-500/5 p-4">
            <div className="mb-3">
              <h4 className="text-sm font-semibold">Handling / Marking</h4>
              <p className="text-xs text-muted-foreground">NDIP handling and consumable items.</p>
            </div>
            <div className="grid grid-cols-1 gap-3">
              <FieldWithHelp label="Chuck Riser" fieldKey="manufacturer">
                {addingChuckRiser ? (
                  <div className="space-y-2">
                    <div className="flex gap-1">
                      <Input
                        value={newItemValue}
                        onChange={(e) => setNewItemValue(e.target.value)}
                        className="bg-background flex-1"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === "Enter") addCustomChuckRiser(newItemValue);
                          if (e.key === "Escape") {
                            setAddingChuckRiser(false);
                            setNewItemValue("");
                          }
                        }}
                      />
                      <Button size="sm" onClick={() => addCustomChuckRiser(newItemValue)} className="h-9">
                        <Plus className="h-3 w-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setAddingChuckRiser(false);
                          setNewItemValue("");
                        }}
                        className="h-9"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">Ref. 2.6.1</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Select
                      value={data.ndipChuckRiser || ""}
                      onValueChange={(value) => updateField("ndipChuckRiser", value)}
                    >
                      <SelectTrigger className="bg-background">
                        <SelectValue placeholder="" />
                      </SelectTrigger>
                      <SelectContent>
                        {allChuckRiserOptions.map((option) => (
                          <SelectItem key={option} value={option}>
                            {option}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs text-muted-foreground">Ref. 2.6.1, using options from 2.8 / 2.9</p>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={() => {
                          setAddingChuckRiser(true);
                          setNewItemValue("");
                        }}
                      >
                        <Plus className="mr-1 h-3 w-3" />
                        Add to list
                      </Button>
                    </div>
                  </div>
                )}
              </FieldWithHelp>

              <FieldWithHelp label="Marking Pencil" fieldKey="manufacturer">
                <Input value={data.ndipMarkingPencil || V2500_MARKING_PENCIL} readOnly className="bg-muted/40" />
              </FieldWithHelp>
            </div>
          </Card>

          <Card className="border-violet-500/30 bg-violet-500/5 p-4">
            <div className="mb-3">
              <h4 className="text-sm font-semibold">Calibration Block</h4>
              <p className="text-xs text-muted-foreground">Standard part number, serial tracking, and holder.</p>
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <FieldWithHelp label="P/N" fieldKey="manufacturer">
                <Input value={V2500_CALIBRATION_BLOCK_PART_NUMBER} readOnly className="bg-muted/40" />
              </FieldWithHelp>
              <FieldWithHelp label="Serial Number" fieldKey="manufacturer">
                <Input
                  value={calibrationData?.blockSerialNumber || ""}
                  onChange={(e) =>
                    onCalibrationChange?.({
                      ...(calibrationData || {
                        standardType: "",
                        referenceMaterial: "",
                        fbhSizes: "",
                        metalTravelDistance: 0,
                        blockDimensions: "",
                        blockDimensionsMode: "flat",
                        blockSerialNumber: "",
                        blockHolder: V2500_CALIBRATION_BLOCK_HOLDER,
                        lastCalibrationDate: "",
                      }),
                      blockSerialNumber: e.target.value,
                      blockHolder: V2500_CALIBRATION_BLOCK_HOLDER,
                    })
                  }
                  className="bg-background"
                />
              </FieldWithHelp>
              <FieldWithHelp label="Holder" fieldKey="manufacturer">
                <Input
                  value={calibrationData?.blockHolder || V2500_CALIBRATION_BLOCK_HOLDER}
                  readOnly
                  className="bg-muted/40 md:col-span-2"
                />
              </FieldWithHelp>
            </div>
          </Card>
        </div>
      )}

      {/* Phased Array Settings Section (Collapsible) */}
      {!isPwNdip && (
      <div className="border border-purple-500/30 rounded-lg overflow-hidden bg-purple-500/5">
        <button
          type="button"
          onClick={() => setShowPASection(!showPASection)}
          className="w-full bg-purple-500/10 px-4 py-2 border-b border-purple-500/30 flex items-center justify-between hover:bg-purple-500/20 transition-colors cursor-pointer"
        >
          <div className="text-left">
            <h4 className="text-sm font-semibold">Phased Array Settings</h4>
            <p className="text-xs text-muted-foreground mt-1">Fill in if using Phased Array equipment</p>
          </div>
          {showPASection ? (
            <ChevronDown className="h-5 w-5 text-purple-400" />
          ) : (
            <ChevronRight className="h-5 w-5 text-purple-400" />
          )}
        </button>
        {showPASection && (
          <div className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <FieldWithHelp
                label="Number of Elements"
                fieldKey="manufacturer"
                help="Total number of elements in the PA probe (e.g., 32, 64, 128)"
              >
                <div className="flex gap-2">
                  <div className="flex items-center gap-1 border rounded px-2 bg-muted/50">
                    <label className="flex items-center gap-1 cursor-pointer text-xs">
                      <input
                        type="radio"
                        name="numberOfElements_an"
                        checked={data.numberOfElementsApplicable !== false}
                        onChange={() => updateField("numberOfElementsApplicable", true)}
                        className="w-3 h-3"
                      />
                      A
                    </label>
                    <label className="flex items-center gap-1 cursor-pointer text-xs">
                      <input
                        type="radio"
                        name="numberOfElements_an"
                        checked={data.numberOfElementsApplicable === false}
                        onChange={() => updateField("numberOfElementsApplicable", false)}
                        className="w-3 h-3"
                      />
                      N
                    </label>
                  </div>
                  <Input
                    type="number"
                    value={data.numberOfElements ?? ''}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (value === '' || value === null) {
                        updateField("numberOfElements", undefined);
                        return;
                      }
                      const numValue = parseInt(value, 10);
                      if (!isNaN(numValue)) {
                        updateField("numberOfElements", numValue);
                      }
                    }}
                    min={1}
                    max={256}
                    step={1}
                    className="bg-background flex-1"
                    disabled={data.numberOfElementsApplicable === false}
                  />
                </div>
              </FieldWithHelp>

              <FieldWithHelp
                label="Element Pitch (mm)"
                fieldKey="manufacturer"
                help="Distance between adjacent elements in mm"
              >
                <div className="flex gap-2">
                  <div className="flex items-center gap-1 border rounded px-2 bg-muted/50">
                    <label className="flex items-center gap-1 cursor-pointer text-xs">
                      <input
                        type="radio"
                        name="elementPitch_an"
                        checked={data.elementPitchApplicable !== false}
                        onChange={() => updateField("elementPitchApplicable", true)}
                        className="w-3 h-3"
                      />
                      A
                    </label>
                    <label className="flex items-center gap-1 cursor-pointer text-xs">
                      <input
                        type="radio"
                        name="elementPitch_an"
                        checked={data.elementPitchApplicable === false}
                        onChange={() => updateField("elementPitchApplicable", false)}
                        className="w-3 h-3"
                      />
                      N
                    </label>
                  </div>
                  <Input
                    type="number"
                    value={data.elementPitch ?? ''}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (value === '' || value === null) {
                        updateField("elementPitch", undefined);
                        return;
                      }
                      const numValue = parseFloat(value);
                      if (!isNaN(numValue)) {
                        updateField("elementPitch", numValue);
                      }
                    }}
                    min={0.1}
                    max={5}
                    step={0.01}
                    className="bg-background flex-1"
                    disabled={data.elementPitchApplicable === false}
                  />
                </div>
              </FieldWithHelp>

              <FieldWithHelp
                label="Wedge Model"
                fieldKey="manufacturer"
                help="Wedge/shoe model identifier"
              >
                <div className="flex gap-2">
                  <div className="flex items-center gap-1 border rounded px-2 bg-muted/50">
                    <label className="flex items-center gap-1 cursor-pointer text-xs">
                      <input
                        type="radio"
                        name="wedgeModel_an"
                        checked={data.wedgeModelApplicable !== false}
                        onChange={() => updateField("wedgeModelApplicable", true)}
                        className="w-3 h-3"
                      />
                      A
                    </label>
                    <label className="flex items-center gap-1 cursor-pointer text-xs">
                      <input
                        type="radio"
                        name="wedgeModel_an"
                        checked={data.wedgeModelApplicable === false}
                        onChange={() => updateField("wedgeModelApplicable", false)}
                        className="w-3 h-3"
                      />
                      N
                    </label>
                  </div>
                  <Input
                    value={data.wedgeModel || ""}
                    onChange={(e) => updateField("wedgeModel", e.target.value)}
                    className="bg-background flex-1"
                    disabled={data.wedgeModelApplicable === false}
                  />
                </div>
              </FieldWithHelp>

              <FieldWithHelp
                label="Wedge Type"
                fieldKey="manufacturer"
                help="Type of wedge (Normal, Angled, Immersion)"
              >
                <div className="flex gap-2">
                  <div className="flex items-center gap-1 border rounded px-2 bg-muted/50">
                    <label className="flex items-center gap-1 cursor-pointer text-xs">
                      <input
                        type="radio"
                        name="wedgeType_an"
                        checked={data.wedgeTypeApplicable !== false}
                        onChange={() => updateField("wedgeTypeApplicable", true)}
                        className="w-3 h-3"
                      />
                      A
                    </label>
                    <label className="flex items-center gap-1 cursor-pointer text-xs">
                      <input
                        type="radio"
                        name="wedgeType_an"
                        checked={data.wedgeTypeApplicable === false}
                        onChange={() => updateField("wedgeTypeApplicable", false)}
                        className="w-3 h-3"
                      />
                      N
                    </label>
                  </div>
                  {addingWedge ? (
                    <div className="flex gap-1 flex-1">
                      <Input
                        value={newItemValue}
                        onChange={(e) => setNewItemValue(e.target.value)}
                        className="bg-background flex-1"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') addCustomWedgeType(newItemValue);
                          if (e.key === 'Escape') { setAddingWedge(false); setNewItemValue(""); }
                        }}
                      />
                      <Button size="sm" onClick={() => addCustomWedgeType(newItemValue)} className="h-9">
                        <Plus className="h-3 w-3" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => { setAddingWedge(false); setNewItemValue(""); }} className="h-9">
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ) : (
                    <Select
                      value={data.wedgeType || ""}
                      onValueChange={(value) => {
                        if (value === "__add_new__") {
                          setAddingWedge(true);
                          setNewItemValue("");
                        } else {
                          updateField("wedgeType", value);
                        }
                      }}
                      disabled={data.wedgeTypeApplicable === false}
                    >
                      <SelectTrigger className="bg-background flex-1">
                        <SelectValue placeholder="" />
                      </SelectTrigger>
                      <SelectContent className="max-h-[300px]">
                        {availableWedgeTypes.map((wedge) => (
                          <SelectItem key={wedge.value} value={wedge.value}>
                            {wedge.label}
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
                </div>
              </FieldWithHelp>

              <FieldWithHelp
                label="Delay Line"
                fieldKey="manufacturer"
                help="Delay line specification if applicable"
              >
                <div className="flex gap-2">
                  <div className="flex items-center gap-1 border rounded px-2 bg-muted/50">
                    <label className="flex items-center gap-1 cursor-pointer text-xs">
                      <input
                        type="radio"
                        name="delayLine_an"
                        checked={data.delayLineApplicable !== false}
                        onChange={() => updateField("delayLineApplicable", true)}
                        className="w-3 h-3"
                      />
                      A
                    </label>
                    <label className="flex items-center gap-1 cursor-pointer text-xs">
                      <input
                        type="radio"
                        name="delayLine_an"
                        checked={data.delayLineApplicable === false}
                        onChange={() => updateField("delayLineApplicable", false)}
                        className="w-3 h-3"
                      />
                      N
                    </label>
                  </div>
                  <Input
                    value={data.delayLine || ""}
                    onChange={(e) => updateField("delayLine", e.target.value)}
                    className="bg-background flex-1"
                    disabled={data.delayLineApplicable === false}
                  />
                </div>
              </FieldWithHelp>
            </div>
          </div>
        )}
      </div>
      )}

      {/* Equipment Requirements Summary - Shows only current standard */}
      <div className="border border-border rounded-lg overflow-hidden">
        <div className="bg-muted/50 px-4 py-2 border-b border-border">
          <h4 className="text-sm font-semibold">Equipment Requirements for {standard}</h4>
        </div>
        <div className="p-4">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="bg-primary/5 rounded-lg p-3">
              <div className="text-xs text-muted-foreground mb-1">Frequency Range</div>
              <div className="font-semibold text-sm">
                {equipmentParams.frequencyRange.min}-{equipmentParams.frequencyRange.max} MHz
              </div>
            </div>
            <div className="bg-primary/5 rounded-lg p-3">
              <div className="text-xs text-muted-foreground mb-1">Reference</div>
              <div className="font-semibold text-sm">
                {getStandardLabel(standard)}
              </div>
            </div>
            <div className="hidden">
              <div className="text-xs text-muted-foreground mb-1">Horizontal Linearity</div>
              <div className="font-semibold text-sm">
                {equipmentParams.horizontalLinearity ? `≥${equipmentParams.horizontalLinearity.min}%` : 'N/A'}
              </div>
            </div>
            <div className="bg-primary/5 rounded-lg p-3">
              <div className="text-xs text-muted-foreground mb-1">Probe Diameter</div>
              <div className="font-semibold text-sm">
                {equipmentParams.transducerDiameter.min}-{equipmentParams.transducerDiameter.max} {equipmentParams.transducerDiameter.unit}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Reference note */}
      <div className="bg-muted/30 border border-border rounded-lg p-4">
        <p className="text-xs text-muted-foreground">
          <strong>Note:</strong> {equipmentParams.notes}
          {equipmentParams.frequencyTolerance && ` Frequency tolerance: ${equipmentParams.frequencyTolerance}.`}
          {equipmentParams.prfRange && ` PRF range: ${equipmentParams.prfRange}.`}
        </p>
        <div className="mt-3 space-y-2">
          <label className="flex items-center gap-2 text-xs text-foreground cursor-pointer">
            <Checkbox
              checked={!!data.includeSelectionNotesInReport}
              onCheckedChange={(checked) => updateField("includeSelectionNotesInReport", checked === true)}
            />
            Include equipment selection notes in exported report
          </label>
          {data.includeSelectionNotesInReport && (
            <Textarea
              value={data.selectionNotes || ""}
              onChange={(e) => updateField("selectionNotes", e.target.value)}
              rows={3}
              className="bg-background"
            />
          )}
        </div>
      </div>
    </div>
  );
};
