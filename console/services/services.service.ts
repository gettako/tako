import {
  apiDelete,
  apiGet,
  apiPatch,
  apiPost,
  apiPut,
  type ApiCronJob,
  type ApiCronRun,
  type ApiService,
} from "@/lib/api"
import { adaptService } from "@/lib/adapters"
import type { ProjectService, ServiceBackupConfig } from "@/types/platform"

export interface CreateServiceInput {
  projectId: string
  nodeId: string
  name: string
  slug: string
  type: string
  repository: string
  branch: string
  dockerfile: string
  image: string
  composeFile: string
  ports: number[]
  domains: string[]
  environmentVars: Record<string, string>
  publishToHost: boolean
  limits: { cpuCores: number; memoryMb: number }
  replicas: number
}

export interface ServiceMetricPoint {
  timestamp: string
  cpu: number
  memory: number
  memoryPercent?: number
  networkRx: number
  networkTx: number
}

export async function getServices(): Promise<ProjectService[]> {
  const data = await apiGet<ApiService[]>("/services")
  return data.map(adaptService)
}

export async function getService(id: string): Promise<ProjectService> {
  const data = await apiGet<ApiService>(`/services/${id}`)
  return adaptService(data)
}

export async function createService(
  input: CreateServiceInput
): Promise<ProjectService> {
  const payload = {
    projectId: input.projectId,
    nodeId: input.nodeId,
    name: input.name,
    slug: input.slug,
    type: input.type,
    repository: input.repository,
    branch: input.branch,
    dockerfile: input.dockerfile,
    image: input.image,
    composeFile: input.composeFile,
    ports: input.ports,
    domains: input.domains,
    envVars: Object.entries(input.environmentVars).map(([key, value]) => ({
      key,
      value,
      isSecret: false,
    })),
    publishToHost: input.publishToHost,
    limits: {
      cpuCores: input.limits.cpuCores,
      memoryMb: input.limits.memoryMb,
      swapMb: 512,
    },
    replicas: input.replicas,
  }
  const created = await apiPost<ApiService>("/services", payload)
  return adaptService(created)
}

export async function updateService(
  id: string,
  updates: Partial<ProjectService> & Record<string, unknown>
): Promise<ProjectService> {
  const payload: Record<string, unknown> = {}
  if (updates.name !== undefined) payload.name = updates.name
  if (updates.slug !== undefined) payload.slug = updates.slug
  if (updates.type !== undefined) payload.type = updates.type
  if (updates.status !== undefined) payload.status = updates.status
  if (updates.gitRepo !== undefined) payload.repository = updates.gitRepo
  if (updates.gitBranch !== undefined) payload.branch = updates.gitBranch
  if (updates.dockerfileContent !== undefined)
    payload.dockerfile = updates.dockerfileContent
  if (updates.composeContent !== undefined)
    payload.composeFile = updates.composeContent
  if (updates.image !== undefined) payload.image = updates.image
  if (updates.targetNodeId !== undefined) payload.nodeId = updates.targetNodeId
  if (updates.publishToHost !== undefined)
    payload.publishToHost = updates.publishToHost
  if (updates.autoRollbackEnabled !== undefined)
    payload.autoRollbackEnabled = updates.autoRollbackEnabled
  if (updates.maintenanceMode !== undefined)
    payload.maintenanceMode = updates.maintenanceMode

  if (updates.resourceSpecs) {
    payload.limits = {
      cpuCores: updates.resourceSpecs.cpuLimit,
      memoryMb: updates.resourceSpecs.memoryLimitMb,
      swapMb: 512,
    }
  }

  if (updates.envVars) {
    payload.envVars = updates.envVars.map((e) => ({
      key: e.key,
      value: e.value,
      isSecret: Boolean(e.isSecret),
    }))
  }

  if (updates.portMappings) {
    payload.ports = updates.portMappings.map((p) => p.host)
  }

  if (updates.domains) {
    payload.domains = updates.domains.map((d) => d.domain)
  }

  const updated = await apiPatch<ApiService>(`/services/${id}`, payload)
  return adaptService(updated)
}

export async function deleteService(id: string): Promise<void> {
  await apiDelete(`/services/${id}`)
}

export async function getServiceCrons(
  serviceId: string
): Promise<ApiCronJob[]> {
  try {
    const data = await apiGet<ApiCronJob[]>(`/services/${serviceId}/crons`)
    return data || []
  } catch {
    return []
  }
}

export async function createServiceCron(
  serviceId: string,
  cron: { name: string; schedule: string; command: string }
): Promise<ApiCronJob> {
  return apiPost<ApiCronJob>(`/services/${serviceId}/crons`, cron)
}

export async function updateServiceCron(
  serviceId: string,
  cronId: string,
  updates: Partial<ApiCronJob>
): Promise<ApiCronJob> {
  return apiPatch<ApiCronJob>(`/services/${serviceId}/crons/${cronId}`, updates)
}

export async function deleteServiceCron(
  serviceId: string,
  cronId: string
): Promise<void> {
  await apiDelete(`/services/${serviceId}/crons/${cronId}`)
}

export async function triggerServiceCron(
  serviceId: string,
  cronId: string
): Promise<void> {
  await apiPost(`/services/${serviceId}/crons/${cronId}/run`)
}

export async function getServiceCronRuns(
  serviceId: string,
  cronId: string
): Promise<ApiCronRun[]> {
  try {
    return await apiGet<ApiCronRun[]>(
      `/services/${serviceId}/crons/${cronId}/runs`
    )
  } catch {
    return []
  }
}

export async function getServiceMetrics(
  serviceId: string,
  range = "1h"
): Promise<ServiceMetricPoint[]> {
  try {
    const res = await apiGet<
      | ServiceMetricPoint[]
      | { points?: ServiceMetricPoint[] }
    >(`/services/${encodeURIComponent(serviceId)}/metrics?range=${range}`)
    if (Array.isArray(res)) return res
    if (res && Array.isArray(res.points)) return res.points
    return []
  } catch {
    return []
  }
}

export async function getServiceBackups(
  serviceId: string
): Promise<ServiceBackupConfig[]> {
  try {
    const cfgs = await apiGet<ServiceBackupConfig[] | ServiceBackupConfig>(
      `/services/${serviceId}/backup`
    )
    if (Array.isArray(cfgs)) return cfgs
    if (cfgs) return [cfgs]
    return []
  } catch {
    return []
  }
}

export async function saveServiceBackups(
  serviceId: string,
  configs: ServiceBackupConfig[]
): Promise<ServiceBackupConfig[]> {
  return apiPut<ServiceBackupConfig[]>(`/services/${serviceId}/backup`, configs)
}

export async function triggerServiceBackup(
  serviceId: string,
  planId: string
): Promise<{ success: boolean; message: string; filename?: string; sizeBytes?: number }> {
  return apiPost(`/services/${serviceId}/backup/run`, { planId })
}

export async function restoreServiceBackup(
  serviceId: string,
  snapshotId: string
): Promise<{ success: boolean; message: string }> {
  return apiPost(`/services/${serviceId}/backup/restore`, { snapshotId })
}

export async function testServiceHealthCheck(
  serviceId: string,
  path: string,
  port: number
): Promise<{ ok: boolean; message: string; latencyMs?: number; status?: number }> {
  return apiPost(`/services/${serviceId}/health-check/test`, { path, port })
}
