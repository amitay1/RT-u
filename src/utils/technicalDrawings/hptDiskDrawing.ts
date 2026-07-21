/**
 * HPT Disk Technical Drawing Module
 * Generates bore profile cross-section per NDIP-1226/NDIP-1227 Figure 2.
 *
 * Front View:   Bore opening (hub OD + bore ID concentric circles)
 * Section A-A:  Axial section of bore area:
 *               - Stage 1 (NDIP-1226): surfaces E, A, B, C, D
 *               - Stage 2 (NDIP-1227): surfaces M, N, O, P (upper) + K, L (lower)
 *               with hatched material body, ±45° shear beam paths,
 *               and 2.6" radial coverage dimension.
 */

import { TechnicalDrawingGenerator, Dimensions, LayoutConfig } from './TechnicalDrawingGenerator';
import { drawDiskTechnicalDrawing } from './diskDrawing';
import type { StandardType } from '@/types/techniqueSheet';

export function drawHptDiskTechnicalDrawing(
  generator: TechnicalDrawingGenerator,
  dimensions: Dimensions,
  layout: LayoutConfig,
  options?: {
    standardType?: StandardType;
    partNumber?: string;
    stage?: 1 | 2;
    enabledDirections?: string[];
    directionColors?: Record<string, string>;
  }
): void {
  const stage = resolveV2500Stage(options);

  if (drawStageReferenceFigure(generator, dimensions, layout, stage, options)) {
    return;
  }
  drawDiskTechnicalDrawing(generator, dimensions, layout);
}

function drawStageReferenceFigure(
  generator: TechnicalDrawingGenerator,
  dimensions: Dimensions,
  layout: LayoutConfig,
  stage: 1 | 2,
  options?: {
    standardType?: StandardType;
    partNumber?: string;
    stage?: 1 | 2;
    enabledDirections?: string[];
    directionColors?: Record<string, string>;
  }
): boolean {
  const scope = generator.getScope();
  if (!scope?.Raster) {
    return false;
  }

  const x = layout.frontView.x;
  const y = layout.frontView.y;
  const width = layout.sideView.x + layout.sideView.width - layout.frontView.x;
  const height = Math.max(layout.frontView.height, layout.sideView.height);
  const figureLabel = stage === 2 ? 'NDIP-1227' : 'NDIP-1226';
  const figureDescription =
    stage === 2
      ? 'Stage 2 reference profile with M/N/O/P/K/L coverage layout'
      : 'Stage 1 reference profile with E/A/B/C/D coverage layout';
  const imagePath =
    stage === 2
      ? '/standards/hpt-disk-setup-stage2.png'
      : '/standards/hpt-disk-setup-stage1.png';

  generator.drawText(x + width / 2, y - 5, `HPT DISK SECTION - ${figureLabel} FIGURE 2`, 11, '#000000');
  generator.drawText(x + width / 2, y + height + 12, figureDescription, 10, '#666666');

  const raster = new scope.Raster(imagePath) as any;
  raster.onLoad = () => {
    const framePaddingX = 16;
    const framePaddingTop = 8;
    const framePaddingBottom = 18;
    const frameRect = new scope.Path.Rectangle(
      new scope.Rectangle(
        new scope.Point(x + framePaddingX, y + framePaddingTop),
        new scope.Size(width - framePaddingX * 2, height - framePaddingTop - framePaddingBottom)
      )
    );
    frameRect.strokeColor = new scope.Color('#d1d5db');
    frameRect.strokeWidth = 1;
    frameRect.fillColor = new scope.Color('#ffffff');

    raster.fitBounds(frameRect.bounds);
    raster.position = frameRect.bounds.center;
    raster.bringToFront();

    const badge = new scope.Path.Rectangle(
      new scope.Rectangle(
        new scope.Point(x + width - 180, y + 10),
        new scope.Size(154, 24)
      ),
      new scope.Size(8, 8)
    );
    badge.fillColor = new scope.Color('#eff6ff');
    badge.strokeColor = new scope.Color('#93c5fd');
    badge.strokeWidth = 1;

    const badgeText = new scope.PointText(new scope.Point(x + width - 103, y + 26));
    badgeText.content = options?.partNumber ? `PN ${options.partNumber}` : 'V2500 HPT Disk';
    badgeText.justification = 'center';
    badgeText.fontFamily = 'monospace';
    badgeText.fontSize = 11;
    badgeText.fontWeight = 'bold' as any;
    badgeText.fillColor = new scope.Color('#1d4ed8');

    generator.render();
  };

  raster.onError = () => {
    raster.remove();
    drawDiskTechnicalDrawing(generator, dimensions, layout);
    generator.render();
  };

  return true;
}

