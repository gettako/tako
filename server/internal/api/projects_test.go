package api_test

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"gettako.dev/tako/internal/api"
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
