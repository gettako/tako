package orchestrator_test

import (
	"context"
	"testing"
	"time"

	"gettako.dev/tako/internal/orchestrator"
	"gettako.dev/tako/internal/store/db"
	takov1 "gettako.dev/tako/proto/gen/go/tako/v1"
)

func TestFeature_UserSessionLifecycle(t *testing.T) {
	orch, _, cleanup := setupTestOrchestrator(t)
	defer cleanup()

	testUser := db.User{
		ID:    "usr-admin-1",
		Role:  "admin",
		Email: "admin@gettako.dev",
	}

	token := "session-token-secret-xyz"

	// 1. Register Session
	sess := orch.RegisterUserSession(token, testUser)
	if sess.UserID != "usr-admin-1" {
		t.Errorf("expected UserID usr-admin-1, got %s", sess.UserID)
	}
	if sess.UserRole != "admin" {
		t.Errorf("expected UserRole admin, got %s", sess.UserRole)
	}
	if sess.ExpiresAt.Before(time.Now()) {
		t.Errorf("expected future expiration date")
	}

	// 2. Retrieve Active Session
	retrieved, ok := orch.GetUserSession(token)
	if !ok {
		t.Fatalf("expected session to be active and valid")
	}
	if retrieved.UserID != "usr-admin-1" {
		t.Errorf("expected UserID usr-admin-1, got %s", retrieved.UserID)
	}

	// 3. Revoke Session (Logout)
	orch.RevokeUserSession(token)

	// 4. Verify Revoked Session is invalid
	_, ok = orch.GetUserSession(token)
	if ok {
		t.Fatalf("expected revoked session to return ok=false")
	}
}

func TestFeature_AuditTrailLifecycle(t *testing.T) {
	orch, _, cleanup := setupTestOrchestrator(t)
	defer cleanup()

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	// 1. Record multiple audit log events
	actions := []string{"deploy_service", "scale_up", "rollback_service", "update_env"}
	for i, action := range actions {
		_, err := orch.RecordAudit(ctx, orchestrator.AuditLogInput{
			Action:     action,
			TargetType: "service",
			TargetID:   "srv-app-1",
			TargetName: "API Gateway",
			Metadata: map[string]any{
				"attempt": i + 1,
				"actor":   "devops",
			},
		})
		if err != nil {
			t.Fatalf("RecordAudit failed on %s: %v", action, err)
		}
	}

	// 2. Query logs with pagination
	logs, err := orch.Queries().ListAuditLogs(ctx, db.ListAuditLogsParams{
		Limit:  10,
		Offset: 0,
	})
	if err != nil {
		t.Fatalf("ListAuditLogs failed: %v", err)
	}
	if len(logs) < len(actions) {
		t.Fatalf("expected at least %d audit logs, got %d", len(actions), len(logs))
	}

	// Verify latest action is at the top
	if logs[0].Action != "update_env" {
		t.Errorf("expected newest action 'update_env' first, got '%s'", logs[0].Action)
	}
}

func TestFeature_NodeRegistrationAndHeartbeatState(t *testing.T) {
	orch, _, cleanup := setupTestOrchestrator(t)
	defer cleanup()

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	nodeID := "node-hb-test"

	// 1. Register Node
	regResp, err := orch.RegisterNode(ctx, &takov1.RegisterNodeRequest{
		NodeId:        nodeID,
		Name:          "Edge Node 1",
		Role:          "worker",
		IpAddress:     "192.168.1.100",
		PublicIp:      "203.0.113.88",
		CpuTotalCores: 16,
		MemoryTotalMb: 32768,
		DiskTotalGb:   500,
		EnrollToken:   "test-enroll-token",
	})
	if err != nil {
		t.Fatalf("RegisterNode failed: %v", err)
	}
	if regResp.GetStatus() != "registered" {
		t.Errorf("expected registered status, got %s", regResp.GetStatus())
	}

	// 2. Send Heartbeat with Metrics
	hbResp, err := orch.Heartbeat(ctx, &takov1.HeartbeatRequest{
		NodeId:        nodeID,
		CpuPercent:    45.2,
		MemoryUsedMb:  8192,
		DiskUsedGb:    120,
		NetworkRxKbps: 1024.5,
		NetworkTxKbps: 2048.0,
		UptimeSeconds: 86400,
	})
	if err != nil {
		t.Fatalf("Heartbeat failed: %v", err)
	}
	if !hbResp.GetAcknowledged() {
		t.Errorf("expected heartbeat acknowledged=true")
	}

	// 3. Verify node stats in DB
	nodeDB, err := orch.Queries().GetNodeByID(ctx, nodeID)
	if err != nil {
		t.Fatalf("GetNodeByID failed: %v", err)
	}
	if nodeDB.Status != "online" {
		t.Errorf("expected status 'online', got '%s'", nodeDB.Status)
	}
	if nodeDB.CpuPercent != 45.2 {
		t.Errorf("expected CpuPercent 45.2, got %f", nodeDB.CpuPercent)
	}
	if nodeDB.MemoryUsedMb != 8192 {
		t.Errorf("expected MemoryUsedMb 8192, got %d", nodeDB.MemoryUsedMb)
	}
}

func TestFeature_SessionStorePruning(t *testing.T) {
	store := orchestrator.NewSessionStore()
	user := db.User{ID: "usr-1", Role: "admin"}

	// Register a session
	sess := store.Register("token-valid", user)
	if sess.Token != "token-valid" {
		t.Fatalf("expected token-valid, got %s", sess.Token)
	}

	// Active session returns true
	_, ok := store.Get("token-valid")
	if !ok {
		t.Fatalf("expected valid session to be found")
	}

	// Pruning unexpired session returns 0
	pruned := store.PruneExpired()
	if pruned != 0 {
		t.Errorf("expected 0 pruned, got %d", pruned)
	}
}

