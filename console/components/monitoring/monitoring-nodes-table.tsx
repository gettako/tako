'use client';

import React from 'react';
import Link from 'next/link';
import { Node } from '@/lib/types';
import {
  Card,
  CardHeader,
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
import { StatusBadge } from '@/components/ui/status-badge';
import { SectionHeader } from '@/components/ui/section-header';
import { Server, ChevronRight, Boxes } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface MonitoringNodesTableProps {
  nodes: Node[];
}

export function MonitoringNodesTable({ nodes }: MonitoringNodesTableProps) {
  const getMetricColor = (pct: number) => {
    if (pct >= 90) return 'text-status-danger font-semibold';
    if (pct >= 70) return 'text-status-warning font-semibold';
    return 'text-foreground';
  };

  return (
    <Card className="rounded-xl border border-border bg-card overflow-hidden">
      <CardHeader>
        <SectionHeader
          icon={Server}
          title="Node Hardware Telemetry Breakdown"
          description="Real-time processor, physical memory, and container workload metrics per cluster host."
        />
      </CardHeader>

      <CardContent className="px-0 pb-0">
        <div className="border-t border-border">
          <Table>
            <TableHeader className="bg-muted/40 border-b border-border">
              <TableRow className="h-11 hover:bg-transparent">
                <TableHead className="w-[28%]">Node Host</TableHead>
                <TableHead className="w-[12%]">Status</TableHead>
                <TableHead className="w-[18%]">IP Address</TableHead>
                <TableHead className="w-[16%]">CPU Utilization</TableHead>
                <TableHead className="w-[16%]">Memory (RAM)</TableHead>
                <TableHead className="text-right w-[10%]">Action</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody className="divide-y divide-border/40">
              {nodes.map((node) => {
                const isOffline = node.status === 'offline';
                const memPct =
                  node.memoryTotalMb > 0
                    ? Math.round((node.usage.memoryUsedMb / node.memoryTotalMb) * 100)
                    : 0;

                return (
                  <TableRow
                    key={node.id}
                    className="h-14 hover:bg-muted/30 transition-colors group cursor-pointer"
                    onClick={() => {
                      window.location.href = `/nodes/${node.id}`;
                    }}
                  >
                    {/* Node Host & OS */}
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        <div className="flex size-8 items-center justify-center rounded-lg border border-border bg-muted/40 text-muted-foreground group-hover:text-primary group-hover:border-primary/40 transition-colors shrink-0">
                          <Server className="size-4" />
                        </div>
                        <div className="min-w-0">
                          <Link
                            href={`/nodes/${node.id}`}
                            onClick={(e) => e.stopPropagation()}
                            className="font-semibold text-foreground group-hover:text-primary transition-colors truncate block text-sm"
                          >
                            {node.name}
                          </Link>
                          <div className="text-[11px] text-muted-foreground truncate">
                            {node.os}
                          </div>
                        </div>
                      </div>
                    </TableCell>

                    {/* Status */}
                    <TableCell>
                      <StatusBadge status={node.status} size="sm" />
                    </TableCell>

                    {/* IP */}
                    <TableCell>
                      <span className="font-mono text-xs text-foreground font-medium">
                        {node.ipAddress}
                      </span>
                    </TableCell>

                    {/* CPU */}
                    <TableCell className="font-mono text-xs">
                      {isOffline ? (
                        <span className="text-muted-foreground">0%</span>
                      ) : (
                        <div>
                          <span className={getMetricColor(node.usage.cpuPercent)}>
                            {node.usage.cpuPercent}%
                          </span>
                          <span className="text-[11px] text-muted-foreground ml-1 font-normal">
                            ({node.cpuTotalCores} cores)
                          </span>
                        </div>
                      )}
                      <div className="h-1 w-24 bg-muted/80 rounded-full overflow-hidden mt-1.5">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${
                            isOffline
                              ? 'bg-muted'
                              : node.usage.cpuPercent >= 90
                              ? 'bg-status-danger'
                              : node.usage.cpuPercent >= 70
                              ? 'bg-status-warning'
                              : 'bg-status-success'
                          }`}
                          style={{ width: `${isOffline ? 0 : node.usage.cpuPercent}%` }}
                        />
                      </div>
                    </TableCell>

                    {/* RAM */}
                    <TableCell className="font-mono text-xs">
                      {isOffline ? (
                        <span className="text-muted-foreground">0%</span>
                      ) : (
                        <div>
                          <span className={getMetricColor(memPct)}>{memPct}%</span>
                          <span className="text-[11px] text-muted-foreground ml-1 font-normal">
                            ({Math.round(node.usage.memoryUsedMb / 1024)}GB / {Math.round(node.memoryTotalMb / 1024)}GB)
                          </span>
                        </div>
                      )}
                      <div className="h-1 w-24 bg-muted/80 rounded-full overflow-hidden mt-1.5">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${
                            isOffline
                              ? 'bg-muted'
                              : memPct >= 90
                              ? 'bg-status-danger'
                              : memPct >= 70
                              ? 'bg-status-warning'
                              : 'bg-status-success'
                          }`}
                          style={{ width: `${isOffline ? 0 : memPct}%` }}
                        />
                      </div>
                    </TableCell>

                    {/* Action */}
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-muted/70 text-[11px] font-medium text-foreground shrink-0">
                          <Boxes className="size-3 text-muted-foreground" />
                          <span>{node.servicesCount}</span>
                        </span>

                        <Button
                          variant="ghost"
                          size="sm"
                          render={<Link href={`/nodes/${node.id}`} onClick={(e) => e.stopPropagation()} />}
                          className="h-8 text-xs gap-1 text-muted-foreground hover:text-primary group-hover:text-primary active:not-aria-[haspopup]:translate-y-px"
                        >
                          <span>View</span>
                          <ChevronRight className="size-3.5 group-hover:translate-x-0.5 transition-transform" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
