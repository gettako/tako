package traefik_test

import (
	"os"
	"path/filepath"
	"testing"

	"gettako.dev/tako/agent/internal/traefik"
)

func TestWriteAndRemoveDynamicConfig(t *testing.T) {
	tempDir, err := os.MkdirTemp("", "traefik-dynamic-test")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tempDir)

	cfg := traefik.RouteConfig{
		ServiceName: "my-service",
		Domains:     []string{"app.example.com"},
		TargetPort:  8080,
		EnableTLS:   true,
	}

	if err := traefik.WriteDynamicConfig(tempDir, cfg); err != nil {
		t.Fatalf("failed to write dynamic config: %v", err)
	}

	expectedFile := filepath.Join(tempDir, "my-service.yml")
	content, err := os.ReadFile(expectedFile)
	if err != nil {
		t.Fatalf("expected file to exist: %v", err)
	}

	if len(content) == 0 {
		t.Fatalf("dynamic config file is empty")
	}

	if err := traefik.RemoveDynamicConfig(tempDir, "my-service"); err != nil {
		t.Fatalf("failed to remove dynamic config: %v", err)
	}

	if _, err := os.Stat(expectedFile); !os.IsNotExist(err) {
		t.Fatalf("expected file to be deleted")
	}
}
