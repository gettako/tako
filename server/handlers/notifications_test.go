package handlers_test

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/go-chi/chi/v5"
	_ "modernc.org/sqlite"

	"gettako.dev/tako/server/handlers"
	"gettako.dev/tako/server/notifications"
	"gettako.dev/tako/internal/models"
)

func setupNotificationsTestDB(t *testing.T) *sql.DB {
	t.Helper()
	db, err := sql.Open("sqlite", ":memory:")
	if err != nil {
		t.Fatalf("failed to open in-memory sqlite: %v", err)
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

func ptrStr(s string) *string {
	return &s
}

func ptrBool(b bool) *bool {
	return &b
}

func TestNotificationHandlers_CRUDAndTest(t *testing.T) {
	db := setupNotificationsTestDB(t)
	defer db.Close()

	h := handlers.NewHandler(db, []byte("01234567890123456789012345678901"), "localhost")
	d := notifications.NewDispatcher(db)
	h.SetNotifier(d)

	r := chi.NewRouter()
	r.Get("/api/settings/notifications", h.ListNotificationChannels)
	r.Post("/api/settings/notifications", h.CreateNotificationChannel)
	r.Patch("/api/settings/notifications/{id}", h.UpdateNotificationChannel)
	r.Delete("/api/settings/notifications/{id}", h.DeleteNotificationChannel)
	r.Post("/api/settings/notifications/{id}/test", h.TestNotificationChannel)

	// 1. Initial list should be empty
	req := httptest.NewRequest(http.MethodGet, "/api/settings/notifications", nil)
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}
	var channels []models.NotificationChannel
	_ = json.NewDecoder(rec.Body).Decode(&channels)
	if len(channels) != 0 {
		t.Fatalf("expected 0 channels, got %d", len(channels))
	}

	// 2. Create Discord channel
	createReq := models.CreateNotificationChannelRequest{
		Type:               models.NotificationDiscord,
		Name:               "Deploy Alerts Discord",
		Enabled:            true,
		WebhookURL:         ptrStr("https://discord.com/api/webhooks/dummy"),
		OnDeploySuccess:    true,
		OnDeployFailed:     true,
		OnContainerCrashed: false,
	}
	body, _ := json.Marshal(createReq)
	req = httptest.NewRequest(http.MethodPost, "/api/settings/notifications", bytes.NewReader(body))
	rec = httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	if rec.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d (body: %s)", rec.Code, rec.Body.String())
	}
	var created models.NotificationChannel
	_ = json.NewDecoder(rec.Body).Decode(&created)
	if created.ID == "" || created.Name != createReq.Name || !created.Enabled {
		t.Fatalf("unexpected created channel data: %+v", created)
	}
	channelID := created.ID

	// 3. Update channel (toggle container crashed to true, rename)
	updateReq := models.UpdateNotificationChannelRequest{
		Name:               ptrStr("Renamed Discord Alerts"),
		OnContainerCrashed: ptrBool(true),
	}
	body, _ = json.Marshal(updateReq)
	req = httptest.NewRequest(http.MethodPatch, "/api/settings/notifications/"+channelID, bytes.NewReader(body))
	rec = httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200 on update, got %d (body: %s)", rec.Code, rec.Body.String())
	}
	var updated models.NotificationChannel
	_ = json.NewDecoder(rec.Body).Decode(&updated)
	if updated.Name != "Renamed Discord Alerts" || !updated.OnContainerCrashed {
		t.Fatalf("unexpected updated channel data: %+v", updated)
	}

	// 4. Send test notification
	req = httptest.NewRequest(http.MethodPost, "/api/settings/notifications/"+channelID+"/test", nil)
	rec = httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200 on test notification, got %d (body: %s)", rec.Code, rec.Body.String())
	}

	// 5. Delete channel
	req = httptest.NewRequest(http.MethodDelete, "/api/settings/notifications/"+channelID, nil)
	rec = httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200 on delete, got %d", rec.Code)
	}

	// Verify it's deleted
	var count int
	_ = db.QueryRowContext(context.Background(), "SELECT COUNT(*) FROM notification_channels WHERE id = ?", channelID).Scan(&count)
	if count != 0 {
		t.Fatalf("expected channel to be deleted from DB, count = %d", count)
	}
}
