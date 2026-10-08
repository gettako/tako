package api

import (
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"gettako.dev/tako/internal/orchestrator"
	"gettako.dev/tako/internal/store/db"
)

type NodeTraefikConfig struct {
	NodeID              string `json:"nodeId"`
	Enabled             bool   `json:"enabled"`
	HTTPPort            int    `json:"httpPort"`
	HTTPSPort           int    `json:"httpsPort"`
	DashboardEnabled    bool   `json:"dashboardEnabled"`
	DashboardPort       int    `json:"dashboardPort"`
	AcmeEmail           string `json:"acmeEmail"`
	LogLevel            string `json:"logLevel"`
	AccessLogEnabled    bool   `json:"accessLogEnabled"`
	ForceHTTPS          bool   `json:"forceHttps"`
	DynamicConfigDir    string `json:"dynamicConfigDir"`
	CertResolver        string `json:"certResolver"`
	MetricsEnabled      bool   `json:"metricsEnabled"`
	LastReloadedAt      string `json:"lastReloadedAt,omitempty"`
	ActiveRoutersCount  int    `json:"activeRoutersCount"`
	ActiveServicesCount int    `json:"activeServicesCount"`
}

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

		// GET /api/v1/nodes/{id}/traefik
		r.Get("/{id}/traefik", handleGetNodeTraefik(orch))

		// PUT /api/v1/nodes/{id}/traefik
		r.Put("/{id}/traefik", handleUpdateNodeTraefik(orch))

		// POST /api/v1/nodes/{id}/traefik/reload
		r.Post("/{id}/traefik/reload", handleReloadNodeTraefik(orch))
	})
}

func handleGetNodeTraefik(orch *orchestrator.Orchestrator) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id := chi.URLParam(r, "id")
		node, err := orch.Queries().GetNodeByID(r.Context(), id)
		if err != nil {
			if errors.Is(err, sql.ErrNoRows) {
				http.Error(w, `{"error":"node not found"}`, http.StatusNotFound)
				return
			}
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		key := fmt.Sprintf("node_traefik_%s", id)
		setting, err := orch.Queries().GetSetting(r.Context(), key)
		if err == nil && setting.Value != "" {
			var cfg NodeTraefikConfig
			if err := json.Unmarshal([]byte(setting.Value), &cfg); err == nil {
				w.Header().Set("Content-Type", "application/json")
				_ = json.NewEncoder(w).Encode(cfg)
				return
			}
		}

		// Count active services on this node
		servicesCount := 0
		if services, err := orch.Queries().ListServicesByNode(r.Context(), id); err == nil {
			servicesCount = len(services)
		}

		// Default configuration
		defaultCfg := NodeTraefikConfig{
			NodeID:              id,
			Enabled:             true,
			HTTPPort:            80,
			HTTPSPort:           443,
			DashboardEnabled:    false,
			DashboardPort:       8080,
			AcmeEmail:           "admin@gettako.dev",
			LogLevel:            "INFO",
			AccessLogEnabled:    true,
			ForceHTTPS:          true,
			DynamicConfigDir:    "/etc/tako/traefik/dynamic",
			CertResolver:        "letsencrypt",
			MetricsEnabled:      true,
			LastReloadedAt:      time.Now().UTC().Format(time.RFC3339),
			ActiveRoutersCount:  servicesCount,
			ActiveServicesCount: servicesCount,
		}

		// Read acme email from domain_settings if available
		if ds, err := orch.Queries().GetSetting(r.Context(), "domain_settings"); err == nil && ds.Value != "" {
			var parsed struct {
				Domain string `json:"domain"`
			}
			if err := json.Unmarshal([]byte(ds.Value), &parsed); err == nil && parsed.Domain != "" {
				cleanDomain := strings.TrimPrefix(parsed.Domain, "console.")
				defaultCfg.AcmeEmail = "admin@" + cleanDomain
			}
		}

		// Save default to cluster_settings so it is persisted
		if valBytes, err := json.Marshal(defaultCfg); err == nil {
			_, _ = orch.Queries().SetSetting(r.Context(), db.SetSettingParams{
				Key:   key,
				Value: string(valBytes),
			})
		}

		_ = node
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(defaultCfg)
	}
}

