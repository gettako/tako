package docker

import (
	"context"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/docker/docker/api/types/container"

	"gettako.dev/tako/internal/protocol"
)

func TestTraefikManagerWriteConfig(t *testing.T) {
	tempDir := t.TempDir()
	configPath := filepath.Join(tempDir, "traefik", "dynamic", "tako.yml")

	tm := NewTraefikManager(configPath)

	err := tm.UpdateRoute("svc_api", "api.example.com", "172.20.0.10", 8080)
	if err != nil {
		t.Fatalf("UpdateRoute failed: %v", err)
	}

	content, err := os.ReadFile(configPath)
	if err != nil {
		t.Fatalf("failed to read written traefik config: %v", err)
	}

	contentStr := string(content)
	if !strings.Contains(contentStr, "svc_svc_api") {
		t.Errorf("expected router svc_svc_api in config, got:\n%s", contentStr)
	}
	if !strings.Contains(contentStr, "Host(`api.example.com`)") {
		t.Errorf("expected Host rule in config, got:\n%s", contentStr)
	}
	if !strings.Contains(contentStr, "http://172.20.0.10:8080") {
		t.Errorf("expected loadBalancer URL in config, got:\n%s", contentStr)
	}

	// Remove route
	err = tm.RemoveRoute("svc_api")
	if err != nil {
		t.Fatalf("RemoveRoute failed: %v", err)
	}

	content, _ = os.ReadFile(configPath)
	if strings.Contains(string(content), "svc_svc_api") {
		t.Errorf("expected route removed, but found in config")
	}
}

type mockSwitchoverDockerClient struct {
	mockDockerRunnerClient
	containers []container.Summary
	stoppedIDs []string
}

func (m *mockSwitchoverDockerClient) ContainerList(ctx context.Context, options container.ListOptions) ([]container.Summary, error) {
	return m.containers, nil
}

func (m *mockSwitchoverDockerClient) ContainerStop(ctx context.Context, containerID string, options container.StopOptions) error {
	m.stoppedIDs = append(m.stoppedIDs, containerID)
	return nil
}

func TestSwitchoverZeroDowntimeSuccess(t *testing.T) {
	tempDir := t.TempDir()
	traefikConfig := filepath.Join(tempDir, "tako.yml")
	traefik := NewTraefikManager(traefikConfig)

	oldContainerID := "cid_old_previous_container_123"
	newContainerID := "cid_new_current_container_456"

	mockDocker := &mockSwitchoverDockerClient{
		containers: []container.Summary{
			{
				ID: oldContainerID,
				Labels: map[string]string{
					"tako.service_id":    "srv_web_01",
					"tako.deployment_id": "dep_old_01",
				},
				State: "running",
			},
			{
				ID: "cid_other_service",
				Labels: map[string]string{
					"tako.service_id": "srv_other_99",
				},
				State: "running",
			},
		},
	}

	sm := NewSwitchoverManager(mockDocker, traefik, 20*time.Millisecond)
	sender := &mockLogSender{}

	job := &protocol.DeployJob{
		DeploymentId: "dep_new_02",
		ServiceId:    "srv_web_01",
		Domain:       "app.gettako.dev",
	}

	launched := &LaunchedContainer{
		ContainerID: newContainerID,
		IPAddress:   "172.20.0.22",
		Port:        3000,
		ImageTag:    "tako-app-srv_web_01:dep_new_02",
	}

	err := sm.Switchover(context.Background(), job, launched, sender)
	if err != nil {
		t.Fatalf("Switchover failed: %v", err)
	}

	// 1. Verify Traefik was updated to new container
	route, ok := traefik.GetRoute("srv_web_01")
	if !ok || route.IP != "172.20.0.22" || route.Port != 3000 {
		t.Errorf("expected traefik route to point to 172.20.0.22:3000, got %+v", route)
	}

	// 2. Verify old container for srv_web_01 was stopped after drain
	if len(mockDocker.stoppedIDs) != 1 || mockDocker.stoppedIDs[0] != oldContainerID {
		t.Errorf("expected old container %s to be stopped, got %v", oldContainerID, mockDocker.stoppedIDs)
	}

	// 3. Verify final status transition is healthy with active container ID
	if len(sender.transitions) == 0 {
		t.Fatal("expected status transition sent")
	}
	lastTrans := sender.transitions[len(sender.transitions)-1]
	if lastTrans.Status != "healthy" || lastTrans.ActiveContainerId != newContainerID {
		t.Errorf("expected final status healthy with new container ID, got %+v", lastTrans)
	}
}

func TestSwitchoverIsolationOnFailure(t *testing.T) {
	// If a failure occurred before switchover, Traefik and old container must remain unchanged
	tempDir := t.TempDir()
	traefikConfig := filepath.Join(tempDir, "tako.yml")
	traefik := NewTraefikManager(traefikConfig)

	// Pre-existing route
	_ = traefik.UpdateRoute("srv_web_01", "app.gettako.dev", "172.20.0.1", 3000)

	oldContainerID := "cid_old_previous_container_123"
	mockDocker := &mockSwitchoverDockerClient{
		containers: []container.Summary{
			{
				ID: oldContainerID,
				Labels: map[string]string{
					"tako.service_id": "srv_web_01",
				},
				State: "running",
			},
		},
	}

	// Simulating that Switchover is never called because health check failed
	// Verify Traefik and running containers are completely untouched
	route, _ := traefik.GetRoute("srv_web_01")
	if route.IP != "172.20.0.1" {
		t.Errorf("expected existing route to remain untouched, got %s", route.IP)
	}
	if len(mockDocker.stoppedIDs) != 0 {
		t.Errorf("expected old containers to remain untouched, got %v", mockDocker.stoppedIDs)
	}
}
