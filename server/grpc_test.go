package main

import (
	"context"
	"net"
	"path/filepath"
	"testing"
	"time"

	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/reflection"
	"google.golang.org/grpc/reflection/grpc_reflection_v1"
	"google.golang.org/grpc/status"

	"gettako.dev/tako/server/db"
	"gettako.dev/tako/server/nodes"
	"gettako.dev/tako/internal/protocol"
)

func setupTestGRPC(t *testing.T) (protocol.AgentServiceClient, *grpc.ClientConn, string, *AgentServer) {
	tempDir := t.TempDir()
	dbPath := filepath.Join(tempDir, "grpc_test.db")

	database, err := db.Open(dbPath)
	if err != nil {
		t.Fatalf("failed to open test db: %v", err)
	}
	t.Cleanup(func() { database.Close() })

	// Insert test server with enrollment token
	token := "tako_tok_valid_test_token"
	_, err = database.Exec(`
		INSERT INTO servers (id, name, status, enrollment_token, token_expires_at)
		VALUES ('srv_test_node', 'Test Node', 'pending', ?, ?)
	`, token, time.Now().Add(1*time.Hour))
	if err != nil {
		t.Fatalf("failed to insert test server: %v", err)
	}

	lis, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("failed to listen on random port: %v", err)
	}

	grpcServer := grpc.NewServer()
	agentServer := NewAgentServer(database, "localhost", nodes.NewNodeManager(database))
	protocol.RegisterAgentServiceServer(grpcServer, agentServer)
	reflection.Register(grpcServer)

	go func() {
		_ = grpcServer.Serve(lis)
	}()
	t.Cleanup(func() { grpcServer.Stop() })

	conn, err := grpc.NewClient(lis.Addr().String(), grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		t.Fatalf("failed to dial test grpc server: %v", err)
	}
	t.Cleanup(func() { conn.Close() })

	client := protocol.NewAgentServiceClient(conn)
	return client, conn, token, agentServer
}

func TestGRPCEnrollmentAndStreamSession(t *testing.T) {
	client, conn, validToken, _ := setupTestGRPC(t)

	// 1. Invalid token fails with PermissionDenied
	_, err := client.Enroll(context.Background(), &protocol.EnrollRequest{
		Token:        "invalid_token",
		Hostname:     "worker-01",
		AgentVersion: "v1.0.0",
	})
	if err == nil {
		t.Fatal("expected error with invalid token, got nil")
	}
	if st, ok := status.FromError(err); !ok || st.Code() != codes.PermissionDenied {
		t.Fatalf("expected PermissionDenied status code, got: %v", err)
	}

	// 2. Valid token succeeds and enrolls node
	enrollResp, err := client.Enroll(context.Background(), &protocol.EnrollRequest{
		Token:         validToken,
		Hostname:      "worker-01",
		AgentVersion:  "v1.0.0",
		DockerVersion: "26.1.3",
		OsInfo:        "Linux Ubuntu",
	})
	if err != nil {
		t.Fatalf("expected successful enrollment, got: %v", err)
	}

	if enrollResp.NodeId != "srv_test_node" {
		t.Errorf("expected node_id 'srv_test_node', got %s", enrollResp.NodeId)
	}
	if enrollResp.NodeSecret == "" {
		t.Fatal("expected non-empty node_secret")
	}

	// 3. Second enrollment with same token fails (token was consumed/invalidated)
	_, err = client.Enroll(context.Background(), &protocol.EnrollRequest{
		Token: validToken,
	})
	if err == nil {
		t.Fatal("expected second enrollment to fail, got nil")
	}

	// 4. StreamNodeSession without metadata fails
	streamWithoutAuth, err := client.StreamNodeSession(context.Background())
	if err != nil {
		t.Fatalf("stream call failed: %v", err)
	}
	_, err = streamWithoutAuth.Recv()
	if err == nil {
		t.Fatal("expected error on unauthenticated stream, got nil")
	}

	// 5. StreamNodeSession with valid node credentials succeeds
	ctx := metadata.NewOutgoingContext(context.Background(), metadata.Pairs(
		"node-id", enrollResp.NodeId,
		"node-secret", enrollResp.NodeSecret,
	))

	streamWithAuth, err := client.StreamNodeSession(ctx)
	if err != nil {
		t.Fatalf("stream with auth call failed: %v", err)
	}

	// Send heartbeat
	err = streamWithAuth.Send(&protocol.AgentMessage{
		NodeId: enrollResp.NodeId,
		Payload: &protocol.AgentMessage_Heartbeat{
			Heartbeat: &protocol.Heartbeat{
				CpuPercent:    12.5,
				RamPercent:    45.0,
				DiskPercent:   30.0,
				UptimeSeconds: 1200,
				Timestamp:     time.Now().Unix(),
			},
		},
	})
	if err != nil {
		t.Fatalf("failed to send heartbeat: %v", err)
	}

	// Receive HeartbeatAck
	resp, err := streamWithAuth.Recv()
	if err != nil {
		t.Fatalf("failed to receive heartbeat ack: %v", err)
	}

	if resp.GetHeartbeatAck() == nil {
		t.Fatalf("expected HeartbeatAck in response, got %+v", resp)
	}

	_ = conn.Close()
}

