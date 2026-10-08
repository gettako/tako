import { Status } from './common';

export interface Project {
  id: string;
  name: string;
  slug: string;
  description?: string;
  status: Status;
  environment: 'production' | 'staging' | 'development';
  servicesCount: number;
  healthyServicesCount: number;
  createdAt: string;
  updatedAt: string;
  tags?: string[];
}

export interface CreateProjectInput {
  name: string;
  slug: string;
  description?: string;
  environment?: 'production' | 'staging' | 'development';
  tags?: string[];
}

export interface UpdateProjectInput {
  name?: string;
  slug?: string;
  description?: string;
  environment?: 'production' | 'staging' | 'development';
  tags?: string[];
}
