-- +goose Up
-- SQL in section 'Up' is executed when this migration is applied

ALTER TABLE services ADD COLUMN service_type TEXT NOT NULL DEFAULT 'web';
ALTER TABLE services ADD COLUMN parent_service_id TEXT REFERENCES services(id) ON DELETE CASCADE;
ALTER TABLE services ADD COLUMN command TEXT;
ALTER TABLE services ADD COLUMN cron_expression TEXT;

CREATE INDEX IF NOT EXISTS idx_services_parent_service_id ON services(parent_service_id);
CREATE INDEX IF NOT EXISTS idx_services_service_type ON services(service_type);

-- +goose Down
-- SQL in section 'Down' is executed when this migration is rolled back

ALTER TABLE services DROP COLUMN cron_expression;
ALTER TABLE services DROP COLUMN command;
ALTER TABLE services DROP COLUMN parent_service_id;
ALTER TABLE services DROP COLUMN service_type;
