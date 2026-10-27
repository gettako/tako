package orchestrator_test

import (
	"context"
	"strings"
	"testing"
	"time"

	"gettako.dev/tako/internal/orchestrator"
	"gettako.dev/tako/internal/security"
	"gettako.dev/tako/internal/store/db"
	takov1 "gettako.dev/tako/proto/gen/go/tako/v1"
)

// TestFeature_DemoVerify_CompleteE2ELifecycle validates the full lifecycle for
// https://github.com/supianidz/tako-demo-verify:
// 1. Service registration with repo, branch, and Dockerfile
// 2. Environment variable editor with encrypted secrets & inheritance
// 3. Compute specs (CPU, Memory limits) and auto-scaling criteria
// 4. Deployment execution & log streaming
// 5. Rollback to previous deployment revision
// 6. Scheduled Cron job creation, status toggling, and run history
func TestFeature_DemoVerify_CompleteE2ELifecycle(t *testing.T) {
	orch, _, cleanup := setupTestOrchestrator(t)
	defer cleanup()

	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()

	// -------------------------------------------------------------
	// 1. Register Edge Worker Node & Connect Mock Agent Session
	// -------------------------------------------------------------
	_, err := orch.RegisterNode(ctx, &takov1.RegisterNodeRequest{
		NodeId:        "worker-demo-edge",
		Name:          "Edge Node Demo",
		IpAddress:     "192.168.1.100",
		PublicIp:      "43.156.243.241",
		Role:          "worker",
		CpuTotalCores: 8,
		MemoryTotalMb: 16384,
		EnrollToken:   "test-enroll-token",
	})
	if err != nil {
		t.Fatalf("RegisterNode failed: %v", err)
	}

	taskChan := make(chan *takov1.MasterTask, 10)
	agentSession := orch.RegisterAgentSession("worker-demo-edge", taskChan)
	defer orch.UnregisterAgentSession("worker-demo-edge")

	// -------------------------------------------------------------
	// 2. Create Project and Service with git repo: https://github.com/supianidz/tako-demo-verify
	// -------------------------------------------------------------
	proj, err := orch.Queries().CreateProject(ctx, db.CreateProjectParams{
		ID:          "proj-demo-verify",
		Name:        "Tako Demo Project",
		Slug:        "tako-demo-project",
		Description: "Verification project for Tako PaaS",
		Environment: "production",
	})
	if err != nil {
		t.Fatalf("CreateProject failed: %v", err)
	}

	srv, err := orch.CreateService(ctx, orchestrator.CreateServiceParams{
		ProjectID:  proj.ID,
		NodeID:     "worker-demo-edge",
		Name:       "Tako Demo Verify",
		Slug:       "tako-demo-verify",
		Type:       "web",
		Repository: "https://github.com/supianidz/tako-demo-verify",
		Branch:     "main",
		Dockerfile: "Dockerfile",
		Ports:      []int32{8080},
		Domains:    []string{"demo.gettako.dev"},
		AutoDeploy: true,
	})
	if err != nil {
		t.Fatalf("CreateService failed: %v", err)
	}

	if srv.Repository != "https://github.com/supianidz/tako-demo-verify" {
		t.Errorf("expected repo https://github.com/supianidz/tako-demo-verify, got %s", srv.Repository)
	}
	if srv.Branch != "main" {
		t.Errorf("expected branch main, got %s", srv.Branch)
	}

	// Consume auto-deploy task triggered by CreateService
	select {
	case initialTask := <-taskChan:
		if initialTask.GetDeploy().GetRepository() != "https://github.com/supianidz/tako-demo-verify" {
			t.Errorf("expected initial repo deploy task")
		}
	case <-time.After(3 * time.Second):
		t.Fatalf("timed out waiting for initial auto-deploy task")
	}

	// -------------------------------------------------------------
	// 3. Environment Variables Editor: Project & Service Level with Secrets Encryption
	// -------------------------------------------------------------
	// Shared project variable
	sharedSecretEnc, _ := security.Encrypt("super-shared-token-999")
	_, err = orch.Queries().CreateProjectEnvVar(ctx, db.CreateProjectEnvVarParams{
		ID:        "penv-1",
		ProjectID: proj.ID,
		Key:       "SHARED_CLUSTER_KEY",
		Value:     sharedSecretEnc,
		IsSecret:  1,
	})
	if err != nil {
		t.Fatalf("CreateProjectEnvVar failed: %v", err)
	}

	// Service variables
	secretValEnc, _ := security.Encrypt("postgres://user:pass@internal-db:5432/verify")
	plainValEnc, _ := security.Encrypt("production")
	portValEnc, _ := security.Encrypt("8080")

	_, _ = orch.Queries().CreateServiceEnvVar(ctx, db.CreateServiceEnvVarParams{
		ID:        "senv-1",
		ServiceID: srv.ID,
		Key:       "APP_ENV",
		Value:     plainValEnc,
		IsSecret:  0,
	})
	_, _ = orch.Queries().CreateServiceEnvVar(ctx, db.CreateServiceEnvVarParams{
		ID:        "senv-2",
		ServiceID: srv.ID,
		Key:       "PORT",
		Value:     portValEnc,
		IsSecret:  0,
	})
	_, _ = orch.Queries().CreateServiceEnvVar(ctx, db.CreateServiceEnvVarParams{
		ID:        "senv-3",
		ServiceID: srv.ID,
		Key:       "DATABASE_URL",
		Value:     secretValEnc,
		IsSecret:  1,
	})

	// Verify env vars listing & decryption
	svcEnvs, err := orch.Queries().ListServiceEnvVars(ctx, srv.ID)
	if err != nil || len(svcEnvs) != 3 {
		t.Fatalf("expected 3 service env vars, got %d (err: %v)", len(svcEnvs), err)
	}
	for _, ev := range svcEnvs {
		decrypted, decErr := security.Decrypt(ev.Value)
		if decErr != nil {
			t.Fatalf("failed to decrypt env var %s: %v", ev.Key, decErr)
		}
		if ev.Key == "DATABASE_URL" && decrypted != "postgres://user:pass@internal-db:5432/verify" {
			t.Errorf("unexpected decrypted secret: %s", decrypted)
		}
	}

	// -------------------------------------------------------------
	// 4. Compute Specs & Auto-Scaling Configuration Update
	// -------------------------------------------------------------
	newCPU := 2.0
	newMem := int64(1024)
	newReplicas := int64(2)
	asEnabled := true
	minR := int64(2)
	maxR := int64(6)
	targetCPU := 75.0
	targetMem := 80.0
	metric := "cpu"
	scaleDownCPU := 30.0
	cooldownSec := int64(180)
	autoRollback := true

	updatedSrv, err := orch.UpdateService(ctx, srv.ID, orchestrator.UpdateServiceParams{
		CPULimit:            &newCPU,
		MemoryLimitMB:       &newMem,
		Replicas:            &newReplicas,
		AutoScalingEnabled:  &asEnabled,
		MinReplicas:         &minR,
		MaxReplicas:         &maxR,
		TargetCPUPercent:    &targetCPU,
		TargetMemoryPercent: &targetMem,
		AutoScalingMetric:   &metric,
		ScaleDownCPUPercent: &scaleDownCPU,
		CooldownSeconds:     &cooldownSec,
		AutoRollbackEnabled: &autoRollback,
	})
	if err != nil {
		t.Fatalf("UpdateService specs failed: %v", err)
	}

	if updatedSrv.CpuLimit != 2.0 || updatedSrv.MemoryLimitMb != 1024 || updatedSrv.Replicas != 2 {
		t.Errorf("compute specs mismatch: CPU=%v, Mem=%v, Replicas=%v", updatedSrv.CpuLimit, updatedSrv.MemoryLimitMb, updatedSrv.Replicas)
	}
	if updatedSrv.AutoScalingEnabled != 1 || updatedSrv.MinReplicas != 2 || updatedSrv.MaxReplicas != 6 {
		t.Errorf("autoscaling spec mismatch: enabled=%v, min=%v, max=%v", updatedSrv.AutoScalingEnabled, updatedSrv.MinReplicas, updatedSrv.MaxReplicas)
	}

	// -------------------------------------------------------------
	// 5. Deployment Pipeline: Revision 1
	// -------------------------------------------------------------
	dep1, err := orch.TriggerDeployWithParams(ctx, srv.ID, "main", "864369991ebb0ce00cff990fcd80417e216282b6")
	if err != nil {
		t.Fatalf("TriggerDeployWithParams failed: %v", err)
	}

	// Read dispatched MasterTask from agent session
	var deployTask1 *takov1.MasterTask
	select {
	case deployTask1 = <-taskChan:
	case <-time.After(3 * time.Second):
		t.Fatalf("timed out waiting for agent deploy task")
	}

	deployReq1 := deployTask1.GetDeploy()
	if deployReq1 == nil {
		t.Fatalf("expected deploy task, got %v", deployTask1)
	}
	if deployReq1.GetRepository() != "https://github.com/supianidz/tako-demo-verify" {
		t.Errorf("task repo mismatch: %s", deployReq1.GetRepository())
	}
	// Verify environment variables were decrypted and injected into agent task
	taskEnvs := deployReq1.GetEnvVars()
	if taskEnvs["APP_ENV"] != "production" || taskEnvs["PORT"] != "8080" {
		t.Errorf("missing plain env vars in deploy task: %v", taskEnvs)
	}
	if taskEnvs["DATABASE_URL"] != "postgres://user:pass@internal-db:5432/verify" {
		t.Errorf("missing secret env var in deploy task: %v", taskEnvs)
	}
	if taskEnvs["SHARED_CLUSTER_KEY"] != "super-shared-token-999" {
		t.Errorf("missing inherited project env var in deploy task: %v", taskEnvs)
	}

	// Simulate agent log streaming for Revision 1
	agentSession.HandleResult(&takov1.AgentTaskResult{
		TaskId: dep1.ID,
		Result: &takov1.AgentTaskResult_DeployLog{
			DeployLog: &takov1.DeployLogChunk{
				DeploymentId: dep1.ID,
				Step:         "Clone",
				Message:      "Cloned https://github.com/supianidz/tako-demo-verify at commit 86436999",
			},
		},
	})
	agentSession.HandleResult(&takov1.AgentTaskResult{
		TaskId: dep1.ID,
		Result: &takov1.AgentTaskResult_DeployLog{
			DeployLog: &takov1.DeployLogChunk{
				DeploymentId: dep1.ID,
				Step:         "Build",
				Message:      "Docker image built and tagged tako/tako-demo-verify:86436999",
			},
		},
	})
	agentSession.HandleResult(&takov1.AgentTaskResult{
		TaskId: dep1.ID,
		Result: &takov1.AgentTaskResult_DeployLog{
			DeployLog: &takov1.DeployLogChunk{
				DeploymentId: dep1.ID,
				Step:         "Live",
				Message:      "Container tako-app-tako-demo-verify-86436999 running",
			},
		},
	})

	var dep1Live bool
	for i := 0; i < 40; i++ {
		time.Sleep(25 * time.Millisecond)
		dep1Updated, err := orch.GetDeployment(ctx, dep1.ID)
		if err == nil && dep1Updated.Status == "live" {
			dep1Live = true
			break
		}
	}
	if !dep1Live {
		d, _ := orch.GetDeployment(ctx, dep1.ID)
		t.Fatalf("expected Revision 1 status 'live', got '%s'", d.Status)
	}

	// -------------------------------------------------------------
	// 6. Deployment Pipeline: Revision 2 & Rollback to Revision 1
	// -------------------------------------------------------------
	dep2, err := orch.TriggerDeployWithParams(ctx, srv.ID, "main", "a1b2c3d4e5f60000111122223333444455556666")
	if err != nil {
		t.Fatalf("TriggerDeployWithParams for Revision 2 failed: %v", err)
	}

	select {
	case <-taskChan:
	case <-time.After(3 * time.Second):
		t.Fatalf("timed out waiting for Revision 2 deploy task")
	}

	agentSession.HandleResult(&takov1.AgentTaskResult{
		TaskId: dep2.ID,
		Result: &takov1.AgentTaskResult_DeployLog{
			DeployLog: &takov1.DeployLogChunk{
				DeploymentId: dep2.ID,
				Step:         "Live",
				Message:      "Container tako-app-tako-demo-verify-a1b2c3d4 running",
			},
		},
	})

	var dep2Live bool
	for i := 0; i < 40; i++ {
		time.Sleep(25 * time.Millisecond)
		dep2Updated, err := orch.GetDeployment(ctx, dep2.ID)
		if err == nil && dep2Updated.Status == "live" {
			dep2Live = true
			break
		}
	}
	if !dep2Live {
		d, _ := orch.GetDeployment(ctx, dep2.ID)
		t.Fatalf("expected Revision 2 status 'live', got '%s'", d.Status)
	}

	// Trigger Rollback targeting Revision 1
	rollbackDep, err := orch.RollbackDeployment(ctx, dep1.ID)
	if err != nil {
		t.Fatalf("RollbackDeployment failed: %v", err)
	}

	if !strings.Contains(rollbackDep.CommitMessage, "Rollback to") {
		t.Errorf("expected rollback commit message, got: %s", rollbackDep.CommitMessage)
	}
	if rollbackDep.CommitHash != dep1.CommitHash {
		t.Errorf("expected rollback commit hash %s, got %s", dep1.CommitHash, rollbackDep.CommitHash)
	}

	// Verify rollback deploy task was sent to agent with Revision 1 commit
	select {
	case rbTask := <-taskChan:
		if rbTask.GetDeploy().GetCommitHash() != dep1.CommitHash {
			t.Errorf("expected rollback task commit %s, got %s", dep1.CommitHash, rbTask.GetDeploy().GetCommitHash())
		}
	case <-time.After(3 * time.Second):
		t.Fatalf("timed out waiting for rollback agent task")
	}

	// -------------------------------------------------------------
	// 7. Cron Jobs: Schedule, Toggle Status, Run History
	// -------------------------------------------------------------
	cronJob, err := orch.Queries().CreateCronJob(ctx, db.CreateCronJobParams{
		ID:        "cron-demo-sync",
		ServiceID: srv.ID,
		Name:      "Nightly Database Backup & Sync",
		Schedule:  "0 2 * * *",
		Command:   "/app/server --sync-data",
		Status:    "active",
	})
	if err != nil {
		t.Fatalf("CreateCronJob failed: %v", err)
	}

	if cronJob.Schedule != "0 2 * * *" || cronJob.Status != "active" {
		t.Errorf("unexpected cron job properties: %v", cronJob)
	}

	// Pause cron job
	err = orch.Queries().UpdateCronJobStatus(ctx, db.UpdateCronJobStatusParams{
		ID:     cronJob.ID,
		Status: "paused",
	})
	if err != nil {
		t.Fatalf("UpdateCronJobStatus failed: %v", err)
	}

	// Resume cron job
	err = orch.Queries().UpdateCronJobStatus(ctx, db.UpdateCronJobStatusParams{
		ID:     cronJob.ID,
		Status: "active",
	})
	if err != nil {
		t.Fatalf("Resume cron job failed: %v", err)
	}

	// Simulate manual or scheduled cron job run execution
	runRecord, err := orch.Queries().CreateCronJobRun(ctx, db.CreateCronJobRunParams{
		ID:        "crun-demo-01",
		CronJobID: cronJob.ID,
		Status:    "running",
		ExitCode:  0,
		Output:    "Starting sync job for tako-demo-verify...",
	})
	if err != nil {
		t.Fatalf("CreateCronJobRun failed: %v", err)
	}

	// Complete run
	err = orch.Queries().UpdateCronJobRun(ctx, db.UpdateCronJobRunParams{
		ID:       runRecord.ID,
		Status:   "success",
		ExitCode: 0,
		Output:   "Starting sync job for tako-demo-verify...\nSync complete: 42 records processed.\n",
	})
	if err != nil {
		t.Fatalf("UpdateCronJobRun failed: %v", err)
	}

	runs, err := orch.Queries().ListCronJobRuns(ctx, cronJob.ID)
	if err != nil || len(runs) != 1 {
		t.Fatalf("expected 1 cron run, got %d (err: %v)", len(runs), err)
	}
	if runs[0].Status != "success" || runs[0].ExitCode != 0 {
		t.Errorf("unexpected run record: %+v", runs[0])
	}
}
