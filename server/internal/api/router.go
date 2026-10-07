package api

import (
	"database/sql"
	"encoding/json"
	"net/http"

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

func NewRouter(db *sql.DB, orch *orchestrator.Orchestrator) http.Handler {
	r := chi.NewRouter()

	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)
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
		}
	})

	return r
}
