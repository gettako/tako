-- +goose Up
-- SQL in section 'Up' is executed when this migration is applied

ALTER TABLE backup_records ADD COLUMN s3_destination_id TEXT REFERENCES s3_destinations(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_backup_records_s3_destination_id ON backup_records(s3_destination_id);

-- +goose Down
-- SQL in section 'Down' is executed when this migration is rolled back

DROP INDEX IF EXISTS idx_backup_records_s3_destination_id;
ALTER TABLE backup_records DROP COLUMN s3_destination_id;
