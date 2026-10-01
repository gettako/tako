-- +goose Up
-- SQL in section 'Up' is executed when this migration is applied

CREATE TABLE IF NOT EXISTS backup_configs (
    id TEXT PRIMARY KEY,
    service_id TEXT REFERENCES services(id) ON DELETE CASCADE,
    enabled BOOLEAN NOT NULL DEFAULT 1,
    endpoint_url TEXT NOT NULL DEFAULT '',
    bucket TEXT NOT NULL DEFAULT '',
    region TEXT NOT NULL DEFAULT 'us-east-1',
    access_key TEXT NOT NULL DEFAULT '',
    secret_key_encrypted BLOB,
    secret_key_nonce BLOB,
    s3_destination_id TEXT REFERENCES s3_destinations(id) ON DELETE RESTRICT,
    cron_expression TEXT NOT NULL DEFAULT '0 2 * * *',
    retention_count INTEGER NOT NULL DEFAULT 30,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_backup_configs_service_id ON backup_configs(service_id);
CREATE INDEX IF NOT EXISTS idx_backup_configs_s3_destination_id ON backup_configs(s3_destination_id);

-- +goose Down
-- SQL in section 'Down' is executed when this migration is rolled back

DROP INDEX IF EXISTS idx_backup_configs_s3_destination_id;
DROP INDEX IF EXISTS idx_backup_configs_service_id;
DROP TABLE IF EXISTS backup_configs;
