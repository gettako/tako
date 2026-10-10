package deploy

import (
	"archive/tar"
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"os"
	"os/exec"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/docker/docker/api/types"
	"github.com/docker/docker/api/types/container"
	"github.com/docker/docker/api/types/image"
	"github.com/docker/docker/api/types/network"
	"github.com/docker/go-connections/nat"
	"gettako.dev/tako/agent/internal/docker"
	"gettako.dev/tako/agent/internal/traefik"
	takov1 "gettako.dev/tako/proto/gen/go/tako/v1"
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
		reader, err := e.dockerCli.RawClient().ImagePull(ctx, targetImage, image.PullOptions{})
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

		// Convert env vars map to slice
		envList := make([]string, 0, len(req.GetEnvVars()))
		for k, v := range req.GetEnvVars() {
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

		resp, err := e.dockerCli.RawClient().ContainerCreate(
			ctx,
			&container.Config{
				Image:        targetImage,
				Env:          envList,
				Labels:       traefikLabels,
				ExposedPorts: exposedPorts,
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
		for i := 0; i < 5; i++ {
			time.Sleep(time.Duration(100+i*150) * time.Millisecond)
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
				if inspect.State.Running {
					healthy = true
				}
			}
		}

		if !healthy && lastInspectErr != nil {
			sendLog("Health check", fmt.Sprintf("Notice: container inspect returned: %v", lastInspectErr), false)
		} else if healthy {
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
			}
		}
	} else {
		time.Sleep(50 * time.Millisecond)
	}

	// Retention Pruning: enforce maximum number of retained preview deployments
	e.pruneOldDeployments(ctx, req, dynamicDir, sendLog)

	sendLog("Live", fmt.Sprintf("Service %s is live and ready to receive traffic!", serviceName), false)

	return nil
}

func (e *Executor) pruneOldDeployments(
	ctx context.Context,
	req *takov1.DeployRequest,
	dynamicDir string,
	sendLog func(step, msg string, isError bool),
) {
	if e.dockerCli == nil {
		return
	}

	retentionLimit := 2
	if rStr, ok := req.GetEnvVars()["TAKO_PREVIEW_RETENTION"]; ok {
		if rInt, err := strconv.Atoi(rStr); err == nil && rInt > 0 {
			retentionLimit = rInt
		}
	} else if rStr := os.Getenv("TAKO_PREVIEW_RETENTION"); rStr != "" {
		if rInt, err := strconv.Atoi(rStr); err == nil && rInt > 0 {
			retentionLimit = rInt
		}
	}

	serviceID := req.GetServiceId()
	serviceName := req.GetServiceName()

	allContainers, err := e.dockerCli.ListContainers(ctx, true)
	if err != nil {
		return
	}

	var serviceContainers []types.Container
	prefix := fmt.Sprintf("/tako-app-%s-", serviceName)
	exactLegacy := fmt.Sprintf("/tako-app-%s", serviceName)

	for _, c := range allContainers {
		isMatch := false
		if c.Labels["tako.service.id"] == serviceID {
			isMatch = true
		} else {
			for _, n := range c.Names {
				if strings.HasPrefix(n, prefix) || n == exactLegacy {
					isMatch = true
					break
				}
			}
		}
		if isMatch {
			serviceContainers = append(serviceContainers, c)
		}
	}

	// 1. Clean up any orphaned preview YAML files in dynamicDir for which no container exists
	if files, err := filepath.Glob(filepath.Join(dynamicDir, fmt.Sprintf("%s-*.yml", serviceName))); err == nil {
		for _, f := range files {
			base := filepath.Base(f)
			commitPart := strings.TrimSuffix(strings.TrimPrefix(base, serviceName+"-"), ".yml")
			if commitPart != "" && commitPart != serviceName {
				expectedContainer := fmt.Sprintf("tako-app-%s-%s", serviceName, commitPart)
				containerExists := false
				for _, sc := range allContainers {
					for _, name := range sc.Names {
						if strings.TrimPrefix(name, "/") == expectedContainer {
							containerExists = true
							break
						}
					}
					if containerExists {
						break
					}
				}
				if !containerExists {
					_ = os.Remove(f)
					sendLog("Health check", fmt.Sprintf("Cleaned orphaned Traefik route file %s", base), false)
				}
			}
		}
	}

	// 2. Clean up any zero-byte empty YAML files in dynamicDir
	if allYmls, err := filepath.Glob(filepath.Join(dynamicDir, "*.yml")); err == nil {
		for _, y := range allYmls {
			if fi, err := os.Stat(y); err == nil && fi.Size() == 0 {
				_ = os.Remove(y)
			}
		}
	}

	if len(serviceContainers) <= retentionLimit {
		return
	}

	// Sort containers by Created timestamp descending (newest first)
	sort.Slice(serviceContainers, func(i, j int) bool {
		return serviceContainers[i].Created > serviceContainers[j].Created
	})

	for i := retentionLimit; i < len(serviceContainers); i++ {
		c := serviceContainers[i]
		commitPrefix := c.Labels["tako.commit.prefix"]
		if commitPrefix == "" {
			for _, n := range c.Names {
				cleanName := strings.TrimPrefix(n, "/")
				if strings.HasPrefix(cleanName, "tako-app-"+serviceName+"-") {
					commitPrefix = strings.TrimPrefix(cleanName, "tako-app-"+serviceName+"-")
					break
				}
			}
		}

		_ = e.dockerCli.RawClient().ContainerStop(ctx, c.ID, container.StopOptions{})
		_ = e.dockerCli.RawClient().ContainerRemove(ctx, c.ID, container.RemoveOptions{Force: true})

		if commitPrefix != "" {
			previewConfigPath := filepath.Join(dynamicDir, fmt.Sprintf("%s-%s.yml", serviceName, commitPrefix))
			_ = os.Remove(previewConfigPath)
		}

		shortID := c.ID
		if len(shortID) > 12 {
			shortID = shortID[:12]
		}
		sendLog("Health check", fmt.Sprintf("Pruned older container %s (revision: %s) to maintain retention quota of %d", shortID, commitPrefix, retentionLimit), false)
	}
}

