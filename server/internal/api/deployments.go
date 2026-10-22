package api

import (
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"

	"gettako.dev/tako/internal/events"
	"gettako.dev/tako/internal/orchestrator"
	"gettako.dev/tako/internal/store/db"
	"github.com/go-chi/chi/v5"
)

// DeploymentResponse is the camelCase representation consumed by the console.
type DeploymentResponse struct {
	ID            string          `json:"id"`
	ServiceID     string          `json:"serviceId"`
	CommitHash    string          `json:"commitHash"`
	CommitMessage string          `json:"commitMessage"`
	Branch        string          `json:"branch"`
	Author        string          `json:"author"`
	Status        string          `json:"status"`
	URL           string          `json:"url"`
	Steps         json.RawMessage `json:"steps"`
	Logs          string          `json:"logs,omitempty"`
	DurationMS    int64           `json:"durationMs"`
	StartedAt     string          `json:"startedAt"`
	FinishedAt    string          `json:"finishedAt,omitempty"`
	CreatedAt     string          `json:"createdAt"`
}

func mapDeploymentToResponse(d db.Deployment) DeploymentResponse {
	steps := json.RawMessage(d.Steps)
	if len(steps) == 0 || !json.Valid(steps) {
		steps = json.RawMessage("[]")
	}
	finishedAt := ""
	if d.FinishedAt.Valid {
		finishedAt = d.FinishedAt.Time.UTC().Format(time.RFC3339)
	}
	return DeploymentResponse{
		ID:            d.ID,
		ServiceID:     d.ServiceID,
		CommitHash:    d.CommitHash,
		CommitMessage: d.CommitMessage,
		Branch:        d.Branch,
		Author:        d.Author,
		Status:        d.Status,
		URL:           d.Url,
		Steps:         steps,
		Logs:          d.Logs,
		DurationMS:    d.DurationMs,
		StartedAt:     d.StartedAt.UTC().Format(time.RFC3339),
		FinishedAt:    finishedAt,
		CreatedAt:     d.CreatedAt.UTC().Format(time.RFC3339),
	}
}

func mapDeploymentListRow(row db.ListDeploymentsWithServiceByServiceRow) DeploymentResponse {
	return mapDeploymentToResponse(db.Deployment{
		ID:            row.ID,
		ServiceID:     row.ServiceID,
		CommitHash:    row.CommitHash,
		CommitMessage: row.CommitMessage,
		Branch:        row.Branch,
		Author:        row.Author,
		Status:        row.Status,
		Url:           row.Url,
		Steps:         row.Steps,
		Logs:          row.Logs,
		DurationMs:    row.DurationMs,
		StartedAt:     row.StartedAt,
		FinishedAt:    row.FinishedAt,
		CreatedAt:     row.CreatedAt,
	})
}

func mapRecentDeploymentRow(row db.ListRecentDeploymentsRow) DeploymentResponse {
	return mapDeploymentToResponse(db.Deployment{
		ID:            row.ID,
		ServiceID:     row.ServiceID,
		CommitHash:    row.CommitHash,
		CommitMessage: row.CommitMessage,
		Branch:        row.Branch,
		Author:        row.Author,
		Status:        row.Status,
		Url:           row.Url,
		Steps:         row.Steps,
		Logs:          row.Logs,
		DurationMs:    row.DurationMs,
		StartedAt:     row.StartedAt,
		FinishedAt:    row.FinishedAt,
		CreatedAt:     row.CreatedAt,
	})
}

