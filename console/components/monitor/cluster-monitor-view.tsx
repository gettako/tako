"use client"

import * as React from "react"
import Link from "next/link"
import {
  Activity,
  ChevronRight,
  Cpu,
  Layers,
  Pause,
  Play,
  Radio,
  RefreshCw,
  Search,
  Server,
  Terminal,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { CodeHighlighter } from "@/components/ui/code-highlighter"
import { EmptyState } from "@/components/ui/empty-state"
import { Flag } from "@/components/ui/flag"
import { Input } from "@/components/ui/input"
import {
  SearchableSelect,
  type SelectOption,
} from "@/components/ui/searchable-select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ClusterCharts } from "@/components/monitor/cluster-charts"
import { usePlatformData } from "@/context/platform-data-context"
import { cn } from "@/lib/utils"

interface TelemetryPacket {
  id: string
  timestamp: string
  nodeId: string
  nodeName: string
  type: "heartbeat" | "resource" | "container" | "network"
  level: "info" | "warn" | "success"
  message: string
}

const INITIAL_PACKETS: TelemetryPacket[] = [
  {
    id: "pkt-1",
    timestamp: "10:18:42.108",
    nodeId: "node-master-sg",
    nodeName: "tako-master-sg01",
    type: "heartbeat",
    level: "success",
    message:
      "Bidirectional gRPC keepalive ACK. Ingestion roundtrip: 4ms. Channel state: READY",
  },
  {
    id: "pkt-2",
    timestamp: "10:18:41.890",
    nodeId: "node-worker-jp",
    nodeName: "tako-worker-tyo02",
    type: "resource",
    level: "info",
    message: "Resource metrics sample: CPU 54%, RAM 68% (43.5/64 GB), Disk 48%",
  },
  {
    id: "pkt-3",
    timestamp: "10:18:40.210",
    nodeId: "node-worker-au",
    nodeName: "tako-worker-syd03",
    type: "network",
    level: "info",
    message: "Egress burst reported: 1890.3 MB cumulative TX, 0 dropped frames",
  },
  {
    id: "pkt-4",
    timestamp: "10:18:38.995",
    nodeId: "node-master-sg",
    nodeName: "tako-master-sg01",
    type: "container",
    level: "info",
    message:
      "Container health inspection: tako_edge-router (HTTP 200 OK, latency 2ms)",
  },
  {
    id: "pkt-5",
    timestamp: "10:18:37.400",
    nodeId: "node-worker-jp",
    nodeName: "tako-worker-tyo02",
    type: "container",
    level: "info",
    message:
      "ClickHouse ingestion rate: 42,800 events/sec, buffer flush cycle complete",
  },
  {
    id: "pkt-6",
    timestamp: "10:18:36.120",
    nodeId: "node-worker-de",
    nodeName: "tako-worker-fra05",
    type: "heartbeat",
    level: "success",
    message:
      "Bidirectional gRPC keepalive ACK. Ingestion roundtrip: 74ms. Channel state: READY",
  },
  {
    id: "pkt-7",
    timestamp: "10:18:35.805",
    nodeId: "node-worker-us",
    nodeName: "tako-worker-sfo06",
    type: "resource",
    level: "info",
    message: "Resource metrics sample: CPU 49%, RAM 62% (39.7/64 GB), Disk 44%",
  },
  {
    id: "pkt-8",
    timestamp: "10:18:34.990",
    nodeId: "node-worker-uk",
    nodeName: "tako-worker-lon04",
    type: "network",
    level: "info",
    message: "Egress burst reported: 1240.5 MB cumulative TX, 0 dropped frames",
  },
]

export function ClusterMonitorView() {
  const { nodes, refresh, setDataMode } = usePlatformData()
  const [isStreaming, setIsStreaming] = React.useState(true)
  const [selectedNodeFilter, setSelectedNodeFilter] = React.useState("all")
  const [selectedTypeFilter, setSelectedTypeFilter] = React.useState("all")
  const [searchQuery, setSearchQuery] = React.useState("")
  const [packets, setPackets] =
    React.useState<TelemetryPacket[]>(INITIAL_PACKETS)
  const [isRefreshing, setIsRefreshing] = React.useState(false)

  // Periodic simulated packet streaming
  React.useEffect(() => {
    if (!isStreaming || nodes.length === 0) return

    const timer = setInterval(() => {
      const randomNode = nodes[Math.floor(Math.random() * nodes.length)]
      if (!randomNode) return

      const types: Array<TelemetryPacket["type"]> = [
        "heartbeat",
        "resource",
        "container",
        "network",
      ]
      const chosenType = types[Math.floor(Math.random() * types.length)]
      const timestamp =
        new Date().toTimeString().split(" ")[0] +
        "." +
        Math.floor(Math.random() * 900 + 100)

      let message = ""
      if (chosenType === "heartbeat") {
        message = `gRPC ping response: ${randomNode.grpcLatencyMs}ms (mTLS session valid, next interval 5s)`
      } else if (chosenType === "resource") {
        message = `Telemetry frame: CPU ${randomNode.cpuPercent}%, Memory ${randomNode.memoryPercent}%, Disk ${randomNode.diskPercent}%`
      } else if (chosenType === "container") {
        message = `Docker engine report: ${randomNode.runningContainers} containers active and supervised`
      } else {
        message = `Network socket telemetry: RX ${Math.floor(Math.random() * 40 + 10)} MB/s, TX ${Math.floor(Math.random() * 60 + 20)} MB/s`
      }

      const newPacket: TelemetryPacket = {
        id: `pkt-${Date.now()}`,
        timestamp,
        nodeId: randomNode.id,
        nodeName: randomNode.name,
        type: chosenType,
        level: "info",
        message,
      }

      setPackets((prev) => [newPacket, ...prev.slice(0, 49)])
    }, 3500)

    return () => clearInterval(timer)
  }, [isStreaming, nodes])

  const handleRefresh = async () => {
    setIsRefreshing(true)
    try {
      await refresh()
    } finally {
      setIsRefreshing(false)
    }
  }

  // Calculate aggregate metrics
  const totalCores = nodes.reduce((acc, n) => acc + n.totalCores, 0)
  const totalMemoryGb = nodes.reduce((acc, n) => acc + n.totalMemoryGb, 0)
  const avgCpuPercent =
    nodes.length > 0
      ? Math.round(
          nodes.reduce((acc, n) => acc + n.cpuPercent, 0) / nodes.length
        )
      : 0
  const avgMemoryPercent =
    nodes.length > 0
      ? Math.round(
          nodes.reduce((acc, n) => acc + n.memoryPercent, 0) / nodes.length
        )
      : 0
  const totalContainers = nodes.reduce((acc, n) => acc + n.runningContainers, 0)

  // Node filter options for SearchableSelect
  const nodeFilterOptions: SelectOption[] = React.useMemo(() => {
    const list: SelectOption[] = [
      { value: "all", label: "All Nodes (Entire Cluster)" },
    ]
    nodes.forEach((n) => {
      list.push({
        value: n.id,
        label: `${n.name} (${n.location.code})`,
        description: `${n.ipAddress} - ${n.location.name}`,
      })
    })
    return list
  }, [nodes])

  const typeFilterOptions: SelectOption[] = [
    { value: "all", label: "All Packet Types" },
    { value: "heartbeat", label: "Heartbeat Packets" },
    { value: "resource", label: "Resource Samples" },
    { value: "container", label: "Container Status" },
    { value: "network", label: "Network I/O Events" },
  ]

  const filteredPackets = packets.filter((pkt) => {
    if (selectedNodeFilter !== "all" && pkt.nodeId !== selectedNodeFilter) {
      return false
    }
    if (selectedTypeFilter !== "all" && pkt.type !== selectedTypeFilter) {
      return false
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      return (
        pkt.message.toLowerCase().includes(q) ||
        pkt.nodeName.toLowerCase().includes(q) ||
        pkt.type.toLowerCase().includes(q)
      )
    }
    return true
  })

  if (nodes.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
            Cluster Telemetry Monitor
          </h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Continuous real-time edge telemetry and gRPC stream aggregation.
          </p>
        </div>

        <EmptyState
          icon={Activity}
          title="No Connected Edge Nodes"
          description="There are currently no active edge nodes streaming telemetry to the master daemon."
          actionLabel="Connect Node"
          onAction={() => window.location.assign("/nodes")}
          secondaryActionLabel="Restore Sample Data"
          onSecondaryAction={() => setDataMode(true)}
        />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
            Cluster Telemetry Monitor
          </h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Continuous real-time edge telemetry, aggregate cluster compute, and
            gRPC transport health.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link href="/live">
            <Button
              size="md"
              variant="outline"
              className="gap-1.5 text-xs text-foreground hover:border-emerald-500/50 hover:bg-emerald-500/10"
            >
              <Radio className="size-3.5 animate-pulse text-emerald-500" />
              <span>Live Topology Wall</span>
            </Button>
          </Link>

          <Button
            size="md"
            variant="outline"
            onClick={() => setIsStreaming((prev) => !prev)}
            className="gap-1.5 text-xs"
          >
            {isStreaming ? (
              <>
                <Pause className="size-3.5 text-amber-500" />
                <span>Pause Stream</span>
              </>
            ) : (
              <>
                <Play className="size-3.5 text-emerald-500" />
                <span>Resume Stream</span>
              </>
            )}
          </Button>

          <Button
            size="md"
            variant="outline"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="gap-1.5 text-xs"
          >
            <RefreshCw
              className={cn("size-3.5", isRefreshing && "animate-spin")}
            />
            <span>Refresh</span>
          </Button>
        </div>
      </div>

      {/* Cluster Aggregate KPIs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Total Cluster CPU */}
        <div className="rounded-lg border border-border bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="font-medium text-foreground">Cluster Compute</span>
            <Cpu className="size-4 text-primary" />
          </div>
          <div className="mt-3 flex items-baseline justify-between font-mono">
            <span className="text-2xl font-bold text-foreground">
              {avgCpuPercent}%
            </span>
            <span className="text-xs text-muted-foreground">
              {totalCores} Total Cores
            </span>
          </div>
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-300",
                avgCpuPercent > 80
                  ? "bg-destructive"
                  : avgCpuPercent > 60
                    ? "bg-amber-500"
                    : "bg-primary"
              )}
              style={{ width: `${avgCpuPercent}%` }}
            />
          </div>
          <div className="mt-3 flex justify-between font-mono text-[11px] text-muted-foreground">
            <span>Aggregated across</span>
            <span className="font-medium text-foreground">
              {nodes.length} {nodes.length === 1 ? "Node" : "Nodes"}
            </span>
          </div>
        </div>

        {/* Total Cluster Memory */}
        <div className="rounded-lg border border-border bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="font-medium text-foreground">Cluster Memory</span>
            <Server className="size-4 text-emerald-500" />
          </div>
          <div className="mt-3 flex items-baseline justify-between font-mono">
            <span className="text-2xl font-bold text-foreground">
              {avgMemoryPercent}%
            </span>
            <span className="text-xs text-muted-foreground">
              {totalMemoryGb} GB Capacity
            </span>
          </div>
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-300",
                avgMemoryPercent > 80
                  ? "bg-destructive"
                  : avgMemoryPercent > 60
                    ? "bg-amber-500"
                    : "bg-emerald-500"
              )}
              style={{ width: `${avgMemoryPercent}%` }}
            />
          </div>
          <div className="mt-3 flex justify-between font-mono text-[11px] text-muted-foreground">
            <span>Total Used Approx</span>
            <span className="font-medium text-foreground">
              {((totalMemoryGb * avgMemoryPercent) / 100).toFixed(0)} GB
            </span>
          </div>
        </div>

        {/* Running Containers */}
        <div className="rounded-lg border border-border bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="font-medium text-foreground">
              Supervised Containers
            </span>
            <Layers className="size-4 text-primary" />
          </div>
          <div className="mt-3 flex items-baseline justify-between font-mono">
            <span className="text-2xl font-bold text-foreground">
              {totalContainers}
            </span>
            <span className="text-xs text-emerald-500">100% Healthy</span>
          </div>
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted">
            <div className="h-full w-full rounded-full bg-emerald-500" />
          </div>
          <div className="mt-3 flex justify-between font-mono text-[11px] text-muted-foreground">
            <span>Container Engine</span>
            <span className="font-medium text-foreground">
              Docker Engine v27
            </span>
          </div>
        </div>

        {/* gRPC Stream Latency */}
        <div className="rounded-lg border border-border bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="font-medium text-foreground">
              gRPC Transport Health
            </span>
            <Radio className="size-4 text-emerald-500" />
          </div>
          <div className="mt-2 space-y-1.5 font-mono text-xs">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Active Streams:</span>
              <span className="font-semibold text-emerald-500">
                {nodes.length} Bidirectional
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">p50 Latency:</span>
              <span className="font-semibold text-foreground">4ms</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">p95 / p99:</span>
              <span className="font-semibold text-foreground">28ms / 64ms</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Transport Security:</span>
              <span className="font-semibold text-emerald-500">
                mTLS Verified
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Tab Navigation: Option A */}
      <Tabs defaultValue="charts" className="w-full space-y-6">
        <div className="flex flex-col gap-3 border-b border-border pb-3 sm:flex-row sm:items-center sm:justify-between">
          <TabsList className="bg-muted/60 p-1">
            <TabsTrigger value="charts" className="gap-2 px-3 py-1.5 text-xs">
              <Activity className="size-3.5" />
              <span>Resource Charts & Trends</span>
            </TabsTrigger>
            <TabsTrigger value="nodes" className="gap-2 px-3 py-1.5 text-xs">
              <Server className="size-3.5" />
              <span>Node Matrix ({nodes.length})</span>
            </TabsTrigger>
            <TabsTrigger value="stream" className="gap-2 px-3 py-1.5 text-xs">
              <Terminal className="size-3.5" />
              <span>Live Telemetry Stream</span>
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Tab 1: Resource Charts & Trends */}
        <TabsContent value="charts" className="mt-0">
          <ClusterCharts nodes={nodes} isStreaming={isStreaming} />
        </TabsContent>

        {/* Tab 2: Edge Node Telemetry Matrix */}
        <TabsContent value="nodes" className="mt-0">
          <div>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold tracking-tight text-foreground">
                Edge Node Telemetry Matrix
              </h2>
              <span className="font-mono text-xs text-muted-foreground">
                {nodes.length} Nodes Online
              </span>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
              {nodes.map((node) => (
                <Link
                  key={node.id}
                  href={`/nodes/${node.id}`}
                  className="group flex flex-col rounded-lg border border-border bg-card p-4 transition-all hover:border-primary/50"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <Flag
                        src={node.location.flag}
                        alt={node.location.name}
                        width={24}
                        height={16}
                        className="h-4"
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-xs font-semibold text-foreground transition-colors group-hover:text-primary">
                            {node.name}
                          </span>
                          <span className="py-0.2 rounded bg-muted px-1 font-mono text-[9px] text-muted-foreground uppercase">
                            {node.role}
                          </span>
                        </div>
                        <span className="block truncate text-[11px] text-muted-foreground">
                          {node.location.name}
                        </span>
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-1.5 font-mono text-xs">
                      <Radio className="size-3 text-emerald-500" />
                      <span className="font-medium text-foreground">
                        {node.grpcLatencyMs}ms
                      </span>
                    </div>
                  </div>

                  {/* Progress bars */}
                  <div className="mt-4 space-y-2 font-mono text-xs">
                    <div>
                      <div className="mb-1 flex justify-between text-[11px] text-muted-foreground">
                        <span>CPU</span>
                        <span className="text-foreground">
                          {node.cpuPercent}%
                        </span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                        <div
                          className={cn(
                            "h-full rounded-full transition-all",
                            node.cpuPercent > 80
                              ? "bg-destructive"
                              : node.cpuPercent > 60
                                ? "bg-amber-500"
                                : "bg-primary"
                          )}
                          style={{ width: `${node.cpuPercent}%` }}
                        />
                      </div>
                    </div>

                    <div>
                      <div className="mb-1 flex justify-between text-[11px] text-muted-foreground">
                        <span>Memory</span>
                        <span className="text-foreground">
                          {node.memoryPercent}%
                        </span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-emerald-500 transition-all"
                          style={{ width: `${node.memoryPercent}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-between border-t border-border pt-2.5 font-mono text-[11px] text-muted-foreground">
                    <span>{node.runningContainers} containers</span>
                    <span className="inline-flex items-center gap-1 text-primary transition-transform group-hover:translate-x-0.5">
                      <span>Inspect</span>
                      <ChevronRight className="size-3" />
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </TabsContent>

        {/* Tab 3: Live gRPC Stream Feed Section */}
        <TabsContent value="stream" className="mt-0">
          <div className="space-y-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                <Terminal className="size-4 text-primary" />
                <h2 className="text-sm font-semibold tracking-tight text-foreground">
                  Live gRPC Telemetry Packets
                </h2>
                <div className="flex items-center gap-1.5 rounded-full border border-border bg-muted/40 px-2 py-0.5 font-mono text-[11px]">
                  <span
                    className={cn(
                      "size-1.5 rounded-full",
                      isStreaming
                        ? "animate-pulse bg-emerald-500"
                        : "bg-amber-500"
                    )}
                  />
                  <span>{isStreaming ? "Live Feed" : "Paused"}</span>
                </div>
              </div>

              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setPackets([])}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Clear Console
              </Button>
            </div>

            {/* Toolbar: Filters with SearchableSelect */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="relative">
                <Search className="absolute top-2.5 left-2.5 size-4 text-muted-foreground" />
                <Input
                  placeholder="Filter packet message..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 text-xs"
                />
              </div>

              <SearchableSelect
                value={selectedNodeFilter}
                onChange={(val) => setSelectedNodeFilter(val)}
                options={nodeFilterOptions}
                placeholder="Filter by node..."
                searchPlaceholder="Search nodes..."
              />

              <SearchableSelect
                value={selectedTypeFilter}
                onChange={(val) => setSelectedTypeFilter(val)}
                options={typeFilterOptions}
                placeholder="Filter by type..."
                searchPlaceholder="Search packet types..."
              />
            </div>

            {/* Terminal Log Console */}
            <div className="rounded-lg border border-border bg-muted/20 p-4 font-mono text-xs text-foreground dark:bg-muted/15">
              <div className="mb-3 flex flex-col gap-2 border-b border-border pb-2.5 text-[11px] text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2">
                  <span className="size-2 animate-pulse rounded-full bg-emerald-500" />
                  <span className="font-semibold text-foreground">
                    PACKET INGESTION BUFFER (RECENT {filteredPackets.length})
                  </span>
                  <span>• PROTOBUF v3 / HTTP2</span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="rounded border border-border/80 bg-muted/40 px-2 py-0.5 text-[10px] text-muted-foreground uppercase">
                    Telemetry Ingestion Log
                  </span>
                </div>
              </div>

              <CodeHighlighter
                language="log"
                code={
                  filteredPackets.length === 0
                    ? "# No telemetry packets matched the current filter criteria."
                    : filteredPackets
                        .map(
                          (pkt) =>
                            `[${pkt.timestamp}] [${pkt.type.toUpperCase()}] [${pkt.nodeName}] ${pkt.message}`
                        )
                        .join("\n")
                }
                maxHeight="max-h-96"
                showLineNumbers={true}
                showCopy={true}
              />
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
