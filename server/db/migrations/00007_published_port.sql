-- +goose Up
ALTER TABLE services ADD COLUMN published_port INTEGER;

-- +goose Down
ALTER TABLE services DROP COLUMN published_port;
