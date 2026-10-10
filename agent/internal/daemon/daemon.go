package daemon

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"gettako.dev/tako/agent/internal/client"
	"gettako.dev/tako/agent/internal/deploy"
	"gettako.dev/tako/agent/internal/docker"
	"gettako.dev/tako/agent/internal/metrics"
	"gettako.dev/tako/agent/internal/traefik"
	takov1 "gettako.dev/tako/proto/gen/go/tako/v1"
)

type Config struct {
	MasterURL         string
	EnrollToken       string
	NodeID            string
	NodeName          string
	Role              string
	IPAddress         string
	PublicIP          string
	StateFile         string
	HeartbeatInterval time.Duration
	Insecure          bool
}

type State struct {
	NodeID    string `json:"node_id"`
	AuthToken string `json:"auth_token"`
}

type Daemon struct {
	cfg       Config
	grpcCli   *client.Client
	dockerCli *docker.Client
	collector *metrics.Collector
	executor  *deploy.Executor
	mu        sync.RWMutex
	state     State
}

func New(cfg Config) (*Daemon, error) {
	if cfg.HeartbeatInterval <= 0 {
		cfg.HeartbeatInterval = 3 * time.Second
	}
	if cfg.Role == "" {
		cfg.Role = "worker"
	}

	grpcCli, err := client.New(client.Config{
		ServerAddr: cfg.MasterURL,
		Insecure:   cfg.Insecure,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to initialize grpc client: %w", err)
	}

	dockerCli, err := docker.New()
	if err != nil {
		log.Printf("[tako-agent] warning: docker client initialization failed (%v); continuing without docker", err)
	}

	d := &Daemon{
		cfg:       cfg,
		grpcCli:   grpcCli,
		dockerCli: dockerCli,
		collector: metrics.NewCollector(),
		executor:  deploy.NewExecutor(dockerCli),
	}

	d.loadState()
	return d, nil
}

func (d *Daemon) loadState() {
	if d.cfg.StateFile == "" {
		return
	}
	data, err := os.ReadFile(d.cfg.StateFile)
	if err != nil {
		return
	}
	var s State
	if err := json.Unmarshal(data, &s); err == nil && s.NodeID != "" {
		d.state = s
		d.grpcCli.SetAuthToken(s.AuthToken)
		log.Printf("[tako-agent] loaded existing state: node_id=%s", s.NodeID)
	}
}

func (d *Daemon) saveState() error {
	if d.cfg.StateFile == "" {
		return nil
	}
	dir := filepath.Dir(d.cfg.StateFile)
	if dir != "" && dir != "." {
		_ = os.MkdirAll(dir, 0o755)
	}
	data, err := json.MarshalIndent(d.state, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(d.cfg.StateFile, data, 0o600)
}

// EnsureRegistered performs handshake with Master and refreshes node specs.
func (d *Daemon) EnsureRegistered(ctx context.Context) error {
	d.mu.Lock()
	defer d.mu.Unlock()

	sysInfo := d.collector.GetSystemInfo(ctx)
	dockerVer := "unknown"
	if d.dockerCli != nil {
		if ver, err := d.dockerCli.Version(ctx); err == nil {
			dockerVer = ver
		}
	}

	nodeID := d.cfg.NodeID
	if nodeID == "" {
		if d.state.NodeID != "" {
			nodeID = d.state.NodeID
		} else {
			nodeID = d.cfg.NodeName
		}
	}

	req := &takov1.RegisterNodeRequest{
		NodeId:         nodeID,
		Name:           d.cfg.NodeName,
		IpAddress:      d.cfg.IPAddress,
		PublicIp:       d.cfg.PublicIP,
		Role:           d.cfg.Role,
		CpuTotalCores:  sysInfo.TotalCPUs,
		MemoryTotalMb:  sysInfo.TotalMemoryMB,
		DiskTotalGb:    sysInfo.TotalDiskGB,
		DockerVersion:  dockerVer,
		Os:             sysInfo.OS,
		KernelVersion:  sysInfo.KernelVersion,
		EnrollToken:    d.cfg.EnrollToken,
	}

	log.Printf("[tako-agent] registering node %s with master %s...", nodeID, d.cfg.MasterURL)
	resp, err := d.grpcCli.RegisterNode(ctx, req)
	if err != nil {
		return fmt.Errorf("node registration failed: %w", err)
	}

	d.state = State{
		NodeID:    resp.GetNodeId(),
		AuthToken: resp.GetAuthToken(),
	}
	d.grpcCli.SetAuthToken(resp.GetAuthToken())
	_ = d.saveState()

	log.Printf("[tako-agent] node registered successfully: id=%s status=%s", resp.GetNodeId(), resp.GetStatus())
	return nil
}

// Run starts the agent daemon loops (heartbeat & docker events) until ctx is cancelled.
func (d *Daemon) Run(ctx context.Context) error {
	if err := d.EnsureRegistered(ctx); err != nil {
		return fmt.Errorf("initial registration failed: %w", err)
	}

	// Start docker events watcher & background telemetry poller if docker is present
	if d.dockerCli != nil {
		go d.watchDockerEvents(ctx)
		go d.pollTelemetry(ctx)
	}

	// Start bi-directional task streaming loop with master
	go d.listenTasks(ctx)

	log.Printf("[tako-agent] starting heartbeat loop (interval: %v)...", d.cfg.HeartbeatInterval)
	ticker := time.NewTicker(d.cfg.HeartbeatInterval)
	defer ticker.Stop()

	// Initial heartbeat immediately
	d.sendHeartbeat(ctx)

	for {
		select {
		case <-ctx.Done():
			log.Println("[tako-agent] stopping daemon...")
			return d.Close()
		case <-ticker.C:
			d.sendHeartbeat(ctx)
		}
	}
}

func (d *Daemon) pollTelemetry(ctx context.Context) {
	ticker := time.NewTicker(3 * time.Second)
	defer ticker.Stop()

	// Initial collection in background
	_, _ = d.dockerCli.UpdateCachedTelemetry(ctx)

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			_, _ = d.dockerCli.UpdateCachedTelemetry(ctx)
		}
	}
}