func registerDeploymentRoutes(r chi.Router, orch *orchestrator.Orchestrator) {
	r.Route("/deployments", func(r chi.Router) {
		// GET /api/v1/deployments?serviceId=...
		r.Get("/", func(w http.ResponseWriter, r *http.Request) {
			serviceID := r.URL.Query().Get("serviceId")
			if serviceID != "" {
				deps, err := orch.Queries().ListDeploymentsWithServiceByService(r.Context(), serviceID)
				if err != nil {
					RespondError(w, http.StatusInternalServerError, err.Error())
					return
				}
				resp := make([]DeploymentResponse, 0, len(deps))
				for _, dep := range deps {
					resp = append(resp, mapDeploymentListRow(dep))
				}
				RespondJSON(w, http.StatusOK, resp)
				return
			}
			deps, err := orch.Queries().ListRecentDeployments(r.Context(), 10)
			if err != nil {
				RespondError(w, http.StatusInternalServerError, err.Error())
				return
			}
			resp := make([]DeploymentResponse, 0, len(deps))
			for _, dep := range deps {
				resp = append(resp, mapRecentDeploymentRow(dep))
			}
			RespondJSON(w, http.StatusOK, resp)
		})

		// GET /api/v1/deployments/{id}
		r.Get("/{id}", func(w http.ResponseWriter, r *http.Request) {
			id := chi.URLParam(r, "id")
			dep, err := orch.GetDeployment(r.Context(), id)
			if err != nil {
				if errors.Is(err, sql.ErrNoRows) {
					RespondError(w, http.StatusNotFound, "deployment not found")
					return
				}
				RespondError(w, http.StatusInternalServerError, err.Error())
				return
			}

			RespondJSON(w, http.StatusOK, mapDeploymentToResponse(dep))
		})

		// POST /api/v1/deployments/{id}/rollback
		r.Post("/{id}/rollback", func(w http.ResponseWriter, r *http.Request) {
			id := chi.URLParam(r, "id")
			dep, err := orch.RollbackDeployment(r.Context(), id)
			if err != nil {
				RespondError(w, http.StatusInternalServerError, err.Error())
				return
			}

			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusAccepted)
			_ = json.NewEncoder(w).Encode(map[string]string{
				"deploymentId": dep.ID,
				"status":       dep.Status,
			})
		})

		// GET /api/v1/deployments/{id}/logs (SSE)
		r.Get("/{id}/logs", func(w http.ResponseWriter, r *http.Request) {
			id := chi.URLParam(r, "id")
			dep, err := orch.GetDeployment(r.Context(), id)
			if err != nil {
				RespondError(w, http.StatusNotFound, "deployment not found")
				return
			}

			flusher, ok := w.(http.Flusher)
			if !ok {
				RespondError(w, http.StatusInternalServerError, "Streaming unsupported")
				return
			}

			w.Header().Set("Content-Type", "text/event-stream")
			w.Header().Set("Cache-Control", "no-cache")
			w.Header().Set("Connection", "keep-alive")
			w.Header().Set("X-Accel-Buffering", "no")

			// Initial logs
			if dep.Logs != "" {
				lines := strings.Split(dep.Logs, "\n")
				for _, line := range lines {
					trimmed := strings.TrimSpace(line)
					if trimmed != "" {
						chunk, _ := json.Marshal(map[string]any{
							"deployment_id": id,
							"step":          "Log",
							"message":       trimmed,
							"status":        dep.Status,
						})
						_, _ = fmt.Fprintf(w, "event: log\ndata: %s\n\n", chunk)
					}
				}
				flusher.Flush()
			}

			// If already terminal state, emit terminal event and return
			if dep.Status == "live" || dep.Status == "failed" {
				terminalMsg, _ := json.Marshal(map[string]any{
					"deployment_id": id,
					"status":        dep.Status,
					"step":          "Live",
					"done":          true,
				})
				_, _ = fmt.Fprintf(w, "event: log\ndata: %s\n\n", terminalMsg)
				flusher.Flush()
				return
			}

			sub := orch.Bus().Subscribe()
			defer orch.Bus().Unsubscribe(sub)

			ctx := r.Context()
			for {
				select {
				case <-ctx.Done():
					return
				case ev, ok := <-sub:
					if !ok {
						return
					}
					if ev.Type == events.EventDeploymentLog {
						if p, ok := ev.Payload.(map[string]any); ok && p["deployment_id"] == id {
							data, _ := json.Marshal(p)
							_, _ = fmt.Fprintf(w, "event: log\ndata: %s\n\n", data)
							flusher.Flush()

							if p["step"] == "Live" || p["status"] == "live" || p["status"] == "failed" || p["is_error"] == true {
								return
							}
						}
					}
				}
			}
		})

		// GET /api/v1/deployments/{id}/logs/history
		r.Get("/{id}/logs/history", func(w http.ResponseWriter, r *http.Request) {
			id := chi.URLParam(r, "id")
			dep, err := orch.GetDeployment(r.Context(), id)
			if err != nil {
				RespondError(w, http.StatusNotFound, "deployment not found")
				return
			}

			w.Header().Set("Content-Type", "text/plain")
			_, _ = w.Write([]byte(dep.Logs))
		})
	})
}
