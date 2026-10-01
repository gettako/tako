package handlers

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"os"
	"path"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"

	"gettako.dev/tako/internal/crypto"
	"gettako.dev/tako/internal/models"
	"gettako.dev/tako/server/github"
)

func (h *Handler) GetGitHubStatus(w http.ResponseWriter, r *http.Request) {
	if h.githubClient == nil {
		f := false
		sendJSON(w, http.StatusOK, models.GitHubStatus{
			Connected:    false,
			Username:     nil,
			AvatarURL:    nil,
			AppInstalled: &f,
		})
		return
	}

	status, err := h.githubClient.GetStatus(r.Context())
	if err != nil {
		sendError(w, http.StatusInternalServerError, "Failed to get GitHub status: "+err.Error())
		return
	}

	sendJSON(w, http.StatusOK, status)
}

func (h *Handler) ListGitHubRepos(w http.ResponseWriter, r *http.Request) {
	if h.githubClient == nil {
		sendJSON(w, http.StatusOK, []models.GitHubRepo{})
		return
	}

	repos, err := h.githubClient.ListRepos(r.Context())
	if err != nil {
		sendError(w, http.StatusInternalServerError, "Failed to list repositories: "+err.Error())
		return
	}

	query := strings.TrimSpace(strings.ToLower(r.URL.Query().Get("q")))
	if query == "" {
		query = strings.TrimSpace(strings.ToLower(r.URL.Query().Get("search")))
	}

	filtered := repos
	if query != "" {
		filtered = make([]models.GitHubRepo, 0, len(repos))
		for _, repo := range repos {
			if strings.Contains(strings.ToLower(repo.Name), query) || strings.Contains(strings.ToLower(repo.FullName), query) {
				filtered = append(filtered, repo)
			}
		}
	}

	page := 1
	if pStr := r.URL.Query().Get("page"); pStr != "" {
		if p, err := strconv.Atoi(pStr); err == nil && p > 0 {
			page = p
		}
	}

	limit := len(filtered)
	if lStr := r.URL.Query().Get("limit"); lStr != "" {
		if l, err := strconv.Atoi(lStr); err == nil && l > 0 {
			limit = l
		}
	} else if perPageStr := r.URL.Query().Get("per_page"); perPageStr != "" {
		if l, err := strconv.Atoi(perPageStr); err == nil && l > 0 {
			limit = l
		}
	}

	start := (page - 1) * limit
	if start > len(filtered) {
		start = len(filtered)
	}
	end := start + limit
	if end > len(filtered) {
		end = len(filtered)
	}

	result := filtered[start:end]
	if result == nil {
		result = []models.GitHubRepo{}
	}

	sendJSON(w, http.StatusOK, result)
}

func (h *Handler) ListGitHubBranches(w http.ResponseWriter, r *http.Request) {
	if h.githubClient == nil {
		sendError(w, http.StatusBadRequest, "GitHub is not configured")
		return
	}

	owner := chi.URLParam(r, "owner")
	repo := chi.URLParam(r, "repo")
	if owner == "" || repo == "" {
		sendError(w, http.StatusBadRequest, "Repository owner and name are required")
		return
	}

	branches, err := h.githubClient.ListBranches(r.Context(), owner, repo)
	if err != nil {
		if strings.Contains(strings.ToLower(err.Error()), "not found") {
			sendError(w, http.StatusNotFound, err.Error())
			return
		}
		sendError(w, http.StatusInternalServerError, "Failed to list branches: "+err.Error())
		return
	}

	sendJSON(w, http.StatusOK, branches)
}

// Multi-account GitHub Connection Handlers

func (h *Handler) ListGitHubConnections(w http.ResponseWriter, r *http.Request) {
	if h.db == nil {
		sendJSON(w, http.StatusOK, []models.GitHubConnection{})
		return
	}

	rows, err := h.db.QueryContext(r.Context(), `
		SELECT c.id, c.name, c.auth_type, c.account_name, c.avatar_url, c.app_id, c.app_slug, c.installation_id, c.created_at, c.updated_at,
		       (SELECT count(*) FROM services s WHERE s.github_connection_id = c.id) as service_count
		FROM github_connections c
		ORDER BY c.created_at DESC
	`)
	if err != nil {
		sendError(w, http.StatusInternalServerError, "Failed to list connections: "+err.Error())
		return
	}
	defer rows.Close()

	connections := make([]models.GitHubConnection, 0)
	for rows.Next() {
		var conn models.GitHubConnection
		var avatarURL, appID, appSlug, installationID sql.NullString
		var createdStr, updatedStr string

		if err := rows.Scan(
			&conn.ID, &conn.Name, &conn.AuthType, &conn.AccountName,
			&avatarURL, &appID, &appSlug, &installationID,
			&createdStr, &updatedStr, &conn.ServiceCount,
		); err != nil {
			continue
		}

		if avatarURL.Valid {
			conn.AvatarURL = &avatarURL.String
		}
		if appID.Valid {
			conn.AppID = &appID.String
		}
		if appSlug.Valid {
			conn.AppSlug = &appSlug.String
		}
		if installationID.Valid {
			conn.InstallationID = &installationID.String
		}

		conn.CreatedAt, _ = time.Parse(time.RFC3339, createdStr)
		if conn.CreatedAt.IsZero() {
			conn.CreatedAt, _ = time.Parse("2006-01-02 15:04:05", createdStr)
		}
		conn.UpdatedAt, _ = time.Parse(time.RFC3339, updatedStr)
		if conn.UpdatedAt.IsZero() {
			conn.UpdatedAt, _ = time.Parse("2006-01-02 15:04:05", updatedStr)
		}

		connections = append(connections, conn)
	}

	sendJSON(w, http.StatusOK, connections)
}

