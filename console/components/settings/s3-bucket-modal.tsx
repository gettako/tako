"use client"

import * as React from "react"
import {
  Check,
  CheckCircle2,
  Database,
  Eye,
  EyeOff,
  HardDrive,
  Loader2,
  Sparkles,
} from "lucide-react"
import { z } from "zod"

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
import { isHttpUrl } from "@/lib/validation"
import { S3BucketConfig, S3BucketPurpose } from "@/types/platform"
import { cn } from "@/lib/utils"

const s3BucketSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, "Bucket display label must be at least 2 characters.")
      .max(80, "Bucket display label must be 80 characters or fewer."),
    purpose: z.enum(["artifacts", "telemetry", "cache", "backups", "general"]),
    endpoint: z
      .string()
      .trim()
      .min(1, "S3 endpoint URL is required.")
      .refine(isHttpUrl, "Enter a valid HTTP or HTTPS endpoint URL."),
    region: z.string().trim().min(1, "Region is required."),
    bucketName: z
      .string()
      .trim()
      .min(3, "Bucket name must be at least 3 characters.")
      .max(63, "Bucket name must be 63 characters or fewer.")
      .regex(
        /^[a-z0-9][a-z0-9.-]*[a-z0-9]$/,
        "Use lowercase letters, numbers, dots, and hyphens only."
      ),
    retentionDays: z
      .string()
      .trim()
      .regex(/^\d+$/, "Retention must be a number.")
      .refine((value) => {
        const days = Number(value)
        return days >= 1 && days <= 3650
      }, "Retention must be between 1 and 3650 days."),
    accessKey: z.string().trim().max(128, "Access key is too long."),
    secretKey: z.string().max(256, "Secret key is too long."),
  })
  .superRefine((values, context) => {
    if (values.accessKey && !values.secretKey) {
      context.addIssue({
        code: "custom",
        path: ["secretKey"],
        message: "Secret access key is required when an access key is set.",
      })
    }
    if (values.secretKey && !values.accessKey) {
      context.addIssue({
        code: "custom",
        path: ["accessKey"],
        message: "Access key ID is required when a secret key is set.",
      })
    }
  })

interface S3BucketModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  bucket: S3BucketConfig | null
  onSave: (bucket: S3BucketConfig) => void
  existingCount: number
}

const PROVIDER_PRESETS = [
  {
    name: "AWS S3",
    endpoint: "https://s3.ap-southeast-1.amazonaws.com",
    region: "ap-southeast-1",
    forcePathStyle: false,
    placeholderBucket: "tako-artifacts-prod",
  },
  {
    name: "Cloudflare R2",
    endpoint: "https://<account-id>.r2.cloudflarestorage.com",
    region: "auto",
    forcePathStyle: false,
    placeholderBucket: "tako-telemetry-cold",
  },
  {
    name: "MinIO Local",
    endpoint: "http://minio.edge.internal:9000",
    region: "us-east-1",
    forcePathStyle: true,
    placeholderBucket: "tako-cache-layers",
  },
  {
    name: "Wasabi Hot Cloud",
    endpoint: "https://s3.ap-southeast-1.wasabisys.com",
    region: "ap-southeast-1",
    forcePathStyle: false,
    placeholderBucket: "tako-backups-archive",
  },
]

const PURPOSES: { id: S3BucketPurpose; label: string; desc: string }[] = [
  {
    id: "artifacts",
    label: "Build Artifacts",
    desc: "Application tarballs and docker context layers",
  },
  {
    id: "telemetry",
    label: "Telemetry & Logs",
    desc: "Long term agent metrics and trace archives",
  },
  {
    id: "cache",
    label: "Layer Cache",
    desc: "Compile dependencies and container layer cache",
  },
  {
    id: "backups",
    label: "Cluster Backups",
    desc: "State snapshots and database backups",
  },
  {
    id: "general",
    label: "General Storage",
    desc: "Shared multi-purpose edge object storage",
  },
]

const PURPOSE_OPTIONS: SelectOption[] = PURPOSES.map((p) => ({
  value: p.id,
  label: p.label,
  description: p.desc,
}))

