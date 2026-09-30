package nodes

import (
	"context"
	"database/sql"
	"fmt"
	"log/slog"
	"sync"
	"time"

	"gettako.dev/tako/internal/protocol"
)

type NodeTelemetry struct {
	CPUPercent      float64   `json:"cpu_percent"`
	RAMPercent      float64   `json:"ram_percent"`
	RAMTotalBytes   int64     `json:"ram_total_bytes"`
	RAMUsedBytes    int64     `json:"ram_used_bytes"`
	DiskPercent     float64   `json:"disk_percent"`
	UptimeSeconds   int64     `json:"uptime_seconds"`
	LastHeartbeatAt time.Time `json:"last_heartbeat_at"`
}

type NodeSession struct {
	NodeID          string
	Stream          protocol.AgentService_StreamNodeSessionServer
	LastHeartbeatAt time.Time
	Telemetry       *NodeTelemetry
	Online          bool
	mu              sync.Mutex
}

type TerminalSessionHandler struct {
	OnData  func([]byte)
	OnClose func(string)
}

type NodeManager struct {
	db               *sql.DB
	mu               sync.RWMutex
	sessions         map[string]*NodeSession
	offlineTimeout   time.Duration
	taskWaiters      map[string]chan *protocol.TaskAck
	traefikWaiters   map[string]chan *protocol.TraefikConfigResponse
	terminalSessions map[string]*TerminalSessionHandler
}

func NewNodeManager(db *sql.DB) *NodeManager {
	return &NodeManager{
		db:               db,
		sessions:         make(map[string]*NodeSession),
		offlineTimeout:   45 * time.Second,
		taskWaiters:      make(map[string]chan *protocol.TaskAck),
		traefikWaiters:   make(map[string]chan *protocol.TraefikConfigResponse),
		terminalSessions: make(map[string]*TerminalSessionHandler),
	}
}

func (m *NodeManager) SetOfflineTimeout(d time.Duration) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.offlineTimeout = d
}

func (m *NodeManager) RegisterSession(ctx context.Context, nodeID string, stream protocol.AgentService_StreamNodeSessionServer) (*NodeSession, error) {
	m.mu.Lock()
	session, exists := m.sessions[nodeID]
	if !exists {
		session = &NodeSession{
			NodeID: nodeID,
		}
		m.sessions[nodeID] = session
	}

	session.mu.Lock()
	session.Stream = stream
	session.Online = true
	session.LastHeartbeatAt = time.Now()
	session.mu.Unlock()
	m.mu.Unlock()

	if m.db != nil {
		_, err := m.db.ExecContext(ctx, `
			UPDATE servers SET
				status = 'online',
				updated_at = CURRENT_TIMESTAMP
			WHERE id = ?
		`, nodeID)
		if err != nil {
			slog.Error("failed to mark server online in database", slog.String("node_id", nodeID), slog.String("error", err.Error()))
		}
	}

	slog.Info("node session registered in node manager", slog.String("node_id", nodeID))
	return session, nil
}

func (m *NodeManager) UnregisterSession(ctx context.Context, nodeID string) {
	m.mu.Lock()
	if session, exists := m.sessions[nodeID]; exists {
		session.mu.Lock()
		session.Stream = nil
		session.mu.Unlock()
	}
	m.mu.Unlock()

	slog.Info("node session stream closed", slog.String("node_id", nodeID))
}

func (m *NodeManager) RecordHeartbeat(ctx context.Context, nodeID string, hb *protocol.Heartbeat) error {
	now := time.Now()
	telemetry := &NodeTelemetry{
		CPUPercent:      hb.GetCpuPercent(),
		RAMPercent:      hb.GetRamPercent(),
		RAMTotalBytes:   int64(hb.GetRamTotalBytes()),
		RAMUsedBytes:    int64(hb.GetRamUsedBytes()),
		DiskPercent:     hb.GetDiskPercent(),
		UptimeSeconds:   hb.GetUptimeSeconds(),
		LastHeartbeatAt: now,
	}

	m.mu.Lock()
	session, exists := m.sessions[nodeID]
	if !exists {
		session = &NodeSession{
			NodeID: nodeID,
		}
		m.sessions[nodeID] = session
	}

	session.mu.Lock()
	session.Telemetry = telemetry
	session.LastHeartbeatAt = now
	session.Online = true
	session.mu.Unlock()
	m.mu.Unlock()

	if m.db != nil {
		_, err := m.db.ExecContext(ctx, `
			UPDATE servers SET
				cpu_percent = ?,
				ram_percent = ?,
				ram_total_bytes = ?,
				ram_used_bytes = ?,
				disk_percent = ?,
				uptime_seconds = ?,
				status = 'online',
				last_heartbeat_at = CURRENT_TIMESTAMP,
				updated_at = CURRENT_TIMESTAMP
			WHERE id = ?
		`, hb.GetCpuPercent(), hb.GetRamPercent(), int64(hb.GetRamTotalBytes()), int64(hb.GetRamUsedBytes()), hb.GetDiskPercent(), hb.GetUptimeSeconds(), nodeID)
		if err != nil {
			slog.Error("failed to update heartbeat in database", slog.String("node_id", nodeID), slog.String("error", err.Error()))
			return err
		}
	}

	return nil
}

