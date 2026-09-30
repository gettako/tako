"use client"

import * as React from "react"
import {
  MagnifyingGlass,
  Pause,
  Play,
  Copy,
  Check,
  Trash,
  X,
  TerminalWindow,
} from "@phosphor-icons/react"
import { Button } from "@/components/ui/button"
import { cn } from "cn"
import { useCopyToClipboard } from "@/hooks/use-copy-to-clipboard"
import type { BuildLogStreamEvent, ContainerLogEvent } from "@/lib/api"

export type LogItem = string | BuildLogStreamEvent | ContainerLogEvent

export interface ParsedLogEntry {
  id: string
  raw: string
  timestamp?: string
  stream: "stdout" | "stderr"
  isStepHeader?: boolean
  stepNumber?: string
  stepTitle?: string
  stepStatus?: "pending" | "running" | "success" | "failed"
  isComplete?: boolean
  completeStatus?: "success" | "failed"
}

export interface LogViewerProps {
  logs?: LogItem[]
  stream?: AsyncIterable<LogItem>
  isLoading?: boolean
  emptyMessage?: string
  title?: string
  className?: string
  maxBuffer?: number
  showLineNumbers?: boolean
  onClear?: () => void
  initialRegexMode?: boolean
  initialSearchQuery?: string
}

function parseLogItem(item: LogItem, index: number): ParsedLogEntry {
  if (typeof item === "string") {
    return {
      id: `line-${index}`,
      raw: item,
      stream: "stdout",
    }
  }

  if ("event" in item) {
    if (item.event === "build_step") {
      return {
        id: `step-${item.step}-${index}`,
        raw: `Step ${item.step}: ${item.title} (${item.status})`,
        stream: "stdout",
        isStepHeader: true,
        stepNumber: item.step,
        stepTitle: item.title,
        stepStatus: item.status,
      }
    }

    if (item.event === "build_log") {
      return {
        id: `build-log-${index}`,
        raw: item.line,
        timestamp: item.timestamp,
        stream: item.stream,
      }
    }

    if (item.event === "build_complete") {
      const raw =
        item.status === "success"
          ? `Build completed successfully in ${item.duration_seconds}s${
              item.image_tag ? ` (${item.image_tag})` : ""
            }`
          : `Build failed after ${item.duration_seconds}s${
              item.error ? `: ${item.error}` : ""
            }`
      return {
        id: `build-complete-${index}`,
        raw,
        stream: item.status === "failed" ? "stderr" : "stdout",
        isComplete: true,
        completeStatus: item.status,
      }
    }
  }

  if ("container_id" in item) {
    return {
      id: `container-log-${index}`,
      raw: item.line,
      timestamp: item.timestamp,
      stream: item.stream,
    }
  }

  return {
    id: `raw-${index}`,
    raw: JSON.stringify(item),
    stream: "stdout",
  }
}

function formatTimestamp(timestamp: string): string {
  try {
    const date = new Date(timestamp)
    if (isNaN(date.getTime())) return timestamp
    return date.toISOString().slice(11, 23)
  } catch {
    return timestamp
  }
}

function renderHighlightedText(
  text: string,
  query: string,
  isRegex: boolean = false,
  isInvalidRegex: boolean = false
) {
  if (!query.trim()) return text
  if (isRegex && isInvalidRegex) return text

  let regex: RegExp
  try {
    regex = isRegex
      ? new RegExp(query, "gi")
      : new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi")
  } catch {
    return text
  }

  const segments: React.ReactNode[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = regex.exec(text)) !== null) {
    if (match[0].length === 0) {
      regex.lastIndex++
      if (regex.lastIndex > text.length) break
      continue
    }

    const matchStart = match.index
    const matchEnd = matchStart + match[0].length

    if (matchStart > lastIndex) {
      segments.push(text.slice(lastIndex, matchStart))
    }

    segments.push(
      <mark
        key={`m-${matchStart}-${matchEnd}`}
        className="rounded bg-yellow-200/60 px-0.5 text-inherit dark:bg-yellow-400/20"
      >
        {match[0]}
      </mark>
    )

    lastIndex = matchEnd
  }

  if (lastIndex < text.length) {
    segments.push(text.slice(lastIndex))
  }

  return segments.length > 0 ? <>{segments}</> : text
}

