package handlers

import (
	"crypto/rand"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"

	"gettako.dev/tako/server/audit"
	"gettako.dev/tako/server/auth"
)

type UserResponse struct {
	ID               string `json:"id"`
	Email            string `json:"email"`
	Name             string `json:"name"`
	Role             string `json:"role"`
	TwoFactorEnabled bool   `json:"two_factor_enabled"`
	PasskeysEnabled  bool   `json:"passkeys_enabled"`
	CreatedAt        string `json:"created_at"`
}

type UpdateUserRoleRequest struct {
	Role string `json:"role"`
}

type CreateInviteRequest struct {
	Role string `json:"role"`
}

type CreateInviteResponse struct {
	ID        string `json:"id"`
	Role      string `json:"role"`
	Token     string `json:"token"`
	InviteURL string `json:"invite_url"`
	ExpiresAt string `json:"expires_at"`
	CreatedAt string `json:"created_at"`
}

type InviteResponse struct {
	ID        string  `json:"id"`
	Role      string  `json:"role"`
	CreatedBy string  `json:"created_by"`
	ExpiresAt string  `json:"expires_at"`
	UsedAt    *string `json:"used_at"`
	CreatedAt string  `json:"created_at"`
}

type InviteValidationResponse struct {
	Valid       bool   `json:"valid"`
	Role        string `json:"role"`
	ClusterName string `json:"cluster_name"`
}

type AcceptInviteRequest struct {
	Token    string `json:"token"`
	Name     string `json:"name"`
	Email    string `json:"email"`
	Password string `json:"password"`
}

// ListUsers returns all registered users in the cluster.
func (h *Handler) ListUsers(w http.ResponseWriter, r *http.Request) {
	rows, err := h.db.QueryContext(r.Context(), `
		SELECT id, email, name, COALESCE(role, 'member'), two_factor_enabled, passkeys_enabled, created_at
		FROM users
		ORDER BY created_at ASC
	`)
	if err != nil {
		sendError(w, http.StatusInternalServerError, "Failed to query users")
		return
	}
	defer rows.Close()

	users := make([]UserResponse, 0)
	for rows.Next() {
		var u UserResponse
		var createdAtRaw string
		if err := rows.Scan(&u.ID, &u.Email, &u.Name, &u.Role, &u.TwoFactorEnabled, &u.PasskeysEnabled, &createdAtRaw); err != nil {
			sendError(w, http.StatusInternalServerError, "Failed to scan user record")
			return
		}

		t, err := time.Parse(time.RFC3339, createdAtRaw)
		if err != nil {
			t, err = time.Parse("2006-01-02 15:04:05", createdAtRaw)
		}
		if err == nil {
			u.CreatedAt = t.UTC().Format(time.RFC3339)
		} else {
			u.CreatedAt = createdAtRaw
		}

		users = append(users, u)
	}

	sendJSON(w, http.StatusOK, users)
}

