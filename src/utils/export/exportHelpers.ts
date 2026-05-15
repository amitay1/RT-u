/**
 * Export Helpers - Utility functions for PDF/Word export
 * All formatting, colors, and helper functions in one place
 */

// ============================================================================
// COLORS - Professional TUV-style blue theme
// ============================================================================
export const COLORS = {
  // Primary colors
  primary: [0, 82, 147] as [number, number, number],       // TUV blue - headers
  primaryDark: [0, 60, 110] as [number, number, number],   // Darker blue - cover page
  secondary: [64, 128, 178] as [number, number, number],   // Medium blue - subheaders
  accent: [0, 122, 194] as [number, number, number],       // Light blue - highlights
  accentGold: [212, 175, 55] as [number, number, number],  // Gold accent - premium styling

  // Background colors
  headerBg: [240, 245, 250] as [number, number, number],   // Light gray-blue
  sectionBg: [245, 247, 250] as [number, number, number],  // Section backgrounds
  rowAlt: [248, 250, 252] as [number, number, number],     // Alternating row
  white: [255, 255, 255] as [number, number, number],

  // Border colors
  tableBorder: [200, 210, 220] as [number, number, number],
  divider: [220, 225, 230] as [number, number, number],

  // Text colors
  text: [30, 30, 30] as [number, number, number],          // Dark text
  lightText: [100, 100, 100] as [number, number, number],  // Secondary text
  mutedText: [130, 130, 130] as [number, number, number],  // Muted/subtle text
  confidential: [180, 50, 50] as [number, number, number], // Confidential notice

  // Status colors
  success: [34, 139, 34] as [number, number, number],      // Green - Accept
  warning: [255, 165, 0] as [number, number, number],      // Orange - warnings
  error: [220, 53, 69] as [number, number, number],        // Red - Reject
};

// ============================================================================
// PAGE SETTINGS
// ============================================================================
export const PAGE = {
  width: 210,           // A4 width in mm
  height: 297,          // A4 height in mm
  marginLeft: 15,
  marginRight: 15,
  marginTop: 20,
  marginBottom: 20,
  headerHeight: 15,
  footerHeight: 10,
  contentWidth: 180,    // 210 - 15 - 15
  contentStart: 35,     // After header
};

// ============================================================================
// FONTS
// ============================================================================
export const FONTS = {
  coverTitle: { size: 26, style: 'bold' as const },        // Main cover page title
  title: { size: 18, style: 'bold' as const },
  sectionTitle: { size: 14, style: 'bold' as const },
  subsectionTitle: { size: 12, style: 'bold' as const },
  tableHeader: { size: 10, style: 'bold' as const },
  body: { size: 10, style: 'normal' as const },
  small: { size: 9, style: 'normal' as const },
  tiny: { size: 8, style: 'normal' as const },
};

// ============================================================================
// VISUAL SETTINGS
// ============================================================================
export const VISUAL = {
  radiusSmall: 1,
  radiusMedium: 2,
  radiusLarge: 3,
  shadowOffset: 0.5,
};

// ============================================================================
// FORMAT HELPERS
// ============================================================================

/**
 * Format a value for display - returns "-" if empty/undefined
 */
export function formatValue(value: string | number | undefined | null, suffix?: string): string {
  if (value === undefined || value === null || value === '') {
    return '-';
  }
  const str = String(value);
  return suffix ? `${str} ${suffix}` : str;
}

/**
 * Format a number with units
 */
export function formatNumber(value: number | undefined | null, decimals = 2, unit?: string): string {
  if (value === undefined || value === null) {
    return '-';
  }
  const formatted = Number(value).toFixed(decimals);
  return unit ? `${formatted} ${unit}` : formatted;
}

/**
 * Format a date string
 */
export function formatDate(date: string | undefined | null): string {
  if (!date) return '-';
  try {
    const d = new Date(date);
    return d.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  } catch {
    return date;
  }
}

/**
 * Format part type for display (convert snake_case to Title Case)
 */
