package docker

import (
	"context"
	"fmt"
	"time"

	"github.com/docker/docker/api/types/container"

	"gettako.dev/tako/internal/protocol"
)

type SwitchoverManager struct {
	cli          DockerRunnerClient
	traefik      *TraefikManager
	drainTimeout time.Duration
}

func NewSwitchoverManager(cli DockerRunnerClient, traefik *TraefikManager, drainTimeout time.Duration) *SwitchoverManager {
	if drainTimeout <= 0 {
		drainTimeout = 10 * time.Second
	}
	return &SwitchoverManager{
		cli:          cli,
		traefik:      traefik,
		drainTimeout: drainTimeout,
	}
}

func (s *SwitchoverManager) Switchover(ctx context.Context, job *protocol.DeployJob, launched *LaunchedContainer, sender LogSender) error {
	serviceID := job.GetServiceId()
	depID := job.GetDeploymentId()

	// 1. Atomically cut over Traefik traffic to the new container (web services with domain only)
	if s.traefik != nil && job.GetServiceType() != "worker" && job.GetServiceType() != "database" {
		if len(job.GetIngressRules()) > 0 {
			rules := make([]IngressRule, 0, len(job.GetIngressRules()))
			for _, r := range job.GetIngressRules() {
				targetPort := r.GetPort()
				if targetPort <= 0 {
					targetPort = launched.Port
				}
				rules = append(rules, IngressRule{
					RuleID:       r.GetRuleId(),
					Domain:       r.GetDomain(),
					ServiceID:    r.GetServiceId(),
					IP:           launched.IPAddress,
					Port:         targetPort,
					PathPrefix:   r.GetPathPrefix(),
					StripPrefix:  r.GetStripPrefix(),
					IsCanonical:  r.GetIsCanonical(),
					RedirectMode: r.GetRedirectMode(),
					AuthEnabled:  r.GetAuthEnabled(),
					AuthUser:     r.GetAuthUser(),
					AuthPassword: r.GetAuthPassword(),
					EntryPoints:  r.GetEntrypoints(),
					SSLResolver:  r.GetSslResolver(),
				})
			}
			if err := s.traefik.UpdateIngressRules(serviceID, rules, launched.IPAddress, launched.Port); err != nil {
				return fmt.Errorf("failed to update Traefik dynamic route: %w", err)
			}
			_ = sender.SendBuildLog(&protocol.BuildLogChunk{
				DeploymentId: depID,
				LogLine:      fmt.Sprintf("Traefik dynamic configuration updated: %d ingress rule(s) configured for container %s (%s:%d).", len(rules), launched.ContainerID[:12], launched.IPAddress, launched.Port),
				Timestamp:    time.Now().UnixNano(),
			})
		} else if job.GetDomain() != "" {
			if err := s.traefik.UpdateRoute(serviceID, job.GetDomain(), launched.IPAddress, launched.Port); err != nil {
				return fmt.Errorf("failed to update Traefik dynamic route: %w", err)
			}
			_ = sender.SendBuildLog(&protocol.BuildLogChunk{
				DeploymentId: depID,
				LogLine:      fmt.Sprintf("Traefik dynamic configuration updated: traffic directed to container %s (%s:%d).", launched.ContainerID[:12], launched.IPAddress, launched.Port),
				Timestamp:    time.Now().UnixNano(),
			})
		} else {
			_ = s.traefik.RemoveRoute(serviceID)
		}
	}

	// 2. Discover running previous containers for this service
	containers, err := s.cli.ContainerList(ctx, container.ListOptions{})
	var oldContainers []container.Summary
	if err == nil {
		for _, c := range containers {
			if c.Labels["tako.service_id"] == serviceID && c.ID != launched.ContainerID {
				oldContainers = append(oldContainers, c)
			}
		}
	}

	// 3. Graceful Drain and Teardown
	if len(oldContainers) > 0 {
		_ = sender.SendBuildLog(&protocol.BuildLogChunk{
			DeploymentId: depID,
			LogLine:      fmt.Sprintf("Waiting %v drain window for in-flight requests on %d previous container(s)...", s.drainTimeout, len(oldContainers)),
			Timestamp:    time.Now().UnixNano(),
		})

		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-time.After(s.drainTimeout):
		}

		stopTimeout := int(s.drainTimeout.Seconds())
		if stopTimeout <= 0 {
			stopTimeout = 10
		}

		for _, oldC := range oldContainers {
			cidShort := oldC.ID
			if len(cidShort) > 12 {
				cidShort = cidShort[:12]
			}
			_ = sender.SendBuildLog(&protocol.BuildLogChunk{
				DeploymentId: depID,
				LogLine:      fmt.Sprintf("Gracefully stopping previous container %s...", cidShort),
				Timestamp:    time.Now().UnixNano(),
			})
			_ = s.cli.ContainerStop(ctx, oldC.ID, container.StopOptions{Timeout: &stopTimeout})
			_ = sender.SendBuildLog(&protocol.BuildLogChunk{
				DeploymentId: depID,
				LogLine:      fmt.Sprintf("Previous container %s stopped (image preserved for rollback).", cidShort),
				Timestamp:    time.Now().UnixNano(),
			})
		}
	}

	// 4. Send final deployment transition: healthy
	_ = sender.SendStatusTransition(&protocol.DeploymentStatusTransition{
		DeploymentId:      depID,
		Status:            "healthy",
		ActiveContainerId: launched.ContainerID,
		ImageTag:          launched.ImageTag,
		Timestamp:         time.Now().Unix(),
	})

	_ = sender.SendBuildLog(&protocol.BuildLogChunk{
		DeploymentId: depID,
		LogLine:      "Zero-downtime traffic switchover completed successfully.",
		Timestamp:    time.Now().UnixNano(),
	})

	return nil
}