export function LogViewer({
  logs = [],
  stream,
  isLoading = false,
  emptyMessage = "No logs received yet",
  title = "Console Output",
  className,
  maxBuffer = 5000,
  showLineNumbers = true,
  onClear,
  initialRegexMode = false,
  initialSearchQuery = "",
}: LogViewerProps) {
  const [streamEntries, setStreamEntries] = React.useState<ParsedLogEntry[]>([])
  const [cleared, setCleared] = React.useState(false)
  const [isFollowing, setIsFollowing] = React.useState(true)
  const [searchQuery, setSearchQuery] = React.useState(initialSearchQuery)
  const [debouncedQuery, setDebouncedQuery] = React.useState(initialSearchQuery)
  const [isRegexMode, setIsRegexMode] = React.useState(initialRegexMode)
  const [isInvalidRegex, setIsInvalidRegex] = React.useState(() => {
    if (!initialRegexMode || !initialSearchQuery.trim()) return false
    try {
      new RegExp(initialSearchQuery, "i")
      return false
    } catch {
      return true
    }
  })
  const { copy: copyLogs, isCopied: copied } = useCopyToClipboard(2000)

  const containerRef = React.useRef<HTMLDivElement>(null)
  const scrollRef = React.useRef<HTMLDivElement>(null)
  const searchInputRef = React.useRef<HTMLInputElement>(null)

  // Compute active entries
  const entries = React.useMemo(() => {
    if (cleared) return []
    if (stream) return streamEntries
    return logs.map((item, index) => parseLogItem(item, index))
  }, [cleared, stream, streamEntries, logs])

  // Consume stream when provided
  React.useEffect(() => {
    if (!stream) return

    let cancelled = false
    let lineCounter = 0

    async function consumeStream() {
      try {
        for await (const item of stream!) {
          if (cancelled) break
          const parsed = parseLogItem(item, lineCounter++)
          setCleared(false)
          setStreamEntries((prev) => {
            const next = [...prev, parsed]
            if (next.length > maxBuffer) {
              return next.slice(next.length - maxBuffer)
            }
            return next
          })
        }
      } catch (err) {
        if (!cancelled) {
          console.error("Log stream error:", err)
        }
      }
    }

    consumeStream()

    return () => {
      cancelled = true
    }
  }, [stream, maxBuffer])

  // Auto-scroll to bottom when following
  React.useEffect(() => {
    if (isFollowing && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [entries.length, isFollowing])

  // Scroll listener: pause follow when scrolling up, resume when scrolled to bottom
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget
    const threshold = 30
    const isAtBottom =
      target.scrollHeight - target.scrollTop - target.clientHeight <= threshold

    if (!isAtBottom && isFollowing) {
      setIsFollowing(false)
    } else if (isAtBottom && !isFollowing) {
      setIsFollowing(true)
    }
  }

  // Keyboard shortcut Ctrl+F / Cmd+F to focus search
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const container = containerRef.current
      if (!container) return

      const isInside =
        container.contains(document.activeElement) ||
        document.activeElement === document.body

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "f" && isInside) {
        e.preventDefault()
        searchInputRef.current?.focus()
        searchInputRef.current?.select()
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [])

  // Debounce regex pattern evaluation at 150ms
  React.useEffect(() => {
    if (!isRegexMode) return

    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery)
      if (!searchQuery.trim()) {
        setIsInvalidRegex(false)
        return
      }
      try {
        new RegExp(searchQuery, "i")
        setIsInvalidRegex(false)
      } catch {
        setIsInvalidRegex(true)
      }
    }, 150)

    return () => clearTimeout(timer)
  }, [searchQuery, isRegexMode])

  const handleToggleRegex = () => {
    setIsRegexMode((prev) => {
      const next = !prev
      if (next) {
        setDebouncedQuery(searchQuery)
        if (searchQuery.trim()) {
          try {
            new RegExp(searchQuery, "i")
            setIsInvalidRegex(false)
          } catch {
            setIsInvalidRegex(true)
          }
        } else {
          setIsInvalidRegex(false)
        }
      } else {
        setIsInvalidRegex(false)
        setDebouncedQuery(searchQuery)
      }
      return next
    })
  }

  const filteredEntries = React.useMemo(() => {
    if (!searchQuery.trim()) return entries

    if (isRegexMode) {
      if (isInvalidRegex) {
        return entries
      }
      const pattern = debouncedQuery.trim()
      if (!pattern) return entries
      try {
        const regex = new RegExp(pattern, "i")
        return entries.filter((e) => regex.test(e.raw))
      } catch {
        return entries
      }
    }

    const q = searchQuery.toLowerCase()
    return entries.filter((e) => e.raw.toLowerCase().includes(q))
  }, [entries, searchQuery, isRegexMode, isInvalidRegex, debouncedQuery])

  const handleToggleFollow = () => {
    const next = !isFollowing
    setIsFollowing(next)
    if (next && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }

  const handleCopy = async () => {
    const content = filteredEntries.map((e) => e.raw).join("\n")
    await copyLogs(content)
  }

  const handleClear = () => {
    setCleared(true)
    setStreamEntries([])
    if (onClear) {
      onClear()
    }
  }

  const getStreamColor = (entry: ParsedLogEntry) => {
    if (entry.isStepHeader) {
      return "text-sky-700 dark:text-sky-400 font-semibold"
    }
    if (entry.isComplete) {
      return entry.completeStatus === "failed"
        ? "text-red-700 dark:text-red-400 font-semibold"
        : "text-emerald-700 dark:text-emerald-400 font-semibold"
    }
    if (entry.stream === "stderr") {
      return "text-red-600 dark:text-red-400"
    }
    return "text-foreground"
  }

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      data-slot="log-viewer"
      className={cn(
        "relative flex flex-col overflow-hidden rounded-lg border border-border bg-card text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        className
      )}
    >
      {/* Integrated Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-muted/40 px-3 py-2 text-xs select-none">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-1.5">
            <span
              className={cn(
                "size-2 rounded-full",
                isLoading || (stream && isFollowing)
                  ? "animate-pulse bg-emerald-500"
                  : "bg-muted-foreground"
              )}
              aria-hidden="true"
            />
            <span className="font-heading font-medium text-foreground">
              {title}
            </span>
          </div>

          <span className="text-muted-foreground" aria-hidden="true">
            /
          </span>

          <span className="font-mono text-2xs text-muted-foreground">
            {searchQuery
              ? `${filteredEntries.length} of ${entries.length} lines`
              : `${entries.length} lines`}
          </span>
        </div>

        {/* Toolbar Controls */}
        <div className="flex items-center gap-2">
          {/* Search Filter + Regex Toggle */}
          <div className="relative flex items-center gap-1.5">
            <div className="relative flex flex-col">
              <div className="relative flex items-center">
                <MagnifyingGlass
                  className="pointer-events-none absolute left-2.5 size-3.5 text-muted-foreground"
                  aria-hidden="true"
                />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") {
                      if (searchQuery) {
                        setSearchQuery("")
                        setIsInvalidRegex(false)
                        e.stopPropagation()
                      } else {
                        searchInputRef.current?.blur()
                      }
                    }
                  }}
                  placeholder="Filter logs... (Ctrl+F)"
                  aria-invalid={
                    isRegexMode && isInvalidRegex ? "true" : undefined
                  }
                  className={cn(
                    "h-7 w-32 rounded border bg-background pr-6 pl-7 font-mono text-xs text-foreground transition-colors outline-none placeholder:text-muted-foreground sm:w-44",
                    isRegexMode
                      ? isInvalidRegex
                        ? "border-status-error-border focus:border-status-error-border"
                        : "border-status-building-border focus:border-status-building-border"
                      : "border-border focus:border-ring"
                  )}
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery("")
                      setIsInvalidRegex(false)
                    }}
                    className="absolute right-1.5 p-0.5 text-muted-foreground hover:text-foreground"
                    aria-label="Clear filter"
                  >
                    <X className="size-3" />
                  </button>
                )}
              </div>
              {isRegexMode && isInvalidRegex && (
                <span
                  role="alert"
                  className="absolute top-full left-0 z-10 mt-0.5 font-mono text-3xs font-medium whitespace-nowrap text-status-error-text select-none"
                >
                  Invalid regex
                </span>
              )}
            </div>

            {/* Regex Mode Toggle */}
            <Button
              type="button"
              variant="outline"
              size="xs"
              onClick={handleToggleRegex}
              aria-label="Toggle regex search"
              aria-pressed={isRegexMode}
              className={cn(
                "h-7 min-w-7 border-border bg-transparent px-1.5 font-mono text-xs font-semibold transition-colors",
                isRegexMode
                  ? "border-status-building-border bg-status-building-bg text-status-building-text hover:bg-status-building-bg/80"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              .*
            </Button>
          </div>

          {/* Autoscroll Follow/Pause Toggle */}
          <Button
            type="button"
            variant="outline"
            size="xs"
            onClick={handleToggleFollow}
            className={cn(
              "h-7 gap-1 border-border bg-transparent text-foreground hover:bg-muted",
              isFollowing &&
                "border-emerald-500/40 text-emerald-600 dark:text-emerald-400"
            )}
          >
            {isFollowing ? (
              <>
                <Pause className="size-3" />
                <span>Pause</span>
              </>
            ) : (
              <>
                <Play className="size-3" />
                <span>Follow</span>
              </>
            )}
          </Button>

          {/* Copy All */}
          <Button
            type="button"
            variant="outline"
            size="xs"
            onClick={handleCopy}
            disabled={entries.length === 0}
            className="h-7 gap-1 border-border bg-transparent text-foreground hover:bg-muted"
          >
            {copied ? (
              <>
                <Check className="size-3 text-emerald-500" />
                <span className="text-emerald-600 dark:text-emerald-400">
                  Copied!
                </span>
              </>
            ) : (
              <>
                <Copy className="size-3" />
                <span>Copy</span>
              </>
            )}
          </Button>

          {/* Clear */}
          <Button
            type="button"
            variant="outline"
            size="xs"
            onClick={handleClear}
            disabled={entries.length === 0}
            className="h-7 gap-1 border-border bg-transparent text-foreground hover:bg-muted"
          >
            <Trash className="size-3" />
            <span>Clear</span>
          </Button>
        </div>
      </div>

      {/* Terminal Viewport */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="relative max-h-150 min-h-75 flex-1 overflow-auto bg-card p-3 font-mono text-xs leading-relaxed text-foreground select-text"
      >
        {isLoading && entries.length === 0 ? (
          <div className="flex flex-col gap-2 p-2">
            <div className="h-3 w-3/4 animate-pulse rounded bg-muted" />
            <div className="h-3 w-1/2 animate-pulse rounded bg-muted" />
            <div className="h-3 w-5/6 animate-pulse rounded bg-muted" />
            <div className="h-3 w-2/3 animate-pulse rounded bg-muted" />
            <div className="h-3 w-4/5 animate-pulse rounded bg-muted" />
          </div>
        ) : filteredEntries.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
            <TerminalWindow className="mb-2 size-8 text-muted-foreground" />
            <p className="text-sm font-medium text-foreground">
              {searchQuery ? "No matching log lines found" : emptyMessage}
            </p>
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery("")
                  setIsInvalidRegex(false)
                }}
                className="mt-2 text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground"
              >
                Clear filter
              </button>
            )}
          </div>
        ) : (
          <div className="flex flex-col">
            {filteredEntries.map((entry, index) => (
              <div
                key={entry.id}
                className={cn(
                  "group flex items-start gap-2 rounded px-1 py-0.5 hover:bg-muted/40",
                  entry.isStepHeader &&
                    "my-1 border-l-2 border-sky-500 bg-sky-500/10 pl-2 text-sky-950 dark:text-sky-100",
                  entry.isComplete &&
                    (entry.completeStatus === "failed"
                      ? "my-1 border-l-2 border-red-500 bg-red-500/10 pl-2 text-red-950 dark:text-red-100"
                      : "my-1 border-l-2 border-emerald-500 bg-emerald-500/10 pl-2 text-emerald-950 dark:text-emerald-100")
                )}
              >
                {showLineNumbers && (
                  <span className="w-8 shrink-0 pr-2 text-right text-2xs text-muted-foreground/60 select-none">
                    {index + 1}
                  </span>
                )}
                {entry.timestamp && (
                  <span className="shrink-0 text-2xs text-muted-foreground select-none">
                    {formatTimestamp(entry.timestamp)}
                  </span>
                )}
                <div
                  className={cn(
                    "flex-1 break-all whitespace-pre-wrap",
                    getStreamColor(entry)
                  )}
                >
                  {renderHighlightedText(
                    entry.raw,
                    isRegexMode ? debouncedQuery : searchQuery,
                    isRegexMode,
                    isInvalidRegex
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
