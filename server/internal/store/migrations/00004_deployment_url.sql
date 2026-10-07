-- +goose Up
ALTER TABLE deployments ADD COLUMN url TEXT NOT NULL DEFAULT '';

-- +goose Down
ALTER TABLE deployments DROP COLUMN url;
