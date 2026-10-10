-- +goose Up
UPDATE deployments SET url = '' WHERE service_id IN (SELECT id FROM services WHERE type = 'database');

-- +goose Down
-- no-op
