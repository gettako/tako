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
	if count15m != 15 || step15m != time.Minute {
		t.Errorf("RangeToStepConfig(15m) = (%d, %v); want (15, 1m)", count15m, step15m)
	}

	count1h, step1h := api.RangeToStepConfig(api.TimeRange1h)
	if count1h != 24 || step1h != time.Minute*2 {
		t.Errorf("RangeToStepConfig(1h) = (%d, %v); want (24, 2m)", count1h, step1h)
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
