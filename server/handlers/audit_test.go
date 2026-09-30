package handlers

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"
	"time"

	"github.com/go-chi/chi/v5"

	"gettako.dev/tako/internal/crypto"
	"gettako.dev/tako/internal/models"
	"gettako.dev/tako/server/audit"
	"gettako.dev/tako/server/auth"
	"gettako.dev/tako/server/db"
)

func TestAuditLogIntegration(t *testing.T) {
	tempDir := t.TempDir()
	dbPath := filepath.Join(tempDir, "audit_test.db")

	database, err := db.Open(dbPath)
	if err != nil {
		t.Fatalf("failed to open test db: %v", err)
	}
	database.SetMaxOpenConns(1)
	defer database.Close()

	auditMgr := audit.NewManager(database)
	audit.SetDefaultManager(auditMgr)

	masterKey := crypto.DeriveKey("test-secret-key-32-bytes-long!")
	authHandler, err := auth.NewHandler(database, "localhost")
	if err != nil {
		t.Fatalf("failed to create auth handler: %v", err)
	}

	crudHandler := NewHandler(database, masterKey, "localhost")
	crudHandler.SetAuditManager(auditMgr)

	r := chi.NewRouter()
	r.Use(audit.ClientIPMiddleware)
	r.Route("/api/auth", func(authRouter chi.Router) {
		authHandler.RegisterRoutes(authRouter)
	})
	r.Route("/api", func(apiRouter chi.Router) {
		crudHandler.RegisterRoutes(apiRouter)
	})

	// Login
	loginBody, _ := json.Marshal(auth.LoginRequest{Password: "AdminPassword123!"})
	loginReq := httptest.NewRequest(http.MethodPost, "/api/auth/login", bytes.NewReader(loginBody))
	loginReq.Header.Set("X-Forwarded-For", "198.51.100.42")
	loginRec := httptest.NewRecorder()
	r.ServeHTTP(loginRec, loginReq)

	var sessionCookie *http.Cookie
	for _, c := range loginRec.Result().Cookies() {
		if c.Name == auth.SessionCookieName {
			sessionCookie = c
			break
		}
	}
	if sessionCookie == nil {
		t.Fatalf("failed to obtain session cookie")
	}

	// 1. Create a project
	desc := "For testing audit logging"
	prjBody, _ := json.Marshal(models.CreateProjectRequest{
		Name:        "Audit Test Project",
		Description: &desc,
	})
	req := httptest.NewRequest(http.MethodPost, "/api/projects", bytes.NewReader(prjBody))
	req.AddCookie(sessionCookie)
	req.Header.Set("X-Forwarded-For", "198.51.100.42")
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	if rec.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d: %s", rec.Code, rec.Body.String())
	}
	var createdPrj models.Project
	_ = json.NewDecoder(rec.Body).Decode(&createdPrj)

	// 2. Create a server
	srvBody, _ := json.Marshal(models.CreateServerRequest{
		Name: "Worker-Audit",
	})
	req = httptest.NewRequest(http.MethodPost, "/api/servers", bytes.NewReader(srvBody))
	req.AddCookie(sessionCookie)
	req.Header.Set("X-Forwarded-For", "198.51.100.42")
	rec = httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	if rec.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d: %s", rec.Code, rec.Body.String())
	}
	var srvResp models.CreateServerResponse
	_ = json.NewDecoder(rec.Body).Decode(&srvResp)

	// 3. Create a service
	svcBody, _ := json.Marshal(models.CreateServiceRequest{
		ProjectID:       createdPrj.ID,
		ServerID:        srvResp.Server.ID,
		Name:            "audit-api",
		Repository:      "octopy/audit-api",
		Branch:          "main",
		DockerfilePath:  "Dockerfile",
		InternalPort:    8080,
		HealthCheckPath: "/healthz",
	})
	req = httptest.NewRequest(http.MethodPost, "/api/services", bytes.NewReader(svcBody))
	req.AddCookie(sessionCookie)
	req.Header.Set("X-Forwarded-For", "198.51.100.42")
	rec = httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	if rec.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d: %s", rec.Code, rec.Body.String())
	}
	var createdSvc models.Service
	_ = json.NewDecoder(rec.Body).Decode(&createdSvc)

	// 4. Update service env
	envBody, _ := json.Marshal(models.UpdateServiceEnvRequest{
		EnvVars: []models.EnvVar{
			{Key: "DB_HOST", Value: "localhost", IsSecret: false},
			{Key: "DB_PASS", Value: "supersecret", IsSecret: true},
		},
		BuildArgs: []models.EnvVar{
			{Key: "VERSION", Value: "1.0.0", IsSecret: false},
		},
	})
	req = httptest.NewRequest(http.MethodPut, "/api/services/"+createdSvc.ID+"/env", bytes.NewReader(envBody))
	req.AddCookie(sessionCookie)
	req.Header.Set("X-Forwarded-For", "198.51.100.42")
	rec = httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}

	defer audit.SetDefaultManager(nil)

	// Wait for asynchronous fire-and-forget inserts to complete
	var listResp audit.ListResponse
	for i := 0; i < 20; i++ {
		time.Sleep(50 * time.Millisecond)
		req = httptest.NewRequest(http.MethodGet, "/api/audit-log?limit=10", nil)
		req.AddCookie(sessionCookie)
		rec = httptest.NewRecorder()
		r.ServeHTTP(rec, req)

		if rec.Code == http.StatusOK {
			listResp = audit.ListResponse{}
			_ = json.NewDecoder(rec.Body).Decode(&listResp)
			if len(listResp.Items) >= 4 && listResp.Items[0].Action == "env.update" {
				break
			}
		}
	}

	for _, it := range listResp.Items {
		t.Logf("item: action=%s, id=%s, created_at=%s", it.Action, it.ID, it.CreatedAt)
	}

	var envUpdateItem *audit.Entry
	for _, it := range listResp.Items {
		if it.Action == "env.update" {
			itemCopy := it
			envUpdateItem = &itemCopy
			break
		}
	}
	if envUpdateItem == nil {
		t.Fatalf("expected to find audit item with action 'env.update'")
	}

	// Check metadata of env.update contains counts and NO secrets
	if envUpdateItem.Metadata == nil {
		t.Fatalf("expected metadata for env.update")
	}
	var metaMap map[string]int
	if err := json.Unmarshal([]byte(*envUpdateItem.Metadata), &metaMap); err != nil {
		t.Fatalf("failed to unmarshal metadata: %v", err)
	}
	if metaMap["env_vars_count"] != 2 || metaMap["build_args_count"] != 1 {
		t.Errorf("expected counts 2 and 1, got %v", metaMap)
	}

	// Check IP address was captured
	if envUpdateItem.IPAddress == nil || *envUpdateItem.IPAddress != "198.51.100.42" {
		t.Errorf("expected IP '198.51.100.42', got %v", envUpdateItem.IPAddress)
	}

	// Test pagination with limit=2
	req = httptest.NewRequest(http.MethodGet, "/api/audit-log?limit=2", nil)
	req.AddCookie(sessionCookie)
	rec = httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	var page1 audit.ListResponse
	_ = json.NewDecoder(rec.Body).Decode(&page1)
	if len(page1.Items) != 2 {
		t.Fatalf("expected 2 items on page 1, got %d", len(page1.Items))
	}
	if page1.NextCursor == nil {
		t.Fatalf("expected page1 to have next_cursor")
	}

	// Fetch page 2
	req = httptest.NewRequest(http.MethodGet, "/api/audit-log?limit=2&before="+*page1.NextCursor, nil)
	req.AddCookie(sessionCookie)
	rec = httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	var page2 audit.ListResponse
	_ = json.NewDecoder(rec.Body).Decode(&page2)
	if len(page2.Items) != 2 {
		t.Fatalf("expected 2 items on page 2, got %d", len(page2.Items))
	}
}
