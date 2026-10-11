package orchestrator_test

import (
	"context"
	"path/filepath"
	"testing"
	"time"

	"gettako.dev/tako/internal/events"
	"gettako.dev/tako/internal/orchestrator"
	"gettako.dev/tako/internal/store"
	takov1 "gettako.dev/tako/proto/gen/go/tako/v1"
)

func TestOrchestratorRegistrationHeartbeatAndLiveness(t *testing.T) {
	tmpDir := t.TempDir()
	dbPath := filepath.Join(tmpDir, "orch_test.db")

	database, err := store.OpenDB(dbPath)
	if err != nil {
		t.Fatalf("OpenDB failed: %v", err)
	}
	defer database.Close()

	if err := store.Migrate(database); err != nil {
		t.Fatalf("Migrate failed: %v", err)
	}

	bus := events.NewBus()
	orch := orchestrator.New(database, bus, "test-master-token")

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// 1. Enrollment token validation
	_, err = orch.RegisterNode(ctx, &takov1.RegisterNodeRequest{
		NodeId:      "node-worker-bad",
		EnrollToken: "wrong-token",
	})
	if err == nil {
		t.Fatalf("expected error on invalid enroll token")
	}

	// 2. Successful Registration
	regResp, err := orch.RegisterNode(ctx, &takov1.RegisterNodeRequest{
		NodeId:        "node-worker-good",
		Name:          "Worker Good",
		IpAddress:     "10.0.0.2",
		CpuTotalCores: 4,
		MemoryTotalMb: 8192,
		EnrollToken:   "test-master-token",
	})
	if err != nil {
		t.Fatalf("RegisterNode failed: %v", err)
	}
	if regResp.GetStatus() != "registered" {
		t.Errorf("expected registered status, got %s", regResp.GetStatus())
	}

	// 3. Heartbeat
	hbResp, err := orch.Heartbeat(ctx, &takov1.HeartbeatRequest{
		NodeId:     "node-worker-good",
		CpuPercent: 25.5,
	})
	if err != nil {
		t.Fatalf("Heartbeat failed: %v", err)
	}
	if !hbResp.GetAcknowledged() {
		t.Errorf("expected acknowledged=true")
	}

	// 4. Liveness Watcher transitions node to offline
	// Start watcher with 10ms interval and 0s timeout
	sub := bus.Subscribe()
	defer bus.Unsubscribe(sub)

	orch.StartLivenessWatcher(ctx, 20*time.Millisecond, 0)

	// Wait for offline event
	offlineDetected := false
	timer := time.After(2 * time.Second)
	for !offlineDetected {
		select {
		case <-timer:
			t.Fatalf("timed out waiting for node to be marked offline")
		case ev := <-sub:
			if ev.Type == events.EventNodeStatusChanged {
				if payload, ok := ev.Payload.(map[string]any); ok {
					if payload["node_id"] == "node-worker-good" && payload["status"] == "offline" {
						offlineDetected = true
					}
				}
			}
		}
	}

	// Verify in DB
	node, err := orch.Queries().GetNodeByID(ctx, "node-worker-good")
	if err != nil {
		t.Fatalf("GetNodeByID failed: %v", err)
	}
	if node.Status != "offline" {
		t.Errorf("expected node status offline in DB, got %s", node.Status)
	}
}

