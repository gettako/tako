"use client"

import * as React from "react"
import Link from "next/link"
import {
  ArrowSquareOut,
  GitBranch,
  GitCommit,
  User,
  Clock,
  HardDrives,
  FileCode,
  PlugsConnected,
  Heartbeat,
  TerminalWindow,
  SlidersHorizontal,
  CircleNotchIcon,
  Database,
  Lock,
  Copy,
  Check,
  Eye,
  EyeSlash,
  PlayCircle,
  StopCircleIcon,
} from "@phosphor-icons/react"
import { Button } from "@/components/ui/button"
import { CopyButton } from "@/components/ui/copy-button"
import { Input } from "@/components/ui/input"
import { StatusBadge } from "@/components/status-badge"
import { LoadingSkeleton } from "@/components/states/loading-skeleton"
import { ErrorCard } from "@/components/states/error-card"
import { useService } from "@/components/services/service-context"
import { ComposeServiceOverview } from "@/components/services/compose-service-overview"
import {
  api,
  type Deployment,
  type Service,
  type ServiceDetail,
} from "@/lib/api"

function formatRelativeTime(dateString: string | null | undefined): string {
  if (!dateString) return "Never"
  try {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMinutes = Math.floor(diffMs / 60000)
    if (diffMinutes < 1) return "Just now"
    if (diffMinutes < 60) return `${diffMinutes} minutes ago`
    const diffHours = Math.floor(diffMinutes / 60)
    if (diffHours < 24) return `${diffHours} hours ago`
    const diffDays = Math.floor(diffHours / 24)
    return `${diffDays} days ago`
  } catch {
    return dateString
  }
}

