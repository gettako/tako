package notifications

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"gettako.dev/tako/internal/models"
)

// Dispatcher loads channels from DB and sends formatted messages asynchronously.
type Dispatcher struct {
	db         *sql.DB
	httpClient *http.Client
}

func NewDispatcher(db *sql.DB) *Dispatcher {
	return &Dispatcher{
		db:         db,
		httpClient: &http.Client{Timeout: 10 * time.Second},
	}
}

// Send dispatches p to all enabled matching channels in a background goroutine.
func (d *Dispatcher) Send(p models.NotificationPayload) {
	go d.send(p)
}

// SendDirect sends p to a single specific channel (used for test notifications).
func (d *Dispatcher) SendDirect(ch models.NotificationChannel, p models.NotificationPayload) {
	go func() {
		switch ch.Type {
		case models.NotificationDiscord:
			if ch.WebhookURL != nil {
				d.sendDiscord(*ch.WebhookURL, p)
			}
		case models.NotificationTelegram:
			if ch.BotToken != nil && ch.ChatID != nil {
				d.sendTelegram(*ch.BotToken, *ch.ChatID, p)
			}
		}
	}()
}

func (d *Dispatcher) send(p models.NotificationPayload) {
	channels, err := d.loadChannels(p.Event)
	if err != nil {
		slog.Error("notifications: failed to load channels", slog.String("error", err.Error()))
		return
	}
	for _, ch := range channels {
		switch ch.Type {
		case models.NotificationDiscord:
			if ch.WebhookURL != nil {
				d.sendDiscord(*ch.WebhookURL, p)
			}
		case models.NotificationTelegram:
			if ch.BotToken != nil && ch.ChatID != nil {
				d.sendTelegram(*ch.BotToken, *ch.ChatID, p)
			}
		}
	}
}

func (d *Dispatcher) loadChannels(event models.NotificationEvent) ([]models.NotificationChannel, error) {
	col := "on_deploy_success"
	switch event {
	case models.NotificationEventDeployFailed:
		col = "on_deploy_failed"
	case models.NotificationEventContainerCrashed:
		col = "on_container_crashed"
	}
	// ponytail: col comes from a fixed const switch, safe to inline.
	q := fmt.Sprintf("SELECT id, type, name, enabled, webhook_url, bot_token, chat_id, "+
		"on_deploy_success, on_deploy_failed, on_container_crashed, created_at, updated_at "+
		"FROM notification_channels WHERE enabled = 1 AND %s = 1", col)

	rows, err := d.db.QueryContext(context.Background(), q)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []models.NotificationChannel
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
	return out, nil
}

func (d *Dispatcher) sendDiscord(webhookURL string, p models.NotificationPayload) {
	color := 0x27ae60
	title := "Deployment Succeeded"
	switch p.Event {
	case models.NotificationEventDeployFailed:
		color = 0xe74c3c
		title = "Deployment Failed"
	case models.NotificationEventContainerCrashed:
		color = 0xe67e22
		title = "Container Crashed"
	}

	fields := []map[string]any{
		{"name": "Service", "value": p.ServiceName, "inline": true},
	}
	if p.CommitSHA != "" {
		fields = append(fields, map[string]any{"name": "Commit", "value": "`" + clip(p.CommitSHA, 7) + "`", "inline": true})
	}
	if p.CommitAuthor != "" {
		fields = append(fields, map[string]any{"name": "Author", "value": p.CommitAuthor, "inline": true})
	}
	if p.Duration > 0 {
		fields = append(fields, map[string]any{"name": "Duration", "value": fmt.Sprintf("%ds", p.Duration), "inline": true})
	}
	if p.CommitMessage != "" {
		fields = append(fields, map[string]any{"name": "Message", "value": clip(p.CommitMessage, 150), "inline": false})
	}
	if p.ErrorSnip != "" {
		fields = append(fields, map[string]any{"name": "Error", "value": "```\n" + clip(p.ErrorSnip, 200) + "\n```", "inline": false})
	}

	payload := map[string]any{
		"embeds": []map[string]any{
			{
				"title":     title,
				"color":     color,
				"fields":    fields,
				"timestamp": time.Now().UTC().Format(time.RFC3339),
			},
		},
	}
	d.post(webhookURL, payload)
}

func (d *Dispatcher) sendTelegram(botToken, chatID string, p models.NotificationPayload) {
	icon := "\u2705"
	title := "Deployment Succeeded"
	switch p.Event {
	case models.NotificationEventDeployFailed:
		icon = "\u274c"
		title = "Deployment Failed"
	case models.NotificationEventContainerCrashed:
		icon = "\u26a0\ufe0f"
		title = "Container Crashed"
	}

	var sb strings.Builder
	fmt.Fprintf(&sb, "%s *%s*\n", icon, title)
	fmt.Fprintf(&sb, "Service: `%s`\n", p.ServiceName)
	if p.CommitSHA != "" {
		fmt.Fprintf(&sb, "Commit: `%s`\n", clip(p.CommitSHA, 7))
	}
	if p.CommitAuthor != "" {
		fmt.Fprintf(&sb, "Author: %s\n", p.CommitAuthor)
	}
	if p.Duration > 0 {
		fmt.Fprintf(&sb, "Duration: %ds\n", p.Duration)
	}
	if p.CommitMessage != "" {
		fmt.Fprintf(&sb, "Message: %s\n", clip(p.CommitMessage, 150))
	}
	if p.ErrorSnip != "" {
		fmt.Fprintf(&sb, "```\n%s\n```", clip(p.ErrorSnip, 200))
	}

	payload := map[string]any{
		"chat_id":    chatID,
		"text":       sb.String(),
		"parse_mode": "Markdown",
	}
	url := fmt.Sprintf("https://api.telegram.org/bot%s/sendMessage", botToken)
	d.post(url, payload)
}

func (d *Dispatcher) post(url string, payload any) {
	body, err := json.Marshal(payload)
	if err != nil {
		slog.Error("notifications: marshal error", slog.String("error", err.Error()))
		return
	}
	req, err := http.NewRequestWithContext(context.Background(), http.MethodPost, url, bytes.NewReader(body))
	if err != nil {
		slog.Error("notifications: build request error", slog.String("error", err.Error()))
		return
	}
	req.Header.Set("Content-Type", "application/json")
	resp, err := d.httpClient.Do(req)
	if err != nil {
		slog.Error("notifications: send error", slog.String("url", url), slog.String("error", err.Error()))
		return
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 400 {
		slog.Warn("notifications: non-2xx response", slog.String("url", url), slog.Int("status", resp.StatusCode))
	}
}

func clip(s string, max int) string {
	if len(s) <= max {
		return s
	}
	return s[:max] + "..."
}
