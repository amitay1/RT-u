/**
 * PWA-SIM (Sonic Inspection Method) Calibration Block Drawing Component
 *
 * Dedicated technical drawing for the PWA-SIM calibration block used for
 * bar, billet, rod, and forging stock inspection per PWA 127 / SIS 26B.
 *
 * Block specifications (UNIQUE multi-reflector configuration):
 * - 3/64" FBH at 50% depth (primary reject level)
 * - 3/64" FBH at 10% depth (near-surface reference)
 * - 1/32" FBH at 10% depth (secondary reference)
 * - EDM Notch: 3% depth x 1/4" length (axial defect simulation)
 *
 * CRITICAL: Block must be made from SAME MATERIAL as test part!
 */

import React, { useId } from 'react';

// ============================================================================
// TYPES
// ============================================================================

interface PWASIMCalibrationBlockDrawingProps {
  /** Drawing width in pixels */
  width?: number;
  /** Drawing height in pixels */
  height?: number;
  /** Show dimensions */
  showDimensions?: boolean;
  /** Show title block */
  showTitleBlock?: boolean;
  /** Part thickness in mm (affects hole depths) */
  partThickness?: number;
  /** Part material name */
  partMaterial?: string;
  /** Custom title */
  title?: string;
}

// ============================================================================
// CONSTANTS - PWA-SIM Block Configuration
// ============================================================================

const PWA_SIM_CONFIG = {
  // Block dimensions (typical - scales with part)
  minLength: 152.4, // 6" minimum
  minWidth: 50.8,   // 2" minimum

  // Reflector specifications
  reflectors: [
    {
      id: 'FBH-1',
      type: 'FBH',
      diameterInch: '3/64',
      diameterMm: 1.19,
      depthPercent: 50,
      purpose: 'Primary Reject Level',
      color: '#dc2626', // red
    },
    {
      id: 'FBH-2',
      type: 'FBH',
      diameterInch: '3/64',
      diameterMm: 1.19,
      depthPercent: 10,
      purpose: 'Near-Surface Reference',
      color: '#2563eb', // blue
    },
    {
      id: 'FBH-3',
      type: 'FBH',
      diameterInch: '1/32',
      diameterMm: 0.79,
      depthPercent: 10,
      purpose: 'Secondary Reference',
      color: '#6366f1', // indigo
    },
    {
      id: 'NOTCH',
      type: 'EDM Notch',
      depthPercent: 3,
      lengthInch: '1/4',
      lengthMm: 6.35,
      purpose: 'Axial Defect Simulation',
      color: '#f59e0b', // amber
    },
  ],

  // Calibration parameters
  dacPoints: 3,
  targetAmplitude: 50, // %FSH at 50% depth
};

// ============================================================================
// HELPER COMPONENTS
// ============================================================================

interface DimensionLineProps {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  value: string;
  offset?: number;
  vertical?: boolean;
  uniqueId: string;
}

