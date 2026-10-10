'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { serviceKeys, projectKeys } from './keys';
import {
  getServices,
  getServiceById,
  createService,
  updateService,
  updateServiceStatus,
  deleteService,
  getServiceDomains,
  addServiceDomain,
  deleteServiceDomain,
  setPrimaryServiceDomain,
  getServiceContainerLogs,
  updateServiceEnvVars,
  execServiceCommand,
} from '@/lib/api/services';
import { Service, CreateServiceInput, UpdateServiceInput, Status, EnvVar, ServiceDomain } from '@/lib/types';
import { toast } from 'sonner';

export interface UseServicesOptions {
  projectId?: string;
  refetchInterval?: number | false;
  enabled?: boolean;
}

export function useServices(projectId?: string, options?: UseServicesOptions) {
  return useQuery<Service[]>({
    queryKey: serviceKeys.lists(projectId),
    queryFn: () => getServices(projectId),
    refetchInterval: options?.refetchInterval ?? 15000,
    enabled: options?.enabled ?? true,
  });
}

export function useService(id: string | undefined | null) {
  return useQuery<Service | null>({
    queryKey: id ? serviceKeys.detail(id) : ['services', 'detail', 'none'],
    queryFn: () => (id ? getServiceById(id) : Promise.resolve(null)),
    enabled: Boolean(id),
  });
}

export interface UseCreateServiceOptions {
  onSuccess?: (newService: Service) => void;
  onError?: (err: Error) => void;
}

export function useCreateService(options?: UseCreateServiceOptions) {
  const queryClient = useQueryClient();

  return useMutation<Service, Error, CreateServiceInput>({
    mutationFn: createService,
    onSuccess: (newService) => {
      queryClient.invalidateQueries({ queryKey: serviceKeys.all });
      queryClient.invalidateQueries({ queryKey: projectKeys.all });
      toast.success('Service created successfully', {
        description: `Service "${newService.name}" is queued.`,
      });
      options?.onSuccess?.(newService);
    },
    onError: (err) => {
      toast.error('Failed to create service', {
        description: err.message || 'Please verify parameters and try again.',
      });
      options?.onError?.(err);
    },
  });
}

export interface UseUpdateServiceOptions {
  onSuccess?: (updated: Service) => void;
  onError?: (err: Error) => void;
}

export function useUpdateService(options?: UseUpdateServiceOptions) {
  const queryClient = useQueryClient();

  return useMutation<Service, Error, { id: string; input: UpdateServiceInput }>({
    mutationFn: ({ id, input }) => updateService(id, input),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: serviceKeys.all });
      queryClient.setQueryData(serviceKeys.detail(updated.id), updated);
      toast.success('Service configuration updated');
      options?.onSuccess?.(updated);
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to update service');
      options?.onError?.(err);
    },
  });
}

export interface UseUpdateServiceStatusOptions {
  onSuccess?: (updated: Service) => void;
  onError?: (err: Error) => void;
}

export function useUpdateServiceStatus(options?: UseUpdateServiceStatusOptions) {
  const queryClient = useQueryClient();

  return useMutation<Service, Error, { id?: string; serviceId?: string; status: Status; action?: 'start' | 'stop' | 'restart' }>({
    mutationFn: ({ id, serviceId, status, action }) => {
      const targetId = id || serviceId || '';
      return updateServiceStatus(targetId, status, action);
    },
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: serviceKeys.all });
      queryClient.setQueryData(serviceKeys.detail(updated.id), updated);
      toast.success(`Service status set to ${updated.status}`);
      options?.onSuccess?.(updated);
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to change service status');
      options?.onError?.(err);
    },
  });
}

export interface UseDeleteServiceOptions {
  onSuccess?: () => void;
  onError?: (err: Error) => void;
}