func (h *Handler) CreateGitHubConnection(w http.ResponseWriter, r *http.Request) {
	if h.db == nil {
		sendError(w, http.StatusInternalServerError, "Database not available")
		return
	}

	var req models.CreateGitHubConnectionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		sendError(w, http.StatusBadRequest, "Invalid request payload: "+err.Error())
		return
	}

	req.Name = strings.TrimSpace(req.Name)
	if req.Name == "" {
		sendError(w, http.StatusBadRequest, "Connection name is required")
		return
	}

	authType := strings.ToLower(strings.TrimSpace(req.AuthType))
	if authType != "pat" && authType != "app" {
		sendError(w, http.StatusBadRequest, "auth_type must be either 'pat' or 'app'")
		return
	}

	var tokenToEncrypt []byte
	accountName := ""
	if req.AccountName != nil {
		accountName = strings.TrimSpace(*req.AccountName)
	}
	var avatarURL *string

	if authType == "pat" {
		if req.Token == nil || strings.TrimSpace(*req.Token) == "" {
			sendError(w, http.StatusBadRequest, "Token is required for Personal Access Token authentication")
			return
		}
		pat := strings.TrimSpace(*req.Token)
		tokenToEncrypt = []byte(pat)

		var baseURL string
		var httpClient *http.Client
		if h.githubClient != nil {
			baseURL = h.githubClient.BaseURL()
			httpClient = h.githubClient.HTTPClient()
		}

		tempClient, _ := github.NewClient(github.ClientConfig{
			PAT:        pat,
			BaseURL:    baseURL,
			HTTPClient: httpClient,
		})
		if tempClient != nil {
			status, err := tempClient.GetStatus(r.Context())
			if err == nil {
				if status.Username != nil && accountName == "" {
					accountName = *status.Username
				}
				if status.AvatarURL != nil && avatarURL == nil {
					avatarURL = status.AvatarURL
				}
			}
		}
	} else if authType == "app" {
		if req.PrivateKey != nil && strings.TrimSpace(*req.PrivateKey) != "" {
			tokenToEncrypt = []byte(strings.TrimSpace(*req.PrivateKey))
		} else if req.Token != nil && strings.TrimSpace(*req.Token) != "" {
			tokenToEncrypt = []byte(strings.TrimSpace(*req.Token))
		} else {
			sendError(w, http.StatusBadRequest, "Private key or installation token is required for GitHub App")
			return
		}
	}

	if accountName == "" {
		accountName = req.Name
	}

	ciphertext, nonce, err := crypto.Encrypt(tokenToEncrypt, h.masterKey)
	if err != nil {
		sendError(w, http.StatusInternalServerError, "Failed to encrypt credentials: "+err.Error())
		return
	}
	tokenEnc := append(nonce, ciphertext...)

	var webhookSecretEnc []byte
	if req.WebhookSecret != nil && strings.TrimSpace(*req.WebhookSecret) != "" {
		whCipher, whNonce, err := crypto.Encrypt([]byte(strings.TrimSpace(*req.WebhookSecret)), h.masterKey)
		if err == nil {
			webhookSecretEnc = append(whNonce, whCipher...)
		}
	}

	id := generateID("ghc")
	now := time.Now()

	_, err = h.db.ExecContext(r.Context(), `
		INSERT INTO github_connections (
			id, name, auth_type, account_name, avatar_url, token_enc, app_id, app_slug, installation_id, webhook_secret_enc, created_at, updated_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`, id, req.Name, authType, accountName, avatarURL, tokenEnc, req.AppID, req.AppSlug, req.InstallationID, webhookSecretEnc, now, now)
	if err != nil {
		sendError(w, http.StatusInternalServerError, "Failed to save GitHub connection: "+err.Error())
		return
	}

	sendJSON(w, http.StatusCreated, models.GitHubConnection{
		ID:             id,
		Name:           req.Name,
		AuthType:       authType,
		AccountName:    accountName,
		AvatarURL:      avatarURL,
		AppID:          req.AppID,
		AppSlug:        req.AppSlug,
		InstallationID: req.InstallationID,
		ServiceCount:   0,
		CreatedAt:      now,
		UpdatedAt:      now,
	})
}

