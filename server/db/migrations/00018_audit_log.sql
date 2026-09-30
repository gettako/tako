-- +goose Up
-- SQL in section 'Up' is executed when this migration is applied

CREATE TABLE IF NOT EXISTS audit_log (
    id            TEXT PRIMARY KEY,
    actor         TEXT NOT NULL,
    action        TEXT NOT NULL,
    resource_id   TEXT,
    resource_type TEXT,
    metadata      TEXT,
    ip_address    TEXT,
    created_at    DATETIME NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_audit_log_created_at_id ON audit_log(created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_resource ON audit_log(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_action ON audit_log(action);

-- +goose Down
-- SQL in section 'Down' is executed when this migration is rolled back

DROP INDEX IF EXISTS idx_audit_log_action;
DROP INDEX IF EXISTS idx_audit_log_resource;
DROP INDEX IF EXISTS idx_audit_log_created_at_id;
DROP TABLE IF EXISTS audit_log;
