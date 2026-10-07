-- +goose Up
ALTER TABLE services ADD COLUMN publish_to_host INTEGER NOT NULL DEFAULT 1;

-- +goose Down
ALTER TABLE services DROP COLUMN publish_to_host;
