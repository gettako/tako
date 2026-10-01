"use client"

import * as React from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  CircleNotchIcon,
  TrashIcon,
  WarningCircleIcon,
} from "@phosphor-icons/react"
import { api, ApiError } from "@/lib/api"

export interface DeleteServiceFormProps {
  service: { id: string; name: string }
  onSuccess?: () => void
  onCancel: () => void
}

export function DeleteServiceForm({
  service,
  onSuccess,
  onCancel,
}: DeleteServiceFormProps) {
  const [confirmName, setConfirmName] = React.useState("")
  const [deleteVolumes, setDeleteVolumes] = React.useState(false)
  const [pruneImages, setPruneImages] = React.useState(true)
  const [isDeleting, setIsDeleting] = React.useState(false)
  const [deleteError, setDeleteError] = React.useState<string | null>(null)

  const isConfirmed = confirmName.trim() === service.name

  const handleDelete = async () => {
    if (!isConfirmed || isDeleting) return

    setIsDeleting(true)
    setDeleteError(null)

    try {
      await api.services.delete(service.id, {
        delete_volumes: deleteVolumes,
        prune_images: pruneImages,
      })
      if (onSuccess) {
        onSuccess()
      }
    } catch (err) {
      if (err instanceof ApiError) {
        setDeleteError(err.message)
      } else if (err instanceof Error) {
        setDeleteError(err.message)
      } else {
        setDeleteError("Failed to delete service. Please try again.")
      }
      setIsDeleting(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && isConfirmed && !isDeleting) {
      e.preventDefault()
      handleDelete()
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <DialogHeader className="border-b border-border pb-3">
        <div className="flex items-center gap-2 text-destructive">
          <WarningCircleIcon className="size-5 shrink-0" aria-hidden="true" />
          <DialogTitle>Delete Service</DialogTitle>
        </div>
        <DialogDescription>
          Permanently delete this service and release its associated resources.
        </DialogDescription>
      </DialogHeader>

      <div className="flex flex-col gap-4">
        <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
          <p className="font-semibold">
            Warning: This action cannot be undone.
          </p>
          <p className="mt-1 text-muted-foreground">
            Deleting{" "}
            <span className="font-mono font-medium text-foreground">
              {service.name}
            </span>{" "}
            will gracefully terminate running containers and remove all
            deployment history.
          </p>
        </div>

        {/* Traefik Deregistration Notice */}
        <div className="rounded-md border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
          <p className="font-semibold text-foreground">
            Traefik Ingress Deregistration
          </p>
          <p className="mt-1">
            Dynamic routing rules and Let&apos;s Encrypt SSL certificates for
            this service will be immediately purged from the reverse proxy
            without downtime or proxy restarts.
          </p>
        </div>

        {/* Retention Checkbox: Volume Protection */}
        <div className="flex flex-col gap-1.5 rounded-md border border-border bg-card p-3">
          <label
            htmlFor="delete-volumes-checkbox"
            className="flex cursor-pointer items-start gap-2.5 select-none"
          >
            <input
              id="delete-volumes-checkbox"
              type="checkbox"
              checked={deleteVolumes}
              onChange={(e) => setDeleteVolumes(e.target.checked)}
              disabled={isDeleting}
              className="mt-0.5 size-4 cursor-pointer rounded border-border text-destructive focus:ring-ring focus:ring-offset-0"
            />
            <div className="flex flex-col">
              <span className="text-xs font-semibold text-foreground">
                Delete persistent storage volumes
              </span>
              <span className="mt-0.5 text-xs text-destructive">
                Warning: Persistent data stored in host volumes will be
                permanently wiped and cannot be recovered.
              </span>
            </div>
          </label>
        </div>

        {/* Cleanup Option: Docker Images */}
        <div className="flex flex-col gap-1.5 rounded-md border border-border bg-card p-3">
          <label
            htmlFor="prune-images-checkbox"
            className="flex cursor-pointer items-start gap-2.5 select-none"
          >
            <input
              id="prune-images-checkbox"
              type="checkbox"
              checked={pruneImages}
              onChange={(e) => setPruneImages(e.target.checked)}
              disabled={isDeleting}
              className="mt-0.5 size-4 cursor-pointer rounded border-border text-foreground focus:ring-ring focus:ring-offset-0"
            />
            <div className="flex flex-col">
              <span className="text-xs font-semibold text-foreground">
                Remove unused Docker images from host
              </span>
              <span className="mt-0.5 text-xs text-muted-foreground">
                Prunes associated container images and build caches from the
                target server node.
              </span>
            </div>
          </label>
        </div>

        {deleteError && (
          <div
            role="alert"
            className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive"
          >
            <WarningCircleIcon className="size-4 shrink-0" aria-hidden="true" />
            <span>{deleteError}</span>
          </div>
        )}

        <div className="flex flex-col gap-2">
          <label
            htmlFor="confirm-service-delete"
            className="text-xs font-medium text-foreground"
          >
            To confirm deletion, please type{" "}
            <span className="font-mono font-semibold text-destructive">
              {service.name}
            </span>{" "}
            below:
          </label>
          <Input
            id="confirm-service-delete"
            placeholder={service.name}
            value={confirmName}
            onChange={(e) => setConfirmName(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isDeleting}
            autoFocus
          />
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-border pt-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onCancel}
            disabled={isDeleting}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={handleDelete}
            disabled={!isConfirmed || isDeleting}
            className="gap-1.5 border border-red-500/40"
          >
            {isDeleting ? (
              <>
                <CircleNotchIcon
                  className="size-3.5 animate-spin"
                  aria-hidden="true"
                />
                <span>Deleting...</span>
              </>
            ) : (
              <>
                <TrashIcon className="size-3.5" aria-hidden="true" />
                <span>Delete Service</span>
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}

export interface DeleteServiceDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  service: { id: string; name: string } | null
  onDeleted?: () => void
}

export function DeleteServiceDialog({
  open,
  onOpenChange,
  service,
  onDeleted,
}: DeleteServiceDialogProps) {
  if (!service) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        <DeleteServiceForm
          service={service}
          onSuccess={() => {
            onOpenChange(false)
            if (onDeleted) {
              onDeleted()
            }
          }}
          onCancel={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  )
}
