package config

import (
	"os"
)

type Config struct {
	Port                   string
	DBPath                 string
	SecretKey              string
	GRPCPort               string
	Domain                 string
	LocalEnrollmentToken   string
	GitHubAppID            string
	GitHubAppPrivateKey     string
	GitHubAppPrivateKeyPath string
	GitHubAppInstallationID string
	GitHubPAT              string
	GitHubWebhookSecret    string
}

func Load() *Config {
	return &Config{
		Port:                   getEnv("TAKO_PORT", "8080"),
		DBPath:                 getEnv("TAKO_DB_PATH", "./tako.db"),
		SecretKey:              os.Getenv("TAKO_SECRET_KEY"),
		GRPCPort:               getEnv("TAKO_GRPC_PORT", "50051"),
		Domain:                 getEnv("TAKO_DOMAIN", "localhost"),
		LocalEnrollmentToken:   getEnv("TAKO_LOCAL_ENROLLMENT_TOKEN", ""),
		GitHubAppID:            getEnv("TAKO_GITHUB_APP_ID", os.Getenv("GITHUB_APP_ID")),
		GitHubAppPrivateKey:     getEnv("TAKO_GITHUB_APP_PRIVATE_KEY", os.Getenv("GITHUB_APP_PRIVATE_KEY")),
		GitHubAppPrivateKeyPath: getEnv("TAKO_GITHUB_APP_PRIVATE_KEY_PATH", os.Getenv("GITHUB_APP_PRIVATE_KEY_PATH")),
		GitHubAppInstallationID: getEnv("TAKO_GITHUB_APP_INSTALLATION_ID", os.Getenv("GITHUB_APP_INSTALLATION_ID")),
		GitHubPAT:              getEnv("TAKO_GITHUB_PAT", getEnv("GITHUB_PAT", os.Getenv("GITHUB_TOKEN"))),
		GitHubWebhookSecret:    getEnv("TAKO_GITHUB_WEBHOOK_SECRET", os.Getenv("GITHUB_WEBHOOK_SECRET")),
	}
}

func getEnv(key, fallback string) string {
	if val := os.Getenv(key); val != "" {
		return val
	}
	return fallback
}
