'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Node } from '@/lib/types';
import { StatusAccentCard } from '@/components/ui/status-accent-card';
import { StatusBadge } from '@/components/ui/status-badge';
import { Badge } from '@/components/ui/badge';
import { Server, Copy, Check, Boxes, ChevronRight, HardDrive, Cpu, Layers } from 'lucide-react';
import { toast } from 'sonner';

interface NodeCardProps {
  node: Node;
}

export function NodeCard({ node }: NodeCardProps) {
  const [copiedIp, setCopiedIp] = useState(false);

  const handleCopyIp = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    navigator.clipboard.writeText(node.ipAddress);
    setCopiedIp(true);
    toast.success(`IP address ${node.ipAddress} copied`);
    setTimeout(() => setCopiedIp(false), 2000);
  };

  const isOffline = node.status === 'offline';
  const memPct = node.memoryTotalMb > 0
    ? Math.round((node.usage.memoryUsedMb / node.memoryTotalMb) * 100)
    : 0;
  const diskPct = node.diskTotalGb > 0
    ? Math.round(((node.usage.diskUsedGb || 0) / node.diskTotalGb) * 100)
    : 0;

  return (
    <Link href={`/nodes/${node.id}`} className="block group">
      <StatusAccentCard
        status={node.status}
        className="h-full flex flex-col justify-between p-4 sm:p-4.5 transition-all group-hover:border-primary/40 group-hover:shadow-md"
      >
        <div className="space-y-3">
          {/* Header Row: Hostname, Role, Status */}
          <div className="flex items-start justify-between gap-2.5">
            <div className="space-y-0.5 min-w-0">
              <div className="flex items-center gap-1.5">
                <Server className="size-3.5 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
                <h3 className="font-semibold text-sm sm:text-base text-foreground truncate group-hover:text-primary transition-colors">
                  {node.name}
                </h3>
              </div>

              {/* IP address with copy button */}
              <div className="flex items-center gap-1.5 text-xs font-mono text-muted-foreground">
                <span>{node.ipAddress}</span>
                <button
                  type="button"
                  onClick={handleCopyIp}
                  className="hover:text-foreground p-0.5 rounded transition-colors"
                  title="Copy IP"
                >
                  {copiedIp ? (
                    <Check className="size-3 text-status-success" />
                  ) : (
                    <Copy className="size-3" />
                  )}
                </button>
                {node.publicIp && (
                  <span className="text-[11px] text-muted-foreground/70 hidden sm:inline">
                    ({node.publicIp})
                  </span>
                )}
              </div>
            </div>

            <div className="flex flex-col items-end gap-1 shrink-0">
              <StatusBadge status={node.status} size="sm" />
              <Badge
                variant="outline"
                className={`text-[10px] font-mono capitalize px-1.5 py-0 ${
                  node.role === 'leader'
                    ? 'border-primary/40 bg-primary/10 text-primary font-semibold'
                    : 'border-border/60 bg-muted/60 text-muted-foreground'
                }`}
              >
                {node.role}
              </Badge>
            </div>
          </div>

          {/* Mini Horizontal Gauges (CPU, RAM, Disk) */}
          <div className="grid grid-cols-3 gap-2 pt-2.5 border-t border-border/40">
            {/* CPU Gauge */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground flex items-center gap-1 font-medium text-[11px]">
                  <Cpu className="size-3 text-primary shrink-0" />
                  CPU
                </span>
                <span className="font-mono text-[11px] text-foreground font-semibold">
                  {isOffline ? '0%' : `${node.usage.cpuPercent}%`}
                </span>
              </div>
              <div className="h-1.5 w-full bg-muted/80 rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-300"
                  style={{ width: `${isOffline ? 0 : node.usage.cpuPercent}%` }}
                />
              </div>
              <span className="text-[10px] text-muted-foreground/70 block leading-none">
                {node.cpuTotalCores} cores
              </span>
            </div>

            {/* RAM Gauge */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground flex items-center gap-1 font-medium text-[11px]">
                  <Layers className="size-3 text-status-success shrink-0" />
                  RAM
                </span>
                <span className="font-mono text-[11px] text-foreground font-semibold">
                  {isOffline ? '0%' : `${memPct}%`}
                </span>
              </div>
              <div className="h-1.5 w-full bg-muted/80 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                  style={{ width: `${isOffline ? 0 : memPct}%` }}
                />
              </div>
              <span className="text-[10px] text-muted-foreground/70 block leading-none">
                {Math.round(node.memoryTotalMb / 1024)} GB
              </span>
            </div>

            {/* Disk Gauge */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground flex items-center gap-1 font-medium text-[11px]">
                  <HardDrive className="size-3 text-status-warning shrink-0" />
                  Disk
                </span>
                <span className="font-mono text-[11px] text-foreground font-semibold">
                  {diskPct}%
                </span>
              </div>
              <div className="h-1.5 w-full bg-muted/80 rounded-full overflow-hidden">
                <div
                  className="h-full bg-amber-500 rounded-full transition-all duration-300"
                  style={{ width: `${diskPct}%` }}
                />
              </div>
              <span className="text-[10px] text-muted-foreground/70 block leading-none">
                {node.diskTotalGb} GB
              </span>
            </div>
          </div>
        </div>

        {/* Footer: OS / Docker version, Service Count */}
        <div className="pt-3 mt-3 border-t border-border/40 flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5 truncate pr-2">
            <span className="truncate text-xs">{node.os}</span>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-muted/80 text-[11px] font-medium text-foreground">
              <Boxes className="size-3 text-muted-foreground" />
              {node.servicesCount} {node.servicesCount === 1 ? 'service' : 'services'}
            </span>
            <ChevronRight className="size-3.5 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
          </div>
        </div>
      </StatusAccentCard>
    </Link>
  );
}
