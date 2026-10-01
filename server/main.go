package main

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"google.golang.org/grpc"

	"gettako.dev/tako/internal/crypto"
	"gettako.dev/tako/server/audit"
	"gettako.dev/tako/server/auth"
	"gettako.dev/tako/server/backup"
	"gettako.dev/tako/server/config"
	"gettako.dev/tako/server/db"
	"gettako.dev/tako/server/deploy"
	"gettako.dev/tako/server/monitoring"
	"gettako.dev/tako/server/nodes"
)

func main() {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, nil))
	slog.SetDefault(logger)

	cfg := config.Load()

	database, err := db.Open(cfg.DBPath)
	if err != nil {
		slog.Error("failed to initialize database", slog.String("error", err.Error()))
		os.Exit(1)
	}
	defer database.Close()

	masterKey, err := crypto.LoadOrGenerateMasterKey(cfg.SecretKey, "")
	if err != nil {
		slog.Error("failed to initialize master key", slog.String("error", err.Error()))
		os.Exit(1)
	}

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	nodeManager := nodes.NewNodeManager(database)
	go nodeManager.StartLivenessCheck(ctx, 30*time.Second)

	if cfg.LocalEnrollmentToken != "" {
		var srvCount int
		if err := database.QueryRowContext(ctx, "SELECT count(*) FROM servers WHERE id = 'srv_local' OR enrollment_token = ?", cfg.LocalEnrollmentToken).Scan(&srvCount); err == nil && srvCount == 0 {
			_, _ = database.ExecContext(ctx, `
				INSERT OR IGNORE INTO servers (id, name, host, status, enrollment_token, token_expires_at, created_at, updated_at)
				VALUES ('srv_local', 'Local Server', 'localhost', 'pending', ?, datetime('now', '+365 days'), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
			`, cfg.LocalEnrollmentToken)
			slog.Info("provisioned local server enrollment token", slog.String("server_id", "srv_local"))
		}
	}

	orchestrator := deploy.NewOrchestrator(database, nodeManager, masterKey)
	backupMgr := backup.NewServiceBackupManager(database, masterKey, nodeManager)
	backupMgr.StartScheduler(ctx)
	defer backupMgr.StopScheduler()

	metricsMgr := monitoring.NewMetricsManager(database)
	go metricsMgr.StartPruner(ctx, 1*time.Hour)

	previewReaper := deploy.NewPreviewReaper(database, nodeManager, 1*time.Hour, 48*time.Hour)
	go previewReaper.Start(ctx)

	auditMgr := audit.NewManager(database)
	audit.SetDefaultManager(auditMgr)
	go auditMgr.StartPruner(ctx, 24*time.Hour)

	auth.StartSessionCleanup(ctx, database, 1*time.Hour)

	r := buildRouter(cfg, database, masterKey, nodeManager, orchestrator)

	srv := &http.Server{
		Addr:         ":" + cfg.Port,
		Handler:      r,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	grpcServer, grpcLis, err := startGRPCServer(cfg.GRPCPort, database, cfg.Domain, nodeManager, orchestrator)
	if err != nil {
		slog.Error("failed to start gRPC server", slog.String("error", err.Error()))
		os.Exit(1)
	}

	go func() {
		slog.Info("Tako gRPC server listening", slog.String("grpc_port", cfg.GRPCPort))
		if err := grpcServer.Serve(grpcLis); err != nil && !errors.Is(err, grpc.ErrServerStopped) {
			slog.Error("gRPC server listener error", slog.String("error", err.Error()))
		}
	}()

	go func() {
		slog.Info("Tako control plane server starting",
			slog.String("port", cfg.Port),
			slog.String("domain", cfg.Domain),
			slog.String("db_path", cfg.DBPath),
			slog.String("grpc_port", cfg.GRPCPort),
		)
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			slog.Error("server listener error", slog.String("error", err.Error()))
			os.Exit(1)
		}
	}()

	<-ctx.Done()
	slog.Info("shutting down Tako control plane server...")

	grpcServer.GracefulStop()

	shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := srv.Shutdown(shutdownCtx); err != nil {
		slog.Error("graceful shutdown failed", slog.String("error", err.Error()))
		os.Exit(1)
	}

	slog.Info("server stopped gracefully")
}
