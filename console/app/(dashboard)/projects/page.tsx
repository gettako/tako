"use client"

import * as React from "react"
import Link from "next/link"
import {
  FolderSimple,
  Plus,
  MagnifyingGlass,
  ArrowRight,
  Clock,
  HardDrives,
  CheckCircleIcon,
  WarningCircle,
  CircleNotchIcon,
  StopCircleIcon,
} from "@phosphor-icons/react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { LoadingSkeleton } from "@/components/states/loading-skeleton"
import { EmptyState } from "@/components/states/empty-state"
import { ErrorCard } from "@/components/states/error-card"
import { CreateProjectDialog } from "@/components/projects/create-project-dialog"
import { api, type Project, type Service } from "@/lib/api"
import { cn } from "@/lib/utils"

function formatDate(dateString: string): string {
  try {
    const date = new Date(dateString)
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(date)
  } catch {
    return dateString
  }
}

interface ProjectStatusSummary {
  running: number
  building: number
  failed: number
  stopped: number
  total: number
}

function computeProjectStatuses(
  projectId: string,
  services: Service[]
): ProjectStatusSummary {
  const projectServices = services.filter((s) => s.project_id === projectId)
  const summary: ProjectStatusSummary = {
    running: 0,
    building: 0,
    failed: 0,
    stopped: 0,
    total: projectServices.length,
  }

  for (const s of projectServices) {
    if (s.status === "running") summary.running++
    else if (s.status === "building") summary.building++
    else if (s.status === "failed" || s.status === "unhealthy") summary.failed++
    else summary.stopped++
  }

  return summary
}

export default function ProjectsPage() {
  const [projects, setProjects] = React.useState<Project[]>([])
  const [services, setServices] = React.useState<Service[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [error, setError] = React.useState<Error | null>(null)
  const [searchQuery, setSearchQuery] = React.useState("")
  const [createDialogOpen, setCreateDialogOpen] = React.useState(false)

  const loadData = React.useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const [projectsData, servicesData] = await Promise.all([
        api.projects.list(),
        api.services.list(),
      ])
      setProjects(projectsData)
      setServices(servicesData)
    } catch (err) {
      setError(
        err instanceof Error ? err : new Error("Failed to load projects.")
      )
    } finally {
      setIsLoading(false)
    }
  }, [])

  React.useEffect(() => {
    loadData()
  }, [loadData])

  const filteredProjects = React.useMemo(() => {
    const q = searchQuery.toLowerCase().trim()
    if (!q) return projects
    return projects.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.description && p.description.toLowerCase().includes(q))
    )
  }, [projects, searchQuery])

  return (
    <div className="flex flex-col gap-6 md:gap-8">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1.5">
          <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground">
            Projects
          </h1>
          <p className="text-sm text-muted-foreground">
            Manage your project workspaces and deployed applications.
          </p>
        </div>
        <Button
          onClick={() => setCreateDialogOpen(true)}
          className="self-start sm:self-auto"
        >
          <Plus className="size-4" />
          <span>New Project</span>
        </Button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 sm:max-w-xs">
          <MagnifyingGlass className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search projects..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
            aria-label="Search projects by name"
          />
        </div>
        {searchQuery && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSearchQuery("")}
            className="text-xs text-muted-foreground"
          >
            Clear filter
          </Button>
        )}
      </div>

      {/* Main Content Area */}
      {isLoading ? (
        <LoadingSkeleton variant="card" count={3} />
      ) : error ? (
        <ErrorCard
          error={error}
          onRetry={loadData}
          title="Could not load projects"
        />
      ) : projects.length === 0 ? (
        <EmptyState
          icon={<FolderSimple className="size-6 text-foreground" />}
          title="No projects created yet"
          description="Get started by creating your first project workspace to deploy services."
          action={{
            label: "New Project",
            onClick: () => setCreateDialogOpen(true),
          }}
        />
      ) : filteredProjects.length === 0 ? (
        <EmptyState
          icon={<MagnifyingGlass className="size-6 text-muted-foreground" />}
          title="No matching projects"
          description={`No project found matching "${searchQuery}". Check the spelling or clear the search.`}
          action={{
            label: "Clear search",
            onClick: () => setSearchQuery(""),
          }}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredProjects.map((project) => {
            const statusSummary = computeProjectStatuses(project.id, services)
            const serviceCount =
              statusSummary.total > 0
                ? statusSummary.total
                : project.services_count

            return (
              <Link
                key={project.id}
                href={`/projects/${project.id}`}
                className={cn(
                  "group relative flex flex-col justify-between rounded-lg border border-border bg-card p-5 transition-colors outline-none",
                  "hover:border-foreground/30 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring"
                )}
                aria-label={`Open project ${project.name}`}
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex size-9 items-center justify-center rounded-md border border-border bg-muted/40 text-foreground transition-colors group-hover:border-foreground/20">
                      <FolderSimple className="size-5" />
                    </div>
                    <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
                  </div>

                  <h2 className="mt-3 truncate font-heading text-base font-semibold tracking-tight text-foreground transition-colors group-hover:text-primary">
                    {project.name}
                  </h2>

                  <p className="mt-1 line-clamp-2 min-h-10 text-xs text-muted-foreground">
                    {project.description || "No description provided."}
                  </p>
                </div>

                <div className="mt-5 flex flex-col gap-3 border-t border-border pt-3">
                  {/* Service status indicators */}
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1.5 font-medium text-foreground">
                      <HardDrives className="size-3.5 text-muted-foreground" />
                      <span>
                        {serviceCount}{" "}
                        {serviceCount === 1 ? "service" : "services"}
                      </span>
                    </span>

                    <div className="flex items-center gap-2 font-mono text-2xs">
                      {statusSummary.running > 0 && (
                        <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                          <CheckCircleIcon className="size-3" />
                          <span>{statusSummary.running}</span>
                        </span>
                      )}
                      {statusSummary.building > 0 && (
                        <span className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400">
                          <CircleNotchIcon className="size-3 animate-spin" />
                          <span>{statusSummary.building}</span>
                        </span>
                      )}
                      {statusSummary.failed > 0 && (
                        <span className="inline-flex items-center gap-1 text-red-600 dark:text-red-400">
                          <WarningCircle className="size-3" />
                          <span>{statusSummary.failed}</span>
                        </span>
                      )}
                      {statusSummary.stopped > 0 && (
                        <span className="inline-flex items-center gap-1 text-muted-foreground">
                          <StopCircleIcon className="size-3" />
                          <span>{statusSummary.stopped}</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Timestamp */}
                  <div className="flex items-center gap-1.5 text-2xs text-muted-foreground">
                    <Clock className="size-3" />
                    <span>Updated {formatDate(project.updated_at)}</span>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}

      {/* Create Project Modal Dialog */}
      <CreateProjectDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onProjectCreated={() => {
          loadData()
        }}
      />
    </div>
  )
}
