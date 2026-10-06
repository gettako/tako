package store_test

import (
	"context"
	"path/filepath"
	"testing"

	"gettako.dev/tako/internal/store"
	"gettako.dev/tako/internal/store/db"
)

func TestOpenDBAndPragmas(t *testing.T) {
	tmpDir := t.TempDir()
	dbPath := filepath.Join(tmpDir, "test.db")

	database, err := store.OpenDB(dbPath)
	if err != nil {
		t.Fatalf("OpenDB failed: %v", err)
	}
	defer database.Close()

	// Verify Pragmas
	var journalMode string
	if err := database.QueryRow("PRAGMA journal_mode;").Scan(&journalMode); err != nil {
		t.Fatalf("failed to query journal_mode: %v", err)
	}
	if journalMode != "wal" {
		t.Errorf("expected journal_mode=wal, got %s", journalMode)
	}

	var busyTimeout int
	if err := database.QueryRow("PRAGMA busy_timeout;").Scan(&busyTimeout); err != nil {
		t.Fatalf("failed to query busy_timeout: %v", err)
	}
	if busyTimeout < 5000 {
		t.Errorf("expected busy_timeout >= 5000, got %d", busyTimeout)
	}

	var foreignKeys int
	if err := database.QueryRow("PRAGMA foreign_keys;").Scan(&foreignKeys); err != nil {
		t.Fatalf("failed to query foreign_keys: %v", err)
	}
	if foreignKeys != 1 {
		t.Errorf("expected foreign_keys=1, got %d", foreignKeys)
	}

	// Verify Migrations
	if err := store.Migrate(database); err != nil {
		t.Fatalf("Migrate failed: %v", err)
	}

	// Verify Schema & SQLC operations
	queries := db.New(database)
	ctx := context.Background()

	createdNode, err := queries.CreateNode(ctx, db.CreateNodeParams{
		ID:            "node-test-1",
		Name:          "Leader Node",
		IpAddress:     "192.168.1.10",
		PublicIp:      "1.2.3.4",
		Role:          "leader",
		Status:        "online",
		CpuTotalCores: 8,
		MemoryTotalMb: 16384,
		DiskTotalGb:   500.0,
		DockerVersion: "27.0.3",
		Os:            "linux",
		KernelVersion: "6.8.0",
		EnrollToken:   "token-123",
	})
	if err != nil {
		t.Fatalf("CreateNode failed: %v", err)
	}
	if createdNode.ID != "node-test-1" {
		t.Errorf("expected node ID node-test-1, got %s", createdNode.ID)
	}

	fetchedNode, err := queries.GetNodeByID(ctx, "node-test-1")
	if err != nil {
		t.Fatalf("GetNodeByID failed: %v", err)
	}
	if fetchedNode.Name != "Leader Node" {
		t.Errorf("expected node name 'Leader Node', got %s", fetchedNode.Name)
	}
}
