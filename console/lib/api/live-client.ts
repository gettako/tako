import { clearSessionCookie } from "../auth"
import {
  ApiError,
  type ApiClient,
  type AdminUser,
  type UpdateProfileRequest,
  type ChangePasswordRequest,
  type SuccessResponse,
  type LoginRequest,
  type LoginResponse,
  type TwoFactorSetupResponse,
  type TwoFactorVerifyRequest,
  type PasskeyRegistrationOptions,
  type PasskeyRegistrationVerification,
  type PasskeyRegistrationResult,
  type PasskeyLoginOptions,
  type PasskeyLoginVerification,
  type Server,
  type CreateServerRequest,
  type CreateServerResponse,
  type UpdateServerRequest,
  type ServerDetail,
  type PruneResult,
  type ServerTraefikConfig,
  type UpdateTraefikConfigRequest,
  type Project,
  type CreateProjectRequest,
  type UpdateProjectRequest,
  type ProjectDetail,
  type Service,
  type CreateServiceRequest,
  type UpdateServiceRequest,
  type RebuildRequest,
  type PullUpdateResponse,
  type ServiceDetail,
  type Deployment,
  type CreateDeploymentRequest,
  type DeploymentListResponse,
  type DeploymentDetail,
  type PreviewEnvironment,
  type ServiceEnv,
  type UpdateServiceEnvRequest,
  type InjectConnectionStringRequest,
  type InjectConnectionStringResponse,
  type Domain,
  type AddDomainRequest,
  type UpdateDomainRequest,
  type ValidateComposeRequest,
  type ValidateComposeResponse,
  type ComposeStackOverview,
  type GitHubStatus,
  type GitHubRepo,
  type GitHubBranch,
  type GitHubConnection,
  type CreateGitHubConnectionRequest,
  type GitHubManifestResponse,
  type GitHubAppExchangeRequest,
  type GitHubAppExchangeResponse,
  type WebhookResponse,
  type BuildLogStreamEvent,
  type ContainerLogEvent,
  type ServiceStatusEvent,
  type ListServicesFilter,
  type ListDeploymentsQuery,
  type ContainerLogsOptions,
  type BackupConfig,
  type UpdateBackupConfigRequest,
  type TestS3ConfigRequest,
  type BackupRecord,
  type TriggerBackupRequest,
  type DownloadBackupResponse,
  type ServiceBackupSchedule,
  type UpdateBackupScheduleRequest,
  type ServiceMetricsResponse,
  type MetricsRange,
  type NotificationChannel,
  type CreateNotificationChannelRequest,
  type UpdateNotificationChannelRequest,
  type S3Destination,
  type CreateS3DestinationRequest,
  type UpdateS3DestinationRequest,
  type TestS3DestinationRequest,
  type AuditLogListResponse,
  type User,
  type UpdateUserRoleRequest,
  type Invite,
  type CreateInviteRequest,
  type CreateInviteResponse,
  type InviteValidationResponse,
  type AcceptInviteRequest,
  type ConsoleDomainConfig,
  type UpdateConsoleDomainRequest,
  type VerifyConsoleDomainRequest,
  type VerifyConsoleDomainResponse,
} from "./client"

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers)
  if (!headers.has("Content-Type") && options.body) {
    headers.set("Content-Type", "application/json")
  }

  const response = await fetch(path, {
    ...options,
    credentials: "include",
    headers,
  })

  if (!response.ok) {
    let code = "UNKNOWN_ERROR"
    let message = `Request failed with status ${response.status}`
    let details: Record<string, unknown> | null = null

    try {
      const errorJson = (await response.json()) as {
        code?: string
        message?: string
        details?: Record<string, unknown>
      }
      if (errorJson.code) code = errorJson.code
      if (errorJson.message) message = errorJson.message
      if (errorJson.details) details = errorJson.details
    } catch {
      // Non-JSON response payload
    }

    if (
      response.status === 401 &&
      typeof window !== "undefined" &&
      !window.location.pathname.startsWith("/login")
    ) {
      clearSessionCookie()
      window.location.href = "/login"
    }

    throw new ApiError(response.status, code, message, details)
  }

  if (response.status === 204) {
    return undefined as unknown as T
  }

  return (await response.json()) as T
}

