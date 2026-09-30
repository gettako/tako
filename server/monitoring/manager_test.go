package monitoring

import (
	"context"
	"database/sql"
	"testing"
	"time"

	_ "modernc.org/sqlite"

	"gettako.dev/tako/internal/models"
	"gettako.dev/tako/internal/protocol"
)

func setupTestDB(t *testing.T) *sql.DB {
	t.Helper()
	db, err := sql.Open("sqlite", ":memory:")
	if err != nil {
		t.Fatalf("failed to open sqlite memory db: %v", err)
	}

	schema := `
	CREATE TABLE services (
		id TEXT PRIMARY KEY,
		name TEXT NOT NULL
	);
	INSERT INTO services (id, name) VALUES ('srv_test_1', 'Test App');

	CREATE TABLE service_metrics (
		id TEXT PRIMARY KEY,
		service_id TEXT NOT NULL REFERENCES services(id) ON DELETE CASCADE,
		container_id TEXT NOT NULL,
		cpu_percent REAL NOT NULL,
		memory_bytes INTEGER NOT NULL,
		memory_limit_bytes INTEGER NOT NULL,
		network_rx_bytes INTEGER NOT NULL,
		network_tx_bytes INTEGER NOT NULL,
		restart_count INTEGER NOT NULL,
		timestamp INTEGER NOT NULL
	);
	CREATE INDEX idx_service_metrics_service_time ON service_metrics(service_id, timestamp);

	CREATE TABLE service_metrics_rollups (
		id TEXT PRIMARY KEY,
		service_id TEXT NOT NULL REFERENCES services(id) ON DELETE CASCADE,
		cpu_percent_avg REAL NOT NULL,
		cpu_percent_max REAL NOT NULL,
		memory_bytes_avg INTEGER NOT NULL,
		memory_bytes_max INTEGER NOT NULL,
		network_rx_bytes INTEGER NOT NULL,
		network_tx_bytes INTEGER NOT NULL,
		restart_count INTEGER NOT NULL,
		timestamp INTEGER NOT NULL
	);
	CREATE INDEX idx_service_metrics_rollups_service_time ON service_metrics_rollups(service_id, timestamp);
	`
	if _, err := db.Exec(schema); err != nil {
		t.Fatalf("failed to create tables: %v", err)
	}
	return db
}

func TestStoreAndGetMetrics(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()

	mgr := NewMetricsManager(db)
	ctx := context.Background()

	now := time.Now().Unix()
	report := &protocol.ServiceMetricsReport{
		Metrics: []*protocol.ServiceMetricPoint{
			{
				ServiceId:        "srv_test_1",
				ContainerId:      "cnt_1",
				CpuPercent:       2.5,
				MemoryBytes:      100 * 1024 * 1024,
				MemoryLimitBytes: 1024 * 1024 * 1024,
				NetworkRxBytes:   1000,
				NetworkTxBytes:   500,
				RestartCount:     0,
				Timestamp:        now - 60,
			},
			{
				ServiceId:        "srv_test_1",
				ContainerId:      "cnt_1",
				CpuPercent:       5.0,
				MemoryBytes:      120 * 1024 * 1024,
				MemoryLimitBytes: 1024 * 1024 * 1024,
				NetworkRxBytes:   2500,
				NetworkTxBytes:   1100,
				RestartCount:     0,
				Timestamp:        now - 30,
			},
		},
		Timestamp: now,
	}

	if err := mgr.StoreReport(ctx, report); err != nil {
		t.Fatalf("failed to store report: %v", err)
	}

	res, err := mgr.GetMetrics(ctx, "srv_test_1", "1h")
	if err != nil {
		t.Fatalf("failed to get metrics: %v", err)
	}

	if res.ServiceID != "srv_test_1" {
		t.Errorf("expected service_id 'srv_test_1', got %s", res.ServiceID)
	}
	if len(res.Points) != 2 {
		t.Fatalf("expected 2 points, got %d", len(res.Points))
	}

	// Verify rate calculation on second point: (2500 - 1000) / 30 = 50 bytes/s
	p2 := res.Points[1]
	expectedRxRate := float64(2500-1000) / 30.0
	if p2.NetworkRxRate != expectedRxRate {
		t.Errorf("expected rx rate %.2f, got %.2f", expectedRxRate, p2.NetworkRxRate)
	}

	// Verify current metrics matches the latest point
	if res.Current.CPUPercent != 5.0 {
		t.Errorf("expected current CPU 5.0, got %.2f", res.Current.CPUPercent)
	}
	if res.Current.MemoryBytes != 120*1024*1024 {
		t.Errorf("expected current RAM 120MB, got %d", res.Current.MemoryBytes)
	}
}

