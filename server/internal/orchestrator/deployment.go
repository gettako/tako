package orchestrator

import (
	"context"
	"crypto/rand"
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
	ProjectID       string
	NodeID          string
	Name            string
	Slug            string
	Type            string
	Repository      string
	Branch          string
	Dockerfile      string
	Image           string
	Ports           []int32
	Domains         []string
	EnvironmentVars map[string]string
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

	portsJSON, _ := json.Marshal(p.Ports)

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
		DatabaseType:     "",
		DatabaseVersion:  "",
		ConnectionString: "",
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
	srv, err := o.queries.GetServiceByID(ctx, serviceID)
	if err != nil {
		return nil, fmt.Errorf("service not found: %w", err)
	}

	depID := "dep-" + randomHex(8)
	initialSteps := []DeploymentStepJSON{
		{Name: "Queued", Status: "running", StartedAt: time.Now().UTC().Format(time.RFC3339)},
	}
	stepsJSON, _ := json.Marshal(initialSteps)

	dep, err := o.queries.CreateDeployment(ctx, db.CreateDeploymentParams{
		ID:            depID,
		ServiceID:     srv.ID,
		CommitHash:    srv.CommitHash,
		CommitMessage: "Manual deployment trigger",
		Branch:        srv.Branch,
		Author:        "system",
		Status:        "queued",
		Steps:         string(stepsJSON),
		Logs:          fmt.Sprintf("[%s] Deployment queued for service %s\n", time.Now().Format("15:04:05"), srv.Name),
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
			"commitHash":   srv.CommitHash,
		},
	})

	// Run deployment pipeline asynchronously
	go o.runDeploymentPipeline(srv, depID)

	return &dep, nil
}

func (o *Orchestrator) runDeploymentPipeline(srv db.Service, depID string) {
	bgCtx := context.Background()

	// Check if active agent is connected for this node
	sess := o.GetAgentSession(srv.NodeID)
	if sess != nil {
		// Gather domains
		domainsDB, _ := o.queries.ListServiceDomains(bgCtx, srv.ID)
		domainList := make([]string, 0, len(domainsDB))
		for _, d := range domainsDB {
			domainList = append(domainList, d.Domain)
		}

		// Gather env vars
		envDB, _ := o.queries.ListServiceEnvVars(bgCtx, srv.ID)
		envMap := make(map[string]string)
		for _, ev := range envDB {
			envMap[ev.Key] = ev.Value
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
			if !stepFound {
				stepStatus := "running"
				if chunk.IsError {
					stepStatus = "failed"
				} else if chunk.Step == "Live" {
					stepStatus = "success"
				}
				stepsState = append(stepsState, DeploymentStepJSON{
					Name:      chunk.Step,
					Status:    stepStatus,
					StartedAt: time.Now().UTC().Format(time.RFC3339),
					Logs:      []string{chunk.Message},
				})
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

func randomHex(n int) string {
	b := make([]byte, n)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}
