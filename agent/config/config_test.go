package config

import (
	"os"
	"testing"
)

func TestLoadDefaults(t *testing.T) {
	os.Unsetenv("TAKO_SERVER_URL")
	os.Unsetenv("TAKO_ENROLLMENT_TOKEN")
	os.Unsetenv("TAKO_CONFIG_DIR")
	os.Unsetenv("DOCKER_HOST")

	cfg := Load()
	if cfg.ServerURL != "http://localhost:50051" {
		t.Fatalf("expected default server url, got %s", cfg.ServerURL)
	}
	if cfg.ConfigDir != "/etc/tako" {
		t.Fatalf("expected default config dir, got %s", cfg.ConfigDir)
	}
}

func TestLoadEnvOverrides(t *testing.T) {
	t.Setenv("TAKO_SERVER_URL", "https://custom.tako:50051")
	t.Setenv("TAKO_ENROLLMENT_TOKEN", "token-123")
	t.Setenv("TAKO_CONFIG_DIR", "/tmp/tako")
	t.Setenv("DOCKER_HOST", "unix:///tmp/docker.sock")

	cfg := Load()
	if cfg.ServerURL != "https://custom.tako:50051" {
		t.Fatalf("expected custom server url, got %s", cfg.ServerURL)
	}
	if cfg.EnrollmentToken != "token-123" {
		t.Fatalf("expected token-123, got %s", cfg.EnrollmentToken)
	}
	if cfg.ConfigDir != "/tmp/tako" {
		t.Fatalf("expected /tmp/tako, got %s", cfg.ConfigDir)
	}
	if cfg.DockerHost != "unix:///tmp/docker.sock" {
		t.Fatalf("expected custom docker host, got %s", cfg.DockerHost)
	}
}
