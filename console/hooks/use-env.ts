"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  getServiceEnvVars,
  updateServiceEnvVars,
  type SaveEnvVarItem,
} from "@/services/env.service"

export const envKeys = {
  all: ["env"] as const,
  list: (filters?: object) => [...envKeys.all, "list", filters] as const,
  detail: (id: string) => [...envKeys.all, "detail", id] as const,
  byService: (serviceId: string) =>
    [...envKeys.all, "byService", serviceId] as const,
}

export function useServiceEnvVars(serviceId: string, enabled = true) {
  return useQuery({
    queryKey: envKeys.byService(serviceId),
    queryFn: () => getServiceEnvVars(serviceId),
    enabled: Boolean(serviceId) && enabled,
  })
}

export function useUpdateServiceEnvVars(serviceId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (envVars: SaveEnvVarItem[]) =>
      updateServiceEnvVars(serviceId, envVars),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: envKeys.byService(serviceId),
      })
      queryClient.invalidateQueries({
        queryKey: ["services"],
      })
    },
  })
}

