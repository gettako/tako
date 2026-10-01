package handlers

import (
	"bytes"
	"crypto/rand"
	"crypto/rsa"
	"crypto/x509"
	"encoding/json"
	"encoding/pem"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/go-chi/chi/v5"

	"gettako.dev/tako/internal/crypto"
	"gettako.dev/tako/internal/models"
	"gettako.dev/tako/server/github"
)

func TestGitHubConnections_CRUD_And_Guard(t *testing.T) {
	h, _, _, masterKey := setupTestDB(t)

	r := chi.NewRouter()
	r.Get("/api/github/connections", h.ListGitHubConnections)
	r.Post("/api/github/connections", h.CreateGitHubConnection)
	r.Delete("/api/github/connections/{id}", h.DeleteGitHubConnection)

	// 1. Create Connection 1 (PAT)
	createReq1 := models.CreateGitHubConnectionRequest{
		Name:     "Personal PAT",
		AuthType: "pat",
		Token: func() *string {
			s := "ghp_testtoken123"
			return &s
		}(),
		AccountName: func() *string {
			s := "alice-dev"
			return &s
		}(),
	}
	body1, _ := json.Marshal(createReq1)
	req := httptest.NewRequest(http.MethodPost, "/api/github/connections", bytes.NewReader(body1))
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	if rec.Code != http.StatusCreated {
		t.Fatalf("expected status 201, got %d: %s", rec.Code, rec.Body.String())
	}

	var conn1 models.GitHubConnection
	if err := json.NewDecoder(rec.Body).Decode(&conn1); err != nil {
		t.Fatalf("failed to decode created connection: %v", err)
	}

	if conn1.ID == "" || conn1.Name != "Personal PAT" || conn1.AccountName != "alice-dev" {
		t.Fatalf("unexpected connection details: %+v", conn1)
	}

	// Verify encryption in DB: token_enc must not contain plaintext
	var rawEnc []byte
	err := h.db.QueryRow(`SELECT token_enc FROM github_connections WHERE id = ?`, conn1.ID).Scan(&rawEnc)
	if err != nil {
		t.Fatalf("failed to query token_enc: %v", err)
	}
	if bytes.Contains(rawEnc, []byte("ghp_testtoken123")) {
		t.Fatalf("token_enc contains plaintext token!")
	}
	// Verify it decrypts cleanly
	if len(rawEnc) < 12 {
		t.Fatalf("token_enc too short: %d", len(rawEnc))
	}
	decrypted, err := crypto.Decrypt(rawEnc[12:], rawEnc[:12], masterKey)
	if err != nil {
		t.Fatalf("failed to decrypt token: %v", err)
	}
	if string(decrypted) != "ghp_testtoken123" {
		t.Fatalf("decrypted token mismatch: got %q, expected %q", string(decrypted), "ghp_testtoken123")
	}

	// 2. Create Connection 2 (GitHub App)
	createReq2 := models.CreateGitHubConnectionRequest{
		Name:     "Company Org App",
		AuthType: "app",
		AppID: func() *string {
			s := "app_12345"
			return &s
		}(),
		InstallationID: func() *string {
			s := "inst_67890"
			return &s
		}(),
		PrivateKey: func() *string {
			s := "-----BEGIN RSA PRIVATE KEY-----\nMIIEogIBAAKCAQEA0...\n-----END RSA PRIVATE KEY-----"
			return &s
		}(),
		AccountName: func() *string {
			s := "acme-org"
			return &s
		}(),
	}
	body2, _ := json.Marshal(createReq2)
	req = httptest.NewRequest(http.MethodPost, "/api/github/connections", bytes.NewReader(body2))
	rec = httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	if rec.Code != http.StatusCreated {
		t.Fatalf("expected status 201 for App connection, got %d: %s", rec.Code, rec.Body.String())
	}

	var conn2 models.GitHubConnection
	_ = json.NewDecoder(rec.Body).Decode(&conn2)

	// 3. List connections
	req = httptest.NewRequest(http.MethodGet, "/api/github/connections", nil)
	rec = httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", rec.Code)
	}
	var conns []models.GitHubConnection
	_ = json.NewDecoder(rec.Body).Decode(&conns)
	if len(conns) != 2 {
		t.Fatalf("expected 2 connections, got %d", len(conns))
	}

	// 4. Attach an active service to Connection 1
	_, err = h.db.Exec(`
		INSERT INTO servers (id, name, host, status, created_at, updated_at) VALUES ('srv1', 'Server 1', '127.0.0.1', 'online', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
		INSERT INTO projects (id, name, created_at, updated_at) VALUES ('p1', 'Test Project', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
	`)
	if err != nil {
		t.Fatalf("failed to insert server/project: %v", err)
	}
	_, err = h.db.Exec(`
		INSERT INTO services (
			id, project_id, server_id, name, repository, branch, dockerfile_path, internal_port, health_check_path, status,
			github_connection_id, created_at, updated_at
		) VALUES ('s1', 'p1', 'srv1', 'Production API', 'acme/api', 'main', 'Dockerfile', 8080, '/healthz', 'running', ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
	`, conn1.ID)
	if err != nil {
		t.Fatalf("failed to insert service: %v", err)
	}

	// 5. Attempt deleting Connection 1 -> Must be blocked with 409 Conflict
	req = httptest.NewRequest(http.MethodDelete, "/api/github/connections/"+conn1.ID, nil)
	rec = httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	if rec.Code != http.StatusConflict {
		t.Fatalf("expected 409 Conflict when deleting connection in use by active service, got %d: %s", rec.Code, rec.Body.String())
	}
	if !bytes.Contains(rec.Body.Bytes(), []byte("Production API")) {
		t.Fatalf("expected warning to mention active service name 'Production API', got: %s", rec.Body.String())
	}

	// 6. Delete Connection 2 (no services attached) -> Must succeed
	req = httptest.NewRequest(http.MethodDelete, "/api/github/connections/"+conn2.ID, nil)
	rec = httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200 OK deleting unused connection, got %d: %s", rec.Code, rec.Body.String())
	}

	// 7. Remove service, then delete Connection 1 -> Must succeed
	_, _ = h.db.Exec(`DELETE FROM services WHERE id = 's1'`)
	req = httptest.NewRequest(http.MethodDelete, "/api/github/connections/"+conn1.ID, nil)
	rec = httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200 OK deleting now-unused connection, got %d: %s", rec.Code, rec.Body.String())
	}
}