func (m *NodeManager) SendCommand(ctx context.Context, nodeID string, msg *protocol.ServerMessage) error {
	m.mu.RLock()
	session, exists := m.sessions[nodeID]
	m.mu.RUnlock()

	if !exists {
		return fmt.Errorf("node %s not found", nodeID)
	}

	session.mu.Lock()
	defer session.mu.Unlock()

	if !session.Online || session.Stream == nil {
		return fmt.Errorf("node %s is offline", nodeID)
	}

	return session.Stream.Send(msg)
}

func (m *NodeManager) SendTaskWithResponse(ctx context.Context, nodeID string, taskID string, msg *protocol.ServerMessage) (*protocol.TaskAck, error) {
	ackCh := make(chan *protocol.TaskAck, 1)

	m.mu.Lock()
	m.taskWaiters[taskID] = ackCh
	m.mu.Unlock()

	defer func() {
		m.mu.Lock()
		delete(m.taskWaiters, taskID)
		m.mu.Unlock()
	}()

	if err := m.SendCommand(ctx, nodeID, msg); err != nil {
		return nil, err
	}

	select {
	case <-ctx.Done():
		return nil, ctx.Err()
	case ack := <-ackCh:
		return ack, nil
	}
}

func (m *NodeManager) HandleTaskAck(ack *protocol.TaskAck) {
	if ack == nil {
		return
	}
	m.mu.RLock()
	ch, exists := m.taskWaiters[ack.GetTaskId()]
	m.mu.RUnlock()

	if exists {
		select {
		case ch <- ack:
		default:
		}
	}
}

func (m *NodeManager) SendTraefikTaskWithResponse(ctx context.Context, nodeID string, taskID string, msg *protocol.ServerMessage) (*protocol.TraefikConfigResponse, error) {
	respCh := make(chan *protocol.TraefikConfigResponse, 1)

	m.mu.Lock()
	m.traefikWaiters[taskID] = respCh
	m.mu.Unlock()

	defer func() {
		m.mu.Lock()
		delete(m.traefikWaiters, taskID)
		m.mu.Unlock()
	}()

	if err := m.SendCommand(ctx, nodeID, msg); err != nil {
		return nil, err
	}

	select {
	case <-ctx.Done():
		return nil, ctx.Err()
	case resp := <-respCh:
		return resp, nil
	}
}

func (m *NodeManager) HandleTraefikConfigResponse(resp *protocol.TraefikConfigResponse) {
	if resp == nil {
		return
	}
	m.mu.RLock()
	ch, exists := m.traefikWaiters[resp.GetTaskId()]
	m.mu.RUnlock()

	if exists {
		select {
		case ch <- resp:
		default:
		}
	}
}

func (m *NodeManager) GetTelemetry(nodeID string) *NodeTelemetry {
	m.mu.RLock()
	defer m.mu.RUnlock()

	session, exists := m.sessions[nodeID]
	if !exists || session == nil {
		return nil
	}

	session.mu.Lock()
	defer session.mu.Unlock()
	if session.Telemetry == nil {
		return nil
	}

	cp := *session.Telemetry
	return &cp
}

func (m *NodeManager) IsOnline(nodeID string) bool {
	m.mu.RLock()
	defer m.mu.RUnlock()

	session, exists := m.sessions[nodeID]
	if !exists || session == nil {
		return false
	}

	session.mu.Lock()
	defer session.mu.Unlock()

	if !session.Online {
		return false
	}

	return time.Since(session.LastHeartbeatAt) <= m.offlineTimeout
}

