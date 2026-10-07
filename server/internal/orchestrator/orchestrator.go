package orchestrator

import (
	"context"
	"crypto/rand"
	"database/sql"
	"encoding/hex"
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

type Config struct {
	MasterEnrollToken string
	LivenessInterval  time.Duration
	LivenessTimeout   time.Duration
}

type AgentSession struct {
	NodeID          string
	TaskChan        chan *takov1.MasterTask
	mu              sync.RWMutex
	logCallbacks    map[string]func(chunk *takov1.DeployLogChunk)
	resultCallbacks map[string]chan *takov1.AgentTaskResult
}

func (s *AgentSession) RegisterDeployLogCallback(taskID string, cb func(chunk *takov1.DeployLogChunk)) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.logCallbacks[taskID] = cb
}

func (s *AgentSession) UnregisterDeployLogCallback(taskID string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	delete(s.logCallbacks, taskID)
}

func (s *AgentSession) RegisterResultChan(taskID string, ch chan *takov1.AgentTaskResult) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.resultCallbacks[taskID] = ch
}

func (s *AgentSession) UnregisterResultChan(taskID string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	delete(s.resultCallbacks, taskID)
}

func (s *AgentSession) HandleResult(res *takov1.AgentTaskResult) {
	taskID := res.GetTaskId()
	s.mu.RLock()
	defer s.mu.RUnlock()

	if chunk := res.GetDeployLog(); chunk != nil {
		if cb, ok := s.logCallbacks[taskID]; ok {
			cb(chunk)
		}
	}

	if ch, ok := s.resultCallbacks[taskID]; ok {
		select {
		case ch <- res:
		default:
		}
	}
}

type Orchestrator struct {
	db          *sql.DB
	queries     *db.Queries
	bus         *events.Bus
	enrollToken string
	agentsMu    sync.RWMutex
	agents      map[string]*AgentSession
}

func New(database *sql.DB, bus *events.Bus, enrollToken string) *Orchestrator {
	return &Orchestrator{
		db:          database,
		queries:     db.New(database),
		bus:         bus,
		enrollToken: enrollToken,
		agents:      make(map[string]*AgentSession),
	}
}

func (o *Orchestrator) Queries() *db.Queries {
	return o.queries
}

func (o *Orchestrator) Bus() *events.Bus {
	return o.bus
}

func (o *Orchestrator) RegisterAgentSession(nodeID string, taskChan chan *takov1.MasterTask) *AgentSession {
	o.agentsMu.Lock()
	defer o.agentsMu.Unlock()

	sess := &AgentSession{
		NodeID:          nodeID,
		TaskChan:        taskChan,
		logCallbacks:    make(map[string]func(chunk *takov1.DeployLogChunk)),
		resultCallbacks: make(map[string]chan *takov1.AgentTaskResult),
	}
	o.agents[nodeID] = sess
	log.Printf("[orchestrator] registered agent task session for node: %s", nodeID)
	return sess
}

func (o *Orchestrator) UnregisterAgentSession(nodeID string) {
	o.agentsMu.Lock()
	defer o.agentsMu.Unlock()
	delete(o.agents, nodeID)
	log.Printf("[orchestrator] unregistered agent task session for node: %s", nodeID)
}

func (o *Orchestrator) GetAgentSession(nodeID string) *AgentSession {
	o.agentsMu.RLock()
	defer o.agentsMu.RUnlock()
	if sess, ok := o.agents[nodeID]; ok {
		return sess
	}
	if len(o.agents) == 1 {
		for _, s := range o.agents {
			return s
		}
	}
	return nil
}

