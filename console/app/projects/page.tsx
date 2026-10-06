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
import { getProjects } from '@/lib/api/projects';

export default function ProjectsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEnv, setSelectedEnv] = useState<EnvironmentFilter>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');

  const {
    data: projects = [],
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['projects'],
    queryFn: getProjects,
  });

  // Calculate cluster-wide aggregate workload metrics
  const totalServices = useMemo(
    () => projects.reduce((acc, p) => acc + p.servicesCount, 0),
    [projects]
  );

  const healthyServices = useMemo(
    () => projects.reduce((acc, p) => acc + p.healthyServicesCount, 0),
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

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
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
  }, [projects, selectedEnv, searchQuery]);

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
        {/* 1. Hero Glow Banner Header */}
        <ProjectsHeader
          totalCount={projects.length}
          healthyCount={healthyProjects}
          issuesCount={issuesCount}
          onNewProject={() => {
            alert('Create project dialog will open (covered in Plan 08/Polish)');
          }}
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
                onClick: () => {
                  alert('Create project dialog');
                },
              }}
            />
          )
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {filteredProjects.map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>
        ) : (
          <ProjectsTable projects={filteredProjects} />
        )}
      </div>
    </>
  );
}
