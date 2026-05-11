// @ts-nocheck
/**
 * Procedure Generator
 * Generates UT inspection procedures from wizard data
 */

import type {
  ProcedureWizardData,
  ProcedureData,
  ProcedureSection,
  ProcedureTemplate,
  ProcedureStandardType,
  MATERIAL_LABELS,
  PART_LABELS,
  METHOD_LABELS,
  SCAN_TYPE_LABELS,
  QUALIFICATION_LABELS,
} from "@/types/procedure";
import { AMS_STD_2154E_TEMPLATE } from "@/templates/procedures/ams-std-2154e";

// Get template by standard
export function getTemplateByStandard(
  standard: ProcedureStandardType
): ProcedureTemplate | null {
  switch (standard) {
    case "AMS-STD-2154E":
      return AMS_STD_2154E_TEMPLATE;
    // Add more templates as needed
    default:
      return AMS_STD_2154E_TEMPLATE; // Default fallback
  }
}

// Replace placeholders in content
function replacePlaceholders(
  content: string,
  data: ProcedureWizardData
): string {
  const replacements: Record<string, string> = {
    // Scope
    "{MATERIAL_TYPES}": (data.materialCategories || [])
      .map((m) => getMaterialLabel(m))
      .join(", ") || "various metals",
    "{PART_TYPES}": (data.partCategories || [])
      .map((p) => getPartLabel(p))
      .join(", ") || "various forms",
    "{THICKNESS_MIN}": String(data.thicknessMin || 0.1),
    "{THICKNESS_MAX}": String(data.thicknessMax || 100),
    "{THICKNESS_UNIT}": data.thicknessUnit || "mm",
    "{ADDITIONAL_STANDARDS}": (data.additionalStandards || [])
      .map((s) => `- ${s}`)
      .join("\n"),
    "{EXCLUSIONS}": data.exclusions || "None specified",

    // Equipment
    "{FREQ_MIN}": String(data.frequencyMin || 1),
    "{FREQ_MAX}": String(data.frequencyMax || 15),
    "{TRANSDUCER_FREQUENCIES}": (data.transducerFrequencies || [5])
      .map((f) => `${f} MHz`)
      .join(", "),
    "{TRANSDUCER_DIAMETERS}": (data.transducerDiameters || [12.7])
      .map((d) => `${d} mm`)
      .join(", "),
    "{TRANSDUCER_TYPES}": (data.transducerTypes || ["contact"])
      .join(", "),
    "{COUPLANT_TYPES}": (data.couplantTypes || ["water-based gel"])
      .join(" or "),

    // Calibration
    "{BLOCK_TYPES}": (data.blockTypes || ["ASTM E127"]).join(", "),
    "{BLOCK_MATERIAL}": data.blockMaterial || "material acoustically equivalent to test material",
    "{FBH_SIZES}": (data.fbhSizes || [])
      .map((s) => `- ${s}`)
      .join("\n") || "Per applicable specification",
    "{PRIMARY_SENSITIVITY}": data.primarySensitivity || "Reference reflector at 80% FSH",
    "{SCANNING_SENSITIVITY}": data.scanningSensitivity || "+6 dB above primary",
    "{DAC_REQUIRED}": data.dacRequired ? "" : "not",
    "{DAC_POINTS}": (data.dacPoints || [])
      .map((p) => `${p}% of thickness`)
      .join(", ") || "multiple depths",

    // Scan procedure
    "{INSPECTION_METHOD}": getMethodLabel(data.method || "contact"),
    "{SCAN_TYPE}": getScanTypeLabel(data.scanType || "straight_beam"),
    "{SURFACE_CONDITIONS}": (data.surfaceConditions || [
      "Free from scale, rust, paint, or other coatings",
      "Smooth machined or as-received with adequate coupling",
    ])
      .map((c) => `- ${c}`)
      .join("\n"),
    "{COVERAGE_REQUIRED}": String(data.coverageRequired || 100),
    "{OVERLAP}": String(data.overlap || 15),
    "{SCAN_SPEED_MAX}": String(data.scanSpeedMax || 150),
    "{SCAN_SPEED_UNIT}": "mm/s",
    "{INDEX_INCREMENT}": String(data.indexIncrement || 1),
    "{INDEX_UNIT}": "mm",
    "{WATER_PATH}":
      data.method === "immersion"
        ? `- Water path: ${data.waterPathMin || 10} to ${data.waterPathMax || 75} mm`
        : "",

    // Acceptance
    "{ACCEPTANCE_CLASS}": data.acceptanceClass || "A",
    "{MAX_SINGLE_SIZE}": data.maxSingleSize || "Per specification",
    "{MAX_SINGLE_AMPLITUDE}": data.maxSingleAmplitude || "exceeding DAC",
    "{MAX_CLUSTER_COUNT}": String(data.maxClusterCount || 3),
    "{MAX_CLUSTER_AREA}": data.maxClusterArea || "25mm x 25mm",
    "{MAX_LINEAR_LENGTH}": data.maxLinearLength || "Per specification",
    "{SPECIAL_REQUIREMENTS}": (data.specialRequirements || [])
      .map((r) => `- ${r}`)
      .join("\n") || "None",

    // Documentation
    "{RECORDS_TO_MAINTAIN}": (data.recordsToMaintain || [
      "Calibration records",
      "Inspection reports",
      "Personnel certifications",
    ])
      .map((r) => `- ${r}`)
      .join("\n"),
    "{RETENTION_PERIOD}": data.retentionPeriod || "As specified by customer/contract",
    "{INSPECTION_LEVEL}": (data.inspectionLevel || ["Level_II"])
      .map((l) => getQualificationLabel(l))
      .join(" or "),
    "{EVALUATION_LEVEL}": (data.evaluationLevel || ["Level_II"])
      .map((l) => getQualificationLabel(l))
      .join(" or "),
    "{APPROVAL_LEVEL}": (data.approvalLevel || ["Level_III"])
      .map((l) => getQualificationLabel(l))
      .join(" or "),
  };

  let result = content;
  for (const [placeholder, value] of Object.entries(replacements)) {
    result = result.replace(new RegExp(placeholder.replace(/[{}]/g, "\\$&"), "g"), value);
  }

  return result;
}

