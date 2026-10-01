package handlers

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"gettako.dev/tako/internal/models"
)

func TestGitHubPRWebhook(t *testing.T) {
	h, orc, _, _ := setupTestDB(t)
	h.SetOrchestrator(orc)
	db := h.db

	ctx := context.Background()

	// Provision server with public host IP
	_, err := db.ExecContext(ctx, `
		INSERT INTO servers (id, name, host, status)
		VALUES ('srv_node1', 'Node 1', '93.184.216.34', 'online')
	`)
	if err != nil {
		t.Fatalf("failed to insert server: %v", err)
	}

	// Provision project
	_, err = db.ExecContext(ctx, `
		INSERT INTO projects (id, name)
		VALUES ('proj_alpha', 'Alpha Project')
	`)
	if err != nil {
		t.Fatalf("failed to insert project: %v", err)
	}

	// Provision parent service with custom domain and preview enabled
	_, err = db.ExecContext(ctx, `
		INSERT INTO services (
			id, project_id, server_id, name, repository, branch,
			dockerfile_path, internal_port, health_check_path, status,
			primary_domain, is_preview, preview_enabled, max_previews
		) VALUES (
			'svc_web', 'proj_alpha', 'srv_node1', 'Web', 'https://github.com/octocat/hello-world.git', 'main',
			'Dockerfile', 3000, '/healthz', 'stopped',
			'myapp.gettako.dev', 0, 1, 5
		)
	`)
	if err != nil {
		t.Fatalf("failed to insert parent service: %v", err)
	}

	// 1. Simulate PR opened event
	prOpenPayload := map[string]any{
		"action": "opened",
		"number": 42,
		"pull_request": map[string]any{
			"number": 42,
			"title":  "feat: add shiny button",
			"state":  "open",
			"user": map[string]any{
				"login": "octocat",
			},
			"head": map[string]any{
				"ref": "feat/shiny-button",
				"sha": "a1b2c3d4e5f6",
			},
			"base": map[string]any{
				"ref": "main",
			},
		},
		"repository": map[string]any{
			"full_name": "octocat/hello-world",
			"clone_url": "https://github.com/octocat/hello-world.git",
		},
	}
	openBytes, _ := json.Marshal(prOpenPayload)

	req := httptest.NewRequest(http.MethodPost, "/api/github/webhook", bytes.NewReader(openBytes))
	req.Header.Set("X-GitHub-Event", "pull_request")
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	h.HandleGitHubWebhook(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}

	var resp models.WebhookResponse
	if err := json.NewDecoder(w.Body).Decode(&resp); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}

	if !resp.Received || resp.DeploymentTriggered == nil || !*resp.DeploymentTriggered {
		t.Fatalf("expected deployment triggered on PR open, got %+v", resp)
	}

	// Verify preview service was created in database
	var previewID, previewName, previewDomain, previewBranch string
	var prNum int
	err = db.QueryRowContext(ctx, `
		SELECT id, name, primary_domain, branch, pr_number
		FROM services
		WHERE parent_service_id = 'svc_web' AND is_preview = 1 AND pr_number = 42
	`).Scan(&previewID, &previewName, &previewDomain, &previewBranch, &prNum)
	if err != nil {
		t.Fatalf("preview service not found in db: %v", err)
	}

	if previewName != "Web-pr-42" {
		t.Errorf("expected preview name Web-pr-42, got %s", previewName)
	}
	if previewDomain != "42.myapp.gettako.dev" {
		t.Errorf("expected preview domain 42.myapp.gettako.dev, got %s", previewDomain)
	}
	if previewBranch != "feat/shiny-button" {
		t.Errorf("expected branch feat/shiny-button, got %s", previewBranch)
	}

	// Verify domain was inserted in domains table
	var domainCount int
	_ = db.QueryRowContext(ctx, `SELECT count(*) FROM domains WHERE service_id = ? AND domain = ?`, previewID, previewDomain).Scan(&domainCount)
	if domainCount != 1 {
		t.Errorf("expected 1 domain record, got %d", domainCount)
	}

	// 2. Simulate PR closed event
	prClosedPayload := map[string]any{
		"action": "closed",
		"number": 42,
		"pull_request": map[string]any{
			"number": 42,
			"state":  "closed",
			"merged": true,
		},
		"repository": map[string]any{
			"full_name": "octocat/hello-world",
			"clone_url": "https://github.com/octocat/hello-world.git",
		},
	}
	closedBytes, _ := json.Marshal(prClosedPayload)

	req = httptest.NewRequest(http.MethodPost, "/api/github/webhook", bytes.NewReader(closedBytes))
	req.Header.Set("X-GitHub-Event", "pull_request")
	req.Header.Set("Content-Type", "application/json")
	w = httptest.NewRecorder()

	h.HandleGitHubWebhook(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}

	// Verify preview service was deleted from database
	var remainingCount int
	_ = db.QueryRowContext(ctx, `SELECT count(*) FROM services WHERE id = ?`, previewID).Scan(&remainingCount)
	if remainingCount != 0 {
		t.Errorf("expected preview service to be destroyed after PR closed, found %d", remainingCount)
	}
}

