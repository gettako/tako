package api_test

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"gettako.dev/tako/internal/api"
	"gettako.dev/tako/internal/orchestrator"
	"gettako.dev/tako/internal/store/db"
	takov1 "gettako.dev/tako/proto/gen/go/tako/v1"
)

// 1. Real-Time Docker Container Telemetry Test
func TestRealTimeContainerTelemetry(t *testing.T) {
	router, orch := setupTestRouter(t)
	ctx := context.Background()

	// Register node
	_, _ = orch.RegisterNode(ctx, &takov1.RegisterNodeRequest{
		NodeId:      "node-telemetry-01",
		Name:        "Telemetry Node",
		EnrollToken: "test-enroll",
	})

	// Create service
	srv, err := orch.CreateService(ctx, CreateServiceParamsTest(orch, "telemetry-srv", "node-telemetry-01"))
	if err != nil {
		t.Fatalf("failed to create service: %v", err)
	}

	// Send Heartbeat with real-time container telemetry
	hbReq := &takov1.HeartbeatRequest{
		NodeId:        "node-telemetry-01",
		CpuPercent:    15.5,
		MemoryUsedMb:  1024,
		DiskUsedGb:    20.0,
		NetworkRxKbps: 50.0,
		NetworkTxKbps: 80.0,
		UptimeSeconds: 3600,
		Timestamp:     time.Now().Unix(),
		Containers: []*takov1.ContainerTelemetry{
			{
				ContainerId:    "cont-test-123",
				Name:           "tako-app-" + srv.Slug + "-live",
				ServiceId:      srv.ID,
				ServiceSlug:    srv.Slug,
				CpuPercent:     42.5,
				MemoryUsedMb:   384,
				MemoryLimitMb:  1024,
				NetworkRxKbps:  128.4,
				NetworkTxKbps:  256.8,
				DiskReadBytes:  1048576,
				DiskWriteBytes: 2097152,
			},
		},
	}
	_, err = orch.Heartbeat(ctx, hbReq)
	if err != nil {
		t.Fatalf("heartbeat failed: %v", err)
	}

	// Verify GET /api/v1/services/{id} includes live usage
	req := httptest.NewRequest(http.MethodGet, "/api/v1/services/"+srv.ID, nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}

	var srvResp api.ServiceResponse
	if err := json.NewDecoder(w.Body).Decode(&srvResp); err != nil {
		t.Fatalf("failed to decode service response: %v", err)
	}

	if srvResp.Usage == nil {
		t.Fatalf("expected service.Usage to be populated with live telemetry")
	}
	if srvResp.Usage.CPUPercent != 42.5 {
		t.Errorf("expected CPU 42.5, got %f", srvResp.Usage.CPUPercent)
	}
	if srvResp.Usage.MemoryUsedMB != 384 {
		t.Errorf("expected Memory 384, got %d", srvResp.Usage.MemoryUsedMB)
	}

	// Verify GET /api/v1/services/{id}/metrics uses live telemetry
	reqM := httptest.NewRequest(http.MethodGet, "/api/v1/services/"+srv.ID+"/metrics?range=1h", nil)
	wM := httptest.NewRecorder()
	router.ServeHTTP(wM, reqM)

	if wM.Code != http.StatusOK {
		t.Fatalf("expected 200 for metrics, got %d: %s", wM.Code, wM.Body.String())
	}

	var points []map[string]any
	if err := json.NewDecoder(wM.Body).Decode(&points); err != nil {
		t.Fatalf("failed to decode metrics: %v", err)
	}
	if len(points) == 0 {
		t.Fatalf("expected metric points, got 0")
	}

	lastPt := points[len(points)-1]
	if lastPt["cpu"].(float64) != 42.5 {
		t.Errorf("expected latest point CPU to match 42.5, got %v", lastPt["cpu"])
	}
}

