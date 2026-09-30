package main

import (
	"context"
	"net"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"
	"time"

	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/metadata"

	"gettako.dev/tako/server/config"
	"gettako.dev/tako/server/db"
	"gettako.dev/tako/server/nodes"
	"gettako.dev/tako/internal/protocol"
)

func TestNodeManagerServerAPIIntegration(t *testing.T) {
	tempDir := t.TempDir()
	dbPath := filepath.Join(tempDir, "integration.db")

	database, err := db.Open(dbPath)
	if err != nil {
		t.Fatalf("failed to open database: %v", err)
	}
	defer database.Close()

	token := "tako_tok_integration_token"
	_, err = database.Exec(`
		INSERT INTO servers (id, name, status, enrollment_token, token_expires_at, created_at, updated_at)
		VALUES ('srv_integration', 'Worker 1', 'pending', ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
	`, token, time.Now().Add(1*time.Hour))
	if err != nil {
		t.Fatalf("failed to insert test server: %v", err)
	}

	nodeManager := nodes.NewNodeManager(database)

	cfg := &config.Config{
		Port:     "8080",
		Domain:   "localhost",
		DBPath:   dbPath,
		GRPCPort: "0",
	}

	router := buildRouter(cfg, database, []byte("01234567890123456789012345678901"), nodeManager)

	lis, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("failed to listen on random port: %v", err)
	}

	grpcServer := grpc.NewServer()
	agentServer := NewAgentServer(database, "localhost", nodeManager)
	protocol.RegisterAgentServiceServer(grpcServer, agentServer)

	go func() {
		_ = grpcServer.Serve(lis)
	}()
	defer grpcServer.Stop()

	// 1. Initially, server is pending in DB and API
	req := httptest.NewRequest(http.MethodGet, "/api/servers", nil)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	// Since auth middleware requires session, let's query DB directly or verify through NodeManager and handlers
	var initialStatus string
	_ = database.QueryRow(`SELECT status FROM servers WHERE id = 'srv_integration'`).Scan(&initialStatus)
	if initialStatus != "pending" {
		t.Fatalf("expected pending status, got %s", initialStatus)
	}

	// 2. Connect via gRPC client and enroll
	conn, err := grpc.NewClient(lis.Addr().String(), grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		t.Fatalf("failed to dial: %v", err)
	}
	defer conn.Close()

	client := protocol.NewAgentServiceClient(conn)

	enrollResp, err := client.Enroll(context.Background(), &protocol.EnrollRequest{
		Token:         token,
		Hostname:      "worker-integration",
		AgentVersion:  "v1.0.0",
		DockerVersion: "26.1.0",
		OsInfo:        "linux/amd64",
	})
	if err != nil {
		t.Fatalf("enrollment failed: %v", err)
	}

	// 3. Open persistent stream session
	streamCtx, cancelStream := context.WithCancel(context.Background())
	defer cancelStream()

	ctxWithAuth := metadata.NewOutgoingContext(streamCtx, metadata.Pairs(
		"x-tako-node-id", enrollResp.NodeId,
		"x-tako-node-secret", enrollResp.NodeSecret,
	))

	stream, err := client.StreamNodeSession(ctxWithAuth)
	if err != nil {
		t.Fatalf("StreamNodeSession failed: %v", err)
	}

	// Allow session registration to process
	time.Sleep(50 * time.Millisecond)

	// Verify server status in DB and NodeManager is online
	if !nodeManager.IsOnline("srv_integration") {
		t.Fatal("expected node to be marked online in NodeManager")
	}

	var statusOnline string
	_ = database.QueryRow(`SELECT status FROM servers WHERE id = 'srv_integration'`).Scan(&statusOnline)
	if statusOnline != "online" {
		t.Fatalf("expected server status 'online' in DB, got '%s'", statusOnline)
	}

	// 4. Send Heartbeat with telemetry
	err = stream.Send(&protocol.AgentMessage{
		NodeId: "srv_integration",
		Payload: &protocol.AgentMessage_Heartbeat{
			Heartbeat: &protocol.Heartbeat{
				CpuPercent:    38.5,
				RamPercent:    62.4,
				DiskPercent:    45.1,
				UptimeSeconds: 3600,
				Timestamp:     time.Now().Unix(),
			},
		},
	})
	if err != nil {
		t.Fatalf("failed to send heartbeat: %v", err)
	}

	// Wait for Ack
	msg, err := stream.Recv()
	if err != nil {
		t.Fatalf("failed to receive heartbeat ack: %v", err)
	}
	if msg.GetHeartbeatAck() == nil {
		t.Fatalf("expected HeartbeatAck, got %+v", msg)
	}

	// Verify telemetry in NodeManager cache
	telemetry := nodeManager.GetTelemetry("srv_integration")
	if telemetry == nil {
		t.Fatal("expected cached telemetry in NodeManager")
	}
	if telemetry.CPUPercent != 38.5 || telemetry.RAMPercent != 62.4 || telemetry.DiskPercent != 45.1 {
		t.Fatalf("telemetry mismatch: %+v", telemetry)
	}

	// Verify telemetry in DB
	var dbCPU, dbRAM, dbDisk float64
	_ = database.QueryRow(`SELECT cpu_percent, ram_percent, disk_percent FROM servers WHERE id = 'srv_integration'`).Scan(&dbCPU, &dbRAM, &dbDisk)
	if dbCPU != 38.5 || dbRAM != 62.4 || dbDisk != 45.1 {
		t.Fatalf("database telemetry mismatch: CPU=%f, RAM=%f, Disk=%f", dbCPU, dbRAM, dbDisk)
	}

	// 5. Test disconnecting agent and liveness timeout
	cancelStream() // terminate stream
	time.Sleep(50 * time.Millisecond)

	// Set short timeout and simulate missed heartbeats
	nodeManager.SetOfflineTimeout(50 * time.Millisecond)
	time.Sleep(60 * time.Millisecond)

	// Backdate last_heartbeat_at in DB
	_, _ = database.Exec(`UPDATE servers SET last_heartbeat_at = datetime('now', '-60 seconds') WHERE id = 'srv_integration'`)

	nodeManager.CheckLiveness(context.Background())

	if nodeManager.IsOnline("srv_integration") {
		t.Fatal("expected node to be marked offline after timeout")
	}

	var statusOffline string
	_ = database.QueryRow(`SELECT status FROM servers WHERE id = 'srv_integration'`).Scan(&statusOffline)
	if statusOffline != "offline" {
		t.Fatalf("expected server status 'offline' in DB after missed heartbeats, got '%s'", statusOffline)
	}
}
