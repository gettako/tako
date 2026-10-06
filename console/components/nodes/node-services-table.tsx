'use client';

import React from 'react';
import Link from 'next/link';
import { Service, Project } from '@/lib/types';
import { StatusBadge } from '@/components/ui/status-badge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Boxes, ExternalLink, ChevronRight, Database, FileCode2, Layers } from 'lucide-react';
import { SectionHeader } from '@/components/ui/section-header';

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

  return (
    <Card className="border-border/60 bg-card p-6">
      <CardHeader className="px-0 pt-0 pb-4">
        <SectionHeader
          icon={Boxes}
          title="Connected Container Services"
          description={`Services and background daemons hosted and running on ${nodeName}.`}
          action={
            <Badge variant="outline" className="font-mono text-xs">
              {services.length} {services.length === 1 ? 'service' : 'services'}
            </Badge>
          }
        />
      </CardHeader>

      <CardContent className="px-0 pt-2">
        {services.length === 0 ? (
          <EmptyState
            icon={Boxes}
            title="No services deployed to this node"
            description={`Currently no container workloads are assigned to ${nodeName}.`}
          />
        ) : (
          <div className="rounded-lg border border-border/60 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/40 border-b border-border/60 text-[11px] font-semibold text-muted-foreground">
                  <tr className="h-11">
                    <th className="py-2.5 px-4">Service</th>
                    <th className="py-2.5 px-4">Parent Project</th>
                    <th className="py-2.5 px-4">Type</th>
                    <th className="py-2.5 px-4">Status</th>
                    <th className="py-2.5 px-4">CPU Usage</th>
                    <th className="py-2.5 px-4">RAM Usage</th>
                    <th className="py-2.5 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {services.map((service) => {
                    const isDatabase = service.type === 'database';
                    return (
                      <tr
                        key={service.id}
                        className="h-14 hover:bg-muted/30 transition-colors group"
                      >
                        {/* Service Name & Slug */}
                        <td className="py-3 px-4">
                          <Link
                            href={`/projects/${service.projectId}/services/${service.id}`}
                            className="font-semibold text-foreground hover:text-primary transition-colors flex items-center gap-2"
                          >
                            {isDatabase ? (
                              <Database className="size-3.5 text-status-warning shrink-0" />
                            ) : (
                              <FileCode2 className="size-3.5 text-primary shrink-0" />
                            )}
                            <span>{service.name}</span>
                          </Link>
                          <div className="text-[10px] text-muted-foreground font-mono mt-0.5">
                            {service.slug} • port {service.ports.join(', ')}
                          </div>
                        </td>

                        {/* Parent Project */}
                        <td className="py-3 px-4">
                          <Link
                            href={`/projects/${service.projectId}`}
                            className="text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline inline-flex items-center gap-1"
                          >
                            <span>{getProjectName(service.projectId)}</span>
                            <ExternalLink className="size-2.5 text-muted-foreground" />
                          </Link>
                        </td>

                        {/* Type Badge */}
                        <td className="py-3 px-4">
                          <Badge
                            variant="outline"
                            className="text-[10px] font-mono capitalize border-border/60 bg-muted/40"
                          >
                            {service.type}
                            {service.databaseType && ` (${service.databaseType})`}
                          </Badge>
                        </td>

                        {/* Status */}
                        <td className="py-3 px-4">
                          <StatusBadge status={service.status} size="sm" />
                        </td>

                        {/* CPU */}
                        <td className="py-3 px-4 font-mono text-[11px] text-foreground">
                          {service.usage.cpuPercent}%
                        </td>

                        {/* RAM */}
                        <td className="py-3 px-4 font-mono text-[11px] text-foreground">
                          {service.usage.memoryUsedMb} MB
                        </td>

                        {/* Action link */}
                        <td className="py-3 px-4 text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            render={
                              <Link
                                href={`/projects/${service.projectId}/services/${service.id}`}
                              />
                            }
                            className="h-8 text-xs gap-1 text-muted-foreground hover:text-primary group-hover:text-primary"
                          >
                            <span>Manage</span>
                            <ChevronRight className="size-3.5" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
