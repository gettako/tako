import { simulateDelay } from './delay';
import { mockProjects, mockServices } from '@/lib/mock/data';
import { Project, CreateProjectInput, UpdateProjectInput } from '@/lib/types';

let projects = [...mockProjects];
 
export function setProjectsMockData(newProjects: Project[]): void {
  projects = [...newProjects];
}

export async function getProjects(): Promise<Project[]> {
  if (typeof window !== 'undefined') {
    try {
      const res = await fetch('/api/projects');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          return data.map((p: Partial<Project>) => ({
            id: p.id || `proj-${Math.random().toString(36).slice(2, 8)}`,
            name: p.name || 'Untitled Project',
            slug: p.slug || p.name?.toLowerCase().replace(/\s+/g, '-') || 'untitled',
            description: p.description || '',
            status: p.status || 'healthy',
            environment: p.environment || 'production',
            servicesCount: p.servicesCount ?? 0,
            healthyServicesCount: p.healthyServicesCount ?? 0,
            createdAt: p.createdAt || new Date().toISOString(),
            updatedAt: p.updatedAt || new Date().toISOString(),
            tags: p.tags || [],
          })) as Project[];
        }
      }
    } catch {
      // Fallback to local
    }
  }

  await simulateDelay();
  return [...projects];
}

export async function getProjectById(id: string): Promise<Project | null> {
  if (typeof window !== 'undefined') {
    try {
      const res = await fetch(`/api/projects/${id}`);
      if (res.ok) {
        const p = await res.json();
        if (p && p.id) {
          return {
            id: p.id,
            name: p.name || 'Untitled Project',
            slug: p.slug || id,
            description: p.description || '',
            status: p.status || 'healthy',
            environment: p.environment || 'production',
            servicesCount: p.servicesCount ?? 0,
            healthyServicesCount: p.healthyServicesCount ?? 0,
            createdAt: p.createdAt || new Date().toISOString(),
            updatedAt: p.updatedAt || new Date().toISOString(),
            tags: p.tags || [],
          };
        }
      }
    } catch {
      // Fallback
    }
  }

  await simulateDelay();
  const proj = projects.find((p) => p.id === id || p.slug === id);
  return proj ? { ...proj } : null;
}

export async function createProject(input: CreateProjectInput): Promise<Project> {
  if (typeof window !== 'undefined') {
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      if (res.ok) {
        const created = await res.json();
        if (created && created.id) {
          projects.unshift(created);
          return created;
        }
      }
    } catch {
      // Fallback
    }
  }

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
  if (typeof window !== 'undefined') {
    let res: Response | null = null;
    try {
      res = await fetch(`/api/projects/${id}`, { method: 'DELETE' });
    } catch {
      // Network failure / offline
    }

    if (res) {
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to delete project');
      }
    } else {
      // Fallback check against mock services
      const hasServices = mockServices.some((s) => s.projectId === id);
      if (hasServices) {
        throw new Error('Cannot delete project: project contains services. Please delete all services first.');
      }
    }
  } else {
    const hasServices = mockServices.some((s) => s.projectId === id);
    if (hasServices) {
      throw new Error('Cannot delete project: project contains services. Please delete all services first.');
    }
  }

  await simulateDelay();
  projects = projects.filter((p) => p.id !== id && p.slug !== id);
}
