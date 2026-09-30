-- +goose Up
ALTER TABLE services ADD COLUMN pre_deploy_command TEXT;
ALTER TABLE services ADD COLUMN post_deploy_command TEXT;

-- +goose Down
ALTER TABLE services DROP COLUMN post_deploy_command;
ALTER TABLE services DROP COLUMN pre_deploy_command;
