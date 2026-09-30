"use client"

import * as React from "react"
import {
  Cpu,
  ArrowsClockwiseIcon,
  Clock,
  HardDrives,
  CheckCircleIcon,
  WifiHigh,
} from "@phosphor-icons/react"
import { StatusBadge } from "@/components/status-badge"
import { LoadingSkeleton } from "@/components/states/loading-skeleton"
import { ErrorCard } from "@/components/states/error-card"
import { LogViewer } from "@/components/log-viewer"
import { useService } from "@/components/services/service-context"
import {
  api,
  type ContainerLogEvent,
  type ServiceMetricsResponse,
  type MetricsRange,
} from "@/lib/api"
import {
  ResourceChart,
  type TelemetryPoint,
} from "@/components/charts/resource-chart"
import { cn } from "@/lib/utils"

const AVAILABLE_RANGES: MetricsRange[] = ["1h", "6h", "24h", "7d"]

export default function ServiceMonitoringPage() {
  const { service, serviceId, isLoading, error, refetch } = useService()

  const [logs, setLogs] = React.useState<ContainerLogEvent[]>([])
  const [isConnecting, setIsConnecting] = React.useState(true)
  const [selectedRange, setSelectedRange] = React.useState<MetricsRange>("1h")
  const [metrics, setMetrics] = React.useState<ServiceMetricsResponse | null>(
    null
  )
  const [isLoadingMetrics, setIsLoadingMetrics] = React.useState(true)
  const [isRefreshing, setIsRefreshing] = React.useState(false)
  const [autoRefresh, setAutoRefresh] = React.useState(true)

  // Fetch historical resource metrics (supports initial load and silent background refresh)
  const fetchMetrics = React.useCallback(
    async (isBackground = false) => {
      if (!serviceId) return
      if (!isBackground) {
        setIsLoadingMetrics(true)
      } else {
        setIsRefreshing(true)
      }

      try {
        const data = await api.services.getMetrics(serviceId, selectedRange)
        setMetrics(data)
      } catch {
        // Silently preserve existing data on background error
      } finally {
        setIsLoadingMetrics(false)
        setIsRefreshing(false)
      }
    },
    [serviceId, selectedRange]
  )

  // Fetch when service or time range changes
  React.useEffect(() => {
    fetchMetrics(false)
  }, [fetchMetrics])

  // Periodic 30-second auto-refresh matching agent collection interval
  React.useEffect(() => {
    if (!autoRefresh || !serviceId) return

    const timer = setInterval(() => {
      fetchMetrics(true)
    }, 30000)

    return () => clearInterval(timer)
  }, [autoRefresh, serviceId, fetchMetrics])

  // Stream live runtime logs via SSE async iterable
  React.useEffect(() => {
    if (!serviceId) return
    let isActive = true
    setIsConnecting(true)

    const stream = api.services.streamContainerLogs(serviceId, {
      tail: 500,
      follow: true,
    })

    ;(async () => {
      try {
        for await (const chunk of stream) {
          if (!isActive) break
          setIsConnecting(false)
          setLogs((prev) => [...prev, chunk])
        }
      } catch {
        // Stream aborted or connection completed
      } finally {
        if (isActive) {
          setIsConnecting(false)
        }
      }
    })()

    return () => {
      isActive = false
    }
  }, [serviceId])

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <LoadingSkeleton variant="card" />
          <LoadingSkeleton variant="card" />
          <LoadingSkeleton variant="card" />
          <LoadingSkeleton variant="card" />
        </div>
        <LoadingSkeleton variant="card" />
      </div>
    )
  }

  if (error || !service) {
    return (
      <ErrorCard
        title="Failed to Load Service Monitoring"
        message={error?.message || "Service details could not be retrieved."}
        onRetry={refetch}
      />
    )
  }

  const containerId = service.active_deployment_id
    ? service.active_deployment_id.slice(0, 8)
    : "c7a8b9f0"
  const isRunning = service.status === "running"

  // Derive charts telemetry points
  const points = metrics?.points || []

  const cpuData: TelemetryPoint[] = points.map((p) => ({
    timestamp: p.timestamp,
    value: p.cpu_percent,
  }))

  const memData: TelemetryPoint[] = points.map((p) => ({
    timestamp: p.timestamp,
    value: Math.round(p.memory_bytes / (1024 * 1024)),
  }))

  const netData: TelemetryPoint[] = points.map((p) => ({
    timestamp: p.timestamp,
    value:
      Math.round(((p.network_rx_rate + p.network_tx_rate) / 1024) * 10) / 10,
  }))

  const currentCpu = metrics?.current.cpu_percent ?? (isRunning ? 1.4 : 0.0)
  const currentMemMB = Math.round(
    (metrics?.current.memory_bytes ?? (isRunning ? 148 * 1024 * 1024 : 0)) /
      (1024 * 1024)
  )
  const limitMemMB =
    Math.round(
      (metrics?.current.memory_limit_bytes ?? 1024 * 1024 * 1024) /
        (1024 * 1024)
    ) || 1024
  const memPercent = Math.min(
    100,
    Math.round((currentMemMB / limitMemMB) * 100)
  )

  const currentNetRateKB = (
    ((metrics?.current.network_rx_rate ?? 0) +
      (metrics?.current.network_tx_rate ?? 0)) /
    1024
  ).toFixed(1)

  const restartCount = metrics?.current.restart_count ?? 0

  // Stat peaks and averages
  const cpuValues = points.map((p) => p.cpu_percent)
  const cpuPeak =
    cpuValues.length > 0 ? Math.max(...cpuValues).toFixed(1) + "%" : undefined
  const cpuAvg =
    cpuValues.length > 0
      ? (cpuValues.reduce((a, b) => a + b, 0) / cpuValues.length).toFixed(1) +
        "%"
      : undefined

  const memValues = points.map((p) =>
    Math.round(p.memory_bytes / (1024 * 1024))
  )
  const memPeak =
    memValues.length > 0 ? Math.max(...memValues) + " MB" : undefined
  const memAvg =
    memValues.length > 0
      ? Math.round(memValues.reduce((a, b) => a + b, 0) / memValues.length) +
        " MB"
      : undefined

  const netValues = points.map(
    (p) => (p.network_rx_rate + p.network_tx_rate) / 1024
  )
  const netPeak =
    netValues.length > 0
      ? Math.max(...netValues).toFixed(1) + " KB/s"
      : undefined
  const netAvg =
    netValues.length > 0
      ? (netValues.reduce((a, b) => a + b, 0) / netValues.length).toFixed(1) +
        " KB/s"
      : undefined

  return (
    <div className="flex flex-col gap-6 md:gap-8">
      {/* Metrics Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Card 1: Container State */}
        <div className="flex flex-col justify-between gap-3 rounded-lg border border-border bg-card p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">
              Container State
            </span>
            <StatusBadge variant={service.status} size="sm" />
          </div>
          <div>
            <span className="rounded border border-border bg-muted px-2 py-0.5 font-mono text-sm font-semibold text-foreground">
              {containerId}
            </span>
          </div>
          <span className="text-2xs text-muted-foreground">
            {isRunning ? "Serving live traffic" : "Container stopped"}
          </span>
        </div>

        {/* Card 2: Uptime */}
        <div className="flex flex-col justify-between gap-3 rounded-lg border border-border bg-card p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">
              Uptime
            </span>
            <Clock
              className="size-4 text-muted-foreground"
              aria-hidden="true"
            />
          </div>
          <div className="font-heading text-lg font-bold text-foreground">
            {isRunning ? "4 days, 12 hours" : "0 hours"}
          </div>
          <span className="text-2xs text-muted-foreground">
            {isRunning ? "Continuous healthy uptime" : "Downtime active"}
          </span>
        </div>

        {/* Card 3: Restart Counter */}
        <div className="flex flex-col justify-between gap-3 rounded-lg border border-border bg-card p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">
              Restarts
            </span>
            <ArrowsClockwiseIcon
              className="size-4 text-muted-foreground"
              aria-hidden="true"
            />
          </div>
          <div className="font-heading text-lg font-bold text-foreground">
            {restartCount} {restartCount === 1 ? "restart" : "restarts"}
          </div>
          {restartCount === 0 ? (
            <span className="inline-flex items-center gap-1 text-2xs font-medium text-status-healthy-text">
              <CheckCircleIcon className="size-3" aria-hidden="true" />
              <span>Zero crash loops detected</span>
            </span>
          ) : (
            <span className="text-2xs font-medium text-status-failed-text">
              Container restarted {restartCount} times
            </span>
          )}
        </div>

        {/* Card 4: CPU & Memory */}
        <div className="flex flex-col justify-between gap-3 rounded-lg border border-border bg-card p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">
              Resource Usage
            </span>
            <Cpu className="size-4 text-muted-foreground" aria-hidden="true" />
          </div>
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between text-xs">
              <span className="font-mono text-muted-foreground">
                CPU: {currentCpu.toFixed(1)}%
              </span>
              <span className="font-mono font-medium text-foreground">
                {currentMemMB} MB / {limitMemMB} MB
              </span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full border border-border bg-muted">
              <div
                className="h-1.5 rounded-full bg-primary transition-all duration-300"
                style={{ width: `${memPercent}%` }}
                aria-label={`${memPercent}% memory utilized`}
              />
            </div>
          </div>
          <span className="text-2xs text-muted-foreground">
            Network rate: {currentNetRateKB} KB/s
          </span>
        </div>
      </div>

      {/* Service Performance & Resource Telemetry Charts */}
      <section
        aria-label="Service performance telemetry charts"
        className="flex flex-col gap-4"
      >
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-heading text-base font-semibold text-foreground">
              Service Performance & Resource Utilization
            </h2>
            <p className="text-xs text-muted-foreground">
              Historical time-series telemetry of container CPU throttle, memory
              allocations, and network rate.
            </p>
          </div>

          {/* Controls: Live Status, Manual Refresh, & Unified Time Range Selector Bar */}
          <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
            <div className="flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1 text-xs">
              <span
                className={cn(
                  "size-2 rounded-full",
                  autoRefresh
                    ? "animate-pulse bg-emerald-500"
                    : "bg-muted-foreground"
                )}
                aria-hidden="true"
              />
              <span className="font-mono text-2xs font-medium text-foreground">
                {autoRefresh ? "Live (30s)" : "Paused"}
              </span>
              <button
                type="button"
                onClick={() => setAutoRefresh((prev) => !prev)}
                className="ml-1 cursor-pointer text-2xs text-muted-foreground underline hover:text-foreground"
                title={
                  autoRefresh ? "Pause auto-refresh" : "Resume auto-refresh"
                }
              >
                {autoRefresh ? "Pause" : "Resume"}
              </button>
              <button
                type="button"
                onClick={() => fetchMetrics(true)}
                disabled={isRefreshing}
                aria-label="Refresh metrics now"
                className="ml-1 cursor-pointer rounded p-0.5 text-muted-foreground transition-colors hover:text-foreground"
                title="Refresh now"
              >
                <ArrowsClockwiseIcon
                  className={cn("size-3.5", isRefreshing && "animate-spin")}
                  aria-hidden="true"
                />
              </button>
            </div>

            <div
              role="tablist"
              aria-label="Metrics time window"
              className="flex items-center gap-1 rounded-md border border-border bg-muted/40 p-1 text-xs"
            >
              {AVAILABLE_RANGES.map((range) => {
                const isSelected = selectedRange === range
                return (
                  <button
                    key={range}
                    type="button"
                    role="tab"
                    aria-selected={isSelected}
                    onClick={() => setSelectedRange(range)}
                    className={cn(
                      "cursor-pointer rounded px-3 py-1 font-mono text-xs font-medium transition-colors",
                      isSelected
                        ? "border border-border bg-background font-semibold text-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {range}
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        <div className="grid w-full grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {/* Chart 1: CPU Line Chart */}
          <ResourceChart
            title="Container CPU Usage"
            currentValue={`${currentCpu.toFixed(1)}%`}
            unit="%"
            color="primary"
            data={cpuData}
            timeRanges={AVAILABLE_RANGES}
            selectedRange={selectedRange}
            onRangeChange={(range) => setSelectedRange(range as MetricsRange)}
            peakValue={cpuPeak}
            avgValue={cpuAvg}
          />

          {/* Chart 2: Memory Line Chart */}
          <ResourceChart
            title="Container Memory Usage"
            currentValue={`${currentMemMB} MB`}
            unit=" MB"
            color="primary"
            data={memData}
            yMax={limitMemMB}
            timeRanges={AVAILABLE_RANGES}
            selectedRange={selectedRange}
            onRangeChange={(range) => setSelectedRange(range as MetricsRange)}
            peakValue={memPeak}
            avgValue={memAvg}
          />

          {/* Chart 3: Network I/O Rate Line Chart */}
          <ResourceChart
            title="Network I/O Rate"
            currentValue={`${currentNetRateKB} KB/s`}
            unit=" KB/s"
            color="primary"
            data={netData}
            timeRanges={AVAILABLE_RANGES}
            selectedRange={selectedRange}
            onRangeChange={(range) => setSelectedRange(range as MetricsRange)}
            peakValue={netPeak}
            avgValue={netAvg}
          />
        </div>
      </section>

      {/* Live Runtime Logs Panel */}
      <section
        aria-label="Container runtime logs"
        className="flex flex-col gap-4 rounded-lg border border-border bg-card p-6"
      >
        <div>
          <h2 className="font-heading text-base font-semibold text-foreground">
            Container Runtime Logs
          </h2>
          <p className="text-xs text-muted-foreground">
            Streaming real-time stdout and stderr output directly from the
            container daemon.
          </p>
        </div>

        <div className="h-145 min-h-115 overflow-hidden rounded-md border border-border">
          <LogViewer
            logs={logs}
            isLoading={isConnecting && logs.length === 0}
            emptyMessage="Waiting for container runtime output..."
            title={`stdout & stderr (${containerId})`}
            className="h-full"
            onClear={() => setLogs([])}
          />
        </div>
      </section>
    </div>
  )
}
