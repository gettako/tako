-- +goose Up
-- Table: project_env_vars
CREATE TABLE IF NOT EXISTS project_env_vars (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    key TEXT NOT NULL,
    value TEXT NOT NULL,
    is_secret INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(project_id, key)
);
CREATE INDEX IF NOT EXISTS idx_project_env_vars_project_id ON project_env_vars(project_id);

-- Alter services for Maintenance Mode, Health Checks, and Registry
ALTER TABLE services ADD COLUMN maintenance_mode INTEGER NOT NULL DEFAULT 0;
ALTER TABLE services ADD COLUMN health_check_path TEXT NOT NULL DEFAULT '/';
ALTER TABLE services ADD COLUMN health_check_port INTEGER NOT NULL DEFAULT 0;
ALTER TABLE services ADD COLUMN health_check_interval INTEGER NOT NULL DEFAULT 10;
ALTER TABLE services ADD COLUMN health_check_timeout INTEGER NOT NULL DEFAULT 5;
ALTER TABLE services ADD COLUMN health_check_retries INTEGER NOT NULL DEFAULT 3;
ALTER TABLE services ADD COLUMN health_check_initial_delay INTEGER NOT NULL DEFAULT 10;
ALTER TABLE services ADD COLUMN registry_id TEXT NOT NULL DEFAULT '';

-- Table: cron_jobs
CREATE TABLE IF NOT EXISTS cron_jobs (
    id TEXT PRIMARY KEY,
    service_id TEXT NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    schedule TEXT NOT NULL,
    command TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_cron_jobs_service_id ON cron_jobs(service_id);

-- Table: cron_job_runs
CREATE TABLE IF NOT EXISTS cron_job_runs (
    id TEXT PRIMARY KEY,
    cron_job_id TEXT NOT NULL REFERENCES cron_jobs(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'running',
    exit_code INTEGER NOT NULL DEFAULT 0,
    output TEXT NOT NULL DEFAULT '',
    started_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    finished_at DATETIME
);
CREATE INDEX IF NOT EXISTS idx_cron_job_runs_cron_job_id ON cron_job_runs(cron_job_id);

-- Table: registries (Private Docker Registries)
CREATE TABLE IF NOT EXISTS registries (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    server_url TEXT NOT NULL,
    username TEXT NOT NULL,
    password TEXT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Table: node_retention_policies
CREATE TABLE IF NOT EXISTS node_retention_policies (
    node_id TEXT PRIMARY KEY REFERENCES nodes(id) ON DELETE CASCADE,
    keep_image_versions INTEGER NOT NULL DEFAULT 3,
    auto_prune_threshold_percent REAL NOT NULL DEFAULT 85.0,
    prune_build_cache INTEGER NOT NULL DEFAULT 1,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- +goose Down
DROP TABLE IF EXISTS node_retention_policies;
DROP TABLE IF EXISTS registries;
DROP TABLE IF EXISTS cron_job_runs;
DROP TABLE IF EXISTS cron_jobs;
DROP TABLE IF EXISTS project_env_vars;
