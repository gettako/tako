package orchestrator_test

import (
	"context"
	"testing"
	"time"

	"gettako.dev/tako/internal/orchestrator"
	"gettako.dev/tako/internal/store/db"
	takov1 "gettako.dev/tako/proto/gen/go/tako/v1"
)

func TestFeature_AutoscalingScaleUpAndDownLifecycle(t *testing.T) {
	orch, bus, cleanup := setupTestOrchestrator(t)
	defer cleanup()

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// 1. Create node
	nodeID := "node-auto-scale"
	_, err := orch.RegisterNode(ctx, &takov1.RegisterNodeRequest{
		NodeId:      nodeID,
		Name:        "AutoScale Node",
		Role:        "worker",
		EnrollToken: "test-enroll-token",
	})
	if err != nil {
		t.Fatalf("RegisterNode failed: %v", err)
	}

	// 2. Create service with auto-scaling configuration
	srv, err := orch.CreateService(ctx, orchestrator.CreateServiceParams{
		ProjectID: "proj-scale",
		NodeID:    nodeID,
		Name:      "Web Frontend",
		Slug:      "web-frontend",
		Type:      "app",
	})
	if err != nil {
		t.Fatalf("CreateService failed: %v", err)
	}

	// Update service to be live with auto-scaling enabled
	_, err = orch.DB().ExecContext(ctx, `
		UPDATE services SET
			status = 'live',
			replicas = 1,
			auto_scaling_enabled = 1,
			min_replicas = 1,
			max_replicas = 4,
			target_cpu_percent = 70.0,
			scale_down_cpu_percent = 25.0,
			auto_scaling_metric = 'cpu',
			cooldown_seconds = 1
		WHERE id = ?;
	`, srv.ID)
	if err != nil {
		t.Fatalf("failed to update service auto-scaling params: %v", err)
	}

	eventSub := bus.Subscribe()
	defer bus.Unsubscribe(eventSub)

	// 3. Inject High CPU Telemetry (90.0% > 70.0% target)
	_, err = orch.Heartbeat(ctx, &takov1.HeartbeatRequest{
		NodeId:     nodeID,
		CpuPercent: 50.0,
		Containers: []*takov1.ContainerTelemetry{
			{
				ServiceId:   srv.ID,
				CpuPercent:  90.0,
				MemoryUsedMb: 256,
			},
		},
	})
	if err != nil {
		t.Fatalf("Heartbeat failed: %v", err)
	}

	// 4. Trigger evaluation -> Expect Scale Up: 1 -> 2
	orch.EvaluateAutoScaling(ctx)

	updatedSrv, err := orch.Queries().GetServiceByID(ctx, srv.ID)
	if err != nil {
		t.Fatalf("GetServiceByID failed: %v", err)
	}
	if updatedSrv.Replicas != 2 {
		t.Fatalf("expected replicas to scale UP to 2, got %d", updatedSrv.Replicas)
	}

	// Verify audit log for autoscaled_up
	auditLogs, _ := orch.Queries().ListAuditLogs(ctx, db.ListAuditLogsParams{Limit: 5})
	var scaleUpAuditFound bool
	for _, al := range auditLogs {
		if al.Action == "autoscaled_up" && al.TargetID == srv.ID {
			scaleUpAuditFound = true
			break
		}
	}
	if !scaleUpAuditFound {
		t.Errorf("expected autoscaled_up audit log entry")
	}

	// 5. Test Cooldown Window: evaluate immediately again with 90% CPU
	// Should NOT scale up to 3 because cooldown window (1s) hasn't passed
	orch.EvaluateAutoScaling(ctx)
	cooldownSrv, _ := orch.Queries().GetServiceByID(ctx, srv.ID)
	if cooldownSrv.Replicas != 2 {
		t.Fatalf("expected replicas to stay at 2 during cooldown, got %d", cooldownSrv.Replicas)
	}

	// 6. Wait for cooldown to expire
	time.Sleep(1100 * time.Millisecond)

	// 7. Inject Low CPU Telemetry (10.0% < 25.0% scale down threshold)
	_, _ = orch.Heartbeat(ctx, &takov1.HeartbeatRequest{
		NodeId:     nodeID,
		CpuPercent: 20.0,
		Containers: []*takov1.ContainerTelemetry{
			{
				ServiceId:   srv.ID,
				CpuPercent:  10.0,
				MemoryUsedMb: 128,
			},
		},
	})

	// 8. Trigger evaluation -> Expect Scale Down: 2 -> 1
	orch.EvaluateAutoScaling(ctx)

	scaledDownSrv, err := orch.Queries().GetServiceByID(ctx, srv.ID)
	if err != nil {
		t.Fatalf("GetServiceByID failed: %v", err)
	}
	if scaledDownSrv.Replicas != 1 {
		t.Fatalf("expected replicas to scale DOWN to 1, got %d", scaledDownSrv.Replicas)
	}

	// 9. Min Replicas boundary protection:
	// Wait for cooldown, still low CPU, evaluate again -> replicas should stay at min (1)
	time.Sleep(1100 * time.Millisecond)
	orch.EvaluateAutoScaling(ctx)

	minBoundSrv, _ := orch.Queries().GetServiceByID(ctx, srv.ID)
	if minBoundSrv.Replicas < 1 {
		t.Fatalf("replicas dropped below min_replicas, got %d", minBoundSrv.Replicas)
	}
}

