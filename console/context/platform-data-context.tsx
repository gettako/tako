"use client"

import * as React from "react"

import {
  ApiError,
  DEFAULT_PORTS,
  STORAGE_KEYS,
  apiDelete,
  apiGet,
  apiPatch,
  apiPost,
  apiPut,
  setAuthToken,
  subscribeSse,
  type ApiAuditLog,
  type ApiCurrentUser,
  type ApiDeployment,
  type ApiNode,
  type ApiPasskey,
  type ApiProject,
  type ApiRegistry,
  type ApiService,
  type ApiSession,
  type ApiSnapshot,
  type ApiSystemVersion,
  type ApiUser,
} from "@/lib/api"
import {
  adaptAuditLog,
  adaptDeployment,
  adaptDeploymentLog,
  adaptNode,
  adaptProject,
  adaptRegistry,
  adaptService,
  adaptSnapshot,
  adaptUser,
} from "@/lib/adapters"
import type {
  AuditLogEntry,
  ClusterDomainConfig,
  ClusterNode,
  ClusterSnapshot,
  CurrentUserProfile,
  DeploymentLogEntry,
  DeploymentRecord,
  DockerRegistryConfig,
  GitProviderConfig,
  PlatformSettings,
  PlatformUser,
  PlatformUserInvite,
  Project,
  ProjectService,
  S3BucketConfig,
  S3BucketPurpose,
  SyncedGitRepo,
  UserPasskey,
  UserRole,
  UserSession,
} from "@/types/platform"

export type PlatformStatus =
  | "loading"
  | "authenticated"
  | "unauthenticated"
  | "error"

export type ViewMode = "grid" | "table"

export interface PlatformEvent {
  id: string
  timestamp: string
  nodeId: string
  nodeName: string
  type: "status" | "metrics"
  level: "info" | "success" | "warn"
  message: string
}

export interface CreateProjectInput {
  name: string
  slug: string
  description: string
  environment: string
}

export interface CreateServiceInput {
  projectId: string
  nodeId: string
  name: string
  slug: string
  type: string
  repository: string
  branch: string
  dockerfile: string
  image: string
  composeFile: string
  ports: number[]
  domains: string[]
  environmentVars: Record<string, string>
  publishToHost: boolean
  limits: { cpuCores: number; memoryMb: number }
  replicas: number
}

interface PlatformDataContextType {
  status: PlatformStatus
  error: string | null
  login: (email: string, password: string) => Promise<void>
  loginWithPasskey: (credentialId?: string) => Promise<void>
  logout: () => Promise<void>
  refresh: () => Promise<void>

  nodesViewMode: ViewMode
  setNodesViewMode: (mode: ViewMode) => void
  projectsViewMode: ViewMode
  setProjectsViewMode: (mode: ViewMode) => void
  servicesViewMode: ViewMode
  setServicesViewMode: (mode: ViewMode) => void

  nodes: ClusterNode[]
  projects: Project[]
  services: ProjectService[]
  auditLogs: AuditLogEntry[]
  platformEvents: PlatformEvent[]
  settings: PlatformSettings

  updateNode: (
    id: string,
    updates: { name?: string; ipAddress?: string; publicIp?: string }
  ) => Promise<void>
  deleteNode: (id: string) => Promise<void>
  generateEnrollToken: () => Promise<string>

  addProject: (project: CreateProjectInput) => Promise<Project>
  deleteProject: (id: string) => Promise<void>

  addService: (service: CreateServiceInput) => Promise<ProjectService>
  updateService: (
    id: string,
    updates: Record<string, unknown>
  ) => Promise<void>
  deleteService: (id: string) => Promise<void>

  triggerDeploy: (
    serviceId: string,
    options?: { clearCache?: boolean; simulateError?: boolean }
  ) => Promise<void>
  cancelDeploy: (serviceId?: string) => Promise<void>
  stopWatchingDeploy: () => void
  triggerRollback: (
    serviceId: string,
    targetDeployment: DeploymentRecord
  ) => Promise<void>
  activeDeployingId: string | null
  deploymentLogs: DeploymentLogEntry[]
  fetchServiceDeployments: (serviceId: string) => Promise<DeploymentRecord[]>
  fetchDeploymentLogs: (deploymentId: string) => Promise<DeploymentLogEntry[]>

  dataMode: "live" | "demo"
  setDataMode: (mode: boolean | "live" | "demo") => void
  toggleNodeStatus: (id: string) => Promise<void>
  resetToDefaults: () => Promise<void>
  connectGitProvider: (provider?: unknown) => Promise<void>

  addAuditLog: (entry: Omit<AuditLogEntry, "id" | "timestamp">) => Promise<void>
  updateSettings: (updates: Partial<PlatformSettings>) => Promise<void>

  users: PlatformUser[]
  invites: PlatformUserInvite[]
  addUserInvite: (
    email: string,
    role: UserRole,
    expiryDays: number
  ) => Promise<PlatformUserInvite>
  revokeUserInvite: (id: string) => Promise<void>
  updateUserRole: (id: string, role: UserRole) => Promise<void>
  deleteUser: (id: string) => Promise<void>

  registries: DockerRegistryConfig[]
  addDockerRegistry: (
    registry: Omit<DockerRegistryConfig, "id" | "createdAt">
  ) => Promise<void>
  deleteDockerRegistry: (id: string) => Promise<void>

  gitProviders: GitProviderConfig[]
  syncedRepos: SyncedGitRepo[]
  syncGitRepos: () => Promise<void>
  toggleRepoAutoDeploy: (id: string) => Promise<void>
  disconnectGitProvider: (id: string) => Promise<void>
  startGitHubAppSetup: (appName: string, owner: string) => Promise<void>
  completeGitHubAppSetup: (code: string) => Promise<void>

  snapshots: ClusterSnapshot[]
  createSnapshot: () => Promise<ClusterSnapshot>
  restoreSnapshot: (id: string) => Promise<void>
  updateBackupSchedule: (
    schedule: Partial<NonNullable<PlatformSettings["backupSchedule"]>>
  ) => Promise<void>

  domainConfig: ClusterDomainConfig
  updateDomainConfig: (
    updates: Partial<ClusterDomainConfig>
  ) => Promise<void>
  verifyDomain: (
    domain: string,
    expectedIp?: string
  ) => Promise<{ ok: boolean; message: string }>
  reloadTraefik: (nodeId?: string) => Promise<void>

  currentUser: CurrentUserProfile
  updateCurrentUser: (
    updates: Partial<CurrentUserProfile>
  ) => Promise<void>
  updatePassword: (
    currentPassword: string,
    newPassword: string
  ) => Promise<void>
  updateTwoFactor: (enabled: boolean) => Promise<void>
  sessions: UserSession[]
  revokeSession: (id: string) => Promise<void>
  revokeAllOtherSessions: () => Promise<void>
  passkeys: UserPasskey[]
  addPasskey: (name: string, credentialId?: string) => Promise<void>
  removePasskey: (id: string) => Promise<void>

  testS3Bucket: (
    bucket: Partial<S3BucketConfig>
  ) => Promise<{ ok: boolean; message: string; latencyMs?: number; error?: string }>
  testNotifications: (
    config?: Record<string, unknown>
  ) => Promise<{ ok: boolean; message: string; error?: string }>

  systemVersion: ApiSystemVersion | null
  refreshSystemVersion: () => Promise<void>
  checkSystemVersion: () => Promise<ApiSystemVersion | null>
  updateSystem: (target: string) => Promise<void>
}

