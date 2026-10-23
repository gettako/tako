"use client"

import { useRef, useMemo } from "react"
import { motion } from "motion/react"
import DottedMap from "dotted-map"

import Image from "next/image"

export interface MapProps {
  dots?: Array<{
    start: { lat: number; lng: number; label?: string }
    end: { lat: number; lng: number; label?: string }
    latency?: string | number
    flowDuration?: number
  }>
  lineColor?: string
  className?: string
  children?: React.ReactNode
}

export function WorldMap({
  dots = [],
  lineColor = "#ff552e",
  className = "",
  children,
}: MapProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const map = useMemo(
    () => new DottedMap({ height: 100, grid: "diagonal" }),
    []
  )

  const svgMapLight = useMemo(() => {
    return map.getSVG({
      radius: 0.22,
      color: "#64748b90",
      shape: "circle",
      backgroundColor: "transparent",
    })
  }, [map])

  const svgMapDark = useMemo(() => {
    return map.getSVG({
      radius: 0.22,
      color: "#FFFFFF40",
      shape: "circle",
      backgroundColor: "transparent",
    })
  }, [map])

  const projectPoint = (lat: number, lng: number) => {
    const x = (lng + 180) * (800 / 360)
    const y = (90 - lat) * (400 / 180)
    return { x, y }
  }

  const createCurvedPath = (
    start: { x: number; y: number },
    end: { x: number; y: number }
  ) => {
    const midX = (start.x + end.x) / 2
    const midY = Math.min(start.y, end.y) - 50
    return `M ${start.x} ${start.y} Q ${midX} ${midY} ${end.x} ${end.y}`
  }

  const getFlowDuration = (dot: {
    latency?: string | number
    flowDuration?: number
  }) => {
    if (dot.flowDuration) return dot.flowDuration
    if (dot.latency) {
      const ms = Number(String(dot.latency).replace(/\D/g, ""))
      if (!isNaN(ms) && ms > 0) {
        // Ultra-calm, graceful flow speeds proportional to node latency:
        // Tokyo (48ms) -> ~8.0s
        // Sydney (92ms) -> ~10.9s
        // Frankfurt (162ms) -> ~15.4s
        // San Francisco (178ms) -> ~16.5s
        return Number(Math.max(6.5, ms * 0.065 + 4.9).toFixed(2))
      }
    }
    return 10.0
  }

  return (
    <div
      className={`relative aspect-[2/1] w-full rounded-lg bg-transparent font-sans ${className}`}
    >
      <Image
        src={`data:image/svg+xml;utf8,${encodeURIComponent(svgMapLight)}`}
        className="pointer-events-none h-full w-full [mask-image:linear-gradient(to_bottom,transparent,white_10%,white_90%,transparent)] select-none dark:hidden"
        alt="world map light"
        height={495}
        width={1056}
        draggable={false}
        unoptimized
      />
      <Image
        src={`data:image/svg+xml;utf8,${encodeURIComponent(svgMapDark)}`}
        className="pointer-events-none hidden h-full w-full [mask-image:linear-gradient(to_bottom,transparent,white_10%,white_90%,transparent)] select-none dark:block"
        alt="world map dark"
        height={495}
        width={1056}
        draggable={false}
        unoptimized
      />
      <svg
        ref={svgRef}
        viewBox="0 0 800 400"
        className="pointer-events-none absolute inset-0 h-full w-full select-none"
      >
        <defs>
          <linearGradient id="path-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="white" stopOpacity="0" />
            <stop offset="5%" stopColor={lineColor} stopOpacity="1" />
            <stop offset="95%" stopColor={lineColor} stopOpacity="1" />
            <stop offset="100%" stopColor="white" stopOpacity="0" />
          </linearGradient>

          <filter id="flow-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2.5" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {dots.map((dot, i) => {
          const startPoint = projectPoint(dot.start.lat, dot.start.lng)
          const endPoint = projectPoint(dot.end.lat, dot.end.lng)
          const pathD = createCurvedPath(startPoint, endPoint)
          const flowDuration = getFlowDuration(dot)

          return (
            <g key={`path-group-${i}`}>
              {/* Static / Ambient Track Line with initial draw animation */}
              <motion.path
                d={pathD}
                fill="none"
                stroke="url(#path-gradient)"
                strokeWidth="1.2"
                strokeOpacity="0.35"
                initial={{
                  pathLength: 0,
                }}
                animate={{
                  pathLength: 1,
                }}
                transition={{
                  duration: 2.0,
                  delay: 0.4 * i,
                  ease: "easeOut",
                }}
                key={`start-upper-${i}`}
              />

              {/* Animated Dashed Outbound Stream Beam (Ultra-slow, serene fiber-optic drift) */}
              <path
                d={pathD}
                fill="none"
                stroke={lineColor}
                strokeWidth="1.2"
                strokeDasharray="4 10"
                className="animate-beam-dash"
                style={{
                  animationDuration: `${(flowDuration * 1.5).toFixed(2)}s`,
                }}
                strokeOpacity="0.45"
              />

              {/* Flowing Telemetry Packet (Single calm, graceful packet proportional to latency) */}
              <circle r="3.2" fill={lineColor} filter="url(#flow-glow)">
                <animateMotion
                  path={pathD}
                  dur={`${flowDuration}s`}
                  repeatCount="indefinite"
                />
              </circle>
            </g>
          )
        })}

        {/* Start Points (Agent Nodes) - Gentle 4s beacon pulse staggered per node */}
        {dots.map((dot, i) => {
          const pt = projectPoint(dot.start.lat, dot.start.lng)
          return (
            <g key={`start-point-${i}`}>
              <circle cx={pt.x} cy={pt.y} r="2" fill={lineColor} />
              <circle cx={pt.x} cy={pt.y} r="2" fill={lineColor} opacity="0.4">
                <animate
                  attributeName="r"
                  from="2"
                  to="7"
                  dur="4.0s"
                  begin={`${i * 0.9}s`}
                  repeatCount="indefinite"
                />
                <animate
                  attributeName="opacity"
                  from="0.4"
                  to="0"
                  dur="4.0s"
                  begin={`${i * 0.9}s`}
                  repeatCount="indefinite"
                />
              </circle>
            </g>
          )
        })}

        {/* Destination Points (Deduplicated Master Hubs) - Gentle 4s radar pulse */}
        {Array.from(
          new Map(
            dots.map((d) => [
              `${d.end.lat},${d.end.lng}`,
              projectPoint(d.end.lat, d.end.lng),
            ])
          ).values()
        ).map((pt, i) => (
          <g key={`end-point-${i}`}>
            <circle cx={pt.x} cy={pt.y} r="2.5" fill={lineColor} />
            <circle cx={pt.x} cy={pt.y} r="2.5" fill={lineColor} opacity="0.4">
              <animate
                attributeName="r"
                from="2.5"
                to="9"
                dur="4.0s"
                begin="0s"
                repeatCount="indefinite"
              />
              <animate
                attributeName="opacity"
                from="0.4"
                to="0"
                dur="4.0s"
                begin="0s"
                repeatCount="indefinite"
              />
            </circle>
          </g>
        ))}
      </svg>
      {children}
    </div>
  )
}

export default WorldMap
