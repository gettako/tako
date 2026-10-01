package auth

import (
	"crypto/sha256"
	"crypto/subtle"
	"database/sql"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"

	"gettako.dev/tako/internal/crypto"
	"gettako.dev/tako/server/audit"
)

type Handler struct {
	db           *sql.DB
	domain       string
	wa           *WebAuthnService
	masterKey    []byte
	loginLimiter *loginRateLimiter
}

func NewHandler(db *sql.DB, domain string, masterKey ...[]byte) (*Handler, error) {
	wa, err := NewWebAuthnService(db, domain)
	if err != nil {
		return nil, err
	}
	var mk []byte
	if len(masterKey) > 0 && len(masterKey[0]) == 32 {
		mk = masterKey[0]
	}
	return &Handler{
		db:           db,
		domain:       domain,
		wa:           wa,
		masterKey:    mk,
		loginLimiter: newLoginRateLimiter(),
	}, nil
}

func (h *Handler) SetMasterKey(k []byte) {
	if len(k) == 32 {
		h.masterKey = k
	}
}

func (h *Handler) getMasterKey() []byte {
	if len(h.masterKey) == 32 {
		return h.masterKey
	}
	return crypto.DeriveKey("tako-auth-master-key-seed")
}

func (h *Handler) encryptSecret(secret string) (string, error) {
	if secret == "" {
		return "", nil
	}
	key := h.getMasterKey()
	payload, err := crypto.EncryptVersioned([]byte(secret), key)
	if err != nil {
		return "", err
	}
	return base64.StdEncoding.EncodeToString(payload), nil
}

func (h *Handler) decryptSecret(stored string) (string, error) {
	if stored == "" {
		return "", nil
	}
	key := h.getMasterKey()
	data, err := base64.StdEncoding.DecodeString(stored)
	if err != nil {
		// Fallback for legacy unencrypted Base32 TOTP secrets
		return stored, nil
	}
	decrypted, err := crypto.DecryptVersioned(data, key)
	if err != nil {
		// Fallback if decode succeeded on plaintext string but decrypt failed
		return stored, nil
	}
	return string(decrypted), nil
}

// HashRecoveryCode returns a SHA-256 hex string of the normalized recovery code.
func HashRecoveryCode(code string) string {
	clean := strings.ToLower(strings.TrimSpace(code))
	clean = strings.ReplaceAll(clean, "-", "")
	hash := sha256.Sum256([]byte(clean))
	return hex.EncodeToString(hash[:])
}

func (h *Handler) verifyAndConsumeRecoveryCode(userID string, rawStoredCodes string, inputCode string) (bool, error) {
	if rawStoredCodes == "" {
		return false, nil
	}

	var recoveryCodes []string
	if err := json.Unmarshal([]byte(rawStoredCodes), &recoveryCodes); err != nil {
		return false, err
	}

	inputHash := HashRecoveryCode(inputCode)
	inputClean := strings.ToLower(strings.TrimSpace(inputCode))

	for i, rc := range recoveryCodes {
		isMatch := subtle.ConstantTimeCompare([]byte(rc), []byte(inputHash)) == 1
		if !isMatch && subtle.ConstantTimeCompare([]byte(strings.ToLower(rc)), []byte(inputClean)) == 1 {
			isMatch = true
		}

		if isMatch {
			recoveryCodes = append(recoveryCodes[:i], recoveryCodes[i+1:]...)
			updatedRC, _ := json.Marshal(recoveryCodes)
			_, err := h.db.Exec("UPDATE users SET recovery_codes = ? WHERE id = ?", string(updatedRC), userID)
			return true, err
		}
	}

	return false, nil
}

type LoginRequest struct {
	Email         *string `json:"email,omitempty"`
	Password      string  `json:"password"`
	TwoFactorCode *string `json:"two_factor_code,omitempty"`
}

type LoginResponse struct {
	User        *User   `json:"user"`
	Requires2FA bool    `json:"requires_2fa"`
	SessionID   *string `json:"session_id,omitempty"`
}

