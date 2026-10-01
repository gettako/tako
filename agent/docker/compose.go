package docker

import (
	"bufio"
	"context"
	"fmt"
	"io"
	"log/slog"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/docker/docker/api/types/container"
	"github.com/docker/docker/api/types/image"
	"github.com/docker/docker/api/types/network"
	"github.com/docker/docker/client"
	"github.com/docker/docker/pkg/stdcopy"
	"github.com/docker/go-connections/nat"
	ocispec "github.com/opencontainers/image-spec/specs-go/v1"

	"gettako.dev/tako/internal/compose"
	"gettako.dev/tako/internal/protocol"
)

type ComposeDockerClient interface {
	NetworkCreate(ctx context.Context, name string, options network.CreateOptions) (network.CreateResponse, error)
	NetworkInspect(ctx context.Context, networkID string, options network.InspectOptions) (network.Inspect, error)
	NetworkConnect(ctx context.Context, networkID, containerID string, config *network.EndpointSettings) error
	NetworkRemove(ctx context.Context, networkID string) error
	ContainerCreate(ctx context.Context, config *container.Config, hostConfig *container.HostConfig, networkingConfig *network.NetworkingConfig, platform *ocispec.Platform, containerName string) (container.CreateResponse, error)
	ContainerStart(ctx context.Context, containerID string, options container.StartOptions) error
	ContainerInspect(ctx context.Context, containerID string) (container.InspectResponse, error)
	ContainerList(ctx context.Context, options container.ListOptions) ([]container.Summary, error)
	ContainerStop(ctx context.Context, containerID string, options container.StopOptions) error
	ContainerRemove(ctx context.Context, containerID string, options container.RemoveOptions) error
	ContainerLogs(ctx context.Context, container string, options container.LogsOptions) (io.ReadCloser, error)
	ImageInspect(ctx context.Context, imageID string, inspectOpts ...client.ImageInspectOption) (image.InspectResponse, error)
	ImagePull(ctx context.Context, refStr string, options image.PullOptions) (io.ReadCloser, error)
}

type ComposeManager struct {
	cli        ComposeDockerClient
	builder    *Builder
	traefikMgr *TraefikManager
	buildsDir  string
}

func NewComposeManager(cli ComposeDockerClient, builder *Builder, traefikMgr *TraefikManager, buildsDir ...string) *ComposeManager {
	dir := filepath.Join(os.TempDir(), "tako-compose-builds")
	if len(buildsDir) > 0 && buildsDir[0] != "" {
		dir = buildsDir[0]
	}
	return &ComposeManager{
		cli:        cli,
		builder:    builder,
		traefikMgr: traefikMgr,
		buildsDir:  dir,
	}
}

func (m *ComposeManager) EnsureNetwork(ctx context.Context, netName string) error {
	_, err := m.cli.NetworkInspect(ctx, netName, network.InspectOptions{})
	if err == nil {
		return nil
	}
	_, err = m.cli.NetworkCreate(ctx, netName, network.CreateOptions{
		Driver: "bridge",
	})
	if err != nil && !strings.Contains(err.Error(), "already exists") {
		return fmt.Errorf("failed to create network %s: %w", netName, err)
	}
	return nil
}

