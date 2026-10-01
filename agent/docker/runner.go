package docker

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/docker/docker/api/types/container"
	"github.com/docker/docker/api/types/network"
	"github.com/docker/go-connections/nat"
	ocispec "github.com/opencontainers/image-spec/specs-go/v1"

	"gettako.dev/tako/internal/protocol"
)

type DockerRunnerClient interface {
	NetworkCreate(ctx context.Context, name string, options network.CreateOptions) (network.CreateResponse, error)
	NetworkInspect(ctx context.Context, networkID string, options network.InspectOptions) (network.Inspect, error)
	ContainerCreate(ctx context.Context, config *container.Config, hostConfig *container.HostConfig, networkingConfig *network.NetworkingConfig, platform *ocispec.Platform, containerName string) (container.CreateResponse, error)
	ContainerStart(ctx context.Context, containerID string, options container.StartOptions) error
	ContainerInspect(ctx context.Context, containerID string) (container.InspectResponse, error)
	ContainerList(ctx context.Context, options container.ListOptions) ([]container.Summary, error)
	ContainerStop(ctx context.Context, containerID string, options container.StopOptions) error
	ContainerRemove(ctx context.Context, containerID string, options container.RemoveOptions) error
}

type HTTPClient interface {
	Do(req *http.Request) (*http.Response, error)
}

type RunnerConfig struct {
	NetworkName          string
	HealthCheckInterval  time.Duration
	HealthCheckTimeout   time.Duration
	ConsecutiveSuccesses int
	DrainTimeout         time.Duration
}

func DefaultRunnerConfig() RunnerConfig {
	return RunnerConfig{
		NetworkName:          "tako_network",
		HealthCheckInterval:  2 * time.Second,
		HealthCheckTimeout:   60 * time.Second,
		ConsecutiveSuccesses: 2,
		DrainTimeout:         10 * time.Second,
	}
}

type Runner struct {
	cli        DockerRunnerClient
	httpClient HTTPClient
	cfg        RunnerConfig
}

func NewRunner(cli DockerRunnerClient, httpClient HTTPClient, cfg ...RunnerConfig) *Runner {
	c := DefaultRunnerConfig()
	if len(cfg) > 0 {
		c = cfg[0]
	}
	if httpClient == nil {
		httpClient = &http.Client{Timeout: 3 * time.Second}
	}
	return &Runner{
		cli:        cli,
		httpClient: httpClient,
		cfg:        c,
	}
}

func (r *Runner) EnsureNetwork(ctx context.Context, networkName string) error {
	_, err := r.cli.NetworkInspect(ctx, networkName, network.InspectOptions{})
	if err == nil {
		return nil
	}

	_, err = r.cli.NetworkCreate(ctx, networkName, network.CreateOptions{
		Driver: "bridge",
	})
	if err != nil && !strings.Contains(err.Error(), "already exists") {
		return fmt.Errorf("failed to create docker network %s: %w", networkName, err)
	}
	return nil
}

type LaunchedContainer struct {
	ContainerID string
	IPAddress   string
	Port        int32
	ImageTag    string
}

