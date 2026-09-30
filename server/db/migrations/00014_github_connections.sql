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
    installation_id TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_github_connections_created_at ON github_connections(created_at);

ALTER TABLE services ADD COLUMN github_connection_id TEXT REFERENCES github_connections(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_services_github_connection_id ON services(github_connection_id);

-- +goose Down
-- SQL in section 'Down' is executed when this migration is rolled back

DROP INDEX IF EXISTS idx_services_github_connection_id;
ALTER TABLE services DROP COLUMN github_connection_id;
DROP TABLE IF EXISTS github_connections;
