package deploy

import (
	"os"
	"strings"
	"testing"

	"gopkg.in/yaml.v3"
)

type composeConfig struct {
	Services map[string]struct {
		Ports []string `yaml:"ports"`
	} `yaml:"services"`
}

func TestComposePortsBindingLoopback(t *testing.T) {
	data, err := os.ReadFile("compose/docker-compose.yml")
	if err != nil {
		t.Fatalf("failed to read docker-compose.yml: %v", err)
	}

	var cfg composeConfig
	if err := yaml.Unmarshal(data, &cfg); err != nil {
		t.Fatalf("failed to unmarshal compose yaml: %v", err)
	}

	for svcName, svc := range cfg.Services {
		for _, portEntry := range svc.Ports {
			// Public ingress ports 80/443 on traefik are allowed to bind 0.0.0.0
			if svcName == "traefik" {
				continue
			}
			// Cluster gRPC port 50051 on server is intended for remote worker agents
			if strings.Contains(portEntry, "50051") {
				continue
			}

			// Internal HTTP ports (console 3000, server 8080) MUST be bound to 127.0.0.1
			if !strings.HasPrefix(portEntry, "127.0.0.1:") {
				t.Errorf("service %q port entry %q is not bound to 127.0.0.1", svcName, portEntry)
			}
		}
	}
}

func TestInstallScriptPortsBindingLoopback(t *testing.T) {
	data, err := os.ReadFile("install.sh")
	if err != nil {
		t.Fatalf("failed to read install.sh: %v", err)
	}

	content := string(data)
	if strings.Contains(content, `"\${TAKO_CONSOLE_PORT:-3000}:3000"`) {
		t.Error("install.sh contains un-scoped TAKO_CONSOLE_PORT without 127.0.0.1 prefix")
	}
	if strings.Contains(content, `"\${TAKO_PORT:-8080}:8080"`) {
		t.Error("install.sh contains un-scoped TAKO_PORT without 127.0.0.1 prefix")
	}
	if !strings.Contains(content, `"127.0.0.1:\${TAKO_CONSOLE_PORT:-3000}:3000"`) {
		t.Error("install.sh missing 127.0.0.1 binding for console port")
	}
	if !strings.Contains(content, `"127.0.0.1:\${TAKO_PORT:-8080}:8080"`) {
		t.Error("install.sh missing 127.0.0.1 binding for server port")
	}
}
