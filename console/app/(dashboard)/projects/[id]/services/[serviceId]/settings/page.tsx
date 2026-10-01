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
} from "@phosphor-icons/react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
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
  const [volumeName, setVolumeName] = React.useState("")
  const [volumeMountPath, setVolumeMountPath] = React.useState("")

  // UI state
  const [isSaving, setIsSaving] = React.useState(false)
  const [triggerDeployOnSave, setTriggerDeployOnSave] = React.useState(true)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false)

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
      setAutoDeploy(service.auto_deploy ?? false)
      setVolumeName(service.volume_name || "")
      setVolumeMountPath(service.volume_mount_path || "")
    }
  }, [service])

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
    if (autoDeploy !== (service.auto_deploy ?? false)) return true
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
    autoDeploy,
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
    setAutoDeploy(service.auto_deploy ?? false)
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
        auto_deploy: autoDeploy,
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

            <div className="flex items-center gap-2 pt-1">
              <Checkbox
                id="auto-deploy"
                checked={autoDeploy}
                onCheckedChange={(checked) => setAutoDeploy(checked === true)}
              />
              <label
                htmlFor="auto-deploy"
                className="cursor-pointer text-xs font-medium text-foreground select-none"
              >
                Enable Auto Deploy on git push to the selected branch
              </label>
            </div>
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
