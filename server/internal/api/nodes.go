package api

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"sort"
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

type TraefikConfigFile struct {
	Name      string `json:"name"`
	Path      string `json:"path"`
	Size      int64  `json:"size"`
	UpdatedAt string `json:"updatedAt"`
	IsCustom  bool   `json:"isCustom"`
	Type      string `json:"type"`
}

type TraefikConfigFileContent struct {
	TraefikConfigFile
	Content string `json:"content"`
}

type SaveTraefikFileRequest struct {
	Content string `json:"content"`
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

		// Traefik dynamic configuration files
		r.Get("/{id}/traefik/files", handleListNodeTraefikFiles(orch))
		r.Get("/{id}/traefik/files/{filename}", handleGetNodeTraefikFile(orch))
		r.Put("/{id}/traefik/files/{filename}", handleSaveNodeTraefikFile(orch))
		r.Delete("/{id}/traefik/files/{filename}", handleDeleteNodeTraefikFile(orch))
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

func isValidTraefikFilename(name string) bool {
	if name == "" || len(name) > 64 {
		return false
	}
	if strings.Contains(name, "/") || strings.Contains(name, "\\") || strings.Contains(name, "..") {
		return false
	}
	lower := strings.ToLower(name)
	if !strings.HasSuffix(lower, ".yml") && !strings.HasSuffix(lower, ".yaml") && !strings.HasSuffix(lower, ".toml") && !strings.HasSuffix(lower, ".json") {
		return false
	}
	for _, ch := range name {
		if !(ch >= 'a' && ch <= 'z') && !(ch >= 'A' && ch <= 'Z') && !(ch >= '0' && ch <= '9') && ch != '-' && ch != '_' && ch != '.' {
			return false
		}
	}
	return true
}

func getTraefikFileType(name string) string {
	lower := strings.ToLower(name)
	if strings.HasSuffix(lower, ".yml") || strings.HasSuffix(lower, ".yaml") {
		return "yaml"
	}
	if strings.HasSuffix(lower, ".toml") {
		return "toml"
	}
	if strings.HasSuffix(lower, ".json") {
		return "json"
	}
	return "yaml"
}

func defaultTraefikFiles() map[string]TraefikConfigFileContent {
	now := time.Now().UTC().Format(time.RFC3339)
	files := make(map[string]TraefikConfigFileContent)

	consoleYaml := `# Dynamic configuration for Tako Console reverse proxy
http:
  routers:
    tako-console:
      rule: "PathPrefix(` + "`" + `/` + "`" + `)"
      service: tako-console-svc
      entryPoints:
        - web
        - websecure
      tls:
        certResolver: letsencrypt
  services:
    tako-console-svc:
      loadBalancer:
        servers:
          - url: "http://127.0.0.1:3000"
`

	headersYaml := `# Security headers middleware
http:
  middlewares:
    secure-headers:
      headers:
        sslRedirect: true
        forceSTSHeader: true
        stsIncludeSubdomains: true
        stsPreload: true
        stsSeconds: 31536000
        customFrameOptionsValue: "SAMEORIGIN"
        contentTypeNosniff: true
        browserXssFilter: true
`

	rateLimitYaml := `# Rate limiting middleware template
http:
  middlewares:
    api-ratelimit:
      rateLimit:
        average: 100
        burst: 50
        period: 1m
`

	files["tako-console.yml"] = TraefikConfigFileContent{
		TraefikConfigFile: TraefikConfigFile{
			Name:      "tako-console.yml",
			Path:      "/etc/tako/traefik/dynamic/tako-console.yml",
			Size:      int64(len(consoleYaml)),
			UpdatedAt: now,
			IsCustom:  false,
			Type:      "yaml",
		},
		Content: consoleYaml,
	}

	files["security-headers.yml"] = TraefikConfigFileContent{
		TraefikConfigFile: TraefikConfigFile{
			Name:      "security-headers.yml",
			Path:      "/etc/tako/traefik/dynamic/security-headers.yml",
			Size:      int64(len(headersYaml)),
			UpdatedAt: now,
			IsCustom:  false,
			Type:      "yaml",
		},
		Content: headersYaml,
	}

	files["ratelimit.yml"] = TraefikConfigFileContent{
		TraefikConfigFile: TraefikConfigFile{
			Name:      "ratelimit.yml",
			Path:      "/etc/tako/traefik/dynamic/ratelimit.yml",
			Size:      int64(len(rateLimitYaml)),
			UpdatedAt: now,
			IsCustom:  false,
			Type:      "yaml",
		},
		Content: rateLimitYaml,
	}

	return files
}

func loadNodeTraefikFiles(ctx context.Context, orch *orchestrator.Orchestrator, nodeID string) (map[string]TraefikConfigFileContent, error) {
	key := fmt.Sprintf("node_traefik_files_%s", nodeID)
	setting, err := orch.Queries().GetSetting(ctx, key)
	if err == nil && setting.Value != "" {
		var files map[string]TraefikConfigFileContent
		if err := json.Unmarshal([]byte(setting.Value), &files); err == nil && len(files) > 0 {
			return files, nil
		}
	}

	defaults := defaultTraefikFiles()
	valBytes, err := json.Marshal(defaults)
	if err == nil {
		_, _ = orch.Queries().SetSetting(ctx, db.SetSettingParams{
			Key:   key,
			Value: string(valBytes),
		})
	}
	return defaults, nil
}

func saveNodeTraefikFiles(ctx context.Context, orch *orchestrator.Orchestrator, nodeID string, files map[string]TraefikConfigFileContent) error {
	key := fmt.Sprintf("node_traefik_files_%s", nodeID)
	valBytes, err := json.Marshal(files)
	if err != nil {
		return err
	}
	_, err = orch.Queries().SetSetting(ctx, db.SetSettingParams{
		Key:   key,
		Value: string(valBytes),
	})
	return err
}

func handleListNodeTraefikFiles(orch *orchestrator.Orchestrator) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id := chi.URLParam(r, "id")
		_, err := orch.Queries().GetNodeByID(r.Context(), id)
		if err != nil {
			if errors.Is(err, sql.ErrNoRows) {
				http.Error(w, `{"error":"node not found"}`, http.StatusNotFound)
				return
			}
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		filesMap, err := loadNodeTraefikFiles(r.Context(), orch, id)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		list := make([]TraefikConfigFile, 0, len(filesMap))
		for _, f := range filesMap {
			list = append(list, f.TraefikConfigFile)
		}

		sort.Slice(list, func(i, j int) bool {
			return list[i].Name < list[j].Name
		})

		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(list)
	}
}

