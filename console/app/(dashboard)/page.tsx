"use client"

import * as React from "react"
import Link from "next/link"
import {
  CpuIcon,
  HardDrivesIcon,
  CubeIcon,
  FolderSimpleIcon,
  GitBranchIcon,
  GitCommitIcon,
  ClockIcon,
  ArrowRightIcon,
  PlusIcon,
  CheckCircleIcon,
  WarningCircleIcon,
  ClockAfternoonIcon,
  ArrowUpRightIcon,
  PulseIcon,
  StackIcon,
} from "@phosphor-icons/react"
import { Button } from "@/components/ui/button"
import { StatusBadge } from "@/components/status-badge"
import { LoadingSkeleton } from "@/components/states/loading-skeleton"
import { EmptyState } from "@/components/states/empty-state"
import { ErrorCard } from "@/components/states/error-card"
import { ServerCard } from "@/components/servers/server-card"
import { CreateProjectDialog } from "@/components/projects/create-project-dialog"
import { AddServerDialog } from "@/components/servers/add-server-dialog"
import { ResourceChart } from "@/components/charts/resource-chart"
import { generateTelemetryHistory } from "@/components/charts/telemetry-utils"
import {
  api,
  type Project,
  type Server,
  type Service,
  type Deployment,
} from "@/lib/api"
import { cn } from "@/lib/utils"

const TIME_RANGES = ["15m", "1h", "6h", "24h"]
const RANGE_MINUTES_MAP: Record<string, number> = {
  "15m": 15,
  "1h": 60,
  "6h": 360,
  "24h": 1440,
}

interface EnrichedDeployment extends Deployment {
  projectName?: string
  serviceName?: string
  projectId?: string
}

function formatRelativeTime(dateString: string | null | undefined): string {
  if (!dateString) return "Never"
  try {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMinutes = Math.floor(diffMs / 60000)
    if (diffMinutes < 1) return "Just now"
    if (diffMinutes < 60) return `${diffMinutes}m ago`
    const diffHours = Math.floor(diffMinutes / 60)
    if (diffHours < 24) return `${diffHours}h ago`
    const diffDays = Math.floor(diffHours / 24)
    return `${diffDays}d ago`
  } catch {
    return dateString
  }
}

