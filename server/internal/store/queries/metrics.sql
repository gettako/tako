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
WITH node_minute_samples AS (
    SELECT 
        strftime('%Y-%m-%d %H:%M', recorded_at) as minute_bucket,
        node_id,
        AVG(cpu_percent) as avg_cpu,
        AVG(memory_used_mb) as avg_mem_used,
        MAX(memory_total_mb) as max_mem_total,
        AVG(disk_used_gb) as avg_disk_used,
        MAX(disk_total_gb) as max_disk_total,
        AVG(network_rx_kbps) as avg_rx,
        AVG(network_tx_kbps) as avg_tx,
        MIN(recorded_at) as sample_recorded_at
    FROM node_metrics
    WHERE recorded_at >= datetime('now', ? || ' seconds')
    GROUP BY strftime('%Y-%m-%d %H:%M', recorded_at), node_id
)
SELECT 
    sample_recorded_at as recorded_at,
    AVG(avg_cpu) as avg_cpu_percent,
    SUM(avg_mem_used) as total_memory_used_mb,
    SUM(max_mem_total) as total_memory_total_mb,
    SUM(avg_disk_used) as total_disk_used_gb,
    SUM(max_disk_total) as total_disk_total_gb,
    SUM(avg_rx) as total_network_rx_kbps,
    SUM(avg_tx) as total_network_tx_kbps
FROM node_minute_samples
GROUP BY minute_bucket
ORDER BY minute_bucket ASC;
