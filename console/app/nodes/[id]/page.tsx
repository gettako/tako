'use client';

import React, { useState } from 'react';
import {
  useNode,
  useServices,
  useProjects,
  useTimeSeriesMetrics,
} from '@/lib/queries';
import { NodeSpecHeader } from '@/components/nodes/node-spec-header';
import { NodeMetricsCharts, NodeTimeRange } from '@/components/nodes/node-metrics-charts';
import { NodeServicesTable } from '@/components/nodes/node-services-table';
import { NodeTraefikPanel } from '@/components/nodes/node-traefik-panel';
import { NodeTraefikFiles } from '@/components/nodes/node-traefik-files';
import { LoadingSkeleton } from '@/components/ui/loading-skeleton';
import { ErrorState } from '@/components/ui/error-state';
import { Activity, Sliders, FolderTree } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNodeEvents } from '@/hooks/use-node-events';

export default function NodeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = React.use(params);
  const { id } = resolvedParams;

  // Subscribe to live node events via SSE (metrics & status changes)
  useNodeEvents();

  const [activeTab, setActiveTab] = useState<'overview' | 'traefik' | 'files'>('overview');
  const [timeRange, setTimeRange] = useState<NodeTimeRange>('1h');

  const {
    data: node,
    isLoading: loadingNode,
    error: errorNode,
    refetch: refetchNode,
  } = useNode(id);

  const {
    data: metrics = [],
    refetch: refetchMetrics,
  } = useTimeSeriesMetrics(id, timeRange, {
    enabled: !!node,
    refetchInterval: 15000,
  });

  const { data: allServices = [] } = useServices(undefined, {
    enabled: !!node,
  });

  const { data: projects = [] } = useProjects({
    enabled: !!node,
  });

  const handleRefresh = async () => {
    await Promise.all([refetchNode(), refetchMetrics()]);
  };

  const titleText = node ? `${node.name} — Takō Cloud` : 'Node Details — Takō Cloud';

  if (errorNode || (!loadingNode && !node)) {
    return (
      <>
        <title>{titleText}</title>
        <ErrorState
          title="Node Not Found"
          description={`The cluster node with identifier "${id}" does not exist.`}
          retry={() => refetchNode()}
        />
      </>
    );
  }

  if (loadingNode || !node) {
    return (
      <>
        <title>{titleText}</title>
        <LoadingSkeleton variant="detail" />
      </>
    );
  }

  const hostedServices = allServices.filter((s) => s.nodeId === node.id);

  return (
    <>
      <title>{titleText}</title>
      <div className="space-y-6">
        {/* Node Specifications & Header */}
        <NodeSpecHeader node={node} onRefresh={handleRefresh} />

        {/* Navigation Tabs (Line / Underline Tab - Consistent with ServiceTabs & Vega Standards) */}
        <div className="border-b border-border overflow-x-auto scrollbar-none">
          <nav className="flex space-x-1 sm:space-x-2 min-w-max pb-px">
            <button
              type="button"
              onClick={() => setActiveTab('overview')}
              className={cn(
                'flex items-center gap-2 border-b-2 px-3.5 py-2.5 text-xs sm:text-sm font-medium transition-colors select-none whitespace-nowrap active:not-aria-[haspopup]:translate-y-px cursor-pointer',
                activeTab === 'overview'
                  ? 'border-primary text-primary font-semibold'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border/60'
              )}
            >
              <Activity
                className={cn('size-4 shrink-0', activeTab === 'overview' ? 'text-primary' : 'text-muted-foreground')}
              />
              <span>Overview & Metrics</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('traefik')}
              className={cn(
                'flex items-center gap-2 border-b-2 px-3.5 py-2.5 text-xs sm:text-sm font-medium transition-colors select-none whitespace-nowrap active:not-aria-[haspopup]:translate-y-px cursor-pointer',
                activeTab === 'traefik'
                  ? 'border-primary text-primary font-semibold'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border/60'
              )}
            >
              <Sliders
                className={cn('size-4 shrink-0', activeTab === 'traefik' ? 'text-primary' : 'text-muted-foreground')}
              />
              <span>Traefik Ingress</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('files')}
              className={cn(
                'flex items-center gap-2 border-b-2 px-3.5 py-2.5 text-xs sm:text-sm font-medium transition-colors select-none whitespace-nowrap active:not-aria-[haspopup]:translate-y-px cursor-pointer',
                activeTab === 'files'
                  ? 'border-primary text-primary font-semibold'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border/60'
              )}
            >
              <FolderTree
                className={cn('size-4 shrink-0', activeTab === 'files' ? 'text-primary' : 'text-muted-foreground')}
              />
              <span>Routing Files & Editor</span>
            </button>
          </nav>
        </div>

        {/* Tab 1: Overview & Metrics */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <NodeMetricsCharts
              metrics={metrics}
              nodeName={node.name}
              timeRange={timeRange}
              onTimeRangeChange={setTimeRange}
            />

            <NodeServicesTable
              services={hostedServices}
              projects={projects}
              nodeName={node.name}
            />
          </div>
        )}

        {/* Tab 2: Traefik Ingress Configuration */}
        {activeTab === 'traefik' && (
          <div className="space-y-6">
            <NodeTraefikPanel node={node} />
          </div>
        )}

        {/* Tab 3: Dynamic Config Files & Editor */}
        {activeTab === 'files' && (
          <div className="mt-2">
            <NodeTraefikFiles node={node} />
          </div>
        )}
      </div>
    </>
  );
}
