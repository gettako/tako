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
import { usePlatformData } from "@/context/platform-data-context"
import { cn } from "@/lib/utils"
import { ServiceType } from "@/types/platform"

interface ProjectServicesViewProps {
  projectId: string
}

export function ProjectServicesView({ projectId }: ProjectServicesViewProps) {
  const {
    projects,
    services,
    servicesViewMode,
    setServicesViewMode,
    deleteService,
    deleteProject,
    setDataMode,
  } = usePlatformData()

  const project = projects.find((p) => p.id === projectId)
  const projectServices = services.filter((s) => s.projectId === projectId)

  const [createServiceOpen, setCreateServiceOpen] = React.useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false)
  const [createServiceType, setCreateServiceType] =
    React.useState<ServiceType>("dockerfile")
  const [searchQuery, setSearchQuery] = React.useState("")

  const filteredServices = projectServices.filter(
    (s) =>
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.slug.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.type.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.targetNodeId.toLowerCase().includes(searchQuery.toLowerCase())
  )

  if (!project) {
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
          description={`No services matched "${searchQuery}". Check the query or reset filter.`}
          actionLabel="Clear Filter"
          onAction={() => setSearchQuery("")}
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
