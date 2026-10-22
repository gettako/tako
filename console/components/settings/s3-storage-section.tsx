"use client"

import * as React from "react"
import {
  AlertTriangle,
  Archive,
  Check,
  CheckCircle2,
  Copy,
  Database,
  HardDrive,
  Layers,
  Loader2,
  Pencil,
  Plus,
  Radio,
  Server,
  ShieldCheck,
  Trash2,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { EmptyState } from "@/components/ui/empty-state"
import { SettingsSectionHeader } from "@/components/settings/settings-section-header"
import { S3BucketConfig, S3BucketPurpose } from "@/types/platform"
import { copyToClipboard } from "@/lib/clipboard"
import { usePlatformData } from "@/context/platform-data-context"
import { cn } from "@/lib/utils"
import { S3BucketModal } from "./s3-bucket-modal"

interface S3StorageSectionProps {
  buckets: S3BucketConfig[]
  onBucketsChange: (buckets: S3BucketConfig[]) => void
}

const PURPOSE_LABELS: Record<
  S3BucketPurpose,
  { label: string; icon: React.ComponentType<{ className?: string }> }
> = {
  artifacts: { label: "Build Artifacts", icon: Layers },
  telemetry: { label: "Telemetry & Logs", icon: Radio },
  cache: { label: "Layer Cache", icon: Server },
  backups: { label: "Cluster Backups", icon: Archive },
  general: { label: "General Storage", icon: Database },
}

export function S3StorageSection({
  buckets,
  onBucketsChange,
}: S3StorageSectionProps) {
  const { testS3Bucket } = usePlatformData()

  // Modal states
  const [modalOpen, setModalOpen] = React.useState(false)
  const [editingBucket, setEditingBucket] =
    React.useState<S3BucketConfig | null>(null)

  // Delete confirmation state
  const [deleteTarget, setDeleteTarget] = React.useState<S3BucketConfig | null>(
    null
  )

  // Per-bucket testing status: record of bucketId -> "testing" | "success" | "error"
  const [testingStatus, setTestingStatus] = React.useState<
    Record<string, "testing" | "success" | "error">
  >({})

  // Copied indicator: bucketId -> boolean
  const [copiedId, setCopiedId] = React.useState<string | null>(null)

  const defaultBucket = buckets.find((b) => b.isDefault) || buckets[0]

  const handleOpenAdd = () => {
    setEditingBucket(null)
    setModalOpen(true)
  }

  const handleOpenEdit = (bucket: S3BucketConfig) => {
    setEditingBucket(bucket)
    setModalOpen(true)
  }

  const handleSaveBucket = (savedBucket: S3BucketConfig) => {
    let newBuckets: S3BucketConfig[]

    const exists = buckets.some((b) => b.id === savedBucket.id)

    if (exists) {
      newBuckets = buckets.map((b) => {
        if (b.id === savedBucket.id) {
          return savedBucket
        }
        if (savedBucket.isDefault) {
          return { ...b, isDefault: false }
        }
        return b
      })
    } else {
      if (savedBucket.isDefault) {
        newBuckets = [
          ...buckets.map((b) => ({ ...b, isDefault: false })),
          savedBucket,
        ]
      } else {
        newBuckets = [...buckets, savedBucket]
      }
    }

    // Ensure at least one default if list not empty
    if (newBuckets.length > 0 && !newBuckets.some((b) => b.isDefault)) {
      newBuckets[0].isDefault = true
    }

    onBucketsChange(newBuckets)
  }

  const handleSetDefault = (bucketId: string) => {
    const updated = buckets.map((b) => ({
      ...b,
      isDefault: b.id === bucketId,
    }))
    onBucketsChange(updated)
  }

  const handleConfirmDelete = () => {
    if (!deleteTarget) return

    const remaining = buckets.filter((b) => b.id !== deleteTarget.id)
    if (deleteTarget.isDefault && remaining.length > 0) {
      remaining[0].isDefault = true
    }
    onBucketsChange(remaining)
    setDeleteTarget(null)
  }

  const handleTestConnection = async (bucket: S3BucketConfig) => {
    setTestingStatus((prev) => ({ ...prev, [bucket.id]: "testing" }))

    try {
      const res = await testS3Bucket(bucket)
      if (res.ok) {
        setTestingStatus((prev) => ({ ...prev, [bucket.id]: "success" }))
        const updated = buckets.map((b) =>
          b.id === bucket.id
            ? { ...b, status: "connected" as const, lastTested: "Just now" }
            : b
        )
        onBucketsChange(updated)
      } else {
        setTestingStatus((prev) => ({ ...prev, [bucket.id]: "error" }))
        const updated = buckets.map((b) =>
          b.id === bucket.id
            ? { ...b, status: "error" as const, lastTested: "Failed just now" }
            : b
        )
        onBucketsChange(updated)
      }
    } catch {
      setTestingStatus((prev) => ({ ...prev, [bucket.id]: "error" }))
    } finally {
      setTimeout(() => {
        setTestingStatus((prev) => {
          const next = { ...prev }
          delete next[bucket.id]
          return next
        })
      }, 3500)
    }
  }

  const handleCopyEndpoint = async (bucket: S3BucketConfig) => {
    if (await copyToClipboard(`${bucket.endpoint}/${bucket.bucket}`)) {
      setCopiedId(bucket.id)
      setTimeout(() => setCopiedId(null), 2000)
    }
  }

  return (
    <div className="space-y-6">
      {/* Tab Header Card */}
      <div className="rounded-lg border border-border bg-card p-5 shadow-xs sm:p-6">
        <SettingsSectionHeader
          icon={HardDrive}
          title="S3 & Object Storage Buckets"
          description="Manage multi-destination S3-compatible buckets for artifact layers, volumes, and cluster backups."
          action={
            <Button
              type="button"
              onClick={handleOpenAdd}
              size="sm"
              className="gap-1.5 text-xs"
            >
              <Plus className="size-3.5" />
              <span>Add S3 Bucket</span>
            </Button>
          }
        />

        {/* Quick telemetry summary bar */}
        <div className="mt-5 grid grid-cols-2 gap-3 border-t border-border pt-4 sm:grid-cols-4">
          <div className="rounded-md border border-border/60 bg-muted/20 p-3">
            <div className="text-[11px] font-medium text-muted-foreground">
              Configured Buckets
            </div>
            <div className="mt-1 flex items-baseline gap-1.5 font-mono text-lg font-semibold text-foreground">
              <span>{buckets.length}</span>
              <span className="text-[11px] font-normal text-muted-foreground">
                targets
              </span>
            </div>
          </div>

          <div className="rounded-md border border-border/60 bg-muted/20 p-3">
            <div className="text-[11px] font-medium text-muted-foreground">
              Primary Target
            </div>
            <div className="mt-1 truncate font-mono text-xs font-semibold text-foreground">
              {defaultBucket ? defaultBucket.name : "None"}
            </div>
          </div>

          <div className="rounded-md border border-border/60 bg-muted/20 p-3">
            <div className="text-[11px] font-medium text-muted-foreground">
              Global Health
            </div>
            <div className="mt-1 flex items-center gap-1.5 font-mono text-xs font-semibold text-emerald-600 dark:text-emerald-400">
              <span className="size-1.5 animate-pulse rounded-full bg-emerald-500" />
              <span>All Reachable (200)</span>
            </div>
          </div>

          <div className="rounded-md border border-border/60 bg-muted/20 p-3">
            <div className="text-[11px] font-medium text-muted-foreground">
              Max Retention
            </div>
            <div className="mt-1 font-mono text-xs font-semibold text-foreground">
              {buckets.length > 0
                ? `${Math.max(...buckets.map((b) => b.retentionDays))} Days`
                : "None"}
            </div>
          </div>
        </div>
      </div>

      {/* Buckets List or Empty State */}
      {buckets.length === 0 ? (
        <EmptyState
          icon={HardDrive}
          title="No S3 Storage Buckets Configured"
          description="Edge worker daemons require at least one S3-compatible bucket to store compose layers, build artifacts, and telemetry logs."
          actionLabel="Add First S3 Bucket"
          onAction={handleOpenAdd}
        />
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-medium text-muted-foreground">
              Storage Buckets ({buckets.length})
            </span>
            <span className="text-[11px] text-muted-foreground">
              Worker daemons will distribute layers based on role
            </span>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {buckets.map((b) => {
              const purposeInfo =
                PURPOSE_LABELS[b.purpose || "artifacts"] ||
                PURPOSE_LABELS.artifacts
              const PurposeIcon = purposeInfo.icon
              const currentTest = testingStatus[b.id]

              return (
                <div
                  key={b.id}
                  className={cn(
                    "relative flex flex-col justify-between rounded-lg border bg-card p-4 shadow-xs transition-all sm:p-5",
                    b.isDefault
                      ? "border-primary/40 ring-1 ring-primary/20"
                      : "border-border hover:border-border/80"
                  )}
                >
                  <div>
                    {/* Top Header Row */}
                    <div className="flex flex-wrap items-start justify-between gap-2 border-b border-border/60 pb-3">
                      <div className="flex items-center gap-2.5">
                        <div
                          className={cn(
                            "flex size-8 items-center justify-center rounded-sm",
                            b.isDefault
                              ? "bg-primary/10 text-primary"
                              : "bg-muted text-muted-foreground"
                          )}
                        >
                          <HardDrive className="size-4" />
                        </div>

                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-sm font-semibold text-foreground">
                              {b.name}
                            </h3>

                            {b.isDefault && (
                              <span className="inline-flex items-center gap-1 rounded-sm border border-primary/30 bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                                <ShieldCheck className="size-3" />
                                <span>Default Target</span>
                              </span>
                            )}

                            <span className="inline-flex items-center gap-1 rounded-sm border border-border bg-muted/40 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                              <PurposeIcon className="size-3" />
                              <span>{purposeInfo.label}</span>
                            </span>
                          </div>

                          <div className="mt-0.5 flex items-center gap-2 font-mono text-[11px] text-muted-foreground">
                            <span>{b.bucket}</span>
                            <span>•</span>
                            <span>{b.region}</span>
                          </div>
                        </div>
                      </div>

                      {/* Right Status Badge */}
                      <div className="flex items-center gap-2">
                        {currentTest === "testing" ? (
                          <span className="inline-flex items-center gap-1 rounded border border-muted bg-muted/40 px-2 py-0.5 font-mono text-[11px] text-muted-foreground">
                            <Loader2 className="size-3 animate-spin text-primary" />
                            <span>Checking Handshake...</span>
                          </span>
                        ) : currentTest === "success" ? (
                          <span className="inline-flex items-center gap-1 rounded border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 font-mono text-[11px] text-emerald-600 dark:text-emerald-400">
                            <Check className="size-3 text-emerald-500" />
                            <span>Bucket OK (200)</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 rounded border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 font-mono text-[11px] text-emerald-600 dark:text-emerald-400">
                            <span className="size-1.5 rounded-full bg-emerald-500" />
                            <span>Connected</span>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Metadata Technical Specs Grid */}
                    <div className="mt-3.5 grid grid-cols-1 gap-2.5 font-mono text-xs sm:grid-cols-2 md:grid-cols-4">
                      <div className="rounded border border-border/40 bg-muted/20 p-2">
                        <span className="block font-sans text-[10px] text-muted-foreground">
                          Endpoint
                        </span>
                        <div className="mt-0.5 flex items-center justify-between gap-1">
                          <span
                            className="truncate text-foreground"
                            title={b.endpoint}
                          >
                            {b.endpoint}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleCopyEndpoint(b)}
                            className="shrink-0 text-muted-foreground hover:text-foreground"
                            title="Copy full bucket URL"
                          >
                            {copiedId === b.id ? (
                              <Check className="size-3 text-emerald-500" />
                            ) : (
                              <Copy className="size-3" />
                            )}
                          </button>
                        </div>
                      </div>

                      <div className="rounded border border-border/40 bg-muted/20 p-2">
                        <span className="block font-sans text-[10px] text-muted-foreground">
                          Access Key
                        </span>
                        <div className="mt-0.5 truncate text-foreground">
                          {b.accessKey
                            ? `${b.accessKey.substring(0, 8)}••••••••`
                            : "Not configured"}
                        </div>
                      </div>

                      <div className="rounded border border-border/40 bg-muted/20 p-2">
                        <span className="block font-sans text-[10px] text-muted-foreground">
                          URL Addressing Style
                        </span>
                        <div className="mt-0.5 text-foreground">
                          {b.forcePathStyle ? (
                            <span className="text-amber-600 dark:text-amber-400">
                              Path-Style (MinIO)
                            </span>
                          ) : (
                            <span>Virtual-Hosted</span>
                          )}
                        </div>
                      </div>

                      <div className="rounded border border-border/40 bg-muted/20 p-2">
                        <span className="block font-sans text-[10px] text-muted-foreground">
                          Artifact Retention
                        </span>
                        <div className="mt-0.5 text-foreground">
                          {b.retentionDays} Days
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Actions Footer */}
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-3">
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="xs"
                        onClick={() => handleTestConnection(b)}
                        disabled={currentTest === "testing"}
                        className="gap-1.5 text-xs"
                      >
                        {currentTest === "testing" ? (
                          <>
                            <Loader2 className="size-3 animate-spin" />
                            <span>Testing...</span>
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="size-3" />
                            <span>Test Connection</span>
                          </>
                        )}
                      </Button>

                      {!b.isDefault && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="xs"
                          onClick={() => handleSetDefault(b.id)}
                          className="text-xs text-muted-foreground hover:text-foreground"
                        >
                          Set as Default
                        </Button>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5">
                      <Button
                        type="button"
                        variant="outline"
                        size="xs"
                        onClick={() => handleOpenEdit(b)}
                        className="gap-1.5 text-xs"
                      >
                        <Pencil className="size-3" />
                        <span>Edit</span>
                      </Button>

                      <Button
                        type="button"
                        variant="ghost"
                        size="xs"
                        onClick={() => setDeleteTarget(b)}
                        className="text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
                        title="Remove bucket"
                      >
                        <Trash2 className="size-3" />
                        <span className="hidden sm:inline">Delete</span>
                      </Button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* S3 Bucket Form Modal */}
      <S3BucketModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        bucket={editingBucket}
        onSave={handleSaveBucket}
        existingCount={buckets.length}
      />

      {/* Delete Confirmation Modal */}
      <Dialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <div className="flex size-7 items-center justify-center rounded-sm bg-destructive/10 text-destructive">
                <AlertTriangle className="size-4" />
              </div>
              <DialogTitle className="text-base font-semibold text-destructive">
                Remove S3 Storage Bucket
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs text-muted-foreground">
              Are you sure you want to remove this storage bucket destination?
            </DialogDescription>
          </DialogHeader>

          {deleteTarget && (
            <div className="space-y-3 py-2 text-xs">
              <div className="rounded-md border border-border bg-muted/20 p-3 font-mono">
                <div className="font-semibold text-foreground">
                  {deleteTarget.name}
                </div>
                <div className="mt-1 text-[11px] text-muted-foreground">
                  {deleteTarget.endpoint}/{deleteTarget.bucket}
                </div>
              </div>

              {deleteTarget.isDefault && buckets.length > 1 && (
                <div className="rounded border border-amber-500/30 bg-amber-500/10 p-2.5 text-[11px] text-amber-600 dark:text-amber-400">
                  Note: This is currently the default target. Another bucket
                  will automatically become the default storage target.
                </div>
              )}
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setDeleteTarget(null)}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={handleConfirmDelete}
              className="gap-1.5 text-xs"
            >
              <Trash2 className="size-3.5" />
              <span>Remove Bucket</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
