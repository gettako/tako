'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Node } from '@/lib/types';
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table';
import { StatusBadge } from '@/components/ui/status-badge';
import { Button } from '@/components/ui/button';
import { Server, ChevronRight, Boxes, Copy, Check } from 'lucide-react';
import { toast } from 'sonner';

interface NodesTableProps {
  nodes: Node[];
}

export function NodesTable({ nodes }: NodesTableProps) {
  const router = useRouter();
  const [copiedIp, setCopiedIp] = useState<string | null>(null);

  const handleCopyIp = (ip: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(ip);
    setCopiedIp(ip);
    toast.success(`IP address ${ip} copied`);
    setTimeout(() => setCopiedIp(null), 2000);
  };

  const getMetricColor = (pct: number) => {
    if (pct >= 90) return 'text-status-danger font-semibold';
    if (pct >= 70) return 'text-status-warning font-semibold';
    return 'text-foreground';
  };

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <Table>
        <TableHeader className="bg-muted/40 border-b border-border">
          <TableRow className="h-10 hover:bg-transparent">
            <TableHead className="w-[22%] min-w-[180px]">Node Hostname</TableHead>
            <TableHead className="w-[10%] min-w-[90px]">Status</TableHead>
            <TableHead className="w-[15%] min-w-[130px]">Network / IP</TableHead>
            <TableHead className="w-[14%] min-w-[125px]">CPU Utilization</TableHead>
            <TableHead className="w-[14%] min-w-[130px]">Memory (RAM)</TableHead>
            <TableHead className="w-[14%] min-w-[130px]">Disk Storage</TableHead>
            <TableHead className="text-right w-[11%] min-w-[100px]">Workloads</TableHead>
          </TableRow>
        </TableHeader>

        <TableBody className="divide-y divide-border/40">
          {nodes.map((node) => {
            const isOffline = node.status === 'offline';
            const cpuVal = node.usage?.cpuPercent ?? 0;
            const memUsed = node.usage?.memoryUsedMb ?? 0;
            const memLimit = node.memoryTotalMb || node.usage?.memoryLimitMb || 1;
            const memPct = node.memoryTotalMb > 0
              ? Math.min(100, Math.round((memUsed / memLimit) * 100))
              : 0;
            const diskUsed = node.usage?.diskUsedGb ?? 0;
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
                {/* 1. Node Hostname & OS */}
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

                {/* 2. Status Badge */}
                <TableCell>
                  <StatusBadge status={node.status} size="sm" />
                </TableCell>

                {/* 3. Network / IP Address */}
                <TableCell>
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-1.5 font-mono text-xs text-foreground font-medium">
                      <span>{node.ipAddress}</span>
                      <button
                        type="button"
                        onClick={(e) => handleCopyIp(node.ipAddress, e)}
                        className="text-muted-foreground hover:text-foreground p-0.5 rounded transition-colors active:not-aria-[haspopup]:translate-y-px"
                        title="Copy IP"
                        aria-label="Copy IP"
                      >
                        {copiedIp === node.ipAddress ? (
                          <Check className="size-3 text-status-success" />
                        ) : (
                          <Copy className="size-3" />
                        )}
                      </button>
                    </div>
                    {node.publicIp && (
                      <div className="text-[10px] font-mono text-muted-foreground/80">
                        Ext: {node.publicIp}
                      </div>
                    )}
                  </div>
                </TableCell>

                {/* 4. CPU Utilization */}
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

                {/* 5. Memory (RAM) */}
                <TableCell className="font-mono text-xs">
                  {isOffline ? (
                    <span className="text-muted-foreground">0%</span>
                  ) : (
                    <div>
                      <span className={getMetricColor(memPct)}>
                        {memPct}%
                      </span>
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

                {/* 6. Disk Storage */}
                <TableCell className="font-mono text-xs">
                  {isOffline ? (
                    <span className="text-muted-foreground">0%</span>
                  ) : (
                    <div>
                      <span className={getMetricColor(diskPct)}>
                        {diskPct}%
                      </span>
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

                {/* 6. Workloads & Action (Exact 6th Column) */}
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-2.5">
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
  );
}
