package handlers

import (
	"context"
	"database/sql"
	"encoding/json"
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"

	"gettako.dev/tako/server/dns"
	"gettako.dev/tako/internal/models"
	"gettako.dev/tako/internal/protocol"
	"gettako.dev/tako/server/audit"
)

func (h *Handler) ListDomains(w http.ResponseWriter, r *http.Request) {
	serviceID := chi.URLParam(r, "id")

	rows, err := h.db.Query(`
		SELECT d.id, d.service_id, s.name, d.domain, d.port, d.path_prefix, d.strip_prefix,
		       d.is_canonical, d.redirect_mode, d.auth_enabled, d.auth_user, d.entrypoints,
		       d.ssl_resolver, d.ssl_status, d.ssl_error, d.created_at
		FROM domains d
		LEFT JOIN services s ON d.service_id = s.id
		WHERE d.service_id = ?
		ORDER BY d.is_canonical DESC, d.created_at ASC
	`, serviceID)
	if err != nil {
		sendError(w, http.StatusInternalServerError, "Failed to query domains")
		return
	}
	defer rows.Close()

	domains := make([]models.Domain, 0)
	for rows.Next() {
		var d models.Domain
		var sName, sslErr sql.NullString
		var createdAtStr string

		if err := rows.Scan(
			&d.ID, &d.ServiceID, &sName, &d.Domain, &d.Port, &d.PathPrefix, &d.StripPrefix,
			&d.IsCanonical, &d.RedirectMode, &d.AuthEnabled, &d.AuthUser, &d.EntryPoints,
			&d.SSLResolver, &d.SSLStatus, &sslErr, &createdAtStr,
		); err != nil {
			sendError(w, http.StatusInternalServerError, "Failed to read domain row: "+err.Error())
			return
		}

		if sName.Valid {
			d.ServiceName = &sName.String
		}
		if sslErr.Valid {
			d.SSLError = &sslErr.String
		}
		d.CreatedAt, _ = time.Parse(time.RFC3339, createdAtStr)
		if d.CreatedAt.IsZero() {
			d.CreatedAt, _ = time.Parse("2006-01-02 15:04:05", createdAtStr)
		}
		domains = append(domains, d)
	}

	sendJSON(w, http.StatusOK, domains)
}

