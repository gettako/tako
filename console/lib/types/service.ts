import { Status, ResourceLimit, ResourceUsage, EnvVar } from './common';

export type ServiceType = 'app' | 'compose' | 'database';

export interface ServiceDomain {
  id: string;
  domain: string;
  ssl: boolean;
  primary: boolean;
  port?: number;
  path?: string;
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
  replicas: number;
  
  // Resources & Config
  limits: ResourceLimit;
  usage: ResourceUsage;
  envVars: EnvVar[];
  
  // Meta
  createdAt: string;
  updatedAt: string;
}

export interface CreateServiceInput {
  projectId: string;
  name: string;
  type: ServiceType;
  nodeId: string;
  repository?: string;
  branch?: string;
  dockerfile?: string;
  buildCommand?: string;
  composeFile?: string;
  image?: string;
  databaseType?: 'postgresql' | 'mysql' | 'redis' | 'mongodb';
  ports?: number[];
  limits?: Partial<ResourceLimit>;
}

export interface UpdateServiceInput {
  name?: string;
  repository?: string;
  branch?: string;
  dockerfile?: string;
  buildCommand?: string;
  composeFile?: string;
  image?: string;
  limits?: Partial<ResourceLimit>;
  replicas?: number;
}
