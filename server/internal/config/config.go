package config

import (
	"os"
)

type Config struct {
	Port        string
	GRPCPort    string
	DBPath      string
	Env         string
	AgentSecret string
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

	return &Config{
		Port:        port,
		GRPCPort:    grpcPort,
		DBPath:      dbPath,
		Env:         env,
		AgentSecret: agentSecret,
	}
}
