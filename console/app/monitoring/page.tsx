'use client';

import React, { useState } from 'react';
import { useQuery, useQueries } from '@tanstack/react-query';
import { getNodes } from '@/lib/api/nodes';
import { getTimeSeriesMetrics, MetricPoint } from '@/lib/api/metrics';
import { MonitoringHeader, TimeRange } from '@/components/monitoring/monitoring-header';
import { ClusterMetricChart, NodeSeriesData } from '@/components/monitoring/cluster-metric-chart';
import { NetworkDiskCharts } from '@/components/monitoring/network-disk-charts';
import { MonitoringNodesTable } from '@/components/monitoring/monitoring-nodes-table';
import { LoadingSkeleton } from '@/components/ui/loading-skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { Server } from 'lucide-react';
import { useNodeEvents } from '@/hooks/use-node-events';

const NODE_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'];
const DASH_PATTERNS = [undefined, undefined, '4 4', '2 2', '6 3'];

export default function MonitoringPage() {
  const [timeRange, setTimeRange] = useState<TimeRange>('1h');

  // Subscribe to live node events via SSE (metrics & status changes)
  useNodeEvents();

  const {
    data: nodes = [],
    isLoading: loadingNodes,
    refetch: refetchNodes,
    isRefetching: refetchingNodes,
  } = useQuery({
    queryKey: ['nodes'],
    queryFn: getNodes,
    refetchInterval: 10000,
  });

  const {
    data: clusterMetrics = [],
    isLoading: loadingMetrics,
    refetch: refetchMetrics,
    isRefetching: refetchingMetrics,
  } = useQuery({
    queryKey: ['cluster-metrics', timeRange],
    queryFn: () => getTimeSeriesMetrics('cluster', timeRange),
    refetchInterval: 15000,
  });

  // Dynamically fetch metrics for each registered node
  const nodeMetricsQueries = useQueries({
    queries: nodes.map((node) => ({
      queryKey: ['node-metrics', node.id, timeRange],
      queryFn: () => getTimeSeriesMetrics(node.id, timeRange),
      refetchInterval: 15000,
    })),
  });

  const isRefreshing =
    refetchingNodes ||
    refetchingMetrics ||
    nodeMetricsQueries.some((q) => q.isRefetching);

  const handleRefresh = async () => {
    await Promise.all([
      refetchNodes(),
      refetchMetrics(),
      ...nodeMetricsQueries.map((q) => q.refetch()),
    ]);
  };

  const nodeMetricsMap: Record<string, MetricPoint[]> = {};
  nodes.forEach((node, index) => {
    const qData = nodeMetricsQueries[index]?.data;
    if (qData && qData.length > 0) {
      nodeMetricsMap[node.id] = qData;
    }
  });

  const nodeSeries: NodeSeriesData[] = nodes.map((node, index) => ({
    node,
    metrics: nodeMetricsMap[node.id] || clusterMetrics,
    color: NODE_COLORS[index % NODE_COLORS.length],
    dashPattern: DASH_PATTERNS[index % DASH_PATTERNS.length],
  }));

  const isLoading = loadingNodes || loadingMetrics;

  return (
    <>
      <title>Cluster Telemetry & Monitoring — Takō Cloud</title>
      <div className="space-y-6">
        {/* Header with Time Range selector */}
        <MonitoringHeader
          timeRange={timeRange}
          onTimeRangeChange={setTimeRange}
          onRefresh={handleRefresh}
          isRefreshing={isRefreshing}
        />

        {isLoading ? (
          <LoadingSkeleton variant="cards" />
        ) : nodes.length === 0 ? (
          <EmptyState
            icon={Server}
            title="No cluster nodes connected"
            description="Register a cluster host or node agent to stream live hardware telemetry, CPU load, and storage metrics."
          />
        ) : (
          <div className="space-y-8">
            {/* Multi-Node Comparative Breakdown Charts */}
            <ClusterMetricChart
              title="CPU Utilization Across Nodes"
              description="Comparative processor load per cluster node host."
              series={nodeSeries}
              metricKey="cpu"
              unit="%"
            />

            <ClusterMetricChart
              title="RAM Memory Usage Across Nodes"
              description="Physical host memory allocation breakdown across cluster members."
              series={nodeSeries}
              metricKey="memory"
              unit="%"
            />

            {/* Network Ingress/Egress & Disk Allocation Charts */}
            <NetworkDiskCharts metrics={clusterMetrics} />

            {/* Live Hardware Telemetry Breakdown Table */}
            <MonitoringNodesTable nodes={nodes} />
          </div>
        )}
      </div>
    </>
  );
}
