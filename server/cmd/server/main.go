package main

import (
	"context"
	"errors"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"gettako.dev/tako/internal/api"
	"gettako.dev/tako/internal/config"
	"gettako.dev/tako/internal/events"
	internalgrpc "gettako.dev/tako/internal/grpc"
	"gettako.dev/tako/internal/orchestrator"
	"gettako.dev/tako/internal/store"
	"net"
)

func main() {
	cfg := config.Load()

	log.Printf("[tako-server] initializing database at %s...", cfg.DBPath)
	db, err := store.OpenDB(cfg.DBPath)
	if err != nil {
		log.Fatalf("[tako-server] failed to connect to database: %v", err)
	}
	defer db.Close()

	log.Printf("[tako-server] running database migrations...")
	if err := store.Migrate(db); err != nil {
		log.Fatalf("[tako-server] migration failed: %v", err)
	}
	log.Printf("[tako-server] migrations completed successfully")

	if err := store.SeedDefaultAdmin(context.Background(), db, cfg.AdminEmail, cfg.AdminPassword); err != nil {
		log.Printf("[tako-server] warning: failed to seed default admin: %v", err)
	}

	eventBus := events.NewBus()
	orch := orchestrator.New(db, eventBus, cfg.AgentSecret)

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	orch.StartLivenessWatcher(ctx, 5*time.Second, 15)

	router := api.NewRouter(db, orch)

	httpSrv := &http.Server{
		Addr:         ":" + cfg.Port,
		Handler:      router,
		ReadTimeout:  10 * time.Second,
		WriteTimeout: 10 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	grpcSrv := internalgrpc.NewServer(internalgrpc.ServerConfig{
		AgentSecret:  cfg.AgentSecret,
		Orchestrator: orch,
	})

	grpcLis, err := net.Listen("tcp", ":"+cfg.GRPCPort)
	if err != nil {
		log.Fatalf("[tako-server] failed to listen on gRPC port :%s: %v", cfg.GRPCPort, err)
	}

	go func() {
		log.Printf("[tako-server] HTTP server listening on port :%s (env: %s)", cfg.Port, cfg.Env)
		if err := httpSrv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Fatalf("[tako-server] HTTP listen error: %v", err)
		}
	}()

	go func() {
		log.Printf("[tako-server] gRPC server listening on port :%s", cfg.GRPCPort)
		if err := grpcSrv.Serve(grpcLis); err != nil {
			log.Printf("[tako-server] gRPC server error: %v", err)
		}
	}()

	<-ctx.Done()
	log.Println("[tako-server] shutting down gracefully...")

	shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := httpSrv.Shutdown(shutdownCtx); err != nil {
		log.Printf("[tako-server] HTTP shutdown error: %v", err)
	}

	grpcSrv.GracefulStop()

	log.Println("[tako-server] server stopped cleanly")
}