/* ------------------------------------------------------------------ */
/* Front View — bore opening with hub OD and bore ID                  */
/* ------------------------------------------------------------------ */
function drawBoreOpeningView(
  generator: TechnicalDrawingGenerator,
  od: number,
  id: number,
  viewConfig?: { x: number; y: number; width: number; height: number }
) {
  if (!viewConfig) return;
  const { x, y, width, height } = viewConfig;

  generator.drawViewLabel(x + width / 2, y, 'FRONT VIEW — BORE');

  const scale = Math.min(width, height) * 0.5 / od;
  const cx = x + width / 2;
  const cy = y + height / 2;
  const hubR = (od * scale) / 2;
  const boreR = (id * scale) / 2;

  // Hub outer + bore inner circles
  generator.drawCircle(cx, cy, hubR, 'visible');
  generator.drawCircle(cx, cy, boreR, 'visible');

  // Centerlines
  generator.drawLine(cx - hubR - 20, cy, cx + hubR + 20, cy, 'center');
  generator.drawLine(cx, cy - hubR - 20, cx, cy + hubR + 20, 'center');

  // Section cutting plane A-A (horizontal through centre)
  generator.drawSectionIndicator(cx - hubR - 10, cy, cx + hubR + 10, cy, 'A-A');

  // Dimensions
  generator.drawDimension(cx - hubR, cy + hubR + 30, cx + hubR, cy + hubR + 30,
    `\u00D8${od}mm (HUB OD)`, 5);
  generator.drawDimension(cx - boreR, cy - hubR - 30, cx + boreR, cy - hubR - 30,
    `\u00D8${id.toFixed(1)}mm (BORE ID)`, 5);

  generator.drawText(cx, cy - 5, 'HPT DISK', 11, '#D35400');
  generator.drawText(cx, cy + 10, 'BORE OPENING', 8, '#666666');
}

/* ------------------------------------------------------------------ */
/* Section A-A — Bore profile per NDIP-1226 Figure 2                  */
/*                                                                    */
/* Orientation (matches the standard figure):                         */
/*   LEFT   = radially outward  (disk body, hatched)                  */
/*   RIGHT  = bore wall / axis side                                   */
/*   TOP    = hub face                                                */
/*   BOTTOM = bore continues axially                                  */
/*                                                                    */
/* Profile (top → down along inner contour):                          */
/*   hub face → E (fillet arc) → A (chamfer) → B (land) →            */
/*   C (chamfer) → D (bore wall, vertical)                            */
/* ------------------------------------------------------------------ */
function drawBoreProfileView(
  generator: TechnicalDrawingGenerator,
  stage: 1 | 2,
  od: number,
  id: number,
  thickness: number,
  viewConfig?: { x: number; y: number; width: number; height: number },
  options?: {
    standardType?: StandardType;
    partNumber?: string;
    stage?: 1 | 2;
    enabledDirections?: string[];
    directionColors?: Record<string, string>;
  }
) {
  if (!viewConfig) return;

  if (stage === 2) {
    drawBoreProfileViewStage2(generator, od, id, thickness, viewConfig, options);
    return;
  }

  drawBoreProfileViewStage1(generator, od, id, thickness, viewConfig, options);
}