func (m *NodeManager) CheckLiveness(ctx context.Context) {
	m.mu.Lock()
	timeout := m.offlineTimeout
	now := time.Now()

	var expiredNodeIDs []string
	for nodeID, session := range m.sessions {
		session.mu.Lock()
		if session.Online && now.Sub(session.LastHeartbeatAt) > timeout {
			session.Online = false
			expiredNodeIDs = append(expiredNodeIDs, nodeID)
		}
		session.mu.Unlock()
	}
	m.mu.Unlock()

	if m.db != nil {
		threshold := now.Add(-timeout).Format("2006-01-02 15:04:05")
		res, err := m.db.ExecContext(ctx, `
			UPDATE servers SET
				status = 'offline',
				updated_at = CURRENT_TIMESTAMP
			WHERE status = 'online'
			  AND (last_heartbeat_at IS NULL OR last_heartbeat_at < ?)
		`, threshold)
		if err != nil {
			slog.Error("failed to mark timed-out servers offline", slog.String("error", err.Error()))
		} else if rows, _ := res.RowsAffected(); rows > 0 {
			slog.Info("marked stale servers offline", slog.Int64("count", rows))
		}
	}

	if len(expiredNodeIDs) > 0 {
		slog.Warn("nodes transitioned to offline status due to missed heartbeats", slog.Any("nodes", expiredNodeIDs))
	}
}

func (m *NodeManager) StartLivenessCheck(ctx context.Context, interval time.Duration) {
	if interval <= 0 {
		interval = 30 * time.Second
	}

	ticker := time.NewTicker(interval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			m.CheckLiveness(ctx)
		}
	}
}

func (m *NodeManager) RegisterTerminalSession(sessionID string, onData func([]byte), onClose func(string)) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.terminalSessions[sessionID] = &TerminalSessionHandler{
		OnData:  onData,
		OnClose: onClose,
	}
}

func (m *NodeManager) UnregisterTerminalSession(sessionID string) {
	m.mu.Lock()
	defer m.mu.Unlock()
	delete(m.terminalSessions, sessionID)
}

func (m *NodeManager) HandleTerminalData(msg *protocol.TerminalData) {
	if msg == nil {
		return
	}
	m.mu.RLock()
	h, exists := m.terminalSessions[msg.GetSessionId()]
	m.mu.RUnlock()
	if exists && h.OnData != nil {
		h.OnData(msg.GetData())
	}
}

func (m *NodeManager) HandleTerminalClose(msg *protocol.TerminalClose) {
	if msg == nil {
		return
	}
	m.mu.RLock()
	h, exists := m.terminalSessions[msg.GetSessionId()]
	m.mu.RUnlock()
	if exists && h.OnClose != nil {
		h.OnClose(msg.GetReason())
	}
}

func (m *NodeManager) SendTerminalStart(nodeID string, start *protocol.TerminalStart) error {
	return m.SendCommand(context.Background(), nodeID, &protocol.ServerMessage{
		Payload: &protocol.ServerMessage_TerminalStart{
			TerminalStart: start,
		},
	})
}

func (m *NodeManager) SendTerminalData(nodeID string, sessionID string, data []byte) error {
	return m.SendCommand(context.Background(), nodeID, &protocol.ServerMessage{
		Payload: &protocol.ServerMessage_TerminalData{
			TerminalData: &protocol.TerminalData{
				SessionId: sessionID,
				Data:      data,
			},
		},
	})
}

func (m *NodeManager) SendTerminalResize(nodeID string, sessionID string, cols int32, rows int32) error {
	return m.SendCommand(context.Background(), nodeID, &protocol.ServerMessage{
		Payload: &protocol.ServerMessage_TerminalResize{
			TerminalResize: &protocol.TerminalResize{
				SessionId: sessionID,
				Cols:      cols,
				Rows:      rows,
			},
		},
	})
}

func (m *NodeManager) SendTerminalClose(nodeID string, sessionID string, reason string) error {
	return m.SendCommand(context.Background(), nodeID, &protocol.ServerMessage{
		Payload: &protocol.ServerMessage_TerminalClose{
			TerminalClose: &protocol.TerminalClose{
				SessionId: sessionID,
				Reason:    reason,
			},
		},
	})
}