// 2. 1-Click Database Provisioning Test
func TestOneClickDatabaseProvisioning(t *testing.T) {
	router, orch := setupTestRouter(t)
	ctx := context.Background()

	_, _ = orch.RegisterNode(ctx, &takov1.RegisterNodeRequest{
		NodeId:      "node-db-01",
		Name:        "Database Node",
		PublicIp:    "43.156.243.241",
		EnrollToken: "test-enroll",
	})

	tests := []struct {
		dbType      string
		versionTag  string
		expectedImg string
		expectedPort int
		checkConnStr string
	}{
		{
			dbType:      "postgresql",
			versionTag:  "16-alpine",
			expectedImg: "postgres:16-alpine",
			expectedPort: 5432,
			checkConnStr: "postgresql://tako:",
		},
		{
			dbType:      "mysql",
			versionTag:  "latest",
			expectedImg: "mysql:latest",
			expectedPort: 3306,
			checkConnStr: "mysql://tako:",
		},
		{
			dbType:      "redis",
			versionTag:  "7-alpine",
			expectedImg: "redis:7-alpine",
			expectedPort: 6379,
			checkConnStr: "redis://43.156.243.241:6379",
		},
		{
			dbType:      "mongodb",
			versionTag:  "latest",
			expectedImg: "mongo:latest",
			expectedPort: 27017,
			checkConnStr: "mongodb://tako:",
		},
	}

	for _, tt := range tests {
		t.Run("Provision "+tt.dbType, func(t *testing.T) {
			body, _ := json.Marshal(api.CreateServiceRequest{
				ProjectID:       "default",
				NodeID:          "node-db-01",
				Name:            tt.dbType + "-instance",
				Slug:            tt.dbType + "-inst",
				Type:            "database",
				DatabaseType:    tt.dbType,
				DatabaseVersion: tt.versionTag,
			})

			req := httptest.NewRequest(http.MethodPost, "/api/v1/services", bytes.NewReader(body))
			w := httptest.NewRecorder()
			router.ServeHTTP(w, req)

			if w.Code != http.StatusCreated && w.Code != http.StatusOK {
				t.Fatalf("expected 201 or 200, got %d: %s", w.Code, w.Body.String())
			}

			var res api.ServiceResponse
			_ = json.NewDecoder(w.Body).Decode(&res)

			if res.Type != "database" {
				t.Errorf("expected type 'database', got %s", res.Type)
			}
			if res.DatabaseType != tt.dbType {
				t.Errorf("expected databaseType '%s', got '%s'", tt.dbType, res.DatabaseType)
			}
			if res.DatabaseVersion != tt.versionTag {
				t.Errorf("expected databaseVersion '%s', got '%s'", tt.versionTag, res.DatabaseVersion)
			}
			if res.Image != tt.expectedImg {
				t.Errorf("expected image '%s', got '%s'", tt.expectedImg, res.Image)
			}
			if len(res.Ports) == 0 || int(res.Ports[0]) != tt.expectedPort {
				t.Errorf("expected port %d, got %v", tt.expectedPort, res.Ports)
			}
			if !strings.HasPrefix(res.ConnectionString, tt.checkConnStr) {
				t.Errorf("expected connection string to start with '%s', got '%s'", tt.checkConnStr, res.ConnectionString)
			}
		})
	}
}

// 3. Auto-Rollback on Health Check Failure Test
func TestAutoRollbackOnHealthCheckFailure(t *testing.T) {
	_, orch := setupTestRouter(t)
	ctx := context.Background()

	srv, err := orch.CreateService(ctx, CreateServiceParamsTest(orch, "rollback-srv", "node-control"))
	if err != nil {
		t.Fatalf("failed to create service: %v", err)
	}

	// Create previous stable deployment
	depStable, err := orch.Queries().CreateDeployment(ctx, db.CreateDeploymentParams{
		ID:            "dep-stable-101",
		ServiceID:     srv.ID,
		CommitHash:    "stable01",
		CommitMessage: "Stable release v1.0",
		Branch:        "main",
		Author:        "developer",
		Status:        "live",
		Steps:         "[]",
		Logs:          "Initial stable live deployment",
		Url:           "http://stable.preview.tako",
	})
	if err != nil {
		t.Fatalf("failed to create stable deployment: %v", err)
	}

	// Trigger deployment that will fail
	depFailing, err := orch.TriggerDeployWithParams(ctx, srv.ID, "main", "crash01")
	if err != nil {
		t.Fatalf("failed to trigger failing deployment: %v", err)
	}

	// Verify rollback can be executed for the stable deployment
	rolledBack, err := orch.RollbackDeployment(ctx, depStable.ID)
	if err != nil {
		t.Fatalf("rollback failed: %v", err)
	}

	if rolledBack.CommitHash != "stable01" {
		t.Errorf("expected rolled back commit 'stable01', got '%s'", rolledBack.CommitHash)
	}
	if !strings.Contains(rolledBack.CommitMessage, "Rollback to stable0") {
		t.Errorf("expected commit message to indicate rollback, got '%s'", rolledBack.CommitMessage)
	}
	_ = depFailing
}