func TestGitHubConnections_ReposAndBranches(t *testing.T) {
	h, _, _, _ := setupTestDB(t)

	// Mock GitHub server
	mockServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		switch r.URL.Path {
		case "/user":
			_ = json.NewEncoder(w).Encode(map[string]any{
				"login":      "octocat",
				"avatar_url": "https://avatars.githubusercontent.com/u/583231",
			})
		case "/user/repos":
			_ = json.NewEncoder(w).Encode([]map[string]any{
				{
					"id":             101,
					"name":           "tako-web",
					"full_name":      "octocat/tako-web",
					"private":        false,
					"default_branch": "main",
					"html_url":       "https://github.com/octocat/tako-web",
				},
			})
		case "/repos/octocat/tako-web/branches":
			_ = json.NewEncoder(w).Encode([]map[string]any{
				{
					"name":      "main",
					"commit":    map[string]string{"sha": "abc12345"},
					"protected": true,
				},
				{
					"name":      "develop",
					"commit":    map[string]string{"sha": "def67890"},
					"protected": false,
				},
			})
		default:
			http.NotFound(w, r)
		}
	}))
	defer mockServer.Close()

	ghClient, _ := github.NewClient(github.ClientConfig{
		BaseURL:    mockServer.URL,
		HTTPClient: mockServer.Client(),
	})
	h.SetGitHubClient(ghClient)

	r := chi.NewRouter()
	r.Post("/api/github/connections", h.CreateGitHubConnection)
	r.Get("/api/github/connections/{id}/repos", h.ListConnectionRepos)
	r.Get("/api/github/connections/{id}/repos/{owner}/{repo}/branches", h.ListConnectionBranches)

	// Create connection with PAT
	createReq := models.CreateGitHubConnectionRequest{
		Name:     "Octocat GitHub",
		AuthType: "pat",
		Token: func() *string {
			s := "ghp_mock_token"
			return &s
		}(),
	}
	body, _ := json.Marshal(createReq)
	req := httptest.NewRequest(http.MethodPost, "/api/github/connections", bytes.NewReader(body))
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	if rec.Code != http.StatusCreated {
		t.Fatalf("failed creating connection: %d %s", rec.Code, rec.Body.String())
	}
	var conn models.GitHubConnection
	_ = json.NewDecoder(rec.Body).Decode(&conn)

	// Fetch repos for this connection
	req = httptest.NewRequest(http.MethodGet, "/api/github/connections/"+conn.ID+"/repos", nil)
	rec = httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200 listing repos, got %d: %s", rec.Code, rec.Body.String())
	}
	var repos []models.GitHubRepo
	_ = json.NewDecoder(rec.Body).Decode(&repos)
	if len(repos) != 1 || repos[0].Name != "tako-web" {
		t.Fatalf("unexpected repos returned: %+v", repos)
	}

	// Fetch branches for repo under this connection
	req = httptest.NewRequest(http.MethodGet, "/api/github/connections/"+conn.ID+"/repos/octocat/tako-web/branches", nil)
	rec = httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200 listing branches, got %d: %s", rec.Code, rec.Body.String())
	}
	var branches []models.GitHubBranch
	_ = json.NewDecoder(rec.Body).Decode(&branches)
	if len(branches) != 2 || branches[0].Name != "main" {
		t.Fatalf("unexpected branches returned: %+v", branches)
	}
}

