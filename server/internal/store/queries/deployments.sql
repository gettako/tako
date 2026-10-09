-- name: ListDeploymentsByService :many
SELECT * FROM deployments WHERE service_id = ? ORDER BY created_at DESC;

-- name: ListRecentDeployments :many
SELECT 
    d.id, d.service_id, COALESCE(s.name, 'Service') as service_name,
    d.commit_hash, d.commit_message, d.branch, d.author,
    d.status, d.steps, d.logs, d.duration_ms, d.started_at,
    d.finished_at, d.created_at, d.url
FROM deployments d
LEFT JOIN services s ON d.service_id = s.id
ORDER BY d.created_at DESC
LIMIT ?;

-- name: ListDeploymentsWithServiceByService :many
SELECT 
    d.id, d.service_id, COALESCE(s.name, 'Service') as service_name,
    d.commit_hash, d.commit_message, d.branch, d.author,
    d.status, d.steps, d.logs, d.duration_ms, d.started_at,
    d.finished_at, d.created_at, d.url
FROM deployments d
LEFT JOIN services s ON d.service_id = s.id
WHERE d.service_id = ?
ORDER BY d.created_at DESC;

-- name: GetDeploymentByID :one
SELECT * FROM deployments WHERE id = ? LIMIT 1;

-- name: CreateDeployment :one
INSERT INTO deployments (
    id, service_id, commit_hash, commit_message, branch, author, status, steps, logs, url
) VALUES (
    ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
) RETURNING *;

-- name: UpdateDeploymentStatus :exec
UPDATE deployments SET
    status = ?,
    duration_ms = ?,
    finished_at = ?,
    steps = ?,
    logs = ?,
    url = ?
WHERE id = ?;

-- name: AppendDeploymentLog :exec
UPDATE deployments SET
    logs = logs || ?,
    status = ?,
    steps = ?
WHERE id = ?;
