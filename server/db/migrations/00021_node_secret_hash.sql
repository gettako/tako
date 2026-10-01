-- +goose Up
-- SQL in section 'Up' is executed when this migration is applied

ALTER TABLE servers ADD COLUMN node_secret_hash TEXT;

-- +goose Down
-- SQL in section 'Down' is executed when this migration is rolled back
