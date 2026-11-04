"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  createService,
  createServiceCron,
  deleteService,
  deleteServiceCron,
  getService,
  getServiceBackups,
  getServiceCronRuns,
  getServiceCrons,
  getServiceMetrics,
  getServices,
  restoreServiceBackup,
  saveServiceBackups,
  testServiceHealthCheck,
  triggerServiceBackup,
  triggerServiceCron,
  updateService,
  updateServiceCron,
  type CreateServiceInput,
} from "@/services/services.service"
import type { ApiCronJob } from "@/lib/api"
import type { ProjectService, ServiceBackupConfig } from "@/types/platform"

export const serviceKeys = {
  all: ["services"] as const,
  list: (filters?: object) => [...serviceKeys.all, "list", filters] as const,
  detail: (id: string) => [...serviceKeys.all, "detail", id] as const,
  crons: (serviceId: string) => [...serviceKeys.all, "crons", serviceId] as const,
  cronRuns: (serviceId: string, cronId: string) =>
    [...serviceKeys.all, "cronRuns", serviceId, cronId] as const,
  metrics: (serviceId: string, range?: string) =>
    [...serviceKeys.all, "metrics", serviceId, range] as const,
  backups: (serviceId: string) =>
    [...serviceKeys.all, "backups", serviceId] as const,
}

export function useServices(filters?: object) {
  return useQuery({
    queryKey: serviceKeys.list(filters),
    queryFn: () => getServices(),
  })
}

export function useService(id: string, enabled = true) {
  return useQuery({
    queryKey: serviceKeys.detail(id),
    queryFn: () => getService(id),
    enabled: Boolean(id) && enabled,
  })
}

export function useCreateService() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: CreateServiceInput) => createService(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: serviceKeys.all })
      queryClient.invalidateQueries({ queryKey: ["projects"] })
    },
  })
}

export function useUpdateService() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      id,
      updates,
    }: {
      id: string
      updates: Partial<ProjectService>
    }) => updateService(id, updates),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: serviceKeys.all })
      queryClient.invalidateQueries({
        queryKey: serviceKeys.detail(variables.id),
      })
    },
  })
}

export function useDeleteService() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => deleteService(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: serviceKeys.all })
      queryClient.invalidateQueries({ queryKey: ["projects"] })
    },
  })
}

export function useServiceCrons(serviceId: string, enabled = true) {
  return useQuery({
    queryKey: serviceKeys.crons(serviceId),
    queryFn: () => getServiceCrons(serviceId),
    enabled: Boolean(serviceId) && enabled,
  })
}

export function useServiceCronRuns(
  serviceId: string,
  cronId: string,
  enabled = true
) {
  return useQuery({
    queryKey: serviceKeys.cronRuns(serviceId, cronId),
    queryFn: () => getServiceCronRuns(serviceId, cronId),
    enabled: Boolean(serviceId && cronId) && enabled,
  })
}

export function useCreateServiceCron(serviceId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (cron: { name: string; schedule: string; command: string }) =>
      createServiceCron(serviceId, cron),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: serviceKeys.crons(serviceId),
      })
    },
  })
}

export function useUpdateServiceCron(serviceId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      cronId,
      updates,
    }: {
      cronId: string
      updates: Partial<ApiCronJob>
    }) => updateServiceCron(serviceId, cronId, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: serviceKeys.crons(serviceId),
      })
    },
  })
}

export function useDeleteServiceCron(serviceId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (cronId: string) => deleteServiceCron(serviceId, cronId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: serviceKeys.crons(serviceId),
      })
    },
  })
}

export function useTriggerServiceCron(serviceId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (cronId: string) => triggerServiceCron(serviceId, cronId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: serviceKeys.crons(serviceId),
      })
    },
  })
}

export function useServiceMetrics(
  serviceId: string,
  range = "1h",
  polling = true
) {
  return useQuery({
    queryKey: serviceKeys.metrics(serviceId, range),
    queryFn: () => getServiceMetrics(serviceId, range),
    enabled: Boolean(serviceId),
    refetchInterval: () => (polling ? 10000 : false),
  })
}

export function useServiceBackups(serviceId: string, enabled = true) {
  return useQuery({
    queryKey: serviceKeys.backups(serviceId),
    queryFn: () => getServiceBackups(serviceId),
    enabled: Boolean(serviceId) && enabled,
  })
}

export function useSaveServiceBackups(serviceId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (configs: ServiceBackupConfig[]) =>
      saveServiceBackups(serviceId, configs),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: serviceKeys.backups(serviceId),
      })
    },
  })
}

export function useTriggerServiceBackup(serviceId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (planId: string) => triggerServiceBackup(serviceId, planId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: serviceKeys.backups(serviceId),
      })
    },
  })
}

export function useRestoreServiceBackup(serviceId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (snapshotId: string) =>
      restoreServiceBackup(serviceId, snapshotId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: serviceKeys.backups(serviceId),
      })
    },
  })
}

export function useTestServiceHealthCheck(serviceId: string) {
  return useMutation({
    mutationFn: ({ path, port }: { path: string; port: number }) =>
      testServiceHealthCheck(serviceId, path, port),
  })
}

