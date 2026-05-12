export interface TubeAngleBeamDrawingRow {
  blockId: string;
  nominalDiameter: number;
  diameterRange: [number, number];
  nominalThickness: number;
  thicknessRange: [number, number];
  imageSrc?: string;
}

export interface TubeAngleBeamDrawingSelection {
  requested: TubeAngleBeamDrawingRow;
  displayed: TubeAngleBeamDrawingRow;
  imageSrc: string;
  exactImageAvailable: boolean;
  diameterInRange: boolean;
  thicknessInRange: boolean;
}

const ASSET_BASE = "/standards/tube-angle-beam";

const availableImages: Record<string, string> = {
  "D2-T1": `${ASSET_BASE}/d2-t1.jpg`,
  "D3-T1": `${ASSET_BASE}/d3-t1.jpg`,
  "D4-T1": `${ASSET_BASE}/d4-t1.jpg`,
  "D4-T2": `${ASSET_BASE}/d4-t2.jpg`,
  "D5-T1": `${ASSET_BASE}/d5-t1.jpg`,
  "D5-T2": `${ASSET_BASE}/d5-t2.jpg`,
  "D6-T2": `${ASSET_BASE}/d6-t2.jpg`,
  "D7-T1": `${ASSET_BASE}/d7-t1.jpg`,
  "D7-T2": `${ASSET_BASE}/d7-t2.jpg`,
  "D8-T2": `${ASSET_BASE}/d8-t2.jpg`,
};

const drawingRows: Omit<TubeAngleBeamDrawingRow, "imageSrc">[] = [
  { blockId: "D1-T1", nominalDiameter: 200, diameterRange: [180, 220], nominalThickness: 80, thicknessRange: [60, 100] },
  { blockId: "D1-T2", nominalDiameter: 200, diameterRange: [180, 220], nominalThickness: 130, thicknessRange: [97, 162] },
  { blockId: "D2-T1", nominalDiameter: 250, diameterRange: [225, 275], nominalThickness: 80, thicknessRange: [60, 100] },
  { blockId: "D2-T2", nominalDiameter: 250, diameterRange: [225, 275], nominalThickness: 130, thicknessRange: [97, 162] },
  { blockId: "D3-T1", nominalDiameter: 310, diameterRange: [279, 341], nominalThickness: 80, thicknessRange: [60, 100] },
  { blockId: "D3-T2", nominalDiameter: 310, diameterRange: [279, 341], nominalThickness: 130, thicknessRange: [97, 162] },
  { blockId: "D4-T1", nominalDiameter: 380, diameterRange: [342, 418], nominalThickness: 80, thicknessRange: [60, 100] },
  { blockId: "D4-T2", nominalDiameter: 380, diameterRange: [342, 418], nominalThickness: 130, thicknessRange: [97, 162] },
  { blockId: "D5-T1", nominalDiameter: 460, diameterRange: [418, 506], nominalThickness: 80, thicknessRange: [60, 100] },
  { blockId: "D5-T2", nominalDiameter: 460, diameterRange: [418, 506], nominalThickness: 130, thicknessRange: [97, 162] },
  { blockId: "D6-T1", nominalDiameter: 550, diameterRange: [506, 612], nominalThickness: 80, thicknessRange: [60, 100] },
  { blockId: "D6-T2", nominalDiameter: 550, diameterRange: [506, 612], nominalThickness: 130, thicknessRange: [97, 162] },
  { blockId: "D7-T1", nominalDiameter: 670, diameterRange: [602, 740], nominalThickness: 80, thicknessRange: [60, 100] },
  { blockId: "D7-T2", nominalDiameter: 670, diameterRange: [602, 740], nominalThickness: 130, thicknessRange: [97, 162] },
  { blockId: "D8-T1", nominalDiameter: 810, diameterRange: [740, 891], nominalThickness: 80, thicknessRange: [60, 100] },
  { blockId: "D8-T2", nominalDiameter: 810, diameterRange: [740, 891], nominalThickness: 130, thicknessRange: [97, 162] },
];

