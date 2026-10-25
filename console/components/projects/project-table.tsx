"use client"

import * as React from "react"
import Link from "next/link"
import { ArrowRight, CheckCircle2, FolderGit2, Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Project } from "@/types/platform"
import { cn } from "@/lib/utils"

interface ProjectTableProps {
  projects: Project[]
  onDelete?: (project: Project) => void
}

export function ProjectTable({ projects, onDelete }: ProjectTableProps) {
  const envStyles = {
    production:
      "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
    staging:
      "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
    preview:
      "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-card">
      <table className="w-full text-left text-xs">
        <thead className="border-b border-border bg-muted/30 font-mono text-[11px] tracking-wider text-muted-foreground uppercase">
          <tr>
            <th className="px-4 py-3">Project</th>
            <th className="px-4 py-3">Environment</th>
            <th className="px-4 py-3">Services</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Updated</th>
            <th className="px-4 py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {projects.map((project) => (
            <tr
              key={project.id}
              className="transition-colors hover:bg-muted/20"
            >
              <td
                className="px-4 py-3 font-medium"
                aria-label={`Project ${project.name}`}
              >
                <div className="flex items-center gap-2.5">
                  <div className="flex size-7 shrink-0 items-center justify-center rounded border border-border bg-muted/40 text-foreground">
                    <FolderGit2 className="size-3.5 text-primary" />
                  </div>
                  <div>
                    <Link
                      href={`/projects/${project.id}`}
                      className="font-semibold text-foreground hover:underline"
                    >
                      {project.name}
                    </Link>
                    <div className="font-mono text-[11px] text-muted-foreground">
                      {project.slug}
                    </div>
                  </div>
                </div>
              </td>

              <td className="px-4 py-3">
                <span
                  className={cn(
                    "rounded border px-2 py-0.5 font-mono text-[10px] tracking-wider uppercase",
                    envStyles[project.environment]
                  )}
                >
                  {project.environment}
                </span>
              </td>

              <td className="px-4 py-3 font-mono text-foreground">
                {project.servicesCount} services
              </td>

              <td className="px-4 py-3">
                <div className="flex items-center gap-1.5 font-mono text-xs text-muted-foreground">
                  <CheckCircle2 className="size-3.5 text-emerald-500" />
                  <span className="text-foreground">
                    {project.healthyServicesCount}/{project.servicesCount}{" "}
                    healthy
                  </span>
                </div>
              </td>

              <td className="px-4 py-3 font-mono text-muted-foreground">
                {project.updatedAt}
              </td>

              <td className="px-4 py-3 text-right">
                <div className="flex items-center justify-end gap-1">
                  <Link
                    href={`/projects/${project.id}`}
                    className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-primary hover:bg-primary/10"
                  >
                    <span>View</span>
                    <ArrowRight className="size-3" />
                  </Link>

                  {onDelete && (
                    <Button
                      size="icon-xs"
                      variant="ghost"
                      onClick={() => onDelete(project)}
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
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
