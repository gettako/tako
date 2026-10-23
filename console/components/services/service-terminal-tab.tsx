"use client"

import * as React from "react"
import {
  Check,
  Copy,
  Loader2,
  Maximize2,
  Minimize2,
  RefreshCw,
  Terminal,
  Trash2,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  SearchableSelect,
  type SelectOption,
} from "@/components/ui/searchable-select"
import { getServiceContainers } from "@/lib/container"
import { ProjectService } from "@/types/platform"
import { copyToClipboard } from "@/lib/clipboard"
import { cn } from "@/lib/utils"

interface ServiceTerminalTabProps {
  service: ProjectService
  isMinimized?: boolean
  onToggleMinimize?: () => void
}

interface CommandOutput {
  id: string
  command: string
  output: string
  timestamp: string
  cwd?: string
}

const INITIAL_WELCOME: string[] = [
  "⚡️ Tako Terminal (x86_64-linux)",
  "Live interactive terminal session connected to container.",
  "Run commands directly inside container PTY session.",
]

function getPromptMeta(service: ProjectService, cwd: string = "/app") {
  return {
    user: "root",
    host: service.slug,
    cwd: cwd,
    branch: service.lastDeployment.branch || service.gitBranch || "main",
    commit: (service.lastDeployment.commitHash || "a087061").slice(0, 7),
  }
}

function TerminalPrompt({
  service,
  cwd = "/app",
  children,
}: {
  service: ProjectService
  cwd?: string
  children: React.ReactNode
}) {
  const meta = getPromptMeta(service, cwd)

  return (
    <div className="space-y-0.5 font-mono text-[12px]">
      <div className="flex flex-wrap items-center leading-none text-muted-foreground/60 select-none">
        <span>┌─[</span>
        <span className="font-semibold text-emerald-700 dark:text-emerald-400">
          {meta.user}
        </span>
        <span>@</span>
        <span className="font-semibold text-sky-700 dark:text-cyan-400">
          {meta.host}
        </span>
        <span>][</span>
        <span className="text-amber-700 dark:text-amber-300">{meta.cwd}</span>
        <span>] [</span>
        <span className="text-violet-700 dark:text-violet-300">
          {meta.branch}
        </span>
        <span className="ml-1 text-muted-foreground/80">{meta.commit}</span>
        <span>]</span>
      </div>

      <div className="flex items-center gap-2 text-foreground dark:text-zinc-200">
        <span className="text-muted-foreground/60 select-none">└─</span>
        <span className="text-primary select-none">➣</span>
        {children}
      </div>
    </div>
  )
}

