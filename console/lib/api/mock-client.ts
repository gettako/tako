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
  type BackupRecord,
  type TriggerBackupRequest,
  type DownloadBackupResponse,
  type ServiceBackupSchedule,
  type UpdateBackupScheduleRequest,
  type ServiceMetricsResponse,
  type ServiceMetricPoint,
  type MetricsRange,
  type NotificationChannel,
  type CreateNotificationChannelRequest,
  type UpdateNotificationChannelRequest,
  type S3Destination,
  type CreateS3DestinationRequest,
  type UpdateS3DestinationRequest,
  type TestS3DestinationRequest,
  type AuditLogEntry,
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

import {
  mockServers,
  mockServerDetails,
  mockProjects,
  mockServices,
  mockDeployments,
  mockDeploymentDetails,
  mockServiceEnvs,
  mockDomains,
  mockBuildLogs,
  mockContainerLogs,
  mockGitHubConnections,
  mockS3Destinations,
  mockAuditLogs,
  mockUsers,
  mockInvites,
} from "./fixtures"

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function checkSimulatedError(): void {
  if (typeof window !== "undefined") {
    const errorFlag = window.localStorage?.getItem("tako_simulate_api_error")
    if (errorFlag === "500") {
      throw new ApiError(
        500,
        "INTERNAL_SERVER_ERROR",
        "Simulated internal server error from mock client."
      )
    }
    if (errorFlag === "401") {
      throw new ApiError(
        401,
        "UNAUTHORIZED",
        "Simulated authentication session expiration."
      )
    }
  }
}

export class MockApiClient implements ApiClient {
  private _user: AdminUser = {
    id: "usr_admin",
    email: "admin@gettako.dev",
    name: "Admin Owner",
    role: "admin",
    two_factor_enabled: false,
    passkeys_enabled: false,
    created_at: "2026-09-01T08:00:00Z",
  }

  private _users: User[] = structuredClone(mockUsers)
  private _invites: (Invite & { token: string })[] =
    structuredClone(mockInvites)
  private _consoleDomain: ConsoleDomainConfig = {
    domain: "localhost",
    ssl_provider: "letsencrypt",
    force_https: true,
    ssl_status: "active",
    ssl_error: null,
    custom_cert: null,
    custom_key: null,
    updated_at: "2026-09-01T08:00:00Z",
  }

  private _servers: Server[] = structuredClone(mockServers)
  private _serverDetails: Record<string, ServerDetail> =
    structuredClone(mockServerDetails)
  private _projects: Project[] = structuredClone(mockProjects)
  private _services: Service[] = structuredClone(mockServices)
  private _deployments: Deployment[] = structuredClone(mockDeployments)
  private _deploymentDetails: Record<string, DeploymentDetail> =
    structuredClone(mockDeploymentDetails)
  private _serviceEnvs: Record<string, ServiceEnv> =
    structuredClone(mockServiceEnvs)
  private _domains: Record<string, Domain[]> = structuredClone(mockDomains)
  private _previews: PreviewEnvironment[] = [
    {
      id: "svc_prev_42",
      service_id: "srv_web_prod",
      pr_number: 42,
      name: "acme-web-pr-42",
      branch: "feat/billing-checkout",
      commit_sha: "a1b2c3d4",
      status: "healthy",
      url: "https://42.myapp.gettako.dev",
      created_at: new Date(Date.now() - 3600000 * 2).toISOString(),
      updated_at: new Date(Date.now() - 3600000 * 2).toISOString(),
    },
    {
      id: "svc_prev_43",
      service_id: "srv_web_prod",
      pr_number: 43,
      name: "acme-web-pr-43",
      branch: "fix/nav-header",
      commit_sha: "e5f6a7b8",
      status: "deploying",
      url: "https://43.192-168-1-10.sslip.io",
      created_at: new Date(Date.now() - 3600000 * 5).toISOString(),
      updated_at: new Date(Date.now() - 3600000 * 5).toISOString(),
    },
  ]
  private _githubConnections: GitHubConnection[] = structuredClone(
    mockGitHubConnections
  )
  private _auditLogs: AuditLogEntry[] = structuredClone(mockAuditLogs)
  private _backupConfig: BackupConfig = {
    id: "global",
    service_id: null,
    enabled: true,
    s3_destination_id: "s3d_r2_primary",
    endpoint_url: "https://a1b2c3d4e5f6.r2.cloudflarestorage.com",
    bucket: "tako-production-backups",
    region: "auto",
    access_key: "cf_r2_access_key_12345",
    has_secret_key: true,
    cron_expression: "0 2 * * *",
    retention_count: 30,
    created_at: "2026-09-01T08:00:00Z",
    updated_at: "2026-09-01T08:00:00Z",
  }
  private _controlPlaneBackups: BackupRecord[] = [
    {
      id: "bkp_cp_01",
      service_id: null,
      server_id: null,
      backup_type: "control_plane",
      database_engine: "sqlite",
      status: "completed",
      file_name: "tako-control-plane-20260928-020000.db.gz",
      s3_key: "backups/control-plane/tako-control-plane-20260928-020000.db.gz",
      file_size_bytes: 4194304,
      error_message: null,
      download_url:
        "https://mock-s3.example.com/backups/control-plane/tako-control-plane-20260928-020000.db.gz",
      created_at: "2026-09-28T02:00:00Z",
      completed_at: "2026-09-28T02:00:05Z",
    },
    {
      id: "bkp_cp_02",
      service_id: null,
      server_id: null,
      backup_type: "control_plane",
      database_engine: "sqlite",
      status: "completed",
      file_name: "tako-control-plane-20260929-020000.db.gz",
      s3_key: "backups/control-plane/tako-control-plane-20260929-020000.db.gz",
      file_size_bytes: 4259840,
      error_message: null,
      download_url:
        "https://mock-s3.example.com/backups/control-plane/tako-control-plane-20260929-020000.db.gz",
      created_at: "2026-09-29T02:00:00Z",
      completed_at: "2026-09-29T02:00:05Z",
    },
  ]
  private _notificationChannels: NotificationChannel[] = [
    {
      id: "notif_discord_1",
      type: "discord",
      name: "Discord Deployments",
      enabled: true,
      webhook_url: "https://discord.com/api/webhooks/123456789/mock-token",
      bot_token: null,
      chat_id: null,
      on_deploy_success: true,
      on_deploy_failed: true,
      on_container_crashed: true,
      created_at: "2026-09-28T10:00:00Z",
      updated_at: "2026-09-28T10:00:00Z",
    },
    {
      id: "notif_telegram_1",
      type: "telegram",
      name: "Telegram Alerts",
      enabled: true,
      webhook_url: null,
      bot_token: "123456789:ABC-DEF1234ghIkl-zyx57W2v1u123ew11",
      chat_id: "-1001987654321",
      on_deploy_success: false,
      on_deploy_failed: true,
      on_container_crashed: true,
      created_at: "2026-09-28T11:00:00Z",
      updated_at: "2026-09-28T11:00:00Z",
    },
  ]
  private _s3Destinations: S3Destination[] = structuredClone(mockS3Destinations)
  private _serviceBackups: Record<string, BackupRecord[]> = {}
  private _serviceSchedules: Record<string, ServiceBackupSchedule> = {}
  private _serverTraefikConfigs: Record<string, ServerTraefikConfig> = {
    srv_local: {
      custom_yaml: `# Custom dynamic configuration for Traefik on srv_local
http:
  middlewares:
    secure-headers:
      headers:
        sslRedirect: true
        stsSeconds: 31536000
    api-ratelimit:
      rateLimit:
        average: 100
        burst: 50
`,
      static_yaml: `# Static configuration (/etc/traefik/traefik.yaml)
entryPoints:
  web:
    address: ":80"
    http:
      redirections:
        entryPoint:
          to: websecure
          scheme: https
          permanent: true
  websecure:
    address: ":443"

certificatesResolvers:
  letsencrypt:
    acme:
      email: "admin@gettako.dev"
      storage: "/etc/traefik/acme.json"
      httpChallenge:
        entryPoint: "web"

providers:
  file:
    directory: "/etc/traefik/dynamic"
    watch: true
`,
    },
  }

  // -------------------------------------------------------------------------
  // Auth Namespace
  // -------------------------------------------------------------------------
  readonly auth = {
    login: async (_request: LoginRequest): Promise<LoginResponse> => {
      checkSimulatedError()
      await delay(180)
      if (_request.password === "invalid" || _request.password === "wrong") {
        throw new ApiError(
          401,
          "INVALID_CREDENTIALS",
          "Invalid administrator password."
        )
      }
      if (_request.two_factor_code === "000000") {
        throw new ApiError(
          400,
          "INVALID_2FA_CODE",
          "Invalid two-factor authentication code."
        )
      }
      return {
        user: this._user,
        requires_2fa:
          this._user.two_factor_enabled && !_request.two_factor_code,
        session_id: "sess_mock_admin_token",
      }
    },

    logout: async (): Promise<void> => {
      checkSimulatedError()
      await delay(100)
    },

    getMe: async (): Promise<AdminUser> => {
      checkSimulatedError()
      await delay(120)
      return structuredClone(this._user)
    },

    setup2FA: async (): Promise<TwoFactorSetupResponse> => {
      checkSimulatedError()
      await delay(150)
      return {
        secret: "JBSWY3DPEHPK3PXP",
        qr_code_svg: `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><rect width="200" height="200" fill="#fff"/><rect x="20" y="20" width="40" height="40" fill="#000"/><rect x="140" y="20" width="40" height="40" fill="#000"/><rect x="20" y="140" width="40" height="40" fill="#000"/></svg>`,
        recovery_codes: ["9876-1234", "5432-8765", "1122-3344", "5566-7788"],
      }
    },

    verify2FA: async (_request: TwoFactorVerifyRequest): Promise<void> => {
      checkSimulatedError()
      await delay(150)
      this._user.two_factor_enabled = true
    },

    beginPasskeyRegistration: async (): Promise<PasskeyRegistrationOptions> => {
      checkSimulatedError()
      await delay(120)
      return {
        challenge: "Y2hhbGxlbmdlX21vY2tfZGF0YQ",
        rp: { name: "Tako Control Plane", id: "localhost" },
        user: {
          id: this._user.id,
          name: this._user.email,
          displayName: this._user.name,
        },
        pubKeyCredParams: [{ type: "public-key", alg: -7 }],
      }
    },

    finishPasskeyRegistration: async (
      _request: PasskeyRegistrationVerification
    ): Promise<PasskeyRegistrationResult> => {
      checkSimulatedError()
      await delay(150)
      this._user.passkeys_enabled = true
      return { success: true, credential_id: "cred_mock_webauthn_1" }
    },

    beginPasskeyLogin: async (): Promise<PasskeyLoginOptions> => {
      checkSimulatedError()
      await delay(120)
      return {
        challenge: "Y2hhbGxlbmdlX2Fzc2VydGlvbl9kYXRh",
        timeout: 60000,
        rpId: "localhost",
        allowCredentials: [{ id: "cred_mock_webauthn_1", type: "public-key" }],
      }
    },

    finishPasskeyLogin: async (
      _request: PasskeyLoginVerification
    ): Promise<LoginResponse> => {
      checkSimulatedError()
      await delay(150)
      return {
        user: this._user,
        requires_2fa: false,
        session_id: "sess_mock_passkey_token",
      }
    },

    updateProfile: async (
      request: UpdateProfileRequest
    ): Promise<AdminUser> => {
      checkSimulatedError()
      await delay(150)
      if (!request.email || !request.email.includes("@")) {
        throw new ApiError(
          400,
          "INVALID_EMAIL",
          "A valid email address is required."
        )
      }
      this._user.email = request.email
      return structuredClone(this._user)
    },

    changePassword: async (
      request: ChangePasswordRequest
    ): Promise<SuccessResponse> => {
      checkSimulatedError()
      await delay(180)
      if (
        request.current_password === "wrong" ||
        request.current_password === "invalid"
      ) {
        throw new ApiError(
          400,
          "INVALID_PASSWORD",
          "Current administrator password is incorrect."
        )
      }
      if (request.new_password.length < 8) {
        throw new ApiError(
          400,
          "WEAK_PASSWORD",
          "New password must be at least 8 characters long."
        )
      }
      return {
        success: true,
      }
    },
  }

