package api_test

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"gettako.dev/tako/internal/api"
	"gettako.dev/tako/internal/orchestrator"
	"gettako.dev/tako/internal/store/db"
)

func TestGitHubAppAPI(t *testing.T) {
	router, orch := setupTestRouter(t)
	ctx := context.Background()

	// 1. GET /api/v1/github/manifest
	t.Run("Generate Manifest", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/api/v1/github/manifest?baseUrl=https://console.gettako.dev&appName=TakoCluster", nil)
		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, req)

		if rec.Code != http.StatusOK {
			t.Fatalf("expected 200 OK, got %d: %s", rec.Code, rec.Body.String())
		}

		var manifest api.GitHubAppManifest
		if err := json.NewDecoder(rec.Body).Decode(&manifest); err != nil {
			t.Fatalf("failed to decode manifest: %v", err)
		}

		if manifest.Name != "TakoCluster" {
			t.Errorf("expected name TakoCluster, got %s", manifest.Name)
		}
		if manifest.URL != "https://console.gettako.dev" {
			t.Errorf("expected url https://console.gettako.dev, got %s", manifest.URL)
		}
		if manifest.HookAttributes.URL != "https://console.gettako.dev/api/webhooks/github" {
			t.Errorf("expected webhook url, got %s", manifest.HookAttributes.URL)
		}
		if bytes.Contains(rec.Body.Bytes(), []byte(`"slug"`)) {
			t.Errorf("manifest json must not contain slug field (GitHub App manifest rejects slug)")
		}
		if manifest.DefaultPermissions["contents"] != "read" {
			t.Errorf("expected contents:read permission")
		}
	})

	// 2. GET /api/v1/github/app (Initially disconnected)
	t.Run("Initially Disconnected", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/api/v1/github/app", nil)
		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, req)

		if rec.Code != http.StatusOK {
			t.Fatalf("expected 200 OK, got %d", rec.Code)
		}

		var res map[string]any
		_ = json.NewDecoder(rec.Body).Decode(&res)
		if res["connected"] != false {
			t.Fatalf("expected connected false, got %+v", res)
		}
	})

	// 3. POST /api/v1/github/manifest/convert
	var appID int64
	t.Run("Convert Manifest Code", func(t *testing.T) {
		payload := map[string]string{"code": "mock-test-code-123"}
		data, _ := json.Marshal(payload)
		req := httptest.NewRequest(http.MethodPost, "/api/v1/github/manifest/convert", bytes.NewReader(data))
		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, req)

		if rec.Code != http.StatusCreated {
			t.Fatalf("expected 201 Created, got %d: %s", rec.Code, rec.Body.String())
		}

		var res api.GitHubAppPublicResponse
		if err := json.NewDecoder(rec.Body).Decode(&res); err != nil {
			t.Fatalf("failed to decode converted app response: %v", err)
		}

		if res.AppID <= 0 || !res.Connected {
			t.Fatalf("invalid converted app: %+v", res)
		}
		if res.InstallURL == "" {
			t.Fatalf("expected installUrl to be populated")
		}
		appID = res.AppID
	})

	// 4. GET /api/v1/github/app (Now connected)
	t.Run("Get Connected App", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/api/v1/github/app", nil)
		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, req)

		if rec.Code != http.StatusOK {
			t.Fatalf("expected 200 OK, got %d", rec.Code)
		}

		var res api.GitHubAppPublicResponse
		_ = json.NewDecoder(rec.Body).Decode(&res)
		if res.AppID != appID || !res.Connected {
			t.Fatalf("expected connected app %d, got %+v", appID, res)
		}
	})

	// 5. POST /api/v1/github/installations/sync
	t.Run("Sync Installations", func(t *testing.T) {
		payload := map[string]int64{"installationId": 54321}
		data, _ := json.Marshal(payload)
		req := httptest.NewRequest(http.MethodPost, "/api/v1/github/installations/sync", bytes.NewReader(data))
		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, req)

		if rec.Code != http.StatusOK {
			t.Fatalf("expected 200 OK, got %d: %s", rec.Code, rec.Body.String())
		}

		var repos []map[string]any
		_ = json.NewDecoder(rec.Body).Decode(&repos)
		if len(repos) == 0 {
			t.Fatalf("expected synced repos to be returned")
		}
	})

	// 6. POST /api/v1/webhooks/github (Ping)
	t.Run("Webhook Ping", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodPost, "/api/v1/webhooks/github", bytes.NewReader([]byte(`{}`)))
		req.Header.Set("X-GitHub-Event", "ping")
		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, req)

		if rec.Code != http.StatusOK {
			t.Fatalf("expected 200 OK, got %d: %s", rec.Code, rec.Body.String())
		}
		var res map[string]any
		_ = json.NewDecoder(rec.Body).Decode(&res)
		if res["status"] != "ok" {
			t.Fatalf("expected status ok for ping, got %+v", res)
		}
	})

	// 7. POST /api/v1/webhooks/github (Push event triggers deploy)
	t.Run("Webhook Push Trigger Deploy", func(t *testing.T) {
		_, _ = orch.Queries().CreateProject(ctx, db.CreateProjectParams{
			ID:          "prj-gh-test",
			Name:        "GH Project",
			Slug:        "gh-project",
			Environment: "production",
			Status:      "healthy",
			Tags:        "[]",
		})
		srv, err := orch.CreateService(ctx, orchestrator.CreateServiceParams{
			ProjectID:  "prj-gh-test",
			NodeID:     "node-control",
			Name:       "GH Service",
			Slug:       "gh-service",
			Type:       "app",
			Repository: "https://github.com/TakōAdmin/backend-api.git",
			Branch:     "main",
		})
		if err != nil {
			t.Fatalf("failed to create service: %v", err)
		}

		pushBody := `{
			"ref": "refs/heads/main",
			"repository": {
				"clone_url": "https://github.com/TakōAdmin/backend-api.git",
				"full_name": "TakōAdmin/backend-api"
			},
			"head_commit": {
				"id": "commit9876543210",
				"message": "fix: update production api"
			}
		}`

		req := httptest.NewRequest(http.MethodPost, "/api/v1/webhooks/github", bytes.NewReader([]byte(pushBody)))
		req.Header.Set("X-GitHub-Event", "push")
		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, req)

		if rec.Code != http.StatusOK {
			t.Fatalf("expected 200 OK, got %d: %s", rec.Code, rec.Body.String())
		}

		var res map[string]any
		_ = json.NewDecoder(rec.Body).Decode(&res)
		if res["deployed"] != true || res["serviceId"] != srv.ID {
			t.Fatalf("expected automated deployment triggered, got %+v", res)
		}
	})

	// 8. DELETE /api/v1/github/app (Disconnect)
	t.Run("Disconnect App", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodDelete, "/api/v1/github/app", nil)
		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, req)

		if rec.Code != http.StatusOK {
			t.Fatalf("expected 200 OK, got %d: %s", rec.Code, rec.Body.String())
		}

		// Verify disconnected
		reqGet := httptest.NewRequest(http.MethodGet, "/api/v1/github/app", nil)
		recGet := httptest.NewRecorder()
		router.ServeHTTP(recGet, reqGet)

		var res map[string]any
		_ = json.NewDecoder(recGet.Body).Decode(&res)
		if res["connected"] != false {
			t.Fatalf("expected connected false after disconnect, got %+v", res)
		}
	})
}
