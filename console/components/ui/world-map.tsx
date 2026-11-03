"use client"

import { useRef, useMemo } from "react"
import DottedMap from "dotted-map"
import Image from "next/image"
import { projectCoordinatesToPercent } from "@/lib/node-geo"

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
  lineColor = "#10b981",
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
      color: "#47556960",
      shape: "circle",
      backgroundColor: "transparent",
    })
  }, [map])

  const svgMapDark = useMemo(() => {
    return map.getSVG({
      radius: 0.22,
      color: "#FFFFFF35",
      shape: "circle",
      backgroundColor: "transparent",
    })
  }, [map])

  // Geodesic curved path matching LiveTopologyMap
  const createCurvedPath = (
    start: { x: number; y: number },
    end: { x: number; y: number }
  ) => {
    const dx = end.x - start.x
    const dy = end.y - start.y
    const dist = Math.sqrt(dx * dx + dy * dy)
    // Organic geodesic arc proportional to span distance
    const curvature = Math.min(7.5, Math.max(2, dist * 0.075))
    const cp1x = start.x + dx * 0.3
    const cp1y = start.y + dy * 0.3 - curvature
    const cp2x = start.x + dx * 0.7
    const cp2y = start.y + dy * 0.7 - curvature
    return `M ${start.x.toFixed(2)} ${start.y.toFixed(2)} C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)}, ${cp2x.toFixed(2)} ${cp2y.toFixed(2)}, ${end.x.toFixed(2)} ${end.y.toFixed(2)}`
  }

  const getFlowDuration = (dot: {
    latency?: string | number
    flowDuration?: number
  }) => {
    if (dot.flowDuration) return dot.flowDuration
    if (dot.latency) {
      const ms = Number(String(dot.latency).replace(/\D/g, ""))
      if (!isNaN(ms) && ms > 0) {
        return Math.max(3.5, ms * 0.08 + 2.5)
      }
    }
    return 6.0
  }

  return (
    <div
      className={`relative aspect-[198/100] w-full rounded-lg bg-transparent font-sans ${className}`}
    >
      <Image
        src={`data:image/svg+xml;utf8,${encodeURIComponent(svgMapLight)}`}
        className="pointer-events-none h-full w-full [mask-image:linear-gradient(to_bottom,transparent,white_8%,white_92%,transparent)] select-none dark:hidden"
        alt="world map light"
        height={1000}
        width={1980}
        draggable={false}
        unoptimized
      />
      <Image
        src={`data:image/svg+xml;utf8,${encodeURIComponent(svgMapDark)}`}
        className="pointer-events-none hidden h-full w-full [mask-image:linear-gradient(to_bottom,transparent,white_8%,white_92%,transparent)] select-none dark:block"
        alt="world map dark"
        height={1000}
        width={1980}
        draggable={false}
        unoptimized
      />
      <svg
        ref={svgRef}
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
        </defs>

        {dots.map((dot, i) => {
          const startGeo = projectCoordinatesToPercent(
            dot.start.lat,
            dot.start.lng
          )
          const endGeo = projectCoordinatesToPercent(dot.end.lat, dot.end.lng)
          const startPoint = { x: startGeo.pinX, y: startGeo.pinY }
          const endPoint = { x: endGeo.pinX, y: endGeo.pinY }
          const pathD = createCurvedPath(startPoint, endPoint)
          const flowDuration = getFlowDuration(dot)

          return (
            <g key={`traffic-link-${i}`}>
              {/* Background subtle glow curve */}
              <path
                d={pathD}
                fill="none"
                stroke={lineColor}
                strokeWidth="0.36"
                strokeOpacity="0.15"
              />

              {/* Main crisp delicate curve */}
              <path
                d={pathD}
                fill="none"
                stroke={lineColor}
                strokeWidth="0.22"
                strokeOpacity="0.55"
              />

              {/* Animated stream packet: precise small beacon */}
              <circle r="0.55" fill={lineColor} filter="url(#pulse-glow-green)">
                <animateMotion
                  path={pathD}
                  dur={`${flowDuration.toFixed(2)}s`}
                  repeatCount="indefinite"
                />
              </circle>
            </g>
          )
        })}

        {/* Start Points (Agent Nodes) - Solid dot + breathing halo + radar wave */}
        {dots.map((dot, i) => {
          const startGeo = projectCoordinatesToPercent(
            dot.start.lat,
            dot.start.lng
          )
          const pt = { x: startGeo.pinX, y: startGeo.pinY }

          return (
            <g key={`start-point-${i}`}>
              {/* Solid center dot */}
              <circle cx={pt.x} cy={pt.y} r="0.45" fill={lineColor} />

              {/* Breathing pulse halo */}
              <circle
                cx={pt.x}
                cy={pt.y}
                r="0.8"
                fill={lineColor}
                opacity="0.25"
              >
                <animate
                  attributeName="opacity"
                  values="0.45;0.08;0.45"
                  dur="2.4s"
                  begin={`${i * 0.25}s`}
                  repeatCount="indefinite"
                />
              </circle>

              {/* Radar pulse wave */}
              <circle
                cx={pt.x}
                cy={pt.y}
                r="0.5"
                fill={lineColor}
                opacity="0.3"
              >
                <animate
                  attributeName="r"
                  from="0.5"
                  to="2.2"
                  dur="3.0s"
                  begin={`${i * 0.6}s`}
                  repeatCount="indefinite"
                />
                <animate
                  attributeName="opacity"
                  from="0.3"
                  to="0"
                  dur="3.0s"
                  begin={`${i * 0.6}s`}
                  repeatCount="indefinite"
                />
              </circle>
            </g>
          )
        })}

        {/* Central Master Hub Beacon Pulse */}
        {Array.from(
          new Map(
            dots.map((d) => {
              const geo = projectCoordinatesToPercent(d.end.lat, d.end.lng)
              return [`${d.end.lat},${d.end.lng}`, { x: geo.pinX, y: geo.pinY }]
            })
          ).values()
        ).map((pt, i) => (
          <g key={`master-pulse-${i}`}>
            {/* Solid center dot */}
            <circle cx={pt.x} cy={pt.y} r="0.6" fill={lineColor} />

            {/* Breathing pulse halo */}
            <circle cx={pt.x} cy={pt.y} r="1.2" fill={lineColor} opacity="0.3">
              <animate
                attributeName="opacity"
                values="0.55;0.1;0.55"
                dur="2.4s"
                repeatCount="indefinite"
              />
            </circle>

            {/* Radar pulse wave */}
            <circle cx={pt.x} cy={pt.y} r="0.6" fill={lineColor} opacity="0.35">
              <animate
                attributeName="r"
                from="0.6"
                to="2.8"
                dur="3.0s"
                begin="0s"
                repeatCount="indefinite"
              />
              <animate
                attributeName="opacity"
                from="0.35"
                to="0"
                dur="3.0s"
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
