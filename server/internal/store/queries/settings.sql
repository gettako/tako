-- name: GetSetting :one
SELECT * FROM cluster_settings WHERE key = ? LIMIT 1;

-- name: ListSettings :many
SELECT * FROM cluster_settings ORDER BY key ASC;

-- name: SetSetting :one
INSERT INTO cluster_settings (
    key, value, updated_at
) VALUES (
    ?, ?, CURRENT_TIMESTAMP
)
ON CONFLICT(key) DO UPDATE SET
    value = excluded.value,
    updated_at = CURRENT_TIMESTAMP
RETURNING *;

-- name: DeleteSetting :exec
DELETE FROM cluster_settings WHERE key = ?;
