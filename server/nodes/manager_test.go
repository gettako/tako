package nodes

import (
	"context"
	"path/filepath"
	"testing"
	"time"

	"gettako.dev/tako/server/db"
	"gettako.dev/tako/internal/protocol"
)

func setupTestDB(t *testing.T) *NodeManager {
	tempDir := t.TempDir()
	dbPath := filepath.Join(tempDir, "nodes_test.db")

	database, err := db.Open(dbPath)
	if err != nil {
		t.Fatalf("failed to open test db: %v", err)
	}
	t.Cleanup(func() { database.Close() })

	_, err = database.Exec(`
		INSERT INTO servers (id, name, status, cpu_percent, ram_percent, disk_percent, last_heartbeat_at)
		VALUES ('srv_node_1', 'Node 1', 'pending', 0, 0, 0, NULL)
	`)
	if err != nil {
		t.Fatalf("failed to insert test server: %v", err)
	}

	return NewNodeManager(database)
}

func TestNodeManagerLifecycleAndLiveness(t *testing.T) {
	nm := setupTestDB(t)
	ctx := context.Background()

	// 1. Register session sets status online
	_, err := nm.RegisterSession(ctx, "srv_node_1", nil)
	if err != nil {
		t.Fatalf("RegisterSession failed: %v", err)
	}

	var status string
	err = nm.db.QueryRowContext(ctx, `SELECT status FROM servers WHERE id = 'srv_node_1'`).Scan(&status)
	if err != nil {
		t.Fatalf("failed to query status: %v", err)
	}
	if status != "online" {
		t.Fatalf("expected server status 'online', got '%s'", status)
	}
	if !nm.IsOnline("srv_node_1") {
		t.Fatal("expected IsOnline to be true")
	}

	// 2. Record heartbeat updates telemetry cache and DB
	hb := &protocol.Heartbeat{
		CpuPercent:    22.5,
		RamPercent:    58.0,
		DiskPercent:   33.2,
		UptimeSeconds: 500,
	}
	err = nm.RecordHeartbeat(ctx, "srv_node_1", hb)
	if err != nil {
		t.Fatalf("RecordHeartbeat failed: %v", err)
	}

	telemetry := nm.GetTelemetry("srv_node_1")
	if telemetry == nil {
		t.Fatal("expected non-nil telemetry")
	}
	if telemetry.CPUPercent != 22.5 || telemetry.RAMPercent != 58.0 || telemetry.DiskPercent != 33.2 {
		t.Fatalf("telemetry mismatch: %+v", telemetry)
	}

	var dbCPU, dbRAM, dbDisk float64
	err = nm.db.QueryRowContext(ctx, `SELECT cpu_percent, ram_percent, disk_percent FROM servers WHERE id = 'srv_node_1'`).Scan(&dbCPU, &dbRAM, &dbDisk)
	if err != nil {
		t.Fatalf("failed to query telemetry: %v", err)
	}
	if dbCPU != 22.5 || dbRAM != 58.0 || dbDisk != 33.2 {
		t.Fatalf("database telemetry mismatch: %f, %f, %f", dbCPU, dbRAM, dbDisk)
	}

	// 3. Liveness check: with short timeout, triggers transition to offline
	nm.SetOfflineTimeout(50 * time.Millisecond)
	time.Sleep(60 * time.Millisecond)

	// Update DB last_heartbeat_at to be in the past
	_, _ = nm.db.ExecContext(ctx, `UPDATE servers SET last_heartbeat_at = datetime('now', '-60 seconds') WHERE id = 'srv_node_1'`)

	nm.CheckLiveness(ctx)

	if nm.IsOnline("srv_node_1") {
		t.Fatal("expected node to be marked offline after timeout")
	}

	err = nm.db.QueryRowContext(ctx, `SELECT status FROM servers WHERE id = 'srv_node_1'`).Scan(&status)
	if err != nil {
		t.Fatalf("failed to query status: %v", err)
	}
	if status != "offline" {
		t.Fatalf("expected server status 'offline' after liveness timeout, got '%s'", status)
	}
}

func TestSendCommandOfflineNode(t *testing.T) {
	nm := setupTestDB(t)
	ctx := context.Background()

	err := nm.SendCommand(ctx, "srv_nonexistent", &protocol.ServerMessage{})
	if err == nil {
		t.Fatal("expected error sending to non-existent node, got nil")
	}

	_, _ = nm.RegisterSession(ctx, "srv_node_1", nil)
	nm.UnregisterSession(ctx, "srv_node_1")

	err = nm.SendCommand(ctx, "srv_node_1", &protocol.ServerMessage{})
	if err == nil {
		t.Fatal("expected error sending to node without active stream, got nil")
	}
}
