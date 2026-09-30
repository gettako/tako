package monitoring

import (
	"context"
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"fmt"
	"log/slog"
	"time"

	"gettako.dev/tako/internal/models"
	"gettako.dev/tako/internal/protocol"
)

type ServiceMetricPoint struct {
	Timestamp        string  `json:"timestamp"`
	CPUPercent       float64 `json:"cpu_percent"`
	MemoryBytes      uint64  `json:"memory_bytes"`
	MemoryLimitBytes uint64  `json:"memory_limit_bytes"`
	NetworkRxBytes   uint64  `json:"network_rx_bytes"`
	NetworkTxBytes   uint64  `json:"network_tx_bytes"`
	NetworkRxRate    float64 `json:"network_rx_rate"`
	NetworkTxRate    float64 `json:"network_tx_rate"`
	RestartCount     int     `json:"restart_count"`
}

type ServiceMetricsCurrent struct {
	CPUPercent       float64 `json:"cpu_percent"`
	MemoryBytes      uint64  `json:"memory_bytes"`
	MemoryLimitBytes uint64  `json:"memory_limit_bytes"`
	NetworkRxBytes   uint64  `json:"network_rx_bytes"`
	NetworkTxBytes   uint64  `json:"network_tx_bytes"`
	NetworkRxRate    float64 `json:"network_rx_rate"`
	NetworkTxRate    float64 `json:"network_tx_rate"`
	RestartCount     int     `json:"restart_count"`
}

type ServiceMetricsResponse struct {
	ServiceID string                `json:"service_id"`
	Range     string                `json:"range"`
	Current   ServiceMetricsCurrent `json:"current"`
	Points    []ServiceMetricPoint  `json:"points"`
}

type MetricsManager struct {
	db         *sql.DB
	notifyHook func(models.NotificationPayload)
}

func NewMetricsManager(db *sql.DB) *MetricsManager {
	return &MetricsManager{db: db}
}

func (m *MetricsManager) SetNotifyHook(fn func(models.NotificationPayload)) {
	m.notifyHook = fn
}

func randomID(prefix string) string {
	bytes := make([]byte, 8)
	_, _ = rand.Read(bytes)
	return prefix + hex.EncodeToString(bytes)
}

func clipID(s string, max int) string {
	if len(s) <= max {
		return s
	}
	return s[:max]
}

// StoreReport saves incoming service metrics points into the SQLite database.
func (m *MetricsManager) StoreReport(ctx context.Context, report *protocol.ServiceMetricsReport) error {
	if m.db == nil || report == nil || len(report.GetMetrics()) == 0 {
		return nil
	}

	for _, pt := range report.GetMetrics() {
		if pt.GetServiceId() == "" {
			continue
		}
		if m.notifyHook != nil && pt.GetRestartCount() > 0 {
			var prevRestart int
			err := m.db.QueryRowContext(ctx, `
				SELECT restart_count FROM service_metrics
				WHERE service_id = ? AND container_id = ?
				ORDER BY timestamp DESC LIMIT 1
			`, pt.GetServiceId(), pt.GetContainerId()).Scan(&prevRestart)
			if err == nil && int(pt.GetRestartCount()) > prevRestart {
				var svcName string
				_ = m.db.QueryRowContext(ctx, `SELECT name FROM services WHERE id = ?`, pt.GetServiceId()).Scan(&svcName)
				m.notifyHook(models.NotificationPayload{
					Event:       models.NotificationEventContainerCrashed,
					ServiceID:   pt.GetServiceId(),
					ServiceName: svcName,
					ErrorSnip:   fmt.Sprintf("Container %s restarted unexpectedly (restart count: %d)", clipID(pt.GetContainerId(), 12), pt.GetRestartCount()),
				})
			}
		}
	}

	tx, err := m.db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("failed to begin tx: %w", err)
	}
	defer tx.Rollback()

	stmt, err := tx.PrepareContext(ctx, `
		INSERT INTO service_metrics (
			id, service_id, container_id, cpu_percent, memory_bytes, memory_limit_bytes,
			network_rx_bytes, network_tx_bytes, restart_count, timestamp
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`)
	if err != nil {
		return fmt.Errorf("failed to prepare statement: %w", err)
	}
	defer stmt.Close()

	for _, pt := range report.GetMetrics() {
		if pt.GetServiceId() == "" {
			continue
		}
		id := randomID("met_")
		ts := pt.GetTimestamp()
		if ts == 0 {
			ts = time.Now().Unix()
		}
		_, err := stmt.ExecContext(ctx,
			id,
			pt.GetServiceId(),
			pt.GetContainerId(),
			pt.GetCpuPercent(),
			int64(pt.GetMemoryBytes()),
			int64(pt.GetMemoryLimitBytes()),
			int64(pt.GetNetworkRxBytes()),
			int64(pt.GetNetworkTxBytes()),
			pt.GetRestartCount(),
			ts,
		)
		if err != nil {
			slog.Debug("failed to insert service metric point", slog.String("service_id", pt.GetServiceId()), slog.String("error", err.Error()))
		}
	}

	return tx.Commit()
}

