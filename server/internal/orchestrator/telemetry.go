package orchestrator

import (
	"sync"
	"time"

	takov1 "gettako.dev/tako/proto/gen/go/tako/v1"
)

// ServiceTelemetryPoint represents a single metric snapshot of container CPU, RAM, Network, and Disk I/O.
type ServiceTelemetryPoint struct {
	Timestamp      time.Time `json:"timestamp"`
	CPUPercent     float64   `json:"cpuPercent"`
	MemoryUsedMB   int64     `json:"memoryUsedMb"`
	MemoryLimitMB  int64     `json:"memoryLimitMb"`
	NetworkRxKBps  float64   `json:"networkRxKbps"`
	NetworkTxKBps  float64   `json:"networkTxKbps"`
	DiskReadBytes  int64     `json:"diskReadBytes"`
	DiskWriteBytes int64     `json:"diskWriteBytes"`
}

// TelemetryStore caches real-time container metrics and a rolling window of history for dashboard charts.
type TelemetryStore struct {
	mu      sync.RWMutex
	latest  map[string]ServiceTelemetryPoint
	history map[string][]ServiceTelemetryPoint
}

// NewTelemetryStore constructs an initialized TelemetryStore.
func NewTelemetryStore() *TelemetryStore {
	return &TelemetryStore{
		latest:  make(map[string]ServiceTelemetryPoint),
		history: make(map[string][]ServiceTelemetryPoint),
	}
}

// RecordContainerSamples ingests container metrics, updating the latest point and appending to rolling history.
func (t *TelemetryStore) RecordContainerSamples(containers []*takov1.ContainerTelemetry) {
	if len(containers) == 0 {
		return
	}
	t.mu.Lock()
	defer t.mu.Unlock()

	now := time.Now().UTC()
	for _, c := range containers {
		pt := ServiceTelemetryPoint{
			Timestamp:      now,
			CPUPercent:     c.GetCpuPercent(),
			MemoryUsedMB:   c.GetMemoryUsedMb(),
			MemoryLimitMB:  c.GetMemoryLimitMb(),
			NetworkRxKBps:  c.GetNetworkRxKbps(),
			NetworkTxKBps:  c.GetNetworkTxKbps(),
			DiskReadBytes:  c.GetDiskReadBytes(),
			DiskWriteBytes: c.GetDiskWriteBytes(),
		}

		keys := make(map[string]struct{})
		if c.GetServiceId() != "" {
			keys[c.GetServiceId()] = struct{}{}
		}
		if c.GetServiceSlug() != "" {
			keys[c.GetServiceSlug()] = struct{}{}
		}
		if c.GetName() != "" {
			keys[c.GetName()] = struct{}{}
		}

		for k := range keys {
			t.latest[k] = pt
			hist := t.history[k]
			hist = append(hist, pt)
			if len(hist) > 120 {
				hist = hist[len(hist)-120:]
			}
			t.history[k] = hist
		}
	}
}

// GetLatest retrieves the most recently sampled telemetry point for a service.
func (t *TelemetryStore) GetLatest(serviceID, serviceSlug string) (ServiceTelemetryPoint, bool) {
	t.mu.RLock()
	defer t.mu.RUnlock()
	if pt, ok := t.latest[serviceID]; ok {
		return pt, true
	}
	if pt, ok := t.latest[serviceSlug]; ok {
		return pt, true
	}
	return ServiceTelemetryPoint{}, false
}

// GetHistory returns up to 120 historic metric points for a service.
func (t *TelemetryStore) GetHistory(serviceID, serviceSlug string) []ServiceTelemetryPoint {
	t.mu.RLock()
	defer t.mu.RUnlock()
	if hist, ok := t.history[serviceID]; ok && len(hist) > 0 {
		res := make([]ServiceTelemetryPoint, len(hist))
		copy(res, hist)
		return res
	}
	if hist, ok := t.history[serviceSlug]; ok && len(hist) > 0 {
		res := make([]ServiceTelemetryPoint, len(hist))
		copy(res, hist)
		return res
	}
	return nil
}