/* ------------------------------------------------------------------ */
/* Stage 1 (NDIP-1226) — Bore profile surfaces E, A, B, C, D           */
/* ------------------------------------------------------------------ */
function drawBoreProfileViewStage1(
  generator: TechnicalDrawingGenerator,
  _od: number,
  _id: number,
  _thickness: number,
  viewConfig: { x: number; y: number; width: number; height: number },
  options?: {
    enabledDirections?: string[];
    directionColors?: Record<string, string>;
  }
) {
  const { x, y, width, height } = viewConfig;

  generator.drawViewLabel(x + width / 2, y, 'SECTION A-A - BORE PROFILE (NDIP-1226)');
  const scope = generator.getScope();

  const BASE = {
    cy: 270,
    hubTop: 42,
    hubBot: 498,
    hubLeft: 0,
    hubRight: 530,
    webLeft: -60,
    webThick: 38,
  } as const;

  const baseWidth = BASE.hubRight - BASE.webLeft;
  const baseHeight = BASE.hubBot - BASE.hubTop;
  const sc = Math.min((width * 0.92) / baseWidth, (height * 0.82) / baseHeight);
  const ox = x + (width - baseWidth * sc) / 2 - BASE.webLeft * sc;
  const oy = y + (height - baseHeight * sc) / 2 - BASE.hubTop * sc;

  const T = (p: { x: number; y: number }) => ({ x: ox + p.x * sc, y: oy + p.y * sc });

  const norm = (v: string) => v.trim().toUpperCase();
  const enabled = (options?.enabledDirections ?? []).map(norm).filter(Boolean);
  const enabledSet = new Set(enabled);

  // Surfaces are scanned in BOTH +/-45 shear modes per NDIP Figure 2.
  // Only hide a beam if the UI explicitly provides a beam-mode filter (+45/-45, POS/NEG).
  const hasPosBeamFlag = enabledSet.has('E') || enabledSet.has('+45') || enabledSet.has('POSITIVE') || enabledSet.has('POS');
  const hasNegBeamFlag = enabledSet.has('D') || enabledSet.has('-45') || enabledSet.has('NEGATIVE') || enabledSet.has('NEG');
  const beamFlagsProvided = hasPosBeamFlag || hasNegBeamFlag;
  const showPos = !beamFlagsProvided || hasPosBeamFlag;
  const showNeg = !beamFlagsProvided || hasNegBeamFlag;

  const posColor =
    options?.directionColors?.E ??
    options?.directionColors?.['+45'] ??
    options?.directionColors?.POS ??
    options?.directionColors?.POSITIVE ??
    '#dc2626';
  const negColor =
    options?.directionColors?.D ??
    options?.directionColors?.['-45'] ??
    options?.directionColors?.NEG ??
    options?.directionColors?.NEGATIVE ??
    '#2563eb';

  const OUTLINE = '#111827';
  const THIN = '#374151';

  const drawStyledLine = (
    a: { x: number; y: number },
    b: { x: number; y: number },
    color: string,
    widthPx: number,
    dash?: number[]
  ) => {
    const p1 = T(a);
    const p2 = T(b);
    const seg = generator.drawLine(p1.x, p1.y, p2.x, p2.y, 'visible') as any;
    seg.strokeColor = new scope.Color(color);
    seg.strokeWidth = widthPx;
    seg.dashArray = dash;
  };

  const drawCubic = (
    p0: { x: number; y: number },
    p1: { x: number; y: number },
    p2: { x: number; y: number },
    p3: { x: number; y: number },
    color: string,
    widthPx: number,
    dash?: number[]
  ) => {
    const steps = 20;
    let prev = p0;
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const mt = 1 - t;
      const pt = {
        x: mt * mt * mt * p0.x + 3 * mt * mt * t * p1.x + 3 * mt * t * t * p2.x + t * t * t * p3.x,
        y: mt * mt * mt * p0.y + 3 * mt * mt * t * p1.y + 3 * mt * t * t * p2.y + t * t * t * p3.y,
      };
      drawStyledLine(prev, pt, color, widthPx, dash);
      prev = pt;
    }
  };

  const mirror = (p: { x: number; y: number }) => ({ x: p.x, y: 2 * BASE.cy - p.y });
  const cy = BASE.cy;

  // Upper bore profile: E -> A -> B -> C -> D
  const E_start = { x: 40, y: cy - 55 };
  const E_ctrl1 = { x: 55, y: cy - 90 };
  const E_ctrl2 = { x: 80, y: cy - 135 };
  const E_end = { x: 120, y: cy - 152 };

  const A_end = { x: 170, y: cy - 168 };
  const B_end = { x: 430, y: cy - 168 };
  const C_end = { x: 470, y: cy - 132 };

  const D_top = { x: 470, y: cy - 132 };
  const D_bot = { x: 470, y: cy };

  // Lower profile mirrors (dashed)
  const E_start_m = mirror(E_start);
  const E_ctrl1_m = mirror(E_ctrl1);
  const E_ctrl2_m = mirror(E_ctrl2);
  const E_end_m = mirror(E_end);
  const A_end_m = mirror(A_end);
  const B_end_m = mirror(B_end);
  const C_end_m = mirror(C_end);
  const D_top_m = mirror(D_top);

  // Material outline (match the OEM scan plan figure: no hatch fill, thick edges)
  drawStyledLine({ x: BASE.hubLeft, y: BASE.hubTop }, { x: BASE.hubRight, y: BASE.hubTop }, OUTLINE, 2);
  drawStyledLine({ x: BASE.hubRight, y: BASE.hubTop }, { x: BASE.hubRight, y: D_top.y }, OUTLINE, 2);
  drawStyledLine({ x: BASE.hubRight, y: D_top_m.y }, { x: BASE.hubRight, y: BASE.hubBot }, OUTLINE, 2);
  drawStyledLine({ x: BASE.hubRight, y: BASE.hubBot }, { x: BASE.hubLeft, y: BASE.hubBot }, OUTLINE, 2);
  drawStyledLine({ x: BASE.hubLeft, y: BASE.hubBot }, { x: BASE.hubLeft, y: cy + BASE.webThick }, OUTLINE, 2);
  drawStyledLine({ x: BASE.hubLeft, y: cy - BASE.webThick }, { x: BASE.hubLeft, y: BASE.hubTop }, OUTLINE, 2);

  // Web stubs
  drawStyledLine({ x: BASE.hubLeft, y: cy - BASE.webThick }, { x: BASE.webLeft, y: cy - BASE.webThick }, OUTLINE, 2);
  drawStyledLine({ x: BASE.webLeft, y: cy - BASE.webThick }, { x: BASE.webLeft, y: cy + BASE.webThick }, OUTLINE, 2);
  drawStyledLine({ x: BASE.webLeft, y: cy + BASE.webThick }, { x: BASE.hubLeft, y: cy + BASE.webThick }, OUTLINE, 2);
  generator.drawText(T({ x: BASE.webLeft + 18, y: cy + 4 }).x, T({ x: 0, y: cy + 4 }).y, 'WEB', 8, '#6b7280');

  // Bore cavity right edge
  drawStyledLine({ x: BASE.hubRight, y: D_top.y }, { x: BASE.hubRight, y: D_top_m.y }, OUTLINE, 2);

  // Axis line
  const axisA = T({ x: BASE.webLeft - 20, y: cy });
  const axisB = T({ x: BASE.hubRight + 30, y: cy });
  const axis = generator.drawLine(axisA.x, axisA.y, axisB.x, axisB.y, 'center') as any;
  axis.strokeColor = new scope.Color('#6b7280');
  axis.strokeWidth = 0.8;
  axis.dashArray = [20 * sc, 4 * sc, 4 * sc, 4 * sc];

  // Bore profile surfaces (upper) - same palette as the SVG diagram component
  const C_E = '#2563eb';
  const C_A = '#7c3aed';
  const C_B = '#059669';
  const C_C = '#d97706';
  const C_D = '#dc2626';

  drawCubic(E_start, E_ctrl1, E_ctrl2, E_end, C_E, 3.2);
  drawStyledLine(E_end, A_end, C_A, 3.2);
  drawStyledLine(A_end, B_end, C_B, 3.2);
  drawStyledLine(B_end, C_end, C_C, 3.2);
  drawStyledLine(D_top, D_bot, C_D, 3.2);

  // Lower profile - dashed mirrors + thin outline
  const mirrorDash = [6, 3];
  drawCubic(E_start_m, E_ctrl1_m, E_ctrl2_m, E_end_m, C_E, 2.4, mirrorDash);
  drawStyledLine(E_end_m, A_end_m, C_A, 2.4, mirrorDash);
  drawStyledLine(A_end_m, B_end_m, C_B, 2.4, mirrorDash);
  drawStyledLine(B_end_m, C_end_m, C_C, 2.4, mirrorDash);
  drawStyledLine(D_top_m, D_bot, C_D, 2.4, mirrorDash);

  drawCubic(E_start_m, E_ctrl1_m, E_ctrl2_m, E_end_m, THIN, 1.4);
  drawStyledLine(E_end_m, A_end_m, THIN, 1.4);
  drawStyledLine(A_end_m, B_end_m, THIN, 1.4);
  drawStyledLine(B_end_m, C_end_m, THIN, 1.4);
  drawStyledLine(C_end_m, D_top_m, THIN, 1.4);

  // Labels (positions taken from V2500BoreScanDiagram)
  generator.drawText(T({ x: 80, y: cy - 116 }).x, T({ x: 0, y: cy - 116 }).y, 'E', 11, C_E);
  generator.drawText(T({ x: 145, y: cy - 174 }).x, T({ x: 0, y: cy - 174 }).y, 'A', 11, C_A);
  generator.drawText(T({ x: 300, y: cy - 191 }).x, T({ x: 0, y: cy - 191 }).y, 'B', 11, C_B);
  generator.drawText(T({ x: 450, y: cy - 164 }).x, T({ x: 0, y: cy - 164 }).y, 'C', 11, C_C);
  generator.drawText(T({ x: D_top.x + 28, y: (D_top.y + D_bot.y) / 2 + 4 }).x, T({ x: 0, y: (D_top.y + D_bot.y) / 2 + 4 }).y, 'D', 11, C_D);

  // Shear wave legend
  const legend = { x: BASE.webLeft + 5, y: BASE.hubTop + 18 };
  if (showNeg) {
    const la = T({ x: legend.x, y: legend.y });
    const lb = T({ x: legend.x + 40, y: legend.y });
    const legLine = generator.drawLine(la.x, la.y, lb.x, lb.y, 'hidden') as any;
    legLine.strokeColor = new scope.Color(negColor);
    legLine.strokeWidth = 1.6;
    legLine.dashArray = [6, 3];
    generator.drawText(lb.x + 60, la.y + 4, '-45 Shear Wave', 8, THIN);
  }
  if (showPos) {
    const la = T({ x: legend.x, y: legend.y + 12 });
    const lb = T({ x: legend.x + 40, y: legend.y + 12 });
    const legLine = generator.drawLine(la.x, la.y, lb.x, lb.y, 'hidden') as any;
    legLine.strokeColor = new scope.Color(posColor);
    legLine.strokeWidth = 1.6;
    legLine.dashArray = [6, 3];
    generator.drawText(lb.x + 60, la.y + 4, '+45 Shear Wave', 8, THIN);
  }

  // Beam paths
  const beamLen = 70;
  const midB = (A_end.x + B_end.x) / 2;
  const landOriginY = A_end.y - 55;

  if (showPos) {
    drawStyledLine(
      { x: midB, y: landOriginY },
      { x: midB + beamLen * Math.sin(Math.PI / 4), y: landOriginY + beamLen * Math.cos(Math.PI / 4) },
      posColor,
      2,
      [6, 3]
    );
  }
  if (showNeg) {
    const x0 = midB + 60;
    drawStyledLine(
      { x: x0, y: landOriginY },
      { x: x0 - beamLen * Math.sin(Math.PI / 4), y: landOriginY + beamLen * Math.cos(Math.PI / 4) },
      negColor,
      2,
      [6, 3]
    );
  }

  const waterY = (D_top.y + cy) / 2;
  if (showPos) {
    drawStyledLine(
      { x: D_top.x + 50, y: waterY - 15 },
      { x: D_top.x + 5, y: waterY - 15 + 40 },
      posColor,
      1.8,
      [5, 3]
    );
  }
  if (showNeg) {
    drawStyledLine(
      { x: D_top.x + 50, y: waterY + 15 },
      { x: D_top.x + 5, y: waterY + 15 - 40 },
      negColor,
      1.8,
      [5, 3]
    );
  }
  if (showPos || showNeg) {
    generator.drawText(T({ x: D_top.x + 55, y: waterY - 2 }).x, T({ x: 0, y: waterY - 2 }).y, 'WATER', 7, '#0ea5e9');
    generator.drawText(T({ x: D_top.x + 55, y: waterY + 10 }).x, T({ x: 0, y: waterY + 10 }).y, '8.0"', 7, '#0ea5e9');
  }

  // Dimensions (key NDIP callouts)
  const dimOffset = 30 * sc;

  const covA = T({ x: E_start.x, y: BASE.hubTop });
  const covB = T({ x: D_top.x, y: BASE.hubTop });
  generator.drawDimension(covA.x, covA.y, covB.x, covB.y, '2.6" COVERAGE', -dimOffset);

  const radA = T({ x: D_top.x, y: cy });
  const radB = T({ x: BASE.hubRight + 10, y: cy });
  generator.drawDimension(radA.x, radA.y, radB.x, radB.y, 'R 2.91"', dimOffset);

  const offA = T({ x: BASE.hubRight + 30, y: cy });
  const offB = T({ x: BASE.hubRight + 30, y: A_end.y });
  generator.drawDimension(offA.x, offA.y, offB.x, offB.y, '0.943" OFFSET', 0);

  generator.drawText(T({ x: BASE.webLeft + 65, y: BASE.hubBot + 20 }).x, T({ x: 0, y: BASE.hubBot + 20 }).y, 'MAX SCAN: 0.020"', 8, '#6b7280');
  generator.drawText(T({ x: BASE.webLeft + 85, y: BASE.hubBot + 32 }).x, T({ x: 0, y: BASE.hubBot + 32 }).y, 'MAX INDEX: 0.020"/REV', 8, '#6b7280');

  // Reference footer
  generator.drawText(x + width / 2, y + height - 8, 'PER NDIP-1226 FIG. 2', 8, '#888888');
}

