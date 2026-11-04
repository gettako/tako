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
import {
  getNodeGeo,
  getClientGeoPoint,
  getClientOriginMeta,
  isInternalTraffic,
  NodeGeo,
  type ClientOriginMeta,
} from "@/lib/node-geo"
import { buildNodeSelectOptions } from "@/lib/node-select-options"
import {
  ClusterNode,
  NODE_ROLE,
  NODE_STATUS,
  type HttpTrafficEvent,
} from "@/types/platform"
import { cn } from "@/lib/utils"

export interface LiveTopologyMapProps {
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
  trafficEvents?: HttpTrafficEvent[]
  activeTrafficTab?: "http" | "system"
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
  offlineNodes: _offlineNodes = 0,
  avgLatency = 0,
  fullscreenHref,
  trafficEvents,
  activeTrafficTab: _activeTrafficTab,
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
    return nodes.find((n) => n.role === NODE_ROLE.MASTER) || nodes[0]
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

  // Ephemeral HTTP Request Traffic Beams & Arrival Ripples
  const [activeBeams, setActiveBeams] = React.useState<
    {
      id: string
      pathD: string
      color: string
      filterId: string
      targetNodeId: string
      targetX: number
      targetY: number
      statusCode: number
      sourceX: number
      sourceY: number
      originMeta?: ClientOriginMeta
    }[]
  >([])

  const [activeRipples, setActiveRipples] = React.useState<
    {
      id: string
      x: number
      y: number
      color: string
      nodeId: string
      statusCode: number
    }[]
  >([])

  // Live Node RPS Tracker
  const [nodeRps, setNodeRps] = React.useState<Record<string, number>>({})
  const nodeHitsRef = React.useRef<Record<string, number[]>>({})

  // Compute live moving requests per second (RPS) per node
  React.useEffect(() => {
    if (!isStreaming) return

    const rpsInterval = setInterval(() => {
      const now = Date.now()
      const windowMs = 4000
      const nextRps: Record<string, number> = {}

      for (const node of nodes) {
        const hits = nodeHitsRef.current[node.id] || []
        const recentHits = hits.filter((t) => now - t <= windowMs)
        nodeHitsRef.current[node.id] = recentHits

        if (recentHits.length > 0) {
          nextRps[node.id] = Math.max(
            1,
            Math.round((recentHits.length / (windowMs / 1000)) * 1.5)
          )
        } else {
          nextRps[node.id] = 0
        }
      }

      setNodeRps(nextRps)
    }, 1000)

    return () => clearInterval(rpsInterval)
  }, [isStreaming, nodes])

  const processedTrafficIds = React.useRef<Set<string>>(new Set())
  const activeTimers = React.useRef<NodeJS.Timeout[]>([])

  React.useEffect(() => {
    return () => {
      activeTimers.current.forEach(clearTimeout)
      activeTimers.current = []
    }
  }, [])

  // Top Traffic Origin Distribution (Live)
  const topOrigins = React.useMemo(() => {
    const validEvents = (trafficEvents || []).filter(
      (ev) => ev.clientIp && !isInternalTraffic(ev.clientIp, ev.path)
    )

    const counts: Record<
      string,
      { code: string; country: string; flag: string; count: number }
    > = {}
    let total = 0

    for (const ev of validEvents) {
      const meta = getClientOriginMeta(ev.clientIp)
      if (!counts[meta.code]) {
        counts[meta.code] = {
          code: meta.code,
          country: meta.country,
          flag: meta.flag,
          count: 0,
        }
      }
      counts[meta.code].count += 1
      total += 1
    }

    if (total === 0) {
      return [
        { code: "NL", country: "Netherlands", flag: "/images/flags/NL.png", percentage: 40 },
        { code: "ID", country: "Indonesia", flag: "/images/flags/ID.png", percentage: 30 },
        { code: "DE", country: "Germany", flag: "/images/flags/DE.png", percentage: 20 },
        { code: "SG", country: "Singapore", flag: "/images/flags/SG.png", percentage: 10 },
      ]
    }

    return Object.values(counts)
      .sort((a, b) => b.count - a.count)
      .slice(0, 4)
      .map((item) => ({
        ...item,
        percentage: Math.round((item.count / total) * 100),
      }))
  }, [trafficEvents])

