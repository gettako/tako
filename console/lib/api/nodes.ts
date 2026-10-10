import {
  Node,
  NodeStatus,
  NodeTraefikConfig,
  TraefikConfigFile,
  TraefikConfigFileContent,
} from '@/lib/types';

export async function getNodes(): Promise<Node[]> {
  const res = await fetch('/api/nodes');
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Failed to fetch cluster nodes');
  }
  const data = await res.json();
  if (!Array.isArray(data)) {
    return [];
  }
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

export async function getNodeById(id: string): Promise<Node | null> {
  const res = await fetch(`/api/nodes/${id}`);
  if (res.status === 404) {
    return null;
  }
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Failed to fetch node ${id}`);
  }
  const n = await res.json();
  if (!n || !n.id) {
    return null;
  }
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

export async function updateNode(
  id: string,
  input: { name?: string; role?: 'leader' | 'worker'; ipAddress?: string; publicIp?: string }
): Promise<Node> {
  const res = await fetch(`/api/nodes/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Failed to update node configuration');
  }
  return res.json();
}

export async function rebootNode(id: string): Promise<{ success: boolean; message: string }> {
  const res = await fetch(`/api/nodes/${id}/reboot`, { method: 'POST' });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Failed to reboot node');
  }
  return res.json();
}

export async function updateNodeStatus(id: string, status: NodeStatus): Promise<Node> {
  const node = await getNodeById(id);
  if (!node) throw new Error('Node not found');
  return { ...node, status };
}

export async function getOfflineNodesCount(): Promise<number> {
  const list = await getNodes();
  return list.filter((n) => n.status === 'offline').length;
}

export async function createNodeEnrollToken(): Promise<{ token: string; expiresAt?: string }> {
  const res = await fetch('/api/nodes/enroll-token', { method: 'POST' });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Failed to generate enrollment token');
  }
  return res.json();
}

export const getNodeEnrollToken = createNodeEnrollToken;

export function getNodeEventsStreamUrl(): string {
  return '/api/sse/nodes';
}

/* --- Node Traefik Configuration & Dynamic Files --- */

export async function getNodeTraefikConfig(nodeId: string): Promise<NodeTraefikConfig> {
  const res = await fetch(`/api/nodes/${nodeId}/traefik`);
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Failed to fetch node Traefik configuration');
  }
  return res.json();
}

export async function updateNodeTraefikConfig(
  nodeId: string,
  input: Partial<NodeTraefikConfig>
): Promise<NodeTraefikConfig> {
  const res = await fetch(`/api/nodes/${nodeId}/traefik`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Failed to update Traefik configuration');
  }
  return res.json();
}

export async function reloadNodeTraefik(
  nodeId: string
): Promise<{ success: boolean; message: string; reloadedAt: string }> {
  const res = await fetch(`/api/nodes/${nodeId}/traefik/reload`, { method: 'POST' });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Failed to reload Traefik configuration');
  }
  return res.json();
}

export async function getNodeTraefikFiles(nodeId: string): Promise<TraefikConfigFile[]> {
  const res = await fetch(`/api/nodes/${nodeId}/traefik/files`);
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Failed to fetch Traefik configuration files');
  }
  return res.json();
}

export async function getNodeTraefikFileContent(
  nodeId: string,
  filename: string
): Promise<TraefikConfigFileContent> {
  const res = await fetch(`/api/nodes/${nodeId}/traefik/files/${encodeURIComponent(filename)}`);
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Failed to fetch file content: ${filename}`);
  }
  return res.json();
}

export async function saveNodeTraefikFile(
  nodeId: string,
  filename: string,
  content: string
): Promise<TraefikConfigFileContent> {
  const res = await fetch(`/api/nodes/${nodeId}/traefik/files/${encodeURIComponent(filename)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Failed to save Traefik file: ${filename}`);
  }
  return res.json();
}

export async function deleteNodeTraefikFile(
  nodeId: string,
  filename: string
): Promise<{ success: boolean; name: string }> {
  const res = await fetch(`/api/nodes/${nodeId}/traefik/files/${encodeURIComponent(filename)}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Failed to delete Traefik file: ${filename}`);
  }
  return res.json();
}
