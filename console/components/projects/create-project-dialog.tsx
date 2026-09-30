"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { CircleNotchIcon } from "@phosphor-icons/react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { api, ApiError } from "@/lib/api"
import { cn } from "@/lib/utils"

export interface CreateProjectFormProps {
  onSuccess?: (projectId: string) => void
  onCancel?: () => void
  autoFocus?: boolean
}

export function CreateProjectForm({
  onSuccess,
  onCancel,
  autoFocus = true,
}: CreateProjectFormProps) {
  const router = useRouter()
  const nameInputRef = React.useRef<HTMLInputElement>(null)

  const [name, setName] = React.useState("")
  const [description, setDescription] = React.useState("")
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null)
  const [validationErrors, setValidationErrors] = React.useState<{
    name?: string
    description?: string
  }>({})

  React.useEffect(() => {
    if (autoFocus) {
      const timer = setTimeout(() => {
        nameInputRef.current?.focus()
      }, 50)
      return () => clearTimeout(timer)
    }
  }, [autoFocus])

  // Generate auto-slug preview
  const slugPreview = React.useMemo(() => {
    if (!name.trim()) return ""
    return name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
  }, [name])

  const validate = (): boolean => {
    const errors: { name?: string; description?: string } = {}
    const trimmedName = name.trim()

    if (!trimmedName) {
      errors.name = "Project name is required."
    } else if (trimmedName.length < 2) {
      errors.name = "Project name must be at least 2 characters."
    } else if (trimmedName.length > 50) {
      errors.name = "Project name must not exceed 50 characters."
    }

    if (description.length > 200) {
      errors.description = "Description must not exceed 200 characters."
    }

    setValidationErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage(null)

    if (!validate()) {
      return
    }

    setIsSubmitting(true)
    try {
      const created = await api.projects.create({
        name: name.trim(),
        description: description.trim() || undefined,
      })

      if (onSuccess) {
        onSuccess(created.id)
      }
      router.push(`/projects/${created.id}`)
    } catch (err) {
      if (err instanceof ApiError) {
        setErrorMessage(err.message)
      } else if (err instanceof Error) {
        setErrorMessage(err.message)
      } else {
        setErrorMessage("Failed to create project. Please try again.")
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <DialogHeader>
        <DialogTitle>Create New Project</DialogTitle>
        <DialogDescription>
          Create a project workspace to group and deploy related services.
        </DialogDescription>
      </DialogHeader>

      {errorMessage && (
        <div
          role="alert"
          className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive"
        >
          {errorMessage}
        </div>
      )}

      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="project-name"
            className="text-xs font-medium text-foreground"
          >
            Project Name <span className="text-destructive">*</span>
          </label>
          <Input
            ref={nameInputRef}
            id="project-name"
            name="name"
            placeholder="e.g. Acme Platform"
            value={name}
            onChange={(e) => {
              setName(e.target.value)
              if (validationErrors.name) {
                setValidationErrors((prev) => ({ ...prev, name: undefined }))
              }
            }}
            disabled={isSubmitting}
            aria-invalid={!!validationErrors.name}
            aria-describedby={
              validationErrors.name ? "project-name-error" : undefined
            }
          />
          {validationErrors.name && (
            <p
              id="project-name-error"
              className="text-xs text-destructive"
              role="alert"
            >
              {validationErrors.name}
            </p>
          )}
          {slugPreview && (
            <p className="font-mono text-xs text-muted-foreground">
              Slug: <span className="text-foreground">{slugPreview}</span>
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <label
              htmlFor="project-description"
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
            id="project-description"
            name="description"
            rows={3}
            placeholder="Brief summary of this project's purpose..."
            value={description}
            onChange={(e) => {
              setDescription(e.target.value)
              if (validationErrors.description) {
                setValidationErrors((prev) => ({
                  ...prev,
                  description: undefined,
                }))
              }
            }}
            disabled={isSubmitting}
            className={cn(
              "w-full resize-none rounded-md border border-input bg-transparent px-2.5 py-1.5 text-sm text-foreground transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30",
              validationErrors.description && "border-destructive"
            )}
            aria-invalid={!!validationErrors.description}
            aria-describedby={
              validationErrors.description ? "project-desc-error" : undefined
            }
          />
          {validationErrors.description && (
            <p
              id="project-desc-error"
              className="text-xs text-destructive"
              role="alert"
            >
              {validationErrors.description}
            </p>
          )}
        </div>
      </div>

      <div className="mt-2 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        {onCancel && (
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
        )}
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <CircleNotchIcon className="size-4 animate-spin" />
              <span>Creating...</span>
            </>
          ) : (
            "Create Project"
          )}
        </Button>
      </div>
    </form>
  )
}

export interface CreateProjectDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onProjectCreated?: (projectId: string) => void
}

export function CreateProjectDialog({
  open,
  onOpenChange,
  onProjectCreated,
}: CreateProjectDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        <CreateProjectForm
          onSuccess={(id) => {
            onOpenChange(false)
            if (onProjectCreated) onProjectCreated(id)
          }}
          onCancel={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  )
}
