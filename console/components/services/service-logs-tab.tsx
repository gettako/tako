"use client"

import * as React from "react"
import {
  ArrowDown,
  Check,
  Copy,
  Download,
  Pause,
  Play,
  Search,
  ScrollText,
  Trash2,
  X,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  SearchableSelect,
  type SelectOption,
} from "@/components/ui/searchable-select"
import { apiGet } from "@/lib/api"
import { copyToClipboard } from "@/lib/clipboard"
import { cn } from "@/lib/utils"
import type { ProjectService } from "@/types/platform"

type ServiceLogLevel = "info" | "warn" | "error"

interface ServiceLogEntry {
  id: string
  timestamp: string
  level: ServiceLogLevel
  container: string
  message: string
}

interface ServiceLogsTabProps {
  service: ProjectService
}

const MAX_LOG_ENTRIES = 500
const STREAM_INTERVAL_MS = 2500

function formatTimestamp(date: Date) {
  const pad = (value: number) => value.toString().padStart(2, "0")
  const padMs = (value: number) => value.toString().padStart(3, "0")

  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}.${padMs(date.getMilliseconds())}`
}

function parseRawContainerLogs(
  rawText: string,
  containerName: string
): ServiceLogEntry[] {
  if (!rawText || !rawText.trim()) return []
  const lines = rawText.split("\n").filter((l) => l.trim().length > 0)
  return lines.map((line, idx) => {
    let timestamp = formatTimestamp(new Date())
    let message = line
    const match = line.match(/^\[(.*?)\]\s*(.*)$/)
    if (match) {
      timestamp = match[1]
      message = match[2]
    }

    let level: ServiceLogLevel = "info"
    if (/(error|failed|fatal|panic|exception)/i.test(line)) {
      level = "error"
    } else if (/(warn|warning)/i.test(line)) {
      level = "warn"
    }

    return {
      id: `real-log-${idx}-${line.slice(0, 16)}`,
      timestamp,
      level,
      container: containerName,
      message,
    }
  })
}

function getContainerNames(service: ProjectService) {
  const main = `tako_${service.slug}`

  return {
    main,
    sidecar: `${main}_sidecar`,
  }
}

function createInitialLogs(service: ProjectService): ServiceLogEntry[] {
  const { main, sidecar } = getContainerNames(service)
  const port = service.portMappings[0]?.container ?? 3000
  const protocol = service.portMappings[0]?.protocol ?? "tcp"
  const now = Date.now()

  const entry = (
    offsetMs: number,
    level: ServiceLogLevel,
    container: string,
    message: string
  ): ServiceLogEntry => ({
    id: `log-init-${service.id}-${offsetMs}`,
    timestamp: formatTimestamp(new Date(now - offsetMs)),
    level,
    container,
    message,
  })

  if (service.status === "failed") {
    return [
      entry(
        3200,
        "error",
        main,
        `Container ${main} exited with code 1 after repeated health check failures.`
      ),
      entry(
        2100,
        "error",
        main,
        "RuntimeError: upstream probe GET /healthz timed out after 3000ms."
      ),
      entry(
        900,
        "warn",
        main,
        `Restart policy "${service.restartPolicy}" is holding the container in a failed state.`
      ),
    ]
  }

  if (service.status === "stopped") {
    return [
      entry(
        2600,
        "info",
        main,
        `Container ${main} stopped with SIGTERM (exit code 0).`
      ),
      entry(
        1400,
        "info",
        sidecar,
        "Log stream attached to the last known container state."
      ),
      entry(
        400,
        "warn",
        main,
        "Service is stopped; log stream is idle until the container starts."
      ),
    ]
  }

  if (service.status === "deploying") {
    return [
      entry(
        2400,
        "info",
        main,
        `Pulling image layers for ${service.name} on ${service.targetNodeId}.`
      ),
      entry(
        1500,
        "info",
        main,
        "Creating container and applying resource limits."
      ),
      entry(
        600,
        "info",
        sidecar,
        "Waiting for readiness probe before the log stream goes live."
      ),
    ]
  }

  return [
    entry(
      4200,
      "info",
      main,
      `Container ${main} started with ${service.metrics.memoryLimitMb}MB memory limit.`
    ),
    entry(
      3100,
      "info",
      main,
      `Runtime listening on 0.0.0.0:${port}/${protocol}.`
    ),
  ]
}

export function ServiceLogsTab({ service }: ServiceLogsTabProps) {
  const [logs, setLogs] = React.useState<ServiceLogEntry[]>(() =>
    createInitialLogs(service)
  )
  const [isStreaming, setIsStreaming] = React.useState(true)
  const [containerFilter, setContainerFilter] = React.useState("all")
  const [levelFilter, setLevelFilter] = React.useState<string>("all")
  const [searchQuery, setSearchQuery] = React.useState("")
  const [autoScroll, setAutoScroll] = React.useState(true)
  const [copied, setCopied] = React.useState(false)

  const logContainerRef = React.useRef<HTMLDivElement>(null)

  const { main, sidecar } = getContainerNames(service)
  const canStream = service.status === "running"
  const streamActive = isStreaming && canStream

  const containerOptions: SelectOption[] = React.useMemo(
    () => [
      { value: "all", label: "All containers" },
      { value: main, label: main },
      { value: sidecar, label: sidecar },
    ],
    [main, sidecar]
  )

  const fetchRealLogs = React.useCallback(async () => {
    try {
      const targetContainer = containerFilter === "all" ? main : containerFilter
      const res = await apiGet<{ logs: string }>(
        `/services/${service.id}/container-logs?containerName=${encodeURIComponent(targetContainer)}`
      )
      if (res && typeof res.logs === "string" && res.logs.trim().length > 0) {
        const parsed = parseRawContainerLogs(res.logs, targetContainer)
        if (parsed.length > 0) {
          setLogs(parsed.slice(-MAX_LOG_ENTRIES))
        }
      }
    } catch {
      // Retain existing log state on temporary network blips
    }
  }, [service.id, containerFilter, main])

  // Initial fetch on mount or service change
  React.useEffect(() => {
    const timer = setTimeout(() => {
      void fetchRealLogs()
    }, 50)
    return () => clearTimeout(timer)
  }, [service.id, fetchRealLogs])

  // Periodic poll from real container endpoint when streaming is active
  React.useEffect(() => {
    if (!streamActive) return

    const interval = setInterval(() => {
      void fetchRealLogs()
    }, STREAM_INTERVAL_MS)

    return () => clearInterval(interval)
  }, [streamActive, fetchRealLogs])

  const filteredLogs = React.useMemo(() => {
    return logs.filter((entry) => {
      if (levelFilter !== "all" && entry.level !== levelFilter) return false
      if (containerFilter !== "all" && entry.container !== containerFilter) {
        return false
      }

      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase()
        const text =
          `${entry.timestamp} ${entry.container} ${entry.message}`.toLowerCase()

        if (!text.includes(query)) return false
      }

      return true
    })
  }, [logs, levelFilter, containerFilter, searchQuery])

  React.useEffect(() => {
    if (!autoScroll) return

    const node = logContainerRef.current
    if (!node) return

    const frame = requestAnimationFrame(() => {
      node.scrollTop = node.scrollHeight
    })

    return () => cancelAnimationFrame(frame)
  }, [filteredLogs, autoScroll])

  const formatLogLine = (entry: ServiceLogEntry) =>
    `[${entry.timestamp}] ${entry.level.toUpperCase()} [${entry.container}] ${entry.message}`

  const copyLogs = async () => {
    const content = filteredLogs.map(formatLogLine).join("\n")

    if (await copyToClipboard(content)) {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const downloadLogs = () => {
    const content = filteredLogs.map(formatLogLine).join("\n")
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement("a")

    anchor.href = url
    anchor.download = `${service.slug}-logs.txt`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  const clearLogs = () => setLogs([])

  return (
    <div className="flex h-[560px] w-full flex-col overflow-hidden rounded-xl border border-border/80 bg-card/80 shadow-lg backdrop-blur-md">
      <div className="flex flex-col gap-2 border-b border-border/80 bg-muted/40 px-3 py-2 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex items-center gap-2">
          <ScrollText className="size-4 text-primary" />
          <span className="font-mono text-xs font-bold tracking-tight text-foreground">
            SERVICE LOG STREAM
          </span>
          <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
            {filteredLogs.length} lines
          </span>
          <span
            className={cn(
              "flex size-1.5 rounded-full",
              streamActive ? "animate-pulse bg-emerald-500" : "bg-amber-500"
            )}
          />
          <span className="font-mono text-[10px] text-muted-foreground uppercase">
            {streamActive ? "live" : canStream ? "paused" : "idle"}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
          <div className="w-40 sm:w-56">
            <SearchableSelect
              options={containerOptions}
              value={containerFilter}
              onChange={setContainerFilter}
              placeholder="Filter container..."
              searchPlaceholder="Search container..."
              size="sm"
            />
          </div>

          <div className="flex items-center rounded-md border border-border/70 bg-background/80 p-0.5">
            {["all", "error", "warn", "info"].map((level) => (
              <button
                key={level}
                type="button"
                onClick={() => setLevelFilter(level)}
                className={cn(
                  "rounded px-2 py-0.5 text-[11px] font-medium uppercase transition-colors",
                  levelFilter === level
                    ? level === "error"
                      ? "bg-red-500 font-bold text-white"
                      : level === "warn"
                        ? "bg-amber-500 font-bold text-white"
                        : "bg-primary font-semibold text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {level}
              </button>
            ))}
          </div>

          <div className="relative flex items-center">
            <Search className="pointer-events-none absolute left-2 size-3 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search logs..."
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              className="h-7 w-32 rounded border-border/70 bg-background/80 pr-6 pl-6.5 font-mono text-[11px] text-foreground shadow-2xs placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-ring sm:w-44"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-1.5 flex size-4 items-center justify-center rounded-xs text-muted-foreground hover:text-foreground"
                aria-label="Clear search"
              >
                <X className="size-3" />
              </button>
            )}
          </div>

          <Button
            size="sm"
            variant={autoScroll ? "default" : "outline"}
            onClick={() => setAutoScroll((previous) => !previous)}
            className="h-7 gap-1 px-2 text-[11px]"
            title={autoScroll ? "Auto-scroll active" : "Auto-scroll paused"}
          >
            <ArrowDown className="size-3" />
            <span className="hidden sm:inline">Scroll</span>
          </Button>

          <Button
            size="sm"
            variant="outline"
            disabled={!canStream}
            onClick={() => setIsStreaming((previous) => !previous)}
            className="h-7 gap-1 px-2 text-[11px]"
            title={
              canStream
                ? isStreaming
                  ? "Pause log stream"
                  : "Resume log stream"
                : "Service is not running"
            }
          >
            {isStreaming && canStream ? (
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

          <Button
            size="icon-xs"
            variant="ghost"
            onClick={copyLogs}
            disabled={filteredLogs.length === 0}
            className="size-7 text-muted-foreground hover:text-foreground"
            title="Copy visible logs"
            aria-label="Copy visible logs"
          >
            {copied ? (
              <Check className="size-3 text-emerald-500" />
            ) : (
              <Copy className="size-3" />
            )}
          </Button>

          <Button
            size="icon-xs"
            variant="ghost"
            onClick={downloadLogs}
            disabled={filteredLogs.length === 0}
            className="size-7 text-muted-foreground hover:text-foreground"
            title="Download visible logs"
            aria-label="Download visible logs"
          >
            <Download className="size-3" />
          </Button>

          <Button
            size="icon-xs"
            variant="ghost"
            onClick={clearLogs}
            className="size-7 text-muted-foreground hover:text-foreground"
            title="Clear log buffer"
            aria-label="Clear log buffer"
          >
            <Trash2 className="size-3" />
          </Button>
        </div>
      </div>

      <div
        ref={logContainerRef}
        className="min-h-0 flex-1 [scrollbar-gutter:stable] overflow-y-auto p-3 font-mono text-[11.5px] leading-relaxed select-text"
      >
        {filteredLogs.length === 0 ? (
          <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
            No service logs matching the current filter.
          </div>
        ) : (
          <div className="space-y-1">
            {filteredLogs.map((entry) => {
              const isError = entry.level === "error"
              const isWarn = entry.level === "warn"
              const containerLabel =
                entry.container === sidecar ? "sidecar" : "main"

              return (
                <div
                  key={entry.id}
                  className={cn(
                    "flex flex-wrap items-baseline gap-x-2 rounded px-1.5 py-0.5 transition-colors",
                    isError
                      ? "border-l-2 border-red-500 bg-red-500/10 font-medium text-red-700 dark:bg-red-950/40 dark:text-red-300"
                      : isWarn
                        ? "border-l-2 border-amber-500 bg-amber-500/10 text-amber-800 dark:bg-amber-950/30 dark:text-amber-300"
                        : "text-foreground/90 hover:bg-muted/30"
                  )}
                >
                  <span className="shrink-0 text-muted-foreground/70">
                    [{entry.timestamp}]
                  </span>

                  <span
                    className={cn(
                      "shrink-0 rounded px-1 text-[9px] font-bold uppercase",
                      isError
                        ? "border border-red-500/30 bg-red-500/15 text-red-700 dark:border-red-500/40 dark:bg-red-500/20 dark:text-red-400"
                        : isWarn
                          ? "border border-amber-500/30 bg-amber-500/15 text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/20 dark:text-amber-400"
                          : "bg-muted text-muted-foreground"
                    )}
                  >
                    {entry.level}
                  </span>

                  <span
                    className="shrink-0 rounded bg-muted px-1 text-[9px] font-semibold text-muted-foreground uppercase"
                    title={entry.container}
                  >
                    {containerLabel}
                  </span>

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
