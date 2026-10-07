package docker

import (
	"bytes"
	"context"
	"fmt"
	"strings"

	"github.com/docker/docker/api/types"
	"github.com/docker/docker/api/types/container"
	"github.com/docker/docker/api/types/events"
	"github.com/docker/docker/api/types/filters"
	"github.com/docker/docker/api/types/system"
	"github.com/docker/docker/client"
	"github.com/docker/docker/pkg/stdcopy"
)

type Client struct {
	cli *client.Client
}

// New creates a Docker engine client connected via environment or local socket.
func New() (*Client, error) {
	cli, err := client.NewClientWithOpts(
		client.FromEnv,
		client.WithAPIVersionNegotiation(),
	)
	if err != nil {
		return nil, fmt.Errorf("failed to create docker client: %w", err)
	}

	return &Client{cli: cli}, nil
}

// Ping checks if Docker daemon is responsive.
func (c *Client) Ping(ctx context.Context) error {
	_, err := c.cli.Ping(ctx)
	return err
}

// Version returns the Docker engine version string.
func (c *Client) Version(ctx context.Context) (string, error) {
	v, err := c.cli.ServerVersion(ctx)
	if err != nil {
		return "unknown", err
	}
	return v.Version, nil
}

// Info returns system information from the Docker daemon.
func (c *Client) Info(ctx context.Context) (system.Info, error) {
	return c.cli.Info(ctx)
}

// ListContainers returns all active and stopped containers.
func (c *Client) ListContainers(ctx context.Context, all bool) ([]types.Container, error) {
	return c.cli.ContainerList(ctx, container.ListOptions{All: all})
}

// Events returns a channel of container-related Docker events and an error channel.
func (c *Client) Events(ctx context.Context) (<-chan events.Message, <-chan error) {
	eventFilter := filters.NewArgs()
	eventFilter.Add("type", "container")

	return c.cli.Events(ctx, types.EventsOptions{
		Filters: eventFilter,
	})
}

// Exec runs a command inside a running container and returns stdout/stderr and exit code.
func (c *Client) Exec(ctx context.Context, containerName string, cmd string) (string, int, error) {
	if c.cli == nil {
		return "", 1, fmt.Errorf("docker client not available")
	}

	execCfg := types.ExecConfig{
		AttachStdout: true,
		AttachStderr: true,
		Cmd:          []string{"/bin/sh", "-c", cmd},
	}

	execIDResp, err := c.cli.ContainerExecCreate(ctx, containerName, execCfg)
	if err != nil {
		return "", 1, fmt.Errorf("failed to create exec: %w", err)
	}

	resp, err := c.cli.ContainerExecAttach(ctx, execIDResp.ID, types.ExecStartCheck{})
	if err != nil {
		return "", 1, fmt.Errorf("failed to attach exec: %w", err)
	}
	defer resp.Close()

	var outBuf, errBuf bytes.Buffer
	_, _ = stdcopy.StdCopy(&outBuf, &errBuf, resp.Reader)

	inspect, err := c.cli.ContainerExecInspect(ctx, execIDResp.ID)
	exitCode := 0
	if err == nil {
		exitCode = inspect.ExitCode
	}

	output := outBuf.String()
	if errStr := errBuf.String(); errStr != "" {
		if output != "" {
			output += "\n" + errStr
		} else {
			output = errStr
		}
	}

	return output, exitCode, nil
}

// Logs fetches stdout/stderr output from a container.
func (c *Client) Logs(ctx context.Context, containerName string, tailLines int) (string, error) {
	if c.cli == nil {
		return "", fmt.Errorf("docker client not available")
	}

	tail := "100"
	if tailLines > 0 {
		tail = fmt.Sprintf("%d", tailLines)
	}

	reader, err := c.cli.ContainerLogs(ctx, containerName, container.LogsOptions{
		ShowStdout: true,
		ShowStderr: true,
		Tail:       tail,
		Timestamps: true,
	})
	if err != nil {
		return "", err
	}
	defer reader.Close()

	var outBuf, errBuf bytes.Buffer
	_, _ = stdcopy.StdCopy(&outBuf, &errBuf, reader)

	res := outBuf.String()
	if errBuf.Len() > 0 {
		if res != "" {
			res += "\n" + errBuf.String()
		} else {
			res = errBuf.String()
		}
	}
	return res, nil
}

// ContainerAction performs start, stop, or restart on a container.
func (c *Client) ContainerAction(ctx context.Context, containerName string, action string) error {
	if c.cli == nil {
		return fmt.Errorf("docker client not available")
	}

	switch action {
	case "start":
		return c.cli.ContainerStart(ctx, containerName, container.StartOptions{})
	case "stop":
		return c.cli.ContainerStop(ctx, containerName, container.StopOptions{})
	case "restart":
		return c.cli.ContainerRestart(ctx, containerName, container.StopOptions{})
	case "remove", "delete":
		_ = c.cli.ContainerStop(ctx, containerName, container.StopOptions{})
		err := c.cli.ContainerRemove(ctx, containerName, container.RemoveOptions{Force: true})
		if err != nil && (strings.Contains(err.Error(), "No such container") || strings.Contains(err.Error(), "not found")) {
			return nil
		}
		return err
	default:
		return fmt.Errorf("unsupported action: %s", action)
	}
}

// RawClient returns the underlying *client.Client for advanced operations.
func (c *Client) RawClient() *client.Client {
	return c.cli
}

// Close closes the Docker client connection.
func (c *Client) Close() error {
	if c.cli != nil {
		return c.cli.Close()
	}
	return nil
}
