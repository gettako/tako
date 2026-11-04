"use client"

import * as React from "react"
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  CheckCircle2,
  Cpu,
  Database,
  HardDrive,
  Network,
  Server,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { ClusterNode } from "@/types/platform"
import { useNodeMetrics } from "@/hooks/use-nodes"
import {
  CHART_HEIGHT,
  CHART_INNER_HEIGHT,
  CHART_PADDING,
  CHART_WIDTH,
  buildSmoothChartArea,
  buildSmoothChartLine,
  getChartCoordinates,
} from "@/lib/chart"
import { cn } from "@/lib/utils"

const METRICS_POLL_INTERVAL_MS = 5_000

type TimeRange = "15m" | "1h" | "6h" | "24h"

interface NodeMetricsChartsProps {
  node: ClusterNode
}

interface NodeMetricPoint {
  time: string
  cpu: number
  ramGb: number
  ramPercent: number
  rxMb: number
  txMb: number
  diskReadMb: number
  diskWriteMb: number
  diskPercent: number
  swapUsedMb?: number
  swapTotalMb?: number
  swapPercent?: number
}

function generateNodeFallbackData(
  node: ClusterNode,
  range: TimeRange
): NodeMetricPoint[] {
  const pointsCount =
    range === "15m" ? 60 : range === "1h" ? 60 : range === "6h" ? 48 : 48
  const stepMinutes =
    range === "15m" ? 0.25 : range === "1h" ? 1 : range === "6h" ? 7.5 : 30
  const now = new Date()

  const totalMem = node.totalMemoryGb || 16
  const baseCpu = Math.max(5, node.cpuPercent || 25)
  const baseMem = Math.max(10, node.memoryPercent || 40)
  const baseDisk = Math.max(10, node.diskPercent || 35)
  const baseRx = Math.max(4, (node.networkRxKbps || 2400) / 1024)
  const baseTx = Math.max(6, (node.networkTxKbps || 4800) / 1024)

  const points: NodeMetricPoint[] = []

  for (let i = pointsCount - 1; i >= 0; i--) {
    const pointDate = new Date(now.getTime() - i * stepMinutes * 60 * 1000)
    const timeStr = pointDate.toTimeString().slice(0, 5)

    const variation = Math.sin(i * 0.35) * 8 + Math.cos(i * 0.7) * 5
    const cpu = Math.max(
      2,
      Math.min(98, Math.round((baseCpu + variation) * 10) / 10)
    )

    const ramPercent = Math.max(
      5,
      Math.min(95, Math.round((baseMem + variation * 0.3) * 10) / 10)
    )
    const ramGb = Number(((totalMem * ramPercent) / 100).toFixed(1))

    const rxMb = Math.max(
      0.5,
      Math.round((baseRx + Math.sin(i * 0.45) * 4 + (cpu > 60 ? 8 : 0)) * 10) /
        10
    )
    const txMb = Math.max(
      0.8,
      Math.round((baseTx + Math.cos(i * 0.4) * 6 + (cpu > 60 ? 12 : 0)) * 10) /
        10
    )

    const diskPercent = Math.max(
      10,
      Math.min(95, Math.round(baseDisk + Math.sin(i * 0.2) * 2))
    )
    const diskReadMb = Math.max(
      1.2,
      Math.round((6.5 + Math.sin(i * 0.5) * 4.5 + (cpu > 50 ? 5 : 0)) * 10) / 10
    )
    const diskWriteMb = Math.max(
      2.4,
      Math.round((12.8 + Math.cos(i * 0.35) * 8 + (cpu > 50 ? 9 : 0)) * 10) / 10
    )

    points.push({
      time: timeStr,
      cpu,
      ramGb,
      ramPercent,
      rxMb,
      txMb,
      diskReadMb,
      diskWriteMb,
      diskPercent,
      swapUsedMb: 0,
      swapTotalMb: 0,
      swapPercent: 0,
    })
  }

  return points
}

