"use client"

import * as React from "react"
import {
  EyeIcon,
  EyeSlashIcon,
  PlusIcon,
  TrashIcon,
  WarningIcon,
  FloppyDiskIcon,
  ArrowCounterClockwiseIcon,
  SlidersHorizontalIcon,
  FileTextIcon,
  TableIcon,
  CircleNotchIcon,
  CheckIcon,
  ShieldCheckIcon,
  RocketLaunchIcon,
} from "@phosphor-icons/react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { LoadingSkeleton } from "@/components/states/loading-skeleton"
import { ErrorCard } from "@/components/states/error-card"
import { useService } from "@/components/services/service-context"
import { api, type EnvVar, type ServiceEnv } from "@/lib/api"
import { cn } from "@/lib/utils"
import { EnvCodeEditor } from "@/components/editor/env-code-editor"

type ViewMode = "form" | "raw"

interface EnvRowItem extends EnvVar {
  id: string
  revealed?: boolean
}

function parseEnvString(text: string): EnvVar[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#"))
    .map((line) => {
      const equalIndex = line.indexOf("=")
      if (equalIndex === -1) {
        return { key: line.trim(), value: "", is_secret: false }
      }
      const key = line.slice(0, equalIndex).trim()
      let value = line.slice(equalIndex + 1).trim()
      // Strip surrounding quotes if present
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1)
      }
      return { key, value, is_secret: false }
    })
}

function formatEnvString(vars: EnvVar[]): string {
  return vars.map((v) => `${v.key}=${v.value}`).join("\n")
}

