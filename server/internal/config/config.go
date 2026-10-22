// Package config parses environment variables into structured master server configurations.
package config

import (
	"os"
)

// Config represents runtime configurations for HTTP/gRPC ports, database paths,
// cluster credentials, and bootstrap administrator accounts.
type Config struct {
	Port          string
	GRPCPort      string
	DBPath        string
	Env           string
	AgentSecret   string
	AdminEmail    string
	AdminPassword string
}

// getEnv returns the environment variable for key or defaultVal if empty.
func getEnv(key, defaultVal string) string {
	if val := os.Getenv(key); val != "" {
		return val
	}
	return defaultVal
}

// getEnvAny returns the first non-empty environment variable in keys, or
// defaultVal when none are set. It keeps older variable names working while
// the deployment templates move to the canonical names.
func getEnvAny(keys []string, defaultVal string) string {
	for _, key := range keys {
		if val := os.Getenv(key); val != "" {
			return val
		}
	}
	return defaultVal
}

// Load reads all Tako server configurations from environment variables.
func Load() *Config {
	return &Config{
		Port:          getEnvAny([]string{"TAKO_HTTP_PORT", "TAKO_PORT"}, "8080"),
		GRPCPort:      getEnv("TAKO_GRPC_PORT", "50051"),
		DBPath:        getEnv("TAKO_DB_PATH", "tako.db"),
		Env:           getEnv("TAKO_ENV", "development"),
		AgentSecret:   os.Getenv("TAKO_AGENT_SECRET"),
		AdminEmail:    getEnvAny([]string{"TAKO_INITIAL_ADMIN_EMAIL", "TAKO_ADMIN_EMAIL"}, "admin@gettako.dev"),
		AdminPassword: getEnvAny([]string{"TAKO_INITIAL_ADMIN_PASSWORD", "TAKO_ADMIN_PASSWORD"}, "admin123456"),
	}
}