func (h *Handler) RegisterRoutes(r chi.Router) {
	// Public routes
	r.Post("/login", h.Login)
	r.Post("/passkey/login/options", h.BeginPasskeyLogin)
	r.Post("/passkey/login/begin", h.BeginPasskeyLogin)
	r.Post("/passkey/login/verify", h.FinishPasskeyLogin)
	r.Post("/passkey/login/finish", h.FinishPasskeyLogin)

	// Protected routes
	r.Group(func(protected chi.Router) {
		protected.Use(RequireAuth(h.db))
		protected.Post("/logout", h.Logout)
		protected.Get("/me", h.Me)
		protected.Patch("/profile", h.UpdateProfile)
		protected.Post("/password", h.ChangePassword)
		protected.Post("/change-password", h.ChangePassword)
		protected.Post("/2fa/setup", h.Setup2FA)
		protected.Post("/2fa/verify", h.Verify2FA)
		protected.Post("/passkey/register/options", h.BeginPasskeyRegistration)
		protected.Post("/passkey/register/begin", h.BeginPasskeyRegistration)
		protected.Post("/passkey/register/verify", h.FinishPasskeyRegistration)
		protected.Post("/passkey/register/finish", h.FinishPasskeyRegistration)
	})
}

func (h *Handler) Login(w http.ResponseWriter, r *http.Request) {
	ip := clientIP(r)

	// Check rate limit before doing any work.
	if ok, retryAfter := h.loginLimiter.allow(ip); !ok {
		w.Header().Set("Retry-After", strconv.Itoa(retryAfter))
		sendError(w, http.StatusTooManyRequests, "Too many failed login attempts, please try again later")
		return
	}

	var req LoginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		sendError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	var userCount int
	err := h.db.QueryRow("SELECT count(*) FROM users").Scan(&userCount)
	if err != nil {
		sendError(w, http.StatusInternalServerError, "Database error")
		return
	}

	// First boot: auto-create the single admin user (not counted as a failure).
	if userCount == 0 {
		hash, err := HashPassword(req.Password)
		if err != nil {
			sendError(w, http.StatusInternalServerError, "Failed to hash password")
			return
		}

		user := &User{
			ID:               "usr_admin",
			Email:            "admin@gettako.dev",
			Name:             "Admin Owner",
			Role:             "admin",
			PasswordHash:     hash,
			TwoFactorEnabled: false,
			PasskeysEnabled:  false,
			CreatedAt:        time.Now(),
			UpdatedAt:        time.Now(),
		}

		_, err = h.db.Exec(`
			INSERT INTO users (id, email, name, role, password_hash, two_factor_enabled, passkeys_enabled, created_at, updated_at)
			VALUES (?, ?, ?, 'admin', ?, 0, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
		`, user.ID, user.Email, user.Name, user.PasswordHash)
		if err != nil {
			sendError(w, http.StatusInternalServerError, "Failed to create administrator account")
			return
		}

		session, err := CreateSession(h.db, user.ID)
		if err != nil {
			sendError(w, http.StatusInternalServerError, "Failed to create session")
			return
		}

		h.loginLimiter.resetIP(ip)
		SetSessionCookie(w, session.ID, h.domain, session.ExpiresAt)
		loginCtx := audit.ContextWithActor(r.Context(), user.Email)
		audit.Record(loginCtx, "session.login", "session", session.ID, map[string]string{"method": "first_boot"})
		sendJSON(w, http.StatusOK, LoginResponse{
			User:        user,
			Requires2FA: false,
			SessionID:   &session.ID,
		})
		return
	}

	// Existing user login.
	var u User
	var createdAtStr, updatedAtStr string
	var row *sql.Row
	if req.Email != nil && strings.TrimSpace(*req.Email) != "" {
		row = h.db.QueryRow(`
			SELECT id, email, name, COALESCE(role, 'member'), password_hash, two_factor_enabled,
			       COALESCE(two_factor_secret, ''), COALESCE(recovery_codes, ''),
			       passkeys_enabled, created_at, updated_at
			FROM users WHERE email = ?
		`, strings.TrimSpace(*req.Email))
	} else {
		row = h.db.QueryRow(`
			SELECT id, email, name, COALESCE(role, 'member'), password_hash, two_factor_enabled,
			       COALESCE(two_factor_secret, ''), COALESCE(recovery_codes, ''),
			       passkeys_enabled, created_at, updated_at
			FROM users ORDER BY created_at ASC LIMIT 1
		`)
	}
	err = row.Scan(
		&u.ID, &u.Email, &u.Name, &u.Role, &u.PasswordHash,
		&u.TwoFactorEnabled, &u.TwoFactorSecret, &u.RecoveryCodes,
		&u.PasskeysEnabled, &createdAtStr, &updatedAtStr,
	)
	if err != nil {
		// User not found counts as a failed attempt.
		h.loginLimiter.recordFailure(ip)
		sendError(w, http.StatusInternalServerError, "Failed to query user")
		return
	}

	valid, err := VerifyPassword(req.Password, u.PasswordHash)
	if err != nil || !valid {
		h.loginLimiter.recordFailure(ip)
		sendError(w, http.StatusUnauthorized, "Invalid credentials")
		return
	}

	if u.TwoFactorEnabled {
		if req.TwoFactorCode == nil || strings.TrimSpace(*req.TwoFactorCode) == "" {
			// 2FA prompt — not a failure, do not increment counter.
			sendJSON(w, http.StatusOK, LoginResponse{
				User:        &u,
				Requires2FA: true,
			})
			return
		}

		code := strings.TrimSpace(*req.TwoFactorCode)
		plainSecret, _ := h.decryptSecret(u.TwoFactorSecret)
		validCode := ValidateTwoFactorCode(code, plainSecret)
		if !validCode {
			// Check recovery codes.
			consumed, recErr := h.verifyAndConsumeRecoveryCode(u.ID, u.RecoveryCodes, code)
			if recErr == nil && consumed {
				validCode = true
			}
		}

		if !validCode {
			h.loginLimiter.recordFailure(ip)
			sendError(w, http.StatusUnauthorized, "Invalid verification code")
			return
		}
	}

	session, err := CreateSession(h.db, u.ID)
	if err != nil {
		sendError(w, http.StatusInternalServerError, "Failed to create session")
		return
	}

	// Successful login: clear failure counter.
	h.loginLimiter.resetIP(ip)
	SetSessionCookie(w, session.ID, h.domain, session.ExpiresAt)
	loginCtx := audit.ContextWithActor(r.Context(), u.Email)
	audit.Record(loginCtx, "session.login", "session", session.ID, map[string]string{"method": "password"})
	sendJSON(w, http.StatusOK, LoginResponse{
		User:        &u,
		Requires2FA: false,
		SessionID:   &session.ID,
	})
}

