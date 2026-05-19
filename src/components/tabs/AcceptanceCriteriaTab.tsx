// @ts-nocheck
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { AcceptanceCriteriaData, StandardType } from "@/types/techniqueSheet";
import { AlertTriangle, Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useEffect, useMemo, useRef } from "react";
import { FieldWithHelp } from "@/components/FieldWithHelp";
import { Checkbox } from "@/components/ui/checkbox";
import {
  acceptanceClassesByStandard,
  acceptanceCriteriaByStandard,
  getDefaultAcceptanceClass,
  materialWarnings,
  type AcceptanceCriteriaValues,
} from "@/data/standardsDifferences";

interface AcceptanceCriteriaTabProps {
  data: AcceptanceCriteriaData;
  onChange: (data: AcceptanceCriteriaData) => void;
  material: string;
  standard?: StandardType;
}

const getStandardLabel = (standard: StandardType): string => {
  const labels: Partial<Record<StandardType, string>> = {
    "MIL-STD-2154": "MIL-STD-2154 Table VI",
    "AMS-STD-2154E": "MIL-STD-2154 / AMS-STD-2154E Table VI",
    "ASTM-A388": "ASTM A388/A388M Quality Levels",
    "BS-EN-10228-3": "BS EN 10228-3:2016 Quality Classes",
    "BS-EN-10228-4": "BS EN 10228-4:2016 Quality Classes (Austenitic)",
    "NDIP-1226": "NDIP-1226 Rev F - PW V2500 1st Stage HPT Disk",
    "NDIP-1227": "NDIP-1227 Rev D - PW V2500 2nd Stage HPT Disk",
    "NDIP-1254": "NDIP-1254 - PW1100G HPT 1st Stage Hub (AUSI)",
    "NDIP-1257": "NDIP-1257 - PW1100G HPT 2nd Stage Hub (AUSI)",
    "NDIP-1260": "NDIP-1260 - PW1100G HPC 8th Stage IBR-8 (AUSI)",
    "PWA-SIM": "PWA SIM - Sonic Inspection Method (Bar/Billet/Forging)",
    "ASTM-E2375": "ASTM E2375 - UT of Wrought Products",
    "ASTM-E1001": "ASTM E1001 - Immersion Pulse-Echo UT",
    "ASTM-E2580": "ASTM E2580 - Composite Panel UT",
    "ASTM-E588": "ASTM E588 - Bearing Steel Cleanliness",
    "ASTM-E127": "ASTM E127 - FBH Reference Blocks",
    "ASTM-E164": "ASTM E164 - UT of Weldments",
    "AMS-2630": "AMS 2630 - Products >0.5\" Thick",
    "AMS-2631": "AMS 2631 - Titanium Bar, Billet, Plate",
    "AMS-2632": "AMS 2632 - Thin Materials <=0.5\"",
    "EN-ISO-16810": "EN ISO 16810 - General UT Principles",
  };
  return labels[standard] || standard;
};

const getQuickReferenceNote = (standard: StandardType): string => {
  if (standard === "AMS-STD-2154E" || standard === "MIL-STD-2154") {
    return "Table VI Note 2: Multiple discontinuities are centers <1 inch apart. Back reflection loss limit is 50% (Note 4).";
  }
  if (standard === "ASTM-A388") {
    return "ASTM A388 does not define QL1-QL4 in the base text. These quality levels are common industry conventions.";
  }
  if (standard === "ASTM-E1001" || standard === "ASTM-E2580") {
    return "This ASTM practice defines examination method and reporting requirements. Acceptance limits must come from the drawing, purchase order, or contract.";
  }
  if (standard === "ASTM-E588") {
    return "ASTM E588 reports bearing-steel inclusion cleanliness rating; it does not set acceptability limits.";
  }
  if (standard === "BS-EN-10228-3") {
    return "Class 1 is least stringent and Class 4 is most stringent. Limits are expressed in EFBH sizes.";
  }
  if (standard === "BS-EN-10228-4") {
    return "BS EN 10228-4 uses 3 classes (Class 1 to Class 3) with thickness-dependent limits.";
  }
  return "Values shown are loaded from the selected standard profile and acceptance class definitions.";
};

const getStringencyColor = (stringency: string): string => {
  switch (stringency) {
    case "highest":
      return "bg-red-500/20 text-red-400 border-red-500/30";
    case "high":
      return "bg-orange-500/20 text-orange-400 border-orange-500/30";
    case "medium":
      return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
    case "low":
      return "bg-green-500/20 text-green-400 border-green-500/30";
    case "basic":
      return "bg-blue-500/20 text-blue-400 border-blue-500/30";
    default:
      return "bg-muted text-muted-foreground";
  }
};

