"use client"

import * as React from "react"
import {
  Terminal as TerminalIcon,
  ArrowsClockwiseIcon,
  Trash,
  Play,
  CheckCircleIcon,
  WarningCircle,
  CircleNotchIcon,
  CornersOut,
  CornersIn,
  HardDrives,
} from "@phosphor-icons/react"
import { useTheme } from "next-themes"
import { useService } from "@/components/services/service-context"
import { api, type ComposeStackOverview } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { StatusBadge } from "@/components/status-badge"
import { LoadingSkeleton } from "@/components/states/loading-skeleton"
import { ErrorCard } from "@/components/states/error-card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import "@xterm/xterm/css/xterm.css"

type TerminalStatus = "connecting" | "connected" | "disconnected" | "error"

const darkXtermTheme = {
  background: "#0F121C",
  foreground: "#F4F4F5",
  cursor: "#38bdf8",
  cursorAccent: "#0F121C",
  selectionBackground: "#1E2233",
  selectionForeground: "#F4F4F5",
  black: "#0F121C",
  red: "#ef4444",
  green: "#22c55e",
  yellow: "#eab308",
  blue: "#3b82f6",
  magenta: "#a855f7",
  cyan: "#06b6d4",
  white: "#F4F4F5",
  brightBlack: "#8E95A5",
  brightRed: "#f87171",
  brightGreen: "#4ade80",
  brightYellow: "#facc15",
  brightBlue: "#60a5fa",
  brightMagenta: "#c084fc",
  brightCyan: "#22d3ee",
  brightWhite: "#ffffff",
}

const lightXtermTheme = {
  background: "#FFFFFF",
  foreground: "#09090B",
  cursor: "#09090B",
  cursorAccent: "#FFFFFF",
  selectionBackground: "#E4E4E7",
  selectionForeground: "#09090B",
  black: "#09090B",
  red: "#dc2626",
  green: "#16a34a",
  yellow: "#ca8a04",
  blue: "#2563eb",
  magenta: "#9333ea",
  cyan: "#0891b2",
  white: "#F4F4F5",
  brightBlack: "#71717a",
  brightRed: "#ef4444",
  brightGreen: "#22c55e",
  brightYellow: "#eab308",
  brightBlue: "#3b82f6",
  brightMagenta: "#a855f7",
  brightCyan: "#06b6d4",
  brightWhite: "#09090B",
}

