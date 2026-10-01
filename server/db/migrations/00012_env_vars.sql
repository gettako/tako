-- +goose Up
-- SQL in section 'Up' is executed when this migration is applied

CREATE TABLE IF NOT EXISTS env_vars (
    id TEXT PRIMARY KEY,
    service_id TEXT NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    type TEXT NOT NULL DEFAULT 'env',
    key TEXT NOT NULL,
    value_encrypted BLOB NOT NULL,
    nonce BLOB NOT NULL,
    is_secret BOOLEAN NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(service_id, type, key)
);

CREATE INDEX IF NOT EXISTS idx_env_vars_service_id ON env_vars(service_id);

-- +goose Down
-- SQL in section 'Down' is executed when this migration is rolled back

DROP INDEX IF EXISTS idx_env_vars_service_id;
DROP TABLE IF EXISTS env_vars;
