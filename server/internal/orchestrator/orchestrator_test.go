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
