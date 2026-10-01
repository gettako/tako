package handlers

import (
	"encoding/json"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"

	"gettako.dev/tako/internal/crypto"
	"gettako.dev/tako/internal/models"
	"gettako.dev/tako/server/audit"
	"gettako.dev/tako/server/auth"
)

func (h *Handler) GetServiceEnv(w http.ResponseWriter, r *http.Request) {
	serviceID := chi.URLParam(r, "id")

	var sExists bool
	_ = h.db.QueryRow(`SELECT 1 FROM services WHERE id = ?`, serviceID).Scan(&sExists)
	if !sExists {
		sendError(w, http.StatusNotFound, "Service not found")
		return
	}

	revealSecrets := r.URL.Query().Get("reveal") == "true"
	var currentUser *auth.User
	if revealSecrets {
		currentUser = auth.GetUserFromContext(r.Context())
		if currentUser == nil || currentUser.Role != "admin" {
			sendError(w, http.StatusForbidden, "Administrator access required to reveal secrets")
			return
		}
	}

	rows, err := h.db.Query(`
		SELECT type, key, value_encrypted, nonce, is_secret
		FROM env_vars WHERE service_id = ?
		ORDER BY key ASC
	`, serviceID)
	if err != nil {
		sendError(w, http.StatusInternalServerError, "Failed to query environment variables")
		return
	}
	defer rows.Close()

	envVars := make([]models.EnvVar, 0)
	buildArgs := make([]models.EnvVar, 0)
	var revealedKeys []string

	for rows.Next() {
		var varType, key string
		var valEncrypted, nonce []byte
		var isSecret bool

		if err := rows.Scan(&varType, &key, &valEncrypted, &nonce, &isSecret); err != nil {
			sendError(w, http.StatusInternalServerError, "Failed to read env var row")
			return
		}

		val := ""
		if isSecret && !revealSecrets {
			val = "••••••••"
		} else {
			decryptedBytes, err := crypto.Decrypt(valEncrypted, nonce, h.masterKey)
			if err == nil {
				val = string(decryptedBytes)
			}
			if isSecret && revealSecrets {
				revealedKeys = append(revealedKeys, key)
			}
		}

		item := models.EnvVar{
			Key:      key,
			Value:    val,
			IsSecret: isSecret,
		}

		if varType == "build" {
			buildArgs = append(buildArgs, item)
		} else {
			envVars = append(envVars, item)
		}
	}

	if revealSecrets {
		auditCtx := r.Context()
		if currentUser != nil && currentUser.ID != "" {
			auditCtx = audit.ContextWithActor(auditCtx, currentUser.ID)
		}
		var meta any
		if len(revealedKeys) > 0 {
			meta = map[string]any{
				"keys": strings.Join(revealedKeys, ","),
			}
		}
		audit.Record(auditCtx, "env.reveal", "service", serviceID, meta)
	}

	sendJSON(w, http.StatusOK, models.ServiceEnv{
		EnvVars:   envVars,
		BuildArgs: buildArgs,
	})
}

func (h *Handler) UpdateServiceEnv(w http.ResponseWriter, r *http.Request) {
	serviceID := chi.URLParam(r, "id")

	var sExists bool
	_ = h.db.QueryRow(`SELECT 1 FROM services WHERE id = ?`, serviceID).Scan(&sExists)
	if !sExists {
		sendError(w, http.StatusNotFound, "Service not found")
		return
	}

	var req models.UpdateServiceEnvRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		sendError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	tx, err := h.db.Begin()
	if err != nil {
		sendError(w, http.StatusInternalServerError, "Failed to begin transaction")
		return
	}
	defer tx.Rollback()

	// Clear existing env vars
	if _, err := tx.Exec(`DELETE FROM env_vars WHERE service_id = ?`, serviceID); err != nil {
		sendError(w, http.StatusInternalServerError, "Failed to clear existing env vars")
		return
	}

	// Insert runtime env vars
	stmt, err := tx.Prepare(`
		INSERT INTO env_vars (id, service_id, type, key, value_encrypted, nonce, is_secret, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
	`)
	if err != nil {
		sendError(w, http.StatusInternalServerError, "Failed to prepare insert statement")
		return
	}
	defer stmt.Close()

	for _, ev := range req.EnvVars {
		if ev.Key == "" {
			continue
		}
		ciphertext, nonce, err := crypto.Encrypt([]byte(ev.Value), h.masterKey)
		if err != nil {
			sendError(w, http.StatusInternalServerError, "Failed to encrypt secret variable")
			return
		}
		id := generateID("env")
		if _, err := stmt.Exec(id, serviceID, "env", ev.Key, ciphertext, nonce, ev.IsSecret); err != nil {
			sendError(w, http.StatusInternalServerError, "Failed to insert env var: "+err.Error())
			return
		}
	}

	// Insert build args
	for _, ba := range req.BuildArgs {
		if ba.Key == "" {
			continue
		}
		ciphertext, nonce, err := crypto.Encrypt([]byte(ba.Value), h.masterKey)
		if err != nil {
			sendError(w, http.StatusInternalServerError, "Failed to encrypt build argument")
			return
		}
		id := generateID("env")
		if _, err := stmt.Exec(id, serviceID, "build", ba.Key, ciphertext, nonce, ba.IsSecret); err != nil {
			sendError(w, http.StatusInternalServerError, "Failed to insert build arg: "+err.Error())
			return
		}
	}

	if err := tx.Commit(); err != nil {
		sendError(w, http.StatusInternalServerError, "Failed to commit transaction")
		return
	}

	audit.Record(r.Context(), "env.update", "service", serviceID, map[string]int{
		"env_vars_count":   len(req.EnvVars),
		"build_args_count": len(req.BuildArgs),
		"total_count":      len(req.EnvVars) + len(req.BuildArgs),
	})

	sendJSON(w, http.StatusOK, models.ServiceEnv{
		EnvVars:   req.EnvVars,
		BuildArgs: req.BuildArgs,
	})
}