func TestGRPCReflection(t *testing.T) {
	_, conn, _, _ := setupTestGRPC(t)

	refClient := grpc_reflection_v1.NewServerReflectionClient(conn)
	stream, err := refClient.ServerReflectionInfo(context.Background())
	if err != nil {
		t.Fatalf("reflection info stream failed: %v", err)
	}

	err = stream.Send(&grpc_reflection_v1.ServerReflectionRequest{
		MessageRequest: &grpc_reflection_v1.ServerReflectionRequest_ListServices{
			ListServices: "*",
		},
	})
	if err != nil {
		t.Fatalf("failed to send reflection request: %v", err)
	}

	resp, err := stream.Recv()
	if err != nil {
		t.Fatalf("failed to receive reflection response: %v", err)
	}

	listResp := resp.GetListServicesResponse()
	if listResp == nil {
		t.Fatalf("expected list services response, got nil")
	}

	foundAgentService := false
	for _, svc := range listResp.Service {
		if svc.Name == "tako.agent.v1.AgentService" {
			foundAgentService = true
			break
		}
	}

	if !foundAgentService {
		t.Fatalf("expected tako.agent.v1.AgentService in reflection response, got: %+v", listResp.Service)
	}
}

func TestGRPCTaskAckRoundtrip(t *testing.T) {
	client, conn, validToken, agentServer := setupTestGRPC(t)
	defer conn.Close()

	// 1. Enroll
	enrollResp, err := client.Enroll(context.Background(), &protocol.EnrollRequest{
		Token:        validToken,
		Hostname:     "worker-prune",
		AgentVersion: "v1.0.0",
	})
	if err != nil {
		t.Fatalf("enroll failed: %v", err)
	}

	// 2. Connect stream
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	streamCtx := metadata.NewOutgoingContext(ctx, metadata.Pairs(
		"node-id", enrollResp.NodeId,
		"node-secret", enrollResp.NodeSecret,
	))

	stream, err := client.StreamNodeSession(streamCtx)
	if err != nil {
		t.Fatalf("StreamNodeSession failed: %v", err)
	}

	// Send heartbeat to establish online status in NodeManager
	err = stream.Send(&protocol.AgentMessage{
		NodeId: enrollResp.NodeId,
		Payload: &protocol.AgentMessage_Heartbeat{
			Heartbeat: &protocol.Heartbeat{
				CpuPercent: 5.0,
				Timestamp:  time.Now().Unix(),
			},
		},
	})
	if err != nil {
		t.Fatalf("heartbeat send failed: %v", err)
	}

	// Wait for heartbeat ack
	msg, err := stream.Recv()
	if err != nil {
		t.Fatalf("heartbeat ack recv failed: %v", err)
	}
	if msg.GetHeartbeatAck() == nil {
		t.Fatalf("expected HeartbeatAck, got %+v", msg)
	}

	// 3. Server sends PruneCommand via SendTaskWithResponse
	taskID := "tsk_prune_123"
	ackChan := make(chan *protocol.TaskAck, 1)
	errChan := make(chan error, 1)

	go func() {
		ack, err := agentServer.nodeManager.SendTaskWithResponse(ctx, enrollResp.NodeId, taskID, &protocol.ServerMessage{
			Payload: &protocol.ServerMessage_PruneCommand{
				PruneCommand: &protocol.PruneCommand{
					TaskId:           taskID,
					KeepRecentImages: 5,
				},
			},
		})
		if err != nil {
			errChan <- err
			return
		}
		ackChan <- ack
	}()

	// 4. Client receives PruneCommand
	serverMsg, err := stream.Recv()
	if err != nil {
		t.Fatalf("failed to receive server message: %v", err)
	}
	pruneCmd := serverMsg.GetPruneCommand()
	if pruneCmd == nil || pruneCmd.GetTaskId() != taskID {
		t.Fatalf("expected PruneCommand with task ID %s, got: %+v", taskID, serverMsg)
	}

	// 5. Client replies with TaskAck
	err = stream.Send(&protocol.AgentMessage{
		NodeId: enrollResp.NodeId,
		Payload: &protocol.AgentMessage_TaskAck{
			TaskAck: &protocol.TaskAck{
				TaskId:         taskID,
				Success:        true,
				Message:        "Prune finished",
				ReclaimedBytes: 104857600, // 100 MB
			},
		},
	})
	if err != nil {
		t.Fatalf("failed to send task ack: %v", err)
	}

	// 6. Server receives TaskAck
	select {
	case err := <-errChan:
		t.Fatalf("SendTaskWithResponse error: %v", err)
	case ack := <-ackChan:
		if ack.GetTaskId() != taskID {
			t.Errorf("expected task ID %s, got %s", taskID, ack.GetTaskId())
		}
		if !ack.GetSuccess() {
			t.Errorf("expected success true, got false")
		}
		if ack.GetReclaimedBytes() != 104857600 {
			t.Errorf("expected 104857600 reclaimed bytes, got %d", ack.GetReclaimedBytes())
		}
	case <-time.After(3 * time.Second):
		t.Fatal("timed out waiting for task ack on server")
	}
}

