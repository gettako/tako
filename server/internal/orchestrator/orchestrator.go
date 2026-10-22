// Package orchestrator coordinates cluster-wide operations: node registrations,
// heartbeats, deployment pipelines, container actions, user auth sessions, and cron tasks.
package orchestrator

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"log"
	"sync"
	"time"

	"gettako.dev/tako/internal/events"
	"gettako.dev/tako/internal/store/db"
	takov1 "gettako.dev/tako/proto/gen/go/tako/v1"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

// Config specifies orchestrator timeouts and enrollment secret.
type Config struct {
	MasterEnrollToken string
	LivenessInterval  time.Duration
	LivenessTimeout   time.Duration
}

// Orchestrator manages cluster state, node heartbeats, agent streams,
// telemetry, deployment lifecycles, and retention pruning.
type Orchestrator struct {
	db          *sql.DB
	queries     *db.Queries
	bus         *events.Bus
	enrollToken string

	sessions  *SessionStore
	telemetry *TelemetryStore
	agents    *AgentRegistry
	retention *RetentionCleaner

	nodeTokensMu sync.RWMutex
	nodeTokens   map[string]string
}

// New initializes an Orchestrator with database, event bus, and session stores.
func New(database *sql.DB, bus *events.Bus, enrollToken string) *Orchestrator {
	return &Orchestrator{
		db:          database,
		queries:     db.New(database),
		bus:         bus,
		enrollToken: enrollToken,
		sessions:    NewSessionStore(),
		telemetry:   NewTelemetryStore(),
		agents:      NewAgentRegistry(),
		retention:   NewRetentionCleaner(database),
		nodeTokens:  make(map[string]string),
	}
}

// RegisterUserSession tracks an active logged-in console user session by auth token.
func (o *Orchestrator) RegisterUserSession(token string, user db.User) UserSession {
	return o.sessions.Register(token, user)
}

// GetUserSession retrieves user session metadata for an authenticated token.
func (o *Orchestrator) GetUserSession(token string) (UserSession, bool) {
	return o.sessions.Get(token)
}

// RevokeUserSession clears a user session on logout.
func (o *Orchestrator) RevokeUserSession(token string) {
	o.sessions.Revoke(token)
}

// RegisterNodeAuthToken maps an agent authentication token to its node ID.
func (o *Orchestrator) RegisterNodeAuthToken(token, nodeID string) {
	o.nodeTokensMu.Lock()
	defer o.nodeTokensMu.Unlock()
	if o.nodeTokens == nil {
		o.nodeTokens = make(map[string]string)
	}
	o.nodeTokens[token] = nodeID
}

// ValidateNodeAuthToken checks if a bearer token corresponds to an active enrolled agent.
func (o *Orchestrator) ValidateNodeAuthToken(token string) (string, bool) {
	o.nodeTokensMu.RLock()
	defer o.nodeTokensMu.RUnlock()
	if o.nodeTokens == nil {
		return "", false
	}
	nodeID, ok := o.nodeTokens[token]
	return nodeID, ok
}

// Queries returns the sqlc database queries interface.
func (o *Orchestrator) Queries() *db.Queries {
	return o.queries
}

// DB returns the underlying sql.DB connection pool.
func (o *Orchestrator) DB() *sql.DB {
	return o.db
}

// Bus returns the central event bus for publishing SSE and audit events.
func (o *Orchestrator) Bus() *events.Bus {
	return o.bus
}

// RegisterAgentSession registers an active bi-directional task stream for a worker node.
func (o *Orchestrator) RegisterAgentSession(nodeID string, taskChan chan *takov1.MasterTask) *AgentSession {
	return o.agents.Register(nodeID, taskChan)
}

// UnregisterAgentSession unregisters an agent session when gRPC stream disconnects.
func (o *Orchestrator) UnregisterAgentSession(nodeID string) {
	o.agents.Unregister(nodeID)
}

// GetAgentSession returns the active agent session for a given node ID, or nil if offline.
func (o *Orchestrator) GetAgentSession(nodeID string) *AgentSession {
	return o.agents.Get(nodeID)
}

// DispatchExec executes a terminal command inside a container on the host node via agent stream.
func (o *Orchestrator) DispatchExec(ctx context.Context, nodeID, containerID, cmd string) (string, int, error) {
	return o.agents.DispatchExec(ctx, nodeID, containerID, cmd)
}

// DispatchContainerLogs retrieves stdout/stderr logs from a container via agent stream.
func (o *Orchestrator) DispatchContainerLogs(ctx context.Context, nodeID, containerID string, tailLines int) (string, error) {
	return o.agents.DispatchContainerLogs(ctx, nodeID, containerID, tailLines)
}

// DispatchContainerAction sends start, stop, restart, or reboot commands to an agent.
func (o *Orchestrator) DispatchContainerAction(ctx context.Context, nodeID, containerID, action string) error {
	return o.agents.DispatchContainerAction(ctx, nodeID, containerID, action)
}

