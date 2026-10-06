import { simulateDelay } from './delay';
import { mockServices } from '@/lib/mock/data';
import { Service, CreateServiceInput, UpdateServiceInput, EnvVar, Status } from '@/lib/types';

let services = [...mockServices];

export function setServicesMockData(newServices: Service[]): void {
  services = [...newServices];
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

export async function getServices(projectId?: string): Promise<Service[]> {
  await simulateDelay();
  if (projectId) {
    return services.filter((s) => s.projectId === projectId);
  }
  return [...services];
}

export async function getServiceById(id: string): Promise<Service | null> {
  await simulateDelay();
  const srv = services.find((s) => s.id === id || s.slug === id);
  return srv ? { ...srv } : null;
}

export async function createService(input: CreateServiceInput): Promise<Service> {
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
    nodeName: 'tako-control-01',
    repository: input.repository,
    branch: input.branch || 'main',
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
  await simulateDelay();
  services = services.filter((s) => s.id !== id);
}
