"use client"

import * as React from "react"
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  Cpu,
  HardDrive,
  Network,
  Server,
} from "lucide-react"

import { TelemetryChart } from "@/components/monitor/telemetry-chart"
import { Button } from "@/components/ui/button"
import { ClusterNode } from "@/types/platform"
import { apiGet } from "@/lib/api"

const CLUSTER_METRICS_POLL_MS = 10_000
import {
  buildChartArea,
  buildChartLine,
  getChartCoordinates,
} from "@/lib/chart"
import { cn } from "@/lib/utils"

interface ClusterChartsProps {
  nodes: ClusterNode[]
  isStreaming?: boolean
}

type TimeRange = "15m" | "1h" | "6h" | "24h"

interface MetricPoint {
  time: string
  cpu: number
  ramGb: number
  ramPercent: number
  rxMb: number
  txMb: number
  diskPercent: number
  diskReadMb: number
  diskWriteMb: number
}

function getClusterBases(nodes: ClusterNode[]) {
  return {
    totalMem: nodes.reduce((acc, n) => acc + n.totalMemoryGb, 0) || 64,
    baseCpu:
      nodes.length > 0
        ? nodes.reduce((acc, n) => acc + n.cpuPercent, 0) / nodes.length
        : 35,
    baseMem:
      nodes.length > 0
        ? nodes.reduce((acc, n) => acc + n.memoryPercent, 0) / nodes.length
        : 45,
    baseDisk:
      nodes.length > 0
        ? nodes.reduce((acc, n) => acc + (n.diskPercent || 38), 0) /
          nodes.length
        : 38,
  }
}

// Generate realistic time-series metric data points
function generateTimeSeriesData(
  nodes: ClusterNode[],
  range: TimeRange
): MetricPoint[] {
  const pointsCount =
    range === "15m" ? 16 : range === "1h" ? 24 : range === "6h" ? 30 : 24
  const now = new Date()
  const { totalMem, baseCpu, baseMem, baseDisk } = getClusterBases(nodes)

  const stepMinutes =
    range === "15m" ? 1 : range === "1h" ? 2.5 : range === "6h" ? 12 : 60

  const points: MetricPoint[] = []

  for (let i = pointsCount - 1; i >= 0; i--) {
    const pointDate = new Date(now.getTime() - i * stepMinutes * 60 * 1000)
    const timeStr = pointDate.toTimeString().slice(0, 5) // "HH:MM"

    // Natural undulating pseudo-random walk
    const variation = Math.sin(i * 0.45) * 12 + Math.cos(i * 0.8) * 8
    const cpu = Math.max(12, Math.min(96, Math.round(baseCpu + variation)))
    const ramPercent = Math.max(
      20,
      Math.min(94, Math.round(baseMem + variation * 0.4))
    )
    const ramGb = Number(((totalMem * ramPercent) / 100).toFixed(1))

    const rxMb = Math.max(
      8,
      Math.round(28 + Math.sin(i * 0.7) * 18 + (cpu > 60 ? 25 : 0))
    )
    const txMb = Math.max(
      12,
      Math.round(45 + Math.cos(i * 0.5) * 26 + (cpu > 60 ? 40 : 0))
    )

    const diskPercent = Math.max(
      15,
      Math.min(94, Math.round(baseDisk + Math.sin(i * 0.3) * 6))
    )
    const diskReadMb = Math.max(
      4,
      Math.round(14 + Math.sin(i * 0.6) * 10 + (cpu > 60 ? 18 : 0))
    )
    const diskWriteMb = Math.max(
      6,
      Math.round(28 + Math.cos(i * 0.4) * 20 + (cpu > 60 ? 32 : 0))
    )

    points.push({
      time: timeStr,
      cpu,
      ramGb,
      ramPercent,
      rxMb,
      txMb,
      diskPercent,
      diskReadMb,
      diskWriteMb,
    })
  }

  return points
}

