package api

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/exec"
	"sync"
	"time"

	"github.com/go-chi/chi/v5"

	"gettako.dev/tako/internal/orchestrator"
)

type SystemVersionResponse struct {
	CurrentVersion  string `json:"currentVersion"`
	LatestVersion   string `json:"latestVersion"`
	UpdateAvailable bool   `json:"updateAvailable"`
	ReleaseURL      string `json:"releaseUrl"`
	ReleaseNotes    string `json:"releaseNotes"`
	CheckedAt       string `json:"checkedAt"`
}

type SystemUpdateRequest struct {
	Target string `json:"target"` // "all", "console", "server", "agents"
}

type SystemUpdateResponse struct {
	Success           bool     `json:"success"`
	Message           string   `json:"message"`
	UpdatedComponents []string `json:"updatedComponents"`
}

var (
	versionCacheMu    sync.RWMutex
	cachedVersionInfo *SystemVersionResponse
	lastVersionCheck  time.Time
)

func getCurrentVersion() string {
	if v := os.Getenv("TAKO_VERSION"); v != "" {
		return v
	}
	return "v1.0.0"
}

func fetchLatestGitHubRelease(ctx context.Context) (string, string, string, error) {
	client := &http.Client{Timeout: 4 * time.Second}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, "https://api.github.com/repos/gettako/tako/releases/latest", nil)
	if err != nil {
		return "", "", "", err
	}
	req.Header.Set("User-Agent", "Tako-Platform-Updater")
	req.Header.Set("Accept", "application/vnd.github.v3+json")

	resp, err := client.Do(req)
	if err != nil {
		return "", "", "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return "", "", "", fmt.Errorf("github api returned status %d", resp.StatusCode)
	}

	var gh struct {
		TagName string `json:"tag_name"`
		HTMLURL string `json:"html_url"`
		Body    string `json:"body"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&gh); err != nil {
		return "", "", "", err
	}

	return gh.TagName, gh.HTMLURL, gh.Body, nil
}

func getOrCheckSystemVersion(ctx context.Context) SystemVersionResponse {
	versionCacheMu.RLock()
	if cachedVersionInfo != nil && time.Since(lastVersionCheck) < 10*time.Minute {
		res := *cachedVersionInfo
		versionCacheMu.RUnlock()
		return res
	}
	versionCacheMu.RUnlock()

	current := getCurrentVersion()
	latest := current
	releaseURL := "https://github.com/gettako/tako/releases"
	releaseNotes := "Running the current release."
	updateAvailable := false

	tag, url, body, err := fetchLatestGitHubRelease(ctx)
	if err == nil && tag != "" {
		latest = tag
		if url != "" {
			releaseURL = url
		}
		if body != "" {
			// Truncate long release notes if necessary
			if len(body) > 300 {
				releaseNotes = body[:297] + "..."
			} else {
				releaseNotes = body
			}
		}
		if latest != current && latest != "" {
			updateAvailable = true
		}
	}

	res := SystemVersionResponse{
		CurrentVersion:  current,
		LatestVersion:   latest,
		UpdateAvailable: updateAvailable,
		ReleaseURL:      releaseURL,
		ReleaseNotes:    releaseNotes,
		CheckedAt:       time.Now().UTC().Format(time.RFC3339),
	}

	versionCacheMu.Lock()
	cachedVersionInfo = &res
	lastVersionCheck = time.Now()
	versionCacheMu.Unlock()

	return res
}

func registerSystemRoutes(r chi.Router, orch *orchestrator.Orchestrator) {
	r.Route("/system", func(r chi.Router) {
		// GET /api/v1/system/version
		r.Get("/version", func(w http.ResponseWriter, r *http.Request) {
			info := getOrCheckSystemVersion(r.Context())
			RespondJSON(w, http.StatusOK, info)
		})

		// POST /api/v1/system/update
		r.Post("/update", func(w http.ResponseWriter, r *http.Request) {
			var req SystemUpdateRequest
			_ = json.NewDecoder(r.Body).Decode(&req)
			if req.Target == "" {
				req.Target = "all"
			}

			clientIP := extractRequestIP(r)
			_, _ = orch.RecordAudit(r.Context(), orchestrator.AuditLogInput{
				Action:     "system_update",
				TargetType: "cluster",
				TargetID:   "all",
				TargetName: "Tako Control Plane",
				IPAddress:  clientIP,
				Metadata: map[string]any{
					"target": req.Target,
				},
			})

			updatedComponents := []string{}

			// 1. Dispatch update-agent task to all connected worker nodes
			if req.Target == "all" || req.Target == "agents" {
				if nodes, err := orch.Queries().ListNodes(r.Context()); err == nil {
					for _, n := range nodes {
						_ = orch.DispatchContainerAction(r.Context(), n.ID, "tako-agent", "update-agent")
					}
				}
				updatedComponents = append(updatedComponents, "agents")
			}

			// 2. Control plane self-update
			if req.Target == "all" || req.Target == "server" || req.Target == "console" {
				updatedComponents = append(updatedComponents, "control-plane")
				go func() {
					time.Sleep(1 * time.Second)
					takoDir := os.Getenv("TAKO_DIR")
					if takoDir == "" {
						takoDir = "/opt/tako"
					}
					composeFile := fmt.Sprintf("%s/docker-compose.yml", takoDir)
					if _, err := os.Stat(composeFile); err == nil {
						log.Printf("[tako-server] initiating control plane update via docker compose...")
						cmd := fmt.Sprintf("cd %s && docker compose pull console server agent && docker compose up -d", takoDir)
						_ = exec.Command("sh", "-c", cmd).Run()
					}
				}()
			}

			RespondJSON(w, http.StatusOK, SystemUpdateResponse{
				Success:           true,
				Message:           "Update initiated successfully. Control plane and agents are updating in the background.",
				UpdatedComponents: updatedComponents,
			})
		})
	})
}
