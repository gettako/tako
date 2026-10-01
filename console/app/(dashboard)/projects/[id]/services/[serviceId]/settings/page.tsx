"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import {
  GearIcon,
  FloppyDiskIcon,
  CircleNotchIcon,
  TrashIcon,
  ArrowCounterClockwiseIcon,
  GitBranchIcon,
  GlobeIcon,
  TerminalIcon,
  HardDrivesIcon,
  WarningCircleIcon,
  LightningIcon,
  LinkSimpleIcon,
  GithubLogoIcon,
  CaretDownIcon,
} from "@phosphor-icons/react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { CopyButton } from "@/components/ui/copy-button"
import { LoadingSkeleton } from "@/components/states/loading-skeleton"
import { ErrorCard } from "@/components/states/error-card"
import { useService } from "@/components/services/service-context"
import { DeleteServiceDialog } from "@/components/services/delete-service-dialog"
import { api, type UpdateServiceRequest, type ServiceType } from "@/lib/api"
import { cn } from "@/lib/utils"

export default function ServiceSettingsPage() {
  const router = useRouter()
  const {
    service,
    serviceId,
    projectId,
    isLoading,
    error,
    refetch,
    updateServiceState,
    showToast,
  } = useService()

  // Form states
  const [name, setName] = React.useState("")
  const [serviceType, setServiceType] = React.useState<ServiceType>("web")
  const [branch, setBranch] = React.useState("")
  const [dockerfilePath, setDockerfilePath] = React.useState("")
  const [internalPort, setInternalPort] = React.useState("")
  const [publishedPort, setPublishedPort] = React.useState("")
  const [healthCheckPath, setHealthCheckPath] = React.useState("")
  const [command, setCommand] = React.useState("")
  const [preDeployCommand, setPreDeployCommand] = React.useState("")
  const [postDeployCommand, setPostDeployCommand] = React.useState("")
  const [autoDeploy, setAutoDeploy] = React.useState(false)
  const [triggerOnPush, setTriggerOnPush] = React.useState(true)
  const [triggerOnTag, setTriggerOnTag] = React.useState(false)
  const [tagPattern, setTagPattern] = React.useState("*")
  const [volumeName, setVolumeName] = React.useState("")
  const [volumeMountPath, setVolumeMountPath] = React.useState("")

  // UI state
  const [isSaving, setIsSaving] = React.useState(false)
  const [triggerDeployOnSave, setTriggerDeployOnSave] = React.useState(true)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false)
  const [webhookUrl, setWebhookUrl] = React.useState("")

  // Sync form with service state
  React.useEffect(() => {
    if (service) {
      setName(service.name || "")
      setServiceType(service.service_type || "web")
      setBranch(service.branch || "")
      setDockerfilePath(service.dockerfile_path || "Dockerfile")
      setInternalPort(
        service.internal_port ? String(service.internal_port) : ""
      )
      setPublishedPort(
        service.published_port ? String(service.published_port) : ""
      )
      setHealthCheckPath(service.health_check_path || "")
      setCommand(service.command || "")
      setPreDeployCommand(service.pre_deploy_command || "")
      setPostDeployCommand(service.post_deploy_command || "")
      const pushEnabled = service.trigger_on_push ?? service.auto_deploy ?? true
      setAutoDeploy(pushEnabled)
      setTriggerOnPush(pushEnabled)
      setTriggerOnTag(service.trigger_on_tag ?? false)
      setTagPattern(service.tag_pattern || "*")
      setVolumeName(service.volume_name || "")
      setVolumeMountPath(service.volume_mount_path || "")
    }
  }, [service])

  React.useEffect(() => {
    if (typeof window !== "undefined" && serviceId) {
      setWebhookUrl(
        `${window.location.origin}/api/services/${serviceId}/webhook`
      )
    }
  }, [serviceId])

  const isDatabase = service?.service_type === "database"
  const isCompose = service?.service_type === "compose"
  const canSwitchType =
    service?.service_type === "web" || service?.service_type === "worker"

  const isWorker = serviceType === "worker"

  // Check validity
  const isValid = React.useMemo(() => {
    if (name.trim().length < 2) return false
    if (!isWorker && !isDatabase && !isCompose) {
      const port = Number(internalPort)
      if (isNaN(port) || port < 1 || port > 65535) return false
    }
    if (publishedPort.trim().length > 0) {
      const pubPort = Number(publishedPort)
      if (isNaN(pubPort) || pubPort < 1 || pubPort > 65535) return false
    }
    return true
  }, [name, isWorker, isDatabase, isCompose, internalPort, publishedPort])

  // Check dirty state
  const isDirty = React.useMemo(() => {
    if (!service) return false
    if (name.trim() !== (service.name || "").trim()) return true
    if (serviceType !== (service.service_type || "web")) return true
    if (branch.trim() !== (service.branch || "").trim()) return true
    if (
      dockerfilePath.trim() !== (service.dockerfile_path || "Dockerfile").trim()
    )
      return true
    const currentInternal = service.internal_port
      ? String(service.internal_port)
      : ""
    if (internalPort.trim() !== currentInternal.trim()) return true
    const currentPublished = service.published_port
      ? String(service.published_port)
      : ""
    if (publishedPort.trim() !== currentPublished.trim()) return true
    if (healthCheckPath.trim() !== (service.health_check_path || "").trim())
      return true
    if (command.trim() !== (service.command || "").trim()) return true
    if (preDeployCommand.trim() !== (service.pre_deploy_command || "").trim())
      return true
    if (postDeployCommand.trim() !== (service.post_deploy_command || "").trim())
      return true
    const currentPush = service.trigger_on_push ?? service.auto_deploy ?? true
    if (triggerOnPush !== currentPush) return true
    if (triggerOnTag !== (service.trigger_on_tag ?? false)) return true
    if (tagPattern.trim() !== (service.tag_pattern || "*").trim()) return true
    if (volumeName.trim() !== (service.volume_name || "").trim()) return true
    if (volumeMountPath.trim() !== (service.volume_mount_path || "").trim())
      return true
    return false
  }, [
    service,
    name,
    serviceType,
    branch,
    dockerfilePath,
    internalPort,
    publishedPort,
    healthCheckPath,
    command,
    preDeployCommand,
    postDeployCommand,
    triggerOnPush,
    triggerOnTag,
    tagPattern,
    volumeName,
    volumeMountPath,
  ])

  const handleDiscard = () => {
    if (!service) return
    setName(service.name || "")
    setServiceType(service.service_type || "web")
    setBranch(service.branch || "")
    setDockerfilePath(service.dockerfile_path || "Dockerfile")
    setInternalPort(service.internal_port ? String(service.internal_port) : "")
    setPublishedPort(
      service.published_port ? String(service.published_port) : ""
    )
    setHealthCheckPath(service.health_check_path || "")
    setCommand(service.command || "")
    setPreDeployCommand(service.pre_deploy_command || "")
    setPostDeployCommand(service.post_deploy_command || "")
    const pushEnabled = service.trigger_on_push ?? service.auto_deploy ?? true
    setAutoDeploy(pushEnabled)
    setTriggerOnPush(pushEnabled)
    setTriggerOnTag(service.trigger_on_tag ?? false)
    setTagPattern(service.tag_pattern || "*")
    setVolumeName(service.volume_name || "")
    setVolumeMountPath(service.volume_mount_path || "")
    showToast("success", "Changes discarded.")
  }

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!isValid || !isDirty || isSaving || !serviceId) return

    setIsSaving(true)
    try {
      const payload: UpdateServiceRequest = {
        name: name.trim(),
        branch: branch.trim() || undefined,
        dockerfile_path: dockerfilePath.trim() || undefined,
        auto_deploy: triggerOnPush,
        trigger_on_push: triggerOnPush,
        trigger_on_tag: triggerOnTag,
        tag_pattern: tagPattern.trim() || "*",
        command: command.trim() || undefined,
        pre_deploy_command: preDeployCommand.trim() || undefined,
        post_deploy_command: postDeployCommand.trim() || undefined,
        volume_name: volumeName.trim() || undefined,
        volume_mount_path: volumeMountPath.trim() || undefined,
      }

      if (canSwitchType) {
        payload.service_type = serviceType
      }

      if (isWorker) {
        payload.internal_port = 0
        payload.health_check_path = ""
        payload.published_port = null
      } else if (!isDatabase && !isCompose) {
        payload.internal_port = parseInt(internalPort, 10)
        payload.health_check_path = healthCheckPath.trim() || "/healthz"
        payload.published_port = publishedPort.trim()
          ? parseInt(publishedPort, 10)
          : null
      }

      const updated = await api.services.update(serviceId, payload)
      updateServiceState(updated)
      showToast("success", "Service settings updated successfully.")

      if (triggerDeployOnSave && !isDatabase && !isCompose) {
        try {
          await api.services.rebuild(serviceId)
          updateServiceState({ status: "building" })
          showToast("success", "Deployment dispatched with updated settings.")
        } catch {
          showToast(
            "error",
            "Settings saved, but failed to trigger automatic redeploy."
          )
        }
      }

      await refetch()
    } catch {
      showToast("error", "Failed to update service settings. Please try again.")
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6">
        <LoadingSkeleton variant="table" rows={4} />
      </div>
    )
  }

  if (error || !service) {
    return (
      <ErrorCard
        title="Failed to Load Service Settings"
        message={error?.message || "Service details could not be retrieved."}
        onRetry={refetch}
      />
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Settings Header with Actions */}
      <div className="flex flex-col gap-4 rounded-md border border-border bg-card p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-md border border-border bg-muted/50 text-foreground">
            <GearIcon className="size-5" aria-hidden="true" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-foreground">
              Service Settings
            </h2>
            <p className="text-xs text-muted-foreground">
              Configure runtime parameters, networking, build specifications,
              and lifecycle hooks.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleDiscard}
            disabled={!isDirty || isSaving}
            className="cursor-pointer gap-1.5"
          >
            <ArrowCounterClockwiseIcon
              className="size-3.5"
              aria-hidden="true"
            />
            <span>Discard</span>
          </Button>

          <Button
            type="button"
            variant="default"
            size="sm"
            onClick={() => handleSave()}
            disabled={!isDirty || !isValid || isSaving}
            className="cursor-pointer gap-1.5"
          >
            {isSaving ? (
              <>
                <CircleNotchIcon
                  className="size-3.5 animate-spin"
                  aria-hidden="true"
                />
                <span>Saving...</span>
              </>
            ) : (
              <>
                <FloppyDiskIcon className="size-3.5" aria-hidden="true" />
                <span>Save Changes</span>
              </>
            )}
          </Button>
        </div>
      </div>

      <form onSubmit={handleSave} className="flex flex-col gap-6">
        {/* Redeploy Checkbox Banner */}
        {!isDatabase && !isCompose && (
          <div className="flex items-center gap-2 rounded-md border border-border bg-muted/30 px-4 py-3">
            <Checkbox
              id="redeploy-on-save"
              checked={triggerDeployOnSave}
              onCheckedChange={(checked) =>
                setTriggerDeployOnSave(checked === true)
              }
            />
            <label
              htmlFor="redeploy-on-save"
              className="cursor-pointer text-xs font-medium text-foreground select-none"
            >
              Automatically redeploy service after saving changes
            </label>
          </div>
        )}

        {/* Section 1: General & Service Type */}
        <div className="flex flex-col gap-4 rounded-md border border-border bg-card p-5">
          <div className="border-b border-border pb-3">
            <h3 className="text-sm font-semibold text-foreground">
              General Configuration
            </h3>
            <p className="text-xs text-muted-foreground">
              Service identification and execution profile.
            </p>
          </div>

          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="service-name"
                className="text-xs font-medium text-foreground"
              >
                Service Name <span className="text-destructive">*</span>
              </label>
              <Input
                id="service-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. web-api"
              />
              <p className="text-2xs text-muted-foreground">
                Unique identifier used across logs, routing, and container tags.
              </p>
            </div>

            {canSwitchType && (
              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-foreground">
                  Service Type
                </span>
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => setServiceType("web")}
                    className={cn(
                      "flex min-h-12 cursor-pointer flex-col items-start rounded-md border p-3.5 text-left transition-colors",
                      serviceType === "web"
                        ? "border-ring bg-muted/40 ring-1 ring-ring"
                        : "border-input bg-card text-muted-foreground hover:border-foreground/30 hover:text-foreground"
                    )}
                  >
                    <span className="text-xs font-semibold text-foreground">
                      Web / API
                    </span>
                    <span className="text-2xs text-muted-foreground">
                      HTTP application exposed via internal port, reverse proxy,
                      or direct port mapping.
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setServiceType("worker")}
                    className={cn(
                      "flex min-h-12 cursor-pointer flex-col items-start rounded-md border p-3.5 text-left transition-colors",
                      serviceType === "worker"
                        ? "border-ring bg-muted/40 ring-1 ring-ring"
                        : "border-input bg-card text-muted-foreground hover:border-foreground/30 hover:text-foreground"
                    )}
                  >
                    <span className="text-xs font-semibold text-foreground">
                      Worker
                    </span>
                    <span className="text-2xs text-muted-foreground">
                      Background process, job consumer, or queue runner. No HTTP
                      port or health check.
                    </span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Section 2: Source & Build Configuration */}
        {!isDatabase && !isCompose && (
          <div className="flex flex-col gap-4 rounded-md border border-border bg-card p-5">
            <div className="flex items-center gap-2 border-b border-border pb-3">
              <GitBranchIcon
                className="size-4 text-foreground"
                aria-hidden="true"
              />
              <div>
                <h3 className="text-sm font-semibold text-foreground">
                  Source & Build Configuration
                </h3>
                <p className="text-xs text-muted-foreground">
                  Repository branch and Docker build context paths.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="git-branch"
                  className="text-xs font-medium text-foreground"
                >
                  Git Branch
                </label>
                <Input
                  id="git-branch"
                  value={branch}
                  onChange={(e) => setBranch(e.target.value)}
                  placeholder="main"
                />
                <p className="text-2xs text-muted-foreground">
                  The Git branch monitored for builds and webhook triggers.
                </p>
              </div>

              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="dockerfile-path"
                  className="text-xs font-medium text-foreground"
                >
                  Dockerfile Path
                </label>
                <Input
                  id="dockerfile-path"
                  value={dockerfilePath}
                  onChange={(e) => setDockerfilePath(e.target.value)}
                  placeholder="Dockerfile"
                />
                <p className="text-2xs text-muted-foreground">
                  Relative path to the Dockerfile inside the repository root.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Section: Deployment Triggers */}
        {!isDatabase && !isCompose && (
          <div className="flex flex-col gap-4 rounded-md border border-border bg-card p-5">
            <div className="flex items-center gap-2 border-b border-border pb-3">
              <LightningIcon
                className="size-4 text-foreground"
                aria-hidden="true"
              />
              <div>
                <h3 className="text-sm font-semibold text-foreground">
                  Deployment Triggers
                </h3>
                <p className="text-xs text-muted-foreground">
                  Automate deployments when code or tags are pushed to your
                  repository.
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-4">
              {/* GitHub App Automatic Sync Banner */}
              <div className="flex items-start gap-3 rounded-md border border-emerald-500/30 bg-emerald-500/10 p-3.5">
                <GithubLogoIcon className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                <div className="flex flex-1 flex-col gap-0.5">
                  <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                    GitHub App Auto-Deploy Active
                  </span>
                  <p className="text-2xs leading-relaxed text-muted-foreground">
                    Once your GitHub App is connected in Settings &gt; GitHub,
                    commits and tags pushed to GitHub trigger deployments
                    automatically. No manual repository webhook configuration in
                    GitHub is required.
                  </p>
                </div>
              </div>

              {/* Trigger on Push */}
              <div className="flex items-start gap-3 rounded-md border border-border bg-muted/20 p-3.5">
                <Checkbox
                  id="auto-deploy"
                  checked={triggerOnPush}
                  onCheckedChange={(checked) => {
                    setTriggerOnPush(checked === true)
                    setAutoDeploy(checked === true)
                  }}
                  className="mt-0.5"
                />
                <div className="flex flex-1 flex-col gap-1">
                  <label
                    htmlFor="auto-deploy"
                    className="cursor-pointer text-xs font-semibold text-foreground select-none"
                  >
                    Trigger on git push
                  </label>
                  <p className="text-2xs text-muted-foreground">
                    Automatically build and deploy when new commits are pushed
                    to{" "}
                    <code className="rounded bg-muted px-1.5 py-0.5 font-mono font-medium text-foreground">
                      {branch.trim() || "main"}
                    </code>
                    .
                  </p>
                </div>
              </div>

              {/* Trigger on Tag */}
              <div className="flex flex-col gap-3 rounded-md border border-border bg-muted/20 p-3.5">
                <div className="flex items-start gap-3">
                  <Checkbox
                    id="trigger-on-tag"
                    checked={triggerOnTag}
                    onCheckedChange={(checked) =>
                      setTriggerOnTag(checked === true)
                    }
                    className="mt-0.5"
                  />
                  <div className="flex flex-1 flex-col gap-1">
                    <label
                      htmlFor="trigger-on-tag"
                      className="cursor-pointer text-xs font-semibold text-foreground select-none"
                    >
                      Trigger on git tag
                    </label>
                    <p className="text-2xs text-muted-foreground">
                      Automatically build and deploy when a git tag matching the
                      pattern is pushed.
                    </p>
                  </div>
                </div>

                {triggerOnTag && (
                  <div className="ml-7 flex flex-col gap-1.5 border-t border-border/60 pt-3">
                    <label
                      htmlFor="tag-pattern"
                      className="text-xs font-medium text-foreground"
                    >
                      Tag Pattern
                    </label>
                    <div className="flex flex-col gap-1 sm:max-w-xs">
                      <Input
                        id="tag-pattern"
                        value={tagPattern}
                        onChange={(e) => setTagPattern(e.target.value)}
                        placeholder="e.g. v* or *"
                        className="h-8 font-mono text-xs"
                      />
                      <p className="text-3xs text-muted-foreground">
                        Supports wildcards:{" "}
                        <code className="font-mono">v*</code> for releases (e.g.
                        v1.0.0), or <code className="font-mono">*</code> for all
                        tags.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Service Webhook Configuration */}
              <div className="flex flex-col gap-2.5 rounded-md border border-border bg-muted/30 p-3.5">
                <div className="flex items-center gap-2">
                  <LinkSimpleIcon
                    className="size-4 text-foreground"
                    aria-hidden="true"
                  />
                  <span className="text-xs font-semibold text-foreground">
                    Webhook Setup for GitHub
                  </span>
                </div>
                <p className="text-2xs leading-relaxed text-muted-foreground">
                  With Tako&apos;s GitHub App connected, deployments trigger
                  automatically without any repository setup. If you are using a
                  generic repository or manual webhooks instead, use this
                  payload endpoint:
                </p>

                <div className="flex flex-col gap-1.5 pt-1">
                  <span className="text-3xs font-medium tracking-wider text-muted-foreground uppercase">
                    Payload URL
                  </span>
                  <div className="flex items-center gap-2">
                    <div className="flex flex-1 items-center overflow-x-auto rounded-md border border-border bg-card px-3 py-1.5">
                      <span className="font-mono text-xs text-foreground select-all">
                        {webhookUrl ||
                          (service?.id
                            ? `https://gettako.dev/api/services/${service.id}/webhook`
                            : "")}
                      </span>
                    </div>
                    <CopyButton
                      text={
                        webhookUrl ||
                        (service?.id
                          ? `https://gettako.dev/api/services/${service.id}/webhook`
                          : "")
                      }
                      label="Copy"
                      variant="outline"
                      size="default"
                      aria-label="Copy service webhook URL"
                      className="h-8 shrink-0 gap-1 px-2.5 text-xs"
                    />
                  </div>
                </div>

                <div className="rounded-md border border-border/80 bg-background/80 p-2.5 text-2xs text-muted-foreground">
                  <p className="font-medium text-foreground">
                    Setup instructions:
                  </p>
                  <ol className="mt-1 list-decimal space-y-1 pl-4">
                    <li>
                      In GitHub, go to your repository <strong>Settings</strong>{" "}
                      &gt; <strong>Webhooks</strong> &gt;{" "}
                      <strong>Add webhook</strong>.
                    </li>
                    <li>
                      Paste the <strong>Payload URL</strong> above.
                    </li>
                    <li>
                      Set <strong>Content type</strong> to{" "}
                      <code className="font-mono text-foreground">
                        application/json
                      </code>
                      .
                    </li>
                    <li>
                      Under events, select <strong>Just the push event</strong>{" "}
                      (delivers both branch pushes and tag pushes).
                    </li>
                  </ol>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Section 3: Networking & Routing (Only for Web Services) */}
        {!isWorker && !isDatabase && !isCompose && (
          <div className="flex flex-col gap-4 rounded-md border border-border bg-card p-5">
            <div className="flex items-center gap-2 border-b border-border pb-3">
              <GlobeIcon
                className="size-4 text-foreground"
                aria-hidden="true"
              />
              <div>
                <h3 className="text-sm font-semibold text-foreground">
                  Networking & Ingress
                </h3>
                <p className="text-xs text-muted-foreground">
                  Port configuration and container health verification.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="internal-port"
                  className="text-xs font-medium text-foreground"
                >
                  Internal Port <span className="text-destructive">*</span>
                </label>
                <Input
                  id="internal-port"
                  type="number"
                  value={internalPort}
                  onChange={(e) => setInternalPort(e.target.value)}
                  placeholder="3000"
                />
                <p className="text-2xs text-muted-foreground">
                  Port your application listens on inside the container (e.g.
                  3000, 8080).
                </p>
              </div>

              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="health-check-path"
                  className="text-xs font-medium text-foreground"
                >
                  Health Check Path
                </label>
                <Input
                  id="health-check-path"
                  value={healthCheckPath}
                  onChange={(e) => setHealthCheckPath(e.target.value)}
                  placeholder="/healthz"
                />
                <p className="text-2xs text-muted-foreground">
                  HTTP endpoint probed by Tako to verify container health before
                  traffic routing.
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="published-port"
                className="text-xs font-medium text-foreground"
              >
                Published Host Port (Optional Override)
              </label>
              <Input
                id="published-port"
                type="number"
                value={publishedPort}
                onChange={(e) => setPublishedPort(e.target.value)}
                placeholder="Leave blank for automatic port binding"
              />
              <p className="text-2xs text-muted-foreground">
                Override host port mapping (0.0.0.0:port). If omitted and no
                domain is attached, defaults to the Internal Port.
              </p>
            </div>
          </div>
        )}

        {/* Section 4: Process Commands & Lifecycle Hooks */}
        {!isDatabase && !isCompose && (
          <div className="flex flex-col gap-4 rounded-md border border-border bg-card p-5">
            <div className="flex items-center gap-2 border-b border-border pb-3">
              <TerminalIcon
                className="size-4 text-foreground"
                aria-hidden="true"
              />
              <div>
                <h3 className="text-sm font-semibold text-foreground">
                  Process & Deploy Hooks
                </h3>
                <p className="text-xs text-muted-foreground">
                  Command override and automated pre/post deployment scripts.
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="start-command"
                  className="text-xs font-medium text-foreground"
                >
                  Start Command Override
                </label>
                <Input
                  id="start-command"
                  value={command}
                  onChange={(e) => setCommand(e.target.value)}
                  placeholder={
                    isWorker
                      ? "e.g. npm run worker or python worker.py"
                      : "e.g. npm start"
                  }
                />
                <p className="text-2xs text-muted-foreground">
                  Overrides the default container CMD / Entrypoint command.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="pre-deploy"
                    className="text-xs font-medium text-foreground"
                  >
                    Pre-Deploy Command
                  </label>
                  <Input
                    id="pre-deploy"
                    value={preDeployCommand}
                    onChange={(e) => setPreDeployCommand(e.target.value)}
                    placeholder="e.g. php artisan down"
                  />
                  <p className="text-2xs text-muted-foreground">
                    Executed before the container starts.
                  </p>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="post-deploy"
                    className="text-xs font-medium text-foreground"
                  >
                    Post-Deploy Command
                  </label>
                  <Input
                    id="post-deploy"
                    value={postDeployCommand}
                    onChange={(e) => setPostDeployCommand(e.target.value)}
                    placeholder="e.g. php artisan migrate --force"
                  />
                  <p className="text-2xs text-muted-foreground">
                    Executed after the container is started and passes health
                    checks.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Section 5: Persistent Storage Volume */}
        {!isDatabase && !isCompose && (
          <div className="flex flex-col gap-4 rounded-md border border-border bg-card p-5">
            <div className="flex items-center gap-2 border-b border-border pb-3">
              <HardDrivesIcon
                className="size-4 text-foreground"
                aria-hidden="true"
              />
              <div>
                <h3 className="text-sm font-semibold text-foreground">
                  Persistent Volume (SQLite / Data)
                </h3>
                <p className="text-xs text-muted-foreground">
                  Persist SQLite files or uploads across deployments and
                  rebuilds.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="volume-name"
                  className="text-xs font-medium text-foreground"
                >
                  Volume Name
                </label>
                <Input
                  id="volume-name"
                  value={volumeName}
                  onChange={(e) => setVolumeName(e.target.value)}
                  placeholder="e.g. tako_app_data"
                />
                <p className="text-2xs text-muted-foreground">
                  Named Docker volume created on the host node.
                </p>
              </div>

              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="volume-mount"
                  className="text-xs font-medium text-foreground"
                >
                  Container Mount Path
                </label>
                <Input
                  id="volume-mount"
                  value={volumeMountPath}
                  onChange={(e) => setVolumeMountPath(e.target.value)}
                  placeholder="e.g. /app/data"
                />
                <p className="text-2xs text-muted-foreground">
                  Path inside the container where the volume will be attached.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Form Bottom Actions */}
        <div className="flex items-center justify-end gap-2 pt-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleDiscard}
            disabled={!isDirty || isSaving}
            className="cursor-pointer gap-1.5"
          >
            <ArrowCounterClockwiseIcon
              className="size-3.5"
              aria-hidden="true"
            />
            <span>Discard</span>
          </Button>

          <Button
            type="submit"
            variant="default"
            size="sm"
            disabled={!isDirty || !isValid || isSaving}
            className="cursor-pointer gap-1.5"
          >
            {isSaving ? (
              <>
                <CircleNotchIcon
                  className="size-3.5 animate-spin"
                  aria-hidden="true"
                />
                <span>Saving...</span>
              </>
            ) : (
              <>
                <FloppyDiskIcon className="size-3.5" aria-hidden="true" />
                <span>Save Changes</span>
              </>
            )}
          </Button>
        </div>
      </form>

      {/* Danger Zone */}
      <div className="flex flex-col gap-4 rounded-md border border-destructive/30 bg-destructive/5 p-5">
        <div className="flex items-center gap-2 border-b border-destructive/20 pb-3 text-destructive">
          <WarningCircleIcon className="size-5 shrink-0" aria-hidden="true" />
          <div>
            <h3 className="text-sm font-semibold">Danger Zone</h3>
            <p className="text-xs text-muted-foreground">
              Irreversible actions that affect this service and its running
              containers.
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold text-foreground">
              Delete this service
            </p>
            <p className="text-xs text-muted-foreground">
              Permanently remove this service, terminate active containers, and
              release assigned resources.
            </p>
          </div>

          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={() => setIsDeleteDialogOpen(true)}
            className="cursor-pointer gap-1.5 self-start sm:self-auto"
          >
            <TrashIcon className="size-3.5" aria-hidden="true" />
            <span>Delete Service</span>
          </Button>
        </div>
      </div>

      {/* Delete Service Confirmation Dialog */}
      <DeleteServiceDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        service={service ? { id: service.id, name: service.name } : null}
        onDeleted={() => {
          showToast(
            "success",
            `Service "${service.name}" was successfully deleted.`
          )
          router.push(`/projects/${projectId}`)
        }}
      />
    </div>
  )
}
