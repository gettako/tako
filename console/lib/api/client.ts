import type { components } from "./types"

export type AdminUser = components["schemas"]["AdminUser"]
export type UpdateProfileRequest = components["schemas"]["UpdateProfileRequest"]
export type ChangePasswordRequest =
  components["schemas"]["ChangePasswordRequest"]
export type SuccessResponse = components["schemas"]["SuccessResponse"]
export type LoginRequest = components["schemas"]["LoginRequest"]
export type LoginResponse = components["schemas"]["LoginResponse"]
export type TwoFactorSetupResponse =
  components["schemas"]["TwoFactorSetupResponse"]
export type TwoFactorVerifyRequest =
  components["schemas"]["TwoFactorVerifyRequest"]
export type PasskeyRegistrationOptions =
  components["schemas"]["PasskeyRegistrationOptions"]
export type PasskeyRegistrationVerification =
  components["schemas"]["PasskeyRegistrationVerification"]
export type PasskeyRegistrationResult =
  components["schemas"]["PasskeyRegistrationResult"]
export type PasskeyLoginOptions = components["schemas"]["PasskeyLoginOptions"]
export type PasskeyLoginVerification =
  components["schemas"]["PasskeyLoginVerification"]

export type Server = components["schemas"]["Server"]
export type CreateServerRequest = components["schemas"]["CreateServerRequest"]
export type CreateServerResponse = components["schemas"]["CreateServerResponse"]
export type UpdateServerRequest = components["schemas"]["UpdateServerRequest"]
export type ServerDetail = components["schemas"]["ServerDetail"]
export type PruneResult = components["schemas"]["PruneResult"]
export type ServerTraefikConfig = components["schemas"]["ServerTraefikConfig"]
export type UpdateTraefikConfigRequest =
  components["schemas"]["UpdateTraefikConfigRequest"]

export type Project = components["schemas"]["Project"]
export type CreateProjectRequest = components["schemas"]["CreateProjectRequest"]
export type UpdateProjectRequest = components["schemas"]["UpdateProjectRequest"]
export type ProjectDetail = components["schemas"]["ProjectDetail"]

export type Service = components["schemas"]["Service"]
export type ServiceType = components["schemas"]["ServiceType"]
export type CreateServiceRequest = components["schemas"]["CreateServiceRequest"]
export type UpdateServiceRequest = components["schemas"]["UpdateServiceRequest"]
export type RebuildRequest = components["schemas"]["RebuildRequest"]
export type PullUpdateResponse = components["schemas"]["PullUpdateResponse"]
export type ServiceDetail = components["schemas"]["ServiceDetail"]
export type ServiceStatus = components["schemas"]["ServiceStatus"]

export type Deployment = components["schemas"]["Deployment"]
export type CreateDeploymentRequest =
  components["schemas"]["CreateDeploymentRequest"]
export type DeploymentListResponse =
  components["schemas"]["DeploymentListResponse"]
export type DeploymentDetail = components["schemas"]["DeploymentDetail"]
export type BuildStep = components["schemas"]["BuildStep"]
export type PreviewEnvironment = components["schemas"]["PreviewEnvironment"]

export type EnvVar = components["schemas"]["EnvVar"]
export type EnvVarInput = components["schemas"]["EnvVarInput"]
export type ServiceEnv = components["schemas"]["ServiceEnv"]
export type UpdateServiceEnvRequest =
  components["schemas"]["UpdateServiceEnvRequest"]
export type InjectConnectionStringRequest =
  components["schemas"]["InjectConnectionStringRequest"]
export type InjectConnectionStringResponse =
  components["schemas"]["InjectConnectionStringResponse"]

export type Domain = components["schemas"]["Domain"]
export type AddDomainRequest = components["schemas"]["AddDomainRequest"]
export type UpdateDomainRequest = components["schemas"]["UpdateDomainRequest"]

export type ValidateComposeRequest =
  components["schemas"]["ValidateComposeRequest"]
export type ValidateComposeResponse =
  components["schemas"]["ValidateComposeResponse"]
export type ComposeSubServiceSummary =
  components["schemas"]["ComposeSubServiceSummary"]
export type ComposeSubService = components["schemas"]["ComposeSubService"]
export type ComposeStackOverview = components["schemas"]["ComposeStackOverview"]

export type GitHubStatus = components["schemas"]["GitHubStatus"]
export type GitHubRepo = components["schemas"]["GitHubRepo"]
export type GitHubBranch = components["schemas"]["GitHubBranch"]
export type GitHubConnection = components["schemas"]["GitHubConnection"]
export type CreateGitHubConnectionRequest =
  components["schemas"]["CreateGitHubConnectionRequest"]