  // Process live incoming HTTP traffic events
  React.useEffect(() => {
    if (
      !isStreaming ||
      !trafficEvents ||
      trafficEvents.length === 0 ||
      nodeGeoList.length === 0
    ) {
      return
    }

    const newEvents = trafficEvents.filter(
      (ev) => !processedTrafficIds.current.has(ev.id)
    )
    if (newEvents.length === 0) return

    // Cap to latest 4 events at a time so animations stay crisp and lightweight
    const slice = newEvents.slice(-4)
    for (const ev of slice) {
      processedTrafficIds.current.add(ev.id)
      if (processedTrafficIds.current.size > 200) {
        const arr = Array.from(processedTrafficIds.current)
        processedTrafficIds.current = new Set(arr.slice(arr.length - 100))
      }

      // Ignore internal node-to-node / healthcheck traffic from map beam visualization
      if (isInternalTraffic(ev.clientIp, ev.path)) continue

      const targetItem =
        nodeGeoList.find((n) => n.node.id === ev.nodeId) ||
        nodeGeoList[Math.floor(Math.random() * nodeGeoList.length)]
      if (!targetItem) continue

      const originMeta = ev.clientIp
        ? getClientOriginMeta(ev.clientIp)
        : undefined

      const sourcePt =
        ev.sourcePoint ||
        (originMeta
          ? { x: originMeta.pinX, y: originMeta.pinY }
          : masterGeo
            ? { x: masterGeo.pinX, y: masterGeo.pinY }
            : { x: 30, y: 30 })

      const targetPt = { x: targetItem.geo.pinX, y: targetItem.geo.pinY }
      const pathD = createCurvedPath(sourcePt, targetPt)

      let color = "#10b981"
      let filterId = "pulse-glow-green"
      if (ev.statusCode >= 500) {
        color = "#ef4444"
        filterId = "pulse-glow-red"
      } else if (ev.statusCode >= 400) {
        color = "#f59e0b"
        filterId = "pulse-glow-amber"
      } else if (ev.statusCode >= 300) {
        color = "#38bdf8"
        filterId = "pulse-glow-blue"
      }

      // Track hit timestamp for node RPS
      const now = Date.now()
      if (!nodeHitsRef.current[targetItem.node.id]) {
        nodeHitsRef.current[targetItem.node.id] = []
      }
      nodeHitsRef.current[targetItem.node.id].push(now)

      const beamId = `beam-${ev.id}-${Date.now()}`
      const newBeam = {
        id: beamId,
        pathD,
        color,
        filterId,
        targetNodeId: targetItem.node.id,
        targetX: targetPt.x,
        targetY: targetPt.y,
        statusCode: ev.statusCode,
        sourceX: sourcePt.x,
        sourceY: sourcePt.y,
        originMeta,
      }

      setActiveBeams((prev) => [...prev.slice(-12), newBeam])

      // At 900ms (arrival): remove beam, create ripple on target node
      const arrivalTimer = setTimeout(() => {
        setActiveBeams((prev) => prev.filter((b) => b.id !== beamId))

        const rippleId = `ripple-${beamId}`
        const newRipple = {
          id: rippleId,
          x: targetPt.x,
          y: targetPt.y,
          color,
          nodeId: targetItem.node.id,
          statusCode: ev.statusCode,
        }
        setActiveRipples((prev) => [...prev.slice(-8), newRipple])

        const endTimer = setTimeout(() => {
          setActiveRipples((prev) => prev.filter((r) => r.id !== rippleId))
        }, 600)
        activeTimers.current.push(endTimer)
      }, 900)

      activeTimers.current.push(arrivalTimer)
    }
  }, [trafficEvents, isStreaming, nodeGeoList, masterGeo])

