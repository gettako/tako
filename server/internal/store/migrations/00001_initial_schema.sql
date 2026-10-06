-- +goose Up
-- Enable foreign keys
PRAGMA foreign_keys = ON;

-- Table: users
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'admin',
    avatar_url TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Table: projects
CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    description TEXT NOT NULL DEFAULT '',
    environment TEXT NOT NULL DEFAULT 'production',
    status TEXT NOT NULL DEFAULT 'healthy',
    tags TEXT NOT NULL DEFAULT '[]',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Table: nodes
CREATE TABLE IF NOT EXISTS nodes (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    ip_address TEXT NOT NULL,
    public_ip TEXT NOT NULL DEFAULT '',
    role TEXT NOT NULL DEFAULT 'worker',
    status TEXT NOT NULL DEFAULT 'offline',
    cpu_total_cores INTEGER NOT NULL DEFAULT 0,
    memory_total_mb INTEGER NOT NULL DEFAULT 0,
    disk_total_gb REAL NOT NULL DEFAULT 0,
    cpu_percent REAL NOT NULL DEFAULT 0,
    memory_used_mb INTEGER NOT NULL DEFAULT 0,
    disk_used_gb REAL NOT NULL DEFAULT 0,
    network_rx_kbps REAL NOT NULL DEFAULT 0,
    network_tx_kbps REAL NOT NULL DEFAULT 0,
    docker_version TEXT NOT NULL DEFAULT '',
    os TEXT NOT NULL DEFAULT '',
    kernel_version TEXT NOT NULL DEFAULT '',
    uptime TEXT NOT NULL DEFAULT '',
    last_heartbeat DATETIME,
    enroll_token TEXT NOT NULL DEFAULT '',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Table: services
CREATE TABLE IF NOT EXISTS services (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    node_id TEXT NOT NULL REFERENCES nodes(id) ON DELETE RESTRICT,
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'app',
    status TEXT NOT NULL DEFAULT 'stopped',
    repository TEXT NOT NULL DEFAULT '',
    branch TEXT NOT NULL DEFAULT 'main',
    commit_hash TEXT NOT NULL DEFAULT '',
    dockerfile TEXT NOT NULL DEFAULT 'Dockerfile',
    build_command TEXT NOT NULL DEFAULT '',
    compose_file TEXT NOT NULL DEFAULT '',
    image TEXT NOT NULL DEFAULT '',
    database_type TEXT NOT NULL DEFAULT '',
    database_version TEXT NOT NULL DEFAULT '',
    connection_string TEXT NOT NULL DEFAULT '',
    ports TEXT NOT NULL DEFAULT '[]',
    replicas INTEGER NOT NULL DEFAULT 1,
    cpu_limit REAL NOT NULL DEFAULT 1.0,
    memory_limit_mb INTEGER NOT NULL DEFAULT 512,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(project_id, slug)
);

-- Table: service_domains
CREATE TABLE IF NOT EXISTS service_domains (
    id TEXT PRIMARY KEY,
    service_id TEXT NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    domain TEXT NOT NULL UNIQUE,
    ssl INTEGER NOT NULL DEFAULT 1,
    is_primary INTEGER NOT NULL DEFAULT 0,
    port INTEGER NOT NULL DEFAULT 80,
    path TEXT NOT NULL DEFAULT '/',
    certificate_type TEXT NOT NULL DEFAULT 'letsencrypt',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Table: service_env_vars
CREATE TABLE IF NOT EXISTS service_env_vars (
    id TEXT PRIMARY KEY,
    service_id TEXT NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    key TEXT NOT NULL,
    value TEXT NOT NULL,
    is_secret INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(service_id, key)
);

-- Table: deployments
CREATE TABLE IF NOT EXISTS deployments (
    id TEXT PRIMARY KEY,
    service_id TEXT NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    commit_hash TEXT NOT NULL DEFAULT '',
    commit_message TEXT NOT NULL DEFAULT '',
    branch TEXT NOT NULL DEFAULT '',
    author TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'queued',
    steps TEXT NOT NULL DEFAULT '[]',
    logs TEXT NOT NULL DEFAULT '',
    duration_ms INTEGER NOT NULL DEFAULT 0,
    started_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    finished_at DATETIME,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Table: audit_logs
CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    actor_id TEXT NOT NULL,
    actor_name TEXT NOT NULL,
    actor_email TEXT NOT NULL,
    action TEXT NOT NULL,
    target_type TEXT NOT NULL,
    target_id TEXT NOT NULL,
    target_name TEXT NOT NULL,
    metadata TEXT NOT NULL DEFAULT '{}',
    ip_address TEXT NOT NULL DEFAULT '',
    timestamp DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_services_project_id ON services(project_id);
CREATE INDEX IF NOT EXISTS idx_services_node_id ON services(node_id);
CREATE INDEX IF NOT EXISTS idx_service_domains_service_id ON service_domains(service_id);
CREATE INDEX IF NOT EXISTS idx_service_env_vars_service_id ON service_env_vars(service_id);
CREATE INDEX IF NOT EXISTS idx_deployments_service_id ON deployments(service_id);
CREATE INDEX IF NOT EXISTS idx_deployments_status ON deployments(status);
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_nodes_status ON nodes(status);

-- +goose Down
DROP TABLE IF EXISTS audit_logs;
DROP TABLE IF EXISTS deployments;
DROP TABLE IF EXISTS service_env_vars;
DROP TABLE IF EXISTS service_domains;
DROP TABLE IF EXISTS services;
DROP TABLE IF EXISTS nodes;
DROP TABLE IF EXISTS projects;
DROP TABLE IF EXISTS users;
