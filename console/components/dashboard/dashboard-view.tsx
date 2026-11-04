"use client"

import * as React from "react"
import Link from "next/link"
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  Layers,
  Plus,
  Radio,
  ScrollText,
  Server,
  ShieldCheck,
  XCircle,
} from "lucide-react"

import { AddNodeDialog } from "@/components/nodes/add-node-dialog"
import { NodeRoleBadge } from "@/components/nodes/node-role-badge"
import { CreateProjectDialog } from "@/components/projects/create-project-dialog"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { Flag } from "@/components/ui/flag"
import { usePlatformData } from "@/context/platform-data-context"
import { formatNodeLocation } from "@/lib/adapters"
import { statusDotClass } from "@/lib/status"
import { cn } from "@/lib/utils"
import { ClusterNode, NODE_STATUS, SERVICE_STATUS } from "@/types/platform"

function formatRelativeTime(timestamp: string): string {
  try {
    const diffMs = Date.now() - new Date(timestamp).getTime()
    if (Number.isNaN(diffMs) || diffMs < 0) return timestamp
    const diffSec = Math.floor(diffMs / 1000)
    if (diffSec < 60) return "just now"
    const diffMin = Math.floor(diffSec / 60)
    if (diffMin < 60) return `${diffMin}m ago`
    const diffHours = Math.floor(diffMin / 60)
    if (diffHours < 24) return `${diffHours}h ago`
    const diffDays = Math.floor(diffHours / 24)
    return `${diffDays}d ago`
  } catch {
    return timestamp
  }
}

