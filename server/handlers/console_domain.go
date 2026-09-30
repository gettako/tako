package handlers

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"gettako.dev/tako/internal/models"
	"gettako.dev/tako/server/audit"
)

// GetConsoleDomainConfig handles GET /api/settings/console-domain
func (h *Handler) GetConsoleDomainConfig(w http.ResponseWriter, r *http.Request) {
	var cfg models.ConsoleDomainConfig
	var sslErr, customCert, customKey sql.NullString
	var updatedAtStr string

	err := h.db.QueryRowContext(r.Context(), `
		SELECT domain, ssl_provider, force_https, ssl_status, ssl_error, custom_cert, custom_key, updated_at
		FROM console_settings
		WHERE id = 'default'
	`).Scan(&cfg.Domain, &cfg.SSLProvider, &cfg.ForceHTTPS, &cfg.SSLStatus, &sslErr, &customCert, &customKey, &updatedAtStr)

	if err != nil {
		if err == sql.ErrNoRows {
			cfg = models.ConsoleDomainConfig{
				Domain:      h.domain,
				SSLProvider: "letsencrypt",
				ForceHTTPS:  true,
				SSLStatus:   "active",
				UpdatedAt:   time.Now(),
			}
			if cfg.Domain == "" {
				cfg.Domain = "localhost"
			}
			sendJSON(w, http.StatusOK, cfg)
			return
		}
		sendError(w, http.StatusInternalServerError, "Failed to read console domain configuration")
		return
	}

	if sslErr.Valid {
		cfg.SSLError = &sslErr.String
	}
	if customCert.Valid {
		cfg.CustomCert = &customCert.String
	}
	if customKey.Valid {
		cfg.CustomKey = &customKey.String
	}
	cfg.UpdatedAt, _ = time.Parse(time.RFC3339, updatedAtStr)
	if cfg.UpdatedAt.IsZero() {
		cfg.UpdatedAt, _ = time.Parse("2006-01-02 15:04:05", updatedAtStr)
	}

	sendJSON(w, http.StatusOK, cfg)
}

// VerifyConsoleDomainDNS handles POST /api/settings/console-domain/verify
func (h *Handler) VerifyConsoleDomainDNS(w http.ResponseWriter, r *http.Request) {
	var req models.VerifyConsoleDomainRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		sendError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	domain := strings.ToLower(strings.TrimSpace(req.Domain))
	if domain == "" {
		sendError(w, http.StatusBadRequest, "Domain cannot be empty")
		return
	}

	// Resolve target expected host IP
	expectedIP := ""
	if h.db != nil {
		var srvHost sql.NullString
		_ = h.db.QueryRowContext(r.Context(), `
			SELECT host FROM servers WHERE status = 'online' ORDER BY created_at ASC LIMIT 1
		`).Scan(&srvHost)
		if srvHost.Valid && srvHost.String != "" {
			expectedIP = srvHost.String
		}
	}
	if expectedIP == "" {
		expectedIP = h.domain
	}

	res := h.dnsChecker.Check(r.Context(), domain, expectedIP)
	resp := models.VerifyConsoleDomainResponse{
		Matches:     res.Matches,
		Domain:      domain,
		ExpectedIP:  res.ExpectedIP,
		ResolvedIPs: res.ResolvedIPs,
	}
	if res.ErrorMessage != "" {
		resp.ErrorMessage = &res.ErrorMessage
	}

	sendJSON(w, http.StatusOK, resp)
}

