import { apiDelete, apiGet, apiPatch, apiPost, type ApiNode } from "@/lib/api"
import { adaptNode } from "@/lib/adapters"
import type { ClusterNode } from "@/types/platform"

export interface RawNodeMetric {
  timestamp: string
  cpu: number
  memory: number
  memoryPercent?: number
  networkRx: number
  networkTx: number
  disk: number
  diskPercent?: number
  diskRead?: number
  diskWrite?: number
  swapUsedMb?: number
  swapTotalMb?: number
}

export interface NodeMetricPoint {
  time: string
  cpu: number
  memoryPercent: number
  memoryUsedMb: number
  memoryLimitMb: number
  networkRxKbps: number
  networkTxKbps: number
  diskPercent: number
  diskReadKbps: number
  diskWriteKbps: number
  swapPercent: number
}

export async function getNodes(): Promise<ClusterNode[]> {
  const data = await apiGet<ApiNode[]>("/nodes")
  return data.map(adaptNode)
}

export async function getNode(id: string): Promise<ClusterNode> {
  const data = await apiGet<ApiNode>(`/nodes/${id}`)
  return adaptNode(data)
}

export async function updateNode(
  id: string,
  updates: Partial<ClusterNode>
): Promise<ClusterNode> {
  const payload: Record<string, unknown> = {}
  if (updates.name !== undefined) payload.name = updates.name
  if (updates.status !== undefined) payload.status = updates.status
  if (updates.role !== undefined) payload.role = updates.role
  if (updates.ipAddress !== undefined) payload.ipAddress = updates.ipAddress
  if (updates.publicIp !== undefined) payload.publicIp = updates.publicIp
  if (updates.location) {
    payload.location = {
      country: updates.location.name,
      countryCode: updates.location.code,
      latitude: updates.location.lat,
      longitude: updates.location.lng,
    }
  }

  const data = await apiPatch<ApiNode>(`/nodes/${id}`, payload)
  return adaptNode(data)
}

export async function deleteNode(id: string): Promise<void> {
  await apiDelete(`/nodes/${id}`)
}

export async function generateEnrollToken(): Promise<string> {
  const data = await apiPost<{ token: string }>("/nodes/enroll-token")
  return data.token
}

export async function pingNode(id: string): Promise<number | null> {
  const t0 = performance.now()
  try {
    await apiGet(`/nodes/${id}`)
    return Math.max(1, Math.round(performance.now() - t0))
  } catch {
    return null
  }
}

export async function restartNodeAgent(id: string): Promise<void> {
  await apiPost(`/nodes/${id}/update`, {})
}

export async function updateNodeAgent(
  id: string
): Promise<{ success: boolean; message: string }> {
  return apiPost<{ success: boolean; message: string }>(`/nodes/${id}/update`, {})
}

export async function upgradeNodeTraefik(
  id: string
): Promise<{ success: boolean; message: string }> {
  return apiPost<{ success: boolean; message: string }>(
    `/nodes/${id}/traefik/upgrade`,
    {}
  )
}

export async function pruneNodeDisk(id: string): Promise<void> {
  await apiPost(`/nodes/${id}/prune`, {})
}

export async function getNodeMetrics(
  nodeId: string,
  range = "1h",
  nodeMemoryMb = 8192
): Promise<NodeMetricPoint[]> {
  const res = await apiGet<RawNodeMetric[]>(
    `/metrics?nodeId=${encodeURIComponent(nodeId)}&range=${range}`
  )

  if (!Array.isArray(res) || res.length === 0) {
    return []
  }

  return res.map((p) => {
    const memoryUsedMb = p.memory ?? 0
    const memoryLimitMb = nodeMemoryMb || 8192
    const memoryPercent =
      p.memoryPercent ??
      Math.min(100, Math.round((memoryUsedMb / memoryLimitMb) * 100))

    const swapUsed = p.swapUsedMb ?? 0
    const swapTotal = p.swapTotalMb ?? 2048
    const swapPercent =
      swapTotal > 0 ? Math.min(100, Math.round((swapUsed / swapTotal) * 100)) : 0

    return {
      time: p.timestamp,
      cpu: Math.min(100, Math.max(0, p.cpu ?? 0)),
      memoryPercent,
      memoryUsedMb,
      memoryLimitMb,
      networkRxKbps: p.networkRx ?? 0,
      networkTxKbps: p.networkTx ?? 0,
      diskPercent: Math.min(100, Math.max(0, p.diskPercent ?? p.disk ?? 0)),
      diskReadKbps: p.diskRead ?? 0,
      diskWriteKbps: p.diskWrite ?? 0,
      swapPercent,
    }
  })
}
