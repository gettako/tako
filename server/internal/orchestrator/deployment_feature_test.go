package orchestrator_test

import (
	"context"
	"path/filepath"
	"testing"
	"time"

	"gettako.dev/tako/internal/events"
	"gettako.dev/tako/internal/orchestrator"
	"gettako.dev/tako/internal/security"
	"gettako.dev/tako/internal/store"
	"gettako.dev/tako/internal/store/db"
	takov1 "gettako.dev/tako/proto/gen/go/tako/v1"
)

// setupTestOrchestrator initializes an isolated test DB and returns Orchestrator with event bus
func setupTestOrchestrator(t *testing.T) (*orchestrator.Orchestrator, *events.Bus, func()) {
	t.Helper()
	tmpDir := t.TempDir()
	dbPath := filepath.Join(tmpDir, "test_orch.db")

	database, err := store.OpenDB(dbPath)
	if err != nil {
		t.Fatalf("OpenDB failed: %v", err)
	}

	if err := store.Migrate(database); err != nil {
		database.Close()
		t.Fatalf("Migrate failed: %v", err)
	}

	bus := events.NewBus()
	orch := orchestrator.New(database, bus, "test-enroll-token")

	cleanup := func() {
		database.Close()
	}

	return orch, bus, cleanup
}

func TestFeature_DeploymentHappyPathLifecycle(t *testing.T) {
	orch, bus, cleanup := setupTestOrchestrator(t)
	defer cleanup()

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// 1. Create a test worker node
	_, err := orch.RegisterNode(ctx, &takov1.RegisterNodeRequest{
		NodeId:        "worker-node-1",
		Name:          "Worker Node 1",
		IpAddress:     "192.168.1.50",
		PublicIp:      "203.0.113.10",
		Role:          "worker",
		CpuTotalCores: 8,
		MemoryTotalMb: 16384,
		EnrollToken:   "test-enroll-token",
	})
	if err != nil {
		t.Fatalf("RegisterNode failed: %v", err)
	}

	// 2. Connect mock agent session
	taskChan := make(chan *takov1.MasterTask, 10)
	agentSession := orch.RegisterAgentSession("worker-node-1", taskChan)
	defer orch.UnregisterAgentSession("worker-node-1")

	// 3. Create Service without repository yet so auto-deploy doesn't trigger immediately
	publishHost := true
	srv, err := orch.CreateService(ctx, orchestrator.CreateServiceParams{
		ProjectID: "proj-finance",
		NodeID:    "worker-node-1",
		Name:      "Payment Gateway",
		Slug:      "payment-gateway",
		Type:      "app",
		Branch:    "main",
		Ports:     []int32{8080},
		Domains:   []string{"pay.mycorp.internal"},
		PublishToHost: &publishHost,
	})
	if err != nil {
		t.Fatalf("CreateService failed: %v", err)
	}
	if srv.ID == "" {
		t.Fatalf("expected generated service ID, got empty")
	}

	// Add standard plaintext and encrypted secret environment variables
	_, err = orch.Queries().CreateServiceEnvVar(ctx, db.CreateServiceEnvVarParams{
		ID:        "env-port",
		ServiceID: srv.ID,
		Key:       "PORT",
		Value:     "8080",
		IsSecret:  0,
	})
	if err != nil {
		t.Fatalf("CreateServiceEnvVar PORT failed: %v", err)
	}

	encSecret, err := security.Encrypt("sk_test_secret_stripe_value_12345")
	if err != nil {
		t.Fatalf("Encrypt failed: %v", err)
	}
	_, err = orch.Queries().CreateServiceEnvVar(ctx, db.CreateServiceEnvVarParams{
		ID:        "env-secret-stripe",
		ServiceID: srv.ID,
		Key:       "STRIPE_KEY",
		Value:     encSecret,
		IsSecret:  1,
	})
	if err != nil {
		t.Fatalf("CreateServiceEnvVar STRIPE_KEY failed: %v", err)
	}

	// 4. Subscribe to event bus to verify event streaming
	eventSub := bus.Subscribe()
	defer bus.Unsubscribe(eventSub)

	// 5. Trigger deployment with explicit commit and branch
	dep, err := orch.TriggerDeployWithParams(ctx, srv.ID, "main", "abc1234567890")
	if err != nil {
		t.Fatalf("TriggerDeploy failed: %v", err)
	}
	if dep.Status != "queued" {
		t.Errorf("expected initial status 'queued', got '%s'", dep.Status)
	}

	// 6. Mock Agent receives MasterTask_Deploy
	var receivedTask *takov1.MasterTask
	select {
	case receivedTask = <-taskChan:
	case <-time.After(3 * time.Second):
		t.Fatalf("timed out waiting for MasterTask_Deploy on agent TaskChan")
	}

	deployTask := receivedTask.GetDeploy()
	if deployTask == nil {
		t.Fatalf("expected MasterTask_Deploy, got %v", receivedTask.Task)
	}
	if deployTask.GetServiceId() != srv.ID {
		t.Errorf("expected service ID %s, got %s", srv.ID, deployTask.GetServiceId())
	}
	// Verify environment variables are decrypted in the task delivered to agent
	if deployTask.EnvVars["STRIPE_KEY"] != "sk_test_secret_stripe_value_12345" {
		t.Errorf("expected agent to receive decrypted STRIPE_KEY, got '%s'", deployTask.EnvVars["STRIPE_KEY"])
	}
	if !deployTask.PublishToHost {
		t.Errorf("expected PublishToHost=true")
	}

	// 7. Mock Agent streams progress steps and final "Live" status
	agentSession.HandleResult(&takov1.AgentTaskResult{
		TaskId: dep.ID,
		Result: &takov1.AgentTaskResult_DeployLog{
			DeployLog: &takov1.DeployLogChunk{
				Step:    "Clone",
				Message: "HEAD commit abc1234567: Initial feature commit (by Developer)",
				IsError: false,
			},
		},
	})

	agentSession.HandleResult(&takov1.AgentTaskResult{
		TaskId: dep.ID,
		Result: &takov1.AgentTaskResult_DeployLog{
			DeployLog: &takov1.DeployLogChunk{
				Step:    "Build",
				Message: "Successfully built container image",
				IsError: false,
			},
		},
	})

	agentSession.HandleResult(&takov1.AgentTaskResult{
		TaskId: dep.ID,
		Result: &takov1.AgentTaskResult_DeployLog{
			DeployLog: &takov1.DeployLogChunk{
				Step:    "Health check",
				Message: "HTTP GET /health returned 200 OK",
				IsError: false,
			},
		},
	})

	agentSession.HandleResult(&takov1.AgentTaskResult{
		TaskId: dep.ID,
		Result: &takov1.AgentTaskResult_DeployLog{
			DeployLog: &takov1.DeployLogChunk{
				Step:    "Live",
				Message: "Container active and serving edge ingress traffic",
				IsError: false,
			},
		},
	})

	// 8. Assert database state has transitioned to 'live' and service is 'healthy'
	var finalDep orchestrator.DeploymentStepJSON
	_ = finalDep
	success := false
	for i := 0; i < 50; i++ {
		time.Sleep(50 * time.Millisecond)
		updatedDep, err := orch.GetDeployment(ctx, dep.ID)
		if err == nil && updatedDep.Status == "live" {
			success = true
			if !updatedDep.FinishedAt.Valid {
				t.Errorf("expected FinishedAt to be populated")
			}
			break
		}
	}
	if !success {
		finalState, _ := orch.GetDeployment(ctx, dep.ID)
		t.Fatalf("expected deployment status 'live', got '%s'", finalState.Status)
	}

	updatedSrv, err := orch.Queries().GetServiceByID(ctx, srv.ID)
	if err != nil {
		t.Fatalf("GetServiceByID failed: %v", err)
	}
	if updatedSrv.Status != "healthy" {
		t.Errorf("expected service status 'healthy', got '%s'", updatedSrv.Status)
	}

	// 9. Verify audit log entry exists
	auditLogs, err := orch.Queries().ListAuditLogs(ctx, db.ListAuditLogsParams{
		Limit:  10,
		Offset: 0,
	})
	if err != nil {
		t.Fatalf("ListAuditLogs failed: %v", err)
	}
	var deployAuditFound bool
	for _, al := range auditLogs {
		if al.Action == "deploy_service" && al.TargetID == srv.ID {
			deployAuditFound = true
			break
		}
	}
	if !deployAuditFound {
		t.Errorf("expected deploy_service audit log entry")
	}
}