func TestFeature_AutoscalingMemoryMetric(t *testing.T) {
	orch, _, cleanup := setupTestOrchestrator(t)
	defer cleanup()

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	nodeID := "node-mem-scale"
	_, _ = orch.RegisterNode(ctx, &takov1.RegisterNodeRequest{
		NodeId:      nodeID,
		Name:        "Mem Scale Node",
		Role:        "worker",
		EnrollToken: "test-enroll-token",
	})

	srv, err := orch.CreateService(ctx, orchestrator.CreateServiceParams{
		ProjectID: "proj-mem",
		NodeID:    nodeID,
		Name:      "Cache Worker",
		Slug:      "cache-worker",
		Type:      "app",
	})
	if err != nil {
		t.Fatalf("CreateService failed: %v", err)
	}

	// Configure memory-based autoscaling
	_, err = orch.DB().ExecContext(ctx, `
		UPDATE services SET
			status = 'live',
			replicas = 1,
			auto_scaling_enabled = 1,
			min_replicas = 1,
			max_replicas = 5,
			auto_scaling_metric = 'memory',
			target_memory_percent = 70.0,
			memory_limit_mb = 1000,
			cooldown_seconds = 1
		WHERE id = ?;
	`, srv.ID)
	if err != nil {
		t.Fatalf("failed to update service memory auto-scaling params: %v", err)
	}

	// Inject High RAM Consumption (850 MB out of 1000 MB = 85.0% > 70.0%)
	_, err = orch.Heartbeat(ctx, &takov1.HeartbeatRequest{
		NodeId:     nodeID,
		CpuPercent: 10.0,
		Containers: []*takov1.ContainerTelemetry{
			{
				ServiceId:     srv.ID,
				MemoryUsedMb:  850,
				MemoryLimitMb: 1000,
				CpuPercent:    10.0,
			},
		},
	})
	if err != nil {
		t.Fatalf("Heartbeat failed: %v", err)
	}

	// Evaluate -> Scale UP 1 -> 2
	orch.EvaluateAutoScaling(ctx)

	updatedSrv, err := orch.Queries().GetServiceByID(ctx, srv.ID)
	if err != nil {
		t.Fatalf("GetServiceByID failed: %v", err)
	}
	if updatedSrv.Replicas != 2 {
		t.Fatalf("expected replicas to scale UP to 2 based on RAM, got %d", updatedSrv.Replicas)
	}
}
