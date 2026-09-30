-- +goose Up
-- SQL in section 'Up' is executed when this migration is applied

CREATE TABLE IF NOT EXISTS console_settings (
    id TEXT PRIMARY KEY,
    domain TEXT NOT NULL DEFAULT 'localhost',
    ssl_provider TEXT NOT NULL DEFAULT 'letsencrypt',
    force_https BOOLEAN NOT NULL DEFAULT 1,
    ssl_status TEXT NOT NULL DEFAULT 'active',
    ssl_error TEXT,
    custom_cert TEXT,
    custom_key TEXT,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO console_settings (id, domain, ssl_provider, force_https, ssl_status, updated_at)
VALUES ('default', 'localhost', 'letsencrypt', 1, 'active', CURRENT_TIMESTAMP);

-- +goose Down
-- SQL in section 'Down' is executed when this migration is rolled back

DROP TABLE IF EXISTS console_settings;
