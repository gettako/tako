const API_BASE = "/api/v1"

export class ApiError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = "ApiError"
    this.status = status
  }
}

export interface ApiNodeUsage {
  cpuPercent: number
  memoryUsedMb: number
  memoryLimitMb: number
  diskUsedGb?: number
  diskTotalGb?: number
  networkRxKbps?: number
  networkTxKbps?: number
}

export interface ApiNode {
  id: string
  name: string
  ipAddress: string
  publicIp?: string
  role: "leader" | "worker" | string
  status: "online" | "offline" | "degraded" | string
  cpuTotalCores: number
  memoryTotalMb: number
  diskTotalGb: number
  usage: ApiNodeUsage
  servicesCount: number
  agentConnected: boolean
  dockerVersion: string
  os: string
  kernelVersion?: string
  uptime: string
  lastHeartbeat?: string
}

export interface ApiProject {
  id: string
  name: string
  slug: string
  description: string
  environment: string
  status: string
  tags: string[]
  createdAt: string
  updatedAt: string
  servicesCount: number
  healthyServicesCount: number
}

export interface ApiDeploymentStep {
  name: string
  status: string
  startedAt?: string
  finishedAt?: string
  durationMs?: number
  logs?: string[]
}

export interface ApiDeployment {
  id: string
  serviceId: string
  commitHash: string
  commitMessage: string
  branch: string
  author: string
  status: string
  url: string
  steps: ApiDeploymentStep[] | string
  logs?: string
  durationMs: number
  startedAt: string
  finishedAt?: string
  createdAt: string
}

export interface ApiDomain {
  id: string
  domain: string
  ssl: boolean
  primary: boolean
  port: number
  path: string
  internalPath?: string
  certificateType: string
  createdAt: string
}

export interface ApiServiceEnvVar {
  id: string
  key: string
  value: string
  isSecret: boolean
}

export interface ApiServiceLimits {
  cpuCores: number
  memoryMb: number
  swapMb: number
}

export interface ApiServiceUsage {
  cpuPercent: number
  memoryUsedMb: number
  memoryLimitMb: number
  networkRxKbps: number
  networkTxKbps: number
}

export interface ApiServiceAutoScaling {
  enabled: boolean
  minReplicas: number
  maxReplicas: number
  targetCpuPercent: number
  metric: string
  targetMemoryPercent: number
  scaleDownCpuPercent: number
  cooldownSeconds: number
}

export interface ApiService {
  id: string
  projectId: string
  nodeId: string
  nodeName?: string
  name: string
  slug: string
  type: string
  status: string
  repository?: string
  branch?: string
  commitHash?: string
  dockerfile?: string
  buildCommand?: string
  composeFile?: string
  image?: string
  databaseType?: string
  databaseVersion?: string
  connectionString?: string
  ports: number[]
  domains: string[]
  domainDetails?: ApiDomain[]
  publishToHost: boolean
  autoRollbackEnabled: boolean
  replicas: number
  limits: ApiServiceLimits
  usage?: ApiServiceUsage
  autoScaling?: ApiServiceAutoScaling
  envVars?: ApiServiceEnvVar[]
  lastDeployment?: ApiDeployment
  maintenanceMode: boolean
  healthCheckPath?: string
  healthCheckPort?: number
  healthCheckInterval?: number
  healthCheckTimeout?: number
  healthCheckRetries?: number
  healthCheckInitialDelay?: number
  registryId?: string
  createdAt: string
  updatedAt: string
}

export interface ApiAuditLog {
  id: string
  actor: {
    id: string
    name: string
    email: string
    avatarUrl?: string
  }
  action: string
  targetType: string
  targetId: string
  targetName: string
  metadata?: Record<string, unknown>
  ipAddress: string
  timestamp: string
}

export interface ApiUser {
  id: string
  name: string
  email: string
  role: string
  avatarUrl?: string
  twoFactorEnabled?: boolean
  createdAt: string
}

export interface ApiCurrentUser {
  id: string
  name: string
  email: string
  role: string
  avatarUrl?: string
  twoFactorEnabled: boolean
  createdAt?: string
}

export interface ApiRegistry {
  id: string
  name: string
  serverUrl: string
  username: string
  password: string
  createdAt: string
  updatedAt: string
}

export interface ApiSnapshot {
  id: string
  filename: string
  sizeBytes: number
  sizeMb: number
  checksum: string
  status: string
  createdAt: string
}

export interface ApiSession {
  id: string
  userId: string
  ipAddress: string
  userAgent: string
  device: string
  location: string
  current: boolean
  lastActive: string
}

export interface ApiPasskey {
  id: string
  name: string
  credentialId?: string
  createdAt: string
  lastUsedAt?: string
}

