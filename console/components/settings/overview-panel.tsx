"use client"

import * as React from "react"
import {
  Archive,
  ArrowRight,
  ArrowUpCircle,
  Bell,
  Boxes,
  CheckCircle2,
  Clock,
  FolderGit2,
  Globe,
  HardDrive,
  Info,
  Loader2,
  Radio,
  RefreshCw,
  Server,
  ShieldCheck,
  Sliders,
  Users,
} from "lucide-react"

import { SettingsSectionHeader } from "@/components/settings/settings-section-header"
import type { SettingsSection } from "@/components/settings/settings-nav"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { usePlatformData } from "@/context/platform-data-context"
import { cn } from "@/lib/utils"

interface OverviewPanelProps {
  onNavigateToTab?: (tab: SettingsSection) => void
}

export function OverviewPanel({ onNavigateToTab }: OverviewPanelProps) {
  const {
    nodes,
    services,
    settings,
    snapshots,
    domainConfig,
    users,
    invites,
    registries,
    gitProviders,
    syncedRepos,
    systemVersion,
    checkSystemVersion,
    updateSystem,
  } = usePlatformData()

  const [updateModalOpen, setUpdateModalOpen] = React.useState(false)
  const [isCheckingUpdate, setIsCheckingUpdate] = React.useState(false)
  const [isUpdating, setIsUpdating] = React.useState(false)
  const [updateDone, setUpdateDone] = React.useState(false)

  // Real Computed Cluster Metrics
  const onlineNodes = nodes.filter((n) => n.status === "online")
  const leaderNode = nodes.find((n) => n.role === "master") || nodes[0]
  const leaderIp = leaderNode?.ipAddress || "142.250.190.46"
  const runningServices = services.filter(
    (s) => s.status === "running" || s.status === "deploying"
  )
  const isClusterHealthy =
    nodes.length > 0 && onlineNodes.length === nodes.length

  const s3Buckets = settings.s3Buckets || []
  const defaultBucket = s3Buckets.find((b) => b.isDefault) || s3Buckets[0]

  // Active notification channels
  const activeChannels: string[] = []
  if (settings.webhookUrl) activeChannels.push("Discord")
  if (settings.slackWebhookUrl) activeChannels.push("Slack")
  if (settings.emailAlertsEnabled) activeChannels.push("Email")
  if (settings.telegramEnabled) activeChannels.push("Telegram")

  const handleCheckUpdate = async () => {
    setIsCheckingUpdate(true)
    try {
      await checkSystemVersion()
    } finally {
      setIsCheckingUpdate(false)
    }
  }

  const handleStartUpdate = async () => {
    setIsUpdating(true)
    try {
      await updateSystem("all")
      setUpdateDone(true)
      setTimeout(() => {
        setUpdateModalOpen(false)
        setUpdateDone(false)
      }, 1500)
    } catch {
      //
    } finally {
      setIsUpdating(false)
    }
  }

  const subsystemItems = [
    {
      id: "users" as SettingsSection,
      title: "Team & RBAC",
      icon: Users,
      headline: `${users.length} Active Operators`,
      subline:
        invites.length > 0
          ? `${invites.length} pending invite${invites.length === 1 ? "" : "s"}`
          : "RBAC quorum fully configured",
      status: invites.length > 0 ? "warning" : "healthy",
      statusText:
        invites.length > 0 ? `${invites.length} Pending` : "Synchronized",
      actionLabel: "Manage team",
    },
    {
      id: "registries" as SettingsSection,
      title: "Docker Registries",
      icon: Boxes,
      headline: `${registries.length} Registries Connected`,
      subline:
        registries.length > 0
          ? registries.map((r) => r.name).join(", ")
          : "No private registry authenticated",
      status: registries.length > 0 ? "healthy" : "warning",
      statusText: registries.length > 0 ? "Authenticated" : "Action Needed",
      actionLabel: "Configure registries",
    },
    {
      id: "storage" as SettingsSection,
      title: "S3 Object Storage",
      icon: HardDrive,
      headline: `${s3Buckets.length} Configured Buckets`,
      subline: defaultBucket
        ? `Default: ${defaultBucket.name}`
        : "No storage bucket active",
      status: s3Buckets.length > 0 ? "healthy" : "warning",
      statusText: s3Buckets.length > 0 ? "Storage Ready" : "Unconfigured",
      actionLabel: "Manage buckets",
    },
    {
      id: "git" as SettingsSection,
      title: "Git Providers",
      icon: FolderGit2,
      headline:
        gitProviders.length > 0
          ? `${gitProviders[0]?.type === "github" ? "GitHub" : "GitLab"} Synced`
          : "No Git Provider",
      subline: `${syncedRepos.length} repositories enabled for webhook CI`,
      status: gitProviders.length > 0 ? "healthy" : "neutral",
      statusText: gitProviders.length > 0 ? "Webhooks Active" : "Disconnected",
      actionLabel: "Manage providers",
    },
    {
      id: "backups" as SettingsSection,
      title: "Backups & Snapshots",
      icon: Archive,
      headline: `${snapshots.length} Snapshots Retained`,
      subline: `Automated ${settings.backupSchedule?.frequency || "daily"} at 03:00 UTC`,
      status: snapshots.length > 0 ? "healthy" : "warning",
      statusText: snapshots.length > 0 ? "Automated" : "No Backups",
      actionLabel: "Configure backups",
    },
    {
      id: "domain" as SettingsSection,
      title: "Cluster Domain",
      icon: Globe,
      headline: domainConfig?.domain || "edge.gettako.dev",
      subline: "Let's Encrypt automated TLS certificate renewal",
      status: domainConfig?.sslActive ? "healthy" : "warning",
      statusText: domainConfig?.sslActive ? "SSL Active" : "DNS Degraded",
      actionLabel: "Manage domain",
    },
    {
      id: "notifications" as SettingsSection,
      title: "Notifications",
      icon: Bell,
      headline:
        activeChannels.length > 0
          ? `${activeChannels.join(", ")} Active`
          : "No Channels Configured",
      subline: settings.notificationsEnabled
        ? "Alert broadcasts for node outages & deploy failures"
        : "Platform notifications are currently disabled",
      status:
        settings.notificationsEnabled && activeChannels.length > 0
          ? "healthy"
          : "warning",
      statusText:
        settings.notificationsEnabled && activeChannels.length > 0
          ? "Broadcasting"
          : "Muted",
      actionLabel: "Configure alerts",
    },
    {
      id: "network" as SettingsSection,
      title: "Daemon & Security",
      icon: Radio,
      headline: `gRPC Port ${settings.masterGrpcPort || 50051}`,
      subline: `Heartbeat ${settings.telemetryIntervalSec || 5}s interval with root mTLS`,
      status: "healthy",
      statusText: "Strict mTLS",
      actionLabel: "Inspect daemon",
    },
  ]

  return (
    <div className="space-y-6">
      {/* 1. Control Plane & Consensus Engine */}
      <div className="space-y-5 rounded-lg border border-border bg-card p-5 shadow-xs sm:p-6">
        <SettingsSectionHeader
          icon={Sliders}
          title="Tako Control Plane Specifications"
          description="Real-time orchestrator runtime state, consensus topology, and leader election specifications."
          action={
            <div
              className={cn(
                "inline-flex items-center gap-1.5 rounded border px-2.5 py-1 font-mono text-[11px] font-medium",
                isClusterHealthy
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-500"
                  : "border-amber-500/30 bg-amber-500/10 text-amber-500"
              )}
            >
              <CheckCircle2 className="size-3" />
              <span>
                {isClusterHealthy ? "Consensus Healthy" : "Degraded Quorum"}
              </span>
            </div>
          }
        />

        {/* Telemetry Metrics Grid */}
        <div className="grid grid-cols-2 gap-4 rounded-lg border border-border bg-muted/20 p-4 font-mono text-xs sm:grid-cols-4">
          <div className="space-y-1">
            <span className="block font-sans text-[11px] text-muted-foreground">
              Consensus Mode
            </span>
            <span className="font-semibold text-foreground">
              {nodes.length > 1 ? "Raft Multi-Node" : "Raft Single-Leader"}
            </span>
            <span className="block truncate text-[10px] text-muted-foreground">
              Leader: {leaderNode?.name || "leader-01"}
            </span>
          </div>

          <div className="space-y-1">
            <span className="block font-sans text-[11px] text-muted-foreground">
              gRPC Transport
            </span>
            <span className="font-semibold text-foreground">
              Port {settings.masterGrpcPort || 50051}
            </span>
            <span className="flex items-center gap-1 text-[10px] text-emerald-500">
              <ShieldCheck className="size-3" />
              <span>HTTP/2 mTLS</span>
            </span>
          </div>

          <div className="space-y-1">
            <span className="block font-sans text-[11px] text-muted-foreground">
              Leader Endpoint
            </span>
            <span className="block truncate font-semibold text-foreground">
              {leaderIp}
            </span>
            <span className="block text-[10px] text-muted-foreground">
              Direct Agent Stream
            </span>
          </div>

          <div className="space-y-1">
            <span className="block font-sans text-[11px] text-muted-foreground">
              Node Quorum
            </span>
            <span className="font-semibold text-foreground">
              {onlineNodes.length} / {nodes.length} Online
            </span>
            <span className="block text-[10px] text-muted-foreground">
              {onlineNodes.length === nodes.length
                ? "Full Mesh Synchronized"
                : "Partial Mesh Reconnecting"}
            </span>
          </div>
        </div>

        {/* Platform Version & Updates Banner */}
        <div className="flex flex-col gap-3 rounded-lg border border-border bg-muted/10 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-md border border-primary/20 bg-primary/10 text-primary">
              <ArrowUpCircle className="size-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-foreground">
                  Tako Platform Core:{" "}
                  {systemVersion?.currentVersion || "v1.4.2-edge"}
                </span>
                {systemVersion?.updateAvailable ? (
                  <span className="rounded border border-primary/20 bg-primary/10 px-1.5 py-0.5 font-mono text-[10px] font-medium text-primary">
                    Update Available ({systemVersion.latestVersion})
                  </span>
                ) : (
                  <span className="rounded border border-emerald-500/20 bg-emerald-500/10 px-1.5 py-0.5 font-mono text-[10px] font-medium text-emerald-500">
                    Latest Version
                  </span>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground">
                {systemVersion?.updateAvailable
                  ? "Zero-downtime rolling update package available on GitHub Container Registry."
                  : "All control plane components and edge daemons are up to date."}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleCheckUpdate}
              disabled={isCheckingUpdate}
              className="gap-1.5 text-xs"
            >
              <RefreshCw
                className={cn("size-3.5", isCheckingUpdate && "animate-spin")}
              />
              <span>{isCheckingUpdate ? "Checking..." : "Check Updates"}</span>
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => setUpdateModalOpen(true)}
              className="gap-1.5 text-xs"
            >
              <ArrowUpCircle className="size-3.5" />
              <span>Update Platform</span>
            </Button>
          </div>
        </div>
      </div>

      {/* 2. Proactive Attention Notice (if actionable items exist) */}
      {invites.length > 0 && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-xs">
          <div className="flex items-center gap-2.5">
            <Info className="size-4 shrink-0 text-amber-500" />
            <span className="text-foreground">
              <strong>Action Notice:</strong> {invites.length} pending team
              invitation waiting for acceptance.
            </span>
          </div>
          <button
            type="button"
            onClick={() => onNavigateToTab?.("users")}
            className="inline-flex shrink-0 items-center gap-1 font-medium text-amber-500 hover:underline"
          >
            <span>Review invites</span>
            <ArrowRight className="size-3" />
          </button>
        </div>
      )}

      {/* 3. Platform Configuration & Subsystem Matrix (8 Domains) */}
      <div className="space-y-4 rounded-lg border border-border bg-card p-5 shadow-xs sm:p-6">
        <SettingsSectionHeader
          icon={Server}
          title="Platform Subsystem & Configuration Readiness"
          description="At-a-glance operational verification across all 8 cluster configuration domains."
          action={
            <span className="font-mono text-xs text-muted-foreground">
              {runningServices.length} / {services.length} Services Active
            </span>
          }
        />

        <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
          {subsystemItems.map((item) => {
            const Icon = item.icon
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onNavigateToTab?.(item.id)}
                aria-label={`Configure ${item.title}`}
                className="group flex w-full items-center justify-between gap-4 rounded-lg border border-border bg-card p-4 text-left transition-colors hover:border-primary/40 hover:bg-muted/10 focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
              >
                <div className="flex min-w-0 items-start gap-3.5">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-md border border-border bg-muted/40 text-primary transition-colors group-hover:border-primary/30 group-hover:bg-primary/10">
                    <Icon className="size-4" />
                  </div>
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-semibold text-foreground transition-colors group-hover:text-primary">
                        {item.title}
                      </span>
                      <span
                        className={cn(
                          "rounded px-1.5 py-0.5 font-mono text-[10px] font-medium",
                          item.status === "healthy" &&
                            "border border-emerald-500/30 bg-emerald-500/10 text-emerald-500",
                          item.status === "warning" &&
                            "border border-amber-500/30 bg-amber-500/10 text-amber-500",
                          item.status === "neutral" &&
                            "border border-border bg-muted text-muted-foreground"
                        )}
                      >
                        {item.statusText}
                      </span>
                    </div>

                    <p className="truncate font-mono text-xs font-medium text-foreground">
                      {item.headline}
                    </p>
                    <p className="line-clamp-1 text-[11px] text-muted-foreground">
                      {item.subline}
                    </p>
                  </div>
                </div>

                <div className="flex size-8 shrink-0 items-center justify-center rounded-md border border-border bg-muted/20 text-muted-foreground transition-all group-hover:border-primary/40 group-hover:bg-primary/10 group-hover:text-primary">
                  <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
                </div>
              </button>
            )
          })}
        </div>

        {/* Compact Workload & Quorum Summary Footer */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-2 font-mono text-[11px]">
            <Clock className="size-3.5 text-muted-foreground" />
            <span>
              Telemetry Heartbeat: {settings.telemetryIntervalSec || 5}s stream
            </span>
          </div>
          <div className="font-mono text-[11px]">
            <span>Active Workload: </span>
            <span className="font-semibold text-foreground">
              {runningServices.length} containers
            </span>
            <span> across </span>
            <span className="font-semibold text-foreground">
              {onlineNodes.length} edge hosts
            </span>
          </div>
        </div>
      </div>

      {/* Update Platform Dialog */}
      <Dialog open={updateModalOpen} onOpenChange={setUpdateModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowUpCircle className="size-4 shrink-0 text-primary" />
              <span>Update Tako Platform Core</span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              Initiate an automated rolling update across the Tako control plane
              and connected worker agents.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <div className="flex items-center justify-between rounded-lg border border-border bg-muted/20 p-3">
              <div>
                <span className="block font-mono text-[10px] text-muted-foreground">
                  CURRENT VERSION
                </span>
                <span className="font-mono font-semibold text-foreground">
                  v1.4.2-edge
                </span>
              </div>
              <span className="font-mono text-xs text-muted-foreground">→</span>
              <div className="text-right">
                <span className="block font-mono text-[10px] text-muted-foreground">
                  TARGET VERSION
                </span>
                <span className="font-mono font-semibold text-primary">
                  v1.5.0-release
                </span>
              </div>
            </div>

            <div className="space-y-1.5 rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs">
              <div className="flex items-center gap-1.5 font-semibold text-primary">
                <ShieldCheck className="size-3.5 shrink-0" />
                <span>Zero-Downtime Rolling Update</span>
              </div>
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                Container images are refreshed via GitHub Container Registry.
                SQLite schema migrations execute safely in WAL mode, and running
                applications continue serving traffic uninterrupted.
              </p>
            </div>

            {updateDone && (
              <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs font-medium text-emerald-500">
                <CheckCircle2 className="size-4 shrink-0" />
                <span>Platform updated successfully to v1.5.0-release!</span>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 pt-2 sm:gap-2.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isUpdating}
              onClick={() => setUpdateModalOpen(false)}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={isUpdating || updateDone}
              onClick={handleStartUpdate}
              className="gap-1.5 text-xs"
            >
              {isUpdating ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  <span>Applying Rolling Update...</span>
                </>
              ) : (
                <>
                  <ArrowUpCircle className="size-3.5" />
                  <span>Start Update</span>
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