export type GitHubManifestResponse =
  components["schemas"]["GitHubManifestResponse"]
export type GitHubAppExchangeRequest =
  components["schemas"]["GitHubAppExchangeRequest"]
export type GitHubAppExchangeResponse =
  components["schemas"]["GitHubAppExchangeResponse"]
export type GitHubAppInstallation =
  components["schemas"]["GitHubAppInstallation"]
export type WebhookResponse = components["schemas"]["WebhookResponse"]

export type BuildLogEvent = components["schemas"]["BuildLogEvent"]
export type BuildCompleteEvent = components["schemas"]["BuildCompleteEvent"]
export type BuildLogStreamEvent = components["schemas"]["BuildLogStreamEvent"]
export type ContainerLogEvent = components["schemas"]["ContainerLogEvent"]
export type ServiceStatusEvent = components["schemas"]["ServiceStatusEvent"]

export type BackupConfig = components["schemas"]["BackupConfig"]
export type UpdateBackupConfigRequest =
  components["schemas"]["UpdateBackupConfigRequest"]
export type TestS3ConfigRequest = components["schemas"]["TestS3ConfigRequest"]
export type BackupType = components["schemas"]["BackupType"]
export type BackupStatus = components["schemas"]["BackupStatus"]
export type BackupRecord = components["schemas"]["BackupRecord"]
export type TriggerBackupRequest = components["schemas"]["TriggerBackupRequest"]
export type DownloadBackupResponse =
  components["schemas"]["DownloadBackupResponse"]

export type ServiceMetricPoint = components["schemas"]["ServiceMetricPoint"]
export type ServiceMetricsCurrent =
  components["schemas"]["ServiceMetricsCurrent"]
export type ServiceMetricsResponse =
  components["schemas"]["ServiceMetricsResponse"]
export type MetricsRange = "1h" | "6h" | "24h" | "7d"

export class ApiError extends Error {
  readonly status: number
  readonly code: string
  readonly details?: Record<string, unknown> | null

  constructor(
    status: number,
    code: string,
    message: string,
    details?: Record<string, unknown> | null
  ) {
    super(message)
    this.name = "ApiError"
    this.status = status
    this.code = code
    this.details = details
  }
}

export interface AuthApiClient {
  login(request: LoginRequest): Promise<LoginResponse>
  logout(): Promise<void>
  getMe(): Promise<AdminUser>
  setup2FA(): Promise<TwoFactorSetupResponse>
  verify2FA(request: TwoFactorVerifyRequest): Promise<void>
  beginPasskeyRegistration(): Promise<PasskeyRegistrationOptions>
  finishPasskeyRegistration(
    request: PasskeyRegistrationVerification
  ): Promise<PasskeyRegistrationResult>
  beginPasskeyLogin(): Promise<PasskeyLoginOptions>
  finishPasskeyLogin(request: PasskeyLoginVerification): Promise<LoginResponse>
  updateProfile(request: UpdateProfileRequest): Promise<AdminUser>
  changePassword(request: ChangePasswordRequest): Promise<SuccessResponse>
}

export interface ServersApiClient {
  list(): Promise<Server[]>
  create(request: CreateServerRequest): Promise<CreateServerResponse>
  get(id: string): Promise<ServerDetail>
  update(id: string, request: UpdateServerRequest): Promise<ServerDetail>
  delete(id: string): Promise<void>
  prune(id: string): Promise<PruneResult>
  getTraefikConfig(id: string): Promise<ServerTraefikConfig>
  updateTraefikConfig(
    id: string,
    request: UpdateTraefikConfigRequest
  ): Promise<ServerTraefikConfig>
  restartTraefik(id: string): Promise<SuccessResponse>
}

export interface ProjectsApiClient {
  list(): Promise<Project[]>
  create(request: CreateProjectRequest): Promise<Project>
  get(id: string): Promise<ProjectDetail>
  update(id: string, request: UpdateProjectRequest): Promise<Project>
  delete(id: string): Promise<void>
}

export interface ListServicesFilter {
  projectId?: string
  serverId?: string
  parentServiceId?: string
}

export interface ListDeploymentsQuery {
  page?: number
  limit?: number
}

export interface ContainerLogsOptions {
  tail?: number
  follow?: boolean
  container?: string
}

export interface ServicesApiClient {
  list(filter?: ListServicesFilter): Promise<Service[]>
  create(request: CreateServiceRequest): Promise<Service>
  get(id: string): Promise<ServiceDetail>
  update(id: string, request: UpdateServiceRequest): Promise<Service>
  delete(
    id: string,
    options?: { delete_volumes?: boolean; prune_images?: boolean }
  ): Promise<void>
  start(id: string): Promise<Service>
  stop(id: string): Promise<Service>
  restart(id: string): Promise<Service>
  rebuild(id: string, request?: RebuildRequest): Promise<Deployment>
  redeploy(id: string): Promise<Deployment>
  pullUpdate(id: string): Promise<PullUpdateResponse>
  validateCompose(
    request: ValidateComposeRequest
  ): Promise<ValidateComposeResponse>
  getStackOverview(serviceId: string): Promise<ComposeStackOverview>

