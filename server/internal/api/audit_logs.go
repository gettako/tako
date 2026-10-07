package api

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"

	"gettako.dev/tako/internal/orchestrator"
	"gettako.dev/tako/internal/store/db"
)

type AuditActorResponse struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	Email     string `json:"email"`
	AvatarURL string `json:"avatarUrl,omitempty"`
}

type AuditLogResponse struct {
	ID         string                 `json:"id"`
	Actor      AuditActorResponse     `json:"actor"`
	Action     string                 `json:"action"`
	TargetType string                 `json:"targetType"`
	TargetID   string                 `json:"targetId"`
	TargetName string                 `json:"targetName"`
	Metadata   map[string]interface{} `json:"metadata,omitempty"`
	IPAddress  string                 `json:"ipAddress"`
	Timestamp  string                 `json:"timestamp"`
}

func mapAuditLogToResponse(log db.AuditLog) AuditLogResponse {
	var meta map[string]interface{}
	if log.Metadata != "" {
		_ = json.Unmarshal([]byte(log.Metadata), &meta)
	}
	if meta == nil {
		meta = make(map[string]interface{})
	}

	return AuditLogResponse{
		ID: log.ID,
		Actor: AuditActorResponse{
			ID:    log.ActorID,
			Name:  log.ActorName,
			Email: log.ActorEmail,
		},
		Action:     log.Action,
		TargetType: log.TargetType,
		TargetID:   log.TargetID,
		TargetName: log.TargetName,
		Metadata:   meta,
		IPAddress:  log.IpAddress,
		Timestamp:  log.Timestamp.Format("2006-01-02T15:04:05Z07:00"),
	}
}

func registerAuditLogRoutes(r chi.Router, orch *orchestrator.Orchestrator) {
	r.Route("/audit-logs", func(r chi.Router) {
		r.Get("/", func(w http.ResponseWriter, r *http.Request) {
			limit := int64(50)
			offset := int64(0)

			if lStr := r.URL.Query().Get("limit"); lStr != "" {
				if parsed, err := strconv.ParseInt(lStr, 10, 64); err == nil && parsed > 0 {
					limit = parsed
					if limit > 200 {
						limit = 200
					}
				}
			}

			if oStr := r.URL.Query().Get("offset"); oStr != "" {
				if parsed, err := strconv.ParseInt(oStr, 10, 64); err == nil && parsed >= 0 {
					offset = parsed
				}
			}

			logs, err := orch.Queries().ListAuditLogs(r.Context(), db.ListAuditLogsParams{
				Limit:  limit,
				Offset: offset,
			})
			if err != nil {
				http.Error(w, err.Error(), http.StatusInternalServerError)
				return
			}

			resp := make([]AuditLogResponse, 0, len(logs))
			for _, l := range logs {
				resp = append(resp, mapAuditLogToResponse(l))
			}

			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(resp)
		})
	})
}
