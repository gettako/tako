-- +goose Up
-- SQL in section 'Up' is executed when this migration is applied

ALTER TABLE services ADD COLUMN is_preview BOOLEAN NOT NULL DEFAULT 0;
ALTER TABLE services ADD COLUMN pr_number INTEGER;
ALTER TABLE services ADD COLUMN preview_status TEXT NOT NULL DEFAULT '';
ALTER TABLE services ADD COLUMN last_activity_at DATETIME;
ALTER TABLE services ADD COLUMN preview_enabled BOOLEAN NOT NULL DEFAULT 1;
ALTER TABLE services ADD COLUMN preview_domain_template TEXT;
ALTER TABLE services ADD COLUMN max_previews INTEGER NOT NULL DEFAULT 5;

CREATE INDEX IF NOT EXISTS idx_services_preview ON services(is_preview, parent_service_id);
CREATE INDEX IF NOT EXISTS idx_services_pr_number ON services(parent_service_id, pr_number);

-- +goose Down
-- SQL in section 'Down' is rolled back

DROP INDEX IF EXISTS idx_services_pr_number;
DROP INDEX IF EXISTS idx_services_preview;
ALTER TABLE services DROP COLUMN max_previews;
ALTER TABLE services DROP COLUMN preview_domain_template;
ALTER TABLE services DROP COLUMN preview_enabled;
ALTER TABLE services DROP COLUMN last_activity_at;
ALTER TABLE services DROP COLUMN preview_status;
ALTER TABLE services DROP COLUMN pr_number;
ALTER TABLE services DROP COLUMN is_preview;
