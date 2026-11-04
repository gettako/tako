"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  deleteNodeTraefikFile,
  getDomainConfig,
  getNodeTraefikFile,
  getNodeTraefikFiles,
  reloadNodeTraefik,
  reloadTraefik,
  saveNodeTraefikFile,
  updateDomainConfig,
  upgradeNodeTraefik,
  verifyDomain,
} from "@/services/domain.service"
import type { ClusterDomainConfig } from "@/types/platform"

export const domainKeys = {
  all: ["domain"] as const,
  list: (filters?: object) => [...domainKeys.all, "list", filters] as const,
  detail: (id: string) => [...domainKeys.all, "detail", id] as const,
  config: () => [...domainKeys.all, "config"] as const,
  traefikFiles: (nodeId: string) =>
    [...domainKeys.all, "traefikFiles", nodeId] as const,
  traefikFile: (nodeId: string, filename: string) =>
    [...domainKeys.all, "traefikFile", nodeId, filename] as const,
}

export function useDomainConfig() {
  return useQuery({
    queryKey: domainKeys.config(),
    queryFn: () => getDomainConfig(),
  })
}

export function useUpdateDomainConfig() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (config: Partial<ClusterDomainConfig>) =>
      updateDomainConfig(config),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: domainKeys.config() })
    },
  })
}

export function useVerifyDomain() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (domain: string) => verifyDomain(domain),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: domainKeys.config() })
    },
  })
}

export function useReloadTraefik() {
  return useMutation({
    mutationFn: () => reloadTraefik(),
  })
}

export function useNodeTraefikFiles(nodeId: string, enabled = true) {
  return useQuery({
    queryKey: domainKeys.traefikFiles(nodeId),
    queryFn: () => getNodeTraefikFiles(nodeId),
    enabled: Boolean(nodeId) && enabled,
  })
}

export function useNodeTraefikFile(
  nodeId: string,
  fileName: string,
  enabled = true
) {
  return useQuery({
    queryKey: domainKeys.traefikFile(nodeId, fileName),
    queryFn: () => getNodeTraefikFile(nodeId, fileName),
    enabled: Boolean(nodeId && fileName) && enabled,
  })
}

export function useSaveNodeTraefikFile(nodeId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      fileName,
      content,
    }: {
      fileName: string
      content: string
    }) => saveNodeTraefikFile(nodeId, fileName, content),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: domainKeys.traefikFiles(nodeId),
      })
      queryClient.invalidateQueries({
        queryKey: domainKeys.traefikFile(nodeId, variables.fileName),
      })
    },
  })
}

export function useDeleteNodeTraefikFile(nodeId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (fileName: string) => deleteNodeTraefikFile(nodeId, fileName),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: domainKeys.traefikFiles(nodeId),
      })
    },
  })
}

export function useReloadNodeTraefik(nodeId: string) {
  return useMutation({
    mutationFn: () => reloadNodeTraefik(nodeId),
  })
}

export function useUpgradeNodeTraefik(nodeId: string) {
  return useMutation({
    mutationFn: () => upgradeNodeTraefik(nodeId),
  })
}