func (h *Handler) AddDomain(w http.ResponseWriter, r *http.Request) {
	serviceID := chi.URLParam(r, "id")

	var sExists bool
	var defaultPort int
	_ = h.db.QueryRow(`SELECT 1, internal_port FROM services WHERE id = ?`, serviceID).Scan(&sExists, &defaultPort)
	if !sExists {
		sendError(w, http.StatusNotFound, "Service not found")
		return
	}

	var req models.AddDomainRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		sendError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	domainName := strings.ToLower(strings.TrimSpace(req.Domain))
	if domainName == "" || strings.Contains(domainName, " ") || !strings.Contains(domainName, ".") {
		sendError(w, http.StatusBadRequest, "Invalid domain name format")
		return
	}

	targetServiceID := serviceID
	if req.ServiceID != nil && strings.TrimSpace(*req.ServiceID) != "" {
		targetServiceID = strings.TrimSpace(*req.ServiceID)
	}

	port := 3000
	if req.Port != nil && *req.Port > 0 {
		port = *req.Port
	} else if defaultPort > 0 {
		port = defaultPort
	}

	pathPrefix := ""
	if req.PathPrefix != nil {
		p := strings.TrimSpace(*req.PathPrefix)
		if p != "" && !strings.HasPrefix(p, "/") {
			p = "/" + p
		}
		pathPrefix = p
	}

	stripPrefix := false
	if req.StripPrefix != nil {
		stripPrefix = *req.StripPrefix
	}

	redirectMode := "none"
	if req.RedirectMode != nil && *req.RedirectMode != "" {
		redirectMode = *req.RedirectMode
	}

	authEnabled := false
	if req.AuthEnabled != nil {
		authEnabled = *req.AuthEnabled
	}

	authUser := ""
	if req.AuthUser != nil {
		authUser = strings.TrimSpace(*req.AuthUser)
	}

	authPassword := ""
	if req.AuthPassword != nil {
		authPassword = strings.TrimSpace(*req.AuthPassword)
	}

	entrypoints := "web,websecure"
	if req.EntryPoints != nil && strings.TrimSpace(*req.EntryPoints) != "" {
		entrypoints = strings.TrimSpace(*req.EntryPoints)
	}

	sslResolver := "letsencrypt"
	if req.SSLResolver != nil && strings.TrimSpace(*req.SSLResolver) != "" {
		sslResolver = strings.TrimSpace(*req.SSLResolver)
	}

	// Canonical domain logic
	var existingCount int
	_ = h.db.QueryRowContext(r.Context(), `SELECT count(*) FROM domains WHERE service_id = ?`, targetServiceID).Scan(&existingCount)

	isCanonical := false
	if req.IsCanonical != nil {
		isCanonical = *req.IsCanonical
	} else if existingCount == 0 {
		isCanonical = true
	}

	if isCanonical {
		_, _ = h.db.ExecContext(r.Context(), `UPDATE domains SET is_canonical = 0 WHERE service_id = ?`, targetServiceID)
		_, _ = h.db.ExecContext(r.Context(), `UPDATE services SET primary_domain = ? WHERE id = ?`, domainName, targetServiceID)
	} else if existingCount == 0 {
		_, _ = h.db.ExecContext(r.Context(), `UPDATE services SET primary_domain = ? WHERE id = ?`, domainName, targetServiceID)
	}

	id := generateID("dom")
	now := time.Now()

	_, err := h.db.ExecContext(r.Context(), `
		INSERT INTO domains (
			id, service_id, domain, port, path_prefix, strip_prefix, is_canonical,
			redirect_mode, auth_enabled, auth_user, auth_password, entrypoints,
			ssl_resolver, ssl_status, created_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', CURRENT_TIMESTAMP)
	`, id, targetServiceID, domainName, port, pathPrefix, stripPrefix, isCanonical,
		redirectMode, authEnabled, authUser, authPassword, entrypoints, sslResolver)
	if err != nil {
		if strings.Contains(err.Error(), "UNIQUE") {
			sendError(w, http.StatusConflict, "Domain with this path prefix already exists")
			return
		}
		sendError(w, http.StatusInternalServerError, "Failed to add domain: "+err.Error())
		return
	}

	// Synchronize ingress routing with node agent
	h.syncServiceIngress(r.Context(), targetServiceID)

	var sName sql.NullString
	_ = h.db.QueryRowContext(r.Context(), `SELECT name FROM services WHERE id = ?`, targetServiceID).Scan(&sName)

	domain := models.Domain{
		ID:           id,
		ServiceID:    targetServiceID,
		ServiceName:  func() *string { if sName.Valid { return &sName.String }; return nil }(),
		Domain:       domainName,
		Port:         port,
		PathPrefix:   pathPrefix,
		StripPrefix:  stripPrefix,
		IsCanonical:  isCanonical,
		RedirectMode: redirectMode,
		AuthEnabled:  authEnabled,
		AuthUser:     authUser,
		EntryPoints:  entrypoints,
		SSLResolver:  sslResolver,
		SSLStatus:    "pending",
		CreatedAt:    now,
	}

	audit.Record(r.Context(), "domain.add", "domain", id, map[string]string{
		"domain":     domainName,
		"service_id": targetServiceID,
	})
	sendJSON(w, http.StatusCreated, domain)
}

