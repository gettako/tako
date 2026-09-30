package docker

import (
	"context"
	"fmt"
	"sync"

	"github.com/docker/docker/api/types"
	"github.com/docker/docker/api/types/container"

	"gettako.dev/tako/internal/protocol"
)

type AgentSender interface {
	Send(msg *protocol.AgentMessage) error
}

type activeTerminalSession struct {
	execID string
	cancel context.CancelFunc
	conn   types.HijackedResponse
}

type TerminalManager struct {
	cli      DockerExecClient
	mu       sync.RWMutex
	sessions map[string]*activeTerminalSession
}

func NewTerminalManager(cli DockerExecClient) *TerminalManager {
	return &TerminalManager{
		cli:      cli,
		sessions: make(map[string]*activeTerminalSession),
	}
}

func (m *TerminalManager) StartSession(ctx context.Context, start *protocol.TerminalStart, sender AgentSender) {
	sessionID := start.GetSessionId()
	serviceID := start.GetServiceId()

	var containerID string
	if start.GetContainerId() != "" {
		containerID = start.GetContainerId()
	} else {
		containers, err := m.cli.ContainerList(ctx, container.ListOptions{})
		if err == nil {
			for _, c := range containers {
				if c.Labels["tako.service_id"] == serviceID && c.State == "running" {
					containerID = c.ID
					break
				}
			}
		}
	}

	if containerID == "" {
		_ = sender.Send(&protocol.AgentMessage{
			Payload: &protocol.AgentMessage_TerminalClose{
				TerminalClose: &protocol.TerminalClose{
					SessionId: sessionID,
					Reason:    fmt.Sprintf("No running container found for service %s", serviceID),
				},
			},
		})
		return
	}

	shell := start.GetShell()
	if shell == "" {
		shell = "/bin/sh"
	}

	cols := uint(start.GetCols())
	rows := uint(start.GetRows())
	if cols == 0 {
		cols = 80
	}
	if rows == 0 {
		rows = 24
	}

	execResp, err := m.cli.ContainerExecCreate(ctx, containerID, container.ExecOptions{
		Cmd:          []string{shell},
		AttachStdin:  true,
		AttachStdout: true,
		AttachStderr: true,
		Tty:          true,
		ConsoleSize:  &[2]uint{rows, cols},
	})
	if err != nil {
		_ = sender.Send(&protocol.AgentMessage{
			Payload: &protocol.AgentMessage_TerminalClose{
				TerminalClose: &protocol.TerminalClose{
					SessionId: sessionID,
					Reason:    fmt.Sprintf("Failed to create exec session: %v", err),
				},
			},
		})
		return
	}

	attachResp, err := m.cli.ContainerExecAttach(ctx, execResp.ID, container.ExecAttachOptions{
		Tty: true,
	})
	if err != nil {
		_ = sender.Send(&protocol.AgentMessage{
			Payload: &protocol.AgentMessage_TerminalClose{
				TerminalClose: &protocol.TerminalClose{
					SessionId: sessionID,
					Reason:    fmt.Sprintf("Failed to attach to exec session: %v", err),
				},
			},
		})
		return
	}

	sessCtx, cancel := context.WithCancel(ctx)
	sess := &activeTerminalSession{
		execID: execResp.ID,
		cancel: cancel,
		conn:   attachResp,
	}

	m.mu.Lock()
	m.sessions[sessionID] = sess
	m.mu.Unlock()

	defer func() {
		m.CloseSession(sessionID)
	}()

	buf := make([]byte, 4096)
	for {
		select {
		case <-sessCtx.Done():
			return
		default:
		}

		n, err := attachResp.Reader.Read(buf)
		if n > 0 {
			chunk := make([]byte, n)
			copy(chunk, buf[:n])
			_ = sender.Send(&protocol.AgentMessage{
				Payload: &protocol.AgentMessage_TerminalData{
					TerminalData: &protocol.TerminalData{
						SessionId: sessionID,
						Data:      chunk,
					},
				},
			})
		}
		if err != nil {
			_ = sender.Send(&protocol.AgentMessage{
				Payload: &protocol.AgentMessage_TerminalClose{
					TerminalClose: &protocol.TerminalClose{
						SessionId: sessionID,
						Reason:    "Process exited",
					},
				},
			})
			return
		}
	}
}

func (m *TerminalManager) WriteData(sessionID string, data []byte) {
	m.mu.RLock()
	sess, exists := m.sessions[sessionID]
	m.mu.RUnlock()

	if exists && sess.conn.Conn != nil {
		_, _ = sess.conn.Conn.Write(data)
	}
}

func (m *TerminalManager) Resize(sessionID string, cols int32, rows int32) {
	m.mu.RLock()
	sess, exists := m.sessions[sessionID]
	m.mu.RUnlock()

	if exists && sess.execID != "" {
		_ = m.cli.ContainerExecResize(context.Background(), sess.execID, container.ResizeOptions{
			Width:  uint(cols),
			Height: uint(rows),
		})
	}
}

func (m *TerminalManager) CloseSession(sessionID string) {
	m.mu.Lock()
	sess, exists := m.sessions[sessionID]
	if exists {
		delete(m.sessions, sessionID)
	}
	m.mu.Unlock()

	if exists {
		sess.cancel()
		sess.conn.Close()
	}
}
