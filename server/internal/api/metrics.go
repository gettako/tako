package api

import (
	"database/sql"
	"encoding/json"
	"math"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"

	"gettako.dev/tako/internal/orchestrator"
	"gettako.dev/tako/internal/store/db"
)

type MetricPointResponse struct {
	Timestamp string  `json:"timestamp"`
	CPU       float64 `json:"cpu"`
	Memory    int64   `json:"memory"`
	NetworkRx float64 `json:"networkRx"`
	NetworkTx float64 `json:"networkTx"`
	Disk      int64   `json:"disk"`
}

func registerMetricsRoutes(r chi.Router, orch *orchestrator.Orchestrator) {
	r.Route("/metrics", func(r chi.Router) {
		r.Get("/", func(w http.ResponseWriter, r *http.Request) {
			nodeID := r.URL.Query().Get("nodeId")
			timeRange := r.URL.Query().Get("range")
			if timeRange == "" {
				timeRange = "1h"
			}

			// Map range to negative seconds for SQLite datetime('now', ? || ' seconds')
			rangeSeconds := "-3600"
			switch timeRange {
			case "6h":
				rangeSeconds = "-21600"
			case "24h":
				rangeSeconds = "-86400"
			case "7d":
				rangeSeconds = "-604800"
			}

			// If nodeID is empty, try to get first node
			if nodeID == "" {
				nodes, err := orch.Queries().ListNodes(r.Context())
				if err == nil && len(nodes) > 0 {
					nodeID = nodes[0].ID
				}
			}

			var points []MetricPointResponse
			if nodeID != "" {
				dbPoints, err := orch.Queries().ListNodeMetrics(r.Context(), db.ListNodeMetricsParams{
					NodeID:  nodeID,
					Column2: sql.NullString{String: rangeSeconds, Valid: true},
				})
				if err == nil && len(dbPoints) > 0 {
					for _, p := range dbPoints {
						points = append(points, MetricPointResponse{
							Timestamp: p.RecordedAt.Format(time.RFC3339),
							CPU:       math.Round(p.CpuPercent*10) / 10,
							Memory:    p.MemoryUsedMb,
							NetworkRx: math.Round(p.NetworkRxKbps*10) / 10,
							NetworkTx: math.Round(p.NetworkTxKbps*10) / 10,
							Disk:      p.DiskUsedGb,
						})
					}
				}
			}

			if points == nil {
				points = []MetricPointResponse{}
			}

			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(points)
		})
	})
}