func (h *Handler) UpdateDomain(w http.ResponseWriter, r *http.Request) {
	serviceID := chi.URLParam(r, "id")
	domainParam := strings.ToLower(strings.TrimSpace(chi.URLParam(r, "domain")))

	var existing models.Domain
	var sslErr, sName sql.NullString
	var createdAtStr, authPw string
	err := h.db.QueryRowContext(r.Context(), `
		SELECT d.id, d.service_id, s.name, d.domain, d.port, d.path_prefix, d.strip_prefix,
		       d.is_canonical, d.redirect_mode, d.auth_enabled, d.auth_user, d.auth_password,
		       d.entrypoints, d.ssl_resolver, d.ssl_status, d.ssl_error, d.created_at
		FROM domains d
		LEFT JOIN services s ON d.service_id = s.id
		WHERE d.service_id = ? AND (LOWER(d.domain) = ? OR d.id = ?)
	`, serviceID, domainParam, domainParam).Scan(
		&existing.ID, &existing.ServiceID, &sName, &existing.Domain, &existing.Port,
		&existing.PathPrefix, &existing.StripPrefix, &existing.IsCanonical,
		&existing.RedirectMode, &existing.AuthEnabled, &existing.AuthUser,
		&authPw, &existing.EntryPoints, &existing.SSLResolver,
		&existing.SSLStatus, &sslErr, &createdAtStr,
	)
	if err != nil {
		sendError(w, http.StatusNotFound, "Domain not found")
		return
	}

	var req models.UpdateDomainRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		sendError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	if req.ServiceID != nil && strings.TrimSpace(*req.ServiceID) != "" {
		existing.ServiceID = strings.TrimSpace(*req.ServiceID)
	}
	if req.Port != nil && *req.Port > 0 {
		existing.Port = *req.Port
	}
	if req.PathPrefix != nil {
		p := strings.TrimSpace(*req.PathPrefix)
		if p != "" && !strings.HasPrefix(p, "/") {
			p = "/" + p
		}
		existing.PathPrefix = p
	}
	if req.StripPrefix != nil {
		existing.StripPrefix = *req.StripPrefix
	}
	if req.RedirectMode != nil && *req.RedirectMode != "" {
		existing.RedirectMode = *req.RedirectMode
	}
	if req.AuthEnabled != nil {
		existing.AuthEnabled = *req.AuthEnabled
	}
	if req.AuthUser != nil {
		existing.AuthUser = strings.TrimSpace(*req.AuthUser)
	}
	if req.AuthPassword != nil && strings.TrimSpace(*req.AuthPassword) != "" {
		authPw = strings.TrimSpace(*req.AuthPassword)
	}
	if req.EntryPoints != nil && strings.TrimSpace(*req.EntryPoints) != "" {
		existing.EntryPoints = strings.TrimSpace(*req.EntryPoints)
	}
	if req.SSLResolver != nil && strings.TrimSpace(*req.SSLResolver) != "" {
		existing.SSLResolver = strings.TrimSpace(*req.SSLResolver)
	}

	if req.IsCanonical != nil && *req.IsCanonical {
		existing.IsCanonical = true
		_, _ = h.db.ExecContext(r.Context(), `UPDATE domains SET is_canonical = 0 WHERE service_id = ?`, existing.ServiceID)
		_, _ = h.db.ExecContext(r.Context(), `UPDATE services SET primary_domain = ? WHERE id = ?`, existing.Domain, existing.ServiceID)
	} else if req.IsCanonical != nil && !*req.IsCanonical {
		existing.IsCanonical = false
	}

	_, err = h.db.ExecContext(r.Context(), `
		UPDATE domains SET
			service_id = ?, port = ?, path_prefix = ?, strip_prefix = ?,
			is_canonical = ?, redirect_mode = ?, auth_enabled = ?,
			auth_user = ?, auth_password = ?, entrypoints = ?, ssl_resolver = ?
		WHERE id = ?
	`, existing.ServiceID, existing.Port, existing.PathPrefix, existing.StripPrefix,
		existing.IsCanonical, existing.RedirectMode, existing.AuthEnabled,
		existing.AuthUser, authPw, existing.EntryPoints, existing.SSLResolver, existing.ID)
	if err != nil {
		sendError(w, http.StatusInternalServerError, "Failed to update domain: "+err.Error())
		return
	}

	h.syncServiceIngress(r.Context(), existing.ServiceID)

	if sName.Valid {
		existing.ServiceName = &sName.String
	}
	if sslErr.Valid {
		existing.SSLError = &sslErr.String
	}
	existing.CreatedAt, _ = time.Parse(time.RFC3339, createdAtStr)
	if existing.CreatedAt.IsZero() {
		existing.CreatedAt, _ = time.Parse("2006-01-02 15:04:05", createdAtStr)
	}

	sendJSON(w, http.StatusOK, existing)
}

