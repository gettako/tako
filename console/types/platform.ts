export type NodeStatus = "online" | "degraded" | "offline"
export type NodeRole = "master" | "worker"

export interface ClusterNode {
  id: string
  name: string
  role: NodeRole
  status: NodeStatus
  ipAddress: string
  publicIp?: string
  location: {
    code: string
    name: string
    flag: string
    city?: string
    country?: string
    lat?: number
    lng?: number
  }
  grpcLatencyMs: number
  grpcVersion?: string
  agentVersion?: string
  dockerVersion: string
  os: string
  kernelVersion?: string
  agentConnected: boolean
  cpuPercent: number
  memoryPercent: number
  diskPercent: number
  totalCores: number
  totalMemoryGb: number
  diskTotalGb: number
  runningContainers: number
  servicesCount: number
  networkRxKbps?: number
  networkTxKbps?: number
  uptime: string
  lastHeartbeat: string
  lastHeartbeatAt?: string
}

export type ProjectEnvironment = "production" | "staging" | "preview"

export interface Project {
  id: string
  name: string
  slug: string
  description: string
  environment: ProjectEnvironment
  servicesCount: number
  healthyServicesCount: number
  targetNodeIds?: string[]
  updatedAt: string
  createdAt: string
}

export type ServiceType = "dockerfile" | "docker-compose"
export type ServiceStatus = "running" | "deploying" | "stopped" | "failed"

export interface PortMapping {
  host: number
  container: number
  protocol: "tcp" | "udp"
}

export interface ServiceContainerPort {
  port: number
  protocol: "tcp" | "udp"
  name?: string
}

export interface ServiceContainer {
  name: string
  isMain?: boolean
  ports: ServiceContainerPort[]
}

export interface EnvVariable {
  key: string
  value: string
  isSecret?: boolean
}

export type DeploymentStepName =
  | "Queued"
  | "Clone"
  | "Build"
  | "Push/Load image"
  | "Deploy"
  | "Health check"
  | "Live"

export type DeploymentStepStatus =
  | "pending"
  | "running"
  | "success"
  | "failed"
  | "skipped"

export interface DeploymentPipelineStep {
  name: DeploymentStepName
  status: DeploymentStepStatus
  startedAt?: string
  finishedAt?: string
  durationMs?: number
  duration?: string
  description?: string
}

export interface DeploymentRecord {
  id: string
  serviceId: string
  status: "success" | "failed" | "building" | "rolled_back" | "pending"
  triggerBy: string
  commitHash: string
  duration: string
  startedAt: string
  message: string
  branch?: string
  author?: string
  isRollback?: boolean
  previewUrl?: string
  steps?: DeploymentPipelineStep[]
}

export interface ServiceDomain {
  id: string
  domain: string
  path?: string
  internalPath?: string
  entryPoint?: string
  https?: boolean
  sslStatus: "active" | "issuing" | "pending"
  targetContainer?: string
  targetPort: number
  targetProtocol?: "tcp" | "udp"
  isPrimary?: boolean
  createdAt?: string
}

export interface ServiceResourceSpecs {
  cpuReservation: number
  cpuLimit: number
  memoryReservationMb: number
  memoryLimitMb: number
  replicas: number
  oomPolicy?: "kill" | "throttle"
  swapMb?: number
}

export interface ServiceHealthCheck {
  enabled: boolean
  path: string
  port: number
  intervalSec: number
  timeoutSec: number
  retries: number
}

export interface ServiceMetrics {
  cpuPercent: number
  memoryMb: number
  memoryLimitMb: number
  networkRxMb: number
  networkTxMb: number
}

export interface ProjectService {
  id: string
  projectId: string
  name: string
  slug: string
  description: string
  type: ServiceType
  status: ServiceStatus
  targetNodeId: string
  targetNodeName?: string
  portMappings: PortMapping[]
  publishToHost: boolean
  containers?: ServiceContainer[]
  envVars: EnvVariable[]
  dockerfileContent: string
  composeContent: string
  image?: string
  gitRepo: string
  gitBranch: string
  commitHash?: string
  lastDeployment: DeploymentRecord
  metrics: ServiceMetrics
  restartPolicy: "always" | "on-failure" | "unless-stopped"
  domains?: ServiceDomain[]
  resourceSpecs?: ServiceResourceSpecs
  healthCheck?: ServiceHealthCheck
  deploymentHistory?: DeploymentRecord[]
  maintenanceMode?: boolean
  autoRollbackEnabled?: boolean
  autoScaling?: {
    enabled: boolean
    minReplicas: number
    maxReplicas: number
    targetCpuPercent: number
    metric: string
    targetMemoryPercent: number
    scaleDownCpuPercent: number
    cooldownSeconds: number
  }
  createdAt?: string
  updatedAt?: string
}

export interface DeploymentLogEntry {
  id: string
  timestamp: string
  level: "info" | "warn" | "error" | "success"
  step: string
  message: string
}

