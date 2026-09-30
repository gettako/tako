"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import {
  Warning,
  Trash,
  CircleNotchIcon,
  Check,
  WarningCircle,
} from "@phosphor-icons/react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { api, type ProjectDetail, type Project, ApiError } from "@/lib/api"
import { cn } from "@/lib/utils"

export interface ProjectSettingsFormProps {
  project: ProjectDetail | Project
  onProjectUpdated?: (updated: {
    name: string
    description?: string | null
  }) => void
  onProjectDeleted?: () => void
  onClose?: () => void
}

export function ProjectSettingsForm({
  project,
  onProjectUpdated,
  onProjectDeleted,
  onClose,
}: ProjectSettingsFormProps) {
  const router = useRouter()

  // Rename & metadata state
  const [name, setName] = React.useState(project.name)
  const [description, setDescription] = React.useState(
    project.description || ""
  )
  const [isSaving, setIsSaving] = React.useState(false)
  const [saveSuccess, setSaveSuccess] = React.useState(false)
  const [saveError, setSaveError] = React.useState<string | null>(null)

  // Danger zone state
  const [showDeleteConfirm, setShowDeleteConfirm] = React.useState(false)
  const [confirmName, setConfirmName] = React.useState("")
  const [isDeleting, setIsDeleting] = React.useState(false)
  const [deleteError, setDeleteError] = React.useState<string | null>(null)

  // Reset states when project changes
  React.useEffect(() => {
    setName(project.name)
    setDescription(project.description || "")
    setSaveSuccess(false)
    setSaveError(null)
    setShowDeleteConfirm(false)
    setConfirmName("")
    setDeleteError(null)
  }, [project])

  const isNameValid = name.trim().length >= 2 && name.trim().length <= 50

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isNameValid) return

    setIsSaving(true)
    setSaveError(null)
    setSaveSuccess(false)

    try {
      const updated = await api.projects.update(project.id, {
        name: name.trim(),
        description: description.trim() || undefined,
      })

      setSaveSuccess(true)
      if (onProjectUpdated) {
        onProjectUpdated({
          name: updated.name,
          description: updated.description,
        })
      }
      setTimeout(() => setSaveSuccess(false), 3000)
    } catch (err) {
      if (err instanceof ApiError) {
        setSaveError(err.message)
      } else if (err instanceof Error) {
        setSaveError(err.message)
      } else {
        setSaveError("Failed to update project settings.")
      }
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async () => {
    if (confirmName !== project.name) return

    setIsDeleting(true)
    setDeleteError(null)

    try {
      await api.projects.delete(project.id)
      if (onProjectDeleted) {
        onProjectDeleted()
      }
      if (onClose) {
        onClose()
      }
      router.push("/projects")
    } catch (err) {
      if (err instanceof ApiError) {
        setDeleteError(err.message)
      } else if (err instanceof Error) {
        setDeleteError(err.message)
      } else {
        setDeleteError("Failed to delete project. Please try again.")
      }
      setIsDeleting(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <DialogHeader className="border-b border-border pb-3">
        <DialogTitle>Project Settings</DialogTitle>
        <DialogDescription>
          Update project metadata or manage workspace deletion.
        </DialogDescription>
      </DialogHeader>

      {/* General Settings Form */}
      <form onSubmit={handleSave} className="flex flex-col gap-4">
        <h3 className="font-heading text-sm font-semibold text-foreground">
          General Details
        </h3>

        {saveError && (
          <div
            role="alert"
            className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive"
          >
            <WarningCircle className="size-4 shrink-0" />
            <span>{saveError}</span>
          </div>
        )}

        {saveSuccess && (
          <div
            role="status"
            className="flex items-center gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-600 dark:text-emerald-400"
          >
            <Check className="size-4 shrink-0" />
            <span>Project settings saved successfully.</span>
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="project-rename"
            className="text-xs font-medium text-foreground"
          >
            Project Name <span className="text-destructive">*</span>
          </label>
          <Input
            id="project-rename"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={isSaving}
          />
          {!isNameValid && (
            <p className="text-xs text-destructive">
              Project name must be between 2 and 50 characters.
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <label
              htmlFor="project-description-edit"
              className="text-xs font-medium text-foreground"
            >
              Description{" "}
              <span className="text-muted-foreground">(Optional)</span>
            </label>
            <span className="text-3xs text-muted-foreground">
              {description.length}/200
            </span>
          </div>
          <textarea
            id="project-description-edit"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={isSaving}
            className="w-full resize-none rounded-md border border-input bg-transparent px-2.5 py-1.5 text-sm text-foreground transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30"
          />
        </div>

        <div className="flex items-center justify-end gap-2 pt-1">
          {onClose && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={isSaving}
            >
              Cancel
            </Button>
          )}
          <Button type="submit" size="sm" disabled={isSaving || !isNameValid}>
            {isSaving ? (
              <>
                <CircleNotchIcon className="size-3.5 animate-spin" />
                <span>Saving...</span>
              </>
            ) : (
              <span>Save Changes</span>
            )}
          </Button>
        </div>
      </form>

      {/* Danger Zone */}
      <div className="flex flex-col gap-3 rounded-lg border border-red-500/30 bg-red-500/5 p-4">
        <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
          <Warning className="size-4 shrink-0" />
          <h3 className="font-heading text-sm font-semibold">Danger Zone</h3>
        </div>

        <p className="text-xs text-muted-foreground">
          Deleting this project will permanently stop and delete all services,
          routing rules, and variables within it. This action cannot be undone.
        </p>

        {deleteError && (
          <div
            role="alert"
            className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive"
          >
            <WarningCircle className="size-4 shrink-0" />
            <span>{deleteError}</span>
          </div>
        )}

        {!showDeleteConfirm ? (
          <div className="pt-1">
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={() => setShowDeleteConfirm(true)}
              className="gap-1.5 border border-red-500/40"
            >
              <Trash className="size-4" />
              <span>Delete Project</span>
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-3 border-t border-red-500/20 pt-3">
            <p className="text-xs font-medium text-foreground">
              To confirm deletion, please type{" "}
              <span className="font-mono font-semibold text-destructive">
                {project.name}
              </span>{" "}
              below:
            </p>
            <Input
              id="confirm-project-delete"
              placeholder={project.name}
              value={confirmName}
              onChange={(e) => setConfirmName(e.target.value)}
              disabled={isDeleting}
              autoFocus
            />

            <div className="flex items-center justify-end gap-2 pt-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setShowDeleteConfirm(false)
                  setConfirmName("")
                }}
                disabled={isDeleting}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={handleDelete}
                disabled={confirmName !== project.name || isDeleting}
                className="gap-1.5"
              >
                {isDeleting ? (
                  <>
                    <CircleNotchIcon className="size-3.5 animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <Trash className="size-3.5" />
                    <span>I understand, delete this project</span>
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export interface ProjectSettingsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  project: ProjectDetail | Project
  onProjectUpdated?: (updated: {
    name: string
    description?: string | null
  }) => void
  onProjectDeleted?: () => void
}

export function ProjectSettingsDialog({
  open,
  onOpenChange,
  project,
  onProjectUpdated,
  onProjectDeleted,
}: ProjectSettingsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <ProjectSettingsForm
          project={project}
          onProjectUpdated={onProjectUpdated}
          onProjectDeleted={onProjectDeleted}
          onClose={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  )
}
