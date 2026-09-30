-- +goose Up
CREATE TABLE IF NOT EXISTS notification_channels (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    name TEXT NOT NULL,
    enabled INTEGER NOT NULL DEFAULT 1,
    webhook_url TEXT,
    bot_token TEXT,
    chat_id TEXT,
    on_deploy_success INTEGER NOT NULL DEFAULT 1,
    on_deploy_failed INTEGER NOT NULL DEFAULT 1,
    on_container_crashed INTEGER NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- +goose Down
DROP TABLE IF EXISTS notification_channels;
