package deploy

import (
	"context"
	"fmt"
	"strings"

	"github.com/docker/docker/api/types/container"
	"github.com/docker/docker/api/types/network"
)

// releaseServiceHostPort releases conflicting host port bindings for services that publish to host ports.
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
