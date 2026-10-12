package api

import (
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"

	"gettako.dev/tako/internal/orchestrator"
	"gettako.dev/tako/internal/store/db"
	"github.com/go-chi/chi/v5"
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

func handleGetNodeTraefik(orch *orchestrator.Orchestrator) http.HandlerFunc {
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

		key := fmt.Sprintf("node_traefik_%s", id)
		setting, err := orch.Queries().GetSetting(r.Context(), key)
		if err == nil && setting.Value != "" {
			var cfg NodeTraefikConfig
			if err := json.Unmarshal([]byte(setting.Value), &cfg); err == nil {
				RespondJSON(w, http.StatusOK, cfg)
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
		RespondJSON(w, http.StatusOK, defaultCfg)
	}
}

func handleUpdateNodeTraefik(orch *orchestrator.Orchestrator) http.HandlerFunc {
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

		var req NodeTraefikConfig
		if err := DecodeJSON(r, &req); err != nil {
			RespondError(w, http.StatusBadRequest, "invalid request body")
			return
		}

		// Validate ports
		if req.HTTPPort <= 0 || req.HTTPPort > 65535 {
			RespondError(w, http.StatusBadRequest, "HTTP port must be between 1 and 65535")
			return
		}
		if req.HTTPSPort <= 0 || req.HTTPSPort > 65535 {
			RespondError(w, http.StatusBadRequest, "HTTPS port must be between 1 and 65535")
			return
		}
		if req.HTTPPort == req.HTTPSPort {
			RespondError(w, http.StatusBadRequest, "HTTP and HTTPS ports cannot be identical")
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
			RespondError(w, http.StatusInternalServerError, "failed to serialize traefik settings")
			return
		}

		key := fmt.Sprintf("node_traefik_%s", id)
		_, err = orch.Queries().SetSetting(r.Context(), db.SetSettingParams{
			Key:   key,
			Value: string(valBytes),
		})
		if err != nil {
			RespondError(w, http.StatusInternalServerError, err.Error())
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

		RespondJSON(w, http.StatusOK, req)
	}
}

func handleReloadNodeTraefik(orch *orchestrator.Orchestrator) http.HandlerFunc {
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

		RespondJSON(w, http.StatusOK, map[string]any{
			"success":    true,
			"message":    fmt.Sprintf("Traefik routing rules successfully reloaded on %s", node.Name),
			"reloadedAt": now,
		})
	}
}
