package docker

import (
	"bytes"
	"context"
	"fmt"
	"os"
	"sort"
	"strings"
	"time"

	"github.com/docker/docker/api/types"
	"github.com/docker/docker/api/types/container"
	"github.com/docker/docker/api/types/events"
	"github.com/docker/docker/api/types/filters"
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

// Version returns the Docker engine version string.
func (c *Client) Version(ctx context.Context) (string, error) {
	v, err := c.cli.ServerVersion(ctx)
	if err != nil {
		return "unknown", err
	}
	return v.Version, nil
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

// ResolveContainer resolves a container name or service identifier to an active Docker container name/ID.
// If exact containerName exists directly, it is returned. Otherwise, it searches for matching
// containers created for this service (e.g. tako-app-<slug>-<commit>), prioritizing running containers
// and the most recently created one.
func (c *Client) ResolveContainer(ctx context.Context, containerName string) string {
	if c.cli == nil || containerName == "" {
		return containerName
	}

	// 1. Direct inspect check
	if _, err := c.cli.ContainerInspect(ctx, containerName); err == nil {
		return containerName
	}

	// 2. Query matching containers
	containers := c.ResolveAllContainers(ctx, containerName)
	if len(containers) > 0 {
		return containers[0]
	}

	return containerName
}

// ResolveAllContainers returns all container IDs or names matching the given identifier or service slug,
// prioritizing running containers and sorting by newest created timestamp first.
func (c *Client) ResolveAllContainers(ctx context.Context, nameOrSlug string) []string {
	if c.cli == nil || nameOrSlug == "" {
		if nameOrSlug != "" {
			return []string{nameOrSlug}
		}
		return nil
	}

	all, err := c.cli.ContainerList(ctx, container.ListOptions{All: true})
	if err != nil {
		return []string{nameOrSlug}
	}

	slug := strings.TrimPrefix(strings.TrimPrefix(nameOrSlug, "/"), "tako-app-")
	prefix := "tako-app-" + slug + "-"
	legacy := "tako-app-" + slug

	var matched []types.Container
	for _, cont := range all {
		isMatch := cont.Labels["tako.service.name"] == slug || cont.Labels["tako.service.id"] == nameOrSlug
		if !isMatch {
			for _, n := range cont.Names {
				clean := strings.TrimPrefix(n, "/")
				if strings.HasPrefix(clean, prefix) || clean == legacy || clean == nameOrSlug || clean == slug {
					isMatch = true
					break
				}
			}
		}
		if isMatch {
			matched = append(matched, cont)
		}
	}

	if len(matched) == 0 {
		return []string{nameOrSlug}
	}

	// Sort: running containers first, then newest Created timestamp first
	sort.Slice(matched, func(i, j int) bool {
		iRunning := matched[i].State == "running"
		jRunning := matched[j].State == "running"
		if iRunning != jRunning {
			return iRunning
		}
		return matched[i].Created > matched[j].Created
	})

	var result []string
	for _, m := range matched {
		name := m.ID
		if len(m.Names) > 0 {
			name = strings.TrimPrefix(m.Names[0], "/")
		}
		result = append(result, name)
	}

	return result
}

// Exec runs a command inside a running container and returns stdout/stderr and exit code.
func (c *Client) Exec(ctx context.Context, containerName string, cmd string) (string, int, error) {
	if c.cli == nil {
		return "", 1, fmt.Errorf("docker client not available")
	}

	target := c.ResolveContainer(ctx, containerName)

	execCfg := types.ExecConfig{
		AttachStdout: true,
		AttachStderr: true,
		Cmd:          []string{"/bin/sh", "-c", cmd},
	}

	execIDResp, err := c.cli.ContainerExecCreate(ctx, target, execCfg)
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

	target := c.ResolveContainer(ctx, containerName)

	tail := "100"
	if tailLines > 0 {
		tail = fmt.Sprintf("%d", tailLines)
	}

	reader, err := c.cli.ContainerLogs(ctx, target, container.LogsOptions{
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
		target := c.ResolveContainer(ctx, containerName)
		return c.cli.ContainerStart(ctx, target, container.StartOptions{})
	case "stop":
		targets := c.ResolveAllContainers(ctx, containerName)
		var lastErr error
		for _, t := range targets {
			if err := c.cli.ContainerStop(ctx, t, container.StopOptions{}); err != nil {
				lastErr = err
			}
		}
		return lastErr
	case "restart":
		target := c.ResolveContainer(ctx, containerName)
		return c.cli.ContainerRestart(ctx, target, container.StopOptions{})
	case "remove", "delete":
		targets := c.ResolveAllContainers(ctx, containerName)
		var lastErr error
		for _, t := range targets {
			_ = c.cli.ContainerStop(ctx, t, container.StopOptions{})
			err := c.cli.ContainerRemove(ctx, t, container.RemoveOptions{Force: true})
			if err != nil && !strings.Contains(err.Error(), "No such container") && !strings.Contains(err.Error(), "not found") {
				lastErr = err
			}
		}
		return lastErr
	default:
		return fmt.Errorf("unsupported action: %s", action)
	}
}

// RawClient returns the underlying *client.Client for advanced operations.
func (c *Client) RawClient() *client.Client {
	return c.cli
}

// RebootHost requests a host system reboot via an ephemeral privileged container on the host Docker daemon.
func (c *Client) RebootHost(ctx context.Context) error {
	if c.cli == nil {
		return fmt.Errorf("docker client not available")
	}

	imageToUse := "alpine:latest"
	if hostname, err := os.Hostname(); err == nil && hostname != "" {
		if cInspect, err := c.cli.ContainerInspect(ctx, hostname); err == nil && cInspect.Config != nil && cInspect.Config.Image != "" {
			imageToUse = cInspect.Config.Image
		}
	}

	rebootCmd := `sync; (echo 1 > /host-proc/sys/kernel/sysrq 2>/dev/null || true); (echo b > /host-proc/sysrq-trigger 2>/dev/null || true); (chroot /host systemctl reboot 2>/dev/null || true); (chroot /host shutdown -r now 2>/dev/null || true); (chroot /host reboot 2>/dev/null || true); nsenter -t 1 -m -u -i -n -p reboot`

	candidates := []string{imageToUse, "ghcr.io/gettako/tako-agent:latest", "alpine:3.20", "alpine:latest", "alpine"}
	var lastErr error
	var createdID string

	for _, img := range candidates {
		containerName := fmt.Sprintf("tako-host-reboot-%d", time.Now().UnixNano())
		resp, err := c.cli.ContainerCreate(
			ctx,
			&container.Config{
				Image:      img,
				Entrypoint: []string{"sh", "-c"},
				Cmd:        []string{rebootCmd},
			},
			&container.HostConfig{
				Privileged:  true,
				PidMode:     "host",
				NetworkMode: "host",
				IpcMode:     "host",
				Binds: []string{
					"/:/host",
					"/proc:/host-proc",
				},
				AutoRemove: true,
			},
			nil,
			nil,
			containerName,
		)
		if err == nil {
			createdID = resp.ID
			break
		}
		lastErr = err
	}

	if createdID == "" {
		return fmt.Errorf("failed to create host reboot container: %w", lastErr)
	}

	if err := c.cli.ContainerStart(ctx, createdID, container.StartOptions{}); err != nil {
		_ = c.cli.ContainerRemove(ctx, createdID, container.RemoveOptions{Force: true})
		return fmt.Errorf("failed to start host reboot container: %w", err)
	}

	return nil
}

// Close closes the Docker client connection.
func (c *Client) Close() error {
	if c.cli != nil {
		return c.cli.Close()
	}
	return nil
}
