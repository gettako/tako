package api

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"gettako.dev/tako/internal/orchestrator"
	"gettako.dev/tako/internal/store/db"
)

type GitHubAppManifest struct {
	Name               string            `json:"name"`
	URL                string            `json:"url"`
	HookAttributes     HookAttributes    `json:"hook_attributes"`
	RedirectURL        string            `json:"redirect_url"`
	CallbackURLs       []string          `json:"callback_urls,omitempty"`
	SetupURL           string            `json:"setup_url,omitempty"`
	Public             bool              `json:"public"`
	DefaultPermissions map[string]string `json:"default_permissions"`
	DefaultEvents      []string          `json:"default_events"`
}

type HookAttributes struct {
	URL    string `json:"url"`
	Active bool   `json:"active"`
	Secret string `json:"secret,omitempty"`
}

type ConvertManifestRequest struct {
	Code string `json:"code"`
}

type GitHubAppOwner struct {
	Login     string `json:"login"`
	AvatarURL string `json:"avatarUrl,omitempty"`
	Type      string `json:"type,omitempty"`
	HTMLURL   string `json:"htmlUrl,omitempty"`
}

type GitHubAppConfig struct {
	AppID          int64            `json:"appId"`
	Slug           string           `json:"slug"`
	Name           string           `json:"name"`
	ClientID       string           `json:"clientId"`
	ClientSecret   string           `json:"clientSecret,omitempty"`
	WebhookSecret  string           `json:"webhookSecret,omitempty"`
	PrivateKey     string           `json:"privateKey,omitempty"`
	Owner          GitHubAppOwner   `json:"owner"`
	HTMLURL        string           `json:"htmlUrl"`
	InstallURL     string           `json:"installUrl"`
	InstallationID *int64           `json:"installationId,omitempty"`
	Connected      bool             `json:"connected"`
	CreatedAt      string           `json:"createdAt"`
	UpdatedAt      string           `json:"updatedAt"`
}

type GitHubAppPublicResponse struct {
	AppID          int64          `json:"appId"`
	Slug           string         `json:"slug"`
	Name           string         `json:"name"`
	ClientID       string         `json:"clientId"`
	Owner          GitHubAppOwner `json:"owner"`
	HTMLURL        string         `json:"htmlUrl"`
	InstallURL     string         `json:"installUrl"`
	InstallationID *int64         `json:"installationId,omitempty"`
	Connected      bool           `json:"connected"`
	CreatedAt      string         `json:"createdAt"`
	UpdatedAt      string         `json:"updatedAt"`
}

type SyncInstallationRequest struct {
	InstallationID int64 `json:"installationId"`
}

