import { useId } from 'react';
import { cn } from '@/lib/utils';
import {
  normalizeRtSetupDiagram,
  type RtSetupDiagramInput,
  type RtSetupDimensionDisplay,
} from '@/lib/rtPtSetupDiagram';

export interface RtRadiographySetupDiagramProps extends RtSetupDiagramInput {
  className?: string;
}

interface DimensionLineProps {
  dimension: RtSetupDimensionDisplay;
  x1: number;
  x2: number;
  y: number;
  emphasis?: boolean;
}

interface SvgCalloutProps {
  label: string;
  value: string;
  x: number;
  y: number;
  width: number;
  leader?: {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
  };
}

const compactSvgText = (value: string, maximumCharacters: number): string => {
  const characters = Array.from(value);
  if (characters.length <= maximumCharacters) return value;
  return `${characters.slice(0, maximumCharacters - 1).join('').trimEnd()}…`;
};

function DimensionLine({
  dimension,
  x1,
  x2,
  y,
  emphasis = false,
}: DimensionLineProps) {
  const midpoint = (x1 + x2) / 2;
  const textBoxWidth = 210;
  const colorClass = emphasis ? 'text-primary' : 'text-muted-foreground';

  return (
    <g className={colorClass}>
      <title>{`${dimension.name}: ${dimension.value}`}</title>
      <line
        x1={x1}
        y1={y}
        x2={x2}
        y2={y}
        stroke="currentColor"
        strokeWidth={emphasis ? 2.25 : 1.75}
        vectorEffect="non-scaling-stroke"
      />
      <path
        d={`M ${x1 + 11} ${y - 6} L ${x1} ${y} L ${x1 + 11} ${y + 6}`}
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        vectorEffect="non-scaling-stroke"
      />
      <path
        d={`M ${x2 - 11} ${y - 6} L ${x2} ${y} L ${x2 - 11} ${y + 6}`}
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        vectorEffect="non-scaling-stroke"
      />
      <rect
        x={midpoint - textBoxWidth / 2}
        y={y - 15}
        width={textBoxWidth}
        height={30}
        rx={8}
        className="fill-background stroke-border"
        strokeWidth={1}
        vectorEffect="non-scaling-stroke"
      />
      <text
        x={midpoint}
        y={y + 5}
        textAnchor="middle"
        fill="currentColor"
        fontSize={14}
        fontWeight={700}
        letterSpacing="0.02em"
      >
        {dimension.display}
      </text>
    </g>
  );
}

function SvgCallout({ label, value, x, y, width, leader }: SvgCalloutProps) {
  return (
    <g>
      {leader ? (
        <line
          x1={leader.x1}
          y1={leader.y1}
          x2={leader.x2}
          y2={leader.y2}
          className="stroke-muted-foreground"
          strokeDasharray="4 4"
          strokeWidth={1.5}
          vectorEffect="non-scaling-stroke"
        />
      ) : null}
      <rect
        x={x}
        y={y}
        width={width}
        height={64}
        rx={10}
        className="fill-card stroke-border"
        strokeWidth={1.25}
        vectorEffect="non-scaling-stroke"
      />
      <text
        x={x + 14}
        y={y + 23}
        className="fill-muted-foreground"
        fontSize={11}
        fontWeight={700}
        letterSpacing="0.1em"
      >
        {label.toUpperCase()}
      </text>
      <text
        x={x + 14}
        y={y + 47}
        className="fill-foreground"
        fontSize={14}
        fontWeight={650}
      >
        <title>{value}</title>
        {compactSvgText(value, Math.max(18, Math.floor(width / 7.4)))}
      </text>
    </g>
  );
}

