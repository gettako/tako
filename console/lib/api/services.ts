import { simulateDelay } from './delay';
import { mockServices } from '@/lib/mock/data';
import { Service, CreateServiceInput, UpdateServiceInput, EnvVar, Status, ServiceDomain } from '@/lib/types';

let services = [...mockServices];

export function setServicesMockData(newServices: Service[]): void {
  services = [...newServices];
}

function normalizeService(s: Record<string, unknown>): Service {
  const rawDomains = (Array.isArray(s.domainDetails) && s.domainDetails.length > 0)
    ? s.domainDetails
    : (Array.isArray(s.domains) ? s.domains : []);

  const domains: ServiceDomain[] = rawDomains.map((d: unknown, idx: number) =>
    typeof d === 'string'
      ? {
          id: `dom-${s.id}-${idx}`,
          domain: d,
          ssl: true,
          primary: idx === 0,
          createdAt: (s.createdAt as string) || new Date().toISOString(),
        }
      : (d as ServiceDomain)
  );

  const limitsRaw = (s.limits && typeof s.limits === 'object') ? (s.limits as Record<string, unknown>) : null;
  const limits: Service['limits'] = limitsRaw
    ? {
        cpuCores: limitsRaw.cpuCores !== undefined ? Number(limitsRaw.cpuCores) : 1,
        memoryMb: limitsRaw.memoryMb !== undefined ? Number(limitsRaw.memoryMb) : 1024,
        diskGb: limitsRaw.diskGb !== undefined ? Number(limitsRaw.diskGb) : 10,
        swapMb: limitsRaw.swapMb !== undefined ? Number(limitsRaw.swapMb) : 0,
      }
    : { cpuCores: 1, memoryMb: 1024, diskGb: 10 };

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
    ports: Array.isArray(s.ports) ? (s.ports as number[]) : [80],
    domains,
    publishToHost:
      s.publishToHost !== undefined
        ? Boolean(s.publishToHost)
        : s.publish_to_host !== undefined
        ? Boolean(s.publish_to_host)
        : true,
    replicas: (s.replicas as number) || 1,
    limits,
    usage: (s.usage as Service['usage']) || {
      cpuPercent: 5,
      memoryUsedMb: 120,
      memoryLimitMb: limits.memoryMb || 1024,
      diskUsedGb: 0.5,
      diskTotalGb: limits.diskGb || 10,
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
        if (Array.isArray(data)) {
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
          publishToHost: input.publishToHost !== undefined ? input.publishToHost : true,
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
  if (typeof window !== 'undefined') {
    try {
      const res = await fetch(`/api/services/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      if (res.ok) {
        const updatedService = await res.json();
        const index = services.findIndex((s) => s.id === id || s.slug === id);
        if (index !== -1) {
          services[index] = { ...services[index], ...updatedService };
        }
        return updatedService;
      }
    } catch {
      // Fallback
    }
  }

  await simulateDelay();
  const index = services.findIndex((s) => s.id === id || s.slug === id);
  if (index === -1) throw new Error(`Service ${id} not found`);

  const current = services[index];
  const updated: Service = {
    ...current,
    name: input.name !== undefined ? input.name : current.name,
    repository: input.repository !== undefined ? input.repository : current.repository,
    branch: input.branch !== undefined ? input.branch : current.branch,
    commitHash: input.commitHash !== undefined ? input.commitHash : current.commitHash,
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

export async function updateServiceStatus(
  id: string,
  status: Status,
  action?: 'start' | 'stop' | 'restart'
): Promise<Service> {
  if (typeof window !== 'undefined') {
    try {
      const res = await fetch(`/api/services/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, action }),
      });
      if (res.ok) {
        const s = await res.json();
        const norm = normalizeService(s);
        const index = services.findIndex((item) => item.id === id);
        if (index !== -1) {
          services[index] = { ...services[index], ...norm };
        }
        return norm;
      }
    } catch {
      // ignore
    }
  }
  const index = services.findIndex((s) => s.id === id);
  if (index !== -1) {
    services[index] = { ...services[index], status, updatedAt: new Date().toISOString() };
    return { ...services[index] };
  }
  return { id, status } as Service;
}

export async function getServiceDomains(serviceId: string): Promise<ServiceDomain[]> {
  if (typeof window !== 'undefined') {
    try {
      const res = await fetch(`/api/services/${serviceId}/domains`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          return data.map((d: any, idx: number) => ({
            id: d.id || `dom-${serviceId}-${idx}`,
            domain: d.domain,
            ssl: d.ssl !== false,
            primary: Boolean(d.primary),
            port: d.port || 80,
            path: d.path || '/',
            certificateType: d.certificateType || 'letsencrypt',
            createdAt: d.createdAt || new Date().toISOString(),
          }));
        }
      }
    } catch {
      // Fallback
    }
  }
  const s = services.find((srv) => srv.id === serviceId);
  return s?.domains || [];
}