export function formatPartType(partType: string | undefined): string {
  if (!partType) return '-';
  return partType
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Format material type for display
 */
export function formatMaterial(material: string | undefined, customName?: string): string {
  if (!material) return '-';
  if (material === 'custom' && customName) {
    return customName;
  }
  return material
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Format calibration block type
 */
export function formatBlockType(type: string | undefined): string {
  if (!type) return '-';
  const typeMap: Record<string, string> = {
    'flat_block': 'Flat Block',
    'curved_block': 'Curved Block',
    'cylinder_notched': 'Cylinder (Notched)',
    'cylinder_fbh': 'Cylinder (FBH)',
    'solid_cylinder_fbh': 'Solid Cylinder (FBH)',
    'angle_beam': 'Angle Beam Block',
    'iiw_block': 'IIW Block',
    'step_wedge': 'Step Wedge',
    'iow_block': 'IOW Block',
    'custom': 'Custom Block',
  };
  return typeMap[type] || formatPartType(type);
}

/**
 * Format scan method
 */
export function formatScanMethod(method: string | undefined): string {
  if (!method) return '-';
  const methodMap: Record<string, string> = {
    'immersion': 'Immersion',
    'contact': 'Contact',
    'squirter': 'Squirter / Water Jet',
  };
  return methodMap[method.toLowerCase()] || method;
}

/**
 * Format transducer type
 */
export function formatTransducerType(type: string | undefined): string {
  if (!type) return '-';
  const typeMap: Record<string, string> = {
    'immersion': 'Immersion',
    'contact': 'Contact',
    'dual_element': 'Dual Element',
  };
  const tokens = type
    .split(/[,+]/)
    .map((token) => token.trim().toLowerCase())
    .filter(Boolean);

  if (tokens.length > 1) {
    return tokens.map((token) => typeMap[token] || token).join(', ');
  }

  return typeMap[type.toLowerCase()] || type;
}

/**
 * Format acceptance class with description
 */
export function formatAcceptanceClass(cls: string | undefined): { class: string; description: string } {
  if (!cls) return { class: '-', description: 'Not specified' };

  const classMap: Record<string, string> = {
    'AAA': 'Most Stringent - Critical Flight Components',
    'AA': 'Very Stringent - Primary Structure',
    'A': 'Stringent - Secondary Structure',
    'B': 'Standard - General Aerospace',
    'C': 'Least Stringent - Non-Critical Parts',
  };

  return {
    class: cls,
    description: classMap[cls] || 'Custom acceptance criteria',
  };
}

/**
 * Check if part type is cylindrical (needs diameter display)
 */
export function isCylindrical(partType: string | undefined): boolean {
  if (!partType) return false;
  const cylindricalTypes = [
    'tube', 'pipe', 'ring', 'ring_forging', 'sleeve', 'bushing',
    'cylinder', 'round_bar', 'shaft', 'disk', 'disk_forging',
    'round_forging_stock', 'sphere', 'cone', 'hexagon', 'impeller', 'blisk', 'hpt_disk'
  ];
  return cylindricalTypes.includes(partType);
}

/**
 * Check if part type is a cone (needs cone dimensions)
 */
export function isCone(partType: string | undefined): boolean {
  return partType === 'cone';
}

/**
 * Format transducer shape & size for display (proper labels instead of raw keys)
 */
export function formatTransducerShape(shape: string | undefined): string {
  if (!shape) return '-';
  const shapeMap: Record<string, string> = {
    'active_element_diameter_3_8_to_1_inch': 'Active Element Dia. 3/8" to 1"',
    'rectangular_flat': 'Rectangular Flat',
    'cylindrically_focused_transducers': 'Cylindrically Focused Transducers',
    'active_element_diameter_1_4_inch': 'Active Element Dia. 1/4"',
    'active_element_diameter_3_8_inch': 'Active Element Dia. 3/8"',
    'active_element_diameter_1_2_inch': 'Active Element Dia. 1/2"',
    'active_element_diameter_3_4_inch': 'Active Element Dia. 3/4"',
    'active_element_diameter_1_inch': 'Active Element Dia. 1"',
    'round': 'Round',
    'square': 'Square',
    'rectangular': 'Rectangular',
    'line_focused': 'Line Focused',
    'point_focused': 'Point Focused',
  };
  const rawValues = shape
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

  const formattedValues = rawValues.map((value) =>
    shapeMap[value] || value.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
  );

  return formattedValues.join(', ');
}

/**
 * Get geometry-aware dimension labels based on part type
 * Mirrors getPartFieldConfig() in InspectionSetupTab
 */
function getDimensionLabels(partType?: string): {
  thicknessLabel: string;
  lengthLabel: string;
  odLabel: string;
} {
  if (!partType) return { thicknessLabel: 'Thickness', lengthLabel: 'Length', odLabel: 'Outer Diameter (OD)' };

  const heightTypes = ['disk', 'disk_forging', 'hub', 'impeller', 'blisk', 'hpt_disk'];
  const axialWidthTypes = ['ring', 'ring_forging', 'sleeve', 'bushing', 'tube', 'pipe'];

  let thicknessLabel = 'Thickness';
  if (heightTypes.includes(partType)) thicknessLabel = 'Height';
  if (partType === 'hpt_disk') thicknessLabel = 'Overall Height';

  let lengthLabel = 'Length';
  if (axialWidthTypes.includes(partType)) lengthLabel = 'Axial Width';

  let odLabel = 'Outer Diameter (OD)';
  if (partType === 'hpt_disk') odLabel = 'Max OD / Tip OD';
  if (partType === 'hexagon') odLabel = 'Across Flats';
  else if (partType === 'sphere') odLabel = 'Diameter';

  return { thicknessLabel, lengthLabel, odLabel };
}

/**
 * Get part dimensions as formatted rows based on part type
 */
export function getPartDimensionRows(setup: {
  standard?: string;
  partType?: string;
  partThickness?: number;
  partLength?: number;
  partWidth?: number;
  diameter?: number;
  innerDiameter?: number;
  wallThickness?: number;
  isHollow?: boolean;
  coneTopDiameter?: number;
  coneBottomDiameter?: number;
  coneHeight?: number;
  innerLength?: number;
  innerWidth?: number;
  hptDiskGeometry?: {
    rimRootDiameterMm?: number;
    hubOuterDiameterMm?: number;
    webDiameterMm?: number;
    boreEntryDiameterMm?: number;
    boreExitDiameterMm?: number;
    minBoreDiameterMm?: number;
    hubHeightMm?: number;
    rimHeightMm?: number;
    webMinThicknessMm?: number;
    frontFaceAngleDeg?: number;
    rearFaceAngleDeg?: number;
    boreTaperAngleDeg?: number;
    webTransitionAngleDeg?: number;
    serrationFlankAngleDeg?: number;
    frontFilletRadiusMm?: number;
    rearFilletRadiusMm?: number;
    boreEntryRadiusMm?: number;
    boreBlendRadiusMm?: number;
    rimBlendRadiusMm?: number;
    toothRootRadiusMm?: number;
    serrationCount?: number;
    serrationPitchMm?: number;
    serrationHeightMm?: number;
    serrationTopWidthMm?: number;
    inspectionBoreRadiusMm?: number;
    inspectionOffsetMm?: number;
    radialCoverageMm?: number;
    geometryNotes?: string;
    criticalZoneNotes?: string;
  };
}): Array<[string, string]> {
  const rows: Array<[string, string]> = [];
  const labels = getDimensionLabels(setup.partType);
  const hpt = setup.hptDiskGeometry;
  const isV2500Standard = setup.standard === 'NDIP-1226' || setup.standard === 'NDIP-1227';
  const showStandardHptInspectionRows = setup.standard === 'NDIP-1226' || setup.standard === 'NDIP-1227';
  const showCommonDimensions = !isV2500Standard || setup.partType === 'hpt_disk';

  // Common dimensions with geometry-aware labels
  if (showCommonDimensions && setup.partThickness) {
    rows.push([labels.thicknessLabel, formatNumber(setup.partThickness, 1, 'mm')]);
  }
  if (showCommonDimensions && setup.partLength) {
    rows.push([labels.lengthLabel, formatNumber(setup.partLength, 1, 'mm')]);
  }
  if (showCommonDimensions && setup.partWidth) {
    rows.push(['Width', formatNumber(setup.partWidth, 1, 'mm')]);
  }

  // Cylindrical dimensions
  if (showCommonDimensions && isCylindrical(setup.partType)) {
    if (setup.diameter) {
      rows.push([labels.odLabel, formatNumber(setup.diameter, 1, 'mm')]);
    }
    if (setup.innerDiameter) {
      rows.push([setup.partType === 'hpt_disk' ? 'Nominal Bore ID' : 'Inner Diameter (ID)', formatNumber(setup.innerDiameter, 1, 'mm')]);
    }
    if (setup.wallThickness && setup.partType !== 'hpt_disk') {
      rows.push(['Wall Thickness', formatNumber(setup.wallThickness, 2, 'mm')]);
    }
  }

  // Rectangular hollow inner dimensions
  if (showCommonDimensions && setup.innerLength) {
    rows.push(['Inner Length', formatNumber(setup.innerLength, 1, 'mm')]);
  }
  if (showCommonDimensions && setup.innerWidth) {
    rows.push(['Inner Width', formatNumber(setup.innerWidth, 1, 'mm')]);
  }

  // Cone dimensions
  if (!isV2500Standard && isCone(setup.partType)) {
    if (setup.coneBottomDiameter) {
      rows.push(['Bottom Diameter', formatNumber(setup.coneBottomDiameter, 1, 'mm')]);
    }
    if (setup.coneTopDiameter !== undefined) {
      rows.push(['Top Diameter', setup.coneTopDiameter === 0 ? 'Pointed (0)' : formatNumber(setup.coneTopDiameter, 1, 'mm')]);
    }
    if (setup.coneHeight) {
      rows.push(['Cone Height', formatNumber(setup.coneHeight, 1, 'mm')]);
    }
    if (setup.wallThickness) {
      rows.push(['Wall Thickness', formatNumber(setup.wallThickness, 2, 'mm')]);
    }
  }

  // Hollow indicator
  if (showCommonDimensions && setup.isHollow !== undefined) {
    rows.push(['Hollow Part', setup.isHollow ? 'Yes' : 'No']);
  }

  if (setup.partType === 'hpt_disk' && hpt) {
    const hptRows: Array<[string, string]> = [];
    const maybePush = (label: string, value: number | string | undefined, unit?: string, precision: number = 1) => {
      if (value === undefined || value === null || value === '') return;
      if (typeof value === 'number') {
        hptRows.push([label, formatNumber(value, precision, unit)]);
        return;
      }
      hptRows.push([label, String(value)]);
    };

    maybePush('Root / Base OD', hpt.rimRootDiameterMm, 'mm');
    maybePush('Hub OD', hpt.hubOuterDiameterMm, 'mm');
    maybePush('Web Diameter', hpt.webDiameterMm, 'mm');
    maybePush('Bore Entry ID', hpt.boreEntryDiameterMm, 'mm');
    maybePush('Bore Exit ID', hpt.boreExitDiameterMm, 'mm');
    maybePush('Minimum Bore ID', hpt.minBoreDiameterMm, 'mm');
    maybePush('Hub Height', hpt.hubHeightMm, 'mm');
    maybePush('Rim Height', hpt.rimHeightMm, 'mm');
    maybePush('Web Min Thickness', hpt.webMinThicknessMm, 'mm');
    maybePush('Front Face Angle', hpt.frontFaceAngleDeg, 'deg');
    maybePush('Rear Face Angle', hpt.rearFaceAngleDeg, 'deg');
    maybePush('Bore Taper Angle', hpt.boreTaperAngleDeg, 'deg');
    maybePush('Web Transition Angle', hpt.webTransitionAngleDeg, 'deg');
    maybePush('Serration Flank Angle', hpt.serrationFlankAngleDeg, 'deg');
    maybePush('Front Fillet Radius', hpt.frontFilletRadiusMm, 'mm');
    maybePush('Rear Fillet Radius', hpt.rearFilletRadiusMm, 'mm');
    maybePush('Bore Entry Radius', hpt.boreEntryRadiusMm, 'mm');
    maybePush('Bore Blend Radius', hpt.boreBlendRadiusMm, 'mm');
    maybePush('Rim Blend Radius', hpt.rimBlendRadiusMm, 'mm');
    maybePush('Tooth Root Radius', hpt.toothRootRadiusMm, 'mm');
    maybePush('Serration Count', hpt.serrationCount, undefined, 0);
    maybePush('Serration Pitch', hpt.serrationPitchMm, 'mm');
    maybePush('Serration Height', hpt.serrationHeightMm, 'mm');
    maybePush('Serration Top Width', hpt.serrationTopWidthMm, 'mm');
    if (showStandardHptInspectionRows) {
      maybePush('Inspection Bore Radius', hpt.inspectionBoreRadiusMm, 'mm', 2);
      maybePush('Inspection Offset', hpt.inspectionOffsetMm, 'mm', 2);
      maybePush('Radial Coverage', hpt.radialCoverageMm, 'mm', 2);
    }
    maybePush('Geometry Notes', hpt.geometryNotes);
    maybePush('Critical Zone Notes', hpt.criticalZoneNotes);

    rows.push(...hptRows);
  }

  return rows;
}

/**
 * Get material warning if applicable
 */
export function getMaterialWarning(material: string | undefined, standard?: string): string | null {
  if (!material) return null;

  // P&W NDIP-specific warnings for nickel alloys
  if ((standard === 'NDIP-1226' || standard === 'NDIP-1227') &&
      (material.toLowerCase().includes('nickel') || material.toLowerCase() === 'nickel_alloy')) {
    const stage = standard === 'NDIP-1226' ? '1st' : '2nd';
    return `P&W V2500 ${stage} Stage HPT Disk - ONLY IAE2P16679 transducer (5 MHz) with IAE2P16678 45 deg mirror. ` +
      `Calibration block IAE2P16675 (powdered nickel). 8" water path immersion. +/-45 deg circumferential shear wave. ` +
      `Inspector must hold PW POD qualification. Electronic data transfer to PW MPE-NDE via MFT.`;
  }

  const warnings: Record<string, string> = {
    'titanium': 'CAUTION: Titanium requires special attention to grain structure and anisotropy. Additional angle beam inspection may be required.',
    'magnesium': 'CAUTION: Magnesium alloys may exhibit high attenuation. Adjust gain and sensitivity accordingly.',
  };

  return warnings[material.toLowerCase()] || null;
}

/**
 * Build table data from key-value pairs, filtering out empty values
 */
export function buildTableRows(
  data: Array<[string, string | number | undefined | null]>,
  options: { showEmpty?: boolean; emptyText?: string } = {}
): Array<[string, string]> {
  const { showEmpty = false, emptyText = '-' } = options;

  return data
    .filter(([, value]) => showEmpty || (value !== undefined && value !== null && value !== ''))
    .map(([label, value]) => [
      label,
      value === undefined || value === null || value === ''
        ? emptyText
        : String(value)
    ]);
}

/**
 * jsPDF format hint detected from a base64 data URL prefix.
 * Falls back to PNG for unknown / non-data-URL strings.
 *
 * Why: user uploads (C-scans, A-scans, custom shapes, logos) preserve the
 * source MIME, so the same field may carry JPEG, PNG, or WebP. Passing the
 * wrong format hint to jsPDF.addImage produces blank or garbled images.
 */
export function detectImageFormat(
  dataUrl: string | undefined | null
): 'PNG' | 'JPEG' | 'WEBP' {
  if (typeof dataUrl !== 'string') return 'PNG';
  const head = dataUrl.slice(0, 32).toLowerCase();
  if (head.startsWith('data:image/jpeg') || head.startsWith('data:image/jpg')) {
    return 'JPEG';
  }
  if (head.startsWith('data:image/webp')) return 'WEBP';
  return 'PNG';
}

/**
 * Returns the width/height to use when adding `dataUrl` to the PDF such that
 * the image fits inside (maxWidth × maxHeight) while preserving its native
 * aspect ratio. Falls back to the full box if probing fails.
 *
 * Why: many callers were hardcoding dimensions like `85 × 50` regardless of
 * the actual image, which squashed wide C-scans and stretched portraits.
 */
export function fitImageToBox(
  pdf: { getImageProperties: (data: string) => { width: number; height: number } },
  dataUrl: string,
  maxWidth: number,
  maxHeight: number
): { width: number; height: number } {
  try {
    const props = pdf.getImageProperties(dataUrl);
    if (!props.width || !props.height) {
      return { width: maxWidth, height: maxHeight };
    }
    const ratio = props.width / props.height;
    if (!isFinite(ratio) || ratio <= 0) {
      return { width: maxWidth, height: maxHeight };
    }
    let w = maxWidth;
    let h = maxWidth / ratio;
    if (h > maxHeight) {
      h = maxHeight;
      w = maxHeight * ratio;
    }
    return { width: w, height: h };
  } catch {
    return { width: maxWidth, height: maxHeight };
  }
}
