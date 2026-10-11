package api

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"golang.org/x/crypto/bcrypt"

	"gettako.dev/tako/internal/orchestrator"
	"gettako.dev/tako/internal/store/db"
)

type LoginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type AuthUserResponse struct {
	ID               string `json:"id"`
	Name             string `json:"name"`
	Email            string `json:"email"`
	Role             string `json:"role"`
	AvatarURL        string `json:"avatarUrl,omitempty"`
	TwoFactorEnabled bool   `json:"twoFactorEnabled"`
	CreatedAt        string `json:"createdAt,omitempty"`
}

type LoginResponse struct {
	Token string           `json:"token"`
	User  AuthUserResponse `json:"user"`
}

type UpdateProfileRequest struct {
	Name      string `json:"name"`
	Email     string `json:"email"`
	AvatarURL string `json:"avatarUrl,omitempty"`
}

type ChangePasswordRequest struct {
	CurrentPassword string `json:"currentPassword"`
	NewPassword     string `json:"newPassword"`
}

type TwoFASetting struct {
	Enabled       bool     `json:"enabled"`
	Secret        string   `json:"secret,omitempty"`
	RecoveryCodes []string `json:"recoveryCodes,omitempty"`
}

type PasskeyItem struct {
	ID           string `json:"id"`
	Name         string `json:"name"`
	CredentialID string `json:"credentialId,omitempty"`
	CreatedAt    string `json:"createdAt"`
	LastUsedAt   string `json:"lastUsedAt,omitempty"`
}

type SessionItem struct {
	ID         string `json:"id"`
	UserID     string `json:"userId"`
	IPAddress  string `json:"ipAddress"`
	UserAgent  string `json:"userAgent"`
	Device     string `json:"device"`
	Location   string `json:"location"`
	Current    bool   `json:"current"`
	LastActive string `json:"lastActive"`
}

func extractAuthToken(r *http.Request) string {
	if auth := r.Header.Get("Authorization"); auth != "" {
		if strings.HasPrefix(strings.ToLower(auth), "bearer ") {
			return strings.TrimSpace(auth[7:])
		}
		return strings.TrimSpace(auth)
	}
	if c, err := r.Cookie("tako_session"); err == nil && c.Value != "" {
		return strings.TrimSpace(c.Value)
	}
	return ""
}

func resolveAuthUser(r *http.Request, orch *orchestrator.Orchestrator) (db.User, error) {
	token := extractAuthToken(r)
	if token != "" {
		if sess, ok := orch.GetUserSession(token); ok {
			if u, err := orch.Queries().GetUserByID(r.Context(), sess.UserID); err == nil {
				return u, nil
			}
		}
	}
	users, err := orch.Queries().ListUsers(r.Context())
	if err == nil && len(users) > 0 {
		return orch.Queries().GetUserByID(r.Context(), users[0].ID)
	}
	return db.User{}, fmt.Errorf("unauthenticated")
}

func registerAuthRoutes(r chi.Router, orch *orchestrator.Orchestrator) {
	r.Route("/auth", func(r chi.Router) {
		r.Post("/login", handleLogin(orch))
		r.Post("/passkey/login", handlePasskeyLogin(orch))
		r.Post("/logout", handleLogout(orch))
		r.Get("/me", handleGetMe(orch))
		r.Put("/profile", handleUpdateProfile(orch))
		r.Put("/password", handleChangePassword(orch))
		r.Put("/2fa", handleUpdate2FA(orch))
		r.Get("/passkeys", handleGetPasskeys(orch))
		r.Post("/passkeys", handleAddPasskey(orch))
		r.Delete("/passkeys/{id}", handleDeletePasskey(orch))
		r.Get("/sessions", handleGetSessions(orch))
		r.Delete("/sessions/{id}", handleDeleteSession(orch))
		r.Post("/sessions/revoke-others", handleRevokeOtherSessions(orch))
		r.Get("/users", handleListUsers(orch))
		r.Post("/users", handleCreateUser(orch))
		r.Put("/users/{id}/role", handleUpdateUserRole(orch))
		r.Delete("/users/{id}", handleDeleteUser(orch))
	})
}