func (r *Runner) LaunchAndVerify(ctx context.Context, job *protocol.DeployJob, imageTag string, sender LogSender) (*LaunchedContainer, error) {
	depID := job.GetDeploymentId()
	serviceID := job.GetServiceId()

	if err := r.EnsureNetwork(ctx, r.cfg.NetworkName); err != nil {
		slog.Warn("ensure network warning", slog.String("error", err.Error()))
	}

	_ = sender.SendStatusTransition(&protocol.DeploymentStatusTransition{
		DeploymentId: depID,
		Status:       "deploying",
		Timestamp:    time.Now().Unix(),
	})

	_ = sender.SendBuildLog(&protocol.BuildLogChunk{
		DeploymentId: depID,
		LogLine:      fmt.Sprintf("Creating container for %s with image %s...", serviceID, imageTag),
		Timestamp:    time.Now().UnixNano(),
	})

	// Inject runtime environment variables
	envSlice := make([]string, 0, len(job.GetEnvVars()))
	for k, v := range job.GetEnvVars() {
		envSlice = append(envSlice, fmt.Sprintf("%s=%s", k, v))
	}

	port := job.GetInternalPort()
	if port <= 0 {
		port = 3000
	}

	publishedPort := job.GetPublishedPort()
	if publishedPort <= 0 && job.GetDomain() == "" && job.GetServiceType() != "worker" && job.GetServiceType() != "cron" {
		publishedPort = port
	}

	containerName := fmt.Sprintf("tako-%s-%s", serviceID, depID)

	labels := map[string]string{
		"tako.service_id":    serviceID,
		"tako.deployment_id": depID,
		"tako.managed":       "true",
		"tako.service_type":  job.GetServiceType(),
		"tako.domain":        job.GetDomain(),
		"tako.port":          fmt.Sprintf("%d", port),
	}
	if publishedPort > 0 {
		labels["tako.published_port"] = fmt.Sprintf("%d", publishedPort)
	}

	containerConfig := &container.Config{
		Image:  imageTag,
		Env:    envSlice,
		Labels: labels,
	}

	if publishedPort > 0 {
		portKey := nat.Port(fmt.Sprintf("%d/tcp", port))
		containerConfig.ExposedPorts = nat.PortSet{
			portKey: struct{}{},
		}
	}

	if job.GetVolumeName() != "" {
		containerConfig.Labels["tako.volume_name"] = job.GetVolumeName()
		containerConfig.Labels["tako.volume_mount_path"] = job.GetVolumeMountPath()
	}

	restartPolicyName := container.RestartPolicyMode("unless-stopped")
	if job.GetServiceType() == "worker" {
		restartPolicyName = container.RestartPolicyMode("always")
		if job.GetCommand() != "" {
			containerConfig.Cmd = []string{"sh", "-c", job.GetCommand()}
		}
	} else if job.GetServiceType() == "database" {
		restartPolicyName = container.RestartPolicyMode("unless-stopped")
		if job.GetCommand() != "" {
			containerConfig.Cmd = strings.Fields(job.GetCommand())
		}
	}

	hostConfig := &container.HostConfig{
		RestartPolicy: container.RestartPolicy{
			Name: restartPolicyName,
		},
		NetworkMode: container.NetworkMode(r.cfg.NetworkName),
	}

	if publishedPort > 0 {
		portKey := nat.Port(fmt.Sprintf("%d/tcp", port))
		hostConfig.PortBindings = nat.PortMap{
			portKey: []nat.PortBinding{
				{
					HostIP:   "0.0.0.0",
					HostPort: fmt.Sprintf("%d", publishedPort),
				},
			},
		}
	}

	if job.GetVolumeName() != "" && job.GetVolumeMountPath() != "" {
		hostConfig.Binds = append(hostConfig.Binds, fmt.Sprintf("%s:%s", job.GetVolumeName(), job.GetVolumeMountPath()))
	}

	networkingConfig := &network.NetworkingConfig{
		EndpointsConfig: map[string]*network.EndpointSettings{
			r.cfg.NetworkName: {
				Aliases: []string{"tako-" + serviceID},
			},
		},
	}

	createResp, err := r.cli.ContainerCreate(ctx, containerConfig, hostConfig, networkingConfig, nil, containerName)
	if err != nil {
		errReason := fmt.Sprintf("ContainerCreate failed: %v", err)
		_ = sender.SendBuildLog(&protocol.BuildLogChunk{
			DeploymentId: depID,
			LogLine:      errReason,
			IsError:      true,
			Timestamp:    time.Now().UnixNano(),
		})
		_ = sender.SendStatusTransition(&protocol.DeploymentStatusTransition{
			DeploymentId: depID,
			Status:       "failed",
			ErrorReason:  errReason,
			Timestamp:    time.Now().Unix(),
		})
		return nil, errors.New(errReason)
	}

	containerID := createResp.ID

	if publishedPort > 0 {
		// Stop and remove previous containers of this service BEFORE starting the new one.
		// The port binding is only released once the old container is fully removed; merely
		// stopping it is not enough — Docker still holds the NAT rule until removal.
		containers, listErr := r.cli.ContainerList(ctx, container.ListOptions{})
		if listErr == nil {
			for _, c := range containers {
				if c.Labels["tako.service_id"] == serviceID && c.ID != containerID {
					stopTimeout := 10
					_ = r.cli.ContainerStop(ctx, c.ID, container.StopOptions{Timeout: &stopTimeout})
					_ = r.cli.ContainerRemove(ctx, c.ID, container.RemoveOptions{Force: true})
				}
			}
		}
		_ = sender.SendBuildLog(&protocol.BuildLogChunk{
			DeploymentId: depID,
			LogLine:      fmt.Sprintf("Direct port mapping: 0.0.0.0:%d -> %d/tcp", publishedPort, port),
			Timestamp:    time.Now().UnixNano(),
		})
	}

	_ = sender.SendBuildLog(&protocol.BuildLogChunk{
		DeploymentId: depID,
		LogLine:      fmt.Sprintf("Starting container %s...", containerID[:12]),
		Timestamp:    time.Now().UnixNano(),
	})

	if err := r.cli.ContainerStart(ctx, containerID, container.StartOptions{}); err != nil {
		errReason := fmt.Sprintf("ContainerStart failed: %v", err)
		_ = sender.SendBuildLog(&protocol.BuildLogChunk{
			DeploymentId: depID,
			LogLine:      errReason,
			IsError:      true,
			Timestamp:    time.Now().UnixNano(),
		})
		_ = sender.SendStatusTransition(&protocol.DeploymentStatusTransition{
			DeploymentId: depID,
			Status:       "failed",
			ErrorReason:  errReason,
			Timestamp:    time.Now().Unix(),
		})
		_ = r.cli.ContainerRemove(context.Background(), containerID, container.RemoveOptions{Force: true})
		return nil, errors.New(errReason)
	}

	inspect, err := r.cli.ContainerInspect(ctx, containerID)
	if err != nil {
		errReason := fmt.Sprintf("ContainerInspect failed: %v", err)
		_ = sender.SendStatusTransition(&protocol.DeploymentStatusTransition{
			DeploymentId: depID,
			Status:       "failed",
			ErrorReason:  errReason,
			Timestamp:    time.Now().Unix(),
		})
		_ = r.cli.ContainerRemove(context.Background(), containerID, container.RemoveOptions{Force: true})
		return nil, errors.New(errReason)
	}

	ipAddress := ""
	if inspect.NetworkSettings != nil {
		if netSetting, ok := inspect.NetworkSettings.Networks[r.cfg.NetworkName]; ok && netSetting.IPAddress != "" {
			ipAddress = netSetting.IPAddress
		} else if inspect.NetworkSettings.IPAddress != "" {
			ipAddress = inspect.NetworkSettings.IPAddress
		}
	}
	if ipAddress == "" {
		ipAddress = "127.0.0.1"
	}

	if job.GetServiceType() == "worker" {
		_ = sender.SendBuildLog(&protocol.BuildLogChunk{
			DeploymentId: depID,
			LogLine:      fmt.Sprintf("Worker container %s started and running with command %q (restart: always).", containerID[:12], job.GetCommand()),
			Timestamp:    time.Now().UnixNano(),
		})
		return &LaunchedContainer{
			ContainerID: containerID,
			IPAddress:   ipAddress,
			Port:        port,
			ImageTag:    imageTag,
		}, nil
	}

	if job.GetServiceType() == "database" {
		_ = sender.SendBuildLog(&protocol.BuildLogChunk{
			DeploymentId: depID,
			LogLine:      fmt.Sprintf("Database container %s is running with persistent volume %q mounted at %q (alias tako-%s, internal port %d).", containerID[:12], job.GetVolumeName(), job.GetVolumeMountPath(), serviceID, port),
			Timestamp:    time.Now().UnixNano(),
		})
		return &LaunchedContainer{
			ContainerID: containerID,
			IPAddress:   ipAddress,
			Port:        port,
			ImageTag:    imageTag,
		}, nil
	}

	healthCheckPath := job.GetHealthCheckPath()
	if healthCheckPath == "" {
		healthCheckPath = "/healthz"
	}
	if !strings.HasPrefix(healthCheckPath, "/") {
		healthCheckPath = "/" + healthCheckPath
	}

	healthURL := fmt.Sprintf("http://%s:%d%s", ipAddress, port, healthCheckPath)

	_ = sender.SendBuildLog(&protocol.BuildLogChunk{
		DeploymentId: depID,
		LogLine:      fmt.Sprintf("Verifying container health at %s (interval=%v, timeout=%v)...", healthURL, r.cfg.HealthCheckInterval, r.cfg.HealthCheckTimeout),
		Timestamp:    time.Now().UnixNano(),
	})

	// HTTP Health Check Polling Loop
	checkCtx, checkCancel := context.WithTimeout(ctx, r.cfg.HealthCheckTimeout)
	defer checkCancel()

	ticker := time.NewTicker(r.cfg.HealthCheckInterval)
	defer ticker.Stop()

	successCount := 0
	startTime := time.Now()

	for {
		req, err := http.NewRequestWithContext(checkCtx, http.MethodGet, healthURL, nil)
		if err == nil {
			resp, err := r.httpClient.Do(req)
			if err == nil && resp != nil {
				_ = resp.Body.Close()
				if resp.StatusCode >= 200 && resp.StatusCode < 300 {
					successCount++
					_ = sender.SendBuildLog(&protocol.BuildLogChunk{
						DeploymentId: depID,
						LogLine:      fmt.Sprintf("Health check success (%d/%d): HTTP %d", successCount, r.cfg.ConsecutiveSuccesses, resp.StatusCode),
						Timestamp:    time.Now().UnixNano(),
					})
					if successCount >= r.cfg.ConsecutiveSuccesses {
						_ = sender.SendBuildLog(&protocol.BuildLogChunk{
							DeploymentId: depID,
							LogLine:      fmt.Sprintf("Container is healthy (passed %d consecutive checks in %v).", successCount, time.Since(startTime).Round(time.Millisecond)),
							Timestamp:    time.Now().UnixNano(),
						})
						return &LaunchedContainer{
							ContainerID: containerID,
							IPAddress:   ipAddress,
							Port:        port,
							ImageTag:    imageTag,
						}, nil
					}
				} else {
					successCount = 0
					_ = sender.SendBuildLog(&protocol.BuildLogChunk{
						DeploymentId: depID,
						LogLine:      fmt.Sprintf("Health check returned status HTTP %d", resp.StatusCode),
						Timestamp:    time.Now().UnixNano(),
					})
				}
			} else {
				successCount = 0
			}
		}

		select {
		case <-checkCtx.Done():
			errReason := fmt.Sprintf("Health check timed out after %v without passing consecutive checks", r.cfg.HealthCheckTimeout)
			_ = sender.SendBuildLog(&protocol.BuildLogChunk{
				DeploymentId: depID,
				LogLine:      errReason,
				IsError:      true,
				Timestamp:    time.Now().UnixNano(),
			})
			_ = sender.SendStatusTransition(&protocol.DeploymentStatusTransition{
				DeploymentId: depID,
				Status:       "failed",
				ErrorReason:  errReason,
				Timestamp:    time.Now().Unix(),
			})

			// Graceful cleanup of the failed new container
			stopTimeout := 5
			_ = r.cli.ContainerStop(context.Background(), containerID, container.StopOptions{Timeout: &stopTimeout})
			_ = r.cli.ContainerRemove(context.Background(), containerID, container.RemoveOptions{Force: true})

			return nil, errors.New(errReason)
		case <-ticker.C:
		}
	}
}
