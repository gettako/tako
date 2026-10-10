package api

import (
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"
	"gettako.dev/tako/internal/events"
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
				RespondError(w, http.StatusInternalServerError, err.Error())
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
					RespondError(w, http.StatusNotFound, "node not found")
					return
				}
				RespondError(w, http.StatusInternalServerError, err.Error())
				return
			}

			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(mapNodeToResponse(node))
		})

		// PATCH /api/v1/nodes/{id}
		r.Patch("/{id}", handleUpdateNode(orch))

		// POST /api/v1/nodes/{id}/reboot
		r.Post("/{id}/reboot", handleRebootNode(orch))

		// DELETE /api/v1/nodes/{id}
		r.Delete("/{id}", func(w http.ResponseWriter, r *http.Request) {
			id := chi.URLParam(r, "id")
			if err := orch.Queries().DeleteNode(r.Context(), id); err != nil {
				RespondError(w, http.StatusInternalServerError, err.Error())
				return
			}

			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(map[string]bool{"success": true})
		})

		// GET /api/v1/nodes/{id}/traefik
		r.Get("/{id}/traefik", handleGetNodeTraefik(orch))

		// PUT /api/v1/nodes/{id}/traefik
		r.Put("/{id}/traefik", handleUpdateNodeTraefik(orch))

		// POST /api/v1/nodes/{id}/traefik/reload
		r.Post("/{id}/traefik/reload", handleReloadNodeTraefik(orch))

		// Traefik dynamic configuration files
		r.Get("/{id}/traefik/files", handleListNodeTraefikFiles(orch))
		r.Get("/{id}/traefik/files/{filename}", handleGetNodeTraefikFile(orch))
		r.Put("/{id}/traefik/files/{filename}", handleSaveNodeTraefikFile(orch))
		r.Delete("/{id}/traefik/files/{filename}", handleDeleteNodeTraefikFile(orch))
	})
}

type UpdateNodeRequest struct {
	Name         *string `json:"name,omitempty"`
	IPAddress    *string `json:"ip_address,omitempty"`
	IPAddressAlt *string `json:"ipAddress,omitempty"`
	PublicIP     *string `json:"public_ip,omitempty"`
	PublicIPAlt  *string `json:"publicIp,omitempty"`
}

func handleUpdateNode(orch *orchestrator.Orchestrator) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id := chi.URLParam(r, "id")
		node, err := orch.Queries().GetNodeByID(r.Context(), id)
		if err != nil {
			if errors.Is(err, sql.ErrNoRows) {
				RespondError(w, http.StatusNotFound, "node not found")
				return
			}
			RespondError(w, http.StatusInternalServerError, err.Error())
			return
		}

		var req UpdateNodeRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			RespondError(w, http.StatusBadRequest, "invalid request body")
			return
		}

		newName := node.Name
		if req.Name != nil && strings.TrimSpace(*req.Name) != "" {
			newName = strings.TrimSpace(*req.Name)
		}

		newIP := node.IpAddress
		if req.IPAddress != nil && strings.TrimSpace(*req.IPAddress) != "" {
			newIP = strings.TrimSpace(*req.IPAddress)
		} else if req.IPAddressAlt != nil && strings.TrimSpace(*req.IPAddressAlt) != "" {
			newIP = strings.TrimSpace(*req.IPAddressAlt)
		}

		newPublicIP := node.PublicIp
		if req.PublicIP != nil {
			newPublicIP = strings.TrimSpace(*req.PublicIP)
		} else if req.PublicIPAlt != nil {
			newPublicIP = strings.TrimSpace(*req.PublicIPAlt)
		}

		_, err = orch.DB().ExecContext(r.Context(), `UPDATE nodes SET
			name = ?,
			ip_address = ?,
			public_ip = ?,
			updated_at = CURRENT_TIMESTAMP
		WHERE id = ?`, newName, newIP, newPublicIP, id)
		if err != nil {
			RespondError(w, http.StatusInternalServerError, fmt.Sprintf("failed to update node: %v", err))
			return
		}

		updatedNode, err := orch.Queries().GetNodeByID(r.Context(), id)
		if err != nil {
			RespondError(w, http.StatusInternalServerError, err.Error())
			return
		}

		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(mapNodeToResponse(updatedNode))
	}
}

func handleRebootNode(orch *orchestrator.Orchestrator) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id := chi.URLParam(r, "id")
		node, err := orch.Queries().GetNodeByID(r.Context(), id)
		if err != nil {
			if errors.Is(err, sql.ErrNoRows) {
				RespondError(w, http.StatusNotFound, "node not found")
				return
			}
			RespondError(w, http.StatusInternalServerError, err.Error())
			return
		}

		clientIP := r.RemoteAddr
		if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
			clientIP = strings.Split(xff, ",")[0]
		}

		_, _ = orch.RecordAudit(r.Context(), orchestrator.AuditLogInput{
			Action:     "reboot_node",
			TargetType: "node",
			TargetID:   id,
			TargetName: node.Name,
			IPAddress:  clientIP,
		})

		dispatchErr := orch.DispatchContainerAction(r.Context(), id, "host", "reboot-node")

		_ = orch.Queries().UpdateNodeStatus(r.Context(), db.UpdateNodeStatusParams{
			ID:     id,
			Status: "offline",
		})
		orch.Bus().Publish(events.Event{
			Type: events.EventNodeStatusChanged,
			Payload: map[string]any{
				"node_id": id,
				"name":    node.Name,
				"status":  "offline",
			},
		})

		w.Header().Set("Content-Type", "application/json")
		if dispatchErr != nil && orch.GetAgentSession(id) == nil {
			w.WriteHeader(http.StatusAccepted)
			_ = json.NewEncoder(w).Encode(map[string]any{
				"success": true,
				"message": fmt.Sprintf("Node %s marked for reboot (agent session offline)", node.Name),
			})
			return
		}

		_ = json.NewEncoder(w).Encode(map[string]any{
			"success": true,
			"message": fmt.Sprintf("Node %s reboot signal issued successfully", node.Name),
		})
	}
}