interface S3BucketFormContentProps {
  bucket: S3BucketConfig | null
  onSave: (bucket: S3BucketConfig) => void
  onClose: () => void
  existingCount: number
}

function S3BucketFormContent({
  bucket,
  onSave,
  onClose,
  existingCount,
}: S3BucketFormContentProps) {
  const isEditing = !!bucket

  const [name, setName] = React.useState(bucket?.name || "")
  const [purpose, setPurpose] = React.useState<S3BucketPurpose>(
    bucket?.purpose || "artifacts"
  )
  const [endpoint, setEndpoint] = React.useState(
    bucket?.endpoint || "https://s3.ap-southeast-1.amazonaws.com"
  )
  const [bucketName, setBucketName] = React.useState(bucket?.bucket || "")
  const [region, setRegion] = React.useState(bucket?.region || "ap-southeast-1")
  const [accessKey, setAccessKey] = React.useState(bucket?.accessKey || "")
  const [secretKey, setSecretKey] = React.useState(bucket?.secretKey || "")
  const [showSecretKey, setShowSecretKey] = React.useState(false)
  const [retentionDays, setRetentionDays] = React.useState(
    bucket ? bucket.retentionDays.toString() : "30"
  )
  const [forcePathStyle, setForcePathStyle] = React.useState(
    bucket?.forcePathStyle ?? false
  )
  const [isDefault, setIsDefault] = React.useState(
    bucket ? bucket.isDefault : existingCount === 0
  )
  const { errors, validate, clearError } = useZodForm(s3BucketSchema)

  const [testStatus, setTestStatus] = React.useState<
    "idle" | "testing" | "success" | "error"
  >("idle")
  const [testResultText, setTestResultText] = React.useState<string | null>(
    null
  )

  const { testS3Bucket } = usePlatformData()

  const handleApplyPreset = (preset: (typeof PROVIDER_PRESETS)[number]) => {
    setEndpoint(preset.endpoint)
    setRegion(preset.region)
    setForcePathStyle(preset.forcePathStyle)
    if (!bucketName) {
      setBucketName(preset.placeholderBucket)
    }
    if (!name) {
      setName(`${preset.name} Bucket`)
    }
    clearError("endpoint")
    clearError("region")
    clearError("bucketName")
    clearError("name")
  }

  const handleTestHandshake = async () => {
    if (!endpoint.trim() || !bucketName.trim()) {
      setTestStatus("error")
      setTestResultText(
        "Endpoint URL and Bucket Name are required to test connection."
      )
      return
    }

    setTestStatus("testing")
    setTestResultText("Connecting to S3 endpoint...")

    try {
      const res = await testS3Bucket({
        endpoint: endpoint.trim(),
        bucket: bucketName.trim(),
        region: region.trim() || "auto",
        accessKey: accessKey.trim(),
        secretKey: secretKey.trim(),
        forcePathStyle,
      })

      if (res.ok) {
        setTestStatus("success")
        setTestResultText(
          res.message + (res.latencyMs ? ` (${res.latencyMs}ms)` : "")
        )
      } else {
        setTestStatus("error")
        setTestResultText(
          res.message || res.error || "Failed to connect to S3 endpoint."
        )
      }
    } catch (err: unknown) {
      setTestStatus("error")
      setTestResultText(
        err instanceof Error ? err.message : "Connection failed."
      )
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const valid = validate({
      name,
      purpose,
      endpoint,
      region,
      bucketName,
      retentionDays,
      accessKey,
      secretKey,
    })
    if (!valid) return

    const retention = Number.parseInt(retentionDays, 10)

    const updatedBucket: S3BucketConfig = {
      id: bucket?.id || `s3-bkt-${Math.random().toString(36).substring(2, 9)}`,
      name: name.trim(),
      purpose,
      endpoint: endpoint.trim(),
      bucket: bucketName.trim(),
      region: region.trim() || "auto",
      accessKey: accessKey.trim(),
      secretKey: secretKey.trim(),
      forcePathStyle,
      retentionDays: retention,
      isDefault: isDefault || existingCount === 0,
      status:
        testStatus === "success" ? "connected" : bucket?.status || "connected",
      lastTested:
        testStatus === "success"
          ? "Just now"
          : bucket?.lastTested || "Configured",
    }

    onSave(updatedBucket)
    onClose()
  }

  return (
    <>
      <DialogHeader>
        <div className="flex items-center gap-2">
          <div className="flex size-7 items-center justify-center rounded-sm bg-primary/10 text-primary">
            <HardDrive className="size-4" />
          </div>
          <DialogTitle className="text-base font-semibold text-foreground">
            {isEditing ? "Edit S3 Storage Bucket" : "Add S3 Storage Bucket"}
          </DialogTitle>
        </div>
        <DialogDescription className="text-xs text-muted-foreground">
          Configure an S3-compatible object storage destination for build
          artifacts, container layers, and telemetry logs.
        </DialogDescription>
      </DialogHeader>

      {/* Quick Presets */}
      <div className="rounded-md border border-border bg-muted/20 p-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-[11px] font-medium text-foreground">
            <Sparkles className="size-3 text-primary" />
            Quick Provider Presets
          </span>
          <span className="text-[10px] text-muted-foreground">
            Click to autofill endpoint & path style
          </span>
        </div>
        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
          {PROVIDER_PRESETS.map((preset) => (
            <button
              key={preset.name}
              type="button"
              onClick={() => handleApplyPreset(preset)}
              className="flex items-center justify-center rounded border border-border/80 bg-background/80 px-2 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/50 hover:bg-muted/50 hover:text-foreground"
            >
              {preset.name}
            </button>
          ))}
        </div>
      </div>

      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <FieldGroup className="gap-3.5">
          {/* Display Name and Purpose */}
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
            <Field
              data-invalid={Boolean(errors.name)}
              className="sm:col-span-2"
            >
              <FieldLabel htmlFor="s3-modal-name" className="text-xs">
                Bucket Display Label
              </FieldLabel>
              <Input
                id="s3-modal-name"
                value={name}
                onChange={(e) => {
                  setName(e.target.value)
                  clearError("name")
                }}
                placeholder="e.g. Primary Build Artifacts"
                aria-invalid={Boolean(errors.name)}
                aria-describedby={
                  errors.name ? "s3-modal-name-error" : undefined
                }
                className="text-xs"
                required
              />
              <FieldError id="s3-modal-name-error" className="text-[11px]">
                {errors.name}
              </FieldError>
            </Field>

            <Field data-invalid={Boolean(errors.purpose)}>
              <FieldLabel htmlFor="s3-modal-purpose" className="text-xs">
                Storage Purpose
              </FieldLabel>
              <SearchableSelect
                id="s3-modal-purpose"
                value={purpose}
                onChange={(val) => {
                  setPurpose(val as S3BucketPurpose)
                  clearError("purpose")
                }}
                options={PURPOSE_OPTIONS}
                placeholder="Select storage purpose..."
                searchPlaceholder="Search purpose..."
              />
              <FieldError id="s3-modal-purpose-error" className="text-[11px]">
                {errors.purpose}
              </FieldError>
            </Field>
          </div>

          {/* S3 Endpoint and Region */}
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
            <Field
              data-invalid={Boolean(errors.endpoint)}
              className="sm:col-span-2"
            >
              <FieldLabel htmlFor="s3-modal-endpoint" className="text-xs">
                S3 Endpoint URL
              </FieldLabel>
              <Input
                id="s3-modal-endpoint"
                value={endpoint}
                onChange={(e) => {
                  setEndpoint(e.target.value)
                  clearError("endpoint")
                }}
                placeholder="https://s3.ap-southeast-1.amazonaws.com"
                aria-invalid={Boolean(errors.endpoint)}
                aria-describedby={
                  errors.endpoint ? "s3-modal-endpoint-error" : undefined
                }
                className="font-mono text-xs"
                required
              />
              <FieldError id="s3-modal-endpoint-error" className="text-[11px]">
                {errors.endpoint}
              </FieldError>
            </Field>

            <Field data-invalid={Boolean(errors.region)}>
              <FieldLabel htmlFor="s3-modal-region" className="text-xs">
                Region
              </FieldLabel>
              <Input
                id="s3-modal-region"
                value={region}
                onChange={(e) => {
                  setRegion(e.target.value)
                  clearError("region")
                }}
                placeholder="ap-southeast-1 or auto"
                aria-invalid={Boolean(errors.region)}
                aria-describedby={
                  errors.region ? "s3-modal-region-error" : undefined
                }
                className="font-mono text-xs"
              />
              <FieldError id="s3-modal-region-error" className="text-[11px]">
                {errors.region}
              </FieldError>
            </Field>
          </div>

          {/* Bucket Name and Retention */}
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
            <Field
              data-invalid={Boolean(errors.bucketName)}
              className="sm:col-span-2"
            >
              <FieldLabel htmlFor="s3-modal-bucket" className="text-xs">
                Bucket Name
              </FieldLabel>
              <Input
                id="s3-modal-bucket"
                value={bucketName}
                onChange={(e) => {
                  setBucketName(e.target.value)
                  clearError("bucketName")
                }}
                placeholder="tako-artifacts-prod"
                aria-invalid={Boolean(errors.bucketName)}
                aria-describedby={
                  errors.bucketName ? "s3-modal-bucket-error" : undefined
                }
                className="font-mono text-xs"
                required
              />
              <FieldError id="s3-modal-bucket-error" className="text-[11px]">
                {errors.bucketName}
              </FieldError>
            </Field>

            <Field data-invalid={Boolean(errors.retentionDays)}>
              <FieldLabel htmlFor="s3-modal-retention" className="text-xs">
                Retention (Days)
              </FieldLabel>
              <Input
                id="s3-modal-retention"
                type="number"
                min="1"
                max="3650"
                value={retentionDays}
                onChange={(e) => {
                  setRetentionDays(e.target.value)
                  clearError("retentionDays")
                }}
                aria-invalid={Boolean(errors.retentionDays)}
                aria-describedby={
                  errors.retentionDays ? "s3-modal-retention-error" : undefined
                }
                className="font-mono text-xs"
                required
              />
              <FieldError id="s3-modal-retention-error" className="text-[11px]">
                {errors.retentionDays}
              </FieldError>
            </Field>
          </div>

          {/* Access Key and Secret Key */}
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
            <Field data-invalid={Boolean(errors.accessKey)}>
              <FieldLabel htmlFor="s3-modal-access-key" className="text-xs">
                Access Key ID
              </FieldLabel>
              <Input
                id="s3-modal-access-key"
                value={accessKey}
                onChange={(e) => {
                  setAccessKey(e.target.value)
                  clearError("accessKey")
                }}
                placeholder="AKIAIOSFODNN7EXAMPLE"
                aria-invalid={Boolean(errors.accessKey)}
                aria-describedby={
                  errors.accessKey ? "s3-modal-access-key-error" : undefined
                }
                className="font-mono text-xs"
              />
              <FieldError
                id="s3-modal-access-key-error"
                className="text-[11px]"
              >
                {errors.accessKey}
              </FieldError>
            </Field>

            <Field data-invalid={Boolean(errors.secretKey)}>
              <FieldLabel htmlFor="s3-modal-secret-key" className="text-xs">
                Secret Access Key
              </FieldLabel>
              <div className="relative">
                <Input
                  id="s3-modal-secret-key"
                  type={showSecretKey ? "text" : "password"}
                  value={secretKey}
                  onChange={(e) => {
                    setSecretKey(e.target.value)
                    clearError("secretKey")
                  }}
                  placeholder="wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
                  aria-invalid={Boolean(errors.secretKey)}
                  aria-describedby={
                    errors.secretKey ? "s3-modal-secret-key-error" : undefined
                  }
                  className="pr-9 font-mono text-xs"
                />
                <button
                  type="button"
                  onClick={() => setShowSecretKey((p) => !p)}
                  className="absolute top-2.5 right-2.5 text-muted-foreground transition-colors hover:text-foreground"
                  title={showSecretKey ? "Hide key" : "Show key"}
                >
                  {showSecretKey ? (
                    <EyeOff className="size-3.5" />
                  ) : (
                    <Eye className="size-3.5" />
                  )}
                </button>
              </div>
              <FieldError
                id="s3-modal-secret-key-error"
                className="text-[11px]"
              >
                {errors.secretKey}
              </FieldError>
            </Field>
          </div>

          {/* Toggles: Force Path Style and Default Target */}
          <div className="space-y-2 pt-1">
            <div className="flex items-center justify-between rounded-md border border-border bg-muted/20 p-2.5">
              <div className="pr-2">
                <label
                  htmlFor="s3-force-path-style"
                  className="cursor-pointer text-xs font-semibold text-foreground"
                >
                  Force Path Style (MinIO compatibility)
                </label>
                <p className="text-[11px] text-muted-foreground">
                  Use path-style URLs (endpoint/bucket) rather than
                  virtual-hosted URLs.
                </p>
              </div>
              <input
                type="checkbox"
                id="s3-force-path-style"
                checked={forcePathStyle}
                onChange={(e) => setForcePathStyle(e.target.checked)}
                className="size-4 cursor-pointer rounded accent-primary"
              />
            </div>

            <div className="flex items-center justify-between rounded-md border border-border bg-muted/20 p-2.5">
              <div className="pr-2">
                <label
                  htmlFor="s3-set-default"
                  className="cursor-pointer text-xs font-semibold text-foreground"
                >
                  Set as Default Ingress Storage Target
                </label>
                <p className="text-[11px] text-muted-foreground">
                  Edge worker daemons will use this bucket as primary for build
                  cache and artifacts.
                </p>
              </div>
              <input
                type="checkbox"
                id="s3-set-default"
                checked={isDefault}
                onChange={(e) => setIsDefault(e.target.checked)}
                className="size-4 cursor-pointer rounded accent-primary"
              />
            </div>
          </div>

          {/* Test Connection Button & Status inside Modal */}
          <div className="rounded-md border border-border bg-muted/10 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-xs">
                <span className="font-medium text-foreground">
                  Credential Verification
                </span>
                <p className="text-[11px] text-muted-foreground">
                  Verify bucket reachability and credentials before saving.
                </p>
              </div>

              <Button
                type="button"
                variant="outline"
                size="xs"
                onClick={handleTestHandshake}
                disabled={testStatus === "testing"}
                className="gap-1.5 text-xs"
              >
                {testStatus === "testing" ? (
                  <>
                    <Loader2 className="size-3 animate-spin" />
                    <span>Testing...</span>
                  </>
                ) : testStatus === "success" ? (
                  <>
                    <Check className="size-3 text-emerald-500" />
                    <span>Verified (200 OK)</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="size-3" />
                    <span>Test Handshake</span>
                  </>
                )}
              </Button>
            </div>

            {testResultText && (
              <div
                className={cn(
                  "mt-2 rounded p-2 font-mono text-[11px]",
                  testStatus === "success" &&
                    "border border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
                  testStatus === "error" &&
                    "border border-destructive/20 bg-destructive/10 text-destructive",
                  testStatus === "testing" &&
                    "bg-muted/40 text-muted-foreground"
                )}
              >
                {testResultText}
              </div>
            )}
          </div>
        </FieldGroup>

        <DialogFooter className="gap-2 pt-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            className="text-xs"
          >
            Cancel
          </Button>
          <Button type="submit" size="sm" className="gap-1.5 text-xs">
            <Database className="size-3.5" />
            <span>
              {isEditing ? "Save Bucket Changes" : "Add Storage Bucket"}
            </span>
          </Button>
        </DialogFooter>
      </form>
    </>
  )
}

export function S3BucketModal({
  open,
  onOpenChange,
  bucket,
  onSave,
  existingCount,
}: S3BucketModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-3rem)] sm:max-w-xl">
        {open && (
          <S3BucketFormContent
            key={bucket?.id || "new-bucket"}
            bucket={bucket}
            onSave={onSave}
            onClose={() => onOpenChange(false)}
            existingCount={existingCount}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
