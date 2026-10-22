"use client"

import * as React from "react"
import { FolderGit2, Plus, Search } from "lucide-react"

import { CreateProjectDialog } from "@/components/projects/create-project-dialog"
import { ProjectCard } from "@/components/projects/project-card"
import { ProjectTable } from "@/components/projects/project-table"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { Input } from "@/components/ui/input"
import { ViewModeToggle } from "@/components/ui/view-mode-toggle"
import { usePlatformData } from "@/context/platform-data-context"

export function ProjectsView() {
  const {
    projects,
    projectsViewMode,
    setProjectsViewMode,
    deleteProject,
    setDataMode,
  } = usePlatformData()

  const [createProjectOpen, setCreateProjectOpen] = React.useState(false)
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

      {/* Empty State when no projects exist */}
      {projects.length === 0 ? (
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
              onDelete={deleteProject}
            />
          ))}
        </div>
      ) : (
        <ProjectTable projects={filteredProjects} onDelete={deleteProject} />
      )}

      <CreateProjectDialog
        open={createProjectOpen}
        onOpenChange={setCreateProjectOpen}
      />
    </div>
  )
}