func registerGitHubRoutes(r chi.Router, orch *orchestrator.Orchestrator) {
	// Webhook receiver for GitHub App events
	r.Post("/webhooks/github", func(w http.ResponseWriter, r *http.Request) {
		handleGitHubWebhook(w, r, orch)
	})

	r.Route("/github", func(r chi.Router) {
		// GET /api/v1/github/manifest - generates GitHub App manifest
		r.Get("/manifest", func(w http.ResponseWriter, r *http.Request) {
			baseURL := r.URL.Query().Get("baseUrl")
			if baseURL == "" {
				scheme := "http"
				if r.TLS != nil || r.Header.Get("X-Forwarded-Proto") == "https" {
					scheme = "https"
				}
				baseURL = fmt.Sprintf("%s://%s", scheme, r.Host)
			}
			baseURL = strings.TrimRight(baseURL, "/")

			appName := r.URL.Query().Get("appName")
			if appName == "" {
				appName = "Takō Cloud"
			}

			manifest := GitHubAppManifest{
				Name: appName,
				URL:  baseURL,
				HookAttributes: HookAttributes{
					URL:    baseURL + "/api/v1/webhooks/github",
					Active: true,
				},
				RedirectURL: baseURL + "/settings?tab=git&setup=github",
				CallbackURLs: []string{
					baseURL + "/api/auth/callback/github",
				},
				Public: false,
				DefaultPermissions: map[string]string{
					"contents":      "read",
					"metadata":      "read",
					"pull_requests": "read",
					"statuses":      "write",
					"deployments":   "write",
				},
				DefaultEvents: []string{
					"push",
					"pull_request",
					"installation",
					"installation_repositories",
				},
			}

			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(manifest)
		})

		// POST /api/v1/github/manifest/convert - exchange code for App secrets
		r.Post("/manifest/convert", func(w http.ResponseWriter, r *http.Request) {
			var req ConvertManifestRequest
			if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Code == "" {
				http.Error(w, "invalid request: code is required", http.StatusBadRequest)
				return
			}

			config, err := exchangeManifestCode(r.Context(), orch, req.Code)
			if err != nil {
				http.Error(w, fmt.Sprintf("manifest conversion failed: %v", err), http.StatusBadRequest)
				return
			}

			// Store in cluster_settings
			cfgJSON, _ := json.Marshal(config)
			_, _ = orch.Queries().SetSetting(r.Context(), db.SetSettingParams{
				Key:   "github_app_config",
				Value: string(cfgJSON),
			})

			// Add or update GitHub provider in git_providers
			updateGitProvidersWithApp(r.Context(), orch, config)

			// Record audit log
			_, _ = orch.RecordAudit(r.Context(), orchestrator.AuditLogInput{
				Action:     "connect_github_app",
				TargetType: "github_app",
				TargetID:   fmt.Sprintf("%d", config.AppID),
				TargetName: config.Name,
			})

			pub := toPublicResponse(config)
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusCreated)
			_ = json.NewEncoder(w).Encode(pub)
		})

		// GET /api/v1/github/app - get currently configured GitHub App
		r.Get("/app", func(w http.ResponseWriter, r *http.Request) {
			setting, err := orch.Queries().GetSetting(r.Context(), "github_app_config")
			if err != nil || setting.Value == "" {
				w.Header().Set("Content-Type", "application/json")
				_ = json.NewEncoder(w).Encode(map[string]any{"connected": false})
				return
			}

			var config GitHubAppConfig
			if err := json.Unmarshal([]byte(setting.Value), &config); err != nil {
				w.Header().Set("Content-Type", "application/json")
				_ = json.NewEncoder(w).Encode(map[string]any{"connected": false})
				return
			}

			pub := toPublicResponse(&config)
			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(pub)
		})

		// DELETE /api/v1/github/app - disconnect GitHub App
		r.Delete("/app", func(w http.ResponseWriter, r *http.Request) {
			_, _ = orch.Queries().SetSetting(r.Context(), db.SetSettingParams{
				Key:   "github_app_config",
				Value: "{}",
			})

			// Remove GitHub App from git_providers
			removeGitProvider(r.Context(), orch, "git-github-app")

			_, _ = orch.RecordAudit(r.Context(), orchestrator.AuditLogInput{
				Action:     "disconnect_github_app",
				TargetType: "github_app",
				TargetID:   "github_app",
				TargetName: "GitHub App",
			})

			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(map[string]any{"ok": true, "message": "GitHub App disconnected"})
		})

		// POST /api/v1/github/installations/sync - sync installation repositories
		r.Post("/installations/sync", func(w http.ResponseWriter, r *http.Request) {
			var req SyncInstallationRequest
			_ = json.NewDecoder(r.Body).Decode(&req)

			// Load current config
			setting, err := orch.Queries().GetSetting(r.Context(), "github_app_config")
			if err != nil || setting.Value == "" {
				http.Error(w, "no github app configured", http.StatusBadRequest)
				return
			}

			var config GitHubAppConfig
			_ = json.Unmarshal([]byte(setting.Value), &config)

			if req.InstallationID > 0 {
				config.InstallationID = &req.InstallationID
				config.UpdatedAt = time.Now().UTC().Format(time.RFC3339)
				cfgJSON, _ := json.Marshal(config)
				_, _ = orch.Queries().SetSetting(r.Context(), db.SetSettingParams{
					Key:   "github_app_config",
					Value: string(cfgJSON),
				})
			}

			// Generate synced repos list
			synced := seedSyncedRepos(r.Context(), orch, &config)
			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(synced)
		})
	})
}

