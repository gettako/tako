package traefik

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/docker/docker/api/types/container"
	"github.com/docker/docker/client"
	"gopkg.in/yaml.v3"
)

type CustomConfigManager struct {
	customConfigPath string
	staticConfigPath string
	dockerCli        client.APIClient
}

func NewCustomConfigManager(customConfigPath, staticConfigPath string, dockerCli client.APIClient) *CustomConfigManager {
	if customConfigPath == "" {
		customConfigPath = "/etc/traefik/dynamic/custom.yaml"
	}
	if staticConfigPath == "" {
		staticConfigPath = "/etc/traefik/traefik.yaml"
	}
	return &CustomConfigManager{
		customConfigPath: customConfigPath,
		staticConfigPath: staticConfigPath,
		dockerCli:        dockerCli,
	}
}

func (m *CustomConfigManager) GetConfigs() (customYAML string, staticYAML string, err error) {
	if data, err := os.ReadFile(m.customConfigPath); err == nil {
		customYAML = string(data)
	} else if !os.IsNotExist(err) {
		return "", "", fmt.Errorf("failed to read custom traefik config: %w", err)
	}

	if data, err := os.ReadFile(m.staticConfigPath); err == nil {
		staticYAML = string(data)
	} else if !os.IsNotExist(err) {
		return "", "", fmt.Errorf("failed to read static traefik config: %w", err)
	}

	return customYAML, staticYAML, nil
}

func (m *CustomConfigManager) SaveCustomConfig(rawYAML string) error {
	rawYAML = strings.TrimSpace(rawYAML)
	if rawYAML != "" {
		var validate map[string]interface{}
		if err := yaml.Unmarshal([]byte(rawYAML), &validate); err != nil {
			return fmt.Errorf("invalid YAML syntax: %w", err)
		}
		rawYAML += "\n"
	}

	dir := filepath.Dir(m.customConfigPath)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return fmt.Errorf("failed to create custom config directory: %w", err)
	}

	tmpPath := m.customConfigPath + ".tmp"
	if err := os.WriteFile(tmpPath, []byte(rawYAML), 0644); err != nil {
		return fmt.Errorf("failed to write temp custom config: %w", err)
	}

	if err := os.Rename(tmpPath, m.customConfigPath); err != nil {
		return fmt.Errorf("failed to atomically update custom config: %w", err)
	}

	return nil
}

func (m *CustomConfigManager) RestartTraefik(ctx context.Context) error {
	if m.dockerCli == nil {
		return fmt.Errorf("docker client unavailable")
	}

	containers, err := m.dockerCli.ContainerList(ctx, container.ListOptions{All: true})
	if err != nil {
		return fmt.Errorf("failed to list containers: %w", err)
	}

	var traefikID string
	for _, c := range containers {
		for _, name := range c.Names {
			trimmed := strings.TrimPrefix(name, "/")
			if trimmed == "tako-traefik" || strings.Contains(trimmed, "traefik") {
				traefikID = c.ID
				break
			}
		}
		if traefikID != "" {
			break
		}
	}

	if traefikID == "" {
		return fmt.Errorf("traefik container tako-traefik not found on host")
	}

	timeoutSec := 15
	if err := m.dockerCli.ContainerRestart(ctx, traefikID, container.StopOptions{Timeout: &timeoutSec}); err != nil {
		return fmt.Errorf("failed to restart traefik container: %w", err)
	}

	return nil
}
