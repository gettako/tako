-- +goose Up
-- SQL in section 'Up' is executed when this migration is applied

ALTER TABLE services ADD COLUMN database_engine TEXT;
ALTER TABLE services ADD COLUMN database_version TEXT;
ALTER TABLE services ADD COLUMN database_name TEXT;
ALTER TABLE services ADD COLUMN database_user TEXT;
ALTER TABLE services ADD COLUMN database_password_encrypted BLOB;
ALTER TABLE services ADD COLUMN database_password_nonce BLOB;
ALTER TABLE services ADD COLUMN volume_name TEXT;
ALTER TABLE services ADD COLUMN volume_mount_path TEXT;
ALTER TABLE services ADD COLUMN connection_uri TEXT;

CREATE INDEX IF NOT EXISTS idx_services_database_engine ON services(database_engine);

-- +goose Down
-- SQL in section 'Down' is executed when this migration is rolled back

DROP INDEX IF EXISTS idx_services_database_engine;
ALTER TABLE services DROP COLUMN connection_uri;
ALTER TABLE services DROP COLUMN volume_mount_path;
ALTER TABLE services DROP COLUMN volume_name;
ALTER TABLE services DROP COLUMN database_password_nonce;
ALTER TABLE services DROP COLUMN database_password_encrypted;
ALTER TABLE services DROP COLUMN database_user;
ALTER TABLE services DROP COLUMN database_name;
ALTER TABLE services DROP COLUMN database_version;
ALTER TABLE services DROP COLUMN database_engine;