function DatabaseServiceOverview({
  service,
  serviceId,
  projectId,
  refetch,
  showToast,
}: {
  service: ServiceDetail
  serviceId: string
  projectId: string
  refetch: () => Promise<void>
  showToast: (type: "success" | "error", message: string) => void
}) {
  const [showPassword, setShowPassword] = React.useState(false)
  const [siblingServices, setSiblingServices] = React.useState<Service[]>([])
  const [selectedTargetId, setSelectedTargetId] = React.useState("")
  const [envKey, setEnvKey] = React.useState(
    service.database_engine === "redis" ? "REDIS_URL" : "DATABASE_URL"
  )
  const [isInjecting, setIsInjecting] = React.useState(false)
  const [isActionPending, setIsActionPending] = React.useState(false)

  React.useEffect(() => {
    if (!projectId) return
    api.services
      .list({ projectId })
      .then((items) => {
        const siblings = items.filter(
          (s) => s.id !== serviceId && s.service_type !== "database"
        )
        setSiblingServices(siblings)
        if (siblings.length > 0 && !selectedTargetId) {
          setSelectedTargetId(siblings[0].id)
        }
      })
      .catch(() => {})
  }, [projectId, serviceId, selectedTargetId])

  const handleInject = async () => {
    if (!selectedTargetId) return
    setIsInjecting(true)
    try {
      const res = await api.services.injectConnectionString(serviceId, {
        target_service_id: selectedTargetId,
        env_key: envKey || "DATABASE_URL",
      })
      const target = siblingServices.find((s) => s.id === selectedTargetId)
      showToast(
        "success",
        `Injected ${res.env_key} into ${target ? target.name : "target service"} environment variables.`
      )
    } catch (err) {
      showToast(
        "error",
        err instanceof Error
          ? err.message
          : "Failed to inject connection string."
      )
    } finally {
      setIsInjecting(false)
    }
  }

  const handleAction = async (action: "start" | "stop") => {
    setIsActionPending(true)
    try {
      if (action === "start") {
        await api.services.start(serviceId)
        showToast("success", "Database service started.")
      } else {
        await api.services.stop(serviceId)
        showToast("success", "Database service stopped.")
      }
      await refetch()
    } catch (err) {
      showToast("error", `Failed to ${action} database service.`)
    } finally {
      setIsActionPending(false)
    }
  }

  const defaultPort =
    service.database_engine === "redis"
      ? 6379
      : service.database_engine === "mysql"
        ? 3306
        : 5432

  return (
    <div className="flex flex-col gap-6 md:gap-8">
      {/* 4 Core Specification Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* Card 1: Runtime Status */}
        <section
          aria-labelledby="card-runtime-status"
          className="flex flex-col justify-between gap-4 rounded-lg border border-border bg-card p-6"
        >
          <div className="flex items-center justify-between border-b border-border pb-3">
            <h2
              id="card-runtime-status"
              className="font-heading text-base font-semibold text-foreground"
            >
              Runtime Status
            </h2>
            <StatusBadge variant={service.status} size="sm" />
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="mb-1 block text-xs text-muted-foreground">
                State
              </span>
              <span className="font-medium text-foreground capitalize">
                {service.status}
              </span>
            </div>

            <div>
              <span className="mb-1 block text-xs text-muted-foreground">
                Container ID
              </span>
              <span className="rounded border border-border bg-muted px-2 py-0.5 font-mono text-xs text-foreground">
                {service.active_deployment_id
                  ? service.active_deployment_id.slice(0, 8)
                  : "Not provisioned"}
              </span>
            </div>

            <div>
              <span className="mb-1 block text-xs text-muted-foreground">
                Engine & Version
              </span>
              <div className="flex items-center gap-1.5">
                <span className="font-mono text-xs text-foreground uppercase">
                  {service.database_engine || "database"}:
                  {service.database_version || "latest"}
                </span>
                <CopyButton
                  text={`${service.database_engine || "database"}:${service.database_version || "latest"}`}
                  size="xs"
                  showIconOnly
                  aria-label="Copy image tag"
                  title="Copy image tag"
                />
              </div>
            </div>

            <div>
              <span className="mb-1 block text-xs text-muted-foreground">
                Network Address
              </span>
              <span className="rounded border border-border bg-muted px-2 py-0.5 font-mono text-xs text-foreground">
                tako-{service.id}:{service.internal_port || defaultPort}
              </span>
            </div>
          </div>
        </section>

        {/* Card 2: Database Credentials */}
        <section
          aria-labelledby="card-db-credentials"
          className="flex flex-col justify-between gap-4 rounded-lg border border-border bg-card p-6"
        >
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div className="flex items-center gap-2">
              <Database className="size-4 text-emerald-600 dark:text-emerald-400" />
              <h2
                id="card-db-credentials"
                className="font-heading text-base font-semibold text-foreground"
              >
                Database Credentials
              </h2>
            </div>
            <span className="rounded border border-border bg-muted/60 px-2 py-0.5 font-mono text-xs text-foreground uppercase">
              {service.database_engine || "DB"}
            </span>
          </div>

          <div className="flex flex-col gap-3 text-sm">
            {service.database_engine !== "redis" && (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">User</span>
                  <span className="rounded border border-border bg-muted px-2 py-0.5 font-mono text-xs text-foreground">
                    {service.database_user || "postgres"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    Database
                  </span>
                  <span className="rounded border border-border bg-muted px-2 py-0.5 font-mono text-xs text-foreground">
                    {service.database_name || "app"}
                  </span>
                </div>
              </>
            )}

            {/* Password */}
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Password</span>
              <div className="flex items-center gap-1.5">
                <span className="min-w-30 rounded border border-border bg-muted px-2 py-1 text-center font-mono text-xs text-foreground select-all">
                  {showPassword
                    ? service.database_password || "(none)"
                    : "••••••••••••••••"}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setShowPassword(!showPassword)}
                  className="size-8"
                  title={showPassword ? "Hide password" : "Show password"}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <EyeSlash className="size-3.5" />
                  ) : (
                    <Eye className="size-3.5" />
                  )}
                </Button>
                {service.database_password && (
                  <CopyButton
                    text={service.database_password}
                    size="icon-sm"
                    title="Copy password"
                    aria-label="Copy password"
                  />
                )}
              </div>
            </div>

            {/* Connection URI */}
            <div className="flex flex-col gap-1.5 border-t border-border pt-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  Connection URI
                </span>
                <CopyButton
                  text={service.connection_uri || ""}
                  label="Copy URI"
                  size="sm"
                  title="Copy connection string"
                  aria-label="Copy connection string"
                  disabled={!service.connection_uri}
                />
              </div>
              <div className="rounded border border-border bg-muted/60 p-2 font-mono text-xs break-all text-foreground select-all">
                {service.connection_uri || "URI will appear once provisioned"}
              </div>
            </div>
          </div>
        </section>

        {/* Card 3: Persistent Storage & Volumes */}
        <section
          aria-labelledby="card-persistent-volume"
          className="flex flex-col justify-between gap-4 rounded-lg border border-border bg-card p-6"
        >
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div className="flex items-center gap-2">
              <HardDrives className="size-4 text-muted-foreground" />
              <h2
                id="card-persistent-volume"
                className="font-heading text-base font-semibold text-foreground"
              >
                Persistent Volume
              </h2>
            </div>
            <span className="rounded border border-border bg-muted/60 px-2 py-0.5 text-xs text-muted-foreground">
              Docker Volume
            </span>
          </div>

          <div className="flex flex-col gap-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Volume Name</span>
              <span
                className="max-w-50 truncate rounded border border-border bg-muted px-2 py-0.5 font-mono text-xs text-foreground"
                title={service.volume_name || `tako_vol_${service.id}_data`}
              >
                {service.volume_name || `tako_vol_${service.id}_data`}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Mount Path</span>
              <span className="rounded border border-border bg-muted px-2 py-0.5 font-mono text-xs text-foreground">
                {service.volume_mount_path || "/var/lib/postgresql/data"}
              </span>
            </div>

            <div className="flex items-center justify-between border-t border-border pt-2">
              <span className="text-xs text-muted-foreground">Persistence</span>
              <span className="text-xs font-medium text-foreground">
                Retained across restarts & deployments
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                Network Isolation
              </span>
              <span className="inline-flex items-center gap-1 font-mono text-xs text-muted-foreground">
                <Lock className="size-3 text-emerald-600 dark:text-emerald-400" />
                <span>tako_network only</span>
              </span>
            </div>
          </div>
        </section>

        {/* Card 4: Assigned Server Node */}
        <section
          aria-labelledby="card-server-node"
          className="flex flex-col justify-between gap-4 rounded-lg border border-border bg-card p-6"
        >
          <div className="flex items-center justify-between border-b border-border pb-3">
            <h2
              id="card-server-node"
              className="font-heading text-base font-semibold text-foreground"
            >
              Assigned Server Node
            </h2>
            <StatusBadge
              variant={
                service.server?.status === "online" ? "online" : "healthy"
              }
              size="sm"
            />
          </div>

          <div className="flex flex-col gap-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Server Name</span>
              <span className="inline-flex items-center gap-1.5 font-medium text-foreground">
                <HardDrives
                  className="size-4 text-muted-foreground"
                  aria-hidden="true"
                />
                <span>{service.server?.name || "Local Docker Node"}</span>
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                Host Address
              </span>
              <span className="rounded border border-border bg-muted px-2 py-0.5 font-mono text-xs text-foreground">
                {service.server?.host || "127.0.0.1"}
              </span>
            </div>

            <div className="flex items-center justify-between border-t border-border pt-2">
              <span className="text-xs text-muted-foreground">
                Ingress Routing
              </span>
              <span className="font-mono text-xs text-muted-foreground">
                Traefik HTTP Bypassed (Internal TCP)
              </span>
            </div>
          </div>
        </section>
      </div>

      {/* Auto-Inject Connection String Card */}
      <section
        aria-labelledby="card-inject-connection"
        className="flex flex-col gap-4 rounded-lg border border-border bg-card p-6"
      >
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div className="flex items-center gap-2">
            <PlugsConnected className="size-5 text-emerald-600 dark:text-emerald-400" />
            <div>
              <h3
                id="card-inject-connection"
                className="font-heading text-base font-semibold text-foreground"
              >
                Inject Connection String
              </h3>
              <p className="text-xs text-muted-foreground">
                Automatically inject this database connection string into the
                environment variables of a web service.
              </p>
            </div>
          </div>
        </div>

        {siblingServices.length === 0 ? (
          <p className="py-2 text-sm text-muted-foreground">
            No sibling web or worker services found in this project to inject
            connection string into.
          </p>
        ) : (
          <div className="flex flex-col items-stretch gap-3 pt-2 sm:flex-row sm:items-end">
            <div className="flex flex-1 flex-col gap-1.5">
              <label
                htmlFor="target-service"
                className="text-xs font-medium text-foreground"
              >
                Target Service
              </label>
              <select
                id="target-service"
                value={selectedTargetId}
                onChange={(e) => setSelectedTargetId(e.target.value)}
                className="h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                {siblingServices.map((sibling) => (
                  <option
                    key={sibling.id}
                    value={sibling.id}
                    className="bg-popover text-popover-foreground"
                  >
                    {sibling.name} ({sibling.service_type || "web"})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex w-full flex-col gap-1.5 sm:w-56">
              <label
                htmlFor="target-env-key"
                className="text-xs font-medium text-foreground"
              >
                Environment Variable Name
              </label>
              <Input
                id="target-env-key"
                value={envKey}
                onChange={(e) => setEnvKey(e.target.value)}
                placeholder="DATABASE_URL"
                className="font-mono text-sm"
              />
            </div>

            <Button
              type="button"
              onClick={handleInject}
              disabled={isInjecting || !selectedTargetId}
              className="cursor-pointer gap-2"
            >
              {isInjecting ? (
                <CircleNotchIcon className="size-4 animate-spin" />
              ) : (
                <PlugsConnected className="size-4" />
              )}
              <span>Inject Variable</span>
            </Button>
          </div>
        )}
      </section>

      {/* Quick Action Navigation Grid */}
      <section
        aria-label="Quick actions"
        className="flex flex-col gap-4 rounded-lg border border-border bg-card p-6"
      >
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-heading text-base font-semibold text-foreground">
              Quick Actions
            </h3>
            <p className="text-xs text-muted-foreground">
              Monitor container logs, configure environment variables, or
              control service runtime.
            </p>
          </div>
          {service.status === "stopped" ? (
            <Button
              variant="default"
              onClick={() => handleAction("start")}
              disabled={isActionPending}
              className="cursor-pointer gap-2"
            >
              {isActionPending ? (
                <CircleNotchIcon className="size-4 animate-spin" />
              ) : (
                <PlayCircle className="size-4" />
              )}
              <span>Start Service</span>
            </Button>
          ) : (
            <Button
              variant="outline"
              onClick={() => handleAction("stop")}
              disabled={isActionPending}
              className="cursor-pointer gap-2"
            >
              {isActionPending ? (
                <CircleNotchIcon className="size-4 animate-spin" />
              ) : (
                <StopCircleIcon className="size-4 text-muted-foreground" />
              )}
              <span>Stop Service</span>
            </Button>
          )}
        </div>

        <div className="grid grid-cols-1 gap-3 pt-2 sm:grid-cols-2">
          <Link
            href={`/projects/${projectId}/services/${serviceId}/monitoring`}
            className="flex min-h-11 cursor-pointer items-center gap-3 rounded-md border border-border bg-background p-3 transition-colors hover:bg-muted/60"
          >
            <TerminalWindow
              className="size-5 shrink-0 text-muted-foreground"
              aria-hidden="true"
            />
            <div className="flex flex-col">
              <span className="text-sm font-medium text-foreground">
                Live Logs & Metrics
              </span>
              <span className="text-xs text-muted-foreground">
                Engine stdout logs and resource usage
              </span>
            </div>
          </Link>

          <Link
            href={`/projects/${projectId}/services/${serviceId}/environment`}
            className="flex min-h-11 cursor-pointer items-center gap-3 rounded-md border border-border bg-background p-3 transition-colors hover:bg-muted/60"
          >
            <SlidersHorizontal
              className="size-5 shrink-0 text-muted-foreground"
              aria-hidden="true"
            />
            <div className="flex flex-col">
              <span className="text-sm font-medium text-foreground">
                Environment Variables
              </span>
              <span className="text-xs text-muted-foreground">
                Database config and runtime parameters
              </span>
            </div>
          </Link>
        </div>
      </section>
    </div>
  )
}

