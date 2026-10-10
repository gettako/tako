package orchestrator

import (
	"context"
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"strings"
	"sync"
	"time"

	"gettako.dev/tako/internal/events"
	"gettako.dev/tako/internal/store/db"
	takov1 "gettako.dev/tako/proto/gen/go/tako/v1"
)

type DeploymentStepJSON struct {
	Name       string   `json:"name"`
	Status     string   `json:"status"`
	StartedAt  string   `json:"startedAt,omitempty"`
	FinishedAt string   `json:"finishedAt,omitempty"`
	DurationMS int64    `json:"durationMs,omitempty"`
	Logs       []string `json:"logs,omitempty"`
}

type CreateServiceParams struct {
	ProjectID        string
	NodeID           string
	Name             string
	Slug             string
	Type             string
	Repository       string
	Branch           string
	Dockerfile       string
	Image            string
	Ports            []int32
	Domains          []string
	EnvironmentVars  map[string]string
	PublishToHost    *bool
	DatabaseType     string
	DatabaseVersion  string
	ConnectionString string
}

type UpdateServiceParams struct {
	Name               *string
	Repository         *string
	Branch             *string
	CommitHash         *string
	Dockerfile         *string
	BuildCommand       *string
	Image              *string
	Replicas           *int64
	PublishToHost      *bool
	CPULimit           *float64
	MemoryLimitMB      *int64
	SwapLimitMB        *int64
	AutoRollbackEnabled *bool
	AutoScalingEnabled  *bool
	AutoScalingMetric   *string
	TargetMemoryPercent *float64
	ScaleDownCPUPercent *float64
	CooldownSeconds     *int64
	MinReplicas         *int64
	MaxReplicas         *int64
	TargetCPUPercent    *float64
}

func fallbackVal[T comparable](ptr *T, fallback T) T {
	var zero T
	if ptr != nil && *ptr != zero {
		return *ptr
	}
	return fallback
}

// UpdateService updates service configuration attributes and metadata in database.
func (o *Orchestrator) UpdateService(ctx context.Context, id string, p UpdateServiceParams) (*db.Service, error) {
	srv, err := o.queries.GetServiceByID(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("service not found: %w", err)
	}

	publishToHost := srv.PublishToHost
	if p.PublishToHost != nil {
		if *p.PublishToHost {
			publishToHost = 1
		} else {
			publishToHost = 0
		}
	}

	// Ensure swap_limit_mb column exists
	_, _ = o.db.ExecContext(ctx, "ALTER TABLE services ADD COLUMN swap_limit_mb INTEGER NOT NULL DEFAULT 0;")

	var existingSwap int64
	_ = o.db.QueryRowContext(ctx, "SELECT swap_limit_mb FROM services WHERE id = ?", id).Scan(&existingSwap)

	swapLimit := existingSwap
	if p.SwapLimitMB != nil {
		swapLimit = *p.SwapLimitMB
	}

	_, err = o.db.ExecContext(ctx, `
		UPDATE services SET
			name = ?,
			repository = ?,
			branch = ?,
			commit_hash = ?,
			dockerfile = ?,
			build_command = ?,
			image = ?,
			replicas = ?,
			publish_to_host = ?,
			cpu_limit = ?,
			memory_limit_mb = ?,
			swap_limit_mb = ?,
			updated_at = CURRENT_TIMESTAMP
		WHERE id = ?`,
		fallbackVal(p.Name, srv.Name),
		fallbackVal(p.Repository, srv.Repository),
		fallbackVal(p.Branch, srv.Branch),
		fallbackVal(p.CommitHash, srv.CommitHash),
		fallbackVal(p.Dockerfile, srv.Dockerfile),
		fallbackVal(p.BuildCommand, srv.BuildCommand),
		fallbackVal(p.Image, srv.Image),
		fallbackVal(p.Replicas, srv.Replicas),
		publishToHost,
		fallbackVal(p.CPULimit, srv.CpuLimit),
		fallbackVal(p.MemoryLimitMB, srv.MemoryLimitMb),
		swapLimit,
		id,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to update service: %w", err)
	}

	if p.AutoRollbackEnabled != nil {
		arVal := int64(0)
		if *p.AutoRollbackEnabled {
			arVal = 1
		}
		_, _ = o.db.ExecContext(ctx, "UPDATE services SET auto_rollback_enabled = ? WHERE id = ?", arVal, id)
	}
	if p.AutoScalingEnabled != nil {
		asVal := int64(0)
		if *p.AutoScalingEnabled {
			asVal = 1
		}
		_, _ = o.db.ExecContext(ctx, "UPDATE services SET auto_scaling_enabled = ? WHERE id = ?", asVal, id)
	}
	if p.AutoScalingMetric != nil {
		_, _ = o.db.ExecContext(ctx, "UPDATE services SET auto_scaling_metric = ? WHERE id = ?", *p.AutoScalingMetric, id)
	}
	if p.TargetMemoryPercent != nil {
		_, _ = o.db.ExecContext(ctx, "UPDATE services SET target_memory_percent = ? WHERE id = ?", *p.TargetMemoryPercent, id)
	}
	if p.ScaleDownCPUPercent != nil {
		_, _ = o.db.ExecContext(ctx, "UPDATE services SET scale_down_cpu_percent = ? WHERE id = ?", *p.ScaleDownCPUPercent, id)
	}
	if p.CooldownSeconds != nil {
		_, _ = o.db.ExecContext(ctx, "UPDATE services SET cooldown_seconds = ? WHERE id = ?", *p.CooldownSeconds, id)
	}
	if p.MinReplicas != nil {
		_, _ = o.db.ExecContext(ctx, "UPDATE services SET min_replicas = ? WHERE id = ?", *p.MinReplicas, id)
	}
	if p.MaxReplicas != nil {
		_, _ = o.db.ExecContext(ctx, "UPDATE services SET max_replicas = ? WHERE id = ?", *p.MaxReplicas, id)
	}
	if p.TargetCPUPercent != nil {
		_, _ = o.db.ExecContext(ctx, "UPDATE services SET target_cpu_percent = ? WHERE id = ?", *p.TargetCPUPercent, id)
	}

	updated, err := o.queries.GetServiceByID(ctx, id)
	if err != nil {
		return nil, err
	}
	return &updated, nil
}