// GenerateEnrollToken creates a cryptographically random enrollment token.
func (o *Orchestrator) GenerateEnrollToken() string {
	return randomHex(24)
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

	authToken := fmt.Sprintf("tako-agent-%s-%s", nodeID, randomHex(16))
	o.RegisterNodeAuthToken(authToken, nodeID)
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

	uptimeStr := formatUptime(req.GetUptimeSeconds())

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

	memTotal := int64(8192)
	diskTotal := int64(100)
	if node, err := o.queries.GetNodeByID(ctx, nodeID); err == nil {
		if node.MemoryTotalMb > 0 {
			memTotal = node.MemoryTotalMb
		}
		if node.DiskTotalGb > 0 {
			diskTotal = int64(node.DiskTotalGb)
		}
	}

	_, _ = o.queries.RecordNodeMetric(ctx, db.RecordNodeMetricParams{
		NodeID:        nodeID,
		CpuPercent:    req.GetCpuPercent(),
		MemoryUsedMb:  req.GetMemoryUsedMb(),
		MemoryTotalMb: memTotal,
		DiskUsedGb:    int64(req.GetDiskUsedGb()),
		DiskTotalGb:   diskTotal,
		NetworkRxKbps: req.GetNetworkRxKbps(),
		NetworkTxKbps: req.GetNetworkTxKbps(),
	})

	// Process container-level real-time telemetry from agent
	if len(req.GetContainers()) > 0 {
		o.telemetry.RecordContainerSamples(req.GetContainers())
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

// GetLatestServiceTelemetry returns the most recently recorded telemetry sample for a service.
func (o *Orchestrator) GetLatestServiceTelemetry(serviceID, serviceSlug string) (ServiceTelemetryPoint, bool) {
	return o.telemetry.GetLatest(serviceID, serviceSlug)
}

// GetServiceTelemetryHistory returns historical recorded telemetry points for a service.
func (o *Orchestrator) GetServiceTelemetryHistory(serviceID, serviceSlug string) []ServiceTelemetryPoint {
	return o.telemetry.GetHistory(serviceID, serviceSlug)
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
					o.UnregisterAgentSession(node.ID)
					log.Printf("[orchestrator] node %s (%s) marked offline due to inactivity (>%ds)", node.ID, node.Name, timeoutSec)
					o.bus.Publish(events.Event{
						Type: events.EventNodeStatusChanged,
						Payload: map[string]any{
							"node_id": node.ID,
							"status":  "offline",
							"name":    node.Name,
						},
					})

					// Mark all active services hosted on this node as unhealthy
					impacted, err := o.queries.MarkServicesUnhealthyByNode(ctx, node.ID)
					if err == nil {
						for _, srv := range impacted {
							log.Printf("[orchestrator] service %s (%s) marked unhealthy because host node %s went offline", srv.Name, srv.ID, node.ID)
							o.bus.Publish(events.Event{
								Type: events.EventServiceUpdated,
								Payload: map[string]any{
									"service_id": srv.ID,
									"project_id": srv.ProjectID,
									"node_id":    node.ID,
									"name":       srv.Name,
									"slug":       srv.Slug,
									"status":     "unhealthy",
								},
							})
						}
					}
				}

				// Reconcile any services on already offline nodes (e.g. at startup or after external state changes)
				impactedOffline, err := o.queries.MarkServicesUnhealthyForOfflineNodes(ctx)
				if err == nil && len(impactedOffline) > 0 {
					for _, srv := range impactedOffline {
						log.Printf("[orchestrator] service %s (%s) reconciled to unhealthy because host node %s is offline", srv.Name, srv.ID, srv.NodeID)
						o.bus.Publish(events.Event{
							Type: events.EventServiceUpdated,
							Payload: map[string]any{
								"service_id": srv.ID,
								"project_id": srv.ProjectID,
								"node_id":    srv.NodeID,
								"name":       srv.Name,
								"slug":       srv.Slug,
								"status":     "unhealthy",
							},
						})
					}
				}
			}
		}
	}()
}

// StartRetentionCleaner periodically cleans up old non-live deployments and audit logs.
func (o *Orchestrator) StartRetentionCleaner(ctx context.Context, interval time.Duration, retentionDays int) {
	o.retention.Start(ctx, interval, retentionDays)
}

// RunRetentionCleanup performs a single cleanup pass on deployments and audit logs older than retentionDays.
func (o *Orchestrator) RunRetentionCleanup(ctx context.Context, retentionDays int) {
	o.retention.Prune(ctx, retentionDays)
}

// formatUptime converts uptime in seconds into human-readable duration strings (e.g. "3d 4h 12m").
func formatUptime(seconds int64) string {
	if seconds <= 0 {
		return "0s"
	}
	days := seconds / 86400
	hours := (seconds % 86400) / 3600
	minutes := (seconds % 3600) / 60
	remSec := seconds % 60

	if days > 0 {
		if hours > 0 {
			return fmt.Sprintf("%dd %dh %dm", days, hours, minutes)
		}
		return fmt.Sprintf("%dd %dm", days, minutes)
	}
	if hours > 0 {
		return fmt.Sprintf("%dh %dm", hours, minutes)
	}
	if minutes > 0 {
		return fmt.Sprintf("%dm %ds", minutes, remSec)
	}
	return fmt.Sprintf("%ds", remSec)
}
