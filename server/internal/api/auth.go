package api

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"
	"golang.org/x/crypto/bcrypt"

	"gettako.dev/tako/internal/orchestrator"
)

type LoginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type AuthUserResponse struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	Email     string `json:"email"`
	Role      string `json:"role"`
	AvatarURL string `json:"avatarUrl,omitempty"`
}

type LoginResponse struct {
	Token string           `json:"token"`
	User  AuthUserResponse `json:"user"`
}

func registerAuthRoutes(r chi.Router, orch *orchestrator.Orchestrator) {
	r.Route("/auth", func(r chi.Router) {
		r.Post("/login", handleLogin(orch))
		r.Post("/logout", handleLogout())
		r.Get("/me", handleGetMe(orch))
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

		tokenBytes := make([]byte, 24)
		_, _ = rand.Read(tokenBytes)
		token := "tako_tk_" + hex.EncodeToString(tokenBytes)

		avatar := ""
		if user.AvatarUrl.Valid {
			avatar = user.AvatarUrl.String
		}

		resp := LoginResponse{
			Token: token,
			User: AuthUserResponse{
				ID:        user.ID,
				Name:      user.Name,
				Email:     user.Email,
				Role:      user.Role,
				AvatarURL: avatar,
			},
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(resp)
	}
}

func handleLogout() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(map[string]bool{"success": true})
	}
}

func handleGetMe(orch *orchestrator.Orchestrator) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		users, err := orch.Queries().ListUsers(r.Context())
		if err != nil || len(users) == 0 {
			http.Error(w, `{"error":"No authenticated user"}`, http.StatusUnauthorized)
			return
		}

		first := users[0]
		avatar := ""
		if first.AvatarUrl.Valid {
			avatar = first.AvatarUrl.String
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"authenticated": true,
			"user": AuthUserResponse{
				ID:        first.ID,
				Name:      first.Name,
				Email:     first.Email,
				Role:      first.Role,
				AvatarURL: avatar,
			},
		})
	}
}
