'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { projectKeys, serviceKeys } from './keys';
import {
  getProjects,
  getProjectById,
  createProject,
  updateProject,
  deleteProject,
} from '@/lib/api/projects';
import { Project, CreateProjectInput, UpdateProjectInput } from '@/lib/types';
import { toast } from 'sonner';

export interface UseProjectsOptions {
  refetchInterval?: number | false;
  enabled?: boolean;
}

export function useProjects(options?: UseProjectsOptions) {
  return useQuery<Project[]>({
    queryKey: projectKeys.lists(),
    queryFn: getProjects,
    refetchInterval: options?.refetchInterval ?? 30000,
    enabled: options?.enabled ?? true,
  });
}

export function useProject(id: string | undefined | null) {
  return useQuery<Project | null>({
    queryKey: id ? projectKeys.detail(id) : ['projects', 'detail', 'none'],
    queryFn: () => (id ? getProjectById(id) : Promise.resolve(null)),
    enabled: Boolean(id),
  });
}

export interface UseCreateProjectOptions {
  onSuccess?: (newProject: Project) => void;
  onError?: (err: Error) => void;
}

export function useCreateProject(options?: UseCreateProjectOptions) {
  const queryClient = useQueryClient();

  return useMutation<Project, Error, CreateProjectInput>({
    mutationFn: createProject,
    onSuccess: (newProject) => {
      queryClient.invalidateQueries({ queryKey: projectKeys.all });
      toast.success('Project created successfully', {
        description: `Project "${newProject.name}" is ready.`,
      });
      options?.onSuccess?.(newProject);
    },
    onError: (err) => {
      toast.error('Failed to create project', {
        description: err.message || 'Please check input parameters and try again.',
      });
      options?.onError?.(err);
    },
  });
}

export interface UseUpdateProjectOptions {
  onSuccess?: (updatedProject: Project) => void;
  onError?: (err: Error) => void;
}

export function useUpdateProject(options?: UseUpdateProjectOptions) {
  const queryClient = useQueryClient();

  return useMutation<Project, Error, { id: string; input: UpdateProjectInput }>({
    mutationFn: ({ id, input }) => updateProject(id, input),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: projectKeys.all });
      queryClient.setQueryData(projectKeys.detail(updated.id), updated);
      toast.success('Project updated successfully');
      options?.onSuccess?.(updated);
    },
    onError: (err) => {
      toast.error('Failed to update project', {
        description: err.message || 'Please try again.',
      });
      options?.onError?.(err);
    },
  });
}

export interface UseDeleteProjectOptions {
  onSuccess?: () => void;
  onError?: (err: Error) => void;
}

export function useDeleteProject(options?: UseDeleteProjectOptions) {
  const queryClient = useQueryClient();

  return useMutation<void, Error, { id: string; name?: string; slug?: string; cascade?: boolean }>({
    mutationFn: ({ id, cascade }) => deleteProject(id, { cascade }),
    onSuccess: (_, { id, name, slug }) => {
      queryClient.invalidateQueries({ queryKey: projectKeys.all });
      queryClient.removeQueries({ queryKey: projectKeys.detail(id) });
      if (slug) {
        queryClient.removeQueries({ queryKey: projectKeys.detail(slug) });
      }
      queryClient.invalidateQueries({ queryKey: serviceKeys.all });
      toast.success(name ? `Project "${name}" was permanently deleted` : 'Project deleted');
      options?.onSuccess?.();
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to delete project');
      options?.onError?.(err);
    },
  });
}
