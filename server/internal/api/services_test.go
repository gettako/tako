package api_test

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"gettako.dev/tako/internal/api"
	"gettako.dev/tako/internal/store/db"
	takov1 "gettako.dev/tako/proto/gen/go/tako/v1"
)

func TestServiceAndDeploymentLifecycle(t *testing.T) {
	router, orch := setupTestRouter(t)
	ctx := context.Background()

	// 1. Prepare project & node
	_, _ = orch.Queries().CreateProject(ctx, db.CreateProjectParams{
		ID:          "prj-test-1",
		Name:        "Test Project",
		Slug:        "test-project",
		Environment: "production",
		Status:      "healthy",
		Tags:        "[]",
	})

	_, _ = orch.RegisterNode(ctx, &takov1.RegisterNodeRequest{
		NodeId:      "node-srv-1",
		Name:        "Srv Node",
		EnrollToken: "test-enroll",
	})

	var serviceID string

	// 2. POST /api/v1/services
	t.Run("Create Service", func(t *testing.T) {
		payload := api.CreateServiceRequest{
			ProjectID:       "prj-test-1",
			NodeID:          "node-srv-1",
			Name:            "Awesome App",
			Slug:            "awesome-app",
			Type:            "app",
			Image:           "nginx:alpine",
			Ports:           []int32{80},
			Domains:         []string{"app.local"},
			EnvironmentVars: map[string]string{"PORT": "80"},
		}
		data, _ := json.Marshal(payload)

		req := httptest.NewRequest(http.MethodPost, "/api/v1/services", bytes.NewReader(data))
		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, req)

		if rec.Code != http.StatusCreated {
			t.Fatalf("expected 201 Created, got %d: %s", rec.Code, rec.Body.String())
		}

		var res api.ServiceResponse
		_ = json.NewDecoder(rec.Body).Decode(&res)
		if res.Name != "Awesome App" || len(res.Domains) != 1 {
			t.Fatalf("unexpected service response: %+v", res)
		}
		serviceID = res.ID
	})

	// 3. GET /api/v1/services
	t.Run("List Services", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/api/v1/services", nil)
		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, req)

		if rec.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d", rec.Code)
		}

		var res []api.ServiceResponse
		_ = json.NewDecoder(rec.Body).Decode(&res)
		if len(res) == 0 {
			t.Fatalf("expected at least 1 service")
		}
	})

	// 4. POST /api/v1/services/{id}/deploy
	var deploymentID string
	t.Run("Trigger Deployment", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodPost, "/api/v1/services/"+serviceID+"/deploy", nil)
		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, req)

		if rec.Code != http.StatusAccepted {
			t.Fatalf("expected 202 Accepted, got %d", rec.Code)
		}

		var res map[string]string
		_ = json.NewDecoder(rec.Body).Decode(&res)
		deploymentID = res["deploymentId"]
		if deploymentID == "" {
			t.Fatalf("expected valid deploymentId")
		}
	})

	// 5. GET /api/v1/deployments/{id}
	t.Run("Get Deployment Status", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/api/v1/deployments/"+deploymentID, nil)
		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, req)

		if rec.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d", rec.Code)
		}
	})

	// 5b. GET /api/v1/services/{id}/deployments and /api/v1/deployments?serviceId=...
	t.Run("List Deployments", func(t *testing.T) {
		req1 := httptest.NewRequest(http.MethodGet, "/api/v1/services/"+serviceID+"/deployments", nil)
		rec1 := httptest.NewRecorder()
		router.ServeHTTP(rec1, req1)
		if rec1.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d", rec1.Code)
		}

		req2 := httptest.NewRequest(http.MethodGet, "/api/v1/deployments?serviceId="+serviceID, nil)
		rec2 := httptest.NewRecorder()
		router.ServeHTTP(rec2, req2)
		if rec2.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d", rec2.Code)
		}
	})

	// 6. DELETE /api/v1/services/{id}
	t.Run("Delete Service", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodDelete, "/api/v1/services/"+serviceID, nil)
		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, req)

		if rec.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d", rec.Code)
		}
	})
}
