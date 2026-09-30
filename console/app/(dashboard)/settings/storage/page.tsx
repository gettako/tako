"use client"

import * as React from "react"
import { SettingsHeader } from "@/components/settings-header"
import {
  HardDrivesIcon,
  PlusIcon,
  CircleNotchIcon,
  CheckIcon,
  WarningIcon,
  CheckCircleIcon,
  PencilSimpleIcon,
  TrashIcon,
  StarIcon,
  ArrowClockwiseIcon,
} from "@phosphor-icons/react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
  type S3Destination,
  type CreateS3DestinationRequest,
  type UpdateS3DestinationRequest,
} from "@/lib/api"
import { cn } from "@/lib/utils"

type StoragePreset = "r2" | "aws" | "minio" | "wasabi" | "b2" | "custom"

interface PresetConfig {
  label: string
  defaultEndpoint: string
  defaultRegion: string
  usePathStyle: boolean
  placeholderEndpoint: string
}

export const STORAGE_PRESETS: Record<StoragePreset, PresetConfig> = {
  r2: {
    label: "Cloudflare R2",
    defaultEndpoint: "https://<account-id>.r2.cloudflarestorage.com",
    defaultRegion: "auto",
    usePathStyle: false,
    placeholderEndpoint: "https://<account-id>.r2.cloudflarestorage.com",
  },
  aws: {
    label: "AWS S3",
    defaultEndpoint: "https://s3.us-east-1.amazonaws.com",
    defaultRegion: "us-east-1",
    usePathStyle: false,
    placeholderEndpoint: "https://s3.us-east-1.amazonaws.com",
  },
  minio: {
    label: "MinIO",
    defaultEndpoint: "http://minio.internal:9000",
    defaultRegion: "us-east-1",
    usePathStyle: true,
    placeholderEndpoint: "http://minio.internal:9000",
  },
  wasabi: {
    label: "Wasabi",
    defaultEndpoint: "https://s3.wasabisys.com",
    defaultRegion: "us-east-1",
    usePathStyle: false,
    placeholderEndpoint: "https://s3.wasabisys.com",
  },
  b2: {
    label: "Backblaze B2",
    defaultEndpoint: "https://s3.us-west-002.backblazeb2.com",
    defaultRegion: "us-west-002",
    usePathStyle: false,
    placeholderEndpoint: "https://s3.us-west-002.backblazeb2.com",
  },
  custom: {
    label: "Custom S3",
    defaultEndpoint: "",
    defaultRegion: "us-east-1",
    usePathStyle: false,
    placeholderEndpoint: "https://s3.example.com",
  },
}

export function getProviderBadge(endpoint: string, name: string) {
  const ep = (endpoint || "").toLowerCase()
  const nm = (name || "").toLowerCase()

  if (
    ep.includes("r2.cloudflarestorage.com") ||
    nm.includes("r2") ||
    nm.includes("cloudflare")
  ) {
    return {
      label: "Cloudflare R2",
      badgeClass:
        "border-orange-500/30 bg-orange-500/10 text-orange-600 dark:text-orange-400",
    }
  }
  if (
    ep.includes("amazonaws.com") ||
    nm.includes("aws") ||
    nm.includes("amazon")
  ) {
    return {
      label: "AWS S3",
      badgeClass:
        "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400",
    }
  }
  if (ep.includes("minio") || nm.includes("minio")) {
    return {
      label: "MinIO",
      badgeClass:
        "border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400",
    }
  }
  if (ep.includes("wasabisys.com") || nm.includes("wasabi")) {
    return {
      label: "Wasabi",
      badgeClass:
        "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    }
  }
  if (
    ep.includes("backblazeb2.com") ||
    nm.includes("backblaze") ||
    nm.includes("b2")
  ) {
    return {
      label: "Backblaze B2",
      badgeClass:
        "border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-400",
    }
  }
  return {
    label: "S3 Compatible",
    badgeClass:
      "border-zinc-500/30 bg-zinc-500/10 text-zinc-600 dark:text-zinc-400",
  }
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
      hour12: false,
    })
  } catch {
    return dateStr
  }
}