// UpdateUserRole promotes or demotes a user between 'admin' and 'member'.
func (h *Handler) UpdateUserRole(w http.ResponseWriter, r *http.Request) {
	targetID := chi.URLParam(r, "id")
	if targetID == "" {
		sendError(w, http.StatusBadRequest, "User ID is required")
		return
	}

	var req UpdateUserRoleRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		sendError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	req.Role = strings.TrimSpace(strings.ToLower(req.Role))
	if req.Role != "admin" && req.Role != "member" {
		sendError(w, http.StatusBadRequest, "Role must be 'admin' or 'member'")
		return
	}

	caller := auth.GetUserFromContext(r.Context())
	if caller != nil && caller.ID == targetID && req.Role != "admin" {
		sendError(w, http.StatusBadRequest, "Cannot demote your own account")
		return
	}

	var currentRole string
	err := h.db.QueryRowContext(r.Context(), "SELECT COALESCE(role, 'member') FROM users WHERE id = ?", targetID).Scan(&currentRole)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			sendError(w, http.StatusNotFound, "User not found")
			return
		}
		sendError(w, http.StatusInternalServerError, "Database query error")
		return
	}

	if currentRole == "admin" && req.Role != "admin" {
		var adminCount int
		err := h.db.QueryRowContext(r.Context(), "SELECT count(*) FROM users WHERE role = 'admin'").Scan(&adminCount)
		if err != nil {
			sendError(w, http.StatusInternalServerError, "Database error checking administrator count")
			return
		}
		if adminCount <= 1 {
			sendError(w, http.StatusBadRequest, "Cannot demote the last remaining administrator")
			return
		}
	}

	_, err = h.db.ExecContext(r.Context(), "UPDATE users SET role = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", req.Role, targetID)
	if err != nil {
		sendError(w, http.StatusInternalServerError, "Failed to update user role")
		return
	}

	var updated UserResponse
	var createdAtRaw string
	err = h.db.QueryRowContext(r.Context(), `
		SELECT id, email, name, role, two_factor_enabled, passkeys_enabled, created_at
		FROM users WHERE id = ?
	`, targetID).Scan(&updated.ID, &updated.Email, &updated.Name, &updated.Role, &updated.TwoFactorEnabled, &updated.PasskeysEnabled, &createdAtRaw)
	if err != nil {
		sendError(w, http.StatusInternalServerError, "Failed to fetch updated user")
		return
	}

	t, err := time.Parse(time.RFC3339, createdAtRaw)
	if err != nil {
		t, err = time.Parse("2006-01-02 15:04:05", createdAtRaw)
	}
	if err == nil {
		updated.CreatedAt = t.UTC().Format(time.RFC3339)
	} else {
		updated.CreatedAt = createdAtRaw
	}

	audit.Record(r.Context(), "user.role_updated", "user", targetID, map[string]string{"new_role": req.Role})
	sendJSON(w, http.StatusOK, updated)
}

// DeleteUser removes a user from the system and invalidates all their active sessions.
func (h *Handler) DeleteUser(w http.ResponseWriter, r *http.Request) {
	targetID := chi.URLParam(r, "id")
	if targetID == "" {
		sendError(w, http.StatusBadRequest, "User ID is required")
		return
	}

	caller := auth.GetUserFromContext(r.Context())
	if caller != nil && caller.ID == targetID {
		sendError(w, http.StatusBadRequest, "Cannot delete your own account")
		return
	}

	var targetRole string
	err := h.db.QueryRowContext(r.Context(), "SELECT COALESCE(role, 'member') FROM users WHERE id = ?", targetID).Scan(&targetRole)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			sendError(w, http.StatusNotFound, "User not found")
			return
		}
		sendError(w, http.StatusInternalServerError, "Database error")
		return
	}

	if targetRole == "admin" {
		var adminCount int
		err := h.db.QueryRowContext(r.Context(), "SELECT count(*) FROM users WHERE role = 'admin'").Scan(&adminCount)
		if err != nil {
			sendError(w, http.StatusInternalServerError, "Database error checking administrator count")
			return
		}
		if adminCount <= 1 {
			sendError(w, http.StatusBadRequest, "Cannot delete the last remaining administrator")
			return
		}
	}

	// Invalidate all active sessions immediately
	if _, err := h.db.ExecContext(r.Context(), "DELETE FROM sessions WHERE user_id = ?", targetID); err != nil {
		sendError(w, http.StatusInternalServerError, "Failed to purge user sessions: "+err.Error())
		return
	}

	// Delete passkeys
	_, _ = h.db.ExecContext(r.Context(), "DELETE FROM passkeys WHERE user_id = ?", targetID)

	// Delete user
	if _, err := h.db.ExecContext(r.Context(), "DELETE FROM users WHERE id = ?", targetID); err != nil {
		sendError(w, http.StatusInternalServerError, "Failed to delete user record")
		return
	}

	audit.Record(r.Context(), "user.deleted", "user", targetID, nil)
	sendJSON(w, http.StatusOK, map[string]any{
		"success": true,
		"message": "User deleted successfully",
	})
}

