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

// setupChangePasswordTest initialises a fresh DB+handler+router and performs
// the first-boot login so that a real admin user exists.
// It returns the router plus the cookie from the first login (browser A).
func setupChangePasswordTest(t *testing.T) (chi.Router, *http.Cookie) {
	t.Helper()

	tempDir := t.TempDir()
	dbPath := filepath.Join(tempDir, "change_pw_test.db")

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
	r.Route("/api/auth", func(ar chi.Router) {
		handler.RegisterRoutes(ar)
	})

	// First boot: creates the admin user and returns a session cookie.
	body, _ := json.Marshal(LoginRequest{Password: "AdminPassword123!"})
	req := httptest.NewRequest(http.MethodPost, "/api/auth/login", bytes.NewReader(body))
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("first-boot login failed: %d %s", rec.Code, rec.Body.String())
	}

	var cookieA *http.Cookie
	for _, c := range rec.Result().Cookies() {
		if c.Name == SessionCookieName {
			cookieA = c
			break
		}
	}
	if cookieA == nil {
		t.Fatal("expected session cookie after first-boot login")
	}

	return r, cookieA
}

// loginAgain performs a normal password login and returns the session cookie.
func loginAgain(t *testing.T, r chi.Router, password string) *http.Cookie {
	t.Helper()
	body, _ := json.Marshal(LoginRequest{Password: password})
	req := httptest.NewRequest(http.MethodPost, "/api/auth/login", bytes.NewReader(body))
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("login failed: %d %s", rec.Code, rec.Body.String())
	}

	for _, c := range rec.Result().Cookies() {
		if c.Name == SessionCookieName {
			return c
		}
	}
	t.Fatal("expected session cookie after login")
	return nil
}

// meStatus calls GET /api/auth/me with the given cookie and returns the HTTP
// status code.
func meStatus(r chi.Router, cookie *http.Cookie) int {
	req := httptest.NewRequest(http.MethodGet, "/api/auth/me", nil)
	req.AddCookie(cookie)
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)
	return rec.Code
}

// TestChangePassword_InvalidatesOtherSessions verifies the SEC-10 fix:
// after changing the password from browser A, browser B's session is revoked
// (subsequent requests return 401), while browser A's session stays valid.
func TestChangePassword_InvalidatesOtherSessions(t *testing.T) {
	r, cookieA := setupChangePasswordTest(t)

	// Simulate a second browser logging in — this creates a different session ID.
	cookieB := loginAgain(t, r, "AdminPassword123!")

	// Both sessions must be valid before the password change.
	if got := meStatus(r, cookieA); got != http.StatusOK {
		t.Fatalf("before change: browser A expected 200, got %d", got)
	}
	if got := meStatus(r, cookieB); got != http.StatusOK {
		t.Fatalf("before change: browser B expected 200, got %d", got)
	}

	// Change password from browser A (cookieA is the "current" session).
	body, _ := json.Marshal(ChangePasswordRequest{
		CurrentPassword: "AdminPassword123!",
		NewPassword:     "NewPassword456!",
	})
	req := httptest.NewRequest(http.MethodPost, "/api/auth/change-password", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.AddCookie(cookieA)
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("change-password expected 200, got %d: %s", rec.Code, rec.Body.String())
	}

	// Browser A's session should still be valid.
	if got := meStatus(r, cookieA); got != http.StatusOK {
		t.Fatalf("after change: browser A expected 200 (current session preserved), got %d", got)
	}

	// Browser B's session must now be invalidated.
	if got := meStatus(r, cookieB); got != http.StatusUnauthorized {
		t.Fatalf("after change: browser B expected 401 (session revoked), got %d", got)
	}
}

// TestChangePassword_WrongCurrentPassword verifies that a wrong current
// password is rejected and sessions are NOT touched.
func TestChangePassword_WrongCurrentPassword(t *testing.T) {
	r, cookieA := setupChangePasswordTest(t)
	cookieB := loginAgain(t, r, "AdminPassword123!")

	body, _ := json.Marshal(ChangePasswordRequest{
		CurrentPassword: "WrongPassword!",
		NewPassword:     "NewPassword456!",
	})
	req := httptest.NewRequest(http.MethodPost, "/api/auth/change-password", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.AddCookie(cookieA)
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401 on wrong current password, got %d", rec.Code)
	}

	// Both sessions must still be valid — no side-effects on failure.
	if got := meStatus(r, cookieA); got != http.StatusOK {
		t.Fatalf("after failed change: browser A expected 200, got %d", got)
	}
	if got := meStatus(r, cookieB); got != http.StatusOK {
		t.Fatalf("after failed change: browser B expected 200, got %d", got)
	}
}

// TestChangePassword_ShortNewPassword verifies that a too-short new password
// is rejected with 400.
func TestChangePassword_ShortNewPassword(t *testing.T) {
	r, cookieA := setupChangePasswordTest(t)

	body, _ := json.Marshal(ChangePasswordRequest{
		CurrentPassword: "AdminPassword123!",
		NewPassword:     "short",
	})
	req := httptest.NewRequest(http.MethodPost, "/api/auth/change-password", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.AddCookie(cookieA)
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 on short password, got %d", rec.Code)
	}
}
