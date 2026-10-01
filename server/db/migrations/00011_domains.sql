-- +goose Up
-- SQL in section 'Up' is executed when this migration is applied

CREATE TABLE IF NOT EXISTS domains (
    id TEXT PRIMARY KEY,
    service_id TEXT NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    domain TEXT NOT NULL,
    port INTEGER NOT NULL DEFAULT 3000,
    path_prefix TEXT NOT NULL DEFAULT '',
    strip_prefix BOOLEAN NOT NULL DEFAULT 0,
    is_canonical BOOLEAN NOT NULL DEFAULT 0,
    redirect_mode TEXT NOT NULL DEFAULT 'none',
    auth_enabled BOOLEAN NOT NULL DEFAULT 0,
    auth_user TEXT NOT NULL DEFAULT '',
    auth_password TEXT NOT NULL DEFAULT '',
    entrypoints TEXT NOT NULL DEFAULT 'web,websecure',
    ssl_resolver TEXT NOT NULL DEFAULT 'letsencrypt',
    ssl_status TEXT NOT NULL DEFAULT 'pending',
    ssl_error TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_domains_service_id ON domains(service_id);
CREATE INDEX IF NOT EXISTS idx_domains_domain ON domains(domain);
CREATE UNIQUE INDEX IF NOT EXISTS idx_domains_domain_path ON domains(domain, path_prefix);

-- +goose Down
-- SQL in section 'Down' is executed when this migration is rolled back

DROP INDEX IF EXISTS idx_domains_domain_path;
DROP INDEX IF EXISTS idx_domains_domain;
DROP INDEX IF EXISTS idx_domains_service_id;
DROP TABLE IF EXISTS domains;
