'use client';

import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FolderKanban, SearchX } from 'lucide-react';
import { ProjectsHeader } from '@/components/projects/projects-header';
import { ProjectsStats } from '@/components/projects/projects-stats';
import {
  ProjectsFilterBar,
  EnvironmentFilter,
} from '@/components/projects/projects-filter-bar';
import { ProjectCard } from '@/components/projects/project-card';
import { ProjectsTable } from '@/components/projects/projects-table';
import { ViewMode } from '@/components/ui/view-toggle';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { LoadingSkeleton } from '@/components/ui/loading-skeleton';
import { CreateProjectDialog } from '@/components/projects/create-project-dialog';
import { EditProjectDialog } from '@/components/projects/edit-project-dialog';
import { DeleteProjectDialog } from '@/components/projects/delete-project-dialog';
import { useProjects } from '@/lib/queries';
import { Project } from '@/lib/types';
import { useDebounce } from '@/hooks/use-debounce';

export default function ProjectsPage() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [projectToEdit, setProjectToEdit] = useState<Project | null>(null);
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearch = useDebounce(searchQuery, 200);
  const [selectedEnv, setSelectedEnv] = useState<EnvironmentFilter>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('table');

  const {
    data: projects = [],
    isLoading,
    isRefetching,
    error,
    refetch,
  } = useProjects({ refetchInterval: 10000 });

  // Calculate cluster-wide aggregate workload metrics
  const totalServices = useMemo(
    () => projects.reduce((acc, p) => acc + (p.servicesCount ?? 0), 0),
    [projects]
  );

  const healthyServices = useMemo(
    () => projects.reduce((acc, p) => acc + (p.healthyServicesCount ?? 0), 0),
    [projects]
  );

  const healthyProjects = useMemo(
    () => projects.filter((p) => p.status === 'healthy').length,
    [projects]
  );

  const issuesCount = useMemo(
    () => projects.filter((p) => p.status !== 'healthy').length,
    [projects]
  );

  const environmentCounts = useMemo(() => {
    return {
      all: projects.length,
      production: projects.filter((p) => p.environment.toLowerCase() === 'production').length,
      staging: projects.filter((p) => p.environment.toLowerCase() === 'staging').length,
      development: projects.filter((p) => p.environment.toLowerCase() === 'development').length,
    };
  }, [projects]);

  // Combined search and environment filtering
  const filteredProjects = useMemo(() => {
    let result = projects;

    if (selectedEnv !== 'all') {
      result = result.filter((p) => p.environment.toLowerCase() === selectedEnv);
    }

    if (debouncedSearch.trim()) {
      const q = debouncedSearch.toLowerCase();
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.slug.toLowerCase().includes(q) ||
          p.description?.toLowerCase().includes(q) ||
          p.environment.toLowerCase().includes(q) ||
          p.tags?.some((t) => t.toLowerCase().includes(q))
      );
    }

    return result;
  }, [projects, selectedEnv, debouncedSearch]);

  if (error) {
    return (
      <>
        <title>Projects — Takō Cloud</title>
        <ErrorState
          title="Could not load projects"
          description="An error occurred while fetching your projects from the cluster API. Please retry."
          retry={() => refetch()}
        />
      </>
    );
  }

  const hasFiltersActive = searchQuery.trim().length > 0 || selectedEnv !== 'all';

  return (
    <>
      <title>Projects — Takō Cloud</title>
      <div className="space-y-6">
        {/* 1. Page Header */}
        <ProjectsHeader
          totalCount={projects.length}
          healthyCount={healthyProjects}
          issuesCount={issuesCount}
          onNewProject={() => setIsCreateOpen(true)}
          onRefresh={() => refetch()}
          isRefreshing={isRefetching}
        />

        {/* 2. Top Aggregate Stat Cards */}
        <ProjectsStats
          totalProjects={projects.length}
          totalServices={totalServices}
          healthyServices={healthyServices}
          healthyProjects={healthyProjects}
          issuesCount={issuesCount}
          environmentCounts={environmentCounts}
        />

        {/* 3. Search, Environment Filter & View Switcher Bar */}
        <ProjectsFilterBar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          selectedEnv={selectedEnv}
          onEnvChange={setSelectedEnv}
          environmentCounts={environmentCounts}
          totalCount={projects.length}
          filteredCount={filteredProjects.length}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
        />

        {/* 4. Main Content Area */}
        {isLoading ? (
          <LoadingSkeleton variant={viewMode === 'grid' ? 'cards' : 'table'} count={4} />
        ) : filteredProjects.length === 0 ? (
          hasFiltersActive ? (
            <EmptyState
              title="No projects match criteria"
              description={`No projects matched the selected filters${
                searchQuery ? ` and search query "${searchQuery}"` : ''
              }.`}
              icon={SearchX}
              action={{
                label: 'Reset Filters',
                onClick: () => {
                  setSearchQuery('');
                  setSelectedEnv('all');
                },
              }}
            />
          ) : (
            <EmptyState
              title="No projects created yet"
              description="Get started by creating your first project to organize applications, databases, and microservices."
              icon={FolderKanban}
              action={{
                label: 'Create First Project',
                onClick: () => setIsCreateOpen(true),
              }}
            />
          )
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredProjects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                onEditProject={(p) => setProjectToEdit(p)}
                onDeleteProject={(p) => setProjectToDelete(p)}
              />
            ))}
          </div>
        ) : (
          <ProjectsTable
            projects={filteredProjects}
            onEditProject={(p) => setProjectToEdit(p)}
            onDeleteProject={(p) => setProjectToDelete(p)}
          />
        )}

        {/* Create Project Modal Form */}
        <CreateProjectDialog
          open={isCreateOpen}
          onOpenChange={setIsCreateOpen}
        />

        {/* Edit Project Modal Form */}
        {projectToEdit && (
          <EditProjectDialog
            open={!!projectToEdit}
            onOpenChange={(open) => !open && setProjectToEdit(null)}
            project={projectToEdit}
          />
        )}

        {/* Delete Project Confirmation Dialog */}
        {projectToDelete && (
          <DeleteProjectDialog
            open={!!projectToDelete}
            onOpenChange={(open) => !open && setProjectToDelete(null)}
            project={projectToDelete}
            servicesCount={projectToDelete.servicesCount ?? 0}
          />
        )}
      </div>
    </>
  );
}
