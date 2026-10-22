import * as React from "react"
import {
  CHART_HEIGHT,
  CHART_INNER_HEIGHT,
  CHART_INNER_WIDTH,
  CHART_PADDING,
  CHART_WIDTH,
  type ChartPoint,
} from "@/lib/chart"

export interface TelemetrySeries {
  id: string
  coords: ChartPoint[]
  line: string
  area?: string
  color: string
  gradientId?: string
  gradientOpacity?: number
}

export interface TelemetryTick {
  position: number
  label: string
}

interface TelemetryChartProps {
  data: { time: string }[]
  series: TelemetrySeries[]
  ticks: TelemetryTick[]
  hoverIndex: number | null
  onHover: (index: number | null) => void
  dotRadius?: number
  dotStrokeWidth?: number
  crosshairColor?: string
  crosshairClassName?: string
}

export function TelemetryChart({
  data,
  series,
  ticks,
  hoverIndex,
  onHover,
  dotRadius = 4.5,
  dotStrokeWidth = 2,
  crosshairColor,
  crosshairClassName = "opacity-80",
}: TelemetryChartProps) {
  const clipId = React.useId().replace(/[^a-zA-Z0-9]/g, "")
  const primary = series[0]
  const primaryHoverPoint =
    hoverIndex !== null ? primary?.coords[hoverIndex] : undefined

  return (
    <div className="relative mt-4 w-full overflow-hidden">
      <svg
        viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
        className="h-44 w-full overflow-hidden select-none"
        onMouseLeave={() => onHover(null)}
      >
        <defs>
          <clipPath id={clipId}>
            <rect
              x={CHART_PADDING.left}
              y={CHART_PADDING.top}
              width={CHART_INNER_WIDTH}
              height={CHART_INNER_HEIGHT}
            />
          </clipPath>
          {series.map((item) =>
            item.gradientId && item.area ? (
              <linearGradient
                key={item.gradientId}
                id={item.gradientId}
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop
                  offset="0%"
                  stopColor={item.color}
                  stopOpacity={item.gradientOpacity ?? 0.32}
                />
                <stop offset="100%" stopColor={item.color} stopOpacity="0.0" />
              </linearGradient>
            ) : null
          )}
        </defs>

        {ticks.map((tick) => {
          const y =
            CHART_PADDING.top +
            CHART_INNER_HEIGHT -
            tick.position * CHART_INNER_HEIGHT

          return (
            <g key={`${tick.position}-${tick.label}`}>
              <line
                x1={CHART_PADDING.left}
                y1={y}
                x2={CHART_WIDTH - CHART_PADDING.right}
                y2={y}
                stroke="currentColor"
                strokeDasharray="2 3"
                className="text-border/60"
              />
              <text
                x={CHART_PADDING.left - 6}
                y={y + 3}
                textAnchor="end"
                className="fill-muted-foreground font-mono text-[9px]"
              >
                {tick.label}
              </text>
            </g>
          )
        })}

        <g clipPath={`url(#${clipId})`}>
          {series.map((item) => (
            <g key={item.id}>
              {item.area && item.gradientId && (
                <path d={item.area} fill={`url(#${item.gradientId})`} />
              )}
              <path
                d={item.line}
                fill="none"
                stroke={item.color}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </g>
          ))}
        </g>

        {data.map((point, index) => {
          const colWidth = CHART_INNER_WIDTH / data.length
          const x = CHART_PADDING.left + index * colWidth

          return (
            <rect
              key={point.time + index}
              x={x}
              y={CHART_PADDING.top}
              width={colWidth}
              height={CHART_INNER_HEIGHT}
              fill="transparent"
              className="cursor-crosshair"
              onMouseEnter={() => onHover(index)}
            />
          )
        })}

        {hoverIndex !== null &&
          primaryHoverPoint &&
          Number.isFinite(primaryHoverPoint.x) &&
          Number.isFinite(primaryHoverPoint.y) && (
            <g>
              <line
                x1={primaryHoverPoint.x}
                y1={CHART_PADDING.top}
                x2={primaryHoverPoint.x}
                y2={CHART_PADDING.top + CHART_INNER_HEIGHT}
                stroke={crosshairColor ?? primary.color}
                strokeDasharray="2 2"
                strokeWidth="1.5"
                className={crosshairClassName}
              />
              {series.map((item) => {
                const point = item.coords[hoverIndex]

                if (
                  !point ||
                  !Number.isFinite(point.x) ||
                  !Number.isFinite(point.y)
                ) {
                  return null
                }

                return (
                  <circle
                    key={item.id}
                    cx={point.x}
                    cy={point.y}
                    r={dotRadius}
                    fill={item.color}
                    stroke="#ffffff"
                    strokeWidth={dotStrokeWidth}
                  />
                )
              })}
            </g>
          )}

        {data.length > 0 && (
          <>
            <text
              x={CHART_PADDING.left}
              y={CHART_HEIGHT - 8}
              textAnchor="start"
              className="fill-muted-foreground font-mono text-[10px]"
            >
              {data[0]?.time}
            </text>
            <text
              x={CHART_WIDTH / 2}
              y={CHART_HEIGHT - 8}
              textAnchor="middle"
              className="fill-muted-foreground font-mono text-[10px]"
            >
              {data[Math.floor(data.length / 2)]?.time}
            </text>
            <text
              x={CHART_WIDTH - CHART_PADDING.right}
              y={CHART_HEIGHT - 8}
              textAnchor="end"
              className="fill-muted-foreground font-mono text-[10px]"
            >
              {data[data.length - 1]?.time}
            </text>
          </>
        )}
      </svg>
    </div>
  )
}
