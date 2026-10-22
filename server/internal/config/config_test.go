package config

import "testing"

func TestLoadPrefersCanonicalDeploymentVariables(t *testing.T) {
	t.Setenv("TAKO_HTTP_PORT", "9090")
	t.Setenv("TAKO_PORT", "8080")
	t.Setenv("TAKO_INITIAL_ADMIN_EMAIL", "ops@example.com")
	t.Setenv("TAKO_ADMIN_EMAIL", "legacy@example.com")
	t.Setenv("TAKO_INITIAL_ADMIN_PASSWORD", "canonical-password")
	t.Setenv("TAKO_ADMIN_PASSWORD", "legacy-password")

	cfg := Load()

	if cfg.Port != "9090" {
		t.Fatalf("expected TAKO_HTTP_PORT, got %q", cfg.Port)
	}
	if cfg.AdminEmail != "ops@example.com" {
		t.Fatalf("expected canonical admin email, got %q", cfg.AdminEmail)
	}
	if cfg.AdminPassword != "canonical-password" {
		t.Fatalf("expected canonical admin password, got %q", cfg.AdminPassword)
	}
}

func TestLoadFallsBackToLegacyVariables(t *testing.T) {
	t.Setenv("TAKO_HTTP_PORT", "")
	t.Setenv("TAKO_PORT", "8081")
	t.Setenv("TAKO_INITIAL_ADMIN_EMAIL", "")
	t.Setenv("TAKO_ADMIN_EMAIL", "legacy@example.com")
	t.Setenv("TAKO_INITIAL_ADMIN_PASSWORD", "")
	t.Setenv("TAKO_ADMIN_PASSWORD", "legacy-password")

	cfg := Load()

	if cfg.Port != "8081" {
		t.Fatalf("expected legacy TAKO_PORT, got %q", cfg.Port)
	}
	if cfg.AdminEmail != "legacy@example.com" {
		t.Fatalf("expected legacy admin email, got %q", cfg.AdminEmail)
	}
	if cfg.AdminPassword != "legacy-password" {
		t.Fatalf("expected legacy admin password, got %q", cfg.AdminPassword)
	}
}
