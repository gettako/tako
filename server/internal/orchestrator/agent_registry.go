package orchestrator

import (
	"context"
	"fmt"
	"log"
	"sync"
	"time"

	takov1 "gettako.dev/tako/proto/gen/go/tako/v1"
)

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

type AgentRegistry struct {
	mu     sync.RWMutex
	agents map[string]*AgentSession
}

func NewAgentRegistry() *AgentRegistry {
	return &AgentRegistry{
		agents: make(map[string]*AgentSession),
	}
}

func (r *AgentRegistry) Register(nodeID string, taskChan chan *takov1.MasterTask) *AgentSession {
	r.mu.Lock()
	defer r.mu.Unlock()

	sess := &AgentSession{
		NodeID:          nodeID,
		TaskChan:        taskChan,
		logCallbacks:    make(map[string]func(chunk *takov1.DeployLogChunk)),
		resultCallbacks: make(map[string]chan *takov1.AgentTaskResult),
	}
	r.agents[nodeID] = sess
	log.Printf("[orchestrator] registered agent task session for node: %s", nodeID)
	return sess
}

func (r *AgentRegistry) Unregister(nodeID string) {
	r.mu.Lock()
	defer r.mu.Unlock()
	delete(r.agents, nodeID)
	log.Printf("[orchestrator] unregistered agent task session for node: %s", nodeID)
}

func (r *AgentRegistry) Get(nodeID string) *AgentSession {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return r.agents[nodeID]
}

func (r *AgentRegistry) DispatchExec(ctx context.Context, nodeID, containerID, cmd string) (string, int, error) {
	sess := r.Get(nodeID)
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
