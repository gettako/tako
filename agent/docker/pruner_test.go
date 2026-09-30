package docker

import (
	"context"
	"testing"

	"github.com/docker/docker/api/types"
	"github.com/docker/docker/api/types/container"
	"github.com/docker/docker/api/types/filters"
	"github.com/docker/docker/api/types/image"
)

type mockPruneClient struct {
	containerReclaimed uint64
	imageReclaimed     uint64
	cacheReclaimed     uint64

	receivedImageFilters filters.Args
	receivedCacheFilters filters.Args
}

func (m *mockPruneClient) ContainersPrune(ctx context.Context, pruneFilters filters.Args) (container.PruneReport, error) {
	return container.PruneReport{
		ContainersDeleted: []string{"cid_dead_1", "cid_dead_2"},
		SpaceReclaimed:    m.containerReclaimed,
	}, nil
}

func (m *mockPruneClient) ImagesPrune(ctx context.Context, pruneFilters filters.Args) (image.PruneReport, error) {
	m.receivedImageFilters = pruneFilters
	return image.PruneReport{
		ImagesDeleted: []image.DeleteResponse{
			{Deleted: "sha256:dangling1"},
		},
		SpaceReclaimed: m.imageReclaimed,
	}, nil
}

func (m *mockPruneClient) BuildCachePrune(ctx context.Context, opts types.BuildCachePruneOptions) (*types.BuildCachePruneReport, error) {
	m.receivedCacheFilters = opts.Filters
	return &types.BuildCachePruneReport{
		CachesDeleted:  []string{"cache_1", "cache_2", "cache_3"},
		SpaceReclaimed: m.cacheReclaimed,
	}, nil
}

func TestPrunerExecute(t *testing.T) {
	mockCli := &mockPruneClient{
		containerReclaimed: 50 * 1024 * 1024,  // 50 MB
		imageReclaimed:     150 * 1024 * 1024, // 150 MB
		cacheReclaimed:     200 * 1024 * 1024, // 200 MB
	}

	pruner := NewPruner(mockCli)
	res, err := pruner.Prune(context.Background())
	if err != nil {
		t.Fatalf("Prune failed: %v", err)
	}

	if res.ContainersDeleted != 2 {
		t.Errorf("expected 2 containers deleted, got %d", res.ContainersDeleted)
	}
	if res.ImagesDeleted != 1 {
		t.Errorf("expected 1 image deleted, got %d", res.ImagesDeleted)
	}
	if res.CacheDeleted != 3 {
		t.Errorf("expected 3 cache items deleted, got %d", res.CacheDeleted)
	}

	expectedReclaimed := int64(400 * 1024 * 1024)
	if res.ReclaimedBytes != expectedReclaimed {
		t.Errorf("expected %d bytes reclaimed, got %d", expectedReclaimed, res.ReclaimedBytes)
	}

	// Verify dangling=true safety filter
	danglingValues := mockCli.receivedImageFilters.Get("dangling")
	if len(danglingValues) == 0 || danglingValues[0] != "true" {
		t.Errorf("expected dangling=true filter for images, got %v", danglingValues)
	}

	// Verify until=168h cache filter
	untilValues := mockCli.receivedCacheFilters.Get("until")
	if len(untilValues) == 0 || untilValues[0] != "168h" {
		t.Errorf("expected until=168h filter for build cache, got %v", untilValues)
	}
}