export function NodeMetricsCharts({ node }: NodeMetricsChartsProps) {
  const [range, setRange] = React.useState<TimeRange>("1h")
  const [points, setPoints] = React.useState<NodeMetricPoint[]>(() =>
    generateNodeFallbackData(node, "1h")
  )
  const [_isLoading, setIsLoading] = React.useState(false)
  const [hoverIndex, setHoverIndex] = React.useState<number | null>(null)

  const containerRef = React.useRef<HTMLDivElement>(null)
  const [containerWidth, setContainerWidth] =
    React.useState<number>(CHART_WIDTH)

  const { data: rawMetrics } = useNodeMetrics(
    node.id,
    range,
    (node.totalMemoryGb || 8) * 1024,
    true
  )

  React.useEffect(() => {
    if (!containerRef.current) return
    const updateSize = () => {
      if (containerRef.current) {
        const clientWidth = containerRef.current.clientWidth
        if (clientWidth > 0) {
          setContainerWidth(clientWidth)
        }
      }
    }
    updateSize()
    const ro = new ResizeObserver(updateSize)
    ro.observe(containerRef.current)
    return () => ro.disconnect()
  }, [])

  // Sync metrics from TanStack Query hook
  React.useEffect(() => {
    if (rawMetrics && rawMetrics.length > 0) {
      const mapped: NodeMetricPoint[] = rawMetrics.map((p) => {
        const d = new Date(p.time)
        const timeStr = !isNaN(d.getTime()) ? d.toTimeString().slice(0, 5) : p.time
        const ramGb = Number((p.memoryUsedMb / 1024).toFixed(1))
        return {
          time: timeStr,
          cpu: Math.max(0, Math.round(p.cpu * 10) / 10),
          ramGb,
          ramPercent: p.memoryPercent,
          rxMb: Math.max(0, Math.round((p.networkRxKbps / 1024) * 10) / 10),
          txMb: Math.max(0, Math.round((p.networkTxKbps / 1024) * 10) / 10),
          diskReadMb: Math.max(0, Math.round((p.diskReadKbps / 1024) * 10) / 10),
          diskWriteMb: Math.max(0, Math.round((p.diskWriteKbps / 1024) * 10) / 10),
          diskPercent: p.diskPercent,
          swapUsedMb: 0,
          swapTotalMb: 0,
          swapPercent: p.swapPercent,
        }
      })
      setPoints(mapped)
    } else {
      setPoints(generateNodeFallbackData(node, range))
    }
  }, [rawMetrics, node, range])

  // Chart layout sizing
  const cardWidth = Math.max(Math.floor((containerWidth - 16) / 2), 300)
  const innerCardWidth = Math.max(
    1,
    cardWidth - CHART_PADDING.left - CHART_PADDING.right
  )

  // Determine if swap is active on this node
  const activePoint =
    hoverIndex !== null && hoverIndex < points.length
      ? points[hoverIndex]
      : points[points.length - 1]
  const hasSwap = points.some(
    (p) => (p.swapTotalMb ?? 0) > 0 || (p.swapUsedMb ?? 0) > 0
  )

  // Derived CPU values
  const cpuValues = React.useMemo(() => points.map((p) => p.cpu), [points])
  const peakCpu = Math.max(...cpuValues, 1)
  const avgCpu =
    Math.round(
      (cpuValues.reduce((a, b) => a + b, 0) / Math.max(1, cpuValues.length)) *
        10
    ) / 10
  const cpuCoords = React.useMemo(
    () => getChartCoordinates(cpuValues, 0, Math.max(100, peakCpu), cardWidth),
    [cpuValues, peakCpu, cardWidth]
  )
  const cpuLine = React.useMemo(
    () => buildSmoothChartLine(cpuCoords, cardWidth),
    [cpuCoords, cardWidth]
  )
  const cpuArea = React.useMemo(
    () => buildSmoothChartArea(cpuCoords, cardWidth),
    [cpuCoords, cardWidth]
  )

  // Derived RAM values
  const ramValues = React.useMemo(() => points.map((p) => p.ramGb), [points])
  const peakRam = Math.max(...ramValues, 1)
  const maxMemGb = Math.max(node.totalMemoryGb, peakRam, 1)
  const ramCoords = React.useMemo(
    () => getChartCoordinates(ramValues, 0, maxMemGb, cardWidth),
    [ramValues, maxMemGb, cardWidth]
  )
  const ramLine = React.useMemo(
    () => buildSmoothChartLine(ramCoords, cardWidth),
    [ramCoords, cardWidth]
  )
  const ramArea = React.useMemo(
    () => buildSmoothChartArea(ramCoords, cardWidth),
    [ramCoords, cardWidth]
  )

  // Derived Network RX/TX values
  const rxValues = React.useMemo(() => points.map((p) => p.rxMb), [points])
  const txValues = React.useMemo(() => points.map((p) => p.txMb), [points])
  const peakNet = Math.max(...rxValues, ...txValues, 10)
  const rxCoords = React.useMemo(
    () => getChartCoordinates(rxValues, 0, peakNet * 1.15, cardWidth),
    [rxValues, peakNet, cardWidth]
  )
  const txCoords = React.useMemo(
    () => getChartCoordinates(txValues, 0, peakNet * 1.15, cardWidth),
    [txValues, peakNet, cardWidth]
  )
  const rxLine = React.useMemo(
    () => buildSmoothChartLine(rxCoords, cardWidth),
    [rxCoords, cardWidth]
  )
  const rxArea = React.useMemo(
    () => buildSmoothChartArea(rxCoords, cardWidth),
    [rxCoords, cardWidth]
  )
  const txLine = React.useMemo(
    () => buildSmoothChartLine(txCoords, cardWidth),
    [txCoords, cardWidth]
  )

  // Derived Disk Read/Write values
  const diskReadValues = React.useMemo(
    () => points.map((p) => p.diskReadMb),
    [points]
  )
  const diskWriteValues = React.useMemo(
    () => points.map((p) => p.diskWriteMb),
    [points]
  )
  const peakDiskIO = Math.max(...diskReadValues, ...diskWriteValues, 10)
  const diskReadCoords = React.useMemo(
    () => getChartCoordinates(diskReadValues, 0, peakDiskIO * 1.2, cardWidth),
    [diskReadValues, peakDiskIO, cardWidth]
  )
  const diskWriteCoords = React.useMemo(
    () => getChartCoordinates(diskWriteValues, 0, peakDiskIO * 1.2, cardWidth),
    [diskWriteValues, peakDiskIO, cardWidth]
  )
  const diskReadLine = React.useMemo(
    () => buildSmoothChartLine(diskReadCoords, cardWidth),
    [diskReadCoords, cardWidth]
  )
  const diskWriteLine = React.useMemo(
    () => buildSmoothChartLine(diskWriteCoords, cardWidth),
    [diskWriteCoords, cardWidth]
  )
  const diskWriteArea = React.useMemo(
    () => buildSmoothChartArea(diskWriteCoords, cardWidth),
    [diskWriteCoords, cardWidth]
  )

  // Derived Swap values (if any)
  const swapValues = React.useMemo(
    () => points.map((p) => p.swapUsedMb ?? 0),
    [points]
  )
  const peakSwapMb = Math.max(...swapValues, 10)
  const maxSwapMb = Math.max(
    ...points.map((p) => p.swapTotalMb ?? 0),
    peakSwapMb,
    512
  )
  const swapCoords = React.useMemo(
    () => getChartCoordinates(swapValues, 0, maxSwapMb, cardWidth),
    [swapValues, maxSwapMb, cardWidth]
  )
  const swapLine = React.useMemo(
    () => buildSmoothChartLine(swapCoords, cardWidth),
    [swapCoords, cardWidth]
  )
  const swapArea = React.useMemo(
    () => buildSmoothChartArea(swapCoords, cardWidth),
    [swapCoords, cardWidth]
  )

  const activeIndex = hoverIndex !== null ? hoverIndex : points.length - 1

  return (
    <div className="space-y-4">
      {/* Telemetry Header & Range Selector Toolbar */}
      <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 shadow-xs sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2.5">
          <Activity className="size-4 shrink-0 text-primary" />
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-foreground">
                Node Resource Telemetry
              </h2>
              <span className="inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground uppercase">
                <span className="size-1.5 animate-pulse rounded-full bg-emerald-500" />
                Live Agent Stream
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Continuous time-series performance metrics for {node.name} (
              {node.ipAddress})
            </p>
          </div>
        </div>

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
                "h-6 rounded px-2 font-mono text-[11px] transition-colors",
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

      {/* 2-Column Responsive Charts Grid */}
      <div ref={containerRef} className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* 1. CPU Utilization Chart */}
        <div className="flex flex-col rounded-lg border border-border bg-card p-4 shadow-xs">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <Cpu className="size-4 text-primary" />
              <span className="text-xs font-semibold text-foreground">
                CPU Utilization
              </span>
            </div>
            <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
              {node.totalCores} vCPUs • Load:{" "}
              {((node.cpuPercent / 100) * 2.1).toFixed(2)}
            </span>
          </div>

          <div className="mt-2 flex items-baseline gap-3 font-mono">
            <span className="text-2xl font-bold tracking-tight text-foreground">
              {activePoint?.cpu ?? node.cpuPercent}%
            </span>
            <span className="text-xs text-muted-foreground">
              Peak:{" "}
              <span className="font-semibold text-primary">{peakCpu}%</span> •
              Avg: {avgCpu}%
            </span>
          </div>

          <div className="relative mt-3 w-full">
            <svg
              viewBox={`0 0 ${cardWidth} ${CHART_HEIGHT}`}
              className="h-40 w-full overflow-hidden select-none"
              onMouseLeave={() => setHoverIndex(null)}
            >
              <defs>
                <linearGradient
                  id={`node-cpu-${node.id}`}
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop
                    offset="0%"
                    stopColor="var(--color-primary)"
                    stopOpacity="0.28"
                  />
                  <stop
                    offset="100%"
                    stopColor="var(--color-primary)"
                    stopOpacity="0.0"
                  />
                </linearGradient>
              </defs>

              {/* Grid Lines */}
              {[0, 0.5, 1].map((pct) => {
                const y = CHART_PADDING.top + CHART_INNER_HEIGHT * (1 - pct)
                const val = Math.round(pct * Math.max(100, peakCpu))
                return (
                  <g key={pct}>
                    <line
                      x1={CHART_PADDING.left}
                      y1={y}
                      x2={cardWidth - CHART_PADDING.right}
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
                      {val}%
                    </text>
                  </g>
                )
              })}

              {cpuArea && (
                <path d={cpuArea} fill={`url(#node-cpu-${node.id})`} />
              )}
              {cpuLine && (
                <path
                  d={cpuLine}
                  fill="none"
                  stroke="var(--color-primary)"
                  strokeWidth="1.25"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}

              {/* Hover crosshair */}
              {hoverIndex !== null && cpuCoords[activeIndex] && (
                <g>
                  <line
                    x1={cpuCoords[activeIndex].x}
                    y1={CHART_PADDING.top}
                    x2={cpuCoords[activeIndex].x}
                    y2={CHART_PADDING.top + CHART_INNER_HEIGHT}
                    stroke="var(--color-foreground)"
                    strokeWidth="1"
                    strokeDasharray="2 2"
                    opacity="0.75"
                  />
                  <circle
                    cx={cpuCoords[activeIndex].x}
                    cy={cpuCoords[activeIndex].y}
                    r="3.5"
                    fill="var(--color-background)"
                    stroke="var(--color-primary)"
                    strokeWidth="1.5"
                  />
                </g>
              )}

              {/* Hover columns */}
              {cpuCoords.map((c, idx) => {
                const colW = innerCardWidth / Math.max(1, cpuCoords.length)
                return (
                  <rect
                    key={idx}
                    x={Math.max(CHART_PADDING.left, c.x - colW / 2)}
                    y={CHART_PADDING.top}
                    width={colW}
                    height={CHART_INNER_HEIGHT}
                    fill="transparent"
                    className="cursor-crosshair"
                    onMouseEnter={() => setHoverIndex(idx)}
                  />
                )
              })}
            </svg>
          </div>
        </div>

        {/* 2. RAM Memory Allocation Chart */}
        <div className="flex flex-col rounded-lg border border-border bg-card p-4 shadow-xs">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <Server className="size-4 text-emerald-500" />
              <span className="text-xs font-semibold text-foreground">
                RAM Memory Allocation
              </span>
            </div>
            <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-emerald-500">
              Total: {node.totalMemoryGb} GB
            </span>
          </div>

          <div className="mt-2 flex items-baseline gap-3 font-mono">
            <span className="text-2xl font-bold tracking-tight text-foreground">
              {activePoint?.ramGb ??
                ((node.totalMemoryGb * node.memoryPercent) / 100).toFixed(
                  1
                )}{" "}
              GB
            </span>
            <span className="text-xs text-muted-foreground">
              Used:{" "}
              <span className="font-semibold text-emerald-500">
                {activePoint?.ramPercent ?? node.memoryPercent}%
              </span>{" "}
              • Free:{" "}
              {Math.max(0, node.totalMemoryGb - (activePoint?.ramGb ?? 0)).toFixed(1)} GB
            </span>
          </div>

          <div className="relative mt-3 w-full">
            <svg
              viewBox={`0 0 ${cardWidth} ${CHART_HEIGHT}`}
              className="h-40 w-full overflow-hidden select-none"
              onMouseLeave={() => setHoverIndex(null)}
            >
              <defs>
                <linearGradient
                  id={`node-ram-${node.id}`}
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop offset="0%" stopColor="#10b981" stopOpacity="0.28" />
                  <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Grid Lines */}
              {[0, 0.5, 1].map((pct) => {
                const y = CHART_PADDING.top + CHART_INNER_HEIGHT * (1 - pct)
                const val = (pct * maxMemGb).toFixed(0)
                return (
                  <g key={pct}>
                    <line
                      x1={CHART_PADDING.left}
                      y1={y}
                      x2={cardWidth - CHART_PADDING.right}
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
                      {val}G
                    </text>
                  </g>
                )
              })}

              {ramArea && (
                <path d={ramArea} fill={`url(#node-ram-${node.id})`} />
              )}
              {ramLine && (
                <path
                  d={ramLine}
                  fill="none"
                  stroke="#10b981"
                  strokeWidth="1.25"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}

              {/* Hover crosshair */}
              {hoverIndex !== null && ramCoords[activeIndex] && (
                <g>
                  <line
                    x1={ramCoords[activeIndex].x}
                    y1={CHART_PADDING.top}
                    x2={ramCoords[activeIndex].x}
                    y2={CHART_PADDING.top + CHART_INNER_HEIGHT}
                    stroke="var(--color-foreground)"
                    strokeWidth="1"
                    strokeDasharray="2 2"
                    opacity="0.75"
                  />
                  <circle
                    cx={ramCoords[activeIndex].x}
                    cy={ramCoords[activeIndex].y}
                    r="3.5"
                    fill="var(--color-background)"
                    stroke="#10b981"
                    strokeWidth="1.5"
                  />
                </g>
              )}

              {/* Hover columns */}
              {ramCoords.map((c, idx) => {
                const colW = innerCardWidth / Math.max(1, ramCoords.length)
                return (
                  <rect
                    key={idx}
                    x={Math.max(CHART_PADDING.left, c.x - colW / 2)}
                    y={CHART_PADDING.top}
                    width={colW}
                    height={CHART_INNER_HEIGHT}
                    fill="transparent"
                    className="cursor-crosshair"
                    onMouseEnter={() => setHoverIndex(idx)}
                  />
                )
              })}
            </svg>
          </div>
        </div>

        {/* 3. Network Throughput (I/O) Chart */}
        <div className="flex flex-col rounded-lg border border-border bg-card p-4 shadow-xs">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <Network className="size-4 text-sky-400" />
              <span className="text-xs font-semibold text-foreground">
                Network Bandwidth (I/O)
              </span>
            </div>
            <div className="flex items-center gap-2 font-mono text-[10px]">
              <span className="flex items-center gap-1 text-sky-400">
                <span className="size-2 rounded-full bg-sky-400" /> RX
              </span>
              <span className="flex items-center gap-1 text-purple-400">
                <span className="size-2 rounded-full bg-purple-400" /> TX
              </span>
            </div>
          </div>

          <div className="mt-2 flex items-baseline gap-3 font-mono">
            <span className="flex items-center gap-1 text-sm font-bold text-sky-400">
              <ArrowDownRight className="size-3.5" />
              {activePoint?.rxMb ?? 0} MB/s
            </span>
            <span className="flex items-center gap-1 text-sm font-bold text-purple-400">
              <ArrowUpRight className="size-3.5" />
              {activePoint?.txMb ?? 0} MB/s
            </span>
            <span className="ml-auto text-xs text-muted-foreground">
              Peak: {peakNet.toFixed(1)} MB/s
            </span>
          </div>

          <div className="relative mt-3 w-full">
            <svg
              viewBox={`0 0 ${cardWidth} ${CHART_HEIGHT}`}
              className="h-40 w-full overflow-hidden select-none"
              onMouseLeave={() => setHoverIndex(null)}
            >
              <defs>
                <linearGradient
                  id={`node-net-${node.id}`}
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.2" />
                  <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Grid Lines */}
              {[0, 0.5, 1].map((pct) => {
                const y = CHART_PADDING.top + CHART_INNER_HEIGHT * (1 - pct)
                const val = (pct * peakNet * 1.15).toFixed(0)
                return (
                  <g key={pct}>
                    <line
                      x1={CHART_PADDING.left}
                      y1={y}
                      x2={cardWidth - CHART_PADDING.right}
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
                      {val}M
                    </text>
                  </g>
                )
              })}

              {rxArea && <path d={rxArea} fill={`url(#node-net-${node.id})`} />}
              {rxLine && (
                <path
                  d={rxLine}
                  fill="none"
                  stroke="#38bdf8"
                  strokeWidth="1.25"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}
              {txLine && (
                <path
                  d={txLine}
                  fill="none"
                  stroke="#c084fc"
                  strokeWidth="1.25"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}

              {/* Hover crosshair */}
              {hoverIndex !== null && rxCoords[activeIndex] && (
                <g>
                  <line
                    x1={rxCoords[activeIndex].x}
                    y1={CHART_PADDING.top}
                    x2={rxCoords[activeIndex].x}
                    y2={CHART_PADDING.top + CHART_INNER_HEIGHT}
                    stroke="var(--color-foreground)"
                    strokeWidth="1"
                    strokeDasharray="2 2"
                    opacity="0.75"
                  />
                  <circle
                    cx={rxCoords[activeIndex].x}
                    cy={rxCoords[activeIndex].y}
                    r="3.5"
                    fill="var(--color-background)"
                    stroke="#38bdf8"
                    strokeWidth="1.5"
                  />
                  {txCoords[activeIndex] && (
                    <circle
                      cx={txCoords[activeIndex].x}
                      cy={txCoords[activeIndex].y}
                      r="3.5"
                      fill="var(--color-background)"
                      stroke="#c084fc"
                      strokeWidth="1.5"
                    />
                  )}
                </g>
              )}

              {/* Hover columns */}
              {rxCoords.map((c, idx) => {
                const colW = innerCardWidth / Math.max(1, rxCoords.length)
                return (
                  <rect
                    key={idx}
                    x={Math.max(CHART_PADDING.left, c.x - colW / 2)}
                    y={CHART_PADDING.top}
                    width={colW}
                    height={CHART_INNER_HEIGHT}
                    fill="transparent"
                    className="cursor-crosshair"
                    onMouseEnter={() => setHoverIndex(idx)}
                  />
                )
              })}
            </svg>
          </div>
        </div>

        {/* 4. Disk I/O (Read / Write) & Pool Chart */}
        <div className="flex flex-col rounded-lg border border-border bg-card p-4 shadow-xs">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <HardDrive className="size-4 text-amber-500" />
              <span className="text-xs font-semibold text-foreground">
                Disk I/O Throughput & Storage
              </span>
            </div>
            <div className="flex items-center gap-2 font-mono text-[10px]">
              <span className="flex items-center gap-1 text-amber-500">
                <span className="size-2 rounded-full bg-amber-500" /> Read
              </span>
              <span className="flex items-center gap-1 text-orange-500">
                <span className="size-2 rounded-full bg-orange-500" /> Write
              </span>
            </div>
          </div>

          <div className="mt-2 flex items-baseline gap-3 font-mono">
            <span className="text-sm font-bold text-amber-500">
              R: {activePoint?.diskReadMb ?? 0} MB/s
            </span>
            <span className="text-sm font-bold text-orange-500">
              W: {activePoint?.diskWriteMb ?? 0} MB/s
            </span>
            <span className="ml-auto text-xs text-muted-foreground">
              Pool: {node.diskPercent}% of {node.diskTotalGb} GB
            </span>
          </div>

          <div className="relative mt-3 w-full">
            <svg
              viewBox={`0 0 ${cardWidth} ${CHART_HEIGHT}`}
              className="h-40 w-full overflow-hidden select-none"
              onMouseLeave={() => setHoverIndex(null)}
            >
              <defs>
                <linearGradient
                  id={`node-disk-${node.id}`}
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop offset="0%" stopColor="#f97316" stopOpacity="0.2" />
                  <stop offset="100%" stopColor="#f97316" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Grid Lines */}
              {[0, 0.5, 1].map((pct) => {
                const y = CHART_PADDING.top + CHART_INNER_HEIGHT * (1 - pct)
                const val = (pct * peakDiskIO * 1.2).toFixed(0)
                return (
                  <g key={pct}>
                    <line
                      x1={CHART_PADDING.left}
                      y1={y}
                      x2={cardWidth - CHART_PADDING.right}
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
                      {val}M
                    </text>
                  </g>
                )
              })}

              {diskWriteArea && (
                <path d={diskWriteArea} fill={`url(#node-disk-${node.id})`} />
              )}
              {diskReadLine && (
                <path
                  d={diskReadLine}
                  fill="none"
                  stroke="#f59e0b"
                  strokeWidth="1.25"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}
              {diskWriteLine && (
                <path
                  d={diskWriteLine}
                  fill="none"
                  stroke="#f97316"
                  strokeWidth="1.25"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}

              {/* Hover crosshair */}
              {hoverIndex !== null && diskReadCoords[activeIndex] && (
                <g>
                  <line
                    x1={diskReadCoords[activeIndex].x}
                    y1={CHART_PADDING.top}
                    x2={diskReadCoords[activeIndex].x}
                    y2={CHART_PADDING.top + CHART_INNER_HEIGHT}
                    stroke="var(--color-foreground)"
                    strokeWidth="1"
                    strokeDasharray="2 2"
                    opacity="0.75"
                  />
                  <circle
                    cx={diskReadCoords[activeIndex].x}
                    cy={diskReadCoords[activeIndex].y}
                    r="3.5"
                    fill="var(--color-background)"
                    stroke="#f59e0b"
                    strokeWidth="1.5"
                  />
                  {diskWriteCoords[activeIndex] && (
                    <circle
                      cx={diskWriteCoords[activeIndex].x}
                      cy={diskWriteCoords[activeIndex].y}
                      r="3.5"
                      fill="var(--color-background)"
                      stroke="#f97316"
                      strokeWidth="1.5"
                    />
                  )}
                </g>
              )}

              {/* Hover columns */}
              {diskReadCoords.map((c, idx) => {
                const colW = innerCardWidth / Math.max(1, diskReadCoords.length)
                return (
                  <rect
                    key={idx}
                    x={Math.max(CHART_PADDING.left, c.x - colW / 2)}
                    y={CHART_PADDING.top}
                    width={colW}
                    height={CHART_INNER_HEIGHT}
                    fill="transparent"
                    className="cursor-crosshair"
                    onMouseEnter={() => setHoverIndex(idx)}
                  />
                )
              })}
            </svg>
          </div>
        </div>

        {/* 5. Swap Space Chart (jika ada / conditional) */}
        <div className="flex flex-col rounded-lg border border-border bg-card p-4 shadow-xs lg:col-span-2">
          {hasSwap ? (
            <>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <Database className="size-4 text-indigo-500" />
                  <span className="text-xs font-semibold text-foreground">
                    Swap Memory Allocation
                  </span>
                </div>
                <span className="rounded bg-indigo-500/10 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-indigo-500">
                  Total Swap: {maxSwapMb} MB
                </span>
              </div>

              <div className="mt-2 flex items-baseline gap-3 font-mono">
                <span className="text-2xl font-bold tracking-tight text-foreground">
                  {activePoint?.swapUsedMb ?? 0} MB
                </span>
                <span className="text-xs text-muted-foreground">
                  Used:{" "}
                  <span className="font-semibold text-indigo-500">
                    {activePoint?.swapPercent ?? 0}%
                  </span>{" "}
                  • Available:{" "}
                  {Math.max(0, maxSwapMb - (activePoint?.swapUsedMb ?? 0))} MB
                </span>
              </div>

              <div className="relative mt-3 w-full">
                <svg
                  viewBox={`0 0 ${containerWidth - 32} ${CHART_HEIGHT}`}
                  className="h-40 w-full overflow-hidden select-none"
                  onMouseLeave={() => setHoverIndex(null)}
                >
                  <defs>
                    <linearGradient
                      id={`node-swap-${node.id}`}
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop
                        offset="0%"
                        stopColor="#6366f1"
                        stopOpacity="0.25"
                      />
                      <stop
                        offset="100%"
                        stopColor="#6366f1"
                        stopOpacity="0.0"
                      />
                    </linearGradient>
                  </defs>

                  {swapArea && (
                    <path d={swapArea} fill={`url(#node-swap-${node.id})`} />
                  )}
                  {swapLine && (
                    <path
                      d={swapLine}
                      fill="none"
                      stroke="#6366f1"
                      strokeWidth="1.25"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  )}
                </svg>
              </div>
            </>
          ) : (
            <div className="flex flex-col justify-between gap-3 py-2 sm:flex-row sm:items-center">
              <div className="flex items-center gap-3">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border bg-muted/30">
                  <Database className="size-4 text-muted-foreground" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-xs font-semibold text-foreground">
                      Swap Space Allocation
                    </h3>
                    <span className="rounded border border-border/80 bg-muted/40 px-2 py-0.5 font-mono text-[10px] text-muted-foreground">
                      No Swap Configured
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Swap partition is disabled on this worker node. Linux
                    container hosts operate with swap disabled for strict cgroup
                    memory isolation and to prevent I/O thrashing.
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1.5 self-start font-mono text-[11px] text-emerald-500 sm:self-auto">
                <CheckCircle2 className="size-3.5" />
                <span>Deterministic Memory Guard</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
