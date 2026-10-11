package api_test

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
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
		for _, ev := range manifest.DefaultEvents {
			if ev == "installation" || ev == "installation_repositories" {
				t.Errorf("default_events must not contain lifecycle event %s (rejected by GitHub)", ev)
			}
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
		setting, _ := orch.Queries().GetSetting(ctx, "github_app_config")
		var cfg struct {
			WebhookSecret string `json:"webhookSecret"`
		}
		_ = json.Unmarshal([]byte(setting.Value), &cfg)

		pingBody := []byte(`{}`)
		mac := hmac.New(sha256.New, []byte(cfg.WebhookSecret))
		mac.Write(pingBody)
		sig := "sha256=" + hex.EncodeToString(mac.Sum(nil))

		req := httptest.NewRequest(http.MethodPost, "/api/v1/webhooks/github", bytes.NewReader(pingBody))
		req.Header.Set("X-GitHub-Event", "ping")
		req.Header.Set("X-Hub-Signature-256", sig)
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
		setting, _ := orch.Queries().GetSetting(ctx, "github_app_config")
		var cfg struct {
			WebhookSecret string `json:"webhookSecret"`
		}
		_ = json.Unmarshal([]byte(setting.Value), &cfg)

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

		pushBody := []byte(`{
			"ref": "refs/heads/main",
			"repository": {
				"clone_url": "https://github.com/TakōAdmin/backend-api.git",
				"full_name": "TakōAdmin/backend-api"
			},
			"head_commit": {
				"id": "commit9876543210",
				"message": "fix: update production api"
			}
		}`)

		mac := hmac.New(sha256.New, []byte(cfg.WebhookSecret))
		mac.Write(pushBody)
		sig := "sha256=" + hex.EncodeToString(mac.Sum(nil))

		req := httptest.NewRequest(http.MethodPost, "/api/v1/webhooks/github", bytes.NewReader(pushBody))
		req.Header.Set("X-GitHub-Event", "push")
		req.Header.Set("X-Hub-Signature-256", sig)
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

	// 9. Webhook signature enforcement test
	t.Run("Webhook Signature Enforcement", func(t *testing.T) {
		secret := "my-webhook-secret"
		_, _ = orch.Queries().SetSetting(ctx, db.SetSettingParams{
			Key:   "github_webhook_secret",
			Value: secret,
		})

		body := []byte(`{"zen":"hello"}`)
		// Missing signature -> must be 401
		reqUnsigned := httptest.NewRequest(http.MethodPost, "/api/v1/webhooks/github", bytes.NewReader(body))
		reqUnsigned.Header.Set("X-GitHub-Event", "ping")
		recUnsigned := httptest.NewRecorder()
		router.ServeHTTP(recUnsigned, reqUnsigned)
		if recUnsigned.Code != http.StatusUnauthorized {
			t.Fatalf("expected 401 for unsigned webhook, got %d", recUnsigned.Code)
		}

		// Invalid signature -> must be 401
		reqBad := httptest.NewRequest(http.MethodPost, "/api/v1/webhooks/github", bytes.NewReader(body))
		reqBad.Header.Set("X-GitHub-Event", "ping")
		reqBad.Header.Set("X-Hub-Signature-256", "sha256=invalid")
		recBad := httptest.NewRecorder()
		router.ServeHTTP(recBad, reqBad)
		if recBad.Code != http.StatusUnauthorized {
			t.Fatalf("expected 401 for bad signature, got %d", recBad.Code)
		}

		// Valid signature -> must be 200
		mac := hmac.New(sha256.New, []byte(secret))
		mac.Write(body)
		validSig := "sha256=" + hex.EncodeToString(mac.Sum(nil))

		reqValid := httptest.NewRequest(http.MethodPost, "/api/v1/webhooks/github", bytes.NewReader(body))
		reqValid.Header.Set("X-GitHub-Event", "ping")
		reqValid.Header.Set("X-Hub-Signature-256", validSig)
		recValid := httptest.NewRecorder()
		router.ServeHTTP(recValid, reqValid)
		if recValid.Code != http.StatusOK {
			t.Fatalf("expected 200 for valid signature, got %d: %s", recValid.Code, recValid.Body.String())
		}
	})
}

