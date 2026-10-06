'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowRight, Layers, Tag } from 'lucide-react';
import { StatusAccentCard } from '@/components/ui/status-accent-card';
import { StatusBadge } from '@/components/ui/status-badge';
import { Project } from '@/lib/types';

export interface ProjectCardProps {
  project: Project;
}

export function ProjectCard({ project }: ProjectCardProps) {
  const isStopped = project.status === 'stopped';
  const issueCount = Math.max(0, project.servicesCount - project.healthyServicesCount);

  return (
    <StatusAccentCard status={project.status} className="group flex flex-col justify-between p-5 sm:p-6">
      <div>
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1 min-w-0">
            <Link
              href={`/projects/${project.id}`}
              className="text-base sm:text-lg font-semibold text-foreground hover:text-primary transition-colors tracking-tight line-clamp-1"
            >
              {project.name}
            </Link>
            <div className="flex items-center gap-2">
              <span className="rounded-xs bg-muted px-1.5 py-0.5 font-mono text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                {project.environment}
              </span>
              <span className="font-mono text-xs text-muted-foreground">/{project.slug}</span>
            </div>
          </div>
          <StatusBadge status={project.status} size="sm" />
        </div>

        {project.description && (
          <p className="mt-2.5 text-xs sm:text-sm text-muted-foreground line-clamp-2 leading-relaxed">
            {project.description}
          </p>
        )}
      </div>

      <div className="mt-4 space-y-3 pt-3 border-t border-border/50">
        {/* Service breakdown badges */}
        <div className="flex items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Layers className="size-3.5" />
            <span>
              {project.servicesCount} {project.servicesCount === 1 ? 'service' : 'services'}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            {project.healthyServicesCount > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full border border-status-success/20 bg-status-success/10 px-2 py-0.5 text-[11px] font-medium text-status-success">
                <span className="size-1 rounded-full bg-status-success" />
                {project.healthyServicesCount} ok
              </span>
            )}
            {isStopped ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-status-neutral/20 bg-status-neutral/10 px-2 py-0.5 text-[11px] font-medium text-status-neutral">
                <span className="size-1 rounded-full bg-status-neutral" />
                {project.servicesCount} stopped
              </span>
            ) : issueCount > 0 ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-status-warning/20 bg-status-warning/10 px-2 py-0.5 text-[11px] font-medium text-status-warning">
                <span className="size-1 rounded-full bg-status-warning" />
                {issueCount} issue
              </span>
            ) : null}
          </div>
        </div>

        {/* Tags & Action Link */}
        <div className="flex items-center justify-between gap-2 pt-0.5">
          <div className="flex items-center gap-1.5 overflow-hidden">
            {project.tags?.slice(0, 2).map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1 rounded bg-muted/60 px-1.5 py-0.5 text-[10px] text-muted-foreground font-mono"
              >
                <Tag className="size-2.5" />
                <span>{tag}</span>
              </span>
            ))}
          </div>

          <Link
            href={`/projects/${project.id}`}
            className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline ml-auto"
          >
            <span>Manage</span>
            <ArrowRight className="size-3 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>
      </div>
    </StatusAccentCard>
  );
}