func TestGitHubWebhook_MultiplexedByConnection(t *testing.T) {
	h, orc, _, masterKey := setupTestDB(t)
	h.SetOrchestrator(orc)

	r := chi.NewRouter()
	r.Post("/api/github/webhook/{connection_id}", h.HandleGitHubWebhookByConnection)

	secretA := "webhook-secret-conn-a"
	secretB := "webhook-secret-conn-b"
	whEncA := encryptWebhookSecret(t, secretA, masterKey)
	whEncB := encryptWebhookSecret(t, secretB, masterKey)

	_, err := h.db.Exec(`
		INSERT INTO servers (id, name, host, status, created_at, updated_at) VALUES ('srv1', 'Server 1', '127.0.0.1', 'online', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
		INSERT INTO projects (id, name, created_at, updated_at) VALUES ('p1', 'Proj', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
		INSERT INTO github_connections (id, name, auth_type, account_name, webhook_secret_enc, created_at, updated_at)
		VALUES ('ghc_conn_a', 'Conn A', 'pat', 'user-a', ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
		       ('ghc_conn_b', 'Conn B', 'pat', 'user-b', ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
	`, whEncA, whEncB)
	if err != nil {
		t.Fatalf("failed to insert server/project/connections: %v", err)
	}
	_, err = h.db.Exec(`
		INSERT INTO services (
			id, project_id, server_id, name, repository, branch, dockerfile_path, internal_port, health_check_path, status,
			auto_deploy, github_connection_id, created_at, updated_at
		) VALUES
		('s_conn_a', 'p1', 'srv1', 'App A', 'https://github.com/org/repo-shared.git', 'main', 'Dockerfile', 8080, '/healthz', 'stopped', 1, 'ghc_conn_a', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
		('s_conn_b', 'p1', 'srv1', 'App B', 'https://github.com/org/repo-shared.git', 'main', 'Dockerfile', 8080, '/healthz', 'stopped', 1, 'ghc_conn_b', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
	`)
	if err != nil {
		t.Fatalf("failed to insert services: %v", err)
	}

	payload := []byte(`{
		"ref": "refs/heads/main",
		"after": "deadbeef1234",
		"repository": {
			"name": "repo-shared",
			"full_name": "org/repo-shared",
			"clone_url": "https://github.com/org/repo-shared.git"
		},
		"head_commit": {
			"id": "deadbeef1234",
			"message": "feat: new feature",
			"author": { "name": "alice", "email": "alice@example.com" }
		}
	}`)

	// Webhook targeted to conn_a -> should match s_conn_a, NOT s_conn_b
	req := httptest.NewRequest(http.MethodPost, "/api/github/webhook/ghc_conn_a", bytes.NewReader(payload))
	req.Header.Set("X-GitHub-Event", "push")
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Hub-Signature-256", computeSignature(payload, secretA))
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}
	var resp models.WebhookResponse
	_ = json.NewDecoder(rec.Body).Decode(&resp)

	if !resp.Received || resp.DeploymentTriggered == nil || !*resp.DeploymentTriggered {
		t.Fatalf("expected deployment triggered for conn_a webhook, got: %+v", resp)
	}
	if resp.ServiceID == nil || *resp.ServiceID != "s_conn_a" {
		t.Fatalf("expected triggered service to be s_conn_a, got %v", resp.ServiceID)
	}

	// Webhook targeted to conn_b -> should match s_conn_b
	req = httptest.NewRequest(http.MethodPost, "/api/github/webhook/ghc_conn_b", bytes.NewReader(payload))
	req.Header.Set("X-GitHub-Event", "push")
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Hub-Signature-256", computeSignature(payload, secretB))
	rec = httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}
	_ = json.NewDecoder(rec.Body).Decode(&resp)
	if !resp.Received || resp.DeploymentTriggered == nil || !*resp.DeploymentTriggered {
		t.Fatalf("expected deployment triggered for conn_b webhook, got: %+v", resp)
	}
	if resp.ServiceID == nil || *resp.ServiceID != "s_conn_b" {
		t.Fatalf("expected triggered service to be s_conn_b, got %v", resp.ServiceID)
	}
}

