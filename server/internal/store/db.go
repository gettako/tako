package store

import (
	"database/sql"
	"fmt"
	"net/url"
	"os"
	"path/filepath"
	"strings"

	_ "modernc.org/sqlite"
)

// OpenDB opens a pure-Go SQLite connection configured with WAL and concurrency pragmas.
func OpenDB(path string) (*sql.DB, error) {
	if path != ":memory:" && !strings.HasPrefix(path, "file:") {
		dir := filepath.Dir(path)
		if dir != "." && dir != "/" {
			if err := os.MkdirAll(dir, 0o755); err != nil {
				return nil, fmt.Errorf("failed to create db directory: %w", err)
			}
		}
	}

	dsn := path
	if !strings.Contains(path, "?") && path != ":memory:" {
		q := url.Values{}
		q.Add("_pragma", "busy_timeout(5000)")
		q.Add("_pragma", "journal_mode(WAL)")
		q.Add("_pragma", "foreign_keys(ON)")
		q.Add("_pragma", "synchronous(NORMAL)")
		dsn = fmt.Sprintf("%s?%s", path, q.Encode())
	}

	db, err := sql.Open("sqlite", dsn)
	if err != nil {
		return nil, fmt.Errorf("failed to open sqlite database: %w", err)
	}

	// Fallback/direct verification pragmas
	pragmas := []string{
		"PRAGMA busy_timeout = 5000;",
		"PRAGMA foreign_keys = ON;",
		"PRAGMA synchronous = NORMAL;",
	}
	if path != ":memory:" {
		pragmas = append([]string{"PRAGMA journal_mode = WAL;"}, pragmas...)
	}

	for _, p := range pragmas {
		if _, err := db.Exec(p); err != nil {
			db.Close()
			return nil, fmt.Errorf("failed to apply pragma %q: %w", p, err)
		}
	}

	db.SetMaxOpenConns(10)
	db.SetMaxIdleConns(5)

	if err := db.Ping(); err != nil {
		db.Close()
		return nil, fmt.Errorf("failed to ping database: %w", err)
	}

	return db, nil
}
