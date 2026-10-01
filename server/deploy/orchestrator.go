package deploy

import (
	"context"
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"strings"
	"sync"
	"time"

	"gettako.dev/tako/internal/crypto"
	"gettako.dev/tako/internal/models"
	"gettako.dev/tako/internal/protocol"
	"gettako.dev/tako/server/github"
	"gettako.dev/tako/server/nodes"
)

type LogBuffer struct {
	mu        sync.RWMutex
	events    []*models.BuildLogStreamEvent
	maxSize   int
	completed bool
}

func newLogBuffer(maxSize int) *LogBuffer {
	if maxSize <= 0 {
		maxSize = 2000
	}
	return &LogBuffer{
		events:  make([]*models.BuildLogStreamEvent, 0, 100),
		maxSize: maxSize,
	}
}

func (b *LogBuffer) Append(evt *models.BuildLogStreamEvent) {
	b.mu.Lock()
	defer b.mu.Unlock()
	if len(b.events) >= b.maxSize {
		b.events = b.events[1:]
	}
	b.events = append(b.events, evt)
	if evt.Event == "build_complete" {
		b.completed = true
	}
}

func (b *LogBuffer) GetAll() ([]*models.BuildLogStreamEvent, bool) {
	b.mu.RLock()
	defer b.mu.RUnlock()
	res := make([]*models.BuildLogStreamEvent, len(b.events))
	copy(res, b.events)
	return res, b.completed
}

type RuntimeLogBuffer struct {
	mu      sync.RWMutex
	events  []*models.ContainerLogEvent
	maxSize int
}

func newRuntimeLogBuffer(maxSize int) *RuntimeLogBuffer {
	if maxSize <= 0 {
		maxSize = 1000
	}
	return &RuntimeLogBuffer{
		events:  make([]*models.ContainerLogEvent, 0, 50),
		maxSize: maxSize,
	}
}

func (b *RuntimeLogBuffer) Append(evt *models.ContainerLogEvent) {
	b.mu.Lock()
	defer b.mu.Unlock()
	if len(b.events) >= b.maxSize {
		b.events = b.events[1:]
	}
	b.events = append(b.events, evt)
}

func (b *RuntimeLogBuffer) GetAll() []*models.ContainerLogEvent {
	b.mu.RLock()
	defer b.mu.RUnlock()
	res := make([]*models.ContainerLogEvent, len(b.events))
	copy(res, b.events)
	return res
}

type Orchestrator struct {
	db           *sql.DB
	nodeManager  *nodes.NodeManager
	masterKey    []byte
	notifyHook   func(models.NotificationPayload)
	githubClient *github.Client

	mu                 sync.RWMutex
	buffers            map[string]*LogBuffer
	subscribers        map[string]map[chan *models.BuildLogStreamEvent]struct{}
	runtimeBuffers     map[string]*RuntimeLogBuffer
	runtimeSubscribers map[string]map[chan *models.ContainerLogEvent]struct{}
}

func NewOrchestrator(db *sql.DB, nm *nodes.NodeManager, masterKey []byte) *Orchestrator {
	return &Orchestrator{
		db:                 db,
		nodeManager:        nm,
		masterKey:          masterKey,
		buffers:            make(map[string]*LogBuffer),
		subscribers:        make(map[string]map[chan *models.BuildLogStreamEvent]struct{}),
		runtimeBuffers:     make(map[string]*RuntimeLogBuffer),
		runtimeSubscribers: make(map[string]map[chan *models.ContainerLogEvent]struct{}),
	}
}

// SetGitHubClient configures the global GitHub client fallback for the orchestrator.
func (o *Orchestrator) SetGitHubClient(client *github.Client) {
	o.githubClient = client
}

// SetNotifyHook registers a callback invoked asynchronously on deploy_success or deploy_failed.
func (o *Orchestrator) SetNotifyHook(fn func(models.NotificationPayload)) {
	o.notifyHook = fn
}

func (o *Orchestrator) getClientForConnection(ctx context.Context, connectionID string) (*github.Client, error) {
	var authType, accountName string
	var appID, installationID sql.NullString
	var tokenEnc []byte
	err := o.db.QueryRowContext(ctx, `
		SELECT auth_type, account_name, token_enc, app_id, installation_id
		FROM github_connections WHERE id = ?
	`, connectionID).Scan(&authType, &accountName, &tokenEnc, &appID, &installationID)
	if err != nil {
		return nil, err
	}

	if len(tokenEnc) < 12 {
		return nil, errors.New("invalid encrypted token data")
	}

	nonce := tokenEnc[:12]
	ciphertext := tokenEnc[12:]
	tokenBytes, err := crypto.Decrypt(ciphertext, nonce, o.masterKey)
	if err != nil {
		return nil, fmt.Errorf("failed to decrypt credentials: %w", err)
	}

	cfg := github.ClientConfig{
		BaseURL: func() string {
			if o.githubClient != nil {
				return o.githubClient.BaseURL()
			}
			return ""
		}(),
		HTTPClient: func() *http.Client {
			if o.githubClient != nil {
				return o.githubClient.HTTPClient()
			}
			return nil
		}(),
	}

	if authType == "pat" {
		cfg.PAT = string(tokenBytes)
	} else if authType == "app" {
		if appID.Valid {
			cfg.AppID = appID.String
		}
		if installationID.Valid {
			cfg.InstallationID = installationID.String
		}
		if strings.Contains(string(tokenBytes), "-----BEGIN") {
			cfg.PrivateKeyPEM = tokenBytes
		} else {
			cfg.PAT = string(tokenBytes)
		}
	}

	return github.NewClient(cfg)
}

