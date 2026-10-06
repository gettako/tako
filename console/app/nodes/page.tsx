'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getNodes } from '@/lib/api/nodes';
import { NodesStats } from '@/components/nodes/nodes-stats';
import { NodeCard } from '@/components/nodes/node-card';
import { NodesTable } from '@/components/nodes/nodes-table';
import { ViewToggle } from '@/components/ui/view-toggle';
import { Input } from '@/components/ui/input';
import { EmptyState } from '@/components/ui/empty-state';
import { LoadingSkeleton } from '@/components/ui/loading-skeleton';
import { Server, Search, AlertTriangle } from 'lucide-react';

export default function NodesPage() {
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

  const { data: nodes = [], isLoading } = useQuery({
    queryKey: ['nodes'],
    queryFn: getNodes,
  });

  const filteredNodes = nodes.filter((n) => {
    const q = search.toLowerCase();
    return (
      n.name.toLowerCase().includes(q) ||
      n.ipAddress.toLowerCase().includes(q) ||
      (n.publicIp && n.publicIp.toLowerCase().includes(q)) ||
      n.os.toLowerCase().includes(q) ||
      n.role.toLowerCase().includes(q)
    );
  });

  const offlineNodes = nodes.filter((n) => n.status === 'offline');

  return (
    <>
      <title>Cluster Nodes — Takō Cloud</title>
      <div className="space-y-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Cluster Nodes
          </h1>
          <p className="text-base text-muted-foreground mt-1">
            Physical hosts and virtual machines registered to your Tako container orchestrator.
          </p>
        </div>

        {/* Search & View Toggle */}
        <div className="flex items-center gap-3">
          <div className="relative w-72">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search hostname or IP..."
              className="pl-8 text-sm h-9 bg-card"
            />
          </div>
          <ViewToggle mode={viewMode} onChange={setViewMode} />
        </div>
      </div>

      {isLoading ? (
        <LoadingSkeleton variant="detail" />
      ) : (
        <>
          {/* Cluster Hardware Summary (AC-1) */}
          <NodesStats nodes={nodes} />

          {/* Offline Nodes Warning Banner (AC-9) */}
          {offlineNodes.length > 0 && (
            <div className="flex items-start gap-3 rounded-lg border border-status-danger/40 bg-status-danger/10 p-4">
              <AlertTriangle className="size-5 text-status-danger shrink-0 mt-0.5" />
              <div className="text-xs space-y-1">
                <span className="font-semibold text-status-danger">
                  {offlineNodes.length} {offlineNodes.length === 1 ? 'Node is' : 'Nodes are'} Currently Offline
                </span>
                <p className="text-muted-foreground">
                  Container instances hosted on {offlineNodes.map((n) => n.name).join(', ')} cannot receive traffic until heartbeat re-establishes.
                </p>
              </div>
            </div>
          )}

          {/* Nodes Content (Grid vs Table) */}
          {filteredNodes.length === 0 ? (
            <EmptyState
              icon={Server}
              title="No nodes found"
              description={
                search
                  ? `No cluster nodes matching "${search}". Try clearing your search filter.`
                  : 'No cluster nodes configured yet.'
              }
              action={
                search
                  ? {
                      label: 'Clear Search',
                      onClick: () => setSearch(''),
                    }
                  : undefined
              }
            />
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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
