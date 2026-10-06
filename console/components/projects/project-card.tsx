'use client';

import React from 'react';
import Link from 'next/link';
import { Layers } from 'lucide-react';
import { StatusAccentCard } from '@/components/ui/status-accent-card';
import { StatusBadge } from '@/components/ui/status-badge';
import { Project } from '@/lib/types';

export interface ProjectCardProps {
  project: Project;
}

function formatRelativeTime(dateStr?: string) {
  if (!dateStr) return '';
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);
    if (diffSec < 60) return 'just now';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 30) return `${diffDays}d ago`;
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  } catch {
    return dateStr;
  }
}

export function ProjectCard({ project }: ProjectCardProps) {
  const isStopped = project.status === 'stopped';
  const issueCount = Math.max(0, project.servicesCount - project.healthyServicesCount);

  return (
    <Link href={`/projects/${project.id}`} className="block group outline-none">
      <StatusAccentCard
        status={project.status}
        className="flex flex-col justify-between p-5 h-full transition-all group-hover:border-primary/40 group-hover:shadow-xs"
      >
        <div>
          {/* Header: Project Name, Environment & Status */}
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1.5 min-w-0">
              <h3 className="text-base sm:text-lg font-semibold text-foreground group-hover:text-primary transition-colors tracking-tight line-clamp-1">
                {project.name}
              </h3>
              <div className="flex items-center gap-2">
                <span className="rounded-xs border border-border/80 bg-muted/60 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                  {project.environment}
                </span>
              </div>
            </div>
            <StatusBadge status={project.status} size="sm" />
          </div>

          {/* Description */}
          {project.description && (
            <p className="mt-2.5 text-xs sm:text-sm text-muted-foreground line-clamp-2 leading-relaxed">
              {project.description}
            </p>
          )}
        </div>

        {/* Clean Single-Row Footer */}
        <div className="mt-5 pt-3 border-t border-border/50 flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Layers className="size-3.5" />
            <span>
              {project.servicesCount} {project.servicesCount === 1 ? 'service' : 'services'}
            </span>
          </div>

          {issueCount > 0 && !isStopped ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-status-warning/20 bg-status-warning/10 px-2 py-0.5 text-[11px] font-medium text-status-warning">
              <span className="size-1 rounded-full bg-status-warning" />
              {issueCount} {issueCount === 1 ? 'issue' : 'issues'}
            </span>
          ) : isStopped ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-status-neutral/20 bg-status-neutral/10 px-2 py-0.5 text-[11px] font-medium text-status-neutral">
              <span className="size-1 rounded-full bg-status-neutral" />
              stopped
            </span>
          ) : project.updatedAt ? (
            <span className="text-[11px] text-muted-foreground font-mono">
              Updated {formatRelativeTime(project.updatedAt)}
            </span>
          ) : null}
        </div>
      </StatusAccentCard>
    </Link>
  );
}

