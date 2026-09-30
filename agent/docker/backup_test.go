package docker

import (
	"context"
	"testing"

	"github.com/docker/docker/api/types"
	"github.com/docker/docker/api/types/container"

	"gettako.dev/tako/internal/protocol"
)

type mockBackupExecClient struct {
	containers    []container.Summary
	execCmd       []string
	execEnv       []string
	createdExecID string
}

func (m *mockBackupExecClient) ContainerList(ctx context.Context, options container.ListOptions) ([]container.Summary, error) {
	return m.containers, nil
}

func (m *mockBackupExecClient) ContainerExecCreate(ctx context.Context, containerID string, config container.ExecOptions) (container.ExecCreateResponse, error) {
	m.execCmd = config.Cmd
	m.execEnv = config.Env
	return container.ExecCreateResponse{ID: "exec-test-1"}, nil
}

func (m *mockBackupExecClient) ContainerExecAttach(ctx context.Context, execID string, config container.ExecAttachOptions) (types.HijackedResponse, error) {
	return types.HijackedResponse{}, nil
}

func (m *mockBackupExecClient) ContainerExecInspect(ctx context.Context, execID string) (container.ExecInspect, error) {
	return container.ExecInspect{Running: false, ExitCode: 0}, nil
}

func (m *mockBackupExecClient) ContainerExecResize(ctx context.Context, execID string, options container.ResizeOptions) error {
	return nil
}

func (m *mockBackupExecClient) ContainerStop(ctx context.Context, containerID string, options container.StopOptions) error {
	return nil
}

func (m *mockBackupExecClient) ContainerRemove(ctx context.Context, containerID string, options container.RemoveOptions) error {
	return nil
}

func TestBackupManager_FindActiveContainer(t *testing.T) {
	ctx := context.Background()
	mock := &mockBackupExecClient{
		containers: []container.Summary{
			{
				ID:    "c1-srv123",
				State: "running",
				Labels: map[string]string{
					"tako.service_id": "srv123",
				},
				Names: []string{"/tako-srv123-dep1"},
			},
			{
				ID:    "c2-other",
				State: "running",
				Labels: map[string]string{
					"tako.service_id": "srv456",
				},
			},
		},
	}

	bm := NewBackupManager(mock)
	cid, err := bm.FindActiveContainer(ctx, "srv123")
	if err != nil {
		t.Fatalf("unexpected error finding container: %v", err)
	}
	if cid != "c1-srv123" {
		t.Fatalf("expected c1-srv123, got %s", cid)
	}

	// Missing container
	_, err = bm.FindActiveContainer(ctx, "nonexistent")
	if err == nil {
		t.Fatal("expected error for nonexistent service, got nil")
	}
}

func TestBackupManager_MissingS3Config(t *testing.T) {
	ctx := context.Background()
	bm := NewBackupManager(&mockBackupExecClient{})

	_, err := bm.ExecuteBackup(ctx, &protocol.BackupCommand{
		ServiceId:  "srv1",
		BackupType: "database",
	})
	if err == nil {
		t.Fatal("expected error for missing S3 config, got nil")
	}
}
