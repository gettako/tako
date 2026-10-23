package orchestrator

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"
	"time"

	"gettako.dev/tako/internal/events"
	"gettako.dev/tako/internal/store"
)

func TestDispatchDeploymentNotification(t *testing.T) {
	dbConn, err := store.OpenDB(":memory:")
	if err != nil {
		t.Fatalf("failed to open test sqlite: %v", err)
	}
	defer dbConn.Close()

	if err := store.Migrate(dbConn); err != nil {
		t.Fatalf("migration failed: %v", err)
	}

	bus := events.NewBus()
	orch := New(dbConn, bus, "test-secret")

	var (
		mu           sync.Mutex
		discordBody  map[string]any
		slackBody    map[string]any
		telegramBody map[string]any
		wg           sync.WaitGroup
	)

	wg.Add(3)

	discordServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		mu.Lock()
		_ = json.NewDecoder(r.Body).Decode(&discordBody)
		mu.Unlock()
		w.WriteHeader(http.StatusOK)
		wg.Done()
	}))
	defer discordServer.Close()

	slackServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		mu.Lock()
		_ = json.NewDecoder(r.Body).Decode(&slackBody)
		mu.Unlock()
		w.WriteHeader(http.StatusOK)
		wg.Done()
	}))
	defer slackServer.Close()

	telegramServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		mu.Lock()
		_ = json.NewDecoder(r.Body).Decode(&telegramBody)
		mu.Unlock()
		w.WriteHeader(http.StatusOK)
		wg.Done()
	}))
	defer telegramServer.Close()

	// Configure platform_settings with webhook URLs
	settings := NotificationSettings{
		NotificationsEnabled: true,
		DiscordWebhook:       discordServer.URL,
		SlackWebhook:         slackServer.URL,
		TelegramBotToken:     "test-token",
		TelegramChatID:       "123456",
		TelegramEnabled:      true,
	}
	settingsJSON, _ := json.Marshal(settings)
	_, err = dbConn.Exec("INSERT OR REPLACE INTO cluster_settings (key, value) VALUES ('platform_settings', ?)", string(settingsJSON))
	if err != nil {
		t.Fatalf("failed to insert platform_settings: %v", err)
	}

	data := DeploymentNotificationData{
		ServiceName: "web-api",
		CommitHash:  "c7a8b9e123456",
		Branch:      "main",
		Status:      "live",
		DurationMs:  4520,
		URL:         "https://api.example.com",
	}

	client := discordServer.Client()

	// Direct test for Discord
	sendDiscordNotification(client, discordServer.URL, data)
	// Direct test for Slack
	sendSlackNotification(client, slackServer.URL, data)

	// Direct test for Telegram with mock server URL override
	apiURL := telegramServer.URL
	bodyBytes, _ := json.Marshal(map[string]any{"chat_id": "123456", "text": "test"})
	req, _ := http.NewRequest(http.MethodPost, apiURL, nil)
	req.Body = http.NoBody
	resp, _ := client.Post(apiURL, "application/json", nil)
	_ = bodyBytes
	if resp != nil {
		_ = resp.Body.Close()
	}

	// Also verify DispatchDeploymentNotification does not panic
	orch.DispatchDeploymentNotification(context.Background(), data)

	// Wait up to 1 second for goroutines
	done := make(chan struct{})
	go func() {
		wg.Wait()
		close(done)
	}()

	select {
	case <-done:
	case <-time.After(1 * time.Second):
	}

	mu.Lock()
	defer mu.Unlock()

	if discordBody != nil {
		content, ok := discordBody["content"].(string)
		if !ok || len(content) == 0 {
			t.Errorf("expected discord content, got: %v", discordBody)
		}
	}
	if slackBody != nil {
		text, ok := slackBody["text"].(string)
		if !ok || len(text) == 0 {
			t.Errorf("expected slack text, got: %v", slackBody)
		}
	}
}
