import {
  ACTIVE_MRO_PART_NUMBERS,
  inferMroStandardFromPartNumber,
  isActiveMroStandard,
} from "@/utils/mroPolicy";
import type { StandardType } from "@/types/techniqueSheet";

export interface RawMroAssetEntry {
  name: string;
  extension: string;
  size: number;
  modifiedAt?: string;
  assetUrl: string;
  downloadUrl: string;
}

export interface RawMroAssetCatalogResponse {
  available: boolean;
  baseDir: string | null;
  assets: RawMroAssetEntry[];
  message?: string;
}

export type MroAssetCategory =
  | "procedure"
  | "gating-scheme"
  | "presentation"
  | "qualification"
  | "3d-model"
  | "other";

export interface MroAssetEntry extends RawMroAssetEntry {
  category: MroAssetCategory;
  categoryLabel: string;
  title: string;
  description: string;
  partNumbers: string[];
  standards: string[];
}

export const MRO_CATEGORY_LABELS: Record<MroAssetCategory, string> = {
  procedure: "Procedures",
  "gating-scheme": "Gating Schemes",
  presentation: "Presentations",
  qualification: "Qualification / Supporting Docs",
  "3d-model": "3D Models",
  other: "Other Files",
};

const PART_NUMBER_PATTERN = /\b(2A5001|2A4802)\b/gi;
const STANDARD_PATTERNS: Array<{ regex: RegExp; standard: string }> = [
  { regex: /\bNDIP[-\s]?1226\b/i, standard: "NDIP-1226" },
  { regex: /\bNDIP[-\s]?1227\b/i, standard: "NDIP-1227" },
];

function dedupe(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

function titleFromName(name: string): string {
  return name.replace(/\.[^.]+$/, "").replace(/_/g, " ");
}

export function inferMroAssetCategory(name: string, extension: string): MroAssetCategory {
  const upperName = name.toUpperCase();
  const lowerExtension = extension.toLowerCase();

  if (lowerExtension === ".stl") return "3d-model";
  if (upperName.includes("GATING SCHEME")) return "gating-scheme";
  if (upperName.includes("PROCEDURE") || upperName.includes("NDIP")) return "procedure";
  if (lowerExtension === ".pptx") return "presentation";
  if (upperName.includes("QUALIFICATION")) return "qualification";
  if (lowerExtension === ".pdf") return "qualification";
  return "other";
}

export function inferMroPartNumbers(name: string): string[] {
  return dedupe(Array.from(name.matchAll(PART_NUMBER_PATTERN), ([match]) => match.toUpperCase()));
}

export function inferMroStandards(name: string): string[] {
  const partNumberStandards = inferMroPartNumbers(name)
    .map((partNumber) => inferMroStandardFromPartNumber(partNumber))
    .filter((standard): standard is StandardType => Boolean(standard));

  return dedupe([
    ...STANDARD_PATTERNS.filter(({ regex }) => regex.test(name)).map(({ standard }) => standard),
    ...partNumberStandards,
  ]);
}

export function inferMroAssetDescription(
  name: string,
  category: MroAssetCategory,
): string {
  const standards = inferMroStandards(name);
  const partNumbers = inferMroPartNumbers(name);
  const suffix: string[] = [];

  if (standards.length > 0) {
    suffix.push(standards.join(", "));
  }

  if (partNumbers.length > 0) {
    suffix.push(`P/N ${partNumbers.join(", ")}`);
  }

  const base =
    category === "3d-model"
      ? "Approved local MRO 3D reference model"
      : category === "gating-scheme"
        ? "Inspection gating reference sheet"
        : category === "procedure"
          ? "Procedure / standard reference document"
          : category === "presentation"
            ? "Presentation / OEM reference package"
            : category === "qualification"
              ? "Qualification or supporting reference document"
              : "Local MRO supporting file";

  return suffix.length > 0 ? `${base} | ${suffix.join(" | ")}` : base;
}

export function enrichMroAsset(raw: RawMroAssetEntry): MroAssetEntry {
  const category = inferMroAssetCategory(raw.name, raw.extension);
  return {
    ...raw,
    category,
    categoryLabel: MRO_CATEGORY_LABELS[category],
    title: titleFromName(raw.name),
    description: inferMroAssetDescription(raw.name, category),
    partNumbers: inferMroPartNumbers(raw.name),
    standards: inferMroStandards(raw.name),
  };
}

export function formatMroAssetSize(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export function sortMroAssets(assets: MroAssetEntry[]): MroAssetEntry[] {
  return [...assets].sort((left, right) => {
    if (left.category !== right.category) {
      return left.category.localeCompare(right.category);
    }

    return left.name.localeCompare(right.name);
  });
}

export function getRelevantMroAssets(
  assets: MroAssetEntry[],
  context: { partNumber?: string; standard?: string; partType?: string },
): MroAssetEntry[] {
  const normalizedPartNumber = context.partNumber?.trim().toUpperCase();
  const normalizedStandard = context.standard?.trim().toUpperCase();
  const normalizedPartType = context.partType?.trim().toLowerCase();
  const isV2500HptContext =
    normalizedPartType === "hpt_disk" ||
    ACTIVE_MRO_PART_NUMBERS.some((partNumber) => partNumber === normalizedPartNumber) ||
    isActiveMroStandard(normalizedStandard);

  return assets.filter((asset) => {
    const partMatch =
      normalizedPartNumber &&
      asset.partNumbers.some((partNumber) => partNumber.toUpperCase() === normalizedPartNumber);
    const standardMatch =
      normalizedStandard &&
      asset.standards.some((standard) => standard.toUpperCase() === normalizedStandard);
    const v2500ModelMatch =
      isV2500HptContext &&
      asset.category === "3d-model" &&
      asset.name.toUpperCase().includes("V2500");

    return Boolean(partMatch || standardMatch || v2500ModelMatch);
  });
}

export function groupMroAssetsByCategory(
  assets: MroAssetEntry[],
): Record<MroAssetCategory, MroAssetEntry[]> {
  return assets.reduce(
    (groups, asset) => {
      groups[asset.category].push(asset);
      return groups;
    },
    {
      procedure: [],
      "gating-scheme": [],
      presentation: [],
      qualification: [],
      "3d-model": [],
      other: [],
    } as Record<MroAssetCategory, MroAssetEntry[]>,
  );
}

export async function fetchMroAssetCatalog(): Promise<RawMroAssetCatalogResponse> {
  const response = await fetch("/api/mro-assets");

  if (!response.ok) {
    throw new Error(`Failed to load MRO assets (${response.status})`);
  }

  return response.json() as Promise<RawMroAssetCatalogResponse>;
}
