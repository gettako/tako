package api

import (
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"errors"
	"net/http"
	"strings"
	"time"

	"gettako.dev/tako/internal/orchestrator"
	"gettako.dev/tako/internal/store/db"
	"github.com/go-chi/chi/v5"
)

type RegistryResponse struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	ServerURL string `json:"serverUrl"`
	Username  string `json:"username"`
	Password  string `json:"password"`
	CreatedAt string `json:"createdAt"`
	UpdatedAt string `json:"updatedAt"`
}

type CreateRegistryRequest struct {
	Name      string `json:"name"`
	ServerURL string `json:"serverUrl"`
	Username  string `json:"username"`
	Password  string `json:"password"`
}

func maskRegistryPassword(pass string) string {
	if pass == "" {
		return ""
	}
	return "••••••••"
}

func formatRegistryResponse(r db.Registry) RegistryResponse {
	return RegistryResponse{
		ID:        r.ID,
		Name:      r.Name,
		ServerURL: r.ServerUrl,
		Username:  r.Username,
		Password:  maskRegistryPassword(r.Password),
		CreatedAt: r.CreatedAt.Format(time.RFC3339),
		UpdatedAt: r.UpdatedAt.Format(time.RFC3339),
	}
}

func registerRegistryRoutes(r chi.Router, orch *orchestrator.Orchestrator) {
	r.Route("/registries", func(r chi.Router) {
		// GET /api/v1/registries
		r.Get("/", func(w http.ResponseWriter, r *http.Request) {
			list, err := orch.Queries().ListRegistries(r.Context())
			if err != nil {
				RespondError(w, http.StatusInternalServerError, err.Error())
				return
			}
			resp := make([]RegistryResponse, 0, len(list))
			for _, item := range list {
				resp = append(resp, formatRegistryResponse(item))
			}
			RespondJSON(w, http.StatusOK, resp)
		})

		// POST /api/v1/registries
		r.Post("/", func(w http.ResponseWriter, r *http.Request) {
			var req CreateRegistryRequest
			if err := DecodeJSON(r, &req); err != nil {
				RespondError(w, http.StatusBadRequest, "invalid request body")
				return
			}

			req.Name = strings.TrimSpace(req.Name)
			req.ServerURL = strings.TrimSpace(req.ServerURL)
			req.Username = strings.TrimSpace(req.Username)
			if req.Name == "" || req.ServerURL == "" || req.Username == "" || req.Password == "" {
				RespondError(w, http.StatusBadRequest, "name, serverUrl, username, and password are required")
				return
			}

			b := make([]byte, 6)
			_, _ = rand.Read(b)
			regID := "reg-" + hex.EncodeToString(b)

			created, err := orch.Queries().CreateRegistry(r.Context(), db.CreateRegistryParams{
				ID:        regID,
				Name:      req.Name,
				ServerUrl: req.ServerURL,
				Username:  req.Username,
				Password:  req.Password,
			})
			if err != nil {
				RespondError(w, http.StatusInternalServerError, err.Error())
				return
			}

			_, _ = orch.RecordAudit(r.Context(), orchestrator.AuditLogInput{
				Action:     "create_registry",
				TargetType: "registry",
				TargetID:   regID,
				TargetName: req.Name,
			})

			RespondJSON(w, http.StatusCreated, formatRegistryResponse(created))
		})

		// GET /api/v1/registries/{id}
		r.Get("/{id}", func(w http.ResponseWriter, r *http.Request) {
			id := chi.URLParam(r, "id")
			reg, err := orch.Queries().GetRegistryByID(r.Context(), id)
			if err != nil {
				if errors.Is(err, sql.ErrNoRows) {
					RespondError(w, http.StatusNotFound, "registry not found")
					return
				}
				RespondError(w, http.StatusInternalServerError, err.Error())
				return
			}
			RespondJSON(w, http.StatusOK, formatRegistryResponse(reg))
		})

		// DELETE /api/v1/registries/{id}
		r.Delete("/{id}", func(w http.ResponseWriter, r *http.Request) {
			id := chi.URLParam(r, "id")
			reg, err := orch.Queries().GetRegistryByID(r.Context(), id)
			if err != nil {
				if errors.Is(err, sql.ErrNoRows) {
					RespondError(w, http.StatusNotFound, "registry not found")
					return
				}
				RespondError(w, http.StatusInternalServerError, err.Error())
				return
			}

			if err := orch.Queries().DeleteRegistry(r.Context(), id); err != nil {
				RespondError(w, http.StatusInternalServerError, err.Error())
				return
			}

			_, _ = orch.RecordAudit(r.Context(), orchestrator.AuditLogInput{
				Action:     "delete_registry",
				TargetType: "registry",
				TargetID:   id,
				TargetName: reg.Name,
			})

			RespondJSON(w, http.StatusOK, map[string]bool{"success": true})
		})
	})
}