func (h *Handler) Logout(w http.ResponseWriter, r *http.Request) {
	sessionID := ""
	if cookie, err := r.Cookie(SessionCookieName); err == nil {
		sessionID = cookie.Value
		_ = DeleteSession(h.db, cookie.Value)
	}
	ClearSessionCookie(w, h.domain)
	audit.Record(r.Context(), "session.logout", "session", sessionID, nil)
	sendJSON(w, http.StatusOK, map[string]any{
		"success": true,
		"message": "Session terminated successfully",
	})
}

func (h *Handler) Me(w http.ResponseWriter, r *http.Request) {
	user := GetUserFromContext(r.Context())
	if user == nil {
		sendError(w, http.StatusUnauthorized, "Authentication required")
		return
	}
	sendJSON(w, http.StatusOK, user)
}

type UpdateProfileRequest struct {
	Email string  `json:"email"`
	Name  *string `json:"name,omitempty"`
}

func (h *Handler) UpdateProfile(w http.ResponseWriter, r *http.Request) {
	user := GetUserFromContext(r.Context())
	var req UpdateProfileRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		sendError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	if req.Email != "" {
		user.Email = req.Email
	}
	if req.Name != nil && *req.Name != "" {
		user.Name = *req.Name
	}

	_, err := h.db.Exec(`UPDATE users SET email = ?, name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, user.Email, user.Name, user.ID)
	if err != nil {
		sendError(w, http.StatusInternalServerError, "Failed to update profile")
		return
	}

	sendJSON(w, http.StatusOK, user)
}

type ChangePasswordRequest struct {
	CurrentPassword string `json:"current_password"`
	NewPassword     string `json:"new_password"`
}

func (h *Handler) ChangePassword(w http.ResponseWriter, r *http.Request) {
	user := GetUserFromContext(r.Context())
	var req ChangePasswordRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		sendError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	if len(req.NewPassword) < 8 {
		sendError(w, http.StatusBadRequest, "New password must be at least 8 characters")
		return
	}

	valid, err := VerifyPassword(req.CurrentPassword, user.PasswordHash)
	if err != nil || !valid {
		sendError(w, http.StatusUnauthorized, "Current password incorrect")
		return
	}

	newHash, err := HashPassword(req.NewPassword)
	if err != nil {
		sendError(w, http.StatusInternalServerError, "Failed to hash new password")
		return
	}

	_, err = h.db.Exec(`UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, newHash, user.ID)
	if err != nil {
		sendError(w, http.StatusInternalServerError, "Failed to update password")
		return
	}

	sendJSON(w, http.StatusOK, map[string]any{
		"success": true,
		"message": "Password updated successfully",
	})
}

