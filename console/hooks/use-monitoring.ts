"use client"

import { useQuery } from "@tanstack/react-query"
import {
  getAccessLogs,
  getClusterMetrics,
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

export function useAccessLogs(limit = 100, polling = true) {
  return useQuery({
    queryKey: monitoringKeys.accessLogs(limit),
    queryFn: () => getAccessLogs(limit),
    refetchInterval: () => (polling ? 10000 : false),
  })
}

