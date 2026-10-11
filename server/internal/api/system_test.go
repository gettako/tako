package api_test

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"gettako.dev/tako/internal/api"
	"gettako.dev/tako/internal/events"
	"gettako.dev/tako/internal/orchestrator"
	"gettako.dev/tako/internal/store"
	takov1 "gettako.dev/tako/proto/gen/go/tako/v1"
)

func setupSystemTestRouter(t *testing.T) (http.Handler, *orchestrator.Orchestrator, *sql.DB) {
	database, err := store.OpenDB(":memory:")
	if err != nil {
		t.Fatalf("OpenDB failed: %v", err)
	}

	if err := store.Migrate(database); err != nil {
		t.Fatalf("Migrate failed: %v", err)
	}

	bus := events.NewBus()
	orch := orchestrator.New(database, bus, "test-master-token")
	router := api.NewRouter(database, orch)

	return router, orch, database
}

func TestSystemVersionEndpoint(t *testing.T) {
	router, _, database := setupSystemTestRouter(t)
	defer database.Close()

	req := httptest.NewRequest(http.MethodGet, "/api/v1/system/version", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200 OK, got %d: %s", w.Code, w.Body.String())
	}

	var resp api.SystemVersionResponse
	if err := json.NewDecoder(w.Body).Decode(&resp); err != nil {
		t.Fatalf("failed to decode version response: %v", err)
	}

	if resp.CurrentVersion == "" {
		t.Errorf("expected non-empty current version")
	}
	if resp.CheckedAt == "" {
		t.Errorf("expected non-empty checkedAt")
	}
}

func TestSystemUpdateEndpoint(t *testing.T) {
	router, orch, database := setupSystemTestRouter(t)
	defer database.Close()

	ctx := context.Background()

	// Register a mock node
	_, err := orch.RegisterNode(ctx, &takov1.RegisterNodeRequest{
		NodeId:      "node-worker-upd",
		Name:        "Worker Update Test",
		IpAddress:   "10.0.0.9",
		EnrollToken: "test-master-token",
	})
	if err != nil {
		t.Fatalf("RegisterNode failed: %v", err)
	}

	// Trigger system update
	body, _ := json.Marshal(api.SystemUpdateRequest{
		Target: "all",
	})
	req := httptest.NewRequest(http.MethodPost, "/api/v1/system/update", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200 OK, got %d: %s", w.Code, w.Body.String())
	}

	var resp api.SystemUpdateResponse
	if err := json.NewDecoder(w.Body).Decode(&resp); err != nil {
		t.Fatalf("failed to decode update response: %v", err)
	}

	if !resp.Success {
		t.Errorf("expected success=true")
	}
	if len(resp.UpdatedComponents) == 0 {
		t.Errorf("expected updated components listed")
	}
}

func TestNodeAgentUpdateEndpoint(t *testing.T) {
	router, orch, database := setupSystemTestRouter(t)
	defer database.Close()

	ctx := context.Background()

	// Register a mock node
	_, err := orch.RegisterNode(ctx, &takov1.RegisterNodeRequest{
		NodeId:      "node-single-upd",
		Name:        "Single Worker",
		IpAddress:   "10.0.0.10",
		EnrollToken: "test-master-token",
	})
	if err != nil {
		t.Fatalf("RegisterNode failed: %v", err)
	}

	req := httptest.NewRequest(http.MethodPost, "/api/v1/nodes/node-single-upd/update", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	// Since agent session is offline in unit test, 202 StatusAccepted or 200 OK is returned
	if w.Code != http.StatusOK && w.Code != http.StatusAccepted {
		t.Fatalf("expected 200 or 202, got %d: %s", w.Code, w.Body.String())
	}
}
