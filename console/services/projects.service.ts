import { apiDelete, apiGet, apiPost, type ApiProject } from "@/lib/api"
import { adaptProject } from "@/lib/adapters"
import type { Project } from "@/types/platform"

export interface CreateProjectInput {
  name: string
  slug: string
  description: string
  environment: string
}

export async function getProjects(): Promise<Project[]> {
  const data = await apiGet<ApiProject[]>("/projects")
  return data.map(adaptProject)
}

export async function getProject(id: string): Promise<Project> {
  const data = await apiGet<ApiProject>(`/projects/${id}`)
  return adaptProject(data)
}

export async function createProject(
  input: CreateProjectInput
): Promise<Project> {
  const created = await apiPost<ApiProject>("/projects", input)
  return adaptProject(created)
}

export async function deleteProject(id: string): Promise<void> {
  await apiDelete(`/projects/${id}`)
}

