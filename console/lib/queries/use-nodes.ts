'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { nodeKeys } from './keys';
import {
  getNodes,
  getNodeById,
  updateNode,
  rebootNode,
  createNodeEnrollToken,
  getNodeTraefikConfig,
  updateNodeTraefikConfig,
  reloadNodeTraefik,
  getNodeTraefikFiles,
  getNodeTraefikFileContent,
  saveNodeTraefikFile,
  deleteNodeTraefikFile,
  getNodeEventsStreamUrl,
} from '@/lib/api/nodes';

export { getNodeEventsStreamUrl };
import { Node, NodeTraefikConfig, TraefikConfigFile, TraefikConfigFileContent } from '@/lib/types';
import { toast } from 'sonner';

export interface UseNodesOptions {
  refetchInterval?: number | false;
  enabled?: boolean;
}

export function useNodes(options?: UseNodesOptions) {
  return useQuery<Node[]>({
    queryKey: nodeKeys.lists(),
    queryFn: getNodes,
    refetchInterval: options?.refetchInterval ?? 15000,
    enabled: options?.enabled ?? true,
  });
}

export function useNode(id: string | undefined | null) {
  return useQuery<Node | null>({
    queryKey: id ? nodeKeys.detail(id) : ['nodes', 'detail', 'none'],
    queryFn: () => (id ? getNodeById(id) : Promise.resolve(null)),
    enabled: Boolean(id),
  });
}

export function useUpdateNode(options?: { onSuccess?: (updated: Node) => void }) {
  const queryClient = useQueryClient();

  return useMutation<Node, Error, { id: string; input: Partial<Node> }>({
    mutationFn: ({ id, input }) => updateNode(id, input),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: nodeKeys.all });
      queryClient.setQueryData(nodeKeys.detail(updated.id), updated);
      toast.success('Node updated successfully');
      options?.onSuccess?.(updated);
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to update node');
    },
  });
}

export function useRebootNode(options?: { onSuccess?: () => void }) {
  const queryClient = useQueryClient();

  return useMutation<{ success: boolean; message: string }, Error, string>({
    mutationFn: (nodeId) => rebootNode(nodeId),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: nodeKeys.all });
      toast.success('Node reboot initiated', {
        description: data.message || 'System reboot sequence underway.',
      });
      options?.onSuccess?.();
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to reboot node');
    },
  });
}

export function useCreateNodeEnrollToken(options?: { onSuccess?: (data: { token: string; expiresAt?: string }) => void }) {
  return useMutation<{ token: string; expiresAt?: string }, Error, void>({
    mutationFn: () => createNodeEnrollToken(),
    onSuccess: (data) => {
      toast.success('Enrollment token generated');
      options?.onSuccess?.(data);
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to generate enrollment token');
    },
  });
}

// Traefik
export function useNodeTraefikConfig(nodeId: string | undefined | null) {
  return useQuery<NodeTraefikConfig>({
    queryKey: nodeId ? nodeKeys.traefik(nodeId) : ['nodes', 'traefik', 'none'],
    queryFn: () => (nodeId ? getNodeTraefikConfig(nodeId) : Promise.reject('No node ID')),
    enabled: Boolean(nodeId),
  });
}

export function useUpdateNodeTraefikConfig(nodeId: string) {
  const queryClient = useQueryClient();

  return useMutation<NodeTraefikConfig, Error, Partial<NodeTraefikConfig>>({
    mutationFn: (input) => updateNodeTraefikConfig(nodeId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: nodeKeys.traefik(nodeId) });
      toast.success('Traefik configuration updated');
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to update Traefik configuration');
    },
  });
}

export function useReloadNodeTraefik(defaultNodeId?: string) {
  const queryClient = useQueryClient();

  return useMutation<{ success: boolean; message: string; reloadedAt: string }, Error, string | void>({
    mutationFn: (overrideNodeId) => {
      const targetId = (typeof overrideNodeId === 'string' ? overrideNodeId : defaultNodeId) || '';
      if (!targetId) throw new Error('Node ID is required to reload Traefik');
      return reloadNodeTraefik(targetId);
    },
    onSuccess: (data, variables) => {
      const targetId = (typeof variables === 'string' ? variables : defaultNodeId) || '';
      if (targetId) {
        queryClient.invalidateQueries({ queryKey: nodeKeys.traefik(targetId) });
      } else {
        queryClient.invalidateQueries({ queryKey: nodeKeys.all });
      }
      toast.success('Traefik reloaded', { description: data.message });
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to reload Traefik');
    },
  });
}

export function useNodeTraefikFiles(nodeId: string | undefined | null) {
  return useQuery<TraefikConfigFile[]>({
    queryKey: nodeId ? nodeKeys.traefikFiles(nodeId) : ['nodes', 'traefik', 'files', 'none'],
    queryFn: () => (nodeId ? getNodeTraefikFiles(nodeId) : Promise.resolve([])),
    enabled: Boolean(nodeId),
  });
}

export function useNodeTraefikFileContent(nodeId: string | undefined | null, filename: string | undefined | null) {
  return useQuery<TraefikConfigFileContent>({
    queryKey: nodeId && filename ? nodeKeys.traefikFile(nodeId, filename) : ['nodes', 'traefik', 'file', 'none'],
    queryFn: () => (nodeId && filename ? getNodeTraefikFileContent(nodeId, filename) : Promise.reject('No file')),
    enabled: Boolean(nodeId && filename),
  });
}

export function useSaveNodeTraefikFile(nodeId: string, options?: { onSuccess?: () => void }) {
  const queryClient = useQueryClient();

  return useMutation<TraefikConfigFileContent, Error, { filename: string; content: string }>({
    mutationFn: ({ filename, content }) => saveNodeTraefikFile(nodeId, filename, content),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: nodeKeys.traefikFiles(nodeId) });
      toast.success('Traefik file saved successfully');
      options?.onSuccess?.();
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to save Traefik file');
    },
  });
}

export function useDeleteNodeTraefikFile(nodeId: string, options?: { onSuccess?: () => void }) {
  const queryClient = useQueryClient();

  return useMutation<{ success: boolean; name: string }, Error, string>({
    mutationFn: (filename) => deleteNodeTraefikFile(nodeId, filename),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: nodeKeys.traefikFiles(nodeId) });
      toast.success('Traefik file removed');
      options?.onSuccess?.();
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to delete Traefik file');
    },
  });
}
