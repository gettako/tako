"use client"

import * as React from "react"
import {
  ShieldCheckIcon,
  ArrowUpRightIcon,
  RadioIcon,
  LockIcon,
} from "lucide-react"

import { DEFAULT_PORTS } from "@/lib/api"
import { Flag } from "@/components/ui/flag"
import { WorldMap } from "@/components/ui/world-map"

interface AgentNode {
  id: string
  name: string
  city: string
  country: string
  flag: string
  latency: string
  status: "streaming" | "syncing"
  lat: number
  lng: number
  cardX: number
  cardY: number
}

const MASTER_HUB = {
  name: "Singapore Hub",
  country: "Singapore",
  flag: "/images/flags/SG.png",
  lat: 1.3521,
  lng: 103.8198,
  cardX: 74,
  cardY: 58,
}

const AGENT_NODES: AgentNode[] = [
  {
    id: "sfo",
    name: "tako-agent-us-01",
    city: "San Francisco",
    country: "United States",
    flag: "/images/flags/US.png",
    latency: "178ms",
    status: "streaming",
    lat: 37.7749,
    lng: -122.4194,
    cardX: 18,
    cardY: 26,
  },
  {
    id: "fra",
    name: "tako-agent-eu-02",
    city: "Frankfurt",
    country: "Germany",
    flag: "/images/flags/DE.png",
    latency: "162ms",
    status: "streaming",
    lat: 50.1109,
    lng: 8.6821,
    cardX: 47,
    cardY: 18,
  },
  {
    id: "tyo",
    name: "tako-agent-ap-03",
    city: "Tokyo",
    country: "Japan",
    flag: "/images/flags/JP.png",
    latency: "48ms",
    status: "streaming",
    lat: 35.6762,
    lng: 139.6503,
    cardX: 84,
    cardY: 22,
  },
  {
    id: "syd",
    name: "tako-agent-au-04",
    city: "Sydney",
    country: "Australia",
    flag: "/images/flags/AU.png",
    latency: "92ms",
    status: "streaming",
    lat: -33.8688,
    lng: 151.2093,
    cardX: 84,
    cardY: 82,
  },
]