function DimensionLine({
  x1, y1, x2, y2,
  value,
  offset = 20,
  vertical = false,
  uniqueId,
}: DimensionLineProps) {
  const midX = (x1 + x2) / 2;
  const midY = (y1 + y2) / 2;

  if (vertical) {
    return (
      <g className="dimension-line">
        <line x1={x1 - 3} y1={y1} x2={x1 + offset + 5} y2={y1} stroke="#1e293b" strokeWidth="0.4" />
        <line x1={x2 - 3} y1={y2} x2={x2 + offset + 5} y2={y2} stroke="#1e293b" strokeWidth="0.4" />
        <line
          x1={x1 + offset} y1={y1 + 3}
          x2={x2 + offset} y2={y2 - 3}
          stroke="#1e293b" strokeWidth="0.6"
          markerStart={`url(#arrow-rev-${uniqueId})`}
          markerEnd={`url(#arrow-${uniqueId})`}
        />
        <rect x={x1 + offset - 22} y={midY - 6} width="44" height="12" fill="white" />
        <text
          x={x1 + offset}
          y={midY + 3}
          textAnchor="middle"
          fontSize="8"
          fontWeight="600"
          fill="#1e293b"
          fontFamily="Arial, sans-serif"
        >
          {value}
        </text>
      </g>
    );
  }

  return (
    <g className="dimension-line">
      <line x1={x1} y1={y1 - 3} x2={x1} y2={y1 + offset + 5} stroke="#1e293b" strokeWidth="0.4" />
      <line x1={x2} y1={y2 - 3} x2={x2} y2={y2 + offset + 5} stroke="#1e293b" strokeWidth="0.4" />
      <line
        x1={x1 + 3} y1={y1 + offset}
        x2={x2 - 3} y2={y2 + offset}
        stroke="#1e293b" strokeWidth="0.6"
        markerStart={`url(#arrow-rev-${uniqueId})`}
        markerEnd={`url(#arrow-${uniqueId})`}
      />
      <rect x={midX - 22} y={y1 + offset - 6} width="44" height="12" fill="white" />
      <text
        x={midX}
        y={y1 + offset + 3}
        textAnchor="middle"
        fontSize="8"
        fontWeight="600"
        fill="#1e293b"
        fontFamily="Arial, sans-serif"
      >
        {value}
      </text>
    </g>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function PWASIMCalibrationBlockDrawing({
  width = 900,
  height = 650,
  showDimensions = true,
  showTitleBlock = true,
  partThickness = 50, // Default 50mm
  partMaterial = 'Same as Test Part',
  title = 'PWA-SIM Calibration Block - Bar/Billet/Forging Inspection',
}: PWASIMCalibrationBlockDrawingProps) {
  const uniqueId = useId().replace(/:/g, '');

  // Calculate block dimensions based on part thickness
  const blockThickness = Math.max(partThickness, 25); // At least 25mm
  const blockLength = Math.max(blockThickness * 4, PWA_SIM_CONFIG.minLength);
  const blockWidth = Math.max(blockThickness * 1.5, PWA_SIM_CONFIG.minWidth);

  // Calculate scale
  const scale = Math.min(
    (width - 150) / (blockLength * 1.3),
    (height - 250) / (blockThickness * 6)
  );

  const scaledLength = blockLength * scale;
  const scaledWidth = blockWidth * scale;
  const scaledThickness = blockThickness * scale * 2; // Exaggerate thickness for visibility

  // View positions
  const viewAX = 50;
  const viewAY = 70;
  const viewBX = 50;
  const viewBY = 260;

  return (
    <div className="pwa-sim-calibration-block-drawing bg-white rounded-lg border-2 border-amber-200 shadow-lg">
      {/* Header */}
      <div className="bg-gradient-to-r from-amber-600 to-orange-600 text-white px-4 py-3 rounded-t-lg">
        <h3 className="text-lg font-bold flex items-center gap-2">
          <span>PWA-SIM</span>
          <span className="text-sm font-normal opacity-80">Sonic Inspection Method</span>
        </h3>
        <p className="text-sm opacity-90">{title}</p>
      </div>

      {/* Critical Material Warning */}
      <div className="bg-red-50 border-b-2 border-red-200 px-4 py-2">
        <p className="text-red-700 text-sm font-semibold flex items-center gap-2">
          <span className="text-lg">!</span>
          CRITICAL: Calibration block MUST be made from SAME MATERIAL as test part!
        </p>
        <p className="text-red-600 text-xs">Current Material: {partMaterial}</p>
      </div>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        width={width}
        height={height}
        className="block mx-auto"
      >
        {/* Definitions */}
        <defs>
          <marker
            id={`arrow-${uniqueId}`}
            markerWidth="6"
            markerHeight="6"
            refX="5"
            refY="3"
            orient="auto"
          >
            <path d="M0,0 L6,3 L0,6 L1.5,3 Z" fill="#1e293b" />
          </marker>
          <marker
            id={`arrow-rev-${uniqueId}`}
            markerWidth="6"
            markerHeight="6"
            refX="1"
            refY="3"
            orient="auto"
          >
            <path d="M6,0 L0,3 L6,6 L4.5,3 Z" fill="#1e293b" />
          </marker>
          <pattern
            id={`hatch-${uniqueId}`}
            patternUnits="userSpaceOnUse"
            width="6"
            height="6"
            patternTransform="rotate(45)"
          >
            <line x1="0" y1="0" x2="0" y2="6" stroke="#94a3b8" strokeWidth="0.5" />
          </pattern>
        </defs>

        {/* ====================== VIEW A - TOP VIEW ====================== */}
        <g transform={`translate(${viewAX}, ${viewAY})`}>
          <text x={scaledLength / 2} y="-15" textAnchor="middle" fontSize="11" fontWeight="700" fill="#1e293b">
            VIEW A - TOP (Sound Entry Surface)
          </text>

          {/* Block outline */}
          <rect
            x="0" y="0"
            width={scaledLength}
            height={scaledWidth}
            fill="#f8fafc"
            stroke="#1e293b"
            strokeWidth="2"
          />

          {/* Center lines */}
          <line
            x1={scaledLength / 2} y1="-8"
            x2={scaledLength / 2} y2={scaledWidth + 8}
            stroke="#dc2626"
            strokeWidth="0.5"
            strokeDasharray="10,3,3,3"
          />
          <line
            x1="-8" y1={scaledWidth / 2}
            x2={scaledLength + 8} y2={scaledWidth / 2}
            stroke="#dc2626"
            strokeWidth="0.5"
            strokeDasharray="10,3,3,3"
          />

          {/* FBH Holes - from top view */}
          {PWA_SIM_CONFIG.reflectors.filter(r => r.type === 'FBH').map((reflector, index) => {
            const spacing = scaledLength / 5;
            const x = spacing * (index + 1);
            const holeRadius = Math.max((reflector.diameterMm ?? 1) * scale * 4, 4);

            return (
              <g key={reflector.id}>
                <circle
                  cx={x}
                  cy={scaledWidth / 2}
                  r={holeRadius}
                  fill="white"
                  stroke={reflector.color}
                  strokeWidth="2"
                />
                <line x1={x - 3} y1={scaledWidth / 2} x2={x + 3} y2={scaledWidth / 2} stroke={reflector.color} strokeWidth="0.5" />
                <line x1={x} y1={scaledWidth / 2 - 3} x2={x} y2={scaledWidth / 2 + 3} stroke={reflector.color} strokeWidth="0.5" />
                <text
                  x={x}
                  y={scaledWidth / 2 + holeRadius + 14}
                  textAnchor="middle"
                  fontSize="7"
                  fontWeight="600"
                  fill={reflector.color}
                >
                  {reflector.id}
                </text>
              </g>
            );
          })}

          {/* EDM Notch - from top view (shown as line) */}
          <g>
            <line
              x1={scaledLength * 0.85}
              y1={scaledWidth / 2 - 8}
              x2={scaledLength * 0.85}
              y2={scaledWidth / 2 + 8}
              stroke="#f59e0b"
              strokeWidth="3"
            />
            <text
              x={scaledLength * 0.85}
              y={scaledWidth / 2 + 22}
              textAnchor="middle"
              fontSize="7"
              fontWeight="600"
              fill="#f59e0b"
            >
              NOTCH
            </text>
          </g>

          {/* Section line A-A */}
          <line
            x1="-12" y1={scaledWidth / 2}
            x2={scaledLength + 12} y2={scaledWidth / 2}
            stroke="#1e293b"
            strokeWidth="1"
            strokeDasharray="8,4"
          />
          <circle cx="-12" cy={scaledWidth / 2} r="7" fill="white" stroke="#1e293b" strokeWidth="1" />
          <text x="-12" y={scaledWidth / 2 + 3} textAnchor="middle" fontSize="7" fontWeight="700" fill="#1e293b">A</text>
          <circle cx={scaledLength + 12} cy={scaledWidth / 2} r="7" fill="white" stroke="#1e293b" strokeWidth="1" />
          <text x={scaledLength + 12} y={scaledWidth / 2 + 3} textAnchor="middle" fontSize="7" fontWeight="700" fill="#1e293b">A</text>

          {/* Dimensions */}
          {showDimensions && (
            <>
              <DimensionLine
                x1={0} y1={scaledWidth}
                x2={scaledLength} y2={scaledWidth}
                value={`${blockLength.toFixed(0)}mm`}
                offset={25} uniqueId={uniqueId}
              />
              <DimensionLine
                x1={scaledLength} y1={0}
                x2={scaledLength} y2={scaledWidth}
                value={`${blockWidth.toFixed(0)}mm`}
                offset={25} vertical uniqueId={uniqueId}
              />
            </>
          )}
        </g>

        {/* ====================== VIEW B - SECTION A-A ====================== */}
        <g transform={`translate(${viewBX}, ${viewBY})`}>
          <text x={scaledLength / 2} y="-15" textAnchor="middle" fontSize="11" fontWeight="700" fill="#1e293b">
            VIEW B - SECTION A-A (Multi-Reflector Configuration)
          </text>

          {/* Block outline */}
          <rect
            x="0" y="0"
            width={scaledLength}
            height={scaledThickness}
            fill={`url(#hatch-${uniqueId})`}
            stroke="#1e293b"
            strokeWidth="2"
          />

          {/* FBH Holes - from section view */}
          {PWA_SIM_CONFIG.reflectors.filter(r => r.type === 'FBH').map((reflector, index) => {
            const spacing = scaledLength / 5;
            const x = spacing * (index + 1);
            const depthRatio = reflector.depthPercent / 100;
            const scaledDepth = depthRatio * scaledThickness;
            const holeWidth = Math.max((reflector.diameterMm ?? 1) * scale * 2, 3);

            return (
              <g key={`section-${reflector.id}`}>
                {/* FBH hole line */}
                <line
                  x1={x} y1={0}
                  x2={x} y2={scaledDepth}
                  stroke={reflector.color}
                  strokeWidth="3"
                />
                {/* Flat bottom */}
                <line
                  x1={x - holeWidth} y1={scaledDepth}
                  x2={x + holeWidth} y2={scaledDepth}
                  stroke={reflector.color}
                  strokeWidth="2"
                />
                {/* Depth line */}
                <line
                  x1={x + 8} y1={0}
                  x2={x + 8} y2={scaledDepth}
                  stroke="#64748b"
                  strokeWidth="0.5"
                  strokeDasharray="2,2"
                />
                {/* Depth label */}
                <text
                  x={x + 12}
                  y={scaledDepth / 2 + 3}
                  fontSize="7"
                  fill="#64748b"
                >
                  {reflector.depthPercent}%
                </text>
                {/* Bottom label */}
                <text
                  x={x}
                  y={scaledThickness + 15}
                  textAnchor="middle"
                  fontSize="7"
                  fontWeight="600"
                  fill={reflector.color}
                >
                  {reflector.diameterInch}&quot;
                </text>
              </g>
            );
          })}

          {/* EDM Notch - from section view */}
          <g>
            {(() => {
              const notch = PWA_SIM_CONFIG.reflectors.find(r => r.type === 'EDM Notch');
              if (!notch) return null;
              const x = scaledLength * 0.85;
              const notchDepth = (notch.depthPercent / 100) * scaledThickness;
              const notchWidth = (notch.lengthMm || 6.35) * scale;

              return (
                <>
                  {/* Notch shape */}
                  <rect
                    x={x - notchWidth / 2}
                    y={0}
                    width={notchWidth}
                    height={notchDepth}
                    fill="#f59e0b"
                    stroke="#d97706"
                    strokeWidth="1"
                  />
                  {/* Notch label */}
                  <text
                    x={x}
                    y={scaledThickness + 15}
                    textAnchor="middle"
                    fontSize="7"
                    fontWeight="600"
                    fill="#f59e0b"
                  >
                    EDM {notch.depthPercent}% x {notch.lengthInch}&quot;
                  </text>
                </>
              );
            })()}
          </g>

          {/* Dimensions */}
          {showDimensions && (
            <>
              <DimensionLine
                x1={0} y1={scaledThickness}
                x2={scaledLength} y2={scaledThickness}
                value={`${blockLength.toFixed(0)}mm`}
                offset={30} uniqueId={uniqueId}
              />
              <DimensionLine
                x1={scaledLength} y1={0}
                x2={scaledLength} y2={scaledThickness}
                value={`T=${blockThickness.toFixed(0)}mm`}
                offset={25} vertical uniqueId={uniqueId}
              />
            </>
          )}
        </g>

        {/* ====================== REFLECTOR SPECIFICATIONS TABLE ====================== */}
        <g transform={`translate(${scaledLength + 100}, ${viewAY})`}>
          <text x="0" y="0" fontSize="10" fontWeight="700" fill="#1e293b">
            REFLECTOR SPECIFICATIONS
          </text>
          <rect x="0" y="8" width="220" height={30 + PWA_SIM_CONFIG.reflectors.length * 20} fill="white" stroke="#1e293b" strokeWidth="1" />

          {/* Table header */}
          <line x1="0" y1="32" x2="220" y2="32" stroke="#1e293b" strokeWidth="0.5" />
          <text x="10" y="24" fontSize="7" fontWeight="600" fill="#1e293b">ID</text>
          <text x="50" y="24" fontSize="7" fontWeight="600" fill="#1e293b">TYPE</text>
          <text x="90" y="24" fontSize="7" fontWeight="600" fill="#1e293b">SIZE</text>
          <text x="130" y="24" fontSize="7" fontWeight="600" fill="#1e293b">DEPTH</text>
          <text x="170" y="24" fontSize="7" fontWeight="600" fill="#1e293b">PURPOSE</text>

          {/* Table rows */}
          {PWA_SIM_CONFIG.reflectors.map((reflector, index) => (
            <g key={`table-${reflector.id}`} transform={`translate(0, ${36 + index * 20})`}>
              <rect x="5" y="0" width="8" height="8" fill={reflector.color} rx="1" />
              <text x="20" y="8" fontSize="7" fill="#1e293b">{reflector.id}</text>
              <text x="50" y="8" fontSize="7" fill="#1e293b">{reflector.type}</text>
              <text x="90" y="8" fontSize="7" fill="#1e293b">
                {reflector.type === 'FBH' ? `${reflector.diameterInch}"` : `${reflector.lengthInch}" L`}
              </text>
              <text x="130" y="8" fontSize="7" fill="#1e293b">{reflector.depthPercent}%</text>
              <text x="170" y="8" fontSize="6" fill="#64748b">{reflector.purpose.substring(0, 12)}</text>
            </g>
          ))}
        </g>

        {/* ====================== CALIBRATION PARAMETERS ====================== */}
        <g transform={`translate(${scaledLength + 100}, ${viewAY + 140})`}>
          <text x="0" y="0" fontSize="10" fontWeight="700" fill="#1e293b">
            CALIBRATION PARAMETERS
          </text>
          <rect x="0" y="8" width="220" height="80" fill="white" stroke="#1e293b" strokeWidth="1" />
          <text x="10" y="28" fontSize="8" fill="#1e293b">Primary Reject: 50% depth FBH @ 50% FSH</text>
          <text x="10" y="42" fontSize="8" fill="#1e293b">DAC Points: {PWA_SIM_CONFIG.dacPoints}</text>
          <text x="10" y="56" fontSize="8" fill="#1e293b">Frequency: 2.25-10 MHz (typ. 5 MHz)</text>
          <text x="10" y="70" fontSize="8" fill="#1e293b">Transducer: 0.5-1.0&quot; diameter</text>
          <text x="10" y="84" fontSize="8" fontWeight="600" fill="#dc2626">Material: SAME AS TEST PART</text>
        </g>

        {/* ====================== TITLE BLOCK ====================== */}
        {showTitleBlock && (
          <g transform={`translate(${width - 220}, ${height - 95})`}>
            <rect x="0" y="0" width="210" height="85" fill="white" stroke="#1e293b" strokeWidth="1.5" />

            {/* PWA Logo area */}
            <rect x="0" y="0" width="60" height="25" fill="#d97706" />
            <text x="30" y="16" textAnchor="middle" fontSize="9" fontWeight="700" fill="white">PWA-SIM</text>

            {/* Block info */}
            <text x="70" y="12" fontSize="7" fontWeight="600" fill="#1e293b">STANDARD:</text>
            <text x="70" y="22" fontSize="8" fontWeight="700" fill="#1e293b">PWA 127 / SIS 26B</text>

            <line x1="0" y1="25" x2="210" y2="25" stroke="#1e293b" strokeWidth="0.5" />

            <text x="5" y="37" fontSize="7" fill="#1e293b">DESCRIPTION:</text>
            <text x="5" y="47" fontSize="7" fontWeight="600" fill="#1e293b">Multi-Reflector Calibration Block</text>

            <line x1="0" y1="52" x2="210" y2="52" stroke="#1e293b" strokeWidth="0.5" />

            <text x="5" y="63" fontSize="7" fill="#dc2626" fontWeight="600">MATERIAL: SAME AS TEST PART</text>
            <text x="5" y="73" fontSize="7" fill="#1e293b">APPLICATION: Bar/Billet/Forging</text>
            <text x="110" y="63" fontSize="7" fill="#1e293b">Method: Sonic</text>
            <text x="110" y="73" fontSize="7" fill="#1e293b">Calib: Before &amp; After</text>

            <text x="5" y="83" fontSize="6" fill="#64748b">3 FBH + 1 EDM Notch | Per Pratt &amp; Whitney Specification</text>
          </g>
        )}

        {/* ====================== NOTES ====================== */}
        <g transform={`translate(${viewBX}, ${height - 55})`}>
          <text x="0" y="0" fontSize="8" fontWeight="700" fill="#1e293b">NOTES:</text>
          <text x="0" y="12" fontSize="7" fill="#64748b">
            1. Block material MUST match test part material (acoustic equivalent NOT acceptable)
          </text>
          <text x="0" y="22" fontSize="7" fill="#64748b">
            2. Calibrate before AND after each inspection batch
          </text>
          <text x="0" y="32" fontSize="7" fill="#64748b">
            3. EDM notch simulates axial-oriented defects in bar/billet
          </text>
          <text x="350" y="12" fontSize="7" fill="#64748b">
            4. 3-point DAC curve required
          </text>
          <text x="350" y="22" fontSize="7" fill="#64748b">
            5. Per PWA 127 / SIS 26B specification
          </text>
          <text x="350" y="32" fontSize="7" fill="#64748b">
            6. Contact PW Supplier Portal (eSRI) for details
          </text>
        </g>
      </svg>
    </div>
  );
}

export default PWASIMCalibrationBlockDrawing;
