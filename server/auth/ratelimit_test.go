package auth

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"

	"github.com/go-chi/chi/v5"

	"gettako.dev/tako/server/db"
)

// setupRateLimitTestAuth creates a fresh handler+router and pre-populates
// the DB with one admin user (password = "CorrectPassword1!") so that
// wrong-password attempts hit the rate limiter rather than first-boot path.
func setupRateLimitTestAuth(t *testing.T) (*Handler, chi.Router) {
	t.Helper()
	tempDir := t.TempDir()
	dbPath := filepath.Join(tempDir, "rl_test.db")

	database, err := db.Open(dbPath)
	if err != nil {
		t.Fatalf("failed to open test db: %v", err)
	}
	t.Cleanup(func() { database.Close() })

	handler, err := NewHandler(database, "localhost")
	if err != nil {
		t.Fatalf("failed to create auth handler: %v", err)
	}

	r := chi.NewRouter()
	r.Route("/api/auth", func(authRouter chi.Router) {
		handler.RegisterRoutes(authRouter)
	})

	// First-boot login to create the admin user.
	const correctPassword = "CorrectPassword1!"
	body, _ := json.Marshal(LoginRequest{Password: correctPassword})
	req := httptest.NewRequest(http.MethodPost, "/api/auth/login", bytes.NewReader(body))
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("first-boot setup failed: %d %s", rec.Code, rec.Body.String())
	}

	return handler, r
}

// loginWithIP performs a POST /api/auth/login with the given IP in RemoteAddr.
func loginWithIP(r chi.Router, ip string, password string) *httptest.ResponseRecorder {
	body, _ := json.Marshal(LoginRequest{Password: password})
	req := httptest.NewRequest(http.MethodPost, "/api/auth/login", bytes.NewReader(body))
	req.RemoteAddr = ip + ":12345"
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)
	return rec
}

// TestRateLimit_TenFailsThenBlocked verifies that after loginRateLimitMax (10)
// consecutive failed attempts from the same IP, the 11th request returns 429
// with a Retry-After header.
func TestRateLimit_TenFailsThenBlocked(t *testing.T) {
	_, r := setupRateLimitTestAuth(t)

	const ip = "10.0.0.1"
	const wrongPassword = "WrongPassword!"

	// Send loginRateLimitMax failed attempts — each must return 401, not 429.
	for i := 0; i < loginRateLimitMax; i++ {
		rec := loginWithIP(r, ip, wrongPassword)
		if rec.Code == http.StatusTooManyRequests {
			t.Fatalf("attempt %d: expected 401, got 429 too early", i+1)
		}
		if rec.Code != http.StatusUnauthorized {
			t.Fatalf("attempt %d: expected 401 Unauthorized, got %d", i+1, rec.Code)
		}
	}

	// The (loginRateLimitMax+1)-th attempt must be rate-limited.
	rec := loginWithIP(r, ip, wrongPassword)
	if rec.Code != http.StatusTooManyRequests {
		t.Fatalf("expected 429 Too Many Requests on attempt %d, got %d: %s",
			loginRateLimitMax+1, rec.Code, rec.Body.String())
	}

	retryAfter := rec.Header().Get("Retry-After")
	if retryAfter == "" {
		t.Error("expected Retry-After header on 429 response")
	}
}

// TestRateLimit_SuccessResetsCounter verifies that a successful login clears
// the failure counter, so subsequent failed attempts from the same IP are
// not immediately blocked.
func TestRateLimit_SuccessResetsCounter(t *testing.T) {
	_, r := setupRateLimitTestAuth(t)

	const ip = "10.0.0.2"
	const correctPassword = "CorrectPassword1!"
	const wrongPassword = "WrongPassword!"

	// Send loginRateLimitMax-1 failed attempts (just under the limit).
	for i := 0; i < loginRateLimitMax-1; i++ {
		rec := loginWithIP(r, ip, wrongPassword)
		if rec.Code != http.StatusUnauthorized {
			t.Fatalf("setup failure attempt %d: expected 401, got %d", i+1, rec.Code)
		}
	}

	// Successful login — must succeed and reset the counter.
	rec := loginWithIP(r, ip, correctPassword)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200 OK on successful login, got %d: %s", rec.Code, rec.Body.String())
	}

	// After the reset, more failed attempts from the same IP should be allowed
	// (counter restarted from 0). Send loginRateLimitMax new failures — still
	// under the limit, so none should be 429.
	for i := 0; i < loginRateLimitMax; i++ {
		rec := loginWithIP(r, ip, wrongPassword)
		if rec.Code == http.StatusTooManyRequests {
			t.Fatalf("post-reset attempt %d: got unexpected 429 — counter was not reset", i+1)
		}
		if rec.Code != http.StatusUnauthorized {
			t.Fatalf("post-reset attempt %d: expected 401, got %d", i+1, rec.Code)
		}
	}
}

// TestRateLimit_DifferentIPsAreIsolated verifies that the failure counter for
// one IP does not affect a different IP.
func TestRateLimit_DifferentIPsAreIsolated(t *testing.T) {
	_, r := setupRateLimitTestAuth(t)

	const ipA = "10.0.1.1"
	const ipB = "10.0.1.2"
	const wrongPassword = "WrongPassword!"

	// Exhaust the limit for ipA.
	for i := 0; i < loginRateLimitMax; i++ {
		loginWithIP(r, ipA, wrongPassword) // discard response
	}

	// ipA must now be blocked.
	recA := loginWithIP(r, ipA, wrongPassword)
	if recA.Code != http.StatusTooManyRequests {
		t.Fatalf("ipA: expected 429, got %d", recA.Code)
	}

	// ipB must still get a normal 401 (not 429).
	recB := loginWithIP(r, ipB, wrongPassword)
	if recB.Code == http.StatusTooManyRequests {
		t.Fatalf("ipB: got unexpected 429 — IPs should be isolated, not sharing state")
	}
	if recB.Code != http.StatusUnauthorized {
		t.Fatalf("ipB: expected 401 Unauthorized, got %d", recB.Code)
	}
}
