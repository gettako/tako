package main

import (
	"strings"
	"testing"
)

func TestInitDockerClientMissingSocket(t *testing.T) {
	_, err := initDockerClient("unix:///nonexistent/tako/docker.sock")
	if err == nil {
		t.Fatal("expected error when docker socket is missing, got nil")
	}
	if !strings.Contains(err.Error(), "docker daemon unreachable") {
		t.Fatalf("expected unreachable socket error message, got: %v", err)
	}
}