func (h *Handler) DeleteGitHubConnection(w http.ResponseWriter, r *http.Request) {
	if h.db == nil {
		sendError(w, http.StatusInternalServerError, "Database not available")
		return
	}

	id := chi.URLParam(r, "id")
	if id == "" {
		sendError(w, http.StatusBadRequest, "Connection ID is required")
		return
	}

	var activeCount int
	var serviceNames sql.NullString
	err := h.db.QueryRowContext(r.Context(), `
		SELECT count(*), GROUP_CONCAT(name, ', ')
		FROM services
		WHERE github_connection_id = ?
	`, id).Scan(&activeCount, &serviceNames)
	if err != nil {
		sendError(w, http.StatusInternalServerError, "Database error: "+err.Error())
		return
	}

	if activeCount > 0 {
		names := ""
		if serviceNames.Valid {
			names = serviceNames.String
		}
		sendError(w, http.StatusConflict, fmt.Sprintf("Cannot delete GitHub connection because it is currently in use by active service(s): %s", names))
		return
	}

	res, err := h.db.ExecContext(r.Context(), `DELETE FROM github_connections WHERE id = ?`, id)
	if err != nil {
		sendError(w, http.StatusInternalServerError, "Failed to delete connection: "+err.Error())
		return
	}
	affected, _ := res.RowsAffected()
	if affected == 0 {
		sendError(w, http.StatusNotFound, "GitHub connection not found")
		return
	}

	sendJSON(w, http.StatusOK, models.SuccessResponse{
		Success: true,
		Message: "GitHub connection deleted successfully",
	})
}

func (h *Handler) GetGitHubManifest(w http.ResponseWriter, r *http.Request) {
	origin := strings.TrimSpace(r.URL.Query().Get("origin"))
	if origin == "" {
		origin = strings.TrimSpace(r.Header.Get("Origin"))
	}
	if origin == "" {
		origin = strings.TrimSpace(r.Header.Get("X-Forwarded-Origin"))
	}
	if origin == "" {
		proto := "http"
		if r.TLS != nil || r.Header.Get("X-Forwarded-Proto") == "https" {
			proto = "https"
		}
		host := r.Host
		if xfHost := r.Header.Get("X-Forwarded-Host"); xfHost != "" {
			host = xfHost
		}
		if xfPort := r.Header.Get("X-Forwarded-Port"); xfPort != "" && !strings.Contains(host, ":") && xfPort != "80" && xfPort != "443" {
			host = fmt.Sprintf("%s:%s", host, xfPort)
		}
		// If host is internal container address or localhost, consider configured domain + console port
		if (host == "" || strings.HasPrefix(host, "server:") || strings.HasPrefix(host, "127.0.0.1:") || strings.HasPrefix(host, "localhost:")) && h.domain != "" && !strings.Contains(h.domain, "localhost") {
			consolePort := os.Getenv("TAKO_CONSOLE_PORT")
			if consolePort != "" && consolePort != "80" && consolePort != "443" && !strings.Contains(h.domain, ":") {
				host = fmt.Sprintf("%s:%s", h.domain, consolePort)
			} else {
				host = h.domain
			}
		}
		origin = fmt.Sprintf("%s://%s", proto, host)
	}

	origin = strings.TrimRight(origin, "/")

	appSlugRandom := fmt.Sprintf("tako-%d", time.Now().Unix()%100000)
	webhookURL := fmt.Sprintf("%s/api/github/webhook", origin)
	redirectURL := fmt.Sprintf("%s/settings/github/callback", origin)

	manifest := map[string]any{
		"name":         appSlugRandom,
		"url":          origin,
		"hook_attributes": map[string]any{
			"url":    webhookURL,
			"active": true,
		},
		"redirect_url": redirectURL,
		"public":       true,
		"default_permissions": map[string]string{
			"contents":      "read",
			"metadata":      "read",
			"pull_requests": "write",
			"statuses":      "write",
		},
		"default_events": []string{
			"push",
			"pull_request",
		},
	}

	sendJSON(w, http.StatusOK, models.GitHubManifestResponse{
		ActionURL: "https://github.com/settings/apps/new",
		Manifest:  manifest,
	})
}