  // Periodic ambient HTTP packet simulation when no explicit events are passed
  React.useEffect(() => {
    if (
      !isStreaming ||
      (trafficEvents && trafficEvents.length > 0) ||
      nodeGeoList.length === 0
    ) {
      return
    }

    const interval = setInterval(() => {
      const targetItem =
        nodeGeoList[Math.floor(Math.random() * nodeGeoList.length)]
      if (!targetItem || targetItem.node.status === NODE_STATUS.OFFLINE) return

      const randomIps = [
        "82.165.197.1",  // DE Frankfurt
        "145.220.1.10",  // NL Amsterdam
        "182.253.14.92", // ID Jakarta
        "13.250.12.88",  // SG Singapore
        "49.207.18.2",   // IN Mumbai
        "139.130.4.5",   // AU Sydney
        "84.115.22.10",  // GB London
      ]
      const clientIp = randomIps[Math.floor(Math.random() * randomIps.length)]
      const originMeta = getClientOriginMeta(clientIp)
      const clientPt = { x: originMeta.pinX, y: originMeta.pinY }
      const targetPt = { x: targetItem.geo.pinX, y: targetItem.geo.pinY }
      const pathD = createCurvedPath(clientPt, targetPt)

      const statusChoices = [200, 200, 200, 204, 304, 404, 502]
      const statusCode =
        statusChoices[Math.floor(Math.random() * statusChoices.length)]
      let color = "#10b981"
      let filterId = "pulse-glow-green"
      if (statusCode >= 500) {
        color = "#ef4444"
        filterId = "pulse-glow-red"
      } else if (statusCode >= 400) {
        color = "#f59e0b"
        filterId = "pulse-glow-amber"
      }

      const beamId = `beam-ambient-${Date.now()}`
      const newBeam = {
        id: beamId,
        pathD,
        color,
        filterId,
        targetNodeId: targetItem.node.id,
        targetX: targetPt.x,
        targetY: targetPt.y,
        sourceX: clientPt.x,
        sourceY: clientPt.y,
        originMeta,
        statusCode,
      }

      setActiveBeams((prev) => [...prev.slice(-10), newBeam])

      const arrivalTimer = setTimeout(() => {
        setActiveBeams((prev) => prev.filter((b) => b.id !== beamId))

        const rippleId = `ripple-${beamId}`
        const newRipple = {
          id: rippleId,
          x: targetPt.x,
          y: targetPt.y,
          color,
          nodeId: targetItem.node.id,
          statusCode,
        }
        setActiveRipples((prev) => [...prev.slice(-6), newRipple])

        const endTimer = setTimeout(() => {
          setActiveRipples((prev) => prev.filter((r) => r.id !== rippleId))
        }, 600)
        activeTimers.current.push(endTimer)
      }, 900)

      activeTimers.current.push(arrivalTimer)
    }, 2800)

    return () => clearInterval(interval)
  }, [isStreaming, trafficEvents, nodeGeoList])

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
                <filter
                  id="pulse-glow-amber"
                  x="-50%"
                  y="-50%"
                  width="200%"
                  height="200%"
                >
                  <feGaussianBlur stdDeviation="0.45" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
                <filter
                  id="pulse-glow-blue"
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
              </defs>