export default function ServiceEnvironmentPage() {
  const { serviceId, updateServiceState, showToast } = useService()

  const [isLoading, setIsLoading] = React.useState(true)
  const [error, setError] = React.useState<Error | null>(null)
  const [viewMode, setViewMode] = React.useState<ViewMode>("form")

  // Original state from backend
  const [initialEnv, setInitialEnv] = React.useState<ServiceEnv>({
    env_vars: [],
    build_args: [],
  })

  // Editable rows
  const [runtimeRows, setRuntimeRows] = React.useState<EnvRowItem[]>([])
  const [buildArgRows, setBuildArgRows] = React.useState<EnvRowItem[]>([])

  // Raw text area state
  const [rawRuntimeText, setRawRuntimeText] = React.useState("")
  const [rawBuildArgsText, setRawBuildArgsText] = React.useState("")

  // Form actions
  const [isSaving, setIsSaving] = React.useState(false)
  const [triggerDeployOnSave, setTriggerDeployOnSave] = React.useState(true)

  const loadEnv = React.useCallback(async () => {
    if (!serviceId) return
    setIsLoading(true)
    setError(null)
    try {
      const data = await api.services.getEnv(serviceId)
      setInitialEnv(data)
      setRuntimeRows(
        data.env_vars.map((v, i) => ({
          ...v,
          id: `rt-${i}-${Date.now()}`,
          revealed: false,
        }))
      )
      setBuildArgRows(
        data.build_args.map((v, i) => ({
          ...v,
          id: `ba-${i}-${Date.now()}`,
          revealed: false,
        }))
      )
      setRawRuntimeText(formatEnvString(data.env_vars))
      setRawBuildArgsText(formatEnvString(data.build_args))
    } catch (err) {
      setError(
        err instanceof Error
          ? err
          : new Error("Failed to load environment variables.")
      )
    } finally {
      setIsLoading(false)
    }
  }, [serviceId])

  React.useEffect(() => {
    loadEnv()
  }, [loadEnv])

  // Sync to raw text when switching to raw mode
  const handleSwitchMode = (newMode: ViewMode) => {
    if (newMode === "raw" && viewMode === "form") {
      setRawRuntimeText(
        formatEnvString(
          runtimeRows.map(({ key, value, is_secret }) => ({
            key,
            value,
            is_secret,
          }))
        )
      )
      setRawBuildArgsText(
        formatEnvString(
          buildArgRows.map(({ key, value, is_secret }) => ({
            key,
            value,
            is_secret,
          }))
        )
      )
    } else if (newMode === "form" && viewMode === "raw") {
      const parsedRt = parseEnvString(rawRuntimeText)
      const parsedBa = parseEnvString(rawBuildArgsText)
      setRuntimeRows(
        parsedRt.map((v, i) => ({
          ...v,
          id: `rt-raw-${i}-${Date.now()}`,
          revealed: false,
        }))
      )
      setBuildArgRows(
        parsedBa.map((v, i) => ({
          ...v,
          id: `ba-raw-${i}-${Date.now()}`,
          revealed: false,
        }))
      )
    }
    setViewMode(newMode)
  }

  // Row operations for runtime variables
  const handleAddRuntimeRow = () => {
    setRuntimeRows((prev) => [
      ...prev,
      {
        id: `rt-new-${Date.now()}`,
        key: "",
        value: "",
        is_secret: true,
        revealed: true,
      },
    ])
  }

  const handleUpdateRuntimeRow = (
    id: string,
    field: "key" | "value" | "is_secret" | "revealed",
    val: any
  ) => {
    setRuntimeRows((prev) =>
      prev.map((row) => (row.id === id ? { ...row, [field]: val } : row))
    )
  }

  const handleDeleteRuntimeRow = (id: string) => {
    setRuntimeRows((prev) => prev.filter((row) => row.id !== id))
  }

  // Row operations for build args
  const handleAddBuildArgRow = () => {
    setBuildArgRows((prev) => [
      ...prev,
      {
        id: `ba-new-${Date.now()}`,
        key: "",
        value: "",
        is_secret: false,
        revealed: true,
      },
    ])
  }

  const handleUpdateBuildArgRow = (
    id: string,
    field: "key" | "value" | "revealed",
    val: any
  ) => {
    setBuildArgRows((prev) =>
      prev.map((row) => (row.id === id ? { ...row, [field]: val } : row))
    )
  }

  const handleDeleteBuildArgRow = (id: string) => {
    setBuildArgRows((prev) => prev.filter((row) => row.id !== id))
  }

  // Determine if dirty
  const isDirty = React.useMemo(() => {
    const currentRt =
      viewMode === "form"
        ? runtimeRows.map((r) => ({ key: r.key, value: r.value }))
        : parseEnvString(rawRuntimeText).map((r) => ({
            key: r.key,
            value: r.value,
          }))

    const currentBa =
      viewMode === "form"
        ? buildArgRows.map((r) => ({ key: r.key, value: r.value }))
        : parseEnvString(rawBuildArgsText).map((r) => ({
            key: r.key,
            value: r.value,
          }))

    const initialRt = initialEnv.env_vars.map((r) => ({
      key: r.key,
      value: r.value,
    }))
    const initialBa = initialEnv.build_args.map((r) => ({
      key: r.key,
      value: r.value,
    }))

    return (
      JSON.stringify(currentRt) !== JSON.stringify(initialRt) ||
      JSON.stringify(currentBa) !== JSON.stringify(initialBa)
    )
  }, [
    viewMode,
    runtimeRows,
    buildArgRows,
    rawRuntimeText,
    rawBuildArgsText,
    initialEnv,
  ])

  const handleDiscard = () => {
    setRuntimeRows(
      initialEnv.env_vars.map((v, i) => ({
        ...v,
        id: `rt-${i}-${Date.now()}`,
        revealed: false,
      }))
    )
    setBuildArgRows(
      initialEnv.build_args.map((v, i) => ({
        ...v,
        id: `ba-${i}-${Date.now()}`,
        revealed: false,
      }))
    )
    setRawRuntimeText(formatEnvString(initialEnv.env_vars))
    setRawBuildArgsText(formatEnvString(initialEnv.build_args))
    showToast("success", "Changes discarded.")
  }

  const handleSave = async () => {
    setIsSaving(true)
    try {
      const finalRuntime: EnvVar[] =
        viewMode === "form"
          ? runtimeRows
              .filter((r) => r.key.trim().length > 0)
              .map(({ key, value, is_secret }) => ({
                key: key.trim(),
                value,
                is_secret: is_secret ?? true,
              }))
          : parseEnvString(rawRuntimeText).map((v) => ({
              ...v,
              is_secret: true,
            }))

      const finalBuildArgs: EnvVar[] =
        viewMode === "form"
          ? buildArgRows
              .filter((r) => r.key.trim().length > 0)
              .map(({ key, value }) => ({
                key: key.trim(),
                value,
                is_secret: false,
              }))
          : parseEnvString(rawBuildArgsText).map((v) => ({
              ...v,
              is_secret: false,
            }))

      const updated = await api.services.updateEnv(serviceId, {
        env_vars: finalRuntime,
        build_args: finalBuildArgs,
      })

      setInitialEnv(updated)
      setRuntimeRows(
        updated.env_vars.map((v, i) => ({
          ...v,
          id: `rt-${i}-${Date.now()}`,
          revealed: false,
        }))
      )
      setBuildArgRows(
        updated.build_args.map((v, i) => ({
          ...v,
          id: `ba-${i}-${Date.now()}`,
          revealed: false,
        }))
      )
      setRawRuntimeText(formatEnvString(updated.env_vars))
      setRawBuildArgsText(formatEnvString(updated.build_args))

      showToast("success", "Environment variables saved successfully.")

      if (triggerDeployOnSave) {
        await api.services.rebuild(serviceId)
        updateServiceState({ status: "building" })
        showToast(
          "success",
          "New deployment dispatched with updated variables."
        )
      }
    } catch {
      showToast("error", "Failed to save environment variables.")
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <LoadingSkeleton variant="table" rows={4} />
      </div>
    )
  }

  if (error) {
    return (
      <ErrorCard
        title="Failed to Load Environment Variables"
        message={error.message}
        onRetry={loadEnv}
      />
    )
  }

  return (
    <div className="flex flex-col gap-6 md:gap-8">
      {/* Tab Header with View Toggle & Save bar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-heading text-lg font-semibold text-foreground">
            Environment & Secrets
          </h2>
          <p className="text-xs text-muted-foreground">
            Configure encrypted runtime environment variables and Docker image
            build arguments.
          </p>
        </div>

        {/* View Mode Switcher */}
        <div className="inline-flex rounded-md border border-border bg-muted/40 p-1">
          <button
            type="button"
            onClick={() => handleSwitchMode("form")}
            className={cn(
              "inline-flex h-10 cursor-pointer items-center gap-1.5 rounded-sm px-3 text-xs font-medium transition-colors sm:h-8",
              viewMode === "form"
                ? "border border-border bg-background font-semibold text-foreground"
                : "border border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            <TableIcon className="size-3.5" aria-hidden="true" />
            <span>Key-Value Form</span>
          </button>
          <button
            type="button"
            onClick={() => handleSwitchMode("raw")}
            className={cn(
              "inline-flex h-10 cursor-pointer items-center gap-1.5 rounded-sm px-3 text-xs font-medium transition-colors sm:h-8",
              viewMode === "raw"
                ? "border border-border bg-background font-semibold text-foreground"
                : "border border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            <FileTextIcon className="size-3.5" aria-hidden="true" />
            <span>Raw .env</span>
          </button>
        </div>
      </div>

      {/* Dirty state notification bar */}
      {isDirty && (
        <div
          role="status"
          aria-live="polite"
          className="sticky top-2 z-20 flex flex-wrap items-center justify-between gap-4 rounded-lg border border-primary/40 bg-card p-3.5"
        >
          <div className="flex items-center gap-2">
            <span
              className="size-2 animate-pulse rounded-full bg-primary"
              aria-hidden="true"
            />
            <span className="text-xs font-medium text-foreground">
              You have unsaved changes.
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <label
              htmlFor="trigger-deploy-checkbox"
              className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground select-none"
            >
              <Checkbox
                id="trigger-deploy-checkbox"
                checked={triggerDeployOnSave}
                onCheckedChange={(checked) =>
                  setTriggerDeployOnSave(Boolean(checked))
                }
              />
              <span>Trigger new deployment on save</span>
            </label>

            <Button
              variant="outline"
              onClick={handleDiscard}
              disabled={isSaving}
              className="cursor-pointer"
            >
              Discard
            </Button>

            <Button
              variant="default"
              onClick={handleSave}
              disabled={isSaving}
              className="cursor-pointer gap-2"
            >
              {isSaving ? (
                <CircleNotchIcon
                  className="size-4 animate-spin"
                  aria-hidden="true"
                />
              ) : (
                <FloppyDiskIcon className="size-4" aria-hidden="true" />
              )}
              <span>Save Changes</span>
            </Button>
          </div>
        </div>
      )}

      {/* SECTION 1: RUNTIME ENVIRONMENT VARIABLES */}
      <section
        aria-labelledby="heading-runtime-env"
        className="flex min-w-0 flex-col gap-4 overflow-hidden rounded-lg border border-border bg-card p-4 sm:p-6"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
          <div>
            <h3
              id="heading-runtime-env"
              className="font-heading text-base font-semibold text-foreground"
            >
              Runtime Environment Variables
            </h3>
            <p className="text-xs text-muted-foreground">
              Injected securely into the container environment at startup.
              Encrypted in storage via AES-256.
            </p>
          </div>

          {viewMode === "form" && (
            <Button
              variant="outline"
              onClick={handleAddRuntimeRow}
              className="cursor-pointer gap-2"
            >
              <PlusIcon className="size-4" aria-hidden="true" />
              <span>Add Variable</span>
            </Button>
          )}
        </div>

        {viewMode === "form" ? (
          runtimeRows.length === 0 ? (
            <div className="rounded-md border border-dashed border-border py-6 text-center text-xs text-muted-foreground italic">
              No runtime variables configured. Click "Add Variable" to set one.
            </div>
          ) : (
            <div className="flex min-w-0 flex-col gap-2 overflow-x-auto">
              <div className="hidden gap-3 px-3 py-1 font-mono text-xs font-semibold text-muted-foreground sm:grid sm:grid-cols-12">
                <span className="col-span-5">Key</span>
                <span className="col-span-5">Value</span>
                <span className="col-span-2 text-right">Actions</span>
              </div>

              {runtimeRows.map((row) => (
                <div
                  key={row.id}
                  className="grid grid-cols-1 items-center gap-2 rounded-md border border-border bg-background p-2.5 sm:grid-cols-12 sm:gap-3"
                >
                  <div className="sm:col-span-5">
                    <Input
                      type="text"
                      placeholder="DATABASE_URL"
                      value={row.key}
                      onChange={(e) =>
                        handleUpdateRuntimeRow(row.id, "key", e.target.value)
                      }
                      className="font-mono text-xs uppercase"
                      aria-label="Variable key"
                    />
                  </div>

                  <div className="relative sm:col-span-5">
                    <Input
                      type={row.revealed ? "text" : "password"}
                      placeholder="postgres://user:pass@host:5432/db"
                      value={row.value}
                      onChange={(e) =>
                        handleUpdateRuntimeRow(row.id, "value", e.target.value)
                      }
                      className="pr-9 font-mono text-xs"
                      aria-label="Variable value"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        handleUpdateRuntimeRow(
                          row.id,
                          "revealed",
                          !row.revealed
                        )
                      }
                      className="absolute top-1/2 right-2.5 -translate-y-1/2 cursor-pointer p-0.5 text-muted-foreground hover:text-foreground"
                      title={row.revealed ? "Mask secret" : "Reveal plaintext"}
                      aria-label={row.revealed ? "Mask value" : "Reveal value"}
                    >
                      {row.revealed ? (
                        <EyeSlashIcon className="size-4" />
                      ) : (
                        <EyeIcon className="size-4" />
                      )}
                    </button>
                  </div>

                  <div className="flex items-center justify-end gap-1 sm:col-span-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteRuntimeRow(row.id)}
                      className="cursor-pointer text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      aria-label={`Delete ${row.key || "variable"}`}
                    >
                      <TrashIcon className="size-3.5" aria-hidden="true" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )
        ) : (
          <div className="flex flex-col gap-2">
            <EnvCodeEditor
              rows={8}
              value={rawRuntimeText}
              onChange={setRawRuntimeText}
              placeholder="DATABASE_URL=postgres://...\nAPI_SECRET=sk_live_..."
              ariaLabel="Raw runtime environment variables"
            />
            <span className="text-2xs text-muted-foreground">
              Enter one pair per line formatted as{" "}
              <code className="font-mono">KEY=VALUE</code>. Lines starting with{" "}
              <code className="font-mono">#</code> are ignored.
            </span>
          </div>
        )}
      </section>

      {/* SECTION 2: DOCKER BUILD ARGUMENTS */}
      <section
        aria-labelledby="heading-build-args"
        className="flex min-w-0 flex-col gap-4 overflow-hidden rounded-lg border border-border bg-card p-4 sm:p-6"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
          <div>
            <h3
              id="heading-build-args"
              className="font-heading text-base font-semibold text-foreground"
            >
              Docker Build Arguments
            </h3>
            <p className="text-xs text-muted-foreground">
              Passed during{" "}
              <code className="font-mono">docker build --build-arg</code>. Baked
              directly into image layers.
            </p>
          </div>

          {viewMode === "form" && (
            <Button
              variant="outline"
              onClick={handleAddBuildArgRow}
              className="cursor-pointer gap-2"
            >
              <PlusIcon className="size-4" aria-hidden="true" />
              <span>Add Build Argument</span>
            </Button>
          )}
        </div>

        {/* Warning Notification Box */}
        <div className="flex items-start gap-3 rounded-md border border-status-queued-border bg-status-queued-bg p-3.5 text-xs text-status-queued-text">
          <WarningIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <div className="flex flex-col gap-0.5">
            <span className="font-semibold">
              Security Notice Regarding Build Arguments
            </span>
            <p className="leading-relaxed">
              Build arguments are baked into the Docker image layers and must
              not contain production database credentials or private keys.
            </p>
          </div>
        </div>

        {viewMode === "form" ? (
          buildArgRows.length === 0 ? (
            <div className="rounded-md border border-dashed border-border py-6 text-center text-xs text-muted-foreground italic">
              No build arguments configured. Click "Add Build Argument" to set
              one.
            </div>
          ) : (
            <div className="flex min-w-0 flex-col gap-2 overflow-x-auto">
              <div className="hidden gap-3 px-3 py-1 font-mono text-xs font-semibold text-muted-foreground sm:grid sm:grid-cols-12">
                <span className="col-span-5">Argument Key</span>
                <span className="col-span-5">Value</span>
                <span className="col-span-2 text-right">Actions</span>
              </div>

              {buildArgRows.map((row) => (
                <div
                  key={row.id}
                  className="grid grid-cols-1 items-center gap-2 rounded-md border border-border bg-background p-2.5 sm:grid-cols-12 sm:gap-3"
                >
                  <div className="sm:col-span-5">
                    <Input
                      type="text"
                      placeholder="NODE_ENV"
                      value={row.key}
                      onChange={(e) =>
                        handleUpdateBuildArgRow(row.id, "key", e.target.value)
                      }
                      className="font-mono text-xs uppercase"
                      aria-label="Build argument key"
                    />
                  </div>

                  <div className="relative sm:col-span-5">
                    <Input
                      type={row.revealed ? "text" : "password"}
                      placeholder="production"
                      value={row.value}
                      onChange={(e) =>
                        handleUpdateBuildArgRow(row.id, "value", e.target.value)
                      }
                      className="pr-9 font-mono text-xs"
                      aria-label="Build argument value"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        handleUpdateBuildArgRow(
                          row.id,
                          "revealed",
                          !row.revealed
                        )
                      }
                      className="absolute top-1/2 right-2.5 -translate-y-1/2 cursor-pointer p-0.5 text-muted-foreground hover:text-foreground"
                      title={row.revealed ? "Mask value" : "Reveal plaintext"}
                      aria-label={row.revealed ? "Mask value" : "Reveal value"}
                    >
                      {row.revealed ? (
                        <EyeSlashIcon className="size-4" />
                      ) : (
                        <EyeIcon className="size-4" />
                      )}
                    </button>
                  </div>

                  <div className="flex items-center justify-end gap-1 sm:col-span-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteBuildArgRow(row.id)}
                      className="cursor-pointer text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      aria-label={`Delete ${row.key || "argument"}`}
                    >
                      <TrashIcon className="size-3.5" aria-hidden="true" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )
        ) : (
          <div className="flex flex-col gap-2">
            <EnvCodeEditor
              rows={5}
              value={rawBuildArgsText}
              onChange={setRawBuildArgsText}
              placeholder="NODE_ENV=production\nNEXT_PUBLIC_APP_URL=https://..."
              ariaLabel="Raw build arguments"
            />
            <span className="text-2xs text-muted-foreground">
              Enter one build argument per line formatted as{" "}
              <code className="font-mono">KEY=VALUE</code>.
            </span>
          </div>
        )}
      </section>
    </div>
  )
}