func TestFeature_DeploymentFailureAndAutoRollback(t *testing.T) {
	orch, _, cleanup := setupTestOrchestrator(t)
	defer cleanup()

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// 1. Setup node and agent
	_, _ = orch.RegisterNode(ctx, &takov1.RegisterNodeRequest{
		NodeId:      "worker-node-rollback",
		Name:        "Rollback Worker",
		Role:        "worker",
		EnrollToken: "test-enroll-token",
	})
	taskChan := make(chan *takov1.MasterTask, 10)
	agentSession := orch.RegisterAgentSession("worker-node-rollback", taskChan)
	defer orch.UnregisterAgentSession("worker-node-rollback")

	// 2. Create service with auto_rollback_enabled = true
	autoRollback := true
	srv, err := orch.CreateService(ctx, orchestrator.CreateServiceParams{
		ProjectID: "proj-rollback",
		NodeID:    "worker-node-rollback",
		Name:      "API Service",
		Slug:      "api-service",
		Type:      "app",
	})
	if err != nil {
		t.Fatalf("CreateService failed: %v", err)
	}

	_, err = orch.UpdateService(ctx, srv.ID, orchestrator.UpdateServiceParams{
		AutoRollbackEnabled: &autoRollback,
	})
	if err != nil {
		t.Fatalf("UpdateService failed: %v", err)
	}

	// 3. Seed stable live deployment V1
	_, err = orch.DB().ExecContext(ctx, `
		INSERT INTO deployments (id, service_id, commit_hash, commit_message, branch, author, status, steps, logs, created_at)
		VALUES ('dep-v1-stable', ?, 'commit-v1-hash', 'Stable V1', 'main', 'dev', 'live', '[]', 'Initial stable build', datetime('now', '-1 hour'));
	`, srv.ID)
	if err != nil {
		t.Fatalf("failed to insert stable v1 deployment: %v", err)
	}

	// 4. Trigger Deployment V2 (broken version)
	depV2, err := orch.TriggerDeployWithParams(ctx, srv.ID, "main", "commit-v2-hash")
	if err != nil {
		t.Fatalf("TriggerDeployWithParams failed: %v", err)
	}

	// Agent receives deploy task for V2
	select {
	case <-taskChan:
	case <-time.After(3 * time.Second):
		t.Fatalf("timed out waiting for MasterTask for depV2")
	}

	// 5. Agent reports health check failure on depV2
	agentSession.HandleResult(&takov1.AgentTaskResult{
		TaskId: depV2.ID,
		Result: &takov1.AgentTaskResult_DeployLog{
			DeployLog: &takov1.DeployLogChunk{
				Step:    "Health check",
				Message: "Container crashed: OOMKilled exit code 137",
				IsError: true,
			},
		},
	})

	// 6. Assert depV2 status transitions to 'failed_rolled_back' or 'failed'
	var failedRollbackSeen bool
	for i := 0; i < 40; i++ {
		time.Sleep(50 * time.Millisecond)
		d, err := orch.GetDeployment(ctx, depV2.ID)
		if err == nil && (d.Status == "failed_rolled_back" || d.Status == "failed") {
			failedRollbackSeen = true
			break
		}
	}
	if !failedRollbackSeen {
		d, _ := orch.GetDeployment(ctx, depV2.ID)
		t.Fatalf("expected depV2 to fail, got status '%s'", d.Status)
	}

	// 7. Auto-rollback triggers a new rollback deployment targeting dep-v1-stable
	// The agent should receive another task for the rollback deployment!
	var rollbackTask *takov1.MasterTask
	select {
	case rollbackTask = <-taskChan:
	case <-time.After(4 * time.Second):
		t.Fatalf("timed out waiting for auto-rollback task dispatch")
	}

	if rollbackTask.GetDeploy() == nil {
		t.Fatalf("expected deploy task for rollback")
	}
	if rollbackTask.GetDeploy().GetCommitHash() != "commit-v1-hash" {
		t.Errorf("expected rollback to commit-v1-hash, got '%s'", rollbackTask.GetDeploy().GetCommitHash())
	}

	// Agent reports Live for the rollback deployment
	agentSession.HandleResult(&takov1.AgentTaskResult{
		TaskId: rollbackTask.GetTaskId(),
		Result: &takov1.AgentTaskResult_DeployLog{
			DeployLog: &takov1.DeployLogChunk{
				Step:    "Live",
				Message: "Previous stable container reinstated",
				IsError: false,
			},
		},
	})

	// 8. Verify service restored to healthy and commit hash restored
	time.Sleep(200 * time.Millisecond)
	restoredSrv, err := orch.Queries().GetServiceByID(ctx, srv.ID)
	if err != nil {
		t.Fatalf("GetServiceByID failed: %v", err)
	}
	if restoredSrv.CommitHash != "commit-v1-hash" {
		t.Errorf("expected service active commit to be restored to 'commit-v1-hash', got '%s'", restoredSrv.CommitHash)
	}
}

