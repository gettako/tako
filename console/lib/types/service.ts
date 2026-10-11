import { Status, ResourceLimit, ResourceUsage, EnvVar } from './common';

export type ServiceType = 'app' | 'compose' | 'database';

export interface ServiceDomain {
  id: string;
  domain: string;
  ssl: boolean;
  primary: boolean;
  port?: number;
  path?: string;
  internalPath?: string;
  certificateType?: 'letsencrypt' | 'custom' | 'none';
  createdAt: string;
}

export interface Service {
  id: string;
  projectId: string;
  name: string;
  slug: string;
  type: ServiceType;
  status: Status;
  nodeId: string;
  nodeName: string;
  
  // App/Compose attributes
  repository?: string;
  branch?: string;
  commitHash?: string;
  dockerfile?: string;
  buildCommand?: string;
  composeFile?: string;
  image?: string;
  
  // Database attributes
  databaseType?: 'postgresql' | 'mysql' | 'redis' | 'mongodb';
  databaseVersion?: string;
  connectionString?: string;
  
  // Networking & scale
  ports: number[];
  domains: ServiceDomain[];
  publishToHost?: boolean;
  replicas: number;
  
  // Resources & Config
  limits: ResourceLimit;
  usage: ResourceUsage;
  envVars: EnvVar[];
  
  // Deployment Safety
  autoRollbackEnabled?: boolean;
  maintenanceMode?: boolean;

  // Health Check Probes
  healthCheckPath?: string;
  healthCheckPort?: number;
  healthCheckInterval?: number;
  healthCheckTimeout?: number;
  healthCheckRetries?: number;
  healthCheckInitialDelay?: number;
  registryId?: string;

  // Auto Scaling & Limits
  autoScaling?: {
    enabled: boolean;
    minReplicas: number;
    maxReplicas: number;
    targetCpuPercent: number;
    metric?: 'cpu' | 'memory' | 'both';
    targetMemoryPercent?: number;
    scaleDownCpuPercent?: number;
    cooldownSeconds?: number;
  };

  // Meta
  createdAt: string;
  updatedAt: string;
}

export interface CreateServiceInput {
  projectId: string;
  name: string;
  slug?: string;
  type: ServiceType;
  nodeId: string;
  repository?: string;
  branch?: string;
  dockerfile?: string;
  buildCommand?: string;
  composeFile?: string;
  image?: string;
  databaseType?: 'postgresql' | 'mysql' | 'redis' | 'mongodb';
  databaseVersion?: string;
  connectionString?: string;
  ports?: number[];
  publishToHost?: boolean;
  limits?: Partial<ResourceLimit>;
  autoRollbackEnabled?: boolean;
  maintenanceMode?: boolean;
  healthCheckPath?: string;
  healthCheckPort?: number;
  healthCheckInterval?: number;
  healthCheckTimeout?: number;
  healthCheckRetries?: number;
  healthCheckInitialDelay?: number;
  registryId?: string;
  autoScaling?: {
    enabled: boolean;
    minReplicas: number;
    maxReplicas: number;
    targetCpuPercent: number;
    metric?: 'cpu' | 'memory' | 'both';
    targetMemoryPercent?: number;
    scaleDownCpuPercent?: number;
    cooldownSeconds?: number;
  };
}

export interface UpdateServiceInput {
  name?: string;
  repository?: string;
  branch?: string;
  commitHash?: string;
  dockerfile?: string;
  buildCommand?: string;
  composeFile?: string;
  image?: string;
  publishToHost?: boolean;
  autoRollbackEnabled?: boolean;
  maintenanceMode?: boolean;
  healthCheckPath?: string;
  healthCheckPort?: number;
  healthCheckInterval?: number;
  healthCheckTimeout?: number;
  healthCheckRetries?: number;
  healthCheckInitialDelay?: number;
  registryId?: string;
  limits?: Partial<ResourceLimit>;
  replicas?: number;
  autoScaling?: {
    enabled: boolean;
    minReplicas: number;
    maxReplicas: number;
    targetCpuPercent: number;
    metric?: 'cpu' | 'memory' | 'both';
    targetMemoryPercent?: number;
    scaleDownCpuPercent?: number;
    cooldownSeconds?: number;
  };
}

export interface BackupItem {
  id: string;
  name: string;
  sizeMb: number;
  status: 'completed' | 'in_progress' | 'failed';
  createdAt: string;
}