export const TUBE_ANGLE_BEAM_DRAWINGS: TubeAngleBeamDrawingRow[] = drawingRows.map((row) => ({
  ...row,
  imageSrc: availableImages[row.blockId],
}));

export function isTubeAngleBeamPartType(partType?: string | null): boolean {
  return partType === "tube" || partType === "pipe";
}

export function formatTubeAngleBeamRange(range: [number, number]): string {
  return `${range[0]}-${range[1]} mm`;
}

export function getTubeAngleBeamDrawing(
  outerDiameter?: number,
  wallThickness?: number,
): TubeAngleBeamDrawingSelection | null {
  if (!isPositiveNumber(outerDiameter) || !isPositiveNumber(wallThickness)) {
    return null;
  }

  const requested = findBestRequestedRow(outerDiameter, wallThickness);
  const displayed = requested.imageSrc ? requested : findClosestAvailableRow(requested);

  return {
    requested,
    displayed,
    imageSrc: displayed.imageSrc || "",
    exactImageAvailable: requested.blockId === displayed.blockId,
    diameterInRange: isInRange(outerDiameter, requested.diameterRange),
    thicknessInRange: isInRange(wallThickness, requested.thicknessRange),
  };
}

function findBestRequestedRow(outerDiameter: number, wallThickness: number): TubeAngleBeamDrawingRow {
  const rangeMatches = TUBE_ANGLE_BEAM_DRAWINGS.filter(
    (row) => isInRange(outerDiameter, row.diameterRange) && isInRange(wallThickness, row.thicknessRange),
  );

  const candidates = rangeMatches.length > 0 ? rangeMatches : TUBE_ANGLE_BEAM_DRAWINGS;

  return [...candidates].sort((a, b) => {
    const scoreDelta = getRowScore(a, outerDiameter, wallThickness) - getRowScore(b, outerDiameter, wallThickness);
    if (scoreDelta !== 0) return scoreDelta;
    return a.blockId.localeCompare(b.blockId);
  })[0];
}

function findClosestAvailableRow(requested: TubeAngleBeamDrawingRow): TubeAngleBeamDrawingRow {
  const availableRows = TUBE_ANGLE_BEAM_DRAWINGS.filter((row) => Boolean(row.imageSrc));
  const sameThicknessRows = availableRows.filter((row) => row.nominalThickness === requested.nominalThickness);
  const candidates = sameThicknessRows.length > 0 ? sameThicknessRows : availableRows;

  return [...candidates].sort((a, b) => {
    const diameterDelta =
      Math.abs(a.nominalDiameter - requested.nominalDiameter) -
      Math.abs(b.nominalDiameter - requested.nominalDiameter);
    if (diameterDelta !== 0) return diameterDelta;
    return a.blockId.localeCompare(b.blockId);
  })[0];
}

function getRowScore(row: TubeAngleBeamDrawingRow, outerDiameter: number, wallThickness: number): number {
  const diameterHalfSpan = Math.max((row.diameterRange[1] - row.diameterRange[0]) / 2, 1);
  const thicknessHalfSpan = Math.max((row.thicknessRange[1] - row.thicknessRange[0]) / 2, 1);
  const diameterScore = Math.abs(outerDiameter - row.nominalDiameter) / diameterHalfSpan;
  const thicknessScore = Math.abs(wallThickness - row.nominalThickness) / thicknessHalfSpan;
  const rangePenalty =
    (isInRange(outerDiameter, row.diameterRange) ? 0 : 10) +
    (isInRange(wallThickness, row.thicknessRange) ? 0 : 10);

  return rangePenalty + diameterScore + thicknessScore;
}

function isInRange(value: number, [min, max]: [number, number]): boolean {
  return value >= min && value <= max;
}

function isPositiveNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}
