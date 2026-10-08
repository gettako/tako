package api

import (
	"context"
	"database/sql"
	"encoding/json"
	"net"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"gettako.dev/tako/internal/orchestrator"
)

type HealthResponse struct {
	Status   string `json:"status"`
	Database string `json:"database"`
}

type PingResponse struct {
	Message string `json:"message"`
}

func extractRequestIP(r *http.Request) string {
	if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
		parts := strings.Split(xff, ",")
		if len(parts) > 0 {
			clean := strings.TrimSpace(parts[0])
			if clean != "" {
				return clean
			}
		}
	}
	if xrip := r.Header.Get("X-Real-IP"); xrip != "" {
		clean := strings.TrimSpace(xrip)
		if clean != "" {
			return clean
		}
	}
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err == nil && host != "" {
		return host
	}
	if r.RemoteAddr != "" {
		return r.RemoteAddr
	}
	return "127.0.0.1"
}

func clientIPMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ip := extractRequestIP(r)
		ctx := context.WithValue(r.Context(), orchestrator.ClientIPContextKey, ip)
		ctx = context.WithValue(ctx, "client_ip", ip)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func NewRouter(db *sql.DB, orch *orchestrator.Orchestrator) http.Handler {
	r := chi.NewRouter()

	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)
	r.Use(clientIPMiddleware)
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)

	r.Get("/health", func(w http.ResponseWriter, r *http.Request) {
		status := "ok"
		dbStatus := "connected"
		statusCode := http.StatusOK

		if err := db.PingContext(r.Context()); err != nil {
			status = "unhealthy"
			dbStatus = "disconnected"
			statusCode = http.StatusServiceUnavailable
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(statusCode)
		_ = json.NewEncoder(w).Encode(HealthResponse{
			Status:   status,
			Database: dbStatus,
		})
	})

	r.Route("/api/v1", func(r chi.Router) {
		r.Get("/ping", func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusOK)
			_ = json.NewEncoder(w).Encode(PingResponse{
				Message: "pong",
			})
		})

		if orch != nil {
			registerNodeRoutes(r, orch)
			registerEventsRoutes(r, orch)
			registerServiceRoutes(r, orch)
			registerProjectRoutes(r, orch)
			registerAuthRoutes(r, orch)
			registerAuditLogRoutes(r, orch)
			registerSettingsRoutes(r, orch)
			registerMetricsRoutes(r, orch)
			registerGitHubRoutes(r, orch)
		}
	})

	return r
}