func (d *Daemon) sendHeartbeat(ctx context.Context) {
	snap := d.collector.Collect(ctx)

	d.mu.RLock()
	nodeID := d.state.NodeID
	d.mu.RUnlock()

	var containers []*takov1.ContainerTelemetry
	if d.dockerCli != nil {
		containers = d.dockerCli.GetCachedTelemetry()
	}

	req := &takov1.HeartbeatRequest{
		NodeId:         nodeID,
		CpuPercent:     snap.CPUPercent,
		MemoryUsedMb:   snap.MemoryUsedMB,
		DiskUsedGb:     snap.DiskUsedGB,
		NetworkRxKbps:  snap.NetworkRxKBps,
		NetworkTxKbps:  snap.NetworkTxKBps,
		UptimeSeconds:  snap.UptimeSeconds,
		Timestamp:      snap.Timestamp,
		Containers:     containers,
	}

	// Dedicated RPC context with 5s timeout
	rpcCtx, rpcCancel := context.WithTimeout(ctx, 5*time.Second)
	defer rpcCancel()

	resp, err := d.grpcCli.Heartbeat(rpcCtx, req)
	if err != nil {
		if !errors.Is(err, context.Canceled) {
			log.Printf("[tako-agent] warning: heartbeat failed: %v", err)
		}
		return
	}

	if !resp.GetAcknowledged() {
		log.Printf("[tako-agent] warning: heartbeat not acknowledged by master")
	}
}

func (d *Daemon) watchDockerEvents(ctx context.Context) {
	eventsChan, errChan := d.dockerCli.Events(ctx)
	for {
		select {
		case <-ctx.Done():
			return
		case err := <-errChan:
			if err != nil && !errors.Is(err, context.Canceled) {
				log.Printf("[tako-agent] docker event stream warning: %v", err)
			}
			return
		case event := <-eventsChan:
			if event.Action == "die" || event.Action == "oom" || event.Action == "start" {
				log.Printf("[tako-agent] docker event: %s on container %s", event.Action, event.Actor.ID[:12])
			}
		}
	}
}