func TestRollupAndPrune(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()

	mgr := NewMetricsManager(db)
	ctx := context.Background()

	now := time.Now()
	// Insert points older than 24 hours (e.g. 26 hours ago in the same hour bucket)
	t26hAgo := now.Add(-26 * time.Hour).Unix()
	hourBucket := (t26hAgo / 3600) * 3600

	points := []*protocol.ServiceMetricPoint{
		{
			ServiceId:        "srv_test_1",
			ContainerId:      "cnt_old",
			CpuPercent:       10.0,
			MemoryBytes:      50 * 1024 * 1024,
			MemoryLimitBytes: 1024 * 1024 * 1024,
			NetworkRxBytes:   5000,
			NetworkTxBytes:   2000,
			RestartCount:     1,
			Timestamp:        hourBucket + 30,
		},
		{
			ServiceId:        "srv_test_1",
			ContainerId:      "cnt_old",
			CpuPercent:       20.0,
			MemoryBytes:      70 * 1024 * 1024,
			MemoryLimitBytes: 1024 * 1024 * 1024,
			NetworkRxBytes:   8000,
			NetworkTxBytes:   3500,
			RestartCount:     1,
			Timestamp:        hourBucket + 60,
		},
		// Recent point (within last 1 hour)
		{
			ServiceId:        "srv_test_1",
			ContainerId:      "cnt_recent",
			CpuPercent:       3.0,
			MemoryBytes:      60 * 1024 * 1024,
			MemoryLimitBytes: 1024 * 1024 * 1024,
			NetworkRxBytes:   10000,
			NetworkTxBytes:   4000,
			RestartCount:     1,
			Timestamp:        now.Add(-10 * time.Minute).Unix(),
		},
	}

	if err := mgr.StoreReport(ctx, &protocol.ServiceMetricsReport{Metrics: points}); err != nil {
		t.Fatalf("failed to store points: %v", err)
	}

	// Insert an expired rollup (older than 31 days)
	t31dDaysAgo := now.Add(-31 * 24 * time.Hour).Unix()
	_, err := db.Exec(`
		INSERT INTO service_metrics_rollups (
			id, service_id, cpu_percent_avg, cpu_percent_max, memory_bytes_avg, memory_bytes_max,
			network_rx_bytes, network_tx_bytes, restart_count, timestamp
		) VALUES ('rol_expired', 'srv_test_1', 15.0, 25.0, 50000, 60000, 100, 50, 0, ?)
	`, t31dDaysAgo)
	if err != nil {
		t.Fatalf("failed to insert expired rollup: %v", err)
	}

	// Run rollup and prune
	if err := mgr.RollupAndPrune(ctx, now); err != nil {
		t.Fatalf("failed to rollup and prune: %v", err)
	}

	// 1. High-res points older than 24h should be pruned from service_metrics
	var count int
	if err := db.QueryRow("SELECT count(*) FROM service_metrics WHERE timestamp < ?", now.Add(-24*time.Hour).Unix()).Scan(&count); err != nil {
		t.Fatalf("query failed: %v", err)
	}
	if count != 0 {
		t.Errorf("expected 0 old high-res points, got %d", count)
	}

	// Recent point should still be in service_metrics
	if err := db.QueryRow("SELECT count(*) FROM service_metrics").Scan(&count); err != nil {
		t.Fatalf("query failed: %v", err)
	}
	if count != 1 {
		t.Errorf("expected 1 recent high-res point, got %d", count)
	}

	// 2. Rolled up record should exist in service_metrics_rollups
	var cpuAvg, cpuMax float64
	var memAvg int64
	err = db.QueryRow("SELECT cpu_percent_avg, cpu_percent_max, memory_bytes_avg FROM service_metrics_rollups WHERE timestamp = ?", hourBucket).Scan(&cpuAvg, &cpuMax, &memAvg)
	if err != nil {
		t.Fatalf("failed to find rollup record: %v", err)
	}
	if cpuAvg != 15.0 || cpuMax != 20.0 {
		t.Errorf("expected cpuAvg=15.0, cpuMax=20.0, got avg=%.2f, max=%.2f", cpuAvg, cpuMax)
	}
	if memAvg != int64(60*1024*1024) {
		t.Errorf("expected memAvg=60MB, got %d", memAvg)
	}

	// 3. Expired rollup (> 30 days) should have been deleted
	var expiredCount int
	if err := db.QueryRow("SELECT count(*) FROM service_metrics_rollups WHERE id = 'rol_expired'").Scan(&expiredCount); err != nil {
		t.Fatalf("query failed: %v", err)
	}
	if expiredCount != 0 {
		t.Errorf("expected expired rollup to be purged, but it still exists")
	}

	// 4. Test 7d range query retrieves rollups and recent high-res
	res7d, err := mgr.GetMetrics(ctx, "srv_test_1", "7d")
	if err != nil {
		t.Fatalf("failed to get 7d metrics: %v", err)
	}
	if len(res7d.Points) < 2 {
		t.Errorf("expected at least 2 points in 7d range, got %d", len(res7d.Points))
	}
}

