package handlers

import (
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"

	"gettako.dev/tako/internal/models"
	"gettako.dev/tako/server/notifications"
)

func generateNotifID() string {
	b := make([]byte, 6)
	_, _ = rand.Read(b)
	return "notif_" + hex.EncodeToString(b)
}

func scanChannel(row *sql.Row) (*models.NotificationChannel, error) {
	var ch models.NotificationChannel
	var chType string
	var webhookURL, botToken, chatID sql.NullString
	var createdStr, updatedStr string
	if err := row.Scan(
		&ch.ID, &chType, &ch.Name, &ch.Enabled,
		&webhookURL, &botToken, &chatID,
		&ch.OnDeploySuccess, &ch.OnDeployFailed, &ch.OnContainerCrashed,
		&createdStr, &updatedStr,
	); err != nil {
		return nil, err
	}
	ch.Type = models.NotificationChannelType(chType)
	if webhookURL.Valid {
		ch.WebhookURL = &webhookURL.String
	}
	if botToken.Valid {
		ch.BotToken = &botToken.String
	}
	if chatID.Valid {
		ch.ChatID = &chatID.String
	}
	ch.CreatedAt, _ = time.Parse("2006-01-02 15:04:05", createdStr)
	ch.UpdatedAt, _ = time.Parse("2006-01-02 15:04:05", updatedStr)
	return &ch, nil
}

const selectChannelCols = `id, type, name, enabled, webhook_url, bot_token, chat_id,
	on_deploy_success, on_deploy_failed, on_container_crashed, created_at, updated_at`

// ListNotificationChannels GET /api/settings/notifications
func (h *Handler) ListNotificationChannels(w http.ResponseWriter, r *http.Request) {
	rows, err := h.db.QueryContext(r.Context(), "SELECT "+selectChannelCols+" FROM notification_channels ORDER BY created_at DESC")
	if err != nil {
		sendError(w, http.StatusInternalServerError, "Failed to query notification channels")
		return
	}
	defer rows.Close()

	out := make([]models.NotificationChannel, 0)
	for rows.Next() {
		var ch models.NotificationChannel
		var chType string
		var webhookURL, botToken, chatID sql.NullString
		var createdStr, updatedStr string
		if err := rows.Scan(
			&ch.ID, &chType, &ch.Name, &ch.Enabled,
			&webhookURL, &botToken, &chatID,
			&ch.OnDeploySuccess, &ch.OnDeployFailed, &ch.OnContainerCrashed,
			&createdStr, &updatedStr,
		); err != nil {
			continue
		}
		ch.Type = models.NotificationChannelType(chType)
		if webhookURL.Valid {
			ch.WebhookURL = &webhookURL.String
		}
		if botToken.Valid {
			ch.BotToken = &botToken.String
		}
		if chatID.Valid {
			ch.ChatID = &chatID.String
		}
		ch.CreatedAt, _ = time.Parse("2006-01-02 15:04:05", createdStr)
		ch.UpdatedAt, _ = time.Parse("2006-01-02 15:04:05", updatedStr)
		out = append(out, ch)
	}
	sendJSON(w, http.StatusOK, out)
}