func (h *Handler) DeleteDomain(w http.ResponseWriter, r *http.Request) {
	serviceID := chi.URLParam(r, "id")
	domainName := chi.URLParam(r, "domain")

	var wasCanonical bool
	var deletedDomain string
	_ = h.db.QueryRowContext(r.Context(), `
		SELECT is_canonical, domain FROM domains WHERE service_id = ? AND (domain = ? OR id = ?)
	`, serviceID, domainName, domainName).Scan(&wasCanonical, &deletedDomain)

	res, err := h.db.ExecContext(r.Context(), `
		DELETE FROM domains WHERE service_id = ? AND (domain = ? OR id = ?)
	`, serviceID, domainName, domainName)
	if err != nil {
		sendError(w, http.StatusInternalServerError, "Failed to delete domain")
		return
	}

	rowsAffected, _ := res.RowsAffected()
	if rowsAffected == 0 {
		sendError(w, http.StatusNotFound, "Domain not found")
		return
	}

	// If the deleted domain was canonical or primary, designate another domain
	if wasCanonical {
		var nextDomainID, nextDomainName string
		if err := h.db.QueryRowContext(r.Context(), `
			SELECT id, domain FROM domains WHERE service_id = ? ORDER BY created_at ASC LIMIT 1
		`, serviceID).Scan(&nextDomainID, &nextDomainName); err == nil {
			_, _ = h.db.ExecContext(r.Context(), `UPDATE domains SET is_canonical = 1 WHERE id = ?`, nextDomainID)
			_, _ = h.db.ExecContext(r.Context(), `UPDATE services SET primary_domain = ? WHERE id = ?`, nextDomainName, serviceID)
		} else {
			_, _ = h.db.ExecContext(r.Context(), `UPDATE services SET primary_domain = NULL WHERE id = ?`, serviceID)
		}
	}

	h.syncServiceIngress(r.Context(), serviceID)

	audit.Record(r.Context(), "domain.remove", "domain", domainName, map[string]string{
		"domain":     domainName,
		"service_id": serviceID,
	})
	sendJSON(w, http.StatusOK, map[string]any{
		"success": true,
		"message": "Domain deleted successfully",
	})
}

func (h *Handler) CheckDomainSSL(w http.ResponseWriter, r *http.Request) {
	serviceID := chi.URLParam(r, "id")
	domainName := strings.ToLower(strings.TrimSpace(chi.URLParam(r, "domain")))

	var serverID, serverIP sql.NullString
	err := h.db.QueryRowContext(r.Context(), `
		SELECT s.server_id, srv.host
		FROM services s
		LEFT JOIN servers srv ON s.server_id = srv.id
		WHERE s.id = ?
	`, serviceID).Scan(&serverID, &serverIP)
	if err != nil {
		if err == sql.ErrNoRows {
			sendError(w, http.StatusNotFound, "Service not found")
			return
		}
		sendError(w, http.StatusInternalServerError, "Failed to query service server: "+err.Error())
		return
	}

	var d models.Domain
	var sslErr, sName sql.NullString
	var createdAtStr, authPw string
	err = h.db.QueryRowContext(r.Context(), `
		SELECT d.id, d.service_id, s.name, d.domain, d.port, d.path_prefix, d.strip_prefix,
		       d.is_canonical, d.redirect_mode, d.auth_enabled, d.auth_user, d.auth_password,
		       d.entrypoints, d.ssl_resolver, d.ssl_status, d.ssl_error, d.created_at
		FROM domains d
		LEFT JOIN services s ON d.service_id = s.id
		WHERE d.service_id = ? AND (LOWER(d.domain) = ? OR d.id = ?)
	`, serviceID, domainName, domainName).Scan(
		&d.ID, &d.ServiceID, &sName, &d.Domain, &d.Port, &d.PathPrefix, &d.StripPrefix,
		&d.IsCanonical, &d.RedirectMode, &d.AuthEnabled, &d.AuthUser, &authPw,
		&d.EntryPoints, &d.SSLResolver, &d.SSLStatus, &sslErr, &createdAtStr,
	)
	if err != nil {
		sendError(w, http.StatusNotFound, "Domain not found")
		return
	}

	if sName.Valid {
		d.ServiceName = &sName.String
	}
	d.CreatedAt, _ = time.Parse(time.RFC3339, createdAtStr)
	if d.CreatedAt.IsZero() {
		d.CreatedAt, _ = time.Parse("2006-01-02 15:04:05", createdAtStr)
	}

	var dnsRes *dns.CheckResult
	if h.dnsChecker != nil {
		dnsRes = h.dnsChecker.Check(r.Context(), d.Domain, serverIP.String)
	}

	if dnsRes != nil && !dnsRes.Matches {
		errMsg := dnsRes.ErrorMessage
		_, _ = h.db.ExecContext(r.Context(), `
			UPDATE domains SET ssl_status = 'error', ssl_error = ? WHERE id = ?
		`, errMsg, d.ID)
		d.SSLStatus = "error"
		d.SSLError = &errMsg
		sendJSON(w, http.StatusOK, d)
		return
	}

	if h.nodeManager != nil && serverID.Valid && h.nodeManager.IsOnline(serverID.String) {
		taskID := generateID("tsk")
		msg := &protocol.ServerMessage{
			Payload: &protocol.ServerMessage_CheckSslCommand{
				CheckSslCommand: &protocol.CheckSSLCommand{
					TaskId: taskID,
					Domain: d.Domain,
				},
			},
		}

		ctxTimeout, cancel := context.WithTimeout(r.Context(), 5*time.Second)
		defer cancel()

		ack, err := h.nodeManager.SendTaskWithResponse(ctxTimeout, serverID.String, taskID, msg)
		if err == nil && ack != nil {
			if ack.GetSuccess() {
				d.SSLStatus = "active"
				d.SSLError = nil
				_, _ = h.db.ExecContext(r.Context(), `UPDATE domains SET ssl_status = 'active', ssl_error = NULL WHERE id = ?`, d.ID)
			} else if ack.GetMessage() == "pending" {
				d.SSLStatus = "pending"
				d.SSLError = nil
				_, _ = h.db.ExecContext(r.Context(), `UPDATE domains SET ssl_status = 'pending', ssl_error = NULL WHERE id = ?`, d.ID)
			}
		}
	} else if d.SSLStatus == "error" {
		d.SSLStatus = "pending"
		d.SSLError = nil
		_, _ = h.db.ExecContext(r.Context(), `UPDATE domains SET ssl_status = 'pending', ssl_error = NULL WHERE id = ?`, d.ID)
	}

	_ = h.db.QueryRowContext(r.Context(), `
		SELECT ssl_status, ssl_error FROM domains WHERE id = ?
	`, d.ID).Scan(&d.SSLStatus, &sslErr)
	if sslErr.Valid {
		d.SSLError = &sslErr.String
	} else {
		d.SSLError = nil
	}

	sendJSON(w, http.StatusOK, d)
}