func handleLogin(orch *orchestrator.Orchestrator) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req LoginRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, `{"error":"Invalid request payload"}`, http.StatusBadRequest)
			return
		}

		req.Email = strings.TrimSpace(req.Email)
		if req.Email == "" || req.Password == "" {
			http.Error(w, `{"error":"Email and password are required"}`, http.StatusBadRequest)
			return
		}

		user, err := orch.Queries().GetUserByEmail(r.Context(), req.Email)
		if err != nil {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusUnauthorized)
			_ = json.NewEncoder(w).Encode(map[string]string{"error": "Invalid email or password"})
			return
		}

		if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password)); err != nil {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusUnauthorized)
			_ = json.NewEncoder(w).Encode(map[string]string{"error": "Invalid email or password"})
			return
		}

		token := "tako_tk_" + randomHexID(24)
		orch.RegisterUserSession(token, user)

		avatar := ""
		if user.AvatarUrl.Valid {
			avatar = user.AvatarUrl.String
		}

		twoFactorEnabled := is2FAEnabled(r.Context(), orch)

		resp := LoginResponse{
			Token: token,
			User: AuthUserResponse{
				ID:               user.ID,
				Name:             user.Name,
				Email:            user.Email,
				Role:             user.Role,
				AvatarURL:        avatar,
				TwoFactorEnabled: twoFactorEnabled,
				CreatedAt:        user.CreatedAt.Format(time.RFC3339),
			},
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(resp)
	}
}

func handleLogout(orch *orchestrator.Orchestrator) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		token := extractAuthToken(r)
		if token != "" {
			orch.RevokeUserSession(token)
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(map[string]bool{"success": true})
	}
}

func is2FAEnabled(ctx context.Context, orch *orchestrator.Orchestrator) bool {
	if s, err := orch.Queries().GetSetting(ctx, "user_2fa"); err == nil {
		var twoFA TwoFASetting
		if err := json.Unmarshal([]byte(s.Value), &twoFA); err == nil {
			return twoFA.Enabled
		}
	}
	return false
}

func handleGetMe(orch *orchestrator.Orchestrator) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		user, err := resolveAuthUser(r, orch)
		if err != nil {
			http.Error(w, `{"error":"No authenticated user"}`, http.StatusUnauthorized)
			return
		}

		avatar := ""
		if user.AvatarUrl.Valid {
			avatar = user.AvatarUrl.String
		}

		twoFactorEnabled := is2FAEnabled(r.Context(), orch)

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"authenticated": true,
			"user": AuthUserResponse{
				ID:               user.ID,
				Name:             user.Name,
				Email:            user.Email,
				Role:             user.Role,
				AvatarURL:        avatar,
				TwoFactorEnabled: twoFactorEnabled,
				CreatedAt:        user.CreatedAt.Format(time.RFC3339),
			},
		})
	}
}

func handleUpdateProfile(orch *orchestrator.Orchestrator) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req UpdateProfileRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, `{"error":"Invalid request payload"}`, http.StatusBadRequest)
			return
		}

		req.Name = strings.TrimSpace(req.Name)
		req.Email = strings.TrimSpace(req.Email)
		if req.Name == "" || req.Email == "" {
			http.Error(w, `{"error":"Name and email are required"}`, http.StatusBadRequest)
			return
		}

		users, err := orch.Queries().ListUsers(r.Context())
		if err != nil || len(users) == 0 {
			http.Error(w, `{"error":"No authenticated user found"}`, http.StatusNotFound)
			return
		}

		targetUser := users[0]
		updated, err := orch.Queries().UpdateUserProfile(r.Context(), db.UpdateUserProfileParams{
			ID:    targetUser.ID,
			Name:  req.Name,
			Email: req.Email,
			AvatarUrl: sql.NullString{
				String: req.AvatarURL,
				Valid:  req.AvatarURL != "",
			},
		})
		if err != nil {
			http.Error(w, fmt.Sprintf(`{"error":"Failed to update profile: %s"}`, err.Error()), http.StatusInternalServerError)
			return
		}

		_, _ = orch.RecordAudit(r.Context(), orchestrator.AuditLogInput{
			Action:     "update_profile",
			TargetType: "user",
			TargetID:   updated.ID,
			TargetName: updated.Name,
		})

		twoFactorEnabled := is2FAEnabled(r.Context(), orch)

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(AuthUserResponse{
			ID:               updated.ID,
			Name:             updated.Name,
			Email:            updated.Email,
			Role:             updated.Role,
			AvatarURL:        req.AvatarURL,
			TwoFactorEnabled: twoFactorEnabled,
			CreatedAt:        updated.CreatedAt.Format(time.RFC3339),
		})
	}
}