type rawPoint struct {
	Timestamp        int64
	CPUPercent       float64
	MemoryBytes      uint64
	MemoryLimitBytes uint64
	NetworkRxBytes   uint64
	NetworkTxBytes   uint64
	RestartCount     int
}

// GetMetrics returns historical utilization time series and current summary for a service.
func (m *MetricsManager) GetMetrics(ctx context.Context, serviceID string, timeRange string) (*ServiceMetricsResponse, error) {
	if m.db == nil {
		return nil, fmt.Errorf("database not initialized")
	}

	validRange := "1h"
	duration := 1 * time.Hour
	switch timeRange {
	case "6h":
		validRange = "6h"
		duration = 6 * time.Hour
	case "24h":
		validRange = "24h"
		duration = 24 * time.Hour
	case "7d":
		validRange = "7d"
		duration = 7 * 24 * time.Hour
	}

	now := time.Now()
	cutoff := now.Add(-duration).Unix()

	var rawPoints []rawPoint

	if validRange == "7d" {
		// Aggregate rollups and any high-res data not yet rolled up into 1-hour slots
		rows, err := m.db.QueryContext(ctx, `
			SELECT timestamp, cpu_percent_avg, memory_bytes_avg, 0, network_rx_bytes, network_tx_bytes, restart_count
			FROM service_metrics_rollups
			WHERE service_id = ? AND timestamp >= ?
			UNION ALL
			SELECT (timestamp / 3600) * 3600 AS ts, AVG(cpu_percent), CAST(AVG(memory_bytes) AS INTEGER), MAX(memory_limit_bytes), MAX(network_rx_bytes), MAX(network_tx_bytes), MAX(restart_count)
			FROM service_metrics
			WHERE service_id = ? AND timestamp >= ?
			GROUP BY ts
			ORDER BY timestamp ASC
		`, serviceID, cutoff, serviceID, cutoff)
		if err != nil {
			return nil, fmt.Errorf("failed to query rollups: %w", err)
		}
		defer rows.Close()

		for rows.Next() {
			var p rawPoint
			var mem, memLimit, rx, tx int64
			if err := rows.Scan(&p.Timestamp, &p.CPUPercent, &mem, &memLimit, &rx, &tx, &p.RestartCount); err != nil {
				return nil, fmt.Errorf("failed to scan rollup row: %w", err)
			}
			p.MemoryBytes = uint64(mem)
			p.MemoryLimitBytes = uint64(memLimit)
			p.NetworkRxBytes = uint64(rx)
			p.NetworkTxBytes = uint64(tx)
			rawPoints = append(rawPoints, p)
		}
	} else {
		// High-resolution raw points
		rows, err := m.db.QueryContext(ctx, `
			SELECT timestamp, cpu_percent, memory_bytes, memory_limit_bytes, network_rx_bytes, network_tx_bytes, restart_count
			FROM service_metrics
			WHERE service_id = ? AND timestamp >= ?
			ORDER BY timestamp ASC
		`, serviceID, cutoff)
		if err != nil {
			return nil, fmt.Errorf("failed to query service metrics: %w", err)
		}
		defer rows.Close()

		for rows.Next() {
			var p rawPoint
			var mem, memLimit, rx, tx int64
			if err := rows.Scan(&p.Timestamp, &p.CPUPercent, &mem, &memLimit, &rx, &tx, &p.RestartCount); err != nil {
				return nil, fmt.Errorf("failed to scan metric row: %w", err)
			}
			p.MemoryBytes = uint64(mem)
			p.MemoryLimitBytes = uint64(memLimit)
			p.NetworkRxBytes = uint64(rx)
			p.NetworkTxBytes = uint64(tx)
			rawPoints = append(rawPoints, p)
		}
	}

	// Calculate network rates and format points
	points := make([]ServiceMetricPoint, 0, len(rawPoints))
	for i, rp := range rawPoints {
		var rxRate, txRate float64
		if i > 0 {
			dt := float64(rp.Timestamp - rawPoints[i-1].Timestamp)
			if dt > 0 {
				if rp.NetworkRxBytes >= rawPoints[i-1].NetworkRxBytes {
					rxRate = float64(rp.NetworkRxBytes-rawPoints[i-1].NetworkRxBytes) / dt
				}
				if rp.NetworkTxBytes >= rawPoints[i-1].NetworkTxBytes {
					txRate = float64(rp.NetworkTxBytes-rawPoints[i-1].NetworkTxBytes) / dt
				}
			}
		}

		points = append(points, ServiceMetricPoint{
			Timestamp:        time.Unix(rp.Timestamp, 0).UTC().Format(time.RFC3339),
			CPUPercent:       rp.CPUPercent,
			MemoryBytes:      rp.MemoryBytes,
			MemoryLimitBytes: rp.MemoryLimitBytes,
			NetworkRxBytes:   rp.NetworkRxBytes,
			NetworkTxBytes:   rp.NetworkTxBytes,
			NetworkRxRate:    rxRate,
			NetworkTxRate:    txRate,
			RestartCount:     rp.RestartCount,
		})
	}

	// Retrieve current latest reading
	var current ServiceMetricsCurrent
	if len(points) > 0 {
		latest := points[len(points)-1]
		current = ServiceMetricsCurrent{
			CPUPercent:       latest.CPUPercent,
			MemoryBytes:      latest.MemoryBytes,
			MemoryLimitBytes: latest.MemoryLimitBytes,
			NetworkRxBytes:   latest.NetworkRxBytes,
			NetworkTxBytes:   latest.NetworkTxBytes,
			NetworkRxRate:    latest.NetworkRxRate,
			NetworkTxRate:    latest.NetworkTxRate,
			RestartCount:     latest.RestartCount,
		}
	} else {
		// Check if there is any metric at all in the database for current values
		var p rawPoint
		var mem, memLimit, rx, tx int64
		err := m.db.QueryRowContext(ctx, `
			SELECT timestamp, cpu_percent, memory_bytes, memory_limit_bytes, network_rx_bytes, network_tx_bytes, restart_count
			FROM service_metrics
			WHERE service_id = ?
			ORDER BY timestamp DESC
			LIMIT 1
		`, serviceID).Scan(&p.Timestamp, &p.CPUPercent, &mem, &memLimit, &rx, &tx, &p.RestartCount)
		if err == nil {
			current = ServiceMetricsCurrent{
				CPUPercent:       p.CPUPercent,
				MemoryBytes:      uint64(mem),
				MemoryLimitBytes: uint64(memLimit),
				NetworkRxBytes:   uint64(rx),
				NetworkTxBytes:   uint64(tx),
				RestartCount:     p.RestartCount,
			}
		}
	}

	return &ServiceMetricsResponse{
		ServiceID: serviceID,
		Range:     validRange,
		Current:   current,
		Points:    points,
	}, nil
}

