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
	takov1 "gettako.dev/tako/proto/gen/go/tako/v1"
)

func TestNodeTraefikConfigurationAPI(t *testing.T) {
	db, err := store.OpenDB(":memory:")
	if err != nil {
		t.Fatalf("OpenDB failed: %v", err)
	}
	defer db.Close()

	if err := store.Migrate(db); err != nil {
		t.Fatalf("Migrate failed: %v", err)
	}

	bus := events.NewBus()
	orch := orchestrator.New(db, bus, "test-secret")
	router := NewRouter(db, orch)

	// Register a test node
	regResp, err := orch.RegisterNode(context.Background(), &takov1.RegisterNodeRequest{
		NodeId:        "node-traefik-01",
		Name:          "tako-edge-node",
		IpAddress:     "192.168.1.100",
		CpuTotalCores: 4,
		MemoryTotalMb: 8192,
		DiskTotalGb:   100,
		DockerVersion: "26.1.0",
		Os:            "linux",
		KernelVersion: "6.8.0",
		EnrollToken:   "test-secret",
	})
	if err != nil {
		t.Fatalf("RegisterNode failed: %v", err)
	}
	nodeID := regResp.NodeId

	// 1. GET /api/v1/nodes/{id}/traefik -> returns default config
	getReq := httptest.NewRequest(http.MethodGet, "/api/v1/nodes/"+nodeID+"/traefik", nil)
	getW := httptest.NewRecorder()
	router.ServeHTTP(getW, getReq)
	if getW.Code != http.StatusOK {
		t.Fatalf("expected 200 OK for GET node traefik, got %d: %s", getW.Code, getW.Body.String())
	}

	var cfg NodeTraefikConfig
	if err := json.Unmarshal(getW.Body.Bytes(), &cfg); err != nil {
		t.Fatalf("failed to decode node traefik config: %v", err)
	}
	if !cfg.Enabled || cfg.HTTPPort != 80 || cfg.HTTPSPort != 443 {
		t.Errorf("unexpected default traefik config: %+v", cfg)
	}
	if cfg.NodeID != nodeID {
		t.Errorf("expected node ID %s, got %s", nodeID, cfg.NodeID)
	}

	// 2. PUT /api/v1/nodes/{id}/traefik with identical ports -> returns 400
	badPortPayload, _ := json.Marshal(NodeTraefikConfig{
		HTTPPort:  80,
		HTTPSPort: 80, // Identical ports!
	})
	badPortReq := httptest.NewRequest(http.MethodPut, "/api/v1/nodes/"+nodeID+"/traefik", bytes.NewReader(badPortPayload))
	badPortReq.Header.Set("Content-Type", "application/json")
	badPortW := httptest.NewRecorder()
	router.ServeHTTP(badPortW, badPortReq)
	if badPortW.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 Bad Request for identical ports, got %d", badPortW.Code)
	}

	// 3. PUT /api/v1/nodes/{id}/traefik with valid configuration -> returns 200
	validPayload, _ := json.Marshal(NodeTraefikConfig{
		Enabled:          true,
		HTTPPort:         80,
		HTTPSPort:        443,
		DashboardEnabled: true,
		DashboardPort:    8080,
		AcmeEmail:        "ops@mycompany.dev",
		LogLevel:         "DEBUG",
		AccessLogEnabled: true,
		ForceHTTPS:       true,
		DynamicConfigDir: "/etc/tako/traefik/dynamic",
		CertResolver:     "letsencrypt",
		MetricsEnabled:   true,
	})
	putReq := httptest.NewRequest(http.MethodPut, "/api/v1/nodes/"+nodeID+"/traefik", bytes.NewReader(validPayload))
	putReq.Header.Set("Content-Type", "application/json")
	putW := httptest.NewRecorder()
	router.ServeHTTP(putW, putReq)
	if putW.Code != http.StatusOK {
		t.Fatalf("expected 200 OK for valid PUT traefik config, got %d: %s", putW.Code, putW.Body.String())
	}

	var updatedCfg NodeTraefikConfig
	if err := json.Unmarshal(putW.Body.Bytes(), &updatedCfg); err != nil {
		t.Fatalf("failed to parse updated config: %v", err)
	}
	if !updatedCfg.DashboardEnabled || updatedCfg.LogLevel != "DEBUG" || updatedCfg.AcmeEmail != "ops@mycompany.dev" {
		t.Errorf("unexpected updated config: %+v", updatedCfg)
	}

	// 4. POST /api/v1/nodes/{id}/traefik/reload -> reloads routing and returns 200
	reloadReq := httptest.NewRequest(http.MethodPost, "/api/v1/nodes/"+nodeID+"/traefik/reload", nil)
	reloadW := httptest.NewRecorder()
	router.ServeHTTP(reloadW, reloadReq)
	if reloadW.Code != http.StatusOK {
		t.Fatalf("expected 200 OK for reload traefik, got %d: %s", reloadW.Code, reloadW.Body.String())
	}
	var reloadResp map[string]any
	_ = json.Unmarshal(reloadW.Body.Bytes(), &reloadResp)
	if reloadResp["success"] != true {
		t.Errorf("expected reload success=true, got %v", reloadResp["success"])
	}

	// 5. GET /api/v1/nodes/non-existent-node/traefik -> returns 404
	notFoundReq := httptest.NewRequest(http.MethodGet, "/api/v1/nodes/non-existent/traefik", nil)
	notFoundW := httptest.NewRecorder()
	router.ServeHTTP(notFoundW, notFoundReq)
	if notFoundW.Code != http.StatusNotFound {
		t.Fatalf("expected 404 Not Found for missing node, got %d", notFoundW.Code)
	}

	// 6. Verify audit log was recorded for update and reload
	auditReq := httptest.NewRequest(http.MethodGet, "/api/v1/audit-logs", nil)
	auditW := httptest.NewRecorder()
	router.ServeHTTP(auditW, auditReq)
	if auditW.Code != http.StatusOK {
		t.Fatalf("expected 200 OK for audit logs, got %d", auditW.Code)
	}
	var logs []AuditLogResponse
	_ = json.Unmarshal(auditW.Body.Bytes(), &logs)
	hasUpdate := false
	hasReload := false
	for _, l := range logs {
		if l.Action == "update_node_traefik_config" {
			hasUpdate = true
		}
		if l.Action == "reload_node_traefik" {
			hasReload = true
		}
	}
	if !hasUpdate || !hasReload {
		t.Errorf("expected audit logs for update (%v) and reload (%v)", hasUpdate, hasReload)
	}
}