func (h *Handler) ExchangeGitHubManifest(w http.ResponseWriter, r *http.Request) {
	if h.db == nil {
		sendError(w, http.StatusInternalServerError, "Database not available")
		return
	}

	var req models.GitHubAppExchangeRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		sendError(w, http.StatusBadRequest, "Invalid request payload: "+err.Error())
		return
	}

	code := strings.TrimSpace(req.Code)
	if code == "" {
		sendError(w, http.StatusBadRequest, "code is required")
		return
	}

	var baseURL string
	var httpClient *http.Client
	if h.githubClient != nil {
		baseURL = h.githubClient.BaseURL()
		httpClient = h.githubClient.HTTPClient()
	}

	conversion, err := github.ConvertAppManifest(r.Context(), code, baseURL, httpClient)
	if err != nil {
		sendError(w, http.StatusBadRequest, "Failed to exchange GitHub App manifest: "+err.Error())
		return
	}

	ciphertext, nonce, err := crypto.Encrypt([]byte(conversion.PEM), h.masterKey)
	if err != nil {
		sendError(w, http.StatusInternalServerError, "Failed to encrypt credentials: "+err.Error())
		return
	}
	tokenEnc := append(nonce, ciphertext...)

	var webhookSecretEnc []byte
	if conversion.WebhookSecret != "" {
		whCipher, whNonce, err := crypto.Encrypt([]byte(conversion.WebhookSecret), h.masterKey)
		if err == nil {
			webhookSecretEnc = append(whNonce, whCipher...)
		}
		if h.webhookSecret == "" {
			h.webhookSecret = conversion.WebhookSecret
		}
	}

	connName := conversion.Name
	if req.Name != nil && strings.TrimSpace(*req.Name) != "" {
		connName = strings.TrimSpace(*req.Name)
	}

	appIDStr := fmt.Sprintf("%d", conversion.ID)
	id := generateID("ghc")
	now := time.Now()

	_, err = h.db.ExecContext(r.Context(), `
		INSERT INTO github_connections (
			id, name, auth_type, account_name, avatar_url, token_enc, app_id, app_slug, webhook_secret_enc, created_at, updated_at
		) VALUES (?, ?, 'app', ?, NULL, ?, ?, ?, ?, ?, ?)
	`, id, connName, conversion.Slug, tokenEnc, appIDStr, conversion.Slug, webhookSecretEnc, now, now)
	if err != nil {
		sendError(w, http.StatusInternalServerError, "Failed to save GitHub App connection: "+err.Error())
		return
	}

	tempClient, err := github.NewClient(github.ClientConfig{
		AppID:         appIDStr,
		PrivateKeyPEM: []byte(conversion.PEM),
		BaseURL:       baseURL,
		HTTPClient:    httpClient,
	})
	if err == nil && tempClient != nil {
		_, _ = h.syncInstallationsForApp(r.Context(), tempClient, appIDStr, conversion.Slug, tokenEnc, webhookSecretEnc)
	}

	installURL := fmt.Sprintf("https://github.com/apps/%s/installations/new", conversion.Slug)
	sendJSON(w, http.StatusCreated, models.GitHubAppExchangeResponse{
		ConnectionID: id,
		AppID:        appIDStr,
		AppSlug:      conversion.Slug,
		InstallURL:   installURL,
	})
}

func (h *Handler) SyncGitHubInstallations(w http.ResponseWriter, r *http.Request) {
	if h.db == nil {
		sendError(w, http.StatusInternalServerError, "Database not available")
		return
	}

	rows, err := h.db.QueryContext(r.Context(), `
		SELECT app_id, COALESCE(app_slug, ''), token_enc, webhook_secret_enc
		FROM github_connections
		WHERE auth_type = 'app' AND app_id IS NOT NULL AND token_enc IS NOT NULL
		GROUP BY app_id
		ORDER BY created_at DESC
	`)
	if err != nil {
		sendError(w, http.StatusInternalServerError, "Failed to query GitHub App connections: "+err.Error())
		return
	}
	defer rows.Close()

	type appEntry struct {
		appID            string
		appSlug          string
		tokenEnc         []byte
		webhookSecretEnc []byte
	}
	var appList []appEntry

	for rows.Next() {
		var item appEntry
		if err := rows.Scan(&item.appID, &item.appSlug, &item.tokenEnc, &item.webhookSecretEnc); err == nil {
			appList = append(appList, item)
		}
	}

	if len(appList) == 0 {
		sendError(w, http.StatusBadRequest, "No GitHub App connection found to sync installations")
		return
	}

	var baseURL string
	var httpClient *http.Client
	if h.githubClient != nil {
		baseURL = h.githubClient.BaseURL()
		httpClient = h.githubClient.HTTPClient()
	}

	totalSynced := 0
	for _, app := range appList {
		if len(app.tokenEnc) < 12 {
			continue
		}

		nonce := app.tokenEnc[:12]
		ciphertext := app.tokenEnc[12:]
		pemBytes, err := crypto.Decrypt(ciphertext, nonce, h.masterKey)
		if err != nil {
			continue
		}

		client, err := github.NewClient(github.ClientConfig{
			AppID:         app.appID,
			PrivateKeyPEM: pemBytes,
			BaseURL:       baseURL,
			HTTPClient:    httpClient,
		})
		if err != nil {
			continue
		}

		cnt, _ := h.syncInstallationsForApp(r.Context(), client, app.appID, app.appSlug, app.tokenEnc, app.webhookSecretEnc)
		totalSynced += cnt
	}

	h.ListGitHubConnections(w, r)
}

