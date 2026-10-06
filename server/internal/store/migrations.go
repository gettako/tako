package store

import (
	"database/sql"
	"embed"
	"fmt"

	"github.com/pressly/goose/v3"
)

//go:embed migrations/*.sql
var MigrationFS embed.FS

// Migrate executes all pending Goose migrations embedded in MigrationFS.
func Migrate(db *sql.DB) error {
	goose.SetBaseFS(MigrationFS)
	if err := goose.SetDialect("sqlite3"); err != nil {
		return fmt.Errorf("failed to set goose dialect: %w", err)
	}

	if err := goose.Up(db, "migrations"); err != nil {
		return fmt.Errorf("failed to execute goose migrations: %w", err)
	}

	return nil
}
