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
    <div className="relative overflow-hidden rounded-2xl border border-border/70 bg-gradient-to-b from-primary/5 via-background to-background p-6 sm:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground font-sans">
              Projects
            </h1>

            {isAllHealthy ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-status-success/25 bg-status-success/15 px-2.5 py-0.5 text-xs font-medium text-status-success">
                <span className="size-1.5 rounded-full bg-status-success animate-pulse" />
                All Systems Operational
              </span>
            ) : issuesCount > 0 ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-status-warning/25 bg-status-warning/15 px-2.5 py-0.5 text-xs font-medium text-status-warning">
                <span className="size-1.5 rounded-full bg-status-warning animate-pulse" />
                {issuesCount} Attention Needed
              </span>
            ) : null}
          </div>

          <p className="text-sm sm:text-base text-muted-foreground max-w-2xl leading-relaxed">
            Manage workload groups, services, and environments across your cluster.
          </p>
        </div>

        <Button
          onClick={onNewProject}
          size="sm"
          className="gap-1.5 text-sm h-9 shadow-xs active:not-aria-[haspopup]:translate-y-px shrink-0"
        >
          <Plus className="size-4" />
          <span>Create Project</span>
        </Button>
      </div>
    </div>
  );
}
