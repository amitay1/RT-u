// @ts-nocheck
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { ScanParametersData, StandardType, PhasedArraySettings, EquipmentData } from "@/types/techniqueSheet";
import { FieldWithHelp } from "@/components/FieldWithHelp";
import { Info, Radio, Sparkles } from "lucide-react";
import { useMemo, useEffect, useState, useCallback } from "react";
import {
  scanParametersByStandard,
  calibrationByStandard,
} from "@/data/standardsDifferences";
import { includeCurrentOption } from "@/utils/selectOptions";
import { calculateWaterPath } from "@/utils/waterPathCalculator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";

interface ScanParametersTabProps {
  data: ScanParametersData;
  onChange: (data: ScanParametersData) => void;
  standard: StandardType;
  equipmentFrequency?: string;
  onEquipmentFrequencyChange?: (frequency: string) => void;
  equipmentData?: EquipmentData;
  onEquipmentDataChange?: (data: EquipmentData) => void;
  /** Part thickness from Inspection Setup tab (mm) */
  partThickness?: number;
  /** Material acoustic velocity from Inspection Setup tab (m/s) */
  materialVelocity?: number;
}

// Get standard label
const getStandardLabel = (standard: StandardType): string => {
  const labels: Record<StandardType, string> = {
    "MIL-STD-2154": "MIL-STD-2154",
    "AMS-STD-2154E": "AMS-STD-2154E",
    "ASTM-A388": "ASTM A388/A388M",
    "ASTM-E1001": "ASTM E1001",
    "ASTM-E2580": "ASTM E2580",
    "ASTM-E588": "ASTM E588",
    "AMS-2630": "AMS 2630",
    "BS-EN-10228-3": "BS EN 10228-3:2016",
    "BS-EN-10228-4": "BS EN 10228-4:2016",
  };
  return labels[standard] || standard;
};

