"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  cancelDeploy,
  getDeployment,
  getDeploymentLogs,
  getServiceDeployments,
  getServiceLogs,
  triggerDeploy,
  triggerRollback,
} from "@/services/deployments.service"
import { DEPLOYMENT_STATUS } from "@/types/platform"

export const deploymentKeys = {
  all: ["deployments"] as const,
  list: (filters?: object) => [...deploymentKeys.all, "list", filters] as const,
  detail: (id: string) => [...deploymentKeys.all, "detail", id] as const,
  byService: (serviceId: string) =>
    [...deploymentKeys.all, "byService", serviceId] as const,
  logs: (deploymentId: string) =>
    [...deploymentKeys.all, "logs", deploymentId] as const,
  serviceLogs: (serviceId: string, container?: string) =>
    [...deploymentKeys.all, "serviceLogs", serviceId, container] as const,
}

export function useServiceDeployments(serviceId: string, enabled = true) {
  return useQuery({
    queryKey: deploymentKeys.byService(serviceId),
    queryFn: () => getServiceDeployments(serviceId),
    enabled: Boolean(serviceId) && enabled,
    refetchInterval: (query) => {
      const records = query.state.data
      if (!records || records.length === 0) return false
      const hasActive = records.some(
        (d) =>
          d.status === DEPLOYMENT_STATUS.PENDING ||
          d.status === DEPLOYMENT_STATUS.BUILDING
      )
      return hasActive ? 2000 : false
    },
  })
}

export function useDeployment(id: string, enabled = true) {
  return useQuery({
    queryKey: deploymentKeys.detail(id),
    queryFn: () => getDeployment(id),
    enabled: Boolean(id) && enabled,
  })
}

export function useDeploymentLogs(deploymentId: string, enabled = true) {
  return useQuery({
    queryKey: deploymentKeys.logs(deploymentId),
    queryFn: () => getDeploymentLogs(deploymentId),
    enabled: Boolean(deploymentId) && enabled,
  })
}

export function useServiceLogs(
  serviceId: string,
  container?: string,
  tail = 100,
  polling = false
) {
  return useQuery({
    queryKey: deploymentKeys.serviceLogs(serviceId, container),
    queryFn: () => getServiceLogs(serviceId, container, tail),
    enabled: Boolean(serviceId),
    refetchInterval: () => (polling ? 3000 : false),
  })
}

export function useTriggerDeploy(serviceId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: () => triggerDeploy(serviceId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: deploymentKeys.byService(serviceId),
      })
      queryClient.invalidateQueries({ queryKey: ["services"] })
    },
  })
}

export function useTriggerRollback(serviceId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (deploymentId: string) => triggerRollback(deploymentId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: deploymentKeys.byService(serviceId),
      })
      queryClient.invalidateQueries({ queryKey: ["services"] })
    },
  })
}

export function useCancelDeploy(serviceId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (deploymentId: string) => cancelDeploy(deploymentId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: deploymentKeys.byService(serviceId),
      })
      queryClient.invalidateQueries({ queryKey: ["services"] })
    },
  })
}

