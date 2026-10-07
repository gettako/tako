-- +goose Up
-- Table: cluster_settings
CREATE TABLE IF NOT EXISTS cluster_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Table: node_metrics
CREATE TABLE IF NOT EXISTS node_metrics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    node_id TEXT NOT NULL,
    cpu_percent REAL NOT NULL DEFAULT 0.0,
    memory_used_mb INTEGER NOT NULL DEFAULT 0,
    memory_total_mb INTEGER NOT NULL DEFAULT 0,
    disk_used_gb INTEGER NOT NULL DEFAULT 0,
    disk_total_gb INTEGER NOT NULL DEFAULT 0,
    network_rx_kbps REAL NOT NULL DEFAULT 0.0,
    network_tx_kbps REAL NOT NULL DEFAULT 0.0,
    recorded_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_node_metrics_node_recorded ON node_metrics(node_id, recorded_at);
CREATE INDEX IF NOT EXISTS idx_node_metrics_recorded_at ON node_metrics(recorded_at);

-- +goose Down
DROP TABLE IF EXISTS node_metrics;
DROP TABLE IF EXISTS cluster_settings;
