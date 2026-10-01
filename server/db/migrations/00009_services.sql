-- +goose Up
-- SQL in section 'Up' is executed when this migration is applied

CREATE TABLE IF NOT EXISTS services (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    server_id TEXT NOT NULL REFERENCES servers(id) ON DELETE RESTRICT,
    name TEXT NOT NULL,
    service_type TEXT NOT NULL DEFAULT 'web',
    parent_service_id TEXT REFERENCES services(id) ON DELETE CASCADE,
    command TEXT,
    cron_expression TEXT,
    repository TEXT NOT NULL DEFAULT '',
    branch TEXT NOT NULL DEFAULT 'main',
    dockerfile_path TEXT NOT NULL DEFAULT 'Dockerfile',
    internal_port INTEGER NOT NULL DEFAULT 3000,
    published_port INTEGER,
    health_check_path TEXT NOT NULL DEFAULT '/healthz',
    status TEXT NOT NULL DEFAULT 'stopped',
    primary_domain TEXT,
    active_deployment_id TEXT,
    auto_deploy BOOLEAN NOT NULL DEFAULT 1,
    deploy_key_public TEXT,
    deploy_key_private_encrypted BLOB,
    deploy_key_nonce BLOB,
    database_engine TEXT,
    database_version TEXT,
    database_name TEXT,
    database_user TEXT,
    database_password_encrypted BLOB,
    database_password_nonce BLOB,
    volume_name TEXT,
    volume_mount_path TEXT,
    connection_uri TEXT,
    pre_deploy_command TEXT,
    post_deploy_command TEXT,
    compose_file_content TEXT,
    compose_file_path TEXT,
    is_preview BOOLEAN NOT NULL DEFAULT 0,
    pr_number INTEGER,
    preview_status TEXT NOT NULL DEFAULT '',
    last_activity_at DATETIME,
    preview_enabled BOOLEAN NOT NULL DEFAULT 1,
    preview_domain_template TEXT,
    max_previews INTEGER NOT NULL DEFAULT 5,
    github_connection_id TEXT REFERENCES github_connections(id) ON DELETE RESTRICT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_services_project_id ON services(project_id);
CREATE INDEX IF NOT EXISTS idx_services_server_id ON services(server_id);
CREATE INDEX IF NOT EXISTS idx_services_status ON services(status);
CREATE INDEX IF NOT EXISTS idx_services_parent_service_id ON services(parent_service_id);
CREATE INDEX IF NOT EXISTS idx_services_service_type ON services(service_type);
CREATE INDEX IF NOT EXISTS idx_services_database_engine ON services(database_engine);
CREATE INDEX IF NOT EXISTS idx_services_github_connection_id ON services(github_connection_id);
CREATE INDEX IF NOT EXISTS idx_services_preview ON services(is_preview, parent_service_id);
CREATE INDEX IF NOT EXISTS idx_services_pr_number ON services(parent_service_id, pr_number);

-- +goose Down
-- SQL in section 'Down' is executed when this migration is rolled back

DROP INDEX IF EXISTS idx_services_pr_number;
DROP INDEX IF EXISTS idx_services_preview;
DROP INDEX IF EXISTS idx_services_github_connection_id;
DROP INDEX IF EXISTS idx_services_database_engine;
DROP INDEX IF EXISTS idx_services_service_type;
DROP INDEX IF EXISTS idx_services_parent_service_id;
DROP INDEX IF EXISTS idx_services_status;
DROP INDEX IF EXISTS idx_services_server_id;
DROP INDEX IF EXISTS idx_services_project_id;
DROP TABLE IF EXISTS services;