func (m *ComposeManager) Execute(ctx context.Context, job *protocol.DeployJob, sender LogSender) error {
	depID := job.GetDeploymentId()
	serviceID := job.GetServiceId()
	projectID := job.GetProjectId()
	if projectID == "" {
		projectID = serviceID
	}

	_ = sender.SendStatusTransition(&protocol.DeploymentStatusTransition{
		DeploymentId: depID,
		Status:       "building",
		Timestamp:    time.Now().Unix(),
	})

	var composeContent string
	var workDir string

	if job.GetComposeFileContent() != "" {
		composeContent = job.GetComposeFileContent()
		_ = sender.SendBuildLog(&protocol.BuildLogChunk{
			DeploymentId: depID,
			LogLine:      "Using inline Docker Compose configuration...",
			Timestamp:    time.Now().UnixNano(),
		})
	} else if job.GetRepository() != "" {
		workDir = filepath.Join(m.buildsDir, fmt.Sprintf("%s-%s", serviceID, depID))
		defer func() {
			_ = os.RemoveAll(workDir)
		}()

		_ = sender.SendBuildLog(&protocol.BuildLogChunk{
			DeploymentId: depID,
			LogLine:      fmt.Sprintf("Cloning repository %s (%s)...", job.GetRepository(), job.GetBranch()),
			Timestamp:    time.Now().UnixNano(),
		})

		_, err := m.builder.CloneRepository(ctx, job.GetRepository(), job.GetBranch(), job.GetCommitSha(), workDir, job.GetSshPrivateKey())
		if err != nil {
			errReason := fmt.Sprintf("Failed to clone repository: %v", err)
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
			return err
		}

		filePath := job.GetComposeFilePath()
		if filePath == "" {
			candidates := []string{"docker-compose.yml", "docker-compose.yaml", "compose.yml", "compose.yaml"}
			for _, c := range candidates {
				target := filepath.Join(workDir, c)
				if _, err := os.Stat(target); err == nil {
					filePath = c
					break
				}
			}
		}

		if filePath == "" {
			errReason := "No compose file (docker-compose.yml or compose.yml) found in repository root"
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
			return fmt.Errorf("%s", errReason)
		}

		fullPath := filepath.Join(workDir, filePath)
		bytes, err := os.ReadFile(fullPath)
		if err != nil {
			errReason := fmt.Sprintf("Failed to read compose file %s: %v", filePath, err)
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
			return err
		}
		composeContent = string(bytes)
	} else {
		errReason := "No compose content or repository provided for Compose deployment"
		_ = sender.SendStatusTransition(&protocol.DeploymentStatusTransition{
			DeploymentId: depID,
			Status:       "failed",
			ErrorReason:  errReason,
			Timestamp:    time.Now().Unix(),
		})
		return fmt.Errorf("%s", errReason)
	}

	parsed, valRes := compose.ParseAndValidate(composeContent)
	if !valRes.Valid {
		errReason := fmt.Sprintf("Invalid Compose YAML: %s", strings.Join(valRes.Errors, "; "))
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
		return fmt.Errorf("%s", errReason)
	}

	startupOrder, err := compose.ResolveStartupOrder(valRes.Services)
	if err != nil {
		errReason := fmt.Sprintf("Circular or invalid service dependencies: %v", err)
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
		return err
	}

	// 1. Create / Ensure Project Network (tako_compose_{project_id})
	projectNetwork := fmt.Sprintf("tako_compose_%s", projectID)
	if err := m.EnsureNetwork(ctx, projectNetwork); err != nil {
		_ = sender.SendBuildLog(&protocol.BuildLogChunk{
			DeploymentId: depID,
			LogLine:      fmt.Sprintf("Failed to initialize project network %s: %v", projectNetwork, err),
			IsError:      true,
			Timestamp:    time.Now().UnixNano(),
		})
		return err
	}
	_ = m.EnsureNetwork(ctx, "tako_network")

	_ = sender.SendStatusTransition(&protocol.DeploymentStatusTransition{
		DeploymentId: depID,
		Status:       "deploying",
		Timestamp:    time.Now().Unix(),
	})

	_ = sender.SendBuildLog(&protocol.BuildLogChunk{
		DeploymentId: depID,
		LogLine:      fmt.Sprintf("Starting %d services in order: %s", len(startupOrder), strings.Join(startupOrder, " -> ")),
		Timestamp:    time.Now().UnixNano(),
	})

	var primarySubService string
	var primaryContainerIP string
	var primaryPort int32 = 80

	for _, svcName := range startupOrder {
		spec := parsed.Services[svcName]
		imageTag := spec.Image

		if imageTag == "" && spec.Build != nil {
			imageTag = fmt.Sprintf("tako-compose-%s-%s:%s", serviceID, svcName, depID)
			_ = sender.SendBuildLog(&protocol.BuildLogChunk{
				DeploymentId: depID,
				LogLine:      fmt.Sprintf("[%s] Building image %s...", svcName, imageTag),
				Timestamp:    time.Now().UnixNano(),
			})
			// If we have a build context directory
			contextDir := workDir
			if spec.Build.Context != "" {
				contextDir = filepath.Join(workDir, spec.Build.Context)
			}
			dockerfile := "Dockerfile"
			if spec.Build.Dockerfile != "" {
				dockerfile = spec.Build.Dockerfile
			}
			buildJob := &protocol.DeployJob{
				DeploymentId:   depID,
				ServiceId:      serviceID,
				DockerfilePath: dockerfile,
			}
			bRes, err := m.builder.BuildDirectory(ctx, buildJob, contextDir, dockerfile, imageTag, sender)
			if err != nil {
				return fmt.Errorf("failed to build compose service %s: %w", svcName, err)
			}
			imageTag = bRes.ImageTag
		}

		if imageTag != "" {
			_, err := m.cli.ImageInspect(ctx, imageTag)
			if err != nil {
				_ = sender.SendBuildLog(&protocol.BuildLogChunk{
					DeploymentId: depID,
					LogLine:      fmt.Sprintf("[%s] Pulling image %s...", svcName, imageTag),
					Timestamp:    time.Now().UnixNano(),
				})
				reader, pullErr := m.cli.ImagePull(ctx, imageTag, image.PullOptions{})
				if pullErr != nil {
					return fmt.Errorf("failed to pull image %s for %s: %w", imageTag, svcName, pullErr)
				}
				if reader != nil {
					_, _ = io.Copy(io.Discard, reader)
					_ = reader.Close()
				}
			}
		}

		// Clean up any existing container for this subservice
		containerName := fmt.Sprintf("tako-%s-%s", serviceID, svcName)
		stopTimeout := 5
		_ = m.cli.ContainerStop(ctx, containerName, container.StopOptions{Timeout: &stopTimeout})
		_ = m.cli.ContainerRemove(ctx, containerName, container.RemoveOptions{Force: true})

		// Prepare environment
		envMap := make(map[string]string)
		for k, v := range spec.Environment {
			envMap[k] = v
		}
		// Overlay Tako-level env vars
		for k, v := range job.GetEnvVars() {
			envMap[k] = v
		}
		var envList []string
		for k, v := range envMap {
			envList = append(envList, fmt.Sprintf("%s=%s", k, v))
		}

		// Prepare ports
		exposedPorts := nat.PortSet{}
		portBindings := nat.PortMap{}
		var serviceInternalPort int32

		for _, pm := range spec.Ports {
			if pm.ContainerPort > 0 {
				portKey := nat.Port(fmt.Sprintf("%d/tcp", pm.ContainerPort))
				exposedPorts[portKey] = struct{}{}
				if pm.HostPort > 0 {
					portBindings[portKey] = []nat.PortBinding{
						{
							HostIP:   "0.0.0.0",
							HostPort: fmt.Sprintf("%d", pm.HostPort),
						},
					}
				}
				if serviceInternalPort == 0 {
					serviceInternalPort = int32(pm.ContainerPort)
				}
			}
		}

		// Prepare volumes with defense-in-depth checks against forbidden host bind mounts
		var binds []string
		for _, v := range spec.Volumes {
			parts := strings.Split(v, ":")
			if len(parts) > 1 {
				hostPath := parts[0]
				if strings.HasPrefix(hostPath, "/") || strings.HasPrefix(hostPath, "~") || strings.Contains(hostPath, "..") {
					return fmt.Errorf("host directory bind mounts are forbidden: %s", v)
				}
			}
			if strings.Contains(v, "/var/run/docker.sock") || strings.Contains(v, "/etc/tako") || strings.Contains(v, "/proc") || strings.Contains(v, "/sys") {
				return fmt.Errorf("host directory bind mounts are forbidden: %s", v)
			}
			binds = append(binds, v)
		}

		cfg := &container.Config{
			Image:        imageTag,
			Env:          envList,
			ExposedPorts: exposedPorts,
			Labels: map[string]string{
				"tako.service_id":    serviceID,
				"tako.deployment_id": depID,
				"tako.project_id":    projectID,
				"tako.service_type":  "compose",
				"tako.sub_service":   svcName,
				"tako.managed":       "true",
			},
		}

		hostCfg := &container.HostConfig{
			RestartPolicy: container.RestartPolicy{
				Name: container.RestartPolicyMode(spec.Restart),
			},
			PortBindings: portBindings,
			Binds:        binds,
			NetworkMode:  container.NetworkMode(projectNetwork),
		}
		if hostCfg.RestartPolicy.Name == "" {
			hostCfg.RestartPolicy.Name = container.RestartPolicyMode("unless-stopped")
		}

		netCfg := &network.NetworkingConfig{
			EndpointsConfig: map[string]*network.EndpointSettings{
				projectNetwork: {
					Aliases: []string{svcName},
				},
			},
		}

		createResp, err := m.cli.ContainerCreate(ctx, cfg, hostCfg, netCfg, nil, containerName)
		if err != nil {
			return fmt.Errorf("failed to create container %s: %w", containerName, err)
		}

		if err := m.cli.ContainerStart(ctx, createResp.ID, container.StartOptions{}); err != nil {
			return fmt.Errorf("failed to start container %s: %w", containerName, err)
		}

		// Also attach to tako_network if this sub-service should be exposed to Traefik
		// Determine if this is candidate for primary ingress
		isIngressCandidate := svcName == "web" || svcName == "app" || svcName == "api" || svcName == "frontend" || primarySubService == ""
		if isIngressCandidate && job.GetDomain() != "" {
			_ = m.cli.NetworkConnect(ctx, "tako_network", createResp.ID, &network.EndpointSettings{})
			insp, err := m.cli.ContainerInspect(ctx, createResp.ID)
			if err == nil {
				if net, ok := insp.NetworkSettings.Networks["tako_network"]; ok && net.IPAddress != "" {
					primaryContainerIP = net.IPAddress
					primarySubService = svcName
					if serviceInternalPort > 0 {
						primaryPort = serviceInternalPort
					}
				}
			}
		}

		_ = sender.SendBuildLog(&protocol.BuildLogChunk{
			DeploymentId: depID,
			LogLine:      fmt.Sprintf("[%s] Container %s started successfully.", svcName, containerName),
			Timestamp:    time.Now().UnixNano(),
		})

		// Stream logs in background
		go m.streamLogs(context.Background(), serviceID, svcName, createResp.ID, sender)
	}

	// Update Traefik routing if domain is configured and primary container found
	if job.GetDomain() != "" && m.traefikMgr != nil && primaryContainerIP != "" {
		_ = sender.SendBuildLog(&protocol.BuildLogChunk{
			DeploymentId: depID,
			LogLine:      fmt.Sprintf("Routing domain %s to sub-service %s (%s:%d) via Traefik...", job.GetDomain(), primarySubService, primaryContainerIP, primaryPort),
			Timestamp:    time.Now().UnixNano(),
		})
		_ = m.traefikMgr.UpdateRoute(serviceID, job.GetDomain(), primaryContainerIP, primaryPort)
	}

	_ = sender.SendStatusTransition(&protocol.DeploymentStatusTransition{
		DeploymentId: depID,
		Status:       "healthy",
		Timestamp:    time.Now().Unix(),
	})

	_ = sender.SendBuildLog(&protocol.BuildLogChunk{
		DeploymentId: depID,
		LogLine:      "Docker Compose stack deployment completed successfully.",
		Timestamp:    time.Now().UnixNano(),
	})

	return nil
}

