package grpc_test

import (
	"context"
	"net"
	"testing"

	internalgrpc "gettako.dev/tako/internal/grpc"
	takov1 "gettako.dev/tako/proto/gen/go/tako/v1"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/status"
)

func TestMasterGRPCServerAuthAndHandlers(t *testing.T) {
	lis, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("failed to listen: %v", err)
	}
	defer lis.Close()

	secret := "test-agent-secret"
	srv := internalgrpc.NewServer(internalgrpc.ServerConfig{
		AgentSecret: secret,
	})

	go func() {
		_ = srv.Serve(lis)
	}()
	defer srv.Stop()

	conn, err := grpc.NewClient(
		lis.Addr().String(),
		grpc.WithTransportCredentials(insecure.NewCredentials()),
	)
	if err != nil {
		t.Fatalf("failed to dial: %v", err)
	}
	defer conn.Close()

	agentClient := takov1.NewAgentServiceClient(conn)
	ctx := context.Background()

	// 1. RegisterNode should succeed without secret (handshake)
	regResp, err := agentClient.RegisterNode(ctx, &takov1.RegisterNodeRequest{
		NodeId:      "node-worker-1",
		Name:        "Worker 1",
		EnrollToken: "enroll-abc",
	})
	if err != nil {
		t.Fatalf("RegisterNode failed: %v", err)
	}
	if regResp.GetStatus() != "registered" {
		t.Errorf("expected registered status, got %s", regResp.GetStatus())
	}

	// 2. Heartbeat without auth should be rejected with codes.Unauthenticated
	_, err = agentClient.Heartbeat(ctx, &takov1.HeartbeatRequest{
		NodeId: "node-worker-1",
	})
	if err == nil {
		t.Fatalf("expected unauthenticated error, got nil")
	}
	if st, ok := status.FromError(err); !ok || st.Code() != codes.Unauthenticated {
		t.Errorf("expected codes.Unauthenticated, got %v", err)
	}

	// 3. Heartbeat with valid auth header should succeed
	authedCtx := metadata.AppendToOutgoingContext(ctx, "authorization", "Bearer "+secret)
	hbResp, err := agentClient.Heartbeat(authedCtx, &takov1.HeartbeatRequest{
		NodeId:     "node-worker-1",
		CpuPercent: 12.5,
	})
	if err != nil {
		t.Fatalf("authenticated Heartbeat failed: %v", err)
	}
	if !hbResp.GetAcknowledged() {
		t.Errorf("expected acknowledged=true, got false")
	}

	// 4. Heartbeat with registered agent token should succeed
	agentTokenCtx := metadata.AppendToOutgoingContext(ctx, "authorization", "Bearer "+regResp.GetAuthToken())
	hbResp2, err := agentClient.Heartbeat(agentTokenCtx, &takov1.HeartbeatRequest{
		NodeId:     "node-worker-1",
		CpuPercent: 15.0,
	})
	if err != nil {
		t.Fatalf("agent-token Heartbeat failed: %v", err)
	}
	if !hbResp2.GetAcknowledged() {
		t.Errorf("expected acknowledged=true, got false")
	}

	// 5. Heartbeat with forged agent token (even with tako-agent- prefix) MUST fail
	forgedTokenCtx := metadata.AppendToOutgoingContext(ctx, "authorization", "Bearer tako-agent-forged-random")
	_, err = agentClient.Heartbeat(forgedTokenCtx, &takov1.HeartbeatRequest{
		NodeId:     "node-worker-1",
		CpuPercent: 15.0,
	})
	if err == nil {
		t.Fatalf("expected unauthenticated error for forged token, got nil")
	}
	if st, ok := status.FromError(err); !ok || st.Code() != codes.Unauthenticated {
		t.Errorf("expected codes.Unauthenticated for forged token, got %v", err)
	}

	// 6. Valid node token attempting to send heartbeat for different node ID MUST fail
	_, err = agentClient.Heartbeat(agentTokenCtx, &takov1.HeartbeatRequest{
		NodeId:     "node-worker-2",
		CpuPercent: 15.0,
	})
	if err == nil {
		t.Fatalf("expected permission denied for mismatched node id, got nil")
	}
	if st, ok := status.FromError(err); !ok || st.Code() != codes.PermissionDenied {
		t.Errorf("expected codes.PermissionDenied for node mismatch, got %v", err)
	}
}

func TestRegisterNodeRejectsLeaderRoleAndExecFailsClosed(t *testing.T) {
	lis, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("failed to listen: %v", err)
	}
	defer lis.Close()

	srv := internalgrpc.NewServer(internalgrpc.ServerConfig{
		AgentSecret: "secret-abc",
	})
	go func() {
		_ = srv.Serve(lis)
	}()
	defer srv.Stop()

	conn, err := grpc.NewClient(
		lis.Addr().String(),
		grpc.WithTransportCredentials(insecure.NewCredentials()),
	)
	if err != nil {
		t.Fatalf("failed to dial: %v", err)
	}
	defer conn.Close()

	agentClient := takov1.NewAgentServiceClient(conn)
	containerClient := takov1.NewContainerServiceClient(conn)
	ctx := context.Background()

	// 1. Attempt to register node with leader role must be rejected
	_, err = agentClient.RegisterNode(ctx, &takov1.RegisterNodeRequest{
		NodeId: "malicious-node",
		Name:   "Malicious Node",
		Role:   "leader",
	})
	if err == nil {
		t.Fatalf("expected error when registering with role=leader, got nil")
	}
	if st, ok := status.FromError(err); !ok || st.Code() != codes.PermissionDenied {
		t.Errorf("expected codes.PermissionDenied for role=leader, got: %v", err)
	}

	// 2. ExecCommand on unknown container must fail closed with error
	authedCtx := metadata.AppendToOutgoingContext(ctx, "authorization", "Bearer secret-abc")
	execResp, err := containerClient.ExecCommand(authedCtx, &takov1.ExecCommandRequest{
		ContainerId: "non-existent-container",
		Command:     "whoami",
	})
	if err != nil {
		t.Fatalf("ExecCommand RPC failed: %v", err)
	}
	if execResp.GetExitCode() == 0 || execResp.GetError() == "" {
		t.Errorf("expected non-zero exit code and error for unknown container, got code=%d, err=%s", execResp.GetExitCode(), execResp.GetError())
	}
}
