package docker

import (
	"context"
	"io"
	"strings"
	"sync"
	"testing"

	"github.com/docker/docker/api/types/container"
	"github.com/docker/docker/api/types/image"
	"github.com/docker/docker/api/types/network"
	"github.com/docker/docker/client"
	ocispec "github.com/opencontainers/image-spec/specs-go/v1"

	"gettako.dev/tako/internal/protocol"
)

type mockComposeDockerClient struct {
	mu sync.Mutex

	createdContainers []string
	createdConfigs    map[string]*container.Config
	createdHostCfgs   map[string]*container.HostConfig
	createdNetCfgs    map[string]*network.NetworkingConfig
	startedContainers []string
	pulledImages      []string
	createdNetworks   []string
	connectedNetworks map[string][]string // netID -> []containerID
	removedNetworks   []string

	logsReader io.ReadCloser
}

func newMockComposeDockerClient() *mockComposeDockerClient {
	return &mockComposeDockerClient{
		createdConfigs:    make(map[string]*container.Config),
		createdHostCfgs:   make(map[string]*container.HostConfig),
		createdNetCfgs:    make(map[string]*network.NetworkingConfig),
		connectedNetworks: make(map[string][]string),
	}
}

func (m *mockComposeDockerClient) NetworkCreate(ctx context.Context, name string, options network.CreateOptions) (network.CreateResponse, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.createdNetworks = append(m.createdNetworks, name)
	return network.CreateResponse{ID: "net_" + name}, nil
}

func (m *mockComposeDockerClient) NetworkInspect(ctx context.Context, networkID string, options network.InspectOptions) (network.Inspect, error) {
	return network.Inspect{ID: networkID, Name: networkID}, nil
}

func (m *mockComposeDockerClient) NetworkConnect(ctx context.Context, networkID, containerID string, config *network.EndpointSettings) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.connectedNetworks[networkID] = append(m.connectedNetworks[networkID], containerID)
	return nil
}

func (m *mockComposeDockerClient) NetworkRemove(ctx context.Context, networkID string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.removedNetworks = append(m.removedNetworks, networkID)
	return nil
}

func (m *mockComposeDockerClient) ContainerCreate(ctx context.Context, config *container.Config, hostConfig *container.HostConfig, networkingConfig *network.NetworkingConfig, platform *ocispec.Platform, containerName string) (container.CreateResponse, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.createdContainers = append(m.createdContainers, containerName)
	m.createdConfigs[containerName] = config
	m.createdHostCfgs[containerName] = hostConfig
	m.createdNetCfgs[containerName] = networkingConfig
	return container.CreateResponse{ID: "cid_" + containerName}, nil
}

func (m *mockComposeDockerClient) ContainerStart(ctx context.Context, containerID string, options container.StartOptions) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.startedContainers = append(m.startedContainers, containerID)
	return nil
}

func (m *mockComposeDockerClient) ContainerInspect(ctx context.Context, containerID string) (container.InspectResponse, error) {
	return container.InspectResponse{
		NetworkSettings: &container.NetworkSettings{
			Networks: map[string]*network.EndpointSettings{
				"tako_network": {
					IPAddress: "172.20.0.10",
				},
			},
		},
	}, nil
}

func (m *mockComposeDockerClient) ContainerList(ctx context.Context, options container.ListOptions) ([]container.Summary, error) {
	return nil, nil
}

func (m *mockComposeDockerClient) ContainerStop(ctx context.Context, containerID string, options container.StopOptions) error {
	return nil
}

func (m *mockComposeDockerClient) ContainerRemove(ctx context.Context, containerID string, options container.RemoveOptions) error {
	return nil
}

func (m *mockComposeDockerClient) ContainerLogs(ctx context.Context, container string, options container.LogsOptions) (io.ReadCloser, error) {
	if m.logsReader != nil {
		return m.logsReader, nil
	}
	return io.NopCloser(strings.NewReader("")), nil
}

func (m *mockComposeDockerClient) ImageInspect(ctx context.Context, imageID string, inspectOpts ...client.ImageInspectOption) (image.InspectResponse, error) {
	return image.InspectResponse{}, nil
}