export default function SettingsStoragePage() {
  const [destinations, setDestinations] = React.useState<S3Destination[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [fetchError, setFetchError] = React.useState<string | null>(null)

  // Feedback Notification Banner
  const [banner, setBanner] = React.useState<{
    type: "success" | "error"
    message: string
  } | null>(null)

  // Dialog State: Add / Edit
  const [isModalOpen, setIsModalOpen] = React.useState(false)
  const [editingDest, setEditingDest] = React.useState<S3Destination | null>(
    null
  )

  // Form Fields
  const [formPreset, setFormPreset] = React.useState<StoragePreset>("r2")
  const [formName, setFormName] = React.useState("")
  const [formEndpoint, setFormEndpoint] = React.useState("")
  const [formRegion, setFormRegion] = React.useState("auto")
  const [formBucket, setFormBucket] = React.useState("")
  const [formAccessKey, setFormAccessKey] = React.useState("")
  const [formSecretKey, setFormSecretKey] = React.useState("")
  const [formPathStyle, setFormPathStyle] = React.useState(false)
  const [formIsDefault, setFormIsDefault] = React.useState(false)

  // Form Action States
  const [formError, setFormError] = React.useState<string | null>(null)
  const [isSaving, setIsSaving] = React.useState(false)
  const [isTestingForm, setIsTestingForm] = React.useState(false)
  const [testFormResult, setTestFormResult] = React.useState<{
    success: boolean
    message: string
  } | null>(null)

  // In-row testing state: destinationId -> status
  const [testingRowId, setTestingRowId] = React.useState<string | null>(null)
  const [rowTestResults, setRowTestResults] = React.useState<
    Record<string, { success: boolean; message: string }>
  >({})

  // Setting default destination state
  const [settingDefaultId, setSettingDefaultId] = React.useState<string | null>(
    null
  )

  // Delete Dialog State
  const [deletingDest, setDeletingDest] = React.useState<S3Destination | null>(
    null
  )
  const [isDeleting, setIsDeleting] = React.useState(false)
  const [deleteError, setDeleteError] = React.useState<string | null>(null)

  const loadDestinations = React.useCallback(async () => {
    setIsLoading(true)
    setFetchError(null)
    try {
      const data = await api.storage.listS3Destinations()
      setDestinations(data)
    } catch (err) {
      const msg =
        err instanceof ApiError ? err.message : "Failed to load S3 destinations"
      setFetchError(msg)
    } finally {
      setIsLoading(false)
    }
  }, [])

  React.useEffect(() => {
    loadDestinations()
  }, [loadDestinations])

  const openAddModal = () => {
    setEditingDest(null)
    setFormPreset("r2")
    setFormName("")
    setFormEndpoint("")
    setFormRegion("auto")
    setFormBucket("")
    setFormAccessKey("")
    setFormSecretKey("")
    setFormPathStyle(false)
    setFormIsDefault(destinations.length === 0)
    setFormError(null)
    setTestFormResult(null)
    setIsModalOpen(true)
  }

  const openEditModal = (dest: S3Destination) => {
    setEditingDest(dest)
    setFormName(dest.name)
    setFormEndpoint(dest.endpoint)
    setFormRegion(dest.region)
    setFormBucket(dest.bucket_name)
    setFormAccessKey(dest.access_key_id)
    setFormSecretKey("")
    setFormPathStyle(dest.use_path_style)
    setFormIsDefault(dest.is_default)
    setFormError(null)
    setTestFormResult(null)
    setIsModalOpen(true)
  }

  const handlePresetSelect = (preset: StoragePreset) => {
    setFormPreset(preset)
    const conf = STORAGE_PRESETS[preset]
    if (conf.defaultEndpoint && !editingDest) {
      setFormEndpoint(conf.defaultEndpoint)
    }
    setFormRegion(conf.defaultRegion)
    setFormPathStyle(conf.usePathStyle)
  }

  const handleTestConnectionForm = async () => {
    if (!formBucket.trim() || !formAccessKey.trim()) {
      setFormError(
        "Please fill in Bucket Name and Access Key ID to test connection."
      )
      return
    }

    if (!editingDest && !formSecretKey.trim()) {
      setFormError("Secret Access Key is required to test connection.")
      return
    }

    setFormError(null)
    setIsTestingForm(true)
    setTestFormResult(null)

    try {
      if (editingDest && !formSecretKey.trim()) {
        const res = await api.storage.testS3Destination(editingDest.id, {
          endpoint: formEndpoint.trim(),
          region: formRegion.trim(),
          bucket_name: formBucket.trim(),
          access_key_id: formAccessKey.trim(),
          use_path_style: formPathStyle,
        })
        setTestFormResult({
          success: true,
          message: res.message || "Connection successful.",
        })
      } else {
        const res = await api.storage.testS3Raw({
          endpoint: formEndpoint.trim(),
          region: formRegion.trim(),
          bucket_name: formBucket.trim(),
          access_key_id: formAccessKey.trim(),
          secret_access_key: formSecretKey.trim(),
          use_path_style: formPathStyle,
        })
        setTestFormResult({
          success: true,
          message: res.message || "Connection successful.",
        })
      }
    } catch (err) {
      const msg =
        err instanceof ApiError ? err.message : "Connection test failed."
      setTestFormResult({
        success: false,
        message: msg,
      })
    } finally {
      setIsTestingForm(false)
    }
  }

  const handleSaveDestination = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formName.trim()) {
      setFormError("Destination name is required.")
      return
    }
    if (!formEndpoint.trim()) {
      setFormError("Endpoint URL is required.")
      return
    }
    if (!formBucket.trim()) {
      setFormError("Bucket name is required.")
      return
    }
    if (!formAccessKey.trim()) {
      setFormError("Access Key ID is required.")
      return
    }
    if (!editingDest && !formSecretKey.trim()) {
      setFormError("Secret Access Key is required.")
      return
    }

    setFormError(null)
    setIsSaving(true)

    try {
      if (editingDest) {
        const req: UpdateS3DestinationRequest = {
          name: formName.trim(),
          endpoint: formEndpoint.trim(),
          region: formRegion.trim(),
          bucket_name: formBucket.trim(),
          access_key_id: formAccessKey.trim(),
          use_path_style: formPathStyle,
          is_default: formIsDefault,
        }
        if (formSecretKey.trim()) {
          req.secret_access_key = formSecretKey.trim()
        }
        await api.storage.updateS3Destination(editingDest.id, req)
        setBanner({
          type: "success",
          message: `Storage destination "${formName.trim()}" updated successfully.`,
        })
      } else {
        const req: CreateS3DestinationRequest = {
          name: formName.trim(),
          endpoint: formEndpoint.trim(),
          region: formRegion.trim(),
          bucket_name: formBucket.trim(),
          access_key_id: formAccessKey.trim(),
          secret_access_key: formSecretKey.trim(),
          use_path_style: formPathStyle,
          is_default: formIsDefault,
        }
        await api.storage.createS3Destination(req)
        setBanner({
          type: "success",
          message: `Storage destination "${formName.trim()}" created successfully.`,
        })
      }
      setIsModalOpen(false)
      loadDestinations()
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : "Failed to save storage destination."
      setFormError(msg)
    } finally {
      setIsSaving(false)
    }
  }

  const handleTestRow = async (dest: S3Destination) => {
    setTestingRowId(dest.id)
    try {
      const res = await api.storage.testS3Destination(dest.id)
      setRowTestResults((prev) => ({
        ...prev,
        [dest.id]: {
          success: true,
          message: res.message || "Connection verified",
        },
      }))
    } catch (err) {
      const msg =
        err instanceof ApiError ? err.message : "Connection test failed."
      setRowTestResults((prev) => ({
        ...prev,
        [dest.id]: {
          success: false,
          message: msg,
        },
      }))
    } finally {
      setTestingRowId(null)
    }
  }

  const handleSetDefault = async (dest: S3Destination) => {
    setSettingDefaultId(dest.id)
    try {
      await api.storage.updateS3Destination(dest.id, { is_default: true })
      setBanner({
        type: "success",
        message: `"${dest.name}" is now marked as default storage destination.`,
      })
      loadDestinations()
    } catch (err) {
      const msg =
        err instanceof ApiError ? err.message : "Failed to set default."
      setBanner({ type: "error", message: msg })
    } finally {
      setSettingDefaultId(null)
    }
  }

  const handleDeleteConfirm = async () => {
    if (!deletingDest) return
    setIsDeleting(true)
    setDeleteError(null)

    try {
      await api.storage.deleteS3Destination(deletingDest.id)
      setBanner({
        type: "success",
        message: `Destination "${deletingDest.name}" removed successfully.`,
      })
      setDeletingDest(null)
      loadDestinations()
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : "Failed to delete storage destination."
      setDeleteError(msg)
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className="flex w-full flex-col gap-6 md:gap-8">
      <SettingsHeader
        title="Storage Destinations"
        description="Centralized management for multiple S3-compatible endpoints (AWS S3, Cloudflare R2, MinIO, Wasabi, Backblaze B2)."
        action={
          <Button onClick={openAddModal} className="gap-2">
            <PlusIcon className="size-4" />
            <span>Add S3 Destination</span>
          </Button>
        }
      />

      {/* Global Action Banner */}
      {banner && (
        <div
          role="alert"
          className={cn(
            "flex items-center justify-between rounded-lg border px-4 py-3 text-sm",
            banner.type === "success"
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
              : "border-destructive/30 bg-destructive/10 text-destructive"
          )}
        >
          <div className="flex items-center gap-2">
            {banner.type === "success" ? (
              <CheckCircleIcon className="size-5 shrink-0" />
            ) : (
              <WarningIcon className="size-5 shrink-0" />
            )}
            <span>{banner.message}</span>
          </div>
          <button
            onClick={() => setBanner(null)}
            className="text-xs underline hover:opacity-80"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Main Content Area: 4 States */}
      {isLoading ? (
        /* State 1: Loading State */
        <div
          data-testid="storage-loading-state"
          className="flex flex-col gap-4 rounded-lg border border-border bg-card p-6"
        >
          <div className="h-6 w-48 animate-pulse rounded bg-muted" />
          <div className="h-4 w-72 animate-pulse rounded bg-muted" />
          <div className="mt-4 flex flex-col gap-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-16 w-full animate-pulse rounded-md bg-muted/60"
              />
            ))}
          </div>
        </div>
      ) : fetchError ? (
        /* State 2: Error State */
        <div
          role="alert"
          data-testid="storage-error-state"
          className="flex flex-col items-center justify-center gap-3 rounded-lg border border-destructive/30 bg-card p-8 text-center"
        >
          <WarningIcon className="size-8 text-destructive" />
          <p className="text-sm font-medium text-foreground">{fetchError}</p>
          <Button
            variant="outline"
            onClick={loadDestinations}
            className="flex items-center gap-2 text-xs"
          >
            <ArrowClockwiseIcon className="size-3.5" />
            <span>Retry</span>
          </Button>
        </div>
      ) : destinations.length === 0 ? (
        /* State 3: Empty State */
        <div
          data-testid="storage-empty-state"
          className="flex flex-col items-center justify-center gap-4 rounded-lg border border-border bg-card p-12 text-center"
        >
          <div className="flex size-14 items-center justify-center rounded-full border border-border bg-muted text-muted-foreground">
            <HardDrivesIcon className="size-7" />
          </div>
          <div className="flex flex-col gap-1">
            <h3 className="font-heading text-base font-semibold text-foreground">
              No S3 Storage Destinations Configured
            </h3>
            <p className="max-w-md text-xs text-muted-foreground">
              Configure AWS S3, Cloudflare R2, MinIO, Wasabi, or Backblaze B2 to
              enable storage tiering for database snapshots and volume archives.
            </p>
          </div>
          <Button onClick={openAddModal} className="flex items-center gap-2">
            <PlusIcon className="size-4" />
            <span>Add S3 Destination</span>
          </Button>
        </div>
      ) : (
        /* State 4: Data State (Table) */
        <div
          data-testid="storage-data-state"
          className="flex flex-col overflow-hidden rounded-lg border border-border bg-card"
        >
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border bg-muted/40 text-xs font-semibold text-muted-foreground uppercase">
                <tr>
                  <th className="px-5 py-3">Destination</th>
                  <th className="px-5 py-3">Bucket & Region</th>
                  <th className="px-5 py-3">Endpoint URL</th>
                  <th className="px-5 py-3">Access Key ID</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {destinations.map((dest) => {
                  const badge = getProviderBadge(dest.endpoint, dest.name)
                  const testRes = rowTestResults[dest.id]
                  const isRowTesting = testingRowId === dest.id
                  const isSettingDef = settingDefaultId === dest.id

                  return (
                    <tr
                      key={dest.id}
                      className="transition-colors hover:bg-muted/30"
                    >
                      {/* Column 1: Name, Provider Badge, Default Tag */}
                      <td className="px-5 py-4">
                        <div className="flex flex-col gap-1.5">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-foreground">
                              {dest.name}
                            </span>
                            {dest.is_default && (
                              <span className="inline-flex items-center gap-1 rounded border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                                <CheckIcon className="size-3" />
                                <span>Default</span>
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <span
                              className={cn(
                                "inline-block rounded border px-2 py-0.5 text-[11px] font-medium",
                                badge.badgeClass
                              )}
                            >
                              {badge.label}
                            </span>
                            <span className="text-[11px] text-muted-foreground">
                              Added {formatDate(dest.created_at)}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Column 2: Bucket & Region */}
                      <td className="px-5 py-4">
                        <div className="flex flex-col">
                          <span className="font-mono text-xs font-medium text-foreground">
                            {dest.bucket_name}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            Region: {dest.region}
                            {dest.use_path_style && " (Path-Style)"}
                          </span>
                        </div>
                      </td>

                      {/* Column 3: Endpoint URL */}
                      <td className="px-5 py-4">
                        <span
                          className="max-w-[200px] truncate font-mono text-xs text-muted-foreground md:max-w-[260px]"
                          title={dest.endpoint}
                        >
                          {dest.endpoint}
                        </span>
                      </td>

                      {/* Column 4: Access Key ID */}
                      <td className="px-5 py-4">
                        <span className="font-mono text-xs text-muted-foreground">
                          {dest.access_key_id}
                        </span>
                      </td>

                      {/* Column 5: Actions */}
                      <td className="px-5 py-4 text-right">
                        <div className="flex flex-col items-end gap-1.5">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Test Connection Button */}
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={isRowTesting}
                              onClick={() => handleTestRow(dest)}
                              className="h-8 gap-1 px-2.5 text-xs"
                              title="Test connection to this storage provider"
                            >
                              {isRowTesting ? (
                                <CircleNotchIcon className="size-3.5 animate-spin" />
                              ) : (
                                <ArrowClockwiseIcon className="size-3.5" />
                              )}
                              <span>Test</span>
                            </Button>

                            {/* Set As Default Button */}
                            {!dest.is_default && (
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={isSettingDef}
                                onClick={() => handleSetDefault(dest)}
                                className="h-8 gap-1 px-2.5 text-xs text-muted-foreground hover:text-foreground"
                                title="Mark as default storage destination"
                              >
                                {isSettingDef ? (
                                  <CircleNotchIcon className="size-3.5 animate-spin" />
                                ) : (
                                  <StarIcon className="size-3.5" />
                                )}
                                <span>Make Default</span>
                              </Button>
                            )}

                            {/* Edit Button */}
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openEditModal(dest)}
                              className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground"
                              title="Edit destination parameters"
                            >
                              <PencilSimpleIcon className="size-3.5" />
                            </Button>

                            {/* Delete Button */}
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setDeleteError(null)
                                setDeletingDest(dest)
                              }}
                              className="h-8 px-2 text-xs text-destructive hover:bg-destructive/10"
                              title="Remove destination"
                            >
                              <TrashIcon className="size-3.5" />
                            </Button>
                          </div>

                          {/* Row Test Feedback Pill */}
                          {testRes && (
                            <span
                              className={cn(
                                "flex items-center gap-1 text-[11px]",
                                testRes.success
                                  ? "text-emerald-600 dark:text-emerald-400"
                                  : "text-destructive"
                              )}
                            >
                              {testRes.success ? (
                                <CheckCircleIcon className="size-3 shrink-0" />
                              ) : (
                                <WarningIcon className="size-3 shrink-0" />
                              )}
                              <span>{testRes.message}</span>
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add / Edit S3 Destination Modal Dialog */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent size="lg">
          <form
            onSubmit={handleSaveDestination}
            className="flex flex-col gap-4"
          >
            <DialogHeader>
              <DialogTitle>
                {editingDest ? "Edit S3 Destination" : "Add S3 Destination"}
              </DialogTitle>
              <DialogDescription>
                Configure credentials and bucket parameters for S3-compatible
                storage endpoints.
              </DialogDescription>
            </DialogHeader>

            {formError && (
              <div
                role="alert"
                className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive"
              >
                <WarningIcon className="size-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            {/* Provider Preset Quick Selection (Only for Add) */}
            {!editingDest && (
              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-foreground">
                  Storage Provider Preset
                </span>
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                  {(Object.keys(STORAGE_PRESETS) as StoragePreset[]).map(
                    (preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => handlePresetSelect(preset)}
                        className={cn(
                          "flex items-center justify-center rounded-md border px-2 py-2 text-xs font-medium transition-colors",
                          formPreset === preset
                            ? "border-foreground bg-foreground text-background"
                            : "border-border bg-card text-foreground hover:bg-muted"
                        )}
                      >
                        {STORAGE_PRESETS[preset].label}
                      </button>
                    )
                  )}
                </div>
              </div>
            )}

            {/* Field: Destination Name */}
            <div className="flex flex-col gap-1">
              <label
                htmlFor="s3-name"
                className="text-xs font-medium text-foreground"
              >
                Destination Label *
              </label>
              <Input
                id="s3-name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g. Cloudflare R2 Production"
                required
              />
            </div>

            {/* Fields: Endpoint URL and Region */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="flex flex-col gap-1 sm:col-span-2">
                <label
                  htmlFor="s3-endpoint"
                  className="text-xs font-medium text-foreground"
                >
                  Endpoint URL *
                </label>
                <Input
                  id="s3-endpoint"
                  value={formEndpoint}
                  onChange={(e) => setFormEndpoint(e.target.value)}
                  placeholder={
                    STORAGE_PRESETS[formPreset]?.placeholderEndpoint ||
                    "https://s3.us-east-1.amazonaws.com"
                  }
                  required
                />
              </div>
              <div className="flex flex-col gap-1">
                <label
                  htmlFor="s3-region"
                  className="text-xs font-medium text-foreground"
                >
                  Region
                </label>
                <Input
                  id="s3-region"
                  value={formRegion}
                  onChange={(e) => setFormRegion(e.target.value)}
                  placeholder="e.g. us-east-1 or auto"
                />
              </div>
            </div>

            {/* Field: Bucket Name */}
            <div className="flex flex-col gap-1">
              <label
                htmlFor="s3-bucket"
                className="text-xs font-medium text-foreground"
              >
                Bucket Name *
              </label>
              <Input
                id="s3-bucket"
                value={formBucket}
                onChange={(e) => setFormBucket(e.target.value)}
                placeholder="e.g. my-app-backups"
                required
              />
            </div>

            {/* Fields: Access Key ID & Secret Access Key */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1">
                <label
                  htmlFor="s3-access-key"
                  className="text-xs font-medium text-foreground"
                >
                  Access Key ID *
                </label>
                <Input
                  id="s3-access-key"
                  value={formAccessKey}
                  onChange={(e) => setFormAccessKey(e.target.value)}
                  placeholder="AKIA..."
                  required
                />
              </div>
              <div className="flex flex-col gap-1">
                <label
                  htmlFor="s3-secret-key"
                  className="text-xs font-medium text-foreground"
                >
                  Secret Access Key{" "}
                  {editingDest ? "(leave blank to keep)" : "*"}
                </label>
                <Input
                  id="s3-secret-key"
                  type="password"
                  value={formSecretKey}
                  onChange={(e) => setFormSecretKey(e.target.value)}
                  placeholder={
                    editingDest ? "••••••••••••••••" : "Enter secret access key"
                  }
                  required={!editingDest}
                />
              </div>
            </div>

            {/* Checkbox Options: Path-Style and Default */}
            <div className="flex flex-col gap-2 rounded-md border border-border bg-muted/20 p-3">
              <label className="flex cursor-pointer items-center gap-2 text-xs font-medium text-foreground">
                <input
                  type="checkbox"
                  checked={formPathStyle}
                  onChange={(e) => setFormPathStyle(e.target.checked)}
                  className="size-4 rounded border-border"
                />
                <span>
                  Enable Path-Style Addressing (required for MinIO and custom S3
                  endpoints)
                </span>
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-xs font-medium text-foreground">
                <input
                  type="checkbox"
                  checked={formIsDefault}
                  onChange={(e) => setFormIsDefault(e.target.checked)}
                  className="size-4 rounded border-border"
                />
                <span>
                  Set as default storage destination for backup schedules
                </span>
              </label>
            </div>

            {/* Connection Test Result Feedback */}
            {testFormResult && (
              <div
                role="alert"
                className={cn(
                  "flex items-center gap-2 rounded-md border px-3 py-2 text-xs",
                  testFormResult.success
                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                    : "border-destructive/30 bg-destructive/10 text-destructive"
                )}
              >
                {testFormResult.success ? (
                  <CheckCircleIcon className="size-4 shrink-0" />
                ) : (
                  <WarningIcon className="size-4 shrink-0" />
                )}
                <span>{testFormResult.message}</span>
              </div>
            )}

            {/* Dialog Footer Actions */}
            <DialogFooter className="mt-2 flex items-center justify-between sm:justify-between">
              <Button
                type="button"
                variant="outline"
                disabled={isTestingForm || isSaving}
                onClick={handleTestConnectionForm}
                className="flex items-center gap-1.5 text-xs"
              >
                {isTestingForm ? (
                  <CircleNotchIcon className="size-3.5 animate-spin" />
                ) : (
                  <ArrowClockwiseIcon className="size-3.5" />
                )}
                <span>Test Connection</span>
              </Button>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsModalOpen(false)}
                  disabled={isSaving}
                  className="text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSaving || isTestingForm}
                  className="flex items-center gap-1.5 text-xs"
                >
                  {isSaving && (
                    <CircleNotchIcon className="size-3.5 animate-spin" />
                  )}
                  <span>
                    {editingDest ? "Save Changes" : "Create Destination"}
                  </span>
                </Button>
              </div>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deletingDest !== null}
        onOpenChange={(open) => !open && setDeletingDest(null)}
      >
        <DialogContent size="md">
          <DialogHeader>
            <DialogTitle>Delete S3 Destination</DialogTitle>
            <DialogDescription>
              Are you sure you want to remove storage destination &quot;
              {deletingDest?.name}&quot;?
            </DialogDescription>
          </DialogHeader>

          {deleteError ? (
            <div
              role="alert"
              className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive"
            >
              <WarningIcon className="size-4 shrink-0" />
              <span>{deleteError}</span>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              Destinations bound to active backup schedules cannot be deleted
              until schedules are reassigned or disabled.
            </p>
          )}

          <DialogFooter className="mt-3 gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeletingDest(null)}
              disabled={isDeleting}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleDeleteConfirm}
              disabled={isDeleting}
              className="flex items-center gap-1.5 text-xs"
            >
              {isDeleting && (
                <CircleNotchIcon className="size-3.5 animate-spin" />
              )}
              <span>Delete Destination</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
