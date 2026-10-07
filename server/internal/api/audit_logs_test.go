package api

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"gettako.dev/tako/internal/events"
	"gettako.dev/tako/internal/orchestrator"
	"gettako.dev/tako/internal/store"
)

func TestAuditLogsAPI(t *testing.T) {
	db, err := store.OpenDB(":memory:")
	if err != nil {
		t.Fatalf("OpenDB failed: %v", err)
	}
	defer db.Close()

	if err := store.Migrate(db); err != nil {
		t.Fatalf("Migrate failed: %v", err)
	}

	bus := events.NewBus()
	orch := orchestrator.New(db, bus, "test-secret")
	router := NewRouter(db, orch)

	// 1. Initially empty audit logs
	req := httptest.NewRequest(http.MethodGet, "/api/v1/audit-logs", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200 OK, got %d", w.Code)
	}

	var logs []AuditLogResponse
	if err := json.Unmarshal(w.Body.Bytes(), &logs); err != nil {
		t.Fatalf("failed to decode json: %v", err)
	}
	if len(logs) != 0 {
		t.Fatalf("expected 0 audit logs, got %d", len(logs))
	}

	// 2. Create project -> should record audit log
	projBody, _ := json.Marshal(CreateProjectRequest{
		Name:        "Test App Project",
		Slug:        "test-app",
		Description: "Testing audit log integration",
	})
	req2 := httptest.NewRequest(http.MethodPost, "/api/v1/projects", bytes.NewReader(projBody))
	req2.Header.Set("Content-Type", "application/json")
	w2 := httptest.NewRecorder()
	router.ServeHTTP(w2, req2)
	if w2.Code != http.StatusCreated {
		t.Fatalf("expected 201 Created, got %d: %s", w2.Code, w2.Body.String())
	}

	// 3. Verify audit log was recorded
	req3 := httptest.NewRequest(http.MethodGet, "/api/v1/audit-logs", nil)
	w3 := httptest.NewRecorder()
	router.ServeHTTP(w3, req3)

	if w3.Code != http.StatusOK {
		t.Fatalf("expected 200 OK, got %d", w3.Code)
	}

	var updatedLogs []AuditLogResponse
	if err := json.Unmarshal(w3.Body.Bytes(), &updatedLogs); err != nil {
		t.Fatalf("failed to decode json: %v", err)
	}
	if len(updatedLogs) != 1 {
		t.Fatalf("expected 1 audit log, got %d", len(updatedLogs))
	}

	if updatedLogs[0].Action != "create_project" {
		t.Errorf("expected action 'create_project', got %s", updatedLogs[0].Action)
	}
	if updatedLogs[0].TargetType != "project" {
		t.Errorf("expected targetType 'project', got %s", updatedLogs[0].TargetType)
	}
	if updatedLogs[0].TargetName != "Test App Project" {
		t.Errorf("expected targetName 'Test App Project', got %s", updatedLogs[0].TargetName)
	}
}