func TestMetricsManager_ContainerRestartNotification(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()

	mgr := NewMetricsManager(db)
	ctx := context.Background()

	var receivedNotification *models.NotificationPayload
	mgr.SetNotifyHook(func(p models.NotificationPayload) {
		receivedNotification = &p
	})

	// Initial report with restart_count = 0
	report1 := &protocol.ServiceMetricsReport{
		Timestamp: 1000,
		Metrics: []*protocol.ServiceMetricPoint{
			{
				ServiceId:        "srv_test_1",
				ContainerId:      "container_abc",
				CpuPercent:       10.0,
				MemoryBytes:      50 * 1024 * 1024,
				MemoryLimitBytes: 512 * 1024 * 1024,
				RestartCount:     0,
				Timestamp:        1000,
			},
		},
	}
	if err := mgr.StoreReport(ctx, report1); err != nil {
		t.Fatalf("failed to store report 1: %v", err)
	}
	if receivedNotification != nil {
		t.Fatalf("expected no notification on restart_count 0")
	}

	// Subsequent report with restart_count = 1 (container restart / crash)
	report2 := &protocol.ServiceMetricsReport{
		Timestamp: 1030,
		Metrics: []*protocol.ServiceMetricPoint{
			{
				ServiceId:        "srv_test_1",
				ContainerId:      "container_abc",
				CpuPercent:       12.0,
				MemoryBytes:      55 * 1024 * 1024,
				MemoryLimitBytes: 512 * 1024 * 1024,
				RestartCount:     1,
				Timestamp:        1030,
			},
		},
	}
	if err := mgr.StoreReport(ctx, report2); err != nil {
		t.Fatalf("failed to store report 2: %v", err)
	}

	if receivedNotification == nil {
		t.Fatalf("expected notification on restart_count increase, got nil")
	}
	if receivedNotification.Event != models.NotificationEventContainerCrashed {
		t.Errorf("expected event %s, got %s", models.NotificationEventContainerCrashed, receivedNotification.Event)
	}
	if receivedNotification.ServiceID != "srv_test_1" || receivedNotification.ServiceName != "Test App" {
		t.Errorf("unexpected payload: %+v", receivedNotification)
	}
}

