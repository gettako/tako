package docker

import (
	"context"
	"log/slog"
	"time"

	"github.com/docker/docker/api/types"
	"github.com/docker/docker/api/types/container"
	"github.com/docker/docker/api/types/filters"
	"github.com/docker/docker/api/types/image"
)

type DockerPruneClient interface {
	ContainersPrune(ctx context.Context, pruneFilters filters.Args) (container.PruneReport, error)
	ImagesPrune(ctx context.Context, pruneFilters filters.Args) (image.PruneReport, error)
	BuildCachePrune(ctx context.Context, opts types.BuildCachePruneOptions) (*types.BuildCachePruneReport, error)
}

type PruneResult struct {
	ContainersDeleted int
	ImagesDeleted     int
	CacheDeleted      int
	ReclaimedBytes    int64
}

type Pruner struct {
	cli DockerPruneClient
}

func NewPruner(cli DockerPruneClient) *Pruner {
	return &Pruner{cli: cli}
}

func (p *Pruner) Prune(ctx context.Context) (*PruneResult, error) {
	slog.Info("starting docker resource prune")

	var totalReclaimed uint64
	var containersDeleted int
	var imagesDeleted int
	var cacheDeleted int

	// 1. Prune stopped containers (active running containers are never touched)
	cReport, err := p.cli.ContainersPrune(ctx, filters.NewArgs())
	if err != nil {
		slog.Warn("container prune error", slog.String("error", err.Error()))
	} else {
		totalReclaimed += cReport.SpaceReclaimed
		containersDeleted = len(cReport.ContainersDeleted)
	}

	// 2. Prune dangling images only (strictly preserves tagged service deployment images)
	danglingFilter := filters.NewArgs(filters.Arg("dangling", "true"))
	iReport, err := p.cli.ImagesPrune(ctx, danglingFilter)
	if err != nil {
		slog.Warn("image prune error", slog.String("error", err.Error()))
	} else {
		totalReclaimed += iReport.SpaceReclaimed
		imagesDeleted = len(iReport.ImagesDeleted)
	}

	// 3. Prune BuildKit build cache older than 7 days (168 hours)
	untilFilter := filters.NewArgs(filters.Arg("until", "168h"))
	bReport, err := p.cli.BuildCachePrune(ctx, types.BuildCachePruneOptions{
		Filters: untilFilter,
	})
	if err != nil {
		slog.Warn("build cache prune error", slog.String("error", err.Error()))
	} else if bReport != nil {
		totalReclaimed += bReport.SpaceReclaimed
		cacheDeleted = len(bReport.CachesDeleted)
	}

	res := &PruneResult{
		ContainersDeleted: containersDeleted,
		ImagesDeleted:     imagesDeleted,
		CacheDeleted:      cacheDeleted,
		ReclaimedBytes:    int64(totalReclaimed),
	}

	slog.Info("docker resource prune completed",
		slog.Int("containers_deleted", containersDeleted),
		slog.Int("images_deleted", imagesDeleted),
		slog.Int("cache_deleted", cacheDeleted),
		slog.Int64("reclaimed_bytes", res.ReclaimedBytes),
	)

	return res, nil
}

func (p *Pruner) StartScheduledPrune(ctx context.Context, interval time.Duration) {
	if interval <= 0 {
		interval = 24 * time.Hour
	}

	ticker := time.NewTicker(interval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			pruneCtx, cancel := context.WithTimeout(ctx, 5*time.Minute)
			_, _ = p.Prune(pruneCtx)
			cancel()
		}
	}
}
