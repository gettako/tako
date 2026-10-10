package api_test

import (
	"bufio"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"gettako.dev/tako/internal/api"
	"gettako.dev/tako/internal/events"
	"gettako.dev/tako/internal/orchestrator"
	"gettako.dev/tako/internal/store"
	takov1 "gettako.dev/tako/proto/gen/go/tako/v1"
)

func setupTestRouter(t *testing.T) (http.Handler, *orchestrator.Orchestrator) {
	tmpDir := t.TempDir()
	dbPath := filepath.Join(tmpDir, "api_test.db")

	database, err := store.OpenDB(dbPath)
	if err != nil {
		t.Fatalf("OpenDB failed: %v", err)
	}
	t.Cleanup(func() { _ = database.Close() })

	if err := store.Migrate(database); err != nil {
		t.Fatalf("Migrate failed: %v", err)
	}

	bus := events.NewBus()
	orch := orchestrator.New(database, bus, "test-enroll")
	router := api.NewRouter(database, orch)

	return router, orch
}

func TestRouterEndpoints(t *testing.T) {
	router, orch := setupTestRouter(t)

	t.Run("GET /health", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/health", nil)
		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, req)

		if rec.Code != http.StatusOK {
			t.Errorf("expected 200 OK, got %d", rec.Code)
		}
	})

	t.Run("POST /api/v1/nodes/enroll-token", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodPost, "/api/v1/nodes/enroll-token", nil)
		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, req)

		if rec.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d", rec.Code)
		}

		var res map[string]string
		_ = json.NewDecoder(rec.Body).Decode(&res)
		if len(res["token"]) == 0 {
			t.Errorf("expected non-empty enrollment token, got empty")
		}
		if strings.HasPrefix(res["token"], "tako_") {
			t.Errorf("expected token without prefix, got %s", res["token"])
		}
	})

	t.Run("Node CRUD & Detail", func(t *testing.T) {
		// Register a node via orchestrator
		ctx := context.Background()
		_, err := orch.RegisterNode(ctx, &takov1.RegisterNodeRequest{
			NodeId:        "node-api-1",
			Name:          "API Worker 1",
			IpAddress:     "192.168.1.50",
			CpuTotalCores: 8,
			EnrollToken:   "test-enroll",
		})
		if err != nil {
			t.Fatalf("RegisterNode failed: %v", err)
		}

		// GET /api/v1/nodes
		req := httptest.NewRequest(http.MethodGet, "/api/v1/nodes", nil)
		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, req)

		if rec.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d", rec.Code)
		}

		var nodes []api.NodeResponse
		_ = json.NewDecoder(rec.Body).Decode(&nodes)
		if len(nodes) != 1 || nodes[0].ID != "node-api-1" {
			t.Fatalf("expected 1 node with id node-api-1, got %v", nodes)
		}

		// GET /api/v1/nodes/node-api-1
		req = httptest.NewRequest(http.MethodGet, "/api/v1/nodes/node-api-1", nil)
		rec = httptest.NewRecorder()
		router.ServeHTTP(rec, req)

		if rec.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d", rec.Code)
		}

		// DELETE /api/v1/nodes/node-api-1
		req = httptest.NewRequest(http.MethodDelete, "/api/v1/nodes/node-api-1", nil)
		rec = httptest.NewRecorder()
		router.ServeHTTP(rec, req)

		if rec.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d", rec.Code)
		}
	})

	t.Run("GET /api/v1/events/nodes (SSE stream)", func(t *testing.T) {
		server := httptest.NewServer(router)
		defer server.Close()

		ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
		defer cancel()

		req, err := http.NewRequestWithContext(ctx, http.MethodGet, server.URL+"/api/v1/events/nodes", nil)
		if err != nil {
			t.Fatalf("NewRequest failed: %v", err)
		}

		resp, err := http.DefaultClient.Do(req)
		if err != nil {
			t.Fatalf("Do failed: %v", err)
		}
		defer resp.Body.Close()

		if resp.StatusCode != http.StatusOK {
			t.Fatalf("expected 200 OK, got %d", resp.StatusCode)
		}

		reader := bufio.NewReader(resp.Body)
		line, err := reader.ReadString('\n')
		if err != nil {
			t.Fatalf("ReadString failed: %v", err)
		}

		if !strings.HasPrefix(line, "event: snapshot") {
			t.Errorf("expected initial event: snapshot, got %s", line)
		}
	})
}
