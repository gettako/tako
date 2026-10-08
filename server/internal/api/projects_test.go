package api_test

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"gettako.dev/tako/internal/api"
	"gettako.dev/tako/internal/orchestrator"
	"gettako.dev/tako/internal/store/db"
	takov1 "gettako.dev/tako/proto/gen/go/tako/v1"
)

func TestProjectLifecycle(t *testing.T) {
	router, _ := setupTestRouter(t)

	// 1. Create a project
	createPayload := api.CreateProjectRequest{
		Name:        "Billing Service",
		Slug:        "billing-service",
		Description: "Core billing and invoices",
		Environment: "production",
		Tags:        []string{"billing", "fintech"},
	}
	body, _ := json.Marshal(createPayload)
	req := httptest.NewRequest(http.MethodPost, "/api/v1/projects", bytes.NewReader(body))
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusCreated {
		t.Fatalf("expected 201 Created, got %d: %s", rec.Code, rec.Body.String())
	}

	var created api.ProjectResponse
	if err := json.NewDecoder(rec.Body).Decode(&created); err != nil {
		t.Fatalf("failed to decode created project: %v", err)
	}
	if created.Name != "Billing Service" || created.ID == "" {
		t.Fatalf("unexpected project: %+v", created)
	}

	// 2. List projects
	req = httptest.NewRequest(http.MethodGet, "/api/v1/projects", nil)
	rec = httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200 OK, got %d", rec.Code)
	}

	var list []api.ProjectResponse
	if err := json.NewDecoder(rec.Body).Decode(&list); err != nil {
		t.Fatalf("failed to decode list: %v", err)
	}
	if len(list) != 1 || list[0].ID != created.ID {
		t.Fatalf("expected 1 project in list, got %d", len(list))
	}

	// 3. Get project by ID
	req = httptest.NewRequest(http.MethodGet, "/api/v1/projects/"+created.ID, nil)
	rec = httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200 OK, got %d", rec.Code)
	}

	// 4. Delete project
	req = httptest.NewRequest(http.MethodDelete, "/api/v1/projects/"+created.ID, nil)
	rec = httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200 OK, got %d", rec.Code)
	}

	// 5. Verify deleted
	req = httptest.NewRequest(http.MethodGet, "/api/v1/projects/"+created.ID, nil)
	rec = httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusNotFound {
		t.Fatalf("expected 404 NotFound after deletion, got %d", rec.Code)
	}
}

func TestDeleteProjectWithServices(t *testing.T) {
	router, orch := setupTestRouter(t)
	ctx := t.Context()

	// 1. Create project
	proj, err := orch.Queries().CreateProject(ctx, db.CreateProjectParams{
		ID:          "prj-has-services",
		Name:        "Project with Services",
		Slug:        "project-with-services",
		Environment: "production",
		Status:      "healthy",
		Tags:        "[]",
	})
	if err != nil {
		t.Fatalf("failed to create project: %v", err)
	}

	// 2. Register node and create service under this project
	_, _ = orch.RegisterNode(ctx, &takov1.RegisterNodeRequest{
		NodeId:      "node-proj-del",
		Name:        "Node Proj Del",
		EnrollToken: "test-enroll",
	})

	srv, err := orch.CreateService(ctx, orchestrator.CreateServiceParams{
		ProjectID:  proj.ID,
		NodeID:     "node-proj-del",
		Name:       "Worker Service",
		Slug:       "worker-service",
		Type:       "app",
		Repository: "https://github.com/gettako/sample",
	})
	if err != nil {
		t.Fatalf("failed to create service: %v", err)
	}

	// 3. Try to DELETE project while it still has services -> should fail with 400
	req := httptest.NewRequest(http.MethodDelete, "/api/v1/projects/"+proj.ID, nil)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 Bad Request when deleting project with services, got %d: %s", rec.Code, rec.Body.String())
	}

	// 4. Delete the service
	err = orch.Queries().DeleteService(ctx, srv.ID)
	if err != nil {
		t.Fatalf("failed to delete service: %v", err)
	}

	// 5. Try to DELETE project again -> should succeed with 200
	req = httptest.NewRequest(http.MethodDelete, "/api/v1/projects/"+proj.ID, nil)
	rec = httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200 OK after services deleted, got %d: %s", rec.Code, rec.Body.String())
	}

	// 6. Verify project is gone
	req = httptest.NewRequest(http.MethodGet, "/api/v1/projects/"+proj.ID, nil)
	rec = httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusNotFound {
		t.Fatalf("expected 404 NotFound after project deletion, got %d", rec.Code)
	}
}

func TestUpdateProject(t *testing.T) {
	router, _ := setupTestRouter(t)

	// 1. Create a project
	createPayload := api.CreateProjectRequest{
		Name:        "Old Name",
		Slug:        "old-name",
		Description: "Initial description",
		Environment: "development",
		Tags:        []string{"initial"},
	}
	body, _ := json.Marshal(createPayload)
	req := httptest.NewRequest(http.MethodPost, "/api/v1/projects", bytes.NewReader(body))
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusCreated {
		t.Fatalf("expected 201 Created, got %d: %s", rec.Code, rec.Body.String())
	}

	var created api.ProjectResponse
	_ = json.NewDecoder(rec.Body).Decode(&created)

	// 2. Update/Rename project using PATCH
	newName := "Renamed Project"
	newSlug := "renamed-project"
	newDesc := "Updated description"
	newEnv := "production"
	newTags := []string{"renamed", "prod"}
	updatePayload := api.UpdateProjectRequest{
		Name:        &newName,
		Slug:        &newSlug,
		Description: &newDesc,
		Environment: &newEnv,
		Tags:        &newTags,
	}
	body, _ = json.Marshal(updatePayload)
	req = httptest.NewRequest(http.MethodPatch, "/api/v1/projects/"+created.ID, bytes.NewReader(body))
	rec = httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200 OK on PATCH, got %d: %s", rec.Code, rec.Body.String())
	}

	var updated api.ProjectResponse
	if err := json.NewDecoder(rec.Body).Decode(&updated); err != nil {
		t.Fatalf("failed to decode updated project: %v", err)
	}

	if updated.Name != "Renamed Project" || updated.Slug != "renamed-project" || updated.Description != "Updated description" || updated.Environment != "production" {
		t.Fatalf("unexpected updated project: %+v", updated)
	}

	// 3. Verify Get returns updated data
	req = httptest.NewRequest(http.MethodGet, "/api/v1/projects/"+created.ID, nil)
	rec = httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200 OK on GET, got %d", rec.Code)
	}
	var fetched api.ProjectResponse
	_ = json.NewDecoder(rec.Body).Decode(&fetched)
	if fetched.Name != "Renamed Project" {
		t.Fatalf("expected project name 'Renamed Project', got %q", fetched.Name)
	}
}

