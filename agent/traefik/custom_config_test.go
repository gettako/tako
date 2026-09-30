package traefik

import (
	"context"
	"os"
	"path/filepath"
	"testing"

	"github.com/docker/docker/api/types/container"
	"github.com/docker/docker/client"
)

type mockDockerClient struct {
	client.APIClient
	containers   []container.Summary
	restartedIDs []string
}

func (m *mockDockerClient) ContainerList(ctx context.Context, options container.ListOptions) ([]container.Summary, error) {
	return m.containers, nil
}

func (m *mockDockerClient) ContainerRestart(ctx context.Context, containerID string, options container.StopOptions) error {
	m.restartedIDs = append(m.restartedIDs, containerID)
	return nil
}

func TestCustomConfigManager(t *testing.T) {
	tempDir := t.TempDir()
	customPath := filepath.Join(tempDir, "dynamic", "custom.yaml")
	staticPath := filepath.Join(tempDir, "traefik.yaml")

	_ = os.WriteFile(staticPath, []byte("entryPoints:\n  web:\n    address: :80\n"), 0644)

	mockCli := &mockDockerClient{
		containers: []container.Summary{
			{
				ID:    "c_traefik_123",
				Names: []string{"/tako-traefik"},
			},
		},
	}

	mgr := NewCustomConfigManager(customPath, staticPath, mockCli)

	// 1. Initial read: custom is empty, static is present
	custom, static, err := mgr.GetConfigs()
	if err != nil {
		t.Fatalf("failed to get configs: %v", err)
	}
	if custom != "" {
		t.Errorf("expected empty custom config initially, got %s", custom)
	}
	if static == "" {
		t.Errorf("expected non-empty static config")
	}

	// 2. Save invalid YAML should fail
	err = mgr.SaveCustomConfig("http:\n  middlewares:\n    bad: [unclosed")
	if err == nil {
		t.Fatalf("expected error for invalid YAML syntax, got nil")
	}

	// 3. Save valid YAML should succeed
	validYAML := `http:
  middlewares:
    cors-headers:
      headers:
        accessControlAllowMethods:
          - GET
          - POST
`
	err = mgr.SaveCustomConfig(validYAML)
	if err != nil {
		t.Fatalf("expected no error saving valid YAML, got %v", err)
	}

	readBack, _, err := mgr.GetConfigs()
	if err != nil {
		t.Fatalf("failed to read back saved YAML: %v", err)
	}
	if readBack != validYAML {
		t.Errorf("expected readBack to match validYAML")
	}

	// 4. Restart container
	err = mgr.RestartTraefik(context.Background())
	if err != nil {
		t.Fatalf("expected no error restarting traefik: %v", err)
	}
	if len(mockCli.restartedIDs) != 1 || mockCli.restartedIDs[0] != "c_traefik_123" {
		t.Errorf("expected restarted container c_traefik_123, got %+v", mockCli.restartedIDs)
	}
}