export function ServiceTerminalTab({
  service,
  isMinimized: _isMinimized = false,
  onToggleMinimize: _onToggleMinimize,
}: ServiceTerminalTabProps) {
  const [isFullscreen, setIsFullscreen] = React.useState(false)
  const [shell, setShell] = React.useState<
    "/bin/sh" | "/bin/bash" | "/bin/zsh"
  >("/bin/sh")
  const containers = React.useMemo(
    () => getServiceContainers(service),
    [service]
  )
  const [preferredContainer, setPreferredContainer] = React.useState<string>(
    () => {
      const main = containers.find((container) => container.isMain)
      return main?.name ?? containers[0]?.name ?? `tako_${service.slug}`
    }
  )
  const selectedContainer = containers.some(
    (container) => container.name === preferredContainer
  )
    ? preferredContainer
    : (containers.find((container) => container.isMain)?.name ??
      containers[0]?.name ??
      `tako_${service.slug}`)

  const containerOptions: SelectOption[] = React.useMemo(
    () =>
      containers.map((container) => ({
        value: container.name,
        label: `${container.name}${container.isMain ? " (main)" : ""}`,
        description: `${container.ports.length} exposed port${container.ports.length === 1 ? "" : "s"}`,
      })),
    [containers]
  )

  const shellOptions: SelectOption[] = React.useMemo(
    () => [
      { value: "/bin/sh", label: "/bin/sh" },
      { value: "/bin/bash", label: "/bin/bash" },
      { value: "/bin/zsh", label: "/bin/zsh" },
    ],
    []
  )

  const [currentCwd, setCurrentCwd] = React.useState("/app")
  const [inputVal, setInputVal] = React.useState("")
  const [commandHistory, setCommandHistory] = React.useState<string[]>([])
  const [historyIndex, setHistoryIndex] = React.useState<number>(-1)
  const [historyList, setHistoryList] = React.useState<CommandOutput[]>([])
  const [copiedBuffer, setCopiedBuffer] = React.useState(false)
  const [isReconnecting, setIsReconnecting] = React.useState(false)
  const [isExecuting, setIsExecuting] = React.useState(false)
  const [wsConnected, setWsConnected] = React.useState(false)
  const [reconnectKey, setReconnectKey] = React.useState(0)
  const wsRef = React.useRef<WebSocket | null>(null)

  // Establish WebSocket connection to backend terminal when available
  React.useEffect(() => {
    if (typeof window === "undefined") return
    const token = localStorage.getItem("tako_token") || ""
    if (!token) return

    let protocol = window.location.protocol === "https:" ? "wss:" : "ws:"
    let host = window.location.host

    const customServer =
      process.env.NEXT_PUBLIC_TAKO_SERVER_URL ||
      localStorage.getItem("tako_server_url") ||
      ""

    if (customServer && customServer.trim()) {
      try {
        const parsed = new URL(customServer)
        host = parsed.host
        if (parsed.protocol === "https:") {
          protocol = "wss:"
        } else if (parsed.protocol === "http:") {
          protocol = "ws:"
        }
      } catch {
        // retain default host and protocol
      }
    } else if (
      window.location.port === "3000" ||
      window.location.port === "3001" ||
      window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1" ||
      /^192\.168\./.test(window.location.hostname) ||
      /^10\./.test(window.location.hostname) ||
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(window.location.hostname)
    ) {
      host = `${window.location.hostname}:8080`
    }
    const wsUrl = `${protocol}//${host}/api/v1/services/${service.id}/terminal?token=${encodeURIComponent(token)}&container=${encodeURIComponent(selectedContainer)}`

    let ws: WebSocket | null = null
    try {
      ws = new WebSocket(wsUrl)
      ws.onopen = () => {
        setWsConnected(true)
      }
      ws.onmessage = (event) => {
        const text = typeof event.data === "string" ? event.data : ""
        if (!text || text.includes("Error: service not found")) return

        const isDone = text.includes("__TAKO_EXEC_DONE__")
        let chunk = text
          .replace(/[\x00\r\n]*__TAKO_EXEC_DONE__[\x00\r\n]*/g, "")
          // eslint-disable-next-line no-control-regex
          .replace(/\x1b\[[0-9;?]*[a-zA-Z]/g, "")
          .replace(/\r/g, "")

        // Filter out trailing shell prompt symbols
        chunk = chunk.replace(/[\r\n]*#\s*$/, "")

        if (isDone) {
          setIsExecuting(false)
        }

        if (!chunk && !isDone) {
          return
        }

        setHistoryList((prev) => {
          if (prev.length === 0) {
            if (!chunk.trim()) return prev
            return [
              {
                id: `ws-${Date.now()}-${Math.random()}`,
                command: "",
                output: chunk.trim(),
                timestamp: new Date().toLocaleTimeString(),
                cwd: currentCwd,
              },
            ]
          }

          const last = prev[prev.length - 1]
          let updatedOutput = last.output
          if (chunk) {
            updatedOutput = updatedOutput ? `${updatedOutput}${chunk}` : chunk
          }

          return [
            ...prev.slice(0, -1),
            {
              ...last,
              output: updatedOutput,
            },
          ]
        })
      }
      ws.onerror = () => {
        setWsConnected(false)
        setIsExecuting(false)
      }
      ws.onclose = () => {
        setWsConnected(false)
        setIsExecuting(false)
      }
      wsRef.current = ws
    } catch {
      // WebSocket connection attempt failed
    }

    return () => {
      ws?.close()
      wsRef.current = null
    }
  }, [service.id, selectedContainer, currentCwd, reconnectKey])

  const terminalRef = React.useRef<HTMLDivElement>(null)
  const inputRef = React.useRef<HTMLInputElement>(null)

  // Auto-focus input when command execution finishes
  React.useEffect(() => {
    if (!isExecuting) {
      inputRef.current?.focus()
    }
  }, [isExecuting])

  // Safety fallback: reset isExecuting if no response after 35 seconds
  React.useEffect(() => {
    if (!isExecuting) return
    const timeout = setTimeout(() => {
      setIsExecuting(false)
    }, 35000)
    return () => clearTimeout(timeout)
  }, [isExecuting])

  // Keep the viewport pinned to the latest output after layout settles.
  React.useEffect(() => {
    const node = terminalRef.current
    if (!node) return

    const frame = requestAnimationFrame(() => {
      node.scrollTop = node.scrollHeight
    })

    return () => cancelAnimationFrame(frame)
  }, [historyList, inputVal, isFullscreen])

  // ESC key to exit fullscreen
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isFullscreen) {
        setIsFullscreen(false)
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [isFullscreen])

  const handleTabAutocomplete = () => {
    if (
      wsRef.current &&
      wsConnected &&
      wsRef.current.readyState === WebSocket.OPEN
    ) {
      wsRef.current.send("\t")
    }
  }

  const executeCommand = (cmd: string) => {
    const trimmed = cmd.trim()
    if (!trimmed) return

    setCommandHistory((prev) => [trimmed, ...prev])
    setHistoryIndex(-1)

    const now = new Date().toLocaleTimeString()
    let result = ""

    const lower = trimmed.toLowerCase()

    if (lower === "clear") {
      setHistoryList([])
      setInputVal("")
      return
    }

    if (
      wsRef.current &&
      wsConnected &&
      wsRef.current.readyState === WebSocket.OPEN
    ) {
      setIsExecuting(true)
      setHistoryList((prev) => [
        ...prev,
        {
          id: `cmd-${Date.now()}`,
          command: trimmed,
          output: "",
          timestamp: now,
          cwd: currentCwd,
        },
      ])
      wsRef.current.send(trimmed + "\n")
      setInputVal("")
      return
    }

    if (lower === "exit") {
      result =
        "Session closed. Click 'Reconnect' to establish a new container terminal session."
    } else {
      result =
        "Terminal session is disconnected. Click 'Connect' to establish an interactive container session."
    }

    setHistoryList((prev) => [
      ...prev,
      {
        id: `cmd-${Date.now()}`,
        command: trimmed,
        output: result,
        timestamp: now,
        cwd: currentCwd,
      },
    ])
    setInputVal("")
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Tab") {
      e.preventDefault()
      handleTabAutocomplete()
      return
    }
    if (e.key === "Enter") {
      executeCommand(inputVal)
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      if (commandHistory.length === 0) return
      const nextIndex = Math.min(commandHistory.length - 1, historyIndex + 1)
      setHistoryIndex(nextIndex)
      setInputVal(commandHistory[nextIndex] || "")
    } else if (e.key === "ArrowDown") {
      e.preventDefault()
      if (historyIndex <= 0) {
        setHistoryIndex(-1)
        setInputVal("")
      } else {
        const nextIndex = historyIndex - 1
        setHistoryIndex(nextIndex)
        setInputVal(commandHistory[nextIndex] || "")
      }
    }
  }

  const handleCopyBuffer = async () => {
    const meta = getPromptMeta(service, currentCwd)
    const promptHeader = `┌─[${meta.user}@${meta.host}][${meta.cwd}] [${meta.branch} ${meta.commit}]`
    const bufferText = historyList
      .map((h) => `${promptHeader}\n└─➣ ${h.command}\n${h.output}`)
      .join("\n\n")

    if (await copyToClipboard(bufferText)) {
      setCopiedBuffer(true)
      setTimeout(() => setCopiedBuffer(false), 2000)
    }
  }

  const handleReconnect = async () => {
    setIsReconnecting(true)
    setIsExecuting(false)
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }
    setWsConnected(false)
    setHistoryList([])
    setCurrentCwd("/app")
    await new Promise((res) => setTimeout(res, 600))
    setReconnectKey((prev) => prev + 1)
    setIsReconnecting(false)
  }

  return (
    <div
      className={cn(
        "flex flex-col rounded-lg border border-border bg-card shadow-xs transition-all",
        isFullscreen
          ? "fixed inset-0 z-50 rounded-none border-none bg-background p-4"
          : "h-[540px]"
      )}
    >
      {/* Terminal Header & Toolbar */}
      <div className="flex flex-col gap-2 border-b border-border/80 bg-muted/40 px-3 py-2 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex items-center gap-2">
          <Terminal className="size-4 text-primary" />
          <span className="font-mono text-xs font-bold tracking-tight text-foreground">
            SERVICE TERMINAL
          </span>
          <span className="hidden rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground sm:inline">
            {selectedContainer}
          </span>
          <span
            className={cn(
              "flex size-1.5 rounded-full",
              isReconnecting
                ? "animate-pulse bg-amber-500"
                : wsConnected
                  ? "animate-pulse bg-emerald-500"
                  : "bg-primary/80"
            )}
          />
          <span className="font-mono text-[10px] text-muted-foreground uppercase">
            {isReconnecting
              ? "reconnecting"
              : wsConnected
                ? "WebSocket PTY Live"
                : "Diagnostic Terminal"}
          </span>
        </div>

        {/* Toolbar Controls */}
        <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
          {/* Container Selector */}
          <div className="w-40 sm:w-56">
            <SearchableSelect
              size="sm"
              value={selectedContainer}
              onChange={(val) => setPreferredContainer(val)}
              options={containerOptions}
              placeholder="Select container..."
            />
          </div>

          {/* Shell Selector */}
          <div className="w-28">
            <SearchableSelect
              size="sm"
              value={shell}
              onChange={(val) =>
                setShell(val as "/bin/sh" | "/bin/bash" | "/bin/zsh")
              }
              options={shellOptions}
              placeholder="Select shell..."
            />
          </div>

          {/* Clear Buffer */}
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            onClick={() => setHistoryList([])}
            className="size-7 text-muted-foreground hover:text-foreground"
            title="Clear output buffer"
            aria-label="Clear output buffer"
          >
            <Trash2 className="size-3" />
          </Button>

          {/* Copy Buffer */}
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            onClick={handleCopyBuffer}
            className="size-7 text-muted-foreground hover:text-foreground"
            title="Copy terminal buffer"
            aria-label="Copy terminal buffer"
          >
            {copiedBuffer ? (
              <Check className="size-3 text-emerald-500" />
            ) : (
              <Copy className="size-3" />
            )}
          </Button>

          {/* Reconnect */}
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            disabled={isReconnecting}
            onClick={handleReconnect}
            className="size-7 text-muted-foreground hover:text-foreground"
            title="Restart terminal stream"
            aria-label="Restart terminal stream"
          >
            <RefreshCw
              className={cn("size-3", isReconnecting && "animate-spin")}
            />
          </Button>

          {/* Maximize / Minimize toggle */}
          <Button
            type="button"
            variant={isFullscreen ? "default" : "outline"}
            size="icon-xs"
            onClick={() => setIsFullscreen((prev) => !prev)}
            className="size-7"
            title={
              isFullscreen
                ? "Minimize terminal (Esc)"
                : "Maximize terminal to fullscreen"
            }
            aria-label={
              isFullscreen
                ? "Minimize terminal (Esc)"
                : "Maximize terminal to fullscreen"
            }
          >
            {isFullscreen ? (
              <Minimize2 className="size-3" />
            ) : (
              <Maximize2 className="size-3" />
            )}
          </Button>
        </div>
      </div>

      {/* Terminal Viewport */}
      <div
        ref={terminalRef}
        className={cn(
          "min-h-0 flex-1 overflow-y-auto bg-muted/10 p-4 font-mono text-[12px] leading-relaxed text-foreground select-text dark:bg-background dark:text-foreground/90",
          isFullscreen ? "h-[calc(100vh-90px)]" : "h-[450px]"
        )}
      >
        {/* Welcome Banner */}
        <div className="mb-3 space-y-1 text-muted-foreground select-none dark:text-zinc-500">
          {INITIAL_WELCOME.map((w, idx) => (
            <div key={idx}>{w}</div>
          ))}
        </div>

        {/* Command History */}
        <div className="space-y-3">
          {historyList.map((item) => (
            <div key={item.id} className="space-y-1">
              {item.command ? (
                <TerminalPrompt service={service} cwd={item.cwd || "/app"}>
                  <span className="min-w-0 flex-1 font-medium break-all text-foreground dark:text-zinc-100">
                    {item.command}
                  </span>
                </TerminalPrompt>
              ) : null}
              {item.output ? (
                <div
                  className={cn(
                    "font-mono leading-normal whitespace-pre-wrap",
                    item.command
                      ? "pl-2 text-foreground/90 dark:text-zinc-300"
                      : "text-emerald-600 dark:text-emerald-400 font-semibold"
                  )}
                >
                  {item.output}
                </div>
              ) : null}
              {item.command &&
              isExecuting &&
              item.id === historyList[historyList.length - 1]?.id ? (
                <div className="flex items-center gap-2 pl-2 text-xs text-muted-foreground">
                  <Loader2 className="size-3 animate-spin text-primary" />
                  <span>Executing...</span>
                </div>
              ) : null}
            </div>
          ))}
        </div>

        {/* Active Command Input Line */}
        {!isExecuting && (
          <div className="mt-3">
            <TerminalPrompt service={service} cwd={currentCwd}>
              <input
                ref={inputRef}
                type="text"
                value={inputVal}
                onChange={(e) => setInputVal(e.target.value)}
                onKeyDown={handleKeyDown}
                spellCheck={false}
                autoComplete="off"
                className="min-w-0 flex-1 bg-transparent font-mono text-[12px] text-foreground caret-emerald-500 outline-hidden [caret-shape:underscore] placeholder:text-muted-foreground dark:text-zinc-100 dark:caret-emerald-400 dark:placeholder:text-zinc-600"
                placeholder="Type command here (e.g. ls, ps, env, top)..."
              />
            </TerminalPrompt>
          </div>
        )}
      </div>

      {/* Terminal Status Footer */}
      <div className="flex h-7 shrink-0 items-center justify-between border-t border-border bg-muted/20 px-4 font-mono text-[12px] text-muted-foreground">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-emerald-500" />
            <span>Connected: {selectedContainer}</span>
          </span>
          <span>•</span>
          <span>Shell: {shell}</span>
        </div>

        <div className="flex items-center gap-3">
          <span>UTF-8</span>
          <span>Buffer: {historyList.length} commands</span>
        </div>
      </div>
    </div>
  )
}
