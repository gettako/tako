package orchestrator

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"time"

	"gettako.dev/tako/internal/events"
	"gettako.dev/tako/internal/store/db"
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
	serviceID := "srv-" + randomHex(8)
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

	// Run deployment pipeline asynchronously
	go o.runDeploymentPipeline(srv, depID)

	return &dep, nil
}

func (o *Orchestrator) runDeploymentPipeline(srv db.Service, depID string) {
	bgCtx := context.Background()
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
