'use client';

import React from 'react';
import { FolderKanban, Layers, CheckCircle2, AlertTriangle } from 'lucide-react';
import { StatCard } from '@/components/ui/stat-card';

export interface ProjectsStatsProps {
  totalProjects: number;
  totalServices: number;
  healthyServices: number;
  healthyProjects: number;
  issuesCount: number;
  environmentCounts: {
    production: number;
    staging: number;
    development: number;
  };
}

export function ProjectsStats({
  totalProjects,
  totalServices,
  healthyServices,
  healthyProjects,
  issuesCount,
  environmentCounts,
}: ProjectsStatsProps) {
  const healthPercentage =
    totalProjects > 0 ? Math.round((healthyProjects / totalProjects) * 100) : 100;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard
        title="Total Projects"
        value={totalProjects}
        subtext={`${environmentCounts.production} prod, ${environmentCounts.staging} staging, ${environmentCounts.development} dev`}
        icon={FolderKanban}
      />
      <StatCard
        title="Total Services"
        value={totalServices}
        subtext={`${healthyServices} running healthy across cluster`}
        icon={Layers}
      />
      <StatCard
        title="Healthy Projects"
        value={`${healthyProjects}/${totalProjects}`}
        subtext="Workload group availability"
        icon={CheckCircle2}
        statusAccent="healthy"
        change={{
          value: `${healthPercentage}%`,
          trend: healthyProjects === totalProjects ? 'up' : 'neutral',
        }}
      />
      <StatCard
        title="Attention Needed"
        value={issuesCount}
        subtext={
          issuesCount > 0
            ? `${issuesCount} ${issuesCount === 1 ? 'project requires' : 'projects require'} review`
            : 'Zero active incidents'
        }
        icon={AlertTriangle}
        statusAccent={issuesCount > 0 ? 'warning' : 'neutral'}
        change={
          issuesCount > 0
            ? {
                value: `${issuesCount} alerts`,
                trend: 'down',
              }
            : undefined
        }
      />
    </div>
  );
}
