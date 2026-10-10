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
import { LoadingSkeleton } from '@/components/ui/loading-skeleton';
import { ErrorState } from '@/components/ui/error-state';
import { Activity, Sliders } from 'lucide-react';
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

  const [activeTab, setActiveTab] = useState<'overview' | 'traefik'>('overview');
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

        {/* Navigation Tabs */}
        <div className="flex items-center gap-1 border-b border-border">
          <button
            type="button"
            onClick={() => setActiveTab('overview')}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px active:not-aria-[haspopup]:translate-y-px ${
              activeTab === 'overview'
                ? 'border-primary text-foreground font-semibold'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Activity className="size-4" />
            <span>Overview & Metrics</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('traefik')}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px active:not-aria-[haspopup]:translate-y-px ${
              activeTab === 'traefik'
                ? 'border-primary text-foreground font-semibold'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Sliders className="size-4" />
            <span>Traefik Ingress</span>
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* 4-Chart Telemetry Breakdown */}
            <NodeMetricsCharts
              metrics={metrics}
              nodeName={node.name}
              timeRange={timeRange}
              onTimeRangeChange={setTimeRange}
            />

            {/* Connected Container Services */}
            <NodeServicesTable
              services={hostedServices}
              projects={projects}
              nodeName={node.name}
            />
          </div>
        )}

        {activeTab === 'traefik' && (
          <div className="space-y-6">
            <NodeTraefikPanel node={node} />
          </div>
        )}
      </div>
    </>
  );
}