/* ------------------------------------------------------------------ */
/* Stage 2 (NDIP-1227) — Bore scan plan surfaces M,N,O,P,K,L           */
/* This is intentionally based on the same coordinate proportions used */
/* in V2500BoreScanDiagram to match the OEM scan plan figure.          */
/* ------------------------------------------------------------------ */
function drawBoreProfileViewStage2(
  generator: TechnicalDrawingGenerator,
  _od: number,
  _id: number,
  _thickness: number,
  viewConfig: { x: number; y: number; width: number; height: number },
  options?: {
    enabledDirections?: string[];
    directionColors?: Record<string, string>;
  }
) {
  const { x, y, width, height } = viewConfig;

  generator.drawViewLabel(x + width / 2, y, 'SECTION A-A - BORE PROFILE (NDIP-1227)');
  const scope = generator.getScope();

  const BASE = {
    cy: 270,
    hubTop: 38,
    hubBot: 502,
    hubLeft: 0,
    hubRight: 520,
    webLeft: -55,
    webThick: 36,
  } as const;

  const baseWidth = BASE.hubRight - BASE.webLeft;
  const baseHeight = BASE.hubBot - BASE.hubTop;
  const sc = Math.min((width * 0.92) / baseWidth, (height * 0.82) / baseHeight);
  const ox = x + (width - baseWidth * sc) / 2 - BASE.webLeft * sc;
  const oy = y + (height - baseHeight * sc) / 2 - BASE.hubTop * sc;

  const T = (p: { x: number; y: number }) => ({ x: ox + p.x * sc, y: oy + p.y * sc });

  const norm = (v: string) => v.trim().toUpperCase();
  const enabled = (options?.enabledDirections ?? []).map(norm).filter(Boolean);
  const enabledSet = new Set(enabled);

  // Surfaces are scanned in BOTH +/-45 shear modes per NDIP Figure 2.
  // Only hide a beam if the UI explicitly provides a beam-mode filter (+45/-45, POS/NEG).
  const hasPosBeamFlag = enabledSet.has('E') || enabledSet.has('+45') || enabledSet.has('POSITIVE') || enabledSet.has('POS');
  const hasNegBeamFlag = enabledSet.has('D') || enabledSet.has('-45') || enabledSet.has('NEGATIVE') || enabledSet.has('NEG');
  const beamFlagsProvided = hasPosBeamFlag || hasNegBeamFlag;
  const showPos = !beamFlagsProvided || hasPosBeamFlag;
  const showNeg = !beamFlagsProvided || hasNegBeamFlag;

  const posColor =
    options?.directionColors?.E ??
    options?.directionColors?.['+45'] ??
    options?.directionColors?.POS ??
    options?.directionColors?.POSITIVE ??
    '#dc2626';
  const negColor =
    options?.directionColors?.D ??
    options?.directionColors?.['-45'] ??
    options?.directionColors?.NEG ??
    options?.directionColors?.NEGATIVE ??
    '#2563eb';

  const OUTLINE = '#111827';
  const THIN = '#374151';

  const drawStyledLine = (
    a: { x: number; y: number },
    b: { x: number; y: number },
    color: string,
    widthPx: number,
    dash?: number[]
  ) => {
    const p1 = T(a);
    const p2 = T(b);
    const seg = generator.drawLine(p1.x, p1.y, p2.x, p2.y, 'visible') as any;
    seg.strokeColor = new scope.Color(color);
    seg.strokeWidth = widthPx;
    seg.dashArray = dash;
  };

  const drawCubic = (
    p0: { x: number; y: number },
    p1: { x: number; y: number },
    p2: { x: number; y: number },
    p3: { x: number; y: number },
    color: string,
    widthPx: number,
    dash?: number[]
  ) => {
    const steps = 20;
    let prev = p0;
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const mt = 1 - t;
      const pt = {
        x: mt * mt * mt * p0.x + 3 * mt * mt * t * p1.x + 3 * mt * t * t * p2.x + t * t * t * p3.x,
        y: mt * mt * mt * p0.y + 3 * mt * mt * t * p1.y + 3 * mt * t * t * p2.y + t * t * t * p3.y,
      };
      drawStyledLine(prev, pt, color, widthPx, dash);
      prev = pt;
    }
  };

  const drawQuadratic = (
    p0: { x: number; y: number },
    p1: { x: number; y: number },
    p2: { x: number; y: number },
    color: string,
    widthPx: number,
    dash?: number[]
  ) => {
    const steps = 12;
    let prev = p0;
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const mt = 1 - t;
      const pt = {
        x: mt * mt * p0.x + 2 * mt * t * p1.x + t * t * p2.x,
        y: mt * mt * p0.y + 2 * mt * t * p1.y + t * t * p2.y,
      };
      drawStyledLine(prev, pt, color, widthPx, dash);
      prev = pt;
    }
  };

  const cy = BASE.cy;

  // Upper bore profile: M -> N -> O -> P
  const M_start = { x: 30, y: cy - 50 };
  const M_ctrl1 = { x: 55, y: cy - 95 };
  const M_ctrl2 = { x: 100, y: cy - 145 };
  const M_end = { x: 150, y: cy - 165 };

  const N_ctrl = { x: 175, y: cy - 185 };
  const N_end = { x: 205, y: cy - 190 };

  const O_end = { x: 295, y: cy - 190 };

  const P_top = { x: 320, y: cy - 190 };
  const P_bot = { x: 320, y: cy };
  const P_bot_m = { x: 320, y: cy + 200 };

  // Lower bore profile: K -> L
  const K_start = { x: 30, y: cy + 50 };
  const K_ctrl1 = { x: 55, y: cy + 95 };
  const K_ctrl2 = { x: 85, y: cy + 125 };
  const K_end = { x: 130, y: cy + 150 };

  const L_end = { x: 225, y: cy + 200 };
  const LowerFlat_end = { x: 295, y: cy + 200 };

  // Outer contour (right wall has a cavity gap)
  drawStyledLine({ x: BASE.hubLeft, y: BASE.hubTop }, { x: BASE.hubRight, y: BASE.hubTop }, OUTLINE, 2);
  drawStyledLine({ x: BASE.hubRight, y: BASE.hubTop }, { x: BASE.hubRight, y: P_top.y }, OUTLINE, 2);
  drawStyledLine({ x: BASE.hubRight, y: P_bot_m.y }, { x: BASE.hubRight, y: BASE.hubBot }, OUTLINE, 2);
  drawStyledLine({ x: BASE.hubRight, y: BASE.hubBot }, { x: BASE.hubLeft, y: BASE.hubBot }, OUTLINE, 2);
  drawStyledLine({ x: BASE.hubLeft, y: BASE.hubBot }, { x: BASE.hubLeft, y: cy + BASE.webThick }, OUTLINE, 2);
  drawStyledLine({ x: BASE.hubLeft, y: cy - BASE.webThick }, { x: BASE.hubLeft, y: BASE.hubTop }, OUTLINE, 2);

  // Web stubs
  drawStyledLine({ x: BASE.hubLeft, y: cy - BASE.webThick }, { x: BASE.webLeft, y: cy - BASE.webThick }, OUTLINE, 2);
  drawStyledLine({ x: BASE.webLeft, y: cy - BASE.webThick }, { x: BASE.webLeft, y: cy + BASE.webThick }, OUTLINE, 2);
  drawStyledLine({ x: BASE.webLeft, y: cy + BASE.webThick }, { x: BASE.hubLeft, y: cy + BASE.webThick }, OUTLINE, 2);
  generator.drawText(T({ x: BASE.webLeft + 16, y: cy + 4 }).x, T({ x: 0, y: cy + 4 }).y, 'WEB', 8, '#6b7280');

  // Bore cavity right edge
  drawStyledLine({ x: BASE.hubRight, y: P_top.y }, { x: BASE.hubRight, y: P_bot_m.y }, OUTLINE, 2);

  // Axis line
  const axisA = T({ x: BASE.webLeft - 20, y: cy });
  const axisB = T({ x: BASE.hubRight + 30, y: cy });
  const axis = generator.drawLine(axisA.x, axisA.y, axisB.x, axisB.y, 'center') as any;
  axis.strokeColor = new scope.Color('#6b7280');
  axis.strokeWidth = 0.8;
  axis.dashArray = [20 * sc, 4 * sc, 4 * sc, 4 * sc];

  // Bore profile surfaces
  const C_M = '#2563eb';
  const C_N = '#7c3aed';
  const C_O = '#059669';
  const C_P = '#dc2626';
  const C_K = '#d97706';
  const C_L = '#ea580c';

  drawCubic(M_start, M_ctrl1, M_ctrl2, M_end, C_M, 3.2);
  drawQuadratic(M_end, N_ctrl, N_end, C_N, 3.2);
  drawStyledLine(N_end, O_end, C_O, 3.2);
  drawStyledLine(P_top, P_bot, C_P, 3.4);

  drawCubic(K_start, K_ctrl1, K_ctrl2, K_end, C_K, 3.2);
  drawStyledLine(K_end, L_end, C_L, 3.2);

  // Lower unlabeled closure
  drawStyledLine(L_end, LowerFlat_end, THIN, 1.4);
  drawStyledLine(LowerFlat_end, P_bot_m, THIN, 1.4);

  // Left cavity boundary + lower bore extension
  drawStyledLine(M_start, K_start, THIN, 1.2);
  drawStyledLine(P_bot_m, P_bot, C_P, 2.2, [6, 3]);

  // Thin outline for remaining cavity edges
  drawStyledLine(P_top, O_end, THIN, 1.2);
  drawStyledLine(P_bot, M_start, THIN, 1.2);
  drawStyledLine(P_bot, K_start, THIN, 1.2);

  // Labels (approx OEM positions)
  generator.drawText(T({ x: 85, y: cy - 121 }).x, T({ x: 0, y: cy - 121 }).y, 'M', 11, C_M);
  generator.drawText(T({ x: 178, y: cy - 201 }).x, T({ x: 0, y: cy - 201 }).y, 'N', 11, C_N);
  generator.drawText(T({ x: 250, y: cy - 211 }).x, T({ x: 0, y: cy - 211 }).y, 'O', 11, C_O);
  generator.drawText(T({ x: P_top.x + 28, y: (P_top.y + P_bot.y) / 2 + 4 }).x, T({ x: 0, y: (P_top.y + P_bot.y) / 2 + 4 }).y, 'P', 11, C_P);
  generator.drawText(T({ x: 70, y: cy + 119 }).x, T({ x: 0, y: cy + 119 }).y, 'K', 11, C_K);
  generator.drawText(T({ x: 175, y: cy + 184 }).x, T({ x: 0, y: cy + 184 }).y, 'L', 11, C_L);

  // Shear wave legend
  const legend = { x: BASE.webLeft + 5, y: BASE.hubTop + 18 };
  if (showNeg) {
    const la = T({ x: legend.x, y: legend.y });
    const lb = T({ x: legend.x + 40, y: legend.y });
    const legLine = generator.drawLine(la.x, la.y, lb.x, lb.y, 'hidden') as any;
    legLine.strokeColor = new scope.Color(negColor);
    legLine.strokeWidth = 1.6;
    legLine.dashArray = [6, 3];
    generator.drawText(lb.x + 60, la.y + 4, '-45 Shear Wave', 8, THIN);
  }
  if (showPos) {
    const la = T({ x: legend.x, y: legend.y + 12 });
    const lb = T({ x: legend.x + 40, y: legend.y + 12 });
    const legLine = generator.drawLine(la.x, la.y, lb.x, lb.y, 'hidden') as any;
    legLine.strokeColor = new scope.Color(posColor);
    legLine.strokeWidth = 1.6;
    legLine.dashArray = [6, 3];
    generator.drawText(lb.x + 60, la.y + 4, '+45 Shear Wave', 8, THIN);
  }

  // Beam paths
  const beamLen = 65;
  const midO = (N_end.x + O_end.x) / 2;
  const originY = N_end.y - 55;

  if (showPos) {
    drawStyledLine(
      { x: midO, y: originY },
      { x: midO + beamLen * Math.sin(Math.PI / 4), y: originY + beamLen * Math.cos(Math.PI / 4) },
      posColor,
      2,
      [6, 3]
    );
  }
  if (showNeg) {
    const x0 = midO + 60;
    drawStyledLine(
      { x: x0, y: originY },
      { x: x0 - beamLen * Math.sin(Math.PI / 4), y: originY + beamLen * Math.cos(Math.PI / 4) },
      negColor,
      2,
      [6, 3]
    );
  }

  const waterY = (P_top.y + cy) / 2;
  if (showPos) {
    drawStyledLine(
      { x: P_top.x + 45, y: waterY - 10 },
      { x: P_top.x + 5, y: waterY + 30 },
      posColor,
      1.8,
      [5, 3]
    );
  }
  if (showNeg) {
    drawStyledLine(
      { x: P_top.x + 45, y: waterY + 10 },
      { x: P_top.x + 5, y: waterY - 30 },
      negColor,
      1.8,
      [5, 3]
    );
  }
  if (showPos || showNeg) {
    generator.drawText(T({ x: P_top.x + 50, y: waterY - 2 }).x, T({ x: 0, y: waterY - 2 }).y, 'WATER', 7, '#0ea5e9');
    generator.drawText(T({ x: P_top.x + 50, y: waterY + 10 }).x, T({ x: 0, y: waterY + 10 }).y, '8.0"', 7, '#0ea5e9');
  }

  // Dimensions (key NDIP callouts)
  const dimOffset = 30 * sc;

  const covA = T({ x: M_start.x, y: BASE.hubTop });
  const covB = T({ x: P_top.x, y: BASE.hubTop });
  generator.drawDimension(covA.x, covA.y, covB.x, covB.y, '2.6" COVERAGE', -dimOffset);

  const radA = T({ x: P_top.x, y: cy });
  const radB = T({ x: BASE.hubRight + 10, y: cy });
  generator.drawDimension(radA.x, radA.y, radB.x, radB.y, 'R 2.773"', dimOffset);

  const offA = T({ x: BASE.hubRight + 30, y: cy });
  const offB = T({ x: BASE.hubRight + 30, y: N_end.y });
  generator.drawDimension(offA.x, offA.y, offB.x, offB.y, '0.898" OFFSET', 0);

  generator.drawText(T({ x: BASE.webLeft + 65, y: BASE.hubBot + 20 }).x, T({ x: 0, y: BASE.hubBot + 20 }).y, 'MAX SCAN: 0.020"', 8, '#6b7280');
  generator.drawText(T({ x: BASE.webLeft + 85, y: BASE.hubBot + 32 }).x, T({ x: 0, y: BASE.hubBot + 32 }).y, 'MAX INDEX: 0.020"/REV', 8, '#6b7280');

  // Reference footer
  generator.drawText(x + width / 2, y + height - 8, 'PER NDIP-1227 FIG. 2', 8, '#888888');
}

function resolveV2500Stage(options?: { standardType?: StandardType; partNumber?: string; stage?: 1 | 2 }): 1 | 2 {
  if (options?.stage) return options.stage;
  if (options?.standardType === 'NDIP-1227') return 2;
  if (options?.standardType === 'NDIP-1226') return 1;

  const pn = (options?.partNumber || '').toUpperCase().replace(/\s+/g, '');
  if (pn.includes('2A4802')) return 2;
  if (pn.includes('2A5001')) return 1;

  // Default to Stage 1 if not specified.
  return 1;
}
