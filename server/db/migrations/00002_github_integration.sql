-- +goose Up
-- SQL in section 'Up' is executed when this migration is applied

ALTER TABLE services ADD COLUMN auto_deploy BOOLEAN NOT NULL DEFAULT 1;
ALTER TABLE services ADD COLUMN deploy_key_public TEXT;
ALTER TABLE services ADD COLUMN deploy_key_private_encrypted BLOB;
ALTER TABLE services ADD COLUMN deploy_key_nonce BLOB;
ALTER TABLE deployments ADD COLUMN trigger_type TEXT NOT NULL DEFAULT 'manual';

-- +goose Down
-- SQL in section 'Down' is executed when this migration is rolled back

ALTER TABLE deployments DROP COLUMN trigger_type;
ALTER TABLE services DROP COLUMN deploy_key_nonce;
ALTER TABLE services DROP COLUMN deploy_key_private_encrypted;
ALTER TABLE services DROP COLUMN deploy_key_public;
ALTER TABLE services DROP COLUMN auto_deploy;
