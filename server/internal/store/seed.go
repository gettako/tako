package store

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"os"

	"golang.org/x/crypto/bcrypt"
)

// SeedDefaultAdmin checks if the users table is empty and inserts a default admin user if so.
func SeedDefaultAdmin(ctx context.Context, db *sql.DB, email, password string) error {
	var count int
	if err := db.QueryRowContext(ctx, "SELECT COUNT(*) FROM users").Scan(&count); err != nil {
		return fmt.Errorf("failed to check existing users: %w", err)
	}

	if count > 0 {
		return nil
	}

	if email == "" {
		email = "admin@gettako.dev"
	}
	if password == "" {
		password = "admin123456"
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return fmt.Errorf("failed to hash admin password: %w", err)
	}

	_, err = db.ExecContext(ctx, `
		INSERT INTO users (id, name, email, password_hash, role, avatar_url, created_at, updated_at)
		VALUES (?, ?, ?, ?, 'admin', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
	`, "usr_admin", "Administrator", email, string(hash))
	if err != nil {
		return fmt.Errorf("failed to insert default admin user: %w", err)
	}

	log.Printf("[tako-server] seeded initial admin user: %s", email)
	return nil
}

// SeedDefaultNodes seeds a sample edge node only when explicitly requested (e.g. demo mode).
func SeedDefaultNodes(ctx context.Context, db *sql.DB) error {
	if os.Getenv("TAKO_SEED_DEMO_NODES") != "true" {
		return nil
	}
	var count int
	if err := db.QueryRowContext(ctx, "SELECT COUNT(*) FROM nodes").Scan(&count); err != nil {
		return err
	}
	if count > 0 {
		return nil
	}
	_, err := db.ExecContext(ctx, `
		INSERT INTO nodes (
			id, name, ip_address, public_ip, role, status,
			cpu_total_cores, memory_total_mb, disk_total_gb,
			cpu_percent, memory_used_mb, disk_used_gb,
			network_rx_kbps, network_tx_kbps, uptime,
			docker_version, os, kernel_version, enroll_token,
			last_heartbeat, created_at, updated_at
		) VALUES (
			'node-edge-01', 'leader-node-sgp-1', '142.250.190.46', '142.250.190.46', 'master', 'online',
			8, 16384, 160,
			24.5, 4096, 42,
			1024, 2048, 86400,
			'26.1.4', 'Ubuntu 24.04 LTS', '6.8.0-31-generic', 'tako_enroll_sample_token',
			CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
		)
	`)
	if err != nil {
		return fmt.Errorf("failed to insert default node: %w", err)
	}
	log.Printf("[tako-server] seeded initial edge node: leader-node-sgp-1")
	return nil
}
