import { simulateDelay } from './delay';
import { mockNodes } from '@/lib/mock/data';
import { Node, NodeStatus, CreateNodeInput, NodeTraefikConfig } from '@/lib/types';

let nodes = [...mockNodes];

export function setNodesMockData(newNodes: Node[]): void {
  nodes = [...newNodes];
}

export async function getNodes(): Promise<Node[]> {
  if (typeof window !== 'undefined') {
    try {
      const res = await fetch('/api/nodes');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          // Return real nodes from server (do not fallback to mock)
          return data.map((n: Partial<Node>) => ({
            id: n.id || `node-${Math.random().toString(36).slice(2, 8)}`,
            name: n.name || 'tako-master-01',
            ipAddress: n.ipAddress || '127.0.0.1',
            publicIp: n.publicIp || n.ipAddress || '127.0.0.1',
            role: n.role || 'worker',
            status: n.status || 'online',
            cpuTotalCores: n.cpuTotalCores || 4,
            memoryTotalMb: n.memoryTotalMb || 8192,
            diskTotalGb: n.diskTotalGb || 100,
            usage: n.usage || {
              cpuPercent: 5,
              memoryUsedMb: 1024,
              memoryLimitMb: n.memoryTotalMb || 8192,
              diskUsedGb: 20,
              diskTotalGb: n.diskTotalGb || 100,
              networkRxKbps: 10,
              networkTxKbps: 15,
            },
            servicesCount: n.servicesCount ?? 0,
            dockerVersion: n.dockerVersion || '26.1.0',
            os: n.os || 'Linux',
            kernelVersion: n.kernelVersion,
            uptime: n.uptime || 'Uptime: running',
            lastHeartbeat: n.lastHeartbeat || new Date().toISOString(),
          })) as Node[];
        }
      }
    } catch {
      // Fallback to mock data when master server is unreachable
    }
  }

  await simulateDelay();
  return [...nodes];
}

export async function getNodeById(id: string): Promise<Node | null> {
  if (typeof window !== 'undefined') {
    try {
      const res = await fetch(`/api/nodes/${id}`);
      if (res.ok) {
        const n = await res.json();
        if (n && n.id) {
          return {
            id: n.id,
            name: n.name || 'node-worker',
            ipAddress: n.ipAddress || '127.0.0.1',
            publicIp: n.publicIp || n.ipAddress || '127.0.0.1',
            role: n.role || 'worker',
            status: n.status || 'online',
            cpuTotalCores: n.cpuTotalCores || 4,
            memoryTotalMb: n.memoryTotalMb || 8192,
            diskTotalGb: n.diskTotalGb || 100,
            usage: n.usage || {
              cpuPercent: 5,
              memoryUsedMb: 1024,
              memoryLimitMb: n.memoryTotalMb || 8192,
              diskUsedGb: 20,
              diskTotalGb: n.diskTotalGb || 100,
              networkRxKbps: 10,
              networkTxKbps: 15,
            },
            servicesCount: n.servicesCount ?? 0,
            dockerVersion: n.dockerVersion || '26.1.0',
            os: n.os || 'Linux',
            uptime: n.uptime || 'Uptime: running',
            lastHeartbeat: n.lastHeartbeat || new Date().toISOString(),
          };
        }
      }
    } catch {
      // Fallback
    }
  }

  await simulateDelay();
  const node = nodes.find((n) => n.id === id);
  return node ? { ...node } : null;
}

export async function createNode(input?: CreateNodeInput): Promise<Node> {
  await simulateDelay();
  const randomSuffix = Math.floor(10 + Math.random() * 90);
  const randomHostNum = Math.floor(20 + Math.random() * 200);
  const newNode: Node = {
    id: `node-${Date.now().toString(36)}`,
    name: input?.name || `node-${randomSuffix}-ams`,
    ipAddress: input?.ipAddress || `192.168.1.${randomHostNum}`,
    publicIp: input?.publicIp || `142.250.${randomSuffix}.${randomHostNum}`,
    role: 'worker',
    status: 'online',
    cpuTotalCores: 16,
    memoryTotalMb: 32768,
    diskTotalGb: 500,
    usage: {
      cpuPercent: 8,
      memoryUsedMb: 4096,
      memoryLimitMb: 32768,
      diskUsedGb: 45,
      diskTotalGb: 500,
      networkRxKbps: 24,
      networkTxKbps: 36,
    },
    servicesCount: 0,
    dockerVersion: '26.1.0',
    os: 'Linux (auto-detected by agent)',
    uptime: 'Just registered',
    lastHeartbeat: new Date().toISOString(),
  };
  nodes.unshift(newNode);
  return newNode;
}

