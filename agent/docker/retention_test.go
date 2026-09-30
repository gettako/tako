package docker

import (
	"context"
	"errors"
	"fmt"
	"io"
	"strings"
	"testing"
	"time"

	"github.com/docker/docker/api/types/image"
	"github.com/docker/docker/client"

	"gettako.dev/tako/internal/protocol"
)

type mockDockerImageManager struct {
	images       []image.Summary
	removedIDs   []string
	inspectErr   error
	inspectFound bool
}

func (m *mockDockerImageManager) ImageList(ctx context.Context, options image.ListOptions) ([]image.Summary, error) {
	return m.images, nil
}

func (m *mockDockerImageManager) ImageInspect(ctx context.Context, imageID string, inspectOpts ...client.ImageInspectOption) (image.InspectResponse, error) {
	if m.inspectErr != nil {
		return image.InspectResponse{}, m.inspectErr
	}
	if !m.inspectFound {
		return image.InspectResponse{}, errors.New("No such image")
	}
	return image.InspectResponse{
		ID: imageID,
	}, nil
}

func (m *mockDockerImageManager) ImageRemove(ctx context.Context, imageID string, options image.RemoveOptions) ([]image.DeleteResponse, error) {
	m.removedIDs = append(m.removedIDs, imageID)
	return nil, nil
}

func (m *mockDockerImageManager) ImagePull(ctx context.Context, refStr string, options image.PullOptions) (io.ReadCloser, error) {
	return io.NopCloser(strings.NewReader("")), nil
}

func TestEnforceImageRetention(t *testing.T) {
	// Create 7 images with decreasing timestamps
	now := time.Now().Unix()
	var images []image.Summary
	for i := 1; i <= 7; i++ {
		images = append(images, image.Summary{
			ID:       fmt.Sprintf("img_id_%d", i),
			Created:  now - int64(i*100), // i=1 is newest, i=7 is oldest
			RepoTags: []string{fmt.Sprintf("tako-app-srv_app:dep_0%d", i)},
		})
	}
	// Also add an image from a different service
	images = append(images, image.Summary{
		ID:       "img_other_service",
		Created:  now - 1000,
		RepoTags: []string{"tako-app-srv_other:dep_01"},
	})

	mockImg := &mockDockerImageManager{images: images}
	sender := &mockLogSender{}

	removed, err := EnforceImageRetention(context.Background(), mockImg, "srv_app", 5, sender)
	if err != nil {
		t.Fatalf("EnforceImageRetention failed: %v", err)
	}

	// Should have removed the 2 oldest images (img_id_6 and img_id_7)
	if len(removed) != 2 {
		t.Fatalf("expected 2 removed images, got %d", len(removed))
	}
	if len(mockImg.removedIDs) != 2 {
		t.Fatalf("expected 2 image remove calls, got %d", len(mockImg.removedIDs))
	}
	if mockImg.removedIDs[0] != "img_id_6" || mockImg.removedIDs[1] != "img_id_7" {
		t.Errorf("expected img_id_6 and img_id_7 removed, got %v", mockImg.removedIDs)
	}
}

func TestDeployPipelineRollbackInstant(t *testing.T) {
	mockImg := &mockDockerImageManager{inspectFound: true}
	mockDocker := &mockSwitchoverDockerClient{}
	mockHTTP := &mockHTTPClient{statusCode: 200}

	cfg := RunnerConfig{
		NetworkName:          "tako_network",
		HealthCheckInterval:  10 * time.Millisecond,
		HealthCheckTimeout:   1 * time.Second,
		ConsecutiveSuccesses: 1,
		DrainTimeout:         10 * time.Millisecond,
	}

	traefik := NewTraefikManager(t.TempDir() + "/traefik.yaml")
	runner := NewRunner(mockDocker, mockHTTP, cfg)
	switchover := NewSwitchoverManager(mockDocker, traefik, 10*time.Millisecond)
	builder := NewBuilder(&mockDockerBuilder{}, t.TempDir())

	pipeline := NewDeployPipeline(builder, runner, switchover, mockImg)
	sender := &mockLogSender{}

	job := &protocol.DeployJob{
		DeploymentId:     "dep_rollback_99",
		ServiceId:        "srv_web_01",
		IsRollback:       true,
		RollbackImageTag: "tako-app-srv_web_01:dep_old_01",
		InternalPort:     3000,
	}

	err := pipeline.Execute(context.Background(), job, sender)
	if err != nil {
		t.Fatalf("Rollback Execute failed: %v", err)
	}

	// Status transition healthy
	if len(sender.transitions) == 0 {
		t.Fatal("expected status transitions")
	}
	lastTrans := sender.transitions[len(sender.transitions)-1]
	if lastTrans.Status != "healthy" {
		t.Errorf("expected final status healthy, got %s", lastTrans.Status)
	}
}

func TestDeployPipelineRollbackImageMissing(t *testing.T) {
	mockImg := &mockDockerImageManager{inspectFound: false} // Image missing locally
	mockDocker := &mockSwitchoverDockerClient{}
	mockHTTP := &mockHTTPClient{statusCode: 200}

	cfg := DefaultRunnerConfig()
	traefik := NewTraefikManager(t.TempDir() + "/traefik.yaml")
	runner := NewRunner(mockDocker, mockHTTP, cfg)
	switchover := NewSwitchoverManager(mockDocker, traefik, 10*time.Millisecond)
	builder := NewBuilder(&mockDockerBuilder{}, t.TempDir())

	pipeline := NewDeployPipeline(builder, runner, switchover, mockImg)
	sender := &mockLogSender{}

	job := &protocol.DeployJob{
		DeploymentId:     "dep_rollback_fail",
		ServiceId:        "srv_web_01",
		IsRollback:       true,
		RollbackImageTag: "tako-app-srv_web_01:dep_deleted",
	}

	err := pipeline.Execute(context.Background(), job, sender)
	if err == nil {
		t.Fatal("expected error when rollback image is missing, got nil")
	}

	// Verify status transition was failed
	var foundFailed bool
	for _, tr := range sender.transitions {
		if tr.Status == "failed" {
			foundFailed = true
		}
	}
	if !foundFailed {
		t.Error("expected failed transition when image is missing")
	}
}
