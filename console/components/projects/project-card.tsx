"use client"

import * as React from "react"
import Link from "next/link"
import {
  ArrowRight,
  CheckCircle2,
  FolderGit2,
  Layers,
  Trash2,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Project } from "@/types/platform"
import { cn } from "@/lib/utils"

interface ProjectCardProps {
  project: Project
  onDelete?: (project: Project) => void
}

export function ProjectCard({ project, onDelete }: ProjectCardProps) {
  const envStyles = {
    production:
      "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
    staging:
      "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
    preview:
      "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
  }[project.environment]

  return (
    <div className="group relative flex flex-col justify-between rounded-lg border border-border bg-card p-4.5 shadow-xs transition-all hover:border-primary/50 hover:shadow-sm">
      <div className="min-w-0">
        {/* Header */}
        <div className="flex items-start justify-between gap-2.5">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="flex size-8 shrink-0 items-center justify-center rounded border border-border bg-muted/40 text-foreground">
              <FolderGit2 className="size-4 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <Link
                href={`/projects/${project.id}`}
                className="block truncate text-sm font-semibold text-foreground transition-colors hover:text-primary hover:underline"
                title={project.name}
              >
                {project.name}
              </Link>
              <div
                className="truncate font-mono text-[11px] text-muted-foreground"
                title={project.slug}
              >
                {project.slug}
              </div>
            </div>
          </div>

          <span
            className={cn(
              "shrink-0 rounded border px-2 py-0.5 font-mono text-[10px] tracking-wider uppercase",
              envStyles
            )}
          >
            {project.environment}
          </span>
        </div>

        {/* Description */}
        <p
          className="mt-2.5 line-clamp-1 text-xs text-muted-foreground"
          title={project.description}
        >
          {project.description}
        </p>

        {/* Metadata Metrics */}
        <div className="mt-3.5 flex items-center gap-2.5 font-mono text-xs">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Layers className="size-3.5" />
            <span>Services:</span>
            <span className="font-semibold text-foreground">
              {project.servicesCount}
            </span>
          </div>

          <span className="text-muted-foreground/60">•</span>

          <div className="flex items-center gap-1.5 text-muted-foreground">
            <CheckCircle2 className="size-3.5 text-emerald-500" />
            <span>Healthy:</span>
            <span className="font-semibold text-foreground">
              {project.healthyServicesCount}/{project.servicesCount}
            </span>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-4 flex items-center justify-between border-t border-border pt-3 text-xs">
        <span className="font-mono text-[11px] text-muted-foreground">
          Updated {project.updatedAt}
        </span>

        <div className="flex items-center gap-1">
          {onDelete && (
            <Button
              size="icon-xs"
              variant="ghost"
              onClick={(e) => {
                e.stopPropagation()
                onDelete(project)
              }}
              className={cn(
                "size-7 transition-colors",
                project.servicesCount > 0
                  ? "text-muted-foreground/60 hover:text-amber-500"
                  : "text-muted-foreground hover:text-destructive"
              )}
              title={
                project.servicesCount > 0
                  ? "Cannot delete project with active services"
                  : "Delete project"
              }
            >
              <Trash2 className="size-3.5" />
            </Button>
          )}

          <Link
            href={`/projects/${project.id}`}
            className="inline-flex h-7 items-center gap-1 rounded px-2 text-xs font-medium text-primary transition-colors hover:bg-primary/10"
          >
            <span>View Services</span>
            <ArrowRight className="size-3" />
          </Link>
        </div>
      </div>
    </div>
  )
}
