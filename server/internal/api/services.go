package api

import (
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"

	"github.com/go-chi/chi/v5"
	"gettako.dev/tako/internal/events"
	"gettako.dev/tako/internal/orchestrator"
	"gettako.dev/tako/internal/store/db"
)

type CreateServiceRequest struct {
	ProjectID       string            `json:"projectId"`
	NodeID          string            `json:"nodeId"`
	Name            string            `json:"name"`
	Slug            string            `json:"slug"`
	Type            string            `json:"type"`
	Repository      string            `json:"repository"`
	Branch          string            `json:"branch"`
	Dockerfile      string            `json:"dockerfile"`
	Image           string            `json:"image"`
	Ports           []int32           `json:"ports"`
	Domains         []string          `json:"domains"`
	EnvironmentVars map[string]string `json:"environmentVars"`
}

type ServiceResponse struct {
	ID         string   `json:"id"`
	ProjectID  string   `json:"projectId"`
	NodeID     string   `json:"nodeId"`
	Name       string   `json:"name"`
	Slug       string   `json:"slug"`
	Type       string   `json:"type"`
	Status     string   `json:"status"`
	Repository string   `json:"repository,omitempty"`
	Branch     string   `json:"branch,omitempty"`
	Image      string   `json:"image,omitempty"`
	Ports      []int32  `json:"ports"`
	Domains    []string `json:"domains"`
	CreatedAt  string   `json:"createdAt"`
	UpdatedAt  string   `json:"updatedAt"`
}

func mapServiceToResponse(s db.Service, domains []string) ServiceResponse {
	var ports []int32
	_ = json.Unmarshal([]byte(s.Ports), &ports)

	return ServiceResponse{
		ID:         s.ID,
		ProjectID:  s.ProjectID,
		NodeID:     s.NodeID,
		Name:       s.Name,
		Slug:       s.Slug,
		Type:       s.Type,
		Status:     s.Status,
		Repository: s.Repository,
		Branch:     s.Branch,
		Image:      s.Image,
		Ports:      ports,
		Domains:    domains,
		CreatedAt:  s.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
		UpdatedAt:  s.UpdatedAt.Format("2006-01-02T15:04:05Z07:00"),
	}
}

