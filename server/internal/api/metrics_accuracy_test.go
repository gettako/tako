package api_test

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"gettako.dev/tako/internal/api"
	"gettako.dev/tako/internal/config"
	"gettako.dev/tako/internal/store/db"
	takov1 "gettako.dev/tako/proto/gen/go/tako/v1"
)

func TestConstantsAndRangeHelpers(t *testing.T) {
	// 1. Verify ports in config package
	if config.DefaultHTTPPort != "8080" {
		t.Errorf("expected DefaultHTTPPort 8080, got %s", config.DefaultHTTPPort)
	}
	if config.DefaultGRPCPort != "50051" {
		t.Errorf("expected DefaultGRPCPort 50051, got %s", config.DefaultGRPCPort)
	}

	// 2. Verify RangeToSeconds mapping
	tests := []struct {
		rangeStr string
		expected string
	}{
		{api.TimeRange15m, "-900"},
		{api.TimeRange1h, "-3600"},
		{api.TimeRange6h, "-21600"},
		{api.TimeRange24h, "-86400"},
		{api.TimeRange7d, "-604800"},
		{"unknown", "-3600"},
	}

	for _, tt := range tests {
		got := api.RangeToSeconds(tt.rangeStr)
		if got != tt.expected {
			t.Errorf("RangeToSeconds(%q) = %q; want %q", tt.rangeStr, got, tt.expected)
		}
	}

	// 3. Verify RangeToStepConfig
	count15m, step15m := api.RangeToStepConfig(api.TimeRange15m)
	if count15m != 180 || step15m != time.Second*5 {
		t.Errorf("RangeToStepConfig(15m) = (%d, %v); want (180, 5s)", count15m, step15m)
	}

	count1h, step1h := api.RangeToStepConfig(api.TimeRange1h)
	if count1h != 120 || step1h != time.Second*30 {
		t.Errorf("RangeToStepConfig(1h) = (%d, %v); want (120, 30s)", count1h, step1h)
	}
}

func TestServiceMetricsAccuracy(t *testing.T) {
	router, orch := setupTestRouter(t)
	ctx := context.Background()

	// Create project in DB
	_, _ = orch.Queries().CreateProject(ctx, db.CreateProjectParams{
		ID:          "prj-acc-test",
		Name:        "Metrics Test Project",
		Slug:        "metrics-test-prj",
		Description: "Telemetry accuracy validation",
		Environment: "production",
		Tags:        "[]",
	})

	// Register node
	_, err := orch.RegisterNode(ctx, &takov1.RegisterNodeRequest{
		NodeId:      "node-acc-1",
		Name:        "node-acc-1",
		IpAddress:   "192.168.1.10",
		EnrollToken: "test-enroll",
	})
	if err != nil {
		t.Fatalf("RegisterNode failed: %v", err)
	}

	// Create service via API POST
	createPayload := api.CreateServiceRequest{
		ProjectID:       "prj-acc-test",
		NodeID:          "node-acc-1",
		Name:            "Accuracy Service",
		Slug:            "acc-srv",
		Type:            "app",
		Ports:           []int32{8080},
		Domains:         []string{"acc.gettako.local"},
		EnvironmentVars: map[string]string{"PORT": "8080"},
	}
	createData, _ := json.Marshal(createPayload)
	reqCreate := httptest.NewRequest(http.MethodPost, "/api/v1/services", bytes.NewReader(createData))
	recCreate := httptest.NewRecorder()
	router.ServeHTTP(recCreate, reqCreate)
	if recCreate.Code != http.StatusCreated {
		t.Fatalf("failed to create service: %d %s", recCreate.Code, recCreate.Body.String())
	}

	var createdSrv api.ServiceResponse
	_ = json.Unmarshal(recCreate.Body.Bytes(), &createdSrv)

	// Record real container telemetry via Heartbeat
	_, err = orch.Heartbeat(ctx, &takov1.HeartbeatRequest{
		NodeId:        "node-acc-1",
		CpuPercent:    10.0,
		MemoryUsedMb:  512,
		DiskUsedGb:    10.0,
		NetworkRxKbps: 20.0,
		NetworkTxKbps: 30.0,
		UptimeSeconds: 120,
		Timestamp:     time.Now().Unix(),
		Containers: []*takov1.ContainerTelemetry{
			{
				ContainerId:    "cont-acc-01",
				Name:           "tako-app-" + createdSrv.Slug,
				ServiceId:      createdSrv.ID,
				ServiceSlug:    createdSrv.Slug,
				CpuPercent:     48.75,
				MemoryUsedMb:   384,
				MemoryLimitMb:  1024,
				NetworkRxKbps:  128.5,
				NetworkTxKbps:  256.0,
				DiskReadBytes:  2048,
				DiskWriteBytes: 4096,
			},
		},
	})
	if err != nil {
		t.Fatalf("Heartbeat failed: %v", err)
	}

	// Query GET /api/v1/services/{id}/metrics?range=1h
	req := httptest.NewRequest(http.MethodGet, "/api/v1/services/"+createdSrv.ID+"/metrics?range=1h", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200 OK, got %d: %s", w.Code, w.Body.String())
	}

	var points []struct {
		Timestamp     string  `json:"timestamp"`
		CPU           float64 `json:"cpu"`
		Memory        int64   `json:"memory"`
		MemoryPercent int64   `json:"memoryPercent"`
		NetworkRx     float64 `json:"networkRx"`
		NetworkTx     float64 `json:"networkTx"`
		DiskRead      int64   `json:"diskRead"`
		DiskWrite     int64   `json:"diskWrite"`
	}

	if err := json.Unmarshal(w.Body.Bytes(), &points); err != nil {
		t.Fatalf("failed to decode JSON response: %v", err)
	}

	if len(points) == 0 {
		t.Fatalf("expected telemetry points, got 0")
	}

	// The latest point must match the recorded telemetry accurately without jitter
	lastPt := points[len(points)-1]
	if lastPt.CPU != 48.75 {
		t.Errorf("expected CPU 48.75, got %f", lastPt.CPU)
	}
	if lastPt.Memory != 384 {
		t.Errorf("expected Memory 384, got %d", lastPt.Memory)
	}
	if lastPt.MemoryPercent != 75 { // (384 * 100) / 512 = 75%
		t.Errorf("expected MemoryPercent 75, got %d", lastPt.MemoryPercent)
	}
	if lastPt.NetworkRx != 128.5 {
		t.Errorf("expected NetworkRx 128.5, got %f", lastPt.NetworkRx)
	}
	if lastPt.NetworkTx != 256.0 {
		t.Errorf("expected NetworkTx 256.0, got %f", lastPt.NetworkTx)
	}
	if lastPt.DiskRead != 2048 {
		t.Errorf("expected DiskRead 2048, got %d", lastPt.DiskRead)
	}
	if lastPt.DiskWrite != 4096 {
		t.Errorf("expected DiskWrite 4096, got %d", lastPt.DiskWrite)
	}
}