// CreateService creates a new service, associates domains and environment variables.
func (o *Orchestrator) CreateService(ctx context.Context, p CreateServiceParams) (*db.Service, error) {
	if p.ProjectID == "" {
		p.ProjectID = "default"
	}

	// Ensure the project exists to avoid foreign key errors
	if _, err := o.queries.GetProjectByID(ctx, p.ProjectID); err != nil {
		_, _ = o.queries.CreateProject(ctx, db.CreateProjectParams{
			ID:          p.ProjectID,
			Name:        "Project " + p.ProjectID,
			Slug:        "proj-" + p.ProjectID,
			Description: "Auto-created project",
			Environment: "production",
			Status:      "healthy",
			Tags:        "[]",
		})
	}

	// Ensure NodeID is populated if empty
	if p.NodeID == "" {
		if nodes, err := o.queries.ListNodes(ctx); err == nil && len(nodes) > 0 {
			p.NodeID = nodes[0].ID
		} else {
			p.NodeID = "node-control"
		}
	}

	// Ensure the node exists to avoid foreign key errors
	if _, err := o.queries.GetNodeByID(ctx, p.NodeID); err != nil {
		_, _ = o.queries.CreateNode(ctx, db.CreateNodeParams{
			ID:        p.NodeID,
			Name:      p.NodeID,
			Role:      "leader",
			IpAddress: "127.0.0.1",
			Status:    "ready",
		})
	}

	serviceID := "srv-" + randomHex(8)
	if p.Slug == "" {
		p.Slug = strings.ToLower(p.Name)
		p.Slug = strings.ReplaceAll(p.Slug, " ", "-")
		if p.Slug == "" {
			p.Slug = "srv-" + randomHex(4)
		}
	}
	if p.Type == "" {
		p.Type = "app"
	}
	if p.Branch == "" {
		p.Branch = "main"
	}
	if p.Dockerfile == "" {
		p.Dockerfile = "Dockerfile"
	}

	// 1-Click Database Provisioning Defaults
	if p.Type == "database" {
		if p.DatabaseVersion == "" {
			p.DatabaseVersion = "latest"
		}
		if p.EnvironmentVars == nil {
			p.EnvironmentVars = make(map[string]string)
		}

		nodeIP := "127.0.0.1"
		if node, err := o.queries.GetNodeByID(ctx, p.NodeID); err == nil {
			if node.PublicIp != "" {
				nodeIP = node.PublicIp
			} else if node.IpAddress != "" {
				nodeIP = node.IpAddress
			}
		}

		cleanDBName := strings.ReplaceAll(p.Slug, "-", "_")
		if cleanDBName == "" {
			cleanDBName = "tako_db"
		}
		defaultPass := randomHex(10)

		switch strings.ToLower(p.DatabaseType) {
		case "postgresql", "postgres":
			p.DatabaseType = "postgresql"
			if p.Image == "" {
				p.Image = "postgres:" + p.DatabaseVersion
			}
			if len(p.Ports) == 0 {
				p.Ports = []int32{5432}
			}
			if _, ok := p.EnvironmentVars["POSTGRES_DB"]; !ok {
				p.EnvironmentVars["POSTGRES_DB"] = cleanDBName
			}
			if _, ok := p.EnvironmentVars["POSTGRES_USER"]; !ok {
				p.EnvironmentVars["POSTGRES_USER"] = "tako"
			}
			if _, ok := p.EnvironmentVars["POSTGRES_PASSWORD"]; !ok {
				p.EnvironmentVars["POSTGRES_PASSWORD"] = defaultPass
			}
			if p.ConnectionString == "" {
				p.ConnectionString = fmt.Sprintf("postgresql://%s:%s@%s:%d/%s",
					p.EnvironmentVars["POSTGRES_USER"],
					p.EnvironmentVars["POSTGRES_PASSWORD"],
					nodeIP, p.Ports[0],
					p.EnvironmentVars["POSTGRES_DB"],
				)
			}

		case "mysql":
			p.DatabaseType = "mysql"
			if p.Image == "" {
				p.Image = "mysql:" + p.DatabaseVersion
			}
			if len(p.Ports) == 0 {
				p.Ports = []int32{3306}
			}
			if _, ok := p.EnvironmentVars["MYSQL_DATABASE"]; !ok {
				p.EnvironmentVars["MYSQL_DATABASE"] = cleanDBName
			}
			if _, ok := p.EnvironmentVars["MYSQL_USER"]; !ok {
				p.EnvironmentVars["MYSQL_USER"] = "tako"
			}
			if _, ok := p.EnvironmentVars["MYSQL_PASSWORD"]; !ok {
				p.EnvironmentVars["MYSQL_PASSWORD"] = defaultPass
			}
			if _, ok := p.EnvironmentVars["MYSQL_ROOT_PASSWORD"]; !ok {
				p.EnvironmentVars["MYSQL_ROOT_PASSWORD"] = defaultPass
			}
			if p.ConnectionString == "" {
				p.ConnectionString = fmt.Sprintf("mysql://%s:%s@tcp(%s:%d)/%s",
					p.EnvironmentVars["MYSQL_USER"],
					p.EnvironmentVars["MYSQL_PASSWORD"],
					nodeIP, p.Ports[0],
					p.EnvironmentVars["MYSQL_DATABASE"],
				)
			}

		case "redis":
			p.DatabaseType = "redis"
			if p.Image == "" {
				p.Image = "redis:" + p.DatabaseVersion
			}
			if len(p.Ports) == 0 {
				p.Ports = []int32{6379}
			}
			if pass, ok := p.EnvironmentVars["REDIS_PASSWORD"]; ok && pass != "" {
				p.ConnectionString = fmt.Sprintf("redis://:%s@%s:%d", pass, nodeIP, p.Ports[0])
			} else {
				p.ConnectionString = fmt.Sprintf("redis://%s:%d", nodeIP, p.Ports[0])
			}

		case "mongodb", "mongo":
			p.DatabaseType = "mongodb"
			if p.Image == "" {
				p.Image = "mongo:" + p.DatabaseVersion
			}
			if len(p.Ports) == 0 {
				p.Ports = []int32{27017}
			}
			if _, ok := p.EnvironmentVars["MONGO_INITDB_ROOT_USERNAME"]; !ok {
				p.EnvironmentVars["MONGO_INITDB_ROOT_USERNAME"] = "tako"
			}
			if _, ok := p.EnvironmentVars["MONGO_INITDB_ROOT_PASSWORD"]; !ok {
				p.EnvironmentVars["MONGO_INITDB_ROOT_PASSWORD"] = defaultPass
			}
			if _, ok := p.EnvironmentVars["MONGO_INITDB_DATABASE"]; !ok {
				p.EnvironmentVars["MONGO_INITDB_DATABASE"] = cleanDBName
			}
			if p.ConnectionString == "" {
				p.ConnectionString = fmt.Sprintf("mongodb://%s:%s@%s:%d/%s?authSource=admin",
					p.EnvironmentVars["MONGO_INITDB_ROOT_USERNAME"],
					p.EnvironmentVars["MONGO_INITDB_ROOT_PASSWORD"],
					nodeIP, p.Ports[0],
					p.EnvironmentVars["MONGO_INITDB_DATABASE"],
				)
			}
		}
	}

	portsJSON, _ := json.Marshal(p.Ports)

	publishToHostVal := int64(1)
	if p.PublishToHost != nil {
		if !*p.PublishToHost {
			publishToHostVal = 0
		}
	} else if len(p.Domains) > 0 {
		publishToHostVal = 0
	}

	srv, err := o.queries.CreateService(ctx, db.CreateServiceParams{
		ID:               serviceID,
		ProjectID:        p.ProjectID,
		NodeID:           p.NodeID,
		Name:             p.Name,
		Slug:             p.Slug,
		Type:             p.Type,
		Status:           "stopped",
		Repository:       p.Repository,
		Branch:           p.Branch,
		Dockerfile:       p.Dockerfile,
		Image:            p.Image,
		Ports:            string(portsJSON),
		Replicas:         1,
		CpuLimit:         1.0,
		MemoryLimitMb:    512,
		CommitHash:       "",
		BuildCommand:     "",
		ComposeFile:      "",
		DatabaseType:     p.DatabaseType,
		DatabaseVersion:  p.DatabaseVersion,
		ConnectionString: p.ConnectionString,
		PublishToHost:    publishToHostVal,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to create service: %w", err)
	}

	// Insert domains
	for _, domain := range p.Domains {
		_, _ = o.queries.CreateServiceDomain(ctx, db.CreateServiceDomainParams{
			ID:              "dom-" + randomHex(8),
			ServiceID:       serviceID,
			Domain:          domain,
			Ssl:             1,
			IsPrimary:       1,
			Port:            80,
			Path:            "/",
			CertificateType: "letsencrypt",
		})
	}

	// Insert env vars
	for k, v := range p.EnvironmentVars {
		_, _ = o.queries.CreateServiceEnvVar(ctx, db.CreateServiceEnvVarParams{
			ID:        "env-" + randomHex(8),
			ServiceID: serviceID,
			Key:       k,
			Value:     v,
			IsSecret:  0,
		})
	}

	_, _ = o.RecordAudit(ctx, AuditLogInput{
		Action:     "create_service",
		TargetType: "service",
		TargetID:   srv.ID,
		TargetName: srv.Name,
		Metadata: map[string]interface{}{
			"projectId": srv.ProjectID,
			"nodeId":    srv.NodeID,
			"type":      srv.Type,
			"image":     srv.Image,
		},
	})

	// Automatically trigger initial deployment if repository or image is configured
	if srv.Repository != "" || srv.Image != "" {
		if _, err := o.TriggerDeploy(ctx, srv.ID); err == nil {
			srv.Status = "queued"
		}
	}

	return &srv, nil
}

// TriggerDeploy initiates a new deployment pipeline for a given service.
func (o *Orchestrator) TriggerDeploy(ctx context.Context, serviceID string) (*db.Deployment, error) {
	return o.TriggerDeployWithParams(ctx, serviceID, "", "")
}

// TriggerDeployWithParams initiates a new deployment pipeline with optional branch and commitHash overrides.
func (o *Orchestrator) TriggerDeployWithParams(ctx context.Context, serviceID, branch, commitHash string) (*db.Deployment, error) {
	srv, err := o.queries.GetServiceByID(ctx, serviceID)
	if err != nil {
		return nil, fmt.Errorf("service not found: %w", err)
	}

	targetBranch := srv.Branch
	if branch != "" {
		targetBranch = branch
	}

	targetCommit := commitHash
	if targetCommit != "" {
		srv.CommitHash = targetCommit
		_, _ = o.db.ExecContext(ctx, "UPDATE services SET commit_hash = ?, branch = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", targetCommit, targetBranch, srv.ID)
	} else if srv.Repository != "" {
		// When deploying a Git repo without a pinned commit, leave targetCommit empty
		// so agent git clone pulls the latest HEAD of targetBranch instead of reusing old image cache!
		targetCommit = ""
	} else {
		targetCommit = srv.CommitHash
	}

	depID := "dep-" + randomHex(8)
	initialSteps := []DeploymentStepJSON{
		{Name: "Queued", Status: "running", StartedAt: time.Now().UTC().Format(time.RFC3339)},
	}
	stepsJSON, _ := json.Marshal(initialSteps)

	node, errNode := o.queries.GetNodeByID(ctx, srv.NodeID)
	nodeIP := "127.0.0.1"
	if errNode == nil {
		if node.PublicIp != "" {
			nodeIP = node.PublicIp
		} else if node.IpAddress != "" {
			nodeIP = node.IpAddress
		}
	}
	previewDomain, previewURL := buildPreviewURL(targetCommit, depID, nodeIP)

	dep, err := o.queries.CreateDeployment(ctx, db.CreateDeploymentParams{
		ID:            depID,
		ServiceID:     srv.ID,
		CommitHash:    targetCommit,
		CommitMessage: "Manual deployment trigger",
		Branch:        targetBranch,
		Author:        "system",
		Status:        "queued",
		Steps:         string(stepsJSON),
		Logs:          fmt.Sprintf("[%s] Deployment queued for service %s\n", time.Now().Format("15:04:05"), srv.Name),
		Url:           previewURL,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to create deployment record: %w", err)
	}

	_, _ = o.RecordAudit(ctx, AuditLogInput{
		Action:     "deploy_service",
		TargetType: "service",
		TargetID:   srv.ID,
		TargetName: srv.Name,
		Metadata: map[string]interface{}{
			"deploymentId": depID,
			"commitHash":   targetCommit,
		},
	})

	// Run deployment pipeline asynchronously with updated service object
	srv.CommitHash = targetCommit
	srv.Branch = targetBranch
	go o.runDeploymentPipeline(srv, depID, previewDomain, previewURL)

	return &dep, nil
}

func (o *Orchestrator) runDeploymentPipeline(srv db.Service, depID, previewDomain, previewURL string) {
	bgCtx := context.Background()

	// Check if active agent is connected for this node
	sess := o.GetAgentSession(srv.NodeID)
	if sess != nil {
		// Gather domains
		domainsDB, _ := o.queries.ListServiceDomains(bgCtx, srv.ID)
		domainList := make([]string, 0, len(domainsDB)+2)
		for _, d := range domainsDB {
			domainList = append(domainList, d.Domain)
		}

		// Compute node IP & canonical domain (e.g. tako-demo-hello-43-156-243-241.sslip.io)
		node, errNode := o.queries.GetNodeByID(bgCtx, srv.NodeID)
		nodeIP := "127.0.0.1"
		if errNode == nil {
			if node.PublicIp != "" {
				nodeIP = node.PublicIp
			} else if node.IpAddress != "" {
				nodeIP = node.IpAddress
			}
		}
		cleanIP := "127.0.0.1"
		if nodeIP != "" {
			cleanIP = strings.Split(nodeIP, ":")[0]
		}
		dashedIP := strings.ReplaceAll(cleanIP, ".", "-")
		canonicalDomain := fmt.Sprintf("%s-%s.sslip.io", srv.Slug, dashedIP)
		domainList = append(domainList, canonicalDomain)

		if previewDomain != "" && previewDomain != canonicalDomain {
			domainList = append(domainList, previewDomain)
		}

		// Gather env vars
		envDB, _ := o.queries.ListServiceEnvVars(bgCtx, srv.ID)
		envMap := make(map[string]string)
		for _, ev := range envDB {
			envMap[ev.Key] = ev.Value
		}
		if _, hasRetention := envMap["TAKO_PREVIEW_RETENTION"]; !hasRetention {
			if setting, err := o.queries.GetSetting(bgCtx, "preview_retention"); err == nil && setting.Value != "" {
				envMap["TAKO_PREVIEW_RETENTION"] = setting.Value
			} else {
				envMap["TAKO_PREVIEW_RETENTION"] = "2"
			}
		}

		// Ports
		var ports []int32
		_ = json.Unmarshal([]byte(srv.Ports), &ports)

		stepsState := []DeploymentStepJSON{
			{Name: "Queued", Status: "success", StartedAt: time.Now().UTC().Format(time.RFC3339), FinishedAt: time.Now().UTC().Format(time.RFC3339)},
		}

		doneCh := make(chan struct{})
		var doneOnce sync.Once

		sess.RegisterDeployLogCallback(depID, func(chunk *takov1.DeployLogChunk) {
			logMsg := fmt.Sprintf("[%s] [%s] %s\n", time.Now().Format("15:04:05"), chunk.Step, chunk.Message)
			status := "building"
			if chunk.Step == "Deploy" || chunk.Step == "Health check" {
				status = "deploying"
			} else if chunk.Step == "Live" {
				status = "live"
			} else if chunk.IsError {
				status = "failed"
			}

			stepFound := false
			for i, st := range stepsState {
				if st.Name == chunk.Step {
					stepsState[i].Logs = append(stepsState[i].Logs, chunk.Message)
					if chunk.IsError {
						stepsState[i].Status = "failed"
					}
					stepFound = true
					break
				}
			}

			// Automatically update deployment and service commit metadata when reported by agent
			if chunk.Step == "Clone" && strings.HasPrefix(chunk.Message, "HEAD commit ") {
				parts := strings.TrimPrefix(chunk.Message, "HEAD commit ")
				hashAndRest := strings.SplitN(parts, ": ", 2)
				if len(hashAndRest) > 0 {
					extractedHash := strings.TrimSpace(hashAndRest[0])
					if len(extractedHash) >= 7 {
						extractedMsg := "Manual deployment trigger"
						extractedAuthor := "system"
						if len(hashAndRest) == 2 {
							rest := hashAndRest[1]
							if idx := strings.LastIndex(rest, " (by "); idx != -1 {
								extractedMsg = strings.TrimSpace(rest[:idx])
								extractedAuthor = strings.TrimSuffix(strings.TrimSpace(rest[idx+5:]), ")")
							} else {
								extractedMsg = strings.TrimSpace(rest)
							}
						}
						_, _ = o.db.ExecContext(bgCtx, "UPDATE deployments SET commit_hash = ?, commit_message = ?, author = ? WHERE id = ?", extractedHash, extractedMsg, extractedAuthor, depID)
						_, _ = o.db.ExecContext(bgCtx, "UPDATE services SET commit_hash = ? WHERE id = ?", extractedHash, srv.ID)
					}
				}
			}
			if !stepFound {
				now := time.Now().UTC()
				nowStr := now.Format(time.RFC3339)

				// Mark any previously running step as completed / success if it didn't fail
				for i, st := range stepsState {
					if st.Status == "running" {
						stepsState[i].Status = "success"
						stepsState[i].FinishedAt = nowStr
						if st.StartedAt != "" {
							if startTime, err := time.Parse(time.RFC3339, st.StartedAt); err == nil {
								stepsState[i].DurationMS = now.Sub(startTime).Milliseconds()
							}
						}
					}
				}

				stepStatus := "running"
				if chunk.IsError {
					stepStatus = "failed"
				} else if chunk.Step == "Live" {
					stepStatus = "success"
				}

				finishedAtStr := ""
				if stepStatus == "success" {
					finishedAtStr = nowStr
				}

				stepsState = append(stepsState, DeploymentStepJSON{
					Name:       chunk.Step,
					Status:     stepStatus,
					StartedAt:  nowStr,
					FinishedAt: finishedAtStr,
					Logs:       []string{chunk.Message},
				})
			}

			if chunk.Step == "Live" {
				nowStr := time.Now().UTC().Format(time.RFC3339)
				for i := range stepsState {
					if stepsState[i].Status != "failed" {
						stepsState[i].Status = "success"
						if stepsState[i].FinishedAt == "" {
							stepsState[i].FinishedAt = nowStr
						}
					}
				}
			}

			stepsBytes, _ := json.Marshal(stepsState)
			_ = o.queries.AppendDeploymentLog(bgCtx, db.AppendDeploymentLogParams{
				ID:     depID,
				Logs:   logMsg,
				Status: status,
				Steps:  string(stepsBytes),
			})

			o.bus.Publish(events.Event{
				Type: events.EventDeploymentLog,
				Payload: map[string]any{
					"deployment_id": depID,
					"service_id":    srv.ID,
					"step":          chunk.Step,
					"message":       logMsg,
					"status":        status,
					"is_error":      chunk.IsError,
				},
			})

			if chunk.Step == "Live" {
				_ = o.queries.UpdateServiceStatus(bgCtx, db.UpdateServiceStatusParams{
					ID:     srv.ID,
					Status: "healthy",
				})
				doneOnce.Do(func() { close(doneCh) })
			} else if chunk.IsError {
				_ = o.queries.UpdateServiceStatus(bgCtx, db.UpdateServiceStatusParams{
					ID:     srv.ID,
					Status: "error",
				})
				doneOnce.Do(func() { close(doneCh) })
			}
		})
		defer sess.UnregisterDeployLogCallback(depID)

		deployReq := &takov1.DeployRequest{
			DeploymentId:  depID,
			ServiceId:     srv.ID,
			ServiceName:   srv.Slug,
			Repository:    srv.Repository,
			Branch:        srv.Branch,
			CommitHash:    srv.CommitHash,
			Dockerfile:    srv.Dockerfile,
			BuildCommand:  srv.BuildCommand,
			Image:         srv.Image,
			Ports:         ports,
			Domains:       domainList,
			EnvVars:       envMap,
			CpuLimit:      srv.CpuLimit,
			MemoryLimitMb: srv.MemoryLimitMb,
			PublishToHost: srv.PublishToHost != 0,
		}

		select {
		case sess.TaskChan <- &takov1.MasterTask{
			TaskId: depID,
			NodeId: sess.NodeID,
			Task: &takov1.MasterTask_Deploy{
				Deploy: deployReq,
			},
		}:
		case <-time.After(5 * time.Second):
			logMsg := fmt.Sprintf("[%s] Error: Agent task queue full\n", time.Now().Format("15:04:05"))
			_ = o.queries.AppendDeploymentLog(bgCtx, db.AppendDeploymentLogParams{
				ID:     depID,
				Logs:   logMsg,
				Status: "failed",
				Steps:  "[]",
			})
			_ = o.queries.UpdateServiceStatus(bgCtx, db.UpdateServiceStatusParams{
				ID:     srv.ID,
				Status: "error",
			})
			return
		}

		select {
		case <-doneCh:
			now := time.Now().UTC()
			finalStatus := "live"
			for _, s := range stepsState {
				if s.Status == "failed" {
					finalStatus = "failed"
					break
				}
			}
			finalStepsBytes, _ := json.Marshal(stepsState)
			curDep, err := o.queries.GetDeploymentByID(bgCtx, depID)
			if err == nil {
				durationMs := now.Sub(curDep.CreatedAt).Milliseconds()
				_ = o.queries.UpdateDeploymentStatus(bgCtx, db.UpdateDeploymentStatusParams{
					ID:         depID,
					Status:     finalStatus,
					DurationMs: durationMs,
					FinishedAt: sql.NullTime{Time: now, Valid: true},
					Steps:      string(finalStepsBytes),
					Logs:       curDep.Logs,
					Url:        previewURL,
				})
			}

			// Auto-Rollback on Health Check Failure
			if finalStatus == "failed" {
				var autoRollbackEnabled int64 = 1
				_ = o.db.QueryRowContext(bgCtx, "SELECT auto_rollback_enabled FROM services WHERE id = ?", srv.ID).Scan(&autoRollbackEnabled)
				if autoRollbackEnabled == 0 {
					disabledMsg := fmt.Sprintf("[%s] [Auto-Rollback Disabled] Health check failure detected. Auto-rollback is disabled in service settings. Container remains in failed state for manual debugging.\n",
						time.Now().Format("15:04:05"))
					_ = o.queries.AppendDeploymentLog(bgCtx, db.AppendDeploymentLogParams{
						ID:     depID,
						Logs:   disabledMsg,
						Status: "failed",
						Steps:  string(finalStepsBytes),
					})
					o.bus.Publish(events.Event{
						Type: events.EventDeploymentLog,
						Payload: map[string]any{
							"deployment_id": depID,
							"service_id":    srv.ID,
							"step":          "Health check",
							"message":       disabledMsg,
							"status":        "failed",
						},
					})
					return
				}

				allDeps, errList := o.queries.ListDeploymentsByService(bgCtx, srv.ID)
				var lastHealthy *db.Deployment
				if errList == nil {
					for _, d := range allDeps {
						if d.ID != depID && (d.Status == "live" || d.Status == "healthy") {
							copyD := d
							lastHealthy = &copyD
							break
						}
					}
				}

				if lastHealthy != nil {
					autoRollbackMsg := fmt.Sprintf("[%s] [Auto-Rollback] Health check failure detected. Automatically triggering rollback to previous stable deployment: %s (%s)...\n",
						time.Now().Format("15:04:05"), lastHealthy.ID, lastHealthy.CommitHash)
					_ = o.queries.AppendDeploymentLog(bgCtx, db.AppendDeploymentLogParams{
						ID:     depID,
						Logs:   autoRollbackMsg,
						Status: "failed_rolled_back",
						Steps:  string(finalStepsBytes),
					})
					o.bus.Publish(events.Event{
						Type: events.EventDeploymentLog,
						Payload: map[string]any{
							"deployment_id": depID,
							"service_id":    srv.ID,
							"step":          "Health check",
							"message":       autoRollbackMsg,
							"status":        "failed_rolled_back",
						},
					})
					_, _ = o.RecordAudit(bgCtx, AuditLogInput{
						Action:     "auto_rollback_triggered",
						TargetType: "service",
						TargetID:   srv.ID,
						TargetName: srv.Name,
						Metadata: map[string]any{
							"failedDeployment": depID,
							"targetDeployment": lastHealthy.ID,
							"reason":           "health_check_failed",
						},
					})

					go func(targetID string) {
						time.Sleep(500 * time.Millisecond)
						_, _ = o.RollbackDeployment(context.Background(), targetID)
					}(lastHealthy.ID)
				}
			}
			return
		case <-time.After(15 * time.Minute):
			logMsg := fmt.Sprintf("[%s] Error: Deployment timeout after 15 minutes\n", time.Now().Format("15:04:05"))
			_ = o.queries.AppendDeploymentLog(bgCtx, db.AppendDeploymentLogParams{
				ID:     depID,
				Logs:   logMsg,
				Status: "failed",
				Steps:  "[]",
			})
			_ = o.queries.UpdateServiceStatus(bgCtx, db.UpdateServiceStatusParams{
				ID:     srv.ID,
				Status: "error",
			})
			return
		}
	}

	// Fallback to simulation if no agent session connected (e.g. testing)
	steps := []string{"Clone", "Build", "Push/Load image", "Deploy", "Health check", "Live"}

	stepsState := []DeploymentStepJSON{
		{Name: "Queued", Status: "success", StartedAt: time.Now().UTC().Format(time.RFC3339), FinishedAt: time.Now().UTC().Format(time.RFC3339)},
	}

	for _, stepName := range steps {
		time.Sleep(150 * time.Millisecond)

		logMsg := fmt.Sprintf("[%s] [%s] Executed step successfully\n", time.Now().Format("15:04:05"), stepName)
		status := "building"
		if stepName == "Deploy" || stepName == "Health check" {
			status = "deploying"
		} else if stepName == "Live" {
			status = "live"
		}

		stepsState = append(stepsState, DeploymentStepJSON{
			Name:       stepName,
			Status:     "success",
			StartedAt:  time.Now().UTC().Format(time.RFC3339),
			FinishedAt: time.Now().UTC().Format(time.RFC3339),
		})
		stepsBytes, _ := json.Marshal(stepsState)

		_ = o.queries.AppendDeploymentLog(bgCtx, db.AppendDeploymentLogParams{
			ID:     depID,
			Logs:   logMsg,
			Status: status,
			Steps:  string(stepsBytes),
		})

		o.bus.Publish(events.Event{
			Type: events.EventDeploymentLog,
			Payload: map[string]any{
				"deployment_id": depID,
				"service_id":    srv.ID,
				"step":          stepName,
				"message":       logMsg,
				"status":        status,
			},
		})
	}

	curDep, err := o.queries.GetDeploymentByID(bgCtx, depID)
	if err == nil {
		now := time.Now().UTC()
		durationMs := now.Sub(curDep.CreatedAt).Milliseconds()
		finalStepsBytes, _ := json.Marshal(stepsState)
		_ = o.queries.UpdateDeploymentStatus(bgCtx, db.UpdateDeploymentStatusParams{
			ID:         depID,
			Status:     "live",
			DurationMs: durationMs,
			FinishedAt: sql.NullTime{Time: now, Valid: true},
			Steps:      string(finalStepsBytes),
			Logs:       curDep.Logs,
			Url:        previewURL,
		})
	}

	// Mark service status as healthy
	_ = o.queries.UpdateServiceStatus(bgCtx, db.UpdateServiceStatusParams{
		ID:     srv.ID,
		Status: "healthy",
	})
}

// GetDeployment retrieves deployment details.
func (o *Orchestrator) GetDeployment(ctx context.Context, depID string) (db.Deployment, error) {
	return o.queries.GetDeploymentByID(ctx, depID)
}

// RollbackDeployment reverts a service to the revision of a specified deployment.
func (o *Orchestrator) RollbackDeployment(ctx context.Context, depID string) (*db.Deployment, error) {
	targetDep, err := o.queries.GetDeploymentByID(ctx, depID)
	if err != nil {
		return nil, fmt.Errorf("deployment %s not found: %w", depID, err)
	}

	srv, err := o.queries.GetServiceByID(ctx, targetDep.ServiceID)
	if err != nil {
		return nil, fmt.Errorf("service not found: %w", err)
	}

	// Update service's active commit_hash to target's commit_hash
	_, _ = o.db.ExecContext(ctx, "UPDATE services SET commit_hash = ?, branch = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", targetDep.CommitHash, targetDep.Branch, srv.ID)
	srv.CommitHash = targetDep.CommitHash
	srv.Branch = targetDep.Branch

	newDepID := "dep-" + randomHex(8)
	initialSteps := []DeploymentStepJSON{
		{Name: "Queued", Status: "running", StartedAt: time.Now().UTC().Format(time.RFC3339)},
	}
	stepsJSON, _ := json.Marshal(initialSteps)

	node, errNode := o.queries.GetNodeByID(ctx, srv.NodeID)
	nodeIP := "127.0.0.1"
	if errNode == nil {
		if node.PublicIp != "" {
			nodeIP = node.PublicIp
		} else if node.IpAddress != "" {
			nodeIP = node.IpAddress
		}
	}
	previewDomain, previewURL := buildPreviewURL(srv.CommitHash, newDepID, nodeIP)

	shortCommit := srv.CommitHash
	if len(shortCommit) > 7 {
		shortCommit = shortCommit[:7]
	}
	msg := fmt.Sprintf("Rollback to %s", shortCommit)
	if targetDep.CommitMessage != "" {
		msg = fmt.Sprintf("Rollback to %s (%s)", shortCommit, targetDep.CommitMessage)
	}

	dep, err := o.queries.CreateDeployment(ctx, db.CreateDeploymentParams{
		ID:            newDepID,
		ServiceID:     srv.ID,
		CommitHash:    srv.CommitHash,
		CommitMessage: msg,
		Branch:        srv.Branch,
		Author:        "system",
		Status:        "queued",
		Steps:         string(stepsJSON),
		Logs:          fmt.Sprintf("[%s] Rollback deployment queued for service %s to %s\n", time.Now().Format("15:04:05"), srv.Name, shortCommit),
		Url:           previewURL,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to create rollback deployment record: %w", err)
	}

	_, _ = o.RecordAudit(ctx, AuditLogInput{
		Action:     "rollback_service",
		TargetType: "service",
		TargetID:   srv.ID,
		TargetName: srv.Name,
		Metadata: map[string]interface{}{
			"deploymentId": newDepID,
			"targetCommit": srv.CommitHash,
			"rollbackFrom": targetDep.ID,
		},
	})

	go o.runDeploymentPipeline(srv, newDepID, previewDomain, previewURL)

	return &dep, nil
}

func randomHex(n int) string {
	b := make([]byte, n)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}

func cleanAlnum(s string) string {
	var sb strings.Builder
	for _, r := range strings.ToLower(s) {
		if (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') {
			sb.WriteRune(r)
		}
	}
	return sb.String()
}

func buildPreviewURL(commitHash, depID, nodeIP string) (domain string, url string) {
	cleanIP := "127.0.0.1"
	if nodeIP != "" {
		cleanIP = strings.Split(nodeIP, ":")[0]
	}
	dashedIP := strings.ReplaceAll(cleanIP, ".", "-")

	cleanCommit := cleanAlnum(commitHash)
	commit8 := ""
	if len(cleanCommit) >= 8 {
		commit8 = cleanCommit[:8]
	} else if cleanCommit != "" && cleanCommit != "main" {
		commit8 = cleanCommit + strings.Repeat("0", 8-len(cleanCommit))
	} else {
		cleanDep := cleanAlnum(strings.TrimPrefix(depID, "dep-"))
		if len(cleanDep) >= 8 {
			commit8 = cleanDep[:8]
		} else {
			commit8 = "abc123ef"
		}
	}

	domain = fmt.Sprintf("%s-%s.sslip.io", commit8, dashedIP)
	return domain, "http://" + domain
}