func (o *Orchestrator) resolveGitToken(ctx context.Context, connID sql.NullString, repo string) string {
	if o.db == nil {
		if o.githubClient != nil {
			tok, _ := o.githubClient.GetAuthToken(ctx)
			return tok
		}
		return ""
	}

	// 1. If connection ID is explicitly associated with service
	if connID.Valid && strings.TrimSpace(connID.String) != "" {
		if client, err := o.getClientForConnection(ctx, connID.String); err == nil && client != nil {
			if tok, err := client.GetAuthToken(ctx); err == nil && tok != "" {
				return tok
			}
		}
	}

	// 2. Try to match by repository owner
	normRepo := strings.TrimSpace(strings.ToLower(repo))
	normRepo = strings.TrimSuffix(normRepo, ".git")
	normRepo = strings.TrimPrefix(normRepo, "https://github.com/")
	normRepo = strings.TrimPrefix(normRepo, "http://github.com/")
	normRepo = strings.TrimPrefix(normRepo, "git@github.com:")
	normRepo = strings.TrimPrefix(normRepo, "github.com/")
	normRepo = strings.Trim(normRepo, "/")
	parts := strings.Split(normRepo, "/")

	if len(parts) >= 1 && parts[0] != "" {
		owner := parts[0]
		var foundConnID string
		_ = o.db.QueryRowContext(ctx, `
			SELECT id FROM github_connections
			WHERE LOWER(account_name) = LOWER(?)
			ORDER BY updated_at DESC LIMIT 1
		`, owner).Scan(&foundConnID)
		if foundConnID != "" {
			if client, err := o.getClientForConnection(ctx, foundConnID); err == nil && client != nil {
				if tok, err := client.GetAuthToken(ctx); err == nil && tok != "" {
					return tok
				}
			}
		}
	}

	// 3. If there is a single active connection, use it
	var singleConnID string
	var totalConns int
	_ = o.db.QueryRowContext(ctx, `SELECT count(*), max(id) FROM github_connections`).Scan(&totalConns, &singleConnID)
	if totalConns == 1 && singleConnID != "" {
		if client, err := o.getClientForConnection(ctx, singleConnID); err == nil && client != nil {
			if tok, err := client.GetAuthToken(ctx); err == nil && tok != "" {
				return tok
			}
		}
	}

	// 4. Global GitHub client fallback
	if o.githubClient != nil {
		tok, _ := o.githubClient.GetAuthToken(ctx)
		return tok
	}

	return ""
}

func generateID(prefix string) string {
	b := make([]byte, 6)
	_, _ = rand.Read(b)
	return prefix + "_" + hex.EncodeToString(b)
}

