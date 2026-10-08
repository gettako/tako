package config

import (
	"os"
)

type Config struct {
	Port        string
	GRPCPort    string
	DBPath      string
	Env         string
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

func Load() *Config {
	return &Config{
		Port:          getEnv("TAKO_PORT", "8080"),
		GRPCPort:      getEnv("TAKO_GRPC_PORT", "50051"),
		DBPath:        getEnv("TAKO_DB_PATH", "tako.db"),
		Env:           getEnv("TAKO_ENV", "development"),
		AgentSecret:   os.Getenv("TAKO_AGENT_SECRET"),
		AdminEmail:    getEnv("TAKO_ADMIN_EMAIL", "admin@gettako.dev"),
		AdminPassword: getEnv("TAKO_ADMIN_PASSWORD", "admin123456"),
	}
}