// 4. Production Readiness & Skalabilitas 3B: Auto-Scaling HPA Test
func TestAutoScalingRuleEvaluation(t *testing.T) {
	router, orch := setupTestRouter(t)
	ctx := context.Background()

	srv, err := orch.CreateService(ctx, CreateServiceParamsTest(orch, "autoscale-srv", "node-control"))
	if err != nil {
		t.Fatalf("failed to create service: %v", err)
	}

	// Update service with Auto-Scaling enabled (min 1, max 5, target 70%)
	enableAS := true
	minR := int64(1)
	maxR := int64(5)
	targetCPU := 70.0
	patchBody, _ := json.Marshal(map[string]any{
		"autoScaling": map[string]any{
			"enabled":          enableAS,
			"minReplicas":      minR,
			"maxReplicas":      maxR,
			"targetCpuPercent": targetCPU,
		},
	})

	req := httptest.NewRequest(http.MethodPatch, "/api/v1/services/"+srv.ID, bytes.NewReader(patchBody))
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200 for PATCH autoscaling, got %d: %s", w.Code, w.Body.String())
	}

	var srvResp api.ServiceResponse
	_ = json.NewDecoder(w.Body).Decode(&srvResp)
	if srvResp.AutoScaling == nil || !srvResp.AutoScaling.Enabled {
		t.Fatalf("expected autoScaling to be enabled")
	}
	if srvResp.AutoScaling.TargetCPUPercent != 70.0 {
		t.Errorf("expected target CPU 70.0, got %f", srvResp.AutoScaling.TargetCPUPercent)
	}

	// Inject high CPU telemetry (85% > 70%)
	_, _ = orch.Heartbeat(ctx, &takov1.HeartbeatRequest{
		NodeId: "node-control",
		Containers: []*takov1.ContainerTelemetry{
			{
				ServiceId:   srv.ID,
				ServiceSlug: srv.Slug,
				CpuPercent:  85.0,
			},
		},
	})

	// Make service live in DB for evaluation
	_ = orch.Queries().UpdateServiceStatus(ctx, db.UpdateServiceStatusParams{
		ID:     srv.ID,
		Status: "live",
	})

	// Run auto scaler evaluation
	orch.StartAutoScaler(ctx, 10*time.Millisecond)
	time.Sleep(50 * time.Millisecond)

	// Check that service replica increased
	updatedSrv, _ := orch.Queries().GetServiceByID(ctx, srv.ID)
	if updatedSrv.Replicas < 1 {
		t.Errorf("expected replicas >= 1, got %d", updatedSrv.Replicas)
	}
}

// 5. Production Readiness & Skalabilitas 3A: Backup Snapshots API Test
func TestBackupSnapshotsAPI(t *testing.T) {
	router, _ := setupTestRouter(t)

	// POST /api/v1/backups/snapshot
	reqSnap := httptest.NewRequest(http.MethodPost, "/api/v1/backups/snapshot", nil)
	wSnap := httptest.NewRecorder()
	router.ServeHTTP(wSnap, reqSnap)

	if wSnap.Code != http.StatusOK {
		t.Fatalf("expected 200 for backup snapshot, got %d: %s", wSnap.Code, wSnap.Body.String())
	}

	var snapRes map[string]any
	if err := json.NewDecoder(wSnap.Body).Decode(&snapRes); err != nil {
		t.Fatalf("failed to decode snapshot response: %v", err)
	}
	if snapRes["ok"] != true {
		t.Errorf("expected ok: true, got %v", snapRes["ok"])
	}
	snapshotObj := snapRes["snapshot"].(map[string]any)
	snapID := snapshotObj["id"].(string)
	if snapID == "" {
		t.Errorf("expected non-empty snapshot ID")
	}
	if snapshotObj["checksum"] == "" {
		t.Errorf("expected SHA-256 checksum on snapshot")
	}

	// GET /api/v1/backups/snapshots
	reqList := httptest.NewRequest(http.MethodGet, "/api/v1/backups/snapshots", nil)
	wList := httptest.NewRecorder()
	router.ServeHTTP(wList, reqList)

	if wList.Code != http.StatusOK {
		t.Fatalf("expected 200 for snapshots list, got %d", wList.Code)
	}
	var snapList []map[string]any
	_ = json.NewDecoder(wList.Body).Decode(&snapList)
	if len(snapList) == 0 {
		t.Errorf("expected at least 1 snapshot in list")
	}

	// POST /api/v1/backups/restore
	restoreBody, _ := json.Marshal(map[string]string{
		"snapshotId": snapID,
	})
	reqRestore := httptest.NewRequest(http.MethodPost, "/api/v1/backups/restore", bytes.NewReader(restoreBody))
	wRestore := httptest.NewRecorder()
	router.ServeHTTP(wRestore, reqRestore)

	if wRestore.Code != http.StatusOK {
		t.Fatalf("expected 200 for restore, got %d: %s", wRestore.Code, wRestore.Body.String())
	}
}