  listDeployments(
    serviceId: string,
    query?: ListDeploymentsQuery
  ): Promise<DeploymentListResponse>
  createDeployment(
    serviceId: string,
    request?: CreateDeploymentRequest
  ): Promise<Deployment>
  getDeployment(
    serviceId: string,
    deploymentId: string
  ): Promise<DeploymentDetail>
  cancelDeployment(serviceId: string, deploymentId: string): Promise<Deployment>
  rollbackDeployment(
    serviceId: string,
    deploymentId: string
  ): Promise<Deployment>

  listPreviews(serviceId: string): Promise<PreviewEnvironment[]>
  deletePreview(
    serviceId: string,
    previewId: string
  ): Promise<{ success: boolean; message: string }>

  getEnv(serviceId: string): Promise<ServiceEnv>
  updateEnv(
    serviceId: string,
    request: UpdateServiceEnvRequest
  ): Promise<ServiceEnv>
  injectConnectionString(
    serviceId: string,
    request: InjectConnectionStringRequest
  ): Promise<InjectConnectionStringResponse>

  listDomains(serviceId: string): Promise<Domain[]>
  addDomain(serviceId: string, request: AddDomainRequest): Promise<Domain>
  updateDomain(
    serviceId: string,
    domain: string,
    request: UpdateDomainRequest
  ): Promise<Domain>
  deleteDomain(serviceId: string, domain: string): Promise<void>
  checkDomainSsl(serviceId: string, domain: string): Promise<Domain>

  streamBuildLogs(
    serviceId: string,
    deploymentId: string
  ): AsyncIterable<BuildLogStreamEvent>
  streamContainerLogs(
    serviceId: string,
    options?: ContainerLogsOptions
  ): AsyncIterable<ContainerLogEvent>
  streamStatus(serviceId: string): AsyncIterable<ServiceStatusEvent>
  getTerminalWebSocketUrl(
    serviceId: string,
    shell?: string,
    container?: string
  ): string
  getMetrics(
    serviceId: string,
    range?: MetricsRange
  ): Promise<ServiceMetricsResponse>
}

export interface GitHubApiClient {
  getStatus(): Promise<GitHubStatus>
  listRepos(): Promise<GitHubRepo[]>
  listBranches(owner: string, repo: string): Promise<GitHubBranch[]>
  handleWebhook(): Promise<WebhookResponse>
  listConnections(): Promise<GitHubConnection[]>
  createConnection(
    request: CreateGitHubConnectionRequest
  ): Promise<GitHubConnection>
  deleteConnection(id: string): Promise<void>
  getManifest(params?: { origin?: string }): Promise<GitHubManifestResponse>
  exchangeManifest(
    request: GitHubAppExchangeRequest
  ): Promise<GitHubAppExchangeResponse>
  syncInstallations(): Promise<GitHubConnection[]>
  listConnectionRepos(connectionId: string): Promise<GitHubRepo[]>
  listConnectionBranches(
    connectionId: string,
    owner: string,
    repo: string
  ): Promise<GitHubBranch[]>
}

export interface BackupsApiClient {
  getConfig(): Promise<BackupConfig>
  updateConfig(request: UpdateBackupConfigRequest): Promise<BackupConfig>
  testStorage(request?: TestS3ConfigRequest): Promise<SuccessResponse>
  listControlPlaneBackups(): Promise<BackupRecord[]>
  triggerControlPlaneBackup(): Promise<BackupRecord>
  downloadControlPlaneBackup(id: string): Promise<DownloadBackupResponse>
  deleteControlPlaneBackup(id: string): Promise<SuccessResponse>

  listServiceBackups(serviceId: string): Promise<BackupRecord[]>
  triggerServiceBackup(
    serviceId: string,
    request?: TriggerBackupRequest
  ): Promise<BackupRecord>
  getServiceBackupSchedule(serviceId: string): Promise<ServiceBackupSchedule>
  updateServiceBackupSchedule(
    serviceId: string,
    request: UpdateBackupScheduleRequest
  ): Promise<ServiceBackupSchedule>
  downloadServiceBackup(
    serviceId: string,
    backupId: string
  ): Promise<DownloadBackupResponse>
  restoreServiceBackup(
    serviceId: string,
    backupId: string
  ): Promise<SuccessResponse>
  deleteServiceBackup(
    serviceId: string,
    backupId: string
  ): Promise<SuccessResponse>
}

