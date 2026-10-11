package api

import (
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"
	"gettako.dev/tako/internal/events"
	"gettako.dev/tako/internal/orchestrator"
)

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
				w.Header().Set("Content-Type", "application/json")
				_ = json.NewEncoder(w).Encode(deps)
				return
			}
			deps, err := orch.Queries().ListRecentDeployments(r.Context(), 10)
			if err != nil {
				RespondError(w, http.StatusInternalServerError, err.Error())
				return
			}
			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(deps)
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

			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(dep)
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
