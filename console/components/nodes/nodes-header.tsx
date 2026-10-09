'use client';

import React from 'react';
import { Plus, RotateCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface NodesHeaderProps {
  totalCount: number;
  onlineCount: number;
  offlineCount: number;
  degradedCount: number;
  onCreateNode: () => void;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

export function NodesHeader({
  totalCount,
  onlineCount,
  offlineCount,
  degradedCount,
  onCreateNode,
  onRefresh,
  isRefreshing = false,
}: NodesHeaderProps) {
  const isAllHealthy = totalCount > 0 && offlineCount === 0 && degradedCount === 0;
  const hasIssues = offlineCount > 0 || degradedCount > 0;

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="space-y-1 min-w-0 flex-1">
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-2xl font-bold tracking-tight text-foreground font-sans">
            Cluster Nodes
          </h1>

          {isAllHealthy ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-status-success/30 bg-status-success/10 px-2.5 py-0.5 text-xs font-medium text-status-success">
              <span className="size-1.5 rounded-full bg-status-success animate-pulse" />
              All Systems Operational
            </span>
          ) : hasIssues ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-status-danger/30 bg-status-danger/10 px-2.5 py-0.5 text-xs font-medium text-status-danger">
              <span className="size-1.5 rounded-full bg-status-danger animate-pulse" />
              {offlineCount > 0
                ? `${offlineCount} ${offlineCount === 1 ? 'Node' : 'Nodes'} Offline`
                : `${degradedCount} ${degradedCount === 1 ? 'Node' : 'Nodes'} Degraded`}
            </span>
          ) : null}
        </div>

        <p className="text-sm text-muted-foreground">
          Physical hosts, virtual machines, and cloud instances orchestrating cluster workloads.
        </p>
      </div>

      <div className="flex items-center gap-2.5 shrink-0 self-start sm:self-auto">
        {onRefresh && (
          <Button
            variant="outline"
            size="sm"
            onClick={onRefresh}
            disabled={isRefreshing}
            className="gap-1.5 text-xs sm:text-sm h-9 px-3 active:not-aria-[haspopup]:translate-y-px cursor-pointer"
          >
            <RotateCw className={cn('size-3.5', isRefreshing && 'animate-spin')} />
            <span>{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
          </Button>
        )}

        <Button
          onClick={onCreateNode}
          size="sm"
          className="gap-1.5 text-xs sm:text-sm h-9 px-3.5 bg-primary text-primary-foreground hover:bg-primary/90 active:not-aria-[haspopup]:translate-y-px cursor-pointer"
        >
          <Plus className="size-3.5" />
          <span>Create Node</span>
        </Button>
      </div>
    </div>
  );
}
