-- +goose Up
ALTER TABLE services ADD COLUMN auto_scaling_enabled INTEGER NOT NULL DEFAULT 0;
ALTER TABLE services ADD COLUMN min_replicas INTEGER NOT NULL DEFAULT 1;
ALTER TABLE services ADD COLUMN max_replicas INTEGER NOT NULL DEFAULT 5;
ALTER TABLE services ADD COLUMN target_cpu_percent REAL NOT NULL DEFAULT 80.0;

-- +goose Down
ALTER TABLE services DROP COLUMN auto_scaling_enabled;
ALTER TABLE services DROP COLUMN min_replicas;
ALTER TABLE services DROP COLUMN max_replicas;
ALTER TABLE services DROP COLUMN target_cpu_percent;
