package notifications

import (
	"context"
	"database/sql"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"

	_ "modernc.org/sqlite"

	"gettako.dev/tako/internal/models"
)

func setupTestDB(t *testing.T) *sql.DB {
	t.Helper()
	db, err := sql.Open("sqlite", ":memory:")
	if err != nil {
		t.Fatalf("failed to open sqlite in-memory: %v", err)
	}

	createTable := `
	CREATE TABLE notification_channels (
		id TEXT PRIMARY KEY,
		type TEXT NOT NULL,
		name TEXT NOT NULL,
		enabled INTEGER NOT NULL DEFAULT 1,
		webhook_url TEXT,
		bot_token TEXT,
		chat_id TEXT,
		on_deploy_success INTEGER NOT NULL DEFAULT 1,
		on_deploy_failed INTEGER NOT NULL DEFAULT 1,
		on_container_crashed INTEGER NOT NULL DEFAULT 1,
		created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
		updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
	);`

	if _, err := db.Exec(createTable); err != nil {
		t.Fatalf("failed to create notification_channels table: %v", err)
	}
	return db
}

func TestDispatcher_DiscordAndTelegram(t *testing.T) {
	var mu sync.Mutex
	var receivedDiscord []map[string]any
	var receivedTelegram []map[string]any

	discordServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		body, _ := io.ReadAll(r.Body)
		var p map[string]any
		_ = json.Unmarshal(body, &p)
		mu.Lock()
		receivedDiscord = append(receivedDiscord, p)
		mu.Unlock()
		w.WriteHeader(http.StatusOK)
	}))
	defer discordServer.Close()

	telegramServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		body, _ := io.ReadAll(r.Body)
		var p map[string]any
		_ = json.Unmarshal(body, &p)
		mu.Lock()
		receivedTelegram = append(receivedTelegram, p)
		mu.Unlock()
		w.WriteHeader(http.StatusOK)
	}))
	defer telegramServer.Close()

	db := setupTestDB(t)
	defer db.Close()

	// Insert Discord channel
	_, err := db.ExecContext(context.Background(), `
		INSERT INTO notification_channels (
			id, type, name, enabled, webhook_url, on_deploy_success, on_deploy_failed, on_container_crashed
		) VALUES ('nc_discord', 'discord', 'Discord Alerts', 1, ?, 1, 1, 1)
	`, discordServer.URL)
	if err != nil {
		t.Fatalf("failed to insert discord channel: %v", err)
	}

	d := NewDispatcher(db)
	d.httpClient = discordServer.Client()

	// Test Deploy Success
	payload := models.NotificationPayload{
		Event:         models.NotificationEventDeploySuccess,
		ServiceID:     "srv_1",
		ServiceName:   "web-api",
		CommitSHA:     "1a2b3c4d5e",
		CommitAuthor:  "Alice",
		CommitMessage: "feat: add user auth",
		Duration:      35,
	}

	d.send(payload)

	// Verify Discord message received
	mu.Lock()
	if len(receivedDiscord) != 1 {
		t.Fatalf("expected 1 discord message, got %d", len(receivedDiscord))
	}
	embeds, ok := receivedDiscord[0]["embeds"].([]any)
	if !ok || len(embeds) == 0 {
		t.Fatalf("missing embeds in discord payload")
	}
	embed := embeds[0].(map[string]any)
	if embed["title"] != "Deployment Succeeded" {
		t.Errorf("expected title 'Deployment Succeeded', got %v", embed["title"])
	}
	mu.Unlock()

	// Test SendDirect for Telegram
	chTelegram := models.NotificationChannel{
		ID:                 "nc_tg",
		Type:               models.NotificationTelegram,
		Name:               "Telegram Bot",
		Enabled:            true,
		BotToken:           ptrString("dummy_token"),
		ChatID:             ptrString("-1001234567"),
		OnDeploySuccess:    true,
		OnDeployFailed:     true,
		OnContainerCrashed: true,
	}

	// Override telegram url by replacing d.post logic or custom http transport
	customClient := &http.Client{
		Transport: roundTripperFunc(func(req *http.Request) (*http.Response, error) {
			if strings.Contains(req.URL.Host, "api.telegram.org") {
				newReq, _ := http.NewRequestWithContext(req.Context(), req.Method, telegramServer.URL, req.Body)
				newReq.Header = req.Header
				return telegramServer.Client().Do(newReq)
			}
			return http.DefaultTransport.RoundTrip(req)
		}),
	}
	d.httpClient = customClient

	d.SendDirect(chTelegram, models.NotificationPayload{
		Event:       models.NotificationEventContainerCrashed,
		ServiceID:   "srv_1",
		ServiceName: "web-api",
		ErrorSnip:   "Container exited with code 137 (OOM)",
	})

	time.Sleep(100 * time.Millisecond)

	mu.Lock()
	if len(receivedTelegram) != 1 {
		t.Fatalf("expected 1 telegram message, got %d", len(receivedTelegram))
	}
	text := receivedTelegram[0]["text"].(string)
	if !strings.Contains(text, "Container Crashed") {
		t.Errorf("expected text to contain 'Container Crashed', got %s", text)
	}
	if !strings.Contains(text, "OOM") {
		t.Errorf("expected text to contain 'OOM', got %s", text)
	}
	mu.Unlock()
}

func ptrString(s string) *string {
	return &s
}

type roundTripperFunc func(*http.Request) (*http.Response, error)

func (f roundTripperFunc) RoundTrip(r *http.Request) (*http.Response, error) {
	return f(r)
}