func (o *Orchestrator) TriggerDeployment(ctx context.Context, serviceID string, req *models.CreateDeploymentRequest) (*models.Deployment, error) {
	var s models.Service
	var pDom, actDep sql.NullString
	var createdAtStr, updatedAtStr string
	var deployKeyPrivEnc, deployKeyNonce []byte
	var sType string
	var pParentID, pCmd, pCronExpr sql.NullString
	var pDBEngine, pDBVersion, pDBName, pDBUser, pVolName, pVolMount, pConnURI sql.NullString
	var pPreDeploy, pPostDeploy sql.NullString
	var pGitHubConnID sql.NullString

	var pPubPort sql.NullInt64
	err := o.db.QueryRowContext(ctx, `
		SELECT id, project_id, server_id, name, service_type, parent_service_id, command, cron_expression,
		       repository, branch, dockerfile_path, internal_port, published_port, health_check_path, status,
		       primary_domain, active_deployment_id, created_at, updated_at,
		       deploy_key_private_encrypted, deploy_key_nonce,
		       database_engine, database_version, database_name, database_user,
		       volume_name, volume_mount_path, connection_uri,
		       pre_deploy_command, post_deploy_command,
		       github_connection_id
		FROM services WHERE id = ?
	`, serviceID).Scan(
		&s.ID, &s.ProjectID, &s.ServerID, &s.Name, &sType, &pParentID, &pCmd, &pCronExpr,
		&s.Repository, &s.Branch, &s.DockerfilePath, &s.InternalPort, &pPubPort, &s.HealthCheckPath, &s.Status,
		&pDom, &actDep, &createdAtStr, &updatedAtStr,
		&deployKeyPrivEnc, &deployKeyNonce,
		&pDBEngine, &pDBVersion, &pDBName, &pDBUser,
		&pVolName, &pVolMount, &pConnURI,
		&pPreDeploy, &pPostDeploy,
		&pGitHubConnID,
	)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("service not found")
		}
		return nil, fmt.Errorf("database error: %w", err)
	}

	if sType == "" {
		s.ServiceType = models.ServiceTypeWeb
	} else {
		s.ServiceType = models.ServiceType(sType)
	}
	if pPubPort.Valid {
		val := int(pPubPort.Int64)
		s.PublishedPort = &val
	}
	if pParentID.Valid {
		s.ParentServiceID = &pParentID.String
	}
	if pCmd.Valid {
		s.Command = &pCmd.String
	}
	if pCronExpr.Valid {
		s.CronExpression = &pCronExpr.String
	}
	if pPreDeploy.Valid {
		s.PreDeployCommand = &pPreDeploy.String
	}
	if pPostDeploy.Valid {
		s.PostDeployCommand = &pPostDeploy.String
	}
	if pDBEngine.Valid {
		s.DatabaseEngine = &pDBEngine.String
	}
	if pDBVersion.Valid {
		s.DatabaseVersion = &pDBVersion.String
	}
	if pDBName.Valid {
		s.DatabaseName = &pDBName.String
	}
	if pDBUser.Valid {
		s.DatabaseUser = &pDBUser.String
	}
	if pVolName.Valid {
		s.VolumeName = &pVolName.String
	}
	if pVolMount.Valid {
		s.VolumeMountPath = &pVolMount.String
	}
	if pConnURI.Valid {
		s.ConnectionURI = &pConnURI.String
	}

	branch := s.Branch
	if req != nil && req.Branch != nil && *req.Branch != "" {
		branch = *req.Branch
	}
	commitSHA := ""
	if req != nil && req.CommitSHA != nil && *req.CommitSHA != "" {
		commitSHA = *req.CommitSHA
	}
	commitMsg := ""
	if req != nil && req.CommitMessage != nil {
		commitMsg = *req.CommitMessage
	}
	commitAuthor := ""
	if req != nil && req.CommitAuthor != nil {
		commitAuthor = *req.CommitAuthor
	}
	triggerType := "manual"
	if req != nil && req.TriggerType != nil && *req.TriggerType != "" {
		triggerType = *req.TriggerType
	}

	var sshPrivateKey string
	if len(deployKeyPrivEnc) > 0 && len(deployKeyNonce) > 0 {
		decrypted, decErr := crypto.Decrypt(deployKeyPrivEnc, deployKeyNonce, o.masterKey)
		if decErr == nil {
			sshPrivateKey = string(decrypted)
		}
	}

	if !pGitHubConnID.Valid && s.ParentServiceID != nil && *s.ParentServiceID != "" {
		var parentConnID sql.NullString
		_ = o.db.QueryRowContext(ctx, `SELECT github_connection_id FROM services WHERE id = ?`, *s.ParentServiceID).Scan(&parentConnID)
		if parentConnID.Valid {
			pGitHubConnID = parentConnID
		}
	}
	if sshPrivateKey == "" && s.ParentServiceID != nil && *s.ParentServiceID != "" {
		var pKeyEnc, pKeyNonce []byte
		_ = o.db.QueryRowContext(ctx, `SELECT deploy_key_private_encrypted, deploy_key_nonce FROM services WHERE id = ?`, *s.ParentServiceID).Scan(&pKeyEnc, &pKeyNonce)
		if len(pKeyEnc) > 0 && len(pKeyNonce) > 0 {
			decrypted, decErr := crypto.Decrypt(pKeyEnc, pKeyNonce, o.masterKey)
			if decErr == nil {
				sshPrivateKey = string(decrypted)
			}
		}
	}

	gitToken := o.resolveGitToken(ctx, pGitHubConnID, s.Repository)

	envVars := make(map[string]string)
	buildArgs := make(map[string]string)

	// If auxiliary service, inherit parent service's environment variables first
	if s.ParentServiceID != nil && *s.ParentServiceID != "" {
		pRows, pErr := o.db.QueryContext(ctx, `
			SELECT type, key, value_encrypted, nonce, is_secret
			FROM env_vars WHERE service_id = ?
		`, *s.ParentServiceID)
		if pErr == nil {
			defer pRows.Close()
			for pRows.Next() {
				var varType, key string
				var valEncrypted, nonce []byte
				var isSecret bool
				if err := pRows.Scan(&varType, &key, &valEncrypted, &nonce, &isSecret); err == nil {
					// TASK-06: Isolate Preview Secrets - do not inherit production secrets into preview environments
					if s.IsPreview && isSecret {
						continue
					}
					decrypted, decErr := crypto.Decrypt(valEncrypted, nonce, o.masterKey)
					if decErr == nil {
						if varType == "build" {
							buildArgs[key] = string(decrypted)
						} else {
							envVars[key] = string(decrypted)
						}
					}
				}
			}
		}
	}

	// Overlay service's own environment variables
	rows, err := o.db.QueryContext(ctx, `
		SELECT type, key, value_encrypted, nonce
		FROM env_vars WHERE service_id = ?
	`, serviceID)
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var varType, key string
			var valEncrypted, nonce []byte
			if err := rows.Scan(&varType, &key, &valEncrypted, &nonce); err == nil {
				decrypted, decErr := crypto.Decrypt(valEncrypted, nonce, o.masterKey)
				if decErr == nil {
					if varType == "build" {
						buildArgs[key] = string(decrypted)
					} else {
						envVars[key] = string(decrypted)
					}
				}
			}
		}
	}

	primaryDomain := ""
	if pDom.Valid {
		primaryDomain = pDom.String
	} else {
		var d string
		if err := o.db.QueryRowContext(ctx, `SELECT domain FROM domains WHERE service_id = ? LIMIT 1`, serviceID).Scan(&d); err == nil {
			primaryDomain = d
		}
	}

	// Check if parent has an active deployment image to inherit
	var parentImageTag string
	if s.ParentServiceID != nil && *s.ParentServiceID != "" {
		_ = o.db.QueryRowContext(ctx, `
			SELECT d.image_tag
			FROM services p
			JOIN deployments d ON d.id = p.active_deployment_id
			WHERE p.id = ?
		`, *s.ParentServiceID).Scan(&parentImageTag)
	}

	isRollback := false
	rollbackTag := ""
	if parentImageTag != "" {
		isRollback = true
		rollbackTag = parentImageTag
	} else if req != nil && req.IsRollback != nil && *req.IsRollback {
		isRollback = true
		if req.RollbackImageTag != nil {
			rollbackTag = *req.RollbackImageTag
		}
	}

	depID := generateID("dep")
	now := time.Now()

	_, err = o.db.ExecContext(ctx, `
		INSERT INTO deployments (
			id, service_id, status, branch, commit_sha, commit_message, commit_author, trigger_type, started_at, created_at
		) VALUES (?, ?, 'building', ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
	`, depID, serviceID, branch, commitSHA, commitMsg, commitAuthor, triggerType)
	if err != nil {
		return nil, fmt.Errorf("failed to create deployment record: %w", err)
	}

	_, _ = o.db.ExecContext(ctx, `UPDATE services SET status = 'building', updated_at = CURRENT_TIMESTAMP WHERE id = ?`, serviceID)

	o.mu.Lock()
	o.buffers[depID] = newLogBuffer(2000)
	o.mu.Unlock()

	if o.nodeManager != nil {
		cmdStr := ""
		if s.Command != nil {
			cmdStr = *s.Command
		}
		cronStr := ""
		if s.CronExpression != nil {
			cronStr = *s.CronExpression
		}
		parentIDStr := ""
		if s.ParentServiceID != nil {
			parentIDStr = *s.ParentServiceID
		}

		volNameStr := ""
		if s.VolumeName != nil {
			volNameStr = *s.VolumeName
		}
		volMountStr := ""
		if s.VolumeMountPath != nil {
			volMountStr = *s.VolumeMountPath
		}
		imageStr := ""
		if s.ServiceType == models.ServiceTypeDatabase {
			engine := "postgres"
			if s.DatabaseEngine != nil && *s.DatabaseEngine != "" {
				engine = *s.DatabaseEngine
			}
			version := "16-alpine"
			if s.DatabaseVersion != nil && *s.DatabaseVersion != "" {
				version = *s.DatabaseVersion
			}
			if strings.Contains(version, ":") {
				imageStr = version
			} else {
				imageStr = fmt.Sprintf("%s:%s", engine, version)
			}
		}

		var ingressRules []*protocol.IngressRule
		if domRows, err := o.db.QueryContext(ctx, `
			SELECT id, service_id, domain, port, path_prefix, strip_prefix, is_canonical,
			       redirect_mode, auth_enabled, auth_user, auth_password, entrypoints, ssl_resolver
			FROM domains
			WHERE service_id = ?
			ORDER BY is_canonical DESC, created_at ASC
		`, serviceID); err == nil {
			defer domRows.Close()
			for domRows.Next() {
				var rID, sID, dom, pathPrefix, redirMode, authUser, authPw, entrypoints, sslResolver string
				var port int
				var stripPrefix, isCanonical, authEnabled bool
				if err := domRows.Scan(
					&rID, &sID, &dom, &port, &pathPrefix, &stripPrefix, &isCanonical,
					&redirMode, &authEnabled, &authUser, &authPw, &entrypoints, &sslResolver,
				); err == nil {
					if primaryDomain == "" && isCanonical {
						primaryDomain = dom
					}
					ingressRules = append(ingressRules, &protocol.IngressRule{
						RuleId:       rID,
						Domain:       dom,
						Port:         int32(port),
						PathPrefix:   pathPrefix,
						StripPrefix:  stripPrefix,
						IsCanonical:  isCanonical,
						RedirectMode: redirMode,
						AuthEnabled:  authEnabled,
						AuthUser:     authUser,
						AuthPassword: authPw,
						Entrypoints:  entrypoints,
						SslResolver:  sslResolver,
						ServiceId:    sID,
					})
				}
			}
		}

		if primaryDomain == "" && len(ingressRules) > 0 {
			primaryDomain = ingressRules[0].Domain
		}

		publishedPort := int32(0)
		if s.PublishedPort != nil && *s.PublishedPort > 0 {
			publishedPort = int32(*s.PublishedPort)
		} else if primaryDomain == "" && s.ServiceType != models.ServiceTypeWorker && s.ServiceType != models.ServiceTypeCron {
			publishedPort = int32(s.InternalPort)
		}

		deployJob := &protocol.DeployJob{
			DeploymentId:     depID,
			ServiceId:        serviceID,
			Repository:       s.Repository,
			Branch:           branch,
			CommitSha:        commitSHA,
			DockerfilePath:   s.DockerfilePath,
			InternalPort:     int32(s.InternalPort),
			PublishedPort:    publishedPort,
			HealthCheckPath:  s.HealthCheckPath,
			EnvVars:          envVars,
			BuildArgs:        buildArgs,
			Domain:           primaryDomain,
			IngressRules:     ingressRules,
			SshPrivateKey:    sshPrivateKey,
			IsRollback:       isRollback,
			RollbackImageTag: rollbackTag,
			ServiceType:      string(s.ServiceType),
			Command:          cmdStr,
			CronExpression:   cronStr,
			ParentServiceId:  parentIDStr,
			VolumeName:       volNameStr,
			VolumeMountPath:  volMountStr,
			Image:            imageStr,
			PreDeployCommand: func() string {
				if s.PreDeployCommand != nil {
					return *s.PreDeployCommand
				}
				return ""
			}(),
			PostDeployCommand: func() string {
				if s.PostDeployCommand != nil {
					return *s.PostDeployCommand
				}
				return ""
			}(),
			ProjectId: s.ProjectID,
			ComposeFileContent: func() string {
				if s.ComposeFileContent != nil {
					return *s.ComposeFileContent
				}
				return ""
			}(),
			ComposeFilePath: func() string {
				if s.ComposeFilePath != nil {
					return *s.ComposeFilePath
				}
				return ""
			}(),
			GitToken: gitToken,
		}

		err = o.nodeManager.SendCommand(ctx, s.ServerID, &protocol.ServerMessage{
			Payload: &protocol.ServerMessage_DeployJob{
				DeployJob: deployJob,
			},
		})
		if err != nil {
			slog.Warn("failed to dispatch deploy job to agent",
				slog.String("server_id", s.ServerID),
				slog.String("deployment_id", depID),
				slog.String("error", err.Error()),
			)
			errReason := fmt.Sprintf("failed to dispatch job to agent: %v", err)
			o.HandleDeploymentStatus(s.ServerID, &protocol.DeploymentStatusTransition{
				DeploymentId: depID,
				Status:       "failed",
				ErrorReason:  errReason,
			})
		}
	}

	dep := &models.Deployment{
		ID:            depID,
		ServiceID:     serviceID,
		Status:        models.DeploymentBuilding,
		Branch:        branch,
		CommitSHA:     commitSHA,
		CommitMessage: commitMsg,
		CommitAuthor:  commitAuthor,
		TriggerType:   triggerType,
		StartedAt:     &now,
		CreatedAt:     now,
	}

	return dep, nil
}