// Helper functions for labels
function getMaterialLabel(key: string): string {
  const labels: Record<string, string> = {
    aluminum: "Aluminum Alloys",
    titanium: "Titanium Alloys",
    steel: "Carbon/Low Alloy Steel",
    nickel_alloy: "Nickel-Based Alloys",
    stainless_steel: "Stainless Steel",
    composite: "Composite Materials",
  };
  return labels[key] || key;
}

function getPartLabel(key: string): string {
  const labels: Record<string, string> = {
    forging: "Forgings",
    casting: "Castings",
    plate: "Plate/Sheet",
    bar: "Bar/Billet",
    tube: "Tube/Pipe",
    extrusion: "Extrusions",
    weld: "Welds",
  };
  return labels[key] || key;
}

function getMethodLabel(key: string): string {
  const labels: Record<string, string> = {
    contact: "Contact",
    immersion: "Immersion",
    squirter: "Squirter/Bubbler",
    phased_array: "Phased Array",
    tofd: "TOFD",
  };
  return labels[key] || key;
}

function getScanTypeLabel(key: string): string {
  const labels: Record<string, string> = {
    straight_beam: "Straight Beam",
    angle_beam: "Angle Beam",
    combination: "Combination",
  };
  return labels[key] || key;
}

function getQualificationLabel(key: string): string {
  const labels: Record<string, string> = {
    Level_I: "Level I",
    Level_II: "Level II",
    Level_III: "Level III",
  };
  return labels[key] || key;
}

// Process sections recursively
function processSections(
  sections: ProcedureSection[],
  data: ProcedureWizardData
): ProcedureSection[] {
  return sections.map((section) => ({
    ...section,
    content: replacePlaceholders(section.content, data),
    subsections: section.subsections
      ? processSections(section.subsections, data)
      : undefined,
  }));
}

// Generate procedure document from wizard data
export function generateProcedure(
  wizardData: ProcedureWizardData,
  metadata: {
    procedureNumber: string;
    revision: string;
    preparedBy: string;
    approvedBy: string;
  }
): { sections: ProcedureSection[]; title: string } {
  const template = getTemplateByStandard(
    wizardData.primaryStandard || "AMS-STD-2154E"
  );

  if (!template) {
    throw new Error("No template found for selected standard");
  }

  // Merge template defaults with wizard data
  const mergedData: ProcedureWizardData = {
    ...template.defaultData,
    ...wizardData,
  };

  // Process template sections with data
  const processedSections = processSections(template.sections, mergedData);

  // Generate title
  const title =
    wizardData.procedureTitle ||
    `Ultrasonic Inspection Procedure - ${wizardData.primaryStandard || "General"}`;

  return {
    sections: processedSections,
    title,
  };
}

