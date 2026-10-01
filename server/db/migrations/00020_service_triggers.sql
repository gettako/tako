-- +goose Up
-- SQL in section 'Up' is executed when this migration is applied

ALTER TABLE services ADD COLUMN trigger_on_push BOOLEAN NOT NULL DEFAULT 1;
ALTER TABLE services ADD COLUMN trigger_on_tag BOOLEAN NOT NULL DEFAULT 0;
ALTER TABLE services ADD COLUMN tag_pattern TEXT NOT NULL DEFAULT '*';

UPDATE services SET trigger_on_push = auto_deploy;

-- +goose Down
-- SQL in section 'Down' is executed when this migration is rolled back

ALTER TABLE services DROP COLUMN tag_pattern;
ALTER TABLE services DROP COLUMN trigger_on_tag;
ALTER TABLE services DROP COLUMN trigger_on_push;