export function RtRadiographySetupDiagram({
  className,
  ...input
}: RtRadiographySetupDiagramProps) {
  const diagram = normalizeRtSetupDiagram(input);
  const generatedId = useId().replace(/:/g, '-');
  const headingId = `rt-setup-heading-${generatedId}`;
  const svgTitleId = `rt-setup-title-${generatedId}`;
  const svgDescriptionId = `rt-setup-description-${generatedId}`;
  const captionId = `rt-setup-caption-${generatedId}`;
  const gridPatternId = `rt-setup-grid-${generatedId}`;
  const isFilm = diagram.mode === 'film';

  const description = [
    `${diagram.methodLabel} schematic for ${diagram.viewCallout}.`,
    `${diagram.sourceHeading}, ${diagram.sourceLabel}, directs a beam through ${diagram.partLabel} to ${diagram.receptorLabel}.`,
    `${diagram.dimensions.sourceToReceptor.name}: ${diagram.dimensions.sourceToReceptor.value};`,
    `${diagram.dimensions.sourceToObject.name}: ${diagram.dimensions.sourceToObject.value};`,
    `${diagram.dimensions.objectToReceptor.name}: ${diagram.dimensions.objectToReceptor.value}.`,
    `Orientation: ${diagram.orientation}. Inspection zone: ${diagram.inspectionZone}.`,
    `IQI placement: ${diagram.iqiPlacement}. Marker placement: ${diagram.markerPlacement}.`,
    'This planning schematic is not to scale.',
  ].join(' ');

  const dimensions = [
    diagram.dimensions.sourceToReceptor,
    diagram.dimensions.sourceToObject,
    diagram.dimensions.objectToReceptor,
  ];

  const callouts = [
    { label: 'View / callout', value: diagram.viewCallout },
    { label: 'Orientation', value: diagram.orientation },
    { label: 'Inspection zone', value: diagram.inspectionZone },
    { label: 'IQI placement', value: diagram.iqiPlacement },
    { label: 'Marker placement', value: diagram.markerPlacement },
    { label: diagram.receptorHeading, value: diagram.receptorLabel },
  ];

  return (
    <figure
      className={cn(
        'overflow-hidden rounded-2xl border border-border/80 bg-card shadow-sm',
        className,
      )}
      aria-labelledby={headingId}
      aria-describedby={captionId}
    >
      <div className="flex flex-col gap-3 border-b border-border/70 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-primary/25 bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
              {diagram.methodLabel}
            </span>
            <span className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Planned setup
            </span>
          </div>
          <h3 id={headingId} className="truncate text-base font-semibold text-foreground">
            {diagram.title}
          </h3>
        </div>
        <div className="flex w-fit items-center gap-2 rounded-lg border border-warning/30 bg-warning/10 px-3 py-1.5 text-xs font-semibold text-warning">
          <span aria-hidden="true" className="h-2 w-2 rounded-full bg-warning" />
          Schematic only · Not to scale
        </div>
      </div>

      <div
        className="overflow-x-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
        tabIndex={0}
        aria-label={`Scrollable ${diagram.methodLabel} setup drawing`}
      >
        <svg
          viewBox="0 0 1000 615"
          role="img"
          aria-labelledby={svgTitleId}
          aria-describedby={svgDescriptionId}
          className="block h-auto w-full min-w-[720px] bg-background"
          preserveAspectRatio="xMidYMid meet"
          shapeRendering="geometricPrecision"
        >
          <title id={svgTitleId}>{diagram.title}</title>
          <desc id={svgDescriptionId}>{description}</desc>

          <defs>
            <pattern id={gridPatternId} width="24" height="24" patternUnits="userSpaceOnUse">
              <path
                d="M 24 0 L 0 0 0 24"
                fill="none"
                className="stroke-border"
                strokeOpacity={0.28}
                strokeWidth={1}
                vectorEffect="non-scaling-stroke"
              />
            </pattern>
          </defs>

          <rect width="1000" height="615" className="fill-background" />
          <rect width="1000" height="615" fill={`url(#${gridPatternId})`} />

          <g>
            <rect
              x={30}
              y={28}
              width={220}
              height={36}
              rx={18}
              className="fill-primary stroke-primary"
              fillOpacity={0.1}
              strokeOpacity={0.3}
              strokeWidth={1.25}
              vectorEffect="non-scaling-stroke"
            />
            <text
              x={140}
              y={51}
              textAnchor="middle"
              className="fill-primary"
              fontSize={13}
              fontWeight={750}
              letterSpacing="0.08em"
            >
              {isFilm ? 'FILM EXPOSURE SETUP' : 'DDA ACQUISITION SETUP'}
            </text>
            <text
              x={31}
              y={88}
              className="fill-muted-foreground"
              fontSize={11}
              fontWeight={700}
              letterSpacing="0.12em"
            >
              SCHEMATIC · NTS
            </text>
          </g>

          <SvgCallout
            label="IQI placement"
            value={diagram.iqiPlacement}
            x={292}
            y={30}
            width={286}
            leader={{ x1: 438, y1: 94, x2: 461, y2: 188 }}
          />

          <g>
            <rect
              x={650}
              y={24}
              width={320}
              height={108}
              rx={12}
              className="fill-card stroke-border"
              strokeWidth={1.25}
              vectorEffect="non-scaling-stroke"
            />
            <line x1={650} y1={60} x2={970} y2={60} className="stroke-border" />
            <line x1={650} y1={96} x2={970} y2={96} className="stroke-border" />
            {[
              { label: 'VIEW / CALLOUT', value: diagram.viewCallout, y: 47 },
              { label: 'ORIENTATION', value: diagram.orientation, y: 83 },
              { label: 'INSPECTION ZONE', value: diagram.inspectionZone, y: 119 },
            ].map((row) => (
              <g key={row.label}>
                <text
                  x={666}
                  y={row.y}
                  className="fill-muted-foreground"
                  fontSize={10}
                  fontWeight={700}
                  letterSpacing="0.08em"
                >
                  {row.label}
                </text>
                <text
                  x={792}
                  y={row.y}
                  className="fill-foreground"
                  fontSize={12}
                  fontWeight={650}
                >
                  <title>{row.value}</title>
                  {compactSvgText(row.value, 24)}
                </text>
              </g>
            ))}
          </g>

          <path
            d="M 120 260 L 835 132 L 835 388 Z"
            className="fill-primary stroke-primary"
            fillOpacity={0.08}
            strokeOpacity={0.58}
            strokeDasharray="10 8"
            strokeWidth={1.75}
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
          <line
            x1={120}
            y1={260}
            x2={835}
            y2={260}
            className="stroke-primary"
            strokeOpacity={0.72}
            strokeDasharray="12 7 2 7"
            strokeWidth={1.75}
            vectorEffect="non-scaling-stroke"
          />
          <text
            x={260}
            y={214}
            className="fill-primary"
            fontSize={11}
            fontWeight={700}
            letterSpacing="0.08em"
            transform="rotate(-10 260 214)"
          >
            PLANNED BEAM ENVELOPE
          </text>

          <g>
            <circle
              cx={120}
              cy={260}
              r={39}
              className="fill-card stroke-primary"
              strokeWidth={2.5}
              vectorEffect="non-scaling-stroke"
            />
            <circle
              cx={120}
              cy={260}
              r={13}
              className="fill-primary stroke-primary"
              fillOpacity={0.18}
              strokeWidth={2}
              vectorEffect="non-scaling-stroke"
            />
            <line x1={99} y1={260} x2={141} y2={260} className="stroke-primary" strokeWidth={1.5} />
            <line x1={120} y1={239} x2={120} y2={281} className="stroke-primary" strokeWidth={1.5} />
            <circle cx={120} cy={260} r={3.5} className="fill-primary" />
            <text
              x={120}
              y={332}
              textAnchor="middle"
              className="fill-foreground"
              fontSize={14}
              fontWeight={750}
            >
              {diagram.sourceHeading}
            </text>
            <text
              x={120}
              y={352}
              textAnchor="middle"
              className="fill-muted-foreground"
              fontSize={12}
            >
              <title>{diagram.sourceLabel}</title>
              {compactSvgText(diagram.sourceLabel, 25)}
            </text>
          </g>

          <g>
            <rect
              x={470}
              y={158}
              width={120}
              height={214}
              rx={8}
              className="fill-muted stroke-foreground"
              fillOpacity={0.92}
              strokeOpacity={0.72}
              strokeWidth={2.25}
              vectorEffect="non-scaling-stroke"
            />
            <path
              d="M 484 158 L 470 172 M 505 158 L 470 193 M 590 330 L 548 372 M 590 351 L 569 372"
              className="stroke-muted-foreground"
              strokeOpacity={0.42}
              strokeWidth={1.25}
              vectorEffect="non-scaling-stroke"
            />
            <rect
              x={470}
              y={236}
              width={120}
              height={62}
              className="fill-warning stroke-warning"
              fillOpacity={0.14}
              strokeOpacity={0.8}
              strokeDasharray="5 4"
              strokeWidth={1.5}
              vectorEffect="non-scaling-stroke"
            />
            <text
              x={530}
              y={261}
              textAnchor="middle"
              className="fill-foreground"
              fontSize={12}
              fontWeight={800}
              letterSpacing="0.08em"
            >
              INSPECTION
            </text>
            <text
              x={530}
              y={279}
              textAnchor="middle"
              className="fill-foreground"
              fontSize={12}
              fontWeight={800}
              letterSpacing="0.08em"
            >
              ZONE
            </text>
            <line
              x1={530}
              y1={151}
              x2={530}
              y2={118}
              className="stroke-foreground"
              strokeWidth={2}
              vectorEffect="non-scaling-stroke"
            />
            <path d="M 524 128 L 530 117 L 536 128" className="fill-none stroke-foreground" strokeWidth={2} />
            <text
              x={530}
              y={108}
              textAnchor="middle"
              className="fill-muted-foreground"
              fontSize={10}
              fontWeight={700}
              letterSpacing="0.08em"
            >
              ORIENTATION
            </text>
            <text
              x={530}
              y={400}
              textAnchor="middle"
              className="fill-foreground"
              fontSize={14}
              fontWeight={750}
            >
              Test part
            </text>
            <text
              x={530}
              y={420}
              textAnchor="middle"
              className="fill-muted-foreground"
              fontSize={12}
            >
              <title>{diagram.partLabel}</title>
              {compactSvgText(diagram.partLabel, 29)}
            </text>
          </g>

          <g>
            <rect
              x={451}
              y={190}
              width={16}
              height={54}
              rx={2}
              className="fill-warning stroke-warning"
              fillOpacity={0.4}
              strokeWidth={1.75}
              vectorEffect="non-scaling-stroke"
            />
            <line x1={455} y1={201} x2={463} y2={201} className="stroke-warning" />
            <line x1={455} y1={210} x2={463} y2={210} className="stroke-warning" />
            <line x1={455} y1={219} x2={463} y2={219} className="stroke-warning" />
            <text
              x={459}
              y={181}
              textAnchor="middle"
              className="fill-warning"
              fontSize={10}
              fontWeight={800}
            >
              IQI
            </text>
          </g>

          <g>
            {isFilm ? (
              <>
                <rect
                  x={835}
                  y={130}
                  width={42}
                  height={260}
                  rx={5}
                  className="fill-muted stroke-foreground"
                  strokeWidth={2.25}
                  vectorEffect="non-scaling-stroke"
                />
                <rect
                  x={842}
                  y={138}
                  width={28}
                  height={244}
                  rx={2}
                  className="fill-background stroke-muted-foreground"
                  strokeWidth={1.25}
                  vectorEffect="non-scaling-stroke"
                />
                <line x1={850} y1={142} x2={850} y2={378} className="stroke-muted-foreground" strokeOpacity={0.55} />
                <line x1={862} y1={142} x2={862} y2={378} className="stroke-muted-foreground" strokeOpacity={0.55} />
              </>
            ) : (
              <>
                <rect
                  x={835}
                  y={130}
                  width={42}
                  height={260}
                  rx={5}
                  className="fill-primary stroke-foreground"
                  fillOpacity={0.18}
                  strokeWidth={2.25}
                  vectorEffect="non-scaling-stroke"
                />
                {[154, 190, 226, 262, 298, 334, 370].map((y) => (
                  <line key={y} x1={841} y1={y} x2={871} y2={y} className="stroke-primary" strokeOpacity={0.42} />
                ))}
                <line x1={851} y1={137} x2={851} y2={383} className="stroke-primary" strokeOpacity={0.42} />
                <line x1={861} y1={137} x2={861} y2={383} className="stroke-primary" strokeOpacity={0.42} />
              </>
            )}
            <text
              x={856}
              y={119}
              textAnchor="middle"
              className="fill-foreground"
              fontSize={11}
              fontWeight={800}
              letterSpacing="0.06em"
            >
              {isFilm ? 'FILM / CASSETTE' : 'DDA DETECTOR'}
            </text>
          </g>

          <g>
            <rect
              x={809}
              y={320}
              width={22}
              height={45}
              rx={3}
              className="fill-success stroke-success"
              fillOpacity={0.24}
              strokeWidth={1.75}
              vectorEffect="non-scaling-stroke"
            />
            <text
              x={820}
              y={347}
              textAnchor="middle"
              className="fill-success"
              fontSize={8}
              fontWeight={900}
            >
              ID
            </text>
          </g>

          <SvgCallout
            label="Marker placement"
            value={diagram.markerPlacement}
            x={617}
            y={382}
            width={190}
            leader={{ x1: 807, y1: 414, x2: 820, y2: 365 }}
          />

          <g className="stroke-border" strokeDasharray="3 5" strokeWidth={1.25}>
            <line x1={120} y1={414} x2={120} y2={594} vectorEffect="non-scaling-stroke" />
            <line x1={530} y1={425} x2={530} y2={594} vectorEffect="non-scaling-stroke" />
            <line x1={856} y1={398} x2={856} y2={594} vectorEffect="non-scaling-stroke" />
          </g>

          <DimensionLine
            dimension={diagram.dimensions.sourceToReceptor}
            x1={120}
            x2={856}
            y={477}
            emphasis
          />
          <DimensionLine
            dimension={diagram.dimensions.sourceToObject}
            x1={120}
            x2={530}
            y={528}
          />
          <DimensionLine
            dimension={diagram.dimensions.objectToReceptor}
            x1={530}
            x2={856}
            y={579}
          />
        </svg>
      </div>

      <figcaption id={captionId} className="space-y-3 border-t border-border/70 bg-muted/20 px-4 py-3">
        <dl className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {dimensions.map((item) => (
            <div key={item.code} className="rounded-lg border border-border/70 bg-background/70 px-3 py-2">
              <dt className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                <abbr title={item.name} className="no-underline">{item.code}</abbr>
                <span className="normal-case tracking-normal"> · {item.name}</span>
              </dt>
              <dd className={cn('mt-0.5 text-sm font-semibold', item.isSpecified ? 'text-foreground' : 'text-muted-foreground')}>
                {item.value}
              </dd>
            </div>
          ))}
        </dl>

        <dl className="grid grid-cols-1 gap-x-5 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
          {callouts.map((item) => (
            <div key={item.label} className="min-w-0">
              <dt className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                {item.label}
              </dt>
              <dd className="truncate text-sm text-foreground" title={item.value}>{item.value}</dd>
            </div>
          ))}
        </dl>

        <p className="text-xs leading-5 text-muted-foreground">
          Distances and placement notes show planned inputs. Drawing proportions are illustrative and must not be used for measurement.
        </p>
      </figcaption>
    </figure>
  );
}