func (h *Handler) Setup2FA(w http.ResponseWriter, r *http.Request) {
	user := GetUserFromContext(r.Context())
	setup, err := GenerateTwoFactorSetup(user.Email)
	if err != nil {
		sendError(w, http.StatusInternalServerError, "Failed to generate 2FA credentials")
		return
	}

	encryptedSecret, err := h.encryptSecret(setup.Secret)
	if err != nil {
		sendError(w, http.StatusInternalServerError, "Failed to encrypt 2FA secret")
		return
	}

	hashedCodes := make([]string, len(setup.RecoveryCodes))
	for i, code := range setup.RecoveryCodes {
		hashedCodes[i] = HashRecoveryCode(code)
	}
	rcJSON, _ := json.Marshal(hashedCodes)

	_, err = h.db.Exec(`UPDATE users SET two_factor_secret = ?, recovery_codes = ? WHERE id = ?`, encryptedSecret, string(rcJSON), user.ID)
	if err != nil {
		sendError(w, http.StatusInternalServerError, "Failed to save 2FA credentials")
		return
	}

	sendJSON(w, http.StatusOK, setup)
}

type TwoFactorVerifyRequest struct {
	Code string `json:"code"`
}

func (h *Handler) Verify2FA(w http.ResponseWriter, r *http.Request) {
	user := GetUserFromContext(r.Context())
	var req TwoFactorVerifyRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		sendError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	var storedSecret string
	err := h.db.QueryRow(`SELECT COALESCE(two_factor_secret, '') FROM users WHERE id = ?`, user.ID).Scan(&storedSecret)
	if err != nil || storedSecret == "" {
		sendError(w, http.StatusBadRequest, "2FA setup has not been initiated")
		return
	}

	secret, err := h.decryptSecret(storedSecret)
	if err != nil || secret == "" {
		sendError(w, http.StatusInternalServerError, "Failed to decrypt 2FA secret")
		return
	}

	if !ValidateTwoFactorCode(req.Code, secret) {
		sendError(w, http.StatusUnauthorized, "Invalid 6-digit verification code")
		return
	}

	_, err = h.db.Exec(`UPDATE users SET two_factor_enabled = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, user.ID)
	if err != nil {
		sendError(w, http.StatusInternalServerError, "Failed to activate 2FA")
		return
	}

	sendJSON(w, http.StatusOK, map[string]any{
		"success": true,
		"message": "Two-factor authentication enabled successfully",
	})
}

func (h *Handler) BeginPasskeyLogin(w http.ResponseWriter, r *http.Request) {
	var user User
	err := h.db.QueryRow(`SELECT id, email, name FROM users LIMIT 1`).Scan(&user.ID, &user.Email, &user.Name)
	if err != nil {
		sendError(w, http.StatusNotFound, "No administrator registered")
		return
	}

	uWithCreds, err := h.wa.LoadUserCredentials(&user)
	if err != nil {
		sendError(w, http.StatusInternalServerError, "Failed to load user credentials")
		return
	}

	options, sessionData, err := h.wa.wa.BeginLogin(uWithCreds)
	if err != nil {
		sendError(w, http.StatusInternalServerError, err.Error())
		return
	}

	h.wa.SaveSession("login_"+user.ID, sessionData)
	sendJSON(w, http.StatusOK, options.Response)
}

func (h *Handler) FinishPasskeyLogin(w http.ResponseWriter, r *http.Request) {
	var user User
	err := h.db.QueryRow(`SELECT id, email, name FROM users LIMIT 1`).Scan(&user.ID, &user.Email, &user.Name)
	if err != nil {
		sendError(w, http.StatusNotFound, "No administrator registered")
		return
	}

	sessionData, ok := h.wa.GetSession("login_" + user.ID)
	if !ok {
		sendError(w, http.StatusBadRequest, "Passkey session expired or not found")
		return
	}

	uWithCreds, err := h.wa.LoadUserCredentials(&user)
	if err != nil {
		sendError(w, http.StatusInternalServerError, "Failed to load credentials")
		return
	}

	_, err = h.wa.wa.FinishLogin(uWithCreds, *sessionData, r)
	if err != nil {
		sendError(w, http.StatusUnauthorized, "Passkey authentication failed")
		return
	}

	session, err := CreateSession(h.db, user.ID)
	if err != nil {
		sendError(w, http.StatusInternalServerError, "Failed to create session")
		return
	}

	SetSessionCookie(w, session.ID, h.domain, session.ExpiresAt)
	audit.Record(r.Context(), "session.login", "session", session.ID, map[string]string{"method": "passkey"})
	sendJSON(w, http.StatusOK, LoginResponse{
		User:        &user,
		Requires2FA: false,
		SessionID:   &session.ID,
	})
}

func (h *Handler) BeginPasskeyRegistration(w http.ResponseWriter, r *http.Request) {
	user := GetUserFromContext(r.Context())
	uWithCreds, err := h.wa.LoadUserCredentials(user)
	if err != nil {
		sendError(w, http.StatusInternalServerError, "Failed to load credentials")
		return
	}

	options, sessionData, err := h.wa.wa.BeginRegistration(uWithCreds)
	if err != nil {
		sendError(w, http.StatusInternalServerError, err.Error())
		return
	}

	h.wa.SaveSession("reg_"+user.ID, sessionData)
	sendJSON(w, http.StatusOK, options.Response)
}

func (h *Handler) FinishPasskeyRegistration(w http.ResponseWriter, r *http.Request) {
	user := GetUserFromContext(r.Context())
	sessionData, ok := h.wa.GetSession("reg_" + user.ID)
	if !ok {
		sendError(w, http.StatusBadRequest, "Registration session expired")
		return
	}

	uWithCreds, _ := h.wa.LoadUserCredentials(user)
	credential, err := h.wa.wa.FinishRegistration(uWithCreds, *sessionData, r)
	if err != nil {
		sendError(w, http.StatusBadRequest, "Passkey verification failed")
		return
	}

	credBlob, err := json.Marshal(credential)
	if err != nil {
		sendError(w, http.StatusInternalServerError, "Failed to serialize credential")
		return
	}

	_, err = h.db.Exec(`
		INSERT INTO passkeys (id, user_id, name, credential)
		VALUES (?, ?, 'Hardware Passkey', ?)
	`, string(credential.ID), user.ID, credBlob)
	if err != nil {
		sendError(w, http.StatusInternalServerError, "Failed to save passkey")
		return
	}

	_, _ = h.db.Exec(`UPDATE users SET passkeys_enabled = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, user.ID)

	sendJSON(w, http.StatusOK, map[string]any{
		"success":       true,
		"credential_id": string(credential.ID),
	})
}

func sendJSON(w http.ResponseWriter, status int, data any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(data)
}

func sendError(w http.ResponseWriter, status int, message string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(map[string]string{
		"error":   http.StatusText(status),
		"message": message,
	})
}
