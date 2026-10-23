"use client"

import * as React from "react"
import { Activity, ArrowUpRight, Cpu, Network, Server } from "lucide-react"

import { Button } from "@/components/ui/button"
import { apiGet } from "@/lib/api"
import {
  CHART_HEIGHT,
  CHART_INNER_HEIGHT,
  CHART_INNER_WIDTH,
  CHART_PADDING,
  CHART_WIDTH,
  buildChartArea,
  buildChartLine,
  getChartCoordinates,
} from "@/lib/chart"
import { cn } from "@/lib/utils"

type TimeRange = "15m" | "1h" | "6h" | "24h"
type MetricMode = "cpu" | "memory" | "network"

interface ServiceMetricsChartProps {
  serviceId: string
  serviceSlug: string
  cpuLimit?: number
  memoryLimitMb?: number
}

interface ServicePoint {
  time: string
  cpu: number
  memoryMb: number
  memoryPercent: number
  networkRx: number
  networkTx: number
}

export function ServiceMetricsChart({
  serviceId,
  serviceSlug,
  cpuLimit = 1.0,
  memoryLimitMb = 1024,
}: ServiceMetricsChartProps) {
  const [range, setRange] = React.useState<TimeRange>("1h")
  const [mode, setMode] = React.useState<MetricMode>("cpu")
  const [points, setPoints] = React.useState<ServicePoint[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [hoverIndex, setHoverIndex] = React.useState<number | null>(null)

  React.useEffect(() => {
    let active = true

    async function loadMetrics() {
      try {
        const res = await apiGet<{
          points?: Array<{
            timestamp: string
            cpu: number
            memory: number
            memoryPercent?: number
            networkRx: number
            networkTx: number
          }>
        }>(`/services/${encodeURIComponent(serviceId)}/metrics?range=${range}`)

        if (!active) return

        if (res && Array.isArray(res.points) && res.points.length > 0) {
          const mapped: ServicePoint[] = res.points.map((p) => {
            const d = new Date(p.timestamp)
            const timeStr = !isNaN(d.getTime())
              ? d.toTimeString().slice(0, 5)
              : p.timestamp
            return {
              time: timeStr,
              cpu: Math.max(0, Math.round(p.cpu * 100) / 100),
              memoryMb: Math.max(0, p.memory),
              memoryPercent:
                p.memoryPercent ??
                Math.min(100, Math.round((p.memory / memoryLimitMb) * 100)),
              networkRx: Math.max(0, Math.round(p.networkRx * 10) / 10),
              networkTx: Math.max(0, Math.round(p.networkTx * 10) / 10),
            }
          })
          setPoints(mapped)
        }
      } catch {
        // Retain previous or fallback points on fetch error
      } finally {
        if (active) {
          setIsLoading(false)
        }
      }
    }

    void loadMetrics()
    const timer = setInterval(() => {
      void loadMetrics()
    }, 10000)

    return () => {
      active = false
      clearInterval(timer)
    }
  }, [serviceId, range, memoryLimitMb])

  // Extract values based on active mode
  const values = React.useMemo(() => {
    if (points.length === 0) {
      return Array.from({ length: 15 }, () => 0)
    }
    switch (mode) {
      case "cpu":
        return points.map((p) => p.cpu)
      case "memory":
        return points.map((p) => p.memoryMb)
      case "network":
        return points.map((p) => p.networkRx + p.networkTx)
    }
  }, [points, mode])

  const { minVal, maxVal, currentVal, peakVal, avgVal, unit } =
    React.useMemo(() => {
      if (values.length === 0) {
        return {
          minVal: 0,
          maxVal: 100,
          currentVal: 0,
          peakVal: 0,
          avgVal: 0,
          unit: "%",
        }
      }

      let u = "%"
      let minBound = 0
      let maxBound = 100

      if (mode === "cpu") {
        u = "%"
        const maxData = Math.max(...values, 1)
        maxBound = Math.max(20, Math.ceil(maxData * 1.2))
      } else if (mode === "memory") {
        u = "MB"
        maxBound = Math.max(memoryLimitMb, Math.max(...values, 128))
      } else {
        u = "KB/s"
        const maxData = Math.max(...values, 10)
        maxBound = Math.ceil(maxData * 1.25)
      }

      const cur = values[values.length - 1] ?? 0
      const peak = Math.max(...values, 0)
      const sum = values.reduce((acc, v) => acc + v, 0)
      const avg = Number((sum / values.length).toFixed(1))

      return {
        minVal: minBound,
        maxVal: maxBound,
        currentVal: cur,
        peakVal: peak,
        avgVal: avg,
        unit: u,
      }
    }, [values, mode, memoryLimitMb])

  const coords = React.useMemo(() => {
    return getChartCoordinates(values, minVal, maxVal)
  }, [values, minVal, maxVal])

  const linePath = React.useMemo(() => buildChartLine(coords), [coords])
  const areaPath = React.useMemo(
    () => buildChartArea(coords),
    [coords]
  )

  const activePoint =
    hoverIndex !== null && hoverIndex < points.length
      ? points[hoverIndex]
      : null

  const activeCoord =
    hoverIndex !== null && hoverIndex < coords.length
      ? coords[hoverIndex]
      : null

  return (
    <div className="rounded-lg border border-border bg-card p-5 shadow-xs">
      {/* Header and Controls */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-border pb-3.5">
        <div className="flex items-center gap-2">
          <Activity className="size-4 text-primary" />
          <h2 className="text-sm font-semibold text-foreground">
            Resource Utilization Trend
          </h2>
          <span className="ml-1 rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground uppercase">
            {serviceSlug}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Mode Switcher */}
          <div className="flex items-center rounded-md border border-border bg-muted/30 p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setMode("cpu")}
              className={cn(
                "flex items-center gap-1 rounded px-2.5 py-1 font-mono transition-colors",
                mode === "cpu"
                  ? "bg-card font-medium text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Cpu className="size-3 text-primary" />
              CPU
            </button>
            <button
              type="button"
              onClick={() => setMode("memory")}
              className={cn(
                "flex items-center gap-1 rounded px-2.5 py-1 font-mono transition-colors",
                mode === "memory"
                  ? "bg-card font-medium text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Server className="size-3 text-emerald-500" />
              Memory
            </button>
            <button
              type="button"
              onClick={() => setMode("network")}
              className={cn(
                "flex items-center gap-1 rounded px-2.5 py-1 font-mono transition-colors",
                mode === "network"
                  ? "bg-card font-medium text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Network className="size-3 text-blue-400" />
              Network
            </button>
          </div>

          {/* Time Range Selector */}
          <div className="flex items-center rounded-md border border-border bg-muted/30 p-0.5 text-xs">
            {(["15m", "1h", "6h", "24h"] as TimeRange[]).map((r) => (
              <Button
                key={r}
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setRange(r)
                  setIsLoading(true)
                }}
                className={cn(
                  "h-6 px-2 font-mono text-[11px] rounded transition-colors",
                  range === r
                    ? "bg-card font-semibold text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {r}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {/* Summary KPI Badges */}
      <div className="mt-3.5 grid grid-cols-2 gap-2 sm:grid-cols-4 font-mono text-xs">
        <div className="rounded border border-border/70 bg-muted/15 p-2.5">
          <span className="text-[11px] text-muted-foreground">Current</span>
          <div className="mt-0.5 font-bold text-foreground">
            {currentVal} {unit}
          </div>
        </div>
        <div className="rounded border border-border/70 bg-muted/15 p-2.5">
          <span className="text-[11px] text-muted-foreground">Peak</span>
          <div className="mt-0.5 font-bold text-primary flex items-center gap-1">
            <ArrowUpRight className="size-3" />
            {peakVal} {unit}
          </div>
        </div>
        <div className="rounded border border-border/70 bg-muted/15 p-2.5">
          <span className="text-[11px] text-muted-foreground">Average</span>
          <div className="mt-0.5 font-bold text-foreground">
            {avgVal} {unit}
          </div>
        </div>
        <div className="rounded border border-border/70 bg-muted/15 p-2.5">
          <span className="text-[11px] text-muted-foreground">Allocation Limit</span>
          <div className="mt-0.5 font-bold text-muted-foreground">
            {mode === "cpu"
              ? `${cpuLimit} vCPU`
              : mode === "memory"
              ? `${memoryLimitMb} MB`
              : "Unlimited"}
          </div>
        </div>
      </div>

      {/* SVG Interactive Chart */}
      <div className="relative mt-4 w-full">
        {isLoading && points.length === 0 ? (
          <div className="flex h-44 w-full items-center justify-center font-mono text-xs text-muted-foreground">
            Loading telemetry metrics stream...
          </div>
        ) : (
          <svg
            viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
            className="h-44 w-full overflow-hidden select-none"
            onMouseLeave={() => setHoverIndex(null)}
          >
            <defs>
              <linearGradient
                id={`gradient-${mode}-${serviceId}`}
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop
                  offset="0%"
                  stopColor={
                    mode === "cpu"
                      ? "var(--color-primary)"
                      : mode === "memory"
                      ? "#10b981"
                      : "#60a5fa"
                  }
                  stopOpacity="0.32"
                />
                <stop
                  offset="100%"
                  stopColor={
                    mode === "cpu"
                      ? "var(--color-primary)"
                      : mode === "memory"
                      ? "#10b981"
                      : "#60a5fa"
                  }
                  stopOpacity="0.0"
                />
              </linearGradient>
            </defs>

            {/* Horizontal Grid lines */}
            {[0, 0.25, 0.5, 0.75, 1].map((pct) => {
              const y =
                CHART_PADDING.top + CHART_INNER_HEIGHT * (1 - pct)
              const val = Math.round(minVal + (maxVal - minVal) * pct)
              return (
                <g key={pct}>
                  <line
                    x1={CHART_PADDING.left}
                    y1={y}
                    x2={CHART_PADDING.left + CHART_INNER_WIDTH}
                    y2={y}
                    stroke="var(--color-border)"
                    strokeDasharray="3 3"
                    strokeOpacity="0.6"
                  />
                  <text
                    x={CHART_PADDING.left - 6}
                    y={y + 3}
                    textAnchor="end"
                    fill="var(--color-muted-foreground)"
                    fontSize="9"
                    fontFamily="monospace"
                  >
                    {val}
                  </text>
                </g>
              )
            })}

            {/* Area fill */}
            {areaPath && (
              <path
                d={areaPath}
                fill={`url(#gradient-${mode}-${serviceId})`}
              />
            )}

            {/* Primary stroke line */}
            {linePath && (
              <path
                d={linePath}
                fill="none"
                stroke={
                  mode === "cpu"
                    ? "var(--color-primary)"
                    : mode === "memory"
                    ? "#10b981"
                    : "#60a5fa"
                }
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}

            {/* Crosshair hover state */}
            {activeCoord && activePoint && (
              <g>
                <line
                  x1={activeCoord.x}
                  y1={CHART_PADDING.top}
                  x2={activeCoord.x}
                  y2={CHART_PADDING.top + CHART_INNER_HEIGHT}
                  stroke="var(--color-foreground)"
                  strokeWidth="1"
                  strokeDasharray="2 2"
                  opacity="0.75"
                />
                <circle
                  cx={activeCoord.x}
                  cy={activeCoord.y}
                  r="4"
                  fill="var(--color-background)"
                  stroke={
                    mode === "cpu"
                      ? "var(--color-primary)"
                      : mode === "memory"
                      ? "#10b981"
                      : "#60a5fa"
                  }
                  strokeWidth="2.5"
                />
              </g>
            )}

            {/* Hover detection transparent columns */}
            {coords.map((c, idx) => {
              const colWidth = CHART_INNER_WIDTH / Math.max(1, coords.length)
              const colX = Math.max(
                CHART_PADDING.left,
                c.x - colWidth / 2
              )
              return (
                <rect
                  key={idx}
                  x={colX}
                  y={CHART_PADDING.top}
                  width={colWidth}
                  height={CHART_INNER_HEIGHT}
                  fill="transparent"
                  className="cursor-crosshair"
                  onMouseEnter={() => setHoverIndex(idx)}
                />
              )
            })}
          </svg>
        )}

        {/* Hover Tooltip floating badge */}
        {activePoint && activeCoord && (
          <div
            className="pointer-events-none absolute top-1 rounded-md border border-border/80 bg-popover/95 px-2.5 py-1.5 font-mono text-[11px] text-popover-foreground shadow-md backdrop-blur-xs"
            style={{
              left: `${Math.max(
                10,
                Math.min(
                  80,
                  ((activeCoord.x - CHART_PADDING.left) / CHART_INNER_WIDTH) * 100
                )
              )}%`,
              transform: "translateX(-50%)",
            }}
          >
            <div className="text-[10px] text-muted-foreground">
              {activePoint.time}
            </div>
            <div className="font-bold text-foreground">
              {mode === "cpu" && `CPU: ${activePoint.cpu}%`}
              {mode === "memory" &&
                `Memory: ${activePoint.memoryMb} MB (${activePoint.memoryPercent}%)`}
              {mode === "network" &&
                `RX: ${activePoint.networkRx} KB/s • TX: ${activePoint.networkTx} KB/s`}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
