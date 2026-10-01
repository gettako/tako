package handlers

import (
	"context"
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"

	"gettako.dev/tako/internal/models"
	"gettako.dev/tako/internal/protocol"
	"gettako.dev/tako/server/audit"
	"gopkg.in/yaml.v3"
)

func (h *Handler) ListServers(w http.ResponseWriter, r *http.Request) {
	query := `
		SELECT s.id, s.name, s.host, s.status, s.agent_version, s.cpu_percent,
		       s.ram_percent, s.ram_total_bytes, s.ram_used_bytes, s.disk_percent,
		       COUNT(CASE WHEN svc.status = 'running' THEN 1 END) as active_services_count,
		       s.created_at, s.updated_at
		FROM servers s
		LEFT JOIN services svc ON svc.server_id = s.id
		GROUP BY s.id
		ORDER BY s.created_at DESC
	`
	rows, err := h.db.Query(query)
	if err != nil {
		sendError(w, http.StatusInternalServerError, "Failed to query servers")
		return
	}
	defer rows.Close()

	servers := make([]models.Server, 0)
	for rows.Next() {
		var s models.Server
		var host sql.NullString
		var createdAtStr, updatedAtStr string

		if err := rows.Scan(
			&s.ID, &s.Name, &host, &s.Status, &s.AgentVersion,
			&s.CPUPercent, &s.RAMPercent, &s.RAMTotalBytes, &s.RAMUsedBytes, &s.DiskPercent,
			&s.ActiveServicesCount, &createdAtStr, &updatedAtStr,
		); err != nil {
			sendError(w, http.StatusInternalServerError, "Failed to read server row")
			return
		}

		hostStr := ""
		if host.Valid {
			hostStr = host.String
		}
		s.Host = &hostStr
		s.CreatedAt, _ = time.Parse(time.RFC3339, createdAtStr)
		if s.CreatedAt.IsZero() {
			s.CreatedAt, _ = time.Parse("2006-01-02 15:04:05", createdAtStr)
		}
		s.UpdatedAt, _ = time.Parse(time.RFC3339, updatedAtStr)
		if s.UpdatedAt.IsZero() {
			s.UpdatedAt, _ = time.Parse("2006-01-02 15:04:05", updatedAtStr)
		}

		if h.nodeManager != nil {
			if t := h.nodeManager.GetTelemetry(s.ID); t != nil {
				s.CPUPercent = t.CPUPercent
				s.RAMPercent = t.RAMPercent
				s.RAMTotalBytes = t.RAMTotalBytes
				s.RAMUsedBytes = t.RAMUsedBytes
				s.DiskPercent = t.DiskPercent
			}
			if h.nodeManager.IsOnline(s.ID) {
				s.Status = models.ServerOnline
			} else if s.Status == models.ServerOnline {
				s.Status = models.ServerOffline
			}
		}

		servers = append(servers, s)
	}

	sendJSON(w, http.StatusOK, servers)
}

func (h *Handler) CreateServer(w http.ResponseWriter, r *http.Request) {
	var req models.CreateServerRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		sendError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	req.Name = strings.TrimSpace(req.Name)
	if req.Name == "" {
		sendError(w, http.StatusBadRequest, "Server name is required")
		return
	}

	tokenBytes := make([]byte, 16)
	_, _ = rand.Read(tokenBytes)
	token := "tako_tok_" + hex.EncodeToString(tokenBytes)
	tokenExpiresAt := time.Now().Add(1 * time.Hour)

	id := generateID("srv")
	now := time.Now()

	_, err := h.db.Exec(`
		INSERT INTO servers (
			id, name, host, status, enrollment_token, token_expires_at, created_at, updated_at
		) VALUES (?, ?, ?, 'pending', ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
	`, id, req.Name, req.Host, token, tokenExpiresAt)
	if err != nil {
		sendError(w, http.StatusInternalServerError, "Failed to create server")
		return
	}

	hostVal := ""
	if req.Host != nil {
		hostVal = *req.Host
	}

	server := models.Server{
		ID:                  id,
		Name:                req.Name,
		Host:                &hostVal,
		Status:              models.ServerPending,
		AgentVersion:        "",
		ActiveServicesCount: 0,
		CreatedAt:           now,
		UpdatedAt:           now,
	}

	serverURL := "http://" + h.domain
	if h.domain != "localhost" && h.domain != "127.0.0.1" {
		serverURL = "https://" + h.domain
	}

	composeSnippet := fmt.Sprintf(`services:
  tako-agent:
    image: ghcr.io/gettako/agent:latest
    restart: unless-stopped
    environment:
      - TAKO_SERVER_URL=%s
      - TAKO_ENROLLMENT_TOKEN=%s
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
      - /etc/tako:/etc/tako
`, serverURL, token)

	audit.Record(r.Context(), "server.add", "server", id, map[string]string{"name": req.Name})
	sendJSON(w, http.StatusCreated, models.CreateServerResponse{
		Server:          &server,
		EnrollmentToken: token,
		ComposeSnippet:  composeSnippet,
	})
}

