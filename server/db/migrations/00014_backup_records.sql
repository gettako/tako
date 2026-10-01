-- +goose Up
-- SQL in section 'Up' is executed when this migration is applied

CREATE TABLE IF NOT EXISTS backup_records (
    id TEXT PRIMARY KEY,
    service_id TEXT REFERENCES services(id) ON DELETE CASCADE,
    server_id TEXT REFERENCES servers(id) ON DELETE SET NULL,
    s3_destination_id TEXT REFERENCES s3_destinations(id) ON DELETE SET NULL,
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
CREATE INDEX IF NOT EXISTS idx_backup_records_server_id ON backup_records(server_id);
CREATE INDEX IF NOT EXISTS idx_backup_records_s3_destination_id ON backup_records(s3_destination_id);
CREATE INDEX IF NOT EXISTS idx_backup_records_status ON backup_records(status);
CREATE INDEX IF NOT EXISTS idx_backup_records_created_at ON backup_records(created_at);

-- +goose Down
-- SQL in section 'Down' is executed when this migration is rolled back

DROP INDEX IF EXISTS idx_backup_records_created_at;
DROP INDEX IF EXISTS idx_backup_records_status;
DROP INDEX IF EXISTS idx_backup_records_s3_destination_id;
DROP INDEX IF EXISTS idx_backup_records_server_id;
DROP INDEX IF EXISTS idx_backup_records_service_id;
DROP TABLE IF EXISTS backup_records;
