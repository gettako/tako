'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getNodes } from '@/lib/api/nodes';
import { getTimeSeriesMetrics } from '@/lib/api/metrics';
import { MonitoringHeader, TimeRange } from '@/components/monitoring/monitoring-header';
import { ClusterMetricChart, NodeSeriesData } from '@/components/monitoring/cluster-metric-chart';
import { NetworkDiskCharts } from '@/components/monitoring/network-disk-charts';
import { MonitoringNodesTable } from '@/components/monitoring/monitoring-nodes-table';
import { LoadingSkeleton } from '@/components/ui/loading-skeleton';

const NODE_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'];
const DASH_PATTERNS = [undefined, undefined, '4 4', '2 2', '6 3'];

export default function MonitoringPage() {
  const [timeRange, setTimeRange] = useState<TimeRange>('1h');

  const {
    data: nodes = [],
    isLoading: loadingNodes,
    refetch: refetchNodes,
    isRefetching: refetchingNodes,
  } = useQuery({
    queryKey: ['nodes'],
    queryFn: getNodes,
  });

  const {
    data: clusterMetrics = [],
    isLoading: loadingMetrics,
    refetch: refetchMetrics,
    isRefetching: refetchingMetrics,
  } = useQuery({
    queryKey: ['cluster-metrics', timeRange],
    queryFn: () => getTimeSeriesMetrics('cluster', timeRange),
  });

  // Fetch individual node metrics to construct comparative series
  const node1Metrics = useQuery({
    queryKey: ['node-metrics', 'node-1', timeRange],
    queryFn: () => getTimeSeriesMetrics('node-1', timeRange),
    enabled: nodes.length > 0,
  });

  const node2Metrics = useQuery({
    queryKey: ['node-metrics', 'node-2', timeRange],
    queryFn: () => getTimeSeriesMetrics('node-2', timeRange),
    enabled: nodes.length > 1,
  });

  const node3Metrics = useQuery({
    queryKey: ['node-metrics', 'node-3', timeRange],
    queryFn: () => getTimeSeriesMetrics('node-3', timeRange),
    enabled: nodes.length > 2,
  });

  const node4Metrics = useQuery({
    queryKey: ['node-metrics', 'node-4', timeRange],
    queryFn: () => getTimeSeriesMetrics('node-4', timeRange),
    enabled: nodes.length > 3,
  });

  const isRefreshing = refetchingNodes || refetchingMetrics;

  const handleRefresh = () => {
    refetchNodes();
    refetchMetrics();
    node1Metrics.refetch();
    node2Metrics.refetch();
    node3Metrics.refetch();
    node4Metrics.refetch();
  };

  const nodeMetricsMap: Record<string, typeof clusterMetrics> = {
    'node-1': node1Metrics.data || clusterMetrics,
    'node-2': node2Metrics.data || clusterMetrics,
    'node-3': node3Metrics.data || clusterMetrics,
    'node-4': node4Metrics.data || clusterMetrics,
  };

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
        {/* Header with Time Range selector (AC-7) */}
        <MonitoringHeader
          timeRange={timeRange}
          onTimeRangeChange={setTimeRange}
          onRefresh={handleRefresh}
          isRefreshing={isRefreshing}
        />

        {isLoading ? (
          <LoadingSkeleton variant="cards" />
        ) : (
          <div className="space-y-8">
            {/* Multi-Node Comparative Breakdown Charts (AC-8) */}
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

            {/* Network Ingress/Egress & Disk I/O Charts (AC-8) */}
            <NetworkDiskCharts metrics={clusterMetrics} />

            {/* Live Hardware Telemetry Breakdown Table */}
            <MonitoringNodesTable nodes={nodes} />
          </div>
        )}
      </div>
    </>
  );
}
