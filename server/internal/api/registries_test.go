package api_test

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"gettako.dev/tako/internal/api"
	"gettako.dev/tako/internal/orchestrator"
	takov1 "gettako.dev/tako/proto/gen/go/tako/v1"
)

func TestRegistriesAPI(t *testing.T) {
	router, orch := setupTestRouter(t)
	ctx := context.Background()

	var createdID string

	t.Run("Create Registry", func(t *testing.T) {
		payload := api.CreateRegistryRequest{
			Name:      "GitHub Container Registry",
			ServerURL: "ghcr.io",
			Username:  "octocat",
			Password:  "ghp_secret_token_12345",
		}
		data, _ := json.Marshal(payload)
		req := httptest.NewRequest(http.MethodPost, "/api/v1/registries", bytes.NewReader(data))
		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, req)

		if rec.Code != http.StatusCreated {
			t.Fatalf("expected 201 Created, got %d: %s", rec.Code, rec.Body.String())
		}

		var res api.RegistryResponse
		if err := json.NewDecoder(rec.Body).Decode(&res); err != nil {
			t.Fatalf("failed to decode response: %v", err)
		}
		if res.ID == "" {
			t.Errorf("expected non-empty registry ID")
		}
		createdID = res.ID
		if res.Name != payload.Name {
			t.Errorf("expected name %s, got %s", payload.Name, res.Name)
		}
		if res.ServerURL != payload.ServerURL {
			t.Errorf("expected serverUrl %s, got %s", payload.ServerURL, res.ServerURL)
		}
		if res.Username != payload.Username {
			t.Errorf("expected username %s, got %s", payload.Username, res.Username)
		}
		if res.Password != "••••••••" {
			t.Errorf("expected masked password, got %s", res.Password)
		}
	})

	t.Run("List Registries", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/api/v1/registries", nil)
		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, req)

		if rec.Code != http.StatusOK {
			t.Fatalf("expected 200 OK, got %d", rec.Code)
		}

		var list []api.RegistryResponse
		if err := json.NewDecoder(rec.Body).Decode(&list); err != nil {
			t.Fatalf("failed to decode response: %v", err)
		}
		if len(list) == 0 {
			t.Fatalf("expected at least 1 registry")
		}
		found := false
		for _, reg := range list {
			if reg.ID == createdID {
				found = true
				if reg.Password != "••••••••" {
					t.Errorf("expected masked password in list, got %s", reg.Password)
				}
			}
		}
		if !found {
			t.Errorf("created registry %s not found in list", createdID)
		}
	})

	t.Run("Get Registry By ID", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/api/v1/registries/"+createdID, nil)
		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, req)

		if rec.Code != http.StatusOK {
			t.Fatalf("expected 200 OK, got %d", rec.Code)
		}

		var res api.RegistryResponse
		if err := json.NewDecoder(rec.Body).Decode(&res); err != nil {
			t.Fatalf("failed to decode response: %v", err)
		}
		if res.ID != createdID {
			t.Errorf("expected ID %s, got %s", createdID, res.ID)
		}
		if res.Password != "••••••••" {
			t.Errorf("expected masked password, got %s", res.Password)
		}
	})

	t.Run("Create Service with Registry and Verify Auth Attachment", func(t *testing.T) {
		// Register a node and agent session
		nodeID := "node-reg-test-01"
		_, err := orch.RegisterNode(ctx, &takov1.RegisterNodeRequest{
			NodeId:      nodeID,
			Name:        "Registry Test Node",
			EnrollToken: "test-enroll",
		})
		if err != nil {
			t.Fatalf("RegisterNode failed: %v", err)
		}

		taskChan := make(chan *takov1.MasterTask, 10)
		sess := orch.RegisterAgentSession(nodeID, taskChan)
		defer orch.UnregisterAgentSession(nodeID)

		srv, err := orch.CreateService(ctx, orchestrator.CreateServiceParams{
			ProjectID:  "proj-reg-test",
			NodeID:     nodeID,
			Name:       "Private App",
			Slug:       "private-app",
			Image:      "ghcr.io/octocat/my-private-app:latest",
			RegistryID: createdID,
		})
		if err != nil {
			t.Fatalf("CreateService failed: %v", err)
		}

		// Trigger deploy
		_, err = orch.TriggerDeploy(ctx, srv.ID)
		if err != nil {
			t.Fatalf("TriggerDeploy failed: %v", err)
		}

		var receivedTask *takov1.MasterTask
		select {
		case receivedTask = <-taskChan:
		case <-time.After(1 * time.Second):
			t.Fatalf("timed out waiting for deployment task dispatched to agent session")
		}

		deployReq := receivedTask.GetDeploy()
		if deployReq == nil {
			t.Fatalf("expected Deploy task")
		}
		if deployReq.GetEnvVars()["_TAKO_REGISTRY_AUTH"] == "" {
			t.Errorf("expected _TAKO_REGISTRY_AUTH to be populated for private registry service")
		}

		_ = sess // keep active
	})

	t.Run("Delete Registry", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodDelete, "/api/v1/registries/"+createdID, nil)
		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, req)

		if rec.Code != http.StatusOK {
			t.Fatalf("expected 200 OK, got %d", rec.Code)
		}

		// Verify 404
		reqGet := httptest.NewRequest(http.MethodGet, "/api/v1/registries/"+createdID, nil)
		recGet := httptest.NewRecorder()
		router.ServeHTTP(recGet, reqGet)
		if recGet.Code != http.StatusNotFound {
			t.Fatalf("expected 404 Not Found after delete, got %d", recGet.Code)
		}
	})
}