  // -------------------------------------------------------------------------
  // Servers Namespace
  // -------------------------------------------------------------------------
  readonly servers = {
    list: async (): Promise<Server[]> => {
      checkSimulatedError()
      await delay(140)
      return structuredClone(this._servers)
    },

    create: async (
      request: CreateServerRequest
    ): Promise<CreateServerResponse> => {
      checkSimulatedError()
      await delay(200)
      const newId = `srv_node_${Date.now().toString(36)}`
      const enrollmentToken = `tako_tok_${Math.random().toString(36).substring(2, 12)}`

      const newServer: Server = {
        id: newId,
        name: request.name,
        host: request.host || "pending-registration",
        status: "pending",
        agent_version: "v1.0.0",
        cpu_percent: 0,
        ram_percent: 0,
        ram_total_bytes: 0,
        ram_used_bytes: 0,
        disk_percent: 0,
        active_services_count: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }

      const snippet = `services:
  tako-agent:
    image: ghcr.io/gettako/agent:latest
    restart: unless-stopped
    environment:
      - TAKO_SERVER_URL=https://gettako.dev
      - TAKO_ENROLLMENT_TOKEN=${enrollmentToken}
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
      - /etc/tako:/etc/tako`

      this._servers.push(newServer)
      this._serverDetails[newId] = {
        ...newServer,
        docker_version: "26.1.4",
        os_info: "Linux (pending)",
        uptime_seconds: 0,
        last_heartbeat_at: new Date().toISOString(),
        expected_agent_version: "v1.0.0",
        max_concurrent_builds: 2,
        services: [],
      }

      return {
        server: newServer,
        enrollment_token: enrollmentToken,
        compose_snippet: snippet,
      }
    },

    get: async (id: string): Promise<ServerDetail> => {
      checkSimulatedError()
      await delay(120)
      const detail = this._serverDetails[id]
      if (!detail) {
        throw new ApiError(
          404,
          "SERVER_NOT_FOUND",
          `Server with ID '${id}' was not found.`
        )
      }
      if (
        detail.status === "pending" &&
        Date.now() - new Date(detail.created_at).getTime() >= 1500
      ) {
        detail.status = "online"
        if (detail.host === "pending-registration") {
          detail.host = "198.51.100.99"
        }
        detail.cpu_percent = 14.2
        detail.ram_percent = 32.5
        detail.disk_percent = 41.0
        const serverSummary = this._servers.find((s) => s.id === id)
        if (serverSummary) {
          serverSummary.status = "online"
          serverSummary.host = detail.host
          serverSummary.cpu_percent = detail.cpu_percent
          serverSummary.ram_percent = detail.ram_percent
          serverSummary.disk_percent = detail.disk_percent
        }
      }
      return structuredClone(detail)
    },

    update: async (
      id: string,
      request: UpdateServerRequest
    ): Promise<ServerDetail> => {
      checkSimulatedError()
      await delay(150)
      const detail = this._serverDetails[id]
      if (!detail) {
        throw new ApiError(
          404,
          "SERVER_NOT_FOUND",
          `Server with ID '${id}' was not found.`
        )
      }
      if (request.max_concurrent_builds !== undefined) {
        if (
          request.max_concurrent_builds < 1 ||
          request.max_concurrent_builds > 8
        ) {
          throw new ApiError(
            400,
            "INVALID_CONCURRENCY",
            "max_concurrent_builds must be between 1 and 8."
          )
        }
        detail.max_concurrent_builds = request.max_concurrent_builds
      }
      const serverSummary = this._servers.find((s) => s.id === id)
      if (request.name !== undefined) {
        detail.name = request.name
        if (serverSummary) serverSummary.name = request.name
      }
      if (request.host !== undefined) {
        detail.host = request.host
        if (serverSummary) serverSummary.host = request.host
      }
      detail.updated_at = new Date().toISOString()
      if (serverSummary) {
        serverSummary.updated_at = detail.updated_at
      }
      return structuredClone(detail)
    },

    delete: async (id: string): Promise<void> => {
      checkSimulatedError()
      await delay(150)
      const serverIndex = this._servers.findIndex((s) => s.id === id)
      if (serverIndex === -1) {
        throw new ApiError(
          404,
          "SERVER_NOT_FOUND",
          `Server with ID '${id}' was not found.`
        )
      }

      const assignedServices = this._services.filter((s) => s.server_id === id)
      if (assignedServices.length > 0) {
        throw new ApiError(
          400,
          "SERVER_HAS_SERVICES",
          `Cannot delete server '${id}' because ${assignedServices.length} active service(s) are assigned to it.`
        )
      }

      this._servers.splice(serverIndex, 1)
      delete this._serverDetails[id]
    },

    prune: async (id: string): Promise<PruneResult> => {
      checkSimulatedError()
      await delay(250)
      const server = this._servers.find((s) => s.id === id)
      if (!server) {
        throw new ApiError(
          404,
          "SERVER_NOT_FOUND",
          `Server with ID '${id}' was not found.`
        )
      }

      return {
        success: true,
        reclaimed_bytes: 3221225472,
        message: "Cleaned 3.0 GB of unused build caches and dangling images.",
      }
    },

    getTraefikConfig: async (id: string): Promise<ServerTraefikConfig> => {
      checkSimulatedError()
      await delay(120)
      const server = this._servers.find((s) => s.id === id)
      if (!server) {
        throw new ApiError(
          404,
          "SERVER_NOT_FOUND",
          `Server with ID '${id}' was not found.`
        )
      }
      if (!this._serverTraefikConfigs[id]) {
        this._serverTraefikConfigs[id] = {
          custom_yaml: `# Custom dynamic configuration for ${id}\nhttp:\n  middlewares:\n    sample-headers:\n      headers:\n        sslRedirect: true\n`,
          static_yaml: `# Static configuration for ${id}\nentryPoints:\n  web:\n    address: ":80"\n  websecure:\n    address: ":443"\n`,
        }
      }
      return structuredClone(this._serverTraefikConfigs[id])
    },

    updateTraefikConfig: async (
      id: string,
      request: UpdateTraefikConfigRequest
    ): Promise<ServerTraefikConfig> => {
      checkSimulatedError()
      await delay(180)
      const server = this._servers.find((s) => s.id === id)
      if (!server) {
        throw new ApiError(
          404,
          "SERVER_NOT_FOUND",
          `Server with ID '${id}' was not found.`
        )
      }
      const existing = await this.servers.getTraefikConfig(id)
      existing.custom_yaml = request.custom_yaml
      this._serverTraefikConfigs[id] = existing
      return structuredClone(existing)
    },

    restartTraefik: async (id: string): Promise<SuccessResponse> => {
      checkSimulatedError()
      await delay(250)
      const server = this._servers.find((s) => s.id === id)
      if (!server) {
        throw new ApiError(
          404,
          "SERVER_NOT_FOUND",
          `Server with ID '${id}' was not found.`
        )
      }
      return {
        success: true,
      }
    },
  }