export interface PlatformSettings {
  masterGrpcHost: string
  masterGrpcPort: number
  clusterToken: string
  telemetryIntervalSec: number
  dockerHubUsername: string
  notificationsEnabled: boolean
  webhookUrl: string
  // Extended configuration
  organizationName?: string
  clusterRegion?: string
  timezone?: string
  maintenanceWindow?: string
  slackWebhookUrl?: string
  emailAlertsEnabled?: boolean
  alertEmail?: string
  notifyOnOutage?: boolean
  notifyOnDeployFail?: boolean
  githubConnected?: boolean
  githubRepo?: string
  githubAppId?: string
  githubAutoDeploy?: boolean
  githubWebhookSecret?: string
  s3Enabled?: boolean
  s3Buckets?: S3BucketConfig[]
  s3Endpoint?: string
  s3Bucket?: string
  s3Region?: string
  s3AccessKey?: string
  s3SecretKey?: string
  s3ForcePathStyle?: boolean
  s3RetentionDays?: number
  backupIntervalHours?: number
  backupRetentionCount?: number
  ipAllowlist?: string
  sessionTimeoutMinutes?: number
  // SMTP & Telegram
  smtpHost?: string
  smtpPort?: number
  smtpUser?: string
  smtpPassword?: string
  telegramEnabled?: boolean
  telegramBotToken?: string
  telegramChatId?: string
  notifyOnSecurityAlert?: boolean
  notifyOnBackupFailure?: boolean
  // Domain & Ingress
  clusterDomain?: string
  dnsProvider?: "http01" | "cloudflare"
  cloudflareApiToken?: string
  customDnsIp?: string
  // Backup schedule
  backupSchedule?: BackupScheduleConfig
}

export type S3BucketPurpose =
  | "artifacts"
  | "telemetry"
  | "cache"
  | "backups"
  | "general"

export interface S3BucketConfig {
  id: string
  name: string
  endpoint: string
  bucket: string
  region: string
  accessKey: string
  secretKey: string
  forcePathStyle: boolean
  retentionDays: number
  isDefault: boolean
  purpose: S3BucketPurpose
  status?: "connected" | "error" | "untested"
  lastTested?: string
}

export type UserRole = "owner" | "admin" | "member"

export interface PlatformUser {
  id: string
  name: string
  email: string
  role: UserRole
  avatarUrl?: string
  twoFactorEnabled: boolean
  createdAt: string
}

export interface CurrentUserProfile {
  id: string
  name: string
  handle: string
  email: string
  role: UserRole
  title: string
  bio: string
  timezone: string
  defaultLanding: "dashboard" | "nodes" | "projects" | "monitor"
  gpgKeyId?: string
  avatarUrl?: string
  twoFactorEnabled: boolean
  twoFactorMethod?: "totp" | "sms"
  createdAt: string
  lastLoginAt: string
}

export interface UserSession {
  id: string
  device: string
  browser: string
  ipAddress: string
  location: string
  lastActive: string
  isCurrent: boolean
}

export interface UserPasskey {
  id: string
  name: string
  credentialId: string
  createdAt: string
  lastUsedAt: string
  type: "touch_id" | "yubikey" | "security_key"
}

export interface PersonalAccessToken {
  id: string
  name: string
  prefix: string
  scopes: string[]
  createdAt: string
  expiresAt: string | null
  lastUsedAt: string
}

export interface PlatformUserInvite {
  id: string
  email: string
  role: UserRole
  token: string
  expiresAt: string
  createdAt: string
}

export interface DockerRegistryConfig {
  id: string
  name: string
  serverUrl: string
  username: string
  password?: string
  createdAt: string
}

export interface GitProviderConfig {
  id: string
  type: "github" | "gitlab" | "gitea"
  name: string
  username: string
  connected: boolean
  connectionType: "app" | "pat"
  avatarUrl?: string
  connectedAt: string
}

export interface SyncedGitRepo {
  id: string
  providerId: string
  name: string
  fullName: string
  defaultBranch: string
  isPrivate: boolean
  htmlUrl: string
  updatedAt: string
  autoDeploy: boolean
}

export interface BackupScheduleConfig {
  enabled: boolean
  frequency: "hourly" | "daily" | "weekly"
  timeUtc: string
  retentionDays: number
  destinationBucketId: string
  lastBackupAt?: string
  lastBackupStatus?: "success" | "failed"
}

export interface ClusterSnapshot {
  id: string
  filename: string
  sizeMb: number
  checksum: string
  status: "completed" | "failed" | "in_progress"
  createdAt: string
}

export interface ClusterDomainConfig {
  domain: string
  sslActive: boolean
  sslAutoRenew: boolean
  dnsProvider: "http01" | "cloudflare"
  cloudflareApiToken?: string
  customDnsIp?: string
  sslStatus: "active" | "pending_dns" | "pending_acme" | "error"
  sslIssuer?: string
  sslExpiresAt?: string
  dnsVerified: boolean
  lastCheckedAt?: string
}

export interface NodeContainer {
  id: string
  name: string
  serviceName: string
  image: string
  status: "running" | "restarting" | "stopped"
  created: string
  ports: string
  cpuPercent: number
  memoryMb: number
}

export type AuditCategory =
  | "deployment"
  | "node"
  | "project"
  | "security"
  | "config"

export interface AuditLogEntry {
  id: string
  timestamp: string
  action: string
  category: AuditCategory
  actor: {
    name: string
    type: "user" | "system" | "agent"
  }
  target: string
  details: string
  status: "success" | "failure"
}
