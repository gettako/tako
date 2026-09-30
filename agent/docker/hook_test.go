package docker

import (
	"bytes"
	"context"
	"net"
	"strings"
	"testing"

	"github.com/docker/docker/api/types"
	"github.com/docker/docker/api/types/container"
)

type mockExecClient struct {
	execCreateCmd      []string
	execCreateErr      error
	execID             string
	execAttachErr      error
	outputLines        string
	execInspectCode    int
	execInspectErr     error
	stoppedContainers  []string
	removedContainers  []string
}

func (m *mockExecClient) ContainerList(ctx context.Context, options container.ListOptions) ([]container.Summary, error) {
	return nil, nil
}

func (m *mockExecClient) ContainerExecCreate(ctx context.Context, containerID string, config container.ExecOptions) (container.ExecCreateResponse, error) {
	m.execCreateCmd = config.Cmd
	if m.execCreateErr != nil {
		return container.ExecCreateResponse{}, m.execCreateErr
	}
	id := m.execID
	if id == "" {
		id = "exec_123"
	}
	return container.ExecCreateResponse{ID: id}, nil
}

type fakeConn struct {
	net.Conn
	buf *bytes.Buffer
}

func (f *fakeConn) Read(b []byte) (n int, err error) {
	return f.buf.Read(b)
}

func (f *fakeConn) Write(b []byte) (n int, err error) {
	return len(b), nil
}

func (f *fakeConn) Close() error {
	return nil
}

func (m *mockExecClient) ContainerExecAttach(ctx context.Context, execID string, config container.ExecAttachOptions) (types.HijackedResponse, error) {
	if m.execAttachErr != nil {
		return types.HijackedResponse{}, m.execAttachErr
	}
	conn := &fakeConn{buf: bytes.NewBufferString(m.outputLines)}
	return types.NewHijackedResponse(conn, "application/vnd.docker.raw-stream"), nil
}

func (m *mockExecClient) ContainerExecInspect(ctx context.Context, execID string) (container.ExecInspect, error) {
	if m.execInspectErr != nil {
		return container.ExecInspect{}, m.execInspectErr
	}
	return container.ExecInspect{
		ExitCode: m.execInspectCode,
		Running:  false,
	}, nil
}

func (m *mockExecClient) ContainerExecResize(ctx context.Context, execID string, options container.ResizeOptions) error {
	return nil
}

func (m *mockExecClient) ContainerStop(ctx context.Context, containerID string, options container.StopOptions) error {
	m.stoppedContainers = append(m.stoppedContainers, containerID)
	return nil
}

func (m *mockExecClient) ContainerRemove(ctx context.Context, containerID string, options container.RemoveOptions) error {
	m.removedContainers = append(m.removedContainers, containerID)
	return nil
}

func TestHookExecutor_Success(t *testing.T) {
	cli := &mockExecClient{
		outputLines:     "Running migrations...\nMigrated 001_create_users\nDone.\n",
		execInspectCode: 0,
	}
	executor := NewHookExecutor(cli)
	sender := &mockLogSender{}

	err := executor.ExecuteHook(context.Background(), "cid_running_container_123", "php artisan migrate --force", "dep_test_1", "post_deploy", sender)
	if err != nil {
		t.Fatalf("expected nil error on success, got: %v", err)
	}

	if len(cli.execCreateCmd) < 3 || cli.execCreateCmd[2] != "php artisan migrate --force" {
		t.Errorf("unexpected exec cmd: %v", cli.execCreateCmd)
	}

	foundMigrated := false
	for _, l := range sender.logs {
		if strings.Contains(l.LogLine, "Migrated 001_create_users") {
			foundMigrated = true
		}
	}
	if !foundMigrated {
		t.Errorf("expected migration output in build logs, got: %v", sender.logs)
	}
}

func TestHookExecutor_FailureExitsNonZero(t *testing.T) {
	cli := &mockExecClient{
		outputLines:     "SQLSTATE[HY000]: General error: 1045 Access denied\n",
		execInspectCode: 1,
	}
	executor := NewHookExecutor(cli)
	sender := &mockLogSender{}

	err := executor.ExecuteHook(context.Background(), "cid_running_container_123", "php artisan migrate --force", "dep_test_2", "post_deploy", sender)
	if err == nil {
		t.Fatal("expected error on non-zero exit code, got nil")
	}

	if !strings.Contains(err.Error(), "failed with exit code 1") {
		t.Errorf("expected error message to mention exit code 1, got: %v", err)
	}

	var hasErrLog bool
	for _, l := range sender.logs {
		if l.IsError {
			hasErrLog = true
		}
	}
	if !hasErrLog {
		t.Error("expected build log with IsError=true")
	}
}