export interface ApiMetricPoint {
  timestamp: string
  cpu: number
  memory: number
  memoryPercent?: number
  networkRx: number
  networkTx: number
  disk: number
  diskPercent?: number
}

export interface ApiSystemVersion {
  currentVersion: string
  latestVersion: string
  updateAvailable: boolean
  releaseUrl: string
  releaseNotes: string
  checkedAt: string
}

export interface ApiCronJob {
  id: string
  serviceId: string
  name: string
  schedule: string
  command: string
  status: string
  lastRunAt?: string
  nextRunAt?: string
  lastStatus?: string
  createdAt: string
}

export interface ApiCronRun {
  id: string
  cronJobId: string
  startedAt: string
  finishedAt?: string
  durationMs: number
  status: string
  exitCode: number
  output: string
}

export interface ApiAccessLog {
  timestamp: string
  clientIp: string
  method: string
  path: string
  protocol: string
  statusCode: number
  durationMs: number
  routerName: string
  serviceName: string
  userAgent: string
  nodeId?: string
  nodeName?: string
  host?: string
}

export interface ApiErrorBody {
  error?: string
  message?: string
}

function errorMessage(status: number, body: unknown): string {
  if (body && typeof body === "object") {
    const candidate = body as ApiErrorBody
    if (candidate.error) return candidate.error
    if (candidate.message) return candidate.message
  }
  return `Request failed with status ${status}`
}

export function setAuthToken(token: string | null) {
  if (typeof window !== "undefined") {
    if (token) {
      localStorage.setItem("tako_token", token)
    } else {
      localStorage.removeItem("tako_token")
    }
  }
}

export function getAuthToken(): string | null {
  if (typeof window !== "undefined") {
    return localStorage.getItem("tako_token")
  }
  return null
}

export async function apiRequest<T>(
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const headers = new Headers(init.headers)
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json")
  }
  if (!headers.has("Authorization")) {
    const token = getAuthToken()
    if (token) {
      headers.set("Authorization", `Bearer ${token}`)
    }
  }

  let response: Response
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers,
      credentials: "same-origin",
      cache: "no-store",
    })
  } catch {
    throw new ApiError("Tako server is unreachable", 0)
  }

  if (!response.ok) {
    if (response.status === 401 && typeof window !== "undefined") {
      setAuthToken(null)
      window.dispatchEvent(new Event("tako:unauthorized"))
    }
    let body: unknown = null
    const contentType = response.headers.get("content-type") ?? ""
    try {
      body = contentType.includes("application/json")
        ? await response.json()
        : await response.text()
    } catch {
      body = null
    }
    throw new ApiError(errorMessage(response.status, body), response.status)
  }

  if (response.status === 204) {
    return undefined as T
  }

  const contentType = response.headers.get("content-type") ?? ""
  if (contentType.includes("application/json")) {
    return (await response.json()) as T
  }
  return (await response.text()) as T
}

export function apiGet<T>(path: string): Promise<T> {
  return apiRequest<T>(path, { method: "GET" })
}

export function apiPost<T>(path: string, body?: unknown): Promise<T> {
  return apiRequest<T>(path, {
    method: "POST",
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}

export function apiPut<T>(path: string, body?: unknown): Promise<T> {
  return apiRequest<T>(path, {
    method: "PUT",
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}

export function apiPatch<T>(path: string, body?: unknown): Promise<T> {
  return apiRequest<T>(path, {
    method: "PATCH",
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}

export function apiDelete<T>(path: string): Promise<T> {
  return apiRequest<T>(path, { method: "DELETE" })
}

export interface SseHandlers {
  onEvent?: (event: string, data: unknown) => void
  onError?: () => void
}

/**
 * Subscribes to a same-origin SSE endpoint. EventSource automatically
 * reconnects with the server-provided retry interval.
 */
export function subscribeSse(path: string, handlers: SseHandlers = {}) {
  if (typeof window === "undefined") {
    return () => {}
  }

  const source = new EventSource(`${API_BASE}${path}`, {
    withCredentials: true,
  })

  const handleMessage = (event: MessageEvent<string>) => {
    let parsed: unknown = event.data
    try {
      parsed = JSON.parse(event.data)
    } catch {
      // Keep the raw text for non-JSON payloads.
    }
    handlers.onEvent?.(event.type || "message", parsed)
  }

  const events = [
    "snapshot",
    "ready",
    "services",
    "node.status_changed",
    "node.metrics",
  ]
  for (const name of events) {
    source.addEventListener(name, handleMessage as EventListener)
  }
  source.onmessage = handleMessage
  source.onerror = () => {
    handlers.onError?.()
  }

  return () => source.close()
}
