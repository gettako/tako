-- name: ListDeploymentsByService :many
SELECT * FROM deployments WHERE service_id = ? ORDER BY created_at DESC;

-- name: GetDeploymentByID :one
SELECT * FROM deployments WHERE id = ? LIMIT 1;

-- name: CreateDeployment :one
INSERT INTO deployments (
    id, service_id, commit_hash, commit_message, branch, author, status, steps, logs
) VALUES (
    ?, ?, ?, ?, ?, ?, ?, ?, ?
) RETURNING *;

-- name: UpdateDeploymentStatus :exec
UPDATE deployments SET
    status = ?,
    duration_ms = ?,
    finished_at = ?,
    steps = ?,
    logs = ?
WHERE id = ?;

-- name: AppendDeploymentLog :exec
UPDATE deployments SET
    logs = logs || ?,
    status = ?,
    steps = ?
WHERE id = ?;
