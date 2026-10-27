import type {
  ApiAuditLog,
  ApiDeployment,
  ApiDomain,
  ApiNode,
  ApiProject,
  ApiService,
  ApiSnapshot,
  ApiUser,
  ApiRegistry,
} from "@/lib/api"
import { getGeoIpSync, isPrivateIp, resolveGeoIp } from "@/lib/geoip"
import type {
  AuditCategory,
  AuditLogEntry,
  ClusterNode,
  ClusterSnapshot,
  DeploymentLogEntry,
  DeploymentPipelineStep,
  DeploymentRecord,
  DockerRegistryConfig,
  NodeStatus,
  PlatformUser,
  Project,
  ProjectEnvironment,
  ProjectService,
  ServiceDomain,
  ServiceStatus,
  ServiceType,
} from "@/types/platform"

export function formatRelativeTime(value?: string | null): string {
  if (!value) return "Never"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "Unknown"

  const diffSeconds = Math.round((date.getTime() - Date.now()) / 1000)
  const abs = Math.abs(diffSeconds)
  if (abs < 10) return "Just now"
  if (abs < 60) return `${abs}s ago`
  if (abs < 3600) return `${Math.round(abs / 60)}m ago`
  if (abs < 86400) return `${Math.round(abs / 3600)}h ago`
  return `${Math.round(abs / 86400)}d ago`
}

export function formatDuration(durationMs?: number): string {
  if (!durationMs || durationMs <= 0) return "-"
  if (durationMs < 1000) return `${durationMs}ms`
  const seconds = durationMs / 1000
  if (seconds < 60) return `${seconds.toFixed(1)}s`
  const minutes = Math.floor(seconds / 60)
  const rest = Math.round(seconds % 60)
  return `${minutes}m ${rest}s`
}

