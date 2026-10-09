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

-- name: ListClusterMetrics :many
SELECT 
    recorded_at,
    AVG(cpu_percent) as avg_cpu_percent,
    SUM(memory_used_mb) as total_memory_used_mb,
    SUM(memory_total_mb) as total_memory_total_mb,
    SUM(disk_used_gb) as total_disk_used_gb,
    SUM(disk_total_gb) as total_disk_total_gb,
    SUM(network_rx_kbps) as total_network_rx_kbps,
    SUM(network_tx_kbps) as total_network_tx_kbps
FROM node_metrics
WHERE recorded_at >= datetime('now', ? || ' seconds')
GROUP BY strftime('%Y-%m-%d %H:%M', recorded_at)
ORDER BY recorded_at ASC;
