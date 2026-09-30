-- +goose Up
-- SQL in section 'Up' is executed when this migration is applied

ALTER TABLE github_connections ADD COLUMN app_slug TEXT;
ALTER TABLE github_connections ADD COLUMN webhook_secret_enc BLOB;

-- +goose Down
-- SQL in section 'Down' is rolled back

ALTER TABLE github_connections DROP COLUMN webhook_secret_enc;
ALTER TABLE github_connections DROP COLUMN app_slug;
