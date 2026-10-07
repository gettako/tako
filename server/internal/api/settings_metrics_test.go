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

func TestSettingsAndMetricsAPI(t *testing.T) {
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

	// 1. Test PUT /api/v1/settings/s3_buckets
	putPayload, _ := json.Marshal(map[string]any{
		"value": []map[string]string{
			{"id": "s3-1", "name": "production-backups", "bucket": "tako-prod-backup"},
		},
	})
	req := httptest.NewRequest(http.MethodPut, "/api/v1/settings/s3_buckets", bytes.NewReader(putPayload))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200 OK for PUT settings, got %d: %s", w.Code, w.Body.String())
	}

	// 2. Test GET /api/v1/settings/s3_buckets
	req2 := httptest.NewRequest(http.MethodGet, "/api/v1/settings/s3_buckets", nil)
	w2 := httptest.NewRecorder()
	router.ServeHTTP(w2, req2)
	if w2.Code != http.StatusOK {
		t.Fatalf("expected 200 OK for GET settings, got %d: %s", w2.Code, w2.Body.String())
	}

	// 3. Register node and send heartbeat to populate metrics
	regResp, err := orch.RegisterNode(context.Background(), &takov1.RegisterNodeRequest{
		NodeId:        "node-test",
		Name:          "node-test",
		IpAddress:     "192.168.1.50",
		CpuTotalCores: 8,
		MemoryTotalMb: 16384,
		DiskTotalGb:   500,
		DockerVersion: "26.1.5",
		Os:            "linux",
		KernelVersion: "6.8.0",
		EnrollToken:   "test-secret",
	})
	if err != nil {
		t.Fatalf("RegisterNode failed: %v", err)
	}

	_, err = orch.Heartbeat(context.Background(), &takov1.HeartbeatRequest{
		NodeId:         regResp.NodeId,
		CpuPercent:     35.5,
		MemoryUsedMb:   4096,
		DiskUsedGb:     120,
		NetworkRxKbps:  250.0,
		NetworkTxKbps:  500.0,
		UptimeSeconds:  3600,
		Timestamp:      1000,
	})
	if err != nil {
		t.Fatalf("Heartbeat failed: %v", err)
	}

	// 4. Test GET /api/v1/metrics
	req3 := httptest.NewRequest(http.MethodGet, "/api/v1/metrics?nodeId="+regResp.NodeId+"&range=1h", nil)
	w3 := httptest.NewRecorder()
	router.ServeHTTP(w3, req3)
	if w3.Code != http.StatusOK {
		t.Fatalf("expected 200 OK for GET metrics, got %d: %s", w3.Code, w3.Body.String())
	}

	var metricPoints []MetricPointResponse
	if err := json.Unmarshal(w3.Body.Bytes(), &metricPoints); err != nil {
		t.Fatalf("failed to decode metrics JSON: %v", err)
	}
	if len(metricPoints) != 1 {
		t.Fatalf("expected 1 metric point from heartbeat, got %d", len(metricPoints))
	}
	if metricPoints[0].CPU != 35.5 {
		t.Errorf("expected CPU 35.5, got %f", metricPoints[0].CPU)
	}
	if metricPoints[0].Memory != 4096 {
		t.Errorf("expected Memory 4096, got %d", metricPoints[0].Memory)
	}
}
