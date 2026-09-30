package audit

import (
	"context"
	"database/sql"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	_ "modernc.org/sqlite"
)

func setupTestDB(t *testing.T) *sql.DB {
	t.Helper()
	db, err := sql.Open("sqlite", ":memory:")
	if err != nil {
		t.Fatalf("failed to open test db: %v", err)
	}

	createTable := `
	CREATE TABLE audit_log (
		id            TEXT PRIMARY KEY,
		actor         TEXT NOT NULL,
		action        TEXT NOT NULL,
		resource_id   TEXT,
		resource_type TEXT,
		metadata      TEXT,
		ip_address    TEXT,
		created_at    DATETIME NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
	);
	CREATE INDEX idx_audit_log_created_at_id ON audit_log(created_at DESC, id DESC);
	`
	if _, err := db.Exec(createTable); err != nil {
		t.Fatalf("failed to create audit_log schema: %v", err)
	}

	return db
}

func TestULID(t *testing.T) {
	u1 := NewULID()
	if len(u1) != 26 {
		t.Fatalf("expected ULID length 26, got %d (%s)", len(u1), u1)
	}

	time.Sleep(2 * time.Millisecond)
	u2 := NewULID()
	if u1 == u2 {
		t.Fatalf("ULIDs should be unique")
	}

	if u1 >= u2 {
		t.Fatalf("ULIDs should be monotonically sortable: u1=%s, u2=%s", u1, u2)
	}
}

func TestAuditRecordSyncAndList(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()

	mgr := NewManager(db)
	ctx := context.Background()

	ctx = ContextWithIP(ctx, "192.168.1.100")

	// Insert entries
	entry1, err := mgr.RecordSync(ctx, "project.create", "project", "prj_1", map[string]string{"name": "Alpha"})
	if err != nil {
		t.Fatalf("failed to record entry 1: %v", err)
	}
	if entry1.Actor != "owner" {
		t.Errorf("expected actor 'owner', got %s", entry1.Actor)
	}
	if entry1.IPAddress == nil || *entry1.IPAddress != "192.168.1.100" {
		t.Errorf("expected IP '192.168.1.100', got %v", entry1.IPAddress)
	}

	time.Sleep(5 * time.Millisecond)
	_, err = mgr.RecordSync(ctx, "service.create", "service", "srv_1", map[string]string{"name": "Web"})
	if err != nil {
		t.Fatalf("failed to record entry 2: %v", err)
	}

	time.Sleep(5 * time.Millisecond)
	_, err = mgr.RecordSync(ctx, "service.deploy", "service", "srv_1", map[string]string{"branch": "main", "commit": "abc"})
	if err != nil {
		t.Fatalf("failed to record entry 3: %v", err)
	}

	// List without cursor
	resp, err := mgr.List(ctx, 2, "")
	if err != nil {
		t.Fatalf("failed to list audit entries: %v", err)
	}

	if len(resp.Items) != 2 {
		t.Fatalf("expected 2 items, got %d", len(resp.Items))
	}

	if resp.Items[0].Action != "service.deploy" {
		t.Errorf("expected newest first ('service.deploy'), got %s", resp.Items[0].Action)
	}
	if resp.NextCursor == nil {
		t.Fatalf("expected next_cursor when items exceed limit")
	}

	// Fetch next page with cursor
	resp2, err := mgr.List(ctx, 2, *resp.NextCursor)
	if err != nil {
		t.Fatalf("failed to list next page: %v", err)
	}

	if len(resp2.Items) != 1 {
		t.Fatalf("expected 1 item on next page, got %d", len(resp2.Items))
	}
	if resp2.Items[0].Action != "project.create" {
		t.Errorf("expected oldest item ('project.create'), got %s", resp2.Items[0].Action)
	}
	if resp2.NextCursor != nil {
		t.Errorf("expected next_cursor to be nil on last page, got %v", resp2.NextCursor)
	}
}

func TestAuditPrune(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()

	mgr := NewManager(db)
	ctx := context.Background()

	// Insert an old record (100 days ago)
	oldTimestamp := time.Now().UTC().Add(-100 * 24 * time.Hour).Format(time.RFC3339)
	oldULID := NewULIDAt(time.Now().UTC().Add(-100 * 24 * time.Hour))
	_, err := db.Exec(`
		INSERT INTO audit_log (id, actor, action, resource_type, resource_id, created_at)
		VALUES (?, 'owner', 'server.delete', 'server', 'srv_old', ?)
	`, oldULID, oldTimestamp)
	if err != nil {
		t.Fatalf("failed to insert old audit log: %v", err)
	}

	// Insert recent record
	_, err = mgr.RecordSync(ctx, "session.login", "session", "sess_1", nil)
	if err != nil {
		t.Fatalf("failed to insert recent audit log: %v", err)
	}

	// Prune records older than 90 days
	deleted, err := mgr.Prune(ctx, 90*24*time.Hour)
	if err != nil {
		t.Fatalf("failed to prune: %v", err)
	}
	if deleted != 1 {
		t.Errorf("expected 1 record pruned, got %d", deleted)
	}

	// Verify only recent remains
	resp, err := mgr.List(ctx, 10, "")
	if err != nil {
		t.Fatalf("failed to list: %v", err)
	}
	if len(resp.Items) != 1 {
		t.Fatalf("expected 1 record remaining, got %d", len(resp.Items))
	}
	if resp.Items[0].Action != "session.login" {
		t.Errorf("expected remaining action 'session.login', got %s", resp.Items[0].Action)
	}
}

func TestHandleListEndpoint(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()

	mgr := NewManager(db)
	ctx := context.Background()

	_, err := mgr.RecordSync(ctx, "env.update", "service", "srv_1", map[string]int{"count": 3})
	if err != nil {
		t.Fatalf("failed to record: %v", err)
	}

	req := httptest.NewRequest(http.MethodGet, "/api/audit-log?limit=10", nil)
	w := httptest.NewRecorder()

	mgr.HandleList(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", w.Code)
	}

	var resp ListResponse
	if err := json.NewDecoder(w.Body).Decode(&resp); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}

	if len(resp.Items) != 1 {
		t.Fatalf("expected 1 item, got %d", len(resp.Items))
	}
	if resp.Items[0].Action != "env.update" {
		t.Errorf("expected action 'env.update', got %s", resp.Items[0].Action)
	}
}

func TestClientIPMiddleware(t *testing.T) {
	var capturedIP string
	handler := ClientIPMiddleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		capturedIP = IPFromContext(r.Context())
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.Header.Set("X-Forwarded-For", "203.0.113.195, 70.41.3.18")
	w := httptest.NewRecorder()

	handler.ServeHTTP(w, req)

	if capturedIP != "203.0.113.195" {
		t.Errorf("expected captured IP '203.0.113.195', got '%s'", capturedIP)
	}
}