func TestOrchestratorRetentionCleanup(t *testing.T) {
	tmpDir := t.TempDir()
	dbPath := filepath.Join(tmpDir, "orch_retention_test.db")

	database, err := store.OpenDB(dbPath)
	if err != nil {
		t.Fatalf("OpenDB failed: %v", err)
	}
	defer database.Close()

	if err := store.Migrate(database); err != nil {
		t.Fatalf("Migrate failed: %v", err)
	}

	bus := events.NewBus()
	orch := orchestrator.New(database, bus, "test-master-token")
	ctx := context.Background()

	// 1. Seed node, project and service
	_, err = database.ExecContext(ctx, `
		INSERT INTO nodes (id, name, status, role, ip_address) VALUES ('node-1', 'Node 1', 'online', 'worker', '10.0.0.1');
		INSERT INTO projects (id, name, slug) VALUES ('proj-1', 'Project 1', 'proj-1');
		INSERT INTO services (id, project_id, node_id, name, slug, type) VALUES ('svc-1', 'proj-1', 'node-1', 'Service 1', 'svc-1', 'app');
	`)
	if err != nil {
		t.Fatalf("failed to insert test project/service: %v", err)
	}

	// 2. Insert deployments:
	// - old failed deployment (100 days ago) -> should be deleted
	// - old live deployment (100 days ago)   -> should NOT be deleted (live status protected)
	// - recent failed deployment (now)       -> should NOT be deleted (< 90 days)
	_, err = database.ExecContext(ctx, `
		INSERT INTO deployments (id, service_id, status, created_at)
		VALUES ('dep-old-failed', 'svc-1', 'failed', datetime('now', '-100 days'));

		INSERT INTO deployments (id, service_id, status, created_at)
		VALUES ('dep-old-live', 'svc-1', 'live', datetime('now', '-100 days'));

		INSERT INTO deployments (id, service_id, status, created_at)
		VALUES ('dep-recent-failed', 'svc-1', 'failed', datetime('now', '-5 days'));
	`)
	if err != nil {
		t.Fatalf("failed to insert test deployments: %v", err)
	}

	// 3. Insert audit logs:
	// - old audit log (100 days ago) -> should be deleted
	// - recent audit log (now)       -> should be kept
	_, err = database.ExecContext(ctx, `
		INSERT INTO audit_logs (id, actor_id, actor_name, actor_email, action, target_type, target_id, target_name, timestamp)
		VALUES ('audit-old', 'u1', 'Admin', 'admin@gettako.dev', 'deploy', 'service', 'svc-1', 'Service 1', datetime('now', '-100 days'));

		INSERT INTO audit_logs (id, actor_id, actor_name, actor_email, action, target_type, target_id, target_name, timestamp)
		VALUES ('audit-recent', 'u1', 'Admin', 'admin@gettako.dev', 'deploy', 'service', 'svc-1', 'Service 1', datetime('now', '-2 days'));
	`)
	if err != nil {
		t.Fatalf("failed to insert test audit logs: %v", err)
	}

	// Run retention cleanup for 90 days
	orch.RunRetentionCleanup(ctx, 90)

	// Verify deployments
	var countOldFailed, countOldLive, countRecentFailed int
	_ = database.QueryRowContext(ctx, "SELECT COUNT(*) FROM deployments WHERE id = 'dep-old-failed'").Scan(&countOldFailed)
	_ = database.QueryRowContext(ctx, "SELECT COUNT(*) FROM deployments WHERE id = 'dep-old-live'").Scan(&countOldLive)
	_ = database.QueryRowContext(ctx, "SELECT COUNT(*) FROM deployments WHERE id = 'dep-recent-failed'").Scan(&countRecentFailed)

	if countOldFailed != 0 {
		t.Errorf("expected dep-old-failed to be deleted, found count %d", countOldFailed)
	}
	if countOldLive != 1 {
		t.Errorf("expected dep-old-live to be retained, found count %d", countOldLive)
	}
	if countRecentFailed != 1 {
		t.Errorf("expected dep-recent-failed to be retained, found count %d", countRecentFailed)
	}

	// Verify audit logs
	var countOldAudit, countRecentAudit int
	_ = database.QueryRowContext(ctx, "SELECT COUNT(*) FROM audit_logs WHERE id = 'audit-old'").Scan(&countOldAudit)
	_ = database.QueryRowContext(ctx, "SELECT COUNT(*) FROM audit_logs WHERE id = 'audit-recent'").Scan(&countRecentAudit)

	if countOldAudit != 0 {
		t.Errorf("expected audit-old to be deleted, found count %d", countOldAudit)
	}
	if countRecentAudit != 1 {
		t.Errorf("expected audit-recent to be retained, found count %d", countRecentAudit)
	}
}

