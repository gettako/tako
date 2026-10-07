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

type ProjectResponse struct {
	ID          string   `json:"id"`
	Name        string   `json:"name"`
	Slug        string   `json:"slug"`
	Description string   `json:"description"`
	Environment string   `json:"environment"`
	Status      string   `json:"status"`
	Tags        []string `json:"tags"`
	CreatedAt   string   `json:"createdAt"`
	UpdatedAt   string   `json:"updatedAt"`
}

func randomHexID(n int) string {
	b := make([]byte, n)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}

func mapProjectToResponse(p db.Project) ProjectResponse {
	var tags []string
	if p.Tags != "" {
		_ = json.Unmarshal([]byte(p.Tags), &tags)
	}
	if tags == nil {
		tags = []string{}
	}

	return ProjectResponse{
		ID:          p.ID,
		Name:        p.Name,
		Slug:        p.Slug,
		Description: p.Description,
		Environment: p.Environment,
		Status:      p.Status,
		Tags:        tags,
		CreatedAt:   p.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
		UpdatedAt:   p.UpdatedAt.Format("2006-01-02T15:04:05Z07:00"),
	}
}

func registerProjectRoutes(r chi.Router, orch *orchestrator.Orchestrator) {
	r.Route("/projects", func(r chi.Router) {
		r.Get("/", func(w http.ResponseWriter, r *http.Request) {
			projects, err := orch.Queries().ListProjects(r.Context())
			if err != nil {
				http.Error(w, err.Error(), http.StatusInternalServerError)
				return
			}
			items := make([]ProjectResponse, 0, len(projects))
			for _, p := range projects {
				items = append(items, mapProjectToResponse(p))
			}
			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(items)
		})

		r.Post("/", func(w http.ResponseWriter, r *http.Request) {
			var req CreateProjectRequest
			if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
				http.Error(w, "invalid request body", http.StatusBadRequest)
				return
			}
			if req.Name == "" {
				http.Error(w, "name is required", http.StatusBadRequest)
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
				http.Error(w, err.Error(), http.StatusInternalServerError)
				return
			}
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusCreated)
			_ = json.NewEncoder(w).Encode(mapProjectToResponse(p))
		})

		r.Get("/{id}", func(w http.ResponseWriter, r *http.Request) {
			id := chi.URLParam(r, "id")
			p, err := orch.Queries().GetProjectByID(r.Context(), id)
			if err != nil && errors.Is(err, sql.ErrNoRows) {
				p, err = orch.Queries().GetProjectBySlug(r.Context(), id)
			}
			if err != nil {
				if errors.Is(err, sql.ErrNoRows) {
					http.Error(w, "project not found", http.StatusNotFound)
					return
				}
				http.Error(w, err.Error(), http.StatusInternalServerError)
				return
			}
			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(mapProjectToResponse(p))
		})

		r.Delete("/{id}", func(w http.ResponseWriter, r *http.Request) {
			id := chi.URLParam(r, "id")
			if err := orch.Queries().DeleteProject(r.Context(), id); err != nil {
				http.Error(w, err.Error(), http.StatusInternalServerError)
				return
			}
			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(map[string]bool{"success": true})
		})
	})
}
