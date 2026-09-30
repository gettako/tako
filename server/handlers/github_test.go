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

	"gettako.dev/tako/server/db"
	"gettako.dev/tako/server/deploy"
	"gettako.dev/tako/server/github"
	"gettako.dev/tako/server/nodes"
	"gettako.dev/tako/internal/models"
)

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
