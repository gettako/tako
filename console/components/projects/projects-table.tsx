'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { Layers, Trash2, Pencil } from 'lucide-react';
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
  onEditProject?: (project: Project) => void;
  onDeleteProject?: (project: Project) => void;
}

export function ProjectsTable({ projects, onEditProject, onDeleteProject }: ProjectsTableProps) {
  const router = useRouter();

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <Table>
        <TableHeader className="bg-muted/40 border-b border-border">
          <TableRow className="h-10 hover:bg-transparent">
            <TableHead className="w-[280px]">Project</TableHead>
            <TableHead className="hidden sm:table-cell">Environment</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="hidden md:table-cell">Services</TableHead>
            <TableHead className="hidden lg:table-cell">Last Updated</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody className="divide-y divide-border/40">
          {projects.map((project) => {
            const servicesCount = project.servicesCount ?? 0;
            const healthyServicesCount = project.healthyServicesCount ?? 0;
            const isStopped = project.status === 'stopped';
            const issueCount = Math.max(0, servicesCount - healthyServicesCount);

            return (
              <TableRow
                key={project.id}
                className="group h-14 transition-colors hover:bg-muted/30 cursor-pointer"
                onClick={() => {
                  router.push(`/projects/${project.id}`);
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
                      <span className="font-medium text-foreground">{servicesCount}</span>
                    </div>
                    {healthyServicesCount > 0 && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-status-success/20 bg-status-success/10 px-2 py-0.5 text-[11px] font-medium text-status-success">
                        <span className="size-1 rounded-full bg-status-success" />
                        {healthyServicesCount} ok
                      </span>
                    )}
                    {isStopped ? (
                      <span className="inline-flex items-center gap-1 rounded-full border border-status-neutral/20 bg-status-neutral/10 px-2 py-0.5 text-[11px] font-medium text-status-neutral">
                        <span className="size-1 rounded-full bg-status-neutral" />
                        {servicesCount} stopped
                      </span>
                    ) : issueCount > 0 ? (
                      <span className="inline-flex items-center gap-1 rounded-full border border-status-warning/20 bg-status-warning/10 px-2 py-0.5 text-[11px] font-medium text-status-warning">
                        <span className="size-1 rounded-full bg-status-warning" />
                        {issueCount} issue
                      </span>
                    ) : null}
                  </div>
                </TableCell>

                {/* Last Updated */}
                <TableCell className="hidden lg:table-cell text-xs text-muted-foreground font-mono">
                  {new Date(project.updatedAt).toLocaleDateString([], {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </TableCell>

                {/* Actions: Direct Edit and Delete buttons */}
                <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center justify-end gap-1">
                    {onEditProject && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          onEditProject(project);
                        }}
                        className="size-8 inline-flex items-center justify-center rounded-md text-muted-foreground/60 hover:text-foreground hover:bg-muted/80 transition-colors cursor-pointer active:not-aria-[haspopup]:translate-y-px"
                        title="Edit Project"
                        aria-label={`Edit ${project.name}`}
                      >
                        <Pencil className="size-3.5" />
                      </button>
                    )}
                    {onDeleteProject && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          onDeleteProject(project);
                        }}
                        className="size-8 inline-flex items-center justify-center rounded-md text-muted-foreground/60 hover:text-status-danger hover:bg-status-danger/10 transition-colors cursor-pointer active:not-aria-[haspopup]:translate-y-px"
                        title="Delete Project"
                        aria-label={`Delete ${project.name}`}
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
