-- +goose Up
-- SQL in section 'Up' is executed when this migration is applied

ALTER TABLE sessions ADD COLUMN expires_at DATETIME NOT NULL DEFAULT (datetime('now', '+30 days'));
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);

-- +goose Down
-- SQL in section 'Down' is executed when this migration is rolled back

DROP INDEX IF EXISTS idx_sessions_expires_at;
ALTER TABLE sessions DROP COLUMN expires_at;
