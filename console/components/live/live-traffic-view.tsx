"use client"

import * as React from "react"
import Image from "next/image"
import Link from "next/link"
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Layers,
  Maximize2,
  Minimize2,
  Pause,
  Play,
} from "lucide-react"

import { LiveTelemetryLog } from "@/components/live/live-telemetry-log"
import { LiveTopologyMap } from "@/components/live/live-topology-map"
import { ThemeToggle } from "@/components/theme-toggle"
import { Button } from "@/components/ui/button"
import { siteConfig } from "@/config/site"
import { usePlatformData } from "@/context/platform-data-context"
import { calculateRealisticLatency } from "@/lib/node-geo"
import { isPrivateIp } from "@/lib/geoip"
import { cn } from "@/lib/utils"

export function LiveTrafficView() {
  const { nodes, services } = usePlatformData()
  const [selectedNodeId, setSelectedNodeId] = React.useState<string | null>(
    null
  )
  const [isStreaming, setIsStreaming] = React.useState<boolean>(true)
  const [isFullscreen, setIsFullscreen] = React.useState<boolean>(false)
  const [mobileView, setMobileView] = React.useState<"split" | "map" | "log">(
    "split"
  )

  // Resizable log telemetry height (default 240px on mobile, adjustable via drag)
  const [logHeight, setLogHeight] = React.useState<number>(240)
  const [isDraggingSplitter, setIsDraggingSplitter] =
    React.useState<boolean>(false)
  const splitterDragRef = React.useRef<{
    startY: number
    initialHeight: number
  }>({ startY: 0, initialHeight: 240 })

  const handleSplitterPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault()
    splitterDragRef.current = {
      startY: e.clientY,
      initialHeight: logHeight,
    }
    setIsDraggingSplitter(true)

    const onPointerMove = (moveEvent: PointerEvent) => {
      const deltaY = splitterDragRef.current.startY - moveEvent.clientY
      const minHeight = 52 // Peek mode (toolbar only)
      const maxHeight = Math.max(minHeight + 80, window.innerHeight - 140)
      const next = Math.min(
        maxHeight,
        Math.max(minHeight, splitterDragRef.current.initialHeight + deltaY)
      )
      setLogHeight(Math.round(next))
    }

    const onPointerUp = () => {
      setIsDraggingSplitter(false)
      window.removeEventListener("pointermove", onPointerMove)
      window.removeEventListener("pointerup", onPointerUp)
    }

    window.addEventListener("pointermove", onPointerMove)
    window.addEventListener("pointerup", onPointerUp)
  }

  // Double click / tap snaps between presets
  const handleSplitterDoubleClick = () => {
    const minHeight = 52
    const balancedHeight =
      typeof window !== "undefined" && window.innerHeight < 700 ? 200 : 250
    const expandedHeight =
      typeof window !== "undefined" ? Math.round(window.innerHeight * 0.6) : 380

    setLogHeight((current) => {
      if (current <= minHeight + 20) return balancedHeight
      if (current < expandedHeight - 40) return expandedHeight
      return minHeight
    })
  }

  // Periodic micro-jitter for live roundtrip telemetry while stream is active
  const [latencyJitter, setLatencyJitter] = React.useState<
    Record<string, number>
  >({})

  React.useEffect(() => {
    if (!isStreaming || nodes.length === 0) return

    const interval = setInterval(() => {
      setLatencyJitter(() => {
        const next: Record<string, number> = {}
        for (const n of nodes) {
          if (n.status === "online") {
            const isLocal =
              n.role === "master" ||
              n.ipAddress === "127.0.0.1" ||
              n.ipAddress === "localhost" ||
              isPrivateIp(n.ipAddress)
            const maxJitter = isLocal ? 1 : 3
            next[n.id] =
              Math.floor(Math.random() * (maxJitter * 2 + 1)) - maxJitter
          }
        }
        return next
      })
    }, 2800)

    return () => clearInterval(interval)
  }, [isStreaming, nodes])

  // Resolve realistic distance-based latency for all nodes with live jitter
  const liveNodes = React.useMemo(() => {
    const master = nodes.find((n) => n.role === "master") || nodes[0]
    return nodes.map((node) => {
      const jitter = latencyJitter[node.id] || 0
      const realisticLatency = calculateRealisticLatency(node, master, jitter)
      return {
        ...node,
        grpcLatencyMs: realisticLatency,
      }
    })
  }, [nodes, latencyJitter])

  // Compute cluster health stats from live nodes
  const totalNodes = liveNodes.length
  const onlineNodes = liveNodes.filter((n) => n.status === "online").length
  const offlineNodes = liveNodes.filter((n) => n.status === "offline").length
  const avgLatency =
    onlineNodes > 0
      ? Math.round(
          liveNodes
            .filter((n) => n.status === "online")
            .reduce((acc, n) => acc + (n.grpcLatencyMs || 0), 0) / onlineNodes
        )
      : 0
  const runningServicesCount = services.filter(
    (s) => s.status === "running"
  ).length

  // Fullscreen toggle handler
  const handleToggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {})
      setIsFullscreen(true)
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {})
        setIsFullscreen(false)
      }
    }
  }

  return (
    <div className="flex h-dvh w-full flex-col overflow-hidden bg-background text-foreground select-none">
      {/* Top Header Bar */}
      <header className="z-30 flex h-13 shrink-0 items-center justify-between border-b border-border bg-card/80 px-2.5 backdrop-blur-md sm:h-14 sm:px-4">
        {/* Left: Back Button & Branding */}
        <div className="flex items-center gap-2 sm:gap-3">
          <Link href="/nodes">
            <Button
              size="sm"
              variant="outline"
              className="h-8 gap-1 px-2 text-xs font-medium text-muted-foreground hover:text-foreground sm:px-2.5"
              title="Back to Nodes"
              aria-label="Back to Nodes"
            >
              <ArrowLeft className="size-3.5" />
              <span className="hidden sm:inline">Nodes</span>
            </Button>
          </Link>

          <div className="hidden h-5 w-px bg-border/80 sm:block" />

          <div className="flex items-center gap-1.5 sm:gap-2">
            <Image
              src="/images/tako-trim.png"
              alt={siteConfig.name}
              width={24}
              height={24}
              className="size-5.5 shrink-0 rounded-sm object-contain sm:size-6"
              priority
            />
            <div className="flex flex-col">
              <div className="flex items-center gap-1">
                <span className="text-[11px] font-bold tracking-tight text-foreground uppercase sm:text-xs">
                  Topology
                </span>
                <span className="flex size-1.5 animate-pulse rounded-full bg-emerald-500" />
              </div>
              <span className="hidden font-mono text-[9.5px] text-muted-foreground md:inline">
                Node Distribution & Telemetry Stream
              </span>
            </div>
          </div>
        </div>

        {/* Center: Cluster Telemetry Badges (Desktop) */}
        <div className="hidden items-center gap-2 font-mono text-xs lg:flex">
          {/* Nodes Online Ratio */}
          <div
            className={cn(
              "flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs shadow-2xs",
              offlineNodes > 0
                ? "border-red-500/40 bg-red-950/30 text-red-300"
                : "border-border/80 bg-muted/30 text-foreground"
            )}
          >
            {offlineNodes > 0 ? (
              <AlertTriangle className="size-3 text-red-500" />
            ) : (
              <CheckCircle2 className="size-3 text-emerald-500" />
            )}
            <span className="text-muted-foreground">Cluster Nodes:</span>
            <span className="font-bold">
              {onlineNodes}/{totalNodes} Online
            </span>
          </div>

          {/* Average Latency */}
          <div className="flex items-center gap-1.5 rounded-md border border-border/80 bg-muted/30 px-2.5 py-1 text-xs">
            <Activity className="size-3 text-primary" />
            <span className="text-muted-foreground">Avg Latency:</span>
            <span className="font-semibold text-foreground">
              {avgLatency} ms
            </span>
          </div>

          {/* Active Workloads */}
          <div className="flex items-center gap-1.5 rounded-md border border-border/80 bg-muted/30 px-2.5 py-1 text-xs">
            <Layers className="size-3 text-primary" />
            <span className="text-muted-foreground">Services:</span>
            <span className="font-semibold text-foreground">
              {runningServicesCount > 0
                ? `${runningServicesCount} Active`
                : `${services.length} Total`}
            </span>
          </div>
        </div>

        {/* Right: Stream Toggle & Tools */}
        <div className="flex items-center gap-1.5 sm:gap-2">

          {/* Stream Play/Pause Toggle */}
          <Button
            size="sm"
            variant="outline"
            onClick={() => setIsStreaming((prev) => !prev)}
            className="h-8 gap-1 px-2 text-xs font-medium text-foreground hover:bg-muted sm:px-2.5"
            title={
              isStreaming
                ? "Pause real-time telemetry stream"
                : "Resume real-time telemetry stream"
            }
          >
            {isStreaming ? (
              <>
                <Pause className="size-3.5 text-amber-500" />
                <span className="hidden sm:inline">Pause</span>
              </>
            ) : (
              <>
                <Play className="size-3.5 text-emerald-500" />
                <span className="hidden sm:inline">Resume</span>
              </>
            )}
          </Button>

          {/* Fullscreen Toggle (Desktop / Tablet) */}
          <Button
            size="icon-xs"
            variant="ghost"
            onClick={handleToggleFullscreen}
            className="hidden size-8 sm:inline-flex"
            title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
            aria-label="Toggle Fullscreen"
          >
            {isFullscreen ? (
              <Minimize2 className="size-4" />
            ) : (
              <Maximize2 className="size-4" />
            )}
          </Button>

          {/* Theme Toggle */}
          <ThemeToggle />
        </div>
      </header>

      {/* Main Content: Split View (Map Top, Telemetry Bottom, with Mobile Adaptability) */}
      <main className="flex flex-1 flex-col gap-1.5 overflow-hidden p-1.5 sm:gap-3 sm:p-3 md:gap-4 md:p-4">
        {/* Live Topology Map */}
        <div
          className={cn(
            "min-h-0",
            mobileView === "log" ? "hidden md:flex md:flex-1" : "flex flex-1"
          )}
        >
          <LiveTopologyMap
            nodes={liveNodes}
            selectedNodeId={selectedNodeId}
            onSelectNode={setSelectedNodeId}
            isStreaming={isStreaming}
            mobileView={mobileView}
            onMobileViewChange={setMobileView}
            onlineNodes={onlineNodes}
            totalNodes={totalNodes}
            offlineNodes={offlineNodes}
            avgLatency={avgLatency}
          />
        </div>

        {/* Resizable Divider Handle (in split view) */}
        {mobileView === "split" && (
          <div
            onPointerDown={handleSplitterPointerDown}
            onDoubleClick={handleSplitterDoubleClick}
            className={cn(
              "group relative z-30 flex h-3.5 w-full shrink-0 cursor-row-resize items-center justify-center select-none touch-none py-0.5",
              isDraggingSplitter && "cursor-row-resize"
            )}
            title="Drag to resize telemetry log height (double click to snap)"
            aria-label="Drag to resize telemetry log height"
          >
            {/* Tactile drag pill */}
            <div
              className={cn(
                "rounded-full transition-all duration-150",
                isDraggingSplitter
                  ? "h-1.5 w-16 bg-primary shadow-xs"
                  : "h-1 w-10 bg-muted-foreground/35 group-hover:w-14 group-hover:bg-muted-foreground/70"
              )}
            />
          </div>
        )}

        {/* Live Telemetry Stream Log */}
        <div
          style={
            mobileView === "split"
              ? { height: `${logHeight}px` }
              : undefined
          }
          className={cn(
            mobileView === "map"
              ? "hidden md:block md:h-72 md:shrink-0 lg:h-80"
              : mobileView === "log"
                ? "flex flex-1 overflow-hidden md:h-72 md:shrink-0 lg:h-80"
                : "shrink-0 overflow-hidden"
          )}
        >
          <LiveTelemetryLog
            nodes={liveNodes}
            isStreaming={isStreaming}
            onToggleStreaming={() => setIsStreaming((prev) => !prev)}
            selectedNodeId={selectedNodeId}
            onSelectNode={setSelectedNodeId}
            mobileView={mobileView}
            onMobileViewChange={setMobileView}
          />
        </div>
      </main>
    </div>
  )
}
