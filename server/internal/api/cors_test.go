package api

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestCORSPreflightFromLocalhost(t *testing.T) {
	t.Setenv("TAKO_CORS_ORIGINS", "")

	nextCalled := false
	handler := corsMiddleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		nextCalled = true
	}))

	req := httptest.NewRequest(http.MethodOptions, "/api/v1/nodes", nil)
	req.Header.Set("Origin", "http://localhost:3000")
	req.Header.Set("Access-Control-Request-Method", "GET")
	rec := httptest.NewRecorder()

	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusNoContent {
		t.Fatalf("expected 204, got %d", rec.Code)
	}
	if got := rec.Header().Get("Access-Control-Allow-Origin"); got != "http://localhost:3000" {
		t.Fatalf("expected origin header, got %q", got)
	}
	if nextCalled {
		t.Fatal("preflight request reached the next handler")
	}
}

func TestCORSConfiguredOrigin(t *testing.T) {
	t.Setenv("TAKO_CORS_ORIGINS", "https://console.example.com")

	handler := corsMiddleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest(http.MethodGet, "/api/v1/nodes", nil)
	req.Header.Set("Origin", "https://console.example.com")
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}
	if got := rec.Header().Get("Access-Control-Allow-Origin"); got != "https://console.example.com" {
		t.Fatalf("expected configured origin, got %q", got)
	}
}

func TestCORSRejectsUnknownOrigin(t *testing.T) {
	t.Setenv("TAKO_CORS_ORIGINS", "https://console.example.com")

	handler := corsMiddleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest(http.MethodGet, "/api/v1/nodes", nil)
	req.Header.Set("Origin", "https://evil.example.com")
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if got := rec.Header().Get("Access-Control-Allow-Origin"); got != "" {
		t.Fatalf("expected no CORS header, got %q", got)
	}
}
