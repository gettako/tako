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
import { Server, Boxes, Copy, Check, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { EditNodeDialog } from './edit-node-dialog';
import { DeleteNodeDialog } from './delete-node-dialog';

interface NodesTableProps {
  nodes: Node[];
}

export function NodesTable({ nodes }: NodesTableProps) {
  const router = useRouter();
  const [copiedIp, setCopiedIp] = useState<string | null>(null);
  const [editingNode, setEditingNode] = useState<Node | null>(null);
  const [deletingNode, setDeletingNode] = useState<Node | null>(null);

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
    <>
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/40 border-b border-border">
            <TableRow className="h-10 hover:bg-transparent">
              <TableHead className="w-[20%] min-w-[170px]">Node Hostname</TableHead>
              <TableHead className="w-[10%] min-w-[85px]">Status</TableHead>
              <TableHead className="w-[14%] min-w-[125px]">Network / IP</TableHead>
              <TableHead className="w-[13%] min-w-[120px]">CPU Utilization</TableHead>
              <TableHead className="w-[13%] min-w-[120px]">Memory (RAM)</TableHead>
              <TableHead className="w-[13%] min-w-[120px]">Disk Storage</TableHead>
              <TableHead className="text-center w-[7%] min-w-[65px]">Workloads</TableHead>
              <TableHead className="text-right w-[10%] min-w-[90px]">Actions</TableHead>
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

                {/* 7. Workloads */}
                <TableCell className="text-center">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-muted/70 text-[11px] font-medium text-foreground shrink-0 font-mono">
                    <Boxes className="size-3 text-muted-foreground" />
                    <span>{node.servicesCount}</span>
                  </span>
                </TableCell>

                {/* 8. Actions: Direct Edit and Delete buttons */}
                <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center justify-end gap-1">
                    <button
                      type="button"
                      id={`edit-node-${node.id}`}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setEditingNode(node);
                      }}
                      className="size-8 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors cursor-pointer active:not-aria-[haspopup]:translate-y-px"
                      title="Edit Node"
                      aria-label={`Edit ${node.name}`}
                    >
                      <Pencil className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      id={`delete-node-${node.id}`}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setDeletingNode(node);
                      }}
                      className="size-8 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-status-danger hover:bg-status-danger/10 transition-colors cursor-pointer active:not-aria-[haspopup]:translate-y-px"
                      title="Delete Node"
                      aria-label={`Delete ${node.name}`}
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>

    {/* Edit Node Specifications Dialog */}
    <EditNodeDialog
      node={editingNode}
      open={!!editingNode}
      onOpenChange={(open) => {
        if (!open) setEditingNode(null);
      }}
    />

    {/* Delete Node Confirmation Dialog */}
    <DeleteNodeDialog
      node={deletingNode}
      open={!!deletingNode}
      onOpenChange={(open) => {
        if (!open) setDeletingNode(null);
      }}
    />
  </>
  );
}
