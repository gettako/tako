import { simulateDelay } from './delay';
import { mockNodes } from '@/lib/mock/data';
import { Node, NodeStatus, CreateNodeInput } from '@/lib/types';

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
        if (Array.isArray(data) && data.length > 0) {
          // Normalize nodes from Go API if needed
          return data.map((n: Partial<Node>) => ({
            id: n.id || `node-${Math.random().toString(36).slice(2, 8)}`,
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