func handleUpdateNodeTraefik(orch *orchestrator.Orchestrator) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id := chi.URLParam(r, "id")
		node, err := orch.Queries().GetNodeByID(r.Context(), id)
		if err != nil {
			if errors.Is(err, sql.ErrNoRows) {
				http.Error(w, `{"error":"node not found"}`, http.StatusNotFound)
				return
			}
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		var req NodeTraefikConfig
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, `{"error":"invalid request body"}`, http.StatusBadRequest)
			return
		}

		// Validate ports
		if req.HTTPPort <= 0 || req.HTTPPort > 65535 {
			http.Error(w, `{"error":"HTTP port must be between 1 and 65535"}`, http.StatusBadRequest)
			return
		}
		if req.HTTPSPort <= 0 || req.HTTPSPort > 65535 {
			http.Error(w, `{"error":"HTTPS port must be between 1 and 65535"}`, http.StatusBadRequest)
			return
		}
		if req.HTTPPort == req.HTTPSPort {
			http.Error(w, `{"error":"HTTP and HTTPS ports cannot be identical"}`, http.StatusBadRequest)
			return
		}
		if req.DashboardPort <= 0 || req.DashboardPort > 65535 {
			req.DashboardPort = 8080
		}

		// Validate LogLevel
		level := strings.ToUpper(strings.TrimSpace(req.LogLevel))
		if level != "DEBUG" && level != "INFO" && level != "WARN" && level != "ERROR" {
			level = "INFO"
		}
		req.LogLevel = level

		if req.DynamicConfigDir == "" {
			req.DynamicConfigDir = "/etc/tako/traefik/dynamic"
		}
		if req.CertResolver == "" {
			req.CertResolver = "letsencrypt"
		}
		req.NodeID = id
		req.LastReloadedAt = time.Now().UTC().Format(time.RFC3339)

		// Count active services on this node
		servicesCount := 0
		if services, err := orch.Queries().ListServicesByNode(r.Context(), id); err == nil {
			servicesCount = len(services)
		}
		req.ActiveRoutersCount = servicesCount
		req.ActiveServicesCount = servicesCount

		valBytes, err := json.Marshal(req)
		if err != nil {
			http.Error(w, `{"error":"failed to serialize traefik settings"}`, http.StatusInternalServerError)
			return
		}

		key := fmt.Sprintf("node_traefik_%s", id)
		_, err = orch.Queries().SetSetting(r.Context(), db.SetSettingParams{
			Key:   key,
			Value: string(valBytes),
		})
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		_, _ = orch.RecordAudit(r.Context(), orchestrator.AuditLogInput{
			Action:     "update_node_traefik_config",
			TargetType: "node",
			TargetID:   id,
			TargetName: node.Name,
			Metadata: map[string]interface{}{
				"http_port":   req.HTTPPort,
				"https_port":  req.HTTPSPort,
				"force_https": req.ForceHTTPS,
				"log_level":   req.LogLevel,
				"acme_email":  req.AcmeEmail,
			},
		})

		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(req)
	}
}

func handleReloadNodeTraefik(orch *orchestrator.Orchestrator) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id := chi.URLParam(r, "id")
		node, err := orch.Queries().GetNodeByID(r.Context(), id)
		if err != nil {
			if errors.Is(err, sql.ErrNoRows) {
				http.Error(w, `{"error":"node not found"}`, http.StatusNotFound)
				return
			}
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		now := time.Now().UTC().Format(time.RFC3339)
		key := fmt.Sprintf("node_traefik_%s", id)
		if setting, err := orch.Queries().GetSetting(r.Context(), key); err == nil && setting.Value != "" {
			var cfg NodeTraefikConfig
			if err := json.Unmarshal([]byte(setting.Value), &cfg); err == nil {
				cfg.LastReloadedAt = now
				if b, err := json.Marshal(cfg); err == nil {
					_, _ = orch.Queries().SetSetting(r.Context(), db.SetSettingParams{
						Key:   key,
						Value: string(b),
					})
				}
			}
		}

		_, _ = orch.RecordAudit(r.Context(), orchestrator.AuditLogInput{
			Action:     "reload_node_traefik",
			TargetType: "node",
			TargetID:   id,
			TargetName: node.Name,
			Metadata: map[string]interface{}{
				"node_ip": node.IpAddress,
			},
		})

		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{
			"success":    true,
			"message":    fmt.Sprintf("Traefik routing rules successfully reloaded on %s", node.Name),
			"reloadedAt": now,
		})
	}
}
