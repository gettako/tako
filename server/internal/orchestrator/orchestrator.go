package orchestrator

import (
	"context"
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"errors"
	"fmt"
	"log"
	"time"

	"gettako.dev/tako/internal/events"
	"gettako.dev/tako/internal/store/db"
	takov1 "gettako.dev/tako/proto/gen/go/tako/v1"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

type Config struct {
	MasterEnrollToken string
	LivenessInterval  time.Duration
	LivenessTimeout   time.Duration
}

type Orchestrator struct {
	db          *sql.DB
	queries     *db.Queries
	bus         *events.Bus
	enrollToken string
}

func New(database *sql.DB, bus *events.Bus, enrollToken string) *Orchestrator {
	return &Orchestrator{
		db:          database,
		queries:     db.New(database),
		bus:         bus,
		enrollToken: enrollToken,
	}
}

func (o *Orchestrator) Queries() *db.Queries {
	return o.queries
}

func (o *Orchestrator) Bus() *events.Bus {
	return o.bus
}

// GenerateEnrollToken creates a cryptographically random enrollment token.
func (o *Orchestrator) GenerateEnrollToken() string {
	b := make([]byte, 16)
	_, _ = rand.Read(b)
	return "tako_enroll_" + hex.EncodeToString(b)
}

// RegisterNode handles node registration handshake and persists node record.
func (o *Orchestrator) RegisterNode(ctx context.Context, req *takov1.RegisterNodeRequest) (*takov1.RegisterNodeResponse, error) {
	if o.enrollToken != "" && req.GetEnrollToken() != o.enrollToken {
		return nil, status.Error(codes.PermissionDenied, "invalid enrollment token")
	}

	nodeID := req.GetNodeId()
	if nodeID == "" {
		nodeID = req.GetName()
	}

	// Clean up any stale or dummy unmanaged master nodes (e.g. 'node-master-01' from earlier dummy seed)
	if req.GetRole() == "leader" {
		if allNodes, err := o.queries.ListNodes(ctx); err == nil {
			for _, n := range allNodes {
				if n.ID != nodeID && (n.Role == "leader" || n.ID == "node-master-01") {
					_ = o.queries.DeleteNode(ctx, n.ID)
				}
			}
		}
	}

	// Check if node exists
	existing, err := o.queries.GetNodeByID(ctx, nodeID)
	if err != nil && !errors.Is(err, sql.ErrNoRows) {
		return nil, status.Errorf(codes.Internal, "database error: %v", err)
	}

	if errors.Is(err, sql.ErrNoRows) {
		_, err = o.queries.CreateNode(ctx, db.CreateNodeParams{
			ID:            nodeID,
			Name:          req.GetName(),
			IpAddress:     req.GetIpAddress(),
			PublicIp:      req.GetPublicIp(),
			Role:          req.GetRole(),
			Status:        "online",
			CpuTotalCores: int64(req.GetCpuTotalCores()),
			MemoryTotalMb: req.GetMemoryTotalMb(),
			DiskTotalGb:   req.GetDiskTotalGb(),
			DockerVersion: req.GetDockerVersion(),
			Os:            req.GetOs(),
			KernelVersion: req.GetKernelVersion(),
			EnrollToken:   req.GetEnrollToken(),
		})
		if err != nil {
			return nil, status.Errorf(codes.Internal, "failed to insert node: %v", err)
		}
		_, _ = o.db.ExecContext(ctx, "UPDATE nodes SET last_heartbeat = CURRENT_TIMESTAMP WHERE id = ?", nodeID)
	} else {
		// Existing node re-registering: update metadata, status and heartbeat
		_, _ = o.db.ExecContext(ctx, `UPDATE nodes SET
			name = ?,
			ip_address = ?,
			public_ip = ?,
			role = ?,
			status = 'online',
			cpu_total_cores = ?,
			memory_total_mb = ?,
			disk_total_gb = ?,
			docker_version = ?,
			os = ?,
			kernel_version = ?,
			last_heartbeat = CURRENT_TIMESTAMP,
			updated_at = CURRENT_TIMESTAMP
		WHERE id = ?`,
			req.GetName(),
			req.GetIpAddress(),
			req.GetPublicIp(),
			req.GetRole(),
			int64(req.GetCpuTotalCores()),
			req.GetMemoryTotalMb(),
			req.GetDiskTotalGb(),
			req.GetDockerVersion(),
			req.GetOs(),
			req.GetKernelVersion(),
			existing.ID,
		)
	}

	authToken := "tako-agent-" + nodeID
	registeredAt := time.Now().UTC().Format(time.RFC3339)

	o.bus.Publish(events.Event{
		Type: events.EventNodeStatusChanged,
		Payload: map[string]any{
			"node_id": nodeID,
			"status":  "online",
			"name":    req.GetName(),
		},
	})

	return &takov1.RegisterNodeResponse{
		NodeId:       nodeID,
		Status:       "registered",
		RegisteredAt: registeredAt,
		AuthToken:    authToken,
	}, nil
}

// Heartbeat updates node metrics in database and broadcasts metrics via Event Bus.
func (o *Orchestrator) Heartbeat(ctx context.Context, req *takov1.HeartbeatRequest) (*takov1.HeartbeatResponse, error) {
	nodeID := req.GetNodeId()

	uptimeStr := fmt.Sprintf("%ds", req.GetUptimeSeconds())

	err := o.queries.UpdateNodeHeartbeat(ctx, db.UpdateNodeHeartbeatParams{
		ID:            nodeID,
		Status:        "online",
		CpuPercent:    req.GetCpuPercent(),
		MemoryUsedMb:  req.GetMemoryUsedMb(),
		DiskUsedGb:    req.GetDiskUsedGb(),
		NetworkRxKbps: req.GetNetworkRxKbps(),
		NetworkTxKbps: req.GetNetworkTxKbps(),
		Uptime:        uptimeStr,
	})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to update heartbeat: %v", err)
	}

	o.bus.Publish(events.Event{
		Type: events.EventNodeMetrics,
		Payload: map[string]any{
			"node_id":         nodeID,
			"cpu_percent":     req.GetCpuPercent(),
			"memory_used_mb":  req.GetMemoryUsedMb(),
			"disk_used_gb":    req.GetDiskUsedGb(),
			"network_rx_kbps": req.GetNetworkRxKbps(),
			"network_tx_kbps": req.GetNetworkTxKbps(),
			"timestamp":       req.GetTimestamp(),
		},
	})

	return &takov1.HeartbeatResponse{
		Acknowledged: true,
		Timestamp:    time.Now().Unix(),
	}, nil
}

// StartLivenessWatcher monitors inactive nodes and transitions them to 'offline' if timeout exceeds threshold.
func (o *Orchestrator) StartLivenessWatcher(ctx context.Context, interval time.Duration, timeoutSec int) {
	if interval <= 0 {
		interval = 5 * time.Second
	}
	if timeoutSec < 0 {
		timeoutSec = 15
	}

	go func() {
		ticker := time.NewTicker(interval)
		defer ticker.Stop()

		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				timeoutParam := sql.NullString{String: fmt.Sprintf("+%d", timeoutSec), Valid: true}
				timedOutNodes, err := o.queries.MarkInactiveNodesOffline(ctx, timeoutParam)
				if err != nil {
					log.Printf("[orchestrator] liveness check error: %v", err)
					continue
				}

				for _, node := range timedOutNodes {
					log.Printf("[orchestrator] node %s (%s) marked offline due to inactivity (>%ds)", node.ID, node.Name, timeoutSec)
					o.bus.Publish(events.Event{
						Type: events.EventNodeStatusChanged,
						Payload: map[string]any{
							"node_id": node.ID,
							"status":  "offline",
							"name":    node.Name,
						},
					})
				}
			}
		}
	}()
}

