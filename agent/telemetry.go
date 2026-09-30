package main

import (
	"context"
	"encoding/json"
	"log/slog"
	"time"

	"github.com/docker/docker/api/types/container"
	"github.com/docker/docker/client"
	"github.com/shirou/gopsutil/v4/cpu"
	"github.com/shirou/gopsutil/v4/disk"
	"github.com/shirou/gopsutil/v4/mem"

	"gettako.dev/tako/internal/protocol"
)

type TelemetrySampler struct {
	dockerCli *client.Client
	startTime time.Time
}

func NewTelemetrySampler(dockerCli *client.Client) *TelemetrySampler {
	return &TelemetrySampler{
		dockerCli: dockerCli,
		startTime: time.Now(),
	}
}

func (s *TelemetrySampler) Sample(ctx context.Context) *protocol.Heartbeat {
	var cpuPercent float64
	if cpuPercentages, err := cpu.PercentWithContext(ctx, 0, false); err == nil && len(cpuPercentages) > 0 {
		cpuPercent = cpuPercentages[0]
	}

	var ramPercent float64
	var ramTotalBytes, ramUsedBytes uint64
	if vm, err := mem.VirtualMemoryWithContext(ctx); err == nil && vm != nil {
		ramPercent = vm.UsedPercent
		ramTotalBytes = vm.Total
		ramUsedBytes = vm.Used
	}

	var diskPercent float64
	if du, err := disk.UsageWithContext(ctx, "/"); err == nil && du != nil {
		diskPercent = du.UsedPercent
	}

	uptimeSeconds := int64(time.Since(s.startTime).Seconds())

	if s.dockerCli != nil {
		cCtx, cancel := context.WithTimeout(ctx, 2*time.Second)
		defer cancel()
		if containers, err := s.dockerCli.ContainerList(cCtx, container.ListOptions{All: true}); err == nil {
			var running, stopped, paused int
			for _, c := range containers {
				switch c.State {
				case "running":
					running++
				case "paused":
					paused++
				default:
					stopped++
				}
			}
			slog.Debug("docker container metrics",
				slog.Int("running", running),
				slog.Int("stopped", stopped),
				slog.Int("paused", paused),
			)
		}
	}

	return &protocol.Heartbeat{
		CpuPercent:    cpuPercent,
		RamPercent:    ramPercent,
		RamTotalBytes: ramTotalBytes,
		RamUsedBytes:  ramUsedBytes,
		DiskPercent:   diskPercent,
		UptimeSeconds: uptimeSeconds,
		Timestamp:     time.Now().Unix(),
	}
}

func (s *TelemetrySampler) StartHeartbeatLoop(ctx context.Context, session *SessionClient, interval time.Duration) {
	if interval <= 0 {
		interval = 15 * time.Second
	}

	ticker := time.NewTicker(interval)
	defer ticker.Stop()

	s.sendHeartbeat(ctx, session)

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			s.sendHeartbeat(ctx, session)
		}
	}
}

func (s *TelemetrySampler) sendHeartbeat(ctx context.Context, session *SessionClient) {
	if !session.IsConnected() {
		return
	}

	hb := s.Sample(ctx)
	msg := &protocol.AgentMessage{
		Payload: &protocol.AgentMessage_Heartbeat{
			Heartbeat: hb,
		},
	}

	if err := session.Send(msg); err != nil {
		slog.Debug("failed to queue heartbeat message", slog.String("error", err.Error()))
	}
}

type dockerStatsJSON struct {
	CPUStats struct {
		CPUUsage struct {
			TotalUsage uint64 `json:"total_usage"`
		} `json:"cpu_usage"`
		SystemUsage uint64 `json:"system_cpu_usage"`
		OnlineCPUs  uint32 `json:"online_cpus"`
	} `json:"cpu_stats"`
	PreCPUStats struct {
		CPUUsage struct {
			TotalUsage uint64 `json:"total_usage"`
		} `json:"cpu_usage"`
		SystemUsage uint64 `json:"system_cpu_usage"`
	} `json:"precpu_stats"`
	MemoryStats struct {
		Usage uint64            `json:"usage"`
		Limit uint64            `json:"limit"`
		Stats map[string]uint64 `json:"stats"`
	} `json:"memory_stats"`
	Networks map[string]struct {
		RxBytes uint64 `json:"rx_bytes"`
		TxBytes uint64 `json:"tx_bytes"`
	} `json:"networks"`
}