func generateTestRSAPEM(t *testing.T) []byte {
	t.Helper()
	key, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatalf("failed to generate RSA key: %v", err)
	}
	der := x509.MarshalPKCS1PrivateKey(key)
	block := &pem.Block{
		Type:  "RSA PRIVATE KEY",
		Bytes: der,
	}
	return pem.EncodeToMemory(block)
}

func TestGitHubManifest_And_Exchange(t *testing.T) {
	h, _, _, _ := setupTestDB(t)

	testPEM := generateTestRSAPEM(t)

	// Mock GitHub server
	ghMock := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/app-manifests/valid_code_123/conversions" {
			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(map[string]any{
				"id":             98765,
				"slug":           "tako-deployer-test",
				"name":           "Tako Deployer Test",
				"client_id":      "Iv1.123",
				"client_secret":  "sec_456",
				"webhook_secret": "whsec_789",
				"pem":            string(testPEM),
			})
			return
		}
		if r.URL.Path == "/app/installations" {
			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode([]map[string]any{
				{
					"id": 112233,
					"account": map[string]any{
						"login":      "octopy-org",
						"type":       "Organization",
						"avatar_url": "https://avatars.example.com/org",
					},
					"app_id": 98765,
				},
				{
					"id": 445566,
					"account": map[string]any{
						"login":      "developer-user",
						"type":       "User",
						"avatar_url": "https://avatars.example.com/user",
					},
					"app_id": 98765,
				},
			})
			return
		}
		http.NotFound(w, r)
	}))
	defer ghMock.Close()

	ghClient, _ := github.NewClient(github.ClientConfig{
		BaseURL:    ghMock.URL,
		HTTPClient: ghMock.Client(),
	})
	h.SetGitHubClient(ghClient)

	r := chi.NewRouter()
	r.Get("/api/github/manifest", h.GetGitHubManifest)
	r.Post("/api/github/manifest/exchange", h.ExchangeGitHubManifest)
	r.Post("/api/github/sync-installations", h.SyncGitHubInstallations)
	r.Get("/api/github/connections", h.ListGitHubConnections)

	// 1. Test GetGitHubManifest
	req := httptest.NewRequest(http.MethodGet, "/api/github/manifest", nil)
	req.Header.Set("Origin", "http://localhost:3000")
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200 from /api/github/manifest, got %d: %s", rec.Code, rec.Body.String())
	}
	var manifestResp models.GitHubManifestResponse
	if err := json.NewDecoder(rec.Body).Decode(&manifestResp); err != nil {
		t.Fatalf("failed to decode manifest response: %v", err)
	}
	if manifestResp.ActionURL != "https://github.com/settings/apps/new" {
		t.Fatalf("expected action_url to be https://github.com/settings/apps/new, got %s", manifestResp.ActionURL)
	}
	if manifestResp.Manifest["public"] != true {
		t.Fatalf("expected manifest.public to be true")
	}

	// 1b. Test GetGitHubManifest with query param origin containing IP and custom port
	reqWithOrigin := httptest.NewRequest(http.MethodGet, "/api/github/manifest?origin=http://43.156.243.241:3000", nil)
	recWithOrigin := httptest.NewRecorder()
	r.ServeHTTP(recWithOrigin, reqWithOrigin)
	if recWithOrigin.Code != http.StatusOK {
		t.Fatalf("expected 200 with origin query param, got %d", recWithOrigin.Code)
	}
	var manifestWithOrigin models.GitHubManifestResponse
	if err := json.NewDecoder(recWithOrigin.Body).Decode(&manifestWithOrigin); err != nil {
		t.Fatalf("failed to decode manifest response: %v", err)
	}
	if manifestWithOrigin.Manifest["redirect_url"] != "http://43.156.243.241:3000/settings/github/callback" {
		t.Fatalf("expected redirect_url to include custom port, got %v", manifestWithOrigin.Manifest["redirect_url"])
	}
	if manifestWithOrigin.Manifest["url"] != "http://43.156.243.241:3000" {
		t.Fatalf("expected url to include custom port, got %v", manifestWithOrigin.Manifest["url"])
	}

	// 2. Test ExchangeGitHubManifest
	exchangeReq := models.GitHubAppExchangeRequest{
		Code: "valid_code_123",
	}
	b, _ := json.Marshal(exchangeReq)
	req = httptest.NewRequest(http.MethodPost, "/api/github/manifest/exchange", bytes.NewReader(b))
	rec = httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	if rec.Code != http.StatusCreated {
		t.Fatalf("expected 201 from /api/github/manifest/exchange, got %d: %s", rec.Code, rec.Body.String())
	}
	var exchangeResp models.GitHubAppExchangeResponse
	if err := json.NewDecoder(rec.Body).Decode(&exchangeResp); err != nil {
		t.Fatalf("failed to decode exchange response: %v", err)
	}
	if exchangeResp.AppID != "98765" || exchangeResp.AppSlug != "tako-deployer-test" {
		t.Fatalf("unexpected exchange response: %+v", exchangeResp)
	}

	// 3. Test ListGitHubConnections - both installations should be synced!
	req = httptest.NewRequest(http.MethodGet, "/api/github/connections", nil)
	rec = httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200 from /api/github/connections, got %d: %s", rec.Code, rec.Body.String())
	}
	var conns []models.GitHubConnection
	if err := json.NewDecoder(rec.Body).Decode(&conns); err != nil {
		t.Fatalf("failed to decode connections: %v", err)
	}

	if len(conns) == 0 {
		t.Fatalf("expected at least 1 connection after exchange, got 0")
	}

	// 4. Test SyncGitHubInstallations
	req = httptest.NewRequest(http.MethodPost, "/api/github/sync-installations", nil)
	rec = httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200 from sync-installations, got %d: %s", rec.Code, rec.Body.String())
	}
}