func (m *mockComposeDockerClient) ImagePull(ctx context.Context, refStr string, options image.PullOptions) (io.ReadCloser, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.pulledImages = append(m.pulledImages, refStr)
	return io.NopCloser(strings.NewReader("")), nil
}

func TestComposeManager_Execute_Inline(t *testing.T) {
	cli := newMockComposeDockerClient()
	sender := &mockLogSender{}
	mgr := NewComposeManager(cli, nil, nil)

	inlineYAML := `
version: '3.8'
services:
  web:
    image: nginx:alpine
    ports:
      - "8080:80"
    depends_on:
      - db
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: app
`

	job := &protocol.DeployJob{
		DeploymentId:       "dep_compose_1",
		ServiceId:          "svc_compose_1",
		ProjectId:          "prj_alpha",
		ServiceType:        "compose",
		ComposeFileContent: inlineYAML,
	}

	err := mgr.Execute(context.Background(), job, sender)
	if err != nil {
		t.Fatalf("expected successful deployment, got %v", err)
	}

	// 1. Verify startup order (db must be started before web because web depends_on db)
	cli.mu.Lock()
	defer cli.mu.Unlock()

	if len(cli.createdContainers) != 2 {
		t.Fatalf("expected 2 created containers, got %d: %v", len(cli.createdContainers), cli.createdContainers)
	}

	if cli.createdContainers[0] != "tako-svc_compose_1-db" {
		t.Errorf("expected db to be created first, got %s", cli.createdContainers[0])
	}
	if cli.createdContainers[1] != "tako-svc_compose_1-web" {
		t.Errorf("expected web to be created second, got %s", cli.createdContainers[1])
	}

	// 2. Verify network configuration and aliases
	dbNet := cli.createdNetCfgs["tako-svc_compose_1-db"]
	if dbNet == nil || dbNet.EndpointsConfig["tako_compose_prj_alpha"] == nil {
		t.Fatalf("expected db to have tako_compose_prj_alpha network config")
	}
	aliases := dbNet.EndpointsConfig["tako_compose_prj_alpha"].Aliases
	if len(aliases) == 0 || aliases[0] != "db" {
		t.Errorf("expected alias 'db', got %v", aliases)
	}

	// 3. Verify status transitions
	hasHealthy := false
	for _, tr := range sender.transitions {
		if tr.Status == "healthy" {
			hasHealthy = true
		}
	}
	if !hasHealthy {
		t.Errorf("expected healthy transition, transitions recorded: %v", sender.transitions)
	}
}

func TestComposeManager_Execute_InvalidYAML(t *testing.T) {
	cli := newMockComposeDockerClient()
	sender := &mockLogSender{}
	mgr := NewComposeManager(cli, nil, nil)

	job := &protocol.DeployJob{
		DeploymentId:       "dep_invalid_yaml",
		ServiceId:          "svc_1",
		ProjectId:          "prj_1",
		ServiceType:        "compose",
		ComposeFileContent: "services: [broken",
	}

	err := mgr.Execute(context.Background(), job, sender)
	if err == nil {
		t.Fatalf("expected error on invalid YAML, got nil")
	}

	hasFailed := false
	for _, tr := range sender.transitions {
		if tr.Status == "failed" {
			hasFailed = true
		}
	}
	if !hasFailed {
		t.Errorf("expected failed transition")
	}
}

func TestComposeManager_Execute_CircularDependency(t *testing.T) {
	cli := newMockComposeDockerClient()
	sender := &mockLogSender{}
	mgr := NewComposeManager(cli, nil, nil)

	circularYAML := `
version: '3.8'
services:
  web:
    image: nginx
    depends_on:
      - api
  api:
    image: node
    depends_on:
      - web
`

	job := &protocol.DeployJob{
		DeploymentId:       "dep_circular",
		ServiceId:          "svc_circ",
		ProjectId:          "prj_circ",
		ServiceType:        "compose",
		ComposeFileContent: circularYAML,
	}

	err := mgr.Execute(context.Background(), job, sender)
	if err == nil {
		t.Fatalf("expected error on circular dependency, got nil")
	}
}
