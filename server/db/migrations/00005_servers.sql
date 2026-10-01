-- +goose Up
-- SQL in section 'Up' is executed when this migration is applied

CREATE TABLE IF NOT EXISTS servers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    host TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    agent_version TEXT NOT NULL DEFAULT '',
    docker_version TEXT NOT NULL DEFAULT '',
    os_info TEXT NOT NULL DEFAULT '',
    uptime_seconds INTEGER NOT NULL DEFAULT 0,
    cpu_percent REAL NOT NULL DEFAULT 0.0,
    ram_percent REAL NOT NULL DEFAULT 0.0,
    disk_percent REAL NOT NULL DEFAULT 0.0,
    ram_total_bytes INTEGER NOT NULL DEFAULT 0,
    ram_used_bytes INTEGER NOT NULL DEFAULT 0,
    enrollment_token TEXT,
    token_expires_at DATETIME,
    node_secret_hash TEXT,
    node_secret TEXT,
    last_heartbeat_at DATETIME,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_servers_status ON servers(status);
CREATE INDEX IF NOT EXISTS idx_servers_enrollment_token ON servers(enrollment_token);

-- +goose Down
-- SQL in section 'Down' is executed when this migration is rolled back

DROP INDEX IF EXISTS idx_servers_enrollment_token;
DROP INDEX IF EXISTS idx_servers_status;
DROP TABLE IF EXISTS servers;
