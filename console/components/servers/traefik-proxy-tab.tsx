"use client"

import * as React from "react"
import {
  ShieldCheck,
  ArrowsClockwiseIcon,
  FloppyDisk,
  ArrowCounterClockwise,
  Code,
  Info,
  CircleNotchIcon,
  CaretDown,
  CaretRight,
  Plus,
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
import {
  api,
  ApiError,
  type ServerDetail,
  type ServerTraefikConfig,
} from "@/lib/api"
import {
  YamlCodeEditor,
  validateYamlClientSide,
  type YamlValidationError,
} from "@/components/editor/yaml-code-editor"
import { cn } from "@/lib/utils"

export function TraefikRestartDialogContent({
  serverName,
  onConfirm,
  onCancel,
  isRestarting,
}: {
  serverName: string
  onConfirm: () => Promise<void>
  onCancel: () => void
  isRestarting: boolean
}) {
  return (
    <div className="flex flex-col gap-4 text-foreground">
      <DialogHeader>
        <DialogTitle>Restart Traefik Proxy</DialogTitle>
        <DialogDescription>
          {`Restart reverse proxy container on ${serverName}.`}
        </DialogDescription>
      </DialogHeader>

      <div className="rounded-md border border-border bg-muted/30 p-3 text-xs leading-relaxed text-muted-foreground">
        <p>
          Traefik hot-reloads dynamic rules in `custom.yaml` and `tako.yml`
          automatically without restarting.
        </p>
        <p className="mt-2 font-medium text-foreground">
          Restarting the container is only necessary when static ports or core
          ACME resolvers change. Active incoming requests may briefly be
          affected.
        </p>
      </div>

      <div className="flex items-center justify-end gap-2 border-t border-border pt-4">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={isRestarting}
        >
          Cancel
        </Button>
        <Button type="button" onClick={onConfirm} disabled={isRestarting}>
          {isRestarting ? (
            <>
              <CircleNotchIcon className="size-4 animate-spin" />
              <span>Restarting Proxy...</span>
            </>
          ) : (
            <span>Confirm & Restart</span>
          )}
        </Button>
      </div>
    </div>
  )
}

export function TraefikRestartDialog({
  open,
  onOpenChange,
  serverName,
  onConfirm,
  isRestarting,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  serverName: string
  onConfirm: () => Promise<void>
  isRestarting: boolean
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        <TraefikRestartDialogContent
          serverName={serverName}
          onConfirm={onConfirm}
          onCancel={() => onOpenChange(false)}
          isRestarting={isRestarting}
        />
      </DialogContent>
    </Dialog>
  )
}

const TEMPLATES: { label: string; snippet: string }[] = [
  {
    label: "Rate Limiting",
    snippet: `\n    custom-ratelimit:\n      rateLimit:\n        average: 100\n        burst: 50\n`,
  },
  {
    label: "Security Headers",
    snippet: `\n    security-headers:\n      headers:\n        sslRedirect: true\n        stsSeconds: 31536000\n        browserXssFilter: true\n        contentTypeNosniff: true\n`,
  },
  {
    label: "CORS Headers",
    snippet: `\n    cors-headers:\n      headers:\n        accessControlAllowMethods:\n          - GET\n          - POST\n          - OPTIONS\n        accessControlAllowOriginList:\n          - "*"\n        accessControlMaxAge: 100\n`,
  },
  {
    label: "Basic Auth",
    snippet: `\n    admin-auth:\n      basicAuth:\n        users:\n          - "admin:$apr1$H6uskkkW$IgXLP6ewTrSuBkTrqE8wj/"\n`,
  },
]

export interface TraefikProxyTabProps {
  server: ServerDetail
  showToast: (type: "success" | "error", message: string) => void
}

export function TraefikProxyTab({ server, showToast }: TraefikProxyTabProps) {
  const [config, setConfig] = React.useState<ServerTraefikConfig | null>(null)
  const [customYaml, setCustomYaml] = React.useState<string>("")
  const [savedYaml, setSavedYaml] = React.useState<string>("")
  const [isLoading, setIsLoading] = React.useState(true)
  const [isSaving, setIsSaving] = React.useState(false)
  const [isRestarting, setIsRestarting] = React.useState(false)
  const [restartDialogOpen, setRestartDialogOpen] = React.useState(false)
  const [staticOpen, setStaticOpen] = React.useState(false)
  const [error, setError] = React.useState<Error | null>(null)

  const fetchConfig = React.useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const data = await api.servers.getTraefikConfig(server.id)
      setConfig(data)
      setCustomYaml(data.custom_yaml || "")
      setSavedYaml(data.custom_yaml || "")
    } catch (err) {
      if (err instanceof Error) {
        setError(err)
      } else {
        setError(
          new Error(`Failed to load Traefik configuration for ${server.id}.`)
        )
      }
    } finally {
      setIsLoading(false)
    }
  }, [server.id])

  React.useEffect(() => {
    fetchConfig()
  }, [fetchConfig])

  // Client side validation
  const validationErrors: YamlValidationError[] = React.useMemo(() => {
    return validateYamlClientSide(customYaml)
  }, [customYaml])

  const hasErrors = validationErrors.length > 0
  const isDirty = customYaml !== savedYaml

  const handleSave = async () => {
    if (hasErrors) {
      showToast("error", "Fix YAML formatting issues before saving.")
      return
    }
    setIsSaving(true)
    try {
      const updated = await api.servers.updateTraefikConfig(server.id, {
        custom_yaml: customYaml,
      })
      setConfig(updated)
      setSavedYaml(updated.custom_yaml)
      showToast("success", "Custom dynamic configuration saved and reloaded.")
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : "Failed to update Traefik configuration."
      showToast("error", msg)
    } finally {
      setIsSaving(false)
    }
  }

  const handleDiscard = () => {
    setCustomYaml(savedYaml)
  }

  const handleInsertTemplate = (snippet: string) => {
    if (!customYaml.includes("http:")) {
      setCustomYaml((prev) => prev + `http:\n  middlewares:${snippet}`)
    } else if (!customYaml.includes("middlewares:")) {
      setCustomYaml((prev) =>
        prev.replace("http:", `http:\n  middlewares:${snippet}`)
      )
    } else {
      setCustomYaml((prev) =>
        prev.replace("middlewares:", `middlewares:${snippet}`)
      )
    }
  }

  const handleRestartProxy = async () => {
    setIsRestarting(true)
    try {
      await api.servers.restartTraefik(server.id)
      setRestartDialogOpen(false)
      showToast("success", "Traefik proxy container restarted successfully.")
      await fetchConfig()
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : "Failed to restart Traefik proxy container."
      showToast("error", msg)
    } finally {
      setIsRestarting(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6">
        <LoadingSkeleton variant="card" count={2} />
        <LoadingSkeleton variant="table" rows={6} />
      </div>
    )
  }

  if (error || !config) {
    return (
      <ErrorCard
        error={error ?? new Error("Traefik configuration unavailable")}
        title="Configuration Error"
        onRetry={fetchConfig}
      />
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Proxy Status Bar */}
      <div className="flex flex-col gap-4 rounded-lg border border-border bg-card p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-md border border-border bg-muted text-foreground">
            <ShieldCheck className="size-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-heading text-base font-semibold text-foreground">
                Traefik Ingress Proxy
              </h2>
              <StatusBadge
                variant={server.status === "online" ? "running" : "stopped"}
                showDot
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Edge routing and SSL termination with automated ACME certificate
              management.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="hidden rounded-md border border-border bg-muted/60 px-2.5 py-1 font-mono text-2xs text-muted-foreground sm:inline-flex">
            File Provider: Watching /etc/traefik/dynamic
          </span>
          <Button
            variant="outline"
            onClick={() => setRestartDialogOpen(true)}
            className="gap-2"
          >
            <ArrowsClockwiseIcon className="size-4" />
            <span>Restart Proxy</span>
          </Button>
        </div>
      </div>

      {/* Isolation Architecture Notice */}
      <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/20 p-4 text-xs leading-relaxed text-muted-foreground">
        <Info className="mt-0.5 size-5 shrink-0 text-foreground/80" />
        <div className="space-y-1">
          <p className="font-medium text-foreground">
            Strict Configuration Separation
          </p>
          <p>
            Automated service routes are written to{" "}
            <span className="font-mono text-foreground">
              /etc/traefik/dynamic/tako.yml
            </span>{" "}
            during deployments. Custom routing rules and middlewares below are
            saved to{" "}
            <span className="font-mono text-foreground">
              /etc/traefik/dynamic/custom.yaml
            </span>
            . Both files are monitored concurrently by Traefik without
            collision.
          </p>
        </div>
      </div>

      {/* Custom Dynamic Configuration Editor */}
      <div className="rounded-lg border border-border bg-card p-5">
        <div className="flex flex-col gap-2 border-b border-border pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Code className="size-4 text-muted-foreground" />
              <h3 className="font-heading text-base font-semibold text-foreground">
                Custom Dynamic Configuration
              </h3>
            </div>
            <p className="mt-0.5 font-mono text-xs text-muted-foreground">
              /etc/traefik/dynamic/custom.yaml
            </p>
          </div>

          {/* Quick Snippet Inserts */}
          <div className="flex flex-wrap items-center gap-1.5 pt-2 sm:pt-0">
            <span className="mr-1 text-2xs text-muted-foreground">
              Insert middleware:
            </span>
            {TEMPLATES.map((tpl) => (
              <Button
                key={tpl.label}
                type="button"
                variant="outline"
                size="xs"
                onClick={() => handleInsertTemplate(tpl.snippet)}
                className="h-7 cursor-pointer gap-1 px-2 text-2xs"
              >
                <Plus className="size-3" />
                <span>{tpl.label}</span>
              </Button>
            ))}
          </div>
        </div>

        {/* Editor */}
        <div className="mt-4">
          <YamlCodeEditor
            value={customYaml}
            onChange={setCustomYaml}
            rows={14}
            validationErrors={validationErrors}
            placeholder={`http:\n  middlewares:\n    sample-headers:\n      headers:\n        sslRedirect: true\n`}
          />
        </div>

        {/* Editor Action Footer */}
        <div className="mt-4 flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-xs">
            {hasErrors ? (
              <span className="font-medium text-destructive">
                Invalid syntax: {validationErrors.length} issue(s) must be
                resolved.
              </span>
            ) : isDirty ? (
              <span className="font-medium text-amber-500">
                Unsaved changes pending. Click Save to apply atomically.
              </span>
            ) : (
              <span className="text-muted-foreground">
                Configuration is in sync with host node.
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleDiscard}
              disabled={!isDirty || isSaving}
              className="h-10 gap-1.5"
            >
              <ArrowCounterClockwise className="size-4" />
              <span>Discard Changes</span>
            </Button>

            <Button
              type="button"
              size="sm"
              onClick={handleSave}
              disabled={!isDirty || hasErrors || isSaving}
              className="h-10 gap-1.5"
            >
              {isSaving ? (
                <>
                  <CircleNotchIcon className="size-4 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <FloppyDisk className="size-4" />
                  <span>Save Configuration</span>
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Static Configuration Viewer (Collapsible) */}
      <div className="rounded-lg border border-border bg-card p-5">
        <button
          type="button"
          onClick={() => setStaticOpen((prev) => !prev)}
          className="flex w-full cursor-pointer items-center justify-between text-left select-none"
          aria-expanded={staticOpen}
        >
          <div className="flex items-center gap-2">
            {staticOpen ? (
              <CaretDown className="size-4 text-muted-foreground" />
            ) : (
              <CaretRight className="size-4 text-muted-foreground" />
            )}
            <div>
              <h3 className="font-heading text-sm font-semibold text-foreground">
                Static Traefik Configuration (Read-only)
              </h3>
              <p className="font-mono text-xs text-muted-foreground">
                /etc/traefik/traefik.yaml
              </p>
            </div>
          </div>
          <span className="rounded-md border border-border bg-muted/50 px-2 py-0.5 text-xs text-muted-foreground">
            {staticOpen ? "Hide" : "View"}
          </span>
        </button>

        {staticOpen && (
          <div className="mt-4 border-t border-border pt-4">
            <p className="mb-3 text-xs text-muted-foreground">
              This configuration defines Traefik entryPoints (:80, :443), file
              provider directory watchers, and ACME certificate resolver
              settings.
            </p>
            <YamlCodeEditor
              value={config.static_yaml}
              onChange={() => {}}
              readOnly
              rows={12}
            />
          </div>
        )}
      </div>

      {/* Restart Proxy Confirmation Dialog */}
      <TraefikRestartDialog
        open={restartDialogOpen}
        onOpenChange={setRestartDialogOpen}
        serverName={server.name}
        onConfirm={handleRestartProxy}
        isRestarting={isRestarting}
      />
    </div>
  )
}
