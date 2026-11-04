import { apiGet, apiPost, type ApiAuditLog } from "@/lib/api"
import { adaptAuditLog } from "@/lib/adapters"
import type { AuditLogEntry } from "@/types/platform"

export interface CreateAuditLogInput {
  action: string
  targetType: string
  targetId: string
  targetName: string
  metadata?: Record<string, unknown>
}

export async function getAuditLogs(limit = 200): Promise<AuditLogEntry[]> {
  const data = await apiGet<ApiAuditLog[]>(`/audit-logs?limit=${limit}`)
  return data.map(adaptAuditLog)
}

export async function createAuditLog(
  entry: Omit<AuditLogEntry, "id" | "timestamp">
): Promise<AuditLogEntry> {
  const payload: CreateAuditLogInput = {
    action: entry.action,
    targetType: entry.category,
    targetId: entry.target,
    targetName: entry.target,
    metadata: {
      details: entry.details,
      status: entry.status,
      actorType: entry.actor.type,
    },
  }
  const created = await apiPost<ApiAuditLog>("/audit-logs", payload)
  return adaptAuditLog(created)
}

