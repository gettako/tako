'use client';

import React from 'react';
import Link from 'next/link';
import { Node } from '@/lib/types';
import { StatusBadge } from '@/components/ui/status-badge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Server, ChevronRight, Boxes } from 'lucide-react';

interface NodesTableProps {
  nodes: Node[];
}

export function NodesTable({ nodes }: NodesTableProps) {
  return (
    <div className="rounded-lg border border-border/60 bg-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-muted/40 border-b border-border/60 text-[11px] font-semibold text-muted-foreground">
            <tr className="h-12">
              <th className="py-2 px-4">Node</th>
              <th className="py-2 px-4">Status</th>
              <th className="py-2 px-4">Role</th>
              <th className="py-2 px-4">IP Address</th>
              <th className="py-2 px-4">CPU Usage</th>
              <th className="py-2 px-4">RAM Usage</th>
              <th className="py-2 px-4">Disk Usage</th>
              <th className="py-2 px-4">Services</th>
              <th className="py-2 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {nodes.map((node) => {
              const isOffline = node.status === 'offline';
              const memPct = node.memoryTotalMb > 0
                ? Math.round((node.usage.memoryUsedMb / node.memoryTotalMb) * 100)
                : 0;
              const diskPct = node.diskTotalGb > 0
                ? Math.round(((node.usage.diskUsedGb || 0) / node.diskTotalGb) * 100)
                : 0;

              return (
                <tr
                  key={node.id}
                  className="h-14 hover:bg-muted/30 transition-colors group"
                >
                  {/* Hostname & OS */}
                  <td className="py-3 px-4">
                    <Link
                      href={`/nodes/${node.id}`}
                      className="flex items-center gap-2.5 font-semibold text-foreground hover:text-primary transition-colors"
                    >
                      <Server className="size-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
                      <div>
                        <div>{node.name}</div>
                        <div className="text-[10px] text-muted-foreground font-normal truncate max-w-xs">
                          {node.os}
                        </div>
                      </div>
                    </Link>
                  </td>

                  {/* Status Badge */}
                  <td className="py-3 px-4">
                    <StatusBadge status={node.status} size="sm" />
                  </td>

                  {/* Role */}
                  <td className="py-3 px-4">
                    <Badge
                      variant="outline"
                      className={`text-[10px] font-mono capitalize ${
                        node.role === 'leader'
                          ? 'border-primary/40 bg-primary/10 text-primary font-semibold'
                          : 'border-border/60 bg-muted/60 text-muted-foreground'
                      }`}
                    >
                      {node.role}
                    </Badge>
                  </td>

                  {/* IP Address */}
                  <td className="py-3 px-4 font-mono text-[11px] text-muted-foreground">
                    <div>{node.ipAddress}</div>
                    {node.publicIp && (
                      <div className="text-[10px] text-muted-foreground/60">{node.publicIp}</div>
                    )}
                  </td>

                  {/* CPU % */}
                  <td className="py-3 px-4 font-mono text-[11px]">
                    <span className={node.usage.cpuPercent > 80 ? 'text-status-danger font-semibold' : 'text-foreground'}>
                      {isOffline ? '0%' : `${node.usage.cpuPercent}%`}
                    </span>
                    <span className="text-[10px] text-muted-foreground ml-1">
                      ({node.cpuTotalCores}c)
                    </span>
                  </td>

                  {/* RAM % */}
                  <td className="py-3 px-4 font-mono text-[11px]">
                    <span className={memPct > 85 ? 'text-status-danger font-semibold' : 'text-foreground'}>
                      {isOffline ? '0%' : `${memPct}%`}
                    </span>
                    <span className="text-[10px] text-muted-foreground ml-1">
                      ({Math.round(node.memoryTotalMb / 1024)}GB)
                    </span>
                  </td>

                  {/* Disk % */}
                  <td className="py-3 px-4 font-mono text-[11px] text-foreground">
                    <span>{diskPct}%</span>
                    <span className="text-[10px] text-muted-foreground ml-1">
                      ({node.diskTotalGb}GB)
                    </span>
                  </td>

                  {/* Services count */}
                  <td className="py-3 px-4">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-muted/70 text-[11px] font-medium text-foreground">
                      <Boxes className="size-3 text-muted-foreground" />
                      {node.servicesCount}
                    </span>
                  </td>

                  {/* Action Link */}
                  <td className="py-3 px-4 text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      render={<Link href={`/nodes/${node.id}`} />}
                      className="h-8 text-xs gap-1 text-muted-foreground hover:text-primary group-hover:text-primary"
                    >
                      <span>View</span>
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
  );
}
