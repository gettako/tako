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

func Load() *Config {
	port := os.Getenv("TAKO_PORT")
	if port == "" {
		port = "8080"
	}

	grpcPort := os.Getenv("TAKO_GRPC_PORT")
	if grpcPort == "" {
		grpcPort = "50051"
	}

	dbPath := os.Getenv("TAKO_DB_PATH")
	if dbPath == "" {
		dbPath = "tako.db"
	}

	env := os.Getenv("TAKO_ENV")
	if env == "" {
		env = "development"
	}

	agentSecret := os.Getenv("TAKO_AGENT_SECRET")

	adminEmail := os.Getenv("TAKO_ADMIN_EMAIL")
	if adminEmail == "" {
		adminEmail = "admin@gettako.dev"
	}

	adminPassword := os.Getenv("TAKO_ADMIN_PASSWORD")
	if adminPassword == "" {
		adminPassword = "admin123456"
	}

	return &Config{
		Port:          port,
		GRPCPort:      grpcPort,
		DBPath:        dbPath,
		Env:           env,
		AgentSecret:   agentSecret,
		AdminEmail:    adminEmail,
		AdminPassword: adminPassword,
	}
}