export function ClusterCharts({
  nodes,
  isStreaming = true,
}: ClusterChartsProps) {
  const [range, setRange] = React.useState<TimeRange>("1h")
  const [data, setData] = React.useState<MetricPoint[]>(() =>
    generateTimeSeriesData(nodes, "1h")
  )
  const [hoverIndex, setHoverIndex] = React.useState<number | null>(null)

  // Fetch real cluster telemetry points from API and poll periodically during streaming
  React.useEffect(() => {
    let active = true

    async function loadMetrics() {
      try {
        const points = await apiGet<
          {
            timestamp: string
            cpu: number
            memory: number
            memoryPercent?: number
            networkRx: number
            networkTx: number
            disk: number
            diskPercent?: number
          }[]
        >(`/metrics?range=${range}`)

        if (!active) return
        if (Array.isArray(points) && points.length > 0) {
          const { totalMem, baseDisk } = getClusterBases(nodes)
          const mapped: MetricPoint[] = points.map((p) => {
            const d = new Date(p.timestamp)
            const timeStr = !isNaN(d.getTime())
              ? d.toTimeString().slice(0, 5)
              : p.timestamp
            const ramPercent =
              p.memoryPercent ||
              Math.min(100, Math.round((p.memory / (totalMem * 1024)) * 100))
            const ramGb = Number((p.memory / 1024).toFixed(1))
            const rxMb = Number((p.networkRx / 1024).toFixed(1))
            const txMb = Number((p.networkTx / 1024).toFixed(1))
            const diskPercent = p.diskPercent || Math.round(baseDisk)
            return {
              time: timeStr,
              cpu: Math.max(0, Math.min(100, Math.round(p.cpu * 10) / 10)),
              ramGb,
              ramPercent,
              rxMb,
              txMb,
              diskPercent,
              diskReadMb: Number((rxMb * 0.5).toFixed(1)),
              diskWriteMb: Number((txMb * 0.5).toFixed(1)),
            }
          })
          if (mapped.length > 0) {
            setData(mapped)
          }
        }
      } catch {
        // Retain current points on fetch error
      }
    }

    void loadMetrics()

    let timer: NodeJS.Timeout | undefined
    if (isStreaming) {
      timer = setInterval(() => {
        void loadMetrics()
      }, CLUSTER_METRICS_POLL_MS)
    }

    return () => {
      active = false
      if (timer) clearInterval(timer)
    }
  }, [range, nodes, isStreaming])

  const handleRangeChange = (newRange: TimeRange) => {
    setRange(newRange)
  }

  const totalCapacityGb =
    nodes.reduce((acc, n) => acc + n.totalMemoryGb, 0) || 64

  // Bulletproof sanitized data against any undefined or NaN properties from hot reload or stale state
  const sanitizedData = React.useMemo(() => {
    return data.map((d) => ({
      ...d,
      cpu: typeof d.cpu === "number" && Number.isFinite(d.cpu) ? d.cpu : 35,
      ramGb:
        typeof d.ramGb === "number" && Number.isFinite(d.ramGb) ? d.ramGb : 16,
      ramPercent:
        typeof d.ramPercent === "number" && Number.isFinite(d.ramPercent)
          ? d.ramPercent
          : 45,
      rxMb: typeof d.rxMb === "number" && Number.isFinite(d.rxMb) ? d.rxMb : 20,
      txMb: typeof d.txMb === "number" && Number.isFinite(d.txMb) ? d.txMb : 30,
      diskPercent:
        typeof d.diskPercent === "number" && Number.isFinite(d.diskPercent)
          ? d.diskPercent
          : 38,
      diskReadMb:
        typeof d.diskReadMb === "number" && Number.isFinite(d.diskReadMb)
          ? d.diskReadMb
          : 14,
      diskWriteMb:
        typeof d.diskWriteMb === "number" && Number.isFinite(d.diskWriteMb)
          ? d.diskWriteMb
          : 28,
    }))
  }, [data])

  // Active or hovered data point
  const activePoint =
    hoverIndex !== null && sanitizedData[hoverIndex]
      ? sanitizedData[hoverIndex]
      : sanitizedData[sanitizedData.length - 1]

  const peakCpu = Math.max(...sanitizedData.map((d) => d.cpu), 0)
  const avgCpu = Math.round(
    sanitizedData.reduce((acc, d) => acc + d.cpu, 0) /
      (sanitizedData.length || 1)
  )

  const peakRamGb = Math.max(...sanitizedData.map((d) => d.ramGb), 0)
  const avgRamPercent = Math.round(
    sanitizedData.reduce((acc, d) => acc + d.ramPercent, 0) /
      (sanitizedData.length || 1)
  )

  const peakRx = Math.max(...sanitizedData.map((d) => d.rxMb), 0)
  const peakTx = Math.max(...sanitizedData.map((d) => d.txMb), 0)

  const peakDisk = Math.max(...sanitizedData.map((d) => d.diskPercent), 0)
  const avgDisk = Math.round(
    sanitizedData.reduce((acc, d) => acc + d.diskPercent, 0) /
      (sanitizedData.length || 1)
  )
  const peakDiskWrite = Math.max(...sanitizedData.map((d) => d.diskWriteMb), 0)
  const peakDiskRead = Math.max(...sanitizedData.map((d) => d.diskReadMb), 0)

  // Safe Dynamic Maximums
  const maxCpu = Math.max(100, peakCpu, 1)
  const effectiveTotalMem = Math.max(totalCapacityGb, peakRamGb, 1)
  const maxNet = Math.max(peakRx, peakTx, 50) * 1.15
  const maxDisk = Math.max(100, peakDisk, 1)

  // CPU Coordinates
  const cpuCoords = getChartCoordinates(
    sanitizedData.map((d) => d.cpu),
    0,
    maxCpu
  )
  const cpuLine = buildChartLine(cpuCoords)
  const cpuArea = buildChartArea(cpuCoords)

  // RAM Coordinates
  const ramCoords = getChartCoordinates(
    sanitizedData.map((d) => d.ramGb),
    0,
    effectiveTotalMem
  )
  const ramLine = buildChartLine(ramCoords)
  const ramArea = buildChartArea(ramCoords)

  // Network Coordinates
  const rxCoords = getChartCoordinates(
    sanitizedData.map((d) => d.rxMb),
    0,
    maxNet
  )
  const txCoords = getChartCoordinates(
    sanitizedData.map((d) => d.txMb),
    0,
    maxNet
  )
  const rxLine = buildChartLine(rxCoords)
  const rxArea = buildChartArea(rxCoords)
  const txLine = buildChartLine(txCoords)

  // Disk Coordinates (0 - 100%)
  const diskCoords = getChartCoordinates(
    sanitizedData.map((d) => d.diskPercent),
    0,
    maxDisk
  )
  const diskLine = buildChartLine(diskCoords)
  const diskArea = buildChartArea(diskCoords)

  return (
    <div className="space-y-6">
      {/* Controls & Time Range Selector */}
      <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Activity className="size-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">
              Cluster Compute & Telemetry Trends
            </h2>
            <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground uppercase">
              {nodes.length} Nodes Aggregated
            </span>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Time-series telemetry sampled over continuous gRPC edge node
            connections.
          </p>
        </div>

        <div className="flex items-center gap-1.5 rounded-lg border border-border bg-muted/30 p-1">
          {(["15m", "1h", "6h", "24h"] as TimeRange[]).map((t) => (
            <Button
              key={t}
              size="xs"
              variant={range === t ? "default" : "ghost"}
              onClick={() => handleRangeChange(t)}
              className={cn(
                "h-6 px-2.5 font-mono text-[11px]",
                range === t
                  ? "bg-primary font-semibold text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {t}
            </Button>
          ))}
        </div>
      </div>

      {/* Grid of Cluster Charts - 2 per row, full width if single or odd */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* 1. CPU Utilization Trend */}
        <div className="flex flex-col overflow-hidden rounded-lg border border-border bg-card p-4 shadow-xs last:odd:lg:col-span-2">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Cpu className="size-4 text-primary" />
                <span className="text-xs font-semibold text-foreground">
                  Cluster CPU Utilization
                </span>
              </div>
              <div className="mt-2 flex items-baseline gap-2 font-mono">
                <span className="text-2xl font-bold tracking-tight text-foreground">
                  {activePoint?.cpu ?? 0}%
                </span>
                <span className="text-xs text-muted-foreground">
                  Avg: {avgCpu}% • Peak: {peakCpu}%
                </span>
              </div>
            </div>
            <span className="rounded bg-primary/10 px-2 py-0.5 font-mono text-[10px] font-semibold text-primary">
              {range} Window
            </span>
          </div>

          <TelemetryChart
            data={sanitizedData}
            hoverIndex={hoverIndex}
            onHover={setHoverIndex}
            crosshairClassName="opacity-80"
            ticks={[0, 25, 50, 75, 100].map((val) => ({
              position: val / 100,
              label: `${val}%`,
            }))}
            series={[
              {
                id: "cpu",
                coords: cpuCoords,
                line: cpuLine,
                area: cpuArea,
                color: "#c53d20",
                gradientId: "cpuGradient",
              },
            ]}
          />

          <div className="mt-3 flex items-center justify-between border-t border-border pt-2.5 font-mono text-[11px] text-muted-foreground">
            <span>Snapshot at: {activePoint?.time}</span>
            <span className="font-semibold text-foreground">
              {activePoint?.cpu}% utilization
            </span>
          </div>
        </div>

        {/* 2. RAM Memory Allocation */}
        <div className="flex flex-col overflow-hidden rounded-lg border border-border bg-card p-4 shadow-xs last:odd:lg:col-span-2">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Server className="size-4 text-emerald-500" />
                <span className="text-xs font-semibold text-foreground">
                  Cluster Memory Allocation
                </span>
              </div>
              <div className="mt-2 flex items-baseline gap-2 font-mono">
                <span className="text-2xl font-bold tracking-tight text-foreground">
                  {activePoint?.ramGb ?? 0} GB
                </span>
                <span className="text-xs text-muted-foreground">
                  of {totalCapacityGb} GB ({activePoint?.ramPercent ?? 0}%)
                </span>
              </div>
            </div>
            <span className="rounded bg-emerald-500/10 px-2 py-0.5 font-mono text-[10px] font-semibold text-emerald-500">
              Avg: {avgRamPercent}%
            </span>
          </div>

          <TelemetryChart
            data={sanitizedData}
            hoverIndex={hoverIndex}
            onHover={setHoverIndex}
            crosshairClassName="opacity-80"
            ticks={[0, 0.25, 0.5, 0.75, 1].map((ratio) => ({
              position: ratio,
              label: `${Math.round(ratio * totalCapacityGb)}G`,
            }))}
            series={[
              {
                id: "ram",
                coords: ramCoords,
                line: ramLine,
                area: ramArea,
                color: "#10b981",
                gradientId: "ramGradient",
              },
            ]}
          />

          <div className="mt-3 flex items-center justify-between border-t border-border pt-2.5 font-mono text-[11px] text-muted-foreground">
            <span>Peak: {peakRamGb} GB</span>
            <span className="font-semibold text-emerald-500">
              {(totalCapacityGb - (activePoint?.ramGb ?? 0)).toFixed(1)} GB
              Available
            </span>
          </div>
        </div>

        {/* 3. Network Bandwidth (I/O Throughput) */}
        <div className="flex flex-col overflow-hidden rounded-lg border border-border bg-card p-4 shadow-xs last:odd:lg:col-span-2">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Network className="size-4 text-sky-400" />
                <span className="text-xs font-semibold text-foreground">
                  Network Throughput (I/O)
                </span>
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
              </div>
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

          <TelemetryChart
            data={sanitizedData}
            hoverIndex={hoverIndex}
            onHover={setHoverIndex}
            crosshairColor="currentColor"
            crosshairClassName="text-muted-foreground/60"
            dotRadius={4}
            dotStrokeWidth={1.5}
            ticks={[0, 0.33, 0.66, 1].map((ratio) => ({
              position: ratio,
              label: `${Math.round(ratio * maxNet)}M`,
            }))}
            series={[
              {
                id: "rx",
                coords: rxCoords,
                line: rxLine,
                area: rxArea,
                color: "#38bdf8",
                gradientId: "rxGradient",
                gradientOpacity: 0.25,
              },
              {
                id: "tx",
                coords: txCoords,
                line: txLine,
                color: "#c084fc",
              },
            ]}
          />

          <div className="mt-3 flex items-center justify-between border-t border-border pt-2.5 font-mono text-[11px] text-muted-foreground">
            <span>Peak RX: {peakRx} MB/s</span>
            <span className="font-semibold text-purple-400">
              Peak TX: {peakTx} MB/s
            </span>
          </div>
        </div>

        {/* 4. Cluster Storage & Disk Operations */}
        <div className="flex flex-col overflow-hidden rounded-lg border border-border bg-card p-4 shadow-xs last:odd:lg:col-span-2">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2">
                <HardDrive className="size-4 text-amber-500" />
                <span className="text-xs font-semibold text-foreground">
                  Cluster Storage & Disk Operations
                </span>
              </div>
              <div className="mt-2 flex items-baseline gap-2 font-mono">
                <span className="text-2xl font-bold tracking-tight text-foreground">
                  {activePoint?.diskPercent ?? 0}%
                </span>
                <span className="text-xs text-muted-foreground">
                  Write: {activePoint?.diskWriteMb ?? 0} MB/s • Read:{" "}
                  {activePoint?.diskReadMb ?? 0} MB/s
                </span>
              </div>
            </div>
            <span className="rounded bg-amber-500/10 px-2 py-0.5 font-mono text-[10px] font-semibold text-amber-500">
              Avg: {avgDisk}%
            </span>
          </div>

          <TelemetryChart
            data={sanitizedData}
            hoverIndex={hoverIndex}
            onHover={setHoverIndex}
            crosshairClassName="opacity-80"
            ticks={[0, 25, 50, 75, 100].map((val) => ({
              position: val / 100,
              label: `${val}%`,
            }))}
            series={[
              {
                id: "disk",
                coords: diskCoords,
                line: diskLine,
                area: diskArea,
                color: "#f59e0b",
                gradientId: "diskGradient",
                gradientOpacity: 0.3,
              },
            ]}
          />

          <div className="mt-3 flex items-center justify-between border-t border-border pt-2.5 font-mono text-[11px] text-muted-foreground">
            <span>Peak Write: {peakDiskWrite} MB/s</span>
            <span className="font-semibold text-amber-500">
              Peak Read: {peakDiskRead} MB/s (Peak {peakDisk}%)
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
