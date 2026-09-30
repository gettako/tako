package main

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"gettako.dev/tako/server/config"
)

func TestHealthzEndpoint(t *testing.T) {
	cfg := &config.Config{
		Port:     "8080",
		Domain:   "localhost",
		DBPath:   "./tako.db",
		GRPCPort: "50051",
	}

	router := buildRouter(cfg, nil, nil, nil)

	req, err := http.NewRequest(http.MethodGet, "/healthz", nil)
	if err != nil {
		t.Fatalf("could not create request: %v", err)
	}

	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Errorf("expected status 200 OK, got %d", rec.Code)
	}

	var body map[string]string
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("failed to decode response json: %v", err)
	}

	if body["status"] != "ok" {
		t.Errorf("expected status 'ok', got %q", body["status"])
	}

	reqApi, err := http.NewRequest(http.MethodGet, "/api/healthz", nil)
	if err != nil {
		t.Fatalf("could not create request: %v", err)
	}
	recApi := httptest.NewRecorder()
	router.ServeHTTP(recApi, reqApi)
	if recApi.Code != http.StatusOK {
		t.Errorf("expected status 200 OK for /api/healthz, got %d", recApi.Code)
	}
}
