-- +goose Up
-- SQL in section 'Up' is executed when this migration is applied

CREATE TABLE IF NOT EXISTS service_metrics (
    id TEXT PRIMARY KEY,
    service_id TEXT NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    container_id TEXT NOT NULL,
    cpu_percent REAL NOT NULL,
    memory_bytes INTEGER NOT NULL,
    memory_limit_bytes INTEGER NOT NULL,
    network_rx_bytes INTEGER NOT NULL,
    network_tx_bytes INTEGER NOT NULL,
    restart_count INTEGER NOT NULL,
    timestamp INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_service_metrics_service_time ON service_metrics(service_id, timestamp);

CREATE TABLE IF NOT EXISTS service_metrics_rollups (
    id TEXT PRIMARY KEY,
    service_id TEXT NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    cpu_percent_avg REAL NOT NULL,
    cpu_percent_max REAL NOT NULL,
    memory_bytes_avg INTEGER NOT NULL,
    memory_bytes_max INTEGER NOT NULL,
    network_rx_bytes INTEGER NOT NULL,
    network_tx_bytes INTEGER NOT NULL,
    restart_count INTEGER NOT NULL,
    timestamp INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_service_metrics_rollups_service_time ON service_metrics_rollups(service_id, timestamp);

-- +goose Down
-- SQL in section 'Down' is executed when this migration is rolled back

DROP TABLE IF EXISTS service_metrics_rollups;
DROP TABLE IF EXISTS service_metrics;
