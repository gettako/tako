package api

import (
	"net/http"

	"gettako.dev/tako/internal/orchestrator"
	"gettako.dev/tako/internal/security"
	"gettako.dev/tako/internal/store/db"
	"github.com/go-chi/chi/v5"
)

// handleListServiceEnvVars retrieves service environment variables, decrypting secrets and optionally masking them.
func handleListServiceEnvVars(orch *orchestrator.Orchestrator) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id := chi.URLParam(r, "id")
		envDB, err := orch.Queries().ListServiceEnvVars(r.Context(), id)
		if err != nil {
			RespondError(w, http.StatusInternalServerError, err.Error())
			return
		}

		reveal := r.URL.Query().Get("reveal") == "true"
		res := make([]ServiceEnvVarResponse, 0, len(envDB))
		serviceKeyMap := make(map[string]bool, len(envDB))
		for _, ev := range envDB {
			decrypted, _ := security.Decrypt(ev.Value)
			val := decrypted
			if ev.IsSecret == 1 && !reveal {
				val = "••••••••"
			}
			serviceKeyMap[ev.Key] = true
			res = append(res, ServiceEnvVarResponse{
				ID:        ev.ID,
				Key:       ev.Key,
				Value:     val,
				IsSecret:  ev.IsSecret == 1,
				Inherited: false,
			})
		}

		if r.URL.Query().Get("include_shared") == "true" {
			if srv, errSrv := orch.Queries().GetServiceByID(r.Context(), id); errSrv == nil {
				if projEnvs, errP := orch.Queries().ListProjectEnvVars(r.Context(), srv.ProjectID); errP == nil {
					for _, pev := range projEnvs {
						if !serviceKeyMap[pev.Key] {
							decrypted, _ := security.Decrypt(pev.Value)
							val := decrypted
							if pev.IsSecret == 1 && !reveal {
								val = "••••••••"
							}
							res = append(res, ServiceEnvVarResponse{
								ID:        pev.ID,
								Key:       pev.Key,
								Value:     val,
								IsSecret:  pev.IsSecret == 1,
								Inherited: true,
								Source:    "project",
							})
						}
					}
				}
			}
		}

		RespondJSON(w, http.StatusOK, res)
	}
}

// handleUpdateServiceEnvVars encrypts sensitive values and saves the service environment variable list.
func handleUpdateServiceEnvVars(orch *orchestrator.Orchestrator) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id := chi.URLParam(r, "id")
		srv, err := orch.Queries().GetServiceByID(r.Context(), id)
		if err != nil {
			RespondError(w, http.StatusNotFound, "service not found")
			return
		}

		var reqVars []struct {
			Key      string `json:"key"`
			Value    string `json:"value"`
			IsSecret bool   `json:"isSecret"`
		}
		if err := DecodeJSON(r, &reqVars); err != nil {
			RespondError(w, http.StatusBadRequest, "invalid request body")
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
			valToStore := v.Value
			if v.IsSecret {
				isSec = 1
				if enc, err := security.Encrypt(v.Value); err == nil {
					valToStore = enc
				}
			}
			ev, err := orch.Queries().CreateServiceEnvVar(r.Context(), db.CreateServiceEnvVarParams{
				ID:        "env-" + randomHexID(8),
				ServiceID: id,
				Key:       v.Key,
				Value:     valToStore,
				IsSecret:  isSec,
			})
			if err == nil {
				res = append(res, ServiceEnvVarResponse{
					ID:       ev.ID,
					Key:      ev.Key,
					Value:    v.Value,
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

		RespondJSON(w, http.StatusOK, res)
	}
}
