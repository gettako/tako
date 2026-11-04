"use client"

import * as React from "react"
import { FolderGit2, Plus, Search } from "lucide-react"

import { CreateProjectDialog } from "@/components/projects/create-project-dialog"
import { DeleteProjectDialog } from "@/components/projects/delete-project-dialog"
import { ProjectCard } from "@/components/projects/project-card"
import { ProjectTable } from "@/components/projects/project-table"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { Input } from "@/components/ui/input"
import { ViewModeToggle } from "@/components/ui/view-mode-toggle"
import { useProjects, useDeleteProject } from "@/hooks/use-projects"
import { usePlatformData } from "@/context/platform-data-context"
import { Project } from "@/types/platform"

export function ProjectsView() {
  const { data: projects = [], isPending, isError } = useProjects()
  const deleteProjectMutation = useDeleteProject()
  const {
    projectsViewMode,
    setProjectsViewMode,
    setDataMode,
  } = usePlatformData()

  const deleteProject = async (id: string) => {
    await deleteProjectMutation.mutateAsync(id)
  }

  const [createProjectOpen, setCreateProjectOpen] = React.useState(false)
  const [projectToDelete, setProjectToDelete] = React.useState<Project | null>(
    null
  )
  const [searchQuery, setSearchQuery] = React.useState("")

  const filteredProjects = projects.filter(
    (p) =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.slug.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.description.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
            Projects & Workload Environments
          </h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Organize edge services into isolated projects, environments, and
            deployment pipelines.
          </p>
        </div>

        <Button
          size="md"
          onClick={() => setCreateProjectOpen(true)}
          className="shrink-0 gap-1.5 text-xs"
        >
          <Plus className="size-3.5" />
          <span>Create Project</span>
        </Button>
      </div>

      {/* Toolbar: Search + View Toggle */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute top-2.5 left-2.5 size-4 text-muted-foreground" />
          <Input
            placeholder="Filter projects by name or slug..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 text-xs"
          />
        </div>

        <div className="flex items-center gap-3">
          <span className="font-mono text-xs text-muted-foreground">
            Showing {filteredProjects.length} of {projects.length} projects
          </span>
          <ViewModeToggle
            mode={projectsViewMode}
            onModeChange={setProjectsViewMode}
          />
        </div>
      </div>

      {/* Loading state */}
      {isPending ? (
        <div className="flex h-64 items-center justify-center rounded-lg border border-border bg-card">
          <div className="flex items-center gap-2 font-mono text-xs text-muted-foreground">
            <span className="size-2 animate-ping rounded-full bg-primary" />
            Loading projects...
          </div>
        </div>
      ) : isError ? (
        <EmptyState
          icon={FolderGit2}
          title="Failed to Load Projects"
          description="Could not connect to the cluster to retrieve projects."
        />
      ) : projects.length === 0 ? (
        <EmptyState
          icon={FolderGit2}
          title="No Projects Configured"
          description="Projects help you organize services, manage environment credentials, and deploy across edge nodes."
          actionLabel="Create First Project"
          onAction={() => setCreateProjectOpen(true)}
          secondaryActionLabel="Restore Sample Data"
          onSecondaryAction={() => setDataMode(true)}
        />
      ) : filteredProjects.length === 0 ? (
        <EmptyState
          icon={Search}
          title="No Matching Projects Found"
          description={`No projects matched "${searchQuery}". Try a different keyword.`}
          actionLabel="Clear Filter"
          onAction={() => setSearchQuery("")}
        />
      ) : projectsViewMode === "grid" ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {filteredProjects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              onDelete={setProjectToDelete}
            />
          ))}
        </div>
      ) : (
        <ProjectTable
          projects={filteredProjects}
          onDelete={setProjectToDelete}
        />
      )}

      <CreateProjectDialog
        open={createProjectOpen}
        onOpenChange={setCreateProjectOpen}
      />
      <DeleteProjectDialog
        project={projectToDelete}
        open={!!projectToDelete}
        onOpenChange={(open) => !open && setProjectToDelete(null)}
        onConfirm={deleteProject}
      />
    </div>
  )
}
