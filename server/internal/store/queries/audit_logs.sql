-- name: ListAuditLogs :many
SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT ? OFFSET ?;

-- name: CreateAuditLog :one
INSERT INTO audit_logs (
    id, actor_id, actor_name, actor_email, action, target_type, target_id, target_name, metadata, ip_address
) VALUES (
    ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
) RETURNING *;
