package handlers

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/go-chi/chi/v5"

	"gettako.dev/tako/internal/models"
)

func TestServiceTriggers_PushAndTagHandling(t *testing.T) {
	h, orc, _, _ := setupTestDB(t)

	// Create test server and project
	_, err := h.db.Exec(`
		INSERT INTO servers (id, name, host, status, created_at, updated_at)
		VALUES ('srv_node1', 'Node 1', '192.168.1.10', 'online', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
	`)
	if err != nil {
		t.Fatalf("failed to insert server: %v", err)
	}

	_, err = h.db.Exec(`
		INSERT INTO projects (id, name, description, created_at, updated_at)
		VALUES ('prj_demo', 'Demo Project', 'Test project', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
	`)
	if err != nil {
		t.Fatalf("failed to insert project: %v", err)
	}

	// Service 1: Watches repo "octocat/app", branch "main", trigger_on_push=1, trigger_on_tag=1, tag_pattern="v*"
	_, err = h.db.Exec(`
		INSERT INTO services (
			id, project_id, server_id, name, repository, branch, dockerfile_path, internal_port, status,
			auto_deploy, trigger_on_push, trigger_on_tag, tag_pattern, created_at, updated_at
		) VALUES (
			'svc_app', 'prj_demo', 'srv_node1', 'App Service', 'https://github.com/octocat/app.git', 'main', 'Dockerfile', 3000, 'running',
			1, 1, 1, 'v*', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
		)
	`)
	if err != nil {
		t.Fatalf("failed to insert service svc_app: %v", err)
	}

	// Service 2: Watches repo "octocat/app", trigger_on_tag=0 (push only)
	_, err = h.db.Exec(`
		INSERT INTO services (
			id, project_id, server_id, name, repository, branch, dockerfile_path, internal_port, status,
			auto_deploy, trigger_on_push, trigger_on_tag, tag_pattern, created_at, updated_at
		) VALUES (
			'svc_worker', 'prj_demo', 'srv_node1', 'Worker Service', 'https://github.com/octocat/app.git', 'main', 'Dockerfile', 0, 'running',
			1, 1, 0, '*', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
		)
	`)
	if err != nil {
		t.Fatalf("failed to insert service svc_worker: %v", err)
	}

	r := chi.NewRouter()
	r.Post("/api/github/webhook", h.HandleGitHubWebhook)
	r.Post("/api/services/{id}/webhook", h.HandleServiceWebhook)

	// 1. Send push event for a matching tag "v1.2.0"
	tagPayload := map[string]any{
		"ref":   "refs/tags/v1.2.0",
		"after": "c0ffee123456",
		"repository": map[string]any{
			"full_name": "octocat/app",
		},
		"head_commit": map[string]any{
			"id":      "c0ffee123456",
			"message": "release: v1.2.0",
			"author": map[string]any{
				"name": "Octo Cat",
			},
		},
	}
	tagBytes, _ := json.Marshal(tagPayload)

	req := httptest.NewRequest(http.MethodPost, "/api/github/webhook", bytes.NewReader(tagBytes))
	req.Header.Set("X-GitHub-Event", "push")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}

	var tagResp models.WebhookResponse
	if err := json.NewDecoder(w.Body).Decode(&tagResp); err != nil {
		t.Fatalf("decode tag webhook response failed: %v", err)
	}
	if !tagResp.Received || tagResp.DeploymentTriggered == nil || !*tagResp.DeploymentTriggered {
		t.Fatalf("expected deployment triggered for tag v1.2.0, got %+v", tagResp)
	}
	if tagResp.ServiceID == nil || *tagResp.ServiceID != "svc_app" {
		t.Fatalf("expected triggered service svc_app, got %v", tagResp.ServiceID)
	}

	// Verify deployment record in DB has branch="v1.2.0" and trigger_type="tag"
	var depBranch, depTrigger string
	err = h.db.QueryRow("SELECT branch, trigger_type FROM deployments WHERE service_id = 'svc_app' ORDER BY created_at DESC LIMIT 1").Scan(&depBranch, &depTrigger)
	if err != nil {
		t.Fatalf("failed to query deployment: %v", err)
	}
	if depBranch != "v1.2.0" || depTrigger != "tag" {
		t.Errorf("deployment mismatch: expected branch=v1.2.0, trigger=tag; got branch=%s, trigger=%s", depBranch, depTrigger)
	}

	// 2. Send push event for non-matching tag "beta-1" (tag_pattern is "v*")
	nonMatchPayload := map[string]any{
		"ref":   "refs/tags/beta-1",
		"after": "deadbeef9999",
		"repository": map[string]any{
			"full_name": "octocat/app",
		},
	}
	nonMatchBytes, _ := json.Marshal(nonMatchPayload)

	reqNonMatch := httptest.NewRequest(http.MethodPost, "/api/github/webhook", bytes.NewReader(nonMatchBytes))
	reqNonMatch.Header.Set("X-GitHub-Event", "push")
	wNonMatch := httptest.NewRecorder()
	r.ServeHTTP(wNonMatch, reqNonMatch)

	var nonMatchResp models.WebhookResponse
	_ = json.NewDecoder(wNonMatch.Body).Decode(&nonMatchResp)
	if nonMatchResp.DeploymentTriggered != nil && *nonMatchResp.DeploymentTriggered {
		t.Errorf("expected no deployment triggered for tag beta-1, but triggered")
	}

	// 3. Test Service-specific webhook endpoint: POST /api/services/svc_app/webhook
	svcWebhookPayload := map[string]any{
		"ref":   "refs/heads/main",
		"after": "112233445566",
		"head_commit": map[string]any{
			"id":      "112233445566",
			"message": "fix: update button styles",
			"author": map[string]any{
				"name": "Octo Cat",
			},
		},
	}
	svcBytes, _ := json.Marshal(svcWebhookPayload)

	reqSvc := httptest.NewRequest(http.MethodPost, "/api/services/svc_app/webhook", bytes.NewReader(svcBytes))
	reqSvc.Header.Set("X-GitHub-Event", "push")
	wSvc := httptest.NewRecorder()
	r.ServeHTTP(wSvc, reqSvc)

	if wSvc.Code != http.StatusOK {
		t.Fatalf("expected 200 from service webhook, got %d: %s", wSvc.Code, wSvc.Body.String())
	}
	var svcPix models.WebhookResponse
	_ = json.NewDecoder(wSvc.Body).Decode(&svcPix)
	if svcPix.DeploymentTriggered == nil || !*svcPix.DeploymentTriggered {
		t.Fatalf("expected deployment triggered from service webhook, got %+v", svcPix)
	}

	// 4. Update service triggers via UpdateService API
	updateReq := models.UpdateServiceRequest{
		TriggerOnPush: ptrBool(false),
		TriggerOnTag:  ptrBool(true),
		TagPattern:    ptrStr("release-*"),
	}
	updateBytes, _ := json.Marshal(updateReq)
	reqUpdate := httptest.NewRequest(http.MethodPut, "/api/services/svc_app", bytes.NewReader(updateBytes))
	rctx := chi.NewRouteContext()
	rctx.URLParams.Add("id", "svc_app")
	reqUpdate = reqUpdate.WithContext(context.WithValue(reqUpdate.Context(), chi.RouteCtxKey, rctx))
	wUpdate := httptest.NewRecorder()
	h.UpdateService(wUpdate, reqUpdate)

	if wUpdate.Code != http.StatusOK {
		t.Fatalf("expected 200 from UpdateService, got %d: %s", wUpdate.Code, wUpdate.Body.String())
	}

	var updatedSvc models.Service
	_ = json.NewDecoder(wUpdate.Body).Decode(&updatedSvc)
	if updatedSvc.TriggerOnPush != false || updatedSvc.AutoDeploy != false {
		t.Errorf("expected TriggerOnPush=false and AutoDeploy=false, got %v and %v", updatedSvc.TriggerOnPush, updatedSvc.AutoDeploy)
	}
	if !updatedSvc.TriggerOnTag {
		t.Errorf("expected TriggerOnTag=true")
	}
	if updatedSvc.TagPattern == nil || *updatedSvc.TagPattern != "release-*" {
		t.Errorf("expected TagPattern='release-*', got %v", updatedSvc.TagPattern)
	}

	_ = orc
}

func ptrBool(b bool) *bool {
	return &b
}

func ptrStr(s string) *string {
	return &s
}
