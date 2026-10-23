"use client"

import * as React from "react"
import Image from "next/image"
import Link from "next/link"
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Maximize2,
  Minimize2,
  Power,
  Zap,
} from "lucide-react"

import { LiveTelemetryLog } from "@/components/live/live-telemetry-log"
import { LiveTopologyMap } from "@/components/live/live-topology-map"
import { ThemeToggle } from "@/components/theme-toggle"
import { Button } from "@/components/ui/button"
import { siteConfig } from "@/config/site"
import { usePlatformData } from "@/context/platform-data-context"
import { cn } from "@/lib/utils"

export function LiveTrafficView() {
  const { nodes, toggleNodeStatus } = usePlatformData()
  const [selectedNodeId, setSelectedNodeId] = React.useState<string | null>(
    null
  )
  const [isStreaming, setIsStreaming] = React.useState<boolean>(true)
  const [isFullscreen, setIsFullscreen] = React.useState<boolean>(false)

  // Compute cluster health stats
  const totalNodes = nodes.length
  const onlineNodes = nodes.filter((n) => n.status === "online").length
  const offlineNodes = nodes.filter((n) => n.status === "offline").length
  const avgLatency =
    onlineNodes > 0
      ? Math.round(
          nodes
            .filter((n) => n.status === "online")
            .reduce((acc, n) => acc + (n.grpcLatencyMs || 0), 0) / onlineNodes
        )
      : 0

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

  // Quick simulation trigger: toggles first non-master node
  const handleQuickSimulation = () => {
    const targetNode = nodes.find((n) => n.role !== "master") || nodes[0]
    if (targetNode) {
      toggleNodeStatus(targetNode.id)
    }
  }

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-background text-foreground select-none">
      {/* Top NOC Header Bar (No Sidebar) */}
      <header className="z-30 flex h-14 shrink-0 items-center justify-between border-b border-border bg-card/80 px-4 backdrop-blur-md">
        {/* Left: Back Button & Branding */}
        <div className="flex items-center gap-3">
          <Link href="/nodes">
            <Button
              size="md"
              variant="outline"
              className="gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="size-3.5" />
              <span>Back to Nodes</span>
            </Button>
          </Link>

          <div className="hidden h-5 w-px bg-border/80 sm:block" />

          <div className="flex items-center gap-2">
            <Image
              src="/images/tako-trim.png"
              alt={siteConfig.name}
              width={26}
              height={26}
              className="size-6.5 rounded-sm object-contain"
              priority
            />
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold tracking-tight text-foreground uppercase">
                  {siteConfig.name} Live NOC
                </span>
                <span className="flex size-1.5 animate-pulse rounded-full bg-emerald-500" />
              </div>
              <span className="font-mono text-[9.5px] text-muted-foreground">
                Edge Traffic & Network Topology Wall
              </span>
            </div>
          </div>
        </div>

        {/* Center: Cluster Telemetry Badges */}
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

          {/* Throughput */}
          <div className="flex items-center gap-1.5 rounded-md border border-border/80 bg-muted/30 px-2.5 py-1 text-xs">
            <Zap className="size-3 text-amber-500" />
            <span className="text-muted-foreground">Ingestion:</span>
            <span className="font-semibold text-foreground">42.8k ev/s</span>
          </div>
        </div>

        {/* Right: Outage Simulation Toggle & Tools */}
        <div className="flex items-center gap-2">
          {/* Quick Outage Simulator Button */}
          <Button
            size="md"
            variant={offlineNodes > 0 ? "outline" : "destructive"}
            onClick={handleQuickSimulation}
            className="gap-1.5 text-xs font-medium"
            title="Toggle a worker node offline to test red warning alerts and failover logs"
          >
            <Power className="size-3.5" />
            <span className="hidden sm:inline">
              {offlineNodes > 0 ? "Restore Edge Node" : "Simulate Node Crash"}
            </span>
            <span className="sm:hidden">
              {offlineNodes > 0 ? "Restore" : "Crash"}
            </span>
          </Button>

          {/* Fullscreen Toggle */}
          <Button
            size="icon-sm"
            variant="ghost"
            onClick={handleToggleFullscreen}
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

      {/* Main Content: Split View (Map Top, Telemetry Bottom) */}
      <main className="flex flex-1 flex-col gap-2 overflow-hidden p-2 sm:gap-4 sm:p-4">
        {/* Top: Live Topology Map */}
        <div className="min-h-0 flex-1">
          <LiveTopologyMap
            nodes={nodes}
            selectedNodeId={selectedNodeId}
            onSelectNode={setSelectedNodeId}
            onToggleNode={toggleNodeStatus}
            isStreaming={isStreaming}
          />
        </div>

        {/* Bottom: Live Telemetry Stream Log */}
        <div className="h-60 shrink-0 sm:h-72 lg:h-80">
          <LiveTelemetryLog
            nodes={nodes}
            isStreaming={isStreaming}
            onToggleStreaming={() => setIsStreaming((prev) => !prev)}
            selectedNodeId={selectedNodeId}
            onSelectNode={setSelectedNodeId}
          />
        </div>
      </main>
    </div>
  )
}