export function useDeleteService(options?: UseDeleteServiceOptions) {
  const queryClient = useQueryClient();

  return useMutation<void, Error, { id: string; projectId?: string; name?: string; slug?: string }>({
    mutationFn: ({ id }) => deleteService(id),
    onSuccess: (_, { id, projectId, name }) => {
      queryClient.invalidateQueries({ queryKey: serviceKeys.all });
      queryClient.removeQueries({ queryKey: serviceKeys.detail(id) });
      if (projectId) {
        queryClient.invalidateQueries({ queryKey: projectKeys.detail(projectId) });
      }
      queryClient.invalidateQueries({ queryKey: projectKeys.all });
      toast.success(name ? `Service "${name}" was permanently deleted` : 'Service deleted');
      options?.onSuccess?.();
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to delete service');
      options?.onError?.(err);
    },
  });
}

// Env Vars
export function useUpdateServiceEnvVars(serviceId: string, options?: { onSuccess?: () => void }) {
  const queryClient = useQueryClient();

  return useMutation<Service, Error, EnvVar[]>({
    mutationFn: (vars) => updateServiceEnvVars(serviceId, vars),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: serviceKeys.detail(serviceId) });
      queryClient.invalidateQueries({ queryKey: serviceKeys.envVars(serviceId) });
      toast.success('Environment variables saved successfully');
      options?.onSuccess?.();
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to save environment variables');
    },
  });
}

// Domains
export function useServiceDomains(serviceId: string | undefined | null) {
  return useQuery<ServiceDomain[]>({
    queryKey: serviceId ? serviceKeys.domains(serviceId) : ['services', 'domains', 'none'],
    queryFn: () => (serviceId ? getServiceDomains(serviceId) : Promise.resolve([])),
    enabled: Boolean(serviceId),
  });
}

export function useAddServiceDomain(serviceId: string, options?: { onSuccess?: () => void }) {
  const queryClient = useQueryClient();

  return useMutation<
    ServiceDomain,
    Error,
    { domain: string; port?: number; path?: string; internalPath?: string; ssl?: boolean; primary?: boolean }
  >({
    mutationFn: (input) => addServiceDomain(serviceId, input),
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: serviceKeys.domains(serviceId) });
      queryClient.invalidateQueries({ queryKey: serviceKeys.detail(serviceId) });
      toast.success(`Domain ${created.domain} attached successfully`);
      options?.onSuccess?.();
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to add domain');
    },
  });
}

export function useDeleteServiceDomain(serviceId: string, options?: { onSuccess?: () => void }) {
  const queryClient = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: (domainId) => deleteServiceDomain(serviceId, domainId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: serviceKeys.domains(serviceId) });
      queryClient.invalidateQueries({ queryKey: serviceKeys.detail(serviceId) });
      toast.success('Domain removed');
      options?.onSuccess?.();
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to remove domain');
    },
  });
}

export function useSetPrimaryServiceDomain(serviceId: string, options?: { onSuccess?: () => void }) {
  const queryClient = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: (domainId) => setPrimaryServiceDomain(serviceId, domainId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: serviceKeys.domains(serviceId) });
      queryClient.invalidateQueries({ queryKey: serviceKeys.detail(serviceId) });
      toast.success('Primary domain updated');
      options?.onSuccess?.();
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to set primary domain');
    },
  });
}

export function useServiceContainerLogs(
  serviceId: string,
  containerName?: string,
  options?: { refetchInterval?: number | false; enabled?: boolean }
) {
  return useQuery<string>({
    queryKey: serviceKeys.containerLogs(serviceId, containerName),
    queryFn: () => getServiceContainerLogs(serviceId, containerName),
    enabled: options?.enabled !== undefined ? options.enabled && Boolean(serviceId) : Boolean(serviceId),
    refetchInterval: options?.refetchInterval !== undefined ? options.refetchInterval : 3500,
  });
}

// Exec
export function useExecServiceCommand() {
  return useMutation<
    { output: string; exitCode: number; error?: string },
    Error,
    { serviceId: string; command: string; containerName?: string }
  >({
    mutationFn: ({ serviceId, command, containerName }) =>
      execServiceCommand(serviceId, command, containerName),
    onError: (err) => {
      toast.error(err.message || 'Command execution failed');
    },
  });
}
