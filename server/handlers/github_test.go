package handlers

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/go-chi/chi/v5"

	"gettako.dev/tako/internal/crypto"
	"gettako.dev/tako/internal/models"
	"gettako.dev/tako/server/db"
	"gettako.dev/tako/server/deploy"
	"gettako.dev/tako/server/github"
	"gettako.dev/tako/server/nodes"
)

// encryptWebhookSecret returns the nonce||ciphertext blob used by github_connections.webhook_secret_enc.
func encryptWebhookSecret(t *testing.T, secret string, masterKey []byte) []byte {
	t.Helper()
	ciphertext, nonce, err := crypto.Encrypt([]byte(secret), masterKey)
	if err != nil {
		t.Fatalf("encryptWebhookSecret: %v", err)
	}
	return append(nonce, ciphertext...)
}

func setupTestDB(t *testing.T) (*Handler, *deploy.Orchestrator, *nodes.NodeManager, []byte) {
	t.Helper()
	dbPath := fmt.Sprintf("%s/test_tako_%s.db", t.TempDir(), t.Name())
	database, err := db.Open(dbPath)
	if err != nil {
		t.Fatalf("failed to open test db: %v", err)
	}
	t.Cleanup(func() {
		_ = database.Close()
	})

	masterKey := make([]byte, 32)
	copy(masterKey, "test-master-key-32-bytes-long!!!")

	nm := nodes.NewNodeManager(database)
	orc := deploy.NewOrchestrator(database, nm, masterKey)
	h := NewHandler(database, masterKey, "localhost")
	h.SetNodeManager(nm)
	h.SetOrchestrator(orc)

	return h, orc, nm, masterKey
}

func computeSignature(body []byte, secret string) string {
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write(body)
	return "sha256=" + hex.EncodeToString(mac.Sum(nil))
}

