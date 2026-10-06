'use client';

import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getNodes } from '@/lib/api/nodes';
import { NodesHeader } from '@/components/nodes/nodes-header';
import { NodesStats } from '@/components/nodes/nodes-stats';
import {
  NodesFilterBar,
  StatusFilter,
} from '@/components/nodes/nodes-filter-bar';
import { NodeCard } from '@/components/nodes/node-card';
import { NodesTable } from '@/components/nodes/nodes-table';
import { ViewMode } from '@/components/ui/view-toggle';
import { EmptyState } from '@/components/ui/empty-state';
import { LoadingSkeleton } from '@/components/ui/loading-skeleton';
import { Server, AlertTriangle, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function NodesPage() {
  const [search, setSearch] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<StatusFilter>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');

  const { data: nodes = [], isLoading } = useQuery({
    queryKey: ['nodes'],
    queryFn: getNodes,
  });

  const statusCounts = useMemo(() => {
    return {
      all: nodes.length,
      online: nodes.filter((n) => n.status === 'online').length,
      degraded: nodes.filter((n) => n.status === 'degraded').length,
      offline: nodes.filter((n) => n.status === 'offline').length,
    };
  }, [nodes]);

  const filteredNodes = useMemo(() => {
    let result = nodes;

    if (selectedStatus !== 'all') {
      result = result.filter((n) => n.status === selectedStatus);
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (n) =>
          n.name.toLowerCase().includes(q) ||
          n.ipAddress.toLowerCase().includes(q) ||
          (n.publicIp && n.publicIp.toLowerCase().includes(q)) ||
          n.os.toLowerCase().includes(q)
      );
    }

    return result;
  }, [nodes, selectedStatus, search]);

  const offlineNodes = nodes.filter((n) => n.status === 'offline');
  const hasActiveFilters = search.trim().length > 0 || selectedStatus !== 'all';

  return (
    <>
      <title>Cluster Nodes — Takō Cloud</title>
      <div className="space-y-6">
        {/* 1. Page Header */}
        <NodesHeader
          totalCount={nodes.length}
          onlineCount={statusCounts.online}
          offlineCount={statusCounts.offline}
          degradedCount={statusCounts.degraded}
        />

        {isLoading ? (
          <LoadingSkeleton variant="cards" count={4} />
        ) : (
          <>
            {/* 2. Cluster Hardware Telemetry Summary */}
            <NodesStats nodes={nodes} />

            {/* 3. Offline Nodes Warning Banner */}
            {offlineNodes.length > 0 && selectedStatus !== 'offline' && (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-status-danger/30 bg-status-danger/10 p-4 transition-colors">
                <div className="flex items-start gap-3">
                  <div className="flex size-9 items-center justify-center rounded-lg bg-status-danger/15 text-status-danger shrink-0 mt-0.5">
                    <AlertTriangle className="size-4 animate-pulse" />
                  </div>
                  <div className="text-xs space-y-0.5">
                    <span className="font-semibold text-status-danger text-sm">
                      {offlineNodes.length} {offlineNodes.length === 1 ? 'Node is' : 'Nodes are'} Currently Offline
                    </span>
                    <p className="text-muted-foreground">
                      Container workloads on {offlineNodes.map((n) => n.name).join(', ')} cannot receive traffic until heartbeat signals re-establish.
                    </p>
                  </div>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedStatus('offline')}
                  className="text-xs border-status-danger/30 text-status-danger hover:bg-status-danger/15 self-start sm:self-auto shrink-0 active:not-aria-[haspopup]:translate-y-px"
                >
                  <span>Filter Offline Nodes</span>
                  <ArrowRight className="size-3.5 ml-1" />
                </Button>
              </div>
            )}

            {/* 4. Search, Filter & View Switcher Bar */}
            <NodesFilterBar
              searchQuery={search}
              onSearchChange={setSearch}
              selectedStatus={selectedStatus}
              onStatusChange={setSelectedStatus}
              totalCount={nodes.length}
              filteredCount={filteredNodes.length}
              viewMode={viewMode}
              onViewModeChange={setViewMode}
              statusCounts={statusCounts}
            />

            {/* 5. Nodes Content (Airy Grid vs Table) */}
            {filteredNodes.length === 0 ? (
              <EmptyState
                icon={Server}
                title="No nodes match criteria"
                description={
                  hasActiveFilters
                    ? `No cluster nodes matched your active search query or filter selection.`
                    : 'No cluster nodes configured yet.'
                }
                action={
                  hasActiveFilters
                    ? {
                        label: 'Reset Filters',
                        onClick: () => {
                          setSearch('');
                          setSelectedStatus('all');
                        },
                      }
                    : {
                        label: 'Create First Node',
                        onClick: () =>
                          window.dispatchEvent(
                            new CustomEvent('open-create-node-dialog')
                          ),
                      }
                }
              />
            ) : viewMode === 'grid' ? (
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {filteredNodes.map((node) => (
                  <NodeCard key={node.id} node={node} />
                ))}
              </div>
            ) : (
              <NodesTable nodes={filteredNodes} />
            )}
          </>
        )}
      </div>
    </>
  );
}