              {nodeGeoList.map(({ node, geo }, idx) => {
                // If it is the master node, do not draw connection to itself
                if (node.id === masterNode?.id) return null

                const isDead = node.status === NODE_STATUS.OFFLINE
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
              {/* Ephemeral HTTP Traffic Beams (1x bergerak lalu putus) */}
              {activeBeams.map((beam) => (
                <g key={beam.id}>
                  {/* Subtle launch pulse dot at client origin */}
                  <motion.circle
                    cx={beam.sourceX}
                    cy={beam.sourceY}
                    r={0.9}
                    fill={beam.color}
                    initial={{ scale: 0.6, opacity: 0.9 }}
                    animate={{ scale: [0.6, 1.8, 0], opacity: [0.9, 0.4, 0] }}
                    transition={{ duration: 0.75, ease: "easeOut" }}
                  />

                  {/* Subtle trajectory arc trail */}
                  <motion.path
                    d={beam.pathD}
                    fill="none"
                    stroke={beam.color}
                    strokeWidth={0.34}
                    strokeDasharray="2 2"
                    initial={{ pathLength: 0, opacity: 0 }}
                    animate={{
                      pathLength: [0, 1],
                      opacity: [0, 0.75, 0],
                    }}
                    transition={{
                      duration: 1.05,
                      times: [0, 0.4, 1],
                      ease: "easeInOut",
                    }}
                  />
                  {/* Glowing photon beam traveling along the curve */}
                  <motion.path
                    d={beam.pathD}
                    fill="none"
                    stroke={beam.color}
                    strokeWidth={0.7}
                    strokeLinecap="round"
                    filter={`url(#${beam.filterId})`}
                    initial={{ pathOffset: 0, pathLength: 0.15, opacity: 0 }}
                    animate={{
                      pathOffset: [0, 0.85],
                      opacity: [0, 1, 1, 0],
                    }}
                    transition={{
                      duration: 0.95,
                      times: [0, 0.1, 0.85, 1],
                      ease: "easeInOut",
                    }}
                  />
                </g>
              ))}

              {/* Ephemeral HTTP Arrival Ripples on Destination Node */}
              {activeRipples.map((ripple) => (
                <g key={ripple.id}>
                  <motion.circle
                    cx={ripple.x}
                    cy={ripple.y}
                    fill="none"
                    stroke={ripple.color}
                    strokeWidth={0.42}
                    initial={{ r: 0.8, opacity: 0.95 }}
                    animate={{ r: 4.8, opacity: 0 }}
                    transition={{ duration: 0.65, ease: "easeOut" }}
                  />
                </g>
              ))}
            </svg>
          )}

          {/* Ephemeral Client Origin Badges Overlaid Directly on Map Coordinates */}
          {(() => {
            const seenOrigins = new Set<string>()
            const latestPerOrigin: typeof activeBeams = []
            for (let i = activeBeams.length - 1; i >= 0; i--) {
              const b = activeBeams[i]
              if (!b.originMeta) continue
              const key = `${b.originMeta.code}-${b.originMeta.city}`
              if (!seenOrigins.has(key)) {
                seenOrigins.add(key)
                latestPerOrigin.push(b)
              }
            }
            return latestPerOrigin.map((beam) => {
              if (!beam.originMeta) return null
              const percentX = (beam.sourceX / 198) * 100
              const percentY = beam.sourceY

              return (
                <motion.div
                  key={`origin-badge-${beam.id}`}
                  initial={{ opacity: 0, scale: 0.85, y: 3 }}
                  animate={{
                    opacity: [0, 1, 1, 0],
                    scale: [0.85, 1, 1, 0.9],
                    y: [3, 0, 0, -3],
                  }}
                  transition={{
                    duration: 1.05,
                    times: [0, 0.15, 0.75, 1],
                    ease: "easeOut",
                  }}
                  style={{
                    left: `${percentX}%`,
                    top: `${percentY}%`,
                  }}
                  className="pointer-events-none absolute z-25 -translate-x-1/2 -translate-y-full pb-1 whitespace-nowrap select-none"
                >
                  <span
                    style={{
                      transform: `scale(${Math.min(1.15, Math.max(0.75, 1 / (zoom * 0.85)))})`,
                      transformOrigin: "center bottom",
                    }}
                    className="inline-flex items-center gap-1.5 rounded-md border border-border/80 bg-background/90 px-2 py-0.5 font-mono text-[9.5px] font-medium text-foreground shadow-2xs backdrop-blur-xs transition-all sm:text-[10.5px]"
                  >
                    <Flag
                      src={beam.originMeta.flag}
                      alt={`${beam.originMeta.country} flag`}
                      width={14}
                      height={10}
                      className="h-2.5 w-3.5 shrink-0 rounded-[2px] object-cover"
                    />
                    <span>{beam.originMeta.city}</span>
                  </span>
                </motion.div>
              )
            })
          })()}

          {/* Node Badges Overlaid Directly on Map Coordinates */}
          {nodeGeoList.map(({ node, geo }) => {
            const isMaster = node.id === masterNode?.id
            const isDead = node.status === NODE_STATUS.OFFLINE
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
                  {/* Live Node RPS Badge */}
                  {(nodeRps[node.id] || 0) > 0 && !isDead && (
                    <div className="pointer-events-none absolute -top-5.5 left-1/2 -translate-x-1/2">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 rounded-full border px-1.5 py-0.2 font-mono text-[8px] font-bold shadow-2xs backdrop-blur-xs transition-colors whitespace-nowrap",
                          (nodeRps[node.id] || 0) > 35
                            ? "border-red-500/50 bg-red-950/90 text-red-300"
                            : (nodeRps[node.id] || 0) > 15
                              ? "border-amber-500/50 bg-amber-950/90 text-amber-300"
                              : "border-emerald-500/50 bg-emerald-950/90 text-emerald-300"
                        )}
                      >
                        <span className="size-1 rounded-full bg-current animate-pulse" />
                        <span>{nodeRps[node.id]} rps</span>
                      </span>
                    </div>
                  )}

                  {/* Ephemeral HTTP arrival ripple ring */}
                  {activeRipples
                    .filter((r) => r.nodeId === node.id)
                    .map((r) => (
                      <motion.span
                        key={r.id}
                        initial={{ scale: 0.6, opacity: 1 }}
                        animate={{ scale: 3.2, opacity: 0 }}
                        transition={{ duration: 0.7, ease: "easeOut" }}
                        style={{ borderColor: r.color }}
                        className="pointer-events-none absolute size-8 rounded-full border-2"
                      />
                    ))}
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

      {/* Mini Top Origins Distribution (Bottom Left) */}
      {topOrigins.length > 0 && (
        <div className="absolute bottom-2 left-2 z-40 hidden sm:flex items-center gap-2 rounded-lg border border-border/80 bg-background/90 px-2.5 py-1.5 shadow-md backdrop-blur-md font-mono text-[10.5px]">
          <div className="flex items-center gap-1 text-muted-foreground font-semibold uppercase text-[9px] tracking-wider border-r border-border/70 pr-2">
            <span>Origins</span>
          </div>
          <div className="flex items-center gap-2.5">
            {topOrigins.map((origin) => (
              <div
                key={origin.code}
                className="flex items-center gap-1"
                title={`${origin.country}: ${origin.percentage}% of traffic`}
              >
                <Flag
                  src={origin.flag}
                  alt={`${origin.country} flag`}
                  width={13}
                  height={9}
                  className="h-2.5 w-3.5 shrink-0 rounded-[2px] object-cover"
                />
                <span className="font-medium text-foreground">{origin.code}</span>
                <span className="text-[9.5px] text-muted-foreground">
                  {origin.percentage}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

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
                        selectedNode.role === NODE_ROLE.MASTER
                          ? "bg-primary/15 text-primary"
                          : "bg-muted text-muted-foreground"
                      )}
                    >
                      {selectedNode.role}
                    </span>
                  </div>
                  <p className="font-mono text-[10.5px] text-muted-foreground">
                    {selectedNode.ipAddress} • {selectedGeo.city},{" "}
                    {selectedGeo.country}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 font-mono text-[10px] font-bold uppercase",
                    selectedNode.status === NODE_STATUS.OFFLINE
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
            {selectedNode.status === NODE_STATUS.OFFLINE && (
              <div className="mt-2.5 flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-2 font-mono text-xs text-red-600 dark:text-red-300">
                <AlertTriangle className="size-4 shrink-0 text-red-500" />
                <span>
                  Connection dropped. Failover cluster re-route active.
                </span>
              </div>
            )}

            {/* Telemetry Metrics Grid */}
            <div className="mt-3 grid grid-cols-2 gap-2 font-mono text-xs">
              <div className="rounded-lg border border-border/70 bg-muted/30 p-2.5">
                <span className="text-[10px] text-muted-foreground">
                  gRPC Latency
                </span>
                <div className="mt-0.5 text-sm font-bold text-foreground">
                  {selectedNode.status === NODE_STATUS.OFFLINE
                    ? "TIMEOUT"
                    : `${selectedNode.grpcLatencyMs} ms`}
                </div>
              </div>
              <div className="rounded-lg border border-border/70 bg-muted/30 p-2.5">
                <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                  <Cpu className="size-3" /> CPU Load
                </span>
                <div className="mt-0.5 text-sm font-bold text-foreground">
                  {selectedNode.status === NODE_STATUS.OFFLINE
                    ? "N/A"
                    : `${selectedNode.cpuPercent}%`}
                </div>
              </div>
              <div className="rounded-lg border border-border/70 bg-muted/30 p-2.5">
                <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                  <Layers className="size-3" /> Containers
                </span>
                <div className="mt-0.5 text-sm font-bold text-foreground">
                  {selectedNode.status === NODE_STATUS.OFFLINE
                    ? "0 active"
                    : `${selectedNode.runningContainers} active`}
                </div>
              </div>
              <div className="rounded-lg border border-border/70 bg-muted/30 p-2.5">
                <span className="text-[10px] text-muted-foreground">
                  Memory Load
                </span>
                <div className="mt-0.5 text-sm font-bold text-foreground">
                  {selectedNode.status === NODE_STATUS.OFFLINE
                    ? "N/A"
                    : `${selectedNode.memoryPercent}%`}
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
