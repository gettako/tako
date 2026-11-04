"use client"

import { useQuery } from "@tanstack/react-query"
import {
  getAccessLogs,
  getClusterMetrics,
  type GetAccessLogsParams,
} from "@/services/monitoring.service"

export const monitoringKeys = {
  all: ["monitoring"] as const,
  clusterMetrics: (range?: string) =>
    [...monitoringKeys.all, "clusterMetrics", range] as const,
  accessLogs: (filters?: object | number) =>
    [...monitoringKeys.all, "accessLogs", filters] as const,
}

export function useClusterMetrics(range = "1h", polling = true) {
  return useQuery({
    queryKey: monitoringKeys.clusterMetrics(range),
    queryFn: () => getClusterMetrics(range),
    refetchInterval: () => (polling ? 15000 : false),
  })
}

export function useAccessLogs(
  params: number | GetAccessLogsParams = 100,
  polling = true
) {
  return useQuery({
    queryKey: monitoringKeys.accessLogs(params),
    queryFn: () => getAccessLogs(params),
    refetchInterval: () => (polling ? 10000 : false),
  })
}

