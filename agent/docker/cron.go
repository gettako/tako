package docker

import (
	"context"
	"fmt"
	"log/slog"
	"sync"
	"time"

	"github.com/docker/docker/api/types/container"
	"github.com/docker/docker/api/types/network"
	"github.com/robfig/cron/v3"

	"gettako.dev/tako/internal/protocol"
)

type CronScheduler struct {
	cron    *cron.Cron
	cli     DockerRunnerClient
	mu      sync.Mutex
	entries map[string]cron.EntryID
}

func NewCronScheduler(cli DockerRunnerClient) *CronScheduler {
	s := &CronScheduler{
		cron:    cron.New(),
		cli:     cli,
		entries: make(map[string]cron.EntryID),
	}
	s.cron.Start()
	return s
}

func (s *CronScheduler) Stop() {
	s.cron.Stop()
}

func (s *CronScheduler) Schedule(ctx context.Context, job *protocol.DeployJob, imageTag string, sender LogSender) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	serviceID := job.GetServiceId()
	expr := job.GetCronExpression()
	cmdStr := job.GetCommand()

	// If service already has an active schedule, remove it first
	if prevID, exists := s.entries[serviceID]; exists {
		s.cron.Remove(prevID)
		delete(s.entries, serviceID)
	}

	runJob := func() {
		execCtx, cancel := context.WithTimeout(context.Background(), 15*time.Minute)
		defer cancel()

		now := time.Now()
		cName := fmt.Sprintf("tako-cron-%s-%d", serviceID, now.Unix())

		if sender != nil {
			_ = sender.SendContainerLog(&protocol.ContainerLogChunk{
				ServiceId: serviceID,
				LogLine:   fmt.Sprintf("[cron %s] Triggering scheduled execution: %s", now.Format(time.RFC3339), cmdStr),
				Timestamp: now.UnixNano(),
			})
		}

		envSlice := make([]string, 0, len(job.GetEnvVars()))
		for k, v := range job.GetEnvVars() {
			envSlice = append(envSlice, fmt.Sprintf("%s=%s", k, v))
		}

		cfg := &container.Config{
			Image: imageTag,
			Cmd:   []string{"sh", "-c", cmdStr},
			Env:   envSlice,
			Labels: map[string]string{
				"tako.service_id": serviceID,
				"tako.cron":       "true",
				"tako.managed":    "true",
			},
		}

		hostCfg := &container.HostConfig{
			RestartPolicy: container.RestartPolicy{Name: "no"},
			NetworkMode:   container.NetworkMode("tako_network"),
		}

		netCfg := &network.NetworkingConfig{
			EndpointsConfig: map[string]*network.EndpointSettings{
				"tako_network": {},
			},
		}

		createResp, err := s.cli.ContainerCreate(execCtx, cfg, hostCfg, netCfg, nil, cName)
		if err != nil {
			if sender != nil {
				_ = sender.SendContainerLog(&protocol.ContainerLogChunk{
					ServiceId: serviceID,
					LogLine:   fmt.Sprintf("[cron error] ContainerCreate failed: %v", err),
					IsStderr:  true,
					Timestamp: time.Now().UnixNano(),
				})
			}
			return
		}

		defer func() {
			_ = s.cli.ContainerRemove(context.Background(), createResp.ID, container.RemoveOptions{Force: true})
		}()

		if err := s.cli.ContainerStart(execCtx, createResp.ID, container.StartOptions{}); err != nil {
			if sender != nil {
				_ = sender.SendContainerLog(&protocol.ContainerLogChunk{
					ServiceId: serviceID,
					LogLine:   fmt.Sprintf("[cron error] ContainerStart failed: %v", err),
					IsStderr:  true,
					Timestamp: time.Now().UnixNano(),
				})
			}
			return
		}

		// Wait for completion (poll inspect until running == false)
		for {
			select {
			case <-execCtx.Done():
				return
			case <-time.After(1 * time.Second):
				inspect, err := s.cli.ContainerInspect(execCtx, createResp.ID)
				if err != nil || inspect.State == nil || !inspect.State.Running {
					exitCode := 0
					if inspect.State != nil {
						exitCode = inspect.State.ExitCode
					}
					if sender != nil {
						_ = sender.SendContainerLog(&protocol.ContainerLogChunk{
							ServiceId: serviceID,
							LogLine:   fmt.Sprintf("[cron %s] Finished with exit code %d", time.Now().Format(time.RFC3339), exitCode),
							Timestamp: time.Now().UnixNano(),
						})
					}
					return
				}
			}
		}
	}

	entryID, err := s.cron.AddFunc(expr, runJob)
	if err != nil {
		return fmt.Errorf("invalid cron expression %q: %w", expr, err)
	}

	s.entries[serviceID] = entryID
	slog.Info("scheduled cron service", slog.String("service_id", serviceID), slog.String("expr", expr))
	return nil
}

func (s *CronScheduler) Unschedule(serviceID string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if entryID, exists := s.entries[serviceID]; exists {
		s.cron.Remove(entryID)
		delete(s.entries, serviceID)
		slog.Info("unscheduled cron service", slog.String("service_id", serviceID))
	}
}

func (s *CronScheduler) HasSchedule(serviceID string) bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	_, exists := s.entries[serviceID]
	return exists
}
