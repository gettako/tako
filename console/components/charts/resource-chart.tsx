"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

export interface TelemetryPoint {
  timestamp: string
  value: number
}

export interface ResourceChartProps {
  title: string
  currentValue: string
  unit?: string
  data: TelemetryPoint[]
  color?: "primary" | "emerald" | "amber" | "sky" | "rose"
  timeRanges?: string[]
  selectedRange?: string
  onRangeChange?: (range: string) => void
  yMax?: number
  ariaLabel?: string
  className?: string
  peakValue?: string
  avgValue?: string
}

export function ResourceChart({
  title,
  currentValue,
  unit = "%",
  data = [],
  color = "primary",
  timeRanges = ["15m", "1h", "6h", "24h"],
  selectedRange = "1h",
  onRangeChange,
  yMax,
  ariaLabel,
  className,
  peakValue,
  avgValue,
}: ResourceChartProps) {
  const containerRef = React.useRef<HTMLDivElement>(null)
  const [hoverIndex, setHoverIndex] = React.useState<number | null>(null)
  const [activeRange, setActiveRange] = React.useState(selectedRange)

  React.useEffect(() => {
    setActiveRange(selectedRange)
  }, [selectedRange])

  const handleRangeClick = (range: string) => {
    setActiveRange(range)
    if (onRangeChange) {
      onRangeChange(range)
    }
  }

  // Color tokens
  const strokeColorClass = {
    primary: "text-primary",
    emerald: "text-emerald-500",
    amber: "text-amber-500",
    sky: "text-sky-500",
    rose: "text-rose-500",
  }[color]

  const fillColor = {
    primary: "var(--primary)",
    emerald: "#10B981",
    amber: "#F59E0B",
    sky: "#0EA5E9",
    rose: "#F43F5E",
  }[color]

  // Min and Max values for Y-axis scaling
  const values = data.map((d) => d.value)
  const computedMax =
    yMax ?? Math.max(100, Math.ceil(Math.max(...values, 10) / 10) * 10)
  const computedMin = 0

  // SVG Coordinates calculation (viewBox: 0 0 500 160)
  const svgWidth = 500
  const svgHeight = 160
  const padLeft = 36
  const padRight = 2
  const padTop = 16
  const padBottom = 28
  const plotWidth = svgWidth - padLeft - padRight
  const plotHeight = svgHeight - padTop - padBottom

  const points = React.useMemo(() => {
    if (data.length === 0) return []
    const count = data.length
    return data.map((item, idx) => {
      const x = padLeft + (idx / Math.max(1, count - 1)) * plotWidth
      const ratio = Math.max(
        0,
        Math.min(1, (item.value - computedMin) / (computedMax - computedMin))
      )
      const y = padTop + (1 - ratio) * plotHeight
      return { x, y, value: item.value, timestamp: item.timestamp }
    })
  }, [data, computedMin, computedMax, plotWidth, plotHeight, padLeft, padTop])

  // Generate smooth SVG path strings (Catmull-Rom spline converted to cubic bezier)
  const { linePath, areaPath } = React.useMemo(() => {
    if (points.length === 0) return { linePath: "", areaPath: "" }
    if (points.length === 1) {
      const p = points[0]
      return {
        linePath: `M ${p.x.toFixed(1)} ${p.y.toFixed(1)} L ${(p.x + 1).toFixed(1)} ${p.y.toFixed(1)}`,
        areaPath: `M ${p.x.toFixed(1)} ${p.y.toFixed(1)} L ${(p.x + 1).toFixed(1)} ${p.y.toFixed(1)} L ${(p.x + 1).toFixed(1)} ${(padTop + plotHeight).toFixed(1)} L ${p.x.toFixed(1)} ${(padTop + plotHeight).toFixed(1)} Z`,
      }
    }

    let line = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[Math.max(0, i - 1)]
      const p1 = points[i]
      const p2 = points[i + 1]
      const p3 = points[Math.min(points.length - 1, i + 2)]

      const cp1x = p1.x + (p2.x - p0.x) / 6
      const cp1y = Math.max(
        padTop,
        Math.min(padTop + plotHeight, p1.y + (p2.y - p0.y) / 6)
      )

      const cp2x = p2.x - (p3.x - p1.x) / 6
      const cp2y = Math.max(
        padTop,
        Math.min(padTop + plotHeight, p2.y - (p3.y - p1.y) / 6)
      )

      line += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`
    }

    const first = points[0]
    const last = points[points.length - 1]
    const bottomY = (padTop + plotHeight).toFixed(1)
    const area = `${line} L ${last.x.toFixed(1)} ${bottomY} L ${first.x.toFixed(1)} ${bottomY} Z`

    return { linePath: line, areaPath: area }
  }, [points, padTop, plotHeight])

  // Mouse hover tracking
  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!containerRef.current || points.length === 0) return
    const rect = e.currentTarget.getBoundingClientRect()
    const mouseX = e.clientX - rect.left
    const svgX = (mouseX / rect.width) * svgWidth

    let closestIdx = 0
    let minDiff = Infinity
    points.forEach((p, idx) => {
      const diff = Math.abs(p.x - svgX)
      if (diff < minDiff) {
        minDiff = diff
        closestIdx = idx
      }
    })
    setHoverIndex(closestIdx)
  }

  const handleMouseLeave = () => {
    setHoverIndex(null)
  }

  const activePoint =
    hoverIndex !== null && points[hoverIndex] ? points[hoverIndex] : null

  // Grid steps (4 horizontal rules)
  const yTicks = [
    { label: `${computedMax}${unit}`, y: padTop },
    {
      label: `${Math.round(computedMax * 0.66)}${unit}`,
      y: padTop + plotHeight * 0.33,
    },
    {
      label: `${Math.round(computedMax * 0.33)}${unit}`,
      y: padTop + plotHeight * 0.66,
    },
    { label: `0${unit}`, y: padTop + plotHeight },
  ]

  function formatTimestamp(ts: string, range?: string): string {
    try {
      const d = new Date(ts)
      if (isNaN(d.getTime())) return ts

      const hours = String(d.getHours()).padStart(2, "0")
      const minutes = String(d.getMinutes()).padStart(2, "0")

      if (range === "7d") {
        const month = d.toLocaleDateString("en-US", { month: "short" })
        const day = d.getDate()
        return `${month} ${day}, ${hours}:${minutes}`
      }

      return `${hours}:${minutes}`
    } catch {
      return ts
    }
  }

  // X ticks (start, middle, end)
  const xTicks = React.useMemo(() => {
    if (data.length < 2) return []
    const first = data[0].timestamp
    const mid = data[Math.floor(data.length / 2)].timestamp
    const last = data[data.length - 1].timestamp
    return [
      {
        text: formatTimestamp(first, activeRange),
        x: padLeft,
        anchor: "start",
      },
      {
        text: formatTimestamp(mid, activeRange),
        x: padLeft + plotWidth / 2,
        anchor: "middle",
      },
      {
        text: formatTimestamp(last, activeRange),
        x: padLeft + plotWidth,
        anchor: "end",
      },
    ]
  }, [data, padLeft, plotWidth, activeRange])

  const chartId = React.useId()

  return (
    <div
      ref={containerRef}
      role="region"
      aria-label={ariaLabel || `${title} telemetry chart`}
      className={cn(
        "flex w-full flex-col justify-between rounded-lg border border-border bg-card p-5 select-none",
        className
      )}
    >
      {/* Chart Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-3">
        <div className="flex flex-col gap-0.5">
          <span className="text-xs font-medium text-muted-foreground">
            {title}
          </span>
          <div className="flex items-baseline gap-2.5">
            <span className="font-heading text-2xl font-bold tracking-tight text-foreground">
              {activePoint
                ? `${activePoint.value.toFixed(1)}${unit}`
                : currentValue}
            </span>
            {activePoint ? (
              <span className="font-mono text-2xs text-muted-foreground">
                at {formatTimestamp(activePoint.timestamp, activeRange)}
              </span>
            ) : (
              (peakValue || avgValue) && (
                <div className="flex items-center gap-2 text-2xs text-muted-foreground">
                  {avgValue && <span>Avg {avgValue}</span>}
                  {peakValue && <span>• Peak {peakValue}</span>}
                </div>
              )
            )}
          </div>
        </div>

        {/* Time Range Selector */}
        {timeRanges.length > 0 && (
          <div
            role="tablist"
            aria-label={`${title} time range`}
            className="flex items-center gap-1 rounded-md border border-border bg-muted/40 p-0.5 text-xs"
          >
            {timeRanges.map((range) => {
              const isSelected = activeRange === range
              return (
                <button
                  key={range}
                  type="button"
                  role="tab"
                  aria-selected={isSelected}
                  onClick={() => handleRangeClick(range)}
                  className={cn(
                    "cursor-pointer rounded px-2.5 py-1 font-mono text-2xs font-medium transition-colors",
                    isSelected
                      ? "border border-border bg-background text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {range}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* SVG Plot Canvas */}
      <div className="relative mt-3 w-full min-w-0">
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          width="100%"
          height="176"
          preserveAspectRatio="none"
          style={{ width: "100%", display: "block" }}
          className="h-44 w-full overflow-visible"
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        >
          <defs>
            <linearGradient id={`grad-${chartId}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={fillColor} stopOpacity="0.28" />
              <stop offset="100%" stopColor={fillColor} stopOpacity="0.01" />
            </linearGradient>
          </defs>

          {/* Grid Lines & Y-axis Labels */}
          {yTicks.map((tick, i) => (
            <g key={i}>
              <line
                x1={padLeft}
                y1={tick.y}
                x2={padLeft + plotWidth}
                y2={tick.y}
                stroke="currentColor"
                strokeDasharray="2 3"
                className="text-border"
              />
              <text
                x={padLeft - 8}
                y={tick.y + 3.5}
                textAnchor="end"
                className="fill-muted-foreground font-mono text-3xs"
              >
                {tick.label}
              </text>
            </g>
          ))}

          {/* Filled Area */}
          {areaPath && (
            <path
              d={areaPath}
              fill={`url(#grad-${chartId})`}
              className={strokeColorClass}
            />
          )}

          {/* Main Line */}
          {linePath && (
            <path
              d={linePath}
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={strokeColorClass}
            />
          )}

          {/* X-axis Ticks */}
          {xTicks.map((tick, i) => (
            <text
              key={i}
              x={tick.x}
              y={padTop + plotHeight + 16}
              textAnchor={tick.anchor as any}
              className="fill-muted-foreground font-mono text-3xs"
            >
              {tick.text}
            </text>
          ))}

          {/* Active Hover Marker & Guide Line */}
          {activePoint && (
            <g>
              <line
                x1={activePoint.x}
                y1={padTop}
                x2={activePoint.x}
                y2={padTop + plotHeight}
                stroke="currentColor"
                strokeWidth="1"
                className="text-muted-foreground/60"
              />
              <circle
                cx={activePoint.x}
                cy={activePoint.y}
                r="3.5"
                fill="currentColor"
                className={cn("stroke-background stroke-2", strokeColorClass)}
              />
            </g>
          )}
        </svg>
      </div>
    </div>
  )
}
