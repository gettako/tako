"use client"

import * as React from "react"
import Link from "next/link"
import { AlertTriangle, ArrowRight, Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Project } from "@/types/platform"

interface DeleteProjectDialogProps {
  project: Project | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (projectId: string) => Promise<void> | void
}

export function DeleteProjectDialog({
  project,
  open,
  onOpenChange,
  onConfirm,
}: DeleteProjectDialogProps) {
  const [isDeleting, setIsDeleting] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setError(null)
      setIsDeleting(false)
    }
    onOpenChange(nextOpen)
  }

  if (!project) return null

  const hasServices = project.servicesCount > 0

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        {hasServices ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-amber-500">
                <AlertTriangle className="size-4 shrink-0" />
                <span>Cannot Delete Project</span>
              </DialogTitle>
              <DialogDescription className="text-xs">
                Projects with installed services cannot be deleted.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 text-xs">
              <div className="rounded border border-amber-500/30 bg-amber-500/10 p-3 text-muted-foreground">
                <p className="leading-relaxed">
                  <strong className="text-foreground">{project.name}</strong>{" "}
                  currently has{" "}
                  <strong className="text-foreground">
                    {project.servicesCount} installed{" "}
                    {project.servicesCount === 1 ? "service" : "services"}
                  </strong>
                  .
                </p>
                <p className="mt-1.5 leading-relaxed">
                  To prevent unintended data loss or downtime, you must delete
                  or move all services before removing this project.
                </p>
              </div>

              <div className="space-y-1.5">
                <span className="block font-mono text-[10px] tracking-wide text-muted-foreground uppercase">
                  Project
                </span>
                <div className="rounded border border-border/80 bg-muted/20 px-3 py-2">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-semibold text-foreground">
                      {project.name}
                    </span>
                    <span className="font-mono text-[11px] text-muted-foreground">
                      {project.slug}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleOpenChange(false)}
              >
                Close
              </Button>
              <Link
                href={`/projects/${project.id}`}
                onClick={() => handleOpenChange(false)}
                className="inline-flex h-8 items-center gap-1.5 rounded bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary/90"
              >
                <span>View Services</span>
                <ArrowRight className="size-3" />
              </Link>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-destructive">
                <Trash2 className="size-4 shrink-0" />
                <span>Confirm Project Deletion</span>
              </DialogTitle>
              <DialogDescription className="text-xs">
                This will permanently remove the project configuration.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 text-xs">
              <div className="rounded border border-destructive/30 bg-destructive/5 p-3 text-muted-foreground">
                <p className="leading-relaxed">
                  Are you sure you want to delete{" "}
                  <strong className="text-foreground">{project.name}</strong>?
                  This action cannot be undone.
                </p>
              </div>

              <div className="space-y-1.5">
                <span className="block font-mono text-[10px] tracking-wide text-muted-foreground uppercase">
                  Project identifier
                </span>
                <div className="rounded border border-border/80 bg-muted/20 px-3 py-2">
                  <div className="flex items-center justify-between font-mono text-xs">
                    <span className="font-semibold text-foreground">
                      {project.name}
                    </span>
                    <span className="text-muted-foreground">
                      {project.slug}
                    </span>
                  </div>
                </div>
              </div>

              {error && (
                <div className="rounded border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                  {error}
                </div>
              )}
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isDeleting}
                onClick={() => handleOpenChange(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                disabled={isDeleting}
                onClick={async () => {
                  try {
                    setIsDeleting(true)
                    setError(null)
                    await onConfirm(project.id)
                    handleOpenChange(false)
                  } catch (err) {
                    setError(
                      err instanceof Error
                        ? err.message
                        : "Failed to delete project"
                    )
                  } finally {
                    setIsDeleting(false)
                  }
                }}
              >
                {isDeleting ? "Deleting..." : "Delete Project"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
