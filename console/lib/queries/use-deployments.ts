'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { deploymentKeys, serviceKeys } from './keys';
import {
  getDeployments,
  getDeploymentById,
  triggerDeployment,
  rollbackDeployment,
  getDeploymentLogsStreamUrl,
  subscribeDeploymentLogs,
} from '@/lib/api/deployments';

export { getDeploymentLogsStreamUrl, subscribeDeploymentLogs };
import { Deployment } from '@/lib/types';
import { toast } from 'sonner';

export interface UseDeploymentsOptions {
  serviceId?: string;
  refetchInterval?: number | false;
  enabled?: boolean;
}

export function useDeployments(serviceId?: string, options?: UseDeploymentsOptions) {
  return useQuery<Deployment[]>({
    queryKey: deploymentKeys.lists(serviceId),
    queryFn: () => getDeployments(serviceId),
    refetchInterval: options?.refetchInterval ?? 5000,
    enabled: options?.enabled ?? true,
  });
}

export function useDeployment(id: string | undefined | null) {
  return useQuery<Deployment | null>({
    queryKey: id ? deploymentKeys.detail(id) : ['deployments', 'detail', 'none'],
    queryFn: () => (id ? getDeploymentById(id) : Promise.resolve(null)),
    enabled: Boolean(id),
    refetchInterval: (query) => {
      const data = query.state.data;
      if (data && (data.status === 'queued' || data.status === 'building' || data.status === 'deploying' || data.status === 'running')) {
        return 2000;
      }
      return false;
    },
  });
}

export interface UseTriggerDeploymentOptions {
  onSuccess?: (deployment: Deployment) => void;
  onError?: (err: Error) => void;
}

export function useTriggerDeployment(options?: UseTriggerDeploymentOptions) {
  const queryClient = useQueryClient();

  return useMutation<Deployment, Error, { serviceId: string; branch?: string; commitHash?: string }>({
    mutationFn: ({ serviceId, branch, commitHash }) => triggerDeployment(serviceId, branch, commitHash),
    onSuccess: (dep, { serviceId }) => {
      queryClient.invalidateQueries({ queryKey: deploymentKeys.all });
      queryClient.invalidateQueries({ queryKey: serviceKeys.detail(serviceId) });
      toast.success('Deployment triggered', {
        description: `Pipeline started on branch ${dep.branch}.`,
      });
      options?.onSuccess?.(dep);
    },
    onError: (err) => {
      toast.error('Failed to trigger deployment', {
        description: err.message || 'Please try again.',
      });
      options?.onError?.(err);
    },
  });
}

export interface UseRollbackDeploymentOptions {
  onSuccess?: (deployment: Deployment) => void;
  onError?: (err: Error) => void;
}

export function useRollbackDeployment(options?: UseRollbackDeploymentOptions) {
  const queryClient = useQueryClient();

  return useMutation<Deployment, Error, string>({
    mutationFn: (deploymentId) => rollbackDeployment(deploymentId),
    onSuccess: (dep) => {
      queryClient.invalidateQueries({ queryKey: deploymentKeys.all });
      queryClient.invalidateQueries({ queryKey: serviceKeys.all });
      toast.success('Rollback initiated', {
        description: `Rolling back to deployment ${dep.rollbackFromId || ''}.`,
      });
      options?.onSuccess?.(dep);
    },
    onError: (err) => {
      toast.error('Failed to rollback deployment', {
        description: err.message || 'Please try again.',
      });
      options?.onError?.(err);
    },
  });
}
