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
	"gettako.dev/tako/internal/store/db"
	takov1 "gettako.dev/tako/proto/gen/go/tako/v1"
	"github.com/go-chi/chi/v5"
)

type testRouterWrapper struct {
	chi.Router
	token string
}

func (tr *testRouterWrapper) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	if r.Header.Get("Authorization") == "" && r.Header.Get("Cookie") == "" && r.URL.Query().Get("token") == "" && r.Header.Get("X-No-Auth") != "true" {
		r.Header.Set("Authorization", "Bearer "+tr.token)
	}
	tr.Router.ServeHTTP(w, r)
}

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

	if err := store.SeedDefaultAdmin(context.Background(), database, "admin@gettako.dev", "secret123"); err != nil {
		t.Fatalf("SeedDefaultAdmin failed: %v", err)
	}

	bus := events.NewBus()
	orch := orchestrator.New(database, bus, "test-enroll")
	user, err := orch.Queries().GetUserByEmail(context.Background(), "admin@gettako.dev")
	if err != nil {
		t.Fatalf("GetAdminUser failed: %v", err)
	}
	token := "test-admin-token-" + user.ID
	orch.RegisterUserSession(token, user)

	router := api.NewRouter(database, orch)

	return &testRouterWrapper{
		Router: router.(chi.Router),
		token:  token,
	}, orch
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

func TestAuthSecurityAndRBAC(t *testing.T) {
	tmpDir := t.TempDir()
	dbPath := filepath.Join(tmpDir, "rbac_test.db")

	database, err := store.OpenDB(dbPath)
	if err != nil {
		t.Fatalf("OpenDB failed: %v", err)
	}
	defer database.Close()

	if err := store.Migrate(database); err != nil {
		t.Fatalf("Migrate failed: %v", err)
	}

	bus := events.NewBus()
	orch := orchestrator.New(database, bus, "test-enroll")
	// Naked router - raw production router without test wrapper!
	rawRouter := api.NewRouter(database, orch)

	// 1. Verify Public endpoints work unauthenticated
	t.Run("Public Endpoints Allow Unauthenticated Access", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/health", nil)
		rec := httptest.NewRecorder()
		rawRouter.ServeHTTP(rec, req)
		if rec.Code != http.StatusOK {
			t.Errorf("expected 200 for /health, got %d", rec.Code)
		}

		reqPing := httptest.NewRequest(http.MethodGet, "/api/v1/ping", nil)
		recPing := httptest.NewRecorder()
		rawRouter.ServeHTTP(recPing, reqPing)
		if recPing.Code != http.StatusOK {
			t.Errorf("expected 200 for /api/v1/ping, got %d", recPing.Code)
		}
	})

	// 2. Verify Protected endpoints reject unauthenticated access with 401
	t.Run("Protected Endpoints Reject Unauthenticated Access with 401", func(t *testing.T) {
		protectedEndpoints := []struct {
			method string
			path   string
		}{
			{http.MethodGet, "/api/v1/nodes"},
			{http.MethodGet, "/api/v1/services"},
			{http.MethodGet, "/api/v1/projects"},
			{http.MethodGet, "/api/v1/audit-logs"},
			{http.MethodGet, "/api/v1/settings"},
			{http.MethodGet, "/api/v1/backups/snapshots"},
			{http.MethodGet, "/api/v1/system/version"},
			{http.MethodGet, "/api/v1/ingress/traefik/access-logs"},
		}

		for _, ep := range protectedEndpoints {
			req := httptest.NewRequest(ep.method, ep.path, nil)
			rec := httptest.NewRecorder()
			rawRouter.ServeHTTP(rec, req)
			if rec.Code != http.StatusUnauthorized {
				t.Errorf("expected 401 Unauthorized for unauthenticated %s %s, got %d", ep.method, ep.path, rec.Code)
			}
		}
	})

	// 3. Create Admin and Member users
	adminUser, err := orch.Queries().CreateUser(context.Background(), db.CreateUserParams{
		ID:           "user-admin-1",
		Name:         "Cluster Admin",
		Email:        "admin@corp.internal",
		PasswordHash: "hashed",
		Role:         "admin",
	})
	if err != nil {
		t.Fatalf("failed to create admin: %v", err)
	}
	adminToken := "tok-admin-12345"
	orch.RegisterUserSession(adminToken, adminUser)

	memberUser, err := orch.Queries().CreateUser(context.Background(), db.CreateUserParams{
		ID:           "user-member-1",
		Name:         "Team Member",
		Email:        "member@corp.internal",
		PasswordHash: "hashed",
		Role:         "member",
	})
	if err != nil {
		t.Fatalf("failed to create member: %v", err)
	}
	memberToken := "tok-member-12345"
	orch.RegisterUserSession(memberToken, memberUser)

	// 4. Verify Member can read but CANNOT perform admin actions (403 Forbidden)
	t.Run("Member Role Enforces 403 on Admin Operations", func(t *testing.T) {
		// Member can read nodes (200 OK)
		reqRead := httptest.NewRequest(http.MethodGet, "/api/v1/nodes", nil)
		reqRead.Header.Set("Authorization", "Bearer "+memberToken)
		recRead := httptest.NewRecorder()
		rawRouter.ServeHTTP(recRead, reqRead)
		if recRead.Code != http.StatusOK {
			t.Errorf("expected 200 OK for member reading nodes, got %d", recRead.Code)
		}

		// Member is forbidden from admin operations (403 Forbidden)
		adminEndpoints := []struct {
			method string
			path   string
		}{
			{http.MethodPost, "/api/v1/nodes/enroll-token"},
			{http.MethodPost, "/api/v1/nodes/node-test/reboot"},
			{http.MethodPost, "/api/v1/system/update"},
			{http.MethodPost, "/api/v1/backups/snapshot"},
			{http.MethodPost, "/api/v1/backups/restore"},
		}

		for _, ep := range adminEndpoints {
			req := httptest.NewRequest(ep.method, ep.path, nil)
			req.Header.Set("Authorization", "Bearer "+memberToken)
			rec := httptest.NewRecorder()
			rawRouter.ServeHTTP(rec, req)
			if rec.Code != http.StatusForbidden {
				t.Errorf("expected 403 Forbidden for member on %s %s, got %d", ep.method, ep.path, rec.Code)
			}
		}
	})

	// 5. Verify Admin CAN perform admin actions
	t.Run("Admin Role Allows Privileged Operations", func(t *testing.T) {
		reqEnroll := httptest.NewRequest(http.MethodPost, "/api/v1/nodes/enroll-token", nil)
		reqEnroll.Header.Set("Authorization", "Bearer "+adminToken)
		recEnroll := httptest.NewRecorder()
		rawRouter.ServeHTTP(recEnroll, reqEnroll)
		if recEnroll.Code != http.StatusOK {
			t.Errorf("expected 200 OK for admin on /enroll-token, got %d", recEnroll.Code)
		}
	})
}