func (h *Handler) syncInstallationsForApp(ctx context.Context, client *github.Client, appID, appSlug string, tokenEnc, webhookSecretEnc []byte) (int, error) {
	installs, err := client.ListInstallations(ctx)
	if err != nil {
		return 0, err
	}

	now := time.Now()
	syncedCount := 0

	for _, inst := range installs {
		instIDStr := fmt.Sprintf("%d", inst.ID)
		accountName := inst.AccountName
		connName := accountName

		var existingID string
		err := h.db.QueryRowContext(ctx, `
			SELECT id FROM github_connections WHERE installation_id = ?
		`, instIDStr).Scan(&existingID)

		if err == sql.ErrNoRows {
			var rootID string
			_ = h.db.QueryRowContext(ctx, `
				SELECT id FROM github_connections WHERE app_id = ? AND (installation_id IS NULL OR installation_id = '') LIMIT 1
			`, appID).Scan(&rootID)

			if rootID != "" {
				_, _ = h.db.ExecContext(ctx, `
					UPDATE github_connections
					SET installation_id = ?, account_name = ?, name = ?, avatar_url = ?, app_slug = ?, updated_at = ?
					WHERE id = ?
				`, instIDStr, accountName, connName, inst.AvatarURL, appSlug, now, rootID)
			} else {
				newID := generateID("ghc")
				_, _ = h.db.ExecContext(ctx, `
					INSERT INTO github_connections (
						id, name, auth_type, account_name, avatar_url, token_enc, app_id, app_slug, installation_id, webhook_secret_enc, created_at, updated_at
					) VALUES (?, ?, 'app', ?, ?, ?, ?, ?, ?, ?, ?, ?)
				`, newID, connName, accountName, inst.AvatarURL, tokenEnc, appID, appSlug, instIDStr, webhookSecretEnc, now, now)
			}
			syncedCount++
		} else if err == nil {
			_, _ = h.db.ExecContext(ctx, `
				UPDATE github_connections
				SET account_name = ?, name = ?, avatar_url = ?, app_slug = ?, updated_at = ?
				WHERE id = ?
			`, accountName, connName, inst.AvatarURL, appSlug, now, existingID)
			syncedCount++
		}
	}

	if len(installs) > 0 {
		_, _ = h.db.ExecContext(ctx, `
			DELETE FROM github_connections
			WHERE app_id = ? AND (installation_id IS NULL OR installation_id = '')
		`, appID)
	}

	return syncedCount, nil
}

func (h *Handler) getClientForConnection(ctx context.Context, connectionID string) (*github.Client, error) {
	var authType, accountName string
	var appID, installationID sql.NullString
	var tokenEnc []byte
	err := h.db.QueryRowContext(ctx, `
		SELECT auth_type, account_name, token_enc, app_id, installation_id
		FROM github_connections WHERE id = ?
	`, connectionID).Scan(&authType, &accountName, &tokenEnc, &appID, &installationID)
	if err != nil {
		return nil, err
	}

	if len(tokenEnc) < 12 {
		return nil, errors.New("invalid encrypted token data")
	}

	nonce := tokenEnc[:12]
	ciphertext := tokenEnc[12:]
	tokenBytes, err := crypto.Decrypt(ciphertext, nonce, h.masterKey)
	if err != nil {
		return nil, fmt.Errorf("failed to decrypt credentials: %w", err)
	}

	cfg := github.ClientConfig{
		BaseURL: func() string {
			if h.githubClient != nil {
				return h.githubClient.BaseURL()
			}
			return ""
		}(),
		HTTPClient: func() *http.Client {
			if h.githubClient != nil {
				return h.githubClient.HTTPClient()
			}
			return nil
		}(),
	}

	if authType == "pat" {
		cfg.PAT = string(tokenBytes)
	} else if authType == "app" {
		if appID.Valid {
			cfg.AppID = appID.String
		}
		if installationID.Valid {
			cfg.InstallationID = installationID.String
		}
		if strings.Contains(string(tokenBytes), "-----BEGIN") {
			cfg.PrivateKeyPEM = tokenBytes
		} else {
			cfg.PAT = string(tokenBytes)
		}
	}

	return github.NewClient(cfg)
}

