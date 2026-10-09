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
	Timestamp     string  `json:"timestamp"`
	CPU           float64 `json:"cpu"`
	Memory        int64   `json:"memory"`
	MemoryPercent int64   `json:"memoryPercent,omitempty"`
	NetworkRx     float64 `json:"networkRx"`
	NetworkTx     float64 `json:"networkTx"`
	Disk          int64   `json:"disk"`
	DiskPercent   int64   `json:"diskPercent,omitempty"`
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

			var points []MetricPointResponse

			// Cluster-wide metrics
			if nodeID == "" || nodeID == "cluster" {
				clusterPoints, err := orch.Queries().ListClusterMetrics(r.Context(), sql.NullString{String: rangeSeconds, Valid: true})
				if err == nil && len(clusterPoints) > 0 {
					for _, cp := range clusterPoints {
						cpu := float64(0)
						if cp.AvgCpuPercent.Valid {
							cpu = math.Round(cp.AvgCpuPercent.Float64*10) / 10
						}

						memPct := int64(0)
						if cp.TotalMemoryTotalMb.Valid && cp.TotalMemoryTotalMb.Float64 > 0 && cp.TotalMemoryUsedMb.Valid {
							memPct = int64(math.Round((cp.TotalMemoryUsedMb.Float64 / cp.TotalMemoryTotalMb.Float64) * 100))
						} else if cp.TotalMemoryUsedMb.Valid && cp.TotalMemoryUsedMb.Float64 > 0 {
							memPct = int64(math.Min(100, cp.TotalMemoryUsedMb.Float64/81.92))
						}

						diskPct := int64(0)
						if cp.TotalDiskTotalGb.Valid && cp.TotalDiskTotalGb.Float64 > 0 && cp.TotalDiskUsedGb.Valid {
							diskPct = int64(math.Round((cp.TotalDiskUsedGb.Float64 / cp.TotalDiskTotalGb.Float64) * 100))
						} else if cp.TotalDiskUsedGb.Valid {
							diskPct = int64(math.Min(100, cp.TotalDiskUsedGb.Float64))
						}

						rx := float64(0)
						if cp.TotalNetworkRxKbps.Valid {
							rx = math.Round(cp.TotalNetworkRxKbps.Float64*10) / 10
						}

						tx := float64(0)
						if cp.TotalNetworkTxKbps.Valid {
							tx = math.Round(cp.TotalNetworkTxKbps.Float64*10) / 10
						}

						points = append(points, MetricPointResponse{
							Timestamp:     cp.RecordedAt.Format(time.RFC3339),
							CPU:           cpu,
							Memory:        int64(cp.TotalMemoryUsedMb.Float64),
							MemoryPercent: memPct,
							NetworkRx:     rx,
							NetworkTx:     tx,
							Disk:          int64(cp.TotalDiskUsedGb.Float64),
							DiskPercent:   diskPct,
						})
					}
				}

				// If no historical points in table yet, generate current snapshot point from online nodes
				if len(points) == 0 {
					nodes, err := orch.Queries().ListNodes(r.Context())
					if err == nil && len(nodes) > 0 {
						var sumCPU float64
						var sumMemUsed, sumMemTotal int64
						var sumDiskUsed, sumDiskTotal float64
						var sumRx, sumTx float64
						var onlineCount int

						for _, n := range nodes {
							if n.Status == "online" {
								onlineCount++
								sumCPU += n.CpuPercent
								sumMemUsed += n.MemoryUsedMb
								sumMemTotal += n.MemoryTotalMb
								sumDiskUsed += n.DiskUsedGb
								sumDiskTotal += n.DiskTotalGb
								sumRx += n.NetworkRxKbps
								sumTx += n.NetworkTxKbps
							}
						}

						if onlineCount > 0 {
							memPct := int64(0)
							if sumMemTotal > 0 {
								memPct = int64(math.Round(float64(sumMemUsed) / float64(sumMemTotal) * 100))
							}
							diskPct := int64(0)
							if sumDiskTotal > 0 {
								diskPct = int64(math.Round(sumDiskUsed / sumDiskTotal * 100))
							}
							points = append(points, MetricPointResponse{
								Timestamp:     time.Now().UTC().Format(time.RFC3339),
								CPU:           math.Round(sumCPU/float64(onlineCount)*10) / 10,
								Memory:        sumMemUsed,
								MemoryPercent: memPct,
								NetworkRx:     math.Round(sumRx*10) / 10,
								NetworkTx:     math.Round(sumTx*10) / 10,
								Disk:          int64(sumDiskUsed),
								DiskPercent:   diskPct,
							})
						}
					}
				}
			} else {
				// Single node metrics
				dbPoints, err := orch.Queries().ListNodeMetrics(r.Context(), db.ListNodeMetricsParams{
					NodeID:  nodeID,
					Column2: sql.NullString{String: rangeSeconds, Valid: true},
				})
				if err == nil && len(dbPoints) > 0 {
					for _, p := range dbPoints {
						memPct := int64(0)
						if p.MemoryTotalMb > 0 {
							memPct = int64(math.Round(float64(p.MemoryUsedMb) / float64(p.MemoryTotalMb) * 100))
						}
						diskPct := int64(0)
						if p.DiskTotalGb > 0 {
							diskPct = int64(math.Round(float64(p.DiskUsedGb) / float64(p.DiskTotalGb) * 100))
						}

						points = append(points, MetricPointResponse{
							Timestamp:     p.RecordedAt.Format(time.RFC3339),
							CPU:           math.Round(p.CpuPercent*10) / 10,
							Memory:        p.MemoryUsedMb,
							MemoryPercent: memPct,
							NetworkRx:     math.Round(p.NetworkRxKbps*10) / 10,
							NetworkTx:     math.Round(p.NetworkTxKbps*10) / 10,
							Disk:          p.DiskUsedGb,
							DiskPercent:   diskPct,
						})
					}
				} else {
					// Fallback to node current usage
					node, err := orch.Queries().GetNodeByID(r.Context(), nodeID)
					if err == nil && node.Status == "online" {
						memPct := int64(0)
						if node.MemoryTotalMb > 0 {
							memPct = int64(math.Round(float64(node.MemoryUsedMb) / float64(node.MemoryTotalMb) * 100))
						}
						diskPct := int64(0)
						if node.DiskTotalGb > 0 {
							diskPct = int64(math.Round(node.DiskUsedGb / node.DiskTotalGb * 100))
						}
						points = append(points, MetricPointResponse{
							Timestamp:     time.Now().UTC().Format(time.RFC3339),
							CPU:           math.Round(node.CpuPercent*10) / 10,
							Memory:        node.MemoryUsedMb,
							MemoryPercent: memPct,
							NetworkRx:     math.Round(node.NetworkRxKbps*10) / 10,
							NetworkTx:     math.Round(node.NetworkTxKbps*10) / 10,
							Disk:          int64(node.DiskUsedGb),
							DiskPercent:   diskPct,
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
