"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  deleteNode,
  generateEnrollToken,
  getNode,
  getNodeMetrics,
  getNodes,
  pingNode,
  pruneNodeDisk,
  restartNodeAgent,
  updateNode,
  updateNodeAgent,
  upgradeNodeTraefik,
} from "@/services/nodes.service"
import type { ClusterNode } from "@/types/platform"

export const nodeKeys = {
  all: ["nodes"] as const,
  list: (filters?: object) => [...nodeKeys.all, "list", filters] as const,
  detail: (id: string) => [...nodeKeys.all, "detail", id] as const,
  metrics: (id: string, range?: string) =>
    [...nodeKeys.all, "metrics", id, range] as const,
}

export function useNodes(filters?: object) {
  return useQuery({
    queryKey: nodeKeys.list(filters),
    queryFn: () => getNodes(),
  })
}

export function useNode(id: string, enabled = true) {
  return useQuery({
    queryKey: nodeKeys.detail(id),
    queryFn: () => getNode(id),
    enabled: Boolean(id) && enabled,
  })
}

export function useNodeMetrics(
  nodeId: string,
  range = "1h",
  nodeMemoryMb = 8192,
  polling = true
) {
  return useQuery({
    queryKey: nodeKeys.metrics(nodeId, range),
    queryFn: () => getNodeMetrics(nodeId, range, nodeMemoryMb),
    enabled: Boolean(nodeId),
    refetchInterval: () => (polling ? 15000 : false),
  })
}

export function useUpdateNode() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      id,
      updates,
    }: {
      id: string
      updates: Partial<ClusterNode>
    }) => updateNode(id, updates),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: nodeKeys.all })
      queryClient.invalidateQueries({
        queryKey: nodeKeys.detail(variables.id),
      })
    },
  })
}

export function useDeleteNode() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => deleteNode(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: nodeKeys.all })
    },
  })
}

export function useGenerateEnrollToken() {
  return useMutation({
    mutationFn: () => generateEnrollToken(),
  })
}

export function usePingNode() {
  return useMutation({
    mutationFn: (id: string) => pingNode(id),
  })
}

export function useRestartNodeAgent() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => restartNodeAgent(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: nodeKeys.detail(id) })
    },
  })
}

export function usePruneNodeDisk() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => pruneNodeDisk(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: nodeKeys.detail(id) })
    },
  })
}

export function useUpdateNodeAgent() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => updateNodeAgent(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: nodeKeys.all })
      queryClient.invalidateQueries({ queryKey: nodeKeys.detail(id) })
    },
  })
}

export function useUpgradeNodeTraefik() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => upgradeNodeTraefik(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: nodeKeys.detail(id) })
    },
  })
}

