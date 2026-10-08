-- name: GetUserByID :one
SELECT * FROM users WHERE id = ? LIMIT 1;

-- name: GetUserByEmail :one
SELECT * FROM users WHERE email = ? LIMIT 1;

-- name: CreateUser :one
INSERT INTO users (
    id, name, email, password_hash, role, avatar_url
) VALUES (
    ?, ?, ?, ?, ?, ?
) RETURNING *;

-- name: ListUsers :many
SELECT id, name, email, role, avatar_url, created_at, updated_at FROM users ORDER BY created_at ASC;

-- name: UpdateUserProfile :one
UPDATE users
SET name = ?, email = ?, avatar_url = ?, updated_at = CURRENT_TIMESTAMP
WHERE id = ?
RETURNING *;

-- name: UpdateUserPassword :one
UPDATE users
SET password_hash = ?, updated_at = CURRENT_TIMESTAMP
WHERE id = ?
RETURNING *;

