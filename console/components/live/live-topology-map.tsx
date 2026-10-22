"use client"

import * as React from "react"
import Image from "next/image"
import Link from "next/link"
import DottedMap from "dotted-map"
import { motion } from "motion/react"
import {
  AlertTriangle,
  Cpu,
  ExternalLink,
  Layers,
  Power,
  X,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Flag } from "@/components/ui/flag"
import {
  SearchableSelect,
  SelectOption,
} from "@/components/ui/searchable-select"
import { getNodeGeo, NodeGeo } from "@/lib/node-geo"
import { buildNodeSelectOptions } from "@/lib/node-select-options"
import { ClusterNode } from "@/types/platform"
import { cn } from "@/lib/utils"

interface LiveTopologyMapProps {
  nodes: ClusterNode[]
  selectedNodeId: string | null
  onSelectNode: (id: string | null) => void
  onToggleNode: (id: string) => void
  isStreaming?: boolean
}

export function LiveTopologyMap({
  nodes,
  selectedNodeId,
  onSelectNode,
  onToggleNode,
  isStreaming = true,
}: LiveTopologyMapProps) {
  const map = React.useMemo(
    () => new DottedMap({ height: 100, grid: "diagonal" }),
    []
  )

  const svgMapDark = React.useMemo(() => {
    return map.getSVG({
      radius: 0.22,
      color: "#FFFFFF35",
      shape: "circle",
      backgroundColor: "transparent",
    })
  }, [map])

  const svgMapLight = React.useMemo(() => {
    return map.getSVG({
      radius: 0.22,
      color: "#47556960",
      shape: "circle",
      backgroundColor: "transparent",
    })
  }, [map])

  const createCurvedPath = (
    start: { x: number; y: number },
    end: { x: number; y: number }
  ) => {
    const dx = end.x - start.x
    const dy = end.y - start.y
    const dist = Math.sqrt(dx * dx + dy * dy)
    // Gentle organic geodesic arc proportional to span distance
    const curvature = Math.min(7.5, Math.max(2, dist * 0.075))
    const cp1x = start.x + dx * 0.3
    const cp1y = start.y + dy * 0.3 - curvature
    const cp2x = start.x + dx * 0.7
    const cp2y = start.y + dy * 0.7 - curvature
    return `M ${start.x.toFixed(2)} ${start.y.toFixed(2)} C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)}, ${cp2x.toFixed(2)} ${cp2y.toFixed(2)}, ${end.x.toFixed(2)} ${end.y.toFixed(2)}`
  }

  // Identify Master hub node or default to the first node
  const masterNode = React.useMemo(() => {
    return nodes.find((n) => n.role === "master") || nodes[0]
  }, [nodes])

  const masterGeo: NodeGeo | null = React.useMemo(() => {
    if (!masterNode) return null
    return getNodeGeo(masterNode)
  }, [masterNode])

  // Nodes with their Geo info
  const nodeGeoList = React.useMemo(() => {
    return nodes.map((node) => ({
      node,
      geo: getNodeGeo(node),
    }))
  }, [nodes])

  // Searchable select options for quick node jumping
  const mapNodeOptions: SelectOption[] = React.useMemo(
    () =>
      buildNodeSelectOptions(nodes, {
        label: "All Nodes (Unfocus)",
        description: "View full cluster topology",
      }),
    [nodes]
  )

  const [hoveredNodeId, setHoveredNodeId] = React.useState<string | null>(null)
  const cardRef = React.useRef<HTMLDivElement>(null)

  // Auto-dismiss floating node inspection card when clicking outside or pressing Escape
  React.useEffect(() => {
    if (!selectedNodeId) return

    function handlePointerDown(e: MouseEvent) {
      if (cardRef.current && cardRef.current.contains(e.target as Node)) {
        return
      }
      const target = e.target as HTMLElement | null
      if (target?.closest("button") || target?.closest('[role="combobox"]')) {
        return
      }
      onSelectNode(null)
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onSelectNode(null)
      }
    }

    document.addEventListener("mousedown", handlePointerDown)
    document.addEventListener("keydown", handleKeyDown)
    return () => {
      document.removeEventListener("mousedown", handlePointerDown)
      document.removeEventListener("keydown", handleKeyDown)
    }
  }, [selectedNodeId, onSelectNode])

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden rounded-xl border border-border/80 bg-card/70 shadow-lg backdrop-blur-md select-none">
      {/* Top Map Status Overlay */}
      <div className="absolute top-3 left-4 z-40 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2 rounded-md border border-border/80 bg-background/90 px-2.5 py-1 text-xs shadow-xs backdrop-blur-md">
          <span className="flex size-2">
            <span
              className={cn(
                "size-2 rounded-full",
                isStreaming ? "animate-pulse bg-emerald-500" : "bg-amber-500"
              )}
            />
          </span>
          <span className="font-mono font-medium text-foreground">
            {isStreaming ? "gRPC REVERSE MESH ONLINE" : "STREAM PAUSED"}
          </span>
          <span className="font-mono text-muted-foreground">•</span>
          <span className="font-mono text-[11px] text-muted-foreground">
            mTLS :50051
          </span>
        </div>

        <div className="hidden items-center gap-2 rounded-md border border-border/80 bg-background/90 px-2.5 py-1 text-xs shadow-xs backdrop-blur-md sm:flex">
          <span className="font-mono text-muted-foreground">Master Hub:</span>
          <span className="font-mono font-semibold text-foreground">
            {masterNode ? masterNode.name : "None"}
          </span>
          {masterNode && (
            <span className="font-mono text-[11px] text-emerald-500">
              ({masterNode.ipAddress})
            </span>
          )}
        </div>

        {/* Quick Node Focus Select */}
        <div className="relative z-50 hidden w-44 md:block lg:w-52">
          <SearchableSelect
            options={mapNodeOptions}
            value={selectedNodeId || "all"}
            onChange={(val) => onSelectNode(val === "all" ? null : val)}
            placeholder="Focus node on map..."
            searchPlaceholder="Search cluster node..."
            size="sm"
          />
        </div>
      </div>

      {/* Map Legend (Top-Right) */}
      <div className="absolute top-3 right-4 z-40 hidden items-center gap-3 rounded-md border border-border/80 bg-background/90 px-3 py-1 font-mono text-[11px] shadow-xs backdrop-blur-md md:flex">
        <div className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-emerald-500 shadow-[0_0_8px_#10b981]" />
          <span className="text-muted-foreground">Healthy Node</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-red-500 shadow-[0_0_8px_#ef4444]" />
          <span className="font-medium text-red-400">Dead / Outage</span>
        </div>
      </div>

      {/* Dotted World Map Base */}
      <div className="relative flex flex-1 items-center justify-center overflow-hidden p-2 sm:p-4">
        <div className="relative aspect-[198/100] w-full max-w-6xl">
          {/* Light Theme Dotted Map */}
          <Image
            src={`data:image/svg+xml;utf8,${encodeURIComponent(svgMapLight)}`}
            className="pointer-events-none h-full w-full [mask-image:linear-gradient(to_bottom,transparent,white_8%,white_92%,transparent)] select-none dark:hidden"
            alt="world map light"
            width={1980}
            height={1000}
            draggable={false}
            unoptimized
          />
          {/* Dark Theme Dotted Map */}
          <Image
            src={`data:image/svg+xml;utf8,${encodeURIComponent(svgMapDark)}`}
            className="pointer-events-none hidden h-full w-full [mask-image:linear-gradient(to_bottom,transparent,white_8%,white_92%,transparent)] select-none dark:block"
            alt="world map dark"
            width={1980}
            height={1000}
            draggable={false}
            unoptimized
          />

          {/* SVG Connection Arcs and Pulses */}
          {masterGeo && (
            <svg
              viewBox="0 0 198 100"
              className="pointer-events-none absolute inset-0 h-full w-full select-none"
            >
              <defs>
                <filter
                  id="pulse-glow-green"
                  x="-50%"
                  y="-50%"
                  width="200%"
                  height="200%"
                >
                  <feGaussianBlur stdDeviation="0.4" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
                <filter
                  id="pulse-glow-red"
                  x="-50%"
                  y="-50%"
                  width="200%"
                  height="200%"
                >
                  <feGaussianBlur stdDeviation="0.5" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>

              {nodeGeoList.map(({ node, geo }, idx) => {
                // If it is the master node, do not draw connection to itself
                if (node.id === masterNode?.id) return null

                const isDead = node.status === "offline"
                const startPoint = { x: geo.pinX, y: geo.pinY }
                const endPoint = { x: masterGeo.pinX, y: masterGeo.pinY }
                const pathD = createCurvedPath(startPoint, endPoint)
                const strokeColor = isDead ? "#ef4444" : "#10b981"
                const flowDur = Math.max(
                  3.5,
                  (node.grpcLatencyMs || 25) * 0.08 + 2.5
                )

                return (
                  <g key={`link-${node.id}`}>
                    {/* Background glow curve: subtle and refined */}
                    <path
                      d={pathD}
                      fill="none"
                      stroke={strokeColor}
                      strokeWidth={isDead ? "0.45" : "0.36"}
                      strokeOpacity={isDead ? "0.22" : "0.15"}
                    />

                    {/* Background main crisp curve: delicate fine line */}
                    <path
                      d={pathD}
                      fill="none"
                      stroke={strokeColor}
                      strokeWidth={isDead ? "0.28" : "0.22"}
                      strokeOpacity={isDead ? "0.7" : "0.55"}
                      strokeDasharray={isDead ? "0.8 1.2" : undefined}
                    />

                    {/* Animated Stream Packet: precise small beacon */}
                    {!isDead && isStreaming && (
                      <circle
                        r="0.55"
                        fill="#10b981"
                        filter="url(#pulse-glow-green)"
                      >
                        <animateMotion
                          path={pathD}
                          dur={`${flowDur.toFixed(2)}s`}
                          repeatCount="indefinite"
                        />
                      </circle>
                    )}

                    {/* Steady pulse halo in SVG: fixed radius, rhythmic breathing opacity */}
                    <circle
                      cx={startPoint.x}
                      cy={startPoint.y}
                      r={isDead ? "0.9" : "0.75"}
                      fill={strokeColor}
                      opacity={isDead ? "0.4" : "0.25"}
                    >
                      <animate
                        attributeName="opacity"
                        values={isDead ? "0.65;0.12;0.65" : "0.45;0.08;0.45"}
                        dur={isDead ? "1.2s" : "2.4s"}
                        begin={`${idx * 0.25}s`}
                        repeatCount="indefinite"
                      />
                    </circle>
                  </g>
                )
              })}

              {/* Master Hub Central Beacon Pulse */}
              {(() => {
                const pt = { x: masterGeo.pinX, y: masterGeo.pinY }
                return (
                  <g key="master-hub-beacon">
                    <circle
                      cx={pt.x}
                      cy={pt.y}
                      r="1.1"
                      fill="#10b981"
                      opacity="0.3"
                    >
                      <animate
                        attributeName="opacity"
                        values="0.55;0.1;0.55"
                        dur="2.4s"
                        repeatCount="indefinite"
                      />
                    </circle>
                  </g>
                )
              })()}
            </svg>
          )}

          {/* Node Badges Overlaid Directly on Map Coordinates */}
          {nodeGeoList.map(({ node, geo }) => {
            const isMaster = node.id === masterNode?.id
            const isDead = node.status === "offline"
            const isSelected = selectedNodeId === node.id
            const isHovered = hoveredNodeId === node.id
            const showCard = isHovered || isSelected

            const isNearTop = geo.percentY < 40
            const isNearRight = geo.percentX > 68
            const isNearLeft = geo.percentX < 25

            const hasRightNeighbor = nodeGeoList.some(
              (other) =>
                other.node.id !== node.id &&
                other.geo.percentX > geo.percentX &&
                other.geo.percentX - geo.percentX < 7 &&
                Math.abs(other.geo.percentY - geo.percentY) < 12
            )
            const placeLabelLeft = isNearRight || hasRightNeighbor

            return (
              <div
                key={node.id}
                onMouseEnter={() => setHoveredNodeId(node.id)}
                onMouseLeave={() => setHoveredNodeId(null)}
                style={{
                  left: `${geo.percentX}%`,
                  top: `${geo.percentY}%`,
                }}
                className={cn(
                  "pointer-events-none absolute",
                  showCard ? "z-50" : "z-20"
                )}
              >
                {/* Node Beacon Dot: Exactly centered at (0, 0) */}
                <button
                  type="button"
                  onClick={() => onSelectNode(isSelected ? null : node.id)}
                  aria-label={`Node ${node.name} in ${geo.city}`}
                  className="group pointer-events-auto absolute flex size-6 -translate-x-1/2 -translate-y-1/2 cursor-pointer items-center justify-center focus:outline-hidden"
                >
                  {/* Radar pulse aura: fixed size, gentle breathing opacity */}
                  <span
                    className={cn(
                      "absolute size-4 rounded-full transition-opacity duration-200",
                      isDead
                        ? "animate-pulse bg-red-500/35 ring-1 ring-red-500/60"
                        : "animate-pulse bg-emerald-500/25 ring-1 ring-emerald-500/50"
                    )}
                  />
                  {/* Center glowing beacon dot */}
                  <span
                    className={cn(
                      "relative size-2.5 rounded-full border border-background shadow-xs transition-transform duration-150 group-hover:scale-125",
                      isDead
                        ? "bg-red-500 shadow-[0_0_8px_#ef4444]"
                        : "bg-emerald-500 shadow-[0_0_8px_#10b981]"
                    )}
                  />
                </button>

                {/* Micro-label: Positioned cleanly beside the dot (never offsets the dot coordinate) */}
                <button
                  type="button"
                  onClick={() => onSelectNode(isSelected ? null : node.id)}
                  className={cn(
                    "pointer-events-auto absolute top-0 -translate-y-1/2 cursor-pointer whitespace-nowrap focus:outline-hidden",
                    placeLabelLeft ? "-left-3.5 -translate-x-full" : "left-3.5"
                  )}
                >
                  {isDead ? (
                    <span className="flex items-center gap-1.5 rounded border border-red-500/80 bg-red-950/90 px-1.5 py-0.5 font-mono text-[10.5px] font-semibold text-red-200 shadow-sm backdrop-blur-xs hover:border-red-400">
                      <span>{geo.city}</span>
                      <span className="font-bold text-red-400 uppercase">
                        DEAD
                      </span>
                    </span>
                  ) : (
                    <span
                      className={cn(
                        "flex items-center gap-1.5 rounded border px-1.5 py-0.5 font-mono text-[10.5px] font-medium shadow-2xs backdrop-blur-xs transition-all",
                        showCard
                          ? "scale-105 border-emerald-500 bg-card text-foreground ring-1 ring-emerald-500/30"
                          : "border-border/70 bg-background/85 text-muted-foreground hover:border-border hover:text-foreground"
                      )}
                    >
                      <span>{geo.city}</span>
                      {isMaster ? (
                        <span className="py-0.2 rounded bg-primary/20 px-1 font-mono text-[9px] font-bold text-primary">
                          MASTER
                        </span>
                      ) : (
                        <span className="font-semibold text-emerald-500">
                          {node.grpcLatencyMs}ms
                        </span>
                      )}
                    </span>
                  )}
                </button>

                {/* Floating Rich Inspection Card (Visible on Hover or Selection) */}
                {showCard && (
                  <motion.div
                    ref={isSelected ? cardRef : undefined}
                    initial={{ opacity: 0, scale: 0.95, y: isNearTop ? -4 : 4 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: isNearTop ? -4 : 4 }}
                    transition={{ duration: 0.15 }}
                    className={cn(
                      "pointer-events-auto absolute z-50 w-72 rounded-lg border p-3 text-left shadow-2xl backdrop-blur-md select-text",
                      isNearTop ? "top-7" : "-top-5 -translate-y-full",
                      isNearRight
                        ? "-left-4 -translate-x-full"
                        : isNearLeft
                          ? "left-4"
                          : "-translate-x-1/2",
                      isDead
                        ? "border-red-500/80 bg-card/98 text-foreground ring-1 ring-red-500/40 dark:bg-card/95"
                        : "border-border/90 bg-card/98 text-foreground ring-1 ring-border/50"
                    )}
                  >
                    {/* Header */}
                    <div className="flex items-start justify-between border-b border-border/70 pb-2">
                      <div className="flex items-center gap-2">
                        <Flag
                          src={geo.flag}
                          alt={`${geo.country} flag`}
                          width={21}
                          height={14}
                          className="h-3.5"
                        />
                        <div>
                          <h4 className="text-xs leading-tight font-bold text-foreground">
                            {node.name}
                          </h4>
                          <p className="font-mono text-[9.5px] text-muted-foreground">
                            {node.ipAddress} • {geo.city}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {/* Status indicator */}
                        <span
                          className={cn(
                            "rounded px-1.5 py-0.5 font-mono text-[9.5px] font-bold uppercase",
                            isDead
                              ? "border border-red-500/40 bg-red-500/15 text-red-600 dark:text-red-400"
                              : "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                          )}
                        >
                          {isDead ? "OFFLINE" : "ONLINE"}
                        </span>

                        {/* Direct Close Button */}
                        <Button
                          type="button"
                          size="icon-xs"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation()
                            onSelectNode(null)
                            setHoveredNodeId(null)
                          }}
                          className="size-5 rounded text-muted-foreground hover:bg-muted hover:text-foreground"
                          title="Close details (Esc)"
                          aria-label="Close card"
                        >
                          <X className="size-3" />
                        </Button>
                      </div>
                    </div>

                    {/* Offline Warning Banner */}
                    {isDead && (
                      <div className="mt-2 flex items-center gap-1.5 rounded border border-red-500/30 bg-red-500/10 px-2 py-1 font-mono text-[10px] text-red-600 dark:text-red-300">
                        <AlertTriangle className="size-3 shrink-0 text-red-500" />
                        <span>Connection dropped • Failover active</span>
                      </div>
                    )}

                    {/* Metrics Grid */}
                    <div className="mt-2.5 grid grid-cols-2 gap-1.5 font-mono text-[11px]">
                      <div className="rounded border border-border/60 bg-muted/30 p-1.5">
                        <span className="text-[9.5px] text-muted-foreground">
                          gRPC Latency
                        </span>
                        <div
                          className={cn(
                            "font-bold",
                            isDead
                              ? "text-red-600 dark:text-red-400"
                              : "text-foreground"
                          )}
                        >
                          {isDead ? "TIMEOUT" : `${node.grpcLatencyMs} ms`}
                        </div>
                      </div>

                      <div className="rounded border border-border/60 bg-muted/30 p-1.5">
                        <span className="flex items-center gap-1 text-[9.5px] text-muted-foreground">
                          <Cpu className="size-2.5" /> CPU Load
                        </span>
                        <div className="font-bold text-foreground">
                          {isDead ? "N/A" : `${node.cpuPercent}%`}
                        </div>
                      </div>

                      <div className="rounded border border-border/60 bg-muted/30 p-1.5">
                        <span className="flex items-center gap-1 text-[9.5px] text-muted-foreground">
                          <Layers className="size-2.5" /> Containers
                        </span>
                        <div className="font-bold text-foreground">
                          {isDead
                            ? "0 active"
                            : `${node.runningContainers} active`}
                        </div>
                      </div>

                      <div className="rounded border border-border/60 bg-muted/30 p-1.5">
                        <span className="text-[9.5px] text-muted-foreground">
                          Role
                        </span>
                        <div className="font-bold text-foreground uppercase">
                          {node.role}
                        </div>
                      </div>
                    </div>

                    {/* Controls */}
                    <div className="mt-2.5 flex items-center gap-1.5 border-t border-border/60 pt-2">
                      <Button
                        size="sm"
                        variant={isDead ? "default" : "destructive"}
                        onClick={(e) => {
                          e.stopPropagation()
                          onToggleNode(node.id)
                        }}
                        className="h-8 flex-1 gap-1.5 text-xs font-semibold"
                      >
                        <Power className="size-3.5" />
                        <span>{isDead ? "Restore Node" : "Crash Node"}</span>
                      </Button>

                      <Link href={`/nodes/${node.id}`} className="shrink-0">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 w-8 p-0"
                          title="Open in Nodes Console"
                          aria-label={`Open ${node.name} in Nodes Console`}
                        >
                          <ExternalLink className="size-3.5" />
                        </Button>
                      </Link>
                    </div>
                  </motion.div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