export default function ServiceOverviewPage() {
  const {
    service,
    serviceId,
    projectId,
    isLoading,
    error,
    refetch,
    showToast,
  } = useService()

  const [latestDeployment, setLatestDeployment] =
    React.useState<Deployment | null>(null)

  React.useEffect(() => {
    if (!serviceId || service?.service_type === "database") return
    let isSubscribed = true

    api.services
      .listDeployments(serviceId, { limit: 1 })
      .then((res) => {
        if (isSubscribed && res.items.length > 0) {
          setLatestDeployment(res.items[0])
        }
      })
      .catch(() => {
        // Fallback to active_deployment if list fails
      })

    return () => {
      isSubscribed = false
    }
  }, [serviceId, service?.service_type])

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6 md:gap-8">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <LoadingSkeleton variant="card" />
          <LoadingSkeleton variant="card" />
          <LoadingSkeleton variant="card" />
          <LoadingSkeleton variant="card" />
        </div>
      </div>
    )
  }

  if (error || !service) {
    return (
      <ErrorCard
        title="Failed to Load Service Overview"
        message={error?.message || "Service details could not be retrieved."}
        onRetry={refetch}
      />
    )
  }

  if (service.service_type === "database") {
    return (
      <DatabaseServiceOverview
        service={service}
        serviceId={serviceId}
        projectId={projectId}
        refetch={refetch}
        showToast={showToast}
      />
    )
  }

  if (service.service_type === "compose") {
    return (
      <ComposeServiceOverview
        service={service}
        serviceId={serviceId}
        projectId={projectId}
        refetch={refetch}
        showToast={showToast}
      />
    )
  }

  const deployment = latestDeployment || service.active_deployment
  const commitSha = deployment?.commit_sha
    ? deployment.commit_sha.slice(0, 7)
    : "latest"
  const commitUrl = service.repository
    ? `https://github.com/${service.repository}/commit/${deployment?.commit_sha || "main"}`
    : "#"
  const repoUrl = service.repository
    ? `https://github.com/${service.repository}`
    : "#"

  return (
    <div className="flex flex-col gap-6 md:gap-8">
      {/* 4 Core Specification Cards in a 2x2 Responsive Grid */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* Card 1: Runtime Status */}
        <section
          aria-labelledby="card-runtime-status"
          className="flex flex-col justify-between gap-4 rounded-lg border border-border bg-card p-6"
        >
          <div className="flex items-center justify-between border-b border-border pb-3">
            <h2
              id="card-runtime-status"
              className="font-heading text-base font-semibold text-foreground"
            >
              Runtime Status
            </h2>
            <StatusBadge variant={service.status} size="sm" />
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="mb-1 block text-xs text-muted-foreground">
                State
              </span>
              <span className="font-medium text-foreground capitalize">
                {service.status}
              </span>
            </div>

            <div>
              <span className="mb-1 block text-xs text-muted-foreground">
                Container ID
              </span>
              <span className="rounded border border-border bg-muted px-2 py-0.5 font-mono text-xs text-foreground">
                {service.active_deployment_id
                  ? service.active_deployment_id.slice(0, 8)
                  : "Not provisioned"}
              </span>
            </div>

            <div>
              <span className="mb-1 block text-xs text-muted-foreground">
                Uptime
              </span>
              <span className="text-foreground">
                {service.status === "running" ? "Active (Healthy)" : "Inactive"}
              </span>
            </div>

            <div>
              <span className="mb-1 block text-xs text-muted-foreground">
                Last Deployed
              </span>
              <span className="text-foreground">
                {formatRelativeTime(
                  deployment?.started_at || service.updated_at
                )}
              </span>
            </div>
          </div>
        </section>

        {/* Card 2: Source Control */}
        <section
          aria-labelledby="card-source-control"
          className="flex flex-col justify-between gap-4 rounded-lg border border-border bg-card p-6"
        >
          <div className="flex items-center justify-between border-b border-border pb-3">
            <h2
              id="card-source-control"
              className="font-heading text-base font-semibold text-foreground"
            >
              Source Control
            </h2>
            <a
              href={repoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex cursor-pointer items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
              title="Open repository in GitHub"
            >
              <span>GitHub</span>
              <ArrowSquareOut className="size-3.5" aria-hidden="true" />
            </a>
          </div>

          <div className="flex flex-col gap-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Repository</span>
              <a
                href={repoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex cursor-pointer items-center gap-1 font-mono text-xs text-foreground hover:underline"
              >
                <span>{service.repository || "Not connected"}</span>
              </a>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Branch</span>
              <span className="inline-flex items-center gap-1 rounded border border-border bg-muted px-2 py-0.5 font-mono text-xs text-foreground">
                <GitBranch
                  className="size-3 text-muted-foreground"
                  aria-hidden="true"
                />
                <span>{service.branch}</span>
              </span>
            </div>

            <div className="flex items-center justify-between border-t border-border pt-2">
              <span className="text-xs text-muted-foreground">
                Latest Commit
              </span>
              <div className="flex items-center gap-2">
                <a
                  href={commitUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex cursor-pointer items-center gap-1 rounded border border-border bg-muted px-2 py-0.5 font-mono text-xs text-foreground hover:underline"
                >
                  <GitCommit
                    className="size-3 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <span>{commitSha}</span>
                </a>
              </div>
            </div>

            {deployment?.commit_message && (
              <div
                className="truncate text-xs text-muted-foreground"
                title={deployment.commit_message}
              >
                {deployment.commit_message}
                {deployment.commit_author && (
                  <span className="ml-1 font-medium text-foreground">
                    by {deployment.commit_author}
                  </span>
                )}
              </div>
            )}
          </div>
        </section>

        {/* Card 3: Build & Port Specs */}
        <section
          aria-labelledby="card-build-specs"
          className="flex flex-col justify-between gap-4 rounded-lg border border-border bg-card p-6"
        >
          <div className="flex items-center justify-between border-b border-border pb-3">
            <h2
              id="card-build-specs"
              className="font-heading text-base font-semibold text-foreground"
            >
              Build & Port Specs
            </h2>
            <FileCode
              className="size-4 text-muted-foreground"
              aria-hidden="true"
            />
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="mb-1 block text-xs text-muted-foreground">
                Dockerfile Path
              </span>
              <span className="inline-block rounded border border-border bg-muted px-2 py-0.5 font-mono text-xs text-foreground">
                {service.dockerfile_path || "Dockerfile"}
              </span>
            </div>

            <div>
              <span className="mb-1 block text-xs text-muted-foreground">
                Internal Port
              </span>
              <span className="inline-block rounded border border-border bg-muted px-2 py-0.5 font-mono text-xs text-foreground">
                {service.internal_port}
              </span>
            </div>

            <div>
              <span className="mb-1 block text-xs text-muted-foreground">
                Health Check Path
              </span>
              <span className="inline-block rounded border border-border bg-muted px-2 py-0.5 font-mono text-xs text-foreground">
                {service.health_check_path || "/healthz"}
              </span>
            </div>

            <div>
              <span className="mb-1 block text-xs text-muted-foreground">
                Build Context
              </span>
              <span className="inline-block rounded border border-border bg-muted px-2 py-0.5 font-mono text-xs text-foreground">
                . (root)
              </span>
            </div>

            <div>
              <span className="mb-1 block text-xs text-muted-foreground">
                Pre-Deploy Hook
              </span>
              <span className="inline-block max-w-full truncate rounded border border-border bg-muted px-2 py-0.5 font-mono text-xs text-foreground">
                {service.pre_deploy_command || "None"}
              </span>
            </div>

            <div>
              <span className="mb-1 block text-xs text-muted-foreground">
                Post-Deploy Hook
              </span>
              <span className="inline-block max-w-full truncate rounded border border-border bg-muted px-2 py-0.5 font-mono text-xs text-foreground">
                {service.post_deploy_command || "None"}
              </span>
            </div>
          </div>
        </section>

        {/* Card 4: Server Node */}
        <section
          aria-labelledby="card-server-node"
          className="flex flex-col justify-between gap-4 rounded-lg border border-border bg-card p-6"
        >
          <div className="flex items-center justify-between border-b border-border pb-3">
            <h2
              id="card-server-node"
              className="font-heading text-base font-semibold text-foreground"
            >
              Assigned Server Node
            </h2>
            <StatusBadge
              variant={
                service.server?.status === "online" ? "online" : "healthy"
              }
              size="sm"
            />
          </div>

          <div className="flex flex-col gap-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Server Name</span>
              <span className="inline-flex items-center gap-1.5 font-medium text-foreground">
                <HardDrives
                  className="size-4 text-muted-foreground"
                  aria-hidden="true"
                />
                <span>{service.server?.name || "Local Docker Node"}</span>
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                Host Address
              </span>
              <span className="rounded border border-border bg-muted px-2 py-0.5 font-mono text-xs text-foreground">
                {service.server?.host || "127.0.0.1"}
              </span>
            </div>

            <div className="flex items-center justify-between border-t border-border pt-2">
              <span className="text-xs text-muted-foreground">
                Routing Mode
              </span>
              <span className="font-mono text-xs text-muted-foreground">
                Traefik Dynamic Provider
              </span>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
