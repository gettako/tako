package api

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"gettako.dev/tako/internal/events"
	"gettako.dev/tako/internal/orchestrator"
	"gettako.dev/tako/internal/store"
	"gettako.dev/tako/internal/store/db"
)

func TestGlobalIngressAccessLogsAPI(t *testing.T) {
	database, err := store.OpenDB(":memory:")
	if err != nil {
		t.Fatalf("OpenDB failed: %v", err)
	}
	defer database.Close()

	if err := store.Migrate(database); err != nil {
		t.Fatalf("Migrate failed: %v", err)
	}

	bus := events.NewBus()
	orch := orchestrator.New(database, bus, "test-secret")
	router := NewRouter(database, orch)

	ctx := context.Background()

	// 1. Setup test node
	nodeID := "node-ingress-test"
	_, err = orch.Queries().CreateNode(ctx, db.CreateNodeParams{
		ID:        nodeID,
		Name:      "test-ingress-node",
		IpAddress: "192.168.1.100",
		Status:    "online",
	})
	if err != nil {
		t.Fatalf("failed to create test node: %v", err)
	}

	// 2. Setup test project and service
	proj, err := orch.Queries().CreateProject(ctx, db.CreateProjectParams{
		ID:          "proj-ingress-test",
		Name:        "Ingress Test Project",
		Slug:        "ingress-test-project",
		Environment: "production",
	})
	if err != nil {
		t.Fatalf("failed to create test project: %v", err)
	}

	srv, err := orch.Queries().CreateService(ctx, db.CreateServiceParams{
		ID:        "srv-ingress-test",
		ProjectID: proj.ID,
		NodeID:    nodeID,
		Name:      "API Service",
		Slug:      "api-service",
		Status:    "healthy",
		Ports:     "[8080]",
	})
	if err != nil {
		t.Fatalf("failed to create test service: %v", err)
	}

	// 3. Test GET /api/v1/ingress/access-logs (Global)
	req := httptest.NewRequest(http.MethodGet, "/api/v1/ingress/access-logs", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200 OK for global ingress access logs, got %d: %s", w.Code, w.Body.String())
	}

	var logs []TraefikAccessLogEntry
	if err := json.Unmarshal(w.Body.Bytes(), &logs); err != nil {
		t.Fatalf("failed to parse access logs JSON: %v", err)
	}
	if len(logs) == 0 {
		t.Fatalf("expected non-empty ingress access logs, got 0")
	}

	// Verify entries have NodeID, NodeName, and Host
	first := logs[0]
	if first.NodeID == "" || first.NodeName == "" {
		t.Errorf("expected nodeID and nodeName populated, got nodeID=%q, nodeName=%q", first.NodeID, first.NodeName)
	}
	if first.Host == "" {
		t.Errorf("expected host populated, got empty host")
	}

	// 4. Test filtering by status: GET /api/v1/ingress/access-logs?status=2xx
	reqStatus := httptest.NewRequest(http.MethodGet, "/api/v1/ingress/access-logs?status=2xx", nil)
	wStatus := httptest.NewRecorder()
	router.ServeHTTP(wStatus, reqStatus)

	if wStatus.Code != http.StatusOK {
		t.Fatalf("expected 200 OK for status filter, got %d", wStatus.Code)
	}
	var statusLogs []TraefikAccessLogEntry
	_ = json.Unmarshal(wStatus.Body.Bytes(), &statusLogs)
	for _, entry := range statusLogs {
		if entry.StatusCode < 200 || entry.StatusCode >= 300 {
			t.Errorf("expected 2xx status, got %d", entry.StatusCode)
		}
	}

	// 5. Test filtering by node: GET /api/v1/ingress/access-logs?nodeId=node-ingress-test
	reqNode := httptest.NewRequest(http.MethodGet, "/api/v1/ingress/access-logs?nodeId="+nodeID, nil)
	wNode := httptest.NewRecorder()
	router.ServeHTTP(wNode, reqNode)

	if wNode.Code != http.StatusOK {
		t.Fatalf("expected 200 OK for nodeId filter, got %d", wNode.Code)
	}
	var nodeLogs []TraefikAccessLogEntry
	_ = json.Unmarshal(wNode.Body.Bytes(), &nodeLogs)
	if len(nodeLogs) == 0 {
		t.Fatalf("expected logs for node %s, got 0", nodeID)
	}
	for _, entry := range nodeLogs {
		if entry.NodeID != nodeID {
			t.Errorf("expected nodeId %q, got %q", nodeID, entry.NodeID)
		}
	}

	// 6. Test filtering by service: GET /api/v1/ingress/access-logs?serviceId=srv-ingress-test
	reqSrv := httptest.NewRequest(http.MethodGet, "/api/v1/ingress/access-logs?serviceId="+srv.ID, nil)
	wSrv := httptest.NewRecorder()
	router.ServeHTTP(wSrv, reqSrv)

	if wSrv.Code != http.StatusOK {
		t.Fatalf("expected 200 OK for serviceId filter, got %d", wSrv.Code)
	}
	var srvLogs []TraefikAccessLogEntry
	_ = json.Unmarshal(wSrv.Body.Bytes(), &srvLogs)
	for _, entry := range srvLogs {
		if entry.ServiceName != srv.Slug {
			t.Errorf("expected serviceName %q, got %q", srv.Slug, entry.ServiceName)
		}
	}

	// 7. Test alias route: GET /api/v1/traefik/access-logs
	reqAlias := httptest.NewRequest(http.MethodGet, "/api/v1/traefik/access-logs?limit=10", nil)
	wAlias := httptest.NewRecorder()
	router.ServeHTTP(wAlias, reqAlias)

	if wAlias.Code != http.StatusOK {
		t.Fatalf("expected 200 OK for /traefik/access-logs alias, got %d", wAlias.Code)
	}
}
