'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowLeft, Plus, Server, Layers, Activity } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { StatCard } from '@/components/ui/stat-card';
import { Project, Service } from '@/lib/types';

export interface ProjectDetailHeaderProps {
  project: Project;
  services: Service[];
  onNewService?: () => void;
}

export function ProjectDetailHeader({
  project,
  services,
  onNewService,
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
          <Link
            href="/projects"
            className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-medium text-muted-foreground hover:text-foreground transition-colors mb-0.5"
          >
            <ArrowLeft className="size-3.5" />
            <span>Back to Projects</span>
          </Link>

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
          <Button
            onClick={onNewService}
            size="sm"
            className="gap-1.5 text-sm h-9 shadow-xs active:not-aria-[haspopup]:translate-y-px"
          >
            <Plus className="size-4" />
            <span>Add Service</span>
          </Button>
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
          statusAccent={healthyCount === services.length ? 'healthy' : 'warning'}
          change={{
            value: healthyCount === services.length ? 'Optimal' : `${services.length - healthyCount} alerts`,
            trend: healthyCount === services.length ? 'up' : 'down',
          }}
        />
      </div>
    </div>
  );
}