func handleChangePassword(orch *orchestrator.Orchestrator) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req ChangePasswordRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, `{"error":"Invalid request payload"}`, http.StatusBadRequest)
			return
		}

		if req.CurrentPassword == "" || len(req.NewPassword) < 8 {
			http.Error(w, `{"error":"New password must be at least 8 characters"}`, http.StatusBadRequest)
			return
		}

		users, err := orch.Queries().ListUsers(r.Context())
		if err != nil || len(users) == 0 {
			http.Error(w, `{"error":"User not found"}`, http.StatusNotFound)
			return
		}

		targetUser := users[0]
		dbUser, err := orch.Queries().GetUserByID(r.Context(), targetUser.ID)
		if err != nil {
			http.Error(w, `{"error":"User not found"}`, http.StatusNotFound)
			return
		}

		if err := bcrypt.CompareHashAndPassword([]byte(dbUser.PasswordHash), []byte(req.CurrentPassword)); err != nil {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusBadRequest)
			_ = json.NewEncoder(w).Encode(map[string]string{"error": "Current password is incorrect"})
			return
		}

		newHash, err := bcrypt.GenerateFromPassword([]byte(req.NewPassword), bcrypt.DefaultCost)
		if err != nil {
			http.Error(w, `{"error":"Failed to hash new password"}`, http.StatusInternalServerError)
			return
		}

		if _, err := orch.Queries().UpdateUserPassword(r.Context(), db.UpdateUserPasswordParams{
			ID:           dbUser.ID,
			PasswordHash: string(newHash),
		}); err != nil {
			http.Error(w, `{"error":"Failed to update password"}`, http.StatusInternalServerError)
			return
		}

		_, _ = orch.RecordAudit(r.Context(), orchestrator.AuditLogInput{
			Action:     "change_password",
			TargetType: "user",
			TargetID:   dbUser.ID,
			TargetName: dbUser.Name,
		})

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(map[string]bool{"success": true})
	}
}

func handleUpdate2FA(orch *orchestrator.Orchestrator) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req TwoFASetting
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, `{"error":"Invalid request payload"}`, http.StatusBadRequest)
			return
		}

		data, err := json.Marshal(req)
		if err != nil {
			http.Error(w, `{"error":"Serialization error"}`, http.StatusInternalServerError)
			return
		}

		if _, err := orch.Queries().SetSetting(r.Context(), db.SetSettingParams{
			Key:   "user_2fa",
			Value: string(data),
		}); err != nil {
			http.Error(w, `{"error":"Failed to save 2FA status"}`, http.StatusInternalServerError)
			return
		}

		action := "enable_2fa"
		if !req.Enabled {
			action = "disable_2fa"
		}
		_, _ = orch.RecordAudit(r.Context(), orchestrator.AuditLogInput{
			Action:     action,
			TargetType: "user_security",
			TargetID:   "2fa",
			TargetName: "Two-Factor Authentication",
		})

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"success": true,
			"enabled": req.Enabled,
		})
	}
}

func handleGetPasskeys(orch *orchestrator.Orchestrator) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		passkeys := []PasskeyItem{}
		if s, err := orch.Queries().GetSetting(r.Context(), "user_passkeys"); err == nil {
			_ = json.Unmarshal([]byte(s.Value), &passkeys)
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(passkeys)
	}
}

