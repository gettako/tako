'use client';

import { useQuery, useQueries } from '@tanstack/react-query';
import { metricKeys } from './keys';
import {
  getTimeSeriesMetrics,
  getServiceTimeSeriesMetrics,
  MetricPoint,
  ServiceMetricPoint,
  TimeRange,
} from '@/lib/api/metrics';

export type { MetricPoint, ServiceMetricPoint, TimeRange };
export { getTimeSeriesMetrics };

export function useTimeSeriesMetrics(
  entityId: string | undefined | null,
  timeRange: TimeRange = '1h',
  options?: { refetchInterval?: number | false; enabled?: boolean }
) {
  return useQuery<MetricPoint[]>({
    queryKey: entityId ? metricKeys.node(entityId, timeRange) : metricKeys.cluster(timeRange),
    queryFn: () => (entityId ? getTimeSeriesMetrics(entityId, timeRange) : Promise.resolve([])),
    refetchInterval: options?.refetchInterval ?? 30000,
    enabled: options?.enabled ?? Boolean(entityId),
  });
}

export function useMultipleNodeMetrics(nodeIds: string[], timeRange: TimeRange = '1h') {
  return useQueries({
    queries: nodeIds.map((id) => ({
      queryKey: metricKeys.node(id, timeRange),
      queryFn: () => getTimeSeriesMetrics(id, timeRange),
      refetchInterval: 15000,
    })),
  });
}

export function useServiceMetrics(
  serviceId: string | undefined | null,
  timeRange: TimeRange = '1h',
  baseline?: { cpuPercent?: number; memoryUsedMb?: number; memoryLimitMb?: number; replicas?: number },
  options?: { refetchInterval?: number | false; enabled?: boolean }
) {
  return useQuery<ServiceMetricPoint[]>({
    queryKey: serviceId ? metricKeys.service(serviceId, timeRange) : ['metrics', 'service', 'none'],
    queryFn: () => (serviceId ? getServiceTimeSeriesMetrics(serviceId, timeRange, baseline) : Promise.resolve([])),
    refetchInterval: options?.refetchInterval ?? 15000,
    enabled: options?.enabled ?? Boolean(serviceId),
  });
}
