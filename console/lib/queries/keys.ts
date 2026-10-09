/**
 * Type-safe, centralized Query Key Factory for TanStack Query.
 * Prevents key collision, cache drift, and redundant memory retention in QueryClient.
 */

export const projectKeys = {
  all: ['projects'] as const,
  lists: () => [...projectKeys.all, 'list'] as const,
  detail: (id: string) => [...projectKeys.all, 'detail', id] as const,
};

export const serviceKeys = {
  all: ['services'] as const,
  lists: (projectId?: string) =>
    projectId
      ? ([...serviceKeys.all, 'list', { projectId }] as const)
      : ([...serviceKeys.all, 'list'] as const),
  detail: (id: string) => [...serviceKeys.all, 'detail', id] as const,
  domains: (serviceId: string) => [...serviceKeys.detail(serviceId), 'domains'] as const,
  envVars: (serviceId: string) => [...serviceKeys.detail(serviceId), 'env'] as const,
  metrics: (serviceId: string, range?: string) =>
    [...serviceKeys.detail(serviceId), 'metrics', range || '1h'] as const,
  containerLogs: (serviceId: string, containerName?: string) =>
    [...serviceKeys.detail(serviceId), 'logs', containerName || 'default'] as const,
};

export const nodeKeys = {
  all: ['nodes'] as const,
  lists: () => [...nodeKeys.all, 'list'] as const,
  detail: (id: string) => [...nodeKeys.all, 'detail', id] as const,
  traefik: (nodeId: string) => [...nodeKeys.detail(nodeId), 'traefik'] as const,
  traefikFiles: (nodeId: string) => [...nodeKeys.detail(nodeId), 'traefik', 'files'] as const,
};

export const deploymentKeys = {
  all: ['deployments'] as const,
  lists: (serviceId?: string) =>
    serviceId
      ? ([...deploymentKeys.all, 'list', { serviceId }] as const)
      : ([...deploymentKeys.all, 'list'] as const),
  detail: (id: string) => [...deploymentKeys.all, 'detail', id] as const,
};

export const metricKeys = {
  all: ['metrics'] as const,
  cluster: (range: string) => [...metricKeys.all, 'cluster', range] as const,
  node: (nodeId: string, range: string) => [...metricKeys.all, 'node', nodeId, range] as const,
  service: (serviceId: string, range: string) => [...metricKeys.all, 'service', serviceId, range] as const,
};

export const settingsKeys = {
  all: ['settings'] as const,
  item: (key: string) => [...settingsKeys.all, key] as const,
  s3Buckets: () => [...settingsKeys.all, 's3_buckets'] as const,
  gitProviders: () => ['git-providers'] as const,
  syncedRepos: () => ['synced-repos'] as const,
  githubApp: () => ['github-app'] as const,
};

export const auditKeys = {
  all: ['audit-logs'] as const,
  list: (params?: Record<string, any>) => [...auditKeys.all, 'list', params || {}] as const,
};
