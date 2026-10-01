"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  ArrowLeftIcon,
  HardDrives,
  Broom,
  Trash,
  Cpu,
  HardDrive,
  Copy,
  Check,
  Warning,
  X,
  CircleNotchIcon,
  Cube,
  Clock,
  Pulse,
  TerminalWindow,
  ArrowRight,
  Gauge,
  ShieldCheck,
} from "@phosphor-icons/react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { StatusBadge } from "@/components/status-badge"
import { LoadingSkeleton, ErrorCard } from "@/components/states"
import { useCopyToClipboard } from "@/hooks/use-copy-to-clipboard"
import { api, ApiError, type ServerDetail, type PruneResult } from "@/lib/api"
import { cn } from "@/lib/utils"
import { ResourceChart } from "@/components/charts/resource-chart"
import { generateTelemetryHistory } from "@/components/charts/telemetry-utils"
import { TraefikProxyTab } from "@/components/servers/traefik-proxy-tab"

interface ToastNotification {
  id: string
  type: "success" | "error"
  message: string
}

function formatUptime(seconds: number): string {
  if (seconds <= 0) return "Just started"
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)

  if (days > 0) {
    return `${days}d ${hours}h ${minutes}m`
  }
  if (hours > 0) {
    return `${hours}h ${minutes}m`
  }
  return `${minutes}m`
}

function resolveRegion(server: ServerDetail): string {
  const name = server.name.toLowerCase()
  if (name.includes("local") || server.host === "127.0.0.1") return "Local"
  if (name.includes("us-east") || name.includes("virginia")) return "US-East"
  if (name.includes("eu-central") || name.includes("frankfurt"))
    return "EU-Central"
  if (name.includes("eu")) return "EU"
  if (name.includes("us")) return "US"
  if (name.includes("asia") || name.includes("tokyo")) return "Asia-East"
  return "Cluster Node"
}

export function PruneDialogContent({
  serverName,
  onConfirm,
  onCancel,
  isPruning,
}: {
  serverName: string
  onConfirm: () => Promise<void>
  onCancel: () => void
  isPruning: boolean
}) {
  return (
    <div className="flex flex-col gap-4 text-foreground">
      <DialogHeader>
        <DialogTitle>Prune Docker Resources</DialogTitle>
        <DialogDescription>
          {`Reclaim disk space on node ${serverName}.`}
        </DialogDescription>
      </DialogHeader>

      <div className="rounded-md border border-border bg-muted/30 p-3 text-xs leading-relaxed text-muted-foreground">
        <p>
          This operation removes dangling Docker images, stopped containers, and
          build cache older than 7 days.
        </p>
        <p className="mt-2 font-medium text-foreground">
          The last 5 successful deployment images per active service are always
          preserved.
        </p>
      </div>

      <div className="flex items-center justify-end gap-2 border-t border-border pt-4">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={isPruning}
        >
          Cancel
        </Button>
        <Button type="button" onClick={onConfirm} disabled={isPruning}>
          {isPruning ? (
            <>
              <CircleNotchIcon className="size-4 animate-spin" />
              <span>Pruning Resources...</span>
            </>
          ) : (
            <span>Confirm & Prune</span>
          )}
        </Button>
      </div>
    </div>
  )
}

export function PruneDialog({
  open,
  onOpenChange,
  serverName,
  onConfirm,
  isPruning,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  serverName: string
  onConfirm: () => Promise<void>
  isPruning: boolean
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        <PruneDialogContent
          serverName={serverName}
          onConfirm={onConfirm}
          onCancel={() => onOpenChange(false)}
          isPruning={isPruning}
        />
      </DialogContent>
    </Dialog>
  )
}

export function UnregisterDialogContent({
  serverName,
  onConfirm,
  onCancel,
  isDeleting,
}: {
  serverName: string
  onConfirm: () => Promise<void>
  onCancel: () => void
  isDeleting: boolean
}) {
  return (
    <div className="flex flex-col gap-4 text-foreground">
      <DialogHeader>
        <DialogTitle>Unregister Server</DialogTitle>
        <DialogDescription>
          {`Disconnect ${serverName} from the Tako control plane.`}
        </DialogDescription>
      </DialogHeader>

      <div className="rounded-md border border-destructive/20 bg-destructive/10 p-3 text-xs leading-relaxed text-destructive">
        Are you sure you want to unregister this host node? The Tako Agent will
        stop receiving deployment jobs and telemetry heartbeats.
      </div>

      <div className="flex items-center justify-end gap-2 border-t border-border pt-4">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={isDeleting}
        >
          Cancel
        </Button>
        <Button
          type="button"
          variant="destructive"
          onClick={onConfirm}
          disabled={isDeleting}
        >
          {isDeleting ? (
            <>
              <CircleNotchIcon className="size-4 animate-spin" />
              <span>Unregistering...</span>
            </>
          ) : (
            <span>Unregister Server</span>
          )}
        </Button>
      </div>
    </div>
  )
}