func (h *Handler) GetServer(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")

	var s models.Server
	var host sql.NullString
	var dockerVersion, osInfo string
	var uptimeSeconds int64
	var lastHeartbeat sql.NullString
	var createdAtStr, updatedAtStr string

	err := h.db.QueryRow(`
		SELECT id, name, host, status, agent_version, docker_version, os_info,
		       uptime_seconds, cpu_percent, ram_percent, ram_total_bytes, ram_used_bytes, disk_percent, last_heartbeat_at,
		       created_at, updated_at
		FROM servers WHERE id = ?
	`, id).Scan(
		&s.ID, &s.Name, &host, &s.Status, &s.AgentVersion, &dockerVersion, &osInfo,
		&uptimeSeconds, &s.CPUPercent, &s.RAMPercent, &s.RAMTotalBytes, &s.RAMUsedBytes, &s.DiskPercent, &lastHeartbeat,
		&createdAtStr, &updatedAtStr,
	)
	if err != nil {
		if err == sql.ErrNoRows {
			sendError(w, http.StatusNotFound, "Server not found")
			return
		}
		sendError(w, http.StatusInternalServerError, "Database error")
		return
	}

	hostStr := ""
	if host.Valid {
		hostStr = host.String
	}
	s.Host = &hostStr
	s.CreatedAt, _ = time.Parse(time.RFC3339, createdAtStr)
	if s.CreatedAt.IsZero() {
		s.CreatedAt, _ = time.Parse("2006-01-02 15:04:05", createdAtStr)
	}
	s.UpdatedAt, _ = time.Parse(time.RFC3339, updatedAtStr)
	if s.UpdatedAt.IsZero() {
		s.UpdatedAt, _ = time.Parse("2006-01-02 15:04:05", updatedAtStr)
	}

	var lastHeartbeatAt *time.Time
	if lastHeartbeat.Valid {
		tVal, _ := time.Parse(time.RFC3339, lastHeartbeat.String)
		lastHeartbeatAt = &tVal
	}

	svcRows, _ := h.db.Query(`
		SELECT id, name, status, internal_port
		FROM services WHERE server_id = ?
		ORDER BY created_at DESC
	`, id)
	services := make([]models.ServiceSummary, 0)
	if svcRows != nil {
		defer svcRows.Close()
		for svcRows.Next() {
			var summary models.ServiceSummary
			if err := svcRows.Scan(&summary.ID, &summary.Name, &summary.Status, &summary.InternalPort); err == nil {
				services = append(services, summary)
			}
		}
	}

	s.ActiveServicesCount = 0
	for _, svc := range services {
		if svc.Status == models.ServiceRunning {
			s.ActiveServicesCount++
		}
	}

	if h.nodeManager != nil {
		if t := h.nodeManager.GetTelemetry(s.ID); t != nil {
			s.CPUPercent = t.CPUPercent
			s.RAMPercent = t.RAMPercent
			s.RAMTotalBytes = t.RAMTotalBytes
			s.RAMUsedBytes = t.RAMUsedBytes
			s.DiskPercent = t.DiskPercent
			uptimeSeconds = t.UptimeSeconds
			lastHeartbeatAt = &t.LastHeartbeatAt
		}
		if h.nodeManager.IsOnline(s.ID) {
			s.Status = models.ServerOnline
		} else if s.Status == models.ServerOnline {
			s.Status = models.ServerOffline
		}
	}

	detail := models.ServerDetail{
		Server:          s,
		DockerVersion:   dockerVersion,
		OSInfo:          osInfo,
		UptimeSeconds:   uptimeSeconds,
		LastHeartbeatAt: lastHeartbeatAt,
		Services:        services,
	}

	sendJSON(w, http.StatusOK, detail)
}