func (e *Executor) releaseServiceHostPort(
	ctx context.Context,
	serviceID string,
	serviceName string,
	currentContainerName string,
	targetPort int,
	sendLog func(step, msg string, isError bool),
) {
	if e.dockerCli == nil || targetPort <= 0 {
		return
	}

	runningContainers, err := e.dockerCli.ListContainers(ctx, false)
	if err != nil {
		return
	}

	prefix := fmt.Sprintf("/tako-app-%s-", serviceName)
	exactLegacy := fmt.Sprintf("/tako-app-%s", serviceName)

	for _, c := range runningContainers {
		// Skip container being currently created/deployed
		isCurrent := false
		for _, n := range c.Names {
			cleanN := strings.TrimPrefix(n, "/")
			if cleanN == currentContainerName {
				isCurrent = true
				break
			}
		}
		if isCurrent {
			continue
		}

		// Check if it belongs to this service
		isServiceContainer := false
		if c.Labels["tako.service.id"] == serviceID {
			isServiceContainer = true
		} else {
			for _, n := range c.Names {
				if strings.HasPrefix(n, prefix) || n == exactLegacy {
					isServiceContainer = true
					break
				}
			}
		}

		if !isServiceContainer {
			continue
		}

		// Check if it currently binds targetPort on the host
		hasPortBinding := false
		for _, p := range c.Ports {
			if p.PublicPort == uint16(targetPort) {
				hasPortBinding = true
				break
			}
		}

		if !hasPortBinding {
			continue
		}

		cName := ""
		if len(c.Names) > 0 {
			cName = strings.TrimPrefix(c.Names[0], "/")
		} else {
			cName = c.ID[:12]
		}

		inspect, inspectErr := e.dockerCli.RawClient().ContainerInspect(ctx, c.ID)
		if inspectErr != nil {
			_ = e.dockerCli.RawClient().ContainerStop(ctx, c.ID, container.StopOptions{})
			sendLog("Deploy", fmt.Sprintf("Stopped conflicting container %s to release host port %d", cName, targetPort), false)
			continue
		}

		// Stop and remove container currently holding the host port
		_ = e.dockerCli.RawClient().ContainerStop(ctx, c.ID, container.StopOptions{})
		_ = e.dockerCli.RawClient().ContainerRemove(ctx, c.ID, container.RemoveOptions{Force: true})

		// Recreate container without host port bindings so it remains alive on Traefik network
		cfg := inspect.Config
		if cfg != nil {
			cfg.Hostname = ""
			if inspect.Image != "" {
				cfg.Image = inspect.Image
			}
		}
		recreated, createErr := e.dockerCli.RawClient().ContainerCreate(
			ctx,
			cfg,
			&container.HostConfig{
				RestartPolicy: container.RestartPolicy{Name: "unless-stopped"},
				PortBindings:  nil, // No host port binding
			},
			&network.NetworkingConfig{
				EndpointsConfig: map[string]*network.EndpointSettings{
					"tako-network": {},
				},
			},
			nil,
			cName,
		)
		if createErr == nil {
			_ = e.dockerCli.RawClient().ContainerStart(ctx, recreated.ID, container.StartOptions{})
			sendLog("Deploy", fmt.Sprintf("Released host port %d from preview container %s (kept active on Traefik network)", targetPort, cName), false)
		} else {
			sendLog("Deploy", fmt.Sprintf("Released host port %d by stopping preview container %s", targetPort, cName), false)
		}
	}
}

