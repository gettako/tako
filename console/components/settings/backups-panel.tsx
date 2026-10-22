"use client"

import * as React from "react"
import {
  AlertTriangle,
  Archive,
  Check,
  CheckCircle2,
  Copy,
  FileArchive,
  Loader2,
  RotateCcw,
  RotateCw,
  Save,
} from "lucide-react"
import { z } from "zod"

import { SettingsSectionHeader } from "@/components/settings/settings-section-header"
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
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  SearchableSelect,
  SelectOption,
} from "@/components/ui/searchable-select"
import { usePlatformData } from "@/context/platform-data-context"
import { useZodForm } from "@/hooks/use-zod-form"
import { copyToClipboard } from "@/lib/clipboard"
import { isValidTime } from "@/lib/validation"
import { ClusterSnapshot, S3BucketConfig } from "@/types/platform"

const backupScheduleSchema = z
  .object({
    enabled: z.boolean(),
    frequency: z.enum(["hourly", "daily", "weekly"]),
    timeUtc: z.string().trim(),
    retentionDays: z.string().trim(),
    bucketId: z.string().trim(),
  })
  .superRefine((values, context) => {
    if (!values.enabled) return

    if (values.frequency !== "hourly" && !isValidTime(values.timeUtc)) {
      context.addIssue({
        code: "custom",
        path: ["timeUtc"],
        message: "Use a valid 24-hour time in HH:MM format.",
      })
    }

    if (!/^\d+$/.test(values.retentionDays)) {
      context.addIssue({
        code: "custom",
        path: ["retentionDays"],
        message: "Retention must be a number.",
      })
    } else {
      const retention = Number(values.retentionDays)
      if (retention < 1 || retention > 3650) {
        context.addIssue({
          code: "custom",
          path: ["retentionDays"],
          message: "Retention must be between 1 and 3650 days.",
        })
      }
    }

    if (!values.bucketId) {
      context.addIssue({
        code: "custom",
        path: ["bucketId"],
        message: "Select a destination storage bucket.",
      })
    }
  })

const EMPTY_BUCKETS: S3BucketConfig[] = []

const FREQUENCY_OPTIONS: SelectOption[] = [
  {
    value: "hourly",
    label: "Hourly Rolling",
    description: "Automatic snapshot taken every 60 minutes",
  },
  {
    value: "daily",
    label: "Daily at Scheduled Time",
    description: "Standard daily cluster backup at scheduled UTC time",
  },
  {
    value: "weekly",
    label: "Weekly (Sundays)",
    description: "Full Raft consensus & service state snapshot weekly",
  },
]

