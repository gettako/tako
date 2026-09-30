-- +goose Up
-- Add actual RAM byte counts reported by agent heartbeat.
-- Defaults to 0; populated on next heartbeat from each agent.
ALTER TABLE servers ADD COLUMN ram_total_bytes INTEGER NOT NULL DEFAULT 0;
ALTER TABLE servers ADD COLUMN ram_used_bytes  INTEGER NOT NULL DEFAULT 0;

-- +goose Down
ALTER TABLE servers DROP COLUMN ram_used_bytes;
ALTER TABLE servers DROP COLUMN ram_total_bytes;

