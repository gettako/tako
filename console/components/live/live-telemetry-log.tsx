import * as React from "react"
import {
  ArrowDown,
  Pause,
  Play,
  Search,
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
import { ClusterNode } from "@/types/platform"
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

interface LiveTelemetryLogProps {
  nodes: ClusterNode[]
  isStreaming: boolean
  onToggleStreaming: () => void
  selectedNodeId?: string | null
  onSelectNode?: (id: string | null) => void
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
    generate: (_node: ClusterNode) =>
      `Egress burst report: ${(Math.random() * 80 + 120).toFixed(1)} MB/s cumulative TX, 0 dropped frames.`,
  },
  {
    category: "container" as const,
    level: "info" as const,
    generate: (node: ClusterNode) =>
      `Container daemon report: ${node.runningContainers} healthy containers active on Docker ${node.dockerVersion}.`,
  },
]

function getTimestamp() {
  const d = new Date()
  const pad = (n: number) => n.toString().padStart(2, "0")
  const padMs = (n: number) => n.toString().padStart(3, "0")
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${padMs(d.getMilliseconds())}`
}

function createInitialLogs(nodes: ClusterNode[]): TelemetryLogEntry[] {
  return [
    {
      id: "log-init-1",
      timestamp: getTimestamp(),
      nodeId: nodes[0]?.id || "node-master",
      nodeName: nodes[0]?.name || "tako-master-sg01",
      nodeIp: nodes[0]?.ipAddress || "142.250.190.46",
      level: "success",
      category: "grpc",
      message:
        "Master cluster orchestrator initialized. gRPC reverse transport listening on :50051.",
    },
    {
      id: "log-init-2",
      timestamp: getTimestamp(),
      nodeId: nodes[1]?.id || "node-worker-jp",
      nodeName: nodes[1]?.name || "tako-worker-tyo02",
      nodeIp: nodes[1]?.ipAddress || "35.200.114.88",
      level: "info",
      category: "network",
      message:
        "Reverse tunnel established to Singapore Master Hub. mTLS handshake verified with Tako CA.",
    },
  ]
}

export function LiveTelemetryLog({
  nodes,
  isStreaming,
  onToggleStreaming,
  selectedNodeId,
  onSelectNode,
}: LiveTelemetryLogProps) {
  const [logs, setLogs] = React.useState<TelemetryLogEntry[]>([])
  const didSeedLogs = React.useRef(false)
  const [filterLevel, setFilterLevel] = React.useState<string>("all")
  const [internalFilterNode, setInternalFilterNode] =
    React.useState<string>("all")
  const [searchQuery, setSearchQuery] = React.useState<string>("")
  const [autoScroll, setAutoScroll] = React.useState<boolean>(true)
  const logContainerRef = React.useRef<HTMLDivElement>(null)

  // Seed the initial entries after hydration so timestamps never differ
  // between the server render and the first client render.
  React.useEffect(() => {
    if (didSeedLogs.current || nodes.length === 0) return

    didSeedLogs.current = true
    setLogs(createInitialLogs(nodes))
  }, [nodes])

  // Derive active filter node without cascading renders
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

  // Periodic telemetry generation
  React.useEffect(() => {
    if (!isStreaming || nodes.length === 0) return

    const interval = setInterval(() => {
      // Pick random node
      const randomNode = nodes[Math.floor(Math.random() * nodes.length)]
      if (!randomNode) return

      let newEntry: TelemetryLogEntry

      if (randomNode.status === "offline") {
        // Emit critical alert for dead nodes
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
        // Normal random telemetry
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
        // Keep max 250 log entries in ring buffer
        const next = [...prev, newEntry]
        if (next.length > 250) {
          return next.slice(next.length - 250)
        }
        return next
      })
    }, 1100)

    return () => clearInterval(interval)
  }, [isStreaming, nodes])

  // Auto-scroll handler
  React.useEffect(() => {
    if (autoScroll && logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight
    }
  }, [logs, autoScroll])

  const filteredLogs = React.useMemo(() => {
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

  const clearLogs = () => setLogs([])

  return (
    <div className="flex h-full w-full flex-col overflow-hidden rounded-xl border border-border/80 bg-card/80 shadow-lg backdrop-blur-md">
      {/* Terminal Header Toolbar */}
      <div className="flex flex-col gap-2 border-b border-border/80 bg-muted/40 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Terminal className="size-4 text-primary" />
          <span className="font-mono text-xs font-bold tracking-tight text-foreground">
            LIVE TELEMETRY STREAM
          </span>
          <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
            {filteredLogs.length} events
          </span>
          <span
            className={cn(
              "flex size-1.5 rounded-full",
              isStreaming ? "animate-pulse bg-emerald-500" : "bg-amber-500"
            )}
          />
        </div>

        {/* Action Controls & Filters */}
        <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
          {/* Level Filter */}
          <div className="flex items-center rounded-md border border-border/70 bg-background/80 p-0.5">
            {["all", "critical", "warn", "info"].map((level) => (
              <button
                key={level}
                type="button"
                onClick={() => setFilterLevel(level)}
                className={cn(
                  "rounded px-2 py-0.5 text-[11px] font-medium uppercase transition-colors",
                  filterLevel === level
                    ? level === "critical"
                      ? "bg-red-500 font-bold text-white"
                      : "bg-primary font-semibold text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {level}
              </button>
            ))}
          </div>

          {/* Node Filter with Shadcn SearchableSelect */}
          <div className="w-44 sm:w-56">
            <SearchableSelect
              options={nodeOptions}
              value={activeFilterNode}
              onChange={handleSelectNode}
              placeholder="Filter by node..."
              searchPlaceholder="Search cluster node..."
              size="sm"
            />
          </div>

          {/* Search Filter with Shadcn Input */}
          <div className="relative flex items-center">
            <Search className="pointer-events-none absolute left-2 size-3 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Filter log..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-7 w-32 rounded border-border/70 bg-background/80 pr-6 pl-6.5 font-mono text-[11px] text-foreground shadow-2xs placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-ring sm:w-44"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-1.5 flex size-4 items-center justify-center rounded-xs text-muted-foreground hover:text-foreground"
                aria-label="Clear filter"
              >
                <X className="size-3" />
              </button>
            )}
          </div>

          {/* Auto-scroll toggle */}
          <Button
            size="sm"
            variant={autoScroll ? "default" : "outline"}
            onClick={() => setAutoScroll((prev) => !prev)}
            className="h-7 gap-1 px-2 text-[11px]"
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
            className="h-7 gap-1 px-2 text-[11px]"
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
            className="size-7 text-muted-foreground hover:text-foreground"
            title="Clear buffer"
            aria-label="Clear log buffer"
          >
            <Trash2 className="size-3" />
          </Button>
        </div>
      </div>

      {/* Terminal Output Area */}
      <div
        ref={logContainerRef}
        className="flex-1 [scrollbar-gutter:stable] overflow-y-auto p-3 font-mono text-[11.5px] leading-relaxed select-text"
      >
        {filteredLogs.length === 0 ? (
          <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
            No telemetry events matching current filter.
          </div>
        ) : (
          <div className="space-y-1">
            {filteredLogs.map((entry) => {
              const isCrit = entry.level === "critical"
              const isWarn = entry.level === "warn"
              const isSuccess = entry.level === "success"

              return (
                <div
                  key={entry.id}
                  className={cn(
                    "flex flex-wrap items-baseline gap-x-2 rounded px-1.5 py-0.5 transition-colors",
                    isCrit
                      ? "border-l-2 border-red-500 bg-red-500/10 font-medium text-red-700 dark:bg-red-950/40 dark:text-red-300"
                      : isWarn
                        ? "border-l-2 border-amber-500 bg-amber-500/10 text-amber-800 dark:bg-amber-950/30 dark:text-amber-300"
                        : "text-foreground/90 hover:bg-muted/30"
                  )}
                >
                  {/* Timestamp */}
                  <span className="shrink-0 text-muted-foreground/70">
                    [{entry.timestamp}]
                  </span>

                  {/* Level Badge */}
                  <span
                    className={cn(
                      "py-0.2 shrink-0 rounded px-1 text-[9px] font-bold uppercase",
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
                  <span className="shrink-0 font-semibold text-foreground/85">
                    [{entry.nodeName} @ {entry.nodeIp}]
                  </span>

                  {/* Category */}
                  <span className="text-[10px] text-muted-foreground/60 uppercase">
                    ({entry.category})
                  </span>

                  {/* Message */}
                  <span className="break-all">{entry.message}</span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
