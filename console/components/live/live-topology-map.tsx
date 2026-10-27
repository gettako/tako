"use client"

import * as React from "react"
import type { Route } from "next"
import Image from "next/image"
import Link from "next/link"
import DottedMap from "dotted-map"
import { motion } from "motion/react"
import {
  AlertTriangle,
  Cpu,
  ExternalLink,
  Layers,
  LocateFixed,
  Maximize2,
  Minus,
  Plus,
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
  onToggleNode?: (id: string) => void
  isStreaming?: boolean
  mobileView?: "split" | "map" | "log"
  onMobileViewChange?: (view: "split" | "map" | "log") => void
  onlineNodes?: number
  totalNodes?: number
  offlineNodes?: number
  avgLatency?: number
  fullscreenHref?: Route | string
}

export function LiveTopologyMap({
  nodes,
  selectedNodeId,
  onSelectNode,
  isStreaming = true,
  mobileView,
  onMobileViewChange,
  onlineNodes,
  totalNodes,
  offlineNodes = 0,
  avgLatency = 0,
  fullscreenHref,
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

  // Currently selected node and geo metadata
  const selectedNode = React.useMemo(() => {
    return nodes.find((n) => n.id === selectedNodeId) || null
  }, [nodes, selectedNodeId])

  const selectedGeo = React.useMemo(() => {
    return selectedNode ? getNodeGeo(selectedNode) : null
  }, [selectedNode])

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

  // Camera Zoom & Pan State
  const [zoom, setZoom] = React.useState<number>(1)
  const [pan, setPan] = React.useState<{ x: number; y: number }>({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = React.useState<boolean>(false)
  const viewportRef = React.useRef<HTMLDivElement>(null)

  // Centroid of all active cluster nodes
  const nodeCentroid = React.useMemo(() => {
    if (nodeGeoList.length === 0) return { x: 50, y: 50 }
    const sumX = nodeGeoList.reduce((acc, n) => acc + n.geo.percentX, 0)
    const sumY = nodeGeoList.reduce((acc, n) => acc + n.geo.percentY, 0)
    return {
      x: sumX / nodeGeoList.length,
      y: sumY / nodeGeoList.length,
    }
  }, [nodeGeoList])

  // Center & focus camera on cluster nodes
  const centerToNodes = React.useCallback(
    (targetZoom = 1.45) => {
      if (!viewportRef.current || nodeGeoList.length === 0) {
        setZoom(targetZoom)
        setPan({ x: 0, y: 0 })
        return
      }
      const rect = viewportRef.current.getBoundingClientRect()
      const containerAspect = rect.width / (rect.height || 1)
      const mapAspect = 198 / 100
      let mapW = rect.width
      let mapH = rect.width / mapAspect
      if (containerAspect > mapAspect) {
        mapH = rect.height
        mapW = rect.height * mapAspect
      }

      const offsetX = -((nodeCentroid.x - 50) / 100) * mapW * targetZoom
      const offsetY = -((nodeCentroid.y - 50) / 100) * mapH * targetZoom

      setZoom(targetZoom)
      setPan({ x: Math.round(offsetX), y: Math.round(offsetY) })
    },
    [nodeCentroid, nodeGeoList.length]
  )

  // Auto-center on nodes on initial mobile mount
  const didInitialCenter = React.useRef(false)
  React.useEffect(() => {
    if (didInitialCenter.current || nodeGeoList.length === 0) return
    if (typeof window !== "undefined" && window.innerWidth < 768) {
      const timer = setTimeout(() => {
        centerToNodes(1.45)
        didInitialCenter.current = true
      }, 150)
      return () => clearTimeout(timer)
    }
  }, [nodeGeoList, centerToNodes])

  // Pointer & Touch gesture handlers for Pan and Pinch-to-zoom
  const activePointers = React.useRef<Map<number, { x: number; y: number }>>(
    new Map()
  )
  const dragStartRef = React.useRef<{
    panX: number
    panY: number
    startX: number
    startY: number
    initialPinchDist?: number
    initialZoom?: number
  }>({ panX: 0, panY: 0, startX: 0, startY: 0 })

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement | null
    if (target?.closest("button") || target?.closest('[role="combobox"]')) {
      return
    }

    activePointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {}

    if (activePointers.current.size === 1) {
      dragStartRef.current = {
        panX: pan.x,
        panY: pan.y,
        startX: e.clientX,
        startY: e.clientY,
      }
      setIsDragging(true)
    } else if (activePointers.current.size === 2) {
      const pts = Array.from(activePointers.current.values())
      dragStartRef.current = {
        panX: pan.x,
        panY: pan.y,
        startX: (pts[0].x + pts[1].x) / 2,
        startY: (pts[0].y + pts[1].y) / 2,
        initialPinchDist: Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y),
        initialZoom: zoom,
      }
      setIsDragging(true)
    }
  }

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!activePointers.current.has(e.pointerId)) return
    activePointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })

    if (activePointers.current.size === 1) {
      const deltaX = e.clientX - dragStartRef.current.startX
      const deltaY = e.clientY - dragStartRef.current.startY
      setPan({
        x: Math.round(dragStartRef.current.panX + deltaX),
        y: Math.round(dragStartRef.current.panY + deltaY),
      })
    } else if (activePointers.current.size === 2) {
      const pts = Array.from(activePointers.current.values())
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y)
      if (
        dragStartRef.current.initialPinchDist &&
        dragStartRef.current.initialZoom
      ) {
        const ratio = dist / dragStartRef.current.initialPinchDist
        const nextZoom = Math.max(
          0.8,
          Math.min(3.5, Number((dragStartRef.current.initialZoom * ratio).toFixed(2)))
        )
        setZoom(nextZoom)
      }
    }
  }

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    activePointers.current.delete(e.pointerId)
    if (activePointers.current.size === 0) {
      setIsDragging(false)
    }
  }

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden rounded-xl border border-border/80 bg-card/70 shadow-lg backdrop-blur-md select-none">
      {/* Top Map Status Overlay */}
      <div className="absolute top-2 left-2 z-40 flex flex-wrap items-center gap-1.5 sm:top-3 sm:left-4 sm:gap-2">
        {/* Mobile Combined Status Pill (< sm) */}
        <div className="flex items-center gap-1.5 rounded-md border border-border/80 bg-background/90 px-2 py-1 text-[10.5px] font-mono shadow-xs backdrop-blur-md sm:hidden">
          <span className="flex size-2">
            <span
              className={cn(
                "size-2 rounded-full",
                isStreaming ? "animate-pulse bg-emerald-500" : "bg-amber-500"
              )}
            />
          </span>
          <span className="font-bold text-foreground">
            {typeof onlineNodes === "number" ? `${onlineNodes}/${totalNodes}` : "LIVE"}
          </span>
          {typeof avgLatency === "number" && (
            <>
              <span className="text-muted-foreground">•</span>
              <span className="text-foreground">{avgLatency}ms</span>
            </>
          )}
        </div>

        {/* Desktop Status Pill (sm+) */}
        <div className="hidden items-center gap-2 rounded-md border border-border/80 bg-background/90 px-2.5 py-1 text-xs shadow-xs backdrop-blur-md sm:flex">
          <span className="flex size-2">
            <span
              className={cn(
                "size-2 rounded-full",
                isStreaming ? "animate-pulse bg-emerald-500" : "bg-amber-500"
              )}
            />
          </span>
          <span className="font-mono font-medium text-foreground">
            {isStreaming ? "gRPC AGENT STREAM ONLINE" : "STREAM PAUSED"}
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

      {/* Top-Right: Mobile View Switcher (< md), Desktop Legend (md+), & Fullscreen Action */}
      <div className="absolute top-2 right-2 z-40 flex items-center gap-2 sm:top-3 sm:right-4">
        {/* Mobile Segmented View Switcher */}
        {onMobileViewChange && mobileView && (
          <div className="flex items-center rounded-md border border-border/70 bg-background/90 p-0.5 font-mono text-[10.5px] shadow-xs backdrop-blur-md md:hidden">
            {(["map", "split", "log"] as const).map((view) => (
              <button
                key={view}
                type="button"
                onClick={() => onMobileViewChange(view)}
                className={cn(
                  "rounded px-2 py-0.5 capitalize transition-colors",
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

        {/* Map Legend (Desktop) */}
        <div className="hidden items-center gap-3 rounded-md border border-border/80 bg-background/90 px-3 py-1 font-mono text-[11px] shadow-xs backdrop-blur-md md:flex">
          <div className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-emerald-500 shadow-[0_0_8px_#10b981]" />
            <span className="text-muted-foreground">Healthy Node</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-red-500 shadow-[0_0_8px_#ef4444]" />
            <span className="font-medium text-red-400">Dead / Outage</span>
          </div>
        </div>

        {/* Direct Fullscreen Wallboard Link */}
        {fullscreenHref && (
          <Link href={fullscreenHref as Route} title="Open in Fullscreen Live Wall">
            <Button
              size="sm"
              variant="outline"
              className="h-7 gap-1.5 rounded-md border-border/80 bg-background/90 px-2.5 font-mono text-xs shadow-xs backdrop-blur-md hover:border-emerald-500/50 hover:bg-background"
            >
              <Maximize2 className="size-3 text-emerald-500" />
              <span className="hidden sm:inline">Fullscreen</span>
            </Button>
          </Link>
        )}
      </div>

      {/* Dotted World Map Base */}
      <div
        ref={viewportRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        className={cn(
          "relative flex flex-1 items-center justify-center overflow-hidden p-2 sm:p-4 touch-none select-none",
          isDragging ? "cursor-grabbing" : "cursor-grab"
        )}
      >
        <div
          style={{
            transform: `translate3d(${pan.x}px, ${pan.y}px, 0px) scale(${zoom})`,
            transformOrigin: "center center",
            transition: isDragging
              ? "none"
              : "transform 250ms cubic-bezier(0.16, 1, 0.3, 1)",
          }}
          className="relative aspect-[198/100] w-full max-w-6xl will-change-transform"
        >
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
            const showCard = isSelected || (!selectedNodeId && isHovered)

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
                {/* Node Beacon Dot: Touch-friendly 44px tap target */}
                <button
                  type="button"
                  onClick={() => onSelectNode(isSelected ? null : node.id)}
                  aria-label={`Node ${node.name} in ${geo.city}`}
                  className="group pointer-events-auto absolute flex size-11 -translate-x-1/2 -translate-y-1/2 cursor-pointer items-center justify-center focus:outline-hidden sm:size-8"
                >
                  {/* Radar pulse aura */}
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

                {/* Micro-label: Positioned cleanly beside the dot with zoom counter-scaling */}
                <button
                  type="button"
                  onClick={() => onSelectNode(isSelected ? null : node.id)}
                  aria-label={`Select node ${node.name}`}
                  className={cn(
                    "pointer-events-auto absolute top-0 -translate-y-1/2 cursor-pointer whitespace-nowrap focus:outline-hidden",
                    placeLabelLeft ? "-left-2 sm:-left-3.5 -translate-x-full" : "left-2 sm:left-3.5"
                  )}
                >
                  <span
                    style={{
                      transform: `scale(${Math.min(1.15, Math.max(0.75, 1 / (zoom * 0.85)))})`,
                      transformOrigin: placeLabelLeft ? "right center" : "left center",
                    }}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 font-mono text-[9.5px] font-medium shadow-2xs backdrop-blur-xs transition-all sm:text-[10.5px]",
                      isSelected
                        ? "border-primary bg-card text-foreground ring-2 ring-primary/40 shadow-sm font-semibold"
                        : isDead
                          ? "border-red-500/80 bg-red-950/90 text-red-200"
                          : "border-border/80 bg-background/90 text-foreground hover:border-foreground/40"
                    )}
                  >
                    <span
                      className={cn(
                        "size-1.5 rounded-full shrink-0",
                        isDead ? "bg-red-500" : "bg-emerald-500 animate-pulse"
                      )}
                    />
                    <span>{geo.city}</span>
                    {isMaster ? (
                      <span className="rounded bg-primary/20 px-1 py-0.2 font-mono text-[9px] font-bold text-primary">
                        MASTER
                      </span>
                    ) : (
                      <span className={cn("font-semibold", isDead ? "text-red-400" : "text-emerald-500")}>
                        {isDead ? "DEAD" : `${node.grpcLatencyMs}ms`}
                      </span>
                    )}
                  </span>
                </button>

                {/* Inspection Card: Anchored popup on desktop only */}
                {showCard && (
                  <motion.div
                    ref={isSelected ? cardRef : undefined}
                    initial={{ opacity: 0, scale: 0.95, y: isNearTop ? -4 : 4 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: isNearTop ? -4 : 4 }}
                    transition={{ duration: 0.15 }}
                    className={cn(
                      "pointer-events-auto z-50 hidden p-3 text-left shadow-2xl backdrop-blur-md select-text",
                      "sm:block sm:absolute sm:inset-auto sm:w-72 sm:rounded-lg",
                      isNearTop ? "sm:top-7" : "sm:-top-5 sm:-translate-y-full",
                      isNearRight
                        ? "sm:-left-4 sm:-translate-x-full"
                        : isNearLeft
                          ? "sm:left-4"
                          : "sm:-translate-x-1/2",
                      isDead
                        ? "border border-red-500/80 bg-card/98 text-foreground ring-1 ring-red-500/40 dark:bg-card/95"
                        : "border border-border/90 bg-card/98 text-foreground ring-1 ring-border/50"
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

                    {/* Actions */}
                    <div className="mt-2.5 flex items-center gap-1.5 border-t border-border/60 pt-2">
                      <Link href={`/nodes/${node.id}`} className="w-full">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 w-full gap-1.5 text-xs font-medium text-foreground hover:bg-muted"
                        >
                          <ExternalLink className="size-3.5 text-muted-foreground" />
                          <span>View Node Details</span>
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

      {/* Floating Map Zoom & Center Controls */}
      <div className="absolute bottom-2 right-2 z-40 flex items-center gap-1 rounded-lg border border-border/80 bg-background/90 p-1 shadow-md backdrop-blur-md sm:bottom-3 sm:right-4">
        {/* Zoom In */}
        <button
          type="button"
          onClick={() =>
            setZoom((z) => Math.min(3.5, Number((z + 0.25).toFixed(2))))
          }
          className="flex size-7 items-center justify-center rounded-md text-foreground transition-transform hover:bg-muted active:scale-95"
          title="Zoom In (+)"
          aria-label="Zoom In"
        >
          <Plus className="size-3.5" />
        </button>

        {/* Zoom Out */}
        <button
          type="button"
          onClick={() =>
            setZoom((z) => Math.max(0.8, Number((z - 0.25).toFixed(2))))
          }
          className="flex size-7 items-center justify-center rounded-md text-foreground transition-transform hover:bg-muted active:scale-95"
          title="Zoom Out (-)"
          aria-label="Zoom Out"
        >
          <Minus className="size-3.5" />
        </button>

        <div className="h-4 w-px bg-border/80" />

        {/* Center / Focus on Nodes */}
        <button
          type="button"
          onClick={() =>
            centerToNodes(
              typeof window !== "undefined" && window.innerWidth < 768
                ? 1.45
                : 1.25
            )
          }
          className="flex size-7 items-center justify-center rounded-md text-foreground transition-transform hover:bg-muted active:scale-95"
          title="Focus & Center on cluster nodes"
          aria-label="Center on cluster nodes"
        >
          <LocateFixed className="size-3.5 text-primary" />
        </button>

        {/* Reset Zoom & Pan */}
        <button
          type="button"
          onClick={() => {
            setZoom(1)
            setPan({ x: 0, y: 0 })
          }}
          className="flex size-7 items-center justify-center rounded-md font-mono text-[10px] text-muted-foreground transition-transform hover:text-foreground active:scale-95"
          title="Reset to 1x view"
          aria-label="Reset to 1x view"
        >
          1x
        </button>
      </div>

      {/* Mobile Responsive Node Detail Modal Sheet (Rendered outside transformed container) */}
      {selectedNode && selectedGeo && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-xs sm:hidden">
          {/* Backdrop to dismiss */}
          <div
            className="absolute inset-0"
            onClick={() => onSelectNode(null)}
            aria-hidden="true"
          />

          {/* Modal Sheet Content */}
          <motion.div
            initial={{ y: "100%", opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "100%", opacity: 0 }}
            transition={{ type: "spring", damping: 26, stiffness: 280 }}
            className="relative z-10 w-full max-w-lg rounded-t-2xl border-t border-x border-border/80 bg-card/98 p-4 pb-6 shadow-2xl backdrop-blur-xl select-text"
          >
            {/* Top Drag Indicator Handle */}
            <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-muted-foreground/30" />

            {/* Header */}
            <div className="flex items-start justify-between border-b border-border/70 pb-3">
              <div className="flex items-center gap-2.5">
                <Flag
                  src={selectedGeo.flag}
                  alt={`${selectedGeo.country} flag`}
                  width={24}
                  height={16}
                  className="h-4 rounded-xs shadow-2xs"
                />
                <div>
                  <div className="flex items-center gap-1.5">
                    <h3 className="text-sm font-bold text-foreground">
                      {selectedNode.name}
                    </h3>
                    <span
                      className={cn(
                        "rounded px-1.5 py-0.2 font-mono text-[9px] font-bold uppercase",
                        selectedNode.role === "master"
                          ? "bg-primary/15 text-primary"
                          : "bg-muted text-muted-foreground"
                      )}
                    >
                      {selectedNode.role}
                    </span>
                  </div>
                  <p className="font-mono text-[10.5px] text-muted-foreground">
                    {selectedNode.ipAddress} • {selectedGeo.city}, {selectedGeo.country}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 font-mono text-[10px] font-bold uppercase",
                    selectedNode.status === "offline"
                      ? "bg-red-500/15 text-red-500"
                      : "bg-emerald-500/15 text-emerald-500"
                  )}
                >
                  {selectedNode.status}
                </span>
                <Button
                  type="button"
                  size="icon-xs"
                  variant="ghost"
                  onClick={() => onSelectNode(null)}
                  className="size-8 rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
                  aria-label="Close modal"
                >
                  <X className="size-4" />
                </Button>
              </div>
            </div>

            {/* Offline Alert Banner */}
            {selectedNode.status === "offline" && (
              <div className="mt-2.5 flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-2 font-mono text-xs text-red-600 dark:text-red-300">
                <AlertTriangle className="size-4 shrink-0 text-red-500" />
                <span>Connection dropped. Failover cluster re-route active.</span>
              </div>
            )}

            {/* Telemetry Metrics Grid */}
            <div className="mt-3 grid grid-cols-2 gap-2 font-mono text-xs">
              <div className="rounded-lg border border-border/70 bg-muted/30 p-2.5">
                <span className="text-[10px] text-muted-foreground">gRPC Latency</span>
                <div className="mt-0.5 text-sm font-bold text-foreground">
                  {selectedNode.status === "offline" ? "TIMEOUT" : `${selectedNode.grpcLatencyMs} ms`}
                </div>
              </div>
              <div className="rounded-lg border border-border/70 bg-muted/30 p-2.5">
                <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                  <Cpu className="size-3" /> CPU Load
                </span>
                <div className="mt-0.5 text-sm font-bold text-foreground">
                  {selectedNode.status === "offline" ? "N/A" : `${selectedNode.cpuPercent}%`}
                </div>
              </div>
              <div className="rounded-lg border border-border/70 bg-muted/30 p-2.5">
                <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                  <Layers className="size-3" /> Containers
                </span>
                <div className="mt-0.5 text-sm font-bold text-foreground">
                  {selectedNode.status === "offline" ? "0 active" : `${selectedNode.runningContainers} active`}
                </div>
              </div>
              <div className="rounded-lg border border-border/70 bg-muted/30 p-2.5">
                <span className="text-[10px] text-muted-foreground">Memory Load</span>
                <div className="mt-0.5 text-sm font-bold text-foreground">
                  {selectedNode.status === "offline" ? "N/A" : `${selectedNode.memoryPercent}%`}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="mt-4 flex gap-2">
              <Link href={`/nodes/${selectedNode.id}`} className="flex-1">
                <Button className="h-10 w-full gap-2 text-xs font-semibold">
                  <ExternalLink className="size-4" />
                  <span>Manage Node & Details</span>
                </Button>
              </Link>
              <Button
                type="button"
                variant="outline"
                onClick={() => onSelectNode(null)}
                className="h-10 px-4 text-xs font-medium"
              >
                Close
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  )
}
