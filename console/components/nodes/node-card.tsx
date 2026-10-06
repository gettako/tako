'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Node } from '@/lib/types';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardAction,
  CardContent,
  CardFooter,
} from '@/components/ui/card';
import { StatusBadge } from '@/components/ui/status-badge';
import { ResourceBar } from '@/components/ui/resource-bar';
import { Server, Copy, Check, Boxes, ChevronRight, AlertCircle } from 'lucide-react';
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
  const memPct =
    node.memoryTotalMb > 0
      ? Math.round((node.usage.memoryUsedMb / node.memoryTotalMb) * 100)
      : 0;
  const diskPct =
    node.diskTotalGb > 0
      ? Math.round(((node.usage.diskUsedGb || 0) / node.diskTotalGb) * 100)
      : 0;

  return (
    <Link href={`/nodes/${node.id}`} className="block group outline-hidden h-[170px]">
      <Card
        size="sm"
        className="relative h-[170px] flex flex-col justify-between overflow-hidden transition-all duration-150 group-hover:border-foreground/40 active:not-aria-[haspopup]:translate-y-px py-0 gap-0"
      >
        <div className="p-4 pb-3 space-y-3">
          {/* Canonical CardHeader with CardAction */}
          <CardHeader className="p-0">
            <div className="space-y-0.5 min-w-0 pr-2">
              <div className="flex items-center gap-1.5">
                <Server className="size-3.5 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
                <CardTitle className="font-semibold text-sm sm:text-base text-foreground group-hover:text-primary transition-colors truncate">
                  {node.name}
                </CardTitle>
              </div>

              {/* IP Address & Public IP */}
              <CardDescription className="flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground">
                <span>{node.ipAddress}</span>
                <button
                  type="button"
                  onClick={handleCopyIp}
                  className="text-muted-foreground hover:text-foreground p-0.5 rounded transition-colors active:not-aria-[haspopup]:translate-y-px"
                  title="Copy IP"
                  aria-label="Copy IP address"
                >
                  {copiedIp ? (
                    <Check className="size-3 text-status-success" />
                  ) : (
                    <Copy className="size-3" />
                  )}
                </button>
                {node.publicIp && (
                  <span className="text-[10px] text-muted-foreground/70 hidden sm:inline">
                    ({node.publicIp})
                  </span>
                )}
              </CardDescription>
            </div>

            <CardAction>
              <StatusBadge status={node.status} size="sm" />
            </CardAction>
          </CardHeader>

          {/* CardContent: 3 Standard Resource Usage Bars */}
          <CardContent className="p-0">
            {isOffline ? (
              <div className="flex items-center gap-2 rounded-lg bg-status-danger/10 border border-status-danger/25 px-2.5 py-1.5 text-xs text-status-danger font-mono">
                <AlertCircle className="size-3.5 shrink-0" />
                <span>Host unreachable • Heartbeat signal lost</span>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2.5">
                {/* CPU Utilization Bar */}
                <div className="space-y-0.5">
                  <ResourceBar
                    label="CPU"
                    value={node.usage.cpuPercent}
                    unit="%"
                    size="sm"
                    showPercentage={false}
                    className="space-y-1"
                  />
                  <span className="text-[10px] font-mono text-muted-foreground/80 block leading-tight">
                    {node.cpuTotalCores} cores
                  </span>
                </div>

                {/* RAM Allocation Bar */}
                <div className="space-y-0.5">
                  <ResourceBar
                    label="RAM"
                    value={memPct}
                    unit="%"
                    size="sm"
                    showPercentage={false}
                    className="space-y-1"
                  />
                  <span className="text-[10px] font-mono text-muted-foreground/80 block leading-tight">
                    {Math.round(node.memoryTotalMb / 1024)} GB
                  </span>
                </div>

                {/* Disk Storage Bar */}
                <div className="space-y-0.5">
                  <ResourceBar
                    label="Disk"
                    value={diskPct}
                    unit="%"
                    size="sm"
                    showPercentage={false}
                    className="space-y-1"
                  />
                  <span className="text-[10px] font-mono text-muted-foreground/80 block leading-tight">
                    {node.diskTotalGb} GB
                  </span>
                </div>
              </div>
            )}
          </CardContent>
        </div>

        {/* Canonical CardFooter */}
        <CardFooter className="px-4 py-2.5 border-t border-border flex items-center justify-between text-xs text-muted-foreground h-10 shrink-0">
          <span className="truncate text-[11px] font-normal pr-2">{node.os}</span>

          <div className="flex items-center gap-1.5 shrink-0">
            <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-muted/80 text-[10px] font-medium text-foreground">
              <Boxes className="size-3 text-muted-foreground" />
              {node.servicesCount} {node.servicesCount === 1 ? 'service' : 'services'}
            </span>
            <ChevronRight className="size-3.5 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-transform" />
          </div>
        </CardFooter>
      </Card>
    </Link>
  );
}
