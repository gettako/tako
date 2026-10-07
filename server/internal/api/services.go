package api

import (
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"

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
	PublishToHost   *bool             `json:"publishToHost,omitempty"`
}

type ServiceEnvVarResponse struct {
	ID       string `json:"id"`
	Key      string `json:"key"`
	Value    string `json:"value"`
	IsSecret bool   `json:"isSecret"`
}

type ServiceResponse struct {
	ID         string                  `json:"id"`
	ProjectID  string                  `json:"projectId"`
	NodeID     string                  `json:"nodeId"`
	Name       string                  `json:"name"`
	Slug       string                  `json:"slug"`
	Type       string                  `json:"type"`
	Status     string                  `json:"status"`
	Repository string                  `json:"repository,omitempty"`
	Branch     string                  `json:"branch,omitempty"`
	Image      string                  `json:"image,omitempty"`
	Ports         []int32                 `json:"ports"`
	Domains       []string                `json:"domains"`
	PublishToHost bool                    `json:"publishToHost"`
	EnvVars       []ServiceEnvVarResponse `json:"envVars,omitempty"`
	CreatedAt     string                  `json:"createdAt"`
	UpdatedAt     string                  `json:"updatedAt"`
}

func mapServiceToResponse(s db.Service, domains []string, envVars []ServiceEnvVarResponse) ServiceResponse {
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
		Ports:         ports,
		Domains:       domains,
		PublishToHost: s.PublishToHost != 0,
		EnvVars:       envVars,
		CreatedAt:     s.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
		UpdatedAt:     s.UpdatedAt.Format("2006-01-02T15:04:05Z07:00"),
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
				PublishToHost:   req.PublishToHost,
			})
			if err != nil {
				http.Error(w, err.Error(), http.StatusInternalServerError)
				return
			}

			envVars := make([]ServiceEnvVarResponse, 0)
			for k, v := range req.EnvironmentVars {
				envVars = append(envVars, ServiceEnvVarResponse{
					ID:       "env-" + randomHexID(4),
					Key:      k,
					Value:    v,
					IsSecret: false,
				})
			}

			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusCreated)
			_ = json.NewEncoder(w).Encode(mapServiceToResponse(*srv, req.Domains, envVars))
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
				envDB, _ := orch.Queries().ListServiceEnvVars(r.Context(), s.ID)
				envVars := make([]ServiceEnvVarResponse, 0, len(envDB))
				for _, ev := range envDB {
					envVars = append(envVars, ServiceEnvVarResponse{
						ID:       ev.ID,
						Key:      ev.Key,
						Value:    ev.Value,
						IsSecret: ev.IsSecret == 1,
					})
				}
				res = append(res, mapServiceToResponse(s, domains, envVars))
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

			envDB, _ := orch.Queries().ListServiceEnvVars(r.Context(), srv.ID)
			envVars := make([]ServiceEnvVarResponse, 0, len(envDB))
			for _, ev := range envDB {
				envVars = append(envVars, ServiceEnvVarResponse{
					ID:       ev.ID,
					Key:      ev.Key,
					Value:    ev.Value,
					IsSecret: ev.IsSecret == 1,
				})
			}

			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(mapServiceToResponse(srv, domains, envVars))
		})

		// DELETE /api/v1/services/{id}
		r.Delete("/{id}", func(w http.ResponseWriter, r *http.Request) {
			id := chi.URLParam(r, "id")
			srv, _ := orch.Queries().GetServiceByID(r.Context(), id)
			targetName := id
			if srv.Name != "" {
				targetName = srv.Name
			}

			// Clean up running container and Traefik routing on the agent node
			if srv.ID != "" && srv.NodeID != "" && srv.Slug != "" {
				containerName := "tako-app-" + srv.Slug
				_ = orch.DispatchContainerAction(r.Context(), srv.NodeID, containerName, "remove")
			}

			if err := orch.Queries().DeleteService(r.Context(), id); err != nil {
				http.Error(w, err.Error(), http.StatusInternalServerError)
				return
			}

			_, _ = orch.RecordAudit(r.Context(), orchestrator.AuditLogInput{
				Action:     "delete_service",
				TargetType: "service",
				TargetID:   id,
				TargetName: targetName,
			})

			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(map[string]bool{"success": true})
		})

		// PATCH /api/v1/services/{id}
		r.Patch("/{id}", func(w http.ResponseWriter, r *http.Request) {
			id := chi.URLParam(r, "id")
			srv, err := orch.Queries().GetServiceByID(r.Context(), id)
			if err != nil {
				http.Error(w, "service not found", http.StatusNotFound)
				return
			}

			var req struct {
				Status string `json:"status"`
			}
			if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
				http.Error(w, "invalid request body", http.StatusBadRequest)
				return
			}

			if req.Status != "" {
				_ = orch.Queries().UpdateServiceStatus(r.Context(), db.UpdateServiceStatusParams{
					ID:     id,
					Status: req.Status,
				})
				containerName := "tako-app-" + srv.Slug
				if req.Status == "stopped" {
					_ = orch.DispatchContainerAction(r.Context(), srv.NodeID, containerName, "stop")
				} else if req.Status == "healthy" || req.Status == "running" {
					_ = orch.DispatchContainerAction(r.Context(), srv.NodeID, containerName, "restart")
				}
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

		// POST /api/v1/services/{id}/exec (Terminal)
		r.Post("/{id}/exec", func(w http.ResponseWriter, r *http.Request) {
			id := chi.URLParam(r, "id")
			srv, err := orch.Queries().GetServiceByID(r.Context(), id)
			if err != nil {
				http.Error(w, "service not found", http.StatusNotFound)
				return
			}

			var req struct {
				Command string `json:"command"`
			}
			if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Command == "" {
				http.Error(w, "command required", http.StatusBadRequest)
				return
			}

			containerName := "tako-app-" + srv.Slug
			out, code, err := orch.DispatchExec(r.Context(), srv.NodeID, containerName, req.Command)
			res := map[string]any{
				"output":   out,
				"stdout":   out,
				"stderr":   "",
				"exitCode": code,
			}
			if err != nil {
				res["error"] = err.Error()
				res["stderr"] = err.Error()
				if out == "" {
					res["output"] = err.Error()
					res["stdout"] = err.Error()
				}
			}

			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(res)
		})

		// GET /api/v1/services/{id}/container-logs (Runtime Logs)
		r.Get("/{id}/container-logs", func(w http.ResponseWriter, r *http.Request) {
			id := chi.URLParam(r, "id")
			srv, err := orch.Queries().GetServiceByID(r.Context(), id)
			if err != nil {
				http.Error(w, "service not found", http.StatusNotFound)
				return
			}

			containerName := "tako-app-" + srv.Slug
			logs, err := orch.DispatchContainerLogs(r.Context(), srv.NodeID, containerName, 100)
			if err != nil {
				logs = fmt.Sprintf("[%s] Notice: container not active or offline (%v)\n", time.Now().Format("15:04:05"), err)
			}

			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(map[string]string{
				"logs": logs,
			})
		})

		// GET /api/v1/services/{id}/env
		r.Get("/{id}/env", func(w http.ResponseWriter, r *http.Request) {
			id := chi.URLParam(r, "id")
			envDB, err := orch.Queries().ListServiceEnvVars(r.Context(), id)
			if err != nil {
				http.Error(w, err.Error(), http.StatusInternalServerError)
				return
			}

			res := make([]ServiceEnvVarResponse, 0, len(envDB))
			for _, ev := range envDB {
				res = append(res, ServiceEnvVarResponse{
					ID:       ev.ID,
					Key:      ev.Key,
					Value:    ev.Value,
					IsSecret: ev.IsSecret == 1,
				})
			}

			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(res)
		})

		// PUT /api/v1/services/{id}/env
		r.Put("/{id}/env", func(w http.ResponseWriter, r *http.Request) {
			id := chi.URLParam(r, "id")
			srv, err := orch.Queries().GetServiceByID(r.Context(), id)
			if err != nil {
				http.Error(w, "service not found", http.StatusNotFound)
				return
			}

			var reqVars []struct {
				Key      string `json:"key"`
				Value    string `json:"value"`
				IsSecret bool   `json:"isSecret"`
			}
			if err := json.NewDecoder(r.Body).Decode(&reqVars); err != nil {
				http.Error(w, "invalid request body", http.StatusBadRequest)
				return
			}

			// Delete existing
			_ = orch.Queries().DeleteServiceEnvVars(r.Context(), id)

			res := make([]ServiceEnvVarResponse, 0, len(reqVars))
			for _, v := range reqVars {
				if v.Key == "" {
					continue
				}
				isSec := int64(0)
				if v.IsSecret {
					isSec = 1
				}
				ev, err := orch.Queries().CreateServiceEnvVar(r.Context(), db.CreateServiceEnvVarParams{
					ID:        "env-" + randomHexID(8),
					ServiceID: id,
					Key:       v.Key,
					Value:     v.Value,
					IsSecret:  isSec,
				})
				if err == nil {
					res = append(res, ServiceEnvVarResponse{
						ID:       ev.ID,
						Key:      ev.Key,
						Value:    ev.Value,
						IsSecret: ev.IsSecret == 1,
					})
				}
			}

			_, _ = orch.RecordAudit(r.Context(), orchestrator.AuditLogInput{
				Action:     "update_service_env",
				TargetType: "service",
				TargetID:   srv.ID,
				TargetName: srv.Name,
				Metadata: map[string]interface{}{
					"count": len(res),
				},
			})

			// If service was healthy, re-trigger deployment so new env vars are applied
			if srv.Status == "healthy" {
				_, _ = orch.TriggerDeploy(r.Context(), id)
			}

			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(res)
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
				lines := strings.Split(dep.Logs, "\n")
				for _, line := range lines {
					trimmed := strings.TrimSpace(line)
					if trimmed != "" {
						_, _ = fmt.Fprintf(w, "event: log\ndata: %s\n\n", trimmed)
					}
				}
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
