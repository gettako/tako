package tests

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-webauthn/webauthn/webauthn"
	"github.com/pb33f/libopenapi"
	validator "github.com/pb33f/libopenapi-validator"
	"google.golang.org/grpc/metadata"

	"gettako.dev/tako/server/auth"
	"gettako.dev/tako/server/db"
	"gettako.dev/tako/server/deploy"
	"gettako.dev/tako/server/github"
	"gettako.dev/tako/server/handlers"
	"gettako.dev/tako/server/nodes"
	"gettako.dev/tako/internal/crypto"
	"gettako.dev/tako/internal/models"
	"gettako.dev/tako/internal/protocol"
)

type mockNodeStream struct {
	ctx context.Context
	nm  *nodes.NodeManager
}

func (m *mockNodeStream) SetHeader(metadata.MD) error  { return nil }
func (m *mockNodeStream) SendHeader(metadata.MD) error { return nil }
func (m *mockNodeStream) SetTrailer(metadata.MD)       {}
func (m *mockNodeStream) Context() context.Context     { return m.ctx }
func (m *mockNodeStream) SendMsg(v any) error          { return nil }
func (m *mockNodeStream) RecvMsg(v any) error          { return nil }

func (m *mockNodeStream) Send(msg *protocol.ServerMessage) error {
	if m.nm == nil {
		return nil
	}
	if prune := msg.GetPruneCommand(); prune != nil {
		go m.nm.HandleTaskAck(&protocol.TaskAck{
			TaskId:         prune.GetTaskId(),
			Success:        true,
			ReclaimedBytes: 1024 * 1024 * 50,
		})
	}
	if restart := msg.GetTraefikRestartCommand(); restart != nil {
		go m.nm.HandleTaskAck(&protocol.TaskAck{
			TaskId:  restart.GetTaskId(),
			Success: true,
		})
	}
	if q := msg.GetTraefikConfigQuery(); q != nil {
		go m.nm.HandleTraefikConfigResponse(&protocol.TraefikConfigResponse{
			TaskId:     q.GetTaskId(),
			CustomYaml: "http:\n  routers: {}\n",
			StaticYaml: "api:\n  dashboard: true\n",
			Success:    true,
		})
	}
	if u := msg.GetTraefikConfigUpdate(); u != nil {
		go m.nm.HandleTraefikConfigResponse(&protocol.TraefikConfigResponse{
			TaskId:     u.GetTaskId(),
			CustomYaml: u.GetCustomYaml(),
			StaticYaml: "api:\n  dashboard: true\n",
			Success:    true,
		})
	}
	return nil
}

func (m *mockNodeStream) Recv() (*protocol.AgentMessage, error) {
	<-m.ctx.Done()
	return nil, m.ctx.Err()
}

type testContext struct {
	db           *sql.DB
	router       chi.Router
	cookie       *http.Cookie
	val          validator.Validator
	nodeMgr      *nodes.NodeManager
	orc          *deploy.Orchestrator
	ghClient     *github.Client
	projectID    string
	serverID     string
	serviceID    string
	deploymentID string
	domainName   string
}

