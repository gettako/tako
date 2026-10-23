// Package orchestrator coordinates worker node liveness, container deployments,
// cron execution, autoscaling telemetry, and cluster database retention.
package orchestrator

import (
	"context"
	"fmt"
	"log"
	"strings"
	"sync"
	"time"

	takov1 "gettako.dev/tako/proto/gen/go/tako/v1"
)

// AgentSession tracks an active gRPC stream connection with a worker node agent,
// maintaining outbound task queues and task-specific callback registrations.
type AgentSession struct {
	NodeID          string
	TaskChan        chan *takov1.MasterTask
	mu              sync.RWMutex
	logCallbacks    map[string]func(chunk *takov1.DeployLogChunk)
	execCallbacks   map[string]func(res *takov1.ExecCommandResponse)
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

func (s *AgentSession) RegisterExecCallback(taskID string, cb func(res *takov1.ExecCommandResponse)) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.execCallbacks[taskID] = cb
}

func (s *AgentSession) UnregisterExecCallback(taskID string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	delete(s.execCallbacks, taskID)
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

	if execRes := res.GetExecResult(); execRes != nil {
		if cb, ok := s.execCallbacks[taskID]; ok {
			cb(execRes)
		}
	}

	if ch, ok := s.resultCallbacks[taskID]; ok {
		select {
		case ch <- res:
		default:
		}
	}
}

// AgentRegistry manages active agent sessions across all cluster worker nodes.
type AgentRegistry struct {
	mu     sync.RWMutex
	agents map[string]*AgentSession
}

// NewAgentRegistry creates a thread-safe registry for agent task sessions.
func NewAgentRegistry() *AgentRegistry {
	return &AgentRegistry{
		agents: make(map[string]*AgentSession),
	}
}

// Register adds an active agent session for the specified worker node.
func (r *AgentRegistry) Register(nodeID string, taskChan chan *takov1.MasterTask) *AgentSession {
	r.mu.Lock()
	defer r.mu.Unlock()

	sess := &AgentSession{
		NodeID:          nodeID,
		TaskChan:        taskChan,
		logCallbacks:    make(map[string]func(chunk *takov1.DeployLogChunk)),
		execCallbacks:   make(map[string]func(res *takov1.ExecCommandResponse)),
		resultCallbacks: make(map[string]chan *takov1.AgentTaskResult),
	}
	r.agents[nodeID] = sess
	log.Printf("[orchestrator] registered agent task session for node: %s", nodeID)
	return sess
}

// Unregister removes the agent session when a node disconnects.
func (r *AgentRegistry) Unregister(nodeID string) {
	r.mu.Lock()
	defer r.mu.Unlock()
	delete(r.agents, nodeID)
	log.Printf("[orchestrator] unregistered agent task session for node: %s", nodeID)
}

// Get retrieves an agent session for the specified node ID if connected.
func (r *AgentRegistry) Get(nodeID string) *AgentSession {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return r.agents[nodeID]
}

// DispatchExecStream sends a command execution request to a container and invokes onChunk for each output chunk in real time.
func (r *AgentRegistry) DispatchExecStream(ctx context.Context, nodeID, containerID, cmd string, onChunk func(chunk string)) (int, error) {
	sess := r.Get(nodeID)
	if sess == nil {
		return 1, fmt.Errorf("node agent not connected: %s", nodeID)
	}

	taskID := "exec-" + randomHex(8)
	doneCh := make(chan struct {
		exitCode int
		err      error
	}, 1)

	sess.RegisterExecCallback(taskID, func(res *takov1.ExecCommandResponse) {
		if res.ExitCode == -1 {
			if res.Output != "" && onChunk != nil {
				onChunk(res.Output)
			}
			return
		}

		if res.Output != "" && onChunk != nil {
			onChunk(res.Output)
		}
		var err error
		if res.Error != "" {
			err = fmt.Errorf("%s", res.Error)
		}
		select {
		case doneCh <- struct {
			exitCode int
			err      error
		}{exitCode: int(res.ExitCode), err: err}:
		default:
		}
	})
	defer sess.UnregisterExecCallback(taskID)

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
		return 1, ctx.Err()
	}

	select {
	case result := <-doneCh:
		return result.exitCode, result.err
	case <-time.After(5 * time.Minute):
		return 1, fmt.Errorf("exec timed out waiting for process completion")
	case <-ctx.Done():
		return 1, ctx.Err()
	}
}

// DispatchExec sends a command execution request to a container on a worker node and awaits output.
func (r *AgentRegistry) DispatchExec(ctx context.Context, nodeID, containerID, cmd string) (string, int, error) {
	var buf strings.Builder
	code, err := r.DispatchExecStream(ctx, nodeID, containerID, cmd, func(chunk string) {
		buf.WriteString(chunk)
	})
	return buf.String(), code, err
}

// DispatchContainerLogs streams recent container logs from a worker node.
func (r *AgentRegistry) DispatchContainerLogs(ctx context.Context, nodeID, containerID string, tailLines int) (string, error) {
	sess := r.Get(nodeID)
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

// DispatchContainerAction triggers lifecycle actions (start, stop, restart, delete) on a container.
func (r *AgentRegistry) DispatchContainerAction(ctx context.Context, nodeID, containerID, action string) error {
	sess := r.Get(nodeID)
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
