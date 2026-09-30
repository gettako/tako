-- +goose Up
-- SQL in section 'Up' is executed when this migration is applied

ALTER TABLE services ADD COLUMN compose_file_content TEXT;
ALTER TABLE services ADD COLUMN compose_file_path TEXT;

-- +goose Down
-- SQL in section 'Down' is executed when this migration is rolled back

ALTER TABLE services DROP COLUMN compose_file_path;
ALTER TABLE services DROP COLUMN compose_file_content;
