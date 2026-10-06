import { ResourceUsage } from './common';

export type NodeStatus = 'online' | 'offline' | 'degraded';
export type NodeRole = 'leader' | 'worker';

export interface Node {
  id: string;
  name: string;
  ipAddress: string;
  role?: NodeRole;
  status: NodeStatus;
  cpuTotalCores: number;
  memoryTotalMb: number;
  diskTotalGb: number;
  usage: ResourceUsage;
  servicesCount: number;
  dockerVersion: string;
  os: string;
  kernelVersion?: string;
  publicIp?: string;
  uptime: string;
  lastHeartbeat: string;
}

export interface CreateNodeInput {
  name?: string;
  ipAddress?: string;
  publicIp?: string;
  role?: NodeRole;
}