async function* parseSSEStream<T>(path: string): AsyncIterable<T> {
  const response = await fetch(path, {
    credentials: "include",
    headers: {
      Accept: "text/event-stream",
    },
  })

  if (!response.ok) {
    throw new ApiError(
      response.status,
      "STREAM_ERROR",
      `Failed to open event stream: ${response.statusText}`
    )
  }

  if (!response.body) {
    return
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ""

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split("\n\n")
      buffer = lines.pop() || ""

      for (const block of lines) {
        const eventLines = block.split("\n")
        let data = ""

        for (const line of eventLines) {
          if (line.startsWith("data: ")) {
            data = line.slice(6)
          }
        }

        if (data) {
          try {
            yield JSON.parse(data) as T
          } catch {
            // Discard malformed JSON chunks
          }
        }
      }
    }
  } finally {
    reader.releaseLock()
  }
}

export class LiveApiClient implements ApiClient {
  readonly auth = {
    login: (body: LoginRequest) =>
      request<LoginResponse>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify(body),
      }),

    logout: () =>
      request<void>("/api/auth/logout", {
        method: "POST",
      }),

    getMe: () => request<AdminUser>("/api/auth/me"),

    setup2FA: () =>
      request<TwoFactorSetupResponse>("/api/auth/2fa/setup", {
        method: "POST",
      }),

    verify2FA: (body: TwoFactorVerifyRequest) =>
      request<void>("/api/auth/2fa/verify", {
        method: "POST",
        body: JSON.stringify(body),
      }),

    beginPasskeyRegistration: () =>
      request<PasskeyRegistrationOptions>("/api/auth/passkey/register/begin", {
        method: "POST",
      }),

    finishPasskeyRegistration: (body: PasskeyRegistrationVerification) =>
      request<PasskeyRegistrationResult>("/api/auth/passkey/register/finish", {
        method: "POST",
        body: JSON.stringify(body),
      }),

    beginPasskeyLogin: () =>
      request<PasskeyLoginOptions>("/api/auth/passkey/login/begin", {
        method: "POST",
      }),

    finishPasskeyLogin: (body: PasskeyLoginVerification) =>
      request<LoginResponse>("/api/auth/passkey/login/finish", {
        method: "POST",
        body: JSON.stringify(body),
      }),

    updateProfile: (body: UpdateProfileRequest) =>
      request<AdminUser>("/api/auth/profile", {
        method: "PATCH",
        body: JSON.stringify(body),
      }),

    changePassword: (body: ChangePasswordRequest) =>
      request<SuccessResponse>("/api/auth/change-password", {
        method: "POST",
        body: JSON.stringify(body),
      }),
  }

  readonly servers = {
    list: () => request<Server[]>("/api/servers"),

    create: (body: CreateServerRequest) =>
      request<CreateServerResponse>("/api/servers", {
        method: "POST",
        body: JSON.stringify(body),
      }),

    get: (id: string) =>
      request<ServerDetail>(`/api/servers/${encodeURIComponent(id)}`),

    update: (id: string, body: UpdateServerRequest) =>
      request<ServerDetail>(`/api/servers/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),

    delete: (id: string) =>
      request<void>(`/api/servers/${encodeURIComponent(id)}`, {
        method: "DELETE",
      }),

    prune: (id: string) =>
      request<PruneResult>(`/api/servers/${encodeURIComponent(id)}/prune`, {
        method: "POST",
      }),

    getTraefikConfig: (id: string) =>
      request<ServerTraefikConfig>(
        `/api/servers/${encodeURIComponent(id)}/traefik/config`
      ),

    updateTraefikConfig: (id: string, body: UpdateTraefikConfigRequest) =>
      request<ServerTraefikConfig>(
        `/api/servers/${encodeURIComponent(id)}/traefik/config`,
        {
          method: "PUT",
          body: JSON.stringify(body),
        }
      ),

    restartTraefik: (id: string) =>
      request<SuccessResponse>(
        `/api/servers/${encodeURIComponent(id)}/traefik/restart`,
        {
          method: "POST",
        }
      ),
  }

  readonly projects = {
    list: () => request<Project[]>("/api/projects"),

    create: (body: CreateProjectRequest) =>
      request<Project>("/api/projects", {
        method: "POST",
        body: JSON.stringify(body),
      }),

    get: (id: string) =>
      request<ProjectDetail>(`/api/projects/${encodeURIComponent(id)}`),

    update: (id: string, body: UpdateProjectRequest) =>
      request<Project>(`/api/projects/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),

    delete: (id: string) =>
      request<void>(`/api/projects/${encodeURIComponent(id)}`, {
        method: "DELETE",
      }),
  }

  readonly services = {
    list: (filter?: ListServicesFilter) => {
      const params = new URLSearchParams()
      if (filter?.projectId) params.set("project_id", filter.projectId)
      if (filter?.serverId) params.set("server_id", filter.serverId)
      if (filter?.parentServiceId)
        params.set("parent_service_id", filter.parentServiceId)
      const query = params.toString() ? `?${params.toString()}` : ""
      return request<Service[]>(`/api/services${query}`)
    },

    create: (body: CreateServiceRequest) =>
      request<Service>("/api/services", {
        method: "POST",
        body: JSON.stringify(body),
      }),

    get: (id: string) =>
      request<ServiceDetail>(`/api/services/${encodeURIComponent(id)}`),

    update: (id: string, body: UpdateServiceRequest) =>
      request<Service>(`/api/services/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),

    delete: (
      id: string,
      options?: { delete_volumes?: boolean; prune_images?: boolean }
    ) => {
      const params = new URLSearchParams()
      if (options?.delete_volumes) params.set("delete_volumes", "true")
      if (options?.prune_images) params.set("prune_images", "true")
      const qs = params.toString() ? `?${params.toString()}` : ""
      return request<void>(`/api/services/${encodeURIComponent(id)}${qs}`, {
        method: "DELETE",
      })
    },

    start: (id: string) =>
      request<Service>(`/api/services/${encodeURIComponent(id)}/start`, {
        method: "POST",
      }),

    stop: (id: string) =>
      request<Service>(`/api/services/${encodeURIComponent(id)}/stop`, {
        method: "POST",
      }),

    restart: (id: string) =>
      request<Service>(`/api/services/${encodeURIComponent(id)}/restart`, {
        method: "POST",
      }),

    rebuild: (id: string, body?: RebuildRequest) =>
      request<Deployment>(`/api/services/${encodeURIComponent(id)}/rebuild`, {
        method: "POST",
        body: body ? JSON.stringify(body) : undefined,
      }),

    redeploy: (id: string) =>
      request<Deployment>(`/api/services/${encodeURIComponent(id)}/redeploy`, {
        method: "POST",
      }),

    pullUpdate: (id: string) =>
      request<PullUpdateResponse>(
        `/api/services/${encodeURIComponent(id)}/pull-update`,
        {
          method: "POST",
        }
      ),

    validateCompose: (body: ValidateComposeRequest) =>
      request<ValidateComposeResponse>("/api/services/validate-compose", {
        method: "POST",
        body: JSON.stringify(body),
      }),

    getStackOverview: (serviceId: string) =>
      request<ComposeStackOverview>(
        `/api/services/${encodeURIComponent(serviceId)}/stack`
      ),

    listDeployments: (serviceId: string, query?: ListDeploymentsQuery) => {
      const params = new URLSearchParams()
      if (query?.page) params.set("page", String(query.page))
      if (query?.limit) params.set("limit", String(query.limit))
      const q = params.toString() ? `?${params.toString()}` : ""
      return request<DeploymentListResponse>(
        `/api/services/${encodeURIComponent(serviceId)}/deployments${q}`
      )
    },

    createDeployment: (serviceId: string, body?: CreateDeploymentRequest) =>
      request<Deployment>(
        `/api/services/${encodeURIComponent(serviceId)}/deployments`,
        {
          method: "POST",
          body: body ? JSON.stringify(body) : undefined,
        }
      ),

    getDeployment: (serviceId: string, deploymentId: string) =>
      request<DeploymentDetail>(
        `/api/services/${encodeURIComponent(serviceId)}/deployments/${encodeURIComponent(deploymentId)}`
      ),

    cancelDeployment: (serviceId: string, deploymentId: string) =>
      request<Deployment>(
        `/api/services/${encodeURIComponent(serviceId)}/deployments/${encodeURIComponent(deploymentId)}/cancel`,
        { method: "POST" }
      ),

    rollbackDeployment: (serviceId: string, deploymentId: string) =>
      request<Deployment>(
        `/api/services/${encodeURIComponent(serviceId)}/deployments/${encodeURIComponent(deploymentId)}/rollback`,
        { method: "POST" }
      ),

    listPreviews: (serviceId: string) =>
      request<PreviewEnvironment[]>(
        `/api/services/${encodeURIComponent(serviceId)}/previews`
      ),

    deletePreview: (serviceId: string, previewId: string) =>
      request<{ success: boolean; message: string }>(
        `/api/services/${encodeURIComponent(serviceId)}/previews/${encodeURIComponent(previewId)}`,
        { method: "DELETE" }
      ),

    getEnv: (serviceId: string) =>
      request<ServiceEnv>(`/api/services/${encodeURIComponent(serviceId)}/env`),

    updateEnv: (serviceId: string, body: UpdateServiceEnvRequest) =>
      request<ServiceEnv>(
        `/api/services/${encodeURIComponent(serviceId)}/env`,
        {
          method: "PUT",
          body: JSON.stringify(body),
        }
      ),

    injectConnectionString: (
      serviceId: string,
      body: InjectConnectionStringRequest
    ) =>
      request<InjectConnectionStringResponse>(
        `/api/services/${encodeURIComponent(serviceId)}/inject-connection-string`,
        {
          method: "POST",
          body: JSON.stringify(body),
        }
      ),

    listDomains: (serviceId: string) =>
      request<Domain[]>(
        `/api/services/${encodeURIComponent(serviceId)}/domains`
      ),

    addDomain: (serviceId: string, body: AddDomainRequest) =>
      request<Domain>(
        `/api/services/${encodeURIComponent(serviceId)}/domains`,
        {
          method: "POST",
          body: JSON.stringify(body),
        }
      ),

    updateDomain: (
      serviceId: string,
      domain: string,
      body: UpdateDomainRequest
    ) =>
      request<Domain>(
        `/api/services/${encodeURIComponent(serviceId)}/domains/${encodeURIComponent(domain)}`,
        {
          method: "PATCH",
          body: JSON.stringify(body),
        }
      ),

    deleteDomain: (serviceId: string, domain: string) =>
      request<void>(
        `/api/services/${encodeURIComponent(serviceId)}/domains/${encodeURIComponent(domain)}`,
        {
          method: "DELETE",
        }
      ),

    checkDomainSsl: (serviceId: string, domain: string) =>
      request<Domain>(
        `/api/services/${encodeURIComponent(serviceId)}/domains/${encodeURIComponent(domain)}/check-ssl`,
        { method: "POST" }
      ),

    streamBuildLogs: (
      serviceId: string,
      deploymentId: string
    ): AsyncIterable<BuildLogStreamEvent> =>
      parseSSEStream<BuildLogStreamEvent>(
        `/api/services/${encodeURIComponent(serviceId)}/logs/build?deployment_id=${encodeURIComponent(deploymentId)}`
      ),

    streamContainerLogs: (
      serviceId: string,
      options?: ContainerLogsOptions
    ): AsyncIterable<ContainerLogEvent> => {
      const params = new URLSearchParams()
      if (options?.tail) params.set("tail", String(options.tail))
      if (options?.follow !== undefined)
        params.set("follow", String(options.follow))
      if (options?.container) params.set("container", options.container)
      const q = params.toString() ? `?${params.toString()}` : ""
      return parseSSEStream<ContainerLogEvent>(
        `/api/services/${encodeURIComponent(serviceId)}/logs/runtime${q}`
      )
    },

    streamStatus: (serviceId: string): AsyncIterable<ServiceStatusEvent> =>
      parseSSEStream<ServiceStatusEvent>(
        `/api/services/${encodeURIComponent(serviceId)}/status`
      ),

    getTerminalWebSocketUrl: (
      serviceId: string,
      shell?: string,
      container?: string
    ): string => {
      const proto =
        typeof window !== "undefined" && window.location.protocol === "https:"
          ? "wss:"
          : "ws:"
      const host =
        typeof window !== "undefined" ? window.location.host : "localhost:3000"
      const params = new URLSearchParams()
      if (shell) params.set("shell", shell)
      if (container) params.set("container", container)
      const q = params.toString() ? `?${params.toString()}` : ""
      return `${proto}//${host}/api/services/${encodeURIComponent(serviceId)}/terminal${q}`
    },

    getMetrics: (serviceId: string, range?: MetricsRange) => {
      const q = range ? `?range=${encodeURIComponent(range)}` : ""
      return request<ServiceMetricsResponse>(
        `/api/services/${encodeURIComponent(serviceId)}/metrics${q}`
      )
    },
  }

  readonly github = {
    getStatus: () => request<GitHubStatus>("/api/github/status"),

    listRepos: () => request<GitHubRepo[]>("/api/github/repos"),

    listBranches: (owner: string, repo: string) =>
      request<GitHubBranch[]>(
        `/api/github/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/branches`
      ),

    handleWebhook: () =>
      request<WebhookResponse>("/api/github/webhook", {
        method: "POST",
      }),

    listConnections: () =>
      request<GitHubConnection[]>("/api/github/connections"),

    createConnection: (body: CreateGitHubConnectionRequest) =>
      request<GitHubConnection>("/api/github/connections", {
        method: "POST",
        body: JSON.stringify(body),
      }),

    deleteConnection: (id: string) =>
      request<void>(`/api/github/connections/${encodeURIComponent(id)}`, {
        method: "DELETE",
      }),

    getManifest: (params?: { origin?: string }) => {
      const url = params?.origin
        ? `/api/github/manifest?origin=${encodeURIComponent(params.origin)}`
        : "/api/github/manifest"
      return request<GitHubManifestResponse>(url)
    },

    exchangeManifest: (body: GitHubAppExchangeRequest) =>
      request<GitHubAppExchangeResponse>("/api/github/manifest/exchange", {
        method: "POST",
        body: JSON.stringify(body),
      }),

    syncInstallations: () =>
      request<GitHubConnection[]>("/api/github/sync-installations", {
        method: "POST",
      }),

    listConnectionRepos: (connectionId: string) =>
      request<GitHubRepo[]>(
        `/api/github/connections/${encodeURIComponent(connectionId)}/repos`
      ),

    listConnectionBranches: (
      connectionId: string,
      owner: string,
      repo: string
    ) =>
      request<GitHubBranch[]>(
        `/api/github/connections/${encodeURIComponent(connectionId)}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/branches`
      ),
  }

  readonly backups = {
    getConfig: () => request<BackupConfig>("/api/settings/backup"),

    updateConfig: (body: UpdateBackupConfigRequest) =>
      request<BackupConfig>("/api/settings/backup", {
        method: "PUT",
        body: JSON.stringify(body),
      }),

    testStorage: (body?: TestS3ConfigRequest) =>
      request<SuccessResponse>("/api/settings/backup/test", {
        method: "POST",
        body: body ? JSON.stringify(body) : undefined,
      }),

    listControlPlaneBackups: () =>
      request<BackupRecord[]>("/api/settings/backup/records"),

    triggerControlPlaneBackup: () =>
      request<BackupRecord>("/api/settings/backup/trigger", {
        method: "POST",
      }),

    downloadControlPlaneBackup: (id: string) =>
      request<DownloadBackupResponse>(
        `/api/settings/backup/records/${encodeURIComponent(id)}/download`
      ),

    deleteControlPlaneBackup: (id: string) =>
      request<SuccessResponse>(
        `/api/settings/backup/records/${encodeURIComponent(id)}`,
        {
          method: "DELETE",
        }
      ),

    listServiceBackups: (serviceId: string) =>
      request<BackupRecord[]>(
        `/api/services/${encodeURIComponent(serviceId)}/backups`
      ),

    triggerServiceBackup: (serviceId: string, req?: TriggerBackupRequest) =>
      request<BackupRecord>(
        `/api/services/${encodeURIComponent(serviceId)}/backups`,
        {
          method: "POST",
          body: req ? JSON.stringify(req) : undefined,
        }
      ),

    getServiceBackupSchedule: (serviceId: string) =>
      request<ServiceBackupSchedule>(
        `/api/services/${encodeURIComponent(serviceId)}/backup-schedule`
      ),

    updateServiceBackupSchedule: (
      serviceId: string,
      req: UpdateBackupScheduleRequest
    ) =>
      request<ServiceBackupSchedule>(
        `/api/services/${encodeURIComponent(serviceId)}/backup-schedule`,
        {
          method: "PUT",
          body: JSON.stringify(req),
        }
      ),

    downloadServiceBackup: (serviceId: string, backupId: string) =>
      request<DownloadBackupResponse>(
        `/api/services/${encodeURIComponent(serviceId)}/backups/${encodeURIComponent(backupId)}/download`
      ),

    restoreServiceBackup: (serviceId: string, backupId: string) =>
      request<SuccessResponse>(
        `/api/services/${encodeURIComponent(serviceId)}/backups/${encodeURIComponent(backupId)}/restore`,
        {
          method: "POST",
        }
      ),

    deleteServiceBackup: (serviceId: string, backupId: string) =>
      request<SuccessResponse>(
        `/api/services/${encodeURIComponent(serviceId)}/backups/${encodeURIComponent(backupId)}`,
        {
          method: "DELETE",
        }
      ),
  }

  readonly notifications = {
    list: () => request<NotificationChannel[]>("/api/settings/notifications"),
    create: (body: CreateNotificationChannelRequest) =>
      request<NotificationChannel>("/api/settings/notifications", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    update: (id: string, body: UpdateNotificationChannelRequest) =>
      request<NotificationChannel>(
        `/api/settings/notifications/${encodeURIComponent(id)}`,
        {
          method: "PATCH",
          body: JSON.stringify(body),
        }
      ),
    delete: (id: string) =>
      request<SuccessResponse>(
        `/api/settings/notifications/${encodeURIComponent(id)}`,
        {
          method: "DELETE",
        }
      ),
    test: (id: string) =>
      request<SuccessResponse>(
        `/api/settings/notifications/${encodeURIComponent(id)}/test`,
        {
          method: "POST",
        }
      ),
  }

  readonly storage = {
    listS3Destinations: () => request<S3Destination[]>("/api/storage/s3"),
    createS3Destination: (body: CreateS3DestinationRequest) =>
      request<S3Destination>("/api/storage/s3", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    updateS3Destination: (id: string, body: UpdateS3DestinationRequest) =>
      request<S3Destination>(`/api/storage/s3/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    deleteS3Destination: (id: string) =>
      request<SuccessResponse>(`/api/storage/s3/${encodeURIComponent(id)}`, {
        method: "DELETE",
      }),
    testS3Destination: (id: string, body?: TestS3DestinationRequest) =>
      request<SuccessResponse>(
        `/api/storage/s3/${encodeURIComponent(id)}/test`,
        {
          method: "POST",
          body: body ? JSON.stringify(body) : undefined,
        }
      ),
    testS3Raw: (body: TestS3DestinationRequest) =>
      request<SuccessResponse>("/api/storage/s3/test", {
        method: "POST",
        body: JSON.stringify(body),
      }),
  }

  readonly auditLog = {
    list: (params?: { limit?: number; before?: string }) => {
      const query = new URLSearchParams()
      if (params?.limit) {
        query.set("limit", String(params.limit))
      }
      if (params?.before) {
        query.set("before", params.before)
      }
      const qs = query.toString()
      return request<AuditLogListResponse>(
        qs ? `/api/audit-log?${qs}` : "/api/audit-log"
      )
    },
  }

  readonly users = {
    list: () => request<User[]>("/api/users"),
    updateRole: (id: string, body: UpdateUserRoleRequest) =>
      request<User>(`/api/users/${encodeURIComponent(id)}/role`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    delete: (id: string) =>
      request<SuccessResponse>(`/api/users/${encodeURIComponent(id)}`, {
        method: "DELETE",
      }),
  }

  readonly invites = {
    create: (body: CreateInviteRequest) =>
      request<CreateInviteResponse>("/api/invites", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    list: () => request<Invite[]>("/api/invites"),
    revoke: (id: string) =>
      request<SuccessResponse>(`/api/invites/${encodeURIComponent(id)}`, {
        method: "DELETE",
      }),
    validate: (token: string) =>
      request<InviteValidationResponse>(
        `/api/invites/validate?token=${encodeURIComponent(token)}`
      ),
    accept: (body: AcceptInviteRequest) =>
      request<LoginResponse>("/api/invites/accept", {
        method: "POST",
        body: JSON.stringify(body),
      }),
  }

  readonly system = {
    getConsoleDomain: () =>
      request<ConsoleDomainConfig>("/api/settings/console-domain"),
    updateConsoleDomain: (body: UpdateConsoleDomainRequest) =>
      request<ConsoleDomainConfig>("/api/settings/console-domain", {
        method: "PUT",
        body: JSON.stringify(body),
      }),
    verifyConsoleDomainDNS: (body: VerifyConsoleDomainRequest) =>
      request<VerifyConsoleDomainResponse>(
        "/api/settings/console-domain/verify",
        {
          method: "POST",
          body: JSON.stringify(body),
        }
      ),
  }
}