func (o *Orchestrator) CancelDeployment(ctx context.Context, serviceID, deploymentID string) (*models.Deployment, error) {
	var status string
	var serverID string
	err := o.db.QueryRowContext(ctx, `
		SELECT d.status, s.server_id
		FROM deployments d
		JOIN services s ON s.id = d.service_id
		WHERE d.id = ? AND d.service_id = ?
	`, deploymentID, serviceID).Scan(&status, &serverID)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("deployment not found")
		}
		return nil, err
	}

	if status == "success" || status == "failed" || status == "cancelled" {
		return nil, fmt.Errorf("deployment is already finished (%s)", status)
	}

	if o.nodeManager != nil {
		_ = o.nodeManager.SendCommand(ctx, serverID, &protocol.ServerMessage{
			Payload: &protocol.ServerMessage_CancelDeploy{
				CancelDeploy: &protocol.CancelDeploy{
					DeploymentId: deploymentID,
					ServiceId:    serviceID,
				},
			},
		})
	}

	now := time.Now()
	_, _ = o.db.ExecContext(ctx, `
		UPDATE deployments SET
			status = 'cancelled',
			finished_at = CURRENT_TIMESTAMP
		WHERE id = ?
	`, deploymentID)

	_, _ = o.db.ExecContext(ctx, `
		UPDATE services SET status = 'stopped', updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'building'
	`, serviceID)

	cancelMsg := "deployment cancelled by user"
	o.BroadcastEvent(deploymentID, &models.BuildLogStreamEvent{
		Event:  "build_complete",
		Status: "failed",
		Error:  &cancelMsg,
	})

	return &models.Deployment{
		ID:         deploymentID,
		ServiceID:  serviceID,
		Status:     models.DeploymentCancelled,
		FinishedAt: &now,
	}, nil
}