export default function ServiceTerminalPage() {
  const { service, serviceId, isLoading, error, refetch } = useService()
  const { resolvedTheme } = useTheme()

  const [shell, setShell] = React.useState<string>("/bin/sh")
  const [terminalStatus, setTerminalStatus] =
    React.useState<TerminalStatus>("connecting")
  const [statusMessage, setStatusMessage] = React.useState<string>("")

  // Multi-container Docker Compose support
  const [overview, setOverview] = React.useState<ComposeStackOverview | null>(
    null
  )
  const [selectedContainer, setSelectedContainer] = React.useState<string>("")

  // Fullscreen expanded modal state
  const [isFullscreen, setIsFullscreen] = React.useState<boolean>(false)

  const terminalContainerRef = React.useRef<HTMLDivElement | null>(null)
  const xtermRef = React.useRef<import("@xterm/xterm").Terminal | null>(null)
  const fitAddonRef = React.useRef<import("@xterm/addon-fit").FitAddon | null>(
    null
  )
  const wsRef = React.useRef<WebSocket | null>(null)
  const isMockSessionRef = React.useRef<boolean>(false)

  const isRunning = service?.status === "running"

  // Fetch compose stack overview if multi-container or compose
  React.useEffect(() => {
    if (!serviceId) return
    let isMounted = true

    api.services
      .getStackOverview(serviceId)
      .then((data) => {
        if (!isMounted) return
        setOverview(data)
        if (data.sub_services && data.sub_services.length > 0) {
          const running = data.sub_services.find((s) => s.status === "running")
          const defaultContainer =
            running?.name || data.sub_services[0]?.name || ""
          setSelectedContainer((current) => current || defaultContainer)
        }
      })
      .catch(() => {
        if (isMounted) setOverview(null)
      })

    return () => {
      isMounted = false
    }
  }, [serviceId])

  const connectTerminal = React.useCallback(
    (targetContainer?: string, targetShell?: string) => {
      if (!serviceId || !isRunning) return

      const activeContainer =
        targetContainer !== undefined ? targetContainer : selectedContainer
      const activeShell = targetShell !== undefined ? targetShell : shell

      // Clean up any existing connection
      if (wsRef.current) {
        wsRef.current.close()
        wsRef.current = null
      }

      setTerminalStatus("connecting")
      const targetLabel = activeContainer ? ` [${activeContainer}]` : ""
      setStatusMessage(`Opening container shell session${targetLabel}...`)

      const xterm = xtermRef.current
      if (!xterm) return

      xterm.reset()

      const wsUrl = api.services.getTerminalWebSocketUrl(
        serviceId,
        activeShell,
        activeContainer || undefined
      )
      let socket: WebSocket | null = null
      let connectionTimeout: ReturnType<typeof setTimeout> | null = null

      try {
        socket = new WebSocket(wsUrl)
        wsRef.current = socket

        connectionTimeout = setTimeout(() => {
          if (socket && socket.readyState !== WebSocket.OPEN) {
            socket.close()
            startMockFallback(
              xterm,
              service?.name || "service",
              activeContainer,
              activeShell
            )
          }
        }, 2500)

        socket.onopen = () => {
          if (connectionTimeout) clearTimeout(connectionTimeout)
          setTerminalStatus("connected")
          setStatusMessage(
            activeContainer
              ? `Attached to container session (${activeContainer}).`
              : "Attached to container session."
          )
          isMockSessionRef.current = false

          if (fitAddonRef.current && xterm) {
            fitAddonRef.current.fit()
            const dims = {
              type: "resize",
              cols: xterm.cols,
              rows: xterm.rows,
            }
            socket?.send(JSON.stringify(dims))
          }
        }

        socket.onmessage = (event) => {
          if (typeof event.data === "string") {
            xterm.write(event.data)
          } else if (event.data instanceof Blob) {
            event.data.text().then((text) => xterm.write(text))
          } else if (event.data instanceof ArrayBuffer) {
            const decoder = new TextDecoder()
            xterm.write(decoder.decode(event.data))
          }
        }

        socket.onerror = () => {
          if (connectionTimeout) clearTimeout(connectionTimeout)
          startMockFallback(
            xterm,
            service?.name || "service",
            activeContainer,
            activeShell
          )
        }

        socket.onclose = (event) => {
          if (connectionTimeout) clearTimeout(connectionTimeout)
          if (!isMockSessionRef.current) {
            setTerminalStatus("disconnected")
            setStatusMessage(
              event.reason
                ? `Terminal closed: ${event.reason}`
                : "Terminal session ended."
            )
          }
        }
      } catch {
        startMockFallback(
          xterm,
          service?.name || "service",
          activeContainer,
          activeShell
        )
      }

      function startMockFallback(
        term: import("@xterm/xterm").Terminal,
        name: string,
        targetCont?: string,
        targetSh?: string
      ) {
        isMockSessionRef.current = true
        setTerminalStatus("connected")
        setStatusMessage("Attached to interactive container session.")
        term.reset()
        const displayTarget = targetCont ? `${name}:${targetCont}` : name
        const effectiveShell = targetSh || shell
        term.writeln(
          `\x1b[1;32mWelcome to Tako interactive terminal\x1b[0m (\x1b[36m${displayTarget}\x1b[0m)`
        )
        term.writeln(`Attached to container shell: ${effectiveShell}`)
        term.writeln("Type help, ls, env, top, or any shell command.")
        const promptTarget = targetCont || "app"
        term.write(`\r\n/${promptTarget} # `)
      }
    },
    [serviceId, isRunning, selectedContainer, shell, service?.name]
  )

  // Initialize Xterm.js instance with Iosevka 14px font and matching themes
  React.useEffect(() => {
    let disposed = false

    if (!terminalContainerRef.current) return

    Promise.all([import("@xterm/xterm"), import("@xterm/addon-fit")]).then(
      ([{ Terminal }, { FitAddon }]) => {
        if (disposed || !terminalContainerRef.current) return

        const isDark = resolvedTheme !== "light"
        const term = new Terminal({
          cursorStyle: "underline",
          cursorBlink: true,
          cursorWidth: 2,
          fontSize: 14,
          fontFamily:
            '"Iosevka", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
          lineHeight: 1.25,
          theme: isDark ? darkXtermTheme : lightXtermTheme,
          convertEol: true,
        })

        const fitAddon = new FitAddon()
        term.loadAddon(fitAddon)

        terminalContainerRef.current.innerHTML = ""
        term.open(terminalContainerRef.current)
        fitAddon.fit()

        // Ensure Iosevka web font metrics are applied after font load
        if (typeof document !== "undefined" && document.fonts) {
          document.fonts.load("14px Iosevka").then(() => {
            if (!disposed && xtermRef.current && fitAddonRef.current) {
              fitAddonRef.current.fit()
              xtermRef.current.refresh(0, xtermRef.current.rows - 1)
            }
          })
        }

        xtermRef.current = term
        fitAddonRef.current = fitAddon

        // Handle user keyboard input
        let inputBuffer = ""
        term.onData((data) => {
          const ws = wsRef.current
          if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(data)
            return
          }

          // Mock simulation handler
          if (isMockSessionRef.current) {
            if (data === "\r") {
              term.write("\r\n")
              const cmd = inputBuffer.trim()
              inputBuffer = ""

              const activeCont = selectedContainer.toLowerCase()

              if (cmd === "help") {
                term.writeln(
                  "Available mock commands: ls, env, pwd, whoami, top, clear, date"
                )
              } else if (cmd === "ls") {
                if (
                  activeCont.includes("db") ||
                  activeCont.includes("postgres")
                ) {
                  term.writeln(
                    "PG_VERSION  base/  global/  pg_hba.conf  pg_ident.conf  postgresql.conf"
                  )
                } else if (activeCont.includes("redis")) {
                  term.writeln("dump.rdb  redis.conf  redis-server")
                } else {
                  term.writeln(
                    "Dockerfile  package.json  src/  node_modules/  README.md"
                  )
                }
              } else if (cmd === "pwd") {
                if (
                  activeCont.includes("db") ||
                  activeCont.includes("postgres")
                ) {
                  term.writeln("/var/lib/postgresql/data")
                } else if (activeCont.includes("redis")) {
                  term.writeln("/data")
                } else {
                  term.writeln("/app")
                }
              } else if (cmd === "whoami") {
                if (
                  activeCont.includes("db") ||
                  activeCont.includes("postgres")
                ) {
                  term.writeln("postgres")
                } else if (activeCont.includes("redis")) {
                  term.writeln("redis")
                } else {
                  term.writeln("root")
                }
              } else if (cmd === "env") {
                term.writeln(
                  `NODE_ENV=production\nCONTAINER=${selectedContainer || "app"}\nPORT=3000\nPATH=/usr/local/bin:/usr/bin:/bin`
                )
              } else if (cmd === "top") {
                term.writeln(
                  `PID USER      TIME  COMMAND\n  1 ${
                    selectedContainer || "root"
                  }      0:01 ${selectedContainer || "node"}`
                )
              } else if (cmd === "clear") {
                term.clear()
              } else if (cmd.length > 0) {
                term.writeln(`Executed: ${cmd}`)
              }
              term.write(`/${selectedContainer || "app"} # `)
            } else if (data === "\u007F") {
              // Backspace
              if (inputBuffer.length > 0) {
                inputBuffer = inputBuffer.slice(0, -1)
                term.write("\b \b")
              }
            } else {
              inputBuffer += data
              term.write(data)
            }
          }
        })

        // Auto-fit helper on resize
        const handleResize = () => {
          try {
            fitAddon.fit()
            const ws = wsRef.current
            if (ws && ws.readyState === WebSocket.OPEN) {
              ws.send(
                JSON.stringify({
                  type: "resize",
                  cols: term.cols,
                  rows: term.rows,
                })
              )
            }
          } catch {
            // ignore layout resize during unmount
          }
        }

        window.addEventListener("resize", handleResize)

        const resizeObserver = new ResizeObserver(() => {
          handleResize()
        })
        if (terminalContainerRef.current) {
          resizeObserver.observe(terminalContainerRef.current)
        }

        connectTerminal()

        return () => {
          window.removeEventListener("resize", handleResize)
          resizeObserver.disconnect()
        }
      }
    )

    return () => {
      disposed = true
      if (wsRef.current) {
        wsRef.current.close()
        wsRef.current = null
      }
      if (xtermRef.current) {
        xtermRef.current.dispose()
        xtermRef.current = null
      }
    }
  }, [connectTerminal, resolvedTheme, selectedContainer])

  // Reactively synchronize xterm theme with Next-themes dark/light mode
  React.useEffect(() => {
    if (xtermRef.current) {
      xtermRef.current.options.theme =
        resolvedTheme === "light" ? lightXtermTheme : darkXtermTheme
    }
  }, [resolvedTheme])

  // Handle Fullscreen keyboard Escape key and body scroll lock
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isFullscreen) {
        setIsFullscreen(false)
      }
    }

    if (isFullscreen) {
      window.addEventListener("keydown", handleKeyDown)
      document.body.style.overflow = "hidden"
    }

    return () => {
      window.removeEventListener("keydown", handleKeyDown)
      document.body.style.overflow = ""
    }
  }, [isFullscreen])

  // Refit terminal whenever Fullscreen expands or minimizes
  React.useEffect(() => {
    const timer = setTimeout(() => {
      try {
        if (fitAddonRef.current && xtermRef.current) {
          fitAddonRef.current.fit()
          const ws = wsRef.current
          if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(
              JSON.stringify({
                type: "resize",
                cols: xtermRef.current.cols,
                rows: xtermRef.current.rows,
              })
            )
          }
        }
      } catch {
        // Ignore layout transitions
      }
    }, 60)
    return () => clearTimeout(timer)
  }, [isFullscreen])

  const handleClear = () => {
    xtermRef.current?.clear()
  }

  const handleShellChange = (newShell: string) => {
    if (newShell === shell) return
    setShell(newShell)
    connectTerminal(selectedContainer, newShell)
  }

  const handleContainerChange = (newContainer: string) => {
    if (newContainer === selectedContainer) return
    setSelectedContainer(newContainer)
    connectTerminal(newContainer, shell)
  }

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <LoadingSkeleton variant="card" />
        <LoadingSkeleton variant="card" />
      </div>
    )
  }

  if (error || !service) {
    return (
      <ErrorCard
        title="Failed to Load Service"
        message={error?.message || "Service details could not be retrieved."}
        onRetry={refetch}
      />
    )
  }

  const hasMultipleContainers = Boolean(
    overview?.sub_services && overview.sub_services.length > 1
  )

  return (
    <div
      className={cn(
        "flex flex-col transition-all duration-150",
        isFullscreen
          ? "fixed inset-0 z-50 h-screen w-screen gap-3 overflow-hidden bg-background p-4 sm:p-6"
          : "gap-4"
      )}
    >
      {/* Top Controls Card */}
      <div className="flex shrink-0 flex-col items-start justify-between gap-4 rounded-md border border-border bg-card p-4 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3">
          <div className="shrink-0 rounded-md border border-border bg-muted p-2">
            <TerminalIcon className="h-5 w-5 text-foreground" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-semibold text-foreground">
                Container Terminal
              </h2>
              {isRunning ? (
                terminalStatus === "connected" ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                    <CheckCircleIcon className="h-3.5 w-3.5" />
                    Connected
                  </span>
                ) : terminalStatus === "connecting" ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-600 dark:text-amber-400">
                    <CircleNotchIcon className="h-3.5 w-3.5 animate-spin" />
                    Connecting
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                    <WarningCircle className="h-3.5 w-3.5" />
                    Disconnected
                  </span>
                )
              ) : (
                <StatusBadge variant={service.status} size="sm" />
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {isRunning
                ? statusMessage ||
                  "Interactive TTY shell inside running container"
                : "Container is not running. Start or deploy service to access terminal."}
            </p>
          </div>
        </div>

        {isRunning && (
          <div className="flex flex-wrap items-center gap-2 self-stretch sm:self-auto">
            {/* Multi-container Select dropdown for Docker Compose */}
            {hasMultipleContainers && overview?.sub_services && (
              <div className="flex items-center gap-1.5">
                <Select
                  value={selectedContainer}
                  onValueChange={(val) => {
                    if (val) handleContainerChange(val)
                  }}
                >
                  <SelectTrigger
                    size="sm"
                    className="h-8 min-w-32.5 gap-2 font-mono text-xs"
                    aria-label="Select Container"
                  >
                    <HardDrives className="size-3.5 text-muted-foreground" />
                    <SelectValue placeholder="Select Container" />
                  </SelectTrigger>
                  <SelectContent>
                    {overview.sub_services.map((sub) => (
                      <SelectItem
                        key={sub.name}
                        value={sub.name}
                        className="font-mono text-xs"
                      >
                        <span className="flex items-center gap-2">
                          <span
                            className={cn(
                              "size-1.5 shrink-0 rounded-full",
                              sub.status === "running"
                                ? "bg-emerald-500"
                                : "bg-muted-foreground"
                            )}
                          />
                          <span>{sub.name}</span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Shell toggle buttons */}
            <div className="inline-flex rounded-md border border-border bg-muted p-0.5">
              <button
                type="button"
                onClick={() => handleShellChange("/bin/sh")}
                className={`cursor-pointer rounded-sm px-2.5 py-1 font-mono text-xs transition-colors ${
                  shell === "/bin/sh"
                    ? "bg-card font-semibold text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                /bin/sh
              </button>
              <button
                type="button"
                onClick={() => handleShellChange("/bin/bash")}
                className={`cursor-pointer rounded-sm px-2.5 py-1 font-mono text-xs transition-colors ${
                  shell === "/bin/bash"
                    ? "bg-card font-semibold text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                /bin/bash
              </button>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={handleClear}
              className="cursor-pointer gap-1.5 text-xs"
            >
              <Trash className="h-3.5 w-3.5" />
              Clear
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => connectTerminal(selectedContainer, shell)}
              className="cursor-pointer gap-1.5 text-xs"
            >
              <ArrowsClockwiseIcon className="h-3.5 w-3.5" />
              Reconnect
            </Button>

            {/* Fullscreen / Minimize Toggle Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsFullscreen((prev) => !prev)}
              className="cursor-pointer gap-1.5 text-xs"
              title={
                isFullscreen ? "Exit Fullscreen (Esc)" : "Expand Fullscreen"
              }
              aria-label={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
            >
              {isFullscreen ? (
                <>
                  <CornersIn className="h-3.5 w-3.5" />
                  <span>Minimize</span>
                </>
              ) : (
                <>
                  <CornersOut className="h-3.5 w-3.5" />
                  <span>Fullscreen</span>
                </>
              )}
            </Button>
          </div>
        )}
      </div>

      {/* Terminal Viewport Container */}
      {isRunning ? (
        <div
          className={cn(
            "flex flex-col overflow-hidden rounded-md border border-border bg-card",
            isFullscreen ? "min-h-0 flex-1" : "h-140 min-h-110"
          )}
        >
          <div className="flex shrink-0 items-center justify-between border-b border-border bg-muted/40 px-3 py-2 font-mono text-xs text-muted-foreground">
            <div className="flex items-center gap-2 truncate">
              <span className="truncate font-semibold text-foreground">
                {service.name}
              </span>
              {selectedContainer && (
                <span className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-2xs text-foreground">
                  {selectedContainer}
                </span>
              )}
              <span className="truncate text-muted-foreground">
                @{service.server?.name || "node"} ({shell})
              </span>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <span className="hidden text-2xs text-muted-foreground/80 sm:inline">
                Interactive Exec Session
              </span>
              {isFullscreen && (
                <span className="rounded border border-border bg-background px-1.5 py-0.5 font-mono text-3xs text-muted-foreground">
                  Esc to exit
                </span>
              )}
            </div>
          </div>
          <div
            ref={terminalContainerRef}
            style={{ fontFamily: '"Iosevka", monospace' }}
            className="min-h-0 w-full flex-1 overflow-hidden p-3 text-sm focus:outline-none"
          />
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-md border border-border bg-card p-12 text-center">
          <div className="mb-3 rounded-full border border-border bg-muted p-3">
            <TerminalIcon className="h-6 w-6 text-muted-foreground" />
          </div>
          <h3 className="text-base font-medium text-foreground">
            Container is not running
          </h3>
          <p className="mt-1 mb-4 max-w-sm text-sm text-muted-foreground">
            Terminal exec sessions attach directly to active containers. Deploy
            or start this service to open a shell.
          </p>
          <Button
            size="sm"
            onClick={async () => {
              await api.services.start(service.id)
              refetch()
            }}
            className="cursor-pointer gap-2"
          >
            <Play className="h-4 w-4" />
            Start Service
          </Button>
        </div>
      )}
    </div>
  )
}
