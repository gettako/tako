package traefik_test

import (
	"os"
	"path/filepath"
	"strings"
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

func TestWriteDynamicConfig_MixedDomains(t *testing.T) {
	tempDir, err := os.MkdirTemp("", "traefik-mixed-test")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tempDir)

	cfg := traefik.RouteConfig{
		ServiceName: "tako-demo-hello",
		Domains: []string{
			"demo.gettako.dev",
			"tako-demo-hello-43-156-243-241.sslip.io",
			"9af03555-43-156-243-241.sslip.io",
		},
		TargetPort: 1337,
		EnableTLS:  true,
	}

	if err := traefik.WriteDynamicConfig(tempDir, cfg); err != nil {
		t.Fatalf("failed to write dynamic config: %v", err)
	}

	file := filepath.Join(tempDir, "tako-demo-hello.yml")
	content, err := os.ReadFile(file)
	if err != nil {
		t.Fatalf("failed to read file: %v", err)
	}

	s := string(content)
	// Preview router must appear BEFORE root middlewares: section
	previewIdx := strings.Index(s, "tako-demo-hello-preview:")
	midIdx := strings.Index(s, "\n  middlewares:\n")

	if previewIdx == -1 {
		t.Fatalf("expected tako-demo-hello-preview in config")
	}
	if midIdx == -1 {
		t.Fatalf("expected middlewares in config")
	}
	if previewIdx > midIdx {
		t.Fatalf("tako-demo-hello-preview (%d) must appear BEFORE middlewares (%d)\nContent:\n%s", previewIdx, midIdx, s)
	}
}

