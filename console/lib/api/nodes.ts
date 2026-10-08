import { simulateDelay } from './delay';
import { mockNodes } from '@/lib/mock/data';
import {
  Node,
  NodeStatus,
  CreateNodeInput,
  NodeTraefikConfig,
  TraefikConfigFile,
  TraefikConfigFileContent,
} from '@/lib/types';

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

export async function updateNode(
  id: string,
  data: { name?: string; ipAddress?: string; publicIp?: string }
): Promise<Node> {
  if (typeof window !== 'undefined') {
    try {
      const res = await fetch(`/api/nodes/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: data.name,
          ip_address: data.ipAddress,
          public_ip: data.publicIp,
        }),
      });
      if (res.ok) {
        return (await res.json()) as Node;
      }
    } catch {
      // Fallback
    }
  }

  await simulateDelay();
  const index = nodes.findIndex((n) => n.id === id);
  if (index === -1) throw new Error(`Node ${id} not found`);
  if (data.name) nodes[index].name = data.name;
  if (data.ipAddress) nodes[index].ipAddress = data.ipAddress;
  if (data.publicIp !== undefined) nodes[index].publicIp = data.publicIp;
  return { ...nodes[index] };
}

export async function rebootNode(id: string): Promise<{ success: boolean; message: string }> {
  if (typeof window !== 'undefined') {
    try {
      const res = await fetch(`/api/nodes/${id}/reboot`, { method: 'POST' });
      if (res.ok) {
        return await res.json();
      }
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'Failed to reboot node');
    } catch (err: any) {
      if (err.message && !err.message.includes('fetch')) {
        throw err;
      }
    }
  }

  await simulateDelay(600, 1000);
  const node = nodes.find((n) => n.id === id);
  if (!node) throw new Error('Node not found');
  node.status = 'offline';
  return { success: true, message: `Node ${node.name} reboot signal issued` };
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

const localTraefikFiles = new Map<string, Map<string, TraefikConfigFileContent>>();

export async function getNodeTraefikFiles(nodeId: string): Promise<TraefikConfigFile[]> {
  if (typeof window !== 'undefined') {
    try {
      const res = await fetch(`/api/nodes/${nodeId}/traefik/files`);
      if (res.ok) {
        return await res.json();
      }
    } catch {
      // Fallback
    }
  }

  await simulateDelay(100, 200);
  if (!localTraefikFiles.has(nodeId)) {
    const defaultMap = new Map<string, TraefikConfigFileContent>();
    // tako.yml only appears if console is assigned to a domain
    try {
      const { getDomainSettings } = await import('@/lib/api/settings');
      const ds = await getDomainSettings();
      if (ds && ds.domain && ds.domain.trim() !== '' && ds.domain !== 'localhost') {
        const cleanDom = ds.domain.trim();
        const content = `# Dynamic configuration for Tako Console reverse proxy\nhttp:\n  routers:\n    tako-console-secure:\n      rule: "Host(\`${cleanDom}\`)"\n      service: tako-console-svc\n      entryPoints:\n        - websecure\n      tls:\n        certResolver: letsencrypt\n    tako-console:\n      rule: "Host(\`${cleanDom}\`)"\n      service: tako-console-svc\n      entryPoints:\n        - web\n  services:\n    tako-console-svc:\n      loadBalancer:\n        servers:\n          - url: "http://tako-console:3000"`;
        defaultMap.set('tako.yml', {
          name: 'tako.yml',
          path: '/etc/tako/traefik/dynamic/tako.yml',
          size: content.length,
          updatedAt: new Date().toISOString(),
          isCustom: false,
          type: 'yaml',
          content,
        });
      }
    } catch {
      // Ignore fallback import error
    }
    localTraefikFiles.set(nodeId, defaultMap);
  }

  const map = localTraefikFiles.get(nodeId)!;
  return Array.from(map.values()).map(({ content: _, ...rest }) => rest);
}

export async function getNodeTraefikFileContent(
  nodeId: string,
  filename: string
): Promise<TraefikConfigFileContent> {
  if (typeof window !== 'undefined') {
    try {
      const res = await fetch(`/api/nodes/${nodeId}/traefik/files/${encodeURIComponent(filename)}`);
      if (res.ok) {
        return await res.json();
      }
    } catch {
      // Fallback
    }
  }

  await simulateDelay(80, 150);
  await getNodeTraefikFiles(nodeId);
  const map = localTraefikFiles.get(nodeId);
  if (map && map.has(filename)) {
    return map.get(filename)!;
  }

  throw new Error(`Configuration file '${filename}' not found`);
}

export async function saveNodeTraefikFile(
  nodeId: string,
  filename: string,
  content: string
): Promise<TraefikConfigFileContent> {
  if (typeof window !== 'undefined') {
    try {
      const res = await fetch(`/api/nodes/${nodeId}/traefik/files/${encodeURIComponent(filename)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      });
      if (res.ok) {
        return await res.json();
      }
    } catch {
      // Fallback
    }
  }

  await simulateDelay(100, 200);
  let map = localTraefikFiles.get(nodeId);
  if (!map) {
    await getNodeTraefikFiles(nodeId);
    map = localTraefikFiles.get(nodeId)!;
  }

  const existing = map?.get(filename);
  const updated: TraefikConfigFileContent = {
    name: filename,
    path: `/etc/tako/traefik/dynamic/${filename}`,
    size: content.length,
    updatedAt: new Date().toISOString(),
    isCustom: existing ? existing.isCustom : true,
    type: filename.endsWith('.toml') ? 'toml' : filename.endsWith('.json') ? 'json' : 'yaml',
    content,
  };
  map?.set(filename, updated);
  return updated;
}

export async function deleteNodeTraefikFile(
  nodeId: string,
  filename: string
): Promise<{ success: boolean; name: string }> {
  if (typeof window !== 'undefined') {
    try {
      const res = await fetch(`/api/nodes/${nodeId}/traefik/files/${encodeURIComponent(filename)}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        return await res.json();
      }
    } catch {
      // Fallback
    }
  }

  await simulateDelay(100, 200);
  const map = localTraefikFiles.get(nodeId);
  if (map) {
    map.delete(filename);
  }
  return { success: true, name: filename };
}


