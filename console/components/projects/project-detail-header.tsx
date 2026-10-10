'use client';

import React from 'react';
import { Plus, Server, Layers, Activity, Trash2, Pencil, ChevronDown, Boxes, Database } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { StatCard } from '@/components/ui/stat-card';
import { Project, Service, ServiceType } from '@/lib/types';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';

export interface ProjectDetailHeaderProps {
  project: Project;
  services: Service[];
  onNewService?: (type?: ServiceType) => void;
  onEditProject?: () => void;
  onDeleteProject?: () => void;
}

export function ProjectDetailHeader({
  project,
  services,
  onNewService,
  onEditProject,
  onDeleteProject,
}: ProjectDetailHeaderProps) {
  const healthyCount = services.filter((s) => s.status === 'healthy').length;
  const totalReplicas = services.reduce((acc, s) => acc + s.replicas, 0);
  const healthPercent =
    services.length > 0 ? Math.round((healthyCount / services.length) * 100) : 100;

  return (
    <div className="space-y-6">
      {/* 1. Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1 min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-foreground font-sans">
              {project.name}
            </h1>
            <StatusBadge status={project.status} />
            <span className="rounded-xs bg-muted px-2 py-0.5 font-mono text-xs text-muted-foreground uppercase font-medium tracking-wider">
              {project.environment}
            </span>
            <span className="font-mono text-xs text-muted-foreground">/{project.slug}</span>
          </div>

          {project.description && (
            <p className="text-sm text-muted-foreground mt-0.5 max-w-2xl">
              {project.description}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto">
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  size="sm"
                  className="gap-1.5 text-sm h-9 cursor-pointer active:not-aria-[haspopup]:translate-y-px"
                />
              }
            >
              <Plus className="size-4" />
              <span>Add Service</span>
              <ChevronDown className="size-3.5 opacity-70" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-60 p-1">
              <DropdownMenuItem
                onClick={() => onNewService?.('app')}
                className="flex items-center gap-2.5 px-3 py-2 cursor-pointer"
              >
                <Layers className="size-4 text-primary shrink-0" />
                <div className="flex flex-col">
                  <span className="text-xs font-semibold text-foreground">Application</span>
                  <span className="text-[11px] text-muted-foreground">Git repo or Dockerfile</span>
                </div>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => onNewService?.('compose')}
                className="flex items-center gap-2.5 px-3 py-2 cursor-pointer"
              >
                <Boxes className="size-4 text-primary shrink-0" />
                <div className="flex flex-col">
                  <span className="text-xs font-semibold text-foreground">Compose</span>
                  <span className="text-[11px] text-muted-foreground">Multi-container stack</span>
                </div>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => onNewService?.('database')}
                className="flex items-center gap-2.5 px-3 py-2 cursor-pointer"
              >
                <Database className="size-4 text-primary shrink-0" />
                <div className="flex flex-col">
                  <span className="text-xs font-semibold text-foreground">Database</span>
                  <span className="text-[11px] text-muted-foreground">Postgres, Redis, MySQL, Mongo</span>
                </div>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          {onEditProject && (
            <Button
              variant="outline"
              size="sm"
              onClick={onEditProject}
              className="gap-1.5 text-sm h-9 border-border/80 text-foreground hover:bg-muted/80 transition-colors active:not-aria-[haspopup]:translate-y-px"
            >
              <Pencil className="size-3.5" />
              <span>Edit Project</span>
            </Button>
          )}
          {onDeleteProject && (
            <Button
              variant="outline"
              size="sm"
              onClick={onDeleteProject}
              className="gap-1.5 text-sm h-9 border-border/80 text-muted-foreground hover:text-status-danger hover:border-status-danger/40 hover:bg-status-danger/10 transition-colors active:not-aria-[haspopup]:translate-y-px"
            >
              <Trash2 className="size-4" />
              <span>Delete Project</span>
            </Button>
          )}
        </div>
      </div>

      {/* 2. Project KPI Stat Cards */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
        <StatCard
          title="Total Services"
          value={services.length}
          subtext={`${healthyCount} running healthy`}
          icon={Layers}
        />
        <StatCard
          title="Active Replicas"
          value={totalReplicas}
          subtext="Containers across worker nodes"
          icon={Server}
        />
        <StatCard
          title="Health Ratio"
          value={services.length > 0 ? `${healthPercent}%` : '100%'}
          subtext="Service availability status"
          icon={Activity}
          statusAccent={healthyCount === services.length ? undefined : 'warning'}
          change={{
            value: healthyCount === services.length ? 'Optimal' : `${services.length - healthyCount} alerts`,
            trend: healthyCount === services.length ? 'up' : 'down',
          }}
        />
      </div>
    </div>
  );
}
