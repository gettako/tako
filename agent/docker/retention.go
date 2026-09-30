package docker

import (
	"context"
	"fmt"
	"io"
	"log/slog"
	"sort"
	"strings"
	"time"

	"github.com/docker/docker/api/types/container"
	"github.com/docker/docker/api/types/image"
	"github.com/docker/docker/client"

	"gettako.dev/tako/internal/protocol"
)

type DockerImageManager interface {
	ImageList(ctx context.Context, options image.ListOptions) ([]image.Summary, error)
	ImageInspect(ctx context.Context, imageID string, inspectOpts ...client.ImageInspectOption) (image.InspectResponse, error)
	ImageRemove(ctx context.Context, imageID string, options image.RemoveOptions) ([]image.DeleteResponse, error)
	ImagePull(ctx context.Context, refStr string, options image.PullOptions) (io.ReadCloser, error)
}

func EnforceImageRetention(ctx context.Context, cli DockerImageManager, serviceID string, keepN int, sender LogSender) ([]string, error) {
	if keepN <= 0 {
		keepN = 5
	}

	images, err := cli.ImageList(ctx, image.ListOptions{All: false})
	if err != nil {
		return nil, fmt.Errorf("failed to list docker images for retention: %w", err)
	}

	tagPrefix := fmt.Sprintf("tako-app-%s:", serviceID)

	type serviceImage struct {
		summary image.Summary
		tag     string
	}

	var matching []serviceImage
	for _, img := range images {
		for _, tag := range img.RepoTags {
			if strings.HasPrefix(tag, tagPrefix) {
				matching = append(matching, serviceImage{
					summary: img,
					tag:     tag,
				})
				break
			}
		}
	}

	if len(matching) <= keepN {
		return nil, nil
	}

	// Sort newest first by Created timestamp
	sort.Slice(matching, func(i, j int) bool {
		return matching[i].summary.Created > matching[j].summary.Created
	})

	var removedTags []string
	toRemove := matching[keepN:]

	for _, item := range toRemove {
		slog.Info("pruning old deployment image under retention policy",
			slog.String("service_id", serviceID),
			slog.String("image_tag", item.tag),
		)
		if sender != nil {
			_ = sender.SendBuildLog(&protocol.BuildLogChunk{
				LogLine:   fmt.Sprintf("Retention policy: pruned older deployment image %s", item.tag),
				Timestamp: time.Now().UnixNano(),
			})
		}

		_, err := cli.ImageRemove(ctx, item.summary.ID, image.RemoveOptions{
			PruneChildren: true,
			Force:         false,
		})
		if err == nil {
			removedTags = append(removedTags, item.tag)
		} else {
			slog.Warn("failed to remove old image under retention policy",
				slog.String("image", item.tag),
				slog.String("error", err.Error()),
			)
		}
	}

	return removedTags, nil
}

type DeployPipeline struct {
	builder    *Builder
	runner     *Runner
	switchover *SwitchoverManager
	imgManager DockerImageManager
	cron       *CronScheduler
	hookExec   *HookExecutor
	composeMgr *ComposeManager
}

func (p *DeployPipeline) SetHookExecutor(h *HookExecutor) {
	p.hookExec = h
}

func (p *DeployPipeline) SetComposeManager(m *ComposeManager) {
	p.composeMgr = m
}

func NewDeployPipeline(builder *Builder, runner *Runner, switchover *SwitchoverManager, imgManager DockerImageManager, cronScheduler ...*CronScheduler) *DeployPipeline {
	var c *CronScheduler
	if len(cronScheduler) > 0 {
		c = cronScheduler[0]
	}
	return &DeployPipeline{
		builder:    builder,
		runner:     runner,
		switchover: switchover,
		imgManager: imgManager,
		cron:       c,
	}
}

