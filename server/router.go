package main

import (
	"database/sql"
	"log/slog"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"

	"gettako.dev/tako/server/audit"
	"gettako.dev/tako/server/auth"
	"gettako.dev/tako/server/config"
	"gettako.dev/tako/server/deploy"
	"gettako.dev/tako/server/github"
	"gettako.dev/tako/server/handlers"
	"gettako.dev/tako/server/nodes"
	"gettako.dev/tako/server/notifications"
)

func buildRouter(cfg *config.Config, database *sql.DB, masterKey []byte, nodeManager *nodes.NodeManager, orcs ...*deploy.Orchestrator) http.Handler {
	r := chi.NewRouter()

	r.Use(middleware.RequestID)
	r.Use(audit.ClientIPMiddleware)
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)

	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   []string{"http://localhost:3000", "http://127.0.0.1:3000", "http://" + cfg.Domain, "https://" + cfg.Domain},
		AllowedMethods:   []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type", "X-CSRF-Token"},
		ExposedHeaders:   []string{"Link"},
		AllowCredentials: true,
		MaxAge:           300,
	}))

	healthzHandler := func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"status":"ok"}`))
	}
	r.Get("/healthz", healthzHandler)
	r.Get("/api/healthz", healthzHandler)

	if database != nil {
		authHandler, err := auth.NewHandler(database, cfg.Domain)
		if err != nil {
			slog.Error("failed to initialize auth handler", slog.String("error", err.Error()))
		} else {
			r.Route("/api/auth", func(authRouter chi.Router) {
				authHandler.RegisterRoutes(authRouter)
			})
		}

		apiHandler := handlers.NewHandler(database, masterKey, cfg.Domain)
		if nodeManager != nil {
			apiHandler.SetNodeManager(nodeManager)
		}
		dispatcher := notifications.NewDispatcher(database)
		apiHandler.SetNotifier(dispatcher)
		if len(orcs) > 0 && orcs[0] != nil {
			apiHandler.SetOrchestrator(orcs[0])
			orcs[0].SetNotifyHook(dispatcher.Send)
		}

		privKeyBytes, _ := github.LoadPrivateKey(cfg.GitHubAppPrivateKey, cfg.GitHubAppPrivateKeyPath)
		ghClient, _ := github.NewClient(github.ClientConfig{
			AppID:          cfg.GitHubAppID,
			PrivateKeyPEM:  privKeyBytes,
			InstallationID: cfg.GitHubAppInstallationID,
			PAT:            cfg.GitHubPAT,
		})
		if ghClient != nil {
			apiHandler.SetGitHubClient(ghClient)
		}
		if cfg.GitHubWebhookSecret != "" {
			apiHandler.SetWebhookSecret(cfg.GitHubWebhookSecret)
		}
		if am := audit.GetDefaultManager(); am != nil {
			apiHandler.SetAuditManager(am)
		}

		r.Route("/api", func(apiRouter chi.Router) {
			apiHandler.RegisterRoutes(apiRouter)
		})
	}

	return r
}