func setupTestContext(t *testing.T) *testContext {
	specPath, err := filepath.Abs("../api/openapi.yaml")
	if err != nil {
		t.Fatalf("failed to get spec path: %v", err)
	}

	content, err := os.ReadFile(specPath)
	if err != nil {
		t.Fatalf("failed to read openapi.yaml: %v", err)
	}

	document, err := libopenapi.NewDocument(content)
	if err != nil {
		t.Fatalf("failed to parse openapi document: %v", err)
	}

	val, errs := validator.NewValidator(document)
	if len(errs) > 0 {
		t.Fatalf("failed to create validator: %v", errs[0])
	}

	tempDir := t.TempDir()
	dbPath := filepath.Join(tempDir, "contract_test.db")
	database, err := db.Open(dbPath)
	if err != nil {
		t.Fatalf("failed to open test db: %v", err)
	}
	t.Cleanup(func() { database.Close() })

	masterKey := crypto.DeriveKey("test-secret-key-32-bytes-long!")
	nodeMgr := nodes.NewNodeManager(database)
	orc := deploy.NewOrchestrator(database, nodeMgr, masterKey)

	authHandler, err := auth.NewHandler(database, "localhost")
	if err != nil {
		t.Fatalf("failed to create auth handler: %v", err)
	}

	apiHandler := handlers.NewHandler(database, masterKey, "localhost")
	apiHandler.SetNodeManager(nodeMgr)
	apiHandler.SetOrchestrator(orc)
	apiHandler.SetWebhookSecret("test-webhook-secret")

	// Mock GitHub HTTP API
	ghMux := http.NewServeMux()
	ghMux.HandleFunc("/user", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{
			"login":      "octocat",
			"avatar_url": "https://github.com/images/error/octocat_happy.gif",
		})
	})
	ghMux.HandleFunc("/user/repos", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode([]map[string]any{
			{
				"id":             1296269,
				"name":           "Hello-World",
				"full_name":      "octocat/Hello-World",
				"private":        false,
				"default_branch": "main",
				"html_url":       "https://github.com/octocat/Hello-World",
			},
		})
	})
	ghMux.HandleFunc("/repos/octocat/hello-world/branches", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode([]map[string]any{
			{
				"name": "main",
				"commit": map[string]any{
					"sha": "7fd1a60b01f91b314f59955a4e4d4e80d8edf11d",
				},
				"protected": true,
			},
		})
	})
	mockGH := httptest.NewServer(ghMux)
	t.Cleanup(mockGH.Close)

	ghClient, err := github.NewClient(github.ClientConfig{
		PAT:     "ghp_mock_token_for_contract_tests",
		BaseURL: mockGH.URL,
	})
	if err != nil {
		t.Fatalf("failed to create github client: %v", err)
	}
	apiHandler.SetGitHubClient(ghClient)

	r := chi.NewRouter()
	r.Get("/healthz", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"status":"ok"}`))
	})
	r.Get("/api/healthz", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"status":"ok"}`))
	})
	r.Route("/api/auth", func(authRouter chi.Router) {
		authHandler.RegisterRoutes(authRouter)
	})
	r.Route("/api", func(apiRouter chi.Router) {
		apiHandler.RegisterRoutes(apiRouter)
	})

	// Login
	loginBody, _ := json.Marshal(auth.LoginRequest{Password: "AdminPassword123!"})
	loginReq := httptest.NewRequest(http.MethodPost, "/api/auth/login", bytes.NewReader(loginBody))
	loginReq.Header.Set("Content-Type", "application/json")
	loginRec := httptest.NewRecorder()
	r.ServeHTTP(loginRec, loginReq)

	var sessionCookie *http.Cookie
	for _, c := range loginRec.Result().Cookies() {
		if c.Name == "tako_session" {
			sessionCookie = c
			break
		}
	}
	if sessionCookie == nil {
		t.Fatalf("failed to get tako_session cookie: %d, body: %s", loginRec.Code, loginRec.Body.String())
	}

	// Seed test entities
	projectID := "prj_test_1"
	_, err = database.Exec(`
		INSERT INTO projects (id, name, description, created_at, updated_at)
		VALUES (?, 'Test Project', 'Test project description', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
	`, projectID)
	if err != nil {
		t.Fatalf("failed to seed project: %v", err)
	}

	serverID := "srv_test_1"
	_, err = database.Exec(`
		INSERT INTO servers (id, name, host, status, agent_version, cpu_percent, ram_percent, disk_percent, last_heartbeat_at, created_at, updated_at)
		VALUES (?, 'Primary Server', '127.0.0.1', 'online', 'v1.0.0', 15.5, 30.0, 45.0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
	`, serverID)
	if err != nil {
		t.Fatalf("failed to seed server: %v", err)
	}

	// Attach mock agent stream for serverID
	mockStream := &mockNodeStream{ctx: context.Background(), nm: nodeMgr}
	_, err = nodeMgr.RegisterSession(context.Background(), serverID, mockStream)
	if err != nil {
		t.Fatalf("failed to register mock node session: %v", err)
	}
	_ = nodeMgr.RecordHeartbeat(context.Background(), serverID, &protocol.Heartbeat{
		CpuPercent:    15.5,
		RamPercent:    30.0,
		DiskPercent:   45.0,
		UptimeSeconds: 86400,
	})

	serviceID := "svc_test_1"
	_, err = database.Exec(`
		INSERT INTO services (id, project_id, server_id, name, repository, branch, dockerfile_path, internal_port, health_check_path, status, created_at, updated_at)
		VALUES (?, ?, ?, 'Test Service', 'https://github.com/gettako/sample-app', 'main', 'Dockerfile', 3000, '/healthz', 'running', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
	`, serviceID, projectID, serverID)
	if err != nil {
		t.Fatalf("failed to seed service: %v", err)
	}

	deploymentID := "dep_test_1"
	_, err = database.Exec(`
		INSERT INTO deployments (id, service_id, status, branch, commit_sha, commit_message, commit_author, created_at)
		VALUES (?, ?, 'building', 'main', '7a21ac2', 'Initial commit', 'Octocat', CURRENT_TIMESTAMP)
	`, deploymentID, serviceID)
	if err != nil {
		t.Fatalf("failed to seed deployment: %v", err)
	}

	domainName := "api.example.com"
	_, err = database.Exec(`
		INSERT INTO domains (id, service_id, domain, port, ssl_status, created_at)
		VALUES ('dom_test_1', ?, ?, 3000, 'active', CURRENT_TIMESTAMP)
	`, serviceID, domainName)
	if err != nil {
		t.Fatalf("failed to seed domain: %v", err)
	}

	// Seed passkey credential for passkey login tests
	cred := webauthn.Credential{
		ID:              []byte("test_credential_id"),
		PublicKey:       []byte("test_public_key"),
		AttestationType: "none",
	}
	credBlob, _ := json.Marshal(cred)
	_, _ = database.Exec(`
		INSERT INTO passkeys (id, user_id, name, credential, created_at)
		VALUES ('pk_test_1', 'usr_admin', 'Test Key', ?, CURRENT_TIMESTAMP)
	`, credBlob)
	_, _ = database.Exec(`UPDATE users SET passkeys_enabled = 1 WHERE id = 'usr_admin'`)

	return &testContext{
		db:           database,
		router:       r,
		cookie:       sessionCookie,
		val:          val,
		nodeMgr:      nodeMgr,
		orc:          orc,
		ghClient:     ghClient,
		projectID:    projectID,
		serverID:     serverID,
		serviceID:    serviceID,
		deploymentID: deploymentID,
		domainName:   domainName,
	}
}

