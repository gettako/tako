"use client"

import * as React from "react"
import Link from "next/link"
import { SettingsHeader } from "@/components/settings-header"
import {
  CloudArrowUpIcon,
  CircleNotchIcon,
  CheckIcon,
  WarningIcon,
  DatabaseIcon,
  DownloadSimpleIcon,
  TrashIcon,
  HardDrivesIcon,
  ArrowUpRightIcon,
} from "@phosphor-icons/react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { toast } from "@/components/ui/toast"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  api,
  ApiError,
  type BackupConfig,
  type BackupRecord,
  type S3Destination,
} from "@/lib/api"
import { cn } from "@/lib/utils"

function formatBytes(bytes: number): string {
  if (bytes <= 0) return "0 B"
  const k = 1024
  const sizes = ["B", "KB", "MB", "GB", "TB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`
}

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr)
    return d.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    })
  } catch {
    return dateStr
  }
}

export default function SettingsBackupsPage() {
  const [config, setConfig] = React.useState<BackupConfig | null>(null)
  const [records, setRecords] = React.useState<BackupRecord[]>([])
  const [destinations, setDestinations] = React.useState<S3Destination[]>([])
  const [isLoading, setIsLoading] = React.useState(true)

  // Backup Configuration State
  const [enabled, setEnabled] = React.useState(false)
  const [selectedDestinationId, setSelectedDestinationId] = React.useState("")
  const [cronExpression, setCronExpression] = React.useState("0 2 * * *")
  const [retentionCount, setRetentionCount] = React.useState(30)

  // Status & Feedback
  const [isSaving, setIsSaving] = React.useState(false)
  const [isBackingUp, setIsBackingUp] = React.useState(false)
  const [saveFeedback, setSaveFeedback] = React.useState<{
    type: "success" | "error"
    message: string
  } | null>(null)

  // Delete Dialog State
  const [deletingId, setDeletingId] = React.useState<string | null>(null)
  const [isDeleting, setIsDeleting] = React.useState(false)

  React.useEffect(() => {
    let active = true

    Promise.all([
      api.backups.getConfig(),
      api.backups.listControlPlaneBackups(),
      api.storage.listS3Destinations(),
    ])
      .then(([cfg, recs, dests]) => {
        if (!active) return
        setConfig(cfg)
        setRecords(recs)
        setDestinations(dests)
        setEnabled(cfg.enabled)

        // Select matched destination by ID, or default destination, or first available
        const matched =
          (cfg.s3_destination_id
            ? dests.find((d) => d.id === cfg.s3_destination_id)
            : null) ||
          dests.find((d) => d.is_default) ||
          dests[0]
        setSelectedDestinationId(matched?.id || "")

        setCronExpression(cfg.cron_expression || "0 2 * * *")
        setRetentionCount(cfg.retention_count || 30)
        setIsLoading(false)
      })
      .catch(() => {
        if (active) {
          setIsLoading(false)
        }
      })

    return () => {
      active = false
    }
  }, [])

  const selectedDest = React.useMemo(() => {
    return (
      destinations.find((d) => d.id === selectedDestinationId) ||
      destinations.find((d) => d.is_default) ||
      destinations[0] ||
      null
    )
  }, [destinations, selectedDestinationId])

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)
    setSaveFeedback(null)

    try {
      const updated = await api.backups.updateConfig({
        enabled,
        s3_destination_id: selectedDestinationId || undefined,
        endpoint_url: selectedDest?.endpoint,
        bucket: selectedDest?.bucket_name,
        region: selectedDest?.region,
        access_key: selectedDest?.access_key_id,
        cron_expression: cronExpression.trim(),
        retention_count: retentionCount,
      })
      setConfig(updated)
      setSaveFeedback({
        type: "success",
        message: "Automated backup configuration saved successfully.",
      })
      toast.success("Automated backup configuration saved successfully.")
    } catch (err) {
      const msg =
        err instanceof ApiError ? err.message : "Failed to save configuration."
      setSaveFeedback({
        type: "error",
        message: msg,
      })
      toast.error(msg)
    } finally {
      setIsSaving(false)
    }
  }

  const handleTriggerBackup = async () => {
    setIsBackingUp(true)
    setSaveFeedback(null)

    try {
      const record = await api.backups.triggerControlPlaneBackup()
      setRecords((prev) => [record, ...prev])
      setSaveFeedback({
        type: "success",
        message: `Control plane backup snapshot ${record.file_name} completed cleanly.`,
      })
      // Refresh list to pick up any retention pruned records
      const fresh = await api.backups.listControlPlaneBackups()
      setRecords(fresh)
    } catch (err) {
      setSaveFeedback({
        type: "error",
        message:
          err instanceof ApiError
            ? err.message
            : "Failed to trigger control plane backup.",
      })
    } finally {
      setIsBackingUp(false)
    }
  }

  const handleDownload = async (id: string) => {
    try {
      const res = await api.backups.downloadControlPlaneBackup(id)
      if (res.download_url) {
        window.open(res.download_url, "_blank")
      }
    } catch (err) {
      alert(
        err instanceof ApiError
          ? err.message
          : "Failed to generate download URL."
      )
    }
  }

  const confirmDelete = async () => {
    if (!deletingId) return
    setIsDeleting(true)

    try {
      await api.backups.deleteControlPlaneBackup(deletingId)
      setRecords((prev) => prev.filter((r) => r.id !== deletingId))
      setDeletingId(null)
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Failed to delete backup.")
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className="flex w-full flex-col gap-6 md:gap-8">
      <SettingsHeader
        title="Database Backups"
        description="Automated control plane snapshots, S3 retention schedules, and disaster recovery."
        action={
          <Button
            onClick={handleTriggerBackup}
            disabled={
              isBackingUp || destinations.length === 0 || !selectedDestinationId
            }
            className="shrink-0 gap-2 text-sm font-medium"
          >
            {isBackingUp ? (
              <CircleNotchIcon className="size-4 animate-spin" />
            ) : (
              <CloudArrowUpIcon className="size-4" />
            )}
            <span>Backup Now</span>
          </Button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Card 1: Automated Control Plane Backups */}
        <div className="flex flex-col justify-between rounded-lg border border-border bg-card p-6">
          <form onSubmit={handleSaveConfig} className="flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-md border border-border bg-muted text-foreground">
                <CloudArrowUpIcon className="size-5" />
              </div>
              <div>
                <h2 className="font-heading text-base font-semibold text-foreground">
                  Automated Control Plane Backups
                </h2>
                <p className="text-xs text-muted-foreground">
                  Scheduled snapshots of the Tako SQLite database uploaded to S3
                  storage.
                </p>
              </div>
            </div>

            {saveFeedback && (
              <div
                role="alert"
                className={cn(
                  "flex items-center gap-2 rounded-md border px-3 py-2 text-xs",
                  saveFeedback.type === "success"
                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                    : "border-destructive/30 bg-destructive/10 text-destructive"
                )}
              >
                {saveFeedback.type === "success" ? (
                  <CheckIcon className="size-4 shrink-0" />
                ) : (
                  <WarningIcon className="size-4 shrink-0" />
                )}
                <span>{saveFeedback.message}</span>
              </div>
            )}

            <div className="flex items-center gap-2">
              <input
                id="enable-backups"
                type="checkbox"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
                className="size-4 rounded border-border text-foreground accent-zinc-900 focus:ring-ring"
              />
              <label
                htmlFor="enable-backups"
                className="cursor-pointer text-xs font-medium text-foreground"
              >
                Enable scheduled automated backups
              </label>
            </div>

            {/* S3 Storage Destination Selector */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="s3-destination-select"
                  className="text-xs font-medium text-foreground"
                >
                  Storage Destination *
                </label>
                <Link
                  href="/settings/storage"
                  className="flex items-center gap-1 text-2xs text-muted-foreground underline hover:text-foreground"
                >
                  <span>Manage in Storage</span>
                  <ArrowUpRightIcon className="size-3" />
                </Link>
              </div>

              {destinations.length === 0 ? (
                <div
                  role="alert"
                  className="flex flex-col gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-400"
                >
                  <div className="flex items-center gap-2 font-medium">
                    <WarningIcon className="size-4 shrink-0" />
                    <span>No storage destinations configured</span>
                  </div>
                  <p className="text-2xs text-amber-600/90 dark:text-amber-400/90">
                    Add an S3 destination (AWS S3, Cloudflare R2, MinIO, Wasabi,
                    or Backblaze B2) in Storage settings to enable control plane
                    snapshots.
                  </p>
                  <div>
                    <Link
                      href="/settings/storage"
                      className="inline-flex items-center gap-1 rounded border border-border bg-card px-2.5 py-1 text-2xs font-medium text-foreground hover:bg-muted"
                    >
                      <HardDrivesIcon className="size-3" />
                      <span>Configure Storage Destination</span>
                    </Link>
                  </div>
                </div>
              ) : (
                <>
                  <select
                    id="s3-destination-select"
                    value={selectedDestinationId}
                    onChange={(e) => setSelectedDestinationId(e.target.value)}
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-xs text-foreground shadow-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {destinations.map((dest) => (
                      <option key={dest.id} value={dest.id}>
                        {dest.name} {dest.is_default ? "(Default)" : ""} -{" "}
                        {dest.bucket_name} ({dest.endpoint})
                      </option>
                    ))}
                  </select>
                  {selectedDest && (
                    <div className="flex items-center gap-2 rounded border border-border bg-muted/50 px-2.5 py-1.5 text-2xs text-muted-foreground">
                      <span className="font-mono text-foreground">
                        {selectedDest.bucket_name}
                      </span>
                      <span>&bull;</span>
                      <span className="truncate font-mono">
                        {selectedDest.endpoint}
                      </span>
                      {selectedDest.is_default && (
                        <span className="ml-auto rounded border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 text-3xs font-medium text-emerald-600 dark:text-emerald-400">
                          Default
                        </span>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="cron-schedule"
                  className="text-xs font-medium text-foreground"
                >
                  Cron Schedule
                </label>
                <Input
                  id="cron-schedule"
                  type="text"
                  placeholder="0 2 * * *"
                  value={cronExpression}
                  onChange={(e) => setCronExpression(e.target.value)}
                  className="h-9 font-mono text-xs"
                />
                <p className="text-2xs text-muted-foreground">
                  Default 0 2 * * * (daily at 02:00 UTC)
                </p>
              </div>

              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="retention-count"
                  className="text-xs font-medium text-foreground"
                >
                  Retention Limit (Backups to Keep)
                </label>
                <Input
                  id="retention-count"
                  type="number"
                  min={1}
                  max={365}
                  value={retentionCount}
                  onChange={(e) =>
                    setRetentionCount(Number(e.target.value) || 1)
                  }
                  className="h-9 text-xs"
                />
                <p className="text-2xs text-muted-foreground">
                  Older snapshots are auto-deleted from S3.
                </p>
              </div>
            </div>

            <div className="mt-2 flex items-center justify-between border-t border-border pt-4">
              <div className="text-2xs text-muted-foreground">
                Credentials are encrypted and tested in Storage settings.
              </div>

              <Button
                type="submit"
                size="default"
                disabled={isSaving || destinations.length === 0}
                className="gap-1.5 text-xs"
              >
                {isSaving ? (
                  <CircleNotchIcon className="size-3.5 animate-spin" />
                ) : (
                  <CheckIcon className="size-3.5" />
                )}
                <span>Save Backup Settings</span>
              </Button>
            </div>
          </form>
        </div>

        {/* Card 2: Control Plane SQLite Database Backups */}
        <div className="flex flex-col justify-between rounded-lg border border-border bg-card p-6">
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-md border border-border bg-muted text-foreground">
                  <DatabaseIcon className="size-5" />
                </div>
                <div>
                  <h2 className="font-heading text-base font-semibold text-foreground">
                    Control Plane Database (SQLite)
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    Online zero-lock snapshot of Tako SQLite control plane
                    database.
                  </p>
                </div>
              </div>

              <Button
                size="sm"
                onClick={handleTriggerBackup}
                disabled={
                  isBackingUp ||
                  destinations.length === 0 ||
                  !selectedDestinationId
                }
                className="shrink-0 gap-1.5 text-xs"
              >
                {isBackingUp ? (
                  <CircleNotchIcon className="size-3.5 animate-spin" />
                ) : (
                  <CloudArrowUpIcon className="size-3.5" />
                )}
                <span>Backup Now</span>
              </Button>
            </div>

            {selectedDest && (
              <div className="flex items-center justify-between rounded-md border border-border bg-muted/30 px-3 py-2 text-2xs text-muted-foreground">
                <div className="flex items-center gap-1.5 truncate">
                  <HardDrivesIcon className="size-3.5 shrink-0 text-foreground" />
                  <span>Target:</span>
                  <span className="font-medium text-foreground">
                    {selectedDest.name}
                  </span>
                  <span className="truncate font-mono text-muted-foreground">
                    ({selectedDest.bucket_name})
                  </span>
                </div>
                {selectedDest.is_default && (
                  <span className="shrink-0 rounded border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 text-3xs font-medium text-emerald-600 dark:text-emerald-400">
                    Default
                  </span>
                )}
              </div>
            )}

            <div className="rounded-md border border-border bg-muted/20 p-3 text-xs text-muted-foreground">
              Uses SQLite online backup API (
              <code className="font-mono text-foreground">VACUUM INTO</code>) to
              snapshot{" "}
              <code className="font-mono text-foreground">tako.db</code> without
              locking active queries or transactions, compressed with gzip and
              pushed directly to S3.
            </div>

            {/* Backups List Table */}
            <div className="mt-2 flex flex-col gap-2">
              <h3 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                Past Control Plane Backups ({records.length})
              </h3>

              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <CircleNotchIcon className="size-6 animate-spin text-muted-foreground" />
                </div>
              ) : records.length === 0 ? (
                <div className="rounded-md border border-dashed border-border py-8 text-center text-xs text-muted-foreground">
                  No control plane backups recorded yet. Click &ldquo;Backup
                  Now&rdquo; to trigger the first snapshot.
                </div>
              ) : (
                <div className="overflow-x-auto rounded-md border border-border">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-border bg-muted/40 font-medium text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2">File</th>
                        <th className="px-3 py-2">Size</th>
                        <th className="px-3 py-2">Status</th>
                        <th className="px-3 py-2">Timestamp</th>
                        <th className="px-3 py-2 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {records.map((rec) => (
                        <tr key={rec.id} className="hover:bg-muted/20">
                          <td className="px-3 py-2 font-mono text-2xs text-foreground">
                            {rec.file_name}
                          </td>
                          <td className="px-3 py-2 font-mono text-2xs text-muted-foreground">
                            {formatBytes(rec.file_size_bytes)}
                          </td>
                          <td className="px-3 py-2">
                            <span
                              className={cn(
                                "inline-flex items-center rounded border px-1.5 py-0.5 text-3xs font-medium",
                                rec.status === "completed"
                                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                  : rec.status === "running"
                                    ? "border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-400"
                                    : "border-destructive/30 bg-destructive/10 text-destructive"
                              )}
                            >
                              {rec.status}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-2xs text-muted-foreground">
                            {formatDate(rec.created_at)}
                          </td>
                          <td className="px-3 py-2 text-right">
                            <div className="inline-flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDownload(rec.id)}
                                title="Download backup archive"
                                className="size-7 p-0"
                              >
                                <DownloadSimpleIcon className="size-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setDeletingId(rec.id)}
                                title="Delete backup"
                                className="size-7 p-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
                              >
                                <TrashIcon className="size-3.5" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={Boolean(deletingId)}
        onOpenChange={(open) => !open && setDeletingId(null)}
      >
        <DialogContent size="md">
          <DialogHeader>
            <DialogTitle>Delete Backup Archive?</DialogTitle>
            <DialogDescription>
              Are you sure you want to permanently delete this backup snapshot?
              This will remove the object from your S3 bucket and cannot be
              undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4 gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDeletingId(null)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={confirmDelete}
              disabled={isDeleting}
              className="gap-1.5"
            >
              {isDeleting && (
                <CircleNotchIcon className="size-3.5 animate-spin" />
              )}
              <span>Delete Permanently</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
