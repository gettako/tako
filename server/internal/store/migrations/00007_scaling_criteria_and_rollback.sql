-- +goose Up
ALTER TABLE services ADD COLUMN auto_rollback_enabled INTEGER NOT NULL DEFAULT 1;
ALTER TABLE services ADD COLUMN auto_scaling_metric TEXT NOT NULL DEFAULT 'cpu';
ALTER TABLE services ADD COLUMN target_memory_percent REAL NOT NULL DEFAULT 80.0;
ALTER TABLE services ADD COLUMN scale_down_cpu_percent REAL NOT NULL DEFAULT 25.0;
ALTER TABLE services ADD COLUMN cooldown_seconds INTEGER NOT NULL DEFAULT 60;

-- +goose Down
ALTER TABLE services DROP COLUMN auto_rollback_enabled;
ALTER TABLE services DROP COLUMN auto_scaling_metric;
ALTER TABLE services DROP COLUMN target_memory_percent;
ALTER TABLE services DROP COLUMN scale_down_cpu_percent;
ALTER TABLE services DROP COLUMN cooldown_seconds;
