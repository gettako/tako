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
    cron_expression TEXT NOT NULL DEFAULT '0 2 * * *',
    retention_count INTEGER NOT NULL DEFAULT 30,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_backup_configs_service_id ON backup_configs(service_id);

CREATE TABLE IF NOT EXISTS backup_records (
    id TEXT PRIMARY KEY,
    service_id TEXT REFERENCES services(id) ON DELETE CASCADE,
    server_id TEXT REFERENCES servers(id) ON DELETE SET NULL,
    backup_type TEXT NOT NULL,
    database_engine TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    file_name TEXT NOT NULL,
    s3_key TEXT NOT NULL,
    file_size_bytes INTEGER NOT NULL DEFAULT 0,
    error_message TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME
);

CREATE INDEX IF NOT EXISTS idx_backup_records_service_id ON backup_records(service_id);
CREATE INDEX IF NOT EXISTS idx_backup_records_status ON backup_records(status);
CREATE INDEX IF NOT EXISTS idx_backup_records_created_at ON backup_records(created_at);

-- +goose Down
-- SQL in section 'Down' is executed when this migration is rolled back

DROP TABLE IF EXISTS backup_records;
DROP TABLE IF EXISTS backup_configs;
