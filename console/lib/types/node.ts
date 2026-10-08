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

export interface NodeTraefikConfig {
  nodeId: string;
  enabled: boolean;
  httpPort: number;
  httpsPort: number;
  dashboardEnabled: boolean;
  dashboardPort: number;
  acmeEmail: string;
  logLevel: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
  accessLogEnabled: boolean;
  forceHttps: boolean;
  dynamicConfigDir: string;
  certResolver: string;
  metricsEnabled: boolean;
  lastReloadedAt?: string;
  activeRoutersCount?: number;
  activeServicesCount?: number;
}

export interface TraefikConfigFile {
  name: string;
  path: string;
  size: number;
  updatedAt: string;
  isCustom: boolean;
  type: 'yaml' | 'toml' | 'json';
}

export interface TraefikConfigFileContent extends TraefikConfigFile {
  content: string;
}