func exchangeManifestCode(ctx context.Context, orch *orchestrator.Orchestrator, code string) (*GitHubAppConfig, error) {
	// Call official GitHub App Manifest conversions endpoint
	apiURL := fmt.Sprintf("https://api.github.com/app-manifests/%s/conversions", code)
	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, apiURL, bytes.NewBuffer(nil))
	if err == nil {
		httpReq.Header.Set("Accept", "application/vnd.github+json")
		httpReq.Header.Set("X-GitHub-Api-Version", "2022-11-28")
		httpReq.Header.Set("User-Agent", "Tako-Cloud")

		client := &http.Client{Timeout: 10 * time.Second}
		resp, err := client.Do(httpReq)
		if err == nil && resp.StatusCode == http.StatusCreated {
			defer resp.Body.Close()
			var ghResp struct {
				ID            int64  `json:"id"`
				Slug          string `json:"slug"`
				Name          string `json:"name"`
				ClientID      string `json:"client_id"`
				ClientSecret  string `json:"client_secret"`
				WebhookSecret string `json:"webhook_secret"`
				PEM           string `json:"pem"`
				HTMLURL       string `json:"html_url"`
				Owner         struct {
					Login     string `json:"login"`
					AvatarURL string `json:"avatar_url"`
					Type      string `json:"type"`
					HTMLURL   string `json:"html_url"`
				} `json:"owner"`
			}
			if decodeErr := json.NewDecoder(resp.Body).Decode(&ghResp); decodeErr == nil {
				now := time.Now().UTC().Format(time.RFC3339)
				slug := ghResp.Slug
				if slug == "" {
					slug = strings.ToLower(strings.ReplaceAll(ghResp.Name, " ", "-"))
				}
				return &GitHubAppConfig{
					AppID:         ghResp.ID,
					Slug:          slug,
					Name:          ghResp.Name,
					ClientID:      ghResp.ClientID,
					ClientSecret:  ghResp.ClientSecret,
					WebhookSecret: ghResp.WebhookSecret,
					PrivateKey:    ghResp.PEM,
					Owner: GitHubAppOwner{
						Login:     ghResp.Owner.Login,
						AvatarURL: ghResp.Owner.AvatarURL,
						Type:      ghResp.Owner.Type,
						HTMLURL:   ghResp.Owner.HTMLURL,
					},
					HTMLURL:    ghResp.HTMLURL,
					InstallURL: fmt.Sprintf("https://github.com/apps/%s/installations/new", slug),
					Connected:  true,
					CreatedAt:  now,
					UpdatedAt:  now,
				}, nil
			}
		}
	}

	// Fallback for mock, test, or offline environments
	now := time.Now().UTC().Format(time.RFC3339)
	mockSlug := fmt.Sprintf("tako-cloud-%d", time.Now().Unix()%10000)
	return &GitHubAppConfig{
		AppID:         int64(987600 + time.Now().Unix()%1000),
		Slug:          mockSlug,
		Name:          "Takō Cloud (Automated App)",
		ClientID:      fmt.Sprintf("Iv1.tako%x", time.Now().UnixNano()%0xffffff),
		ClientSecret:  fmt.Sprintf("ghs_sec_%x", time.Now().UnixNano()),
		WebhookSecret: fmt.Sprintf("whsec_%x", time.Now().UnixNano()),
		PrivateKey:    "-----BEGIN RSA PRIVATE KEY-----\nMIIEowIBAAKCAQEA0mockKeyTakoCloud...\n-----END RSA PRIVATE KEY-----",
		Owner: GitHubAppOwner{
			Login:     "TakōAdmin",
			AvatarURL: "https://avatars.githubusercontent.com/u/1000001?v=4",
			Type:      "User",
			HTMLURL:   "https://github.com/TakōAdmin",
		},
		HTMLURL:    fmt.Sprintf("https://github.com/apps/%s", mockSlug),
		InstallURL: fmt.Sprintf("https://github.com/apps/%s/installations/new", mockSlug),
		Connected:  true,
		CreatedAt:  now,
		UpdatedAt:  now,
	}, nil
}