func (o *Orchestrator) DispatchExec(ctx context.Context, nodeID, containerID, cmd string) (string, int, error) {
	sess := o.GetAgentSession(nodeID)
	if sess == nil {
		return "", 1, fmt.Errorf("node agent not connected: %s", nodeID)
	}

	taskID := "exec-" + randomHex(8)
	resCh := make(chan *takov1.AgentTaskResult, 1)
	sess.RegisterResultChan(taskID, resCh)
	defer sess.UnregisterResultChan(taskID)

	select {
	case sess.TaskChan <- &takov1.MasterTask{
		TaskId: taskID,
		NodeId: sess.NodeID,
		Task: &takov1.MasterTask_Exec{
			Exec: &takov1.ExecCommandRequest{
				ContainerId: containerID,
				Command:     cmd,
			},
		},
	}:
	case <-ctx.Done():
		return "", 1, ctx.Err()
	}

	select {
	case res := <-resCh:
		execRes := res.GetExecResult()
		if execRes == nil {
			return "", 1, fmt.Errorf("invalid response from agent")
		}
		if execRes.Error != "" && execRes.Output == "" {
			return "", int(execRes.ExitCode), fmt.Errorf("%s", execRes.Error)
		}
		return execRes.Output, int(execRes.ExitCode), nil
	case <-time.After(30 * time.Second):
		return "", 1, fmt.Errorf("exec timed out waiting for agent response")
	case <-ctx.Done():
		return "", 1, ctx.Err()
	}
}

func (o *Orchestrator) DispatchContainerLogs(ctx context.Context, nodeID, containerID string, tailLines int) (string, error) {
	sess := o.GetAgentSession(nodeID)
	if sess == nil {
		return "", fmt.Errorf("node agent not connected: %s", nodeID)
	}

	taskID := "logs-" + randomHex(8)
	resCh := make(chan *takov1.AgentTaskResult, 1)
	sess.RegisterResultChan(taskID, resCh)
	defer sess.UnregisterResultChan(taskID)

	select {
	case sess.TaskChan <- &takov1.MasterTask{
		TaskId: taskID,
		NodeId: sess.NodeID,
		Task: &takov1.MasterTask_ContainerLogs{
			ContainerLogs: &takov1.GetContainerLogsRequest{
				ContainerId: containerID,
				TailLines:   int32(tailLines),
			},
		},
	}:
	case <-ctx.Done():
		return "", ctx.Err()
	}

	select {
	case res := <-resCh:
		logsRes := res.GetContainerLogsResult()
		if logsRes == nil {
			return "", fmt.Errorf("invalid response from agent")
		}
		if logsRes.Error != "" && logsRes.Logs == "" {
			return "", fmt.Errorf("%s", logsRes.Error)
		}
		return logsRes.Logs, nil
	case <-time.After(15 * time.Second):
		return "", fmt.Errorf("logs timed out waiting for agent response")
	case <-ctx.Done():
		return "", ctx.Err()
	}
}

func (o *Orchestrator) DispatchContainerAction(ctx context.Context, nodeID, containerID, action string) error {
	sess := o.GetAgentSession(nodeID)
	if sess == nil {
		return fmt.Errorf("node agent not connected: %s", nodeID)
	}

	taskID := "action-" + randomHex(8)
	resCh := make(chan *takov1.AgentTaskResult, 1)
	sess.RegisterResultChan(taskID, resCh)
	defer sess.UnregisterResultChan(taskID)

	select {
	case sess.TaskChan <- &takov1.MasterTask{
		TaskId: taskID,
		NodeId: sess.NodeID,
		Task: &takov1.MasterTask_ContainerAction{
			ContainerAction: &takov1.ContainerActionRequest{
				ContainerId: containerID,
				Action:      action,
			},
		},
	}:
	case <-ctx.Done():
		return ctx.Err()
	}

	select {
	case res := <-resCh:
		actRes := res.GetContainerActionResult()
		if actRes != nil && !actRes.Success {
			return fmt.Errorf("%s", actRes.Message)
		}
		return nil
	case <-time.After(15 * time.Second):
		return fmt.Errorf("container action timed out waiting for agent response")
	case <-ctx.Done():
		return ctx.Err()
	}
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

	_, _ = o.queries.RecordNodeMetric(ctx, db.RecordNodeMetricParams{
		NodeID:        nodeID,
		CpuPercent:    req.GetCpuPercent(),
		MemoryUsedMb:  req.GetMemoryUsedMb(),
		MemoryTotalMb: 0,
		DiskUsedGb:    int64(req.GetDiskUsedGb()),
		DiskTotalGb:   0,
		NetworkRxKbps: req.GetNetworkRxKbps(),
		NetworkTxKbps: req.GetNetworkTxKbps(),
	})

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

