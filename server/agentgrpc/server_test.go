package agentgrpc

import (
	"context"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"fmt"
	"net"
	"path/filepath"
	"testing"
	"time"

	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/status"

	"gettako.dev/tako/internal/protocol"
	"gettako.dev/tako/server/db"
	"gettako.dev/tako/server/nodes"
)

func setupAgentGRPCTest(t *testing.T) (protocol.AgentServiceClient, *sql.DB, string) {
	tempDir := t.TempDir()
	dbPath := filepath.Join(tempDir, "agent_grpc_test.db")

	database, err := db.Open(dbPath)
	if err != nil {
		t.Fatalf("failed to open db: %v", err)
	}
	t.Cleanup(func() { database.Close() })

	token := "tako_tok_test_token"
	_, err = database.Exec(`
		INSERT INTO servers (id, name, status, enrollment_token, token_expires_at)
		VALUES ('srv_test_node', 'Test Node', 'pending', ?, ?)
	`, token, time.Now().Add(1*time.Hour))
	if err != nil {
		t.Fatalf("failed to insert test server: %v", err)
	}

	lis, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("failed to listen: %v", err)
	}

	grpcServer := grpc.NewServer()
	agentServer := NewAgentServer(database, "localhost", nodes.NewNodeManager(database))
	protocol.RegisterAgentServiceServer(grpcServer, agentServer)

	go func() {
		_ = grpcServer.Serve(lis)
	}()
	t.Cleanup(func() { grpcServer.Stop() })

	conn, err := grpc.NewClient(lis.Addr().String(), grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		t.Fatalf("failed to dial: %v", err)
	}
	t.Cleanup(func() { conn.Close() })

	client := protocol.NewAgentServiceClient(conn)
	return client, database, token
}

func TestNodeSecretHashedAndStreamAuth(t *testing.T) {
	client, database, token := setupAgentGRPCTest(t)

	// 1. Enroll agent
	res, err := client.Enroll(context.Background(), &protocol.EnrollRequest{
		Token:        token,
		Hostname:     "worker-test",
		AgentVersion: "v1.0.0",
	})
	if err != nil {
		t.Fatalf("enroll failed: %v", err)
	}

	if res.NodeSecret == "" {
		t.Fatal("expected node_secret returned in EnrollResponse")
	}

	// 2. Verify database: plaintext node_secret MUST NOT be stored, only node_secret_hash
	var dbNodeSecret, dbNodeSecretHash sql.NullString
	err = database.QueryRow(`
		SELECT node_secret, node_secret_hash FROM servers WHERE id = 'srv_test_node'
	`).Scan(&dbNodeSecret, &dbNodeSecretHash)
	if err != nil {
		t.Fatalf("failed to query servers table: %v", err)
	}

	if dbNodeSecret.Valid && dbNodeSecret.String != "" {
		t.Errorf("expected plaintext node_secret in database to be NULL or empty, got: %s", dbNodeSecret.String)
	}

	if !dbNodeSecretHash.Valid || dbNodeSecretHash.String == "" {
		t.Fatal("expected node_secret_hash to be populated in database")
	}

	// Verify the stored hash matches sha256(nodeSecret)
	expectedHash := sha256.Sum256([]byte(res.NodeSecret))
	expectedHashHex := hex.EncodeToString(expectedHash[:])
	if dbNodeSecretHash.String != expectedHashHex {
		t.Errorf("stored hash mismatch: got %s, expected %s", dbNodeSecretHash.String, expectedHashHex)
	}

	// 3. Connect StreamNodeSession with mismatched secret -> fails Unauthenticated
	badCtx := metadata.NewOutgoingContext(context.Background(), metadata.Pairs(
		"node-id", "srv_test_node",
		"node-secret", "wrong-secret-value",
	))
	badStream, err := client.StreamNodeSession(badCtx)
	if err != nil {
		t.Fatalf("stream call error: %v", err)
	}
	_, err = badStream.Recv()
	if err == nil {
		t.Fatal("expected error on stream with wrong secret, got nil")
	}
	if st, ok := status.FromError(err); !ok || st.Code() != codes.Unauthenticated {
		t.Errorf("expected Unauthenticated, got: %v", err)
	}

	// 4. Connect StreamNodeSession with valid secret -> succeeds
	goodCtx := metadata.NewOutgoingContext(context.Background(), metadata.Pairs(
		"node-id", "srv_test_node",
		"node-secret", res.NodeSecret,
	))
	goodStream, err := client.StreamNodeSession(goodCtx)
	if err != nil {
		t.Fatalf("good stream call error: %v", err)
	}
	err = goodStream.Send(&protocol.AgentMessage{
		NodeId: "srv_test_node",
		Payload: &protocol.AgentMessage_Heartbeat{
			Heartbeat: &protocol.Heartbeat{
				CpuPercent: 5.0,
				Timestamp:  time.Now().Unix(),
			},
		},
	})
	if err != nil {
		t.Fatalf("failed to send heartbeat: %v", err)
	}
}

func TestEnrollRateLimiting(t *testing.T) {
	client, database, _ := setupAgentGRPCTest(t)

	// Make 5 requests (which will fail with PermissionDenied because of invalid token)
	for i := 0; i < 5; i++ {
		_, err := client.Enroll(context.Background(), &protocol.EnrollRequest{
			Token: fmt.Sprintf("invalid_tok_%d", i),
		})
		if err == nil {
			t.Fatal("expected invalid token error")
		}
		st, _ := status.FromError(err)
		if st.Code() != codes.PermissionDenied {
			t.Fatalf("expected PermissionDenied on attempt %d, got %v", i+1, st.Code())
		}
	}

	// 6th attempt should be rate limited with ResourceExhausted
	_, err := client.Enroll(context.Background(), &protocol.EnrollRequest{
		Token: "invalid_tok_6",
	})
	if err == nil {
		t.Fatal("expected rate limit error")
	}
	st, _ := status.FromError(err)
	if st.Code() != codes.ResourceExhausted {
		t.Fatalf("expected ResourceExhausted due to rate limiting, got: %v", st.Code())
	}
	_ = database
}