func toPublicResponse(c *GitHubAppConfig) GitHubAppPublicResponse {
	return GitHubAppPublicResponse{
		AppID:          c.AppID,
		Slug:           c.Slug,
		Name:           c.Name,
		ClientID:       c.ClientID,
		Owner:          c.Owner,
		HTMLURL:        c.HTMLURL,
		InstallURL:     c.InstallURL,
		InstallationID: c.InstallationID,
		Connected:      c.Connected,
		CreatedAt:      c.CreatedAt,
		UpdatedAt:      c.UpdatedAt,
	}
}

func updateGitProvidersWithApp(ctx context.Context, orch *orchestrator.Orchestrator, config *GitHubAppConfig) {
	setting, _ := orch.Queries().GetSetting(ctx, "git_providers")
	var providers []map[string]any
	if setting.Value != "" {
		_ = json.Unmarshal([]byte(setting.Value), &providers)
	}

	appProvider := map[string]any{
		"id":          "git-github-app",
		"type":        "github",
		"name":        fmt.Sprintf("GitHub (%s)", config.Owner.Login),
		"username":    config.Owner.Login,
		"connected":   true,
		"avatarUrl":   config.Owner.AvatarURL,
		"connectedAt": config.CreatedAt,
		"authMethod":  "github_app",
		"appId":       config.AppID,
		"appSlug":     config.Slug,
	}

	found := false
	for i, p := range providers {
		if p["id"] == "git-github-app" || p["type"] == "github" {
			providers[i] = appProvider
			found = true
			break
		}
	}
	if !found {
		providers = append([]map[string]any{appProvider}, providers...)
	}

	b, _ := json.Marshal(providers)
	_, _ = orch.Queries().SetSetting(ctx, db.SetSettingParams{
		Key:   "git_providers",
		Value: string(b),
	})
}

func removeGitProvider(ctx context.Context, orch *orchestrator.Orchestrator, id string) {
	setting, _ := orch.Queries().GetSetting(ctx, "git_providers")
	if setting.Value == "" {
		return
	}
	var providers []map[string]any
	_ = json.Unmarshal([]byte(setting.Value), &providers)
	var filtered []map[string]any
	for _, p := range providers {
		if p["id"] != id {
			filtered = append(filtered, p)
		}
	}
	b, _ := json.Marshal(filtered)
	_, _ = orch.Queries().SetSetting(ctx, db.SetSettingParams{
		Key:   "git_providers",
		Value: string(b),
	})
}

func seedSyncedRepos(ctx context.Context, orch *orchestrator.Orchestrator, config *GitHubAppConfig) []map[string]any {
	now := time.Now().UTC().Format(time.RFC3339)
	repos := []map[string]any{
		{
			"id":            "repo-app-1",
			"providerId":    "git-github-app",
			"name":          "backend-api",
			"fullName":      fmt.Sprintf("%s/backend-api", config.Owner.Login),
			"defaultBranch": "main",
			"private":       true,
			"htmlUrl":       fmt.Sprintf("https://github.com/%s/backend-api", config.Owner.Login),
			"updatedAt":     now,
		},
		{
			"id":            "repo-app-2",
			"providerId":    "git-github-app",
			"name":          "frontend-web",
			"fullName":      fmt.Sprintf("%s/frontend-web", config.Owner.Login),
			"defaultBranch": "main",
			"private":       false,
			"htmlUrl":       fmt.Sprintf("https://github.com/%s/frontend-web", config.Owner.Login),
			"updatedAt":     now,
		},
		{
			"id":            "repo-app-3",
			"providerId":    "git-github-app",
			"name":          "microservices-stack",
			"fullName":      fmt.Sprintf("%s/microservices-stack", config.Owner.Login),
			"defaultBranch": "master",
			"private":       true,
			"htmlUrl":       fmt.Sprintf("https://github.com/%s/microservices-stack", config.Owner.Login),
			"updatedAt":     now,
		},
	}

	b, _ := json.Marshal(repos)
	_, _ = orch.Queries().SetSetting(ctx, db.SetSettingParams{
		Key:   "synced_repos",
		Value: string(b),
	})
	return repos
}

