package orchestrator

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"time"
)

// RetentionCleaner purges historical deployments, audit logs, and metrics older than a configured threshold.
type RetentionCleaner struct {
	db *sql.DB
}

// NewRetentionCleaner creates a new RetentionCleaner backed by the SQLite database.
func NewRetentionCleaner(db *sql.DB) *RetentionCleaner {
	return &RetentionCleaner{db: db}
}

// Start launches a background goroutine that runs Prune at periodic intervals.
func (c *RetentionCleaner) Start(ctx context.Context, interval time.Duration, retentionDays int) {
	if interval <= 0 {
		interval = 24 * time.Hour
	}
	if retentionDays <= 0 {
		retentionDays = 90
	}

	go func() {
		ticker := time.NewTicker(interval)
		defer ticker.Stop()

		c.Prune(ctx, retentionDays)

		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				c.Prune(ctx, retentionDays)
			}
		}
	}()
}

// Prune executes SQL delete queries to remove stale records older than retentionDays.
func (c *RetentionCleaner) Prune(ctx context.Context, retentionDays int) {
	if retentionDays <= 0 {
		retentionDays = 90
	}
	modifier := fmt.Sprintf("-%d days", retentionDays)

	resDeployments, err := c.db.ExecContext(ctx, "DELETE FROM deployments WHERE status != 'live' AND created_at < datetime('now', ?)", modifier)
	if err != nil {
		log.Printf("[orchestrator] retention cleanup deployments error: %v", err)
	} else if rows, _ := resDeployments.RowsAffected(); rows > 0 {
		log.Printf("[orchestrator] pruned %d old non-live deployments (>%d days)", rows, retentionDays)
	}

	resAudit, err := c.db.ExecContext(ctx, "DELETE FROM audit_logs WHERE timestamp < datetime('now', ?)", modifier)
	if err != nil {
		log.Printf("[orchestrator] retention cleanup audit_logs error: %v", err)
	} else if rows, _ := resAudit.RowsAffected(); rows > 0 {
		log.Printf("[orchestrator] pruned %d old audit logs (>%d days)", rows, retentionDays)
	}

	resMetrics, err := c.db.ExecContext(ctx, "DELETE FROM node_metrics WHERE recorded_at < datetime('now', ?)", modifier)
	if err != nil {
		log.Printf("[orchestrator] retention cleanup node_metrics error: %v", err)
	} else if rows, _ := resMetrics.RowsAffected(); rows > 0 {
		log.Printf("[orchestrator] pruned %d old node metrics (>%d days)", rows, retentionDays)
	}
}
