package deploy

import (
	"context"
	"database/sql"
	"testing"
	"time"

	_ "modernc.org/sqlite"
)

func setupTestDBForReaper(t *testing.T) *sql.DB {
	t.Helper()
	db, err := sql.Open("sqlite", ":memory:")
	if err != nil {
		t.Fatalf("failed to open in-memory db: %v", err)
	}

	schema := `
	CREATE TABLE projects (id TEXT PRIMARY KEY, name TEXT);
	CREATE TABLE servers (id TEXT PRIMARY KEY, name TEXT, host TEXT);
	CREATE TABLE services (
		id TEXT PRIMARY KEY,
		project_id TEXT,
		server_id TEXT,
		name TEXT,
		service_type TEXT DEFAULT 'web',
		parent_service_id TEXT,
		repository TEXT,
		branch TEXT,
		dockerfile_path TEXT,
		internal_port INTEGER DEFAULT 3000,
		health_check_path TEXT DEFAULT '/healthz',
		status TEXT DEFAULT 'stopped',
		primary_domain TEXT,
		active_deployment_id TEXT,
		is_preview BOOLEAN DEFAULT 0,
		pr_number INTEGER,
		preview_status TEXT DEFAULT '',
		last_activity_at DATETIME,
		updated_at DATETIME,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP
	);
	`
	if _, err := db.Exec(schema); err != nil {
		t.Fatalf("failed to create schema: %v", err)
	}
	return db
}

func TestPreviewReaper_ReapOnce(t *testing.T) {
	db := setupTestDBForReaper(t)
	defer db.Close()

	ctx := context.Background()

	// 1. Insert an active preview (updated 1 hour ago)
	_, err := db.ExecContext(ctx, `
		INSERT INTO services (id, project_id, server_id, name, is_preview, pr_number, last_activity_at, updated_at)
		VALUES ('svc_active', 'p1', 's1', 'active-preview', 1, 1, datetime('now', '-1 hours'), datetime('now', '-1 hours'))
	`)
	if err != nil {
		t.Fatalf("failed to insert active preview: %v", err)
	}

	// 2. Insert an expired preview (idle for 50 hours)
	_, err = db.ExecContext(ctx, `
		INSERT INTO services (id, project_id, server_id, name, is_preview, pr_number, last_activity_at, updated_at)
		VALUES ('svc_expired', 'p1', 's1', 'expired-preview', 1, 2, datetime('now', '-50 hours'), datetime('now', '-50 hours'))
	`)
	if err != nil {
		t.Fatalf("failed to insert expired preview: %v", err)
	}

	// 3. Insert a regular non-preview service (older than 48 hours, should NOT be reaped)
	_, err = db.ExecContext(ctx, `
		INSERT INTO services (id, project_id, server_id, name, is_preview, updated_at)
		VALUES ('svc_main', 'p1', 's1', 'main-service', 0, datetime('now', '-60 hours'))
	`)
	if err != nil {
		t.Fatalf("failed to insert regular service: %v", err)
	}

	reaper := NewPreviewReaper(db, nil, 1*time.Hour, 48*time.Hour)
	reapedCount, err := reaper.ReapOnce(ctx)
	if err != nil {
		t.Fatalf("ReapOnce failed: %v", err)
	}

	if reapedCount != 1 {
		t.Fatalf("expected 1 reaped preview, got %d", reapedCount)
	}

	// Verify svc_expired is deleted
	var count int
	_ = db.QueryRowContext(ctx, `SELECT count(*) FROM services WHERE id = 'svc_expired'`).Scan(&count)
	if count != 0 {
		t.Errorf("expected svc_expired to be deleted")
	}

	// Verify svc_active and svc_main remain
	_ = db.QueryRowContext(ctx, `SELECT count(*) FROM services WHERE id = 'svc_active'`).Scan(&count)
	if count != 1 {
		t.Errorf("expected svc_active to remain")
	}
	_ = db.QueryRowContext(ctx, `SELECT count(*) FROM services WHERE id = 'svc_main'`).Scan(&count)
	if count != 1 {
		t.Errorf("expected svc_main to remain")
	}
}
