package config

import (
	"os"
	"testing"
)

func TestLoadDefaults(t *testing.T) {
	os.Unsetenv("TAKO_PORT")
	os.Unsetenv("TAKO_DB_PATH")
	os.Unsetenv("TAKO_SECRET_KEY")
	os.Unsetenv("TAKO_GRPC_PORT")
	os.Unsetenv("TAKO_DOMAIN")

	cfg := Load()

	if cfg.Port != "8080" {
		t.Errorf("expected default Port 8080, got %s", cfg.Port)
	}
	if cfg.DBPath != "./tako.db" {
		t.Errorf("expected default DBPath ./tako.db, got %s", cfg.DBPath)
	}
	if cfg.GRPCPort != "50051" {
		t.Errorf("expected default GRPCPort 50051, got %s", cfg.GRPCPort)
	}
	if cfg.Domain != "localhost" {
		t.Errorf("expected default Domain localhost, got %s", cfg.Domain)
	}
}

func TestLoadCustom(t *testing.T) {
	t.Setenv("TAKO_PORT", "9090")
	t.Setenv("TAKO_DB_PATH", "/tmp/test.db")
	t.Setenv("TAKO_SECRET_KEY", "supersecret")
	t.Setenv("TAKO_GRPC_PORT", "50052")
	t.Setenv("TAKO_DOMAIN", "example.com")

	cfg := Load()

	if cfg.Port != "9090" {
		t.Errorf("expected Port 9090, got %s", cfg.Port)
	}
	if cfg.DBPath != "/tmp/test.db" {
		t.Errorf("expected DBPath /tmp/test.db, got %s", cfg.DBPath)
	}
	if cfg.SecretKey != "supersecret" {
		t.Errorf("expected SecretKey supersecret, got %s", cfg.SecretKey)
	}
	if cfg.GRPCPort != "50052" {
		t.Errorf("expected GRPCPort 50052, got %s", cfg.GRPCPort)
	}
	if cfg.Domain != "example.com" {
		t.Errorf("expected Domain example.com, got %s", cfg.Domain)
	}
}
