export type Status =
  | 'healthy'
  | 'unhealthy'
  | 'degraded'
  | 'deploying'
  | 'stopped'
  | 'queued';

export interface ResourceLimit {
  cpuCores: number;
  memoryMb: number;
  diskGb?: number;
  swapMb?: number;
}

export interface ResourceUsage {
  cpuPercent: number;
  memoryUsedMb: number;
  memoryLimitMb: number;
  diskUsedGb?: number;
  diskTotalGb?: number;
  networkRxKbps?: number;
  networkTxKbps?: number;
}

export interface PaginationParams {
  page: number;
  pageSize: number;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface EnvVar {
  id: string;
  key: string;
  value: string;
  isSecret: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  read: boolean;
  timestamp: string;
  link?: string;
}
