package api

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"gettako.dev/tako/internal/events"
	"gettako.dev/tako/internal/orchestrator"
	"gettako.dev/tako/internal/store"
)

func TestGenerateConsoleTraefikYaml(t *testing.T) {
	// Case 1: No domain assigned
	unassignedYaml := generateConsoleTraefikYaml("")
	if strings.Contains(unassignedYaml, "routers:") {
		t.Fatalf("expected unassigned yaml to NOT contain routers, got:\n%s", unassignedYaml)
	}
	if !strings.Contains(unassignedYaml, "tako-console:") || !strings.Contains(unassignedYaml, "tako-server:") {
		t.Fatalf("expected unassigned yaml to contain services, got:\n%s", unassignedYaml)
	}
	if !strings.Contains(unassignedYaml, "404 Not Found") {
		t.Fatalf("expected unassigned yaml comment mentioning 404 Not Found, got:\n%s", unassignedYaml)
	}

	// Case 2: Custom domain assigned
	assignedYaml := generateConsoleTraefikYaml("console.gettako.cloud")
	if !strings.Contains(assignedYaml, "Host(`console.gettako.cloud`)") {
		t.Fatalf("expected assigned yaml to contain Host rule for console.gettako.cloud, got:\n%s", assignedYaml)
	}
	if !strings.Contains(assignedYaml, "tako-console-secure:") {
		t.Fatalf("expected assigned yaml to contain tako-console-secure router, got:\n%s", assignedYaml)
	}
	if !strings.Contains(assignedYaml, "tako-terminal-secure:") {
		t.Fatalf("expected assigned yaml to contain tako-terminal-secure router, got:\n%s", assignedYaml)
	}
	if !strings.Contains(assignedYaml, "tako-redirect-ssl") {
		t.Fatalf("expected assigned yaml to contain ssl redirect middleware, got:\n%s", assignedYaml)
	}
}

func TestSyncConsoleTraefikConfigIntegration(t *testing.T) {
	database, err := store.OpenDB(":memory:")
	if err != nil {
		t.Fatalf("failed to open test db: %v", err)
	}
	defer database.Close()

	if err := store.Migrate(database); err != nil {
		t.Fatalf("failed to run migrations: %v", err)
	}

	bus := events.NewBus()
	orch := orchestrator.New(database, bus, "test-secret", "test-master")
	router := newTestRouter(t, database, orch)

	// Create temporary /etc/tako/traefik mock dir
	tmpDir := t.TempDir()
	traefikDir := filepath.Join(tmpDir, "traefik")
	dynamicDir := filepath.Join(traefikDir, "dynamic")
	_ = os.MkdirAll(dynamicDir, 0755)

	// Verify initial domain is empty
	domain := getAssignedConsoleDomain(context.Background(), orch)
	if domain != "" {
		t.Fatalf("expected initially empty domain, got %s", domain)
	}

	// Assign domain via PUT /api/v1/settings/domain_settings
	payload := map[string]any{
		"value": map[string]any{
			"domain": "tako.brebeskab.go.id",
		},
	}
	body, _ := json.Marshal(payload)
	req := httptest.NewRequest(http.MethodPut, "/api/v1/settings/domain_settings", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d: %s", rec.Code, rec.Body.String())
	}

	// Verify getAssignedConsoleDomain returns the cleaned domain
	updatedDomain := getAssignedConsoleDomain(context.Background(), orch)
	if updatedDomain != "tako.brebeskab.go.id" {
		t.Fatalf("expected assigned domain 'tako.brebeskab.go.id', got '%s'", updatedDomain)
	}

	// Verify unassigning domain
	clearPayload := map[string]any{
		"value": map[string]any{
			"domain": "",
		},
	}
	clearBody, _ := json.Marshal(clearPayload)
	reqClear := httptest.NewRequest(http.MethodPut, "/api/v1/settings/domain_settings", bytes.NewReader(clearBody))
	reqClear.Header.Set("Content-Type", "application/json")
	recClear := httptest.NewRecorder()
	router.ServeHTTP(recClear, reqClear)

	if recClear.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d: %s", recClear.Code, recClear.Body.String())
	}

	clearedDomain := getAssignedConsoleDomain(context.Background(), orch)
	if clearedDomain != "" {
		t.Fatalf("expected empty domain after clear, got '%s'", clearedDomain)
	}

	// Verify generated YAML is clean with no routers
	clearedYaml := generateConsoleTraefikYaml(clearedDomain)
	if strings.Contains(clearedYaml, "routers:") {
		t.Fatalf("expected cleared yaml to have no routers, got:\n%s", clearedYaml)
	}
}
