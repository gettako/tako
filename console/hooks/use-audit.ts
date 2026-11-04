"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  createAuditLog,
  getAuditLogs,
} from "@/services/audit.service"
import type { AuditLogEntry } from "@/types/platform"

export const auditKeys = {
  all: ["audit"] as const,
  list: (filters?: object) => [...auditKeys.all, "list", filters] as const,
  detail: (id: string) => [...auditKeys.all, "detail", id] as const,
}

export function useAuditLogs(limit = 200) {
  return useQuery({
    queryKey: auditKeys.list({ limit }),
    queryFn: () => getAuditLogs(limit),
  })
}

export function useCreateAuditLog() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (entry: Omit<AuditLogEntry, "id" | "timestamp">) =>
      createAuditLog(entry),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: auditKeys.all })
    },
  })
}