func registerServiceRoutes(r chi.Router, orch *orchestrator.Orchestrator) {
	r.Route("/services", func(r chi.Router) {
		// POST /api/v1/services
		r.Post("/", func(w http.ResponseWriter, r *http.Request) {
			var req CreateServiceRequest
			if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
				http.Error(w, "invalid request body", http.StatusBadRequest)
				return
			}

			srv, err := orch.CreateService(r.Context(), orchestrator.CreateServiceParams{
				ProjectID:       req.ProjectID,
				NodeID:          req.NodeID,
				Name:            req.Name,
				Slug:            req.Slug,
				Type:            req.Type,
				Repository:      req.Repository,
				Branch:          req.Branch,
				Dockerfile:      req.Dockerfile,
				Image:           req.Image,
				Ports:           req.Ports,
				Domains:         req.Domains,
				EnvironmentVars: req.EnvironmentVars,
			})
			if err != nil {
				http.Error(w, err.Error(), http.StatusInternalServerError)
				return
			}

			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusCreated)
			_ = json.NewEncoder(w).Encode(mapServiceToResponse(*srv, req.Domains))
		})

		// GET /api/v1/services
		r.Get("/", func(w http.ResponseWriter, r *http.Request) {
			services, err := orch.Queries().ListAllServices(r.Context())
			if err != nil {
				http.Error(w, err.Error(), http.StatusInternalServerError)
				return
			}

			res := make([]ServiceResponse, 0, len(services))
			for _, s := range services {
				domainsDB, _ := orch.Queries().ListServiceDomains(r.Context(), s.ID)
				domains := make([]string, 0, len(domainsDB))
				for _, d := range domainsDB {
					domains = append(domains, d.Domain)
				}
				res = append(res, mapServiceToResponse(s, domains))
			}

			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(res)
		})

		// GET /api/v1/services/{id}
		r.Get("/{id}", func(w http.ResponseWriter, r *http.Request) {
			id := chi.URLParam(r, "id")
			srv, err := orch.Queries().GetServiceByID(r.Context(), id)
			if err != nil {
				if errors.Is(err, sql.ErrNoRows) {
					http.Error(w, "service not found", http.StatusNotFound)
					return
				}
				http.Error(w, err.Error(), http.StatusInternalServerError)
				return
			}

			domainsDB, _ := orch.Queries().ListServiceDomains(r.Context(), srv.ID)
			domains := make([]string, 0, len(domainsDB))
			for _, d := range domainsDB {
				domains = append(domains, d.Domain)
			}

			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(mapServiceToResponse(srv, domains))
		})

		// DELETE /api/v1/services/{id}
		r.Delete("/{id}", func(w http.ResponseWriter, r *http.Request) {
			id := chi.URLParam(r, "id")
			if err := orch.Queries().DeleteService(r.Context(), id); err != nil {
				http.Error(w, err.Error(), http.StatusInternalServerError)
				return
			}
			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(map[string]bool{"success": true})
		})

		// POST /api/v1/services/{id}/deploy
		r.Post("/{id}/deploy", func(w http.ResponseWriter, r *http.Request) {
			id := chi.URLParam(r, "id")
			dep, err := orch.TriggerDeploy(r.Context(), id)
			if err != nil {
				http.Error(w, err.Error(), http.StatusInternalServerError)
				return
			}

			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusAccepted)
			_ = json.NewEncoder(w).Encode(map[string]string{
				"deploymentId": dep.ID,
				"status":       dep.Status,
			})
		})

		// GET /api/v1/services/{id}/deployments
		r.Get("/{id}/deployments", func(w http.ResponseWriter, r *http.Request) {
			id := chi.URLParam(r, "id")
			deps, err := orch.Queries().ListDeploymentsByService(r.Context(), id)
			if err != nil {
				http.Error(w, err.Error(), http.StatusInternalServerError)
				return
			}
			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(deps)
		})
	})

	r.Route("/deployments", func(r chi.Router) {
		// GET /api/v1/deployments?serviceId=...
		r.Get("/", func(w http.ResponseWriter, r *http.Request) {
			serviceID := r.URL.Query().Get("serviceId")
			if serviceID != "" {
				deps, err := orch.Queries().ListDeploymentsByService(r.Context(), serviceID)
				if err != nil {
					http.Error(w, err.Error(), http.StatusInternalServerError)
					return
				}
				w.Header().Set("Content-Type", "application/json")
				_ = json.NewEncoder(w).Encode(deps)
				return
			}
			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode([]any{})
		})

		// GET /api/v1/deployments/{id}
		r.Get("/{id}", func(w http.ResponseWriter, r *http.Request) {
			id := chi.URLParam(r, "id")
			dep, err := orch.GetDeployment(r.Context(), id)
			if err != nil {
				if errors.Is(err, sql.ErrNoRows) {
					http.Error(w, "deployment not found", http.StatusNotFound)
					return
				}
				http.Error(w, err.Error(), http.StatusInternalServerError)
				return
			}

			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(dep)
		})

		// GET /api/v1/deployments/{id}/logs (SSE)
		r.Get("/{id}/logs", func(w http.ResponseWriter, r *http.Request) {
			id := chi.URLParam(r, "id")
			dep, err := orch.GetDeployment(r.Context(), id)
			if err != nil {
				http.Error(w, "deployment not found", http.StatusNotFound)
				return
			}

			flusher, ok := w.(http.Flusher)
			if !ok {
				http.Error(w, "Streaming unsupported", http.StatusInternalServerError)
				return
			}

			w.Header().Set("Content-Type", "text/event-stream")
			w.Header().Set("Cache-Control", "no-cache")
			w.Header().Set("Connection", "keep-alive")

			// Initial logs
			if dep.Logs != "" {
				_, _ = fmt.Fprintf(w, "event: log\ndata: %s\n\n", dep.Logs)
				flusher.Flush()
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
				http.Error(w, "deployment not found", http.StatusNotFound)
				return
			}

			w.Header().Set("Content-Type", "text/plain")
			_, _ = w.Write([]byte(dep.Logs))
		})
	})
}
