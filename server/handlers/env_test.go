package handlers

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"gettako.dev/tako/internal/models"
	"gettako.dev/tako/server/audit"
	"gettako.dev/tako/server/auth"
)

func TestGetServiceEnv_MaskingAndReveal(t *testing.T) {
	database, r, adminCookie := setupTestRouter(t)

	auditMgr := audit.NewManager(database)
	audit.SetDefaultManager(auditMgr)

	// 1. Create a service
	svcBody := `{"name":"env-test-svc","project_id":"proj_alpha","server_id":"srv_alpha","service_type":"app","repository":"https://github.com/test/repo.git","branch":"main","dockerfile_path":"Dockerfile","internal_port":8080}`
	// Insert project and server first
	_, _ = database.Exec(`INSERT INTO projects (id, name) VALUES ('proj_alpha', 'Proj')`)
	_, _ = database.Exec(`INSERT INTO servers (id, name, host) VALUES ('srv_alpha', 'Server', '127.0.0.1')`)
	_, _ = database.Exec(`INSERT INTO services (id, project_id, server_id, name, service_type, repository, branch, dockerfile_path, internal_port, status) VALUES ('svc_env_test', 'proj_alpha', 'srv_alpha', 'env-test-svc', 'app', 'https://github.com/test/repo.git', 'main', 'Dockerfile', 8080, 'stopped')`)
	_ = svcBody

	// 2. Put secret env vars
	updateBody, _ := json.Marshal(models.UpdateServiceEnvRequest{
		EnvVars: []models.EnvVar{
			{Key: "PUBLIC_KEY", Value: "public_value_123", IsSecret: false},
			{Key: "STRIPE_SECRET_KEY", Value: "sk_live_secret_456", IsSecret: true},
		},
		BuildArgs: []models.EnvVar{
			{Key: "SECRET_BUILD_ARG", Value: "top_secret_arg_789", IsSecret: true},
		},
	})
	req := httptest.NewRequest(http.MethodPut, "/api/services/svc_env_test/env", bytes.NewReader(updateBody))
	req.Header.Set("Content-Type", "application/json")
	req.AddCookie(adminCookie)
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200 OK updating env vars, got %d: %s", rec.Code, rec.Body.String())
	}

	// 3. Create member user and obtain member cookie
	inviteBody, _ := json.Marshal(CreateInviteRequest{Role: "member"})
	req = httptest.NewRequest(http.MethodPost, "/api/invites", bytes.NewReader(inviteBody))
	req.Header.Set("Content-Type", "application/json")
	req.AddCookie(adminCookie)
	rec = httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	var inviteResp CreateInviteResponse
	_ = json.NewDecoder(rec.Body).Decode(&inviteResp)

	acceptBody, _ := json.Marshal(AcceptInviteRequest{
		Token:    inviteResp.Token,
		Name:     "Member User",
		Email:    "member.env@gettako.dev",
		Password: "Password123!",
	})
	req = httptest.NewRequest(http.MethodPost, "/api/invites/accept", bytes.NewReader(acceptBody))
	req.Header.Set("Content-Type", "application/json")
	rec = httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	var memberCookie *http.Cookie
	for _, c := range rec.Result().Cookies() {
		if c.Name == auth.SessionCookieName {
			memberCookie = c
			break
		}
	}
	if memberCookie == nil {
		t.Fatal("expected member session cookie")
	}

	// 4. Default query by member: secrets must be masked
	req = httptest.NewRequest(http.MethodGet, "/api/services/svc_env_test/env", nil)
	req.AddCookie(memberCookie)
	rec = httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200 OK, got %d", rec.Code)
	}

	var envResp models.ServiceEnv
	_ = json.NewDecoder(rec.Body).Decode(&envResp)

	for _, v := range envResp.EnvVars {
		if v.Key == "PUBLIC_KEY" && v.Value != "public_value_123" {
			t.Errorf("expected public env var to be readable, got %s", v.Value)
		}
		if v.Key == "STRIPE_SECRET_KEY" && v.Value != "••••••••" {
			t.Errorf("expected secret env var to be masked by default, got %s", v.Value)
		}
	}
	for _, b := range envResp.BuildArgs {
		if b.Key == "SECRET_BUILD_ARG" && b.Value != "••••••••" {
			t.Errorf("expected secret build arg to be masked by default, got %s", b.Value)
		}
	}

	// 5. Query with ?reveal=true by member: must return 403 Forbidden
	req = httptest.NewRequest(http.MethodGet, "/api/services/svc_env_test/env?reveal=true", nil)
	req.AddCookie(memberCookie)
	rec = httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	if rec.Code != http.StatusForbidden {
		t.Fatalf("expected 403 Forbidden when member requests ?reveal=true, got %d: %s", rec.Code, rec.Body.String())
	}

	// 6. Query with ?reveal=true by admin: returns plaintext and creates audit log
	req = httptest.NewRequest(http.MethodGet, "/api/services/svc_env_test/env?reveal=true", nil)
	req.AddCookie(adminCookie)
	rec = httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200 OK when admin requests ?reveal=true, got %d: %s", rec.Code, rec.Body.String())
	}

	var adminEnvResp models.ServiceEnv
	_ = json.NewDecoder(rec.Body).Decode(&adminEnvResp)

	for _, v := range adminEnvResp.EnvVars {
		if v.Key == "STRIPE_SECRET_KEY" && v.Value != "sk_live_secret_456" {
			t.Errorf("expected admin reveal to show plaintext secret, got %s", v.Value)
		}
	}

	// Verify audit log entry was recorded (written in async goroutine)
	var auditCount int
	for i := 0; i < 20; i++ {
		err := database.QueryRow(`SELECT count(*) FROM audit_log WHERE action = 'service.env_reveal' AND resource_id = 'svc_env_test'`).Scan(&auditCount)
		if err == nil && auditCount == 1 {
			break
		}
		time.Sleep(20 * time.Millisecond)
	}
	if auditCount != 1 {
		t.Errorf("expected 1 audit log entry for env_reveal, got %d", auditCount)
	}
}
