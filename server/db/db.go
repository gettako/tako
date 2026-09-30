package db

import (
	"database/sql"
	"embed"
	"fmt"
	"log/slog"
	"os"
	"path/filepath"

	"github.com/pressly/goose/v3"
	_ "modernc.org/sqlite"
)

//go:embed migrations/*.sql
var embedMigrations embed.FS

// Open initializes the SQLite database with WAL mode and applies goose migrations.
func Open(dbPath string) (*sql.DB, error) {
	if dir := filepath.Dir(dbPath); dir != "." && dir != "" {
		if err := os.MkdirAll(dir, 0755); err != nil {
			return nil, fmt.Errorf("failed to create db directory: %w", err)
		}
	}

	database, err := sql.Open("sqlite", dbPath)
	if err != nil {
		return nil, fmt.Errorf("failed to open sqlite database: %w", err)
	}
	database.SetMaxOpenConns(1)

	pragmas := []string{
		"PRAGMA journal_mode=WAL;",
		"PRAGMA busy_timeout=5000;",
		"PRAGMA synchronous=NORMAL;",
		"PRAGMA foreign_keys=ON;",
	}

	for _, pragma := range pragmas {
		if _, err := database.Exec(pragma); err != nil {
			database.Close()
			return nil, fmt.Errorf("failed to execute pragma %q: %w", pragma, err)
		}
	}

	var journalMode string
	if err := database.QueryRow("PRAGMA journal_mode;").Scan(&journalMode); err != nil {
		database.Close()
		return nil, fmt.Errorf("failed to verify journal mode: %w", err)
	}
	slog.Info("sqlite initialized", slog.String("path", dbPath), slog.String("journal_mode", journalMode))

	goose.SetBaseFS(embedMigrations)
	if err := goose.SetDialect("sqlite3"); err != nil {
		database.Close()
		return nil, fmt.Errorf("failed to set goose dialect: %w", err)
	}

	if err := goose.Up(database, "migrations"); err != nil {
		database.Close()
		return nil, fmt.Errorf("failed to apply migrations: %w", err)
	}

	slog.Info("database migrations applied successfully")
	return database, nil
}