export const ScanParametersTab = ({ data, onChange, standard = "AMS-STD-2154E", equipmentFrequency, onEquipmentFrequencyChange, equipmentData, onEquipmentDataChange, partThickness, materialVelocity }: ScanParametersTabProps) => {
  void equipmentFrequency;
  void onEquipmentFrequencyChange;
  void equipmentData;
  void onEquipmentDataChange;

  // Track whether user has manually overridden the water path
  const [waterPathManualOverride, setWaterPathManualOverride] = useState(false);
  // Store the auto-calculated reasoning for the tooltip
  const [waterPathReasoning, setWaterPathReasoning] = useState<string | null>(null);

  // Get scan parameters for current standard with fallback
  const scanParams = useMemo(() => {
    return scanParametersByStandard[standard] || scanParametersByStandard["AMS-STD-2154E"];
  }, [standard]);

  // Get calibration requirements for current standard with fallback
  const calibParams = useMemo(() => {
    return calibrationByStandard[standard] || calibrationByStandard["AMS-STD-2154E"];
  }, [standard]);

  // Get max speed based on scan type and standard
  const maxSpeed = useMemo(() => {
    if (data.scanType === "manual" || data.scanType === "semi_automated") {
      return scanParams.maxSpeedManual.value;
    }
    return scanParams.maxSpeedAutomated.value;
  }, [data.scanType, scanParams]);
  const hasSpeedLimit = maxSpeed > 0;
  const hasOverlapRequirement = scanParams.minOverlap > 0;

  // Check compliance
  const compliance = useMemo(() => {
    const speedOk = !hasSpeedLimit || data.scanSpeed <= maxSpeed;
    const overlapOk = !hasOverlapRequirement || (100 - data.scanIndex) >= scanParams.minOverlap;
    const coverageOk = data.coverage >= scanParams.coverageRequired;
    const coverageAccepted = data.coverage >= 85; // 85% acceptance threshold

    return { speedOk, overlapOk, coverageOk, coverageAccepted };
  }, [data.scanSpeed, data.scanIndex, data.coverage, hasSpeedLimit, hasOverlapRequirement, maxSpeed, scanParams]);

  const updateField = (field: keyof ScanParametersData, value: any) => {
    onChange({ ...data, [field]: value });
  };

  // Update defaults when standard changes
  useEffect(() => {
    // Set default overlap based on standard if current value is too low
    const requiredOverlap = scanParams.minOverlap;
    if (requiredOverlap <= 0) {
      return;
    }
    const currentOverlap = 100 - data.scanIndex;

    if (currentOverlap < requiredOverlap) {
      const newIndex = 100 - requiredOverlap;
      updateField("scanIndex", newIndex);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [standard]);

  // Hidden per UI request in Scan Parameters
  const showPhasedArray = false;
  const isPwNdip = standard === "NDIP-1226" || standard === "NDIP-1227";
  // Show bubbler fields when bubbler technique is selected
  const showBubblerFields = !isPwNdip && data.technique === "bubbler";
  const isAustenitic = standard === "BS-EN-10228-4";
  const scanSpeedPresets = [50, 100, 150, 200, 300];
  const selectedSpeedPreset = scanSpeedPresets.includes(Number(data.scanSpeed))
    ? String(Number(data.scanSpeed))
    : "custom";
  const availableScanTypes = useMemo(
    () => includeCurrentOption(["manual", "semi_automated", "fully_automated"], data.scanType),
    [data.scanType],
  );
  const availableScanPatterns = useMemo(
    () => includeCurrentOption(["raster", "bidirectional", "spiral", "helical", "custom"], data.scanPattern),
    [data.scanPattern],
  );

  const prfRecommendationTable = useMemo(
    () => [
      { maxScanSpeed: 50, probe1InchPrf: 100, probeHalfInchPrf: 200 },
      { maxScanSpeed: 100, probe1InchPrf: 200, probeHalfInchPrf: 400 },
      { maxScanSpeed: 150, probe1InchPrf: 300, probeHalfInchPrf: 600 },
      { maxScanSpeed: 200, probe1InchPrf: 400, probeHalfInchPrf: 800 },
      { maxScanSpeed: 300, probe1InchPrf: 600, probeHalfInchPrf: 1200 },
    ],
    [],
  );

  const recommendedPrfRow = useMemo(() => {
    const speed = Number(data.scanSpeed) || 0;
    return prfRecommendationTable.find((row) => speed <= row.maxScanSpeed) || null;
  }, [data.scanSpeed, prfRecommendationTable]);

  useEffect(() => {
    if (!isPwNdip) {
      return;
    }

    const nextScanMethods = ["immersion"];
    const needsNormalization =
      data.scanMethod !== "immersion" ||
      data.technique !== "conventional" ||
      JSON.stringify(data.scanMethods || []) !== JSON.stringify(nextScanMethods);

    if (!needsNormalization) {
      return;
    }

    onChange({
      ...data,
      scanMethod: "immersion",
      scanMethods: nextScanMethods,
      technique: "conventional",
    });
  }, [data, isPwNdip, onChange]);

  // Auto-calculate water path when immersion is selected and inputs are available
  const isImmersion = (data.scanMethods || []).includes("immersion");
  const autoWaterPath = useMemo(() => {
    if (!isImmersion) return null;
    const freq = equipmentData?.frequency ? parseFloat(equipmentData.frequency) : 0;
    const diameter = equipmentData?.transducerDiameter ?? 0;
    const thickness = partThickness ?? 0;
    return calculateWaterPath({
      transducerDiameter: diameter,
      frequency: freq,
      partThickness: thickness,
      materialVelocity,
    });
  }, [isImmersion, equipmentData?.frequency, equipmentData?.transducerDiameter, partThickness, materialVelocity]);

  // Apply auto-calculated water path when inputs change (unless user overrode manually)
  useEffect(() => {
    if (!autoWaterPath || waterPathManualOverride) return;
    if (autoWaterPath.recommended !== data.waterPath) {
      updateField("waterPath", autoWaterPath.recommended);
      setWaterPathReasoning(autoWaterPath.reasoning);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoWaterPath?.recommended, waterPathManualOverride]);

  // Reset manual override flag when key inputs change so auto-calc re-applies
  useEffect(() => {
    setWaterPathManualOverride(false);
  }, [equipmentData?.frequency, equipmentData?.transducerDiameter, partThickness]);

  // Handler for manual water path change (sets the override flag)
  const handleManualWaterPathChange = useCallback((value: string) => {
    if (value === '' || value === null) {
      updateField("waterPath", undefined);
      setWaterPathManualOverride(true);
      setWaterPathReasoning(null);
      return;
    }
    const numValue = parseFloat(value);
    if (!isNaN(numValue)) {
      updateField("waterPath", numValue);
      setWaterPathManualOverride(true);
      setWaterPathReasoning(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep phased array field updaters intact while the UI is hidden.
  const updatePhasedArrayField = (field: keyof PhasedArraySettings, value: unknown) => {
    onChange({
      ...data,
      phasedArray: {
        ...data.phasedArray,
        [field]: value,
      },
    });
  };

  const updatePhasedArrayScanType = (scanType: 'sScan' | 'linearScan' | 'compoundScan', checked: boolean) => {
    onChange({
      ...data,
      phasedArray: {
        ...data.phasedArray,
        scanTypes: {
          ...data.phasedArray?.scanTypes,
          [scanType]: checked,
        },
      },
    });
  };

  return (
    <div className="space-y-2 p-2">
      {/* Austenitic specific note */}
      {isAustenitic && (
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <Info className="h-5 w-5 text-blue-400 mt-0.5 flex-shrink-0" />
            <div>
              <h4 className="text-sm font-semibold text-foreground mb-2">Austenitic Material Scan Requirements</h4>
              <ul className="text-sm text-muted-foreground space-y-1 list-disc ml-4">
                <li>Lower scan speeds required due to beam distortion</li>
                <li>Higher overlap (20% minimum) to compensate for beam spread</li>
                <li>Record actual scan paths in documentation</li>
                <li>Orthogonal grid pattern recommended</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Scan Method - Multi-select buttons */}
      <div className="bg-blue-500/5 border border-blue-500/20 rounded-lg p-2 mb-2">
        <Label className="text-sm font-semibold mb-1.5 block">Scan Method</Label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              if (isPwNdip) {
                onChange({
                  ...data,
                  scanMethods: ["immersion"],
                  scanMethod: "immersion",
                });
                return;
              }
              const current = data.scanMethods || [];
              const newMethods = current.includes('immersion')
                ? current.filter(m => m !== 'immersion')
                : [...current, 'immersion'];
              onChange({
                ...data,
                scanMethods: newMethods,
                scanMethod: newMethods.length > 0 ? newMethods[0] : data.scanMethod
              });
            }}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all border ${
              (data.scanMethods || []).includes('immersion')
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-gray-100 hover:bg-gray-200 text-gray-800 border-gray-300 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600 dark:hover:bg-gray-600'
            }`}
          >
            IMMERSION
          </button>
          {!isPwNdip && (
            <button
              type="button"
              onClick={() => {
                const current = data.scanMethods || [];
                const newMethods = current.includes('contact')
                  ? current.filter(m => m !== 'contact')
                  : [...current, 'contact'];
                onChange({
                  ...data,
                  scanMethods: newMethods,
                  scanMethod: newMethods.length > 0 ? newMethods[0] : data.scanMethod
                });
              }}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all border ${
                (data.scanMethods || []).includes('contact')
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-gray-100 hover:bg-gray-200 text-gray-800 border-gray-300 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600 dark:hover:bg-gray-600'
              }`}
            >
              CONTACT
            </button>
          )}
        </div>
        {(data.scanMethods || []).length === 0 && (
          <p className="text-xs text-muted-foreground mt-1">Select one or more scan methods</p>
        )}
      </div>

      {/* Technique Selection */}
      <div className="bg-purple-500/5 border border-purple-500/20 rounded-lg p-2 mb-2">
        <Label className="text-sm font-semibold mb-1.5 block">Technique</Label>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => updateField("technique", "conventional")}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
              data.technique === 'conventional'
                ? 'bg-purple-600 text-white'
                : 'bg-muted hover:bg-muted/80 text-foreground'
            }`}
          >
            Conventional
          </button>
          {!isPwNdip && (
            <>
              <button
                type="button"
                onClick={() => updateField("technique", "bubbler")}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
                  data.technique === 'bubbler'
                    ? 'bg-purple-600 text-white'
                    : 'bg-muted hover:bg-muted/80 text-foreground'
                }`}
              >
                Bubbler
              </button>
              <button
                type="button"
                onClick={() => updateField("technique", "squirter")}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
                  data.technique === 'squirter'
                    ? 'bg-purple-600 text-white'
                    : 'bg-muted hover:bg-muted/80 text-foreground'
                }`}
              >
                Squirter
              </button>
              <button
                type="button"
                onClick={() => updateField("technique", "phased_array")}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
                  data.technique === 'phased_array'
                    ? 'bg-purple-600 text-white'
                    : 'bg-muted hover:bg-muted/80 text-foreground'
                }`}
              >
                Phased Array
              </button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">

        <FieldWithHelp
          label="Scan Type"
          fieldKey="scanMethod"
          required
        >
          <Select
            value={data.scanType}
            onValueChange={(value) => updateField("scanType", value)}
          >
            <SelectTrigger className="bg-background">
              <SelectValue placeholder="" />
            </SelectTrigger>
            <SelectContent className="bg-popover z-50">
              {availableScanTypes.map((option) => {
                if (option === "manual") {
                  return (
                    <SelectItem key={option} value={option}>
                      Manual (
                      {scanParams.maxSpeedManual.value > 0
                        ? `max ${scanParams.maxSpeedManual.value} ${scanParams.maxSpeedManual.unit}`
                        : "speed not specified by standard"}
                      )
                    </SelectItem>
                  );
                }

                if (option === "semi_automated") {
                  return (
                    <SelectItem key={option} value={option}>
                      Semi-Automated (
                      {scanParams.maxSpeedManual.value > 0
                        ? `max ${scanParams.maxSpeedManual.value} ${scanParams.maxSpeedManual.unit}`
                        : "speed not specified by standard"}
                      )
                    </SelectItem>
                  );
                }

                if (option === "fully_automated") {
                  return (
                    <SelectItem key={option} value={option}>
                      Fully Automated (
                      {scanParams.maxSpeedAutomated.value > 0
                        ? `max ${scanParams.maxSpeedAutomated.value} ${scanParams.maxSpeedAutomated.unit}`
                        : "speed not specified by standard"}
                      )
                    </SelectItem>
                  );
                }

                return (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </FieldWithHelp>


        {/* Bubbler Settings - Only when Bubbler is selected */}
        {showBubblerFields && (
          <div className="md:col-span-2">
            <Card className="p-4 border-blue-500/30 bg-blue-500/5">
              <div className="flex items-center gap-2 mb-3">
                <Info className="h-4 w-4 text-blue-400" />
                <Label className="text-sm font-semibold">Bubbler Settings</Label>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FieldWithHelp
                  label="Water Path (mm)"
                  fieldKey="waterPath"
                  help="Distance from transducer face to part surface through water column"
                >
                  <div className="space-y-1">
                    <Input
                      type="number"
                      value={data.waterPath ?? ''}
                      onChange={(e) => handleManualWaterPathChange(e.target.value)}
                      min={0}
                      step={0.1}
                      className="bg-background"
                    />
                    {autoWaterPath && !waterPathManualOverride && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Badge variant="outline" className="text-xs border-amber-500/50 text-amber-400 gap-1 cursor-help">
                              <Sparkles className="h-3 w-3" /> Auto-Calculated
                            </Badge>
                          </TooltipTrigger>
                          <TooltipContent side="bottom" className="max-w-xs">
                            <p className="text-xs">{waterPathReasoning}</p>
                            <p className="text-xs text-muted-foreground mt-1">Range: {autoWaterPath.min}–{autoWaterPath.max}mm</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                  </div>
                </FieldWithHelp>
              </div>
            </Card>
          </div>
        )}

        {/* Phased Array Settings - Only when PA is selected */}
        {showPhasedArray && (
          <div className="md:col-span-2">
            <Card className="p-4 border-purple-500/30 bg-purple-500/5">
              <div className="flex items-center gap-2 mb-3">
                <Radio className="h-4 w-4 text-purple-400" />
                <Label className="text-sm font-semibold">Phased Array Settings</Label>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Refracted Angle Range */}
                <FieldWithHelp
                  label="Refracted Angle Start (°)"
                  fieldKey="scanMethod"
                  help="Starting angle for sector scan"
                >
                  <Input
                    type="number"
                    value={data.phasedArray?.refractedAngleStart ?? ''}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (value === '' || value === null) {
                        updatePhasedArrayField("refractedAngleStart", undefined);
                        return;
                      }
                      const numValue = parseFloat(value);
                      if (!isNaN(numValue)) {
                        updatePhasedArrayField("refractedAngleStart", numValue);
                      }
                    }}
                    min={0}
                    max={90}
                    step={1}
                    className="bg-background"
                  />
                </FieldWithHelp>

                <FieldWithHelp
                  label="Refracted Angle End (°)"
                  fieldKey="scanMethod"
                  help="Ending angle for sector scan"
                >
                  <Input
                    type="number"
                    value={data.phasedArray?.refractedAngleEnd ?? ''}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (value === '' || value === null) {
                        updatePhasedArrayField("refractedAngleEnd", undefined);
                        return;
                      }
                      const numValue = parseFloat(value);
                      if (!isNaN(numValue)) {
                        updatePhasedArrayField("refractedAngleEnd", numValue);
                      }
                    }}
                    min={0}
                    max={90}
                    step={1}
                    className="bg-background"
                  />
                </FieldWithHelp>

                <FieldWithHelp
                  label="Aperture (Active Elements)"
                  fieldKey="scanMethod"
                  help="Number of active elements used in the phased array setup"
                >
                  <Input
                    type="number"
                    value={data.phasedArray?.aperture ?? ''}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (value === '' || value === null) {
                        updatePhasedArrayField("aperture", undefined);
                        return;
                      }
                      const numValue = parseInt(value, 10);
                      if (!isNaN(numValue)) {
                        updatePhasedArrayField("aperture", numValue);
                      }
                    }}
                    min={1}
                    max={128}
                    step={1}
                    className="bg-background"
                  />
                </FieldWithHelp>

                <FieldWithHelp
                  label="Phased Array"
                  fieldKey="scanMethod"
                  help="Phased array configuration description"
                >
                  <Input
                    value={data.phasedArray?.focusLaws ?? ''}
                    onChange={(e) => updatePhasedArrayField("focusLaws", e.target.value)}
                    className="bg-background"
                  />
                </FieldWithHelp>
              </div>

              {/* Scan Types */}
              <div className="mt-4">
                <Label className="text-sm font-medium mb-2 block">Scan Types Used</Label>
                <div className="flex flex-wrap gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={data.phasedArray?.scanTypes?.sScan ?? false}
                      onCheckedChange={(checked) => updatePhasedArrayScanType("sScan", checked as boolean)}
                    />
                    <span className="text-sm">S-Scan (Sectorial)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={data.phasedArray?.scanTypes?.linearScan ?? false}
                      onCheckedChange={(checked) => updatePhasedArrayScanType("linearScan", checked as boolean)}
                    />
                    <span className="text-sm">Linear Scan (E-Scan)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={data.phasedArray?.scanTypes?.compoundScan ?? false}
                      onCheckedChange={(checked) => updatePhasedArrayScanType("compoundScan", checked as boolean)}
                    />
                    <span className="text-sm">Compound Scan</span>
                  </label>
                </div>
              </div>
            </Card>
          </div>
        )}

        <FieldWithHelp
          label={`Scan Speed (${scanParams.maxSpeedManual.unit})`}
          fieldKey="scanSpeed"
          help={
            hasSpeedLimit
              ? `Per ${standard}: Max ${maxSpeed} ${scanParams.maxSpeedManual.unit} for ${data.scanType || "manual"}`
              : `Per ${standard}: speed limit is not explicitly specified. Control scan quality via increment/index limits and system capability.`
          }
          required
        >
          <div className="space-y-2">
            <Select
              value={selectedSpeedPreset}
              onValueChange={(value) => {
                if (value === "custom") {
                  if (scanSpeedPresets.includes(Number(data.scanSpeed))) {
                    updateField("scanSpeed", 0);
                  }
                  return;
                }
                updateField("scanSpeed", Number(value));
              }}
            >
              <SelectTrigger className="bg-background">
                <SelectValue placeholder="" />
              </SelectTrigger>
              <SelectContent className="bg-popover z-50">
                {scanSpeedPresets.map((speed) => (
                  <SelectItem key={speed} value={String(speed)}>
                    {speed}
                  </SelectItem>
                ))}
                <SelectItem value="custom">Custom</SelectItem>
              </SelectContent>
            </Select>

            {selectedSpeedPreset === "custom" && (
              <Input
                type="number"
                value={data.scanSpeed || ""}
                onChange={(e) => updateField("scanSpeed", parseFloat(e.target.value) || 0)}
                min={hasSpeedLimit ? 1 : 0}
                max={hasSpeedLimit ? maxSpeed : undefined}
                className={`bg-background ${!compliance.speedOk ? "border-destructive" : ""}`}
              />
            )}
          </div>
          {hasSpeedLimit && !compliance.speedOk && (
            <p className="text-xs text-destructive mt-1">
              Exceeds maximum of {maxSpeed} {scanParams.maxSpeedManual.unit} per {standard}
            </p>
          )}
        </FieldWithHelp>

        {!isPwNdip && (
          <FieldWithHelp
            label="Scan Index (% of beam width)"
            fieldKey="scanIndex"
            help={
              hasOverlapRequirement
                ? `Per ${standard}: Minimum ${scanParams.minOverlap}% overlap required (max index ${100 - scanParams.minOverlap}%)`
                : `Per ${standard}: overlap percent is not explicitly specified. Use NDIP absolute limits (max scan increment 0.020", max index increment 0.020"/rev).`
            }
            required
          >
            <Input
              type="number"
              value={data.scanIndex || ""}
              onChange={(e) => updateField("scanIndex", parseFloat(e.target.value) || 0)}
              min={1}
              max={hasOverlapRequirement ? 100 - scanParams.minOverlap : 100}
              className={`bg-background ${!compliance.overlapOk ? "border-destructive" : ""}`}
            />
            {hasOverlapRequirement && !compliance.overlapOk && (
              <p className="text-xs text-destructive mt-1">
                Results in {100 - data.scanIndex}% overlap. Minimum {scanParams.minOverlap}% required per {standard}
              </p>
            )}
          </FieldWithHelp>
        )}

        <FieldWithHelp
          label="Coverage (%)"
          fieldKey="coverage"
          help={`Per ${standard}: ${scanParams.coverageRequired}% volumetric coverage required. Acceptance threshold: 85%`}
          required
        >
          <Input
            type="number"
            value={data.coverage || ""}
            onChange={(e) => updateField("coverage", parseFloat(e.target.value) || 0)}
            min={0}
            max={100}
            className={`bg-background ${!compliance.coverageAccepted ? "border-destructive" : ""}`}
          />
          {data.coverage > 0 && (
            <p className={`text-xs mt-1 font-medium ${compliance.coverageAccepted ? "text-green-600" : "text-destructive"}`}>
              {compliance.coverageAccepted
                ? `Pass (${data.coverage}% >= 85%)`
                : `Fail (${data.coverage}% < 85% acceptance threshold)`}
            </p>
          )}
        </FieldWithHelp>

        <FieldWithHelp
          label="Scan Pattern"
          fieldKey="scanPattern"
          required
        >
          <Select
            value={data.scanPattern}
            onValueChange={(value) => updateField("scanPattern", value)}
          >
            <SelectTrigger className="bg-background">
              <SelectValue placeholder="" />
            </SelectTrigger>
            <SelectContent className="bg-popover z-50">
              {!["raster", "bidirectional", "spiral", "helical", "custom"].includes(data.scanPattern) && data.scanPattern && (
                <SelectItem value={data.scanPattern}>{data.scanPattern}</SelectItem>
              )}
              <SelectItem value="raster">
                Raster {isAustenitic && "⭐"}
              </SelectItem>
              <SelectItem value="bidirectional">
                Bidirectional Raster
              </SelectItem>
              <SelectItem value="spiral">Spiral</SelectItem>
              <SelectItem value="helical">Helical (for cylindrical parts)</SelectItem>
              <SelectItem value="custom">Custom</SelectItem>
            </SelectContent>
          </Select>
        </FieldWithHelp>

        {/* Water Path for Immersion - shown when technique is conventional or not using bubbler */}
        {(data.scanMethods || []).includes("immersion") && data.technique !== "bubbler" && (
          <FieldWithHelp
            label="Water Path (mm)"
            fieldKey="waterPath"
            help={isAustenitic ? "25-75mm typical for focused probes in austenitic materials" : undefined}
          >
            <div className="space-y-1">
              <Input
                type="number"
                value={data.waterPath ?? ''}
                onChange={(e) => handleManualWaterPathChange(e.target.value)}
                min={0}
                className="bg-background"
              />
              {autoWaterPath && !waterPathManualOverride && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Badge variant="outline" className="text-xs border-amber-500/50 text-amber-400 gap-1 cursor-help">
                        <Sparkles className="h-3 w-3" /> Auto-Calculated
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="max-w-xs">
                      <p className="text-xs">{waterPathReasoning}</p>
                      <p className="text-xs text-muted-foreground mt-1">Range: {autoWaterPath.min}–{autoWaterPath.max}mm</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
          </FieldWithHelp>
        )}

        <FieldWithHelp
          label="Pulse Repetition Rate (Hz) - Recommended"
          fieldKey="pulseRepetitionRate"
          help={
            recommendedPrfRow
              ? `For ${data.scanSpeed || 0} mm/s: recommended PRF is ${recommendedPrfRow.probe1InchPrf} Hz (1" probe) or ${recommendedPrfRow.probeHalfInchPrf} Hz (0.5" probe)`
              : standard === "AMS-STD-2154E"
                ? "Per AMS-STD-2154E: 100-10000 Hz"
                : undefined
          }
        >
          <div className="space-y-2">
            <Input
              type="number"
              value={data.pulseRepetitionRate || ""}
              onChange={(e) => updateField("pulseRepetitionRate", parseFloat(e.target.value) || 0)}
              min={100}
              max={10000}
              className="bg-background"
            />

            <div className="rounded border border-border overflow-hidden">
              <table className="w-full text-[11px]">
                <thead className="bg-muted/40">
                  <tr>
                    <th className="px-2 py-1 text-left">1" probe PRF</th>
                    <th className="px-2 py-1 text-left">0.5" probe PRF</th>
                    <th className="px-2 py-1 text-left">Scan speed (mm/s)</th>
                  </tr>
                </thead>
                <tbody>
                  {prfRecommendationTable.map((row) => {
                    const active =
                      recommendedPrfRow?.maxScanSpeed === row.maxScanSpeed;
                    return (
                      <tr key={row.maxScanSpeed} className={active ? "bg-primary/10" : ""}>
                        <td className="px-2 py-1">{row.probe1InchPrf} Hz</td>
                        <td className="px-2 py-1">{row.probeHalfInchPrf} Hz</td>
                        <td className="px-2 py-1">{"\u2264"} {row.maxScanSpeed}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </FieldWithHelp>

      </div>

      <p className="text-xs text-muted-foreground">
        {getStandardLabel(standard)}: calibration interval {calibParams.calibrationInterval}, required coverage {scanParams.coverageRequired}%.
      </p>

      {/* Calibration requirements note */}
      <div className="bg-muted/30 border border-border rounded-lg p-4">
        <p className="text-xs text-muted-foreground">
          <strong>Calibration:</strong> {calibParams.calibrationInterval}.{" "}
          <strong>Sensitivity:</strong> {calibParams.primarySensitivity}.{" "}
          {scanParams.notes}
        </p>
      </div>
    </div>
  );
};
