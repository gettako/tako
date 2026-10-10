'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
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
import { Server, Boxes } from 'lucide-react';

interface MonitoringNodesTableProps {
  nodes: Node[];
}

export function MonitoringNodesTable({ nodes }: MonitoringNodesTableProps) {
  const router = useRouter();

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
              <TableRow className="h-10 hover:bg-transparent">
                <TableHead className="w-[22%] min-w-[180px]">Node Host</TableHead>
                <TableHead className="w-[10%] min-w-[90px]">Status</TableHead>
                <TableHead className="w-[15%] min-w-[130px]">IP Address</TableHead>
                <TableHead className="w-[14%] min-w-[125px]">CPU Utilization</TableHead>
                <TableHead className="w-[14%] min-w-[130px]">Memory (RAM)</TableHead>
                <TableHead className="w-[14%] min-w-[130px]">Disk Storage</TableHead>
                <TableHead className="text-right w-[11%] min-w-[100px]">Workloads</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody className="divide-y divide-border/40">
              {nodes.map((node) => {
                const isOffline = node.status === 'offline';
                const cpuVal = node.usage?.cpuPercent || 0;
                const memUsed = node.usage?.memoryUsedMb || 0;
                const memLimit = node.memoryTotalMb || node.usage?.memoryLimitMb || 1;
                const memPct = node.memoryTotalMb > 0
                  ? Math.min(100, Math.round((memUsed / memLimit) * 100))
                  : 0;
                const diskUsed = node.usage?.diskUsedGb || 0;
                const diskTotal = node.diskTotalGb || node.usage?.diskTotalGb || 1;
                const diskPct = node.diskTotalGb > 0
                  ? Math.min(100, Math.round((diskUsed / diskTotal) * 100))
                  : 0;

                const formatGb = (val: number) => {
                  const rounded = Math.round(val * 100) / 100;
                  return rounded % 1 === 0 ? `${rounded.toFixed(0)} GiB` : `${rounded.toFixed(2)} GiB`;
                };

                return (
                  <TableRow
                    key={node.id}
                    className="h-14 hover:bg-muted/30 transition-colors group cursor-pointer"
                    onClick={() => {
                      router.push(`/nodes/${node.id}`);
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
                          <span className={getMetricColor(cpuVal)}>
                            {cpuVal}%
                          </span>
                          <span className="text-[11px] text-muted-foreground ml-1.5 font-normal">
                            ({node.cpuTotalCores} cores)
                          </span>
                        </div>
                      )}
                      <div className="h-1 w-24 bg-muted/80 rounded-full overflow-hidden mt-1.5">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${
                            isOffline
                              ? 'bg-muted'
                              : cpuVal >= 90
                              ? 'bg-status-danger'
                              : cpuVal >= 70
                              ? 'bg-status-warning'
                              : 'bg-status-success'
                          }`}
                          style={{ width: `${isOffline ? 0 : Math.min(100, Math.max(0, cpuVal))}%` }}
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
                          <span className="text-[11px] text-muted-foreground ml-1.5 font-normal">
                            ({formatGb(memUsed / 1024)} / {formatGb((node.memoryTotalMb || memLimit) / 1024)})
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
                          style={{ width: `${isOffline ? 0 : Math.min(100, Math.max(0, memPct))}%` }}
                        />
                      </div>
                    </TableCell>

                    {/* Disk */}
                    <TableCell className="font-mono text-xs">
                      {isOffline ? (
                        <span className="text-muted-foreground">0%</span>
                      ) : (
                        <div>
                          <span className={getMetricColor(diskPct)}>{diskPct}%</span>
                          <span className="text-[11px] text-muted-foreground ml-1.5 font-normal">
                            ({formatGb(diskUsed)} / {formatGb(node.diskTotalGb || diskTotal)})
                          </span>
                        </div>
                      )}
                      <div className="h-1 w-24 bg-muted/80 rounded-full overflow-hidden mt-1.5">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${
                            isOffline
                              ? 'bg-muted'
                              : diskPct >= 90
                              ? 'bg-status-danger'
                              : diskPct >= 70
                              ? 'bg-status-warning'
                              : 'bg-status-success'
                          }`}
                          style={{ width: `${isOffline ? 0 : Math.min(100, Math.max(0, diskPct))}%` }}
                        />
                      </div>
                    </TableCell>

                    {/* Workloads */}
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-muted/70 text-[11px] font-medium text-foreground shrink-0 font-mono">
                          <Boxes className="size-3 text-muted-foreground" />
                          <span>{node.servicesCount}</span>
                        </span>
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
