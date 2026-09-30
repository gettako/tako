package docker

import (
	"context"
	"errors"
	"io"
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/docker/docker/api/types/container"
	"github.com/docker/docker/api/types/network"
	ocispec "github.com/opencontainers/image-spec/specs-go/v1"

	"gettako.dev/tako/internal/protocol"
)

type mockDockerRunnerClient struct {
	createdConfig     *container.Config
	createdHostConfig *container.HostConfig
	createdNetConfig  *network.NetworkingConfig
	createdName       string

	startedID  string
	stoppedID  string
	removedID  string
	inspectIP  string
	createErr  error
	startErr   error
	inspectErr error
}

func (m *mockDockerRunnerClient) NetworkCreate(ctx context.Context, name string, options network.CreateOptions) (network.CreateResponse, error) {
	return network.CreateResponse{ID: "net_123"}, nil
}

func (m *mockDockerRunnerClient) NetworkInspect(ctx context.Context, networkID string, options network.InspectOptions) (network.Inspect, error) {
	return network.Inspect{ID: "net_123", Name: "tako_network"}, nil
}

func (m *mockDockerRunnerClient) ContainerCreate(ctx context.Context, config *container.Config, hostConfig *container.HostConfig, networkingConfig *network.NetworkingConfig, platform *ocispec.Platform, containerName string) (container.CreateResponse, error) {
	m.createdConfig = config
	m.createdHostConfig = hostConfig
	m.createdNetConfig = networkingConfig
	m.createdName = containerName
	if m.createErr != nil {
		return container.CreateResponse{}, m.createErr
	}
	return container.CreateResponse{ID: "cid_1234567890abcdef"}, nil
}

func (m *mockDockerRunnerClient) ContainerStart(ctx context.Context, containerID string, options container.StartOptions) error {
	m.startedID = containerID
	return m.startErr
}

func (m *mockDockerRunnerClient) ContainerList(ctx context.Context, options container.ListOptions) ([]container.Summary, error) {
	return nil, nil
}

func (m *mockDockerRunnerClient) ContainerInspect(ctx context.Context, containerID string) (container.InspectResponse, error) {
	if m.inspectErr != nil {
		return container.InspectResponse{}, m.inspectErr
	}
	ip := m.inspectIP
	if ip == "" {
		ip = "172.20.0.5"
	}
	return container.InspectResponse{
		NetworkSettings: &container.NetworkSettings{
			Networks: map[string]*network.EndpointSettings{
				"tako_network": {IPAddress: ip},
			},
		},
	}, nil
}

func (m *mockDockerRunnerClient) ContainerStop(ctx context.Context, containerID string, options container.StopOptions) error {
	m.stoppedID = containerID
	return nil
}

func (m *mockDockerRunnerClient) ContainerRemove(ctx context.Context, containerID string, options container.RemoveOptions) error {
	m.removedID = containerID
	return nil
}

type mockHTTPClient struct {
	statusCode int
	err        error
	calls      int
}

func (m *mockHTTPClient) Do(req *http.Request) (*http.Response, error) {
	m.calls++
	if m.err != nil {
		return nil, m.err
	}
	return &http.Response{
		StatusCode: m.statusCode,
		Body:       io.NopCloser(strings.NewReader(`{"status":"ok"}`)),
	}, nil
}

func TestLaunchAndVerifySuccess(t *testing.T) {
	mockDocker := &mockDockerRunnerClient{}
	mockHTTP := &mockHTTPClient{statusCode: 200}

	cfg := RunnerConfig{
		NetworkName:          "tako_network",
		HealthCheckInterval:  10 * time.Millisecond,
		HealthCheckTimeout:   1 * time.Second,
		ConsecutiveSuccesses: 2,
		DrainTimeout:         10 * time.Millisecond,
	}

	runner := NewRunner(mockDocker, mockHTTP, cfg)
	sender := &mockLogSender{}

	job := &protocol.DeployJob{
		DeploymentId:    "dep_run_01",
		ServiceId:       "srv_web_01",
		InternalPort:    8080,
		HealthCheckPath: "/healthz",
		EnvVars: map[string]string{
			"DATABASE_URL": "postgres://user:pass@db:5432/app",
			"NODE_ENV":     "production",
		},
	}

	launched, err := runner.LaunchAndVerify(context.Background(), job, "tako-app-srv_web_01:dep_run_01", sender)
	if err != nil {
		t.Fatalf("LaunchAndVerify failed: %v", err)
	}

	if launched.ContainerID != "cid_1234567890abcdef" {
		t.Errorf("expected container ID 'cid_1234567890abcdef', got %s", launched.ContainerID)
	}
	if launched.IPAddress != "172.20.0.5" {
		t.Errorf("expected IP '172.20.0.5', got %s", launched.IPAddress)
	}
	if launched.Port != 8080 {
		t.Errorf("expected port 8080, got %d", launched.Port)
	}

	// Verify environment variables were injected
	if len(mockDocker.createdConfig.Env) != 2 {
		t.Fatalf("expected 2 env vars injected, got %d", len(mockDocker.createdConfig.Env))
	}

	// Verify health check polled at least 2 times for consecutive success
	if mockHTTP.calls < 2 {
		t.Errorf("expected at least 2 health check requests, got %d", mockHTTP.calls)
	}

	// Verify status transition
	if len(sender.transitions) == 0 || sender.transitions[0].Status != "deploying" {
		t.Errorf("expected deploying status transition, got %+v", sender.transitions)
	}
}