export function NetworkNodesAnimation({
  className = "",
}: {
  className?: string
}) {
  const [activeNode, setActiveNode] = React.useState<string | null>(null)
  const [streamEvents, setStreamEvents] = React.useState<number>(38420)

  // Live stream events ticker to represent continuous outbound telemetry
  React.useEffect(() => {
    const interval = setInterval(() => {
      setStreamEvents((prev) => prev + Math.floor(Math.random() * 6) + 2)
    }, 1100)
    return () => clearInterval(interval)
  }, [])

  const mapDots = React.useMemo(
    () =>
      AGENT_NODES.map((agent) => ({
        start: {
          lat: agent.lat,
          lng: agent.lng,
          label: agent.city,
        },
        end: {
          lat: MASTER_HUB.lat,
          lng: MASTER_HUB.lng,
          label: MASTER_HUB.name,
        },
        latency: agent.latency,
      })),
    []
  )

  return (
    <div
      className={`relative flex w-full flex-col justify-between select-none ${className}`}
    >
      {/* Top Header: Flat, clean information bar */}
      <div className="mb-4 flex items-center justify-between px-1">
        <div className="flex items-center gap-2 font-mono text-xs text-muted-foreground">
          <RadioIcon className="size-3.5 animate-pulse text-emerald-500" />
          <span className="font-semibold text-foreground">
            Golang gRPC Mesh
          </span>
          <span className="hidden sm:inline">• Outbound Reverse Stream</span>
        </div>

        <div className="flex items-center gap-1 font-mono text-[11px] text-emerald-600 dark:text-emerald-400">
          <LockIcon className="size-3" />
          <span>Outbound Only • No SSH</span>
        </div>
      </div>

      {/* Main Map Canvas - Aceternity Dotted World Map */}
      <div className="relative my-auto flex w-full flex-1 items-center justify-center">
        <WorldMap dots={mapDots} lineColor="#10b981" className="w-full">
          {/* 4 Agent Node Interactive Badges */}
          {AGENT_NODES.map((agent) => {
            const isHovered = activeNode === agent.id

            return (
              <div
                key={agent.id}
                onMouseEnter={() => setActiveNode(agent.id)}
                onMouseLeave={() => setActiveNode(null)}
                style={{
                  left: `${agent.cardX}%`,
                  top: `${agent.cardY}%`,
                  transform: "translate(-50%, -50%)",
                }}
                className={`absolute z-20 flex cursor-pointer items-center gap-2 rounded-lg border px-2.5 py-1.5 transition-all duration-200 select-none ${
                  isHovered
                    ? "scale-105 border-emerald-500 bg-white shadow-md ring-2 shadow-emerald-500/15 ring-emerald-500/20 dark:border-emerald-400 dark:bg-card"
                    : "border-zinc-200/90 bg-white/95 text-zinc-900 shadow-xs backdrop-blur-sm hover:border-zinc-400 dark:border-border/70 dark:bg-background/85 dark:text-foreground dark:hover:border-foreground/40"
                }`}
              >
                <Flag
                  src={agent.flag}
                  alt={`${agent.country} flag`}
                  width={21}
                  height={14}
                  className="h-3.5"
                />
                <div className="flex flex-col">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-semibold text-zinc-900 dark:text-foreground">
                      {agent.city}
                    </span>
                    <span className="size-1.5 animate-pulse rounded-full bg-emerald-500" />
                  </div>
                  <div className="flex items-center gap-1.5 font-mono text-[9px] text-zinc-500 dark:text-muted-foreground">
                    <span className="flex items-center text-muted-foreground">
                      <ArrowUpRightIcon className="size-2.5" />
                      <span>Outbound</span>
                    </span>
                    <span>•</span>
                    <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                      {agent.latency}
                    </span>
                  </div>
                </div>
              </div>
            )
          })}

          {/* Central Master Hub Badge: SINGAPORE HUB 🇸🇬 */}
          <div
            style={{
              left: `${MASTER_HUB.cardX}%`,
              top: `${MASTER_HUB.cardY}%`,
              transform: "translate(-50%, -50%)",
            }}
            className="absolute z-20 flex flex-col items-center select-none"
          >
            <div className="relative flex items-center gap-2.5 rounded-lg border border-emerald-500/50 bg-white/95 px-3 py-1.5 shadow-xs backdrop-blur-sm dark:border-emerald-500/40 dark:bg-background/85">
              <Flag
                src={MASTER_HUB.flag}
                alt={`${MASTER_HUB.country} flag`}
                width={24}
                height={16}
                className="h-4 rounded-[2.5px]"
              />
              <div className="flex flex-col">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold tracking-tight text-zinc-900 dark:text-foreground">
                    {MASTER_HUB.name}
                  </span>
                  <span className="inline-flex items-center rounded-full bg-emerald-500/15 px-1.5 py-0.5 font-mono text-[8.5px] font-bold text-emerald-600 dark:text-emerald-400">
                    MASTER
                  </span>
                </div>
                <div className="flex items-center gap-1.5 font-mono text-[9.5px] text-zinc-500 dark:text-muted-foreground">
                  <span className="flex items-center gap-0.5 font-medium text-emerald-600 dark:text-emerald-400">
                    <ShieldCheckIcon className="size-2.5" />
                    <span>:{DEFAULT_PORTS.GRPC}</span>
                  </span>
                  <span>•</span>
                  <span>4 Inbound Streams</span>
                </div>
              </div>
            </div>
          </div>
        </WorldMap>
      </div>

      {/* Bottom Telemetry Ticker (Flat, minimal) */}
      <div className="mt-4 flex items-center justify-between px-1 font-mono text-[11px] text-muted-foreground">
        <div className="flex items-center gap-2">
          <span className="size-1.5 rounded-full bg-emerald-500" />
          <span className="font-medium text-foreground">Nodes:</span>
          <span>4 Agents Active (Golang daemon)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span>Telemetry Streamed:</span>
          <span className="font-bold text-foreground dark:text-primary">
            {streamEvents.toLocaleString()}
          </span>
        </div>
      </div>
    </div>
  )
}
