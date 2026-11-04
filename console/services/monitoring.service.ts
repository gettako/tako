import {
  apiGet,
  subscribeSse,
  type ApiAccessLog,
  type SseHandlers,
} from "@/lib/api"
import type { RawNodeMetric } from "@/services/nodes.service"

export interface ClusterTelemetryPoint {
  time: string
  cpu: number
  memory: number
  memoryPercent?: number
  networkRx: number
  networkTx: number
  disk: number
  diskPercent?: number
}

export async function getClusterMetrics(
  range = "1h"
): Promise<ClusterTelemetryPoint[]> {
  const points = await apiGet<RawNodeMetric[]>(`/metrics?range=${range}`)
  if (!Array.isArray(points)) return []

  return points.map((p) => ({
    time: p.timestamp,
    cpu: Math.max(0, Math.min(100, Math.round((p.cpu ?? 0) * 10) / 10)),
    memory: p.memory ?? 0,
    memoryPercent: p.memoryPercent,
    networkRx: p.networkRx ?? 0,
    networkTx: p.networkTx ?? 0,
    disk: p.disk ?? 0,
    diskPercent: p.diskPercent,
  }))
}

export async function getAccessLogs(limit = 100): Promise<ApiAccessLog[]> {
  try {
    return await apiGet<ApiAccessLog[]>(`/monitor/access-logs?limit=${limit}`)
  } catch {
    return []
  }
}

export function subscribeLiveEvents(handlers: SseHandlers) {
  return subscribeSse("/events", handlers)
}

