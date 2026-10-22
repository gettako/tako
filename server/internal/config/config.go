package config

import (
	"os"
)

type Config struct {
	Port          string
	GRPCPort      string
	DBPath        string
	Env           string
	AgentSecret   string
	AdminEmail    string
	AdminPassword string
}

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
