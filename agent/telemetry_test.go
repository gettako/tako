package main

import (
	"context"
	"runtime"
	"testing"
	"time"
)

func TestTelemetrySampling(t *testing.T) {
	sampler := NewTelemetrySampler(nil)
	ctx := context.Background()

	hb := sampler.Sample(ctx)
	if hb == nil {
		t.Fatal("expected non-nil heartbeat from sample")
	}

	if hb.RamPercent <= 0 {
		t.Fatalf("expected positive RAM percent, got %f", hb.RamPercent)
	}

	if hb.DiskPercent <= 0 {
		t.Fatalf("expected positive Disk percent, got %f", hb.DiskPercent)
	}

	if hb.Timestamp <= 0 {
		t.Fatalf("expected non-zero timestamp, got %d", hb.Timestamp)
	}
}

func TestTelemetryHeartbeatLoopEmission(t *testing.T) {
	creds := &AgentCredentials{
		NodeID:     "srv_test_node",
		NodeSecret: "secret",
		ServerURL:  "http://localhost:50051",
	}

	client := NewSessionClient(creds, nil)
	client.connected = true // simulate connected state

	sampler := NewTelemetrySampler(nil)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	go sampler.StartHeartbeatLoop(ctx, client, 25*time.Millisecond)

	var receivedCount int
	timeout := time.After(200 * time.Millisecond)

	for receivedCount < 3 {
		select {
		case msg := <-client.outgoing:
			if msg.GetHeartbeat() != nil {
				receivedCount++
			}
		case <-timeout:
			t.Fatalf("expected at least 3 heartbeats emitted, got %d", receivedCount)
		}
	}
}

func TestTelemetryNoMemoryLeak(t *testing.T) {
	sampler := NewTelemetrySampler(nil)
	ctx := context.Background()

	// Warm up
	for i := 0; i < 50; i++ {
		_ = sampler.Sample(ctx)
	}

	runtime.GC()
	var m1 runtime.MemStats
	runtime.ReadMemStats(&m1)

	for i := 0; i < 500; i++ {
		hb := sampler.Sample(ctx)
		_ = hb.Timestamp
	}

	runtime.GC()
	var m2 runtime.MemStats
	runtime.ReadMemStats(&m2)

	// HeapAlloc difference shouldn't exceed 2MB after GC
	diff := int64(m2.HeapAlloc) - int64(m1.HeapAlloc)
	if diff > 2*1024*1024 {
		t.Fatalf("potential memory leak in telemetry sampling: heap grew by %d bytes", diff)
	}
}

func TestServiceMetricsSampling(t *testing.T) {
	sampler := NewTelemetrySampler(nil)
	ctx := context.Background()

	report := sampler.SampleServiceMetrics(ctx)
	if report == nil {
		t.Fatal("expected non-nil service metrics report")
	}
	if report.Timestamp <= 0 {
		t.Fatalf("expected valid timestamp, got %d", report.Timestamp)
	}

	creds := &AgentCredentials{
		NodeID:     "srv_test_node",
		NodeSecret: "secret",
		ServerURL:  "http://localhost:50051",
	}
	client := NewSessionClient(creds, nil)
	client.connected = true

	// Directly call sendServiceMetrics (with an empty or dummy report)
	sampler.sendServiceMetrics(ctx, client)
}

