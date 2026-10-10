import { Project, CreateProjectInput, UpdateProjectInput } from '@/lib/types';

export async function getProjects(): Promise<Project[]> {
  const res = await fetch('/api/projects');
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Failed to fetch projects');
  }
  const data = await res.json();
  if (!Array.isArray(data)) {
    return [];
  }
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
  })) as Project[];
}

export async function getProjectById(id: string): Promise<Project | null> {
  const res = await fetch(`/api/projects/${id}`);
  if (res.status === 404) {
    return null;
  }
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Failed to fetch project ${id}`);
  }
  const p = await res.json();
  if (!p || !p.id) {
    return null;
  }
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
  };
}

export async function createProject(input: CreateProjectInput): Promise<Project> {
  const res = await fetch('/api/projects', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Failed to create project');
  }
  return res.json();
}

export async function updateProject(id: string, input: UpdateProjectInput): Promise<Project> {
  const res = await fetch(`/api/projects/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Failed to update project');
  }
  return res.json();
}

export async function deleteProject(id: string): Promise<void> {
  const res = await fetch(`/api/projects/${id}`, { method: 'DELETE' });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Failed to delete project');
  }
}