func (h *Handler) syncServiceIngress(ctx context.Context, serviceID string) {
	if h.nodeManager == nil {
		return
	}

	var serverID sql.NullString
	_ = h.db.QueryRowContext(ctx, `SELECT server_id FROM services WHERE id = ?`, serviceID).Scan(&serverID)
	if !serverID.Valid || serverID.String == "" || !h.nodeManager.IsOnline(serverID.String) {
		return
	}

	rows, err := h.db.QueryContext(ctx, `
		SELECT id, service_id, domain, port, path_prefix, strip_prefix, is_canonical,
		       redirect_mode, auth_enabled, auth_user, auth_password, entrypoints, ssl_resolver
		FROM domains
		WHERE service_id = ?
		ORDER BY is_canonical DESC, created_at ASC
	`, serviceID)
	if err != nil {
		return
	}
	defer rows.Close()

	var rules []*protocol.IngressRule
	for rows.Next() {
		var id, sID, dom, pathPrefix, redirMode, authUser, authPw, entrypoints, sslResolver string
		var port int
		var stripPrefix, isCanonical, authEnabled bool

		if err := rows.Scan(
			&id, &sID, &dom, &port, &pathPrefix, &stripPrefix, &isCanonical,
			&redirMode, &authEnabled, &authUser, &authPw, &entrypoints, &sslResolver,
		); err == nil {
			rules = append(rules, &protocol.IngressRule{
				RuleId:       id,
				Domain:       dom,
				Port:         int32(port),
				PathPrefix:   pathPrefix,
				StripPrefix:  stripPrefix,
				IsCanonical:  isCanonical,
				RedirectMode: redirMode,
				AuthEnabled:  authEnabled,
				AuthUser:     authUser,
				AuthPassword: authPw,
				Entrypoints:  entrypoints,
				SslResolver:  sslResolver,
				ServiceId:    sID,
			})
		}
	}

	taskID := generateID("tsk")
	_ = h.nodeManager.SendCommand(ctx, serverID.String, &protocol.ServerMessage{
		Payload: &protocol.ServerMessage_SyncIngressCommand{
			SyncIngressCommand: &protocol.SyncIngressCommand{
				TaskId:    taskID,
				ServiceId: serviceID,
				Rules:     rules,
			},
		},
	})
}
