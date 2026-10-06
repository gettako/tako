import { simulateDelay } from './delay';
import { mockNodes } from '@/lib/mock/data';
import { Node, NodeStatus } from '@/lib/types';

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
