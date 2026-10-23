package orchestrator

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"
)

// NotificationSettings maps platform_settings notification configuration.
type NotificationSettings struct {
	NotificationsEnabled bool   `json:"notificationsEnabled"`
	DiscordWebhook       string `json:"discordWebhook"`
	SlackWebhook         string `json:"slackWebhook"`
	TelegramBotToken     string `json:"telegramBotToken"`
	TelegramChatID       string `json:"telegramChatId"`
	TelegramEnabled      bool   `json:"telegramEnabled"`
}

// DeploymentNotificationData encapsulates deployment results for outbound webhooks.
type DeploymentNotificationData struct {
	ServiceName string
	ProjectName string
	CommitHash  string
	Branch      string
	Status      string // "live", "failed", "failed_rolled_back"
	DurationMs  int64
	URL         string
	ErrorMsg    string
}

// DispatchDeploymentNotification sends rich automated status notifications to configured Discord, Slack, and Telegram webhooks.
func (o *Orchestrator) DispatchDeploymentNotification(ctx context.Context, data DeploymentNotificationData) {
	row, err := o.queries.GetSetting(ctx, "platform_settings")
	if err != nil || row.Value == "" {
		return
	}

	var cfg NotificationSettings
	if err := json.Unmarshal([]byte(row.Value), &cfg); err != nil || !cfg.NotificationsEnabled {
		return
	}

	client := &http.Client{Timeout: 5 * time.Second}

	// 1. Discord Webhook
	if cfg.DiscordWebhook != "" && strings.HasPrefix(cfg.DiscordWebhook, "http") {
		go sendDiscordNotification(client, cfg.DiscordWebhook, data)
	}

	// 2. Slack Webhook
	if cfg.SlackWebhook != "" && strings.HasPrefix(cfg.SlackWebhook, "http") {
		go sendSlackNotification(client, cfg.SlackWebhook, data)
	}

	// 3. Telegram Bot
	if cfg.TelegramEnabled && cfg.TelegramBotToken != "" && cfg.TelegramChatID != "" {
		go sendTelegramNotification(client, cfg.TelegramBotToken, cfg.TelegramChatID, data)
	}
}

func sendDiscordNotification(client *http.Client, webhookURL string, data DeploymentNotificationData) {
	color := 3066993 // Emerald green
	statusText := "Deployment Succeeded 🚀"
	if data.Status != "live" {
		color = 15158332 // Crimson red
		statusText = "Deployment Failed ⚠️"
	}

	fields := []map[string]any{
		{"name": "Service", "value": data.ServiceName, "inline": true},
		{"name": "Status", "value": strings.ToUpper(data.Status), "inline": true},
	}
	if data.Branch != "" {
		fields = append(fields, map[string]any{"name": "Branch", "value": data.Branch, "inline": true})
	}
	if data.CommitHash != "" {
		prefix := data.CommitHash
		if len(prefix) > 7 {
			prefix = prefix[:7]
		}
		fields = append(fields, map[string]any{"name": "Commit", "value": "`" + prefix + "`", "inline": true})
	}
	if data.DurationMs > 0 {
		fields = append(fields, map[string]any{"name": "Duration", "value": fmt.Sprintf("%.2fs", float64(data.DurationMs)/1000.0), "inline": true})
	}
	if data.URL != "" {
		fields = append(fields, map[string]any{"name": "Preview / Live URL", "value": data.URL, "inline": false})
	}
	if data.ErrorMsg != "" {
		cleanErr := data.ErrorMsg
		if len(cleanErr) > 500 {
			cleanErr = cleanErr[:500] + "..."
		}
		fields = append(fields, map[string]any{"name": "Error Trace", "value": "```\n" + cleanErr + "\n```", "inline": false})
	}

	body, _ := json.Marshal(map[string]any{
		"content": fmt.Sprintf("🐙 **Takō Platform Alert**: %s on service **%s**", statusText, data.ServiceName),
		"embeds": []map[string]any{
			{
				"title":     fmt.Sprintf("%s — %s", data.ServiceName, statusText),
				"color":     color,
				"fields":    fields,
				"timestamp": time.Now().UTC().Format(time.RFC3339),
			},
		},
	})

	req, err := http.NewRequest(http.MethodPost, webhookURL, bytes.NewReader(body))
	if err != nil {
		return
	}
	req.Header.Set("Content-Type", "application/json")
	resp, err := client.Do(req)
	if err == nil {
		_ = resp.Body.Close()
	}
}

func sendSlackNotification(client *http.Client, webhookURL string, data DeploymentNotificationData) {
	emoji := "🚀"
	statusText := "Succeeded"
	if data.Status != "live" {
		emoji = "🚨"
		statusText = "Failed"
	}

	branchStr := ""
	if data.Branch != "" {
		branchStr = fmt.Sprintf(", Branch: `%s`", data.Branch)
	}
	commitStr := ""
	if data.CommitHash != "" {
		prefix := data.CommitHash
		if len(prefix) > 7 {
			prefix = prefix[:7]
		}
		commitStr = fmt.Sprintf(", Commit: `%s`", prefix)
	}

	text := fmt.Sprintf("%s *Takō Deployment %s*: Service `%s`%s%s (Status: `%s`)",
		emoji, statusText, data.ServiceName, branchStr, commitStr, data.Status)
	if data.URL != "" {
		text += fmt.Sprintf("\nLive URL: %s", data.URL)
	}
	if data.ErrorMsg != "" {
		cleanErr := data.ErrorMsg
		if len(cleanErr) > 400 {
			cleanErr = cleanErr[:400] + "..."
		}
		text += fmt.Sprintf("\nError: ```%s```", cleanErr)
	}

	body, _ := json.Marshal(map[string]any{"text": text})
	req, err := http.NewRequest(http.MethodPost, webhookURL, bytes.NewReader(body))
	if err != nil {
		return
	}
	req.Header.Set("Content-Type", "application/json")
	resp, err := client.Do(req)
	if err == nil {
		_ = resp.Body.Close()
	}
}

func sendTelegramNotification(client *http.Client, token, chatID string, data DeploymentNotificationData) {
	apiURL := fmt.Sprintf("https://api.telegram.org/bot%s/sendMessage", token)
	statusText := "SUCCESS 🚀"
	if data.Status != "live" {
		statusText = "FAILED ⚠️"
	}

	text := fmt.Sprintf("🐙 *Takō Deployment %s*\n\n*Service:* `%s`\n*Status:* `%s`",
		statusText, data.ServiceName, data.Status)
	if data.Branch != "" {
		text += fmt.Sprintf("\n*Branch:* `%s`", data.Branch)
	}
	if data.CommitHash != "" {
		prefix := data.CommitHash
		if len(prefix) > 7 {
			prefix = prefix[:7]
		}
		text += fmt.Sprintf("\n*Commit:* `%s`", prefix)
	}
	if data.URL != "" {
		text += fmt.Sprintf("\n*URL:* %s", data.URL)
	}
	if data.ErrorMsg != "" {
		cleanErr := data.ErrorMsg
		if len(cleanErr) > 300 {
			cleanErr = cleanErr[:300] + "..."
		}
		text += fmt.Sprintf("\n*Error:* `%s`", cleanErr)
	}

	body, _ := json.Marshal(map[string]any{
		"chat_id":    chatID,
		"text":       text,
		"parse_mode": "Markdown",
	})
	req, err := http.NewRequest(http.MethodPost, apiURL, bytes.NewReader(body))
	if err != nil {
		return
	}
	req.Header.Set("Content-Type", "application/json")
	resp, err := client.Do(req)
	if err == nil {
		_ = resp.Body.Close()
	}
}
