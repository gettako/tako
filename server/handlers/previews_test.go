package handlers

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/go-chi/chi/v5"

	"gettako.dev/tako/internal/models"
)

func TestPreviewEndpoints(t *testing.T) {
	h, _, _, _ := setupTestDB(t)
	db := h.db

	ctx := context.Background()

	_, _ = db.ExecContext(ctx, `INSERT INTO servers (id, name, host) VALUES ('srv1', 'Node 1', '127.0.0.1')`)
	_, _ = db.ExecContext(ctx, `INSERT INTO projects (id, name) VALUES ('p1', 'Alpha')`)
	_, _ = db.ExecContext(ctx, `
		INSERT INTO services (
			id, project_id, server_id, name, repository, branch,
			dockerfile_path, internal_port, health_check_path, status,
			primary_domain, is_preview, preview_enabled
		) VALUES (
			'svc_parent', 'p1', 'srv1', 'Parent Service', 'https://github.com/octocat/repo.git', 'main',
			'Dockerfile', 3000, '/healthz', 'running',
			'myapp.com', 0, 1
		)
	`)

	// Insert 2 preview services
	_, _ = db.ExecContext(ctx, `
		INSERT INTO services (
			id, project_id, server_id, name, repository, branch,
			dockerfile_path, internal_port, health_check_path, status,
			primary_domain, parent_service_id, is_preview, pr_number, preview_status
		) VALUES
		('svc_prev_10', 'p1', 'srv1', 'Parent Service-pr-10', 'https://github.com/octocat/repo.git', 'feat/login',
		 'Dockerfile', 3000, '/healthz', 'running', 'pr-10.myapp.com', 'svc_parent', 1, 10, 'active'),
		('svc_prev_11', 'p1', 'srv1', 'Parent Service-pr-11', 'https://github.com/octocat/repo.git', 'fix/header',
		 'Dockerfile', 3000, '/healthz', 'deploying', 'pr-11.myapp.com', 'svc_parent', 1, 11, 'active')
	`)

	r := chi.NewRouter()
	r.Get("/api/services/{id}/previews", h.ListServicePreviews)
	r.Delete("/api/services/{id}/previews/{preview_id}", h.DeleteServicePreview)

	// 1. List Previews
	req := httptest.NewRequest(http.MethodGet, "/api/services/svc_parent/previews", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}

	var previews []models.PreviewEnvironment
	if err := json.NewDecoder(w.Body).Decode(&previews); err != nil {
		t.Fatalf("failed to decode previews: %v", err)
	}

	if len(previews) != 2 {
		t.Fatalf("expected 2 previews, got %d", len(previews))
	}
	// Sorted by pr_number DESC
	if previews[0].PRNumber != 11 || previews[1].PRNumber != 10 {
		t.Errorf("expected PR #11 then PR #10, got %d and %d", previews[0].PRNumber, previews[1].PRNumber)
	}
	if previews[0].URL != "https://pr-11.myapp.com" {
		t.Errorf("expected URL https://pr-11.myapp.com, got %s", previews[0].URL)
	}

	// 2. Delete Preview #10
	delReq := httptest.NewRequest(http.MethodDelete, "/api/services/svc_parent/previews/svc_prev_10", nil)
	delW := httptest.NewRecorder()
	r.ServeHTTP(delW, delReq)

	if delW.Code != http.StatusOK {
		t.Fatalf("expected 200 deleting preview, got %d: %s", delW.Code, delW.Body.String())
	}

	// Verify only 1 remains
	var count int
	_ = db.QueryRowContext(ctx, `SELECT count(*) FROM services WHERE parent_service_id = 'svc_parent' AND is_preview = 1`).Scan(&count)
	if count != 1 {
		t.Errorf("expected 1 preview remaining, got %d", count)
	}
}