func assertValidate(t *testing.T, tc *testContext, req *http.Request, rec *httptest.ResponseRecorder, expectedStatus int) {
	t.Helper()
	res := rec.Result()
	if res.StatusCode != expectedStatus {
		t.Fatalf("%s %s expected status %d, got %d: %s", req.Method, req.URL.Path, expectedStatus, res.StatusCode, rec.Body.String())
	}

	ok, errs := tc.val.ValidateHttpResponse(req, res)
	if !ok {
		for _, e := range errs {
			t.Errorf("contract validation error for %s %s (status %d): %v", req.Method, req.URL.Path, res.StatusCode, e)
		}
	}
}

func TestCompleteOpenAPIContract(t *testing.T) {
	tc := setupTestContext(t)

	// 1. Healthz
	t.Run("GET /healthz", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/healthz", nil)
		rec := httptest.NewRecorder()
		tc.router.ServeHTTP(rec, req)
		if rec.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d", rec.Code)
		}
	})

	t.Run("GET /api/healthz", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/api/healthz", nil)
		rec := httptest.NewRecorder()
		tc.router.ServeHTTP(rec, req)
		if rec.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d", rec.Code)
		}
	})

	// 2. Auth Endpoints
	t.Run("POST /api/auth/login", func(t *testing.T) {
		body, _ := json.Marshal(auth.LoginRequest{Password: "AdminPassword123!"})
		req := httptest.NewRequest(http.MethodPost, "/api/auth/login", bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		rec := httptest.NewRecorder()
		tc.router.ServeHTTP(rec, req)
		assertValidate(t, tc, req, rec, http.StatusOK)
	})

	t.Run("GET /api/auth/me", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/api/auth/me", nil)
		req.AddCookie(tc.cookie)
		rec := httptest.NewRecorder()
		tc.router.ServeHTTP(rec, req)
		assertValidate(t, tc, req, rec, http.StatusOK)
	})

	t.Run("PATCH /api/auth/profile", func(t *testing.T) {
		name := "Lead Admin"
		email := "admin@example.com"
		body, _ := json.Marshal(auth.UpdateProfileRequest{
			Name:  &name,
			Email: email,
		})
		req := httptest.NewRequest(http.MethodPatch, "/api/auth/profile", bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		req.AddCookie(tc.cookie)
		rec := httptest.NewRecorder()
		tc.router.ServeHTTP(rec, req)
		assertValidate(t, tc, req, rec, http.StatusOK)
	})

	t.Run("POST /api/auth/change-password", func(t *testing.T) {
		body, _ := json.Marshal(auth.ChangePasswordRequest{
			CurrentPassword: "AdminPassword123!",
			NewPassword:     "NewAdminPassword123!",
		})
		req := httptest.NewRequest(http.MethodPost, "/api/auth/change-password", bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		req.AddCookie(tc.cookie)
		rec := httptest.NewRecorder()
		tc.router.ServeHTTP(rec, req)
		assertValidate(t, tc, req, rec, http.StatusOK)

		// Reset password back
		resetBody, _ := json.Marshal(auth.ChangePasswordRequest{
			CurrentPassword: "NewAdminPassword123!",
			NewPassword:     "AdminPassword123!",
		})
		resetReq := httptest.NewRequest(http.MethodPost, "/api/auth/change-password", bytes.NewReader(resetBody))
		resetReq.Header.Set("Content-Type", "application/json")
		resetReq.AddCookie(tc.cookie)
		resetRec := httptest.NewRecorder()
		tc.router.ServeHTTP(resetRec, resetReq)
	})

	t.Run("POST /api/auth/2fa/setup", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodPost, "/api/auth/2fa/setup", nil)
		req.AddCookie(tc.cookie)
		rec := httptest.NewRecorder()
		tc.router.ServeHTTP(rec, req)
		assertValidate(t, tc, req, rec, http.StatusOK)
	})

	t.Run("POST /api/auth/passkey/register/begin", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodPost, "/api/auth/passkey/register/begin", nil)
		req.AddCookie(tc.cookie)
		rec := httptest.NewRecorder()
		tc.router.ServeHTTP(rec, req)
		assertValidate(t, tc, req, rec, http.StatusOK)
	})

	t.Run("POST /api/auth/passkey/login/begin", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodPost, "/api/auth/passkey/login/begin", nil)
		rec := httptest.NewRecorder()
		tc.router.ServeHTTP(rec, req)
		assertValidate(t, tc, req, rec, http.StatusOK)
	})

	// 3. Projects CRUD
	t.Run("POST /api/projects", func(t *testing.T) {
		desc := "Core backend services"
		body, _ := json.Marshal(models.CreateProjectRequest{
			Name:        "Production App",
			Description: &desc,
		})
		req := httptest.NewRequest(http.MethodPost, "/api/projects", bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		req.AddCookie(tc.cookie)
		rec := httptest.NewRecorder()
		tc.router.ServeHTTP(rec, req)
		assertValidate(t, tc, req, rec, http.StatusCreated)
	})

	t.Run("GET /api/projects", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/api/projects", nil)
		req.AddCookie(tc.cookie)
		rec := httptest.NewRecorder()
		tc.router.ServeHTTP(rec, req)
		assertValidate(t, tc, req, rec, http.StatusOK)
	})

	t.Run("GET /api/projects/{id}", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/api/projects/"+tc.projectID, nil)
		req.AddCookie(tc.cookie)
		rec := httptest.NewRecorder()
		tc.router.ServeHTTP(rec, req)
		assertValidate(t, tc, req, rec, http.StatusOK)
	})

	t.Run("PATCH /api/projects/{id}", func(t *testing.T) {
		newName := "Production App Updated"
		body, _ := json.Marshal(models.UpdateProjectRequest{
			Name: &newName,
		})
		req := httptest.NewRequest(http.MethodPatch, "/api/projects/"+tc.projectID, bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		req.AddCookie(tc.cookie)
		rec := httptest.NewRecorder()
		tc.router.ServeHTTP(rec, req)
		assertValidate(t, tc, req, rec, http.StatusOK)
	})

	// 4. Servers CRUD
	t.Run("POST /api/servers", func(t *testing.T) {
		body, _ := json.Marshal(models.CreateServerRequest{
			Name: "Worker-02",
		})
		req := httptest.NewRequest(http.MethodPost, "/api/servers", bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		req.AddCookie(tc.cookie)
		rec := httptest.NewRecorder()
		tc.router.ServeHTTP(rec, req)
		assertValidate(t, tc, req, rec, http.StatusCreated)
	})

	t.Run("GET /api/servers", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/api/servers", nil)
		req.AddCookie(tc.cookie)
		rec := httptest.NewRecorder()
		tc.router.ServeHTTP(rec, req)
		assertValidate(t, tc, req, rec, http.StatusOK)
	})

	t.Run("GET /api/servers/{id}", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/api/servers/"+tc.serverID, nil)
		req.AddCookie(tc.cookie)
		rec := httptest.NewRecorder()
		tc.router.ServeHTTP(rec, req)
		assertValidate(t, tc, req, rec, http.StatusOK)
	})

	t.Run("GET /api/servers/{id}/traefik/config", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/api/servers/"+tc.serverID+"/traefik/config", nil)
		req.AddCookie(tc.cookie)
		rec := httptest.NewRecorder()
		tc.router.ServeHTTP(rec, req)
		assertValidate(t, tc, req, rec, http.StatusOK)
	})

	t.Run("PUT /api/servers/{id}/traefik/config", func(t *testing.T) {
		body, _ := json.Marshal(models.UpdateTraefikConfigRequest{
			CustomYAML: "http:\n  routers:\n    test:\n      rule: Path(`/`)\n",
		})
		req := httptest.NewRequest(http.MethodPut, "/api/servers/"+tc.serverID+"/traefik/config", bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		req.AddCookie(tc.cookie)
		rec := httptest.NewRecorder()
		tc.router.ServeHTTP(rec, req)
		assertValidate(t, tc, req, rec, http.StatusOK)
	})

	t.Run("POST /api/servers/{id}/traefik/restart", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodPost, "/api/servers/"+tc.serverID+"/traefik/restart", nil)
		req.AddCookie(tc.cookie)
		rec := httptest.NewRecorder()
		tc.router.ServeHTTP(rec, req)
		assertValidate(t, tc, req, rec, http.StatusOK)
	})

	t.Run("POST /api/servers/{id}/prune", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodPost, "/api/servers/"+tc.serverID+"/prune", nil)
		req.AddCookie(tc.cookie)
		rec := httptest.NewRecorder()
		tc.router.ServeHTTP(rec, req)
		assertValidate(t, tc, req, rec, http.StatusOK)
	})

	// 5. Services CRUD & Actions
	var createdServiceID string
	t.Run("POST /api/services", func(t *testing.T) {
		port := 3000
		healthPath := "/healthz"
		body, _ := json.Marshal(models.CreateServiceRequest{
			ProjectID:       tc.projectID,
			ServerID:        tc.serverID,
			Name:            "Gateway Service",
			Repository:      "https://github.com/gettako/sample-app",
			Branch:          "main",
			DockerfilePath:  "Dockerfile",
			InternalPort:    port,
			HealthCheckPath: healthPath,
		})
		req := httptest.NewRequest(http.MethodPost, "/api/services", bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		req.AddCookie(tc.cookie)
		rec := httptest.NewRecorder()
		tc.router.ServeHTTP(rec, req)
		assertValidate(t, tc, req, rec, http.StatusCreated)

		var svc models.Service
		if err := json.Unmarshal(rec.Body.Bytes(), &svc); err == nil {
			createdServiceID = svc.ID
		}
	})

	t.Run("GET /api/services", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/api/services?project_id="+tc.projectID, nil)
		req.AddCookie(tc.cookie)
		rec := httptest.NewRecorder()
		tc.router.ServeHTTP(rec, req)
		assertValidate(t, tc, req, rec, http.StatusOK)
	})

	t.Run("GET /api/services/{id}", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/api/services/"+tc.serviceID, nil)
		req.AddCookie(tc.cookie)
		rec := httptest.NewRecorder()
		tc.router.ServeHTTP(rec, req)
		assertValidate(t, tc, req, rec, http.StatusOK)
	})

	t.Run("PATCH /api/services/{id}", func(t *testing.T) {
		newName := "Test Service Renamed"
		body, _ := json.Marshal(models.UpdateServiceRequest{
			Name: &newName,
		})
		req := httptest.NewRequest(http.MethodPatch, "/api/services/"+tc.serviceID, bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		req.AddCookie(tc.cookie)
		rec := httptest.NewRecorder()
		tc.router.ServeHTTP(rec, req)
		assertValidate(t, tc, req, rec, http.StatusOK)
	})

	t.Run("POST /api/services/{id}/start", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodPost, "/api/services/"+tc.serviceID+"/start", nil)
		req.AddCookie(tc.cookie)
		rec := httptest.NewRecorder()
		tc.router.ServeHTTP(rec, req)
		assertValidate(t, tc, req, rec, http.StatusOK)
	})

	t.Run("POST /api/services/{id}/stop", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodPost, "/api/services/"+tc.serviceID+"/stop", nil)
		req.AddCookie(tc.cookie)
		rec := httptest.NewRecorder()
		tc.router.ServeHTTP(rec, req)
		assertValidate(t, tc, req, rec, http.StatusOK)
	})

	t.Run("POST /api/services/{id}/restart", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodPost, "/api/services/"+tc.serviceID+"/restart", nil)
		req.AddCookie(tc.cookie)
		rec := httptest.NewRecorder()
		tc.router.ServeHTTP(rec, req)
		assertValidate(t, tc, req, rec, http.StatusOK)
	})

	t.Run("POST /api/services/{id}/rebuild", func(t *testing.T) {
		branch := "main"
		body, _ := json.Marshal(models.RebuildRequest{
			Branch: &branch,
		})
		req := httptest.NewRequest(http.MethodPost, "/api/services/"+tc.serviceID+"/rebuild", bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		req.AddCookie(tc.cookie)
		rec := httptest.NewRecorder()
		tc.router.ServeHTTP(rec, req)
		assertValidate(t, tc, req, rec, http.StatusAccepted)
	})

	// 6. Deployments
	t.Run("POST /api/services/{id}/deployments", func(t *testing.T) {
		branch := "main"
		body, _ := json.Marshal(models.CreateDeploymentRequest{
			Branch: &branch,
		})
		req := httptest.NewRequest(http.MethodPost, "/api/services/"+tc.serviceID+"/deployments", bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		req.AddCookie(tc.cookie)
		rec := httptest.NewRecorder()
		tc.router.ServeHTTP(rec, req)
		assertValidate(t, tc, req, rec, http.StatusAccepted)
	})

	t.Run("GET /api/services/{id}/deployments", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/api/services/"+tc.serviceID+"/deployments", nil)
		req.AddCookie(tc.cookie)
		rec := httptest.NewRecorder()
		tc.router.ServeHTTP(rec, req)
		assertValidate(t, tc, req, rec, http.StatusOK)
	})

	t.Run("GET /api/services/{id}/deployments/{deployment_id}", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/api/services/"+tc.serviceID+"/deployments/"+tc.deploymentID, nil)
		req.AddCookie(tc.cookie)
		rec := httptest.NewRecorder()
		tc.router.ServeHTTP(rec, req)
		assertValidate(t, tc, req, rec, http.StatusOK)
	})

	t.Run("POST /api/services/{id}/deployments/{deployment_id}/cancel", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodPost, "/api/services/"+tc.serviceID+"/deployments/"+tc.deploymentID+"/cancel", nil)
		req.AddCookie(tc.cookie)
		rec := httptest.NewRecorder()
		tc.router.ServeHTTP(rec, req)
		assertValidate(t, tc, req, rec, http.StatusOK)
	})

	t.Run("POST /api/services/{id}/deployments/{deployment_id}/rollback", func(t *testing.T) {
		// Set deployment status to success and add image_tag so rollback succeeds
		imgTag := "tako-app-sample:v1"
		_, _ = tc.db.Exec(`UPDATE deployments SET status = 'success', image_tag = ? WHERE id = ?`, imgTag, tc.deploymentID)

		req := httptest.NewRequest(http.MethodPost, "/api/services/"+tc.serviceID+"/deployments/"+tc.deploymentID+"/rollback", nil)
		req.AddCookie(tc.cookie)
		rec := httptest.NewRecorder()
		tc.router.ServeHTTP(rec, req)
		assertValidate(t, tc, req, rec, http.StatusAccepted)
	})

	// 7. Domains
	t.Run("POST /api/services/{id}/domains", func(t *testing.T) {
		port := 3000
		body, _ := json.Marshal(models.AddDomainRequest{
			Domain: "staging.example.com",
			Port:   &port,
		})
		req := httptest.NewRequest(http.MethodPost, "/api/services/"+tc.serviceID+"/domains", bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		req.AddCookie(tc.cookie)
		rec := httptest.NewRecorder()
		tc.router.ServeHTTP(rec, req)
		assertValidate(t, tc, req, rec, http.StatusCreated)
	})

	t.Run("GET /api/services/{id}/domains", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/api/services/"+tc.serviceID+"/domains", nil)
		req.AddCookie(tc.cookie)
		rec := httptest.NewRecorder()
		tc.router.ServeHTTP(rec, req)
		assertValidate(t, tc, req, rec, http.StatusOK)
	})

	t.Run("POST /api/services/{id}/domains/{domain}/check-ssl", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodPost, "/api/services/"+tc.serviceID+"/domains/"+tc.domainName+"/check-ssl", nil)
		req.AddCookie(tc.cookie)
		rec := httptest.NewRecorder()
		tc.router.ServeHTTP(rec, req)
		assertValidate(t, tc, req, rec, http.StatusOK)
	})

	t.Run("DELETE /api/services/{id}/domains/{domain}", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodDelete, "/api/services/"+tc.serviceID+"/domains/staging.example.com", nil)
		req.AddCookie(tc.cookie)
		rec := httptest.NewRecorder()
		tc.router.ServeHTTP(rec, req)
		assertValidate(t, tc, req, rec, http.StatusOK)
	})

	// 8. Environment Variables
	t.Run("GET /api/services/{id}/env", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/api/services/"+tc.serviceID+"/env", nil)
		req.AddCookie(tc.cookie)
		rec := httptest.NewRecorder()
		tc.router.ServeHTTP(rec, req)
		assertValidate(t, tc, req, rec, http.StatusOK)
	})

	t.Run("GET /api/services/{id}/env?reveal=true", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/api/services/"+tc.serviceID+"/env?reveal=true", nil)
		req.AddCookie(tc.cookie)
		rec := httptest.NewRecorder()
		tc.router.ServeHTTP(rec, req)
		assertValidate(t, tc, req, rec, http.StatusOK)
	})

	t.Run("PUT /api/services/{id}/env", func(t *testing.T) {
		body, _ := json.Marshal(models.UpdateServiceEnvRequest{
			EnvVars: []models.EnvVar{
				{Key: "NODE_ENV", Value: "production", IsSecret: false},
			},
			BuildArgs: []models.EnvVar{
				{Key: "APP_VERSION", Value: "1.0.0", IsSecret: false},
			},
		})
		req := httptest.NewRequest(http.MethodPut, "/api/services/"+tc.serviceID+"/env", bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		req.AddCookie(tc.cookie)
		rec := httptest.NewRecorder()
		tc.router.ServeHTTP(rec, req)
		assertValidate(t, tc, req, rec, http.StatusOK)
	})

	// 9. GitHub Endpoints
	t.Run("GET /api/github/status", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/api/github/status", nil)
		req.AddCookie(tc.cookie)
		rec := httptest.NewRecorder()
		tc.router.ServeHTTP(rec, req)
		assertValidate(t, tc, req, rec, http.StatusOK)
	})

	t.Run("GET /api/github/repos", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/api/github/repos", nil)
		req.AddCookie(tc.cookie)
		rec := httptest.NewRecorder()
		tc.router.ServeHTTP(rec, req)
		assertValidate(t, tc, req, rec, http.StatusOK)
	})

	t.Run("GET /api/github/repos/{owner}/{repo}/branches", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/api/github/repos/octocat/hello-world/branches", nil)
		req.AddCookie(tc.cookie)
		rec := httptest.NewRecorder()
		tc.router.ServeHTTP(rec, req)
		assertValidate(t, tc, req, rec, http.StatusOK)
	})

	t.Run("POST /api/github/webhook", func(t *testing.T) {
		payload := `{"ref":"refs/heads/main","repository":{"full_name":"gettako/sample-app","clone_url":"https://github.com/gettako/sample-app.git"},"head_commit":{"id":"abc1234","message":"test commit","author":{"name":"Octocat"}}}`
		mac := hmac.New(sha256.New, []byte("test-webhook-secret"))
		mac.Write([]byte(payload))
		sig := hex.EncodeToString(mac.Sum(nil))

		req := httptest.NewRequest(http.MethodPost, "/api/github/webhook", strings.NewReader(payload))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("X-GitHub-Event", "push")
		req.Header.Set("X-Hub-Signature-256", "sha256="+sig)
		rec := httptest.NewRecorder()
		tc.router.ServeHTTP(rec, req)
		assertValidate(t, tc, req, rec, http.StatusOK)
	})

	// 10. SSE Streams
	t.Run("GET /api/services/{id}/logs/build", func(t *testing.T) {
		tc.orc.BroadcastEvent(tc.deploymentID, &models.BuildLogStreamEvent{
			Event:     "build_step",
			Step:      "step_1",
			Title:     "Cloning repository",
			Status:    "success",
			Timestamp: time.Now().UTC().Format(time.RFC3339),
		})
		tc.orc.BroadcastEvent(tc.deploymentID, &models.BuildLogStreamEvent{
			Event:     "build_complete",
			Status:    "success",
			Timestamp: time.Now().UTC().Format(time.RFC3339),
		})

		req := httptest.NewRequest(http.MethodGet, "/api/services/"+tc.serviceID+"/logs/build?deployment_id="+tc.deploymentID, nil)
		req.AddCookie(tc.cookie)
		rec := httptest.NewRecorder()
		tc.router.ServeHTTP(rec, req)

		if rec.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d", rec.Code)
		}
		if !strings.Contains(rec.Header().Get("Content-Type"), "text/event-stream") {
			t.Errorf("expected Content-Type text/event-stream, got %s", rec.Header().Get("Content-Type"))
		}
	})

	t.Run("GET /api/services/{id}/logs/runtime (follow=false)", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/api/services/"+tc.serviceID+"/logs/runtime?tail=50&follow=false", nil)
		req.AddCookie(tc.cookie)
		rec := httptest.NewRecorder()
		tc.router.ServeHTTP(rec, req)

		if rec.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d", rec.Code)
		}
		if !strings.Contains(rec.Header().Get("Content-Type"), "text/event-stream") {
			t.Errorf("expected Content-Type text/event-stream, got %s", rec.Header().Get("Content-Type"))
		}
		if !strings.Contains(rec.Body.String(), "data:") {
			t.Errorf("expected body to contain SSE data chunks, got: %s", rec.Body.String())
		}
	})

	t.Run("GET /api/services/{id}/status", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/api/services/"+tc.serviceID+"/status", nil)
		ctx, cancel := context.WithTimeout(req.Context(), 50*time.Millisecond)
		defer cancel()
		req = req.WithContext(ctx)
		req.AddCookie(tc.cookie)
		rec := httptest.NewRecorder()
		tc.router.ServeHTTP(rec, req)

		if rec.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d", rec.Code)
		}
		if !strings.Contains(rec.Header().Get("Content-Type"), "text/event-stream") {
			t.Errorf("expected Content-Type text/event-stream, got %s", rec.Header().Get("Content-Type"))
		}
		if !strings.Contains(rec.Body.String(), "data:") {
			t.Errorf("expected body to contain SSE data chunks, got: %s", rec.Body.String())
		}
	})

	// 11. Cleanup Deletions
	t.Run("DELETE /api/services/{id}", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodDelete, "/api/services/"+tc.serviceID, nil)
		req.AddCookie(tc.cookie)
		rec := httptest.NewRecorder()
		tc.router.ServeHTTP(rec, req)
		assertValidate(t, tc, req, rec, http.StatusOK)

		if createdServiceID != "" {
			delReq := httptest.NewRequest(http.MethodDelete, "/api/services/"+createdServiceID, nil)
			delReq.AddCookie(tc.cookie)
			delRec := httptest.NewRecorder()
			tc.router.ServeHTTP(delRec, delReq)
		}
	})

	t.Run("DELETE /api/servers/{id}", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodDelete, "/api/servers/"+tc.serverID, nil)
		req.AddCookie(tc.cookie)
		rec := httptest.NewRecorder()
		tc.router.ServeHTTP(rec, req)
		assertValidate(t, tc, req, rec, http.StatusOK)
	})

	t.Run("DELETE /api/projects/{id}", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodDelete, "/api/projects/"+tc.projectID, nil)
		req.AddCookie(tc.cookie)
		rec := httptest.NewRecorder()
		tc.router.ServeHTTP(rec, req)
		assertValidate(t, tc, req, rec, http.StatusOK)
	})

	t.Run("POST /api/auth/logout", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodPost, "/api/auth/logout", nil)
		req.AddCookie(tc.cookie)
		rec := httptest.NewRecorder()
		tc.router.ServeHTTP(rec, req)
		assertValidate(t, tc, req, rec, http.StatusOK)
	})
}
