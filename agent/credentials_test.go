package main

import (
	"context"
	"net"
	"os"
	"path/filepath"
	"testing"

	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	"gettako.dev/tako/agent/config"
	"gettako.dev/tako/internal/protocol"
)

type mockAgentServiceServer struct {
	protocol.UnimplementedAgentServiceServer
	validToken  string
	enrollCalls int
}

func (m *mockAgentServiceServer) Enroll(ctx context.Context, req *protocol.EnrollRequest) (*protocol.EnrollResponse, error) {
	m.enrollCalls++
	if req.GetToken() != m.validToken {
		return nil, status.Error(codes.PermissionDenied, "invalid or expired enrollment token")
	}
	return &protocol.EnrollResponse{
		NodeId:     "srv_mock_node_123",
		NodeSecret: "secret_abc_456",
		ServerUrl:  "http://test-server:50051",
	}, nil
}

func TestCredentialsStorageAndPermissions(t *testing.T) {
	tempDir := t.TempDir()

	creds := &AgentCredentials{
		NodeID:     "srv_test",
		NodeSecret: "secret_123",
		ServerURL:  "http://localhost:50051",
	}

	if err := saveCredentials(tempDir, creds); err != nil {
		t.Fatalf("saveCredentials failed: %v", err)
	}

	credPath := filepath.Join(tempDir, "agent.json")
	info, err := os.Stat(credPath)
	if err != nil {
		t.Fatalf("agent.json does not exist: %v", err)
	}

	// Verify 0600 permissions
	if perm := info.Mode().Perm(); perm != 0600 {
		t.Fatalf("expected 0600 permissions, got %o", perm)
	}

	loaded, err := loadCredentials(tempDir)
	if err != nil {
		t.Fatalf("loadCredentials failed: %v", err)
	}

	if loaded.NodeID != creds.NodeID || loaded.NodeSecret != creds.NodeSecret || loaded.ServerURL != creds.ServerURL {
		t.Fatalf("loaded credentials mismatch: %+v vs %+v", loaded, creds)
	}
}

func TestEnsureEnrollmentFlow(t *testing.T) {
	lis, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("net.Listen failed: %v", err)
	}

	mockServer := &mockAgentServiceServer{validToken: "tok_valid_test"}
	grpcServer := grpc.NewServer()
	protocol.RegisterAgentServiceServer(grpcServer, mockServer)

	go func() {
		_ = grpcServer.Serve(lis)
	}()
	defer grpcServer.Stop()

	tempDir := t.TempDir()
	serverURL := "http://" + lis.Addr().String()

	// 1. Invalid token returns PermissionDenied
	invalidCfg := &config.Config{
		ServerURL:       serverURL,
		EnrollmentToken: "tok_invalid",
		ConfigDir:       tempDir,
	}
	_, err = ensureEnrollment(context.Background(), invalidCfg, "26.1.0")
	if err == nil {
		t.Fatal("expected error with invalid token, got nil")
	}

	st, ok := status.FromError(status.Convert(err).Err())
	if !ok || st.Code() != codes.PermissionDenied {
		// In Go, wrapped error status can be extracted via status.FromError
		if !statusFromErrContains(err, codes.PermissionDenied) {
			t.Fatalf("expected PermissionDenied in error chain, got: %v", err)
		}
	}

	// 2. Valid token succeeds and persists credentials
	validCfg := &config.Config{
		ServerURL:       serverURL,
		EnrollmentToken: "tok_valid_test",
		ConfigDir:       tempDir,
	}
	creds, err := ensureEnrollment(context.Background(), validCfg, "26.1.0")
	if err != nil {
		t.Fatalf("ensureEnrollment failed: %v", err)
	}

	if creds.NodeID != "srv_mock_node_123" || creds.NodeSecret != "secret_abc_456" {
		t.Fatalf("unexpected credentials: %+v", creds)
	}

	// Verify agent.json file permissions
	credPath := filepath.Join(tempDir, "agent.json")
	info, err := os.Stat(credPath)
	if err != nil {
		t.Fatalf("agent.json does not exist: %v", err)
	}
	if perm := info.Mode().Perm(); perm != 0600 {
		t.Fatalf("expected 0600 permissions, got %o", perm)
	}

	// 3. Subsequent restart bypasses enrollment without calling Enroll RPC again
	restartCfg := &config.Config{
		ServerURL:       serverURL,
		EnrollmentToken: "",
		ConfigDir:       tempDir,
	}
	cachedCreds, err := ensureEnrollment(context.Background(), restartCfg, "26.1.0")
	if err != nil {
		t.Fatalf("subsequent ensureEnrollment failed: %v", err)
	}
	if cachedCreds.NodeID != creds.NodeID {
		t.Fatalf("expected cached node ID %s, got %s", creds.NodeID, cachedCreds.NodeID)
	}
	if mockServer.enrollCalls != 2 { // 1 failed + 1 successful = 2 calls total
		t.Fatalf("expected 2 enroll calls, got %d", mockServer.enrollCalls)
	}
}

func statusFromErrContains(err error, code codes.Code) bool {
	if s, ok := status.FromError(err); ok && s.Code() == code {
		return true
	}
	type unwrap interface{ Unwrap() error }
	if u, ok := err.(unwrap); ok && u.Unwrap() != nil {
		return statusFromErrContains(u.Unwrap(), code)
	}
	return false
}
