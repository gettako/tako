package store

import (
	"context"
	"database/sql"
	"fmt"
	"log"

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
