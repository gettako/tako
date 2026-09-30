package deploy

import (
	"context"
	"database/sql"
	"log/slog"
	"time"

	"gettako.dev/tako/server/nodes"
	"gettako.dev/tako/internal/protocol"
)

type PreviewReaper struct {
	db          *sql.DB
	nodeManager *nodes.NodeManager
	interval    time.Duration
	maxAge      time.Duration
}

func NewPreviewReaper(db *sql.DB, nodeManager *nodes.NodeManager, interval, maxAge time.Duration) *PreviewReaper {
	if interval <= 0 {
		interval = 1 * time.Hour
	}
	if maxAge <= 0 {
		maxAge = 48 * time.Hour
	}
	return &PreviewReaper{
		db:          db,
		nodeManager: nodeManager,
		interval:    interval,
		maxAge:      maxAge,
	}
}

// ReapOnce finds preview services idle for more than maxAge (>48h by default) and tears them down.
func (r *PreviewReaper) ReapOnce(ctx context.Context) (int, error) {
	threshold := time.Now().Add(-r.maxAge).UTC().Format("2006-01-02 15:04:05")
	rows, err := r.db.QueryContext(ctx, `
		SELECT id, server_id FROM services
		WHERE is_preview = 1
		  AND (
			(last_activity_at IS NOT NULL AND datetime(last_activity_at) < datetime(?))
			OR (last_activity_at IS NULL AND datetime(updated_at) < datetime(?))
		  )
	`, threshold, threshold)
	if err != nil {
		return 0, err
	}
	defer rows.Close()

	type previewItem struct {
		id       string
		serverID string
	}
	var expired []previewItem
	for rows.Next() {
		var item previewItem
		if err := rows.Scan(&item.id, &item.serverID); err == nil {
			expired = append(expired, item)
		}
	}

	reaped := 0
	for _, item := range expired {
		if r.nodeManager != nil && item.serverID != "" {
			_ = r.nodeManager.SendCommand(ctx, item.serverID, &protocol.ServerMessage{
				Payload: &protocol.ServerMessage_ContainerAction{
					ContainerAction: &protocol.ContainerAction{
						TaskId:    "reap_" + item.id,
						ServiceId: item.id,
						Action:    "delete",
					},
				},
			})
		}
		_, err := r.db.ExecContext(ctx, `DELETE FROM services WHERE id = ?`, item.id)
		if err == nil {
			reaped++
			slog.Info("reaped idle preview deployment (>48h)", slog.String("service_id", item.id))
		}
	}
	return reaped, nil
}

func (r *PreviewReaper) Start(ctx context.Context) {
	ticker := time.NewTicker(r.interval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			_, _ = r.ReapOnce(ctx)
		}
	}
}