func TestGitHubPRWebhook_ConcurrencySafeguard(t *testing.T) {
	h, orc, _, _ := setupTestDB(t)
	h.SetOrchestrator(orc)
	db := h.db

	ctx := context.Background()

	_, _ = db.ExecContext(ctx, `INSERT INTO servers (id, name, host) VALUES ('srv1', 'Node 1', '127.0.0.1')`)
	_, _ = db.ExecContext(ctx, `INSERT INTO projects (id, name) VALUES ('p1', 'Alpha')`)
	_, _ = db.ExecContext(ctx, `
		INSERT INTO services (
			id, project_id, server_id, name, repository, branch,
			dockerfile_path, internal_port, health_check_path, status,
			primary_domain, is_preview, preview_enabled, max_previews
		) VALUES (
			'svc_parent', 'p1', 'srv1', 'Parent', 'https://github.com/octocat/repo.git', 'main',
			'Dockerfile', 3000, '/healthz', 'stopped',
			'', 0, 1, 2
		)
	`)

	// Create 2 previews up to the limit (max_previews = 2)
	for prNum := 1; prNum <= 2; prNum++ {
		payload := map[string]any{
			"action": "opened",
			"number": prNum,
			"pull_request": map[string]any{
				"number": prNum,
				"title":  fmt.Sprintf("PR #%d", prNum),
				"user":   map[string]any{"login": "octocat"},
				"head":   map[string]any{"ref": fmt.Sprintf("branch-%d", prNum), "sha": "123456"},
				"base":   map[string]any{"ref": "main"},
			},
			"repository": map[string]any{
				"full_name": "octocat/repo",
			},
		}
		b, _ := json.Marshal(payload)
		req := httptest.NewRequest(http.MethodPost, "/api/github/webhook", bytes.NewReader(b))
		req.Header.Set("X-GitHub-Event", "pull_request")
		w := httptest.NewRecorder()
		h.HandleGitHubWebhook(w, req)
	}

	var count int
	_ = db.QueryRowContext(ctx, `SELECT count(*) FROM services WHERE parent_service_id = 'svc_parent' AND is_preview = 1`).Scan(&count)
	if count != 2 {
		t.Fatalf("expected 2 active previews, got %d", count)
	}

	// Trigger 3rd preview (exceeds max_previews = 2). Should reap oldest (PR #1).
	payload3 := map[string]any{
		"action": "opened",
		"number": 3,
		"pull_request": map[string]any{
			"number": 3,
			"title":  "PR #3",
			"user":   map[string]any{"login": "octocat"},
			"head":   map[string]any{"ref": "branch-3", "sha": "123456"},
			"base":   map[string]any{"ref": "main"},
		},
		"repository": map[string]any{
			"full_name": "octocat/repo",
		},
	}
	b3, _ := json.Marshal(payload3)
	req3 := httptest.NewRequest(http.MethodPost, "/api/github/webhook", bytes.NewReader(b3))
	req3.Header.Set("X-GitHub-Event", "pull_request")
	w3 := httptest.NewRecorder()
	h.HandleGitHubWebhook(w3, req3)

	// Still should have exactly 2 active previews
	_ = db.QueryRowContext(ctx, `SELECT count(*) FROM services WHERE parent_service_id = 'svc_parent' AND is_preview = 1`).Scan(&count)
	if count != 2 {
		t.Fatalf("expected 2 active previews after concurrency safeguard reap, got %d", count)
	}

	// Verify PR #1 was the one reaped
	var pr1Count int
	_ = db.QueryRowContext(ctx, `SELECT count(*) FROM services WHERE parent_service_id = 'svc_parent' AND pr_number = 1`).Scan(&pr1Count)
	if pr1Count != 0 {
		t.Errorf("expected PR #1 to be reaped")
	}

	// Verify PR #3 exists
	var pr3Count int
	_ = db.QueryRowContext(ctx, `SELECT count(*) FROM services WHERE parent_service_id = 'svc_parent' AND pr_number = 3`).Scan(&pr3Count)
	if pr3Count != 1 {
		t.Errorf("expected PR #3 to exist")
	}
}