// UpdateConsoleDomainConfig handles PUT /api/settings/console-domain
func (h *Handler) UpdateConsoleDomainConfig(w http.ResponseWriter, r *http.Request) {
	var req models.UpdateConsoleDomainRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		sendError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	domain := strings.ToLower(strings.TrimSpace(req.Domain))
	if domain == "" || strings.Contains(domain, " ") {
		sendError(w, http.StatusBadRequest, "Invalid domain name format")
		return
	}
	if domain != "localhost" && !strings.Contains(domain, ".") {
		sendError(w, http.StatusBadRequest, "Domain must contain a valid top-level domain or be localhost")
		return
	}

	sslProvider := "letsencrypt"
	if req.SSLProvider != nil && strings.TrimSpace(*req.SSLProvider) != "" {
		sslProvider = strings.TrimSpace(*req.SSLProvider)
	}

	forceHTTPS := true
	if req.ForceHTTPS != nil {
		forceHTTPS = *req.ForceHTTPS
	}

	sslStatus := "active"
	var sslError *string

	// If using Let's Encrypt and domain is not localhost or raw IP, verify DNS
	if sslProvider == "letsencrypt" && domain != "localhost" {
		var srvHost sql.NullString
		_ = h.db.QueryRowContext(r.Context(), `
			SELECT host FROM servers WHERE status = 'online' ORDER BY created_at ASC LIMIT 1
		`).Scan(&srvHost)
		expectedIP := ""
		if srvHost.Valid {
			expectedIP = srvHost.String
		}
		if expectedIP == "" {
			expectedIP = h.domain
		}

		dnsRes := h.dnsChecker.Check(r.Context(), domain, expectedIP)
		if !dnsRes.Matches && dnsRes.ErrorMessage != "" {
			sslStatus = "pending"
			sslError = &dnsRes.ErrorMessage
		}
	} else if sslProvider == "none" {
		sslStatus = "active"
	}

	// Upsert into console_settings
	now := time.Now().UTC()
	_, err := h.db.ExecContext(r.Context(), `
		INSERT INTO console_settings (id, domain, ssl_provider, force_https, ssl_status, ssl_error, custom_cert, custom_key, updated_at)
		VALUES ('default', ?, ?, ?, ?, ?, ?, ?, ?)
		ON CONFLICT(id) DO UPDATE SET
			domain = excluded.domain,
			ssl_provider = excluded.ssl_provider,
			force_https = excluded.force_https,
			ssl_status = excluded.ssl_status,
			ssl_error = excluded.ssl_error,
			custom_cert = excluded.custom_cert,
			custom_key = excluded.custom_key,
			updated_at = excluded.updated_at
	`, domain, sslProvider, forceHTTPS, sslStatus, sslError, req.CustomCert, req.CustomKey, now)

	if err != nil {
		sendError(w, http.StatusInternalServerError, "Failed to persist console domain configuration: "+err.Error())
		return
	}

	// Generate and apply Traefik dynamic router configuration
	_ = h.applyTraefikConsoleRoute(domain, sslProvider)

	// Audit logging
	audit.Record(r.Context(), "system.domain_update", "system", "console_domain", map[string]interface{}{
		"domain":       domain,
		"ssl_provider": sslProvider,
		"force_https":  forceHTTPS,
		"ssl_status":   sslStatus,
	})

	cfg := models.ConsoleDomainConfig{
		Domain:      domain,
		SSLProvider: sslProvider,
		ForceHTTPS:  forceHTTPS,
		SSLStatus:   sslStatus,
		SSLError:    sslError,
		CustomCert:  req.CustomCert,
		CustomKey:   req.CustomKey,
		UpdatedAt:   now,
	}

	sendJSON(w, http.StatusOK, cfg)
}

// applyTraefikConsoleRoute writes a dynamic Traefik configuration file for the console
func (h *Handler) applyTraefikConsoleRoute(domain, sslProvider string) error {
	tlsBlock := ""
	if sslProvider == "letsencrypt" && domain != "localhost" {
		tlsBlock = "      tls:\n        certResolver: letsencrypt\n"
	}

	yamlContent := fmt.Sprintf("# Generated by Tako Server: Console Routing\nhttp:\n  routers:\n    tako-console:\n      rule: Host(`%s`)\n      entryPoints:\n        - web\n        - websecure\n      service: tako-console-svc\n%s  services:\n    tako-console-svc:\n      loadBalancer:\n        servers:\n          - url: http://console:3000\n", domain, tlsBlock)

	// Look for dynamic Traefik directories
	dirs := []string{
		os.Getenv("TAKO_TRAEFIK_DYNAMIC_DIR"),
		"/etc/traefik/dynamic",
		"/etc/tako/traefik/dynamic",
	}

	for _, dir := range dirs {
		if dir == "" {
			continue
		}
		if _, err := os.Stat(dir); err == nil {
			targetFile := filepath.Join(dir, "console.yml")
			tmpFile := targetFile + ".tmp"
			if err := os.WriteFile(tmpFile, []byte(yamlContent), 0644); err == nil {
				_ = os.Rename(tmpFile, targetFile)
				return nil
			}
		}
	}

	return nil
}
