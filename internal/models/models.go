package models

import "time"

type Project struct {
	ID            string    `json:"id"`
	Name          string    `json:"name"`
	Description   *string   `json:"description"`
	ServicesCount int       `json:"services_count"`
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`
}

type ProjectDetail struct {
	Project
	Services []Service `json:"services"`
}

type CreateProjectRequest struct {
	Name        string  `json:"name"`
	Description *string `json:"description,omitempty"`
}

type UpdateProjectRequest struct {
	Name        *string `json:"name,omitempty"`
	Description *string `json:"description,omitempty"`
}

type ServerStatus string

const (
	ServerOnline  ServerStatus = "online"
	ServerOffline ServerStatus = "offline"
	ServerPending ServerStatus = "pending"
)

type Server struct {
	ID                  string       `json:"id"`
	Name                string       `json:"name"`
	Host                *string      `json:"host"`
	Status              ServerStatus `json:"status"`
	AgentVersion        string       `json:"agent_version"`
	CPUPercent          float64      `json:"cpu_percent"`
	RAMPercent          float64      `json:"ram_percent"`
	RAMTotalBytes       int64        `json:"ram_total_bytes"`
	RAMUsedBytes        int64        `json:"ram_used_bytes"`
	DiskPercent         float64      `json:"disk_percent"`
	ActiveServicesCount int          `json:"active_services_count"`
	CreatedAt           time.Time    `json:"created_at"`
	UpdatedAt           time.Time    `json:"updated_at"`
}

type ServerDetail struct {
	Server
	DockerVersion   string           `json:"docker_version"`
	OSInfo          string           `json:"os_info"`
	UptimeSeconds   int64            `json:"uptime_seconds"`
	LastHeartbeatAt *time.Time       `json:"last_heartbeat_at"`
	Services        []ServiceSummary `json:"services"`
}

type CreateServerRequest struct {
	Name string  `json:"name"`
	Host *string `json:"host,omitempty"`
}

type CreateServerResponse struct {
	Server          *Server `json:"server"`
	EnrollmentToken string  `json:"enrollment_token"`
	ComposeSnippet  string  `json:"compose_snippet"`
}

type ServiceStatus string

const (
	ServiceRunning   ServiceStatus = "running"
	ServiceStopped   ServiceStatus = "stopped"
	ServiceBuilding  ServiceStatus = "building"
	ServiceFailed    ServiceStatus = "failed"
	ServiceUnhealthy ServiceStatus = "unhealthy"
)

type ServiceType string

const (
	ServiceTypeWeb      ServiceType = "web"
	ServiceTypeWorker   ServiceType = "worker"
	ServiceTypeCron     ServiceType = "cron"
	ServiceTypeDatabase ServiceType = "database"
	ServiceTypeCompose  ServiceType = "compose"
	ServiceTypePreview  ServiceType = "preview"
)

type Service struct {
	ID                    string        `json:"id"`
	ProjectID             string        `json:"project_id"`
	ServerID              string        `json:"server_id"`
	Name                  string        `json:"name"`
	ServiceType           ServiceType   `json:"service_type"`
	ParentServiceID       *string       `json:"parent_service_id,omitempty"`
	Command               *string       `json:"command,omitempty"`
	CronExpression        *string       `json:"cron_expression,omitempty"`
	DatabaseEngine        *string       `json:"database_engine,omitempty"`
	DatabaseVersion       *string       `json:"database_version,omitempty"`
	DatabaseName          *string       `json:"database_name,omitempty"`
	DatabaseUser          *string       `json:"database_user,omitempty"`
	DatabasePassword      *string       `json:"database_password,omitempty"`
	VolumeName            *string       `json:"volume_name,omitempty"`
	VolumeMountPath       *string       `json:"volume_mount_path,omitempty"`
	ConnectionURI         *string       `json:"connection_uri,omitempty"`
	PreDeployCommand      *string       `json:"pre_deploy_command,omitempty"`
	PostDeployCommand     *string       `json:"post_deploy_command,omitempty"`
	ComposeFileContent    *string       `json:"compose_file_content,omitempty"`
	ComposeFilePath       *string       `json:"compose_file_path,omitempty"`
	Repository            string        `json:"repository"`
	Branch                string        `json:"branch"`
	DockerfilePath        string        `json:"dockerfile_path"`
	InternalPort          int           `json:"internal_port"`
	HealthCheckPath       string        `json:"health_check_path"`
	Status                ServiceStatus `json:"status"`
	PrimaryDomain         *string       `json:"primary_domain"`
	PublishedPort         *int          `json:"published_port,omitempty"`
	ActiveDeploymentID    *string       `json:"active_deployment_id"`
	AutoDeploy            bool          `json:"auto_deploy"`
	DeployKeyPublic       *string       `json:"deploy_key_public,omitempty"`
	IsPreview             bool          `json:"is_preview,omitempty"`
	PRNumber              *int          `json:"pr_number,omitempty"`
	PreviewStatus         *string       `json:"preview_status,omitempty"`
	LastActivityAt        *time.Time    `json:"last_activity_at,omitempty"`
	PreviewEnabled        *bool         `json:"preview_enabled,omitempty"`
	PreviewDomainTemplate *string       `json:"preview_domain_template,omitempty"`
	MaxPreviews           *int          `json:"max_previews,omitempty"`
	GitHubConnectionID    *string       `json:"github_connection_id,omitempty"`
	CreatedAt             time.Time     `json:"created_at"`
	UpdatedAt             time.Time     `json:"updated_at"`
}

type PreviewEnvironment struct {
	ID        string    `json:"id"`
	ServiceID string    `json:"service_id"`
	PRNumber  int       `json:"pr_number"`
	Name      string    `json:"name"`
	Branch    string    `json:"branch"`
	CommitSHA string    `json:"commit_sha"`
	Status    string    `json:"status"`
	URL       string    `json:"url"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type ServiceSummary struct {
	ID           string        `json:"id"`
	Name         string        `json:"name"`
	Status       ServiceStatus `json:"status"`
	InternalPort int           `json:"internal_port"`
}

type CreateServiceRequest struct {
	ProjectID         string       `json:"project_id"`
	ServerID          string       `json:"server_id"`
	Name              string       `json:"name"`
	Repository        string       `json:"repository"`
	Branch            string       `json:"branch"`
	DockerfilePath    string       `json:"dockerfile_path"`
	InternalPort      int          `json:"internal_port"`
	PublishedPort     *int         `json:"published_port,omitempty"`
	HealthCheckPath   string       `json:"health_check_path"`
	AutoDeploy        *bool        `json:"auto_deploy,omitempty"`
	ServiceType       *ServiceType `json:"service_type,omitempty"`
	ParentServiceID   *string      `json:"parent_service_id,omitempty"`
	Command           *string      `json:"command,omitempty"`
	CronExpression    *string      `json:"cron_expression,omitempty"`
	PreDeployCommand  *string      `json:"pre_deploy_command,omitempty"`
	PostDeployCommand *string      `json:"post_deploy_command,omitempty"`
	DatabaseEngine    *string      `json:"database_engine,omitempty"`
	DatabaseVersion   *string      `json:"database_version,omitempty"`
	DatabaseName      *string      `json:"database_name,omitempty"`
	DatabaseUser      *string      `json:"database_user,omitempty"`
	DatabasePassword  *string      `json:"database_password,omitempty"`
	VolumeName        *string      `json:"volume_name,omitempty"`
	VolumeMountPath   *string      `json:"volume_mount_path,omitempty"`
	ComposeFileContent *string     `json:"compose_file_content,omitempty"`
	ComposeFilePath    *string     `json:"compose_file_path,omitempty"`
	GitHubConnectionID *string     `json:"github_connection_id,omitempty"`
}

type InjectConnectionStringRequest struct {
	TargetServiceID string `json:"target_service_id"`
	EnvKey          string `json:"env_key,omitempty"`
}

type UpdateServiceRequest struct {
	Name               *string `json:"name,omitempty"`
	Branch             *string `json:"branch,omitempty"`
	DockerfilePath     *string `json:"dockerfile_path,omitempty"`
	InternalPort       *int    `json:"internal_port,omitempty"`
	PublishedPort      *int    `json:"published_port,omitempty"`
	HealthCheckPath    *string `json:"health_check_path,omitempty"`
	ServerID           *string `json:"server_id,omitempty"`
	AutoDeploy         *bool   `json:"auto_deploy,omitempty"`
	Command            *string `json:"command,omitempty"`
	CronExpression     *string `json:"cron_expression,omitempty"`
	PreDeployCommand   *string `json:"pre_deploy_command,omitempty"`
	PostDeployCommand  *string `json:"post_deploy_command,omitempty"`
	VolumeName         *string `json:"volume_name,omitempty"`
	VolumeMountPath    *string `json:"volume_mount_path,omitempty"`
	ComposeFileContent *string `json:"compose_file_content,omitempty"`
	ComposeFilePath    *string `json:"compose_file_path,omitempty"`
	GitHubConnectionID *string `json:"github_connection_id,omitempty"`
}

type ServiceDetail struct {
	Service
	Server           *Server     `json:"server"`
	Project          *Project    `json:"project"`
	Domains          []Domain    `json:"domains"`
	ActiveDeployment *Deployment `json:"active_deployment"`
	EnvVarsCount     int         `json:"env_vars_count"`
}

type DeploymentStatus string

const (
	DeploymentQueued    DeploymentStatus = "queued"
	DeploymentBuilding  DeploymentStatus = "building"
	DeploymentDeploying DeploymentStatus = "deploying"
	DeploymentSuccess   DeploymentStatus = "success"
	DeploymentFailed    DeploymentStatus = "failed"
	DeploymentCancelled DeploymentStatus = "cancelled"
)

type Deployment struct {
	ID              string           `json:"id"`
	ServiceID       string           `json:"service_id"`
	Status          DeploymentStatus `json:"status"`
	CommitSHA       string           `json:"commit_sha"`
	CommitMessage   string           `json:"commit_message"`
	CommitAuthor    string           `json:"commit_author"`
	Branch          string           `json:"branch"`
	ImageTag        *string          `json:"image_tag"`
	TriggerType     string           `json:"trigger_type,omitempty"`
	StartedAt       *time.Time       `json:"started_at"`
	FinishedAt      *time.Time       `json:"finished_at"`
	DurationSeconds *int             `json:"duration_seconds"`
	CreatedAt       time.Time        `json:"created_at"`
}

type BuildStep struct {
	Event           string `json:"event"` // "build_step"
	Step            string `json:"step"`
	Title           string `json:"title"`
	Status          string `json:"status"` // "pending", "running", "success", "failed"
	DurationSeconds *int   `json:"duration_seconds"`
}

type DeploymentDetail struct {
	Deployment
	BuildSteps []BuildStep `json:"build_steps"`
	ErrorTrace *string     `json:"error_trace"`
}

type CreateDeploymentRequest struct {
	Branch           *string `json:"branch,omitempty"`
	CommitSHA        *string `json:"commit_sha,omitempty"`
	CommitMessage    *string `json:"commit_message,omitempty"`
	CommitAuthor     *string `json:"commit_author,omitempty"`
	TriggerType      *string `json:"trigger_type,omitempty"`
	IsRollback       *bool   `json:"is_rollback,omitempty"`
	RollbackImageTag *string `json:"rollback_image_tag,omitempty"`
}

type DeploymentListResponse struct {
	Items []Deployment `json:"items"`
	Total int          `json:"total"`
	Page  int          `json:"page"`
	Limit int          `json:"limit"`
}

type BuildLogStreamEvent struct {
	Event           string  `json:"event"` // "build_step", "build_log", "build_complete"
	Step            string  `json:"step,omitempty"`
	Title           string  `json:"title,omitempty"`
	Status          string  `json:"status,omitempty"`
	DurationSeconds *int    `json:"duration_seconds,omitempty"`
	Stream          string  `json:"stream,omitempty"` // "stdout", "stderr"
	Line            string  `json:"line,omitempty"`
	Timestamp       string  `json:"timestamp,omitempty"`
	ImageTag        *string `json:"image_tag,omitempty"`
	Error           *string `json:"error,omitempty"`
}

type Domain struct {
	ID           string    `json:"id"`
	ServiceID    string    `json:"service_id"`
	ServiceName  *string   `json:"service_name,omitempty"`
	Domain       string    `json:"domain"`
	Port         int       `json:"port"`
	PathPrefix   string    `json:"path_prefix"`
	StripPrefix  bool      `json:"strip_prefix"`
	IsCanonical  bool      `json:"is_canonical"`
	RedirectMode string    `json:"redirect_mode"` // 'none', 'www_to_non_www', 'non_www_to_www'
	AuthEnabled  bool      `json:"auth_enabled"`
	AuthUser     string    `json:"auth_user"`
	AuthPassword string    `json:"auth_password,omitempty"`
	EntryPoints  string    `json:"entrypoints"`
	SSLResolver  string    `json:"ssl_resolver"`
	SSLStatus    string    `json:"ssl_status"` // 'active', 'pending', 'error'
	SSLError     *string   `json:"ssl_error"`
	CreatedAt    time.Time `json:"created_at"`
}

type AddDomainRequest struct {
	Domain       string  `json:"domain"`
	ServiceID    *string `json:"service_id,omitempty"`
	Port         *int    `json:"port,omitempty"`
	PathPrefix   *string `json:"path_prefix,omitempty"`
	StripPrefix  *bool   `json:"strip_prefix,omitempty"`
	IsCanonical  *bool   `json:"is_canonical,omitempty"`
	RedirectMode *string `json:"redirect_mode,omitempty"`
	AuthEnabled  *bool   `json:"auth_enabled,omitempty"`
	AuthUser     *string `json:"auth_user,omitempty"`
	AuthPassword *string `json:"auth_password,omitempty"`
	EntryPoints  *string `json:"entrypoints,omitempty"`
	SSLResolver  *string `json:"ssl_resolver,omitempty"`
}

type UpdateDomainRequest struct {
	ServiceID    *string `json:"service_id,omitempty"`
	Port         *int    `json:"port,omitempty"`
	PathPrefix   *string `json:"path_prefix,omitempty"`
	StripPrefix  *bool   `json:"strip_prefix,omitempty"`
	IsCanonical  *bool   `json:"is_canonical,omitempty"`
	RedirectMode *string `json:"redirect_mode,omitempty"`
	AuthEnabled  *bool   `json:"auth_enabled,omitempty"`
	AuthUser     *string `json:"auth_user,omitempty"`
	AuthPassword *string `json:"auth_password,omitempty"`
	EntryPoints  *string `json:"entrypoints,omitempty"`
	SSLResolver  *string `json:"ssl_resolver,omitempty"`
}

type EnvVar struct {
	Key      string `json:"key"`
	Value    string `json:"value"`
	IsSecret bool   `json:"is_secret"`
}

type ServiceEnv struct {
	EnvVars   []EnvVar `json:"env_vars"`
	BuildArgs []EnvVar `json:"build_args"`
}

type UpdateServiceEnvRequest struct {
	EnvVars   []EnvVar `json:"env_vars"`
	BuildArgs []EnvVar `json:"build_args"`
}

type ServerTraefikConfig struct {
	CustomYAML string `json:"custom_yaml"`
	StaticYAML string `json:"static_yaml"`
}

type UpdateTraefikConfigRequest struct {
	CustomYAML string `json:"custom_yaml"`
}

type SuccessResponse struct {
	Success bool   `json:"success"`
	Message string `json:"message,omitempty"`
}

type GitHubStatus struct {
	Connected    bool    `json:"connected"`
	Username     *string `json:"username"`
	AvatarURL    *string `json:"avatar_url"`
	AppInstalled *bool   `json:"app_installed"`
}

type GitHubConnection struct {
	ID             string    `json:"id"`
	Name           string    `json:"name"`
	AuthType       string    `json:"auth_type"` // "pat" or "app"
	AccountName    string    `json:"account_name"`
	AvatarURL      *string   `json:"avatar_url,omitempty"`
	AppID          *string   `json:"app_id,omitempty"`
	AppSlug        *string   `json:"app_slug,omitempty"`
	InstallationID *string   `json:"installation_id,omitempty"`
	ServiceCount   int       `json:"service_count"`
	CreatedAt      time.Time `json:"created_at"`
	UpdatedAt      time.Time `json:"updated_at"`
}

type CreateGitHubConnectionRequest struct {
	Name           string  `json:"name"`
	AuthType       string  `json:"auth_type"` // "pat" or "app"
	Token          *string `json:"token,omitempty"`
	AccountName    *string `json:"account_name,omitempty"`
	AppID          *string `json:"app_id,omitempty"`
	AppSlug        *string `json:"app_slug,omitempty"`
	InstallationID *string `json:"installation_id,omitempty"`
	PrivateKey     *string `json:"private_key,omitempty"`
	WebhookSecret  *string `json:"webhook_secret,omitempty"`
}

type GitHubManifestResponse struct {
	ActionURL string         `json:"action_url"`
	Manifest  map[string]any `json:"manifest"`
}

type GitHubAppExchangeRequest struct {
	Code string  `json:"code"`
	Name *string `json:"name,omitempty"`
}

type GitHubAppExchangeResponse struct {
	ConnectionID string `json:"connection_id"`
	AppID        string `json:"app_id"`
	AppSlug      string `json:"app_slug"`
	InstallURL   string `json:"install_url"`
}

type GitHubAppInstallation struct {
	ID          int64   `json:"id"`
	AccountName string  `json:"account_name"`
	AccountType string  `json:"account_type"` // "User" or "Organization"
	AvatarURL   *string `json:"avatar_url,omitempty"`
	AppID       int64   `json:"app_id"`
	TargetID    int64   `json:"target_id"`
}

type GitHubRepo struct {
	ID            int64  `json:"id"`
	Name          string `json:"name"`
	FullName      string `json:"full_name"`
	Private       bool   `json:"private"`
	DefaultBranch string `json:"default_branch"`
	HTMLURL       string `json:"html_url"`
}

type GitHubBranch struct {
	Name      string `json:"name"`
	CommitSHA string `json:"commit_sha"`
	Protected bool   `json:"protected"`
}

type WebhookResponse struct {
	Received            bool    `json:"received"`
	DeploymentTriggered *bool   `json:"deployment_triggered,omitempty"`
	ServiceID           *string `json:"service_id,omitempty"`
	Message             string  `json:"message,omitempty"`
}

type RebuildRequest struct {
	Branch    *string `json:"branch,omitempty"`
	CommitSHA *string `json:"commit_sha,omitempty"`
}

type ContainerLogEvent struct {
	ContainerID   string    `json:"container_id"`
	ContainerName string    `json:"container_name,omitempty"`
	Stream        string    `json:"stream"`
	Line          string    `json:"line"`
	Timestamp     time.Time `json:"timestamp"`
}

type ValidateComposeRequest struct {
	ComposeContent string `json:"compose_content"`
}

type ComposeSubServiceSummary struct {
	Name        string            `json:"name"`
	Image       string            `json:"image,omitempty"`
	Ports       []string          `json:"ports,omitempty"`
	Environment map[string]string `json:"environment,omitempty"`
	DependsOn   []string          `json:"depends_on,omitempty"`
}

type ValidateComposeResponse struct {
	Valid    bool                       `json:"valid"`
	Services []ComposeSubServiceSummary `json:"services"`
	Errors   []string                   `json:"errors"`
}

type ComposeSubService struct {
	Name          string            `json:"name"`
	Image         string            `json:"image,omitempty"`
	ContainerID   string            `json:"container_id,omitempty"`
	ContainerName string            `json:"container_name,omitempty"`
	Status        string            `json:"status"` // "running", "stopped", "unhealthy"
	IPAddress     string            `json:"ip_address,omitempty"`
	Ports         []string          `json:"ports,omitempty"`
	Environment   map[string]string `json:"environment,omitempty"`
	DependsOn     []string          `json:"depends_on,omitempty"`
	CPUPercent    float64           `json:"cpu_percent,omitempty"`
	MemoryBytes   int64             `json:"memory_bytes,omitempty"`
}

type ComposeStackOverview struct {
	ServiceID      string              `json:"service_id"`
	ProjectID      string              `json:"project_id"`
	NetworkName    string              `json:"network_name"`
	ComposeContent string              `json:"compose_content,omitempty"`
	ComposePath    string              `json:"compose_path,omitempty"`
	SubServices    []ComposeSubService `json:"sub_services"`
}

type ServiceStatusEvent struct {
	ServiceID          string        `json:"service_id"`
	Status             ServiceStatus `json:"status"`
	ActiveDeploymentID *string       `json:"active_deployment_id"`
	UptimeSeconds      *int64        `json:"uptime_seconds"`
}

type BackupType string

const (
	BackupTypeDatabase     BackupType = "database"
	BackupTypeVolume       BackupType = "volume"
	BackupTypeControlPlane BackupType = "control_plane"
)

type BackupStatus string

const (
	BackupStatusPending   BackupStatus = "pending"
	BackupStatusRunning   BackupStatus = "running"
	BackupStatusCompleted BackupStatus = "completed"
	BackupStatusFailed    BackupStatus = "failed"
)

type BackupConfig struct {
	ID             string    `json:"id"`
	ServiceID      *string   `json:"service_id,omitempty"`
	Enabled        bool      `json:"enabled"`
	EndpointURL    string    `json:"endpoint_url"`
	Bucket         string    `json:"bucket"`
	Region         string    `json:"region"`
	AccessKey      string    `json:"access_key"`
	HasSecretKey   bool      `json:"has_secret_key"`
	CronExpression string    `json:"cron_expression"`
	RetentionCount int       `json:"retention_count"`
	CreatedAt      time.Time `json:"created_at"`
	UpdatedAt      time.Time `json:"updated_at"`
}

type UpdateBackupConfigRequest struct {
	Enabled        *bool   `json:"enabled,omitempty"`
	EndpointURL    *string `json:"endpoint_url,omitempty"`
	Bucket         *string `json:"bucket,omitempty"`
	Region         *string `json:"region,omitempty"`
	AccessKey      *string `json:"access_key,omitempty"`
	SecretKey      *string `json:"secret_key,omitempty"`
	CronExpression *string `json:"cron_expression,omitempty"`
	RetentionCount *int    `json:"retention_count,omitempty"`
}

type TestS3ConfigRequest struct {
	EndpointURL string `json:"endpoint_url"`
	Bucket      string `json:"bucket"`
	Region      string `json:"region"`
	AccessKey   string `json:"access_key"`
	SecretKey   string `json:"secret_key"`
}

type BackupRecord struct {
	ID                string       `json:"id"`
	ServiceID         *string      `json:"service_id,omitempty"`
	ServerID          *string      `json:"server_id,omitempty"`
	BackupType        BackupType   `json:"backup_type"`
	DatabaseEngine    *string      `json:"database_engine,omitempty"`
	Status            BackupStatus `json:"status"`
	FileName          string       `json:"file_name"`
	S3Key             string       `json:"s3_key"`
	FileSizeBytes     int64        `json:"file_size_bytes"`
	S3DestinationID   *string      `json:"s3_destination_id,omitempty"`
	S3DestinationName *string      `json:"s3_destination_name,omitempty"`
	ErrorMessage      *string      `json:"error_message,omitempty"`
	DownloadURL       *string      `json:"download_url,omitempty"`
	CreatedAt         time.Time    `json:"created_at"`
	CompletedAt       *time.Time   `json:"completed_at,omitempty"`
}

type TriggerBackupRequest struct {
	BackupType      *string `json:"backup_type,omitempty"`
	S3DestinationID *string `json:"s3_destination_id,omitempty"`
}

type ServiceBackupSchedule struct {
	ID                string    `json:"id"`
	ServiceID         string    `json:"service_id"`
	Enabled           bool      `json:"enabled"`
	S3DestinationID   *string   `json:"s3_destination_id,omitempty"`
	S3DestinationName *string   `json:"s3_destination_name,omitempty"`
	CronExpression    string    `json:"cron_expression"`
	RetentionCount    int       `json:"retention_count"`
	CreatedAt         time.Time `json:"created_at"`
	UpdatedAt         time.Time `json:"updated_at"`
}

type UpdateBackupScheduleRequest struct {
	Enabled         *bool   `json:"enabled,omitempty"`
	S3DestinationID *string `json:"s3_destination_id,omitempty"`
	CronExpression  *string `json:"cron_expression,omitempty"`
	RetentionCount  *int    `json:"retention_count,omitempty"`
}

type NotificationChannelType string

const (
	NotificationDiscord  NotificationChannelType = "discord"
	NotificationTelegram NotificationChannelType = "telegram"
)

type NotificationChannel struct {
	ID                 string                  `json:"id"`
	Type               NotificationChannelType `json:"type"`
	Name               string                  `json:"name"`
	Enabled            bool                    `json:"enabled"`
	WebhookURL         *string                 `json:"webhook_url,omitempty"`
	BotToken           *string                 `json:"bot_token,omitempty"`
	ChatID             *string                 `json:"chat_id,omitempty"`
	OnDeploySuccess    bool                    `json:"on_deploy_success"`
	OnDeployFailed     bool                    `json:"on_deploy_failed"`
	OnContainerCrashed bool                    `json:"on_container_crashed"`
	CreatedAt          time.Time               `json:"created_at"`
	UpdatedAt          time.Time               `json:"updated_at"`
}

type CreateNotificationChannelRequest struct {
	Type               NotificationChannelType `json:"type"`
	Name               string                  `json:"name"`
	Enabled            bool                    `json:"enabled"`
	WebhookURL         *string                 `json:"webhook_url,omitempty"`
	BotToken           *string                 `json:"bot_token,omitempty"`
	ChatID             *string                 `json:"chat_id,omitempty"`
	OnDeploySuccess    bool                    `json:"on_deploy_success"`
	OnDeployFailed     bool                    `json:"on_deploy_failed"`
	OnContainerCrashed bool                    `json:"on_container_crashed"`
}

type UpdateNotificationChannelRequest struct {
	Name               *string `json:"name,omitempty"`
	Enabled            *bool   `json:"enabled,omitempty"`
	WebhookURL         *string `json:"webhook_url,omitempty"`
	BotToken           *string `json:"bot_token,omitempty"`
	ChatID             *string `json:"chat_id,omitempty"`
	OnDeploySuccess    *bool   `json:"on_deploy_success,omitempty"`
	OnDeployFailed     *bool   `json:"on_deploy_failed,omitempty"`
	OnContainerCrashed *bool   `json:"on_container_crashed,omitempty"`
}

type NotificationEvent string

const (
	NotificationEventDeploySuccess    NotificationEvent = "deploy_success"
	NotificationEventDeployFailed     NotificationEvent = "deploy_failed"
	NotificationEventContainerCrashed NotificationEvent = "container_crashed"
)

type NotificationPayload struct {
	Event         NotificationEvent `json:"event"`
	ServiceID     string            `json:"service_id"`
	ServiceName   string            `json:"service_name"`
	CommitSHA     string            `json:"commit_sha,omitempty"`
	CommitAuthor  string            `json:"commit_author,omitempty"`
	CommitMessage string            `json:"commit_message,omitempty"`
	ErrorSnip     string            `json:"error_snip,omitempty"`
	Duration      int               `json:"duration_seconds,omitempty"`
}

type S3Destination struct {
	ID           string    `json:"id"`
	Name         string    `json:"name"`
	Endpoint     string    `json:"endpoint"`
	Region       string    `json:"region"`
	BucketName   string    `json:"bucket_name"`
	AccessKeyID  string    `json:"access_key_id"`
	UsePathStyle bool      `json:"use_path_style"`
	IsDefault    bool      `json:"is_default"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}

type CreateS3DestinationRequest struct {
	Name            string  `json:"name"`
	Endpoint        string  `json:"endpoint"`
	Region          *string `json:"region,omitempty"`
	BucketName      string  `json:"bucket_name"`
	AccessKeyID     string  `json:"access_key_id"`
	SecretAccessKey string  `json:"secret_access_key"`
	UsePathStyle    *bool   `json:"use_path_style,omitempty"`
	IsDefault       *bool   `json:"is_default,omitempty"`
}

type UpdateS3DestinationRequest struct {
	Name            *string `json:"name,omitempty"`
	Endpoint        *string `json:"endpoint,omitempty"`
	Region          *string `json:"region,omitempty"`
	BucketName      *string `json:"bucket_name,omitempty"`
	AccessKeyID     *string `json:"access_key_id,omitempty"`
	SecretAccessKey *string `json:"secret_access_key,omitempty"`
	UsePathStyle    *bool   `json:"use_path_style,omitempty"`
	IsDefault       *bool   `json:"is_default,omitempty"`
}

type TestS3DestinationRequest struct {
	Endpoint        string `json:"endpoint,omitempty"`
	Region          string `json:"region,omitempty"`
	BucketName      string `json:"bucket_name,omitempty"`
	AccessKeyID     string `json:"access_key_id,omitempty"`
	SecretAccessKey string `json:"secret_access_key,omitempty"`
	UsePathStyle    *bool  `json:"use_path_style,omitempty"`
}

type ConsoleDomainConfig struct {
	Domain      string    `json:"domain"`
	SSLProvider string    `json:"ssl_provider"`
	ForceHTTPS  bool      `json:"force_https"`
	SSLStatus   string    `json:"ssl_status"`
	SSLError    *string   `json:"ssl_error,omitempty"`
	CustomCert  *string   `json:"custom_cert,omitempty"`
	CustomKey   *string   `json:"custom_key,omitempty"`
	UpdatedAt   time.Time `json:"updated_at"`
}

type UpdateConsoleDomainRequest struct {
	Domain      string  `json:"domain"`
	SSLProvider *string `json:"ssl_provider,omitempty"`
	ForceHTTPS  *bool   `json:"force_https,omitempty"`
	CustomCert  *string `json:"custom_cert,omitempty"`
	CustomKey   *string `json:"custom_key,omitempty"`
}

type VerifyConsoleDomainRequest struct {
	Domain string `json:"domain"`
}

type VerifyConsoleDomainResponse struct {
	Matches      bool     `json:"matches"`
	Domain       string   `json:"domain"`
	ExpectedIP   string   `json:"expected_ip"`
	ResolvedIPs  []string `json:"resolved_ips"`
	ErrorMessage *string  `json:"error_message,omitempty"`
}