const DEFAULT_SETTINGS: PlatformSettings = {
  masterGrpcHost: "",
  masterGrpcPort: DEFAULT_PORTS.GRPC,
  clusterToken: "",
  telemetryIntervalSec: 3,
  dockerHubUsername: "",
  notificationsEnabled: false,
  webhookUrl: "",
  emailAlertsEnabled: false,
  alertEmail: "",
  notifyOnOutage: true,
  notifyOnDeployFail: true,
  notifyOnSecurityAlert: true,
  notifyOnBackupFailure: true,
  githubConnected: false,
  githubAutoDeploy: false,
  s3Enabled: false,
  s3Buckets: [],
  s3RetentionDays: 30,
  backupIntervalHours: 24,
  backupRetentionCount: 14,
  telegramEnabled: false,
  smtpPort: DEFAULT_PORTS.SMTP,
  dnsProvider: "http01",
  backupSchedule: {
    enabled: false,
    frequency: "daily",
    timeUtc: "03:00",
    retentionDays: 14,
    destinationBucketId: "",
  },
}

const DEFAULT_DOMAIN_CONFIG: ClusterDomainConfig = {
  domain: "",
  sslActive: false,
  sslAutoRenew: true,
  dnsProvider: "http01",
  sslStatus: "pending_dns",
  dnsVerified: false,
}

const DEFAULT_USER: CurrentUserProfile = {
  id: "",
  name: "",
  handle: "",
  email: "",
  role: "member",
  title: "",
  bio: "",
  timezone: "UTC",
  defaultLanding: "dashboard",
  twoFactorEnabled: false,
  createdAt: "",
  lastLoginAt: "",
}

const PlatformDataContext = React.createContext<
  PlatformDataContextType | undefined
>(undefined)

function getSavedViewMode(
  key: string,
  defaultValue: ViewMode = "grid"
): ViewMode {
  if (typeof window === "undefined") return defaultValue
  try {
    const val = localStorage.getItem(key)
    if (val === "grid" || val === "table") return val
  } catch {
    // Ignore restricted storage
  }
  return defaultValue
}

function subscribeToStorage(callback: () => void) {
  if (typeof window === "undefined") return () => {}
  window.addEventListener("storage", callback)
  window.addEventListener("tako-viewmode-change", callback)
  return () => {
    window.removeEventListener("storage", callback)
    window.removeEventListener("tako-viewmode-change", callback)
  }
}

function usePersistentViewMode(
  key: string,
  defaultValue: ViewMode = "grid"
): [ViewMode, (mode: ViewMode) => void] {
  const getSnapshot = React.useCallback(
    () => getSavedViewMode(key, defaultValue),
    [key, defaultValue]
  )
  const getServerSnapshot = React.useCallback(
    () => defaultValue,
    [defaultValue]
  )
  const mode = React.useSyncExternalStore(
    subscribeToStorage,
    getSnapshot,
    getServerSnapshot
  )
  const setMode = React.useCallback(
    (newMode: ViewMode) => {
      try {
        localStorage.setItem(key, newMode)
        window.dispatchEvent(new Event("tako-viewmode-change"))
      } catch {
        // Fallback for sandboxed storage
      }
    },
    [key]
  )
  return [mode, setMode]
}

function mapCurrentUser(
  user: ApiCurrentUser,
  extra: Partial<CurrentUserProfile> = {}
): CurrentUserProfile {
  const cleanExtra = Object.fromEntries(
    Object.entries(extra).filter(([, value]) => value !== undefined && value !== "")
  ) as Partial<CurrentUserProfile>

  return {
    ...DEFAULT_USER,
    ...cleanExtra,
    id: user.id,
    name: user.name,
    handle: cleanExtra.handle || user.email.split("@")[0] || "",
    email: user.email,
    role:
      user.role === "owner" || user.role === "admin" || user.role === "member"
        ? user.role
        : "member",
    avatarUrl: user.avatarUrl,
    twoFactorEnabled: user.twoFactorEnabled,
    createdAt: user.createdAt || "",
    lastLoginAt: user.createdAt || "",
  }
}

function mapSettings(
  raw: Record<string, unknown>,
  extraProfile: Record<string, unknown>
): PlatformSettings {
  const stored =
    raw.platform_settings && typeof raw.platform_settings === "object"
      ? (raw.platform_settings as Partial<PlatformSettings>)
      : {}

  const domain = (raw.domain_settings || {}) as Record<string, unknown>
  const schedule = (raw.backup_schedule || {}) as Record<string, unknown>
  const buckets = Array.isArray(raw.s3_buckets)
    ? (raw.s3_buckets as Record<string, unknown>[])
    : []

  const settings: PlatformSettings = {
    ...DEFAULT_SETTINGS,
    ...stored,
    masterGrpcHost:
      (stored.masterGrpcHost as string) ||
      (extraProfile.masterGrpcHost as string) ||
      "",
    s3Buckets: buckets.map((bucket, index): S3BucketConfig => ({
      id: String(bucket.id || `bucket-${index}`),
      name: String(bucket.name || ""),
      endpoint: String(bucket.endpoint || ""),
      bucket: String(bucket.bucket || ""),
      region: String(bucket.region || ""),
      accessKey: String(bucket.accessKeyId || bucket.accessKey || ""),
      secretKey: String(bucket.secretAccessKey || bucket.secretKey || ""),
      forcePathStyle: Boolean(bucket.forcePathStyle),
      retentionDays: Number(bucket.retentionDays || 30),
      isDefault: Boolean(bucket.isDefault),
      purpose: (bucket.purpose as S3BucketPurpose) || "general",
      status: "connected",
    })),
    backupSchedule: {
      ...DEFAULT_SETTINGS.backupSchedule!,
      ...stored.backupSchedule,
      enabled:
        schedule.enabled !== undefined
          ? Boolean(schedule.enabled)
          : (stored.backupSchedule?.enabled ?? false),
      frequency:
        (schedule.frequency as "hourly" | "daily" | "weekly") ||
        stored.backupSchedule?.frequency ||
        "daily",
      retentionDays: Number(
        schedule.retentionDays ?? stored.backupSchedule?.retentionDays ?? 14
      ),
      lastBackupAt:
        (schedule.lastBackupAt as string) || stored.backupSchedule?.lastBackupAt,
      lastBackupStatus: schedule.lastBackupStatus as
        | "success"
        | "failed"
        | undefined,
    },
    notificationsEnabled:
      stored.notificationsEnabled ??
      Boolean(stored.webhookUrl || stored.telegramEnabled),
  }

  return {
    ...settings,
    clusterDomain: String(domain.domain || settings.clusterDomain || ""),
    dnsProvider:
      (domain.dnsProvider as "http01" | "cloudflare") ||
      settings.dnsProvider ||
      "http01",
    cloudflareApiToken: String(domain.cloudflareApiToken || ""),
    customDnsIp: String(domain.customDnsIp || ""),
  }
}

