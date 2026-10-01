-- +goose Up
-- SQL in section 'Up' is executed when this migration is applied

CREATE TABLE IF NOT EXISTS s3_destinations (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    endpoint TEXT NOT NULL,
    region TEXT NOT NULL DEFAULT 'us-east-1',
    bucket_name TEXT NOT NULL,
    access_key_id TEXT NOT NULL,
    secret_access_key_enc BLOB NOT NULL,
    use_path_style BOOLEAN NOT NULL DEFAULT 0,
    is_default BOOLEAN NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_s3_destinations_is_default ON s3_destinations(is_default);
CREATE INDEX IF NOT EXISTS idx_s3_destinations_created_at ON s3_destinations(created_at);

-- +goose Down
-- SQL in section 'Down' is executed when this migration is rolled back

DROP INDEX IF EXISTS idx_s3_destinations_created_at;
DROP INDEX IF EXISTS idx_s3_destinations_is_default;
DROP TABLE IF EXISTS s3_destinations;
