-- name: RecordNodeMetric :one
INSERT INTO node_metrics (
    node_id, cpu_percent, memory_used_mb, memory_total_mb, disk_used_gb, disk_total_gb, network_rx_kbps, network_tx_kbps
) VALUES (
    ?, ?, ?, ?, ?, ?, ?, ?
) RETURNING *;

-- name: ListNodeMetrics :many
SELECT * FROM node_metrics
WHERE node_id = ? AND recorded_at >= datetime('now', ? || ' seconds')
ORDER BY recorded_at ASC;

-- name: ListRecentNodeMetrics :many
SELECT * FROM node_metrics
WHERE node_id = ?
ORDER BY recorded_at DESC
LIMIT ?;
