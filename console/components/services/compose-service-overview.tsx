"use client"

import * as React from "react"
import Link from "next/link"
import {
  ArrowsClockwiseIcon,
  Check,
  CircleNotchIcon,
  Copy,
  Cpu,
  FileCode,
  HardDrives,
  Network,
  PlayCircle,
  RocketLaunch,
  SlidersHorizontal,
  StopCircleIcon,
  TerminalWindow,
} from "@phosphor-icons/react"
import { Button } from "@/components/ui/button"
import { CopyButton } from "@/components/ui/copy-button"
import { StatusBadge } from "@/components/status-badge"
import { LoadingSkeleton } from "@/components/states/loading-skeleton"
import { ErrorCard } from "@/components/states/error-card"
import {
  api,
  type ComposeStackOverview,
  type ContainerLogEvent,
  type ServiceDetail,
} from "@/lib/api"
import { cn } from "@/lib/utils"

export interface ComposeServiceOverviewProps {
  service: ServiceDetail
  serviceId: string
  projectId: string
  refetch: () => Promise<void>
  showToast: (type: "success" | "error", message: string) => void
}

export function ComposeServiceOverview({
  service,
  serviceId,
  projectId,
  refetch,
  showToast,
}: ComposeServiceOverviewProps) {
  const [overview, setOverview] = React.useState<ComposeStackOverview | null>(
    null
  )
  const [isLoadingOverview, setIsLoadingOverview] = React.useState(true)
  const [overviewError, setOverviewError] = React.useState<string | null>(null)

  const [selectedContainer, setSelectedContainer] = React.useState<string>("")
  const [logs, setLogs] = React.useState<ContainerLogEvent[]>([])
  const [isConnectingLogs, setIsConnectingLogs] = React.useState(false)
  const [logFilter, setLogFilter] = React.useState("")
  const [autoScroll, setAutoScroll] = React.useState(true)
  const [isActionPending, setIsActionPending] = React.useState(false)

  const logContainerRef = React.useRef<HTMLDivElement>(null)

  const fetchOverview = React.useCallback(async () => {
    try {
      setOverviewError(null)
      const data = await api.services.getStackOverview(serviceId)
      setOverview(data)
    } catch (err) {
      setOverviewError(
        err instanceof Error
          ? err.message
          : "Failed to load compose stack details."
      )
    } finally {
      setIsLoadingOverview(false)
    }
  }, [serviceId])

  React.useEffect(() => {
    fetchOverview()
  }, [fetchOverview])

  // Live container logs stream with container filtering
  React.useEffect(() => {
    if (!serviceId) return
    let isActive = true
    setIsConnectingLogs(true)
    setLogs([])

    const stream = api.services.streamContainerLogs(serviceId, {
      container: selectedContainer || undefined,
      tail: 100,
      follow: true,
    })

    ;(async () => {
      try {
        for await (const chunk of stream) {
          if (!isActive) break
          setIsConnectingLogs(false)
          setLogs((prev) => [...prev, chunk])
        }
      } catch {
        // Stream aborted or closed
      } finally {
        if (isActive) {
          setIsConnectingLogs(false)
        }
      }
    })()

    return () => {
      isActive = false
    }
  }, [serviceId, selectedContainer])

  // Auto scroll log terminal
  React.useEffect(() => {
    if (autoScroll && logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight
    }
  }, [logs, autoScroll])

  const handleAction = async (
    action: "start" | "stop" | "restart" | "rebuild"
  ) => {
    setIsActionPending(true)
    try {
      if (action === "start") {
        await api.services.start(serviceId)
        showToast("success", "Docker Compose stack started.")
      } else if (action === "stop") {
        await api.services.stop(serviceId)
        showToast("success", "Docker Compose stack stopped.")
      } else if (action === "restart") {
        await api.services.restart(serviceId)
        showToast("success", "Docker Compose stack restarted.")
      } else if (action === "rebuild") {
        await api.services.rebuild(serviceId)
        showToast("success", "Rebuild queued for Docker Compose stack.")
      }
      await refetch()
      await fetchOverview()
    } catch (err) {
      showToast(
        "error",
        err instanceof Error
          ? err.message
          : `Failed to ${action} compose stack.`
      )
    } finally {
      setIsActionPending(false)
    }
  }

  const filteredLogs = React.useMemo(() => {
    if (!logFilter.trim()) return logs
    const q = logFilter.toLowerCase()
    return logs.filter(
      (l) =>
        l.line.toLowerCase().includes(q) ||
        (l.container_name && l.container_name.toLowerCase().includes(q))
    )
  }, [logs, logFilter])

  const subServices = overview?.sub_services || []

  return (
    <div className="flex flex-col gap-6">
      {/* Stack Header & Action Bar */}
      <section
        aria-label="Docker Compose stack overview"
        className="flex flex-col gap-4 rounded-lg border border-border bg-card p-6"
      >
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <h2 className="font-heading text-xl font-semibold text-foreground">
                {service.name}
              </h2>
              <span className="rounded-full border border-sky-500/30 bg-sky-500/10 px-2 py-0.5 text-xs font-medium text-sky-400">
                Docker Compose Stack
              </span>
              <StatusBadge variant={service.status} />
            </div>
            <p className="text-xs text-muted-foreground">
              Isolated multi-container environment orchestrated via Compose
              specification.
            </p>
          </div>

          {/* Quick Actions */}
          <div className="flex flex-wrap items-center gap-2">
            {service.status === "stopped" ? (
              <Button
                variant="default"
                onClick={() => handleAction("start")}
                disabled={isActionPending}
                className="cursor-pointer gap-2"
              >
                {isActionPending ? (
                  <CircleNotchIcon className="size-4 animate-spin" />
                ) : (
                  <PlayCircle className="size-4" />
                )}
                <span>Start Stack</span>
              </Button>
            ) : (
              <Button
                variant="outline"
                onClick={() => handleAction("stop")}
                disabled={isActionPending}
                className="cursor-pointer gap-2"
              >
                {isActionPending ? (
                  <CircleNotchIcon className="size-4 animate-spin" />
                ) : (
                  <StopCircleIcon className="size-4 text-muted-foreground" />
                )}
                <span>Stop Stack</span>
              </Button>
            )}

            <Button
              variant="outline"
              onClick={() => handleAction("restart")}
              disabled={isActionPending}
              className="cursor-pointer gap-2"
            >
              <ArrowsClockwiseIcon className="size-4 text-muted-foreground" />
              <span>Restart</span>
            </Button>

            <Button
              variant="outline"
              onClick={() => handleAction("rebuild")}
              disabled={isActionPending}
              className="cursor-pointer gap-2"
            >
              <RocketLaunch className="size-4 text-muted-foreground" />
              <span>Re-deploy</span>
            </Button>
          </div>
        </div>

        {/* Network & Source Metadata Cards */}
        <div className="grid grid-cols-1 gap-3 pt-2 sm:grid-cols-3">
          <div className="flex flex-col gap-1 rounded-md border border-border bg-background p-3">
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Network className="size-3.5" aria-hidden="true" />
              <span>Isolated Internal Network</span>
            </span>
            <div className="mt-0.5 flex items-center justify-between gap-2">
              <code className="truncate font-mono text-xs font-semibold text-foreground">
                {overview?.network_name || `tako_compose_${projectId}`}
              </code>
              <CopyButton
                text={overview?.network_name || `tako_compose_${projectId}`}
                size="icon-sm"
                aria-label="Copy network name"
                title="Copy network name"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1 rounded-md border border-border bg-background p-3">
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <HardDrives className="size-3.5" aria-hidden="true" />
              <span>Sub-Containers</span>
            </span>
            <span className="mt-0.5 font-heading text-base font-semibold text-foreground">
              {subServices.length}{" "}
              {subServices.length === 1 ? "Service" : "Services"} Active
            </span>
          </div>

          <div className="flex flex-col gap-1 rounded-md border border-border bg-background p-3">
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <FileCode className="size-3.5" aria-hidden="true" />
              <span>Configuration Source</span>
            </span>
            <span className="mt-0.5 truncate text-xs font-medium text-foreground">
              {service.compose_file_content
                ? "Inline Compose YAML"
                : service.compose_file_path || "docker-compose.yml"}
            </span>
          </div>
        </div>
      </section>

      {/* Sub-Containers Table */}
      <section
        aria-label="Compose sub-services"
        className="flex flex-col gap-4 rounded-lg border border-border bg-card p-6"
      >
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-heading text-base font-semibold text-foreground">
              Stack Services & Containers
            </h3>
            <p className="text-xs text-muted-foreground">
              Individual containers running within the isolated project bridge
              network.
            </p>
          </div>
          <button
            type="button"
            onClick={fetchOverview}
            aria-label="Refresh stack containers"
            className="flex h-8 cursor-pointer items-center gap-1.5 px-2 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowsClockwiseIcon className="size-3.5" />
            <span>Refresh</span>
          </button>
        </div>

        {isLoadingOverview ? (
          <div className="flex flex-col gap-2">
            <LoadingSkeleton variant="card" />
            <LoadingSkeleton variant="card" />
          </div>
        ) : overviewError ? (
          <ErrorCard
            title="Failed to Load Stack Details"
            message={overviewError}
            onRetry={fetchOverview}
          />
        ) : subServices.length === 0 ? (
          <div className="rounded-md border border-dashed border-border py-8 text-center text-xs text-muted-foreground">
            No active sub-services detected in this compose stack.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-md border border-border">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-border bg-muted/40 font-medium text-muted-foreground">
                  <th className="px-3 py-2.5">Service</th>
                  <th className="px-3 py-2.5">Container Name</th>
                  <th className="px-3 py-2.5">Status</th>
                  <th className="px-3 py-2.5">Image</th>
                  <th className="px-3 py-2.5">IP Address</th>
                  <th className="px-3 py-2.5">Ports</th>
                  <th className="px-3 py-2.5">CPU / Memory</th>
                  <th className="px-3 py-2.5 text-right">Logs</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {subServices.map((sub) => {
                  const portSummary = sub.ports?.join(", ")

                  const isFiltered = selectedContainer === sub.name

                  return (
                    <tr
                      key={sub.name}
                      className={cn(
                        "transition-colors hover:bg-muted/30",
                        isFiltered && "bg-muted/40 font-medium"
                      )}
                    >
                      <td className="px-3 py-2.5 font-semibold text-foreground">
                        {sub.name}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-2xs text-muted-foreground">
                        {sub.container_name || `tako-${serviceId}-${sub.name}`}
                      </td>
                      <td className="px-3 py-2.5">
                        <StatusBadge
                          variant={(sub.status as any) || "running"}
                        />
                      </td>
                      <td className="max-w-35 truncate px-3 py-2.5 font-mono text-2xs text-muted-foreground">
                        {sub.image}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-2xs text-muted-foreground">
                        {sub.ip_address || "None"}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-2xs text-muted-foreground">
                        {portSummary || "None"}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-2xs text-muted-foreground">
                        {sub.cpu_percent !== undefined
                          ? `${sub.cpu_percent.toFixed(1)}%`
                          : "0.0%"}{" "}
                        /{" "}
                        {sub.memory_bytes !== undefined
                          ? `${Math.round(sub.memory_bytes / 1024 / 1024)} MB`
                          : "0 MB"}
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <button
                          type="button"
                          onClick={() =>
                            setSelectedContainer(
                              selectedContainer === sub.name ? "" : sub.name
                            )
                          }
                          className={cn(
                            "inline-flex h-7 cursor-pointer items-center rounded px-2 text-2xs transition-colors",
                            selectedContainer === sub.name
                              ? "bg-foreground font-semibold text-background"
                              : "border border-border bg-background text-muted-foreground hover:text-foreground"
                          )}
                        >
                          {selectedContainer === sub.name
                            ? "Viewing"
                            : "Filter Logs"}
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Multi-Container Live Log Streaming */}
      <section
        aria-label="Multi-container live runtime logs"
        className="flex flex-col gap-4 rounded-lg border border-border bg-card p-6"
      >
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <h3 className="flex items-center gap-2 font-heading text-base font-semibold text-foreground">
              <TerminalWindow
                className="size-4 text-muted-foreground"
                aria-hidden="true"
              />
              <span>Compose Live Log Stream</span>
            </h3>
            <p className="text-xs text-muted-foreground">
              Real-time multi-container logs with container switching and regex
              filtering.
            </p>
          </div>

          {/* Container Selector Tabs */}
          <div className="flex flex-wrap items-center gap-1.5 rounded-md border border-border bg-muted/40 p-1">
            <button
              type="button"
              onClick={() => setSelectedContainer("")}
              className={cn(
                "flex h-8 cursor-pointer items-center rounded px-2.5 text-xs transition-colors",
                selectedContainer === ""
                  ? "border border-border bg-background font-semibold text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              All Containers
            </button>
            {subServices.map((sub) => (
              <button
                key={sub.name}
                type="button"
                onClick={() => setSelectedContainer(sub.name)}
                className={cn(
                  "flex h-8 cursor-pointer items-center rounded px-2.5 font-mono text-xs transition-colors",
                  selectedContainer === sub.name
                    ? "border border-border bg-background font-semibold text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {sub.name}
              </button>
            ))}
          </div>
        </div>

        {/* Log Viewer Controls Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Search or filter log output..."
              value={logFilter}
              onChange={(e) => setLogFilter(e.target.value)}
              className="min-w-55 rounded border border-border bg-background px-2.5 py-1 text-xs text-foreground placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
            />
            {isConnectingLogs && (
              <span className="flex items-center gap-1 text-2xs text-muted-foreground">
                <CircleNotchIcon className="size-3 animate-spin" />
                Connecting...
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            <label className="flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground select-none">
              <input
                type="checkbox"
                checked={autoScroll}
                onChange={(e) => setAutoScroll(e.target.checked)}
                className="cursor-pointer rounded border-border accent-foreground"
              />
              <span>Auto-scroll</span>
            </label>
            <button
              type="button"
              onClick={() => setLogs([])}
              className="flex h-8 cursor-pointer items-center px-1 text-xs text-muted-foreground hover:text-foreground"
            >
              Clear Logs
            </button>
          </div>
        </div>

        {/* Monospace Log Viewer Terminal */}
        <div
          ref={logContainerRef}
          className="flex h-110 flex-col gap-1 overflow-y-auto rounded-md border border-border bg-zinc-950 p-3 font-mono text-xs text-zinc-100 select-text"
        >
          {filteredLogs.length === 0 ? (
            <div className="flex h-full items-center justify-center text-xs text-zinc-500">
              {isConnectingLogs
                ? "Subscribing to container stream..."
                : "No log lines recorded for this container filter."}
            </div>
          ) : (
            filteredLogs.map((log, idx) => {
              const timeStr = log.timestamp
                ? new Date(log.timestamp).toLocaleTimeString()
                : ""
              const tag = log.container_name || selectedContainer || "compose"

              return (
                <div
                  key={idx}
                  className="flex items-start gap-2 leading-relaxed"
                >
                  <span className="shrink-0 text-3xs text-zinc-500 select-none">
                    {timeStr}
                  </span>
                  <span className="py-0.2 shrink-0 rounded border border-zinc-700 bg-zinc-800 px-1.5 text-3xs font-semibold text-zinc-300 select-none">
                    [{tag}]
                  </span>
                  <span
                    className={cn(
                      "break-all",
                      log.stream === "stderr"
                        ? "text-amber-400"
                        : "text-zinc-200"
                    )}
                  >
                    {log.line}
                  </span>
                </div>
              )
            })
          )}
        </div>
      </section>

      {/* Navigation Links */}
      <section
        aria-label="Compose navigation links"
        className="grid grid-cols-1 gap-3 sm:grid-cols-2"
      >
        <Link
          href={`/projects/${projectId}/services/${serviceId}/environment`}
          className="flex min-h-11 items-center gap-3 rounded-lg border border-border bg-card p-4 transition-colors hover:bg-muted/40"
        >
          <SlidersHorizontal className="size-5 shrink-0 text-muted-foreground" />
          <div className="flex flex-col">
            <span className="font-heading text-sm font-semibold text-foreground">
              Environment Variables
            </span>
            <span className="text-xs text-muted-foreground">
              Overlay custom environment variables across the entire stack.
            </span>
          </div>
        </Link>

        <Link
          href={`/projects/${projectId}/services/${serviceId}/deployments`}
          className="flex min-h-11 items-center gap-3 rounded-lg border border-border bg-card p-4 transition-colors hover:bg-muted/40"
        >
          <RocketLaunch className="size-5 shrink-0 text-muted-foreground" />
          <div className="flex flex-col">
            <span className="font-heading text-sm font-semibold text-foreground">
              Deployment History
            </span>
            <span className="text-xs text-muted-foreground">
              View past stack builds and container deployment revisions.
            </span>
          </div>
        </Link>
      </section>
    </div>
  )
}