func TestClusterMetricsHeartbeatAggregationAccurate(t *testing.T) {
	router, orch := setupTestRouter(t)
	ctx := context.Background()

	// Register node with 9523 MB total (~9.3 GB)
	_, err := orch.RegisterNode(ctx, &takov1.RegisterNodeRequest{
		NodeId:        "node-cluster-test",
		Name:          "node-cluster-test",
		IpAddress:     "192.168.1.50",
		EnrollToken:   "test-enroll",
		MemoryTotalMb: 9523,
		CpuTotalCores: 8,
		DiskTotalGb:   100,
	})
	if err != nil {
		t.Fatalf("RegisterNode failed: %v", err)
	}

	// Simulate 10 heartbeats within the same minute reporting ~4900 MB used (~51-53% of 9.3 GB)
	now := time.Now().Unix()
	for i := 0; i < 10; i++ {
		_, err = orch.Heartbeat(ctx, &takov1.HeartbeatRequest{
			NodeId:        "node-cluster-test",
			CpuPercent:    25.0,
			MemoryUsedMb:  4900,
			DiskUsedGb:    20.0,
			NetworkRxKbps: 50.0,
			NetworkTxKbps: 80.0,
			UptimeSeconds: int64(100 + i*5),
			Timestamp:     now + int64(i*2),
		})
		if err != nil {
			t.Fatalf("Heartbeat %d failed: %v", i, err)
		}
	}

	// Fetch cluster-wide metrics (GET /api/v1/metrics?range=1h)
	req := httptest.NewRequest(http.MethodGet, "/api/v1/metrics?range=1h", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200 OK, got %d: %s", w.Code, w.Body.String())
	}

	var clusterPoints []api.MetricPointResponse
	if err := json.Unmarshal(w.Body.Bytes(), &clusterPoints); err != nil {
		t.Fatalf("failed to decode JSON response: %v", err)
	}

	if len(clusterPoints) == 0 {
		t.Fatalf("expected at least 1 cluster metric point, got 0")
	}

	point := clusterPoints[len(clusterPoints)-1]
	// Memory used should be ~4900 MB (4.8 GB), NOT 10 * 4900 = 49000 MB!
	if point.Memory > 5500 || point.Memory < 4500 {
		t.Errorf("expected cluster memory around 4900 MB, got %d MB (heartbeats leaked into sum)", point.Memory)
	}
	if point.MemoryPercent < 50 || point.MemoryPercent > 55 {
		t.Errorf("expected cluster memory percent around 51-53%%, got %d%%", point.MemoryPercent)
	}
	// Network should also not be inflated 10x
	if point.NetworkRx > 100 {
		t.Errorf("expected NetworkRx around 50 KBps, got %f", point.NetworkRx)
	}
}