export type ServiceBackupSchedule =
  components["schemas"]["ServiceBackupSchedule"]
export type UpdateBackupScheduleRequest =
  components["schemas"]["UpdateBackupScheduleRequest"]

export type NotificationChannelType =
  components["schemas"]["NotificationChannelType"]
export type NotificationChannel = components["schemas"]["NotificationChannel"]
export type CreateNotificationChannelRequest =
  components["schemas"]["CreateNotificationChannelRequest"]
export type UpdateNotificationChannelRequest =
  components["schemas"]["UpdateNotificationChannelRequest"]

export interface NotificationsApiClient {
  list(): Promise<NotificationChannel[]>
  create(
    request: CreateNotificationChannelRequest
  ): Promise<NotificationChannel>
  update(
    id: string,
    request: UpdateNotificationChannelRequest
  ): Promise<NotificationChannel>
  delete(id: string): Promise<SuccessResponse>
  test(id: string): Promise<SuccessResponse>
}

export type S3Destination = components["schemas"]["S3Destination"]
export type CreateS3DestinationRequest =
  components["schemas"]["CreateS3DestinationRequest"]
export type UpdateS3DestinationRequest =
  components["schemas"]["UpdateS3DestinationRequest"]
export type TestS3DestinationRequest =
  components["schemas"]["TestS3DestinationRequest"]

export interface StorageApiClient {
  listS3Destinations(): Promise<S3Destination[]>
  createS3Destination(
    request: CreateS3DestinationRequest
  ): Promise<S3Destination>
  updateS3Destination(
    id: string,
    request: UpdateS3DestinationRequest
  ): Promise<S3Destination>
  deleteS3Destination(id: string): Promise<SuccessResponse>
  testS3Destination(
    id: string,
    request?: TestS3DestinationRequest
  ): Promise<SuccessResponse>
  testS3Raw(request: TestS3DestinationRequest): Promise<SuccessResponse>
}

export type AuditLogEntry = components["schemas"]["AuditLogEntry"]
export type AuditLogListResponse = components["schemas"]["AuditLogListResponse"]

export interface AuditLogApiClient {
  list(params?: {
    limit?: number
    before?: string
  }): Promise<AuditLogListResponse>
}

export type User = components["schemas"]["User"]
export type UserRole = components["schemas"]["UserRole"]
export type UpdateUserRoleRequest =
  components["schemas"]["UpdateUserRoleRequest"]

export interface UsersApiClient {
  list(): Promise<User[]>
  updateRole(id: string, request: UpdateUserRoleRequest): Promise<User>
  delete(id: string): Promise<SuccessResponse>
}

export type Invite = components["schemas"]["Invite"]
export type CreateInviteRequest = components["schemas"]["CreateInviteRequest"]
export type CreateInviteResponse = components["schemas"]["CreateInviteResponse"]
export type InviteValidationResponse =
  components["schemas"]["InviteValidationResponse"]
export type AcceptInviteRequest = components["schemas"]["AcceptInviteRequest"]

export interface InvitesApiClient {
  create(request: CreateInviteRequest): Promise<CreateInviteResponse>
  list(): Promise<Invite[]>
  revoke(id: string): Promise<SuccessResponse>
  validate(token: string): Promise<InviteValidationResponse>
  accept(request: AcceptInviteRequest): Promise<LoginResponse>
}

export type ConsoleDomainConfig = components["schemas"]["ConsoleDomainConfig"]
export type UpdateConsoleDomainRequest = {
  domain: string
  ssl_provider?: "letsencrypt" | "none" | "custom"
  force_https?: boolean
  custom_cert?: string
  custom_key?: string
}
export type VerifyConsoleDomainRequest =
  components["schemas"]["VerifyConsoleDomainRequest"]
export type VerifyConsoleDomainResponse =
  components["schemas"]["VerifyConsoleDomainResponse"]

export interface SystemApiClient {
  getConsoleDomain(): Promise<ConsoleDomainConfig>
  updateConsoleDomain(
    request: UpdateConsoleDomainRequest
  ): Promise<ConsoleDomainConfig>
  verifyConsoleDomainDNS(
    request: VerifyConsoleDomainRequest
  ): Promise<VerifyConsoleDomainResponse>
}

export interface ApiClient {
  auth: AuthApiClient
  servers: ServersApiClient
  projects: ProjectsApiClient
  services: ServicesApiClient
  github: GitHubApiClient
  backups: BackupsApiClient
  notifications: NotificationsApiClient
  storage: StorageApiClient
  auditLog: AuditLogApiClient
  users: UsersApiClient
  invites: InvitesApiClient
  system: SystemApiClient
}
