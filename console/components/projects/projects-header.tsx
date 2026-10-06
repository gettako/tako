'use client';

import React from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';

export interface ProjectsHeaderProps {
  totalCount: number;
  healthyCount: number;
  issuesCount: number;
  onNewProject?: () => void;
}

export function ProjectsHeader({
  totalCount,
  healthyCount,
  issuesCount,
  onNewProject,
}: ProjectsHeaderProps) {
  const isAllHealthy = totalCount > 0 && issuesCount === 0;

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="space-y-1 min-w-0 flex-1">
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-2xl font-bold tracking-tight text-foreground font-sans">
            Projects
          </h1>

          {isAllHealthy ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-status-success/30 bg-status-success/10 px-2.5 py-0.5 text-xs font-medium text-status-success">
              <span className="size-1.5 rounded-full bg-status-success animate-pulse" />
              All Systems Operational
            </span>
          ) : issuesCount > 0 ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-status-warning/30 bg-status-warning/10 px-2.5 py-0.5 text-xs font-medium text-status-warning">
              <span className="size-1.5 rounded-full bg-status-warning animate-pulse" />
              {issuesCount} Attention Needed
            </span>
          ) : null}
        </div>

        <p className="text-sm text-muted-foreground">
          Manage workload groups, services, and environments across your cluster.
        </p>
      </div>

      <div className="flex items-center gap-2.5 shrink-0 self-start sm:self-auto">
        <Button
          onClick={onNewProject}
          size="sm"
          className="gap-1.5 text-xs sm:text-sm h-9 px-3.5 bg-primary text-primary-foreground hover:bg-primary/90 active:not-aria-[haspopup]:translate-y-px cursor-pointer"
        >
          <Plus className="size-3.5" />
          <span>Create Project</span>
        </Button>
      </div>
    </div>
  );
}
