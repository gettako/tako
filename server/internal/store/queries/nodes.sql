-- name: ListNodes :many
SELECT * FROM nodes ORDER BY created_at DESC;

-- name: GetNodeByID :one
SELECT * FROM nodes WHERE id = ? LIMIT 1;

-- name: CreateNode :one
INSERT INTO nodes (
    id, name, ip_address, public_ip, role, status,
    cpu_total_cores, memory_total_mb, disk_total_gb,
    docker_version, os, kernel_version, enroll_token
) VALUES (
    ?, ?, ?, ?, ?, ?,
    ?, ?, ?,
    ?, ?, ?, ?
) RETURNING *;

-- name: UpdateNodeHeartbeat :exec
UPDATE nodes SET
    status = ?,
    cpu_percent = ?,
    memory_used_mb = ?,
    disk_used_gb = ?,
    network_rx_kbps = ?,
    network_tx_kbps = ?,
    uptime = ?,
    last_heartbeat = CURRENT_TIMESTAMP,
    updated_at = CURRENT_TIMESTAMP
WHERE id = ?;

-- name: UpdateNodeStatus :exec
UPDATE nodes SET
    status = ?,
    updated_at = CURRENT_TIMESTAMP
WHERE id = ?;

-- name: DeleteNode :exec
DELETE FROM nodes WHERE id = ?;

-- name: MarkInactiveNodesOffline :many
UPDATE nodes SET
    status = 'offline',
    updated_at = CURRENT_TIMESTAMP
WHERE status = 'online'
  AND (last_heartbeat IS NULL OR datetime(last_heartbeat, ? || ' seconds') < CURRENT_TIMESTAMP)
RETURNING id, name;
