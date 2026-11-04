"use client"

import * as React from "react"
import {
  ArrowDown,
  Globe,
  Pause,
  Play,
  Search,
  Server,
  Terminal,
  Trash2,
  X,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  SearchableSelect,
  SelectOption,
} from "@/components/ui/searchable-select"
import { buildNodeSelectOptions } from "@/lib/node-select-options"
import { getAccessLogs } from "@/services/monitoring.service"
import {
  ClusterNode,
  NODE_ROLE,
  NODE_STATUS,
  type HttpTrafficEvent,
} from "@/types/platform"
import { cn } from "@/lib/utils"

export interface TelemetryLogEntry {
  id: string
  timestamp: string
  nodeId: string
  nodeName: string
  nodeIp: string
  level: "info" | "warn" | "critical" | "success"
  category: "grpc" | "metric" | "container" | "network"
  message: string
}

export interface LiveTelemetryLogProps {
  nodes: ClusterNode[]
  isStreaming: boolean
  onToggleStreaming: () => void
  selectedNodeId?: string | null
  onSelectNode?: (id: string | null) => void
  mobileView?: "split" | "map" | "log"
  onMobileViewChange?: (view: "split" | "map" | "log") => void
  onTrafficEvent?: (event: HttpTrafficEvent) => void
  activeTab?: "http" | "system"
  onActiveTabChange?: (tab: "http" | "system") => void
}

const SAMPLE_TEMPLATES = [
  {
    category: "grpc" as const,
    level: "success" as const,
    generate: (node: ClusterNode) =>
      `gRPC keepalive ACK received. Ingestion roundtrip: ${node.grpcLatencyMs}ms. Stream: READY.`,
  },
  {
    category: "metric" as const,
    level: "info" as const,
    generate: (node: ClusterNode) =>
      `Telemetry metrics sample: CPU ${node.cpuPercent}%, RAM ${node.memoryPercent}%, Disk ${node.diskPercent}%.`,
  },
  {
    category: "network" as const,
    level: "info" as const,
    generate: (node: ClusterNode) =>
      `Network I/O sample: RX ${(node.networkRxKbps || 0.1).toFixed(1)} kB/s, TX ${(node.networkTxKbps || 0.2).toFixed(1)} kB/s.`,
  },
  {
    category: "container" as const,
    level: "info" as const,
    generate: (node: ClusterNode) =>
      `Container runtime sample: ${node.runningContainers || node.servicesCount || 0} active containers reported by Docker daemon.`,
  },
]

const SAMPLE_HTTP_PATHS = [
  { path: "/api/v1/auth/session", method: "GET", status: 200 },
  { path: "/api/v1/projects", method: "GET", status: 200 },
  { path: "/api/v1/services", method: "GET", status: 200 },
  { path: "/api/v1/deployments", method: "POST", status: 201 },
  { path: "/api/v1/metrics/cluster", method: "GET", status: 200 },
  { path: "/dashboard", method: "GET", status: 200 },
  { path: "/api/v1/ingress/access-logs", method: "GET", status: 200 },
  { path: "/login", method: "GET", status: 200 },
  { path: "/api/v1/auth/login", method: "POST", status: 200 },
  { path: "/api/v1/unknown-endpoint", method: "GET", status: 404 },
  { path: "/api/v1/services/sync", method: "POST", status: 502 },
  { path: "/assets/index.js", method: "GET", status: 304 },
]

const CLIENT_IP_POOL = [
  "182.253.14.92", // ID
  "13.250.12.88", // SG
  "133.242.18.4", // JP
  "198.51.100.42", // US
  "84.115.22.10", // DE
  "82.165.197.1", // GB
  "139.130.4.5", // AU
  "177.136.25.1", // BR
  "49.207.18.2", // IN
  "145.220.1.10", // NL
]

