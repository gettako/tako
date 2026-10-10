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
  traefikFile: (nodeId: string, filename: string) => [...nodeKeys.detail(nodeId), 'traefik', 'file', filename] as const,
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
  domain: () => [...settingsKeys.all, 'domain'] as const,
  s3Buckets: () => [...settingsKeys.all, 's3_buckets'] as const,
  gitProviders: () => ['git-providers'] as const,
  syncedRepos: () => ['synced-repos'] as const,
  githubApp: () => ['github-app'] as const,
};

export const userKeys = {
  all: ['users'] as const,
  lists: () => [...userKeys.all, 'list'] as const,
  current: () => ['current-user'] as const,
  invites: () => [...userKeys.all, 'invites'] as const,
};

export const profileKeys = {
  all: ['profile'] as const,
  sessions: () => [...profileKeys.all, 'sessions'] as const,
  passkeys: () => [...profileKeys.all, 'passkeys'] as const,
  twoFactorSetup: () => [...profileKeys.all, '2fa'] as const,
};

export const cronKeys = {
  all: ['crons'] as const,
  lists: (serviceId: string) => [...cronKeys.all, 'list', serviceId] as const,
  runs: (cronId: string) => [...cronKeys.all, 'runs', cronId] as const,
};

export const webhookKeys = {
  all: ['webhooks'] as const,
  byService: (serviceId: string) => [...webhookKeys.all, 'service', serviceId] as const,
  deliveries: (serviceId: string) => [...webhookKeys.all, 'deliveries', serviceId] as const,
};

export const backupKeys = {
  all: ['backups'] as const,
  lists: (serviceId?: string) => [...backupKeys.all, 'list', serviceId || 'all'] as const,
  schedule: () => [...backupKeys.all, 'schedule'] as const,
};

export const notificationKeys = {
  all: ['notifications'] as const,
  list: () => [...notificationKeys.all, 'list'] as const,
  settings: () => [...notificationKeys.all, 'settings'] as const,
};

export const auditKeys = {
  all: ['audit-logs'] as const,
  list: (params?: Record<string, any>) => [...auditKeys.all, 'list', params || {}] as const,
};