export function DashboardView() {
  const { nodes, projects, services, auditLogs, setDataMode } =
    usePlatformData()

  const [addNodeOpen, setAddNodeOpen] = React.useState(false)
  const [createProjectOpen, setCreateProjectOpen] = React.useState(false)

  // Aggregates & cluster health calculations
  const onlineNodes = React.useMemo(
    () => nodes.filter((n) => n.status === NODE_STATUS.ONLINE),
    [nodes]
  )
  const degradedNodes = React.useMemo(
    () => nodes.filter((n) => n.status === NODE_STATUS.DEGRADED),
    [nodes]
  )
  const offlineNodes = React.useMemo(
    () => nodes.filter((n) => n.status === NODE_STATUS.OFFLINE),
    [nodes]
  )
  const runningServices = React.useMemo(
    () => services.filter((s) => s.status === SERVICE_STATUS.RUNNING),
    [services]
  )
  const failedServices = React.useMemo(
    () => services.filter((s) => s.status === SERVICE_STATUS.FAILED),
    [services]
  )
  const deployingServices = React.useMemo(
    () => services.filter((s) => s.status === SERVICE_STATUS.DEPLOYING),
    [services]
  )

  const totalCores = nodes.reduce((acc, n) => acc + n.totalCores, 0)
  const totalMemory = nodes.reduce((acc, n) => acc + n.totalMemoryGb, 0)

  const avgCpu =
    onlineNodes.length > 0
      ? Math.round(
          onlineNodes.reduce((acc, n) => acc + n.cpuPercent, 0) /
            onlineNodes.length
        )
      : 0
  const avgMem =
    onlineNodes.length > 0
      ? Math.round(
          onlineNodes.reduce((acc, n) => acc + n.memoryPercent, 0) /
            onlineNodes.length
        )
      : 0
  const avgLatency =
    onlineNodes.length > 0
      ? Math.max(
          1,
          Math.round(
            onlineNodes.reduce((acc, n) => acc + (n.grpcLatencyMs || 0), 0) /
              onlineNodes.length
          )
        )
      : null

  // Prioritize nodes that need attention (offline/degraded first, then highest CPU load)
  const prioritizedNodes = React.useMemo(() => {
    return [...nodes].sort((a, b) => {
      const score = (n: ClusterNode) => {
        if (n.status === NODE_STATUS.OFFLINE) return 3
        if (n.status === NODE_STATUS.DEGRADED) return 2
        return n.cpuPercent > 80 ? 1 : 0
      }
      const scoreDiff = score(b) - score(a)
      if (scoreDiff !== 0) return scoreDiff
      return b.cpuPercent - a.cpuPercent
    })
  }, [nodes])

  // Recent 7 audit events
  const recentLogs = React.useMemo(() => {
    return [...auditLogs]
      .sort(
        (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      )
      .slice(0, 7)
  }, [auditLogs])

  const hasData = nodes.length > 0 || projects.length > 0

  const clusterStatus = React.useMemo(() => {
    if (offlineNodes.length > 0 || failedServices.length > 0) {
      const issues: string[] = []
      if (offlineNodes.length > 0) {
        issues.push(
          `${offlineNodes.length} node${offlineNodes.length > 1 ? "s" : ""} offline`
        )
      }
      if (failedServices.length > 0) {
        issues.push(
          `${failedServices.length} service${failedServices.length > 1 ? "s" : ""} failed`
        )
      }
      return {
        label: issues.join(" • "),
        dotClass: "bg-destructive",
        badgeClass: "border-destructive/30 bg-destructive/10 text-destructive",
      }
    }
    if (degradedNodes.length > 0) {
      return {
        label: `${degradedNodes.length} node${degradedNodes.length > 1 ? "s" : ""} degraded`,
        dotClass: "bg-amber-500",
        badgeClass: "border-amber-500/30 bg-amber-500/10 text-amber-500",
      }
    }
    if (deployingServices.length > 0) {
      return {
        label: `Deploying ${deployingServices.length} workload${deployingServices.length > 1 ? "s" : ""}...`,
        dotClass: "animate-pulse bg-blue-500",
        badgeClass: "border-blue-500/30 bg-blue-500/10 text-blue-500",
      }
    }
    if (nodes.length > 0 || services.length > 0) {
      return {
        label: "All systems operational",
        dotClass: "bg-emerald-500",
        badgeClass: "border-emerald-500/30 bg-emerald-500/10 text-emerald-500",
      }
    }
    return {
      label: "Zero workloads deployed",
      dotClass: "bg-muted-foreground",
      badgeClass: "border-border bg-muted/40 text-muted-foreground",
    }
  }, [
    nodes.length,
    services.length,
    offlineNodes.length,
    degradedNodes.length,
    failedServices.length,
    deployingServices.length,
  ])

  return (
    <div className="space-y-6">
      {/* Page Title & Focused Primary Actions */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
              Cluster Telemetry & Control
            </h1>
            <div
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-mono text-[11px] font-medium tracking-wide",
                clusterStatus.badgeClass
              )}
            >
              <span
                className={cn("size-1.5 rounded-full", clusterStatus.dotClass)}
              />
              <span>{clusterStatus.label}</span>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Real-time gRPC edge telemetry coordination and container deployment
            platform.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCreateProjectOpen(true)}
            className="gap-1.5 text-xs"
          >
            <Plus className="size-3.5" />
            <span>New Project</span>
          </Button>

          <Button
            size="sm"
            onClick={() => setAddNodeOpen(true)}
            className="gap-1.5 text-xs"
          >
            <Server className="size-3.5" />
            <span>Connect Node</span>
          </Button>
        </div>
      </div>

      {/* Aggregate Metric Cards (Unified Telemetry Strip) */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Edge Nodes */}
        <div className="flex flex-col justify-between rounded-lg border border-border bg-card p-4 shadow-xs transition-colors hover:border-border/80">
          <div>
            <div className="flex items-center justify-between font-mono text-xs text-muted-foreground">
              <span>Edge Fleet</span>
              <Server className="size-4 text-primary" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="font-mono text-2xl font-bold text-foreground">
                {onlineNodes.length}
                <span className="text-base font-normal text-muted-foreground">
                  /{nodes.length}
                </span>
              </span>
              <span className="font-mono text-xs text-muted-foreground">
                online
              </span>
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between border-t border-border/50 pt-2.5 font-mono text-[11px] text-muted-foreground">
            <span>
              {totalCores} vCPUs • {totalMemory} GB RAM
            </span>
            <Link
              href="/nodes"
              className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
            >
              <span>View Fleet</span>
              <ArrowUpRight className="size-3" />
            </Link>
          </div>
        </div>

        {/* Workloads & Services */}
        <div className="flex flex-col justify-between rounded-lg border border-border bg-card p-4 shadow-xs transition-colors hover:border-border/80">
          <div>
            <div className="flex items-center justify-between font-mono text-xs text-muted-foreground">
              <span>Workloads & Services</span>
              <Layers
                className={cn(
                  "size-4",
                  failedServices.length > 0
                    ? "text-destructive"
                    : deployingServices.length > 0
                      ? "text-blue-500"
                      : "text-emerald-500"
                )}
              />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="font-mono text-2xl font-bold text-foreground">
                {runningServices.length}
                <span className="text-base font-normal text-muted-foreground">
                  /{services.length}
                </span>
              </span>
              {failedServices.length > 0 ? (
                <span className="font-mono text-xs font-medium text-destructive">
                  {failedServices.length} failed
                </span>
              ) : deployingServices.length > 0 ? (
                <span className="font-mono text-xs text-blue-500">
                  {deployingServices.length} deploying
                </span>
              ) : (
                <span className="font-mono text-xs text-emerald-500">
                  running
                </span>
              )}
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between border-t border-border/50 pt-2.5 font-mono text-[11px] text-muted-foreground">
            <span>
              {projects.length} project{projects.length === 1 ? "" : "s"}
            </span>
            <Link
              href="/projects"
              className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
            >
              <span>Projects</span>
              <ArrowUpRight className="size-3" />
            </Link>
          </div>
        </div>

        {/* Compute Load */}
        <div className="flex flex-col justify-between rounded-lg border border-border bg-card p-4 shadow-xs transition-colors hover:border-border/80">
          <div>
            <div className="flex items-center justify-between font-mono text-xs text-muted-foreground">
              <span>Compute Load</span>
              <Activity className="size-4 text-blue-500" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="font-mono text-2xl font-bold text-foreground">
                {avgCpu}%
              </span>
              <span className="font-mono text-xs text-muted-foreground">
                CPU avg
              </span>
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between border-t border-border/50 pt-2.5 font-mono text-[11px] text-muted-foreground">
            <span>{avgMem}% RAM utilized</span>
            <Link
              href="/monitor"
              className="inline-flex items-center gap-1 font-medium text-blue-500 hover:underline"
            >
              <span>Monitor</span>
              <ArrowUpRight className="size-3" />
            </Link>
          </div>
        </div>

        {/* Ingress & gRPC Stream */}
        <div className="flex flex-col justify-between rounded-lg border border-border bg-card p-4 shadow-xs transition-colors hover:border-border/80">
          <div>
            <div className="flex items-center justify-between font-mono text-xs text-muted-foreground">
              <span>gRPC & Ingress</span>
              <Radio
                className={cn(
                  "size-4",
                  onlineNodes.length > 0
                    ? "animate-pulse text-emerald-500"
                    : "text-muted-foreground"
                )}
              />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="font-mono text-2xl font-bold text-foreground">
                {avgLatency !== null ? `${avgLatency}ms` : "Offline"}
              </span>
              <span
                className={cn(
                  "font-mono text-xs",
                  onlineNodes.length > 0
                    ? "text-emerald-500"
                    : "text-muted-foreground"
                )}
              >
                {onlineNodes.length > 0 ? "Stream live" : "No nodes"}
              </span>
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between border-t border-border/50 pt-2.5 font-mono text-[11px] text-muted-foreground">
            <span>HTTP telemetry active</span>
            <Link
              href="/live"
              className="inline-flex shrink-0 items-center gap-1 font-medium text-emerald-500 hover:underline"
            >
              <span>Live Feed</span>
              <ArrowUpRight className="size-3" />
            </Link>
          </div>
        </div>
      </div>

      {/* Empty State */}
      {!hasData && (
        <EmptyState
          icon={Server}
          title="Cluster Has No Active Workloads"
          description="You are currently viewing the clean zero-state. Connect your first edge agent or switch back to sample data using the button below."
          actionLabel="Connect Edge Node"
          onAction={() => setAddNodeOpen(true)}
          secondaryActionLabel="Load Sample Data"
          onSecondaryAction={() => setDataMode(true)}
        />
      )}

      {/* Failing Workloads Exception Alert (Progressive Disclosure) */}
      {failedServices.length > 0 && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 shadow-xs">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2.5">
              <AlertTriangle className="size-4 shrink-0 text-destructive" />
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs font-semibold text-destructive">
                  Workload Degradation:
                </span>
                <span className="text-xs text-foreground">
                  {failedServices.length} service
                  {failedServices.length > 1 ? "s" : ""} in failed state
                </span>
              </div>
            </div>
            <Link
              href="/projects"
              className="inline-flex items-center gap-1 font-mono text-xs font-medium text-destructive hover:underline"
            >
              <span>Manage in Projects</span>
              <ArrowRight className="size-3" />
            </Link>
          </div>

          <div className="mt-3 divide-y divide-destructive/15 rounded border border-destructive/20 bg-background/50">
            {failedServices.slice(0, 3).map((service) => (
              <div
                key={service.id}
                className="flex items-center justify-between gap-3 px-3 py-2 text-xs"
              >
                <div className="flex items-center gap-2">
                  <span className="size-1.5 rounded-full bg-destructive" />
                  <span className="font-mono font-medium text-foreground">
                    {service.name}
                  </span>
                  {service.targetNodeName && (
                    <span className="font-mono text-[11px] text-muted-foreground">
                      on {service.targetNodeName}
                    </span>
                  )}
                </div>
                <Link
                  href={`/projects/${service.projectId}/services/${service.id}`}
                  className="font-mono text-[11px] font-medium text-destructive hover:underline"
                >
                  Inspect Logs →
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Operations Core (Two-Column High-Signal Grid) */}
      {hasData && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Left Column: Edge Fleet Hotspots & Distribution */}
          <section className="flex flex-col rounded-lg border border-border bg-card lg:col-span-7">
            <div className="flex items-center justify-between border-b border-border/60 px-4 py-3 sm:px-5">
              <div className="flex items-center gap-2">
                <Server className="size-4 text-primary" />
                <h2 className="text-sm font-semibold text-foreground">
                  Fleet Status & Hotspots
                </h2>
                <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
                  {nodes.length}
                </span>
              </div>
              <Link
                href="/nodes"
                className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
              >
                <span>Manage all nodes</span>
                <ArrowRight className="size-3" />
              </Link>
            </div>

            {/* Health segment bar */}
            {nodes.length > 0 && (
              <div className="border-b border-border/40 px-4 py-2.5 sm:px-5">
                <div className="flex items-center justify-between font-mono text-[11px] text-muted-foreground">
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1">
                      <span className="size-2 rounded-full bg-emerald-500" />
                      {onlineNodes.length} Online
                    </span>
                    {degradedNodes.length > 0 && (
                      <span className="flex items-center gap-1">
                        <span className="size-2 rounded-full bg-amber-500" />
                        {degradedNodes.length} Degraded
                      </span>
                    )}
                    {offlineNodes.length > 0 && (
                      <span className="flex items-center gap-1">
                        <span className="size-2 rounded-full bg-destructive" />
                        {offlineNodes.length} Offline
                      </span>
                    )}
                  </div>
                  <span>{nodes.length} registered</span>
                </div>
                <div className="mt-2 flex h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  {onlineNodes.length > 0 && (
                    <div
                      style={{
                        width: `${(onlineNodes.length / nodes.length) * 100}%`,
                      }}
                      className="bg-emerald-500"
                    />
                  )}
                  {degradedNodes.length > 0 && (
                    <div
                      style={{
                        width: `${(degradedNodes.length / nodes.length) * 100}%`,
                      }}
                      className="bg-amber-500"
                    />
                  )}
                  {offlineNodes.length > 0 && (
                    <div
                      style={{
                        width: `${(offlineNodes.length / nodes.length) * 100}%`,
                      }}
                      className="bg-destructive"
                    />
                  )}
                </div>
              </div>
            )}

            {/* Compact Node List */}
            <div className="divide-y divide-border/40">
              {prioritizedNodes.slice(0, 7).map((node) => {
                const loc = formatNodeLocation(node.location)
                const isWarning =
                  node.status !== NODE_STATUS.ONLINE || node.cpuPercent > 85

                return (
                  <Link
                    key={node.id}
                    href={`/nodes/${node.id}`}
                    className="flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-muted/40 sm:px-5"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span
                        className={cn(
                          "size-2 shrink-0 rounded-full",
                          statusDotClass(node.status)
                        )}
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="truncate font-mono text-xs font-semibold text-foreground">
                            {node.name}
                          </span>
                          <NodeRoleBadge role={node.role} />
                        </div>
                        <div className="flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground">
                          <span>{node.ipAddress}</span>
                          <span>•</span>
                          {node.location?.flag && (
                            <Flag
                              src={node.location.flag}
                              alt={loc.country}
                              title={loc.country}
                              width={14}
                              height={9}
                              className="h-2.5 shrink-0 rounded-[1px]"
                            />
                          )}
                          <span>{loc.country}</span>
                          {node.runningContainers > 0 && (
                            <>
                              <span>•</span>
                              <span>{node.runningContainers} containers</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-4 text-right">
                      <div className="font-mono text-xs">
                        <div
                          className={cn(
                            "font-medium",
                            isWarning ? "text-amber-500" : "text-foreground"
                          )}
                        >
                          {node.cpuPercent}% CPU
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          {node.memoryPercent}% RAM
                        </div>
                      </div>

                      <div className="hidden font-mono text-xs text-muted-foreground sm:block">
                        {node.grpcLatencyMs ? `${node.grpcLatencyMs}ms` : "-"}
                      </div>

                      <ArrowRight className="size-3.5 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                    </div>
                  </Link>
                )
              })}

              {nodes.length === 0 && (
                <div className="px-5 py-8 text-center text-xs text-muted-foreground">
                  No edge nodes connected yet.
                </div>
              )}
            </div>

            {nodes.length > 7 && (
              <div className="border-t border-border/40 p-2.5 text-center">
                <Link
                  href="/nodes"
                  className="font-mono text-xs text-muted-foreground transition-colors hover:text-primary"
                >
                  +{nodes.length - 7} more edge nodes in fleet →
                </Link>
              </div>
            )}
          </section>

          {/* Right Column: Recent Activity & Audit Trail */}
          <section className="flex flex-col rounded-lg border border-border bg-card lg:col-span-5">
            <div className="flex items-center justify-between border-b border-border/60 px-4 py-3 sm:px-5">
              <div className="flex items-center gap-2">
                <ScrollText className="size-4 text-primary" />
                <h2 className="text-sm font-semibold text-foreground">
                  Recent Platform Activity
                </h2>
              </div>
              <Link
                href="/audit-logs"
                className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
              >
                <span>Audit trail</span>
                <ArrowRight className="size-3" />
              </Link>
            </div>

            <div className="divide-y divide-border/40">
              {recentLogs.map((entry) => {
                const isSuccess = entry.status === "success"
                return (
                  <div
                    key={entry.id}
                    className="flex items-start gap-3 px-4 py-3 transition-colors hover:bg-muted/20 sm:px-5"
                  >
                    <div className="mt-0.5 shrink-0">
                      {isSuccess ? (
                        <CheckCircle2 className="size-3.5 text-emerald-500" />
                      ) : (
                        <XCircle className="size-3.5 text-destructive" />
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate font-mono text-xs font-medium text-foreground">
                          {entry.action}
                        </span>
                        <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                          {formatRelativeTime(entry.timestamp)}
                        </span>
                      </div>
                      <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                        {entry.details ||
                          `${entry.actor.name} on ${entry.target}`}
                      </p>
                    </div>
                  </div>
                )
              })}

              {recentLogs.length === 0 && (
                <div className="flex flex-col items-center justify-center p-8 text-center">
                  <ShieldCheck className="size-8 text-muted-foreground/60" />
                  <p className="mt-2 text-xs font-medium text-foreground">
                    All workloads operating normally
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    No recent mutation or warning events logged.
                  </p>
                </div>
              )}
            </div>

            <div className="mt-auto border-t border-border/40 p-2.5 text-center">
              <Link
                href="/audit-logs"
                className="font-mono text-xs text-muted-foreground transition-colors hover:text-primary"
              >
                View complete audit log stream →
              </Link>
            </div>
          </section>
        </div>
      )}

      {/* Dialogs for Quick Creation */}
      <AddNodeDialog open={addNodeOpen} onOpenChange={setAddNodeOpen} />
      <CreateProjectDialog
        open={createProjectOpen}
        onOpenChange={setCreateProjectOpen}
      />
    </div>
  )
}