export async function addServiceDomain(
  serviceId: string,
  input: { domain: string; port?: number; path?: string; ssl?: boolean; primary?: boolean }
): Promise<ServiceDomain> {
  if (typeof window !== 'undefined') {
    try {
      const res = await fetch(`/api/services/${serviceId}/domains`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      if (res.ok) {
        const created = await res.json();
        const dom: ServiceDomain = {
          id: created.id,
          domain: created.domain,
          ssl: created.ssl !== false,
          primary: Boolean(created.primary),
          port: created.port || 80,
          path: created.path || '/',
          certificateType: created.certificateType || 'letsencrypt',
          createdAt: created.createdAt || new Date().toISOString(),
        };
        const s = services.find((srv) => srv.id === serviceId);
        if (s) {
          if (dom.primary) {
            s.domains.forEach((d) => (d.primary = false));
          }
          s.domains.push(dom);
        }
        return dom;
      }
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'Failed to add domain');
    } catch (err) {
      if (err instanceof Error && err.message !== 'Failed to fetch') {
        throw err;
      }
    }
  }
  await simulateDelay();
  const newDomain: ServiceDomain = {
    id: `dom-${Date.now()}`,
    domain: input.domain,
    port: input.port || 80,
    path: input.path || '/',
    ssl: input.ssl !== false,
    primary: Boolean(input.primary),
    createdAt: new Date().toISOString(),
  };
  const s = services.find((srv) => srv.id === serviceId);
  if (s) {
    if (newDomain.primary) {
      s.domains.forEach((d) => (d.primary = false));
    }
    s.domains.push(newDomain);
  }
  return newDomain;
}

export async function deleteServiceDomain(serviceId: string, domainId: string): Promise<void> {
  if (typeof window !== 'undefined') {
    try {
      const res = await fetch(`/api/services/${serviceId}/domains/${domainId}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to delete domain');
      }
      return;
    } catch (err) {
      if (err instanceof Error && err.message !== 'Failed to fetch') {
        throw err;
      }
    }
  }
  await simulateDelay();
  const s = services.find((srv) => srv.id === serviceId);
  if (s) {
    const wasPrimary = s.domains.find((d) => d.id === domainId)?.primary;
    s.domains = s.domains.filter((d) => d.id !== domainId);
    if (wasPrimary && s.domains.length > 0) {
      s.domains[0].primary = true;
    }
  }
}

export async function setPrimaryServiceDomain(serviceId: string, domainId: string): Promise<void> {
  if (typeof window !== 'undefined') {
    try {
      const res = await fetch(`/api/services/${serviceId}/domains/${domainId}`, {
        method: 'PATCH',
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to set primary domain');
      }
      return;
    } catch (err) {
      if (err instanceof Error && err.message !== 'Failed to fetch') {
        throw err;
      }
    }
  }
  await simulateDelay();
  const s = services.find((srv) => srv.id === serviceId);
  if (s) {
    s.domains.forEach((d) => {
      d.primary = d.id === domainId;
    });
  }
}

export async function updateServiceEnvVars(id: string, envVars: EnvVar[]): Promise<Service> {
  if (typeof window !== 'undefined') {
    try {
      const res = await fetch(`/api/services/${id}/env`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          envVars.map((e) => ({
            key: e.key,
            value: e.value,
            isSecret: e.isSecret,
          }))
        ),
      });
      if (res.ok) {
        const updatedVars = await res.json();
        const index = services.findIndex((s) => s.id === id);
        if (index !== -1) {
          services[index] = { ...services[index], envVars: updatedVars, updatedAt: new Date().toISOString() };
          return { ...services[index] };
        }
      }
    } catch {
      // Fallback
    }
  }

  await simulateDelay();
  const index = services.findIndex((s) => s.id === id);
  if (index === -1) throw new Error(`Service ${id} not found`);
  services[index] = { ...services[index], envVars, updatedAt: new Date().toISOString() };
  return { ...services[index] };
}

export async function getServiceEnvVars(id: string): Promise<EnvVar[]> {
  if (typeof window !== 'undefined') {
    try {
      const res = await fetch(`/api/services/${id}/env`);
      if (res.ok) {
        return await res.json();
      }
    } catch {
      // Fallback
    }
  }
  const s = services.find((srv) => srv.id === id);
  return s?.envVars || [];
}

export async function execServiceCommand(
  id: string,
  command: string,
  containerName?: string
): Promise<{ output: string; exitCode: number; error?: string }> {
  if (typeof window !== 'undefined') {
    try {
      const res = await fetch(`/api/services/${id}/exec`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command, containerName }),
      });
      if (res.ok) {
        return await res.json();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Execution failed';
      return { output: msg, exitCode: 1, error: msg };
    }
  }
  return { output: 'Container terminal service unavailable', exitCode: 1 };
}

export async function getServiceContainerLogs(id: string, containerName?: string): Promise<string> {
  if (typeof window !== 'undefined') {
    try {
      const url = containerName
        ? `/api/services/${id}/container-logs?containerName=${encodeURIComponent(containerName)}`
        : `/api/services/${id}/container-logs`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        return data.logs || '';
      }
    } catch {
      // Fallback
    }
  }
  return '';
}

export async function deleteService(id: string): Promise<void> {
  if (typeof window !== 'undefined') {
    try {
      const res = await fetch(`/api/services/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to delete service');
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.message !== 'Failed to fetch') {
        throw err;
      }
    }
  }
  await simulateDelay();
  services = services.filter((s) => s.id !== id);
}
