package handlers

import (
	"database/sql"
	"net/http"

	"github.com/go-chi/chi/v5"

	"gettako.dev/tako/server/auth"
	"gettako.dev/tako/server/backup"
	"gettako.dev/tako/server/deploy"
	"gettako.dev/tako/server/dns"
	"gettako.dev/tako/server/github"
	"gettako.dev/tako/server/monitoring"
	"gettako.dev/tako/server/nodes"
	"gettako.dev/tako/server/audit"
	"gettako.dev/tako/server/notifications"
)

type Handler struct {
	db             *sql.DB
	masterKey      []byte
	domain         string
	nodeManager    *nodes.NodeManager
	orchestrator   *deploy.Orchestrator
	dnsChecker     *dns.DNSChecker
	githubClient   *github.Client
	webhookSecret  string
	backupManager  *backup.ServiceBackupManager
	metricsManager *monitoring.MetricsManager
	notifier       *notifications.Dispatcher
	auditManager   *audit.Manager
}

func NewHandler(db *sql.DB, masterKey []byte, domain string) *Handler {
	var mm *monitoring.MetricsManager
	if db != nil {
		mm = monitoring.NewMetricsManager(db)
	}
	return &Handler{
		db:             db,
		masterKey:      masterKey,
		domain:         domain,
		dnsChecker:     dns.NewDNSChecker(nil),
		metricsManager: mm,
	}
}

func (h *Handler) SetNodeManager(nm *nodes.NodeManager) {
	h.nodeManager = nm
}

func (h *Handler) SetOrchestrator(orc *deploy.Orchestrator) {
	h.orchestrator = orc
}

func (h *Handler) SetDNSChecker(c *dns.DNSChecker) {
	h.dnsChecker = c
}

func (h *Handler) SetGitHubClient(gc *github.Client) {
	h.githubClient = gc
}

func (h *Handler) SetWebhookSecret(secret string) {
	h.webhookSecret = secret
}

func (h *Handler) SetBackupManager(bm *backup.ServiceBackupManager) {
	h.backupManager = bm
}

func (h *Handler) SetMetricsManager(mm *monitoring.MetricsManager) {
	h.metricsManager = mm
}

func (h *Handler) SetNotifier(n *notifications.Dispatcher) {
	h.notifier = n
}

func (h *Handler) SetAuditManager(am *audit.Manager) {
	h.auditManager = am
}

func (h *Handler) GetAuditLog(w http.ResponseWriter, r *http.Request) {
	if h.auditManager != nil {
		h.auditManager.HandleList(w, r)
		return
	}
	if mgr := audit.GetDefaultManager(); mgr != nil {
		mgr.HandleList(w, r)
		return
	}
	sendError(w, http.StatusInternalServerError, "Audit manager not configured")
}