func TestLaunchAndVerifyHealthCheckFailureTimeout(t *testing.T) {
	mockDocker := &mockDockerRunnerClient{}
	mockHTTP := &mockHTTPClient{statusCode: 500}

	cfg := RunnerConfig{
		NetworkName:          "tako_network",
		HealthCheckInterval:  10 * time.Millisecond,
		HealthCheckTimeout:   50 * time.Millisecond,
		ConsecutiveSuccesses: 2,
		DrainTimeout:         10 * time.Millisecond,
	}

	runner := NewRunner(mockDocker, mockHTTP, cfg)
	sender := &mockLogSender{}

	job := &protocol.DeployJob{
		DeploymentId:    "dep_fail_01",
		ServiceId:       "srv_web_01",
		InternalPort:    8080,
		HealthCheckPath: "/healthz",
	}

	_, err := runner.LaunchAndVerify(context.Background(), job, "tako-app-srv_web_01:dep_fail_01", sender)
	if err == nil {
		t.Fatal("expected health check timeout error, got nil")
	}

	// Verify container stopped and removed
	if mockDocker.stoppedID != "cid_1234567890abcdef" {
		t.Errorf("expected container cid_1234567890abcdef to be stopped on timeout, got %s", mockDocker.stoppedID)
	}
	if mockDocker.removedID != "cid_1234567890abcdef" {
		t.Errorf("expected container cid_1234567890abcdef to be removed on timeout, got %s", mockDocker.removedID)
	}

	// Verify status transition: failed
	var foundFailed bool
	for _, tr := range sender.transitions {
		if tr.Status == "failed" {
			foundFailed = true
			if !strings.Contains(tr.ErrorReason, "timed out") {
				t.Errorf("expected timeout in error reason, got %s", tr.ErrorReason)
			}
		}
	}
	if !foundFailed {
		t.Error("expected failed status transition sent")
	}
}

func TestLaunchAndVerifyContainerStartError(t *testing.T) {
	mockDocker := &mockDockerRunnerClient{
		startErr: errors.New("port already allocated"),
	}
	mockHTTP := &mockHTTPClient{statusCode: 200}

	cfg := DefaultRunnerConfig()
	runner := NewRunner(mockDocker, mockHTTP, cfg)
	sender := &mockLogSender{}

	job := &protocol.DeployJob{
		DeploymentId: "dep_starterr_01",
		ServiceId:    "srv_web_01",
	}

	_, err := runner.LaunchAndVerify(context.Background(), job, "tako-app-srv_web_01:dep_starterr_01", sender)
	if err == nil {
		t.Fatal("expected container start error, got nil")
	}

	if mockDocker.removedID != "cid_1234567890abcdef" {
		t.Errorf("expected failed container to be removed, got %s", mockDocker.removedID)
	}
}

func TestLaunchAndVerifyPublishedPort(t *testing.T) {
	mockDocker := &mockDockerRunnerClient{
		inspectIP: "172.18.0.5",
	}
	mockHTTP := &mockHTTPClient{statusCode: 200}
	cfg := DefaultRunnerConfig()
	runner := NewRunner(mockDocker, mockHTTP, cfg)
	sender := &mockLogSender{}

	// Case 1: No domain -> defaults to internal_port as published host port
	job1 := &protocol.DeployJob{
		DeploymentId: "dep_pub_01",
		ServiceId:    "srv_web_01",
		InternalPort: 3000,
	}

	_, err := runner.LaunchAndVerify(context.Background(), job1, "image:tag", sender)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	bindings := mockDocker.createdHostConfig.PortBindings
	if len(bindings["3000/tcp"]) != 1 || bindings["3000/tcp"][0].HostPort != "3000" {
		t.Errorf("expected host port binding 3000, got %+v", bindings)
	}

	// Case 2: Explicit published_port
	job2 := &protocol.DeployJob{
		DeploymentId:  "dep_pub_02",
		ServiceId:     "srv_web_02",
		InternalPort:  8080,
		PublishedPort: 3001,
	}

	_, err = runner.LaunchAndVerify(context.Background(), job2, "image:tag", sender)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	bindings2 := mockDocker.createdHostConfig.PortBindings
	if len(bindings2["8080/tcp"]) != 1 || bindings2["8080/tcp"][0].HostPort != "3001" {
		t.Errorf("expected host port binding 3001 for 8080/tcp, got %+v", bindings2)
	}
}