func TestGitHubPRWebhook_ForkPRBlocked(t *testing.T) {
	h, orc, _, _ := setupTestDB(t)
	h.SetOrchestrator(orc)
	db := h.db

	ctx := context.Background()

	_, _ = db.ExecContext(ctx, `INSERT INTO servers (id, name, host) VALUES ('srv_fork', 'Node 1', '127.0.0.1')`)
	_, _ = db.ExecContext(ctx, `INSERT INTO projects (id, name) VALUES ('proj_fork', 'Fork Test')`)
	_, _ = db.ExecContext(ctx, `
		INSERT INTO services (
			id, project_id, server_id, name, repository, branch,
			dockerfile_path, internal_port, health_check_path, status,
			primary_domain, is_preview, preview_enabled, max_previews
		) VALUES (
			'svc_parent_fork', 'proj_fork', 'srv_fork', 'ParentFork', 'https://github.com/upstream/repo.git', 'main',
			'Dockerfile', 3000, '/healthz', 'stopped',
			'', 0, 1, 5
		)
	`)

	// Simulate PR from an external fork
	forkPayload := map[string]any{
		"action": "opened",
		"number": 99,
		"pull_request": map[string]any{
			"number": 99,
			"title":  "malicious pr from fork",
			"user":   map[string]any{"login": "attacker"},
			"head": map[string]any{
				"ref": "patch-1",
				"sha": "badsha123",
				"repo": map[string]any{
					"full_name": "attacker/repo",
					"fork":      true,
				},
			},
			"base": map[string]any{
				"ref": "main",
				"repo": map[string]any{
					"full_name": "upstream/repo",
					"fork":      false,
				},
			},
		},
		"repository": map[string]any{
			"full_name": "upstream/repo",
			"clone_url": "https://github.com/upstream/repo.git",
		},
	}
	b, _ := json.Marshal(forkPayload)
	req := httptest.NewRequest(http.MethodPost, "/api/github/webhook", bytes.NewReader(b))
	req.Header.Set("X-GitHub-Event", "pull_request")
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	h.HandleGitHubWebhook(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200 OK, got %d: %s", w.Code, w.Body.String())
	}

	var resp models.WebhookResponse
	if err := json.NewDecoder(w.Body).Decode(&resp); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}

	if resp.DeploymentTriggered != nil && *resp.DeploymentTriggered {
		t.Fatalf("expected deployment_triggered = false for fork PR, got true")
	}

	// Verify no preview service was created for this fork PR
	var count int
	_ = db.QueryRowContext(ctx, `SELECT count(*) FROM services WHERE parent_service_id = 'svc_parent_fork' AND pr_number = 99`).Scan(&count)
	if count != 0 {
		t.Fatalf("expected 0 preview services for fork PR, got %d", count)
	}
}