func (s *TelemetrySampler) SampleServiceMetrics(ctx context.Context) *protocol.ServiceMetricsReport {
	now := time.Now().Unix()
	if s.dockerCli == nil {
		return &protocol.ServiceMetricsReport{Timestamp: now}
	}

	cCtx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()

	containers, err := s.dockerCli.ContainerList(cCtx, container.ListOptions{All: false})
	if err != nil {
		slog.Debug("failed to list containers for service metrics", slog.String("error", err.Error()))
		return &protocol.ServiceMetricsReport{Timestamp: now}
	}

	var points []*protocol.ServiceMetricPoint

	for _, c := range containers {
		serviceID := c.Labels["tako.service_id"]
		if serviceID == "" {
			continue
		}

		statsResp, err := s.dockerCli.ContainerStats(cCtx, c.ID, false)
		if err != nil {
			continue
		}

		var stats dockerStatsJSON
		decodeErr := json.NewDecoder(statsResp.Body).Decode(&stats)
		_ = statsResp.Body.Close()
		if decodeErr != nil {
			continue
		}

		// Calculate CPU percentage
		var cpuPercent float64
		cpuDelta := float64(stats.CPUStats.CPUUsage.TotalUsage) - float64(stats.PreCPUStats.CPUUsage.TotalUsage)
		systemDelta := float64(stats.CPUStats.SystemUsage) - float64(stats.PreCPUStats.SystemUsage)
		onlineCPUs := float64(stats.CPUStats.OnlineCPUs)
		if onlineCPUs == 0 {
			onlineCPUs = 1
		}
		if systemDelta > 0 && cpuDelta > 0 {
			cpuPercent = (cpuDelta / systemDelta) * onlineCPUs * 100.0
		}

		// Calculate Memory (used minus cache / inactive_file)
		memUsed := stats.MemoryStats.Usage
		if cache, ok := stats.MemoryStats.Stats["inactive_file"]; ok && memUsed > cache {
			memUsed -= cache
		} else if cache, ok := stats.MemoryStats.Stats["cache"]; ok && memUsed > cache {
			memUsed -= cache
		}
		memLimit := stats.MemoryStats.Limit

		// Network I/O
		var rxBytes, txBytes uint64
		for _, net := range stats.Networks {
			rxBytes += net.RxBytes
			txBytes += net.TxBytes
		}

		// Restart count via ContainerInspect
		var restartCount int
		if inspect, err := s.dockerCli.ContainerInspect(cCtx, c.ID); err == nil {
			restartCount = inspect.RestartCount
		}

		points = append(points, &protocol.ServiceMetricPoint{
			ServiceId:        serviceID,
			ContainerId:      c.ID,
			CpuPercent:       cpuPercent,
			MemoryBytes:      memUsed,
			MemoryLimitBytes: memLimit,
			NetworkRxBytes:   rxBytes,
			NetworkTxBytes:   txBytes,
			RestartCount:     int32(restartCount),
			Timestamp:        now,
		})
	}

	return &protocol.ServiceMetricsReport{
		Metrics:   points,
		Timestamp: now,
	}
}

func (s *TelemetrySampler) StartServiceMetricsLoop(ctx context.Context, session *SessionClient, interval time.Duration) {
	if interval <= 0 {
		interval = 30 * time.Second
	}

	ticker := time.NewTicker(interval)
	defer ticker.Stop()

	// Initial sample
	s.sendServiceMetrics(ctx, session)

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			s.sendServiceMetrics(ctx, session)
		}
	}
}

func (s *TelemetrySampler) sendServiceMetrics(ctx context.Context, session *SessionClient) {
	if !session.IsConnected() {
		return
	}

	report := s.SampleServiceMetrics(ctx)
	if len(report.GetMetrics()) == 0 {
		return
	}

	msg := &protocol.AgentMessage{
		Payload: &protocol.AgentMessage_ServiceMetricsReport{
			ServiceMetricsReport: report,
		},
	}

	if err := session.Send(msg); err != nil {
		slog.Debug("failed to queue service metrics message", slog.String("error", err.Error()))
	}
}