func (h *Handler) UpdateServer(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")

	var req models.UpdateServerRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		sendError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	if req.MaxConcurrentBuilds != nil {
		if *req.MaxConcurrentBuilds < 1 || *req.MaxConcurrentBuilds > 8 {
			sendError(w, http.StatusBadRequest, "max_concurrent_builds must be between 1 and 8")
			return
		}
	}

	var exists bool
	_ = h.db.QueryRowContext(r.Context(), "SELECT 1 FROM servers WHERE id = ?", id).Scan(&exists)
	if !exists {
		sendError(w, http.StatusNotFound, "Server not found")
		return
	}

	if req.Name != nil && strings.TrimSpace(*req.Name) != "" {
		_, err := h.db.ExecContext(r.Context(), "UPDATE servers SET name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", strings.TrimSpace(*req.Name), id)
		if err != nil {
			sendError(w, http.StatusInternalServerError, "Failed to update server name")
			return
		}
	}

	if req.Host != nil {
		hostVal := strings.TrimSpace(*req.Host)
		var err error
		if hostVal != "" {
			_, err = h.db.ExecContext(r.Context(), "UPDATE servers SET host = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", hostVal, id)
		} else {
			_, err = h.db.ExecContext(r.Context(), "UPDATE servers SET host = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?", id)
		}
		if err != nil {
			sendError(w, http.StatusInternalServerError, "Failed to update server host")
			return
		}
	}

	audit.Record(r.Context(), "server.update", "server", id, map[string]any{
		"name":                  req.Name,
		"host":                  req.Host,
		"max_concurrent_builds": req.MaxConcurrentBuilds,
	})

	h.GetServer(w, r)
}

func (h *Handler) DeleteServer(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")

	// Check if any services still assigned
	var svcCount int
	_ = h.db.QueryRow(`SELECT count(*) FROM services WHERE server_id = ?`, id).Scan(&svcCount)
	if svcCount > 0 {
		sendError(w, http.StatusBadRequest, "Cannot delete server with active assigned services. Please migrate or delete the services first.")
		return
	}

	res, err := h.db.Exec(`DELETE FROM servers WHERE id = ?`, id)
	if err != nil {
		sendError(w, http.StatusInternalServerError, "Failed to delete server")
		return
	}

	rowsAffected, _ := res.RowsAffected()
	if rowsAffected == 0 {
		sendError(w, http.StatusNotFound, "Server not found")
		return
	}

	if h.nodeManager != nil {
		h.nodeManager.DisconnectNode(id)
	}

	audit.Record(r.Context(), "server.delete", "server", id, nil)
	sendJSON(w, http.StatusOK, map[string]any{
		"success": true,
		"message": "Server deleted successfully",
	})
}

func (h *Handler) PruneServer(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")

	var exists bool
	_ = h.db.QueryRow(`SELECT 1 FROM servers WHERE id = ?`, id).Scan(&exists)
	if !exists {
		sendError(w, http.StatusNotFound, "Server not found")
		return
	}

	var reclaimedBytes int64
	if h.nodeManager != nil {
		if !h.nodeManager.IsOnline(id) {
			sendError(w, http.StatusServiceUnavailable, "Server agent is offline")
			return
		}

		taskID := generateID("tsk")
		ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
		defer cancel()

		ack, err := h.nodeManager.SendTaskWithResponse(ctx, id, taskID, &protocol.ServerMessage{
			Payload: &protocol.ServerMessage_PruneCommand{
				PruneCommand: &protocol.PruneCommand{
					TaskId:           taskID,
					KeepRecentImages: 5,
				},
			},
		})
		if err != nil {
			sendError(w, http.StatusInternalServerError, fmt.Sprintf("Prune task failed or timed out: %v", err))
			return
		}
		if ack != nil {
			if !ack.GetSuccess() {
				sendError(w, http.StatusInternalServerError, fmt.Sprintf("Prune execution failed: %s", ack.GetMessage()))
				return
			}
			reclaimedBytes = ack.GetReclaimedBytes()
		}
	}

	audit.Record(r.Context(), "server.prune", "server", id, map[string]any{"reclaimed_bytes": reclaimedBytes})
	sendJSON(w, http.StatusOK, map[string]any{
		"success":         true,
		"reclaimed_bytes": reclaimedBytes,
		"message":         fmt.Sprintf("Docker system prune executed successfully (%d bytes freed)", reclaimedBytes),
	})
}