func (o *Orchestrator) SubscribeBuildLogs(ctx context.Context, deploymentID string) (<-chan *models.BuildLogStreamEvent, func(), error) {
	o.mu.Lock()
	buf, exists := o.buffers[deploymentID]
	if !exists {
		buf = newLogBuffer(2000)
		o.buffers[deploymentID] = buf

		if o.db != nil {
			var status, imgTag, errTrace string
			var duration int
			err := o.db.QueryRowContext(ctx, `
				SELECT status, COALESCE(image_tag, ''), COALESCE(error_trace, ''), COALESCE(duration_seconds, 0)
				FROM deployments WHERE id = ?
			`, deploymentID).Scan(&status, &imgTag, &errTrace, &duration)
			if err == nil && (status == "success" || status == "failed" || status == "cancelled") {
				compStatus := "success"
				if status != "success" {
					compStatus = "failed"
				}
				var errPtr *string
				if errTrace != "" {
					errPtr = &errTrace
				}
				var imgPtr *string
				if imgTag != "" {
					imgPtr = &imgTag
				}
				buf.Append(&models.BuildLogStreamEvent{
					Event:           "build_complete",
					Status:          compStatus,
					ImageTag:        imgPtr,
					DurationSeconds: &duration,
					Error:           errPtr,
				})
			}
		}
	}

	history, completed := buf.GetAll()
	ch := make(chan *models.BuildLogStreamEvent, len(history)+500)
	if o.subscribers[deploymentID] == nil {
		o.subscribers[deploymentID] = make(map[chan *models.BuildLogStreamEvent]struct{})
	}
	o.subscribers[deploymentID][ch] = struct{}{}
	o.mu.Unlock()

	for _, evt := range history {
		ch <- evt
	}

	if completed {
		o.mu.Lock()
		if subs, ok := o.subscribers[deploymentID]; ok {
			delete(subs, ch)
		}
		o.mu.Unlock()
		close(ch)
		return ch, func() {}, nil
	}

	cleanup := func() {
		o.mu.Lock()
		if subs, ok := o.subscribers[deploymentID]; ok {
			delete(subs, ch)
		}
		o.mu.Unlock()
	}

	return ch, cleanup, nil
}

