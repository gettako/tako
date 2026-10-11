package orchestrator_test

import (
	"context"
	"strings"
	"testing"
	"time"

	takov1 "gettako.dev/tako/proto/gen/go/tako/v1"
)

func TestFeature_DispatchExecSuccessAndError(t *testing.T) {
	orch, _, cleanup := setupTestOrchestrator(t)
	defer cleanup()

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	nodeID := "node-exec-worker"
	taskChan := make(chan *takov1.MasterTask, 10)
	agentSession := orch.RegisterAgentSession(nodeID, taskChan)
	defer orch.UnregisterAgentSession(nodeID)

	// 1. Successful command execution
	go func() {
		task := <-taskChan
		execReq := task.GetExec()
		if execReq != nil && execReq.GetCommand() == "echo 'hello tako'" {
			agentSession.HandleResult(&takov1.AgentTaskResult{
				TaskId: task.GetTaskId(),
				Result: &takov1.AgentTaskResult_ExecResult{
					ExecResult: &takov1.ExecCommandResponse{
						Output:   "hello tako\n",
						ExitCode: 0,
					},
				},
			})
		}
	}()

	output, exitCode, err := orch.DispatchExec(ctx, nodeID, "container-123", "echo 'hello tako'")
	if err != nil {
		t.Fatalf("DispatchExec failed: %v", err)
	}
	if exitCode != 0 {
		t.Errorf("expected exit code 0, got %d", exitCode)
	}
	if strings.TrimSpace(output) != "hello tako" {
		t.Errorf("expected output 'hello tako', got '%s'", output)
	}

	// 2. Command with non-zero exit code and error output
	go func() {
		task := <-taskChan
		execReq := task.GetExec()
		if execReq != nil && execReq.GetCommand() == "cat /non-existent" {
			agentSession.HandleResult(&takov1.AgentTaskResult{
				TaskId: task.GetTaskId(),
				Result: &takov1.AgentTaskResult_ExecResult{
					ExecResult: &takov1.ExecCommandResponse{
						Output:   "cat: /non-existent: No such file or directory\n",
						ExitCode: 1,
						Error:    "exit status 1",
					},
				},
			})
		}
	}()

	output, exitCode, err = orch.DispatchExec(ctx, nodeID, "container-123", "cat /non-existent")
	if exitCode != 1 {
		t.Errorf("expected exit code 1, got %d", exitCode)
	}
	if !strings.Contains(output, "No such file or directory") {
		t.Errorf("expected error in output, got: %s", output)
	}
}

func TestFeature_DispatchContainerLogsAndActions(t *testing.T) {
	orch, _, cleanup := setupTestOrchestrator(t)
	defer cleanup()

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	nodeID := "node-actions-worker"
	taskChan := make(chan *takov1.MasterTask, 10)
	agentSession := orch.RegisterAgentSession(nodeID, taskChan)
	defer orch.UnregisterAgentSession(nodeID)

	// 1. Dispatch Container Logs
	go func() {
		task := <-taskChan
		if logsReq := task.GetContainerLogs(); logsReq != nil {
			agentSession.HandleResult(&takov1.AgentTaskResult{
				TaskId: task.GetTaskId(),
				Result: &takov1.AgentTaskResult_ContainerLogsResult{
					ContainerLogsResult: &takov1.ContainerLogsResponse{
						Logs: "2026-10-11T09:00:00Z [info] server listening on :8080\n2026-10-11T09:00:01Z [info] worker pool ready\n",
					},
				},
			})
		}
	}()

	logs, err := orch.DispatchContainerLogs(ctx, nodeID, "container-456", 50)
	if err != nil {
		t.Fatalf("DispatchContainerLogs failed: %v", err)
	}
	if !strings.Contains(logs, "worker pool ready") {
		t.Errorf("expected logs to contain 'worker pool ready', got: %s", logs)
	}

	// 2. Dispatch Container Action (Success)
	go func() {
		task := <-taskChan
		if actReq := task.GetContainerAction(); actReq != nil {
			agentSession.HandleResult(&takov1.AgentTaskResult{
				TaskId: task.GetTaskId(),
				Result: &takov1.AgentTaskResult_ContainerActionResult{
					ContainerActionResult: &takov1.ContainerActionResponse{
						Success: true,
						Message: "container restarted successfully",
					},
				},
			})
		}
	}()

	err = orch.DispatchContainerAction(ctx, nodeID, "container-456", "restart")
	if err != nil {
		t.Fatalf("DispatchContainerAction failed: %v", err)
	}

	// 3. Dispatch Container Action (Failure reported by agent)
	go func() {
		task := <-taskChan
		if actReq := task.GetContainerAction(); actReq != nil {
			agentSession.HandleResult(&takov1.AgentTaskResult{
				TaskId: task.GetTaskId(),
				Result: &takov1.AgentTaskResult_ContainerActionResult{
					ContainerActionResult: &takov1.ContainerActionResponse{
						Success: false,
						Message: "docker daemon failure: container already stopped",
					},
				},
			})
		}
	}()

	err = orch.DispatchContainerAction(ctx, nodeID, "container-456", "stop")
	if err == nil {
		t.Fatalf("expected error from failed container action, got nil")
	}
	if !strings.Contains(err.Error(), "container already stopped") {
		t.Errorf("expected error message to mention container already stopped, got: %v", err)
	}
}

func TestFeature_DispatchDisconnectedNodeResilience(t *testing.T) {
	orch, _, cleanup := setupTestOrchestrator(t)
	defer cleanup()

	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()

	// Calling dispatch on non-connected node should return immediate error without hanging
	_, _, err := orch.DispatchExec(ctx, "offline-node-99", "c-1", "ls")
	if err == nil || !strings.Contains(err.Error(), "node agent not connected") {
		t.Errorf("expected 'node agent not connected' error, got: %v", err)
	}

	_, err = orch.DispatchContainerLogs(ctx, "offline-node-99", "c-1", 10)
	if err == nil || !strings.Contains(err.Error(), "node agent not connected") {
		t.Errorf("expected 'node agent not connected' error, got: %v", err)
	}

	err = orch.DispatchContainerAction(ctx, "offline-node-99", "c-1", "restart")
	if err == nil || !strings.Contains(err.Error(), "node agent not connected") {
		t.Errorf("expected 'node agent not connected' error, got: %v", err)
	}
}