func (h *Handler) GetServerTraefikConfig(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")

	var exists bool
	_ = h.db.QueryRowContext(r.Context(), `SELECT 1 FROM servers WHERE id = ?`, id).Scan(&exists)
	if !exists {
		sendError(w, http.StatusNotFound, "Server not found")
		return
	}

	var customYAML, staticYAML string
	if h.nodeManager != nil {
		if !h.nodeManager.IsOnline(id) {
			sendError(w, http.StatusServiceUnavailable, "Server agent is offline")
			return
		}

		taskID := generateID("tsk")
		ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
		defer cancel()

		resp, err := h.nodeManager.SendTraefikTaskWithResponse(ctx, id, taskID, &protocol.ServerMessage{
			Payload: &protocol.ServerMessage_TraefikConfigQuery{
				TraefikConfigQuery: &protocol.TraefikConfigQuery{
					TaskId: taskID,
				},
			},
		})
		if err != nil {
			sendError(w, http.StatusInternalServerError, fmt.Sprintf("Failed to query Traefik config: %v", err))
			return
		}
		if resp != nil {
			if !resp.GetSuccess() {
				sendError(w, http.StatusInternalServerError, fmt.Sprintf("Agent failed to read Traefik config: %s", resp.GetErrorMessage()))
				return
			}
			customYAML = resp.GetCustomYaml()
			staticYAML = resp.GetStaticYaml()
		}
	}

	sendJSON(w, http.StatusOK, map[string]string{
		"custom_yaml": customYAML,
		"static_yaml": staticYAML,
	})
}

func (h *Handler) UpdateServerTraefikConfig(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")

	var exists bool
	_ = h.db.QueryRowContext(r.Context(), `SELECT 1 FROM servers WHERE id = ?`, id).Scan(&exists)
	if !exists {
		sendError(w, http.StatusNotFound, "Server not found")
		return
	}

	var req struct {
		CustomYAML string `json:"custom_yaml"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		sendError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	trimmed := strings.TrimSpace(req.CustomYAML)
	if trimmed != "" {
		var validate map[string]interface{}
		if err := yaml.Unmarshal([]byte(trimmed), &validate); err != nil {
			sendError(w, http.StatusBadRequest, fmt.Sprintf("Invalid YAML syntax: %v", err))
			return
		}
	}

	var customYAML, staticYAML string
	if h.nodeManager != nil {
		if !h.nodeManager.IsOnline(id) {
			sendError(w, http.StatusServiceUnavailable, "Server agent is offline")
			return
		}

		taskID := generateID("tsk")
		ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
		defer cancel()

		resp, err := h.nodeManager.SendTraefikTaskWithResponse(ctx, id, taskID, &protocol.ServerMessage{
			Payload: &protocol.ServerMessage_TraefikConfigUpdate{
				TraefikConfigUpdate: &protocol.TraefikConfigUpdate{
					TaskId:     taskID,
					CustomYaml: req.CustomYAML,
				},
			},
		})
		if err != nil {
			sendError(w, http.StatusInternalServerError, fmt.Sprintf("Failed to update Traefik config: %v", err))
			return
		}
		if resp != nil {
			if !resp.GetSuccess() {
				sendError(w, http.StatusInternalServerError, fmt.Sprintf("Agent failed to save Traefik config: %s", resp.GetErrorMessage()))
				return
			}
			customYAML = resp.GetCustomYaml()
			staticYAML = resp.GetStaticYaml()
		}
	} else {
		customYAML = req.CustomYAML
	}

	sendJSON(w, http.StatusOK, map[string]string{
		"custom_yaml": customYAML,
		"static_yaml": staticYAML,
	})
}

func (h *Handler) RestartServerTraefik(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")

	var exists bool
	_ = h.db.QueryRowContext(r.Context(), `SELECT 1 FROM servers WHERE id = ?`, id).Scan(&exists)
	if !exists {
		sendError(w, http.StatusNotFound, "Server not found")
		return
	}

	if h.nodeManager != nil {
		if !h.nodeManager.IsOnline(id) {
			sendError(w, http.StatusServiceUnavailable, "Server agent is offline")
			return
		}

		taskID := generateID("tsk")
		ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
		defer cancel()

		ack, err := h.nodeManager.SendTaskWithResponse(ctx, id, taskID, &protocol.ServerMessage{
			Payload: &protocol.ServerMessage_TraefikRestartCommand{
				TraefikRestartCommand: &protocol.TraefikRestartCommand{
					TaskId: taskID,
				},
			},
		})
		if err != nil {
			sendError(w, http.StatusInternalServerError, fmt.Sprintf("Traefik restart task failed: %v", err))
			return
		}
		if ack != nil && !ack.GetSuccess() {
			sendError(w, http.StatusInternalServerError, fmt.Sprintf("Traefik restart execution failed: %s", ack.GetMessage()))
			return
		}
	}

	sendJSON(w, http.StatusOK, map[string]any{
		"success": true,
		"message": "Traefik container restarted successfully",
	})
}
