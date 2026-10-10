package api

import (
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"errors"
	"net/http"

	"github.com/go-chi/chi/v5"
	"gettako.dev/tako/internal/orchestrator"
	"gettako.dev/tako/internal/store/db"
)

type CreateProjectRequest struct {
	Name        string   `json:"name"`
	Slug        string   `json:"slug"`
	Description string   `json:"description"`
	Environment string   `json:"environment"`
	Tags        []string `json:"tags"`
}

type UpdateProjectRequest struct {
	Name        *string   `json:"name"`
	Slug        *string   `json:"slug"`
	Description *string   `json:"description"`
	Environment *string   `json:"environment"`
	Tags        *[]string `json:"tags"`
}

type ProjectResponse struct {
	ID                   string   `json:"id"`
	Name                 string   `json:"name"`
	Slug                 string   `json:"slug"`
	Description          string   `json:"description"`
	Environment          string   `json:"environment"`
	Status               string   `json:"status"`
	Tags                 []string `json:"tags"`
	CreatedAt            string   `json:"createdAt"`
	UpdatedAt            string   `json:"updatedAt"`
	ServicesCount        int      `json:"servicesCount"`
	HealthyServicesCount int      `json:"healthyServicesCount"`
}

func randomHexID(n int) string {
	b := make([]byte, n)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}

func mapProjectToResponse(p db.Project, servicesCount, healthyServicesCount int) ProjectResponse {
	var tags []string
	if p.Tags != "" {
		_ = json.Unmarshal([]byte(p.Tags), &tags)
	}
	if tags == nil {
		tags = []string{}
	}

	return ProjectResponse{
		ID:                   p.ID,
		Name:                 p.Name,
		Slug:                 p.Slug,
		Description:          p.Description,
		Environment:          p.Environment,
		Status:               p.Status,
		Tags:                 tags,
		CreatedAt:            p.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
		UpdatedAt:            p.UpdatedAt.Format("2006-01-02T15:04:05Z07:00"),
		ServicesCount:        servicesCount,
		HealthyServicesCount: healthyServicesCount,
	}
}

