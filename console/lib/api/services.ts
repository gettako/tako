import { simulateDelay } from './delay';
import { mockServices } from '@/lib/mock/data';
import { Service, CreateServiceInput, UpdateServiceInput, EnvVar, Status, ServiceDomain } from '@/lib/types';

let services = [...mockServices];

export function setServicesMockData(newServices: Service[]): void {
  services = [...newServices];
}

function normalizeService(s: Record<string, unknown>): Service {
  const domains: ServiceDomain[] = Array.isArray(s.domains)
    ? s.domains.map((d: unknown, idx: number) =>
        typeof d === 'string'
          ? {
              id: `dom-${s.id}-${idx}`,
              domain: d,
              ssl: true,
              primary: idx === 0,
              createdAt: (s.createdAt as string) || new Date().toISOString(),
            }
          : (d as ServiceDomain)
      )
    : [];

  return {
    id: String(s.id),
    projectId: (s.projectId as string) || 'prj-default',
    name: (s.name as string) || 'Service',
    slug: (s.slug as string) || String(s.name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'service',
    type: (s.type as Service['type']) || 'app',
    status: (s.status as Status) || 'stopped',
    nodeId: (s.nodeId as string) || 'node-control',
    nodeName: (s.nodeName as string) || 'tako-control-01',
    repository: s.repository as string | undefined,
    branch: (s.branch as string) || 'main',
    commitHash: s.commitHash as string | undefined,
    dockerfile: s.dockerfile as string | undefined,
    buildCommand: s.buildCommand as string | undefined,
    composeFile: s.composeFile as string | undefined,
    image: s.image as string | undefined,
    databaseType: s.databaseType as Service['databaseType'],
    databaseVersion: s.databaseVersion as string | undefined,
    connectionString: s.connectionString as string | undefined,
    ports: Array.isArray(s.ports) ? (s.ports as number[]) : [80],
    domains,
    replicas: (s.replicas as number) || 1,
    limits: (s.limits as Service['limits']) || { cpuCores: 1, memoryMb: 1024, diskGb: 10 },
    usage: (s.usage as Service['usage']) || {
      cpuPercent: 5,
      memoryUsedMb: 120,
      memoryLimitMb: 1024,
      diskUsedGb: 0.5,
      diskTotalGb: 10,
    },
    envVars: Array.isArray(s.envVars) ? (s.envVars as EnvVar[]) : [],
    createdAt: (s.createdAt as string) || new Date().toISOString(),
    updatedAt: (s.updatedAt as string) || new Date().toISOString(),
  };
}

export async function getServices(projectId?: string): Promise<Service[]> {
  if (typeof window !== 'undefined') {
    try {
      const res = await fetch('/api/services');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          const mapped = data.map(normalizeService);
          if (projectId) {
            return mapped.filter((s) => s.projectId === projectId);
          }
          return mapped;
        }
      }
    } catch {
      // Fallback
    }
  }

  await simulateDelay();
  if (projectId) {
    return services.filter((s) => s.projectId === projectId);
  }
  return [...services];
}

export async function getServiceById(id: string): Promise<Service | null> {
  if (typeof window !== 'undefined') {
    try {
      const res = await fetch(`/api/services/${id}`);
      if (res.ok) {
        const s = await res.json();
        if (s && s.id) {
          return normalizeService(s);
        }
      }
    } catch {
      // Fallback
    }
  }

  await simulateDelay();
  const srv = services.find((s) => s.id === id || s.slug === id);
  return srv ? { ...srv } : null;
}

export async function createService(input: CreateServiceInput): Promise<Service> {
  if (typeof window !== 'undefined') {
    try {
      const res = await fetch('/api/services', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: input.projectId,
          nodeId: input.nodeId,
          name: input.name,
          slug: input.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
          type: input.type,
          repository: input.repository || '',
          branch: input.branch || 'main',
          dockerfile: input.dockerfile || 'Dockerfile',
          image: input.image || '',
          ports: input.ports || [80],
          domains: [],
          environmentVars: {},
        }),
      });
      if (res.ok) {
        const created = await res.json();
        const norm = normalizeService(created);
        services.unshift(norm);
        return norm;
      }
    } catch {
      // Fallback to local mock
    }
  }

  await simulateDelay();
  const slug = input.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const newService: Service = {
    id: `srv-${Date.now()}`,
    projectId: input.projectId,
    name: input.name,
    slug,
    type: input.type,
    status: 'deploying',
    nodeId: input.nodeId,
    nodeName: input.nodeId === 'node-2' ? 'tako-worker-01' : 'tako-control-01',
    repository: input.repository,
    branch: input.branch || 'main',
    dockerfile: input.dockerfile,
    buildCommand: input.buildCommand,
    composeFile: input.composeFile,
    image: input.image,
    databaseType: input.databaseType,
    ports: input.ports || [80],
    domains: [],
    replicas: 1,
    limits: {
      cpuCores: input.limits?.cpuCores || 1,
      memoryMb: input.limits?.memoryMb || 1024,
      diskGb: input.limits?.diskGb || 10,
    },
    usage: {
      cpuPercent: 5,
      memoryUsedMb: 120,
      memoryLimitMb: input.limits?.memoryMb || 1024,
      diskUsedGb: 0.5,
      diskTotalGb: input.limits?.diskGb || 10,
    },
    envVars: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  services.unshift(newService);
  return newService;
}

export async function updateService(id: string, input: UpdateServiceInput): Promise<Service> {
  await simulateDelay();
  const index = services.findIndex((s) => s.id === id || s.slug === id);
  if (index === -1) throw new Error(`Service ${id} not found`);

  const current = services[index];
  const updated: Service = {
    ...current,
    name: input.name !== undefined ? input.name : current.name,
    repository: input.repository !== undefined ? input.repository : current.repository,
    branch: input.branch !== undefined ? input.branch : current.branch,
    dockerfile: input.dockerfile !== undefined ? input.dockerfile : current.dockerfile,
    buildCommand: input.buildCommand !== undefined ? input.buildCommand : current.buildCommand,
    composeFile: input.composeFile !== undefined ? input.composeFile : current.composeFile,
    image: input.image !== undefined ? input.image : current.image,
    replicas: input.replicas !== undefined ? input.replicas : current.replicas,
    limits: input.limits
      ? {
          ...current.limits,
          ...input.limits,
        }
      : current.limits,
    usage: input.limits?.memoryMb
      ? {
          ...current.usage,
          memoryLimitMb: input.limits.memoryMb,
        }
      : current.usage,
    updatedAt: new Date().toISOString(),
  };

  services[index] = updated;
  return { ...updated };
}

export async function updateServiceStatus(id: string, status: Status): Promise<Service> {
  await simulateDelay();
  const index = services.findIndex((s) => s.id === id);
  if (index === -1) throw new Error(`Service ${id} not found`);
  services[index] = { ...services[index], status, updatedAt: new Date().toISOString() };
  return { ...services[index] };
}

export async function updateServiceEnvVars(id: string, envVars: EnvVar[]): Promise<Service> {
  await simulateDelay();
  const index = services.findIndex((s) => s.id === id);
  if (index === -1) throw new Error(`Service ${id} not found`);
  services[index] = { ...services[index], envVars, updatedAt: new Date().toISOString() };
  return { ...services[index] };
}

export async function deleteService(id: string): Promise<void> {
  if (typeof window !== 'undefined') {
    try {
      await fetch(`/api/services/${id}`, { method: 'DELETE' });
    } catch {
      // Fallback
    }
  }
  await simulateDelay();
  services = services.filter((s) => s.id !== id);
}