// CreateNotificationChannel POST /api/settings/notifications
func (h *Handler) CreateNotificationChannel(w http.ResponseWriter, r *http.Request) {
	var req models.CreateNotificationChannelRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		sendError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	if req.Type != models.NotificationDiscord && req.Type != models.NotificationTelegram {
		sendError(w, http.StatusBadRequest, "type must be 'discord' or 'telegram'")
		return
	}
	if req.Name == "" {
		sendError(w, http.StatusBadRequest, "name is required")
		return
	}

	id := generateNotifID()
	_, err := h.db.ExecContext(r.Context(), `
		INSERT INTO notification_channels
			(id, type, name, enabled, webhook_url, bot_token, chat_id,
			 on_deploy_success, on_deploy_failed, on_container_crashed)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		id, string(req.Type), req.Name, req.Enabled,
		req.WebhookURL, req.BotToken, req.ChatID,
		req.OnDeploySuccess, req.OnDeployFailed, req.OnContainerCrashed,
	)
	if err != nil {
		sendError(w, http.StatusInternalServerError, "Failed to create notification channel")
		return
	}

	ch, err := scanChannel(h.db.QueryRowContext(r.Context(), "SELECT "+selectChannelCols+" FROM notification_channels WHERE id = ?", id))
	if err != nil {
		sendError(w, http.StatusInternalServerError, "Failed to fetch created channel")
		return
	}
	sendJSON(w, http.StatusCreated, ch)
}

// UpdateNotificationChannel PATCH /api/settings/notifications/{id}
func (h *Handler) UpdateNotificationChannel(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var req models.UpdateNotificationChannelRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		sendError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	_, err := h.db.ExecContext(r.Context(), `
		UPDATE notification_channels SET
			name               = COALESCE(?, name),
			enabled            = COALESCE(?, enabled),
			webhook_url        = COALESCE(?, webhook_url),
			bot_token          = COALESCE(?, bot_token),
			chat_id            = COALESCE(?, chat_id),
			on_deploy_success  = COALESCE(?, on_deploy_success),
			on_deploy_failed   = COALESCE(?, on_deploy_failed),
			on_container_crashed = COALESCE(?, on_container_crashed),
			updated_at         = CURRENT_TIMESTAMP
		WHERE id = ?`,
		req.Name, req.Enabled, req.WebhookURL, req.BotToken, req.ChatID,
		req.OnDeploySuccess, req.OnDeployFailed, req.OnContainerCrashed,
		id,
	)
	if err != nil {
		sendError(w, http.StatusInternalServerError, "Failed to update notification channel")
		return
	}

	ch, err := scanChannel(h.db.QueryRowContext(r.Context(), "SELECT "+selectChannelCols+" FROM notification_channels WHERE id = ?", id))
	if err != nil {
		if err == sql.ErrNoRows {
			sendError(w, http.StatusNotFound, "Notification channel not found")
			return
		}
		sendError(w, http.StatusInternalServerError, "Failed to fetch updated channel")
		return
	}
	sendJSON(w, http.StatusOK, ch)
}

// DeleteNotificationChannel DELETE /api/settings/notifications/{id}
func (h *Handler) DeleteNotificationChannel(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	res, err := h.db.ExecContext(r.Context(), "DELETE FROM notification_channels WHERE id = ?", id)
	if err != nil {
		sendError(w, http.StatusInternalServerError, "Failed to delete notification channel")
		return
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		sendError(w, http.StatusNotFound, "Notification channel not found")
		return
	}
	sendJSON(w, http.StatusOK, models.SuccessResponse{Success: true})
}

// TestNotificationChannel POST /api/settings/notifications/{id}/test
func (h *Handler) TestNotificationChannel(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	ch, err := scanChannel(h.db.QueryRowContext(r.Context(), "SELECT "+selectChannelCols+" FROM notification_channels WHERE id = ?", id))
	if err != nil {
		if err == sql.ErrNoRows {
			sendError(w, http.StatusNotFound, "Notification channel not found")
			return
		}
		sendError(w, http.StatusInternalServerError, "Failed to fetch channel")
		return
	}

	d := h.notifier
	if d == nil {
		d = notifications.NewDispatcher(h.db)
	}
	payload := models.NotificationPayload{
		Event:         models.NotificationEventDeploySuccess,
		ServiceID:     "test",
		ServiceName:   "test-service",
		CommitSHA:     "abc1234",
		CommitAuthor:  "Tako Admin",
		CommitMessage: "Test deployment notification",
		Duration:      42,
	}

	// Send directly to this specific channel only (not via DB query).
	switch ch.Type {
	case models.NotificationDiscord:
		if ch.WebhookURL == nil {
			sendError(w, http.StatusBadRequest, "webhook_url is required for Discord channels")
			return
		}
		d.SendDirect(*ch, payload)
	case models.NotificationTelegram:
		if ch.BotToken == nil || ch.ChatID == nil {
			sendError(w, http.StatusBadRequest, "bot_token and chat_id are required for Telegram channels")
			return
		}
		d.SendDirect(*ch, payload)
	}

	sendJSON(w, http.StatusOK, models.SuccessResponse{Success: true})
}
