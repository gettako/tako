-- +goose Up
-- SQL in section 'Up' is executed when this migration is applied

CREATE TABLE IF NOT EXISTS github_connections (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    auth_type TEXT NOT NULL DEFAULT 'pat',
    account_name TEXT NOT NULL,
    avatar_url TEXT,
    token_enc BLOB,
    app_id TEXT,
    app_slug TEXT,
    installation_id TEXT,
    webhook_secret_enc BLOB,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_github_connections_created_at ON github_connections(created_at);

-- +goose Down
-- SQL in section 'Down' is executed when this migration is rolled back

DROP INDEX IF EXISTS idx_github_connections_created_at;
DROP TABLE IF EXISTS github_connections;
