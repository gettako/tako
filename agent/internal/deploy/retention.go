package deploy

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"

	"github.com/docker/docker/api/types"
	"github.com/docker/docker/api/types/container"
	takov1 "gettako.dev/tako/proto/gen/go/tako/v1"
)

// pruneOldDeployments removes older preview containers and orphaned Traefik routes exceeding the retention quota.
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

		stopTimeout := 10
		_ = e.dockerCli.RawClient().ContainerStop(ctx, c.ID, container.StopOptions{Timeout: &stopTimeout})
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