// CreateInvite generates a single-use invitation token.
func (h *Handler) CreateInvite(w http.ResponseWriter, r *http.Request) {
	var req CreateInviteRequest
	if r.Body != nil {
		_ = json.NewDecoder(r.Body).Decode(&req)
	}

	role := strings.TrimSpace(strings.ToLower(req.Role))
	if role == "" {
		role = "member"
	}
	if role != "admin" && role != "member" {
		sendError(w, http.StatusBadRequest, "Role must be 'admin' or 'member'")
		return
	}

	caller := auth.GetUserFromContext(r.Context())
	creatorID := "usr_admin"
	if caller != nil {
		creatorID = caller.ID
	}

	rawBytes := make([]byte, 24)
	if _, err := rand.Read(rawBytes); err != nil {
		sendError(w, http.StatusInternalServerError, "Failed to generate token")
		return
	}
	rawToken := "tako_inv_" + hex.EncodeToString(rawBytes)

	hash := sha256.Sum256([]byte(rawToken))
	tokenHash := hex.EncodeToString(hash[:])

	inviteID := generateID("inv")
	expiresAt := time.Now().Add(7 * 24 * time.Hour)

	_, err := h.db.ExecContext(r.Context(), `
		INSERT INTO invites (id, token_hash, role, created_by, expires_at, created_at)
		VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
	`, inviteID, tokenHash, role, creatorID, expiresAt)
	if err != nil {
		sendError(w, http.StatusInternalServerError, "Failed to save invitation")
		return
	}

	inviteURL := "/register?token=" + rawToken

	audit.Record(r.Context(), "invitation.created", "invite", inviteID, map[string]string{
		"role": role,
	})

	sendJSON(w, http.StatusCreated, CreateInviteResponse{
		ID:        inviteID,
		Role:      role,
		Token:     rawToken,
		InviteURL: inviteURL,
		ExpiresAt: expiresAt.UTC().Format(time.RFC3339),
		CreatedAt: time.Now().UTC().Format(time.RFC3339),
	})
}

// ListInvites lists pending active invitations.
func (h *Handler) ListInvites(w http.ResponseWriter, r *http.Request) {
	rows, err := h.db.QueryContext(r.Context(), `
		SELECT id, role, created_by, expires_at, used_at, created_at
		FROM invites
		WHERE used_at IS NULL AND expires_at > CURRENT_TIMESTAMP
		ORDER BY created_at DESC
	`)
	if err != nil {
		sendError(w, http.StatusInternalServerError, "Failed to query invitations")
		return
	}
	defer rows.Close()

	invites := make([]InviteResponse, 0)
	for rows.Next() {
		var inv InviteResponse
		var expiresAtRaw, createdAtRaw string
		var usedAtRaw sql.NullString
		if err := rows.Scan(&inv.ID, &inv.Role, &inv.CreatedBy, &expiresAtRaw, &usedAtRaw, &createdAtRaw); err != nil {
			sendError(w, http.StatusInternalServerError, "Failed to scan invite record")
			return
		}

		if t, err := time.Parse(time.RFC3339, expiresAtRaw); err == nil {
			inv.ExpiresAt = t.UTC().Format(time.RFC3339)
		} else if t, err := time.Parse("2006-01-02 15:04:05", expiresAtRaw); err == nil {
			inv.ExpiresAt = t.UTC().Format(time.RFC3339)
		} else {
			inv.ExpiresAt = expiresAtRaw
		}

		if t, err := time.Parse(time.RFC3339, createdAtRaw); err == nil {
			inv.CreatedAt = t.UTC().Format(time.RFC3339)
		} else if t, err := time.Parse("2006-01-02 15:04:05", createdAtRaw); err == nil {
			inv.CreatedAt = t.UTC().Format(time.RFC3339)
		} else {
			inv.CreatedAt = createdAtRaw
		}

		if usedAtRaw.Valid {
			formatted := usedAtRaw.String
			if t, err := time.Parse(time.RFC3339, usedAtRaw.String); err == nil {
				formatted = t.UTC().Format(time.RFC3339)
			} else if t, err := time.Parse("2006-01-02 15:04:05", usedAtRaw.String); err == nil {
				formatted = t.UTC().Format(time.RFC3339)
			}
			inv.UsedAt = &formatted
		}

		invites = append(invites, inv)
	}

	sendJSON(w, http.StatusOK, invites)
}