func (h *Handler) ListConnectionRepos(w http.ResponseWriter, r *http.Request) {
	if h.db == nil {
		sendJSON(w, http.StatusOK, []models.GitHubRepo{})
		return
	}

	id := chi.URLParam(r, "id")
	client, err := h.getClientForConnection(r.Context(), id)
	if err != nil {
		if strings.Contains(strings.ToLower(err.Error()), "not found") || err == sql.ErrNoRows {
			sendError(w, http.StatusNotFound, "GitHub connection not found")
			return
		}
		sendError(w, http.StatusBadRequest, "Failed to initialize GitHub client: "+err.Error())
		return
	}

	repos, err := client.ListRepos(r.Context())
	if err != nil {
		sendError(w, http.StatusInternalServerError, "Failed to list repositories: "+err.Error())
		return
	}

	query := strings.TrimSpace(strings.ToLower(r.URL.Query().Get("q")))
	if query == "" {
		query = strings.TrimSpace(strings.ToLower(r.URL.Query().Get("search")))
	}

	filtered := repos
	if query != "" {
		filtered = make([]models.GitHubRepo, 0, len(repos))
		for _, repo := range repos {
			if strings.Contains(strings.ToLower(repo.Name), query) || strings.Contains(strings.ToLower(repo.FullName), query) {
				filtered = append(filtered, repo)
			}
		}
	}

	page := 1
	if pStr := r.URL.Query().Get("page"); pStr != "" {
		if p, err := strconv.Atoi(pStr); err == nil && p > 0 {
			page = p
		}
	}

	limit := len(filtered)
	if lStr := r.URL.Query().Get("limit"); lStr != "" {
		if l, err := strconv.Atoi(lStr); err == nil && l > 0 {
			limit = l
		}
	} else if perPageStr := r.URL.Query().Get("per_page"); perPageStr != "" {
		if l, err := strconv.Atoi(perPageStr); err == nil && l > 0 {
			limit = l
		}
	}

	start := (page - 1) * limit
	if start > len(filtered) {
		start = len(filtered)
	}
	end := start + limit
	if end > len(filtered) {
		end = len(filtered)
	}

	result := filtered[start:end]
	if result == nil {
		result = []models.GitHubRepo{}
	}

	sendJSON(w, http.StatusOK, result)
}

func (h *Handler) ListConnectionBranches(w http.ResponseWriter, r *http.Request) {
	if h.db == nil {
		sendError(w, http.StatusInternalServerError, "Database not available")
		return
	}

	id := chi.URLParam(r, "id")
	owner := chi.URLParam(r, "owner")
	repo := chi.URLParam(r, "repo")
	if owner == "" || repo == "" {
		sendError(w, http.StatusBadRequest, "Repository owner and name are required")
		return
	}

	client, err := h.getClientForConnection(r.Context(), id)
	if err != nil {
		if strings.Contains(strings.ToLower(err.Error()), "not found") || err == sql.ErrNoRows {
			sendError(w, http.StatusNotFound, "GitHub connection not found")
			return
		}
		sendError(w, http.StatusBadRequest, "Failed to initialize GitHub client: "+err.Error())
		return
	}

	branches, err := client.ListBranches(r.Context(), owner, repo)
	if err != nil {
		if strings.Contains(strings.ToLower(err.Error()), "not found") {
			sendError(w, http.StatusNotFound, err.Error())
			return
		}
		sendError(w, http.StatusInternalServerError, "Failed to list branches: "+err.Error())
		return
	}

	sendJSON(w, http.StatusOK, branches)
}

func NormalizeRepo(raw string) string {
	s := strings.TrimSpace(strings.ToLower(raw))
	s = strings.TrimSuffix(s, ".git")
	s = strings.TrimPrefix(s, "https://github.com/")
	s = strings.TrimPrefix(s, "http://github.com/")
	s = strings.TrimPrefix(s, "git@github.com:")
	s = strings.TrimPrefix(s, "ssh://git@github.com/")
	s = strings.TrimPrefix(s, "github.com/")
	s = strings.Trim(s, "/")
	return s
}

func (h *Handler) HandleGitHubWebhook(w http.ResponseWriter, r *http.Request) {
	h.handleGitHubWebhookInternal(w, r, "")
}

func (h *Handler) HandleGitHubWebhookByConnection(w http.ResponseWriter, r *http.Request) {
	connectionID := chi.URLParam(r, "connection_id")
	h.handleGitHubWebhookInternal(w, r, connectionID)
}