// Convert sections to plain text
export function sectionsToText(sections: ProcedureSection[], indent = 0): string {
  let text = "";
  const prefix = "  ".repeat(indent);

  for (const section of sections) {
    text += `${prefix}${section.id} ${section.title}\n\n`;

    if (section.content) {
      const lines = section.content.split("\n");
      for (const line of lines) {
        text += `${prefix}${line}\n`;
      }
      text += "\n";
    }

    if (section.subsections) {
      text += sectionsToText(section.subsections, indent + 1);
    }
  }

  return text;
}

// Convert sections to HTML
export function sectionsToHtml(sections: ProcedureSection[], level = 1): string {
  let html = "";

  for (const section of sections) {
    const headingLevel = Math.min(level + 1, 6);
    html += `<h${headingLevel}>${section.id} ${section.title}</h${headingLevel}>\n`;

    if (section.content) {
      // Convert line breaks and lists to HTML
      const content = section.content
        .split("\n\n")
        .map((para) => {
          if (para.startsWith("- ")) {
            // Convert bullet list
            const items = para
              .split("\n")
              .filter((l) => l.startsWith("- "))
              .map((l) => `<li>${l.substring(2)}</li>`)
              .join("\n");
            return `<ul>\n${items}\n</ul>`;
          }
          return `<p>${para.replace(/\n/g, "<br>")}</p>`;
        })
        .join("\n");

      html += content + "\n";
    }

    if (section.subsections) {
      html += sectionsToHtml(section.subsections, level + 1);
    }
  }

  return html;
}

// Validate wizard data completeness
export function validateWizardData(
  data: ProcedureWizardData,
  step: string
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  switch (step) {
    case "standard":
      if (!data.primaryStandard) {
        errors.push("Primary standard is required");
      }
      break;

    case "scope":
      if (!data.procedureTitle) {
        errors.push("Procedure title is required");
      }
      if (!data.partCategories || data.partCategories.length === 0) {
        errors.push("At least one part category must be selected");
      }
      if (
        (!data.materialCategories || data.materialCategories.length === 0) &&
        (!data.materialTypes || data.materialTypes.length === 0)
      ) {
        errors.push("At least one material type must be selected");
      }
      break;

    case "equipment":
      if (!data.frequencyMin || !data.frequencyMax) {
        errors.push("Frequency range is required");
      }
      if (
        data.frequencyMin &&
        data.frequencyMax &&
        data.frequencyMin >= data.frequencyMax
      ) {
        errors.push("Maximum frequency must be greater than minimum");
      }
      break;

    case "calibration": {
      // Accept either blockTypes or calibrationBlockTypes
      const hasBlockTypes =
        (data.blockTypes && data.blockTypes.length > 0) ||
        (data.calibrationBlockTypes && data.calibrationBlockTypes.length > 0);
      if (!hasBlockTypes) {
        errors.push("At least one calibration block type must be selected");
      }
      if (!data.sensitivityMethod) {
        errors.push("Sensitivity setting method is required");
      }
      break;
    }

    case "scan":
      // Accept either method or inspectionMethod
      if (!data.method && !data.inspectionMethod) {
        errors.push("Inspection method is required");
      }
      if (!data.scanType) {
        errors.push("Scan type is required");
      }
      if (!data.beamTypes || data.beamTypes.length === 0) {
        errors.push("At least one beam type must be selected");
      }
      break;

    case "acceptance": {
      // Accept either acceptanceClass or acceptanceClasses
      const hasAcceptance =
        data.acceptanceClass ||
        (data.acceptanceClasses && data.acceptanceClasses.length > 0);
      if (!hasAcceptance) {
        errors.push("At least one acceptance class is required");
      }
      if (!data.evaluationMethod) {
        errors.push("Evaluation method is required");
      }
      break;
    }

    case "documentation": {
      // Accept either inspectionLevel or personnelLevels
      const hasPersonnel =
        (data.inspectionLevel && data.inspectionLevel.length > 0) ||
        (data.personnelLevels && data.personnelLevels.length > 0);
      if (!hasPersonnel) {
        errors.push("Personnel qualification levels are required");
      }
      if (!data.requiredRecords || data.requiredRecords.length === 0) {
        errors.push("At least one record type must be selected");
      }
      if (!data.retentionPeriod) {
        errors.push("Record retention period is required");
      }
      break;
    }

    case "review":
      // No validation for review step itself
      break;
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// Calculate wizard completion percentage
export function calculateWizardCompletion(data: ProcedureWizardData): number {
  const steps = [
    "standard",
    "scope",
    "equipment",
    "calibration",
    "scan",
    "acceptance",
    "documentation",
  ];

  let completedSteps = 0;

  for (const step of steps) {
    const { valid } = validateWizardData(data, step);
    if (valid) {
      completedSteps++;
    }
  }

  return Math.round((completedSteps / steps.length) * 100);
}
