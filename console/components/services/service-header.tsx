"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  ArrowLeftIcon,
  ArrowSquareOut,
  HardDrives,
  ArrowClockwise,
  StopCircleIcon,
  PlayCircle,
  PencilSimple,
  Check,
  X,
  CircleNotchIcon,
  Trash,
} from "@phosphor-icons/react"
import { Button } from "@/components/ui/button"
import { StatusBadge } from "@/components/status-badge"
import { DeleteServiceDialog } from "./delete-service-dialog"
import { useService } from "./service-context"
import { api } from "@/lib/api"

export function ServiceHeader() {
  const {
    service,
    serviceId,
    projectId,
    isLoading,
    updateServiceState,
    showToast,
  } = useService()

  const [isEditingName, setIsEditingName] = React.useState(false)
  const [editedName, setEditedName] = React.useState("")
  const [isSavingName, setIsSavingName] = React.useState(false)
  const [activeAction, setActiveAction] = React.useState<string | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false)
  const router = useRouter()
  const inputRef = React.useRef<HTMLInputElement>(null)

  React.useEffect(() => {
    if (service) {
      setEditedName(service.name)
    }
  }, [service])

  React.useEffect(() => {
    if (isEditingName) {
      inputRef.current?.focus()
      inputRef.current?.select()
    }
  }, [isEditingName])

  if (isLoading || !service) {
    return (
      <div className="flex animate-pulse flex-col gap-4 border-b border-border pb-6">
        <Link
          href={`/projects/${projectId}`}
          className="inline-flex items-center gap-1.5 self-start text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeftIcon className="size-3.5" aria-hidden="true" />
          <span>Back to Project</span>
        </Link>
        <div className="h-4 w-28 rounded bg-muted" />
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-8 w-48 rounded bg-muted" />
            <div className="h-6 w-20 rounded-full bg-muted" />
          </div>
          <div className="flex items-center gap-2">
            <div className="h-10 w-28 rounded bg-muted" />
            <div className="h-10 w-24 rounded bg-muted" />
            <div className="h-10 w-24 rounded bg-muted" />
          </div>
        </div>
      </div>
    )
  }

  const handleStartEdit = () => {
    setEditedName(service.name)
    setIsEditingName(true)
  }

  const handleCancelEdit = () => {
    setEditedName(service.name)
    setIsEditingName(false)
  }

  const handleSaveName = async () => {
    const trimmed = editedName.trim()
    if (!trimmed || trimmed === service.name) {
      setIsEditingName(false)
      return
    }

    setIsSavingName(true)
    try {
      const updated = await api.services.update(serviceId, { name: trimmed })
      updateServiceState({ name: updated.name })
      setIsEditingName(false)
      showToast("success", `Service renamed to "${updated.name}".`)
    } catch {
      showToast("error", "Failed to update service name.")
    } finally {
      setIsSavingName(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault()
      handleSaveName()
    } else if (e.key === "Escape") {
      e.preventDefault()
      handleCancelEdit()
    }
  }

  const handleRedeploy = async () => {
    setActiveAction("redeploy")
    try {
      await api.services.redeploy(serviceId)
      updateServiceState({ status: "building" })
      showToast("success", "Redeployment dispatched successfully.")
    } catch {
      showToast("error", "Failed to trigger redeployment.")
    } finally {
      setActiveAction(null)
    }
  }

  const handlePullUpdate = async () => {
    setActiveAction("pull-update")
    try {
      const res = await api.services.pullUpdate(serviceId)
      if (res.updated) {
        updateServiceState({ status: "running" })
        showToast(
          "success",
          res.message || "Container recreated with latest image."
        )
      } else {
        showToast("success", res.message || "Already up to date.")
      }
    } catch (err) {
      showToast(
        "error",
        err instanceof Error ? err.message : "Failed to pull image update."
      )
    } finally {
      setActiveAction(null)
    }
  }

  const handleRestart = async () => {
    setActiveAction("restart")
    try {
      await api.services.restart(serviceId)
      updateServiceState({ status: "running" })
      showToast("success", "Service container restarted.")
    } catch {
      showToast("error", "Failed to restart container.")
    } finally {
      setActiveAction(null)
    }
  }

  const handleToggleState = async () => {
    const isStopped = service.status === "stopped"
    setActiveAction("toggle")
    try {
      if (isStopped) {
        await api.services.start(serviceId)
        updateServiceState({ status: "running" })
        showToast("success", "Service started successfully.")
      } else {
        await api.services.stop(serviceId)
        updateServiceState({ status: "stopped" })
        showToast("success", "Service container stopped.")
      }
    } catch {
      showToast("error", `Failed to ${isStopped ? "start" : "stop"} service.`)
    } finally {
      setActiveAction(null)
    }
  }

  const isStopped = service.status === "stopped"
  const isBuilding = service.status === "building"
  const primaryUrl = service.primary_domain
    ? `https://${service.primary_domain}`
    : null
  const portToExpose =
    service.published_port ??
    (service.primary_domain ? null : service.internal_port)
  const serverHost = service.server?.host
  const directUrl =
    !service.primary_domain && portToExpose && serverHost
      ? `http://${serverHost}:${portToExpose}`
      : null
  const directUrlLabel = directUrl ? `${serverHost}:${portToExpose}` : null

  return (
    <div className="flex flex-col gap-4 border-b border-border pb-6">
      {/* Back link */}
      <Link
        href={`/projects/${projectId}`}
        className="inline-flex items-center gap-1.5 self-start text-xs text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeftIcon className="size-3.5" aria-hidden="true" />
        <span>Back to Project</span>
      </Link>

      {/* Main Header Row */}
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
        {/* Left: Title, editable prompt, Status, Server node, Domain */}
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-3">
            {isEditingName ? (
              <div className="flex items-center gap-1.5">
                <input
                  ref={inputRef}
                  type="text"
                  value={editedName}
                  onChange={(e) => setEditedName(e.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={isSavingName}
                  className="h-9 rounded-md border border-input bg-background px-2.5 text-lg font-semibold text-foreground focus:ring-2 focus:ring-ring focus:outline-none"
                  aria-label="Edit service name"
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleSaveName}
                  disabled={isSavingName}
                  className="h-9 px-2.5"
                  aria-label="Save service name"
                >
                  {isSavingName ? (
                    <CircleNotchIcon className="size-4 animate-spin" />
                  ) : (
                    <Check className="size-4 text-status-healthy-text" />
                  )}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleCancelEdit}
                  disabled={isSavingName}
                  className="h-9 px-2.5"
                  aria-label="Cancel editing"
                >
                  <X className="size-4" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground">
                  {service.name}
                </h1>
                <button
                  type="button"
                  onClick={handleStartEdit}
                  className="cursor-pointer rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  aria-label="Rename service"
                  title="Rename service"
                >
                  <PencilSimple className="size-4" />
                </button>
              </div>
            )}

            <StatusBadge variant={service.status} size="md" />
          </div>

          {/* Metadata chips: Server node & Production URL */}
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            {/* Server node pill */}
            <span className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1 font-mono text-foreground">
              <HardDrives
                className="size-3.5 text-muted-foreground"
                aria-hidden="true"
              />
              <span>Server: {service.server?.name ?? "Assigned Node"}</span>
            </span>

            {/* Primary URL or Direct Port URL */}
            {primaryUrl ? (
              <a
                href={primaryUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1 font-mono text-foreground transition-colors hover:bg-muted"
                title="Open production URL in new tab"
              >
                <span>{service.primary_domain}</span>
                <ArrowSquareOut
                  className="size-3.5 text-muted-foreground"
                  aria-hidden="true"
                />
              </a>
            ) : directUrl ? (
              <a
                href={directUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1 font-mono text-foreground transition-colors hover:bg-muted"
                title="Open direct port URL in new tab"
              >
                <span>{directUrlLabel}</span>
                <ArrowSquareOut
                  className="size-3.5 text-muted-foreground"
                  aria-hidden="true"
                />
              </a>
            ) : (
              <span className="text-muted-foreground italic">
                No custom domain configured
              </span>
            )}
          </div>
        </div>

        {/* Right: Action button group */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Redeploy (Git services) or Pull Latest Image & Recreate (Database / Image services) */}
          {service.service_type === "database" ? (
            <Button
              variant="default"
              onClick={handlePullUpdate}
              disabled={activeAction !== null}
              className="cursor-pointer gap-2"
              title="Pull the latest image digest from registry, preserve persistent volumes, and recreate the container"
              aria-label="Pull Latest Image & Recreate"
            >
              {activeAction === "pull-update" ? (
                <CircleNotchIcon
                  className="size-4 animate-spin"
                  aria-hidden="true"
                />
              ) : (
                <ArrowClockwise className="size-4" aria-hidden="true" />
              )}
              <span>Pull Latest & Recreate</span>
            </Button>
          ) : (
            <Button
              variant="default"
              onClick={handleRedeploy}
              disabled={activeAction !== null || isBuilding}
              className="cursor-pointer gap-2"
              aria-label="Redeploy service"
            >
              {activeAction === "redeploy" || isBuilding ? (
                <CircleNotchIcon
                  className="size-4 animate-spin"
                  aria-hidden="true"
                />
              ) : (
                <ArrowClockwise className="size-4" aria-hidden="true" />
              )}
              <span>Redeploy</span>
            </Button>
          )}

          {/* Restart */}
          <Button
            variant="outline"
            onClick={handleRestart}
            disabled={activeAction !== null || isStopped}
            className="cursor-pointer gap-2"
          >
            {activeAction === "restart" ? (
              <CircleNotchIcon
                className="size-4 animate-spin"
                aria-hidden="true"
              />
            ) : (
              <ArrowClockwise className="size-4" aria-hidden="true" />
            )}
            <span>Restart</span>
          </Button>

          {/* Stop / Start Container */}
          <Button
            variant={isStopped ? "outline" : "destructive"}
            onClick={handleToggleState}
            disabled={activeAction !== null}
            className="cursor-pointer gap-2"
          >
            {activeAction === "toggle" ? (
              <CircleNotchIcon
                className="size-4 animate-spin"
                aria-hidden="true"
              />
            ) : isStopped ? (
              <PlayCircle className="size-4" aria-hidden="true" />
            ) : (
              <StopCircleIcon className="size-4" aria-hidden="true" />
            )}
            <span>{isStopped ? "Start Container" : "Stop Container"}</span>
          </Button>

          {/* Delete Service */}
          <Button
            variant="outline"
            onClick={() => setDeleteDialogOpen(true)}
            disabled={activeAction !== null}
            className="cursor-pointer gap-2 border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
            aria-label={`Delete ${service.name}`}
          >
            <Trash className="size-4" aria-hidden="true" />
            <span>Delete</span>
          </Button>
        </div>
      </div>

      {/* Delete Service Confirmation Dialog */}
      <DeleteServiceDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        service={service}
        onDeleted={() => {
          showToast("success", `Service "${service.name}" was deleted.`)
          router.push(`/projects/${projectId}`)
        }}
      />
    </div>
  )
}