func (o *Orchestrator) BroadcastEvent(deploymentID string, evt *models.BuildLogStreamEvent) {
	o.mu.Lock()
	defer o.mu.Unlock()

	buf, exists := o.buffers[deploymentID]
	if !exists {
		buf = newLogBuffer(2000)
		o.buffers[deploymentID] = buf
	}
	buf.Append(evt)

	subs, hasSubs := o.subscribers[deploymentID]
	if !hasSubs {
		return
	}

	var toClose []chan *models.BuildLogStreamEvent
	for ch := range subs {
		select {
		case ch <- evt:
		default:
		}
		if evt.Event == "build_complete" {
			toClose = append(toClose, ch)
		}
	}

	for _, ch := range toClose {
		delete(subs, ch)
		close(ch)
	}
}

func (o *Orchestrator) HandleBuildLog(nodeID string, chunk *protocol.BuildLogChunk) {
	if chunk == nil || chunk.DeploymentId == "" {
		return
	}

	streamType := "stdout"
	if chunk.IsError {
		streamType = "stderr"
	}

	timestamp := time.Now().UTC().Format(time.RFC3339Nano)
	if chunk.Timestamp > 0 {
		timestamp = time.Unix(0, chunk.Timestamp).UTC().Format(time.RFC3339Nano)
	}

	if chunk.Step != "" {
		o.BroadcastEvent(chunk.DeploymentId, &models.BuildLogStreamEvent{
			Event:     "build_step",
			Step:      chunk.Step,
			Title:     chunk.LogLine,
			Status:    "running",
			Timestamp: timestamp,
		})
	}

	o.BroadcastEvent(chunk.DeploymentId, &models.BuildLogStreamEvent{
		Event:     "build_log",
		Stream:    streamType,
		Line:      chunk.LogLine,
		Timestamp: timestamp,
	})
}