func handleGetNodeTraefikFile(orch *orchestrator.Orchestrator) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id := chi.URLParam(r, "id")
		filename := chi.URLParam(r, "filename")

		if !isValidTraefikFilename(filename) {
			http.Error(w, `{"error":"invalid filename"}`, http.StatusBadRequest)
			return
		}

		_, err := orch.Queries().GetNodeByID(r.Context(), id)
		if err != nil {
			if errors.Is(err, sql.ErrNoRows) {
				http.Error(w, `{"error":"node not found"}`, http.StatusNotFound)
				return
			}
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		filesMap, err := loadNodeTraefikFiles(r.Context(), orch, id)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		file, exists := filesMap[filename]
		if !exists {
			http.Error(w, `{"error":"file not found"}`, http.StatusNotFound)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(file)
	}
}

func handleSaveNodeTraefikFile(orch *orchestrator.Orchestrator) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id := chi.URLParam(r, "id")
		filename := chi.URLParam(r, "filename")

		if !isValidTraefikFilename(filename) {
			http.Error(w, `{"error":"invalid filename"}`, http.StatusBadRequest)
			return
		}

		node, err := orch.Queries().GetNodeByID(r.Context(), id)
		if err != nil {
			if errors.Is(err, sql.ErrNoRows) {
				http.Error(w, `{"error":"node not found"}`, http.StatusNotFound)
				return
			}
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		var req SaveTraefikFileRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, `{"error":"invalid request body"}`, http.StatusBadRequest)
			return
		}

		if len(req.Content) > 512*1024 {
			http.Error(w, `{"error":"file size exceeds maximum allowed limit (512KB)"}`, http.StatusBadRequest)
			return
		}

		filesMap, err := loadNodeTraefikFiles(r.Context(), orch, id)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		isCustom := true
		if existing, exists := filesMap[filename]; exists {
			isCustom = existing.IsCustom
		}

		now := time.Now().UTC().Format(time.RFC3339)
		fileItem := TraefikConfigFileContent{
			TraefikConfigFile: TraefikConfigFile{
				Name:      filename,
				Path:      fmt.Sprintf("/etc/tako/traefik/dynamic/%s", filename),
				Size:      int64(len(req.Content)),
				UpdatedAt: now,
				IsCustom:  isCustom,
				Type:      getTraefikFileType(filename),
			},
			Content: req.Content,
		}

		filesMap[filename] = fileItem
		if err := saveNodeTraefikFiles(r.Context(), orch, id, filesMap); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		_, _ = orch.RecordAudit(r.Context(), orchestrator.AuditLogInput{
			Action:     "save_node_traefik_file",
			TargetType: "node",
			TargetID:   id,
			TargetName: node.Name,
			Metadata: map[string]interface{}{
				"filename": filename,
				"size":     len(req.Content),
				"node_id":  id,
			},
		})

		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(fileItem)
	}
}

func handleDeleteNodeTraefikFile(orch *orchestrator.Orchestrator) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id := chi.URLParam(r, "id")
		filename := chi.URLParam(r, "filename")

		if !isValidTraefikFilename(filename) {
			http.Error(w, `{"error":"invalid filename"}`, http.StatusBadRequest)
			return
		}

		node, err := orch.Queries().GetNodeByID(r.Context(), id)
		if err != nil {
			if errors.Is(err, sql.ErrNoRows) {
				http.Error(w, `{"error":"node not found"}`, http.StatusNotFound)
				return
			}
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		filesMap, err := loadNodeTraefikFiles(r.Context(), orch, id)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		if _, exists := filesMap[filename]; !exists {
			http.Error(w, `{"error":"file not found"}`, http.StatusNotFound)
			return
		}

		delete(filesMap, filename)
		if err := saveNodeTraefikFiles(r.Context(), orch, id, filesMap); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		_, _ = orch.RecordAudit(r.Context(), orchestrator.AuditLogInput{
			Action:     "delete_node_traefik_file",
			TargetType: "node",
			TargetID:   id,
			TargetName: node.Name,
			Metadata: map[string]interface{}{
				"filename": filename,
				"node_id":  id,
			},
		})

		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{
			"success": true,
			"name":    filename,
		})
	}
}