function getTimestamp() {
  const d = new Date()
  const pad = (n: number) => n.toString().padStart(2, "0")
  const padMs = (n: number) => n.toString().padStart(3, "0")
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${padMs(d.getMilliseconds())}`
}

function createInitialLogs(nodes: ClusterNode[]): TelemetryLogEntry[] {
  const master = nodes.find((n) => n.role === NODE_ROLE.MASTER) || nodes[0]
  const workers = nodes.filter((n) => n.id !== master?.id)
  const entries: TelemetryLogEntry[] = []

  if (master) {
    entries.push({
      id: "log-init-1",
      timestamp: getTimestamp(),
      nodeId: master.id,
      nodeName: master.name,
      nodeIp: master.ipAddress,
      level: "success",
      category: "grpc",
      message: `Master control plane active on ${master.ipAddress}. gRPC daemon listening on :50051.`,
    })
  }

  for (let i = 0; i < workers.length; i++) {
    const w = workers[i]
    entries.push({
      id: `log-init-${i + 2}`,
      timestamp: getTimestamp(),
      nodeId: w.id,
      nodeName: w.name,
      nodeIp: w.ipAddress,
      level: w.status === NODE_STATUS.ONLINE ? "info" : "critical",
      category: "grpc",
      message:
        w.status === NODE_STATUS.ONLINE
          ? `Worker agent stream active to master (Roundtrip: ${w.grpcLatencyMs}ms, TLS session valid).`
          : `Worker agent connection dropped. Health check failed to respond.`,
    })
  }

  return entries
}

export function LiveTelemetryLog({
  nodes,
  isStreaming,
  onToggleStreaming,
  selectedNodeId,
  onSelectNode,
  mobileView,
  onMobileViewChange,
  onTrafficEvent,
  activeTab: controlledActiveTab,
  onActiveTabChange,
}: LiveTelemetryLogProps) {
  // Active Tab state: "http" (Traefik Ingress) vs "system" (Node Telemetry)
  const [internalActiveTab, setInternalActiveTab] = React.useState<
    "http" | "system"
  >("http")
  const activeTab = controlledActiveTab ?? internalActiveTab

  const handleTabChange = (tab: "http" | "system") => {
    setInternalActiveTab(tab)
    onActiveTabChange?.(tab)
  }

  // System Logs
  const [logs, setLogs] = React.useState<TelemetryLogEntry[]>([])
  const didSeedLogs = React.useRef(false)
  const [filterLevel, setFilterLevel] = React.useState<string>("all")

  // HTTP Access Logs (Traefik)
  const [httpLogs, setHttpLogs] = React.useState<HttpTrafficEvent[]>([])
  const [httpStatusFilter, setHttpStatusFilter] = React.useState<string>("all")
  const [httpMethodFilter, setHttpMethodFilter] = React.useState<string>("all")

  // Shared Filters & Search
  const [internalFilterNode, setInternalFilterNode] =
    React.useState<string>("all")
  const [searchQuery, setSearchQuery] = React.useState<string>("")
  const [autoScroll, setAutoScroll] = React.useState<boolean>(true)
  const logContainerRef = React.useRef<HTMLDivElement>(null)

  // Seed initial system logs
  React.useEffect(() => {
    if (didSeedLogs.current || nodes.length === 0) return
    didSeedLogs.current = true
    setLogs(createInitialLogs(nodes))
  }, [nodes])

  // Derive active filter node
  const activeFilterNode =
    selectedNodeId !== undefined ? selectedNodeId || "all" : internalFilterNode

  const handleSelectNode = (val: string) => {
    setInternalFilterNode(val)
    if (onSelectNode) {
      onSelectNode(val === "all" ? null : val)
    }
  }

  // Node filter options with SearchableSelect
  const nodeOptions: SelectOption[] = React.useMemo(
    () =>
      buildNodeSelectOptions(nodes, {
        label: "All Nodes (Entire Cluster)",
        description: `${nodes.length} nodes connected`,
      }),
    [nodes]
  )

  // Periodic System Telemetry generator
  React.useEffect(() => {
    if (!isStreaming || nodes.length === 0) return

    const interval = setInterval(() => {
      const randomNode = nodes[Math.floor(Math.random() * nodes.length)]
      if (!randomNode) return

      let newEntry: TelemetryLogEntry

      if (randomNode.status === NODE_STATUS.OFFLINE) {
        const errMessages = [
          `gRPC transport stream disconnected: connection reset by peer (errno 104).`,
          `Heartbeat timeout after 10000ms. Node marked as DEAD in cluster registry.`,
          `Edge failover triggered: Re-routing workload traffic to available cluster nodes.`,
          `Dial TCP error to ${randomNode.ipAddress}:50051: connection refused.`,
        ]
        const errMessage =
          errMessages[Math.floor(Math.random() * errMessages.length)]

        newEntry = {
          id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          timestamp: getTimestamp(),
          nodeId: randomNode.id,
          nodeName: randomNode.name,
          nodeIp: randomNode.ipAddress,
          level: "critical",
          category: "grpc",
          message: errMessage,
        }
      } else {
        const template =
          SAMPLE_TEMPLATES[Math.floor(Math.random() * SAMPLE_TEMPLATES.length)]
        newEntry = {
          id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          timestamp: getTimestamp(),
          nodeId: randomNode.id,
          nodeName: randomNode.name,
          nodeIp: randomNode.ipAddress,
          level: template.level,
          category: template.category,
          message: template.generate(randomNode),
        }
      }

      setLogs((prev) => {
        const next = [...prev, newEntry]
        if (next.length > 250) return next.slice(next.length - 250)
        return next
      })
    }, 1200)

    return () => clearInterval(interval)
  }, [isStreaming, nodes])

  // Periodic HTTP Traefik Access Log generator & fetcher
  React.useEffect(() => {
    if (!isStreaming || nodes.length === 0) return

    let cancelled = false

    const emitEvent = (ev: HttpTrafficEvent) => {
      setHttpLogs((prev) => {
        const next = [...prev, ev]
        if (next.length > 250) return next.slice(next.length - 250)
        return next
      })
      onTrafficEvent?.(ev)
    }

    const interval = setInterval(async () => {
      if (cancelled) return

      // Try fetching real Traefik access logs from server first
      try {
        const remoteLogs = await getAccessLogs({
          limit: 5,
          nodeId: activeFilterNode !== "all" ? activeFilterNode : undefined,
        })

        if (Array.isArray(remoteLogs) && remoteLogs.length > 0) {
          for (const raw of remoteLogs) {
            const ev: HttpTrafficEvent = {
              id: `traefik-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              timestamp: getTimestamp(),
              clientIp: raw.clientIp || "127.0.0.1",
              method: raw.method || "GET",
              path: raw.path || "/",
              statusCode: raw.statusCode || 200,
              durationMs: raw.durationMs || 1.2,
              routerName: raw.routerName,
              serviceName: raw.serviceName,
              nodeId: raw.nodeId || nodes[0].id,
              nodeName: raw.nodeName || nodes[0].name,
              host: raw.host,
            }
            emitEvent(ev)
          }
          return
        }
      } catch {
        // Fallback to active edge stream simulation below
      }

      // Simulated realistic edge ingress traffic across active nodes
      const targetNode =
        activeFilterNode !== "all"
          ? nodes.find((n) => n.id === activeFilterNode) || nodes[0]
          : nodes[Math.floor(Math.random() * nodes.length)]

      if (!targetNode || targetNode.status === NODE_STATUS.OFFLINE) return

      const sample =
        SAMPLE_HTTP_PATHS[Math.floor(Math.random() * SAMPLE_HTTP_PATHS.length)]
      const clientIp =
        CLIENT_IP_POOL[Math.floor(Math.random() * CLIENT_IP_POOL.length)]
      const durationMs = Math.round((Math.random() * 28 + 1.2) * 10) / 10

      const ev: HttpTrafficEvent = {
        id: `http-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        timestamp: getTimestamp(),
        clientIp,
        method: sample.method,
        path: sample.path,
        statusCode: sample.status,
        durationMs,
        routerName: `${targetNode.name}-ingress@file`,
        serviceName: "tako-edge",
        nodeId: targetNode.id,
        nodeName: targetNode.name,
        host: "gettako.cloud",
      }

      emitEvent(ev)
    }, 1400)

    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [isStreaming, nodes, activeFilterNode, onTrafficEvent])

  // Auto-scroll handler
  React.useEffect(() => {
    if (autoScroll && logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight
    }
  }, [logs, httpLogs, autoScroll, activeTab])

  // Filtered System Logs
  const filteredSystemLogs = React.useMemo(() => {
    return logs.filter((log) => {
      if (filterLevel !== "all" && log.level !== filterLevel) return false
      if (activeFilterNode !== "all" && log.nodeId !== activeFilterNode) {
        return false
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const text =
          `${log.timestamp} ${log.nodeName} ${log.nodeIp} ${log.message}`.toLowerCase()
        if (!text.includes(q)) return false
      }
      return true
    })
  }, [logs, filterLevel, activeFilterNode, searchQuery])

  // Filtered HTTP Logs
  const filteredHttpLogs = React.useMemo(() => {
    return httpLogs.filter((log) => {
      if (activeFilterNode !== "all" && log.nodeId !== activeFilterNode) {
        return false
      }
      if (httpStatusFilter !== "all") {
        if (httpStatusFilter === "2xx" && (log.statusCode < 200 || log.statusCode >= 300)) return false
        if (httpStatusFilter === "3xx" && (log.statusCode < 300 || log.statusCode >= 400)) return false
        if (httpStatusFilter === "4xx" && (log.statusCode < 400 || log.statusCode >= 500)) return false
        if (httpStatusFilter === "5xx" && (log.statusCode < 500 || log.statusCode >= 600)) return false
      }
      if (httpMethodFilter !== "all" && log.method !== httpMethodFilter) {
        return false
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const text =
          `${log.timestamp} ${log.method} ${log.path} ${log.statusCode} ${log.nodeName} ${log.clientIp} ${log.host || ""}`.toLowerCase()
        if (!text.includes(q)) return false
      }
      return true
    })
  }, [httpLogs, activeFilterNode, httpStatusFilter, httpMethodFilter, searchQuery])

  const clearLogs = () => {
    if (activeTab === "http") {
      setHttpLogs([])
    } else {
      setLogs([])
    }
  }

  return (
    <div className="flex h-full w-full flex-col overflow-hidden rounded-xl border border-border/80 bg-card/80 shadow-lg backdrop-blur-md">
      {/* Terminal Header Toolbar */}
      <div className="flex flex-col gap-1.5 border-b border-border/80 bg-muted/40 p-2 sm:gap-2 sm:px-3 sm:py-2">
        {/* Row 1: Mode Switcher Tabs, Stream dot & Quick Actions */}
        <div className="flex items-center justify-between gap-2">
          {/* Mode Tabs */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            <div className="flex items-center rounded-md border border-border/70 bg-background/90 p-0.5">
              <button
                type="button"
                onClick={() => handleTabChange("http")}
                className={cn(
                  "flex items-center gap-1.5 rounded px-2 py-0.5 font-mono text-[10.5px] font-medium transition-colors sm:text-[11px]",
                  activeTab === "http"
                    ? "bg-primary font-semibold text-primary-foreground shadow-2xs"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Globe className="size-3" />
                <span className="hidden sm:inline">Traefik HTTP</span>
                <span className="sm:hidden">HTTP</span>
                <span
                  className={cn(
                    "rounded px-1 py-0.2 text-[9px]",
                    activeTab === "http"
                      ? "bg-primary-foreground/20 text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  {filteredHttpLogs.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleTabChange("system")}
                className={cn(
                  "flex items-center gap-1.5 rounded px-2 py-0.5 font-mono text-[10.5px] font-medium transition-colors sm:text-[11px]",
                  activeTab === "system"
                    ? "bg-primary font-semibold text-primary-foreground shadow-2xs"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Terminal className="size-3" />
                <span className="hidden sm:inline">Host Telemetry</span>
                <span className="sm:hidden">System</span>
                <span
                  className={cn(
                    "rounded px-1 py-0.2 text-[9px]",
                    activeTab === "system"
                      ? "bg-primary-foreground/20 text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  {filteredSystemLogs.length}
                </span>
              </button>
            </div>

            {/* Live pulsating status dot */}
            <span
              className={cn(
                "size-1.5 shrink-0 rounded-full",
                isStreaming ? "animate-pulse bg-emerald-500" : "bg-amber-500"
              )}
            />
          </div>

          {/* Quick Action Buttons & Mobile View Switcher */}
          <div className="flex items-center gap-1">
            {/* Mobile View Switcher */}
            {onMobileViewChange && mobileView === "log" && (
              <div className="mr-1 flex items-center rounded-md border border-border/70 bg-background/90 p-0.5 font-mono text-[10px] md:hidden">
                {(["map", "split", "log"] as const).map((view) => (
                  <button
                    key={view}
                    type="button"
                    onClick={() => onMobileViewChange(view)}
                    className={cn(
                      "rounded px-1.5 py-0.5 capitalize transition-colors",
                      mobileView === view
                        ? "bg-primary font-bold text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {view}
                  </button>
                ))}
              </div>
            )}

            {/* Auto-scroll toggle */}
            <Button
              size="sm"
              variant={autoScroll ? "default" : "outline"}
              onClick={() => setAutoScroll((prev) => !prev)}
              className="h-6.5 gap-1 px-1.5 text-[10.5px] sm:h-7 sm:px-2 sm:text-[11px]"
              title={autoScroll ? "Auto-scroll active" : "Auto-scroll paused"}
            >
              <ArrowDown className="size-3" />
              <span className="hidden sm:inline">Scroll</span>
            </Button>

            {/* Stream Play/Pause */}
            <Button
              size="sm"
              variant="outline"
              onClick={onToggleStreaming}
              className="h-6.5 gap-1 px-1.5 text-[10.5px] sm:h-7 sm:px-2 sm:text-[11px]"
              title={isStreaming ? "Pause Stream" : "Resume Stream"}
            >
              {isStreaming ? (
                <>
                  <Pause className="size-3 text-amber-500" />
                  <span className="hidden sm:inline">Pause</span>
                </>
              ) : (
                <>
                  <Play className="size-3 text-emerald-500" />
                  <span className="hidden sm:inline">Resume</span>
                </>
              )}
            </Button>

            {/* Clear Buffer */}
            <Button
              size="icon-xs"
              variant="ghost"
              onClick={clearLogs}
              className="size-6.5 text-muted-foreground hover:text-foreground sm:size-7"
              title="Clear buffer"
              aria-label="Clear log buffer"
            >
              <Trash2 className="size-3" />
            </Button>
          </div>
        </div>

        {/* Row 2: Filter Pills, Search, and Node Select */}
        <div className="flex flex-wrap items-center gap-1.5 font-mono text-xs">
          {activeTab === "http" ? (
            <>
              {/* HTTP Status Code Filter Pills */}
              <div className="flex shrink-0 items-center rounded-md border border-border/70 bg-background/80 p-0.5">
                {["all", "2xx", "3xx", "4xx", "5xx"].map((status) => (
                  <button
                    key={status}
                    type="button"
                    onClick={() => setHttpStatusFilter(status)}
                    className={cn(
                      "rounded px-1.5 py-0.5 text-[10px] font-medium uppercase transition-colors sm:px-2 sm:text-[11px]",
                      httpStatusFilter === status
                        ? status === "5xx"
                          ? "bg-red-500 font-bold text-white"
                          : status === "4xx"
                            ? "bg-amber-500 font-bold text-white"
                            : "bg-primary font-semibold text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {status}
                  </button>
                ))}
              </div>

              {/* HTTP Method Filter Pills */}
              <div className="hidden shrink-0 items-center rounded-md border border-border/70 bg-background/80 p-0.5 md:flex">
                {["all", "GET", "POST", "PUT", "DELETE"].map((method) => (
                  <button
                    key={method}
                    type="button"
                    onClick={() => setHttpMethodFilter(method)}
                    className={cn(
                      "rounded px-1.5 py-0.5 text-[10px] font-medium uppercase transition-colors sm:px-2 sm:text-[11px]",
                      httpMethodFilter === method
                        ? "bg-primary font-semibold text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {method}
                  </button>
                ))}
              </div>
            </>
          ) : (
            /* System Log Level Filter Pills */
            <div className="flex shrink-0 items-center rounded-md border border-border/70 bg-background/80 p-0.5">
              {["all", "critical", "warn", "info"].map((level) => (
                <button
                  key={level}
                  type="button"
                  onClick={() => setFilterLevel(level)}
                  className={cn(
                    "rounded px-1.5 py-0.5 text-[10px] font-medium uppercase transition-colors sm:px-2 sm:text-[11px]",
                    filterLevel === level
                      ? level === "critical"
                        ? "bg-red-500 font-bold text-white"
                        : "bg-primary font-semibold text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <span className="sm:hidden">
                    {level === "critical" ? "crit" : level}
                  </span>
                  <span className="hidden sm:inline">{level}</span>
                </button>
              ))}
            </div>
          )}

          {/* Search Filter */}
          <div className="relative flex min-w-0 flex-1 items-center sm:max-w-48">
            <Search className="pointer-events-none absolute left-2 size-3 text-muted-foreground" />
            <Input
              type="text"
              placeholder={
                activeTab === "http"
                  ? "Filter path, IP, host..."
                  : "Filter system log..."
              }
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-6.5 w-full rounded border-border/70 bg-background/80 pr-5 pl-6 font-mono text-[10.5px] text-foreground shadow-2xs placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-ring sm:h-7 sm:pr-6 sm:pl-6.5 sm:text-[11px]"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-1.5 flex size-3.5 items-center justify-center rounded-xs text-muted-foreground hover:text-foreground sm:size-4"
                aria-label="Clear filter"
              >
                <X className="size-2.5 sm:size-3" />
              </button>
            )}
          </div>

          {/* Node Filter */}
          <div className="hidden w-40 sm:block sm:w-48 lg:w-56">
            <SearchableSelect
              options={nodeOptions}
              value={activeFilterNode}
              onChange={handleSelectNode}
              placeholder="Filter by node..."
              searchPlaceholder="Search cluster node..."
              size="sm"
            />
          </div>
        </div>
      </div>

      {/* Terminal Output Area */}
      <div
        ref={logContainerRef}
        className="flex-1 [scrollbar-gutter:stable] overflow-y-auto p-2 font-mono text-[10.5px] leading-relaxed select-text sm:p-3 sm:text-[11.5px]"
      >
        {activeTab === "http" ? (
          /* Traefik HTTP Ingress Stream */
          filteredHttpLogs.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-1.5 text-xs text-muted-foreground">
              <Globe className="size-5 opacity-40" />
              <span>No Traefik HTTP access logs matching current filter.</span>
            </div>
          ) : (
            <div className="space-y-1">
              {filteredHttpLogs.map((entry) => {
                const is2xx =
                  entry.statusCode >= 200 && entry.statusCode < 300
                const is3xx =
                  entry.statusCode >= 300 && entry.statusCode < 400
                const is4xx =
                  entry.statusCode >= 400 && entry.statusCode < 500
                const is5xx = entry.statusCode >= 500

                return (
                  <div
                    key={entry.id}
                    className={cn(
                      "flex flex-wrap items-center gap-x-2 rounded px-1.5 py-0.5 transition-colors",
                      is5xx
                        ? "border-l-2 border-red-500 bg-red-500/10 font-medium text-red-700 dark:bg-red-950/40 dark:text-red-300"
                        : is4xx
                          ? "border-l-2 border-amber-500 bg-amber-500/10 text-amber-800 dark:bg-amber-950/30 dark:text-amber-300"
                          : "text-foreground/90 hover:bg-muted/30"
                    )}
                  >
                    {/* Timestamp */}
                    <span className="shrink-0 text-[10px] text-muted-foreground/70 sm:text-[11px]">
                      [{entry.timestamp}]
                    </span>

                    {/* Status Code */}
                    <span
                      className={cn(
                        "py-0.2 shrink-0 rounded px-1 text-[9px] font-bold sm:text-[9.5px]",
                        is2xx
                          ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                          : is3xx
                            ? "bg-sky-500/15 text-sky-700 dark:text-sky-400"
                            : is4xx
                              ? "bg-amber-500/15 text-amber-800 dark:text-amber-400"
                              : "bg-red-500/20 text-red-700 dark:text-red-400"
                      )}
                    >
                      {entry.statusCode}
                    </span>

                    {/* Method */}
                    <span
                      className={cn(
                        "py-0.2 shrink-0 rounded px-1 font-bold text-[9px] uppercase",
                        entry.method === "GET"
                          ? "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                          : entry.method === "POST"
                            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                            : entry.method === "PUT"
                              ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                              : "bg-red-500/10 text-red-600 dark:text-red-400"
                      )}
                    >
                      {entry.method}
                    </span>

                    {/* Duration / Latency */}
                    <span className="shrink-0 text-[10px] text-muted-foreground sm:text-[10.5px]">
                      {entry.durationMs.toFixed(1)}ms
                    </span>

                    {/* Path */}
                    <span
                      className="min-w-0 max-w-56 truncate font-semibold text-foreground sm:max-w-xs md:max-w-sm"
                      title={entry.path}
                    >
                      {entry.path}
                    </span>

                    {/* Node Tag (Click to filter by node) */}
                    <button
                      type="button"
                      onClick={() => handleSelectNode(entry.nodeId)}
                      className="shrink-0 cursor-pointer rounded bg-muted/60 px-1 py-0.2 text-[9.5px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
                      title={`Filter to node ${entry.nodeName || entry.nodeId}`}
                    >
                      [{entry.nodeName || entry.nodeId}]
                    </button>

                    {/* Client IP & Host */}
                    <span className="hidden text-[10px] text-muted-foreground/75 lg:inline">
                      from {entry.clientIp}
                      {entry.host ? ` -> ${entry.host}` : ""}
                    </span>
                  </div>
                )
              })}
            </div>
          )
        ) : (
          /* Host System Telemetry Stream */
          filteredSystemLogs.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-1.5 text-xs text-muted-foreground">
              <Server className="size-5 opacity-40" />
              <span>No telemetry events matching current filter.</span>
            </div>
          ) : (
            <div className="space-y-1">
              {filteredSystemLogs.map((entry) => {
                const isCrit = entry.level === "critical"
                const isWarn = entry.level === "warn"
                const isSuccess = entry.level === "success"

                return (
                  <div
                    key={entry.id}
                    className={cn(
                      "flex flex-wrap items-baseline gap-x-1.5 rounded px-1.5 py-0.5 transition-colors sm:gap-x-2",
                      isCrit
                        ? "border-l-2 border-red-500 bg-red-500/10 font-medium text-red-700 dark:bg-red-950/40 dark:text-red-300"
                        : isWarn
                          ? "border-l-2 border-amber-500 bg-amber-500/10 text-amber-800 dark:bg-amber-950/30 dark:text-amber-300"
                          : "text-foreground/90 hover:bg-muted/30"
                    )}
                  >
                    {/* Timestamp */}
                    <span className="shrink-0 text-[10px] text-muted-foreground/70 sm:text-[11px]">
                      [{entry.timestamp}]
                    </span>

                    {/* Level Badge */}
                    <span
                      className={cn(
                        "py-0.2 shrink-0 rounded px-1 text-[8.5px] font-bold uppercase sm:text-[9px]",
                        isCrit
                          ? "border border-red-500/30 bg-red-500/15 text-red-700 dark:border-red-500/40 dark:bg-red-500/20 dark:text-red-400"
                          : isWarn
                            ? "border border-amber-500/30 bg-amber-500/15 text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/20 dark:text-amber-400"
                            : isSuccess
                              ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                              : "bg-muted text-muted-foreground"
                      )}
                    >
                      {entry.level}
                    </span>

                    {/* Node Name & IP */}
                    <button
                      type="button"
                      onClick={() => handleSelectNode(entry.nodeId)}
                      className="shrink-0 cursor-pointer font-semibold text-foreground/85 hover:underline"
                    >
                      [{entry.nodeName}
                      <span className="hidden sm:inline">
                        {" "}
                        @ {entry.nodeIp}
                      </span>
                      ]
                    </button>

                    {/* Category */}
                    <span className="hidden text-[9.5px] text-muted-foreground/60 uppercase sm:inline">
                      ({entry.category})
                    </span>

                    {/* Message */}
                    <span className="min-w-0 flex-1 break-words">
                      {entry.message}
                    </span>
                  </div>
                )
              })}
            </div>
          )
        )}
      </div>
    </div>
  )
}