func TestFeature_DeploymentFailsImmediatelyWhenNoAgentConnected(t *testing.T) {
	orch, _, cleanup := setupTestOrchestrator(t)
	defer cleanup()

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	// 1. Create a service without registering an active agent session
	srv, err := orch.CreateService(ctx, orchestrator.CreateServiceParams{
		ProjectID: "proj-unconnected",
		NodeID:    "unconnected-node",
		Name:      "Orphan App",
		Slug:      "orphan-app",
		Type:      "app",
	})
	if err != nil {
		t.Fatalf("CreateService failed: %v", err)
	}

	// 2. Trigger deployment
	dep, err := orch.TriggerDeploy(ctx, srv.ID)
	if err != nil {
		t.Fatalf("TriggerDeploy failed: %v", err)
	}

	// 3. Orchestrator should immediately detect missing agent and mark deployment as failed
	var detectedFailed bool
	for i := 0; i < 40; i++ {
		time.Sleep(50 * time.Millisecond)
		d, err := orch.GetDeployment(ctx, dep.ID)
		if err == nil && d.Status == "failed" {
			detectedFailed = true
			if !d.FinishedAt.Valid {
				t.Errorf("expected FinishedAt to be valid on failed deployment")
			}
			break
		}
	}
	if !detectedFailed {
		d, _ := orch.GetDeployment(ctx, dep.ID)
		t.Fatalf("expected deployment to fail immediately without agent, got status '%s'", d.Status)
	}

	// Verify service status marked as 'error'
	srvState, _ := orch.Queries().GetServiceByID(ctx, srv.ID)
	if srvState.Status != "error" {
		t.Errorf("expected service status 'error', got '%s'", srvState.Status)
	}
}