// RevokeInvite removes a pending invitation.
func (h *Handler) RevokeInvite(w http.ResponseWriter, r *http.Request) {
	inviteID := chi.URLParam(r, "id")
	if inviteID == "" {
		sendError(w, http.StatusBadRequest, "Invite ID is required")
		return
	}

	res, err := h.db.ExecContext(r.Context(), "DELETE FROM invites WHERE id = ?", inviteID)
	if err != nil {
		sendError(w, http.StatusInternalServerError, "Failed to delete invitation")
		return
	}

	rows, _ := res.RowsAffected()
	if rows == 0 {
		sendError(w, http.StatusNotFound, "Invitation not found")
		return
	}

	audit.Record(r.Context(), "invitation.revoked", "invite", inviteID, nil)
	sendJSON(w, http.StatusOK, map[string]any{
		"success": true,
		"message": "Invitation revoked successfully",
	})
}

// ValidateInvite is a public endpoint verifying token validity before showing registration form.
func (h *Handler) ValidateInvite(w http.ResponseWriter, r *http.Request) {
	token := strings.TrimSpace(r.URL.Query().Get("token"))
	if token == "" {
		sendError(w, http.StatusBadRequest, "Invitation token is required")
		return
	}

	hash := sha256.Sum256([]byte(token))
	tokenHash := hex.EncodeToString(hash[:])

	var role string
	var expiresAtRaw string
	var usedAtRaw sql.NullString

	err := h.db.QueryRowContext(r.Context(), `
		SELECT role, expires_at, used_at
		FROM invites
		WHERE token_hash = ?
	`, tokenHash).Scan(&role, &expiresAtRaw, &usedAtRaw)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			sendError(w, http.StatusNotFound, "Invitation not found or invalid")
			return
		}
		sendError(w, http.StatusInternalServerError, "Database error")
		return
	}

	if usedAtRaw.Valid && usedAtRaw.String != "" {
		sendError(w, http.StatusBadRequest, "Invitation has already been used")
		return
	}

	var expiresAt time.Time
	if t, err := time.Parse(time.RFC3339, expiresAtRaw); err == nil {
		expiresAt = t
	} else if t, err := time.Parse("2006-01-02 15:04:05", expiresAtRaw); err == nil {
		expiresAt = t
	}

	if !expiresAt.IsZero() && time.Now().After(expiresAt) {
		sendError(w, http.StatusBadRequest, "Invitation has expired")
		return
	}

	clusterName := "Tako"
	if h.domain != "" && h.domain != "localhost" && h.domain != "127.0.0.1" {
		clusterName = h.domain
	}

	sendJSON(w, http.StatusOK, InviteValidationResponse{
		Valid:       true,
		Role:        role,
		ClusterName: clusterName,
	})
}

