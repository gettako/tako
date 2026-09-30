package docker

import (
	"bufio"
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/docker/docker/api/types"
	"github.com/docker/docker/api/types/container"

	"gettako.dev/tako/internal/protocol"
)

type DockerExecClient interface {
	ContainerList(ctx context.Context, options container.ListOptions) ([]container.Summary, error)
	ContainerExecCreate(ctx context.Context, container string, config container.ExecOptions) (container.ExecCreateResponse, error)
	ContainerExecAttach(ctx context.Context, execID string, config container.ExecAttachOptions) (types.HijackedResponse, error)
	ContainerExecInspect(ctx context.Context, execID string) (container.ExecInspect, error)
	ContainerExecResize(ctx context.Context, execID string, options container.ResizeOptions) error
	ContainerStop(ctx context.Context, containerID string, options container.StopOptions) error
	ContainerRemove(ctx context.Context, containerID string, options container.RemoveOptions) error
}

type HookExecutor struct {
	cli DockerExecClient
}

func NewHookExecutor(cli DockerExecClient) *HookExecutor {
	return &HookExecutor{cli: cli}
}

func (h *HookExecutor) ExecuteHook(ctx context.Context, containerID string, command string, depID string, step string, sender LogSender) error {
	cmd := strings.TrimSpace(command)
	if cmd == "" {
		return nil
	}

	cidShort := containerID
	if len(cidShort) > 12 {
		cidShort = cidShort[:12]
	}

	_ = sender.SendBuildLog(&protocol.BuildLogChunk{
		DeploymentId: depID,
		Step:         step,
		LogLine:      fmt.Sprintf("Running %s hook inside container %s: %s", step, cidShort, cmd),
		Timestamp:    time.Now().UnixNano(),
	})

	execResp, err := h.cli.ContainerExecCreate(ctx, containerID, container.ExecOptions{
		Cmd:          []string{"/bin/sh", "-c", cmd},
		AttachStdout: true,
		AttachStderr: true,
		Tty:          true,
	})
	if err != nil {
		errReason := fmt.Sprintf("Failed to create %s exec in container %s: %v", step, cidShort, err)
		_ = sender.SendBuildLog(&protocol.BuildLogChunk{
			DeploymentId: depID,
			Step:         step,
			LogLine:      errReason,
			IsError:      true,
			Timestamp:    time.Now().UnixNano(),
		})
		return fmt.Errorf("%s", errReason)
	}

	attachResp, err := h.cli.ContainerExecAttach(ctx, execResp.ID, container.ExecAttachOptions{
		Tty: true,
	})
	if err != nil {
		errReason := fmt.Sprintf("Failed to attach to %s exec: %v", step, err)
		_ = sender.SendBuildLog(&protocol.BuildLogChunk{
			DeploymentId: depID,
			Step:         step,
			LogLine:      errReason,
			IsError:      true,
			Timestamp:    time.Now().UnixNano(),
		})
		return fmt.Errorf("%s", errReason)
	}
	defer attachResp.Close()

	scanner := bufio.NewScanner(attachResp.Reader)
	for scanner.Scan() {
		line := scanner.Text()
		_ = sender.SendBuildLog(&protocol.BuildLogChunk{
			DeploymentId: depID,
			Step:         step,
			LogLine:      line,
			Timestamp:    time.Now().UnixNano(),
		})
	}

	inspect, err := h.cli.ContainerExecInspect(ctx, execResp.ID)
	if err != nil {
		errReason := fmt.Sprintf("Failed to inspect %s exec status: %v", step, err)
		_ = sender.SendBuildLog(&protocol.BuildLogChunk{
			DeploymentId: depID,
			Step:         step,
			LogLine:      errReason,
			IsError:      true,
			Timestamp:    time.Now().UnixNano(),
		})
		return fmt.Errorf("%s", errReason)
	}

	if inspect.ExitCode != 0 {
		errReason := fmt.Sprintf("%s hook failed with exit code %d", step, inspect.ExitCode)
		_ = sender.SendBuildLog(&protocol.BuildLogChunk{
			DeploymentId: depID,
			Step:         step,
			LogLine:      errReason,
			IsError:      true,
			Timestamp:    time.Now().UnixNano(),
		})
		return fmt.Errorf("%s", errReason)
	}

	_ = sender.SendBuildLog(&protocol.BuildLogChunk{
		DeploymentId: depID,
		Step:         step,
		LogLine:      fmt.Sprintf("%s hook completed successfully.", step),
		Timestamp:    time.Now().UnixNano(),
	})
	return nil
}