const is2154TableStandard = (standard: StandardType): boolean =>
  standard === "AMS-STD-2154E" || standard === "MIL-STD-2154";

const sanitize2154TableValue = (value: string): string =>
  value
    .replace(/\s*\(see[^)]*\)/gi, "")
    .replace(/\s*\(centers <1" apart\)/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();

const getQuickReferenceHeaders = (standard: StandardType) => {
  if (!is2154TableStandard(standard)) {
    return [
      { label: "Class" },
      { label: "Single Discontinuity" },
      { label: "Multiple Discontinuities" },
      { label: "Linear Discontinuity" },
      { label: "Back Reflection Loss" },
      { label: "Noise" },
    ];
  }

  return [
    { label: "Class" },
    { label: "Single Discontinuity Response", notes: "1/, 6/" },
    { label: "Multiple Discontinuities", notes: "2/, 5/, 7/" },
    { label: "Linear Discontinuity - Length and Response", notes: "3/, 7/" },
    { label: "Loss of Back Reflection - Percent", notes: "4/" },
    { label: "Noise" },
  ];
};

export const AcceptanceCriteriaTab = ({
  data,
  onChange,
  material,
  standard = "AMS-STD-2154E",
}: AcceptanceCriteriaTabProps) => {
  const dataRef = useRef(data);
  const onChangeRef = useRef(onChange);
  dataRef.current = data;
  onChangeRef.current = onChange;

  const updateField = (field: keyof AcceptanceCriteriaData, value: any) => {
    onChange({ ...data, [field]: value });
  };

  const acceptanceClasses = useMemo(() => {
    return acceptanceClassesByStandard[standard] || acceptanceClassesByStandard["AMS-STD-2154E"];
  }, [standard]);

  const currentCriteria = useMemo(() => {
    const standardCriteria = acceptanceCriteriaByStandard[standard];
    if (standardCriteria && data.acceptanceClass) {
      return standardCriteria[data.acceptanceClass] || null;
    }
    return null;
  }, [standard, data.acceptanceClass]);

  const isClassValidForStandard = useMemo(() => {
    return acceptanceClasses.some((cls) => cls.id === data.acceptanceClass);
  }, [acceptanceClasses, data.acceptanceClass]);

  useEffect(() => {
    const currentData = dataRef.current;
    if (currentData.acceptanceClass && currentCriteria) {
      const bwlParsed = parseFloat((currentCriteria.backReflectionLoss || "").match(/[\d.]+/)?.[0] || "");
      onChangeRef.current({
        ...currentData,
        singleDiscontinuity: currentCriteria.singleDiscontinuity,
        multipleDiscontinuities: currentCriteria.multipleDiscontinuities,
        linearDiscontinuity: currentCriteria.linearDiscontinuity,
        backReflectionLoss: Number.isFinite(bwlParsed) ? bwlParsed : currentData.backReflectionLoss,
        noiseLevel: currentCriteria.noiseLevel,
        specialRequirements: currentData.specialRequirements || currentCriteria.specialNotes || "",
        standardNotes: currentCriteria.specialNotes || "",
      });
    }
  }, [data.acceptanceClass, standard, currentCriteria]);

  useEffect(() => {
    if (!isClassValidForStandard) {
      const defaultClass = getDefaultAcceptanceClass(standard);
      const currentData = dataRef.current;
      onChangeRef.current({ ...currentData, acceptanceClass: defaultClass });
    }
  }, [standard, isClassValidForStandard]);

  const materialWarning = useMemo(() => {
    const normalizedMaterial = material.toLowerCase();
    return materialWarnings.find(
      (w) => normalizedMaterial.includes(w.material) && w.standard === standard
    );
  }, [material, standard]);

  const normalizedMaterial = material.toLowerCase();
  const isTitanium = normalizedMaterial.includes("titanium") || normalizedMaterial.includes("ti-");
  const showTitaniumWarning =
    isTitanium &&
    ((["AAA", "AA"].includes(data.acceptanceClass) &&
      (standard === "AMS-STD-2154E" || standard === "MIL-STD-2154")) ||
      standard === "AMS-2631");

  const currentClassInfo = useMemo(() => {
    return acceptanceClasses.find((cls) => cls.id === data.acceptanceClass);
  }, [acceptanceClasses, data.acceptanceClass]);

  const quickReferenceRows = useMemo(() => {
    const rows: { classId: string; classLabel: string; criteria: AcceptanceCriteriaValues }[] = [];
    const criteriaByClass = acceptanceCriteriaByStandard[standard] || {};

    for (const cls of acceptanceClasses) {
      const criteria = criteriaByClass[cls.id];
      if (criteria) {
        rows.push({
          classId: cls.id,
          classLabel: cls.label,
          criteria,
        });
      }
    }

    return rows;
  }, [acceptanceClasses, standard]);

  const quickReferenceHeaders = useMemo(
    () => getQuickReferenceHeaders(standard),
    [standard]
  );

  const isPwNdip = standard === "NDIP-1226" || standard === "NDIP-1227";

  if (isPwNdip) {
    return (
      <div className="space-y-4 p-2">
        <div className="bg-primary/5 border border-primary/20 rounded p-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Active NDIP Rejection Criteria</h3>
              <p className="text-xs text-muted-foreground mt-1">{getStandardLabel(standard)}</p>
            </div>
            <Badge variant="outline" className="text-xs">
              Rejection Criteria
            </Badge>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-lg border border-blue-500/30 bg-blue-500/5 p-4">
            <h4 className="text-sm font-semibold text-foreground">Amplitude C-Scan</h4>
            <ul className="mt-3 list-disc space-y-2 pl-4 text-sm text-muted-foreground">
              <li>Minimum pixel grouping: 3 pixels (2x1 or 1x2).</li>
              <li>Adjacent pixel depth tolerance: 0.025 inch.</li>
              <li>Calibration amplitude: 80% FSH using No. 1 FBH.</li>
              <li>Reject threshold: 20% FSH.</li>
              <li>Evaluation threshold: 15% FSH.</li>
            </ul>
          </div>

          <div className="rounded-lg border border-violet-500/30 bg-violet-500/5 p-4">
            <h4 className="text-sm font-semibold text-foreground">TOF / Post-Calibration</h4>
            <ul className="mt-3 list-disc space-y-2 pl-4 text-sm text-muted-foreground">
              <li>Minimum TOF grouping: 15 connected pixels across at least 3 scan lines.</li>
              <li>Signal-to-noise threshold: at least 1.5:1.</li>
              <li>Low-noise threshold: 5.0% FSH average noise.</li>
              <li>When average noise is below 5.0% FSH, use 7.5% FSH as the low-noise rejection level.</li>
              <li>Post-calibration tolerance remains within +/-1 dB of initial calibration.</li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2 p-2">
      <div className="bg-primary/5 border border-primary/20 rounded p-2">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Active Standard</h3>
            <p className="text-xs text-muted-foreground mt-1">{getStandardLabel(standard)}</p>
          </div>
          <Badge variant="outline" className="text-xs">
            {acceptanceClasses.length} Quality Levels
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
        <FieldWithHelp label="Acceptance Class / Quality Level" fieldKey="acceptanceClass" required>
          <Select value={data.acceptanceClass} onValueChange={(value) => updateField("acceptanceClass", value)}>
            <SelectTrigger className="bg-background">
              <SelectValue placeholder="" />
            </SelectTrigger>
            <SelectContent className="bg-popover z-50">
              {acceptanceClasses.map((cls) => (
                <SelectItem key={cls.id} value={cls.id}>
                  <div className="flex items-center gap-2">
                    <span>{cls.label}</span>
                    <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${getStringencyColor(cls.stringency)}`}>
                      {cls.stringency}
                    </Badge>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {currentClassInfo && <p className="text-xs text-muted-foreground mt-1">{currentClassInfo.description}</p>}
        </FieldWithHelp>

        <FieldWithHelp
          label="Back Reflection Loss Limit"
          fieldKey="backReflectionLoss"
          required
          autoFilled={!!data.acceptanceClass}
        >
          <Input
            value={currentCriteria?.backReflectionLoss || data.backReflectionLoss || ""}
            onChange={(e) => updateField("backReflectionLoss", e.target.value)}
            className="bg-background"
          />
        </FieldWithHelp>

        <FieldWithHelp
          label="Single Discontinuity Response"
          fieldKey="singleDiscontinuity"
          required
          autoFilled={!!data.acceptanceClass}
        >
          <Input
            value={data.singleDiscontinuity}
            onChange={(e) => updateField("singleDiscontinuity", e.target.value)}
            className="bg-background"
          />
        </FieldWithHelp>

        <FieldWithHelp
          label={
            standard.startsWith("BS-EN")
              ? "Multiple Indications (per 100 cm^2)"
              : "Multiple Discontinuities (centers < 1 inch apart)"
          }
          fieldKey="multipleDiscontinuities"
          required
          autoFilled={!!data.acceptanceClass}
        >
          <Input
            value={data.multipleDiscontinuities}
            onChange={(e) => updateField("multipleDiscontinuities", e.target.value)}
            className="bg-background"
          />
        </FieldWithHelp>

        <FieldWithHelp
          label="Linear Discontinuity"
          fieldKey="linearDiscontinuity"
          required
          autoFilled={!!data.acceptanceClass}
        >
          <Input
            value={data.linearDiscontinuity}
            onChange={(e) => updateField("linearDiscontinuity", e.target.value)}
            className="bg-background"
          />
        </FieldWithHelp>

        <FieldWithHelp
          label={standard === "BS-EN-10228-4" ? "Noise Level / S/N Ratio Requirements" : "Noise Level Requirements"}
          fieldKey="noiseLevel"
          required
          autoFilled={!!data.acceptanceClass}
        >
          <Input
            value={data.noiseLevel}
            onChange={(e) => updateField("noiseLevel", e.target.value)}
            className="bg-background"
          />
        </FieldWithHelp>
      </div>

      {showTitaniumWarning && (
        <div className="bg-warning/10 border border-warning/30 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-warning mt-0.5 flex-shrink-0" />
            <div>
              <h4 className="text-sm font-semibold text-foreground mb-2">
                TITANIUM SPECIAL REQUIREMENTS{standard === "AMS-2631" ? " (AMS 2631)" : ""}
              </h4>
              <ul className="text-sm text-foreground space-y-1 list-disc ml-4">
                {data.acceptanceClass === "AAA" && (
                  <>
                    <li>Table VI Note 6 (Titanium): Multiple discontinuity = 1/8" max length at 2/64" response</li>
                    <li>Table VI Note 6 (Titanium): Noise criteria is not applicable for Class AAA</li>
                  </>
                )}
                {data.acceptanceClass === "AA" && (
                  <>
                    <li>Table VI Note 6 (Titanium): Multiple discontinuity = 1/4" max length at 2/64" response (or greater)</li>
                    <li>Table VI Note 6 (Titanium): Linear discontinuity criteria is not applicable for Class AA</li>
                  </>
                )}
                <li>Higher attenuation than metals of similar density - verify calibration sensitivity</li>
                <li>Macrostructure variations may cause false indications - verify with rescan at 90 deg</li>
                {standard === "AMS-2631" && <li>AMS 2631 applies specifically to titanium bar, billet, and plate products</li>}
              </ul>
            </div>
          </div>
        </div>
      )}

      {standard === "BS-EN-10228-4" && (
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <Info className="h-5 w-5 text-blue-400 mt-0.5 flex-shrink-0" />
            <div>
              <h4 className="text-sm font-semibold text-foreground mb-2">Austenitic Material Considerations</h4>
              <ul className="text-sm text-foreground space-y-1 list-disc ml-4">
                <li>Grass noise acceptable &lt; 20% screen height</li>
                <li>Signal-to-Noise ratio: 3:1 minimum, 6:1 preferred</li>
                <li>Levels adjusted for higher attenuation in austenitic materials</li>
                <li>Consider grain structure effects on beam scattering</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {materialWarning && (
        <div className="bg-warning/10 border border-warning/30 rounded-lg p-3">
          <p className="text-sm text-foreground">{materialWarning.warning}</p>
        </div>
      )}

      <FieldWithHelp label="Special Requirements" fieldKey="acceptanceClass">
        <Textarea
          value={data.specialRequirements}
          onChange={(e) => updateField("specialRequirements", e.target.value)}
          rows={4}
          className="bg-background"
        />
      </FieldWithHelp>

      <div className="bg-muted/30 border border-border rounded-lg p-4">
        <p className="text-xs text-muted-foreground">
          <strong>Reference:</strong> All acceptance criteria are based on <strong>{getStandardLabel(standard)}</strong>.
          {(standard === "AMS-STD-2154E" || standard === "MIL-STD-2154") && " Class AAA is the most stringent, Class C is the least."}
          {standard === "ASTM-A388" && " Quality Level 1 (QL1) is the most stringent, QL4 is the least."}
          {standard === "BS-EN-10228-3" && " Quality Class 4 is the most stringent, Class 1 is the least. Based on EFBH (Equivalent Flat Bottom Hole) sizes."}
          {standard === "BS-EN-10228-4" && " Quality Class 3 is the most stringent, Class 1 is the least. For austenitic/duplex steels only."}
          {" "}Ensure your inspection meets or exceeds the specified requirements.
        </p>
      </div>

      {quickReferenceRows.length > 0 && (
        <div className="border border-border rounded-lg overflow-hidden">
          <div className="bg-muted/50 px-4 py-2 border-b border-border">
            <h4 className="text-sm font-semibold">Quick Reference: {getStandardLabel(standard)}</h4>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-muted/30">
                <tr>
                  {quickReferenceHeaders.map((header) => (
                    <th
                      key={header.label}
                      className={`px-3 py-2 ${is2154TableStandard(standard) ? "text-center" : "text-left"}`}
                    >
                      <div className="leading-tight">
                        <div>{header.label}</div>
                        {header.notes && (
                          <div className="mt-1 text-[10px] font-normal text-muted-foreground">
                            {header.notes}
                          </div>
                        )}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {quickReferenceRows.map((row) => {
                  const isSelected = data.acceptanceClass === row.classId;
                  const rowValues = [
                    row.criteria.singleDiscontinuity,
                    row.criteria.multipleDiscontinuities,
                    row.criteria.linearDiscontinuity,
                    row.criteria.backReflectionLoss,
                    row.criteria.noiseLevel,
                  ].map((value) =>
                    is2154TableStandard(standard) ? sanitize2154TableValue(value) : value
                  );

                  return (
                    <tr key={row.classId} className={isSelected ? "bg-primary/10" : ""}>
                      <td className="px-3 py-2 font-medium">{row.classLabel}</td>
                      {rowValues.map((value, valueIndex) => (
                        <td
                          key={`${row.classId}-${valueIndex}`}
                          className={`px-3 py-2 ${is2154TableStandard(standard) ? "text-center" : ""}`}
                        >
                          {value}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 bg-muted/20 border-t border-border space-y-3">
            <p className="text-xs text-muted-foreground">
              Note: {getQuickReferenceNote(standard)}
            </p>
            {(standard === "AMS-STD-2154E" || standard === "MIL-STD-2154") && (
              <div className="bg-background/60 border border-border rounded-md p-3 space-y-1.5">
                <p className="text-xs font-semibold text-foreground mb-2">Table 6 — Ultrasonic Classes — Notes</p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  <span className="font-semibold text-foreground">1/</span>{" "}
                  Any discontinuity with an indication greater than the response from a reference flat-bottom hole or equivalent notch at the estimated discontinuity depth of the size given (inches diameter) is not acceptable.
                </p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  <span className="font-semibold text-foreground">2/</span>{" "}
                  Multiple discontinuities with indications greater than the response from a reference flat-bottom hole or equivalent notch at the estimated discontinuity depth of the size given (inches diameter) are not acceptable if the centers of any two of these discontinuities are less than 1 inch apart. Not applicable to class C.
                </p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  <span className="font-semibold text-foreground">3/</span>{" "}
                  Any discontinuity longer than the length given with indications greater than the response given (flat-bottom hole or equivalent notch response) is not acceptable. Not applicable to class C.
                </p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  <span className="font-semibold text-foreground">4/</span>{" "}
                  Loss of back reflection greater than the percent given, when compared to non-defective material in a similar or like part, is not acceptable when this loss of back reflection is accompanied by an increase or decrease in noise signal (at least double the normal background noise signal) between the front and back surface. Applicable only to straight beam tests.
                </p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  <span className="font-semibold text-foreground">5/</span>{" "}
                  When inspecting titanium to class AA, the multiple discontinuity separation shall be 1/4 inch.
                </p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  <span className="font-semibold text-foreground">6/</span>{" "}
                  {"For class AAA single discontinuity, 50% of 2/64 = 25% of 3/64."}
                </p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  <span className="font-semibold text-foreground">7/</span>{" "}
                  {"For class AAA linear and multiple discontinuities, 1/64 or 25% of 2/64 = 10% of 3/64."}
                </p>
              </div>
            )}
            {!!data.standardNotes && (
              <div className="bg-background/60 border border-border rounded-md p-3">
                <p className="text-xs font-semibold text-foreground mb-1">Standard Notes</p>
                <p className="text-xs text-muted-foreground whitespace-pre-wrap">{data.standardNotes}</p>
              </div>
            )}
            <label className="flex items-center gap-2 text-xs text-foreground cursor-pointer">
              <Checkbox
                checked={!!data.includeStandardNotesInReport}
                onCheckedChange={(checked) => updateField("includeStandardNotesInReport", checked === true)}
              />
              Include standard notes in exported report
            </label>
          </div>
        </div>
      )}
    </div>
  );
};