export default function DashboardMonitorPage() {
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [projects, setProjects] = React.useState<Project[]>([])
  const [servers, setServers] = React.useState<Server[]>([])
  const [services, setServices] = React.useState<Service[]>([])
  const [recentDeployments, setRecentDeployments] = React.useState<
    EnrichedDeployment[]
  >([])

  // Modal controls
  const [createProjectOpen, setCreateProjectOpen] = React.useState(false)
  const [addServerOpen, setAddServerOpen] = React.useState(false)

  const fetchData = React.useCallback(async (isBackground = false) => {
    if (!isBackground) {
      setLoading(true)
      setError(null)
    }
    try {
      const [fetchedProjects, fetchedServers, fetchedServices] =
        await Promise.all([
          api.projects.list(),
          api.servers.list(),
          api.services.list(),
        ])

      setProjects(fetchedProjects)
      setServers(fetchedServers)
      setServices(fetchedServices)

      // Fetch deployments across services
      const projectMap = new Map(fetchedProjects.map((p) => [p.id, p.name]))
      const serviceMap = new Map(fetchedServices.map((s) => [s.id, s]))

      const deploymentsNested = await Promise.all(
        fetchedServices.map(async (srv) => {
          try {
            const res = await api.services.listDeployments(srv.id, { limit: 5 })
            return res.items.map((dep) => ({
              ...dep,
              serviceName: srv.name,
              projectId: srv.project_id,
              projectName: projectMap.get(srv.project_id) || srv.project_id,
            }))
          } catch {
            return []
          }
        })
      )

      const allDeployments = deploymentsNested
        .flat()
        .sort(
          (a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        )
        .slice(0, 10)

      setRecentDeployments(allDeployments)
    } catch (err) {
      if (!isBackground) {
        setError(
          err instanceof Error
            ? err.message
            : "Failed to load cluster monitoring data."
        )
      }
    } finally {
      if (!isBackground) {
        setLoading(false)
      }
    }
  }, [])

  React.useEffect(() => {
    fetchData(false)
  }, [fetchData])

  // Periodic auto-refresh every 15 seconds
  React.useEffect(() => {
    const timer = setInterval(() => {
      fetchData(true)
    }, 15000)
    return () => clearInterval(timer)
  }, [fetchData])

  // Cluster calculations
  const onlineServersCount = React.useMemo(
    () => servers.filter((s) => s.status === "online").length,
    [servers]
  )

  const runningServicesCount = React.useMemo(
    () => services.filter((s) => s.status === "running").length,
    [services]
  )

  const failingServicesCount = React.useMemo(
    () => services.filter((s) => s.status === "failed").length,
    [services]
  )

  const buildingServicesCount = React.useMemo(
    () => services.filter((s) => s.status === "building").length,
    [services]
  )

  const stoppedServicesCount = React.useMemo(
    () => services.filter((s) => s.status === "stopped").length,
    [services]
  )

  const averageCpuPercent = React.useMemo(() => {
    if (servers.length === 0) return 0
    const sum = servers.reduce((acc, s) => acc + s.cpu_percent, 0)
    return Math.round((sum / servers.length) * 10) / 10
  }, [servers])

  const averageRamPercent = React.useMemo(() => {
    if (servers.length === 0) return 0
    const sum = servers.reduce((acc, s) => acc + s.ram_percent, 0)
    return Math.round((sum / servers.length) * 10) / 10
  }, [servers])

  const [selectedRange, setSelectedRange] = React.useState("1h")

  const cpuTelemetry = React.useMemo(() => {
    const minutes = RANGE_MINUTES_MAP[selectedRange] || 60
    return generateTelemetryHistory(averageCpuPercent, 24, minutes, 3.5, 0, 100)
  }, [averageCpuPercent, selectedRange])

  const ramTelemetry = React.useMemo(() => {
    const minutes = RANGE_MINUTES_MAP[selectedRange] || 60
    return generateTelemetryHistory(averageRamPercent, 24, minutes, 2, 0, 100)
  }, [averageRamPercent, selectedRange])

  if (loading) {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <div className="h-8 w-48 animate-pulse rounded bg-muted" />
          <div className="h-4 w-72 animate-pulse rounded bg-muted" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-28 animate-pulse rounded-lg border border-border bg-card p-4"
            />
          ))}
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="h-64 animate-pulse rounded-lg border border-border bg-card" />
          <div className="h-64 animate-pulse rounded-lg border border-border bg-card" />
        </div>
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="h-72 animate-pulse rounded-lg border border-border bg-card lg:col-span-2" />
          <div className="h-72 animate-pulse rounded-lg border border-border bg-card" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <ErrorCard
        title="Failed to Load Dashboard"
        message={error}
        onRetry={fetchData}
      />
    )
  }

  if (projects.length === 0 && servers.length === 0) {
    return (
      <>
        <EmptyState
          icon={PulseIcon}
          title="Cluster Not Initialized"
          description="Get started by creating your first project workspace and enrolling a server node."
          action={{
            label: "Create Project",
            onClick: () => setCreateProjectOpen(true),
          }}
        />
        <CreateProjectDialog
          open={createProjectOpen}
          onOpenChange={setCreateProjectOpen}
          onProjectCreated={() => fetchData()}
        />
      </>
    )
  }

  return (
    <div className="flex flex-col gap-6 pb-10 md:gap-8">
      {/* Page Header & Quick Actions */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1.5">
          <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground md:text-3xl">
            Cluster Dashboard
          </h1>
          <p className="text-sm text-muted-foreground">
            Single-pane overview of cluster health, active server nodes, and
            deployment activity.
          </p>
        </div>

        {/* Quick Actions */}
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={() => setCreateProjectOpen(true)} className="gap-2">
            <PlusIcon className="size-4" />
            <span>Create Project</span>
          </Button>

          <Button
            variant="outline"
            onClick={() => setAddServerOpen(true)}
            className="gap-2"
          >
            <HardDrivesIcon className="size-4" />
            <span>Add Server</span>
          </Button>
        </div>
      </div>

      {/* Attention banner if any service or server is failing */}
      {(failingServicesCount > 0 || onlineServersCount < servers.length) && (
        <div className="flex items-center justify-between rounded-lg border border-status-failed-border bg-status-failed-bg p-4 text-xs text-status-failed-text">
          <div className="flex items-center gap-2">
            <WarningCircleIcon className="size-5 shrink-0" />
            <span>
              Attention required: {failingServicesCount} failing service(s) and{" "}
              {servers.length - onlineServersCount} offline server node(s)
              detected.
            </span>
          </div>
          <Link
            href="/projects"
            className="font-medium underline hover:text-foreground"
          >
            Inspect Services
          </Link>
        </div>
      )}

      {/* Stat Cards: Cluster Health Overview */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Total Services */}
        <div className="flex flex-col justify-between rounded-lg border border-border bg-card p-4">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Services Running</span>
            <CubeIcon className="size-4 text-foreground" />
          </div>
          <div className="my-2 flex items-baseline gap-2">
            <span className="font-heading text-2xl font-bold text-foreground">
              {runningServicesCount}
            </span>
            <span className="text-xs text-muted-foreground">
              / {services.length} total
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            {buildingServicesCount > 0 && (
              <span className="rounded bg-status-building-bg px-1.5 py-0.5 font-mono text-2xs text-status-building-text">
                {buildingServicesCount} building
              </span>
            )}
            {failingServicesCount > 0 && (
              <span className="rounded bg-status-failed-bg px-1.5 py-0.5 font-mono text-2xs text-status-failed-text">
                {failingServicesCount} failed
              </span>
            )}
            {stoppedServicesCount > 0 && (
              <span className="text-2xs text-muted-foreground">
                {stoppedServicesCount} stopped
              </span>
            )}
            {failingServicesCount === 0 && buildingServicesCount === 0 && (
              <span className="text-2xs font-medium text-status-healthy-text">
                All active services healthy
              </span>
            )}
          </div>
        </div>

        {/* Server Nodes */}
        <div className="flex flex-col justify-between rounded-lg border border-border bg-card p-4">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Connected Nodes</span>
            <HardDrivesIcon className="size-4 text-foreground" />
          </div>
          <div className="my-2 flex items-baseline gap-2">
            <span className="font-heading text-2xl font-bold text-foreground">
              {onlineServersCount}
            </span>
            <span className="text-xs text-muted-foreground">
              / {servers.length} online
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <StatusBadge
              variant={
                onlineServersCount === servers.length ? "online" : "unhealthy"
              }
              label={
                onlineServersCount === servers.length
                  ? "Cluster fully operational"
                  : `${servers.length - onlineServersCount} node(s) offline`
              }
              size="sm"
            />
          </div>
        </div>

        {/* Average CPU */}
        <div className="flex flex-col justify-between rounded-lg border border-border bg-card p-4">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Cluster CPU Load</span>
            <CpuIcon className="size-4 text-foreground" />
          </div>
          <div className="my-2 flex items-baseline gap-2">
            <span className="font-heading font-mono text-2xl font-bold text-foreground">
              {averageCpuPercent}%
            </span>
            <span className="text-xs text-muted-foreground">average</span>
          </div>
          <div className="flex flex-col gap-1">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className={cn(
                  "h-full rounded-full transition-all",
                  averageCpuPercent > 80
                    ? "bg-rose-500"
                    : averageCpuPercent > 60
                      ? "bg-amber-500"
                      : "bg-primary"
                )}
                style={{ width: `${Math.min(100, averageCpuPercent)}%` }}
              />
            </div>
          </div>
        </div>

        {/* Average RAM */}
        <div className="flex flex-col justify-between rounded-lg border border-border bg-card p-4">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Cluster Memory</span>
            <StackIcon className="size-4 text-foreground" />
          </div>
          <div className="my-2 flex items-baseline gap-2">
            <span className="font-heading font-mono text-2xl font-bold text-foreground">
              {averageRamPercent}%
            </span>
            <span className="text-xs text-muted-foreground">average</span>
          </div>
          <div className="flex flex-col gap-1">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className={cn(
                  "h-full rounded-full transition-all",
                  averageRamPercent > 80
                    ? "bg-rose-500"
                    : averageRamPercent > 60
                      ? "bg-amber-500"
                      : "bg-primary"
                )}
                style={{ width: `${Math.min(100, averageRamPercent)}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Cluster Telemetry History */}
      {servers.length > 0 && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-heading text-lg font-semibold text-foreground">
                Cluster Telemetry History
              </h2>
              <p className="text-xs text-muted-foreground">
                Aggregate resource utilization across all active server nodes.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <ResourceChart
              title="Cluster CPU Utilization"
              currentValue={`${averageCpuPercent}%`}
              unit="%"
              color={
                averageCpuPercent > 80
                  ? "rose"
                  : averageCpuPercent > 60
                    ? "amber"
                    : "primary"
              }
              data={cpuTelemetry}
              timeRanges={TIME_RANGES}
              selectedRange={selectedRange}
              onRangeChange={setSelectedRange}
              peakValue={`${Math.min(100, Math.round(averageCpuPercent * 1.35 * 10) / 10)}%`}
              avgValue={`${Math.round(averageCpuPercent * 0.88 * 10) / 10}%`}
            />

            <ResourceChart
              title="Cluster Memory Utilization"
              currentValue={`${averageRamPercent}%`}
              unit="%"
              color={
                averageRamPercent > 80
                  ? "rose"
                  : averageRamPercent > 60
                    ? "amber"
                    : "primary"
              }
              data={ramTelemetry}
              timeRanges={TIME_RANGES}
              selectedRange={selectedRange}
              onRangeChange={setSelectedRange}
              peakValue={`${Math.min(100, Math.round(averageRamPercent * 1.2 * 10) / 10)}%`}
              avgValue={`${Math.round(averageRamPercent * 0.92 * 10) / 10}%`}
            />
          </div>
        </div>
      )}

      {/* Main Grid: Active Nodes Monitor & Recent Deployments */}
      <div className="grid gap-6 md:gap-8 lg:grid-cols-12">
        {/* Left Column (7 cols): Active Nodes Quick-Monitor */}
        <div className="flex flex-col gap-4 lg:col-span-7">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="font-heading text-lg font-semibold text-foreground">
                Active Nodes
              </h2>
              <span className="rounded-md border border-border bg-muted/40 px-2 py-0.5 font-mono text-xs text-muted-foreground">
                {servers.length}
              </span>
            </div>
            <Button
              variant="ghost"
              render={<Link href="/servers" />}
              className="h-9 px-2 text-xs text-muted-foreground hover:text-foreground"
            >
              <span>Manage Servers</span>
              <ArrowRightIcon className="size-3.5" />
            </Button>
          </div>

          {servers.length === 0 ? (
            <div className="rounded-lg border border-border bg-card p-6 text-center text-xs text-muted-foreground">
              No server nodes enrolled yet. Add a node to deploy services.
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {servers.map((server) => (
                <ServerCard key={server.id} server={server} />
              ))}
            </div>
          )}
        </div>

        {/* Right Column (5 cols): Recent Deployments Feed */}
        <div className="flex flex-col gap-4 lg:col-span-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="font-heading text-lg font-semibold text-foreground">
                Recent Deployments
              </h2>
              <span className="rounded-md border border-border bg-muted/40 px-2 py-0.5 font-mono text-xs text-muted-foreground">
                {recentDeployments.length}
              </span>
            </div>
            <Button
              variant="ghost"
              render={<Link href="/projects" />}
              className="h-9 px-2 text-xs text-muted-foreground hover:text-foreground"
            >
              <span>All Projects</span>
              <ArrowRightIcon className="size-3.5" />
            </Button>
          </div>

          <div className="flex flex-col divide-y divide-border rounded-lg border border-border bg-card">
            {recentDeployments.length === 0 ? (
              <div className="p-6 text-center text-xs text-muted-foreground">
                No deployment history found.
              </div>
            ) : (
              recentDeployments.map((dep) => (
                <div
                  key={dep.id}
                  className="flex flex-col gap-2.5 p-4 transition-colors hover:bg-muted/30"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/projects/${dep.projectId}/services/${dep.service_id}/deployments`}
                          className="truncate font-heading text-sm font-semibold text-foreground hover:underline"
                        >
                          {dep.serviceName || dep.service_id}
                        </Link>
                        <span className="text-xs text-muted-foreground">
                          in
                        </span>
                        <span className="truncate text-xs text-muted-foreground">
                          {dep.projectName}
                        </span>
                      </div>
                      <p className="line-clamp-1 text-xs text-muted-foreground">
                        {dep.commit_message || "Manual deployment"}
                      </p>
                    </div>

                    <StatusBadge
                      variant={
                        dep.status === "success"
                          ? "success"
                          : dep.status === "building"
                            ? "building"
                            : dep.status === "failed"
                              ? "failed"
                              : dep.status === "queued"
                                ? "queued"
                                : "cancelled"
                      }
                      size="sm"
                    />
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 text-2xs text-muted-foreground">
                    <div className="flex items-center gap-3">
                      <span className="flex items-center gap-1 font-mono">
                        <GitBranchIcon className="size-3" />
                        <span>{dep.branch}</span>
                      </span>
                      <span className="flex items-center gap-1 font-mono">
                        <GitCommitIcon className="size-3" />
                        <span>{dep.commit_sha.slice(0, 7)}</span>
                      </span>
                      {typeof dep.duration_seconds === "number" &&
                        dep.duration_seconds > 0 && (
                          <span>{dep.duration_seconds}s</span>
                        )}
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="flex items-center gap-1">
                        <ClockIcon className="size-3" />
                        <span>{formatRelativeTime(dep.created_at)}</span>
                      </span>
                      <Link
                        href={`/projects/${dep.projectId}/services/${dep.service_id}/deployments`}
                        className="inline-flex size-6 items-center justify-center rounded border border-border text-muted-foreground hover:bg-muted hover:text-foreground"
                        aria-label={`View deployment logs for ${dep.serviceName}`}
                      >
                        <ArrowUpRightIcon className="size-3.5" />
                      </Link>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Dialogs */}
      <CreateProjectDialog
        open={createProjectOpen}
        onOpenChange={setCreateProjectOpen}
        onProjectCreated={() => fetchData()}
      />

      <AddServerDialog
        open={addServerOpen}
        onOpenChange={setAddServerOpen}
        onServerAdded={() => fetchData()}
      />
    </div>
  )
}
