import { Service, CreateServiceInput, UpdateServiceInput, EnvVar, Status, ServiceDomain } from '@/lib/types';

export function normalizeService(s: Record<string, unknown>): Service {
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
    connectionString: s.connectionString as string | undefined,
    autoRollbackEnabled:
      s.autoRollbackEnabled !== undefined
        ? Boolean(s.autoRollbackEnabled)
        : s.auto_rollback_enabled !== undefined
        ? Boolean(s.auto_rollback_enabled)
        : true,
    autoScaling: s.autoScaling as Service['autoScaling'] | undefined,
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
      diskGb: limits.diskGb || 10,
      diskUsedGb: 0.5,
      diskTotalGb: limits.diskGb || 10,
    },
    envVars: Array.isArray(s.envVars) ? (s.envVars as EnvVar[]) : [],
    createdAt: (s.createdAt as string) || new Date().toISOString(),
    updatedAt: (s.updatedAt as string) || new Date().toISOString(),
  };
}

export async function getServices(projectId?: string): Promise<Service[]> {
  const url = projectId ? `/api/services?projectId=${encodeURIComponent(projectId)}` : '/api/services';
  const res = await fetch(url);
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Failed to fetch services (HTTP ${res.status})`);
  }
  const data = await res.json();
  if (!Array.isArray(data)) return [];
  const mapped = data.map(normalizeService);
  if (projectId) {
    return mapped.filter((s) => s.projectId === projectId);
  }
  return mapped;
}

export async function getServiceById(id: string): Promise<Service | null> {
  const res = await fetch(`/api/services/${encodeURIComponent(id)}`);
  if (res.status === 404) return null;
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Failed to fetch service ${id} (HTTP ${res.status})`);
  }
  const s = await res.json();
  return s && s.id ? normalizeService(s) : null;
}

export async function createService(input: CreateServiceInput): Promise<Service> {
  const res = await fetch('/api/services', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      projectId: input.projectId,
      nodeId: input.nodeId,
      name: input.name,
      slug: input.slug || input.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      type: input.type,
      databaseType: input.databaseType,
      databaseVersion: input.databaseVersion,
      connectionString: input.connectionString,
      repository: input.repository || '',
      branch: input.branch || 'main',
      dockerfile: input.dockerfile || 'Dockerfile',
      image: input.image || '',
      ports: input.ports || (input.type === 'database' ? [] : [80]),
      domains: [],
      environmentVars: {},
      publishToHost: input.publishToHost !== undefined ? input.publishToHost : true,
      autoScaling: input.autoScaling,
    }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Failed to create service (HTTP ${res.status})`);
  }
  const created = await res.json();
  return normalizeService(created);
}

export async function updateService(id: string, input: UpdateServiceInput): Promise<Service> {
  const res = await fetch(`/api/services/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Failed to update service ${id} (HTTP ${res.status})`);
  }
  const updated = await res.json();
  return normalizeService(updated);
}

export async function updateServiceStatus(
  id: string,
  status: Status,
  action?: 'start' | 'stop' | 'restart'
): Promise<Service> {
  const res = await fetch(`/api/services/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status, action }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Failed to update service status (HTTP ${res.status})`);
  }
  const s = await res.json();
  return normalizeService(s);
}

export async function getServiceDomains(serviceId: string): Promise<ServiceDomain[]> {
  const res = await fetch(`/api/services/${encodeURIComponent(serviceId)}/domains`);
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Failed to fetch domains for service ${serviceId}`);
  }
  const data = await res.json();
  if (!Array.isArray(data)) return [];
  return data.map((d: any, idx: number) => ({
    id: d.id || `dom-${serviceId}-${idx}`,
    domain: d.domain,
    ssl: d.ssl !== false,
    primary: Boolean(d.primary),
    port: d.port || 80,
    path: d.path || '/',
    internalPath: d.internalPath || '/',
    certificateType: d.certificateType || 'letsencrypt',
    createdAt: d.createdAt || new Date().toISOString(),
  }));
}

export async function addServiceDomain(
  serviceId: string,
  input: { domain: string; port?: number; path?: string; internalPath?: string; ssl?: boolean; primary?: boolean }
): Promise<ServiceDomain> {
  const res = await fetch(`/api/services/${encodeURIComponent(serviceId)}/domains`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Failed to add domain');
  }
  const created = await res.json();
  return {
    id: created.id,
    domain: created.domain,
    ssl: created.ssl !== false,
    primary: Boolean(created.primary),
    port: created.port || 80,
    path: created.path || '/',
    internalPath: created.internalPath || input.internalPath || '/',
    certificateType: created.certificateType || 'letsencrypt',
    createdAt: created.createdAt || new Date().toISOString(),
  };
}

export async function deleteServiceDomain(serviceId: string, domainId: string): Promise<void> {
  const res = await fetch(`/api/services/${encodeURIComponent(serviceId)}/domains/${encodeURIComponent(domainId)}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Failed to delete domain');
  }
}

export async function setPrimaryServiceDomain(serviceId: string, domainId: string): Promise<void> {
  const res = await fetch(`/api/services/${encodeURIComponent(serviceId)}/domains/${encodeURIComponent(domainId)}`, {
    method: 'PATCH',
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Failed to set primary domain');
  }
}

export async function updateServiceEnvVars(id: string, envVars: EnvVar[]): Promise<Service> {
  const res = await fetch(`/api/services/${encodeURIComponent(id)}/env`, {
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
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Failed to update environment variables');
  }
  const updated = await getServiceById(id);
  if (!updated) {
    throw new Error(`Service ${id} not found after env update`);
  }
  return updated;
}

export async function getServiceEnvVars(id: string): Promise<EnvVar[]> {
  const res = await fetch(`/api/services/${encodeURIComponent(id)}/env`);
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Failed to fetch environment variables');
  }
  return await res.json();
}

export async function execServiceCommand(
  id: string,
  command: string,
  containerName?: string
): Promise<{ output: string; exitCode: number; error?: string }> {
  const res = await fetch(`/api/services/${encodeURIComponent(id)}/exec`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ command, containerName }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    return {
      output: data.error || `Execution failed (HTTP ${res.status})`,
      exitCode: 1,
      error: data.error || 'Execution failed',
    };
  }
  return await res.json();
}

export async function getServiceContainerLogs(id: string, containerName?: string): Promise<string> {
  const url = containerName
    ? `/api/services/${encodeURIComponent(id)}/container-logs?containerName=${encodeURIComponent(containerName)}`
    : `/api/services/${encodeURIComponent(id)}/container-logs`;
  const res = await fetch(url);
  if (!res.ok) {
    return '';
  }
  const data = await res.json();
  return data.logs || '';
}

export async function deleteService(id: string): Promise<void> {
  const res = await fetch(`/api/services/${encodeURIComponent(id)}`, { method: 'DELETE' });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Failed to delete service');
  }
}
