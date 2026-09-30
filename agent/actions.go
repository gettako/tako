package main

import (
	"context"
	"fmt"
	"io"
	"log/slog"
	"strings"

	"github.com/docker/docker/api/types/container"
	"github.com/docker/docker/api/types/filters"
	"github.com/docker/docker/api/types/image"
	"github.com/docker/docker/api/types/network"
	"github.com/docker/docker/client"

	"gettako.dev/tako/agent/docker"
	"gettako.dev/tako/internal/protocol"
)

func handleContainerAction(ctx context.Context, dockerCli *client.Client, traefikMgr *docker.TraefikManager, cronScheduler *docker.CronScheduler, actionReq *protocol.ContainerAction) (string, error) {
	serviceID := actionReq.GetServiceId()
	action := actionReq.GetAction()

	if cronScheduler != nil && (action == "stop" || action == "delete") {
		cronScheduler.Unschedule(serviceID)
	}

	containers, err := dockerCli.ContainerList(ctx, container.ListOptions{All: true})
	if err != nil {
		return "", fmt.Errorf("failed to list containers: %w", err)
	}

	var serviceContainers []container.Summary
	for _, c := range containers {
		if c.Labels["tako.service_id"] == serviceID || (len(c.Names) > 0 && strings.HasPrefix(strings.TrimPrefix(c.Names[0], "/"), "tako-"+serviceID)) {
			serviceContainers = append(serviceContainers, c)
		}
	}

	stopTimeout := 10
	switch action {
	case "stop":
		for _, c := range serviceContainers {
			if c.State == "running" {
				if err := dockerCli.ContainerStop(ctx, c.ID, container.StopOptions{Timeout: &stopTimeout}); err != nil {
					slog.Warn("failed to stop container", slog.String("container_id", c.ID[:12]), slog.String("error", err.Error()))
				}
			}
		}
		if traefikMgr != nil {
			_ = traefikMgr.RemoveRoute(serviceID)
		}
		return "", nil

	case "start":
		if len(serviceContainers) == 0 {
			return "", fmt.Errorf("no containers found for service %s", serviceID)
		}
		isCompose := false
		for _, c := range serviceContainers {
			if c.Labels["tako.service_type"] == "compose" || c.Labels["tako.sub_service"] != "" {
				isCompose = true
				break
			}
		}
		if isCompose {
			for _, c := range serviceContainers {
				if c.State != "running" {
					_ = dockerCli.ContainerStart(ctx, c.ID, container.StartOptions{})
				}
			}
			return "", nil
		}

		target := serviceContainers[0]
		for _, c := range serviceContainers {
			if c.Created > target.Created {
				target = c
			}
		}
		if target.State != "running" {
			if err := dockerCli.ContainerStart(ctx, target.ID, container.StartOptions{}); err != nil {
				return "", fmt.Errorf("failed to start container %s: %w", target.ID[:12], err)
			}
		}
		if traefikMgr != nil && target.Labels["tako.service_type"] != "worker" && target.Labels["tako.service_type"] != "database" {
			insp, err := dockerCli.ContainerInspect(ctx, target.ID)
			if err == nil {
				ip := ""
				if net, ok := insp.NetworkSettings.Networks["tako_network"]; ok && net.IPAddress != "" {
					ip = net.IPAddress
				} else if insp.NetworkSettings.IPAddress != "" {
					ip = insp.NetworkSettings.IPAddress
				}
				if ip != "" {
					domain := target.Labels["tako.domain"]
					port := int32(3000)
					if pStr, ok := target.Labels["tako.port"]; ok {
						var p int
						if _, err := fmt.Sscanf(pStr, "%d", &p); err == nil && p > 0 {
							port = int32(p)
						}
					}
					_ = traefikMgr.UpdateRoute(serviceID, domain, ip, port)
				}
			}
		}
		return "", nil

	case "restart":
		if len(serviceContainers) == 0 {
			return "", fmt.Errorf("no containers found for service %s", serviceID)
		}
		isCompose := false
		for _, c := range serviceContainers {
			if c.Labels["tako.service_type"] == "compose" || c.Labels["tako.sub_service"] != "" {
				isCompose = true
				break
			}
		}
		if isCompose {
			for _, c := range serviceContainers {
				_ = dockerCli.ContainerRestart(ctx, c.ID, container.StopOptions{Timeout: &stopTimeout})
			}
			return "", nil
		}

		target := serviceContainers[0]
		for _, c := range serviceContainers {
			if c.Created > target.Created {
				target = c
			}
		}
		if err := dockerCli.ContainerRestart(ctx, target.ID, container.StopOptions{Timeout: &stopTimeout}); err != nil {
			return "", fmt.Errorf("failed to restart container %s: %w", target.ID[:12], err)
		}
		if traefikMgr != nil && target.Labels["tako.service_type"] != "worker" && target.Labels["tako.service_type"] != "database" {
			insp, err := dockerCli.ContainerInspect(ctx, target.ID)
			if err == nil {
				ip := ""
				if net, ok := insp.NetworkSettings.Networks["tako_network"]; ok && net.IPAddress != "" {
					ip = net.IPAddress
				} else if insp.NetworkSettings.IPAddress != "" {
					ip = insp.NetworkSettings.IPAddress
				}
				if ip != "" {
					domain := target.Labels["tako.domain"]
					port := int32(3000)
					if pStr, ok := target.Labels["tako.port"]; ok {
						var p int
						if _, err := fmt.Sscanf(pStr, "%d", &p); err == nil && p > 0 {
							port = int32(p)
						}
					}
					_ = traefikMgr.UpdateRoute(serviceID, domain, ip, port)
				}
			}
		}
		return "", nil

	case "pull-update":
		if len(serviceContainers) == 0 {
			return "", fmt.Errorf("no containers found for service %s", serviceID)
		}

		target := serviceContainers[0]
		for _, c := range serviceContainers {
			if c.Created > target.Created {
				target = c
			}
		}

		imageTag := actionReq.GetImage()
		if imageTag == "" {
			imageTag = target.Image
		}
		if imageTag == "" {
			return "", fmt.Errorf("no image specified for pull update of service %s", serviceID)
		}

		insp, err := dockerCli.ContainerInspect(ctx, target.ID)
		if err != nil {
			return "", fmt.Errorf("failed to inspect container %s: %w", target.ID[:12], err)
		}

		oldImageID := insp.Image
		if oldImageID == "" {
			oldImg, _, _ := dockerCli.ImageInspectWithRaw(ctx, imageTag)
			oldImageID = oldImg.ID
		}

		// Pull the latest image
		reader, pullErr := dockerCli.ImagePull(ctx, imageTag, image.PullOptions{})
		if pullErr != nil {
			return "", fmt.Errorf("failed to pull image %s: %w", imageTag, pullErr)
		}
		if reader != nil {
			_, _ = io.Copy(io.Discard, reader)
			_ = reader.Close()
		}

		newImg, _, err := dockerCli.ImageInspectWithRaw(ctx, imageTag)
		if err != nil {
			return "", fmt.Errorf("failed to inspect pulled image %s: %w", imageTag, err)
		}
		newImageID := newImg.ID

		// If digests are identical and container is already running, report informative message
		if oldImageID != "" && newImageID != "" && oldImageID == newImageID && target.State == "running" {
			return "Already up to date", nil
		}

		// Recreate container preserving volume mounts, env vars, ports, networks, and restart policy
		newConfig := *insp.Config
		newConfig.Image = imageTag
		newHostConfig := *insp.HostConfig

		var endpointsConfig map[string]*network.EndpointSettings
		if insp.NetworkSettings != nil && len(insp.NetworkSettings.Networks) > 0 {
			endpointsConfig = make(map[string]*network.EndpointSettings)
			for netName, netSetting := range insp.NetworkSettings.Networks {
				endpointsConfig[netName] = &network.EndpointSettings{
					Aliases: netSetting.Aliases,
				}
			}
		} else {
			endpointsConfig = map[string]*network.EndpointSettings{
				"tako_network": {
					Aliases: []string{"tako-" + serviceID},
				},
			}
		}
		networkingConfig := &network.NetworkingConfig{
			EndpointsConfig: endpointsConfig,
		}

		// Stop and remove old container
		_ = dockerCli.ContainerStop(ctx, target.ID, container.StopOptions{Timeout: &stopTimeout})
		_ = dockerCli.ContainerRemove(ctx, target.ID, container.RemoveOptions{Force: true})

		containerName := strings.TrimPrefix(insp.Name, "/")
		createResp, err := dockerCli.ContainerCreate(ctx, &newConfig, &newHostConfig, networkingConfig, nil, containerName)
		if err != nil {
			return "", fmt.Errorf("failed to recreate container: %w", err)
		}

		if err := dockerCli.ContainerStart(ctx, createResp.ID, container.StartOptions{}); err != nil {
			return "", fmt.Errorf("failed to start recreated container: %w", err)
		}

		// Validate container health
		newInsp, err := dockerCli.ContainerInspect(ctx, createResp.ID)
		if err == nil && newInsp.State != nil && !newInsp.State.Running && newInsp.State.ExitCode != 0 {
			return "", fmt.Errorf("recreated container exited immediately with code %d: %s", newInsp.State.ExitCode, newInsp.State.Error)
		}

		// Update Traefik dynamic route if domain exists
		if traefikMgr != nil && insp.Config.Labels["tako.service_type"] != "worker" && insp.Config.Labels["tako.service_type"] != "database" {
			ip := ""
			if newInsp.NetworkSettings != nil {
				if net, ok := newInsp.NetworkSettings.Networks["tako_network"]; ok && net.IPAddress != "" {
					ip = net.IPAddress
				} else if newInsp.NetworkSettings.IPAddress != "" {
					ip = newInsp.NetworkSettings.IPAddress
				}
			}
			if ip != "" {
				domain := insp.Config.Labels["tako.domain"]
				port := int32(3000)
				if pStr, ok := insp.Config.Labels["tako.port"]; ok {
					var p int
					if _, err := fmt.Sscanf(pStr, "%d", &p); err == nil && p > 0 {
						port = int32(p)
					}
				}
				_ = traefikMgr.UpdateRoute(serviceID, domain, ip, port)
			}
		}

		return "Container successfully updated and recreated with latest image", nil

	case "delete":
		// Step 1: Agent immediately removes dynamic routing rules from /etc/traefik/dynamic/tako.yml to prevent 502 Bad Gateway responses
		if traefikMgr != nil {
			_ = traefikMgr.RemoveRoute(serviceID)
		}

		var projectID string
		var volumeNames []string
		var imageIDs []string

		for _, c := range serviceContainers {
			if pid, ok := c.Labels["tako.project_id"]; ok && pid != "" {
				projectID = pid
			}
			if volName, ok := c.Labels["tako.volume_name"]; ok && volName != "" {
				volumeNames = append(volumeNames, volName)
			}
			for _, m := range c.Mounts {
				if m.Type == "volume" && m.Name != "" {
					volumeNames = append(volumeNames, m.Name)
				}
			}
			if c.ImageID != "" {
				imageIDs = append(imageIDs, c.ImageID)
			}
		}

		// Step 2: Gracefully stops the container (SIGTERM with 10s drain period) and removes the container (docker rm -f)
		for _, c := range serviceContainers {
			if c.State == "running" {
				_ = dockerCli.ContainerStop(ctx, c.ID, container.StopOptions{Timeout: &stopTimeout})
			}
			_ = dockerCli.ContainerRemove(ctx, c.ID, container.RemoveOptions{Force: true})
		}

		// Step 3: If delete_volumes=true, removes associated persistent host volumes (docker volume rm). If false, preserves volumes on the host filesystem.
		if actionReq.GetDeleteVolumes() {
			seenVol := make(map[string]bool)
			for _, v := range volumeNames {
				if !seenVol[v] {
					seenVol[v] = true
					_ = dockerCli.VolumeRemove(ctx, v, true)
				}
			}
		}

		// Prune / remove images if requested
		if actionReq.GetPruneImages() {
			for _, img := range imageIDs {
				_, _ = dockerCli.ImageRemove(ctx, img, image.RemoveOptions{PruneChildren: true})
			}
			_, _ = dockerCli.ImagesPrune(ctx, filters.NewArgs(filters.Arg("dangling", "true")))
		}

		if projectID != "" {
			_ = dockerCli.NetworkRemove(ctx, fmt.Sprintf("tako_compose_%s", projectID))
		}
		return "", nil

	default:
		return "", fmt.Errorf("unsupported container action: %s", action)
	}
}
