"use client"

import * as React from "react"
import {
  CloudArrowUp,
  CircleNotch,
  Check,
  Warning,
  Database,
  DownloadSimple,
  ArrowCounterClockwise,
  Trash,
  HardDrives,
  Clock,
} from "@phosphor-icons/react"
import { Button } from "@/components/ui/button"
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
  type BackupRecord,
  type S3Destination,
  type ServiceBackupSchedule,
} from "@/lib/api"
import { useService } from "@/components/services/service-context"
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

export default function ServiceBackupsPage() {
  const { service, serviceId } = useService()
  const [records, setRecords] = React.useState<BackupRecord[]>([])
  const [destinations, setDestinations] = React.useState<S3Destination[]>([])
  const [schedule, setSchedule] = React.useState<ServiceBackupSchedule | null>(
    null
  )

  const [isLoading, setIsLoading] = React.useState(true)
  const [isBackingUp, setIsBackingUp] = React.useState(false)

  // Backup Now Modal State
  const [backupModalOpen, setBackupModalOpen] = React.useState(false)
  const [selectedBackupType, setSelectedBackupType] = React.useState<
    "database" | "volume"
  >("database")
  const [backupTargetDestinationId, setBackupTargetDestinationId] =
    React.useState<string>("")

  // Schedule Backup Modal State
  const [isScheduleDialogOpen, setIsScheduleDialogOpen] = React.useState(false)
  const [isSavingSchedule, setIsSavingSchedule] = React.useState(false)
  const [schedEnabled, setSchedEnabled] = React.useState(false)
  const [schedDestinationId, setSchedDestinationId] = React.useState<string>("")
  const [schedCron, setSchedCron] = React.useState("0 2 * * *")
  const [schedRetention, setSchedRetention] = React.useState(7)

  // Dialog States for Restore & Delete
  const [restoringBackup, setRestoringBackup] =
    React.useState<BackupRecord | null>(null)
  const [isRestoring, setIsRestoring] = React.useState(false)
  const [deletingId, setDeletingId] = React.useState<string | null>(null)
  const [isDeleting, setIsDeleting] = React.useState(false)

  // Banner Feedback
  const [feedback, setFeedback] = React.useState<{
    type: "success" | "error"
    message: string
  } | null>(null)

  const loadBackups = React.useCallback(async () => {
    if (!serviceId) return
    try {
      const data = await api.backups.listServiceBackups(serviceId)
      setRecords(data)
    } catch {
      // Ignore load error
    }
  }, [serviceId])

  const loadSchedule = React.useCallback(async () => {
    if (!serviceId) return
    try {
      const sched = await api.backups.getServiceBackupSchedule(serviceId)
      setSchedule(sched)
      setSchedEnabled(sched.enabled)
      setSchedDestinationId(sched.s3_destination_id || "")
      setSchedCron(sched.cron_expression)
      setSchedRetention(sched.retention_count)
    } catch {
      // Ignore schedule load error
    }
  }, [serviceId])

  React.useEffect(() => {
    let active = true
    if (!serviceId) return

    Promise.all([
      api.backups.listServiceBackups(serviceId),
      api.storage.listS3Destinations().catch(() => [] as S3Destination[]),
      api.backups.getServiceBackupSchedule(serviceId).catch(() => null),
    ])
      .then(([backupList, destList, schedData]) => {
        if (!active) return
        setRecords(backupList)
        setDestinations(destList)
        if (schedData) {
          setSchedule(schedData)
          setSchedEnabled(schedData.enabled)
          setSchedDestinationId(schedData.s3_destination_id || "")
          setSchedCron(schedData.cron_expression)
          setSchedRetention(schedData.retention_count)
        }
        setIsLoading(false)
      })
      .catch(() => {
        if (active) setIsLoading(false)
      })

    return () => {
      active = false
    }
  }, [serviceId])

  const openBackupModal = (bType: "database" | "volume") => {
    setSelectedBackupType(bType)
    const defaultDest =
      destinations.find((d) => d.id === schedule?.s3_destination_id) ||
      destinations.find((d) => d.is_default) ||
      destinations[0]
    setBackupTargetDestinationId(
      schedule?.s3_destination_id || defaultDest?.id || ""
    )
    setBackupModalOpen(true)
  }

  const handleStartBackupFromModal = async () => {
    setIsBackingUp(true)
    setFeedback(null)

    try {
      const rec = await api.backups.triggerServiceBackup(serviceId, {
        backup_type: selectedBackupType,
        s3_destination_id: backupTargetDestinationId || undefined,
      })
      setRecords((prev) => [rec, ...prev])
      setBackupModalOpen(false)
      setFeedback({
        type: "success",
        message: `Backup dump initiated for ${service?.name || "service"}. Streaming to S3...`,
      })
      setTimeout(() => loadBackups(), 2000)
    } catch (err) {
      setFeedback({
        type: "error",
        message:
          err instanceof ApiError ? err.message : "Failed to trigger backup.",
      })
    } finally {
      setIsBackingUp(false)
    }
  }

  const handleSaveSchedule = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSavingSchedule(true)

    try {
      const updated = await api.backups.updateServiceBackupSchedule(serviceId, {
        enabled: schedEnabled,
        s3_destination_id: schedDestinationId ? schedDestinationId : null,
        cron_expression: schedCron.trim(),
        retention_count: schedRetention,
      })
      setSchedule(updated)
      setIsScheduleDialogOpen(false)
      setFeedback({
        type: "success",
        message: "Automated backup schedule updated successfully.",
      })
    } catch (err) {
      alert(
        err instanceof ApiError
          ? err.message
          : "Failed to update backup schedule."
      )
    } finally {
      setIsSavingSchedule(false)
    }
  }

  const handleDownload = async (backupId: string) => {
    try {
      const res = await api.backups.downloadServiceBackup(serviceId, backupId)
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

  const confirmRestore = async () => {
    if (!restoringBackup) return
    setIsRestoring(true)

    try {
      const res = await api.backups.restoreServiceBackup(
        serviceId,
        restoringBackup.id
      )
      setFeedback({
        type: "success",
        message: res.message || "Database backup restored successfully.",
      })
      setRestoringBackup(null)
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Failed to restore backup.")
    } finally {
      setIsRestoring(false)
    }
  }

  const confirmDelete = async () => {
    if (!deletingId) return
    setIsDeleting(true)

    try {
      await api.backups.deleteServiceBackup(serviceId, deletingId)
      setRecords((prev) => prev.filter((r) => r.id !== deletingId))
      setDeletingId(null)
      setFeedback({
        type: "success",
        message: "Backup deleted successfully.",
      })
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Failed to delete backup.")
    } finally {
      setIsDeleting(false)
    }
  }

  const isDatabase = service?.service_type === "database"
  const dbEngine = service?.database_engine || "database"
  const volumeName = service?.volume_name

  return (
    <div className="flex w-full flex-col gap-6 md:gap-8">
      {/* Top Banner / Actions */}
      <div className="flex flex-col justify-between gap-4 rounded-lg border border-border bg-card p-6 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-md border border-border bg-muted text-foreground">
            {isDatabase ? (
              <Database className="size-5" />
            ) : (
              <HardDrives className="size-5" />
            )}
          </div>
          <div>
            <h2 className="font-heading text-base font-semibold text-foreground">
              {isDatabase
                ? `${dbEngine.toUpperCase()} Automated & On-Demand Backups`
                : "Volume Backups"}
            </h2>
            <p className="text-xs text-muted-foreground">
              {isDatabase
                ? `Native dump engine (${dbEngine === "postgres" ? "pg_dump -Fc" : dbEngine === "mysql" ? "mysqldump" : "redis-cli --rdb"}) streamed to target S3 storage.`
                : `Persistent volume snapshot (${volumeName || "/data"}) tar-gzipped and streamed to target S3 storage.`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isDatabase && (
            <Button
              size="sm"
              onClick={() => openBackupModal("database")}
              disabled={isBackingUp}
              className="h-10 gap-1.5 text-xs"
            >
              <CloudArrowUp className="size-4" />
              <span>Backup Database Now</span>
            </Button>
          )}

          {volumeName && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => openBackupModal("volume")}
              disabled={isBackingUp}
              className="h-10 gap-1.5 text-xs"
            >
              <HardDrives className="size-4" />
              <span>Snapshot Volume</span>
            </Button>
          )}
        </div>
      </div>

      {feedback && (
        <div
          role="alert"
          className={cn(
            "flex items-center gap-2 rounded-md border px-4 py-3 text-xs",
            feedback.type === "success"
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
              : "border-destructive/30 bg-destructive/10 text-destructive"
          )}
        >
          {feedback.type === "success" ? (
            <Check className="size-4 shrink-0" />
          ) : (
            <Warning className="size-4 shrink-0" />
          )}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Automated Backup Schedule Card */}
      <div className="flex flex-col justify-between gap-4 rounded-lg border border-border bg-card p-6 sm:flex-row sm:items-center">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <h3 className="font-heading text-sm font-semibold text-foreground">
              Automated Backup Schedule
            </h3>
            {schedule?.enabled ? (
              <span className="inline-flex items-center gap-1 rounded border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-3xs font-medium text-emerald-600 dark:text-emerald-400">
                <Check className="size-3" />
                <span>Active</span>
              </span>
            ) : (
              <span className="inline-flex items-center rounded border border-border bg-muted/60 px-2 py-0.5 text-3xs font-medium text-muted-foreground">
                Disabled
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {schedule?.enabled
              ? `Backups execute automatically with cron '${schedule.cron_expression}'. Storing in ${schedule.s3_destination_name || "default S3 destination"}, keeping the last ${schedule.retention_count} snapshots.`
              : "Automated schedule is disabled. Configure recurring backups and automated retention pruning."}
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            if (schedule) {
              setSchedEnabled(schedule.enabled)
              setSchedDestinationId(schedule.s3_destination_id || "")
              setSchedCron(schedule.cron_expression)
              setSchedRetention(schedule.retention_count)
            }
            setIsScheduleDialogOpen(true)
          }}
          className="h-9 shrink-0 gap-1.5 text-xs"
        >
          <Clock className="size-3.5" />
          <span>Configure Schedule</span>
        </Button>
      </div>

      {/* Backups List Table */}
      <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-6">
        <div className="flex items-center justify-between">
          <h3 className="font-heading text-sm font-semibold text-foreground">
            Backup Archives ({records.length})
          </h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={loadBackups}
            className="h-8 text-xs text-muted-foreground hover:text-foreground"
          >
            Refresh
          </Button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <CircleNotch className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : records.length === 0 ? (
          <div className="rounded-md border border-dashed border-border py-12 text-center text-xs text-muted-foreground">
            No backups recorded yet for this service. Click &ldquo;Backup
            Database Now&rdquo; to trigger an immediate dump.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-md border border-border">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-border bg-muted/40 font-medium text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5">File Archive</th>
                  <th className="px-4 py-2.5">Type</th>
                  <th className="px-4 py-2.5">Destination</th>
                  <th className="px-4 py-2.5">Size</th>
                  <th className="px-4 py-2.5">Status</th>
                  <th className="px-4 py-2.5">Created At</th>
                  <th className="px-4 py-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {records.map((rec) => (
                  <tr
                    key={rec.id}
                    className="transition-colors hover:bg-muted/20"
                  >
                    <td className="px-4 py-3 font-mono text-2xs font-medium text-foreground">
                      {rec.file_name}
                    </td>
                    <td className="px-4 py-3 text-2xs text-muted-foreground capitalize">
                      {rec.backup_type}
                    </td>
                    <td className="px-4 py-3 text-2xs text-foreground">
                      <div className="flex items-center gap-1.5 font-medium">
                        <HardDrives className="size-3 shrink-0 text-muted-foreground" />
                        <span>
                          {rec.s3_destination_name || "Default Storage"}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-2xs text-muted-foreground">
                      {formatBytes(rec.file_size_bytes)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          "inline-flex items-center rounded border px-2 py-0.5 text-3xs font-medium tracking-wider uppercase",
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
                    <td className="px-4 py-3 text-2xs text-muted-foreground">
                      {formatDate(rec.created_at)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDownload(rec.id)}
                          title="Download dump from S3"
                          className="h-8 gap-1 px-2.5 text-xs"
                        >
                          <DownloadSimple className="size-3.5" />
                          <span>Download</span>
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setRestoringBackup(rec)}
                          disabled={
                            rec.status !== "completed" ||
                            rec.database_engine === "redis" ||
                            service?.database_engine === "redis"
                          }
                          title={
                            rec.database_engine === "redis" ||
                            service?.database_engine === "redis"
                              ? "Redis restore must be performed manually via RDB file"
                              : "Restore into container"
                          }
                          className="h-8 gap-1 px-2.5 text-xs text-amber-600 hover:bg-amber-500/10 dark:text-amber-400"
                        >
                          <ArrowCounterClockwise className="size-3.5" />
                          <span>Restore</span>
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeletingId(rec.id)}
                          title="Delete backup"
                          className="size-8 p-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
                        >
                          <Trash className="size-3.5" />
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

      {/* Backup Now Modal Dialog */}
      <Dialog open={backupModalOpen} onOpenChange={setBackupModalOpen}>
        <DialogContent size="md">
          <DialogHeader>
            <DialogTitle>Trigger On-Demand Backup</DialogTitle>
            <DialogDescription>
              Initiate an immediate container snapshot and stream the archive
              directly to your selected S3 destination.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4 py-2">
            {/* Backup Type Selector */}
            {isDatabase && volumeName ? (
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="modal-backup-type"
                  className="text-xs font-medium text-foreground"
                >
                  Backup Target
                </label>
                <select
                  id="modal-backup-type"
                  value={selectedBackupType}
                  onChange={(e) =>
                    setSelectedBackupType(
                      e.target.value as "database" | "volume"
                    )
                  }
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs text-foreground outline-none focus:border-ring focus:ring-1 focus:ring-ring"
                >
                  <option value="database">
                    Database Dump ({dbEngine.toUpperCase()})
                  </option>
                  <option value="volume">
                    Volume Snapshot ({volumeName || "/data"})
                  </option>
                </select>
              </div>
            ) : (
              <div className="rounded-md border border-border bg-muted/40 p-3 text-xs">
                <span className="font-medium text-foreground">Type: </span>
                <span className="text-muted-foreground capitalize">
                  {selectedBackupType === "database"
                    ? `${dbEngine.toUpperCase()} database dump`
                    : `Volume snapshot (${volumeName || "/data"})`}
                </span>
              </div>
            )}

            {/* Target S3 Destination */}
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="modal-target-destination"
                className="text-xs font-medium text-foreground"
              >
                Target S3 Destination
              </label>
              {destinations.length === 0 ? (
                <p className="text-2xs text-muted-foreground">
                  No custom S3 destinations configured. Will use default system
                  storage.
                </p>
              ) : (
                <select
                  id="modal-target-destination"
                  value={backupTargetDestinationId}
                  onChange={(e) => setBackupTargetDestinationId(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs text-foreground outline-none focus:border-ring focus:ring-1 focus:ring-ring"
                >
                  {destinations.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} ({d.bucket_name})
                      {d.is_default ? " [Default]" : ""}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>

          <DialogFooter className="mt-4 gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setBackupModalOpen(false)}
              disabled={isBackingUp}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleStartBackupFromModal}
              disabled={isBackingUp}
              className="gap-1.5"
            >
              {isBackingUp ? (
                <CircleNotch className="size-3.5 animate-spin" />
              ) : (
                <CloudArrowUp className="size-3.5" />
              )}
              <span>Start Backup</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Schedule Backup Modal Dialog */}
      <Dialog
        open={isScheduleDialogOpen}
        onOpenChange={setIsScheduleDialogOpen}
      >
        <DialogContent size="md">
          <DialogHeader>
            <DialogTitle>Configure Backup Schedule</DialogTitle>
            <DialogDescription>
              Set up automated recurring database or volume snapshots and
              retention limits.
            </DialogDescription>
          </DialogHeader>

          <form
            onSubmit={handleSaveSchedule}
            className="flex flex-col gap-4 py-2"
          >
            <div className="flex items-center gap-2">
              <input
                id="sched-enable-toggle"
                type="checkbox"
                checked={schedEnabled}
                onChange={(e) => setSchedEnabled(e.target.checked)}
                className="size-4 rounded border-border text-foreground accent-zinc-900 focus:ring-ring"
              />
              <label
                htmlFor="sched-enable-toggle"
                className="cursor-pointer text-xs font-medium text-foreground"
              >
                Enable automated backups for this service
              </label>
            </div>

            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="sched-destination"
                className="text-xs font-medium text-foreground"
              >
                Target S3 Destination
              </label>
              {destinations.length === 0 ? (
                <p className="text-2xs text-muted-foreground">
                  No custom S3 destinations configured. Will use default
                  storage.
                </p>
              ) : (
                <select
                  id="sched-destination"
                  value={schedDestinationId}
                  onChange={(e) => setSchedDestinationId(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs text-foreground outline-none focus:border-ring focus:ring-1 focus:ring-ring"
                >
                  {destinations.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} ({d.bucket_name})
                      {d.is_default ? " [Default]" : ""}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="sched-cron"
                  className="text-xs font-medium text-foreground"
                >
                  Cron Expression
                </label>
                <input
                  id="sched-cron"
                  type="text"
                  value={schedCron}
                  onChange={(e) => setSchedCron(e.target.value)}
                  placeholder="0 2 * * *"
                  required
                  className="w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-xs text-foreground outline-none focus:border-ring focus:ring-1 focus:ring-ring"
                />
                <span className="text-3xs text-muted-foreground">
                  Default: 0 2 * * * (daily at 02:00 UTC)
                </span>
              </div>

              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="sched-retention"
                  className="text-xs font-medium text-foreground"
                >
                  Retention Limit (Snapshots)
                </label>
                <input
                  id="sched-retention"
                  type="number"
                  min={1}
                  max={365}
                  value={schedRetention}
                  onChange={(e) =>
                    setSchedRetention(parseInt(e.target.value, 10) || 7)
                  }
                  required
                  className="w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-xs text-foreground outline-none focus:border-ring focus:ring-1 focus:ring-ring"
                />
                <span className="text-3xs text-muted-foreground">
                  Older archives are pruned from S3
                </span>
              </div>
            </div>

            <DialogFooter className="mt-4 gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsScheduleDialogOpen(false)}
                disabled={isSavingSchedule}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isSavingSchedule}
                className="gap-1.5"
              >
                {isSavingSchedule && (
                  <CircleNotch className="size-3.5 animate-spin" />
                )}
                <span>Save Schedule</span>
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Restore Confirmation Dialog */}
      <Dialog
        open={Boolean(restoringBackup)}
        onOpenChange={(open) => !open && setRestoringBackup(null)}
      >
        <DialogContent size="md">
          <DialogHeader>
            <DialogTitle>Restore Database Backup?</DialogTitle>
            <DialogDescription>
              Are you sure you want to restore{" "}
              <code className="font-mono font-semibold text-foreground">
                {restoringBackup?.file_name}
              </code>
              ? This operation will download the dump from S3 and stream it
              directly into the active database container, replacing the
              existing database state.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4 gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setRestoringBackup(null)}
              disabled={isRestoring}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={confirmRestore}
              disabled={isRestoring}
              className="gap-1.5 bg-amber-600 text-white hover:bg-amber-700"
            >
              {isRestoring && <CircleNotch className="size-3.5 animate-spin" />}
              <span>Confirm & Restore</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
              {isDeleting && <CircleNotch className="size-3.5 animate-spin" />}
              <span>Delete Permanently</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