func (h *Handler) RegisterRoutes(r chi.Router) {
	// Public Invitation Endpoints
	r.Get("/invites/validate", h.ValidateInvite)
	r.Post("/invites/accept", h.AcceptInvite)

	r.Group(func(protected chi.Router) {
		protected.Use(auth.RequireAuth(h.db))

		// Projects
		protected.Get("/projects", h.ListProjects)
		protected.Post("/projects", h.CreateProject)
		protected.Get("/projects/{id}", h.GetProject)
		protected.Patch("/projects/{id}", h.UpdateProject)
		protected.Delete("/projects/{id}", h.DeleteProject)

		// Services
		protected.Get("/services", h.ListServices)
		protected.Post("/services", h.CreateService)
		protected.Post("/services/validate-compose", h.ValidateCompose)
		protected.Get("/services/{id}", h.GetService)
		protected.Patch("/services/{id}", h.UpdateService)
		protected.Delete("/services/{id}", h.DeleteService)
		protected.Post("/services/{id}/start", h.StartService)
		protected.Post("/services/{id}/stop", h.StopService)
		protected.Post("/services/{id}/restart", h.RestartService)
		protected.Post("/services/{id}/rebuild", h.RebuildService)
		protected.Post("/services/{id}/redeploy", h.RedeployService)
		protected.Post("/services/{id}/pull-update", h.PullUpdateService)
		protected.Post("/services/{id}/inject-connection-string", h.InjectConnectionString)
		protected.Get("/services/{id}/stack", h.GetStackOverview)
		protected.Get("/services/{id}/logs/runtime", h.StreamRuntimeLogs)
		protected.Get("/services/{id}/status", h.StreamServiceStatus)
		protected.Get("/services/{id}/terminal", h.HandleServiceTerminal)
		protected.Get("/services/{id}/metrics", h.GetServiceMetrics)

		// Service Backups
		protected.Get("/services/{id}/backups", h.ListServiceBackups)
		protected.Post("/services/{id}/backups", h.TriggerServiceBackup)
		protected.Get("/services/{id}/backup-schedule", h.GetServiceBackupSchedule)
		protected.Put("/services/{id}/backup-schedule", h.UpdateServiceBackupSchedule)
		protected.Get("/services/{id}/backups/{backup_id}/download", h.DownloadServiceBackup)
		protected.Post("/services/{id}/backups/{backup_id}/restore", h.RestoreServiceBackup)
		protected.Delete("/services/{id}/backups/{backup_id}", h.DeleteServiceBackup)

		// Deployments
		protected.Get("/services/{id}/deployments", h.ListDeployments)
		protected.Post("/services/{id}/deployments", h.CreateDeployment)
		protected.Get("/services/{id}/deployments/{deployment_id}", h.GetDeployment)
		protected.Post("/services/{id}/deployments/{deployment_id}/cancel", h.CancelDeployment)
		protected.Post("/services/{id}/deployments/{deployment_id}/rollback", h.RollbackDeployment)

		// Previews
		protected.Get("/services/{id}/previews", h.ListServicePreviews)
		protected.Delete("/services/{id}/previews/{preview_id}", h.DeleteServicePreview)
		protected.Post("/services/{id}/previews/{preview_id}/kill", h.DeleteServicePreview)

		// Build Logs
		protected.Get("/services/{id}/logs/build", h.StreamBuildLogs)

		// Domains
		protected.Get("/services/{id}/domains", h.ListDomains)
		protected.Post("/services/{id}/domains", h.AddDomain)
		protected.Patch("/services/{id}/domains/{domain}", h.UpdateDomain)
		protected.Delete("/services/{id}/domains/{domain}", h.DeleteDomain)
		protected.Post("/services/{id}/domains/{domain}/check-ssl", h.CheckDomainSSL)

		// Environment Variables & Secrets
		protected.Get("/services/{id}/env", h.GetServiceEnv)
		protected.Put("/services/{id}/env", h.UpdateServiceEnv)

		// Servers (Read operations accessible to all authenticated users)
		protected.Get("/servers", h.ListServers)
		protected.Get("/servers/{id}", h.GetServer)

		// Administrator Only Routes
		protected.Group(func(admin chi.Router) {
			admin.Use(auth.RequireAdmin)

			// Server Management
			admin.Post("/servers", h.CreateServer)
			admin.Delete("/servers/{id}", h.DeleteServer)
			admin.Post("/servers/{id}/prune", h.PruneServer)
			admin.Get("/servers/{id}/traefik/config", h.GetServerTraefikConfig)
			admin.Put("/servers/{id}/traefik/config", h.UpdateServerTraefikConfig)
			admin.Post("/servers/{id}/traefik/restart", h.RestartServerTraefik)

			// User Management
			admin.Get("/users", h.ListUsers)
			admin.Patch("/users/{id}/role", h.UpdateUserRole)
			admin.Delete("/users/{id}", h.DeleteUser)

			// Invites
			admin.Post("/invites", h.CreateInvite)
			admin.Get("/invites", h.ListInvites)
			admin.Delete("/invites/{id}", h.RevokeInvite)
		})

		// Console Domain & SSL Configuration
		protected.Get("/settings/console-domain", h.GetConsoleDomainConfig)
		protected.Put("/settings/console-domain", h.UpdateConsoleDomainConfig)
		protected.Post("/settings/console-domain/verify", h.VerifyConsoleDomainDNS)

		// S3 Backup Configuration & Control Plane SQLite Backups
		protected.Get("/settings/backup", h.GetBackupConfig)
		protected.Put("/settings/backup", h.UpdateBackupConfig)
		protected.Post("/settings/backup/test", h.TestBackupStorage)
		protected.Get("/settings/backup/records", h.ListControlPlaneBackups)
		protected.Post("/settings/backup/trigger", h.TriggerControlPlaneBackup)
		protected.Get("/settings/backup/records/{id}/download", h.DownloadControlPlaneBackup)
		protected.Delete("/settings/backup/records/{id}", h.DeleteControlPlaneBackup)

		// GitHub
		protected.Get("/github/status", h.GetGitHubStatus)
		protected.Get("/github/repos", h.ListGitHubRepos)
		protected.Get("/github/repos/{owner}/{repo}/branches", h.ListGitHubBranches)
		protected.Get("/github/manifest", h.GetGitHubManifest)
		protected.Post("/github/manifest/exchange", h.ExchangeGitHubManifest)
		protected.Post("/github/sync-installations", h.SyncGitHubInstallations)
		protected.Get("/github/connections", h.ListGitHubConnections)
		protected.Post("/github/connections", h.CreateGitHubConnection)
		protected.Delete("/github/connections/{id}", h.DeleteGitHubConnection)
		protected.Get("/github/connections/{id}/repos", h.ListConnectionRepos)
		protected.Get("/github/connections/{id}/repos/{owner}/{repo}/branches", h.ListConnectionBranches)

		// Notification Channels
		protected.Get("/settings/notifications", h.ListNotificationChannels)
		protected.Post("/settings/notifications", h.CreateNotificationChannel)
		protected.Patch("/settings/notifications/{id}", h.UpdateNotificationChannel)
		protected.Delete("/settings/notifications/{id}", h.DeleteNotificationChannel)
		protected.Post("/settings/notifications/{id}/test", h.TestNotificationChannel)

		// S3 Storage Destinations
		protected.Get("/storage/s3", h.ListS3Destinations)
		protected.Post("/storage/s3", h.CreateS3Destination)
		protected.Patch("/storage/s3/{id}", h.UpdateS3Destination)
		protected.Delete("/storage/s3/{id}", h.DeleteS3Destination)
		protected.Post("/storage/s3/{id}/test", h.TestS3Destination)
		protected.Post("/storage/s3/test", h.TestS3DestinationRaw)

		// Audit Log
		protected.Get("/audit-log", h.GetAuditLog)
	})

	// Public Webhooks
	r.Post("/github/webhook", h.HandleGitHubWebhook)
	r.Post("/github/webhook/{connection_id}", h.HandleGitHubWebhookByConnection)
}