  // -------------------------------------------------------------------------
  // Projects Namespace
  // -------------------------------------------------------------------------
  readonly projects = {
    list: async (): Promise<Project[]> => {
      checkSimulatedError()
      await delay(130)
      return structuredClone(this._projects)
    },

    create: async (request: CreateProjectRequest): Promise<Project> => {
      checkSimulatedError()
      await delay(160)
      const newProject: Project = {
        id: `prj_${Date.now().toString(36)}`,
        name: request.name,
        description: request.description ?? null,
        services_count: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
      this._projects.unshift(newProject)
      return structuredClone(newProject)
    },

    get: async (id: string): Promise<ProjectDetail> => {
      checkSimulatedError()
      await delay(120)
      const project = this._projects.find((p) => p.id === id)
      if (!project) {
        throw new ApiError(
          404,
          "PROJECT_NOT_FOUND",
          `Project with ID '${id}' was not found.`
        )
      }
      const childServices = this._services.filter((s) => s.project_id === id)
      return {
        ...structuredClone(project),
        services: structuredClone(childServices),
      }
    },

    update: async (
      id: string,
      request: UpdateProjectRequest
    ): Promise<Project> => {
      checkSimulatedError()
      await delay(140)
      const project = this._projects.find((p) => p.id === id)
      if (!project) {
        throw new ApiError(
          404,
          "PROJECT_NOT_FOUND",
          `Project with ID '${id}' was not found.`
        )
      }
      if (request.name !== undefined) project.name = request.name
      if (request.description !== undefined)
        project.description = request.description
      project.updated_at = new Date().toISOString()
      return structuredClone(project)
    },

    delete: async (id: string): Promise<void> => {
      checkSimulatedError()
      await delay(180)
      const projectIndex = this._projects.findIndex((p) => p.id === id)
      if (projectIndex === -1) {
        throw new ApiError(
          404,
          "PROJECT_NOT_FOUND",
          `Project with ID '${id}' was not found.`
        )
      }
      this._projects.splice(projectIndex, 1)
      this._services = this._services.filter((s) => s.project_id !== id)
    },
  }

  // -------------------------------------------------------------------------
  // Services Namespace
  // -------------------------------------------------------------------------
  readonly services = {
    list: async (filter?: ListServicesFilter): Promise<Service[]> => {
      checkSimulatedError()
      await delay(140)
      let result = structuredClone(this._services)
      if (filter?.projectId) {
        result = result.filter((s) => s.project_id === filter.projectId)
      }
      if (filter?.serverId) {
        result = result.filter((s) => s.server_id === filter.serverId)
      }
      if (filter?.parentServiceId !== undefined) {
        result = result.filter(
          (s) => s.parent_service_id === filter.parentServiceId
        )
      }
      return result
    },

    create: async (request: CreateServiceRequest): Promise<Service> => {
      checkSimulatedError()
      await delay(220)
      const newId = `srv_${Date.now().toString(36)}`
      const isAuxiliary =
        request.service_type === "worker" || request.service_type === "cron"
      const isDatabase = request.service_type === "database"
      const engine = request.database_engine || "postgres"
      const version =
        request.database_version ||
        (engine === "mysql"
          ? "8.4"
          : engine === "redis"
            ? "7-alpine"
            : "16-alpine")
      const dbName =
        request.database_name ?? (engine === "redis" ? null : "app_db")
      const dbUser =
        request.database_user ??
        (engine === "mysql" ? "root" : engine === "redis" ? null : "postgres")
      const dbPassword =
        request.database_password ||
        (engine === "redis" ? "mockredispass123" : "mockdbpass123")
      const volName = request.volume_name || `tako_vol_${newId}_data`
      const volMount =
        request.volume_mount_path ||
        (engine === "mysql"
          ? "/var/lib/mysql"
          : engine === "redis"
            ? "/data"
            : "/var/lib/postgresql/data")
      const port =
        request.internal_port ||
        (engine === "mysql" ? 3306 : engine === "redis" ? 6379 : 5432)

      let connUri: string | null = null
      if (isDatabase) {
        if (engine === "postgres") {
          connUri = `postgres://${dbUser}:${dbPassword}@tako-${newId}:5432/${dbName}`
        } else if (engine === "mysql") {
          connUri = `mysql://${dbUser}:${dbPassword}@tako-${newId}:3306/${dbName}`
        } else if (engine === "redis") {
          connUri = `redis://default:${dbPassword}@tako-${newId}:6379`
        }
      }

      const newService: Service = {
        id: newId,
        project_id: request.project_id,
        server_id: request.server_id || "srv_local",
        name: request.name,
        service_type: request.service_type || "web",
        parent_service_id: request.parent_service_id || null,
        command: request.command || null,
        cron_expression: request.cron_expression || null,
        database_engine: isDatabase ? engine : null,
        database_version: isDatabase ? version : null,
        database_name: isDatabase ? dbName : null,
        database_user: isDatabase ? dbUser : null,
        database_password: isDatabase ? dbPassword : null,
        volume_name: isDatabase ? volName : null,
        volume_mount_path: isDatabase ? volMount : null,
        connection_uri: isDatabase ? connUri : null,
        repository: request.repository || "",
        branch: request.branch || "main",
        dockerfile_path: request.dockerfile_path,
        internal_port: port,
        health_check_path: request.health_check_path || "/healthz",
        status: isAuxiliary || isDatabase ? "running" : "stopped",
        primary_domain: null,
        active_deployment_id: null,
        github_connection_id: request.github_connection_id ?? null,
        pre_deploy_command: request.pre_deploy_command ?? null,
        post_deploy_command: request.post_deploy_command ?? null,
        auto_deploy: request.trigger_on_push ?? request.auto_deploy ?? true,
        trigger_on_push: request.trigger_on_push ?? request.auto_deploy ?? true,
        trigger_on_tag: request.trigger_on_tag ?? false,
        tag_pattern: request.tag_pattern ?? "*",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }

      this._services.push(newService)

      const project = this._projects.find((p) => p.id === request.project_id)
      if (project) {
        project.services_count += 1
      }

      return structuredClone(newService)
    },

    get: async (id: string): Promise<ServiceDetail> => {
      checkSimulatedError()
      await delay(120)
      const service = this._services.find((s) => s.id === id)
      if (!service) {
        throw new ApiError(
          404,
          "SERVICE_NOT_FOUND",
          `Service with ID '${id}' was not found.`
        )
      }

      const server =
        this._servers.find((s) => s.id === service.server_id) ||
        this._servers[0]
      const project =
        this._projects.find((p) => p.id === service.project_id) ||
        this._projects[0]
      const domains = this._domains[service.id] || []
      const activeDeployment = service.active_deployment_id
        ? this._deployments.find(
            (d) => d.id === service.active_deployment_id
          ) || null
        : null

      const env = this._serviceEnvs[service.id]
      const envVarsCount =
        (env?.env_vars.length || 0) + (env?.build_args.length || 0)

      return {
        ...structuredClone(service),
        server: structuredClone(server),
        project: structuredClone(project),
        domains: structuredClone(domains),
        active_deployment: activeDeployment
          ? structuredClone(activeDeployment)
          : null,
        env_vars_count: envVarsCount,
      }
    },

    update: async (
      id: string,
      request: UpdateServiceRequest
    ): Promise<Service> => {
      checkSimulatedError()
      await delay(160)
      const service = this._services.find((s) => s.id === id)
      if (!service) {
        throw new ApiError(
          404,
          "SERVICE_NOT_FOUND",
          `Service with ID '${id}' was not found.`
        )
      }

      if (request.name !== undefined) service.name = request.name
      if (request.service_type !== undefined)
        service.service_type = request.service_type
      if (request.branch !== undefined) service.branch = request.branch
      if (request.dockerfile_path !== undefined)
        service.dockerfile_path = request.dockerfile_path
      if (request.internal_port !== undefined)
        service.internal_port = request.internal_port
      if (request.health_check_path !== undefined)
        service.health_check_path = request.health_check_path
      if (request.server_id !== undefined) service.server_id = request.server_id
      if (request.command !== undefined) service.command = request.command
      if (request.cron_expression !== undefined)
        service.cron_expression = request.cron_expression
      if (request.pre_deploy_command !== undefined)
        service.pre_deploy_command = request.pre_deploy_command
      if (request.post_deploy_command !== undefined)
        service.post_deploy_command = request.post_deploy_command
      if (request.github_connection_id !== undefined)
        service.github_connection_id = request.github_connection_id
      if (request.trigger_on_push !== undefined) {
        service.trigger_on_push = request.trigger_on_push
        service.auto_deploy = request.trigger_on_push
      } else if (request.auto_deploy !== undefined) {
        service.auto_deploy = request.auto_deploy
        service.trigger_on_push = request.auto_deploy
      }
      if (request.trigger_on_tag !== undefined)
        service.trigger_on_tag = request.trigger_on_tag
      if (request.tag_pattern !== undefined)
        service.tag_pattern = request.tag_pattern
      service.updated_at = new Date().toISOString()

      return structuredClone(service)
    },

    delete: async (
      id: string,
      options?: { delete_volumes?: boolean; prune_images?: boolean }
    ): Promise<void> => {
      checkSimulatedError()
      await delay(180)
      const serviceIndex = this._services.findIndex((s) => s.id === id)
      if (serviceIndex === -1) {
        throw new ApiError(
          404,
          "SERVICE_NOT_FOUND",
          `Service with ID '${id}' was not found.`
        )
      }

      const service = this._services[serviceIndex]
      this._services.splice(serviceIndex, 1)

      const project = this._projects.find((p) => p.id === service.project_id)
      if (project && project.services_count > 0) {
        project.services_count -= 1
      }

      // Cascade remove child resources
      this._deployments = this._deployments.filter((d) => d.service_id !== id)
      delete this._domains[id]
      delete this._serviceEnvs[id]
      delete this._serviceBackups[id]
    },

    start: async (id: string): Promise<Service> => {
      checkSimulatedError()
      await delay(150)
      const service = this._services.find((s) => s.id === id)
      if (!service)
        throw new ApiError(
          404,
          "SERVICE_NOT_FOUND",
          `Service '${id}' not found.`
        )
      service.status = "running"
      service.updated_at = new Date().toISOString()
      return structuredClone(service)
    },

    stop: async (id: string): Promise<Service> => {
      checkSimulatedError()
      await delay(150)
      const service = this._services.find((s) => s.id === id)
      if (!service)
        throw new ApiError(
          404,
          "SERVICE_NOT_FOUND",
          `Service '${id}' not found.`
        )
      service.status = "stopped"
      service.updated_at = new Date().toISOString()
      return structuredClone(service)
    },

    restart: async (id: string): Promise<Service> => {
      checkSimulatedError()
      await delay(200)
      const service = this._services.find((s) => s.id === id)
      if (!service)
        throw new ApiError(
          404,
          "SERVICE_NOT_FOUND",
          `Service '${id}' not found.`
        )
      service.status = "running"
      service.updated_at = new Date().toISOString()
      return structuredClone(service)
    },

    rebuild: async (
      id: string,
      request?: RebuildRequest
    ): Promise<Deployment> => {
      checkSimulatedError()
      await delay(200)
      const service = this._services.find((s) => s.id === id)
      if (!service)
        throw new ApiError(
          404,
          "SERVICE_NOT_FOUND",
          `Service '${id}' not found.`
        )

      const newDepId = `dep_${Date.now().toString(36)}`
      const newDeployment: Deployment = {
        id: newDepId,
        service_id: id,
        status: "building",
        commit_sha: request?.commit_sha || "latest7",
        commit_message: "Manual rebuild triggered from dashboard",
        commit_author: "Admin Owner",
        branch: request?.branch || service.branch,
        image_tag: `tako-app-${service.id}:${newDepId}`,
        started_at: new Date().toISOString(),
        finished_at: null,
        duration_seconds: null,
        created_at: new Date().toISOString(),
      }

      this._deployments.unshift(newDeployment)
      service.status = "building"
      service.active_deployment_id = newDepId
      return structuredClone(newDeployment)
    },

    redeploy: async (id: string): Promise<Deployment> => {
      checkSimulatedError()
      await delay(200)
      const service = this._services.find((s) => s.id === id)
      if (!service)
        throw new ApiError(
          404,
          "SERVICE_NOT_FOUND",
          `Service '${id}' not found.`
        )

      const newDepId = `dep_${Date.now().toString(36)}`
      const newDeployment: Deployment = {
        id: newDepId,
        service_id: id,
        status: "building",
        commit_sha: "head9a1",
        commit_message: "Automated redeploy triggered from dashboard",
        commit_author: "Admin Owner",
        branch: service.branch || "main",
        image_tag: `tako-app-${service.id}:${newDepId}`,
        started_at: new Date().toISOString(),
        finished_at: null,
        duration_seconds: null,
        created_at: new Date().toISOString(),
      }

      this._deployments.unshift(newDeployment)
      service.status = "building"
      service.active_deployment_id = newDepId
      return structuredClone(newDeployment)
    },

    pullUpdate: async (id: string): Promise<PullUpdateResponse> => {
      checkSimulatedError()
      await delay(250)
      const service = this._services.find((s) => s.id === id)
      if (!service)
        throw new ApiError(
          404,
          "SERVICE_NOT_FOUND",
          `Service '${id}' not found.`
        )

      service.status = "running"
      service.updated_at = new Date().toISOString()

      return {
        updated: true,
        message: "Container recreated with latest image digest",
        image_digest: `sha256:${Date.now().toString(16)}0000000000000000000000000000000000000000000000000000`,
      }
    },

    listDeployments: async (
      serviceId: string,
      query?: ListDeploymentsQuery
    ): Promise<DeploymentListResponse> => {
      checkSimulatedError()
      await delay(130)
      const filtered = this._deployments.filter(
        (d) => d.service_id === serviceId
      )
      const page = query?.page || 1
      const limit = query?.limit || 10
      const startIndex = (page - 1) * limit
      const items = filtered.slice(startIndex, startIndex + limit)

      return {
        items: structuredClone(items),
        total: filtered.length,
        page,
        limit,
      }
    },

    createDeployment: async (
      serviceId: string,
      request?: CreateDeploymentRequest
    ): Promise<Deployment> => {
      checkSimulatedError()
      await delay(200)
      const service = this._services.find((s) => s.id === serviceId)
      if (!service)
        throw new ApiError(
          404,
          "SERVICE_NOT_FOUND",
          `Service '${serviceId}' not found.`
        )

      const newDepId = `dep_${Date.now().toString(36)}`
      const env = this._serviceEnvs[serviceId]
      const newDeployment: Deployment = {
        id: newDepId,
        service_id: serviceId,
        status: "queued",
        commit_sha: request?.commit_sha || "head001",
        commit_message: "Manual deployment dispatched",
        commit_author: "Admin Owner",
        branch: request?.branch || service.branch,
        image_tag: `tako-app-${service.id}:${newDepId}`,
        started_at: null,
        finished_at: null,
        duration_seconds: null,
        created_at: new Date().toISOString(),
        env_snapshot: env ? structuredClone(env.env_vars) : [],
      }

      this._deployments.unshift(newDeployment)
      return structuredClone(newDeployment)
    },

    getDeployment: async (
      serviceId: string,
      deploymentId: string
    ): Promise<DeploymentDetail> => {
      checkSimulatedError()
      await delay(120)
      const detail = this._deploymentDetails[deploymentId]
      if (detail) {
        return structuredClone(detail)
      }

      const dep = this._deployments.find(
        (d) => d.id === deploymentId && d.service_id === serviceId
      )
      if (!dep) {
        throw new ApiError(
          404,
          "DEPLOYMENT_NOT_FOUND",
          `Deployment '${deploymentId}' was not found.`
        )
      }

      return {
        ...structuredClone(dep),
        build_steps: [
          {
            event: "build_step",
            step: "1/3",
            title: "Git clone repository",
            status: "success",
            duration_seconds: 3,
          },
          {
            event: "build_step",
            step: "2/3",
            title: "Docker build container image",
            status: "success",
            duration_seconds: 40,
          },
          {
            event: "build_step",
            step: "3/3",
            title: "Verify container health check",
            status: "success",
            duration_seconds: 5,
          },
        ],
        error_trace: null,
      }
    },

    cancelDeployment: async (
      serviceId: string,
      deploymentId: string
    ): Promise<Deployment> => {
      checkSimulatedError()
      await delay(150)
      const dep = this._deployments.find(
        (d) => d.id === deploymentId && d.service_id === serviceId
      )
      if (!dep)
        throw new ApiError(
          404,
          "DEPLOYMENT_NOT_FOUND",
          `Deployment '${deploymentId}' not found.`
        )
      dep.status = "cancelled"
      return structuredClone(dep)
    },

    rollbackDeployment: async (
      serviceId: string,
      deploymentId: string
    ): Promise<Deployment> => {
      checkSimulatedError()
      await delay(200)
      const targetDep = this._deployments.find(
        (d) => d.id === deploymentId && d.service_id === serviceId
      )
      if (!targetDep)
        throw new ApiError(
          404,
          "DEPLOYMENT_NOT_FOUND",
          `Target deployment '${deploymentId}' not found.`
        )

      const newDepId = `dep_rb_${Date.now().toString(36)}`
      const rollbackDep: Deployment = {
        id: newDepId,
        service_id: serviceId,
        status: "success",
        commit_sha: targetDep.commit_sha,
        commit_message: `Rollback to deployment ${deploymentId} (${targetDep.commit_sha})`,
        commit_author: "Admin Owner",
        branch: targetDep.branch,
        image_tag: targetDep.image_tag,
        started_at: new Date().toISOString(),
        finished_at: new Date(Date.now() + 4000).toISOString(),
        duration_seconds: 4,
        created_at: new Date().toISOString(),
      }

      this._deployments.unshift(rollbackDep)
      const service = this._services.find((s) => s.id === serviceId)
      if (service) {
        service.active_deployment_id = newDepId
        service.status = "running"
      }

      return structuredClone(rollbackDep)
    },

    listPreviews: async (serviceId: string): Promise<PreviewEnvironment[]> => {
      checkSimulatedError()
      await delay(100)
      const items = this._previews.filter((p) => p.service_id === serviceId)
      return structuredClone(items)
    },

    deletePreview: async (
      serviceId: string,
      previewId: string
    ): Promise<{ success: boolean; message: string }> => {
      checkSimulatedError()
      await delay(150)
      const idx = this._previews.findIndex(
        (p) => p.id === previewId && p.service_id === serviceId
      )
      if (idx === -1) {
        throw new ApiError(
          404,
          "NOT_FOUND",
          `Preview '${previewId}' not found.`
        )
      }
      this._previews.splice(idx, 1)
      return {
        success: true,
        message: "Preview environment deleted successfully",
      }
    },

    getEnv: async (serviceId: string): Promise<ServiceEnv> => {
      checkSimulatedError()
      await delay(120)
      const env = this._serviceEnvs[serviceId]
      if (!env) {
        return { env_vars: [], build_args: [] }
      }
      return structuredClone(env)
    },

    updateEnv: async (
      serviceId: string,
      request: UpdateServiceEnvRequest
    ): Promise<ServiceEnv> => {
      checkSimulatedError()
      await delay(180)
      const updatedEnv: ServiceEnv = {
        env_vars: request.env_vars.map((v) => ({
          ...v,
          is_secret: v.is_secret ?? false,
        })),
        build_args: request.build_args.map((v) => ({
          ...v,
          is_secret: v.is_secret ?? false,
        })),
      }
      this._serviceEnvs[serviceId] = updatedEnv
      return structuredClone(updatedEnv)
    },

    injectConnectionString: async (
      serviceId: string,
      request: InjectConnectionStringRequest
    ): Promise<InjectConnectionStringResponse> => {
      checkSimulatedError()
      await delay(150)
      const dbService = this._services.find((s) => s.id === serviceId)
      if (!dbService) {
        throw new ApiError(404, "NOT_FOUND", "Service not found")
      }
      if (!dbService.connection_uri) {
        throw new ApiError(
          400,
          "BAD_REQUEST",
          "Service does not have a connection URI"
        )
      }
      const targetService = this._services.find(
        (s) => s.id === request.target_service_id
      )
      if (!targetService) {
        throw new ApiError(404, "NOT_FOUND", "Target service not found")
      }
      if (targetService.project_id !== dbService.project_id) {
        throw new ApiError(
          400,
          "BAD_REQUEST",
          "Target service must belong to the same project"
        )
      }
      const envKey =
        request.env_key ||
        (dbService.database_engine === "redis" ? "REDIS_URL" : "DATABASE_URL")
      if (!this._serviceEnvs[targetService.id]) {
        this._serviceEnvs[targetService.id] = { env_vars: [], build_args: [] }
      }
      const existing = this._serviceEnvs[targetService.id].env_vars.find(
        (v) => v.key === envKey
      )
      if (existing) {
        existing.value = dbService.connection_uri
        existing.is_secret = true
      } else {
        this._serviceEnvs[targetService.id].env_vars.push({
          key: envKey,
          value: dbService.connection_uri,
          is_secret: true,
        })
      }
      return {
        success: true,
        target_service_id: targetService.id,
        env_key: envKey,
        message: "Connection string injected successfully",
      }
    },

    listDomains: async (serviceId: string): Promise<Domain[]> => {
      checkSimulatedError()
      await delay(110)
      const domains = this._domains[serviceId] || []
      return structuredClone(domains)
    },

    addDomain: async (
      serviceId: string,
      request: AddDomainRequest
    ): Promise<Domain> => {
      checkSimulatedError()
      await delay(180)
      const targetServiceId = request.service_id || serviceId
      const targetService = this._services.find((s) => s.id === targetServiceId)
      const existingList = this._domains[targetServiceId] || []
      const isCanonical = request.is_canonical ?? existingList.length === 0

      if (isCanonical && this._domains[targetServiceId]) {
        for (const d of this._domains[targetServiceId]) {
          d.is_canonical = false
        }
      }

      const newDomain: Domain = {
        id: `dom_${Date.now().toString(36)}`,
        service_id: targetServiceId,
        service_name: targetService ? targetService.name : null,
        domain: request.domain,
        port: request.port || targetService?.internal_port || 3000,
        path_prefix: request.path_prefix || "",
        strip_prefix: request.strip_prefix ?? false,
        is_canonical: isCanonical,
        redirect_mode: request.redirect_mode || "none",
        auth_enabled: request.auth_enabled ?? false,
        auth_user: request.auth_user || "",
        entrypoints: request.entrypoints || "web,websecure",
        ssl_resolver: request.ssl_resolver || "letsencrypt",
        ssl_status: "pending",
        ssl_error: null,
        created_at: new Date().toISOString(),
      }

      if (!this._domains[targetServiceId]) {
        this._domains[targetServiceId] = []
      }
      this._domains[targetServiceId].push(newDomain)
      return structuredClone(newDomain)
    },

    updateDomain: async (
      serviceId: string,
      domainName: string,
      request: UpdateDomainRequest
    ): Promise<Domain> => {
      checkSimulatedError()
      await delay(150)
      const domainList = this._domains[serviceId] || []
      const item = domainList.find(
        (d) => d.domain === domainName || d.id === domainName
      )
      if (!item) {
        throw new ApiError(
          404,
          "DOMAIN_NOT_FOUND",
          `Domain '${domainName}' not found for service '${serviceId}'.`
        )
      }

      if (
        request.service_id !== undefined &&
        request.service_id !== serviceId
      ) {
        this._domains[serviceId] = this._domains[serviceId].filter(
          (d) => d.id !== item.id
        )
        item.service_id = request.service_id
        const targetSvc = this._services.find(
          (s) => s.id === request.service_id
        )
        item.service_name = targetSvc ? targetSvc.name : null
        if (!this._domains[request.service_id]) {
          this._domains[request.service_id] = []
        }
        this._domains[request.service_id].push(item)
      }

      if (request.port !== undefined) item.port = request.port
      if (request.path_prefix !== undefined)
        item.path_prefix = request.path_prefix
      if (request.strip_prefix !== undefined)
        item.strip_prefix = request.strip_prefix
      if (request.redirect_mode !== undefined)
        item.redirect_mode = request.redirect_mode
      if (request.auth_enabled !== undefined)
        item.auth_enabled = request.auth_enabled
      if (request.auth_user !== undefined) item.auth_user = request.auth_user
      if (request.entrypoints !== undefined)
        item.entrypoints = request.entrypoints
      if (request.ssl_resolver !== undefined)
        item.ssl_resolver = request.ssl_resolver

      if (request.is_canonical) {
        const list = this._domains[item.service_id] || []
        for (const d of list) {
          d.is_canonical = false
        }
        item.is_canonical = true
      } else if (request.is_canonical === false) {
        item.is_canonical = false
      }

      return structuredClone(item)
    },

    deleteDomain: async (
      serviceId: string,
      domainName: string
    ): Promise<void> => {
      checkSimulatedError()
      await delay(140)
      if (this._domains[serviceId]) {
        this._domains[serviceId] = this._domains[serviceId].filter(
          (d) => d.domain !== domainName
        )
      }
    },

    checkDomainSsl: async (
      serviceId: string,
      domainName: string
    ): Promise<Domain> => {
      checkSimulatedError()
      await delay(250)
      const domainList = this._domains[serviceId] || []
      const item = domainList.find((d) => d.domain === domainName)
      if (!item) {
        throw new ApiError(
          404,
          "DOMAIN_NOT_FOUND",
          `Domain '${domainName}' not found for service '${serviceId}'.`
        )
      }
      item.ssl_status = "active"
      item.ssl_error = null
      return structuredClone(item)
    },

    validateCompose: async (
      request: ValidateComposeRequest
    ): Promise<ValidateComposeResponse> => {
      checkSimulatedError()
      await delay(100)
      const content = request.compose_content
      if (!content || !content.includes("services:")) {
        return {
          valid: false,
          errors: ["Missing top-level 'services' section"],
          services: [],
        }
      }
      return {
        valid: true,
        errors: [],
        services: [
          {
            name: "web",
            image: "nginx:alpine",
            ports: ["80:80"],
            depends_on: ["db"],
          },
          {
            name: "db",
            image: "postgres:16-alpine",
            ports: ["5432:5432"],
            depends_on: [],
          },
        ],
      }
    },

    getStackOverview: async (
      serviceId: string
    ): Promise<ComposeStackOverview> => {
      checkSimulatedError()
      await delay(100)
      const svc = this._services.find((s) => s.id === serviceId)
      if (!svc) {
        throw new ApiError(404, "NOT_FOUND", "Service not found")
      }
      return {
        service_id: serviceId,
        project_id: svc.project_id,
        network_name: `tako_compose_${svc.project_id}`,
        sub_services: [
          {
            name: "web",
            container_id: `cid_tako_${serviceId}_web`,
            container_name: `tako-${serviceId}-web`,
            image: "nginx:alpine",
            status: "running",
            ports: ["80:80"],
            depends_on: ["db"],
            ip_address: "172.28.0.3",
            cpu_percent: 0.8,
            memory_bytes: 42000000,
          },
          {
            name: "db",
            container_id: `cid_tako_${serviceId}_db`,
            container_name: `tako-${serviceId}-db`,
            image: "postgres:16-alpine",
            status: "running",
            ports: ["5432:5432"],
            depends_on: [],
            ip_address: "172.28.0.2",
            cpu_percent: 1.2,
            memory_bytes: 128000000,
          },
        ],
      }
    },

    // -------------------------------------------------------------------------
    // SSE Async Generators
    // -------------------------------------------------------------------------
    async *streamBuildLogs(
      _serviceId: string,
      _deploymentId: string
    ): AsyncIterable<BuildLogStreamEvent> {
      for (const logItem of mockBuildLogs) {
        await delay(120)
        yield logItem
      }
    },

    async *streamContainerLogs(
      _serviceId: string,
      options?: ContainerLogsOptions
    ): AsyncIterable<ContainerLogEvent> {
      let logs = options?.tail
        ? mockContainerLogs.slice(-options.tail)
        : mockContainerLogs
      if (options?.container) {
        logs = logs.filter(
          (l) => !l.container_name || l.container_name === options.container
        )
      }
      for (const logLine of logs) {
        await delay(30)
        yield logLine
      }
    },

    async *streamStatus(serviceId: string): AsyncIterable<ServiceStatusEvent> {
      const transitions: Array<ServiceStatusEvent["status"]> = [
        "building",
        "running",
        "running",
      ]
      for (const status of transitions) {
        await delay(300)
        yield {
          service_id: serviceId,
          status,
          active_deployment_id: "dep_001",
          uptime_seconds: 3600,
        }
      }
    },

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

    getMetrics: async (
      serviceId: string,
      range: MetricsRange = "1h"
    ): Promise<ServiceMetricsResponse> => {
      checkSimulatedError()
      await delay(120)

      const srv = this._services.find((s) => s.id === serviceId)
      if (!srv) {
        throw new ApiError(
          404,
          "SERVICE_NOT_FOUND",
          `Service '${serviceId}' not found.`
        )
      }

      // Generate points based on requested range
      const now = Date.now()
      let count = 60
      let stepMs = 60 * 1000
      if (range === "6h") {
        count = 72
        stepMs = 5 * 60 * 1000
      } else if (range === "24h") {
        count = 96
        stepMs = 15 * 60 * 1000
      } else if (range === "7d") {
        count = 84
        stepMs = 2 * 3600 * 1000
      }

      const isRunning = srv.status === "running"
      const baseCpu = isRunning ? 2.2 : 0
      const baseMem = isRunning ? 148 * 1024 * 1024 : 0
      const memLimit = 1024 * 1024 * 1024

      const points: ServiceMetricPoint[] = []
      let cumRx = 50 * 1024 * 1024
      let cumTx = 22 * 1024 * 1024

      for (let i = count - 1; i >= 0; i--) {
        const pointTime = now - i * stepMs
        const ts = new Date(pointTime).toISOString()
        const timePhase = pointTime / 60000

        const noiseCpu = isRunning
          ? Math.sin(timePhase / 2) * 1.4 +
            Math.cos(timePhase / 3.7) * 0.8 +
            Math.sin(timePhase * 1.5) * 0.4
          : 0
        const cpuPercent = Math.max(
          0.1,
          Math.round((baseCpu + noiseCpu) * 100) / 100
        )

        const noiseMem = isRunning
          ? Math.round(
              (Math.sin(timePhase / 5) * 12 + Math.cos(timePhase / 9) * 6) *
                1024 *
                1024
            )
          : 0
        const memoryBytes = Math.max(baseMem / 2, baseMem + noiseMem)

        const rxRate = isRunning
          ? Math.max(
              512,
              Math.round(
                1024 * 12 +
                  Math.sin(timePhase / 3) * 5120 +
                  Math.cos(timePhase) * 2048
              )
            )
          : 0
        const txRate = isRunning
          ? Math.max(
              256,
              Math.round(
                1024 * 5 +
                  Math.cos(timePhase / 4) * 2560 +
                  Math.sin(timePhase) * 1024
              )
            )
          : 0
        cumRx += rxRate * (stepMs / 1000)
        cumTx += txRate * (stepMs / 1000)

        points.push({
          timestamp: ts,
          cpu_percent: cpuPercent,
          memory_bytes: memoryBytes,
          memory_limit_bytes: memLimit,
          network_rx_bytes: cumRx,
          network_tx_bytes: cumTx,
          network_rx_rate: rxRate,
          network_tx_rate: txRate,
          restart_count: 0,
        })
      }

      const latest = points[points.length - 1]
      return {
        service_id: serviceId,
        range,
        current: {
          cpu_percent: latest.cpu_percent,
          memory_bytes: latest.memory_bytes,
          memory_limit_bytes: latest.memory_limit_bytes,
          network_rx_bytes: latest.network_rx_bytes,
          network_tx_bytes: latest.network_tx_bytes,
          network_rx_rate: latest.network_rx_rate,
          network_tx_rate: latest.network_tx_rate,
          restart_count: latest.restart_count,
        },
        points,
      }
    },
  }

  // -------------------------------------------------------------------------
  // GitHub Namespace
  // -------------------------------------------------------------------------
  readonly github = {
    getStatus: async (): Promise<GitHubStatus> => {
      checkSimulatedError()
      await delay(110)
      return {
        connected: true,
        username: "octocat",
        avatar_url: "https://avatars.githubusercontent.com/u/583231",
        app_installed: true,
      }
    },

    listRepos: async (): Promise<GitHubRepo[]> => {
      checkSimulatedError()
      await delay(160)
      return [
        {
          id: 101,
          name: "web-frontend",
          full_name: "acme/web-frontend",
          private: true,
          default_branch: "main",
          html_url: "https://github.com/acme/web-frontend",
        },
        {
          id: 102,
          name: "api-core",
          full_name: "acme/api-core",
          private: true,
          default_branch: "main",
          html_url: "https://github.com/acme/api-core",
        },
        {
          id: 103,
          name: "storefront-next",
          full_name: "hypermarket/storefront-next",
          private: true,
          default_branch: "release-v2",
          html_url: "https://github.com/hypermarket/storefront-next",
        },
        {
          id: 104,
          name: "personal-blog",
          full_name: "johndoe/personal-blog",
          private: false,
          default_branch: "master",
          html_url: "https://github.com/johndoe/personal-blog",
        },
      ]
    },

    listBranches: async (
      _owner: string,
      _repo: string
    ): Promise<GitHubBranch[]> => {
      checkSimulatedError()
      await delay(130)
      return [
        {
          name: "main",
          commit_sha: "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0",
          protected: true,
        },
        {
          name: "staging",
          commit_sha: "7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f",
          protected: false,
        },
        {
          name: "feature/auth",
          commit_sha: "b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3",
          protected: false,
        },
      ]
    },

    handleWebhook: async (): Promise<WebhookResponse> => {
      checkSimulatedError()
      await delay(100)
      return {
        received: true,
        deployment_triggered: true,
        service_id: "srv_web_prod",
      }
    },

    listConnections: async (): Promise<GitHubConnection[]> => {
      checkSimulatedError()
      await delay(120)
      return this._githubConnections.map((conn) => ({
        ...conn,
        service_count: this._services.filter(
          (s) => s.github_connection_id === conn.id
        ).length,
      }))
    },

    createConnection: async (
      request: CreateGitHubConnectionRequest
    ): Promise<GitHubConnection> => {
      checkSimulatedError()
      await delay(180)
      const newId = `ghc_${Date.now().toString(36)}`
      const newConn: GitHubConnection = {
        id: newId,
        name: request.name,
        auth_type: request.auth_type,
        account_name:
          request.account_name ||
          (request.auth_type === "pat" ? "custom-pat-user" : "custom-app-org"),
        avatar_url: "https://avatars.githubusercontent.com/u/583231",
        app_id: request.app_id ?? null,
        installation_id: request.installation_id ?? null,
        service_count: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
      this._githubConnections.push(newConn)
      return structuredClone(newConn)
    },

    deleteConnection: async (id: string): Promise<void> => {
      checkSimulatedError()
      await delay(150)
      const activeServices = this._services.filter(
        (s) => s.github_connection_id === id
      )
      if (activeServices.length > 0) {
        const names = activeServices.map((s) => s.name).join(", ")
        throw new ApiError(
          409,
          "CONNECTION_IN_USE",
          `Cannot delete GitHub connection '${id}' because it is in use by ${activeServices.length} service(s): ${names}. Reassign or delete these services first.`
        )
      }
      const idx = this._githubConnections.findIndex((c) => c.id === id)
      if (idx === -1) {
        throw new ApiError(
          404,
          "NOT_FOUND",
          `GitHub connection '${id}' not found`
        )
      }
      this._githubConnections.splice(idx, 1)
    },

    getManifest: async (params?: {
      origin?: string
    }): Promise<GitHubManifestResponse> => {
      checkSimulatedError()
      await delay(100)
      const baseOrigin = params?.origin || "http://localhost:3000"
      return {
        action_url: "https://github.com/settings/apps/new",
        manifest: {
          name: "tako-mock-app",
          url: baseOrigin,
          hook_attributes: {
            url: `${baseOrigin}/api/github/webhook`,
            active: true,
          },
          redirect_url: `${baseOrigin}/settings/github/callback`,
          public: true,
          default_permissions: {
            contents: "read",
            metadata: "read",
            pull_requests: "write",
            statuses: "write",
          },
          default_events: ["push", "pull_request"],
        },
      }
    },

    exchangeManifest: async (
      request: GitHubAppExchangeRequest
    ): Promise<GitHubAppExchangeResponse> => {
      checkSimulatedError()
      await delay(200)
      const newId = `ghc_app_${Date.now().toString(36)}`
      const newConn: GitHubConnection = {
        id: newId,
        name: request.name || "octopy (Organization)",
        auth_type: "app",
        account_name: "octopy",
        avatar_url: "https://avatars.githubusercontent.com/u/583231",
        app_id: "987654",
        app_slug: "tako-deployer-mock",
        installation_id: "12345678",
        service_count: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
      this._githubConnections.push(newConn)
      return {
        connection_id: newId,
        app_id: "987654",
        app_slug: "tako-deployer-mock",
        install_url:
          "https://github.com/apps/tako-deployer-mock/installations/new",
      }
    },

    syncInstallations: async (): Promise<GitHubConnection[]> => {
      checkSimulatedError()
      await delay(200)
      if (!this._githubConnections.some((c) => c.account_name === "octopy")) {
        this._githubConnections.push({
          id: "ghc_octopy",
          name: "octopy (Organization)",
          auth_type: "app",
          account_name: "octopy",
          avatar_url: "https://avatars.githubusercontent.com/u/583231",
          app_id: "987654",
          app_slug: "tako-deployer-mock",
          installation_id: "12345678",
          service_count: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
      }
      return this._githubConnections.map((conn) => ({
        ...conn,
        service_count: this._services.filter(
          (s) => s.github_connection_id === conn.id
        ).length,
      }))
    },

    listConnectionRepos: async (
      connectionId: string
    ): Promise<GitHubRepo[]> => {
      checkSimulatedError()
      await delay(160)
      const conn = this._githubConnections.find((c) => c.id === connectionId)
      const prefix = conn?.account_name ?? "acme"
      return [
        {
          id: 101,
          name: "web-frontend",
          full_name: `${prefix}/web-frontend`,
          private: true,
          default_branch: "main",
          html_url: `https://github.com/${prefix}/web-frontend`,
        },
        {
          id: 102,
          name: "api-core",
          full_name: `${prefix}/api-core`,
          private: true,
          default_branch: "main",
          html_url: `https://github.com/${prefix}/api-core`,
        },
        {
          id: 103,
          name: "worker-service",
          full_name: `${prefix}/worker-service`,
          private: false,
          default_branch: "main",
          html_url: `https://github.com/${prefix}/worker-service`,
        },
      ]
    },

    listConnectionBranches: async (
      _connectionId: string,
      _owner: string,
      _repo: string
    ): Promise<GitHubBranch[]> => {
      checkSimulatedError()
      await delay(130)
      return [
        {
          name: "main",
          commit_sha: "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0",
          protected: true,
        },
        {
          name: "staging",
          commit_sha: "7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f",
          protected: false,
        },
        {
          name: "develop",
          commit_sha: "b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3",
          protected: false,
        },
      ]
    },
  }

  readonly backups = {
    getConfig: async (): Promise<BackupConfig> => {
      checkSimulatedError()
      await delay(100)
      return structuredClone(this._backupConfig)
    },

    updateConfig: async (
      request: UpdateBackupConfigRequest
    ): Promise<BackupConfig> => {
      checkSimulatedError()
      await delay(150)
      this._backupConfig = {
        ...this._backupConfig,
        ...(request.enabled !== undefined ? { enabled: request.enabled } : {}),
        ...(request.s3_destination_id !== undefined
          ? { s3_destination_id: request.s3_destination_id }
          : {}),
        ...(request.endpoint_url !== undefined
          ? { endpoint_url: request.endpoint_url }
          : {}),
        ...(request.bucket !== undefined ? { bucket: request.bucket } : {}),
        ...(request.region !== undefined ? { region: request.region } : {}),
        ...(request.access_key !== undefined
          ? { access_key: request.access_key }
          : {}),
        ...(request.secret_key ? { has_secret_key: true } : {}),
        ...(request.cron_expression !== undefined
          ? { cron_expression: request.cron_expression }
          : {}),
        ...(request.retention_count !== undefined
          ? { retention_count: request.retention_count }
          : {}),
        updated_at: new Date().toISOString(),
      }
      return structuredClone(this._backupConfig)
    },

    testStorage: async (): Promise<SuccessResponse> => {
      checkSimulatedError()
      await delay(200)
      return {
        success: true,
        message: "S3 connection verified successfully.",
      }
    },

    listControlPlaneBackups: async (): Promise<BackupRecord[]> => {
      checkSimulatedError()
      await delay(100)
      return structuredClone(this._controlPlaneBackups)
    },

    triggerControlPlaneBackup: async (): Promise<BackupRecord> => {
      checkSimulatedError()
      await delay(300)
      const now = new Date()
      const timeStr = now.toISOString().replace(/[-:T]/g, "").slice(0, 15)
      const newRecord: BackupRecord = {
        id: `bkp_cp_${Date.now().toString(36)}`,
        service_id: null,
        server_id: null,
        backup_type: "control_plane",
        database_engine: "sqlite",
        status: "completed",
        file_name: `tako-control-plane-${timeStr}.db.gz`,
        s3_key: `backups/control-plane/tako-control-plane-${timeStr}.db.gz`,
        file_size_bytes: 4325376,
        error_message: null,
        download_url: `https://mock-s3.example.com/backups/control-plane/tako-control-plane-${timeStr}.db.gz`,
        created_at: now.toISOString(),
        completed_at: new Date(now.getTime() + 4000).toISOString(),
      }
      this._controlPlaneBackups.unshift(newRecord)
      return structuredClone(newRecord)
    },

    downloadControlPlaneBackup: async (
      _id: string
    ): Promise<DownloadBackupResponse> => {
      checkSimulatedError()
      await delay(100)
      return {
        download_url:
          "https://mock-s3.example.com/download/control-plane-snapshot.db.gz",
      }
    },

    deleteControlPlaneBackup: async (id: string): Promise<SuccessResponse> => {
      checkSimulatedError()
      await delay(100)
      this._controlPlaneBackups = this._controlPlaneBackups.filter(
        (b) => b.id !== id
      )
      return {
        success: true,
        message: "Backup deleted successfully.",
      }
    },

    listServiceBackups: async (serviceId: string): Promise<BackupRecord[]> => {
      checkSimulatedError()
      await delay(100)
      if (!this._serviceBackups[serviceId]) {
        // Pre-populate with initial demo backups for postgres/mysql/redis services
        const now = new Date()
        const defaultDest =
          this._s3Destinations.find((d) => d.is_default) ||
          this._s3Destinations[0]
        this._serviceBackups[serviceId] = [
          {
            id: `bkp_${serviceId}_1`,
            service_id: serviceId,
            server_id: "srv_local",
            backup_type: "database",
            database_engine: "postgres",
            status: "completed",
            file_name: `db-${serviceId}-20260928.dump.gz`,
            s3_key: `backups/services/${serviceId}/db-${serviceId}-20260928.dump.gz`,
            file_size_bytes: 12582912,
            s3_destination_id: defaultDest?.id ?? null,
            s3_destination_name: defaultDest?.name ?? "Primary S3",
            error_message: null,
            download_url: `https://mock-s3.example.com/backups/services/${serviceId}/db-${serviceId}-20260928.dump.gz`,
            created_at: new Date(now.getTime() - 86400000).toISOString(),
            completed_at: new Date(now.getTime() - 86390000).toISOString(),
          },
        ]
      }
      return structuredClone(this._serviceBackups[serviceId])
    },

    triggerServiceBackup: async (
      serviceId: string,
      request?: TriggerBackupRequest
    ): Promise<BackupRecord> => {
      checkSimulatedError()
      await delay(250)
      const now = new Date()
      const timeStr = now.toISOString().replace(/[-:T]/g, "").slice(0, 15)
      const bType = request?.backup_type || "database"
      const ext = bType === "volume" ? "tar.gz" : "dump.gz"

      let targetDest =
        this._s3Destinations.find((d) => d.is_default) ||
        this._s3Destinations[0]
      if (request?.s3_destination_id) {
        const found = this._s3Destinations.find(
          (d) => d.id === request.s3_destination_id
        )
        if (found) targetDest = found
      } else if (this._serviceSchedules[serviceId]?.s3_destination_id) {
        const schedDest = this._s3Destinations.find(
          (d) => d.id === this._serviceSchedules[serviceId].s3_destination_id
        )
        if (schedDest) targetDest = schedDest
      }

      const newRecord: BackupRecord = {
        id: `bkp_${serviceId}_${Date.now().toString(36)}`,
        service_id: serviceId,
        server_id: "srv_local",
        backup_type: bType,
        database_engine: "postgres",
        status: "completed",
        file_name: `service-${serviceId}-${timeStr}.${ext}`,
        s3_key: `backups/services/${serviceId}/service-${serviceId}-${timeStr}.${ext}`,
        file_size_bytes: 14680064,
        s3_destination_id: targetDest?.id ?? null,
        s3_destination_name: targetDest?.name ?? "Primary S3",
        error_message: null,
        download_url: `https://mock-s3.example.com/backups/services/${serviceId}/service-${serviceId}-${timeStr}.${ext}`,
        created_at: now.toISOString(),
        completed_at: new Date(now.getTime() + 5000).toISOString(),
      }
      if (!this._serviceBackups[serviceId]) {
        this._serviceBackups[serviceId] = []
      }
      this._serviceBackups[serviceId].unshift(newRecord)
      return structuredClone(newRecord)
    },

    getServiceBackupSchedule: async (
      serviceId: string
    ): Promise<ServiceBackupSchedule> => {
      checkSimulatedError()
      await delay(100)
      if (!this._serviceSchedules[serviceId]) {
        const defaultDest =
          this._s3Destinations.find((d) => d.is_default) ||
          this._s3Destinations[0]
        const now = new Date().toISOString()
        this._serviceSchedules[serviceId] = {
          id: `sched_${serviceId}`,
          service_id: serviceId,
          enabled: false,
          s3_destination_id: defaultDest?.id ?? null,
          s3_destination_name: defaultDest?.name ?? null,
          cron_expression: "0 2 * * *",
          retention_count: 7,
          created_at: now,
          updated_at: now,
        }
      }
      return structuredClone(this._serviceSchedules[serviceId])
    },

    updateServiceBackupSchedule: async (
      serviceId: string,
      req: UpdateBackupScheduleRequest
    ): Promise<ServiceBackupSchedule> => {
      checkSimulatedError()
      await delay(150)
      const current = await this.backups.getServiceBackupSchedule(serviceId)
      let destName = current.s3_destination_name
      if (req.s3_destination_id !== undefined) {
        const found = this._s3Destinations.find(
          (d) => d.id === req.s3_destination_id
        )
        destName = found ? found.name : null
      }
      const updated: ServiceBackupSchedule = {
        ...current,
        enabled: req.enabled !== undefined ? req.enabled : current.enabled,
        s3_destination_id:
          req.s3_destination_id !== undefined
            ? req.s3_destination_id
            : current.s3_destination_id,
        s3_destination_name: destName,
        cron_expression:
          req.cron_expression !== undefined
            ? req.cron_expression
            : current.cron_expression,
        retention_count:
          req.retention_count !== undefined
            ? req.retention_count
            : current.retention_count,
        updated_at: new Date().toISOString(),
      }
      this._serviceSchedules[serviceId] = updated
      return structuredClone(updated)
    },

    downloadServiceBackup: async (
      serviceId: string,
      backupId: string
    ): Promise<DownloadBackupResponse> => {
      checkSimulatedError()
      await delay(100)
      return {
        download_url: `https://mock-s3.example.com/download/services/${serviceId}/${backupId}.dump.gz`,
      }
    },

    restoreServiceBackup: async (
      _serviceId: string,
      _backupId: string
    ): Promise<SuccessResponse> => {
      checkSimulatedError()
      await delay(400)
      return {
        success: true,
        message: "Database restore completed successfully.",
      }
    },

    deleteServiceBackup: async (
      serviceId: string,
      backupId: string
    ): Promise<SuccessResponse> => {
      checkSimulatedError()
      await delay(100)
      if (this._serviceBackups[serviceId]) {
        this._serviceBackups[serviceId] = this._serviceBackups[
          serviceId
        ].filter((b) => b.id !== backupId)
      }
      return {
        success: true,
        message: "Backup deleted successfully.",
      }
    },
  }

  notifications = {
    list: async (): Promise<NotificationChannel[]> => {
      checkSimulatedError()
      await delay(100)
      return structuredClone(this._notificationChannels)
    },

    create: async (
      request: CreateNotificationChannelRequest
    ): Promise<NotificationChannel> => {
      checkSimulatedError()
      await delay(150)
      if (!request.name?.trim()) {
        throw new ApiError(400, "BAD_REQUEST", "name is required")
      }
      if (request.type !== "discord" && request.type !== "telegram") {
        throw new ApiError(
          400,
          "BAD_REQUEST",
          "type must be discord or telegram"
        )
      }
      if (request.type === "discord" && !request.webhook_url?.trim()) {
        throw new ApiError(
          400,
          "BAD_REQUEST",
          "webhook_url is required for Discord channels"
        )
      }
      if (
        request.type === "telegram" &&
        (!request.bot_token?.trim() || !request.chat_id?.trim())
      ) {
        throw new ApiError(
          400,
          "BAD_REQUEST",
          "bot_token and chat_id are required for Telegram channels"
        )
      }

      const now = new Date().toISOString()
      const newChannel: NotificationChannel = {
        id: `notif_${Math.random().toString(36).substring(2, 8)}`,
        type: request.type,
        name: request.name.trim(),
        enabled: request.enabled ?? true,
        webhook_url: request.webhook_url?.trim() || null,
        bot_token: request.bot_token?.trim() || null,
        chat_id: request.chat_id?.trim() || null,
        on_deploy_success: request.on_deploy_success ?? true,
        on_deploy_failed: request.on_deploy_failed ?? true,
        on_container_crashed: request.on_container_crashed ?? true,
        created_at: now,
        updated_at: now,
      }

      this._notificationChannels.unshift(newChannel)
      return structuredClone(newChannel)
    },

    update: async (
      id: string,
      request: UpdateNotificationChannelRequest
    ): Promise<NotificationChannel> => {
      checkSimulatedError()
      await delay(150)
      const ch = this._notificationChannels.find((c) => c.id === id)
      if (!ch) {
        throw new ApiError(404, "NOT_FOUND", "Notification channel not found")
      }

      if (request.name !== undefined) ch.name = request.name
      if (request.enabled !== undefined) ch.enabled = request.enabled
      if (request.webhook_url !== undefined)
        ch.webhook_url = request.webhook_url
      if (request.bot_token !== undefined) ch.bot_token = request.bot_token
      if (request.chat_id !== undefined) ch.chat_id = request.chat_id
      if (request.on_deploy_success !== undefined)
        ch.on_deploy_success = request.on_deploy_success
      if (request.on_deploy_failed !== undefined)
        ch.on_deploy_failed = request.on_deploy_failed
      if (request.on_container_crashed !== undefined)
        ch.on_container_crashed = request.on_container_crashed
      ch.updated_at = new Date().toISOString()

      return structuredClone(ch)
    },

    delete: async (id: string): Promise<SuccessResponse> => {
      checkSimulatedError()
      await delay(100)
      const index = this._notificationChannels.findIndex((c) => c.id === id)
      if (index === -1) {
        throw new ApiError(404, "NOT_FOUND", "Notification channel not found")
      }
      this._notificationChannels.splice(index, 1)
      return { success: true, message: "Channel deleted successfully." }
    },

    test: async (id: string): Promise<SuccessResponse> => {
      checkSimulatedError()
      await delay(300)
      const ch = this._notificationChannels.find((c) => c.id === id)
      if (!ch) {
        throw new ApiError(404, "NOT_FOUND", "Notification channel not found")
      }
      return {
        success: true,
        message: `Test notification sent to ${ch.name}.`,
      }
    },
  }

  readonly storage = {
    listS3Destinations: async (): Promise<S3Destination[]> => {
      checkSimulatedError()
      await delay(100)
      return structuredClone(this._s3Destinations).sort((a, b) => {
        if (a.is_default !== b.is_default) return a.is_default ? -1 : 1
        return (
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        )
      })
    },

    createS3Destination: async (
      request: CreateS3DestinationRequest
    ): Promise<S3Destination> => {
      checkSimulatedError()
      await delay(150)
      if (!request.name?.trim()) {
        throw new ApiError(400, "BAD_REQUEST", "name is required")
      }
      if (!request.endpoint?.trim()) {
        throw new ApiError(400, "BAD_REQUEST", "endpoint is required")
      }
      if (!request.bucket_name?.trim()) {
        throw new ApiError(400, "BAD_REQUEST", "bucket_name is required")
      }
      if (!request.access_key_id?.trim()) {
        throw new ApiError(400, "BAD_REQUEST", "access_key_id is required")
      }
      if (!request.secret_access_key?.trim()) {
        throw new ApiError(400, "BAD_REQUEST", "secret_access_key is required")
      }

      let isDefault = request.is_default ?? false
      if (this._s3Destinations.length === 0) {
        isDefault = true
      }
      if (isDefault) {
        for (const dest of this._s3Destinations) {
          dest.is_default = false
        }
      }

      const now = new Date().toISOString()
      const newDest: S3Destination = {
        id: `s3d_${Date.now().toString(36)}`,
        name: request.name.trim(),
        endpoint: request.endpoint.trim(),
        region: request.region?.trim() || "us-east-1",
        bucket_name: request.bucket_name.trim(),
        access_key_id: request.access_key_id.trim(),
        use_path_style: request.use_path_style ?? false,
        is_default: isDefault,
        created_at: now,
        updated_at: now,
      }

      this._s3Destinations.unshift(newDest)
      return structuredClone(newDest)
    },

    updateS3Destination: async (
      id: string,
      request: UpdateS3DestinationRequest
    ): Promise<S3Destination> => {
      checkSimulatedError()
      await delay(120)
      const dest = this._s3Destinations.find((d) => d.id === id)
      if (!dest) {
        throw new ApiError(404, "NOT_FOUND", "S3 destination not found")
      }

      if (request.name !== undefined && request.name.trim()) {
        dest.name = request.name.trim()
      }
      if (request.endpoint !== undefined && request.endpoint.trim()) {
        dest.endpoint = request.endpoint.trim()
      }
      if (request.region !== undefined && request.region.trim()) {
        dest.region = request.region.trim()
      }
      if (request.bucket_name !== undefined && request.bucket_name.trim()) {
        dest.bucket_name = request.bucket_name.trim()
      }
      if (request.access_key_id !== undefined && request.access_key_id.trim()) {
        dest.access_key_id = request.access_key_id.trim()
      }
      if (request.use_path_style !== undefined) {
        dest.use_path_style = request.use_path_style
      }
      if (request.is_default !== undefined) {
        dest.is_default = request.is_default
        if (dest.is_default) {
          for (const other of this._s3Destinations) {
            if (other.id !== id) {
              other.is_default = false
            }
          }
        }
      }
      dest.updated_at = new Date().toISOString()
      return structuredClone(dest)
    },

    deleteS3Destination: async (id: string): Promise<SuccessResponse> => {
      checkSimulatedError()
      await delay(150)
      const index = this._s3Destinations.findIndex((d) => d.id === id)
      if (index === -1) {
        throw new ApiError(404, "NOT_FOUND", "S3 destination not found")
      }
      this._s3Destinations.splice(index, 1)
      return { success: true, message: "S3 destination deleted successfully" }
    },

    testS3Destination: async (
      id: string,
      _request?: TestS3DestinationRequest
    ): Promise<SuccessResponse> => {
      checkSimulatedError()
      await delay(300)
      const dest = this._s3Destinations.find((d) => d.id === id)
      if (!dest) {
        throw new ApiError(404, "NOT_FOUND", "S3 destination not found")
      }
      return {
        success: true,
        message: `Connection to S3 destination "${dest.name}" verified successfully.`,
      }
    },

    testS3Raw: async (
      request: TestS3DestinationRequest
    ): Promise<SuccessResponse> => {
      checkSimulatedError()
      await delay(300)
      if (
        !request.bucket_name?.trim() ||
        !request.access_key_id?.trim() ||
        !request.secret_access_key?.trim()
      ) {
        throw new ApiError(
          400,
          "BAD_REQUEST",
          "bucket_name, access_key_id, and secret_access_key are required to test connection"
        )
      }
      return {
        success: true,
        message: "S3 connection test successful.",
      }
    },
  }

  readonly auditLog = {
    list: async (params?: {
      limit?: number
      before?: string
    }): Promise<AuditLogListResponse> => {
      checkSimulatedError()
      await delay(120)

      const limit = params?.limit && params.limit > 0 ? params.limit : 50
      let entries = [...this._auditLogs]

      entries.sort((a, b) => {
        const timeDiff =
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        if (timeDiff !== 0) return timeDiff
        return b.id.localeCompare(a.id)
      })

      if (params?.before) {
        let cutoffTime = ""
        let cutoffId = ""
        try {
          const decoded =
            typeof atob !== "undefined"
              ? atob(params.before)
              : Buffer.from(params.before, "base64").toString("utf-8")
          const parts = decoded.split("|")
          if (parts.length === 2) {
            cutoffTime = parts[0]
            cutoffId = parts[1]
          }
        } catch {
          // ignore decode error
        }

        if (cutoffTime) {
          const cutoffMs = new Date(cutoffTime).getTime()
          entries = entries.filter((e) => {
            const eMs = new Date(e.created_at).getTime()
            if (eMs < cutoffMs) return true
            if (eMs === cutoffMs) return e.id < cutoffId
            return false
          })
        }
      }

      let nextCursor: string | null = null
      if (entries.length > limit) {
        const last = entries[limit - 1]
        const raw = `${last.created_at}|${last.id}`
        nextCursor =
          typeof btoa !== "undefined"
            ? btoa(raw)
            : Buffer.from(raw).toString("base64")
        entries = entries.slice(0, limit)
      }

      return {
        items: structuredClone(entries),
        next_cursor: nextCursor,
      }
    },
  }

  readonly users = {
    list: async (): Promise<User[]> => {
      await delay(50)
      checkSimulatedError()
      return structuredClone(this._users)
    },
    updateRole: async (
      id: string,
      body: UpdateUserRoleRequest
    ): Promise<User> => {
      await delay(50)
      checkSimulatedError()
      const user = this._users.find((u) => u.id === id)
      if (!user) {
        throw new ApiError(404, "NOT_FOUND", "User not found")
      }
      if (this._user.id === id && body.role !== "admin") {
        throw new ApiError(400, "BAD_REQUEST", "Cannot demote your own account")
      }
      user.role = body.role
      return structuredClone(user)
    },
    delete: async (id: string): Promise<SuccessResponse> => {
      await delay(50)
      checkSimulatedError()
      if (this._user.id === id) {
        throw new ApiError(400, "BAD_REQUEST", "Cannot delete your own account")
      }
      const idx = this._users.findIndex((u) => u.id === id)
      if (idx === -1) {
        throw new ApiError(404, "NOT_FOUND", "User not found")
      }
      this._users.splice(idx, 1)
      return { success: true, message: "User deleted successfully" }
    },
  }

  readonly invites = {
    create: async (
      body: CreateInviteRequest
    ): Promise<CreateInviteResponse> => {
      await delay(50)
      checkSimulatedError()
      const role = body.role || "member"
      const id = `inv_${Date.now()}`
      const token = `tako_inv_${Math.random().toString(36).substring(2)}`
      const expiresAt = new Date(Date.now() + 86400000 * 7).toISOString()
      const createdAt = new Date().toISOString()
      const invite = {
        id,
        role,
        token,
        created_by: this._user.id,
        expires_at: expiresAt,
        used_at: null,
        created_at: createdAt,
      }
      this._invites.unshift(invite)
      return {
        id,
        role,
        token,
        invite_url: `/register?token=${token}`,
        expires_at: expiresAt,
        created_at: createdAt,
      }
    },
    list: async (): Promise<Invite[]> => {
      await delay(50)
      checkSimulatedError()
      return structuredClone(this._invites.filter((i) => !i.used_at))
    },
    revoke: async (id: string): Promise<SuccessResponse> => {
      await delay(50)
      checkSimulatedError()
      const idx = this._invites.findIndex((i) => i.id === id)
      if (idx === -1) {
        throw new ApiError(404, "NOT_FOUND", "Invitation not found")
      }
      this._invites.splice(idx, 1)
      return { success: true, message: "Invitation revoked successfully" }
    },
    validate: async (token: string): Promise<InviteValidationResponse> => {
      await delay(50)
      checkSimulatedError()
      const inv = this._invites.find((i) => i.token === token)
      if (!inv || inv.used_at || new Date(inv.expires_at) < new Date()) {
        return {
          valid: false,
          role: inv?.role || "member",
          cluster_name: "Tako",
        }
      }
      return {
        valid: true,
        role: inv.role,
        cluster_name: "Tako",
      }
    },
    accept: async (body: AcceptInviteRequest): Promise<LoginResponse> => {
      await delay(50)
      checkSimulatedError()
      const inv = this._invites.find((i) => i.token === body.token)
      if (!inv) {
        throw new ApiError(404, "NOT_FOUND", "Invitation not found or invalid")
      }
      if (inv.used_at) {
        throw new ApiError(
          400,
          "BAD_REQUEST",
          "Invitation has already been used"
        )
      }
      if (
        this._users.some(
          (u) => u.email.toLowerCase() === body.email.toLowerCase()
        )
      ) {
        throw new ApiError(409, "CONFLICT", "Email address is already in use")
      }
      inv.used_at = new Date().toISOString()
      const newUser: User = {
        id: `usr_${Date.now()}`,
        email: body.email,
        name: body.name,
        role: inv.role,
        two_factor_enabled: false,
        passkeys_enabled: false,
        created_at: new Date().toISOString(),
      }
      this._users.push(newUser)
      return {
        user: newUser,
        requires_2fa: false,
        session_id: `sess_${Date.now()}`,
      }
    },
  }

  readonly system = {
    getConsoleDomain: async (): Promise<ConsoleDomainConfig> => {
      await delay(50)
      checkSimulatedError()
      return structuredClone(this._consoleDomain)
    },

    updateConsoleDomain: async (
      req: UpdateConsoleDomainRequest
    ): Promise<ConsoleDomainConfig> => {
      await delay(150)
      checkSimulatedError()
      const trimmed = req.domain.trim().toLowerCase()
      if (!trimmed || trimmed.includes(" ")) {
        throw new ApiError(400, "BAD_REQUEST", "Invalid domain name format")
      }
      if (trimmed !== "localhost" && !trimmed.includes(".")) {
        throw new ApiError(
          400,
          "BAD_REQUEST",
          "Domain must contain a valid top-level domain or be localhost"
        )
      }

      const sslProvider = req.ssl_provider ?? this._consoleDomain.ssl_provider
      const forceHTTPS = req.force_https ?? this._consoleDomain.force_https

      let sslStatus: "active" | "pending" | "error" = "active"
      let sslError: string | null = null

      if (trimmed.includes("mismatch") || trimmed.includes("error")) {
        sslStatus = "error"
        sslError = "DNS mismatch: domain does not resolve to server IP address"
      } else if (trimmed.includes("pending")) {
        sslStatus = "pending"
      }

      this._consoleDomain = {
        ...this._consoleDomain,
        domain: trimmed,
        ssl_provider: sslProvider,
        force_https: forceHTTPS,
        ssl_status: sslStatus,
        ssl_error: sslError,
        custom_cert: req.custom_cert ?? this._consoleDomain.custom_cert,
        custom_key: req.custom_key ?? this._consoleDomain.custom_key,
        updated_at: new Date().toISOString(),
      }

      return structuredClone(this._consoleDomain)
    },

    verifyConsoleDomainDNS: async (
      req: VerifyConsoleDomainRequest
    ): Promise<VerifyConsoleDomainResponse> => {
      await delay(100)
      checkSimulatedError()
      const domain = req.domain.trim().toLowerCase()
      if (!domain) {
        throw new ApiError(400, "BAD_REQUEST", "Domain cannot be empty")
      }

      if (domain.includes("mismatch") || domain.includes("fail")) {
        return {
          matches: false,
          domain,
          expected_ip: "203.0.113.195",
          resolved_ips: ["198.51.100.1"],
          error_message: `DNS mismatch: ${domain} resolves to 198.51.100.1, expected 203.0.113.195`,
        }
      }

      return {
        matches: true,
        domain,
        expected_ip: "203.0.113.195",
        resolved_ips: ["203.0.113.195"],
      }
    },
  }
}
