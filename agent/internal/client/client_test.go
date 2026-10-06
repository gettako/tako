package client_test

import (
	"context"
	"net"
	"testing"
	"time"

	"gettako.dev/tako/agent/internal/client"
	takov1 "gettako.dev/tako/proto/gen/go/tako/v1"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/status"
)

type mockAgentServer struct {
	takov1.UnimplementedAgentServiceServer
	requiredSecret string
}

func (s *mockAgentServer) RegisterNode(ctx context.Context, req *takov1.RegisterNodeRequest) (*takov1.RegisterNodeResponse, error) {
	return &takov1.RegisterNodeResponse{
		NodeId:    req.GetNodeId(),
		Status:    "registered",
		AuthToken: "issued-token-999",
	}, nil
}

func (s *mockAgentServer) Heartbeat(ctx context.Context, req *takov1.HeartbeatRequest) (*takov1.HeartbeatResponse, error) {
	md, ok := metadata.FromIncomingContext(ctx)
	if !ok || len(md.Get("authorization")) == 0 || md.Get("authorization")[0] != "Bearer "+s.requiredSecret {
		return nil, status.Error(codes.Unauthenticated, "unauthorized")
	}
	return &takov1.HeartbeatResponse{
		Acknowledged: true,
		Timestamp:    time.Now().Unix(),
	}, nil
}

func TestAgentClientConnectionAndAuth(t *testing.T) {
	lis, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("failed to listen: %v", err)
	}
	defer lis.Close()

	srv := grpc.NewServer()
	mockSrv := &mockAgentServer{requiredSecret: "agent-secret-456"}
	takov1.RegisterAgentServiceServer(srv, mockSrv)

	go func() {
		_ = srv.Serve(lis)
	}()
	defer srv.Stop()

	// 1. Create client initially without token
	c, err := client.New(client.Config{
		ServerAddr: lis.Addr().String(),
		Insecure:   true,
	})
	if err != nil {
		t.Fatalf("client.New failed: %v", err)
	}
	defer c.Close()

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	// 2. RegisterNode works without prior token
	regResp, err := c.RegisterNode(ctx, &takov1.RegisterNodeRequest{
		NodeId:      "node-agent-1",
		Name:        "Agent 1",
		EnrollToken: "enroll-123",
	})
	if err != nil {
		t.Fatalf("RegisterNode failed: %v", err)
	}
	if regResp.GetNodeId() != "node-agent-1" {
		t.Errorf("expected node ID node-agent-1, got %s", regResp.GetNodeId())
	}

	// 3. Heartbeat without setting auth token should fail
	_, err = c.Heartbeat(ctx, &takov1.HeartbeatRequest{NodeId: "node-agent-1"})
	if err == nil {
		t.Fatalf("expected unauthenticated error, got nil")
	}

	// 4. Set token on client, heartbeat should succeed
	c.SetAuthToken("agent-secret-456")
	hbResp, err := c.Heartbeat(ctx, &takov1.HeartbeatRequest{NodeId: "node-agent-1"})
	if err != nil {
		t.Fatalf("authenticated heartbeat failed: %v", err)
	}
	if !hbResp.GetAcknowledged() {
		t.Errorf("expected acknowledged=true")
	}
}
