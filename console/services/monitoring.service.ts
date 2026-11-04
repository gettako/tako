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

export interface GetAccessLogsParams {
  limit?: number
  nodeId?: string
  serviceId?: string
  status?: string
  method?: string
  search?: string
}

export async function getAccessLogs(
  params: number | GetAccessLogsParams = 100
): Promise<ApiAccessLog[]> {
  const opts: GetAccessLogsParams =
    typeof params === "number" ? { limit: params } : params

  const query = new URLSearchParams()
  if (opts.limit) query.set("limit", String(opts.limit))
  if (opts.nodeId && opts.nodeId !== "all") query.set("nodeId", opts.nodeId)
  if (opts.serviceId && opts.serviceId !== "all") query.set("serviceId", opts.serviceId)
  if (opts.status && opts.status !== "all") query.set("status", opts.status)
  if (opts.method && opts.method !== "all") query.set("method", opts.method)
  if (opts.search) query.set("search", opts.search)

  const queryString = query.toString() ? `?${query.toString()}` : ""

  try {
    return await apiGet<ApiAccessLog[]>(`/ingress/access-logs${queryString}`)
  } catch {
    try {
      return await apiGet<ApiAccessLog[]>(`/traefik/access-logs${queryString}`)
    } catch {
      try {
        return await apiGet<ApiAccessLog[]>(`/monitor/access-logs${queryString}`)
      } catch {
        return []
      }
    }
  }
}

export function subscribeLiveEvents(handlers: SseHandlers) {
  return subscribeSse("/events", handlers)
}

