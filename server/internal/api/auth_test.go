package api

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"gettako.dev/tako/internal/events"
	"gettako.dev/tako/internal/orchestrator"
	"gettako.dev/tako/internal/store"
)

func TestAuthLogin(t *testing.T) {
	db, err := store.OpenDB(":memory:")
	if err != nil {
		t.Fatalf("OpenDB failed: %v", err)
	}
	defer db.Close()

	if err := store.Migrate(db); err != nil {
		t.Fatalf("Migrate failed: %v", err)
	}

	// Seed admin user
	if err := store.SeedDefaultAdmin(context.Background(), db, "admin@gettako.dev", "secret123"); err != nil {
		t.Fatalf("SeedDefaultAdmin failed: %v", err)
	}

	bus := events.NewBus()
	orch := orchestrator.New(db, bus, "test-secret")
	router := NewRouter(db, orch)

	// Case 1: Wrong password
	invalidBody, _ := json.Marshal(LoginRequest{
		Email:    "admin@gettako.dev",
		Password: "wrongpassword",
	})
	req := httptest.NewRequest(http.MethodPost, "/api/v1/auth/login", bytes.NewReader(invalidBody))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401 Unauthorized, got %d: %s", w.Code, w.Body.String())
	}

	// Case 2: Correct password
	validBody, _ := json.Marshal(LoginRequest{
		Email:    "admin@gettako.dev",
		Password: "secret123",
	})
	req2 := httptest.NewRequest(http.MethodPost, "/api/v1/auth/login", bytes.NewReader(validBody))
	req2.Header.Set("Content-Type", "application/json")
	w2 := httptest.NewRecorder()
	router.ServeHTTP(w2, req2)

	if w2.Code != http.StatusOK {
		t.Fatalf("expected 200 OK, got %d: %s", w2.Code, w2.Body.String())
	}

	var resp LoginResponse
	if err := json.Unmarshal(w2.Body.Bytes(), &resp); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}

	if resp.User.Email != "admin@gettako.dev" {
		t.Errorf("expected user email admin@gettako.dev, got %s", resp.User.Email)
	}
	if resp.Token == "" {
		t.Errorf("expected non-empty token")
	}

	// Case 3: GET /api/v1/auth/me
	req3 := httptest.NewRequest(http.MethodGet, "/api/v1/auth/me", nil)
	w3 := httptest.NewRecorder()
	router.ServeHTTP(w3, req3)

	if w3.Code != http.StatusOK {
		t.Fatalf("expected 200 OK for /auth/me, got %d", w3.Code)
	}
}
