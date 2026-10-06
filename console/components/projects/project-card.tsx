'use client';

import React from 'react';
import Link from 'next/link';
import { Layers, ChevronRight } from 'lucide-react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardAction,
  CardContent,
  CardFooter,
} from '@/components/ui/card';
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
    <Link href={`/projects/${project.id}`} className="block group outline-hidden h-[170px]">
      <Card
        size="sm"
        className="relative h-[170px] flex flex-col justify-between overflow-hidden transition-all duration-150 group-hover:border-border/80 group-hover:shadow-xs active:not-aria-[haspopup]:translate-y-px py-0 gap-0"
      >
        <div className="p-4 pb-3 space-y-2.5">
          {/* Header: Project Name, Environment & Status */}
          <CardHeader className="p-0">
            <div className="space-y-0.5 min-w-0 pr-2">
              <CardTitle className="font-semibold text-sm sm:text-base text-foreground group-hover:text-primary transition-colors tracking-tight line-clamp-1">
                {project.name}
              </CardTitle>
              <div className="flex items-center gap-2">
                <span className="rounded-xs border border-border/80 bg-muted/60 px-1.5 py-0.2 font-mono text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                  {project.environment}
                </span>
              </div>
            </div>

            <CardAction>
              <StatusBadge status={project.status} size="sm" />
            </CardAction>
          </CardHeader>

          {/* Description */}
          <CardContent className="p-0">
            <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed min-h-[2.25rem]">
              {project.description || 'No description provided.'}
            </p>
          </CardContent>
        </div>

        {/* Clean Single-Row Footer */}
        <CardFooter className="px-4 py-2.5 border-t border-border/40 flex items-center justify-between text-xs text-muted-foreground h-10 shrink-0">
          <div className="flex items-center gap-1.5 text-muted-foreground text-xs shrink-0">
            <Layers className="size-3 text-muted-foreground" />
            <span>
              {project.servicesCount} {project.servicesCount === 1 ? 'service' : 'services'}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            {issueCount > 0 && !isStopped ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-status-warning/20 bg-status-warning/10 px-2 py-0.5 text-[10px] font-medium text-status-warning">
                <span className="size-1 rounded-full bg-status-warning" />
                {issueCount} {issueCount === 1 ? 'issue' : 'issues'}
              </span>
            ) : isStopped ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-status-neutral/20 bg-status-neutral/10 px-2 py-0.5 text-[10px] font-medium text-status-neutral">
                <span className="size-1 rounded-full bg-status-neutral" />
                stopped
              </span>
            ) : project.updatedAt ? (
              <span className="text-[11px] text-muted-foreground font-mono">
                Updated {formatRelativeTime(project.updatedAt)}
              </span>
            ) : null}
            <ChevronRight className="size-3.5 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-transform" />
          </div>
        </CardFooter>
      </Card>
    </Link>
  );
}