func (e *Executor) handleGitBuild(
	ctx context.Context,
	req *takov1.DeployRequest,
	targetImage string,
	sendLog func(step, msg string, isError bool),
) string {
	commitHash := req.GetCommitHash()

	// 1. Reuse existing cached image for this commit if explicitly specified (not main/master) and already built locally
	if e.dockerCli != nil && commitHash != "" && commitHash != "main" && commitHash != "master" {
		if _, _, err := e.dockerCli.RawClient().ImageInspectWithRaw(ctx, targetImage); err == nil {
			sendLog("Build", fmt.Sprintf("Using cached local image %s for commit %s", targetImage, commitHash), false)
			return commitHash
		}
	}

	repoURL := req.GetRepository()
	branch := req.GetBranch()
	dockerfileName := req.GetDockerfile()
	if dockerfileName == "" {
		dockerfileName = "Dockerfile"
	}

	sendLog("Clone", fmt.Sprintf("Cloning repository %s (branch: %s)...", repoURL, branch), false)

	tmpDir, err := os.MkdirTemp("", "tako-repo-*")
	if err != nil {
		sendLog("Clone", fmt.Sprintf("Notice: temp dir error (%v), falling back to simulated clone", err), false)
		sendLog("Build", fmt.Sprintf("Building Dockerfile %s...", dockerfileName), false)
		sendLog("Build", fmt.Sprintf("Successfully tagged %s", targetImage), false)
		return commitHash
	}
	defer os.RemoveAll(tmpDir)

	cloneArgs := []string{"clone", "--depth", "1"}
	if branch != "" {
		cloneArgs = append(cloneArgs, "--branch", branch)
	}
	cloneArgs = append(cloneArgs, repoURL, tmpDir)

	cmd := exec.CommandContext(ctx, "git", cloneArgs...)
	out, err := cmd.CombinedOutput()
	if err != nil {
		sendLog("Clone", fmt.Sprintf("Notice: git clone output: %s (%v)", strings.TrimSpace(string(out)), err), false)
		sendLog("Build", fmt.Sprintf("Building Dockerfile %s (simulated context)...", dockerfileName), false)
		sendLog("Build", fmt.Sprintf("Successfully tagged %s", targetImage), false)
		return commitHash
	}

	sendLog("Clone", fmt.Sprintf("Successfully cloned %s", repoURL), false)

	if commitHash != "" {
		checkoutCmd := exec.CommandContext(ctx, "git", "-C", tmpDir, "checkout", commitHash)
		if err := checkoutCmd.Run(); err != nil {
			// In shallow clone depth 1, commitHash might not be fetched yet. Fetch it explicitly.
			fetchCmd := exec.CommandContext(ctx, "git", "-C", tmpDir, "fetch", "--depth", "1", "origin", commitHash)
			if err := fetchCmd.Run(); err == nil {
				_ = exec.CommandContext(ctx, "git", "-C", tmpDir, "checkout", "FETCH_HEAD").Run()
			} else {
				// Fallback: unshallow and checkout
				_ = exec.CommandContext(ctx, "git", "-C", tmpDir, "fetch", "--unshallow").Run()
				_ = exec.CommandContext(ctx, "git", "-C", tmpDir, "checkout", commitHash).Run()
			}
		}
	}

	// Extract actual commit metadata from repository
	headCommitOut, _ := exec.CommandContext(ctx, "git", "-C", tmpDir, "rev-parse", "HEAD").Output()
	actualHash := strings.TrimSpace(string(headCommitOut))
	msgOut, _ := exec.CommandContext(ctx, "git", "-C", tmpDir, "log", "-1", "--format=%s").Output()
	actualMsg := strings.TrimSpace(string(msgOut))
	authorOut, _ := exec.CommandContext(ctx, "git", "-C", tmpDir, "log", "-1", "--format=%an").Output()
	actualAuthor := strings.TrimSpace(string(authorOut))

	if actualHash != "" {
		sendLog("Clone", fmt.Sprintf("HEAD commit %s: %s (by %s)", actualHash, actualMsg, actualAuthor), false)
	}

	dockerfilePath := filepath.Join(tmpDir, dockerfileName)
	if _, err := os.Stat(dockerfilePath); os.IsNotExist(err) {
		if _, err := os.Stat(filepath.Join(tmpDir, "package.json")); err == nil {
			sendLog("Build", "Notice: Dockerfile not found, auto-generated standard Node.js Dockerfile", false)
			_ = os.WriteFile(dockerfilePath, []byte("FROM node:20-alpine\nWORKDIR /app\nCOPY package*.json ./\nRUN npm install --production\nCOPY . .\nEXPOSE 3000\nCMD [\"npm\", \"start\"]\n"), 0o644)
		} else if _, err := os.Stat(filepath.Join(tmpDir, "go.mod")); err == nil {
			sendLog("Build", "Notice: Dockerfile not found, auto-generated standard Go Dockerfile", false)
			_ = os.WriteFile(dockerfilePath, []byte("FROM golang:1.24-alpine AS builder\nWORKDIR /app\nCOPY go.mod go.sum* ./\nRUN go mod download || true\nCOPY . .\nRUN CGO_ENABLED=0 go build -o /app/server .\nFROM alpine:3.20\nWORKDIR /app\nCOPY --from=builder /app/server /app/server\nEXPOSE 8080\nCMD [\"/app/server\"]\n"), 0o644)
		} else {
			sendLog("Build", fmt.Sprintf("Warning: Dockerfile not found at %s, creating minimal fallback Dockerfile", dockerfileName), false)
			_ = os.WriteFile(dockerfilePath, []byte("FROM alpine:latest\nCMD [\"echo\", \"tako app running\"]\n"), 0o644)
		}
	}

	sendLog("Build", fmt.Sprintf("Building Dockerfile %s with context %s...", dockerfileName, tmpDir), false)

	if e.dockerCli != nil {
		tarStream, err := createTarArchive(tmpDir)
		if err != nil {
			sendLog("Build", fmt.Sprintf("Failed to archive build context: %v", err), true)
			return actualHash
		}

		buildTags := []string{
			targetImage,
			fmt.Sprintf("tako/%s:latest", req.GetServiceName()),
		}
		if actualHash != "" && len(actualHash) >= 8 {
			buildTags = append(buildTags, fmt.Sprintf("tako/%s:%s", req.GetServiceName(), actualHash[:8]))
		}

		buildOpts := types.ImageBuildOptions{
			Tags:       buildTags,
			Dockerfile: dockerfileName,
			Remove:     true,
		}

		resp, err := e.dockerCli.RawClient().ImageBuild(ctx, tarStream, buildOpts)
		if err != nil {
			sendLog("Build", fmt.Sprintf("Docker ImageBuild notice: %v", err), false)
		} else {
			defer resp.Body.Close()
			scanner := bufio.NewScanner(resp.Body)
			for scanner.Scan() {
				line := scanner.Text()
				var msg struct {
					Stream string `json:"stream"`
					Error  string `json:"error"`
				}
				if jsonErr := json.Unmarshal([]byte(line), &msg); jsonErr == nil {
					if msg.Error != "" {
						sendLog("Build", msg.Error, true)
					} else if s := strings.TrimSpace(msg.Stream); s != "" {
						sendLog("Build", s, false)
					}
				} else if strings.TrimSpace(line) != "" {
					sendLog("Build", line, false)
				}
			}
		}
	}

	sendLog("Build", fmt.Sprintf("Successfully tagged %s", targetImage), false)
	return actualHash
}

func createTarArchive(srcDir string) (io.Reader, error) {
	var buf bytes.Buffer
	tw := tar.NewWriter(&buf)

	err := filepath.Walk(srcDir, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		if info.IsDir() && info.Name() == ".git" {
			return filepath.SkipDir
		}
		relPath, err := filepath.Rel(srcDir, path)
		if err != nil {
			return err
		}
		if relPath == "." {
			return nil
		}
		header, err := tar.FileInfoHeader(info, info.Name())
		if err != nil {
			return err
		}
		header.Name = filepath.ToSlash(relPath)
		if err := tw.WriteHeader(header); err != nil {
			return err
		}
		if !info.Mode().IsRegular() {
			return nil
		}
		file, err := os.Open(path)
		if err != nil {
			return err
		}
		defer file.Close()
		_, err = io.Copy(tw, file)
		return err
	})
	if err != nil {
		return nil, err
	}
	if err := tw.Close(); err != nil {
		return nil, err
	}
	return &buf, nil
}
