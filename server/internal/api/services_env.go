package api

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
	"gettako.dev/tako/internal/orchestrator"
	"gettako.dev/tako/internal/store/db"
)

func handleListServiceEnvVars(orch *orchestrator.Orchestrator) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
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
	}
}

func handleUpdateServiceEnvVars(orch *orchestrator.Orchestrator) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
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
	}
}