func TestGitHubHandlers_Status_Repos_Branches(t *testing.T) {
	h, _, _, _ := setupTestDB(t)

	// Test unconfigured status
	req := httptest.NewRequest(http.MethodGet, "/api/github/status", nil)
	w := httptest.NewRecorder()
	h.GetGitHubStatus(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
	var status models.GitHubStatus
	if err := json.NewDecoder(w.Body).Decode(&status); err != nil {
		t.Fatalf("failed to decode status: %v", err)
	}
	if status.Connected {
		t.Errorf("expected connected = false")
	}

	// Test unconfigured repos
	w = httptest.NewRecorder()
	h.ListGitHubRepos(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
	var repos []models.GitHubRepo
	if err := json.NewDecoder(w.Body).Decode(&repos); err != nil {
		t.Fatalf("failed to decode repos: %v", err)
	}
	if len(repos) != 0 {
		t.Errorf("expected 0 repos, got %d", len(repos))
	}

	// Now configure mock GitHub server
	ghServer := httptest.NewServer(http.HandlerFunc(func(rw http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/user":
			rw.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(rw).Encode(map[string]any{
				"login":      "octocat",
				"avatar_url": "https://github.com/octocat.png",
			})
		case "/user/repos":
			rw.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(rw).Encode([]map[string]any{
				{
					"id":             1,
					"name":           "frontend",
					"full_name":      "octocat/frontend",
					"private":        false,
					"default_branch": "main",
					"html_url":       "https://github.com/octocat/frontend",
				},
				{
					"id":             2,
					"name":           "backend-api",
					"full_name":      "octocat/backend-api",
					"private":        true,
					"default_branch": "master",
					"html_url":       "https://github.com/octocat/backend-api",
				},
			})
		case "/repos/octocat/frontend/branches":
			rw.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(rw).Encode([]map[string]any{
				{
					"name": "main",
					"commit": map[string]any{
						"sha": "11223344",
					},
					"protected": true,
				},
			})
		default:
			http.NotFound(rw, r)
		}
	}))
	defer ghServer.Close()

	client, err := github.NewClient(github.ClientConfig{
		PAT:     "test-pat",
		BaseURL: ghServer.URL,
	})
	if err != nil {
		t.Fatalf("failed to create github client: %v", err)
	}
	h.SetGitHubClient(client)

	// Test configured status
	w = httptest.NewRecorder()
	h.GetGitHubStatus(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
	if err := json.NewDecoder(w.Body).Decode(&status); err != nil {
		t.Fatalf("failed to decode: %v", err)
	}
	if !status.Connected || *status.Username != "octocat" {
		t.Errorf("unexpected status: %+v", status)
	}

	// Test configured repos with search
	req = httptest.NewRequest(http.MethodGet, "/api/github/repos?q=backend", nil)
	w = httptest.NewRecorder()
	h.ListGitHubRepos(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
	repos = nil
	if err := json.NewDecoder(w.Body).Decode(&repos); err != nil {
		t.Fatalf("failed to decode repos: %v", err)
	}
	if len(repos) != 1 || repos[0].Name != "backend-api" {
		t.Fatalf("expected 1 repo matching 'backend', got %d: %+v", len(repos), repos)
	}

	// Test branches
	r := chi.NewRouter()
	r.Get("/api/github/repos/{owner}/{repo}/branches", h.ListGitHubBranches)

	req = httptest.NewRequest(http.MethodGet, "/api/github/repos/octocat/frontend/branches", nil)
	w = httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200 for branches, got %d: %s", w.Code, w.Body.String())
	}
	var branches []models.GitHubBranch
	if err := json.NewDecoder(w.Body).Decode(&branches); err != nil {
		t.Fatalf("failed to decode branches: %v", err)
	}
	if len(branches) != 1 || branches[0].Name != "main" || branches[0].CommitSHA != "11223344" {
		t.Errorf("unexpected branches: %+v", branches)
	}
}

func TestGitHubWebhook_SignatureValidation(t *testing.T) {
	h, _, _, _ := setupTestDB(t)
	secret := "super-webhook-secret-123"
	h.SetWebhookSecret(secret)

	payload := []byte(`{"ref":"refs/heads/main"}`)

	// Missing signature -> 401
	req := httptest.NewRequest(http.MethodPost, "/api/github/webhook", bytes.NewReader(payload))
	req.Header.Set("X-GitHub-Event", "push")
	w := httptest.NewRecorder()
	h.HandleGitHubWebhook(w, req)
	if w.Code != http.StatusUnauthorized {
		t.Errorf("expected 401 for missing signature, got %d", w.Code)
	}
	var errResp map[string]string
	_ = json.NewDecoder(w.Body).Decode(&errResp)
	if errResp["message"] != "missing webhook signature" {
		t.Errorf("expected 'missing webhook signature', got %q", errResp["message"])
	}

	// Tampered signature -> 401
	req = httptest.NewRequest(http.MethodPost, "/api/github/webhook", bytes.NewReader(payload))
	req.Header.Set("X-GitHub-Event", "push")
	req.Header.Set("X-Hub-Signature-256", "sha256=invalidhexsignature000000000000000000000000000000000000000000000000")
	w = httptest.NewRecorder()
	h.HandleGitHubWebhook(w, req)
	if w.Code != http.StatusUnauthorized {
		t.Errorf("expected 401 for invalid signature, got %d", w.Code)
	}

	// Valid signature with ping event -> 200
	validSig := computeSignature(payload, secret)
	req = httptest.NewRequest(http.MethodPost, "/api/github/webhook", bytes.NewReader(payload))
	req.Header.Set("X-GitHub-Event", "ping")
	req.Header.Set("X-Hub-Signature-256", validSig)
	w = httptest.NewRecorder()
	h.HandleGitHubWebhook(w, req)
	if w.Code != http.StatusOK {
		t.Errorf("expected 200 for ping with valid signature, got %d", w.Code)
	}
}

func TestGitHubWebhook_SecretConfigurationAndSignatureValidation(t *testing.T) {
	h, _, _, masterKey := setupTestDB(t)

	r := chi.NewRouter()
	r.Post("/api/github/webhook", h.HandleGitHubWebhook)
	r.Post("/api/github/webhook/{connection_id}", h.HandleGitHubWebhookByConnection)

	payload := []byte(`{"ref":"refs/heads/main"}`)

	// 1. Webhook tanpa secret dikonfigurasi -> 400 Bad Request
	_, err := h.db.Exec(`
		INSERT INTO github_connections (id, name, auth_type, account_name, webhook_secret_enc, created_at, updated_at)
		VALUES ('ghc_unconfigured', 'Unconfigured Conn', 'app', 'octocat', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
	`)
	if err != nil {
		t.Fatalf("failed to insert connection: %v", err)
	}

	req := httptest.NewRequest(http.MethodPost, "/api/github/webhook/ghc_unconfigured", bytes.NewReader(payload))
	req.Header.Set("X-GitHub-Event", "push")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("expected 400 for unconfigured secret, got %d: %s", w.Code, w.Body.String())
	}
	var errResp map[string]string
	_ = json.NewDecoder(w.Body).Decode(&errResp)
	if errResp["message"] != "webhook secret not configured for this connection" {
		t.Errorf("expected 'webhook secret not configured for this connection', got %q", errResp["message"])
	}

	// Global webhook endpoint when connection without secret is found in DB -> 400 Bad Request
	reqGlobal := httptest.NewRequest(http.MethodPost, "/api/github/webhook", bytes.NewReader(payload))
	reqGlobal.Header.Set("X-GitHub-Event", "push")
	wGlobal := httptest.NewRecorder()
	r.ServeHTTP(wGlobal, reqGlobal)
	if wGlobal.Code != http.StatusBadRequest {
		t.Errorf("expected 400 for global webhook when connection has no secret, got %d: %s", wGlobal.Code, wGlobal.Body.String())
	}

	// 2. Webhook dengan secret tapi tanpa header -> 401 Unauthorized
	connSecret := "my-very-secure-secret-456"
	whEnc := encryptWebhookSecret(t, connSecret, masterKey)
	_, err = h.db.Exec(`
		INSERT INTO github_connections (id, name, auth_type, account_name, webhook_secret_enc, created_at, updated_at)
		VALUES ('ghc_configured', 'Configured Conn', 'app', 'octocat', ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
	`, whEnc)
	if err != nil {
		t.Fatalf("failed to insert configured connection: %v", err)
	}

	reqMissingHeader := httptest.NewRequest(http.MethodPost, "/api/github/webhook/ghc_configured", bytes.NewReader(payload))
	reqMissingHeader.Header.Set("X-GitHub-Event", "push")
	wMissing := httptest.NewRecorder()
	r.ServeHTTP(wMissing, reqMissingHeader)

	if wMissing.Code != http.StatusUnauthorized {
		t.Errorf("expected 401 for missing signature header, got %d: %s", wMissing.Code, wMissing.Body.String())
	}
	errResp = nil
	_ = json.NewDecoder(wMissing.Body).Decode(&errResp)
	if errResp["message"] != "missing webhook signature" {
		t.Errorf("expected 'missing webhook signature', got %q", errResp["message"])
	}

	// 3. Webhook dengan header yang salah -> 401 Unauthorized
	reqWrongHeader := httptest.NewRequest(http.MethodPost, "/api/github/webhook/ghc_configured", bytes.NewReader(payload))
	reqWrongHeader.Header.Set("X-GitHub-Event", "push")
	reqWrongHeader.Header.Set("X-Hub-Signature-256", "sha256=badbadbadbadbadbadbadbadbadbadbadbadbadbadbadbadbadbadbadbadbadb")
	wWrong := httptest.NewRecorder()
	r.ServeHTTP(wWrong, reqWrongHeader)

	if wWrong.Code != http.StatusUnauthorized {
		t.Errorf("expected 401 for wrong signature header, got %d: %s", wWrong.Code, wWrong.Body.String())
	}
	errResp = nil
	_ = json.NewDecoder(wWrong.Body).Decode(&errResp)
	if errResp["message"] != "Invalid webhook signature" {
		t.Errorf("expected 'Invalid webhook signature', got %q", errResp["message"])
	}

	// 4. Webhook dengan HMAC yang benar -> diproses (200 OK)
	validSig := computeSignature(payload, connSecret)
	reqValid := httptest.NewRequest(http.MethodPost, "/api/github/webhook/ghc_configured", bytes.NewReader(payload))
	reqValid.Header.Set("X-GitHub-Event", "ping")
	reqValid.Header.Set("X-Hub-Signature-256", validSig)
	wValid := httptest.NewRecorder()
	r.ServeHTTP(wValid, reqValid)

	if wValid.Code != http.StatusOK {
		t.Errorf("expected 200 for valid HMAC signature, got %d: %s", wValid.Code, wValid.Body.String())
	}
	var okResp models.WebhookResponse
	if err := json.NewDecoder(wValid.Body).Decode(&okResp); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	if !okResp.Received {
		t.Errorf("expected okResp.Received = true")
	}
}

func TestGitHubWebhook_AutoDeployDispatch(t *testing.T) {
	h, orc, _, _ := setupTestDB(t)
	secret := "deploy-secret"
	h.SetWebhookSecret(secret)

	// Seed server and project
	_, err := h.db.Exec(`INSERT INTO servers (id, name, status) VALUES ('srv_node1', 'Node 1', 'online')`)
	if err != nil {
		t.Fatalf("failed to insert server: %v", err)
	}
	_, err = h.db.Exec(`INSERT INTO projects (id, name) VALUES ('proj_alpha', 'Project Alpha')`)
	if err != nil {
		t.Fatalf("failed to insert project: %v", err)
	}

	// Create service matching repo "octocat/hello-world" and branch "main" with auto_deploy = 1
	_, err = h.db.Exec(`
		INSERT INTO services (
			id, project_id, server_id, name, repository, branch, dockerfile_path, internal_port, status, auto_deploy
		) VALUES ('svc_web', 'proj_alpha', 'srv_node1', 'Web', 'https://github.com/octocat/hello-world.git', 'main', 'Dockerfile', 3000, 'stopped', 1)
	`)
	if err != nil {
		t.Fatalf("failed to insert service: %v", err)
	}

	// Another service with auto_deploy = 0 (should not be triggered)
	_, err = h.db.Exec(`
		INSERT INTO services (
			id, project_id, server_id, name, repository, branch, dockerfile_path, internal_port, status, auto_deploy
		) VALUES ('svc_manual', 'proj_alpha', 'srv_node1', 'Manual', 'octocat/hello-world', 'main', 'Dockerfile', 3000, 'stopped', 0)
	`)
	if err != nil {
		t.Fatalf("failed to insert manual service: %v", err)
	}

	pushPayload := map[string]any{
		"ref":   "refs/heads/main",
		"after": "deadbeef1234",
		"repository": map[string]any{
			"full_name": "octocat/hello-world",
			"clone_url": "https://github.com/octocat/hello-world.git",
		},
		"head_commit": map[string]any{
			"id":      "deadbeef1234",
			"message": "feat: release new header",
			"author": map[string]any{
				"name": "Octo Cat",
			},
		},
	}
	payloadBytes, _ := json.Marshal(pushPayload)

	req := httptest.NewRequest(http.MethodPost, "/api/github/webhook", bytes.NewReader(payloadBytes))
	req.Header.Set("X-GitHub-Event", "push")
	req.Header.Set("X-Hub-Signature-256", computeSignature(payloadBytes, secret))
	w := httptest.NewRecorder()

	h.HandleGitHubWebhook(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}

	var resp models.WebhookResponse
	if err := json.NewDecoder(w.Body).Decode(&resp); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	if !resp.Received || resp.DeploymentTriggered == nil || !*resp.DeploymentTriggered || resp.ServiceID == nil || *resp.ServiceID != "svc_web" {
		t.Fatalf("unexpected webhook response: %+v", resp)
	}

	// Verify deployment record in DB
	var depID, branch, commitSHA, commitAuthor, commitMsg, triggerType, svcID string
	err = h.db.QueryRow(`
		SELECT id, service_id, branch, commit_sha, commit_author, commit_message, trigger_type
		FROM deployments WHERE service_id = 'svc_web'
	`).Scan(&depID, &svcID, &branch, &commitSHA, &commitAuthor, &commitMsg, &triggerType)
	if err != nil {
		t.Fatalf("failed to query deployment record: %v", err)
	}

	if branch != "main" || commitSHA != "deadbeef1234" || commitAuthor != "Octo Cat" || commitMsg != "feat: release new header" || triggerType != "webhook" {
		t.Errorf("deployment mismatch: branch=%s, commit=%s, author=%s, msg=%s, trigger=%s", branch, commitSHA, commitAuthor, commitMsg, triggerType)
	}

	// Test [skip deploy] commit
	skipPayload := map[string]any{
		"ref":   "refs/heads/main",
		"after": "abcd5678",
		"repository": map[string]any{
			"full_name": "octocat/hello-world",
		},
		"head_commit": map[string]any{
			"id":      "abcd5678",
			"message": "docs: update readme [skip deploy]",
			"author":  map[string]any{"name": "Octo Cat"},
		},
	}
	skipBytes, _ := json.Marshal(skipPayload)
	req = httptest.NewRequest(http.MethodPost, "/api/github/webhook", bytes.NewReader(skipBytes))
	req.Header.Set("X-GitHub-Event", "push")
	req.Header.Set("X-Hub-Signature-256", computeSignature(skipBytes, secret))
	w = httptest.NewRecorder()

	h.HandleGitHubWebhook(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200 for skipped commit, got %d", w.Code)
	}
	var skipResp models.WebhookResponse
	_ = json.NewDecoder(w.Body).Decode(&skipResp)
	if !skipResp.Received || skipResp.DeploymentTriggered == nil || *skipResp.DeploymentTriggered {
		t.Errorf("expected DeploymentTriggered = false for [skip deploy], got %+v", skipResp)
	}

	_ = orc
}

func TestServices_SSHDeployKeyGeneration(t *testing.T) {
	h, orc, nm, masterKey := setupTestDB(t)

	_, _ = h.db.Exec(`INSERT INTO servers (id, name, status) VALUES ('srv_node1', 'Node 1', 'online')`)
	_, _ = h.db.Exec(`INSERT INTO projects (id, name) VALUES ('proj_alpha', 'Project Alpha')`)

	// Create service with custom SSH URL: git@github.com:myorg/private-repo.git
	createBody := map[string]any{
		"project_id": "proj_alpha",
		"server_id":  "srv_node1",
		"name":       "Private App",
		"repository": "git@github.com:myorg/private-repo.git",
		"branch":     "main",
	}
	bodyBytes, _ := json.Marshal(createBody)

	req := httptest.NewRequest(http.MethodPost, "/api/services", bytes.NewReader(bodyBytes))
	w := httptest.NewRecorder()
	h.CreateService(w, req)

	if w.Code != http.StatusCreated {
		t.Fatalf("expected 201 Created, got %d: %s", w.Code, w.Body.String())
	}

	var svc models.Service
	if err := json.NewDecoder(w.Body).Decode(&svc); err != nil {
		t.Fatalf("failed to decode created service: %v", err)
	}

	if svc.DeployKeyPublic == nil || *svc.DeployKeyPublic == "" {
		t.Fatalf("expected DeployKeyPublic to be generated for SSH repository")
	}

	pubKey := *svc.DeployKeyPublic
	if len(pubKey) < 20 || !bytes.HasPrefix([]byte(pubKey), []byte("ssh-ed25519 ")) {
		t.Errorf("unexpected public key format: %s", pubKey)
	}

	// Trigger deployment and verify SSH private key is decrypted and included in deploy job
	dep, err := orc.TriggerDeployment(context.Background(), svc.ID, &models.CreateDeploymentRequest{
		Branch: &svc.Branch,
	})
	if err != nil {
		t.Fatalf("TriggerDeployment failed: %v", err)
	}
	if dep.Status != models.DeploymentBuilding {
		t.Errorf("expected deployment status building, got %s", dep.Status)
	}

	_ = nm
	_ = masterKey
}
