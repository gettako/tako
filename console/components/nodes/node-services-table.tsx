'use client';

import React from 'react';
import Link from 'next/link';
import { Service, Project } from '@/lib/types';
import { StatusBadge } from '@/components/ui/status-badge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardAction,
  CardContent,
} from '@/components/ui/card';
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table';
import { EmptyState } from '@/components/ui/empty-state';
import { Boxes, ExternalLink, ChevronRight, Database, FileCode2, Layers } from 'lucide-react';

interface NodeServicesTableProps {
  services: Service[];
  projects: Project[];
  nodeName: string;
}

export function NodeServicesTable({
  services,
  projects,
  nodeName,
}: NodeServicesTableProps) {
  const getProjectName = (projectId: string) => {
    const proj = projects.find((p) => p.id === projectId);
    return proj ? proj.name : 'Unknown Project';
  };

  const getComputeColor = (cpuPct: number) => {
    if (cpuPct >= 90) return 'text-status-danger font-semibold';
    if (cpuPct >= 70) return 'text-status-warning font-semibold';
    return 'text-foreground';
  };

  return (
    <Card className="rounded-xl border border-border bg-card transition-colors overflow-hidden">
      <CardHeader>
        <div className="flex items-center gap-3.5 min-w-0">
          <div className="flex size-10 items-center justify-center rounded-xl border border-border bg-muted/40 text-foreground shrink-0">
            <Boxes className="size-5" />
          </div>
          <div className="space-y-0.5 min-w-0">
            <CardTitle className="text-base font-semibold tracking-tight text-foreground">
              Connected Container Services
            </CardTitle>
            <CardDescription className="text-sm text-muted-foreground">
              Application containers and database instances actively scheduled on {nodeName}.
            </CardDescription>
          </div>
        </div>

        <CardAction>
          <Badge variant="outline" className="font-mono text-xs">
            {services.length} {services.length === 1 ? 'service' : 'services'}
          </Badge>
        </CardAction>
      </CardHeader>

      <CardContent className="px-0 pb-0">
        {services.length === 0 ? (
          <div className="px-(--card-spacing) pb-(--card-spacing)">
            <EmptyState
              icon={Boxes}
              title="No services deployed to this node"
              description={`Currently no container workloads are assigned or scheduled on ${nodeName}.`}
            />
          </div>
        ) : (
          <div className="border-t border-border">
            <Table>
              <TableHeader className="bg-muted/40 border-b border-border">
                <TableRow className="h-10 hover:bg-transparent">
                  <TableHead className="w-[32%]">Service</TableHead>
                  <TableHead className="w-[20%]">Parent Project</TableHead>
                  <TableHead className="w-[12%]">Type</TableHead>
                  <TableHead className="w-[12%]">Status</TableHead>
                  <TableHead className="w-[14%]">Compute Usage</TableHead>
                  <TableHead className="text-right w-[10%]">Action</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody className="divide-y divide-border/40">
                {services.map((service) => {
                  const isDatabase = service.type === 'database';
                  const isCompose = service.type === 'compose';

                  return (
                    <TableRow
                      key={service.id}
                      className="h-14 hover:bg-muted/30 transition-colors group cursor-pointer"
                      onClick={() => {
                        window.location.href = `/projects/${service.projectId}/services/${service.id}`;
                      }}
                    >
                      {/* 1. Service Name & Slug/Port */}
                      <TableCell>
                        <div className="flex items-center gap-2.5">
                          <span
                            className={`flex size-8 items-center justify-center rounded-lg border shrink-0 transition-colors ${
                              isDatabase
                                ? 'border-status-warning/30 bg-status-warning/10 text-status-warning'
                                : isCompose
                                ? 'border-status-info/30 bg-status-info/10 text-status-info'
                                : 'border-primary/30 bg-primary/10 text-primary'
                            }`}
                          >
                            {isDatabase ? (
                              <Database className="size-4" />
                            ) : isCompose ? (
                              <Layers className="size-4" />
                            ) : (
                              <FileCode2 className="size-4" />
                            )}
                          </span>

                          <div className="min-w-0">
                            <Link
                              href={`/projects/${service.projectId}/services/${service.id}`}
                              onClick={(e) => e.stopPropagation()}
                              className="font-semibold text-foreground group-hover:text-primary transition-colors truncate block text-sm"
                            >
                              {service.name}
                            </Link>
                            <div className="text-[11px] text-muted-foreground font-mono truncate">
                              {service.slug} • port {service.ports.join(', ')}
                            </div>
                          </div>
                        </div>
                      </TableCell>

                      {/* 2. Parent Project */}
                      <TableCell>
                        <Link
                          href={`/projects/${service.projectId}`}
                          onClick={(e) => e.stopPropagation()}
                          className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 group/link"
                        >
                          <span className="truncate max-w-[150px]">
                            {getProjectName(service.projectId)}
                          </span>
                          <ExternalLink className="size-3 text-muted-foreground/70 group-hover/link:text-foreground shrink-0" />
                        </Link>
                      </TableCell>

                      {/* 3. Workload Type */}
                      <TableCell>
                        <Badge
                          variant="outline"
                          className="text-[10px] font-mono capitalize border-border bg-muted/40"
                        >
                          {service.type}
                          {service.databaseType && ` (${service.databaseType})`}
                        </Badge>
                      </TableCell>

                      {/* 4. Status Badge */}
                      <TableCell>
                        <StatusBadge status={service.status} size="sm" />
                      </TableCell>

                      {/* 5. Compute (CPU & RAM) */}
                      <TableCell className="font-mono text-xs">
                        <div className="space-y-0.5">
                          <div>
                            <span className={getComputeColor(service.usage.cpuPercent)}>
                              {service.usage.cpuPercent}%
                            </span>
                            <span className="text-[10px] text-muted-foreground ml-1 font-sans">
                              CPU
                            </span>
                          </div>
                          <div className="text-muted-foreground text-[11px]">
                            {service.usage.memoryUsedMb} MB
                            <span className="text-[10px] ml-1 font-sans">RAM</span>
                          </div>
                        </div>
                      </TableCell>

                      {/* 6. Action */}
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          render={
                            <Link
                              href={`/projects/${service.projectId}/services/${service.id}`}
                              onClick={(e) => e.stopPropagation()}
                            />
                          }
                          className="h-8 text-xs gap-1 text-muted-foreground hover:text-primary group-hover:text-primary active:not-aria-[haspopup]:translate-y-px"
                        >
                          <span>Manage</span>
                          <ChevronRight className="size-3.5 group-hover:translate-x-0.5 transition-transform" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
