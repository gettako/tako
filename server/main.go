package main

import (
	"context"
	"errors"
	"io"
	"log/slog"
	"net"
	"net/http"
	"os"
	"os/signal"
	"strings"
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

func resolveLocalHost(configuredDomain string) string {
	domain := strings.TrimSpace(configuredDomain)
	if domain != "" && !strings.EqualFold(domain, "localhost") && domain != "127.0.0.1" {
		return domain
	}

	// Try detecting public IP with a short timeout
	client := &http.Client{Timeout: 2 * time.Second}
	for _, endpoint := range []string{"https://api.ipify.org", "https://icanhazip.com"} {
		resp, err := client.Get(endpoint)
		if err == nil && resp.StatusCode == http.StatusOK {
			body, readErr := io.ReadAll(io.LimitReader(resp.Body, 64))
			_ = resp.Body.Close()
			if readErr == nil {
				ipStr := strings.TrimSpace(string(body))
				if net.ParseIP(ipStr) != nil {
					return ipStr
				}
			}
		}
		if resp != nil {
			_ = resp.Body.Close()
		}
	}

	if domain != "" {
		return domain
	}
	return "localhost"
}

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

	localHost := resolveLocalHost(cfg.Domain)

	if cfg.LocalEnrollmentToken != "" {
		var srvCount int
		if err := database.QueryRowContext(ctx, "SELECT count(*) FROM servers WHERE id = 'srv_local' OR enrollment_token = ?", cfg.LocalEnrollmentToken).Scan(&srvCount); err == nil && srvCount == 0 {
			_, _ = database.ExecContext(ctx, `
				INSERT OR IGNORE INTO servers (id, name, host, status, enrollment_token, token_expires_at, created_at, updated_at)
				VALUES ('srv_local', 'Local Server', ?, 'pending', ?, datetime('now', '+365 days'), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
			`, localHost, cfg.LocalEnrollmentToken)
			slog.Info("provisioned local server enrollment token", slog.String("server_id", "srv_local"), slog.String("host", localHost))
		}
	}

	// If srv_local already exists and is stuck with localhost/127.0.0.1, auto-update it to the resolved host if valid
	if localHost != "localhost" && localHost != "127.0.0.1" {
		res, err := database.ExecContext(ctx, `
			UPDATE servers SET host = ?, updated_at = CURRENT_TIMESTAMP
			WHERE id = 'srv_local' AND (host = 'localhost' OR host = '127.0.0.1' OR host IS NULL OR host = '')
		`, localHost)
		if err == nil {
			if count, _ := res.RowsAffected(); count > 0 {
				slog.Info("updated local server host address from localhost to public IP/domain", slog.String("host", localHost))
			}
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
