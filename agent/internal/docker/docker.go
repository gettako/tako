package docker

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"math"
	"os"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/docker/docker/api/types"
	"github.com/docker/docker/api/types/container"
	"github.com/docker/docker/api/types/events"
	"github.com/docker/docker/api/types/filters"
	"github.com/docker/docker/client"
	"github.com/docker/docker/pkg/stdcopy"
	takov1 "gettako.dev/tako/proto/gen/go/tako/v1"
)

type containerMetricSample struct {
	recordedAt time.Time
	cpuTotal   uint64
	rxBytes    uint64
	txBytes    uint64
}

type Client struct {
	cli               *client.Client
	prevMetricsMu     sync.Mutex
	prevMetrics       map[string]containerMetricSample
	cachedTelemetryMu sync.RWMutex
	cachedTelemetry   []*takov1.ContainerTelemetry
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

	return &Client{
		cli:         cli,
		prevMetrics: make(map[string]containerMetricSample),
	}, nil
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
		// Secondary fallback: if nameOrSlug contained a revision suffix (like tako-app-my-slug-d060ee29)
		// but that specific revision container is not present or dead, resolve to active containers for the base service
		baseSlug := slug
		if idx := strings.LastIndex(slug, "-"); idx > 0 && len(slug)-idx-1 >= 7 {
			candidateHash := slug[idx+1:]
			isHex := true
			for _, ch := range candidateHash {
				if !((ch >= '0' && ch <= '9') || (ch >= 'a' && ch <= 'f') || (ch >= 'A' && ch <= 'F')) {
					isHex = false
					break
				}
			}
			if isHex {
				baseSlug = slug[:idx]
			}
		}

		if baseSlug != slug {
			basePrefix := "tako-app-" + baseSlug + "-"
			baseLegacy := "tako-app-" + baseSlug
			for _, cont := range all {
				isMatch := cont.Labels["tako.service.name"] == baseSlug
				if !isMatch {
					for _, n := range cont.Names {
						clean := strings.TrimPrefix(n, "/")
						if strings.HasPrefix(clean, basePrefix) || clean == baseLegacy || clean == baseSlug {
							isMatch = true
							break
						}
					}
				}
				if isMatch {
					matched = append(matched, cont)
				}
			}
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

	if strings.HasPrefix(action, "update-limits:") {
		parts := strings.Split(action, ":")
		if len(parts) >= 4 {
			var cpuCores float64
			var memoryMb, swapMb int64
			_, _ = fmt.Sscanf(parts[1], "%f", &cpuCores)
			_, _ = fmt.Sscanf(parts[2], "%d", &memoryMb)
			_, _ = fmt.Sscanf(parts[3], "%d", &swapMb)

			targets := c.ResolveAllContainers(ctx, containerName)
			if len(targets) == 0 {
				return fmt.Errorf("no running container found for %s", containerName)
			}
			var lastErr error
			for _, t := range targets {
				var resources container.Resources
				if cpuCores > 0 {
					resources.NanoCPUs = int64(cpuCores * 1e9)
				}
				if memoryMb > 0 {
					memBytes := memoryMb * 1024 * 1024
					swapBytes := (memoryMb + swapMb) * 1024 * 1024
					resources.Memory = memBytes
					resources.MemorySwap = swapBytes
				}
				_, err := c.cli.ContainerUpdate(ctx, t, container.UpdateConfig{
					Resources: resources,
				})
				if err != nil {
					lastErr = err
				}
			}
			return lastErr
		}
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

// GetCachedTelemetry returns the most recently collected container telemetry.
func (c *Client) GetCachedTelemetry() []*takov1.ContainerTelemetry {
	if c == nil {
		return nil
	}
	c.cachedTelemetryMu.RLock()
	defer c.cachedTelemetryMu.RUnlock()
	if len(c.cachedTelemetry) == 0 {
		return nil
	}
	res := make([]*takov1.ContainerTelemetry, len(c.cachedTelemetry))
	copy(res, c.cachedTelemetry)
	return res
}

// UpdateCachedTelemetry runs CollectContainersTelemetry and stores the result in cache.
func (c *Client) UpdateCachedTelemetry(ctx context.Context) ([]*takov1.ContainerTelemetry, error) {
	if c == nil || c.cli == nil {
		return nil, nil
	}
	res, err := c.CollectContainersTelemetry(ctx)
	if err == nil && res != nil {
		c.cachedTelemetryMu.Lock()
		c.cachedTelemetry = res
		c.cachedTelemetryMu.Unlock()
	}
	return res, err
}

// CollectContainersTelemetry queries real-time cgroup telemetry from running containers concurrently.
func (c *Client) CollectContainersTelemetry(ctx context.Context) ([]*takov1.ContainerTelemetry, error) {
	if c.cli == nil {
		return nil, nil
	}

	running, err := c.cli.ContainerList(ctx, container.ListOptions{All: false})
	if err != nil {
		return nil, err
	}

	type targetContainer struct {
		cont        types.Container
		cName       string
		serviceID   string
		serviceSlug string
	}

	var targets []targetContainer
	for _, cont := range running {
		cName := ""
		if len(cont.Names) > 0 {
			cName = cont.Names[0]
		}

		serviceID := cont.Labels["tako.service.id"]
		serviceSlug := cont.Labels["tako.service.name"]

		// Only monitor Tako application and database containers
		isTakoContainer := serviceID != "" || serviceSlug != "" || strings.HasPrefix(strings.TrimPrefix(cName, "/"), "tako-app-")
		if !isTakoContainer {
			continue
		}

		serviceSlug = extractServiceSlug(cName, serviceSlug)
		targets = append(targets, targetContainer{
			cont:        cont,
			cName:       cName,
			serviceID:   serviceID,
			serviceSlug: serviceSlug,
		})
	}

	if len(targets) == 0 {
		return nil, nil
	}

	var mu sync.Mutex
	var results []*takov1.ContainerTelemetry
	var wg sync.WaitGroup

	for _, tgt := range targets {
		wg.Add(1)
		go func(t targetContainer) {
			defer wg.Done()

			// Per-container timeout so one slow container doesn't block others
			statCtx, cancel := context.WithTimeout(ctx, 2*time.Second)
			defer cancel()

			statsResp, err := c.cli.ContainerStats(statCtx, t.cont.ID, false)
			if err != nil {
				return
			}

			var stats types.StatsJSON
			decodeErr := json.NewDecoder(statsResp.Body).Decode(&stats)
			_ = statsResp.Body.Close()
			if decodeErr != nil && decodeErr != io.EOF {
				return
			}

			// Calculate CPU %
			cpuDelta := float64(stats.CPUStats.CPUUsage.TotalUsage) - float64(stats.PreCPUStats.CPUUsage.TotalUsage)
			systemDelta := float64(stats.CPUStats.SystemUsage) - float64(stats.PreCPUStats.SystemUsage)
			onlineCPUs := float64(stats.CPUStats.OnlineCPUs)
			if onlineCPUs == 0 {
				onlineCPUs = float64(len(stats.CPUStats.CPUUsage.PercpuUsage))
			}
			if onlineCPUs == 0 {
				onlineCPUs = 1
			}

			var cpuPct float64
			if systemDelta > 0.0 && cpuDelta > 0.0 {
				cpuPct = (cpuDelta / systemDelta) * onlineCPUs * 100.0
			}

			now := time.Now()
			c.prevMetricsMu.Lock()
			prev, hasPrev := c.prevMetrics[t.cont.ID]
			if cpuPct == 0 && hasPrev {
				sec := now.Sub(prev.recordedAt).Seconds()
				if sec > 0 && stats.CPUStats.CPUUsage.TotalUsage > prev.cpuTotal {
					usedNanos := float64(stats.CPUStats.CPUUsage.TotalUsage - prev.cpuTotal)
					cpuPct = (usedNanos / (sec * 1e9)) * onlineCPUs * 100.0
				}
			}
			cpuPct = math.Round(cpuPct*100) / 100

			// Memory
			memUsed := stats.MemoryStats.Usage
			if cache, ok := stats.MemoryStats.Stats["inactive_file"]; ok && memUsed > cache {
				memUsed -= cache
			} else if cache, ok := stats.MemoryStats.Stats["total_inactive_file"]; ok && memUsed > cache {
				memUsed -= cache
			}
			memUsedMb := int64(memUsed / (1024 * 1024))
			memLimitMb := int64(stats.MemoryStats.Limit / (1024 * 1024))

			// Network
			var rxBytes, txBytes uint64
			for _, netStat := range stats.Networks {
				rxBytes += netStat.RxBytes
				txBytes += netStat.TxBytes
			}

			var rxKbps, txKbps float64
			if hasPrev {
				sec := now.Sub(prev.recordedAt).Seconds()
				if sec > 0 {
					if rxBytes >= prev.rxBytes {
						rxKbps = math.Round(((float64(rxBytes-prev.rxBytes)/1024.0)/sec)*100) / 100
					}
					if txBytes >= prev.txBytes {
						txKbps = math.Round(((float64(txBytes-prev.txBytes)/1024.0)/sec)*100) / 100
					}
				}
			}

			c.prevMetrics[t.cont.ID] = containerMetricSample{
				recordedAt: now,
				cpuTotal:   stats.CPUStats.CPUUsage.TotalUsage,
				rxBytes:    rxBytes,
				txBytes:    txBytes,
			}
			c.prevMetricsMu.Unlock()

			// Disk I/O
			var diskRead, diskWrite int64
			for _, entry := range stats.BlkioStats.IoServiceBytesRecursive {
				op := strings.ToLower(entry.Op)
				if op == "read" {
					diskRead += int64(entry.Value)
				} else if op == "write" {
					diskWrite += int64(entry.Value)
				}
			}

			item := &takov1.ContainerTelemetry{
				ContainerId:    t.cont.ID,
				Name:           strings.TrimPrefix(t.cName, "/"),
				ServiceId:      t.serviceID,
				ServiceSlug:    t.serviceSlug,
				CpuPercent:     cpuPct,
				MemoryUsedMb:   memUsedMb,
				MemoryLimitMb:  memLimitMb,
				NetworkRxKbps:  rxKbps,
				NetworkTxKbps:  txKbps,
				DiskReadBytes:  diskRead,
				DiskWriteBytes: diskWrite,
			}

			mu.Lock()
			results = append(results, item)
			mu.Unlock()
		}(tgt)
	}

	wg.Wait()
	return results, nil
}

func extractServiceSlug(containerName, fallbackSlug string) string {
	if fallbackSlug != "" {
		return fallbackSlug
	}
	clean := strings.TrimPrefix(strings.TrimPrefix(containerName, "/"), "tako-app-")
	parts := strings.Split(clean, "-")
	if len(parts) > 1 {
		last := parts[len(parts)-1]
		if len(last) <= 8 || last == "preview" || last == "latest" {
			return strings.Join(parts[:len(parts)-1], "-")
		}
	}
	return clean
}
