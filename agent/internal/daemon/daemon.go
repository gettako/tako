package daemon

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"sync"
	"time"

	"gettako.dev/tako/agent/internal/client"
	"gettako.dev/tako/agent/internal/docker"
	"gettako.dev/tako/agent/internal/metrics"
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

	// Start docker events watcher if docker is present
	if d.dockerCli != nil {
		go d.watchDockerEvents(ctx)
	}

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

func (d *Daemon) sendHeartbeat(ctx context.Context) {
	snap := d.collector.Collect(ctx)
	hbCtx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()

	d.mu.RLock()
	nodeID := d.state.NodeID
	d.mu.RUnlock()

	req := &takov1.HeartbeatRequest{
		NodeId:         nodeID,
		CpuPercent:     snap.CPUPercent,
		MemoryUsedMb:   snap.MemoryUsedMB,
		DiskUsedGb:     snap.DiskUsedGB,
		NetworkRxKbps:  snap.NetworkRxKBps,
		NetworkTxKbps:  snap.NetworkTxKBps,
		UptimeSeconds:  snap.UptimeSeconds,
		Timestamp:      snap.Timestamp,
	}

	resp, err := d.grpcCli.Heartbeat(hbCtx, req)
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
