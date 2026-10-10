-- +goose Up
ALTER TABLE services ADD COLUMN swap_limit_mb INTEGER NOT NULL DEFAULT 0;

-- +goose Down
ALTER TABLE services DROP COLUMN swap_limit_mb;