export async function deleteNode(id: string): Promise<void> {
  if (typeof window !== 'undefined') {
    try {
      await fetch(`/api/nodes/${id}`, { method: 'DELETE' });
    } catch {
      // Fallback
    }
  }
  await simulateDelay();
  nodes = nodes.filter((n) => n.id !== id);
}

export async function updateNodeStatus(id: string, status: NodeStatus): Promise<Node> {
  await simulateDelay();
  const index = nodes.findIndex((n) => n.id === id);
  if (index === -1) throw new Error(`Node ${id} not found`);
  nodes[index] = { ...nodes[index], status };
  return { ...nodes[index] };
}

export async function getOfflineNodesCount(): Promise<number> {
  await simulateDelay(50, 100);
  return nodes.filter((n) => n.status === 'offline').length;
}

export async function createNodeEnrollToken(): Promise<{ token: string; expiresAt?: string }> {
  if (typeof window !== 'undefined') {
    try {
      const res = await fetch('/api/nodes/enroll-token', { method: 'POST' });
      if (res.ok) {
        return await res.json();
      }
    } catch {
      // Fallback
    }
  }
  return { token: `tako_enroll_${Math.random().toString(36).slice(2, 12)}` };
}

export const getNodeEnrollToken = createNodeEnrollToken;

export function getNodeEventsStreamUrl(): string {
  return '/api/sse/nodes';
}

/* --- Node Traefik Ingress Configuration --- */
const localTraefikConfigs = new Map<string, NodeTraefikConfig>();

export async function getNodeTraefikConfig(nodeId: string): Promise<NodeTraefikConfig> {
  if (typeof window !== 'undefined') {
    try {
      const res = await fetch(`/api/nodes/${nodeId}/traefik`);
      if (res.ok) {
        const data = await res.json();
        localTraefikConfigs.set(nodeId, data);
        return data as NodeTraefikConfig;
      }
    } catch {
      // Fallback
    }
  }

  await simulateDelay(50, 150);
  if (localTraefikConfigs.has(nodeId)) {
    return { ...localTraefikConfigs.get(nodeId)! };
  }

  const fallback: NodeTraefikConfig = {
    nodeId,
    enabled: true,
    httpPort: 80,
    httpsPort: 443,
    dashboardEnabled: false,
    dashboardPort: 8080,
    acmeEmail: 'admin@gettako.dev',
    logLevel: 'INFO',
    accessLogEnabled: true,
    forceHttps: true,
    dynamicConfigDir: '/etc/tako/traefik/dynamic',
    certResolver: 'letsencrypt',
    metricsEnabled: true,
    lastReloadedAt: new Date().toISOString(),
    activeRoutersCount: 1,
    activeServicesCount: 1,
  };
  localTraefikConfigs.set(nodeId, fallback);
  return fallback;
}

export async function updateNodeTraefikConfig(
  nodeId: string,
  input: Partial<NodeTraefikConfig>
): Promise<NodeTraefikConfig> {
  if (typeof window !== 'undefined') {
    try {
      const res = await fetch(`/api/nodes/${nodeId}/traefik`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      if (res.ok) {
        const data = await res.json();
        localTraefikConfigs.set(nodeId, data);
        return data as NodeTraefikConfig;
      }
    } catch {
      // Fallback
    }
  }

  await simulateDelay(100, 250);
  const existing = await getNodeTraefikConfig(nodeId);
  const updated: NodeTraefikConfig = {
    ...existing,
    ...input,
    nodeId,
    lastReloadedAt: new Date().toISOString(),
  };
  localTraefikConfigs.set(nodeId, updated);
  return updated;
}

export async function reloadNodeTraefik(
  nodeId: string
): Promise<{ success: boolean; message: string; reloadedAt: string }> {
  if (typeof window !== 'undefined') {
    try {
      const res = await fetch(`/api/nodes/${nodeId}/traefik/reload`, {
        method: 'POST',
      });
      if (res.ok) {
        return await res.json();
      }
    } catch {
      // Fallback
    }
  }

  await simulateDelay(150, 300);
  const now = new Date().toISOString();
  if (localTraefikConfigs.has(nodeId)) {
    const existing = localTraefikConfigs.get(nodeId)!;
    existing.lastReloadedAt = now;
    localTraefikConfigs.set(nodeId, existing);
  }
  return {
    success: true,
    message: 'Traefik configuration rules successfully reloaded on node',
    reloadedAt: now,
  };
}