func (d *Daemon) Close() error {
	if d.dockerCli != nil {
		_ = d.dockerCli.Close()
	}
	if d.grpcCli != nil {
		return d.grpcCli.Close()
	}
	return nil
}

func (d *Daemon) listenTasks(ctx context.Context) {
	for {
		select {
		case <-ctx.Done():
			return
		default:
		}

		d.mu.RLock()
		nodeID := d.state.NodeID
		d.mu.RUnlock()

		if nodeID == "" {
			time.Sleep(1 * time.Second)
			continue
		}

		log.Printf("[tako-agent] connecting to master task stream (node: %s)...", nodeID)
		stream, err := d.grpcCli.AgentClient().StreamTasks(ctx)
		if err != nil {
			if !errors.Is(err, context.Canceled) {
				log.Printf("[tako-agent] warning: failed to connect task stream: %v (retrying in 3s)", err)
			}
			select {
			case <-ctx.Done():
				return
			case <-time.After(3 * time.Second):
				continue
			}
		}

		// Initial greeting/handshake
		_ = stream.Send(&takov1.AgentTaskResult{
			TaskId: "handshake",
			NodeId: nodeID,
		})

		log.Printf("[tako-agent] task stream established with master")

		for {
			task, err := stream.Recv()
			if err != nil {
				if !errors.Is(err, context.Canceled) {
					log.Printf("[tako-agent] task stream interrupted: %v (reconnecting...)", err)
				}
				break
			}

			if task == nil {
				continue
			}

			go d.handleTask(ctx, stream, task)
		}
	}
}

func errString(err error) string {
	if err != nil {
		return err.Error()
	}
	return ""
}

func (d *Daemon) handleTask(ctx context.Context, stream takov1.AgentService_StreamTasksClient, task *takov1.MasterTask) {
	taskID := task.GetTaskId()
	d.mu.RLock()
	nodeID := d.state.NodeID
	d.mu.RUnlock()

	sendDeployLog := func(chunk *takov1.DeployLogChunk) {
		_ = stream.Send(&takov1.AgentTaskResult{
			TaskId: taskID,
			NodeId: nodeID,
			Result: &takov1.AgentTaskResult_DeployLog{
				DeployLog: chunk,
			},
		})
	}

	switch t := task.GetTask().(type) {
	case *takov1.MasterTask_Deploy:
		deployReq := t.Deploy
		log.Printf("[tako-agent] executing deploy task %s for service %s", taskID, deployReq.GetServiceName())
		if err := d.executor.ExecuteDeployWithCallback(ctx, deployReq, sendDeployLog); err != nil {
			sendDeployLog(&takov1.DeployLogChunk{
				DeploymentId: deployReq.GetDeploymentId(),
				Step:         "Error",
				Message:      fmt.Sprintf("Deployment failed: %v", err),
				Timestamp:    time.Now().Unix(),
				IsError:      true,
			})
		}

	case *takov1.MasterTask_Exec:
		execReq := t.Exec
		out, exitCode, err := "", 1, fmt.Errorf("docker client not available")
		if d.dockerCli != nil {
			out, exitCode, err = d.dockerCli.Exec(ctx, execReq.GetContainerId(), execReq.GetCommand())
		}
		_ = stream.Send(&takov1.AgentTaskResult{
			TaskId: taskID,
			NodeId: nodeID,
			Result: &takov1.AgentTaskResult_ExecResult{
				ExecResult: &takov1.ExecCommandResponse{
					ExitCode: int32(exitCode),
					Output:   out,
					Error:    errString(err),
				},
			},
		})

	case *takov1.MasterTask_ContainerAction:
		actionReq := t.ContainerAction
		containerID, action := actionReq.GetContainerId(), actionReq.GetAction()

		if action == "reboot-node" || (containerID == "host" && (action == "reboot" || action == "reboot-node")) {
			log.Printf("[tako-agent] received host reboot command for node %s", nodeID)
			_ = stream.Send(&takov1.AgentTaskResult{
				TaskId: taskID,
				NodeId: nodeID,
				Result: &takov1.AgentTaskResult_ContainerActionResult{
					ContainerActionResult: &takov1.ContainerActionResponse{
						Success: true,
						Message: "host reboot scheduled",
					},
				},
			})

			go func() {
				time.Sleep(1 * time.Second)
				d.executeHostReboot()
			}()
			return
		}

		var err error
		if d.dockerCli != nil {
			err = d.dockerCli.ContainerAction(ctx, containerID, action)
			if action == "remove" || action == "delete" {
				dynamicDir := os.Getenv("TAKO_TRAEFIK_DYNAMIC_DIR")
				if dynamicDir == "" {
					dynamicDir = "/etc/tako/traefik/dynamic"
				}
				_ = traefik.RemoveDynamicConfig(dynamicDir, strings.TrimPrefix(containerID, "tako-app-"))
			}
		} else {
			err = fmt.Errorf("docker client not available")
		}
		msg := "action executed successfully"
		if err != nil {
			msg = err.Error()
		}
		_ = stream.Send(&takov1.AgentTaskResult{
			TaskId: taskID,
			NodeId: nodeID,
			Result: &takov1.AgentTaskResult_ContainerActionResult{
				ContainerActionResult: &takov1.ContainerActionResponse{
					Success: err == nil,
					Message: msg,
				},
			},
		})

	case *takov1.MasterTask_ContainerLogs:
		logsReq := t.ContainerLogs
		logs, err := "", fmt.Errorf("docker client not available")
		if d.dockerCli != nil {
			logs, err = d.dockerCli.Logs(ctx, logsReq.GetContainerId(), int(logsReq.GetTailLines()))
		}
		_ = stream.Send(&takov1.AgentTaskResult{
			TaskId: taskID,
			NodeId: nodeID,
			Result: &takov1.AgentTaskResult_ContainerLogsResult{
				ContainerLogsResult: &takov1.ContainerLogsResponse{
					Logs:  logs,
					Error: errString(err),
				},
			},
		})
	}
}