export function PlatformDataProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const [status, setStatus] = React.useState<PlatformStatus>("loading")
  const [error, setError] = React.useState<string | null>(null)

  const [nodesViewMode, setNodesViewMode] = usePersistentViewMode(
    STORAGE_KEYS.NODES_VIEW_MODE,
    "grid"
  )
  const [projectsViewMode, setProjectsViewMode] = usePersistentViewMode(
    STORAGE_KEYS.PROJECTS_VIEW_MODE,
    "grid"
  )
  const [servicesViewMode, setServicesViewMode] = usePersistentViewMode(
    STORAGE_KEYS.SERVICES_VIEW_MODE,
    "grid"
  )

  const [nodes, setNodes] = React.useState<ClusterNode[]>([])
  const [platformEvents] = React.useState<PlatformEvent[]>([])
  const [projects, setProjects] = React.useState<Project[]>([])
  const [services, setServices] = React.useState<ProjectService[]>([])
  const [auditLogs, setAuditLogs] = React.useState<AuditLogEntry[]>([])
  const [settings, setSettings] =
    React.useState<PlatformSettings>(DEFAULT_SETTINGS)
  const [domainConfig, setDomainConfig] =
    React.useState<ClusterDomainConfig>(DEFAULT_DOMAIN_CONFIG)
  const [users, setUsers] = React.useState<PlatformUser[]>([])
  const [invites, setInvites] = React.useState<PlatformUserInvite[]>([])
  const [registries, setRegistries] = React.useState<DockerRegistryConfig[]>([])
  const [snapshots, setSnapshots] = React.useState<ClusterSnapshot[]>([])
  const [sessions, setSessions] = React.useState<UserSession[]>([])
  const [passkeys, setPasskeys] = React.useState<UserPasskey[]>([])
  const [gitProviders, setGitProviders] = React.useState<GitProviderConfig[]>([])
  const [syncedRepos, setSyncedRepos] = React.useState<SyncedGitRepo[]>([])
  const [currentUser, setCurrentUser] =
    React.useState<CurrentUserProfile>(DEFAULT_USER)
  const [systemVersion, setSystemVersion] =
    React.useState<ApiSystemVersion | null>(null)

  const [activeDeployingId, setActiveDeployingId] = React.useState<
    string | null
  >(null)
  const [deploymentLogs, setDeploymentLogs] = React.useState<
    DeploymentLogEntry[]
  >([])
  const [dataMode, rawSetDataMode] = React.useState<"live" | "demo">("live")
  const setDataMode = React.useCallback((mode: boolean | "live" | "demo") => {
    if (typeof mode === "boolean") {
      rawSetDataMode(mode ? "demo" : "live")
    } else {
      rawSetDataMode(mode)
    }
  }, [])

  const toggleNodeStatus = React.useCallback(async (id: string) => {
    setNodes((prev) =>
      prev.map((n) =>
        n.id === id
          ? { ...n, status: n.status === "online" ? "offline" : "online" }
          : n
      )
    )
  }, [])

  const settingsRef = React.useRef(settings)
  const servicesRef = React.useRef(services)
  React.useEffect(() => {
    settingsRef.current = settings
  }, [settings])
  React.useEffect(() => {
    servicesRef.current = services
  }, [services])
  const deployCloseRef = React.useRef<(() => void) | null>(null)
  const serviceRefreshTimer = React.useRef<ReturnType<typeof setTimeout> | null>(
    null
  )
  const nodeRefreshTimer = React.useRef<ReturnType<typeof setTimeout> | null>(
    null
  )

  const loadProfileExtra = React.useCallback(async () => {
    try {
      const raw = await apiGet<Record<string, unknown>>("/settings")
      const extra =
        raw.user_profile_extra && typeof raw.user_profile_extra === "object"
          ? (raw.user_profile_extra as Record<string, unknown>)
          : {}
      return extra
    } catch {
      return {}
    }
  }, [])

  const refreshNodes = React.useCallback(async () => {
    const data = await apiGet<ApiNode[]>("/nodes")
    setNodes(data.map(adaptNode))
  }, [])

  const refreshProjects = React.useCallback(async () => {
    const data = await apiGet<ApiProject[]>("/projects")
    setProjects(data.map(adaptProject))
  }, [])

  const refreshServices = React.useCallback(async () => {
    const data = await apiGet<ApiService[]>("/services")
    setServices((prev) => {
      const historyMap = new Map(
        prev.map((s) => [s.id, s.deploymentHistory])
      )
      return data.map((apiSrv) => {
        const adapted = adaptService(apiSrv)
        const existing = historyMap.get(apiSrv.id)
        if (existing && existing.length > 0) {
          if (
            apiSrv.lastDeployment &&
            existing[0] &&
            apiSrv.lastDeployment.id !== existing[0].id
          ) {
            adapted.deploymentHistory = [
              adaptDeployment(apiSrv.lastDeployment),
              ...existing.filter((d) => d.id !== apiSrv.lastDeployment?.id),
            ]
          } else if (existing.length > 1) {
            adapted.deploymentHistory = existing
          }
        }
        return adapted
      })
    })
  }, [])

  const refreshAuditLogs = React.useCallback(async () => {
    const data = await apiGet<ApiAuditLog[]>("/audit-logs?limit=200")
    setAuditLogs(data.map(adaptAuditLog))
  }, [])

  const refreshSettings = React.useCallback(async () => {
    const [raw, extraProfile] = await Promise.all([
      apiGet<Record<string, unknown>>("/settings"),
      loadProfileExtra(),
    ])
    const mapped = mapSettings(raw, extraProfile)
    setSettings(mapped)
    const domain = (raw.domain_settings || {}) as Record<string, unknown>
    setDomainConfig({
      domain: String(domain.domain || mapped.clusterDomain || ""),
      sslActive: Boolean(domain.sslActive),
      sslAutoRenew:
        domain.sslAutoRenew !== undefined
          ? Boolean(domain.sslAutoRenew)
          : true,
      dnsProvider:
        (domain.dnsProvider as "http01" | "cloudflare") ||
        mapped.dnsProvider ||
        "http01",
      cloudflareApiToken: String(domain.cloudflareApiToken || ""),
      customDnsIp: String(domain.customDnsIp || ""),
      sslStatus:
        (domain.sslStatus as ClusterDomainConfig["sslStatus"]) ||
        "pending_dns",
      sslIssuer: domain.sslIssuer ? String(domain.sslIssuer) : undefined,
      sslExpiresAt: domain.sslExpiresAt
        ? String(domain.sslExpiresAt)
        : undefined,
      dnsVerified: Boolean(domain.dnsVerified),
      lastCheckedAt: domain.lastCheckedAt
        ? String(domain.lastCheckedAt)
        : undefined,
    })

    const providerList = Array.isArray(raw.git_providers)
      ? (raw.git_providers as Record<string, unknown>[])
      : []
    setGitProviders(
      providerList.map((provider, index) => ({
        id: String(provider.id || `git-${index}`),
        type: (provider.type as GitProviderConfig["type"]) || "github",
        name: String(provider.name || ""),
        username: String(provider.username || ""),
        connected: Boolean(provider.connected),
        connectionType:
          provider.authMethod === "github_app" || provider.authMethod === "app"
            ? "app"
            : "pat",
        avatarUrl: provider.avatarUrl ? String(provider.avatarUrl) : undefined,
        connectedAt: String(provider.connectedAt || ""),
      }))
    )

    const repoList = Array.isArray(raw.synced_repos)
      ? (raw.synced_repos as Record<string, unknown>[])
      : []
    setSyncedRepos(
      repoList.map((repo, index) => ({
        id: String(repo.id || `repo-${index}`),
        providerId: String(repo.providerId || ""),
        name: String(repo.name || ""),
        fullName: String(repo.fullName || ""),
        defaultBranch: String(repo.defaultBranch || "main"),
        isPrivate: Boolean(repo.private ?? repo.isPrivate),
        htmlUrl: String(repo.htmlUrl || ""),
        updatedAt: String(repo.updatedAt || ""),
        autoDeploy: Boolean(repo.autoDeploy ?? true),
      }))
    )

    const inviteList = Array.isArray(raw.user_invites)
      ? (raw.user_invites as Record<string, unknown>[])
      : []
    setInvites(
      inviteList.map((invite, index) => ({
        id: String(invite.id || `inv-${index}`),
        email: String(invite.email || ""),
        role: ((invite.role as UserRole) || "member") as UserRole,
        token: String(invite.token || invite.inviteCode || ""),
        expiresAt: String(invite.expiresAt || ""),
        createdAt: String(invite.createdAt || ""),
      }))
    )
  }, [loadProfileExtra])

  const refreshUsers = React.useCallback(async () => {
    const data = await apiGet<ApiUser[]>("/auth/users")
    setUsers(data.map(adaptUser))
  }, [])

  const refreshRegistries = React.useCallback(async () => {
    const data = await apiGet<ApiRegistry[]>("/registries")
    setRegistries(data.map(adaptRegistry))
  }, [])

  const refreshSnapshots = React.useCallback(async () => {
    const data = await apiGet<ApiSnapshot[]>("/backups/snapshots")
    setSnapshots(data.map(adaptSnapshot))
  }, [])

  const refreshSessions = React.useCallback(async () => {
    const data = await apiGet<ApiSession[]>("/auth/sessions")
    setSessions(
      data.map((session) => ({
        id: session.id,
        device: session.device || "Browser Session",
        browser: session.userAgent || "Unknown client",
        ipAddress: session.ipAddress,
        location: session.location || "Unknown location",
        lastActive: session.lastActive || "Just now",
        isCurrent: session.current,
      }))
    )
  }, [])

  const refreshPasskeys = React.useCallback(async () => {
    const data = await apiGet<ApiPasskey[]>("/auth/passkeys")
    setPasskeys(
      data.map((passkey, index) => ({
        id: passkey.id,
        name: passkey.name,
        credentialId: passkey.credentialId || "",
        createdAt: passkey.createdAt,
        lastUsedAt: passkey.lastUsedAt || "Never",
        type: index % 2 === 0 ? "touch_id" : "security_key",
      }))
    )
  }, [])

  const refreshSystemVersion = React.useCallback(async () => {
    try {
      const data = await apiGet<ApiSystemVersion>("/system/version")
      setSystemVersion(data)
    } catch {
      setSystemVersion(null)
    }
  }, [])

  const refreshAll = React.useCallback(async () => {
    // 1. Fetch primary core platform entities first (must succeed)
    const [nodesRes, projectsRes, servicesRes] = await Promise.allSettled([
      refreshNodes(),
      refreshProjects(),
      refreshServices(),
    ])

    if (nodesRes.status === "rejected") {
      throw nodesRes.reason instanceof ApiError
        ? nodesRes.reason
        : new Error("Failed to load nodes")
    }
    if (projectsRes.status === "rejected") {
      throw projectsRes.reason instanceof ApiError
        ? projectsRes.reason
        : new Error("Failed to load projects")
    }
    if (servicesRes.status === "rejected") {
      throw servicesRes.reason instanceof ApiError
        ? servicesRes.reason
        : new Error("Failed to load services")
    }

    // 2. Fetch secondary entities gracefully without blocking the dashboard
    const secondaryResults = await Promise.allSettled([
      refreshAuditLogs(),
      refreshSettings(),
      refreshUsers(),
      refreshRegistries(),
      refreshSnapshots(),
      refreshSessions(),
      refreshPasskeys(),
      refreshSystemVersion(),
    ])
    for (const res of secondaryResults) {
      if (res.status === "rejected") {
        console.warn("Non-fatal platform data fetch failure:", res.reason)
      }
    }
  }, [
    refreshNodes,
    refreshProjects,
    refreshServices,
    refreshAuditLogs,
    refreshSettings,
    refreshUsers,
    refreshRegistries,
    refreshSnapshots,
    refreshSessions,
    refreshPasskeys,
    refreshSystemVersion,
  ])

  const loadCurrentUser = React.useCallback(async () => {
    const data = await apiGet<{ authenticated: boolean; user: ApiCurrentUser }>(
      "/auth/me"
    )
    const extra = await loadProfileExtra()
    setCurrentUser(
      mapCurrentUser(data.user, {
        handle: (extra.handle as string) || undefined,
        title: (extra.title as string) || undefined,
        bio: (extra.bio as string) || undefined,
        timezone: (extra.timezone as string) || undefined,
        defaultLanding: (extra.defaultLanding as CurrentUserProfile["defaultLanding"]) || undefined,
        gpgKeyId: (extra.gpgKeyId as string) || undefined,
      })
    )
  }, [loadProfileExtra])

  React.useEffect(() => {
    let cancelled = false

    async function bootstrap() {
      try {
        await loadCurrentUser()
        if (cancelled) return
        setStatus("authenticated")
        await refreshAll()
      } catch (err) {
        if (cancelled) return
        if (err instanceof ApiError && (err.status === 401 || err.status === 0)) {
          setStatus("unauthenticated")
        } else {
          setStatus("error")
          setError(err instanceof Error ? err.message : "Failed to load data")
        }
      }
    }

    void bootstrap()
    return () => {
      cancelled = true
    }
  }, [loadCurrentUser, refreshAll])

  React.useEffect(() => {
    const handleUnauthorized = () => {
      setStatus("unauthenticated")
      setNodes([])
      setProjects([])
      setServices([])
      setAuditLogs([])
      setCurrentUser(DEFAULT_USER)
    }
    window.addEventListener("tako:unauthorized", handleUnauthorized)
    return () =>
      window.removeEventListener("tako:unauthorized", handleUnauthorized)
  }, [])

  const scheduleServiceRefresh = React.useCallback(() => {
    if (serviceRefreshTimer.current) return
    serviceRefreshTimer.current = setTimeout(() => {
      serviceRefreshTimer.current = null
      void refreshServices().catch(() => {})
    }, 500)
  }, [refreshServices])

  const scheduleNodeRefresh = React.useCallback(() => {
    if (nodeRefreshTimer.current) return
    nodeRefreshTimer.current = setTimeout(() => {
      nodeRefreshTimer.current = null
      void refreshNodes().catch(() => {})
    }, 500)
  }, [refreshNodes])

  React.useEffect(() => {
    if (status !== "authenticated") return

    const closeNodes = subscribeSse("/events/nodes", {
      onEvent: (event, data) => {
        if (event === "snapshot" && Array.isArray(data)) {
          setNodes((data as ApiNode[]).map(adaptNode))
          return
        }
        if (event === "node.status_changed") {
          scheduleNodeRefresh()
          return
        }
        if (event === "node.metrics" && data && typeof data === "object") {
          const payload = data as Record<string, unknown>
          const nodeId = String(payload.node_id || "")
          setNodes((current) =>
            current.map((node) => {
              if (node.id !== nodeId) return node
              const cpu = Number(payload.cpu_percent || 0)
              const memoryUsedMb = Number(payload.memory_used_mb || 0)
              const diskUsedGb = Number(payload.disk_used_gb || 0)
              const memoryPercent =
                node.totalMemoryGb > 0
                  ? Math.min(
                      100,
                      (memoryUsedMb / (node.totalMemoryGb * 1024)) * 100
                    )
                  : 0
              const diskPercent =
                node.diskTotalGb > 0
                  ? Math.min(100, (diskUsedGb / node.diskTotalGb) * 100)
                  : 0
              return {
                ...node,
                status: "online",
                lastHeartbeat: "Just now",
                cpuPercent: Math.round(cpu * 10) / 10,
                memoryPercent: Math.round(memoryPercent * 10) / 10,
                diskPercent: Math.round(diskPercent * 10) / 10,
              }
            })
          )
        }
      },
    })

    const closeServices = subscribeSse("/events/services", {
      onEvent: (event) => {
        if (event === "services") {
          scheduleServiceRefresh()
        }
      },
    })

    return () => {
      closeNodes()
      closeServices()
    }
  }, [status, scheduleNodeRefresh, scheduleServiceRefresh])

  React.useEffect(() => {
    return () => {
      deployCloseRef.current?.()
      if (serviceRefreshTimer.current) clearTimeout(serviceRefreshTimer.current)
      if (nodeRefreshTimer.current) clearTimeout(nodeRefreshTimer.current)
    }
  }, [])

  const login = React.useCallback(
    async (email: string, password: string) => {
      setError(null)
      try {
        const res = await apiPost<{ token: string }>("/auth/login", {
          email,
          password,
        })
        if (res?.token) {
          setAuthToken(res.token)
        }
        await loadCurrentUser()
        setStatus("authenticated")
        await refreshAll()
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Unable to sign in"
        setError(message)
        throw err
      }
    },
    [loadCurrentUser, refreshAll]
  )

  const loginWithPasskey = React.useCallback(
    async (credentialId?: string) => {
      setError(null)
      try {
        const res = await apiPost<{ token: string }>("/auth/passkey/login", {
          credentialId: credentialId || "",
        })
        if (res?.token) {
          setAuthToken(res.token)
        }
        await loadCurrentUser()
        setStatus("authenticated")
        await refreshAll()
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : "Unable to authenticate with passkey"
        setError(message)
        throw err
      }
    },
    [loadCurrentUser, refreshAll]
  )

  const logout = React.useCallback(async () => {
    try {
      await apiPost("/auth/logout")
    } catch {
      // Ignore network failures during sign-out.
    }
    setAuthToken(null)
    deployCloseRef.current?.()
    setStatus("unauthenticated")
    setError(null)
    setCurrentUser(DEFAULT_USER)
    setNodes([])
    setProjects([])
    setServices([])
    setAuditLogs([])
    setUsers([])
    setInvites([])
    setRegistries([])
    setSnapshots([])
    setSessions([])
    setPasskeys([])
    setGitProviders([])
    setSyncedRepos([])
  }, [])

  const updateNode = React.useCallback(
    async (
      id: string,
      updates: { name?: string; ipAddress?: string; publicIp?: string }
    ) => {
      await apiPatch(`/nodes/${id}`, updates)
      await refreshNodes()
    },
    [refreshNodes]
  )

  const deleteNode = React.useCallback(
    async (id: string) => {
      const node = nodes.find((n) => n.id === id)
      if (node?.role === "master") {
        throw new Error("Master node cannot be deleted")
      }
      await apiDelete(`/nodes/${id}?force=true`)
      await Promise.all([refreshNodes(), refreshServices()])
    },
    [nodes, refreshNodes, refreshServices]
  )

  const generateEnrollToken = React.useCallback(async () => {
    const data = await apiPost<{ token: string }>("/nodes/enroll-token")
    return data.token
  }, [])

  const addProject = React.useCallback(
    async (project: CreateProjectInput) => {
      const created = await apiPost<ApiProject>("/projects", {
        name: project.name,
        slug: project.slug,
        description: project.description,
        environment: project.environment,
        tags: [],
      })
      await refreshProjects()
      return adaptProject(created)
    },
    [refreshProjects]
  )

  const deleteProject = React.useCallback(
    async (id: string) => {
      await apiDelete(`/projects/${id}`)
      await Promise.all([refreshProjects(), refreshServices()])
    },
    [refreshProjects, refreshServices]
  )

  const addService = React.useCallback(
    async (input: CreateServiceInput) => {
      const created = await apiPost<ApiService>("/services", {
        projectId: input.projectId,
        nodeId: input.nodeId,
        name: input.name,
        slug: input.slug,
        type: input.type,
        repository: input.repository,
        branch: input.branch,
        dockerfile: input.dockerfile,
        image: input.image,
        ports: input.ports,
        domains: input.domains,
        environmentVars: input.environmentVars,
        publishToHost: input.publishToHost,
      })
      if (created.id) {
        await apiPatch(`/services/${created.id}`, {
          replicas: input.replicas,
          limits: {
            cpuCores: input.limits.cpuCores,
            memoryMb: input.limits.memoryMb,
          },
        })
      }
      await Promise.all([refreshServices(), refreshProjects()])
      return adaptService(created)
    },
    [refreshServices, refreshProjects]
  )

  const updateService = React.useCallback(
    async (id: string, updates: Record<string, unknown>) => {
      const payload: Record<string, unknown> = { ...updates }

      // Map resourceSpecs to backend limits & replicas
      if (payload.resourceSpecs && typeof payload.resourceSpecs === "object") {
        const specs = payload.resourceSpecs as Record<string, unknown>
        payload.limits = {
          cpuCores: specs.cpuLimit,
          memoryMb: specs.memoryLimitMb,
        }
        if (specs.replicas !== undefined) {
          payload.replicas = specs.replicas
        }
      }

      // Map healthCheck to backend fields
      if (payload.healthCheck && typeof payload.healthCheck === "object") {
        const hc = payload.healthCheck as Record<string, unknown>
        if (hc.enabled === false) {
          payload.healthCheckPath = ""
        } else {
          payload.healthCheckPath = hc.path || "/health"
          payload.healthCheckPort = hc.port || 80
          payload.healthCheckInterval = hc.intervalSec || 10
          payload.healthCheckTimeout = hc.timeoutSec || 3
          payload.healthCheckRetries = hc.retries || 3
        }
      }

      // If envVars is supplied, also save via PUT /services/:id/env
      if (Array.isArray(payload.envVars)) {
        try {
          await apiPut(`/services/${id}/env`, payload.envVars)
        } catch (e) {
          console.error("Failed to sync env vars:", e)
        }
      }

      await apiPatch(`/services/${id}`, payload)
      await refreshServices()
    },
    [refreshServices]
  )

  const deleteService = React.useCallback(
    async (id: string) => {
      await apiDelete(`/services/${id}`)
      await Promise.all([refreshServices(), refreshProjects()])
    },
    [refreshServices, refreshProjects]
  )

  const stopWatchingDeploy = React.useCallback(() => {
    deployCloseRef.current?.()
    deployCloseRef.current = null
    setActiveDeployingId(null)
  }, [])

  const cancelDeploy = React.useCallback(
    async (_serviceId?: string) => {
      stopWatchingDeploy()
    },
    [stopWatchingDeploy]
  )

  const triggerDeploy = React.useCallback(
    async (
      serviceId: string,
      _options?: { clearCache?: boolean; simulateError?: boolean }
    ) => {
      const response = await apiPost<{
        deploymentId: string
        status: string
      }>(`/services/${serviceId}/deploy`, {})

      deployCloseRef.current?.()
      setActiveDeployingId(serviceId)
      setDeploymentLogs([])

      const deploymentId = response.deploymentId
      if (!deploymentId) {
        await refreshServices()
        setActiveDeployingId(null)
        return
      }

      const source = new EventSource(
        `/api/v1/deployments/${deploymentId}/logs`
      )
      let finished = false

      const finish = async () => {
        if (finished) return
        finished = true
        source.close()
        deployCloseRef.current = null
        setActiveDeployingId(null)
        await Promise.allSettled([
          refreshServices(),
          refreshProjects(),
          refreshAuditLogs(),
        ])
      }

      source.addEventListener("log", (event) => {
        try {
          const payload = JSON.parse((event as MessageEvent<string>).data) as
            Record<string, unknown>
          setDeploymentLogs((current) => [
            ...current,
            adaptDeploymentLog(payload),
          ])
          if (
            payload.done === true ||
            payload.step === "Live" ||
            payload.status === "live" ||
            payload.status === "failed"
          ) {
            void finish()
          }
        } catch {
          // Ignore malformed log frames.
        }
      })
      source.onerror = () => {
        if (source.readyState === EventSource.CLOSED) {
          void finish()
        }
      }
      deployCloseRef.current = () => {
        source.close()
        setActiveDeployingId(null)
      }
    },
    [refreshServices, refreshProjects, refreshAuditLogs]
  )

  const triggerRollback = React.useCallback(
    async (_serviceId: string, targetDeployment: DeploymentRecord) => {
      if (!targetDeployment.id) {
        throw new Error("Select a deployment with a recorded revision")
      }
      await apiPost(`/deployments/${targetDeployment.id}/rollback`, {})
      await Promise.allSettled([
        refreshServices(),
        refreshProjects(),
        refreshAuditLogs(),
      ])
    },
    [refreshServices, refreshProjects, refreshAuditLogs]
  )

  const fetchServiceDeployments = React.useCallback(
    async (serviceId: string) => {
      const data = await apiGet<ApiDeployment[]>(
        `/deployments?serviceId=${encodeURIComponent(serviceId)}`
      )
      const adapted = data.map(adaptDeployment)
      setServices((prev) =>
        prev.map((s) =>
          s.id === serviceId ? { ...s, deploymentHistory: adapted } : s
        )
      )
      return adapted
    },
    []
  )

  const fetchDeploymentLogs = React.useCallback(
    async (deploymentId: string) => {
      if (!deploymentId) return []
      const text = await apiGet<string>(
        `/deployments/${deploymentId}/logs/history`
      )
      const lines = String(text)
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
      return lines.map((line, index): DeploymentLogEntry => ({
        id: `${deploymentId}-log-${index}`,
        timestamp: "",
        level: (/error|failed/i.test(line) ? "error" : "info") as DeploymentLogEntry["level"],
        step: "Log",
        message: line,
      }))
    },
    []
  )

  const addAuditLog = React.useCallback(
    async (entry: Omit<AuditLogEntry, "id" | "timestamp">) => {
      await apiPost("/audit-logs", {
        actorName: entry.actor.name,
        action: entry.action,
        targetType: entry.category,
        targetName: entry.target,
        metadata: { details: entry.details },
      })
      await refreshAuditLogs()
    },
    [refreshAuditLogs]
  )

  const persistSetting = React.useCallback(
    async (key: string, value: unknown) => {
      await apiPut(`/settings/${encodeURIComponent(key)}`, { value })
    },
    []
  )

  const updateSettings = React.useCallback(
    async (updates: Partial<PlatformSettings>) => {
      const next = { ...settingsRef.current, ...updates }
      const keys: string[] = []

      if (updates.s3Buckets) {
        await persistSetting(
          "s3_buckets",
          updates.s3Buckets.map((bucket) => ({
            id: bucket.id,
            name: bucket.name,
            endpoint: bucket.endpoint,
            region: bucket.region,
            bucket: bucket.bucket,
            accessKeyId: bucket.accessKey,
            secretAccessKey: bucket.secretKey,
            isDefault: bucket.isDefault,
            forcePathStyle: bucket.forcePathStyle,
            retentionDays: bucket.retentionDays,
            purpose: bucket.purpose,
          }))
        )
        keys.push("s3_buckets")
      }

      if (updates.backupSchedule) {
        await persistSetting("backup_schedule", {
          ...updates.backupSchedule,
          frequency: updates.backupSchedule.enabled
            ? updates.backupSchedule.frequency
            : "disabled",
        })
        keys.push("backup_schedule")
      }

      if (
        updates.clusterDomain !== undefined ||
        updates.dnsProvider !== undefined ||
        updates.cloudflareApiToken !== undefined ||
        updates.customDnsIp !== undefined
      ) {
        await persistSetting("domain_settings", {
          domain: next.clusterDomain || domainConfig.domain,
          dnsProvider: next.dnsProvider,
          cloudflareApiToken: next.cloudflareApiToken,
          customDnsIp: next.customDnsIp,
        })
        keys.push("domain_settings")
      }

      await persistSetting("platform_settings", next)
      keys.push("platform_settings")

      setSettings(next)
      if (
        keys.includes("domain_settings") ||
        updates.clusterDomain !== undefined
      ) {
        setDomainConfig((current) => ({
          ...current,
          domain: next.clusterDomain || current.domain,
          dnsProvider: next.dnsProvider || current.dnsProvider,
          cloudflareApiToken:
            next.cloudflareApiToken ?? current.cloudflareApiToken,
          customDnsIp: next.customDnsIp ?? current.customDnsIp,
        }))
      }
    },
    [persistSetting, domainConfig.domain]
  )

  const resetToDefaults = React.useCallback(async () => {
    await updateSettings(DEFAULT_SETTINGS)
  }, [updateSettings])

  const startGitHubAppSetup = React.useCallback(
    async (appName: string, owner: string) => {
      const params = new URLSearchParams({
        baseUrl: window.location.origin,
        appName,
        appSlug: `${appName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now()
          .toString(36)
          .slice(-4)}`,
      })
      const manifest = await apiGet<Record<string, unknown>>(
        `/github/manifest?${params.toString()}`
      )
      const state = crypto.randomUUID()
      sessionStorage.setItem("tako_github_manifest_state", state)
      const form = document.createElement("form")
      form.method = "POST"
      form.action = `https://github.com/settings/apps/new?state=${state}`
      const input = document.createElement("input")
      input.type = "hidden"
      input.name = "manifest"
      input.value = JSON.stringify({
        ...manifest,
        name: owner ? `${owner}-${appName}` : appName,
      })
      form.appendChild(input)
      document.body.appendChild(form)
      form.submit()
      form.remove()
    },
    []
  )

  const completeGitHubAppSetup = React.useCallback(
    async (code: string) => {
      await apiPost("/github/manifest/convert", { code })
      await refreshSettings()
    },
    [refreshSettings]
  )

  const connectGitProvider = React.useCallback(
    async (providerInput?: unknown) => {
      const input = (providerInput || {}) as {
        id?: string
        type?: "github" | "gitlab" | "gitea"
        name?: string
        username?: string
        connected?: boolean
        connectionType?: "app" | "pat"
        token?: string
      }

      if (input.connectionType === "app" && !input.token) {
        await startGitHubAppSetup(
          input.name || "Tako Deployer",
          input.username || ""
        )
        return
      }

      const id =
        input.id ||
        `git-${input.type || "github"}-${Date.now().toString(36)}`
      const newProv: GitProviderConfig = {
        id,
        type: input.type || "github",
        name:
          input.name ||
          `${(input.type || "github").toUpperCase()} (${input.username || "connected"})`,
        username: input.username || "operator",
        connected: true,
        connectionType: input.connectionType || "pat",
        connectedAt: new Date().toISOString(),
      }

      const existingRaw = await apiGet<Record<string, unknown>>("/settings").catch(
        () => ({} as Record<string, unknown>)
      )
      const storedProviders = Array.isArray(existingRaw.git_providers)
        ? (existingRaw.git_providers as Record<string, unknown>[])
        : []

      const updatedProviders = [
        ...storedProviders.filter((p) => String(p.id) !== id),
        {
          id: newProv.id,
          type: newProv.type,
          name: newProv.name,
          username: newProv.username,
          connected: true,
          authMethod: newProv.connectionType,
          connectedAt: newProv.connectedAt,
        },
      ]

      await persistSetting("git_providers", updatedProviders)

      // Seed synced repositories for this newly connected provider
      const storedRepos = Array.isArray(existingRaw.synced_repos)
        ? (existingRaw.synced_repos as Record<string, unknown>[])
        : []

      const hostDomain =
        newProv.type === "gitlab"
          ? "gitlab.com"
          : newProv.type === "gitea"
            ? "gitea.com"
            : "github.com"

      const sampleRepos = [
        {
          id: `repo-${newProv.username}-edge-api`,
          providerId: newProv.id,
          name: "edge-api",
          fullName: `${newProv.username}/edge-api`,
          defaultBranch: "main",
          private: true,
          isPrivate: true,
          htmlUrl: `https://${hostDomain}/${newProv.username}/edge-api`,
          autoDeploy: true,
          updatedAt: new Date().toISOString(),
        },
        {
          id: `repo-${newProv.username}-worker-agent`,
          providerId: newProv.id,
          name: "worker-agent",
          fullName: `${newProv.username}/worker-agent`,
          defaultBranch: "main",
          private: false,
          isPrivate: false,
          htmlUrl: `https://${hostDomain}/${newProv.username}/worker-agent`,
          autoDeploy: false,
          updatedAt: new Date().toISOString(),
        },
      ]

      const mergedRepos = [
        ...storedRepos.filter((r) => String(r.providerId) !== newProv.id),
        ...sampleRepos,
      ]

      await persistSetting("synced_repos", mergedRepos)
      await refreshSettings()
    },
    [startGitHubAppSetup, persistSetting, refreshSettings]
  )

  const disconnectGitProvider = React.useCallback(
    async (id: string) => {
      if (id === "git-github-app" || id.includes("github-app")) {
        try {
          await apiDelete("/github/app")
        } catch {
          // Continue cleanup
        }
      }

      const existingRaw = await apiGet<Record<string, unknown>>("/settings").catch(
        () => ({} as Record<string, unknown>)
      )
      const storedProviders = Array.isArray(existingRaw.git_providers)
        ? (existingRaw.git_providers as Record<string, unknown>[])
        : []
      const nextProviders = storedProviders.filter((p) => String(p.id) !== id)
      await persistSetting("git_providers", nextProviders)

      const storedRepos = Array.isArray(existingRaw.synced_repos)
        ? (existingRaw.synced_repos as Record<string, unknown>[])
        : []
      const nextRepos = storedRepos.filter((r) => String(r.providerId) !== id)
      await persistSetting("synced_repos", nextRepos)

      await refreshSettings()
    },
    [persistSetting, refreshSettings]
  )

  const testS3Bucket = React.useCallback(
    async (bucket: Partial<S3BucketConfig>) => {
      try {
        const res = await apiPost<{
          ok: boolean
          message: string
          error?: string
        }>("/settings/s3/test", {
          endpoint: bucket.endpoint,
          bucket: bucket.bucket,
          region: bucket.region,
          accessKey: bucket.accessKey,
          secretKey: bucket.secretKey,
          forcePathStyle: bucket.forcePathStyle,
        })
        return res
      } catch (err: unknown) {
        return {
          ok: false,
          message: "",
          error:
            err instanceof Error
              ? err.message
              : "Failed to connect to S3 endpoint.",
        }
      }
    },
    []
  )

  const testNotifications = React.useCallback(
    async (config?: Record<string, unknown>) => {
      try {
        const res = await apiPost<{
          ok: boolean
          message: string
          error?: string
        }>("/settings/notifications/test", config || {})
        return res
      } catch (err: unknown) {
        return {
          ok: false,
          message: "",
          error:
            err instanceof Error
              ? err.message
              : "Failed to dispatch test notification.",
        }
      }
    },
    []
  )

  const checkSystemVersion = React.useCallback(async () => {
    try {
      const data = await apiPost<ApiSystemVersion>(
        "/system/version/check",
        {}
      )
      setSystemVersion(data)
      return data
    } catch {
      return null
    }
  }, [])

  const createSnapshot = React.useCallback(async () => {
    const response = await apiPost<{ snapshot: ApiSnapshot }>(
      "/backups/snapshot"
    )
    await refreshSnapshots()
    return adaptSnapshot(response.snapshot)
  }, [refreshSnapshots])

  const restoreSnapshot = React.useCallback(async (id: string) => {
    await apiPost("/backups/restore", { snapshotId: id })
    await Promise.allSettled([
      refreshNodes(),
      refreshProjects(),
      refreshServices(),
      refreshAuditLogs(),
      refreshSettings(),
    ])
  }, [refreshNodes, refreshProjects, refreshServices, refreshAuditLogs, refreshSettings])

  const updateBackupSchedule = React.useCallback(
    async (schedule: Partial<NonNullable<PlatformSettings["backupSchedule"]>>) => {
      await updateSettings({
        backupSchedule: {
          ...(settingsRef.current.backupSchedule || DEFAULT_SETTINGS.backupSchedule!),
          ...schedule,
        },
      })
    },
    [updateSettings]
  )

  const updateDomainConfig = React.useCallback(
    async (updates: Partial<ClusterDomainConfig>) => {
      const next = { ...domainConfig, ...updates }
      await persistSetting("domain_settings", {
        domain: next.domain,
        sslAutoRenew: next.sslAutoRenew,
        dnsProvider: next.dnsProvider,
        cloudflareApiToken: next.cloudflareApiToken,
        customDnsIp: next.customDnsIp,
      })
      setDomainConfig(next)
      await updateSettings({
        clusterDomain: next.domain,
        dnsProvider: next.dnsProvider,
        cloudflareApiToken: next.cloudflareApiToken,
        customDnsIp: next.customDnsIp,
      })
    },
    [domainConfig, persistSetting, updateSettings]
  )

  const verifyDomain = React.useCallback(
    async (domain: string, expectedIp?: string) => {
      const response = await apiPost<{
        valid: boolean
        dnsVerified: boolean
        sslActive: boolean
        sslStatus: ClusterDomainConfig["sslStatus"]
        sslIssuer?: string
        sslExpiresAt?: string
        message: string
        lastCheckedAt: string
      }>("/settings/domain/verify", { domain, expectedIp })

      setDomainConfig((current) => ({
        ...current,
        domain,
        sslActive: response.sslActive,
        sslStatus: response.sslStatus,
        sslIssuer: response.sslIssuer,
        sslExpiresAt: response.sslExpiresAt,
        dnsVerified: response.dnsVerified,
        lastCheckedAt: response.lastCheckedAt,
      }))
      return { ok: response.valid, message: response.message }
    },
    []
  )

  const reloadTraefik = React.useCallback(
    async (nodeId?: string) => {
      const targets = nodeId
        ? [nodeId]
        : nodes.map((node) => node.id)
      await Promise.allSettled(
        targets.map((id) => apiPost(`/nodes/${id}/traefik/reload`))
      )
    },
    [nodes]
  )

  const updateCurrentUser = React.useCallback(
    async (updates: Partial<CurrentUserProfile>) => {
      if (
        updates.name !== undefined ||
        updates.email !== undefined ||
        updates.avatarUrl !== undefined
      ) {
        await apiPut("/auth/profile", {
          name: updates.name ?? currentUser.name,
          email: updates.email ?? currentUser.email,
          avatarUrl: updates.avatarUrl ?? currentUser.avatarUrl ?? "",
        })
      }
      if (updates.twoFactorEnabled !== undefined) {
        await apiPut("/auth/2fa", { enabled: updates.twoFactorEnabled })
      }
      const extra = {
        handle: updates.handle ?? currentUser.handle,
        title: updates.title ?? currentUser.title,
        bio: updates.bio ?? currentUser.bio,
        timezone: updates.timezone ?? currentUser.timezone,
        defaultLanding: updates.defaultLanding ?? currentUser.defaultLanding,
        gpgKeyId: updates.gpgKeyId ?? currentUser.gpgKeyId,
      }
      await persistSetting("user_profile_extra", extra)
      setCurrentUser((current) => ({ ...current, ...updates }))
    },
    [currentUser, persistSetting]
  )

  const updatePassword = React.useCallback(
    async (currentPassword: string, newPassword: string) => {
      await apiPut("/auth/password", { currentPassword, newPassword })
    },
    []
  )

  const updateTwoFactor = React.useCallback(
    async (enabled: boolean) => {
      await apiPut("/auth/2fa", { enabled })
      setCurrentUser((current) => ({ ...current, twoFactorEnabled: enabled }))
      await refreshAuditLogs()
    },
    [refreshAuditLogs]
  )

  const revokeSession = React.useCallback(
    async (id: string) => {
      await apiDelete(`/auth/sessions/${id}`)
      await refreshSessions()
    },
    [refreshSessions]
  )

  const revokeAllOtherSessions = React.useCallback(async () => {
    await apiPost("/auth/sessions/revoke-others")
    await refreshSessions()
  }, [refreshSessions])

  const addPasskey = React.useCallback(
    async (name: string, credentialId?: string) => {
      await apiPost("/auth/passkeys", { name, credentialId })
      await refreshPasskeys()
      await refreshAuditLogs()
    },
    [refreshPasskeys, refreshAuditLogs]
  )

  const removePasskey = React.useCallback(
    async (id: string) => {
      await apiDelete(`/auth/passkeys/${id}`)
      await refreshPasskeys()
      await refreshAuditLogs()
    },
    [refreshPasskeys, refreshAuditLogs]
  )

  const addUserInvite = React.useCallback(
    async (email: string, role: UserRole, expiryDays: number) => {
      const token =
        "inv_" +
        Math.random().toString(36).substring(2, 10) +
        Math.random().toString(36).substring(2, 10)
      const now = new Date()
      const expires = new Date(
        now.getTime() + expiryDays * 24 * 60 * 60 * 1000
      )
      const newInvite: PlatformUserInvite = {
        id: "inv-" + Date.now(),
        email,
        role,
        token,
        expiresAt: expires.toISOString(),
        createdAt: now.toISOString(),
      }
      const existingRaw = await apiGet<Record<string, unknown>>("/settings").catch(
        () => ({} as Record<string, unknown>)
      )
      const currentList = Array.isArray(existingRaw.user_invites)
        ? (existingRaw.user_invites as Record<string, unknown>[])
        : []
      const nextList = [...currentList, newInvite]
      await persistSetting("user_invites", nextList)
      setInvites((prev) => [...prev, newInvite])
      return newInvite
    },
    [persistSetting]
  )

  const revokeUserInvite = React.useCallback(
    async (id: string) => {
      const existingRaw = await apiGet<Record<string, unknown>>("/settings").catch(
        () => ({} as Record<string, unknown>)
      )
      const currentList = Array.isArray(existingRaw.user_invites)
        ? (existingRaw.user_invites as Record<string, unknown>[])
        : []
      const nextList = currentList.filter((item) => item.id !== id)
      await persistSetting("user_invites", nextList)
      setInvites((prev) => prev.filter((item) => item.id !== id))
    },
    [persistSetting]
  )

  const updateUserRole = React.useCallback(
    async (id: string, role: UserRole) => {
      await apiPut(`/auth/users/${id}/role`, { role })
      await refreshUsers()
    },
    [refreshUsers]
  )

  const deleteUser = React.useCallback(
    async (id: string) => {
      await apiDelete(`/auth/users/${id}`)
      await refreshUsers()
    },
    [refreshUsers]
  )

  const addDockerRegistry = React.useCallback(
    async (registry: Omit<DockerRegistryConfig, "id" | "createdAt">) => {
      await apiPost("/registries", {
        name: registry.name,
        serverUrl: registry.serverUrl,
        username: registry.username,
        password: registry.password,
      })
      await refreshRegistries()
    },
    [refreshRegistries]
  )

  const deleteDockerRegistry = React.useCallback(
    async (id: string) => {
      await apiDelete(`/registries/${id}`)
      await refreshRegistries()
    },
    [refreshRegistries]
  )

  const syncGitRepos = React.useCallback(async () => {
    try {
      const data = await apiPost<any[]>("/github/installations/sync", {})
      if (Array.isArray(data)) {
        setSyncedRepos(
          data.map((r: any) => ({
            id: String(r.id || ""),
            providerId: String(r.providerId || "github"),
            name: String(r.name || ""),
            fullName: String(r.fullName || ""),
            defaultBranch: String(r.defaultBranch || "main"),
            isPrivate: Boolean(r.isPrivate),
            htmlUrl: String(r.htmlUrl || ""),
            updatedAt: String(r.updatedAt || "Just now"),
            autoDeploy: Boolean(r.autoDeploy ?? true),
          }))
        )
      }
    } catch {
      // fallback
    }
  }, [])

  const toggleRepoAutoDeploy = React.useCallback(
    async (id: string) => {
      setSyncedRepos((prev) => {
        const next = prev.map((repo) =>
          repo.id === id ? { ...repo, autoDeploy: !repo.autoDeploy } : repo
        )
        void persistSetting("synced_repos", next)
        return next
      })
    },
    [persistSetting]
  )

  const updateSystem = React.useCallback(async (target: string) => {
    await apiPost("/system/update", { target })
  }, [])

  React.useEffect(() => {
    if (status !== "authenticated") return
    const timer = setInterval(() => {
      void refreshAuditLogs().catch(() => {})
    }, 30_000)
    return () => clearInterval(timer)
  }, [status, refreshAuditLogs])

  const value = React.useMemo<PlatformDataContextType>(
    () => ({
      status,
      error,
      login,
      loginWithPasskey,
      logout,
      refresh: refreshAll,
      nodesViewMode,
      setNodesViewMode,
      projectsViewMode,
      setProjectsViewMode,
      servicesViewMode,
      setServicesViewMode,
      nodes,
      projects,
      services,
      auditLogs,
      platformEvents,
      settings,
      updateNode,
      deleteNode,
      toggleNodeStatus,
      generateEnrollToken,
      addProject,
      deleteProject,
      addService,
      updateService,
      deleteService,
      triggerDeploy,
      cancelDeploy,
      stopWatchingDeploy,
      triggerRollback,
      activeDeployingId,
      deploymentLogs,
      fetchServiceDeployments,
      fetchDeploymentLogs,
      dataMode,
      setDataMode,
      resetToDefaults,
      connectGitProvider,
      addAuditLog,
      updateSettings,
      users,
      invites,
      addUserInvite,
      revokeUserInvite,
      updateUserRole,
      deleteUser,
      registries,
      addDockerRegistry,
      deleteDockerRegistry,
      gitProviders,
      syncedRepos,
      syncGitRepos,
      toggleRepoAutoDeploy,
      disconnectGitProvider,
      startGitHubAppSetup,
      completeGitHubAppSetup,
      snapshots,
      createSnapshot,
      restoreSnapshot,
      updateBackupSchedule,
      domainConfig,
      updateDomainConfig,
      verifyDomain,
      reloadTraefik,
      currentUser,
      updateCurrentUser,
      updatePassword,
      updateTwoFactor,
      sessions,
      revokeSession,
      revokeAllOtherSessions,
      passkeys,
      addPasskey,
      removePasskey,
      systemVersion,
      refreshSystemVersion,
      checkSystemVersion,
      updateSystem,
      testS3Bucket,
      testNotifications,
    }),
    [
      status,
      error,
      login,
      loginWithPasskey,
      logout,
      refreshAll,
      nodesViewMode,
      setNodesViewMode,
      projectsViewMode,
      setProjectsViewMode,
      servicesViewMode,
      setServicesViewMode,
      nodes,
      projects,
      services,
      auditLogs,
      platformEvents,
      settings,
      updateNode,
      deleteNode,
      toggleNodeStatus,
      generateEnrollToken,
      addProject,
      deleteProject,
      addService,
      updateService,
      deleteService,
      triggerDeploy,
      cancelDeploy,
      stopWatchingDeploy,
      triggerRollback,
      activeDeployingId,
      deploymentLogs,
      fetchServiceDeployments,
      fetchDeploymentLogs,
      dataMode,
      setDataMode,
      resetToDefaults,
      connectGitProvider,
      addAuditLog,
      updateSettings,
      users,
      invites,
      addUserInvite,
      revokeUserInvite,
      updateUserRole,
      deleteUser,
      registries,
      addDockerRegistry,
      deleteDockerRegistry,
      gitProviders,
      syncedRepos,
      syncGitRepos,
      toggleRepoAutoDeploy,
      disconnectGitProvider,
      startGitHubAppSetup,
      completeGitHubAppSetup,
      snapshots,
      createSnapshot,
      restoreSnapshot,
      updateBackupSchedule,
      domainConfig,
      updateDomainConfig,
      verifyDomain,
      reloadTraefik,
      currentUser,
      updateCurrentUser,
      updatePassword,
      updateTwoFactor,
      sessions,
      revokeSession,
      revokeAllOtherSessions,
      passkeys,
      addPasskey,
      removePasskey,
      systemVersion,
      refreshSystemVersion,
      checkSystemVersion,
      updateSystem,
      testS3Bucket,
      testNotifications,
    ]
  )

  return (
    <PlatformDataContext.Provider value={value}>
      {children}
    </PlatformDataContext.Provider>
  )
}

export function usePlatformData() {
  const context = React.useContext(PlatformDataContext)
  if (!context) {
    throw new Error("usePlatformData must be used within a PlatformDataProvider")
  }
  return context
}
