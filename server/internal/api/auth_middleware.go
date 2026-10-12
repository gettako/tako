package api

import (
	"context"
	"encoding/json"
	"net/http"

	"gettako.dev/tako/internal/orchestrator"
	"gettako.dev/tako/internal/store/db"
)

type authContextKey string

const (
	authUserContextKey    authContextKey = "tako_auth_user"
	authSessionContextKey authContextKey = "tako_auth_session"
)

// Authenticate verifies the incoming session token and injects the user into the request context.
func Authenticate(orch *orchestrator.Orchestrator) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			token := extractAuthToken(r)
			if token == "" {
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusUnauthorized)
				_ = json.NewEncoder(w).Encode(map[string]string{
					"error": "Unauthorized: authentication token required",
				})
				return
			}

			sess, ok := orch.GetUserSession(token)
			if !ok {
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusUnauthorized)
				_ = json.NewEncoder(w).Encode(map[string]string{
					"error": "Unauthorized: invalid or expired session",
				})
				return
			}

			user, err := orch.Queries().GetUserByID(r.Context(), sess.UserID)
			if err != nil {
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusUnauthorized)
				_ = json.NewEncoder(w).Encode(map[string]string{
					"error": "Unauthorized: user account not found",
				})
				return
			}

			ctx := context.WithValue(r.Context(), authUserContextKey, user)
			ctx = context.WithValue(ctx, authSessionContextKey, sess)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// RequireAdmin ensures the authenticated user possesses the 'admin' role.
func RequireAdmin(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		user, ok := GetUserFromContext(r.Context())
		if !ok || user.Role != "admin" {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusForbidden)
			_ = json.NewEncoder(w).Encode(map[string]string{
				"error": "Forbidden: administrator privileges required",
			})
			return
		}
		next.ServeHTTP(w, r)
	})
}

// GetUserFromContext extracts the authenticated db.User from context.
func GetUserFromContext(ctx context.Context) (db.User, bool) {
	u, ok := ctx.Value(authUserContextKey).(db.User)
	return u, ok
}

// GetSessionFromContext extracts the active orchestrator.UserSession from context.
func GetSessionFromContext(ctx context.Context) (orchestrator.UserSession, bool) {
	s, ok := ctx.Value(authSessionContextKey).(orchestrator.UserSession)
	return s, ok
}