func (p *DeployPipeline) Execute(ctx context.Context, job *protocol.DeployJob, sender LogSender) error {
	depID := job.GetDeploymentId()
	serviceID := job.GetServiceId()

	if job.GetServiceType() == "compose" {
		if p.composeMgr != nil {
			return p.composeMgr.Execute(ctx, job, sender)
		}
		return fmt.Errorf("compose manager not configured on agent")
	}

	var imageTag string

	if job.GetServiceType() == "database" {
		imageTag = job.GetImage()
		if imageTag == "" {
			imageTag = job.GetDockerfilePath()
		}
		if imageTag == "" {
			imageTag = "postgres:16-alpine"
		}

		_ = sender.SendStatusTransition(&protocol.DeploymentStatusTransition{
			DeploymentId: depID,
			Status:       "building",
			Timestamp:    time.Now().Unix(),
		})

		_ = sender.SendBuildLog(&protocol.BuildLogChunk{
			DeploymentId: depID,
			LogLine:      fmt.Sprintf("Deploying managed database service with official image %s...", imageTag),
			Timestamp:    time.Now().UnixNano(),
		})

		_, err := p.imgManager.ImageInspect(ctx, imageTag)
		if err != nil {
			_ = sender.SendBuildLog(&protocol.BuildLogChunk{
				DeploymentId: depID,
				LogLine:      fmt.Sprintf("Official image %s not found locally; pulling from registry...", imageTag),
				Timestamp:    time.Now().UnixNano(),
			})
			pullReader, pullErr := p.imgManager.ImagePull(ctx, imageTag, image.PullOptions{})
			if pullErr != nil {
				errReason := fmt.Sprintf("Failed to pull database image %s: %v", imageTag, pullErr)
				_ = sender.SendBuildLog(&protocol.BuildLogChunk{
					DeploymentId: depID,
					LogLine:      errReason,
					IsError:      true,
					Timestamp:    time.Now().UnixNano(),
				})
				_ = sender.SendStatusTransition(&protocol.DeploymentStatusTransition{
					DeploymentId: depID,
					Status:       "failed",
					ErrorReason:  errReason,
					Timestamp:    time.Now().Unix(),
				})
				return fmt.Errorf("failed to pull image: %w", pullErr)
			}
			if pullReader != nil {
				_, _ = io.Copy(io.Discard, pullReader)
				_ = pullReader.Close()
			}
			_ = sender.SendBuildLog(&protocol.BuildLogChunk{
				DeploymentId: depID,
				LogLine:      fmt.Sprintf("Official database image %s pulled successfully.", imageTag),
				Timestamp:    time.Now().UnixNano(),
			})
		} else {
			_ = sender.SendBuildLog(&protocol.BuildLogChunk{
				DeploymentId: depID,
				LogLine:      fmt.Sprintf("Official database image %s verified locally.", imageTag),
				Timestamp:    time.Now().UnixNano(),
			})
		}
	} else if job.GetIsRollback() {
		targetTag := job.GetRollbackImageTag()
		if targetTag == "" {
			targetTag = fmt.Sprintf("tako-app-%s:%s", serviceID, depID)
		}

		_ = sender.SendBuildLog(&protocol.BuildLogChunk{
			DeploymentId: depID,
			LogLine:      fmt.Sprintf("Executing instant rollback to image %s...", targetTag),
			Timestamp:    time.Now().UnixNano(),
		})

		_, err := p.imgManager.ImageInspect(ctx, targetTag)
		if err != nil {
			errReason := fmt.Sprintf("Target rollback image %s was not found locally on the server; please trigger a full rebuild.", targetTag)
			_ = sender.SendBuildLog(&protocol.BuildLogChunk{
				DeploymentId: depID,
				LogLine:      errReason,
				IsError:      true,
				Timestamp:    time.Now().UnixNano(),
			})
			_ = sender.SendStatusTransition(&protocol.DeploymentStatusTransition{
				DeploymentId: depID,
				Status:       "failed",
				ErrorReason:  errReason,
				Timestamp:    time.Now().Unix(),
			})
			return fmt.Errorf("rollback image missing: %w", err)
		}

		_ = sender.SendBuildLog(&protocol.BuildLogChunk{
			DeploymentId: depID,
			LogLine:      fmt.Sprintf("Rollback image %s is verified locally. Skipping build step.", targetTag),
			Timestamp:    time.Now().UnixNano(),
		})

		imageTag = targetTag
	} else {
		buildRes, err := p.builder.Build(ctx, job, sender)
		if err != nil {
			return err
		}
		imageTag = buildRes.ImageTag
	}

	if job.GetServiceType() == "cron" {
		if p.cron != nil {
			if err := p.cron.Schedule(ctx, job, imageTag, sender); err != nil {
				_ = sender.SendBuildLog(&protocol.BuildLogChunk{
					DeploymentId: depID,
					LogLine:      fmt.Sprintf("Failed to schedule cron job: %v", err),
					IsError:      true,
					Timestamp:    time.Now().UnixNano(),
				})
				_ = sender.SendStatusTransition(&protocol.DeploymentStatusTransition{
					DeploymentId: depID,
					Status:       "failed",
					ErrorReason:  err.Error(),
					Timestamp:    time.Now().Unix(),
				})
				return err
			}
		}

		_ = sender.SendBuildLog(&protocol.BuildLogChunk{
			DeploymentId: depID,
			LogLine:      fmt.Sprintf("Cron job scheduled successfully (expression: %q, command: %q).", job.GetCronExpression(), job.GetCommand()),
			Timestamp:    time.Now().UnixNano(),
		})

		_ = sender.SendStatusTransition(&protocol.DeploymentStatusTransition{
			DeploymentId: depID,
			Status:       "healthy",
			ImageTag:     imageTag,
			Timestamp:    time.Now().Unix(),
		})

		return nil
	}

	launched, err := p.runner.LaunchAndVerify(ctx, job, imageTag, sender)
	if err != nil {
		return err
	}

	if job.GetPostDeployCommand() != "" && p.hookExec != nil {
		if err := p.hookExec.ExecuteHook(ctx, launched.ContainerID, job.GetPostDeployCommand(), depID, "post_deploy", sender); err != nil {
			_ = sender.SendStatusTransition(&protocol.DeploymentStatusTransition{
				DeploymentId: depID,
				Status:       "failed",
				ErrorReason:  err.Error(),
				Timestamp:    time.Now().Unix(),
			})
			timeout := 5
			_ = p.runner.cli.ContainerStop(ctx, launched.ContainerID, container.StopOptions{Timeout: &timeout})
			_ = p.runner.cli.ContainerRemove(ctx, launched.ContainerID, container.RemoveOptions{Force: true})
			return err
		}
	}

	if err := p.switchover.Switchover(ctx, job, launched, sender); err != nil {
		_ = sender.SendStatusTransition(&protocol.DeploymentStatusTransition{
			DeploymentId: depID,
			Status:       "failed",
			ErrorReason:  err.Error(),
			Timestamp:    time.Now().Unix(),
		})
		return err
	}

	// Enforce 5-image retention policy per service
	_, _ = EnforceImageRetention(ctx, p.imgManager, serviceID, 5, sender)

	return nil
}