// RollupAndPrune aggregates 30s high-resolution data older than 24 hours into 1-hour rollups,
// and deletes rollups older than 30 days.
func (m *MetricsManager) RollupAndPrune(ctx context.Context, now time.Time) error {
	if m.db == nil {
		return nil
	}

	highResCutoff := now.Add(-24 * time.Hour).Unix()
	retentionCutoff := now.Add(-30 * 24 * time.Hour).Unix()

	// 1. Roll up high-resolution points older than 24 hours into 1-hour buckets
	_, err := m.db.ExecContext(ctx, `
		INSERT INTO service_metrics_rollups (
			id, service_id, cpu_percent_avg, cpu_percent_max, memory_bytes_avg, memory_bytes_max,
			network_rx_bytes, network_tx_bytes, restart_count, timestamp
		)
		SELECT
			'rol_' || service_id || '_' || ((timestamp / 3600) * 3600),
			service_id,
			ROUND(AVG(cpu_percent), 2),
			ROUND(MAX(cpu_percent), 2),
			CAST(AVG(memory_bytes) AS INTEGER),
			MAX(memory_bytes),
			MAX(network_rx_bytes),
			MAX(network_tx_bytes),
			MAX(restart_count),
			(timestamp / 3600) * 3600
		FROM service_metrics
		WHERE timestamp < ?
		GROUP BY service_id, (timestamp / 3600) * 3600
		ON CONFLICT(id) DO UPDATE SET
			cpu_percent_avg = excluded.cpu_percent_avg,
			cpu_percent_max = excluded.cpu_percent_max,
			memory_bytes_avg = excluded.memory_bytes_avg,
			memory_bytes_max = excluded.memory_bytes_max,
			network_rx_bytes = excluded.network_rx_bytes,
			network_tx_bytes = excluded.network_tx_bytes,
			restart_count = excluded.restart_count
	`, highResCutoff)
	if err != nil {
		return fmt.Errorf("failed to aggregate rollups: %w", err)
	}

	// 2. Delete high-res points older than 24 hours
	if _, err := m.db.ExecContext(ctx, `DELETE FROM service_metrics WHERE timestamp < ?`, highResCutoff); err != nil {
		return fmt.Errorf("failed to prune high-res metrics: %w", err)
	}

	// 3. Delete rollups older than 30 days
	if _, err := m.db.ExecContext(ctx, `DELETE FROM service_metrics_rollups WHERE timestamp < ?`, retentionCutoff); err != nil {
		return fmt.Errorf("failed to prune expired rollups: %w", err)
	}

	slog.Info("completed service metrics rollup and pruning routine",
		slog.Time("now", now),
		slog.Int64("high_res_cutoff", highResCutoff),
		slog.Int64("retention_cutoff", retentionCutoff),
	)

	return nil
}

// StartPruner starts a background routine for periodic rollup and purge.
func (m *MetricsManager) StartPruner(ctx context.Context, interval time.Duration) {
	if interval <= 0 {
		interval = 1 * time.Hour
	}
	ticker := time.NewTicker(interval)
	defer ticker.Stop()

	// Run once on startup
	_ = m.RollupAndPrune(ctx, time.Now())

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			if err := m.RollupAndPrune(ctx, time.Now()); err != nil {
				slog.Error("error during metrics rollup and prune routine", slog.String("error", err.Error()))
			}
		}
	}
}
