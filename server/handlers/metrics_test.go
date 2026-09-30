package handlers

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"gettako.dev/tako/server/monitoring"
	"gettako.dev/tako/internal/protocol"
)

func TestGetServiceMetrics_Unauthenticated(t *testing.T) {
	_, r, _ := setupTestRouter(t)

	req := httptest.NewRequest(http.MethodGet, "/api/services/svc_123/metrics", nil)
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401 Unauthorized, got %d", rec.Code)
	}
}

func TestGetServiceMetrics_NotFound(t *testing.T) {
	_, r, cookie := setupTestRouter(t)

	req := httptest.NewRequest(http.MethodGet, "/api/services/non_existent_srv/metrics", nil)
	req.AddCookie(cookie)
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	if rec.Code != http.StatusNotFound {
		t.Fatalf("expected 404 Not Found, got %d", rec.Code)
	}
}

func TestGetServiceMetrics_Success(t *testing.T) {
	database, r, cookie, _, serviceID := setupDeployTestRouter(t)

	mm := monitoring.NewMetricsManager(database)
	now := time.Now().Unix()

	// Store test metrics
	report := &protocol.ServiceMetricsReport{
		Metrics: []*protocol.ServiceMetricPoint{
			{
				ServiceId:        serviceID,
				ContainerId:      "cnt_test_1",
				CpuPercent:       2.4,
				MemoryBytes:      64 * 1024 * 1024,
				MemoryLimitBytes: 512 * 1024 * 1024,
				NetworkRxBytes:   1000,
				NetworkTxBytes:   2000,
				RestartCount:     0,
				Timestamp:        now - 60,
			},
			{
				ServiceId:        serviceID,
				ContainerId:      "cnt_test_1",
				CpuPercent:       4.8,
				MemoryBytes:      80 * 1024 * 1024,
				MemoryLimitBytes: 512 * 1024 * 1024,
				NetworkRxBytes:   2500,
				NetworkTxBytes:   3200,
				RestartCount:     0,
				Timestamp:        now - 30,
			},
		},
		Timestamp: now,
	}
	if err := mm.StoreReport(t.Context(), report); err != nil {
		t.Fatalf("failed to store report: %v", err)
	}

	req := httptest.NewRequest(http.MethodGet, "/api/services/"+serviceID+"/metrics?range=1h", nil)
	req.AddCookie(cookie)
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200 OK, got %d: %s", rec.Code, rec.Body.String())
	}

	var res monitoring.ServiceMetricsResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &res); err != nil {
		t.Fatalf("failed to parse response json: %v", err)
	}

	if res.ServiceID != serviceID {
		t.Errorf("expected service_id %s, got %s", serviceID, res.ServiceID)
	}
	if res.Range != "1h" {
		t.Errorf("expected range 1h, got %s", res.Range)
	}
	if len(res.Points) != 2 {
		t.Fatalf("expected 2 points, got %d", len(res.Points))
	}
	if res.Current.CPUPercent != 4.8 {
		t.Errorf("expected current CPU 4.8, got %.2f", res.Current.CPUPercent)
	}
}