export function formatDateTime(value?: string | null): string {
  if (!value) return "-"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "-"
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export function formatCommitHash(hash?: string | null, length = 7): string {
  if (!hash) return "untracked"
  const clean = hash.trim()
  if (clean.length <= length) return clean
  return clean.slice(0, length)
}

function normalizeNodeStatus(status: string): NodeStatus {
  if (status === "online") return "online"
  if (status === "degraded") return "degraded"
  return "offline"
}

export function formatNodeLocation(location?: {
  name?: string
  city?: string
  country?: string
}): { display: string; country: string } {
  if (!location) return { display: "Edge Host", country: "Global" }

  const rawCountry = location.country?.trim() || ""
  const rawCity = location.city?.trim() || ""
  const rawName = location.name?.trim() || ""

  if (rawCity && rawCountry) {
    return {
      display: rawCity,
      country: rawCountry,
    }
  }

  if (rawName.includes(",")) {
    const parts = rawName.split(",").map((s) => s.trim())
    const cityPart = parts[0]
    const countryPart = parts[1] || parts[0]
    return {
      display: cityPart,
      country: countryPart,
    }
  }

  return {
    display: rawCity || rawName || rawCountry || "Edge Host",
    country: rawCountry || rawName || "Global",
  }
}

export function adaptNode(node: ApiNode): ClusterNode {
  const totalMemoryMb = node.memoryTotalMb || 0
  const memoryUsedMb = node.usage?.memoryUsedMb || 0
  const diskTotalGb = node.usage?.diskTotalGb || node.diskTotalGb || 0
  const diskUsedGb = node.usage?.diskUsedGb || 0
  const memoryPercent =
    totalMemoryMb > 0 ? Math.min(100, (memoryUsedMb / totalMemoryMb) * 100) : 0
  const diskPercent =
    diskTotalGb > 0 ? Math.min(100, (diskUsedGb / diskTotalGb) * 100) : 0

  const targetIp = (node.publicIp || node.ipAddress || "").trim()
  const geo = getGeoIpSync(targetIp)

  if (!geo && !isPrivateIp(targetIp)) {
    void resolveGeoIp(targetIp)
  }

  const location = geo
    ? {
        code: geo.code,
        name:
          geo.city && geo.city.trim() !== ""
            ? geo.city
            : geo.country,
        flag: geo.flag,
        city: geo.city,
        country: geo.country,
        lat: geo.lat,
        lng: geo.lng,
      }
    : isPrivateIp(targetIp)
      ? {
          code: "LOCAL",
          name: "Local Network",
          flag: "/images/flags/UN.png",
          country: "Local Network",
        }
      : {
          code: "GLOBAL",
          name: node.name || "Edge Host",
          flag: "/images/flags/UN.png",
          country: "Global",
        }

  return {
    id: node.id,
    name: node.name,
    role:
      node.role === "leader" || node.role === "master" ? "master" : "worker",
    status: normalizeNodeStatus(node.status),
    ipAddress: node.ipAddress,
    publicIp: node.publicIp || undefined,
    dockerVersion: node.dockerVersion || "unknown",
    agentVersion: node.agentVersion || "v1.0.0",
    os: node.os || "unknown",
    kernelVersion: node.kernelVersion || undefined,
    agentConnected: Boolean(node.agentConnected),
    cpuPercent: Math.round((node.usage?.cpuPercent || 0) * 10) / 10,
    memoryPercent: Math.round(memoryPercent * 10) / 10,
    diskPercent: Math.round(diskPercent * 10) / 10,
    totalCores: node.cpuTotalCores || 0,
    totalMemoryGb: Math.round((totalMemoryMb / 1024) * 10) / 10,
    diskTotalGb: Math.round(diskTotalGb * 10) / 10,
    runningContainers: node.servicesCount || 0,
    servicesCount: node.servicesCount || 0,
    uptime: node.uptime || "—",
    lastHeartbeat: formatRelativeTime(node.lastHeartbeat),
    lastHeartbeatAt: node.lastHeartbeat,
    location,
    grpcLatencyMs: 4,
    grpcVersion: "1.62.0",
  }
}

export function adaptProject(project: ApiProject): Project {
  const environments: ProjectEnvironment[] = [
    "production",
    "staging",
    "preview",
  ]
  const environment = environments.includes(
    project.environment as ProjectEnvironment
  )
    ? (project.environment as ProjectEnvironment)
    : "production"

  return {
    id: project.id,
    name: project.name,
    slug: project.slug,
    description: project.description,
    environment,
    servicesCount: project.servicesCount,
    healthyServicesCount: project.healthyServicesCount,
    targetNodeIds: [],
    updatedAt: formatRelativeTime(project.updatedAt),
    createdAt: project.createdAt,
  }
}

function normalizeServiceType(type: string): ServiceType {
  return type === "docker-compose" || type === "compose"
    ? "docker-compose"
    : "dockerfile"
}

function normalizeServiceStatus(status: string): ServiceStatus {
  switch (status) {
    case "healthy":
    case "live":
    case "running":
      return "running"
    case "queued":
    case "building":
    case "deploying":
      return "deploying"
    case "failed":
    case "error":
    case "unhealthy":
      return "failed"
    default:
      return "stopped"
  }
}

function normalizeDeploymentStatus(status: string): DeploymentRecord["status"] {
  switch (status) {
    case "live":
    case "healthy":
    case "success":
      return "success"
    case "failed":
    case "error":
    case "failed_rolled_back":
      return "failed"
    case "rolled_back":
      return "rolled_back"
    case "queued":
    case "building":
    case "deploying":
      return "building"
    default:
      return "pending"
  }
}

function adaptSteps(deployment: ApiDeployment): DeploymentPipelineStep[] {
  let raw = deployment.steps
  if (typeof raw === "string") {
    try {
      raw = JSON.parse(raw)
    } catch {
      raw = []
    }
  }
  const steps = Array.isArray(raw) ? raw : []
  return steps.map((step) => {
    const s = step as any
    const durationMs = s.durationMs ?? s.duration_ms
    return {
      name: (s.name ?? "Log") as DeploymentPipelineStep["name"],
      status:
        s.status === "success"
          ? "success"
          : s.status === "failed"
            ? "failed"
            : s.status === "skipped"
              ? "skipped"
              : "running",
      startedAt: s.startedAt ?? s.started_at,
      finishedAt: s.finishedAt ?? s.finished_at,
      durationMs,
      duration: formatDuration(durationMs),
      description: s.logs?.length ? s.logs[s.logs.length - 1] : undefined,
    }
  })
}

export function adaptDeployment(deployment: ApiDeployment): DeploymentRecord {
  const d = deployment as any
  const durationMs = d.durationMs ?? d.duration_ms ?? 0
  const startedAt = d.startedAt ?? d.started_at
  const commitHash = d.commitHash ?? d.commit_hash ?? "untracked"
  const commitMessage =
    d.commitMessage ?? d.commit_message ?? "No commit message recorded"

  return {
    id: d.id,
    serviceId: d.serviceId ?? d.service_id ?? "",
    status: normalizeDeploymentStatus(d.status),
    triggerBy: d.author || "system",
    commitHash,
    duration: formatDuration(durationMs),
    startedAt: formatRelativeTime(startedAt),
    message: commitMessage,
    branch: d.branch,
    author: d.author,
    isRollback: d.status === "rolled_back",
    previewUrl: d.url || undefined,
    steps: adaptSteps(deployment),
  }
}

function emptyDeployment(serviceId: string): DeploymentRecord {
  return {
    id: "",
    serviceId,
    status: "pending",
    triggerBy: "-",
    commitHash: "untracked",
    duration: "-",
    startedAt: "-",
    message: "No deployment has run for this service yet.",
    steps: [],
  }
}

export function adaptDomain(
  domain: ApiDomain,
  serviceSlug: string
): ServiceDomain {
  return {
    id: domain.id,
    domain: domain.domain,
    path: domain.path || "/",
    internalPath: domain.internalPath || "/",
    entryPoint: domain.ssl ? "websecure" : "web",
    https: domain.ssl,
    sslStatus: domain.ssl ? "active" : "pending",
    targetContainer: `tako-app-${serviceSlug}`,
    targetPort: domain.port,
    targetProtocol: "tcp",
    isPrimary: domain.primary,
    createdAt: domain.createdAt,
  }
}

export function adaptService(service: ApiService): ProjectService {
  const type = normalizeServiceType(service.type)
  const ports = service.ports?.length ? service.ports : []
  const domainDetails = service.domainDetails?.length
    ? service.domainDetails.map((domain) => adaptDomain(domain, service.slug))
    : (service.domains || []).map((domain, index) => ({
        id: `${service.id}-domain-${index}`,
        domain,
        path: "/",
        internalPath: "/",
        entryPoint: "websecure",
        https: true,
        sslStatus: "active" as const,
        targetContainer: `tako-app-${service.slug}`,
        targetPort: ports[0] || 80,
        targetProtocol: "tcp" as const,
        isPrimary: index === 0,
      }))

  const usage = service.usage
  const memoryLimitMb = service.limits?.memoryMb || usage?.memoryLimitMb || 0

  return {
    id: service.id,
    projectId: service.projectId,
    name: service.name,
    slug: service.slug,
    description: service.repository
      ? service.repository
      : service.image
        ? `Image ${service.image}`
        : "",
    type,
    status: normalizeServiceStatus(service.status),
    targetNodeId: service.nodeId,
    targetNodeName: service.nodeName,
    portMappings: ports.map((port) => ({
      host: service.publishToHost ? port : 0,
      container: port,
      protocol: "tcp",
    })),
    publishToHost: service.publishToHost,
    envVars: (service.envVars || []).map((item) => ({
      key: item.key,
      value: item.value,
      isSecret: item.isSecret,
    })),
    dockerfileContent: service.dockerfile || "",
    composeContent: service.composeFile || "",
    image: service.image || undefined,
    gitRepo: service.repository || "",
    gitBranch: service.branch || "",
    commitHash: service.commitHash || undefined,
    lastDeployment: service.lastDeployment
      ? adaptDeployment(service.lastDeployment)
      : emptyDeployment(service.id),
    metrics: {
      cpuPercent: Math.round((usage?.cpuPercent || 0) * 10) / 10,
      memoryMb: usage?.memoryUsedMb || 0,
      memoryLimitMb,
      networkRxMb: Number(((usage?.networkRxKbps || 0) / 1024).toFixed(2)),
      networkTxMb: Number(((usage?.networkTxKbps || 0) / 1024).toFixed(2)),
    },
    restartPolicy: "unless-stopped",
    domains: domainDetails,
    resourceSpecs: {
      cpuReservation: 0,
      cpuLimit: service.limits?.cpuCores || 0,
      memoryReservationMb: 0,
      memoryLimitMb,
      replicas: service.replicas || 1,
      swapMb: service.limits?.swapMb || 0,
    },
    healthCheck: {
      enabled: Boolean(service.healthCheckPath),
      path: service.healthCheckPath || "",
      port: service.healthCheckPort || ports[0] || 0,
      intervalSec: service.healthCheckInterval || 0,
      timeoutSec: service.healthCheckTimeout || 0,
      retries: service.healthCheckRetries || 0,
    },
    deploymentHistory: service.lastDeployment
      ? [adaptDeployment(service.lastDeployment)]
      : [],
    maintenanceMode: service.maintenanceMode,
    autoRollbackEnabled: service.autoRollbackEnabled,
    autoScaling: service.autoScaling,
    createdAt: service.createdAt,
    updatedAt: service.updatedAt,
  }
}

export function adaptDeploymentLog(
  payload: Record<string, unknown>
): DeploymentLogEntry {
  const message = typeof payload.message === "string" ? payload.message : ""
  const isError = payload.is_error === true || payload.status === "failed"
  const step = typeof payload.step === "string" ? payload.step : "Log"
  return {
    id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    timestamp: new Date().toLocaleTimeString(),
    level: isError ? "error" : step === "Live" ? "success" : "info",
    step,
    message: message.trim(),
  }
}

function auditCategory(targetType: string, action: string): AuditCategory {
  const value = `${targetType} ${action}`.toLowerCase()
  if (value.includes("deploy") || value.includes("service")) {
    return "deployment"
  }
  if (value.includes("node") || value.includes("agent")) return "node"
  if (value.includes("project")) return "project"
  if (
    value.includes("user") ||
    value.includes("auth") ||
    value.includes("passkey") ||
    value.includes("session") ||
    value.includes("password")
  ) {
    return "security"
  }
  return "config"
}

export function adaptAuditLog(log: ApiAuditLog): AuditLogEntry {
  const metadata = log.metadata || {}
  const details =
    Object.keys(metadata).length > 0
      ? Object.entries(metadata)
          .map(([key, value]) => `${key}: ${String(value)}`)
          .join(", ")
      : log.targetType
        ? `${log.targetType} ${log.targetId || log.targetName || ""}`.trim()
        : "No additional metadata"

  const actorName = log.actor.name || log.actor.email || "system"
  const actorType = actorName.toLowerCase().includes("agent")
    ? "agent"
    : log.actor.id
      ? "user"
      : "system"

  return {
    id: log.id,
    timestamp: log.timestamp,
    action: log.action,
    category: auditCategory(log.targetType, log.action),
    actor: { name: actorName, type: actorType },
    target: log.targetName || log.targetId || log.targetType || "—",
    details,
    status: /fail|error|denied/i.test(log.action) ? "failure" : "success",
  }
}

export function adaptUser(user: ApiUser): PlatformUser {
  const role =
    user.role === "owner" || user.role === "admin" || user.role === "member"
      ? user.role
      : "member"
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role,
    avatarUrl: user.avatarUrl,
    twoFactorEnabled: Boolean(user.twoFactorEnabled),
    createdAt: user.createdAt,
  }
}

export function adaptRegistry(registry: ApiRegistry): DockerRegistryConfig {
  return {
    id: registry.id,
    name: registry.name,
    serverUrl: registry.serverUrl,
    username: registry.username,
    password: registry.password,
    createdAt: registry.createdAt,
  }
}

export function adaptSnapshot(snapshot: ApiSnapshot): ClusterSnapshot {
  return {
    id: snapshot.id,
    filename: snapshot.filename,
    sizeMb: snapshot.sizeMb,
    checksum: snapshot.checksum,
    status:
      snapshot.status === "completed"
        ? "completed"
        : snapshot.status === "failed"
          ? "failed"
          : "in_progress",
    createdAt: formatRelativeTime(snapshot.createdAt),
  }
}