func (o *Orchestrator) HandleDeploymentStatus(nodeID string, transition *protocol.DeploymentStatusTransition) {
	if transition == nil || transition.DeploymentId == "" {
		return
	}

	depID := transition.DeploymentId
	status := transition.Status
	now := time.Now()

	slog.Info("deployment status transition received",
		slog.String("deployment_id", depID),
		slog.String("status", status),
		slog.String("node_id", nodeID),
	)

	switch status {
	case "building":
		if o.db != nil {
			_, _ = o.db.Exec(`
				UPDATE deployments SET
					status = 'building',
					started_at = COALESCE(started_at, CURRENT_TIMESTAMP)
				WHERE id = ?
			`, depID)
			_, _ = o.db.Exec(`
				UPDATE services SET status = 'building', updated_at = CURRENT_TIMESTAMP
				WHERE id = (SELECT service_id FROM deployments WHERE id = ?)
			`, depID)
		}
	case "deploying":
		if o.db != nil {
			_, _ = o.db.Exec(`UPDATE deployments SET status = 'deploying' WHERE id = ?`, depID)
		}
	case "healthy", "success":
		var startedAtStr string
		var serviceID string
		if o.db != nil {
			_ = o.db.QueryRow(`SELECT service_id, COALESCE(started_at, CURRENT_TIMESTAMP) FROM deployments WHERE id = ?`, depID).Scan(&serviceID, &startedAtStr)

			duration := 0
			startedAt, err := time.Parse("2006-01-02 15:04:05", startedAtStr)
			if err != nil {
				startedAt, _ = time.Parse(time.RFC3339, startedAtStr)
			}
			if !startedAt.IsZero() {
				duration = int(now.Sub(startedAt).Seconds())
				if duration < 0 {
					duration = 0
				}
			}

			_, _ = o.db.Exec(`
				UPDATE deployments SET
					status = 'success',
					finished_at = CURRENT_TIMESTAMP,
					duration_seconds = ?,
					image_tag = ?
				WHERE id = ?
			`, duration, transition.ImageTag, depID)

			_, _ = o.db.Exec(`
				UPDATE services SET
					status = 'running',
					active_deployment_id = ?,
					updated_at = CURRENT_TIMESTAMP
				WHERE id = ?
			`, depID, serviceID)

			imgTag := transition.ImageTag
			o.BroadcastEvent(depID, &models.BuildLogStreamEvent{
				Event:           "build_complete",
				Status:          "success",
				ImageTag:        &imgTag,
				DurationSeconds: &duration,
			})
			if o.notifyHook != nil {
				commitSHA, commitAuthor, commitMsg, svcName := "", "", "", ""
				_ = o.db.QueryRow(`SELECT COALESCE(d.commit_sha, ''), COALESCE(d.commit_author, ''), COALESCE(d.commit_message, ''), s.name FROM deployments d JOIN services s ON s.id = d.service_id WHERE d.id = ?`, depID).Scan(&commitSHA, &commitAuthor, &commitMsg, &svcName)
				o.notifyHook(models.NotificationPayload{
					Event:         models.NotificationEventDeploySuccess,
					ServiceID:     serviceID,
					ServiceName:   svcName,
					CommitSHA:     commitSHA,
					CommitAuthor:  commitAuthor,
					CommitMessage: commitMsg,
					Duration:      duration,
				})
			}
		}
	case "failed":
		var startedAtStr string
		var serviceID string
		if o.db != nil {
			_ = o.db.QueryRow(`SELECT service_id, COALESCE(started_at, CURRENT_TIMESTAMP) FROM deployments WHERE id = ?`, depID).Scan(&serviceID, &startedAtStr)

			duration := 0
			startedAt, err := time.Parse("2006-01-02 15:04:05", startedAtStr)
			if err != nil {
				startedAt, _ = time.Parse(time.RFC3339, startedAtStr)
			}
			if !startedAt.IsZero() {
				duration = int(now.Sub(startedAt).Seconds())
				if duration < 0 {
					duration = 0
				}
			}

			errReason := transition.ErrorReason
			_, _ = o.db.Exec(`
				UPDATE deployments SET
					status = 'failed',
					finished_at = CURRENT_TIMESTAMP,
					duration_seconds = ?,
					error_trace = ?
				WHERE id = ?
			`, duration, errReason, depID)

			var activeDepID sql.NullString
			_ = o.db.QueryRow(`SELECT active_deployment_id FROM services WHERE id = ?`, serviceID).Scan(&activeDepID)
			if !activeDepID.Valid || activeDepID.String == "" || activeDepID.String == depID {
				_, _ = o.db.Exec(`UPDATE services SET status = 'failed', updated_at = CURRENT_TIMESTAMP WHERE id = ?`, serviceID)
			}

			o.BroadcastEvent(depID, &models.BuildLogStreamEvent{
				Event:           "build_complete",
				Status:          "failed",
				DurationSeconds: &duration,
				Error:           &errReason,
			})
			if o.notifyHook != nil {
				commitSHA, commitAuthor, commitMsg, svcName := "", "", "", ""
				_ = o.db.QueryRow(`SELECT COALESCE(d.commit_sha, ''), COALESCE(d.commit_author, ''), COALESCE(d.commit_message, ''), s.name FROM deployments d JOIN services s ON s.id = d.service_id WHERE d.id = ?`, depID).Scan(&commitSHA, &commitAuthor, &commitMsg, &svcName)
				snip := errReason
				if len(snip) > 300 {
					snip = snip[:300]
				}
				o.notifyHook(models.NotificationPayload{
					Event:         models.NotificationEventDeployFailed,
					ServiceID:     serviceID,
					ServiceName:   svcName,
					CommitSHA:     commitSHA,
					CommitAuthor:  commitAuthor,
					CommitMessage: commitMsg,
					Duration:      duration,
					ErrorSnip:     snip,
				})
			}
		}
	case "cancelled":
		if o.db != nil {
			_, _ = o.db.Exec(`
				UPDATE deployments SET
					status = 'cancelled',
					finished_at = CURRENT_TIMESTAMP
				WHERE id = ?
			`, depID)

			reason := "deployment cancelled"
			o.BroadcastEvent(depID, &models.BuildLogStreamEvent{
				Event:  "build_complete",
				Status: "failed",
				Error:  &reason,
			})
		}
	}
}

