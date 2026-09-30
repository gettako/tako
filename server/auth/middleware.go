package auth

import (
	"context"
	"database/sql"
	"encoding/json"
	"net/http"
	"strings"

	"gettako.dev/tako/server/audit"
)

type contextKey string

const UserContextKey contextKey = "auth_user"

func RequireAuth(db *sql.DB) func(next http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			sessionID := ""
			if cookie, err := r.Cookie(SessionCookieName); err == nil {
				sessionID = cookie.Value
			} else {
				authHeader := r.Header.Get("Authorization")
				if after, ok := strings.CutPrefix(authHeader, "Bearer "); ok {
					sessionID = after
				}
			}

			if sessionID == "" {
				sendUnauthorized(w, "Authentication required")
				return
			}

			user, err := GetUserBySessionID(db, sessionID)
			if err != nil || user == nil {
				sendUnauthorized(w, "Invalid or expired session")
				return
			}

			ctx := context.WithValue(r.Context(), UserContextKey, user)
			ctx = audit.ContextWithActor(ctx, user.Email)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// RequireAdmin verifies that the authenticated user possesses the admin role.
func RequireAdmin(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		user := GetUserFromContext(r.Context())
		if user == nil {
			sendUnauthorized(w, "Authentication required")
			return
		}
		if user.Role != "admin" {
			sendForbidden(w, "Administrator privileges required")
			return
		}
		next.ServeHTTP(w, r)
	})
}

func GetUserFromContext(ctx context.Context) *User {
	if u, ok := ctx.Value(UserContextKey).(*User); ok {
		return u
	}
	return nil
}

func sendUnauthorized(w http.ResponseWriter, message string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusUnauthorized)
	_ = json.NewEncoder(w).Encode(map[string]string{
		"error":   "Unauthorized",
		"message": message,
	})
}

func sendForbidden(w http.ResponseWriter, message string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusForbidden)
	_ = json.NewEncoder(w).Encode(map[string]string{
		"error":   "Forbidden",
		"message": message,
	})
}
