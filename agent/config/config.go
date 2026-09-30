package config

import "os"

type Config struct {
	ServerURL       string
	EnrollmentToken string
	ConfigDir       string
	DockerHost        string
	TraefikDynamicDir string
	TraefikAcmePath   string
}

func Load() *Config {
	serverURL := os.Getenv("TAKO_SERVER_URL")
	if serverURL == "" {
		serverURL = "http://localhost:50051"
	}

	configDir := os.Getenv("TAKO_CONFIG_DIR")
	if configDir == "" {
		configDir = "/etc/tako"
	}

	traefikDir := os.Getenv("TAKO_TRAEFIK_DYNAMIC_DIR")
	if traefikDir == "" {
		traefikDir = "/etc/traefik/dynamic"
	}

	acmePath := os.Getenv("TAKO_TRAEFIK_ACME_PATH")
	if acmePath == "" {
		acmePath = "/etc/traefik/acme/acme.json"
	}

	return &Config{
		ServerURL:         serverURL,
		EnrollmentToken:   os.Getenv("TAKO_ENROLLMENT_TOKEN"),
		ConfigDir:         configDir,
		DockerHost:        os.Getenv("DOCKER_HOST"),
		TraefikDynamicDir: traefikDir,
		TraefikAcmePath:   acmePath,
	}
}