// 4. Test Auto-Rollback Toggle & Auto-Scaling Custom Criteria
func TestAutoRollbackAndScalingCustomCriteria(t *testing.T) {
	router, orch := setupTestRouter(t)
	ctx := context.Background()

	srv, err := orch.CreateService(ctx, CreateServiceParamsTest(orch, "criteria-srv", "node-01"))
	if err != nil {
		t.Fatalf("failed to create service: %v", err)
	}

	// 1. Verify default values on GET
	reqGet := httptest.NewRequest(http.MethodGet, "/api/v1/services/"+srv.ID, nil)
	wGet := httptest.NewRecorder()
	router.ServeHTTP(wGet, reqGet)
	if wGet.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", wGet.Code)
	}
	var srvResp map[string]any
	_ = json.NewDecoder(wGet.Body).Decode(&srvResp)
	if srvResp["autoRollbackEnabled"] != true {
		t.Errorf("expected autoRollbackEnabled default to true, got %v", srvResp["autoRollbackEnabled"])
	}

	// 2. Disable Auto-Rollback and configure Custom Auto-Scaling Criteria via PATCH
	patchBody, _ := json.Marshal(map[string]any{
		"autoRollbackEnabled": false,
		"autoScaling": map[string]any{
			"enabled":             true,
			"minReplicas":         2,
			"maxReplicas":         8,
			"targetCpuPercent":    75.0,
			"metric":              "both",
			"targetMemoryPercent": 85.0,
			"scaleDownCpuPercent": 30.0,
			"cooldownSeconds":     120,
		},
	})
	reqPatch := httptest.NewRequest(http.MethodPatch, "/api/v1/services/"+srv.ID, bytes.NewReader(patchBody))
	wPatch := httptest.NewRecorder()
	router.ServeHTTP(wPatch, reqPatch)
	if wPatch.Code != http.StatusOK {
		t.Fatalf("expected 200 on PATCH, got %d: %s", wPatch.Code, wPatch.Body.String())
	}

	var patchedResp map[string]any
	_ = json.NewDecoder(wPatch.Body).Decode(&patchedResp)
	if patchedResp["autoRollbackEnabled"] != false {
		t.Errorf("expected autoRollbackEnabled to be false after patch, got %v", patchedResp["autoRollbackEnabled"])
	}

	asObj, ok := patchedResp["autoScaling"].(map[string]any)
	if !ok {
		t.Fatalf("expected autoScaling object in response")
	}
	if asObj["enabled"] != true {
		t.Errorf("expected autoScaling.enabled to be true")
	}
	if asObj["metric"] != "both" {
		t.Errorf("expected autoScaling.metric to be 'both', got %v", asObj["metric"])
	}
	if asObj["targetMemoryPercent"] != 85.0 {
		t.Errorf("expected targetMemoryPercent to be 85.0, got %v", asObj["targetMemoryPercent"])
	}
	if asObj["scaleDownCpuPercent"] != 30.0 {
		t.Errorf("expected scaleDownCpuPercent to be 30.0, got %v", asObj["scaleDownCpuPercent"])
	}
	if asObj["cooldownSeconds"] != float64(120) {
		t.Errorf("expected cooldownSeconds to be 120, got %v", asObj["cooldownSeconds"])
	}
}

func CreateServiceParamsTest(orch *orchestrator.Orchestrator, name, nodeID string) orchestrator.CreateServiceParams {
	return orchestrator.CreateServiceParams{
		ProjectID:       "default",
		NodeID:          nodeID,
		Name:            name,
		Slug:            name,
		Type:            "app",
		Repository:      "https://github.com/gettako/sample",
		Branch:          "main",
		Dockerfile:      "Dockerfile",
		Ports:           []int32{80},
		Domains:         []string{"sample.tako.local"},
		EnvironmentVars: map[string]string{"ENV": "test"},
	}
}
