"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  createProject,
  deleteProject,
  getProject,
  getProjects,
  type CreateProjectInput,
} from "@/services/projects.service"

export const projectKeys = {
  all: ["projects"] as const,
  list: (filters?: object) => [...projectKeys.all, "list", filters] as const,
  detail: (id: string) => [...projectKeys.all, "detail", id] as const,
}

export function useProjects(filters?: object) {
  return useQuery({
    queryKey: projectKeys.list(filters),
    queryFn: () => getProjects(),
  })
}

export function useProject(id: string, enabled = true) {
  return useQuery({
    queryKey: projectKeys.detail(id),
    queryFn: () => getProject(id),
    enabled: Boolean(id) && enabled,
  })
}

export function useCreateProject() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: CreateProjectInput) => createProject(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: projectKeys.all })
    },
  })
}

export function useDeleteProject() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => deleteProject(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: projectKeys.all })
    },
  })
}