func handleAddPasskey(orch *orchestrator.Orchestrator) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req struct {
			ID           string `json:"id,omitempty"`
			Name         string `json:"name"`
			CredentialID string `json:"credentialId,omitempty"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil || strings.TrimSpace(req.Name) == "" {
			http.Error(w, `{"error":"Passkey name is required"}`, http.StatusBadRequest)
			return
		}

		passkeys := []PasskeyItem{}
		if s, err := orch.Queries().GetSetting(r.Context(), "user_passkeys"); err == nil {
			_ = json.Unmarshal([]byte(s.Value), &passkeys)
		}

		credID := strings.TrimSpace(req.CredentialID)
		if credID == "" {
			credID = strings.TrimSpace(req.ID)
		}

		id := strings.TrimSpace(req.ID)
		if id == "" {
			if credID != "" {
				id = credID
			} else {
				id = fmt.Sprintf("pk-%d", time.Now().UnixMilli())
			}
		}

		newItem := PasskeyItem{
			ID:           id,
			Name:         strings.TrimSpace(req.Name),
			CredentialID: credID,
			CreatedAt:    time.Now().UTC().Format(time.RFC3339),
			LastUsedAt:   "Just now",
		}
		passkeys = append(passkeys, newItem)

		data, _ := json.Marshal(passkeys)
		_, _ = orch.Queries().SetSetting(r.Context(), db.SetSettingParams{
			Key:   "user_passkeys",
			Value: string(data),
		})

		_, _ = orch.RecordAudit(r.Context(), orchestrator.AuditLogInput{
			Action:     "add_passkey",
			TargetType: "user_security",
			TargetID:   newItem.ID,
			TargetName: newItem.Name,
		})

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusCreated)
		_ = json.NewEncoder(w).Encode(newItem)
	}
}

type PasskeyLoginRequest struct {
	CredentialID string `json:"credentialId"`
}

func handlePasskeyLogin(orch *orchestrator.Orchestrator) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req PasskeyLoginRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusBadRequest)
			_ = json.NewEncoder(w).Encode(map[string]string{"error": "Invalid request payload"})
			return
		}

		req.CredentialID = strings.TrimSpace(req.CredentialID)
		if req.CredentialID == "" {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusBadRequest)
			_ = json.NewEncoder(w).Encode(map[string]string{"error": "Passkey credential is required"})
			return
		}

		passkeys := []PasskeyItem{}
		if s, err := orch.Queries().GetSetting(r.Context(), "user_passkeys"); err == nil {
			_ = json.Unmarshal([]byte(s.Value), &passkeys)
		}

		if len(passkeys) == 0 {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusUnauthorized)
			_ = json.NewEncoder(w).Encode(map[string]string{"error": "No registered passkey found"})
			return
		}

		matchedIndex := -1
		for i, pk := range passkeys {
			if pk.ID == req.CredentialID || (pk.CredentialID != "" && pk.CredentialID == req.CredentialID) {
				matchedIndex = i
				break
			}
		}

		if matchedIndex == -1 {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusUnauthorized)
			_ = json.NewEncoder(w).Encode(map[string]string{"error": "Invalid passkey or passkey not registered"})
			return
		}

		// Update LastUsedAt for the matched passkey
		passkeys[matchedIndex].LastUsedAt = "Just now"
		if data, err := json.Marshal(passkeys); err == nil {
			_, _ = orch.Queries().SetSetting(r.Context(), db.SetSettingParams{
				Key:   "user_passkeys",
				Value: string(data),
			})
		}

		users, err := orch.Queries().ListUsers(r.Context())
		if err != nil || len(users) == 0 {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusUnauthorized)
			_ = json.NewEncoder(w).Encode(map[string]string{"error": "User not found"})
			return
		}

		targetUser := users[0]
		avatar := ""
		if targetUser.AvatarUrl.Valid {
			avatar = targetUser.AvatarUrl.String
		}

		twoFactorEnabled := is2FAEnabled(r.Context(), orch)
		token := "tako_tk_" + randomHexID(24)

		_, _ = orch.RecordAudit(r.Context(), orchestrator.AuditLogInput{
			Action:     "login_passkey",
			TargetType: "user",
			TargetID:   targetUser.ID,
			TargetName: targetUser.Name,
		})

		resp := LoginResponse{
			Token: token,
			User: AuthUserResponse{
				ID:               targetUser.ID,
				Name:             targetUser.Name,
				Email:            targetUser.Email,
				Role:             targetUser.Role,
				AvatarURL:        avatar,
				TwoFactorEnabled: twoFactorEnabled,
				CreatedAt:        targetUser.CreatedAt.Format(time.RFC3339),
			},
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(resp)
	}
}

func handleDeletePasskey(orch *orchestrator.Orchestrator) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id := chi.URLParam(r, "id")
		if id == "" {
			http.Error(w, `{"error":"ID is required"}`, http.StatusBadRequest)
			return
		}

		passkeys := []PasskeyItem{}
		if s, err := orch.Queries().GetSetting(r.Context(), "user_passkeys"); err == nil {
			_ = json.Unmarshal([]byte(s.Value), &passkeys)
		}

		filtered := make([]PasskeyItem, 0, len(passkeys))
		for _, pk := range passkeys {
			if pk.ID != id {
				filtered = append(filtered, pk)
			}
		}

		data, _ := json.Marshal(filtered)
		_, _ = orch.Queries().SetSetting(r.Context(), db.SetSettingParams{
			Key:   "user_passkeys",
			Value: string(data),
		})

		_, _ = orch.RecordAudit(r.Context(), orchestrator.AuditLogInput{
			Action:     "remove_passkey",
			TargetType: "user_security",
			TargetID:   id,
			TargetName: id,
		})

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(map[string]bool{"success": true})
	}
}

func handleGetSessions(orch *orchestrator.Orchestrator) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		sessions := []SessionItem{}
		if s, err := orch.Queries().GetSetting(r.Context(), "user_sessions"); err == nil {
			_ = json.Unmarshal([]byte(s.Value), &sessions)
		}

		// Ensure there is at least the current session representing the user's connection
		if len(sessions) == 0 {
			ip := r.Header.Get("X-Forwarded-For")
			if ip == "" {
				ip = r.RemoteAddr
			}
			ua := r.UserAgent()
			device := "Browser Session"
			if strings.Contains(ua, "Macintosh") {
				device = "MacBook (macOS)"
			} else if strings.Contains(ua, "Windows") {
				device = "PC (Windows)"
			} else if strings.Contains(ua, "iPhone") {
				device = "iPhone (iOS)"
			} else if strings.Contains(ua, "Linux") {
				device = "Linux Workstation"
			}

			sessions = append(sessions, SessionItem{
				ID:         "sess-active",
				UserID:     "usr_admin",
				IPAddress:  ip,
				UserAgent:  ua,
				Device:     device,
				Location:   "Active Connection",
				Current:    true,
				LastActive: "Just now",
			})

			data, _ := json.Marshal(sessions)
			_, _ = orch.Queries().SetSetting(r.Context(), db.SetSettingParams{
				Key:   "user_sessions",
				Value: string(data),
			})
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(sessions)
	}
}

func handleDeleteSession(orch *orchestrator.Orchestrator) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id := chi.URLParam(r, "id")
		if id == "" {
			http.Error(w, `{"error":"ID is required"}`, http.StatusBadRequest)
			return
		}

		sessions := []SessionItem{}
		if s, err := orch.Queries().GetSetting(r.Context(), "user_sessions"); err == nil {
			_ = json.Unmarshal([]byte(s.Value), &sessions)
		}

		filtered := make([]SessionItem, 0, len(sessions))
		for _, s := range sessions {
			if s.ID != id {
				filtered = append(filtered, s)
			}
		}

		data, _ := json.Marshal(filtered)
		_, _ = orch.Queries().SetSetting(r.Context(), db.SetSettingParams{
			Key:   "user_sessions",
			Value: string(data),
		})

		_, _ = orch.RecordAudit(r.Context(), orchestrator.AuditLogInput{
			Action:     "revoke_session",
			TargetType: "user_session",
			TargetID:   id,
			TargetName: id,
		})

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(map[string]bool{"success": true})
	}
}

func handleRevokeOtherSessions(orch *orchestrator.Orchestrator) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		sessions := []SessionItem{}
		if s, err := orch.Queries().GetSetting(r.Context(), "user_sessions"); err == nil {
			_ = json.Unmarshal([]byte(s.Value), &sessions)
		}

		filtered := make([]SessionItem, 0, 1)
		for _, s := range sessions {
			if s.Current {
				filtered = append(filtered, s)
				break
			}
		}
		if len(filtered) == 0 && len(sessions) > 0 {
			filtered = append(filtered, sessions[0])
		}

		data, _ := json.Marshal(filtered)
		_, _ = orch.Queries().SetSetting(r.Context(), db.SetSettingParams{
			Key:   "user_sessions",
			Value: string(data),
		})

		_, _ = orch.RecordAudit(r.Context(), orchestrator.AuditLogInput{
			Action:     "revoke_all_other_sessions",
			TargetType: "user_session",
			TargetID:   "all_others",
			TargetName: "All other sessions",
		})

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(map[string]bool{"success": true})
	}
}

type CreateUserPayload struct {
	Name     string `json:"name"`
	Email    string `json:"email"`
	Password string `json:"password,omitempty"`
	Role     string `json:"role"`
}

type UpdateRolePayload struct {
	Role string `json:"role"`
}

func handleListUsers(orch *orchestrator.Orchestrator) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		users, err := orch.Queries().ListUsers(r.Context())
		if err != nil {
			http.Error(w, `{"error":"Failed to list users"}`, http.StatusInternalServerError)
			return
		}
		type UserResp struct {
			ID        string `json:"id"`
			Name      string `json:"name"`
			Email     string `json:"email"`
			Role      string `json:"role"`
			AvatarURL string `json:"avatarUrl,omitempty"`
			CreatedAt string `json:"createdAt"`
		}
		resp := make([]UserResp, 0, len(users))
		for _, u := range users {
			var avatar string
			if u.AvatarUrl.Valid && u.AvatarUrl.String != "" {
				avatar = u.AvatarUrl.String
			} else {
				cleanSeed := strings.ToLower(strings.TrimSpace(u.Email))
				avatar = fmt.Sprintf("https://api.dicebear.com/10.x/big-smile/png?seed=%s", md5Hex(cleanSeed))
			}
			resp = append(resp, UserResp{
				ID:        u.ID,
				Name:      u.Name,
				Email:     u.Email,
				Role:      u.Role,
				AvatarURL: avatar,
				CreatedAt: u.CreatedAt.Format(time.RFC3339),
			})
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(resp)
	}
}

func handleCreateUser(orch *orchestrator.Orchestrator) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req CreateUserPayload
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, `{"error":"Invalid request body"}`, http.StatusBadRequest)
			return
		}
		if req.Email == "" || req.Name == "" {
			http.Error(w, `{"error":"Name and email are required"}`, http.StatusBadRequest)
			return
		}
		if req.Role == "" {
			req.Role = "member"
		}
		pwd := req.Password
		if pwd == "" {
			pwd = "password123"
		}
		hash, err := bcrypt.GenerateFromPassword([]byte(pwd), bcrypt.DefaultCost)
		if err != nil {
			http.Error(w, `{"error":"Failed to hash password"}`, http.StatusInternalServerError)
			return
		}

		id := fmt.Sprintf("usr-%d", time.Now().UnixMilli())
		user, err := orch.Queries().CreateUser(r.Context(), db.CreateUserParams{
			ID:           id,
			Name:         req.Name,
			Email:        req.Email,
			PasswordHash: string(hash),
			Role:         req.Role,
			AvatarUrl:    sql.NullString{String: "", Valid: false},
		})
		if err != nil {
			http.Error(w, fmt.Sprintf(`{"error":"Failed to create user: %s"}`, err.Error()), http.StatusBadRequest)
			return
		}

		_, _ = orch.RecordAudit(r.Context(), orchestrator.AuditLogInput{
			Action:     "create_user",
			TargetType: "user",
			TargetID:   user.ID,
			TargetName: user.Name,
		})

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusCreated)
		_ = json.NewEncoder(w).Encode(map[string]any{
			"id":        user.ID,
			"name":      user.Name,
			"email":     user.Email,
			"role":      user.Role,
			"createdAt": user.CreatedAt.Format(time.RFC3339),
		})
	}
}

func handleUpdateUserRole(orch *orchestrator.Orchestrator) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID := chi.URLParam(r, "id")
		var req UpdateRolePayload
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, `{"error":"Invalid request payload"}`, http.StatusBadRequest)
			return
		}
		if req.Role == "" {
			http.Error(w, `{"error":"Role is required"}`, http.StatusBadRequest)
			return
		}

		query := `UPDATE users SET role = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? RETURNING id, name, email, role, avatar_url, created_at, updated_at`
		row := orch.DB().QueryRowContext(r.Context(), query, req.Role, userID)
		var id, name, email, role string
		var avatar sql.NullString
		var createdAt, updatedAt time.Time
		if err := row.Scan(&id, &name, &email, &role, &avatar, &createdAt, &updatedAt); err != nil {
			if err == sql.ErrNoRows {
				http.Error(w, `{"error":"User not found"}`, http.StatusNotFound)
			} else {
				http.Error(w, fmt.Sprintf(`{"error":"Failed to update role: %s"}`, err.Error()), http.StatusInternalServerError)
			}
			return
		}

		_, _ = orch.RecordAudit(r.Context(), orchestrator.AuditLogInput{
			Action:     "update_user_role",
			TargetType: "user",
			TargetID:   id,
			TargetName: name,
		})

		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{
			"id":        id,
			"name":      name,
			"email":     email,
			"role":      role,
			"createdAt": createdAt.Format(time.RFC3339),
		})
	}
}

func handleDeleteUser(orch *orchestrator.Orchestrator) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID := chi.URLParam(r, "id")
		res, err := orch.DB().ExecContext(r.Context(), `DELETE FROM users WHERE id = ?`, userID)
		if err != nil {
			http.Error(w, fmt.Sprintf(`{"error":"Failed to delete user: %s"}`, err.Error()), http.StatusInternalServerError)
			return
		}
		rows, _ := res.RowsAffected()
		if rows > 0 {
			_, _ = orch.RecordAudit(r.Context(), orchestrator.AuditLogInput{
				Action:     "delete_user",
				TargetType: "user",
				TargetID:   userID,
				TargetName: userID,
			})
		}

		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]bool{"success": true})
	}
}