func (d *Daemon) executeHostReboot() {
	log.Printf("[tako-agent] executing host reboot sequence...")

	// 1. Docker client privileged reboot helper container
	if d.dockerCli != nil {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		if err := d.dockerCli.RebootHost(ctx); err == nil {
			log.Printf("[tako-agent] host reboot helper container launched successfully via Docker socket")
			return
		} else {
			log.Printf("[tako-agent] docker reboot helper container error: %v", err)
		}
	}

	// 2. Direct docker CLI fallback if installed
	if _, err := exec.LookPath("docker"); err == nil {
		log.Printf("[tako-agent] attempting host reboot via docker CLI fallback...")
		rebootCmd := `sync; (echo 1 > /host-proc/sys/kernel/sysrq 2>/dev/null || true); (echo b > /host-proc/sysrq-trigger 2>/dev/null || true); (chroot /host systemctl reboot 2>/dev/null || true); (chroot /host shutdown -r now 2>/dev/null || true); (chroot /host reboot 2>/dev/null || true); nsenter -t 1 -m -u -i -n -p reboot`
		_ = exec.Command("docker", "run", "--rm", "--privileged", "--pid=host", "-v", "/:/host", "-v", "/proc:/host-proc", "alpine:latest", "sh", "-c", rebootCmd).Run()
	}

	// 3. Host direct proc sysrq (if /host-sysrq-trigger or /proc/sysrq-trigger writable)
	if err := os.WriteFile("/host-sysrq-trigger", []byte("b"), 0644); err == nil {
		return
	}
	_ = os.WriteFile("/proc/sysrq-trigger", []byte("s"), 0644)
	_ = os.WriteFile("/proc/sysrq-trigger", []byte("b"), 0644)

	// 4. Host direct commands (for non-containerized standalone agent)
	if err := exec.Command("systemctl", "reboot").Run(); err == nil {
		return
	}
	if err := exec.Command("shutdown", "-r", "now").Run(); err == nil {
		return
	}
	if err := exec.Command("reboot").Run(); err == nil {
		return
	}
}
