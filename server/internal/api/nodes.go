package api

import (
	"database/sql"
	"encoding/json"
	"errors"
	"net/http"

	"github.com/go-chi/chi/v5"
	"gettako.dev/tako/internal/orchestrator"
	"gettako.dev/tako/internal/store/db"
)

type NodeResponse struct {
	ID            string             `json:"id"`
	Name          string             `json:"name"`
	IPAddress     string             `json:"ipAddress"`
	PublicIP      string             `json:"publicIp,omitempty"`
	Role          string             `json:"role"`
	Status        string             `json:"status"`
	CPUTotalCores int32              `json:"cpuTotalCores"`
	MemoryTotalMB int64              `json:"memoryTotalMb"`
	DiskTotalGB   float64            `json:"diskTotalGb"`
	Usage         ResourceUsageJSON  `json:"usage"`
	ServicesCount int                `json:"servicesCount"`
	DockerVersion string             `json:"dockerVersion"`
	OS            string             `json:"os"`
	KernelVersion string             `json:"kernelVersion,omitempty"`
	Uptime        string             `json:"uptime"`
	LastHeartbeat string             `json:"lastHeartbeat,omitempty"`
}

type ResourceUsageJSON struct {
	CPUPercent    float64 `json:"cpuPercent"`
	MemoryUsedMB  int64   `json:"memoryUsedMb"`
	MemoryLimitMB int64   `json:"memoryLimitMb"`
	DiskUsedGB    float64 `json:"diskUsedGb,omitempty"`
	DiskTotalGB   float64 `json:"diskTotalGb,omitempty"`
	NetworkRxKBps float64 `json:"networkRxKbps,omitempty"`
	NetworkTxKBps float64 `json:"networkTxKbps,omitempty"`
}

func mapNodeToResponse(n db.Node) NodeResponse {
	lastHB := ""
	if n.LastHeartbeat.Valid {
		lastHB = n.LastHeartbeat.Time.Format("2006-01-02T15:04:05Z07:00")
	}

	return NodeResponse{
		ID:            n.ID,
		Name:          n.Name,
		IPAddress:     n.IpAddress,
		PublicIP:      n.PublicIp,
		Role:          n.Role,
		Status:        n.Status,
		CPUTotalCores: int32(n.CpuTotalCores),
		MemoryTotalMB: n.MemoryTotalMb,
		DiskTotalGB:   n.DiskTotalGb,
		Usage: ResourceUsageJSON{
			CPUPercent:    n.CpuPercent,
			MemoryUsedMB:  n.MemoryUsedMb,
			MemoryLimitMB: n.MemoryTotalMb,
			DiskUsedGB:    n.DiskUsedGb,
			DiskTotalGB:   n.DiskTotalGb,
			NetworkRxKBps: n.NetworkRxKbps,
			NetworkTxKBps: n.NetworkTxKbps,
		},
		ServicesCount: 0,
		DockerVersion: n.DockerVersion,
		OS:            n.Os,
		KernelVersion: n.KernelVersion,
		Uptime:        n.Uptime,
		LastHeartbeat: lastHB,
	}
}

func registerNodeRoutes(r chi.Router, orch *orchestrator.Orchestrator) {
	r.Route("/nodes", func(r chi.Router) {
		// POST /api/v1/nodes/enroll-token
		r.Post("/enroll-token", func(w http.ResponseWriter, r *http.Request) {
			token := orch.GenerateEnrollToken()
			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(map[string]string{
				"token": token,
			})
		})

		// GET /api/v1/nodes
		r.Get("/", func(w http.ResponseWriter, r *http.Request) {
			nodes, err := orch.Queries().ListNodes(r.Context())
			if err != nil {
				http.Error(w, err.Error(), http.StatusInternalServerError)
				return
			}

			items := make([]NodeResponse, 0, len(nodes))
			for _, n := range nodes {
				items = append(items, mapNodeToResponse(n))
			}

			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(items)
		})

		// GET /api/v1/nodes/{id}
		r.Get("/{id}", func(w http.ResponseWriter, r *http.Request) {
			id := chi.URLParam(r, "id")
			node, err := orch.Queries().GetNodeByID(r.Context(), id)
			if err != nil {
				if errors.Is(err, sql.ErrNoRows) {
					http.Error(w, "node not found", http.StatusNotFound)
					return
				}
				http.Error(w, err.Error(), http.StatusInternalServerError)
				return
			}

			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(mapNodeToResponse(node))
		})

		// DELETE /api/v1/nodes/{id}
		r.Delete("/{id}", func(w http.ResponseWriter, r *http.Request) {
			id := chi.URLParam(r, "id")
			if err := orch.Queries().DeleteNode(r.Context(), id); err != nil {
				http.Error(w, err.Error(), http.StatusInternalServerError)
				return
			}

			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(map[string]bool{"success": true})
		})
	})
}