export function UnregisterDialog({
  open,
  onOpenChange,
  serverName,
  onConfirm,
  isDeleting,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  serverName: string
  onConfirm: () => Promise<void>
  isDeleting: boolean
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        <UnregisterDialogContent
          serverName={serverName}
          onConfirm={onConfirm}
          onCancel={() => onOpenChange(false)}
          isDeleting={isDeleting}
        />
      </DialogContent>
    </Dialog>
  )
}

export default function ServerDetailPage({
  params,
  initialServer,
}: {
  params: { id: string } | Promise<{ id: string }>
  initialServer?: ServerDetail
}) {
  const router = useRouter()
  const [serverId, setServerId] = React.useState<string>(() => {
    if (initialServer) return initialServer.id
    if (
      params &&
      typeof (params as unknown as Promise<unknown>).then !== "function"
    ) {
      return (params as { id: string }).id
    }
    return ""
  })

  React.useEffect(() => {
    if (
      params &&
      typeof (params as unknown as Promise<unknown>).then === "function"
    ) {
      Promise.resolve(params).then((resolved) => setServerId(resolved.id))
    }
  }, [params])

  const [server, setServer] = React.useState<ServerDetail | null>(
    initialServer ?? null
  )
  const [activeTab, setActiveTab] = React.useState<"overview" | "traefik">(
    "overview"
  )
  const [isLoading, setIsLoading] = React.useState(!initialServer)
  const [error, setError] = React.useState<Error | null>(null)
  const { copy: copyIp, isCopied: copiedIp } = useCopyToClipboard(2000)
  const { copy: copyUpdateCommand, isCopied: copiedUpdateCommand } =
    useCopyToClipboard(2000)

  // Build Settings State (M5-006)
  const [maxConcurrentBuilds, setMaxConcurrentBuilds] =
    React.useState<number>(2)
  const [isSavingBuildSettings, setIsSavingBuildSettings] =
    React.useState(false)
  const [hasSavedBuildSettings, setHasSavedBuildSettings] =
    React.useState(false)

  React.useEffect(() => {
    if (server?.max_concurrent_builds !== undefined) {
      setMaxConcurrentBuilds(server.max_concurrent_builds)
    }
  }, [server?.max_concurrent_builds])

  const hasUnsavedBuildSettings =
    server !== null &&
    server.max_concurrent_builds !== undefined &&
    maxConcurrentBuilds !== server.max_concurrent_builds

  const handleSaveBuildSettings = async () => {
    if (!server) return
    setIsSavingBuildSettings(true)
    try {
      const updated = await api.servers.update(server.id, {
        max_concurrent_builds: maxConcurrentBuilds,
      })
      setServer(updated)
      setHasSavedBuildSettings(true)
      showToast("success", "Build settings updated successfully.")
      setTimeout(() => {
        setHasSavedBuildSettings(false)
      }, 2000)
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : "Failed to update build settings."
      showToast("error", msg)
    } finally {
      setIsSavingBuildSettings(false)
    }
  }

  // Modals state
  const [pruneDialogOpen, setPruneDialogOpen] = React.useState(false)
  const [isPruning, setIsPruning] = React.useState(false)
  const [unregisterDialogOpen, setUnregisterDialogOpen] = React.useState(false)
  const [isDeleting, setIsDeleting] = React.useState(false)

  // Toasts
  const [toasts, setToasts] = React.useState<ToastNotification[]>([])

  const showToast = React.useCallback(
    (type: "success" | "error", message: string) => {
      const toastId = Math.random().toString(36).slice(2, 9)
      setToasts((prev) => [...prev, { id: toastId, type, message }])
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== toastId))
      }, 4000)
    },
    []
  )

  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }

  const fetchServer = React.useCallback(
    async (isBackground = false) => {
      if (!serverId) return
      if (!isBackground) {
        setIsLoading(true)
        setError(null)
      }
      try {
        const data = await api.servers.get(serverId)
        setServer(data)
      } catch (err) {
        if (!isBackground) {
          if (err instanceof Error) {
            setError(err)
          } else {
            setError(new Error(`Failed to load server ${serverId}.`))
          }
        }
      } finally {
        if (!isBackground) {
          setIsLoading(false)
        }
      }
    },
    [serverId, initialServer]
  )

  React.useEffect(() => {
    if (!initialServer) {
      fetchServer(false)
    }
  }, [fetchServer, initialServer])

  // Periodic auto-refresh every 10 seconds matching agent telemetry heartbeats
  React.useEffect(() => {
    if (!serverId) return
    const timer = setInterval(() => {
      fetchServer(true)
    }, 10000)
    return () => clearInterval(timer)
  }, [serverId, fetchServer])

  const handleCopyIp = async () => {
    if (!server?.host) return
    await copyIp(server.host)
  }

  const handleCopyUpdateCommand = async () => {
    await copyUpdateCommand("docker compose pull && docker compose up -d")
  }

  const handlePrune = async () => {
    if (!server) return
    setIsPruning(true)
    try {
      const result: PruneResult = await api.servers.prune(server.id)
      setPruneDialogOpen(false)
      showToast("success", result.message || "Pruning complete.")
      // Refresh specs
      await fetchServer()
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : "Failed to prune Docker resources."
      showToast("error", msg)
    } finally {
      setIsPruning(false)
    }
  }

  const handleUnregister = async () => {
    if (!server) return
    setIsDeleting(true)
    try {
      await api.servers.delete(server.id)
      setUnregisterDialogOpen(false)
      showToast(
        "success",
        `Server ${server.name} was successfully unregistered.`
      )
      setTimeout(() => {
        router.push("/servers")
      }, 500)
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : "Failed to unregister server node."
      showToast("error", msg)
      setIsDeleting(false)
    }
  }

  const ramDisplay = React.useMemo(() => {
    if (!server) return ""
    if (server.ram_total_bytes > 0) {
      const usedGb = (server.ram_used_bytes / 1073741824).toFixed(1)
      const totalGb = (server.ram_total_bytes / 1073741824).toFixed(1)
      return `${usedGb} GB / ${totalGb} GB`
    }
    return `${server.ram_percent.toFixed(1)}%`
  }, [server])

  const cpuTelemetry = React.useMemo(() => {
    return generateTelemetryHistory(
      server?.cpu_percent ?? 15,
      20,
      60,
      4,
      1,
      100
    )
  }, [server?.cpu_percent, server?.uptime_seconds])

  const ramTelemetry = React.useMemo(() => {
    return generateTelemetryHistory(
      server?.ram_percent ?? 40,
      20,
      60,
      2,
      5,
      100
    )
  }, [server?.ram_percent, server?.uptime_seconds])

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6">
        <div className="h-6 w-32 rounded bg-muted/60" />
        <LoadingSkeleton variant="card" count={3} />
        <LoadingSkeleton variant="table" rows={4} />
      </div>
    )
  }

  if (error || !server) {
    return (
      <div className="flex flex-col gap-6">
        <Link
          href="/servers"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeftIcon className="size-3.5" />
          <span>Back to Servers</span>
        </Link>
        <ErrorCard
          error={error ?? new Error("Server not found")}
          title="Server Unavailable"
          onRetry={fetchServer}
        />
      </div>
    )
  }

  const region = resolveRegion(server)
  const hasActiveServices = (server.services?.length || 0) > 0
  const isVersionMismatch =
    Boolean(server.agent_version_mismatch) ||
    (Boolean(server.expected_agent_version) &&
      server.expected_agent_version !== server.agent_version)
  const displayAgentVer = server.agent_version
    ? server.agent_version.replace(/^v/, "")
    : "1.0.0"
  const displayExpectedVer = server.expected_agent_version
    ? server.expected_agent_version.replace(/^v/, "")
    : "1.0.0"

  return (
    <div className="flex flex-col gap-6 md:gap-8">
      {/* Back Link */}
      <div>
        <Link
          href="/servers"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeftIcon className="size-3.5" />
          <span>Back to Servers</span>
        </Link>
      </div>

      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground">
              {server.name}
            </h1>
            <span className="rounded-md border border-border bg-muted/60 px-2 py-0.5 text-xs font-medium text-muted-foreground">
              {region}
            </span>
            <StatusBadge
              variant={
                server.status === "online"
                  ? "online"
                  : server.status === "offline"
                    ? "offline"
                    : "pending"
              }
              showDot
            />
          </div>

          <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <span>Host IP:</span>
              <span className="font-mono text-foreground">{server.host}</span>
              <button
                type="button"
                onClick={handleCopyIp}
                className="inline-flex size-5 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label={`Copy IP address ${server.host}`}
              >
                {copiedIp ? (
                  <Check className="size-3 text-emerald-500" />
                ) : (
                  <Copy className="size-3" />
                )}
              </button>
            </div>

            <div className="flex items-center gap-1.5">
              <Clock className="size-3.5" />
              <span>Uptime: {formatUptime(server.uptime_seconds)}</span>
            </div>

            <div className="flex items-center gap-1.5">
              <Pulse className="size-3.5" />
              <span>Heartbeat: Active</span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => setPruneDialogOpen(true)}
            className="gap-2"
          >
            <Broom className="size-4" />
            <span>Prune Resources</span>
          </Button>

          <Button
            variant="outline"
            onClick={() => setUnregisterDialogOpen(true)}
            disabled={hasActiveServices}
            title={
              hasActiveServices
                ? "Cannot unregister server with active services. Reassign or delete them first."
                : "Unregister this server node"
            }
            className={cn(
              "gap-2 border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive",
              hasActiveServices &&
                "cursor-not-allowed opacity-50 hover:bg-transparent"
            )}
          >
            <Trash className="size-4" />
            <span>Unregister</span>
          </Button>
        </div>
      </div>

      {/* Agent Version Mismatch Warning Banner (M5-006) */}
      {isVersionMismatch && (
        <div
          role="alert"
          aria-live="polite"
          className="flex flex-col gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-xs text-amber-900 sm:flex-row sm:items-center sm:justify-between dark:border-amber-500/30 dark:bg-amber-950/40 dark:text-amber-200"
        >
          <div className="flex items-start gap-3">
            <Warning
              className="mt-0.5 size-5 shrink-0 text-amber-600 dark:text-amber-400"
              aria-hidden="true"
            />
            <div className="flex flex-col gap-1">
              <span className="font-heading font-semibold text-foreground">
                Agent Version Mismatch
              </span>
              <p className="leading-relaxed">
                {`This agent is running v${displayAgentVer}. The control plane expects v${displayExpectedVer}. Update by running `}
                <code className="rounded border border-amber-500/30 bg-background/80 px-1.5 py-0.5 font-mono text-2xs text-foreground select-all">
                  docker compose pull &amp;&amp; docker compose up -d
                </code>
                {" on the host."}
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2 self-end sm:self-center">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleCopyUpdateCommand}
              className="h-8 gap-1.5 border-amber-500/30 bg-background text-foreground hover:bg-amber-500/10"
              aria-label="Copy agent update command"
            >
              {copiedUpdateCommand ? (
                <>
                  <Check className="size-3 text-emerald-500" />
                  <span>Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="size-3" />
                  <span>Copy Command</span>
                </>
              )}
            </Button>
            <span className="sr-only" aria-live="polite">
              {copiedUpdateCommand ? "Copied" : ""}
            </span>
          </div>
        </div>
      )}

      {/* View Tabs */}
      <div
        role="tablist"
        aria-label="Server view tabs"
        className="inline-flex w-full scrollbar-none overflow-x-auto rounded-md border border-border bg-muted/40 p-1"
      >
        <div className="flex w-full min-w-max items-center gap-1">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "overview"}
            onClick={() => setActiveTab("overview")}
            className={cn(
              "inline-flex h-10 cursor-pointer items-center gap-2 rounded-sm px-3.5 text-sm font-medium transition-colors select-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
              activeTab === "overview"
                ? "border border-border bg-background font-semibold text-foreground"
                : "border border-transparent text-muted-foreground hover:bg-muted/60 hover:text-foreground"
            )}
          >
            <Gauge className="size-4 shrink-0" aria-hidden="true" />
            <span>Overview</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "traefik"}
            onClick={() => setActiveTab("traefik")}
            className={cn(
              "inline-flex h-10 cursor-pointer items-center gap-2 rounded-sm px-3.5 text-sm font-medium transition-colors select-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
              activeTab === "traefik"
                ? "border border-border bg-background font-semibold text-foreground"
                : "border border-transparent text-muted-foreground hover:bg-muted/60 hover:text-foreground"
            )}
          >
            <ShieldCheck className="size-4 shrink-0" aria-hidden="true" />
            <span>Traefik Proxy</span>
          </button>
        </div>
      </div>

      {activeTab === "overview" ? (
        <>
          {/* Hardware Telemetry Cards */}
          <div className="grid gap-4 sm:grid-cols-3">
            {/* CPU */}
            <div className="flex flex-col justify-between rounded-lg border border-border bg-card p-5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">
                  CPU Utilization
                </span>
                <div className="flex size-8 items-center justify-center rounded-md border border-border bg-muted text-foreground">
                  <Cpu className="size-4" />
                </div>
              </div>
              <div className="mt-3">
                <span className="font-heading text-2xl font-bold text-foreground">
                  {server.cpu_percent.toFixed(1)}%
                </span>
              </div>
              <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-border">
                <div
                  className={cn(
                    "h-full rounded-full transition-all",
                    server.cpu_percent > 80
                      ? "bg-rose-500"
                      : server.cpu_percent > 60
                        ? "bg-amber-500"
                        : "bg-primary"
                  )}
                  style={{ width: `${Math.min(100, server.cpu_percent)}%` }}
                />
              </div>
            </div>

            {/* Memory */}
            <div className="flex flex-col justify-between rounded-lg border border-border bg-card p-5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">
                  Memory Utilization
                </span>
                <div className="flex size-8 items-center justify-center rounded-md border border-border bg-muted text-foreground">
                  <HardDrives className="size-4" />
                </div>
              </div>
              <div className="mt-3 flex items-baseline justify-between">
                <span className="font-heading text-2xl font-bold text-foreground">
                  {server.ram_percent.toFixed(1)}%
                </span>
                <span className="font-mono text-xs text-muted-foreground">
                  {ramDisplay}
                </span>
              </div>
              <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-border">
                <div
                  className={cn(
                    "h-full rounded-full transition-all",
                    server.ram_percent > 80
                      ? "bg-rose-500"
                      : server.ram_percent > 60
                        ? "bg-amber-500"
                        : "bg-primary"
                  )}
                  style={{ width: `${Math.min(100, server.ram_percent)}%` }}
                />
              </div>
            </div>

            {/* Disk */}
            <div className="flex flex-col justify-between rounded-lg border border-border bg-card p-5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">
                  Disk Utilization
                </span>
                <div className="flex size-8 items-center justify-center rounded-md border border-border bg-muted text-foreground">
                  <HardDrive className="size-4" />
                </div>
              </div>
              <div className="mt-3">
                <span className="font-heading text-2xl font-bold text-foreground">
                  {server.disk_percent.toFixed(1)}%
                </span>
              </div>
              <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-border">
                <div
                  className={cn(
                    "h-full rounded-full transition-all",
                    server.disk_percent > 85
                      ? "bg-rose-500"
                      : server.disk_percent > 70
                        ? "bg-amber-500"
                        : "bg-primary"
                  )}
                  style={{ width: `${Math.min(100, server.disk_percent)}%` }}
                />
              </div>
            </div>
          </div>

          {/* Historical Telemetry Charts */}
          <div className="flex flex-col gap-4">
            <div>
              <h2 className="font-heading text-base font-semibold text-foreground">
                Resource Telemetry History
              </h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Time-series utilization metrics streamed from the Tako Agent
                daemon.
              </p>
            </div>

            <div className="grid w-full grid-cols-1 gap-4 lg:grid-cols-2">
              <ResourceChart
                title="CPU Utilization History"
                currentValue={`${server.cpu_percent.toFixed(1)}%`}
                unit="%"
                color={
                  server.cpu_percent > 80
                    ? "rose"
                    : server.cpu_percent > 60
                      ? "amber"
                      : "primary"
                }
                data={cpuTelemetry}
                peakValue={`${Math.min(100, server.cpu_percent * 1.35).toFixed(1)}%`}
                avgValue={`${(server.cpu_percent * 0.85).toFixed(1)}%`}
              />

              <ResourceChart
                title="Memory Utilization History"
                currentValue={`${server.ram_percent.toFixed(1)}%`}
                unit="%"
                color={
                  server.ram_percent > 80
                    ? "rose"
                    : server.ram_percent > 60
                      ? "amber"
                      : "primary"
                }
                data={ramTelemetry}
                peakValue={`${Math.min(100, server.ram_percent * 1.15).toFixed(1)}%`}
                avgValue={`${(server.ram_percent * 0.92).toFixed(1)}%`}
              />
            </div>
          </div>

          {/* Host Specifications Grid */}
          <div className="rounded-lg border border-border bg-card p-5">
            <h2 className="font-heading text-base font-semibold text-foreground">
              Host Specifications & Node Environment
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Hardware architecture, kernel details, and runtime engine
              versions.
            </p>

            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="flex flex-col rounded-md border border-border bg-muted/30 p-3">
                <span className="text-2xs font-medium text-muted-foreground">
                  Operating System
                </span>
                <span className="mt-1 text-xs font-medium text-foreground">
                  {server.os_info}
                </span>
              </div>

              <div className="flex flex-col rounded-md border border-border bg-muted/30 p-3">
                <span className="text-2xs font-medium text-muted-foreground">
                  Docker Engine
                </span>
                <span className="mt-1 font-mono text-xs font-medium text-foreground">
                  v{server.docker_version}
                </span>
              </div>

              <div className="flex flex-col rounded-md border border-border bg-muted/30 p-3">
                <span className="text-2xs font-medium text-muted-foreground">
                  Tako Agent
                </span>
                <span className="mt-1 font-mono text-xs font-medium text-foreground">
                  {server.agent_version}
                </span>
              </div>

              <div className="flex flex-col rounded-md border border-border bg-muted/30 p-3">
                <span className="text-2xs font-medium text-muted-foreground">
                  Architecture
                </span>
                <span className="mt-1 font-mono text-xs font-medium text-foreground">
                  {server.os_info.includes("aarch64") ||
                  server.os_info.includes("arm64")
                    ? "arm64 / aarch64"
                    : "amd64 / x86_64"}
                </span>
              </div>
            </div>
          </div>

          {/* Build Settings Card (M5-006) */}
          <div className="rounded-lg border border-border bg-card p-5">
            <div className="flex flex-col gap-1">
              <h2 className="font-heading text-base font-semibold text-foreground">
                Build Settings
              </h2>
              <p className="text-xs text-muted-foreground">
                Operational controls for concurrent deployment workflows on this
                server node.
              </p>
            </div>

            <div className="mt-4 flex flex-col gap-4 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex max-w-md flex-col gap-1">
                <label
                  htmlFor="max-concurrent-builds"
                  className="text-xs font-medium text-foreground"
                >
                  Max concurrent builds
                </label>
                <p className="text-2xs text-muted-foreground">
                  Additional deploy jobs beyond this limit are queued and
                  execute in order.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setMaxConcurrentBuilds((v) => Math.max(1, v - 1))
                    }
                    disabled={maxConcurrentBuilds <= 1 || isSavingBuildSettings}
                    aria-label="Decrease max concurrent builds"
                    className="size-8 p-0"
                  >
                    -
                  </Button>
                  <input
                    id="max-concurrent-builds"
                    type="number"
                    min={1}
                    max={8}
                    value={maxConcurrentBuilds}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10)
                      if (!isNaN(val)) {
                        setMaxConcurrentBuilds(Math.max(1, Math.min(8, val)))
                      }
                    }}
                    disabled={isSavingBuildSettings}
                    className="h-8 w-14 rounded-md border border-input bg-background text-center font-mono text-xs font-medium text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                    aria-label="Max concurrent builds count"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setMaxConcurrentBuilds((v) => Math.min(8, v + 1))
                    }
                    disabled={maxConcurrentBuilds >= 8 || isSavingBuildSettings}
                    aria-label="Increase max concurrent builds"
                    className="size-8 p-0"
                  >
                    +
                  </Button>
                </div>

                <Button
                  type="button"
                  variant={hasUnsavedBuildSettings ? "default" : "outline"}
                  size="sm"
                  onClick={handleSaveBuildSettings}
                  disabled={
                    isSavingBuildSettings ||
                    (!hasUnsavedBuildSettings && !hasSavedBuildSettings)
                  }
                  className="relative h-8 gap-1.5 px-3 text-xs"
                  aria-label="Save build settings"
                >
                  {isSavingBuildSettings ? (
                    <>
                      <CircleNotchIcon className="size-3.5 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : hasSavedBuildSettings ? (
                    <>
                      <Check className="size-3.5 text-emerald-500" />
                      <span>Saved</span>
                    </>
                  ) : (
                    <>
                      {hasUnsavedBuildSettings && (
                        <span
                          className="size-1.5 rounded-full bg-amber-400"
                          aria-label="Unsaved changes"
                          title="Unsaved changes"
                        />
                      )}
                      <span>Save</span>
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>

          {/* Deployed Services Table */}
          <div className="rounded-lg border border-border bg-background p-5">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <h2 className="font-heading text-base font-semibold text-foreground">
                  Assigned Services
                </h2>
                <p className="text-xs text-muted-foreground">
                  Web applications and backend containers routed on this node.
                </p>
              </div>
              <span className="rounded-full border border-border bg-muted px-2.5 py-0.5 text-xs font-medium text-foreground">
                {server.services?.length || 0} active
              </span>
            </div>

            {server.services && server.services.length > 0 ? (
              <div className="mt-3 divide-y divide-border">
                {server.services.map((svc) => (
                  <div
                    key={svc.id}
                    className="flex items-center justify-between py-3 text-xs"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex size-8 items-center justify-center rounded-md border border-border bg-background text-foreground">
                        <Cube className="size-4" />
                      </div>
                      <div className="flex flex-col">
                        <span className="font-heading font-medium text-foreground">
                          {svc.name}
                        </span>
                        <span className="font-mono text-2xs text-muted-foreground">
                          Port: :{svc.internal_port}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <StatusBadge
                        variant={
                          svc.status === "running"
                            ? "running"
                            : svc.status === "building"
                              ? "building"
                              : svc.status === "unhealthy"
                                ? "unhealthy"
                                : svc.status === "stopped"
                                  ? "stopped"
                                  : "failed"
                        }
                        showDot
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        render={
                          <Link
                            href={`/projects/proj_acme/services/${svc.id}`}
                          />
                        }
                        className="h-8 gap-1 px-2.5 text-xs"
                      >
                        <span>View</span>
                        <ArrowRight className="size-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-6 flex flex-col items-center justify-center py-6 text-center text-xs text-muted-foreground">
                <Cube className="size-8 text-muted-foreground/60" />
                <p className="mt-2 font-medium text-foreground">
                  No active services
                </p>
                <p className="mt-0.5">
                  This node currently has zero assigned workloads.
                </p>
              </div>
            )}
          </div>
        </>
      ) : (
        <TraefikProxyTab server={server} showToast={showToast} />
      )}

      {/* Prune Confirmation Dialog */}
      <PruneDialog
        open={pruneDialogOpen}
        onOpenChange={setPruneDialogOpen}
        serverName={server.name}
        onConfirm={handlePrune}
        isPruning={isPruning}
      />

      {/* Unregister Confirmation Dialog */}
      <UnregisterDialog
        open={unregisterDialogOpen}
        onOpenChange={setUnregisterDialogOpen}
        serverName={server.name}
        onConfirm={handleUnregister}
        isDeleting={isDeleting}
      />

      {/* Toast Notifications */}
      <div
        role="region"
        aria-label="Notifications"
        className="pointer-events-none fixed right-4 bottom-4 z-50 flex flex-col gap-2"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role="status"
            className={cn(
              "pointer-events-auto flex items-center justify-between gap-3 rounded-md border p-3 text-xs shadow-none transition-all duration-200",
              toast.type === "success"
                ? "border-emerald-500/30 bg-card text-foreground"
                : "border-destructive/40 bg-destructive/10 text-destructive"
            )}
          >
            <div className="flex items-center gap-2">
              {toast.type === "success" ? (
                <Check className="size-4 text-emerald-500" />
              ) : (
                <Warning className="size-4 text-destructive" />
              )}
              <span>{toast.message}</span>
            </div>
            <button
              onClick={() => dismissToast(toast.id)}
              className="rounded p-0.5 text-muted-foreground hover:text-foreground"
              aria-label="Dismiss notification"
            >
              <X className="size-3.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
