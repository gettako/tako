package handlers

import (
	"database/sql"
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"

	"gettako.dev/tako/internal/models"
	"gettako.dev/tako/internal/protocol"
)

// ListServicePreviews returns all active ephemeral preview environments for a parent service.
func (h *Handler) ListServicePreviews(w http.ResponseWriter, r *http.Request) {
	parentID := chi.URLParam(r, "id")

	// Ensure parent service exists
	var dummy string
	err := h.db.QueryRowContext(r.Context(), `SELECT id FROM services WHERE id = ?`, parentID).Scan(&dummy)
	if err != nil {
		if err == sql.ErrNoRows {
			sendError(w, http.StatusNotFound, "Service not found")
			return
		}
		sendError(w, http.StatusInternalServerError, "Database error: "+err.Error())
		return
	}

	rows, err := h.db.QueryContext(r.Context(), `
		SELECT s.id, s.parent_service_id, COALESCE(s.pr_number, 0), s.name, s.branch,
		       COALESCE(d.commit_sha, ''), s.status, COALESCE(s.primary_domain, ''),
		       s.created_at, s.updated_at
		FROM services s
		LEFT JOIN deployments d ON d.id = s.active_deployment_id
		WHERE s.parent_service_id = ? AND s.is_preview = 1
		ORDER BY s.pr_number DESC, s.created_at DESC
	`, parentID)
	if err != nil {
		sendError(w, http.StatusInternalServerError, "Failed to query preview environments: "+err.Error())
		return
	}
	defer rows.Close()

	previews := make([]models.PreviewEnvironment, 0)
	for rows.Next() {
		var p models.PreviewEnvironment
		var parentSvcID sql.NullString
		var primaryDom string
		var createdAt, updatedAt string

		if err := rows.Scan(
			&p.ID,
			&parentSvcID,
			&p.PRNumber,
			&p.Name,
			&p.Branch,
			&p.CommitSHA,
			&p.Status,
			&primaryDom,
			&createdAt,
			&updatedAt,
		); err == nil {
			if parentSvcID.Valid {
				p.ServiceID = parentSvcID.String
			}
			if primaryDom != "" {
				if !strings.HasPrefix(primaryDom, "http://") && !strings.HasPrefix(primaryDom, "https://") {
					p.URL = "https://" + primaryDom
				} else {
					p.URL = primaryDom
				}
			}
			if t, err := time.Parse(time.RFC3339, createdAt); err == nil {
				p.CreatedAt = t
			} else if t, err := time.Parse("2006-01-02 15:04:05", createdAt); err == nil {
				p.CreatedAt = t
			} else {
				p.CreatedAt = time.Now()
			}
			if t, err := time.Parse(time.RFC3339, updatedAt); err == nil {
				p.UpdatedAt = t
			} else if t, err := time.Parse("2006-01-02 15:04:05", updatedAt); err == nil {
				p.UpdatedAt = t
			} else {
				p.UpdatedAt = time.Now()
			}

			previews = append(previews, p)
		}
	}

	sendJSON(w, http.StatusOK, previews)
}

// DeleteServicePreview destroys the ephemeral container, removes Traefik routes, and deletes the preview service record.
func (h *Handler) DeleteServicePreview(w http.ResponseWriter, r *http.Request) {
	parentID := chi.URLParam(r, "id")
	previewID := chi.URLParam(r, "preview_id")

	var serverID string
	var isPreview bool
	err := h.db.QueryRowContext(r.Context(), `
		SELECT server_id, is_preview FROM services
		WHERE id = ? AND (parent_service_id = ? OR id = ?)
	`, previewID, parentID, previewID).Scan(&serverID, &isPreview)
	if err != nil {
		if err == sql.ErrNoRows {
			sendError(w, http.StatusNotFound, "Preview environment not found")
			return
		}
		sendError(w, http.StatusInternalServerError, "Database error: "+err.Error())
		return
	}

	// Send container delete action to agent
	if h.nodeManager != nil && serverID != "" {
		_ = h.nodeManager.SendCommand(r.Context(), serverID, &protocol.ServerMessage{
			Payload: &protocol.ServerMessage_ContainerAction{
				ContainerAction: &protocol.ContainerAction{
					TaskId:    generateID("act"),
					ServiceId: previewID,
					Action:    "delete",
				},
			},
		})
	}

	// Delete from database (cascades to deployments, domains, env vars)
	res, err := h.db.ExecContext(r.Context(), `DELETE FROM services WHERE id = ?`, previewID)
	if err != nil {
		sendError(w, http.StatusInternalServerError, "Failed to delete preview service: "+err.Error())
		return
	}

	rowsAffected, _ := res.RowsAffected()
	if rowsAffected == 0 {
		sendError(w, http.StatusNotFound, "Preview environment not found")
		return
	}

	sendJSON(w, http.StatusOK, map[string]any{
		"success": true,
		"message": "Preview environment deleted successfully",
	})
}
