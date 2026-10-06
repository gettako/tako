package metrics_test

import (
	"context"
	"testing"
	"time"

	"gettako.dev/tako/agent/internal/metrics"
)

func TestMetricsCollection(t *testing.T) {
	collector := metrics.NewCollector()
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	sysInfo := collector.GetSystemInfo(ctx)
	if sysInfo.TotalCPUs <= 0 {
		t.Errorf("expected TotalCPUs > 0, got %d", sysInfo.TotalCPUs)
	}
	if sysInfo.TotalMemoryMB <= 0 {
		t.Errorf("expected TotalMemoryMB > 0, got %d", sysInfo.TotalMemoryMB)
	}
	if sysInfo.TotalDiskGB <= 0 {
		t.Errorf("expected TotalDiskGB > 0, got %f", sysInfo.TotalDiskGB)
	}

	snap := collector.Collect(ctx)
	if snap.CPUPercent < 0 || snap.CPUPercent > 100 {
		t.Errorf("unexpected CPU percent: %f", snap.CPUPercent)
	}
	if snap.MemoryUsedMB <= 0 {
		t.Errorf("expected MemoryUsedMB > 0, got %d", snap.MemoryUsedMB)
	}
	if snap.Timestamp <= 0 {
		t.Errorf("expected valid Timestamp, got %d", snap.Timestamp)
	}
}