func (o *Orchestrator) HandleContainerLog(nodeID string, chunk *protocol.ContainerLogChunk) {
	if chunk == nil || chunk.ServiceId == "" {
		return
	}

	streamType := "stdout"
	if chunk.IsStderr {
		streamType = "stderr"
	}

	ts := time.Now().UTC()
	if chunk.Timestamp > 0 {
		ts = time.Unix(0, chunk.Timestamp).UTC()
	}

	containerID := "tako-" + chunk.ServiceId
	if chunk.ContainerName != "" {
		containerID = fmt.Sprintf("tako-%s-%s", chunk.ServiceId, chunk.ContainerName)
	}

	evt := &models.ContainerLogEvent{
		ContainerID:   containerID,
		ContainerName: chunk.ContainerName,
		Stream:        streamType,
		Line:          chunk.LogLine,
		Timestamp:     ts,
	}

	o.BroadcastRuntimeLog(chunk.ServiceId, evt)
}

func (o *Orchestrator) BroadcastRuntimeLog(serviceID string, evt *models.ContainerLogEvent) {
	o.mu.Lock()
	defer o.mu.Unlock()

	buf, exists := o.runtimeBuffers[serviceID]
	if !exists {
		buf = newRuntimeLogBuffer(1000)
		o.runtimeBuffers[serviceID] = buf
	}
	buf.Append(evt)

	subs, hasSubs := o.runtimeSubscribers[serviceID]
	if !hasSubs {
		return
	}

	for ch := range subs {
		select {
		case ch <- evt:
		default:
		}
	}
}

func (o *Orchestrator) SubscribeRuntimeLogs(serviceID string) (chan *models.ContainerLogEvent, func(), error) {
	o.mu.Lock()
	defer o.mu.Unlock()

	buf, exists := o.runtimeBuffers[serviceID]
	if !exists {
		buf = newRuntimeLogBuffer(1000)
		o.runtimeBuffers[serviceID] = buf
	}

	history := buf.GetAll()
	ch := make(chan *models.ContainerLogEvent, len(history)+500)
	if o.runtimeSubscribers[serviceID] == nil {
		o.runtimeSubscribers[serviceID] = make(map[chan *models.ContainerLogEvent]struct{})
	}
	o.runtimeSubscribers[serviceID][ch] = struct{}{}

	for _, evt := range history {
		ch <- evt
	}

	cleanup := func() {
		o.mu.Lock()
		if subs, ok := o.runtimeSubscribers[serviceID]; ok {
			delete(subs, ch)
		}
		o.mu.Unlock()
	}

	return ch, cleanup, nil
}
