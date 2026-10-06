import { simulateDelay } from './delay';
import { mockNodes } from '@/lib/mock/data';
import { Node, NodeStatus, CreateNodeInput } from '@/lib/types';

let nodes = [...mockNodes];

export function setNodesMockData(newNodes: Node[]): void {
  nodes = [...newNodes];
}

export async function getNodes(): Promise<Node[]> {
  await simulateDelay();
  return [...nodes];
}

export async function getNodeById(id: string): Promise<Node | null> {
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
    role: 'worker', // All nodes are worker nodes
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
