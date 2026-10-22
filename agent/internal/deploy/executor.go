package deploy

import (
	"context"
	"fmt"
	"io"
	"log"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"gettako.dev/tako/agent/internal/docker"
	"gettako.dev/tako/agent/internal/traefik"
	takov1 "gettako.dev/tako/proto/gen/go/tako/v1"
	"github.com/docker/docker/api/types/container"
	"github.com/docker/docker/api/types/image"
	"github.com/docker/docker/api/types/network"
	"github.com/docker/go-connections/nat"
)

type Executor struct {
	dockerCli *docker.Client
}

func NewExecutor(dockerCli *docker.Client) *Executor {
	return &Executor{dockerCli: dockerCli}
}

func (e *Executor) ExecuteDeploy(
	ctx context.Context,
	req *takov1.DeployRequest,
	stream takov1.DeploymentService_DeployServer,
) error {
	var onLogChunk func(chunk *takov1.DeployLogChunk)
	if stream != nil {
		onLogChunk = func(chunk *takov1.DeployLogChunk) {
			_ = stream.Send(chunk)
		}
	}
	return e.ExecuteDeployWithCallback(ctx, req, onLogChunk)
}

func (e *Executor) ExecuteDeployWithCallback(
	ctx context.Context,
	req *takov1.DeployRequest,
	onLogChunk func(chunk *takov1.DeployLogChunk),
) error {
	depID := req.GetDeploymentId()
	serviceName := req.GetServiceName()
	if serviceName == "" {
		serviceName = req.GetServiceId()
	}

	sendLog := func(step, msg string, isError bool) {
		chunk := &takov1.DeployLogChunk{
			DeploymentId: depID,
			Step:         step,
			Message:      msg,
			Timestamp:    time.Now().Unix(),
			IsError:      isError,
		}
		if onLogChunk != nil {
			onLogChunk(chunk)
		}
		log.Printf("[deploy-%s] [%s] %s", depID, step, msg)
	}

	sendLog("Queued", fmt.Sprintf("Deployment %s initialized for service %s", depID, serviceName), false)

	commit8 := req.GetCommitHash()
	if len(commit8) > 8 {
		commit8 = commit8[:8]
	}
	if commit8 == "" || commit8 == "main" || commit8 == "master" {
		cleanDep := strings.TrimPrefix(depID, "dep-")
		if len(cleanDep) >= 8 {
			commit8 = cleanDep[:8]
		} else {
			commit8 = "preview"
		}
	}

	// containerName is tako-app-<slug>-<commit8> to isolate deployments
	containerName := fmt.Sprintf("tako-app-%s-%s", serviceName, commit8)

	// Step 1: Pull or Build Image
	targetImage := req.GetImage()
	if targetImage == "" {
		targetImage = fmt.Sprintf("tako/%s:%s", serviceName, commit8)
	}

	if req.GetRepository() != "" {
		actualHash := e.handleGitBuild(ctx, req, targetImage, sendLog)
		if actualHash != "" && (req.GetCommitHash() == "" || req.GetCommitHash() == "main" || req.GetCommitHash() == "master") {
			commit8 = actualHash
			if len(commit8) > 8 {
				commit8 = commit8[:8]
			}
			containerName = fmt.Sprintf("tako-app-%s-%s", serviceName, commit8)
		}
		sendLog("Push/Load image", fmt.Sprintf("Image %s ready for deployment", targetImage), false)
	} else if e.dockerCli != nil && req.GetImage() != "" {
		sendLog("Push/Load image", fmt.Sprintf("Pulling image %s...", targetImage), false)
		pullOpts := image.PullOptions{}
		if auth := req.GetEnvVars()["_TAKO_REGISTRY_AUTH"]; auth != "" {
			pullOpts.RegistryAuth = auth
			sendLog("Push/Load image", "Authenticating with private image registry...", false)
		}
		reader, err := e.dockerCli.RawClient().ImagePull(ctx, targetImage, pullOpts)
		if err == nil {
			_, _ = io.Copy(io.Discard, reader)
			_ = reader.Close()
			sendLog("Push/Load image", fmt.Sprintf("Successfully pulled %s", targetImage), false)
		} else {
			sendLog("Push/Load image", fmt.Sprintf("Notice: pull skipped or offline (%v), proceeding with local image", err), false)
		}
	} else {
		sendLog("Push/Load image", fmt.Sprintf("Using specified image %s", targetImage), false)
	}

	// Step 2: Prepare Traefik Labels & Dynamic Config
	targetPort := 80
	if len(req.GetPorts()) > 0 && req.GetPorts()[0] > 0 {
		targetPort = int(req.GetPorts()[0])
	}

	// Determine whether any production (non-preview) custom domain is present
	hasCustomDomain := false
	for _, d := range req.GetDomains() {
		if !traefik.IsWildcardDomain(d) {
			hasCustomDomain = true
			break
		}
	}

	// Separate preview domain (sslip.io / nip.io / xip.io) from canonical/custom domains
	var previewDomains []string
	var canonicalDomains []string

	for _, d := range req.GetDomains() {
		trimmed := strings.TrimSpace(d)
		if trimmed == "" {
			continue
		}
		if traefik.IsWildcardDomain(trimmed) {
			if strings.HasPrefix(trimmed, commit8+"-") {
				previewDomains = append(previewDomains, trimmed)
			}
			canonicalDomains = append(canonicalDomains, trimmed)
		} else {
			canonicalDomains = append(canonicalDomains, trimmed)
		}
	}

	// If no commit-specific preview domain was found, fallback to wildcard preview domains only
	if len(previewDomains) == 0 {
		for _, d := range req.GetDomains() {
			if trimmed := strings.TrimSpace(d); traefik.IsWildcardDomain(trimmed) {
				previewDomains = append(previewDomains, trimmed)
			}
		}
	}

	dynamicDir := os.Getenv("TAKO_TRAEFIK_DYNAMIC_DIR")
	if dynamicDir == "" {
		dynamicDir = "/etc/tako/traefik/dynamic"
	}

	// 1. Write preview dynamic config specifically for this commit (if preview domains present)
	var traefikLabels map[string]string
	if len(previewDomains) > 0 {
		previewCfg := traefik.RouteConfig{
			ServiceName:   serviceName,
			ConfigName:    fmt.Sprintf("%s-%s", serviceName, commit8),
			ContainerName: containerName,
			Domains:       previewDomains,
			TargetPort:    targetPort,
			EnableTLS:     false,
			Network:       "tako-network",
		}
		_ = traefik.WriteDynamicConfig(dynamicDir, previewCfg)
		traefikLabels = traefik.GenerateLabels(previewCfg)
	} else {
		traefikLabels = make(map[string]string)
	}

	traefikLabels["tako.service.id"] = req.GetServiceId()
	traefikLabels["tako.service.name"] = serviceName
	traefikLabels["tako.deployment.id"] = depID
	traefikLabels["tako.commit.prefix"] = commit8

	if len(req.GetDomains()) > 0 {
		sendLog("Deploy", fmt.Sprintf("Prepared Traefik routing rules for %d domains (port %d)", len(req.GetDomains()), targetPort), false)
	} else if req.GetPublishToHost() {
		sendLog("Deploy", fmt.Sprintf("Direct TCP host port exposure (port %d, no HTTP routing)", targetPort), false)
	}

	// Step 3: Run Container
	if e.dockerCli != nil {
		// Stop & remove existing container with the same name if exists (re-deploying same commit)
		_ = e.dockerCli.RawClient().ContainerStop(ctx, containerName, container.StopOptions{})
		_ = e.dockerCli.RawClient().ContainerRemove(ctx, containerName, container.RemoveOptions{Force: true})

		// Convert env vars map to slice (skip internal Tako orchestrator signals)
		envList := make([]string, 0, len(req.GetEnvVars()))
		for k, v := range req.GetEnvVars() {
			if strings.HasPrefix(k, "_TAKO_") {
				continue
			}
			envList = append(envList, fmt.Sprintf("%s=%s", k, v))
		}

		exposedPorts := make(nat.PortSet)
		portBindings := make(nat.PortMap)

		if req.GetPublishToHost() && targetPort > 0 {
			// Proactively release the host port from any other running preview containers of this service
			e.releaseServiceHostPort(ctx, req.GetServiceId(), serviceName, containerName, targetPort, sendLog)

			portKey := nat.Port(fmt.Sprintf("%d/tcp", targetPort))
			exposedPorts[portKey] = struct{}{}
			portBindings[portKey] = []nat.PortBinding{
				{
					HostIP:   "0.0.0.0",
					HostPort: fmt.Sprintf("%d", targetPort),
				},
			}
			sendLog("Deploy", fmt.Sprintf("Publishing host port 0.0.0.0:%d -> %d/tcp", targetPort, targetPort), false)
		}

		var containerResources container.Resources
		if req.GetCpuLimit() > 0 {
			containerResources.NanoCPUs = int64(req.GetCpuLimit() * 1e9)
		}
		if req.GetMemoryLimitMb() > 0 {
			memBytes := req.GetMemoryLimitMb() * 1024 * 1024
			containerResources.Memory = memBytes
			containerResources.MemorySwap = memBytes
		}

		var binds []string
		lowerImg := strings.ToLower(targetImage)
		if strings.Contains(lowerImg, "postgres") {
			binds = append(binds, fmt.Sprintf("tako-data-%s:/var/lib/postgresql/data", serviceName))
		} else if strings.Contains(lowerImg, "mysql") {
			binds = append(binds, fmt.Sprintf("tako-data-%s:/var/lib/mysql", serviceName))
		} else if strings.Contains(lowerImg, "redis") {
			binds = append(binds, fmt.Sprintf("tako-data-%s:/data", serviceName))
		} else if strings.Contains(lowerImg, "mongo") {
			binds = append(binds, fmt.Sprintf("tako-data-%s:/data/db", serviceName))
		}

		var healthConfig *container.HealthConfig
		if healthPath := req.GetEnvVars()["TAKO_HEALTHCHECK_PATH"]; healthPath != "" {
			interval := 15 * time.Second
			if v, err := strconv.Atoi(req.GetEnvVars()["TAKO_HEALTHCHECK_INTERVAL"]); err == nil && v > 0 {
				interval = time.Duration(v) * time.Second
			}
			timeout := 5 * time.Second
			if v, err := strconv.Atoi(req.GetEnvVars()["TAKO_HEALTHCHECK_TIMEOUT"]); err == nil && v > 0 {
				timeout = time.Duration(v) * time.Second
			}
			retries := 3
			if v, err := strconv.Atoi(req.GetEnvVars()["TAKO_HEALTHCHECK_RETRIES"]); err == nil && v > 0 {
				retries = v
			}
			startPeriod := 5 * time.Second
			if v, err := strconv.Atoi(req.GetEnvVars()["TAKO_HEALTHCHECK_INITIAL_DELAY"]); err == nil && v > 0 {
				startPeriod = time.Duration(v) * time.Second
			}
			checkPort := targetPort
			if v, err := strconv.Atoi(req.GetEnvVars()["TAKO_HEALTHCHECK_PORT"]); err == nil && v > 0 {
				checkPort = v
			}
			healthConfig = &container.HealthConfig{
				Test:        []string{"CMD-SHELL", fmt.Sprintf("wget -q -O - http://127.0.0.1:%d%s > /dev/null || curl -f http://127.0.0.1:%d%s > /dev/null || exit 1", checkPort, healthPath, checkPort, healthPath)},
				Interval:    interval,
				Timeout:     timeout,
				Retries:     retries,
				StartPeriod: startPeriod,
			}
			sendLog("Deploy", fmt.Sprintf("Configured Docker health probe: GET http://127.0.0.1:%d%s (every %v, retries %d)", checkPort, healthPath, interval, retries), false)
		}

		resp, err := e.dockerCli.RawClient().ContainerCreate(
			ctx,
			&container.Config{
				Image:        targetImage,
				Env:          envList,
				Labels:       traefikLabels,
				ExposedPorts: exposedPorts,
				Healthcheck:  healthConfig,
			},
			&container.HostConfig{
				RestartPolicy: container.RestartPolicy{Name: "unless-stopped"},
				PortBindings:  portBindings,
				Resources:     containerResources,
				Binds:         binds,
			},
			&network.NetworkingConfig{
				EndpointsConfig: map[string]*network.EndpointSettings{
					"tako-network": {},
				},
			},
			nil,
			containerName,
		)
		if err == nil {
			startErr := e.dockerCli.RawClient().ContainerStart(ctx, resp.ID, container.StartOptions{})
			if startErr != nil && strings.Contains(startErr.Error(), "port is already allocated") {
				sendLog("Deploy", fmt.Sprintf("Notice: host port %d is occupied. Falling back to Traefik domain routing.", targetPort), false)

				_ = e.dockerCli.RawClient().ContainerRemove(ctx, resp.ID, container.RemoveOptions{Force: true})
				respFallback, createFallbackErr := e.dockerCli.RawClient().ContainerCreate(
					ctx,
					&container.Config{
						Image:        targetImage,
						Env:          envList,
						Labels:       traefikLabels,
						ExposedPorts: exposedPorts,
						Healthcheck:  healthConfig,
					},
					&container.HostConfig{
						RestartPolicy: container.RestartPolicy{Name: "unless-stopped"},
						PortBindings:  nil,
						Resources:     containerResources,
						Binds:         binds,
					},
					&network.NetworkingConfig{
						EndpointsConfig: map[string]*network.EndpointSettings{
							"tako-network": {},
						},
					},
					nil,
					containerName,
				)
				if createFallbackErr == nil {
					resp = respFallback
					startErr = e.dockerCli.RawClient().ContainerStart(ctx, resp.ID, container.StartOptions{})
				}
			}

			if startErr != nil {
				_ = os.Remove(filepath.Join(dynamicDir, fmt.Sprintf("%s-%s.yml", serviceName, commit8)))
				sendLog("Deploy", fmt.Sprintf("Error: could not start container %s: %v", resp.ID[:12], startErr), true)
				return fmt.Errorf("failed to start container %s: %w", resp.ID[:12], startErr)
			} else {
				sendLog("Deploy", fmt.Sprintf("Container %s started successfully", resp.ID[:12]), false)
			}
		} else {
			sendLog("Deploy", fmt.Sprintf("Docker container creation simulated: %s (%v)", containerName, err), false)
		}
	} else {
		sendLog("Deploy", fmt.Sprintf("Container %s registered in orchestrator", containerName), false)
	}

	// Step 4: Health Check & Live
	sendLog("Health check", "Verifying service container status...", false)
	if e.dockerCli != nil {
		healthy := false
		var lastInspectErr error
		maxAttempts := 15
		if req.GetEnvVars()["TAKO_HEALTHCHECK_PATH"] != "" {
			maxAttempts = 35 // Allow up to 35s for health check warming up
		}

		for i := 0; i < maxAttempts; i++ {
			if i > 0 {
				select {
				case <-ctx.Done():
					return ctx.Err()
				case <-time.After(1 * time.Second):
				}
			}
			inspect, err := e.dockerCli.RawClient().ContainerInspect(ctx, containerName)
			if err != nil {
				lastInspectErr = err
				continue
			}

			if inspect.State != nil {
				if !inspect.State.Running && inspect.State.ExitCode != 0 {
					_ = os.Remove(filepath.Join(dynamicDir, fmt.Sprintf("%s-%s.yml", serviceName, commit8)))
					errMsg := fmt.Sprintf("Health check FAILED: container exited prematurely with code %d (Error: %s)", inspect.State.ExitCode, inspect.State.Error)
					sendLog("Health check", errMsg, true)
					return fmt.Errorf("container exited prematurely with code %d", inspect.State.ExitCode)
				}
				if inspect.State.OOMKilled {
					_ = os.Remove(filepath.Join(dynamicDir, fmt.Sprintf("%s-%s.yml", serviceName, commit8)))
					errMsg := "Health check FAILED: container terminated by OOM killer"
					sendLog("Health check", errMsg, true)
					return fmt.Errorf("container terminated by OOM killer")
				}
				if inspect.State.Health != nil {
					switch inspect.State.Health.Status {
					case "unhealthy":
						_ = os.Remove(filepath.Join(dynamicDir, fmt.Sprintf("%s-%s.yml", serviceName, commit8)))
						errMsg := "Health check FAILED: container reported unhealthy status"
						sendLog("Health check", errMsg, true)
						return fmt.Errorf("container reported unhealthy status")
					case "healthy":
						healthy = true
					case "starting":
						// Container healthcheck is still warming up; wait for next probe
					default:
						if inspect.State.Running {
							healthy = true
						}
					}
				} else if inspect.State.Running {
					healthy = true
				}

				if healthy {
					break
				}
			}
		}

		if !healthy {
			_ = os.Remove(filepath.Join(dynamicDir, fmt.Sprintf("%s-%s.yml", serviceName, commit8)))
			errMsg := "Health check FAILED: container did not become healthy within timeout"
			if lastInspectErr != nil {
				errMsg = fmt.Sprintf("Health check FAILED: %v", lastInspectErr)
			}
			sendLog("Health check", errMsg, true)
			return fmt.Errorf("%s", errMsg)
		}

		sendLog("Health check", fmt.Sprintf("Health check passed: container %s is running and stable", containerName), false)

		// Safely promote canonical domain routing ONLY after health check passes
		if len(canonicalDomains) > 0 {
			canonicalCfg := traefik.RouteConfig{
				ServiceName:   serviceName,
				ConfigName:    serviceName, // writes to <serviceName>.yml
				ContainerName: containerName,
				Domains:       canonicalDomains,
				TargetPort:    targetPort,
				EnableTLS:     hasCustomDomain,
				Network:       "tako-network",
			}
			_ = traefik.WriteDynamicConfig(dynamicDir, canonicalCfg)
			sendLog("Deploy", fmt.Sprintf("Canonical domain routing updated to %s", containerName), false)

			// Allow Traefik dynamic file provider to converge before terminating old containers
			time.Sleep(1 * time.Second)
		}
	} else {
		time.Sleep(50 * time.Millisecond)
	}

	// Retention Pruning: enforce maximum number of retained preview deployments
	e.pruneOldDeployments(ctx, req, dynamicDir, sendLog)

	sendLog("Live", fmt.Sprintf("Service %s is live and ready to receive traffic!", serviceName), false)

	return nil
}