func TestGRPCDomainSSLReport(t *testing.T) {
	client, conn, validToken, agentServer := setupTestGRPC(t)
	defer conn.Close()

	enrollResp, err := client.Enroll(context.Background(), &protocol.EnrollRequest{
		Token:        validToken,
		Hostname:     "worker-ssl",
		AgentVersion: "v1.0.0",
	})
	if err != nil {
		t.Fatalf("enroll failed: %v", err)
	}

	// Seed domain in DB with pending status
	_, err = agentServer.db.Exec(`
		INSERT INTO projects (id, name, created_at) VALUES ('prj_ssl', 'SSL Test', CURRENT_TIMESTAMP);
		INSERT INTO services (id, project_id, server_id, name, repository, branch, dockerfile_path, status, created_at) VALUES ('svc_ssl', 'prj_ssl', ?, 'SSL App', 'github.com/example/repo', 'main', 'Dockerfile', 'healthy', CURRENT_TIMESTAMP);
		INSERT INTO domains (id, service_id, domain, port, ssl_status, created_at) VALUES ('dom_ssl', 'svc_ssl', 'api.test.com', 3000, 'pending', CURRENT_TIMESTAMP);
	`, enrollResp.NodeId)
	if err != nil {
		t.Fatalf("failed to seed test domain: %v", err)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	streamCtx := metadata.NewOutgoingContext(ctx, metadata.Pairs(
		"node-id", enrollResp.NodeId,
		"node-secret", enrollResp.NodeSecret,
	))

	stream, err := client.StreamNodeSession(streamCtx)
	if err != nil {
		t.Fatalf("StreamNodeSession failed: %v", err)
	}

	// Send DomainSSLReport from agent
	err = stream.Send(&protocol.AgentMessage{
		NodeId: enrollResp.NodeId,
		Payload: &protocol.AgentMessage_DomainSslReport{
			DomainSslReport: &protocol.DomainSSLReport{
				Statuses: []*protocol.DomainSSLStatus{
					{
						Domain:    "api.test.com",
						Status:    "active",
						ExpiresAt: time.Now().Add(90 * 24 * time.Hour).Unix(),
					},
				},
				Timestamp: time.Now().Unix(),
			},
		},
	})
	if err != nil {
		t.Fatalf("failed to send domain ssl report: %v", err)
	}

	// Verify DB is updated to active
	var status string
	for i := 0; i < 20; i++ {
		time.Sleep(50 * time.Millisecond)
		err = agentServer.db.QueryRow(`SELECT ssl_status FROM domains WHERE domain = 'api.test.com'`).Scan(&status)
		if err == nil && status == "active" {
			break
		}
	}

	if status != "active" {
		t.Errorf("expected domain ssl_status active, got %s", status)
	}
}

