-- +goose Up
-- SQL in section 'Up' is executed when this migration is applied

CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    two_factor_enabled BOOLEAN NOT NULL DEFAULT 0,
    two_factor_secret TEXT,
    recovery_codes TEXT,
    passkeys_enabled BOOLEAN NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at DATETIME NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);

CREATE TABLE IF NOT EXISTS passkeys (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL DEFAULT 'Passkey',
    credential BLOB NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_used_at DATETIME
);

CREATE INDEX IF NOT EXISTS idx_passkeys_user_id ON passkeys(user_id);

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
    enrollment_token TEXT,
    token_expires_at DATETIME,
    node_secret TEXT,
    last_heartbeat_at DATETIME,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_servers_status ON servers(status);
CREATE INDEX IF NOT EXISTS idx_servers_enrollment_token ON servers(enrollment_token);

CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS services (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    server_id TEXT NOT NULL REFERENCES servers(id) ON DELETE RESTRICT,
    name TEXT NOT NULL,
    repository TEXT NOT NULL,
    branch TEXT NOT NULL DEFAULT 'main',
    dockerfile_path TEXT NOT NULL DEFAULT 'Dockerfile',
    internal_port INTEGER NOT NULL DEFAULT 3000,
    health_check_path TEXT NOT NULL DEFAULT '/healthz',
    status TEXT NOT NULL DEFAULT 'stopped',
    primary_domain TEXT,
    active_deployment_id TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_services_project_id ON services(project_id);
CREATE INDEX IF NOT EXISTS idx_services_server_id ON services(server_id);
CREATE INDEX IF NOT EXISTS idx_services_status ON services(status);

CREATE TABLE IF NOT EXISTS deployments (
    id TEXT PRIMARY KEY,
    service_id TEXT NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'queued',
    commit_sha TEXT NOT NULL DEFAULT '',
    commit_message TEXT NOT NULL DEFAULT '',
    commit_author TEXT NOT NULL DEFAULT '',
    branch TEXT NOT NULL DEFAULT 'main',
    image_tag TEXT,
    build_steps TEXT,
    error_trace TEXT,
    started_at DATETIME,
    finished_at DATETIME,
    duration_seconds INTEGER,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_deployments_service_id ON deployments(service_id);
CREATE INDEX IF NOT EXISTS idx_deployments_status ON deployments(status);
CREATE INDEX IF NOT EXISTS idx_deployments_created_at ON deployments(created_at);

CREATE TABLE IF NOT EXISTS domains (
    id TEXT PRIMARY KEY,
    service_id TEXT NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    domain TEXT NOT NULL UNIQUE,
    port INTEGER NOT NULL DEFAULT 3000,
    ssl_status TEXT NOT NULL DEFAULT 'pending',
    ssl_error TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_domains_service_id ON domains(service_id);
CREATE INDEX IF NOT EXISTS idx_domains_domain ON domains(domain);

CREATE TABLE IF NOT EXISTS env_vars (
    id TEXT PRIMARY KEY,
    service_id TEXT NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    type TEXT NOT NULL DEFAULT 'env',
    key TEXT NOT NULL,
    value_encrypted BLOB NOT NULL,
    nonce BLOB NOT NULL,
    is_secret BOOLEAN NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(service_id, type, key)
);

CREATE INDEX IF NOT EXISTS idx_env_vars_service_id ON env_vars(service_id);

-- +goose Down
-- SQL in section 'Down' is executed when this migration is rolled back

DROP TABLE IF EXISTS env_vars;
DROP TABLE IF EXISTS domains;
DROP TABLE IF EXISTS deployments;
DROP TABLE IF EXISTS services;
DROP TABLE IF EXISTS projects;
DROP TABLE IF EXISTS servers;
DROP TABLE IF EXISTS passkeys;
DROP TABLE IF EXISTS sessions;
DROP TABLE IF EXISTS users;