func (m *ComposeManager) streamLogs(ctx context.Context, serviceID, subServiceName, containerID string, sender LogSender) {
	logOpts := container.LogsOptions{
		ShowStdout: true,
		ShowStderr: true,
		Follow:     true,
		Tail:       "50",
	}

	reader, err := m.cli.ContainerLogs(ctx, containerID, logOpts)
	if err != nil {
		slog.Debug("failed to stream container logs for compose subservice",
			slog.String("service_id", serviceID),
			slog.String("sub_service", subServiceName),
			slog.String("error", err.Error()),
		)
		return
	}
	defer reader.Close()

	outR, outW := io.Pipe()
	errR, errW := io.Pipe()

	go func() {
		_, _ = stdcopy.StdCopy(outW, errW, reader)
		_ = outW.Close()
		_ = errW.Close()
	}()

	go func() {
		scanner := bufio.NewScanner(outR)
		for scanner.Scan() {
			if sender != nil {
				_ = sender.SendContainerLog(&protocol.ContainerLogChunk{
					ServiceId:     serviceID,
					ContainerName: subServiceName,
					LogLine:       scanner.Text(),
					IsStderr:      false,
					Timestamp:     time.Now().UnixNano(),
				})
			}
		}
	}()

	scannerErr := bufio.NewScanner(errR)
	for scannerErr.Scan() {
		if sender != nil {
			_ = sender.SendContainerLog(&protocol.ContainerLogChunk{
				ServiceId:     serviceID,
				ContainerName: subServiceName,
				LogLine:       scannerErr.Text(),
				IsStderr:      true,
				Timestamp:     time.Now().UnixNano(),
			})
		}
	}
}
