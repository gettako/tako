'use client';

import React from 'react';
import Link from 'next/link';
import { ChevronRight, Layers, Tag } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { StatusBadge } from '@/components/ui/status-badge';
import { Project } from '@/lib/types';

export interface ProjectsTableProps {
  projects: Project[];
}

export function ProjectsTable({ projects }: ProjectsTableProps) {
  return (
    <div className="rounded-xl border border-border bg-card shadow-xs overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="w-[280px]">Project</TableHead>
            <TableHead className="hidden sm:table-cell">Environment</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="hidden md:table-cell">Services</TableHead>
            <TableHead className="hidden lg:table-cell">Tags</TableHead>
            <TableHead className="hidden xl:table-cell">Last Updated</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {projects.map((project) => {
            const isStopped = project.status === 'stopped';
            const issueCount = Math.max(0, project.servicesCount - project.healthyServicesCount);

            return (
              <TableRow
                key={project.id}
                className="group h-14 transition-colors hover:bg-muted/40 cursor-pointer"
                onClick={() => {
                  window.location.href = `/projects/${project.id}`;
                }}
              >
                {/* Project Name & Slug */}
                <TableCell className="font-medium">
                  <div className="flex flex-col">
                    <span className="font-semibold text-foreground text-sm tracking-tight group-hover:text-primary transition-colors">
                      {project.name}
                    </span>
                    <span className="font-mono text-xs text-muted-foreground">
                      /{project.slug}
                    </span>
                  </div>
                </TableCell>

                {/* Environment */}
                <TableCell className="hidden sm:table-cell">
                  <span className="rounded-xs bg-muted px-2 py-0.5 font-mono text-[11px] text-muted-foreground uppercase font-medium tracking-wider">
                    {project.environment}
                  </span>
                </TableCell>

                {/* Status */}
                <TableCell>
                  <StatusBadge status={project.status} size="sm" />
                </TableCell>

                {/* Services Breakdown */}
                <TableCell className="hidden md:table-cell">
                  <div className="flex items-center gap-2 text-xs">
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Layers className="size-3.5" />
                      <span className="font-medium text-foreground">{project.servicesCount}</span>
                    </div>
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
                </TableCell>

                {/* Tags */}
                <TableCell className="hidden lg:table-cell">
                  <div className="flex items-center gap-1 overflow-hidden">
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
                </TableCell>

                {/* Last Updated */}
                <TableCell className="hidden xl:table-cell text-xs text-muted-foreground font-mono">
                  {new Date(project.updatedAt).toLocaleDateString([], {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </TableCell>

                {/* Actions */}
                <TableCell className="text-right">
                  <Link
                    href={`/projects/${project.id}`}
                    onClick={(e) => e.stopPropagation()}
                    className="inline-flex size-8 items-center justify-center rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors group-hover:text-primary"
                  >
                    <ChevronRight className="size-4" />
                    <span className="sr-only">View project</span>
                  </Link>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