func TestFeature_ManualRollbackDeployment(t *testing.T) {
	orch, _, cleanup := setupTestOrchestrator(t)
	defer cleanup()

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// 1. Setup node and agent
	_, _ = orch.RegisterNode(ctx, &takov1.RegisterNodeRequest{
		NodeId:      "worker-manual-rollback",
		Name:        "Manual Rollback Worker",
		Role:        "worker",
		EnrollToken: "test-enroll-token",
	})
	taskChan := make(chan *takov1.MasterTask, 10)
	agentSession := orch.RegisterAgentSession("worker-manual-rollback", taskChan)
	defer orch.UnregisterAgentSession("worker-manual-rollback")

	// 2. Create service
	srv, err := orch.CreateService(ctx, orchestrator.CreateServiceParams{
		ProjectID: "proj-manual-rb",
		NodeID:    "worker-manual-rollback",
		Name:      "Blog Web",
		Slug:      "blog-web",
		Type:      "app",
	})
	if err != nil {
		t.Fatalf("CreateService failed: %v", err)
	}

	// 3. Seed two deployments: V1 and V2
	_, err = orch.DB().ExecContext(ctx, `
		INSERT INTO deployments (id, service_id, commit_hash, commit_message, branch, author, status, steps, logs, created_at)
		VALUES ('dep-v1', ?, 'hash-v1-stable', 'Release v1.0.0', 'main', 'admin', 'live', '[]', 'v1 build', datetime('now', '-2 days')),
		       ('dep-v2', ?, 'hash-v2-buggy', 'Release v2.0.0 with bug', 'main', 'admin', 'live', '[]', 'v2 build', datetime('now', '-1 hour'));
	`, srv.ID, srv.ID)
	if err != nil {
		t.Fatalf("failed to seed deployments: %v", err)
	}

	// Update service active commit to V2
	_, _ = orch.DB().ExecContext(ctx, "UPDATE services SET commit_hash = 'hash-v2-buggy' WHERE id = ?", srv.ID)

	// 4. Trigger manual rollback to V1
	rollbackDep, err := orch.RollbackDeployment(ctx, "dep-v1")
	if err != nil {
		t.Fatalf("RollbackDeployment failed: %v", err)
	}
	if rollbackDep == nil {
		t.Fatalf("expected non-nil rollback deployment")
	}

	// 5. Agent receives rollback deploy task targeting hash-v1-stable
	var task *takov1.MasterTask
	select {
	case task = <-taskChan:
	case <-time.After(3 * time.Second):
		t.Fatalf("timed out waiting for rollback deploy task")
	}

	if task.GetDeploy() == nil {
		t.Fatalf("expected deploy task")
	}
	if task.GetDeploy().GetCommitHash() != "hash-v1-stable" {
		t.Errorf("expected target commit hash 'hash-v1-stable', got '%s'", task.GetDeploy().GetCommitHash())
	}

	// 6. Agent reports Live
	agentSession.HandleResult(&takov1.AgentTaskResult{
		TaskId: rollbackDep.ID,
		Result: &takov1.AgentTaskResult_DeployLog{
			DeployLog: &takov1.DeployLogChunk{
				Step:    "Live",
				Message: "Rollback container running healthy",
				IsError: false,
			},
		},
	})

	time.Sleep(150 * time.Millisecond)

	// 7. Verify service commit hash updated back to hash-v1-stable
	updatedSrv, err := orch.Queries().GetServiceByID(ctx, srv.ID)
	if err != nil {
		t.Fatalf("GetServiceByID failed: %v", err)
	}
	if updatedSrv.CommitHash != "hash-v1-stable" {
		t.Errorf("expected active commit to be 'hash-v1-stable', got '%s'", updatedSrv.CommitHash)
	}
}
