package main

import (
	"context"
	"flag"
	"log"
	"os"
	"os/signal"
	"syscall"
	"time"

	"gettako.dev/tako/agent/internal/daemon"
)

func getEnv(key, defaultVal string) string {
	if val := os.Getenv(key); val != "" {
		return val
	}
	return defaultVal
}

func main() {
	defaultHost, _ := os.Hostname()
	if defaultHost == "" {
		defaultHost = "tako-worker"
	}

	masterURL := flag.String("master-url", getEnv("TAKO_MASTER_URL", "127.0.0.1:50051"), "Master gRPC server address (host:port)")
	enrollToken := flag.String("token", getEnv("TAKO_ENROLL_TOKEN", ""), "Master enrollment token for agent")
	nodeID := flag.String("node-id", getEnv("TAKO_NODE_ID", ""), "Node ID (auto-generated if empty)")
	nodeName := flag.String("node-name", getEnv("TAKO_NODE_NAME", defaultHost), "Human-readable name for this node")
	role := flag.String("role", getEnv("TAKO_NODE_ROLE", "worker"), "Node role: leader or worker")
	ipAddress := flag.String("ip-address", getEnv("TAKO_IP_ADDRESS", "127.0.0.1"), "Node IP address")
	publicIP := flag.String("public-ip", getEnv("TAKO_PUBLIC_IP", ""), "Public IP address (optional)")
	stateFile := flag.String("state-file", getEnv("TAKO_STATE_FILE", "/tmp/tako-agent.json"), "Path to persist local agent registration state")
	insecure := flag.Bool("insecure", getEnv("TAKO_INSECURE", "true") == "true", "Use insecure gRPC connection (no TLS)")
	heartbeatInterval := flag.Duration("interval", 3*time.Second, "Heartbeat interval")

	flag.Parse()

	log.Printf("[tako-agent] starting agent daemon (node: %s, role: %s, master: %s)...", *nodeName, *role, *masterURL)

	cfg := daemon.Config{
		MasterURL:         *masterURL,
		EnrollToken:       *enrollToken,
		NodeID:            *nodeID,
		NodeName:          *nodeName,
		Role:              *role,
		IPAddress:         *ipAddress,
		PublicIP:          *publicIP,
		StateFile:         *stateFile,
		HeartbeatInterval: *heartbeatInterval,
		Insecure:          *insecure,
	}

	d, err := daemon.New(cfg)
	if err != nil {
		log.Fatalf("[tako-agent] failed to initialize daemon: %v", err)
	}

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	if err := d.Run(ctx); err != nil {
		log.Printf("[tako-agent] daemon stopped with notice: %v", err)
	}

	log.Println("[tako-agent] process exited cleanly")
}