// AcceptInvite registers a new user with a valid invitation token and establishes a session.
func (h *Handler) AcceptInvite(w http.ResponseWriter, r *http.Request) {
	var req AcceptInviteRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		sendError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	req.Token = strings.TrimSpace(req.Token)
	req.Name = strings.TrimSpace(req.Name)
	req.Email = strings.TrimSpace(strings.ToLower(req.Email))

	if req.Token == "" {
		sendError(w, http.StatusBadRequest, "Token is required")
		return
	}
	if req.Name == "" {
		sendError(w, http.StatusBadRequest, "Name is required")
		return
	}
	if req.Email == "" || !strings.Contains(req.Email, "@") {
		sendError(w, http.StatusBadRequest, "Valid email address is required")
		return
	}
	if len(req.Password) < 8 {
		sendError(w, http.StatusBadRequest, "Password must be at least 8 characters long")
		return
	}

	hash := sha256.Sum256([]byte(req.Token))
	tokenHash := hex.EncodeToString(hash[:])

	var inviteID, role string
	var expiresAtRaw string
	var usedAtRaw sql.NullString

	err := h.db.QueryRowContext(r.Context(), `
		SELECT id, role, expires_at, used_at
		FROM invites
		WHERE token_hash = ?
	`, tokenHash).Scan(&inviteID, &role, &expiresAtRaw, &usedAtRaw)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			sendError(w, http.StatusNotFound, "Invitation not found or invalid")
			return
		}
		sendError(w, http.StatusInternalServerError, "Database error")
		return
	}

	if usedAtRaw.Valid && usedAtRaw.String != "" {
		sendError(w, http.StatusBadRequest, "Invitation has already been used")
		return
	}

	var expiresAt time.Time
	if t, err := time.Parse(time.RFC3339, expiresAtRaw); err == nil {
		expiresAt = t
	} else if t, err := time.Parse("2006-01-02 15:04:05", expiresAtRaw); err == nil {
		expiresAt = t
	}

	if !expiresAt.IsZero() && time.Now().After(expiresAt) {
		sendError(w, http.StatusBadRequest, "Invitation has expired")
		return
	}

	// Verify email is not already taken
	var count int
	err = h.db.QueryRowContext(r.Context(), "SELECT count(*) FROM users WHERE email = ?", req.Email).Scan(&count)
	if err != nil {
		sendError(w, http.StatusInternalServerError, "Database error checking email availability")
		return
	}
	if count > 0 {
		sendError(w, http.StatusConflict, "Email address is already in use")
		return
	}

	passwordHash, err := auth.HashPassword(req.Password)
	if err != nil {
		sendError(w, http.StatusInternalServerError, "Failed to process password")
		return
	}

	userID := generateID("usr")
	_, err = h.db.ExecContext(r.Context(), `
		INSERT INTO users (id, email, name, role, password_hash, two_factor_enabled, passkeys_enabled, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, 0, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
	`, userID, req.Email, req.Name, role, passwordHash)
	if err != nil {
		sendError(w, http.StatusInternalServerError, "Failed to create user account")
		return
	}

	// Mark invite as consumed
	_, err = h.db.ExecContext(r.Context(), `
		UPDATE invites SET used_at = CURRENT_TIMESTAMP WHERE id = ?
	`, inviteID)
	if err != nil {
		sendError(w, http.StatusInternalServerError, "Failed to update invitation status")
		return
	}

	// Establish session
	session, err := auth.CreateSession(h.db, userID)
	if err != nil {
		sendError(w, http.StatusInternalServerError, "Failed to establish user session")
		return
	}

	auth.SetSessionCookie(w, session.ID, h.domain, session.ExpiresAt)

	regCtx := audit.ContextWithActor(r.Context(), req.Email)
	audit.Record(regCtx, "user.registered", "user", userID, map[string]string{"role": role})
	audit.Record(regCtx, "session.login", "session", session.ID, map[string]string{"method": "invite"})

	userObj := &auth.User{
		ID:               userID,
		Email:            req.Email,
		Name:             req.Name,
		Role:             role,
		TwoFactorEnabled: false,
		PasskeysEnabled:  false,
		CreatedAt:        time.Now().UTC(),
		UpdatedAt:        time.Now().UTC(),
	}

	sendJSON(w, http.StatusOK, auth.LoginResponse{
		User:        userObj,
		Requires2FA: false,
		SessionID:   &session.ID,
	})
}
