import { simulateDelay } from './delay';
import { mockProjects, mockServices } from '@/lib/mock/data';
import { Project, CreateProjectInput, UpdateProjectInput } from '@/lib/types';

let projects = [...mockProjects];
 
export function setProjectsMockData(newProjects: Project[]): void {
  projects = [...newProjects];
}

export async function getProjects(): Promise<Project[]> {
  await simulateDelay();
  return [...projects];
}

export async function getProjectById(id: string): Promise<Project | null> {
  await simulateDelay();
  const proj = projects.find((p) => p.id === id || p.slug === id);
  return proj ? { ...proj } : null;
}

export async function createProject(input: CreateProjectInput): Promise<Project> {
  await simulateDelay();
  const newProj: Project = {
    id: `proj-${Date.now()}`,
    name: input.name,
    slug: input.slug,
    description: input.description,
    status: 'healthy',
    environment: input.environment || 'production',
    servicesCount: 0,
    healthyServicesCount: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    tags: input.tags || [],
  };
  projects.unshift(newProj);
  return newProj;
}

export async function updateProject(id: string, input: UpdateProjectInput): Promise<Project> {
  await simulateDelay();
  const index = projects.findIndex((p) => p.id === id);
  if (index === -1) throw new Error(`Project with ID ${id} not found`);

  projects[index] = {
    ...projects[index],
    ...input,
    updatedAt: new Date().toISOString(),
  };
  return { ...projects[index] };
}

export async function deleteProject(id: string): Promise<void> {
  await simulateDelay();
  projects = projects.filter((p) => p.id !== id);
}
