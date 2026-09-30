package db

import (
	"path/filepath"
	"testing"
)

func TestOpenAndMigrations(t *testing.T) {
	tempDir := t.TempDir()
	dbPath := filepath.Join(tempDir, "test_tako.db")

	database, err := Open(dbPath)
	if err != nil {
		t.Fatalf("Open failed: %v", err)
	}
	defer database.Close()

	var journalMode string
	if err := database.QueryRow("PRAGMA journal_mode;").Scan(&journalMode); err != nil {
		t.Fatalf("failed to query journal_mode: %v", err)
	}
	if journalMode != "wal" {
		t.Errorf("expected journal_mode 'wal', got %q", journalMode)
	}

	tables := []string{
		"users",
		"sessions",
		"passkeys",
		"servers",
		"projects",
		"services",
		"deployments",
		"domains",
		"env_vars",
	}

	for _, table := range tables {
		var count int
		query := "SELECT count(*) FROM sqlite_master WHERE type='table' AND name=?;"
		if err := database.QueryRow(query, table).Scan(&count); err != nil {
			t.Fatalf("failed to check table %s: %v", table, err)
		}
		if count != 1 {
			t.Errorf("expected table %s to exist, but count was %d", table, count)
		}
	}

	// Test foreign key cascades: project -> service
	_, err = database.Exec(`INSERT INTO projects (id, name) VALUES ('prj_test', 'Test Project')`)
	if err != nil {
		t.Fatalf("insert project failed: %v", err)
	}
	_, err = database.Exec(`INSERT INTO servers (id, name) VALUES ('srv_test', 'Test Server')`)
	if err != nil {
		t.Fatalf("insert server failed: %v", err)
	}
	_, err = database.Exec(`INSERT INTO services (id, project_id, server_id, name, repository) VALUES ('svc_test', 'prj_test', 'srv_test', 'Test Service', 'repo/test')`)
	if err != nil {
		t.Fatalf("insert service failed: %v", err)
	}

	// Delete project should cascade delete service
	_, err = database.Exec(`DELETE FROM projects WHERE id = 'prj_test'`)
	if err != nil {
		t.Fatalf("delete project failed: %v", err)
	}

	var serviceCount int
	err = database.QueryRow(`SELECT count(*) FROM services WHERE id = 'svc_test'`).Scan(&serviceCount)
	if err != nil {
		t.Fatalf("count services failed: %v", err)
	}
	if serviceCount != 0 {
		t.Errorf("expected service to be cascaded deleted, found %d", serviceCount)
	}

	// Test reopening database (subsequent restarts without duplicate migration failure)
	database.Close()

	reopenedDB, err := Open(dbPath)
	if err != nil {
		t.Fatalf("reopening Open failed: %v", err)
	}
	defer reopenedDB.Close()
}
