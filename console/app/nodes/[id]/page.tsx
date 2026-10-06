'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { getNodeById } from '@/lib/api/nodes';
import { getServices } from '@/lib/api/services';
import { getProjects } from '@/lib/api/projects';
import { getTimeSeriesMetrics } from '@/lib/api/metrics';
import { NodeSpecHeader } from '@/components/nodes/node-spec-header';
import { NodeMetricsCharts } from '@/components/nodes/node-metrics-charts';
import { NodeServicesTable } from '@/components/nodes/node-services-table';
import { LoadingSkeleton } from '@/components/ui/loading-skeleton';
import { ErrorState } from '@/components/ui/error-state';

export default function NodeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = React.use(params);
  const { id } = resolvedParams;

  const {
    data: node,
    isLoading: loadingNode,
    error: errorNode,
    refetch: refetchNode,
  } = useQuery({
    queryKey: ['node', id],
    queryFn: () => getNodeById(id),
  });

  const { data: metrics = [] } = useQuery({
    queryKey: ['node-metrics', id],
    queryFn: () => getTimeSeriesMetrics(id, '1h'),
    enabled: !!node,
  });

  const { data: allServices = [] } = useQuery({
    queryKey: ['services'],
    queryFn: () => getServices(),
    enabled: !!node,
  });

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: getProjects,
    enabled: !!node,
  });

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
        {/* Node Specifications & Header (AC-4) */}
        <NodeSpecHeader node={node} onRefresh={() => refetchNode()} />

        {/* 4-Chart Telemetry Breakdown (AC-5) */}
        <NodeMetricsCharts metrics={metrics} nodeName={node.name} />

        {/* Connected Container Services (AC-6) */}
        <NodeServicesTable
          services={hostedServices}
          projects={projects}
          nodeName={node.name}
        />
      </div>
    </>
  );
}
