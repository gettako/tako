"use client"

import * as React from "react"
import Link from "next/link"
import { ArrowLeft, FolderGit2, Layers, Search, Trash2 } from "lucide-react"

import { DeleteProjectDialog } from "@/components/projects/delete-project-dialog"
import { CreateServiceDialog } from "@/components/services/create-service-dialog"
import { CreateServiceDropdown } from "@/components/services/create-service-dropdown"
import { ServiceCard } from "@/components/services/service-card"
import { ServiceTable } from "@/components/services/service-table"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { Input } from "@/components/ui/input"
import { ViewModeToggle } from "@/components/ui/view-mode-toggle"
import { useProject, useDeleteProject } from "@/hooks/use-projects"
import { usePlatformData } from "@/context/platform-data-context"
import { cn } from "@/lib/utils"
import { SERVICE_STATUS, SERVICE_TYPE, type ServiceType } from "@/types/platform"

interface ProjectServicesViewProps {
  projectId: string
}

export function ProjectServicesView({ projectId }: ProjectServicesViewProps) {
  const { data: projectQuery, isPending: isProjectPending } = useProject(projectId)
  const deleteProjectMutation = useDeleteProject()
  const {
    projects,
    services,
    servicesViewMode,
    setServicesViewMode,
    deleteService,
    setDataMode,
  } = usePlatformData()

  const project = projectQuery || projects.find((p) => p.id === projectId)
  const projectServices = services.filter((s) => s.projectId === projectId)

  const deleteProject = async (id: string) => {
    await deleteProjectMutation.mutateAsync(id)
  }

  const [createServiceOpen, setCreateServiceOpen] = React.useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false)
  const [createServiceType, setCreateServiceType] =
    React.useState<ServiceType>(SERVICE_TYPE.DOCKERFILE)
  const [searchQuery, setSearchQuery] = React.useState("")
  const [statusFilter, setStatusFilter] = React.useState<string>("all")

  const runningCount = React.useMemo(
    () => projectServices.filter((s) => s.status === SERVICE_STATUS.RUNNING).length,
    [projectServices]
  )
  const deployingCount = React.useMemo(
    () => projectServices.filter((s) => s.status === SERVICE_STATUS.DEPLOYING).length,
    [projectServices]
  )
  const failedCount = React.useMemo(
    () => projectServices.filter((s) => s.status === SERVICE_STATUS.FAILED).length,
    [projectServices]
  )
  const stoppedCount = React.useMemo(
    () => projectServices.filter((s) => s.status === SERVICE_STATUS.STOPPED).length,
    [projectServices]
  )
  const totalContainers = React.useMemo(
    () => projectServices.reduce((acc, s) => acc + (s.containers?.length || 1), 0),
    [projectServices]
  )
  const uniqueNodesCount = React.useMemo(
    () => new Set(projectServices.map((s) => s.targetNodeId).filter(Boolean)).size,
    [projectServices]
  )

  const filteredServices = projectServices.filter((s) => {
    const matchesSearch =
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.slug.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.type.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.targetNodeId.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesStatus =
      statusFilter === "all" || s.status === statusFilter

    return matchesSearch && matchesStatus
  })

  if (!project) {
    if (isProjectPending) {
      return (
        <div className="flex h-64 items-center justify-center rounded-lg border border-border bg-card">
          <div className="flex items-center gap-2 font-mono text-xs text-muted-foreground">
            <span className="size-2 animate-ping rounded-full bg-primary" />
            Loading project...
          </div>
        </div>
      )
    }

    return (
      <div className="space-y-6">
        <Link
          href="/projects"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" />
          <span>Back to Projects</span>
        </Link>
        <EmptyState
          icon={FolderGit2}
          title="Project Not Found"
          description="The requested project was not found. It may have been deleted or the demo state was reset."
          actionLabel="View All Projects"
          onAction={() => window.location.assign("/projects")}
        />
      </div>
    )
  }

  const envStyles = {
    production:
      "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
    staging:
      "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
    preview:
      "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
  }[project.environment]

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
              {project.name}
            </h1>
            <span
              className={cn(
                "rounded-sm border px-2 py-0.5 font-mono text-[10px] font-medium tracking-wider uppercase",
                envStyles
              )}
            >
              {project.environment}
            </span>
          </div>

          <p className="mt-1 max-w-xl text-xs text-muted-foreground">
            {project.description}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Button
            size="md"
            variant="outline"
            onClick={() => setDeleteDialogOpen(true)}
            className={cn(
              "gap-1.5 text-xs transition-colors",
              projectServices.length > 0
                ? "text-muted-foreground/70 hover:text-amber-500"
                : "text-destructive hover:bg-destructive/10 hover:text-destructive"
            )}
            title={
              projectServices.length > 0
                ? "Cannot delete project with active services"
                : "Delete project"
            }
          >
            <Trash2 className="size-3.5" />
            <span>Delete Project</span>
          </Button>

          <CreateServiceDropdown
            onSelectType={(type) => {
              setCreateServiceType(type)
              setCreateServiceOpen(true)
            }}
          />
        </div>
      </div>

      {/* Compact Workload Health & Stats Strip */}
      {projectServices.length > 0 && (
        <div className="flex flex-col gap-3 rounded-lg border border-border bg-card/60 px-3.5 py-2.5 shadow-xs sm:flex-row sm:items-center sm:justify-between">
          {/* Quick status filters */}
          <div className="flex flex-wrap items-center gap-1.5 font-mono text-xs">
            <span className="mr-1 text-[11px] font-medium tracking-wider text-muted-foreground uppercase">
              Health:
            </span>
            <button
              type="button"
              onClick={() => setStatusFilter("all")}
              className={cn(
                "inline-flex cursor-pointer items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium transition-colors",
                statusFilter === "all"
                  ? "border border-border bg-background text-foreground shadow-xs"
                  : "border border-transparent text-muted-foreground hover:bg-background/60 hover:text-foreground"
              )}
            >
              <span>All</span>
              <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                {projectServices.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() =>
                setStatusFilter(
                  statusFilter === SERVICE_STATUS.RUNNING
                    ? "all"
                    : SERVICE_STATUS.RUNNING
                )
              }
              className={cn(
                "inline-flex cursor-pointer items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium transition-colors",
                statusFilter === SERVICE_STATUS.RUNNING
                  ? "border border-emerald-500/30 bg-background text-emerald-600 shadow-xs dark:text-emerald-400"
                  : "border border-transparent text-muted-foreground hover:bg-background/60 hover:text-foreground"
              )}
            >
              <span className="size-1.5 rounded-full bg-emerald-500" />
              <span>Running</span>
              <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 font-mono text-[10px] text-emerald-600 dark:text-emerald-400">
                {runningCount}
              </span>
            </button>

            {deployingCount > 0 && (
              <button
                type="button"
                onClick={() =>
                  setStatusFilter(
                    statusFilter === SERVICE_STATUS.DEPLOYING
                      ? "all"
                      : SERVICE_STATUS.DEPLOYING
                  )
                }
                className={cn(
                  "inline-flex cursor-pointer items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium transition-colors",
                  statusFilter === SERVICE_STATUS.DEPLOYING
                    ? "border border-primary/30 bg-background text-primary shadow-xs"
                    : "border border-transparent text-muted-foreground hover:bg-background/60 hover:text-foreground"
                )}
              >
                <span className="size-1.5 animate-pulse rounded-full bg-primary" />
                <span>Deploying</span>
                <span className="rounded bg-primary/10 px-1.5 py-0.5 font-mono text-[10px] text-primary">
                  {deployingCount}
                </span>
              </button>
            )}

            {failedCount > 0 && (
              <button
                type="button"
                onClick={() =>
                  setStatusFilter(
                    statusFilter === SERVICE_STATUS.FAILED
                      ? "all"
                      : SERVICE_STATUS.FAILED
                  )
                }
                className={cn(
                  "inline-flex cursor-pointer items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium transition-colors",
                  statusFilter === SERVICE_STATUS.FAILED
                    ? "border border-destructive/30 bg-background text-destructive shadow-xs"
                    : "border border-transparent text-destructive/80 hover:bg-background/60 hover:text-destructive"
                )}
              >
                <span className="size-1.5 rounded-full bg-destructive" />
                <span>Failed</span>
                <span className="rounded bg-destructive/10 px-1.5 py-0.5 font-mono text-[10px] font-bold text-destructive">
                  {failedCount}
                </span>
              </button>
            )}

            {stoppedCount > 0 && (
              <button
                type="button"
                onClick={() =>
                  setStatusFilter(
                    statusFilter === SERVICE_STATUS.STOPPED
                      ? "all"
                      : SERVICE_STATUS.STOPPED
                  )
                }
                className={cn(
                  "inline-flex cursor-pointer items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium transition-colors",
                  statusFilter === SERVICE_STATUS.STOPPED
                    ? "border border-border bg-background text-foreground shadow-xs"
                    : "border border-transparent text-muted-foreground hover:bg-background/60 hover:text-foreground"
                )}
              >
                <span className="size-1.5 rounded-full bg-muted-foreground" />
                <span>Stopped</span>
                <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                  {stoppedCount}
                </span>
              </button>
            )}
          </div>

          {/* Aggregates: Containers & Target Nodes */}
          <div className="flex items-center gap-3 font-mono text-[11px] text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <span>Containers:</span>
              <strong className="text-foreground">{totalContainers}</strong>
            </div>
            <span className="text-muted-foreground/40">•</span>
            <div className="flex items-center gap-1.5">
              <span>Target Nodes:</span>
              <strong className="text-foreground">{uniqueNodesCount}</strong>
            </div>
          </div>
        </div>
      )}

      {/* Toolbar: Search + View Toggle */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute top-2.5 left-2.5 size-4 text-muted-foreground" />
          <Input
            placeholder="Filter services by name, type, or node..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 text-xs"
          />
        </div>

        <div className="flex items-center gap-3">
          <span className="font-mono text-xs text-muted-foreground">
            Showing {filteredServices.length} of {projectServices.length}{" "}
            {projectServices.length === 1 ? "service" : "services"}
          </span>
          <ViewModeToggle
            mode={servicesViewMode}
            onModeChange={setServicesViewMode}
          />
        </div>
      </div>

      {/* Empty State when no services exist */}
      {projectServices.length === 0 ? (
        <EmptyState
          icon={Layers}
          title="No Services in this Project"
          description="Deploy your first containerized workload using a Dockerfile or Docker Compose manifest."
          actionLabel="Deploy Service"
          onAction={() => setCreateServiceOpen(true)}
          secondaryActionLabel="Load Sample Data"
          onSecondaryAction={() => setDataMode(true)}
        />
      ) : filteredServices.length === 0 ? (
        <EmptyState
          icon={Search}
          title="No Matching Services"
          description={
            statusFilter !== "all" || searchQuery
              ? `No services matched the active filter${searchQuery ? ` ("${searchQuery}")` : ""}. Check the query or reset filter.`
              : "No services found."
          }
          actionLabel="Reset Filters"
          onAction={() => {
            setSearchQuery("")
            setStatusFilter("all")
          }}
        />
      ) : servicesViewMode === "grid" ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {filteredServices.map((service) => (
            <ServiceCard
              key={service.id}
              service={service}
              onDelete={deleteService}
            />
          ))}
        </div>
      ) : (
        <ServiceTable services={filteredServices} onDelete={deleteService} />
      )}

      <CreateServiceDialog
        projectId={project.id}
        open={createServiceOpen}
        onOpenChange={setCreateServiceOpen}
        initialType={createServiceType}
      />
      <DeleteProjectDialog
        project={project}
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={async (id) => {
          await deleteProject(id)
          window.location.assign("/projects")
        }}
      />
    </div>
  )
}