func registerProjectRoutes(r chi.Router, orch *orchestrator.Orchestrator) {
	r.Route("/projects", func(r chi.Router) {
		r.Get("/", func(w http.ResponseWriter, r *http.Request) {
			projects, err := orch.Queries().ListProjects(r.Context())
			if err != nil {
				RespondError(w, http.StatusInternalServerError, err.Error())
				return
			}

			// Pre-compute service counts per project in O(N)
			allServices, _ := orch.Queries().ListAllServices(r.Context())
			servicesCountMap := make(map[string]int)
			healthyCountMap := make(map[string]int)
			for _, s := range allServices {
				servicesCountMap[s.ProjectID]++
				if s.Status == "running" || s.Status == "healthy" {
					healthyCountMap[s.ProjectID]++
				}
			}

			items := make([]ProjectResponse, 0, len(projects))
			for _, p := range projects {
				items = append(items, mapProjectToResponse(p, servicesCountMap[p.ID], healthyCountMap[p.ID]))
			}
			RespondJSON(w, http.StatusOK, items)
		})

		r.Post("/", func(w http.ResponseWriter, r *http.Request) {
			var req CreateProjectRequest
			if err := DecodeJSON(r, &req); err != nil {
				RespondError(w, http.StatusBadRequest, "invalid request body")
				return
			}
			if req.Name == "" {
				RespondError(w, http.StatusBadRequest, "name is required")
				return
			}
			if req.Slug == "" {
				req.Slug = req.Name
			}
			if req.Environment == "" {
				req.Environment = "production"
			}
			tagsJSON, _ := json.Marshal(req.Tags)

			p, err := orch.Queries().CreateProject(r.Context(), db.CreateProjectParams{
				ID:          "proj-" + randomHexID(8),
				Name:        req.Name,
				Slug:        req.Slug,
				Description: req.Description,
				Environment: req.Environment,
				Status:      "healthy",
				Tags:        string(tagsJSON),
			})
			if err != nil {
				RespondError(w, http.StatusInternalServerError, err.Error())
				return
			}

			_, _ = orch.RecordAudit(r.Context(), orchestrator.AuditLogInput{
				Action:     "create_project",
				TargetType: "project",
				TargetID:   p.ID,
				TargetName: p.Name,
				Metadata: map[string]interface{}{
					"environment": p.Environment,
					"slug":        p.Slug,
				},
			})

			RespondJSON(w, http.StatusCreated, mapProjectToResponse(p, 0, 0))
		})

		r.Get("/{id}", func(w http.ResponseWriter, r *http.Request) {
			id := chi.URLParam(r, "id")
			p, err := orch.Queries().GetProjectByID(r.Context(), id)
			if err != nil && errors.Is(err, sql.ErrNoRows) {
				p, err = orch.Queries().GetProjectBySlug(r.Context(), id)
			}
			if err != nil {
				if errors.Is(err, sql.ErrNoRows) {
					RespondError(w, http.StatusNotFound, "project not found")
					return
				}
				RespondError(w, http.StatusInternalServerError, err.Error())
				return
			}

			services, _ := orch.Queries().ListServicesByProject(r.Context(), p.ID)
			healthyCount := 0
			for _, s := range services {
				if s.Status == "running" || s.Status == "healthy" {
					healthyCount++
				}
			}

			RespondJSON(w, http.StatusOK, mapProjectToResponse(p, len(services), healthyCount))
		})

		updateHandler := func(w http.ResponseWriter, r *http.Request) {
			id := chi.URLParam(r, "id")
			p, err := orch.Queries().GetProjectByID(r.Context(), id)
			if err != nil && errors.Is(err, sql.ErrNoRows) {
				p, err = orch.Queries().GetProjectBySlug(r.Context(), id)
			}
			if err != nil {
				if errors.Is(err, sql.ErrNoRows) {
					RespondError(w, http.StatusNotFound, "project not found")
					return
				}
				RespondError(w, http.StatusInternalServerError, err.Error())
				return
			}

			var req UpdateProjectRequest
			if err := DecodeJSON(r, &req); err != nil {
				RespondError(w, http.StatusBadRequest, "invalid request body")
				return
			}

			name := p.Name
			if req.Name != nil && *req.Name != "" {
				name = *req.Name
			}

			slug := p.Slug
			if req.Slug != nil && *req.Slug != "" {
				slug = *req.Slug
			}

			desc := p.Description
			if req.Description != nil {
				desc = *req.Description
			}

			env := p.Environment
			if req.Environment != nil && *req.Environment != "" {
				env = *req.Environment
			}

			tagsStr := p.Tags
			if req.Tags != nil {
				tagsJSON, _ := json.Marshal(*req.Tags)
				tagsStr = string(tagsJSON)
			}

			updated, err := orch.Queries().UpdateProject(r.Context(), db.UpdateProjectParams{
				ID:          p.ID,
				Name:        name,
				Slug:        slug,
				Description: desc,
				Environment: env,
				Tags:        tagsStr,
			})
			if err != nil {
				RespondError(w, http.StatusBadRequest, err.Error())
				return
			}

			_, _ = orch.RecordAudit(r.Context(), orchestrator.AuditLogInput{
				Action:     "update_project",
				TargetType: "project",
				TargetID:   updated.ID,
				TargetName: updated.Name,
				Metadata: map[string]interface{}{
					"environment": updated.Environment,
					"slug":        updated.Slug,
				},
			})

			services, _ := orch.Queries().ListServicesByProject(r.Context(), updated.ID)
			healthyCount := 0
			for _, s := range services {
				if s.Status == "running" || s.Status == "healthy" {
					healthyCount++
				}
			}

			RespondJSON(w, http.StatusOK, mapProjectToResponse(updated, len(services), healthyCount))
		}

		r.Patch("/{id}", updateHandler)
		r.Put("/{id}", updateHandler)

		r.Delete("/{id}", func(w http.ResponseWriter, r *http.Request) {
			id := chi.URLParam(r, "id")
			p, err := orch.Queries().GetProjectByID(r.Context(), id)
			if err != nil && errors.Is(err, sql.ErrNoRows) {
				p, err = orch.Queries().GetProjectBySlug(r.Context(), id)
			}
			if err != nil {
				if errors.Is(err, sql.ErrNoRows) {
					RespondError(w, http.StatusNotFound, "project not found")
					return
				}
				RespondError(w, http.StatusInternalServerError, err.Error())
				return
			}

			// Project can only be deleted if it has no services, unless cascade=true
			services, err := orch.Queries().ListServicesByProject(r.Context(), p.ID)
			if err != nil {
				RespondError(w, http.StatusInternalServerError, err.Error())
				return
			}
			cascade := r.URL.Query().Get("cascade") == "true"
			if len(services) > 0 {
				if !cascade {
					RespondError(w, http.StatusBadRequest, "cannot delete project: project contains services. Please delete all services first.")
					return
				}
				// Cascade delete all child services
				for _, srv := range services {
					if srv.NodeID != "" && srv.Slug != "" {
						containerName := "tako-app-" + srv.Slug
						_ = orch.DispatchContainerAction(r.Context(), srv.NodeID, containerName, "remove")
					}
					_ = orch.Queries().DeleteServiceDomains(r.Context(), srv.ID)
					_ = orch.Queries().DeleteServiceEnvVars(r.Context(), srv.ID)
					if err := orch.Queries().DeleteService(r.Context(), srv.ID); err != nil {
						RespondError(w, http.StatusInternalServerError, "failed to cascade delete service: "+err.Error())
						return
					}
					_, _ = orch.RecordAudit(r.Context(), orchestrator.AuditLogInput{
						Action:     "delete_service",
						TargetType: "service",
						TargetID:   srv.ID,
						TargetName: srv.Name,
					})
				}
			}

			if err := orch.Queries().DeleteProject(r.Context(), p.ID); err != nil {
				RespondError(w, http.StatusInternalServerError, err.Error())
				return
			}

			_, _ = orch.RecordAudit(r.Context(), orchestrator.AuditLogInput{
				Action:     "delete_project",
				TargetType: "project",
				TargetID:   p.ID,
				TargetName: p.Name,
			})

			RespondJSON(w, http.StatusOK, map[string]bool{"success": true})
		})
	})
}