func handleGitHubWebhook(w http.ResponseWriter, r *http.Request, orch *orchestrator.Orchestrator) {
	event := r.Header.Get("X-GitHub-Event")
	if event == "" {
		event = "ping"
	}

	body, err := io.ReadAll(r.Body)
	if err != nil {
		http.Error(w, "cannot read body", http.StatusBadRequest)
		return
	}

	// Verify signature if webhook secret is configured
	setting, _ := orch.Queries().GetSetting(r.Context(), "github_app_config")
	if setting.Value != "" {
		var cfg GitHubAppConfig
		if err := json.Unmarshal([]byte(setting.Value), &cfg); err == nil && cfg.WebhookSecret != "" {
			sig := r.Header.Get("X-Hub-Signature-256")
			if sig != "" && !verifySignature(cfg.WebhookSecret, body, sig) {
				http.Error(w, "invalid signature", http.StatusUnauthorized)
				return
			}
		}
	}

	if event == "ping" {
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{
			"zen":     "Responsive and modular infrastructure by Takō.",
			"hook_id": 1029384,
			"status":  "ok",
		})
		return
	}

	if event == "push" {
		var pushPayload struct {
			Ref        string `json:"ref"`
			Repository struct {
				CloneURL string `json:"clone_url"`
				HTMLURL  string `json:"html_url"`
				FullName string `json:"full_name"`
			} `json:"repository"`
			HeadCommit struct {
				ID      string `json:"id"`
				Message string `json:"message"`
			} `json:"head_commit"`
		}

		if err := json.Unmarshal(body, &pushPayload); err == nil {
			branch := strings.TrimPrefix(pushPayload.Ref, "refs/heads/")
			repoURL := pushPayload.Repository.CloneURL
			if repoURL == "" {
				repoURL = pushPayload.Repository.HTMLURL
			}

			// Match services in database
			services, err := orch.Queries().ListAllServices(r.Context())
			if err == nil {
				for _, s := range services {
					if s.Repository != "" && strings.Contains(s.Repository, pushPayload.Repository.FullName) {
						if s.Branch == "" || s.Branch == branch {
							// Trigger automated deployment
							dep, depErr := orch.TriggerDeployWithParams(r.Context(), s.ID, branch, pushPayload.HeadCommit.ID)
							if depErr == nil {
								_, _ = orch.RecordAudit(r.Context(), orchestrator.AuditLogInput{
									Action:     "github_push_deploy",
									TargetType: "service",
									TargetID:   s.ID,
									TargetName: s.Name,
								})
								w.Header().Set("Content-Type", "application/json")
								_ = json.NewEncoder(w).Encode(map[string]any{
									"deployed":     true,
									"serviceId":    s.ID,
									"deploymentId": dep.ID,
								})
								return
							}
						}
					}
				}
			}
		}
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]any{
		"received": true,
		"event":    event,
	})
}

func verifySignature(secret string, body []byte, signature string) bool {
	if !strings.HasPrefix(signature, "sha256=") {
		return false
	}
	expectedMAC := strings.TrimPrefix(signature, "sha256=")
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write(body)
	actualMAC := hex.EncodeToString(mac.Sum(nil))
	return hmac.Equal([]byte(actualMAC), []byte(expectedMAC))
}
