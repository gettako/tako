package api

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"

	"gettako.dev/tako/internal/orchestrator"
	"gettako.dev/tako/internal/store/db"
)

type UpdateSettingRequest struct {
	Value any `json:"value"`
}

func registerSettingsRoutes(r chi.Router, orch *orchestrator.Orchestrator) {
	r.Route("/settings", func(r chi.Router) {
		// GET /api/v1/settings
		r.Get("/", func(w http.ResponseWriter, r *http.Request) {
			list, err := orch.Queries().ListSettings(r.Context())
			if err != nil {
				http.Error(w, err.Error(), http.StatusInternalServerError)
				return
			}

			result := make(map[string]any)
			for _, item := range list {
				var parsed any
				if err := json.Unmarshal([]byte(item.Value), &parsed); err == nil {
					result[item.Key] = parsed
				} else {
					result[item.Key] = item.Value
				}
			}

			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(result)
		})

		// GET /api/v1/settings/{key}
		r.Get("/{key}", func(w http.ResponseWriter, r *http.Request) {
			key := chi.URLParam(r, "key")
			setting, err := orch.Queries().GetSetting(r.Context(), key)
			if err != nil {
				http.Error(w, "setting not found", http.StatusNotFound)
				return
			}

			var parsed any
			if err := json.Unmarshal([]byte(setting.Value), &parsed); err == nil {
				w.Header().Set("Content-Type", "application/json")
				_ = json.NewEncoder(w).Encode(parsed)
				return
			}

			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(map[string]string{"value": setting.Value})
		})

		// PUT /api/v1/settings/{key}
		r.Put("/{key}", func(w http.ResponseWriter, r *http.Request) {
			key := chi.URLParam(r, "key")
			var req UpdateSettingRequest
			if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
				http.Error(w, "invalid request body", http.StatusBadRequest)
				return
			}

			valBytes, err := json.Marshal(req.Value)
			if err != nil {
				http.Error(w, "invalid value serialization", http.StatusBadRequest)
				return
			}

			setting, err := orch.Queries().SetSetting(r.Context(), db.SetSettingParams{
				Key:   key,
				Value: string(valBytes),
			})
			if err != nil {
				http.Error(w, err.Error(), http.StatusInternalServerError)
				return
			}

			_, _ = orch.RecordAudit(r.Context(), orchestrator.AuditLogInput{
				Action:     "update_setting",
				TargetType: "settings",
				TargetID:   key,
				TargetName: key,
			})

			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(setting)
		})

		// POST /api/v1/settings (batch save)
		r.Post("/", func(w http.ResponseWriter, r *http.Request) {
			var batch map[string]any
			if err := json.NewDecoder(r.Body).Decode(&batch); err != nil {
				http.Error(w, "invalid request body", http.StatusBadRequest)
				return
			}

			for k, v := range batch {
				valBytes, err := json.Marshal(v)
				if err != nil {
					continue
				}
				_, _ = orch.Queries().SetSetting(r.Context(), db.SetSettingParams{
					Key:   k,
					Value: string(valBytes),
				})
			}

			_, _ = orch.RecordAudit(r.Context(), orchestrator.AuditLogInput{
				Action:     "batch_update_settings",
				TargetType: "settings",
				TargetID:   "cluster",
				TargetName: "Cluster Settings",
			})

			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(map[string]bool{"success": true})
		})
	})
}
