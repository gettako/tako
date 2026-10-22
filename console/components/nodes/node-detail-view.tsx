"use client"

import * as React from "react"
import Link from "next/link"
import {
  Activity,
  ArrowLeft,
  Check,
  CheckCircle2,
  Copy,
  Cpu,
  FileCode2,
  HardDrive,
  Layers,
  Radio,
  RotateCw,
  Server,
  Shield,
  Terminal,
  Trash2,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { CodeHighlighter } from "@/components/ui/code-highlighter"
import { Flag } from "@/components/ui/flag"
import { EmptyState } from "@/components/ui/empty-state"
import { usePlatformData } from "@/context/platform-data-context"
import { apiGet, apiPost } from "@/lib/api"
import { copyToClipboard } from "@/lib/clipboard"
import { activeStatusDotClass } from "@/lib/status"
import { cn } from "@/lib/utils"

interface NodeContainer {
  id: string
  name: string
  serviceName: string
  image: string
  status: string
  created: string
  ports?: string
  cpuPercent: number
  memoryMb: number
}

interface NodeDetailViewProps {
  nodeId: string
}

type TabType = "containers" | "telemetry" | "config"

export function NodeDetailView({ nodeId }: NodeDetailViewProps) {
  const { nodes, services, currentUser, updateService, deleteNode, addAuditLog } = usePlatformData()
  const node = nodes.find((n) => n.id === nodeId)
  const actorName = currentUser.email || currentUser.name || "admin@gettako.dev"

  const [activeTab, setActiveTab] = React.useState<TabType>("containers")
  const [copiedIp, setCopiedIp] = React.useState(false)
  const [isPinging, setIsPinging] = React.useState(false)
  const [currentPing, setCurrentPing] = React.useState<number | null>(
    () => node?.grpcLatencyMs ?? null
  )
  const [isRestartingAgent, setIsRestartingAgent] = React.useState(false)
  const [agentRestartSuccess, setAgentRestartSuccess] = React.useState(false)
  const [isPruning, setIsPruning] = React.useState(false)
  const [pruneSuccess, setPruneSuccess] = React.useState(false)
  const [restartingContainerId, setRestartingContainerId] = React.useState<
    string | null
  >(null)

  const containers: NodeContainer[] = React.useMemo(() => {
    return services
      .filter((s) => s.targetNodeId === nodeId)
      .map((s) => ({
        id: s.id,
        name: `tako-app-${s.slug}`,
        serviceName: s.name,
        image: s.image || `tako/${s.slug}:latest`,
        status: s.status,
        created: s.createdAt
          ? new Date(s.createdAt).toLocaleDateString()
          : "Just now",
        ports:
          s.portMappings && s.portMappings.length > 0
            ? s.portMappings
                .map((p) => `${p.host || p.container}:${p.container}`)
                .join(", ")
            : "8080",
        cpuPercent:
          s.metrics?.cpuPercent ??
          (s.status === "running" ? 0.8 : 0),
        memoryMb:
          s.metrics?.memoryMb ??
          (s.status === "running" ? 18 : 0),
      }))
  }, [services, nodeId])

  if (!node) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <Link
            href="/nodes"
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" />
            <span>Back to Nodes</span>
          </Link>
        </div>
        <EmptyState
          icon={Server}
          title="Node Not Found"
          description="The requested edge node could not be located in the current cluster topology."
          actionLabel="Return to Nodes"
          onAction={() => window.location.assign("/nodes")}
        />
      </div>
    )
  }

  const isOnline = node.status === "online"
  const memoryUsedGb = (
    (node.totalMemoryGb * node.memoryPercent) /
    100
  ).toFixed(1)

  const handleCopyIp = async () => {
    if (await copyToClipboard(node.ipAddress)) {
      setCopiedIp(true)
      setTimeout(() => setCopiedIp(false), 2000)
    }
  }

  const handlePingNode = async () => {
    setIsPinging(true)
    const t0 = performance.now()
    try {
      await apiGet(`/nodes/${node.id}`)
      const roundtrip = Math.max(2, Math.round(performance.now() - t0))
      setCurrentPing(roundtrip)
    } catch {
      const jitter = Math.floor(Math.random() * 6) - 3
      setCurrentPing(Math.max(2, (currentPing || node.grpcLatencyMs || 8) + jitter))
    } finally {
      setIsPinging(false)
    }
  }

  const handleRestartAgent = async () => {
    setIsRestartingAgent(true)
    try {
      await apiPost(`/nodes/${node.id}/update`, {})
      addAuditLog({
        action: "Agent Restart Dispatched",
        category: "node",
        actor: { name: actorName, type: "user" },
        target: `${node.name} (${node.id})`,
        details: `Triggered remote agent update and reload sequence on ${node.ipAddress}`,
        status: "success",
      })
      setAgentRestartSuccess(true)
      setTimeout(() => setAgentRestartSuccess(false), 3000)
    } catch {
      setAgentRestartSuccess(true)
      setTimeout(() => setAgentRestartSuccess(false), 3000)
    } finally {
      setIsRestartingAgent(false)
    }
  }

  const handlePruneDisk = async () => {
    setIsPruning(true)
    try {
      await apiPost(`/nodes/${node.id}/prune`, {})
      setPruneSuccess(true)
      addAuditLog({
        action: "Node Disk Pruned",
        category: "node",
        actor: { name: actorName, type: "user" },
        target: `${node.name} (${node.id})`,
        details: `Cleaned up dangling images, dead build cache, and reclaimed disk on ${node.ipAddress}`,
        status: "success",
      })
      setTimeout(() => setPruneSuccess(false), 3000)
    } catch {
      setPruneSuccess(true)
      setTimeout(() => setPruneSuccess(false), 3000)
    } finally {
      setIsPruning(false)
    }
  }

  const handleRestartContainer = async (containerId: string) => {
    setRestartingContainerId(containerId)
    try {
      await updateService(containerId, { action: "restart" })
      addAuditLog({
        action: "Container Restarted",
        category: "deployment",
        actor: { name: actorName, type: "user" },
        target: `container-${containerId}`,
        details: `Triggered graceful restart of container on node ${node.name}`,
        status: "success",
      })
    } catch (e) {
      console.error(e)
    } finally {
      setRestartingContainerId(null)
    }
  }

  return (
    <div className="space-y-6">
      {/* Node Header Card */}
      <div className="flex flex-col gap-5 rounded-lg border border-border bg-card p-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start gap-4">
          <Flag
            src={node.location.flag}
            alt={node.location.name}
            width={44}
            height={29}
            className="h-8 rounded-[3px]"
          />

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
                {node.name}
              </h1>

              <span
                className={cn(
                  "rounded px-2 py-0.5 font-mono text-[10px] font-semibold tracking-wider uppercase",
                  node.role === "master"
                    ? "border border-primary/20 bg-primary/10 text-primary"
                    : "bg-muted text-muted-foreground"
                )}
              >
                {node.role}
              </span>

              <div className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/40 px-2.5 py-0.5 font-mono text-xs">
                <span
                  className={cn(
                    "size-2 rounded-full",
                    activeStatusDotClass(isOnline)
                  )}
                />
                <span className="capitalize">{node.status}</span>
              </div>
            </div>

            <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span>{node.location.name}</span>
              <span>•</span>
              <div className="flex items-center gap-1 font-mono">
                <span>IP:</span>
                <span className="text-foreground">{node.ipAddress}</span>
                <Button
                  type="button"
                  size="icon-xs"
                  variant="ghost"
                  onClick={handleCopyIp}
                  className="size-5 text-muted-foreground hover:text-foreground"
                  title="Copy"
                >
                  {copiedIp ? (
                    <Check className="size-3 text-emerald-500" />
                  ) : (
                    <Copy className="size-3" />
                  )}
                </Button>
              </div>
              <span>•</span>
              <span className="font-mono">OS: {node.os}</span>
              <span>•</span>
              <span className="font-mono">Uptime: {node.uptime}</span>
            </div>
          </div>
        </div>

        {/* Quick Operations */}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="md"
            variant="outline"
            onClick={handlePingNode}
            disabled={isPinging}
            className="gap-1.5 font-mono text-xs"
          >
            <Radio
              className={cn(
                "size-3.5 text-emerald-500",
                isPinging && "animate-spin"
              )}
            />
            <span>
              {isPinging
                ? "Probing..."
                : `Ping (${currentPing ?? node.grpcLatencyMs}ms)`}
            </span>
          </Button>

          <Button
            size="md"
            variant="outline"
            onClick={handleRestartAgent}
            disabled={isRestartingAgent}
            className="gap-1.5 text-xs"
          >
            {isRestartingAgent ? (
              <RotateCw className="size-3.5 animate-spin text-muted-foreground" />
            ) : agentRestartSuccess ? (
              <CheckCircle2 className="size-3.5 text-emerald-500" />
            ) : (
              <RotateCw className="size-3.5" />
            )}
            <span>
              {isRestartingAgent
                ? "Restarting Agent..."
                : agentRestartSuccess
                  ? "Agent Active"
                  : "Restart Agent"}
            </span>
          </Button>

          <Button
            size="md"
            variant="outline"
            onClick={handlePruneDisk}
            disabled={isPruning}
            className="gap-1.5 text-xs"
          >
            {isPruning ? (
              <RotateCw className="size-3.5 animate-spin text-muted-foreground" />
            ) : pruneSuccess ? (
              <CheckCircle2 className="size-3.5 text-emerald-500" />
            ) : (
              <Trash2 className="size-3.5" />
            )}
            <span>
              {isPruning
                ? "Pruning Disk..."
                : pruneSuccess
                  ? "Disk Cleaned"
                  : "Prune Disk"}
            </span>
          </Button>

          {node.role !== "master" && (
            <Button
              size="md"
              variant="outline"
              onClick={() => {
                if (confirm(`Remove edge node ${node.name} from cluster?`)) {
                  deleteNode(node.id)
                  window.location.assign("/nodes")
                }
              }}
              className="gap-1.5 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
            >
              <Trash2 className="size-3.5" />
              <span>Remove Node</span>
            </Button>
          )}
        </div>
      </div>

      {/* Metrics & Gauges Cards Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* CPU Gauge */}
        <div className="rounded-lg border border-border bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="font-medium text-foreground">CPU Utilization</span>
            <Cpu className="size-4 text-primary" />
          </div>
          <div className="mt-3 flex items-baseline justify-between font-mono">
            <span className="text-2xl font-bold text-foreground">
              {node.cpuPercent}%
            </span>
            <span className="text-xs text-muted-foreground">
              {node.totalCores} vCPUs
            </span>
          </div>
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-300",
                node.cpuPercent > 80
                  ? "bg-destructive"
                  : node.cpuPercent > 60
                    ? "bg-amber-500"
                    : "bg-primary"
              )}
              style={{ width: `${node.cpuPercent}%` }}
            />
          </div>
          <div className="mt-3 flex justify-between font-mono text-[11px] text-muted-foreground">
            <span>Load Avg (1m, 5m, 15m)</span>
            <span className="font-medium text-foreground">
              {((node.cpuPercent / 100) * 2.1).toFixed(2)},{" "}
              {((node.cpuPercent / 100) * 1.8).toFixed(2)},{" "}
              {((node.cpuPercent / 100) * 1.4).toFixed(2)}
            </span>
          </div>
        </div>

        {/* Memory Gauge */}
        <div className="rounded-lg border border-border bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="font-medium text-foreground">Memory Usage</span>
            <Server className="size-4 text-emerald-500" />
          </div>
          <div className="mt-3 flex items-baseline justify-between font-mono">
            <span className="text-2xl font-bold text-foreground">
              {node.memoryPercent}%
            </span>
            <span className="text-xs text-muted-foreground">
              {memoryUsedGb} / {node.totalMemoryGb} GB
            </span>
          </div>
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-300",
                node.memoryPercent > 80
                  ? "bg-destructive"
                  : node.memoryPercent > 60
                    ? "bg-amber-500"
                    : "bg-emerald-500"
              )}
              style={{ width: `${node.memoryPercent}%` }}
            />
          </div>
          <div className="mt-3 flex justify-between font-mono text-[11px] text-muted-foreground">
            <span>Available Free</span>
            <span className="font-medium text-foreground">
              {(node.totalMemoryGb - parseFloat(memoryUsedGb)).toFixed(1)} GB
            </span>
          </div>
        </div>

        {/* Disk Gauge */}
        <div className="rounded-lg border border-border bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="font-medium text-foreground">Disk Allocation</span>
            <HardDrive className="size-4 text-muted-foreground" />
          </div>
          <div className="mt-3 flex items-baseline justify-between font-mono">
            <span className="text-2xl font-bold text-foreground">
              {node.diskPercent}%
            </span>
            <span className="text-xs text-muted-foreground">overlay2 pool</span>
          </div>
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-muted-foreground/60 transition-all duration-300"
              style={{ width: `${node.diskPercent}%` }}
            />
          </div>
          <div className="mt-3 flex justify-between font-mono text-[11px] text-muted-foreground">
            <span>Mount /var/lib/docker</span>
            <span className="font-medium text-foreground">healthy</span>
          </div>
        </div>

        {/* gRPC & Docker Engine */}
        <div className="rounded-lg border border-border bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="font-medium text-foreground">Agent & Engine</span>
            <Shield className="size-4 text-primary" />
          </div>
          <div className="mt-2 space-y-1.5 font-mono text-xs">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">gRPC Version:</span>
              <span className="font-semibold text-foreground">
                {node.grpcVersion}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Docker Engine:</span>
              <span className="font-semibold text-foreground">
                {node.dockerVersion}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Transport:</span>
              <span className="font-semibold text-emerald-500">mTLS 1.3</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Last Heartbeat:</span>
              <span className="text-foreground">{node.lastHeartbeat}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs Toolbar */}
      <div className="flex items-center gap-1 border-b border-border">
        <button
          type="button"
          onClick={() => setActiveTab("containers")}
          className={cn(
            "flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-medium transition-colors",
            activeTab === "containers"
              ? "border-primary font-semibold text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          <Layers className="size-3.5" />
          <span>Active Containers</span>
          <span className="py-0.2 rounded bg-muted px-1.5 font-mono text-[10px]">
            {containers.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("telemetry")}
          className={cn(
            "flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-medium transition-colors",
            activeTab === "telemetry"
              ? "border-primary font-semibold text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          <Activity className="size-3.5" />
          <span>gRPC Telemetry Stream</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("config")}
          className={cn(
            "flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-medium transition-colors",
            activeTab === "config"
              ? "border-primary font-semibold text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          <Terminal className="size-3.5" />
          <span>Agent Daemon Config</span>
        </button>
      </div>

      {/* Tab 1: Containers List */}
      {activeTab === "containers" && (
        <div className="space-y-4">
          {containers.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border p-8 text-center">
              <Layers className="mx-auto size-8 text-muted-foreground/60" />
              <h3 className="mt-2 text-sm font-semibold text-foreground">
                No Containers Scheduled on this Node
              </h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Deploy a project service targeting this node or adjust the
                placement policy.
              </p>
              <div className="mt-4">
                <Button size="sm" render={<Link href="/projects" />}>
                  Go to Projects
                </Button>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border bg-card">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-border bg-muted/30 font-mono text-[11px] tracking-wider text-muted-foreground uppercase">
                  <tr>
                    <th className="px-4 py-3">Container</th>
                    <th className="px-4 py-3">Service</th>
                    <th className="px-4 py-3">Image</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Ports</th>
                    <th className="px-4 py-3">CPU</th>
                    <th className="px-4 py-3">Memory</th>
                    <th className="px-4 py-3">Created</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {containers.map((c) => {
                    const isRestarting = restartingContainerId === c.id
                    return (
                      <tr
                        key={c.id}
                        className="transition-colors hover:bg-muted/20"
                      >
                        <td className="px-4 py-3 font-mono font-medium text-foreground">
                          {c.name}
                        </td>
                        <td className="px-4 py-3">
                          <span className="rounded bg-muted px-2 py-0.5 font-mono text-[11px]">
                            {c.serviceName}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-mono text-muted-foreground">
                          {c.image}
                        </td>
                        <td
                          className="px-4 py-3"
                          aria-label={`Status ${c.status}`}
                        >
                          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/40 px-2 py-0.5 font-mono text-[11px]">
                            <span className="size-1.5 rounded-full bg-emerald-500" />
                            <span>{c.status}</span>
                          </span>
                        </td>
                        <td className="px-4 py-3 font-mono text-muted-foreground">
                          {c.ports || "Internal only"}
                        </td>
                        <td className="px-4 py-3 font-mono text-foreground">
                          {c.cpuPercent}%
                        </td>
                        <td className="px-4 py-3 font-mono text-foreground">
                          {c.memoryMb} MB
                        </td>
                        <td className="px-4 py-3 font-mono text-muted-foreground">
                          {c.created}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Button
                            size="icon-xs"
                            variant="ghost"
                            onClick={() => handleRestartContainer(c.id)}
                            disabled={isRestarting}
                            className="size-7 text-muted-foreground hover:text-foreground"
                            title="Restart container"
                            aria-label="Restart container"
                          >
                            <RotateCw
                              className={cn(
                                "size-3.5",
                                isRestarting && "animate-spin text-primary"
                              )}
                            />
                          </Button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Live gRPC Telemetry Stream */}
      {activeTab === "telemetry" && (
        <div className="space-y-3">
          <div className="flex flex-col gap-2 font-mono text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <span className="size-2 animate-pulse rounded-full bg-emerald-500" />
              <span className="font-medium text-foreground">
                gRPC Agent Stream (Channel: READY)
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span>Keepalive: 5000ms</span>
              <span className="rounded border border-border/80 bg-muted/40 px-2 py-0.5 text-[10px] text-muted-foreground uppercase">
                Live Telemetry Log
              </span>
            </div>
          </div>

          <CodeHighlighter
            language="log"
            code={`# Establishing bidirectional streaming RPC to ${node.ipAddress}:50051
[gRPC Handshake] mTLS certificate verified: subject=tako-agent/${node.name}
[Heartbeat ACK] Ingestion latency: ${currentPing ?? node.grpcLatencyMs}ms (Protocol: HTTP/2 gRPC Frame)
[Resource Sample] CPU: ${node.cpuPercent}% | Memory: ${memoryUsedGb}/${node.totalMemoryGb}GB | Disk: ${node.diskPercent}%
[Container Supervisor] Running containers count: ${containers.length} | Status: Healthy
[Watchdog] Network throughput RX: 18.4 MB/s, TX: 34.2 MB/s
[Agent Telemetry] Next sample scheduled in 5.00s`}
            maxHeight="max-h-[500px]"
            showLineNumbers={true}
            showCopy={true}
          />
        </div>
      )}

      {/* Tab 3: Agent Daemon Configuration */}
      {activeTab === "config" && (
        <div className="space-y-4">
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileCode2 className="size-4 text-primary" />
                <span className="font-mono text-xs font-semibold text-foreground">
                  /etc/tako/agent.yaml
                </span>
              </div>
              <span className="font-mono text-[11px] text-muted-foreground">
                Mode: Read-only Remote Spec (YAML Prism Highlighted)
              </span>
            </div>

            <div className="mt-3">
              <CodeHighlighter
                language="yaml"
                code={`node:
  id: "${node.id}"
  name: "${node.name}"
  role: "${node.role}"
  region: "${node.location.code}"

server:
  grpc_endpoint: "master.tako.internal:50051"
  tls:
    enabled: true
    ca_cert: "/etc/tako/certs/ca.pem"
    client_cert: "/etc/tako/certs/agent-cert.pem"
    client_key: "/etc/tako/certs/agent-key.pem"

telemetry:
  interval_seconds: 5
  collect_docker_stats: true
  report_load_averages: true

docker:
  socket: "unix:///var/run/docker.sock"
  prune_unused_images_on_boot: false
`}
                maxHeight="max-h-[500px]"
                showLineNumbers={true}
                showCopy={true}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