func (h *Handler) handleGitHubWebhookInternal(w http.ResponseWriter, r *http.Request, connectionID string) {
	bodyBytes, err := io.ReadAll(r.Body)
	if err != nil {
		sendError(w, http.StatusBadRequest, "Failed to read request body")
		return
	}

	secretToVerify := h.webhookSecret
	var connFound bool
	if secretToVerify == "" && h.db != nil {
		var whEnc []byte
		if connectionID != "" {
			err := h.db.QueryRowContext(r.Context(), "SELECT webhook_secret_enc FROM github_connections WHERE id = ?", connectionID).Scan(&whEnc)
			if err == nil {
				connFound = true
			}
		} else {
			err := h.db.QueryRowContext(r.Context(), "SELECT webhook_secret_enc FROM github_connections ORDER BY created_at ASC LIMIT 1").Scan(&whEnc)
			if err == nil {
				connFound = true
			}
		}
		if len(whEnc) >= 12 {
			nonce := whEnc[:12]
			ciphertext := whEnc[12:]
			dec, err := crypto.Decrypt(ciphertext, nonce, h.masterKey)
			if err == nil {
				secretToVerify = string(dec)
			}
		}
		if (connFound || connectionID != "") && secretToVerify == "" {
			sendError(w, http.StatusBadRequest, "webhook secret not configured for this connection")
			return
		}
	}

	if secretToVerify != "" {
		sigHeader := r.Header.Get("X-Hub-Signature-256")
		if sigHeader == "" {
			sendError(w, http.StatusUnauthorized, "missing webhook signature")
			return
		}

		mac := hmac.New(sha256.New, []byte(secretToVerify))
		mac.Write(bodyBytes)
		expected := "sha256=" + hex.EncodeToString(mac.Sum(nil))

		if !hmac.Equal([]byte(sigHeader), []byte(expected)) {
			sendError(w, http.StatusUnauthorized, "Invalid webhook signature")
			return
		}
	}

	event := r.Header.Get("X-GitHub-Event")
	if event == "ping" {
		sendJSON(w, http.StatusOK, models.WebhookResponse{Received: true})
		return
	}
	if event == "installation" || event == "installation_repositories" {
		type InstallationEvent struct {
			Action       string `json:"action"`
			Installation struct {
				ID int64 `json:"id"`
			} `json:"installation"`
		}
		var instEvent InstallationEvent
		if err := json.Unmarshal(bodyBytes, &instEvent); err == nil {
			if instEvent.Action == "deleted" && h.db != nil {
				instID := fmt.Sprintf("%d", instEvent.Installation.ID)
				_, _ = h.db.ExecContext(r.Context(), "DELETE FROM github_connections WHERE installation_id = ?", instID)
			} else if (instEvent.Action == "created" || instEvent.Action == "added") && h.db != nil {
				go func() {
					ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
					defer cancel()
					var appID, appSlug sql.NullString
					var tokenEnc, whEnc []byte
					err := h.db.QueryRowContext(ctx, `
						SELECT app_id, app_slug, token_enc, webhook_secret_enc
						FROM github_connections
						WHERE auth_type = 'app' AND app_id IS NOT NULL AND token_enc IS NOT NULL
						ORDER BY created_at ASC LIMIT 1
					`).Scan(&appID, &appSlug, &tokenEnc, &whEnc)
					if err == nil && len(tokenEnc) >= 12 {
						nonce := tokenEnc[:12]
						ciphertext := tokenEnc[12:]
						pemBytes, decErr := crypto.Decrypt(ciphertext, nonce, h.masterKey)
						if decErr == nil {
							var baseURL string
							var httpClient *http.Client
							if h.githubClient != nil {
								baseURL = h.githubClient.BaseURL()
								httpClient = h.githubClient.HTTPClient()
							}
							cl, clErr := github.NewClient(github.ClientConfig{
								AppID:         appID.String,
								PrivateKeyPEM: pemBytes,
								BaseURL:       baseURL,
								HTTPClient:    httpClient,
							})
							if clErr == nil && cl != nil {
								_, _ = h.syncInstallationsForApp(ctx, cl, appID.String, appSlug.String, tokenEnc, whEnc)
							}
						}
					}
				}()
			}
		}
		sendJSON(w, http.StatusOK, models.WebhookResponse{Received: true})
		return
	}
	if event == "pull_request" {
		h.handlePullRequestWebhook(w, r, bodyBytes)
		return
	}
	if event != "push" {
		f := false
		sendJSON(w, http.StatusOK, models.WebhookResponse{
			Received:            true,
			DeploymentTriggered: &f,
		})
		return
	}

	type PushPayload struct {
		Ref        string `json:"ref"`
		Before     string `json:"before"`
		After      string `json:"after"`
		Created    bool   `json:"created"`
		Deleted    bool   `json:"deleted"`
		Repository struct {
			Name     string `json:"name"`
			FullName string `json:"full_name"`
			CloneURL string `json:"clone_url"`
			SSHURL   string `json:"ssh_url"`
			HTMLURL  string `json:"html_url"`
		} `json:"repository"`
		HeadCommit struct {
			ID      string `json:"id"`
			Message string `json:"message"`
			Author  struct {
				Name  string `json:"name"`
				Email string `json:"email"`
			} `json:"author"`
		} `json:"head_commit"`
	}

	var payload PushPayload
	if err := json.Unmarshal(bodyBytes, &payload); err != nil {
		sendError(w, http.StatusBadRequest, "Invalid JSON payload: "+err.Error())
		return
	}

	if payload.Deleted {
		f := false
		sendJSON(w, http.StatusOK, models.WebhookResponse{
			Received:            true,
			DeploymentTriggered: &f,
		})
		return
	}

	ref := payload.Ref
	isTag := false
	var tagName string
	branch := ref
	if strings.HasPrefix(ref, "refs/tags/") {
		isTag = true
		tagName = strings.TrimPrefix(ref, "refs/tags/")
		branch = tagName
	} else if strings.HasPrefix(ref, "refs/heads/") {
		branch = strings.TrimPrefix(ref, "refs/heads/")
	}

	commitSHA := payload.HeadCommit.ID
	if commitSHA == "" {
		commitSHA = payload.After
	}
	commitMsg := payload.HeadCommit.Message
	commitAuthor := payload.HeadCommit.Author.Name

	if strings.Contains(commitMsg, "[skip deploy]") || strings.Contains(commitMsg, "[skip ci]") {
		slog.Info("skipping deployment due to commit message flag",
			slog.String("commit_sha", commitSHA),
			slog.String("message", commitMsg),
		)
		f := false
		sendJSON(w, http.StatusOK, models.WebhookResponse{
			Received:            true,
			DeploymentTriggered: &f,
		})
		return
	}

	pushedRepo := NormalizeRepo(payload.Repository.FullName)
	if pushedRepo == "" {
		pushedRepo = NormalizeRepo(payload.Repository.CloneURL)
	}

	var matchedServiceIDs []string

	if h.db != nil {
		if isTag {
			var query string
			var args []any
			if connectionID != "" {
				query = `
					SELECT id, repository, tag_pattern FROM services
					WHERE trigger_on_tag = 1 AND (github_connection_id = ? OR github_connection_id IS NULL OR github_connection_id = '')
				`
				args = []any{connectionID}
			} else {
				query = `
					SELECT id, repository, tag_pattern FROM services
					WHERE trigger_on_tag = 1
				`
			}

			rows, err := h.db.Query(query, args...)
			if err == nil {
				defer rows.Close()
				for rows.Next() {
					var sID, sRepo, sTagPattern string
					if err := rows.Scan(&sID, &sRepo, &sTagPattern); err == nil {
						if NormalizeRepo(sRepo) == pushedRepo {
							if matchTag(sTagPattern, tagName) {
								matchedServiceIDs = append(matchedServiceIDs, sID)
							}
						}
					}
				}
			}
		} else {
			var query string
			var args []any
			if connectionID != "" {
				query = `
					SELECT id, repository FROM services
					WHERE branch = ? AND (trigger_on_push = 1 OR auto_deploy = 1) AND (github_connection_id = ? OR github_connection_id IS NULL OR github_connection_id = '')
				`
				args = []any{branch, connectionID}
			} else {
				query = `
					SELECT id, repository FROM services
					WHERE branch = ? AND (trigger_on_push = 1 OR auto_deploy = 1)
				`
				args = []any{branch}
			}

			rows, err := h.db.Query(query, args...)
			if err == nil {
				defer rows.Close()
				for rows.Next() {
					var sID, sRepo string
					if err := rows.Scan(&sID, &sRepo); err == nil {
						if NormalizeRepo(sRepo) == pushedRepo {
							matchedServiceIDs = append(matchedServiceIDs, sID)
						}
					}
				}
			}
		}
	}

	triggerType := "webhook"
	if isTag {
		triggerType = "tag"
	}
	req := &models.CreateDeploymentRequest{
		Branch:        &branch,
		CommitSHA:     &commitSHA,
		CommitMessage: &commitMsg,
		CommitAuthor:  &commitAuthor,
		TriggerType:   &triggerType,
	}

	for _, sID := range matchedServiceIDs {
		if h.orchestrator != nil {
			_, depErr := h.orchestrator.TriggerDeployment(r.Context(), sID, req)
			if depErr != nil {
				slog.Error("failed to trigger auto-deployment",
					slog.String("service_id", sID),
					slog.String("error", depErr.Error()),
				)
			}
		}
	}

	if len(matchedServiceIDs) > 0 {
		t := true
		firstID := matchedServiceIDs[0]
		sendJSON(w, http.StatusOK, models.WebhookResponse{
			Received:            true,
			DeploymentTriggered: &t,
			ServiceID:           &firstID,
		})
		return
	}

	f := false
	sendJSON(w, http.StatusOK, models.WebhookResponse{
		Received:            true,
		DeploymentTriggered: &f,
	})
}

func matchTag(pattern, tagName string) bool {
	pattern = strings.TrimSpace(pattern)
	if pattern == "" || pattern == "*" {
		return true
	}
	matched, err := path.Match(pattern, tagName)
	if err != nil {
		return pattern == tagName
	}
	return matched
}