export function BackupsPanel() {
  const {
    settings,
    snapshots,
    createSnapshot,
    restoreSnapshot,
    updateBackupSchedule,
  } = usePlatformData()

  const s3Buckets = settings.s3Buckets ?? EMPTY_BUCKETS
  const currentSchedule = settings.backupSchedule || {
    enabled: true,
    frequency: "daily",
    timeUtc: "03:00",
    retentionDays: 14,
    destinationBucketId: s3Buckets[0]?.id || "bkt-r2-artifacts",
  }

  const bucketOptions: SelectOption[] = React.useMemo(() => {
    return s3Buckets.map((b) => ({
      value: b.id,
      label: `${b.name} (${b.bucket})`,
      description: `Region: ${b.region} • Endpoint: ${b.endpoint}`,
      badge: b.isDefault ? "DEFAULT" : undefined,
    }))
  }, [s3Buckets])

  // Schedule Form State
  const [enabled, setEnabled] = React.useState(currentSchedule.enabled)
  const [frequency, setFrequency] = React.useState<
    "hourly" | "daily" | "weekly"
  >(currentSchedule.frequency)
  const [timeUtc, setTimeUtc] = React.useState(currentSchedule.timeUtc)
  const [retentionDays, setRetentionDays] = React.useState(
    String(currentSchedule.retentionDays)
  )
  const [bucketId, setBucketId] = React.useState(
    currentSchedule.destinationBucketId
  )
  const { errors, validate, clearError } = useZodForm(backupScheduleSchema)
  const [scheduleSaved, setScheduleSaved] = React.useState(false)

  // Manual Backup State
  const [isCreatingSnapshot, setIsCreatingSnapshot] = React.useState(false)
  const [snapshotSuccess, setSnapshotSuccess] = React.useState(false)

  // Restore Modal State
  const [restoreModalOpen, setRestoreModalOpen] = React.useState(false)
  const [selectedSnapshot, setSelectedSnapshot] =
    React.useState<ClusterSnapshot | null>(null)
  const [confirmText, setConfirmText] = React.useState("")
  const [isRestoring, setIsRestoring] = React.useState(false)
  const [copiedChecksum, setCopiedChecksum] = React.useState<string | null>(
    null
  )

  const handleSaveSchedule = (e: React.FormEvent) => {
    e.preventDefault()
    const valid = validate({
      enabled,
      frequency,
      timeUtc,
      retentionDays,
      bucketId,
    })
    if (!valid) return

    updateBackupSchedule({
      enabled,
      frequency,
      timeUtc,
      retentionDays: Number(retentionDays),
      destinationBucketId: bucketId,
    })
    setScheduleSaved(true)
    setTimeout(() => setScheduleSaved(false), 2000)
  }

  const handleTriggerManualBackup = async () => {
    setIsCreatingSnapshot(true)
    try {
      await createSnapshot()
      setSnapshotSuccess(true)
      setTimeout(() => setSnapshotSuccess(false), 2500)
    } finally {
      setIsCreatingSnapshot(false)
    }
  }

  const handleOpenRestore = (snap: ClusterSnapshot) => {
    setSelectedSnapshot(snap)
    setConfirmText("")
    setRestoreModalOpen(true)
  }

  const handleConfirmRestore = async () => {
    if (!selectedSnapshot) return
    setIsRestoring(true)
    try {
      await restoreSnapshot(selectedSnapshot.id)
      setRestoreModalOpen(false)
    } finally {
      setIsRestoring(false)
    }
  }

  const handleCopyChecksum = async (id: string, checksum: string) => {
    if (await copyToClipboard(checksum)) {
      setCopiedChecksum(id)
      setTimeout(() => setCopiedChecksum(null), 2000)
    }
  }

  return (
    <div className="space-y-6">
      {/* 1. Automated Schedule Configuration */}
      <div className="space-y-5 rounded-lg border border-border bg-card p-5 shadow-xs sm:p-6">
        <SettingsSectionHeader
          icon={Archive}
          title="Cluster State Backups & Snapshots"
          description="Automated encrypted snapshots covering registered edge nodes, project manifests, and telemetry records."
          action={
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleTriggerManualBackup}
              disabled={isCreatingSnapshot}
              className="gap-1.5 text-xs"
            >
              {isCreatingSnapshot ? (
                <>
                  <Loader2 className="size-3 animate-spin" />
                  <span>Snapshotting...</span>
                </>
              ) : snapshotSuccess ? (
                <>
                  <Check className="size-3 text-emerald-500" />
                  <span>Snapshot Created!</span>
                </>
              ) : (
                <>
                  <RotateCw className="size-3" />
                  <span>Create Snapshot Now</span>
                </>
              )}
            </Button>
          }
        />

        <form onSubmit={handleSaveSchedule} noValidate className="space-y-4">
          <FieldGroup className="gap-4">
            {/* Enable Automated Backups Toggle */}
            <div className="flex items-center justify-between rounded-md border border-border bg-muted/20 p-3">
              <div>
                <span className="text-xs font-semibold text-foreground">
                  Automated Cluster State Snapshots
                </span>
                <p className="text-[11px] text-muted-foreground">
                  Automatically bundle control plane metadata and push encrypted
                  archives to S3.
                </p>
              </div>
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
                className="size-4 cursor-pointer rounded accent-primary"
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Field data-invalid={Boolean(errors.frequency)}>
                <FieldLabel className="text-xs">Snapshot Frequency</FieldLabel>
                <SearchableSelect
                  value={frequency}
                  onChange={(val) => {
                    setFrequency(val as "hourly" | "daily" | "weekly")
                    clearError("frequency")
                  }}
                  options={FREQUENCY_OPTIONS}
                  disabled={!enabled}
                  placeholder="Select frequency..."
                  searchPlaceholder="Search frequency..."
                />
                <FieldError id="backup-frequency-error" className="text-[11px]">
                  {errors.frequency}
                </FieldError>
              </Field>

              <Field data-invalid={Boolean(errors.timeUtc)}>
                <FieldLabel className="text-xs">
                  Scheduled Time (UTC)
                </FieldLabel>
                <Input
                  value={timeUtc}
                  onChange={(e) => {
                    setTimeUtc(e.target.value)
                    clearError("timeUtc")
                  }}
                  disabled={!enabled || frequency === "hourly"}
                  placeholder="03:00"
                  aria-invalid={Boolean(errors.timeUtc)}
                  aria-describedby={
                    errors.timeUtc ? "backup-time-error" : undefined
                  }
                  className="font-mono text-xs disabled:opacity-50"
                />
                <FieldError id="backup-time-error" className="text-[11px]">
                  {errors.timeUtc}
                </FieldError>
              </Field>

              <Field data-invalid={Boolean(errors.retentionDays)}>
                <FieldLabel className="text-xs">
                  Retention Count (Days)
                </FieldLabel>
                <Input
                  type="number"
                  value={retentionDays}
                  onChange={(e) => {
                    setRetentionDays(e.target.value)
                    clearError("retentionDays")
                  }}
                  disabled={!enabled}
                  aria-invalid={Boolean(errors.retentionDays)}
                  aria-describedby={
                    errors.retentionDays ? "backup-retention-error" : undefined
                  }
                  className="font-mono text-xs disabled:opacity-50"
                />
                <FieldError id="backup-retention-error" className="text-[11px]">
                  {errors.retentionDays}
                </FieldError>
              </Field>
            </div>

            {/* Destination Bucket Selector */}
            <Field data-invalid={Boolean(errors.bucketId)}>
              <FieldLabel className="text-xs">
                Destination Storage Bucket
              </FieldLabel>
              <SearchableSelect
                value={bucketId}
                onChange={(val) => {
                  setBucketId(val)
                  clearError("bucketId")
                }}
                options={bucketOptions}
                disabled={!enabled || s3Buckets.length === 0}
                placeholder={
                  s3Buckets.length === 0
                    ? "No S3 buckets configured"
                    : "Select destination S3 bucket..."
                }
                searchPlaceholder="Search storage bucket..."
              />
              <FieldError id="backup-bucket-error" className="text-[11px]">
                {errors.bucketId}
              </FieldError>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Snapshots are encrypted using AES-256 GCM before streaming to
                remote S3 storage.
              </p>
            </Field>

            <div className="flex justify-end pt-2">
              <Button type="submit" size="sm" className="gap-1.5 text-xs">
                {scheduleSaved ? (
                  <>
                    <Check className="size-3 text-emerald-500" />
                    <span>Schedule Saved</span>
                  </>
                ) : (
                  <>
                    <Save className="size-3" />
                    <span>Save Snapshot Schedule</span>
                  </>
                )}
              </Button>
            </div>
          </FieldGroup>
        </form>
      </div>

      {/* 2. Cluster Snapshots History & State Restore */}
      <div className="space-y-4 rounded-lg border border-border bg-card p-5 shadow-xs sm:p-6">
        <SettingsSectionHeader
          icon={FileArchive}
          title="Cluster Snapshots History"
          description="Available snapshot archives in storage. You can inspect checksums or validate and restore cluster state."
        />

        <div className="overflow-hidden rounded-lg border border-border">
          <div className="overflow-x-auto">
            <table className="w-full text-left font-mono text-xs">
              <thead className="border-b border-border bg-muted/40 text-[11px] text-muted-foreground uppercase">
                <tr>
                  <th className="px-4 py-2.5 font-semibold">
                    Snapshot Archive
                  </th>
                  <th className="px-4 py-2.5 font-semibold">Size</th>
                  <th className="px-4 py-2.5 font-semibold">
                    SHA-256 Checksum
                  </th>
                  <th className="px-4 py-2.5 font-semibold">Created</th>
                  <th className="px-4 py-2.5 font-semibold">Status</th>
                  <th className="px-4 py-2.5 text-right font-semibold">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-xs">
                {snapshots.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-8 text-center font-sans text-xs text-muted-foreground"
                    >
                      No backup snapshots found. Click &ldquo;Create Snapshot
                      Now&rdquo; to generate your first backup.
                    </td>
                  </tr>
                ) : (
                  snapshots.map((snap) => (
                    <tr
                      key={snap.id}
                      className="transition-colors hover:bg-muted/20"
                    >
                      <td className="px-4 py-3 font-semibold text-foreground">
                        <div className="flex items-center gap-2">
                          <Archive className="size-3.5 shrink-0 text-primary" />
                          <span className="truncate">{snap.filename}</span>
                        </div>
                      </td>

                      <td className="px-4 py-3 text-muted-foreground">
                        {snap.sizeMb.toFixed(1)} MB
                      </td>

                      <td
                        className="max-w-[140px] px-4 py-3 text-muted-foreground/80"
                        aria-label="SHA-256 Checksum"
                      >
                        <div className="flex items-center gap-1.5">
                          <span className="truncate text-[11px]">
                            {snap.checksum.replace("sha256:", "").slice(0, 16)}
                            ...
                          </span>
                          <button
                            type="button"
                            aria-label={`Copy checksum for ${snap.filename}`}
                            onClick={() =>
                              handleCopyChecksum(snap.id, snap.checksum)
                            }
                            className="text-muted-foreground hover:text-foreground"
                            title="Copy Checksum"
                          >
                            {copiedChecksum === snap.id ? (
                              <Check className="size-3 text-emerald-500" />
                            ) : (
                              <Copy className="size-3" />
                            )}
                          </button>
                        </div>
                      </td>

                      <td className="px-4 py-3 text-[11px] text-muted-foreground">
                        {snap.createdAt}
                      </td>

                      <td className="px-4 py-3">
                        <span className="py-0.2 inline-flex items-center gap-1 rounded border border-emerald-500/20 bg-emerald-500/10 px-1.5 text-[10px] text-emerald-500">
                          <CheckCircle2 className="size-2.5" />
                          <span className="capitalize">{snap.status}</span>
                        </span>
                      </td>

                      <td className="px-4 py-3 text-right">
                        <Button
                          type="button"
                          variant="outline"
                          size="xs"
                          onClick={() => handleOpenRestore(snap)}
                          className="gap-1 border-amber-500/30 text-[11px] text-amber-500 hover:bg-amber-500/10"
                        >
                          <RotateCcw className="size-3" />
                          <span>Restore</span>
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Restore Snapshot Confirmation Modal */}
      <Dialog open={restoreModalOpen} onOpenChange={setRestoreModalOpen}>
        <DialogContent className="border-amber-500/40 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-500">
              <AlertTriangle className="size-4 shrink-0" />
              <span>Confirm Cluster Snapshot Restore</span>
            </DialogTitle>
            <DialogDescription className="space-y-2 pt-1 text-xs leading-relaxed">
              <p>You are about to restore cluster state from archive:</p>
              <div className="truncate rounded-md border border-border bg-muted/40 p-2.5 font-mono text-xs text-foreground select-all">
                {selectedSnapshot?.filename}
              </div>
              <p className="text-[11px] font-medium text-destructive">
                Warning: Restoring will overwrite control plane database
                metadata and re-synchronize active services to this snapshot
                state.
              </p>
              <div className="pt-2">
                <label
                  htmlFor="restore-confirm-input"
                  className="block text-[11px] text-muted-foreground"
                >
                  Type{" "}
                  <strong className="font-mono text-foreground">RESTORE</strong>{" "}
                  to confirm:
                </label>
                <input
                  id="restore-confirm-input"
                  type="text"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder="RESTORE"
                  className="mt-1 h-8 w-full rounded border border-border bg-card px-2.5 font-mono text-xs text-foreground outline-none focus:border-amber-500"
                />
              </div>
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="gap-2 pt-2 sm:gap-2.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setRestoreModalOpen(false)}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={confirmText !== "RESTORE" || isRestoring}
              onClick={handleConfirmRestore}
              className="gap-1.5 bg-amber-600 text-xs text-white hover:bg-amber-700"
            >
              {isRestoring ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  <span>Restoring State...</span>
                </>
              ) : (
                <>
                  <RotateCcw className="size-3.5" />
                  <span>Confirm Restore</span>
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
